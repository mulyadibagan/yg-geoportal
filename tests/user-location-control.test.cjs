const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('interactive map shows and safely removes the device location', () => {
  const html = read('webgis.html');
  const map = read('js/map-v4.js');
  const control = read('js/user-location-control.js');
  assert.match(html, /id="locate-me"[^>]+aria-pressed="false"/);
  assert.match(html, /js\/user-location-control\.js\?v=20260920-location1/);
  assert.match(map, /YGUserLocation\.create\(map/);
  assert.match(control, /navigator\.geolocation\.watchPosition/);
  assert.match(control, /navigator\.geolocation\.clearWatch/);
  assert.match(control, /Koordinat hanya digunakan pada perangkat ini dan tidak disimpan/);
  assert.match(control, /L\.circleMarker/);
  assert.match(control, /L\.circle\(latlng/);
});

test('Dayun map reports the user position against program boundaries', () => {
  const html = read('dayun-map.html');
  const script = read('js/dayun-public.js');
  assert.match(script, /css\/user-location-control\.css\?v=20260920-location1/);
  assert.match(html, /js\/dayun-public\.js\?v=20260920-location1/);
  assert.match(script, /pointInGeometry/);
  assert.match(script, /Di luar Kampung Dayun/);
  assert.match(script, /Di dalam kawasan HKm Mandiri Sejahtera/);
  assert.match(script, /category==='Gawangan Tanam'/);
  assert.match(script, /dy-location-control yg-location-button/);
});
