const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const read = (file) => fs.readFileSync(path.join(__dirname, '../src', file), 'utf8');
const strip = (source) => source.replace(/^import .*;\s*$/gm, '').replace(/\bexport /g, '');
const quiet = { log() {}, warn() {}, error() {} };
const timing = vm.runInNewContext(`${strip(read('logic/challengeTiming.js'))}\n({getQuestionDeadline,getRemainingSeconds,getElapsedSeconds,formatElapsedTime});`);
let loadCalls = [];
let choice = 0;
const services = vm.runInNewContext(`${strip(read('logic/challengeService.js'))}\n({calculateChallengeScore,generateChallengeQuestions});`, {
  console: quiet, Date, window: { innerWidth: 390 },
  selectRandomOperator: (operators) => operators[(choice++) % operators.length],
  loadPuzzleImage: async (operator, width, height, viewport, sessionId) => {
    loadCalls.push({ operator, sessionId });
    return { operatorName: operator.干员, gameSessionId: sessionId, selectedArt: 'chosen.png', integralData: {}, originalImageData: {} };
  }
});
const Checker = vm.runInNewContext(`${strip(read('logic/achievementConfig.js'))}\n${strip(read('logic/achievementChecker.js'))}\nAchievementChecker;`, { console: quiet, Date });
const settings = { timePerQuestion: 30, maxGuesses: 6, onlySixStar: false };

test('zero and subsecond correct answers retain the fastest existing reward tier', () => {
  const score = (seconds) => services.calculateChallengeScore(true, seconds, 1, settings);
  assert.equal(score(0), score(1));
  assert.equal(score(0.5), score(1));
  const values = [0, 0.5, 1, 10, 10.1, 30, 30.1, 60, 60.1, 120, 120.1].map(score);
  for (let i = 1; i < values.length; i++) assert.ok(values[i] <= values[i - 1]);
  assert.equal(services.calculateChallengeScore(false, 1, 1, settings), 0);
});

test('elapsed time displays zero and five-plus minutes as durations', () => {
  for (const [seconds, expected] of [[0, '0秒'], [1, '1秒'], [59.8, '1:00'], [299, '4:59'], [300, '5:00'], [360, '6:00']]) {
    assert.equal(timing.formatElapsedTime(seconds), expected);
  }
});

test('throttled timer callbacks still observe the real question deadline', () => {
  const deadline = timing.getQuestionDeadline(1000, 30);
  assert.equal(timing.getRemainingSeconds(deadline, 32000), 0);
  assert.equal(timing.getRemainingSeconds(deadline, 1500), 30);
  assert.equal(timing.getQuestionDeadline(1000, 300), Infinity);
});

function complete(results) {
  const checker = new Checker();
  for (const result of results) {
    checker.startQuestion();
    for (let i = 0; i < result.guesses.length; i++) {
      const correct = result.isCorrect && i === result.guesses.length - 1;
      checker.processGuess({ 干员: '候选', 种族: '其他' }, correct, { 干员: '答案', 种族: '其他' });
    }
    checker.completeQuestion(result.timeUsed, result.guesses.length);
  }
  checker.completeChallenge(results);
  return checker;
}

test('zero guesses and failed questions cannot dilute the efficiency achievement', () => {
  const failed = { isCorrect: false, timeUsed: 30, guesses: [] };
  const won = { isCorrect: true, timeUsed: 1, guesses: [{}] };
  for (const results of [[failed, failed, failed], [won, failed, failed], []]) {
    const ids = complete(results).checkFinalAchievements().map(item => item.id);
    assert.ok(!ids.includes('efficient'));
    if (!results.some(item => item.isCorrect)) assert.ok(!ids.includes('speedster'));
  }
  const checker = complete([won, { ...won, guesses: [{}, {}] }, { ...won, guesses: [{}, {}, {}] }]);
  assert.equal(checker.getStats().averageGuesses, 2);
  assert.ok(checker.checkFinalAchievements().some(item => item.id === 'efficient'));
});

test('challenge prepares only the first puzzle using the same unique question session', async () => {
  loadCalls = [];
  const operators = [{ 干员: '甲', 星级: 6 }, { 干员: '乙', 星级: 6 }, { 干员: '丙', 星级: 6 }];
  const options = { ...settings, gameMode: 'puzzle', questionCount: 3 };
  const first = await services.generateChallengeQuestions(operators, options);
  assert.equal(loadCalls.length, 1);
  assert.equal(first[0].sessionId, loadCalls[0].sessionId);
  assert.equal(first[0].puzzleAssets.gameSessionId, first[0].sessionId);
  assert.ok(!first[1].puzzleAssets && !first[2].puzzleAssets);
  const second = await services.generateChallengeQuestions(operators, options);
  assert.notEqual(first[0].sessionId, second[0].sessionId);
  const wrapper = read('components/ChallengeGameWrapper.vue');
  assert.match(wrapper, /:gameSessionId="question.sessionId"/);
  assert.match(wrapper, /:puzzleHintInterval="settings.puzzleHintInterval \|\| 3"/);
  assert.match(wrapper, /:potentialMode="settings.potentialMode \|\| '满潜'"/);
});

function createBoard(generator) {
  let now = 1000;
  let timerId = 0;
  let cleanup;
  const intervals = new Map();
  const timeouts = new Map();
  const listeners = new Map();
  const operators = Array.from({ length: 7 }, (_, index) => ({ 干员: String(index), 星级: 6 }));
  const script = read('components/ChallengeBoard.vue').match(/<script>([\s\S]*?)<\/script>/)[1]
    .replace(/^import .*;\s*$/gm, '').replace('export default', 'const component =');
  const checker = new Checker();
  const component = vm.runInNewContext(script + '\ncomponent;', {
    ref: (value) => ({ value }),
    computed: (getter) => ({ get value() { return getter(); } }),
    onBeforeUnmount: (fn) => { cleanup = fn; },
    Date: { now: () => now },
    document: { addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name) },
    setInterval: (fn) => { const id = ++timerId; intervals.set(id, fn); return id; },
    clearInterval: (id) => intervals.delete(id),
    setTimeout: (fn) => { const id = ++timerId; timeouts.set(id, fn); return id; },
    clearTimeout: (id) => timeouts.delete(id),
    ...timing,
    generateChallengeQuestions: generator || (async () => operators.slice(0, 3).map((targetOperator, i) => ({ id: `q_${i}`, targetOperator, sessionId: `test_${i}` }))),
    calculateChallengeScore: services.calculateChallengeScore,
    compareOperators: () => ({}),
    achievementChecker: checker,
    achievementEmitter: { reset() {}, emitAchievements() {} },
    ChallengeResult: {}, ChallengeGameWrapper: {}, console: quiet
  });
  const board = component.setup({ operators }, { emit() {} });
  board.challengeSettings.value.timePerQuestion = 30;
  board.challengeSettings.value.maxGuesses = 3;
  return { board, operators, intervals, timeouts, listeners, setNow: value => { now = value; }, cleanup: () => cleanup() };
}

test('an expired correct submission settles timeout only once, even before the next timer callback', async () => {
  const { board, setNow, timeouts, cleanup } = createBoard();
  await board.startChallenge();
  setNow(32000);
  board.handleGuess('0');
  assert.equal(board.challengeResults.value.length, 1);
  assert.equal(board.challengeResults.value[0].isCorrect, false);
  assert.equal(board.challengeResults.value[0].endReason, 'timeout');
  assert.equal(board.challengeResults.value[0].timeUsed, 30);
  assert.equal(board.currentGuesses.value.length, 0);
  board.handleGuess('0');
  assert.equal(board.challengeResults.value.length, 1);
  const staleTransition = [...timeouts.values()][0];
  board.nextQuestion();
  staleTransition();
  assert.equal(board.currentQuestionIndex.value, 1);
  cleanup();
});

test('duplicate guesses do not consume attempts, exhaustion has its own reason, restart cleans timers', async () => {
  const { board, intervals, timeouts, listeners, cleanup } = createBoard();
  await board.startChallenge();
  board.handleGuess('1');
  board.handleGuess('1');
  assert.equal(board.currentGuesses.value.length, 1);
  board.handleGuess('2');
  board.handleGuess('3');
  assert.equal(board.endReason.value, 'guesses-exhausted');
  assert.equal(board.challengeResults.value.length, 1);
  board.restartChallenge();
  assert.equal(intervals.size, 0);
  assert.equal(timeouts.size, 0);
  assert.equal(board.challengePhase.value, 'setup');
  cleanup();
  assert.equal(listeners.size, 0);
});


test('late preparation after unmount cannot start a new challenge or timers', async () => {
  let resolve;
  const prepared = new Promise(done => { resolve = done; });
  const { board, intervals, cleanup } = createBoard(() => prepared);
  const start = board.startChallenge();
  assert.equal(board.challengePhase.value, 'preparing');
  cleanup();
  resolve([{ id: 'q_0', targetOperator: { 干员: '0' } }]);
  await start;
  assert.equal(intervals.size, 0);
  assert.equal(board.currentQuestion.value, null);
});


test('puzzle attempts and the configured timer wait for a usable image and pause during retry', async () => {
  const { board, setNow, cleanup } = createBoard();
  board.challengeSettings.value.gameMode = 'puzzle';
  await board.startChallenge();
  setNow(32000);
  board.handleGuess('0');
  assert.equal(board.challengeResults.value.length, 0);
  assert.equal(board.currentGuesses.value.length, 0);
  board.onPuzzleLoadState('ready');
  assert.equal(board.timeLeft.value, 30);
  setNow(37000);
  board.onPuzzleLoadState('error');
  assert.equal(board.timeLeft.value, 25);
  setNow(137000);
  board.onPuzzleLoadState('ready');
  assert.equal(board.timeLeft.value, 25);
  setNow(163000);
  board.handleGuess('0');
  assert.equal(board.challengeResults.value[0].endReason, 'timeout');
  assert.equal(board.challengeResults.value[0].timeUsed, 30);
  cleanup();
});
