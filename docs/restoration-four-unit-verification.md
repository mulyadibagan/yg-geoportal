# Verifikasi empat kandidat dengan pembanding hutan

## Ruang lingkup dan hasil

Pemeriksaan 4 November 2026 menggunakan kembali empat unit dengan pusat piksel kanal/jalan 2017 dalam jejak piksel kehilangan tutupan pohon yang memuat respons BPBD 2025. Tidak ada perubahan akses staf, endpoint, menu, sumber operasional atau produksi. Hasil tetap privat dan belum merupakan prioritas final.

Pembanding yang berhasil dibaca adalah **JRC Tropical Moist Forest v1.2025, dikemas ulang oleh Epoch sebagai COG** melalui [Source Cooperative](https://source.coop/epoch/jrc-tmf/README.md). Produsen ilmiah adalah European Commission Joint Research Centre; kemasan ulang tidak menyiratkan dukungan Komisi Eropa. Kelas ditafsirkan menggunakan [panduan resmi JRC 2025](https://forobs.jrc.ec.europa.eu/static/tmf/TMF_DataUsersGuide.pdf), bukan interpolasi warna pada QML tahunan. Dokumentasi mirror dan panduan disimpan beserta checksum.

Tiga layer dibaca pada grid native: AnnualChange_2024, AnnualChange_2025 dan TransitionMap_Subtypes. Nama tile N10_E100 hanya memilih objek publik; posisi piksel dihitung dari georeferensi raster sebenarnya. Sembilan rekaman respons berada pada lima sel JRC berbeda. Pembacaan rentang byte berjumlah 1.179.660 byte, bukan unduhan tiga raster lengkap atau cakupan seluruh poligon.

| Bukti pada sampel | Jumlah unit | Interpretasi yang diperbolehkan |
| --- | ---: | --- |
| Kelas tahunan 2025 = lahan terdeforestasi | 4 | Bukti penginderaan jauh pada lokasi sampel, bukan seluruh luas unit |
| Hutan 2024 menjadi lahan terdeforestasi 2025, subtipe 53 | 1 | Penguatan bukti bukaan hutan 2025, belum validasi tekanan atau sebab kebakaran |
| Kelas 2024 sudah terdeforestasi, tetapi subtipe menyebut mulai 2025 | 1 | Simpan ketidaksesuaian waktu; jangan memperbaiki atau menebak tahun |
| Kelas 2024/2025 terdeforestasi dan subtipe bukaan lama | 2 | Bukaan historis tetap relevan untuk peninjauan restorasi; tidak mensyaratkan bukaan baru 2025 |
| Kondisi kanal terkini terverifikasi | 0 | Tetap unknown; tidak diganti oleh kelas hutan, jalan atau inventaris sekat |

Ketiadaan kelas perkebunan pada lima sampel bukan bukti tidak ada perkebunan dalam empat poligon. Kelas tahunan 6 mencakup non-TMF dan data tidak tersedia; tidak dianggap ketiadaan hutan yang sudah terverifikasi. Tidak ada luas, skor, peringkat ekologis, persetujuan batas atau label prioritas final dibuat.

## Sumber dan keterbatasan kanal

Paket audit database yang sudah ada tidak mencatat objek inventaris FDRS/sekat atau laporan hidrologi kandidat yang berimpit dengan keempat unit. Ini hanya cakupan paket tersebut, bukan klaim seluruh arsip kosong. Tab internal Canal Block dibaca ulang pada rentang A1:AA30; isinya inventaris pembangunan, bukan pemeriksaan kondisi kanal. Peta sebaran sekat internal berskala regional juga tidak membuktikan kanal di lima sel sampel. Referensi dan cuplikan terbatas disimpan privat; tidak ada data personel/keuangan yang diteruskan ke modul.

Data yang masih diperlukan untuk penetapan: garis kanal atau dokumentasi lapangan bertanggal yang dapat dicocokkan dengan lokasi, membedakan kanal dari jalan serta mencatat kondisi terbuka/tertutup dan fungsi drainasenya. Tidak meminta seri TMAT. Bukti kelas hutan pada titik tidak otomatis mengesahkan seluruh poligon sebagai wilayah intervensi.

## Akses sumber dan reproduksi

[Endpoint resmi JRC](https://forobs.jrc.ec.europa.eu/TMF/data) mengembalikan nama berkas versi dan header raster yang sah, tetapi transfer raster lengkap berhenti karena timeout. Berkas parsial tidak dipakai. Tidak ada upaya melewati HTTP 403 MapBiomas. Mirror dipakai sebagai pembanding beratribusi dan **belum diverifikasi identik terhadap raster JRC asli lengkap**; keterbatasan ini disimpan pada hasil. Rentang byte memerlukan HTTP 206, Content-Range tepat, ETag stabil, batas 2 MiB per respons/32 MiB total serta checksum setiap berkas. Tidak ada koordinat privat di URL permintaan; server menerima nama tile publik dan rentang byte.

```powershell
# Opsional: unduh raster JRC asli; paket hanya sah setelah manifest lengkap terbit.
node scripts/acquire-restoration-jrc-forest.mjs

# Baca pembanding COG pada koordinat respons asli yang sudah lolos pemeriksaan lokal.
node scripts/review-restoration-four-unit-forest.mjs <paket-review-kanal> <paket-BPBD> <paket-audit-database>

# Baca ulang nilai dari rentang tersimpan, tanpa jaringan.
node scripts/review-restoration-four-unit-forest.mjs --verify <paket-hasil-lengkap>
```

Keluaran `review.json`, `review-units.geojson`, dokumen sumber, rentang byte dan `manifest.json` berada hanya dalam direktori diabaikan Git `private-data`. Empat geometri BBSDLP asli dipertahankan tanpa perubahan, nilai skor null dan persetujuan false. Pembacaan ulang lokal memverifikasi 27 nilai sumber serta interpretasinya tanpa jaringan. Tiga unit test baru memeriksa kelas kosong/non-TMF/perkebunan, konflik waktu, rentang tidak lengkap/berubah dan pembatasan URL publik. Total 122 tes lokal lulus, termasuk regresi akses staf dan privasi. UI browser tidak diuji ulang karena tahap ini hanya mengubah alat bukti offline.

## Paket pemeriksaan lokasi, 5 November 2026

`prepare-restoration-site-review.mjs` menyiapkan lima target dari koordinat BPBD asli pada empat unit. Sembilan rujukan respons dipertahankan; catatan berulang pada koordinat identik dalam unit yang sama dikelompokkan untuk pemeriksaan, tanpa menyimpulkan kejadian kebakaran unik. Koordinat tiga dimensi sumber dipertahankan utuh; komponen Z tidak ditafsirkan sebagai pengukuran tinggi. Tidak ada titik kanal, garis kanal atau titik tengah baru yang dibuat.

```powershell
node scripts/prepare-restoration-site-review.mjs <paket-hasil-hutan> <paket-BPBD> <paket-metadata-STAC>
```

Sebelum ekspor, 27 nilai raster dibaca ulang dari rentang tersimpan tanpa jaringan. Identitas unit, keanggotaan poligon, koordinat dan tanggal dibandingkan dengan sumber BPBD yang checksum-nya diperiksa. Metadata koleksi dan item STAC `N10_E100_2024`, `N10_E100_2025` dan `N10_E100` diperiksa terhadap versi koleksi 1.2025, URL aset, ukuran berkas dan grid raster aktual. Metadata cocok, tetapi tidak menjelaskan ketidaksesuaian antara kelas tahunan dan transisi pada satu unit: konflik tetap terbuka, tidak diperbaiki otomatis. Tidak ada bukti untuk menyimpulkan konflik sudah selesai atau sumber berbeda versi.

Keluaran privat:

- `verification-targets.geojson`: lima koordinat respons asli beserta rujukan dan fakta sumber, untuk pencocokan bukti lokasi. Ini target pemeriksaan, bukan titik kanal terverifikasi.
- `verification-form.json`: formulir per target dengan daftar observasi kosong, penelaah/tanggal telaah null dan status Belum diperiksa.
- `metadata-review.json`, salinan metadata STAC dan `manifest.json`: batas hasil telaah serta hash/rujukan sumber.

Bukti yang diminta tetap terbatas pada tanggal dan lokasi pengamatan, identifikasi kanal/jalan/sungai, kondisi kanal yang diamati, fungsi drainase serta foto/dokumen asli yang dapat dicocokkan. Tidak meminta TMAT. Tidak ada pengisian kondisi, skor, persetujuan atau penetapan prioritas otomatis. Satu pengamatan titik tidak berlaku sebagai pemeriksaan seluruh poligon.

Penelusuran arsip tambahan menemukan laporan perbaikan sekat bertanggal Agustus 2026. Lokasinya disebut Temiang; teks yang diperoleh tidak memuat koordinat untuk mencocokkannya dengan kelima target. Catatan ini disimpan privat sebagai sumber yang belum tercocokkan, bukan verifikasi kondisi kanal pada empat kandidat. Dokumen panduan, TOR dan file salinan kode tidak dijadikan hasil survei. Penelusuran ini tidak mengklaim seluruh arsip organisasi telah diperiksa; tidak ada pesan permintaan bukti yang dikirim ke pihak lain.

Tiga tes tambahan memeriksa pengelompokan tanpa kehilangan rujukan, pelestarian koordinat Z, pemisahan unit, formulir tetap kosong, serta penolakan identitas berulang/koordinat invalid/skor atau persetujuan sumber yang sudah terisi. Pengujian penuh: 125 tes lulus. Paket nyata berisi 4 unit, 5 target dan 9 rujukan; observasi selesai, konflik diselesaikan dan prioritas final masing-masing masih 0. Tidak ada perubahan UI, akses staf, endpoint atau produksi.

## Lampiran kondisi kanal yang ditelaah, 5 November 2026

Penelusuran folder pendukung laporan dilanjutkan ke foto sebelum/sesudah perbaikan dan berita acara. Tiga foto asli diunduh melalui Drive terhubung, diperiksa ukuran dan SHA-256, dibaca EXIF-nya dengan Pillow yang sudah tersedia, serta ditelaah secara visual. Seluruh berkas, nama/identitas sumber, hasil telaah dan register bukti tetap privat. Tidak ada foto atau koordinat lampiran dimasukkan ke Git/Pages.

- Foto dari folder Pedekik menampilkan papan/perangkat FDRS, bukan bukti kondisi kanal kandidat. EXIF memuat tanggal pengambilan yang dilaporkan, tetapi GPS berisi referensi NUL dan nilai NaN sehingga dipertahankan sebagai lokasi tidak tersedia. Cap foto secara eksplisit menyebut waktu jaringan belum tersinkron. Koordinat yang terbaca pada cap ditranskripsikan terpisah dari EXIF, tanpa dianggap posisi terverifikasi; pemeriksaan point-in-polygon menempatkannya di luar keempat unit kandidat.
- Dua foto berlabel setelah perbaikan memperlihatkan struktur sekat. Keduanya tidak menyediakan GPS atau tanggal pengambilan EXIF yang dapat digunakan. Tanggal dalam nama berkas tidak dijadikan tanggal pengamatan. Nama titik/foto yang berbeda juga tidak membuktikan aset fisik berbeda atau fungsi hidrologisnya.
- Berita acara bertanggal 11 Agustus 2026 menyatakan sekat di Temiang lengkap dan berfungsi. Teks yang diperoleh tidak memberi koordinat yang dapat dicocokkan dengan lima target. Pernyataan dokumen dipertahankan sebagai klaim sumber mengenai lokasi tersebut, tidak dipindahkan ke kandidat lain. Nama pribadi, tanda tangan dan kontak tidak disalin ke register.

Register bukti privat menautkan tiga hash foto, telaah berita acara dan hash lima target asli. Hasil tahap ini: 3 foto ditelaah, 0 GPS EXIF valid, 1 cap koordinat diperiksa, 0 posisi cap di dalam unit kandidat, dan 0 target memperoleh bukti kondisi kanal yang cocok. Semua target tetap Belum diperiksa, skor null dan prioritas Belum dinilai. Hasil nol kecocokan bukan nilai tekanan nol atau bukti tidak ada kanal.

Tahap ini hanya menambah dokumentasi dan hasil pemeriksaan privat; mesin scoring, UI, autentikasi, endpoint dan produksi tidak berubah. Tidak ada tes kode tambahan untuk perubahan dokumentasi. Hasil 125 tes pada tahap implementasi sebelumnya tetap dicatat terpisah dari pemeriksaan foto/EXIF dan pencocokan posisi yang benar-benar dijalankan pada tahap ini. Penetapan prioritas masih memerlukan bukti kanal bertanggal dan berlokasi yang sesuai dengan lima target; dokumen yang belum cocok tidak dapat menggantikannya.

## Penapisan sumber tambahan dan kebutuhan lapangan

Penelusuran tambahan 5 November 2026 memeriksa folder asli Basis Data Geospasial Undip-BRGM 2024. Subfoldernya secara eksplisit mencakup survei vegetasi mangrove, KLM dan fungsi ekosistem mangrove; keluaran tersebut tidak diganti menjadi indikator gambut. Folder RBI Riau yang diperiksa hanya berisi komponen batas administrasi desa, bukan jaringan kanal. Metadata juga menunjukkan citra Planet Oktober 2024 berformat ECW; citra itu tidak diunduh/didekode dan tidak ada klaim interpretasi kanal darinya. Penapisan ini tidak menyatakan semua data dalam folder induk sudah diperiksa.

Peta jaringan hidrologi Pematang Duku berhasil ditemukan dan mencantumkan kanal/sungai. Namun, belum diperoleh pengamatan kondisi kanal bertanggal pada lima target; tidak ada garis yang didigitasi dari gambar untuk mengisi kekosongan. Satu PDF berjudul survei juga diperiksa secara visual setelah ekstraksi teks kosong; isinya administrasi kegiatan sehingga tidak dimasukkan sebagai hasil pengamatan spasial. Data pribadi dan keuangan tidak ditranskripsikan.

Catatan penapisan sumber disimpan privat, dan paket lima target dilengkapi `PETUNJUK-VERIFIKASI.txt`. Petunjuk meminta targetId, tanggal dan posisi pengamatan aktual, pembedaan kanal/jalan/sungai, kondisi serta fungsi yang benar-benar diamati, dan foto/dokumen asli. GPS/jam tidak valid, objek tidak pasti dan kunjungan yang tidak dapat dilakukan harus dicatat sebagai keterbatasan; tidak diganti nol atau koordinat perkiraan. Tidak meminta TMAT. Posisi BPBD tidak dipindahkan ke kanal, pengamatan titik tidak digeneralisasi ke seluruh poligon dan formulir tidak mengesahkan tekanan/prioritas otomatis.

Hasil penelusuran tambahan tetap 0 pengamatan kanal baru yang dapat dicocokkan. Kelima target masih Belum diperiksa; konflik tahun tetap terbuka. Kemajuan penetapan selanjutnya memerlukan bukti lapangan atau dataset pengamatan asli baru yang sesuai target. Penelusuran yang sudah selesai tidak perlu diulang tanpa petunjuk sumber baru. Paket tidak mengirim penugasan atau pesan kepada siapa pun. Perubahan repository tahap ini hanya dokumentasi; tidak ada perubahan kode, database, menu, akses staf atau produksi.

## Pemeriksaan berkas hasil lapangan

Paket target versi 2 menambahkan `targetsSha256` dan `formTemplateSha256`. Checksum daftar target dan identitas koordinat diperiksa sebelum menerima formulir. Template formulir dapat diisi dengan observasi asli; daftar target, unit, indeks sumber dan rujukan BPBD dipertahankan. Paket lama yang belum menyimpan checksum target harus disiapkan ulang dari sumber sebelum digunakan untuk penerimaan; jangan mengubah hash secara manual untuk meloloskan perubahan koordinat. Paket baru dibuat terpisah dan tidak menimpa formulir lama.

```powershell
node scripts/prepare-restoration-site-review.mjs --check-form <paket-target-v2> 2026-11-05
```

Tanggal terakhir pada perintah adalah tanggal pemeriksaan yang eksplisit. Pemeriksaan tidak mengambil tanggal foto dari nama berkas atau tanggal unggah. Setiap elemen `observations` memakai data yang benar-benar tersedia:

| Field | Isi yang diperlukan |
| --- | --- |
| `observedAt` | Tanggal pengamatan asli YYYY-MM-DD, sah dan tidak sesudah tanggal pemeriksaan |
| `geometry` | Point WGS84 posisi pengamatan aktual, bukan koordinat target yang disalin agar cocok |
| `objectType` | kanal, jalan, sungai, atau belum teridentifikasi |
| `condition` | Untuk kanal: terbuka, tersumbat atau bersekat; ketidakpastian tetap dicatat dan belum siap ditelaah |
| `drainageObservation` | Catatan fungsi kanal yang benar-benar diamati, tanpa estimasi kondisi |
| `evidenceFiles` | Berkas asli dalam paket dengan path relatif, SHA-256, sourceReference, version dan observationYear |

Tahun pengamatan bukti harus sesuai dengan tanggal pengamatan, terpisah dari versi sumber. Posisi di luar unit sumber ditandai untuk pemeriksaan. Keanggotaan unit tidak membuktikan keterhubungan drainase dengan target BPBD; hubungan lokasi tetap harus ditelaah. Objek yang belum teridentifikasi dan kondisi kanal yang belum pasti tidak otomatis menjadi nilai tekanan nol.

Berkas dibatasi 16 MiB per berkas dan 64 MiB total pembacaan. Path absolut, traversal, file kosong, file hilang, berkas yang keluar direktori melalui symlink serta checksum tidak cocok ditolak. File hanya dibaca/di-hash, tidak dijalankan. Formulir yang mengubah identitas sumber, mengisi skor atau mengklaim verifikasi kondisi kanal lebih dahulu ditolak. Keluaran baru hanya berupa `intake-review.json` dan manifes privat; formulir dan sumber tidak ditimpa. `Bukti siap ditelaah` menyatakan kelengkapan/integritas untuk telaah, bukan validasi GPS, waktu kamera, objek, fungsi hidrologis, tekanan atau prioritas.

Paket nyata diperiksa dengan 5 target dan 0 observasi; hasil tetap 0 siap telaah, 0 kondisi kanal terverifikasi dan 0 prioritas final. Salinan daftar target yang diubah ditolak oleh checksum tanpa mengubah sumber asli. Tiga tes tambahan memeriksa formulir kosong, tanggal tidak sah/future, koordinat/rujukan, sumber yang sudah diberi skor, path keluar paket, batas berkas dan perubahan byte. Total 128 tes lokal lulus. Tidak ada data lapangan contoh dimasukkan ke paket nyata, endpoint baru, perubahan akses staf, UI atau produksi; browser tidak diuji ulang untuk alat offline ini.
