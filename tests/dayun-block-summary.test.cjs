const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const details = JSON.parse(fs.readFileSync(path.join(root, 'data/dayun-gawangan-details.json'), 'utf8'));
const map = JSON.parse(fs.readFileSync(path.join(root, 'data/dayun-map.geojson'), 'utf8'));
const blocks = JSON.parse(fs.readFileSync(path.join(root, 'data/dayun-blocks.geojson'), 'utf8'));
const summary = require(path.join(root, 'js/dayun-agro-summary.js')).build(details, map, blocks);

test('ratoon harvest does not reduce the remaining main-crop population', () => {
  const revised = structuredClone(details);
  const crop = revised.objects.find(row => row.crops.some(crop => crop.crop === 'NANAS')).crops.find(crop => crop.crop === 'NANAS');
  crop.pineappleHarvest = [...(crop.pineappleHarvest || []), {period:'2026-09-17', count:100, cycle:'Ratoon I'}];
  const updated = require(path.join(root, 'js/dayun-agro-summary.js')).build(revised, map, blocks);
  assert.equal(updated.all.pineappleHarvest, summary.all.pineappleHarvest + 100);
  assert.equal(updated.all.pineappleUnharvested, summary.all.pineappleUnharvested);
});

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

test('MPTS and horticulture stay separate and trace back to gawangan profiles', () => {
  assert.deepEqual(require(path.join(root, 'js/dayun-agro-summary.js')).MPTS, ['RAMBUTAN', 'ASAM KANDIS', 'NANGKA', 'PETAI', 'JENGKOL']);
  assert.deepEqual(require(path.join(root, 'js/dayun-agro-summary.js')).HORTICULTURE, ['NANAS', 'TERONG', 'CABAI']);
  assert.equal(summary.all.mptsTypes, 5);
  assert.equal(summary.all.horticultureTypes, 3);
  assert.equal(Math.round(summary.all.horticulturePlants), 69299);
  assert.equal(summary.all.cropTotals.RAMBUTAN.gawanganIds.length, 12);
  assert.deepEqual(summary.all.cropTotals.RAMBUTAN.plantingPeriods, ['Jan 2024']);
  assert.equal(summary.blocks.B.cropTotals.RAMBUTAN.operationalAreaKnownCount, 0);
});

test('public map and block page use the shared aggregation source', () => {
  const mapHtml = fs.readFileSync(path.join(root, 'dayun-map.html'), 'utf8');
  const mapScript = fs.readFileSync(path.join(root, 'js/dayun-public.js'), 'utf8');
  const blockHtml = fs.readFileSync(path.join(root, 'dayun-blok.html'), 'utf8');
  const blockScript = fs.readFileSync(path.join(root, 'js/dayun-blok.js'), 'utf8');
  assert.match(mapHtml, /js\/dayun-agro-summary\.js/);
  assert.match(mapScript, /DayunAgroSummary\.build/);
  assert.match(mapScript, /dayun-blok\.html\?block=/);
  assert.match(mapScript, /HORTICULTURE/);
  assert.match(mapScript, /Periode tanam tercatat/);
  assert.match(blockHtml, /id="db-gawangan"/);
  assert.match(blockScript, /DayunAgroSummary\.build/);
  assert.match(blockScript, /dayun-gawangan\.html\?object=/);
  assert.match(blockScript, /dayun-sop-rambutan\.html/);
});
