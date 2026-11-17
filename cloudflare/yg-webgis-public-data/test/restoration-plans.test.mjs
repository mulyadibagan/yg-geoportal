import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { normalizeSource, quantity, draftPlan, applyDumaiScenario, summary, validatePlan, referenceGeoJSON, csv, report, keyOf } from '../../../js/restoration-plan-model.mjs';
import { handleRestoration, isRestorationRoute } from '../src/restoration-plans.mjs';
if (!globalThis.crypto) globalThis.crypto = webcrypto;
const id = n => 'bbsdlp-1234567890abcdef-' + String(n).padStart(4, '0');
function fixture() {
  const names = ['Tenggayun', 'Api-Api', 'Bukit Batu', 'Sukajadi', 'Kelurahan Pelintung', 'Kelurahan Guntung'];
  const desa = names.map((desa, i) => ({ kabupaten: i < 4 ? 'Bengkalis' : 'Kota Dumai', kecamatan: 'Kecamatan sumber', desa,
    prioritas_kluster: i === 5 ? 'P3' : 'P2', sel_bukti_setempat: 0, unit_P1_beririsan: 0, unit_P2_beririsan: 1,
    unit_P3_beririsan: 0, unit_unik: 1, status_batas: 'Referensi' }));
  return { schemaVersion: 1, access: 'staff_only', summary: { tanggal: '2026-11-16' }, referencePeatSha256: 'a'.repeat(64), sourceFileSha256: 'b'.repeat(64),
    desa, units: [{ unit_id: id(1), baris_asal: 1, prioritas: 'P2', geometri_valid: true, sel_bukti: 0,
      api_2015_17: 'Teramati', kanal_arsip: 'Teramati', loss_18_25: 'Teramati' }],
    relations: desa.map(row => ({ ...row, unit_id: id(1) })) };
}
test('source normalization preserves village-unit relationships across save/load and rejects broken lineage', () => {
  const source = normalizeSource(fixture());
  assert.deepEqual(normalizeSource(source), source);
  const broken = structuredClone(source); broken.relations[0].key = 'Unknown';
  assert.throws(() => normalizeSource(broken));
  const badIndex = fixture(); badIndex.units[0].baris_asal = 2;
  assert.throws(() => normalizeSource(badIndex));
  const missingHash = fixture(); delete missingHash.referencePeatSha256;
  assert.throws(() => normalizeSource(missingHash));
});
test('blank target remains unknown; an explicit scenario changes only the two Dumai targets', () => {
  assert.equal(quantity(''), null); assert.equal(quantity('0'), 0);
  for (const bad of ['-1', '1.5', '1e2', ' 2 ', 1001, NaN]) assert.throws(() => quantity(bad));
  const source = normalizeSource(fixture()), draft = draftPlan(source, 'source-v1');
  assert.equal(summary(draft).newBlocks.unknownLocations, 6);
  const scenario = applyDumaiScenario(draft, source);
  assert.deepEqual(summary(scenario).newBlocks, { known: 8, unknownLocations: 4 });
  assert.equal(summary(scenario).uniqueUnits, 1);
  assert.equal(summary(draft).newBlocks.known, 0);
  scenario.entries[4].newBlocks = 9;
  assert.throws(() => applyDumaiScenario(scenario, source));
});
test('plan cannot assign units from another village, duplicate entries, or mislabel final status', () => {
  const source = normalizeSource(fixture()), p = draftPlan(source, 'v1');
  p.entries[0].unitIds = [id(2)]; assert.throws(() => validatePlan(p, source));
  p.entries[0].unitIds = [id(1)]; p.entries.push(p.entries[0]); assert.throws(() => validatePlan(p, source));
  p.entries.pop(); p.status = 'final'; assert.throws(() => validatePlan(p, source));
});
test('reference map export is deduplicated, preserves geometry, requires source hash and labels its scope', () => {
  const source = normalizeSource(fixture()), p = draftPlan(source, 'v1');
  const geometry = { type: 'Polygon', coordinates: [[[100, 0], [101, 0], [101, 1], [100, 0]]] };
  const features = [{ type: 'Feature', geometry, properties: { untouched: true } }];
  assert.throws(() => referenceGeoJSON(p, source, features, 'different'));
  const geo = referenceGeoJSON(p, source, features, 'a'.repeat(64));
  assert.equal(geo.features.length, 1); assert.deepEqual(geo.features[0].geometry, geometry);
  assert.equal(geo.metadata.interventionAreaCalculated, false);
  assert.match(geo.features[0].properties.lingkup, /bukan poligon intervensi/);
  geo.features[0].geometry.coordinates[0][0][0] = 0; assert.equal(geometry.coordinates[0][0][0], 100);
});
test('proposal report keeps unknown quantities distinct, and CSV escapes spreadsheet formulas', () => {
  const source = normalizeSource(fixture()), p = draftPlan(source, 'v1'); p.entries[0].note = '=HYPERLINK("test")';
  assert.match(csv(p, source), /"'=HYPERLINK\(""test""\)"/);
  assert.match(report(p, source), /Sekat baru: Belum dihitung/);
  assert.match(report(p, source), /Inventaris struktur eksisting belum direkonsiliasi/);
});
class Bucket {
  constructor() { this.records = new Map(); this.calls = 0; this.number = 0; }
  async get(key) { this.calls++; const o = this.records.get(key); return o ? { etag: o.etag, json: async () => JSON.parse(o.data) } : null; }
  async put(key, data, options = {}) {
    this.calls++; const before = this.records.get(key), h = options.onlyIf;
    if (h && ((h.get('if-none-match') === '*' && before) || (h.has('if-match') && h.get('if-match') !== '"' + before?.etag + '"'))) return null;
    const value = { data, etag: 'version-' + ++this.number }; this.records.set(key, value); return value;
  }
}
const authorize = async token => token === 'staff-token';
const req = (resource, method = 'GET', body, extra = {}) => new Request('https://api.test/api/staff/restoration/' + resource, {
  method, headers: { origin: 'https://webgisyg.id', authorization: 'Bearer staff-token', 'content-type': 'application/json', ...extra },
  ...(body === undefined ? {} : { body: JSON.stringify(body) })
});
test('staff token and exact origin are enforced before accessing storage; no public route alias', async () => {
  const bucket = new Bucket(), env = { PUBLIC_SNAPSHOTS: bucket };
  assert.equal((await handleRestoration(req('source', 'GET', undefined, { authorization: '' }), env, authorize)).status, 401);
  assert.equal((await handleRestoration(req('source', 'GET', undefined, { origin: 'https://untrusted.test' }), env, authorize)).status, 403);
  assert.equal(bucket.calls, 0);
  assert.equal(isRestorationRoute('/snapshots/internal/restoration/source'), false);
  const r = await handleRestoration(req('source', 'OPTIONS'), env, authorize); assert.equal(r.status, 204);
  assert.equal(r.headers.get('access-control-allow-origin'), 'https://webgisyg.id');
});
test('private source and plan survive load; conditional writes prevent concurrent overwrite', async () => {
  const bucket = new Bucket(), env = { PUBLIC_SNAPSHOTS: bucket };
  const call = request => handleRestoration(request, env, authorize);
  assert.equal((await call(req('source'))).status, 404);
  const saved = await (await call(req('source', 'PUT', { expectedVersion: null, value: fixture() }))).json();
  assert.equal(saved.ok, true); assert.equal(saved.value.relations.length, 6);
  const loaded = await (await call(req('source'))).json(); assert.deepEqual(loaded, saved);
  assert.equal((await call(req('source', 'PUT', { expectedVersion: null, value: fixture() }))).status, 409);
  assert.equal((await call(req('source', 'PUT', { value: fixture() }))).status, 428);
  const plan = draftPlan(saved.value, saved.version);
  const savedPlan = await (await call(req('plan', 'PUT', { expectedVersion: null, value: plan }))).json(); assert.equal(savedPlan.ok, true);
  plan.entries[0].newBlocks = 3;
  assert.equal((await call(req('plan', 'PUT', { expectedVersion: null, value: plan }))).status, 409);
  assert.equal((await (await call(req('plan'))).json()).value.entries[0].newBlocks, null);
  assert.equal((await call(req('plan', 'PUT', { expectedVersion: savedPlan.version, value: plan }))).status, 200);
  plan.sourceVersion = 'stale';
  assert.equal((await call(req('plan', 'PUT', { expectedVersion: savedPlan.version, value: plan }))).status, 409);
  const tooLarge = req('source', 'PUT', {}, { 'content-length': String(7 * 1024 * 1024) });
  assert.equal((await call(tooLarge)).status, 413);
  for (const [key] of bucket.records) assert.ok(key.startsWith('internal/restoration/'));
});
