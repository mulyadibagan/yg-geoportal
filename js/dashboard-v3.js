(() => {
  "use strict";

  const API = "https://script.google.com/macros/s/AKfycbxeGTDZXkR0DyLZmBHTq2M-52Iu4dTTGpH164S7sYHg8qPzvffobC6-r-TBLVHMT3HU-A/exec?page=objects";
  const CALLBACK = "ygDashboardV3Callback";

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);
  }

  function formatNumber(value, digits = 0) {
    return new Intl.NumberFormat("id-ID", {
      maximumFractionDigits: digits
    }).format(Number(value || 0));
  }

  function increment(map, key) {
    if (!key) return;
    const label = String(key).trim();
    if (!label) return;
    map[label] = (map[label] || 0) + 1;
  }

  function renderRanking(elementId, data, limit = 8) {
    const element = document.getElementById(elementId);
    const entries = Object.entries(data)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit);

    element.innerHTML = entries.length
      ? entries.map(([name, count], index) =>
          '<div class="ranking-row">' +
            '<span class="ranking-number">' + (index + 1) + '</span>' +
            '<span class="ranking-name">' + escapeHtml(name) + '</span>' +
            '<strong>' + formatNumber(count) + '</strong>' +
          '</div>'
        ).join("")
      : '<div class="dashboard-empty">Belum ada data.</div>';
  }

  window[CALLBACK] = function(data) {
    if (!data || data.type !== "FeatureCollection" || !Array.isArray(data.features)) {
      document.getElementById("dashboard-updated").textContent =
        "Respons database tidak valid.";
      return;
    }

    const active = data.features.filter(feature => {
      const props = feature.properties || {};
      return String(props.Status_Objek || "Aktif").toLowerCase() !== "nonaktif";
    });

    const villages = new Set();
    const categories = {};
    const layers = {};
    const villageCounts = {};
    let mangroveArea = 0;
    let reports = 0;

    active.forEach(feature => {
      const props = feature.properties || {};
      const village = props.Desa || props.WADMKD || props.village;
      const category = props.Kategori || props.Layer_Label || "Lainnya";
      const layer = props.Layer_Label || props.Layer_ID || "Lainnya";

      if (village) {
        villages.add(String(village).trim().toLowerCase());
        increment(villageCounts, village);
      }

      increment(categories, category);
      increment(layers, layer);

      if ((props.Layer_ID || props.Source_Layer) === "area_mangrove") {
        mangroveArea += Number(props.Luas_Ha || 0);
      }

      if (
        (props.Layer_ID || "") === "community_reports" ||
        props.Source_Type === "community_report"
      ) {
        reports += 1;
      }
    });

    document.getElementById("dash-objects").textContent = formatNumber(active.length);
    document.getElementById("dash-villages").textContent = formatNumber(villages.size);
    document.getElementById("dash-mangrove-area").textContent =
      formatNumber(mangroveArea, 2) + " ha";
    document.getElementById("dash-reports").textContent = formatNumber(reports);

    const categoryGrid = document.getElementById("category-grid");
    categoryGrid.innerHTML = Object.entries(categories)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) =>
        '<article class="category-card">' +
          '<span>' + escapeHtml(name) + '</span>' +
          '<strong>' + formatNumber(count) + '</strong>' +
          '<small>objek aktif</small>' +
        '</article>'
      ).join("");

    renderRanking("village-ranking", villageCounts);
    renderRanking("layer-ranking", layers);

    document.getElementById("dashboard-updated").textContent =
      "Sumber: YG Master Database · " +
      formatNumber(active.length) +
      " objek aktif · diperbarui " +
      new Date(data.generatedAt || Date.now()).toLocaleString("id-ID");
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
