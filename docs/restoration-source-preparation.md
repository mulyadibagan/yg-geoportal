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

## Penelusuran lanjutan sumber pembanding

Pemeriksaan berikut dilakukan pada 3 November 2026, tanpa perubahan data operasional:

| Sumber diperiksa | Temuan aktual | Keputusan penggunaan |
| --- | --- | --- |
| Riwayat GitHub untuk `data/Gambut_BBSDLP_2019.geojson` | Riwayat publik saat diperiksa hanya menunjukkan commit `d826b2906f31c84e34700b7d1eb2ba316d13f39e` (15 September 2026), pesan pemulihan riwayat publik. Tidak tersedia versi sebelum itu untuk membandingkan kelas yang bertentangan. | Tidak merekonstruksi kelas ketebalan/jenis tanah dari tebakan atau ID tetangga. |
| Katalog publik Kementerian Pertanian, pencarian `gambut` | Respons aktual menggunakan `items`; hanya satu hasil pada saat diperiksa, Peta Lahan Gambut Pulau Kalimantan skala 1:50.000. | Dikeluarkan sebagai sumber pembanding Riau karena beda wilayah. Ini bukan pernyataan tidak adanya sumber Sumatera di sistem lain. |
| Distribusi ArcGIS dari metadata Kementan yang ditemukan | Link distribusi mengarah ke login server. | Tidak mengirim kredensial staf YG atau mencoba melewati autentikasi layanan lain. |
| `data/fdrs.geojson` | 10 titik inventaris FDRS, tahun 2023–2026; tidak ada kolom pengukuran muka air. Keterangan berupa inventaris/pembangunan, bukan seri pengukuran. | Bahan lokasi alat saja; tidak diubah menjadi angka TMAT, proksi hidrologi atau skor. |
| API `public-reports` yang dipakai halaman monitoring WebGIS | Snapshot asli `generatedAt` 2026-11-03T15:23:25.703Z berisi 93 laporan. Setelah membaca `proposedInformation`, `proposedChanges.monitoring` dan kolom legacy `Water_Table_Cm`, ditemukan 0 laporan bertipe hidrologi dan 0 nilai muka air yang terisi. Sumber utuh dan SHA-256 disimpan privat. | Data pengukuran tidak tersedia dalam snapshot ini; bukan muka air bernilai nol atau kondisi hidrologi baik. |

Metadata pembanding: [katalog Kementerian Pertanian yang diperiksa](https://geospasial.pertanian.go.id/katalog/cmroqmrlx002w01qjq1t2l1l1) dan [dokumentasi API publiknya](https://geospasial.pertanian.go.id/dokumentasi/api/endpoint-publik). Katalog tersebut bukan sumber Riau sehingga tidak digabungkan ke unit analisis.

### Masukan sumber yang benar-benar diperlukan untuk melanjutkan

1. Salinan sumber BBSDLP/metadata atribut dan referensi wilayah yang dapat digunakan untuk memutuskan kelas pada delapan kelompok geometri berbeda atribut serta 105 perbedaan KK/KABKOT. Memilih nilai mayoritas atau kelas poligon tetangga tidak menyelesaikan provenance.
2. Pengukuran hidrologi aktual: ID stasiun, koordinat dan referensi elevasi/permukaan, waktu pengukuran, nilai beserta satuan/tanda, protokol/kalibrasi, sumber dan versi. Lokasi alat tanpa pengukuran tidak mencukupi.
3. Bukti kondisi/degradasi dan aturan sensitivitas pada unit/periode yang disepakati. GFC hanya bukti kehilangan tutupan pohon; tidak membuktikan gangguan hidrologi atau sensitivitas gambut.

Sampai sumber tersebut dapat diperoleh atau aksesnya tersedia, pekerjaan yang tersisa terblokir oleh data/pembuktian, bukan fungsi scoring. Seluruh lima indikator dan persetujuan tetap kosong. PR ini dapat ditinjau sebagai pekerjaan persiapan data; tidak boleh disebut hasil prioritas restorasi yang sudah selesai.

## Sumber TMAT dan pembanding BBSDLP, 4 November 2026

### TMAT: pisahkan aktual dari prakiraan

[Portal TMAT](https://tmat-klh.inarth.or.id/) menautkan dua aplikasi berbeda:

- [Prakiraan Riau](https://inarth.shinyapps.io/TMAT-Riau/): menampilkan baseline 22 Agustus 2026, 125 titik dan prakiraan tujuh hari. Ini keluaran model, bukan pengukuran aktual. Tidak digunakan untuk indikator hidrologi.
- [Kanal aktual nasional](https://tmat.shinyapps.io/TMAT-aktual-nasional/): saat diperiksa, header bertanggal 14 Juli 2026. Pilihan Riau menampilkan 263 titik menurut tiga kategori; tooltip satu titik di panel Rokan Hulu menampilkan `Normal: -23 cm`. Tanggal header bukan bukti waktu pengukuran titik tersebut. Tampilan yang diperiksa tidak menyediakan ID stasiun, koordinat, waktu per rekaman, protokol/kalibrasi atau ekspor seri yang memadai. Angka tooltip belum dipasangkan dengan unit analisis dan tidak dimasukkan sebagai nilai indikator.

Legenda kanal aktual menggabungkan kondisi sangat rendah dan tanpa data dalam salah satu kategori; jumlah kategori tidak boleh dipakai sebagai ukuran gangguan hidrologi. Portal memakai identitas KLH/BPLH pada host non-pemerintah: hubungan penerbit, metode dan otoritas dataset masih perlu diverifikasi. Tidak ada kredensial staf YG yang diberikan ke layanan tersebut. Akses tampilan publik tidak berarti data pengukuran telah tervalidasi.

### Pembanding resmi yang ditemukan

[Laporan Tahunan BBSDLP 2019](https://sdlahan.brmp.pertanian.go.id/informasi-publik/download/laporan-tahunan/laporan-tahunan-bbsdlp-2019), diterbitkan 2020, bagian 4.1 pada halaman cetak 29 (halaman PDF 46), menjelaskan kelas kedalaman gambut Sumatera. Kelas ditulis sebagai interval/kategori; laporan tidak menyediakan keputusan kelas untuk delapan kelompok geometri lokal yang berkonflik. Batas kategori tidak diubah menjadi kedalaman titik tengah atau skor sensitivitas. Nilai tepat 700 cm tidak ditafsirkan sendiri karena teks menggunakan batas `<700` dan `>700`.

[Layanan publik BIG, layer 48](https://kspservices.big.go.id/satupeta/rest/services/PUBLIK/SUMBER_DAYA_ALAM_DAN_LINGKUNGAN/MapServer/48) menyediakan **Peta Fungsi Ekosistem Gambut Skala 1:50.000**, dengan atribut `kode_khg`, `peat_thick`, `tnh_gambut`, `feg_peat` dan `feg_50k`. Indeks aktual menghasilkan 9.141 ID objek untuk filter kode publik `KHG.14%` atau `KHG.12-14%`. Filter kode ini bukan klip batas administrasi Riau. Atribut ketebalan berupa rentang teks; sumber ini bukan salinan asli BBSDLP 2019. Tahun geometri tidak ditetapkan dari tahun SK dalam deskripsi layanan.

`scripts/acquire-restoration-big-reference.mjs` mengambil metadata, indeks ID publik, lalu GeoJSON asli per 100 objek; setiap respons diperiksa identitas/jumlah objek dan SHA-256. Tidak ada penyederhanaan geometri, pengiriman footprint lokal, kredensial staf atau pengesahan indikator. Respons dibatasi 64 MiB, keseluruhan 256 MiB, dan setiap permintaan maksimum tiga percobaan. Hanya paket dengan `manifest.json` final boleh dianggap akuisisi lengkap. Direktori parsial akibat timeout tetap privat dan **belum layak menjadi pembanding lengkap**. Pada pemeriksaan ini unduhan lengkap belum berhasil; enam bagian pada salah satu percobaan tersimpan, tanpa manifest final.

```powershell
node scripts/acquire-restoration-big-reference.mjs
node --test tests/restoration-big-reference.test.cjs
```

Permintaan berdasarkan bounding box geometri lokal ditolak pemeriksaan persetujuan otomatis karena berpotensi mengungkap lokasi internal. Akuisisi diganti menggunakan kode KHG dan ID objek publik saja; pencocokan geometri harus berlangsung lokal setelah paket lengkap terverifikasi. Tidak ada data privat yang dikirim sebagai parameter pencarian.

**Keputusan analisis:** konflik kelas dan administrasi belum ditutup. Seluruh indikator tetap null/tidak tervalidasi, termasuk hidrologi. Langkah selanjutnya ialah menyelesaikan unduhan referensi publik, melakukan overlay lokal dengan pemeriksaan topologi, dan memperoleh seri TMAT yang memiliki metadata pengukuran. Tidak ada perubahan produksi, menu publik, endpoint atau akses staf pada tahap ini.

## Akuisisi lengkap dan perbandingan lokal, 4 November 2026

Status unduhan BIG di bagian sebelumnya adalah hasil percobaan awal. **Kelanjutan berhasil:** 9.141 fitur, 92 bagian GeoJSON asli, 34.690.554 byte, beserta metadata, indeks ID dan manifest final tersimpan hanya di `private-data`. Proses dapat dilanjutkan dari direktori parsial; semua bagian yang dipakai ulang diperiksa lagi jumlah/identitas objeknya. Pemrosesan offline memverifikasi checksum metadata, indeks dan seluruh bagian, memastikan setiap ID dari indeks hadir tepat sekali, serta mencocokkan total byte/fitur. Ini snapshot pengambilan bertahap, bukan jaminan transaksi atomik layanan atau validasi lapangan.

`compare-restoration-big-reference.mjs` memverifikasi hash sumber BBSDLP 2019 sebelum membandingkan delapan kelompok geometri identik yang berbeda atribut. Semua delapan geometri kelompok lolos pemeriksaan konservatif Turf booleanValid/kinks. Tujuh kelompok tidak memiliki kandidat bounding box dari paket FEG; satu kelompok memiliki satu kandidat tetapi tidak ada irisan poligon positif. Hasil delapan kelompok adalah `no-reference-overlap`, tanpa error overlay atau fitur kandidat yang dikecualikan. Tidak ada geometri yang digeser, diperluas atau diisi dari tetangga agar menghasilkan kecocokan. Kontrol positif memakai poligon sumber asli yang sama berhasil menghasilkan irisan pada tes. **Tidak ada konflik kelas yang dapat diputuskan dari referensi FEG ini.** Referensi ini juga tidak menyediakan atribut administrasi yang dapat mengesahkan koreksi KK/KABKOT.

### Seri TMAT resmi yang berhasil diperoleh

[SiTMAT Kementerian Lingkungan Hidup](https://sitmat.kemenlh.go.id/) memuat peta publik melalui `/api/air-gambut` dan detail stasiun melalui `/api/air-gambut/masyarakat/station-detail`. Endpoint tersebut ditemukan pada bundle publik situs resmi; akuisisi tidak menggunakan login, token YG, kanal konsesi atau endpoint yang memerlukan autentikasi.

`acquire-restoration-tmat.mjs` memperoleh indeks publik 125 stasiun dan memilih 37 titik menggunakan envelope regional publik tetap, **bukan** klip administrasi Riau atau footprint internal. Semua 37 respons detail permintaan 30 hari berhasil diperoleh, dengan ID sumber, koordinat indeks, tanggal pengambilan, URL dan SHA-256. Semua respons terpilih bersumber `simatag`. Dua puluh dua stasiun memiliki 19.846 baris pada `ListIOTSensorWaterLevel`; 15 stasiun memiliki seri kosong. Angka tersebut menghitung representasi detail saja, tidak ditambahkan dengan representasi ringkasan harian `history`.

`audit-restoration-tmat.mjs` memverifikasi paket lengkap, identitas, checksum dan kesesuaian koordinat indeks/detail. Pada 19.846 baris terdapat kolom `Tanggal`, `Jam`, dan `WaterLevel`; seluruh nilai pada kolom seri yang terisi lolos pembacaan numerik ketat, tetapi terdapat dua pengulangan tanggal/jam dengan nilai berbeda pada satu stasiun. Nilai bertentangan dipertahankan dalam sumber dan ditandai; tidak dipilih, dirata-ratakan atau dihapus otomatis. Nilai kosong/NaN tidak diganti nol. Angka nol yang benar tetap nol.

Pencocokan titik dilakukan **lokal** terhadap batas desa referensi dan BBSDLP: 16 dari 37 titik masuk batas referensi Riau, 14 masuk setidaknya satu poligon BBSDLP. Dari 16 titik dalam referensi Riau, tujuh memiliki seri, berjumlah 8.978 baris; ketujuhnya juga masuk poligon BBSDLP. Keberadaan titik dalam poligon tidak mengesahkan kondisi hidrologi seluruh poligon. Label provinsi/kabupaten respons stasiun kosong; hasil overlay dicatat sebagai konteks batas referensi, bukan koreksi administrasi resmi. Hash kedua sumber geometri dicatat pada audit.

**Metadata masih belum lengkap untuk indikator:** respons belum menyatakan satuan secara eksplisit; antarmuka publik memakai cm untuk Simatag, tetapi ini dicatat sebagai bukti label tampilan. Zona waktu pengukuran, datum permukaan tanah, metode/kalibrasi sensor, kualitas pengukuran serta keterwakilan spasial belum terverifikasi. String tanggal/jam asli dipertahankan tanpa menambahkan offset zona waktu. Permintaan 30 hari tidak membuktikan 30 hari rekaman lengkap pada setiap stasiun. Sumber ini merupakan kemajuan dari tooltip tanpa identitas, tetapi belum layak diberi `validated:true` atau skor hidrologi.

```powershell
node scripts/acquire-restoration-big-reference.mjs "private-data/restoration-big-reference-<id>"
node scripts/compare-restoration-big-reference.mjs "private-data/restoration-big-reference-<id>"
node scripts/acquire-restoration-tmat.mjs
node scripts/audit-restoration-tmat.mjs "private-data/restoration-tmat-<id>"
```

Semua hasil dan seri mentah tetap di direktori privat yang diabaikan Git dan dikecualikan dari Pages. Yang masuk branch review hanya script, tes dan dokumentasi agregat. Tidak ada upload data ke API staf, perubahan database, deploy atau menu baru. Kelanjutan paling penting adalah memperoleh sumber BBSDLP yang benar-benar mencakup delapan lokasi konflik dan metadata pengukuran dari pengelola SiTMAT; tidak mengganti kekosongan dengan skor perkiraan.

### Penelusuran dan audit waktu lanjutan

[Dataset Trase](https://trase.earth/open-data/datasets/spatial-metrics-indonesia-peat-area) merujuk peta resmi Kementan edisi Desember 2019, tetapi produk yang ditampilkan berupa agregat negara/provinsi/kabupaten. Agregat luas tidak dapat memilih kelas kedalaman atau memperbaiki geometri kasus lokal, sehingga tidak digunakan sebagai pengganti sumber spasial BBSDLP.

[Halaman metodologi Inarth](https://inarth.or.id/peatland-gwl-national-project) yang berhasil dibaca melalui HTTP menjelaskan prakiraan mingguan berbasis regresi/machine learning, data iklim prakiraan dan dinamika GWL sebelumnya. Ini bukan dokumentasi satuan, zona waktu, datum atau kalibrasi stasiun Simatag; tidak dipakai mengesahkan seri pengukuran.

Audit lokal kini memeriksa tanggal kalender yang benar, batas jam/menit/detik, serta kesetaraan penulisan tanggal dan jam. Kalender dinormalisasi hanya untuk mengenali waktu lokal yang sama, tanpa menetapkan zona waktu. Audit menyimpan setiap kelompok nilai bertentangan dengan indeks rekaman asli, tanggal/jam/nilai mentah dan `selectedValue:null`. Rentang hari teramati dicatat terpisah dari kelengkapan periode; tidak diasumsikan interval pengukuran atau 30 hari lengkap. Eksekusi ulang tetap menemukan dua rekaman berulang dengan nilai berbeda; tidak ada perubahan nilai sumber atau scoring.

[Bahan permintaan verifikasi sumber](restoration-source-verification-requests.md) disiapkan untuk pengelola BBSDLP dan SiTMAT. Dokumen tersebut belum dikirim; rincian geometri dan kasus stasiun tetap di audit privat. Penyelesaian substantif masih memerlukan bukti sumber, bukan perubahan ambang skor atau penambahan proksi.

### Kanal memperoleh sumber asli

Pencarian indeks ArcGIS publik memakai kata kunci umum menemukan kandidat `Lahan Gambut Riau` (item `1ee13e3579cc434289f6a95a458d5724`). Metadata item tidak menyebut sumber/tahun peta, sementara layer hanya menyediakan `Jenis_Laha` dan kolom luas/panjang; tidak ada kelas kedalaman, jenis tanah atau riwayat koreksi. Kandidat ini tidak diunduh sebagai pengganti BBSDLP 2019 dan tidak digunakan memutuskan konflik.

[Halaman layanan resmi BRMP SDLP](https://sdlahan.brmp.pertanian.go.id/informasi-publik/informasi-geospasial-tematik) menyediakan jalur permohonan data SHP dengan surat resmi, identitas, proposal dan batas penelitian. Halaman menyebut peta gambut sebagai layanan PNBP; tarif dan ketersediaan versi Riau belum dikonfirmasi. Tujuan dan CC layanan sudah diverifikasi dari halaman resmi dan draf pertanyaan awal tanpa lampiran disiapkan pada dokumen permintaan sumber. Belum ada pengiriman pesan, pengajuan identitas/geometri, persetujuan tarif atau pembayaran. Kebutuhan sumber kini mempunyai kanal tindak lanjut yang jelas; belum berarti datanya sudah diperoleh.

Pencarian alternatif berikutnya berhasil memperoleh tiga berkas riset dengan checksum penerbit dan lisensi CC BY 4.0, serta menemukan repositori kanal resmi berlisensi CC BY 3.0. Rincian cakupan, status unduhan dan keterbatasannya ada pada [daftar sumber alternatif](restoration-alternative-sources.md). Dataset tersebut belum mengesahkan indikator atau koreksi BBSDLP.
