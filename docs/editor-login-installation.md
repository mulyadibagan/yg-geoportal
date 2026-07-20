# Instalasi Login Editor WebGIS

Login menggantikan kolom token admin pada `polygon-editor.html`. Akun awal:

- `mulyadi` — admin
- `zamharir` — GIS/editor

Password hanya dipakai saat login dan tidak disimpan di repository.

## 1. Tambah file Apps Script

Salin seluruh isi `apps-script/EditorAuthentication.gs` ke file baru bernama
`EditorAuthentication.gs` pada project **Laporan WEB GIS YG**.

## 2. Tambah rute pada `doPost(e)`

Letakkan blok berikut tepat setelah variabel `action` dibaca, sebelum rute
`update-master-object`:

```javascript
if (action === 'editor-login' || action === 'editor-logout') {
  return handleEditorAuthPost_(e);
}
```

Urutan akhirnya:

```javascript
const action = clean_(e && e.parameter ? e.parameter.action : '');

if (action === 'editor-login' || action === 'editor-logout') {
  return handleEditorAuthPost_(e);
}

if (action === 'update-master-object') {
  return handleMasterObjectEditorPost_(e);
}
```

Tambahkan juga rute hasil login di `doGet(e)` sebelum rute `page === 'objects'`:

```javascript
if (page === 'editor-auth-result') {
  const result = getEditorAuthResult_(params.requestId || '');
  const json = JSON.stringify(result);

  if (callback && /^[a-zA-Z_$][0-9a-zA-Z_$\.]*$/.test(callback)) {
    return ContentService
      .createTextOutput(callback + '(' + json + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return ContentService
    .createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}
```

Versi `Kode-final-login-editor.gs` sudah memiliki kedua rute tersebut.

## 3. Ganti fungsi `updateMasterObject`

Gunakan versi terbaru di:

`apps-script/DatabaseEngine-updateMasterObject.gs`

Fungsi tersebut menerima sesi login, masih menerima token admin lama sebagai
jalur pemulihan, dan mencatat email pengguna yang melakukan perubahan.

## 4. Deployment

Simpan project, lalu **Terapkan → Kelola deployment → Edit → Versi baru**.
Gunakan deployment yang sama agar URL WebGIS tidak berubah.

## 5. Pengujian

1. Buka `polygon-editor.html` pada branch `develop`.
2. Pastikan layar login tampil dan kolom token tidak ada.
3. Login dengan salah satu akun editor.
4. Edit objek uji lalu simpan.
5. Pastikan `CHANGE_LOG` mencatat email akun yang login.
6. Klik **Keluar** dan pastikan editor kembali terkunci.
