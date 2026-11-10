const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const read = name => fs.readFileSync(path.join(__dirname, '../src', name), 'utf8');

function loader(fetch) {
  const timers = [];
  const context = {
    AbortController, fetch, errorHandler: { handleError() {} },
    setTimeout: fn => { const timer = { fn, cleared: false }; timers.push(timer); return timer; },
    clearTimeout: timer => { timer.cleared = true; },
  };
  const source = read('utils/dataLoader.js').replace(/^import[^\n]+\n/m, '').replace(/\bexport /g, '');
  const load = vm.runInNewContext(source + '\nloadOperatorsData;', context);
  return { load, timers };
}

test('the data deadline remains active after headers and aborts a stalled body', async () => {
  let markBodyReady;
  const bodyReady = new Promise(resolve => { markBodyReady = resolve; });
  const { load, timers } = loader(async (_url, options) => ({
    ok: true, headers: { get: () => 'application/json' },
    json: () => new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => {
        const error = new Error('aborted'); error.name = 'AbortError'; reject(error);
      });
      markBodyReady();
    }),
  }));
  const promise = load();
  await bodyReady;
  assert.equal(timers[0].cleared, false);
  timers[0].fn();
  await assert.rejects(promise, /超时/);
  assert.equal(timers[0].cleared, true);
});

test('HTTP failures are visible, and every operator is validated before use', async () => {
  const failed = loader(async () => ({ ok: false, status: 503 }));
  await assert.rejects(failed.load(), /503/);
  assert.equal(failed.timers[0].cleared, true);
  const operator = { 干员: '芬', 稀有度: '2', 职业: '先锋' };
  for (const rows of [[operator, {}], [operator, operator]]) {
    const { load } = loader(async () => ({
      ok: true, headers: { get: () => 'application/json' }, json: async () => rows,
    }));
    await assert.rejects(load(), /结构错误|重复/);
  }
});

test('the parent rejects duplicates, ended games, and guesses made before puzzle readiness', () => {
  const source = read('App.vue');
  const block = source.slice(source.indexOf('const makeGuess ='), source.indexOf('const giveUpGame ='));
  const operator = { 干员: '芬' };
  const state = {
    loading: { value: false }, isInChallengeMode: { value: false },
    targetOperator: { value: { 干员: '能天使' } }, filteredOperators: { value: [operator] },
    guesses: { value: [] }, comparisons: { value: [] }, maxGuesses: { value: 3 },
    gameOver: { value: false }, gameWon: { value: false }, userGaveUp: { value: false },
    selectedTagGroup: { value: { id: 'hard', tags: [] } }, puzzleLoadState: { value: 'ready' },
    potentialMode: { value: '满潜' }, trustMode: { value: '满信赖' },
    compareOperators: () => ({}), showToast() {},
  };
  const submit = vm.runInNewContext(block + '\nmakeGuess;', state);
  submit('芬'); submit('芬');
  assert.equal(state.guesses.value.length, 1);
  state.guesses.value = []; state.gameOver.value = true; submit('芬');
  assert.equal(state.guesses.value.length, 0);
  state.gameOver.value = false; state.selectedTagGroup.value.id = 'puzzle';
  state.puzzleLoadState.value = 'error'; submit('芬');
  assert.equal(state.guesses.value.length, 0);
  state.puzzleLoadState.value = 'ready'; state.targetOperator.value = null; submit('芬');
  assert.equal(state.guesses.value.length, 0);
});

test('attempt limit changes recalculate the terminal state in both modes without undoing give-up', () => {
  const block = read('App.vue').match(/watch\(maxGuesses, \(\) => \{[\s\S]*?\n {4}\}\);/)[0];
  const state = {
    maxGuesses: { value: 6 }, guesses: { value: [{}, {}] }, gameOver: { value: true },
    gameWon: { value: false }, userGaveUp: { value: false }, watch: (_ref, fn) => fn(),
  };
  vm.runInNewContext(block, state); assert.equal(state.gameOver.value, false);
  state.maxGuesses.value = 1; vm.runInNewContext(block, state); assert.equal(state.gameOver.value, true);
  state.userGaveUp.value = true; state.maxGuesses.value = 6;
  vm.runInNewContext(block, state); assert.equal(state.gameOver.value, true);
});

test('the mobile boot overlay is removed even after data failure and a retry can succeed', async () => {
  const source = read('MobilePuzzleApp.vue');
  const block = source.slice(source.indexOf('const initGame ='), source.indexOf('// 开始新游戏'));
  const overlay = { style: {} }; const classes = new Set(); let fail = true; let started = 0;
  const state = {
    loading: { value: true }, loadError: { value: '' }, operators: { value: [] },
    loadOperatorsData: async () => { if (fail) throw new Error('HTTP 503'); return [{ 干员: '芬' }]; },
    preprocessOperators() {}, startNewGame: () => started++, nextTick: async () => {},
    document: { getElementById: id => id === 'loading-screen' ? overlay : { classList: { add: name => classes.add(name) } } },
  };
  const init = vm.runInNewContext(block + '\ninitGame;', state);
  await init(); assert.equal(state.loading.value, false); assert.match(state.loadError.value, /503/);
  assert.equal(overlay.style.display, 'none'); assert.ok(classes.has('loaded'));
  fail = false; await init(); assert.equal(state.loadError.value, ''); assert.equal(started, 1);
});
