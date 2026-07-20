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

  function increment(map, key) {
    const label = String(key || "").trim();
    if (!label) return;
    map[label] = (map[label] || 0) + 1;
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

    const villages = new Set();
    const categories = {};
    const categoryLayers = {};
    const layers = {};
    const villageCounts = {};
    let mangroveArea = 0;
    let reports = 0;

    active.forEach(feature => {
      const props = feature.properties || {};
      const layerId = layerIdOf(feature);
      const village = props.Desa || props.WADMKD || props.village;
      const category = props.Kategori || props.Layer_Label || "Lainnya";
      const layerLabel = props.Layer_Label || layerId || "Lainnya";

      if (village) {
        villages.add(String(village).trim().toLowerCase());
        if (!villageCounts[village]) villageCounts[village] = { count: 0 };
        villageCounts[village].count += 1;
      }

      increment(categories, category);
      if (!categoryLayers[category]) categoryLayers[category] = {};
      categoryLayers[category][layerId] =
        (categoryLayers[category][layerId] || 0) + 1;

      if (!layers[layerLabel]) layers[layerLabel] = { count: 0, layerId };
      layers[layerLabel].count += 1;

      if (layerId === "area_mangrove") {
        mangroveArea += Number(props.Luas_Ha || props.Luas || 0);
      }
      if (layerId === "community_reports" || props.Source_Type === "community_report") {
        reports += 1;
      }
    });

    document.getElementById("dash-objects").textContent = formatNumber(active.length);
    document.getElementById("dash-villages").textContent = formatNumber(villages.size);
    document.getElementById("dash-mangrove-area").textContent =
      formatNumber(mangroveArea, 2) + " ha";
    document.getElementById("dash-reports").textContent = formatNumber(reports);

    document.getElementById("category-grid").innerHTML = Object.entries(categories)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => {
        const layerEntries = Object.entries(categoryLayers[name] || {})
          .sort((a, b) => b[1] - a[1]);
        const layerId = layerEntries.length ? layerEntries[0][0] : "";
        return '<a class="category-card dashboard-link" href="' +
          escapeHtml(mapUrl({ layer: layerId })) + '">' +
          '<span>' + escapeHtml(name) + '</span>' +
          '<strong>' + formatNumber(count) + '</strong>' +
          '<small>objek aktif · klik untuk melihat peta</small>' +
        '</a>';
      }).join("");

    renderRanking(
      "village-ranking",
      villageCounts,
      name => mapUrl({ village: name })
    );
    renderRanking(
      "layer-ranking",
      layers,
      (_name, item) => mapUrl({ layer: item.layerId })
    );

    document.getElementById("dashboard-updated").textContent =
      "Sumber: Master Database + layer resmi WebGIS · " +
      formatNumber(active.length) +
      " objek aktif · diperbarui " +
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
