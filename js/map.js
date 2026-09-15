(() => {
  "use strict";

  const CONFIG = window.YG_LAYER_CONFIG || [];
  const MASTER_OBJECTS_API = "https://script.google.com/macros/s/AKfycbxUe4QyBvSiL9UJsL-nsJ5XrohDabwqhYYR9q5CTgLYiW1ZCfVy429iMlpU-lCDUSvvRg/exec?page=objects";
  const DATABASE_COLORS = [
    "#00796b", "#1565c0", "#e65100", "#7b1fa2",
    "#2e7d32", "#c62828", "#6d4c41", "#00838f",
    "#8fa600", "#455a64", "#ad1457", "#5e35b1"
  ];
  let databaseFeaturesByLayer = Object.create(null);
  let databaseSourceReady = false;
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

  const REFERENCE_LAYERS = {
    kawasan_hutan_sk_903: {
      id: "kawasan_hutan_sk_903",
      label: "Kawasan Hutan SK 903",
      file: "data/kawasan_hutan_sk_903.geojson",
      color: "#455a64",
      count: 4185,
      type: "forest"
    },
    gambut_bbsdlp_2019: {
      id: "gambut_bbsdlp_2019",
      label: "Peta Gambut BBSDLP 2019",
      file: "data/Gambut_BBSDLP_2019.geojson",
      color: "#6a4a3a",
      count: 736,
      type: "peat"
    }
  };

  const referenceLayerObjects = {};
  const referenceLayerState = {};


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


  function geometryTypeToConfigType(geometryType) {
    const value = String(geometryType || "");
    if (value.includes("Point")) return "point";
    if (value.includes("Line")) return "line";
    return "polygon";
  }

  function colorForLayer(layerId) {
    let hash = 0;
    const value = String(layerId || "");
    for (let index = 0; index < value.length; index += 1) {
      hash = ((hash << 5) - hash) + value.charCodeAt(index);
      hash |= 0;
    }
    return DATABASE_COLORS[Math.abs(hash) % DATABASE_COLORS.length];
  }

  function appendDynamicLayerUi(config, count) {
    const layerList = document.querySelector(".layer-list");
    const legend = document.querySelector(".legend");

    if (
      layerList &&
      !document.querySelector('[data-layer-id="' + config.id + '"]')
    ) {
      const row = document.createElement("div");
      row.className = "layer-row database-layer-row";
      row.innerHTML =
        '<input id="layer-' + escapeHtml(config.id) +
          '" data-layer-id="' + escapeHtml(config.id) +
          '" type="checkbox" checked>' +
        '<span class="swatch" style="background:' +
          escapeHtml(config.color) + '"></span>' +
        '<label for="layer-' + escapeHtml(config.id) + '">' +
          escapeHtml(config.label) + '</label>' +
        '<span class="count">' + Number(count || 0) + '</span>';
      layerList.appendChild(row);
    }

    if (
      legend &&
      !document.getElementById("legend-db-" + config.id)
    ) {
      const item = document.createElement("div");
      item.className = "legend-item";
      item.id = "legend-db-" + config.id;
      item.innerHTML =
        '<span class="legend-mark ' +
          (config.type === "point" ? "point" : "") +
          '" style="background:' + escapeHtml(config.color) + '"></span>' +
        '<span>' + escapeHtml(config.label) + '</span>';
      legend.appendChild(item);
    }
  }

  function forestColor(value) {
    const key = String(value || "").toUpperCase();

    const colors = {
      "APL": "#FFFFFF",
      "HPK": "#FEA9A9",
      "HPT": "#C0FEA7",
      "HP": "#FEFEAA",
      "HL": "#7BFB00",
      "CA": "#C589FE",
      "KSA/KPA": "#C589FE",
      "TN": "#C589FE",
      "SM": "#C589FE",
      "SA": "#C589FE",
      "TWA": "#C589FE"
    };

    return colors[key] || "#78909c";
  }

  function peatColor(value) {
    const text = String(value || "");

    if (text.indexOf(">700") !== -1) return "#4a148c";
    if (text.indexOf("500-<700") !== -1) return "#6a1b9a";
    if (text.indexOf("300-<500") !== -1) return "#8e24aa";
    if (text.indexOf("200-<300") !== -1) return "#ab47bc";
    if (text.indexOf("100-<200") !== -1) return "#ce93d8";
    if (text.indexOf("50-<100") !== -1) return "#e1bee7";

    return "#b39ddb";
  }

  function referenceStyle(config, feature) {
    const props = feature.properties || {};

    if (config.type === "forest") {
      const color = forestColor(props.fungsi);

      return {
        color: color,
        weight: 0.8,
        opacity: 0.85,
        fillColor: color,
        fillOpacity: 0.23
      };
    }

    if (config.type === "peat") {
      const color = peatColor(props.KELAS_GBT || props.KETEBALAN);

      return {
        color: color,
        weight: 0.7,
        opacity: 0.8,
        fillColor: color,
        fillOpacity: 0.20
      };
    }

    return {
      color: config.color,
      weight: 0.9,
      opacity: 0.9,
      fillColor: config.color,
      fillOpacity: config.type === "social_forestry" ? 0.26 : 0.16
    };
  }

  function referencePopup(config, feature) {
    const props = feature.properties || {};
    let rows = "";

    function item(label, value) {
      if (
        value === null ||
        value === undefined ||
        String(value).trim() === ""
      ) {
        return "";
      }

      return (
        '<div class="popup-row">' +
          '<b>' + escapeHtml(label) + '</b>' +
          '<span>' + escapeHtml(value) + '</span>' +
        '</div>'
      );
    }

    if (config.type === "forest") {
      rows += item("Fungsi kawasan", props.fungsi || "Belum terisi");
      rows += item("Sumber", "Kawasan Hutan SK 903");
    } else if (config.type === "peat") {
      rows += item("Kabupaten/Kota", props.KABKOT || props.KK);
      rows += item("Kelas gambut", props.KELAS_GBT);
      rows += item("Ketebalan", props.KETEBALAN);
    } else {
      Object.keys(props).slice(0, 8).forEach(key => {
        rows += item(key, props[key]);
      });
    }

    return (
      '<div class="popup-card">' +
        '<div class="popup-head" style="background:' +
          escapeHtml(config.color) + '">' +
          '<strong>' + escapeHtml(config.label) + '</strong>' +
          '<span>Layer referensi — tidak dihitung dalam dashboard</span>' +
        '</div>' +
        '<div class="popup-body">' + rows + '</div>' +
      '</div>'
    );
  }

  async function loadReferenceLayer(layerId) {
    const config = REFERENCE_LAYERS[layerId];
    if (!config) throw new Error("Konfigurasi layer referensi tidak ditemukan.");
    if (referenceLayerObjects[layerId]) return referenceLayerObjects[layerId];
    if (referenceLayerState[layerId] === "loading") return null;

    referenceLayerState[layerId] = "loading";
    updateStatus();

    const response = await fetch(config.file + "?v=20260721-ref2", { cache: "force-cache" });
    if (!response.ok) {
      referenceLayerState[layerId] = "error";
      throw new Error("HTTP " + response.status);
    }

    const data = await response.json();
    if (!data || data.type !== "FeatureCollection" || !Array.isArray(data.features)) {
      referenceLayerState[layerId] = "error";
      throw new Error("GeoJSON referensi tidak valid.");
    }

    const layer = L.geoJSON(data, {
      style: feature => referenceStyle(config, feature),
      onEachFeature: (feature, leafletLayer) => {
        leafletLayer.bindPopup(referencePopup(config, feature), { maxWidth: 360 });
      }
    });

    referenceLayerObjects[layerId] = layer;
    referenceLayerState[layerId] = "ready";
    config.count = data.features.length;

    const countElement = document.querySelector('[data-reference-count-id="' + layerId + '"]');
    if (countElement) countElement.textContent = new Intl.NumberFormat("id-ID").format(config.count);

    updateStatus();
    return layer;
  }

  function appendReferenceControls(list, legend) {
    Object.keys(REFERENCE_LAYERS).forEach(layerId => {
      const config = REFERENCE_LAYERS[layerId];
      const row = document.createElement("div");
      row.className = "layer-row reference-layer-row";
      row.innerHTML =
        '<input id="layer-' + escapeHtml(layerId) + '" data-reference-layer-id="' + escapeHtml(layerId) + '" type="checkbox">' +
        '<span class="swatch" style="background:' + escapeHtml(config.color) + '"></span>' +
        '<label for="layer-' + escapeHtml(layerId) + '">' + escapeHtml(config.label) + '</label>' +
        '<span class="count" data-reference-count-id="' + escapeHtml(layerId) + '">' +
        (Number.isFinite(config.count) ? new Intl.NumberFormat("id-ID").format(config.count) : "…") +
        '</span>';
      list.appendChild(row);

      const checkbox = row.querySelector("input");
      checkbox.addEventListener("change", async event => {
        checkbox.disabled = true;
        try {
          if (event.target.checked) {
            const layer = await loadReferenceLayer(layerId);
            if (layer) layer.addTo(map);
          } else {
            const layer = referenceLayerObjects[layerId];
            if (layer && map.hasLayer(layer)) map.removeLayer(layer);
          }
        } catch (error) {
          console.error("Layer referensi gagal dimuat:", layerId, error);
          event.target.checked = false;
        } finally {
          checkbox.disabled = false;
        }
      });

      const legendItem = document.createElement("div");
      legendItem.className = "legend-item";
      legendItem.innerHTML =
        '<span class="legend-mark" style="background:' + escapeHtml(config.color) + '"></span>' +
        '<span>' + escapeHtml(config.label) + '</span>';
      legend.appendChild(legendItem);
    });
  }

  function updateLayerUiCount(layerId, count) {
    const checkbox = document.querySelector(
      '[data-layer-id="' + layerId + '"]'
    );
    const row = checkbox && checkbox.closest(".layer-row");
    const countElement = row && row.querySelector(".count");
    if (countElement) countElement.textContent = String(count);
  }

  function loadMasterDatabase() {
    return new Promise((resolve, reject) => {
      const callbackName =
        "ygMasterObjectsCallback_" + Date.now();

      const script = document.createElement("script");
      const timeout = window.setTimeout(() => {
        cleanup();
        reject(new Error("Waktu pemuatan database habis."));
      }, 25000);

      function cleanup() {
        window.clearTimeout(timeout);
        try { delete window[callbackName]; } catch (error) {}
        script.remove();
      }

      window[callbackName] = data => {
        cleanup();

        if (
          !data ||
          data.type !== "FeatureCollection" ||
          !Array.isArray(data.features)
        ) {
          reject(new Error("Respons database bukan FeatureCollection."));
          return;
        }

        databaseFeaturesByLayer = Object.create(null);

        data.features.forEach(feature => {
          const properties = feature.properties || {};
          const layerId =
            properties.Layer_ID ||
            properties.layerId ||
            "lainnya";

          if (!databaseFeaturesByLayer[layerId]) {
            databaseFeaturesByLayer[layerId] = [];
          }

          databaseFeaturesByLayer[layerId].push(feature);
        });

        Object.keys(databaseFeaturesByLayer).forEach((layerId, index) => {
          if (CONFIG.some(item => item.id === layerId)) return;

          const firstFeature = databaseFeaturesByLayer[layerId][0] || {};
          const props = firstFeature.properties || {};

          const dynamicConfig = {
            id: layerId,
            label:
              props.Layer_Label ||
              props.Kategori ||
              layerId.replace(/_/g, " "),
            color: colorForLayer(layerId),
            type: geometryTypeToConfigType(
              firstFeature.geometry && firstFeature.geometry.type
            ),
            visible: layerId === "community_reports"
          };

          CONFIG.push(dynamicConfig);
          appendDynamicLayerUi(
            dynamicConfig,
            databaseFeaturesByLayer[layerId].length
          );
        });

        databaseSourceReady = true;
        resolve(data);
      };

      script.onerror = () => {
        cleanup();
        reject(new Error("Endpoint database tidak dapat diakses."));
      };

      script.src =
        MASTER_OBJECTS_API +
        "&callback=" +
        encodeURIComponent(callbackName) +
        "&t=" +
        Date.now();

      script.async = true;
      document.head.appendChild(script);
    });
  }

  async function getLayerFeatureCollection(config) {
    const databaseFeatures =
      databaseFeaturesByLayer[config.id];

    if (databaseFeatures && databaseFeatures.length) {
      return {
        type: "FeatureCollection",
        features: databaseFeatures
      };
    }

    const response = await fetch(
      "data/" + config.id + ".geojson",
      { cache: "no-store" }
    );

    if (!response.ok) {
      throw new Error("HTTP " + response.status);
    }

    return response.json();
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
      const data = await getLayerFeatureCollection(config);
      let geoLayer;

      const filteredData = { ...data };

      geoLayer = L.geoJSON(filteredData, {
        style: () => ({
          color: config.color,
          fillColor: config.color,
          fillOpacity: config.type === "line" ? 0.10 : 0.24,
          weight: config.type === "line" ? 4 : 2.2,
          opacity: 0.95
        }),
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
      updateLayerUiCount(
        config.id,
        Array.isArray(data.features) ? data.features.length : 0
      );
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

  function finishMapInitialization() {
    searchIndex = buildSearchIndex();

    if (allBounds.isValid()) {
      map.fitBounds(allBounds, { padding: [24, 24] });
    }

    requestAnimationFrame(() => map.invalidateSize(true));
    setTimeout(() => map.invalidateSize(true), 300);
    setTimeout(() => map.invalidateSize(true), 1000);
  }

  loadMasterDatabase()
    .catch(error => {
      console.warn(
        "Database OBJECTS gagal dimuat; menggunakan GeoJSON GitHub sebagai cadangan.",
        error
      );
      databaseSourceReady = false;
    })
    .then(() => Promise.allSettled(CONFIG.map(loadLayer)))
    .then(finishMapInitialization);

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
