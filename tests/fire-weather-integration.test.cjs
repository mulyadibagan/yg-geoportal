const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");

function makeElement() {
  const children = new Map();
  return {
    value: "",
    max: "",
    textContent: "",
    innerHTML: "",
    className: "",
    hidden: false,
    dataset: {},
    onclick: null,
    classList: { add() {}, remove() {}, toggle() {} },
    addEventListener() {},
    setAttribute() {},
    querySelector(selector) {
      if (!children.has(selector)) children.set(selector, makeElement());
      return children.get(selector);
    },
    querySelectorAll() { return []; },
    closest() { return null; }
  };
}

function makeLayer() {
  return {
    addTo() { return this; },
    clearLayers() { return this; },
    bindPopup() { return this; },
    bindTooltip() { return this; },
    setParams() { return this; },
    openPopup() { return this; },
    getBounds() {
      return {
        isValid() { return true; },
        pad() { return this; }
      };
    }
  };
}

test("page wires the pure transport model before the map controller", () => {
  const html = fs.readFileSync(path.join(ROOT, "fire-weather.html"), "utf8");
  const controller = fs.readFileSync(path.join(ROOT, "js/fire-weather.js"), "utf8");
  const modelAt = html.indexOf("js/smoke-transport-model.js");
  const controllerAt = html.indexOf("js/fire-weather.js");

  assert.ok(modelAt > 0);
  assert.ok(controllerAt > modelAt);
  assert.doesNotMatch(html, /Skor indikatif|Asap: sangat tinggi|AOD CAMS|kalibrasi kepadatan/i);
  assert.doesNotMatch(html, /transport-950|transport-925|transport-850/);
  assert.match(html, /Kontur Potensi Transport Asap/);
  assert.match(html, /Jejak model terluar · P20–P50/);
  assert.match(html, /Dukungan model terbatas · P50–P75/);
  assert.match(html, /Dukungan model sedang · P75–P90/);
  assert.match(html, /Dukungan model kuat · ≥P90/);
  assert.doesNotMatch(html, /1,853 km\/jam|1\.54σ|1,54σ|laju dispersi universal/i);
  assert.match(html, /bukan konsentrasi asap, PM2\.5, probabilitas/i);
  assert.match(html, /FRP dan AOD tidak menentukan warna/);
  assert.match(html, /Domain angin lintas batas mengikuti sumber aktif/);
  assert.match(html, /polygon tidak ditampilkan bila batas belum teratasi/);
  assert.match(html, /data-period="1">24 jam terakhir/);
  assert.match(html, /Titik yang tidak tampil bukan bukti bahwa api telah padam/);
  assert.doesNotMatch(html, /data-period="latest"|>Sekarang<|>Current</);
  assert.doesNotMatch(controller, /period==='latest'|period==="latest"|6 jam terakhir|sumber 6 jam/);
  assert.match(controller, /period===7\|\|period===30\)applyPeriodButton/);
  assert.match(controller, /data-period="1"/);
  assert.match(controller, /smokeAutoFit=true/);
  assert.match(controller, /setLayerChecked\('hotspots',true\)/);
  assert.match(controller, /turf\.isobands/);
  assert.match(controller, /turf\.cleanCoords/);
  assert.match(controller, /turf\.booleanValid/);
  assert.match(controller, /buildSupportGrid/);
  assert.match(controller, /buildSupportGrid\(puffs,null/);
  assert.doesNotMatch(controller, /buildSupportGrid\(puffs,\{minLat:-11\.2,maxLat:6\.2/);
  assert.match(controller, /boundsForSources/);
  assert.match(controller, /boundarySides/);
  assert.match(controller, /expandBounds/);
  assert.match(controller, /TRANSPORT_MAX_EXPANSIONS/);
  assert.match(controller, /transportEndTime/);
  assert.match(controller, /Polygon yang terpotong batas tidak ditampilkan/);
  assert.match(controller, /P20\/P50\/P75\/P90/);
  assert.match(controller, /fitBounds\(smokeBounds\.pad\(\.1\),\{maxZoom:6\}\)/);
});

test("fire-weather controller boots against its browser interfaces", () => {
  const elements = new Map();
  const panes = new Map();
  const map = Object.assign(makeLayer(), {
    createPane(name) { panes.set(name, { style: {} }); },
    getPane(name) { return panes.get(name); },
    hasLayer() { return false; },
    removeLayer() {},
    fitBounds() { return this; }
  });

  global.window = {
    YG_SMOKE_TRANSPORT: require("../js/smoke-transport-model.js"),
    addEventListener() {}
  };
  global.document = {
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, makeElement());
      return elements.get(id);
    },
    querySelector() { return makeElement(); },
    querySelectorAll() { return []; }
  };
  global.fetch = () => new Promise(() => {});
  global.L = {
    latLngBounds() { return makeLayer().getBounds(); },
    map() { return map; },
    tileLayer() { return makeLayer(); },
    layerGroup() { return makeLayer(); },
    control() {
      return {
        onAdd: null,
        addTo(target) {
          if (this.onAdd) this.onAdd(target);
          return this;
        }
      };
    },
    DomUtil: { create() { return makeElement(); } },
    divIcon(options) { return options; },
    marker() { return makeLayer(); },
    circleMarker() { return makeLayer(); },
    polyline() { return makeLayer(); },
    geoJSON() { return makeLayer(); }
  };
  global.L.tileLayer.wms = () => makeLayer();

  assert.doesNotThrow(() => require("../js/fire-weather.js"));
});
