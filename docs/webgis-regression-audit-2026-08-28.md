# Audit regresi WebGIS — 28 Agustus 2026

## Pemicu dan akar masalah

Audit dilakukan setelah layer monitoring, warna kluster PS, serta tombol profil
desa/PS ditemukan hilang secara bertahap. Branch diperiksa terhadap
`origin/main` dan berada pada versi produksi yang sama.

Regresi utama berasal dari commit `e7b5960` yang bermaksud memperjelas jumlah
fitur Perhutanan Sosial, tetapi sekaligus mengganti sebagian besar
`js/map-v4.js` dan `webgis.html` dengan varian yang lebih lama. Perubahan itu
menghapus atau memundurkan sejumlah fungsi yang sebelumnya sudah aktif.

## Fungsi yang dipulihkan

- pemuatan monitoring live dan fallback terverifikasi;
- API internal `addLiveFeatures`, termasuk penanganan data yang datang sebelum
  layer utama selesai dibuat;
- badge monitoring berdasarkan ID laporan unik;
- penanda `M` untuk monitoring polygon agar tetap terlihat pada zoom provinsi;
- kestabilan popup monitoring dan popup PUP;
- layer Petak Ukur Permanen dan Titik Tapak Ukur;
- KPH 2019 seluruh Provinsi Riau (1.382 fitur);
- fallback snapshot Master Database, timeout sumber data, dan fallback GeoJSON
  lokal;
- indeks foto objek program;
- metadata pemeliharaan sekat kanal Temiang;
- normalisasi nama donor Yayasan Penabulu;
- atribut dan tautan sumber pada popup KHG/FEG;
- perlindungan hasil pemuatan layer referensi asynchronous;
- warna kluster dan profil PS;
- profil Desa Intervensi YG dan desa administratif Riau.

## Hasil pengujian browser lokal

- Master Database: 134 objek berhasil dimuat.
- Monitoring publik: 25 laporan ditemukan dan seluruhnya memiliki geometri.
  Build audit sempat memetakan 21 laporan karena pemuat live jatuh ke daftar
  fallback lama, bukan karena empat laporan kehilangan lokasi.
- Layer monitoring setelah sinkronisasi live V2: 25 outline polygon dan 25
  penanda `M`; seluruh laporan publik kini masuk ke layer.
- Seluruh 17 layer program yang tersedia lulus uji toggle dan jumlah render.
- Seluruh 8 layer referensi lulus uji pemuatan dan toggle:
  - FEG Riau: 711 fitur;
  - IUPHHK-HT 2014: 138 fitur, 135 path hasil render;
  - Kawasan Hutan SK 903: 4.185 fitur;
  - KHG Riau: 65 fitur;
  - Perhutanan Sosial: 172 PS unik / 176 polygon;
  - Gambut BBSDLP 2019: 736 fitur;
  - KPH 2019 Provinsi Riau: 1.382 fitur;
  - Batas Administrasi Desa Riau: 2.259 fitur.
- Profil PS, profil desa YG, dan profil desa administratif tetap tersedia.
- Tidak ditemukan error runtime pada console setelah seluruh rangkaian uji.

## Batas audit

Audit ini memeriksa pemuatan, visibilitas, toggle, popup, tautan profil,
jumlah fitur, dan error runtime pada halaman WebGIS. Seluruh 25 laporan
monitoring publik memiliki geometri; jalur live harus digunakan agar WebGIS
tidak berhenti pada gabungan data dasar dan fallback lama.
