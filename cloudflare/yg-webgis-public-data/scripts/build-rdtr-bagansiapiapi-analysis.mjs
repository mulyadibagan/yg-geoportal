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
    obligation: "RDTR harus konsisten dengan hierarki rencana, menjamin keterpaduan, keberlanjutan, keterbukaan, partisipasi, kepastian hukum, serta menyediakan instrumen pemanfaatan dan pengendalian ruang.",
    ygTest: "Uji konsistensi vertikal, keterlacakan masukan masyarakat, perlindungan fungsi lindung, dan apakah ketentuan zonasi dapat dilaksanakan serta diawasi."
  },
  {
    id: "R02", scope: "inti", code: "PP 21/2021", title: "Penyelenggaraan Penataan Ruang",
    status: "berlaku", officialUrl: "https://peraturan.bpk.go.id/Details/161851/pp-no-21-tahun-2021",
    obligation: "Mengatur penyusunan, pemanfaatan, pengendalian, pengawasan, kelembagaan, serta bentuk dan prosedur penetapan RDTR.",
    ygTest: "Uji kelengkapan wilayah perencanaan, materi teknis, rancangan peraturan, basis data, proses konsultasi, dan instrumen pengendalian."
  },
  {
    id: "R03", scope: "inti", code: "Permen ATR/BPN 11/2021 jo. 6/2026", title: "Tata Cara Penyusunan RDTR",
    status: "diubah 13 Mei 2026", officialUrl: "https://peraturan.bpk.go.id/Details/349128/permen-atrkepala-bpn-no-6-tahun-2026",
    obligation: "Mensyaratkan tim/FPR dan tenaga ahli, kajian RTR dan dokumen pembangunan, penetapan WP, persiapan data-metode-rencana kerja-instrumen survei, serta pelibatan masyarakat.",
    ygTest: "Uji dasar delineasi 11 wilayah, kompetensi tim, dokumen yang ditelaah, metodologi, instrumen survei, pengumuman, dan bukti tindak lanjut konsultasi."
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
    id: "R13", scope: "inti", code: "UU 27/2007 jo. UU 1/2014", title: "Wilayah Pesisir dan Pulau-Pulau Kecil",
    status: "berlaku dengan perubahan", officialUrl: "https://peraturan.bpk.go.id/Details/38765/uu-no-1-tahun-2014",
    obligation: "Pemanfaatan pesisir harus melindungi ekosistem, memperhatikan keterkaitan darat-laut, dan menjaga akses serta kepentingan masyarakat pesisir.",
    ygTest: "Uji konektivitas pasang-surut, mangrove, muara, perikanan tradisional, jalur akses, ruang tambat, dan dampak pembangunan daratan terhadap perairan."
  },
  {
    id: "R14", scope: "inti", code: "UU 41/1999 jo. UU 6/2023; PP 23/2021", title: "Kehutanan",
    status: "berlaku dengan perubahan", officialUrl: "https://peraturan.bpk.go.id/Details/161853/pp-no-23-tahun-2021",
    obligation: "Status, fungsi, perubahan peruntukan/fungsi, penggunaan kawasan hutan, perizinan, dan pengelolaan kehutanan mengikuti kewenangan serta prosedur kehutanan.",
    ygTest: "RDTR tidak otomatis mengubah status kawasan hutan. Uji penunjukan/penetapan termutakhir, riwayat perubahan, PBPH/persetujuan, pelepasan, dan perhutanan sosial."
  },
  {
    id: "R15", scope: "inti", code: "UU 4/2011; PP 45/2021", title: "Informasi Geospasial",
    status: "berlaku", officialUrl: "https://peraturan.bpk.go.id/Details/170444/pp-no-45-tahun-2021",
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
      finding: "Baseline YG merupakan alat penyaringan; geometri dan atribut resmi draf RDTR skala 1:5.000 belum diterima.",
      regulations: ["R04", "R15"],
      requirement: "Geometri, atribut, topologi, referensi, metadata, dan album peta RDTR harus lengkap, konsisten, dan dapat diuji.",
      ygPosition: "YG tidak akan menyebut suatu zona salah sebelum geometri resmi diuji. PDF/CAD saja tidak cukup untuk menghitung luas, irisan, gap, overlap, dan konsistensi atribut.",
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

  return {
    metadata: {
      title: "Kajian Pembanding RDTR Kawasan Perkotaan Bagansiapiapi",
      owner: "Yayasan Gambut",
      access: "staff_only",
      status: "baseline_internal",
      generatedAt: new Date().toISOString(),
      consultationDate: "2026-09-22",
      officialDraftGeometryStatus: "not_received",
      limitation:
        "Baseline internal untuk menyiapkan pertanyaan dan rekomendasi. Temuan konflik zonasi baru dapat dinilai setelah geometri dan aturan zonasi draf RDTR diterima."
    },
    summary: {
      villageCount: villages.length,
      areaHa: round(totalAreaHa),
      peatAreaHa: round(totalPeatHa),
      peatCoveragePct: round(totalPeatHa / totalAreaHa * 100, 1),
      forestAreaHa: round(totalForestHa),
      forestCoveragePct: round(totalForestHa / totalAreaHa * 100, 1),
      rtrwClassCount: new Set(rtrwMap.map(feature => feature.properties.class)).size,
      mangroveAnalysedVillageCount: villageMetrics.filter(row => row.mangrove.status === "analysed").length
    },
    readiness: [
      { id: "study-area", label: "Batas 11 kelurahan/kepenghuluan", status: "ready" },
      { id: "rtrw-province", label: "RTRW Provinsi Riau", status: "ready" },
      { id: "peat", label: "Gambut BBSDLP 2019", status: "ready" },
      { id: "forest", label: "Kawasan hutan SK 903", status: "ready" },
      { id: "mangrove", label: "Analisis mangrove 2016–2025", status: "partial" },
      { id: "rdtr-draft", label: "Geometri dan aturan zonasi draf RDTR", status: "missing" },
      { id: "klhs", label: "Dokumen dan peta kerja KLHS", status: "missing" },
      { id: "hazards", label: "Peta rob, banjir, abrasi, dan subsidensi", status: "missing" }
    ],
    analysisPosition: {
      title: "Posisi awal Yayasan Gambut berbasis regulasi",
      statement: "Baseline menunjukkan alasan kuat untuk menahan keputusan ruang berintensitas tinggi pada area gambut, non-APL, dan pesisir sampai draf RDTR dan KLHS membuktikan konsistensi hierarki, perlindungan fungsi, pengurangan risiko, serta aturan pengendalian yang terukur.",
      caveat: "Status Tahan, Verifikasi, dan Bersyarat adalah kesimpulan analitis internal. Status Revisi hanya diberikan setelah geometri dan aturan resmi membuktikan ketidaksesuaian."
    },
    decisionClasses: DECISION_CLASSES,
    regulatoryAssessments: regulatoryAssessments({
      villageCount: villages.length,
      areaHa: round(totalAreaHa),
      peatAreaHa: round(totalPeatHa),
      peatCoveragePct: round(totalPeatHa / totalAreaHa * 100, 1),
      forestAreaHa: round(totalForestHa),
      forestCoveragePct: round(totalForestHa / totalAreaHa * 100, 1),
      mangroveAnalysedVillageCount: villageMetrics.filter(row => row.mangrove.status === "analysed").length
    }),
    regulationRegister: REGULATION_REGISTER,
    legalFramework: REGULATION_REGISTER.map(row => ({ code: row.code, theme: row.title })),
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
