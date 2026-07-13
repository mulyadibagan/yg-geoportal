(() => {
  "use strict";

  const CONFIG = window.YG_LAYER_CONFIG || [];
  const DEFAULT_CENTER = [1.15, 101.95];
  const DEFAULT_ZOOM = 8;

  const mapElement = document.getElementById("map");
  if (!mapElement || typeof L === "undefined") {
    console.error("Leaflet atau elemen #map tidak tersedia.");
    return;
  }

  const map = L.map(mapElement, {
    zoomControl: true,
    preferCanvas: true,
    minZoom: 6
  }).setView(DEFAULT_CENTER, DEFAULT_ZOOM);

  const osm = L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors"
    }
  ).addTo(map);

  const satellite = L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    {
      maxZoom: 19,
      attribution: "Tiles &copy; Esri"
    }
  );

  L.control.layers(
    {
      "Peta Jalan": osm,
      "Citra Satelit": satellite
    },
    null,
    {
      position: "topright",
      collapsed: false
    }
  ).addTo(map);

  L.control.scale({ imperial: false, position: "bottomleft" }).addTo(map);

  const layerObjects = {};
  const allBounds = L.latLngBounds([]);
  const searchable = [];
  let searchIndex = [];
  let success = 0;
  let failed = 0;

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);
  }

  function prettyKey(key) {
    const labels = {
      NAMOBJ: "Nama Desa",
      WADMKD: "Desa",
      WADMKC: "Kecamatan",
      WADMKK: "Kabupaten",
      WADMPR: "Provinsi",
      NAMA_DESA: "Desa",
      NAMA_KEC: "Kecamatan",
      NAMA_KAB: "Kabupaten",
      NAMA_PROV: "Provinsi",
      Luas_Ha: "Luas (ha)",
      Panjang_M: "Panjang (m)",
      Ket: "Keterangan",
      Keterangan: "Keterangan",
      Tahun: "Tahun"
    };
    return labels[key] || key.replace(/_/g, " ");
  }

  function hiddenField(key) {
    return [
      "Id","No","OBJECTID","FID_1","KODE_DESA","KODE_KEC",
      "KODE_KAB","KODE_PROV","SRS_ID","iddesa","X","Y",
      "UUPP","REMARK","Foto","Foto_2"
    ].includes(key);
  }

  function popupHtml(feature, config) {
    const props = feature.properties || {};
    let rows = "";

    Object.entries(props).forEach(([key, value]) => {
      if (
        value === null ||
        value === "" ||
        typeof value === "undefined" ||
        hiddenField(key)
      ) return;

      rows += `
        <div class="popup-row">
          <b>${escapeHtml(prettyKey(key))}</b>
          <span>${escapeHtml(value)}</span>
        </div>`;
    });

    if (!rows) {
      rows = `<div class="popup-row"><span>Informasi atribut belum tersedia.</span></div>`;
    }

    return `
      <div class="popup-card">
        <div class="popup-head" style="background:${config.color}">
          <strong>${escapeHtml(config.label)}</strong>
          <span>Data spasial Yayasan Gambut</span>
        </div>
        ${rows}
      </div>`;
  }

  function updateStatus() {
    const box = document.getElementById("status-box");
    const text = document.getElementById("status-text");
    const total = CONFIG.length;

    if (success + failed < total) {
      text.textContent = `Memuat ${success + failed} dari ${total} layer...`;
      return;
    }

    if (failed === 0) {
      box.classList.add("ok");
      text.textContent = `Semua ${total} layer berhasil dimuat`;
    } else {
      box.classList.add("error");
      text.textContent = `${success} layer berhasil, ${failed} gagal`;
    }
  }

  async function loadLayer(config) {
    try {
      const response = await fetch(`data/${config.id}.geojson`, { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      let geoLayer;

      geoLayer = L.geoJSON(data, {
        style: (feature) => {
          // Warna default dari config
          let layerColor = config.color;
          let layerFillOpacity = config.type === "line" ? 0.10 : 0.24;
          let layerWeight = config.type === "line" ? 4 : 2.2;

          // Pengecekan khusus untuk Kawasan Hutan (misalnya dari layer dengan ID tertentu)
          // Asumsi config.id 'kawasan_hutan' atau cek jika properti 'Fungsi' tersedia
          if (feature.properties && feature.properties.Fungsi) {
            switch (String(feature.properties.Fungsi).toUpperCase()) {
              case 'HL': // Hutan Lindung
                layerColor = '#2E7D32'; // Hijau tua
                break;
              case 'KSA/KPA': // Kawasan Suaka Alam / Pelestarian Alam
                layerColor = '#6A1B9A'; // Ungu
                break;
              case 'HP': // Hutan Produksi Tetap
                layerColor = '#D84315'; // Merah bata
                break;
              case 'HPT': // Hutan Produksi Terbatas
                layerColor = '#F9A825'; // Kuning gelap
                break;
              case 'HPK': // Hutan Produksi yang dapat Dikonversi
                layerColor = '#FBC02D'; // Kuning
                break;
              case 'APL': // Area Penggunaan Lain
                layerColor = '#9E9E9E'; // Abu-abu
                break;
            }
            // Sedikit pertebal opacity untuk kawasan hutan agar lebih jelas
            layerFillOpacity = 0.6;
            layerWeight = 1.5;
          }

          return {
            color: layerColor,
            fillColor: layerColor,
            fillOpacity: layerFillOpacity,
            weight: layerWeight,
            opacity: 0.95
          };
        },
        pointToLayer: (feature, latlng) => L.circleMarker(latlng, {
          radius: 7,
          fillColor: config.color,
          color: "#fff",
          weight: 1.7,
          opacity: 1,
          fillOpacity: 0.96
        }),
        onEachFeature: (feature, featureLayer) => {
          featureLayer.bindPopup(popupHtml(feature, config), { maxWidth: 330 });

          const values = Object.values(feature.properties || {}).join(" ");
          searchable.push({
            text: `${config.label} ${values}`.toLowerCase(),
            layer: featureLayer,
            parent: geoLayer
          });
        }
      });

      layerObjects[config.id] = geoLayer;
      if (config.visible) geoLayer.addTo(map);

      const bounds = geoLayer.getBounds();
      if (bounds && bounds.isValid()) allBounds.extend(bounds);

      const checkbox = document.querySelector(`[data-layer-id="${config.id}"]`);
      checkbox?.addEventListener("change", () => {
        if (checkbox.checked) geoLayer.addTo(map);
        else map.removeLayer(geoLayer);
      });

      success += 1;
    } catch (error) {
      console.error(`Gagal memuat ${config.id}:`, error);
      failed += 1;

      const checkbox = document.querySelector(`[data-layer-id="${config.id}"]`);
      if (checkbox) {
        checkbox.disabled = true;
        checkbox.closest(".layer-row")?.setAttribute("title", "Layer gagal dimuat");
      }
    } finally {
      updateStatus();
    }
  }

  Promise.allSettled(CONFIG.map(loadLayer)).then(() => {
    searchIndex = buildSearchIndex();

    if (allBounds.isValid()) {
      map.fitBounds(allBounds, { padding: [24, 24] });
    }

    requestAnimationFrame(() => map.invalidateSize(true));
    setTimeout(() => map.invalidateSize(true), 300);
    setTimeout(() => map.invalidateSize(true), 1000);
  });

  function fitAll() {
    if (allBounds.isValid()) map.fitBounds(allBounds, { padding: [24, 24] });
    else map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
  }

  document.getElementById("fit-all")?.addEventListener("click", fitAll);
  document.getElementById("reset-map")?.addEventListener("click", () => {
    map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
  });

  document.getElementById("locate-me")?.addEventListener("click", () => {
    map.locate({ setView: true, maxZoom: 15, enableHighAccuracy: true });
  });

  map.on("locationfound", event => {
    L.circleMarker(event.latlng, {
      radius: 8,
      fillColor: "#7b1fa2",
      color: "#fff",
      weight: 2,
      fillOpacity: 1
    }).addTo(map).bindPopup("Lokasi Anda").openPopup();
  });

  map.on("locationerror", () => {
    alert("Lokasi tidak dapat ditemukan. Pastikan izin lokasi browser aktif.");
  });

  // =========================================================
  // PENCARIAN LOKASI TERINTEGRASI
  // =========================================================
  const searchInput = document.getElementById("search-input");
  const searchButton = document.getElementById("search-button");
  const searchContainer = searchInput?.closest(".search");

  let searchResults = document.getElementById("yg-search-results");

  if (searchContainer && !searchResults) {
    searchResults = document.createElement("div");
    searchResults.id = "yg-search-results";
    searchResults.className = "yg-search-results";
    searchResults.hidden = true;
    searchContainer.appendChild(searchResults);
  }

  function normalizeSearchText(value) {
    return String(value ?? "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function getFeatureTitle(feature, fallbackLabel) {
    const props = feature?.properties || {};
    const preferredKeys = [
      "NAMOBJ",
      "NAMA_DESA",
      "WADMKD",
      "Desa",
      "desa",
      "Nama",
      "NAMA",
      "Kegiatan",
      "KEGIATAN",
      "title",
      "locationName"
    ];

    for (const key of preferredKeys) {
      const value = props[key];

      if (
        value !== null &&
        typeof value !== "undefined" &&
        String(value).trim()
      ) {
        return String(value).trim();
      }
    }

    const firstValue = Object.values(props).find(value =>
      value !== null &&
      typeof value !== "undefined" &&
      typeof value !== "object" &&
      String(value).trim()
    );

    return firstValue ? String(firstValue).trim() : fallbackLabel;
  }

  function getLayerLabel(layerId) {
    const config = CONFIG.find(item => item.id === layerId);
    return config ? config.label : layerId.replace(/_/g, " ");
  }

  function buildSearchIndex() {
    const index = [];

    Object.entries(layerObjects).forEach(([layerId, parentLayer]) => {
      if (!parentLayer || typeof parentLayer.eachLayer !== "function") return;

      const layerLabel = getLayerLabel(layerId);

      parentLayer.eachLayer(featureLayer => {
        const feature = featureLayer.feature || {};
        const props = feature.properties || {};

        const searchableText = [
          layerLabel,
          ...Object.keys(props),
          ...Object.values(props)
        ]
          .filter(value => value !== null && typeof value !== "undefined")
          .join(" ");

        index.push({
          text: normalizeSearchText(searchableText),
          title: getFeatureTitle(feature, layerLabel),
          layerLabel,
          layerId,
          parent: parentLayer,
          layer: featureLayer
        });
      });
    });

    if (
      window.YG_COMMUNITY_LAYER &&
      !layerObjects.community_reports &&
      typeof window.YG_COMMUNITY_LAYER.eachLayer === "function"
    ) {
      window.YG_COMMUNITY_LAYER.eachLayer(featureLayer => {
        const feature = featureLayer.feature || {};
        const props = feature.properties || {};

        index.push({
          text: normalizeSearchText(
            "Laporan Masyarakat Terverifikasi " +
            Object.values(props).filter(Boolean).join(" ")
          ),
          title: getFeatureTitle(feature, "Laporan Masyarakat"),
          layerLabel: "Laporan Masyarakat Terverifikasi",
          layerId: "community_reports",
          parent: window.YG_COMMUNITY_LAYER,
          layer: featureLayer
        });
      });
    }

    return index;
  }

  function closeSearchResults() {
    if (!searchResults) return;

    searchResults.hidden = true;
    searchResults.innerHTML = "";
  }

  function activateSearchLayer(item) {
    if (!map.hasLayer(item.parent)) {
      item.parent.addTo(map);
    }

    const checkbox = document.querySelector(
      `[data-layer-id="${item.layerId}"]`
    );

    if (checkbox) checkbox.checked = true;
  }

  function focusSearchResult(item) {
    activateSearchLayer(item);

    if (typeof item.layer.getLatLng === "function") {
      map.setView(item.layer.getLatLng(), 16);
    } else if (typeof item.layer.getBounds === "function") {
      const bounds = item.layer.getBounds();

      if (bounds && bounds.isValid && bounds.isValid()) {
        map.fitBounds(bounds, {
          padding: [35, 35],
          maxZoom: 16
        });
      }
    }

    if (typeof item.layer.openPopup === "function") {
      window.setTimeout(() => item.layer.openPopup(), 150);
    }

    if (searchInput) {
      searchInput.value = item.title;
      searchInput.classList.remove("search-error");
      searchInput.classList.add("search-success");
    }

    const statusText = document.getElementById("status-text");

    if (statusText) {
      statusText.textContent =
        `Lokasi ditemukan: ${item.title} — ${item.layerLabel}`;
    }

    closeSearchResults();
    window.YG_UI?.closeMobileSidebar();
  }

  function findSearchResults(query) {
    const normalizedQuery = normalizeSearchText(query);
    const words = normalizedQuery.split(" ").filter(Boolean);

    if (!searchIndex.length) {
      searchIndex = buildSearchIndex();
    }

    return searchIndex
      .filter(item => {
        return words.every(word => item.text.includes(word));
      })
      .sort((a, b) => {
        const titleA = normalizeSearchText(a.title);
        const titleB = normalizeSearchText(b.title);

        const rankA =
          titleA === normalizedQuery
            ? 0
            : titleA.startsWith(normalizedQuery)
              ? 1
              : 2;

        const rankB =
          titleB === normalizedQuery
            ? 0
            : titleB.startsWith(normalizedQuery)
              ? 1
              : 2;

        return rankA - rankB || titleA.localeCompare(titleB);
      });
  }

  function renderSearchResults(results, originalQuery) {
    if (!searchResults) return;

    searchResults.innerHTML = "";

    if (!results.length) {
      const empty = document.createElement("div");
      empty.className = "yg-search-empty";
      empty.textContent = `Lokasi "${originalQuery}" tidak ditemukan.`;

      searchResults.appendChild(empty);
      searchResults.hidden = false;

      searchInput?.classList.remove("search-success");
      searchInput?.classList.add("search-error");
      return;
    }

    results.slice(0, 10).forEach(item => {
      const resultButton = document.createElement("button");
      resultButton.type = "button";
      resultButton.className = "yg-search-result";

      const title = document.createElement("strong");
      const subtitle = document.createElement("span");

      title.textContent = item.title;
      subtitle.textContent = item.layerLabel;

      resultButton.appendChild(title);
      resultButton.appendChild(subtitle);

      resultButton.addEventListener("click", () => {
        focusSearchResult(item);
      });

      searchResults.appendChild(resultButton);
    });

    searchResults.hidden = false;
    searchInput?.classList.remove("search-error");
  }

  function runIntegratedSearch(event) {
    event?.preventDefault();
    event?.stopPropagation();

    const query = searchInput?.value.trim() || "";

    if (query.length < 2) {
      searchInput?.classList.add("search-error");
      return;
    }

    const results = findSearchResults(query);

    if (results.length === 1) {
      focusSearchResult(results[0]);
      return;
    }

    renderSearchResults(results, query);
  }

  searchButton?.addEventListener("click", runIntegratedSearch);

  searchInput?.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      runIntegratedSearch(event);
    }

    if (event.key === "Escape") {
      closeSearchResults();
    }
  });

  searchInput?.addEventListener("input", () => {
    searchInput.classList.remove("search-error", "search-success");

    const query = searchInput.value.trim();

    if (query.length < 2) {
      closeSearchResults();
      return;
    }

    renderSearchResults(findSearchResults(query), query);
  });

  document.addEventListener("click", event => {
    if (searchContainer && !searchContainer.contains(event.target)) {
      closeSearchResults();
    }
  });

  window.addEventListener("resize", () => {
    clearTimeout(window.__ygResizeTimer);
    window.__ygResizeTimer = setTimeout(() => map.invalidateSize(true), 180);
  });

  document.addEventListener("fullscreenchange", () => {
    setTimeout(() => map.invalidateSize(true), 180);
  });

  window.YG_MAP = { map, fitAll, layerObjects };

  window.YG_SEARCH = {
    rebuild: function() {
      searchIndex = buildSearchIndex();
      return searchIndex.length;
    },
    search: runIntegratedSearch
  };
})();
