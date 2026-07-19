# YG GeoPortal V6

## WebGIS v2 (generasi baru)

Versi generasi baru tersedia terpisah di [`v2/index.html`](v2/index.html) agar
WebGIS lama tetap aman. Jalankan repository melalui web server lokal lalu buka
`/v2/`.

Fitur utama:

- antarmuka peta penuh yang responsif untuk desktop dan mobile;
- pencarian terpadu seluruh objek spasial (`Ctrl/Cmd + K`);
- layer program dan layer referensi yang dipisahkan;
- layer referensi besar dimuat secara lazy;
- ringkasan cakupan program dan jumlah objek aktif;
- panel detail atribut dan fokus lokasi;
- basemap jalan/satelit, geolokasi, skala, dan layar penuh.

## Perubahan utama
- Struktur peta modular: config.js, map.js, ui.js
- Peta memakai layout absolut penuh sehingga tidak kosong atau terpotong
- Sidebar desktop dapat diciutkan
- Sidebar mobile memakai overlay
- Popup profesional
- Dashboard, legenda, pencarian, lokasi pengguna, fullscreen
- Tetap menggunakan OpenStreetMap gratis

## Cara memperbarui GitHub
1. Ekstrak ZIP.
2. Upload seluruh isi folder ke root repository `yg-geoportal`.
3. Setujui penggantian file lama.
4. Commit changes.
5. Tunggu GitHub Pages 1–2 menit.
6. Buka:
   https://mulyadibagan.github.io/yg-geoportal/webgis.html?v=6

Blogger tidak perlu diubah karena iframe mengambil halaman GitHub yang sama.
