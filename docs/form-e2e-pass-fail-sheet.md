# Form E2E PASS/FAIL Sheet

Tanggal uji: __________
Penguji: __________
Versi deploy Apps Script: __________

## Ringkasan

| No | Skenario | Status (PASS/FAIL) | Catatan Singkat |
|---|---|---|---|
| 1 | Submit dasar berhasil masuk sheet |  |  |
| 2 | Field mineral/gambut tersimpan benar |  |  |
| 3 | Validasi field lahan berjalan (harus blokir saat kosong) |  |  |
| 4 | Tambah Foto Kegiatan |  |  |
| 5 | Perbaikan Informasi |  |  |
| 6 | Titik Baru |  |  |
| 7 | Area/Poligon Baru |  |  |
| 8 | Monitoring |  |  |
| 9 | Replanting/Penyulaman Mangrove |  |  |
| 10 | Kebakaran |  |  |
| 11 | Abrasi |  |  |
| 12 | Biodiversitas |  |  |
| 13 | Capacity Building |  |  |
| 14 | Publish pipeline berjalan |  |  |

## Detail Cepat per Skenario

### 1) Submit dasar berhasil masuk sheet
- Langkah: kirim 1 laporan sederhana.
- Lulus jika: muncul sukses di UI + row baru masuk sheet + status Menunggu Verifikasi.
- Status: ____
- Catatan: ____

### 2) Field kategori ekosistem tersimpan benar
- Langkah: Titik Baru/Area Baru pilih Kategori ekosistem = Lahan Mineral.
- Lulus jika: ada `Kategori_Ekosistem=Lahan Mineral` di Target Feature Properties dan Proposed Changes JSON.
- Status: ____
- Catatan: ____

### 3) Validasi kategori ekosistem berjalan
- Langkah: pilih Titik Baru/Area Baru lalu kosongkan Kategori ekosistem.
- Lulus jika: submit diblokir dengan alert validasi.
- Status: ____
- Catatan: ____

### 4) Tambah Foto Kegiatan
- Langkah: pilih objek WebGIS + upload foto (mangrove minimal 2).
- Lulus jika: submit sukses, metadata target terisi.
- Status: ____
- Catatan: ____

### 5) Perbaikan Informasi
- Langkah: pilih objek + isi minimal 1 atribut baru + catatan.
- Lulus jika: old/new info + proposed changes tersimpan.
- Status: ____
- Catatan: ____

### 6) Titik Baru
- Langkah: pilih titik + isi wajib + foto.
- Lulus jika: geometri Point + lat/long tersimpan.
- Status: ____
- Catatan: ____

### 7) Area/Poligon Baru
- Langkah: gambar/upload polygon + isi wajib.
- Lulus jika: geometri Polygon/MultiPolygon + tidak wajib foto.
- Status: ____
- Catatan: ____

### 8) Monitoring
- Langkah: pilih objek + isi field wajib monitoring + foto.
- Lulus jika: JSON monitoring tersimpan.
- Status: ____
- Catatan: ____

### 9) Replanting/Penyulaman Mangrove
- Langkah: target area_mangrove + isi field wajib + 2 foto.
- Lulus jika: sukses saat valid, gagal saat target/foto tidak valid.
- Status: ____
- Catatan: ____

### 10) Kebakaran
- Langkah: titik + isi wajib + foto.
- Lulus jika: geometri Point tersimpan.
- Status: ____
- Catatan: ____

### 11) Abrasi
- Langkah: titik + isi wajib + foto.
- Lulus jika: geometri Point tersimpan.
- Status: ____
- Catatan: ____

### 12) Biodiversitas
- Langkah: titik + isi wajib + foto.
- Lulus jika: geometri Point tersimpan.
- Status: ____
- Catatan: ____

### 13) Capacity Building
- Langkah: isi peserta + target + mitra + topik (+ dokumen opsional).
- Lulus jika: submit sukses tanpa geometri wajib + JSON capacity tersimpan.
- Status: ____
- Catatan: ____

### 14) Publish pipeline berjalan
- Langkah: set beberapa laporan ke Sudah Dipublikasikan.
- Lulus jika: endpoint publik memuat data terbaru dan atribut baru ikut terbawa saat tersedia.
- Status: ____
- Catatan: ____

## Keputusan Akhir

- Hasil akhir: PASS / FAIL
- Blocker utama (jika FAIL): ______________________________________
- Tindak lanjut: _________________________________________________
