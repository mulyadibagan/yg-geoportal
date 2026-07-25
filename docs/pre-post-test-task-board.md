# Task Board Siap Pakai - MVP Pre/Post Test

## Cara Pakai
1. Buat board dengan 4 kolom: Backlog, To Do, In Progress, Done.
2. Copy setiap kartu di bawah ke tool manajemen task.
3. Gunakan ID task agar mudah tracking saat standup.

## Template Label
- Area: Backend, Frontend Dashboard, Frontend Form, QA, Product
- Prioritas: P0, P1, P2
- Tipe: Feature, Bug, Tech Debt, Decision

## Backlog

### PTT-001 - Finalisasi keputusan produk hari 1
- Area: Product
- Prioritas: P0
- Tipe: Decision
- Owner: PO + Lead
- Deskripsi:
  - Final domain resmi email staff.
  - Final metode verifikasi (OTP atau magic link).
  - Final aturan identity peserta.
- Definition of Done:
  - Keputusan tertulis dan disetujui tim.

### PTT-002 - Setup struktur sheet TEST_* 
- Area: Backend
- Prioritas: P0
- Tipe: Feature
- Owner: BE
- Deskripsi:
  - Buat TEST_SESSIONS, TEST_QUESTIONS, TEST_RESPONSES, TEST_STAFF_TOKENS.
- Definition of Done:
  - Sheet tersedia dengan header final.
  - Helper create/get sheet berjalan.

### PTT-003 - Endpoint list sesi test
- Area: Backend
- Prioritas: P0
- Tipe: Feature
- Owner: BE
- Deskripsi:
  - Tambah doGet page test-sessions.
- Definition of Done:
  - Mengembalikan list sesi minimal dengan status, date, title, counts.

### PTT-004 - Endpoint detail sesi test
- Area: Backend
- Prioritas: P0
- Tipe: Feature
- Owner: BE
- Deskripsi:
  - Tambah doGet page test-session-detail.
- Definition of Done:
  - Detail sesi, pertanyaan, dan summary dasar tersedia.

### PTT-005 - Endpoint create/update sesi
- Area: Backend
- Prioritas: P0
- Tipe: Feature
- Owner: BE
- Deskripsi:
  - Tambah doPost action create-test-session dan update-test-session.
- Definition of Done:
  - Session tersimpan dan dapat diubah.

### PTT-006 - Validasi email domain resmi staff
- Area: Backend
- Prioritas: P0
- Tipe: Feature
- Owner: BE
- Deskripsi:
  - Batasi endpoint manajemen sesi/soal hanya domain resmi.
- Definition of Done:
  - Non-domain ditolak dengan error message jelas.

### PTT-007 - Endpoint create pertanyaan pre/post
- Area: Backend
- Prioritas: P0
- Tipe: Feature
- Owner: BE
- Deskripsi:
  - Tambah doPost action create-test-question.
- Definition of Done:
  - Pertanyaan tersimpan dengan phase, order, maxScore.

### PTT-008 - Halaman form peserta pre/post
- Area: Frontend Form
- Prioritas: P0
- Tipe: Feature
- Owner: FE-F
- Deskripsi:
  - Buat prepost-test.html + script + css.
  - Baca sessionId dan phase dari query param.
- Definition of Done:
  - Peserta bisa melihat pertanyaan sesi valid.

### PTT-009 - Endpoint submit response peserta
- Area: Backend
- Prioritas: P0
- Tipe: Feature
- Owner: BE
- Deskripsi:
  - Tambah doPost action submit-test-response.
- Definition of Done:
  - Response tersimpan dan tervalidasi phase/session.

### PTT-010 - Hitung skor dan summary evidence
- Area: Backend
- Prioritas: P0
- Tipe: Feature
- Owner: BE
- Deskripsi:
  - Hitung pre/post respondents, avg, gain, completion.
- Definition of Done:
  - Endpoint summary mengembalikan nilai akurat dari data sheet.

### PTT-011 - Endpoint live summary dashboard
- Area: Backend
- Prioritas: P0
- Tipe: Feature
- Owner: BE
- Deskripsi:
  - Tambah doGet page test-live-summary.
- Definition of Done:
  - Ringkasan per sesi dan agregat tersedia.

### PTT-012 - QR link generator per sesi
- Area: Backend
- Prioritas: P1
- Tipe: Feature
- Owner: BE
- Deskripsi:
  - Generate URL QR untuk pre dan post.
- Definition of Done:
  - preQrUrl dan postQrUrl tersimpan di sesi.

### PTT-013 - UI modul Evaluasi Pre/Post di dashboard capacity
- Area: Frontend Dashboard
- Prioritas: P0
- Tipe: Feature
- Owner: FE-D
- Deskripsi:
  - Tambah section baru untuk card sesi live.
- Definition of Done:
  - Tampil pre/post counts, avg, gain per sesi.

### PTT-014 - Aksi kartu sesi: copy link dan QR
- Area: Frontend Dashboard
- Prioritas: P1
- Tipe: Feature
- Owner: FE-D
- Deskripsi:
  - Tombol copy link pre/post dan tampilkan QR.
- Definition of Done:
  - Aksi bisa dipakai operator non-teknis.

### PTT-015 - Integrasi sessionId ke form laporan capacity
- Area: Frontend Form
- Prioritas: P0
- Tipe: Feature
- Owner: FE-F
- Deskripsi:
  - Tambah selector sessionId pada mode Capacity Building.
- Definition of Done:
  - Session bisa dipilih sebelum submit laporan.

### PTT-016 - Persist evidence summary ke laporan capacity
- Area: Backend
- Prioritas: P0
- Tipe: Feature
- Owner: BE
- Deskripsi:
  - Saat submit capacity report, simpan support* fields.
- Definition of Done:
  - Evidence ikut tersimpan dan bisa dibaca ulang.

### PTT-017 - QA skenario end-to-end
- Area: QA
- Prioritas: P0
- Tipe: Feature
- Owner: QA
- Deskripsi:
  - Uji skenario staff, peserta, dashboard live, dan report integration.
- Definition of Done:
  - Semua skenario P0 lulus.

### PTT-018 - Hardening input invalid dan error message
- Area: Backend
- Prioritas: P1
- Tipe: Tech Debt
- Owner: BE
- Deskripsi:
  - Rapikan validasi dan pesan error human-friendly.
- Definition of Done:
  - Error utama tertangani konsisten.

### PTT-019 - UAT internal + sign-off pilot
- Area: Product
- Prioritas: P0
- Tipe: Feature
- Owner: PO + QA
- Deskripsi:
  - Demo ke user internal dan catat feedback.
- Definition of Done:
  - Ada keputusan go/no-go pilot.

## To Do (Saran Isi Awal)
Pindahkan kartu ini dulu ke To Do:
- PTT-001
- PTT-002
- PTT-003
- PTT-005
- PTT-006

## In Progress (Saran Hari 1)
Pilih maksimal 2-3 task sekaligus:
- PTT-001 (Product)
- PTT-002 (BE)
- PTT-017 (QA menyiapkan test matrix)

## Done (Contoh Format)
Saat task selesai, update format berikut:
- ID: PTT-xxx
- Tanggal selesai: YYYY-MM-DD
- Owner: nama
- Catatan: link PR/commit dan catatan uji

## Estimasi Cepat (Opsional)
- P0 backend endpoint: 1.5-2.5 hari
- Frontend form peserta: 1-1.5 hari
- Dashboard live: 1-1.5 hari
- Integrasi report: 1 hari
- QA + hardening: 1-1.5 hari
