// 简化的渲染配置选项
export const RENDERING_CONFIG = {
  // 颜色提取算法配置
  COLOR_EXTRACTION: {
    // 是否启用改进的颜色提取（加权平均 + 饱和度增强）
    ENABLE_ADVANCED_EXTRACTION: true,
    
    // 启用高级提取的最大块级别（超过此级别使用传统方法）
    MAX_LEVEL_FOR_ADVANCED: 3,
    
    // 饱和度增强系数
    SATURATION_BOOST: 1.15
  },
  
  // 性能配置
  PERFORMANCE: {
    // 颜色采样间隔（每N个像素采样一次）
    SAMPLING_INTERVAL: 3, // 移动端友好的采样间隔
    
    // 缓存大小限制
    MAX_CACHE_SIZE: 15
  }
};

// 简化的预设配置
export const PRESETS = {
  // 高质量模式（更好的颜色效果，采样更密集）
  HIGH_QUALITY: {
    ...RENDERING_CONFIG,
    COLOR_EXTRACTION: {
      ...RENDERING_CONFIG.COLOR_EXTRACTION,
      SATURATION_BOOST: 1.2
    },
    PERFORMANCE: {
      ...RENDERING_CONFIG.PERFORMANCE,
      SAMPLING_INTERVAL: 2
    }
  },
  
  // 性能模式（更快的渲染，适合低配设备）
  PERFORMANCE_MODE: {
    ...RENDERING_CONFIG,
    COLOR_EXTRACTION: {
      ...RENDERING_CONFIG.COLOR_EXTRACTION,
      ENABLE_ADVANCED_EXTRACTION: false,
      SATURATION_BOOST: 1.0
    },
    PERFORMANCE: {
      ...RENDERING_CONFIG.PERFORMANCE,
      SAMPLING_INTERVAL: 4
    }
  },
  
  // 平衡模式（默认）
  BALANCED: RENDERING_CONFIG
};

// 根据设备性能自动选择预设
export function getOptimalPreset() {
  const memory = navigator.deviceMemory || 4;
  const cores = navigator.hardwareConcurrency || 2;
  const pixelRatio = window.devicePixelRatio || 1;
  
  // 计算性能评分
  const performanceScore = (memory * 0.4) + (cores * 0.4) + (pixelRatio * 0.2);
  
  if (performanceScore >= 6) {
    return 'HIGH_QUALITY';
  } else if (performanceScore <= 3) {
    return 'PERFORMANCE_MODE';
  } else {
    return 'BALANCED';
  }
}

// 获取当前配置
export function getCurrentConfig() {
  try {
    const savedPreset = localStorage.getItem('puzzle_rendering_preset');
    if (savedPreset && PRESETS[savedPreset]) {
      return PRESETS[savedPreset];
    }
    
    const optimalPreset = getOptimalPreset();
    return PRESETS[optimalPreset];
  } catch (error) {
    console.warn('获取渲染配置失败，使用默认配置:', error);
    return RENDERING_CONFIG; // 回退到默认配置
  }
}