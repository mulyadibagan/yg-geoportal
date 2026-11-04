# Bahan permintaan verifikasi sumber — belum dikirim

Dokumen ini menyiapkan pertanyaan untuk pengelola data. Tidak ada email, formulir atau pesan yang telah dikirim. Jangan melampirkan geometri internal, koordinat stasiun internal atau token staf ke layanan luar tanpa otorisasi yang spesifik.

## BBSDLP / pengelola data sumber daya lahan Kementerian Pertanian

Mohon akses versi resmi **Peta Lahan Gambut Indonesia skala 1:50.000, edisi Desember 2019**, cakupan Riau, beserta:

- Data vektor asli dan identitas/versi revisi, checksum atau identifikator distribusi.
- Kamus atribut `SPT`, `JNTNH1–3`, `KETEBALAN`, `KODE_GBT`, `KELAS_GBT`, `KK`, `KABKOT`, serta aturan kelas pada batas 700 cm.
- CRS/datum, skala, tanggal pemetaan dan batas administrasi yang digunakan.
- Penjelasan penanganan poligon bergeometri sama dengan kelas tanah/ketebalan berbeda dan riwayat koreksinya.
- Ketentuan pemakaian internal serta distribusi ulang melalui penyimpanan dengan otorisasi staf.

Konteks: turunan internal memiliki delapan kelompok geometri identik yang berbeda atribut dan 105 perbedaan kolom wilayah. Referensi FEG BIG yang tersedia tidak beririsan positif dengan delapan kelompok tersebut. Karena itu referensi ini belum menjadi dasar koreksi. Daftar kasus rinci dan geometri tetap privat; tentukan kanal pertukaran yang diizinkan sebelum mengirimnya.

Referensi: [Laporan Tahunan BBSDLP 2019](https://sdlahan.brmp.pertanian.go.id/informasi-publik/download/laporan-tahunan/laporan-tahunan-bbsdlp-2019). [Agregat Trase](https://trase.earth/open-data/datasets/spatial-metrics-indonesia-peat-area) mengutip edisi 2019 tetapi bukan pengganti geometri/kelas sumber yang dibutuhkan.

## Pengelola SiTMAT Kementerian Lingkungan Hidup

Mohon dokumentasi untuk seri publik Simatag dari [SiTMAT](https://sitmat.kemenlh.go.id/), khususnya:

- Satuan dan konvensi tanda `WaterLevel`, serta apakah datum mengacu permukaan gambut setempat, benchmark atau referensi lainnya.
- Zona waktu kolom `Tanggal` dan `Jam`; hubungan waktu pengukuran dengan `current`, `history`, `created_at` dan waktu sinkronisasi.
- Interval pengukuran yang diharapkan, arti daftar kosong, nilai hilang, kode kualitas dan perubahan sensor.
- Jenis alat, metode pemasangan, riwayat kalibrasi, koreksi offset dan QA/QC per stasiun/periode.
- Prosedur menentukan rekaman sah ketika satu ID/tanggal/jam memiliki nilai berbeda, termasuk versi koreksi dan pelestarian rekaman asal.
- CRS/ketelitian koordinat stasiun, identitas stabil stasiun, keterwakilan hidrologis serta izin penggunaan dan penyimpanan internal.

Konteks: paket publik yang diperoleh menyimpan ID, koordinat, URL sumber, checksum, tanggal dan jam asli. Audit menemukan dua rekaman berulang dengan nilai berbeda. Tidak ada nilai yang dipilih otomatis, zona waktu yang diasumsikan, atau indikator yang disahkan. Bukti per kasus tersimpan di audit privat dan dapat disediakan melalui kanal yang disetujui.

## Syarat menutup kasus

Jawaban umum tentang metodologi tidak otomatis mengesahkan setiap stasiun/poligon. Simpan sumber jawaban, identitas penelaah, tanggal, versi data, lingkup kasus yang disetujui dan alasan keputusan. Pertahankan kasus tanpa bukti sebagai belum dinilai; jangan mengisi kekosongan memakai mayoritas kelas, tetangga terdekat atau skor perkiraan.
