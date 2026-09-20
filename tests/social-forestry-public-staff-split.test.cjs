const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

function visit(value, callback) {
  if (Array.isArray(value)) return value.forEach(item => visit(item, callback));
  if (!value || typeof value !== "object") return;
  Object.entries(value).forEach(([key, item]) => {
    callback(key, item);
    visit(item, callback);
  });
}

test("public PS pages do not load a map or staff data access", () => {
  const directory = read("social-forestry-directory.html");
  const profile = read("social-forestry-profile.html");

  assert.match(directory, /social-forestry-directory-public\.js/);
  assert.match(profile, /social-forestry-profile-public\.js/);
  [directory, profile].forEach(html => {
    assert.doesNotMatch(html, /id="(?:regency|village)-map"/);
    assert.doesNotMatch(html, /leaflet(?:\.js|\.css)/i);
    assert.doesNotMatch(html, /staff-data-access\.js/);
    assert.doesNotMatch(html, /staff-social-forestry-gate\.js/);
  });
});

test("public PS directory uses responsive cards and progressive loading", () => {
  const page = read("social-forestry-directory.html");
  const controller = read("js/social-forestry-directory-public.js");
  const styles = read("css/social-forestry-directory-public.css");

  assert.match(page, /social-forestry-regency\.css\?v=20260920-public-directory1/);
  assert.match(page, /social-forestry-directory-public\.css\?v=20260920-public-directory1/);
  assert.match(page, /id="load-more"/);
  assert.match(controller, /var visibleLimit = 18/);
  assert.match(controller, /shown\.slice\(0, visibleLimit\)/);
  assert.match(controller, /visibleLimit \+= pageSize/);
  assert.match(styles, /grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/);
  assert.match(styles, /\.psd-regency-grid\{grid-template-columns:1fr\}/);
});

test("public PS detail payload contains no RKPS fields or documents", () => {
  const details = JSON.parse(read("data/social-forestry-details.json"));
  visit(details, (key, value) => {
    assert.notEqual(key.toLowerCase(), "rkpsstatus");
    if (typeof value === "string") assert.doesNotMatch(value, /rkps/i);
  });
});

test("staff PS pages are gated and retain map and RKPS functions", () => {
  const directory = read("staff-social-forestry-directory.html");
  const profile = read("staff-social-forestry-profile.html");
  const directoryController = read("js/staff-social-forestry-directory.js");
  const profileController = read("js/staff-social-forestry-profile.js");

  [directory, profile].forEach(html => {
    assert.match(html, /name="robots" content="noindex,nofollow"/);
    assert.match(html, /staff-social-forestry-gate\.js/);
  });
  assert.match(directory, /id="regency-map"/);
  assert.match(profile, /id="village-map"/);
  assert.match(directoryController, /rkps:"RKPS"/);
  assert.match(profileController, /management\.rkpsStatus/);
  assert.match(directoryController, /staff-social-forestry-profile\.html\?key=/);
});

test("PS geometry and RKPS detail routes are staff-only", () => {
  const pagesWorkflow = read(".github/workflows/deploy-pages.yml");
  const privateWorkflow = read(".github/workflows/enable-staff-social-forestry.yml");
  const staffData = read("js/staff-data-access.js");
  const worker = read("cloudflare/yg-webgis-public-data/src/index.js");
  const gate = read("js/staff-social-forestry-gate.js");

  ["PERHUTANAN_SOSIAL_RIAU.geojson", "social-forestry-pkk-samj.geojson", "social-forestry-kud-agro-lestari.geojson", "social-forestry-derived-2025.geojson", "social-forestry-official-2026.geojson"].forEach(file => {
    assert.match(pagesWorkflow, new RegExp(`--exclude 'data/${file.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}'`));
  });
  assert.match(staffData, /'data\/social-forestry-details\.json': '\/api\/staff\/social-forestry-details'/);
  assert.match(worker, /["']\/api\/staff\/social-forestry-details["']:\s*\[["']internal\/social-forestry\/details\.json["']/);
  assert.match(worker, /["']\/api\/staff\/social-forestry-riau["']:\s*\[["']internal\/social-forestry\/riau\.geojson["']/);
  assert.match(privateWorkflow, /internal\/social-forestry\/details\.json/);
  assert.match(privateWorkflow, /internal\/social-forestry\/riau\.geojson/);
  assert.match(gate, /authorization:"Bearer "\+session\.token/);
});
