# Sumber alternatif dengan asal-usul dan lisensi terverifikasi

Pemeriksaan 4 November 2026. Lisensi terbuka mengizinkan pemakaian sesuai syarat atribusi; tidak mengesahkan ketepatan ekologis, kesesuaian spasial atau perubahan atribut BBSDLP. Tidak ada sumber di bawah yang diberi skor.

| Sumber primer | Versi / cakupan | Lisensi | Status aktual dan batas pemakaian |
| --- | --- | --- | --- |
| [Vernimmen, Deep peat map eastern Sumatra](https://data.mendeley.com/datasets/c83z4df8ky/1), DOI 10.17632/c83z4df8ky.1 | v1, diterbitkan 12 Maret 2020; Sumatra timur; raster 100 m | CC BY 4.0 | GeoTIFF asli 8.442.611 byte berhasil diunduh privat; SHA-256 cocok dengan penerbit. Peta turunan riset LiDAR dan pengukuran lapangan, bukan kelas tanah BBSDLP asli. |
| [Taufik, Station-based peat moisture in Sumatra peatland](https://data.mendeley.com/datasets/27y943wbkw/1), DOI 10.17632/27y943wbkw.1 | v1, 18 Oktober 2022; 21 stasiun Sumatra, periode 2018–2019 | CC BY 4.0 | `moisture_dataset.csv` asli 6.503 byte berhasil diunduh dan checksum penerbit cocok. Metadata menyebut agregasi bulanan, sensor HydraProbe di 10–20 cm, persen volume air. Ini kelembapan, bukan tinggi muka air; berkas belum dianalisis atau dipasangkan ke unit. |
| [Taufik, Peat water retention from different land-uses in Riau](https://data.mendeley.com/datasets/jj35xcx98v/1), DOI 10.17632/jj35xcx98v.1 | v1, 27 Oktober 2022; sampel Riau 2019 dan 2022 | CC BY 4.0 | `riau_pf.csv` asli 2.637 byte berhasil diunduh dan checksum penerbit cocok. Pengukuran retensi laboratorium lapisan tanah atas/bawah; bukan seri TMAT. Tabel belum dianalisis atau diubah menjadi indikator. |
| [Dadap, Drainage Canals in Southeast Asian Peatlands — Stanford Digital Repository](https://purl.stanford.edu/yj761xk5815), DOI 10.25740/yj761xk5815 | Diterbitkan 2020, citra Planet Juli–September 2017; Sumatra, Borneo, Semenanjung Malaysia, 5 m | CC BY 3.0 Unported | Metadata dan tautan unduhan resmi terverifikasi. Arsip `geotiffs.zip` 227.398.783 byte menurut HEAD; belum diunduh atau diproses. Deteksi kanal dan jalan dari CNN, bukan seluruh kanal lapangan atau TMAT aktual; tahun publikasi tidak disamakan dengan tahun citra. |

## Akuisisi yang bisa dijalankan

```powershell
node scripts/acquire-restoration-research-peat.mjs deep-peat
node scripts/acquire-restoration-research-peat.mjs moisture
node scripts/acquire-restoration-research-peat.mjs retention
```

Script hanya menerima tiga kunci sumber tetap, versi v1 yang dipatok, metadata publik non-konfidensial dan lisensi CC BY 4.0. Nama, ukuran, jenis berkas, SHA-256 penerbit dan URL resmi diperiksa sebelum paket dinyatakan lengkap. Metadata, inventaris, sumber utuh dan manifest disimpan di `private-data` yang diabaikan Git/dikecualikan dari Pages. Tidak ada geometri lokal, identitas pemohon atau token staf yang dikirim. Tidak ada dependency baru.

Header GeoTIFF yang benar-benar diperiksa: 5.938 × 7.162 piksel, satu band, EPSG:32748 (WGS 84 / UTM 48S), grid 100 × 100 m dan nodata -9999. Header ini tidak mengesahkan arti nilai band. Belum dilakukan reproyeksi atau overlay; memperlakukan koordinat UTM sebagai longitude/latitude akan menghasilkan analisis salah. Resolusi 100 m juga tidak cukup untuk memutuskan kelas sliver sub-piksel. **Konflik BBSDLP belum ditutup dengan raster ini.**

Keterlacakan metode peta gambut dalam: [artikel Vernimmen dkk. (2020)](https://pmc.ncbi.nlm.nih.gov/articles/PMC7227361/), DOI 10.1186/s13021-020-00139-2, menautkan dataset tersebut dan DTM pendukung [10.17632/72r3bvdd3r.1](https://data.mendeley.com/datasets/72r3bvdd3r/1). DTM 500 m tersebut bukan kedalaman gambut atau TMAT; belum diunduh.

Keterlacakan kanal: [artikel Dadap dkk. (2021)](https://doi.org/10.1029/2020AV000321) dan [laman dataset kelompok riset Stanford](https://koningslab.stanford.edu/datasets) menautkan repositori resmi. [Indeks tile resmi](https://purl.stanford.edu/zy089tj2215) tersedia terpisah; jangan menganggap keterangan extent satu item sebagai cakupan setiap tile di seluruh arsip.

## Sumber sah yang tidak dipakai sebagai pengganti

- [Taufik dkk. (2022), seri groundwater dan sifat hidrologi](https://www.sciencedirect.com/science/article/pii/S2352340922001159), DOI 10.1016/j.dib.2022.107903: lokasi stasiun Batanghari/Jambi dan Kubu Raya/Kalimantan Barat, bukan Riau. Dapat menjadi rujukan metode, bukan pengukuran di unit Riau.
- [Zenodo 13951439](https://zenodo.org/records/13951439): estimasi global gabungan dengan cakupan waktu luas dan resolusi kasar. Bukan pengganti kelas lokal atau pengukuran lapangan; tidak dipakai mengisi konflik atau skor.
- Studi kanal berbasis satelit tidak menggantikan seri TMAT stasiun. Kelembapan dan retensi tidak dikonversi ke TMAT tanpa model yang tervalidasi.

Langkah paling berguna berikutnya: verifikasi legenda dan ketidakpastian raster gambut dalam, reproyeksi yang teruji untuk perbandingan konteks, serta pemilihan tile kanal yang benar. Tetap pertahankan kebutuhan versi sumber BBSDLP dan metadata pengukuran SiTMAT untuk pengesahan indikator. Tidak ada email dikirim; keputusan menyimpan draf BRMP saja tetap berlaku.

## Penelusuran TMAT tambahan — 4 November 2026

[Deshmukh dkk. (2023)](https://doi.org/10.1038/s41586-023-05860-9) menautkan data sumber ke [Zenodo 7728463](https://zenodo.org/records/7728463). Extended Data Fig. 2 dijelaskan sebagai seri muka air rata-rata tiga piezometer, bukan pengukuran di setiap poligon restorasi. Berkas asli `Deshmukh_ED_Fig. 2.xlsx` versi v.03 berhasil diperoleh melalui tautan unduhan publik di Chrome. API/unduhan CLI mengembalikan HTTP 403; jalur browser biasa berhasil tanpa login atau bypass kontrol akses. Ukuran 127.820 byte; MD5 cocok dengan penerbit (7dbad64f0455f79acffbfe0f43e8bb2e), SHA-256 7ce0f333e4338c2334898240338bc00d2ef634e5f0ae3b949ebc32b2358c3752. Lisensi CC BY 4.0 tertera pada halaman repositori. Panel a memuat 1.825 baris numerik bertanggal 1 Juni 2017 sampai 30 Mei 2022, tanpa tanggal duplikat atau hari kalender hilang di dalam rentang file. Ini pemeriksaan tabel terbitan, bukan bukti setiap alat merekam lengkap. Kolom C bertajuk Groundwater level (m); datum dan tanda diambil dari caption artikel: positif di atas dan negatif di bawah peat hollow surface. Rujukan [stasiun ITP AsiaFlux](https://asiaflux.nies.go.jp/site-info/ITP.html) menyediakan konteks metode/lokasi, tetapi tidak mengesahkan metadata alat internal yang berbeda. Jangan memakai seri model, digitasi grafik atau rata-rata wilayah untuk menggantikan pengukuran unit.

Penelusuran arsip internal menemukan narasi pengamatan muka air sebelum/sesudah kegiatan. Kutipan relevan, identitas sumber dan batas penggunaannya disimpan privat. Tanggal kegiatan tidak dianggap sebagai waktu pembacaan sensor; perkiraan dalam narasi tidak dipindahkan menjadi nilai indikator. Satu kandidat workbook BIFF/XLS berhasil diperoleh tetapi isinya belum terurai dan keasliannya sebagai seri pengukuran belum terverifikasi. Kandidat tersebut tidak dipakai untuk scoring. Data SiTMAT asli yang sudah diperoleh sebelumnya tetap dipertahankan; belum ada seri tambahan yang memenuhi seluruh metadata untuk pengesahan indikator.

Ekstraksi baca-saja memakai Python/openpyxl yang sudah tersedia pada runtime dokumen desktop:

```powershell
python scripts/extract-restoration-research-tmat.py "private-data/Deshmukh_ED_Fig.2.xlsx"
```

Gunakan executable Python bundled jika `python` sistem hanya alias Windows. Tidak perlu menginstal dependency baru. Script hanya menerima file privat dengan kedua checksum versi di atas, membatasi ukuran XLSX/ZIP dan memeriksa header. Workbook asli disalin utuh; sheet Panel a diekstrak dengan referensi sel, nilai native dan tanggal tanpa memberi zona waktu. Metadata, audit, sumber serta manifest SHA-256 tetap privat. Panel b/c merupakan evapotranspirasi, bukan seri TMAT tambahan.

Metadata yang masih terbuka: lokasi masing-masing dari tiga piezometer pembentuk rata-rata, metode agregasi/QA dan perlakuan gap pada seri itu, zona waktu representasi harian, serta rekam kalibrasi alat. Metode artikel menyebut Solinst Levelogger Model 3001 dan logging 30 menit sebagai konteks pengukuran; file Panel a tidak berisi seri mentah per alat pada interval tersebut. Tanggal Excel pukul 00:00 tidak dianggap sebagai waktu pembacaan nyata. Koordinat tower tidak dipakai sebagai pengganti koordinat seri rata-rata yang membentang 12 km. Tidak ada penetapan ke unit restorasi, interpolasi, konversi ke skor atau deklarasi metadata lengkap.

Metadata keluaran kini memuat `fieldReview` dan `readiness.blockedBy`: satuan dan datum/tanda mempunyai rujukan sumber; konteks alat dipisahkan dari provenance per piezometer. Rujukan local time untuk analisis fluks tidak mengonfirmasi zona waktu agregasi harian TMAT. Kalibrasi CO2 pada [profil ITP AsiaFlux](https://asiaflux.nies.go.jp/site-info/ITP.html) dan kalibrasi gas N2O pada [Supplementary Methods penerbit](https://static-content.springer.com/esm/art%3A10.1038%2Fs41586-023-05860-9/MediaObjects/41586_2023_5860_MOESM1_ESM.pdf) tidak diterapkan pada transduser tekanan muka air. Lampiran 9 halaman diperoleh dan diperiksa secara baca-saja (SHA-256 3e6fec2291e23137c0454c537bea6ab04251548a4bb3811926ca1ed94f3e09f9); bukti serta catatan pemeriksaan disimpan privat. Metadata penting yang belum terkonfirmasi tetap null/terblokir, bukan disimpulkan dari lokasi geografis atau kelengkapan baris.
