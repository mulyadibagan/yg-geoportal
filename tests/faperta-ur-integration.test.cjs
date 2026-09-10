const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");

test("Faperta public module is additive and linked from the existing WebGIS", () => {
  assert.match(read("webgis.html"), /href="faperta-ur\.html"/);
  assert.match(read("js/map-v4.js"), /upt_faperta_ur/);
  assert.match(read("js/map-v4.js"), /data\/faperta-ur-site\.geojson/);
  assert.match(read("js/map-v4.js"), /KOLABORASI AKADEMIK/);
  assert.match(read("js/map-v4.js"), /if \(layerId && REFERENCE_LAYERS\[layerId\]\)/);
  assert.ok(fs.existsSync(path.join(ROOT, "faperta-ur.html")));
});

test("UPT boundary keeps all three WGS84 shapefile polygons", () => {
  const geojson = JSON.parse(read("data/faperta-ur-site.geojson"));
  assert.equal(geojson.type, "FeatureCollection");
  assert.equal(geojson.features.length, 3);
  for (const feature of geojson.features) {
    assert.equal(feature.geometry.type, "Polygon");
    const ring = feature.geometry.coordinates[0];
    assert.deepEqual(ring[0], ring.at(-1));
    assert.equal(feature.properties.crs, "EPSG:4326");
    assert.equal(feature.properties.reconciliation_status, "needs_review");
  }
});

test("Faperta data follows the scalable hierarchy without invented SOP doses", () => {
  const data = JSON.parse(read("data/faperta-ur.json"));
  const required = ["organization", "sites", "blocks", "plots", "crop_cycles", "sops", "scheduled_tasks", "realizations", "monitoring", "harvests", "research"];
  required.forEach((key) => assert.ok(Object.hasOwn(data, key), `missing ${key}`));
  assert.equal(data.sops.length, 0);
  assert.equal(data.scheduled_tasks.length, 0);
  assert.equal(data.templates.sop.inputs.length, 0);
  assert.equal(data.blocks.length, 3);
});

test("public module supports required first-stage functions and future extensions", () => {
  const html = read("faperta-ur.html");
  ["Plot Budidaya", "Jadwal Kegiatan", "Panduan Budidaya", "Pemantauan Tanaman", "Hasil Panen", "Kegiatan Penelitian", "Rencana dan pelaksanaan"].forEach((label) => assert.match(html, new RegExp(label)));
  const data = JSON.parse(read("data/faperta-ur.json"));
  ["sensor_iot", "weather", "drone_ndvi", "student_research", "additional_sites", "partner_farmers"].forEach((item) => assert.ok(data.future_extensions.includes(item)));
});

test("public module uses official identity assets and offers satellite imagery", () => {
  const html = read("faperta-ur.html");
  const script = read("js/faperta-ur.js");
  assert.match(html, /assets\/logo-yayasan-gambut\.png/);
  assert.match(html, /assets\/logo-faperta-unri\.png/);
  assert.ok(fs.existsSync(path.join(ROOT, "assets/logo-faperta-unri.png")));
  assert.match(html, /data-basemap="satellite"/);
  assert.match(script, /World_Imagery/);
});

test("empty operational sections and internal documentation stay off the public site", () => {
  const html = read("faperta-ur.html");
  const script = read("js/faperta-ur.js");
  const workflow = read(".github/workflows/deploy-pages.yml");
  assert.match(html, /id="module-tabs"[^>]*hidden/);
  assert.match(html, /id="garden-activity"[^>]*hidden/);
  assert.match(html, /id="garden-progress"[^>]*hidden/);
  assert.match(script, /hasAdditionalSection/);
  assert.match(workflow, /--exclude 'docs\/'/);
});

test("Faperta weather uses the garden location and keeps public wording", () => {
  const html = read("faperta-ur.html");
  const script = read("js/faperta-ur.js");
  assert.match(html, /id="garden-weather"[^>]*hidden/);
  assert.match(html, /Hujan 7 hari terakhir/);
  assert.match(html, /bukan alat ukur lapangan/);
  assert.match(script, /latitude=0\.4822&longitude=101\.3808/);
  assert.match(script, /past_days=30&forecast_days=7/);
  assert.match(script, /WEATHER_CACHE_MS = 30 \* 60 \* 1000/);
  assert.match(script, /loadWeather\(\)\.catch/);
});
