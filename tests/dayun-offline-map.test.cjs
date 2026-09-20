const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('Dayun map exposes explicit offline and home-screen controls', () => {
  const html = read('dayun-map.html');
  assert.match(html, /manifest-dayun\.webmanifest/);
  assert.match(html, /id="dayun-offline-save"/);
  assert.match(html, />Simpan peta offline</);
  assert.match(html, /id="dayun-offline-install"/);
  assert.match(html, />Pasang di layar utama</);
  assert.match(html, /id="dayun-offline-delete"/);
  assert.match(html, /js\/dayun-offline\.js/);
});

test('Dayun manifest launches the map directly as a standalone field app', () => {
  const manifest = JSON.parse(read('manifest-dayun.webmanifest'));
  assert.equal(manifest.id, '/dayun-map.html');
  assert.match(manifest.start_url, /^\/dayun-map\.html/);
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.scope, '/');
});

test('service worker downloads a bounded Dayun package without deleting it on activation', () => {
  const worker = read('service-worker.js');
  assert.match(worker, /const DAYUN_CACHE_NAME = "yg-dayun-offline-v1"/);
  assert.match(worker, /DAYUN_OFFLINE_DOWNLOAD/);
  assert.match(worker, /DAYUN_OFFLINE_STATUS/);
  assert.match(worker, /DAYUN_OFFLINE_DELETE/);
  assert.match(worker, /async function offlineNavigationFallback/);
  assert.match(worker, /opensGeneralPwa/);
  assert.match(worker, /dayunCache\.match\(new URL\("\/dayun-map\.html"/);
  assert.match(worker, /\/data\/dayun-map\.geojson/);
  assert.match(worker, /\/data\/dayun-gawangan-details\.json/);
  assert.match(worker, /server\.arcgisonline\.com/);
  assert.match(worker, /}, 10, 12, 0\)/);
  assert.match(worker, /}, 13, 18, 1\)/);
  assert.match(worker, /key\.startsWith\("yg-geoportal-v"\)/);
  assert.doesNotMatch(worker, /keys\.filter\(key => key !== CACHE_NAME\)/);
});

test('Dayun data source immediately uses local files while offline', () => {
  const source = read('js/dayun-data-source.js');
  assert.match(source, /navigator\.onLine===false\)return local\(localUrl\)/);
});

test('offline client reports progress and preserves user control over stored data', () => {
  const client = read('js/dayun-offline.js');
  assert.match(client, /DAYUN_OFFLINE_PROGRESS/);
  assert.match(client, /navigator\.storage\.persist/);
  assert.match(client, /confirm\('Hapus paket Peta Dayun/);
  assert.match(client, /beforeinstallprompt/);
  assert.match(client, /navigator\.onLine/);
  assert.match(client, /function showInstallOffer/);
  assert.match(client, /Tambahkan pintasan untuk masuk tanpa internet/);
  assert.match(client, /Peta Dayun akan terbuka otomatis/);
});
