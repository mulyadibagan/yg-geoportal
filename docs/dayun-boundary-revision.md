Revisi batas gawangan Dayun
==========================

Sumber revisi pemilik diterima 18 Oktober 2026: `Jaluran_Versi Revisi YG.rar`,
berisi `Jaluran_Rev.shp` beserta atribut dan proyeksi WGS84 / UTM 48N.
Metadata XML di arsip adalah metadata sumber, bukan perintah untuk dijalankan.
File sumber dikonversi tanpa simplifikasi memakai mapshaper `-proj wgs84`.
Checksum arsip dan hasil konversi dicatat pada `boundaryRevision` di GeoJSON.

Peta baru memuat 86 bagian gawangan tanam, 75 gawangan mati, dan 16 bagian
infrastruktur. Seluruh 60 ID GT A–F tetap sama, sehingga kunci penghubung ke
59 profil database tetap utuh; GT-B-15 tetap tidak memiliki profil database.
Bagian dengan ID GT sama digabung untuk luas dan analisis, bukan dihitung ganda.
Luas geometri diperbarui; jumlah tanaman, bulan tanam, bibit, MPTS, ethrel,
pupuk, panen, dan catatan monitoring tidak diperbarui dari luas polygon.
Blok untuk gawangan mati kini memakai atribut sumber, bukan dugaan jarak.

`scripts/update_dayun_boundaries.py` memvalidasi koordinat, geometri dan
kesamaan himpunan ID sebelum menulis peta dan batas blok. Batas blok diturunkan
dari union seluruh kategori sumber dalam blok tersebut. Konteks desa/HKm
tetap menggunakan sumbernya sendiri. Revisi yang mengganti ID ditolak.

`scripts/rebase_dayun_analysis.py` memindahkan keanggotaan kandidat lama
berdasarkan koordinat yang tetap. Ini bukan deteksi ulang tanaman. Hasil
memuat luas yang baru masuk domain analisis, luas di luar potongan native,
serta kandidat di luar batas baru. Titik tersebut dipertahankan untuk tinjauan.
Pengukuran RGB/nodata dan mask potongan per gawangan dari versi lama tidak
disajikan sebagai hasil batas baru; nilainya belum tersedia sampai diproses
ulang. Cakupan geometris batas raster dipisahkan dari cakupan piksel valid.
TIFF native yang sudah ada tetap berada pada koordinat dan resolusi aslinya.

Hasil revisi disimpan sebagai versi privat baru di prefix analisis yang sudah
ada. Aktivasi mempertahankan `block_review_bases`, semua berkas lama dan
identitas sumber asli. Head dan riwayat koreksi staf tidak ditulis ulang.
Worker menghitung ulang zona koreksi pada saat dibaca; revisi, keputusan,
koordinat dan versi konflik per titik tetap dipertahankan. Perubahan staf
berikutnya menggunakan jalur penyimpanan privat yang sama.

Rilis geometri melalui workflow snapshot hanya mengunggah dua objek
`dayun/map.geojson` dan `dayun/blocks.geojson` bila data lain tidak berubah.
Cabang ini melewati pembaruan sensus, snapshot dashboard/objects, timestamp
profil dan manifest snapshot. Deployment Worker tetap berjalan. Publikasi
analisis tetap melalui pemeriksaan bucket privat, verifikasi SHA256 berkas
dan aktivasi indeks setelah kode kompatibel tersedia.
