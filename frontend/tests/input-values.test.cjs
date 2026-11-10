const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const read = name => fs.readFileSync(path.join(__dirname, '../src', name), 'utf8');
function logic() {
  const src = read('logic/gameLogic.js').replace(/^import[^\n]+\n/m, read('logic/parseUtils.js').replace(/export /g, '') + '\n').replace(/export /g, '');
  const module = { exports: {} };
  vm.runInNewContext(src + '\nmodule.exports={preprocessOperators,getEffectiveValue,compareOperators};', { module, console });
  return module.exports;
}
function component(name, extra = {}) {
  const source = read(`components/${name}.vue`).split('<script>')[1].split('</script>')[0]
    .replace(/^import[^\n]*\n/gm, '').replace('export default', 'module.exports =');
  const module = { exports: {} };
  vm.runInNewContext(source, { module, console, ...extra });
  return module.exports;
}
function search(props = {}) {
  const timers = new Map(); let nextTimer = 1;
  const state = { operators: [{ 干员: '芬' }, { 干员: '阿米娅(医疗)' }, { 干员: 'GALLUS²' }], guessedOperators: [], disabled: false, ...props };
  const emitted = [];
  const api = component('GuessInput', {
    ref: value => ({ value }), computed: fn => ({ get value() { return fn(); } }),
    watch() {}, onMounted() {}, onBeforeUnmount() {}, nextTick: fn => fn(),
    setTimeout: fn => { const id = nextTimer++; timers.set(id, fn); return id; },
    clearTimeout: id => timers.delete(id),
    document: { addEventListener() {}, removeEventListener() {}, getElementById() { return null; } },
    pinyinCache: { isChinese: () => false, generatePinyinMap: () => ({}) },
    getOperatorAvatarFile() {}, getImagePath() {}, getRarityColor() {}
  }).setup(state, { emit: (event, name) => emitted.push({ event, name }) });
  return { api, state, emitted, flush() { const pending = [...timers.values()]; timers.clear(); pending.forEach(fn => fn()); } };
}

test('repeated potential attributes accumulate for all four affected operators', () => {
  const game = logic(); const data = JSON.parse(fs.readFileSync(path.join(__dirname, '../public/data/operators.json')));
  game.preprocessOperators(data);
  for (const [name, tag, value] of [['12F','满级攻击',506],['夜刀','满级攻击',280],['杜林','满级生命',1052],['黑角','满级生命',1760]]) {
    assert.equal(game.getEffectiveValue(data.find(op => op.干员 === name), tag, '满潜', '满信赖'), value);
  }
});

test('unknown height is not zero, while a real zero resistance remains comparable', () => {
  const game = logic(); const data = [{ 身高: '保密', 满级法术抗性: '0' }, { 身高: null, 满级法术抗性: '10' }, { 身高: '170cm', 满级法术抗性: 0 }];
  game.preprocessOperators(data);
  assert.equal(data[0].身高, null); assert.equal(data[2].身高, 170);
  assert.equal(game.getEffectiveValue(data[0], '身高'), null);
  const unknown = game.compareOperators(data[0], data[1], ['身高']).身高;
  assert.equal(unknown.unknown, true); assert.equal(unknown.match, false); assert.equal(unknown.direction, undefined);
  const resistance = game.compareOperators(data[0], data[2], ['满级法术抗性']).满级法术抗性;
  assert.equal(resistance.match, true); assert.equal(resistance.guessedValue, 0);
  assert.equal(game.compareOperators({ 种族: null }, { 种族: null }, ['种族']).种族.unknown, true);
});

test('birthdays distinguish complete, partial and absent matches; tag overlap retains its rules', () => {
  const game = logic(); const row = component('ResultRow', { getImagePath() {}, getOperatorAvatarFile() {} }).setup();
  const same = game.compareOperators({ 出生日期: '3月3日' }, { 出生日期: '3月3日' }, ['出生日期']).出生日期;
  const partial = game.compareOperators({ 出生日期: '3月3日' }, { 出生日期: '3月4日' }, ['出生日期']).出生日期;
  const different = game.compareOperators({ 出生日期: '3月3日' }, { 出生日期: '4月4日' }, ['出生日期']).出生日期;
  assert.equal(row.getTagCellClass(same), 'correct'); assert.equal(row.getTagCellClass(partial), 'partial'); assert.equal(row.getTagCellClass(different), 'incorrect');
  assert.equal(row.getTagCellClass({ correctTags: ['输出'], guessTags: ['输出', '治疗'] }), 'correct');
  assert.equal(row.getNumericCellClass({ unknown: true }), 'unknown');
  assert.match(row.getComparisonLabel('身高', { unknown: true, guessedValue: null }), /未知.*不可比较/);
});

test('submitting clears cached results and an empty second Enter cannot emit again', () => {
  const { api, emitted, flush } = search();
  api.searchTerm.value = '芬'; api.onSearchInput(); api.submitSelectedOperator(); api.submitSelectedOperator(); flush();
  assert.equal(emitted.length, 1); assert.equal(emitted[0].name, '芬');
  assert.equal(api.searchTerm.value, ''); assert.equal(api.filteredOperators.value.length, 0); assert.equal(api.suggestionsOpen.value, false);
});

test('clearing a query cancels delayed results and disabled/guessed inputs never submit', () => {
  const { api, state, emitted, flush } = search();
  api.searchTerm.value = '阿米娅'; api.onSearchInput(); api.searchTerm.value = ''; api.onSearchInput(); flush();
  assert.equal(api.filteredOperators.value.length, 0);
  api.searchTerm.value = '芬'; state.disabled = true; api.onSearchInput(); api.submitSelectedOperator();
  assert.equal(emitted.length, 0); state.disabled = false; state.guessedOperators = [{ 干员: '芬' }]; api.submitSelectedOperator();
  assert.equal(emitted.length, 0);
});

test('Enter resolves a current long query before its debounce and preserves canonical names', () => {
  for (const name of ['阿米娅(医疗)', 'GALLUS²']) {
    const { api, emitted, flush } = search(); api.searchTerm.value = name; api.onSearchInput(); api.submitSelectedOperator(); flush();
    assert.equal(emitted.length, 1); assert.equal(emitted[0].name, name); assert.equal(api.filteredOperators.value.length, 0);
  }
});
