# Windows Auto Sync Setup

Dokumen ini membuat server Windows otomatis sinkron setiap ada push ke `main` di GitHub.

## Ringkasan Arsitektur

- GitHub Actions trigger saat ada push ke `main`.
- Job jalan di **self-hosted runner** yang terpasang di server Windows.
- Runner mengeksekusi `scripts/sync-repo.ps1` untuk `fetch` lalu `pull --ff-only`.

## 1) Siapkan Self-Hosted Runner di Server Windows

1. Buka repository GitHub ini.
2. Masuk ke `Settings > Actions > Runners > New self-hosted runner`.
3. Pilih `Windows` lalu ikuti perintah install di server.
4. Jalankan runner sebagai service agar otomatis aktif saat boot.

Catatan:
- Akun service runner harus punya akses ke folder repo di server.
- Pastikan `git` tersedia di PATH akun runner.

## 2) Isi Variable Repo untuk Path Deploy

1. Buka `Settings > Secrets and variables > Actions > Variables`.
2. Tambahkan variable:
   - Name: `DEPLOY_PATH`
   - Value: path repo di server, contoh `C:\\sites\\yg-geoportal`

## 3) Pastikan Working Copy di Server Sudah Clone Repo

Contoh satu kali setup:

```powershell
git clone https://github.com/mulyadibagan/yg-geoportal C:\sites\yg-geoportal
```

## 4) Uji Manual

1. Buka tab `Actions`.
2. Jalankan workflow `Windows Auto Sync` via `Run workflow`.
3. Pastikan log menampilkan:
   - Ahead: 0
   - pull fast-forward berhasil, atau "Sudah sinkron"

## 5) Operasional Harian

- Setiap push ke `main` akan otomatis sinkron.
- Jika workflow gagal karena `ahead > 0`, berarti ada commit lokal langsung di server.
  Solusi: hindari commit langsung di server, semua perubahan lewat GitHub/PR.

## Troubleshooting Cepat

- `DEPLOY_PATH belum diisi`: isi repository variable `DEPLOY_PATH`.
- `git not found`: install Git dan pastikan PATH terlihat oleh service runner.
- `ahead > 0`: branch server divergen, rapikan branch server dulu sebelum auto-sync lanjut.