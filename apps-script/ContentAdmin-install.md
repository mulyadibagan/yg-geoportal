# Pemasangan Admin Konten V1

1. Buat file Apps Script baru bernama `ContentAdmin.gs`, lalu salin seluruh isi file `ContentAdmin.gs` dari repository.

2. Di dalam `doGet(e)`, setelah `params`, `page`, dan `callback` dibuat, tambahkan:

```javascript
if (page === 'public-content') {
  return contentAdminResponse_(getPublicContent_(), callback);
}

if (page === 'content-save-result') {
  return contentAdminResponse_(
    getContentSaveResult_(params.requestId),
    callback
  );
}
```

3. Di bagian awal `doPost(e)`, setelah variabel `action` dibuat, tambahkan:

```javascript
if (action === 'content-save') {
  return handleContentAdminPost_(e);
}
```

4. Simpan, lalu pilih **Terapkan → Kelola deployment → Edit → Versi baru → Terapkan**. Jangan membuat deployment terpisah.

5. Buka `https://webgisyg.id/content-admin.html`, login dengan akun administrator editor, ubah teks/logo, lalu klik **Simpan konten publik**.

Admin Konten tidak memiliki akses untuk mengubah statistik. Angka luas, bibit, kegiatan, peserta, wilayah, dan capaian tetap berasal dari perhitungan otomatis WebGIS.
