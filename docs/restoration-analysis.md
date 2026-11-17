# Analisis kebutuhan restorasi Bengkalis–Dumai

`restoration-priority.html` menghasilkan penapisan, telaah dan rekomendasi dari seluruh sumber analisis Bengkalis/Dumai. UI aktif hanya membaca `/api/staff/restoration/source` dengan sesi staf yang diverifikasi backend. Tidak ada data analisis privat dalam aset publik.

`js/restoration-analysis.mjs` menormalisasi paket, menghubungkan desa dengan unit, menghitung kelas per wilayah dan menyaring hasil menurut wilayah/kelas/nama. Kelas desa mengikuti hasil analisis sumber, bukan pilihan program. P1 didahulukan untuk verifikasi; P2/P3 memerlukan lokalisasi atau pelengkapan bukti. D bukan prioritas rendah. N tidak membuktikan lokasi bukan gambut. Dalam kelas yang sama, nama alfabetis bukan peringkat tingkat kerusakan.

Dasar historis: gambut BBSDLP 2019, api 2015–2017, kehilangan tutupan pohon 2018–2025 dan kanal arsip yang tahun pengamatannya belum pasti. Tanggal kompilasi tidak dianggap tanggal observasi seluruh data. Sel dalam satu unit dipisahkan dari sel setempat di desa. Unit yang beririsan beberapa desa atau wilayah dideduplikasi untuk hitungan lintas hasil.

Rekomendasi memisahkan langkah verifikasi, kebutuhan kajian tata air, kondisi vegetasi dan kesenjangan bukti. Semua kebutuhan jumlah sekat dan luas intervensi tetap null sampai data teknis tersedia. Tidak ada input target, pilihan enam lokasi tetap, atau tombol skenario sekat dalam halaman aktif. Draf program lama tetap berada di penyimpanan privat sebagai arsip dan tidak dibaca sebagai hasil analisis.

Peta otomatis menampilkan unit sesuai filter dengan kelas unit historis. Kelas unit tidak otomatis berlaku di seluruh desa. Geometri asli dipakai hanya jika checksum BBSDLP cocok. Poligon adalah unit referensi utuh, bukan tapak intervensi. Detail desa menampilkan relasi serta bukti tiap unit. Histori Pelintung–Guntung menjadi rincian tambahan yang tertutup secara default, tanpa memfokuskan peta awal pada dua kelurahan itu.

Unduhan CSV, Markdown dan GeoJSON memakai baris sesuai filter. GeoJSON membawa status indikatif historis dan tidak membawa target program. Semua unduhan memerlukan sesi aktif. Kesalahan akses tidak memakai fallback publik. Pengujian: `node --test tests/restoration-analysis.test.mjs tests/restoration-focus.test.cjs tests/restoration-feg-selection.test.cjs tests/restoration-review.test.cjs cloudflare/yg-webgis-public-data/test/restoration-plans.test.mjs`.
