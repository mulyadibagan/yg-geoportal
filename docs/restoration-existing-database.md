# Penggunaan database eksisting pada modul restorasi

Inventaris FDRS dan sekat kanal di modul dibaca dari endpoint snapshot yang sudah dipakai WebGIS: `https://webgis-api.yayasangambut.org/snapshots/current/objects.json`. Tidak ada endpoint baru, perubahan database, perluasan izin, atau menu publik. Kontrol dan pemuatan layer baru hanya diaktifkan setelah verifikasi katalog staf pada backend berhasil.

## Perilaku

- Sekat kanal sebelumnya membaca `data/sekat_kanal.geojson`; kini memakai snapshot database eksisting. FDRS ditambahkan sebagai layer inventaris tersendiri. Keduanya dimuat atas pilihan pengguna, berbagi satu permintaan dan cache agar tidak mengunduh snapshot dua kali.
- Hanya record `Layer_ID` fdrs/sekat_kanal, status tepat `Aktif`, identitas Object_ID tidak ambigu dan titik WGS84 yang valid secara struktur diterima. Status pembangunan/nonaktif tidak dihitung sebagai aktif; ID duplikat dikecualikan sampai ditelaah. Ini bukan verifikasi jumlah aset fisik unik atau ketepatan lapangan.
- Popup hanya membawa whitelist identitas/nama objek, layer, status, kabupaten/kecamatan/desa, tahun dan revisi. Kontak, pelapor, tautan dokumen, foto, catatan bebas dan masukan scoring pada record master tidak diteruskan ke layer modul.
- Filter kabupaten berlaku pada kedua inventaris. Pilihan KHG tidak mengesahkan keterwakilan alat terhadap seluruh unit KHG. Tidak ada buffer, interpolasi TMAT atau asumsi kondisi hidrologi dari keberadaan sekat.
- Versi snapshot (`snapshotGeneratedAt`, atau `generatedAt` jika tidak tersedia) dan jumlah record yang dikecualikan ditampilkan pada sumber runtime. Gagal memuat tidak diganti data statis lama atau nol.
- Batas baca 4 MiB, timeout permintaan 15 detik; error HTTP/JSON, CRS lain dan koordinat proyeksi ditolak. Tidak ada dependency baru.

## Batas keamanan dan analisis

Endpoint snapshot tersebut merupakan jalur publik eksisting untuk objek yang sudah dipublikasikan WebGIS; perubahan ini tidak mengklaim endpoint itu menjadi privat. Halaman modul tetap memerlukan otorisasi staf. Dataset privat R2, seri mentah internal dan tabel Sheets tidak dipindahkan ke endpoint publik. Snapshot publik tidak menggantikan pemeriksaan tabel sumber berotorisasi jika ada perbedaan.

Pembacaan langsung Sheets dan snapshot layanan dapat berbeda jumlah/versi. Jangan menjumlahkan keduanya sebagai aset berbeda atau menganggap snapshot sebagai pembacaan langsung Sheets. Snapshot 4 November 2026 yang diperiksa menampilkan 13 record FDRS aktif dan 14 sekat aktif, serta dua sekat berstatus pembangunan yang dikecualikan. Angka tampilan mengikuti versi data yang diterima, bukan angka yang dipatok dalam UI.

Kedua layer merupakan konteks inventaris/kesiapan pelaksanaan. Semua indikator kebutuhan ekologis, bobot dan status belum dinilai tetap mengikuti mesin scoring yang sama. Keberadaan alat FDRS bukan nilai TMAT; sekat kanal bukan jaringan kanal lengkap atau bukti gangguan hidrologi. Tidak ada skor kesiapan numerik yang dibuat.

## Verifikasi

Tes memakai geometri nyata dari snapshot repository untuk memeriksa pelestarian sumber, penolakan ID ambigu/status pembangunan/koordinat proyeksi, penghapusan field privat dan masukan skor, pembatasan ukuran, kegagalan HTTP/JSON, serta gate staf sebelum kontrol tersedia. Pembaca juga dijalankan secara baca-saja terhadap endpoint snapshot eksisting. Pengujian browser terhadap UI baru belum dilakukan karena perubahan belum dideploy dan kontrol origin staf sengaja tetap berlaku.

## Lokasi kebakaran BPBD dari arsip staf

Katalog yang sudah lolos otorisasi staf juga dipakai untuk membuat pilihan layer `KEBAKARANHUTLARIAU_PT_<tahun>_250K` dari penerbit BPBD. Hanya entri siap-peta dengan UUID tidak ambigu, ukuran paling banyak 12 MiB, checksum SHA-256 dan jumlah fitur yang lengkap diterima. Data diambil melalui endpoint `/api/staff/riau-geoportal/datasets/<UUID>/display` yang sudah ada, menggunakan sesi staf saat ini. Respons 401/403 menyembunyikan workspace. Tidak ada endpoint, menu publik atau penyimpanan statis baru untuk data BPBD.

Setiap respons diperiksa byte, checksum dan jumlah fiturnya sebelum validasi struktur Point/MultiPoint WGS84. Memuat data hanya terjadi setelah pengguna memilih layer. Tahun pada label adalah tahun pada **judul sumber**, bukan penetapan periode kejadian. Tahun metadata, judul asli, penerbit, UUID, checksum dan jumlah catatan konflik ditampilkan pada sumber runtime; konflik tidak diperbaiki atau disembunyikan otomatis.

Titik dipilih dengan point-in-polygon pada poligon gambut yang tersaring. Untuk MultiPoint, hanya koordinat asli yang lolos dipertahankan dalam tampilan; sumber tidak diubah. Tidak ada koordinat baru, interpolasi, buffer, estimasi area terbakar atau deduplikasi kejadian yang dibuat. Jumlah fitur bukan jumlah kejadian kebakaran unik. Ketidakpastian batas BBSDLP tetap berlaku; tidak ada klaim overlay KHG atau topologi unit sudah disahkan.

Tes tambahan memeriksa identitas/penerbit/katalog staf, konflik tahun yang dipertahankan, checksum dan jumlah fitur, geometri proyeksi, pemilihan titik sumber tanpa mutasi, permintaan hanya saat layer dipilih, bearer staf, penolakan 403, serta ringkasan ekologis yang tetap tidak berubah. Integrasi UI baru ini belum diuji browser atau dideploy. Layer tersebut merupakan bukti lokasi kejadian; indikator riwayat kebakaran tetap belum dinilai sampai periode, duplikasi dan metode telah divalidasi.
