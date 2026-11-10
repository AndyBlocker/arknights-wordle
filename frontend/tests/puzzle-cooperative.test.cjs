const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.join(__dirname, '../..');
const strip = source => source.replace(/^import[\s\S]*?from\s+['"][^'"]+['"];\s*/gm, '').replace(/\bexport /g, '');
const config = {
  COLOR_EXTRACTION: { ENABLE_ADVANCED_EXTRACTION: true, MAX_LEVEL_FOR_ADVANCED: 3, SATURATION_BOOST: 1.2 },
  PERFORMANCE: { SAMPLING_INTERVAL: 2, MAX_CACHE_SIZE: 15, MAX_CACHE_BYTES: 48 * 1024 * 1024 },
};
function api(old = false) {
  let seed = 17;
  const math = Object.create(Math);
  math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const context = { Math: math, getCurrentConfig: () => config, process: { env: { NODE_ENV: 'production' } },
    console: { warn() {}, error() {} }, setTimeout, AbortController };
  vm.createContext(context);
  const base = old ? path.join(root, 'docs/puzzle-performance-2026-11-10/benchmark-before-sources') : path.join(root, 'frontend/src/logic');
  vm.runInContext(strip(fs.readFileSync(path.join(base, 'advancedColorExtraction.js'), 'utf8')), context);
  vm.runInContext(strip(fs.readFileSync(path.join(base, 'puzzleService.js'), 'utf8')), context);
  const functions = old ? 'initBlocks,refineRandomBlocks,renderMosaic' : 'initBlocks,refineRandomBlocks,refineRandomBlocksAsync,renderMosaic,renderMosaicAsync';
  return { ...vm.runInContext(`({${functions}})`, context), math };
}
function fixture() {
  const width = 96, height = 64;
  const image = { width, height, data: new Uint8ClampedArray(width * height * 4) };
  const integral = { width, height, sumR: new Uint32Array(width * height), sumG: new Uint32Array(width * height), sumB: new Uint32Array(width * height), alphaCount: new Uint32Array(width * height) };
  for (let y = 0; y < height; y++) {
    let r = 0, g = 0, b = 0, a = 0;
    for (let x = 0; x < width; x++) {
      const index = y * width + x, pixel = index * 4;
      image.data[pixel] = (x * 7) % 256; image.data[pixel + 1] = (y * 9) % 256; image.data[pixel + 2] = (x + y) % 256;
      image.data[pixel + 3] = x > 20 && x < 76 && y > 10 && y < 54 ? 255 : 0;
      if (image.data[pixel + 3]) { r += image.data[pixel]; g += image.data[pixel + 1]; b += image.data[pixel + 2]; a++; }
      const above = index - width;
      integral.sumR[index] = r + (y ? integral.sumR[above] : 0);
      integral.sumG[index] = g + (y ? integral.sumG[above] : 0);
      integral.sumB[index] = b + (y ? integral.sumB[above] : 0);
      integral.alphaCount[index] = a + (y ? integral.alphaCount[above] : 0);
    }
  }
  return { image, integral };
}
const stateText = (blocks, levels) => JSON.stringify({ blocks, levels });

test('original sync, shared sync and cooperative async preserve every block/color/order/area level', async () => {
  const original = api(true), synchronous = api(), cooperative = api();
  const { image, integral } = fixture();
  const grid = { rows: 4, cols: 4 }, factor = { rows: 2, cols: 2 };
  const first = original.initBlocks(600, 400, grid, integral, 0.01, image);
  const second = synchronous.initBlocks(600, 400, grid, integral, 0.01, image);
  let third = cooperative.initBlocks(600, 400, grid, integral, 0.01, image);
  const firstLevels = {}, secondLevels = {}; let thirdLevels = {};
  let ticks = 0, yields = 0;
  for (let guess = 0; guess < 7; guess++) {
    original.refineRandomBlocks(first, firstLevels, 9, factor, grid, integral, 600, 400, 0.01, image);
    synchronous.refineRandomBlocks(second, secondLevels, 9, factor, grid, integral, 600, 400, 0.01, image);
    const snapshot = stateText(third, thirdLevels);
    const next = await cooperative.refineRandomBlocksAsync(third, thirdLevels, 9, factor, grid, integral, 600, 400, 0.01, image,
      { budgetMs: 1, now: () => ++ticks, yieldToMain: async () => { yields++; } });
    assert.equal(stateText(third, thirdLevels), snapshot, 'inputs remain visible and unchanged until caller commits');
    third = next.blocks; thirdLevels = next.areaRefinementLevels;
    assert.equal(stateText(second, secondLevels), stateText(first, firstLevels));
    assert.equal(stateText(third, thirdLevels), stateText(first, firstLevels));
  }
  assert.ok(yields > 0, 'deterministic clock exercises cooperative yield boundaries');
});

test('all random area selection happens before yielding to unrelated UI randomness', async () => {
  const before = api(true), after = api(); const { image, integral } = fixture();
  const grid = { rows: 4, cols: 4 }, factor = { rows: 2, cols: 2 };
  const one = before.initBlocks(600, 400, grid, integral, 0.01, image);
  const two = after.initBlocks(600, 400, grid, integral, 0.01, image);
  const levels = {}; let ticks = 0;
  before.refineRandomBlocks(one, levels, 9, factor, grid, integral, 600, 400, 0.01, image);
  const next = await after.refineRandomBlocksAsync(two, {}, 9, factor, grid, integral, 600, 400, 0.01, image,
    { budgetMs: 1, now: () => ++ticks, yieldToMain: async () => { after.math.random(); } });
  assert.equal(stateText(next.blocks, next.areaRefinementLevels), stateText(one, levels));
});

test('cancelling a partially computed draft leaves retained skipRefine objects and levels untouched', async () => {
  const service = api(); const controller = new AbortController();
  const blocks = Array.from({ length: 500 }, (_, index) => ({ row: index, col: 0, x: index, y: 0, width: 1, height: 1,
    initialRow: 0, initialCol: 0, level: 1, skipRefine: true, color: 'rgb(1,2,3)' }));
  const levels = {}, snapshot = stateText(blocks, levels); let ticks = 0, yields = 0;
  await assert.rejects(service.refineRandomBlocksAsync(blocks, levels, 1, { rows: 2, cols: 2 }, { rows: 1, cols: 1 }, null, 600, 600, 0.01, null,
    { signal: controller.signal, budgetMs: 1, now: () => ++ticks, yieldToMain: async () => { if (++yields === 2) controller.abort(); } }), { name: 'AbortError' });
  assert.equal(yields, 2);
  assert.equal(stateText(blocks, levels), snapshot);
});

function canvasRecorder() {
  const fills = []; let color;
  return { fills, clearRect() {}, set fillStyle(value) { color = value; }, fillRect(...rect) { fills.push([color, ...rect]); } };
}
function paintBlocks() {
  return Array.from({ length: 2048 }, (_, index) => ({ x: index % 600, y: index % 400, width: 1.5, height: 2.5, color: `rgb(${index % 256},2,3)` }));
}

test('cooperative painting keeps the original color and draw order and commits only one completed frame', async () => {
  const service = api(), blocks = paintBlocks(), sync = canvasRecorder(), staging = canvasRecorder();
  service.renderMosaic(sync, blocks, null, 600, 400);
  const commits = []; let ticks = 0, yields = 0;
  const visible = { clearRect: () => commits.push('clear'), drawImage: () => commits.push('frame') };
  const result = await service.renderMosaicAsync(visible, blocks, null, 600, 400, 1, {
    createCanvas: () => ({ getContext: () => staging }), budgetMs: 1, now: () => ++ticks,
    yieldToMain: async () => { yields++; assert.equal(commits.length, 0); },
  });
  assert.ok(yields > 0); assert.equal(result.renderedBlocks, blocks.length);
  assert.deepEqual(staging.fills, sync.fills); assert.deepEqual(commits, ['clear', 'frame']);
});

test('cancelling a staged paint never clears or replaces the visible frame', async () => {
  const service = api(), controller = new AbortController(), commits = []; let ticks = 0;
  await assert.rejects(service.renderMosaicAsync({ clearRect: () => commits.push('clear'), drawImage: () => commits.push('frame') }, paintBlocks(), null, 600, 400, 1, {
    createCanvas: () => ({ getContext: () => canvasRecorder() }), signal: controller.signal,
    budgetMs: 1, now: () => ++ticks, yieldToMain: async () => controller.abort(),
  }), { name: 'AbortError' });
  assert.deepEqual(commits, []);
});
