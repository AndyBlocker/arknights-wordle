const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { chromium } = require(process.env.PLAYWRIGHT_CORE_PATH || '/tmp/arknights-browser-tools/node_modules/playwright-core');
const origin = process.env.PERF_ORIGIN || 'http://127.0.0.1:8828/arknights-wordle/';
const output = process.env.PERF_OUTPUT || path.join(__dirname, 'after-browser.json');
const all = JSON.parse(fs.readFileSync(path.join(__dirname, '../../frontend/public/data/operators.json')));
const target = all.find(row => row.干员 === '能天使');
const wrong = all.filter(row => row.干员 !== target.干员).slice(0, 14);
const fixture = [target, ...wrong];
const png = fs.readFileSync(process.env.PERF_IMAGE || '/tmp/puzzle-exusiai.png');
const report = {
  origin, started: new Date().toISOString(), fixtureSha256: crypto.createHash('sha256').update(png).digest('hex'),
  conditions: 'Production build; fixed real Exusiai PNG and real operator subset, Math.random=0; avatars and analytics blocked. No CPU/network emulation. First-response 2rAF is recorded separately from final input-ready plus 2rAF. Both HTML and Offscreen fillRect are counted; visible drawImage commits tracked. Pixel hashes are computed after timing/CPU sample collection.',
  scenarios: [],
};
const save = () => fs.writeFileSync(output, JSON.stringify(report, null, 2));
const metricMap = value => Object.fromEntries(value.metrics.map(item => [item.name, item.value]));
function installProbe() {
  Math.random = () => 0;
  const perf = window.__perf = { batches: [], commits: [], longTasks: [], clicks: [], frames: [], busyChanges: [] };
  const batches = new WeakMap();
  // Boundary cases only: stop at an actual cooperative yield. These hooks are
  // dormant during the ordinary timing scenarios and never alter their scheduler.
  const schedulerYield = window.scheduler?.yield?.bind(window.scheduler);
  if (schedulerYield) window.scheduler.yield = function () {
    const click = perf.clicks.at(-1);
    if (click && window.__perfRestartOnYield && document.querySelector('.puzzle-board')?.getAttribute('aria-busy') === 'true') {
      window.__perfRestartOnYield = false;
      window.__perfRestartFired = performance.now();
      window.__perfRestartState = { time: window.__perfRestartFired, busy: document.querySelector('.puzzle-board')?.getAttribute('aria-busy'), inputDisabled: document.querySelector('input[role=combobox]')?.disabled, commitsSinceClick: perf.commits.length - click.commitIndex, batches: perf.batches.slice(click.batchIndex).map(batch => ({ kind: batch.kind, count: batch.count })), trigger: 'first actual scheduler.yield while busy; synchronous DOM mode click' };
      [...document.querySelectorAll('.tag-group-item')].find(button => button.textContent.includes('小头'))?.click();
    }
    if (click && window.__perfPauseStagedPaint && perf.batches.slice(click.batchIndex).some(batch => batch.kind !== 'visible' && batch.count > 0) && perf.commits.length === click.commitIndex) {
      window.__perfPauseStagedPaint = false;
      window.__perfPaintPaused = performance.now();
      return new Promise(resolve => { window.__perfReleasePaint = resolve; });
    }
    return schedulerYield();
  };
  const visible = ctx => ctx.canvas instanceof HTMLCanvasElement && !!ctx.canvas.closest('.puzzle-board');
  for (const kind of ['CanvasRenderingContext2D', 'OffscreenCanvasRenderingContext2D']) {
    const klass = window[kind]; if (!klass) continue;
    const proto = klass.prototype, clear = proto.clearRect, fill = proto.fillRect, draw = proto.drawImage;
    proto.clearRect = function (...args) {
      const item = { kind: visible(this) ? 'visible' : kind === 'OffscreenCanvasRenderingContext2D' ? 'offscreen' : 'detached', start: performance.now(), count: 0, last: performance.now(), width: this.canvas.width, height: this.canvas.height };
      perf.batches.push(item); batches.set(this, item); return clear.apply(this, args);
    };
    proto.fillRect = function (...args) { const b = batches.get(this); if (b) { b.count++; b.last = performance.now(); } return fill.apply(this, args); };
    proto.drawImage = function (...args) { const result = draw.apply(this, args); if (visible(this)) perf.commits.push({ time: performance.now(), width: this.canvas.width, height: this.canvas.height }); return result; };
  }
  try { new PerformanceObserver(list => perf.longTasks.push(...list.getEntries().map(item => ({ start: item.startTime, duration: item.duration })))).observe({ type: 'longtask', buffered: true }); } catch {}
  const frame = time => { perf.frames.push(time); requestAnimationFrame(frame); }; requestAnimationFrame(frame);
  document.addEventListener('click', event => {
    if (!event.target.closest('.submit-button')) return;
    const click = { start: performance.now(), batchIndex: perf.batches.length, commitIndex: perf.commits.length };
    perf.clicks.push(click);
    requestAnimationFrame(() => requestAnimationFrame(() => { click.firstResponseMs = performance.now() - click.start; }));
  }, true);
  new MutationObserver(records => {
    for (const r of records) if (r.attributeName === 'aria-busy' && r.target.classList.contains('puzzle-board')) perf.busyChanges.push({ time: performance.now(), busy: r.target.getAttribute('aria-busy') });
  }).observe(document, { subtree: true, attributes: true, attributeFilter: ['aria-busy'] });
}
async function newPage(browser, spec) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.addInitScript(installProbe);
  await context.route('**/data/operators.json', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify(fixture) }));
  await context.route('https://media.prts.wiki/**', route => decodeURIComponent(route.request().url()).includes('立绘_') ? route.fulfill({ contentType: 'image/png', headers: { 'Access-Control-Allow-Origin': '*' }, body: png }) : route.abort());
  await context.route('**/*googletagmanager*', route => route.abort());
  const page = await context.newPage(); page.setDefaultTimeout(60000);
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  const cdp = await context.newCDPSession(page); await cdp.send('Performance.enable');
  await page.goto(origin + spec.suffix); await page.getByRole('combobox').waitFor();
  if (!spec.suffix) {
    await page.locator('.tag-group-item').filter({ hasText: '小头' }).click();
    if (spec.limit !== 6) {
      await page.locator('.toggle-btn').click();
      await page.locator('input[type=range][aria-label="最大猜测次数"]').evaluate((input, value) => { input.value = String(value); input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true })); }, spec.limit);
    }
  }
  await page.waitForFunction(() => document.querySelector('.mosaic-container canvas')?.width > 0 && !document.querySelector('input[role=combobox]').disabled && (window.__perf.commits.length > 0 || window.__perf.batches.some(batch => batch.kind === 'visible' && batch.count > 0)));
  const sample = { ...spec, steps: [], errors, environment: await page.evaluate(() => ({ cores: navigator.hardwareConcurrency, memory: navigator.deviceMemory, dpr: devicePixelRatio, scripts: [...document.scripts].map(script => script.src).filter(Boolean) })) };
  return { context, page, cdp, sample };
}
async function prepareGuess(page, name) {
  await page.getByRole('combobox').fill(name);
  await page.getByRole('option').filter({ hasText: name }).first().click();
}
async function pixelHash(page) {
  return page.locator('.mosaic-container canvas').evaluate(canvas => {
    const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    let hash = 2166136261;
    for (const byte of pixels) hash = Math.imul(hash ^ byte, 16777619);
    return { width: canvas.width, height: canvas.height, fnv1a: (hash >>> 0).toString(16) };
  });
}
async function finishGuess(page, index) {
  await page.waitForFunction(index => {
    const perf = window.__perf, click = perf.clicks[index]; if (!click) return false;
    const input = document.querySelector('input[role=combobox]'), board = document.querySelector('.puzzle-board');
    const drawn = perf.commits.slice(click.commitIndex).some(item => item.time >= click.start) || perf.batches.slice(click.batchIndex).some(item => item.kind === 'visible' && item.count > 0);
    return drawn && input && !input.disabled && board?.getAttribute('aria-busy') !== 'true';
  }, index);
  return page.evaluate(index => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => {
    const perf = window.__perf, click = perf.clicks[index], finished = performance.now();
    const frames = perf.frames.filter(time => time >= click.start - 30 && time <= finished);
    const gaps = frames.slice(1).map((time, i) => time - frames[i]);
    resolve({ start: click.start, firstResponseMs: click.firstResponseMs, finalCompletionMs: finished - click.start,
      batches: perf.batches.slice(click.batchIndex), commits: perf.commits.slice(click.commitIndex),
      drawnBlocks: perf.batches.slice(click.batchIndex).reduce((sum, item) => sum + item.count, 0),
      maxFrameGapMs: gaps.length ? Math.max(...gaps) : null,
      longTasks: perf.longTasks.filter(item => item.start >= click.start - 1 && item.start <= finished),
      busyChanges: perf.busyChanges.filter(item => item.time >= click.start - 1 && item.time <= finished),
      heap: performance.memory?.usedJSHeapSize });
  }))), index);
}
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || '/home/andyblocker/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome', args: ['--no-sandbox'] });
  try {
    const specs = [{ name: 'main-default-6', suffix: '', limit: 6, maxWrong: 5 }, { name: 'main-max-15', suffix: '', limit: 15, maxWrong: Number(process.env.PERF_MAX_WRONG || 14) }, { name: 'bw-default-6', suffix: 'bw/', limit: 6, maxWrong: 5 }].filter(spec => !process.env.PERF_CASE || new RegExp(process.env.PERF_CASE).test(spec.name));
    for (const spec of specs) {
      const { context, page, cdp, sample } = await newPage(browser, spec); sample.pristineHash = await pixelHash(page); report.scenarios.push(sample); save();
      for (let i = 0; i < spec.maxWrong; i++) {
        await prepareGuess(page, wrong[i].干员);
        const before = metricMap(await cdp.send('Performance.getMetrics'));
        const index = await page.evaluate(() => window.__perf.clicks.length);
        await page.locator('.submit-button').click();
        const step = { guess: i + 1, name: wrong[i].干员, ...await finishGuess(page, index) };
        const after = metricMap(await cdp.send('Performance.getMetrics'));
        step.cpuTaskMs = (after.TaskDuration - before.TaskDuration) * 1000; step.scriptMs = (after.ScriptDuration - before.ScriptDuration) * 1000;
        step.finalPixelHash = await pixelHash(page); sample.steps.push(step); save();
        console.log(spec.name, i + 1, 'fills', step.drawnBlocks, 'first', Math.round(step.firstResponseMs), 'final', Math.round(step.finalCompletionMs), 'CPU', Math.round(step.cpuTaskMs));
        if (step.finalCompletionMs > 10000) { sample.stopped = 'bounded profiling after >10s final completion'; break; }
      }
      if (process.env.PERF_RESIZE && sample.steps.length) {
        if (sample.name === 'main-max-15') { fs.mkdirSync(path.join(__dirname, 'evidence'), { recursive: true }); await page.locator('.mosaic-container canvas').screenshot({ path: path.join(__dirname, 'evidence/after-desktop-14-canvas.png') }); }
        const before = await pixelHash(page); await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(350);
        const geometry = await page.locator('.mosaic-container canvas').evaluate(canvas => ({ bitmap: [canvas.width, canvas.height], box: [canvas.getBoundingClientRect().width, canvas.getBoundingClientRect().height] }));
        if (sample.name === 'main-max-15') await page.locator('.mosaic-container canvas').screenshot({ path: path.join(__dirname, 'evidence/after-mobile-390-14-canvas.png') });
        await page.setViewportSize({ width: 1440, height: 1000 }); await page.waitForTimeout(350); const restored = await pixelHash(page);
        sample.resize = { geometry, before, restored, sameHash: JSON.stringify(before) === JSON.stringify(restored) }; save();
      }
      await context.close();
    }
    if (process.env.PERF_CANCEL) {
      const { context, page, cdp, sample } = await newPage(browser, { name: 'restart-during-refinement', suffix: '', limit: 15, maxWrong: 14 });
      sample.pristineHash = await pixelHash(page); report.scenarios.push(sample); save();
      for (let i = 0; i < 13; i++) { await prepareGuess(page, wrong[i].干员); const index = await page.evaluate(() => window.__perf.clicks.length); await page.locator('.submit-button').click(); await finishGuess(page, index); }
      sample.conditions = 'Functional boundary QA only; synchronous mode click injected at first real scheduler.yield while busy. Excluded from performance comparison.';
      await prepareGuess(page, wrong[13].干员); await page.evaluate(() => { window.__perfRestartOnYield = true; }); await page.locator('.submit-button').click();
      await page.waitForFunction(() => window.__perfRestartFired && document.querySelector('.mosaic-container canvas')?.width > 0 && !document.querySelector('input[role=combobox]').disabled && document.querySelector('.attempts-counter')?.textContent.includes('0 / 15'));
      await page.waitForTimeout(600); sample.afterRestartHash = await pixelHash(page); sample.samePristineHash = JSON.stringify(sample.afterRestartHash) === JSON.stringify(sample.pristineHash);
      sample.finalState = await page.evaluate(() => ({ text: document.querySelector('.attempts-counter')?.textContent, busy: document.querySelector('.puzzle-board')?.getAttribute('aria-busy'), restartFired: window.__perfRestartFired, atRestart: window.__perfRestartState, lastClick: window.__perf.clicks.at(-1), commitsAfterRestart: window.__perf.commits.filter(item => item.time > window.__perfRestartFired) }));
      save(); if (sample.finalState.atRestart.busy !== 'true' || sample.finalState.atRestart.commitsSinceClick !== 0) throw new Error('restart timing did not exercise unfinished refinement'); if (!sample.samePristineHash) throw new Error('late refinement overwrote restarted pristine image'); await context.close();
    }
    if (process.env.PERF_RENDER_RESIZE) {
      const { context, page, sample } = await newPage(browser, { name: 'resize-during-staged-paint', suffix: '', limit: 15, maxWrong: 14 });
      report.scenarios.push(sample); save();
      for (let i = 0; i < 13; i++) { await prepareGuess(page, wrong[i].干员); const index = await page.evaluate(() => window.__perf.clicks.length); await page.locator('.submit-button').click(); await finishGuess(page, index); }
      sample.conditions = 'Functional boundary QA only; first staged-paint scheduler.yield paused until resize debounce has run. Artificial pause excluded from performance comparison.';
      await prepareGuess(page, wrong[13].干员); const index = await page.evaluate(() => { window.__perfPauseStagedPaint = true; return window.__perf.clicks.length; }); await page.locator('.submit-button').click();
      await page.waitForFunction(() => window.__perfPaintPaused);
      sample.resizeAt = await page.evaluate(index => ({ busy: document.querySelector('.puzzle-board')?.getAttribute('aria-busy'), inputDisabled: document.querySelector('input[role=combobox]')?.disabled, click: window.__perf.clicks[index], batches: window.__perf.batches.slice(window.__perf.clicks[index].batchIndex), commitsSinceClick: window.__perf.commits.length - window.__perf.clicks[index].commitIndex, time: performance.now() }), index);
      await page.setViewportSize({ width: 390, height: 844 });
      await page.waitForTimeout(180);
      sample.afterResizeDebounce = await page.evaluate(index => ({ busy: document.querySelector('.puzzle-board')?.getAttribute('aria-busy'), viewport: window.innerWidth, commitsSinceClick: window.__perf.commits.length - window.__perf.clicks[index].commitIndex, pausedAt: window.__perfPaintPaused, releaseAt: performance.now() }), index);
      if (sample.afterResizeDebounce.busy !== 'true' || sample.afterResizeDebounce.commitsSinceClick !== 0) throw new Error('staged-paint resize boundary was not exercised before commit');
      await page.evaluate(() => window.__perfReleasePaint());
      sample.completion = await finishGuess(page, index);
      sample.mobileGeometry = await page.locator('.mosaic-container canvas').evaluate(canvas => ({ bitmap: [canvas.width, canvas.height], box: [canvas.getBoundingClientRect().width, canvas.getBoundingClientRect().height], parent: [canvas.parentElement.getBoundingClientRect().width, canvas.parentElement.getBoundingClientRect().height] }));
      if (sample.mobileGeometry.bitmap[0] >= 390 || Math.abs(sample.mobileGeometry.box[0] / sample.mobileGeometry.box[1] - 1) > 0.01) throw new Error('resize during staged painting left stale desktop geometry');
      await page.setViewportSize({ width: 1440, height: 1000 }); await page.waitForTimeout(350);
      sample.restoredPixelHash = await pixelHash(page);
      const normalResults = process.env.PERF_REFERENCE ? JSON.parse(fs.readFileSync(process.env.PERF_REFERENCE)) : report;
      const expected = normalResults.scenarios.find(s => s.name === 'main-max-15')?.steps.at(-1)?.finalPixelHash;
      sample.matchesCompletedFourteenth = expected ? JSON.stringify(sample.restoredPixelHash) === JSON.stringify(expected) : null;
      save(); if (expected && !sample.matchesCompletedFourteenth) throw new Error('resize lost the in-progress fourteenth refinement');
      await context.close();
    }
    report.finished = new Date().toISOString(); save();
  } finally { await browser.close(); }
})().catch(error => { report.error = { message: error.message, stack: error.stack }; save(); console.error(error); process.exit(1); });
