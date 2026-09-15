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
  assert.match(auth, /#logout-editor, #rspo-logout/);
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
    assert.match(html, /src="js\/auth\.js\?v=20260915-logout3"/, file);
  }
});
