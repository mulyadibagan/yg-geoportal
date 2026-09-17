const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const details = JSON.parse(fs.readFileSync(path.join(root, 'data/dayun-gawangan-details.json'), 'utf8'));
const moduleApi = require(path.join(root, 'js/dayun-pineapple-analysis.js'));
const analysis = moduleApi.build(details, {asOf: new Date('2026-09-17T00:00:00Z')});

test('pineapple analysis is derived from every pineapple gawangan record', () => {
  assert.equal(analysis.rows.length, 58);
  assert.equal(analysis.all.activeGawangan, 35);
  assert.equal(Math.round(analysis.all.plants), 67941);
  assert.equal(Math.round(analysis.all.areaHa * 100) / 100, 5.96);
  assert.equal(analysis.all.harvest, 14541);
  assert.equal(analysis.all.ethrel, 25281);
  assert.equal(analysis.all.flowers, 2685);
  assert.deepEqual(analysis.all.varieties, {Queen: 58});
});

test('block totals reconcile with the whole estate', () => {
  for (const key of ['plants', 'areaHa', 'harvest', 'ethrel', 'flowers']) {
    const sum = analysis.blockCodes.reduce((total, code) => total + analysis.blocks[code][key], 0);
    assert.ok(Math.abs(sum - analysis.all[key]) < 1e-9, key);
  }
  assert.equal(analysis.blocks.A.activeGawangan, 15);
  assert.equal(analysis.blocks.B.activeGawangan, 13);
  assert.equal(analysis.blocks.C.activeGawangan, 7);
  assert.equal(analysis.blocks.D.activeGawangan, 0);
});

test('recommendations never turn age alone into an automatic ethrel instruction', () => {
  const ageOnly = moduleApi.recommendation({plants:100, plantingPeriod:'Jan 2025', ageMonths:20, flowers:0, ethrel:0});
  assert.equal(ageOnly.code, 'ethrel-check');
  assert.match(ageOnly.label, /Periksa kelayakan/);
  assert.match(ageOnly.detail, /lebih dari 30 daun/);
  assert.doesNotMatch(ageOnly.detail, /aplikasikan|wajib/i);
});

test('six-month projections separate harvest scenarios from ethrel inspections', () => {
  const projection = moduleApi.buildProjection(analysis.rows, {asOf:new Date('2026-09-17T00:00:00Z'), horizonMonths:6});
  assert.equal(projection.months.length, 6);
  assert.equal(projection.months[0].period, '2026-09-01');
  assert.equal(projection.assumptions.flowerCount, 2685);
  assert.equal(projection.assumptions.datedEthrel, 21756);
  assert.equal(projection.assumptions.undatedEthrel, 3525);
  assert.equal(projection.assumptions.stalenessMonths, 3);
  assert.equal(projection.assumptions.harvestConfidence, 'Rendah');
  const harvest = projection.months.reduce((total, item) => ({
    low: total.low + item.harvest.low,
    base: total.base + item.harvest.base,
    high: total.high + item.harvest.high
  }), {low:0, base:0, high:0});
  assert.deepEqual(harvest, {low:1236, base:1544, high:1853});
  assert.equal(projection.months[0].ethrel.gawangan, 16);
  assert.equal(projection.months[0].ethrel.plants, 19102);
  assert.equal(projection.months[2].ethrel.gawangan, 1);
  assert.equal(projection.months[2].ethrel.plants, 5635);
});

test('fertilizer projection uses SOP phases but remains explicitly indicative', () => {
  const projection = moduleApi.buildProjection(analysis.rows, {asOf:new Date('2026-09-17T00:00:00Z'), horizonMonths:6});
  assert.equal(projection.months[0].fertilizer.phases.verification, 16);
  assert.equal(projection.months[0].fertilizer.phases.phase3, 14);
  assert.equal(projection.months[1].fertilizer.phases.phase2, 1);
  assert.equal(projection.months[1].fertilizer.materials.urea.lowKg, 97.74);
  assert.equal(projection.months[1].fertilizer.materials.npk.lowKg, 48.87);
  assert.equal(projection.months[1].fertilizer.materials.npk.highKg, 65.16);
  assert.equal(projection.assumptions.fertilizerConfidence, 'Rendah');
});

test('analysis page and map expose the Queen commodity entry point and field safeguards', () => {
  const page = fs.readFileSync(path.join(root, 'dayun-analisis-nanas.html'), 'utf8');
  const script = fs.readFileSync(path.join(root, 'js/dayun-analisis-nanas.js'), 'utf8');
  const map = fs.readFileSync(path.join(root, 'dayun-map.html'), 'utf8');
  assert.match(page, /Nanas Queen Dayun/);
  assert.match(page, /id="pa-data-date"/);
  assert.match(page, /Nanas Madu belum dimasukkan/);
  assert.match(page, /PROYEKSI PANEN/);
  assert.match(page, /PROYEKSI ETHREL/);
  assert.match(page, /PROYEKSI PEMUPUKAN/);
  assert.match(script, /Verifikasi riwayat pupuk/);
  assert.match(script, /Ini daftar pemeriksaan, bukan perintah aplikasi/);
  assert.match(script, /dayun-hpt-nanas\.html/);
  assert.match(script, /dayun-gawangan\.html\?object=/);
  assert.match(script, /buildProjection/);
  assert.match(script, /open-meteo\.com/);
  assert.match(map, /id="dayun-pineapple-entry"/);
});
