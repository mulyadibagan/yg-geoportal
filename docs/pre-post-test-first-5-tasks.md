# 5 Task Pertama Paling Tepat untuk Mulai

## Tujuan
Memastikan fondasi MVP siap secepat mungkin tanpa membuat tim tersebar ke banyak pekerjaan sekaligus.

## Prioritas Eksekusi Besok

### 1. PTT-001 - Finalisasi keputusan produk hari 1
- Owner: Product Lead + semua lead
- Kenapa duluan:
  - Semua implementasi teknis bergantung pada keputusan ini.
  - Menghindari rework backend validasi akses.
- Output wajib:
  - Domain resmi final.
  - Metode verifikasi final (OTP atau magic link).
  - Aturan identitas peserta final.

### 2. PTT-002 - Setup struktur sheet TEST_*
- Owner: Backend Engineer
- Kenapa duluan:
  - Semua endpoint membutuhkan struktur data stabil.
  - QA bisa langsung menyiapkan data dummy dari sini.
- Output wajib:
  - TEST_SESSIONS, TEST_QUESTIONS, TEST_RESPONSES, TEST_STAFF_TOKENS siap pakai.

### 3. PTT-006 - Validasi email domain resmi staff
- Owner: Backend Engineer
- Kenapa duluan:
  - Ini kontrol keamanan paling penting sesuai arahan pengguna.
  - Menjadi guardrail semua endpoint manajemen sesi dan soal.
- Output wajib:
  - Permintaan dari non-domain resmi selalu ditolak dengan pesan yang jelas.

### 4. PTT-003 - Endpoint list sesi test
- Owner: Backend Engineer
- Kenapa duluan:
  - Frontend dashboard butuh endpoint ini untuk mulai render.
  - Membuka jalur integrasi lebih cepat untuk FE.
- Output wajib:
  - Endpoint mengembalikan daftar sesi dengan status dan metrik minimum.

### 5. PTT-005 - Endpoint create/update sesi
- Owner: Backend Engineer
- Kenapa duluan:
  - Tanpa ini, tidak ada sesi yang bisa dipakai oleh form peserta.
  - Mengunci jalur data dari awal agar konsisten.
- Output wajib:
  - Staff domain resmi bisa buat sesi baru dan ubah sesi existing.

## Pembagian Kerja Hari Pertama
- Product:
  - Tuntaskan PTT-001 sebelum jam 11:00.
- Backend:
  - Mulai PTT-002 paralel dengan PTT-001 (draft struktur).
  - Lanjut PTT-006, lalu PTT-003, lalu PTT-005.
- QA:
  - Menyiapkan data uji dan template payload berdasarkan hasil PTT-001.

## Checkpoint Hari Pertama
- Checkpoint 1 (siang):
  - Keputusan produk final tersedia.
- Checkpoint 2 (sore):
  - Endpoint list sesi dan create sesi sudah bisa diuji manual.

## Kriteria Selesai Hari Pertama
- Domain restriction aktif.
- Sesi dapat dibuat dan dibaca melalui API.
- Data tersimpan ke sheet baru dengan struktur final.

## Langkah Hari Kedua (Preview)
Setelah 5 task awal ini selesai, lanjut:
1. PTT-004 (detail sesi)
2. PTT-007 (create pertanyaan)
3. PTT-009 (submit response peserta)
