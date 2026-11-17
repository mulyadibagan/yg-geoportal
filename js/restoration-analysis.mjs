import { normalizeSource, referenceGeoJSON } from './restoration-plan-model.mjs?v=20261117-plan1';

export const CLASS_ORDER = ['P1', 'P2', 'P3', 'D', 'N', 'X'];
export const CLASS_LABELS = { P1: 'Verifikasi tapak didahulukan', P2: 'Lokalisasi tekanan dalam unit', P3: 'Periksa tapak historis', D: 'Bukti belum cukup', N: 'Cakupan referensi belum memadai', X: 'Geometri perlu diperbaiki' };
export const COLORS = { P1: '#aa342d', P2: '#b16b16', P3: '#b89b27', D: '#738078', N: '#aab2ae', X: '#5f5868' };
const candidate = value => ['P1', 'P2', 'P3'].includes(value);
const ORDER = new Map(CLASS_ORDER.map((value, index) => [value, index]));
export function analyze(input, filters = {}) {
  const source = normalizeSource(input), byId = new Map(source.units.map(unit => [unit.unit_id, unit]));
  const links = new Map(source.villages.map(row => [row.key, []]));
  source.relations.forEach(link => links.get(link.key).push(byId.get(link.unit_id)));
  const rows = source.villages.map(row => {
    const units = links.get(row.key), valid = units.filter(unit => unit.geometri_valid);
    const unitCounts = Object.fromEntries(CLASS_ORDER.map(cls => [cls, valid.filter(unit => unit.prioritas === cls).length]));
    return { ...row, unitIds: valid.map(unit => unit.unit_id), candidateUnitIds: valid.filter(unit => candidate(unit.prioritas)).map(unit => unit.unit_id),
      unitCounts, priorityBasis: CLASS_LABELS[row.prioritas_kluster],
      evidenceScope: row.sel_bukti_setempat > 0 ? 'Sel bukti setempat tercatat dalam sumber' : 'Bukti unit referensi; belum terlokalisasi pada sel setempat',
      recommendation: recommendation(row), needs: { newBlocks: null, repairBlocks: null, revegetationHa: null, rewettingHa: null } };
  }).sort((a, b) => ORDER.get(a.prioritas_kluster) - ORDER.get(b.prioritas_kluster) || a.desa.localeCompare(b.desa, 'id') || a.key.localeCompare(b.key));
  const region = filters.region || '', cls = filters.class || 'candidate', search = (filters.search || '').trim().toLocaleLowerCase('id');
  if (region && !['Bengkalis', 'Kota Dumai'].includes(region)) throw Error('Wilayah analisis tidak didukung');
  if (!['all', 'candidate', ...CLASS_ORDER].includes(cls)) throw Error('Kelas analisis tidak didukung');
  const filtered = rows.filter(row => (!region || row.kabupaten === region) &&
    (cls === 'all' || (cls === 'candidate' ? candidate(row.prioritas_kluster) : row.prioritas_kluster === cls)) &&
    [row.desa, row.kecamatan, row.kabupaten].join(' ').toLocaleLowerCase('id').includes(search));
  const counts = list => Object.fromEntries(CLASS_ORDER.map(cls => [cls, list.filter(row => row.prioritas_kluster === cls).length]));
  const regions = ['Bengkalis', 'Kota Dumai'].map(name => {
    const group = rows.filter(row => row.kabupaten === name), ids = new Set(group.flatMap(row => row.unitIds));
    return { name, counts: counts(group), locations: group.length, candidates: group.filter(row => candidate(row.prioritas_kluster)).length,
      localCells: group.reduce((sum, row) => sum + row.sel_bukti_setempat, 0), uniqueUnits: ids.size,
      firstGroup: CLASS_ORDER.find(cls => group.some(row => row.prioritas_kluster === cls)) };
  });
  return { source, filters: { region, class: cls, search }, rows: filtered, allRows: rows, regions,
    counts: counts(rows), filteredCounts: counts(filtered), uniqueUnits: new Set(filtered.flatMap(row => row.unitIds)).size,
    candidateLocations: rows.filter(row => candidate(row.prioritas_kluster)).length, status: 'indikatif_historis', finalInterventions: 0 };
}
export function recommendation(row) {
  const group = row.prioritas_kluster;
  if (group === 'P1') return {
    next: 'Verifikasi tapak pada sel bukti setempat terlebih dahulu',
    water: 'Periksa kanal yang berhubungan dengan sel bukti, kondisi sekat dan muka air; tentukan kebutuhan pembasahan setelah aliran dan elevasi diukur.',
    vegetation: 'Periksa regenerasi alami dan tutupan terkini pada bekas bukaan; tentukan kebutuhan pengayaan atau penanaman setelah kondisi kebasahan diketahui.',
    gap: 'Kondisi sekarang, TMAT, aliran/elevasi kanal, inventaris struktur dan batas intervensi belum dikonfirmasi.' };
  if (group === 'P2') return {
    next: 'Petakan letak tekanan dalam unit sebelum memilih tapak restorasi',
    water: 'Telusuri kanal pada bagian unit yang benar-benar berada di desa; keberadaan kanal pada unit belum menetapkan kebutuhan sekat di desa.',
    vegetation: 'Cocokkan kehilangan tutupan dengan batas desa dan kondisi vegetasi sekarang; pisahkan bukaan yang telah pulih dari kerusakan yang masih berlangsung.',
    gap: 'Api, kanal dan kehilangan tutupan teramati pada unit; pertemuannya pada sel setempat belum terkonfirmasi.' };
  if (group === 'P3') return {
    next: 'Telusuri tapak api dan kanal historis serta kondisi pemulihannya',
    water: 'Periksa apakah drainase masih mengeringkan gambut dan apakah struktur lama berfungsi; ukur muka air sebelum menentukan pembasahan.',
    vegetation: 'Verifikasi tutupan terkini dan regenerasi di tapak historis sebelum menetapkan kebutuhan revegetasi.',
    gap: 'Bukti kehilangan tutupan 2018–2025 belum terkonfirmasi; kondisi kerusakan saat ini belum diketahui.' };
  return {
    next: group === 'X' ? 'Perbaiki geometri dan relasi sumber sebelum analisis lanjutan' : 'Lengkapi cakupan serta bukti kerusakan sebelum menentukan tindakan',
    water: 'Kebutuhan pembasahan belum dapat disimpulkan dari paket ini.', vegetation: 'Kebutuhan pemulihan vegetasi belum dapat disimpulkan dari paket ini.',
    gap: group === 'N' ? 'Cakupan unit referensi belum memadai; kelas ini tidak membuktikan lokasi bukan gambut.' : 'Data belum cukup tidak berarti prioritas rendah atau tidak ada kerusakan.' };
}
export function analysisGeoJSON(result, peatFeatures, peatHash, rows = result.rows) {
  const collection = referenceGeoJSON({ entries: rows.map(row => ({ key: row.key, unitIds: row.unitIds })) }, result.source, peatFeatures, peatHash);
  collection.metadata = { access: 'staff_only', status: 'indikatif_historis', sourceDate: result.source.provenance.date,
    sourceFileSha256: result.source.provenance.fileSha256, peatSha256: peatHash, filters: result.filters, interventionAreaCalculated: false };
  collection.features.forEach(feature => {
    delete feature.properties.status_rencana; delete feature.properties.desa_rencana;
    feature.properties.status_analisis = 'indikatif_historis';
    feature.properties.desa_terkait = rows.filter(row => row.unitIds.includes(feature.id)).map(row => row.key);
    feature.properties.lingkup = 'Unit gambut referensi utuh; kelas unit tidak otomatis berlaku untuk seluruh desa; bukan batas intervensi';
    const unit = result.source.units.find(unit => unit.unit_id === feature.id);
    Object.assign(feature.properties, { api_2015_17: unit.api_2015_17, kanal_arsip: unit.kanal_arsip, loss_18_25: unit.loss_18_25, sel_bukti_dalam_unit: unit.sel_bukti });
  });
  return collection;
}
const safeCSV = value => {
  let text = String(value ?? ''); if (/^\s*[=+@\-\t\r]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
};
export function analysisCSV(result) {
  const headings = ['Kabupaten', 'Kecamatan sumber', 'Desa', 'Kelas verifikasi', 'Sel bukti setempat', 'Unit P1', 'Unit P2', 'Unit P3', 'Unit D', 'Lingkup bukti', 'Tindak lanjut', 'Pemulihan tata air', 'Pemulihan vegetasi', 'Kesenjangan bukti', 'Kebutuhan sekat', 'Luas intervensi'];
  const rows = result.rows.map(row => [row.kabupaten, row.kecamatan, row.desa, row.prioritas_kluster, row.sel_bukti_setempat,
    row.unitCounts.P1, row.unitCounts.P2, row.unitCounts.P3, row.unitCounts.D, row.evidenceScope, row.recommendation.next,
    row.recommendation.water, row.recommendation.vegetation, row.recommendation.gap, 'Belum dapat dihitung', 'Belum ditetapkan']);
  return '\ufeff' + [headings, ...rows].map(row => row.map(safeCSV).join(',')).join('\r\n') + '\r\n';
}
export function analysisReport(result) {
  return '# Analisis kebutuhan restorasi gambut Bengkalis–Dumai\n\nStatus: penapisan historis untuk verifikasi tapak.\n' +
    'Tanggal kompilasi: ' + result.source.provenance.date + '; bukan tanggal observasi seluruh data.\n' +
    'Basis: gambut BBSDLP 2019; api historis 2015–2017; kehilangan tutupan pohon 2018–2025; kanal arsip (tahun pengamatan belum pasti).\n\n' +
    result.regions.map(region => '## ' + region.name + '\n\n' + region.candidates + ' kandidat P1–P3; P1 ' + region.counts.P1 + ', P2 ' + region.counts.P2 + ', P3 ' + region.counts.P3 +
      '; D ' + region.counts.D + ', N ' + region.counts.N + '. Jumlah catatan sel setempat per desa: ' + region.localCells + ' (bukan hitungan sel unik lintas desa).\n\n').join('') +
    '## Hasil sesuai filter\n\n' + JSON.stringify(result.filters) + '\n' + result.rows.length + ' lokasi; ' + result.uniqueUnits + ' unit referensi unik. Desa dalam kelas yang sama ditampilkan menurut nama, bukan tingkat kerusakan.\n\n' +
    result.rows.map(row => '### ' + row.desa + ' — ' + row.kabupaten + '\n\n' + row.prioritas_kluster + ' — ' + row.priorityBasis + '; ' + row.sel_bukti_setempat + ' sel setempat.\n' +
      row.evidenceScope + '.\n\n' + row.recommendation.next + '.\n\nTata air: ' + row.recommendation.water + '\n\nVegetasi: ' + row.recommendation.vegetation + '\n\nData lanjutan: ' + row.recommendation.gap + '\n\n').join('') +
    '## Batas keputusan\n\nKelas P1/P2/P3 mengurutkan verifikasi; tidak menetapkan status kerusakan resmi atau kesiapan konstruksi. Bukti pada unit tidak otomatis menjadi bukti di setiap desa yang beririsan. Jumlah sel bukan hektare. Kehilangan tutupan pohon bukan luas terbakar. Nol sel tercatat bukan bukti tidak ada kerusakan.\n\n' +
    'Jumlah sekat, luas pembasahan dan revegetasi belum dapat dihitung. Konfirmasi kanal/aliran/elevasi, TMAT, vegetasi terkini, KHG/fungsi gambut, inventaris sekat serta pengelola/tenurial diperlukan sebelum menetapkan tindakan.\n\n' +
    'SHA-256 sumber analisis: ' + result.source.provenance.fileSha256 + '\nSHA-256 geometri: ' + result.source.provenance.peatSha256 + '\n';
}
