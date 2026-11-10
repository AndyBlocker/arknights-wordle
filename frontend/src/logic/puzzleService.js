// src/logic/puzzleService.js
import { getImagePath } from '../utils/imageUtils';
import { imagePreloader } from '../utils/imagePreloader';
import { executeIntegralImageTask } from '../utils/workerManager';
import { 
    extractDominantColors
} from './advancedColorExtraction';
import { getCurrentConfig } from '../config/renderingConfig';

// Cache only pixel data; viewport-dependent display geometry is calculated on use.
const integralCache = new Map();
const operatorArtCache = new Map();
let integralCacheBytes = 0;

function pixelBytes(value) {
  const arrays = [value.originalImageData?.data, value.integralData?.sumR,
    value.integralData?.sumG, value.integralData?.sumB, value.integralData?.alphaCount];
  return arrays.reduce((sum, array) => sum + (array?.byteLength || 0), 0);
}

function addToIntegralCache(key, value) {
  const config = getCurrentConfig().PERFORMANCE;
  const maxBytes = config.MAX_CACHE_BYTES || 48 * 1024 * 1024;
  const bytes = pixelBytes(value);
  if (integralCache.has(key)) {
    integralCacheBytes -= pixelBytes(integralCache.get(key));
    integralCache.delete(key);
  }
  if (bytes > maxBytes) return;
  while (integralCache.size && (integralCache.size >= config.MAX_CACHE_SIZE || integralCacheBytes + bytes > maxBytes)) {
    const oldest = integralCache.keys().next().value;
    integralCacheBytes -= pixelBytes(integralCache.get(oldest));
    integralCache.delete(oldest);
  }
  integralCache.set(key, value);
  integralCacheBytes += bytes;
}

export function getPuzzleCacheStats() {
  return { entries: integralCache.size, bytes: integralCacheBytes };
}

export function getAvailableArts(operator) {
  const arts = [`立绘_${operator.干员}_1.png`];
  // Rarity is stored as 0..5, whereas 星级 is 1..6. Three-star units cannot promote to elite 2.
  const stars = Number(operator.星级 ?? (Number(operator.稀有度) + 1));
  if (stars >= 4) arts.push(`立绘_${operator.干员}_2.png`);
  for (let i = 1; i <= 10; i++) {
    if (operator[`皮肤${i}名称`]) arts.push(`立绘_${operator.干员}_skin${i}.png`);
  }
  return arts;
}

function artCacheKey(operator, gameSessionId) {
  return `${operator.干员}\u0000${gameSessionId || ''}`;
}

function rememberArt(key, filename) {
  operatorArtCache.delete(key);
  operatorArtCache.set(key, filename);
  while (operatorArtCache.size > 100) operatorArtCache.delete(operatorArtCache.keys().next().value);
}

export function selectRandomArt(operator, gameSessionId = null) {
  const key = artCacheKey(operator, gameSessionId);
  if (operatorArtCache.has(key)) return operatorArtCache.get(key);
  const arts = getAvailableArts(operator);
  const selected = arts[Math.floor(Math.random() * arts.length)] || '';
  rememberArt(key, selected);
  return selected;
}

export function clearGameSessionCache(gameSessionId) {
  for (const key of operatorArtCache.keys()) {
    if (key.endsWith(`\u0000${gameSessionId}`)) operatorArtCache.delete(key);
  }
}

export function clearAllCache() {
  operatorArtCache.clear();
  integralCache.clear();
  integralCacheBytes = 0;
}

export function withPuzzleDisplaySize(result, maxWidth = 600, maxHeight = 600, viewportWidth = 800) {
  const { scaledW, scaledH } = calcScaledDimensions(result.imgWidth, result.imgHeight, maxWidth, maxHeight, viewportWidth);
  return { ...result, scaledWidth: scaledW, scaledHeight: scaledH };
}

function assertActive(signal) {
  if (signal?.aborted) throw Object.assign(new Error('图片加载已取消'), { name: 'AbortError' });
}

function waitForImage(promise, signal) {
  if (!signal) return promise;
  assertActive(signal);
  return new Promise((resolve, reject) => {
    const abort = () => reject(Object.assign(new Error('图片加载已取消'), { name: 'AbortError' }));
    signal.addEventListener('abort', abort, { once: true });
    promise.then(value => {
      signal.removeEventListener('abort', abort);
      resolve(value);
    }, error => {
      signal.removeEventListener('abort', abort);
      reject(error);
    });
  });
}

/** Load a session's selected art, falling back to the same operator's base art. */
export async function loadPuzzleImage(operator, maxWidth = 600, maxHeight = 600, initialViewportWidth = 800, gameSessionId = null, customArtSelector = null, signal = null) {
  assertActive(signal);
  const key = artCacheKey(operator, gameSessionId);
  const selected = operatorArtCache.get(key) || (customArtSelector
    ? customArtSelector(operator, gameSessionId) : selectRandomArt(operator, gameSessionId));
  if (!selected) throw new Error('没有可用的立绘，请重试或重新开始');
  const candidates = [...new Set([selected, `立绘_${operator.干员}_1.png`])];
  let lastError;
  for (const fileName of candidates) {
    assertActive(signal);
    const puzzleImageUrl = getImagePath(fileName);
    let pixels = integralCache.get(fileName);
    if (pixels) {
      integralCache.delete(fileName);
      integralCache.set(fileName, pixels);
    } else {
      let img;
      try {
        img = await waitForImage(imagePreloader.preloadImage(puzzleImageUrl, 'high'), signal);
      } catch (error) {
        if (error.name === 'AbortError') throw error;
        lastError = error;
        continue;
      }
      assertActive(signal);
      const imgWidth = img.naturalWidth;
      const imgHeight = img.naturalHeight;
      if (!(imgWidth > 0 && imgHeight > 0)) {
        lastError = new Error('图片尺寸无效');
        continue;
      }
      const performanceLevel = getDevicePerformanceLevel();
      const shrinkLimit = performanceLevel === 'high' ? 1200 : performanceLevel === 'low' ? 400 : 800;
      const scale = Math.min(1, shrinkLimit / Math.max(imgWidth, imgHeight));
      const finalWidth = Math.max(1, Math.floor(imgWidth * scale));
      const finalHeight = Math.max(1, Math.floor(imgHeight * scale));
      const canvas = createOptimizedCanvas(finalWidth, finalHeight);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('当前浏览器无法创建图像画布');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, finalWidth, finalHeight);
      let imageData;
      try {
        imageData = ctx.getImageData(0, 0, finalWidth, finalHeight);
      } catch (error) {
        lastError = error;
        continue;
      }
      const integralData = await executeIntegralImageTask('createIntegralImage', {
        imageData: { width: imageData.width, height: imageData.height, data: imageData.data }
      }, 'high', { signal });
      assertActive(signal);
      pixels = { imgWidth: finalWidth, imgHeight: finalHeight, integralData, originalImageData: imageData };
      addToIntegralCache(fileName, pixels);
    }
    assertActive(signal);
    rememberArt(key, fileName);
    return withPuzzleDisplaySize({ ...pixels, puzzleImageUrl, selectedArt: fileName,
      operatorName: operator.干员, gameSessionId }, maxWidth, maxHeight, initialViewportWidth);
  }
  throw new Error(lastError?.name === 'AbortError' ? '图片加载超时，请重试' : '立绘加载失败，请检查网络后重试');
}

/**
 * 获取设备性能等级
 */
function getDevicePerformanceLevel() {
    const memory = navigator.deviceMemory || 4; // GB
    const cores = navigator.hardwareConcurrency || 2;
    
    if (memory >= 8 && cores >= 8) {
        return 'high';
    } else if (memory >= 4 && cores >= 4) {
        return 'medium';
    } else {
        return 'low';
    }
}

/**
 * 创建优化的Canvas
 */
function createOptimizedCanvas(width, height) {
    if ('OffscreenCanvas' in window) {
        return new OffscreenCanvas(width, height);
    } else {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        return canvas;
    }
}

/**
 * 计算缩放后的显示尺寸（只是为了界面展示用，与生成积分图无关）
 */
export function calcScaledDimensions(w, h, maxW, maxH, viewportWidth) {
    const containerWidth = Math.max(1, Math.min(viewportWidth - 30, maxW));

    let scaledW = w;
    let scaledH = h;

    if (w > containerWidth || h > maxH) {
        const scaleW = containerWidth / w;
        const scaleH = maxH / h;
        const scale = Math.min(scaleW, scaleH);
        scaledW = Math.floor(w * scale);
        scaledH = Math.floor(h * scale);
    }

    return { scaledW, scaledH };
}

// createIntegralImage函数已移动到Web Worker中

function getIntegralSums(integral, x2, y2) {
    const idx = y2 * integral.width + x2;
    return {
        r: integral.sumR[idx],
        g: integral.sumG[idx],
        b: integral.sumB[idx],
        a: integral.alphaCount[idx]
    };
}

/**
 * 计算某区域的平均颜色
 */
function computeRegionAverage(integral, x1, y1, x2, y2) {
    if (x1 > x2) [x1, x2] = [x2, x1];
    if (y1 > y2) [y1, y2] = [y2, y1];
    if (x1 < 0) x1 = 0;
    if (y1 < 0) y1 = 0;
    if (x2 >= integral.width) x2 = integral.width - 1;
    if (y2 >= integral.height) y2 = integral.height - 1;

    const areaWidth = x2 - x1 + 1;
    const areaHeight = y2 - y1 + 1;

    const A = getIntegralSums(integral, x2, y2);
    const leftSum = x1 > 0 ? getIntegralSums(integral, x1 - 1, y2) : { r: 0, g: 0, b: 0, a: 0 };
    const C = y1 > 0 ? getIntegralSums(integral, x2, y1 - 1) : { r: 0, g: 0, b: 0, a: 0 };

    let r = A.r - leftSum.r - C.r;
    let g = A.g - leftSum.g - C.g;
    let b = A.b - leftSum.b - C.b;
    let a = A.a - leftSum.a - C.a;

    if (x1 > 0 && y1 > 0) {
        const D = getIntegralSums(integral, x1 - 1, y1 - 1);
        r += D.r;
        g += D.g;
        b += D.b;
        a += D.a;
    }

    const totalPixels = areaWidth * areaHeight;
    const alphaRatio = a / totalPixels;
    const MIN_OPACITY_RATIO = 0.15;
    if (alphaRatio < MIN_OPACITY_RATIO) {
        return 'rgb(255,255,255)';
    }
    if (a === 0) {
        return 'rgb(255,255,255)';
    }
    const R = Math.round(r / a);
    const G = Math.round(g / a);
    const B = Math.round(b / a);

    return `rgb(${R},${G},${B})`;
}

/**
 * 计算某个区块在 alpha 通道上的覆盖率
 */
function calcBlockAlphaCoverage(integral, block, scaledWidth, scaledHeight) {
    const ratioX = integral.width / scaledWidth;
    const ratioY = integral.height / scaledHeight;

    const x1 = Math.floor(block.x * ratioX);
    const y1 = Math.floor(block.y * ratioY);
    const x2 = Math.floor((block.x + block.width) * ratioX) - 1;
    const y2 = Math.floor((block.y + block.height) * ratioY) - 1;

    if (x1 > x2 || y1 > y2 || x2 < 0 || y2 < 0) {
        return 0;
    }

    const A = getIntegralSums(integral, x2, y2);
    const leftSum = x1 > 0 ? getIntegralSums(integral, x1 - 1, y2) : { a: 0 };
    const upSum = y1 > 0 ? getIntegralSums(integral, x2, y1 - 1) : { a: 0 };

    let alphaTotal = A.a - leftSum.a - upSum.a;
    if (x1 > 0 && y1 > 0) {
        const corner = getIntegralSums(integral, x1 - 1, y1 - 1);
        alphaTotal += corner.a;
    }

    const areaWidth = x2 - x1 + 1;
    const areaHeight = y2 - y1 + 1;
    const totalPixels = areaWidth * areaHeight;
    if (totalPixels <= 0) return 0;

    return alphaTotal / totalPixels;
}

/**
 * 为单个 block 赋值它的 color、skipRefine 等信息
 */
function assignBlockAttributes(block, integralData, scaledWidth, scaledHeight, minCoverage = 0.1, imageData = null) {
    // 计算覆盖率
    const coverage = calcBlockAlphaCoverage(integralData, block, scaledWidth, scaledHeight);
    if (coverage < minCoverage) {
        block.skipRefine = true;
    }
    
    // 计算区域坐标
    const ratioX = integralData.width / scaledWidth;
    const ratioY = integralData.height / scaledHeight;
    const origX1 = Math.floor(block.x * ratioX);
    const origY1 = Math.floor(block.y * ratioY);
    const origX2 = Math.floor((block.x + block.width) * ratioX) - 1;
    const origY2 = Math.floor((block.y + block.height) * ratioY) - 1;
    
    // 使用改进的颜色提取算法
    const config = getCurrentConfig();
    const useAdvanced = config.COLOR_EXTRACTION.ENABLE_ADVANCED_EXTRACTION;
    const maxLevel = config.COLOR_EXTRACTION.MAX_LEVEL_FOR_ADVANCED;
    
    if (useAdvanced && imageData && block.level <= maxLevel) {
        // 低级别使用高级颜色提取
        try {
            const dominantColors = extractDominantColors(imageData, origX1, origY1, origX2, origY2);
            if (dominantColors && dominantColors.length > 0 && dominantColors[0]) {
                // 只使用最主要的颜色，保持纯色填充
                const [r, g, b] = dominantColors[0];
                if (isValidColorValue(r) && isValidColorValue(g) && isValidColorValue(b)) {
                    block.color = `rgb(${r}, ${g}, ${b})`;
                } else {
                    throw new Error('无效的颜色值');
                }
            } else {
                throw new Error('未获取到有效颜色');
            }
        } catch (e) {
            if (process.env.NODE_ENV !== 'production') console.warn('高级颜色提取失败，回退到传统方法:', e.message);
            // 回退到传统方法
            block.color = computeRegionAverage(integralData, origX1, origY1, origX2, origY2);
        }
    } else {
        // 高级别或无原始图像数据时使用传统方法
        block.color = computeRegionAverage(integralData, origX1, origY1, origX2, origY2);
    }
}

/**
 * 验证颜色值是否有效
 */
function isValidColorValue(value) {
    return typeof value === 'number' && !isNaN(value) && value >= 0 && value <= 255;
}

/**
 * 初始化 blocks 并计算它们的 color
 */
export function initBlocks(scaledWidth, scaledHeight, initialGridSize, integralData = null, minCoverage = 0.01, originalImageData = null) {
    const blocks = [];
    const { rows, cols } = initialGridSize;
    const blockWidth = scaledWidth / cols;
    const blockHeight = scaledHeight / rows;

    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            const block = {
                row,
                col,
                x: col * blockWidth,
                y: row * blockHeight,
                width: blockWidth,
                height: blockHeight,
                initialRow: row,
                initialCol: col,
                level: 1,
                skipRefine: false
            };
            if (integralData) {
                assignBlockAttributes(block, integralData, scaledWidth, scaledHeight, minCoverage, originalImageData);
            }
            blocks.push(block);
        }
    }
    return blocks;
}

/**
 * 细化：把某区域内的所有 block 划分成更小的 block
 */
export function refineAreaBlocks(
    blocks,
    initialRow,
    initialCol,
    refinementFactor,
    integralData = null,
    scaledWidth = 0,
    scaledHeight = 0,
    minCoverage = 0.01,
    originalImageData = null
) {
    const { rows: refRows, cols: refCols } = refinementFactor;

    // 找出此区域(初始row/col)的所有 block
    const subBlocks = blocks.filter(b => b.initialRow === initialRow && b.initialCol === initialCol);

    // 删除旧块
    const indicesToRemove = subBlocks.map(sb => blocks.indexOf(sb)).filter(i => i >= 0);
    indicesToRemove.sort((x, y) => y - x);
    indicesToRemove.forEach(idx => blocks.splice(idx, 1));

    subBlocks.forEach(block => {
        // 若已经 skipRefine，就不再细分
        if (block.skipRefine) {
            block.level += 1;
            blocks.push(block);
            return;
        }

        // 细化
        const newW = block.width / refCols;
        const newH = block.height / refRows;
        for (let r = 0; r < refRows; r++) {
            for (let c = 0; c < refCols; c++) {
                const newBlock = {
                    row: block.row * refRows + r,
                    col: block.col * refCols + c,
                    x: block.x + c * newW,
                    y: block.y + r * newH,
                    width: newW,
                    height: newH,
                    initialRow,
                    initialCol,
                    level: block.level + 1,
                    skipRefine: false
                };
                if (integralData && scaledWidth > 0 && scaledHeight > 0) {
                    assignBlockAttributes(newBlock, integralData, scaledWidth, scaledHeight, minCoverage, originalImageData);
                }
                blocks.push(newBlock);
            }
        }
    });
}

/**
 * 随机细化 blocks
 */
export function refineRandomBlocks(
    blocks, 
    areaRefinementLevels, 
    refinementCount, 
    refinementFactor, 
    initialGridSize,
    integralData = null,
    scaledWidth = 0,
    scaledHeight = 0,
    minCoverage = 0.01,
    originalImageData = null
) {
    let needed = refinementCount;
    const { rows, cols } = initialGridSize;

    const allAreas = [];
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            allAreas.push({
                row: r, col: c,
                level: areaRefinementLevels[`${r},${c}`] || 0
            });
        }
    }

    // 按照细化等级升序
    allAreas.sort((u, v) => u.level - v.level);

    let idx = 0;
    while (needed > 0 && idx < allAreas.length) {
        const currLevel = allAreas[idx].level;
        const sameLevelGroup = allAreas.filter(a => a.level === currLevel);

        if (sameLevelGroup.length <= needed) {
            sameLevelGroup.forEach(a => {
                refineAreaBlocks(
                    blocks, 
                    a.row, 
                    a.col, 
                    refinementFactor, 
                    integralData, 
                    scaledWidth, 
                    scaledHeight,
                    minCoverage,
                    originalImageData
                );
                areaRefinementLevels[`${a.row},${a.col}`] = currLevel + 1;
            });
            needed -= sameLevelGroup.length;
            idx += sameLevelGroup.length;
        } else {
            for (let i = 0; i < needed; i++) {
                const randIdx = Math.floor(Math.random() * sameLevelGroup.length);
                const area = sameLevelGroup.splice(randIdx, 1)[0];
                refineAreaBlocks(
                    blocks, 
                    area.row, 
                    area.col, 
                    refinementFactor,
                    integralData,
                    scaledWidth,
                    scaledHeight,
                    minCoverage,
                    originalImageData
                );
                areaRefinementLevels[`${area.row},${area.col}`] = area.level + 1;
            }
            needed = 0;
        }
    }
}

/**
 * 根据当前 blocks，使用纯色填充绘制马赛克
 */
export function renderMosaic(ctx, blocks, integralData, scaledWidth, scaledHeight, gameLevel = 1) {
    ctx.clearRect(0, 0, scaledWidth, scaledHeight);
    
    blocks.forEach(block => {
        // 简单的纯色填充
        ctx.fillStyle = block.color;
        ctx.fillRect(block.x, block.y, block.width, block.height);
    });
}
