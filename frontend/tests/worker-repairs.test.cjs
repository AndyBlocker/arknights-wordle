const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function createManager({ failPost = false } = {}) {
  const workers = [];
  class Worker {
    constructor() { this.messages = []; workers.push(this); }
    postMessage(message) { if (failPost) { failPost = false; throw new Error('DataCloneError'); } this.messages.push(message); }
    terminate() { this.terminated = true; }
    success(result = {}) { this.onmessage({ data: { taskId: this.messages.at(-1).taskId, type: 'success', result } }); }
  }
  const code = fs.readFileSync(path.join(__dirname, '../src/utils/workerManager.js'), 'utf8')
    .replace(/\bexport /g, '').replaceAll('import.meta.url', "'file:///audit/workerManager.js'");
  const ctx = { Worker, URL, setTimeout, clearTimeout, console };
  vm.createContext(ctx);
  vm.runInContext(code + '\nglobalThis.manager=new WorkerManager();', ctx);
  return { manager: ctx.manager, workers };
}

test('cancelling active worker task settles it and starts the queued task on a new worker', async () => {
  const { manager, workers } = createManager();
  const first = manager.executeTask('integralImage', 'create', {});
  const rejection = assert.rejects(first, /cancelled/);
  const second = manager.executeTask('integralImage', 'create', {});
  const original = workers[0];
  manager.cancelTask(original.messages[0].taskId);
  await rejection;
  assert.equal(original.terminated, true);
  assert.equal(workers.length, 2);
  assert.equal(workers[1].messages.length, 1);
  original.success({ stale: true });
  assert.equal(manager.getStats().activeTasks, 1);
  workers[1].success({ good: true });
  assert.equal((await second).good, true);
  assert.equal(manager.getStats().activeTasks, 0);
  assert.equal(manager.getStats().queues.integralImage.busy, false);
  manager.cleanup();
});

test('worker message errors reject current work and recover pending work', async () => {
  const { manager, workers } = createManager();
  const first = manager.executeTask('integralImage', 'create', {});
  const rejection = assert.rejects(first, /Invalid worker message/);
  const second = manager.executeTask('integralImage', 'create', {});
  workers[0].onmessageerror();
  await rejection;
  workers[1].success({ recovered: true });
  assert.equal((await second).recovered, true);
  manager.cleanup();
});

test('queued cancellation never starts cancelled work and cleanup settles remaining tasks', async () => {
  const { manager, workers } = createManager();
  const first = manager.executeTask('integralImage', 'create', {});
  const second = manager.executeTask('integralImage', 'create', {});
  const cancelled = assert.rejects(second, /cancelled/);
  manager.cancelTask(2);
  await cancelled;
  workers[0].success({ done: true });
  assert.equal((await first).done, true);
  assert.equal(workers[0].messages.length, 1);
  const remaining = manager.executeTask('integralImage', 'create', {});
  const cleaned = assert.rejects(remaining, /cleanup/);
  manager.cleanup();
  await cleaned;
  assert.equal(manager.getStats().workers, 0);
});

test('unknown worker types and postMessage errors do not orphan promises or busy queues', async () => {
  const { manager, workers } = createManager({ failPost: true });
  await assert.rejects(manager.executeTask('bad', 'create', {}), /Unknown worker type/);
  await assert.rejects(manager.executeTask('integralImage', 'create', {}), /DataCloneError/);
  assert.equal(manager.getStats().activeTasks, 0);
  assert.equal(manager.getStats().queues.integralImage.busy, false);
  const next = manager.executeTask('integralImage', 'create', {});
  workers[0].success({ done: true });
  assert.equal((await next).done, true);
  manager.cleanup();
});

test('worker task deadline rejects hanging work and permits later tasks', async () => {
  const { manager, workers } = createManager();
  manager.taskTimeout = 10;
  await assert.rejects(manager.executeTask('integralImage', 'create', {}), /timed out/);
  assert.equal(workers[0].terminated, true);
  const next = manager.executeTask('integralImage', 'create', {});
  workers[1].success({ done: true });
  assert.equal((await next).done, true);
  manager.cleanup();
});

function imageCache() {
  const code = fs.readFileSync(path.join(__dirname, '../src/utils/imagePreloader.js'), 'utf8').replace(/\bexport /g, '');
  const ctx = { console, setTimeout, clearTimeout, process: { env: { NODE_ENV: 'production' } } };
  vm.createContext(ctx);
  vm.runInContext(code + '\nglobalThis.cache=new ImagePreloader();', ctx);
  return ctx.cache;
}

test('image cache replaces duplicate entries, evicts equal-time oldest entries and skips oversized images', () => {
  const cache = imageCache();
  cache.maxCacheSize = 1;
  cache.maxTotalSize = 500;
  cache.addToCache('one', { naturalWidth: 10, naturalHeight: 10 });
  cache.addToCache('one', { naturalWidth: 10, naturalHeight: 10 });
  assert.equal(cache.totalCacheSize, 400);
  cache.addToCache('two', { naturalWidth: 10, naturalHeight: 10 });
  assert.equal(cache.cache.size, 1);
  assert.equal(cache.cache.has('two'), true);
  cache.addToCache('huge', { naturalWidth: 100, naturalHeight: 100 });
  assert.equal(cache.cache.has('huge'), false);
  assert.equal(cache.totalCacheSize, 400);
});

test('cleared image cache is not repopulated by an obsolete in-flight load', async () => {
  const cache = imageCache();
  let resolve;
  cache.loadImageWithTimeout = () => new Promise(done => { resolve = done; });
  const pending = cache.preloadImage('one');
  cache.clearCache();
  resolve({ naturalWidth: 10, naturalHeight: 10 });
  await pending;
  assert.equal(cache.cache.size, 0);
  assert.equal(cache.totalCacheSize, 0);
});

test('AbortSignal cancels queued and running tasks without leaving a busy queue', async () => {
  const { manager, workers } = createManager();
  const firstController = new AbortController();
  const secondController = new AbortController();
  const first = manager.executeTask('integralImage', 'create', {}, 'normal', { signal: firstController.signal });
  const second = manager.executeTask('integralImage', 'create', {}, 'normal', { signal: secondController.signal });
  const rejectedFirst = assert.rejects(first, { name: 'AbortError' });
  const rejectedSecond = assert.rejects(second, { name: 'AbortError' });
  secondController.abort();
  firstController.abort();
  await Promise.all([rejectedFirst, rejectedSecond]);
  assert.equal(manager.getStats().activeTasks, 0);
  assert.equal(workers[0].terminated, true);
  const next = manager.executeTask('integralImage', 'create', {});
  workers[1].success({ done: true });
  assert.equal((await next).done, true);
  manager.cleanup();
});
