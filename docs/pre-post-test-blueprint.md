# Blueprint Pre/Post Test untuk Capacity Building

## Tujuan
Menyediakan sistem pre-test dan post-test yang:
- Tampil live di dashboard Capacity Building.
- Menjadi data pendukung otomatis saat tim mengisi laporan Capacity Building.
- Memungkinkan staff Yayasan Gambut membuat sesi dan pertanyaan tanpa akun aplikasi terpisah.
- Membatasi akses pengelolaan hanya untuk email resmi domain Yayasan Gambut.

## Posisi Fitur di Produk
Lokasi utama:
- Halaman Capacity Building menampilkan modul baru Evaluasi Pre/Post Test.

Urutan tampilan yang disarankan:
1. Ringkasan KPI test (jumlah responden pre, jumlah responden post, completion rate, rata-rata nilai, gain).
2. Daftar sesi pelatihan (per session).
3. Tombol aksi per sesi (Lihat detail, Salin link, Unduh QR, Tautkan ke laporan Capacity Building).
4. Detail sesi (pertanyaan, distribusi jawaban, log pengisian).

Lokasi sekunder:
- Home hanya menerima agregat ringkas setelah stabil (misal total sesi dengan post-test, total responden, rata-rata gain).

## Peran Pengguna
1. Staff Yayasan Gambut
- Membuat sesi pelatihan.
- Menyusun pertanyaan pre/post test.
- Membagikan link dan QR.
- Memantau progres live.

2. Peserta Pelatihan
- Mengisi pre/post test lewat link atau QR.
- Tidak perlu login.

3. Tim Pelaporan Capacity Building
- Saat isi laporan, memilih session ID.
- Ringkasan test otomatis masuk sebagai evidence pendukung.

## Aturan Akses Tanpa Login Aplikasi
Kebutuhan pengguna:
- Staff tidak perlu login akun aplikasi.
- Hanya email official Yayasan Gambut yang dapat mengelola sesi/pertanyaan.

Desain akses yang direkomendasikan:
1. Email gate saat membuka halaman kelola sesi.
- Staff isi email kerja.
- Sistem kirim OTP atau magic link ke email tersebut.
- Setelah verifikasi, sesi akses aktif sementara (contoh 8 jam).

2. Validasi domain resmi di backend.
- Contoh domain yang diizinkan: @yayasangambut.org.
- Domain non-resmi ditolak.

3. Aksi peserta tetap terbuka.
- Form pengisian pre/post test publik via link/QR.
- Endpoint submit peserta tidak memberi akses untuk ubah pertanyaan.

Catatan:
- Ini tetap tanpa login tradisional username/password.
- Lebih aman dibanding hanya mengetik email tanpa verifikasi.

## Alur End-to-End
1. Staff membuat Session.
2. Staff menyusun pertanyaan pre-test dan post-test.
3. Sistem menghasilkan URL pre-test dan post-test + QR.
4. Peserta mengisi formulir.
5. Dashboard Capacity Building update live.
6. Tim pelaporan membuat laporan Capacity Building dan memilih Session.
7. Evidence pre/post test ditarik otomatis ke laporan.
8. Data publik mengikuti aturan publish yang berlaku.

## Data Model Inti
### Entitas Session
- sessionId
- title
- date
- location
- village
- facilitator
- donor
- status (draft, active, closed)
- preFormUrl
- postFormUrl
- preQrUrl
- postQrUrl
- createdByEmail
- createdAt

### Entitas Question
- questionId
- sessionId
- phase (pre, post)
- questionText
- questionType (single, multi, scale, text)
- options (jika pilihan)
- maxScore
- order
- active

### Entitas Response
- responseId
- sessionId
- phase (pre, post)
- participantCode
- participantName optional
- participantEmail optional
- answers JSON
- totalScore
- submittedAt

### Entitas Evidence Summary
- sessionId
- preRespondents
- postRespondents
- completionRate
- preAvgScore
- postAvgScore
- gainScore
- gainPercent
- lastUpdatedAt

## Metrik Live di Dashboard
Minimum metrik live per sesi:
- Jumlah pengisi pre-test.
- Jumlah pengisi post-test.
- Jumlah peserta unik.
- Completion rate post terhadap target peserta.
- Rata-rata skor pre.
- Rata-rata skor post.
- Gain absolut dan gain persen.

Metrik agregat lintas sesi:
- Total sesi aktif.
- Total responden bulan berjalan.
- Median gain skor per sesi.

## Integrasi ke Laporan Capacity Building
Saat submit laporan Capacity Building:
1. Form menampilkan pilihan sessionId.
2. Jika sessionId dipilih, backend mengambil Evidence Summary terbaru.
3. Evidence Summary disimpan ke payload laporan sebagai data pendukung.
4. Laporan tetap bisa disimpan meski evidence belum lengkap, tetapi diberi flag Belum Lengkap.

Field tambahan pada payload laporan:
- supportSessionId
- supportPreRespondents
- supportPostRespondents
- supportPreAvg
- supportPostAvg
- supportGain
- supportGainPercent
- supportEvidenceStatus

## Integrasi dengan Struktur Project Saat Ini
Komponen yang dapat diperluas:
- Form laporan capacity: js/report-v6.js
- Ringkasan dashboard lintas kegiatan: js/dashboard-v3.js
- Dashboard capacity khusus: js/capacity-building.js
- Endpoint backend Apps Script: apps-script/webgis-backend/Kode.js

Prinsip implementasi:
- Tidak mengganggu alur laporan existing.
- Menambah endpoint khusus test management dan test response.
- Menjaga endpoint public reports untuk konsumsi dashboard publik.

## Rencana Implementasi Bertahap
### Tahap 1 (MVP)
- Session management sederhana.
- Pertanyaan pre/post per sesi.
- Link + QR generator.
- Live counter responden.
- Ringkasan evidence ditautkan ke laporan capacity.

### Tahap 2
- Grafik tren skor pre vs post.
- Segmentasi per desa, topik, fasilitator.
- Export CSV/XLSX evidence.
- Notifikasi otomatis jika post-test response rate rendah.

### Tahap 3
- Integrasi agregat ke home.
- Data quality rule lanjutan.
- Audit trail perubahan pertanyaan.

## Risiko dan Mitigasi
1. Risiko akses palsu dengan email ketik manual.
- Mitigasi: wajib OTP atau magic link.

2. Risiko duplikasi respon peserta.
- Mitigasi: participantCode unik + limit satu submit per fase per sesi.

3. Risiko mismatch sesi dan laporan capacity.
- Mitigasi: sessionId wajib dipilih dari daftar valid, bukan input bebas.

4. Risiko data live belum layak publik.
- Mitigasi: pisahkan dashboard internal live dan dashboard publik terverifikasi.

## Keputusan Kunci yang Perlu Disepakati
1. Domain resmi email yang diizinkan.
2. Metode verifikasi email: OTP atau magic link.
3. Apakah peserta wajib isi identitas atau cukup participant code.
4. Aturan edit jawaban setelah submit.
5. Ambang minimal response rate agar evidence dianggap lengkap.

## Definisi Selesai untuk MVP
MVP dianggap selesai jika:
- Staff domain resmi dapat membuat sesi tanpa akun aplikasi tradisional.
- Link dan QR pre/post tersedia per sesi.
- Respon pre/post masuk dan terlihat live.
- Evidence summary otomatis muncul saat laporan Capacity Building dibuat.
- Data dapat dipakai sebagai pendukung laporan tanpa merusak alur existing.
