const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {summarize} = require('../js/dayun-mpts-summary.js');
const features = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/dayun-mpts-monitoring.geojson'))).features;
test('mortality per gawangan reconciles to all 68 dead observations', () => {
  const result = summarize(features);
  assert.deepEqual(result.rows.map(r => [r.objectId, r.Petai, r.Jengkol]), [
    ['DAYUN-GT-C-08', 13, 4], ['DAYUN-GT-C-09', 30, 1], ['DAYUN-GT-C-10', 9, 7]
  ]);
  assert.deepEqual(result.unassigned, {Petai:3, Jengkol:1});
  assert.deepEqual(result.total, {Petai:55, Jengkol:13});
  assert.equal(result.rows.reduce((sum, r) => sum + r.Petai + r.Jengkol, 0) + result.unassigned.Petai + result.unassigned.Jengkol, 68);
});
test('duplicate observations never inflate counts and unsurveyed gawangan remain absent', () => {
  const result = summarize(features.concat(features));
  assert.equal(result.total.Petai, 55);
  assert.equal(result.byGawangan['DAYUN-GT-C-09'].observed, 62);
  assert.equal(result.byGawangan['DAYUN-GT-A-01'], undefined);
});
test('ambiguous spatial matches stay outside assigned gawangan totals', () => {
  const result = summarize([{properties:{pointId:'test', species:'Petai', condition:'Mati', spatialMatches:['DAYUN-GT-C-08','DAYUN-GT-C-09']}}]);
  assert.deepEqual(result.rows, []);
  assert.equal(result.unassigned.Petai, 1);
});
