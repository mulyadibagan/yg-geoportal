# Persiapan data indikator asli — internal

## Hasil yang benar-benar disiapkan

Jalankan di checkout repository, tanpa server localhost. Persiapan dasar memakai Node bawaan; overlay/raster memakai versi pustaka GIS yang sudah digunakan WebGIS, dipasang terisolasi di folder privat tanpa mengubah dependency produksi:

```powershell
node scripts/prepare-restoration-sources.mjs
```

Setiap eksekusi membuat direktori baru `private-data/restoration-sources-*` dan tidak menimpa paket sebelumnya. Folder ini diabaikan Git, dikecualikan dari artefak Pages dan ditolak oleh privacy guard eksisting. Paket tidak diunggah, tidak membuka endpoint, dan belum terhubung ke peta produksi. Kode persiapan dapat direview di GitHub; berkas hasil tidak boleh dimasukkan ke PR publik.

| Berkas privat | Isi |
| --- | --- |
| units.geojson | Seluruh baris BBSDLP asli, geometri tidak diubah, atribut tanah dipertahankan, QA duplikasi/wilayah, hitungan observasi hotspot dalam poligon, lima indikator null dan validated false |
| fire-archive.json | Salinan arsip bulanan asli dan indeksnya; tidak digabung atau dijumlahkan sebagai riwayat lengkap |
| manifest.json | Identitas sumber, tahun/periode yang tersedia, SHA-256, status cakupan, jumlah fitur, hasil QA dan keterbatasan |
| unit-review.json | Antrean QA privat: anggota kelompok geometri identik, kolom/nilai yang bertentangan, nomor baris sumber dan konflik KK/KABKOT; keputusan tetap null |

ID unit mengikat **nomor baris ke SHA-256 persis berkas BBSDLP**. ID unik dalam paket, tetapi bukan ID legal KHG atau identitas stabil lintas versi. Pembaruan sumber memerlukan rekonsiliasi unit. SHA bukan bukti persetujuan ilmiah.

## Temuan sumber pada 3 November 2026

- BBSDLP: 736 baris, tahun atribut 2019 pada seluruh baris, 725 geometri unik secara persis. Ada 11 baris dengan geometri yang sudah muncul, termasuk 3 baris identik penuh. Semua dipertahankan dan diberi rujukan duplikat; luas tidak dihitung ulang.
- Sebanyak 105 baris berbeda antara `KK` dan `KABKOT` setelah normalisasi penulisan. Keduanya kolom wilayah dan dipertahankan; tidak dipilih salah satunya sebagai kebenaran secara otomatis.
- Pemeriksaan lanjutan memisahkan 9 kelompok geometri identik: 8 kelompok memiliki atribut bertentangan, termasuk kelas ketebalan/jenis tanah, dan 1 kelompok sepenuhnya identik. Tiga baris identik penuh juga dapat berada di dalam kelompok yang memuat varian atribut. Karena itu geometri sama tidak boleh langsung di-dissolve atau dipilih satu kelas tanahnya. Semua anggota kelompok, termasuk kemunculan pertama, diberi flag review. Tidak ada unit yang diberi status disetujui otomatis.
- `KETEBALAN` berisi kelas kategoris, bukan kedalaman numerik hasil pengukuran. `pH` berisi kelas "Sangat Masam - Masam", bukan angka. `JNTNH1` memuat jenis tanah seperti Organosol Saprik. Tidak dikonversi menjadi skor sensitivitas.
- Snapshot hotspot pada eksekusi awal: 53.057 titik valid; tidak ada observasi yang masuk poligon BBSDLP pada snapshot tersebut. Ini bukan bukti tidak pernah terbakar. Periode dan kegagalan/cakupan provider disimpan dalam manifest. Observasi bukan kejadian unik; unit tumpang tindih dapat menerima observasi yang sama.
- Arsip indikasi terbakar: Juli 2026 3 fitur, Agustus 20, September 20, Oktober 5; seluruh laporan berstatus **partial**. Geometri adalah indikasi Sentinel-2 dNBR/NBR, bukan validasi lapangan. Fitur antarbulan dapat berulang; jumlah fitur dan luas tidak dijumlahkan sebagai total unik. Belum dilakukan overlay ke unit gambut.
- Katalog staf yang dibaca memuat 60 dataset, 59 turunan siap peta. Sumber titik kebakaran BPBD 2025/2026 dan irigasi rawa ditemukan sebagai calon bukti tambahan. Metadata kebakaran 2025 memuat konflik judul/tahun dengan identifier. Unduhan snapshot melalui browser tidak berhasil diverifikasi; data tersebut **belum** dimasukkan ke paket.
- FEG telah dapat dimuat pada halaman staf, tetapi belum diekspor ke paket analisis ini. Kelompok kode KHG dari FEG bukan batas KHG mandiri dan bukan overlay unit BBSDLP.

## Rancangan pengolahan lima indikator

Tabel berikut adalah rancangan persiapan, **bukan metode normalisasi atau nilai yang sudah disetujui**. Rentang 0–100 tidak akan diisi dari angka buatan.

| Indikator | Bahan tersedia | Pengolahan yang dapat dipersiapkan | Syarat sebelum nilai/skor |
| --- | --- | --- | --- |
| Degradasi ekosistem, 30% | BBSDLP dan konteks FEG; sebagian kelas perkebunan pada katalog | Cocokkan unit, metadata dan kelas sumber; susun inventaris gangguan yang teramati | Layer kondisi ekosistem yang cakupannya lengkap, definisi degradasi dan baseline terverifikasi; perkebunan/kawasan hutan tidak otomatis berarti degradasi |
| Riwayat kebakaran, 25% | Hotspot, arsip indikasi terbakar parsial, calon titik BPBD | Hitungan observasi per unit sudah dihitung; arsip asli dan celah cakupan disimpan | Tentukan periode seragam, selesaikan konflik metadata, QA kejadian/duplikasi, overlay terverifikasi dan aturan frekuensi/luas; hotspot bukan kejadian kebakaran terkonfirmasi |
| Gangguan hidrologi, 25% | 13 titik sekat kanal; calon poligon irigasi rawa | Inventaris sumber/jenis infrastruktur; pertahankan perbedaan irigasi, kanal drainase dan sekat | Jaringan kanal relevan, fungsi/kondisi, muka air atau proksi yang dapat diuji; keberadaan sekat/irigasi tidak sama dengan besarnya gangguan |
| Kehilangan vegetasi, 15% | Kelas tutupan lahan pada sebagian titik hotspot | Catat versi, tahun, cakupan dan keterbatasan sampel titik | Data vegetasi minimal dua waktu yang sebanding dan QA awan/kelas; titik hotspot berkelas tutupan bukan layer perubahan vegetasi menyeluruh |
| Sensitivitas gambut, 5% | Kelas ketebalan, jenis tanah, pH kelas, substratum BBSDLP | Atribut sumber per unit sudah dipertahankan tanpa konversi numerik | Aturan sensitivitas berbasis bukti; jangan mengartikan batas kelas sebagai angka kedalaman, pH terukur atau bobot otomatis |

## QA dan urutan integrasi

1. Rekonsiliasi geometri identik/bertumpang tindih dan konflik kolom wilayah. Jangan menilai atau menjumlahkan luas restorasi sebelum unit jelas.
2. Pastikan CRS, topologi, identitas dan cakupan batas KHG/FEG dengan data sumber. Validator struktur WGS84 bukan validator topologi atau batas hukum.
3. Lengkapi bahan tiap indikator pada periode dan unit yang sama; pertahankan metadata kegagalan/cakupan.
4. Dokumentasikan metode normalisasi, referensi ilmiah, reviewer dan bukti validasi yang nyata. Tidak ada penandaan validated otomatis oleh persiapan ini.
5. Jalankan `check-restoration-inputs.mjs` pada paket setelah indikator diisi dari pipeline yang sudah divalidasi. Saat ini hasil yang benar adalah **incomplete**, bukan skor nol.
6. Integrasikan paket melalui penyimpanan/API staf eksisting setelah QA akses dan izin data terverifikasi. Jangan menaruhnya di folder data statis publik. Kesiapan pelaksanaan tetap terpisah dari kebutuhan ekologis.

## Rekonsiliasi dan akuisisi tambahan, 3 November 2026

Paket dasar dilanjutkan dengan perbandingan geometri menggunakan Turf 7.2.0 dan pembacaan raster GeoTIFF 2.1.3. Versi tersebut sudah digunakan pada komponen WebGIS; runtime pemrosesan disimpan hanya di `private-data/restoration-runtime`. Ganti `<id>` dalam perintah berikut dengan direktori yang dicetak tahap sebelumnya:

```powershell
npm install --prefix private-data/restoration-runtime --no-save --ignore-scripts --no-audit --no-fund @turf/turf@7.2.0 geotiff@2.1.3
node scripts/reconcile-restoration-evidence.mjs "private-data/restoration-sources-<id>"
node scripts/acquire-restoration-gfc.mjs
node scripts/extract-restoration-tree-loss.mjs "private-data/restoration-reconciled-<id>" "private-data/restoration-gfc-<id>"
```

**Rekonsiliasi yang benar-benar diterapkan:** tiga baris yang identik sebagai Feature sumber lengkap dihilangkan hanya dari turunan `canonical-units.geojson`; hasilnya 733 unit. `reconciliation.json` mencatat hash baris sumber dan hubungan semua ID asal. Geometri sama dengan atribut tanah berbeda tetap dipertahankan. Seluruh sumber awal tetap ada. Ini penyelesaian redundansi rekaman, bukan pengesahan kelas tanah atau unit ekologis.

**Hasil pemeriksaan spasial:** delapan unit tidak lolos kombinasi `booleanValid`/`kinks` dan dikecualikan dari ekstraksi raster/overlay. Ini pemeriksaan teknis konservatif, bukan audit topologi independen. Sebanyak 101 fitur batas referensi dan 33 fitur arsip terbakar tidak lolos pemeriksaan yang sama. Tidak ada perbaikan geometri otomatis yang dapat menghilangkan atau mengubah bagian sumber.

Untuk 105 perbedaan KK/KABKOT, diperoleh bukti irisan batas pada 100 kasus. Dari keseluruhan kasus, 58 berstatus reference-overlaps-only dan 47 memiliki bukti tidak lengkap karena masalah geometri atau fitur referensi yang dikecualikan. Batas desa mengandung label multi-kabupaten/sengketa dan tahun tidak tersedia; hasilnya tidak dipakai memilih salah satu kolom sebagai administrasi resmi. Koreksi administrasi tetap null.

Arsip terbakar menghasilkan irisan indikasi pada 27 unit dari fitur yang lolos pemeriksaan. Pada 75 unit terdapat status incomplete-overlay. Tidak ada luasan terbakar per unit, pengesahan kebakaran lapangan, ataupun riwayat lengkap yang dihasilkan. Identitas kejadian dan bulan sumber disimpan agar tidak disamakan dengan kejadian unik tanpa review.

### Sumber vegetasi asli yang ditambahkan

[Global Forest Change 2000–2025 v1.13 dari UMD](https://storage.googleapis.com/earthenginepartners-hansen/GFC-2025-v1.13/download.html) menyediakan `lossyear` dan `datamask`. Akuisisi memverifikasi nama tile pada daftar resmi lalu mengambil 00N_100E dan 10N_100E untuk kedua layer. Empat berkas asli (204.967.257 byte pada pengambilan ini) disimpan privat beserta SHA-256, ETag, versi, waktu pengambilan, sumber dan atribusi Hansen/UMD/Google/USGS/NASA. Tidak ada geometri unit atau kredensial staf yang dikirim ke penyedia.

Ekstraksi memverifikasi checksum, EPSG:4326 dan keselarasan grid kedua layer. Piksel dihitung pada resolusi asli menurut pusat piksel dalam poligon, dengan lubang dikecualikan; tidak dilakukan resampling. Kode kehilangan dicatat per tahun 2001–2025 pada datamask=1, terpisah dari piksel air, nodata, nilai tidak valid dan unit tanpa pusat piksel. Jumlah piksel adalah observasi peta, **bukan estimasi hektare definitif atau skor**. Unit yang bertumpang tindih tidak boleh dijumlahkan. Indikator vegetasi tetap null karena kehilangan tutupan pohon tidak mencakup seluruh vegetasi dan metode ekologis belum disahkan. Keterbatasan sensor/versi dan estimasi luas mengikuti catatan penyedia.

Eksekusi aktual menghasilkan `units-with-evidence.geojson` dan manifest privat: 725 unit diproses, 8 dikecualikan karena geometri, 583 memiliki observasi kehilangan tutupan pohon, 66 tanpa pusat piksel native. Tidak ada nilai nodata/kode tidak valid yang ditemukan pada piksel yang dihitung; ini bukan klaim semua sumber/indikator lengkap. Semua 733 unit turunan tetap memiliki lima indikator null dan validated false. Pada 12 unit kecil yang dipilih deterministik (enam di tiap sisi khatulistiwa), hitungan native diverifikasi melalui iterasi setiap piksel dan Turf point-in-polygon secara terpisah dari algoritma scanline; seluruh hitungan cocok. Ini verifikasi implementasi, bukan validasi ketepatan ekologis peta sumber di lapangan.

[ESA WorldCover](https://esa-worldcover.org/en/data-access) menjelaskan bahwa peta 2020 dan 2021 dibuat dengan versi algoritma berbeda. Karena itu keduanya tidak dikurangkan langsung untuk mengisi indikator kehilangan vegetasi.

### Kebutuhan yang belum terselesaikan

- Data hidrologi: seri TMAT dengan periode/cakupan/kalibrasi dan jaringan drainase yang relevan belum diperoleh. Akses ke halaman resmi SiPPEG yang dicoba gagal; ini tidak membuktikan datanya tidak ada. Titik sekat kanal tidak dijadikan nilai gangguan hidrologi.
- Degradasi dan sensitivitas: belum ada dasar untuk memilih satu kelas tanah pada delapan kelompok geometri yang atributnya berbeda atau menetapkan angka sensitivitas dari kelas ketebalan/pH. Klasifikasi tutupan tidak otomatis menunjukkan degradasi.
- Kebakaran: arsip tetap parsial dan sebagian geometri tidak layak overlay; bukti hotspot/indikasi bukan riwayat terverifikasi lengkap.
- Sebanyak 115 unit turunan masih membawa flag review sumber setelah tiga baris redundan dihilangkan. Konflik 118 unit sumber tidak dinyatakan semuanya selesai. Tidak ada indikator yang diubah menjadi validated true.

Paket hasil tetap di folder privat yang diabaikan Git dan dikecualikan dari Pages. Perubahan ini tidak membuka endpoint, memperluas akses staf, mengubah menu Tools, atau memperbarui hasil prioritas produksi.
