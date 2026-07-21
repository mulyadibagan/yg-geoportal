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

  function numericValue(props, keys) {
    const raw = firstValue(props || {}, keys);
    if (!raw) return 0;
    const normalized = raw.replace(/\s+/g, "")
      .replace(/\.(?=\d{3}(?:\D|$))/g, "")
      .replace(",", ".").replace(/[^0-9.-]/g, "");
    const value = Number(normalized);
    return Number.isFinite(value) ? value : 0;
  }

  function sumProperties(features, keys) {
    return features.reduce((total, feature) =>
      total + numericValue((feature && feature.properties) || {}, keys), 0);
  }

  function officialMetric(mappedValue, reportValue) {
    const mapped = Number(mappedValue || 0);
    const report = Number(reportValue || 0);
    if (mapped <= 0) return report;
    return report > 0 && mapped > report ? report : mapped;
  }

  function progressFromSnapshot(mappedValue, baselineValue, snapshotValue) {
    const mapped = Number(mappedValue || 0);
    const baseline = Number(baselineValue || 0);
    const snapshot = Number(snapshotValue || 0);
    return baseline + Math.max(0, mapped - snapshot);
  }

  function setMetric(id, value, digits = 0, suffix = "") {
    const element = document.getElementById(id);
    if (element) element.textContent = formatNumber(value, digits) + suffix;
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
    let donor = firstValue(props, [
      "Donor", "Nama_Donor", "Funding_Source",
      "donor", "nama_donor", "funding_source"
    ]);
    if (!donor) {
      let nested = props && (
        props.targetFeatureProperties || props.proposedChanges
      );
      if (typeof nested === "string") {
        try {
          nested = JSON.parse(nested);
        } catch (error) {
          nested = {};
        }
      }
      donor = firstValue(nested || {}, [
        "Donor", "Nama_Donor", "Funding_Source",
        "donor", "nama_donor", "funding_source"
      ]);
    }
    const normalized = donor.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const aliases = {
      aramco: "Aramco Asia Singapore",
      "aramco asia singapore": "Aramco Asia Singapore",
      ppcf: "Pan Pacific Conservation Foundation (PPCF)",
      "pan pacific conservation foundation": "Pan Pacific Conservation Foundation (PPCF)",
      "pan pacific conservation foundation ppcf": "Pan Pacific Conservation Foundation (PPCF)"
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
            Status_Objek: (feature.properties || {}).Status_Objek || "Aktif",
            Donor: source.id === "area_mangrove"
              ? "Aramco Asia Singapore"
              : (feature.properties || {}).Donor,
            Donor_Cluster: source.id === "area_mangrove"
              ? "Aramco Asia Singapore"
              : (feature.properties || {}).Donor_Cluster
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

  function applyPematangDukuDonorPolicy(feature) {
    const props = feature && feature.properties || {};
    const village = firstValue(props, [
      "Desa", "WADMKD", "NAMA_DESA", "village", "locationName"
    ]).toLowerCase();

    if (village.includes("pematang duku")) {
      props.Donor = "Pan Pacific Conservation Foundation";
      props.Donor_Cluster = "Pan Pacific Conservation Foundation";
    }
    return feature;
  }

  function applyAramcoCoastalAssetPolicy(feature) {
    const props = feature && feature.properties || {};
    const layerId = layerIdOf(feature).toLowerCase();

    if (layerId === "nursery_mangrove" || layerId === "apo") {
      props.Donor = "Aramco Asia Singapore";
      props.Donor_Cluster = "Aramco Asia Singapore";
    }
    return feature;
  }

  function applyExternalPeatInfrastructureDonorPolicy(feature) {
    const props = feature && feature.properties || {};
    const layerId = layerIdOf(feature).toLowerCase();
    const village = firstValue(props, [
      "Desa", "WADMKD", "NAMA_DESA", "village", "locationName"
    ]).toLowerCase();

    if ((layerId === "sekat_kanal" || layerId === "fdrs") &&
        !village.includes("pematang duku")) {
      props.Donor = "Global Environment Centre";
      props.Donor_Cluster = "Global Environment Centre";
    }
    return feature;
  }

  function applyRequestedDonorCorrections(feature) {
    const props = feature && feature.properties || {};
    const layerId = layerIdOf(feature).toLowerCase();
    const reportId = firstValue(props, [
      "reportId", "Report_ID", "Source_Report_ID"
    ]).toUpperCase();
    const identity = [
      props.title, props.locationName, props.Nama_Objek,
      props.description, props.Keterangan
    ].filter(Boolean).join(" ").toLowerCase();
    let donor = "";

    if (layerId === "kopi") donor = "Global Environment Centre";
    if (identity.includes("rumah jemur semi permanen kopi liberika") ||
        identity.includes("menara tampung air nursery ktwmj")) {
      donor = "Yayasan Penabulu";
    }
    if (!identity.includes("menara tampung air") &&
        (identity.includes("nursery ktwmj desa temiang") ||
        identity.includes("nursery ktwmj"))) {
      donor = "Global Environment Centre";
    }
    if (identity.includes("plang restorasi hutan adat imbo putui") ||
        identity.includes("restorasi hutan adat imbo putui") ||
        identity.includes("lokasi pup 2") ||
        reportId === "COMMUNITY-YG-20260713-192917-711") {
      donor = "Aliansi Kolibri";
    }
    if (reportId === "COMMUNITY-YG-20260716-163039-924") {
      donor = "Aramco Asia Singapore";
    }
    if (donor) {
      props.Donor = donor;
      props.Donor_Cluster = donor;
    }
    return feature;
  }

  async function renderDashboard(data) {
    if (!data || data.type !== "FeatureCollection" || !Array.isArray(data.features)) {
      document.getElementById("dashboard-updated").textContent =
        "Respons database tidak valid.";
      return;
    }

    const mergedFeatures = (await mergeOfficialLayers(data.features))
      .map(applyPematangDukuDonorPolicy)
      .map(applyAramcoCoastalAssetPolicy)
      .map(applyExternalPeatInfrastructureDonorPolicy)
      .map(applyRequestedDonorCorrections);
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

      // Pekanbaru saat ini bukan wilayah cakupan program lapangan.
      // Objeknya tetap tersedia di database dan WebGIS, tetapi tidak dihitung
      // pada ringkasan wilayah cakupan di halaman beranda.
      if (regency && regency.toLowerCase() !== "pekanbaru") {
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

    // WebGIS adalah sumber utama. Laporan menjadi fallback bila belum ada
    // data spasial dan menjadi batas resmi bila jumlah WebGIS lebih besar.
    const assetsFor = donor => active.filter(feature =>
      donorOf((feature && feature.properties) || {}) === donor
    );
    const layerAssets = (features, ids) => {
      const allowed = new Set(ids.map(id => id.toLowerCase()));
      return features.filter(feature =>
        allowed.has(layerIdOf(feature).toLowerCase())
      );
    };
    const villageCount = features => new Set(features.map(feature =>
      firstValue((feature && feature.properties) || {}, [
        "Desa", "WADMKD", "NAMA_DESA", "village", "locationName"
      ]).toLowerCase()
    ).filter(Boolean)).size;

    const aramcoAssets = assetsFor("Aramco Asia Singapore");
    // Seluruh layer resmi area_mangrove merupakan cakupan Aramco. Ambil
    // langsung dari layer agar polygon lama tanpa atribut Donor tetap dihitung.
    const aramcoMangrove = layerAssets(active, ["area_mangrove"]);
    const aramcoProgrammeAssets = [...aramcoAssets, ...aramcoMangrove];
    const aramcoNurseries = layerAssets(aramcoAssets, [
      "nursery_mangrove", "persemaian_mangrove"
    ]);
    const aramcoWave = layerAssets(aramcoAssets, ["apo"]);
    const aramcoMonitoring = layerAssets(aramcoAssets, ["monitoring_reports"]);
    setMetric("aramco-tree-count", officialMetric(sumProperties(aramcoMangrove,
      ["Jumlah_Bibit", "Jumlah bibit", "jumlah_bibit", "Pohon"]), 42545));
    setMetric("aramco-village-count",
      officialMetric(villageCount(aramcoProgrammeAssets), 4));
    const aramcoMappedArea = sumProperties(aramcoMangrove,
      ["Luas_Ha", "Luas", "luas_ha"]);
    // Baseline resmi dikunci. Snapshot 13,2240266364 ha mewakili seluruh
    // polygon yang sudah ada saat baseline 13,1 ha ditetapkan. Hanya tambahan
    // luas setelah snapshot ini yang menambah angka dashboard.
    setMetric("aramco-area-count", progressFromSnapshot(
      aramcoMappedArea, 13.1, 13.2240266364
    ), 2, " ha");
    // Empat rumah bibit adalah baseline resmi; objek kelima dan seterusnya
    // yang masuk WebGIS akan menaikkan angka secara otomatis.
    setMetric("aramco-nursery-count", Math.max(4, aramcoNurseries.length));
    setMetric("aramco-wave-count", officialMetric(sumProperties(aramcoWave,
      ["Panjang_m", "Panjang", "panjang_m", "Length_m"]), 300), 0, " m");
    setMetric("aramco-monitoring-count",
      officialMetric(aramcoMonitoring.length, 100));
    setMetric("aramco-participant-count", officialMetric(0, 1200), 0, "+");

    const ppcfAssets = assetsFor("Pan Pacific Conservation Foundation (PPCF)");
    const ppcfCoffeeAreas = layerAssets(ppcfAssets, ["area_kopi"]);
    const ppcfCoffee = layerAssets(ppcfAssets, ["kopi", "nursery_kopi"]);
    const ppcfCanals = layerAssets(ppcfAssets, ["sekat_kanal"]);
    const ppcfFdrs = layerAssets(ppcfAssets, ["fdrs"]);
    setMetric("ppcf-location-count", officialMetric(villageCount(ppcfAssets), 1));
    setMetric("ppcf-area-count", officialMetric(sumProperties(ppcfCoffeeAreas,
      ["Luas_Ha", "Luas", "luas_ha"]), 3.6), 2, " ha");
    setMetric("ppcf-planted-count", officialMetric(sumProperties(ppcfCoffeeAreas,
      ["Jumlah_Bibit", "Jumlah bibit", "jumlah_bibit", "Bibit_Ditanam"]), 4000));
    setMetric("ppcf-nursery-seedling-count", officialMetric(sumProperties(ppcfCoffee,
      ["Jumlah_Bibit", "Jumlah bibit", "jumlah_bibit", "Bibit"]), 4500));
    setMetric("ppcf-canal-count", officialMetric(ppcfCanals.length, 4));
    setMetric("ppcf-fdrs-count", officialMetric(ppcfFdrs.length, 3));

    const gecAssets = assetsFor("Global Environment Centre");
    const gecCanals = layerAssets(gecAssets, ["sekat_kanal"]);
    const gecFdrs = layerAssets(gecAssets, ["fdrs"]);
    const officialGecCanals = officialMetric(gecCanals.length, 7);
    const officialGecFdrs = officialMetric(gecFdrs.length, 5);
    setMetric("gec-canal-count", officialGecCanals);
    setMetric("gec-fdrs-count", officialGecFdrs);

    const fdrsVillages = [...new Set(gecFdrs.map(feature =>
      firstValue((feature && feature.properties) || {}, [
        "Desa", "WADMKD", "NAMA_DESA", "village", "locationName"
      ])
    ).filter(Boolean))].sort((a, b) => a.localeCompare(b, "id"));
    gecDetails.fdrs = '<h4>Fire Danger Rating System (FDRS)</h4>' +
      '<p>' + formatNumber(officialGecFdrs) +
      ' unit FDRS aktif terpetakan di WebGIS. Pilih lokasi untuk melihat titiknya.</p>' +
      '<div class="funding-location-grid">' +
      fdrsVillages.map(village =>
        '<a href="' + escapeHtml(mapUrl({
          donor: "Global Environment Centre",
          layer: "fdrs",
          village
        })) + '">' + escapeHtml(village) + ' <span>→</span></a>'
      ).join("") + '</div>';

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

    const ppcfName = "Pan Pacific Conservation Foundation (PPCF)";
    const aramcoName = "Aramco Asia Singapore";
    const gecName = "Global Environment Centre";
    const donorEntries = Object.entries(donors)
      .sort((a, b) => b[1] - a[1]);
    if (!donorEntries.some(([name]) => name === aramcoName)) {
      donorEntries.unshift([aramcoName, 0]);
    }
    if (!donorEntries.some(([name]) => name === ppcfName)) {
      donorEntries.unshift([ppcfName, 0]);
    }
    if (!donorEntries.some(([name]) => name === gecName)) {
      donorEntries.push([gecName, 0]);
    }
    document.getElementById("donor-grid").innerHTML = donorEntries.length
      ? donorEntries.map(([name, count]) => {
          const programCount = Object.keys(donorPrograms[name] || {}).length;
          if (name === "Pan Pacific Conservation Foundation (PPCF)") {
            return '<button class="category-card dashboard-link funding-card" type="button" data-open-ppcf>' +
              '<i class="category-icon" aria-hidden="true">🤝</i>' +
              '<span>' + escapeHtml(name) + '</span>' +
              '<strong>2025\u20132026</strong>' +
              '<small>Pematang Duku \u00b7 lihat ringkasan program</small>' +
            '</button>';
          }
          if (name === "Aramco Asia Singapore") {
            return '<button class="category-card dashboard-link funding-card" type="button" data-open-aramco>' +
              '<i class="category-icon" aria-hidden="true">🌿</i>' +
              '<span>' + escapeHtml(name) + '</span>' +
              '<strong>2023–Sekarang</strong>' +
              '<small>4 desa · lihat ringkasan program</small>' +
            '</button>';
          }
          if (name === "Global Environment Centre") {
            return '<button class="category-card dashboard-link funding-card" type="button" data-open-gec>' +
              '<i class="category-icon" aria-hidden="true">💧</i>' +
              '<span>' + escapeHtml(name) + '</span>' +
              '<strong>2021–2025</strong>' +
              '<small>Bengkalis &amp; Siak · lihat ringkasan program</small>' +
            '</button>';
          }
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

  const ppcfDashboard = document.getElementById("ppcf-dashboard");
  const ppcfDetail = document.getElementById("ppcf-detail");
  const aramcoDashboard = document.getElementById("aramco-dashboard");
  const aramcoDetail = document.getElementById("aramco-detail");
  const gecDashboard = document.getElementById("gec-dashboard");
  const gecDetail = document.getElementById("gec-detail");
  const ppcfDetails = {
    training: '<h4>Pelatihan PPCF</h4><div class="funding-detail-grid"><article><strong>69 peserta</strong><span>Pelatihan pengelolaan gambut berkelanjutan dan pertanian tanpa bakar · 7 Agustus 2025</span></article><article><strong>50 peserta</strong><span>Pelatihan agroforestri kopi Liberika, termasuk 13 perempuan · 19 Desember 2025</span></article></div>',
    market: '<h4>Kemitraan pasar kopi</h4><p>MoU antara Kelompok Tani Ketiau Jaya dan Suvarnabhumi Coffee ditandatangani pada 20 Januari 2026. Suvarnabhumi Coffee bertindak sebagai calon pembeli utama kopi Liberika sesuai mutu, harga, dan kapasitas pasokan yang disepakati.</p><a href="webgis.html?layer=kopi&amp;village=Pematang+Duku">Lihat lokasi kelompok tani →</a>'
  };
  const aramcoDetails = {
    nursery: '<h4>Rumah Bibit Mangrove</h4><p>Pilih desa untuk langsung menuju lokasi rumah bibit di peta.</p><div class="funding-location-grid"><a href="webgis.html?layer=nursery_mangrove&amp;village=Buruk+Bakul">Desa Buruk Bakul <span>→</span></a><a href="webgis.html?layer=nursery_mangrove&amp;village=Kelapa+Pati">Desa Kelapa Pati <span>→</span></a><a href="webgis.html?layer=nursery_mangrove&amp;village=Sepahat">Desa Sepahat <span>→</span></a><a href="webgis.html?layer=nursery_mangrove&amp;village=Tanjung+Kuras">Desa Tanjung Kuras <span>→</span></a></div>',
    wave: '<h4>Hybrid Engineering (Wave Breaker)</h4><p>Pilih segmen untuk melakukan zoom ke lokasi di peta.</p><div class="funding-location-grid"><a href="webgis.html?layer=apo&amp;village=Buruk+Bakul"><b>200 meter</b> – Desa Buruk Bakul <span>→</span></a><a href="webgis.html?layer=apo&amp;village=Kelapa+Pati"><b>100 meter</b> – Desa Kelapa Pati <span>→</span></a></div>'
  };
  const gecDetails = {
    fdrs: '<h4>Fire Danger Rating System (FDRS)</h4><p>Pilih lokasi untuk melihat titik FDRS yang tercantum dalam laporan program 2024.</p><div class="funding-location-grid"><a href="webgis.html?layer=fdrs&amp;village=Tanjung+Kuras">Tanjung Kuras <span>→</span></a><a href="webgis.html?layer=fdrs&amp;village=Simpang+Ayam">Simpang Ayam <span>→</span></a></div>',
    coffee: '<h4>Penanaman Kopi Liberika</h4><p>Pilih lokasi untuk melihat data lapangan penanaman kopi.</p><div class="funding-location-grid"><a href="webgis.html?layer=kopi&amp;village=Temiang"><b>1.700 bibit</b> – Temiang <span>→</span></a><a href="webgis.html?layer=kopi&amp;village=Tanjung+Kuras"><b>1.100 bibit</b> – Tanjung Kuras <span>→</span></a><a href="webgis.html?layer=kopi&amp;village=Buruk+Bakul"><b>600 bibit</b> – Buruk Bakul <span>→</span></a></div>',
    training: '<h4>Pelatihan Program GEC</h4><div class="funding-detail-grid"><article><strong>22 peserta</strong><span>Pelatihan pembibitan kopi Liberika · Temiang · 28 Oktober 2024</span></article><article><strong>50 peserta</strong><span>Pelatihan pemeliharaan dan panen kopi Liberika · Temiang · 29 Oktober 2025</span></article></div>'
  };
  function openFundingDashboard(dashboard) {
    dashboard.hidden = false;
    document.body.classList.add("modal-open");
  }
  function closeFundingDashboard(dashboard, detail) {
    dashboard.hidden = true;
    if (detail) detail.hidden = true;
    document.body.classList.remove("modal-open");
  }
  document.addEventListener("click", event => {
    if (event.target.closest("[data-open-ppcf]")) {
      openFundingDashboard(ppcfDashboard);
    }
    if (event.target.closest("[data-open-aramco]")) {
      openFundingDashboard(aramcoDashboard);
    }
    if (event.target.closest("[data-open-gec]")) {
      openFundingDashboard(gecDashboard);
    }
    if (event.target.closest("[data-close-ppcf]")) {
      closeFundingDashboard(ppcfDashboard, ppcfDetail);
    }
    if (event.target.closest("[data-close-aramco]")) {
      closeFundingDashboard(aramcoDashboard, aramcoDetail);
    }
    if (event.target.closest("[data-close-gec]")) {
      closeFundingDashboard(gecDashboard, gecDetail);
    }
    const detailButton = event.target.closest("[data-ppcf-detail]");
    if (detailButton) {
      ppcfDetail.innerHTML = ppcfDetails[detailButton.dataset.ppcfDetail] || "";
      ppcfDetail.hidden = false;
      ppcfDetail.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
    const aramcoDetailButton = event.target.closest("[data-aramco-detail]");
    if (aramcoDetailButton) {
      aramcoDetail.innerHTML = aramcoDetails[aramcoDetailButton.dataset.aramcoDetail] || "";
      aramcoDetail.hidden = false;
      aramcoDetail.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
    const gecDetailButton = event.target.closest("[data-gec-detail]");
    if (gecDetailButton) {
      gecDetail.innerHTML = gecDetails[gecDetailButton.dataset.gecDetail] || "";
      gecDetail.hidden = false;
      gecDetail.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  });
  document.addEventListener("keydown", event => {
    if (event.key !== "Escape") return;
    if (!ppcfDashboard.hidden) {
      closeFundingDashboard(ppcfDashboard, ppcfDetail);
    }
    if (!aramcoDashboard.hidden) {
      closeFundingDashboard(aramcoDashboard, aramcoDetail);
    }
    if (!gecDashboard.hidden) {
      closeFundingDashboard(gecDashboard, gecDetail);
    }
  });
})();
