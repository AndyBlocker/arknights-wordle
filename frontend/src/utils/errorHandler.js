// utils/errorHandler.js
import { ref, computed, readonly } from 'vue';

class ErrorHandler {
  constructor() {
    this.listeners = [];
  }

  addListener(callback) {
    this.listeners.push(callback);
  }

  removeListener(callback) {
    this.listeners = this.listeners.filter(l => l !== callback);
  }

  notify(error) {
    this.listeners.forEach(listener => {
      try {
        listener(error);
      } catch (e) {
        console.error('Error in error listener:', e);
      }
    });
  }

  handleError(error, context = '') {
    const errorInfo = {
      message: this.getErrorMessage(error),
      context,
      timestamp: new Date().toISOString(),
      type: this.getErrorType(error)
    };

    console.error(`[${context}] Error:`, error);
    this.notify(errorInfo);
    return errorInfo;
  }

  getErrorMessage(error) {
    if (typeof error === 'string') return error;
    if (error?.message) return error.message;
    if (error?.response?.data?.message) return error.response.data.message;
    if (error?.response?.statusText) return error.response.statusText;
    return '发生了未知错误';
  }

  getErrorType(error) {
    if (error?.name === 'TypeError') return 'network';
    if (error?.response?.status >= 400 && error?.response?.status < 500) return 'client';
    if (error?.response?.status >= 500) return 'server';
    if (error?.name === 'AbortError') return 'cancelled';
    return 'unknown';
  }

  getUserFriendlyMessage(error) {
    const type = this.getErrorType(error);
    switch (type) {
      case 'network':
        return '网络连接失败，请检查网络设置';
      case 'client':
        return '请求参数错误，请刷新页面重试';
      case 'server':
        return '服务器暂时不可用，请稍后重试';
      case 'cancelled':
        return '请求已取消';
      default:
        return this.getErrorMessage(error);
    }
  }
}

export const errorHandler = new ErrorHandler();

export function createErrorBoundary() {
  const error = ref(null);
  const isError = computed(() => !!error.value);

  const clearError = () => {
    error.value = null;
  };

  const handleError = (err, context = '') => {
    const errorInfo = errorHandler.handleError(err, context);
    error.value = errorInfo;
    return errorInfo;
  };

  return {
    error: readonly(error),
    isError,
    clearError,
    handleError
  };
}

export function withErrorHandling(asyncFn, context = '') {
  return async (...args) => {
    try {
      return await asyncFn(...args);
    } catch (error) {
      throw errorHandler.handleError(error, context);
    }
  };
}