const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");

function makeElement() {
  const children = new Map();
  return {
    value: "", max: "", textContent: "", innerHTML: "", className: "", hidden: false, checked: false, dataset: {}, onclick: null,
    classList: { add() {}, remove() {}, toggle() {} },
    addEventListener() {}, setAttribute() {},
    querySelector(selector) { if (!children.has(selector)) children.set(selector, makeElement()); return children.get(selector); },
    querySelectorAll() { return []; }, closest() { return null; }
  };
}

function makeLayer() {
  return {
    addTo() { return this; }, clearLayers() { return this; }, bindPopup() { return this; }, bindTooltip() { return this; },
    setParams() { return this; }, openPopup() { return this; }, on() { return this; },
    getBounds() { return { isValid() { return true; }, pad() { return this; } }; }
  };
}

test("page labels the GEFS corridor product and wires the controller", () => {
  const html = fs.readFileSync(path.join(ROOT, "fire-weather.html"), "utf8");
  const controller = fs.readFileSync(path.join(ROOT, "js/fire-weather.js"), "utf8");

  assert.ok(html.indexOf("js/fire-weather.js") > 0);
  assert.match(html, /Potensi Sebaran Kabut Asap/);
  assert.match(html, /Model GEFS eksperimental/);
  assert.match(html, /Potensi sebaran kabut asap · eksperimental/);
  assert.match(html, /data-layer="smoke" checked/);
  assert.match(controller, /smoke:L\.layerGroup\(\)\.addTo\(map\)/);
  assert.doesNotMatch(html, /data-layer="dispersion"/);
  assert.doesNotMatch(html, /Dispersi asap HYSPLIT \(belum tersedia\)/);
  assert.match(html, /bukan konsentrasi PM2\.5, batas asap teramati, atau risiko kesehatan/);
  assert.match(html, /data-period="1">24 jam/);
  assert.match(html, /class="active" data-period="1">24 jam/);
  assert.match(controller, /period=1,rainLayer/);
  assert.doesNotMatch(html, /data-period="latest"|>Sekarang<|>Current</);
  assert.doesNotMatch(controller, /period==='latest'|period==="latest"|6 jam terakhir|sumber 6 jam/);
  assert.match(controller, /function smokeField/);
  assert.match(controller, /clusterRecurringSources\(features,\{spatialKm:2,minDays:2\}\)/);
  assert.match(controller, /b\.recurrentHistory=!!history/);
  assert.match(controller, /distanceKm\(\[b\.lat,b\.lon\],\[group\.lat,group\.lon\]\)<=2/);
  assert.match(controller, /Anomali panas berulang · 7 hari/);
  assert.match(controller, /Buffer dibatasi 1,5–5 km/);
  assert.match(controller, /nearestEnsembleMember/);
  assert.match(controller, /ensembleCoverageStart/);
  assert.match(controller, /ensembleProvenance/);
  assert.match(controller, /kernelKm=30/);
  assert.match(controller, /turf\.isobands/);
  assert.match(controller, /var thresholds=\[10,26,51,76,101\]/);
  assert.match(controller, /Potensi sebaran kabut asap/);
  assert.doesNotMatch(controller, /smokeClass\(maximum\)/);
  assert.match(controller, /setLayerChecked\('hotspots',true\)/);
  assert.match(controller, /cache GEFS server mencakup waktu model/);
  assert.match(controller, /data\/weather-riau\.json/);
  assert.match(controller, /data\/gfs-atmosphere\.json/);
  assert.match(controller, /data\/cams-air-quality\.json/);
  assert.match(controller, /function contourAerosolEvidence/);
  assert.match(controller, /data\/surface-observations\.json/);
  assert.match(controller, /function contourSurfaceEvidence/);
  assert.match(controller, /maksimal 75 km dari polygon/);
  assert.match(controller, /kode asap FU/);
  assert.match(controller, /arah angin observasi\/model/);
  assert.match(controller, /Bukti multi-sumber:/);
  assert.match(controller, /tidak mengubah bentuk atau warna polygon GEFS/);
  assert.doesNotMatch(controller, /air-quality-api\.open-meteo\.com\/v1\/air-quality\?latitude=/);
  assert.match(controller, /data\/smoke-validation-status\.json/);
  assert.match(controller, /data\/smoke-dispersion-status\.json/);
  assert.match(controller, /status\.status!=='ready'/);
  assert.match(controller, /data\.runId!==status\.runId/);
  assert.match(controller, /Status validasi/);
  assert.match(controller, /Belum dikalibrasi/);
  assert.match(html, /Potensi sebaran kabut asap · belum dikalibrasi/);
  assert.match(html, /js\/smoke-transport-model\.js/);
  assert.match(controller, /Sumber ditahan/);
  assert.match(controller, /function smokeColor\(score\)/);
  assert.match(controller, /'#d6402b'/);
  assert.doesNotMatch(controller, /api\.open-meteo\.com\/v1\/forecast\?latitude=/);
  assert.doesNotMatch(controller, /api\.open-meteo\.com\/v1\/gfs\?latitude=/);
  assert.match(controller, /function transportSurvivalStep/);
  assert.match(controller, /Math\.exp\(-\.35\*rain\)/);
  assert.match(controller, /Math\.pow\(\.5,1\/18\)/);
  assert.match(controller, /kompleks sumber dikeluarkan karena GEFS tidak mencakup waktu deteksinya/);
});

test("cached Riau weather carries source and freshness metadata", () => {
  const weather = JSON.parse(fs.readFileSync(path.join(ROOT, "data/weather-riau.json"), "utf8"));
  assert.equal(weather.schemaVersion, 1);
  assert.ok(Number.isFinite(Date.parse(weather.validTime)));
  assert.ok(Number.isFinite(Number(weather.temperatureC)));
  assert.ok(Number.isFinite(Number(weather.windSpeedKmh)));
  assert.equal(weather.source, "MET Norway Locationforecast 2.0");
  assert.match(weather.termsUrl, /^https:\/\//);
});

test("blind plume annotation workspace excludes model output", () => {
  const html = fs.readFileSync(path.join(ROOT, "smoke-validation.html"), "utf8");
  const controller = fs.readFileSync(path.join(ROOT, "js/smoke-validation.js"), "utf8");
  assert.match(html, /Blind annotation wajib/);
  assert.match(html, /NASA Worldview/);
  assert.doesNotMatch(html, /fire-weather\.js|gfs-atmosphere|gefs-multilevel/);
  assert.match(controller, /gibs\.earthdata\.nasa\.gov/);
  assert.match(controller, /annotationStatus:'draft'/);
  assert.match(controller, /record\.reviewer=null/);
  assert.match(controller, /smoke-validation-observed-draft\.geojson/);
});

test("fire-weather controller boots against its browser interfaces", () => {
  const elements = new Map();
  const panes = new Map();
  const map = Object.assign(makeLayer(), {
    createPane(name) { panes.set(name, { style: {} }); }, getPane(name) { return panes.get(name); },
    hasLayer() { return false; }, removeLayer() {}, fitBounds() { return this; }, getBounds() { return { contains() { return false; } }; }
  });

  global.window = { addEventListener() {} };
  global.document = {
    getElementById(id) { if (!elements.has(id)) elements.set(id, makeElement()); return elements.get(id); },
    querySelector() { return makeElement(); }, querySelectorAll() { return []; }
  };
  global.localStorage = { getItem() { return null; }, setItem() {} };
  global.fetch = () => new Promise(() => {});
  global.L = {
    latLngBounds() { return makeLayer().getBounds(); }, map() { return map; }, tileLayer() { return makeLayer(); },
    layerGroup() { return makeLayer(); }, divIcon(options) { return options; }, marker() { return makeLayer(); },
    circleMarker() { return makeLayer(); }, polyline() { return makeLayer(); }, geoJSON() { return makeLayer(); },
    control() { return { onAdd: null, addTo(target) { if (this.onAdd) this.onAdd(target); return this; } }; },
    DomUtil: { create() { return makeElement(); } }
  };
  global.L.tileLayer.wms = () => makeLayer();

  assert.doesNotThrow(() => require("../js/fire-weather.js"));
});
