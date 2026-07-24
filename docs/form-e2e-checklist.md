# Form E2E Checklist (WebGISYG)

Tanggal: 2026-07-24

## 1. Persiapan

1. Deploy ulang Apps Script Web App setelah perubahan backend.
2. Pastikan URL action form mengarah ke deployment terbaru.
3. Buka halaman report dan siapkan akun/akses untuk cek sheet verifikasi.
4. Siapkan minimal 3 foto kecil (jpg) untuk pengujian upload.
5. Siapkan 1 file PDF kecil untuk pengujian Capacity Building.

## 2. Cek Koneksi Dasar

1. Buka form laporan.
2. Isi data minimal wajib untuk satu laporan sederhana (misalnya Titik Baru).
3. Submit.
4. Verifikasi muncul pesan sukses di UI.
5. Verifikasi satu baris baru masuk ke sheet.
6. Verifikasi Status awal: Menunggu Verifikasi.

## 3. Uji Field Baru Mineral vs Gambut (Wajib)

Skenario A: Titik Baru dengan atribut pohon hutan

1. Pilih jenis laporan: Titik Baru.
2. Isi donor.
3. Pilih Kategori ekosistem area baru: Lahan Mineral.
4. Isi Jumlah bibit pohon hutan (contoh: 1200).
5. Isi Jenis/pohon hutan (contoh: Alstonia scholaris).
6. Lengkapi titik, judul, deskripsi, dan 1 foto.
7. Submit.

Expected:

1. Laporan berhasil dikirim.
3. Di sheet, kolom Target Feature Properties memuat:
   - Kategori_Ekosistem: Lahan Mineral
   - Jumlah_Bibit_Hutan: 1200
   - Jenis_Bibit_Hutan: Alstonia scholaris
3. Di sheet, kolom Proposed Changes JSON memuat key yang sama.

Skenario B: Validasi wajib pilih jenis lahan

1. Pilih Titik Baru.
2. Isi donor dan data wajib lainnya.
3. Jangan pilih Kategori ekosistem area baru.
4. Submit.

Expected:

1. Muncul alert validasi yang meminta memilih kategori ekosistem objek baru.
2. Form tidak terkirim.

## 4. Uji Semua Tipe Form

### 4.1 Tambah Foto Kegiatan

1. Pilih objek WebGIS.
2. Upload foto (untuk area mangrove: minimal 2 foto).
3. Submit.

Expected:

1. Berhasil submit.
2. Row baru masuk sheet.
3. Target Layer ID, Target Feature Properties, Geometry GeoJSON terisi.

### 4.2 Perbaikan Informasi

1. Pilih objek WebGIS.
2. Isi minimal 1 atribut perubahan.
3. Isi catatan alasan perbaikan.
4. Submit.

Expected:

1. Berhasil submit.
2. Informasi Lama, Informasi Usulan, Proposed Changes JSON terisi.

### 4.3 Titik Baru

1. Pilih Titik Baru.
2. Tentukan 1 titik di peta.
3. Isi data wajib dan 1 foto.
4. Submit.

Expected:

1. Berhasil submit.
2. Jenis Geometri = Point.
3. Latitude/Longitude terisi.

### 4.4 Area/Poligon Baru

1. Pilih Area/Poligon Baru.
2. Gambar Polygon atau upload KML/KMZ/GeoJSON polygon.
3. Isi data wajib.
4. Submit.

Expected:

1. Berhasil submit.
2. Jenis Geometri = Polygon atau MultiPolygon.
3. Form tidak mewajibkan foto.

### 4.5 Monitoring

1. Pilih objek WebGIS.
2. Isi jenis monitoring, kondisi umum, temuan monitoring.
3. Untuk Sekat Kanal isi jumlah unit > 0.
4. Untuk Tinggi Muka Air/FDRS isi water table + kondisi pelampung.
5. Upload minimal 1 foto.
6. Submit.

Expected:

1. Berhasil submit.
2. proposedInformation berisi JSON monitoring.

### 4.6 Replanting/Penyulaman Mangrove

1. Pilih objek layer area_mangrove.
2. Isi tanggal kegiatan, jumlah bibit, jenis, luas, penyebab, catatan.
3. Upload minimal 2 foto BEFORE/AFTER.
4. Submit.

Expected:

1. Berhasil submit.
2. Sistem menolak jika target bukan area_mangrove.
3. Sistem menolak jika foto kurang dari 2.

### 4.7 Kebakaran

1. Pilih Kebakaran.
2. Tentukan titik.
3. Isi data wajib + 1 foto.
4. Submit.

Expected:

1. Berhasil submit.
2. Jenis Geometri = Point.

### 4.8 Abrasi

1. Pilih Abrasi.
2. Tentukan titik.
3. Isi data wajib + 1 foto.
4. Submit.

Expected:

1. Berhasil submit.
2. Jenis Geometri = Point.

### 4.9 Biodiversitas

1. Pilih Biodiversitas.
2. Tentukan titik.
3. Isi data wajib + 1 foto.
4. Submit.

Expected:

1. Berhasil submit.
2. Jenis Geometri = Point.

### 4.10 Capacity Building

1. Pilih Capacity Building.
2. Isi peserta (L/P), target peserta, mitra/narasumber, topik.
3. Upload PDF/PPT opsional dan/atau isi link dokumen.
4. Submit.

Expected:

1. Berhasil submit.
2. Tidak wajib geometri titik/polygon.
3. proposedInformation berisi JSON capacity building.

## 5. Cek Publish Pipeline

1. Ambil 1 laporan dari tiap tipe penting (Titik Baru, Area Baru, Monitoring, Replanting).
2. Ubah status menjadi Sudah Dipublikasikan lewat dashboard admin.
3. Cek endpoint public-reports/public-updates yang biasa dipakai frontend.

Expected:

1. Data terbit sesuai tipe.
2. Atribut baru Kategori_Ekosistem/Jenis_Ekosistem ikut terbawa untuk laporan objek baru.

## 6. Kriteria Lulus

1. Semua tipe form bisa submit tanpa error.
2. Validasi wajib tetap berjalan sesuai aturan tiap tipe.
3. Tidak ada regresi upload foto/PDF.
4. Field baru mineral vs gambut tersimpan dan bisa ditelusuri di data hasil proses.
