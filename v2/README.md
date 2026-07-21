# YG Conservation Platform — WebGIS V2

WebGIS V2 adalah fondasi integrasi data Yayasan Gambut. Versi ini berjalan
terpisah dari WebGIS V1 agar operasional produksi tetap aman selama proses
migrasi.

Dashboard donor PPCF menghubungkan capaian Final Report Pematang Duku
2025–2026 dengan bukti objek lapangan. Sekat kanal, FDRS, titik kegiatan,
dan polygon kopi dihitung ulang dari GeoJSON; angka yang hanya tersedia pada
laporan diberi label sumber, sedangkan perbedaan luas diberi tanda rekonsiliasi.

## Tujuan

- Satu identitas permanen untuk setiap objek spasial.
- Program, proyek, donor, monitoring, media, dan sumber data terhubung.
- Riwayat objek tetap utuh walaupun nama, atribut, atau geometri diperbarui.
- Setiap angka penting dapat ditelusuri kembali ke dokumen sumber.
- Tampilan responsif untuk desktop dan perangkat lapangan.

## Model data inti

```text
PROGRAM
  └── PROJECT
        ├── DONOR
        └── SPATIAL_OBJECT
              ├── MONITORING_EVENT
              ├── MEDIA
              ├── DOCUMENT
              └── CHANGE_LOG
```

Relasi utama memakai UUID permanen. `Object_ID` lama tetap digunakan jika
tersedia; data tanpa ID diberi ID deterministik sementara sampai proses
migrasi selesai.

## Sumber yang sudah dipetakan

- Master Database dan sembilan layer GeoJSON V1.
- Final Baseline Mangrove 2024.
- Aramco Phase 1 Final Report.
- Aramco Phase 2 Final Report.
- Restorasi Yayasan Gambut.
- Annual Report 2025.

Katalog sumber pada MVP ini berada di `app.js`. Tahap API akan memindahkannya
ke tabel `SOURCE_RECORD` tanpa mengubah antarmuka.

## Fitur MVP

- Peta satelit Esri dengan sembilan layer spasial.
- Pencarian global objek, lokasi, proyek, donor, dan atribut.
- Filter lintas data berdasarkan program, donor, dan kabupaten.
- Ringkasan portofolio proyek dan luas mangrove.
- Profil objek dengan tab Ringkasan, Monitoring, Media, dan Sumber.
- Penanda kualitas data untuk objek yang belum memiliki donor.
- Tombol monitoring khusus objek area penanaman mangrove.
- Tata letak responsif dengan panel data pada perangkat seluler.

## Tahap integrasi berikutnya

1. Membuat Object Registry dan UUID permanen di database.
2. Memigrasikan Master Database, laporan publik, dan foto ke tabel relasional.
3. Menyediakan API baca/tulis dengan autentikasi berbasis peran.
4. Menghubungkan formulir monitoring langsung ke `SPATIAL_OBJECT_UUID`.
5. Menambahkan audit trail, jadwal monitoring, dokumen, dan dashboard donor.

## Menjalankan lokal

Jalankan server statis dari root repository, lalu buka `/v2/`. Halaman tidak
boleh dibuka langsung melalui `file://` karena data GeoJSON dimuat lewat HTTP.
