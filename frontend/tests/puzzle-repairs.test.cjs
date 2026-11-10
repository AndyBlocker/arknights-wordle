const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const source = name => fs.readFileSync(path.join(__dirname, '../src/', name), 'utf8');
const stripImports = value => value.replace(/^import[\s\S]*?from\s+['"][^'"]+['"];\s*/gm, '');

function service({ failed = [], budget = 48 * 1024 * 1024 } = {}) {
  const requests = [];
  let computations = 0;
  class Canvas {
    constructor(width, height) { this.width = width; this.height = height; }
    getContext() { return { drawImage() {}, getImageData: () => ({ width: this.width, height: this.height, data: new Uint8ClampedArray(this.width * this.height * 4) }) }; }
  }
  const ctx = {
    Uint8ClampedArray, process: { env: { NODE_ENV: 'production' } }, console,
    navigator: { deviceMemory: 8, hardwareConcurrency: 8 },
    window: { OffscreenCanvas: Canvas }, OffscreenCanvas: Canvas,
    getImagePath: file => file,
    imagePreloader: { preloadImage: async file => {
      requests.push(file);
      if (failed.includes(file)) throw new Error('404');
      return { naturalWidth: 600, naturalHeight: 600 };
    } },
    executeIntegralImageTask: async (_type, { imageData }) => {
      computations++;
      const length = imageData.width * imageData.height;
      return { width: imageData.width, height: imageData.height, sumR: new Uint32Array(length), sumG: new Uint32Array(length), sumB: new Uint32Array(length), alphaCount: new Uint32Array(length) };
    },
    getCurrentConfig: () => ({ PERFORMANCE: { MAX_CACHE_SIZE: 15, MAX_CACHE_BYTES: budget }, COLOR_EXTRACTION: { ENABLE_ADVANCED_EXTRACTION: false } }),
    extractDominantColors: () => [],
  };
  vm.createContext(ctx);
  vm.runInContext(stripImports(source('logic/puzzleService.js')).replace(/\bexport /g, '') + '\nglobalThis.api={getAvailableArts,selectRandomArt,loadPuzzleImage,getPuzzleCacheStats,clearAllCache,withPuzzleDisplaySize};', ctx);
  return { ...ctx.api, requests, computations: () => computations };
}

test('three-star arts never advertise an elite-2 file', () => {
  const api = service();
  const rows = JSON.parse(fs.readFileSync(path.join(__dirname, '../public/data/operators.json')));
  const threeStars = rows.filter(row => row.稀有度 === '2');
  assert.ok(threeStars.length >= 17);
  for (const row of threeStars) assert.equal(api.getAvailableArts(row).includes(`立绘_${row.干员}_2.png`), false);
  assert.equal(api.getAvailableArts({ 干员: '调香师', 稀有度: '3' }).includes('立绘_调香师_2.png'), true);
});

test('missing selected art falls back to the same operator base and remains stable for that session', async () => {
  const api = service({ failed: ['立绘_芬_skin1.png'] });
  const operator = { 干员: '芬', 星级: 3, 皮肤1名称: '皮肤' };
  const first = await api.loadPuzzleImage(operator, 600, 600, 1440, 'one', () => '立绘_芬_skin1.png');
  assert.equal(first.selectedArt, '立绘_芬_1.png');
  assert.equal(first.operatorName, '芬');
  assert.equal(first.gameSessionId, 'one');
  const second = await api.loadPuzzleImage(operator, 600, 600, 390, 'one', () => '立绘_芬_skin1.png');
  assert.equal(second.selectedArt, first.selectedArt);
  assert.equal(first.scaledWidth, 600);
  assert.equal(second.scaledWidth, 360);
  assert.equal(second.scaledHeight, 360);
  assert.equal(api.computations(), 1);
  assert.deepEqual(api.requests, ['立绘_芬_skin1.png', '立绘_芬_1.png']);
});

test('all failed candidates reject without silently picking a different operator', async () => {
  const api = service({ failed: ['立绘_芬_1.png'] });
  await assert.rejects(api.loadPuzzleImage({ 干员: '芬', 星级: 3 }, 600, 600, 390, 'one', () => '立绘_芬_1.png'), /立绘加载失败/);
  assert.deepEqual(api.requests, ['立绘_芬_1.png']);
});

test('integral cache obeys a byte budget rather than keeping fifteen large images', async () => {
  const api = service({ budget: 10 * 1024 * 1024 });
  for (const name of ['芬', '香草', '翎羽']) await api.loadPuzzleImage({ 干员: name, 星级: 3 }, 600, 600, 390, name, op => `立绘_${op.干员}_1.png`);
  assert.equal(api.getPuzzleCacheStats().entries, 1);
  assert.ok(api.getPuzzleCacheStats().bytes <= 10 * 1024 * 1024);
  api.clearAllCache();
  assert.equal(api.getPuzzleCacheStats().bytes, 0);
});

function board({ load, onReset = true, refine, paint, realRefs = false } = {}) {
  const watchers = [], mounts = [], unmounts = [], listeners = {}, events = [], renders = [];
  const ref = value => ({ value });
  const refs = realRefs ? require('vue') : { ref, shallowRef: ref };
  const operator = { 干员: '芬', 星级: 3, 出身地: '卡西米尔', 国家: '维多利亚' };
  const props = { operators: [operator], targetOperator: operator, gameSessionId: 'one',
    maxGuesses: 6, guesses: [], gameOver: false, gameWon: false, userGaveUp: false,
    initialGridSize: { rows: 4, cols: 4 }, refinementCount: 9,
    refinementFactor: { rows: 2, cols: 2 }, puzzleHintInterval: 3,
    customHints: null, customArtSelector: null, preloadedAssets: null };
  const pixels = { imgWidth: 600, imgHeight: 600, integralData: { width: 600, height: 600 }, originalImageData: { data: new Uint8ClampedArray(4) } };
  let calls = 0, initialized = 0;
  const result = () => ({ ...pixels, operatorName: props.targetOperator.干员, gameSessionId: props.gameSessionId, selectedArt: '立绘_芬_1.png', puzzleImageUrl: 'image' });
  const api = service();
  const ctx = { module: { exports: {} }, ref: refs.ref, shallowRef: refs.shallowRef,
    computed: getter => ({ get value() { return getter(); } }),
    getCurrentInstance: () => ({ vnode: { props: onReset ? { onReset() {} } : {} } }),
    watch: (getter, callback, options) => watchers.push({ getter, callback, options }),
    onMounted: callback => mounts.push(callback), onBeforeUnmount: callback => unmounts.push(callback),
    nextTick: callback => Promise.resolve().then(() => callback?.()),
    window: { innerWidth: 1440, addEventListener: (name, callback) => { listeners[name] = callback; }, removeEventListener: name => delete listeners[name] },
    setTimeout, clearTimeout, console, AbortController,
    getOperatorAvatarFile: () => '', getImagePath: file => file,
    loadPuzzleImage: async (...args) => { calls++; return load ? load(...args) : result(); },
    withPuzzleDisplaySize: api.withPuzzleDisplaySize,
    initBlocks: () => { initialized++; return [{ x: 0, y: 0, width: 600, height: 600, level: 1, color: 'rgb(0,0,0)' }]; },
    refineRandomBlocksAsync: refine || (async (blocks, levels) => ({
      blocks: blocks.map(block => ({ ...block, level: block.level + 1 })),
      areaRefinementLevels: { ...levels }
    })),
    renderMosaicAsync: async (...args) => {
      renders.push(args[1].map(block => ({ ...block })));
      if (paint) await paint(...args);
    },
  };
  vm.createContext(ctx);
  const script = source('components/PuzzleBoard.vue').match(/<script>([\s\S]*?)<\/script>/)[1];
  vm.runInContext(stripImports(script).replace('export default', 'module.exports ='), ctx);
  const state = ctx.module.exports.setup(props, { emit: (...args) => events.push(args) });
  state.boardElement.value = { clientWidth: 600 };
  state.mosaicCanvas.value = { getContext: () => ({}) };
  const start = async () => { for (const watcher of watchers.filter(w => w.options?.immediate)) await watcher.callback(watcher.getter()); mounts.forEach(callback => callback()); };
  return { props, state, start, watchers, events, listeners, renders, result, calls: () => calls,
    initialized: () => initialized, resize: async width => { ctx.window.innerWidth = width; state.boardElement.value.clientWidth = width - 30; listeners.resize(); await new Promise(resolve => setTimeout(resolve, 130)); },
    close: () => unmounts.forEach(callback => callback()) };
}

test('canvas geometry is not wrapped in Vue deep reactive proxies', async () => {
  let checked = false;
  const game = board({ realRefs: true, refine: async (blocks, levels) => {
    const { isReactive } = require('vue');
    assert.equal(isReactive(blocks), false);
    assert.equal(isReactive(blocks[0]), false);
    assert.equal(isReactive(levels), false);
    checked = true;
    return { blocks: blocks.map(block => ({ ...block, level: block.level + 1 })), areaRefinementLevels: { ...levels } };
  } });
  await game.start();
  game.props.guesses.push({ 干员: '香草' });
  const watcher = game.watchers.find(w => !w.options && typeof w.getter() === 'number');
  await watcher.callback(1, 0);
  assert.ok(checked);
  assert.equal(game.state.isRefining.value, false);
  assert.equal(game.events.at(-1)[1], 'ready');
  game.close();
});

test('a late refinement cannot overwrite the new session or keep its input busy', async () => {
  let resolveOld, oldSignal;
  const game = board({ refine: (...args) => {
    oldSignal = args.at(-1).signal;
    return new Promise(resolve => { resolveOld = resolve; });
  } });
  await game.start();
  game.props.guesses.push({ 干员: '香草' });
  const guesses = game.watchers.find(w => !w.options && typeof w.getter() === 'number');
  const pending = guesses.callback(1, 0);
  assert.equal(game.state.isRefining.value, true);
  game.props.gameSessionId = 'new-session';
  const target = game.watchers.find(w => w.options?.immediate);
  await target.callback(target.getter());
  assert.equal(oldSignal.aborted, true);
  resolveOld({ blocks: [{ level: 99 }], areaRefinementLevels: {} });
  await pending;
  assert.equal(game.renders.at(-1)[0].level, 1);
  assert.equal(game.state.isRefining.value, false);
  assert.equal(game.events.at(-1)[1], 'ready');
  game.close();
});

test('a resize arriving during staged painting is completed before the input becomes ready', async () => {
  let releasePaint, paintStarted;
  const started = new Promise(resolve => { paintStarted = resolve; });
  let calls = 0;
  const game = board({ paint: async () => {
    if (++calls === 2) {
      paintStarted();
      await new Promise(resolve => { releasePaint = resolve; });
    }
  } });
  await game.start();
  game.props.guesses.push({ 干员: '香草' });
  const guesses = game.watchers.find(w => !w.options && typeof w.getter() === 'number');
  const pending = guesses.callback(1, 0);
  await started;
  await game.resize(390);
  assert.equal(game.state.isRefining.value, true);
  assert.equal(game.state.scaledWidth.value, 600);
  releasePaint();
  await pending;
  assert.equal(calls, 3);
  assert.equal(game.state.scaledWidth.value, 360);
  assert.equal(game.renders.at(-1)[0].width, 360);
  assert.equal(game.state.isRefining.value, false);
  assert.equal(game.events.at(-1)[1], 'ready');
  game.close();
});

test('board error remains visible and the actual retry transitions to ready', async () => {
  let ready = false;
  const game = board({ load: async () => { if (!ready) throw new Error('立绘加载失败'); return game.result(); } });
  await game.start();
  assert.equal(game.state.loadingImage.value, false);
  assert.match(game.state.loadError.value, /失败/);
  assert.ok(source('components/PuzzleBoard.vue').includes('v-if="loadError"'));
  ready = true;
  await game.state.handleRetry();
  assert.equal(game.state.loadError.value, '');
  assert.equal(game.events.at(-1)[1], 'ready');
  game.close();
});

test('prepared assets are used once and a new session with the same target resets blocks', async () => {
  const game = board();
  game.props.preloadedAssets = game.result();
  await game.start();
  assert.equal(game.calls(), 0);
  assert.equal(game.initialized(), 1);
  game.props.gameSessionId = 'two';
  const watcher = game.watchers.find(w => w.options?.immediate);
  await watcher.callback(watcher.getter());
  assert.equal(game.calls(), 1);
  assert.equal(game.initialized(), 2);
  game.close();
});

test('resize preserves revealed partition levels and corrects display aspect ratio', async () => {
  const game = board();
  await game.start();
  game.props.guesses.push({ 干员: '香草' });
  const watcher = game.watchers.find(w => !w.options && typeof w.getter() === 'number');
  await watcher.callback(1, 0);
  await game.resize(390);
  assert.equal(game.state.scaledWidth.value, 360);
  assert.equal(game.state.scaledHeight.value, 360);
  assert.equal(game.renders.at(-1)[0].level, 2);
  assert.equal(game.renders.at(-1)[0].width, 360);
  assert.equal(game.calls(), 1);
  const hint = game.state.puzzleHints.value.find(value => value.label === '出生地');
  assert.equal(hint.value(), '卡西米尔');
  game.close();
});

test('aborting an obsolete image load skips both fallback and integral work', async () => {
  const api = service();
  const controller = new AbortController();
  const pending = api.loadPuzzleImage({ 干员: '芬', 星级: 3 }, 600, 600, 390, 'old', null, controller.signal);
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(api.computations(), 0);
  assert.equal(api.requests.length, 1);
  assert.equal(api.getPuzzleCacheStats().entries, 0);
});

test('starting a new session aborts the old request and ignores its late result', async () => {
  let completeOld;
  let oldSignal;
  let calls = 0;
  const game = board({ load: async (...args) => {
    calls++;
    if (calls === 1) {
      oldSignal = args[6];
      return new Promise(resolve => { completeOld = resolve; });
    }
    return game.result();
  } });
  const first = game.start();
  game.props.gameSessionId = 'two';
  const watcher = game.watchers.find(w => w.options?.immediate);
  await watcher.callback(watcher.getter());
  assert.equal(oldSignal.aborted, true);
  assert.equal(game.state.loadError.value, '');
  completeOld({ ...game.result(), gameSessionId: 'one', puzzleImageUrl: 'old-image' });
  await first;
  assert.equal(game.state.puzzleImageUrl.value, 'image');
  assert.equal(game.initialized(), 1);
  game.close();
});


test('only boards with a reset listener expose restart controls', async () => {
  const challenge = board({ onReset: false });
  await challenge.start();
  assert.equal(challenge.state.canReset, false);
  const standalone = board();
  await standalone.start();
  assert.equal(standalone.state.canReset, true);
  challenge.close();
  standalone.close();
});
