const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const A = require('../js/restoration-scoring.js');
const root = path.resolve(__dirname, '..');
// Numeric fixtures below test the algorithm only; they are never shipped as spatial results.
function fixture(value = 50) {
  return Object.fromEntries(A.INDICATORS.map(i => [i.id, {
    value, validated: true, validation: { reviewer: 'unit-test', reference: 'test-only' },
    provenance: { source: 'unit-test-only', year: 2026, version: 'test-v1' },
    normalization: { min: 0, max: 100, direction: 'increasing', method: 'test scale' }
  }]));
}
test('weights sum to one and scoring preserves the specified weights', () => {
  assert.equal(A.INDICATORS.reduce((s, i) => s + i.weight, 0), 1);
  const data = fixture(0); data.degradation.value = 100; data.fireHistory.value = 100;
  assert.equal(A.assess(data).score, 55);
  assert.deepEqual(A.assess(data).implementationReadiness, { status: 'Belum dinilai', score: null });
});
test('empty and partial critical data never become zero or reweighted scores', () => {
  for (const input of [undefined, null, {}, [], '', fixture(null), fixture(''), fixture('0'), fixture(NaN), fixture(Infinity)]) {
    assert.equal(A.assess(input).score, null); assert.equal(A.assess(input).category, 'Belum dinilai');
  }
  for (const indicator of A.INDICATORS) {
    const data = fixture(100); delete data[indicator.id]; assert.equal(A.assess(data).score, null);
  }
  assert.equal(A.assess(fixture(0)).score, 0);
});
test('normalization validates numeric bounds and direction without clamping', () => {
  assert.equal(A.normalize(5, 0, 10), 50);
  assert.equal(A.normalize(2, 0, 10, 'decreasing'), 80);
  for (const args of [[null, 0, 10], ['', 0, 10], ['5', 0, 10], [1, 1, 1], [1, 2, 0], [-1, 0, 100], [101, 0, 100], [1, 0, 10, 'invalid']]) assert.equal(A.normalize(...args), null);
});
test('unvalidated layers, missing metadata, and missing methodology block scoring', () => {
  for (const mutate of [d => d.validated = false, d => delete d.validation, d => d.validation.reference = '', d => delete d.provenance,
    d => d.provenance.year = null, d => d.provenance.source = '', d => d.provenance.version = '', d => delete d.normalization,
    d => d.normalization.method = '', d => d.normalization.max = 0]) {
    const data = fixture(70); mutate(data.hydrology); assert.equal(A.assess(data).score, null);
  }
});
test('category thresholds are exact and invalid scores are unassessed', () => {
  for (const [n, expected] of [[0, 'Rendah'], [49.999, 'Rendah'], [50, 'Sedang'], [74.999, 'Sedang'], [75, 'Tinggi'], [100, 'Tinggi']]) {
    assert.equal(A.category(n), expected); assert.equal(A.assess(fixture(n)).category, expected);
  }
  for (const n of [null, '', NaN, Infinity, -1, 100.001]) assert.equal(A.category(n), 'Belum dinilai');
});
test('results preserve input provenance without aliasing and retain the model version', () => {
  const data = fixture(60), result = A.assess(data);
  data.hydrology.provenance.version = 'changed';
  assert.equal(result.indicators.find(i => i.id === 'hydrology').provenance.version, 'test-v1');
  assert.equal(result.modelVersion, A.VERSION);
});
test('actual BBSDLP GeoJSON filters and source-area summary run without fabricated scores', () => {
  const data = JSON.parse(fs.readFileSync(path.join(root, 'data/Gambut_BBSDLP_2019.geojson')));
  assert.equal(data.features.length, 736);
  const all = A.summarize(data.features); assert.equal(all.assessed, 0); assert.equal(all.unassessed, 736); assert.ok(all.sourceAreaHa > 0);
  const siak = A.select(data.features, 'Siak', ''); assert.ok(siak.length > 0); assert.ok(siak.length < all.count);
  assert.ok(siak.every(f => A.district(f.properties.KABKOT) === 'SIAK'));
  assert.equal(A.select(data.features, 'missing district', '').length, 0);
  assert.equal(A.summarize([]).sourceAreaHa, null);
  assert.equal(A.summarize([{ properties: { Luas_Ha: null } }]).sourceAreaHa, null);
});
test('point-in-polygon respects holes and MultiPolygon for real hotspot filtering', () => {
  const g = { type: 'Polygon', coordinates: [[[0,0],[10,0],[10,10],[0,10],[0,0]], [[2,2],[4,2],[4,4],[2,4],[2,2]]] };
  assert.equal(A.contains([1,1], g), true); assert.equal(A.contains([3,3], g), false); assert.equal(A.contains([11,1], g), false);
  assert.equal(A.contains([1,1], { type: 'MultiPolygon', coordinates: [g.coordinates] }), true);
});
async function bootScenario({ host = 'webgisyg.id', protocol = 'https:', session = null, response, fail = false, framed = false, onFetch } = {}) {
  const nodes = new Map(), calls = [];
  function element() { return { textContent: '', hidden: true, append() {}, appendChild() {}, addEventListener() {} }; }
  const document = { getElementById: id => { if (!nodes.has(id)) nodes.set(id, element()); return nodes.get(id); }, createElement: element };
  const window = { YG_RESTORATION: A, YG_AUTH: { readStoredSession: () => session } }; window.top = framed ? {} : window; window.self = window;
  const context = { window, document, location: { hostname: host, protocol }, AbortSignal,
    fetch: async (...args) => { calls.push(args); if (onFetch) return onFetch(args, nodes); if (fail) throw Error('network unavailable'); return response; } };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'js/restoration-priority.js'), 'utf8'), context);
  await new Promise(resolve => setImmediate(resolve));
  return { nodes, calls };
}
test('anonymous access does not load the map, data, or protected endpoints', async () => {
  const { nodes, calls } = await bootScenario();
  assert.equal(calls.length, 0); assert.match(nodes.get('access-status').textContent, /Akses ditolak/); assert.equal(nodes.has('workspace'), false);
});
test('framed pages cannot request staff data even with a stored session', async () => {
  const { calls } = await bootScenario({framed:true,session:{token:'test-only'}});
  assert.equal(calls.length,0);
});
test('approved HTTPS origin opens the workspace only after backend confirmation', async () => {
  let verified = false, publicReads = 0;
  const { calls } = await bootScenario({session:{token:'test-only'},onFetch:async(args,nodes)=>{
    if(args[0].endsWith('/api/staff/riau-geoportal/catalog')) {
      assert.equal(nodes.has('workspace'),false);
      assert.equal(args[1].headers.authorization,'Bearer test-only');
      return {ok:true,json:async()=>{verified=true;return {access:'staff_only',datasets:[]};}};
    }
    assert.equal(verified,true); assert.equal(nodes.get('workspace').hidden,false);
    assert.equal(args[0],'data/restoration-priority-sources.json');
    publicReads++;
    // Stop before map initialization: this test exercises authorization ordering.
    throw Error('end of authorization test');
  }});
  assert.equal(calls.length,2); assert.equal(publicReads,1);
});
test('unapproved origins and plain HTTP never transmit a stored staff token', async () => {
  for (const origin of [{host:'localhost'},{host:'unapproved.example'},{protocol:'http:'}]) {
    const { nodes, calls } = await bootScenario({ ...origin, session: { token: 'test-only' } });
    assert.equal(calls.length, 0); assert.match(nodes.get('access-status').textContent, /Origin belum diizinkan/);
  }
});
test('forged stored token, unauthorized and forbidden backend responses never unlock workspace', async () => {
  for (const code of [401, 403, 503]) {
    const { nodes, calls } = await bootScenario({ session: { token: 'test-only' }, response: { ok: false, status: code } });
    assert.equal(calls.length, 1); assert.equal(calls[0][1].headers.authorization, 'Bearer test-only');
    assert.equal(nodes.get('workspace').hidden, true); assert.match(nodes.get('access-status').textContent, /belum siap/);
  }
});
test('network failures and malformed verification response fail closed', async () => {
  for (const args of [{ fail: true }, { response: { ok: true, json: async () => ({ datasets: [] }) } }]) {
    const { nodes } = await bootScenario({ session: { token: 'test-only' }, ...args }); assert.equal(nodes.get('workspace').hidden, true);
  }
});
test('entry uses a hidden staff-only main navigation link and protected reference catalog', () => {
  const catalog = fs.readFileSync(path.join(root, 'staff-riau-reference.html'), 'utf8');
  const home = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.match(catalog, /href="restoration-priority.html"/);
  assert.match(home, /<a href="restoration-priority.html" data-staff-only-module hidden>/);
  assert.match(home, /\[data-staff-only-module\]\[hidden\]\{display:none!important\}/);
  const page = fs.readFileSync(path.join(root, 'restoration-priority.html'), 'utf8');
  assert.match(page, /id="workspace" hidden/); assert.match(page, /Content-Security-Policy/);
});
test('county summaries preserve unknown scores, missing areas, and normalized district names', () => {
  const rows = A.regions([
    {properties:{KABKOT:'Siak',Luas_Ha:12}},
    {properties:{KABKOT:'S I A K',Luas_Ha:8}},
    {properties:{KABKOT:'Bengkalis',Luas_Ha:null}},
    {properties:{}}
  ]);
  assert.equal(rows.length,3);
  const siak = rows.find(r=>r.name==='Siak');
  assert.equal(siak.sourceAreaHa,20); assert.equal(siak.count,2);
  assert.equal(siak.assessed,0); assert.equal(siak.unassessed,2);
  assert.equal(rows.find(r=>r.name==='Bengkalis').sourceAreaHa,null);
  assert.equal(A.regions([]).length,0);
});

test('main menu visibility follows a valid session and hides anonymous or expired staff links', () => {
  const source = fs.readFileSync(path.join(root,'js/navigation-v2.js'),'utf8');
  const snippet = source.slice(source.indexOf('  function readSession()'),source.indexOf("  window.addEventListener('yg:languagechange'"));
  for (const session of [null, {token:'test-only',username:'test',expiresAt:Date.now()-1}, {token:'test-only',username:'test',expiresAt:Date.now()+60000}]) {
    const link = {hidden:true};
    const storage = {getItem:()=>JSON.stringify(session),removeItem(){}};
    const context = {Date,JSON,Number,localStorage:storage,sessionStorage:storage,document:{querySelectorAll:selector=>selector==='[data-staff-only-module]'?[link]:[]}};
    vm.runInNewContext(snippet+';applyStaffOnlyVisibility(readSession());',context);
    assert.equal(link.hidden, !(session && session.expiresAt>Date.now()));
  }
});
test('county priority counts come only from complete validated ecological scores', () => {
  const result = A.regions([
    {properties:{KABKOT:'Siak',Luas_Ha:1,restorationIndicators:fixture(75)}},
    {properties:{KABKOT:'Siak',Luas_Ha:2,restorationIndicators:fixture(50)}},
    {properties:{KABKOT:'Siak',Luas_Ha:3}}
  ])[0];
  assert.equal(result.assessed,2); assert.equal(result.priorityCount,1); assert.equal(result.unassessed,1);
});
