# Workflow Update Cepat ke GitHub

Tujuan: setiap selesai edit, perubahan langsung naik ke GitHub agar tim melihat update terbaru.

## Cara Pakai (Disarankan)

Jalankan perintah ini dari folder repo:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\publish-changes.ps1 -Online -Message "deskripsi perubahan"
```

Contoh:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\publish-changes.ps1 -Online -Message "fix: perbaiki label monitoring"
```

Jika `-Message` tidak diisi, script otomatis membuat pesan commit timestamp.
Tanpa flag `-Online`, script akan batal dan tidak melakukan commit/push.

Sebelum commit/push, script akan cek otomatis:
- Anda berada di branch target (default `main`)
- Branch lokal tidak tertinggal dari `origin/main`
- Tidak ada conflict marker (`<<<<<<<`, `=======`, `>>>>>>>`)
- Tidak ada file sensitif pada perubahan (contoh `.env`, `.pem`, `.key`, `id_rsa`)

## Kapan Dijalankan

- Setiap selesai 1 perubahan kecil
- Sebelum istirahat
- Sebelum pindah task

## Cek Cepat Kondisi Repo

```powershell
git status -sb
git log --oneline -n 5
```

## Catatan Tim

- Hindari edit langsung di server produksi.
- Kerja harian dilakukan di repo kerja ini, lalu push rutin.
- Server sudah punya auto-sync dari GitHub, jadi update akan ikut turun otomatis.