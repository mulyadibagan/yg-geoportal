# Usulan tambahan dari koreksi tim

Modul analisis internal mempertahankan kandidat awal, semua koreksi tim, penanda
buah, dan data sensus. `block_suggestions` pada manifest privat menunjuk berkas
usulan tambahan per blok. Berkas harus terdaftar pada `files`, memakai run/blok
dan jalur analisis aktif yang sama, serta mencatat semua potongan selesai.

Pada peta kerja, tanda **+ biru kehijauan** adalah usulan yang belum dihitung.
Pilih **Periksa usulan berikutnya** atau klik tandanya. Setelah TIFF asli siap,
**Terima usulan nanas** menambah satu titik kerja melalui penyimpanan koreksi
privat yang sudah ada. **Tolak usulan** menyimpan keputusan tanpa menambah jumlah
tanaman dan tanpa menganggap penolakan tersebut sebagai label “bukan nanas”.
Jumlah usulan yang belum diperiksa tersedia untuk blok dan gawangan terpilih.

ID usulan berdasarkan piksel sumber, dengan awalan titik manual yang sudah
didukung layanan. Versi per titik mencegah dua laptop menerima usulan yang sama
dua kali. Penanda yang sudah dihapus tetap dikenali melalui versi/tombstone.
Usulan dekat titik atau penolakan tim disembunyikan kembali setelah sinkronisasi.
Autosave, pesan perubahan lokal, konflik, dan pemulihan tetap memakai editor
titik yang sama. Pengujian penerimaan/penolakan dilakukan pada fixture memori;
verifikasi produksi hanya membaca dan memilih titik.

`scripts/retrain_dayun_suggestions.py` memakai mesin radial serta deskriptor
geometri/warna relatif yang sudah ada. Contoh positif diterima tim dipisahkan
menurut sel spasial dengan penyangga 4 meter. Lokasi uji dan penyangga tidak
memilih skala, bobot, atau ambang. D yang dilaporkan belum ditanami menjadi
pembanding latihan; E/F terpisah menjadi pembanding evaluasi. Penolakan tanpa
alasan spesies tidak menjadi label gulma. Data sensus tidak menjadi fitur atau
target. Semua snapshot label, model, pratinjau dan hasil berada dalam area privat.

Runner menerima `train` atau `infer`, direktori snapshot `--root`, keluaran
potongan mesin yang sudah ada melalui `--native`, dan cache sumber terverifikasi
`--cache`. Latihan memerlukan daftar JSON privat `--control-history` agar lokasi
uji lama tidak dipakai ulang sebagai uji baru. Gunakan direktori run baru untuk
snapshot baru; cache dengan label, riwayat pembanding, model, atau sumber berbeda
ditolak. Sumber dan kode beku yang menghasilkan publikasi disimpan bersama
provenance privat, bukan sebagai label/kredensial dalam repository.

Pencarian pusat dilakukan pada pengurangan resolusi dua kali, kemudian dinilai
lagi pada potongan asli dengan ukuran fisik tetap. Potongan asli digabung pada
sambungan internal; konteks di luar kumpulan potongan yang tidak tersedia tetap
invalid. Tanaman kecil, tertutup, pucat, dan tanaman di tepi dapat terlewat.
Pemulihan lokasi positif dan penolakan pembanding negatif adalah pengukuran
terpisah, bukan presisi seluruh A–C, recall populasi, atau jumlah terverifikasi.
Contoh positif masih berasal dari A; penerapan ke B/C memerlukan konfirmasi tim.

Publikasi hanya menambahkan berkas versi baru dan `block_suggestions` pada
manifest privat. Jalur kandidat awal dan anchor riwayat koreksi tidak diganti.
Berkas diunduh kembali dan SHA-256 dibandingkan sebelum aktivasi; head koreksi
diperiksa setelahnya tanpa menulis ulang revisi pengguna. Akses tetap mengikuti
otorisasi staf dari modul analisis yang sudah ada.
