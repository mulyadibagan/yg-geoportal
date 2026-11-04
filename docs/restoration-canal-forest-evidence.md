# Persiapan bukti kanal, bukaan tutupan pohon dan kebakaran

Alur ini lokal dan baca-saja terhadap sumber. Semua arsip, raster, referensi unit dan keluaran berada di `private-data`; tidak ada endpoint baru, data privat di Git/Pages, perubahan database atau deployment.

## Sumber asli

- Kanal: [Stanford Digital Repository, Dadap](https://purl.stanford.edu/yj761xk5815), DOI 10.25740/yj761xk5815, citra Juli–September 2017, lisensi CC BY 3.0. Arsip `geotiffs.zip` dan [indeks tile](https://purl.stanford.edu/zy089tj2215) diperoleh dari tautan manifest IIIF resmi. Ukuran aktual arsip 227.398.783 byte; SHA-256 lokal d1771dd46e440a74d7f9f8f557856238a0acc3fed27618f213d5cf6f288f56a9. Ini checksum akuisisi lokal, bukan checksum penerbit yang tidak tersedia.
- [Metode Dadap dkk. (2021)](https://doi.org/10.1029/2020AV000321) memasukkan jalan sebagai proksi koridor drainase. Raster biner tidak memisahkan kanal survei dan jalan. Jangan menghapus atau mengubah kelas dengan buffer jalan perkiraan. Hasil tetap `mappedCanalRoadCorridorObserved`, bukan inventaris kanal lapangan terbaru.
- Bukaan: gunakan kembali observasi native Hansen/UMD/Google/USGS/NASA [GFC-2025-v1.13](https://storage.googleapis.com/earthenginepartners-hansen/GFC-2025-v1.13/download.html), lossyear/datamask 2001–2025 yang sudah disiapkan. Ini perubahan tutupan pohon; tidak otomatis membedakan hutan alam, perkebunan, atau pembukaan yang masih terbuka saat ini. Tidak ada hektare definitif yang dihitung dari jumlah piksel.
- Kebakaran: gunakan matriks bukti database/BPBD/indikasi terbakar yang sudah disiapkan dengan unit/hash yang sama. Record pemadaman/water drop tidak menjadi jumlah kejadian unik. Sumber berasal dari periode berbeda; gabungan bukti tidak membuktikan tekanan terjadi bersamaan.

## Perintah

```powershell
node scripts/acquire-restoration-canals.mjs
# Bila terputus, opsional direktori privat parsial yang dicetak/ditemukan:
node scripts/acquire-restoration-canals.mjs "private-data/restoration-canals-<id>"
node scripts/extract-restoration-canal-evidence.mjs "private-data/restoration-indicator-evidence-<id>/units-with-evidence.geojson" "private-data/restoration-canals-<id>" "<bundled-python.exe>"
node scripts/prepare-restoration-three-pressure-evidence.mjs "private-data/restoration-canal-evidence-<id>" "private-data/restoration-database-validation-<id>"
```

Gunakan Node/geotiff/Turf dan Python zipfile bawaan runtime yang sudah tersedia; tidak ada dependency baru. Akuisisi hanya menerima dua file resmi, memeriksa identitas/lisensi manifest dan batas ukuran/transport. Resume memerlukan HTTP 206 dan Content-Range persis sesuai offset; file parsial tidak memiliki manifest paket lengkap. SHA-256 dihitung atas seluruh hasil, termasuk prefix resume. Jika manifest sumber berubah atau file keluar direktori privat, proses menolak. Paket lengkap tidak ditimpa.

## Metode lokal dan batas hasil

Ekstraktor memeriksa checksum arsip/index serta geometri/indeks/hash unit terhadap BBSDLP asli. Hanya unit yang lolos geometri pada paket sebelumnya dipakai. Pemilihan tile memakai bounding box, bukan klaim cakupan poligon. Raster diperiksa sebagai EPSG:3857, 4096 × 4096, satu band; extent dibandingkan indeks WGS84 yang diproyeksikan lokal. Grid native dipertahankan. Scanline pada pusat piksel mengecualikan hole; proses berhenti pada piksel kelas 1 pertama yang masuk unit. Kelas selain 0/1 ditolak pada piksel yang diperiksa.

ZIP mengembang sekitar 28 GB jika seluruhnya diekstrak. Pipeline hanya membaca tile yang diperlukan dari arsip ke memori, maksimal 32 MiB per entry, dengan verifikasi CRC zipfile. Tidak mengekstrak seluruh arsip ke disk. Hasil menyimpan nama/hash tile dan indeks row/column piksel sumber, tanpa membuat garis tengah kanal, koordinat survei, panjang atau luas rekaan. Tidak ditemukannya piksel bukan bukti tidak ada kanal; `coverageComplete:false` tetap dipertahankan.

Penggabungan memeriksa kesamaan hash unit/BBSDLP dan identitas baris per unit. Tiga sinyal positif menghasilkan **kandidat tiga tekanan**, bukan validasi proksi atau prioritas final. Unknown tetap null. `restorationPressures` belum diisi, skor null, persetujuan false; unit yang bermasalah tidak dibuka otomatis. Hitungan unit bukan jumlah area unik hasil dissolve. Definisi kanal/drainase, bukaan hutan dan periode perlu diperiksa sebelum memasukkan data ke model aktif.

Pemeriksaan katalog staf tersinkron dan arsip survei internal belum menemukan geometri garis kanal lapangan yang sesuai pada sumber yang diperiksa. Laporan/peta survei lokal dipertahankan sebagai bukti referensi privat; titik rencana sekat tidak dihubungkan menjadi garis kanal rekaan. Batas kawasan hutan di katalog bukan kelas tutupan hutan. Penelusuran ini tidak mengklaim seluruh arsip organisasi telah habis diperiksa.
