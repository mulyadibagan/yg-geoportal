const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('Dayun field input is public and creates a pending monitoring report', () => {
  const html = read('dayun-monitoring.html');
  const script = read('js/dayun-monitoring.js');
  assert.match(html, /FORM PUBLIK/);
  assert.match(html, /id="dm-reporter" required/);
  assert.match(html, /id="dm-phone"/);
  assert.match(html, /id="dm-email"/);
  assert.match(html, /Kirim untuk verifikasi/);
  assert.doesNotMatch(script, /YG_AUTH\.readStoredSession/);
  assert.doesNotMatch(script, /staff-login\.html\?return=/);
  assert.match(script, /if\(!phone&&!email\)/);
  assert.match(script, /reportType:'Monitoring'/);
  assert.match(script, /targetLayerId:'dayun_gawangan'/);
  assert.match(script, /monitoringType:'Agroforestri Dayun'/);
  assert.match(script, /page=report-submission-status/);
  assert.doesNotMatch(script, /adminToken|ADMIN_TOKEN/);
});

test('public gawangan profile reads only the published report endpoint and calculates current age', () => {
  const html = read('dayun-gawangan.html');
  const script = read('js/dayun-gawangan.js');
  const backend = read('apps-script/webgis-backend/Kode.js');
  assert.match(script, /page=public-reports/);
  assert.match(script, /p\.targetLayerId!=='dayun_gawangan'/);
  assert.match(script, /Umur saat ini/);
  assert.match(script, /function ageNow/);
  assert.match(script, /agust:7/);
  assert.match(script, /sept:8/);
  assert.match(script, /\(data terakhir\)/);
  assert.match(script, /\\d\{1,2\}.*\\s\+\(\[a-z\]\+\).*\\d\{4\}/);
  assert.match(html, /RIWAYAT TERVERIFIKASI/);
  assert.match(backend, /if \(row\[21\] !== 'Sudah Dipublikasikan'\)/);
  assert.match(backend, /'Menunggu Verifikasi'/);
});

test('admin dashboard exposes the Dayun queue context without exposing drafts publicly', () => {
  const html = read('admin-dashboard.html');
  const script = read('js/admin-dashboard.js');
  assert.match(html, /Gawangan Dayun/);
  assert.match(html, /dayun-monitoring\.html/);
  assert.match(html, /Sudah Dipublikasikan/);
  assert.match(script, /function dayunMonitoringSummary/);
  assert.match(script, /report\.targetLayerId !== 'dayun_gawangan'/);
});
