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
