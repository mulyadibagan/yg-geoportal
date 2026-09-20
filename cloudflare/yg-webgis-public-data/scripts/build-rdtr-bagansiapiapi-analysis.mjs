import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  area,
  bbox,
  featureCollection,
  intersect,
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
    id: "R14", scope: "inti", code: "UU 41/1999 jo. UU 6/2023; PP 23/2021", title: "Kehutanan",
    status: "berlaku dengan perubahan", officialUrl: "https://peraturan.bpk.go.id/Details/161853/pp-no-23-tahun-2021",
    officialUrls: [
      { label: "UU 41/1999", url: "https://peraturan.go.id/id/uu-no-41-tahun-1999" },
      { label: "Perubahan terakhir UU 6/2023", url: "https://peraturan.bpk.go.id/Details/246523/uu-no-6-tahun-2023" },
      { label: "PP 23/2021", url: "https://peraturan.bpk.go.id/Details/161853/pp-no-23-tahun-2021" }
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
    id: "L02", scope: "lokal", code: "RTRW Kabupaten Rokan Hilir yang berlaku", title: "Rujukan Langsung RDTR",
    status: "nomor dan status belum terverifikasi", officialUrl: "https://jdih.rohilkab.go.id/",
    obligation: "RDTR merupakan rencana rinci yang harus konsisten dengan RTRW kabupaten yang sah.",
    ygTest: "Kesimpulan konsistensi final ditahan sampai perda, lampiran peta digital, riwayat perubahan, dan status berlakunya diterima."
  },
  {
    id: "L03", scope: "bersyarat", code: "Perpres 43/2020", title: "RTR Kawasan Perbatasan Negara Riau–Kepri",
    status: "berlaku bila beririsan", officialUrl: "https://peraturan.bpk.go.id/Details/134801/perpres-no-43-tahun-2020",
    obligation: "Arahan perpres berlaku pada lokasi yang masuk delineasi kawasan perbatasan negara.",
    ygTest: "Terapkan hanya setelah lampiran geometri dioverlay dengan WP atau wilayah fungsional; jangan menyimpulkan dari nama atau kedekatan wilayah."
  }
];

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
        "Menetapkan disiplin keputusan Tahan, Verifikasi, Bersyarat, dan Revisi"
      ],
      gaps: [
        "Sebagian besar analisis sosial, ekonomi, kependudukan, transportasi, prasarana, kelembagaan, dan pembiayaan belum dapat diselesaikan",
        "Dokumen serta peta kerja KLHS dan geometri draf pemerintah/penyusun yang terotorisasi, bernomor versi, dan bertanggal belum diterima",
        "Temuan baseline belum dapat menjadi penetapan zona atau intensitas pemanfaatan ruang"
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
        "Menyusun ALT-0, ALT-OFF, dan ALT-YG-1 untuk dibandingkan secara transparan",
        "Memilih ALT-YG-1 secara sementara sebagai konsep berbasis ekosistem, risiko, dan konsolidasi pertumbuhan",
        "Menyiapkan kerangka tujuan, strategi, struktur, pola, aturan zonasi, dan program tanpa menetapkan geometri atau angka intensitas final"
      ],
      gaps: [
        "ALT-OFF belum dapat dinilai karena konsep/geometri draf pemerintah atau penyusun yang terotorisasi, bernomor versi, dan bertanggal belum diterima",
        "Uji alternatif KLHS, proyeksi kebutuhan, analisis kelayakan, dan hasil partisipasi belum lengkap",
        "Pilihan ALT-YG-1 masih dapat berubah setelah bukti resmi dan masukan konsultasi diuji"
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
        "Menandai klausul perlindungan dan pengendalian yang perlu diterjemahkan ke geometri, norma, indikator, dan program"
      ],
      gaps: [
        "Belum ada naskah rancangan perkada, matriks kegiatan, peta zonasi draf pemerintah terotorisasi, atau tabel intensitas yang dapat diuji",
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
      decisionRule: "Tidak menyatakan konsisten atau bertentangan sebelum RTRW yang berlaku dan draf pemerintah terotorisasi, bernomor versi, serta bertanggal diperoleh."
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
      status: "blocked_no_official_zone_geometry",
      finding: "Karakteristik zona/subzona belum dapat dinilai karena geometri dan nomenklatur zonasi draf pemerintah terotorisasi, bernomor versi, dan bertanggal belum diterima.",
      nextStep: "Setelah geometri diterima, susun profil tiap zona: fungsi, kondisi eksisting, daya dukung, risiko, akses, konflik, kegiatan, dan indikator kualitas yang diharapkan.",
      regulationRefs: ["R03", "R04", "R05", "R10"]
    },
    n: {
      status: "not_started",
      finding: "Daftar kegiatan eksisting, informal, musiman, terkait penghidupan, dan kegiatan yang mungkin berkembang belum diinventarisasi secara spasial.",
      nextStep: "Susun katalog kegiatan dengan skala, dampak, kebutuhan prasarana, keterkaitan ekonomi, risiko, kompatibilitas, serta skenario masa depan.",
      regulationRefs: ["R03", "R07", "R10", "R13"]
    },
    o: {
      status: "blocked_no_official_zone_geometry",
      finding: "Kesesuaian kegiatan terhadap zona/subzona tidak dapat diputuskan tanpa geometri dan nomenklatur draf pemerintah terotorisasi, matriks kegiatan, serta bukti kondisi eksisting yang sah.",
      nextStep: "Uji tiap kegiatan sebagai diizinkan, terbatas, bersyarat, atau tidak diperbolehkan menggunakan kriteria yang eksplisit dan dapat diawasi setelah draf zona terotorisasi tersedia.",
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
      finding: "Pertumbuhan penduduk per zona belum dapat dihitung karena geometri zona draf pemerintah terotorisasi dan proyeksi penduduk terpilah belum tersedia.",
      nextStep: "Setelah zona tersedia, distribusikan skenario penduduk dengan kapasitas hunian dan layanan, risiko, tren migrasi, serta batas daya dukung; hindari kepastian semu.",
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
      geometryLink: "Mengisi kebutuhan kapasitas per calon zona setelah geometri resmi tersedia; agregasi wajib menjaga privasi.", decisionUse: "Menentukan kebutuhan ruang, layanan, hunian, dan kapasitas evakuasi tanpa menggelembungkan proyeksi.",
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
      requiredData: ["Geometri dan nomenklatur zona draf terotorisasi", "Profil kondisi eksisting dan daya dukung tiap zona", "Risiko, akses, konflik, kegiatan dan target kualitas"],
      method: ["Profil spasial per zona", "Statistik zonal dan uji homogenitas", "Perbandingan kondisi–fungsi–target"],
      outputs: ["Lembar profil setiap zona/subzona", "Justifikasi batas, fungsi, dan target kualitas"],
      availableEvidence: ["Keluarga calon zona versi YG tanpa geometri hukum"], evidenceGaps: ["Geometri zona resmi", "Nomenklatur dan versi draf", "Baseline terpilah per zona"],
      geometryLink: "Wajib memakai geometri zona draf bernomor versi; unit administrasi YG tidak boleh dianggap zona.", decisionUse: "Menjadi dasar seluruh matriks kegiatan, intensitas, ketentuan khusus, dan evaluasi zona.",
      consultationPrompt: "Minta geometri zona versi resmi dan profil yang membuktikan mengapa batas serta fungsi tiap zona dipilih."
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
      availableEvidence: ["Kerangka keputusan Tahan–Verifikasi–Bersyarat–Revisi"], evidenceGaps: ["Zona resmi", "Katalog kegiatan", "Kriteria dan ambang terukur"],
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
      availableEvidence: ["Belum tersedia untuk tingkat zona"], evidenceGaps: ["Zona resmi", "Proyeksi terpilah", "Kapasitas hunian dan layanan"],
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

function buildYgPlan() {
  const geometryDisclaimer = "Konsep ini tidak menetapkan batas WP, SWP, blok, subblok, zona, jaringan, atau lokasi program secara resmi. Semua geometri harus diturunkan dari peta dasar skala 1:5.000, survei, RTRW yang sah, KLHS, dan proses pemerintah.";
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
      qualification: "Rumusan tujuan masih sementara. Nilai/kualitas yang terukur dan kesesuaiannya dengan arahan RTRW Kabupaten Rokan Hilir belum dapat ditetapkan sampai RTRW yang berlaku, analisis lengkap, dan KLHS diterima serta diuji.",
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
        id: "ALT-OFF",
        label: "Konsep draf pemerintah/penyusun terotorisasi",
        status: "unavailable_pending_official_draft",
        selected: false,
        concept: "Placeholder untuk tujuan, struktur, pola, aturan zonasi, dan program dari draf pemerintah/penyusun yang terotorisasi, bernomor versi, dan bertanggal agar dapat dibandingkan dengan kriteria yang sama.",
        evaluation: "Belum dinilai karena konsep, geometri, aturan zonasi, dan matriks program dari draf terotorisasi belum diterima."
      },
      {
        id: "ALT-YG-1",
        label: "Perlindungan ekosistem, pengurangan risiko, dan konsolidasi pertumbuhan",
        status: "selected_provisional",
        selected: true,
        concept: "Menyaring lokasi dengan fungsi ekosistem, status hukum, dan risiko terlebih dahulu; memperkuat pusat serta jaringan yang aman; melindungi ruang hidup; dan mengikat keputusan pada aturan serta program yang dapat diawasi.",
        evaluation: "Dipilih sementara karena paling sesuai dengan indikasi gambut, kawasan hutan, dan pesisir yang tersedia; wajib diuji ulang melalui 21 analisis, KLHS, RTRW kabupaten, draf pemerintah terotorisasi, dan partisipasi."
      }
    ],
    selectedAlternative: {
      id: "ALT-YG-1",
      status: "provisional",
      reviewTrigger: "Tinjau ulang setelah RTRW kabupaten, data skala 1:5.000, KLHS, 21 analisis, konsep draf pemerintah terotorisasi, dan matriks tanggapan konsultasi tersedia."
    },
    structurePlan: {
      status: "conceptual_no_official_geometry",
      disclaimer: geometryDisclaimer,
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
      status: "candidate_zone_families_no_official_geometry",
      disclaimer: geometryDisclaimer,
      zones: [
        {
          id: "ZONE-YG-PEAT",
          patternCategory: "protected_candidate",
          role: "candidate_peat_ecosystem_protection_or_management",
          geometryStatus: "not_delineated",
          direction: "Pisahkan perlindungan dan pengelolaan gambut berdasarkan KHG/fungsi resmi, kubah, kedalaman, hidrologi, kerusakan, risiko kebakaran, dan kebutuhan pemulihan; bukan dari persentase WP."
        },
        {
          id: "ZONE-YG-COAST",
          patternCategory: "protected_candidate",
          role: "candidate_coastal_mangrove_river_protection",
          geometryStatus: "not_delineated",
          direction: "Lindungi mangrove, sempadan pantai/sungai/muara, aliran pasang-surut, area abrasi-rob, akses masyarakat, serta ruang perikanan berdasarkan kajian lokasi."
        },
        {
          id: "ZONE-YG-FOREST",
          patternCategory: "protected_candidate",
          role: "candidate_forest_status_alignment",
          geometryStatus: "not_delineated",
          direction: "Pertahankan keterbacaan status/fungsi kawasan hutan dan jangan menganggap zonasi RDTR mengubah status, fungsi, atau kewenangan kehutanan."
        },
        {
          id: "ZONE-YG-URBAN",
          patternCategory: "cultivation_candidate",
          role: "candidate_safe_urban_consolidation",
          geometryStatus: "not_delineated",
          direction: "Arahkan hunian, pelayanan, dan kegiatan perkotaan ke kawasan terbangun yang terbukti sesuai, aman, dapat dilayani, serta tidak memperbesar beban hidrologi dan risiko."
        },
        {
          id: "ZONE-YG-LIVELIHOOD",
          patternCategory: "cultivation_candidate",
          role: "candidate_community_livelihood_and_production",
          geometryStatus: "not_delineated",
          direction: "Akui penghidupan lokal, perikanan, produksi yang sesuai, wilayah kelola, dan akses masyarakat dengan syarat lingkungan, tenurial, serta keselamatan yang dapat diawasi."
        }
      ]
    },
    zoningRules: {
      status: "framework_only_pending_official_zones",
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
          direction: "Kegiatan yang mengeringkan gambut, memutus konektivitas pasang-surut, menghilangkan mangrove, mempersempit aliran, atau menambah risiko tidak dapat diasumsikan sesuai; klasifikasi kegiatan menunggu zona dan kajian resmi."
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
      status: "candidate_portfolio_no_budget_or_commitment",
      phasingStatus: "not_set_pending_plan_horizon_and_fiscal_analysis",
      items: [
        {
          id: "PRG-YG-1",
          title: "Penyelesaian dasar hukum, data, dan peta skala RDTR",
          status: "candidate",
          direction: "Peroleh RTRW kabupaten, penetapan WP, peta dasar rekomendasi BIG, basis data 1:5.000, geometri draf, metadata, dan audit topologi."
        },
        {
          id: "PRG-YG-2",
          title: "KLHS, hidrologi gambut, dan pengurangan risiko terpadu",
          status: "candidate",
          direction: "Selesaikan KLHS, fungsi KHG, tata air, subsidensi, kebakaran, rob, banjir, abrasi, skenario iklim, serta pilihan perlindungan/pemulihan."
        },
        {
          id: "PRG-YG-3",
          title: "Perlindungan pesisir, mangrove, sungai, dan akses masyarakat",
          status: "candidate",
          direction: "Lengkapi kajian hidro-oseanografi dan sosial-tenurial, lindungi konektivitas, pulihkan lokasi prioritas, dan jaga ruang tangkap, tambat, serta akses publik."
        },
        {
          id: "PRG-YG-4",
          title: "Layanan dasar, drainase, mobilitas aman, dan evakuasi",
          status: "candidate",
          direction: "Prioritaskan gap layanan dan fasilitas kritis berdasarkan kebutuhan, eksposur, kelompok rentan, kapasitas, operasi-pemeliharaan, dan kelayakan pembiayaan."
        },
        {
          id: "PRG-YG-5",
          title: "Pemetaan partisipatif, tenurial, dan penghidupan",
          status: "candidate",
          direction: "Dokumentasikan hak/persetujuan, perhutanan sosial, ruang hidup, ekonomi lokal, konflik, kebutuhan transisi, dan respons terhadap masukan secara aman serta terpilah."
        },
        {
          id: "PRG-YG-6",
          title: "Sistem pengendalian, pemantauan, dan evaluasi",
          status: "candidate",
          direction: "Bangun indikator, wali data, inspeksi, pengaduan, pembaruan data, evaluasi lima tahunan, dan tindakan korektif yang terhubung ke aturan zonasi."
        }
      ]
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
        evidenceStatus: "insufficient_for_geometry",
        decision: "Keluarga zona hanya menjadi hipotesis; batas dan nomenklatur harus mengikuti bukti resmi, analisis, KLHS, serta prosedur pemerintah."
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
  directions.push("tetapkan arah ruang hanya setelah RTRW kabupaten, KLHS, dan draf pemerintah terotorisasi dengan nomor versi serta tanggal tersedia");
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

function buildGeometryRegistry({ villageCount, rtrwCount, peatCount, forestCount }) {
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
      id: "GR-RDTR-OFFICIAL-DRAFT",
      mapRef: null,
      status: "not_received",
      featureCount: 0,
      role: "official_wp_swp_block_subblock_zone_and_network_geometry",
      source: "Pemerintah Kabupaten Rokan Hilir/penyusun RDTR",
      permittedUse: "Belum ada.",
      limitation: "Tanpa geometri ini, konflik zonasi, luas zona, intensitas, dan kesesuaian kegiatan tidak dapat diputuskan."
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
      ygPosition: "Pilihan zona, intensitas, dan program berdampak tinggi belum layak disepakati sebelum penyusun menunjukkan bagaimana KLHS mengubah draf, bukan sekadar menjadi lampiran.",
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
      finding: "Baseline YG merupakan alat penyaringan; geometri dan atribut draf RDTR pemerintah/penyusun yang terotorisasi pada skala 1:5.000 belum diterima.",
      regulations: ["R04", "R15"],
      requirement: "Geometri, atribut, topologi, referensi, metadata, dan album peta RDTR harus lengkap, konsisten, dan dapat diuji.",
      ygPosition: "YG tidak akan menyebut suatu zona salah sebelum geometri draf pemerintah yang terotorisasi, bernomor versi, dan bertanggal diuji. PDF/CAD saja tidak cukup untuk menghitung luas, irisan, gap, overlap, dan konsistensi atribut.",
      validation: "GeoPackage/geodatabase atau SHP/GeoJSON, rekomendasi peta dasar BIG, CRS, ketelitian, metadata, kamus data, laporan topologi, dan changelog."
    },
    {
      id: "A08", theme: "Partisipasi dan jejak keputusan", decision: "conditional", confidence: "tinggi",
      finding: "Konsultasi publik berlangsung, tetapi mekanisme respons dan keterlacakan perubahan draf belum tersedia pada baseline.",
      regulations: ["R01", "R03", "R06", "R09", "R10"],
      requirement: "Masukan masyarakat dan FPR harus didokumentasikan, dinilai, dijawab, serta dapat ditelusuri ke perubahan atau alasan penolakan.",
      ygPosition: "Setiap masukan perlu ID, pengusul, lokasi, substansi, bukti, respons, perubahan peta/pasal, penanggung jawab, dan status; ringkasan tanpa matriks respons tidak memadai.",
      validation: "Undangan, daftar pihak, materi, notulen, peta partisipatif, matriks respons, rekomendasi FPR, dan draf sebelum-sesudah."
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
      finding: "Aturan zonasi, indikator pengendalian, instansi pelaksana, program, waktu, dan pembiayaan draf belum diterima.",
      regulations: ["R02", "R07", "R08"],
      requirement: "RDTR harus dapat dilaksanakan dan diawasi melalui ketentuan kegiatan, intensitas, prasarana, ketentuan khusus, program, dan instrumen pengendalian.",
      ygPosition: "Rekomendasi perlindungan tidak cukup ditulis sebagai narasi; harus diterjemahkan menjadi geometri, aturan terukur, indikator, penanggung jawab, program, dan sumber pembiayaan.",
      validation: "Rancangan perkada, matriks kegiatan, intensitas, ketentuan khusus, indikasi program, sumber biaya, SOP pengawasan, dan indikator pemantauan."
    }
  ];
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

export function buildAnalysis({ rtrw, administration, peat, forest, mangrove }) {
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
  const summary = {
    villageCount: villages.length,
    areaHa: round(totalAreaHa),
    peatAreaHa: round(totalPeatHa),
    peatCoveragePct: round(totalPeatHa / totalAreaHa * 100, 1),
    forestAreaHa: round(totalForestHa),
    forestCoveragePct: round(totalForestHa / totalAreaHa * 100, 1),
    rtrwClassCount: new Set(rtrwMap.map(feature => feature.properties.class)).size,
    mangroveAnalysedVillageCount: villageMetrics.filter(row => row.mangrove.status === "analysed").length
  };
  const mandatoryAnalysisMatrix = buildMandatoryAnalysisMatrix(summary);
  const analysisProgramme = buildAnalysisProgramme(mandatoryAnalysisMatrix);
  const ygPlanningUnits = buildYgPlanningUnits(villages, villageMetrics);

  return {
    metadata: {
      title: "Rancangan Analitis RDTR versi YG — Kawasan Perkotaan Bagansiapiapi",
      owner: "Yayasan Gambut",
      access: "staff_only",
      status: "provisional_internal_analytical_plan",
      generatedAt: new Date().toISOString(),
      consultationDate: "2026-09-22",
      officialDraftGeometryStatus: "not_received",
      limitation:
        "Rancangan analitis internal untuk menyusun argumen dan alternatif YG sesuai tahapan regulasi. Dokumen ini bukan RDTR yang ditetapkan, naskah perkada, dasar KKPR, atau penetapan geometri/intensitas. Konflik zonasi dan angka intensitas baru dapat dinilai setelah RTRW kabupaten yang sah, KLHS, data skala 1:5.000, serta geometri dan aturan zonasi draf pemerintah terotorisasi diterima."
    },
    summary,
    readiness: [
      { id: "study-area", label: "Batas 11 kelurahan/kepenghuluan", status: "screening" },
      { id: "rtrw-province", label: "RTRW Provinsi Riau", status: "screening" },
      { id: "peat", label: "Gambut BBSDLP 2019", status: "screening" },
      { id: "forest", label: "Indikasi non-APL dari kawasan hutan SK 903", status: "screening" },
      { id: "mangrove", label: "Analisis mangrove 2016–2025", status: "partial" },
      { id: "rdtr-draft", label: "Geometri dan aturan zonasi draf RDTR", status: "missing" },
      { id: "klhs", label: "Dokumen dan peta kerja KLHS", status: "missing" },
      { id: "hazards", label: "Peta rob, banjir, abrasi, dan subsidensi", status: "missing" }
    ],
    analysisPosition: {
      title: "Posisi dan rancangan analitis Yayasan Gambut berbasis regulasi",
      statement: "Baseline menunjukkan alasan kuat untuk menahan keputusan ruang berintensitas tinggi pada area gambut, non-APL, dan pesisir. YG menyusun alternatif sementara yang mengutamakan perlindungan ekosistem, pengurangan risiko, konsolidasi pertumbuhan aman, akses masyarakat, serta pengendalian yang terukur sambil menunggu pembuktian draf pemerintah terotorisasi dan KLHS.",
      caveat: "Status Tahan, Verifikasi, dan Bersyarat adalah kesimpulan analitis internal. Rancangan YG tidak menetapkan geometri atau intensitas yang mengikat. Status Revisi hanya diberikan setelah geometri dan aturan draf pemerintah terotorisasi membuktikan ketidaksesuaian."
    },
    decisionClasses: DECISION_CLASSES,
    regulatoryAssessments: regulatoryAssessments(summary),
    regulationRegister: REGULATION_REGISTER,
    legalFramework: REGULATION_REGISTER.map(row => ({ code: row.code, theme: row.title })),
    planningWorkflow: buildPlanningWorkflow(),
    crossCuttingGates: buildCrossCuttingGates(),
    mandatoryAnalysisMatrix,
    analysisProgramme,
    ygPlan: buildYgPlan(),
    geometryRegistry: buildGeometryRegistry({
      villageCount: villages.length,
      rtrwCount: rtrwMap.length,
      peatCount: peatMap.length,
      forestCount: forestMap.length
    }),
    consultationQuestions: [
      "Apa dasar hukum dan analitis penetapan WP yang mencakup 11 wilayah, serta bagaimana keterkaitannya dengan RTRW Kabupaten Rokan Hilir yang berlaku?",
      "Bagaimana setiap perbedaan geometri atau klasifikasi terhadap RTRW Provinsi Riau dan RTRW Kabupaten Rokan Hilir dijelaskan serta didokumentasikan?",
      "Bagaimana rekomendasi KLHS mengubah tujuan, struktur, pola, intensitas, ketentuan khusus, dan indikasi program dalam draf RDTR?",
      "Bagaimana zona berintensitas tinggi diuji terhadap fungsi KHG, kedalaman gambut, muka air, subsidensi, rob, drainase, dan risiko kebakaran?",
      "Bagaimana status kawasan hutan, PBPH/persetujuan, hak/izin eksisting, perhutanan sosial, dan konflik tenurial direkonsiliasi dengan zona RDTR?",
      "Apa dasar penetapan sempadan pantai, Sungai Rokan, anak sungai, dan muara; apakah memakai data pasut, elevasi, gelombang, abrasi, rob, dan ekosistem?",
      "Bagaimana perlindungan mangrove, konektivitas pasang-surut, perikanan tradisional, ruang tambat, dan akses masyarakat pesisir diterjemahkan menjadi geometri serta aturan zonasi?",
      "Skenario penduduk, perubahan iklim, kenaikan muka laut, dan subsidensi apa yang dipakai sampai akhir umur rencana?",
      "Bagaimana masukan konsultasi publik diberi ID, dijawab, dan ditelusuri ke perubahan peta, pasal, atau alasan penolakan?"
    ],
    villages: villageMetrics,
    map: {
      studyArea: featureCollection(villages),
      ygPlanningUnits,
      rtrw: featureCollection(rtrwMap),
      peat: featureCollection(peatMap),
      forest: featureCollection(forestMap)
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
    mangrove: readJson(path.join(REPO_ROOT, "data/mangrove-priority-rokan-hilir-results.json"), "Analisis mangrove")
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
