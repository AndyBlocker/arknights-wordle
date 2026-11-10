// One worker per task type, with explicit settlement of active and queued tasks.
export class WorkerManager {
  constructor() {
    this.workers = new Map();
    this.tasks = new Map();
    this.taskIdCounter = 0;
    this.taskTimeout = 30000;
  }

  getWorker(workerType) {
    if (!this.workers.has(workerType)) {
      const workerUrl = this.getWorkerUrl(workerType);
      if (!workerUrl) throw new Error(`Unknown worker type: ${workerType}`);
      const worker = new Worker(workerUrl);
      const current = () => this.workers.get(workerType)?.worker === worker;
      worker.onmessage = event => { if (current()) this.handleWorkerMessage(event, workerType); };
      worker.onerror = event => { if (current()) this.handleWorkerError(event, workerType); };
      worker.onmessageerror = () => {
        if (current()) this.handleWorkerError({ message: 'Invalid worker message' }, workerType);
      };
      this.workers.set(workerType, { worker, busy: false, tasks: [], currentTask: null });
    }
    return this.workers.get(workerType);
  }

  getWorkerUrl(workerType) {
    return workerType === 'integralImage'
      ? new URL('../workers/integralImageWorker.js', import.meta.url) : null;
  }

  executeTask(workerType, taskType, data, priority = 'normal', options = {}) {
    const id = ++this.taskIdCounter;
    return new Promise((resolve, reject) => {
      const signal = options.signal;
      const abortError = () => Object.assign(new Error('Task cancelled'), { name: 'AbortError' });
      if (signal?.aborted) { reject(abortError()); return; }
      const task = { id, workerType, type: taskType, data, priority, resolve, reject, timer: null, signal };
      task.abort = () => this.cancelTask(id, abortError());
      this.tasks.set(id, task);
      signal?.addEventListener('abort', task.abort, { once: true });
      try {
        this.scheduleTask(workerType, task);
      } catch (error) {
        this.settleTask(task, error);
      }
    });
  }

  settleTask(task, error = null, result = null) {
    clearTimeout(task.timer);
    task.signal?.removeEventListener('abort', task.abort);
    this.tasks.delete(task.id);
    if (error) task.reject(error);
    else task.resolve(result);
  }

  scheduleTask(workerType, task) {
    if (!this.tasks.has(task.id)) return;
    const info = this.getWorker(workerType);
    if (info.busy) {
      info.tasks.push(task);
      const order = { high: 3, normal: 2, low: 1 };
      info.tasks.sort((a, b) => (order[b.priority] || 2) - (order[a.priority] || 2));
    } else this.executeTaskOnWorker(info, task);
  }

  executeTaskOnWorker(info, task) {
    info.busy = true;
    info.currentTask = task.id;
    task.timer = setTimeout(() => this.cancelTask(task.id, 'Worker task timed out'), this.taskTimeout);
    try {
      info.worker.postMessage({ type: task.type, data: task.data, taskId: task.id });
    } catch (error) {
      this.settleTask(task, error);
      info.busy = false;
      info.currentTask = null;
      this.processNextTask(info);
    }
  }

  handleWorkerMessage(event, workerType) {
    const info = this.workers.get(workerType);
    const { type, taskId, result, error } = event.data || {};
    if (!info || info.currentTask !== taskId) return;
    const task = this.tasks.get(taskId);
    info.busy = false;
    info.currentTask = null;
    if (task) {
      this.settleTask(task, type === 'success' ? null : new Error(error?.message || 'Invalid worker response'), result);
    }
    this.processNextTask(info);
  }

  handleWorkerError(event, workerType) {
    const info = this.workers.get(workerType);
    if (!info) return;
    const task = this.tasks.get(info.currentTask);
    if (task) this.settleTask(task, new Error(event.message || 'Worker error'));
    this.recreateWorker(workerType);
  }

  processNextTask(info) {
    let next;
    while ((next = info.tasks.shift())) {
      if (this.tasks.has(next.id)) {
        this.executeTaskOnWorker(info, next);
        return;
      }
    }
  }

  recreateWorker(workerType) {
    const info = this.workers.get(workerType);
    if (!info) return;
    this.workers.delete(workerType);
    info.worker.terminate();
    const active = this.tasks.get(info.currentTask);
    if (active) this.settleTask(active, new Error('Worker restarted'));
    for (const task of info.tasks) {
      if (!this.tasks.has(task.id)) continue;
      try { this.scheduleTask(workerType, task); }
      catch (error) { this.settleTask(task, error); }
    }
  }

  cancelTask(taskId, message = 'Task cancelled') {
    const task = this.tasks.get(taskId);
    if (!task) return;
    this.settleTask(task, typeof message === 'string' ? new Error(message) : message);
    const info = this.workers.get(task.workerType);
    if (!info) return;
    if (info.currentTask === taskId) {
      // Terminate active work so a late result cannot leave the next task stuck.
      this.recreateWorker(task.workerType);
    } else info.tasks = info.tasks.filter(queued => queued.id !== taskId);
  }

  getStats() {
    return { workers: this.workers.size, activeTasks: this.tasks.size,
      queues: Object.fromEntries([...this.workers].map(([type, info]) => [type,
        { busy: info.busy, queueLength: info.tasks.length, currentTask: info.currentTask }])) };
  }

  cleanup() {
    for (const task of this.tasks.values()) this.settleTask(task, new Error('WorkerManager cleanup'));
    for (const info of this.workers.values()) info.worker.terminate();
    this.workers.clear();
  }
}

export const workerManager = new WorkerManager();
export const executeIntegralImageTask = (taskType, data, priority = 'normal', options = {}) =>
  workerManager.executeTask('integralImage', taskType, data, priority, options);
