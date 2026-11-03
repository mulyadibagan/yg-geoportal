# Persiapan data indikator asli — internal

## Hasil yang benar-benar disiapkan

Jalankan di checkout repository, tanpa server localhost atau dependency baru:

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
