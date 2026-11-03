# Pemeriksaan kesiapan input restorasi

Alat baca-saja ini memeriksa kelengkapan input bagi mesin scoring yang sudah ada. Tidak ada endpoint, unggahan, perubahan database, pemuatan data privat melalui jaringan, atau perubahan hasil di peta. Jangan memasukkan berkas privat ke repository publik atau lampiran PR.

Jalankan pada berkas GeoJSON yang sudah tersedia:

```powershell
node scripts/check-restoration-inputs.mjs data/Gambut_BBSDLP_2019.geojson
```

Laporan JSON hanya berisi jumlah agregat, alasan indikator terblokir, versi model dan SHA-256 berkas. Tidak menyalin geometri, atribut mentah, nama, ID, URL sumber atau identitas penelaah. Exit code: `0` input lengkap menurut deklarasi, `2` ada unit belum dinilai, `1` format/berkas tidak dapat diperiksa. Batas input 64 MiB dan 25.000 fitur. Pemeriksaan tidak menjalankan server localhost.

`input-complete` bukan persetujuan ahli atau izin operasional. Identitas penelaah dan referensi pada input adalah deklarasi dari pipeline hulu; alat ini tidak memverifikasi keaslian persetujuan tersebut. Pemeriksaan hanya mensyaratkan tipe geometri Polygon/MultiPolygon, bukan validitas koordinat, CRS, topologi, keabsahan batas atau relasi spasial. Status `geometryValidated` dan `approvalGranted` selalu false. Berkas tidak otomatis masuk aplikasi.

## Kontrak input

Setiap Feature memiliki `properties.restorationIndicators` dengan lima kunci berikut. Semua wajib; tidak ada penggantian nilai kosong dengan nol atau pembobotan ulang.

| Kunci | Bobot | Data/keputusan yang masih diperlukan |
| --- | --- | --- |
| degradation | 30% | Ukuran degradasi per unit, periode pengamatan, metode dan validasi |
| fireHistory | 25% | Riwayat kebakaran terverifikasi lintas waktu, bukan snapshot hotspot |
| hydrology | 25% | Kondisi hidrologi atau proksi yang disetujui; titik sekat kanal tidak mencukupi |
| vegetationLoss | 15% | Kehilangan vegetasi antarwaktu dengan cakupan sebanding dan QA |
| peatSensitivity | 5% | Aturan sensitivitas yang disetujui berdasarkan karakteristik gambut |

Untuk setiap kunci dibutuhkan:

- `value`: angka finite dalam rentang normalisasi yang disetujui.
- `validated`: true hanya setelah review nyata.
- `validation.reviewer` dan `validation.reference`: identitas penelaah dan bukti review yang dapat diverifikasi secara internal.
- `provenance.source`, `provenance.year` (bilangan bulat 1900–2100), `provenance.version`.
- `normalization.method`: metode yang disetujui; `min` dan `max` finite dengan max > min; `direction` increasing atau decreasing (default increasing).

Jangan menambahkan deklarasi validated hanya agar laporan menjadi lengkap. Nilai, metode, rentang, tahun dan versi tidak boleh diturunkan secara sembarang dari tampilan layer. Skor kebutuhan ekologis tidak mengukur kesiapan pelaksanaan.

## Hasil sumber yang tersedia

Pemeriksaan berkas BBSDLP yang tersedia pada pengembangan ini: 736 unit, 0 dinilai, 736 belum dinilai; setiap indikator belum tersedia pada seluruh unit. Ini pemeriksaan input aktual, bukan hasil penetapan prioritas. Dataset FEG yang sudah diuji pada halaman staf tetap merupakan konteks ekosistem dan pengelompokan kode KHG; pengujian pemuatan/popup tidak mengesahkan indikator ekologis.

## Langkah menuju wilayah prioritas nyata

1. Tetapkan unit analisis dan identitas stabil; verifikasi CRS/topologi serta hubungan BBSDLP–KHG/FEG sebelum overlay dan perhitungan luas.
2. Susun nilai lima indikator pada unit yang sama, beserta periode, sumber dan versi yang dapat ditelusuri.
3. Minta review ahli atas metode normalisasi, ambang serta bukti validasi. Kategori sekarang masih sementara.
4. Periksa berkas dengan alat ini; perbaiki unit/indikator yang terblokir tanpa menebak nilai.
5. Integrasikan melalui jalur staf yang terlindungi setelah kontrol akses, persetujuan data dan QA spasial diverifikasi. Jangan menaruh indikator privat dalam GeoJSON statis publik.
