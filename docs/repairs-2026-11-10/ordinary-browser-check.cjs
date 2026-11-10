const fs=require('fs');const path=require('path');const assert=require('node:assert/strict');
const {chromium}=require('/tmp/arknights-browser-tools/node_modules/playwright-core');
const origin=process.env.REPAIR_URL||'http://127.0.0.1:8817/arknights-wordle/';const out=__dirname;
const data=JSON.parse(fs.readFileSync(path.join(__dirname,'../../frontend/public/data/operators.json'),'utf8'));
const evidence={started:new Date().toISOString(),origin,conditions:'Controlled JSON subsets drawn from the real 440-row snapshot; Chromium desktop and viewport simulation. Only route fault cases replace an HTTP status.',cases:[],screenshots:[],errors:[]};
const store=()=>fs.writeFileSync(path.join(out,'ordinary-browser-results.json'),JSON.stringify(evidence,null,2)+'\n');
let browser;
async function shot(page,name){await page.waitForTimeout(500);await page.screenshot({path:path.join(out,'screenshots',name+'.png'),fullPage:true});evidence.screenshots.push(name+'.png');store();}
async function snapshot(page){return page.evaluate(()=>({url:location.href,text:document.body.innerText.slice(-7000),rows:document.querySelectorAll('.result-row:not(.answer-row)').length,inputDisabled:document.querySelector('[role=combobox]')?.disabled,bodyWidth:document.documentElement.scrollWidth,viewport:innerWidth}));}
async function test(name,fn){try{const value=await fn();evidence.cases.push({name,status:'PASS',...value});}catch(e){evidence.cases.push({name,status:'FAIL',error:e.message,stack:e.stack});}store();}
async function pageFor(rows,mode='hard',viewport={width:1440,height:1000},fault=false){
 const context=await browser.newContext({viewport,ignoreHTTPSErrors:true});
 await context.addCookies([{name:'arknightsWordle.settings',value:encodeURIComponent(JSON.stringify({onlySixStar:false,maxGuesses:6,selectedTagGroupId:mode,potentialMode:'满潜',trustMode:'满信赖',puzzleHintInterval:3})),url:origin}]);
 await context.addInitScript(()=>Math.random=()=>0);
 let failed=fault;
 await context.route('**/data/operators.json',r=>failed?r.fulfill({status:503,contentType:'text/plain',body:'Controlled audit failure'}):r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(rows)}));
 const page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>{evidence.errors.push({case:page.url(),message:e.message});store();});
 return {page,context,recover:()=>{failed=false;}};
}
async function submit(page,name){const input=page.getByRole('combobox');await input.waitFor({state:'visible'});await input.fill(name);const choice=page.getByRole('option').filter({hasText:name}).first();await choice.waitFor({state:'visible'});await choice.click();await page.getByRole('button',{name:'提交选择的干员',exact:true}).click();await page.waitForTimeout(180);}
async function ready(page,suffix=''){await page.goto(origin+suffix,{waitUntil:'domcontentloaded'});await page.getByRole('combobox').waitFor({state:'visible'});}
const op=name=>{const row=data.find(r=>r.干员===name);assert.ok(row,name);return row;};
(async()=>{
 browser=await chromium.launch({headless:true,executablePath:'/home/andyblocker/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome',args:['--no-sandbox'],proxy:{server:'http://127.0.0.1:7890',bypass:'127.0.0.1,localhost'}});
 for(const name of ['GALLUS²','阿米娅(近卫)','阿米娅(医疗)'])await test('canonical '+name,async()=>{
  const {page,context}=await pageFor([op(name)]);await ready(page);await submit(page,name);assert.match(await page.locator('.game-status').innerText(),/恭喜你猜对/);assert.equal(await page.locator('.result-row:not(.answer-row)').count(),1);assert.equal(await page.getByRole('combobox').isDisabled(),true);await shot(page,'ordinary-canonical-'+({'GALLUS²':'gallus','阿米娅(近卫)':'amiya-guard','阿米娅(医疗)':'amiya-medic'}[name]));const state=await snapshot(page);await context.close();return {controlled:true,state};
 });
 await test('empty Enter cannot resubmit previous guess',async()=>{
  const {page,context}=await pageFor([op('能天使'),op('芬')]);await ready(page);await submit(page,'芬');assert.equal(await page.getByRole('combobox').isDisabled(),false);await page.getByRole('combobox').press('Enter');await page.getByRole('combobox').press('Enter');await page.waitForTimeout(250);assert.equal(await page.locator('.result-row:not(.answer-row)').count(),1);assert.equal(await page.getByRole('option').count(),0);assert.equal(await page.getByRole('combobox').getAttribute('aria-activedescendant'),null);await shot(page,'ordinary-duplicate-prevented');const state=await snapshot(page);await context.close();return {controlled:true,state};
 });
 await test('12F potential and trust effective attack is 506',async()=>{
  const {page,context}=await pageFor([op('能天使'),op('12F')]);await ready(page);await submit(page,'12F');const cell=page.locator('.result-row:not(.answer-row) [aria-label^="满级攻击："]');assert.match(await cell.innerText(),/506/);await shot(page,'ordinary-12f-506');const label=await cell.getAttribute('aria-label');await context.close();return {controlled:true,label};
 });
 await test('same birthday is correct and unknown height is incomparable',async()=>{
  const known=data.filter(r=>r.出生日期);let pair;for(const row of known){const other=known.find(r=>r.干员!==row.干员&&r.出生日期===row.出生日期);if(other){pair=[row,other];break;}}assert.ok(pair);
  let state=await pageFor(pair,'easy');await ready(state.page);await submit(state.page,pair[1].干员);const birthday=state.page.locator('.result-row:not(.answer-row) [aria-label^="出生日期："]');assert.ok((await birthday.getAttribute('class')).split(/\s+/).includes('correct'));await shot(state.page,'ordinary-birthday-correct');await state.context.close();
  state=await pageFor([op('Lancet-2'),op('Castle-3')],'easy');await ready(state.page);await submit(state.page,'Castle-3');const height=state.page.locator('.result-row:not(.answer-row) [aria-label^="身高："]');assert.match(await height.innerText(),/未知[\s\S]*不可比较/);assert.ok((await height.getAttribute('class')).includes('unknown'));assert.doesNotMatch(await height.innerText(),/[↑↓]/);await shot(state.page,'ordinary-height-unknown');await state.context.close();return {controlled:true,birthday:pair.map(r=>r.干员),unknownHeight:'Lancet-2 / Castle-3'};
 });
 for(const width of [320,390])await test('local table scrolling '+width,async()=>{
  const {page,context}=await pageFor([op('能天使'),op('芬')],'hard',{width,height:844});await ready(page);await submit(page,'芬');const geometry=await page.evaluate(()=>{const section=document.querySelector('.results-section');const header=document.querySelector('.header-row .cell-avatar');const before=header.getBoundingClientRect().x;section.scrollLeft=200;return {pageWidth:document.documentElement.scrollWidth,viewport:innerWidth,container:section.clientWidth,tableWidth:section.scrollWidth,firstBefore:before,firstAfter:header.getBoundingClientRect().x,position:getComputedStyle(header).position,headerWhiteSpace:getComputedStyle(document.querySelector('.header-cell:nth-child(3)')).whiteSpace};});assert.ok(geometry.pageWidth<=width+1);assert.ok(geometry.tableWidth>geometry.container);assert.equal(geometry.headerWhiteSpace,'nowrap');assert.equal(geometry.position,'sticky');assert.ok(Math.abs(geometry.firstAfter-geometry.firstBefore)<=12);await shot(page,'ordinary-mobile-'+width);await context.close();return {controlled:true,geometry};
 });
 for(const suffix of ['', 'bw/'])await test('JSON503 retry '+(suffix||'main'),async()=>{
  const {page,context,recover}=await pageFor([op('能天使')],'hard',{width:390,height:844},true);await page.goto(origin+suffix,{waitUntil:'domcontentloaded'});const retry=page.getByRole('button',{name:'重新加载数据',exact:true});await retry.waitFor({state:'visible'});await shot(page,'ordinary-json503-'+(suffix?'bw':'main'));recover();await retry.click();await page.getByRole('combobox').waitFor({state:'visible'});if(suffix)await page.waitForFunction(()=>document.querySelector('[role=combobox]')&&!document.querySelector('[role=combobox]').disabled,{timeout:30000});assert.equal(await page.getByRole('button',{name:'重新加载数据',exact:true}).count(),0);await shot(page,'ordinary-json-recovered-'+(suffix?'bw':'main'));const state=await snapshot(page);await context.close();return {controlled:true,state};
 });
 await test('max guesses changing from ended 3 to 6 reopens consistently',async()=>{
  const {page,context}=await pageFor([op('能天使'),op('芬'),op('夜刀'),op('12F')]);await ready(page);await page.getByRole('button',{name:'展开或收起游戏设置'}).click();const range=page.getByRole('slider',{name:'最大猜测次数',exact:true});await range.waitFor({state:'visible'});await range.press('Home');for(const name of ['芬','夜刀','12F'])await submit(page,name);assert.equal(await page.getByRole('combobox').isDisabled(),true);await range.press('Home');for(let i=0;i<3;i++)await range.press('ArrowRight');await page.waitForTimeout(200);assert.equal(await page.getByRole('combobox').isDisabled(),false);assert.match(await page.locator('.game-status').innerText(),/3\s*\/\s*6/);await range.press('Home');await page.waitForTimeout(200);assert.equal(await page.getByRole('combobox').isDisabled(),true);await shot(page,'ordinary-max-guesses-consistent');const state=await snapshot(page);await context.close();return {controlled:true,state};
 });
 await browser.close();evidence.finished=new Date().toISOString();store();console.log(JSON.stringify(evidence.cases.map(c=>({name:c.name,status:c.status,error:c.error})),null,2));if(evidence.cases.some(c=>c.status!=='PASS')||evidence.errors.length)process.exitCode=1;
})().catch(async e=>{console.error(e);store();if(browser)await browser.close();process.exitCode=1;});
