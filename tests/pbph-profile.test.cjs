const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');

test('PBPH snapshot groups 187 polygon parts into 56 stable profiles', () => {
  const geo = JSON.parse(read('data/PBPH_RIAU_052026.geojson'));
  const ids = new Set(geo.features.map(feature => String(feature.properties.PBPH_ID || '').trim()));
  assert.equal(geo.features.length, 187);
  assert.equal(ids.size, 56);
  assert.ok(!ids.has(''));
});

test('PBPH profile uses frozen monthly reports starting July 2026', () => {
  const controller = read('js/pbph-profile.js');
  assert.match(controller, /REPORT_START="2026-07"/);
  assert.match(controller, /data\/fire-monthly\/index\.json/);
  assert.match(controller, /row\.status==="final"/);
  assert.match(controller, /report\.companies/);
  assert.match(controller, /report\.hotspots/);
  assert.doesNotMatch(controller, /hotspot-high-confidence\.geojson/);
});

test('July report assigns two hotspots to Diamond Raya Timber', () => {
  const report = JSON.parse(read('data/fire-monthly/2026-07.json'));
  const company = report.companies.find(row => row.name === 'PT DIAMOND RAYA TIMBER');
  assert.equal(report.status, 'final');
  assert.equal(company.hotspots, 2);
  assert.equal(report.hotspots.filter(point => point.permits.some(row => row.name === company.name)).length, 2);
});

test('map and PBPH hotspot polygons link to the dedicated profile', () => {
  const map = read('js/map-v4.js');
  const analysis = read('js/hotspot-analysis.js');
  const html = read('pbph-profile.html');
  assert.match(map, /pbph-profile\.html\?id=/);
  assert.match(map, /Buka Profil PBPH/);
  assert.match(analysis, /pbph-profile\.html\?id=/);
  assert.match(html, /Riwayat laporan bulanan/);
  assert.match(html, /Dokumen pendukung/i);
});

test('PBPH profile separates permit documents from conservative SVLK status', () => {
  const html = read('pbph-profile.html');
  const controller = read('js/pbph-profile.js');
  const registry = JSON.parse(read('data/pbph-documents.json'));
  const diamond = registry.profiles['443,1998'];
  assert.doesNotMatch(html, /Sumber spasial resmi/i);
  assert.doesNotMatch(controller, /registry\.source/);
  assert.match(html, /SVLK &amp; PHL/);
  assert.equal(diamond.documents.length, 0);
  assert.equal(diamond.svlk.status, 'audit-announcement-found');
  assert.equal(diamond.svlk.certificateNumber, null);
  assert.match(diamond.svlk.note, /bukan sertifikat dan bukan keputusan PBPH/i);

  const msk = registry.profiles['643,2019'];
  assert.equal(msk.documents.length, 0);
  assert.equal(msk.svlk.status, 'certificate-verified');
  assert.equal(msk.svlk.certificateNumber, 'SPHL.26/ASERT/LPVI-001-IDN');
  assert.equal(msk.svlk.validUntil, '27 Desember 2030');
  assert.match(msk.svlk.note, /bukan salinan keputusan PBPH/i);

  const ruj = registry.profiles['641,2018'];
  assert.equal(ruj.documents.length, 1);
  assert.equal(ruj.svlk.status, 'certificate-verified');
  assert.equal(ruj.svlk.certificateNumber, 'SPHL.64/ASERT/LPVI-001-IDN');
  assert.equal(ruj.svlk.validUntil, '9 April 2029');

  const arara = registry.profiles['743,1996'];
  assert.equal(arara.documents.length, 1);
  assert.equal(arara.svlk.status, 'certificate-verified');
  assert.equal(arara.svlk.certificateNumber, 'SPHL.72/ASERT/LPVI-001-IDN');
  assert.equal(arara.svlk.validUntil, '24 Juli 2031');

  const rapp = registry.profiles['180,2013'];
  assert.equal(rapp.documents.length, 0);
  assert.equal(rapp.svlk.status, 'certificate-verified');
  assert.equal(rapp.svlk.certificateNumber, 'LPVI-008/MUTU/FM-001');
  assert.equal(rapp.svlk.validUntil, '19 Oktober 2030');

  const bbha = registry.profiles['365,2003'];
  assert.equal(bbha.documents.length, 0);
  assert.equal(bbha.svlk.status, 'certificate-verified');
  assert.equal(bbha.svlk.certificateNumber, 'SPHL.69/ASERT/LPVI-001-IDN');
  assert.equal(bbha.svlk.validUntil, '24 Oktober 2030');

  const nsr = registry.profiles['550,2012'];
  assert.equal(nsr.documents.length, 0);
  assert.equal(nsr.svlk.status, 'certificate-verified');
  assert.equal(nsr.svlk.certificateNumber, 'SPHL.35/ASERT/LPVI-001-IDN');
  assert.equal(nsr.svlk.validUntil, '27 Februari 2027');

  const tuah = registry.profiles['215,2007'];
  assert.equal(tuah.documents.length, 0);
  assert.equal(tuah.svlk.status, 'certificate-verified');
  assert.equal(tuah.svlk.certificateNumber, 'SPHL.40/ASERT/LPVI-001-IDN');
  assert.equal(tuah.svlk.validUntil, '4 Mei 2029');
  assert.match(tuah.svlk.note, /register klien aktif/i);

  const spa = registry.profiles['244,2000'];
  assert.equal(spa.documents.length, 0);
  assert.equal(spa.svlk.status, 'certificate-expired');
  assert.equal(spa.svlk.certificateNumber, 'EQC-PHL-004');
  assert.equal(spa.svlk.validUntil, '12 November 2024');
  assert.match(spa.svlk.note, /tidak digabung dengan unit Serapung atau KTH Sinar Merawang/i);

  const pspi = registry.profiles['249,1996'];
  assert.equal(pspi.documents.length, 1);
  assert.equal(pspi.svlk.status, 'certificate-verified');
  assert.equal(pspi.svlk.certificateNumber, 'EQC-PHL-005');
  assert.equal(pspi.svlk.validUntil, '27 November 2030');

  const spm = registry.profiles['366,2003'];
  assert.equal(spm.documents.length, 0);
  assert.equal(spm.svlk.status, 'certificate-verified');
  assert.equal(spm.svlk.certificateNumber, 'EQC-PHL-045');
  assert.equal(spm.svlk.validUntil, '29 September 2030');

  const tbo = registry.profiles['747,2014'];
  assert.equal(tbo.documents.length, 0);
  assert.equal(tbo.svlk.status, 'certificate-verified');
  assert.equal(tbo.svlk.certificateNumber, 'LPVI-008/MUTU/FM-039');
  assert.equal(tbo.svlk.validUntil, '29 Agustus 2030');

  const gan = registry.profiles['230,2014'];
  assert.equal(gan.documents.length, 0);
  assert.equal(gan.svlk.status, 'certificate-verified');
  assert.equal(gan.svlk.certificateNumber, 'LPVI-008/MUTU/FM-037');
  assert.equal(gan.svlk.validUntil, '22 Agustus 2030');

  const smn = registry.profiles['162,2014'];
  assert.equal(smn.documents.length, 0);
  assert.equal(smn.svlk.status, 'certificate-verified');
  assert.equal(smn.svlk.certificateNumber, 'LPVI-008/MUTU/FM-038');
  assert.equal(smn.svlk.validUntil, '26 Agustus 2030');

  const sgp = registry.profiles['71,2001'];
  assert.equal(sgp.documents.length, 1);
  assert.equal(sgp.svlk.status, 'audit-announcement-found');
  assert.equal(sgp.svlk.certificateNumber, null);
  assert.equal(sgp.svlk.validUntil, '18 Januari 2032');
  assert.match(sgp.svlk.note, /sertifikat lama.*berakhir 18 Januari 2026/i);

  const peranap = registry.profiles['214,2007'];
  assert.equal(peranap.documents.length, 0);
  assert.equal(peranap.svlk.status, 'audit-announcement-found');
  assert.equal(peranap.svlk.certificateNumber, null);
  assert.equal(peranap.svlk.validUntil, null);
  assert.match(peranap.svlk.note, /IFCC berbeda dari S-PHL nasional/i);

  const nwr = registry.profiles['241,2007'];
  assert.equal(nwr.svlk.status, 'certificate-verified');
  assert.equal(nwr.svlk.certificateNumber, '40-SIC-04.01');
  assert.equal(nwr.svlk.validUntil, '12 Januari 2027');
  assert.match(nwr.svlk.note, /842 Tahun 2025/i);

  const bdl = registry.profiles['46,2019'];
  assert.equal(bdl.svlk.status, 'certificate-verified');
  assert.equal(bdl.svlk.certificateNumber, '026/S-PHPL/GRS/X/2021');
  assert.equal(bdl.svlk.validUntil, '25 Oktober 2027');

  const nsp = registry.profiles['380,2009'];
  assert.equal(nsp.svlk.status, 'certificate-not-found');
  assert.equal(nsp.svlk.certificateNumber, null);
  assert.match(nsp.svlk.scope, /bukan kayu.*sagu/i);

  const gcnMeranti = registry.profiles['825,2013'];
  assert.equal(gcnMeranti.svlk.status, 'certificate-verified');
  assert.equal(gcnMeranti.svlk.certificateNumber, 'LPVI-008/MUTU/FM-035');
  assert.equal(gcnMeranti.svlk.validUntil, '15 Agustus 2030');
  assert.match(gcnMeranti.svlk.note, /tidak digabung dengan unit Kabupaten Pelalawan/i);

  const nmr = registry.profiles['02202028800340009,2026'];
  assert.equal(nmr.svlk.status, 'certificate-not-found');
  assert.match(nmr.svlk.scope, /jasa lingkungan/i);
  assert.match(nmr.svlk.note, /bukan.*salinan SK/i);

  const cpi = registry.profiles['14012200375810004,2024'];
  assert.equal(cpi.svlk.status, 'certificate-not-found');
  assert.match(cpi.svlk.note, /29\.492 hektar/i);

  const mfj = registry.profiles['01032200340080008, 2025'];
  assert.equal(mfj.svlk.status, 'certificate-not-found');
  assert.match(mfj.svlk.note, /20\.723 hektar.*25\.248 hektar/i);

  const gcnPelalawan = registry.profiles['395,2012'];
  assert.equal(gcnPelalawan.svlk.status, 'certificate-verified');
  assert.equal(gcnPelalawan.svlk.certificateNumber, 'LPVI-008/MUTU/FM-036');
  assert.equal(gcnPelalawan.svlk.validUntil, '20 Agustus 2030');
  assert.match(gcnPelalawan.svlk.note, /tidak digabung dengan unit Kabupaten Kepulauan Meranti/i);

  const bdb = registry.profiles['555,2006'];
  assert.equal(bdb.svlk.status, 'certificate-expired');
  assert.equal(bdb.svlk.certificateNumber, '013.4/EQC-PHPL/VI/2018');
  assert.equal(bdb.svlk.validUntil, '28 Juni 2023');
  assert.match(bdb.svlk.note, /label PHPL.*tidak digunakan sebagai bukti sertifikat aktif/i);

  const ssl = registry.profiles['22,2007'];
  assert.equal(ssl.svlk.status, 'audit-announcement-found');
  assert.equal(ssl.svlk.certificateNumber, null);
  assert.match(ssl.svlk.note, /IFCC.*skema berbeda/i);

  const rimbaLazuardi = registry.profiles['361,1996'];
  assert.equal(rimbaLazuardi.svlk.status, 'certificate-verified');
  assert.equal(rimbaLazuardi.svlk.certificateNumber, '034.4/EQC-PHPL/III/2021');
  assert.equal(rimbaLazuardi.svlk.validUntil, '2 Maret 2027');

  const bkm = registry.profiles['642,2018'];
  assert.equal(bkm.svlk.status, 'certificate-verified');
  assert.equal(bkm.svlk.certificateNumber, '23-PHL-024');
  assert.equal(bkm.svlk.validUntil, '1 Agustus 2031');
  assert.match(bkm.svlk.note, /SK\.772.*16\.514 hektar/i);

  const artelindo = registry.profiles['122,2007'];
  assert.equal(artelindo.svlk.status, 'audit-announcement-found');
  assert.equal(artelindo.svlk.certificateNumber, 'IMS-SPHL-027');
  assert.equal(artelindo.svlk.validUntil, null);
  assert.match(artelindo.svlk.note, /masa berlaku.*belum ditemukan/i);

  const harapanjaya = registry.profiles['016,2003'];
  assert.equal(harapanjaya.svlk.status, 'certificate-verified');
  assert.equal(harapanjaya.svlk.certificateNumber, 'SPHL.47/ASERT/LPVI-001-IDN');
  assert.equal(harapanjaya.svlk.validUntil, '3 Januari 2030');
  assert.match(harapanjaya.svlk.note, /SK\.807.*5\.086,44 hektar/i);

  const madukoro = registry.profiles['017,2003'];
  assert.equal(madukoro.svlk.status, 'certificate-verified');
  assert.equal(madukoro.svlk.certificateNumber, 'SPHL.45/ASERT/LPVI-001-IDN');
  assert.equal(madukoro.svlk.validUntil, '3 Desember 2029');
  assert.match(madukoro.svlk.note, /SK\.835.*14\.900,70 hektar/i);

  const hijauBakau = registry.profiles['10022200574330004, 2025'];
  assert.equal(hijauBakau.svlk.status, 'certificate-not-found');
  assert.equal(hijauBakau.svlk.certificateNumber, null);
  assert.match(hijauBakau.svlk.note, /konsep SK.*izin 10022200574330004.*19\.719 hektar/i);

  const mitraHutani = registry.profiles['101,2006'];
  assert.equal(mitraHutani.svlk.status, 'audit-announcement-found');
  assert.equal(mitraHutani.svlk.certificateNumber, 'IMS-SPHPL-008');
  assert.equal(mitraHutani.svlk.validUntil, null);
  assert.match(mitraHutani.svlk.note, /berakhir 13 November 2023.*tidak disajikan sebagai sertifikat aktif/i);

  const binaDayaBintara = registry.profiles['64,2007'];
  assert.equal(binaDayaBintara.svlk.status, 'certificate-verified');
  assert.equal(binaDayaBintara.svlk.certificateNumber, 'EQC-PHL-035');
  assert.equal(binaDayaBintara.svlk.validUntil, '11 Maret 2027');

  const bukitBatabuh = registry.profiles['67,2007'];
  assert.equal(bukitBatabuh.svlk.status, 'certificate-not-found');
  assert.equal(bukitBatabuh.svlk.certificateNumber, null);
  assert.match(bukitBatabuh.svlk.note, /IFCC.*skema sertifikasi berbeda.*tidak digunakan sebagai bukti S-PHL nasional/i);

  const citraSumber = registry.profiles['68,2007'];
  assert.equal(citraSumber.svlk.status, 'certificate-verified');
  assert.equal(citraSumber.svlk.certificateNumber, 'EQC-PHL-027');
  assert.equal(citraSumber.svlk.validUntil, '18 Januari 2027');

  const alam = registry.profiles['015,2003'];
  assert.equal(alam.svlk.status, 'certificate-verified');
  assert.equal(alam.svlk.certificateNumber, 'SPHL.43/ASERT/LPVI-001-IDN');
  assert.equal(alam.svlk.validUntil, '14 November 2029');
  assert.match(alam.svlk.note, /SK\.805.*4\.868,65 hektar/i);

  const bhakti = registry.profiles['011,2003'];
  assert.equal(bhakti.svlk.status, 'certificate-verified');
  assert.equal(bhakti.svlk.certificateNumber, 'LPVI-008/MUTU/FM-028');
  assert.equal(bhakti.svlk.validUntil, '17 Desember 2029');

  const mutiara = registry.profiles['007,2003'];
  assert.equal(mutiara.svlk.status, 'certificate-verified');
  assert.equal(mutiara.svlk.certificateNumber, 'SPHL.46/ASERT/LPVI-001-IDN');
  assert.equal(mutiara.svlk.validUntil, '26 Desember 2029');

  const putri = registry.profiles['005,2003'];
  assert.equal(putri.svlk.status, 'certificate-verified');
  assert.equal(putri.svlk.certificateNumber, 'SPHL.44/ASERT/LPVI-001-IDN');
  assert.equal(putri.svlk.validUntil, '23 November 2029');
});

test('internal source remarks are not rendered in the public PBPH profile', () => {
  const controller = read('js/pbph-profile.js');
  assert.doesNotMatch(controller, /item\("Catatan sumber"/);
  assert.doesNotMatch(controller, /p\.REMARK/);
});
