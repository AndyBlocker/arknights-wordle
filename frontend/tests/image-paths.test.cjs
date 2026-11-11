const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function imagePaths(endpoint) {
  const source = fs.readFileSync(path.join(__dirname, '../src/utils/imageUtils.js'), 'utf8')
    .replace(/^import MD5 from [^;]+;\s*/m, '')
    .replace(/\bexport /g, '');
  const context = {
    process: { env: endpoint === undefined ? {} : { VUE_APP_MEDIA_ENDPOINT: endpoint } },
    MD5: value => crypto.createHash('md5').update(value).digest('hex'),
  };
  vm.createContext(context);
  vm.runInContext(source + '\nglobalThis.api = { MEDIA_ENDPOINT, getImagePath };', context);
  return context.api;
}

test('image paths default to the existing PRTS source and retain known original filename hashes', () => {
  const api = imagePaths();
  assert.equal(api.MEDIA_ENDPOINT, 'https://media.prts.wiki');
  assert.equal(api.getImagePath('立绘_铃兰_skin2.png'),
    'https://media.prts.wiki/e/e0/' + encodeURIComponent('立绘_铃兰_skin2.png'));
  assert.equal(api.getImagePath('立绘_铃兰_1.png'),
    'https://media.prts.wiki/f/f5/' + encodeURIComponent('立绘_铃兰_1.png'));
  assert.equal(imagePaths('').MEDIA_ENDPOINT, 'https://media.prts.wiki');
});

test('image paths accept a same-origin endpoint and normalize trailing slashes', () => {
  const filename = '立绘_铃兰_1.png';
  for (const endpoint of ['/arknights-wordle/media', '/arknights-wordle/media/', '/arknights-wordle/media///']) {
    const api = imagePaths(endpoint);
    assert.equal(api.MEDIA_ENDPOINT, '/arknights-wordle/media');
    assert.equal(api.getImagePath(filename), '/arknights-wordle/media/f/f5/' + encodeURIComponent(filename));
    assert.equal(new URL(api.getImagePath(filename), 'https://mer.dev/arknights-wordle/bw/').origin, 'https://mer.dev');
  }
  assert.equal(imagePaths('https://example.com/media///').MEDIA_ENDPOINT, 'https://example.com/media');
});

test('unicode and reserved filename characters are encoded after the original filename is hashed', () => {
  const api = imagePaths('/arknights-wordle/media/');
  const filename = '立绘_测试 #?+%/皮肤.png';
  const digest = crypto.createHash('md5').update(filename).digest('hex');
  const encoded = encodeURIComponent(filename);
  assert.notEqual(digest, crypto.createHash('md5').update(encoded).digest('hex'));
  assert.equal(api.getImagePath(filename), `/arknights-wordle/media/${digest[0]}/${digest.slice(0, 2)}/${encoded}`);
  const url = new URL(api.getImagePath(filename), 'https://mer.dev');
  assert.equal(url.search, '');
  assert.equal(url.hash, '');
  assert.equal(decodeURIComponent(url.pathname.split('/').at(-1)), filename);
});
