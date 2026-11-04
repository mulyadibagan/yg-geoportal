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

## Antrean pemeriksaan kandidat

```powershell
node scripts/review-restoration-three-pressure-candidates.mjs "private-data/restoration-three-pressure-evidence-<id>" "private-data/restoration-canal-evidence-<id>" "private-data/restoration-database-validation-<id>"
```

Pemeriksaan memakai kembali paket yang sudah diperoleh, tanpa audit/unduhan sumber ulang. Hash paket dan sumber unit harus cocok. Tahun kehilangan tutupan pohon dibaca dari kelas lossyear native; tanggal/kategori respons BPBD dipertahankan dengan referensi versi yang sama dan keanggotaan unit yang sesuai. Tanggal tidak valid dipisahkan, bukan ditebak. Sumber dengan identitas ganda, referensi berubah atau kelas tahunan yang tidak didukung ditolak.

Antrean disusun untuk pekerjaan pemeriksaan, bukan peringkat ekologis: `Periksa konflik sumber` jika flag sumber/identitas geometri tercatat; `Antrean peninjauan lokasi` jika ada tahun kebakaran/kehilangan tutupan pohon yang sama dan tidak ada flag tersebut/tanggal bermasalah; sisanya `Periksa periode bukti`. Ketiadaan flag bukan pengesahan batas. Catatan 2026 yang berada di luar cakupan GFC-2025 diberi status eksplisit, bukan dianggap tidak ada bukaan. Kesamaan tahun dalam unit tidak membuktikan kebakaran dan loss berada pada piksel sama atau berkaitan sebab-akibat; kanal 2017 tetap berbeda periode. Tidak ada skor, kategori prioritas final atau flag persetujuan diubah. Daftar kasus tetap privat.

`review-units.geojson` menyediakan geometri poligon sumber asli beserta rute pemeriksaan dan label kabupaten sumber untuk peninjauan GIS privat. Tidak ada buffer, dissolve, garis atau batas baru. File tersebut belum diunggah ke hosting, tidak menjadi data publik dan bukan layer hasil prioritas final. Input asli tetap dipertahankan.

Pemeriksaan katalog staf tersinkron dan arsip survei internal belum menemukan geometri garis kanal lapangan yang sesuai pada sumber yang diperiksa. Laporan/peta survei lokal dipertahankan sebagai bukti referensi privat; titik rencana sekat tidak dihubungkan menjadi garis kanal rekaan. Batas kawasan hutan di katalog bukan kelas tutupan hutan. Penelusuran ini tidak mengklaim seluruh arsip organisasi telah habis diperiksa.

### Pemeriksaan koordinat respons pada 61 kandidat

Jalankan tanpa jaringan dan simpan seluruh keluaran di `private-data`:

```powershell
node scripts/sample-restoration-candidate-loss.mjs <paket-review> <paket-BPBD> <paket-GFC>
```

Skrip memverifikasi checksum empat raster asli, versi GFC-2025-v1.13, keselarasan grid lossyear/datamask, checksum BPBD, identitas unit BBSDLP dan keanggotaan setiap koordinat pada poligon asli menggunakan Turf. Tidak ada buffer, resampling, estimasi luas, atau skor. Batas piksel memakai interval setengah terbuka agar koordinat ekuator tidak masuk dua tile. Kelas datamask kosong/perairan tetap terpisah dari kehilangan tutupan pohon.

Hasil pemeriksaan 4 November 2026: 61 unit, 826 sampel titik respons; 49 sampel pada 12 unit berimpit dengan piksel kehilangan tutupan pohon pada tahun kalender yang sama. Sebanyak 49 unit lainnya perlu bukti spasial tambahan, bukan disimpulkan tidak mengalami kebakaran atau kehilangan tutupan. Titik respons tidak mewakili batas area terbakar; perimpitan tahun tidak membuktikan sebab kebakaran. GFC mencakup perkebunan, sehingga belum membuktikan bukaan hutan alami. Kanal/jalan 2017 masih bukti tingkat unit, bukan kondisi kanal terkini.

Keluaran privat `review.json`, `review-units.geojson` (61 geometri asli tanpa perubahan), dan `manifest.json` menyimpan rujukan rekaman, koordinat piksel native, nilai asli, versi/checksum dan rute pemeriksaan. Semua unit tetap `Belum dinilai`, persetujuan sumber `false`, skor `null`. Dua uji tambahan memeriksa batas piksel/ekuator, data kosong/perairan, nilai kelas tidak sah, tanggal tidak sah, serta batas cakupan 2025/2026. Total 117 tes lulus; tidak ada perubahan UI, kontrol akses atau produksi pada tahap ini.

### Perimpitan kanal/jalan historis pada piksel respons/loss

```powershell
node scripts/review-restoration-canal-pixels.mjs <paket-review-piksel> <paket-BPBD> <paket-GFC> <paket-kanal> <python-bundel>
```

Pemeriksaan mempersempit 12 unit hasil tahap sebelumnya. Checksum arsip kanal, indeks, raster loss dan manifes sumber diperiksa; nilai loss native dibaca ulang dan koordinat BPBD diuji kembali terhadap poligon BBSDLP asli. Hanya tile kanal yang berpotongan dengan jejak piksel GFC dibaca melalui ZIP/CRC. Pusat piksel kanal/jalan harus berada di dalam jejak piksel loss dan poligon asli (lubang poligon dikecualikan). Tidak ada buffer atau garis kanal hasil rekaan. Pengujian ini membandingkan **pusat piksel**, bukan seluruh luas irisan raster atau luas terbakar.

Hasil 4 November 2026: 49 sampel respons pada 29 piksel GFC berbeda; 9 sampel pada 5 piksel berbeda di 4 unit mempunyai pusat piksel kanal/jalan 2017 dalam jejak piksel loss. Delapan unit lainnya memerlukan verifikasi kanal; hasil tanpa piksel positif tetap unknown, bukan bukti tidak ada kanal. Respons berulang pada piksel yang sama tidak dihitung sebagai kejadian kebakaran independen. Dua belas tile asli dibaca, tanpa ekstraksi seluruh arsip. Output privat berupa JSON, GeoJSON dengan 12 geometri sumber tidak berubah, serta manifes checksum/grid/posisi piksel.

Pekerjaan berikutnya adalah memisahkan bukaan hutan alami dari kehilangan tutupan perkebunan serta memverifikasi kanal, terutama pada empat unit dengan bukti perimpitan historis tersebut. Ini antrean peninjauan, bukan penetapan prioritas. Tidak ada status tekanan yang otomatis divalidasi, skor, persetujuan batas atau perubahan produksi.

Sumber pembanding yang diperiksa: [MapBiomas Indonesia Koleksi 3](https://landy.mapbiomas.id/id/collectionmap), [kode legenda Koleksi 3](https://landy.mapbiomas.id/assets/legendcode/Kode%20Legenda-Legend%20Code.pdf), [deskripsi kelas](https://landy.mapbiomas.id/assets/legendcode/legend_description_id.pdf), dan [ketentuan penggunaan CC-BY-SA](https://landy.mapbiomas.id/id/termsofuse). Koleksi 3 membedakan hutan rawa gambut (76), formasi hutan (3), mangrove (5), sawit (35) dan kebun kayu (9), dengan cakupan publik yang didokumentasikan sampai 2023. URL raster 2023 yang diturunkan mengikuti petunjuk resmi `https://storage.googleapis.com/mapbiomas-public/initiatives/indonesia/collection_3/coverage/indonesia_coverage_2023.tif` memberi HTTP 403 saat HEAD pada 4 November 2026. **Tidak ada raster MapBiomas yang diperoleh atau digunakan untuk menilai 12 unit**; tidak ada upaya melewati akses. Metadata legenda tidak dianggap bukti kelas lahan lokasi. Sebagai jalur pembanding berikutnya, [JRC Tropical Moist Forest](https://forobs.jrc.ec.europa.eu/TMF/data) menyediakan produk perubahan hutan hingga 2025; raster lokasi belum diunduh atau dipakai pada pemeriksaan ini.
