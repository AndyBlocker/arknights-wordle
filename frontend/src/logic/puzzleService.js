// src/logic/puzzleService.js
import { getImagePath } from '../utils/imageUtils';
import { imagePreloader } from '../utils/imagePreloader';
import { executeIntegralImageTask } from '../utils/workerManager';
import { 
    extractDominantColors
} from './advancedColorExtraction';
import { getCurrentConfig } from '../config/renderingConfig';

// 图像缓存
const imageCache = new Map();
const integralCache = new Map();

function addToCache(cache, key, value) {
  const config = getCurrentConfig();
  const maxSize = config.PERFORMANCE.MAX_CACHE_SIZE;
  
  if (cache.size >= maxSize) {
    const firstKey = cache.keys().next().value;
    cache.delete(firstKey);
  }
  cache.set(key, value);
}

/**
 * 生成可用的立绘文件名列表
 */
export function getAvailableArts(operator) {
    const arts = [];
    // 基本立绘
    arts.push(`立绘_${operator.干员}_1.png`);
    // 若星级 >= 3 则加立绘_2
    if ((operator.星级 || 0) >= 3) {
        arts.push(`立绘_${operator.干员}_2.png`);
    }
    // 皮肤 (1..10)
    for (let i = 1; i <= 10; i++) {
        const s = operator[`皮肤${i}名称`];
        if (s) {
            arts.push(`立绘_${operator.干员}_skin${i}.png`);
        }
    }
    return arts;
}

// 为每个干员存储选择的立绘，确保同一局游戏中一致性
const operatorArtCache = new Map();

/**
 * 从干员的可用立绘随机选择一张，但在同一局游戏中保持一致
 */
export function selectRandomArt(operator, gameSessionId = null) {
    const list = getAvailableArts(operator);
    if (!list || list.length === 0) {
        return '';
    }
    
    // 创建缓存键，结合干员名称和游戏会话ID
    const cacheKey = gameSessionId ? `${operator.干员}_${gameSessionId}` : operator.干员;
    
    // 检查缓存
    if (operatorArtCache.has(cacheKey)) {
        return operatorArtCache.get(cacheKey);
    }
    
    // 随机选择一张立绘
    const idx = Math.floor(Math.random() * list.length);
    const selectedArt = list[idx];
    
    // 缓存选择结果
    operatorArtCache.set(cacheKey, selectedArt);
    
    // 控制缓存大小
    if (operatorArtCache.size > 100) {
        const firstKey = operatorArtCache.keys().next().value;
        operatorArtCache.delete(firstKey);
    }
    
    return selectedArt;
}

/**
 * 清理指定游戏会话的缓存
 */
export function clearGameSessionCache(gameSessionId) {
    const keysToDelete = [];
    for (const key of operatorArtCache.keys()) {
        if (key.includes(`_${gameSessionId}`)) {
            keysToDelete.push(key);
        }
    }
    keysToDelete.forEach(key => operatorArtCache.delete(key));
}

/**
 * 清理所有缓存
 */
export function clearAllCache() {
    operatorArtCache.clear();
    imageCache.clear();
    integralCache.clear();
}

/**
 * 加载图片并生成积分图 (integral image) 数据，以便高效计算区域平均颜色。
 */
export async function loadPuzzleImage(operator, maxWidth = 600, maxHeight = 600, initialViewportWidth = 800, gameSessionId = null, customArtSelector = null) {
    const fileName = customArtSelector ? customArtSelector(operator, gameSessionId) : selectRandomArt(operator, gameSessionId);
    const puzzleImageUrl = getImagePath(fileName);
    const cacheKey = `${fileName}_${maxWidth}_${maxHeight}`;

    // 检查缓存
    if (integralCache.has(cacheKey)) {
        const cachedData = integralCache.get(cacheKey);
        console.log(`使用缓存的积分图: ${fileName}`);
        return {
            ...cachedData,
            puzzleImageUrl,
            selectedArt: fileName,
            operatorName: operator.干员
        };
    }

    try {
        console.log(`开始加载图片: ${puzzleImageUrl}`);
        
        // 使用预加载器加载图片，高优先级
        const img = await imagePreloader.preloadImage(puzzleImageUrl, 'high');
        
        const imgWidth = img.naturalWidth;
        const imgHeight = img.naturalHeight;
        console.log(`图片尺寸: ${imgWidth}x${imgHeight}`);

        // 计算缩放后的显示尺寸
        const { scaledW, scaledH } = calcScaledDimensions(imgWidth, imgHeight, maxWidth, maxHeight, initialViewportWidth);

        // 优化：根据设备性能调整处理尺寸
        const devicePixelRatio = window.devicePixelRatio || 1;
        const performanceLevel = getDevicePerformanceLevel();
        let shrinkLimit = 800;
        
        if (performanceLevel === 'low') {
            shrinkLimit = 400;
        } else if (performanceLevel === 'high') {
            shrinkLimit = 1200;
        }

        let finalWidth = imgWidth;
        let finalHeight = imgHeight;
        if (finalWidth > shrinkLimit || finalHeight > shrinkLimit) {
            const scale = shrinkLimit / Math.max(finalWidth, finalHeight);
            finalWidth = Math.floor(finalWidth * scale);
            finalHeight = Math.floor(finalHeight * scale);
        }

        console.log(`处理尺寸: ${finalWidth}x${finalHeight}`);

        // 使用OffscreenCanvas提高性能（如果支持）
        const canvas = createOptimizedCanvas(finalWidth, finalHeight);
        const ctx = canvas.getContext('2d');
        
        // 优化绘制设置
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'medium';
        
        ctx.drawImage(img, 0, 0, finalWidth, finalHeight);
        const imageData = ctx.getImageData(0, 0, finalWidth, finalHeight);

        console.log(`开始计算积分图...`);
        
        // 使用Web Worker计算积分图
        const integralData = await executeIntegralImageTask('createIntegralImage', {
            imageData: {
                width: imageData.width,
                height: imageData.height,
                data: imageData.data
            }
        }, 'high');

        console.log(`积分图计算完成`);

        const result = {
            imgWidth: finalWidth,
            imgHeight: finalHeight,
            scaledWidth: scaledW,
            scaledHeight: scaledH,
            integralData,
            originalImageData: imageData // 保存原始图像数据用于高级颜色提取
        };

        // 缓存结果
        addToCache(integralCache, cacheKey, result);

        return {
            ...result,
            puzzleImageUrl,
            selectedArt: fileName,
            operatorName: operator.干员
        };

    } catch (error) {
        console.error(`加载图片失败: ${puzzleImageUrl}`, error);
        throw new Error(`图片加载失败: ${error.message}`);
    }
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
function calcScaledDimensions(w, h, maxW, maxH, viewportWidth) {
    const containerWidth = Math.min(viewportWidth - 30, maxW);

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
            console.warn('高级颜色提取失败，回退到传统方法:', e.message);
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
