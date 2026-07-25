# Standup Brief - MVP Pre/Post Test (1 Halaman)

## Fokus Hari Ini
Tujuan utama hari ini adalah menyiapkan fondasi backend agar alur pre/post test bisa mulai dipakai besok oleh frontend.

## Outcome Wajib Hari Ini
1. Keputusan produk final:
- Domain resmi email staff.
- Metode verifikasi (OTP atau magic link).
- Aturan identitas peserta.

2. Fondasi data siap:
- Sheet TEST_SESSIONS.
- Sheet TEST_QUESTIONS.
- Sheet TEST_RESPONSES.
- Sheet TEST_STAFF_TOKENS.

3. API dasar sesi berjalan:
- Endpoint list sesi tersedia.
- Endpoint create/update sesi tersedia.
- Validasi domain resmi aktif.

## 5 Task Prioritas
1. PTT-001 Finalisasi keputusan produk.
2. PTT-002 Setup struktur sheet TEST_*.
3. PTT-006 Validasi email domain resmi.
4. PTT-003 Endpoint list sesi test.
5. PTT-005 Endpoint create/update sesi.

## Pembagian Tim
- Product Lead:
  - Menutup PTT-001 sebelum siang.

- Backend Engineer:
  - PTT-002 -> PTT-006 -> PTT-003 -> PTT-005.

- QA:
  - Siapkan payload uji dan skenario valid/invalid.
  - Uji manual endpoint yang selesai pada hari ini.

## Jam Checkpoint
1. Checkpoint siang (sekitar 11:30-12:00):
- Keputusan produk harus final.
- Struktur sheet minimal sudah terbentuk.

2. Checkpoint sore (sekitar 16:00-16:30):
- Endpoint list/create sesi bisa di-call.
- Domain non-resmi dipastikan ditolak.

## Risiko Hari Ini
1. Keputusan domain/OTP belum final.
- Dampak: backend bisa salah desain validasi.
- Mitigasi: eskalasi cepat ke Product Lead sebelum jam 11:00.

2. Struktur sheet berubah di tengah jalan.
- Dampak: endpoint error atau mapping kolom bergeser.
- Mitigasi: freeze header sheet setelah checkpoint siang.

## Definisi Selesai Hari Ini
Hari ini dianggap berhasil jika:
1. Domain restriction aktif dan diuji.
2. Sesi bisa dibuat dan dibaca via API.
3. Data tersimpan di sheet baru dengan header final.

## Next Setelah Hari Ini
Jika outcome wajib tercapai, besok lanjut:
1. Endpoint detail sesi.
2. Endpoint create pertanyaan pre/post.
3. Endpoint submit response peserta.
