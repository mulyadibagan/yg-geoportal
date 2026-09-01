const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');

test('Temiang counts three physical canal blocks and keeps two maintenance reports as activities', () => {
  const snapshot = JSON.parse(read('data/dashboard-summary-snapshot.json'));
  const temiang = (snapshot.features || []).filter(feature => {
    const props = feature.properties || {};
    const target = props.targetFeatureProperties || {};
    return String(props.Desa || target.Desa || props.locationName || '').toLowerCase().includes('temiang');
  });
  const canals = temiang.filter(feature => String(feature.properties.Layer_ID || feature.properties.Source_Layer || '').toLowerCase() === 'sekat_kanal');
  const physical = canals.filter(feature => feature.properties.Source_Type === 'program_layer');
  const maintenance = canals.filter(feature => feature.properties.Source_Type === 'community_report');

  assert.equal(physical.length, 3);
  assert.equal(maintenance.length, 2);
  assert.ok(maintenance.every(feature => /perbaikan sekat kanal/i.test(feature.properties.title || '')));
});

test('Temiang counts the reported 2026 FDRS installation as a second physical unit', () => {
  const snapshot = JSON.parse(read('data/dashboard-summary-snapshot.json'));
  const fdrs = (snapshot.features || []).filter(feature => {
    const props = feature.properties || {};
    const target = props.targetFeatureProperties || {};
    const village = String(props.Desa || target.Desa || props.locationName || '').toLowerCase();
    return village.includes('temiang') && String(props.Layer_ID || props.Source_Layer || '').toLowerCase() === 'fdrs';
  });
  const baseUnits = fdrs.filter(feature => feature.properties.Source_Type === 'program_layer');
  const newInstallations = fdrs.filter(feature => feature.properties.Source_Type === 'community_report' && !feature.properties.Target_Object_ID && /installasi fdrs/i.test(feature.properties.title || ''));

  assert.equal(baseUnits.length, 1);
  assert.equal(newInstallations.length, 1);
  assert.equal(baseUnits.length + newInstallations.length, 2);
});

test('village profile classifies reports by source type before counting program objects', () => {
  const controller = read('js/village-profile.js');
  assert.match(controller, /function isActivityFeature\(feature\)/);
  assert.match(controller, /function isNewInfrastructureReport\(feature\)/);
  assert.match(controller, /return isNewInfrastructureReport\(feature\)\|\|\(!isActivityFeature\(feature\)&&excluded\.indexOf\(id\)===-1\)/);
  assert.match(controller, /if\(!isActivityFeature\(feature\)\)\{return false;\}/);
  assert.match(controller, /if\(featureMatchesPlace\(feature,name,district,regency,boundary\)\)\{return true;\}/);
});

test('Basilam Baru and Sungai Geniot profiles use stable administrative codes', () => {
  const controller = read('js/village-profile.js');
  const mapController = read('js/map-v4.js');
  const manifest = JSON.parse(read('data/administrative-village-analytics/manifest.json'));
  const codes = ['14.72.04.1004', '14.72.04.1006'];

  assert.match(controller, /function featureNameKey\(feature\)/);
  assert.match(controller, /featureKey\(feature\)===key\|\|featureNameKey\(feature\)===key/);
  assert.match(mapController, /props\.KODE_DESA \|\| props\.KODE_WIL/);
  assert.equal(manifest.count, 2106);
  assert.equal(manifest.index['kelurahan basilam baru|sungai sembilan|kota dumai'], undefined);

  for (const code of codes) {
    const shard = manifest.index[code];
    assert.notEqual(shard, undefined);
    const records = JSON.parse(read(`data/administrative-village-analytics/${shard}.json`));
    assert.ok(records[code]);
    assert.ok(records[code].baselineForestHa > 0);
  }
});
