# Integrasi profil PBPH

## Identitas profil

Satu profil ditentukan oleh `PBPH_ID` pada `data/PBPH_RIAU_052026.geojson`. Seluruh bagian polygon dengan ID yang sama ditampilkan bersama. Nomor SK dan nama pemegang digunakan untuk pemeriksaan silang, bukan sebagai pengganti ID utama.

## Dokumen PBPH

Register publik berada di `data/pbph-documents.json`. Hanya dokumen yang telah diperiksa dan memiliki URL publik yang boleh dimasukkan. Dokumen yang sekadar menyebut perusahaan, dokumen kemitraan, pengumuman audit, atau laporan pihak ketiga tidak boleh diberi kategori SK PBPH.

Alur kerja Drive:

1. Simpan hasil penelusuran pada `DATA PBPH WEBGIS - DRIVE KERJA`.
2. Pisahkan per pemegang PBPH, kemudian folder `SK dan Lampiran` dan `SVLK`.
3. Periksa nama pemegang, nomor SK, tanggal, luas, penerbit, dan lampiran peta.
4. Publikasikan hanya salinan yang hak akses dan status publiknya telah dipastikan.
5. Masukkan URL publik hasil verifikasi ke register. Folder kerja internal tidak dicantumkan pada situs.

## SVLK dan PHL

Integrasi memakai status konservatif berikut:

- `not-researched`: belum ditelusuri;
- `audit-announcement-found`: pengumuman audit ditemukan, tetapi status sertifikat belum terverifikasi;
- `certificate-not-found`: penelusuran telah dilakukan, tetapi bukti sertifikat yang dapat diverifikasi belum ditemukan;
- `certificate-verified`: nomor sertifikat, masa berlaku, LPVI, dan dokumen resmi tersedia;
- `certificate-expired`, `certificate-suspended`, atau `certificate-revoked`: hanya digunakan bila dokumen resmi menyatakan status tersebut.

Situs tidak boleh menyimpulkan sertifikat aktif hanya dari rencana audit. Pembaruan otomatis di masa depan harus menggunakan API atau unduhan resmi yang terdokumentasi; scraping antarmuka SILK tidak digunakan.

Jalankan `node scripts/validate_pbph_documents.mjs` sebelum publikasi.

## Hasil penelusuran awal

- PT Diamond Raya Timber: pengumuman rencana audit PHL ditemukan; sertifikat belum terverifikasi.
- PT Mutiara Sabuk Khatulistiwa: keputusan perpanjangan, sertifikat S-PHL, dan ringkasan re-sertifikasi 2024 telah diverifikasi dari LPVI PT Ayamaru Sertifikasi. Sertifikat SPHL.26/ASERT/LPVI-001-IDN berlaku sampai 27 Desember 2030.
- PT Ruas Utama Jaya: keputusan hasil penilikan ke-1 dan ringkasan publik PBPH tahun 2025 telah diverifikasi. Sertifikat SPHL.64/ASERT/LPVI-001-IDN dinyatakan terpelihara dan berlaku sampai 9 April 2029.
- PT Arara Abadi: keputusan perpanjangan, sertifikat S-PHL, ringkasan re-sertifikasi 2025, dan ringkasan publik PBPH 2025 telah diverifikasi. Sertifikat SPHL.72/ASERT/LPVI-001-IDN berlaku sampai 24 Juli 2031.
- PT Riau Andalan Pulp & Paper: keputusan dan ringkasan hasil re-sertifikasi 2024 telah diverifikasi dari LPVI PT Mutuagung Lestari Tbk. Sertifikat LPVI-008/MUTU/FM-001 berlaku sampai 19 Oktober 2030.
- PT Bukit Batu Hutani Alam: keputusan dan ringkasan hasil re-sertifikasi 2024 telah diverifikasi dari LPVI PT Ayamaru Sertifikasi. Sertifikat SPHL.69/ASERT/LPVI-001-IDN berlaku sampai 24 Oktober 2030.
- PT Nusantara Sentosa Raya: keputusan penilikan ke-3 tahun 2026 telah diverifikasi dari LPVI PT Ayamaru Sertifikasi. Sertifikat SPHL.35/ASERT/LPVI-001-IDN dinyatakan terpelihara dan berlaku sampai 27 Februari 2027.
- CV Tuah Negeri: nomor dan masa berlaku sertifikat diverifikasi melalui register klien aktif LPVI PT Ayamaru Sertifikasi. Sertifikat SPHL.40/ASERT/LPVI-001-IDN berlaku sampai 4 Mei 2029; berkas keputusan audit individual belum ditemukan.
- PT Satria Perkasa Agung (PBPH 77.702 hektar): sertifikat EQC-PHL-004 yang ditemukan berakhir 12 November 2024. Belum ditemukan keputusan perpanjangan untuk areal ini. Unit Serapung dan KTH Sinar Merawang tidak digabung karena memiliki izin dan sertifikat tersendiri.
- PT Perawang Sukses Perkasa Industri: sertifikat EQC-PHL-005 dengan masa berlaku baru telah diverifikasi. Sertifikat berlaku sampai 27 November 2030; ringkasan publik PBPH 2025 juga tersedia.
- PT Sekato Pratama Makmur: sertifikat EQC-PHL-045 terbaru ditautkan pada profil pemasok publik dan berlaku sampai 29 September 2030. Pengumuman audit tahun 2024 digunakan sebagai pemeriksaan silang periode audit.
- PT The Best One Unitimber: keputusan dan ringkasan sertifikasi PHL tahun 2024 telah diverifikasi dari LPVI PT Mutuagung Lestari Tbk. Sertifikat LPVI-008/MUTU/FM-039 berlaku sampai 29 Agustus 2030.
- PT Global Alam Nusantara: keputusan dan ringkasan sertifikasi PHL tahun 2024 telah diverifikasi dari LPVI PT Mutuagung Lestari Tbk. Sertifikat LPVI-008/MUTU/FM-037 berlaku sampai 22 Agustus 2030.
- PT Sinar Mutiara Nusantara: keputusan dan ringkasan sertifikasi PHL tahun 2024 telah diverifikasi dari LPVI PT Mutuagung Lestari Tbk. Sertifikat LPVI-008/MUTU/FM-038 berlaku sampai 26 Agustus 2030.
- PT Suntara Gajapati: register PT Global Resource Sertifikasi menyatakan status aktif untuk periode 19 Januari 2026–18 Januari 2032, tetapi nomor sertifikat baru belum ditampilkan. PDF pada profil pemasok adalah sertifikat lama PT TUV Rheinland Indonesia yang berakhir 18 Januari 2026 dan tidak boleh disajikan sebagai sertifikat aktif.
- PT Peranap Timber: pengumuman audit IFCC Januari 2026 ditemukan, tetapi dokumen tersebut bukan S-PHL nasional. Status S-PHL/SVLK belum disimpulkan sampai dokumen LPVI nasional ditemukan.
- PT Nusa Wana Raya: keputusan, resume, dan sertifikat Penilikan II memverifikasi S-PHL 40-SIC-04.01 sampai 12 Januari 2027. Dokumen LPVI masih memakai SK.1121/2021 dan luas 26.880 hektar; perubahan pada snapshot menjadi Keputusan 842 Tahun 2025 dan luas 25.845 hektar belum ditemukan dalam publikasi LPVI sehingga ditampilkan sebagai catatan ketidaksinkronan.
- PT Bina Duta Laksana: register klien aktif dan paket Penilikan II tahun 2025 memverifikasi sertifikat 026/S-PHPL/GRS/X/2021 sampai 25 Oktober 2027. Legalitas Penilikan II telah memakai SK.984/MENLHK/SETJEN/HPL.0/10/2021 dan luas 25.093 hektar.
- PT National Sago Prima: snapshot mengklasifikasikan kegiatan sebagai pemanfaatan hasil hutan bukan kayu (sagu). Penelusuran belum menemukan S-PHL nasional yang dapat diverifikasi; dokumen korporasi, perkara lingkungan, dan perubahan kepemilikan tidak digunakan sebagai bukti sertifikasi.
- PT Gemilang Cipta Nusantara Unit II/Kabupaten Kepulauan Meranti: keputusan dan ringkasan sertifikasi 2024 memverifikasi sertifikat LPVI-008/MUTU/FM-035, predikat sedang, sampai 15 Agustus 2030. Unit Meranti dipisahkan dari unit Pelalawan.
- PT Nur Mutiara Riau: snapshot memuat izin jasa lingkungan tahun 2026 seluas 34.682 hektar. Dokumen pemerintah yang ditemukan hanya mencatat proses working area sebelumnya; salinan keputusan terbaru dan S-PHL belum ditemukan.
- PT Cahaya Permata Indragiri: laporan kinerja pemerintah mencatat SK pemberian 14012200375810004 tanggal 7 Oktober 2024 seluas 29.492 hektar, konsisten dengan snapshot. Laporan ini bukan salinan keputusan Menteri atau peta lampirannya; S-PHL belum ditemukan.
- PT Meranti Foresta Jore: laporan pemerintah 2022 mencatat proses historis seluas 20.723 hektar, sedangkan snapshot memuat izin tahun 2025 seluas 25.248 hektar. Perbedaan tahap dan luas dipertahankan; S-PHL belum ditemukan.
- PT Gemilang Cipta Nusantara Unit I/Kabupaten Pelalawan: keputusan dan ringkasan sertifikasi 2024 memverifikasi sertifikat LPVI-008/MUTU/FM-036, predikat sedang, sampai 20 Agustus 2030. Unit Pelalawan dipisahkan dari unit Kepulauan Meranti.
- PT Bina Daya Bentala: sertifikat PHPL 013.4/EQC-PHPL/VI/2018 yang tersedia berakhir 28 Juni 2023. Label PHPL pada profil pemasok tidak memuat nomor atau masa berlaku pengganti, sehingga status aktif tidak disimpulkan.
- PT Seraya Sumber Lestari: pengumuman re-sertifikasi resmi Januari 2021 ditemukan, tetapi keputusan hasil audit, nomor sertifikat baru, dan masa berlaku belum ditemukan. Sertifikasi IFCC dipisahkan dari S-PHL nasional.
- PT Rimba Lazuardi: pengumuman penilikan resmi 2024 memverifikasi kepemilikan sertifikat 034.4/EQC-PHPL/III/2021 untuk PBPH di Hutan Produksi, berlaku sampai 2 Maret 2027. Keputusan hasil penilikan individual belum ditemukan.
- PT Balai Kayang Mandiri: sertifikat baru 23-PHL-024 memverifikasi predikat baik untuk SK.772/MENLHK/SETJEN/HPL.0.7/2022 seluas 16.514 hektar, berlaku sampai 1 Agustus 2031.
- PT Artelindo Wiratama: register PT Inti Multima Sertifikasi mencantumkan sertifikat IMS-SPHL-027 berstatus aktif, tetapi tidak menampilkan tanggal terbit atau masa berlaku. Status belum dinaikkan menjadi S-PHL terverifikasi penuh sampai informasi masa berlaku atau keputusan audit ditemukan.
- PT Bina Daya Bintara: pengumuman penilikan resmi November 2025 memverifikasi kepemilikan sertifikat EQC-PHL-035 yang berlaku sampai 11 Maret 2027. Keputusan hasil penilikan individual belum ditemukan.
- PT Bukit Batabuh Sei Indah: laporan re-sertifikasi IFCC memverifikasi identitas SK.811/2021 dan luas 13.420 hektar serta sertifikat IFCC sampai 30 Juni 2026. IFCC adalah skema berbeda dan tidak digunakan sebagai bukti S-PHL nasional; S-PHL nasional belum ditemukan.
- PT Citra Sumber Sejahtera Sejati: pengumuman penilikan resmi November 2025 memverifikasi kepemilikan sertifikat EQC-PHL-027 yang berlaku sampai 18 Januari 2027. Keputusan hasil penilikan individual belum ditemukan.
- PT Harapanjaya Makmur Lestari: keputusan perpanjangan dan sertifikat memverifikasi S-PHL SPHL.47/ASERT/LPVI-001-IDN untuk SK.807/2021 seluas 5.086,44 hektar, berlaku sampai 3 Januari 2030.
- PT Madukoro Lestari: keputusan perpanjangan, sertifikat, dan ringkasan hasil re-sertifikasi memverifikasi S-PHL SPHL.45/ASERT/LPVI-001-IDN untuk SK.835/2021 seluas 14.900,70 hektar, berlaku sampai 3 Desember 2029.
- PT Hijau Bakau Sentosa: laporan pemerintah 2024 hanya mencatat tahap konsep SK pemberian dan proses working area. Snapshot terbaru memuat izin tahun 2025 seluas 19.719 hektar untuk jasa lingkungan; salinan keputusan terbaru dan S-PHL belum ditemukan.
- PT Mitra Hutani Jaya: register PT Inti Multima Sertifikasi mencantumkan IMS-SPHPL-008 berstatus aktif tanpa masa berlaku terbaru. Sertifikat publik lama dengan nomor sama berakhir 13 November 2023, sehingga status aktif belum dinyatakan terverifikasi penuh sampai dokumen perpanjangan ditemukan.
- PT Satria Perkasa Agung Unit Serapung: sertifikat EQC-PHL-001 memverifikasi SK.134/2022, predikat baik, dan masa berlaku sampai 24 Oktober 2030. Luas penetapan 11.927,15 hektar pada sertifikat dibedakan dari luas SK 11.830 hektar pada snapshot; Unit Serapung tidak digabung dengan izin utama atau KTH Sinar Merawang.
- PT Putra Riau Perkasa: statistik resmi mencatat SK.953/2021 dan luas 15.640 hektar, sedangkan snapshot spasial memuat 15.673,55 hektar. Salinan keputusan, lampiran peta, dan S-PHL belum ditemukan.
- PT Essa Indah Timber: pengumuman penilikan resmi memverifikasi EQC-PHL-036 sampai 14 Maret 2027. Dokumen audit/statistik masih memakai luas 9.625 hektar, berbeda dari 10.011,78 hektar pada snapshot terbaru; perbedaan dipertahankan sampai dokumen perubahan ditemukan.
- PT Mustika Anugrah Sukses: laporan pemerintah mencatat pemberian PBPH 16082100232240008 pada 2024 dan proses working area. Snapshot memuat luas 15.170 hektar untuk jasa lingkungan dan hasil hutan bukan kayu; salinan keputusan dan S-PHL belum ditemukan.
- PT Ekawana Lestaridharma: laporan IFCC 2025 memverifikasi SK.825/2021 dan luas 10.982,56 hektar, berbeda dari 9.300 hektar pada snapshot. Sertifikat IFCC dalam laporan berlaku sampai 2 Februari 2026, tetapi bukan bukti S-PHL nasional; salinan keputusan terbaru dan S-PHL nasional belum ditemukan.
- PT Mitra Kembang Selaras: pengumuman Penilikan II PHL memverifikasi SK.814/2021 dan luas penetapan 15.028,09 hektar. Karena dokumen hanya berupa rencana audit, hasil dan masa berlaku S-PHL belum dinyatakan terverifikasi; IFCC tetap dipisahkan.
- PT Mitra Taninusa Sejati: statistik resmi memverifikasi SK.826/2021 dan luas 7.480 hektar. Register IFCC aktif merupakan skema berbeda; salinan keputusan, lampiran peta, dan S-PHL nasional belum ditemukan.
- PT Nusa Prima Manunggal: pengumuman Penilikan 2 PHL mencantumkan sertifikat 007/LPVI-007/TRANsTRA untuk SK.1126/2021, tetapi tanpa masa berlaku. Snapshot terbaru memuat keputusan 843 Tahun 2025 dan luas 4.287 hektar; perubahan tersebut menunggu salinan keputusan dan lampiran peta terbaru.
- PT Riau Abadi Lestari: register LPVI memverifikasi S-PHL 26-PHL-024 aktif sampai 3 November 2031. Pengumuman re-sertifikasi memuat luas 15.226,20 hektar, berbeda dari 12.000 hektar pada statistik resmi dan snapshot; perbedaan dipertahankan sampai dokumen penetapan areal terbaru ditemukan.
- PT Riau Indo Agropalma: statistik resmi memverifikasi SK.1128/2021 dan luas 10.114 hektar, konsisten dengan snapshot 10.113,91 hektar. Sertifikat IFCC sampai 27 Februari 2028 dipisahkan dari S-PHL nasional, yang belum ditemukan.
- PT Rimba Mandau Lestari: register LPVI menyatakan SPHL.24/ASERT/LPVI-001-IDN habis masa berlaku pada 14 Oktober 2024. Keputusan Penilikan ke-4 hanya mempertahankan sertifikat sampai tanggal tersebut dan bukti re-sertifikasi baru belum ditemukan.
- PT Rimba Mutiara Permai: SK.715/2021 dan luas 8.030 hektar konsisten pada statistik resmi, snapshot, dan laporan IFCC. Sertifikat IFCC dalam laporan berakhir 2 Februari 2026, sementara register IFCC menandai aktif tanpa dokumen pengganti; S-PHL nasional belum ditemukan.
- CV Alam Lestari: hasil penilikan ke-1 tahun 2025 menyatakan sertifikat SPHL.43/ASERT/LPVI-001-IDN terpelihara dan berlanjut sampai 14 November 2029. Nomor SK dan luas 4.868,65 hektar konsisten dengan snapshot.
- CV Bhakti Praja Mulia: keputusan Penilikan ke-1 tahun 2025 mempertahankan sertifikat LPVI-008/MUTU/FM-028 sampai 17 Desember 2029. Nomor SK dan luas 5.868,99 hektar konsisten dengan snapshot.
- CV Mutiara Lestari: keputusan Penilikan ke-1 tahun 2025 memverifikasi sertifikat SPHL.46/ASERT/LPVI-001-IDN sampai 26 Desember 2029. Nomor SK dan luas 4.000 hektar konsisten dengan snapshot.
- CV Putri Lindung Bulan: keputusan Penilikan ke-1 tahun 2025 memverifikasi sertifikat SPHL.44/ASERT/LPVI-001-IDN sampai 23 November 2029. Nomor SK dan luas 2.085,54 hektar konsisten dengan snapshot.

Untuk profil yang telah ditelusuri, salinan keputusan PBPH beserta lampiran petanya belum ditemukan sebagai berkas publik tersendiri. Dokumen PHL/SVLK tidak boleh dipindahkan ke kategori SK PBPH.
