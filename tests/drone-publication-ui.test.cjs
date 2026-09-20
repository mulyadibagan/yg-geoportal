const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('drone page exposes explicit publication and a public layer catalogue', () => {
  const html = read('drone-survey.html');
  const script = read('js/drone-survey.js');
  assert.match(html, /id="publishResult"/);
  assert.match(html, /id="unpublishResult"/);
  assert.match(html, /id="publicOrthomosaicList"/);
  assert.match(script, /\/api\/drone\/public/);
  assert.match(script, /async function changePublication/);
  assert.match(script, /function renderPublicCatalogue/);
  assert.match(script, /Sembunyikan/);
  assert.match(script, /orthomosaic=/);
});

test('orthomosaic viewer makes neutral black background transparent', () => {
  const script = read('js/drone-survey.js');
  assert.match(script, /function orthomosaicPixelColor/);
  assert.match(script, /pixelValuesToColorFn:orthomosaicPixelColor/);
  assert.match(script, /max<=20&&max-min<=8/);
  assert.match(script, /rgba\(0,0,0,0\)/);
});
