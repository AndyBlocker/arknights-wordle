// 高级颜色提取和处理算法
import { getCurrentConfig } from '../config/renderingConfig.js';

/**
 * 简化的颜色提取：加权平均 + 饱和度增强
 */
export function extractDominantColors(imageData, x1, y1, x2, y2) {
    try {
        if (!imageData || !imageData.data) {
            throw new Error('无效的图像数据');
        }
        
        const config = getCurrentConfig();
        const data = imageData.data;
        const width = imageData.width;
        const height = imageData.height;
        
        // 验证坐标范围
        if (x1 < 0 || y1 < 0 || x2 >= width || y2 >= height || x1 > x2 || y1 > y2) {
            console.warn('颜色提取坐标超出范围，使用默认颜色');
            return [[128, 128, 128]]; // 返回灰色
        }
        
        let totalR = 0, totalG = 0, totalB = 0;
        let weightSum = 0;
        let validPixels = 0;
        
        // 使用配置中的采样间隔（移动端友好）
        const samplingInterval = Math.max(1, config.PERFORMANCE.SAMPLING_INTERVAL || 3);
    
        for (let y = y1; y <= y2; y += samplingInterval) {
            for (let x = x1; x <= x2; x += samplingInterval) {
                if (x >= 0 && x < width && y >= 0 && y < height) {
                    const idx = (y * width + x) * 4;
                    const r = data[idx];
                    const g = data[idx + 1];
                    const b = data[idx + 2];
                    const alpha = data[idx + 3];
                    
                    if (alpha > 128) { // 只考虑不透明的像素
                        // 计算像素的"重要性"权重（饱和度高的像素权重更大）
                        const saturation = calculateSaturation(r, g, b);
                        const weight = 1 + saturation * 2; // 饱和度高的像素权重更大
                        
                        totalR += r * weight;
                        totalG += g * weight;
                        totalB += b * weight;
                        weightSum += weight;
                        validPixels++;
                    }
                }
            }
        }
        
        if (validPixels === 0 || weightSum === 0) {
            console.warn('未找到有效像素，使用默认颜色');
            return [[200, 200, 200]];
        }
        
        // 加权平均
        const avgR = Math.round(totalR / weightSum);
        const avgG = Math.round(totalG / weightSum);
        const avgB = Math.round(totalB / weightSum);
        
        // 轻微增强饱和度，让颜色更鲜明
        const boostFactor = config.COLOR_EXTRACTION.SATURATION_BOOST || 1.15;
        const enhanced = enhanceSaturation([avgR, avgG, avgB], boostFactor);
        
        return [enhanced];
    } catch (error) {
        console.error('颜色提取出错:', error);
        return [[150, 150, 150]]; // 回退到默认灰色
    }
}

/**
 * 快速计算HSL饱和度
 */
function calculateSaturation(r, g, b) {
    const max = Math.max(r, g, b) / 255;
    const min = Math.min(r, g, b) / 255;
    const diff = max - min;
    
    if (diff === 0) return 0;
    
    const lightness = (max + min) / 2;
    return lightness > 0.5 ? diff / (2 - max - min) : diff / (max + min);
}

/**
 * 简化的饱和度增强
 */
function enhanceSaturation(color, factor) {
    const [r, g, b] = color;
    
    // 找到最大和最小值
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    
    if (max === min) return color; // 灰色，无需调整
    
    // 简化的饱和度调整
    const center = (max + min) / 2;
    
    const newR = Math.round(Math.min(255, Math.max(0, center + (r - center) * factor)));
    const newG = Math.round(Math.min(255, Math.max(0, center + (g - center) * factor)));
    const newB = Math.round(Math.min(255, Math.max(0, center + (b - center) * factor)));
    
    return [newR, newG, newB];
}

// 简化版本：只保留核心的颜色提取功能