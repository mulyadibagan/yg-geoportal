const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const details = JSON.parse(fs.readFileSync(path.join(root, 'data/dayun-gawangan-details.json'), 'utf8'));
const map = JSON.parse(fs.readFileSync(path.join(root, 'data/dayun-map.geojson'), 'utf8'));
const blocks = JSON.parse(fs.readFileSync(path.join(root, 'data/dayun-blocks.geojson'), 'utf8'));
const summary = require(path.join(root, 'js/dayun-agro-summary.js')).build(details, map, blocks);

test('estate summary is the sum of block summaries built from unique gawangan', () => {
  assert.deepEqual(summary.codes, ['A', 'B', 'C', 'D', 'E', 'F']);
  assert.equal(summary.all.mappedGawangan, 60);
  assert.equal(summary.all.gawanganWithData, 59);
  assert.deepEqual(summary.all.missingGawangan, ['DAYUN-GT-B-15']);
  assert.equal(summary.codes.reduce((total, code) => total + summary.blocks[code].mappedGawangan, 0), 60);
  assert.equal(summary.codes.reduce((total, code) => total + summary.blocks[code].pineappleHarvest, 0), summary.all.pineappleHarvest);
  assert.equal(summary.codes.reduce((total, code) => total + summary.blocks[code].mptsPlants, 0), summary.all.mptsPlants);
});

test('operational area is counted once per gawangan and never exceeds summed crop areas', () => {
  for (const code of summary.codes) {
    const block = summary.blocks[code];
    const summedCropArea = Object.values(block.cropTotals).reduce((total, crop) => total + crop.operationalAreaHa, 0);
    assert.ok(block.operationalAreaHa <= summedCropArea + 1e-9, code);
    assert.ok(block.gawanganAreaHa <= block.blockAreaHa + 1e-9, code);
  }
});

test('public map and block page use the shared aggregation source', () => {
  const mapHtml = fs.readFileSync(path.join(root, 'dayun-map.html'), 'utf8');
  const mapScript = fs.readFileSync(path.join(root, 'js/dayun-public.js'), 'utf8');
  const blockHtml = fs.readFileSync(path.join(root, 'dayun-blok.html'), 'utf8');
  const blockScript = fs.readFileSync(path.join(root, 'js/dayun-blok.js'), 'utf8');
  assert.match(mapHtml, /js\/dayun-agro-summary\.js/);
  assert.match(mapScript, /DayunAgroSummary\.build/);
  assert.match(mapScript, /dayun-blok\.html\?block=/);
  assert.match(blockHtml, /id="db-gawangan"/);
  assert.match(blockScript, /DayunAgroSummary\.build/);
  assert.match(blockScript, /dayun-gawangan\.html\?object=/);
});
