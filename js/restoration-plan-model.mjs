export const REGIONS = ['Bengkalis', 'Kota Dumai'];
export const STAGES = ['survei', 'pembasahan', 'regenerasi', 'penanaman', 'perlindungan'];
export const QUANTITIES = ['newBlocks', 'repairBlocks', 'fdrs', 'tmat'];
const classes = ['P1', 'P2', 'P3', 'D', 'N', 'X'];
const text = (value, max = 300) => {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw Error('Teks sumber tidak valid');
  return value.trim();
};
const count = value => {
  if (!Number.isSafeInteger(value) || value < 0 || value > 100000) throw Error('Hitungan sumber tidak valid');
  return value;
};
export const keyOf = row => [row.kabupaten, row.kecamatan, row.desa].map(value => text(value, 180)).join('|');
export function quantity(value) {
  if (value === '' || value === null || value === undefined) return null;
  if (typeof value === 'string' && !/^\d{1,4}$/.test(value)) throw Error('Target unit harus bilangan bulat');
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < 0 || n > 1000) throw Error('Target unit di luar rentang 0–1000');
  return n;
}
export function normalizeSource(input) {
  if (!input || input.access !== 'staff_only' || input.schemaVersion !== 1) throw Error('Paket analisis staf tidak sesuai');
  const normalized = input.kind === 'restoration-source-v1';
  const provenance = normalized ? input.provenance : {
    date: input.summary?.tanggal,
    peatSha256: input.referencePeatSha256,
    fileSha256: input.sourceFileSha256,
    label: input.sourceLabel || 'Analisis indikatif restorasi Riau'
  };
  if (!/^20\d{2}-\d{2}-\d{2}$/.test(provenance?.date || '') ||
      !/^[a-f0-9]{64}$/.test(provenance?.peatSha256 || '') ||
      !/^[a-f0-9]{64}$/.test(provenance?.fileSha256 || '')) throw Error('Tanggal dan checksum sumber wajib tersedia');
  const rows = normalized ? input.villages : input.desa;
  if (!Array.isArray(rows) || rows.length > 3000 || !Array.isArray(input.units) || input.units.length > 1000 ||
      !Array.isArray(input.relations) || input.relations.length > 10000) throw Error('Struktur paket analisis tidak valid');
  const rowKeys = new Set();
  const villages = rows.filter(row => REGIONS.includes(row.kabupaten)).map(row => {
    const key = keyOf(row);
    if (rowKeys.has(key) || !classes.includes(row.prioritas_kluster)) throw Error('Identitas/kelas desa tidak valid');
    rowKeys.add(key);
    return { key, kabupaten: row.kabupaten, kecamatan: text(row.kecamatan, 180), desa: text(row.desa, 180),
      prioritas_kluster: row.prioritas_kluster, sel_bukti_setempat: count(row.sel_bukti_setempat),
      unit_P1_beririsan: count(row.unit_P1_beririsan), unit_P2_beririsan: count(row.unit_P2_beririsan),
      unit_P3_beririsan: count(row.unit_P3_beririsan), unit_unik: count(row.unit_unik),
      status_batas: text(row.status_batas || 'Periksa batas referensi') };
  });
  if (!villages.length) throw Error('Paket belum memuat Bengkalis atau Dumai');
  const unitIds = new Set(), indices = new Set();
  const units = input.units.map(unit => {
    if (!/^bbsdlp-[a-f0-9]{16}-\d{4}$/.test(unit.unit_id || '') || !Number.isSafeInteger(unit.baris_asal) ||
        unit.baris_asal < 1 || unit.baris_asal > 736 || !unit.unit_id.endsWith(String(unit.baris_asal).padStart(4, '0')) ||
        !classes.includes(unit.prioritas) || unitIds.has(unit.unit_id) || indices.has(unit.baris_asal) ||
        typeof unit.geometri_valid !== 'boolean') throw Error('Identitas unit gambut tidak valid');
    unitIds.add(unit.unit_id); indices.add(unit.baris_asal);
    return { unit_id: unit.unit_id, baris_asal: unit.baris_asal, prioritas: unit.prioritas,
      geometri_valid: unit.geometri_valid, sel_bukti: count(unit.sel_bukti),
      api_2015_17: text(unit.api_2015_17), kanal_arsip: text(unit.kanal_arsip), loss_18_25: text(unit.loss_18_25) };
  });
  const seen = new Set();
  const relations = input.relations.filter(row => normalized || REGIONS.includes(row.kabupaten)).flatMap(row => {
    const key = normalized ? row.key : keyOf(row);
    if (!rowKeys.has(key) || !unitIds.has(row.unit_id)) throw Error('Relasi desa–unit tidak sesuai');
    const id = key + '|' + row.unit_id;
    if (seen.has(id)) return [];
    seen.add(id);
    return [{ key, unit_id: row.unit_id }];
  });
  return { schemaVersion: 1, kind: 'restoration-source-v1', access: 'staff_only',
    provenance: { date: provenance.date, peatSha256: provenance.peatSha256, fileSha256: provenance.fileSha256,
      label: text(provenance.label || 'Analisis indikatif restorasi Riau', 300) }, villages, units, relations };
}
export function unitsFor(source, key) {
  const ids = new Set(source.relations.filter(row => row.key === key).map(row => row.unit_id));
  return source.units.filter(unit => ids.has(unit.unit_id) && unit.geometri_valid && ['P1', 'P2', 'P3'].includes(unit.prioritas));
}
export function guidance(row) {
  return ({
    P1: 'Dahulukan verifikasi sel bukti setempat, kondisi kanal dan tutupan kini; tentukan tapak pembasahan serta pemulihan vegetasi sesudah survei.',
    P2: 'Telusuri api, bukaan dan kanal pada bagian unit yang sama; inventarisasi struktur eksisting dan kaji pemulihan tata air.',
    P3: 'Periksa kanal dan tapak kebakaran historis; lengkapi bukti perubahan vegetasi dan kebutuhan pemulihan yang masih ada.',
    D: 'Lengkapi bukti spasial dan kondisi lapangan sebelum menyusun tindakan; data belum cukup tidak berarti prioritas rendah.',
    N: 'Periksa cakupan dan batas rujukan sebelum menentukan kebutuhan restorasi.'
  })[row.prioritas_kluster] || 'Periksa kualitas geometri sebelum melanjutkan analisis.';
}
const focusNames = ['Tenggayun', 'Api-Api', 'Bukit Batu', 'Sukajadi', 'Kelurahan Pelintung', 'Kelurahan Guntung'];
export function entryFor(source, key) {
  const row = source.villages.find(row => row.key === key);
  if (!row) throw Error('Desa tidak ada dalam sumber');
  return { key, unitIds: unitsFor(source, key).map(unit => unit.unit_id),
    newBlocks: null, repairBlocks: null, fdrs: null, tmat: null,
    stage: 'survei', months: '1–3', note: '', quantityBasis: 'Belum dihitung; menunggu inventaris dan survei kanal' };
}
export function draftPlan(source, sourceVersion) {
  return { schemaVersion: 1, status: 'draft', title: 'Draf Rencana Restorasi Gambut Bengkalis–Dumai',
    sourceVersion, sourceFileSha256: source.provenance.fileSha256,
    entries: source.villages.filter(row => focusNames.includes(row.desa)).map(row => entryFor(source, row.key)) };
}
export function validatePlan(input, source) {
  if (input?.schemaVersion !== 1 || input.status !== 'draft' || typeof input.sourceVersion !== 'string' ||
      !input.sourceVersion || input.sourceFileSha256 !== source.provenance.fileSha256 ||
      !Array.isArray(input.entries) || !input.entries.length || input.entries.length > 200) throw Error('Identitas draf rencana tidak valid');
  const seen = new Set();
  const entries = input.entries.map(entry => {
    const row = source.villages.find(row => row.key === entry.key);
    if (!row || seen.has(entry.key) || !STAGES.includes(entry.stage)) throw Error('Desa/tahap rencana tidak valid');
    seen.add(entry.key);
    const allowed = new Set(unitsFor(source, entry.key).map(unit => unit.unit_id));
    if (!Array.isArray(entry.unitIds) || entry.unitIds.length > 733 || new Set(entry.unitIds).size !== entry.unitIds.length ||
        entry.unitIds.some(id => !allowed.has(id))) throw Error('Unit rencana tidak sesuai relasi desa');
    const quantities = Object.fromEntries(QUANTITIES.map(field => [field, quantity(entry[field])]));
    if (typeof entry.note !== 'string' || entry.note.length > 2000 ||
        typeof entry.quantityBasis !== 'string' || entry.quantityBasis.length > 500 ||
        typeof entry.months !== 'string' || entry.months.length > 80) throw Error('Keterangan rencana terlalu panjang');
    return { key: entry.key, unitIds: entry.unitIds.slice(), ...quantities, stage: entry.stage,
      months: entry.months, note: entry.note, quantityBasis: entry.quantityBasis };
  });
  return { schemaVersion: 1, status: 'draft', title: text(input.title, 200),
    sourceVersion: input.sourceVersion, sourceFileSha256: input.sourceFileSha256, entries };
}
export function summary(plan) {
  const result = { locations: plan.entries.length };
  for (const field of QUANTITIES) result[field] = {
    known: plan.entries.reduce((sum, entry) => sum + (entry[field] ?? 0), 0),
    unknownLocations: plan.entries.filter(entry => entry[field] === null).length
  };
  result.uniqueUnits = new Set(plan.entries.flatMap(entry => entry.unitIds)).size;
  return result;
}
export function applyDumaiScenario(plan, source) {
  const copy = structuredClone(plan);
  for (const name of ['Kelurahan Pelintung', 'Kelurahan Guntung']) {
    const row = source.villages.find(row => row.kabupaten === 'Kota Dumai' && row.desa === name);
    if (!row) throw Error('Kelurahan skenario belum tersedia');
    let entry = copy.entries.find(entry => entry.key === row.key);
    if (!entry) { entry = entryFor(source, row.key); copy.entries.push(entry); }
    if (entry.newBlocks !== null && entry.newBlocks !== 4) throw Error('Target Dumai sudah diubah; periksa sebelum memakai skenario');
    entry.newBlocks = 4;
    entry.quantityBasis = 'Skenario anggaran awal 4 unit per kelurahan; belum hasil perhitungan hidrologis';
  }
  return copy;
}
export function referenceGeoJSON(plan, source, peatFeatures, peatHash) {
  if (peatHash !== source.provenance.peatSha256) throw Error('Versi geometri gambut berbeda dari sumber analisis');
  const ids = new Set(plan.entries.flatMap(entry => entry.unitIds));
  const features = source.units.filter(unit => ids.has(unit.unit_id)).map(unit => {
    const original = peatFeatures[unit.baris_asal - 1];
    if (!original?.geometry || !unit.geometri_valid) throw Error('Geometri unit referensi tidak tersedia');
    return { type: 'Feature', id: unit.unit_id, geometry: structuredClone(original.geometry),
      properties: { unit_id: unit.unit_id, kelas_verifikasi: unit.prioritas, status_rencana: 'draft',
        lingkup: 'Unit referensi utuh; bukan poligon intervensi atau luas restorasi',
        desa_rencana: plan.entries.filter(entry => entry.unitIds.includes(unit.unit_id)).map(entry => entry.key) } };
  });
  return { type: 'FeatureCollection', metadata: { access: 'staff_only', planStatus: 'draft',
    sourceFileSha256: source.provenance.fileSha256, peatSha256: peatHash, interventionAreaCalculated: false }, features };
}
const display = value => value === null ? 'Belum dihitung' : String(value);
export function report(plan, source, inventory = null) {
  const rows = plan.entries.map(entry => {
    const row = source.villages.find(row => row.key === entry.key);
    const assets = inventory?.filter(item => item.key === entry.key);
    return { ...row, ...entry, assets };
  });
  const s = summary(plan);
  return '# ' + plan.title + '\n\nStatus: DRAF UNTUK VERIFIKASI TAPAK\n' +
    'Wilayah: Bengkalis dan Kota Dumai. Sumber analisis: ' + source.provenance.date + '.\n\n' +
    'Jumlah lokasi: ' + s.locations + '; unit referensi unik: ' + s.uniqueUnits +
    '. Unit referensi tidak dijumlahkan sebagai luas intervensi.\n\n' +
    rows.map(row => '## ' + row.desa + ' — ' + row.kabupaten + '\n\n' +
      'Kecamatan sumber: ' + row.kecamatan + '. Kelas urutan verifikasi: ' + row.prioritas_kluster +
      '; sel bukti setempat: ' + row.sel_bukti_setempat + '; unit terpilih: ' + row.unitIds.length + '.\n\n' +
      guidance(row) + '\n\nTarget usulan:\n' +
      '- Sekat baru: ' + display(row.newBlocks) + ' unit\n- Perbaikan sekat: ' + display(row.repairBlocks) +
      ' unit\n- FDRS: ' + display(row.fdrs) + ' unit\n- Pemantauan TMAT: ' + display(row.tmat) + ' titik\n\n' +
      'Dasar target: ' + row.quantityBasis + '. Tahap: ' + row.stage + '; bulan: ' + row.months + '.\n\n' +
      (row.assets ? 'Inventaris YG yang dimuat: ' + row.assets.length + ' catatan; bukan seluruh infrastruktur di wilayah.' : 'Inventaris struktur eksisting belum direkonsiliasi untuk rencana ini.') + '\n\n' +
      (row.note ? 'Catatan: ' + row.note + '\n\n' : '')).join('') +
    '## Tahapan bersama\n\n1. Verifikasi kanal, aliran/elevasi, bekas terbakar dan vegetasi terkini.\n' +
    '2. Periksa KHG/fungsi gambut, PBPH, PS, HGU/perkebunan, pengelola serta persetujuan masyarakat.\n' +
    '3. Tetapkan poligon intervensi, desain dan jumlah struktur; evaluasi pengaruh terhadap kebun/permukiman.\n' +
    '4. Laksanakan pembasahan dan pemulihan vegetasi sesuai hasil survei, disertai pemantauan dan pemeliharaan.\n\n' +
    'P1/P2/P3 mengurutkan verifikasi dari bukti historis, bukan kelayakan pembangunan. Jumlah sel bukan hektare. ' +
    'Target yang diisi adalah usulan; belum pengesahan desain hidrologis. Data kosong tidak dianggap nol.\n\n' +
    'Checksum sumber: ' + source.provenance.fileSha256 + '\nVersi sumber tersimpan: ' + plan.sourceVersion + '\n';
}
export function csv(plan, source) {
  const cell = value => {
    let s = String(value ?? '');
    if (/^[=+@\-\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replaceAll('"', '""') + '"';
  };
  const header = ['Kabupaten', 'Kecamatan sumber', 'Desa', 'Kelas verifikasi', 'Sel bukti setempat', 'Sekat baru usulan', 'Perbaikan sekat usulan', 'FDRS usulan', 'TMAT usulan', 'Dasar target', 'Tahap', 'Bulan', 'Catatan'];
  const rows = plan.entries.map(entry => {
    const row = source.villages.find(row => row.key === entry.key);
    return [row.kabupaten, row.kecamatan, row.desa, row.prioritas_kluster, row.sel_bukti_setempat,
      ...QUANTITIES.map(field => entry[field] === null ? 'Belum dihitung' : entry[field]),
      entry.quantityBasis, entry.stage, entry.months, entry.note];
  });
  return '\ufeff' + [header, ...rows].map(row => row.map(cell).join(',')).join('\r\n') + '\r\n';
}

