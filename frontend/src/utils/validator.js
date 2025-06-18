// utils/validator.js

/**
 * 输入验证和清理工具
 */

export class InputValidator {
  /**
   * 清理字符串输入
   * @param {string} input - 原始输入
   * @param {Object} options - 清理选项
   * @returns {string} - 清理后的字符串
   */
  static sanitizeString(input, options = {}) {
    if (typeof input !== 'string') {
      return '';
    }

    const {
      maxLength = 50,
      allowNumbers = true,
      allowChinese = true,
      allowEnglish = true,
      allowSpaces = true,
      allowSpecialChars = false,
      trim = true
    } = options;

    let result = input;

    // 基本清理
    if (trim) {
      result = result.trim();
    }

    // 长度限制
    if (result.length > maxLength) {
      result = result.substring(0, maxLength);
    }

    // 字符类型过滤
    let allowedPattern = '';
    
    if (allowChinese) {
      allowedPattern += '\\u4e00-\\u9fa5';
    }
    
    if (allowEnglish) {
      allowedPattern += 'a-zA-Z';
    }
    
    if (allowNumbers) {
      allowedPattern += '0-9';
    }
    
    if (allowSpaces) {
      allowedPattern += '\\s';
    }

    if (allowSpecialChars) {
      allowedPattern += '\\-_\\.';
    }

    if (allowedPattern) {
      const regex = new RegExp(`[^${allowedPattern}]`, 'g');
      result = result.replace(regex, '');
    }

    // 多个连续空格替换为单个空格
    if (allowSpaces) {
      result = result.replace(/\s+/g, ' ');
    }

    return result;
  }

  /**
   * 验证干员名称
   * @param {string} name - 干员名称
   * @returns {Object} - 验证结果
   */
  static validateOperatorName(name) {
    const sanitized = this.sanitizeString(name, {
      maxLength: 20,
      allowNumbers: true,
      allowChinese: true,
      allowEnglish: true,
      allowSpaces: true,
      allowSpecialChars: true
    });

    const errors = [];

    if (!sanitized) {
      errors.push('干员名称不能为空');
    }

    if (sanitized.length < 1) {
      errors.push('干员名称至少需要1个字符');
    }

    if (sanitized.length > 20) {
      errors.push('干员名称不能超过20个字符');
    }

    // 检查是否包含恶意脚本
    if (this.containsScript(sanitized)) {
      errors.push('干员名称包含非法字符');
    }

    return {
      isValid: errors.length === 0,
      sanitized,
      errors,
      original: name
    };
  }

  /**
   * 验证搜索关键词
   * @param {string} keyword - 搜索关键词
   * @returns {Object} - 验证结果
   */
  static validateSearchKeyword(keyword) {
    const sanitized = this.sanitizeString(keyword, {
      maxLength: 30,
      allowNumbers: true,
      allowChinese: true,
      allowEnglish: true,
      allowSpaces: true,
      allowSpecialChars: false
    });

    const errors = [];

    if (sanitized.length > 30) {
      errors.push('搜索关键词不能超过30个字符');
    }

    // 检查是否包含恶意脚本
    if (this.containsScript(sanitized)) {
      errors.push('搜索关键词包含非法字符');
    }

    return {
      isValid: errors.length === 0,
      sanitized,
      errors,
      original: keyword
    };
  }

  /**
   * 验证数字输入
   * @param {any} value - 输入值
   * @param {Object} options - 验证选项
   * @returns {Object} - 验证结果
   */
  static validateNumber(value, options = {}) {
    const {
      min = Number.MIN_SAFE_INTEGER,
      max = Number.MAX_SAFE_INTEGER,
      integer = false,
      positive = false
    } = options;

    const errors = [];
    let numValue = Number(value);

    if (isNaN(numValue)) {
      errors.push('必须是有效数字');
      numValue = 0;
    }

    if (integer && !Number.isInteger(numValue)) {
      errors.push('必须是整数');
      numValue = Math.floor(numValue);
    }

    if (positive && numValue < 0) {
      errors.push('必须是正数');
      numValue = Math.abs(numValue);
    }

    if (numValue < min) {
      errors.push(`不能小于 ${min}`);
      numValue = min;
    }

    if (numValue > max) {
      errors.push(`不能大于 ${max}`);
      numValue = max;
    }

    return {
      isValid: errors.length === 0,
      value: numValue,
      errors,
      original: value
    };
  }

  /**
   * 检查是否包含脚本代码
   * @param {string} input - 输入字符串
   * @returns {boolean} - 是否包含脚本
   */
  static containsScript(input) {
    const scriptPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /javascript:/gi,
      /vbscript:/gi,
      /on\w+\s*=/gi,
      /<iframe\b/gi,
      /<object\b/gi,
      /<embed\b/gi,
      /<link\b/gi,
      /<meta\b/gi
    ];

    return scriptPatterns.some(pattern => pattern.test(input));
  }

  /**
   * 批量验证对象的属性
   * @param {Object} data - 要验证的数据对象
   * @param {Object} rules - 验证规则
   * @returns {Object} - 验证结果
   */
  static validateObject(data, rules) {
    const result = {
      isValid: true,
      sanitized: {},
      errors: {},
      hasErrors: false
    };

    for (const [key, rule] of Object.entries(rules)) {
      const value = data[key];
      let validation;

      switch (rule.type) {
        case 'string':
          validation = this.validateString(value, rule.options || {});
          break;
        case 'number':
          validation = this.validateNumber(value, rule.options || {});
          break;
        case 'operatorName':
          validation = this.validateOperatorName(value);
          break;
        case 'searchKeyword':
          validation = this.validateSearchKeyword(value);
          break;
        default:
          validation = { isValid: true, sanitized: value, errors: [] };
      }

      result.sanitized[key] = validation.sanitized || validation.value || value;
      
      if (!validation.isValid) {
        result.isValid = false;
        result.hasErrors = true;
        result.errors[key] = validation.errors;
      }
    }

    return result;
  }

  /**
   * 验证字符串（通用）
   * @param {string} value - 字符串值
   * @param {Object} options - 验证选项
   * @returns {Object} - 验证结果
   */
  static validateString(value, options = {}) {
    const sanitized = this.sanitizeString(value, options);
    const errors = [];

    if (options.required && !sanitized) {
      errors.push('此字段为必填项');
    }

    if (options.minLength && sanitized.length < options.minLength) {
      errors.push(`至少需要 ${options.minLength} 个字符`);
    }

    if (options.maxLength && sanitized.length > options.maxLength) {
      errors.push(`不能超过 ${options.maxLength} 个字符`);
    }

    if (this.containsScript(sanitized)) {
      errors.push('包含非法字符');
    }

    return {
      isValid: errors.length === 0,
      sanitized,
      errors,
      original: value
    };
  }
}

// 防抖函数，用于输入验证
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// 创建验证装饰器
export function createValidationDecorator(validator, errorHandler) {
  return function(target, key, descriptor) {
    const originalMethod = descriptor.value;
    descriptor.value = function(...args) {
      try {
        // 验证输入参数
        const validation = validator(...args);
        if (!validation.isValid) {
          errorHandler(validation.errors);
          return null;
        }
        
        // 使用清理后的参数调用原始方法
        return originalMethod.apply(this, validation.sanitized || args);
      } catch (error) {
        errorHandler(['方法执行失败']);
        console.error('Validation decorator error:', error);
        return null;
      }
    };
    return descriptor;
  };
}