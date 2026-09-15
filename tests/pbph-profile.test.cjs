const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');

test('PBPH datasets are absent from the public repository', () => {
  assert.equal(fs.existsSync(path.join(ROOT, 'data/PBPH_RIAU_052026.geojson')), false);
  assert.equal(fs.existsSync(path.join(ROOT, 'data/pbph-documents.json')), false);
  assert.equal(fs.existsSync(path.join(ROOT, 'data/phl-svlk-monthly')), false);
});

test('PBPH pages resolve their legacy data paths through the authenticated gateway', () => {
  const access = read('js/staff-data-access.js');
  const profile = read('js/pbph-profile.js');
  const directory = read('js/phl-svlk-riau.js');
  const monthly = read('js/phl-svlk-monthly-report.js');

  assert.match(access, /data\/PBPH_RIAU_052026\.geojson['"]:\s*['"]\/api\/staff\/pbph-riau/);
  assert.match(access, /data\/pbph-documents\.json['"]:\s*['"]\/api\/staff\/pbph-documents/);
  assert.match(access, /\/api\/staff\/fire-monthly-index/);
  assert.match(access, /\/api\/staff\/phl-svlk-monthly-index/);
  assert.match(access, /authorization:\s*['"]Bearer /);
  assert.match(profile, /data\/PBPH_RIAU_052026\.geojson/);
  assert.match(directory, /data\/PBPH_RIAU_052026\.geojson/);
  assert.match(monthly, /YG_PRIVATE_DATA\.json/);
});

test('public monthly fire reports contain no PBPH company or permit data', () => {
  for (const file of fs.readdirSync(path.join(ROOT, 'data/fire-monthly')).filter(name => /^20\d{2}-\d{2}\.json$/.test(name))) {
    const report = JSON.parse(read(path.join('data/fire-monthly', file)));
    assert.equal(Object.hasOwn(report, 'companies'), false, file);
    assert.equal(Object.hasOwn(report.summary || {}, 'companies'), false, file);
    for (const hotspot of report.hotspots || []) {
      assert.equal(Object.hasOwn(hotspot, 'permits'), false, file);
    }
  }
});

test('map and PBPH hotspot polygons link to the dedicated staff profile', () => {
  const map = read('js/map-v4.js');
  const analysis = read('js/hotspot-analysis.js');
  const html = read('pbph-profile.html');
  assert.match(map, /pbph-profile\.html\?id=/);
  assert.match(analysis, /pbph-profile\.html\?id=/);
  assert.match(html, /Rekap tahunan dan laporan bulanan/);
  assert.match(html, /Dokumen pendukung/i);
});
