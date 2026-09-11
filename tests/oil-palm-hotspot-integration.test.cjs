const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");

test("oil-palm reference layer has the expected Riau coverage and a clean public report", () => {
  const data = JSON.parse(read("data/PERUSAHAAN_SAWIT_RIAU_REFERENSI.geojson"));
  assert.equal(data.type, "FeatureCollection");
  assert.equal(data.features.length, 241);
  assert.ok(data.features.every((feature) => feature.properties.PO_PROVINC === "Riau"));
  assert.ok(new Set(data.features.map((feature) => feature.properties.PO_COMPANY)).size >= 160);

  const html = read("hotspot-analysis.html");
  const controller = read("js/hotspot-analysis.js");
  assert.doesNotMatch(html, /Catatan metodologi|method-note/);
  assert.match(controller, /'oil-palm':\{title:'Hotspot dalam referensi perusahaan sawit'/);
  assert.match(controller, /oilPalmCompanyRef/);
  assert.match(controller, /PERUSAHAAN_SAWIT_RIAU_REFERENSI\.geojson/);
  assert.match(controller, /bukan batas hukum HGU atau status penguasaan terkini/);
});

test("fire dashboard links to the company report and keeps a non-attribution warning", () => {
  const html = read("fire-weather.html");
  const controller = read("js/fire-weather.js");
  assert.match(html, /data-analysis-scope="oil-palm"/);
  assert.match(html, /id="kpi-hotspots-oil-palm"/);
  assert.match(html, /tidak membuktikan kebakaran, penyebab, penguasaan lahan saat ini, atau tanggung jawab perusahaan/);
  assert.match(controller, /function renderOilPalmSources/);
  assert.match(controller, /oilPalmCompanyRef/);
});

test("interactive map exposes the Riau oil-palm company reference on demand", () => {
  const html = read("webgis.html");
  const controller = read("js/map-v4.js");
  assert.match(html, /map-v4\.js\?v=20260912-oil-palm-reference1/);
  assert.match(controller, /perusahaan_sawit_riau/);
  assert.match(controller, /label: "Perusahaan Sawit Riau"/);
  assert.match(controller, /type: "oil_palm_company"/);
  assert.match(controller, /PERUSAHAAN_SAWIT_RIAU_REFERENSI\.geojson/);
});

test("hourly enrichment attaches oil-palm company references", () => {
  const script = read("scripts/enrich_hotspot_villages.mjs");
  const workflow = read(".github/workflows/update-hotspot-analytics.yml");
  assert.match(script, /HOTSPOT_OIL_PALM_BOUNDARY/);
  assert.match(script, /oilPalmCompanyRef/);
  assert.match(workflow, /node scripts\/enrich_hotspot_villages\.mjs/);
});
