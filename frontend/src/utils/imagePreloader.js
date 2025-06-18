// utils/imagePreloader.js - 图片预加载器

class ImagePreloader {
  constructor() {
    this.cache = new Map(); // URL -> { img, timestamp, size }
    this.loading = new Map(); // URL -> Promise
    this.maxCacheSize = 50; // 最大缓存图片数
    this.maxCacheAge = 30 * 60 * 1000; // 30分钟过期
    this.totalCacheSize = 0;
    this.maxTotalSize = 100 * 1024 * 1024; // 100MB总限制
  }

  /**
   * 预加载图片，带缓存和优先级
   */
  async preloadImage(url, priority = 'normal') {
    // 检查缓存
    if (this.cache.has(url)) {
      const cached = this.cache.get(url);
      // 检查是否过期
      if (Date.now() - cached.timestamp < this.maxCacheAge) {
        return cached.img;
      } else {
        this.removeFromCache(url);
      }
    }

    // 检查是否正在加载
    if (this.loading.has(url)) {
      return await this.loading.get(url);
    }

    // 创建加载Promise
    const loadPromise = this.loadImageWithTimeout(url, priority);
    this.loading.set(url, loadPromise);

    try {
      const img = await loadPromise;
      this.addToCache(url, img);
      return img;
    } finally {
      this.loading.delete(url);
    }
  }

  /**
   * 带超时的图片加载
   */
  loadImageWithTimeout(url, priority, timeout = 15000) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      // 设置优先级
      if (priority === 'high') {
        img.loading = 'eager';
        img.fetchPriority = 'high';
      } else if (priority === 'low') {
        img.loading = 'lazy';
        img.fetchPriority = 'low';
      }

      const timeoutId = setTimeout(() => {
        img.onload = img.onerror = null;
        reject(new Error(`图片加载超时: ${url}`));
      }, timeout);

      img.onload = () => {
        clearTimeout(timeoutId);
        resolve(img);
      };

      img.onerror = (err) => {
        clearTimeout(timeoutId);
        reject(new Error(`图片加载失败: ${url} - ${err.message || 'Unknown error'}`));
      };

      img.src = url;
    });
  }

  /**
   * 添加到缓存
   */
  addToCache(url, img) {
    // 估算图片大小
    const estimatedSize = img.naturalWidth * img.naturalHeight * 4; // RGBA
    
    // 清理过期缓存
    this.cleanupExpiredCache();
    
    // 确保有足够空间
    while ((this.cache.size >= this.maxCacheSize || 
            this.totalCacheSize + estimatedSize > this.maxTotalSize) && 
           this.cache.size > 0) {
      this.removeOldestFromCache();
    }

    this.cache.set(url, {
      img: img,
      timestamp: Date.now(),
      size: estimatedSize
    });
    this.totalCacheSize += estimatedSize;
  }

  /**
   * 从缓存中移除
   */
  removeFromCache(url) {
    if (this.cache.has(url)) {
      const cached = this.cache.get(url);
      this.totalCacheSize -= cached.size;
      this.cache.delete(url);
    }
  }

  /**
   * 移除最旧的缓存项
   */
  removeOldestFromCache() {
    let oldestUrl = null;
    let oldestTime = Date.now();
    
    for (const [url, cached] of this.cache.entries()) {
      if (cached.timestamp < oldestTime) {
        oldestTime = cached.timestamp;
        oldestUrl = url;
      }
    }
    
    if (oldestUrl) {
      this.removeFromCache(oldestUrl);
    }
  }

  /**
   * 清理过期缓存
   */
  cleanupExpiredCache() {
    const now = Date.now();
    const expiredUrls = [];
    
    for (const [url, cached] of this.cache.entries()) {
      if (now - cached.timestamp > this.maxCacheAge) {
        expiredUrls.push(url);
      }
    }
    
    expiredUrls.forEach(url => this.removeFromCache(url));
  }

  /**
   * 批量预加载
   */
  async preloadBatch(urls, maxConcurrent = 3) {
    const results = [];
    
    for (let i = 0; i < urls.length; i += maxConcurrent) {
      const batch = urls.slice(i, i + maxConcurrent);
      const batchPromises = batch.map(url => 
        this.preloadImage(url, 'normal').catch(err => {
          console.warn(`预加载失败: ${url}`, err);
          return null;
        })
      );
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }
    
    return results;
  }

  /**
   * 获取缓存统计
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      totalSize: this.totalCacheSize,
      loading: this.loading.size,
      maxSize: this.maxCacheSize,
      maxTotalSize: this.maxTotalSize
    };
  }

  /**
   * 清空缓存
   */
  clearCache() {
    this.cache.clear();
    this.loading.clear();
    this.totalCacheSize = 0;
  }
}

export const imagePreloader = new ImagePreloader();