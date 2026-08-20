# Cloudflare staging — YG WebGIS

Tanggal: 20 Agustus 2026

## Inventory sebelum provisioning

- Akun Cloudflare: satu akun aktif.
- R2 existing/protected: `kompilasichord-audio`.
- Workers, Pages, KV, dan D1 existing: tidak ditemukan.
- Zone `webgisyg.id`: tidak ditemukan pada akun Cloudflare.
- DNS publik `webgisyg.id` tetap menunjuk GitHub Pages dan nameserver eksternal.
- Tidak ada resource `kompilasichord-*` yang dibaca isinya, diubah, dihapus, di-bind, atau dipakai.

## Resource staging yang dibuat

- R2 bucket: `yg-webgis-public-snapshots-staging`.
- Worker: `yg-webgis-public-data-staging`.
- Workers.dev URL: `https://yg-webgis-public-data-staging.yg-webgis-public-data-worker.workers.dev`.
- Worker version: `baea48da-a9b1-4299-ba37-6cbbfc988e3a`.
- Tidak ada custom domain, Worker route, DNS record, KV, Pages, atau production bucket yang dibuat.

## Data staging

- Version: `e3cf15c0769f`.
- Dashboard: 170.747 byte, 137 fitur, SHA-256 cocok dengan manifest.
- Objects: 335.106 byte, 137 fitur, SHA-256 cocok dengan manifest.
- Key versioned dan `current` disimpan; `manifests/current.json` ditulis terakhir.

## Gateway

Worker hanya menerima `GET`, `HEAD`, dan `OPTIONS` untuk:

- `/health`
- `/snapshots/current/dashboard.json`
- `/snapshots/current/objects.json`
- `/manifests/current.json`

Urutan sumber adalah R2, GitHub Pages, lalu Apps Script. Respons membawa `x-yg-data-source`, CORS publik, cache policy, dan `nosniff`. Endpoint lain menghasilkan 404 dan method tulis menghasilkan 405.

## Status verifikasi

- Unit test Node: 4/4 lulus, termasuk fallback GitHub Pages.
- Wrangler dry-run staging: lulus.
- Upload dan download balik R2: lulus; bytes, feature count, dan checksum cocok.
- Deployment Worker: berhasil.
- Registrasi awal workers.dev sempat menerima TLS handshake failure selama propagasi sertifikat. Setelah propagasi selesai, health, dashboard, objects, dan manifest merespons 200; snapshot berasal dari `r2`. HEAD 200, OPTIONS 204, write method 405, dan path privat 404.

## Prasyarat sebelum production

1. Tambahkan zone `webgisyg.id` ke akun Cloudflare yang benar dan audit seluruh DNS hasil import.
2. Jangan mengganti nameserver sampai semua record dibandingkan dengan DNS aktif dan rollback dicatat.
3. Buat `data-staging.webgisyg.id` dahulu; jangan gunakan apex atau `www`.
4. Buat API token GitHub Environment `yg-webgis-staging` dengan scope minimum R2/Worker yang diperlukan.
5. Jalankan workflow manual staging, smoke test berulang, observability, fallback, dan rollback.
6. Production memerlukan bucket `yg-webgis-public-snapshots` dan Worker `yg-webgis-public-data`; keduanya belum dibuat.

## Rollback staging

- Frontend production belum menunjuk Cloudflare, sehingga kegagalan staging tidak memengaruhi pengguna.
- Rollback data dilakukan dengan menyalin snapshot versioned yang sehat ke key `current`, lalu menulis manifest terakhir.
- Rollback Worker dilakukan menggunakan version ID sebelumnya.
- Penghapusan resource staging tidak diperlukan untuk rollback trafik karena tidak ada route production.
