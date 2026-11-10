const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');
const { chromium } = require('/tmp/arknights-browser-tools/node_modules/playwright-core');
const root = __dirname;
const shotDir = path.join(root, 'screenshots/puzzle');
fs.mkdirSync(shotDir, { recursive: true });
const data = JSON.parse(fs.readFileSync(path.join(root, '../../frontend/public/data/operators.json')));
const op = name => data.find(row => row.干员 === name);
const evidence = { origin: 'http://127.0.0.1:8817/arknights-wordle/', conditions: 'Local production build; Chromium 1440x1000 / 390x844 / 844x390; external media uses local proxy. Explicit JSON and media failure fixtures are labeled.', cases: [], screenshots: [] };
const save = () => fs.writeFileSync(path.join(root, 'puzzle-browser-results.json'), JSON.stringify(evidence, null, 2));
async function state(page, name) {
  const value = await page.evaluate(() => ({ text: document.body.innerText.slice(0, 1800), controls: [...document.querySelectorAll('button,input')].map(e => ({ tag: e.tagName, text: e.innerText || e.getAttribute('aria-label') || e.getAttribute('placeholder'), disabled: e.disabled })), canvases: [...document.querySelectorAll('canvas')].map(e => ({ bitmap: [e.width, e.height], box: [e.getBoundingClientRect().width, e.getBoundingClientRect().height] })) }));
  evidence.cases.push({ name, ...value }); save();
}
async function shot(page, name) { await page.waitForTimeout(700); await page.screenshot({ path: path.join(shotDir, name + '.png'), fullPage: true }); evidence.screenshots.push('screenshots/puzzle/' + name + '.png'); save(); }
async function ready(page) { await page.waitForFunction(() => [...document.querySelectorAll('.mosaic-container canvas')].some(e => e.width > 0 && e.height > 0) && !document.querySelector('input[role="combobox"]')?.disabled, { timeout: 35000 }); await page.waitForTimeout(200); }
async function mode(page) { await page.getByRole('combobox').waitFor(); await state(page, 'before-select-puzzle'); await page.locator('.tag-group-item').filter({ hasText: '小头' }).click(); }
async function submit(page, name) { await state(page, 'before-search-' + name); await page.getByRole('combobox').fill(name); await page.waitForTimeout(220); await state(page, 'before-select-' + name); await page.getByRole('option').filter({ hasText: name }).first().click(); await state(page, 'before-submit-' + name); await page.getByRole('button', { name: '提交选择的干员' }).click(); await page.waitForTimeout(300); }
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: '/home/andyblocker/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome', args: ['--no-sandbox'], proxy: { server: 'http://127.0.0.1:7890', bypass: '127.0.0.1,localhost' } });
  try {
    // 1: real PNG over the actual public media network, single-three-star target.
    {
      const c = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
      await c.addInitScript(() => { Math.random = () => 0; });
      await c.route('**/data/operators.json', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([op('芬')]) }));
      const requests = [];
      const page = await c.newPage(); page.on('request', r => { if (r.url().includes('media.prts.wiki')) requests.push(decodeURIComponent(r.url())); });
      await page.goto(evidence.origin); await mode(page); await ready(page);
      assert.ok(requests.some(url => url.includes('立绘_芬_1.png')));
      assert.equal(requests.some(url => url.includes('立绘_芬_2.png')), false);
      await state(page, 'fang-real-media-ready'); await shot(page, '01-fang-real-media');
      evidence.cases.push({ name: 'fang-real-media-requests', fixture: 'single JSON target and fixed base-art selection; PNG is real public network', requests }); save();
      await c.close();
    }
    // 2: force selected skin/elite image failure; return a real downloaded base PNG.
    {
      const c = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
      await c.addInitScript(() => { Math.random = () => 0.99; });
      await c.route('**/data/operators.json', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([op('能天使')]) }));
      const media = [];
      await c.route('https://media.prts.wiki/**', async r => {
        const url = decodeURIComponent(r.request().url()); media.push(url);
        if (url.includes('立绘_能天使_1.png')) await r.fulfill({ status: 200, contentType: 'image/png', headers: { 'Access-Control-Allow-Origin': '*' }, body: fs.readFileSync('/tmp/puzzle-exusiai.png') });
        else await r.fulfill({ status: 404, contentType: 'application/xml', body: 'Missing art fixture' });
      });
      const page = await c.newPage(); await page.goto(evidence.origin); await mode(page); await ready(page);
      assert.ok(media.some(url => /立绘_能天使_(skin\d+|2)\.png/.test(url)));
      assert.ok(media.some(url => url.includes('立绘_能天使_1.png')));
      await state(page, 'missing-selected-art-falls-back'); await shot(page, '02-selected-art-base-fallback');
      evidence.cases.push({ name: 'selected-art-fallback-requests', fixture: 'selected art 404, unchanged real base PNG fulfilled', media }); save(); await c.close();
    }
    // 3: all art fails, then same target can be retried after network recovery.
    {
      const c = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
      await c.route('**/data/operators.json', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([op('芬')]) }));
      let recovered = false;
      await c.route('https://media.prts.wiki/**', r => recovered
        ? r.fulfill({ status: 200, contentType: 'image/png', headers: { 'Access-Control-Allow-Origin': '*' }, body: fs.readFileSync('/tmp/puzzle-fang.png') })
        : r.fulfill({ status: 503, contentType: 'text/plain', body: 'Controlled outage' }));
      const page = await c.newPage(); await page.goto(evidence.origin); await mode(page);
      await page.getByRole('button', { name: '重新加载', exact: true }).waitFor(); await page.waitForTimeout(3500);
      assert.equal(await page.getByRole('button', { name: '重新加载', exact: true }).count(), 1);
      assert.equal(await page.getByRole('combobox').isDisabled(), true);
      await state(page, 'all-art-failure-persistent'); await shot(page, '03-persistent-image-error');
      recovered = true; await state(page, 'before-retry'); await page.getByRole('button', { name: '重新加载', exact: true }).click(); await ready(page);
      await state(page, 'same-target-retry-recovered'); await shot(page, '04-image-retry-recovered'); await c.close();
    }
    // 4: /bw same-target reset and resize preserve/restart the intended mosaic.
    {
      const c = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
      await c.addInitScript(() => { Math.random = () => 0; });
      await c.route('**/data/operators.json', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([op('芬'), op('香草')]) }));
      await c.route('https://media.prts.wiki/**', r => r.fulfill({ status: 200, contentType: 'image/png', headers: { 'Access-Control-Allow-Origin': '*' }, body: fs.readFileSync('/tmp/puzzle-fang.png') }));
      const page = await c.newPage(); await page.goto(evidence.origin + 'bw/'); await ready(page);
      const pristine = await page.locator('canvas').evaluate(e => e.toDataURL());
      await submit(page, '香草');
      const refined = await page.locator('canvas').evaluate(e => e.toDataURL()); assert.notEqual(pristine, refined);
      const shapes = [];
      for (const [width, height] of [[390, 844], [844, 390], [1440, 1000]]) {
        await page.setViewportSize({ width, height }); await page.waitForTimeout(450);
        const shape = await page.locator('canvas').evaluate(e => ({ bitmap: [e.width, e.height], box: [e.getBoundingClientRect().width, e.getBoundingClientRect().height] }));
        assert.ok(Math.abs(shape.box[0] / shape.box[1] - shape.bitmap[0] / shape.bitmap[1]) < 0.02, JSON.stringify(shape));
        shapes.push({ viewport: [width, height], ...shape });
        if (width !== 1440) await shot(page, '05-bw-' + width + 'x' + height);
      }
      assert.equal(await page.locator('canvas').evaluate(e => e.toDataURL()), refined);
      await submit(page, '芬'); await page.getByRole('button', { name: '再来一次', exact: true }).waitFor(); await state(page, 'before-bw-same-target-reset'); await page.getByRole('button', { name: '再来一次', exact: true }).click();
      await state(page, 'before-confirm-reset'); await page.locator('.confirm-btn').click(); await ready(page);
      assert.equal(await page.locator('canvas').evaluate(e => e.toDataURL()), pristine);
      await shot(page, '06-bw-same-target-new-session'); evidence.cases.push({ name: 'bw-resize-and-reset', fixture: 'fixed target order and unchanged real PNG; no mosaic algorithm changes', shapes, retainedRefinementAfterResize: true, resetRestoredPristine: true }); save(); await c.close();
    }
    // 5: full real catalogue and real media measure only the selected target, no bulk prefetch.
    {
      const c = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
      const page = await c.newPage(); const cdp = await c.newCDPSession(page); await cdp.send('Network.enable'); await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
      let watching = false, bytes = 0; const media = [], requests = [];
      page.on('request', r => { if (watching) { requests.push(r.url()); if (r.url().includes('media.prts.wiki')) media.push(decodeURIComponent(r.url())); } });
      cdp.on('Network.loadingFinished', e => { if (watching) bytes += e.encodedDataLength; });
      await page.goto(evidence.origin); await page.getByRole('combobox').waitFor(); await page.waitForTimeout(200); watching = true;
      const started = Date.now(); await mode(page); await ready(page); const readyMs = Date.now() - started; await page.waitForTimeout(5000); watching = false;
      assert.ok(media.length <= 3, 'unexpected bulk media prefetch: ' + media.length);
      const canvas = page.locator('.mosaic-container canvas');
      const shapes = [];
      for (const [width, height] of [[1440, 1000], [390, 844], [844, 390]]) {
        await page.setViewportSize({ width, height }); await page.waitForTimeout(300);
        const shape = await canvas.evaluate(e => ({ bitmap: [e.width, e.height], box: [e.getBoundingClientRect().width, e.getBoundingClientRect().height] }));
        assert.ok(Math.abs(shape.box[0] / shape.box[1] - shape.bitmap[0] / shape.bitmap[1]) < 0.02, JSON.stringify(shape)); shapes.push({ viewport: [width, height], ...shape });
        await shot(page, '07-real-main-' + width + 'x' + height);
      }
      evidence.cases.push({ name: 'real-full-catalogue-puzzle-network', fixture: 'none; real random target/PNG, local build; CDP disabled cache', readyMs, observationAfterReadyMs: 5000, encodedNetworkBytes: bytes, mediaRequests: media.length, requestCount: requests.length, media, shapes }); save(); await c.close();
    }
    evidence.success = true; save(); console.log('Puzzle browser repairs verified; cases:', evidence.cases.length);
  } finally { await browser.close(); }
})().catch(error => { evidence.error = { message: error.message, stack: error.stack }; save(); console.error(error); process.exit(1); });
