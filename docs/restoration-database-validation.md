# Validasi bukti indikator dari database eksisting — internal

`validate-restoration-database-evidence.mjs` membuat matriks kesiapan bukti per unit gambut. Proses ini baca-saja, tidak mengesahkan sumber, menetapkan normalisasi, mengisi nilai indikator, menghitung skor atau mengubah database. Kesiapan infrastruktur tetap terpisah dari kebutuhan ekologis.

```powershell
node scripts/validate-restoration-database-evidence.mjs "private-data/restoration-indicator-evidence-<id>/units-with-evidence.geojson"
# Opsional: paket mentah BPBD dengan manifest privat
node scripts/validate-restoration-database-evidence.mjs "private-data/restoration-indicator-evidence-<id>/units-with-evidence.geojson" "private-data/restoration-bpbd-records-<id>"
```

## Sumber dan keterlacakan

- Masukan adalah paket unit privat yang sudah disiapkan. Hash sumber BBSDLP, indeks baris, geometri asli dan atribut sumber harus cocok dengan berkas BBSDLP dalam checkout. Pemeriksaan geometri teknis dari paket terdahulu dipakai ulang setelah kecocokan sumber dipastikan; ini tidak memberikan persetujuan batas hukum atau memperbaiki geometri otomatis.
- Snapshot objek diperoleh dari endpoint database eksisting `https://webgis-api.yayasangambut.org/snapshots/current/objects.json` tanpa token atau lokasi internal dalam permintaan. Ukuran dibatasi 4 MiB dan request 45 detik. Data ini merupakan versi snapshot objek yang dipublikasikan, bukan seluruh tabel/laporan mentah di Sheets atau seluruh isi R2.
- Masukan unit dibatasi 64 MiB dan harus berada di `private-data`; realpath diperiksa untuk menolak redirect keluar direktori yang dimaksud. ID unit harus unik.
- Source snapshot, matriks, dan manifest disimpan hanya di direktori privat baru. Manifest mencatat SHA-256 snapshot/unit/BBSDLP, URL sumber, waktu pengambilan dan versi snapshot. Input dan sumber tidak ditulis ulang. Data mentah, lokasi dan rincian kasus tidak masuk Git, Pages atau endpoint publik baru.

## Aturan kelayakan bukti

Paket BPBD berisi `manifest.json` dengan `access:staff_only` dan dua entri `records`: UUID 7345eba0-2739-4614-855b-adec8fc75480 (judul 2026) dan ebd32377-bedd-484b-9825-0641d5543354 (judul 2025), `titleYear`, `url`, `name` berupa UUID.geojson, `bytes`, `sha256`, `features`, `retrievedAt`. URL harus persis `https://geoportal.riau.go.id/katalog/<uuid>/download`. Kedua file asli wajib lolos checksum, ukuran, jumlah fitur dan Point/MultiPoint WGS84. Sumber adalah unduhan resmi untuk UUID katalog staf; kesamaan penuh dengan salinan R2 terlindungi belum diverifikasi.

Kategori **Pemadaman** dan **Water drop** adalah record respons, bukan jumlah kebakaran unik. Tanggal/tahun, kategori serta duplikasi baris identik dilaporkan tanpa menghapus atau menggabungkan record. Tidak ada duplikasi baris identik bukan bukti tidak adanya beberapa respons pada kebakaran yang sama. Rentang tanggal minimum/maksimum tidak membuktikan cakupan lengkap; periode kosong tidak menjadi nol. Pemadanan menyimpan referensi berbasis UUID+hash+indeks, semua unit yang cocok dan ketidaklengkapan akibat kandidat geometri bermasalah. Record dengan tanggal bermasalah tetap ditandai sebagai bukti mentah, tidak disahkan.

1. **Domain:** monitoring yang secara eksplisit bertipe mangrove atau lahan mineral tidak dipakai menilai gambut, sekalipun lokasi atau kolom angkanya cocok. Domain yang tidak jelas dipisahkan untuk review. Angka survival tanaman bukan ukuran kehilangan vegetasi bentang lahan.
2. **Identitas:** rekaman monitoring perlu ID stabil. ID berulang tidak diputuskan lewat mayoritas nilai, pilihan rekaman terakhir atau rata-rata. Salinan monitoring yang melekat pada record aset `program_layer` tidak dihitung lagi sebagai pengukuran terpisah.
3. **Nilai:** kolom TMAT dibaca ketat; kosong, NaN dan teks tidak menjadi nol. Nilai nol yang nyata tetap nol. Beberapa kolom yang berisi nilai berbeda pada rekaman yang sama ditandai konflik, bukan dipilih salah satu.
4. **Lokasi:** hanya Point WGS84 eksplisit dipakai untuk menghubungkan pengamatan. Titik dicocokkan secara lokal ke poligon dengan pemeriksaan teknis yang lolos; unit bermasalah tidak menerima penetapan titik. Beberapa unit cocok atau ada kandidat geometri yang dikecualikan berarti keanggotaan belum unik/lengkap. Tidak ada nearest-neighbor, buffer atau interpolasi.
5. **Tanggal dan metadata:** tanggal kegiatan yang tidak valid ditandai. Angka bertanggal saja tetap kandidat bukti, bukan seri hidrologi lengkap. Unit cm dinyatakan dari nama kolom, sementara zona waktu, datum dan kalibrasi tetap belum terkonfirmasi dalam skema audit ini. Status publikasi/aktif tidak berarti validasi ekologis.
6. **Unit analisis:** status persetujuan, flag sumber dan geometri dipertahankan. `blockedBy` menunjukkan alasan unit belum siap. Deklarasi indikator diperiksa dengan mesin scoring eksisting, tetapi audit ini tidak memberikan persetujuan atau mengubah nilai/normalisasi indikator. Seluruh baris keluaran tetap `score:null` dan `approvalGranted:false`.

## Bukti untuk lima indikator

| Indikator | Bukti yang diperiksa | Kebutuhan sebelum skor |
| --- | --- | --- |
| Degradasi | Kandidat laporan kondisi/degradasi gambut yang relevan, bertanggal, beridentitas dan berlokasi | Pengukuran/kriteria degradasi gambut pada unit/periode yang disepakati, metode dan penelaahan yang nyata |
| Riwayat kebakaran | Irisan arsip indikasi terbakar yang sudah ada pada paket unit; error/exclusion dipertahankan | Paket BPBD opsional diperiksa tanggal, tahun, kategori, duplikasi baris identik, integritas dan pemadanan unit; tetap perlu identitas kejadian unik, kelengkapan periode dan metode sebelum indikator disahkan |
| Hidrologi | Nilai asli TMAT yang terisi pada laporan domain gambut; inventaris FDRS/sekat dipisahkan | Seri pengukuran dan metadata datum/waktu/kalibrasi, keterwakilan lokasi dan metode gangguan hidrologi yang ditelaah |
| Kehilangan vegetasi | Observasi piksel tanah dan kehilangan tutupan pohon dari paket raster yang sudah disiapkan | Kesesuaian indikator vegetasi, periode, denominator, cakupan dan metode normalisasi; kehilangan tutupan pohon tidak otomatis sama dengan degradasi |
| Sensitivitas | Kelas kedalaman dan tahun BBSDLP dipertahankan sebagai kategori sumber | Penyelesaian konflik kelas dan metode sensitivitas yang berbukti; tidak memakai titik tengah kelas atau konversi pH kategoris menjadi pengukuran |

`unitsWithEvidence` menghitung unit dengan **bahan kandidat**, bukan unit yang tervalidasi atau dapat diberi skor. Piksel tanpa pusat di dalam poligon tidak dinyatakan sebagai coverage lengkap. Keberadaan arsip BPBD pada peta staf tidak disamakan dengan keberhasilan validasi rekaman mentahnya di paket offline ini. Jumlah objek snapshot dapat berbeda dari tabel Sheets karena versi/cakupan sumber; jangan menjumlahkan keduanya.

## Keluaran dan uji

`validation-matrix.json` mencatat alasan per unit, konteks infrastruktur, kandidat pengamatan dan ringkasan lima indikator. Hasil aktual tersedia hanya pada paket privat yang dicetak script. Tidak ada file hasil operasional atau koordinat internal yang ditambahkan ke dokumentasi ini.

Tes menggunakan geometri stasiun dan gambut nyata dari snapshot repository. Kasus algoritma mencakup nilai nol/kosong/tidak numerik/bertentangan, salah domain, ID laporan berulang, unit yang gagal geometri, serta piksel yang tidak tersedia. Seluruh kasus tersebut harus tetap menolak pengesahan otomatis. Tidak ada dependency baru, endpoint baru, perubahan UI atau deploy pada pekerjaan validasi ini.
