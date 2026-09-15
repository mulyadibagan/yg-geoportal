# Google Sheets Template: PASS/FAIL Otomatis

Tanggal: 2026-07-24

Dokumen ini melengkapi:
- docs/form-e2e-pass-fail-sheet.csv

## 1. Import Data

1. Buat Google Sheet baru.
2. Import file docs/form-e2e-pass-fail-sheet.csv.
3. Pastikan header berada di baris 1.

Struktur kolom yang diharapkan:
- A: No
- B: Skenario
- C: Langkah Singkat
- D: Kriteria Lulus
- E: Status (PASS/FAIL)
- F: Catatan

## 2. Validasi Dropdown Status

1. Blok range E2:E.
2. Data > Data validation.
3. Criteria: Dropdown.
4. Opsi:
   - PASS
   - FAIL
   - BLOCKED
   - NOT RUN
5. Aktifkan reject input jika nilainya di luar opsi.

## 3. Conditional Formatting (Warna Otomatis)

Buat 4 aturan untuk range A2:F.

Aturan 1:
- Format cells if: Custom formula is
- Formula: =$E2="PASS"
- Warna: hijau muda, teks hijau gelap

Aturan 2:
- Format cells if: Custom formula is
- Formula: =$E2="FAIL"
- Warna: merah muda, teks merah gelap

Aturan 3:
- Format cells if: Custom formula is
- Formula: =$E2="BLOCKED"
- Warna: kuning muda, teks coklat tua

Aturan 4:
- Format cells if: Custom formula is
- Formula: =$E2="NOT RUN"
- Warna: abu-abu muda, teks abu gelap

Urutan aturan:
1. FAIL
2. BLOCKED
3. PASS
4. NOT RUN

## 4. Ringkasan Otomatis

Tambahkan blok ringkasan di H1:J8.

Contoh isi:
- H1: Ringkasan Uji
- H2: Total skenario
- H3: PASS
- H4: FAIL
- H5: BLOCKED
- H6: NOT RUN
- H7: Persentase PASS
- H8: Keputusan Akhir

Rumus:
- I2: =COUNTA(A2:A)
- I3: =COUNTIF(E2:E,"PASS")
- I4: =COUNTIF(E2:E,"FAIL")
- I5: =COUNTIF(E2:E,"BLOCKED")
- I6: =COUNTIF(E2:E,"NOT RUN")
- I7: =IFERROR(I3/I2,0)
- I8: =IF(I4>0,"FAIL",IF(I5>0,"BLOCKED",IF(I6>0,"PARTIAL","PASS")))

Format tambahan:
- I7: format persen 0.00%
- I8: gunakan conditional formatting kecil:
  - PASS hijau
  - FAIL merah
  - BLOCKED kuning
  - PARTIAL abu-abu

## 5. Quality Gate yang Disarankan

Gunakan aturan sederhana berikut:
- PASS: semua skenario PASS.
- BLOCKED: tidak ada FAIL tetapi ada BLOCKED atau NOT RUN.
- FAIL: minimal satu FAIL.

## 6. Opsional: Kolom Bukti

Jika ingin pelacakan lebih kuat, tambahkan:
- G: Link bukti (screenshot/sheet row)
- H: Penguji
- I: Waktu uji

Jika kolom ditambah, sesuaikan range conditional formatting menjadi A2:I.
