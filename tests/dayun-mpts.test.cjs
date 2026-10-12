const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(root, 'data/dayun-mpts-monitoring.geojson')));
test('MPTS display preserves 215 GPS observations and recorded mortality', () => {
  assert.equal(data.features.length, 215);
  assert.equal(new Set(data.features.map(f => f.properties.pointId)).size, 215);
  assert.equal(data.features.filter(f => f.properties.species === 'Petai').length, 152);
  assert.equal(data.features.filter(f => f.properties.condition === 'Mati').length, 68);
  for (const f of data.features) {
    assert.ok(f.geometry.coordinates.every(Number.isFinite));
    assert.ok(f.properties.displayCoordinates.every(Number.isFinite));
    assert.ok(f.properties.displayShiftMeters <= 3.51);
    assert.ok(f.properties.spatialMatches.every(id => !/^DAYUN-GT-\d+$/.test(id)));
  }
  assert.doesNotMatch(JSON.stringify(data), /C:\\|Users\\/);
});
test('display coordinates form seven straight planting rows', () => {
  const groups = Object.groupBy(data.features, f => f.properties.displayRow);
  assert.equal(Object.keys(groups).length, 7);
  for (const rows of Object.values(groups)) {
    const a = rows[0].properties.displayCoordinates, b = rows[rows.length - 1].properties.displayCoordinates;
    for (const f of rows) {
      const p = f.properties.displayCoordinates;
      assert.ok(Math.abs((b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0])) < 1e-14);
    }
  }
});
test('both public routes load MPTS before the existing map and offline package includes it', () => {
  for (const file of ['dayun.html', 'dayun-map.html']) {
    const html = fs.readFileSync(path.join(root, file), 'utf8');
    assert.ok(html.indexOf('js/dayun-mpts.js') < html.indexOf('js/dayun-public.js'));
    assert.ok(html.includes('js/dayun-mpts.js'));
  }
  const worker = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');
  assert.ok(worker.includes('/js/dayun-mpts.js'));
  assert.ok(worker.includes('/data/dayun-mpts-monitoring.geojson'));
});
