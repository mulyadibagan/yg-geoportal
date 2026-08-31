const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');

test('PBPH snapshot groups 187 polygon parts into 56 stable profiles', () => {
  const geo = JSON.parse(read('data/PBPH_RIAU_052026.geojson'));
  const ids = new Set(geo.features.map(feature => String(feature.properties.PBPH_ID || '').trim()));
  assert.equal(geo.features.length, 187);
  assert.equal(ids.size, 56);
  assert.ok(!ids.has(''));
});

test('PBPH profile uses frozen monthly reports starting July 2026', () => {
  const controller = read('js/pbph-profile.js');
  assert.match(controller, /REPORT_START="2026-07"/);
  assert.match(controller, /data\/fire-monthly\/index\.json/);
  assert.match(controller, /row\.status==="final"/);
  assert.match(controller, /report\.companies/);
  assert.match(controller, /report\.hotspots/);
  assert.doesNotMatch(controller, /hotspot-high-confidence\.geojson/);
});

test('July report assigns two hotspots to Diamond Raya Timber', () => {
  const report = JSON.parse(read('data/fire-monthly/2026-07.json'));
  const company = report.companies.find(row => row.name === 'PT DIAMOND RAYA TIMBER');
  assert.equal(report.status, 'final');
  assert.equal(company.hotspots, 2);
  assert.equal(report.hotspots.filter(point => point.permits.some(row => row.name === company.name)).length, 2);
});

test('map and PBPH hotspot polygons link to the dedicated profile', () => {
  const map = read('js/map-v4.js');
  const analysis = read('js/hotspot-analysis.js');
  const html = read('pbph-profile.html');
  assert.match(map, /pbph-profile\.html\?id=/);
  assert.match(map, /Buka Profil PBPH/);
  assert.match(analysis, /pbph-profile\.html\?id=/);
  assert.match(html, /Riwayat laporan bulanan/);
  assert.match(html, /Dokumen pendukung/i);
});

test('PBPH profile separates permit documents from conservative SVLK status', () => {
  const html = read('pbph-profile.html');
  const controller = read('js/pbph-profile.js');
  const registry = JSON.parse(read('data/pbph-documents.json'));
  const diamond = registry.profiles['443,1998'];
  assert.doesNotMatch(html, /Sumber spasial resmi/i);
  assert.doesNotMatch(controller, /registry\.source/);
  assert.match(html, /SVLK &amp; PHL/);
  assert.equal(diamond.documents.length, 0);
  assert.equal(diamond.svlk.status, 'audit-announcement-found');
  assert.equal(diamond.svlk.certificateNumber, null);
  assert.match(diamond.svlk.note, /bukan sertifikat dan bukan keputusan PBPH/i);
});

test('internal source remarks are not rendered in the public PBPH profile', () => {
  const controller = read('js/pbph-profile.js');
  assert.doesNotMatch(controller, /item\("Catatan sumber"/);
  assert.doesNotMatch(controller, /p\.REMARK/);
});
