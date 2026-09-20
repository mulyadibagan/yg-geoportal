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
  assert.match(html, /id="publicLayerToggles"/);
  assert.match(script, /\/api\/drone\/public/);
  assert.match(script, /async function changePublication/);
  assert.match(script, /function renderPublicCatalogue/);
  assert.match(script, /Sembunyikan/);
  assert.match(script, /orthomosaic=/);
  assert.match(script, /data-map-layer/);
  assert.match(script, /function renderPublicLayerToggles/);
});

test('orthomosaic viewer converts JPEG YCbCr to natural RGB and hides only black no-data', () => {
  const script = read('js/drone-survey.js');
  assert.match(script, /function orthomosaicPixelColor/);
  assert.match(script, /PhotometricInterpretation===6/);
  assert.match(script, /v1\+1\.402\*\(v3-128\)/);
  assert.match(script, /v1-0\.34414\*\(v2-128\)-0\.71414\*\(v3-128\)/);
  assert.match(script, /v1\+1\.772\*\(v2-128\)/);
  assert.match(script, /pixelValuesToColorFn:values=>orthomosaicPixelColor\(values,isYCbCr\)/);
  assert.match(script, /r===0&&g===0&&b===0/);
  assert.doesNotMatch(script, /max<=20/);
  assert.match(script, /rgba\(0,0,0,0\)/);
});
