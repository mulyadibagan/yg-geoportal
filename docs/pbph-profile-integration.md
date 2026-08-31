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

Untuk profil yang telah ditelusuri, salinan keputusan PBPH beserta lampiran petanya belum ditemukan sebagai berkas publik tersendiri. Dokumen PHL/SVLK tidak boleh dipindahkan ke kategori SK PBPH.
