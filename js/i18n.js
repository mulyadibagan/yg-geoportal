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
      "PLATFORM DATA SPASIAL RESMI YAYASAN GAMBUT": "OFFICIAL SPATIAL DATA PLATFORM OF YAYASAN GAMBUT",
      "Platform Data Spasial Yayasan Gambut": "Yayasan Gambut Spatial Data Platform",
      "Menyajikan informasi spasial yang terverifikasi untuk mendukung pengelolaan lahan basah, gambut, mangrove, dan ekosistem lainnya secara berkelanjutan melalui restorasi, rehabilitasi, pemantauan lapangan, pemberdayaan masyarakat, serta kemitraan strategis yang berbasis data.": "Providing verified spatial information to support the sustainable management of wetlands, peatlands, mangroves, and other ecosystems through restoration, rehabilitation, field monitoring, community empowerment, and data-driven strategic partnerships.",
      "Menghubungkan data spasial, pemantauan lapangan, dan pelaporan masyarakat dalam satu platform untuk mendukung pengelolaan lahan basah dan ekosistem yang berkelanjutan.": "Connecting spatial data, field monitoring, and community reporting in one platform to support sustainable wetland and ecosystem management.",
      "Kabupaten Cakupan": "Regencies Covered",
      "Desa Dampingan": "Partner Villages",
      "Luas Restorasi Mangrove": "Mangrove Restoration Area",
      "Program Yayasan Gambut": "Yayasan Gambut Programmes",
      "Mitra Pendanaan": "Funding Partners",
      "MITRA PENDANAAN": "FUNDING PARTNER",
      "Wilayah Cakupan Program": "Programme Coverage Areas",
      "Restorasi Mangrove": "Mangrove Restoration",
      "Restorasi Gambut": "Peatland Restoration",
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
      "Output proyek PPCF": "PPCF project outputs",
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
    }
  };

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
        .replace(/^Perlu dipantau\s+Â·\s+/, "Needs monitoring · ")
        .replace(/^(\d{4})[–-]Sekarang$/, "$1–Present")
        .replace(/^(\d+)\s+desa\s*\u00b7\s*lihat ringkasan program$/, "$1 villages · view programme summary")
        .replace(/^Pematang Duku\s*\u00b7\s*lihat ringkasan program$/, "Pematang Duku · view programme summary")
        .replace(/^(\d+)\s+program$/, (_, count) => count + (count === "1" ? " programme" : " programmes"))
        .replace(/^(\d[\d.]*)\s+pohon$/, "$1 trees")
        .replace(/^Target\s+(\d[\d.]*)\s+pohon$/, "Target: $1 trees")
        .replace(/Wave Breaker \(akumulasi\)$/, "Wave Breaker (cumulative)")
        .replace(/^(\d+) objek$/, "$1 objects");
    }

    return text
      .replace(/^Source: Master Database/, "Sumber: Master Database")
      .replace(/official WebGIS layers/g, "layer resmi WebGIS")
      .replace(/updated/g, "diperbarui")
      .replace(/ objects · updated /, " objek · diperbarui ")
      .replace(/^Layers loaded/, "Layer berhasil dimuat")
      .replace(/ public updates applied$/, " pembaruan publik diterapkan")
      .replace(/^Retrieving objects from the Master Database/, "Mengambil objek dari Master Database")
      .replace(/ objects loaded from the Master Database$/, " objek dari Master Database berhasil dimuat")
      .replace(/^Object ID:\s*/, "ID objek: ")
      .replace(/^Latest\s+/, "Terakhir ")
      .replace(/\s+monitoring visits$/, " kali monitoring")
      .replace(/\s+records$/, " riwayat")
      .replace(/^Needs monitoring\s+·\s+/, "Perlu dipantau · ")
      .replace(/^(\d{4})[–-]Present$/, "$1–Sekarang")
      .replace(/^(\d+)\s+villages\s*\u00b7\s*view programme summary$/, "$1 desa · lihat ringkasan program")
      .replace(/^Pematang Duku\s*\u00b7\s*view programme summary$/, "Pematang Duku · lihat ringkasan program")
      .replace(/^(\d+)\s+programmes?$/, "$1 program")
      .replace(/^(\d[\d.]*)\s+trees$/, "$1 pohon")
      .replace(/^Target:\s+(\d[\d.]*)\s+trees$/, "Target $1 pohon")
      .replace(/Wave Breaker \(cumulative\)$/, "Wave Breaker (akumulasi)")
      .replace(/^(\d+) objects$/, "$1 objek");
  }

  function translateText(text, language) {
    const trimmed = text.trim();
    if (!trimmed) return text;
    const dictionary = language === "en" ? dictionaries.en : reverse;
    const translated = dictionary[trimmed] || translateDynamic(trimmed, language);
    if (translated === trimmed) return text;
    return text.replace(trimmed, translated);
  }

  function translateTree(root) {
    if (translating || !root) return;
    translating = true;

    const elements = root.nodeType === 1
      ? [root, ...root.querySelectorAll("*")]
      : [];

    elements.forEach(element => {
      if (["SCRIPT", "STYLE", "NOSCRIPT"].includes(element.tagName)) return;

      Array.from(element.childNodes).forEach(node => {
        if (node.nodeType === Node.TEXT_NODE) {
          node.nodeValue = translateText(node.nodeValue || "", currentLanguage);
        }
      });

      if (element.hasAttribute("placeholder")) {
        const placeholder = element.getAttribute("placeholder");
        const placeholders = {
          "Sepahat, Temiang, FDRS...": "Search Sepahat, Temiang, FDRS...",
          "Nama objek, lokasi, atau jenis monitoring": "Object name, location, or monitoring type",
          "Contoh: Nursery Sepahat": "Example: Sepahat Nursery",
          "Google Drive atau laporan PDF": "Google Drive or PDF report"
        };
        const placeholderReverse = Object.fromEntries(
          Object.entries(placeholders).map(([id, en]) => [en, id])
        );
        const replacement = currentLanguage === "en"
          ? placeholders[placeholder]
          : placeholderReverse[placeholder];
        if (replacement) element.setAttribute("placeholder", replacement);
      }
    });

    document.documentElement.lang = currentLanguage;
    const page = (location.pathname.split("/").pop() || "index.html").toLowerCase();
    const titles = {
      "index.html": ["YG GeoPortal | Yayasan Gambut", "Yayasan Gambut Spatial Data Platform"],
      "webgis.html": ["Peta Interaktif Yayasan Gambut", "Yayasan Gambut Interactive Map"],
      "report.html": ["Kirim Laporan | YG GeoPortal", "Submit Report | YG GeoPortal"],
      "monitoring.html": ["Dashboard Monitoring | YG GeoPortal", "Monitoring Dashboard | YG GeoPortal"]
    };
    if (titles[page]) document.title = titles[page][currentLanguage === "en" ? 1 : 0];
    document.querySelectorAll("[data-lang]").forEach(button => {
      const active = button.getAttribute("data-lang") === currentLanguage;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });

    translating = false;
  }

  function setLanguage(language) {
    currentLanguage = language === "en" ? "en" : "id";
    localStorage.setItem(STORAGE_KEY, currentLanguage);
    translateTree(document.body);
    window.dispatchEvent(new CustomEvent("yg:languagechange", {
      detail: { language: currentLanguage }
    }));
  }

  document.addEventListener("click", event => {
    const button = event.target.closest("[data-lang]");
    if (!button) return;
    setLanguage(button.getAttribute("data-lang"));
  });

  const observer = new MutationObserver(records => {
    records.forEach(record => {
      record.addedNodes.forEach(node => {
        if (node.nodeType === 1) translateTree(node);
        if (node.nodeType === 3 && node.parentElement) translateTree(node.parentElement);
      });
    });
  });

  function initialize() {
    translateTree(document.body);
    observer.observe(document.body, { childList: true, subtree: true });
  }

  window.YG_I18N = {
    get language() { return currentLanguage; },
    setLanguage
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize, { once: true });
  } else {
    initialize();
  }
})();
