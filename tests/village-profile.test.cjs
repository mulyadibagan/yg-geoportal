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

test('village profile classifies reports by source type before counting program objects', () => {
  const controller = read('js/village-profile.js');
  assert.match(controller, /function isActivityFeature\(feature\)/);
  assert.match(controller, /return !isActivityFeature\(feature\)&&excluded\.indexOf\(id\)===-1/);
  assert.match(controller, /if\(!isActivityFeature\(feature\)\)\{return false;\}/);
  assert.match(controller, /if\(featureMatchesPlace\(feature,name,district,regency,boundary\)\)\{return true;\}/);
});
