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
