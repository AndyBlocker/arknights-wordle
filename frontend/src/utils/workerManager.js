// utils/workerManager.js - Web Worker管理器

class WorkerManager {
  constructor() {
    this.workers = new Map();
    this.tasks = new Map();
    this.taskIdCounter = 0;
    this.maxWorkers = Math.min(4, navigator.hardwareConcurrency || 2);
  }

  /**
   * 获取或创建Worker
   */
  getWorker(workerType) {
    if (!this.workers.has(workerType)) {
      const workerUrl = this.getWorkerUrl(workerType);
      if (!workerUrl) {
        throw new Error(`Unknown worker type: ${workerType}`);
      }
      
      const worker = new Worker(workerUrl);
      worker.onmessage = (e) => this.handleWorkerMessage(e, workerType);
      worker.onerror = (e) => this.handleWorkerError(e, workerType);
      
      this.workers.set(workerType, {
        worker: worker,
        busy: false,
        tasks: []
      });
    }
    
    return this.workers.get(workerType);
  }

  /**
   * 获取Worker URL
   */
  getWorkerUrl(workerType) {
    const workerUrls = {
      'integralImage': new URL('../workers/integralImageWorker.js', import.meta.url)
    };
    
    return workerUrls[workerType];
  }

  /**
   * 执行任务
   */
  async executeTask(workerType, taskType, data, priority = 'normal') {
    const taskId = ++this.taskIdCounter;
    
    return new Promise((resolve, reject) => {
      const task = {
        id: taskId,
        type: taskType,
        data: data,
        priority: priority,
        resolve: resolve,
        reject: reject,
        timestamp: Date.now()
      };
      
      this.tasks.set(taskId, task);
      this.scheduleTask(workerType, task);
    });
  }

  /**
   * 调度任务
   */
  scheduleTask(workerType, task) {
    const workerInfo = this.getWorker(workerType);
    
    if (workerInfo.busy) {
      // Worker繁忙，加入队列
      this.addToQueue(workerInfo, task);
    } else {
      // Worker空闲，立即执行
      this.executeTaskOnWorker(workerInfo, task);
    }
  }

  /**
   * 在Worker上执行任务
   */
  executeTaskOnWorker(workerInfo, task) {
    workerInfo.busy = true;
    workerInfo.currentTask = task.id;
    
    workerInfo.worker.postMessage({
      type: task.type,
      data: task.data,
      taskId: task.id
    });
  }

  /**
   * 添加到队列
   */
  addToQueue(workerInfo, task) {
    workerInfo.tasks.push(task);
    
    // 按优先级排序
    workerInfo.tasks.sort((a, b) => {
      const priorityOrder = { 'high': 3, 'normal': 2, 'low': 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  /**
   * 处理Worker消息
   */
  handleWorkerMessage(e, workerType) {
    const { type, taskId, result, error } = e.data;
    const task = this.tasks.get(taskId);
    
    if (!task) {
      console.warn(`Received message for unknown task: ${taskId}`);
      return;
    }
    
    const workerInfo = this.workers.get(workerType);
    workerInfo.busy = false;
    workerInfo.currentTask = null;
    
    if (type === 'success') {
      task.resolve(result);
    } else if (type === 'error') {
      task.reject(new Error(error.message));
    }
    
    this.tasks.delete(taskId);
    
    // 处理队列中的下一个任务
    this.processNextTask(workerInfo);
  }

  /**
   * 处理Worker错误
   */
  handleWorkerError(e, workerType) {
    console.error(`Worker ${workerType} error:`, e);
    
    const workerInfo = this.workers.get(workerType);
    if (workerInfo && workerInfo.currentTask) {
      const task = this.tasks.get(workerInfo.currentTask);
      if (task) {
        task.reject(new Error(`Worker error: ${e.message || 'Unknown error'}`));
        this.tasks.delete(workerInfo.currentTask);
      }
    }
    
    // 重新创建Worker
    this.recreateWorker(workerType);
  }

  /**
   * 处理队列中的下一个任务
   */
  processNextTask(workerInfo) {
    if (workerInfo.tasks.length > 0) {
      const nextTask = workerInfo.tasks.shift();
      this.executeTaskOnWorker(workerInfo, nextTask);
    }
  }

  /**
   * 重新创建Worker
   */
  recreateWorker(workerType) {
    const workerInfo = this.workers.get(workerType);
    if (workerInfo) {
      workerInfo.worker.terminate();
      this.workers.delete(workerType);
      
      // 重新调度队列中的任务
      const pendingTasks = workerInfo.tasks;
      setTimeout(() => {
        pendingTasks.forEach(task => this.scheduleTask(workerType, task));
      }, 100);
    }
  }

  /**
   * 取消任务
   */
  cancelTask(taskId) {
    const task = this.tasks.get(taskId);
    if (task) {
      task.reject(new Error('Task cancelled'));
      this.tasks.delete(taskId);
      
      // 从队列中移除
      for (const workerInfo of this.workers.values()) {
        const index = workerInfo.tasks.findIndex(t => t.id === taskId);
        if (index >= 0) {
          workerInfo.tasks.splice(index, 1);
          break;
        }
      }
    }
  }

  /**
   * 获取统计信息
   */
  getStats() {
    const stats = {
      workers: this.workers.size,
      activeTasks: this.tasks.size,
      queues: {}
    };
    
    for (const [type, workerInfo] of this.workers.entries()) {
      stats.queues[type] = {
        busy: workerInfo.busy,
        queueLength: workerInfo.tasks.length,
        currentTask: workerInfo.currentTask
      };
    }
    
    return stats;
  }

  /**
   * 清理资源
   */
  cleanup() {
    // 取消所有待处理任务
    for (const task of this.tasks.values()) {
      task.reject(new Error('WorkerManager cleanup'));
    }
    this.tasks.clear();
    
    // 终止所有Worker
    for (const workerInfo of this.workers.values()) {
      workerInfo.worker.terminate();
    }
    this.workers.clear();
  }
}

// 单例实例
export const workerManager = new WorkerManager();

// 便捷方法
export const executeIntegralImageTask = (taskType, data, priority = 'normal') => {
  return workerManager.executeTask('integralImage', taskType, data, priority);
};