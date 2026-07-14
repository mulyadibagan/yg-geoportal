(() => {
  "use strict";

  const API = "https://script.google.com/macros/s/AKfycbxeGTDZXkR0DyLZmBHTq2M-52Iu4dTTGpH164S7sYHg8qPzvffobC6-r-TBLVHMT3HU-A/exec?page=objects";
  const DEFAULT_VIEW = [1.25, 102.05];
  const DEFAULT_ZOOM = 9;

  const STYLE = {
    desa_intervensi: { label: "Batas Desa Intervensi", color: "#2e7d32", visible: true },
    apo: { label: "Alat Pemecah Ombak (APO)", color: "#d32f2f", visible: true },
    area_mangrove: { label: "Area Penanaman Mangrove", color: "#00796b", visible: true },
    monitoring_reports: { label: "Hasil Monitoring Terverifikasi", color: "#f9a825", visible: true },
    community_reports: { label: "Laporan Masyarakat Terverifikasi", color: "#7b1fa2", visible: true },
    titik_desa: { label: "Titik Desa Intervensi", color: "#1565c0", visible: false },
    kopi: { label: "Distribusi Lahan Kopi", color: "#6d4c41", visible: true },
    fdrs: { label: "FDRS / Water Table", color: "#e65100", visible: true },
    sekat_kanal: { label: "Sekat Kanal", color: "#00838f", visible: true },
    nursery_mangrove: { label: "Pembibitan Mangrove", color: "#8fa600", visible: true },
    kawasan_hutan_sk_903: { label: "Kawasan Hutan SK 903", color: "#455a64", visible: false }
  };

  const EXTRA_COLORS = [
    "#ad1457", "#5e35b1", "#0277bd", "#558b2f",
    "#ef6c00", "#6a1b9a", "#00897b", "#37474f"
  ];

  const map = L.map("map", {
    zoomControl: true,
    preferCanvas: true
  }).setView(DEFAULT_VIEW, DEFAULT_ZOOM);

  const baseMaps = {
    "OpenStreetMap": L.tileLayer(
      "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors"
      }
    ),
    "Satelit": L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      {
        maxZoom: 19,
        attribution: "Tiles &copy; Esri"
      }
    )
  };

  baseMaps.OpenStreetMap.addTo(map);
  L.control.layers(baseMaps, null, { position: "topright" }).addTo(map);

  const layerObjects = {};
  const layerConfigs = {};
  const searchItems = [];
  let allBounds = L.latLngBounds([]);
  let rawFeatures = [];

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);
  }

  function hashColor(value) {
    let hash = 0;
    const text = String(value || "");
    for (let i = 0; i < text.length; i += 1) {
      hash = ((hash << 5) - hash) + text.charCodeAt(i);
      hash |= 0;
    }
    return EXTRA_COLORS[Math.abs(hash) % EXTRA_COLORS.length];
  }

  function getLayerId(feature) {
    const props = feature.properties || {};
    return props.Layer_ID || props.Source_Layer || "lainnya";
  }

  function getObjectName(feature) {
    const props = feature.properties || {};
    return props.Nama_Objek || props.title || props.NAMOBJ || props.Desa || props.WADMKD || "Objek WebGIS";
  }

  function getLayerConfig(layerId, feature) {
    if (layerConfigs[layerId]) return layerConfigs[layerId];

    const props = feature && feature.properties || {};
    const preset = STYLE[layerId] || {};

    layerConfigs[layerId] = {
      id: layerId,
      label: preset.label || props.Layer_Label || props.Kategori || layerId.replace(/_/g, " "),
      color: preset.color || hashColor(layerId),
      visible: typeof preset.visible === "boolean" ? preset.visible : false
    };

    return layerConfigs[layerId];
  }

  function driveId(url) {
    const text = String(url || "");
    const match =
      text.match(/\/d\/([A-Za-z0-9_-]+)/) ||
      text.match(/[?&]id=([A-Za-z0-9_-]+)/);
    return match ? match[1] : "";
  }

  function photoThumb(url) {
    const id = driveId(url);
    return id
      ? "https://drive.google.com/thumbnail?id=" + encodeURIComponent(id) + "&sz=w800"
      : url;
  }

  function photoOriginal(url) {
    const id = driveId(url);
    return id
      ? "https://drive.google.com/file/d/" + encodeURIComponent(id) + "/view"
      : url;
  }

  function buildPopup(feature, config) {
    const props = feature.properties || {};
    const hidden = new Set([
      "geometry", "Source_Layer", "Source_Type", "Status_Objek",
      "Revision", "X", "Y", "OBJECTID", "FID", "FID_1"
    ]);

    const preferred = [
      "Object_ID", "Nama_Objek", "Kategori", "Program", "Fase", "Tahun",
      "Kabupaten", "Kecamatan", "Desa", "Luas_Ha", "Panjang_M",
      "Jumlah_Tanam", "Monitoring_ID", "Monitoring_Type", "Kondisi",
      "Survival", "Jumlah_Hidup", "Jumlah_Mati_Rusak",
      "Luas_Terpantau_Ha", "Tinggi_Rata_Rata_Cm",
      "Diameter_Rata_Rata_Cm", "Sedimentasi_Cm", "Water_Table_Cm",
      "Ancaman", "Temuan", "Tindak_Lanjut", "activityDate", "description"
    ];

    const keys = [];
    preferred.forEach(key => {
      if (Object.prototype.hasOwnProperty.call(props, key)) keys.push(key);
    });
    Object.keys(props).forEach(key => {
      if (!keys.includes(key)) keys.push(key);
    });

    let rows = "";
    keys.forEach(key => {
      const value = props[key];
      if (
        hidden.has(key) ||
        value === null ||
        value === "" ||
        typeof value === "undefined" ||
        typeof value === "object"
      ) return;

      const label = key
        .replace(/_/g, " ")
        .replace(/\b\w/g, char => char.toUpperCase());

      rows +=
        '<div class="popup-row"><b>' + escapeHtml(label) +
        '</b><span>' + escapeHtml(value) + '</span></div>';
    });

    const photos = Array.isArray(props.photos)
      ? props.photos
      : [props.Foto, props.Foto_2].filter(Boolean);

    let gallery = "";
    if (photos.length) {
      gallery =
        '<div class="yg-v3-gallery">' +
        photos.map((url, index) =>
          '<a href="' + escapeHtml(photoOriginal(url)) +
          '" target="_blank" rel="noopener">' +
          '<img src="' + escapeHtml(photoThumb(url)) +
          '" loading="lazy" alt="Foto ' + (index + 1) + '"></a>'
        ).join("") +
        '</div>';
    }

    return (
      '<div class="popup-card">' +
        '<div class="popup-head" style="background:' + escapeHtml(config.color) + '">' +
          '<strong>' + escapeHtml(getObjectName(feature)) + '</strong>' +
          '<span>' + escapeHtml(config.label) + '</span>' +
        '</div>' +
        '<div class="popup-body">' + rows + gallery + '</div>' +
      '</div>'
    );
  }

  function styleFor(config) {
    const monitoring = config.id === "monitoring_reports";
    return {
      color: config.color,
      weight: monitoring ? 4 : 2.5,
      opacity: 0.95,
      dashArray: monitoring ? "8 5" : null,
      fillColor: config.color,
      fillOpacity: monitoring ? 0.12 : 0.2
    };
  }

  function pointFor(config, latlng) {
    return L.circleMarker(latlng, {
      radius: config.id === "monitoring_reports" ? 9 : 7,
      fillColor: config.color,
      color: "#ffffff",
      weight: 2,
      opacity: 1,
      fillOpacity: 0.96
    });
  }

  function addFeatureToSearch(feature, layer, parent, config) {
    const props = feature.properties || {};
    const searchText = [
      getObjectName(feature),
      config.label,
      props.Object_ID,
      props.Kategori,
      props.Program,
      props.Kabupaten,
      props.Kecamatan,
      props.Desa,
      props.WADMKD,
      props.WADMKC,
      props.WADMKK,
      props.Monitoring_Type,
      props.description
    ].filter(Boolean).join(" ").toLowerCase();

    searchItems.push({
      text: searchText,
      label: getObjectName(feature),
      meta: [props.Desa || props.WADMKD, config.label].filter(Boolean).join(" · "),
      layer: layer,
      parent: parent
    });
  }

  function createLayer(layerId, features) {
    const config = getLayerConfig(layerId, features[0]);
    const group = L.featureGroup();

    features.forEach(feature => {
      try {
        const single = L.geoJSON(feature, {
          style: () => styleFor(config),
          pointToLayer: (_feature, latlng) => pointFor(config, latlng)
        });

        single.eachLayer(layer => {
          layer.bindPopup(buildPopup(feature, config), { maxWidth: 400 });
          addFeatureToSearch(feature, layer, group, config);
          group.addLayer(layer);
        });
      } catch (error) {
        console.error("Feature gagal diproses:", layerId, feature, error);
      }
    });

    layerObjects[layerId] = group;

    const bounds = group.getBounds();
    if (bounds.isValid()) allBounds.extend(bounds);

    if (config.visible) group.addTo(map);
  }

  function renderLayerControls(groups) {
    const list = document.getElementById("layer-list");
    const legend = document.getElementById("legend");

    list.innerHTML = "";
    legend.innerHTML = "";

    Object.keys(groups)
      .sort((a, b) =>
        getLayerConfig(a, groups[a][0]).label.localeCompare(
          getLayerConfig(b, groups[b][0]).label,
          "id"
        )
      )
      .forEach(layerId => {
        const config = getLayerConfig(layerId, groups[layerId][0]);
        const count = groups[layerId].length;

        const row = document.createElement("div");
        row.className = "layer-row";
        row.innerHTML =
          '<input id="layer-' + escapeHtml(layerId) +
          '" data-layer-id="' + escapeHtml(layerId) +
          '" type="checkbox"' + (config.visible ? " checked" : "") + '>' +
          '<span class="swatch" style="background:' + escapeHtml(config.color) + '"></span>' +
          '<label for="layer-' + escapeHtml(layerId) + '">' + escapeHtml(config.label) + '</label>' +
          '<span class="count">' + count + '</span>';

        list.appendChild(row);

        row.querySelector("input").addEventListener("change", event => {
          const layer = layerObjects[layerId];
          if (!layer) return;
          if (event.target.checked) layer.addTo(map);
          else map.removeLayer(layer);
        });

        const legendItem = document.createElement("div");
        legendItem.className = "legend-item";
        const geometryType =
          groups[layerId][0].geometry &&
          groups[layerId][0].geometry.type || "";
        const pointClass = geometryType.includes("Point") ? " point" : "";

        legendItem.innerHTML =
          '<span class="legend-mark' + pointClass +
          '" style="background:' + escapeHtml(config.color) + '"></span>' +
          '<span>' + escapeHtml(config.label) + '</span>';

        legend.appendChild(legendItem);
      });
  }

  function updateStats(features) {
    const villages = new Set();
    let mangroveArea = 0;
    let fdrs = 0;
    let canalBlocks = 0;

    features.forEach(feature => {
      const props = feature.properties || {};
      const layerId = getLayerId(feature);
      const village = props.Desa || props.WADMKD || props.village;

      if (village) villages.add(String(village).trim().toLowerCase());
      if (layerId === "area_mangrove") mangroveArea += Number(props.Luas_Ha || 0);
      if (layerId === "fdrs") fdrs += 1;
      if (layerId === "sekat_kanal") canalBlocks += 1;
    });

    const setText = (id, value) => {
      const element = document.getElementById(id);
      if (element) element.textContent = value;
    };

    setText("stat-villages", new Intl.NumberFormat("id-ID").format(villages.size));
    setText(
      "stat-mangrove-area",
      new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(mangroveArea) + " ha"
    );
    setText("stat-fdrs", fdrs);
    setText("stat-canal-blocks", canalBlocks);
  }

  function renderSearch(query) {
    const results = document.getElementById("search-results");
    const value = String(query || "").trim().toLowerCase();

    if (!value) {
      results.hidden = true;
      results.innerHTML = "";
      return;
    }

    const matches = searchItems
      .filter(item => item.text.includes(value))
      .slice(0, 12);

    if (!matches.length) {
      results.innerHTML = '<div class="yg-search-empty">Objek tidak ditemukan.</div>';
      results.hidden = false;
      return;
    }

    results.innerHTML = "";

    matches.forEach(item => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "yg-search-result";
      button.innerHTML =
        '<strong>' + escapeHtml(item.label) + '</strong>' +
        '<span>' + escapeHtml(item.meta || "Objek WebGIS") + '</span>';

      button.addEventListener("click", () => {
        if (!map.hasLayer(item.parent)) item.parent.addTo(map);

        if (item.layer.getBounds) {
          const bounds = item.layer.getBounds();
          if (bounds && bounds.isValid()) {
            map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
          }
        } else if (item.layer.getLatLng) {
          map.setView(item.layer.getLatLng(), 16);
        }

        item.layer.openPopup();
        results.hidden = true;
      });

      results.appendChild(button);
    });

    results.hidden = false;
  }

  function setStatus(message, error) {
    const box = document.getElementById("status-box");
    const text = document.getElementById("status-text");

    if (box) {
      box.classList.toggle("error", Boolean(error));
      box.classList.toggle("ok", !error);
    }

    if (text) text.textContent = message;
  }

  function initialize(data) {
    if (!data || data.type !== "FeatureCollection" || !Array.isArray(data.features)) {
      setStatus("Respons database tidak valid.", true);
      return;
    }

    rawFeatures = data.features.filter(feature => feature && feature.geometry);
    const groups = {};

    rawFeatures.forEach(feature => {
      const layerId = getLayerId(feature);
      if (!groups[layerId]) groups[layerId] = [];
      groups[layerId].push(feature);
    });

    updateStats(rawFeatures);

    Object.keys(groups).forEach(layerId => {
      try {
        createLayer(layerId, groups[layerId]);
      } catch (error) {
        console.error("Layer gagal diproses:", layerId, error);
      }
    });

    renderLayerControls(groups);

    if (allBounds.isValid()) {
      map.fitBounds(allBounds, { padding: [24, 24], maxZoom: 13 });
    }

    const updated = document.getElementById("database-updated");
    if (updated) {
      updated.textContent =
        "Sumber: Master Database · " +
        new Intl.NumberFormat("id-ID").format(rawFeatures.length) +
        " objek · diperbarui " +
        new Date(data.generatedAt || Date.now()).toLocaleString("id-ID");
    }

    setStatus(
      rawFeatures.length + " objek dari Master Database berhasil dimuat",
      false
    );

    requestAnimationFrame(() => map.invalidateSize(true));
    setTimeout(() => map.invalidateSize(true), 400);
  }

  function loadByJsonp() {
    return new Promise((resolve, reject) => {
      const callbackName = "ygObjectsV4_" + Date.now();
      const script = document.createElement("script");
      const timer = window.setTimeout(() => {
        script.remove();
        try { delete window[callbackName]; } catch (error) {}
        reject(new Error("JSONP tidak memberi respons."));
      }, 30000);

      window[callbackName] = data => {
        window.clearTimeout(timer);
        script.remove();
        try { delete window[callbackName]; } catch (error) {}
        resolve(data);
      };

      script.src =
        API +
        "&callback=" +
        encodeURIComponent(callbackName) +
        "&t=" +
        Date.now();
      script.async = true;
      script.onerror = () => {
        window.clearTimeout(timer);
        script.remove();
        try { delete window[callbackName]; } catch (error) {}
        reject(new Error("Script JSONP gagal dimuat."));
      };

      document.head.appendChild(script);
    });
  }

  async function loadDatabase() {
    setStatus("Mengambil objek dari Master Database…", false);

    try {
      const response = await fetch(API + "&t=" + Date.now(), {
        method: "GET",
        cache: "no-store",
        redirect: "follow"
      });

      if (!response.ok) throw new Error("HTTP " + response.status);

      const data = await response.json();
      initialize(data);
      return;
    } catch (fetchError) {
      console.warn("Fetch gagal, mencoba JSONP.", fetchError);
    }

    try {
      const data = await loadByJsonp();
      initialize(data);
    } catch (jsonpError) {
      console.error("Master Database gagal dimuat.", jsonpError);
      setStatus("Database gagal dimuat: " + jsonpError.message, true);

      const updated = document.getElementById("database-updated");
      if (updated) {
        updated.textContent =
          "Koneksi database gagal. Buka Console browser untuk detail.";
      }
    }
  }

  const searchInput = document.getElementById("search-input");
  const searchButton = document.getElementById("search-button");

  if (searchInput) {
    searchInput.addEventListener("input", event =>
      renderSearch(event.target.value)
    );
  }

  if (searchButton) {
    searchButton.addEventListener("click", () =>
      renderSearch(searchInput ? searchInput.value : "")
    );
  }

  document.addEventListener("click", event => {
    if (!event.target.closest(".search")) {
      const results = document.getElementById("search-results");
      if (results) results.hidden = true;
    }
  });

  const fitAll = document.getElementById("fit-all");
  if (fitAll) {
    fitAll.addEventListener("click", () => {
      if (allBounds.isValid()) {
        map.fitBounds(allBounds, { padding: [24, 24], maxZoom: 13 });
      }
    });
  }

  const resetMap = document.getElementById("reset-map");
  if (resetMap) {
    resetMap.addEventListener("click", () =>
      map.setView(DEFAULT_VIEW, DEFAULT_ZOOM)
    );
  }

  const locateMe = document.getElementById("locate-me");
  if (locateMe) {
    locateMe.addEventListener("click", () =>
      map.locate({ setView: true, maxZoom: 15 })
    );
  }

  document.querySelectorAll("[data-focus-layer]").forEach(card => {
    card.addEventListener("click", () => {
      const layerId = card.getAttribute("data-focus-layer");
      const layer = layerObjects[layerId];
      if (!layer) return;

      if (!map.hasLayer(layer)) layer.addTo(map);

      const bounds = layer.getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [30, 30], maxZoom: 15 });
      }
    });
  });

  window.YG_MAP = {
    map: map,
    layerObjects: layerObjects,
    searchItems: searchItems,
    get rawFeatures() {
      return rawFeatures;
    }
  };

  loadDatabase();
})();
