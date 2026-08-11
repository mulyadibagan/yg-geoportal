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
  assert.match(html, /Polygon Transport Asap Eksperimental/);
  assert.match(html, /Zona utama model · σh/);
  assert.match(html, /Batas ketidakpastian · 1,54σh/);
  assert.match(html, /1,853 km\/jam/);
  assert.match(html, /area yang saling menumpuk/i);
  assert.match(html, /bukan plume asap teramati, bukan konsentrasi PM2\.5/i);
  assert.match(controller, /period===7\|\|period===30\)applyPeriodButton/);
  assert.match(controller, /smokeAutoFit=true/);
  assert.match(controller, /fitBounds\(smokeBounds\.pad\(\.18\),\{maxZoom:8\}\)/);
  assert.match(controller, /sourceTime>=smokeFocusTime/);
  assert.match(controller, /peta fokus ke polygon sumber terbaru/);
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
