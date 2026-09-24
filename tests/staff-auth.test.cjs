const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");

test("authenticated pages expose a shared staff logout control", () => {
  const auth = fs.readFileSync(path.join(ROOT, "js", "auth.js"), "utf8");
  assert.match(auth, /mountSessionControl\(activeSession\)/);
  assert.match(auth, /control\.id = "yg-staff-session"/);
  assert.match(auth, /button\.textContent = "Keluar staf"/);
  assert.match(auth, /logout\(\);\s*location\.replace\("staff-login\.html\?loggedOut=1"\)/);
  assert.match(auth, /keepalive: action === "editor-logout"/);
  assert.match(auth, /#logout-editor, #rspo-logout/);
});

test("staff login tolerates slow Apps Script authentication without hanging", () => {
  const auth = fs.readFileSync(path.join(ROOT, "js", "auth.js"), "utf8");
  const login = fs.readFileSync(path.join(ROOT, "staff-login.html"), "utf8");
  assert.match(auth, /AUTH_RESULT_DEADLINE_MS = 120000/);
  assert.match(auth, /AUTH_RESULT_REQUEST_TIMEOUT_MS = 30000/);
  assert.match(auth, /AUTH_POST_TIMEOUT_MS = 45000/);
  assert.match(auth, /fetchWithTimeout/);
  assert.match(auth, /Continue polling by request ID/);
  assert.match(login, /js\/auth\.js\?v=20260924-session7/);
});

test("PBPH staff surfaces load the shared authentication module", () => {
  for (const file of [
    "admin-dashboard.html",
    "webgis.html",
    "fire-weather.html",
    "fire-monthly-report.html",
    "hotspot-analysis.html",
    "phl-svlk-riau.html",
    "phl-svlk-monthly-report.html",
    "pbph-profile.html"
  ]) {
    const html = fs.readFileSync(path.join(ROOT, file), "utf8");
    assert.match(html, /src="js\/auth\.js\?v=20260920-session5"/, file);
  }
});

test("dashboard reveals staff-only modules only for a valid staff session", () => {
  const home = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const navigation = fs.readFileSync(path.join(ROOT, "js", "navigation-v2.js"), "utf8");

  assert.match(home, /data-staff-only-module hidden/);
  assert.match(home, /href="phl-svlk-riau\.html"/);
  assert.match(home, /href="staff-rspo-dashboard\.html"/);
  assert.match(home, /Hanya tersedia selama sesi staf terverifikasi\./);
  assert.match(navigation, /localStorage\.getItem\('ygEditorSessionV1'\)\|\|sessionStorage\.getItem\('ygEditorSessionV1'\)/);
  assert.match(navigation, /!session\.token\|\|!session\.username\|\|Number\(session\.expiresAt\|\|0\)<=Date\.now\(\)/);
  assert.match(navigation, /localStorage\.removeItem\('ygEditorSessionV1'\)/);
  assert.match(navigation, /querySelectorAll\('\[data-staff-only-module\]'\)/);
  assert.match(navigation, /module\.hidden=false/);
  assert.match(home, /navigation-v2\.js\?v=20260916-rspo-internal3/);
});

test("interactive map exposes the social forestry layer only to authenticated staff", () => {
  const map = fs.readFileSync(path.join(ROOT, "js", "map-v4.js"), "utf8");
  const page = fs.readFileSync(path.join(ROOT, "webgis.html"), "utf8");

  assert.match(map, /\.\.\.\(staffSession \? \{ perhutanan_sosial_riau: \{/);
  assert.match(map, /label: "Perhutanan Sosial Riau · internal staf"/);
  assert.match(page, /map-v4\.js\?v=20260924-ha-context3/);
  assert.match(page, /staff-data-access\.js\?v=20260920-pptpkh1/);
  assert.match(map, /href="staff-rspo-area-profile\.html\?id=/);
  const staffData = fs.readFileSync(path.join(ROOT, "js", "staff-data-access.js"), "utf8");
  assert.match(staffData, /'data\/PERUSAHAAN_SAWIT_RIAU_REFERENSI\.geojson': '\/api\/staff\/rspo-companies'/);
});

test("interactive map exposes indicative PPTPKH only through the protected staff route", () => {
  const map = fs.readFileSync(path.join(ROOT, "js", "map-v4.js"), "utf8");
  const staffData = fs.readFileSync(path.join(ROOT, "js", "staff-data-access.js"), "utf8");
  const worker = fs.readFileSync(path.join(ROOT, "cloudflare", "yg-webgis-public-data", "src", "index.js"), "utf8");

  assert.match(map, /\.\.\.\(staffSession \? \{ pptpkh_riau_2023: \{/);
  assert.match(map, /PPTPKH Revisi II 2023 · indikatif internal/);
  assert.match(map, /type: "land_reform"/);
  assert.match(staffData, /'data\/PPTPKH_RIAU_2023\.geojson': '\/api\/staff\/pptpkh-riau-2023'/);
  assert.match(worker, /"\/api\/staff\/pptpkh-riau-2023": \["internal\/land-reform\/pptpkh-riau-2023\.geojson"/);
});

test("interactive map exposes FEG SK.130 only through the protected staff route", () => {
  const map = fs.readFileSync(path.join(ROOT, "js", "map-v4.js"), "utf8");
  const staffData = fs.readFileSync(path.join(ROOT, "js", "staff-data-access.js"), "utf8");
  const worker = fs.readFileSync(path.join(ROOT, "cloudflare", "yg-webgis-public-data", "src", "index.js"), "utf8");

  assert.match(map, /\.\.\.\(staffSession \? \{ feg_sk130_riau: \{/);
  assert.match(map, /Fungsi Ekosistem Gambut SK\.130 · internal staf/);
  assert.match(staffData, /'data\/FEG_SK130_RIAU\.geojson': '\/api\/staff\/feg-sk130-riau'/);
  assert.match(worker, /"\/api\/staff\/feg-sk130-riau": \["internal\/peat\/feg-sk130-riau\.geojson"/);
});

test("interactive map exposes verified RTRW geometry only to authenticated staff", () => {
  const map = fs.readFileSync(path.join(ROOT, "js", "map-v4.js"), "utf8");
  const staffData = fs.readFileSync(
    path.join(ROOT, "js", "staff-data-access.js"),
    "utf8"
  );

  assert.match(map, /\.\.\.\(staffSession \? \{ rtrw_riau_2018_2038: \{/);
  assert.doesNotMatch(map, /staffSession && false \? \{ rtrw_riau_2018_2038/);
  assert.match(map, /TATA RUANG · INTERNAL STAF/);
  assert.match(map, /Kebijakan Satu Peta BIG · RTRWP Layer 14/);
  assert.match(map, /23 kelas · 33 polygon/);
  assert.match(
    staffData,
    /'data\/RTRW_RIAU_2018_2038\.geojson': '\/api\/staff\/rtrw-riau-2018-2038'/
  );
});
