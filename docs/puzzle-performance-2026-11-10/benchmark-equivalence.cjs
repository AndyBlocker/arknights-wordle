// Confirm optimized geometry/order/colors against frozen pre-fix functions.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const directory = __dirname;
const strip = source => source.replace(/^import[\s\S]*?from\s+['"][^'"]+['"];\s*/gm, '').replace(/\bexport /g, '');
function load(folder) {
  let state = 17;
  const math = Object.create(Math);
  math.random = () => { state = (state * 1664525 + 1013904223) >>> 0; return state / 4294967296; };
  const config = { COLOR_EXTRACTION: { ENABLE_ADVANCED_EXTRACTION: true, MAX_LEVEL_FOR_ADVANCED: 3, SATURATION_BOOST: 1.2 }, PERFORMANCE: { SAMPLING_INTERVAL: 2, MAX_CACHE_SIZE: 15, MAX_CACHE_BYTES: 48*1024*1024 } };
  const context = { Math: math, process: { env: { NODE_ENV: 'production' } }, console: { warn(){},error(){},log(){} }, getCurrentConfig:()=>config };
  vm.createContext(context);
  for(const file of ['advancedColorExtraction.js','puzzleService.js']) vm.runInContext(strip(fs.readFileSync(path.join(directory,folder,file),'utf8')),context);
  return vm.runInContext('({initBlocks,refineRandomBlocks})',context);
}
const worker = fs.readFileSync(path.join(directory,'benchmark-before-sources/integralImageWorker.js'),'utf8');
const createIntegral = vm.runInNewContext(worker.slice(worker.indexOf('function createIntegralImage'),worker.indexOf('/**\n * 批量处理'))+'\ncreateIntegralImage;',{Uint32Array});
const results = [];
for(const fixture of ['opaque-square','transparent-landscape']) {
  const width=1200,height=fixture==='opaque-square'?1200:800;
  const image={width,height,data:new Uint8ClampedArray(width*height*4)};
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const i=(y*width+x)*4;image.data[i]=x%256;image.data[i+1]=y%256;image.data[i+2]=(x+y)%256;
    image.data[i+3]=fixture==='opaque-square'||((x-width/2)**2/(width/3)**2+(y-height/2)**2/(height/3)**2<1)?255:0;
  }
  const integral=createIntegral(image),before=load('benchmark-before-sources'),after=load('benchmark-after-sources');
  const displayWidth=600,displayHeight=600*height/width,grid={rows:4,cols:4},factor={rows:2,cols:2};
  const first=before.initBlocks(displayWidth,displayHeight,grid,integral,.01,image);
  const second=after.initBlocks(displayWidth,displayHeight,grid,integral,.01,image);
  const levelsBefore={},levelsAfter={};
  const rows=[];
  for(let click=0;click<=7;click++){
    if(click){
      before.refineRandomBlocks(first,levelsBefore,9,factor,grid,integral,displayWidth,displayHeight,.01,image);
      after.refineRandomBlocks(second,levelsAfter,9,factor,grid,integral,displayWidth,displayHeight,.01,image);
    }
    const serializedBefore=JSON.stringify({blocks:first,levels:levelsBefore});
    const serializedAfter=JSON.stringify({blocks:second,levels:levelsAfter});
    assert.equal(serializedAfter,serializedBefore,`${fixture} click ${click}: geometry/order/color/levels differ`);
    rows.push({click,blocks:first.length,identical:true,sha256:crypto.createHash('sha256').update(serializedBefore).digest('hex')});
  }
  results.push({fixture,rows});
}
const result={assertion:'Every block property, array order and area level exactly match through seven wrong guesses under the same random seed, including transparent skipRefine regions.',results};
fs.writeFileSync(path.join(directory,'algorithm-equivalence.json'),JSON.stringify(result,null,2)+'\n');
console.log('Equivalence passed: two image fixtures × init and seven refinements.');
