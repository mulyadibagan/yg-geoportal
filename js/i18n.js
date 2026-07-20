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
        .replace(/ objek · diperbarui /, " objects · updated ")
        .replace(/^Layer berhasil dimuat/, "Layers loaded")
        .replace(/ pembaruan publik diterapkan$/, " public updates applied")
        .replace(/^Mengambil objek dari Master Database/, "Retrieving objects from the Master Database")
        .replace(/ objek dari Master Database berhasil dimuat$/, " objects loaded from the Master Database");
    }

    return text
      .replace(/^Source: Master Database/, "Sumber: Master Database")
      .replace(/ objects · updated /, " objek · diperbarui ")
      .replace(/^Layers loaded/, "Layer berhasil dimuat")
      .replace(/ public updates applied$/, " pembaruan publik diterapkan")
      .replace(/^Retrieving objects from the Master Database/, "Mengambil objek dari Master Database")
      .replace(/ objects loaded from the Master Database$/, " objek dari Master Database berhasil dimuat");
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
        if (currentLanguage === "en" && placeholder === "Sepahat, Temiang, FDRS...") {
          element.setAttribute("placeholder", "Search Sepahat, Temiang, FDRS...");
        } else if (currentLanguage === "id" && placeholder === "Search Sepahat, Temiang, FDRS...") {
          element.setAttribute("placeholder", "Sepahat, Temiang, FDRS...");
        }
      }
    });

    document.documentElement.lang = currentLanguage;
    document.title = currentLanguage === "en"
      ? "Yayasan Gambut Interactive Map"
      : "Peta Interaktif Yayasan Gambut";
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
