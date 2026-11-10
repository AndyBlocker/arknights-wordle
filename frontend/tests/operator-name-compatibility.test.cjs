const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const appFile = process.env.ARKNIGHTS_APP_FILE || path.join(__dirname, '../src/App.vue');
const appSource = fs.readFileSync(appFile, 'utf8');
const validatorSource = fs.readFileSync(path.join(__dirname, '../src/utils/validator.js'), 'utf8');
const InputValidator = vm.runInNewContext(
  `${validatorSource.replace(/\bexport /g, '')}\nInputValidator;`,
  { setTimeout, clearTimeout }
);
const guessSource = appSource.slice(
  appSource.indexOf('const makeGuess ='),
  appSource.indexOf('const giveUpGame =')
);

// Exercise the actual submission handler without installing or mounting Vue.
function createGame(operators, mode = 'normal') {
  const state = {
    loading: { value: false },
    isInChallengeMode: { value: false },
    userGaveUp: { value: false },
    puzzleLoadState: { value: 'ready' },
    filteredOperators: { value: operators },
    targetOperator: { value: operators[0] },
    selectedTagGroup: { value: { id: mode, tags: [] } },
    guesses: { value: [] },
    comparisons: { value: [] },
    potentialMode: { value: false },
    trustMode: { value: false },
    maxGuesses: { value: 10 },
    gameWon: { value: false },
    gameOver: { value: false },
    messages: []
  };
  const submit = vm.runInNewContext(`${guessSource}\nmakeGuess;`, {
    ...state,
    InputValidator,
    showToast: (message) => state.messages.push(message),
    compareOperators: (guess, target) => ({ guess, target })
  });
  return { ...state, submit };
}

for (const mode of ['normal', 'puzzle']) {
  test(`canonical GALLUS² can be submitted and win in ${mode} mode`, () => {
    const operator = { 干员: 'GALLUS²' };
    const game = createGame([operator], mode);
    game.submit('GALLUS²');
    assert.equal(game.guesses.value[0], operator);
    assert.equal(game.gameWon.value, true);
    assert.equal(game.messages.length, 0);
    assert.equal(game.comparisons.value.length, mode === 'normal' ? 1 : 0);
  });
}

test('existing names with and without a middle dot still resolve', () => {
  for (const name of ['维娜·维多利亚', '维娜维多利亚']) {
    const operator = { 干员: '维娜·维多利亚' };
    const game = createGame([operator]);
    game.submit(name);
    assert.equal(game.guesses.value[0], operator);
    assert.equal(game.messages.length, 0);
  }
});

test('canonical Amiya class names preserve parentheses', () => {
  for (const name of ['阿米娅(近卫)', '阿米娅(医疗)']) {
    const operator = { 干员: name };
    const game = createGame([operator]);
    game.submit(name);
    assert.equal(game.guesses.value[0], operator);
    assert.equal(game.gameWon.value, true);
    assert.equal(game.messages.length, 0);
  }
});

test('unknown and malformed input cannot create a guess', () => {
  for (const name of ['不是干员', 'GALLUS', '<script>alert(1)</script>', null, {}]) {
    const game = createGame([{ 干员: 'GALLUS²' }]);
    game.submit(name);
    assert.equal(game.guesses.value.length, 0);
    assert.equal(game.gameWon.value, false);
    assert.equal(game.messages.length, 1);
  }
});

test('exact matching respects the active candidate filter', () => {
  const game = createGame([{ 干员: '能天使' }]);
  game.submit('GALLUS²');
  assert.equal(game.guesses.value.length, 0);
  assert.equal(game.messages.length, 1);
});
