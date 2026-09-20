const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(ROOT, file), "utf8");

test("Riau Geoportal catalogue is a no-index staff surface", () => {
  const page = read("staff-riau-reference.html");
  const home = read("index.html");
  assert.match(page, /<html lang="id" style="visibility:hidden">/);
  assert.match(page, /name="robots" content="noindex,nofollow,noarchive"/);
  assert.match(page, /js\/auth\.js\?v=20260920-session5/);
  assert.match(page, /js\/riau-geoportal-internal\.js/);
  assert.match(page, /Content-Security-Policy/);
  assert.match(page, /connect-src[^>]+https:\/\/script\.google\.com https:\/\/script\.googleusercontent\.com/);
  assert.match(page, /js\/staff-frame-guard\.js/);
  const frameGuard = read("js/staff-frame-guard.js");
  assert.match(frameGuard, /window\.top === window\.self/);
  assert.match(frameGuard, /display", "none", "important"/);
  assert.match(page, /integrity="sha256-20nQCchB9co0qIjJZRGuk2\/Z9VM\+kNiyxNV1lvTlZBo="/);
  assert.match(page, /Tidak ada geometri yang dimuat otomatis/);
  assert.match(home, /data-staff-only-module hidden/);
  assert.match(home, /href="staff-riau-reference\.html"/);
});

test("catalogue requests only authenticated private Worker routes", () => {
  const app = read("js/riau-geoportal-internal.js");
  assert.match(app, /authorization", "Bearer " \+ state\.session\.token/);
  assert.match(app, /credentials: "omit"/);
  assert.match(app, /\/api\/staff\/riau-geoportal\/catalog/);
  assert.match(app, /datasets\/\$\{encodeURIComponent\(item\.uuid\)\}\/display/);
  assert.match(app, /datasets\/\$\{encodeURIComponent\(item\.uuid\)\}\/source/);
  assert.doesNotMatch(app, /sessionToken=/);
  assert.doesNotMatch(app, /geoportal\.riau\.go\.id\/(?:wfs|wms)-proxy/);
  assert.match(app, /MAX_ACTIVE_LAYERS = 3/);
  assert.match(app, /MAX_DISPLAY_BYTES = 12 \* 1024 \* 1024/);
  assert.match(app, /MAX_DISPLAY_FEATURES = 25000/);
  assert.match(app, /!contentLength \|\| !Number\.isSafeInteger\(bytes\) \|\| bytes < 1/);
  assert.match(app, /geojson\.features\.length > MAX_DISPLAY_FEATURES/);
  assert.match(app, /state\.active\.size \+ state\.pending\.size >= MAX_ACTIVE_LAYERS/);
  assert.match(app, /const blank = L\.layerGroup\(\)\.addTo\(state\.map\)/);
  assert.doesNotMatch(app, /const streets = [^;]+\.addTo\(state\.map\)/);
});

test("catalogue preserves UUID identity and streams large source downloads safely", () => {
  const app = read("js/riau-geoportal-internal.js");
  assert.match(app, /active: new Map\(\)/);
  assert.match(app, /data-uuid="\$\{escapeHtml\(item\.uuid\)\}"/);
  assert.match(app, /window\.showSaveFilePicker && response\.body/);
  assert.match(app, /response\.body\.pipeTo\(writable\)/);
  assert.match(app, /Berkas besar memerlukan Chrome\/Edge/);
  assert.match(app, /safeOfficialUrl/);
  assert.match(app, /url\.hostname === "geoportal\.riau\.go\.id"/);
});

test("private Worker exposes only catalogued Riau Geoportal object kinds", () => {
  const worker = read("cloudflare/yg-webgis-public-data/src/index.js");
  assert.match(worker, /DATASET_UUID_PATTERN/);
  assert.match(worker, /\["manifest", "display", "source"\]\.includes\(kind\)/);
  assert.match(worker, /catalog\?\.canonicalDatasetKey !== "datasetUuid"/);
  assert.match(worker, /matches\.length > 1/);
  assert.match(worker, /const expectedKey =/);
  assert.match(worker, /manifestBytes !== actualBytes/);
  assert.match(worker, /const manifestBytes = Number\(route\[2\]\?\.bytes \|\| 0\), actualBytes = Number\(object\.size\)/);
  assert.match(worker, /validStaffToken\(token, env\)/);
  assert.doesNotMatch(worker, /\/api\/public\/riau-geoportal/);
});

test("Pages privacy guard rejects leaked source geometry", () => {
  for (const filename of ["source.geojson", "source.geojson.gz"]) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "yg-riau-pages-"));
    fs.writeFileSync(path.join(directory, filename), "private");
    const result = spawnSync(process.execPath, [path.join(ROOT, "scripts", "assert-riau-geoportal-private.mjs"), directory], { encoding: "utf8" });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /private artifacts entered the Pages build/);
  }
});

test("R2 ingest refuses buckets with direct public domains", () => {
  const workflow = read(".github/workflows/ingest-internal-riau-geoportal.yml");
  assert.doesNotMatch(workflow, /WORK_ROOT:\s*\$\{\{\s*runner\.temp/);
  assert.match(workflow, /WORK_ROOT=\$\{RUNNER_TEMP\}\/riau-geoportal/);
  assert.match(workflow, /Require private R2 bucket origins/);
  assert.match(workflow, /"\$\{api\}\/managed"/);
  assert.match(workflow, /"\$\{api\}\/custom"/);
  assert.match(workflow, /\.result \| type == "object"/);
  assert.match(workflow, /\.result\.domains \| type == "array"/);
  assert.match(workflow, /all\(\.result\.domains\[\]; \.enabled == false\)/);
  assert.equal((workflow.match(/check_private_bucket "\$\{STAGING_BUCKET\}"/g) || []).length, 2);
  assert.equal((workflow.match(/check_private_bucket "\$\{PRODUCTION_BUCKET\}"/g) || []).length, 2);
  assert.match(workflow, /Recheck private production R2 bucket origin before promotion/);
});
