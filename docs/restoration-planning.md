# Rencana restorasi Bengkalis dan Dumai

> Arsip perilaku versi awal. Halaman aktif sudah diganti menjadi analisis seluruh kandidat berbasis bukti; lihat [restoration-analysis.md](restoration-analysis.md). Draf program lama tidak lagi dibaca sebagai hasil analisis.

Halaman `restoration-priority.html` memakai sesi staf eksisting. Penyusun rencana membaca paket analisis privat melalui `/api/staff/restoration/source`, lalu draf bersama melalui `/api/staff/restoration/plan`. Keduanya memerlukan bearer token staf yang diverifikasi backend. Tidak ada paket analisis privat yang ditaruh di GitHub Pages.

Paket sumber JSON memerlukan `access: staff_only`, schema 1, tanggal, checksum berkas sumber dan checksum geometri gambut asli. Paket dashboard lama dapat diimpor dengan metadata tersebut. Validator hanya menyimpan atribut yang diperlukan, relasi desa-unit dan provenance. Poligon referensi dipetakan memakai `baris_asal` hanya jika checksum BBSDLP cocok.

Pemilihan desa untuk proposal terpisah dari kelas bukti historis P1/P2/P3/D. Jumlah sel tidak ditafsirkan sebagai hektare, titik sekat atau jumlah kanal. Draf awal memilih enam lokasi fokus; jumlah unit tetap kosong. Tombol skenario Dumai secara eksplisit mengisi empat sekat baru untuk Pelintung dan empat untuk Guntung sebagai asumsi anggaran awal. Skenario tidak menimpa target berbeda yang telah diisi.

Target, dasar jumlah, tahap, bulan relatif dan catatan dapat disunting. Angka kosong disimpan sebagai null, berbeda dari nol. Inventaris struktur, jaringan/elevasi/aliran kanal, batas kegiatan, tenurial dan kebutuhan vegetasi masih harus diverifikasi. Tidak ada perhitungan luas intervensi atau kebutuhan teknis sekat otomatis.

Penyimpanan menggunakan R2 `internal/restoration/`, conditional put dengan versi ETag, dan arsip isi menurut SHA-256. Konflik versi menghasilkan 409 dan tidak menimpa rencana bersama. Versi sumber dikunci pada draf. Bila sumber berubah, rencana lama perlu direkonsiliasi sebelum disimpan. Semua respons privat `no-store`; origin tulis hanya HTTPS webgisyg.id.

Unduhan: narasi Markdown, tabel CSV dengan pelindung formula spreadsheet, JSON draf dan GeoJSON unit referensi utuh. GeoJSON secara eksplisit bukan poligon intervensi; unit yang beririsan beberapa desa dihitung sekali.

Uji: `node --test cloudflare/yg-webgis-public-data/test/restoration-plans.test.mjs tests/restoration-*.test.cjs`.
