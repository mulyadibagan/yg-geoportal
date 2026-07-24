# Quick Smoke Test: 3 Skenario Prioritas

Tanggal: 2026-07-24

Tujuan: validasi cepat bahwa field baru mineral/gambut dan aturan form kritikal bekerja end-to-end.

## Data Umum (pakai untuk semua skenario)

- Nama: QA Smoke Test
- Instansi: Internal QA
- Email: qa-smoke@example.com
- HP: 081234567890
- Provinsi: Riau
- Kabupaten: Bengkalis
- Kecamatan: Bantan
- Desa: Selatbaru
- Judul: Uji cepat form
- Deskripsi: Uji otomatisasi/manual 3 skenario prioritas

## Skenario 1: Titik Baru + Lahan Mineral (harus SUKSES)

Langkah:
1. Pilih jenis laporan: Titik Baru.
2. Isi Mitra pendanaan/donor: Aramco Asia Singapore.
3. Isi Jumlah bibit pohon hutan: 1200.
4. Isi Jenis/pohon hutan: Alstonia scholaris.
5. Pilih Jenis lahan penanaman: Mineral (bukan gambut).
6. Tentukan titik di peta (klik sekali).
7. Upload 1 foto.
8. Submit.

Expected:
1. Muncul pesan sukses di UI.
2. Row baru masuk sheet.
3. Di kolom Target Feature Properties ada:
   - Jenis_Lahan_Penanaman: Mineral
   - Jumlah_Bibit_Hutan: 1200
   - Jenis_Bibit_Hutan: Alstonia scholaris
4. Di kolom Proposed Changes JSON ada key yang sama.

## Skenario 2: Validasi Lahan Kosong (harus GAGAL TERKONTROL)

Langkah:
1. Pilih jenis laporan: Titik Baru.
2. Isi donor.
3. Isi Jumlah bibit pohon hutan: 500.
4. Biarkan Jenis lahan penanaman kosong.
5. Tentukan titik, isi field wajib, upload 1 foto.
6. Submit.

Expected:
1. Alert validasi muncul: wajib pilih jenis lahan penanaman.
2. Submit dibatalkan.
3. Tidak ada row baru masuk sheet.

## Skenario 3: Replanting Mangrove (aturan ketat)

Skenario 3A (harus SUKSES)
1. Pilih jenis laporan: Replanting/Penyulaman Mangrove.
2. Pilih objek dari layer area_mangrove.
3. Isi tanggal kegiatan.
4. Isi jumlah bibit: 200.
5. Isi jenis bibit: Rhizophora mucronata.
6. Isi luas area: 0.25.
7. Pilih penyebab: Kematian bibit.
8. Isi catatan pelaksanaan.
9. Upload minimal 2 foto (BEFORE dan AFTER).
10. Submit.

Expected:
1. Muncul sukses.
2. Data replanting tersimpan sebagai JSON.

Skenario 3B (harus GAGAL TERKONTROL)
1. Ulangi Replanting, tapi hanya upload 1 foto.

Expected:
1. Alert: wajib minimal 2 foto.
2. Submit dibatalkan.

## Checklist Hasil Cepat

- [ ] Skenario 1 PASS
- [ ] Skenario 2 PASS
- [ ] Skenario 3A PASS
- [ ] Skenario 3B PASS

Keputusan:
- PASS jika semua centang.
- FAIL jika salah satu tidak sesuai expected.
