const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(ROOT, ...parts), 'utf8');

test('every public RSPO area has a stable profile identifier', () => {
  const reference = JSON.parse(read('data', 'PERUSAHAAN_SAWIT_RIAU_REFERENSI.geojson'));
  assert.equal(reference.features.length, 58);
  const ids = reference.features.map((feature) => feature.properties.COMPANY_ID);
  assert.equal(new Set(ids).size, 58);
  assert.ok(ids.every((id) => /^RSPO-\d{3}$/.test(id)));
});

test('RSPO profile supports area and group views with monthly hotspot history', () => {
  const page = read('rspo-area-profile.html');
  const controller = read('js', 'rspo-area-profile.js');
  assert.match(page, /id="rap-leaflet"/);
  assert.match(page, /id="rap-monthly"/);
  assert.match(controller, /query\.get\('id'\)/);
  assert.match(controller, /query\.get\('group'\)/);
  assert.match(controller, /data\/fire-monthly\/index\.json/);
  assert.match(controller, /rspoAreas/);
});

test('interactive-map RSPO popup opens the matching profile', () => {
  const controller = read('js', 'map-v4.js');
  const webgis = read('webgis.html');
  assert.match(controller, /rspo-area-profile\.html\?id=/);
  assert.match(controller, /Buka Profil &amp; Analisis Area/);
  assert.match(webgis, /map-v4\.js\?v=20260912-rspo-profile1/);
});

test('RSPO monitoring worklist export is available to staff, not the public page', () => {
  const publicPage = read('sawit-riau-rspo.html');
  const staffPage = read('staff-rspo-riau.html');
  const exporter = read('js', 'rspo-monitor-export-internal.js');
  assert.doesNotMatch(publicPage, /Unduh daftar CSV|rspo-monitor-download/);
  assert.match(staffPage, /id="rspo-internal-content" hidden/);
  assert.match(staffPage, /id="rspo-download-worklist"/);
  assert.match(staffPage, /rspo-monitor-export-internal\.js/);
  assert.match(exporter, /Sinyal dan pengaduan bukan bukti pelanggaran/);
});
