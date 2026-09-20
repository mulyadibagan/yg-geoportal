import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  area,
  bbox,
  booleanPointInPolygon,
  booleanIntersects,
  difference,
  featureCollection,
  intersect,
  lineString,
  length as turfLength,
  pointOnFeature,
  pointToLineDistance,
  simplify,
  union
} from "@turf/turf";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "../../..");
const TARGET_VILLAGES = new Set([
  "bagan barat",
  "bagan hulu",
  "bagan kota",
  "bagan punak",
  "bagan timur",
  "bagan jawa",
  "bagan jawa pesisir",
  "bagan punak meranti",
  "bagan punak pesisir",
  "labuhan tangga besar",
  "labuhan tangga hilir"
]);

const REGULATION_REGISTER = [
  {
    id: "R01", scope: "inti", code: "UU 26/2007 jo. UU 6/2023", title: "Penataan Ruang",
    status: "berlaku dengan perubahan", officialUrl: "https://peraturan.bpk.go.id/Details/39908/uu-no-26-tahun-2007",
    officialUrls: [
      { label: "UU 26/2007", url: "https://peraturan.bpk.go.id/Details/39908/uu-no-26-tahun-2007" },
      { label: "Perubahan terakhir UU 6/2023", url: "https://peraturan.bpk.go.id/Details/246523/uu-no-6-tahun-2023" }
    ],
    obligation: "RDTR harus konsisten dengan hierarki rencana, menjamin keterpaduan, keberlanjutan, keterbukaan, partisipasi, kepastian hukum, serta menyediakan instrumen pemanfaatan dan pengendalian ruang.",
    ygTest: "Uji konsistensi vertikal, keterlacakan masukan masyarakat, perlindungan fungsi lindung, dan apakah ketentuan zonasi dapat dilaksanakan serta diawasi."
  },
  {
    id: "R02", scope: "inti", code: "PP 21/2021", title: "Penyelenggaraan Penataan Ruang",
    status: "berlaku", officialUrl: "https://peraturan.bpk.go.id/Details/161851/pp-no-21-tahun-2021",
    obligation: "Pasal 24, 54–59, dan 83–91 mengatur RDTR kabupaten/kota yang disusun pemerintah daerah dengan mengacu RTRW, memuat lima muatan wajib, memakai peta skala 1:5.000, melibatkan masyarakat, dan ditetapkan sebagai perkada setelah persetujuan substansi. Penyusunan sampai penetapan paling lama 12 bulan sejak dimulai.",
    ygTest: "Uji dasar WP, lima muatan RDTR, peta 1:5.000, materi teknis, konsultasi, rancangan Perbup, persetujuan substansi, basis data, dan keterlacakan batas waktu 12 bulan."
  },
  {
    id: "R03", scope: "inti", code: "Permen ATR/BPN 11/2021 jo. 6/2026", title: "Tata Cara Penyusunan RDTR",
    status: "diubah 13 Mei 2026", officialUrl: "https://peraturan.bpk.go.id/Details/349128/permen-atrkepala-bpn-no-6-tahun-2026",
    officialUrls: [
      { label: "Permen ATR/BPN 11/2021", url: "https://peraturan.bpk.go.id/Details/209795/permen-agrariakepala-bpn-no-11-tahun-2021" },
      { label: "Perubahan Permen ATR/BPN 6/2026", url: "https://peraturan.bpk.go.id/Details/349128/permen-atrkepala-bpn-no-6-tahun-2026" }
    ],
    obligation: "Pasal 20–30 dan Lampiran IV mensyaratkan lima tahap—persiapan, pengumpulan data, analisis, konsepsi, dan rancangan perkada—dengan proses penyusunan paling lama 8 bulan, 21 analisis Pasal 24, alternatif konsep, lima muatan RDTR, integrasi KLHS, serta pelibatan masyarakat. Permen 6/2026 memperbarui persyaratan tim penyusun.",
    ygTest: "Uji dasar delineasi 11 unit kajian, kompetensi tim, keluaran setiap tahap, 21 analisis, alternatif, integrasi KLHS, lima muatan RDTR, pengumuman/konsultasi, dan jejak tindak lanjutnya."
  },
  {
    id: "R04", scope: "inti", code: "Permen ATR/BPN 14/2021", title: "Basis Data dan Penyajian Peta RTR",
    status: "berlaku", officialUrl: "https://peraturan.go.id/id/permen-atrbpn-no-14-tahun-2021",
    obligation: "RDTR disajikan pada skala 1:5.000 dengan referensi geospasial, geometri, atribut, topologi, metadata, dan album peta yang konsisten serta interoperabel.",
    ygTest: "Uji rekomendasi peta dasar, CRS/SRGI, ketelitian, atribut WP–SWP–blok–subblok–zona, gap/overlap/dangle, kamus data, metadata, dan kesamaan luas tabel-peta."
  },
  {
    id: "R05", scope: "inti", code: "Permen ATR/BPN 5/2022", title: "Integrasi KLHS dalam Penyusunan RTR",
    status: "berlaku", officialUrl: "https://peraturan.go.id/id/permen-atrbpn-no-5-tahun-2022",
    obligation: "Rekomendasi KLHS harus diintegrasikan ke tujuan, kebijakan, strategi, struktur ruang, pola ruang, ketentuan zonasi, dan indikasi program.",
    ygTest: "Lacak setiap isu dan rekomendasi KLHS ke perubahan geometri, pasal, intensitas, ketentuan khusus, atau program RDTR."
  },
  {
    id: "R06", scope: "inti", code: "Permen ATR/BPN 15/2021 jo. 9/2022", title: "Koordinasi Penataan Ruang",
    status: "berlaku dengan perubahan", officialUrl: "https://peraturan.bpk.go.id/Details/209803/permen-agrariakepala-bpn-no-15-tahun-2021",
    officialUrls: [
      { label: "Permen ATR/BPN 15/2021", url: "https://peraturan.bpk.go.id/Details/209803/permen-agrariakepala-bpn-no-15-tahun-2021" },
      { label: "Perubahan Permen ATR/BPN 9/2022", url: "https://peraturan.bpk.go.id/Details/217906/permen-agrariakepala-bpn-no-9-tahun-2022" }
    ],
    obligation: "Mengatur koordinasi penyelenggaraan penataan ruang dan peran Forum Penataan Ruang.",
    ygTest: "Uji komposisi/keterwakilan FPR, rekomendasi forum, notulen, perbedaan pendapat, dan tindak lanjutnya pada draf."
  },
  {
    id: "R07", scope: "inti", code: "Permen ATR/BPN 13/2021", title: "KKPR dan Sinkronisasi Program",
    status: "berlaku", officialUrl: "https://peraturan.bpk.go.id/Details/209797/permen-agrariakepala-bpn-no-13-tahun-2021",
    obligation: "Mengatur kesesuaian kegiatan pemanfaatan ruang dan sinkronisasi program pemanfaatan ruang.",
    ygTest: "Uji hubungan subzona dengan KKPR, izin/persetujuan eksisting, status pelaksanaan, program prioritas, dan pengaturan transisi."
  },
  {
    id: "R08", scope: "inti", code: "Permen ATR/BPN 21/2021", title: "Pengendalian dan Pengawasan Penataan Ruang",
    status: "berlaku", officialUrl: "https://peraturan.bpk.go.id/Details/209810/permen-agrariakepala-bpn-no-21-tahun-2021",
    obligation: "Ketentuan ruang harus dapat dikendalikan, dipantau, dievaluasi, dan dikenai tindakan atas ketidaksesuaian.",
    ygTest: "Uji apakah setiap pembatasan memiliki indikator, instansi pelaksana, data pemantauan, prosedur pengawasan, dan konsekuensi yang jelas."
  },
  {
    id: "R09", scope: "inti", code: "PP 46/2016", title: "Penyelenggaraan KLHS",
    status: "berlaku", officialUrl: "https://peraturan.bpk.go.id/Details/5767/pp-no-46-tahun-2016",
    obligation: "KLHS wajib memastikan prinsip pembangunan berkelanjutan menjadi dasar dan terintegrasi dalam kebijakan, rencana, dan program.",
    ygTest: "Uji dokumentasi kajian, partisipasi, alternatif, rekomendasi, penjaminan mutu, validasi, dan pengaruh nyata KLHS pada RDTR."
  },
  {
    id: "R10", scope: "inti", code: "Permen LHK 13/2024", title: "Pedoman Pelaksanaan KLHS",
    status: "berlaku; mencabut P.69/2017", officialUrl: "https://peraturan.bpk.go.id/Details/300703/permen-lhk-no-13-tahun-2024",
    obligation: "KLHS mencakup batas ekologis-sosial, isu strategis, daya dukung-daya tampung, jasa ekosistem, bencana, biodiversitas, iklim, penghidupan, alternatif, rekomendasi, partisipasi, mutu, dan validasi.",
    ygTest: "Pastikan wilayah fungsional tidak berhenti pada batas administrasi; KHG, DAS, pesisir, ruang hidup, kelompok rentan, dan pilihan alternatif diuji secara spasial."
  },
  {
    id: "R11", scope: "inti", code: "PP 71/2014 jo. PP 57/2016", title: "Ekosistem Gambut",
    status: "berlaku dengan perubahan", officialUrl: "https://peraturan.bpk.go.id/Details/5778/pp-no-57-tahun-2016",
    officialUrls: [
      { label: "PP 71/2014", url: "https://peraturan.go.id/id/pp-no-71-tahun-2014" },
      { label: "Perubahan PP 57/2016", url: "https://peraturan.bpk.go.id/Details/5778/pp-no-57-tahun-2016" }
    ],
    obligation: "Fungsi lindung ekosistem gambut dalam setiap KHG ditetapkan paling sedikit 30% dari luas KHG mulai dari puncak kubah, ditambah kriteria kedalaman dan fungsi perlindungan lain; kerusakan dan pengeringan wajib dicegah.",
    ygTest: "Angka 30% tidak diterapkan pada luas WP. Uji dengan peta KHG/fungsi resmi, kubah, kedalaman, muka air, drainase, subsidensi, tutupan, kebakaran, dan rencana pemulihan."
  },
  {
    id: "R12", scope: "inti", code: "Perpres 51/2016", title: "Batas Sempadan Pantai",
    status: "berlaku", officialUrl: "https://peraturan.bpk.go.id/Details/40949/perpres-no-51-tahun-2016",
    obligation: "Sempadan pantai ditetapkan dengan mempertimbangkan topografi, biofisik, hidro-oseanografi, risiko bencana, ekosistem, serta kebutuhan ekonomi dan budaya.",
    ygTest: "Tolak buffer seragam tanpa dasar; uji garis pantai, pasut, gelombang, arus, elevasi, abrasi-akresi, rob, mangrove, aset, dan ruang penghidupan."
  },
  {
    id: "R13", scope: "inti", code: "UU 27/2007 jo. UU 1/2014 jo. UU 6/2023", title: "Wilayah Pesisir dan Pulau-Pulau Kecil",
    status: "berlaku dengan perubahan", officialUrl: "https://peraturan.bpk.go.id/Details/38765/uu-no-1-tahun-2014",
    officialUrls: [
      { label: "UU 27/2007", url: "https://peraturan.bpk.go.id/Details/39911/uu-no-27-tahun-2007" },
      { label: "Perubahan UU 1/2014", url: "https://peraturan.bpk.go.id/Details/38765/uu-no-1-tahun-2014" },
      { label: "Perubahan terakhir UU 6/2023", url: "https://peraturan.bpk.go.id/Details/246523/uu-no-6-tahun-2023" }
    ],
    obligation: "Pemanfaatan pesisir harus melindungi ekosistem, memperhatikan keterkaitan darat-laut, dan menjaga akses serta kepentingan masyarakat pesisir.",
    ygTest: "Uji konektivitas pasang-surut, mangrove, muara, perikanan tradisional, jalur akses, ruang tambat, dan dampak pembangunan daratan terhadap perairan."
  },
  {
    id: "R14", scope: "inti", code: "UU 41/1999 jo. UU 6/2023; PP 23/2021 jo. PP 8/2026", title: "Kehutanan",
    status: "berlaku dengan perubahan; PP 8/2026 berlaku 2 Maret 2026", officialUrl: "https://peraturan.bpk.go.id/Details/161853/pp-no-23-tahun-2021",
    officialUrls: [
      { label: "UU 41/1999", url: "https://peraturan.go.id/id/uu-no-41-tahun-1999" },
      { label: "Perubahan terakhir UU 6/2023", url: "https://peraturan.bpk.go.id/Details/246523/uu-no-6-tahun-2023" },
      { label: "PP 23/2021", url: "https://peraturan.bpk.go.id/Details/161853/pp-no-23-tahun-2021" },
      { label: "Perubahan PP 8/2026", url: "https://peraturan.bpk.go.id/Details/347927/pp-no-8-tahun-2026" }
    ],
    obligation: "Status, fungsi, perubahan peruntukan/fungsi, penggunaan kawasan hutan, perizinan, dan pengelolaan kehutanan mengikuti kewenangan serta prosedur kehutanan.",
    ygTest: "RDTR tidak otomatis mengubah status kawasan hutan. Uji penunjukan/penetapan termutakhir, riwayat perubahan, PBPH/persetujuan, pelepasan, dan perhutanan sosial."
  },
  {
    id: "R15", scope: "inti", code: "UU 4/2011; PP 45/2021", title: "Informasi Geospasial",
    status: "berlaku", officialUrl: "https://peraturan.bpk.go.id/Details/170444/pp-no-45-tahun-2021",
    officialUrls: [
      { label: "UU 4/2011", url: "https://peraturan.go.id/id/uu-no-4-tahun-2011" },
      { label: "PP 45/2021", url: "https://peraturan.bpk.go.id/Details/170444/pp-no-45-tahun-2021" }
    ],
    obligation: "Informasi geospasial harus memiliki referensi, standar, metadata, kualitas, penyelenggara, dan mekanisme berbagi yang dapat dipertanggungjawabkan.",
    ygTest: "Audit sumber, wali data, skala/resolusi, tahun, metode, ketelitian, lisensi, versi, dan riwayat pengolahan setiap layer."
  },
  {
    id: "L01", scope: "lokal", code: "Perda Riau 10/2018", title: "RTRW Provinsi Riau 2018–2038",
    status: "rujukan provinsi; status revisi perlu diverifikasi", officialUrl: "https://peraturan.bpk.go.id/Details/102817/perda-prov-riau-no-10-tahun-2018",
    obligation: "RDTR kabupaten harus membaca arahan struktur, pola ruang, kawasan strategis, dan ketentuan provinsi yang berlaku.",
    ygTest: "Overlay zona RDTR dengan geometri RTRW provinsi yang sah dan dokumentasikan setiap perbedaan skala, klasifikasi, atau pembaruan."
  },
  {
    id: "L02", scope: "lokal", code: "RTRW Kabupaten Rokan Hilir — instrumen berlaku belum terverifikasi", title: "Rujukan Langsung RDTR",
    status: "instrumen baru belum terverifikasi; Perda 27/2002 hanya arsip periode 2002–2012", officialUrl: "https://jdih.rohilkab.go.id/",
    officialUrls: [
      { label: "JDIH Rokan Hilir", url: "https://jdih.rohilkab.go.id/" },
      { label: "Arsip Perda 27/2002 (BPK Riau)", url: "https://riau.bpk.go.id/perda-kabupaten-rokan-hilir-nomor-27-tahun-2002-tentang-rencana-tata-ruang-wilayah-kabupaten-rokan-hilir-tahun-2002-2012/" },
      { label: "Bukti proses persetujuan substansi 29 Januari 2026", url: "https://mediacenter.rohilkab.go.id/view/percepat-persetujuan-substansi-rtrw-bupati-rohil-h-bistamam-temui-menteri-atr-bpn-di-jakarta" }
    ],
    obligation: "RDTR merupakan rencana rinci yang harus konsisten dengan RTRW kabupaten yang sah.",
    ygTest: "Kesimpulan konsistensi final ditahan sampai perda RTRW kabupaten yang berlaku, lampiran peta digital, riwayat perubahan, dan status hukumnya diterima. Perda 27/2002 tidak diperlakukan sebagai dasar berlaku karena periode rencananya 2002–2012."
  },
  {
    id: "L03", scope: "bersyarat", code: "Perpres 43/2020", title: "RTR Kawasan Perbatasan Negara Riau–Kepri",
    status: "berlaku bila beririsan", officialUrl: "https://peraturan.bpk.go.id/Details/134801/perpres-no-43-tahun-2020",
    obligation: "Arahan perpres berlaku pada lokasi yang masuk delineasi kawasan perbatasan negara.",
    ygTest: "Terapkan hanya setelah lampiran geometri dioverlay dengan WP atau wilayah fungsional; jangan menyimpulkan dari nama atau kedekatan wilayah."
  },
  {
    id: "L04", scope: "lokal", code: "Perda Riau 11/2024", title: "Pengelolaan Hutan pada Wilayah Kesatuan Pengelolaan Hutan",
    status: "berlaku sejak 14 Agustus 2024", officialUrl: "https://peraturan.bpk.go.id/Details/311183/perda-prov-riau-no-11-tahun-2024",
    obligation: "Pengelolaan hutan pada wilayah KPH di Riau mencakup kelembagaan, tata hutan dan rencana pengelolaan, pemanfaatan/penggunaan kawasan, perlindungan, pemberdayaan masyarakat, partisipasi, monitoring, sistem informasi, serta pembinaan dan pengawasan.",
    ygTest: "Untuk area yang beririsan atau dipengaruhi wilayah KPH, uji konsistensi arahan RDTR dengan rencana pengelolaan KPH, status/fungsi kawasan, perlindungan, pemanfaatan, pemberdayaan masyarakat, dan kewenangan provinsi tanpa menganggap RDTR mengubah status kawasan hutan."
  }
];

function buildRegulationCurrencyAudit() {
  const verified = {
    R01: { status: "official_status_page_checked", finding: "JDIH BPK mencatat UU 26/2007 berlaku dan diubah terakhir oleh UU 6/2023." },
    R02: { status: "official_status_page_checked", finding: "JDIH BPK mencatat PP 21/2021 sebagai peraturan penyelenggaraan penataan ruang." },
    R03: { status: "official_status_page_checked", finding: "Permen ATR/BPN 6/2026 berlaku 13 Mei 2026 dan mengubah Permen ATR/BPN 11/2021." },
    R04: { status: "official_status_page_checked", finding: "JDIH BPK mencatat Permen ATR/BPN 14/2021 berlaku sejak 1 April 2021 dan mencabut Permen ATR/BPN 14/2020." },
    R05: { status: "official_status_page_checked", finding: "JDIH BPK mencatat Permen ATR/BPN 5/2022 berlaku sejak 12 April 2022; halaman status tidak mencantumkan perubahan atau pencabutan." },
    R06: { status: "official_status_page_checked", finding: "JDIH BPK mencatat Permen ATR/BPN 15/2021 berlaku dan diubah oleh Permen ATR/BPN 9/2022 yang berlaku sejak 27 Mei 2022." },
    R07: { status: "official_status_page_checked", finding: "JDIH BPK mencatat Permen ATR/BPN 13/2021 berlaku sejak 21 Juli 2021." },
    R09: { status: "official_status_page_checked", finding: "JDIH BPK mencatat PP 46/2016 berlaku sejak 31 Oktober 2016; halaman status belum mencantumkan perubahan atau pencabutan." },
    R10: { status: "official_status_page_checked", finding: "JDIH BPK mencatat Permen LHK 13/2024 berlaku sejak 6 September 2024 dan mencabut Permen LHK P.69/2017." },
    R11: { status: "official_status_page_checked", finding: "JDIH BPK mencatat PP 57/2016 berlaku sejak 6 Desember 2016 dan mengubah PP 71/2014 tentang perlindungan dan pengelolaan ekosistem gambut." },
    R14: { status: "official_status_page_checked", finding: "JDIH BPK mencatat PP 23/2021 berlaku dan telah diubah oleh PP 8/2026 yang berlaku sejak 2 Maret 2026. Perubahan 2026 menambah Pasal 293A dan berfokus pada pengaturan kehutanan di KPBPB Batam; relevansi materinya untuk Bagansiapiapi tetap harus dinilai dalam legal review." },
    L04: { status: "official_status_page_checked", finding: "Perda Riau 11/2024 berlaku 14 Agustus 2024 dan mengatur pengelolaan hutan pada wilayah KPH." }
  };
  const items = REGULATION_REGISTER.map(row => ({
    regulationRef: row.id,
    code: row.code,
    title: row.title,
    officialUrl: row.officialUrl,
    verificationStatus: verified[row.id]?.status || "registered_link_not_rechecked_this_cycle",
    finding: verified[row.id]?.finding || "Rujukan dipertahankan dalam register; status dan perubahan terbaru belum diperiksa ulang pada siklus ini.",
    checkedAt: verified[row.id] ? "2026-09-20" : null,
    checkedBy: verified[row.id] ? "system_web_review" : null,
    supersedingInstrumentFound: null,
    legalReviewer: null,
    legalReviewDate: null
  }));
  return {
    id: "RDTR-YG-REGULATION-CURRENCY-AUDIT-V0.4",
    version: "0.4.0-internal",
    access: "staff_only",
    status: "partial_official_source_recheck",
    totalRegulations: items.length,
    checkedCount: items.filter(row => row.checkedAt).length,
    pendingRecheckCount: items.filter(row => !row.checkedAt).length,
    items,
    rule: "Link terdaftar tidak sama dengan verifikasi keberlakuan. Setiap peraturan harus diperiksa pada sumber resmi, termasuk status perubahan/pencabutan, sebelum dipakai dalam kesimpulan final.",
    disclaimer: "Pemeriksaan web merupakan kontrol awal dan tidak menggantikan legal review terhadap naskah autentik, lampiran, aturan perubahan, putusan, atau ketentuan peralihan."
  };
}

function buildP0EvidenceBoard(ygCandidateZones) {
  const ygZoneCount = ygCandidateZones?.features?.length || 0;
  const ygZoneCoveragePct = ygCandidateZones?.metadata?.coveragePct || 0;
  const items = [
    {
      id: "P0-E01",
      title: "Undangan resmi Konsultasi Publik I RDTR Bagansiapiapi",
      category: "Proses dan partisipasi",
      status: "verified_available",
      evidenceClass: "EV-O",
      access: "internal_only",
      issuer: "Sekretariat Daerah Kabupaten Rokan Hilir",
      documentNumber: "600.3.2.2/TARU/2026/2",
      documentDate: "2026-09-17",
      sourceNote: "Dokumen resmi diterima Yayasan Gambut; tidak ditautkan untuk publik.",
      legalRole: "Membuktikan kegiatan penyusunan RDTR berada pada DPA Dinas PUPR Kabupaten Rokan Hilir Tahun Anggaran 2026 dan Konsultasi Publik I dijadwalkan pada 22 September 2026.",
      finding: "Cakupan undangan menyebut 11 kelurahan/kepenghuluan di Kecamatan Bangko: Bagan Barat, Bagan Hulu, Bagan Kota, Bagan Punak, Bagan Timur, Bagan Jawa, Bagan Jawa Pesisir, Bagan Punak Meranti, Bagan Punak Pesisir, Labuhan Tangga Besar, dan Labuhan Tangga Hilir.",
      limitation: "Undangan tidak membuktikan penetapan WP, metode analisis, status RTRW kabupaten, KLHS, geometri zona, atau muatan rancangan perkada.",
      nextAction: "Gunakan sebagai dasar meminta materi, peta, metode, daftar hadir, notulen, dan matriks respons pada Konsultasi Publik I.",
      analysisRefs: ["A24-a", "A24-e", "A24-k", "A24-u"],
      gateRefs: ["participation-fpr"]
    },
    {
      id: "P0-E02",
      title: "Perda RTRW Kabupaten Rokan Hilir yang berlaku beserta lampiran peta",
      category: "Hierarki rencana",
      status: "not_verified",
      evidenceClass: "EV-O",
      access: "official_public_or_request",
      issuer: "Pemerintah Kabupaten Rokan Hilir",
      sourceNote: "Penelusuran sampai 20 September 2026 belum menemukan instrumen baru yang dapat diverifikasi sebagai RTRW kabupaten yang telah ditetapkan dan berlaku.",
      sourceLinks: [
        { label: "JDIH Rokan Hilir", url: "https://jdih.rohilkab.go.id/" }
      ],
      legalRole: "Menjadi rujukan langsung untuk uji konsistensi tujuan, struktur ruang, pola ruang, kawasan strategis, dan ketentuan pengendalian RDTR.",
      finding: "Nomor perda, tanggal penetapan, status berlaku, naskah autentik, serta lampiran peta digital RTRW kabupaten mutakhir belum terverifikasi.",
      limitation: "Ketidakditemukan dalam penelusuran bukan bukti bahwa instrumen tidak ada. Kesimpulan konsistensi final tetap ditahan.",
      nextAction: "Minta naskah perda yang berlaku, lembaran daerah, seluruh lampiran peta, geodatabase terotorisasi, metadata, dan riwayat perubahan.",
      analysisRefs: ["A24-a", "A24-c", "A24-o", "A24-u"],
      gateRefs: ["rtrw-sync"]
    },
    {
      id: "P0-E03",
      title: "Perda Kabupaten Rokan Hilir 27/2002 tentang RTRW 2002–2012",
      category: "Hierarki rencana",
      status: "historical_expired_reference",
      evidenceClass: "EV-O",
      access: "official_public",
      issuer: "Pemerintah Kabupaten Rokan Hilir",
      documentNumber: "Perda 27 Tahun 2002",
      planningPeriod: "2002–2012",
      sourceNote: "Arsip resmi ditemukan, tetapi periode rencana yang tercantum telah berakhir.",
      sourceLinks: [
        { label: "Arsip BPK Riau", url: "https://riau.bpk.go.id/perda-kabupaten-rokan-hilir-nomor-27-tahun-2002-tentang-rencana-tata-ruang-wilayah-kabupaten-rokan-hilir-tahun-2002-2012/" },
        { label: "JDIH Rokan Hilir", url: "https://jdih.rohilkab.go.id/download/peraturan/301/rencana-tata-ruang-wilayah-kabupaten-rokan-hilir-tahun-2002-2012.html" }
      ],
      legalRole: "Hanya dipakai untuk riwayat perubahan kebijakan ruang dan audit kontinuitas, bukan sebagai bukti otomatis RTRW yang berlaku saat ini.",
      finding: "Judul dan periode rencana resmi adalah 2002–2012.",
      limitation: "Label katalog JDIH tidak boleh mengalahkan periode rencana yang sudah berakhir atau menggantikan verifikasi status hukum mutakhir.",
      nextAction: "Pisahkan sebagai arsip historis dan konfirmasi secara tertulis instrumen RTRW yang berlaku saat penyusunan RDTR 2026.",
      analysisRefs: ["A24-c", "A24-u"],
      gateRefs: ["rtrw-sync"]
    },
    {
      id: "P0-E04",
      title: "Bukti proses percepatan persetujuan substansi RTRW baru",
      category: "Hierarki rencana",
      status: "verified_process_evidence",
      evidenceClass: "EV-O",
      access: "official_public",
      issuer: "Media Center Pemerintah Kabupaten Rokan Hilir",
      documentDate: "2026-01-29",
      sourceNote: "Sumber resmi pemerintah kabupaten memberitakan pertemuan dengan Menteri ATR/BPN untuk mempercepat persetujuan substansi RTRW.",
      sourceLinks: [
        { label: "Media Center Rokan Hilir", url: "https://mediacenter.rohilkab.go.id/view/percepat-persetujuan-substansi-rtrw-bupati-rohil-h-bistamam-temui-menteri-atr-bpn-di-jakarta" }
      ],
      legalRole: "Membuktikan adanya proses penyelesaian RTRW baru pada awal 2026, bukan penetapan atau keberlakuan perdanya.",
      finding: "Pada 29 Januari 2026, pemerintah kabupaten masih menyebut percepatan persetujuan substansi RTRW.",
      limitation: "Berita proses tidak dapat dipakai sebagai pengganti persetujuan substansi, perda, lembaran daerah, atau lampiran peta yang telah ditetapkan.",
      nextAction: "Minta nomor/tanggal persetujuan substansi, status fasilitasi dan evaluasi, perda final, serta geometri lampirannya.",
      analysisRefs: ["A24-c", "A24-u"],
      gateRefs: ["rtrw-sync"]
    },
    {
      id: "P0-E05",
      title: "Keputusan kepala daerah tentang WP dan delineasi terotorisasi",
      category: "Fondasi wilayah",
      status: "not_received",
      evidenceClass: "EV-O",
      access: "official_request",
      issuer: "Pemerintah Kabupaten Rokan Hilir",
      sourceNote: "Belum diterima Yayasan Gambut sampai 20 September 2026.",
      legalRole: "Mengunci wilayah perencanaan yang sah sebelum pembentukan SWP, blok, subblok, zona, dan jaringan.",
      finding: "Sebelas wilayah dalam undangan baru dapat dipakai sebagai unit penyaringan YG, belum sebagai bukti batas WP resmi.",
      limitation: "Daftar nama wilayah tanpa keputusan dan geometri tidak menetapkan garis batas WP.",
      nextAction: "Minta keputusan penetapan WP, lampiran koordinat/geometri, berita acara delineasi, luas, CRS, dan metadata.",
      analysisRefs: ["A24-a", "A24-s", "A24-u"],
      gateRefs: ["map-scale-5000"]
    },
    {
      id: "P0-E06",
      title: "KAK, metodologi, rencana kerja, tim penyusun, dan FPR",
      category: "Metode dan tata kelola",
      status: "not_received",
      evidenceClass: "EV-O",
      access: "official_request",
      issuer: "Dinas PUPR Kabupaten Rokan Hilir",
      sourceNote: "Belum diterima Yayasan Gambut sampai 20 September 2026.",
      legalRole: "Membuktikan tahapan, metode, pembagian peran, jadwal, survei, penjaminan mutu, dan forum lintas sektor yang digunakan penyusun.",
      finding: "Undangan mengonfirmasi kegiatan dalam DPA 2026, tetapi tidak memuat metode atau perangkat pengambilan keputusan.",
      limitation: "Status pekerjaan tidak dapat dinilai hanya dari undangan kegiatan.",
      nextAction: "Minta KAK dan adendum, metodologi, rencana kerja, SK tim, SK/komposisi FPR, instrumen survei, dan protokol validasi.",
      analysisRefs: ["A24-k", "A24-t", "A24-u"],
      gateRefs: ["participation-fpr"]
    },
    {
      id: "P0-E07",
      title: "Rancangan zonasi alternatif YG v0.2",
      category: "Rancangan internal",
      status: "available_internal_draft",
      evidenceClass: "EV-I",
      access: "internal_only",
      issuer: "Yayasan Gambut",
      sourceNote: "Dihasilkan secara mandiri dari kajian regulasi serta overlay baseline yang tersedia; hanya untuk analisis internal dan bahan konsultasi.",
      legalRole: "Objek kerja internal untuk menyusun tujuan, pola ruang, arah pemanfaatan, kerangka zonasi, dan argumen teknis YG secara konsisten.",
      finding: `${ygZoneCount} geometri zona kandidat saling eksklusif telah mencakup ${ygZoneCoveragePct}% wilayah kajian.`,
      limitation: "Bukan RDTR yang ditetapkan, bukan peta dasar skala 1:5.000 terotorisasi, tidak menetapkan hak atau fungsi sektoral, dan tidak dapat menjadi dasar KKPR.",
      nextAction: "Matangkan subzona, katalog kegiatan/ITBX, intensitas, struktur ruang, program, dan ketentuan khusus melalui data skala RDTR, KLHS, analisis sosial-ekonomi, serta verifikasi lapangan.",
      analysisRefs: ["A24-m", "A24-n", "A24-o", "A24-p", "A24-q", "A24-r", "A24-s"],
      gateRefs: ["rtrw-sync", "klhs-integration", "map-scale-5000"]
    },
    {
      id: "P0-E08",
      title: "KLHS: dokumen kerja, peta, rekomendasi, integrasi, dan validasi",
      category: "Lingkungan hidup",
      status: "not_received",
      evidenceClass: "EV-O",
      access: "official_request",
      issuer: "Pemerintah Kabupaten Rokan Hilir dan instansi lingkungan hidup berwenang",
      sourceNote: "Belum diterima Yayasan Gambut sampai 20 September 2026.",
      legalRole: "Menjadi dasar integrasi daya dukung-daya tampung, risiko lingkungan, alternatif, dan rekomendasi ke seluruh muatan RDTR.",
      finding: "Baseline YG menunjukkan isu gambut, pesisir, mangrove, banjir/rob, dan non-APL, tetapi belum dapat menggantikan proses KLHS resmi.",
      limitation: "Peta indikatif YG bukan rekomendasi atau bukti validasi KLHS.",
      nextAction: "Minta dokumen KLHS lengkap, peta kerja, berita acara pelibatan, alternatif, rekomendasi, matriks integrasi sebelum-sesudah, penjaminan mutu, dan bukti validasi.",
      analysisRefs: ["A24-d", "A24-p", "A24-r", "A24-s"],
      gateRefs: ["klhs-integration"]
    },
    {
      id: "P0-E09",
      title: "Rekomendasi peta dasar BIG skala 1:5.000 dan kendali mutu geospasial",
      category: "Geospasial",
      status: "not_received",
      evidenceClass: "EV-O",
      access: "official_request",
      issuer: "Badan Informasi Geospasial dan penyusun RDTR",
      sourceNote: "Belum diterima Yayasan Gambut sampai 20 September 2026.",
      legalRole: "Mengunci dasar posisi, skala, ketelitian, topologi, metadata, dan keterlacakan geometri RDTR.",
      finding: "Layer penyaringan YG belum memenuhi fungsi peta dasar RDTR skala 1:5.000.",
      limitation: "Geometri web dan data indikatif tidak boleh dipromosikan menjadi batas WP, SWP, blok, subblok, zona, atau subzona.",
      nextAction: "Minta rekomendasi BIG, paket peta dasar, CRS/SRGI, laporan ketelitian, pemeriksaan topologi, metadata, kamus data, serta album peta.",
      analysisRefs: ["A24-a", "A24-d", "A24-m", "A24-s", "A24-t"],
      gateRefs: ["map-scale-5000"]
    },
    {
      id: "P0-E10",
      title: "Materi, daftar hadir, notulen, peta partisipatif, dan matriks respons Konsultasi Publik I",
      category: "Proses dan partisipasi",
      status: "not_received",
      evidenceClass: "EV-O",
      access: "official_request",
      issuer: "Dinas PUPR Kabupaten Rokan Hilir",
      sourceNote: "Kegiatan dijadwalkan 22 September 2026; keluaran konsultasi belum tersedia pada cut-off 20 September 2026.",
      legalRole: "Membuktikan siapa yang dilibatkan, bukti yang dipresentasikan, masukan yang diterima, jawaban penyusun, dan perubahan rancangan yang dihasilkan.",
      finding: "Jadwal diskusi dan masukan telah dibuktikan oleh undangan, tetapi jejak respons belum dapat ada sebelum kegiatan selesai.",
      limitation: "Kehadiran atau penyampaian masukan saja tidak membuktikan bahwa rekomendasi diintegrasikan.",
      nextAction: "Rekam setiap masukan dengan ID dan lokasi; minta matriks tanggapan yang menghubungkan masukan ke perubahan peta/pasal atau alasan penolakan.",
      analysisRefs: ["A24-e", "A24-k", "A24-u"],
      gateRefs: ["participation-fpr"]
    }
  ];
  const statusCounts = items.reduce((counts, row) => {
    counts[row.status] = (counts[row.status] || 0) + 1;
    return counts;
  }, {});
  return {
    title: "Papan Bukti P0 Penyusunan RDTR Bagansiapiapi",
    lastChecked: "2026-09-20",
    scopeNote: "Register internal ini membedakan bukti dokumen, bukti proses, arsip historis, dan kekosongan bukti. Status belum diterima atau belum terverifikasi tidak berarti dokumen tidak ada.",
    legalTruth: "Perda Kabupaten Rokan Hilir 27/2002 ditemukan sebagai arsip RTRW periode 2002–2012 dan tidak dipakai sebagai RTRW kabupaten yang berlaku untuk uji konsistensi final. Sumber resmi pemerintah pada 29 Januari 2026 menunjukkan RTRW baru masih berada dalam proses percepatan persetujuan substansi; penetapan finalnya tetap harus dibuktikan.",
    promotionRule: "Geometri atau keputusan rencana tidak boleh dinaikkan statusnya berdasarkan undangan, berita proses, atau arsip historis. Kenaikan status memerlukan dokumen resmi yang sesuai fungsi buktinya, versi yang jelas, geometri terotorisasi, dan jejak validasi.",
    statusCounts,
    blockingIds: items.filter(row => ["not_verified", "not_received"].includes(row.status)).map(row => row.id),
    items
  };
}

function buildPolicyMapFramework({ summary, peatCount, forestCount, mangroveCandidateCount, mangroveCandidateAreaHa, ygZoneCount, ygZoneCoveragePct }) {
  const disclaimer = "Peta sintesis kebijakan internal untuk menyusun argumen dan prioritas verifikasi. Geometri berasal dari layer penyaringan yang tersedia; bukan peta pola ruang RDTR, bukan penetapan fungsi ekosistem gambut/kawasan hutan, bukan batas sempadan, dan bukan dasar KKPR.";
  return {
    id: "PM-YG-V0",
    title: "Peta Sintesis Kebijakan RDTR Bagansiapiapi versi YG",
    version: "v0.1",
    legalCutoff: "2026-09-20",
    status: "mapped_policy_synthesis_v0",
    maturity: "analytical_argument_map_not_official_rdtr",
    purpose: "Menerjemahkan kajian kebijakan menjadi geometri argumen yang dapat diperiksa sebelum penyusunan zona/subzona usulan YG.",
    disclaimer,
    readingRule: "Layer dapat bertumpang tindih dan luasnya tidak boleh dijumlahkan. Tumpang tindih memperkuat kebutuhan pemeriksaan, bukan membentuk kelas zona baru secara otomatis. Area tanpa indikasi pada ketiga layer ini juga belum dapat dinyatakan layak dikembangkan karena risiko, layanan, tenurial, RTRW kabupaten, dan KLHS belum lengkap.",
    decisionRule: "Tahan digunakan untuk mencegah kenaikan intensitas sebelum bukti P0 tersedia; Verifikasi digunakan untuk status/kewenangan yang belum mutakhir; Bersyarat hanya dapat dipromosikan setelah syarat lokasi, ambang, indikator, dan pengawasan terbukti.",
    mappedAreaReferenceHa: summary.areaHa,
    layers: [
      {
        id: "PM-YG-PEAT",
        title: "Tahan intensifikasi · indikasi gambut",
        mapRef: "map.peat",
        sourceRef: "GR-PEAT-INDICATIVE",
        featureCount: peatCount,
        grossAreaHa: summary.peatAreaHa,
        decision: "hold",
        confidence: "medium_screening",
        patternHypothesis: "ZONE-YG-PEAT",
        policyDirection: "Jangan menaikkan intensitas atau mengunci zona budidaya intensif sebelum fungsi KHG, kubah, kedalaman, hidrologi, muka air, subsidensi, kebakaran, dan kebutuhan pemulihan terverifikasi.",
        promotionRequirements: ["Peta KHG dan fungsi ekosistem gambut resmi", "Kedalaman/kubah dan hidrologi", "KLHS dan alternatif", "Verifikasi lapangan"],
        regulationRefs: ["R05", "R09", "R10", "R11"],
        analysisRefs: ["A24-d", "A24-m", "A24-o", "A24-p", "A24-s"],
        color: "#8b3a72"
      },
      {
        id: "PM-YG-FOREST",
        title: "Verifikasi status · indikasi non-APL",
        mapRef: "map.forest",
        sourceRef: "GR-FOREST-INDICATIVE",
        featureCount: forestCount,
        grossAreaHa: summary.forestAreaHa,
        decision: "verify",
        confidence: "medium_screening",
        patternHypothesis: "ZONE-YG-FOREST",
        policyDirection: "Pertahankan keterbacaan fungsi dan kewenangan kehutanan; zona RDTR tidak boleh dianggap mengubah status kawasan hutan, persetujuan penggunaan, pelepasan, atau hak yang berlaku.",
        promotionRequirements: ["Peta kawasan hutan termutakhir", "Riwayat perubahan dan penetapan", "PBPH/persetujuan/pelepasan", "Rekonsiliasi RTRW kabupaten"],
        regulationRefs: ["R01", "R02", "R14", "L02"],
        analysisRefs: ["A24-c", "A24-d", "A24-o", "A24-s", "A24-u"],
        color: "#287047"
      },
      {
        id: "PM-YG-COAST",
        title: "Tahan konversi · kandidat perlindungan/pemulihan pesisir",
        mapRef: "map.mangroveCandidates",
        sourceRef: "GR-MANGROVE-CANDIDATES",
        featureCount: mangroveCandidateCount,
        grossAreaHa: mangroveCandidateAreaHa,
        decision: "hold",
        confidence: "medium_to_high_remote_sensing",
        patternHypothesis: "ZONE-YG-COAST",
        policyDirection: "Pertahankan mangrove tersisa dan konektivitas pasang-surut; kandidat pemulihan tidak otomatis menjadi lokasi tanam dan harus diuji terhadap hidrodinamika, substrat, salinitas, abrasi/akresi, tenurial, penghidupan, dan persetujuan masyarakat.",
        promotionRequirements: ["Garis pantai dan pasut", "Rob/banjir/abrasi", "Ground check mangrove", "Verifikasi hidrodinamika dan tenurial"],
        regulationRefs: ["R05", "R09", "R10", "R12", "R13"],
        analysisRefs: ["A24-d", "A24-e", "A24-o", "A24-p", "A24-s"],
        color: "#176c8c"
      }
    ],
    completionStages: [
      {
        id: "MAP-0",
        title: "Sintesis kebijakan dan geometri bukti",
        status: "complete_internal_v0",
        output: "Tiga layer arahan YG yang dapat ditelusuri ke regulasi, analisis Pasal 24, sumber, luas, dan syarat promosi."
      },
      {
        id: "MAP-1",
        title: "Delineasi calon zona/subzona YG",
        status: "provisional_internal_v0",
        output: `${ygZoneCount} geometri zona internal saling eksklusif dengan cakupan ${ygZoneCoveragePct}% wilayah kajian; fungsi rinci, subzona, kegiatan, dan intensitas belum final.`,
        requirements: ["Peta dasar 1:5.000", "Penggunaan lahan dan bangunan", "KHG/fungsi gambut", "Bahaya pesisir-perkotaan", "Data penduduk dan layanan"]
      },
      {
        id: "MAP-2",
        title: "Rancangan RDTR alternatif YG lengkap",
        status: "blocked_missing_supporting_analysis",
        output: "Struktur ruang, subzona, ketentuan khusus, intensitas, program, dan matriks peraturan zonasi versi YG.",
        requirements: ["KLHS dan matriks integrasi", "Skenario penduduk dan kegiatan", "Analisis layanan dan jaringan", "Uji sosial-tenurial dan lapangan"]
      },
      {
        id: "MAP-3",
        title: "Paket konsultasi rancangan YG",
        status: "pending_internal_validation",
        output: "Peta zona, matriks kegiatan, dasar hukum, bukti, luas, usulan pasal, program, dan daftar isu yang siap dipertahankan dalam konsultasi."
      }
    ]
  };
}

const DECISION_CLASSES = [
  { id: "hold", label: "Tahan", meaning: "Bukti P0 belum tersedia atau ada indikasi fungsi lindung/risiko tinggi.", action: "Jangan mendukung intensifikasi; minta pembuktian dan alternatif." },
  { id: "verify", label: "Verifikasi", meaning: "Ada indikasi tumpang tindih atau kewajiban, tetapi bukti legal/spasial belum lengkap.", action: "Catat sebagai hipotesis dan konfirmasi dengan data resmi." },
  { id: "conditional", label: "Bersyarat", meaning: "Dapat dipertimbangkan bila syarat perlindungan, mitigasi, indikator, dan pengawasan masuk dalam aturan.", action: "Usulkan ketentuan khusus dan ambang yang terukur." },
  { id: "revise", label: "Revisi", meaning: "Bukti resmi menunjukkan ketidaksesuaian hierarki, fungsi lindung, atau risiko yang tidak tertangani.", action: "Ajukan perubahan geometri/pasal dengan alternatif dan dasar hukum." }
];

const PASAL_24_CATEGORIES = [
  ["a", "Struktur internal bagian wilayah perencanaan"],
  ["b", "Sistem penggunaan lahan"],
  ["c", "Kedudukan dan peran bagian wilayah perencanaan dalam wilayah yang lebih luas"],
  ["d", "Sumber daya alam dan fisik atau lingkungan bagian wilayah perencanaan"],
  ["e", "Sosial budaya"],
  ["f", "Kependudukan"],
  ["g", "Ekonomi dan sektor unggulan"],
  ["h", "Transportasi"],
  ["i", "Sumber daya buatan"],
  ["j", "Kondisi lingkungan binaan"],
  ["k", "Kelembagaan"],
  ["l", "Pembiayaan pembangunan"],
  ["m", "Karakteristik peruntukan zona"],
  ["n", "Jenis dan karakteristik kegiatan yang berkembang dan mungkin berkembang"],
  ["o", "Kesesuaian kegiatan terhadap peruntukan, zona, atau subzona"],
  ["p", "Dampak kegiatan terhadap jenis peruntukan, zona, atau subzona"],
  ["q", "Pertumbuhan dan pertambahan penduduk pada suatu zona"],
  ["r", "Gap kualitas peruntukan, zona, atau subzona yang diharapkan dengan kondisi lapangan"],
  ["s", "Karakteristik spesifik lokasi"],
  ["t", "Ketentuan dan standar setiap sektor terkait"],
  ["u", "Kewenangan dalam perencanaan, pemanfaatan, dan pengendalian pemanfaatan ruang"]
];

function buildPlanningWorkflow() {
  return [
    {
      id: "persiapan",
      status: "partial",
      regulationRefs: ["R03", "R06"],
      articleRef: "Permen ATR/BPN 11/2021 jo. Permen ATR/BPN 6/2026, Pasal 20 ayat (1) huruf a, Pasal 22, dan Lampiran IV.1 angka 1.a",
      requiredOutputs: [
        "Kerangka acuan kerja, tim penyusun/FPR, dan rencana kerja",
        "Metodologi, kajian awal data sekunder, serta perangkat survei",
        "Penetapan WP oleh kepala daerah dan gambaran umum WP",
        "Pemberitaan kepada publik tentang proses, tim, dan tahapan penyusunan"
      ],
      ygWork: [
        "Membentuk baseline internal 11 kelurahan/kepenghuluan sebagai ruang kajian analitis",
        "Menyusun daftar isu awal gambut, kawasan hutan, pesisir, risiko, dan keterlacakan regulasi"
      ],
      gaps: [
        "Keputusan kepala daerah tentang WP dan dasar delineasinya belum diterima",
        "SK tim penyusun, komposisi FPR, KAK, metodologi resmi, rencana kerja, dan perangkat survei belum diterima",
        "Sebelas unit YG belum dapat diperlakukan sebagai SWP, blok, subblok, atau zona resmi"
      ]
    },
    {
      id: "pengumpulan-data-informasi",
      status: "partial",
      regulationRefs: ["R03", "R04", "R15"],
      articleRef: "Permen ATR/BPN 11/2021, Pasal 20 ayat (1) huruf b dan Pasal 23",
      requiredOutputs: [
        "Data administrasi, kependudukan, pertanahan, dan kebencanaan",
        "Peta dasar termutakhir yang telah memperoleh rekomendasi BIG",
        "Peta tematik yang diperlukan, metadata, sumber, tahun, skala, dan kualitas data",
        "Hasil survei primer dan informasi pemangku kepentingan"
      ],
      ygWork: [
        "Mengompilasi batas administrasi, indikasi RTRW provinsi, gambut, kawasan hutan, dan sebagian analisis mangrove",
        "Mencatat sumber serta keterbatasan layer yang telah digunakan dalam baseline"
      ],
      gaps: [
        "Peta dasar rekomendasi BIG skala kerja RDTR, data pertanahan agregat, dan geometri RTRW kabupaten yang sah belum diterima",
        "Data kependudukan, ekonomi, prasarana, transportasi, penggunaan lahan eksisting, serta bahaya rob-banjir-abrasi-subsidensi belum lengkap",
        "Data mangrove dan kondisi pesisir belum mencakup seluruh WP"
      ]
    },
    {
      id: "pengolahan-data-analisis",
      status: "partial",
      regulationRefs: ["R03", "R05", "R09", "R10"],
      articleRef: "Permen ATR/BPN 11/2021, Pasal 20 ayat (1) huruf c dan Pasal 24 huruf a sampai dengan u",
      requiredOutputs: [
        "Dua puluh satu analisis wajib Pasal 24 yang saling terhubung dan dapat ditelusuri",
        "Sintesis potensi, masalah, kebutuhan ruang, daya dukung-daya tampung, risiko, dan proyeksi",
        "Masukan analitis KLHS yang terintegrasi dengan proses penyusunan RDTR"
      ],
      ygWork: [
        "Menyediakan matriks 21 analisis wajib dengan status, temuan sementara, dan langkah berikutnya",
        "Menghitung indikasi cakupan gambut dan kawasan hutan per unit analitis desa",
        "Menetapkan disiplin keputusan Tahan, Verifikasi, Bersyarat, dan Revisi",
        "Menghasilkan geometri zonasi alternatif YG yang saling eksklusif sebagai hipotesis spasial awal"
      ],
      gaps: [
        "Sebagian besar analisis sosial, ekonomi, kependudukan, transportasi, prasarana, kelembagaan, dan pembiayaan belum dapat diselesaikan",
        "Dokumen serta peta kerja KLHS, data penggunaan lahan-bangunan, bahaya, penduduk, ekonomi, dan layanan belum lengkap",
        "Geometri zonasi YG belum dapat menjadi penetapan zona atau intensitas pemanfaatan ruang yang berkekuatan hukum"
      ]
    },
    {
      id: "perumusan-konsepsi",
      status: "provisional",
      regulationRefs: ["R03", "R05", "R09", "R10"],
      articleRef: "Permen ATR/BPN 11/2021, Pasal 20 ayat (1) huruf d dan Pasal 25",
      requiredOutputs: [
        "Alternatif konsep rencana",
        "Penilaian dan pemilihan konsep rencana",
        "Perumusan konsep terpilih menjadi muatan RDTR",
        "Bukti bahwa rekomendasi KLHS memengaruhi pilihan konsep"
      ],
      ygWork: [
        "Menyusun ALT-0, ALT-YG-2, dan ALT-YG-1 untuk dibandingkan secara transparan",
        "Memilih ALT-YG-1 secara sementara sebagai konsep berbasis ekosistem, risiko, dan konsolidasi pertumbuhan",
        "Menyiapkan tujuan, strategi, struktur, pola ruang bergambar, kerangka aturan zonasi, dan program tanpa menetapkan angka intensitas final"
      ],
      gaps: [
        "ALT-YG-2 masih perlu dinilai dengan proyeksi kebutuhan ruang, biaya layanan, dan paparan risiko yang sebanding",
        "Uji alternatif KLHS, proyeksi kebutuhan, analisis kelayakan, dan hasil partisipasi belum lengkap",
        "Pilihan ALT-YG-1 masih dapat berubah setelah bukti resmi, verifikasi lapangan, dan masukan konsultasi diuji"
      ]
    },
    {
      id: "penyusunan-rancangan-perkada",
      status: "not_started",
      regulationRefs: ["R02", "R03", "R08"],
      articleRef: "Permen ATR/BPN 11/2021, Pasal 20 ayat (1) huruf e, Pasal 26, Pasal 27, dan Pasal 28",
      requiredOutputs: [
        "Kajian kebijakan rancangan peraturan kepala daerah",
        "Rancangan peraturan kepala daerah beserta tujuan, struktur ruang, pola ruang, ketentuan pemanfaatan ruang, dan peraturan zonasi",
        "Peta dan tabel ketentuan kegiatan/penggunaan lahan yang konsisten",
        "Dokumen digital yang dapat digunakan untuk pemanfaatan dan pengendalian ruang"
      ],
      ygWork: [
        "Menyiapkan kerangka keterlacakan dari analisis dan regulasi menuju komponen rancangan",
        "Menandai klausul perlindungan dan pengendalian yang perlu diterjemahkan ke geometri, norma, indikator, dan program",
        "Menyediakan geometri zonasi internal YG v0.2 sebagai dasar penyusunan lampiran peta alternatif"
      ],
      gaps: [
        "Belum ada naskah argumentasi pasal-per-pasal, matriks kegiatan/ITBX, ketentuan khusus, atau tabel intensitas usulan YG yang lengkap",
        "Belum ada konsistensi lintas dokumen yang dapat diperiksa antara batang tubuh, lampiran peta, tabel zonasi, dan basis data",
        "Rancangan YG tidak memiliki akibat hukum dan tidak dapat digunakan sebagai dasar KKPR; hanya RDTR yang telah ditetapkan pejabat berwenang yang dapat digunakan sesuai ketentuan"
      ]
    }
  ];
}

function buildCrossCuttingGates() {
  return [
    {
      id: "rtrw-sync",
      label: "Sinkronisasi dengan RTRW kabupaten/kota",
      status: "blocked_missing_official_evidence",
      regulationRefs: ["R01", "R02", "R03", "L01", "L02"],
      articleRef: "Permen ATR/BPN 11/2021, Pasal 20 ayat (2)",
      test: "Setiap tujuan, pusat pelayanan, jaringan, zona, program, dan aturan zonasi harus dapat ditelusuri ke RTRW Kabupaten Rokan Hilir yang sah serta dibaca bersama RTRW Provinsi Riau.",
      evidenceRequired: "Perda RTRW Kabupaten Rokan Hilir yang berlaku, lampiran peta digital, status perubahan, dan matriks sinkronisasi.",
      decisionRule: "Rancangan YG tetap dapat disusun sebagai alternatif internal, tetapi klaim konsistensi final ditahan sampai RTRW kabupaten yang berlaku beserta lampiran petanya dapat diuji."
    },
    {
      id: "klhs-integration",
      label: "Integrasi KLHS",
      status: "blocked_missing_official_evidence",
      regulationRefs: ["R03", "R05", "R09", "R10"],
      articleRef: "Permen ATR/BPN 11/2021, Pasal 29; Permen ATR/BPN 5/2022",
      test: "Alternatif dan muatan RDTR harus menunjukkan perubahan yang ditimbulkan oleh kajian daya dukung-daya tampung, jasa ekosistem, risiko, iklim, biodiversitas, serta penghidupan.",
      evidenceRequired: "Dokumen/peta kerja KLHS, alternatif, rekomendasi, matriks integrasi, penjaminan mutu, dan bukti validasi.",
      decisionRule: "Menahan pilihan berdampak tinggi sampai integrasi KLHS dapat dilacak ke geometri, norma, atau program."
    },
    {
      id: "participation-fpr",
      label: "Partisipasi masyarakat dan Forum Penataan Ruang",
      status: "pending_evidence",
      regulationRefs: ["R01", "R03", "R06", "R09", "R10"],
      articleRef: "Permen ATR/BPN 11/2021, Pasal 19, Pasal 20 ayat (4)–(5), dan Lampiran IV.1",
      test: "Masukan masyarakat dan rekomendasi FPR harus memiliki identitas isu, lokasi, bukti, respons, perubahan draf atau alasan penolakan, serta penanggung jawab.",
      evidenceRequired: "Pemberitaan publik, daftar pihak, materi, notulen, peta partisipatif, matriks respons, rekomendasi FPR, dan draf sebelum-sesudah.",
      decisionRule: "Tidak menganggap konsultasi substantif selesai bila hanya ada daftar hadir atau ringkasan tanpa jejak respons."
    },
    {
      id: "map-scale-5000",
      label: "Peta RDTR skala 1:5.000 dan mutu geospasial",
      status: "blocked_missing_official_evidence",
      regulationRefs: ["R03", "R04", "R15"],
      articleRef: "Permen ATR/BPN 11/2021, Pasal 21 dan Pasal 23 ayat (2)–(6); Permen ATR/BPN 14/2021",
      test: "Geometri WP, SWP, blok, subblok, zona, jaringan, dan atribut harus memakai peta dasar yang memenuhi ketelitian, referensi, topologi, metadata, serta konsistensi luas untuk skala 1:5.000.",
      evidenceRequired: "Rekomendasi peta dasar BIG, CRS/SRGI, laporan ketelitian dan topologi, metadata, kamus data, basis data, serta album peta.",
      decisionRule: "Layer baseline YG hanya untuk penyaringan; tidak dipromosikan menjadi geometri zonasi resmi."
    }
  ];
}

function buildMandatoryAnalysisMatrix(summary) {
  const details = {
    a: {
      status: "partial",
      finding: `Sebelas batas kelurahan/kepenghuluan telah dihimpun sebagai unit analitis, tetapi hierarki pusat pelayanan, SWP, blok, dan hubungan fungsional internal belum ditetapkan secara resmi.`,
      nextStep: "Analisis pusat pelayanan, jangkauan layanan, keterhubungan antarkawasan, serta alternatif SWP/blok setelah WP dan jaringan resmi diterima.",
      regulationRefs: ["R02", "R03", "L02"]
    },
    b: {
      status: "partial",
      finding: "Arahan RTRW provinsi telah dipotong ke wilayah kajian, tetapi inventaris penggunaan lahan eksisting skala 1:5.000 dan tren perubahannya belum tersedia.",
      nextStep: "Bangun klasifikasi penggunaan lahan eksisting termutakhir, validasi lapangan/citra, perubahan waktu, kepemilikan agregat, dan ketidaksesuaian pemanfaatan.",
      regulationRefs: ["R03", "R04", "R15"]
    },
    c: {
      status: "partial",
      finding: "Kawasan dipahami sebagai bagian Kecamatan Bangko dan Kabupaten Rokan Hilir, namun fungsi dalam sistem perkotaan, pesisir, DAS, serta jaringan regional belum dibuktikan dengan RTRW kabupaten yang sah.",
      nextStep: "Uji peran Bagansiapiapi terhadap pusat kabupaten, hinterland, pelabuhan/perikanan, DAS Rokan, pesisir, dan jaringan regional berdasarkan dokumen resmi.",
      regulationRefs: ["R01", "R03", "L01", "L02", "L03"]
    },
    d: {
      status: "partial_high_priority",
      finding: `Baseline mengindikasikan gambut ${summary.peatAreaHa.toLocaleString("id-ID")} ha (${summary.peatCoveragePct}%) dan non-APL ${summary.forestAreaHa.toLocaleString("id-ID")} ha (${summary.forestCoveragePct}%); data KHG, hidrologi, elevasi, rob, abrasi, dan subsidensi belum lengkap.`,
      nextStep: "Lengkapi kajian KHG/fungsi gambut, topografi-elevasi, tanah/geologi, hidrologi, pesisir, ekosistem, daya dukung-daya tampung, multi-bahaya, dan perubahan iklim.",
      regulationRefs: ["R05", "R09", "R10", "R11", "R12", "R13", "R14"]
    },
    e: {
      status: "not_started",
      finding: "Belum tersedia profil nilai budaya, pola ruang hidup, kelembagaan adat/lokal, kelompok rentan, akses pesisir, dan persepsi masyarakat yang dapat dihubungkan ke keputusan ruang.",
      nextStep: "Lakukan pemetaan sosial partisipatif yang menjaga data pribadi dan mencakup ruang hidup, situs bernilai budaya, kelompok rentan, konflik, serta aspirasi per wilayah.",
      regulationRefs: ["R01", "R03", "R06", "R10", "R13"]
    },
    f: {
      status: "not_started",
      finding: "Jumlah, distribusi, kepadatan, komposisi, migrasi, proyeksi, dan populasi terpapar bahaya belum tersedia pada unit analisis yang sesuai.",
      nextStep: "Susun baseline serta proyeksi penduduk dengan beberapa skenario, kapasitas layanan, rumah tangga rentan, dan eksposur risiko tanpa memaksakan angka ke zona yang belum terbentuk.",
      regulationRefs: ["R03", "R10"]
    },
    g: {
      status: "not_started",
      finding: "Belum ada analisis rantai nilai, tenaga kerja, pendapatan, sektor unggulan, ekonomi informal, perikanan/pesisir, atau ketergantungan pada ekosistem.",
      nextStep: "Petakan sektor dan rantai nilai, lokasi kegiatan, kebutuhan ruang, ketergantungan ekosistem, kerentanan iklim, serta manfaat/biaya alternatif pengembangan.",
      regulationRefs: ["R03", "R10", "R13"]
    },
    h: {
      status: "not_started",
      finding: "Jaringan, hierarki jalan, angkutan, pelabuhan/dermaga, pergerakan orang-barang, keselamatan, evakuasi, dan akses kelompok rentan belum dianalisis.",
      nextStep: "Lakukan survei jaringan dan pergerakan, akses layanan, logistik, titik konflik, konektivitas antarmoda, jalan aman-banjir, dan jalur evakuasi.",
      regulationRefs: ["R02", "R03", "R10"]
    },
    i: {
      status: "not_started",
      finding: "Inventaris kapasitas dan kondisi air minum, air limbah, persampahan, drainase, energi, telekomunikasi, proteksi kebakaran, serta fasilitas umum belum tersedia.",
      nextStep: "Petakan aset dan cakupan layanan, kapasitas, kondisi, kesenjangan, ketergantungan antarsistem, lokasi kritis, dan kebutuhan peningkatan yang tahan risiko.",
      regulationRefs: ["R02", "R03", "R08", "R10"]
    },
    j: {
      status: "not_started",
      finding: "Belum ada inventaris massa bangunan, kepadatan eksisting, ketinggian, kualitas hunian, permukiman rentan, ruang terbuka, warisan, dan kondisi blok.",
      nextStep: "Bangun basis bangunan/blok, tipologi, kondisi, kepadatan, ruang terbuka, akses darurat, kualitas hunian, serta paparan rob-banjir-kebakaran.",
      regulationRefs: ["R03", "R04", "R10"]
    },
    k: {
      status: "not_started",
      finding: "Mandat, kapasitas, koordinasi, pengelola data, FPR, mekanisme pengaduan, dan kemampuan pengawasan belum dipetakan.",
      nextStep: "Susun matriks kelembagaan/RACI untuk penyusunan, data, perizinan, perlindungan lingkungan, program, pengawasan, pengaduan, dan evaluasi.",
      regulationRefs: ["R03", "R06", "R08"]
    },
    l: {
      status: "not_started",
      finding: "Belum tersedia kebutuhan biaya, kemampuan fiskal, sumber pendanaan, biaya siklus hidup, prioritas, atau risiko pembiayaan program.",
      nextStep: "Susun perkiraan biaya indikatif setelah program terdefinisi, uji kemampuan fiskal dan sumber sah, operasi-pemeliharaan, tahapan, serta manfaat distribusional.",
      regulationRefs: ["R02", "R03", "R07"]
    },
    m: {
      status: "partial_provisional_zone_geometry",
      finding: "Geometri dan nomenklatur zona kandidat YG v0.2 telah tersedia, tetapi profil kondisi eksisting, daya dukung, risiko, akses, konflik, dan indikator kualitas per zona belum lengkap.",
      nextStep: "Susun profil setiap zona YG, pecah menjadi subzona berbasis bukti, lalu uji fungsi, kondisi eksisting, daya dukung, risiko, akses, konflik, kegiatan, dan target kualitas.",
      regulationRefs: ["R03", "R04", "R05", "R10"]
    },
    n: {
      status: "not_started",
      finding: "Daftar kegiatan eksisting, informal, musiman, terkait penghidupan, dan kegiatan yang mungkin berkembang belum diinventarisasi secara spasial.",
      nextStep: "Susun katalog kegiatan dengan skala, dampak, kebutuhan prasarana, keterkaitan ekonomi, risiko, kompatibilitas, serta skenario masa depan.",
      regulationRefs: ["R03", "R07", "R10", "R13"]
    },
    o: {
      status: "framework_only_pending_activity_matrix",
      finding: "Zona kandidat YG tersedia, tetapi kesesuaian kegiatan belum dapat diputuskan tanpa katalog kegiatan, matriks ITBX, bukti kondisi eksisting, dan kriteria dampak yang dapat diawasi.",
      nextStep: "Uji tiap kegiatan pada zona YG sebagai diizinkan, terbatas, bersyarat, atau tidak diperbolehkan menggunakan kriteria eksplisit, indikator, ambang, dan mekanisme pengawasan.",
      regulationRefs: ["R03", "R07", "R08"]
    },
    p: {
      status: "blocked_no_activity_scenarios",
      finding: "Dampak kegiatan belum dapat dihitung karena skenario lokasi, skala, teknologi, beban prasarana, dan penerima dampak belum tersedia.",
      nextStep: "Nilai dampak kumulatif pada hidrologi gambut, banjir/rob, pesisir, mangrove, lalu lintas, layanan, emisi, penghidupan, kesehatan, dan kelompok rentan.",
      regulationRefs: ["R05", "R09", "R10", "R11", "R12", "R13"]
    },
    q: {
      status: "blocked_no_zone_and_population_projection",
      finding: "Geometri zona kandidat YG tersedia, tetapi pertumbuhan penduduk per zona belum dapat dihitung karena proyeksi penduduk terpilah, kapasitas hunian, dan kapasitas layanan belum tersedia.",
      nextStep: "Distribusikan skenario penduduk ke zona YG dengan kapasitas hunian dan layanan, risiko, tren migrasi, serta batas daya dukung; hindari kepastian semu.",
      regulationRefs: ["R03", "R05", "R10"]
    },
    r: {
      status: "blocked_no_zone_quality_targets",
      finding: "Gap kualitas belum dapat diukur karena indikator/target kualitas per zona dan baseline lapangan belum ditetapkan.",
      nextStep: "Tetapkan indikator kualitas yang terukur setelah analisis, lalu bandingkan dengan kondisi lapangan dan prioritaskan intervensi tanpa menetapkan angka intensitas sebelum bukti cukup.",
      regulationRefs: ["R03", "R08", "R10"]
    },
    s: {
      status: "partial_high_priority",
      finding: "Karakter spesifik gambut, dataran rendah pesisir, mangrove, kawasan hutan, Sungai Rokan, dan risiko rob/abrasi telah diidentifikasi sebagai hipotesis spasial, belum sebagai batas hukum.",
      nextStep: "Delineasi karakter mikro melalui survei skala RDTR, hidrologi-pesisir, elevasi, sejarah genangan/abrasi, akses masyarakat, tenurial, dan pengetahuan lokal.",
      regulationRefs: ["R03", "R10", "R11", "R12", "R13", "R14"]
    },
    t: {
      status: "partial",
      finding: "Kerangka regulasi lintas sektor awal telah dihimpun, tetapi standar teknis lokal/terkini dan penerapannya pada setiap calon zona belum direkonsiliasi.",
      nextStep: "Susun matriks standar sektor per komponen/zona, konfirmasi versi berlaku dan kewenangan, lalu terjemahkan hanya standar yang relevan ke norma serta indikator RDTR.",
      regulationRefs: ["R02", "R03", "R04", "R05", "R07", "R08", "R10", "R11", "R12", "R13", "R14", "R15"]
    },
    u: {
      status: "partial",
      finding: "Batas kewenangan umum penataan ruang, kehutanan, lingkungan, pesisir, dan data telah dikenali, tetapi pembagian per keputusan/program belum dipetakan.",
      nextStep: "Buat matriks kewenangan per zona, izin/persetujuan, program, data, pengawasan, sanksi, dan penyelesaian konflik antara pusat, provinsi, kabupaten, serta instansi sektoral.",
      regulationRefs: ["R01", "R02", "R06", "R07", "R08", "R13", "R14", "R15"]
    }
  };
  const workbench = {
    a: {
      priority: "P0", workstream: "Fondasi wilayah dan struktur", analysisQuestion: "Bagaimana susunan pusat pelayanan, SWP/blok, jaringan, dan hubungan fungsional internal WP seharusnya dibentuk?",
      requiredData: ["Penetapan dan geometri WP resmi", "Sebaran layanan, fasilitas, permukiman, jaringan jalan dan pergerakan", "Jangkauan pelayanan, hambatan fisik, serta simpul ekonomi-pesisir"],
      method: ["Analisis hierarki dan jangkauan pelayanan", "Analisis konektivitas serta aksesibilitas", "Perbandingan alternatif pembagian SWP/blok"],
      outputs: ["Alternatif struktur internal WP", "Matriks pusat–jaringan–wilayah layanan dan alasan pemilihannya"],
      availableEvidence: ["Batas 11 kelurahan/kepenghuluan sebagai unit penyaringan YG"], evidenceGaps: ["WP resmi", "Inventaris layanan dan pergerakan", "Geometri jaringan serta alternatif SWP/blok"],
      geometryLink: "Menghasilkan kandidat pusat, jaringan, SWP, dan blok hanya setelah WP resmi serta bukti skala 1:5.000 tersedia.", decisionUse: "Menentukan rencana struktur ruang dan distribusi pelayanan; tidak boleh diturunkan hanya dari batas administrasi.",
      consultationPrompt: "Tunjukkan dasar penetapan WP, hierarki pusat, jangkauan layanan, serta pembandingan alternatif SWP/blok."
    },
    b: {
      priority: "P0", workstream: "Fondasi wilayah dan struktur", analysisQuestion: "Bagaimana penggunaan lahan eksisting, perubahan, penguasaan agregat, dan ketidaksesuaian pemanfaatan ruang tersebar?",
      requiredData: ["Tutupan/penggunaan lahan termutakhir skala kerja RDTR", "Citra multitemporal dan hasil verifikasi lapangan", "Status penguasaan/perizinan agregat serta indikasi ketidaksesuaian"],
      method: ["Klasifikasi penggunaan lahan", "Deteksi perubahan multitemporal", "Overlay penggunaan–izin–rencana dan uji lapangan"],
      outputs: ["Peta penggunaan lahan eksisting dan perubahan", "Daftar lokasi konflik/ketidaksesuaian beserta tingkat keyakinan"],
      availableEvidence: ["Arahan indikatif RTRW Provinsi Riau", "Batas unit kajian YG"], evidenceGaps: ["Peta penggunaan lahan 1:5.000", "Citra dan ground check", "Data penguasaan/perizinan terotorisasi"],
      geometryLink: "Menjadi baseline calon zona, tetapi bukan geometri pola ruang sebelum verifikasi lapangan dan data legal.", decisionUse: "Menguji apakah pola ruang mengikuti kondisi, kebutuhan pemulihan, dan transisi kegiatan eksisting.",
      consultationPrompt: "Minta peta penggunaan lahan, tahun citra, metode klasifikasi, hasil uji akurasi, dan perlakuan terhadap kegiatan eksisting yang tidak sesuai."
    },
    c: {
      priority: "P0", workstream: "Fondasi wilayah dan struktur", analysisQuestion: "Apa peran Bagansiapiapi dalam sistem perkotaan, kabupaten, pesisir, DAS Rokan, dan jaringan regional?",
      requiredData: ["RTRW kabupaten/provinsi beserta lampiran geospasial", "Arus orang-barang dan keterkaitan hinterland", "Peran pelabuhan, perikanan, perdagangan, pemerintahan, dan layanan regional"],
      method: ["Analisis kebijakan dan hierarki pusat", "Analisis aliran serta keterkaitan wilayah", "Uji konsistensi struktur ruang lintas skala"],
      outputs: ["Profil kedudukan dan fungsi regional", "Matriks konsistensi RTRW–RDTR"],
      availableEvidence: ["Arahan RTRW Provinsi Riau untuk penyaringan"], evidenceGaps: ["RTRW Kabupaten Rokan Hilir yang berlaku", "Data aliran regional", "Geometri perbatasan/pesisir yang relevan"],
      geometryLink: "Mengunci hubungan pusat dan jaringan RDTR dengan struktur ruang pada rencana lebih tinggi.", decisionUse: "Mencegah struktur RDTR yang terputus dari hierarki dan fungsi wilayah.",
      consultationPrompt: "Minta matriks konsistensi tujuan, pusat, jaringan, dan program RDTR terhadap RTRW kabupaten serta provinsi."
    },
    d: {
      priority: "P0", workstream: "Ekologi, fisik, dan risiko", analysisQuestion: "Bagian mana yang memiliki daya dukung terbatas, fungsi ekologis penting, atau paparan bahaya yang tidak layak diintensifkan?",
      requiredData: ["KHG/fungsi gambut, kedalaman, muka air, drainase, subsidensi dan kebakaran", "DEM/elevasi, geologi, tanah, hidrologi, DAS, rob, banjir, abrasi dan iklim", "Mangrove, pesisir, biodiversitas, jasa ekosistem, daya dukung dan daya tampung"],
      method: ["Overlay kendala dan sensitivitas", "Pemodelan multi-bahaya serta skenario iklim", "Analisis daya dukung-daya tampung dan jasa ekosistem"],
      outputs: ["Peta sensitivitas/kendala pengembangan", "Ambang keputusan lindungi–pulihkan–batasi–dapat dipertimbangkan"],
      availableEvidence: [`Indikasi gambut ${summary.peatAreaHa.toLocaleString("id-ID")} ha`, `Indikasi non-APL ${summary.forestAreaHa.toLocaleString("id-ID")} ha`, "Analisis mangrove parsial"], evidenceGaps: ["KHG/fungsi gambut resmi", "DEM dan model rob-banjir-subsidensi", "Daya dukung-daya tampung serta KLHS"],
      geometryLink: "Membentuk overlay kendala dan ketentuan khusus risiko; bukan zona hukum tersendiri sebelum integrasi KLHS dan verifikasi resmi.", decisionUse: "Pengunci utama pola ruang, intensitas, ketentuan khusus, dan program perlindungan/pemulihan.",
      consultationPrompt: "Minta model dan asumsi gambut, rob, banjir, abrasi, subsidensi, kebakaran, kenaikan muka laut, serta cara hasilnya mengubah zona dan intensitas."
    },
    e: {
      priority: "P1", workstream: "Masyarakat, penduduk, dan ekonomi", analysisQuestion: "Ruang hidup, nilai budaya, kelompok rentan, kelembagaan lokal, konflik, dan aspirasi apa yang harus dilindungi atau diakomodasi?",
      requiredData: ["Pemetaan sosial dan ruang hidup", "Situs/nilai budaya serta kelembagaan lokal", "Kelompok rentan, akses pesisir-sungai, konflik dan aspirasi"],
      method: ["Pemetaan partisipatif berperlindungan data pribadi", "Wawancara/FGD terpilah", "Analisis akses, distribusi manfaat, dan potensi pemindahan"],
      outputs: ["Peta nilai sosial-budaya dan akses masyarakat", "Daftar perlindungan, mitigasi sosial, dan indikator inklusi"],
      availableEvidence: ["Daftar awal wilayah dan isu penghidupan pesisir"], evidenceGaps: ["Survei sosial", "Peta partisipatif", "Data kelompok rentan dan konflik terverifikasi"],
      geometryLink: "Menandai koridor akses, ruang hidup, situs bernilai, serta area konflik secara terkontrol dan tidak memuat data pribadi.", decisionUse: "Menguji dampak distribusional pola ruang dan mencegah hilangnya akses masyarakat.",
      consultationPrompt: "Siapa yang dilibatkan, ruang hidup apa yang dipetakan, dan bagaimana keberatan masyarakat mengubah peta atau norma?"
    },
    f: {
      priority: "P1", workstream: "Masyarakat, penduduk, dan ekonomi", analysisQuestion: "Berapa penduduk saat ini dan mendatang, di mana tersebar, siapa yang rentan, serta bagaimana kebutuhan layanan dan paparan risikonya?",
      requiredData: ["Penduduk per unit kecil menurut umur/jenis kelamin/kerentanan", "Migrasi, rumah tangga, kepadatan dan proyeksi multi-skenario", "Populasi terpapar bahaya dan akses layanan"],
      method: ["Rekonsiliasi data BPS–administrasi", "Proyeksi kohor/komponen atau skenario yang dapat diaudit", "Overlay penduduk–layanan–bahaya"],
      outputs: ["Baseline dan proyeksi penduduk", "Peta kepadatan, kebutuhan layanan, dan populasi terpapar"],
      availableEvidence: ["Unit kajian administrasi tersedia"], evidenceGaps: ["Data penduduk terpilah", "Asumsi migrasi/proyeksi", "Data paparan per unit kecil"],
      geometryLink: "Mengisi kebutuhan kapasitas pada geometri zona YG v0.2; agregasi wajib menjaga privasi dan memakai skenario yang dapat diaudit.", decisionUse: "Menentukan kebutuhan ruang, layanan, hunian, dan kapasitas evakuasi tanpa menggelembungkan proyeksi.",
      consultationPrompt: "Minta tahun dasar, sumber, asumsi migrasi, skenario proyeksi, dan populasi terpapar per bahaya."
    },
    g: {
      priority: "P1", workstream: "Masyarakat, penduduk, dan ekonomi", analysisQuestion: "Sektor dan rantai nilai apa yang menopang Bagansiapiapi, membutuhkan ruang, bergantung pada ekosistem, atau rentan terhadap perubahan ruang dan iklim?",
      requiredData: ["PDRB/tenaga kerja/pendapatan dan usaha formal-informal", "Rantai nilai perikanan, perdagangan, jasa, perkebunan, dan UMKM", "Lokasi kegiatan, kebutuhan lahan/prasarana, ketergantungan ekosistem dan iklim"],
      method: ["Analisis basis ekonomi dan rantai nilai", "Pemetaan klaster serta keterkaitan lokasi", "Analisis manfaat-biaya dan distribusi tiap alternatif"],
      outputs: ["Peta sektor unggulan dan penghidupan", "Skenario kebutuhan ruang ekonomi yang kompatibel dengan daya dukung"],
      availableEvidence: ["Hipotesis awal fungsi perikanan/pesisir dan perdagangan"], evidenceGaps: ["Data usaha dan tenaga kerja", "Rantai nilai", "Kerugian/manfaat spasial setiap alternatif"],
      geometryLink: "Menunjukkan simpul, koridor, area produksi dan akses sumber daya; bukan pembenaran otomatis untuk intensifikasi.", decisionUse: "Menyusun zona penghidupan/produksi, jaringan pendukung, dan program ekonomi yang adil.",
      consultationPrompt: "Minta bukti sektor unggulan, kebutuhan ruang, ketergantungan ekosistem, penerima manfaat, dan kelompok yang menanggung biaya."
    },
    h: {
      priority: "P1", workstream: "Jaringan dan lingkungan binaan", analysisQuestion: "Bagaimana pergerakan orang-barang, akses layanan, keselamatan, logistik, dan evakuasi bekerja dalam kondisi normal maupun bencana?",
      requiredData: ["Jaringan/hierarki/kondisi jalan dan angkutan", "Asal-tujuan, volume, simpul logistik, pelabuhan/dermaga dan titik konflik", "Genangan, akses layanan, keselamatan dan jalur evakuasi"],
      method: ["Analisis jaringan, waktu tempuh, dan aksesibilitas", "Survei pergerakan dan keselamatan", "Uji keandalan jaringan pada skenario bencana"],
      outputs: ["Hierarki jaringan dan simpul", "Kesenjangan akses, jalur aman, dan prioritas peningkatan"],
      availableEvidence: ["Indikasi jaringan pada peta dasar/baseline"], evidenceGaps: ["Inventaris kondisi dan hierarki", "Survei pergerakan", "Model akses saat rob/banjir"],
      geometryLink: "Menghasilkan kandidat jaringan struktur ruang dan koridor evakuasi dengan status kematangan jelas.", decisionUse: "Menguji lokasi pusat/zona dan prioritas jaringan agar tetap berfungsi saat bahaya.",
      consultationPrompt: "Minta data pergerakan, standar pelayanan, lokasi kemacetan/kecelakaan, akses kelompok rentan, serta jaringan yang tetap berfungsi saat banjir/rob."
    },
    i: {
      priority: "P1", workstream: "Jaringan dan lingkungan binaan", analysisQuestion: "Berapa kapasitas, cakupan, kondisi, dan kesenjangan prasarana serta fasilitas pelayanan pada kondisi sekarang dan proyeksi?",
      requiredData: ["Air minum, air limbah, drainase, sampah, energi, telekomunikasi dan proteksi kebakaran", "Fasilitas pendidikan, kesehatan, pemerintahan, ruang publik dan layanan darurat", "Kapasitas, kondisi, wilayah layanan, rencana investasi dan ketergantungan sistem"],
      method: ["Inventaris aset dan analisis cakupan", "Neraca kebutuhan–kapasitas", "Uji ketahanan serta ketergantungan antarsistem"],
      outputs: ["Peta aset/cakupan/kesenjangan layanan", "Kebutuhan peningkatan, lokasi kritis, dan standar pelayanan"],
      availableEvidence: ["Belum ada dataset terverifikasi dalam baseline YG"], evidenceGaps: ["Data aset utilitas", "Kapasitas dan kondisi", "Wilayah layanan dan rencana investasi"],
      geometryLink: "Menghasilkan jaringan dan titik fasilitas kandidat; data sensitif utilitas tidak diekspos pada keluaran publik.", decisionUse: "Menahan pertumbuhan yang tidak dapat dilayani dan memprioritaskan layanan dasar tahan risiko.",
      consultationPrompt: "Minta peta aset, kapasitas, wilayah layanan, standar, backlog, rencana investasi, dan skenario gangguan bencana."
    },
    j: {
      priority: "P1", workstream: "Jaringan dan lingkungan binaan", analysisQuestion: "Bagaimana bentuk, kepadatan, kualitas, keamanan, dan paparan lingkungan binaan pada tingkat blok?",
      requiredData: ["Tapak/massa bangunan, fungsi, tinggi, kepadatan dan kondisi", "Kualitas hunian, permukiman rentan, ruang terbuka, warisan dan akses darurat", "Paparan rob, banjir, kebakaran dan subsidensi pada bangunan/blok"],
      method: ["Inventaris bangunan dan tipologi blok", "Analisis kepadatan/kualitas/ruang terbuka", "Overlay bangunan–bahaya–akses darurat"],
      outputs: ["Atlas tipologi dan kualitas blok", "Area konsolidasi, peningkatan, perlindungan, atau pembatasan"],
      availableEvidence: ["Batas unit kajian; kondisi blok belum dihimpun"], evidenceGaps: ["Basis bangunan", "Survei kualitas hunian", "Data paparan tingkat tapak/blok"],
      geometryLink: "Menjadi dasar blok/subblok dan parameter zonasi setelah survei skala RDTR.", decisionUse: "Menentukan area peningkatan kualitas, konsolidasi aman, ruang terbuka, dan akses darurat.",
      consultationPrompt: "Minta basis bangunan, definisi kepadatan/kekumuhan, kondisi blok, warisan, ruang terbuka, dan paparan bahaya."
    },
    k: {
      priority: "P1", workstream: "Tata kelola dan pembiayaan", analysisQuestion: "Siapa berwenang, memiliki data, melaksanakan, mengawasi, menerima pengaduan, dan bertanggung jawab atas setiap keputusan RDTR?",
      requiredData: ["Mandat dan struktur organisasi", "FPR/tim penyusun/pengelola data", "SOP perizinan, pengawasan, pengaduan, evaluasi dan koordinasi"],
      method: ["Pemetaan pemangku kepentingan", "Matriks RACI", "Analisis kapasitas, celah mandat dan alur keputusan"],
      outputs: ["Matriks kelembagaan/RACI", "Rencana penguatan kapasitas dan tata kelola data"],
      availableEvidence: ["Kerangka kewenangan regulatif tingkat umum"], evidenceGaps: ["SK tim/FPR", "SOP dan kapasitas aktual", "Penanggung jawab data/pengawasan"],
      geometryLink: "Mengaitkan tiap geometri, norma, program, dan indikator dengan wali data serta instansi pelaksana.", decisionUse: "Mencegah aturan tanpa pelaksana, data pemantauan, pengaduan, atau mekanisme penegakan.",
      consultationPrompt: "Minta SK, komposisi FPR, matriks tanggung jawab, wali data, mekanisme pengaduan, dan kapasitas pengawasan."
    },
    l: {
      priority: "P2", workstream: "Tata kelola dan pembiayaan", analysisQuestion: "Program mana yang layak dibiayai, kapan, oleh siapa, dari sumber apa, dan bagaimana operasi-pemeliharaannya?",
      requiredData: ["Daftar program, volume dan biaya indikatif", "Kapasitas fiskal, APBD/APBN dan sumber pendanaan sah", "Biaya siklus hidup, operasi-pemeliharaan, tahapan dan penerima manfaat"],
      method: ["Costing indikatif dan analisis fiskal", "Prioritisasi multi-kriteria", "Analisis siklus hidup, risiko pembiayaan dan distribusi manfaat"],
      outputs: ["Matriks program–biaya–sumber–tahapan", "Daftar prioritas realistis dan kebutuhan O&M"],
      availableEvidence: ["Portofolio program YG masih berupa kandidat"], evidenceGaps: ["Horizon dan volume program", "Data fiskal", "Komitmen pelaksana/sumber dana"],
      geometryLink: "Lokasi program tidak difinalkan sebelum hasil analisis, kewenangan, lahan, dan pembiayaan jelas.", decisionUse: "Memisahkan aspirasi dari program yang implementabel dan terpelihara.",
      consultationPrompt: "Minta biaya, sumber dana, penahapan, pelaksana, kebutuhan lahan, operasi-pemeliharaan, dan dasar prioritas setiap program."
    },
    m: {
      priority: "P0", workstream: "Zonasi dan pengendalian", analysisQuestion: "Apa karakter, fungsi, kondisi, daya dukung, risiko, akses, dan kualitas yang diharapkan pada setiap zona/subzona?",
      requiredData: ["Geometri dan nomenklatur zona YG bernomor versi", "Profil kondisi eksisting dan daya dukung tiap zona", "Risiko, akses, konflik, kegiatan dan target kualitas"],
      method: ["Profil spasial per zona", "Statistik zonal dan uji homogenitas", "Perbandingan kondisi–fungsi–target"],
      outputs: ["Lembar profil setiap zona/subzona", "Justifikasi batas, fungsi, dan target kualitas"],
      availableEvidence: ["Geometri zona alternatif YG v0.2 saling eksklusif"], evidenceGaps: ["Peta dasar 1:5.000", "Profil kondisi dan target tiap zona", "Baseline terpilah per zona"],
      geometryLink: "Gunakan geometri zona YG bernomor versi sebagai unit kerja internal; unit administrasi tetap hanya konteks analitis.", decisionUse: "Menjadi dasar seluruh matriks kegiatan, intensitas, ketentuan khusus, dan evaluasi zona.",
      consultationPrompt: "Uji profil yang membuktikan mengapa batas serta fungsi tiap zona YG dipilih, lalu catat koreksi lokasi dan bukti pendukungnya."
    },
    n: {
      priority: "P1", workstream: "Zonasi dan pengendalian", analysisQuestion: "Kegiatan apa yang eksisting, informal, musiman, terkait penghidupan, atau mungkin berkembang beserta skala dan dampaknya?",
      requiredData: ["Inventaris kegiatan dan lokasi", "Skala, teknologi, jam operasi, kebutuhan prasarana dan tenaga kerja", "Dampak, keterkaitan ekonomi, risiko serta kecenderungan perkembangan"],
      method: ["Survei kegiatan dan klasifikasi", "Analisis rantai nilai/lokasi", "Penyusunan skenario kegiatan masa depan"],
      outputs: ["Katalog kegiatan spasial", "Profil karakteristik dan skenario perkembangan kegiatan"],
      availableEvidence: ["Hipotesis sektor/penghidupan awal"], evidenceGaps: ["Inventaris kegiatan", "Skala dan karakter operasi", "Skenario perkembangan"],
      geometryLink: "Menautkan kegiatan pada lokasi eksisting dan calon zona tanpa mengungkap data pribadi atau bisnis sensitif.", decisionUse: "Bahan baku matriks kegiatan dan mitigasi dampak; bukan daftar izin otomatis.",
      consultationPrompt: "Minta katalog kegiatan termasuk informal/musiman, skala, dampak, kebutuhan prasarana, dan asumsi kegiatan masa depan."
    },
    o: {
      priority: "P0", workstream: "Zonasi dan pengendalian", analysisQuestion: "Mengapa suatu kegiatan diizinkan, terbatas, bersyarat, atau dilarang pada setiap zona/subzona?",
      requiredData: ["Geometri/profil zona", "Katalog kegiatan", "Kriteria kompatibilitas, daya dukung, risiko, standar dan kemampuan pengawasan"],
      method: ["Matriks kompatibilitas kegiatan–zona", "Uji berbasis kriteria dan dampak", "Audit keterlaksanaan syarat serta pengawasan"],
      outputs: ["Matriks ITBX/ketentuan kegiatan", "Justifikasi dan syarat terukur tiap pasangan kegiatan–zona"],
      availableEvidence: ["Kerangka keputusan Tahan–Verifikasi–Bersyarat–Revisi", "Geometri zona alternatif YG v0.2"], evidenceGaps: ["Katalog kegiatan", "Kriteria dan ambang terukur", "Kemampuan pengawasan"],
      geometryLink: "Keputusan hanya sah untuk pasangan kegiatan–zona dengan geometri dan versi yang jelas.", decisionUse: "Inti peraturan zonasi dan pengendalian pemanfaatan ruang.",
      consultationPrompt: "Minta alasan dan bukti untuk setiap klasifikasi kegiatan, termasuk syarat, indikator, instansi pengawas, dan konsekuensi pelanggaran."
    },
    p: {
      priority: "P0", workstream: "Zonasi dan pengendalian", analysisQuestion: "Apa dampak langsung, tidak langsung, kumulatif, lintas batas, dan distribusional dari setiap skenario kegiatan?",
      requiredData: ["Skenario lokasi, skala, teknologi dan tahap kegiatan", "Baseline hidrologi, ekologi, lalu lintas, layanan, emisi, kesehatan dan sosial", "Penerima dampak, ambang, mitigasi dan kapasitas pemantauan"],
      method: ["Matriks jalur dampak", "Analisis kumulatif dan skenario", "Overlay penerima dampak serta uji mitigasi"],
      outputs: ["Matriks dampak–lokasi–penerima", "Syarat penghindaran, mitigasi, pemulihan dan pemantauan"],
      availableEvidence: ["Indikasi sensitivitas gambut, kawasan hutan, pesisir dan mangrove"], evidenceGaps: ["Skenario kegiatan", "Baseline lengkap", "Ambang dan model dampak kumulatif"],
      geometryLink: "Dampak dianalisis pada sumber, jalur, penerima, dan wilayah fungsional—tidak berhenti di batas zona.", decisionUse: "Menentukan larangan/syarat, kapasitas, buffer berbasis bukti, serta program mitigasi.",
      consultationPrompt: "Minta skenario dampak kumulatif terhadap hidrologi gambut, rob/banjir, mangrove, akses, kesehatan, penghidupan, dan kelompok rentan."
    },
    q: {
      priority: "P1", workstream: "Zonasi dan pengendalian", analysisQuestion: "Berapa penduduk yang dapat dan diproyeksikan tinggal pada setiap zona dengan mempertimbangkan hunian, layanan, risiko, dan daya dukung?",
      requiredData: ["Geometri zona", "Proyeksi penduduk dan rumah tangga", "Kapasitas hunian, layanan, akses, risiko dan daya dukung"],
      method: ["Alokasi proyeksi berbasis skenario", "Analisis kapasitas hunian/layanan", "Uji sensitivitas terhadap migrasi dan bahaya"],
      outputs: ["Proyeksi penduduk per zona", "Kebutuhan ruang/layanan dan batas kapasitas"],
      availableEvidence: ["Geometri zona alternatif YG v0.2 tersedia"], evidenceGaps: ["Proyeksi terpilah", "Kapasitas hunian dan layanan", "Skenario migrasi serta bahaya"],
      geometryLink: "Tidak menghitung per zona sebelum geometri dan skenario penduduk tervalidasi.", decisionUse: "Menguji intensitas, layanan, dan tahapan pengembangan agar tidak melampaui kapasitas.",
      consultationPrompt: "Minta metode alokasi penduduk per zona, kapasitas hunian/layanan, asumsi migrasi, dan batas daya dukung."
    },
    r: {
      priority: "P1", workstream: "Zonasi dan pengendalian", analysisQuestion: "Seberapa besar selisih kondisi lapangan terhadap kualitas yang ditargetkan pada tiap zona, dan intervensi apa yang paling prioritas?",
      requiredData: ["Indikator dan target kualitas per zona", "Baseline lapangan", "Standar pelayanan, risiko, kebutuhan masyarakat dan biaya intervensi"],
      method: ["Gap analysis indikator–baseline", "Pembobotan prioritas", "Uji kelayakan dan distribusi manfaat"],
      outputs: ["Skor gap kualitas per zona", "Prioritas peningkatan/pemulihan dan indikator monitoring"],
      availableEvidence: ["Kerangka tujuan dan arah kualitas YG masih sementara"], evidenceGaps: ["Target terukur", "Baseline per zona", "Ambang prioritas"],
      geometryLink: "Skor terikat pada zona/indikator/versi data; tidak diterapkan pada geometri penyaringan YG sebagai fakta final.", decisionUse: "Menentukan indikasi program, tahapan, target, dan evaluasi RDTR.",
      consultationPrompt: "Minta indikator, nilai awal, target akhir, standar pembanding, lokasi gap, dan hubungan langsung dengan program."
    },
    s: {
      priority: "P0", workstream: "Ekologi, fisik, dan risiko", analysisQuestion: "Karakter mikro apa yang membuat suatu lokasi memerlukan perlakuan berbeda dari zona di sekitarnya?",
      requiredData: ["Elevasi mikro, hidrologi, pesisir, pasut, abrasi/akresi dan sejarah genangan", "Gambut, mangrove, kawasan hutan, tenurial dan akses", "Pengetahuan lokal serta verifikasi lapangan"],
      method: ["Delineasi unit karakter", "Transek/survei lapangan", "Overlay multi-kriteria dan validasi partisipatif"],
      outputs: ["Atlas karakter spesifik lokasi", "Ketentuan khusus atau koreksi batas zona"],
      availableEvidence: ["Hipotesis spasial gambut, pesisir, Sungai Rokan, mangrove dan non-APL"], evidenceGaps: ["Survei skala mikro", "Elevasi/hidrologi/pesisir rinci", "Validasi tenurial dan pengetahuan lokal"],
      geometryLink: "Menghasilkan unit karakter dan overlay ketentuan khusus; tidak otomatis menjadi zona baru.", decisionUse: "Mencegah generalisasi aturan pada lokasi dengan karakter ekologis, risiko, atau sosial yang berbeda.",
      consultationPrompt: "Minta bukti karakter mikro dan tunjukkan lokasi yang menyebabkan batas zona atau ketentuan khusus berbeda."
    },
    t: {
      priority: "P0", workstream: "Standar dan kewenangan", analysisQuestion: "Standar sektoral mana yang berlaku, mutakhir, relevan, dapat dipetakan, dan dapat diawasi untuk setiap komponen/zona?",
      requiredData: ["Daftar peraturan/standar sektoral terkini", "Ruang lingkup, kewenangan, parameter dan satuan", "Penerapan spasial, pengecualian, versi serta mekanisme pengawasan"],
      method: ["Register dan uji status hukum", "Crosswalk standar–zona–indikator", "Uji konsistensi serta keterlaksanaan"],
      outputs: ["Matriks standar sektor per komponen/zona", "Daftar parameter yang masuk norma, peta, atau program"],
      availableEvidence: ["Register awal regulasi penataan ruang, KLHS, gambut, pesisir, kehutanan dan geospasial"], evidenceGaps: ["Standar teknis lokal/terbaru", "Crosswalk per zona", "Konfirmasi instansi berwenang"],
      geometryLink: "Setiap standar spasial harus menyebut objek, geometri, versi, skala, dan sumber yang sah.", decisionUse: "Mencegah salin-tempel standar yang tidak relevan serta menjamin norma dapat diukur.",
      consultationPrompt: "Minta register regulasi dengan status berlaku, parameter, objek/zona penerapan, sumber geometri, dan instansi pengawas."
    },
    u: {
      priority: "P0", workstream: "Standar dan kewenangan", analysisQuestion: "Tingkat pemerintahan dan instansi mana yang berwenang atas perencanaan, izin/persetujuan, program, data, pengawasan, sanksi, dan konflik?",
      requiredData: ["Pembagian urusan dan kewenangan", "Matriks izin/persetujuan serta pengawasan", "Kewenangan data, program, sanksi dan penyelesaian konflik"],
      method: ["Analisis yuridis kewenangan", "Matriks keputusan–instansi–proses", "Uji tumpang tindih dan kekosongan tanggung jawab"],
      outputs: ["Matriks kewenangan per keputusan/program", "Daftar isu koordinasi dan jalur penyelesaiannya"],
      availableEvidence: ["Kerangka kewenangan umum lintas penataan ruang, lingkungan, pesisir, kehutanan dan geospasial"], evidenceGaps: ["Pembagian per keputusan", "SOP lintas instansi", "Mekanisme konflik dan eskalasi"],
      geometryLink: "Menetapkan siapa yang berwenang menghasilkan, menyetujui, menggunakan, dan mengawasi setiap geometri.", decisionUse: "Mencegah RDTR mengambil alih kewenangan sektoral atau membuat norma tanpa otoritas pelaksana.",
      consultationPrompt: "Minta matriks kewenangan pusat–provinsi–kabupaten per zona, persetujuan, program, data, pengawasan, sanksi, dan konflik."
    }
  };
  return PASAL_24_CATEGORIES.map(([letter, category]) => ({
    id: `A24-${letter}`,
    letter,
    category,
    articleRef: `Permen ATR/BPN 11/2021, Pasal 24 huruf ${letter}`,
    ...details[letter],
    ...workbench[letter]
  }));
}

function buildAnalysisProgramme(rows) {
  const priorities = ["P0", "P1", "P2"].map(priority => ({
    priority,
    count: rows.filter(row => row.priority === priority).length
  }));
  return {
    status: "internal_working_programme",
    rule: "P0 adalah pengunci geometri atau keputusan; P1 melengkapi kebutuhan, dampak, dan keterlaksanaan; P2 diselesaikan setelah program dan horizon rencana cukup matang.",
    priorities,
    workstreams: [...new Set(rows.map(row => row.workstream))].map(name => ({
      name,
      analyses: rows.filter(row => row.workstream === name).map(row => row.id)
    })),
    criticalPath: ["A24-c", "A24-a", "A24-b", "A24-d", "A24-s", "A24-m", "A24-n", "A24-p", "A24-o", "A24-t", "A24-u"],
    promotionRule: "Rancangan zona, jaringan, intensitas, atau program tidak dinaikkan statusnya bila analisis P0 yang menjadi prasyaratnya belum memiliki data resmi, metode, hasil, metadata, dan jejak validasi."
  };
}

function buildYgPlan(ygCandidateZones = featureCollection([]), zoningCodebook = {}, structureDraft = {}, networkEvidence = {}, serviceEvidence = {}, serviceAccess = {}, developmentReadiness = {}) {
  const geometryDisclaimer = "Rancangan YG memiliki geometri zona internal untuk analisis dan konsultasi, tetapi tidak menetapkan batas WP, SWP, blok, subblok, zona, jaringan, atau lokasi program secara hukum. Pematangan wajib memakai peta dasar skala 1:5.000, survei, RTRW yang sah, KLHS, serta validasi lintas sektor dan masyarakat.";
  const zoneFeatures = ygCandidateZones.features || [];
  function zoneMetric(families) {
    const selected = zoneFeatures.filter(feature => families.includes(feature.properties?.zoneFamily));
    return {
      featureCount: selected.length,
      areaHa: round(selected.reduce((sum, feature) => sum + areaHa(feature), 0))
    };
  }
  function zoneCodes(families) {
    return [...new Set(zoneFeatures.filter(feature => families.includes(feature.properties?.zoneFamily))
      .map(feature => feature.properties?.code).filter(Boolean))].sort();
  }
  return {
    version: "0.1.0-internal",
    status: "provisional_analytical_draft",
    legalCutoff: "2026-09-20",
    disclaimer: `Rancangan Analitis RDTR versi YG adalah bahan internal dan argumen pembanding, bukan RDTR resmi, naskah perkada, dasar KKPR, atau penetapan hak. ${geometryDisclaimer} Angka intensitas seperti KDB, KLB, KDH, ketinggian, kepadatan, dan koefisien lain belum ditetapkan karena bukti teknis belum memadai.`,
    planningObjective: {
      id: "OBJ-YG-1",
      status: "provisional",
      statement: "Mengarahkan Kawasan Perkotaan Bagansiapiapi sebagai pusat pelayanan yang aman, inklusif, dan tangguh terhadap rob, banjir, abrasi, kebakaran, serta subsidensi; menjaga fungsi gambut, kawasan hutan, mangrove, sungai, dan pesisir; mempertahankan akses serta penghidupan masyarakat; dan mengonsolidasikan pertumbuhan pada lokasi yang terbukti sesuai dan dapat dilayani.",
      measurementStatus: "indicators_pending_complete_analysis_and_klhs",
      qualification: "Rumusan tujuan menjadi dasar rancangan alternatif YG. Nilai/kualitas yang terukur dan kesesuaiannya dengan RTRW Kabupaten Rokan Hilir tetap harus diuji ketika instrumen yang berlaku, analisis lengkap, dan KLHS tersedia.",
      regulationRefs: ["R01", "R02", "R03", "R05", "R09", "R10", "R11", "R12", "R13", "R14"]
    },
    strategies: [
      {
        id: "STR-YG-1",
        status: "provisional",
        direction: "Jadikan fungsi ekosistem dan risiko multi-bahaya sebagai penyaring pertama sebelum mengalokasikan pertumbuhan atau infrastruktur.",
        analysisRefs: ["A24-d", "A24-p", "A24-s"],
        regulationRefs: ["R05", "R09", "R10", "R11", "R12", "R13", "R14"]
      },
      {
        id: "STR-YG-2",
        status: "provisional",
        direction: "Konsolidasikan pertumbuhan pada kawasan terbangun yang terbukti aman, sesuai hierarki RTRW, dan dapat dilayani tanpa memperbesar kerentanan.",
        analysisRefs: ["A24-a", "A24-b", "A24-c", "A24-j", "A24-q", "A24-r"],
        regulationRefs: ["R01", "R02", "R03", "L01", "L02"]
      },
      {
        id: "STR-YG-3",
        status: "provisional",
        direction: "Bangun struktur pelayanan, mobilitas, drainase, air bersih, sanitasi, evakuasi, dan konektivitas digital yang tahan gangguan serta menjangkau kelompok rentan.",
        analysisRefs: ["A24-a", "A24-h", "A24-i", "A24-j"],
        regulationRefs: ["R02", "R03", "R08", "R10"]
      },
      {
        id: "STR-YG-4",
        status: "provisional",
        direction: "Lindungi ruang hidup, akses sungai-pesisir, perikanan, ekonomi lokal, hak/persetujuan eksisting, dan penyelesaian konflik secara adil.",
        analysisRefs: ["A24-e", "A24-g", "A24-n", "A24-u"],
        regulationRefs: ["R01", "R07", "R10", "R13", "R14"]
      },
      {
        id: "STR-YG-5",
        status: "provisional",
        direction: "Terjemahkan perlindungan ke aturan zonasi, indikator, penanggung jawab, pembiayaan, pengawasan, dan konsekuensi yang dapat dilaksanakan.",
        analysisRefs: ["A24-k", "A24-l", "A24-m", "A24-o", "A24-p", "A24-t", "A24-u"],
        regulationRefs: ["R02", "R03", "R07", "R08"]
      },
      {
        id: "STR-YG-6",
        status: "provisional",
        direction: "Pertahankan jejak keputusan terbuka dari data, analisis, KLHS, dan masukan masyarakat menuju setiap geometri, norma, dan program.",
        analysisRefs: ["A24-k", "A24-t", "A24-u"],
        regulationRefs: ["R03", "R04", "R05", "R06", "R09", "R10", "R15"]
      }
    ],
    alternatives: [
      {
        id: "ALT-0",
        label: "Kecenderungan tanpa intervensi baru",
        status: "scenario_framework_incomplete",
        selected: false,
        concept: "Menguji konsekuensi bila pola pemanfaatan, kerentanan, dan kapasitas layanan berkembang menurut kecenderungan eksisting tanpa koreksi ruang yang memadai.",
        evaluation: "Belum dapat dikuantifikasi tanpa penggunaan lahan, proyeksi penduduk-ekonomi, kapasitas layanan, dan skenario bahaya."
      },
      {
        id: "ALT-YG-2",
        label: "Pertumbuhan tersebar berbasis arahan provinsi",
        status: "scenario_framework_incomplete",
        selected: false,
        concept: "Menguji pembagian pertumbuhan mengikuti arahan pola ruang provinsi pada area di luar prioritas ekosistem dan status kehutanan.",
        evaluation: "Tidak dipilih pada v0.2 karena penggunaan lahan, proyeksi penduduk, kapasitas layanan, bahaya, dan biaya penyediaan jaringan belum cukup untuk membuktikan keamanan pertumbuhan tersebar."
      },
      {
        id: "ALT-YG-1",
        label: "Perlindungan ekosistem, pengurangan risiko, dan konsolidasi pertumbuhan",
        status: "selected_provisional",
        selected: true,
        concept: "Menyaring lokasi dengan fungsi ekosistem, status hukum, dan risiko terlebih dahulu; memperkuat pusat serta jaringan yang aman; melindungi ruang hidup; dan mengikat keputusan pada aturan serta program yang dapat diawasi.",
        evaluation: "Dipilih sebagai dasar rancangan YG v0.2 karena paling sesuai dengan indikasi gambut, kawasan hutan, dan pesisir yang tersedia; wajib dimatangkan melalui 21 analisis, KLHS, RTRW kabupaten, data skala 1:5.000, dan partisipasi."
      }
    ],
    selectedAlternative: {
      id: "ALT-YG-1",
      status: "provisional",
      reviewTrigger: "Tinjau ulang setelah RTRW kabupaten, data skala 1:5.000, KLHS, 21 analisis, verifikasi lapangan, dan matriks tanggapan konsultasi tersedia."
    },
    developmentReadiness: {
      status: developmentReadiness.status || "not_available",
      prioritySummary: developmentReadiness.prioritySummary || [],
      promotionSummary: developmentReadiness.promotionSummary || [],
      evidenceLocks: developmentReadiness.evidenceLocks || [],
      disclaimer: developmentReadiness.disclaimer || "Belum tersedia."
    },
    structurePlan: {
      status: "analytical_reference_geometry_v0_1",
      disclaimer: geometryDisclaimer,
      referenceNodeCount: structureDraft.nodes?.features?.length || 0,
      referenceAxisCount: structureDraft.axes?.features?.length || 0,
      geometryRule: structureDraft.geometryRule || "Belum tersedia.",
      networkSystems: structureDraft.networkSystems || [],
      networkEvidenceStatus: networkEvidence.status || "not_available",
      roadEvidence: networkEvidence.roads?.metadata || null,
      roadClassSummary: networkEvidence.classSummary || [],
      villageRoadCoverage: networkEvidence.villageCoverage || [],
      evidenceGaps: networkEvidence.evidenceGaps || [],
      serviceHydrologyStatus: serviceEvidence.status || "not_available",
      facilityMetadata: serviceEvidence.facilities?.metadata || null,
      hydrologyMetadata: serviceEvidence.hydrology?.metadata || null,
      facilityCategories: serviceEvidence.facilityCategories || [],
      waterwayClasses: serviceEvidence.waterwayClasses || [],
      serviceHydrologyCoverage: serviceEvidence.villageCoverage || [],
      serviceAccessStatus: serviceAccess.status || "not_available",
      serviceAccessPrioritySummary: serviceAccess.prioritySummary || [],
      serviceAccessVillageMatrix: serviceAccess.villageMatrix || [],
      serviceAccessLimitation: serviceAccess.limitation || "Belum tersedia.",
      centres: [
        {
          id: "CTR-YG-1",
          role: "candidate_primary_service_centre",
          locationStatus: "not_delineated",
          direction: "Evaluasi inti pelayanan Bagansiapiapi eksisting sebagai pusat utama hanya setelah hierarki RTRW, kapasitas layanan, risiko, akses, dan kebutuhan ruang dianalisis."
        },
        {
          id: "CTR-YG-2",
          role: "candidate_local_service_centres",
          locationStatus: "not_delineated",
          direction: "Identifikasi pusat pelayanan lokal dari jangkauan penduduk, akses aman, layanan dasar, hubungan desa-kota, dan ketahanan bencana; jumlah serta lokasinya belum ditetapkan."
        },
        {
          id: "CTR-YG-3",
          role: "candidate_coastal_river_livelihood_nodes",
          locationStatus: "not_delineated",
          direction: "Identifikasi simpul penghidupan sungai-pesisir tanpa menutup akses publik atau mengurangi fungsi mangrove, sempadan, keselamatan, dan konektivitas pasang-surut."
        }
      ],
      networks: [
        {
          id: "NET-YG-1",
          role: "safe_mobility_and_evacuation_network",
          geometryStatus: "not_delineated",
          direction: "Hubungkan pusat, permukiman, fasilitas kritis, dermaga, dan lokasi evakuasi melalui jaringan yang teruji terhadap genangan, rob, serta gangguan darurat."
        },
        {
          id: "NET-YG-2",
          role: "blue_green_hydrology_network",
          geometryStatus: "not_delineated",
          direction: "Pertahankan aliran sungai, kanal yang perlu dikelola, drainase, retensi, konektivitas pasang-surut, mangrove, dan tata air gambut sebagai satu sistem; intervensi menunggu kajian hidrologi."
        },
        {
          id: "NET-YG-3",
          role: "basic_service_network",
          geometryStatus: "not_delineated",
          direction: "Rencanakan air minum, sanitasi, persampahan, energi, telekomunikasi, dan proteksi kebakaran berdasarkan gap layanan, kapasitas, risiko, serta biaya siklus hidup."
        }
      ]
    },
    patternPlan: {
      status: "provisional_internal_zone_geometry",
      disclaimer: geometryDisclaimer,
      zones: [
        {
          id: "ZONE-YG-PEAT",
          patternCategory: "protected_candidate",
          role: "candidate_peat_ecosystem_protection_or_management",
          geometryStatus: "provisional_internal_zone_geometry",
          ...zoneMetric(["peat_hydrology_management"]),
          direction: "Pisahkan perlindungan dan pengelolaan gambut berdasarkan KHG/fungsi resmi, kubah, kedalaman, hidrologi, kerusakan, risiko kebakaran, dan kebutuhan pemulihan; bukan dari persentase WP."
        },
        {
          id: "ZONE-YG-COAST",
          patternCategory: "protected_candidate",
          role: "candidate_coastal_mangrove_river_protection",
          geometryStatus: "provisional_internal_zone_geometry",
          ...zoneMetric(["coastal_mangrove_protection"]),
          direction: "Lindungi mangrove, sempadan pantai/sungai/muara, aliran pasang-surut, area abrasi-rob, akses masyarakat, serta ruang perikanan berdasarkan kajian lokasi."
        },
        {
          id: "ZONE-YG-FOREST",
          patternCategory: "protected_candidate",
          role: "candidate_forest_status_alignment",
          geometryStatus: "provisional_internal_zone_geometry",
          ...zoneMetric(["forest_status_alignment"]),
          direction: "Pertahankan keterbacaan status/fungsi kawasan hutan dan jangan menganggap zonasi RDTR mengubah status, fungsi, atau kewenangan kehutanan."
        },
        {
          id: "ZONE-YG-URBAN",
          patternCategory: "cultivation_candidate",
          role: "candidate_safe_urban_consolidation",
          geometryStatus: "provisional_internal_zone_geometry",
          ...zoneMetric(["safe_urban_consolidation"]),
          direction: "Arahkan hunian, pelayanan, dan kegiatan perkotaan ke kawasan terbangun yang terbukti sesuai, aman, dapat dilayani, serta tidak memperbesar beban hidrologi dan risiko."
        },
        {
          id: "ZONE-YG-LIVELIHOOD",
          patternCategory: "cultivation_candidate",
          role: "candidate_community_livelihood_and_production",
          geometryStatus: "provisional_internal_zone_geometry",
          ...zoneMetric(["community_livelihood_and_production"]),
          direction: "Akui penghidupan lokal, perikanan, produksi yang sesuai, wilayah kelola, dan akses masyarakat dengan syarat lingkungan, tenurial, serta keselamatan yang dapat diawasi."
        },
        {
          id: "ZONE-YG-VERIFY",
          patternCategory: "verification_candidate",
          role: "candidate_function_pending_verification",
          geometryStatus: "provisional_internal_zone_geometry",
          ...zoneMetric(["function_pending_verification", "higher_plan_protection_alignment"]),
          direction: "Pertahankan sebagai ruang verifikasi sampai fungsi rinci, penggunaan lahan, kebutuhan, layanan, risiko, dan hierarki rencana dapat dibuktikan."
        }
      ]
    },
    zoningRules: {
      status: "candidate_itbx_v0_1_pending_validation",
      codebookVersion: zoningCodebook.version || "0.1.0-internal",
      classificationRule: zoningCodebook.classificationRule || "ITBX kandidat belum tersedia.",
      activityCatalog: zoningCodebook.activityCatalog || [],
      subzoneCandidates: zoningCodebook.subzoneCandidates || [],
      itbxMatrix: zoningCodebook.itbxMatrix || [],
      specialProvisions: zoningCodebook.specialProvisions || [],
      intensityEnvelopes: zoningCodebook.intensityEnvelopes || [],
      numericIntensityStatus: "not_set_pending_evidence",
      numericIntensityParameters: {
        kdb: null,
        klb: null,
        kdh: null,
        buildingHeight: null,
        density: null,
        setbackDistance: null
      },
      rules: [
        {
          id: "ZR-YG-1",
          scope: "candidate_ecosystem_and_hazard_areas",
          direction: "Kegiatan yang mengeringkan gambut, memutus konektivitas pasang-surut, menghilangkan mangrove, mempersempit aliran, atau menambah risiko tidak dapat diasumsikan sesuai; klasifikasi kegiatan rinci menunggu subzona dan analisis pendukung."
        },
        {
          id: "ZR-YG-2",
          scope: "candidate_development_areas",
          direction: "Kegiatan baru harus membuktikan kesesuaian hierarki, status lahan/kawasan hutan, kapasitas layanan, pengelolaan air, keselamatan, akses, dan dampak kumulatif sebelum parameter intensitas ditetapkan."
        },
        {
          id: "ZR-YG-3",
          scope: "all_candidate_zones",
          direction: "Ketentuan kegiatan, intensitas, prasarana minimum, ketentuan khusus, variansi, insentif/disinsentif, dan pengawasan harus memiliki indikator, data, penanggung jawab, serta mekanisme evaluasi."
        },
        {
          id: "ZR-YG-RISK",
          scope: "risk_management_special_provision",
          direction: "Terapkan calon ketentuan khusus/overlay pengendalian untuk rob, banjir, abrasi, kebakaran, subsidensi, dan kapasitas evakuasi. Ini bukan zona pola ruang; batas dan tingkatannya menunggu pemodelan terotorisasi."
        }
      ]
    },
    programs: {
      id: "RDTR-YG-PROGRAMME-PORTFOLIO-V0.1",
      version: "0.1.0-internal",
      status: "candidate_programme_portfolio_pending_authority_budget_and_location_validation",
      phasingStatus: "relative_sequence_only_pending_plan_horizon_and_fiscal_analysis",
      implementationRule: "Program hanya dapat dipromosikan setelah lokasi, kewenangan, keluaran, indikator, baseline, target, biaya, sumber pembiayaan, pelaksana, risiko, serta mekanisme pemantauan disepakati dan dapat ditelusuri ke zona serta analisis.",
      indicatorRule: "Nilai baseline dan target tidak diisi dengan asumsi; keduanya tetap null sampai data resmi atau hasil survei tervalidasi.",
      items: [
        {
          id: "PRG-YG-1",
          title: "Penyelesaian dasar hukum, data, dan peta skala RDTR",
          status: "candidate_precondition",
          priority: "P0", relativePhase: "precondition", spatialStatus: "whole_planning_area_location_pending",
          direction: "Peroleh RTRW kabupaten, peta dasar rekomendasi BIG, basis data 1:5.000, metadata, dan audit topologi; gunakan seluruhnya untuk mematangkan geometri zona YG v0.2.",
          linkedZoneCodes: zoneCodes([...new Set(zoneFeatures.map(feature => feature.properties?.zoneFamily).filter(Boolean))]),
          analysisRefs: ["A24-k", "A24-l", "A24-m", "A24-t"], regulationRefs: ["R02", "R03", "R04", "R15", "L02"],
          candidateLeadRole: "Pemerintah kabupaten bersama perangkat daerah penataan ruang dan simpul jaringan informasi geospasial; penetapan nama instansi menunggu verifikasi kewenangan.",
          financingStatus: "not_costed_not_committed",
          indicators: [
            { name: "Persentase wilayah dengan peta dasar tervalidasi skala 1:5.000", unit: "percent", baseline: null, target: null },
            { name: "Jumlah zona lulus audit topologi dan atribut", unit: "zone", baseline: null, target: null }
          ]
        },
        {
          id: "PRG-YG-2",
          title: "KLHS, hidrologi gambut, dan pengurangan risiko terpadu",
          status: "candidate_precondition",
          priority: "P0", relativePhase: "precondition", spatialStatus: "zone_and_hydrological_unit_location_pending",
          direction: "Selesaikan KLHS, fungsi KHG, tata air, subsidensi, kebakaran, rob, banjir, abrasi, skenario iklim, serta pilihan perlindungan/pemulihan.",
          linkedZoneCodes: zoneCodes(["peat_hydrology_management", "coastal_mangrove_protection", "safe_urban_consolidation"]),
          analysisRefs: ["A24-d", "A24-p", "A24-s", "A24-t"], regulationRefs: ["R05", "R09", "R10", "R11", "R12"],
          candidateLeadRole: "Perangkat daerah lingkungan hidup, kebencanaan, pekerjaan umum, dan penataan ruang bersama instansi sektoral; kewenangan final belum ditetapkan.",
          financingStatus: "not_costed_not_committed",
          indicators: [
            { name: "Zona yang memiliki skenario multi-bahaya dan arahan pengendalian", unit: "zone", baseline: null, target: null },
            { name: "Rekomendasi KLHS yang terlacak ke geometri, aturan, atau program", unit: "recommendation", baseline: null, target: null }
          ]
        },
        {
          id: "PRG-YG-3",
          title: "Perlindungan pesisir, mangrove, sungai, dan akses masyarakat",
          status: "candidate_program",
          priority: "P1", relativePhase: "phase_1_after_preconditions", spatialStatus: "candidate_zone_not_project_site",
          direction: "Lengkapi kajian hidro-oseanografi dan sosial-tenurial, lindungi konektivitas, pulihkan lokasi prioritas, dan jaga ruang tangkap, tambat, serta akses publik.",
          linkedZoneCodes: zoneCodes(["coastal_mangrove_protection", "higher_plan_protection_alignment"]),
          analysisRefs: ["A24-d", "A24-e", "A24-g", "A24-n", "A24-s"], regulationRefs: ["R05", "R10", "R12", "R13"],
          candidateLeadRole: "Perangkat daerah pesisir, lingkungan hidup, perikanan, dan desa bersama masyarakat; lokasi dan pembagian kewenangan menunggu kajian.",
          financingStatus: "not_costed_not_committed",
          indicators: [
            { name: "Panjang/luas ekosistem dan akses pesisir dengan kondisi awal tervalidasi", unit: "mixed_pending_design", baseline: null, target: null },
            { name: "Lokasi prioritas dengan persetujuan masyarakat dan rencana pemeliharaan", unit: "site", baseline: null, target: null }
          ]
        },
        {
          id: "PRG-YG-4",
          title: "Layanan dasar, drainase, mobilitas aman, dan evakuasi",
          status: "candidate_program",
          priority: "P1", relativePhase: "phase_1_after_preconditions", spatialStatus: "service_gap_location_not_determined",
          direction: "Prioritaskan gap layanan dan fasilitas kritis berdasarkan kebutuhan, eksposur, kelompok rentan, kapasitas, operasi-pemeliharaan, dan kelayakan pembiayaan.",
          linkedZoneCodes: zoneCodes(["safe_urban_consolidation", "community_livelihood_and_production", "function_pending_verification"]),
          analysisRefs: ["A24-a", "A24-h", "A24-i", "A24-j", "A24-q"], regulationRefs: ["R02", "R03", "R08", "R10"],
          candidateLeadRole: "Perangkat daerah pelayanan dasar, pekerjaan umum, perhubungan, kebencanaan, dan penyedia layanan; belum menjadi penugasan.",
          financingStatus: "not_costed_not_committed",
          indicators: [
            { name: "Penduduk dengan akses layanan sesuai standar dan waktu tempuh", unit: "people_or_percent_pending_standard", baseline: null, target: null },
            { name: "Fasilitas kritis dengan akses aman dan rencana kontinuitas", unit: "facility", baseline: null, target: null }
          ]
        },
        {
          id: "PRG-YG-5",
          title: "Pemetaan partisipatif, tenurial, dan penghidupan",
          status: "candidate_precondition_and_continuous",
          priority: "P0", relativePhase: "precondition_and_continuous", spatialStatus: "participatory_locations_pending_consent",
          direction: "Dokumentasikan hak/persetujuan, perhutanan sosial, ruang hidup, ekonomi lokal, konflik, kebutuhan transisi, dan respons terhadap masukan secara aman serta terpilah.",
          linkedZoneCodes: zoneCodes([...new Set(zoneFeatures.map(feature => feature.properties?.zoneFamily).filter(Boolean))]),
          analysisRefs: ["A24-e", "A24-g", "A24-n", "A24-u"], regulationRefs: ["R01", "R06", "R07", "R09", "R13", "R14"],
          candidateLeadRole: "Pemerintah kabupaten dan desa bersama pemegang hak, kelompok masyarakat, perempuan, pemuda, nelayan, dan kelompok rentan; fasilitator belum ditetapkan.",
          financingStatus: "not_costed_not_committed",
          indicators: [
            { name: "Masukan dengan ID, lokasi, respons, dan jejak perubahan", unit: "submission", baseline: null, target: null },
            { name: "Konflik/akses penting dengan status verifikasi dan tindak lanjut", unit: "case", baseline: null, target: null }
          ]
        },
        {
          id: "PRG-YG-6",
          title: "Sistem pengendalian, pemantauan, dan evaluasi",
          status: "candidate_continuous_program",
          priority: "P1", relativePhase: "continuous_after_legal_adoption", spatialStatus: "whole_planning_area_system",
          direction: "Bangun indikator, wali data, inspeksi, pengaduan, pembaruan data, evaluasi berkala, dan tindakan korektif yang terhubung ke aturan zonasi.",
          linkedZoneCodes: zoneCodes([...new Set(zoneFeatures.map(feature => feature.properties?.zoneFamily).filter(Boolean))]),
          analysisRefs: ["A24-k", "A24-l", "A24-m", "A24-o", "A24-t", "A24-u"], regulationRefs: ["R02", "R04", "R07", "R08", "R15"],
          candidateLeadRole: "Pemerintah kabupaten melalui tata kelola lintas perangkat daerah dan wali data; struktur organisasi belum ditetapkan.",
          financingStatus: "not_costed_not_committed",
          indicators: [
            { name: "Indikator RDTR dengan wali data dan frekuensi pembaruan", unit: "indicator", baseline: null, target: null },
            { name: "Temuan pengendalian yang ditutup dengan tindakan korektif", unit: "percent", baseline: null, target: null }
          ]
        },
        {
          id: "PRG-YG-7",
          title: "Konsolidasi kawasan terbangun dan peningkatan kualitas permukiman",
          status: "candidate_program_pending_suitability",
          priority: "P2", relativePhase: "phase_2_after_safety_and_capacity_proof", spatialStatus: "cultivation_candidate_not_investment_location",
          direction: "Konsolidasikan kebutuhan hunian dan kegiatan perkotaan pada area yang telah terbukti aman, sesuai, dapat dilayani, serta tidak memperbesar risiko atau beban hidrologi.",
          linkedZoneCodes: zoneCodes(["safe_urban_consolidation"]),
          analysisRefs: ["A24-a", "A24-b", "A24-c", "A24-q", "A24-r", "A24-s"], regulationRefs: ["R01", "R02", "R03", "R05", "R08"],
          candidateLeadRole: "Perangkat daerah perumahan, permukiman, pekerjaan umum, pelayanan dasar, dan penataan ruang; bukan komitmen proyek.",
          financingStatus: "not_costed_not_committed",
          indicators: [
            { name: "Kawasan terbangun yang lulus uji bahaya, daya dukung, dan kapasitas layanan", unit: "hectare", baseline: null, target: null },
            { name: "Rumah tangga penerima peningkatan kualitas tanpa relokasi paksa", unit: "household", baseline: null, target: null }
          ]
        },
        {
          id: "PRG-YG-8",
          title: "Penguatan ekonomi lokal dan ruang penghidupan tahan risiko",
          status: "candidate_program_pending_livelihood_assessment",
          priority: "P2", relativePhase: "phase_2_after_rights_and_risk_verification", spatialStatus: "livelihood_candidate_not_project_location",
          direction: "Perkuat perikanan, usaha lokal, produksi, pasar, dan konektivitas yang sesuai tanpa mengurangi fungsi ekosistem, keselamatan, hak, atau akses masyarakat.",
          linkedZoneCodes: zoneCodes(["community_livelihood_and_production", "coastal_mangrove_protection"]),
          analysisRefs: ["A24-c", "A24-e", "A24-g", "A24-n", "A24-r"], regulationRefs: ["R01", "R03", "R05", "R10", "R13"],
          candidateLeadRole: "Perangkat daerah ekonomi, perikanan, koperasi/UMKM, desa, dan kelompok pelaku usaha; desain serta penerima manfaat belum ditetapkan.",
          financingStatus: "not_costed_not_committed",
          indicators: [
            { name: "Kelompok penghidupan dengan akses ruang dan rantai nilai tervalidasi", unit: "group", baseline: null, target: null },
            { name: "Kegiatan ekonomi yang memenuhi syarat lingkungan dan keselamatan", unit: "activity", baseline: null, target: null }
          ]
        }
      ],
      disclaimer: "Portofolio indikatif internal untuk menguji keterlaksanaan RDTR YG; bukan daftar proyek pemerintah, penugasan instansi, komitmen anggaran, lokasi investasi, atau dasar pengadaan tanah."
    },
    traceability: [
      {
        id: "TR-YG-OBJ",
        planComponentRef: "OBJ-YG-1",
        analysisRefs: ["A24-a", "A24-c", "A24-d", "A24-e", "A24-g", "A24-s"],
        regulationRefs: ["R01", "R02", "R03", "R05", "R09", "R10", "R11", "R12", "R13", "R14"],
        evidenceStatus: "partial",
        decision: "Tujuan dipertahankan sebagai rumusan sementara dan wajib diberi indikator setelah 21 analisis serta KLHS selesai."
      },
      {
        id: "TR-YG-STRUCTURE",
        planComponentRef: "structurePlan",
        analysisRefs: ["A24-a", "A24-c", "A24-f", "A24-h", "A24-i", "A24-j", "A24-q"],
        regulationRefs: ["R02", "R03", "R04", "R10", "R15", "L02"],
        evidenceStatus: "insufficient_for_geometry",
        decision: "Pusat dan jaringan tetap sebagai konsep tanpa geometri sampai hierarki, kebutuhan, kapasitas, keselamatan, serta peta skala 1:5.000 teruji."
      },
      {
        id: "TR-YG-PATTERN",
        planComponentRef: "patternPlan",
        analysisRefs: ["A24-b", "A24-d", "A24-m", "A24-n", "A24-o", "A24-p", "A24-s", "A24-t", "A24-u"],
        regulationRefs: ["R03", "R04", "R05", "R09", "R10", "R11", "R12", "R13", "R14", "R15"],
        evidenceStatus: "partial_high_priority",
        decision: "Geometri zona internal v0.2 telah dibentuk tanpa tumpang tindih; batas dan nomenklatur harus dimatangkan dengan data skala 1:5.000, analisis, KLHS, serta validasi lintas sektor dan masyarakat."
      },
      {
        id: "TR-YG-ZONING",
        planComponentRef: "zoningRules",
        analysisRefs: ["A24-m", "A24-n", "A24-o", "A24-p", "A24-q", "A24-r", "A24-t", "A24-u"],
        regulationRefs: ["R02", "R03", "R07", "R08"],
        evidenceStatus: "framework_only",
        decision: "Belum menetapkan angka intensitas atau klasifikasi kegiatan final; seluruh parameter menunggu kajian kapasitas, risiko, karakter zona, dan pengendalian."
      },
      {
        id: "TR-YG-PROGRAMS",
        planComponentRef: "programs",
        analysisRefs: ["A24-g", "A24-h", "A24-i", "A24-k", "A24-l", "A24-p", "A24-r", "A24-u"],
        regulationRefs: ["R02", "R03", "R05", "R07", "R08", "R10"],
        evidenceStatus: "candidate_only",
        decision: "Program belum menjadi komitmen anggaran atau jadwal; penahapan menunggu prioritas rencana, kewenangan, kelayakan, dan sumber pembiayaan."
      }
    ]
  };
}

function planningUnitScreeningPriority(metrics) {
  const decisions = new Set(metrics.regulatoryAssessments.map(row => row.decision));
  if (decisions.has("hold")) return "high";
  if (decisions.has("verify") || decisions.has("conditional")) return "medium";
  return "review";
}

function planningUnitDirection(metrics) {
  const directions = [];
  if (metrics.peatCoveragePct > 0) directions.push("uji fungsi dan hidrologi gambut");
  if (metrics.forestCoveragePct > 0) directions.push("selaraskan status dan fungsi kawasan hutan");
  if (metrics.mangrove.status === "analysed") directions.push("lindungi mangrove dan konektivitas pasang-surut");
  else directions.push("lengkapi kajian pesisir, mangrove, dan risiko");
  directions.push("matangkan arah ruang YG setelah uji RTRW kabupaten, KLHS, data skala 1:5.000, kebutuhan layanan, dan verifikasi lapangan");
  return directions.join("; ");
}

function planningUnitConstraintProfile(metrics) {
  const flags = [];
  if (metrics.peatCoveragePct >= 70) flags.push("dominasi indikasi gambut");
  else if (metrics.peatCoveragePct > 0) flags.push("irisan indikasi gambut");
  if (metrics.forestCoveragePct >= 40) flags.push("irisan indikasi non-APL tinggi");
  else if (metrics.forestCoveragePct > 0) flags.push("irisan indikasi non-APL");
  if (metrics.mangrove.status === "analysed" && metrics.mangrove.indicativeMangroveLossHa > 25) flags.push("kehilangan mangrove indikatif tinggi");
  if (metrics.mangrove.status !== "analysed") flags.push("bukti mangrove/pesisir belum lengkap");
  const high = metrics.peatCoveragePct >= 70 || metrics.forestCoveragePct >= 40 ||
    (metrics.mangrove.status === "analysed" && metrics.mangrove.indicativeMangroveLossHa > 25);
  return {
    knownConstraintBand: high ? "high" : flags.length > 1 ? "moderate" : "evidence_gap",
    knownConstraintBasis: flags.join("; ") || "belum ada kendala terpetakan pada layer yang tersedia",
    unresolvedRisk: "rob, banjir, abrasi, subsidensi, kebakaran, elevasi, hidrologi, dan kapasitas evakuasi belum dimodelkan lengkap",
    developmentSuitabilityStatus: "not_determined_pending_p0_analysis",
    interpretation: "Kelas kendala adalah hasil overlay penyaringan, bukan kelas kesesuaian lahan, zona, atau keputusan boleh/tidak boleh."
  };
}

function buildYgPlanningUnits(villages, villageMetrics) {
  const metricsByName = new Map(villageMetrics.map(row => [normalize(row.name), row]));
  const disclaimer = "Unit penyaringan analitis berbasis batas administrasi; bukan batas WP, SWP, blok, subblok, zona, atau keputusan kesesuaian ruang. Prioritas berlaku untuk verifikasi unit kajian, bukan vonis atas seluruh poligon atau setiap kegiatan di dalamnya.";
  const collection = featureCollection(villages.map(village => {
    const name = village.properties?.WADMKD || village.properties?.NAMOBJ;
    const metrics = metricsByName.get(normalize(name));
    const constraint = planningUnitConstraintProfile(metrics);
    const display = simplify(village, {
      tolerance: 0.00002,
      highQuality: false,
      mutate: false
    });
    display.properties = {
      id: metrics.id,
      name: metrics.name,
      screeningPriority: planningUnitScreeningPriority(metrics),
      direction: planningUnitDirection(metrics),
      knownConstraintBand: constraint.knownConstraintBand,
      knownConstraintBasis: constraint.knownConstraintBasis,
      unresolvedRisk: constraint.unresolvedRisk,
      developmentSuitabilityStatus: constraint.developmentSuitabilityStatus,
      screeningInterpretation: constraint.interpretation,
      role: "analytical_unit_not_swp_or_zone",
      evidenceClass: "EV-I",
      geometryStatus: "analytical_simplified_administrative_input",
      sourceAuthority: "Yayasan Gambut; turunan Batas administrasi desa Riau — Hasil Delineasi Tahun 2018",
      sourceDate: "2018",
      legalCutoff: "2026-09-20",
      simplificationToleranceDegrees: 0.00002,
      disclaimer
    };
    return display;
  }));
  collection.name = "Unit penyaringan analitis RDTR Bagansiapiapi versi YG";
  collection.metadata = {
    access: "staff_only",
    status: "analytical_screening_geometry",
    role: "analytical_unit_not_swp_or_zone",
    evidenceClass: "EV-I",
    sourceAuthority: "Yayasan Gambut; geometri sumber Batas administrasi desa Riau — Hasil Delineasi Tahun 2018",
    sourceDate: "2018",
    generatedAt: new Date().toISOString(),
    legalCutoff: "2026-09-20",
    geometryProcessing: "Simplifikasi Turf, tolerance 0.00002 derajat, highQuality false; tidak untuk pengukuran legal.",
    disclaimer
  };
  return collection;
}

function buildYgStructureDraft(villages, villageMetrics) {
  const metricsByName = new Map(villageMetrics.map(row => [normalize(row.name), row]));
  const primaryName = "bagan kota";
  const coastalNames = new Set(["bagan jawa pesisir", "bagan punak pesisir"]);
  const nodeFeatures = villages.map((village, index) => {
    const sourceName = village.properties?.WADMKD || village.properties?.NAMOBJ || `Wilayah ${index + 1}`;
    const key = normalize(sourceName);
    const metrics = metricsByName.get(key);
    const node = pointOnFeature(village);
    const role = key === primaryName
      ? "primary_service_centre_study_reference"
      : coastalNames.has(key)
        ? "coastal_livelihood_and_evacuation_study_reference"
        : "local_service_centre_study_reference";
    node.properties = {
      id: `STR-NODE-${String(index + 1).padStart(2, "0")}`,
      villageId: metrics?.id || "",
      name: metrics?.name || sourceName,
      role,
      hierarchy: key === primaryName ? "primary_reference" : "local_reference",
      screeningPriority: metrics ? planningUnitScreeningPriority(metrics) : "review",
      geometryStatus: "analytical_point_on_administrative_polygon_not_facility_location",
      purpose: key === primaryName
        ? "Titik referensi untuk menguji pusat pelayanan utama Bagansiapiapi, jangkauan layanan, kapasitas, keselamatan, dan hubungan antarpusat."
        : coastalNames.has(key)
          ? "Titik referensi untuk menguji layanan pesisir, penghidupan, tambatan, akses publik, dan evakuasi tanpa menetapkan lokasi fasilitas."
          : "Titik referensi untuk menguji kebutuhan pusat pelayanan lokal, jangkauan layanan dasar, akses aman, dan evakuasi.",
      requiredEvidence: "Inventaris fasilitas dan kapasitas; jaringan jalan/perairan; waktu tempuh; penduduk; bahaya; lahan; akses kelompok rentan; survei koordinat skala 1:5.000.",
      legalEffect: "none"
    };
    return node;
  });
  const primary = nodeFeatures.find(feature => normalize(feature.properties?.name) === primaryName);
  if (!primary) throw new Error("Bagan Kota tidak ditemukan untuk referensi struktur ruang YG");
  const axisFeatures = nodeFeatures.filter(feature => feature !== primary).map((destination, index) => {
    const coastal = destination.properties.role === "coastal_livelihood_and_evacuation_study_reference";
    return lineString([primary.geometry.coordinates, destination.geometry.coordinates], {
      id: `STR-AXIS-${String(index + 1).padStart(2, "0")}`,
      fromNodeId: primary.properties.id,
      fromName: primary.properties.name,
      toNodeId: destination.properties.id,
      toName: destination.properties.name,
      role: coastal ? "coastal_access_and_evacuation_study_axis" : "service_and_evacuation_study_axis",
      geometryStatus: "straight_line_connectivity_test_not_transport_route",
      purpose: coastal
        ? "Menguji kebutuhan konektivitas pusat–pesisir, layanan perairan, logistik masyarakat, serta evakuasi multi-moda."
        : "Menguji hubungan pusat–wilayah, jangkauan layanan, redundansi akses, dan kebutuhan evakuasi.",
      routingRequirements: "Jangan ditafsirkan sebagai trase. Rute harus dibentuk dari jaringan eksisting terverifikasi, kondisi jembatan, hak jalan, elevasi/genangan, keselamatan, biaya, dan dampak lingkungan-sosial.",
      legalEffect: "none"
    });
  });
  const disclaimer = "Titik dibuat dengan point-on-feature pada batas administrasi dan garis adalah hubungan lurus analitis. Keduanya bukan lokasi fasilitas, bukan trase jalan/drainase/utilitas, bukan usulan pembebasan lahan, dan bukan dasar KKPR.";
  const nodes = featureCollection(nodeFeatures);
  nodes.name = "Simpul referensi analitis struktur ruang RDTR YG v0.4";
  nodes.metadata = {
    access: "staff_only",
    status: "analytical_reference_points",
    version: "0.1.0-internal",
    primaryNodeId: primary.properties.id,
    featureCount: nodeFeatures.length,
    disclaimer
  };
  const axes = featureCollection(axisFeatures);
  axes.name = "Sumbu konektivitas analitis struktur ruang RDTR YG v0.4";
  axes.metadata = {
    access: "staff_only",
    status: "analytical_straight_line_relationships",
    version: "0.1.0-internal",
    featureCount: axisFeatures.length,
    disclaimer
  };
  return {
    id: "RDTR-YG-BAGANSIAPIAPI-STRUCTURE-V0.1",
    version: "0.1.0-internal",
    status: "analytical_reference_geometry",
    geometryRule: "Simpul memakai titik-dalam-poligon administrasi sebagai referensi kebutuhan; sumbu menghubungkan referensi utama Bagan Kota ke referensi lokal untuk menguji hubungan, bukan menggambar trase.",
    nodes,
    axes,
    networkSystems: [
      { id: "SYS-YG-01", name: "Mobilitas aman dan evakuasi", status: "routing_pending", evidence: "Jalan/perairan eksisting, kelas dan kondisi, jembatan, waktu tempuh, genangan, fasilitas kritis, titik evakuasi." },
      { id: "SYS-YG-02", name: "Jaringan biru–hijau dan drainase", status: "geometry_pending", evidence: "Sungai, drainase, kanal, pasut, elevasi, retensi, pintu air, KHG, subsidensi, dan skenario iklim." },
      { id: "SYS-YG-03", name: "Air minum dan sanitasi", status: "capacity_pending", evidence: "Sumber, jaringan, cakupan, kualitas, kapasitas, gap layanan, sistem setempat, dan risiko kontaminasi." },
      { id: "SYS-YG-04", name: "Persampahan dan limbah", status: "capacity_pending", evidence: "Timbulan, pengumpulan, fasilitas, rute, kapasitas, penerima dampak, dan perlindungan air/pesisir." },
      { id: "SYS-YG-05", name: "Energi, telekomunikasi, dan proteksi kebakaran", status: "resilience_pending", evidence: "Cakupan, kapasitas, redundansi, gangguan, akses pemadam, sumber air, dan fasilitas vital." }
    ],
    disclaimer
  };
}

function buildYgNetworkEvidence({ roads, studyArea, villages }) {
  const sourceRoads = roads?.features || [];
  const selected = sourceRoads.filter(feature => {
    if (!feature?.geometry || !["LineString", "MultiLineString"].includes(feature.geometry.type)) return false;
    try {
      return booleanIntersects(feature, studyArea);
    } catch {
      return false;
    }
  }).map(feature => {
    const display = simplify(feature, { tolerance: 0.00001, highQuality: false, mutate: false });
    const props = feature.properties || {};
    display.properties = {
      id: `OSM-ROAD-${props.osmId || "UNKNOWN"}`,
      osmId: props.osmId || null,
      name: props.name || "Jalan tanpa nama pada OSM",
      highwayClass: props.highway || "unknown",
      source: roads.source || "OpenStreetMap contributors via Overpass",
      evidenceStatus: "open_data_screening_not_official_road_network",
      geometryStatus: "source_line_intersecting_study_area_not_boundary_clipped",
      lengthKm: round(turfLength(feature, { units: "kilometers" }), 3),
      permittedUse: "Penyaringan keterhubungan, kepadatan indikatif, prioritas verifikasi, dan pencocokan lapangan.",
      limitation: "Nama, kelas, kelengkapan, kondisi, kewenangan, lebar, hak jalan, jembatan, dan keterhubungan harus diverifikasi; bukan dasar penetapan struktur ruang atau rute evakuasi.",
      legalEffect: "none"
    };
    return display;
  });
  const classes = [...new Set(selected.map(feature => feature.properties.highwayClass))].sort();
  const classSummary = classes.map(highwayClass => {
    const features = selected.filter(feature => feature.properties.highwayClass === highwayClass);
    return {
      highwayClass,
      featureCount: features.length,
      lengthKm: round(features.reduce((sum, feature) => sum + feature.properties.lengthKm, 0), 2)
    };
  }).sort((a, b) => b.lengthKm - a.lengthKm);
  const villageCoverage = villages.map(village => {
    const name = village.properties?.WADMKD || village.properties?.NAMOBJ || "Wilayah";
    const intersecting = selected.filter(feature => {
      try { return booleanIntersects(feature, village); } catch { return false; }
    });
    return {
      village: name,
      roadFeatureCount: intersecting.length,
      namedRoadFeatureCount: intersecting.filter(feature => feature.properties.name !== "Jalan tanpa nama pada OSM").length,
      status: intersecting.length ? "open_data_present_needs_verification" : "no_road_geometry_found_needs_field_check"
    };
  });
  const collection = featureCollection(selected);
  collection.name = "Bukti jaringan jalan terbuka untuk analisis RDTR YG v0.5";
  collection.metadata = {
    access: "staff_only",
    status: "open_data_screening_not_official_network",
    source: roads?.source || "OpenStreetMap contributors via Overpass",
    sourceFeatureCount: sourceRoads.length,
    selectedFeatureCount: selected.length,
    namedFeatureCount: selected.filter(feature => feature.properties.name !== "Jalan tanpa nama pada OSM").length,
    totalLengthKm: round(selected.reduce((sum, feature) => sum + feature.properties.lengthKm, 0), 2),
    geometryProcessing: "Filter boolean-intersects terhadap wilayah kajian; simplifikasi 0.00001 derajat; garis yang melintas batas tidak dipotong.",
    disclaimer: "Data OSM untuk penyaringan internal; bukan jaringan jalan resmi, bukan penetapan fungsi/kelas/kewenangan, dan bukan rute evakuasi."
  };
  return {
    id: "RDTR-YG-NETWORK-EVIDENCE-V0.1",
    version: "0.1.0-internal",
    status: selected.length ? "partial_open_road_evidence" : "road_evidence_missing",
    roads: collection,
    classSummary,
    villageCoverage,
    evidenceGaps: [
      { id: "NET-GAP-01", dataset: "Jaringan jalan resmi", status: "not_received", requirement: "Ruas, kelas/status/kewenangan, lebar/RUMIJA, kondisi, jembatan, pembatasan kendaraan, rencana peningkatan, metadata dan tanggal." },
      { id: "NET-GAP-02", dataset: "Sungai, kanal, drainase, retensi, pintu air dan pasut", status: "not_received", requirement: "Geometri, dimensi, arah aliran, kapasitas, kondisi, operasi, genangan, pasut, elevasi dan penanggung jawab." },
      { id: "NET-GAP-03", dataset: "Fasilitas umum dan sosial", status: "not_received", requirement: "Koordinat, jenis, hierarki, kapasitas, kondisi, cakupan pelayanan, aksesibilitas, risiko dan kebutuhan pengembangan." },
      { id: "NET-GAP-04", dataset: "Pelabuhan, dermaga, tambatan dan jaringan perairan", status: "not_received", requirement: "Lokasi, status, fungsi, pengguna, kapasitas, alur, keselamatan, pasut, sedimentasi dan akses masyarakat." },
      { id: "NET-GAP-05", dataset: "Air minum, sanitasi, persampahan, energi dan telekomunikasi", status: "not_received", requirement: "Jaringan/fasilitas, kapasitas, cakupan, gap, kualitas, redundansi, risiko, O&M dan rencana investasi." },
      { id: "NET-GAP-06", dataset: "Bahaya dan evakuasi", status: "not_received", requirement: "Rob, banjir, abrasi, kebakaran, subsidensi, skenario iklim, populasi terpapar, fasilitas kritis, titik/ruang evakuasi dan waktu tempuh." }
    ],
    disclaimer: collection.metadata.disclaimer
  };
}

function buildYgFacilityHydrologyEvidence({ facilities, hydrology, studyArea, villages }) {
  function inside(feature) {
    if (!feature?.geometry) return false;
    try { return booleanIntersects(feature, studyArea); } catch { return false; }
  }
  const facilityFeatures = (facilities?.features || []).filter(inside).map(feature => ({
    ...feature,
    properties: {
      ...(feature.properties || {}),
      evidenceStatus: "open_data_screening_needs_verification",
      legalEffect: "none"
    }
  }));
  const hydrologyFeatures = (hydrology?.features || []).filter(inside).map(feature => {
    const display = simplify(feature, { tolerance: 0.00001, highQuality: false, mutate: false });
    display.properties = {
      ...(feature.properties || {}),
      lengthKm: round(turfLength(feature, { units: "kilometers" }), 3),
      evidenceStatus: "open_data_screening_needs_hydrological_verification",
      legalEffect: "none"
    };
    return display;
  });
  const facilityCategories = [...new Set(facilityFeatures.map(feature => feature.properties.category || "other_public"))].sort().map(category => ({
    category,
    featureCount: facilityFeatures.filter(feature => (feature.properties.category || "other_public") === category).length,
    criticalCount: facilityFeatures.filter(feature => (feature.properties.category || "other_public") === category && feature.properties.critical).length
  }));
  const waterwayClasses = [...new Set(hydrologyFeatures.map(feature => feature.properties.waterway || feature.properties.water || "unclassified"))].sort().map(waterwayClass => {
    const selected = hydrologyFeatures.filter(feature => (feature.properties.waterway || feature.properties.water || "unclassified") === waterwayClass);
    return { waterwayClass, featureCount: selected.length, lengthKm: round(selected.reduce((sum, feature) => sum + feature.properties.lengthKm, 0), 2) };
  });
  const villageCoverage = villages.map(village => {
    const name = village.properties?.WADMKD || village.properties?.NAMOBJ || "Wilayah";
    const facilityCount = facilityFeatures.filter(feature => { try { return booleanIntersects(feature, village); } catch { return false; } }).length;
    const hydrologyCount = hydrologyFeatures.filter(feature => { try { return booleanIntersects(feature, village); } catch { return false; } }).length;
    return { village: name, facilityCount, hydrologyFeatureCount: hydrologyCount, status: facilityCount || hydrologyCount ? "partial_open_evidence" : "no_open_geometry_found_needs_verification" };
  });
  const facilityCollection = featureCollection(facilityFeatures);
  facilityCollection.name = facilities?.name || "Fasilitas OSM untuk analisis RDTR YG";
  facilityCollection.metadata = {
    ...(facilities?.metadata || {}), access: "staff_only", status: facilityFeatures.length ? "partial_open_facility_evidence" : "not_available",
    featureCount: facilityFeatures.length, criticalCount: facilityFeatures.filter(feature => feature.properties.critical).length,
    disclaimer: "Lokasi OSM untuk penyaringan internal; jenis, nama, status, kapasitas, kondisi, cakupan pelayanan dan kewenangan wajib diverifikasi."
  };
  const hydrologyCollection = featureCollection(hydrologyFeatures);
  hydrologyCollection.name = hydrology?.name || "Hidrologi OSM untuk analisis RDTR YG";
  hydrologyCollection.metadata = {
    ...(hydrology?.metadata || {}), access: "staff_only", status: hydrologyFeatures.length ? "partial_open_hydrology_evidence" : "not_available",
    featureCount: hydrologyFeatures.length, totalLengthKm: round(hydrologyFeatures.reduce((sum, feature) => sum + feature.properties.lengthKm, 0), 2),
    disclaimer: "Alur OSM untuk penyaringan internal; bukan jaringan sungai/drainase resmi dan belum membuktikan dimensi, arah aliran, kapasitas, kondisi, pasut, genangan, atau kewenangan."
  };
  return {
    id: "RDTR-YG-SERVICE-HYDROLOGY-EVIDENCE-V0.1",
    version: "0.1.0-internal",
    status: facilityFeatures.length || hydrologyFeatures.length ? "partial_open_evidence" : "not_available",
    facilities: facilityCollection,
    hydrology: hydrologyCollection,
    facilityCategories,
    waterwayClasses,
    villageCoverage,
    disclaimer: "Bukti OSM melengkapi penyaringan, tetapi tidak menggantikan data resmi, survei, kapasitas pelayanan, kajian hidrologi, atau validasi masyarakat."
  };
}

function buildYgServiceAccessAnalysis({ serviceEvidence, networkEvidence, villages, candidateZones }) {
  const roads = networkEvidence.roads?.features || [];
  const zones = candidateZones.features || [];
  const sourceFacilities = serviceEvidence.facilities?.features || [];
  function containingFeature(pointFeature, features) {
    return features.find(feature => {
      try { return booleanPointInPolygon(pointFeature, feature); } catch { return false; }
    });
  }
  function nearestRoadDistanceM(facility) {
    let nearest = Infinity;
    for (const road of roads) {
      try {
        const metres = pointToLineDistance(facility, road, { units: "meters" });
        if (Number.isFinite(metres) && metres < nearest) nearest = metres;
      } catch { /* malformed or unsupported open-data geometry */ }
    }
    return Number.isFinite(nearest) ? round(nearest, 1) : null;
  }
  const assessedFacilities = sourceFacilities.map((facility, index) => {
    const village = containingFeature(facility, villages);
    const zone = containingFeature(facility, zones);
    const distanceM = nearestRoadDistanceM(facility);
    const critical = Boolean(facility.properties?.critical);
    const constrainedZone = ["protected_candidate", "verification_candidate"].includes(zone?.properties?.patternCategory);
    const reasons = [];
    let score = 0;
    if (critical) { score += 3; reasons.push("fasilitas_kritis_indikatif"); }
    if (distanceM == null) { score += 2; reasons.push("jarak_ke_jalan_belum_dapat_dihitung"); }
    else if (distanceM > 500) { score += 2; reasons.push("lebih_dari_500m_dari_geometri_jalan_osm"); }
    else if (distanceM > 200) { score += 1; reasons.push("lebih_dari_200m_dari_geometri_jalan_osm"); }
    if (constrainedZone) { score += 2; reasons.push("berada_pada_zona_lindung_atau_verifikasi_yg"); }
    const priority = score >= 4 ? "high" : score >= 2 ? "medium" : "standard";
    return {
      ...facility,
      properties: {
        ...(facility.properties || {}),
        serviceAccessId: `SA-YG-${String(index + 1).padStart(3, "0")}`,
        village: village?.properties?.WADMKD || village?.properties?.NAMOBJ || null,
        ygZoneCode: zone?.properties?.code || null,
        ygZoneFamily: zone?.properties?.zoneFamily || null,
        nearestOsmRoadDistanceM: distanceM,
        verificationPriority: priority,
        verificationReasons: reasons,
        adequacyConclusion: "not_determined",
        legalEffect: "none"
      }
    };
  });
  const villageMatrix = villages.map(village => {
    const name = village.properties?.WADMKD || village.properties?.NAMOBJ || "Wilayah";
    const facilities = assessedFacilities.filter(feature => feature.properties.village === name);
    const roadRow = networkEvidence.villageCoverage?.find(row => row.village === name);
    const serviceRow = serviceEvidence.villageCoverage?.find(row => row.village === name);
    const reasons = [];
    if (!facilities.length) reasons.push("tidak_ada_geometri_fasilitas_osm");
    if (!(roadRow?.roadFeatureCount > 0)) reasons.push("tidak_ada_geometri_jalan_osm");
    if (!(serviceRow?.hydrologyFeatureCount > 0)) reasons.push("tidak_ada_geometri_hidrologi_osm");
    return {
      village: name,
      facilityFeatureCount: facilities.length,
      criticalFacilityCount: facilities.filter(feature => feature.properties.critical).length,
      roadFeatureCount: roadRow?.roadFeatureCount || 0,
      hydrologyFeatureCount: serviceRow?.hydrologyFeatureCount || 0,
      highPriorityFacilityCount: facilities.filter(feature => feature.properties.verificationPriority === "high").length,
      evidenceCheckPriority: reasons.some(reason => reason.includes("fasilitas") || reason.includes("jalan")) ? "high" : reasons.length ? "medium" : "standard",
      priorityReasons: reasons,
      serviceAdequacy: "not_assessed_population_capacity_travel_time_missing"
    };
  });
  const collection = featureCollection(assessedFacilities);
  collection.name = "Analisis akses dan prioritas verifikasi fasilitas RDTR YG v0.7";
  collection.metadata = {
    ...(serviceEvidence.facilities?.metadata || {}),
    access: "staff_only",
    status: assessedFacilities.length ? "screening_analysis_available" : "not_available",
    method: "Titik fasilitas OSM ditempatkan pada unit administrasi dan zona kandidat YG, lalu dihitung jarak lurus terdekat ke geometri jalan OSM.",
    limitation: "Jarak bukan waktu tempuh atau akses nyata. Hasil tidak menilai kecukupan pelayanan karena penduduk, kapasitas, kondisi, rute, hambatan, dan standar sektoral belum tersedia.",
    legalEffect: "none"
  };
  const prioritySummary = ["high", "medium", "standard"].map(priority => ({
    priority,
    featureCount: assessedFacilities.filter(feature => feature.properties.verificationPriority === priority).length
  }));
  return {
    id: "RDTR-YG-SERVICE-ACCESS-V0.1",
    version: "0.1.0-internal",
    status: collection.metadata.status,
    facilities: collection,
    prioritySummary,
    villageMatrix,
    limitation: collection.metadata.limitation
  };
}

function buildGeometryRegistry({ villageCount, rtrwCount, peatCount, forestCount, mangroveCandidateCount, ygZoneCount, developmentReadinessCount, structureNodeCount, structureAxisCount, roadEvidenceCount, facilityEvidenceCount, hydrologyEvidenceCount }) {
  return [
    {
      id: "GR-YG-STUDY-AREA",
      mapRef: "map.studyArea",
      status: "available_analytical_only",
      featureCount: villageCount,
      role: "administrative_input_not_official_wp_geometry",
      source: "Batas administrasi desa Riau — Hasil Delineasi Tahun 2018",
      permittedUse: "Penyaringan awal dan agregasi baseline internal.",
      limitation: "Bukan keputusan penetapan WP dan bukan batas SWP, blok, subblok, atau zona."
    },
    {
      id: "GR-YG-PLANNING-UNITS",
      mapRef: "map.ygPlanningUnits",
      status: "available_analytical_only",
      featureCount: villageCount,
      role: "analytical_unit_not_swp_or_zone",
      source: "Turunan sederhana batas administrasi untuk analisis YG",
      permittedUse: "Membaca keputusan awal dan arah analisis per kelurahan/kepenghuluan.",
      limitation: "Tidak memiliki akibat hukum zonasi dan tidak boleh digunakan untuk KKPR."
    },
    {
      id: "GR-YG-STRUCTURE-NODES",
      mapRef: "map.ygStructureNodes",
      status: "analytical_reference_geometry",
      featureCount: structureNodeCount,
      role: "service_need_reference_not_facility_location",
      source: "Titik-dalam-poligon dari 11 unit administrasi untuk uji jangkauan layanan YG",
      permittedUse: "Menguji hierarki kebutuhan pusat, jangkauan layanan, prioritas survei, dan evakuasi.",
      limitation: "Bukan lokasi fasilitas atau pusat pelayanan yang ditetapkan."
    },
    {
      id: "GR-YG-STRUCTURE-AXES",
      mapRef: "map.ygStructureAxes",
      status: "analytical_reference_geometry",
      featureCount: structureAxisCount,
      role: "connectivity_relationship_not_route",
      source: "Garis lurus analitis dari referensi Bagan Kota ke referensi wilayah lokal",
      permittedUse: "Menguji hubungan layanan, kebutuhan data jaringan, redundansi akses, dan evakuasi.",
      limitation: "Bukan trase jalan, drainase, utilitas, jalur evakuasi, atau dasar pengadaan tanah."
    },
    {
      id: "GR-YG-ROAD-EVIDENCE",
      mapRef: "map.ygRoadEvidence",
      status: roadEvidenceCount ? "available_open_data_screening" : "not_available",
      featureCount: roadEvidenceCount,
      role: "open_road_evidence_not_official_network",
      source: "OpenStreetMap contributors via Overpass; subset yang beririsan dengan wilayah kajian",
      permittedUse: "Penyaringan keterhubungan dan prioritas verifikasi jaringan nyata.",
      limitation: "Bukan jaringan jalan resmi; kelas, kewenangan, kondisi, lebar, jembatan dan keterhubungan harus diverifikasi."
    },
    {
      id: "GR-YG-FACILITY-EVIDENCE",
      mapRef: "map.ygFacilityEvidence",
      status: facilityEvidenceCount ? "available_open_data_screening" : "not_available",
      featureCount: facilityEvidenceCount,
      role: "open_facility_evidence_not_official_inventory",
      source: "OpenStreetMap contributors via Overpass; titik yang beririsan dengan wilayah kajian",
      permittedUse: "Penyaringan awal jenis fasilitas, fasilitas kritis, gap lokasi, dan kebutuhan verifikasi kapasitas.",
      limitation: "Bukan inventaris resmi; nama, fungsi, status, kapasitas, kondisi, cakupan dan kewenangan harus diverifikasi."
    },
    {
      id: "GR-YG-HYDROLOGY-EVIDENCE",
      mapRef: "map.ygHydrologyEvidence",
      status: hydrologyEvidenceCount ? "available_open_data_screening" : "not_available",
      featureCount: hydrologyEvidenceCount,
      role: "open_hydrology_evidence_not_official_network",
      source: "OpenStreetMap contributors via Overpass; alur yang beririsan dengan wilayah kajian",
      permittedUse: "Penyaringan awal konektivitas air, lokasi kajian drainase, sungai, kanal dan evakuasi perairan.",
      limitation: "Bukan jaringan hidrologi resmi dan belum membuktikan dimensi, arah, kapasitas, kondisi, pasut, genangan atau kewenangan."
    },
    {
      id: "GR-RTRW-PROVINCE",
      mapRef: "map.rtrw",
      status: "available_for_screening",
      featureCount: rtrwCount,
      role: "higher_level_plan_screening_not_rdtr_zone",
      source: "RTRW Provinsi Riau yang dipotong ke wilayah kajian",
      permittedUse: "Pemeriksaan indikatif arah pola ruang provinsi.",
      limitation: "Tidak menggantikan RTRW Kabupaten Rokan Hilir atau geometri zona RDTR resmi."
    },
    {
      id: "GR-PEAT-INDICATIVE",
      mapRef: "map.peat",
      status: "available_for_screening",
      featureCount: peatCount,
      role: "environmental_screening_not_legal_peat_function",
      source: "Gambut BBSDLP 2019",
      permittedUse: "Menandai lokasi yang memerlukan verifikasi fungsi KHG dan hidrologi.",
      limitation: "Bukan geometri fungsi lindung/budidaya ekosistem gambut yang menetapkan hak atau zonasi."
    },
    {
      id: "GR-FOREST-INDICATIVE",
      mapRef: "map.forest",
      status: "available_for_screening",
      featureCount: forestCount,
      role: "forest_status_screening_not_rdtr_zone",
      source: "Kawasan hutan SK 903",
      permittedUse: "Menandai kebutuhan verifikasi status, fungsi, perubahan, dan persetujuan kehutanan.",
      limitation: "Versi/status resmi termutakhir dan riwayat perubahan harus dikonfirmasi; RDTR tidak mengubah status kawasan hutan."
    },
    {
      id: "GR-MANGROVE-CANDIDATES",
      mapRef: "map.mangroveCandidates",
      status: "available_for_screening",
      featureCount: mangroveCandidateCount,
      role: "coastal_protection_restoration_candidates_not_rdtr_zone",
      source: "Analisis prioritas rehabilitasi mangrove YG 2016–2025 v0.1",
      permittedUse: "Menandai kandidat perlindungan/pemulihan dan kebutuhan verifikasi pesisir.",
      limitation: "Bukan batas mangrove resmi, bukan penetapan lokasi tanam, dan bukan zona RDTR; wajib verifikasi hidrodinamika, substrat, salinitas, tenurial, penghidupan, dan persetujuan masyarakat."
    },
    {
      id: "GR-YG-DRAFT-ZONES",
      mapRef: "map.ygCandidateZones",
      status: "provisional_internal_zone_geometry",
      featureCount: ygZoneCount,
      role: "yg_alternative_rdtr_zone_geometry",
      source: "Sintesis berurutan YG dari kandidat pesisir, gambut, non-APL, dan arahan RTRW Provinsi Riau",
      permittedUse: "Menyusun rancangan RDTR alternatif YG, menghitung luas zona, menguji kebutuhan data, serta menyiapkan argumen konsultasi.",
      limitation: "Bukan zonasi resmi, bukan peta dasar 1:5.000 terotorisasi, belum memuat subzona/intensitas final, dan tidak dapat digunakan untuk KKPR."
    },
    {
      id: "GR-YG-DEVELOPMENT-READINESS",
      mapRef: "map.ygDevelopmentReadiness",
      status: "development_readiness_not_determined",
      featureCount: developmentReadinessCount,
      role: "evidence_lock_and_survey_priority_not_land_suitability",
      source: "Turunan zona kandidat YG dan register bukti pengunci v0.8",
      permittedUse: "Mengurutkan survei dan menahan promosi geometri sampai bukti wajib tersedia.",
      limitation: "Bukan kelas aman, kesesuaian lahan, kelayakan pembangunan, zonasi resmi, atau dasar KKPR."
    },
    {
      id: "GR-RTRW-ROHIL",
      mapRef: null,
      status: "not_verified",
      featureCount: 0,
      role: "higher_level_regency_plan_consistency_evidence",
      source: "Pemerintah Kabupaten Rokan Hilir",
      permittedUse: "Belum tersedia untuk uji konsistensi final.",
      limitation: "Rancangan YG tetap dapat disusun, tetapi kesesuaian vertikal final harus diperiksa ketika RTRW kabupaten yang berlaku diperoleh."
    },
    {
      id: "GR-KLHS-WORKING-MAPS",
      mapRef: null,
      status: "not_received",
      featureCount: 0,
      role: "official_klhs_evidence",
      source: "Tim KLHS/perangkat daerah berwenang",
      permittedUse: "Belum ada.",
      limitation: "Batas ekologis-sosial, D3TLH, risiko, alternatif, dan rekomendasi belum dapat diintegrasikan secara spasial."
    }
  ];
}

function regulatoryAssessments(summary) {
  return [
    {
      id: "A01", theme: "Kedudukan dan hierarki rencana", decision: "verify", confidence: "menengah",
      finding: `Baseline mencakup ${summary.villageCount} wilayah, tetapi keputusan penetapan WP dan RTRW Kabupaten Rokan Hilir yang berlaku belum diterima.`,
      regulations: ["R01", "R02", "R03", "L01", "L02"],
      requirement: "WP harus memiliki dasar delineasi dan RDTR harus konsisten dengan RTR yang lebih tinggi serta dokumen pembangunan yang berlaku.",
      ygPosition: "YG belum menyatakan konsisten atau bertentangan. Penyusun harus membuka dasar penetapan WP, RTRW kabupaten yang sah, dan matriks konsistensi vertikal.",
      validation: "Keputusan WP, Perda RTRW kabupaten dan lampiran digital, status revisi RTRW Riau, serta matriks konsistensi."
    },
    {
      id: "A02", theme: "Perlindungan ekosistem gambut", decision: "hold", confidence: "tinggi untuk indikasi; rendah untuk fungsi hukum",
      finding: `Gambut indikatif mencakup ${summary.peatAreaHa.toLocaleString("id-ID")} ha atau ${summary.peatCoveragePct}% wilayah kajian.`,
      regulations: ["R05", "R09", "R10", "R11"],
      requirement: "Fungsi KHG, kubah, kedalaman, hidrologi, muka air, kerusakan, dan pemulihan harus menjadi dasar KLHS dan ketentuan zonasi.",
      ygPosition: "Tahan zona baru berintensitas tinggi pada area bergambut sampai fungsi ekosistem resmi dan dampak hidrologis dibuktikan. Angka 30% berlaku pada KHG, bukan otomatis pada luas WP.",
      validation: "Peta KHG/fungsi resmi, kubah dan kedalaman, kanal/struktur air, muka air, subsidensi, kebakaran, tutupan dan rencana pemulihan."
    },
    {
      id: "A03", theme: "Status kawasan hutan", decision: "hold", confidence: "menengah",
      finding: `Indikasi kawasan hutan non-APL mencakup ${summary.forestAreaHa.toLocaleString("id-ID")} ha atau ${summary.forestCoveragePct}% wilayah kajian.`,
      regulations: ["R01", "R14", "L01", "L02"],
      requirement: "RDTR harus mengakui status dan fungsi kawasan hutan; perubahan zona tidak menggantikan prosedur kehutanan.",
      ygPosition: "Tahan arahan budidaya non-kehutanan pada irisan non-APL sampai status penetapan, riwayat perubahan, persetujuan, dan kewenangan dibuktikan.",
      validation: "SK kawasan hutan termutakhir, riwayat perubahan, PBPH/persetujuan penggunaan, pelepasan, perhutanan sosial, dan konflik tenurial."
    },
    {
      id: "A04", theme: "Pesisir, mangrove dan sempadan", decision: "hold", confidence: "terbatas",
      finding: `Analisis mangrove baru tersedia pada ${summary.mangroveAnalysedVillageCount} dari ${summary.villageCount} wilayah; kajian pasut, rob, abrasi, dan sempadan belum diterima.`,
      regulations: ["R10", "R12", "R13"],
      requirement: "Sempadan dan pemanfaatan pesisir harus berbasis karakter biofisik-hidrooseanografi, risiko, ekosistem, serta akses dan penghidupan masyarakat.",
      ygPosition: "Tahan intensifikasi pesisir dan reklamasi/perubahan aliran sebelum sempadan berbasis kajian, konektivitas pasang-surut, perlindungan mangrove, dan akses masyarakat ditetapkan.",
      validation: "Garis pantai multitemporal, pasut, gelombang, arus, elevasi, rob, abrasi-akresi, mangrove seluruh WP, ruang tangkap/tambat, dan akses publik."
    },
    {
      id: "A05", theme: "Integrasi KLHS", decision: "hold", confidence: "tinggi",
      finding: "Dokumen, peta kerja, alternatif, rekomendasi, matriks integrasi, penjaminan mutu, dan validasi KLHS belum diterima.",
      regulations: ["R05", "R09", "R10"],
      requirement: "KLHS harus menguji wilayah fungsional, isu strategis, D3TLH, jasa ekosistem, risiko, biodiversitas, iklim, penghidupan, alternatif, dan integrasinya ke keputusan ruang.",
      ygPosition: "Pilihan zona, intensitas, dan program berdampak tinggi belum layak dipromosikan sebelum proses KLHS menunjukkan bagaimana rekomendasinya mengubah rancangan YG, bukan sekadar menjadi lampiran.",
      validation: "KAK/metode, batas ekologis-sosial, isu, analisis dampak, alternatif, rekomendasi, perubahan sebelum-sesudah, partisipasi, mutu, dan validasi gubernur."
    },
    {
      id: "A06", theme: "Risiko rob, banjir, abrasi dan subsidensi", decision: "hold", confidence: "terbatas",
      finding: "Belum tersedia model atau peta terpadu rob, banjir, genangan, abrasi-akresi, subsidensi, drainase, dan proyeksi iklim untuk umur rencana.",
      regulations: ["R01", "R02", "R10", "R11", "R12"],
      requirement: "Risiko bencana dan perubahan iklim harus memengaruhi lokasi, intensitas, prasarana, jalur evakuasi, ketentuan khusus, dan prioritas program.",
      ygPosition: "Tahan peningkatan kepadatan dan aset kritis pada dataran rendah/gambut/pesisir sampai skenario multi-bahaya dan kemampuan drainase diuji.",
      validation: "DEM/elevasi, seri pasut-curah hujan, genangan historis, model rob/banjir, laju subsidensi, drainase, abrasi, proyeksi iklim, dan evakuasi."
    },
    {
      id: "A07", theme: "Kualitas geometri dan basis data", decision: "verify", confidence: "tinggi",
      finding: "Geometri zonasi alternatif YG v0.2 telah dibentuk dari layer penyaringan, tetapi belum memakai peta dasar terotorisasi skala 1:5.000 dan atribut zona/subzona belum lengkap.",
      regulations: ["R04", "R15"],
      requirement: "Geometri, atribut, topologi, referensi, metadata, dan album peta RDTR harus lengkap, konsisten, dan dapat diuji.",
      ygPosition: "YG memperlakukan zona v0.2 sebagai hipotesis spasial yang harus melalui uji gap, overlap, sliver, ketelitian posisi, konsistensi atribut, dan verifikasi lapangan sebelum dipromosikan menjadi rekomendasi final.",
      validation: "GeoPackage/geodatabase atau SHP/GeoJSON, rekomendasi peta dasar BIG, CRS, ketelitian, metadata, kamus data, laporan topologi, dan changelog."
    },
    {
      id: "A08", theme: "Partisipasi dan jejak keputusan", decision: "conditional", confidence: "tinggi",
      finding: "Konsultasi publik berlangsung, tetapi mekanisme respons dan keterlacakan perubahan rancangan YG belum dioperasionalkan.",
      regulations: ["R01", "R03", "R06", "R09", "R10"],
      requirement: "Masukan masyarakat dan FPR harus didokumentasikan, dinilai, dijawab, serta dapat ditelusuri ke perubahan atau alasan penolakan.",
      ygPosition: "Setiap masukan perlu ID, pengusul, lokasi, substansi, bukti, respons, perubahan peta/pasal, penanggung jawab, dan status; ringkasan tanpa matriks respons tidak memadai.",
      validation: "Undangan, daftar pihak, materi, notulen, peta partisipatif, matriks respons, rekomendasi FPR, dan rancangan YG sebelum-sesudah."
    },
    {
      id: "A09", theme: "Tenurial, KKPR dan ruang hidup", decision: "verify", confidence: "terbatas",
      finding: "Baseline belum memuat bidang/hak agregat, KKPR/izin, perhutanan sosial, ruang hidup pesisir, dan konflik secara lengkap.",
      regulations: ["R07", "R13", "R14"],
      requirement: "Rencana perlu mempertimbangkan hak/persetujuan eksisting, akses masyarakat, konflik, masa transisi, dan keterlaksanaan program.",
      ygPosition: "Zona baru harus diuji terhadap hak/izin, wilayah kelola, perhutanan sosial, akses nelayan, dan penghidupan; data pribadi tetap dianonimkan.",
      validation: "Bidang/hak agregat, KKPR, izin/persetujuan, perhutanan sosial, peta partisipatif ruang hidup, konflik, dan mekanisme penyelesaian."
    },
    {
      id: "A10", theme: "Pengendalian dan implementasi", decision: "conditional", confidence: "menengah",
      finding: "Aturan zonasi, indikator pengendalian, instansi pelaksana, program, waktu, dan pembiayaan rancangan YG belum dirumuskan lengkap.",
      regulations: ["R02", "R07", "R08"],
      requirement: "RDTR harus dapat dilaksanakan dan diawasi melalui ketentuan kegiatan, intensitas, prasarana, ketentuan khusus, program, dan instrumen pengendalian.",
      ygPosition: "Rekomendasi perlindungan tidak cukup ditulis sebagai narasi; harus diterjemahkan menjadi geometri, aturan terukur, indikator, penanggung jawab, program, dan sumber pembiayaan.",
      validation: "Rancangan perkada, matriks kegiatan, intensitas, ketentuan khusus, indikasi program, sumber biaya, SOP pengawasan, dan indikator pemantauan."
    }
  ];
}

function buildConsultationArgumentMatrix(assessments, candidateZones, evidenceBoard) {
  const templates = {
    A01: {
      question: "Apa dasar hukum dan analitis penetapan WP 11 wilayah, dan bagaimana konsistensinya dengan RTRW Kabupaten Rokan Hilir yang berlaku?",
      requestedChange: "Buka keputusan/dasar delineasi WP, lampiran digital RTRW kabupaten yang berlaku, dan matriks konsistensi vertikal; revisi batas atau klasifikasi yang tidak dapat dijustifikasi.",
      responseStandard: "Nomor dan status instrumen, geometri digital, metode perbandingan, daftar perbedaan, keputusan atas tiap perbedaan, dan penanggung jawab tindak lanjut.",
      evidenceRefs: ["P0-E01", "P0-E02", "P0-E03"], zoneFamilies: []
    },
    A02: {
      question: "Bagaimana zona dan intensitas diuji terhadap fungsi KHG, kubah, kedalaman gambut, muka air, subsidensi, kanal, dan risiko kebakaran?",
      requestedChange: "Pertahankan zona perlindungan/pengelolaan gambut dan tahan intensifikasi sampai fungsi KHG serta dampak hidrologis tervalidasi; masukkan larangan pengeringan dan kewajiban pemulihan.",
      responseStandard: "Peta KHG/fungsi resmi, metode overlay, luas per zona, model tata air, pilihan alternatif, perubahan geometri/aturan, dan alasan bila rekomendasi tidak diterima.",
      evidenceRefs: ["P0-E04", "P0-E07"], zoneFamilies: ["peat_hydrology_management", "safe_urban_consolidation"]
    },
    A03: {
      question: "Bagaimana status kawasan hutan, persetujuan sektoral, perhutanan sosial, serta riwayat perubahan kawasan direkonsiliasi dengan zona RDTR?",
      requestedChange: "Tandai seluruh irisan non-APL sebagai ruang penyelarasan status dan jangan promosikan fungsi non-kehutanan sebelum status, fungsi, persetujuan, dan kewenangan dibuktikan.",
      responseStandard: "SK dan lampiran termutakhir, riwayat perubahan, daftar persetujuan/hak, luas irisan per zona, keputusan rekonsiliasi, serta konfirmasi instansi berwenang.",
      evidenceRefs: ["P0-E05", "P0-E07"], zoneFamilies: ["forest_status_alignment"]
    },
    A04: {
      question: "Apa dasar geometri sempadan pantai, Sungai Rokan, anak sungai, muara, serta perlindungan mangrove dan akses masyarakat pesisir?",
      requestedChange: "Pertahankan kandidat perlindungan pesisir–mangrove; matangkan batas dan aturan dari pasut, abrasi-akresi, hidrodinamika, ekosistem, ruang tangkap/tambat, dan akses publik.",
      responseStandard: "Dataset dan periode pengamatan, metode penetapan sempadan, skenario perubahan garis pantai, peta akses/ruang hidup, hasil konsultasi masyarakat, dan perubahan zona/ketentuan khusus.",
      evidenceRefs: ["P0-E06", "P0-E07"], zoneFamilies: ["coastal_mangrove_protection", "higher_plan_protection_alignment"]
    },
    A05: {
      question: "Bagaimana setiap rekomendasi KLHS mengubah tujuan, struktur, pola ruang, intensitas, ketentuan khusus, dan program RDTR?",
      requestedChange: "Sediakan matriks integrasi KLHS sebelum–sesudah dan tahan keputusan berdampak tinggi yang belum melewati alternatif, penjaminan mutu, serta validasi.",
      responseStandard: "ID rekomendasi, isu/dampak, alternatif, keputusan, lokasi, perubahan geometri/pasal/program, alasan penolakan, status mutu, dan validasi.",
      evidenceRefs: ["P0-E08"], zoneFamilies: []
    },
    A06: {
      question: "Skenario rob, banjir, abrasi, subsidensi, kebakaran, drainase, kenaikan muka laut, dan iklim apa yang dipakai sampai akhir umur rencana?",
      requestedChange: "Tahan peningkatan kepadatan dan aset kritis sampai model multi-bahaya, kapasitas drainase, elevasi aman, redundansi akses, dan evakuasi teruji serta diterjemahkan ke peta dan aturan.",
      responseStandard: "Asumsi dan horizon skenario, resolusi/ketelitian data, validasi kejadian historis, populasi/aset terpapar, residual risk, perubahan zona/intensitas, dan rencana evakuasi.",
      evidenceRefs: ["P0-E09"], zoneFamilies: ["safe_urban_consolidation", "peat_hydrology_management", "coastal_mangrove_protection"]
    },
    A07: {
      question: "Apakah peta dasar, geometri, atribut, topologi, metadata, dan kesamaan luas tabel–peta telah memenuhi kebutuhan skala 1:5.000?",
      requestedChange: "Audit seluruh geometri zona/subzona, gap, overlap, sliver, dangle, CRS, ketelitian, kamus data, metadata, dan changelog sebelum dipakai sebagai lampiran regulasi.",
      responseStandard: "Rekomendasi peta dasar, laporan ketelitian, aturan topologi, daftar error dan koreksi, metadata, kamus atribut, versioning, dan hasil uji kesamaan luas.",
      evidenceRefs: ["P0-E07", "P0-E10"], zoneFamilies: []
    },
    A08: {
      question: "Bagaimana setiap masukan konsultasi diberi ID, dinilai, dijawab, dan ditelusuri ke perubahan peta, pasal, program, atau alasan penolakan?",
      requestedChange: "Gunakan register tanggapan yang terbuka bagi peserta konsultasi dan pertahankan jejak keputusan sebelum–sesudah, termasuk perbedaan pendapat serta rekomendasi FPR.",
      responseStandard: "ID masukan, pengusul/kelompok, tanggal, lokasi, substansi, bukti, respons, keputusan, perubahan, alasan, penanggung jawab, tenggat, dan status penyelesaian.",
      evidenceRefs: ["P0-E01"], zoneFamilies: []
    },
    A09: {
      question: "Bagaimana hak, KKPR/izin, perhutanan sosial, ruang hidup, akses nelayan, kelompok rentan, serta konflik direkonsiliasi tanpa membuka data pribadi?",
      requestedChange: "Tambahkan peta agregat hak/izin dan ruang hidup, mekanisme perlindungan akses, penyelesaian konflik, persetujuan, serta aturan transisi sebelum perubahan fungsi ruang.",
      responseStandard: "Sumber dan tanggal data, anonimisasi, daftar tumpang tindih, proses persetujuan, opsi penyelesaian, perlindungan kelompok rentan, keputusan per lokasi, dan mekanisme pengaduan.",
      evidenceRefs: ["P0-E10"], zoneFamilies: ["community_livelihood_and_production", "coastal_mangrove_protection", "forest_status_alignment"]
    },
    A10: {
      question: "Bagaimana aturan zonasi, program, indikator, pelaksana, pembiayaan, pengawasan, dan tindakan korektif dibuat operasional serta dapat diaudit?",
      requestedChange: "Lengkapi ITBX, intensitas berbukti, prasarana minimum, ketentuan khusus, indikasi program, indikator, wali data, biaya, sumber dana, inspeksi, pengaduan, dan evaluasi.",
      responseStandard: "Matriks zona–kegiatan–syarat, parameter dan dasar hitung, program berlokasi, indikator baseline/target, pelaksana berwenang, pembiayaan, jadwal, SOP pengawasan, dan konsekuensi korektif.",
      evidenceRefs: ["P0-E07", "P0-E10"], zoneFamilies: []
    }
  };
  const allZoneCodes = [...new Set((candidateZones.features || []).map(feature => feature.properties?.code).filter(Boolean))].sort();
  const validEvidenceIds = new Set((evidenceBoard.items || []).map(row => row.id));
  const items = assessments.map((assessment, index) => {
    const template = templates[assessment.id];
    const zoneCodes = template.zoneFamilies.length
      ? [...new Set((candidateZones.features || []).filter(feature => template.zoneFamilies.includes(feature.properties?.zoneFamily)).map(feature => feature.properties?.code).filter(Boolean))].sort()
      : allZoneCodes;
    return {
      id: `CONS-YG-${String(index + 1).padStart(2, "0")}`,
      assessmentRef: assessment.id,
      theme: assessment.theme,
      priority: assessment.decision === "hold" ? "P0" : assessment.decision === "verify" ? "P1" : "P2",
      status: "ready_internal_argument_pending_consultation",
      consultationQuestion: template.question,
      legalBasisRefs: assessment.regulations,
      evidenceRefs: template.evidenceRefs.filter(id => validEvidenceIds.has(id)),
      linkedZoneCodes: zoneCodes,
      ygFinding: assessment.finding,
      ygPosition: assessment.ygPosition,
      requestedChange: template.requestedChange,
      responseStandard: template.responseStandard,
      requestedDisposition: "accept_or_reasoned_reject_with_evidence",
      governmentResponse: null,
      agreedChange: null,
      mapChangeRef: null,
      ruleChangeRef: null,
      responsibleParty: null,
      dueDate: null,
      resolutionStatus: "not_started"
    };
  });
  return {
    id: "RDTR-YG-CONSULTATION-ARGUMENT-MATRIX-V0.1",
    version: "0.1.0-internal",
    access: "staff_only",
    status: "internal_arguments_ready_responses_pending",
    items,
    responseRule: "Tidak diterima, diterima sebagian, atau ditolak harus disertai alasan, bukti, penanggung jawab, dan jejak perubahan peta/pasal/program.",
    privacyRule: "Identitas pribadi dan data sensitif tenurial/konflik tidak dimasukkan ke keluaran konsultasi tanpa dasar dan persetujuan yang sesuai.",
    disclaimer: "Matriks kerja internal YG untuk konsultasi; bukan catatan resmi pemerintah dan kolom respons tidak boleh diisi sebelum pernyataan atau dokumen diterima."
  };
}

function buildConsultationReadinessPack(argumentMatrix, geometryRegistry, evidenceBoard) {
  const priorityOrder = { P0: 0, P1: 1, P2: 2 };
  const priorityAgenda = [...argumentMatrix.items]
    .sort((left, right) => priorityOrder[left.priority] - priorityOrder[right.priority] || left.id.localeCompare(right.id))
    .map((row, index) => ({
      order: index + 1,
      argumentRef: row.id,
      priority: row.priority,
      theme: row.theme,
      oralQuestion: row.consultationQuestion,
      speakingPoint: row.ygPosition,
      requestedOutcome: row.requestedChange,
      responseStandard: row.responseStandard,
      timeAllocationMinutes: row.priority === "P0" ? 4 : row.priority === "P1" ? 3 : 2,
      status: "ready_for_internal_briefing"
    }));
  const mapSpecs = [
    ["MAP-CONS-01", "Batas 11 wilayah dan unit kajian", "map.studyArea", "Menegaskan cakupan dan meminta dasar penetapan WP."],
    ["MAP-CONS-02", "Peta sintesis kebijakan gambut, non-APL, dan pesisir", "policyMapFramework", "Menunjukkan kendala kebijakan yang tidak boleh diabaikan."],
    ["MAP-CONS-03", "Rancangan zona alternatif YG", "map.ygCandidateZones", "Menyajikan argumen tanding spasial yang saling eksklusif."],
    ["MAP-CONS-04", "Uji kesiapan pengembangan zona", "map.ygDevelopmentReadiness", "Menunjukkan bukti pengunci dan area yang belum terbukti aman."],
    ["MAP-CONS-05", "Bukti jaringan jalan OSM", "map.ygRoadEvidence", "Menguji keterhubungan tanpa mengklaim jaringan resmi."],
    ["MAP-CONS-06", "Bukti fasilitas dan hidrologi OSM", "map.ygFacilityEvidence/map.ygHydrologyEvidence", "Menguji kebutuhan inventaris, kapasitas layanan, dan kajian hidrologi."],
    ["MAP-CONS-07", "Simpul dan sumbu struktur analitis", "map.ygStructureNodes/map.ygStructureAxes", "Membahas hubungan pelayanan tanpa menetapkan lokasi atau trase."]
  ];
  const geometryByRef = new Map((geometryRegistry || []).map(row => [row.mapRef, row]));
  const mapChecklist = mapSpecs.map(([id, title, mapRef, consultationUse]) => {
    const refs = mapRef.split("/");
    const registryRows = refs.map(ref => geometryByRef.get(ref)).filter(Boolean);
    const available = ref => ref === "policyMapFramework" || Boolean(geometryByRef.get(ref)?.featureCount);
    return {
      id, title, mapRef, consultationUse,
      status: refs.every(available) ? "ready_internal" : "partial_or_missing",
      limitations: registryRows.map(row => row.limitation),
      exportOrPrintChecked: false,
      reviewedBy: null,
      reviewDate: null
    };
  });
  const evidenceIds = [...new Set(argumentMatrix.items.flatMap(row => row.evidenceRefs))];
  const evidenceById = new Map((evidenceBoard.items || []).map(row => [row.id, row]));
  const evidenceChecklist = evidenceIds.map(id => {
    const evidence = evidenceById.get(id);
    return {
      evidenceRef: id,
      title: evidence?.title || id,
      evidenceClass: evidence?.evidenceClass || null,
      sourceStatus: evidence?.status || "not_received",
      consultationCopyStatus: "not_checked",
      fileOrLinkRef: null,
      confidentialityChecked: false,
      reviewedBy: null
    };
  });
  const teamRoles = [
    { id: "ROLE-YG-01", role: "Juru bicara utama", responsibility: "Menyampaikan posisi, meminta jawaban, dan menjaga fokus agenda.", assignedTo: null },
    { id: "ROLE-YG-02", role: "Analis regulasi", responsibility: "Menunjukkan dasar pasal dan mencatat alasan hukum jawaban.", assignedTo: null },
    { id: "ROLE-YG-03", role: "Analis GIS", responsibility: "Menampilkan peta, mencatat lokasi, dan mengunci referensi perubahan geometri.", assignedTo: null },
    { id: "ROLE-YG-04", role: "Pencatat keputusan", responsibility: "Merekam jawaban, komitmen, penanggung jawab, tenggat, dan tindak lanjut.", assignedTo: null },
    { id: "ROLE-YG-05", role: "Penghubung masyarakat", responsibility: "Menjaga keterwakilan isu ruang hidup, kelompok rentan, dan persetujuan yang sesuai.", assignedTo: null }
  ];
  const noteTemplate = argumentMatrix.items.map(row => ({
    argumentRef: row.id,
    theme: row.theme,
    questionAsked: false,
    respondentNameAndRole: null,
    responseVerbatimOrSummary: null,
    evidencePromised: null,
    disposition: null,
    agreedChange: null,
    mapChangeRef: null,
    ruleOrProgrammeChangeRef: null,
    responsibleParty: null,
    dueDate: null,
    followUpOwner: null,
    resolutionStatus: "not_started",
    confidentialityNote: null
  }));
  return {
    id: "RDTR-YG-CONSULTATION-READINESS-PACK-V0.1",
    version: "0.1.0-internal",
    access: "staff_only",
    status: "internal_briefing_pack_ready_assignments_and_material_checks_pending",
    priorityAgenda,
    mapChecklist,
    evidenceChecklist,
    teamRoles,
    sessionProtocol: {
      before: ["Tetapkan peran tim", "Periksa versi peta dan bukti", "Tandai data sensitif", "Latih pertanyaan P0", "Siapkan cadangan offline"],
      during: ["Sebut ID argumentasi", "Catat penjawab dan substansi", "Minta bukti serta tenggat", "Tautkan jawaban ke peta/pasal/program", "Jangan menyepakati data yang belum diverifikasi"],
      after: ["Kunci catatan dan waktu", "Unggah bukti yang diterima", "Perbarui matriks respons", "Uji perubahan geometri/aturan", "Kirim konfirmasi tertulis atas komitmen"]
    },
    noteTemplate,
    readinessRule: "Status siap konsultasi hanya berarti bahan internal tersedia; bukan berarti seluruh bukti, penugasan tim, atau materi yang akan dibagikan telah tervalidasi.",
    disclaimer: "Paket internal YG. Nama peserta, jawaban, komitmen, dan tenggat harus dicatat dari kejadian nyata dan tidak boleh direkayasa sebelum atau sesudah konsultasi."
  };
}

function buildRdtrCompletenessAudit({ ygPlan, candidateZones, structureDraft, mandatoryAnalyses, evidenceBoard, developmentReadiness, consultationMatrix }) {
  const rows = [
    ["AUD-YG-01", "Dasar dan delineasi WP", "process", "blocked_external_evidence", ["R02", "R03", "L02"], ["map.studyArea"], "Batas 11 wilayah tersedia sebagai unit kajian internal.", "Keputusan/dasar delineasi WP dan keterkaitan dengan RTRW kabupaten belum diterima.", "Dokumen penetapan/dasar WP, geometri resmi, dan uji konsistensi hierarki tervalidasi."],
    ["AUD-YG-02", "Peta dasar skala 1:5.000", "geospatial", "blocked_external_evidence", ["R02", "R03", "R04", "R15"], ["map.studyArea"], "Layer penyaringan dan geometri kerja tersedia.", "Peta dasar terotorisasi, ketelitian posisi, serta rekomendasi/konfirmasi sumber belum tersedia.", "Peta dasar, CRS, ketelitian, metadata, dan berita acara/rekomendasi yang memenuhi ketentuan."],
    ["AUD-YG-03", "Pengumpulan data dan basis data", "process", "partial_internal", ["R03", "R04", "R15"], ["geometryRegistry", "p0EvidenceBoard"], "Register geometri, bukti, sumber, keterbatasan, dan status tersedia.", "Penggunaan lahan, bangunan, penduduk, kapasitas layanan, bahaya, hak/izin, serta data sektoral belum lengkap.", "Seluruh dataset minimum diterima, divalidasi, dimetadata, dan memiliki wali data."],
    ["AUD-YG-04", "Dua puluh satu analisis Pasal 24", "analysis", "partial_internal", ["R03"], ["mandatoryAnalysisMatrix", "analysisProgramme"], `${mandatoryAnalyses.length} kerangka analisis, pertanyaan, metode, keluaran, dan gap telah disusun.`, "Sebagian besar analisis masih kerangka atau penyaringan karena data pengunci belum lengkap.", "Setiap analisis memiliki input tervalidasi, metode terdokumentasi, hasil spasial/numerik, kesimpulan, dan jejak keputusan."],
    ["AUD-YG-05", "Integrasi KLHS", "process", "blocked_external_evidence", ["R03", "R05", "R09", "R10"], ["consultationArgumentMatrix"], "Posisi YG dan standar matriks integrasi telah dirumuskan.", "Dokumen, peta kerja, alternatif, rekomendasi, penjaminan mutu, dan validasi KLHS belum diterima.", "Matriks rekomendasi KLHS sebelum–sesudah terlacak ke tujuan, struktur, pola, zonasi, dan program."],
    ["AUD-YG-06", "Tujuan penataan WP", "mandatory_content", "partial_internal", ["R02", "R03", "R05"], ["ygPlan.planningObjective"], "Rumusan tujuan dan strategi YG tersedia.", "Indikator terukur, baseline, target, horizon, serta konsistensi RTRW/KLHS belum final.", "Tujuan disepakati, terukur, konsisten hierarki, dan memiliki indikator serta sumber data."],
    ["AUD-YG-07", "Rencana struktur ruang", "mandatory_content", "partial_internal", ["R02", "R03", "R04"], ["map.ygStructureNodes", "map.ygStructureAxes", "map.ygRoadEvidence"], `${structureDraft.nodes.features.length} simpul dan ${structureDraft.axes.features.length} sumbu hubungan analitis tersedia.`, "Simpul bukan lokasi fasilitas, sumbu bukan trase, dan hierarki/kapasitas jaringan resmi belum ditetapkan.", "Lokasi/hierarki pusat dan jaringan tervalidasi pada peta 1:5.000 dengan kapasitas, kewenangan, serta keselamatan."],
    ["AUD-YG-08", "Rencana pola ruang", "mandatory_content", "available_internal_provisional", ["R02", "R03", "R04", "R05"], ["map.ygCandidateZones"], `${candidateZones.features.length} geometri zona kandidat saling eksklusif dengan cakupan ${candidateZones.metadata.coveragePct}%.`, "Belum menjadi zona/subzona resmi; nomenklatur, batas, hak, risiko, KLHS, dan konsistensi RTRW belum final.", "Geometri zona/subzona 1:5.000 lulus topologi, hierarki, KLHS, sektoral, tenurial, dan konsultasi."],
    ["AUD-YG-09", "Ketentuan pemanfaatan ruang", "mandatory_content", "partial_internal", ["R02", "R03", "R07"], ["ygPlan.programs"], `${ygPlan.programs.items.length} paket indikasi program dengan indikator dan tahapan relatif tersedia.`, "Lokasi, volume, target, biaya, sumber dana, pelaksana, dan komitmen belum ditetapkan.", "Program terlokasi, terukur, bertahap, berbiaya, memiliki sumber pembiayaan dan pelaksana berwenang."],
    ["AUD-YG-10", "Peraturan zonasi dan ITBX", "mandatory_content", "partial_internal", ["R02", "R03", "R07", "R08"], ["ygPlan.zoningRules"], "Kamus subzona, 12 kelompok kegiatan, matriks I/T/B/X, dan ketentuan khusus kandidat tersedia.", "Geometri subzona dan angka KDB/KLB/KDH/ketinggian/kepadatan/sempadan belum ditetapkan.", "ITBX, intensitas, prasarana minimum, ketentuan khusus, variansi, insentif/disinsentif, dan sanksi berbasis bukti."],
    ["AUD-YG-11", "Pengendalian risiko dan ketentuan khusus", "mandatory_content", "partial_internal", ["R05", "R08", "R10", "R11", "R12"], ["map.ygDevelopmentReadiness"], `${developmentReadiness.zones.features.length} zona memiliki evidence locks dan keputusan promosi.`, "Model multi-bahaya, batas overlay pengendalian, elevasi aman, evakuasi, dan risiko residual belum tersedia.", "Overlay bahaya tervalidasi diterjemahkan menjadi larangan, syarat, desain, monitoring, dan tindakan korektif."],
    ["AUD-YG-12", "Album peta, metadata, dan topologi", "geospatial", "partial_internal", ["R04", "R15"], ["geometryRegistry", "map.ygCandidateZones"], "Layer, metadata internal, luas, sumber, status, dan aturan topologi zonasi tersedia.", "Belum ada album peta legal, layout baku, indeks lembar, audit ketelitian penuh, atau geodatabase resmi.", "Album dan basis data sesuai standar, identik dengan tabel/naskah, lulus QA, versioned, dan ditandatangani."],
    ["AUD-YG-13", "Partisipasi dan matriks respons", "process", "available_internal_provisional", ["R01", "R03", "R06", "R09"], ["consultationArgumentMatrix", "consultationReadinessPack"], `${consultationMatrix.items.length} argumentasi dan template respons telah tersedia.`, "Belum ada respons, kesepakatan, penanggung jawab, tenggat, atau bukti perubahan hasil konsultasi nyata.", "Masukan peserta dan FPR tercatat, dijawab, serta terlacak ke perubahan atau penolakan beralasan."],
    ["AUD-YG-14", "Indikasi program dan pembiayaan", "implementation", "partial_internal", ["R02", "R03", "R07"], ["ygPlan.programs"], "Portofolio, calon peran, indikator, dan urutan relatif tersedia tanpa klaim anggaran.", "Baseline, target, lokasi, volume, biaya, sumber dana, dan komitmen belum ada.", "Program sinkron dengan perencanaan pembangunan, fiskal, kewenangan, pengadaan, O&M, dan indikator."],
    ["AUD-YG-15", "Rancangan perkada dan lampiran", "legal", "blocked_authority_process", ["R02", "R03"], ["ygDraftRdtr"], "Struktur teknis alternatif YG menyediakan bahan untuk menguji muatan.", "YG tidak memiliki kewenangan menyusun/menetapkan perkada dan naskah hukum resmi belum tersedia.", "Rancangan perkada oleh pihak berwenang konsisten dengan materi teknis, peta, basis data, dan hasil konsultasi."],
    ["AUD-YG-16", "Forum Penataan Ruang dan persetujuan substansi", "legal", "blocked_authority_process", ["R02", "R03", "R06"], ["consultationArgumentMatrix"], "Daftar isu dan standar jawaban untuk forum/persetujuan telah disiapkan.", "Rekomendasi FPR, dokumen permohonan, hasil pembahasan, dan persetujuan substansi belum tersedia.", "Rekomendasi forum dan persetujuan substansi sah, lengkap, serta seluruh catatan ditindaklanjuti."],
    ["AUD-YG-17", "Penetapan dan pengundangan", "legal", "blocked_authority_process", ["R01", "R02", "R03"], [], "Tidak ada klaim penetapan dalam rancangan YG.", "Belum ada perkada ditetapkan, diundangkan, atau bukti autentik lampiran peta/basis data.", "Perkada ditetapkan dan diundangkan oleh pejabat berwenang dengan lampiran konsisten dan dapat diakses."],
    ["AUD-YG-18", "Kesiapan publikasi dan penggunaan", "governance", "blocked_internal_approval", ["R01", "R04", "R08", "R15"], ["ygDraftRdtr", "p0EvidenceBoard"], "Dashboard staf, noindex, disclaimer, ekspor, dan quality gates tersedia.", "Belum ada persetujuan final YG, audit kerahasiaan, paket sumber, verifikasi hukum, atau keputusan publikasi.", "Persetujuan final internal, audit data sensitif, QA teknis-hukum, paket sumber, changelog, dan rencana pembaruan selesai." ]
  ].map(([id, component, category, status, regulationRefs, outputRefs, available, gap, completionGate]) => ({
    id, component, category, status, regulationRefs, outputRefs, available, gap, completionGate,
    legalCompleteness: "not_complete",
    publicationEligible: false,
    reviewedBy: null,
    reviewDate: null
  }));
  const statusOrder = ["available_internal_provisional", "partial_internal", "blocked_external_evidence", "blocked_authority_process", "blocked_internal_approval"];
  const statusSummary = statusOrder.map(status => ({ status, count: rows.filter(row => row.status === status).length }));
  return {
    id: "RDTR-YG-COMPLETENESS-AUDIT-V0.1",
    version: "0.1.0-internal",
    access: "staff_only",
    status: "not_ready_for_legal_or_public_release",
    internalWorkingStatus: "substantial_analytical_draft_with_material_evidence_gaps",
    totalComponents: rows.length,
    statusSummary,
    items: rows,
    releaseGates: [
      { id: "REL-01", gate: "Persetujuan final internal YG", status: "not_completed" },
      { id: "REL-02", gate: "Audit teknis geospasial dan konsistensi angka", status: "not_completed" },
      { id: "REL-03", gate: "Audit hukum, sumber, lisensi, privasi, dan data sensitif", status: "not_completed" },
      { id: "REL-04", gate: "Paket bukti, metadata, changelog, dan batas penggunaan", status: "not_completed" },
      { id: "REL-05", gate: "Keputusan eksplisit merge, deploy, dan publikasi", status: "not_completed" }
    ],
    decisionRule: "Tidak ada komponen yang boleh disebut lengkap secara hukum atau layak publikasi hanya karena tersedia sebagai rancangan internal.",
    disclaimer: "Audit ini menilai kelengkapan rancangan YG, bukan menyatakan proses atau dokumen RDTR pemerintah lengkap/tidak lengkap tanpa akses pada bukti resminya."
  };
}

function buildGapClosureWorkplan(completenessAudit) {
  const dependencies = {
    "AUD-YG-01": [], "AUD-YG-02": [], "AUD-YG-03": [], "AUD-YG-04": ["AUD-YG-02", "AUD-YG-03"],
    "AUD-YG-05": [], "AUD-YG-06": ["AUD-YG-01", "AUD-YG-04", "AUD-YG-05"],
    "AUD-YG-07": ["AUD-YG-01", "AUD-YG-02", "AUD-YG-03", "AUD-YG-04", "AUD-YG-05"],
    "AUD-YG-08": ["AUD-YG-01", "AUD-YG-02", "AUD-YG-03", "AUD-YG-04", "AUD-YG-05"],
    "AUD-YG-09": ["AUD-YG-04", "AUD-YG-05", "AUD-YG-06", "AUD-YG-07", "AUD-YG-08"],
    "AUD-YG-10": ["AUD-YG-02", "AUD-YG-04", "AUD-YG-05", "AUD-YG-07", "AUD-YG-08"],
    "AUD-YG-11": ["AUD-YG-03", "AUD-YG-04", "AUD-YG-05"],
    "AUD-YG-12": ["AUD-YG-02", "AUD-YG-07", "AUD-YG-08", "AUD-YG-10"],
    "AUD-YG-13": ["AUD-YG-01", "AUD-YG-05", "AUD-YG-12"],
    "AUD-YG-14": ["AUD-YG-09"],
    "AUD-YG-15": ["AUD-YG-06", "AUD-YG-07", "AUD-YG-08", "AUD-YG-09", "AUD-YG-10", "AUD-YG-11", "AUD-YG-12", "AUD-YG-13", "AUD-YG-14"],
    "AUD-YG-16": ["AUD-YG-15"], "AUD-YG-17": ["AUD-YG-16"],
    "AUD-YG-18": ["AUD-YG-12", "AUD-YG-15", "AUD-YG-16", "AUD-YG-17"]
  };
  const roleByCategory = {
    process: "Koordinator proses dan data RDTR", geospatial: "Tim geospasial dan wali data",
    analysis: "Tim analisis lintas sektor", mandatory_content: "Tim materi teknis RDTR",
    implementation: "Tim program dan pembiayaan", legal: "Pemerintah daerah/FPR sesuai kewenangan",
    governance: "Pimpinan dan reviewer internal YG"
  };
  const p0Statuses = new Set(["blocked_external_evidence", "blocked_authority_process", "blocked_internal_approval"]);
  const items = completenessAudit.items.map((row, index) => ({
    id: `GAP-YG-${String(index + 1).padStart(2, "0")}`,
    auditRef: row.id,
    component: row.component,
    category: row.category,
    priority: p0Statuses.has(row.status) ? "P0" : row.status === "partial_internal" ? "P1" : "P2",
    status: "not_started",
    gap: row.gap,
    action: `Penuhi dan verifikasi: ${row.completionGate}`,
    acceptanceCriteria: row.completionGate,
    regulationRefs: row.regulationRefs,
    outputRefs: row.outputRefs,
    dependencies: dependencies[row.id] || [],
    ownerRole: roleByCategory[row.category] || "Koordinator RDTR",
    assignedTo: null,
    dueDate: null,
    evidenceReceipt: { receivedAt: null, receivedFrom: null, fileRef: null, checksum: null, reviewedBy: null, reviewDate: null, decision: null, notes: null }
  }));
  return {
    id: "RDTR-YG-GAP-CLOSURE-WORKPLAN-V0.1",
    version: "0.1.0-internal",
    access: "staff_only",
    status: "not_started_assignments_and_evidence_pending",
    totalItems: items.length,
    prioritySummary: ["P0", "P1", "P2"].map(priority => ({ priority, count: items.filter(row => row.priority === priority).length })),
    items,
    criticalPath: ["AUD-YG-01", "AUD-YG-02", "AUD-YG-03", "AUD-YG-05", "AUD-YG-04", "AUD-YG-06", "AUD-YG-07", "AUD-YG-08", "AUD-YG-10", "AUD-YG-12", "AUD-YG-13", "AUD-YG-15", "AUD-YG-16", "AUD-YG-17", "AUD-YG-18"],
    completionRule: "Pekerjaan hanya dapat ditutup setelah kriteria penerimaan dipenuhi, bukti penerimaan tercatat, dan reviewer yang berwenang memberi keputusan nyata.",
    disclaimer: "Rencana kerja internal ini tidak membuktikan dokumen eksternal tersedia dan tidak menggantikan tahapan atau keputusan pihak berwenang."
  };
}

function buildV1ReleaseDossier(completenessAudit, gapClosureWorkplan) {
  const validationChecks = [
    { id: "VAL-01", label: "Keaslian dan kewenangan sumber", rule: "Identitas penerbit, kewenangan, tanggal, versi, dan kanal penerimaan dapat dibuktikan." },
    { id: "VAL-02", label: "Cakupan dan relevansi", rule: "Bukti mencakup WP, tema, periode, skala, dan objek keputusan yang dinilai." },
    { id: "VAL-03", label: "Integritas berkas", rule: "Nama berkas, checksum, format, CRS, metadata, dan batas penggunaan tercatat." },
    { id: "VAL-04", label: "Kualitas spasial dan numerik", rule: "Topologi, ketelitian, satuan, kelengkapan atribut, dan konsistensi angka lulus pemeriksaan." },
    { id: "VAL-05", label: "Konsistensi regulasi dan hierarki", rule: "Temuan dapat dilacak ke ketentuan, RTRW/KLHS, analisis, peta, aturan, dan program terkait." },
    { id: "VAL-06", label: "Jejak keputusan", rule: "Reviewer, tanggal, keputusan, perubahan, pengecualian, dan alasan tersimpan tanpa menghapus versi sebelumnya." }
  ];
  const evidenceRequests = gapClosureWorkplan.items.map(row => ({
    id: `REQ-${row.id}`,
    workItemRef: row.id,
    auditRef: row.auditRef,
    priority: row.priority,
    requestedEvidence: row.acceptanceCriteria,
    requestedFromRole: row.ownerRole,
    requestSentAt: null,
    requestReference: null,
    receivedAt: null,
    receivedFileRef: null,
    validationCheckRefs: validationChecks.map(check => check.id),
    validationStatus: "not_started",
    acceptedForUse: false,
    reviewer: null,
    reviewDate: null,
    rejectionReason: null
  }));
  const releaseGates = completenessAudit.releaseGates.map(gate => ({
    ...gate,
    decision: "hold",
    decidedBy: null,
    decisionDate: null,
    evidenceRefs: [],
    note: "Belum dapat diluluskan karena bukti dan/atau persetujuan yang disyaratkan belum tercatat."
  }));
  return {
    id: "RDTR-YG-V1-RELEASE-DOSSIER-RC1",
    version: "0.18.0-internal-release-candidate",
    targetVersion: "1.0.0",
    access: "staff_only",
    releaseDecision: "hold_not_ready_for_publication",
    publicationAuthorized: false,
    validationChecks,
    evidenceRequests,
    releaseGates,
    unresolvedComponentCount: completenessAudit.items.filter(row => row.legalCompleteness !== "complete").length,
    openWorkItemCount: gapClosureWorkplan.items.filter(row => row.status !== "completed").length,
    acceptedEvidenceCount: evidenceRequests.filter(row => row.acceptedForUse).length,
    finalApproval: { approved: false, approvedBy: null, approvedAt: null, decisionReference: null },
    promotionRule: "Target v1.0 hanya boleh dipromosikan setelah semua pekerjaan selesai, seluruh gerbang rilis berstatus completed, bukti dapat diaudit, dan persetujuan final YG tercatat.",
    disclaimer: "Dossier ini adalah kandidat final internal. Nomor target v1.0 bukan pernyataan bahwa RDTR telah ditetapkan, disahkan, atau siap dipublikasikan."
  };
}

function buildExistingEvidenceReconciliation(completenessAudit) {
  const statusMap = {
    available_internal_provisional: "available_internal_screening",
    partial_internal: "partial_internal_screening",
    blocked_external_evidence: "official_or_external_evidence_missing",
    blocked_authority_process: "authority_process_evidence_missing",
    blocked_internal_approval: "internal_approval_missing"
  };
  const items = completenessAudit.items.map(row => ({
    id: `REC-${row.id}`,
    auditRef: row.id,
    component: row.component,
    reconciliationStatus: statusMap[row.status] || "not_assessed",
    availableArtifactRefs: row.outputRefs,
    availableStatement: row.available,
    permittedUse: row.outputRefs.length ? "internal_screening_and_consultation_argument_only" : "gap_tracking_only",
    cannotProve: row.gap,
    completionEvidenceRequired: row.completionGate,
    legalCompletenessChanged: false,
    publicationEligibilityChanged: false,
    reconciledBy: "system_rule",
    humanReviewedBy: null,
    humanReviewDate: null
  }));
  const statusOrder = ["available_internal_screening", "partial_internal_screening", "official_or_external_evidence_missing", "authority_process_evidence_missing", "internal_approval_missing"];
  return {
    id: "RDTR-YG-EXISTING-EVIDENCE-RECONCILIATION-V0.1",
    version: "0.1.0-internal",
    access: "staff_only",
    status: "reconciled_without_legal_promotion",
    totalItems: items.length,
    statusSummary: statusOrder.map(status => ({ status, count: items.filter(row => row.reconciliationStatus === status).length })),
    items,
    usableInternalArtifactCount: items.filter(row => row.availableArtifactRefs.length).length,
    legalPromotionCount: 0,
    rule: "Keluaran internal yang ditemukan hanya direkonsiliasi sebagai bahan penyaringan atau argumentasi; tidak dihitung sebagai pemenuhan bukti legal tanpa validasi dan keputusan manusia.",
    disclaimer: "Rekonsiliasi ini tidak menyatakan dokumen eksternal tidak ada; status hanya menggambarkan bukti yang saat ini tercatat dalam paket analisis YG."
  };
}

function buildEvidenceRequestBriefing(completenessAudit) {
  const recipientRoles = {
    "AUD-YG-01": "Pemerintah Kabupaten Rokan Hilir/Bappeda dan perangkat daerah penataan ruang",
    "AUD-YG-02": "Unit geospasial pemerintah daerah dan instansi pembina informasi geospasial",
    "AUD-YG-05": "Tim penyusun dan penjaminan mutu KLHS serta perangkat daerah lingkungan hidup",
    "AUD-YG-15": "Pemerintah Kabupaten Rokan Hilir dan unit penyusun produk hukum daerah",
    "AUD-YG-16": "Forum Penataan Ruang dan instansi persetujuan substansi sesuai kewenangan",
    "AUD-YG-17": "Pejabat pembentuk, penetap, dan pengundang produk hukum daerah",
    "AUD-YG-18": "Pimpinan dan reviewer internal Yayasan Gambut"
  };
  const blocked = new Set(["blocked_external_evidence", "blocked_authority_process", "blocked_internal_approval"]);
  const items = completenessAudit.items.filter(row => blocked.has(row.status)).map((row, index) => ({
    id: `BRF-YG-${String(index + 1).padStart(2, "0")}`,
    auditRef: row.id,
    subject: `Permintaan konfirmasi dan bukti: ${row.component}`,
    recipientRole: recipientRoles[row.id],
    recipientName: null,
    recipientContact: null,
    purpose: `Memastikan ${row.component.toLowerCase()} dapat diuji terhadap ketentuan dan tidak hanya diasumsikan dari keluaran internal YG.`,
    context: row.gap,
    requestedEvidence: row.completionGate,
    regulationRefs: row.regulationRefs,
    consultationQuestion: `Mohon dijelaskan status ${row.component.toLowerCase()}, dasar keputusan, versi bukti yang berlaku, pihak berwenang, serta bagaimana hasilnya diterapkan pada peta, aturan, atau proses RDTR.`,
    responseStandard: "Jawaban tertulis atau tercatat, menyebut versi/tanggal/penerbit, melampirkan atau menunjuk bukti yang dapat diverifikasi, dan menjelaskan tindak lanjut serta tenggat bila belum tersedia.",
    sensitivity: row.id === "AUD-YG-18" ? "internal_confidential" : "controlled_consultation_use",
    approvalBeforeSend: true,
    approvedBy: null,
    approvedAt: null,
    sentAt: null,
    sentBy: null,
    deliveryReference: null,
    responseReceivedAt: null,
    responseEvidenceRefs: [],
    status: "draft_not_sent"
  }));
  return {
    id: "RDTR-YG-EVIDENCE-REQUEST-BRIEFING-V0.1",
    version: "0.1.0-internal",
    access: "staff_only",
    status: "drafts_ready_approval_and_delivery_pending",
    totalBriefs: items.length,
    items,
    sendRule: "Setiap permintaan harus diperiksa, disetujui, diberi penerima nyata, dan dikirim oleh personel YG yang berwenang; sistem tidak menganggap draft sebagai permintaan yang telah dikirim.",
    responseRule: "Respons tidak otomatis diterima sebagai bukti; seluruh bukti harus melewati enam pemeriksaan validasi dalam dossier rilis v1.",
    disclaimer: "Paket ini adalah bahan internal untuk konsultasi dan korespondensi. Tidak ada surat atau pesan yang telah dikirim oleh sistem."
  };
}

function buildResponseChangeControlLedger(evidenceRequestBriefing) {
  const entries = evidenceRequestBriefing.items.map((brief, index) => ({
    id: `CHG-YG-${String(index + 1).padStart(2, "0")}`,
    briefingRef: brief.id,
    auditRef: brief.auditRef,
    subject: brief.subject,
    responseStatus: "awaiting_approved_request",
    responseReceivedAt: null,
    respondentNameAndRole: null,
    responseSummary: null,
    evidenceRefs: [],
    validationDecision: "not_reviewed",
    validationNotes: null,
    impactAssessment: {
      objective: false,
      structurePlan: false,
      spatialPattern: false,
      zoningRules: false,
      programme: false,
      mapGeometry: false,
      legalDraft: false,
      consultationPosition: false,
      impactNotes: null
    },
    proposedDisposition: null,
    proposedChangeRefs: [],
    geometryBeforeRef: null,
    geometryAfterRef: null,
    numericDifferenceSummary: null,
    technicalReviewer: null,
    legalReviewer: null,
    approvedBy: null,
    approvedAt: null,
    implementationStatus: "not_started",
    implementationCommitRef: null,
    verificationStatus: "not_started",
    closedAt: null
  }));
  return {
    id: "RDTR-YG-RESPONSE-CHANGE-CONTROL-V0.1",
    version: "0.1.0-internal",
    access: "staff_only",
    status: "ledger_ready_no_responses_received",
    totalEntries: entries.length,
    entries,
    permittedDispositions: ["accept", "accept_with_conditions", "request_clarification", "reject_with_reason", "defer_pending_evidence"],
    changeSequence: ["receive", "validate", "assess_impact", "propose", "technical_and_legal_review", "approve", "implement", "verify", "close"],
    geometryRule: "Geometri hanya boleh berubah melalui versi before/after, ringkasan perbedaan numerik, review teknis-hukum, persetujuan, commit, dan verifikasi.",
    decisionRule: "Respons atau dokumen yang diterima tidak otomatis mengubah posisi YG, geometri, aturan, program, atau status kelengkapan.",
    disclaimer: "Ledger masih kosong dari respons nyata. Seluruh identitas, bukti, keputusan, dan perubahan harus berasal dari kejadian yang dapat diverifikasi."
  };
}

function buildV1PromotionValidator({ completenessAudit, gapClosureWorkplan, v1ReleaseDossier, evidenceRequestBriefing, responseChangeControlLedger }) {
  const checks = [
    { id: "PRO-01", label: "Semua komponen lengkap secara hukum", passed: completenessAudit.items.every(row => row.legalCompleteness === "complete"), evidence: `${completenessAudit.items.filter(row => row.legalCompleteness === "complete").length}/${completenessAudit.totalComponents}` },
    { id: "PRO-02", label: "Semua pekerjaan penutupan gap selesai", passed: gapClosureWorkplan.items.every(row => row.status === "completed"), evidence: `${gapClosureWorkplan.items.filter(row => row.status === "completed").length}/${gapClosureWorkplan.totalItems}` },
    { id: "PRO-03", label: "Seluruh bukti diminta, diterima, dan diterima untuk digunakan", passed: v1ReleaseDossier.evidenceRequests.every(row => row.requestSentAt && row.receivedAt && row.acceptedForUse), evidence: `${v1ReleaseDossier.evidenceRequests.filter(row => row.acceptedForUse).length}/${v1ReleaseDossier.evidenceRequests.length}` },
    { id: "PRO-04", label: "Paket permintaan memiliki persetujuan dan jejak pengiriman", passed: evidenceRequestBriefing.items.every(row => row.approvedAt && row.sentAt && row.deliveryReference), evidence: `${evidenceRequestBriefing.items.filter(row => row.sentAt && row.deliveryReference).length}/${evidenceRequestBriefing.totalBriefs}` },
    { id: "PRO-05", label: "Respons dan perubahan telah ditutup", passed: responseChangeControlLedger.entries.every(row => row.closedAt && row.verificationStatus === "verified"), evidence: `${responseChangeControlLedger.entries.filter(row => row.closedAt && row.verificationStatus === "verified").length}/${responseChangeControlLedger.totalEntries}` },
    { id: "PRO-06", label: "Semua gerbang rilis selesai", passed: v1ReleaseDossier.releaseGates.every(row => row.status === "completed" && row.decision === "pass"), evidence: `${v1ReleaseDossier.releaseGates.filter(row => row.status === "completed" && row.decision === "pass").length}/${v1ReleaseDossier.releaseGates.length}` },
    { id: "PRO-07", label: "Persetujuan final YG tercatat", passed: v1ReleaseDossier.finalApproval.approved === true && Boolean(v1ReleaseDossier.finalApproval.approvedBy && v1ReleaseDossier.finalApproval.approvedAt), evidence: v1ReleaseDossier.finalApproval.approved ? "tercatat" : "belum tercatat" },
    { id: "PRO-08", label: "Seluruh komponen layak publikasi", passed: completenessAudit.items.every(row => row.publicationEligible === true), evidence: `${completenessAudit.items.filter(row => row.publicationEligible === true).length}/${completenessAudit.totalComponents}` }
  ];
  const blockers = checks.filter(check => !check.passed).map(check => ({ checkRef: check.id, blocker: check.label, currentEvidence: check.evidence }));
  const promotionEligible = checks.every(check => check.passed);
  return {
    id: "RDTR-YG-V1-PROMOTION-VALIDATOR-V0.1",
    version: "0.1.0-internal",
    access: "staff_only",
    targetVersion: "1.0.0",
    promotionEligible,
    decision: promotionEligible ? "eligible_pending_controlled_release" : "blocked_fail_closed",
    checks,
    blockers,
    passedCheckCount: checks.filter(check => check.passed).length,
    totalCheckCount: checks.length,
    evaluatedBy: "deterministic_system_rules",
    humanOverrideAllowed: false,
    rule: "Versi v1.0 tidak boleh dipromosikan bila satu saja pemeriksaan gagal. Validator tidak menyediakan override manusia untuk melewati bukti atau proses yang belum selesai.",
    disclaimer: "Lulus validator merupakan syarat teknis internal, bukan pengesahan RDTR oleh pemerintah atau pembentukan akibat hukum."
  };
}

function buildFieldVerificationPlan(serviceAccessAnalysis) {
  const themes = [
    { id: "FLD-01", theme: "Penggunaan lahan dan bangunan", required: "Jejak/poligon penggunaan aktual, fungsi bangunan, intensitas, kondisi, kekosongan, serta perubahan terkini." },
    { id: "FLD-02", theme: "Jalan, akses, dan evakuasi", required: "Kondisi, lebar efektif, hambatan, konektivitas, waktu tempuh, akses darurat, titik putus, dan jalur evakuasi." },
    { id: "FLD-03", theme: "Fasilitas dan kapasitas layanan", required: "Lokasi, jenis, kapasitas, cakupan, kondisi, operasi, kelompok pengguna, dan kesenjangan layanan." },
    { id: "FLD-04", theme: "Drainase, sungai, kanal, dan pasang-surut", required: "Arah aliran, dimensi, kondisi, sumbatan, pompa/pintu air, genangan, koneksi pasut, dan tanggung jawab pemeliharaan." },
    { id: "FLD-05", theme: "Rob, banjir, abrasi, kebakaran, dan subsidensi", required: "Lokasi kejadian, tinggi/kedalaman, durasi, frekuensi, tanggal, dampak, sumber kesaksian, dan bukti visual/ukur." },
    { id: "FLD-06", theme: "Gambut, tanah, elevasi, dan tata air", required: "Indikasi material, kedalaman bila diukur sah, muka air, elevasi, kondisi hidrologis, penggunaan, dan gangguan." },
    { id: "FLD-07", theme: "Mangrove, pesisir, perikanan, dan akses publik", required: "Kondisi ekosistem, dinamika garis pantai, ruang tangkap/tambat, jalur akses, pemanfaatan, tekanan, dan pemulihan." },
    { id: "FLD-08", theme: "Tenurial, izin, konflik, dan persetujuan", required: "Jenis klaim/hak/izin, bukti yang ditunjukkan, pihak terkait, lokasi, status verifikasi, konflik, dan persetujuan." },
    { id: "FLD-09", theme: "Penghidupan, kelompok rentan, budaya, dan ruang hidup", required: "Aktivitas, lokasi penting, ketergantungan, musim, perempuan/pemuda/kelompok rentan, nilai budaya, dan risiko pengalihan." },
    { id: "FLD-10", theme: "Usulan masyarakat dan alternatif", required: "Masalah, lokasi, pilihan perlindungan/pengembangan, manfaat, risiko, pihak terdampak, syarat, dan alternatif yang ditolak." }
  ];
  const packages = serviceAccessAnalysis.villageMatrix.map((row, index) => ({
    id: `SVY-YG-${String(index + 1).padStart(2, "0")}`,
    village: row.village,
    evidencePriority: row.evidenceCheckPriority,
    screeningContext: {
      facilityFeatureCount: row.facilityFeatureCount,
      criticalFacilityCount: row.criticalFacilityCount,
      roadFeatureCount: row.roadFeatureCount,
      hydrologyFeatureCount: row.hydrologyFeatureCount,
      priorityReasons: row.priorityReasons
    },
    themeRefs: themes.map(theme => theme.id),
    plannedSurveySites: [],
    plannedTransects: [],
    respondentGroups: [],
    assignedTeam: [],
    plannedDate: null,
    consentProtocolConfirmed: false,
    safetyBriefingConfirmed: false,
    fieldworkStatus: "not_planned",
    evidenceReceived: [],
    reviewedBy: null,
    reviewDate: null,
    acceptedForAnalysis: false
  }));
  return {
    id: "RDTR-YG-FIELD-VERIFICATION-PLAN-V0.1",
    version: "0.1.0-internal",
    access: "staff_only",
    status: "templates_ready_sites_team_dates_and_consent_pending",
    totalVillages: packages.length,
    themes,
    packages,
    minimumEvidenceRule: "Setiap catatan wajib memiliki tanggal, lokasi, metode, pencatat, sumber/konteks, tingkat ketelitian, persetujuan bila relevan, serta foto/ukur/dokumen pendukung; ketiadaan temuan tidak boleh disamakan dengan ketiadaan objek.",
    privacyRule: "Identitas personal, konflik, klaim tenurial, dan informasi kelompok rentan dipisahkan dari ekspor umum serta hanya digunakan sesuai persetujuan dan kebutuhan analisis.",
    geometryRule: "Titik, lintasan, dan poligon hasil lapangan tetap berstatus bukti survei sampai QA geospasial dan review substansi selesai; tidak otomatis menjadi batas zona.",
    disclaimer: "Rencana ini belum menetapkan lokasi sampel, responden, petugas, jadwal, atau hasil lapangan."
  };
}

function buildFieldObservationSchema(fieldVerificationPlan) {
  const fields = [
    ["observationId", "text", true, "ID stabil unik; tidak digunakan ulang"], ["surveyPackageRef", "text", true, "Referensi SVY-YG"],
    ["village", "text", true, "Nama wilayah sesuai paket"], ["themeRef", "enum", true, "Referensi FLD-01 sampai FLD-10"],
    ["observedAt", "datetime", true, "Waktu pengamatan aktual"], ["observerRole", "text", true, "Peran pencatat tanpa memaksa data personal"],
    ["method", "enum", true, "observation/interview/measurement/document/photo/track"], ["geometryType", "enum", true, "Point/LineString/Polygon/None"],
    ["longitude", "number", false, "WGS84; hanya untuk titik"], ["latitude", "number", false, "WGS84; hanya untuk titik"],
    ["horizontalAccuracyM", "number", false, "Ketelitian perangkat/metode dalam meter"], ["finding", "text", true, "Temuan faktual, bukan kesimpulan zonasi"],
    ["measuredValue", "number", false, "Nilai ukur bila ada"], ["unit", "text", false, "Satuan nilai ukur"],
    ["sourceOrRespondentRole", "text", false, "Peran sumber; nama pribadi dipisahkan"], ["consentStatus", "enum", true, "not_applicable/requested/granted/declined"],
    ["sensitivity", "enum", true, "standard/restricted/confidential"], ["photoRefs", "array", false, "Referensi foto; bukan data biner"],
    ["documentRefs", "array", false, "Referensi dokumen pendukung"], ["notes", "text", false, "Keterbatasan/konteks tambahan"],
    ["qaStatus", "enum", true, "not_reviewed/needs_correction/accepted/rejected"], ["reviewedBy", "text", false, "Reviewer nyata"],
    ["reviewDate", "date", false, "Tanggal review"], ["acceptedForAnalysis", "boolean", true, "Default false sampai QA selesai"]
  ].map(([name, type, required, description]) => ({ name, type, required, description }));
  const blankRecord = Object.fromEntries(fields.map(field => [field.name,
    field.name === "acceptedForAnalysis" ? false : ["photoRefs", "documentRefs"].includes(field.name) ? [] : field.name === "qaStatus" ? "not_reviewed" : null
  ]));
  return {
    id: "RDTR-YG-FIELD-OBSERVATION-SCHEMA-V0.1",
    version: "0.1.0-internal",
    access: "staff_only",
    status: "blank_schema_ready_no_observations",
    surveyPackageRefs: fieldVerificationPlan.packages.map(row => row.id),
    themeRefs: fieldVerificationPlan.themes.map(row => row.id),
    fields,
    allowedMethods: ["observation", "interview", "measurement", "document", "photo", "track"],
    allowedGeometryTypes: ["Point", "LineString", "Polygon", "None"],
    blankRecord,
    emptyGeoJson: { type: "FeatureCollection", name: "Observasi lapangan RDTR YG — template kosong", features: [], metadata: { access: "staff_only", schemaRef: "RDTR-YG-FIELD-OBSERVATION-SCHEMA-V0.1", observationCount: 0, legalEffect: "none" } },
    validationRules: [
      "observationId wajib unik dan stabil.", "surveyPackageRef dan themeRef harus terdapat dalam register.",
      "Koordinat harus WGS84 dan berada pada wilayah kajian bila geometryType bukan None.", "Temuan wajib memisahkan observasi, kesaksian, pengukuran, dan interpretasi.",
      "Data restricted/confidential tidak boleh masuk ekspor umum.", "acceptedForAnalysis hanya true setelah qaStatus accepted dan reviewer/tanggal terisi."
    ],
    disclaimer: "Schema dan template masih kosong; tidak ada observasi, koordinat, responden, foto, dokumen, atau hasil QA yang dibuat oleh sistem."
  };
}

function villageRegulatoryAssessments(metrics) {
  const rows = [{
    theme: "Konsistensi RTR", decision: "verify", regulations: ["R01", "R02", "L01", "L02"],
    finding: `Arahan RTRW terluas: ${metrics.rtrwCoverage[0]?.name || "belum terklasifikasi"}.`,
    position: "Bandingkan geometri zona RDTR dengan RTRW provinsi dan kabupaten yang sah; dokumentasikan perbedaan skala dan dasar perubahan."
  }];
  if (metrics.peatCoveragePct >= 70) rows.push({
    theme: "Ekosistem gambut", decision: "hold", regulations: ["R05", "R10", "R11"],
    finding: `${metrics.peatCoveragePct}% atau ${metrics.peatAreaHa.toLocaleString("id-ID")} ha terindikasi gambut.`,
    position: "Tahan intensifikasi sampai fungsi KHG, kedalaman, kubah, hidrologi, subsidensi, kebakaran, dan ketentuan pengelolaannya tervalidasi."
  }); else if (metrics.peatCoveragePct > 0) rows.push({
    theme: "Ekosistem gambut", decision: "conditional", regulations: ["R05", "R10", "R11"],
    finding: `${metrics.peatCoveragePct}% atau ${metrics.peatAreaHa.toLocaleString("id-ID")} ha terindikasi gambut.`,
    position: "Perbolehkan hanya setelah fungsi dan hidrologi diverifikasi serta syarat perlindungan dimasukkan dalam ketentuan zonasi."
  });
  if (metrics.forestCoveragePct >= 40) rows.push({
    theme: "Kawasan hutan", decision: "hold", regulations: ["R14", "L01", "L02"],
    finding: `${metrics.forestCoveragePct}% atau ${metrics.forestAreaHa.toLocaleString("id-ID")} ha terindikasi non-APL.`,
    position: "Tahan arahan non-kehutanan sampai status kawasan, fungsi, riwayat perubahan, persetujuan, dan kewenangan dipastikan."
  }); else if (metrics.forestCoveragePct > 0) rows.push({
    theme: "Kawasan hutan", decision: "verify", regulations: ["R14", "L01", "L02"],
    finding: `${metrics.forestCoveragePct}% atau ${metrics.forestAreaHa.toLocaleString("id-ID")} ha terindikasi non-APL.`,
    position: "Uji objek yang beririsan; RDTR tidak mengubah status kawasan hutan secara otomatis."
  });
  if (metrics.mangrove.status === "analysed") rows.push({
    theme: "Pesisir dan mangrove", decision: metrics.mangrove.indicativeMangroveLossHa > 25 ? "hold" : "conditional", regulations: ["R10", "R12", "R13"],
    finding: `Mangrove tersisa ${metrics.mangrove.currentMangroveHa || 0} ha; kehilangan indikatif ${metrics.mangrove.indicativeMangroveLossHa || 0} ha.`,
    position: "Lindungi mangrove dan konektivitas pasang-surut; sempadan serta intensitas ditetapkan dari kajian hidro-oseanografi, risiko, dan ruang hidup."
  }); else rows.push({
    theme: "Pesisir dan mangrove", decision: "verify", regulations: ["R10", "R12", "R13"],
    finding: "Analisis mangrove dan dinamika pesisir belum tersedia untuk wilayah ini.",
    position: "Jangan menyimpulkan aman untuk intensifikasi pesisir sebelum kondisi mangrove, abrasi, rob, pasut, dan akses masyarakat diverifikasi."
  });
  rows.push({
    theme: "KLHS", decision: metrics.peatCoveragePct >= 70 || metrics.forestCoveragePct >= 40 ? "hold" : "verify", regulations: ["R05", "R09", "R10"],
    finding: "Belum ada matriks yang menunjukkan integrasi rekomendasi KLHS ke zona dan aturan wilayah ini.",
    position: "Minta bukti perubahan geometri/pasal/program akibat KLHS, termasuk alternatif yang ditolak dan alasannya."
  });
  return rows;
}

function readJson(file, label) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    throw new Error(`${label} tidak dapat dibaca: ${error.message}`);
  }
}

function readOptionalJson(file) {
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : featureCollection([]);
}

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/^(kelurahan|kepenghuluan|desa)\s+/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function boxesOverlap(left, right) {
  return left[0] <= right[2] && left[2] >= right[0] &&
    left[1] <= right[3] && left[3] >= right[1];
}

function safeIntersection(left, right, warnings, label) {
  try {
    return intersect(featureCollection([left, right]));
  } catch (error) {
    warnings.add(`${label}: ${error.message}`);
    return null;
  }
}

function areaHa(feature) {
  return feature ? area(feature) / 10000 : 0;
}

function round(value, digits = 2) {
  const power = 10 ** digits;
  return Math.round((Number(value) || 0) * power) / power;
}

function clippedFeatures(features, mask, pickProperties, warnings, label) {
  const maskBox = bbox(mask);
  const clipped = [];
  for (const feature of features || []) {
    if (!feature?.geometry || !boxesOverlap(maskBox, bbox(feature))) continue;
    const overlap = safeIntersection(feature, mask, warnings, label);
    if (!overlap || areaHa(overlap) < 0.01) continue;
    const display = simplify(overlap, {
      tolerance: 0.00002,
      highQuality: false,
      mutate: false
    });
    display.properties = pickProperties(feature.properties || {});
    clipped.push(display);
  }
  return clipped;
}

function requiredUnion(features, label) {
  const usable = (features || []).filter(feature => feature?.geometry);
  if (!usable.length) return null;
  if (usable.length === 1) return JSON.parse(JSON.stringify(usable[0]));
  try {
    return union(featureCollection(usable));
  } catch (error) {
    throw new Error(`${label} gagal digabungkan: ${error.message}`);
  }
}

function requiredDifference(left, right, label) {
  if (!left?.geometry) return null;
  if (!right?.geometry) return JSON.parse(JSON.stringify(left));
  try {
    return difference(featureCollection([left, right]));
  } catch (error) {
    throw new Error(`${label} gagal dipisahkan tanpa tumpang tindih: ${error.message}`);
  }
}

function rtrwZoneSpec(className, index) {
  const name = String(className || "Arahan belum terklasifikasi").trim();
  if (/lindung|sempadan|suaka|konservasi|mangrove|hutan/i.test(name)) return {
    id: `ZYG-RTRW-L-${index + 1}`,
    code: "YG-ZL-RTRW",
    name: `Penyelarasan kawasan lindung · ${name}`,
    zoneFamily: "higher_plan_protection_alignment",
    patternCategory: "protected_candidate",
    role: "candidate_higher_plan_protection_alignment",
    decision: "verify",
    color: "#496d9e",
    direction: "Pertahankan arahan perlindungan dari rencana tingkat provinsi sambil memverifikasi rincian fungsi, batas, dan hubungannya dengan RTRW Kabupaten Rokan Hilir."
  };
  if (/permukiman|perkotaan|perdagangan|jasa|industri|perkantoran|pariwisata/i.test(name)) return {
    id: `ZYG-RTRW-U-${index + 1}`,
    code: "YG-ZK",
    name: `Konsolidasi perkotaan bersyarat · ${name}`,
    zoneFamily: "safe_urban_consolidation",
    patternCategory: "cultivation_candidate",
    role: "candidate_safe_urban_consolidation",
    decision: "conditional",
    color: "#c56a24",
    direction: "Konsolidasikan kegiatan perkotaan hanya pada lokasi yang terbukti aman, telah terbangun atau dibutuhkan, dapat dilayani, dan tidak menambah beban hidrologi maupun risiko."
  };
  if (/pertanian|perkebunan|perikanan|tambak|budidaya|produksi/i.test(name)) return {
    id: `ZYG-RTRW-P-${index + 1}`,
    code: "YG-ZP",
    name: `Penghidupan dan produksi bersyarat · ${name}`,
    zoneFamily: "community_livelihood_and_production",
    patternCategory: "cultivation_candidate",
    role: "candidate_community_livelihood_and_production",
    decision: "conditional",
    color: "#8c7a2e",
    direction: "Pertahankan ruang penghidupan dan produksi yang sesuai dengan syarat perlindungan ekosistem, keselamatan, tenurial, akses masyarakat, serta kapasitas layanan."
  };
  return {
    id: `ZYG-RTRW-V-${index + 1}`,
    code: "YG-ZV",
    name: `Verifikasi fungsi ruang · ${name}`,
    zoneFamily: "function_pending_verification",
    patternCategory: "verification_candidate",
    role: "candidate_function_pending_verification",
    decision: "verify",
    color: "#637b73",
    direction: "Tahan penetapan fungsi rinci sampai penggunaan lahan, kebutuhan ruang, layanan, bahaya, tenurial, dan arahan RTRW kabupaten dapat dibuktikan."
  };
}

function buildYgCandidateZoning({ studyArea, rtrwMap, peatMap, forestMap, mangroveCandidateMap }) {
  const zones = [];
  let allocated = null;
  const studyAreaHa = areaHa(studyArea);
  const coastSource = requiredUnion(mangroveCandidateMap, "Kandidat pesisir");
  const peatSource = requiredUnion(peatMap, "Indikasi gambut");
  const forestSource = requiredUnion(forestMap, "Indikasi non-APL");
  function allocate(source, spec, sourceBasis, regulationRefs, accumulate = true) {
    if (!source?.geometry) return;
    const available = allocated ? requiredDifference(source, allocated, spec.id) : source;
    if (!available?.geometry || areaHa(available) < 0.01) return;
    const hectares = areaHa(available);
    available.properties = {
      id: spec.id,
      code: spec.code,
      name: spec.name,
      zoneFamily: spec.zoneFamily,
      patternCategory: spec.patternCategory,
      role: spec.role,
      decision: spec.decision,
      direction: spec.direction,
      color: spec.color,
      areaHa: round(hectares),
      sharePct: round(hectares / studyAreaHa * 100, 2),
      sourceBasis,
      regulationRefs: regulationRefs.join(" | "),
      maturity: "provisional_internal_zone_geometry",
      geometryStatus: "yg_analytical_zoning_not_official_rdtr",
      legalEffect: "none"
    };
    zones.push(available);
    if (accumulate) allocated = requiredUnion([allocated, available], `Akumulasi ${spec.id}`);
  }

  allocate(coastSource, {
    id: "ZYG-COAST", code: "YG-ZLP", name: "Perlindungan dan pemulihan pesisir–mangrove",
    zoneFamily: "coastal_mangrove_protection", patternCategory: "protected_candidate",
    role: "candidate_coastal_mangrove_river_protection", decision: "hold", color: "#176c8c",
    direction: "Lindungi mangrove, konektivitas pasang-surut, akses masyarakat, dan kandidat pemulihan; lokasi tindakan tetap memerlukan verifikasi hidrodinamika, substrat, salinitas, tenurial, serta persetujuan masyarakat."
  }, "Analisis prioritas rehabilitasi mangrove YG 2016–2025 v0.1", ["R05", "R09", "R10", "R12", "R13"]);

  allocate(peatSource, {
    id: "ZYG-PEAT", code: "YG-ZPG", name: "Pengelolaan dan perlindungan hidrologi gambut",
    zoneFamily: "peat_hydrology_management", patternCategory: "protected_candidate",
    role: "candidate_peat_ecosystem_protection_or_management", decision: "hold", color: "#8b3a72",
    direction: "Tahan peningkatan intensitas dan pengeringan; bedakan perlindungan, pemulihan, dan pemanfaatan terbatas setelah fungsi KHG, kubah, kedalaman, hidrologi, subsidensi, serta kebakaran terverifikasi."
  }, "Gambut BBSDLP 2019 sebagai indikasi penyaringan", ["R05", "R09", "R10", "R11"]);

  allocate(forestSource, {
    id: "ZYG-FOREST", code: "YG-ZKH", name: "Penyelarasan status dan fungsi kawasan hutan",
    zoneFamily: "forest_status_alignment", patternCategory: "verification_candidate",
    role: "candidate_forest_status_alignment", decision: "verify", color: "#287047",
    direction: "Pertahankan keterbacaan status dan fungsi kawasan hutan; rancangan zona YG tidak mengubah status, fungsi, persetujuan penggunaan, pelepasan, atau hak yang berlaku."
  }, "Kawasan hutan SK 903, non-APL, sebagai penyaringan status", ["R01", "R02", "R14", "L02"]);

  const rtrwClasses = [...new Set((rtrwMap || []).map(feature => feature.properties?.class || "Arahan belum terklasifikasi"))].sort();
  rtrwClasses.forEach((className, index) => {
    const source = requiredUnion((rtrwMap || []).filter(feature =>
      (feature.properties?.class || "Arahan belum terklasifikasi") === className
    ), `RTRW provinsi ${className}`);
    const spec = rtrwZoneSpec(className, index);
    allocate(source, spec, `RTRW Provinsi Riau: ${className}`, ["R01", "R02", "R03", "L01", "L02"]);
  });

  const remainder = requiredDifference(studyArea, allocated, "Sisa wilayah kajian");
  allocate(remainder, {
    id: "ZYG-VERIFY", code: "YG-ZV", name: "Verifikasi fungsi ruang dan kebutuhan layanan",
    zoneFamily: "function_pending_verification", patternCategory: "verification_candidate",
    role: "candidate_function_pending_verification", decision: "verify", color: "#637b73",
    direction: "Belum dialokasikan ke fungsi rinci. Lengkapi penggunaan lahan, kependudukan, ekonomi, layanan, bahaya, tenurial, dan survei skala 1:5.000 sebelum menetapkan subzona atau intensitas."
  }, "Sisa wilayah setelah prioritas ekosistem, status kawasan hutan, dan arahan RTRW provinsi", ["R02", "R03", "R04", "R05", "R10", "R15", "L02"], false);

  function overlapHa(zone, source, label) {
    if (!source?.geometry) return 0;
    try {
      return areaHa(intersect(featureCollection([zone, source])));
    } catch (error) {
      throw new Error(`${label} gagal dihitung pada ${zone.properties?.id}: ${error.message}`);
    }
  }
  zones.forEach(zone => {
    const peatConstraintHa = overlapHa(zone, peatSource, "Irisan gambut");
    const forestConstraintHa = overlapHa(zone, forestSource, "Irisan kawasan hutan");
    const coastConstraintHa = overlapHa(zone, coastSource, "Irisan pesisir–mangrove");
    const rtrwClasses = [...new Set((rtrwMap || []).filter(feature => {
      try {
        return areaHa(intersect(featureCollection([zone, feature]))) >= 0.01;
      } catch (error) {
        throw new Error(`Irisan RTRW gagal dihitung pada ${zone.properties?.id}: ${error.message}`);
      }
    }).map(feature => feature.properties?.class).filter(Boolean))].sort();
    const constraintOverlays = [];
    if (peatConstraintHa >= 0.01) constraintOverlays.push("indikasi_gambut");
    if (forestConstraintHa >= 0.01) constraintOverlays.push("indikasi_non_apl");
    if (coastConstraintHa >= 0.01) constraintOverlays.push("kandidat_pesisir_mangrove");
    zone.properties = {
      ...zone.properties,
      peatConstraintHa: round(peatConstraintHa),
      forestConstraintHa: round(forestConstraintHa),
      coastConstraintHa: round(coastConstraintHa),
      constraintOverlays: constraintOverlays.join(" | ") || "belum_terpetakan",
      rtrwProvinceClasses: rtrwClasses.join(" | ") || "belum_terbaca"
    };
  });

  const totalZoneAreaHa = zones.reduce((sum, feature) => sum + areaHa(feature), 0);
  const collection = featureCollection(zones);
  collection.name = "Rancangan zonasi RDTR alternatif YG — Bagansiapiapi v0.2";
  collection.metadata = {
    id: "RDTR-YG-BAGANSIAPIAPI-V0.2",
    version: "0.2.0-internal",
    access: "staff_only",
    status: "provisional_internal_zone_geometry",
    generatedAt: new Date().toISOString(),
    zoneCount: zones.length,
    studyAreaHa: round(studyAreaHa),
    totalZoneAreaHa: round(totalZoneAreaHa),
    coveragePct: round(totalZoneAreaHa / studyAreaHa * 100, 3),
    topologyRule: "Zona dialokasikan berurutan dan saling dikurangkan: pesisir–mangrove, gambut, kawasan hutan, arahan RTRW provinsi, lalu sisa verifikasi.",
    disclaimer: "Rancangan teknis alternatif internal YG; bukan RDTR yang ditetapkan, bukan peta dasar 1:5.000 terotorisasi, bukan penetapan fungsi sektoral, dan bukan dasar KKPR."
  };
  return collection;
}

function buildYgDevelopmentReadiness(candidateZones) {
  const universalEvidenceLocks = [
    "peta_dasar_dan_survei_skala_1_5000",
    "rtrw_kabupaten_rokan_hilir_berlaku",
    "klhs_dan_matriks_integrasi",
    "penggunaan_lahan_dan_bangunan",
    "penduduk_kebutuhan_ruang_dan_kapasitas_layanan",
    "rob_banjir_abrasi_subsidensi_elevasi_dan_kebakaran",
    "hak_izin_tenurial_ruang_hidup_dan_konflik"
  ];
  const features = (candidateZones.features || []).map((zone, index) => {
    const props = zone.properties || {};
    const knownConstraints = String(props.constraintOverlays || "")
      .split(" | ").filter(value => value && value !== "belum_terpetakan");
    const zoneEvidenceLocks = [...universalEvidenceLocks];
    if (props.zoneFamily === "peat_hydrology_management") zoneEvidenceLocks.push("khg_fungsi_kubah_kedalaman_hidrologi_dan_muka_air");
    if (props.zoneFamily === "coastal_mangrove_protection") zoneEvidenceLocks.push("pasut_hidrodinamika_sempadan_mangrove_dan_akses_pesisir");
    if (props.zoneFamily === "forest_status_alignment") zoneEvidenceLocks.push("status_fungsi_kawasan_hutan_dan_persetujuan_sektoral");
    const cultivationCandidate = props.patternCategory === "cultivation_candidate";
    const protectedCandidate = props.patternCategory === "protected_candidate";
    const verificationCandidate = props.patternCategory === "verification_candidate";
    const surveyPriority = cultivationCandidate || knownConstraints.length >= 2 ? "high" : protectedCandidate || verificationCandidate ? "medium" : "standard";
    const promotionDecision = cultivationCandidate
      ? "hold_development_promotion_pending_complete_evidence"
      : protectedCandidate
        ? "retain_protection_direction_and_verify_boundary_rules"
        : "hold_function_assignment_pending_verification";
    return {
      ...zone,
      properties: {
        ...props,
        readinessId: `DR-YG-${String(index + 1).padStart(3, "0")}`,
        developmentReadiness: "not_determined",
        safeForIntensification: "not_demonstrated",
        promotionDecision,
        surveyPriority,
        knownConstraintCount: knownConstraints.length,
        knownConstraints,
        evidenceLockCount: zoneEvidenceLocks.length,
        evidenceLocks: zoneEvidenceLocks,
        hazardEvidenceStatus: "missing_integrated_multi_hazard_model",
        legalEffect: "none"
      }
    };
  });
  const collection = featureCollection(features);
  collection.name = "Uji kesiapan pengembangan zona RDTR YG v0.8";
  collection.metadata = {
    access: "staff_only",
    status: "development_readiness_not_determined",
    method: "Setiap zona diuji terhadap fungsi rancangan, kendala yang telah terpetakan, dan bukti pengunci minimum. Ketiadaan data bahaya tidak diperlakukan sebagai bukti aman.",
    rule: "Tidak ada zona yang dapat dipromosikan menjadi aman atau siap intensifikasi sebelum seluruh bukti pengunci relevan selesai dan tervalidasi.",
    disclaimer: "Prioritas survei mengatur urutan pengumpulan bukti; bukan kelas kesesuaian lahan, kelayakan pembangunan, penetapan zona, atau dasar KKPR."
  };
  return {
    id: "RDTR-YG-DEVELOPMENT-READINESS-V0.1",
    version: "0.1.0-internal",
    status: collection.metadata.status,
    zones: collection,
    prioritySummary: ["high", "medium", "standard"].map(priority => ({
      priority,
      zoneCount: features.filter(feature => feature.properties.surveyPriority === priority).length,
      areaHa: round(features.filter(feature => feature.properties.surveyPriority === priority).reduce((sum, feature) => sum + areaHa(feature), 0))
    })),
    promotionSummary: [...new Set(features.map(feature => feature.properties.promotionDecision))].map(decision => ({
      decision,
      zoneCount: features.filter(feature => feature.properties.promotionDecision === decision).length,
      areaHa: round(features.filter(feature => feature.properties.promotionDecision === decision).reduce((sum, feature) => sum + areaHa(feature), 0))
    })),
    evidenceLocks: universalEvidenceLocks,
    disclaimer: collection.metadata.disclaimer
  };
}

function buildYgZoningCodebook(zoning) {
  const familySpecs = {
    coastal_mangrove_protection: {
      subzones: [
        ["YG-LP-1", "Perlindungan mangrove dan konektivitas pasang-surut"],
        ["YG-LP-2", "Sempadan pantai, sungai, dan muara"],
        ["YG-PR-1", "Pemulihan ekosistem pesisir"]
      ]
    },
    peat_hydrology_management: {
      subzones: [
        ["YG-PG-1", "Perlindungan hidrologi gambut"],
        ["YG-PG-2", "Pemulihan gambut dan tata air"],
        ["YG-PG-3", "Pemanfaatan eksisting terbatas pada gambut"]
      ]
    },
    forest_status_alignment: {
      subzones: [
        ["YG-KH-1", "Penyelarasan fungsi kawasan hutan"],
        ["YG-KH-2", "Antarmuka perhutanan sosial dan akses masyarakat"]
      ]
    },
    safe_urban_consolidation: {
      subzones: [
        ["YG-PK-1", "Permukiman perkotaan terkonsolidasi"],
        ["YG-PK-2", "Pelayanan umum dan sosial"],
        ["YG-PK-3", "Perdagangan dan jasa perkotaan"]
      ]
    },
    community_livelihood_and_production: {
      subzones: [
        ["YG-BD-1", "Penghidupan dan perikanan masyarakat"],
        ["YG-BD-2", "Produksi lokal yang kompatibel"],
        ["YG-BD-3", "Akses dan prasarana ekonomi masyarakat"]
      ]
    },
    higher_plan_protection_alignment: {
      subzones: [["YG-RL-1", "Penyelarasan perlindungan rencana lebih tinggi"]]
    },
    function_pending_verification: {
      subzones: [["YG-VF-1", "Verifikasi fungsi ruang"]]
    }
  };
  const activityCatalog = [
    { id: "ACT-01", group: "perlindungan", name: "Perlindungan, penelitian, dan pemantauan ekosistem" },
    { id: "ACT-02", group: "pemulihan", name: "Rehabilitasi mangrove, gambut, sungai, dan pesisir" },
    { id: "ACT-03", group: "penghidupan", name: "Perikanan tangkap tradisional dan akses masyarakat" },
    { id: "ACT-04", group: "permukiman", name: "Pemeliharaan bangunan dan permukiman eksisting" },
    { id: "ACT-05", group: "permukiman", name: "Permukiman baru atau perluasan kawasan terbangun" },
    { id: "ACT-06", group: "pelayanan", name: "Fasilitas pelayanan umum, sosial, dan kedaruratan" },
    { id: "ACT-07", group: "ekonomi", name: "Perdagangan, jasa, dan usaha skala lingkungan" },
    { id: "ACT-08", group: "ekonomi", name: "Industri, pergudangan, dan logistik berdampak menengah–tinggi" },
    { id: "ACT-09", group: "prasarana", name: "Drainase, jalan, utilitas, dan perlindungan pantai" },
    { id: "ACT-10", group: "larangan_dasar", name: "Pembukaan, penimbunan, kanal, atau pengeringan yang merusak fungsi ekosistem" },
    { id: "ACT-11", group: "persampahan", name: "Pengolahan, penampungan, atau pembuangan limbah dan sampah" },
    { id: "ACT-12", group: "perairan", name: "Pelabuhan, tambatan, dan infrastruktur tepi air" }
  ];
  const familyItbx = {
    coastal_mangrove_protection: ["I", "I", "B", "B", "X", "B", "X", "X", "B", "X", "X", "B"],
    peat_hydrology_management: ["I", "I", "B", "B", "X", "B", "X", "X", "B", "X", "X", "X"],
    forest_status_alignment: ["B", "B", "B", "B", "X", "B", "X", "X", "B", "X", "X", "X"],
    safe_urban_consolidation: ["B", "B", "T", "T", "B", "B", "B", "B", "B", "X", "B", "B"],
    community_livelihood_and_production: ["B", "B", "I", "T", "B", "B", "T", "B", "B", "X", "B", "B"],
    higher_plan_protection_alignment: ["B", "B", "B", "B", "X", "B", "X", "X", "B", "X", "X", "X"],
    function_pending_verification: ["B", "B", "B", "B", "X", "B", "X", "X", "B", "X", "X", "X"]
  };
  const zoneFamilies = [...new Map((zoning.features || []).map(feature => [
    feature.properties?.zoneFamily,
    { zoneFamily: feature.properties?.zoneFamily, zoneCode: feature.properties?.code, zoneName: feature.properties?.name }
  ])).values()].filter(row => row.zoneFamily);
  const subzoneCandidates = zoneFamilies.flatMap(zone =>
    (familySpecs[zone.zoneFamily]?.subzones || [["YG-VF-1", "Verifikasi fungsi ruang"]]).map(([code, name]) => ({
      id: `${zone.zoneCode}-${code}`,
      parentZoneCode: zone.zoneCode,
      parentZoneFamily: zone.zoneFamily,
      code,
      name,
      geometryStatus: "non_geometric_candidate_class",
      promotionGate: "Peta dasar 1:5.000, penggunaan lahan, kondisi bangunan, risiko, kapasitas layanan, tenurial, KLHS, dan verifikasi lapangan."
    }))
  );
  const itbxMatrix = zoneFamilies.flatMap(zone => {
    const classifications = familyItbx[zone.zoneFamily] || familyItbx.function_pending_verification;
    return activityCatalog.map((activity, index) => ({
      id: `${zone.zoneCode}-${activity.id}`,
      zoneCode: zone.zoneCode,
      zoneFamily: zone.zoneFamily,
      activityId: activity.id,
      activity: activity.name,
      classification: classifications[index],
      status: "candidate_internal_not_legal_rule",
      condition: classifications[index] === "I"
        ? "Hanya pada lokasi yang fungsi dan dampaknya telah terverifikasi; tetap tunduk pada ketentuan sektoral."
        : classifications[index] === "T"
          ? "Dibatasi skala, lokasi, kapasitas, waktu, dan dampak kumulatif berdasarkan kajian teknis."
          : classifications[index] === "B"
            ? "Memerlukan bukti kesesuaian, persetujuan sektoral, mitigasi, indikator, pemantauan, dan mekanisme penghentian/koreksi."
            : "Tidak direkomendasikan dalam rancangan YG karena berpotensi bertentangan dengan fungsi, keselamatan, atau pemulihan; perubahan hanya melalui revisi berbukti.",
      evidenceLocks: ["A24-d", "A24-m", "A24-n", "A24-o", "A24-p", "A24-q", "A24-s", "A24-t", "A24-u"],
      regulationRefs: ["R02", "R03", "R05", "R07", "R08"]
    }));
  });
  return {
    version: "0.1.0-internal",
    status: "candidate_codebook_pending_spatial_and_legal_validation",
    legend: {
      I: "Diizinkan secara kandidat pada lokasi yang sudah terverifikasi",
      T: "Diizinkan terbatas dengan batas skala/lokasi/kapasitas",
      B: "Diizinkan bersyarat setelah bukti dan persetujuan terpenuhi",
      X: "Tidak direkomendasikan dalam rancangan YG"
    },
    classificationRule: "Klasifikasi paling ketat berlaku apabila satu lokasi terkena lebih dari satu kendala. Status I/T/B/X ini adalah posisi teknis internal YG, bukan ketentuan zonasi yang berlaku dan bukan dasar perizinan.",
    activityCatalog,
    subzoneCandidates,
    itbxMatrix,
    intensityEnvelopes: zoneFamilies.map(zone => ({
      zoneCode: zone.zoneCode,
      zoneFamily: zone.zoneFamily,
      status: "numeric_values_not_set",
      parameters: { kdb: null, klb: null, kdh: null, height: null, density: null, setbacks: null },
      requiredEvidence: "Tipologi bangunan/kavling, kapasitas jalan–air–sanitasi–drainase, elevasi dan bahaya, daya dukung, kebutuhan ruang, hak/persetujuan, serta standar sektoral."
    })),
    specialProvisions: [
      { id: "KK-YG-01", theme: "Gambut dan tata air", rule: "Larangan pengeringan menjadi aturan minimum; tindakan tata air harus berbasis kesatuan hidrologis dan rencana pemulihan." },
      { id: "KK-YG-02", theme: "Rob, banjir, abrasi, dan subsidensi", rule: "Kegiatan hanya dapat dipromosikan setelah tingkat bahaya, jalur evakuasi, elevasi aman, dan dampak kumulatif dipetakan." },
      { id: "KK-YG-03", theme: "Mangrove, sungai, muara, dan pesisir", rule: "Jaga konektivitas pasang-surut, sempadan berbasis kajian, ruang perikanan, tambatan, dan akses masyarakat." },
      { id: "KK-YG-04", theme: "Kawasan hutan dan tenurial", rule: "Zonasi YG tidak mengubah status/fungsi kawasan hutan, hak, persetujuan, atau kewenangan sektoral." },
      { id: "KK-YG-05", theme: "Warisan dan ruang hidup", rule: "Lokasi bernilai budaya, sejarah, sosial, dan penghidupan tidak dialihkan sebelum identifikasi partisipatif dan perlindungan akses selesai." }
    ],
    disclaimer: "Kamus subzona dan ITBX awal untuk analisis internal; belum memiliki geometri subzona, angka intensitas, atau akibat hukum."
  };
}

function buildYgDraftRdtr(zoning, zoningCodebook, structureDraft, networkEvidence, serviceEvidence, serviceAccess, developmentReadiness, programmePortfolio, consultationMatrix, consultationReadinessPack, completenessAudit, gapClosureWorkplan, v1ReleaseDossier, existingEvidenceReconciliation, evidenceRequestBriefing, responseChangeControlLedger, v1PromotionValidator, fieldVerificationPlan, fieldObservationSchema, regulationCurrencyAudit) {
  const metadata = zoning.metadata || {};
  return {
    id: "RDTR-YG-BAGANSIAPIAPI-V0.27-RC10",
    title: "Rancangan RDTR Alternatif Bagansiapiapi versi Yayasan Gambut",
    version: "0.28.0-internal-release-candidate",
    sourceGeometryVersion: metadata.version || "0.2.0-internal",
    status: "provisional_internal_spatial_draft",
    legalCharacter: "Kajian dan rancangan teknis internal; tidak mempunyai akibat hukum dan tidak menggantikan kewenangan pemerintah daerah untuk menyusun serta menetapkan RDTR.",
    scope: "Sebelas kelurahan/kepenghuluan di Kecamatan Bangko yang disebut dalam undangan Konsultasi Publik I.",
    zoning: {
      status: "provisional_internal_zone_geometry",
      zoneCount: zoning.features.length,
      coveragePct: metadata.coveragePct,
      topologyRule: metadata.topologyRule,
      zones: zoning.features.map(feature => ({ ...feature.properties }))
    },
    zoningCodebook,
    structureDraft: {
      id: structureDraft.id,
      version: structureDraft.version,
      status: structureDraft.status,
      geometryRule: structureDraft.geometryRule,
      nodeCount: structureDraft.nodes.features.length,
      axisCount: structureDraft.axes.features.length,
      networkSystems: structureDraft.networkSystems,
      disclaimer: structureDraft.disclaimer
    },
    networkEvidence: {
      id: networkEvidence.id,
      version: networkEvidence.version,
      status: networkEvidence.status,
      roadMetadata: networkEvidence.roads.metadata,
      roadClassSummary: networkEvidence.classSummary,
      villageRoadCoverage: networkEvidence.villageCoverage,
      evidenceGaps: networkEvidence.evidenceGaps,
      disclaimer: networkEvidence.disclaimer
    },
    serviceHydrologyEvidence: {
      id: serviceEvidence.id,
      version: serviceEvidence.version,
      status: serviceEvidence.status,
      facilityMetadata: serviceEvidence.facilities.metadata,
      hydrologyMetadata: serviceEvidence.hydrology.metadata,
      facilityCategories: serviceEvidence.facilityCategories,
      waterwayClasses: serviceEvidence.waterwayClasses,
      villageCoverage: serviceEvidence.villageCoverage,
      disclaimer: serviceEvidence.disclaimer
    },
    serviceAccessAnalysis: {
      id: serviceAccess.id,
      version: serviceAccess.version,
      status: serviceAccess.status,
      prioritySummary: serviceAccess.prioritySummary,
      villageMatrix: serviceAccess.villageMatrix,
      limitation: serviceAccess.limitation
    },
    developmentReadinessAnalysis: {
      id: developmentReadiness.id,
      version: developmentReadiness.version,
      status: developmentReadiness.status,
      prioritySummary: developmentReadiness.prioritySummary,
      promotionSummary: developmentReadiness.promotionSummary,
      evidenceLocks: developmentReadiness.evidenceLocks,
      disclaimer: developmentReadiness.disclaimer
    },
    programmePortfolio: {
      id: programmePortfolio.id,
      version: programmePortfolio.version,
      status: programmePortfolio.status,
      phasingStatus: programmePortfolio.phasingStatus,
      programmeCount: programmePortfolio.items.length,
      indicatorCount: programmePortfolio.items.reduce((sum, row) => sum + (row.indicators?.length || 0), 0),
      disclaimer: programmePortfolio.disclaimer
    },
    consultationArgumentMatrix: {
      id: consultationMatrix.id,
      version: consultationMatrix.version,
      status: consultationMatrix.status,
      argumentCount: consultationMatrix.items.length,
      responseRule: consultationMatrix.responseRule,
      disclaimer: consultationMatrix.disclaimer
    },
    consultationReadinessPack: {
      id: consultationReadinessPack.id,
      version: consultationReadinessPack.version,
      status: consultationReadinessPack.status,
      agendaCount: consultationReadinessPack.priorityAgenda.length,
      mapChecklistCount: consultationReadinessPack.mapChecklist.length,
      evidenceChecklistCount: consultationReadinessPack.evidenceChecklist.length,
      teamRoleCount: consultationReadinessPack.teamRoles.length,
      disclaimer: consultationReadinessPack.disclaimer
    },
    completenessAudit: {
      id: completenessAudit.id,
      version: completenessAudit.version,
      status: completenessAudit.status,
      totalComponents: completenessAudit.totalComponents,
      statusSummary: completenessAudit.statusSummary,
      releaseGateCount: completenessAudit.releaseGates.length,
      disclaimer: completenessAudit.disclaimer
    },
    gapClosureWorkplan: {
      id: gapClosureWorkplan.id,
      version: gapClosureWorkplan.version,
      status: gapClosureWorkplan.status,
      totalItems: gapClosureWorkplan.totalItems,
      prioritySummary: gapClosureWorkplan.prioritySummary,
      disclaimer: gapClosureWorkplan.disclaimer
    },
    v1ReleaseDossier: {
      id: v1ReleaseDossier.id,
      version: v1ReleaseDossier.version,
      targetVersion: v1ReleaseDossier.targetVersion,
      releaseDecision: v1ReleaseDossier.releaseDecision,
      publicationAuthorized: v1ReleaseDossier.publicationAuthorized,
      openWorkItemCount: v1ReleaseDossier.openWorkItemCount,
      acceptedEvidenceCount: v1ReleaseDossier.acceptedEvidenceCount,
      disclaimer: v1ReleaseDossier.disclaimer
    },
    existingEvidenceReconciliation: {
      id: existingEvidenceReconciliation.id,
      version: existingEvidenceReconciliation.version,
      status: existingEvidenceReconciliation.status,
      totalItems: existingEvidenceReconciliation.totalItems,
      usableInternalArtifactCount: existingEvidenceReconciliation.usableInternalArtifactCount,
      legalPromotionCount: existingEvidenceReconciliation.legalPromotionCount,
      disclaimer: existingEvidenceReconciliation.disclaimer
    },
    evidenceRequestBriefing: {
      id: evidenceRequestBriefing.id,
      version: evidenceRequestBriefing.version,
      status: evidenceRequestBriefing.status,
      totalBriefs: evidenceRequestBriefing.totalBriefs,
      disclaimer: evidenceRequestBriefing.disclaimer
    },
    responseChangeControlLedger: {
      id: responseChangeControlLedger.id,
      version: responseChangeControlLedger.version,
      status: responseChangeControlLedger.status,
      totalEntries: responseChangeControlLedger.totalEntries,
      disclaimer: responseChangeControlLedger.disclaimer
    },
    v1PromotionValidator: {
      id: v1PromotionValidator.id,
      version: v1PromotionValidator.version,
      targetVersion: v1PromotionValidator.targetVersion,
      promotionEligible: v1PromotionValidator.promotionEligible,
      decision: v1PromotionValidator.decision,
      passedCheckCount: v1PromotionValidator.passedCheckCount,
      totalCheckCount: v1PromotionValidator.totalCheckCount,
      disclaimer: v1PromotionValidator.disclaimer
    },
    fieldVerificationPlan: {
      id: fieldVerificationPlan.id,
      version: fieldVerificationPlan.version,
      status: fieldVerificationPlan.status,
      totalVillages: fieldVerificationPlan.totalVillages,
      themeCount: fieldVerificationPlan.themes.length,
      disclaimer: fieldVerificationPlan.disclaimer
    },
    fieldObservationSchema: {
      id: fieldObservationSchema.id,
      version: fieldObservationSchema.version,
      status: fieldObservationSchema.status,
      fieldCount: fieldObservationSchema.fields.length,
      observationCount: fieldObservationSchema.emptyGeoJson.features.length,
      disclaimer: fieldObservationSchema.disclaimer
    },
    regulationCurrencyAudit: {
      id: regulationCurrencyAudit.id,
      version: regulationCurrencyAudit.version,
      status: regulationCurrencyAudit.status,
      totalRegulations: regulationCurrencyAudit.totalRegulations,
      checkedCount: regulationCurrencyAudit.checkedCount,
      pendingRecheckCount: regulationCurrencyAudit.pendingRecheckCount,
      disclaimer: regulationCurrencyAudit.disclaimer
    },
    components: [
      { id: "YG-RDTR-01", label: "Tujuan dan strategi WP", status: "provisional", outputRef: "ygPlan.planningObjective" },
      { id: "YG-RDTR-02", label: "Rencana struktur ruang", status: "analytical_reference_geometry_v0_1", outputRef: "map.ygStructureNodes/map.ygStructureAxes" },
      { id: "YG-RDTR-03", label: "Rencana pola ruang", status: "provisional_internal_zone_geometry", outputRef: "map.ygCandidateZones" },
      { id: "YG-RDTR-04", label: "Ketentuan pemanfaatan ruang", status: "candidate_only", outputRef: "ygPlan.programs" },
      { id: "YG-RDTR-05", label: "Peraturan zonasi", status: "candidate_itbx_v0_1", outputRef: "ygPlan.zoningRules" }
    ],
    remainingEvidence: [
      "Peta dasar dan survei skala 1:5.000",
      "RTRW Kabupaten Rokan Hilir yang berlaku",
      "KHG dan fungsi ekosistem gambut resmi",
      "Penggunaan lahan dan bangunan eksisting",
      "Penduduk, ekonomi, layanan, jaringan, dan kebutuhan ruang",
      "Rob, banjir, abrasi, elevasi, subsidensi, kebakaran, dan evakuasi",
      "KLHS, uji sosial-tenurial, dan verifikasi lapangan"
    ],
    disclaimer: metadata.disclaimer
  };
}

function coverageByClass(village, features, className, warnings, label) {
  const villageBox = bbox(village);
  const totals = new Map();
  for (const feature of features || []) {
    if (!feature?.geometry || !boxesOverlap(villageBox, bbox(feature))) continue;
    const overlap = safeIntersection(feature, village, warnings, label);
    const hectares = areaHa(overlap);
    if (hectares < 0.01) continue;
    const key = String(className(feature.properties || {}) || "Tidak terklasifikasi").trim();
    totals.set(key, (totals.get(key) || 0) + hectares);
  }
  return [...totals.entries()]
    .map(([name, hectares]) => ({ name, areaHa: round(hectares) }))
    .sort((a, b) => b.areaHa - a.areaHa);
}

function recommendationRows(metrics) {
  const rows = [
    {
      theme: "Konsistensi tata ruang",
      priority: "tinggi",
      recommendation:
        "Bandingkan setiap zona RDTR dengan arahan RTRW Provinsi Riau dan RTRW Kabupaten Rokan Hilir; setiap perbedaan wajib diberi justifikasi skala, data, dan dasar hukum."
    },
    {
      theme: "Risiko pesisir dan sungai",
      priority: "tinggi",
      recommendation:
        "Tetapkan sempadan pantai, muara, Sungai Rokan, dan anak sungai berdasarkan garis pasang tertinggi serta kajian rob, banjir, abrasi, dan keselamatan masyarakat."
    }
  ];
  if (metrics.peatAreaHa > 0.1) rows.push({
    theme: "Ekosistem gambut",
    priority: metrics.peatCoveragePct >= 20 ? "kritis" : "tinggi",
    recommendation:
      "Hindari peningkatan intensitas pemanfaatan pada gambut sebelum fungsi ekosistem, kedalaman, hidrologi, subsidensi, dan kerentanan kebakaran diverifikasi dalam KLHS."
  });
  if (metrics.forestAreaHa > 0.1) rows.push({
    theme: "Kawasan hutan",
    priority: "tinggi",
    recommendation:
      "Selaraskan zonasi dengan fungsi kawasan hutan dan kewenangan kehutanan; jangan menganggap perubahan pola ruang otomatis mengubah status kawasan hutan."
  });
  if (metrics.mangrove && metrics.mangrove.status === "analysed") rows.push({
    theme: "Mangrove dan perlindungan pantai",
    priority: metrics.mangrove.indicativeMangroveLossHa > 25 ? "kritis" : "tinggi",
    recommendation:
      "Pertahankan tutupan mangrove tersisa, lindungi konektivitas pasang-surut, dan tempatkan kandidat pemulihan sebagai arahan perlindungan/pemulihan setelah verifikasi hidrodinamika dan tenurial."
  });
  rows.push({
    theme: "Partisipasi dan bukti",
    priority: "tinggi",
    recommendation:
      "Cantumkan sumber, tahun, skala, keterbatasan data, serta tanggapan terhadap masukan masyarakat untuk setiap keputusan zonasi yang berdampak besar."
  });
  return rows;
}

export function buildAnalysis({ rtrw, administration, peat, forest, mangrove, mangroveCandidates = featureCollection([]), roads = featureCollection([]), facilities = featureCollection([]), hydrology = featureCollection([]) }) {
  const warnings = new Set();
  const villages = (administration.features || []).filter(feature => {
    const props = feature.properties || {};
    return normalize(props.WADMKK) === "rokan hilir" &&
      normalize(props.WADMKC) === "bangko" &&
      TARGET_VILLAGES.has(normalize(props.WADMKD || props.NAMOBJ));
  });
  const villageNames = new Set(villages.map(feature => normalize(
    feature.properties?.WADMKD || feature.properties?.NAMOBJ
  )));
  if (villages.length !== TARGET_VILLAGES.size || villageNames.size !== TARGET_VILLAGES.size) {
    throw new Error(
      `Batas wilayah studi tidak lengkap: ditemukan ${villages.length} fitur / ${villageNames.size} nama; ` +
      `diharapkan ${TARGET_VILLAGES.size}.`
    );
  }

  const studyArea = union(featureCollection(villages));
  studyArea.properties = {
    name: "Kawasan Perkotaan Bagansiapiapi",
    district: "Bangko",
    regency: "Rokan Hilir",
    villageCount: villages.length,
    source: "Batas administrasi desa Riau — Hasil Delineasi Tahun 2018"
  };
  const nonAplForest = (forest.features || []).filter(feature =>
    normalize(feature.properties?.fungsi) !== "apl"
  );
  const mangroveByVillage = new Map(
    (mangrove.villages || []).map(row => [normalize(row.village), row])
  );

  const villageMetrics = villages.map(village => {
    const props = village.properties || {};
    const name = props.WADMKD || props.NAMOBJ;
    const hectares = areaHa(village);
    const rtrwCoverage = coverageByClass(
      village,
      rtrw.features,
      item => item.RENCANA || item.rtrsys || item.POLA_RUANG || item.rtrppr,
      warnings,
      `RTRW ${name}`
    );
    const peatCoverage = coverageByClass(
      village,
      peat.features,
      item => item.KELAS_GBT || item.KETEBALAN || "Gambut",
      warnings,
      `Gambut ${name}`
    );
    const forestCoverage = coverageByClass(
      village,
      nonAplForest,
      item => item.fungsi || "Kawasan hutan",
      warnings,
      `Kawasan hutan ${name}`
    );
    const peatAreaHa = peatCoverage.reduce((sum, row) => sum + row.areaHa, 0);
    const forestAreaHa = forestCoverage.reduce((sum, row) => sum + row.areaHa, 0);
    const mangroveRow = mangroveByVillage.get(normalize(name));
    const metrics = {
      id: normalize(name).replace(/\s+/g, "-"),
      name,
      areaHa: round(hectares),
      rtrwCoverage: rtrwCoverage.slice(0, 8),
      peatAreaHa: round(peatAreaHa),
      peatCoveragePct: round(Math.min(100, peatAreaHa / hectares * 100), 1),
      peatClasses: peatCoverage,
      forestAreaHa: round(forestAreaHa),
      forestCoveragePct: round(Math.min(100, forestAreaHa / hectares * 100), 1),
      forestFunctions: forestCoverage,
      mangrove: mangroveRow ? {
        status: mangroveRow.status,
        baselineMangroveHa: mangroveRow.baselineMangroveHa,
        currentMangroveHa: mangroveRow.currentMangroveHa,
        indicativeMangroveLossHa: mangroveRow.indicativeMangroveLossHa,
        priorityAreaHa: mangroveRow.priorityAreaHa,
        recommendedAction: mangroveRow.recommendedAction,
        confidence: mangroveRow.confidence
      } : { status: "not_analysed" }
    };
    metrics.recommendations = recommendationRows(metrics);
    metrics.regulatoryAssessments = villageRegulatoryAssessments(metrics);
    return metrics;
  }).sort((a, b) => a.name.localeCompare(b.name, "id"));

  const totalAreaHa = villageMetrics.reduce((sum, row) => sum + row.areaHa, 0);
  const totalPeatHa = villageMetrics.reduce((sum, row) => sum + row.peatAreaHa, 0);
  const totalForestHa = villageMetrics.reduce((sum, row) => sum + row.forestAreaHa, 0);
  const rtrwMap = clippedFeatures(
    rtrw.features,
    studyArea,
    item => ({
      class: item.RENCANA || item.rtrsys || item.POLA_RUANG || item.rtrppr,
      pattern: item.POLA_RUANG || item.rtrppr || "",
      legalBasis: item.DASAR_HUKUM || item.nothpd || "",
      sourceObjectId: item.Source_Object_ID || item.objectid || ""
    }),
    warnings,
    "Geometri RTRW"
  );
  const peatMap = clippedFeatures(
    peat.features,
    studyArea,
    item => ({
      peatClass: item.KELAS_GBT || "Gambut",
      thickness: item.KETEBALAN || "",
      year: item.TAHUN || 2019
    }),
    warnings,
    "Geometri gambut"
  );
  const forestMap = clippedFeatures(
    nonAplForest,
    studyArea,
    item => ({ function: item.fungsi || "Kawasan hutan" }),
    warnings,
    "Geometri kawasan hutan"
  );
  const targetMangroveCandidates = (mangroveCandidates.features || []).filter(feature => {
    const props = feature.properties || {};
    return normalize(props.WADMKK || props.regency) === "rokan hilir" &&
      normalize(props.WADMKC || props.district) === "bangko" &&
      TARGET_VILLAGES.has(normalize(props.WADMKD || props.village));
  });
  const mangroveCandidateMap = clippedFeatures(
    targetMangroveCandidates,
    studyArea,
    item => ({
      polygonId: item.polygonId || item.id || "",
      village: item.village || item.WADMKD || "",
      priorityClass: item.priorityClass || "",
      priorityLabel: item.priorityLabel || "Kandidat perlindungan/pemulihan",
      priorityScore: item.priorityScore ?? null,
      confidence: item.confidence || "perlu verifikasi",
      recommendedAction: item.recommendedAction || "Verifikasi perlindungan/pemulihan pesisir",
      methodVersion: item.methodVersion || "",
      sourceAreaHa: item.areaHa ?? null
    }),
    warnings,
    "Kandidat mangrove"
  );
  const mangroveCandidateAreaHa = round(mangroveCandidateMap.reduce((sum, feature) => sum + areaHa(feature), 0));
  const summary = {
    villageCount: villages.length,
    areaHa: round(totalAreaHa),
    peatAreaHa: round(totalPeatHa),
    peatCoveragePct: round(totalPeatHa / totalAreaHa * 100, 1),
    forestAreaHa: round(totalForestHa),
    forestCoveragePct: round(totalForestHa / totalAreaHa * 100, 1),
    rtrwClassCount: new Set(rtrwMap.map(feature => feature.properties.class)).size,
    mangroveAnalysedVillageCount: villageMetrics.filter(row => row.mangrove.status === "analysed").length,
    mangroveCandidateCount: mangroveCandidateMap.length,
    mangroveCandidateAreaHa
  };
  const mandatoryAnalysisMatrix = buildMandatoryAnalysisMatrix(summary);
  const analysisProgramme = buildAnalysisProgramme(mandatoryAnalysisMatrix);
  const ygPlanningUnits = buildYgPlanningUnits(villages, villageMetrics);
  const ygStructureDraft = buildYgStructureDraft(villages, villageMetrics);
  const ygNetworkEvidence = buildYgNetworkEvidence({ roads, studyArea, villages });
  const ygServiceHydrologyEvidence = buildYgFacilityHydrologyEvidence({ facilities, hydrology, studyArea, villages });
  const ygCandidateZones = buildYgCandidateZoning({
    studyArea,
    rtrwMap,
    peatMap,
    forestMap,
    mangroveCandidateMap
  });
  const ygDevelopmentReadiness = buildYgDevelopmentReadiness(ygCandidateZones);
  const ygServiceAccessAnalysis = buildYgServiceAccessAnalysis({
    serviceEvidence: ygServiceHydrologyEvidence,
    networkEvidence: ygNetworkEvidence,
    villages,
    candidateZones: ygCandidateZones
  });
  const zoningCodebook = buildYgZoningCodebook(ygCandidateZones);
  const ygPlan = buildYgPlan(ygCandidateZones, zoningCodebook, ygStructureDraft, ygNetworkEvidence, ygServiceHydrologyEvidence, ygServiceAccessAnalysis, ygDevelopmentReadiness);
  const assessments = regulatoryAssessments(summary);
  const evidenceBoard = buildP0EvidenceBoard(ygCandidateZones);
  const consultationArgumentMatrix = buildConsultationArgumentMatrix(assessments, ygCandidateZones, evidenceBoard);
  const policyMapFramework = buildPolicyMapFramework({
    summary,
    peatCount: peatMap.length,
    forestCount: forestMap.length,
    mangroveCandidateCount: mangroveCandidateMap.length,
    mangroveCandidateAreaHa,
    ygZoneCount: ygCandidateZones.features.length,
    ygZoneCoveragePct: ygCandidateZones.metadata.coveragePct
  });
  const geometryRegistry = buildGeometryRegistry({
    villageCount: villages.length,
    rtrwCount: rtrwMap.length,
    peatCount: peatMap.length,
    forestCount: forestMap.length,
    mangroveCandidateCount: mangroveCandidateMap.length,
    ygZoneCount: ygCandidateZones.features.length,
    developmentReadinessCount: ygDevelopmentReadiness.zones.features.length,
    structureNodeCount: ygStructureDraft.nodes.features.length,
    structureAxisCount: ygStructureDraft.axes.features.length,
    roadEvidenceCount: ygNetworkEvidence.roads.features.length,
    facilityEvidenceCount: ygServiceHydrologyEvidence.facilities.features.length,
    hydrologyEvidenceCount: ygServiceHydrologyEvidence.hydrology.features.length
  });
  const consultationReadinessPack = buildConsultationReadinessPack(consultationArgumentMatrix, geometryRegistry, evidenceBoard);
  const completenessAudit = buildRdtrCompletenessAudit({
    ygPlan,
    candidateZones: ygCandidateZones,
    structureDraft: ygStructureDraft,
    mandatoryAnalyses: mandatoryAnalysisMatrix,
    evidenceBoard,
    developmentReadiness: ygDevelopmentReadiness,
    consultationMatrix: consultationArgumentMatrix
  });
  const gapClosureWorkplan = buildGapClosureWorkplan(completenessAudit);
  const v1ReleaseDossier = buildV1ReleaseDossier(completenessAudit, gapClosureWorkplan);
  const existingEvidenceReconciliation = buildExistingEvidenceReconciliation(completenessAudit);
  const evidenceRequestBriefing = buildEvidenceRequestBriefing(completenessAudit);
  const responseChangeControlLedger = buildResponseChangeControlLedger(evidenceRequestBriefing);
  const v1PromotionValidator = buildV1PromotionValidator({ completenessAudit, gapClosureWorkplan, v1ReleaseDossier, evidenceRequestBriefing, responseChangeControlLedger });
  const fieldVerificationPlan = buildFieldVerificationPlan(ygServiceAccessAnalysis);
  const fieldObservationSchema = buildFieldObservationSchema(fieldVerificationPlan);
  const regulationCurrencyAudit = buildRegulationCurrencyAudit();
  const ygDraftRdtr = buildYgDraftRdtr(ygCandidateZones, zoningCodebook, ygStructureDraft, ygNetworkEvidence, ygServiceHydrologyEvidence, ygServiceAccessAnalysis, ygDevelopmentReadiness, ygPlan.programs, consultationArgumentMatrix, consultationReadinessPack, completenessAudit, gapClosureWorkplan, v1ReleaseDossier, existingEvidenceReconciliation, evidenceRequestBriefing, responseChangeControlLedger, v1PromotionValidator, fieldVerificationPlan, fieldObservationSchema, regulationCurrencyAudit);

  return {
    metadata: {
      title: "Rancangan Analitis RDTR versi YG — Kawasan Perkotaan Bagansiapiapi",
      owner: "Yayasan Gambut",
      access: "staff_only",
      status: "provisional_internal_analytical_plan",
      generatedAt: new Date().toISOString(),
      consultationDate: "2026-09-22",
      ygDraftZoningStatus: "provisional_internal_zone_geometry",
      limitation:
        "Rancangan teknis RDTR alternatif YG disusun mandiri dari kajian kebijakan dan data yang tersedia. Dokumen ini bukan RDTR yang ditetapkan, naskah perkada, dasar KKPR, atau penetapan geometri/intensitas. Zona internal dapat dipakai untuk analisis dan konsultasi, tetapi subzona serta angka intensitas baru dapat dimatangkan setelah RTRW kabupaten yang sah, KLHS, data skala 1:5.000, penggunaan lahan, layanan, bahaya, dan verifikasi lapangan tersedia."
    },
    summary,
    readiness: [
      { id: "study-area", label: "Batas 11 kelurahan/kepenghuluan", status: "screening" },
      { id: "rtrw-province", label: "RTRW Provinsi Riau", status: "screening" },
      { id: "peat", label: "Gambut BBSDLP 2019", status: "screening" },
      { id: "forest", label: "Indikasi non-APL dari kawasan hutan SK 903", status: "screening" },
      { id: "mangrove", label: "Analisis mangrove 2016–2025", status: "partial" },
      { id: "yg-zoning", label: "Rancangan zonasi alternatif YG v0.2", status: "yg_draft" },
      { id: "klhs", label: "Dokumen dan peta kerja KLHS", status: "missing" },
      { id: "land-use", label: "Penggunaan lahan, bangunan, penduduk, dan layanan skala RDTR", status: "missing" },
      { id: "hazards", label: "Peta rob, banjir, abrasi, dan subsidensi", status: "missing" }
    ],
    analysisPosition: {
      title: "Posisi dan rancangan analitis Yayasan Gambut berbasis regulasi",
      statement: "Baseline menunjukkan alasan kuat untuk menahan keputusan ruang berintensitas tinggi pada area gambut, non-APL, dan pesisir. YG telah membentuk rancangan zonasi internal yang saling eksklusif untuk mengutamakan perlindungan ekosistem, penyelarasan status, konsolidasi pertumbuhan aman, akses masyarakat, serta pengendalian yang terukur.",
      caveat: "Status Tahan, Verifikasi, dan Bersyarat adalah keputusan rancangan internal. Geometri zona YG dapat dipakai sebagai argumen teknis dan bahan konsultasi, tetapi tidak mempunyai akibat hukum, tidak menetapkan hak, dan tidak dapat digunakan sebagai dasar KKPR."
    },
    decisionClasses: DECISION_CLASSES,
    regulatoryAssessments: assessments,
    regulationRegister: REGULATION_REGISTER,
    legalFramework: REGULATION_REGISTER.map(row => ({ code: row.code, theme: row.title })),
    p0EvidenceBoard: evidenceBoard,
    policyMapFramework,
    ygDraftRdtr,
    planningWorkflow: buildPlanningWorkflow(),
    crossCuttingGates: buildCrossCuttingGates(),
    mandatoryAnalysisMatrix,
    analysisProgramme,
    ygPlan,
    consultationArgumentMatrix,
    consultationReadinessPack,
    completenessAudit,
    gapClosureWorkplan,
    v1ReleaseDossier,
    existingEvidenceReconciliation,
    evidenceRequestBriefing,
    responseChangeControlLedger,
    v1PromotionValidator,
    fieldVerificationPlan,
    fieldObservationSchema,
    regulationCurrencyAudit,
    serviceAccessAnalysis: {
      id: ygServiceAccessAnalysis.id,
      version: ygServiceAccessAnalysis.version,
      status: ygServiceAccessAnalysis.status,
      prioritySummary: ygServiceAccessAnalysis.prioritySummary,
      villageMatrix: ygServiceAccessAnalysis.villageMatrix,
      limitation: ygServiceAccessAnalysis.limitation
    },
    developmentReadinessAnalysis: {
      id: ygDevelopmentReadiness.id,
      version: ygDevelopmentReadiness.version,
      status: ygDevelopmentReadiness.status,
      prioritySummary: ygDevelopmentReadiness.prioritySummary,
      promotionSummary: ygDevelopmentReadiness.promotionSummary,
      evidenceLocks: ygDevelopmentReadiness.evidenceLocks,
      disclaimer: ygDevelopmentReadiness.disclaimer
    },
    geometryRegistry,
    consultationQuestions: consultationArgumentMatrix.items.map(row => row.consultationQuestion),
    villages: villageMetrics,
    map: {
      studyArea: featureCollection(villages),
      ygPlanningUnits,
      ygStructureNodes: ygStructureDraft.nodes,
      ygStructureAxes: ygStructureDraft.axes,
      ygRoadEvidence: ygNetworkEvidence.roads,
      ygFacilityEvidence: ygServiceAccessAnalysis.facilities,
      ygHydrologyEvidence: ygServiceHydrologyEvidence.hydrology,
      rtrw: featureCollection(rtrwMap),
      peat: featureCollection(peatMap),
      forest: featureCollection(forestMap),
      mangroveCandidates: featureCollection(mangroveCandidateMap),
      ygCandidateZones,
      ygDevelopmentReadiness: ygDevelopmentReadiness.zones
    },
    warnings: [...warnings].slice(0, 50)
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [rtrwPath, outputPath] = process.argv.slice(2);
  if (!rtrwPath || !outputPath) {
    console.error("Usage: node build-rdtr-bagansiapiapi-analysis.mjs <rtrw.geojson> <output.json>");
    process.exit(2);
  }
  const analysis = buildAnalysis({
    rtrw: readJson(rtrwPath, "RTRW Riau"),
    administration: readJson(path.join(REPO_ROOT, "data/batas_administrasi_desa_riau.geojson"), "Batas administrasi"),
    peat: readJson(path.join(REPO_ROOT, "data/Gambut_BBSDLP_2019.geojson"), "Gambut BBSDLP"),
    forest: readJson(path.join(REPO_ROOT, "data/kawasan_hutan_sk_903.geojson"), "Kawasan hutan"),
    mangrove: readJson(path.join(REPO_ROOT, "data/mangrove-priority-rokan-hilir-results.json"), "Analisis mangrove"),
    mangroveCandidates: readJson(path.join(REPO_ROOT, "data/mangrove-priority-rokan-hilir-candidates.geojson"), "Kandidat mangrove"),
    roads: readJson(path.join(REPO_ROOT, "data/mangrove-priority-rokan-hilir-roads-osm.geojson"), "Jaringan jalan OSM Rokan Hilir"),
    facilities: readOptionalJson(path.join(REPO_ROOT, "data/rdtr-bagansiapiapi-facilities-osm.geojson")),
    hydrology: readOptionalJson(path.join(REPO_ROOT, "data/rdtr-bagansiapiapi-hydrology-osm.geojson"))
  });
  fs.writeFileSync(outputPath, JSON.stringify(analysis));
  console.log(JSON.stringify({
    ok: true,
    output: outputPath,
    bytes: fs.statSync(outputPath).size,
    summary: analysis.summary,
    warnings: analysis.warnings.length
  }, null, 2));
}
