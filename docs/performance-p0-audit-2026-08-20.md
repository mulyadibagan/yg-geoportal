# Audit dan implementasi P0 performa publik

Tanggal audit: 20 Agustus 2026
Basis source: `origin/main` commit `98a3a2f`
Feature branch: `codex/yg-webgis-performance-p0`

## Temuan terverifikasi

- Home aktif memuat `js/dashboard-v3.js`, bukan `js/dashboard-database.js`. Loader itu meminta seluruh `page=objects` melalui JSONP, menambahkan `Date.now()`, dan dapat mencoba hingga tiga kali. `js/dashboard-database.js` masih berisi pola serupa untuk `page=dashboard-summary`, tetapi tidak dimuat oleh `index.html`.
- `getDashboardSummaryV2_()` membaca seluruh OBJECTS aktif melalui `readMasterObjects_()` lalu membaca kembali 32 kolom `Laporan Masuk` melalui `summarizePublishedReports_()`.
- `readMasterObjects_()` membaca 24 kolom OBJECTS, termasuk `Geometry_GeoJSON` dan `Properties_JSON`, untuk semua baris.
- `getWebGisObjectsFeatureCollection_()` membaca OBJECTS, lalu membaca 32 kolom `Laporan Masuk` untuk menambahkan laporan terpublikasi yang belum tersinkronisasi.
- WebGIS di HEAD sudah snapshot-first: `js/map-v4.js` memuat `data/master-database-snapshot.json`, lalu memakai Apps Script dan JSONP hanya sebagai fallback. Workflow `update-master-database-snapshot.yml` memperbaruinya setiap jam.
- Snapshot master berisi 137 fitur, termasuk 20 monitoring dan 214 URL foto. Geometri memakai sekitar 192.394 byte dan properties sekitar 136.359 byte dari payload 335.106 byte.
- Foto asli tetap di Google Drive. Markup popup/gallery sudah memakai `loading="lazy"`; foto tidak diunduh pada initial map load karena popup dibuat saat interaksi.

## Baseline dan hasil P0

Sampel request langsung (satu kali per endpoint):

| Jalur | Ukuran | Waktu sampel |
| --- | ---: | ---: |
| Apps Script `page=objects` | 335.049 byte | 7.162 ms |
| Apps Script `page=dashboard-summary` | 425 byte | 3.136 ms |
| Apps Script `page=public-reports` | 127.579 byte | 2.914 ms |
| Snapshot Home baru (lokal/GitHub Pages) | 170.747 byte | delivery statis |

Snapshot Home mengurangi payload awal objek sebesar 49,0% (164.359 byte), mempertahankan 137/137 fitur dan menghasilkan nol perbedaan properties. Payload juga membawa hanya 9 laporan capacity/participant dan satu ringkasan sesi pre/post yang diperlukan Home. Home tidak lagi membutuhkan Apps Script pada jalur normal; fallback tetap tersedia jika snapshot gagal.

Smoke test lokal:

- Home: 588,64 ha, 1.125 peserta, 14 desa, 4 kabupaten; angka muncul sekitar 5,77 detik pada smoke test lokal, dibanding lebih dari 24 detik ketika request capacity Apps Script masih berada di critical path; tanpa error console dari perubahan ini.
- WebGIS: 124 objek tampil, 26 kontrol layer, 18 monitoring, status berhasil dimuat, tanpa error/warning console.
- Syntax: Python `py_compile`, Node `--check`, dan `git diff --check` lulus.

## Audit geometry (tanpa simplifikasi)

Layer terbesar yang perlu kajian terpisah sebelum membuat display geometry:

| Layer | Ukuran | Fitur | Vertex |
| --- | ---: | ---: | ---: |
| `mangrove-priority-riau-candidates.geojson` | 19.852.576 | 7.992 | 335.427 |
| `Gambut_BBSDLP_2019.geojson` | 17.827.190 | 736 | 396.652 |
| `IUPHHK_HT_2014.geojson` | 10.067.335 | 138 | 248.912 |
| `coastal-analysis-regional.geojson` | 8.597.386 | 7.555 | 145.859 |
| `kawasan_hutan_sk_903.geojson` | 7.685.437 | 4.185 | 342.866 |
| `batas_administrasi_desa_riau.geojson` | 4.667.350 | 2.259 | 97.769 |

Tidak ada geometri produksi yang disimplifikasi pada P0.

## Cloudflare dan hosting

- Repository memakai GitHub Pages (`deploy-pages.yml`) dengan `CNAME` `webgisyg.id`.
- DNS publik apex menunjuk ke IP GitHub Pages; `www` adalah CNAME ke `mulyadibagan.github.io`; nameserver publik adalah `dns-parking.com`.
- Header publik menyatakan `Server: GitHub.com` dan cache Fastly. Tidak ditemukan konfigurasi Worker, Pages, R2, KV, route, atau Wrangler di repository.
- Karena tidak ada kredensial/account inventory Cloudflare di repository, resource account-level tidak dapat diinventarisasi dari source. Tidak ada resource Cloudflare yang dibuat atau diubah dalam P0, sehingga tidak ada konflik dengan `kompilasichord-*`.
- Jika Cloudflare ditambahkan setelah review, semua resource baru wajib memakai prefix `yg-webgis-*` dan inventory akun harus dilakukan sebelum provisioning.

## Perubahan P0

- Generator mengambil data publik satu kali per endpoint pada jadwal (objects, public reports, dan pre/post), menyaring laporan capacity/participant, lalu menulis snapshot WebGIS penuh dan snapshot Home tanpa geometri.
- Workflow hourly meng-commit kedua snapshot secara atomik.
- Home mencoba snapshot statis terlebih dahulu, lalu memakai Apps Script lama sebagai fallback.
- Service worker memakai stale-while-revalidate hanya untuk dua snapshot publik; endpoint dinamis lain tetap `no-store`.
- LocalStorage cache, definisi angka, seluruh properties, monitoring, foto, filter, popup, admin, Apps Script, Sheets, dan Drive tidak diubah.

## Risiko kompatibilitas

- Data publik dapat tertinggal paling lama sekitar satu interval workflow bila sinkronisasi GitHub Actions gagal. Fallback Apps Script mencegah kegagalan total hanya bila file snapshot tidak dapat dimuat/invalid.
- `force-cache` mengikuti TTL hosting. Workflow commit mengubah ETag/file content; service worker dan browser dapat tetap menahan versi sesuai kebijakan cache yang ada.
- Snapshot Home sengaja mempertahankan semua public properties agar kartu donor/program tidak berubah. Pemisahan detail Monitoring lebih lanjut adalah P1 dan memerlukan endpoint/detail snapshot per laporan sebelum properties dapat dipangkas.

## File berubah

- `.github/workflows/update-master-database-snapshot.yml`
- `data/dashboard-summary-snapshot.json`
- `data/master-database-snapshot.json` (refresh data sumber saat verifikasi)
- `docs/performance-p0-audit-2026-08-20.md`
- `index.html`
- `js/dashboard-v3.js`
- `scripts/update-master-database-snapshot.py`
- `service-worker.js`
