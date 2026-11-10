// src/utils/dataLoader.js
import { errorHandler } from './errorHandler.js';

/**
 * 从本地JSON文件加载干员数据
 * @param {string} filePath - JSON文件路径
 * @returns {Promise<Array>} - 干员数据数组
 */
export async function loadOperatorsData(filePath = './data/operators.json') {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, 10000); // 10秒超时

  try {
    const response = await fetch(filePath, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'Cache-Control': 'no-cache'
      }
    });

    if (!response.ok) {
      const errorMessage = response.status === 404 
        ? '干员数据文件未找到，请检查文件路径'
        : `加载干员数据失败，状态码: ${response.status}`;
      throw new Error(errorMessage);
    }

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      throw new Error('干员数据文件格式错误，期望JSON格式');
    }

    const data = await response.json();
    
    if (!Array.isArray(data)) {
      throw new Error('干员数据格式错误，期望数组格式');
    }

    if (data.length === 0) {
      throw new Error('干员数据为空');
    }

    const names = new Set();
    for (const operator of data) {
      if (!operator || typeof operator.干员 !== 'string' || !operator.干员.trim() ||
          !/^[0-5]$/.test(String(operator.稀有度)) || typeof operator.职业 !== 'string') {
        throw new Error('干员数据结构错误，缺少必要字段');
      }
      if (names.has(operator.干员)) {
        throw new Error('干员数据存在重复记录');
      }
      names.add(operator.干员);
    }

    return data;
  } catch (error) {
    if (error.name === 'AbortError') {
      const timeoutError = new Error('加载干员数据超时，请检查网络连接');
      errorHandler.handleError(timeoutError, 'dataLoader');
      throw timeoutError;
    }

    errorHandler.handleError(error, 'dataLoader');
    throw error;
  } finally {
    // fetch only resolves the headers; keep the deadline through body parsing.
    clearTimeout(timeoutId);
  }
}

/**
 * 从字符串生成干员拼音首字母索引 (可选)
 * 不改也行
 */
export function generatePinyinIndex(operators) {
  return {};
}

/**
 * 根据条件过滤干员数据 (可选)
 */
export function filterOperators(operators, filters) {
  // ...
  return operators;
}

/**
 * 创建自定义标签组合 (可选)
 */
export function createTagGroup(id, name, description, tags) {
  return {
    id, name, description, tags
  };
}
