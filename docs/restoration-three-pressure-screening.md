# Fokus aktif: kebakaran, bukaan hutan gambut dan kanal

Arahan terbaru pengguna mengganti kebutuhan lima indikator awal dengan penapisan tiga tekanan spasial. TMAT, kalibrasi alat dan sensitivitas gambut bukan prasyarat model aktif. Mesin lima indikator tetap tersedia untuk reproduksi audit terdahulu, tetapi halaman restorasi memakai `assessPressures` dan `properties.restorationPressures`.

Aturan awal tanpa bobot/skor perkiraan: tiga tekanan diketahui hadir = tinggi; dua hadir = sedang; satu hadir = rendah. Ketiga status harus diketahui. Jika semuanya diketahui tidak hadir, status `Tidak terindikasi pada cakupan data`, bukan jaminan tidak memerlukan restorasi. Status kosong/meragukan tetap belum dinilai, bukan false atau nol. `score` selalu null; jumlah tekanan adalah hitungan bukti, bukan skor ekologis 0–100.

Untuk tiap `fire`, `forestOpening`, `canals`, kontrak masukan memerlukan `present` boolean, `validated:true`, `definition`, `validation.reference` dan `provenance` dengan sumber/tahun/versi. False hanya diterima bila `coverageComplete:true`. Deklarasi validasi harus berasal dari pemeriksaan sumber/overlay nyata, tidak boleh diisi otomatis karena layer tampil. Definisi, resolusi dan periode sumber harus dicatat pada tahap persiapan dan dapat dibandingkan; penapisan ini tidak mengesahkan deklarasi hulu.

Kebakaran: bedakan indikasi terbakar, hotspot dan record respons pemadaman. Bukaan hutan: gunakan bukti perubahan pada lahan gambut; kehilangan tutupan pohon bukan otomatis seluruh pembukaan hutan. Kanal: gunakan geometri jaringan kanal/drainase, bukan titik sekat. Data terdahulu tetap bukti kandidat dan tidak otomatis dipromosikan ke kontrak baru.

Belum ada hasil privat diunggah atau nilai tekanan fiktif diisi. Kebutuhan data berikutnya dipusatkan pada jaringan kanal asli, penetapan bukaan hutan gambut dan periode kebakaran yang sesuai. Akses staf, penyimpanan privat, endpoint dan database produksi tidak berubah. Perubahan kode ini belum dideploy.
