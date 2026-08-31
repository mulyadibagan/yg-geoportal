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

Untuk profil yang telah ditelusuri, salinan keputusan PBPH beserta lampiran petanya belum ditemukan sebagai berkas publik tersendiri. Dokumen PHL/SVLK tidak boleh dipindahkan ke kategori SK PBPH.
