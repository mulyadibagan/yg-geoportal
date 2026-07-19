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

  const map = L.map("map", {
    zoomControl: true,
    preferCanvas: true
  }).setView(DEFAULT_VIEW, DEFAULT_ZOOM);
  
// Scale Bar
L.control.scale({
    position: 'bottomleft',   // kiri bawah
    metric: true,             // meter & kilometer
    imperial: false,          // sembunyikan mil & feet
    maxWidth: 150
}).addTo(map);
  
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

  function normalizePhotoUrl(value) {
    return String(value || "")
      .trim()
      .replace(/^["']+|["']+$/g, "")
      .replace(/&amp;/g, "&");
  }

  function driveId(url) {
    const text = normalizePhotoUrl(url);

    const patterns = [
      /\/file\/d\/([A-Za-z0-9_-]+)/i,
      /\/d\/([A-Za-z0-9_-]+)/i,
      /[?&]id=([A-Za-z0-9_-]+)/i,
      /\/uc\?(?:[^#]*&)?id=([A-Za-z0-9_-]+)/i,
      /\/thumbnail\?(?:[^#]*&)?id=([A-Za-z0-9_-]+)/i
    ];

    for (let i = 0; i < patterns.length; i += 1) {
      const match = text.match(patterns[i]);
      if (match) return match[1];
    }

    if (/^[A-Za-z0-9_-]{20,}$/.test(text)) {
      return text;
    }

    return "";
  }

  function photoThumb(url) {
    const cleanUrl = normalizePhotoUrl(url);
    const id = driveId(cleanUrl);

    return id
      ? "https://drive.google.com/thumbnail?id=" +
          encodeURIComponent(id) +
          "&sz=w1000"
      : cleanUrl;
  }

  function photoOriginal(url) {
    const cleanUrl = normalizePhotoUrl(url);
    const id = driveId(cleanUrl);

    return id
      ? "https://drive.google.com/file/d/" +
          encodeURIComponent(id) +
          "/view?usp=sharing"
      : cleanUrl;
  }

  function photoGalleryItem(url, index) {
    const cleanUrl = normalizePhotoUrl(url);
    const originalUrl = photoOriginal(cleanUrl);
    const thumbnailUrl = photoThumb(cleanUrl);

    if (!originalUrl) return "";

    return (
      '<a class="yg-photo-card" ' +
        'href="' + escapeHtml(originalUrl) + '" ' +
        'target="_blank" rel="noopener noreferrer" ' +
        'title="Buka foto resolusi penuh">' +
        '<img src="' + escapeHtml(thumbnailUrl) + '" ' +
          'loading="lazy" alt="Foto ' + (index + 1) + '" ' +
          'onerror="this.style.display=&quot;none&quot;;' +
          'this.nextElementSibling.style.display=&quot;flex&quot;;">' +
        '<span class="yg-photo-fallback" style="display:none">' +
          'Buka Foto ' + (index + 1) +
        '</span>' +
      '</a>'
    );
  }

  function buildPopup(feature, config) {
    const props = feature.properties || {};

    const isMonitoring =
      config.id === "monitoring_reports" ||
      props.Source_Type === "monitoring_report";

    const isCommunity =
      config.id === "community_reports" ||
      props.Source_Type === "community_report";

    function valueOf(keys) {
      for (let i = 0; i < keys.length; i += 1) {
        const value = props[keys[i]];

        if (
          value !== null &&
          value !== undefined &&
          String(value).trim() !== ""
        ) {
          return value;
        }
      }

      return "";
    }

    function row(label, value, suffix) {
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
          '<span>' +
            escapeHtml(value) +
            (suffix ? " " + escapeHtml(suffix) : "") +
          '</span>' +
        '</div>'
      );
    }

    function cleanPhotoList(value) {
      if (!value) return [];

      const rawItems = Array.isArray(value)
        ? value
        : String(value).split(/\r?\n|,\s*(?=https?:\/\/)/);

      return rawItems
        .map(item => normalizePhotoUrl(item))
        .filter(item => {
          if (!item) return false;

          /*
           * Nama file lokal seperti "FDRS_sepahat 2023.JPG"
           * tidak boleh dijadikan tautan GitHub Pages karena akan 404.
           * Foto program yang sudah diverifikasi akan tersedia melalui
           * props._ygPhotos dari data-updates.js.
           */
          return (
            /^https?:\/\//i.test(item) ||
            /^[A-Za-z0-9_-]{20,}$/.test(item)
          );
        });
    }

    let rows = "";

    if (isMonitoring) {
      rows += row(
        "Lokasi",
        [
          valueOf(["Desa"]),
          valueOf(["Kecamatan"]),
          valueOf(["Kabupaten"])
        ].filter(Boolean).join(", ")
      );

      rows += row(
        "Tanggal",
        valueOf(["activityDate", "Tanggal", "publishedAt"])
      );

      rows += row(
        "Jenis monitoring",
        valueOf(["Monitoring_Type", "monitoringType", "Kategori"])
      );

      rows += row(
        "Kondisi",
        valueOf(["Kondisi", "condition"])
      );

      rows += row(
        "Survival",
        valueOf(["Survival", "survivalPercent"]),
        "%"
      );

      rows += row(
        "Hidup",
        valueOf(["Jumlah_Hidup", "aliveCount"])
      );

      rows += row(
        "Mati/rusak",
        valueOf(["Jumlah_Mati_Rusak", "deadOrDamagedCount"])
      );

      rows += row(
        "Luas terpantau",
        valueOf(["Luas_Terpantau_Ha", "monitoredAreaHa", "Luas_Ha"]),
        "ha"
      );

      rows += row(
        "Tinggi rata-rata",
        valueOf(["Tinggi_Rata_Rata_Cm", "averageHeightCm"]),
        "cm"
      );

      rows += row(
        "Diameter rata-rata",
        valueOf(["Diameter_Rata_Rata_Cm", "averageDiameterCm"]),
        "cm"
      );

      rows += row(
        "Sedimentasi",
        valueOf(["Sedimentasi_Cm", "sedimentationCm"]),
        "cm"
      );

      rows += row(
        "Water table",
        valueOf(["Water_Table_Cm", "waterTableCm"]),
        "cm"
      );

      rows += row(
        "Temuan",
        valueOf(["Temuan", "notes", "description"])
      );

      rows += row(
        "Tindak lanjut",
        valueOf(["Tindak_Lanjut", "followUp"])
      );
    } else if (isCommunity) {
      rows += row(
        "Jenis laporan",
        valueOf(["reportType", "Kategori"])
      );

      rows += row(
        "Tanggal",
        valueOf(["activityDate", "publishedAt"])
      );

      rows += row(
        "Lokasi",
        [
          valueOf(["Desa"]),
          valueOf(["Kecamatan"]),
          valueOf(["Kabupaten"])
        ].filter(Boolean).join(", ")
      );

      rows += row(
        "Judul",
        valueOf(["title", "Nama_Objek"])
      );

      rows += row(
        "Deskripsi",
        valueOf(["description"])
      );

      rows += row(
        "Pelapor/kelompok",
        [
          valueOf(["reporterName"]),
          valueOf(["organization"])
        ].filter(Boolean).join(" · ")
      );
    } else {
      rows += row(
        "No",
        valueOf(["No", "NO", "Id", "ID"])
      );

      rows += row(
        "Kabupaten",
        valueOf(["Kabupaten", "WADMKK"])
      );

      rows += row(
        "Kecamatan",
        valueOf(["Kecamatan", "WADMKC"])
      );

      rows += row(
        "Desa",
        valueOf(["Desa", "WADMKD"])
      );

      rows += row(
        "Tahun",
        valueOf(["Tahun"])
      );

      rows += row(
        "Nama objek",
        valueOf(["Nama_Objek", "Nama", "Lokasi"])
      );

      rows += row(
        "Kategori",
        valueOf(["Kategori", "Layer_Label"])
      );
    }

    const photos = [
      ...cleanPhotoList(props._ygPhotos),
      ...cleanPhotoList(props.photos),
      ...cleanPhotoList(props.Foto),
      ...cleanPhotoList(props.Foto_2)
    ].filter((url, index, array) => array.indexOf(url) === index);

    let gallery = "";

    if (photos.length) {
      gallery =
        '<div class="yg-v3-gallery">' +
        photos.map((url, index) => photoGalleryItem(url, index)).join("") +
        '</div>';
    }

    if (!rows) {
      rows =
        '<div class="popup-row">' +
          '<span>Belum ada informasi rinci.</span>' +
        '</div>';
    }

    return (
      '<div class="popup-card">' +
        '<div class="popup-head" style="background:' +
          escapeHtml(config.color) + '">' +
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

    const color = peatColor(props.KELAS_GBT || props.KETEBALAN);

    return {
      color: color,
      weight: 0.7,
      opacity: 0.8,
      fillColor: color,
      fillOpacity: 0.20
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
    } else {
      rows += item("Kabupaten/Kota", props.KABKOT || props.KK);
      rows += item("Kelas gambut", props.KELAS_GBT);
      rows += item("Ketebalan", props.KETEBALAN);
      rows += item("Jenis tanah utama", props.JNTNH1);
      rows += item("pH", props.pH);
      rows += item("Substratum", props.SUBSTRATUM);
      rows += item("Tahun", props.TAHUN || 2019);
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

    if (!config) {
      throw new Error("Konfigurasi layer referensi tidak ditemukan.");
    }

    if (referenceLayerObjects[layerId]) {
      return referenceLayerObjects[layerId];
    }

    if (referenceLayerState[layerId] === "loading") {
      return null;
    }

    referenceLayerState[layerId] = "loading";
    setStatus("Memuat " + config.label + "…", false);

    const response = await fetch(
      config.file + "?v=20260714-ref1",
      {
        cache: "force-cache"
      }
    );

    if (!response.ok) {
      referenceLayerState[layerId] = "error";
      throw new Error("HTTP " + response.status);
    }

    const data = await response.json();

    if (
      !data ||
      data.type !== "FeatureCollection" ||
      !Array.isArray(data.features)
    ) {
      referenceLayerState[layerId] = "error";
      throw new Error("GeoJSON referensi tidak valid.");
    }

    const layer = L.geoJSON(data, {
      style: feature => referenceStyle(config, feature),
      onEachFeature: (feature, leafletLayer) => {
        leafletLayer.bindPopup(
          referencePopup(config, feature),
          { maxWidth: 360 }
        );
      }
    });

    referenceLayerObjects[layerId] = layer;
    referenceLayerState[layerId] = "ready";

    setStatus(
      config.label + " berhasil dimuat (" +
      new Intl.NumberFormat("id-ID").format(data.features.length) +
      " fitur)",
      false
    );

    return layer;
  }

  function appendReferenceControls(list, legend) {
    const title = document.createElement("div");
    title.className = "yg-layer-section-title";
    title.textContent = "DATA REFERENSI";
    list.appendChild(title);

    Object.keys(REFERENCE_LAYERS).forEach(layerId => {
      const config = REFERENCE_LAYERS[layerId];

      const row = document.createElement("div");
      row.className = "layer-row reference-layer-row";
      row.innerHTML =
        '<input id="layer-' + escapeHtml(layerId) +
        '" data-reference-layer-id="' + escapeHtml(layerId) +
        '" type="checkbox">' +
        '<span class="swatch" style="background:' +
          escapeHtml(config.color) + '"></span>' +
        '<label for="layer-' + escapeHtml(layerId) + '">' +
          escapeHtml(config.label) + '</label>' +
        '<span class="count">' +
          new Intl.NumberFormat("id-ID").format(config.count) +
        '</span>';

      list.appendChild(row);

      const checkbox = row.querySelector("input");

      checkbox.addEventListener("change", async event => {
        checkbox.disabled = true;

        try {
          if (event.target.checked) {
            const layer = await loadReferenceLayer(layerId);

            if (layer) {
              layer.addTo(map);
            }
          } else {
            const layer = referenceLayerObjects[layerId];

            if (layer && map.hasLayer(layer)) {
              map.removeLayer(layer);
            }
          }
        } catch (error) {
          console.error("Layer referensi gagal dimuat:", layerId, error);
          event.target.checked = false;
          setStatus(
            config.label + " gagal dimuat: " + error.message,
            true
          );
        } finally {
          checkbox.disabled = false;
        }
      });

      const legendItem = document.createElement("div");
      legendItem.className = "legend-item";
      legendItem.innerHTML =
        '<span class="legend-mark" style="background:' +
          escapeHtml(config.color) + '"></span>' +
        '<span>' + escapeHtml(config.label) + '</span>';

      legend.appendChild(legendItem);
    });

    const programTitle = document.createElement("div");
    programTitle.className = "yg-layer-section-title yg-program-title";
    programTitle.textContent = "PROGRAM & LAPORAN YG";
    list.appendChild(programTitle);
  }

  function renderLayerControls(groups) {
    const list = document.getElementById("layer-list");
    const legend = document.getElementById("legend");

    list.innerHTML = "";
    legend.innerHTML = "";

    appendReferenceControls(list, legend);

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
	  console.log("LOADDATABASE VERSI BARU");
  setStatus("Mengambil objek dari Master Database…", false);

  try {
    // 1. Ambil data dari Google Apps Script
    const response = await fetch(API + "&t=" + Date.now(), {
      method: "GET",
      cache: "no-store",
      redirect: "follow"
    });

    if (!response.ok) throw new Error("HTTP " + response.status);

    const data = await response.json();

    // 2. Ambil GeoJSON area mangrove
    const mangroveResponse = await fetch("data/area_mangrove.geojson?v=" + Date.now());

    if (!mangroveResponse.ok) {
      console.warn("area_mangrove.geojson tidak ditemukan");
    } else {

      const mangrove = await mangroveResponse.json();

      if (
        mangrove &&
        mangrove.type === "FeatureCollection" &&
        Array.isArray(mangrove.features)
      ) {

        // Tambahkan Layer_ID bila belum ada
        mangrove.features.forEach(f => {
          if (!f.properties) f.properties = {};

          if (!f.properties.Layer_ID) {
            f.properties.Layer_ID = "area_mangrove";
          }

          if (!f.properties.Layer_Label) {
            f.properties.Layer_Label = "Area Penanaman Mangrove";
          }

          if (!f.properties.Nama_Objek) {
            f.properties.Nama_Objek = "Area Penanaman Mangrove";
          }
        });

        // Gabungkan dengan data dari API
        data.features = [
          ...(data.features || []),
          ...mangrove.features
        ];
      }
    }

    initialize(data);
    return;

  } catch (fetchError) {

    console.warn("Fetch gagal, mencoba JSONP.", fetchError);

    try {
      const data = await loadByJsonp();
      initialize(data);
    } catch (jsonpError) {
      console.error("Master Database gagal dimuat.", jsonpError);
      setStatus("Database gagal dimuat: " + jsonpError.message, true);
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
    referenceLayerObjects: referenceLayerObjects,
    get rawFeatures() {
      return rawFeatures;
    }
  };

  loadDatabase();
})();

