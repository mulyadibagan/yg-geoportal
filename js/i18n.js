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
      "Pendidikan Berkualitas": "Quality Education",
      "Pelatihan pembibitan, restorasi, agroforestri, pengolahan kopi, dan pertanian tanpa bakar.": "Training in nurseries, restoration, agroforestry, coffee processing, and no-burn agriculture.",
      "Peningkatan kapasitas kelompok masyarakat dalam pemantauan ekosistem.": "Building the capacity of community groups in ecosystem monitoring.",
      "Penyusunan panduan dan materi pembelajaran berbasis pengalaman lapangan.": "Developing guidance and learning materials based on field experience.",
      "Berkurangnya Kesenjangan": "Reduced Inequalities",
      "Mendorong partisipasi kelompok rentan dan penyandang disabilitas dalam kegiatan lingkungan.": "Promoting the participation of vulnerable groups and persons with disabilities in environmental activities.",
      "Mendukung kepemimpinan inklusif dalam kelompok masyarakat pesisir.": "Supporting inclusive leadership in coastal community groups.",
      "Salah satu kelompok mangrove di Sepahat dipimpin oleh penyandang disabilitas dan berperan aktif dalam pengelolaan restorasi mangrove.": "One mangrove group in Sepahat is led by a person with a disability who plays an active role in managing mangrove restoration.",
      "Konsumsi dan Produksi yang Bertanggung Jawab": "Responsible Consumption and Production",
      "Pengembangan kopi Liberika dan produk lokal melalui praktik produksi berkelanjutan.": "Developing Liberica coffee and local products through sustainable production practices.",
      "Penerapan pertanian tanpa bakar dan agroforestri ramah gambut.": "Applying no-burn agriculture and peat-friendly agroforestry.",
      "Peningkatan pengolahan pascapanen, SOP produksi, kualitas produk, dan pemanfaatan sumber daya lokal secara bertanggung jawab.": "Improving post-harvest processing, production SOPs, product quality, and the responsible use of local resources.",
      "Perdamaian, Keadilan dan Kelembagaan yang Tangguh": "Peace, Justice and Strong Institutions",
      "Penguatan kapasitas KTH, KUPS, kelompok perempuan, dan kelompok pengelola mangrove.": "Strengthening the capacity of KTH, KUPS, women's groups, and mangrove management groups.",
      "Mendukung penyusunan rencana kerja perhutanan sosial dan pengambilan keputusan partisipatif.": "Supporting social forestry work plans and participatory decision-making.",
      "Mendorong kolaborasi masyarakat dengan pemerintah desa, Balai PSKL, perguruan tinggi, dan mitra program.": "Promoting collaboration among communities, village governments, the PSKL regional office, universities, and programme partners.",
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
      "Petak Ukur Permanen": "Permanent Measurement Plots",
      "Restorasi Hutan & Lahan": "Forest & Land Restoration",
      "Rumah Pembibitan Mangrove": "Mangrove Nurseries",
      "Rumah Pembibitan Kopi": "Coffee Nurseries",
      "Plang Informasi & Perlindungan": "Information & Protection Signage",
      "Infrastruktur Pendukung": "Supporting Infrastructure",
      "Alat Pemecah Ombak (APO)": "Wave Attenuation Structures",
      "Distribusi Lahan Kopi": "Coffee Cultivation Areas",
      "Titik Tanam Kopi": "Coffee Planting Points",
      "Titik Tanam Mangrove": "Mangrove Planting Points",
      "Wilayah Penanaman Kopi": "Coffee Planting Areas",
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
      "Jelajahi": "Explore",
      "Data & Dampak": "Data & Impact",
      "Monitoring Lapangan": "Field Monitoring",
      "Pelibatan Masyarakat": "Community Engagement",
      "Pelibatan & Peningkatan Kapasitas": "Engagement & Capacity Building",
      "Kontribusi SDGs": "SDG Contributions",
      "Mitra & Kemitraan": "Partners & Partnerships",
      "Keselarasan Kebijakan & Komitmen": "Policy & Commitment Alignment",
      "Capaian menurut tujuan pembangunan": "Progress by development goal",
      "KKMD, FOLU Net Sink, NDC, dan kerangka terkait": "KKMD, FOLU Net Sink, NDC, and related frameworks",
      "Pembuatan Sesi": "Create Session",
      "Live Session": "Live Session",
      "Data Terverifikasi": "Verified Data",
      "Data Peningkatan Kapasitas": "Capacity Building Data",
      "Jelajahi Peta": "Explore the Map",
      "🗺️ Jelajahi Peta": "🗺️ Explore the Map",
      "Buka Peta": "Open Map",
      "Pasang Aplikasi": "Install App",
      "📲 Pasang Aplikasi": "📲 Install App",
      "🌐 Website Resmi Yayasan Gambut": "🌐 Official Yayasan Gambut Website",
      "🌊 Pemantauan Pesisir & Mangrove": "🌊 Coastal & Mangrove Monitoring",
      "🦜 Biodiversitas": "🦜 Biodiversity",
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
      "Program aktif": "Active programmes",
      "Program selesai": "Completed programmes",
      "MITRA PENDANAAN": "FUNDING PARTNER",
      "Wilayah Cakupan Program": "Programme Coverage Areas",
      "Restorasi Mangrove": "Mangrove Restoration",
      "Restorasi Gambut": "Peatland Restoration",
      "Restorasi Lahan Mineral": "Mineral Land Restoration",
      "Area Restorasi Lahan Mineral": "Mineral Land Restoration Areas",
      "Peningkatan Kapasitas": "Capacity Building",
      "Pelibatan & Kapasitas": "Engagement & Capacity",
      "Pelibatan Masyarakat & Kapasitas": "Community Engagement & Capacity",
      "Pelibatan Masyarakat & Peningkatan Kapasitas": "Community Engagement & Capacity Building",
      "RINGKASAN PROGRAM": "PROGRAMME SUMMARY",
      "Baseline → data terkini": "Baseline → current data",
      "Baseline": "Baseline",
      "Terkini": "Current",
      "Tambahan": "Verified Addition",
      "Data terverifikasi": "Verified data",
      "Data final": "Final data",
      "DATA FINAL TERKINI": "LATEST FINAL DATA",
      "Terhubung ke WebGIS": "Connected to WebGIS",
      "Total restorasi": "Total restoration",
      "hektare": "hectares",
      "Orang terlibat": "People engaged",
      "pelatihan & kegiatan": "training & activities",
      "Desa cakupan": "Villages covered",
      "wilayah program": "programme areas",
      "cakupan kerja": "operational coverage",
      "Angka diperbarui dari objek terverifikasi, laporan kegiatan, dan monitoring lapangan.": "Figures are updated from verified objects, activity reports, and field monitoring.",
      "Diperbarui:": "Updated:",
      "Kegiatan Tercatat": "Recorded Activities",
      "Perempuan Terlibat": "Women Engaged",
      "Pemuda Terlibat": "Youth Engaged",
      "Rata-rata Post-test": "Average Post-test",
      "Luas awal": "Initial area",
      "Penanaman baru": "New planting",
      "Luas penanaman": "Planting area",
      "Area rewetting": "Rewetting area",
      "Rehabilitasi baru": "New rehabilitation",
      "Total rehabilitasi": "Total rehabilitation",
      "Baseline orang": "People baseline",
      "Orang baru": "New people",
      "Total terlibat": "Total engaged",
      "Kelangsungan Hidup PUP 1": "PUP 1 Survival",
      "Kelangsungan Hidup PUP 2": "PUP 2 Survival",
      "Perubahan dari baseline": "Change from baseline",
      "Belum berubah": "No change",
      "Snapshot baseline 22 Juli 2026 · buka rincian indikator": "Baseline snapshot 22 July 2026 · open indicator details",
      "Kegiatan Lapangan": "Field Activities",
      "Orang Terlibat": "People Engaged",
      "Responden Post-test": "Post-test Respondents",
      "Luas Restorasi": "Restoration Area",
      "Pohon Mangrove Ditanam": "Mangrove Trees Planted",
      "Pohon Mangrove Ditanam (Semua Program)": "Mangrove Trees Planted (All Programmes)",
      "Total Bibit Ditanam": "Total Seedlings Planted",
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
      "Penyerapan & Pengurangan Emisi": "Carbon Removals & Emission Reductions",
      "Estimasi diturunkan dari data WebGIS yang sudah ada, tanpa tabel baru.": "Estimates are derived from existing WebGIS data without introducing a new data table.",
      "Data yang berkontribusi: area restorasi mangrove, area restorasi gambut/agroforestri, bibit tertanam, rumah bibit, sekat kanal, FDRS, monitoring lapangan, pelatihan masyarakat, dan dokumentasi kegiatan.": "Contributing data: mangrove restoration areas, peatland/agroforestry restoration areas, planted seedlings, nurseries, canal blocks, FDRS, field monitoring, community training, and activity documentation.",
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
      "Pohon Mangrove Ditanam (Semua Program)": "Mangrove Trees Planted (All Programmes)",
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
      "Juni 2026–Februari 2027": "June 2026–February 2027",
      "Juni 2026 – Februari 2027": "June 2026 – February 2027",
      "Aktivitas": "Activities",
      "Periode Proyek": "Project Period",
      "Lokasi Proyek": "Project Location",
      "Desa Temiang, Kabupaten Bengkalis, Riau": "Temiang Village, Bengkalis Regency, Riau",
      "Penguatan usaha kopi Liberika yang dipimpin perempuan dan peningkatan ketahanan ekosistem gambut melalui mata pencaharian berkelanjutan berbasis komunitas.": "Strengthening women-led Liberica coffee enterprises and peatland ecosystem resilience through sustainable community-based livelihoods.",
      "Status: Program Berjalan": "Status: Ongoing Programme",
      "Lihat di Peta": "View on Map",
      "Rencana proyek resmi": "Official project plan",
      "Struktur Annex 1": "Annex 1 Structure",
      "Perjanjian No. 08.024/PENABULU–YAYASAN GAMBUT/V/2026 · durasi 9 bulan.": "Agreement No. 08.024/PENABULU–YAYASAN GAMBUT/V/2026 · 9-month duration.",
      "Target perempuan anggota KTWMJ": "Target women members of KTWMJ",
      "Target proyek": "Project targets",
      "Belum otomatis menjadi capaian": "Not automatically counted as achievements",
      "Realisasi hanya dihitung setelah paket bukti pelaksanaan lengkap dan ditelaah.": "Delivery is counted only after the implementation evidence package is complete and reviewed.",
      "Benih dan media tanam": "Seeds and growing media",
      "Target Aktivitas 1.3.2": "Activity 1.3.2 target",
      "Micro-mill komunitas": "Community micro-mill",
      "Output 1.1 · 3 aktivitas telah terverifikasi": "Output 1.1 · 3 activities verified",
      "Sekat kanal disurvei dan diperbaiki/ditambah": "Canal blocks surveyed and repaired/added",
      "Target Aktivitas 2.1.1 · masih proses UM": "Activity 2.1.1 target · advance request in process",
      "Monitoring TMAT dan FDRS/EWS": "TMAT and FDRS/EWS monitoring",
      "Target Aktivitas 2.2.1 · masih proses UM/desain": "Activity 2.2.1 target · advance request/design in process",
      "Paket bukti pelaksanaan": "Implementation evidence packages",
      "Memuat evidence...": "Loading evidence...",
      "Basis penelaahan: PJUM, alat bukti, dan executive summary. Kegiatan yang baru berada pada tahap UM tidak dihitung sebagai capaian.": "Review basis: PJUM, supporting evidence, and executive summary. Activities still at the advance-request stage are not counted as achievements.",
      "Keluaran terdokumentasi": "Documented outputs",
      "Empat Aktivitas dengan Paket Bukti Lengkap": "Four Activities with Complete Evidence Packages",
      "Rumah Penjemuran Semi Permanen": "Semi-permanent Coffee Drying House",
      "Mesin Pengupas Kopi": "Coffee Huller",
      "SOP Operasional Micro-mill": "Micro-mill Operating SOP",
      "Menara dan Sistem Distribusi Air Nursery": "Nursery Water Tower and Distribution System",
      "Dokumentasi": "Documentation",
      "Galeri Foto": "Photo Gallery",
      "Menara air dan sistem distribusi": "Water tower and distribution system",
      "4 evidence terverifikasi": "4 verified evidence items",
      "Status output": "Output status",
      "Selesai": "Completed",
      "Berjalan": "In Progress",
      "Direncanakan": "Planned",
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
      "AKSES DATA TERCATAT": "RECORDED DATA ACCESS",
      "Butuh data monitoring?": "Need monitoring data?",
      "Ajukan cakupan, format, identitas, dan tujuan penggunaan. Ringkasan tanpa data sensitif tersedia setelah permintaan tercatat; data rinci dan lokasi ditinjau YG.": "Submit the requested scope, format, identity, and purpose. A non-sensitive summary is available after the request is recorded; detailed records and locations are reviewed by YG.",
      "Tahun data": "Data year",
      "Ajukan permintaan data": "Request data",
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
  Object.assign(dictionaries.en, {
    "Kembali ke dashboard utama": "Return to the main dashboard",
    "Pilihan bahasa / Language selection": "Language selection",
    "Satelit": "Satellite",
    "Area Restorasi Lahan Mineral": "Mineral Land Restoration Areas",
    "Petak Ukur Permanen": "Permanent Measurement Plots",
    "Titik Penanaman": "Planting Points",
    "Wilayah Penanaman Kopi": "Coffee Cultivation Areas",
    "Perhutanan Sosial Riau": "Riau Social Forestry",
    "Batas Administrasi Desa Riau": "Riau Village Administrative Boundaries",
    "IUPHHK-HT 2014": "Timber Plantation Concessions 2014",
    "Fase/keterangan": "Phase/notes",
    "Jumlah bibit": "Number of seedlings",
    "Jenis pohon": "Tree species",
    "Riwayat penanaman": "Planting history",
    "Status koordinat": "Coordinate status",
    "Pemilik lahan": "Landowner",
    "Tumpang sari": "Intercropping",
    "Proyek": "Project",
    "Kode proyek": "Project code",
    "Belum diisi": "Not provided",
    "Belum ada informasi rinci.": "No detailed information is available.",
    "Kontribusi SDGs": "SDG contribution",
    "Kirim Monitoring Lagi": "Submit Another Monitoring Record",
    "Lihat Jenis Flora Mangrove": "View Mangrove Flora Species",
    "Objek WebGIS": "WebGIS object",
    "Lokasi Anda": "Your location",
    "Galeri foto": "Photo gallery",
    "Perbesar foto": "Enlarge photo",
    "Foto tidak dapat dimuat. Tekan untuk membuka sumber asli.": "The photo could not be loaded. Select it to open the original source.",
    "Foto sebelumnya": "Previous photo",
    "Foto berikutnya": "Next photo",
    "Foto dokumentasi": "Documentation photo",
    "Pembaruan terverifikasi": "Verified update",
    "Catatan pembaruan": "Update notes",
    "Luas": "Area",
    "Fase": "Phase",
    "Sumber": "Source",
    "Status": "Status",
    "Koordinat": "Coordinates",
    "Jumlah": "Count",
    "Keterangan": "Notes",
    "Program": "Programme",
    "Nama donor": "Donor name",
    "Jenis": "Type",
    "Panjang": "Length",
    "Jumlah pohon": "Number of trees",
    "Tanggal kegiatan": "Activity date",
    "Nama kelompok": "Group name",
    "Mitra": "Partner",
    "Topik": "Topic",
    "Peserta laki-laki": "Male participants",
    "Peserta perempuan": "Female participants",
    "Pemantauan lingkungan": "Environmental monitoring",
    "PEMANTAUAN LINGKUNGAN": "ENVIRONMENTAL MONITORING",
    "Hotspot NASA MODIS–VIIRS (30 hari)": "NASA MODIS–VIIRS hotspots (30 days)",
    "Tutupan lahan Indonesia 2017": "Indonesia land cover 2017",
    "Kehilangan tutupan": "Tree-cover loss",
    "Alert perubahan terbaru": "Latest change alerts",
    "Belum dihitung": "Not calculated",
    "Perhutanan sosial": "Social forestry",
    "Desa intervensi": "Programme village",
    "Data belum tersedia": "Data unavailable",
    "Hutan produksi": "Production forest",
    "Hutan lindung": "Protection forest",
    "Kawasan konservasi": "Conservation area",
    "Total kawasan hutan": "Total forest estate",
    "Gambut": "Peatland",
    "Lahan gambut": "Peatland",
    "Luas areal": "Area size",
    "Tutupan baseline": "Baseline forest cover",
    "Tutupan areal": "Area forest cover",
    "Kehilangan total": "Total loss",
    "Hotspot 7 hari": "Hotspots in 7 days",
    "Hotspot 30 hari": "Hotspots in 30 days",
    "Sedang diproses": "Processing",
    "Lihat layer": "View layer",
    "Ringkasan hotspot": "Hotspot summary",
    "Total hotspot per tahun": "Total hotspots by year",
    "30 hari terakhir": "Last 30 days",
    "Kesatuan Hidrologis Gambut (KHG) Riau — referensi lokal": "Riau Peat Hydrological Units (KHG) — local reference",
    "Fungsi Ekosistem Gambut Riau — referensi KLHK": "Riau Peat Ecosystem Functions — MoEF reference"
  });
  Object.assign(dictionaries.en, {
    "Beranda": "Home",
    "Peta Interaktif": "Interactive Map",
    "Informasi Ekosistem": "Ecosystem Information",
    "Laporkan Temuan": "Submit a Report",
    "Dashboard Monitoring": "Monitoring Dashboard",
    "Pesisir & Mangrove": "Coasts & Mangroves",
    "Pilih ekosistem": "Choose an ecosystem",
    "Lihat di peta": "View on map",
    "taksa/jenis terdokumentasi": "documented taxa/species",
    "Hutan pasang surut, zona pesisir, sungai, dan perairan sekitarnya.": "Tidal forests, coastal zones, rivers, and surrounding waters.",
    "Hutan rawa gambut, area restorasi, dan agroforestri ramah gambut.": "Peat-swamp forests, restoration areas, and peat-friendly agroforestry.",
    "Hutan daratan, riparian, agroforestri, dan lanskap perdesaan.": "Terrestrial and riparian forests, agroforestry, and rural landscapes.",
    "Lihat flora dan fauna mangrove →": "View mangrove flora and fauna →",
    "Halaman detail akan tersedia setelah data terverifikasi": "The detail page will be available after the data is verified",
    "Cara membaca data": "How to read the data",
    "Kembali ke WebGIS": "Return to WebGIS",
    "EKOSISTEM MANGROVE": "MANGROVE ECOSYSTEM",
    "Flora dan fauna mangrove": "Mangrove flora and fauna",
    "Cari jenis": "Search species",
    "Semua lokasi": "All locations",
    "Semua status": "All statuses",
    "Sumber bukti": "Evidence source",
    "Semua sumber": "All sources",
    "Belum tercantum": "Not listed",
    "Tutup detail": "Close details",
    "Pemantauan Pesisir & Mangrove": "Coastal & Mangrove Monitoring",
    "Status data": "Data status",
    "Arah di pantai desa": "Direction at the village coast",
    "Risiko lokasi": "Site risk",
    "Lihat semua lokasi YG": "View all YG locations",
    "LOKASI TERPILIH": "SELECTED LOCATION",
    "PRAKIRAAN 72 JAM · SEMUA WAKTU WIB": "72-HOUR FORECAST · ALL TIMES WIB",
    "Pemantauan Karhutla & Cuaca": "Wildfire & Weather Monitoring",
    "Pemantauan Karhutla & Cuaca Indonesia": "Indonesia Wildfire & Weather Monitoring",
    "Hari ini · data parsial": "Today · partial data",
    "Layer peta": "Map layers",
    "Desa intervensi & risiko": "Programme villages & risk",
    "Lihat Indonesia": "View Indonesia",
    "PERINGATAN DESA": "VILLAGE ALERTS",
    "Kontribusi Yayasan Gambut terhadap FOLU Net Sink 2030": "Yayasan Gambut Contribution to FOLU Net Sink 2030",
    "TARGET NASIONAL 2030": "2030 NATIONAL TARGET",
    "Angka nasional; bukan target organisasi Yayasan Gambut.": "National figure; not a Yayasan Gambut organisational target.",
    "Buka dokumen ↗": "Open document ↗",
    "lokasi/lanskap": "locations/landscapes",
    "mangrove tertanam": "mangroves planted",
    "infrastruktur pembasahan gambut": "peat rewetting infrastructure",
    "pemantauan hidrologi dan risiko": "hydrology and risk monitoring",
    "CAPAIAN TERVERIFIKASI": "VERIFIED RESULTS",
    "Kontribusi Yayasan Gambut terhadap KKMD Riau": "Yayasan Gambut Contribution to Riau KKMD",
    "Buka SK KKMD Riau": "Open the Riau KKMD Decree",
    "Buka SK Rencana Aksi": "Open the Action Plan Decree",
    "komitmen utama YG": "YG core commitments",
    "Pembaruan data": "Data update",
    "KOMITMEN UTAMA": "CORE COMMITMENTS",
    "Target dan realisasi YG": "YG targets and delivery",
    "Rehabilitasi mangrove": "Mangrove rehabilitation",
    "Lihat bukti WebGIS →": "View WebGIS evidence →",
    "NDC Indonesia dan kontribusi Yayasan Gambut": "Indonesia NDC and Yayasan Gambut Contribution",
    "TARGET NASIONAL": "NATIONAL TARGET",
    "Dua periode kebijakan yang saling berlanjut": "Two consecutive policy periods",
    "Target tingkat emisi absolut": "Absolute emissions-level target",
    "Hutan, gambut, mangrove, dan penggunaan lahan": "Forests, peatlands, mangroves, and land use",
    "Buka 12 RO nasional dan pemetaan YG": "View the 12 national outputs and YG mapping",
    "Lokasi dan capaian YG": "YG locations and results",
    "Buka layer kontribusi di peta": "Open contribution layers on the map",
    "Dari kegiatan lapangan ke sasaran NDC": "From field activities to NDC objectives",
    "Evidence publik": "Public evidence",
    "Perlindungan dan pengelolaan ekosistem gambut": "Peat ecosystem protection and management",
    "Penyusunan, penetapan, dan perubahan RPPEG": "Preparation, adoption, and amendment of RPPEG",
    "POSISI KEBIJAKAN": "POLICY POSITION",
    "KEBIJAKAN GAMBUT": "PEATLAND POLICY",
    "Kontribusi Yayasan Gambut": "Yayasan Gambut Contribution",
    "Lokasi, capaian, monitoring, dan bukti kegiatan": "Locations, results, monitoring, and activity evidence",
    "Empat kelompok rencana utama": "Four main plan groups",
    "Rincian capaian program": "Programme results details",
    "BASELINE DAN PEMBARUAN DATA": "BASELINE AND DATA UPDATES",
    "Perubahan capaian program": "Changes in programme results",
    "Memuat snapshot dashboard terakhir...": "Loading the latest dashboard snapshot...",
    "Pilih program": "Choose a programme",
    "Lahan Mineral": "Mineral Land",
    "Pelibatan & Kapasitas": "Engagement & Capacity Building",
    "Memuat rincian...": "Loading details...",
    "Cara membaca perbandingan": "How to read the comparison",
    "Data terkini": "Current data",
    "Data terverifikasi yang telah dimuat": "Verified data that has been loaded",
    "Total area restorasi": "Total restoration area",
    "Buka data sumber": "Open source data",
    "Kembali ke dashboard": "Return to dashboard",
    "Profil mitra pendanaan": "Funding partner profile",
    "Memuat profil donor...": "Loading donor profile...",
    "FOKUS PROGRAM": "PROGRAMME FOCUS",
    "Grafik Capaian Program": "Programme Results Chart",
    "Pohon mangrove ditanam": "Mangrove trees planted",
    "Desa program": "Programme villages",
    "Peserta kegiatan": "Activity participants",
    "Program Berjalan": "Ongoing Programmes",
    "Judul belum diisi": "Title not provided",
    "Keterangan program belum diisi.": "Programme description not provided.",
    "INPUT BERTAHAP": "PHASED INPUT",
    "Tambah program atau timeline": "Add a programme or timeline",
    "Jenis entri": "Entry type",
    "Program berjalan": "Ongoing programme",
    "Judul": "Title",
    "Periode/tahun": "Period/year",
    "Ringkasan": "Summary",
    "Simpan draf": "Save draft",
    "Ekspor JSON": "Export JSON",
    "DATA KEGIATAN TERVERIFIKASI": "VERIFIED ACTIVITY DATA",
    "RINGKASAN CAPAIAN": "RESULTS SUMMARY",
    "Data partisipasi masyarakat": "Community participation data",
    "Kegiatan tercatat": "Recorded activities",
    "Cari kegiatan": "Search activities",
    "Data pelatihan dan pembelajaran": "Training and learning data",
    "Kelola evaluasi pelatihan pada halaman terpisah.": "Manage training evaluations on a separate page.",
    "Buka detail post-test →": "Open post-test details →",
    "DATA & DAMPAK": "DATA & IMPACT",
    "Capaian kuantitatif akan updated dari data program dan evidence yang telah diverifikasi.": "Quantitative results will be updated from verified programme data and evidence."
  });
  Object.assign(dictionaries.en, {
    "Belum dicantumkan dalam laporan": "Not listed in the report",
    "Nama ilmiah belum dicantumkan": "Scientific name not listed",
    "Sumber utama temuan lokasi adalah Final Baseline Mangrove 2024, berdasarkan assessment Juni–September 2024 di Buruk Bakul dan Kelapa Pati. Nama dan status dapat diperiksa silang melalui IUCN Red List, GBIF, publikasi BRIN, dan sumber pemerintah. Catatan yang belum lengkap tetap ditandai untuk verifikasi.": "The primary source for site records is the 2024 Final Mangrove Baseline, based on the June–September 2024 assessment in Buruk Bakul and Kelapa Pati. Names and statuses may be cross-checked against the IUCN Red List, GBIF, BRIN publications, and government sources. Incomplete records remain flagged for verification.",
    "Persentase perubahan dihitung dengan rumus (data terkini − baseline) ÷ baseline × 100%. Penambahan data menunjukkan perubahan inventaris capaian yang terverifikasi; tidak selalu berarti perubahan ekologis pada periode yang sama.": "Percentage change is calculated as (current data − baseline) ÷ baseline × 100%. Added records indicate changes in the verified results inventory and do not necessarily represent ecological change during the same period.",
    "Ringkasan partisipasi masyarakat, kelompok yang terlibat, lokasi, mitra, dan bukti keterlibatan dalam kegiatan lapangan Yayasan Gambut.": "Summary of community participation, groups involved, locations, partners, and evidence of engagement in Yayasan Gambut field activities.",
    "Ringkasan pelatihan, peserta, kelompok sasaran, materi, mitra, hasil evaluasi, dan bukti pembelajaran Yayasan Gambut.": "Summary of training, participants, target groups, materials, partners, evaluation results, and evidence of Yayasan Gambut learning activities.",
    "Tambah Pelatihan": "Add Training",
    "Pelatihan tercatat": "Recorded training sessions",
    "Kegiatan tercatat": "Recorded activities",
    "Orang terlibat": "People engaged",
    "Perempuan": "Women",
    "Pemuda terlibat": "Youth engaged",
    "RINGKASAN CAPAIAN": "RESULTS SUMMARY",
    "Data pelatihan dan pembelajaran": "Training and learning data",
    "Data partisipasi masyarakat": "Community participation data",
    "Memeriksa sumber dan duplikasi data…": "Checking sources and duplicate records…",
    "Kontribusi terhadap SDGs": "Contribution to the SDGs",
    "Kontribusi Yayasan Gambut terhadap RAD Kabupaten Bengkalis Lestari": "Yayasan Gambut Contribution to the Bengkalis Lestari Regional Action Plan",
    "Pemetaan posisi, evidence, dan kontribusi program Yayasan Gambut terhadap Peraturan Bupati Bengkalis Nomor 13 Tahun 2026 dan lampiran rencana aksinya.": "Mapping the position, evidence, and contribution of Yayasan Gambut programmes to Bengkalis Regent Regulation No. 13 of 2026 and its action-plan annex.",
    "POSISI KONTRIBUSI": "CONTRIBUTION POSITION",
    "KONTRIBUSI TERVERIFIKASI": "VERIFIED CONTRIBUTION",
    "KONTRIBUSI PENDUKUNG": "SUPPORTING CONTRIBUTION",
    "Relevan, tetapi belum membuktikan capaian aksi.": "Relevant, but does not yet demonstrate delivery of the action.",
    "BELUM DIPETAKAN": "NOT YET MAPPED",
    "Belum ada evidence YG yang sesuai.": "No matching YG evidence is available yet.",
    "Cari aksi": "Search actions",
    "Prioritas pemantauan": "Monitoring priority",
    "Cara membaca": "How to read",
    "Data model ±2.500 kaki belum tersedia dan tidak ditampilkan.": "Model data at approximately 2,500 feet is unavailable and is not displayed.",
    "KERANGKA NASIONAL · KONTRIBUSI TAPAK RIAU": "NATIONAL FRAMEWORK · RIAU FIELD CONTRIBUTION",
    "Buka spreadsheet ↗": "Open spreadsheet ↗",
    "memiliki kontribusi terdokumentasi": "have documented contributions",
    "Kontribusi tapak, bukan klaim karbon": "Field contribution, not a carbon claim",
    "CAPAIAN TERPETAKAN": "MAPPED RESULTS",
    "Seluruh RO nasional tetap ditampilkan, termasuk yang belum mempunyai kontribusi YG. Buka setiap kartu untuk melihat fokus nasional, arah kegiatan, posisi evidence YG, serta dokumen acuannya.": "All national outputs remain displayed, including those without a YG contribution. Open each card to view the national focus, activity direction, YG evidence position, and reference documents.",
    "ada kontribusi YG": "YG contribution available",
    "kontribusi terpetakan": "mapped contributions",
    "Yayasan Gambut sebagai pelaksana kontribusi": "Yayasan Gambut as a contribution implementer",
    "Wilayah kontribusi": "Contribution area",
    "Semua isu": "All issues",
    "Status kontribusi": "Contribution status",
    "Belum terpetakan": "Not yet mapped",
    "KOMITMEN IKLIM NASIONAL · KONTRIBUSI TAPAK RIAU": "NATIONAL CLIMATE COMMITMENT · RIAU FIELD CONTRIBUTION",
    "MATRIKS KONTRIBUSI YG": "YG CONTRIBUTION MATRIX",
    "Kontribusi kegiatan, bukan klaim karbon": "Activity contribution, not a carbon claim",
    "STATUS: PEMETAAN KONTRIBUSI": "STATUS: CONTRIBUTION MAPPING",
    "Buka dokumen resmi ↗": "Open official document ↗",
    "NASIONAL → PROVINSI → KONTRIBUSI TAPAK": "NATIONAL → PROVINCIAL → FIELD CONTRIBUTION",
    "Muatan RPPEG Nasional": "National RPPEG content",
    "Penjabaran dalam RPPEG Riau": "Translation into the Riau RPPEG",
    "Evidence kontribusi YG": "YG contribution evidence",
    "Kegiatan YG": "YG activities",
    "Jalur RPPEG": "RPPEG pathway",
    "Kontribusi yang didukung": "Supported contribution",
    "Buka dokumen lengkap ↗": "Open full document ↗",
    "KERANGKA KONTRIBUSI": "CONTRIBUTION FRAMEWORK",
    "Kontribusi mitigasi dan adaptasi YG": "YG mitigation and adaptation contribution",
    "Alur kontribusi nasional": "National contribution pathway",
    "Buka target, sektor, matriks kontribusi, dan evidence →": "View targets, sectors, contribution matrix, and evidence →",
    "Buka 12 RO nasional dan peta kontribusi →": "View the 12 national outputs and contribution map →",
    "Buka hierarki, prioritas wilayah, dan matriks kontribusi →": "View the hierarchy, area priorities, and contribution matrix →",
    "Buka keselarasan KKMD Riau →": "View alignment with Riau KKMD →",
    "Kebijakan tematik dan wilayah": "Thematic and territorial policies",
    "Batas klaim": "Claim boundary"
  });
  Object.assign(dictionaries.en, {
    "Tanggal terbaru": "Latest data date",
    "24 jam bergulir": "Rolling 24 hours",
    "Near real-time · high confidence": "Near real-time · high confidence",
    "Peringatan · data FIRMS parsial": "Warning · partial FIRMS data",
    "Peringatan · data FIRMS terlambat": "Warning · delayed FIRMS data",
    "Arsip harian": "Daily archive",
    "Periksa koneksi atau pembaruan FIRMS": "Check the connection or FIRMS update",
    "Data hotspot gagal dimuat": "Hotspot data failed to load",
    "Potensi Sebaran Asap": "Smoke Dispersion Potential",
    "Skor indikatif 0–100": "Indicative score 0–100",
    "Poligon potensi sebaran asap": "Smoke dispersion potential polygons",
    "Asap: rendah (0–24)": "Smoke: low (0–24)",
    "Asap: waspada (25–49)": "Smoke: watch (25–49)",
    "Asap: tinggi (50–74)": "Smoke: high (50–74)",
    "Asap: sangat tinggi (75–100)": "Smoke: very high (75–100)",
    "Potensi sebaran asap": "Smoke dispersion potential",
    "Aktifkan layer untuk menjalankan model indikatif 24 jam.": "Enable the layer to run the indicative 24-hour model.",
    "Poligon berwarna menunjukkan arah potensi sebaran dari hotspot mengikuti angin. Zona ini bukan batas asap teramati dan bukan pengganti pengukuran kualitas udara.": "Coloured polygons show the potential dispersion direction from hotspots following the wind. These zones are not observed smoke boundaries or a substitute for air-quality measurements."
    ,"Lapisan rendah ±2.500 kaki": "Low level ±2,500 feet"
    ,"Arah gerak & kecepatan angin 2.500 kaki": "Travel direction & 2,500-foot wind speed"
    ,"925 hPa (sekitar 2.500 kaki)": "925 hPa (about 2,500 feet)"
    ,"Arah gerak GFS & kecepatan angin 2.500 kaki": "GFS travel direction & 2,500-foot wind speed"
    ,"GFS 925 hPa (sekitar 2.500 kaki)": "GFS 925 hPa (about 2,500 feet)"
    ,"Panah menunjukkan arah perjalanan udara/asap dan diperbarui otomatis mengikuti siklus GFS.": "Arrows show air/smoke travel direction and update automatically with the GFS cycle."
    ,"Peluang Transport Asap": "Smoke Transport Likelihood"
    ,"Ensemble indikatif · bukan konsentrasi": "Indicative ensemble · not concentration"
    ,"Poligon peluang transport asap": "Smoke transport likelihood polygons"
    ,"Peluang transport asap": "Smoke transport likelihood"
    ,"Aktifkan layer untuk menjalankan model ensemble indikatif 24 jam.": "Enable the layer to run the indicative 24-hour ensemble model."
    ,"Peluang: rendah (0–24)": "Likelihood: low (0–24)"
    ,"Peluang: waspada (25–49)": "Likelihood: watch (25–49)"
    ,"Peluang: tinggi (50–74)": "Likelihood: high (50–74)"
    ,"Peluang: sangat tinggi (75–100)": "Likelihood: very high (75–100)"
    ,"Titik merah tua adalah sumber kompleks kebakaran; garis putus-putus menunjukkan lintasan median ensemble menuju kontur peluang transport. Kontur bukan batas asap teramati dan bukan pengukuran kualitas udara.": "Dark-red points are fire-complex sources; dashed lines show the median ensemble path toward transport-likelihood contours. Contours are not observed smoke boundaries or air-quality measurements."
    ,"Warna menunjukkan persentase anggota GEFS yang membawa lintasan dari kompleks hotspot melewati suatu wilayah. Garis putus-putus adalah lintasan referensi GFS. AOD dan FRP tidak menentukan warna poligon.": "Colours show the percentage of GEFS members carrying a trajectory from hotspot complexes across an area. Dashed lines are deterministic GFS reference trajectories. AOD and FRP do not determine polygon colours."
    ,"Peluang: rendah (1–25%)": "Likelihood: low (1–25%)"
    ,"Peluang: waspada (26–50%)": "Likelihood: watch (26–50%)"
    ,"Peluang: tinggi (51–75%)": "Likelihood: high (51–75%)"
    ,"Peluang: sangat tinggi (76–100%)": "Likelihood: very high (76–100%)"
    ,"Panah menunjukkan arah perjalanan udara/asap, bukan arah asal angin.": "Arrows show the direction air/smoke travels, not where the wind comes from."
    ,"Kontur terbentuk dari kepadatan lintasan partikel selama 24 jam menggunakan angin 925 hPa. Kontur yang bersentuhan digabungkan. Zona ini bukan batas asap teramati dan bukan pengganti pengukuran kualitas udara.": "Contours are formed from 24-hour particle-trajectory density using 925 hPa winds. Touching contours are merged. These zones are not observed smoke boundaries or a substitute for air-quality measurements."
    ,"Waktu hotspot & model": "Hotspot & model period"
    ,"Periode deteksi satelit": "Satellite detection period"
    ,"Deteksi bukan status api saat ini. Periode 24 jam dapat membentuk peluang transport; 7 hari hanya sumber berulang; 30 hari tanpa poligon.": "Detections do not indicate current fire status. The 24-hour period may generate transport likelihood; 7 days shows recurring sources only; 30 days has no polygon."
    ,"Deteksi 6 jam": "6-hour detections"
    ,"Deteksi 6 jam dan 24 jam membentuk lintasan; 7 hari menampilkan sumber berulang; 30 hari tanpa poligon.": "The 6-hour and 24-hour detections generate trajectories; 7 days shows recurring sources; 30 days has no polygon."
    ,"Sekarang": "Current"
    ,"24 jam": "24 hours"
    ,"7 hari berulang": "7-day recurrence"
    ,"Sekarang dan 24 jam membentuk lintasan asap; 7 hari menampilkan sumber berulang; 30 hari tanpa poligon.": "Current and 24-hour periods generate smoke trajectories; 7 days shows recurring sources; 30 days has no polygon."
  });
  if (dictionaries.en) dictionaries.en["Cetak Peta"] = "Print Map";
  const reverse = Object.fromEntries(
    Object.entries(dictionaries.en).map(([id, en]) => [en, id])
  );

  function readStoredLanguage() {
    try {
      return window.localStorage && window.localStorage.getItem(STORAGE_KEY);
    } catch (error) {
      return null;
    }
  }

  function storeLanguage(language) {
    try {
      if (window.localStorage) window.localStorage.setItem(STORAGE_KEY, language);
    } catch (error) {
      // Language switching must still work when storage is unavailable.
    }
  }

  let currentLanguage = readStoredLanguage() === "en" ? "en" : "id";
  let translating = false;
  const originalText = new WeakMap();
  const originalAttributes = new WeakMap();

  function locale() {
    return currentLanguage === "en" ? "en-US" : "id-ID";
  }

  function translateDynamic(text, language) {
    if (language === "en") {
      return text
        .replace(/^Sumber: Master Database/, "Source: Master Database")
        .replace(/layer resmi WebGIS/g, "official WebGIS layers")
        .replace(/diperbarui/g, "updated")
        .replace(/ objek · (?:diperbarui|updated) /, " objects · updated ")
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
        .replace(/^(.+?)\s*\u00b7\s*lihat ringkasan program$/, "$1 · view programme summary")
        .replace(/^Fase (\d+) · Judul belum diisi$/, "Phase $1 · Title not provided")
        .replace(/^(\d+)\s+program$/, (_, count) => count + (count === "1" ? " programme" : " programmes"))
        .replace(/^(\d[\d.]*)\s+pohon$/, "$1 trees")
        .replace(/^Target\s+(\d[\d.]*)\s+pohon$/, "Target: $1 trees")
        .replace(/Wave Breaker \(akumulasi\)$/, "Wave Breaker (cumulative)")
        .replace(/^(\d+) objek$/, "$1 objects")
        .replace(/^Penanaman Mangrove \((\d+)\)$/, "Mangrove Planting ($1)")
        .replace(/^PENANAMAN MANGROVE$/, "MANGROVE PLANTING")
        .replace(/^(\d+) objek terpetakan$/, "$1 mapped objects")
        .replace(/^Memuat (\d+) dari (\d+) layer\.\.\.$/, "Loading $1 of $2 layers...")
        .replace(/^Semua (\d+) layer berhasil dimuat$/, "All $1 layers loaded successfully")
        .replace(/^(\d+) layer berhasil, (\d+) gagal$/, "$1 layers loaded, $2 failed")
        .replace(/^(.+) berhasil dimuat \(([\d.,]+) fitur\)$/, "$1 loaded successfully ($2 features)")
        .replace(/^(.+) gagal dimuat: (.+)$/, "$1 failed to load: $2")
        .replace(/^Lokasi "(.+)" tidak ditemukan\.$/, 'Location "$1" was not found.')
        .replace(/^Buka informasi (.+)$/, "Open information for $1")
        .replace(/^Tampilkan ((?:Foto|Photo) .+)$/, (_, label) => "Show " + label.replace(/^Foto/, "Photo"))
        .replace(/^Foto (\d+)$/, "Photo $1")
        .replace(/^(\d+) dari (\d+) (.+) ditampilkan$/, "$1 of $2 $3 displayed")
        .replace(/^Lokasi:\s*/, "Location: ")
        .replace(/^(\d+) lokasi$/, "$1 locations")
        .replace(/^(\d+)% capaian$/, "$1% achieved")
        .replace(/^Aktif · (\d+) program$/, "Active · $1 programme")
        .replace(/^Belum ada evidence terverifikasi$/, "No verified evidence yet")
        .replace(/^Data dashboard tersimpan:\s*/, "Dashboard data saved: ")
        .replace(/^Target (\d[\d.,]*) meter$/, "Target: $1 metres")
        .replace(/^(\d+) hari$/, "$1 days")
        .replace(/^(\d+) titik$/, "$1 hotspots")
        .replace(/^(\d+) titik daratan high confidence · 24 jam bergulir$/, "$1 high-confidence land hotspots · rolling 24 hours")
        .replace(/^(\d+) titik daratan high confidence · tanggal data terbaru$/, "$1 high-confidence land hotspots · latest data date")
        .replace(/^(\d+) titik daratan high confidence · (\d+) hari$/, "$1 high-confidence land hotspots · $2 days")
        .replace(/ · PERINGATAN: sumber parsial$/, " · WARNING: partial source data")
        .replace(/ · pembaruan tiap jam$/, " · updated hourly")
        .replace(/^Kehilangan tutupan hutan 10 tahun terbaru \((.+)\)$/, "Tree-cover loss over the latest 10 years ($1)")
        .replace(/\bBelum diisi\b/g, "Not provided")
        .replace(/\bSekarang\b/g, "Present");
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
    try {
      const dictionary = dictionaries[currentLanguage] || {};
      const parents = [element, ...element.querySelectorAll("*")];
      parents.forEach(parent => {
        Array.from(parent.childNodes || []).forEach(node => {
          if (node.nodeType !== 3) return;
          if (!originalText.has(node)) originalText.set(node, node.nodeValue);
          const nodeValue = originalText.get(node);
          if (typeof nodeValue !== "string") return;
          const text = nodeValue.trim();
          if (text && dictionary[text]) {
            const translated = nodeValue.replace(text, dictionary[text]);
            if (node.nodeValue !== translated) node.nodeValue = translated;
          } else if (text && currentLanguage === "id" && reverse[text]) {
            if (node.nodeValue !== nodeValue) node.nodeValue = nodeValue;
          } else if (text) {
            const translated = currentLanguage === "id"
              ? nodeValue
              : translateDynamic(nodeValue, currentLanguage);
            if (node.nodeValue !== translated) node.nodeValue = translated;
          }
        });
      });
      const attributes = ["placeholder", "title", "aria-label", "alt"];
      const selector = attributes.map(name => "[" + name + "]").join(",");
      const attributedElements = [
        ...(element.matches && element.matches(selector) ? [element] : []),
        ...element.querySelectorAll(selector)
      ];
      attributedElements.forEach(el => {
        let originals = originalAttributes.get(el);
        if (!originals) {
          originals = {};
          originalAttributes.set(el, originals);
        }
        attributes.forEach(name => {
          if (!el.hasAttribute(name)) return;
          if (!Object.prototype.hasOwnProperty.call(originals, name)) originals[name] = el.getAttribute(name);
          const source = originals[name];
          if (typeof source !== "string") return;
          const text = source.trim();
          const translated = currentLanguage === "id"
            ? source
            : (dictionary[text] ? source.replace(text, dictionary[text]) : translateDynamic(source, currentLanguage));
          if (el.getAttribute(name) !== translated) el.setAttribute(name, translated);
        });
      });
    } finally {
      translating = false;
    }
  }

  function setLanguage(language) {
    if (language !== "en" && language !== "id") return;
    currentLanguage = language;
    storeLanguage(language);
    document.documentElement.lang = language;
    document.querySelectorAll("[data-lang]").forEach(button => {
      const isPressed = button.dataset.lang === language;
      button.setAttribute("aria-pressed", String(isPressed));
      button.classList.toggle("active", isPressed);
    });
    translateElement(document.body);
    window.dispatchEvent(new CustomEvent("yg:languagechange", {
      detail: { language: currentLanguage }
    }));
  }

  function ensureLanguageSwitcher() {
    if (document.querySelector("[data-lang]")) return;
    const style = document.createElement("style");
    style.textContent = ".yg-global-language-switcher{position:fixed;top:14px;right:14px;z-index:10000;display:inline-flex;gap:3px;padding:4px;border:1px solid rgba(7,107,76,.2);border-radius:999px;background:rgba(242,248,245,.96);box-shadow:0 8px 24px rgba(17,61,47,.14);backdrop-filter:blur(8px)}.yg-global-language-switcher button{min-width:38px;padding:7px 10px;border:0;border-radius:999px;background:transparent;color:#36534a;font:800 12px/1 inherit;cursor:pointer}.yg-global-language-switcher button.active{background:#087d59;color:#fff}@media(max-width:700px){.yg-global-language-switcher{top:8px;right:8px}}";
    document.head.appendChild(style);
    const switcher = document.createElement("div");
    switcher.className = "yg-global-language-switcher";
    switcher.setAttribute("role", "group");
    switcher.setAttribute("aria-label", "Pilihan bahasa / Language selection");
    switcher.innerHTML = '<button type="button" data-lang="id" aria-pressed="false">ID</button><button type="button" data-lang="en" aria-pressed="false">EN</button>';
    document.body.appendChild(switcher);
  }

  document.addEventListener("click", event => {
    const button = event.target.closest("[data-lang]");
    if (button) setLanguage(button.dataset.lang);
  });

  document.addEventListener("DOMContentLoaded", () => {
    ensureLanguageSwitcher();
    setLanguage(currentLanguage);
    new MutationObserver(mutations => {
      if (translating) return;
      mutations.forEach(mutation => mutation.addedNodes.forEach(node => {
        if (node.nodeType === 1) translateElement(node);
        else if (node.nodeType === 3 && node.parentElement) translateElement(node.parentElement);
      }));
    }).observe(document.body, { childList: true, subtree: true });
  });

  window.YG_I18N = {
    get language() {
      return currentLanguage;
    },
    t: function(text) {
      const dictionary = dictionaries[currentLanguage] || {};
      return dictionary[text] || translateDynamic(String(text == null ? "" : text), currentLanguage);
    },
    forLanguage: function(text, language) {
      const source = String(text == null ? "" : text);
      const dictionary = dictionaries[language] || {};
      return dictionary[source] || translateDynamic(source, language);
    },
    locale: locale,
    formatNumber: function(value, options) {
      return new Intl.NumberFormat(locale(), options || {}).format(value);
    },
    formatDate: function(value, options) {
      const date = value instanceof Date ? value : new Date(value);
      return isNaN(date.getTime()) ? String(value || "") : date.toLocaleString(locale(), options || {});
    },
    setLanguage: setLanguage,
    translateElement: translateElement
  };
})();
