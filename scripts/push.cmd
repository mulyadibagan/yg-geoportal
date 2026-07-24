@echo off
setlocal

REM Skrip ini menyederhanakan proses push ke GitHub dengan memanggil publish-changes.ps1
REM secara otomatis dengan flag -Online dan meminta pesan commit.

REM Dapatkan direktori dari skrip ini
set "SCRIPT_DIR=%~dp0"

REM Minta pesan commit dari pengguna
set /p "COMMIT_MESSAGE=[PUBLISH] Masukkan deskripsi perubahan (atau tekan Enter untuk default): "

REM Tanya apakah sekalian deploy Apps Script
set /p "DO_DEPLOY=[PUBLISH] Deploy Apps Script setelah push? (y/N): "

REM Bangun perintah PowerShell yang akan dijalankan
set "COMMAND=powershell -ExecutionPolicy Bypass -File ""%SCRIPT_DIR%publish-changes.ps1"" -Online"

REM Tambahkan pesan commit jika diisi oleh pengguna
if defined COMMIT_MESSAGE (
    set "COMMAND=%COMMAND% -Message ""%COMMIT_MESSAGE%"""
)

if /I "%DO_DEPLOY%"=="y" (
    set "COMMAND=%COMMAND% -DeployAppsScript"
)

echo [AUTO-PUSH] Menjalankan perintah publish...
call %COMMAND%

echo [AUTO-PUSH] Selesai.
endlocal