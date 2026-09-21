const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

test("Makmur Pesisir spatial analysis is staff-gated and profile-scoped", () => {
  const page = read("staff-social-forestry-profile.html");
  const controller = read("js/staff-social-forestry-analysis.js");
  assert.match(page, /staff-social-forestry-gate\.js/);
  assert.match(page, /id="sf-spatial-analysis" hidden/);
  assert.match(controller, /key!==TARGET/);
  assert.match(controller, /window\.YG_STAFF_DATA\.session\(\)/);
  assert.match(controller, /not_found_in_repository|polygon belum ditemukan/i);
});

test("analysis payload is excluded from Pages and served by a protected route", () => {
  const deploy = read(".github/workflows/deploy-pages.yml");
  const workflow = read(".github/workflows/enable-staff-social-forestry.yml");
  const access = read("js/staff-data-access.js");
  const worker = read("cloudflare/yg-webgis-public-data/src/index.js");
  assert.match(deploy, /--exclude 'internal-data\/'/);
  assert.match(access, /social-forestry-makmur-pesisir-analysis/);
  assert.match(worker, /internal\/social-forestry\/makmur-pesisir-spatial-analysis\.json/);
  assert.match(workflow, /wrangler r2 object put.*makmur-pesisir-spatial-analysis\.json/);
  assert.doesNotMatch(read("social-forestry-profile.html"), /sf-spatial-analysis|staff-social-forestry-analysis/);
});

test("audit baseline does not fabricate missing geometry or legal conclusions", () => {
  const data = JSON.parse(read("internal-data/social-forestry/makmur-pesisir-spatial-analysis.json"));
  assert.equal(data.profileKey, "sk.9863/menlhk-pskl/pkps/psl.0/9/2023");
  assert.equal(data.rkps.spaceGeometryStatus, "not_found_in_repository");
  assert.equal(data.actualManagement.geometryStatus, "not_found_in_repository");
  assert.equal(data.actualManagement.legalConclusion, "not_assessed");
  assert.equal(data.rkps.landCoverReference.reduce((sum, row) => sum + row.areaHa, 0), 143);
});
