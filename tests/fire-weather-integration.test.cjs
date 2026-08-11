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
  assert.match(html, /Koridor Transport GEFS/);
  assert.match(html, /Dukungan lintasan · bukan polygon asap/);
  assert.match(html, /Koridor dukungan transport GEFS/);
  assert.match(html, /bukan konsentrasi PM2\.5, batas asap teramati, atau risiko kesehatan/);
  assert.match(html, /data-period="1">24 jam/);
  assert.doesNotMatch(html, /data-period="latest"|>Sekarang<|>Current</);
  assert.doesNotMatch(controller, /period==='latest'|period==="latest"|6 jam terakhir|sumber 6 jam/);
  assert.match(controller, /function smokeField/);
  assert.match(controller, /nearestEnsembleMember/);
  assert.match(controller, /ensembleCoverageStart/);
  assert.match(controller, /ensembleProvenance/);
  assert.match(controller, /kernelKm=30/);
  assert.match(controller, /turf\.isobands/);
  assert.match(controller, /setLayerChecked\('hotspots',true\)/);
  assert.match(controller, /cache GEFS server mencakup waktu model/);
  assert.match(controller, /kompleks sumber dikeluarkan karena GEFS tidak mencakup waktu deteksinya/);
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
