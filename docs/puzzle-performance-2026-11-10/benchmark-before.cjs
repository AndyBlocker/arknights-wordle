// Frozen pre-optimization functions; controlled opaque gradient, not an operator-art claim.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { performance } = require('node:perf_hooks');
const { spawnSync } = require('node:child_process');
const directory = __dirname;
const mode = process.argv[2];
if (!mode) {
  const results = {};
  for (const name of ['raw', 'vue-ref']) {
    const child = spawnSync(process.execPath, [__filename, name], { timeout: 25000, encoding: 'utf8' });
    const file = path.join(directory, `benchmark-before-${name}.json`);
    results[name] = { ...(fs.existsSync(file) ? JSON.parse(fs.readFileSync(file)) : {}),
      process_status: child.status, timed_out: child.error?.code === 'ETIMEDOUT', stderr: child.stderr?.slice(-1000) };
  }
  fs.writeFileSync(path.join(directory, 'algorithm-before.json'), JSON.stringify(results, null, 2) + '\n');
  console.log(JSON.stringify(results, null, 2));
  process.exit();
}
const strip = source => source.replace(/^import[\s\S]*?from\s+['"][^'"]+['"];\s*/gm, '').replace(/\bexport /g, '');
const read = file => fs.readFileSync(path.join(directory, 'benchmark-before-sources', file), 'utf8');
const stats = { advancedCalls: 0, sampledPixels: 0, assignedBlocks: 0, coverageCalls: 0, indexOfCalls: 0, spliceCalls: 0 };
let randomState = 17;
const math = Object.create(Math);
math.random = () => { randomState = (randomState * 1664525 + 1013904223) >>> 0; return randomState / 4294967296; };
const config = { COLOR_EXTRACTION: { ENABLE_ADVANCED_EXTRACTION: true, MAX_LEVEL_FOR_ADVANCED: 3, SATURATION_BOOST: 1.2 }, PERFORMANCE: { SAMPLING_INTERVAL: 2, MAX_CACHE_SIZE: 15, MAX_CACHE_BYTES: 48 * 1024 * 1024 } };
const context = { console: { log() {}, warn() {}, error() {} }, Math: math, process: { env: { NODE_ENV: 'production' } },
  Uint8ClampedArray, Uint32Array, __stats: stats, getCurrentConfig: () => config };
vm.createContext(context);
vm.runInContext(strip(read('advancedColorExtraction.js')) + '\nglobalThis.originalExtract=extractDominantColors;', context);
context.extractDominantColors = (...args) => {
  stats.advancedCalls++;
  const [,x1,y1,x2,y2] = args;
  stats.sampledPixels += Math.max(0, Math.floor((x2-x1)/2)+1) * Math.max(0, Math.floor((y2-y1)/2)+1);
  return context.originalExtract(...args);
};
let service = strip(read('puzzleService.js'));
service = service.replace('function assignBlockAttributes(block,', 'function assignBlockAttributes(block,')
  .replace('    // 计算覆盖率\n', '    __stats.assignedBlocks++;\n    // 计算覆盖率\n')
  .replace('function calcBlockAlphaCoverage(integral, block, scaledWidth, scaledHeight) {', 'function calcBlockAlphaCoverage(integral, block, scaledWidth, scaledHeight) { __stats.coverageCalls++;')
  .replace('blocks.indexOf(sb)', '(__stats.indexOfCalls++, blocks.indexOf(sb))')
  .replace('indicesToRemove.forEach(idx => blocks.splice(idx, 1));', 'indicesToRemove.forEach(idx => { __stats.spliceCalls++; blocks.splice(idx, 1); });');
vm.runInContext(service + '\nglobalThis.api={initBlocks,refineRandomBlocks,renderMosaic};', context);
const worker = read('integralImageWorker.js');
const integralFunction = worker.slice(worker.indexOf('function createIntegralImage'), worker.indexOf('/**\n * 批量处理'));
const createIntegral = vm.runInNewContext(integralFunction + '\ncreateIntegralImage;', { Uint32Array });
const side = 1200;
const image = { width: side, height: side, data: new Uint8ClampedArray(side * side * 4) };
for (let y=0;y<side;y++) for (let x=0;x<side;x++) {
  const i=(y*side+x)*4; image.data[i]=x%256; image.data[i+1]=y%256; image.data[i+2]=(x+y)%256; image.data[i+3]=255;
}
const integral = createIntegral(image);
const started = performance.now();
let blocks = context.api.initBlocks(600,600,{rows:4,cols:4},integral,0.01,image);
const initMs = performance.now()-started;
if (mode === 'vue-ref') blocks = require('../../frontend/node_modules/vue').ref(blocks).value;
const levels = {};
const result = { mode, conditions: 'Frozen production functions; seeded opaque1200² gradient; display600²; high-quality sampling2; all areas eligible; 25-second per-mode process limit; Node timings are not browser/FPS metrics.', initMs, rows: [] };
const file = path.join(directory, `benchmark-before-${mode}.json`);
const persist = () => fs.writeFileSync(file, JSON.stringify(result, null, 2) + '\n');
persist();
for (let click=1;click<=14;click++) {
  const before={...stats};const begin=performance.now();
  context.api.refineRandomBlocks(blocks,levels,9,{rows:2,cols:2},{rows:4,cols:4},integral,600,600,0.01,image);
  const refined=performance.now();let fills=0;
  context.api.renderMosaic({clearRect(){},set fillStyle(_v){},fillRect(){fills++;}},blocks,integral,600,600,Math.min(5,click+1));
  result.rows.push({click,blocks:blocks.length,refineMs:refined-begin,renderLoopMs:performance.now()-refined,fillCalls:fills,
    costs:Object.fromEntries(Object.keys(stats).map(key=>[key,stats[key]-before[key]]))});
  persist();
}
