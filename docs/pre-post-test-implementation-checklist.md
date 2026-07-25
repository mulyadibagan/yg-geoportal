# Checklist Implementasi MVP Pre/Post Test

## Tujuan Sprint MVP
Menyediakan alur end-to-end:
1. Staff domain resmi membuat sesi pre/post test.
2. Sistem menghasilkan link dan QR.
3. Peserta mengisi test.
4. Dashboard Capacity Building tampil live.
5. Ringkasan test menjadi evidence pendukung saat submit laporan Capacity Building.

## Ruang Lingkup
Termasuk:
- Session management sederhana.
- Pertanyaan pre/post per sesi.
- Submit response peserta.
- Live metrics di dashboard capacity.
- Integrasi evidence ke payload laporan capacity.

Tidak termasuk di MVP:
- Auth penuh berbasis akun/password.
- Visualisasi trend kompleks lintas tahun.
- Export multi-format lanjutan.

## Keputusan Konfigurasi yang Harus Diputuskan di Hari 1
1. Domain resmi yang diizinkan (contoh: @yayasangambut.org).
2. Metode verifikasi email staff (OTP atau magic link).
3. Identitas peserta: wajib nama atau cukup participant code.
4. Ambang evidence lengkap (contoh post response >= 70% target).

## Task Breakdown per Area

### A. Backend API dan Penyimpanan
File target utama:
- apps-script/webgis-backend/Kode.js

Checklist:
- [ ] Tambah endpoint doGet page test-sessions untuk baca daftar sesi.
- [ ] Tambah endpoint doGet page test-session-detail untuk detail sesi + metrik.
- [ ] Tambah endpoint doPost action create-test-session.
- [ ] Tambah endpoint doPost action update-test-session.
- [ ] Tambah endpoint doPost action create-test-question.
- [ ] Tambah endpoint doPost action submit-test-response.
- [ ] Tambah endpoint doGet page test-live-summary untuk agregat live.
- [ ] Tambah validasi email domain resmi pada endpoint manajemen sesi/soal.
- [ ] Tambah helper hitung evidence summary per sesi.
- [ ] Tambah helper generate QR URL dari preFormUrl dan postFormUrl.

Catatan teknis:
- Pisahkan jalur public participant submit dari jalur staff management.
- Jaga kompatibilitas endpoint existing public-reports.

### B. Struktur Data (Google Sheet / Storage)
Sheet baru yang disarankan:
- TEST_SESSIONS
- TEST_QUESTIONS
- TEST_RESPONSES
- TEST_STAFF_TOKENS (jika OTP/magic link)

Checklist:
- [ ] Definisikan kolom TEST_SESSIONS.
- [ ] Definisikan kolom TEST_QUESTIONS.
- [ ] Definisikan kolom TEST_RESPONSES.
- [ ] Definisikan indeks logis via sessionId dan phase.
- [ ] Tambah util createSheetIfNotExists.
- [ ] Tambah util read/write aman dengan fallback kolom kosong.

Minimum kolom TEST_SESSIONS:
- sessionId, title, activityDate, location, village, facilitator, donor,
- preFormUrl, postFormUrl, preQrUrl, postQrUrl,
- targetParticipants, status, createdByEmail, createdAt, updatedAt.

Minimum kolom TEST_RESPONSES:
- responseId, sessionId, phase, participantCode, answersJson,
- totalScore, submittedAt, sourceChannel.

### C. Frontend Capacity Dashboard
File target utama:
- js/capacity-building.js
- .tablet-preview/js/capacity-building.js
- capacity-building.html atau section terkait di halaman dashboard
- css/capacity-building.css

Checklist:
- [ ] Tambah section Evaluasi Pre/Post Test di UI.
- [ ] Render kartu sesi dengan metrik live (pre, post, avg, gain).
- [ ] Tambah tombol Salin Link dan Unduh QR per sesi.
- [ ] Tambah mode detail sesi (pertanyaan + distribusi).
- [ ] Tambah fallback empty state jika belum ada sesi.
- [ ] Tambah polling ringan atau refresh manual untuk data live.

Catatan UI:
- Pastikan tetap ringan di mobile.
- Hindari mengubah layout utama yang sudah stabil.

### D. Frontend Form Peserta Pre/Post
File baru yang disarankan:
- prepost-test.html
- js/prepost-test.js
- css/prepost-test.css

Checklist:
- [ ] Halaman form menerima sessionId dan phase dari query param.
- [ ] Validasi sesi aktif sebelum menampilkan pertanyaan.
- [ ] Render pertanyaan dinamis dari endpoint sesi.
- [ ] Hitung skor total di sisi klien secara transparan.
- [ ] Submit ke endpoint submit-test-response.
- [ ] Tampilkan status sukses/gagal jelas.

### E. Integrasi ke Form Laporan Capacity
File target utama:
- js/report-v6.js
- apps-script/webgis-backend/Kode.js

Checklist:
- [ ] Tambah field pilihan sessionId pada mode Capacity Building.
- [ ] Saat sessionId dipilih, fetch evidence summary terbaru.
- [ ] Injeksi evidence summary ke payload laporan.
- [ ] Simpan evidence fields di backend bersama laporan capacity.
- [ ] Tampilkan penanda Evidence Lengkap atau Belum Lengkap.

Minimum field evidence di payload:
- supportSessionId
- supportPreRespondents
- supportPostRespondents
- supportPreAvg
- supportPostAvg
- supportGain
- supportGainPercent
- supportEvidenceStatus

### F. Home Summary (Opsional akhir MVP)
File target:
- js/dashboard-v3.js
- index.html

Checklist:
- [ ] Tambah 1-2 metrik agregat test jika diminta.
- [ ] Pastikan tidak membebani render awal home.
- [ ] Gunakan data agregat, bukan detail per peserta.

## Urutan Eksekusi Disarankan
1. Backend endpoint + struktur sheet.
2. Form peserta pre/post + submit response.
3. Modul live di capacity dashboard.
4. Integrasi evidence ke report-v6.
5. QA end-to-end dan hardening validasi.
6. Optional: agregat home.

## QA Checklist End-to-End
### Skenario 1: Staff buat sesi
- [ ] Email non-domain resmi ditolak.
- [ ] Email domain resmi lolos.
- [ ] SessionId terbentuk unik.
- [ ] Link pre/post dan QR tersedia.

### Skenario 2: Peserta isi pre-test
- [ ] Halaman sesi valid terbuka.
- [ ] Submit sukses tersimpan.
- [ ] Duplikasi submit sesuai kebijakan (ditolak/diupdate) berjalan benar.

### Skenario 3: Dashboard live update
- [ ] Counter pre bertambah.
- [ ] Rata-rata score terhitung benar.
- [ ] Gain tidak error saat post belum ada.

### Skenario 4: Tim isi laporan capacity
- [ ] SessionId bisa dipilih.
- [ ] Evidence summary otomatis terisi.
- [ ] Laporan tetap bisa submit saat evidence belum lengkap.

### Skenario 5: Publikasi
- [ ] Jalur live internal tidak mengganggu endpoint publik existing.
- [ ] Data publik tetap tunduk status publish yang berlaku.

## Definisi Done MVP
MVP selesai jika semua terpenuhi:
- [ ] Staff domain resmi dapat membuat sesi tanpa login tradisional.
- [ ] Peserta dapat mengisi pre/post via link/QR.
- [ ] Dashboard capacity menampilkan metrik live per sesi.
- [ ] Form laporan capacity dapat menautkan sessionId.
- [ ] Evidence test otomatis tersimpan sebagai data pendukung laporan.
- [ ] Tidak ada regresi pada alur laporan existing.

## Pembagian Tugas Tim (Saran)
1. Backend engineer:
- Endpoint, validasi domain, kalkulasi evidence.

2. Frontend dashboard engineer:
- UI live sesi + detail metrik + QR action.

3. Frontend form engineer:
- Halaman pengisian test peserta.

4. QA/operator:
- Uji skenario end-to-end + verifikasi data sheet.
