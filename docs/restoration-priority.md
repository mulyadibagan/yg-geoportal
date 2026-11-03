# Analisis Prioritas Restorasi Gambut — pengembangan internal

Baseline PR #507 telah di-merge dan terbit pada 1 November 2026. Perubahan 3 November di bawah disiapkan pada branch/PR terpisah dan belum diterbitkan. Modul belum menghasilkan prioritas ekologis nyata karena lima indikator belum lengkap/tervalidasi.

## Pengelompokan FEG menurut kode KHG — 3 November 2026

- Tombol `Gunakan kode KHG dari FEG` memuat endpoint FEG staf yang sama, setelah gerbang backend berhasil. Tidak ada endpoint, menu publik atau akses baru. Pemuatan checkbox FEG dan tombol yang bersamaan berbagi satu permintaan; kegagalan dapat dicoba ulang.
- Pilihan dibuat hanya dari `kode_khg` dan `nama_khg` sumber. Kode kosong/penanda tidak tersedia tidak diubah menjadi kelompok rekaan. Perbedaan nama untuk kode yang sama dilaporkan; kode berbeda tetap kelompok berbeda meskipun namanya sama.
- Setiap pilihan menyorot kumpulan poligon FEG asli sebagai FeatureCollection, tanpa dissolve, simplifikasi, overlay, agregasi luas, atau perubahan geometri sumber. **Bagian FEG menurut KHG bukan batas KHG mandiri.**
- Jumlah fitur tanpa kode/nama, geometri yang tidak lolos pemeriksaan struktur, dan konflik nama ditampilkan. CRS/struktur mengikuti validator referensi; ini bukan validasi topologi/keutuhan batas KHG atau persetujuan scoring.
- Sumber fokus aktif terlihat jelas. Katalog KHG mandiri dan kelompok FEG dapat dipilih secara eksplisit; mengaktifkan layer FEG tidak menimpa fokus katalog yang sudah aktif. Mematikan FEG menghapus sorotan kelompok FEG.
- Ringkasan tetap memakai kabupaten dan luas poligon gambut sumber utuh. Skor/kesiapan pelaksanaan tidak berubah dan tetap belum dinilai. Geometri serta kelompok hanya berada di memori browser, tidak ditulis ke repository atau penyimpanan browser.
- `tests/restoration-feg-selection.test.cjs` menguji alur kontrol dengan DOM/Leaflet tiruan terisolasi, bukan browser berlogin atau hasil spasial nyata. Test mempertahankan identitas geometri sumber, ringkasan/skor, pemuatan bersama, pergantian sumber dan retry. Data numerik sintetis hanya berada dalam unit test.
- **45 test terkait lulus**. Pengelompokan baru belum diverifikasi dengan respons FEG privat nyata di hosting; itu memerlukan publikasi perubahan yang belum diizinkan pada tahap ini. Baseline 424 fitur FEG nyata telah diuji saat deploy #507.

## Akses dan publikasi

- Origin aplikasi yang didukung: `https://webgisyg.id`, sesuai CORS API dan callback SSO staf eksisting. Tidak lagi menggunakan alur localhost.
- Dokumen mulai dengan `workspace` tersembunyi. Tidak ada peta, geometri, atau katalog dimuat sebelum sesi tersedia dan token diverifikasi backend melalui GET `/api/staff/riau-geoportal/catalog`.
- Sesi dari localStorage saja tidak dipercaya. Respons 401/403, jaringan gagal, atau format katalog salah menutup akses. HTTP, host lain, dan iframe tidak mengirim token atau membuka workspace.
- FEG dan geometri katalog memakai endpoint staf eksisting dengan Bearer header. Tidak ada endpoint/backend baru atau perubahan database.
- Repository dan shell HTML/JS statis bersifat publik. Ini bukan proteksi server pada berkas HTML. Data privat tetap dilindungi backend; tidak ada geometri privat/token disimpan dalam repository. Jangan menyimpan hasil analisis privat sebagai aset statis publik.
- Pintu masuk hanya ditambahkan di `staff-riau-reference.html`. Dashboard publik tidak diubah.
- Draft PR tidak menerbitkan modul. Workflow validasi baru hanya menjalankan pemeriksaan/test dengan izin `contents: read`; tidak memiliki langkah deployment. Merge ke main belum diizinkan karena akan memicu workflow Pages eksisting.

## Implementasi

- `restoration-priority.html`, `css/restoration-priority.css`: peta Leaflet 1.9.4, filter kabupaten, panel layer, popup, ringkasan, legenda dan tampilan desktop/tablet.
- `js/restoration-priority.js`: gerbang staf dan pemuatan data sesuai pilihan. Ringkasan memakai jumlah `Luas_Ha` poligon gambut sumber utuh; bukan luas restorasi/luas irisan KHG.
- `js/restoration-scoring.js`: lima indikator berbobot 30/25/25/15/5%, normalisasi 0–100, kategori tinggi >=75, sedang >=50 dan <75, rendah <50. Semua indikator sementara dianggap kritis. Null/kosong/nonfinite tidak menjadi nol; tidak ada pembobotan ulang.
- Indikator membutuhkan nilai numerik, bukti validasi/reviewer, sumber/tahun/versi, serta batas dan metode normalisasi. Data di luar rentang, tanpa provenance, atau belum tervalidasi menghasilkan status belum dinilai. Hasil menyimpan nilai, provenance, normalisasi dan versi model.
- Kesiapan pelaksanaan tidak digabung ke skor ekologis.
- `js/restoration-catalog.js`: kandidat KHG dengan UUID unik, status display siap, SHA-256, ukuran <=12 MiB dan jumlah fitur. Respons dicocokkan ukuran/checksum/jumlah fiturnya sebelum diperiksa sebagai Polygon/MultiPolygon WGS84, ring tertutup dan koordinat valid. Ini pemeriksaan struktur, bukan QA topologi/persetujuan scoring.
- Pemilih KHG hanya menyorot/fokus peta. Belum mengubah ringkasan atau melakukan overlay/luas irisan. Nama berasal dari atribut sumber; fallback berupa nomor poligon, bukan nama rekaan.
- `data/restoration-priority-sources.json`: registry sumber. Metadata snapshot yang berubah dicatat dari generatedAt/periode aktual ketika layer dimuat; metadata yang belum diketahui tidak ditebak.
- `scripts/verify-restoration-access.mjs`: enam probe OPTIONS/GET tanpa kredensial untuk pemeriksaan CORS dan penolakan anonim; tidak membaca token/penyimpanan browser.

## Data asli dan batas interpretasi

- BBSDLP 2019: 736 poligon. Baseline audit 29 Oktober menghasilkan jumlah luas sumber 3.557.870,32 ha; filter Siak 38 poligon dan 87.454,82 ha. Ini atribut sumber, bukan luas irisan KHG. Jangan memakai `Shape_Area` derajat persegi sebagai hektare.
- Batas Riau: turunan dissolve/simplifikasi batas desa untuk konteks kartografis, bukan batas hukum.
- Sekat kanal terpetakan: titik infrastruktur, bukan jaringan kanal atau ukuran gangguan hidrologi.
- FIRMS confidence tinggi: titik dipilih secara spasial dalam gambut tersaring. Hasil nol titik pada suatu snapshot bukan bukti tidak ada kebakaran dan tidak otomatis menjadi skor nol.
- Estimasi terbakar Sentinel-2 dNBR/NBR: konteks referensi, bukan validasi lapangan. Filter kabupaten memakai atribut; tidak di-clip ulang dan tidak masuk ringkasan luas gambut.
- Belum tersedia indikator degradasi, riwayat kebakaran tervalidasi, hidrologi, perubahan vegetasi antarwaktu dan sensitivitas gambut yang disetujui. Seluruh hasil ekologis tetap belum dinilai.

## Verifikasi nyata pada 1 November 2026

Melalui browser dan UI staf eksisting secara baca-saja:

- Login Google YG berhasil menggunakan alur yang tersedia, tanpa memindahkan token atau mengubah akun/izin. Login membuat sesi normal pada layanan autentikasi eksisting; tidak mengubah data operasional.
- Workspace `webgis.html?workspace=riau-reference` memuat 59 layer siap-peta dan menunjukkan sesi staf.
- FEG SK.130 berhasil dimuat: status UI **424 fitur**, geometri terlihat, popup menampilkan kode/nama KHG serta dasar SK.130/MENLHK/SETJEN/PKL.0/2/2017. Ini bukti pemuatan pada halaman peta eksisting, bukan pengujian halaman baru yang belum diterbitkan.
- Tidak ditemukan label KHG mandiri pada 59 layer siap-peta. Arsip belum siap-peta tidak diperiksa penuh; tidak disimpulkan bahwa KHG tidak ada di seluruh backend. Atribut KHG pada FEG bukan pengganti batas KHG mandiri.
- Halaman katalog terpisah sempat menghasilkan `Failed to fetch`; workspace pada peta berhasil. Penyebab belum dipastikan dan produksi tidak diubah.
- Probe tanpa token pada katalog, FEG dan introspeksi sesi menghasilkan **401**. Preflight localhost menghasilkan 204 dengan allowed-origin `https://webgisyg.id`, sehingga localhost tidak diizinkan. Alur kemudian dipindahkan ke target origin WebGIS sesuai arahan pengguna.
- Screenshot yang mengandung peta privat dan hasil probe lokal tidak dimasukkan ke GitHub; dilindungi `.gitignore`.

## Pengujian

```text
node --test tests/restoration-priority.test.cjs tests/restoration-catalog.test.cjs tests/restoration-feg-selection.test.cjs tests/riau-geoportal-internal.test.cjs tests/riau-reference-workspace.test.cjs tests/riau-reference-loading.test.cjs
node --check js/restoration-priority.js
node --check js/restoration-scoring.js
node --check js/restoration-catalog.js
```

**45 test lulus**: scoring dan batas kategori, data kosong, metadata/metode belum valid, data BBSDLP asli, lubang poligon, urutan verifikasi backend sebelum pembukaan workspace, iframe, HTTP/host tidak diizinkan, 401/403/503, jaringan/format respons gagal, checksum/stream/geometri KHG, pengelompokan FEG dan regresi workspace eksisting.

QA UI baseline sebelum perubahan target hosting: desktop 1440x1000 dan tablet 820x1180 tanpa overflow; peta, filter Siak, popup, sekat kanal dan estimasi terbakar memakai data asli, dengan autentikasi fixture terisolasi. QA tersebut bukan uji SSO halaman baru. Akses/FEG nyata diverifikasi terpisah seperti dijelaskan di atas.

Baseline setelah deploy #507: workspace staf, 424 fitur FEG dan filter Siak (38 poligon) berhasil pada origin WebGIS. Browser tanpa sesi ditolak; endpoint privat menghasilkan 401 dan jalur statis privat 404. Belum diuji: pengelompokan FEG baru pada hosting, pemuatan KHG mandiri nyata, QA topologi/overlay dan skor ekologis nyata.

## Langkah berikutnya

1. Review draft PR dan hasil CI, tanpa merge/deploy sampai ada instruksi publikasi.
2. Uji halaman baru pada origin/preview terotorisasi yang mendukung SSO dan CORS staf; jangan melemahkan CORS atau memindahkan token.
3. Temukan batas KHG resmi dengan ID stabil dan metadata. Setujui unit analisis, QA CRS/topologi/cakupan dan metode luas irisan.
4. Siapkan pipeline indikator spasial tervalidasi dan review ahli gambut; kesiapan pelaksanaan tetap proses terpisah.

## 3 November 2026 — pintu masuk staf dan wilayah kajian

Pembaruan navigasi: tautan beranda dipindahkan ke **Tools → Prioritas Restorasi Gambut**, dibuat hanya saat sesi staf masih berlaku. Perubahan focus/storage memeriksa kembali sesi dan menghapus tautan bila tidak berlaku. Akses dari Peta Referensi Riau serta verifikasi backend pada halaman tetap dipertahankan.

Usulan lanjutan setelah PR #512/#513: menu utama Beranda menampilkan Prioritas Restorasi hanya pada sesi staf yang masih berlaku. Ini hanya visibilitas navigasi; halaman tetap memerlukan verifikasi backend sebelum membaca data dan membuka workspace. Tidak ada endpoint atau data privat baru.

Tampilan merangkum kabupaten dari atribut KABKOT BBSDLP 2019, luas sumber Luas_Ha, jumlah poligon dan status penilaian. Kabupaten tidak menggantikan batas KHG; tidak ada luas irisan maupun luas restorasi yang dihitung. Semua lima indikator tetap wajib. Rincian layer, sumber, cakupan dan metode dapat diperluas. Pemilih KHG tetap menggunakan FEG privat yang sudah tersedia.

Validasi perubahan ini menggunakan unit/integration test Node termasuk sumber BBSDLP asli, visibilitas sesi, akses gagal tertutup, pengelompokan wilayah, filter dan FEG. Tampilan desktop/tablet versi perubahan ini belum diperiksa dengan browser; uji FEG produksi sebelumnya pada PR #512 tidak menggantikan uji tampilan baru.
