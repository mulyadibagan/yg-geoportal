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

### Pembanding tutupan hutan pada empat unit

Lihat [verifikasi empat unit](restoration-four-unit-verification.md). JRC TMF v1.2025 melalui mirror COG beratribusi berhasil dibaca pada koordinat BPBD asli. Empat unit memiliki kelas lahan terdeforestasi pada sampel 2025: satu perubahan hutan 2024 ke lahan terdeforestasi 2025, satu ketidaksesuaian kelas waktu yang dipertahankan, dan dua bukaan historis. Bukaan lama tidak dikeluarkan hanya karena bukan bukaan baru 2025. Kondisi kanal terkini belum terverifikasi; semua prioritas tetap belum dinilai. Raster JRC asli lengkap gagal ditransfer karena timeout dan tidak dipakai; hanya rentang mirror yang lengkap/berhash digunakan sebagai pembanding, dengan keterbatasannya dinyatakan.

### QA dan overlay arsip BRG lokal, 6 November 2026

Dua arsip yang diberikan pengguna diperiksa hanya dalam `private-data`, diabaikan Git. Tidak ada unggahan, perubahan database, endpoint, menu atau deployment. SHP/SHX/DBF diikat melalui jumlah record, offset, panjang record dan SHA-256 terhadap inventaris ekstraksi. Z sumber disimpan dalam SHP; analisis topologi menggunakan XY. Ring ESRI dipisahkan menurut orientasi, hole harus seluruhnya tercakup shell terkecil, lalu diperiksa JSTS IsValidOp 2.7.1. Tidak ada perbaikan ring, snapping, buffer(0) atau pengesahan batas secara otomatis.

| Dataset | Cakupan yang diperiksa topologinya | Lolos | Tidak lolos |
| --- | --- | ---: | ---: |
| Prioritas_Indikatif_Restorasi_2 | 30.102 record beratribut RIAU | 30.065 | 37 |
| Prioritas_Indikatif_Restorasi_2,6 | 6.920 record beratribut RIAU | 6.915 | 5 |
| DRAFT_PIR_2_7PROV_04122017 | 17.683 record beratribut RIAU | 17.656 | 27 |
| Prioritas_Restorasi | 4 record multipart lintas provinsi | 0 | 4 |
| TARGET_RESTORASI_BRG_2_4 | 4 record multipart lintas provinsi | 1 | 3 |

Kasus yang tidak lolos memiliki ring self-intersection dan tidak dimasukkan ke overlay. Ini bukan audit seluruh poligon di luar Riau pada tiga dataset yang memiliki field provinsi. Dua dataset nasional yang hanya empat record diperiksa sebagai geometri utuh, bukan dianggap empat lokasi. Pemeriksaan indeks juga mencakup 59 record kanal; XY finite, tiap bagian memiliki minimal dua vertex dan tidak ditemukan segmen sepanjang nol. Simplicity/keterhubungan jaringan serta kondisi aktual belum disahkan.

Pada geometri yang lolos, normalisasi XY tidak menemukan grup geometri identik dalam masing-masing dataset. Seluruh 6.915 record valid versi `2,6` cocok dengan versi lengkap baik geometri XY/atribut maupun hash record SHP mentah/atribut. Lima record target tidak valid tidak disahkan melalui hasil kecocokan record valid. Versi target dan lengkap tidak dijumlahkan. Pemeriksaan pasangan dalam layer utama membandingkan 486.819 pasangan bbox kandidat: 116.186 kontak hanya batas, 0 irisan berluas positif, dan 0 error overlay. Hasil ini tidak mencakup 37 record yang dikeluarkan. Segmen kanal dibandingkan tanpa arah pada koordinat XY sumber: 564 kemunculan berulang; ini bukan jumlah kanal unik dan tidak dipakai sebagai intensitas atau skor.

Overlay memakai 30.065 fragmen valid dari versi lengkap, tanpa menambahkan versi target/draft. Dari 736 baris BBSDLP asli, tiga baris sumber identik dihilangkan hanya dalam turunan sehingga ada 733 unit referensi; delapan unit dengan isu geometri tetap dikeluarkan. JSTS menghitung 32.076 irisan berluas positif antara fragmen BRG dan unit yang lolos, tanpa error. Luas planar dalam derajat tidak dilaporkan sebagai hektare dan tidak dijumlahkan menjadi luas intervensi. Kanal diproyeksikan langsung dari Web Mercator Auxiliary Sphere type 0 ke WGS84 setelah PRJ dan checksum diperiksa.

| Sinyal historis pada unit referensi | Jumlah unit |
| --- | ---: |
| Beririsan fragmen BRG valid | 650 |
| Memuat label Terbakar 2015/2016/2017 | 200 |
| Memuat kelas Non-Hutan | 608 |
| Memuat kelas Tanah Terbuka | 274 |
| Beririsan garis kanal arsip | 427 |
| Memuat kebakaran historis, Non-Hutan dan irisan kanal | 182 |

**182 adalah antrean pemeriksaan sinyal historis, bukan prioritas tinggi.** Sinyal dapat berada pada bagian berbeda dari satu unit; hasil tidak membuktikan perimpitan tiga tekanan pada petak yang sama. Non-Hutan/Tanah Terbuka pada satu waktu belum membuktikan perubahan dari hutan. Tidak adanya irisan bukan tekanan nol karena cakupan, fragmen invalid dan periode pengamatan belum lengkap. Kondisi/umur jaringan kanal tidak diturunkan dari tanggal pemrosesan metadata 2017. Konflik/overlap pada unit BBSDLP dan batas antarsumber tidak dihapus.

`prepare-restoration-brg-inputs.mjs` memasukkan bukti aktual tersebut ke `assessPressures` yang sudah ada. Fire/canal hanya memiliki indikasi positif bila geometri lolos dan tidak ada error; status validasi tetap false, tahun kanal tetap null dan forestOpening tetap null. Seluruh 733 hasil tetap Belum dinilai, pressureCount/score null; kesiapan pelaksanaan disimpan terpisah dan belum dinilai. Belum ada penetapan prioritas final atau luas restorasi.

Reproduksi lokal dengan runtime GIS yang sudah tersedia, tanpa dependency baru:

```powershell
node --max-old-space-size=4096 scripts/validate-restoration-brg.mjs <paket-inventaris-BRG-privat>
node --max-old-space-size=4096 scripts/review-restoration-brg-overlaps.mjs <paket-overlay-privat>
node scripts/prepare-restoration-brg-inputs.mjs <paket-overlay-privat>
```

Keluaran menyimpan hash komponen, indeks sumber untuk kasus invalid/irisan, duplikasi, hasil overlay dan input mesin secara privat. Delapan tes baru memeriksa SHP/SHX/DBF rusak, XY tidak sah, record terhapus, orientasi shell/hole/island, hole yatim, klasifikasi kosong dan pencegahan promosi Non-Hutan menjadi forestOpening. **136 tes lokal lulus, tanpa skip**, termasuk regresi akses staf/privasi. Uji browser tidak diulang karena tidak ada perubahan UI/endpoint; hasil ini hanya analisis offline. Langkah berikutnya adalah menghubungkan baseline hutan BRG dengan perubahan hutan bertanggal yang sudah tersedia, menelaah asal/tanggal garis kanal, dan menyelesaikan fragmen invalid sebelum menetapkan cakupan negatif atau prioritas.

### Kehilangan tutupan pohon pada irisan hutan rawa BRG, 7 November 2026

Pemeriksaan dilanjutkan pada **182 kandidat sinyal historis sebelumnya**, bukan penilaian seluruh 733 unit atau bukti tidak adanya tekanan pada unit lain. Dari fragmen Riau yang sudah lolos QA, 3.432 berlabel `Hutan Rawa Primer` atau `Hutan Rawa Sekunder`; seluruhnya konsisten dengan atribut `Hutan`. Kelas hutan tanaman/perkebunan, mangrove dan hutan lahan kering tidak dimasukkan. Tahun pengamatan kelas hutan tetap null: nama field `PL17_ID` dan nama folder bukan konfirmasi independen tanggal pengamatan. Pencarian teks metadata XML yang tersedia tidak menghasilkan rujukan penutupan lahan 2017 yang mengesahkan tahun itu.

`review-restoration-brg-forest-loss.mjs` menghitung irisan persis fragmen hutan rawa valid dengan geometri unit BBSDLP asli, lalu membaca sel GFC-2025-v1.13 yang pusatnya berada dalam irisan tersebut. Lubang poligon dikeluarkan. Empat raster lokal lossyear/datamask pada tile 00N_100E dan 10N_100E diverifikasi SHA-256, ukuran, EPSG:4326, sampel, origin/resolution, extent serta kesesuaian grid antarlayer. Tidak ada unduhan baru, koordinat yang dikirim ke server, resampling, buffer, piksel acak atau luas dalam hektare yang diturunkan dari jumlah piksel.

| Hasil pembacaan nyata | Jumlah |
| --- | ---: |
| Kandidat yang diperiksa | 182 unit |
| Unit dengan irisan kelas hutan rawa BRG | 109 |
| Unit dengan piksel loss 2001–2025 dalam irisan hutan rawa BRG | 108 |
| Unit dengan piksel loss 2018–2025 dalam irisan hutan rawa BRG | 104 |
| Pasangan fragmen hutan rawa–unit yang dibaca | 3.454 |
| Pasangan tanpa pusat piksel native | 319 |
| Pasangan dengan NoData, kode invalid atau di luar cakupan tile | 0 |
| Error overlay/pembacaan raster | 0 |
| Penetapan prioritas final | 0 |

**104 unit merupakan bukti piksel kehilangan tutupan pohon pada area yang dipetakan sebagai hutan rawa dalam arsip BRG; belum pengesahan bukaan hutan setelah baseline.** Rentang 2018–2025 dinyatakan sebagai interval pencarian eksplisit, bukan klaim tahun baseline 2017 sudah tervalidasi. GFC mencatat kehilangan tutupan pohon, bukan sebab kebakaran atau otomatis deforestasi permanen. Fragmen dan unit dapat saling berbagi posisi; jumlah piksel per pasangan tidak dijumlahkan sebagai kehilangan unik. Sinyal kebakaran/kanal pada tingkat unit juga belum membuktikan perimpitan ketiga tekanan pada petak yang sama.

319 irisan tanpa pusat piksel native tetap tanpa bukti raster pada resolusi tersebut, bukan kehilangan nol. Unit tanpa irisan kelas hutan rawa juga tidak dinyatakan tidak pernah berhutan. Nilai skor seluruh unit hasil tetap null, `forestOpeningValidated` false dan status Belum dinilai. Tahun observasi kanal, waktu baseline BRG, ketidakpastian sumber serta konflik yang sudah tercatat tidak diisi dari perkiraan. Kesiapan pelaksanaan tidak disamakan dengan kebutuhan ekologis.

```powershell
node --max-old-space-size=4096 scripts/review-restoration-brg-forest-loss.mjs <paket-overlay-BRG-privat> <paket-GFC-lokal>
```

`forest-loss-review.json` menyimpan hitungan tahunan native, kelas sumber dan indeks pasangan unit/fragmen; `manifest.json` mengikat checksum hasil, overlay, unit gambut dan keempat raster. Semua keluaran diabaikan Git dan tidak dimuat ke endpoint/UI. Dua tes tambahan memeriksa pembatasan kelas hutan, pemisahan kode tahun 2017/2018, data kosong dan pencegahan pengesahan otomatis. **138 tes lokal lulus tanpa skip**; tidak ada uji browser baru karena autentikasi, menu dan produksi tidak berubah. Berikutnya adalah konfirmasi tahun/metode kelas hutan BRG dan asal/tanggal jaringan kanal agar bukti dapat ditelaah untuk validasi indikator, bukan sekadar mengubah label menjadi prioritas.

### Penelusuran metadata dan paket kandidat, 10 November 2026

Pembacaan lebih dalam menemukan deskripsi `idAbs` yang disimpan sebagai HTML dalam XML ArcGIS. Keterangan ini perlu dibedakan dari pencarian frasa tahun 2017 sebelumnya: **metadata sumber menyebut Penutup Lahan Tahun 2016 IPSDH-KLHK**, sedangkan schema DBF versi lengkap/target memuat `PL17_ID`. Riwayat proses Union bertanggal 20 September 2017 juga mencantumkan input `PL_2016_Gambut`. Riwayat selanjutnya memuat perubahan sampai 4 Februari 2019, tetapi tidak memberi rantai input yang cukup untuk memastikan field `PL17_ID` mewakili observasi 2016, 2017 atau pembaruan lain. Ini ambiguitas tahun sumber, bukan alasan mengganti tahun null dengan tahun yang dipilih. Ringkasan lama tetap merupakan catatan tahap pemeriksaan saat itu; temuan metadata ini melengkapinya.

Deskripsi yang sama menerangkan **Peta Areal Berkanal dengan jangkauan 1 km dari pemutakhiran kanal 2017 oleh BRG**. Klaim jangkauan itu berlaku pada konteks `AREA_KANAL` produk poligon, bukan bukti bahwa garis kanal memotong setiap fragmen. Tidak dibuat buffer baru. Paket kandidat tetap memakai hasil irisan garis `Kanal_Riau` langsung, bukan label areal jangkauan. XML garis kanal sendiri hanya menjelaskan judul turunan Sumatera dan proses atribut pada 2017; belum membuktikan kesetaraan dengan input area berkanal atau tanggal survei/citra tiap garis. Tidak ada pembacaan tautan UNC, eksekusi perintah Process atau pengiriman pesan keluar. XML dan checksum diikat ke inventaris asli; ringkasan dibatasi ke klaim sumber tanpa menyalin jalur personel.

Filter pemeriksaan hutan diperbaiki agar tidak mensyaratkan label Non-Hutan. Syaratnya adalah geometri lolos, tanpa error overlay, memiliki bukti label kebakaran historis dan irisan garis kanal. Audit terhadap overlay nyata menghasilkan **182 unit eligible, seluruhnya sudah termasuk hasil pembacaan GFC sebelumnya; 0 unit tambahan terlewat**. Karena himpunan kandidat sama dan checksum bukti cocok, raster/topologi tidak dibaca ulang. Angka 104 tetap hasil observasi sebelumnya, bukan penilaian baru atau perluasan cakupan seluruh 733 unit.

`prepare-restoration-brg-review-queue.mjs` menyiapkan `review-candidates.geojson` berisi 104 poligon unit sumber asli tanpa pemindahan vertex, pemotongan atau perbaikan batas. Identitas dan atribut BBSDLP, rujukan fragmen kebakaran/loss, jumlah bagian kanal yang beririsan serta batas interpretasi dipertahankan. `reviewCandidate` true menyatakan antrean telaah; `priority` Belum dinilai, `ecologicalScore` null, `scoringValidated` false dan kesiapan pelaksanaan belum dinilai. Geometri/atribut sumber yang konflik tidak disembunyikan dan unit tidak dijumlahkan menjadi luas intervensi unik. Semua hasil lokal privat diabaikan Git; paket belum dimuat ke modul produksi.

```powershell
node scripts/prepare-restoration-brg-review-queue.mjs <paket-overlay-privat> <paket-hutan-GFC-privat> <paket-telaah-metadata-privat> 2026-11-10
```

Paket menghasilkan manifest hash sumber/hasil dan audit seleksi. Dua tes tambahan memeriksa seleksi tanpa Non-Hutan serta pelestarian geometri/holes/atribut dan penolakan kandidat yang sudah diberi skor/pengesahan. **140 tes lokal lulus tanpa skip**. Tidak ada uji browser, deployment, perubahan endpoint, database atau menu; Tools staf tetap menggunakan rilis sebelumnya. Langkah berikutnya yang masih diperlukan untuk pengesahan indikator adalah keterangan sumber primer yang menghubungkan field tutupan lahan final ke tahun observasi serta tanggal/metode jaringan kanal, bukan mengubah tahun pemrosesan menjadi tahun survei.

### Membuka paket pada halaman staf

Halaman Prioritas Restorasi menambahkan bagian **Kandidat telaah dari paket privat**. Setelah sesi diverifikasi backend dan peta/sumber gambut dimuat, staf memilih `review-candidates.geojson` dan `manifest.json` dari paket lokal yang sama, kemudian menekan **Muat paket telaah**. Berkas dibaca dalam memori browser, tanpa unggahan, localStorage atau endpoint baru. Backend staf diperiksa kembali sebelum membaca berkas; perubahan sesi menolak proses dan menyembunyikan workspace. Tombol hapus mengeluarkan layer/paket dari tampilan dan memori referensi halaman.

Import dibatasi 12 MiB GeoJSON/64 KiB manifest. SHA-256 berkas dan sumber gambut diperiksa, diikuti identitas/index unit, hash feature sumber, kesamaan geometri persis, keunikan unit serta status belum dinilai/tidak disahkan. Manifest membuktikan integritas terhadap berkas dan sumber yang dipilih, bukan tanda tangan/pengesahan ilmiah. Bahkan manifest yang dihitung ulang tidak meloloskan geometri berbeda atau klaim prioritas final. Hanya properti tampilan yang diizinkan diteruskan ke layer; tekanan tervalidasi dari berkas tidak diimpor.

Outline ungu membedakan kandidat telaah dari hasil prioritas. Filter kabupaten dan popup bekerja pada layer kandidat, sedangkan ringkasan prioritas tetap berasal dari sumber analisis, tanpa penambahan skor/luas restorasi. Kontrol ini berada dalam workspace staf yang sudah ada; tidak menambah pintu masuk atau menu publik. Duplikasi ID tombol pemilih FEG pada markup juga dihapus agar satu kontrol memiliki satu identitas.

Validator berhasil membaca paket nyata 104 kandidat secara lokal. **145 tes lokal lulus**, mencakup import/clear/filter/popup wiring melalui DOM/Leaflet doubles, sesi berakhir, checksum, geometri berubah, duplikasi dan penolakan skor. Pengujian ini bukan uji browser desktop/tablet atau login staf nyata terhadap kode baru; pengujian visual rilis baru masih harus dilakukan setelah rilis diizinkan. Data sumber/keluaran tidak disertakan dalam PR dan mekanisme autentikasi tidak dilemahkan untuk preview localhost. Perbaikan test sementara Windows hanya menyamakan normalisasi realpath dengan API async yang diuji, tanpa mengubah guard produksi.
