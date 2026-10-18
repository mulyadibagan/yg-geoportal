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

Tim dapat memuat koreksi/rekap melalui tombol perbarui jika memerlukan hasil
terbaru segera. Saat layanan terputus, biarkan tab berisi perubahan belum
tersimpan terbuka; jangan menganggap perubahan lokal sudah disimpan.
