# Kredensial baca minimum untuk citra Dayun

## Jalur yang disiapkan sekarang: federasi tanpa key

Pembuatan JSON key ditolak oleh kebijakan organisasi `iam.disableServiceAccountKeyCreation`. Jangan menonaktifkan kebijakan itu atau mengulang pembuatan key. Service account `webgisyg-dayun-reader` sudah dibuat; izin Pelihat pada ABC/DEF diberikan melalui pemilik akun.

Skrip admin [configure_dayun_workload_identity.sh](../scripts/configure_dayun_workload_identity.sh) menyiapkan federasi GitHub → Google → service account pembaca di proyek yang sudah ada. **Belum dijalankan.** Tinjau dan setujui sekali sebelum diterapkan: trust hanya repository ID `1297989887` milik owner ID `48111628`, branch `main`, workflow `inspect-dayun-geotiff.yml`, environment `yg-webgis-staging`. Role `roles/iam.workloadIdentityUser` hanya pada service account tersebut, bukan role proyek untuk mesin dan bukan domain-wide delegation. Ini menambahkan akses mesin yang memerlukan persetujuan pemilik/admin.

Setelah admin menerapkannya, simpan nama provider yang dicetak sebagai environment **variable** `DAYUN_GOOGLE_WIF_PROVIDER` pada GitHub `yg-webgis-staging`. Google auth action menghasilkan credential sementara; downloader memakai ADC dengan scope `drive.readonly`. Tidak ada JSON key yang perlu diunduh atau ditempel. Token, refresh unduhan panjang dan izin runner tetap harus diuji pada citra asli sebelum dinyatakan operasional.

Rujukan: [federasi pipeline Google](https://docs.cloud.google.com/iam/docs/workload-identity-federation-with-deployment-pipelines), [Google GitHub auth](https://github.com/google-github-actions/auth), [claim OIDC GitHub](https://docs.github.com/en/actions/reference/security/oidc).

Instruksi JSON berikut adalah alternatif lama untuk organisasi yang mengizinkannya, bukan langkah yang perlu dilanjutkan di organisasi ini.

Mesin yang dipakai tetap downloader dan modul orthomosaic WebGISYG. Secret yang dibaca: `DRIVE_CREDENTIALS_JSON` pada environment GitHub `yg-webgis-staging`.

## Pilih identitas yang sudah tersedia dahulu

- Jika sudah ada service account khusus pembaca Dayun, gunakan identitas dan JSON yang sudah dimiliki pemilik akun. Jangan membuat key tambahan hanya untuk mengunduh ulang key lama: private key lama memang tidak dapat diunduh kembali.
- Jika sudah ada JSON `authorized_user` dengan refresh token dan izin `drive.readonly`, mesin mendukungnya. OAuth client JSON dengan bagian `installed`/`web` saja bukan kredensial pengguna yang siap dipakai; JSON itu belum memiliki refresh token.
- Jika belum ada identitas, service account khusus dengan akses hanya ke **kedua berkas** membatasi akses efektif lebih sempit daripada `authorized_user` milik akun yang membaca seluruh Drive organisasi.

## Langkah pemilik akun: service account khusus

1. Buka https://console.cloud.google.com/apis/credentials dan selesaikan verifikasi akun Google sendiri. Pilih proyek Google yang sudah dipakai organisasi. Bila belum memiliki akses proyek, minta administrator proyek membantu; tidak diperlukan akses admin seluruh Workspace.
2. Di **APIs & Services → Library**, pastikan **Google Drive API** aktif untuk proyek tersebut.
3. Buka **IAM & Admin → Service Accounts**. Gunakan akun pembaca yang sudah ada bila sesuai. Jika belum ada, buat `webgisyg-dayun-reader`. Kosongkan langkah pemberian role akses proyek dan pemberian akses pengguna; jangan memilih Owner, Editor, IAM Viewer, atau domain-wide delegation. Izin membaca TIFF diberikan di Google Drive, bukan lewat role IAM proyek.
4. Salin alamat email service account. Pada **masing-masing berkas** di bawah, pilih **Share → tambah alamat service account → Viewer**. Pertahankan **General access: Restricted**. Tidak perlu membagikan seluruh folder atau shared drive. Ini adalah perubahan izin yang dilakukan pemilik akun sendiri.
   - Agro_ABC.tif: https://drive.google.com/file/d/11kWmzkdTWVuxrDJMOYk3JfN34xeoZNRx/view
   - Agro_DEF.tif: https://drive.google.com/file/d/14d-Hui0iwSvHQtCbZJa3InBOlQ3OdGNo/view
5. Bila belum memiliki JSON key yang masih berlaku, pada service account pilih **Keys → Add key → Create new key → JSON**. Lakukan pembuatan dan pengunduhan key sendiri. Simpan di luar folder repository dan folder sinkronisasi publik. Jangan kirim isinya ke chat, issue, PR, atau log. Bila kebijakan organisasi melarang key, jangan menonaktifkan kebijakan itu; gunakan jalur OAuth yang disetujui organisasi atau siapkan federasi tanpa key secara terpisah.
6. Buka https://github.com/mulyadibagan/yg-geoportal/settings/environments/20229830756/edit → **Add environment secret**. Nama persis **DRIVE_CREDENTIALS_JSON**. Tempel **seluruh isi JSON**, bukan path file dan bukan email akun, lalu **Add secret**. Masukkan dan simpan sendiri; cukup beri tahu bahwa secret sudah tersimpan, tanpa nilainya.

Mesin meminta hanya scope `https://www.googleapis.com/auth/drive.readonly`. Scope ini tidak memberi kemampuan menulis, tetapi tidak membatasi file dengan sendirinya. Pembatasan dua berkas berasal dari identitas service account yang hanya diberi Viewer untuk ABC dan DEF. `drive.metadata.readonly` tidak cukup untuk unduh; `drive.file` bukan pengganti langsung untuk akses baca berkas lama yang belum dipilih melalui integrasi Picker.

## Jalur authorized_user bila sudah tersedia

Gunakan JSON dengan `type: authorized_user`, `client_id`, `client_secret`, dan `refresh_token` dari aplikasi OAuth organisasi yang sudah diotorisasi untuk `drive.readonly`. Jangan menempelkan contoh placeholder atau access token sementara sebagai pengganti refresh token. Jangan memperluas scope menjadi `drive` atau `cloud-platform` untuk downloader ini.

Bila perlu membentuk kredensial pengguna baru, ikuti OAuth desktop/ADC resmi dengan client organisasi dan scope eksplisit. Perintah resmi bila Google Cloud CLI tersedia:

```powershell
gcloud auth application-default login --client-id-file="C:\lokasi-privat\oauth-client.json" --scopes="https://www.googleapis.com/auth/drive.readonly"
```

Perintah ini mengubah ADC lokal; gunakan hanya setelah memutuskan jalur tersebut. JSON OAuth client sendiri bukan isi secret. Kredensial ADC hasil login biasanya ada di `%APPDATA%\gcloud\application_default_credentials.json`; periksa tipe dan masukkan isi hasil tersebut sendiri ke secret. Mode OAuth eksternal Testing dapat menghasilkan refresh token yang kedaluwarsa setelah tujuh hari, sehingga bukan pilihan andal untuk mesin berkala. Jangan mengganti autentikasi staf WebGIS atau mengambil token dari konektor Drive ChatGPT.

## Verifikasi setelah secret tersedia

Workflow melakukan GET metadata autentik sebelum memulihkan checkpoint, lalu mengunduh dengan Range dan memvalidasi ukuran, header TIFF, serta MD5 penyedia jika tersedia. Metadata yang terbaca bukan bukti bahwa unduhan lengkap berhasil. Status akhir tetap dibedakan antara download, pemotongan/cakupan, pemeriksaan visual, dan hitungan tanaman.

- `drive_credentials_missing`: secret belum tersedia dalam environment/ref run.
- `drive_credentials_invalid`: JSON salah format/tipe atau key tidak valid.
- `drive_authenticated_request_failed`: refresh kredensial atau permintaan gagal; periksa key/token aktif dan koneksi tanpa membagikan nilainya.
- `drive_api_disabled`: aktifkan Google Drive API pada proyek identitas.
- `drive_scope_insufficient`: otorisasi tidak mencakup baca isi Drive.
- `drive_file_missing_or_not_shared`: periksa ID serta Viewer untuk identitas yang digunakan.
- `drive_access_denied`/`drive_download_disabled`: periksa kebijakan unduhan dan izin; jangan membuka akses publik.

Rujukan: [scope Drive](https://developers.google.com/workspace/drive/api/guides/api-specific-auth), [role Drive](https://developers.google.com/workspace/drive/api/guides/ref-roles), [service account](https://docs.cloud.google.com/iam/docs/service-accounts-create), [JSON key](https://docs.cloud.google.com/iam/docs/keys-create-delete), [ADC dengan scope eksplisit](https://docs.cloud.google.com/docs/authentication/set-up-adc-local-dev-environment).
