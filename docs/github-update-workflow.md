# GitHub + Apps Script Auto Deploy Workflow

## Tujuan

Satu alur untuk:
1. Commit dan push perubahan ke GitHub.
2. Sekalian deploy Apps Script (push source, create version, update deployment yang sama).

## Prasyarat (sekali saja)

1. Git sudah terpasang.
2. Node.js + `clasp` terpasang.
3. Sudah login `clasp` pada project Apps Script.

Perintah cek:

```powershell
clasp --version
clasp deployments
```

## Opsi 1: Interaktif (disarankan)

Jalankan:

```bat
scripts\push.cmd
```

Lalu isi:
1. Pesan commit.
2. Pilih `y` saat ditanya deploy Apps Script.

## Opsi 2: Non-interaktif (CI lokal/manual)

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\publish-changes.ps1 -Online -Message "deskripsi perubahan" -DeployAppsScript
```

## Deploy Apps Script saja

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\deploy-apps-script.ps1
```

## Override Deployment ID (opsional)

Jika ingin update deployment tertentu:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\deploy-apps-script.ps1 -DeploymentId "AKfy..."
```

Atau set environment variable:

```powershell
$env:APPS_SCRIPT_DEPLOYMENT_ID = "AKfy..."
```

## Catatan penting

1. Script deploy default mengarah ke project `apps-script/webgis-backend`.
2. Script deploy mencoba update deployment yang sama (URL Web App tetap).
3. Jika login `clasp` belum ada, deploy akan gagal sampai autentikasi dilakukan.

