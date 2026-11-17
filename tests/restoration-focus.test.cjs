const test = require('node:test');
const assert = require('node:assert/strict');
const F = require('../js/restoration-focus.js');
// Synthetic numbers and rectangles test behavior only; they are not application data.
function boundaries() {
  return { type: 'FeatureCollection', features: F.targets.map(target => ({
    type: 'Feature', properties: { WADMKD: 'Kelurahan ' + target.name, WADMKC: 'Medang Kampai', WADMKK: 'Kota Dumai' },
    geometry: { type: 'Polygon', coordinates: [[[100,0],[101,0],[101,1],[100,0]]] }
  })) };
}
test('focus matches exact kelurahan, district and city, retains source geometries and rejects ambiguity', () => {
  const source = boundaries(), before = JSON.stringify(source);
  source.features.push({ ...source.features[0], properties: { WADMKD: 'Kuala Semundam', WADMKC: 'Medang Kampai', WADMKK: 'Kota Dumai' } });
  assert.equal(F.selectFeatures(source).length, 2);
  assert.equal(F.selectFeatures(source)[0].feature, source.features[0]);
  source.features.pop();
  assert.equal(JSON.stringify(source), before);
  source.features.push(source.features[0]);
  assert.throws(() => F.selectFeatures(source), /perlu diperiksa/);
  const wrongCity = boundaries(); wrongCity.features[0].properties.WADMKK = 'Pelalawan';
  assert.throws(() => F.selectFeatures(wrongCity), /Mundam/);
});
test('unknown areas and loss stay unknown, true zero stays zero and incomplete totals stay null', () => {
  assert.deepEqual(F.recordSummary({}), { peat: null, loss2025: null, loss2023to2025: null });
  assert.deepEqual(F.recordSummary({ referenceAreasHa: { peat: 0 }, annualLossHa: { 2023: 1, 2024: 2, 2025: 0 } }),
    { peat: 0, loss2025: 0, loss2023to2025: 3 });
  assert.equal(F.recordSummary({ annualLossHa: { 2023: 1, 2025: 3 } }).loss2023to2025, null);
  assert.equal(F.recordSummary({ referenceAreasHa: { peat: '42' } }).peat, null);
});
function app({ failMap = false, failMetrics = false, active = true } = {}) {
  const nodes = new Map(), requests = [], drawn = [], removed = [], fits = [], changes = [];
  const node = id => {
    if (!nodes.has(id)) nodes.set(id, { disabled: true, textContent: '', attrs: {}, handlers: {},
      setAttribute(k, v) { this.attrs[k] = v; }, addEventListener(k, v) { this.handlers[k] = v; } });
    return nodes.get(id);
  };
  const regency = { value: '' };
  const map = { fitBounds(bounds) { fits.push(bounds); }, removeLayer(layer) { removed.push(layer); } };
  const L = { geoJSON(data) { const layer = { data, addTo() { drawn.push(this); return this; }, getBounds() { return { isValid: () => true }; } }; return layer; } };
  const source = boundaries();
  const fetchJSON = async url => {
    requests.push(url);
    if (url.includes('coastal')) { if (failMap) throw Error('map offline'); return source; }
    if (url.includes('manifest')) {
      if (failMetrics) throw Error('metrics offline');
      return { generatedAt: '2026-09-01T00:00:00Z', shards: 64, index: { [F.targets[0].key]: 12, [F.targets[1].key]: 13 } };
    }
    const target = url.endsWith('/12.json') ? F.targets[0] : F.targets[1];
    return { [target.key]: { referenceAreasHa: { peat: 10 }, annualLossHa: { 2023: 1, 2024: 2, 2025: 3 } } };
  };
  const controller = F.init({ map, regency, L, document: { getElementById: node, createElement: () => ({}) },
    fetchJSON, isActive: () => active, setRegency(value) { changes.push(value); regency.value = 'D U M A I'; return true; } });
  return { controller, nodes, drawn, removed, fits, changes, requests, regency };
}
test('default map shows both chosen boundaries, switches to one, restores both and clears on another regency', async () => {
  const a = app(); await a.controller.ready;
  assert.equal(a.drawn.at(-1).data.features.length, 2);
  assert.equal(a.changes[0], 'DUMAI');
  assert.equal(a.nodes.get('proposal-both').attrs['aria-pressed'], 'true');
  a.nodes.get('proposal-mundam').handlers.click();
  assert.equal(a.drawn.at(-1).data.features.length, 1);
  assert.equal(a.nodes.get('proposal-mundam').attrs['aria-pressed'], 'true');
  a.nodes.get('proposal-both').handlers.click();
  assert.equal(a.drawn.at(-1).data.features.length, 2);
  assert.equal(a.controller.fit(), true);
  a.controller.onRegencyChange('Kota Dumai'); assert.equal(a.controller.fit(), true);
  a.controller.onRegencyChange('Siak'); assert.equal(a.controller.fit(), false);
  assert.equal(a.nodes.get('proposal-both').attrs['aria-pressed'], 'false');
  assert.ok(a.removed.length > 0);
});
test('metrics follow manifest shards and source identity, with correct profile link', async () => {
  const a = app(); await a.controller.ready;
  assert.ok(a.requests.some(url => url.endsWith('/12.json')));
  assert.ok(a.requests.some(url => url.endsWith('/13.json')));
  assert.equal(a.nodes.get('proposal-loss3-mundam').textContent, '6 ha');
  assert.equal(a.nodes.get('proposal-profile-mundam').href, 'village-profile.html?key=' + encodeURIComponent(F.targets[0].key));
});
test('map and metric failures remain separate and expired sessions cannot draw focus', async () => {
  const noMap = app({ failMap: true }); await noMap.controller.ready;
  assert.equal(noMap.drawn.length, 0);
  assert.equal(noMap.nodes.get('proposal-loss3-mundam').textContent, '6 ha');
  assert.match(noMap.nodes.get('proposal-map-status').textContent, /belum dapat dimuat/);
  const noMetrics = app({ failMetrics: true }); await noMetrics.controller.ready;
  assert.equal(noMetrics.drawn.length, 1);
  assert.match(noMetrics.nodes.get('proposal-data-mundam').textContent, /belum dapat dimuat/);
  const expired = app({ active: false }); await expired.controller.ready;
  assert.equal(expired.drawn.length, 0);
  expired.nodes.get('proposal-mundam').handlers.click();
  assert.equal(expired.drawn.length, 0);
});

