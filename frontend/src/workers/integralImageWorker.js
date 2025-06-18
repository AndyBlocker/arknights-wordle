// workers/integralImageWorker.js - 积分图计算Web Worker

/**
 * 生成积分图（包含 R/G/B/alphaCount 的前缀和）
 * 移到 Worker 中避免阻塞主线程
 */
function createIntegralImage(imageData) {
  const { width, height, data } = imageData;
  const totalPixels = width * height;

  // 使用更大的数据类型以避免溢出
  const sumR = new Uint32Array(totalPixels);
  const sumG = new Uint32Array(totalPixels);
  const sumB = new Uint32Array(totalPixels);
  const alphaCount = new Uint32Array(totalPixels);

  // 性能优化：预计算一些值
  const dataLength = data.length;

  for (let y = 0; y < height; y++) {
    let rowSumR = 0, rowSumG = 0, rowSumB = 0, rowAlphaCount = 0;
    
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const a = data[idx + 3];

      if (a > 0) {
        rowSumR += r;
        rowSumG += g;
        rowSumB += b;
        rowAlphaCount += 1;
      }

      const pixelIndex = y * width + x;
      const aboveIndex = (y - 1) * width + x;
      
      if (y > 0) {
        sumR[pixelIndex] = sumR[aboveIndex] + rowSumR;
        sumG[pixelIndex] = sumG[aboveIndex] + rowSumG;
        sumB[pixelIndex] = sumB[aboveIndex] + rowSumB;
        alphaCount[pixelIndex] = alphaCount[aboveIndex] + rowAlphaCount;
      } else {
        sumR[pixelIndex] = rowSumR;
        sumG[pixelIndex] = rowSumG;
        sumB[pixelIndex] = rowSumB;
        alphaCount[pixelIndex] = rowAlphaCount;
      }
    }
  }

  return {
    sumR: sumR,
    sumG: sumG,
    sumB: sumB,
    alphaCount: alphaCount,
    width: width,
    height: height
  };
}

/**
 * 批量处理多个区块的颜色计算
 */
function computeBlockColors(integralData, blocks, scaledWidth, scaledHeight, minCoverage = 0.01) {
  const results = [];
  
  for (const block of blocks) {
    // 计算覆盖率
    const coverage = calcBlockAlphaCoverage(integralData, block, scaledWidth, scaledHeight);
    const skipRefine = coverage < minCoverage;
    
    // 计算颜色
    const ratioX = integralData.width / scaledWidth;
    const ratioY = integralData.height / scaledHeight;
    const origX1 = Math.floor(block.x * ratioX);
    const origY1 = Math.floor(block.y * ratioY);
    const origX2 = Math.floor((block.x + block.width) * ratioX) - 1;
    const origY2 = Math.floor((block.y + block.height) * ratioY) - 1;
    
    const color = computeRegionAverage(integralData, origX1, origY1, origX2, origY2);
    
    results.push({
      index: block.originalIndex || results.length,
      color: color,
      skipRefine: skipRefine,
      coverage: coverage
    });
  }
  
  return results;
}

function getIntegralSums(integral, x2, y2) {
  if (x2 < 0 || y2 < 0 || x2 >= integral.width || y2 >= integral.height) {
    return { r: 0, g: 0, b: 0, a: 0 };
  }
  
  const idx = y2 * integral.width + x2;
  return {
    r: integral.sumR[idx],
    g: integral.sumG[idx],
    b: integral.sumB[idx],
    a: integral.alphaCount[idx]
  };
}

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
  
  if (alphaRatio < MIN_OPACITY_RATIO || a === 0) {
    return 'rgb(255,255,255)';
  }
  
  const R = Math.round(r / a);
  const G = Math.round(g / a);
  const B = Math.round(b / a);

  return `rgb(${R},${G},${B})`;
}

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

// Worker 事件处理
self.onmessage = function(e) {
  const { type, data, taskId } = e.data;
  
  try {
    let result;
    
    switch (type) {
      case 'createIntegralImage':
        result = createIntegralImage(data.imageData);
        break;
        
      case 'computeBlockColors':
        result = computeBlockColors(
          data.integralData,
          data.blocks,
          data.scaledWidth,
          data.scaledHeight,
          data.minCoverage
        );
        break;
        
      default:
        throw new Error(`Unknown task type: ${type}`);
    }
    
    self.postMessage({
      type: 'success',
      taskId: taskId,
      result: result
    });
    
  } catch (error) {
    self.postMessage({
      type: 'error',
      taskId: taskId,
      error: {
        message: error.message,
        stack: error.stack
      }
    });
  }
};