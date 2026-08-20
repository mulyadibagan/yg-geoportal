# Operasi stack YG GeoPortal

## Peran komponen

- Google Drive menyimpan dokumen, foto, dan file sumber operasional.
- Google Sheets menjadi basis data terstruktur yang dibaca Apps Script.
- Apps Script menangani baca/tulis operasional dan autentikasi editor.
- GitHub menyimpan source, snapshot publik, riwayat perubahan, dan otomatisasi.
- Cloudflare R2 menyimpan snapshot immutable/current; Worker menyajikan data dengan fallback.

## Alur otomatis

1. `Update Master Database snapshot` membaca endpoint publik Apps Script setiap jam.
2. Snapshot tervalidasi disimpan ke GitHub pada `main`.
3. Perubahan snapshot memicu `Publish Cloudflare staging snapshots`.
4. Workflow memvalidasi schema/jumlah fitur, menjalankan unit test, mengunggah versi immutable dan `current`, lalu mengunggah manifest terakhir.
5. Smoke test membandingkan hash dan ukuran respons R2 dengan manifest.
6. `Monitor public data stack` memeriksa Apps Script, Spreadsheet/Drive, GitHub Pages, dan Cloudflare setiap tiga jam.

## Secret Apps Script

Token admin wajib disimpan sebagai Script Property `YG_ADMIN_TOKEN`. Jangan menaruh nilainya di source, GitHub Actions, HTML, dokumentasi, atau Drive.

Rotasi aman:

1. Buat token acak baru minimal 32 byte.
2. Simpan sebagai Script Property `YG_ADMIN_TOKEN` di project Apps Script.
3. Deploy versi Apps Script baru.
4. Uji endpoint publik dan login admin.
5. Hapus semua bookmark/riwayat yang masih memuat token lama.

## Rollback Cloudflare staging

Jalankan workflow `Roll back Cloudflare staging snapshots`, lalu masukkan SHA commit penuh yang pernah berhasil dipublikasikan. Workflow mengambil snapshot dan manifest immutable, memverifikasi SHA-256, mengganti alias `current`, lalu menjalankan smoke test.

Rollback tidak mengubah Google Drive, Spreadsheet, Apps Script, GitHub snapshot, DNS, atau resource produksi.
