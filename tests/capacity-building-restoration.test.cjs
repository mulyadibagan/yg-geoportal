const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const archive = JSON.parse(fs.readFileSync(path.join(root, 'data/capacity-building.json')));
const evidence = JSON.parse(fs.readFileSync(path.join(root, 'data/capacity-building-evidence.json')));
const snapshot = JSON.parse(fs.readFileSync(path.join(root, 'data/dashboard-summary-snapshot.json')));

function harness({ cloud = { features: [] }, live = { features: [] }, cloudFails = false, liveFails = false, scope = 'training' } = {}) {
  const nodes = {};
  for (const id of ['capacity-search', 'capacity-year', 'capacity-regency', 'capacity-list', 'capacity-source-status', 'capacity-stat-activities', 'capacity-stat-participants', 'capacity-stat-women', 'capacity-stat-youth']) {
    nodes[id] = { value: '', textContent: '', options: [], querySelectorAll: () => [], appendChild(option) { this.options.push(option); } };
    Object.defineProperty(nodes[id], 'innerHTML', { get() { return this.html || ''; }, set(value) { this.html = value; this.options = [{ value: '' }]; } });
  }
  const window = { location: { search: '' } };
  const document = {
    body: { getAttribute: () => scope },
    getElementById: id => nodes[id],
    addEventListener() {},
    createElement: () => ({ value: '', remove() {} }),
    head: { appendChild(script) { queueMicrotask(() => {
      if (liveFails) script.onerror();
      else window[new URL(script.src).searchParams.get('callback')](live);
    }); } }
  };
  const urls = [];
  const context = vm.createContext({ window, document, Date, URLSearchParams, AbortController, setTimeout, clearTimeout, fetch: async url => {
    urls.push(url);
    const data = url.includes('capacity-building-evidence.json') ? evidence : url.includes('capacity-building.json') ? archive : url.startsWith('data/') ? snapshot : cloud;
    if (!url.startsWith('data/') && cloudFails) throw new Error('network unavailable');
    return { ok: true, json: async () => data };
  } });
  let source = fs.readFileSync(path.join(root, 'js/capacity-building.js'), 'utf8');
  source = source.replace("  document.addEventListener('DOMContentLoaded'", "  window.testCapacity = { loadCapacity, mergeCapacityRecords, liveRecord, publishedFeatures, documentUrls, evidenceLinks, rows: () => all };\n  document.addEventListener('DOMContentLoaded'");
  vm.runInContext(source, context);
  return { api: window.testCapacity, nodes, urls };
}

test('complete recovered archive stays visible when the external snapshot is empty', async () => {
  const h = harness();
  await h.api.loadCapacity();
  assert.equal(h.api.rows().length, 24);
  assert.equal(h.nodes['capacity-stat-activities'].textContent, '24');
  assert.equal(h.nodes['capacity-stat-participants'].textContent, '990');
  assert.equal(new Set(h.api.rows().map(r => r.id)).size, 24);
  for (const row of h.api.rows()) assert.ok(h.api.evidenceLinks(row).length > 0, `${row.id} has no evidence`);
  assert.ok(h.nodes['capacity-list'].innerHTML.includes('Laporan pelatihan dan evaluasi Sepahat'));
  assert.ok(h.nodes['capacity-list'].innerHTML.includes('Laporan kunjungan belajar Malaysia 2025'));
});

test('same-origin published reports survive external service failures', async () => {
  const h = harness({ cloudFails: true, liveFails: true });
  await h.api.loadCapacity();
  assert.equal(h.api.rows().length, 24);
  const pedekik = h.api.rows().find(r => r.id === 'YG-20260722-162739-462');
  assert.equal(pedekik.date, '2026-06-17');
  assert.ok(pedekik.photos.length >= 3);
  assert.ok(h.api.evidenceLinks(pedekik).some(x => x.label === 'Laporan pelatihan Pedekik'));
});

test('live reports are merged even after a successful partial Cloudflare response', async () => {
  const fresh = { type: 'Feature', properties: { reportId: 'NEW-PUBLISHED-TRAINING', reportType: 'Capacity Building', status: 'Sudah Dipublikasikan', title: 'New verified session', activityDate: '2026-10-08', proposedInformation: { capacityBuilding: { maleParticipants: 8, femaleParticipants: 2, totalParticipants: 10 } } } };
  const h = harness({ live: { features: [fresh] } });
  await h.api.loadCapacity();
  assert.equal(h.api.rows().length, 25);
  assert.equal(h.api.rows().find(r => r.id === 'NEW-PUBLISHED-TRAINING').female, 2);
  assert.equal(h.nodes['capacity-stat-participants'].textContent, '1.000');
});

test('repeated reports merge documents and photos, rather than losing them or increasing counts', async () => {
  const p = snapshot.capacitySources.reports.features.find(f => f.properties.reportType === 'Capacity Building');
  const h = harness({ cloud: { features: [p] }, live: { features: [p] } });
  await h.api.loadCapacity();
  assert.equal(h.api.rows().length, 24);
  const rows = h.api.mergeCapacityRecords([{ id: 'same', name: 'session', date: '2026-01-01', location: 'A', documents: ['https://example.org/report'], photos: ['https://example.org/a.jpg'] }, { id: 'same', documents: [], photos: ['https://example.org/b.jpg'] }]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].documents.length, 1);
  assert.equal(rows[0].photos.length, 2);
});

test('draft/rejected reports are excluded and malformed snapshots cannot empty the archive', async () => {
  const draft = { properties: { reportId: 'draft', reportType: 'Capacity Building', status: 'Menunggu Verifikasi' } };
  const h = harness({ cloud: {}, live: { features: [draft] } });
  await h.api.loadCapacity();
  assert.equal(h.api.rows().length, 24);
  assert.ok(!h.api.rows().some(r => r.id === 'draft'));
});

test('filters remain selected during background updates and document URLs cannot inject script', async () => {
  const h = harness();
  h.nodes['capacity-year'].value = '2025';
  await h.api.loadCapacity();
  assert.equal(h.nodes['capacity-year'].value, '2025');
  assert.equal(h.nodes['capacity-stat-activities'].textContent, '6');
  assert.equal(h.api.documentUrls('https://example.org/a https://example.org/b').length, 2);
  assert.equal(h.api.evidenceLinks({ evidenceLinks: [{ label: 'bad', url: 'javascript:alert(1)' }] }).length, 0);
});
