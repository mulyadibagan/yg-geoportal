(() => {
  "use strict";

  const STORAGE_KEY = "yg-language";
  const dictionaries = {
    en: {
      "Peta Program Yayasan Gambut": "Yayasan Gambut Programme Map",
      "Restorasi gambut, mangrove, pencegahan kebakaran, infrastruktur pesisir, dan livelihood.": "Peatland and mangrove restoration, fire prevention, coastal infrastructure, and sustainable livelihoods.",
      "Cari lokasi": "Search locations",
      "desa atau kegiatan": "villages or activities",
      "Dashboard": "Dashboard",
      "Desa terdata": "Mapped villages",
      "Area mangrove": "Mangrove area",
      "Lokasi FDRS": "FDRS locations",
      "Sekat kanal": "Canal blocks",
      "Layer data": "Data layers",
      "aktif/nonaktif": "show/hide",
      "Legenda": "Legend",
      "Kontrol peta": "Map controls",
      "Tampilkan semua": "Show all",
      "Lokasi saya": "My location",
      "Reset tampilan": "Reset view",
      "Panel": "Panel",
      "Fullscreen": "Fullscreen",
      "PROGRAM & LAPORAN YG": "YG PROGRAMMES & REPORTS",
      "DATA REFERENSI": "REFERENCE DATA",
      "BATAS ADMINISTRASI": "ADMINISTRATIVE BOUNDARIES",
      "Hasil Monitoring Terverifikasi": "Verified Monitoring Results",
      "Kontribusi Kami terhadap SDGs": "Our Contribution to the SDGs",
      "Semua kegiatan kami dirancang untuk mendukung pencapaian Tujuan Pembangunan Berkelanjutan.": "All our activities are designed to support the achievement of the Sustainable Development Goals.",
      "Tanpa Kemiskinan": "No Poverty",
      "Peningkatan pendapatan melalui agroforestri kopi Liberika.": "Increasing income through Liberica coffee agroforestry.",
      "Pengembangan mata pencaharian alternatif berbasis sumber daya lokal.": "Developing alternative livelihoods based on local resources.",
      "Menciptakan lapangan kerja hijau (restorasi, pembibitan, pemantauan).": "Creating green jobs (restoration, nursery, monitoring).",
      "Tanpa Kelaparan": "Zero Hunger",
      "Mendukung ketahanan pangan melalui kebun kopi dan tanaman tumpang sari.": "Supporting food security through coffee plantations and intercropping.",
      "Pelatihan pertanian berkelanjutan tanpa bakar.": "Training on sustainable, no-burn agriculture.",
      "Diversifikasi sumber pangan dan gizi keluarga.": "Diversifying family food and nutrition sources.",
      "Kesetaraan Gender": "Gender Equality",
      "Mendorong partisipasi perempuan dalam pengambilan keputusan di tingkat desa.": "Promoting women's participation in village-level decision-making.",
      "Mendukung kewirausahaan perempuan melalui kelompok tani kopi Liberika.": "Supporting women's entrepreneurship through Liberica coffee farmer groups.",
      "Memastikan keterlibatan perempuan dalam semua sesi pelatihan dan kegiatan.": "Ensuring women's involvement in all training sessions and activities.",
      "Air Bersih dan Sanitasi Layak": "Clean Water and Sanitation",
      "Menjaga kualitas air melalui restorasi ekosistem gambut.": "Maintaining water quality through peatland ecosystem restoration.",
      "Membangun sekat kanal untuk menaikkan muka air tanah.": "Constructing canal blocks to raise the water table.",
      "Pemasangan unit FDRS untuk pemantauan tinggi muka air.": "Installing FDRS units for water table monitoring.",
      "Pekerjaan Layak dan Pertumbuhan Ekonomi": "Decent Work and Economic Growth",
      "Menciptakan green jobs di tingkat desa (pembibitan, penanaman, pemantauan).": "Creating green jobs at the village level (nursery, planting, monitoring).",
      "Mendukung wirausaha perempuan melalui kelompok tani kopi.": "Supporting women entrepreneurship through coffee farmer groups.",
      "Membangun kemitraan pasar untuk produk kopi Liberika.": "Building market partnerships for Liberica coffee products.",
      "Kota dan Permukiman Berkelanjutan": "Sustainable Cities and Communities",
      "Pembangunan hybrid engineering (APO) untuk melindungi garis pantai dan permukiman.": "Constructing hybrid engineering (wave breakers) to protect coastlines and settlements.",
      "Pemasangan sistem peringatan dini kebakaran (FDRS).": "Installing Fire Danger Rating Systems (FDRS) as an early warning system.",
      "Peningkatan kapasitas masyarakat dalam pencegahan kebakaran lahan.": "Building community capacity in land fire prevention.",
      "Penanganan Perubahan Iklim": "Climate Action",
      "Menyerap dan menyimpan karbon melalui restorasi hutan mangrove.": "Sequestering and storing carbon through mangrove forest restoration.",
      "Mengurangi emisi gas rumah kaca dengan mencegah dekomposisi gambut melalui pembasahan kembali (rewetting).": "Reducing greenhouse gas emissions by preventing peat decomposition through rewetting.",
      "Mempromosikan pertanian tanpa bakar.": "Promoting no-burn agriculture.",
      "Ekosistem Lautan": "Life Below Water",
      "Restorasi habitat pesisir melalui penanaman mangrove.": "Restoring coastal habitats through mangrove planting.",
      "Melindungi biodiversitas laut dengan mengurangi abrasi melalui APO.": "Protecting marine biodiversity by reducing erosion with wave breakers (APO).",
      "Peningkatan kesadaran masyarakat tentang pentingnya ekosistem mangrove.": "Raising community awareness on the importance of mangrove ecosystems.",
      "Ekosistem Daratan": "Life on Land",
      "Restorasi ekosistem gambut hidrologis melalui pembangunan sekat kanal.": "Restoring peatland hydrological ecosystems through canal blocking.",
      "Rehabilitasi lahan dengan penanaman pohon hutan dan MPTS.": "Rehabilitating land by planting forest trees and MPTS.",
      "Perlindungan keanekaragaman hayati di Hutan Adat Imbo Putui.": "Protecting biodiversity in the Imbo Putui Customary Forest.",
      "Kemitraan untuk Mencapai Tujuan": "Partnerships for the Goals",
      "Kemitraan dengan donor internasional (Aramco, PPCF, GEC).": "Partnerships with international donors (Aramco, PPCF, GEC).",
      "Kolaborasi dengan pemerintah daerah (kabupaten dan desa).": "Collaboration with local governments (regency and village).",
      "Pemberdayaan kelompok masyarakat dan lembaga adat lokal.": "Empowering community groups and local customary institutions.",
      "Laporan Masyarakat Terverifikasi": "Verified Community Reports",
      "Area Penanaman Mangrove": "Mangrove Planting Areas",
      "Restorasi Hutan & Lahan": "Forest & Land Restoration",
      "Rumah Pembibitan Mangrove": "Mangrove Nurseries",
      "Rumah Pembibitan Kopi": "Coffee Nurseries",
      "Plang Informasi & Perlindungan": "Information & Protection Signage",
      "Infrastruktur Pendukung": "Supporting Infrastructure",
      "Alat Pemecah Ombak (APO)": "Wave Attenuation Structures",
      "Distribusi Lahan Kopi": "Coffee Cultivation Areas",
      "FDRS / Water Table": "FDRS / Water Table",
      "Sekat Kanal": "Canal Blocks",
      "Titik Desa Intervensi": "Programme Villages",
      "Kawasan Hutan SK 903": "Forest Estate - Decree 903",
      "Peta Gambut BBSDLP 2019": "BBSDLP Peat Map 2019",
      "Batas Desa Intervensi": "Programme Village Boundaries",
      "Jenis laporan": "Report type",
      "Tanggal": "Date",
      "Lokasi": "Location",
      "Judul": "Title",
      "Deskripsi": "Description",
      "Pelapor/kelompok": "Reporter/group",
      "Jenis monitoring": "Monitoring type",
      "Kondisi": "Condition",
      "Survival": "Survival",
      "Hidup": "Alive",
      "Mati/rusak": "Dead/damaged",
      "Luas terpantau": "Monitored area",
      "Tinggi rata-rata": "Average height",
      "Diameter rata-rata": "Average diameter",
      "Sedimentasi": "Sedimentation",
      "Water table": "Water table",
      "Temuan": "Findings",
      "Tindak lanjut": "Follow-up",
      "Kabupaten": "Regency",
      "Kecamatan": "District",
      "Desa": "Village",
      "Tahun": "Year",
      "Nama objek": "Object name",
      "Kategori": "Category",
      "Jenis laporan": "Report type",
      "Titik Baru": "New Location",
      "Buka Foto": "Open Photo",
      "Kirim Monitoring": "Submit Monitoring",
      "Kirim Monitoring Lagi": "Submit Another Monitoring",
      "Beranda": "Home",
      "Peta Interaktif": "Interactive Map",
      "Laporkan Temuan": "Report a Finding",
      "Kirim Laporan": "Submit Report",
      "Monitoring": "Monitoring",
      "Dashboard Monitoring": "Monitoring Dashboard",
      "Jelajahi Peta": "Explore the Map",
      "🗺️ Jelajahi Peta": "🗺️ Explore the Map",
      "Buka Peta": "Open Map",
      "Pasang Aplikasi": "Install App",
      "📲 Pasang Aplikasi": "📲 Install App",
      "PLATFORM DATA SPASIAL RESMI YAYASAN GAMBUT": "OFFICIAL SPATIAL DATA PLATFORM OF YAYASAN GAMBUT",
      "Platform Data Spasial Yayasan Gambut": "Yayasan Gambut Spatial Data Platform",
      "Menyajikan informasi spasial yang terverifikasi untuk mendukung pengelolaan lahan basah, gambut, mangrove, dan ekosistem lainnya secara berkelanjutan melalui restorasi, rehabilitasi, pemantauan lapangan, pemberdayaan masyarakat, serta kemitraan strategis yang berbasis data.": "Providing verified spatial information to support the sustainable management of wetlands, peatlands, mangroves, and other ecosystems through restoration, rehabilitation, field monitoring, community empowerment, and data-driven strategic partnerships.",
      "Menghubungkan data spasial, pemantauan lapangan, dan pelaporan masyarakat dalam satu platform untuk mendukung pengelolaan lahan basah dan ekosistem yang berkelanjutan.": "Connecting spatial data, field monitoring, and community reporting in one platform to support sustainable wetland and ecosystem management.",
      "Kabupaten Cakupan": "Regencies Covered",
      "Desa Cakupan": "Villages Covered",
      "Luas Restorasi (ha)": "Restoration Area (ha)",
      "Bibit Tertanam": "Seedlings Planted",
      "Desa Dampingan": "Partner Villages",
      "Luas Restorasi Mangrove": "Mangrove Restoration Area",
      "Program Yayasan Gambut": "Yayasan Gambut Programmes",
      "Capaian Program": "Programme Achievements",
      "Mitra Pendanaan": "Funding Partners",
      "MITRA PENDANAAN": "FUNDING PARTNER",
      "Wilayah Cakupan Program": "Programme Coverage Areas",
      "Restorasi Mangrove": "Mangrove Restoration",
      "Restorasi Gambut": "Peatland Restoration",
      "Restorasi Lahan Mineral": "Mineral Land Restoration",
      "Peningkatan Kapasitas": "Capacity Building",
      "Luas Restorasi": "Restoration Area",
      "Pohon Mangrove Ditanam": "Mangrove Trees Planted",
      "Rumah Bibit": "Nurseries",
      "Hybrid Engineering": "Hybrid Engineering",
      "Desa Program": "Programme Villages",
      "Luas Gambut / Agroforestri": "Peatland / Agroforestry Area",
      "Bibit Pohon Hutan & MPTS": "Forest & MPTS Seedlings",
      "Estimasi Area Rewetting": "Estimated Rewetting Area",
      "Infrastruktur Pencegahan Kebakaran": "Fire Prevention Infrastructure",
      "Menara Air": "Water Towers",
      "Plang Restorasi": "Restoration Signage",
      "Plot Ukur Permanen": "Permanent Sample Plots",
      "Pelatihan": "Training Sessions",
      "Peserta": "Participants",
      "Total Peserta": "Total Participants",
      "Estimasi Rewetting (ha)": "Estimated Rewetting (ha)",
      "Luas Revegetasi (ha)": "Revegetation Area (ha)",
      "Mangrove · gambut/agroforestri · lahan mineral": "Mangrove · peat/agroforestry · mineral land",
      "Desa Terlibat": "Villages Involved",
      "Kelompok Masyarakat Didampingi": "Supported Community Groups",
      "Data belum tersedia": "Data not yet available",
      "Agroforestri & Kopi Liberika": "Agroforestry & Liberica Coffee",
      "Pencegahan Kebakaran": "Fire Prevention",
      "Monitoring Lapangan": "Field Monitoring",
      "Laporan Masyarakat": "Community Reports",
      "Belum ada data": "No data available",
      "Sekarang": "Present",
      "Pematang Duku · lihat ringkasan program": "Pematang Duku · view programme summary",
      "Desa Pematang Duku, Kabupaten Bengkalis": "Pematang Duku Village, Bengkalis Regency",
      "Data spasial untuk transparansi, pembelajaran, dan kolaborasi.": "Spatial data for transparency, learning, and collaboration.",
      "Periode Program": "Programme Period",
      "Wilayah Program": "Programme Area",
      "Ringkasan Dampak": "Impact Summary",
      "Ringkasan dampak": "Impact summary",
      "Capaian program Aramco": "Aramco programme achievements",
      "Klik indikator untuk memfilter data dan menuju lokasi terkait.": "Select an indicator to filter the data and open the related location.",
      "Pohon Mangrove Ditanam": "Mangrove Trees Planted",
      "Desa Program": "Programme Villages",
      "Rumah Bibit Mangrove": "Mangrove Nurseries",
      "Peserta Kegiatan": "Activity Participants",
      "Fase 1": "Phase 1",
      "Fase 2": "Phase 2",
      "Fase 3": "Phase 3",
      "1 Rumah Bibit": "1 Nursery",
      "2 Rumah Bibit": "2 Nurseries",
      "4 Rumah Bibit (akumulasi)": "4 Nurseries (cumulative)",
      "Pelatihan dan monitoring lapangan": "Community training and field monitoring",
      "Pengembangan mata pencaharian masyarakat": "Community livelihood development",
      "Ringkasan Output Proyek": "Project Output Summary",
      "Ringkasan capaian": "Achievement summary",
      "Imbo Putui · lihat ringkasan program": "Imbo Putui · view programme summary",
      "Restorasi Hutan Adat Imbo Putui": "Imbo Putui Customary Forest Restoration",
      "Desa Petapahan, Kecamatan Tapung, Kabupaten Kampar": "Petapahan Village, Tapung District, Kampar Regency",
      "Area Restorasi": "Restoration Area",
      "Bibit Ditanam": "Seedlings Planted",
      "Menara Air": "Water Tower",
      "Plang Restorasi": "Restoration Signage",
      "Pemantauan lapangan": "Field monitoring",
      "Hasil Monitoring": "Monitoring Results",
      "Monitoring I": "Monitoring I",
      "Monitoring II": "Monitoring II",
      "Penyulaman": "Replanting",
      "Penilaian awal pertumbuhan dan keberhasilan tanaman di area restorasi.": "Initial assessment of plant growth and survival in the restoration area.",
      "PUP 1: 98,07% hidup": "PUP 1: 98.07% survival",
      "PUP 2: 84,61% hidup": "PUP 2: 84.61% survival",
      "Penyulaman dilakukan pada PUP 1 untuk mengganti tanaman yang tidak bertahan.": "Replanting was conducted in PUP 1 to replace seedlings that did not survive.",
      "Keberhasilan penyulaman: 100%": "Replanting success: 100%",
      "Pemantauan lanjutan untuk melihat perkembangan tanaman dan kebutuhan tindak lanjut.": "Follow-up monitoring to assess plant development and required actions.",
      "Terhubung dengan objek restorasi di WebGIS": "Connected to the restoration object in WebGIS",
      "Output proyek PPCF": "PPCF project outputs",
      "Bengkalis & Siak · lihat ringkasan program": "Bengkalis & Siak · view programme summary",
      "Kabupaten Bengkalis • Kabupaten Siak": "Bengkalis Regency • Siak Regency",
      "Program Pengelolaan Gambut Berkelanjutan": "Sustainable Peatland Management Programme",
      "FDRS Terlaporkan": "Reported FDRS Units",
      "Bibit Kopi Ditanam": "Coffee Seedlings Planted",
      "Panduan Budidaya Kopi Liberika": "Liberica Coffee Cultivation Guide",
      "Infrastruktur historis": "Historical infrastructure",
      "Fase program": "Programme phase",
      "Sekat kanal tercatat di GIS sejak 2021": "Canal blocks have been recorded in the GIS since 2021",
      "Penguatan pembasahan gambut berbasis masyarakat": "Community-based peatland rewetting",
      "Perluasan infrastruktur ke Temiang dan Sepahat": "Infrastructure expansion to Temiang and Sepahat",
      "2.000 bibit kopi Liberika ditanam": "2,000 Liberica coffee seedlings planted",
      "22 peserta pelatihan pembibitan kopi": "22 coffee nursery training participants",
      "2 sekat kanal dibangun": "2 canal blocks constructed",
      "2 FDRS dipasang": "2 FDRS units installed",
      "1.400 bibit kopi Liberika ditanam": "1,400 Liberica coffee seedlings planted",
      "2.000 bibit dikembangkan di persemaian": "2,000 seedlings raised in the nursery",
      "50 peserta pelatihan pemeliharaan kopi": "50 coffee maintenance training participants",
      "1 sekat kanal dan 1 buku panduan": "1 canal block and 1 cultivation guide",
      "Pilih lokasi untuk melihat titik FDRS yang tercantum dalam laporan program 2024.": "Select a location to view an FDRS point listed in the 2024 programme report.",
      "Penanaman Kopi Liberika": "Liberica Coffee Planting",
      "Pilih lokasi untuk melihat data lapangan penanaman kopi.": "Select a location to view coffee planting field data.",
      "1.700 bibit": "1,700 seedlings",
      "1.100 bibit": "1,100 seedlings",
      "600 bibit": "600 seedlings",
      "Pelatihan Program GEC": "GEC Programme Training",
      "22 peserta": "22 participants",
      "50 peserta": "50 participants",
      "Pelatihan pembibitan kopi Liberika · Temiang · 28 Oktober 2024": "Liberica coffee nursery training · Temiang · 28 October 2024",
      "Pelatihan pemeliharaan dan panen kopi Liberika · Temiang · 29 Oktober 2025": "Liberica coffee maintenance and harvesting training · Temiang · 29 October 2025",
      "Klik indikator untuk melihat lokasi atau informasi pendukung.": "Select an indicator to view its location or supporting information.",
      "Periode": "Period",
      "Lokasi Program": "Programme Location",
      "Restorasi Gambut & Agroforestri": "Peatland Restoration & Agroforestry",
      "Bibit Ditanam": "Seedlings Planted",
      "Bibit di Persemaian": "Seedlings in Nursery",
      "Peserta Pelatihan": "Training Participants",
      "Kemitraan Pasar Kopi": "Coffee Market Partnership",
      "Buku Panduan": "Guidance Book",
      "Timeline Program": "Programme Timeline",
      "Perjalanan program": "Programme journey",
      "Kirim Laporan Lapangan": "Submit a Field Report",
      "Jenis laporan menentukan data dan bentuk lokasi yang harus diisi. Laporan akan diverifikasi oleh Yayasan Gambut sebelum dipublikasikan.": "The report type determines the required data and location format. Yayasan Gambut will verify each report before publication.",
      "Proses verifikasi": "Verification process",
      "Data, lokasi, geometri, dan foto diperiksa terlebih dahulu sebelum muncul di WebGIS.": "Data, location, geometry, and photos are reviewed before appearing in the WebGIS.",
      "Pilih jenis laporan untuk menampilkan isian yang sesuai.": "Select a report type to display the appropriate fields.",
      "1. Pilih jenis laporan": "1. Select report type",
      "2. Informasi pelapor": "2. Reporter information",
      "3. Administrasi lokasi": "3. Location administration",
      "4. Tentukan lokasi": "4. Set the location",
      "5. Detail laporan": "5. Report details",
      "6. Dokumentasi foto": "6. Photo documentation",
      "Tambah Foto": "Add Photos",
      "Perbaikan Informasi": "Correct Information",
      "Area Baru": "New Area",
      "Replanting": "Replanting",
      "Kebakaran": "Fire Incident",
      "Abrasi": "Coastal Erosion",
      "Biodiversitas": "Biodiversity",
      "Nama lengkap *": "Full name *",
      "Instansi atau kelompok": "Organisation or group",
      "Nomor HP/WhatsApp": "Phone/WhatsApp number",
      "Provinsi": "Province",
      "Kabupaten/Kota": "Regency/City",
      "Desa/Kelurahan": "Village/Subdistrict",
      "Nama lokasi atau objek": "Location or object name",
      "Ambil Lokasi Saya": "Use My Location",
      "Mulai Gambar Poligon": "Start Drawing Polygon",
      "Hapus Gambar": "Clear Drawing",
      "Belum ada file spasial dipilih.": "No spatial file selected.",
      "Hapus File": "Remove File",
      "Terapkan Koordinat": "Apply Coordinates",
      "Gunakan titik desimal, bukan pemisah ribuan.": "Use decimal points, not thousands separators.",
      "Belum ada geometri dipilih.": "No geometry selected.",
      "Judul laporan *": "Report title *",
      "Tanggal kegiatan": "Activity date",
      "Deskripsi *": "Description *",
      "Informasi mitra pendanaan": "Funding partner information",
      "Pilih nama yang tersedia atau ketik nama donor baru. Wajib diisi agar objek dapat dikelompokkan setelah dipublikasikan.": "Select an available name or type a new funding partner. This is required so the object can be grouped after publication.",
      "Mitra pendanaan/donor *": "Funding partner/donor *",
      "Pilih data WebGIS": "Select WebGIS data",
      "Pilih/Ganti Objek di Peta": "Select/Change Object on Map",
      "Muat layer yang dipilih saja": "Load selected layer only",
      "Data monitoring objek": "Object monitoring data",
      "Kondisi umum *": "Overall condition *",
      "Jumlah hidup": "Alive count",
      "Jumlah mati/rusak": "Dead/damaged count",
      "Luas terpantau (ha)": "Monitored area (ha)",
      "Tinggi rata-rata (cm)": "Average height (cm)",
      "Diameter batang rata-rata (cm)": "Average stem diameter (cm)",
      "Sedimentasi (cm)": "Sedimentation (cm)",
      "Temuan monitoring *": "Monitoring findings *",
      "Rekomendasi/tindak lanjut": "Recommendations/follow-up",
      "Dokumentasi foto": "Photo documentation",
      "Pilih Foto": "Choose Photos",
      "Laporan berhasil dikirim.": "Report submitted successfully.",
      "Menunggu Verifikasi": "Pending Verification",
      "Kirim laporan lain": "Submit another report",
      "DATA TERVERIFIKASI": "VERIFIED DATA",
      "Monitoring Program Yayasan Gambut": "Yayasan Gambut Programme Monitoring",
      "Ringkasan monitoring mangrove, gambut, FDRS, sekat kanal, APO, pembibitan, dan kegiatan lapangan lainnya.": "A summary of mangrove, peatland, FDRS, canal block, wave attenuation, nursery, and other field monitoring activities.",
      "Total monitoring": "Total monitoring records",
      "hasil terverifikasi": "verified results",
      "Objek dipantau": "Objects monitored",
      "lokasi/objek unik": "unique locations/objects",
      "Perlu tindak lanjut": "Follow-up required",
      "status waspada/permasalah": "alerts/issues",
      "Monitoring terbaru": "Latest monitoring",
      "tanggal kegiatan terbaru": "latest activity date",
      "Cari": "Search",
      "Semua jenis": "All types",
      "Semua kondisi": "All conditions",
      "Semua tahun": "All years",
      "Semua kabupaten": "All regencies",
      "Unduh Monitoring": "Download Monitoring Data",
      "Urutkan": "Sort",
      "Terbaru": "Newest",
      "Terlama": "Oldest",
      "Nama A-Z": "Name A-Z",
      "Lokasi monitoring": "Monitoring locations",
      "PRIORITAS": "PRIORITY",
      "Belum ada data.": "No data available.",
      "Ringkasan": "Overview",
      "Riwayat": "History",
      "Foto": "Photos",
      "Sangat Baik": "Very Good",
      "Baik": "Good",
      "Sedang": "Fair",
      "Perlu dipantau": "Needs Monitoring",
      "RINGKASAN PER OBJEK": "SUMMARY BY OBJECT",
      "Standar FDRS YG": "YG FDRS Standard",
      "Nama lokasi": "Location name",
      "Prioritas tindak lanjut": "Follow-up priority",
      "Semua": "All",
      "Penanaman Mangrove": "Mangrove Planting",
      "Hidup/berfungsi": "Alive/operational",
      "Lihat perkembangan →": "View progress →",
      "Baik/normal": "Good/normal",
      "FDRS menggunakan water table pelampung. Nilai muka air dicatat saat kunjungan dan status dihitung otomatis.": "FDRS uses a float water-table gauge. Water levels are recorded during each visit and the status is calculated automatically.",
      "ID objek": "Object ID",
      "Lihat perkembangan": "View progress",
      "kali monitoring": "monitoring visits",
      "Terakhir": "Latest",
      "Tutup": "Close",
      "Objek tidak ditemukan.": "No matching object found.",
      "Menghubungkan ke Master Database…": "Connecting to the Master Database…",
      "Memuat layer dari database…": "Loading layers from the database…",
      "Menyiapkan legenda…": "Preparing legend…",
      "Mengambil objek dari Master Database…": "Retrieving objects from the Master Database…"
    },
    id: {}
  };
  if (dictionaries.en) dictionaries.en["Cetak Peta"] = "Print Map";
  const reverse = Object.fromEntries(
    Object.entries(dictionaries.en).map(([id, en]) => [en, id])
  );

  let currentLanguage = localStorage.getItem(STORAGE_KEY) === "en" ? "en" : "id";
  let translating = false;

  function translateDynamic(text, language) {
    if (language === "en") {
      return text
        .replace(/^Sumber: Master Database/, "Source: Master Database")
        .replace(/layer resmi WebGIS/g, "official WebGIS layers")
        .replace(/diperbarui/g, "updated")
        .replace(/ objek · diperbarui /, " objects · updated ")
        .replace(/^Layer berhasil dimuat/, "Layers loaded")
        .replace(/ pembaruan publik diterapkan$/, " public updates applied")
        .replace(/^Mengambil objek dari Master Database/, "Retrieving objects from the Master Database")
        .replace(/ objek dari Master Database berhasil dimuat$/, " objects loaded from the Master Database")
        .replace(/^ID objek:\s*/, "Object ID: ")
        .replace(/^Terakhir\s+/, "Latest ")
        .replace(/\s+kali monitoring$/, " monitoring visits")
        .replace(/\s+riwayat$/, " records")
        .replace(/^Perlu dipantau\s+·\s+/, "Needs monitoring · ")
        .replace(/^(\d{4})[–-]Sekarang$/, "$1–Present")
        .replace(/^(\d+)\s+desa\s*\u00b7\s*lihat ringkasan program$/, "$1 villages · view programme summary")
        .replace(/^Pematang Duku\s*\u00b7\s*lihat ringkasan program$/, "Pematang Duku · view programme summary")
        .replace(/^(\d+)\s+program$/, (_, count) => count + (count === "1" ? " programme" : " programmes"))
        .replace(/^(\d[\d.]*)\s+pohon$/, "$1 trees")
        .replace(/^Target\s+(\d[\d.]*)\s+pohon$/, "Target: $1 trees")
        .replace(/Wave Breaker \(akumulasi\)$/, "Wave Breaker (cumulative)")
        .replace(/^(\d+) objek$/, "$1 objects")
        .replace(/^Penanaman Mangrove \((\d+)\)$/, "Mangrove Planting ($1)")
        .replace(/^PENANAMAN MANGROVE$/, "MANGROVE PLANTING")
        .replace(/^(\d+) objek terpetakan$/, "$1 mapped objects");
    }
    return text
      .replace(/^Source: Master Database/, "Sumber: Master Database")
      .replace(/official WebGIS layers/g, "layer resmi WebGIS")
      .replace(/updated/g, "diperbarui")
      .replace(/ objects · updated /g, " objek · diperbarui ");
  }

  function translateElement(element) {
    if (!element || translating) return;
    translating = true;
    const dictionary = dictionaries[currentLanguage] || {};
    const walker = document.createTreeWalker(element, Node.TEXT_NODE);
    let node;
    while ((node = walker.nextNode())) {
      const text = node.nodeValue.trim();
      if (text && dictionary[text]) {
        node.nodeValue = node.nodeValue.replace(text, dictionary[text]);
      } else if (text && currentLanguage === "id" && reverse[text]) {
        node.nodeValue = node.nodeValue.replace(text, reverse[text]);
      } else if (text) {
        node.nodeValue = translateDynamic(node.nodeValue, currentLanguage);
      }
    }
    element.querySelectorAll("[placeholder]").forEach(el => {
      const text = el.getAttribute("placeholder").trim();
      if (text && dictionary[text]) {
        el.setAttribute("placeholder", dictionary[text]);
      } else if (text && currentLanguage === "id" && reverse[text]) {
        el.setAttribute("placeholder", reverse[text]);
      }
    });
    translating = false;
  }

  function setLanguage(language) {
    if (language !== "en" && language !== "id") return;
    currentLanguage = language;
    localStorage.setItem(STORAGE_KEY, language);
    document.documentElement.lang = language;
    document.querySelectorAll("[data-lang]").forEach(button => {
      const isPressed = button.dataset.lang === language;
      button.setAttribute("aria-pressed", String(isPressed));
      button.classList.toggle("active", isPressed);
    });
    translateElement(document.body);
  }

  document.addEventListener("click", event => {
    const button = event.target.closest("[data-lang]");
    if (button) setLanguage(button.dataset.lang);
  });

  document.addEventListener("DOMContentLoaded", () => {
    setLanguage(currentLanguage);
    new MutationObserver(() => translateElement(document.body))
      .observe(document.body, { childList: true, subtree: true });
  });

  window.YG_I18N = {
    t: function(text) {
      const dictionary = dictionaries[currentLanguage] || {};
      return dictionary[text] || text;
    },
    setLanguage: setLanguage,
    translateElement: translateElement
  };
})();