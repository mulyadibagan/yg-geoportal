# Pengelolaan Objek dan Donor WebGIS V1

## Tujuan

Semua objek program dapat:

- diperbarui atribut dan geometrinya;
- dikaitkan dengan donor dan proyek;
- dicari menggunakan nama donor, proyek, lokasi, atau Object ID;
- tetap memakai Object ID permanen agar monitoring dan foto tidak terputus;
- ditambahkan sebagai objek baru melalui alur admin.

## Atribut baku

Identitas objek:

- `Object_ID` — permanen dan unik;
- `Layer_ID`;
- `Layer_Label`;
- `Nama_Objek`;
- `Kategori`;
- `Status_Objek`.

Program dan pendanaan:

- `Program`;
- `Donor`;
- `Nama_Proyek`;
- `Project_ID`;
- `Nomor_Perjanjian`;
- `Fase`;
- `Tahun`.

Lokasi dan capaian:

- `Provinsi`;
- `Kabupaten`;
- `Kecamatan`;
- `Desa`;
- `Luas_Ha`;
- `Panjang_M`;
- `Jumlah_Tanam`.

## Kompatibilitas data lama

Kolom inti yang sudah ada di sheet `OBJECTS` tidak diubah. Atribut donor/proyek
disimpan di `Properties_JSON`, sehingga objek lama tetap dapat dibaca dan tidak
memerlukan migrasi sekaligus. API `page=objects` harus menggabungkan
`Properties_JSON` ke `feature.properties`, seperti perilaku yang sudah digunakan
editor saat ini.

## Aturan Object ID

- Object ID tidak boleh berubah ketika nama, donor, atau geometri diperbarui.
- Objek baru memperoleh Object ID satu kali sebelum disimpan.
- Format yang disarankan:
  `YG-{LAYER}-{KODE-DESA}-{TAHUN}-{NOMOR}`.
- Sistem wajib menolak Object ID yang sudah digunakan.

## Alur tambah objek baru

1. Admin memilih layer tujuan.
2. Admin menggambar titik, garis, atau polygon, atau mengimpor GeoJSON/KML.
3. Admin mengisi identitas, donor, proyek, lokasi, dan capaian.
4. Sistem memvalidasi geometri serta keunikan Object ID.
5. Apps Script menambahkan baris baru ke `OBJECTS`.
6. Apps Script mencatat aksi `CREATE` ke `CHANGE_LOG`.
7. Editor membaca ulang endpoint `page=objects` untuk memastikan objek tersimpan.

Alur ini memerlukan endpoint Apps Script khusus untuk membuat objek. Fitur tambah
objek tidak boleh diaktifkan di produksi hanya dengan mengandalkan fungsi update,
karena fungsi update harus tetap menolak Object ID yang belum terdaftar.

## Catatan DatabaseEngine.gs saat ini

Fungsi `upsertMasterObject_()` yang sekarang digunakan sudah dapat menambahkan
Object ID baru ke `OBJECTS`. Agar audit trail membedakan penambahan dan revisi,
ganti fungsi `updateMasterObject()` menggunakan:

`apps-script/DatabaseEngine-updateMasterObject.gs`

Tambahkan juga layer berikut ke `MASTER_LAYER_CONFIG` jika belum ada:

```javascript
{
  id: 'area_kopi',
  label: 'Wilayah Penanaman Kopi',
  category: 'Agroforestri/Kopi',
  file: 'data/area_kopi.geojson'
}
```
