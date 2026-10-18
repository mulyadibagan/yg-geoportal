# Penghematan permintaan analisis Dayun

Paket Cloudflare tetap gratis. Tidak ada migrasi, penghapusan, atau perubahan
format koreksi privat maupun data sensus.

- Koreksi nanas dan buah dibaca pasif setiap 60 detik, sebelumnya 15 detik.
- Galat pembacaan menunda percobaan pasif berikutnya selama lima menit.
- Rekap enam sumber A–C diperbarui setiap lima menit, sebelumnya 45 detik.
- Status mesin hanya diperiksa otomatis saat ada pekerjaan pending/processing.
  Setelah selesai atau galat, pemeriksaan berhenti sampai tindakan manual.
- Tab tersembunyi tidak melakukan pembacaan berkala ini. Permintaan buah dan
  status mesin yang belum selesai tidak ditumpuk oleh timer berikutnya.
- Penyimpanan otomatis nanas tetap dua detik. Simpan manual, keputusan buah,
  versi per titik, penggabungan antarstaf dan perlindungan konflik tetap berlaku.
  Perubahan lokal langsung memperbarui jumlah tanpa menunggu pembacaan server.

Untuk satu tab terlihat dengan mesin selesai, permintaan berkala terkait turun
dari sekitar 18/menit menjadi 3,2/menit (sekitar 82%). Ini perhitungan jadwal,
bukan pengukuran seluruh trafik akun: pembacaan citra, tindakan staf, tab lain
dan layanan lain tetap memakai kuota. Tidak menjamin batas gratis tidak tercapai.
Kuota yang sudah habis tidak dipulihkan oleh perubahan kode ini.

Peta detail mengambil setiap potongan native kecil sekali melalui API staf,
lalu membaca jendela piksel/zoom dari Blob di memori. Ini memakai cache native
yang sudah ada (maksimum tiga Blob/64 MiB), dua pembukaan bersamaan, dan batas
layer viewport yang sudah ada; bukan mengunduh TIFF sumber berukuran gigabyte.
Layer aktif juga memegang Blob masing-masing sampai dilepas oleh viewport.
Blob tidak dimasukkan ke penyimpanan browser permanen atau cache publik.
Pembatasan sesi, daftar berkas manifest, koordinat, dan resolusi asli tetap berlaku.

Uji lokal GeoTIFF 2.1.3 pada potongan asli 12.857.299 byte, 16 jendela piksel,
menghasilkan 33 permintaan HTTP dengan pembacaan URL bertahap dan satu permintaan
dengan pembacaan Blob. Hash piksel seluruh jendela serta batas koordinat sama.
Ini hasil satu uji, bukan persentase penghematan seluruh akun. Permintaan baru
tetap diperlukan ketika tim berpindah ke potongan yang belum dimuat atau
potongan sudah dilepas dari memori. Galat HTTP 429 menghentikan percobaan
otomatis potongan itu; tombol Muat ulang citra tetap dapat dipakai setelah pulih.

Tim dapat memuat koreksi/rekap melalui tombol perbarui jika memerlukan hasil
terbaru segera. Saat layanan terputus, biarkan tab berisi perubahan belum
tersimpan terbuka; jangan menganggap perubahan lokal sudah disimpan.
