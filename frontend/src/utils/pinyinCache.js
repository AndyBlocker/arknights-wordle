// utils/pinyinCache.js
import { pinyin } from 'pinyin-pro';

class PinyinCache {
  constructor() {
    this.cache = new Map();
    this.maxSize = 1500; // 增加缓存大小以支持更多拼音变体
    this.multiPronunciationMap = new Map(); // 多音字映射
    this.initMultiPronunciationMap();
  }

  // 预处理文本，处理特殊字符
  preprocessText(text) {
    // 处理常见的特殊字符
    return text
      .replace(/·/g, '') // 移除中点符号
      .replace(/\u00B7/g, '') // 移除Unicode中点符号
      .replace(/\u2022/g, '') // 移除项目符号
      .replace(/\u2027/g, '') // 移除连字符点
      .replace(/\s+/g, '') // 移除多余空格
      .trim();
  }

  // 初始化常见多音字映射（明日方舟干员相关）
  initMultiPronunciationMap() {
    const commonMultiChar = {
      '夕': ['xi', 'ye'], // 夕(音译干员)
      '阿': ['a', 'e'], // 阿米娅等
      '白': ['bai', 'bo'], // 白雪
      '银': ['yin', 'gen'], // 银灰
      '重': ['zhong', 'chong'], // 重装干员
      '角': ['jiao', 'jue'], // 角峰
      '星': ['xing', 'sheng'], // 星极
      '苇': ['wei', 'lu'], // 苇草等
      '咔': ['ka', 'qia'], // 咔嚓等拟声词
      '哔': ['bi', 'bo'], // 哔哔等拟声词
      '茜': ['qian', 'xi'], // 茜茜等
      '薇': ['wei', 'vi'], // 薇薇安等
    };

    for (const [char, pronunciations] of Object.entries(commonMultiChar)) {
      this.multiPronunciationMap.set(char, pronunciations);
    }
  }

  generatePinyin(text) {
    if (this.cache.has(text)) {
      return this.cache.get(text);
    }

    try {
      // 预处理文本：处理特殊字符（如·）
      const cleanText = this.preprocessText(text);
      
      // 生成标准拼音
      const fullPinyin = pinyin(cleanText, { 
        toneType: 'none', 
        type: 'string',
        nonZh: 'consecutive' // 非中文字符保持连续
      }).toLowerCase().trim();
      
      const firstPinyin = pinyin(cleanText, { 
        pattern: 'first', 
        toneType: 'none', 
        type: 'string',
        nonZh: 'consecutive'
      }).toLowerCase().trim();

      // 生成多音字变体（使用清理后的文本）
      const variants = this.generatePronunciationVariants(cleanText);
      
      // 生成部分匹配模式
      const partialMatches = this.generatePartialMatches(fullPinyin, firstPinyin);

      const result = {
        full: fullPinyin,
        first: firstPinyin,
        variants: variants, // 多音字变体
        partials: partialMatches, // 部分匹配
        searchable: [
          fullPinyin,
          firstPinyin,
          ...variants.full,
          ...variants.first,
          ...partialMatches
        ].filter(Boolean).filter((item, index, arr) => arr.indexOf(item) === index) // 去重
      };

      // 控制缓存大小
      if (this.cache.size >= this.maxSize) {
        const firstKey = this.cache.keys().next().value;
        this.cache.delete(firstKey);
      }

      this.cache.set(text, result);
      return result;
    } catch (error) {
      console.warn(`生成拼音失败: ${text}`, error);
      // 返回基本结果
      return {
        full: text.toLowerCase(),
        first: text.charAt(0).toLowerCase(),
        variants: { full: [], first: [] },
        partials: [],
        searchable: [text.toLowerCase()]
      };
    }
  }

  // 生成多音字的所有可能发音组合
  generatePronunciationVariants(text) {
    const fullVariants = new Set();
    const firstVariants = new Set();

    // 检查每个字符是否有多种发音
    let hasMultiPronunciation = false;
    for (const char of text) {
      if (this.multiPronunciationMap.has(char)) {
        hasMultiPronunciation = true;
        break;
      }
    }

    if (!hasMultiPronunciation) {
      return { full: [], first: [] };
    }

    try {
      // 为每个可能的多音字组合生成拼音
      const multiPronunciationChars = Array.from(text).map(char => 
        this.multiPronunciationMap.get(char) || [char]
      );

      // 生成所有组合（限制组合数量以避免性能问题）
      const combinations = this.generateCombinations(multiPronunciationChars, 10);
      
      for (const combination of combinations) {
        const combinedText = combination.join('');
        try {
          const fullVariant = pinyin(combinedText, { 
            toneType: 'none', 
            type: 'string' 
          }).toLowerCase().trim();
          
          const firstVariant = pinyin(combinedText, { 
            pattern: 'first', 
            toneType: 'none', 
            type: 'string' 
          }).toLowerCase().trim();

          if (fullVariant) fullVariants.add(fullVariant);
          if (firstVariant) firstVariants.add(firstVariant);
        } catch (e) {
          // 忽略单个组合的错误
        }
      }
    } catch (error) {
      console.warn(`生成多音字变体失败: ${text}`, error);
    }

    return {
      full: Array.from(fullVariants),
      first: Array.from(firstVariants)
    };
  }

  // 生成有限数量的组合
  generateCombinations(arrays, maxCombinations = 10) {
    if (arrays.length === 0) return [[]];
    if (arrays.length === 1) return arrays[0].map(item => [item]);

    const result = [];
    const first = arrays[0];
    const rest = arrays.slice(1);
    const restCombinations = this.generateCombinations(rest, maxCombinations);

    for (const item of first) {
      for (const restComb of restCombinations) {
        result.push([item, ...restComb]);
        if (result.length >= maxCombinations) {
          return result;
        }
      }
    }

    return result;
  }

  // 生成部分匹配模式（支持不完整输入）
  generatePartialMatches(fullPinyin, firstPinyin) {
    const partials = new Set();
    
    // 添加全拼音的前缀匹配
    if (fullPinyin && fullPinyin.length > 2) {
      for (let i = 2; i <= fullPinyin.length; i++) {
        partials.add(fullPinyin.substring(0, i));
      }
    }

    // 添加首字母的前缀匹配
    if (firstPinyin && firstPinyin.length > 1) {
      for (let i = 1; i <= firstPinyin.length; i++) {
        partials.add(firstPinyin.substring(0, i));
      }
    }

    // 添加混合匹配（首字母+全拼音部分）
    if (fullPinyin && firstPinyin && fullPinyin !== firstPinyin) {
      const words = fullPinyin.split(/\s+/);
      if (words.length > 1) {
        // 第一个字的首字母 + 后续字的全拼音
        const mixed = firstPinyin.charAt(0) + words.slice(1).join('');
        if (mixed.length > 1) partials.add(mixed);
      }
    }

    return Array.from(partials);
  }

  // 改进的搜索匹配函数
  isMatch(searchTerm, pinyinData) {
    if (!searchTerm || !pinyinData) return false;
    
    const searchLower = searchTerm.toLowerCase().trim();
    if (!searchLower) return false;

    // 检查所有可搜索的拼音变体
    return pinyinData.searchable.some(variant => 
      variant && variant.includes(searchLower)
    );
  }

  generatePinyinMap(operators) {
    const map = {};
    const startTime = performance.now();
    let processedCount = 0;

    for (const op of operators) {
      if (this.isChinese(op.干员)) {
        map[op.干员] = this.generatePinyin(op.干员);
        processedCount++;
      }
    }

    const endTime = performance.now();
    console.log(`拼音映射生成完成: 处理 ${processedCount} 个干员，耗时: ${(endTime - startTime).toFixed(2)}ms`);
    
    return map;
  }

  isChinese(str) {
    return /[\u4e00-\u9fa5]/.test(str);
  }

  // 添加新的多音字映射
  addMultiPronunciation(char, pronunciations) {
    if (Array.isArray(pronunciations) && pronunciations.length > 0) {
      this.multiPronunciationMap.set(char, pronunciations);
      // 清除相关缓存
      for (const [key] of this.cache) {
        if (key.includes(char)) {
          this.cache.delete(key);
        }
      }
    }
  }

  clearCache() {
    this.cache.clear();
  }

  getCacheSize() {
    return this.cache.size;
  }

  getMultiPronunciationCount() {
    return this.multiPronunciationMap.size;
  }

  // 调试方法：显示某个文本的所有拼音信息
  debugPinyin(text) {
    const result = this.generatePinyin(text);
    console.log(`拼音调试信息 - ${text}:`, {
      全拼音: result.full,
      首字母: result.first,
      全拼音变体: result.variants.full,
      首字母变体: result.variants.first,
      部分匹配: result.partials,
      所有可搜索: result.searchable
    });
    return result;
  }
}

export const pinyinCache = new PinyinCache();