# Workflow Update Cepat ke GitHub

Tujuan: setiap selesai edit, perubahan langsung naik ke GitHub agar tim melihat update terbaru.

## Cara Pakai (Disarankan)

Jalankan perintah ini dari folder repo:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\publish-changes.ps1 -Message "deskripsi perubahan"
```

Contoh:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\publish-changes.ps1 -Message "fix: perbaiki label monitoring"
```

Jika `-Message` tidak diisi, script otomatis membuat pesan commit timestamp.

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