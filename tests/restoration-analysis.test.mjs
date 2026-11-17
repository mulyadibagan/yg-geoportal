import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { analyze, analysisGeoJSON, analysisCSV, analysisReport } from '../js/restoration-analysis.mjs';

function fixture() {
  const id = n => 'bbsdlp-1234567890abcdef-' + String(n).padStart(4, '0');
  const definitions = [['Desa Z', 'Kota Dumai', 'P1', 7, [1, 2]], ['Desa A', 'Bengkalis', 'P2', 0, [2]],
    ['Desa B', 'Kota Dumai', 'P3', 0, [3]], ['Desa D', 'Bengkalis', 'D', 0, [4]], ['Desa N', 'Bengkalis', 'N', 0, []]];
  const units = ['P1', 'P2', 'P3', 'D'].map((prioritas, i) => ({ unit_id: id(i + 1), baris_asal: i + 1,
    prioritas, geometri_valid: true, sel_bukti: i === 0 ? 12 : 0, api_2015_17: 'Teramati', kanal_arsip: 'Teramati', loss_18_25: i < 2 ? 'Teramati' : 'Belum terkonfirmasi' }));
  const desa = definitions.map(([desa, kabupaten, cls, cells, ids]) => ({ desa, kabupaten, kecamatan: 'Kecamatan', prioritas_kluster: cls,
    sel_bukti_setempat: cells, unit_P1_beririsan: ids.includes(1) ? 1 : 0, unit_P2_beririsan: ids.includes(2) ? 1 : 0,
    unit_P3_beririsan: ids.includes(3) ? 1 : 0, unit_unik: ids.length, status_batas: 'Referensi valid' }));
  return { access: 'staff_only', schemaVersion: 1, summary: { tanggal: '2026-11-16' }, referencePeatSha256: 'a'.repeat(64), sourceFileSha256: 'b'.repeat(64), desa, units,
    relations: definitions.flatMap((row, i) => row[4].map(n => ({ ...desa[i], unit_id: id(n) }))) };
}
test('analysis starts from evidence classes across all villages, independent of proposed focus names and targets', () => {
  const source = fixture(); source.proposalLocations = ['Desa B']; source.newBlocks = 8;
  const result = analyze(source);
  assert.deepEqual(result.rows.map(row => row.desa), ['Desa Z', 'Desa A', 'Desa B']);
  assert.equal(result.rows[0].sel_bukti_setempat, 7);
  assert.equal(result.rows[0].unitCounts.P1, 1);
  assert.equal(result.rows[0].unitIds.length, 2);
  assert.equal(result.uniqueUnits, 3); // shared unit 2 is not counted twice
  for (const row of result.rows) assert.deepEqual(row.needs, { newBlocks: null, repairBlocks: null, revegetationHa: null, rewettingHa: null });
  assert.equal(result.finalInterventions, 0);
  assert.equal(result.regions.find(row => row.name === 'Bengkalis').counts.P1, 0);
});
test('source-unit counts stay separate from local cells and incomplete classes do not imply absence of peat', () => {
  const result = analyze(fixture(), { class: 'all' });
  assert.equal(result.rows.length, 5);
  assert.match(result.rows.find(row => row.desa === 'Desa A').evidenceScope, /belum terlokalisasi/);
  assert.equal(result.rows.find(row => row.desa === 'Desa A').sel_bukti_setempat, 0);
  assert.match(result.rows.find(row => row.desa === 'Desa D').recommendation.gap, /tidak berarti prioritas rendah/);
  assert.match(result.rows.find(row => row.desa === 'Desa N').recommendation.gap, /tidak membuktikan lokasi bukan gambut/);
});
test('region, class and text filters select the same evidence rows used in exports', () => {
  assert.equal(analyze(fixture(), { region: 'Bengkalis' }).rows.length, 1);
  assert.equal(analyze(fixture(), { class: 'P1' }).rows[0].desa, 'Desa Z');
  assert.equal(analyze(fixture(), { search: 'desa b' }).rows[0].prioritas_kluster, 'P3');
  const empty = analyze(fixture(), { search: 'unknown' });
  assert.equal(empty.rows.length, 0); assert.equal(empty.uniqueUnits, 0);
  assert.throws(() => analyze(fixture(), { region: 'Other' }));
  assert.throws(() => analyze(fixture(), { class: 'final' }));
});
test('map keeps original source geometry and all linked valid unit classes, labels historical scope, and rejects wrong hashes', () => {
  const result = analyze(fixture(), { class: 'all' });
  const features = Array.from({ length: 4 }, (_, i) => ({ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[[i, 0], [i + 1, 0], [i + 1, 1], [i, 0]]] } }));
  assert.throws(() => analysisGeoJSON(result, features, 'wrong'));
  const map = analysisGeoJSON(result, features, 'a'.repeat(64));
  assert.equal(map.features.length, 4); assert.equal(map.metadata.interventionAreaCalculated, false);
  assert.equal(map.metadata.status, 'indikatif_historis'); assert.equal(map.metadata.planStatus, undefined);
  assert.deepEqual(map.features[0].geometry, features[0].geometry);
  assert.equal(map.features[1].properties.desa_terkait.length, 2);
  assert.equal(map.features[3].properties.kelas_verifikasi, 'D');
  assert.equal(map.features[0].properties.status_rencana, undefined);
  const single = analysisGeoJSON(result, features, 'a'.repeat(64), [result.rows[1]]);
  assert.equal(single.features.length, 1);
});
test('exports state data dates and unknown engineering quantities; CSV protects formula-like names', () => {
  const source = fixture(); source.desa[0].desa = ' =1+1'; source.relations.filter(row => row.desa === 'Desa Z').forEach(row => { row.desa = ' =1+1'; });
  const result = analyze(source), csv = analysisCSV(result), report = analysisReport(result);
  assert.match(csv, /'=?1\+1/);
  assert.match(report, /2015–2017/); assert.match(report, /tahun pengamatan belum pasti/);
  assert.match(report, /Jumlah sekat, luas pembasahan dan revegetasi belum dapat dihitung/);
  assert.doesNotMatch(report, /skenario|proposal|4 unit per kelurahan/i);
});
test('active page reads only the analysis source and offers no proposal selection or engineering targets', () => {
  const html = fs.readFileSync(new URL('../restoration-priority.html', import.meta.url), 'utf8');
  const ui = fs.readFileSync(new URL('../js/restoration-analysis-ui.js', import.meta.url), 'utf8');
  assert.match(html, /restoration-analysis-ui\.js/); assert.doesNotMatch(html, /restoration-plan-ui\.js|plan-scenario|plan-entries/);
  assert.doesNotMatch(ui, /applyDumaiScenario|\/restoration\/plan|expectedVersion|method: 'PUT'/);
  assert.match(ui, /\/restoration\/source/);
});
