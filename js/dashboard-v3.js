(() => {
  "use strict";

  const API = "https://script.google.com/macros/s/AKfycbxUe4QyBvSiL9UJsL-nsJ5XrohDabwqhYYR9q5CTgLYiW1ZCfVy429iMlpU-lCDUSvvRg/exec?page=objects";
  const CALLBACK = "ygDashboardV3Callback";
  const OFFICIAL_LAYERS = [
    { id: "area_mangrove", url: "data/area_mangrove.geojson" },
    { id: "area_kopi", url: "data/area_kopi.geojson" }
  ];

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, char => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[char]);
  }

  function formatNumber(value, digits = 0) {
    return new Intl.NumberFormat("id-ID", { maximumFractionDigits: digits })
      .format(Number(value || 0));
  }

  function layerIdOf(feature) {
    const props = feature.properties || {};
    return String(props.Layer_ID || props.Source_Layer || "").trim();
  }

  function firstValue(props, keys) {
    for (const key of keys) {
      const value = String(props[key] == null ? "" : props[key]).trim();
      if (value) return value;
    }
    return "";
  }

  function programOf(props, layerId) {
    if (layerId === "desa_intervensi" || layerId === "titik_desa") return "";

    const explicit = firstValue(props, [
      "Program", "Nama_Program", "Program_Name", "program", "program_name"
    ]);
    if (explicit) {
      const aliases = {
        mangrove: "Restorasi Mangrove",
        "penanaman mangrove": "Restorasi Mangrove",
        "restorasi mangrove": "Restorasi Mangrove",
        gambut: "Restorasi Gambut",
        "restorasi gambut": "Restorasi Gambut",
        fdrs: "Pencegahan Kebakaran",
        "pencegahan kebakaran": "Pencegahan Kebakaran",
        kopi: "Agroforestri & Kopi Liberika",
        agroforestri: "Agroforestri & Kopi Liberika",
        "agroforestri/kopi": "Agroforestri & Kopi Liberika",
        "kopi liberika": "Agroforestri & Kopi Liberika",
        "monitoring program": "Monitoring Lapangan",
        "monitoring lapangan": "Monitoring Lapangan",
        "laporan masyarakat": "Laporan Masyarakat"
      };
      return aliases[explicit.toLowerCase()] || explicit;
    }

    const programByLayer = {
      area_mangrove: "Restorasi Mangrove",
      nursery_mangrove: "Restorasi Mangrove",
      persemaian_mangrove: "Restorasi Mangrove",
      apo: "Restorasi Mangrove",
      fdrs: "Pencegahan Kebakaran",
      fire: "Pencegahan Kebakaran",
      kebakaran: "Pencegahan Kebakaran",
      sekat_kanal: "Restorasi Gambut",
      gambut: "Restorasi Gambut",
      area_kopi: "Agroforestri & Kopi Liberika",
      kopi: "Agroforestri & Kopi Liberika",
      nursery_kopi: "Agroforestri & Kopi Liberika",
      community_reports: "Laporan Masyarakat",
      monitoring_reports: "Monitoring Lapangan",
    };
    if (programByLayer[layerId]) return programByLayer[layerId];
    return firstValue(props, ["Kategori", "Layer_Label"]) || "Program Lainnya";
  }

  function increment(map, key) {
    const label = String(key || "").trim();
    if (!label) return;
    map[label] = (map[label] || 0) + 1;
  }

  function donorOf(props) {
    const donor = firstValue(props, [
      "Donor", "Nama_Donor", "Funding_Source",
      "donor", "nama_donor", "funding_source"
    ]);
    const normalized = donor.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const aliases = {
      aramco: "Aramco Asia Singapore",
      "aramco asia singapore": "Aramco Asia Singapore"
    };
    return aliases[normalized] || donor;
  }

  function donorSearchTerm(donor) {
    return donor === "Aramco Asia Singapore" ? "Aramco" : donor;
  }

  function mapUrl(params) {
    return "webgis.html?" + new URLSearchParams(params).toString();
  }

  function renderRanking(elementId, data, linkBuilder, limit = 8) {
    const element = document.getElementById(elementId);
    const entries = Object.entries(data)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, limit);

    element.innerHTML = entries.length
      ? entries.map(([name, item], index) =>
          '<a class="ranking-row dashboard-link" href="' +
            escapeHtml(linkBuilder(name, item)) + '">' +
            '<span class="ranking-number">' + (index + 1) + '</span>' +
            '<span class="ranking-name">' + escapeHtml(name) + '</span>' +
            '<strong>' + formatNumber(item.count) + '</strong>' +
          '</a>'
        ).join("")
      : '<div class="dashboard-empty">Belum ada data.</div>';
  }

  async function mergeOfficialLayers(features) {
    let merged = features.slice();

    for (const source of OFFICIAL_LAYERS) {
      try {
        const response = await fetch(source.url + "?t=" + Date.now(), {
          cache: "no-store"
        });
        if (!response.ok) throw new Error("HTTP " + response.status);
        const data = await response.json();
        if (!data || !Array.isArray(data.features)) continue;

        const official = data.features.map(feature => ({
          ...feature,
          properties: {
            ...(feature.properties || {}),
            Layer_ID: source.id,
            Source_Layer: source.id,
            Status_Objek: (feature.properties || {}).Status_Objek || "Aktif"
          }
        }));

        if (source.id === "area_kopi") {
          const sourceReportIds = new Set(
            official
              .map(feature => String(
                (feature.properties || {}).Source_Report_ID || ""
              ).trim().toLowerCase())
              .filter(Boolean)
          );
          merged = merged.filter(feature => {
            const props = feature.properties || {};
            const reportId = String(
              props.reportId || props.Report_ID || props.Source_Report_ID || ""
            ).trim().toLowerCase();
            return !sourceReportIds.has(reportId);
          });
        } else {
          merged = merged.filter(feature => layerIdOf(feature) !== source.id);
        }
        merged.push(...official);
      } catch (error) {
        console.warn("Layer resmi dashboard gagal dimuat:", source.id, error);
      }
    }

    return merged;
  }

  async function renderDashboard(data) {
    if (!data || data.type !== "FeatureCollection" || !Array.isArray(data.features)) {
      document.getElementById("dashboard-updated").textContent =
        "Respons database tidak valid.";
      return;
    }

    const mergedFeatures = await mergeOfficialLayers(data.features);
    const active = mergedFeatures.filter(feature => {
      if (!feature || !feature.geometry) return false;
      const props = feature.properties || {};
      return String(props.Status_Objek || "Aktif").toLowerCase() !== "nonaktif";
    });

    const regencies = new Set();
    const villages = new Set();
    const programs = {};
    const programLayers = {};
    const donors = {};
    const donorPrograms = {};
    const regencyCounts = {};
    let mangroveArea = 0;
    let reports = 0;

    active.forEach(feature => {
      const props = feature.properties || {};
      const layerId = layerIdOf(feature);
      const regency = firstValue(props, [
        "Kabupaten", "Kab_Kota", "KAB_KOTA", "WADMKK", "regency"
      ]);
      const village = firstValue(props, [
        "Desa", "WADMKD", "village"
      ]);
      const program = programOf(props, layerId);
      const donor = donorOf(props);

      if (regency) {
        regencies.add(regency.toLowerCase());
        if (!regencyCounts[regency]) regencyCounts[regency] = { count: 0 };
        regencyCounts[regency].count += 1;
      }
      if (village) villages.add(village.toLowerCase());

      if (program) {
        increment(programs, program);
        if (!programLayers[program]) programLayers[program] = {};
        programLayers[program][layerId] =
          (programLayers[program][layerId] || 0) + 1;
      }

      if (donor) {
        increment(donors, donor);
        if (!donorPrograms[donor]) donorPrograms[donor] = {};
        if (program) {
          donorPrograms[donor][program] =
            (donorPrograms[donor][program] || 0) + 1;
        }
      }

      if (layerId === "area_mangrove") {
        mangroveArea += Number(props.Luas_Ha || props.Luas || 0);
      }
      if (layerId === "community_reports" || props.Source_Type === "community_report") {
        reports += 1;
      }
    });

    document.getElementById("dash-regencies").textContent = formatNumber(regencies.size);
    document.getElementById("dash-villages").textContent = formatNumber(villages.size);
    document.getElementById("dash-mangrove-area").textContent =
      formatNumber(mangroveArea, 2) + " ha";
    document.getElementById("dash-reports").textContent = formatNumber(reports);

    const programCategories = [
      "Restorasi Mangrove",
      "Restorasi Gambut",
      "Agroforestri & Kopi Liberika",
      "Pencegahan Kebakaran",
      "Monitoring Lapangan",
      "Laporan Masyarakat"
    ];
    const programIcons = {
      "Restorasi Mangrove": "🌊",
      "Restorasi Gambut": "💧",
      "Agroforestri & Kopi Liberika": "☕",
      "Pencegahan Kebakaran": "🔥",
      "Monitoring Lapangan": "📍",
      "Laporan Masyarakat": "📋"
    };
    document.getElementById("category-grid").innerHTML = programCategories
      .map(name => [name, programs[name] || 0])
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => {
        const layerEntries = Object.entries(programLayers[name] || {})
          .sort((a, b) => b[1] - a[1]);
        const layerId = layerEntries.length ? layerEntries[0][0] : "";
        return '<a class="category-card dashboard-link" href="' +
          escapeHtml(mapUrl({ layer: layerId })) + '">' +
          '<i class="category-icon" aria-hidden="true">' +
            escapeHtml(programIcons[name] || "•") + '</i>' +
          '<span>' + escapeHtml(name) + '</span>' +
          '<strong>' + formatNumber(count) + '</strong>' +
        '</a>';
      }).join("");

    const donorEntries = Object.entries(donors)
      .sort((a, b) => b[1] - a[1]);
    document.getElementById("donor-grid").innerHTML = donorEntries.length
      ? donorEntries.map(([name, count]) => {
          const programCount = Object.keys(donorPrograms[name] || {}).length;
          const donorUrl = mapUrl({ search: donorSearchTerm(name) });
          return '<a class="category-card dashboard-link" href="' +
            escapeHtml(donorUrl) + '">' +
            '<span>' + escapeHtml(name) + '</span>' +
            '<strong>' + formatNumber(count) + '</strong>' +
            '<small>' + formatNumber(programCount) +
              ' program</small>' +
          '</a>';
        }).join("")
      : '<div class="dashboard-empty">Belum ada data</div>';

    renderRanking(
      "regency-ranking",
      regencyCounts,
      name => mapUrl({ search: name })
    );
    document.getElementById("dashboard-updated").textContent =
      "Sumber: Master Database + layer resmi WebGIS · " +
      "diperbarui " +
      new Date(data.generatedAt || Date.now()).toLocaleString("id-ID");
  }

  window[CALLBACK] = data => {
    renderDashboard(data).catch(error => {
      console.error(error);
      document.getElementById("dashboard-updated").textContent =
        "Dashboard belum dapat disusun. Muat ulang halaman.";
    });
  };

  const script = document.createElement("script");
  script.src = API + "&callback=" + CALLBACK + "&t=" + Date.now();
  script.async = true;
  script.onerror = function() {
    document.getElementById("dashboard-updated").textContent =
      "Master Database belum dapat dimuat. Periksa deployment Apps Script.";
  };
  document.head.appendChild(script);
})();
