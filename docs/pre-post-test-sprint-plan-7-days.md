# Sprint Plan 7 Hari - MVP Pre/Post Test

## Tujuan Sprint
Dalam 7 hari kerja, tim menghasilkan MVP yang memungkinkan:
1. Staff domain resmi membuat sesi pre/post test.
2. Link dan QR siap dibagikan ke peserta.
3. Respon peserta masuk dan terbaca live di dashboard Capacity Building.
4. Evidence pre/post test otomatis tertaut ke laporan Capacity Building.

## Prinsip Eksekusi
- Jalankan backend dulu, lalu frontend peserta, lalu dashboard live, lalu integrasi report.
- Setiap akhir hari harus ada demo kecil yang bisa diuji tim non-dev.
- Hindari refactor besar di modul existing selama MVP.

## Komposisi Tim (Contoh)
1. Backend Engineer (BE)
2. Frontend Dashboard Engineer (FE-D)
3. Frontend Form Engineer (FE-F)
4. QA/Operator

## Day 1 - Alignment dan Fondasi Data
Target harian:
- Konfirmasi keputusan produk yang belum final.
- Menyiapkan struktur storage untuk sesi/soal/respon.

Task:
1. PO + semua tim:
- Final domain resmi email staff.
- Final metode verifikasi: OTP atau magic link.
- Final aturan participant identity.

2. BE:
- Siapkan sheet: TEST_SESSIONS, TEST_QUESTIONS, TEST_RESPONSES, TEST_STAFF_TOKENS.
- Tambah helper create/get sheet di backend.

3. QA:
- Siapkan test matrix awal dari checklist.

Deliverable Day 1:
- Struktur data tersedia dan tervalidasi.
- Keputusan konfigurasi utama terdokumentasi.

## Day 2 - Backend API Core
Target harian:
- Endpoint manajemen sesi dan pertanyaan tersedia.

Task:
1. BE:
- Tambah doGet page test-sessions.
- Tambah doGet page test-session-detail.
- Tambah doPost action create-test-session.
- Tambah doPost action update-test-session.
- Tambah doPost action create-test-question.
- Tambah validasi email domain untuk action staff.

2. QA:
- Uji API via sample payload valid/invalid.

Deliverable Day 2:
- Session dan question dapat dibuat dan dibaca via API.

## Day 3 - Form Peserta Pre/Post
Target harian:
- Peserta bisa isi pre/post test dari link.

Task:
1. FE-F:
- Buat halaman prepost-test.html + js/prepost-test.js + css/prepost-test.css.
- Render pertanyaan dinamis berdasarkan sessionId dan phase.
- Submit response ke endpoint baru.

2. BE:
- Tambah doPost action submit-test-response.
- Tambah validasi session aktif + phase.

3. QA:
- Uji skenario submit sukses, session invalid, phase invalid.

Deliverable Day 3:
- Link pre/post test berfungsi end-to-end.

## Day 4 - QR dan Live Summary API
Target harian:
- QR siap dibagikan, ringkasan live bisa dihitung backend.

Task:
1. BE:
- Tambah helper generate pre/post QR URL.
- Tambah doGet page test-live-summary.
- Tambah kalkulasi preRespondents, postRespondents, preAvg, postAvg, gain.

2. FE-F:
- Tambah tampilan sukses submit yang jelas.

3. QA:
- Verifikasi perhitungan gain dengan data dummy.

Deliverable Day 4:
- Data live summary tersedia dan tervalidasi.

## Day 5 - Integrasi Dashboard Capacity Building
Target harian:
- Modul live pre/post test muncul di dashboard capacity.

Task:
1. FE-D:
- Tambah section Evaluasi Pre/Post Test di halaman capacity.
- Render card per sesi: pre count, post count, avg pre, avg post, gain.
- Tambah action: copy link, lihat QR, detail sesi.

2. BE:
- Pastikan response API optimal untuk render list.

3. QA:
- Uji tampilan desktop/mobile.

Deliverable Day 5:
- Dashboard capacity menampilkan data live yang terbaca operator.

## Day 6 - Integrasi ke Form Laporan Capacity
Target harian:
- Evidence test otomatis tertaut ke laporan capacity.

Task:
1. FE-D / FE-F (sesuai pembagian):
- Tambah selector sessionId di mode Capacity Building pada report form.
- Tampilkan ringkasan evidence saat sesi dipilih.

2. BE:
- Tarik evidence summary saat submit laporan.
- Simpan fields supportSessionId, supportPreRespondents, supportPostRespondents, supportGain, supportEvidenceStatus.

3. QA:
- Uji submit laporan dengan evidence lengkap dan belum lengkap.

Deliverable Day 6:
- Laporan capacity membawa data pendukung pre/post test.

## Day 7 - Hardening, UAT, dan Go/No-Go
Target harian:
- Menutup bug kritis dan siap pilot terbatas.

Task:
1. Semua engineer:
- Perbaiki bug hasil QA.
- Tambah guardrail input invalid.

2. QA + Operator:
- Jalankan seluruh skenario end-to-end.
- UAT bersama user internal.

3. PO:
- Putuskan go-live pilot atau extend sprint.

Deliverable Day 7:
- MVP stabil untuk pilot internal.
- Daftar backlog fase 2.

## Daily Standup Format (Disarankan)
Setiap anggota menjawab:
1. Kemarin selesai apa.
2. Hari ini kerjakan apa.
3. Blokernya apa.

Durasi:
- 15 menit maksimal.

## Checkpoint Keputusan (Wajib)
1. Checkpoint A (akhir Day 1):
- Domain resmi dan metode verifikasi email final.

2. Checkpoint B (akhir Day 3):
- Kebijakan duplikasi submit peserta final.

3. Checkpoint C (akhir Day 6):
- Aturan evidenceStatus lengkap/belum lengkap final.

## Risiko Sprint dan Mitigasi Cepat
1. Risiko validasi email lemah.
- Mitigasi: wajib token OTP/magic link, bukan sekadar input email text.

2. Risiko backend lambat saat summary live.
- Mitigasi: cache singkat 30-60 detik untuk agregat.

3. Risiko UI membingungkan operator.
- Mitigasi: batasi MVP ke metrik inti, hindari chart kompleks dulu.

4. Risiko regresi modul existing.
- Mitigasi: isolate endpoint baru, jangan ubah alur public-reports yang stabil.

## Definisi Sukses Sprint
Sprint dinyatakan sukses jika:
1. Staff domain resmi dapat membuat sesi dan pertanyaan.
2. Peserta dapat isi pre/post test via link/QR.
3. Dashboard capacity update live dan akurat.
4. Laporan capacity memuat evidence summary otomatis.
5. Tidak ada bug kritis pada alur pelaporan existing.
