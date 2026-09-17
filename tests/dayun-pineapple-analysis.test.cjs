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
  assert.equal(analysis.all.plantCropHarvest, 14541);
  assert.equal(analysis.all.ratoonHarvest, 0);
  assert.equal(Math.round(analysis.all.remainingPlantCrop), 53400);
  assert.equal(analysis.all.ethrel, 25281);
  assert.equal(analysis.all.flowers, 2685);
  assert.deepEqual(analysis.all.varieties, {Queen: 58});
});

test('block totals reconcile with the whole estate', () => {
  for (const key of ['plants', 'areaHa', 'harvest', 'plantCropHarvest', 'ratoonHarvest', 'remainingPlantCrop', 'ratoonShoots', 'ethrel', 'flowers']) {
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

test('twelve-month projections separate harvest scenarios from ethrel inspections', () => {
  const projection = moduleApi.buildProjection(analysis.rows, {asOf:new Date('2026-09-17T00:00:00Z')});
  assert.equal(projection.months.length, 12);
  assert.equal(projection.months[0].period, '2026-09-01');
  assert.equal(projection.months[11].period, '2027-08-01');
  assert.equal(projection.assumptions.flowerCount, 2295);
  assert.equal(projection.assumptions.remainingPlantCrop, 53400);
  assert.equal(projection.assumptions.inducedPending, 13502);
  assert.equal(projection.assumptions.vegetativePending, 37603);
  assert.equal(projection.assumptions.ratoonCandidatePool, 14541);
  assert.equal(projection.assumptions.unverifiedRatoonCandidates, 14541);
  assert.equal(projection.assumptions.scheduledRatoonCandidates, 14541);
  assert.equal(projection.assumptions.verifiedRatoonShoots, 0);
  assert.equal(projection.assumptions.datedEthrel, 21756);
  assert.equal(projection.assumptions.undatedEthrel, 3525);
  assert.equal(projection.assumptions.stalenessMonths, 3);
  assert.equal(projection.assumptions.harvestConfidence, 'Rendah');
  const harvest = projection.months.reduce((total, item) => ({
    low: total.low + item.harvest.low,
    base: total.base + item.harvest.base,
    high: total.high + item.harvest.high
  }), {low:0, base:0, high:0});
  assert.deepEqual(harvest, {low:28934, base:39438, high:51401});
  for (const item of projection.months) {
    for (const scenario of ['low', 'base', 'high']) {
      assert.equal(item.harvest[scenario], item.harvest.confirmed[scenario] + item.harvest.mainCropPotential[scenario] + item.harvest.ratoon[scenario]);
      assert.equal(item.harvest.ratoon[scenario], item.harvest.ratoonCandidate[scenario] + item.harvest.ratoonVerified[scenario]);
    }
  }
  assert.equal(projection.months[0].ethrel.gawangan, 16);
  assert.equal(projection.months[0].ethrel.plants, 17951);
  assert.equal(projection.months[2].ethrel.gawangan, 1);
  assert.equal(projection.months[2].ethrel.plants, 5635);
});

test('published main-crop and ratoon monitoring are integrated without double counting', () => {
  const source = {objects:[{objectId:'DAYUN-GT-A-01',block:'A',gawangan:1,crops:[{crop:'NANAS',variety:'Queen',plantingDate:'Sep 2025',vegetationCount:100,operationalAreaHa:0.1,pineappleHarvest:[],ethrel:[]}]}]};
  const info = {monitoringType:'Agroforestri Dayun',activityType:'Panen',crop:'NANAS',eventDate:'2026-09-17',activityDetails:{harvestCycle:'Panen utama',harvestCount:30,unit:'buah',ratoonStatus:'Dipertahankan untuk ratoon',ratoonMotherStands:25,ratoonShootCount:20,ratoonStartDate:'2026-09-17',ratoonDiscardedCount:5}};
  const payload = {features:[{properties:{targetLayerId:'dayun_gawangan',targetObjectId:'DAYUN-GT-A-01',proposedInformation:JSON.stringify(info)}},{properties:{targetLayerId:'dayun_gawangan',targetObjectId:'DAYUN-GT-A-01',proposedInformation:JSON.stringify(info)}}]};
  const merged = moduleApi.applyPublishedMonitoring(source,payload);
  const integrated = moduleApi.build(merged,{asOf:new Date('2026-09-17T00:00:00Z')});
  assert.equal(integrated.all.plantCropHarvest,30);
  assert.equal(integrated.all.remainingPlantCrop,70);
  assert.equal(integrated.all.ratoonShoots,20);
  const projection = moduleApi.buildProjection(integrated.rows,{asOf:new Date('2026-09-17T00:00:00Z'),horizonMonths:13});
  assert.equal(projection.assumptions.verifiedRatoonShoots,20);
  assert.equal(projection.assumptions.scheduledRatoonShoots,20);
  assert.equal(projection.assumptions.ratoonCandidatePool,30);
  assert.equal(projection.assumptions.unverifiedRatoonCandidates,0);
  assert.ok(projection.months.some(item => item.harvest.ratoon.base > 0));
});

test('fertilizer projection uses SOP phases but remains explicitly indicative', () => {
  const projection = moduleApi.buildProjection(analysis.rows, {asOf:new Date('2026-09-17T00:00:00Z')});
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
  const profile = fs.readFileSync(path.join(root, 'js/dayun-gawangan.js'), 'utf8');
  assert.match(page, /Nanas Queen Dayun/);
  assert.match(page, /id="pa-data-date"/);
  assert.match(page, /Nanas Madu belum dimasukkan/);
  assert.match(page, /Proyeksi otomatis belum diaktifkan/);
  assert.match(page, /Sensus populasi per gawangan/);
  assert.match(page, /Tanggal tanam lengkap/);
  assert.doesNotMatch(script, /renderProjection/);
  assert.doesNotMatch(script, /Belum panen utama/);
  assert.doesNotMatch(profile, /Calon ratoon dari panen utama/);
  assert.match(script, /Verifikasi riwayat pupuk/);
  assert.match(script, /Ini daftar pemeriksaan, bukan perintah aplikasi/);
  assert.match(script, /dayun-hpt-nanas\.html/);
  assert.match(script, /dayun-gawangan\.html\?object=/);
  assert.doesNotMatch(script, /buildProjection/);
  assert.doesNotMatch(script, /open-meteo\.com/);
  assert.match(map, /id="dayun-pineapple-entry"/);
});
