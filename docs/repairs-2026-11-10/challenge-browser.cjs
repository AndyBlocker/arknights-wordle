const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('/tmp/arknights-browser-tools/node_modules/playwright-core');

const origin = process.env.REPAIR_URL || 'http://127.0.0.1:8817/arknights-wordle/';
const out = __dirname;
const snapshot = JSON.parse(fs.readFileSync(path.join(out, '../../frontend/public/data/operators.json'), 'utf8'));
const imageFixture = fs.readFileSync(path.join(out, '../../frontend/public/bg.jpg'));
const op = name => snapshot.find(row => row.干员 === name);
const results = { origin, started: new Date().toISOString(), conditions: 'Local production build. Controlled real-data subsets and deterministic selection; existing bg.jpg substitutes all external media responses (avatars and art) to remove external image-network variability. Fake clock is explicitly used for timeout/deadline/loading tests; this is not a production latency or image-content audit.', cases: [], screenshots: [], errors: [] };
const save = () => fs.writeFileSync(path.join(out, 'challenge-browser-results.json'), JSON.stringify(results, null, 2) + '\n');
let browser;
const selectedCase = process.env.REPAIR_CASE ? new RegExp(process.env.REPAIR_CASE) : null;
if (selectedCase && fs.existsSync(path.join(out, 'challenge-browser-results.json'))) {
  const previous = JSON.parse(fs.readFileSync(path.join(out, 'challenge-browser-results.json'), 'utf8'));
  results.cases = previous.cases.filter(item => !selectedCase.test(item.name));
  results.screenshots = previous.screenshots;
  results.errors = previous.errors;
}

async function state(page) {
  return page.evaluate(() => ({ text: document.body.innerText.slice(-12000), guesses: document.querySelectorAll('.result-row:not(.answer-row)').length, timer: document.querySelector('.timer-text')?.innerText, counters: [...document.querySelectorAll('.timer-text')].map(node => node.innerText), inputDisabled: document.querySelector('[role="combobox"]')?.disabled, canvases: [...document.querySelectorAll('canvas')].map(node => ({ width: node.width, height: node.height })) }));
}

async function click(page, locator) {
  await state(page);
  await locator.click();
}

async function shot(page, name) {
  await page.waitForTimeout(100);
  await page.screenshot({ path: path.join(out, 'screenshots', name + '.png'), fullPage: true, animations: 'disabled' });
  if (!results.screenshots.includes(name + '.png')) results.screenshots.push(name + '.png');
  save();
}

async function test(name, run) {
  if (selectedCase && !selectedCase.test(name)) return;
  try { results.cases.push({ name, status: 'PASS', ...await run() }); }
  catch (error) { results.cases.push({ name, status: 'FAIL', error: error.message, stack: error.stack }); }
  save();
}

async function open(names) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const rows = names.map(op);
  await context.route('**/data/operators.json', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows) }));
  let artRequests = [];
  let release;
  let blockAfterFirst = false;
  let blocked = [];
  const gate = new Promise(resolve => { release = resolve; });
  await context.route('**://media.prts.wiki/**', async route => {
    const file = decodeURIComponent(new URL(route.request().url()).pathname.split('/').pop());
    if (file.startsWith('立绘_')) {
      artRequests.push(file);
      if (blockAfterFirst && artRequests.length > 1) { blocked.push(file); await gate; }
    }
    try { await route.fulfill({ status: 200, contentType: 'image/jpeg', body: imageFixture }); }
    catch (error) { if (!context.pages().length) return; throw error; }
  });
  const page = await context.newPage();
  page.on('pageerror', error => { results.errors.push({ case: 'pageerror', message: error.message }); save(); });
  page.setDefaultTimeout(12000);
  await page.goto(origin, { waitUntil: 'domcontentloaded' });
  await page.getByRole('combobox').waitFor({ state: 'visible' });
  return { page, context, rows, artRequests, blocked, blockImages: () => { blockAfterFirst = true; }, releaseImages: release };
}

async function setup(page, mode, options = {}) {
  await click(page, page.locator('.challenge-btn'));
  await click(page, page.locator('.mode-card').filter({ hasText: mode }));
  await state(page);
  await page.locator('#challenge-question-count').fill('3');
  await page.locator('#challenge-question-time').fill('30');
  await page.locator('#challenge-max-guesses').fill('3');
  if (options.zero) {
    await click(page, page.getByRole('button', { name: '0潜', exact: true }));
    await click(page, page.getByRole('button', { name: '0信赖', exact: true }));
  }
  // The first question is the first controlled operator; cycle avoids duplicate-pick loops.
  await page.evaluate(() => { let index = 0; Math.random = () => [0.01, 0.35, 0.69][index++ % 3]; });
  await click(page, page.getByRole('button', { name: '开始挑战', exact: true }));
  await page.locator('.challenge-playing').waitFor({ state: 'visible' });
}

async function submit(page, name) {
  await state(page);
  await page.getByRole('combobox').fill(name);
  const option = page.locator('.suggestion-item').filter({ hasText: name }).first();
  await option.waitFor({ state: 'visible' });
  await click(page, option);
  await click(page, page.locator('.submit-button'));
}

(async () => {
  fs.mkdirSync(path.join(out, 'screenshots'), { recursive: true });
  browser = await chromium.launch({ headless: true, executablePath: '/home/andyblocker/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome', args: ['--no-sandbox'] });

  await test('three timed-out questions do not grant efficiency or speed achievements', async () => {
    const { page, context } = await open(['能天使', '银灰', '艾雅法拉']);
    await page.clock.install();
    await setup(page, '大头');
    for (let i = 0; i < 3; i++) await page.clock.runFor(33000);
    await page.locator('.questions-detail').waitFor({ state: 'visible' });
    const captured = await state(page);
    assert.match(captured.text, /0\s*\/\s*3/);
    assert.doesNotMatch(await page.locator('.achievements-section').allTextContents().then(items => items.join(' ')), /一击制胜|闪电快手/);
    await shot(page, 'challenge-all-timeout-no-false-achievement');
    await click(page, page.getByRole('button', { name: '再来一次', exact: true }));
    assert.equal(await page.locator('.challenge-setup').count(), 1);
    await context.close();
    return { controlled: true, state: captured };
  });

  await test('attempt exhaustion has correct wording and zero-potential zero-trust answer values', async () => {
    const { page, context } = await open(['12F', '夜刀', '杜林', '黑角']);
    await setup(page, '兔头', { zero: true });
    for (const name of ['夜刀', '杜林', '黑角']) await submit(page, name);
    const fail = await page.locator('.result-fail').innerText();
    assert.match(fail, /次数已用尽/);
    assert.doesNotMatch(fail, /时间到/);
    const attack = await page.locator('.answer-row [aria-label^="满级攻击："]').innerText();
    assert.match(attack, /432/);
    assert.doesNotMatch(attack, /506|494/);
    assert.equal(await page.locator('.challenge-game-board .reset-button').count(), 0, 'challenge must not expose the inert nested restart button');
    await shot(page, 'challenge-exhaustion-correct-answer-settings');
    const captured = await state(page);
    await context.close();
    return { controlled: true, failure: fail, answerAttack: attack, state: captured };
  });

  await test('correct answer submitted after the deadline cannot win', async () => {
    const { page, context } = await open(['能天使', '银灰', '艾雅法拉']);
    await page.clock.install();
    await setup(page, '大头');
    await page.getByRole('combobox').fill('能天使');
    await click(page, page.locator('.suggestion-item').filter({ hasText: '能天使' }).first());
    const now = await page.evaluate(() => Date.now());
    await page.clock.setSystemTime(now + 31000);
    // The deadline may already disable the button before Playwright's actionability check.
    // Attempt the stale click without waiting for a correctly disabled control to re-enable.
    await state(page);
    await page.locator('.submit-button').click({ force: true });
    const fail = await page.locator('.result-fail').innerText();
    assert.match(fail, /时间到/);
    assert.equal(await page.locator('.result-success').count(), 0);
    assert.equal(await page.locator('.result-row:not(.answer-row)').count(), 0);
    await shot(page, 'challenge-expired-correct-answer-is-timeout');
    const captured = await state(page);
    await context.close();
    return { controlled: true, state: captured };
  });

  await test('puzzle reuses first prepared art and waits for the next image before attempts or clock', async () => {
    const current = await open(['能天使', '银灰', '艾雅法拉']);
    const { page, context, artRequests, blocked } = current;
    await page.clock.install();
    await setup(page, '小头');
    await page.waitForFunction(() => document.querySelector('canvas')?.width > 0 && !document.querySelector('[role="combobox"]').disabled);
    assert.equal(artRequests.length, 1, 'prepared art must be consumed without a second selection or download');
    const prepared = artRequests[0];
    current.blockImages();
    await submit(page, '能天使');
    await page.clock.runFor(1600);
    await page.waitForFunction(() => document.querySelector('[role="combobox"]').disabled);
    await page.waitForTimeout(100);
    assert.ok(blocked.length >= 1, 'next image request must be held by the controlled network gate');
    const loading = await state(page);
    assert.equal(loading.guesses, 0);
    assert.equal(loading.inputDisabled, true);
    assert.match(loading.counters.join(' '), /0:30/);
    await page.clock.runFor(5000);
    const waiting = await state(page);
    assert.equal(waiting.guesses, 0);
    assert.match(waiting.counters.join(' '), /0:30/);
    await shot(page, 'challenge-image-loading-pauses-attempts-and-clock');
    current.releaseImages();
    await page.waitForFunction(() => document.querySelector('canvas')?.width > 0 && !document.querySelector('[role="combobox"]').disabled);
    await shot(page, 'challenge-next-image-ready');
    const ready = await state(page);
    await context.close();
    return { controlled: true, prepared, artRequests, blocked, loading, waiting, ready };
  });

  await browser.close();
  results.finished = new Date().toISOString();
  save();
  console.log(JSON.stringify(results.cases.map(item => ({ name: item.name, status: item.status, error: item.error })), null, 2));
  if (results.cases.some(item => item.status !== 'PASS') || results.errors.length) process.exitCode = 1;
})().catch(async error => {
  results.errors.push({ fatal: error.stack }); save(); console.error(error);
  if (browser) await browser.close();
  process.exitCode = 1;
});
