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
