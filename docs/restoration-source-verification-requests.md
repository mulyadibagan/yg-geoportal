# Bahan permintaan verifikasi sumber — belum dikirim

Dokumen ini menyiapkan pertanyaan untuk pengelola data. Tidak ada email, formulir atau pesan yang telah dikirim. Jangan melampirkan geometri internal, koordinat stasiun internal atau token staf ke layanan luar tanpa otorisasi yang spesifik.

## BBSDLP / pengelola data sumber daya lahan Kementerian Pertanian

### Kanal resmi terverifikasi, 4 November 2026

[Layanan Informasi Geospasial Tematik BRMP SDLP](https://sdlahan.brmp.pertanian.go.id/informasi-publik/informasi-geospasial-tematik) menyebut tujuan `brmp.sdlahan@pertanian.go.id`, CC `sekretariatbbsdlp@yahoo.com`. Alamat tujuan dan CC diperiksa dari halaman layanan resmi, bukan ditebak dari nama domain. Layanan meminta surat kepada Kepala BRMP SDLP, identitas, proposal dan batas area penelitian. Halaman menyebut layanan peta gambut melalui PNBP; jumlah tarif belum diperoleh dan tidak ada komitmen pembayaran. Konfirmasi ketersediaan, persyaratan terkini dan penawaran resmi harus mendahului pengajuan lampiran sensitif atau pembayaran.

### Draf pertanyaan awal — tanpa lampiran, belum dikirim

- Tujuan: brmp.sdlahan@pertanian.go.id
- CC: sekretariatbbsdlp@yahoo.com
- Subjek: Informasi ketersediaan dan prosedur akses Peta Lahan Gambut 2019 cakupan Riau

Yth. Tim Layanan Informasi Geospasial Tematik BRMP SDLP,

Untuk persiapan analisis internal prioritas restorasi gambut di Provinsi Riau pada WebGIS Yayasan Gambut, mohon informasi ketersediaan Peta Lahan Gambut Indonesia skala 1:50.000 edisi Desember 2019 cakupan Riau dalam format vektor asli, beserta metadata, kamus atribut, dan riwayat revisinya.

Mohon konfirmasi prosedur pengajuan, kelengkapan surat/proposal dan batas wilayah yang diperlukan, tarif/penawaran resmi apabila berlaku, serta ketentuan penggunaan data untuk analisis dan penyimpanan internal dengan akses terbatas staf.

Kami juga memerlukan penjelasan mekanisme verifikasi ketika geometri identik memiliki atribut kelas ketebalan atau jenis tanah berbeda pada suatu turunan data. Pada tahap pertanyaan awal ini belum disertakan identitas pemohon, proposal, koordinat atau geometri kasus.

Mohon arahkan kami kepada pengelola dataset yang tepat apabila layanan ini bukan kanal penanggung jawab versi tersebut.

Terima kasih.

Identitas penandatangan dan lampiran belum ditetapkan. Draf tidak boleh dikirim atas nama orang atau pejabat tertentu tanpa instruksinya.

Keputusan pengguna pada 4 November 2026: **simpan draf saja**. Tidak ada izin pengiriman pesan atau lampiran.

### Rincian kebutuhan untuk pengajuan berikutnya

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

### Draf tambahan metadata seri penelitian — disimpan saja, tidak dikirim

Rujukan: Deshmukh dkk. (2023), DOI 10.1038/s41586-023-05860-9; Zenodo 7728463 versi v.03, `Deshmukh_ED_Fig. 2.xlsx`, Panel a. Workbook asli dan checksum penerbit sudah diperiksa. Mohon informasi untuk menilai penggunaan seri rata-rata tiga piezometer sebagai bukti penelitian, tanpa mengasumsikannya mewakili semua unit gambut Riau:

- ID, koordinat WGS84 beserta ketelitian dan periode operasi masing-masing piezometer yang membentuk seri rata-rata; apakah bobot/jumlah alat berubah sepanjang seri.
- Definisi nilai harian: zona waktu, batas hari, metode agregasi, jumlah pembacaan minimum, kode kualitas, perlakuan data hilang/interpolasi dan koreksi yang diterapkan.
- Referensi nol ke peat hollow surface, pengaruh perubahan/subsidensi permukaan, metode kompensasi tekanan atmosfer, identitas alat dan riwayat kalibrasi/offset yang relevan.
- Ketersediaan seri native per alat beserta flag QA, metadata versi dan lisensi yang berlaku untuk penggunaan analisis internal.
- Batas keterwakilan spasial/periode, serta cara yang dapat dipertanggungjawabkan untuk menghubungkan seri ke unit analisis tanpa menyalin koordinat tower sebagai lokasi ketiga alat.

Tidak ada email, formulir permintaan, komitmen biaya atau data/geometri internal yang dikirim. Kelengkapan tabel terbitan tidak dianggap kelengkapan perekaman instrumen.

Jawaban umum tentang metodologi tidak otomatis mengesahkan setiap stasiun/poligon. Simpan sumber jawaban, identitas penelaah, tanggal, versi data, lingkup kasus yang disetujui dan alasan keputusan. Pertahankan kasus tanpa bukti sebagai belum dinilai; jangan mengisi kekosongan memakai mayoritas kelas, tetangga terdekat atau skor perkiraan.
