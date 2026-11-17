const test = require('node:test');
const assert = require('node:assert/strict');
const F = require('../js/restoration-focus.js');
const E = require('../data/restoration-dumai-evidence.json');
// Synthetic numbers and rectangles test behavior only; they are not application data.
function boundaries() {
  return { type: 'FeatureCollection', features: F.targets.map(target => ({
    type: 'Feature', properties: { WADMKD: 'Kelurahan ' + target.name, WADMKC: 'Medang Kampai', WADMKK: 'Kota Dumai' },
    geometry: { type: 'Polygon', coordinates: [[[100,0],[101,0],[101,1],[100,0]]] }
  })) };
}
test('focus matches exact kelurahan, district and city, retains source geometries and rejects ambiguity', () => {
  const source = boundaries(), before = JSON.stringify(source);
  source.features.push({ ...source.features[0], properties: { WADMKD: 'Kuala Sepelintung', WADMKC: 'Medang Kampai', WADMKK: 'Kota Dumai' } });
  assert.equal(F.selectFeatures(source).length, 2);
  assert.equal(F.selectFeatures(source)[0].feature, source.features[0]);
  source.features.pop();
  assert.equal(JSON.stringify(source), before);
  source.features.push(source.features[0]);
  assert.throws(() => F.selectFeatures(source), /perlu diperiksa/);
  const wrongCity = boundaries(); wrongCity.features[0].properties.WADMKK = 'Pelalawan';
  assert.throws(() => F.selectFeatures(wrongCity), /Pelintung/);
});
test('unknown areas and loss stay unknown, true zero stays zero and incomplete totals stay null', () => {
  assert.deepEqual(F.recordSummary({}), { peat: null, loss2025: null, loss2023to2025: null });
  assert.deepEqual(F.recordSummary({ referenceAreasHa: { peat: 0 }, annualLossHa: { 2023: 1, 2024: 2, 2025: 0 } }),
    { peat: 0, loss2025: 0, loss2023to2025: 3 });
  assert.equal(F.recordSummary({ annualLossHa: { 2023: 1, 2025: 3 } }).loss2023to2025, null);
  assert.equal(F.recordSummary({ referenceAreasHa: { peat: '42' } }).peat, null);
});
function app({ failMap = false, failMetrics = false, failHistory = false, active = true } = {}) {
  const nodes = new Map(), requests = [], drawn = [], removed = [], fits = [], changes = [];
  const node = id => {
    if (!nodes.has(id)) nodes.set(id, { disabled: true, textContent: '', attrs: {}, handlers: {},
      children: [], setAttribute(k, v) { this.attrs[k] = v; }, addEventListener(k, v) { this.handlers[k] = v; },
      appendChild(item) { this.children.push(item); return item; }, append(...items) { this.children.push(...items); }, replaceChildren(...items) { this.children = items; } });
    return nodes.get(id);
  };
  const regency = { value: '' };
  const map = { fitBounds(bounds) { fits.push(bounds); }, removeLayer(layer) { removed.push(layer); } };
  const L = { geoJSON(data) { const layer = { data, addTo() { drawn.push(this); return this; }, getBounds() { return { isValid: () => true }; } }; return layer; } };
  const source = boundaries();
  const fetchJSON = async url => {
    requests.push(url);
    if (url === 'data/restoration-dumai-evidence.json') { if (failHistory) throw Error('history offline'); return structuredClone(E); }
    if (url.includes('coastal')) { if (failMap) throw Error('map offline'); return source; }
    if (url.includes('manifest')) {
      if (failMetrics) throw Error('metrics offline');
      return { generatedAt: '2026-09-01T00:00:00Z', shards: 64, index: { [F.targets[0].key]: 12, [F.targets[1].key]: 13 } };
    }
    const target = url.endsWith('/12.json') ? F.targets[0] : F.targets[1];
    return { [target.key]: { referenceAreasHa: { peat: 10 }, annualLossHa: { 2023: 1, 2024: 2, 2025: 3 } } };
  };
  const controller = F.init({ map, regency, L, document: { getElementById: node, createElement: () => ({ children: [], appendChild(item) { this.children.push(item); }, append(...items) { this.children.push(...items); }, replaceChildren(...items) { this.children = items; } }), createTextNode: value => ({ textContent: value }) },
    fetchJSON, isActive: () => active, setRegency(value) { changes.push(value); regency.value = 'D U M A I'; return true; } });
  return { controller, nodes, drawn, removed, fits, changes, requests, regency };
}
test('default map shows both chosen boundaries, switches to one, restores both and clears on another regency', async () => {
  const a = app(); await a.controller.ready;
  assert.equal(a.drawn.filter(layer => layer.data.type === 'FeatureCollection').at(-1).data.features.length, 2);
  assert.equal(a.changes[0], 'DUMAI');
  assert.equal(a.nodes.get('proposal-both').attrs['aria-pressed'], 'true');
  a.nodes.get('proposal-pelintung').handlers.click();
  assert.equal(a.drawn.filter(layer => layer.data.type === 'FeatureCollection').at(-1).data.features.length, 1);
  assert.equal(a.nodes.get('proposal-pelintung').attrs['aria-pressed'], 'true');
  a.nodes.get('proposal-both').handlers.click();
  assert.equal(a.drawn.filter(layer => layer.data.type === 'FeatureCollection').at(-1).data.features.length, 2);
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
  assert.equal(a.nodes.get('proposal-loss3-pelintung').textContent, '6 ha');
  assert.equal(a.nodes.get('proposal-profile-pelintung').href, 'village-profile.html?key=' + encodeURIComponent(F.targets[0].key));
});
test('map and metric failures remain separate and expired sessions cannot draw focus', async () => {
  const noMap = app({ failMap: true }); await noMap.controller.ready;
  assert.equal(noMap.drawn.length, 0);
  assert.equal(noMap.nodes.get('proposal-loss3-pelintung').textContent, '6 ha');
  assert.match(noMap.nodes.get('proposal-map-status').textContent, /belum dapat dimuat/);
  const noMetrics = app({ failMetrics: true }); await noMetrics.controller.ready;
  assert.equal(noMetrics.drawn.filter(layer => layer.data.type === 'FeatureCollection').length, 1);
  assert.match(noMetrics.nodes.get('proposal-data-pelintung').textContent, /belum dapat dimuat/);
  const expired = app({ active: false }); await expired.controller.ready;
  assert.equal(expired.drawn.length, 0);
  expired.nodes.get('proposal-pelintung').handlers.click();
  assert.equal(expired.drawn.length, 0);
});


test('shared boundary keeps exact source segments, ignores point contact, and supports reversed edges', () => {
  const f = coordinates => ({ geometry: { type: 'Polygon', coordinates: [coordinates] } });
  const left = f([[0,0],[1,0],[1,1],[0,1],[0,0]]);
  const right = f([[1,0],[2,0],[2,1],[1,1],[1,0]]);
  const before = JSON.stringify([left, right]);
  assert.equal(F.sharedBoundary([left, right]).length, 1);
  assert.equal(JSON.stringify([left, right]), before);
  const corner = f([[1,1],[2,1],[2,2],[1,2],[1,1]]);
  assert.equal(F.sharedBoundary([left, corner]).length, 0);
});
test('official history preserves dashes, reports yearly sums without treating missing as zero, and rejects invalid source cells', () => {
  const data = F.validateHistory(structuredClone(E));
  assert.equal(F.historyTotal(data, 'pelintung'), 80.75);
  assert.equal(F.historyTotal(data, 'guntung'), 38);
  assert.equal(data.rows.find(row => row.year === 2022).guntung.areaHa, null);
  for (const mutate of [
    d => d.rows.push(d.rows[0]),
    d => d.rows[0].pelintung.areaHa = 0,
    d => d.rows[2].pelintung.areaHa = '5',
    d => d.spatialFootprintsAvailable = true,
    d => d.targets.reverse(),
    d => d.rows[0].sourceRefs = []
  ]) {
    const invalid = structuredClone(E); mutate(invalid); assert.throws(() => F.validateHistory(invalid));
  }
  const explicitZero = structuredClone(E);
  explicitZero.rows[0].pelintung = { areaHa: 0, raw: '0', status: 'reported' };
  assert.equal(F.validateHistory(explicitZero).rows[0].pelintung.areaHa, 0);
});
test('history and recommendations render separately from map and forest data and fail without fabricated zeros', async () => {
  const a = app(); await a.controller.ready;
  assert.equal(a.nodes.get('proposal-burned-rows').children.length, 6);
  assert.equal(a.nodes.get('proposal-burned-pelintung').textContent, '66,25 ha');
  assert.equal(a.nodes.get('proposal-burned-guntung').textContent, '0,5 ha');
  assert.equal(a.nodes.get('proposal-recommendations').children.length, 2);
  const failed = app({ failHistory: true }); await failed.controller.ready;
  assert.match(failed.nodes.get('proposal-history-status').textContent, /belum dapat dimuat/);
  assert.equal(failed.nodes.get('proposal-burned-pelintung').textContent, 'Belum tersedia');
  assert.equal(failed.nodes.get('proposal-loss3-pelintung').textContent, '6 ha');
  assert.equal(failed.drawn.filter(layer => layer.data.type === 'FeatureCollection').length, 1);
});
