(() => {
  "use strict";

  const API = "https://script.google.com/macros/s/AKfycbxUe4QyBvSiL9UJsL-nsJ5XrohDabwqhYYR9q5CTgLYiW1ZCfVy429iMlpU-lCDUSvvRg/exec?page=objects";
  const DEFAULT_VIEW = [1.25, 102.05];
  const DEFAULT_ZOOM = 9;

  const STYLE = {
    desa_intervensi: { label: "Batas Desa Intervensi", color: "#2e7d32", visible: true },
    apo: { label: "Alat Pemecah Ombak (APO)", color: "#d32f2f", visible: true },
    area_mangrove: { label: "Area Penanaman Mangrove", color: "#00796b", visible: true },
    monitoring_reports: { label: "Hasil Monitoring Terverifikasi", color: "#f9a825", visible: true },
    community_reports: { label: "Laporan Masyarakat Terverifikasi", color: "#7b1fa2", visible: true },
    forest_land_restoration: { label: "Restorasi Hutan & Lahan", color: "#388e3c", visible: true },
    nursery_coffee: { label: "Rumah Pembibitan Kopi", color: "#795548", visible: true },
    information_signs: { label: "Plang Informasi & Perlindungan", color: "#5e35b1", visible: true },
    supporting_infrastructure: { label: "Infrastruktur Pendukung", color: "#546e7a", visible: true },
    titik_desa: { label: "Titik Desa Intervensi", color: "#1565c0", visible: false },
    kopi: { label: "Distribusi Lahan Kopi", color: "#6d4c41", visible: true },
    area_kopi: { label: "Wilayah Penanaman Kopi", color: "#8e5a2b", visible: true },
    fdrs: { label: "FDRS / Water Table", color: "#e65100", visible: true },
    sekat_kanal: { label: "Sekat Kanal", color: "#00838f", visible: true },
    nursery_mangrove: { label: "Rumah Pembibitan Mangrove", color: "#8fa600", visible: true },
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
    },
    iuphhk_ht_2014: {
      id: "iuphhk_ht_2014",
      label: "IUPHHK-HT 2014",
      file: "data/IUPHHK_HT_2014.geojson",
      color: "#c62828",
      count: null,
      type: "concession"
    },
    perhutanan_sosial_riau: {
      id: "perhutanan_sosial_riau",
      label: "Perhutanan Sosial Riau",
      file: "data/PERHUTANAN_SOSIAL_RIAU.geojson",
      color: "#00897b",
      count: null,
      type: "social_forestry"
    }
  };

  const referenceLayerObjects = {};
  const referenceLayerState = {};

  const map = L.map("map", {
    zoomControl: true,
    preferCanvas: true
  }).setView(DEFAULT_VIEW, DEFAULT_ZOOM);

  /*
   * Urutan visual tidak boleh bergantung pada urutan data dari API.
   * Setiap keluarga layer mendapat pane sendiri agar batas administrasi
   * tetap terlihat, sementara monitoring dan titik lapangan tidak tertutup
   * oleh polygon program yang dimuat sesudahnya.
   */
  const MAP_PANES = {
    boundary: "yg-boundary-pane",
    program: "yg-program-pane",
    points: "yg-points-pane",
    community: "yg-community-pane",
    monitoring: "yg-monitoring-pane"
  };

  [
    [MAP_PANES.boundary, 390],
    [MAP_PANES.program, 410],
    [MAP_PANES.points, 430],
    [MAP_PANES.community, 450],
    [MAP_PANES.monitoring, 470]
  ].forEach(([name, zIndex]) => {
    const pane = map.createPane(name);
    pane.style.zIndex = String(zIndex);
  });

  /*
   * Canvas memenuhi seluruh pane sehingga pane yang lebih tinggi dapat
   * menangkap klik di area kosong dan menutup marker di bawahnya. SVG hanya
   * interaktif pada bentuk yang benar-benar tergambar.
   */
  const vectorRenderers = {};

  function vectorRendererFor(pane) {
    if (!vectorRenderers[pane]) {
      vectorRenderers[pane] = L.svg({
        pane: pane,
        padding: 0.5
      });
    }
    return vectorRenderers[pane];
  }

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
        /*
         * Sebagian lokasi pedesaan tidak memiliki tile Esri pada zoom 18–19.
         * Leaflet memperbesar tile zoom 17 secara digital sehingga pengguna
         * tetap dapat zoom tanpa mendapat tile "Map data not yet available".
         */
        maxNativeZoom: 17,
        maxZoom: 20,
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

  function getDonor(props, visited) {
    const source = props && typeof props === "object" ? props : {};
    const seen = visited || new Set();

    /*
     * Data lama dapat menyimpan atribut target secara bertingkat. Hindari
     * membaca objek yang sama berulang kali dan jangan membuat objek kosong
     * baru sebagai kandidat, karena itu menyebabkan rekursi tanpa akhir pada
     * objek yang memang belum memiliki donor.
     */
    if (seen.has(source)) return "";
    seen.add(source);
    const keys = [
      "Donor", "Nama_Donor", "Funding_Source",
      "donor", "nama_donor", "funding_source"
    ];

    for (let index = 0; index < keys.length; index += 1) {
      const value = source[keys[index]];
      if (
        value !== null &&
        value !== undefined &&
        String(value).trim() !== ""
      ) {
        return String(value).trim();
      }
    }

    const nestedCandidates = [
      source.targetFeatureProperties,
      source.proposedChanges
    ];

    for (let index = 0; index < nestedCandidates.length; index += 1) {
      let nested = nestedCandidates[index];
      if (!nested) continue;

      if (typeof nested === "string") {
        try {
          nested = JSON.parse(nested);
        } catch (error) {
          continue;
        }
      }

      if (nested && typeof nested === "object" && nested !== source) {
        const donor = getDonor(nested, seen);
        if (donor) return donor;
      }
    }

    return "";
  }

  function normalizeVerifiedCommunityAssets(feature) {
    const props = feature && feature.properties || {};
    const layerId = String(
      props.Layer_ID || props.Source_Layer || ""
    ).trim().toLowerCase();
    const geometryType = String(
      feature && feature.geometry && feature.geometry.type || ""
    );

    if (layerId !== "community_reports" || geometryType !== "Point") {
      return feature;
    }

    const identity = [
      props.title,
      props.locationName,
      props.Nama_Objek,
      props.description,
      props.reportType
    ].filter(Boolean).join(" ").toLowerCase();

    /*
     * Laporan masyarakat tetap menyimpan reportId dan atribut aslinya
     * sebagai jejak audit. Setelah diverifikasi, aset permanen ditampilkan
     * pada layer operasional yang sesuai.
     */
    const originalLayerId = props.Layer_ID || props.Source_Layer || "community_reports";
    let target = null;

    if (
      identity.includes("menara tampung air") ||
      identity.includes("tower air") ||
      identity.includes("pendopo")
    ) {
      target = {
        id: "supporting_infrastructure",
        label: "Infrastruktur Pendukung",
        category: "Infrastruktur Pendukung Program",
        sourceType: "verified_supporting_infrastructure"
      };
    } else if (identity.includes("plang")) {
      target = {
        id: "information_signs",
        label: "Plang Informasi & Perlindungan",
        category: "Plang Informasi dan Perlindungan",
        sourceType: "verified_information_sign"
      };
    } else if (
      identity.includes("nursery sepahat") ||
      identity.includes("rumah bibit sepahat") ||
      identity.includes("rumah bibit kelapa pati")
    ) {
      target = {
        id: "nursery_mangrove",
        label: "Rumah Pembibitan Mangrove",
        category: "Pembibitan Mangrove",
        sourceType: "verified_community_mangrove_nursery"
      };
    } else if (
      identity.includes("nursery ktwmj") ||
      identity.includes("rumah bibit kopi") ||
      identity.includes("nursery kopi")
    ) {
      target = {
        id: "nursery_coffee",
        label: "Rumah Pembibitan Kopi",
        category: "Pembibitan Kopi",
        sourceType: "verified_coffee_nursery"
      };
    } else if (
      identity.includes("restorasi hutan adat imbo putui") ||
      identity.includes("lokasi pup 2")
    ) {
      target = {
        id: "forest_land_restoration",
        label: "Restorasi Hutan & Lahan",
        category: "Restorasi Hutan dan Lahan",
        sourceType: "verified_forest_land_restoration"
      };
    }

    if (!target) return feature;

    props.Audit_Source_Layer = originalLayerId;
    props.Layer_ID = target.id;
    props.Source_Layer = target.id;
    props.Layer_Label = target.label;
    props.Kategori = target.category;
    props.Nama_Objek =
      props.locationName ||
      props.title ||
      props.Nama_Objek ||
      target.category;
    props.Source_Type = target.sourceType;

    return feature;
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
        "Object ID",
        valueOf(["Object_ID", "objectId", "OBJECTID"])
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
        "Fase/keterangan",
        valueOf(["Ket", "Keterangan"])
      );

      rows += row(
        "Luas",
        valueOf(["Luas_Ha"]),
        "ha"
      );

      rows += row(
        "Jumlah bibit",
        valueOf(["Jumlah_Bib", "Jumlah_Bibit", "Jumlah_Tanam"])
      );

      rows += row(
        "Jenis pohon",
        valueOf(["Jenis_Pohon", "Jenis_Tanaman"])
      );

      rows += row(
        "Riwayat penanaman",
        valueOf(["Riwayat_Penanaman"])
      );

      rows += row(
        "Status koordinat",
        valueOf(["Koordinat_Status"])
      );

      if (config.id === "area_kopi") {
        rows += row(
          "Pemilik lahan",
          valueOf(["Pemilik_Lahan"])
        );

        rows += row(
          "Tumpang sari",
          valueOf(["Tumpang_Sari", "Tumpang_Sari_Lainnya"])
        );
      }

      rows += row(
        "Nama objek",
        valueOf(["Nama_Objek", "Nama", "Lokasi"])
      );

      rows += row(
        "Kategori",
        valueOf(["Kategori", "Layer_Label"])
      );

      rows += row(
        "Proyek",
        valueOf(["Nama_Proyek", "Project_Name", "Proyek"])
      );

      rows += row(
        "Kode proyek",
        valueOf(["Project_ID", "Kode_Proyek"])
      );
    }

    // Batas administrasi bukan objek program dan tidak memiliki donor.
    if (config.id !== "desa_intervensi") {
      rows += row("Donor", getDonor(props) || "Belum diisi");
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

    const geometryType = String(
      feature && feature.geometry && feature.geometry.type || ""
    );
    const monitoringTargetObjectId = String(
      props.Target_Object_ID_Current ||
      props.targetObjectId ||
      props.Target_Object_ID ||
      ""
    ).trim();
    const monitoringTargetLayerId = String(
      props.Target_Layer_ID_Current ||
      props.targetLayerId ||
      props.Target_Layer_ID ||
      ""
    ).trim();
    const objectId = isMonitoring
      ? monitoringTargetObjectId
      : String(
          props.Object_ID ||
          props.objectId ||
          props.OBJECTID ||
          props.ID ||
          ""
        ).trim();
    const actionLayerId = isMonitoring
      ? monitoringTargetLayerId
      : config.id;
    const canSendMonitoring =
      ["Polygon", "MultiPolygon"].includes(geometryType) &&
      config.id !== "community_reports" &&
      actionLayerId === "area_mangrove" &&
      Boolean(objectId) &&
      Boolean(actionLayerId);
    const monitoringActionLabel = isMonitoring
      ? "Kirim Monitoring Lagi"
      : "Kirim Monitoring";
    const monitoringAction = canSendMonitoring
      ? (
          '<div class="yg-popup-actions">' +
            '<a class="yg-popup-monitoring-link" href="report.html?' +
              'type=monitoring&amp;layer=' +
              encodeURIComponent(actionLayerId) +
              '&amp;object=' +
              encodeURIComponent(objectId) +
            '">' +
              monitoringActionLabel +
            '</a>' +
          '</div>'
        )
      : "";

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
        '<div class="popup-body">' +
          rows + gallery + monitoringAction +
        '</div>' +
      '</div>'
    );
  }

  function paneFor(config, feature) {
    if (config.id === "desa_intervensi") return MAP_PANES.boundary;
    if (config.id === "monitoring_reports") return MAP_PANES.monitoring;
    if (config.id === "community_reports") return MAP_PANES.community;

    const geometryType = String(
      feature && feature.geometry && feature.geometry.type || ""
    );
    if (/Point$/.test(geometryType)) return MAP_PANES.points;
    return MAP_PANES.program;
  }

  function styleFor(config) {
    const monitoring = config.id === "monitoring_reports";
    const boundary = config.id === "desa_intervensi";
    return {
      color: config.color,
      weight: monitoring ? 4 : (boundary ? 3 : 2.5),
      opacity: 1,
      dashArray: monitoring ? "8 5" : null,
      fillColor: config.color,
      fillOpacity: monitoring ? 0.12 : (boundary ? 0.025 : 0.2)
    };
  }

  function pointFor(config, latlng, pane) {
    const visibleSize = config.id === "monitoring_reports" ? 18 : 14;

    /*
     * Marker HTML memberi setiap titik sasaran klik 40 x 40 piksel.
     * Lingkaran yang terlihat tetap kecil sehingga peta tidak menjadi penuh,
     * tetapi FDRS dan infrastruktur tetap mudah dibuka di desktop maupun HP.
     */
    return L.marker(latlng, {
      pane: pane,
      interactive: true,
      bubblingMouseEvents: false,
      keyboard: true,
      icon: L.divIcon({
        className: "yg-point-hit-marker",
        html:
          '<span class="yg-point-dot" style="--yg-point-color:' +
          escapeHtml(config.color) +
          ";--yg-point-size:" + visibleSize + 'px"></span>',
        iconSize: [40, 40],
        iconAnchor: [20, 20],
        popupAnchor: [0, -16]
      })
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
      props.Donor,
      props.Nama_Donor,
      props.Nama_Proyek,
      props.Project_Name,
      props.Project_ID,
      props.Kabupaten,
      props.Kecamatan,
      props.Desa,
      props.WADMKD,
      props.WADMKC,
      props.WADMKK,
      props.Monitoring_Type,
      props.Ket,
      props.Jumlah_Bib,
      props.description
    ].filter(Boolean).join(" ").toLowerCase();

    searchItems.push({
      text: searchText,
      label: getObjectName(feature),
      layerId: config.id,
      donorMissing: !getDonor(props),
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
        const pane = paneFor(config, feature);
        const single = L.geoJSON(feature, {
          pane: pane,
          renderer: vectorRendererFor(pane),
          style: () => styleFor(config),
          pointToLayer: (_feature, latlng) => pointFor(config, latlng, pane)
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

    function formatArea(value) {
      return new Intl.NumberFormat("id-ID", {
        maximumFractionDigits: 2
      }).format(value);
    }

    function areaValue(value) {
      const number = Number(value);
      return Number.isFinite(number) && number > 0
        ? formatArea(number)
        : "Belum tersedia";
    }

    function ringAreaSquareMeters(ring) {
      if (!Array.isArray(ring) || ring.length < 3) return 0;

      const radius = 6378137;
      const toRadians = Math.PI / 180;
      let area = 0;

      for (let index = 0; index < ring.length; index += 1) {
        const current = ring[index];
        const next = ring[(index + 1) % ring.length];
        if (!current || !next) continue;

        area +=
          (next[0] - current[0]) * toRadians *
          (2 + Math.sin(current[1] * toRadians) +
          Math.sin(next[1] * toRadians));
      }

      return Math.abs(area * radius * radius / 2);
    }

    function polygonAreaSquareMeters(rings) {
      if (!Array.isArray(rings) || !rings.length) return 0;

      let area = ringAreaSquareMeters(rings[0]);
      for (let index = 1; index < rings.length; index += 1) {
        area -= ringAreaSquareMeters(rings[index]);
      }
      return Math.max(0, area);
    }

    function geometryAreaHa(geometry) {
      if (!geometry || !Array.isArray(geometry.coordinates)) return 0;

      let squareMeters = 0;
      if (geometry.type === "Polygon") {
        squareMeters = polygonAreaSquareMeters(geometry.coordinates);
      } else if (geometry.type === "MultiPolygon") {
        squareMeters = geometry.coordinates.reduce(
          (total, polygon) => total + polygonAreaSquareMeters(polygon),
          0
        );
      }

      return squareMeters / 10000;
    }

    function polygonAreaValue(value) {
      const sourceArea = Number(value);
      if (Number.isFinite(sourceArea) && sourceArea > 0) {
        return {
          label: "Luas poligon (ha)",
          value: formatArea(sourceArea)
        };
      }

      const calculatedArea = geometryAreaHa(feature.geometry);
      return calculatedArea > 0
        ? {
            label: "Luas poligon otomatis (ha)",
            value: formatArea(calculatedArea)
          }
        : {
            label: "Luas poligon (ha)",
            value: "Belum tersedia"
          };
    }

    if (config.type === "forest") {
      rows += item("Fungsi kawasan", props.fungsi || "Belum terisi");
      rows += item("Sumber", "Kawasan Hutan SK 903");
    } else if (config.type === "peat") {
      rows += item("Kabupaten/Kota", props.KABKOT || props.KK);
      rows += item("Kelas gambut", props.KELAS_GBT);
      rows += item("Ketebalan", props.KETEBALAN);
      rows += item("Jenis tanah utama", props.JNTNH1);
      rows += item("pH", props.pH);
      rows += item("Substratum", props.SUBSTRATUM);
      rows += item("Tahun", props.TAHUN || 2019);
    } else if (config.type === "concession") {
      rows += item("Pemegang izin", props.NAMA_PRH);
      rows += item("Nomor SK", props.SK_PBH || props.SK_LAMA);
      rows += item("Tanggal SK", props.TGL_PBH || props.TGL_LAMA);
      rows += item("Luas izin (ha)", areaValue(props.LUAS_HA));
      const concessionArea = polygonAreaValue(props.LUAS_UKURA);
      rows += item(concessionArea.label, concessionArea.value);
      rows += item("Kabupaten/Kota", props.KAB_KOTA);
      rows += item("Distrik", props.DISTRIK);
    } else if (config.type === "social_forestry") {
      rows += item("Kelompok/Hutan Desa", props.NAMA_HKM);
      rows += item("Skema", props.Ket);
      rows += item("Nomor izin", props.NO_IUPHKM);
      rows += item("Tanggal izin", props.TGL_IUPHKM);
      rows += item("Luas izin (ha)", areaValue(props.L_IUPHKM));
      const socialForestryArea = polygonAreaValue(props.LUAS_POLI);
      rows += item(socialForestryArea.label, socialForestryArea.value);
      rows += item("Desa", props.NAMA_DESA);
      rows += item("Kecamatan", props.NAMA_KEC);
      rows += item("Kabupaten", props.NAMA_KAB);
      rows += item("Provinsi", props.NAMA_PROV);
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
      config.file + "?v=20260721-ref2",
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
    config.count = data.features.length;

    const countElement = document.querySelector(
      '[data-reference-count-id="' + layerId + '"]'
    );
    if (countElement) {
      countElement.textContent =
        new Intl.NumberFormat("id-ID").format(config.count);
    }

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
        '<span class="count" data-reference-count-id="' +
          escapeHtml(layerId) + '">' +
          (Number.isFinite(config.count)
            ? new Intl.NumberFormat("id-ID").format(config.count)
            : "—") +
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
    const missingDonorQuery = value === "__donor_missing__";

    if (!value) {
      results.hidden = true;
      results.innerHTML = "";
      return;
    }

    const matches = searchItems
      .filter(item =>
        missingDonorQuery ? item.donorMissing : item.text.includes(value)
      )
      .slice(0, missingDonorQuery ? 100 : 12);

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

  function showLayerFromDashboard(layerId) {
    const layer = layerObjects[layerId];
    if (!layer) return false;

    if (!map.hasLayer(layer)) layer.addTo(map);
    const checkbox = document.getElementById("layer-" + layerId);
    if (checkbox) checkbox.checked = true;

    const bounds = layer.getBounds();
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: 15 });
    }
    return true;
  }

  function applyInitialDashboardLink() {
    const params = new URLSearchParams(window.location.search);
    const layerId = String(params.get("layer") || "").trim();
    const layerIds = String(params.get("layers") || "")
      .split(",").map(value => value.trim()).filter(Boolean);
    const village = String(params.get("village") || "").trim();
    const search = String(params.get("search") || "").trim();
    const donor = String(params.get("donor") || "").trim().toLowerCase();

    if (layerIds.length) {
      const bounds = L.latLngBounds([]);
      layerIds.forEach(id => {
        const layer = layerObjects[id];
        if (!layer) return;
        if (!map.hasLayer(layer)) layer.addTo(map);
        const checkbox = document.getElementById("layer-" + id);
        if (checkbox) checkbox.checked = true;
        const layerBounds = layer.getBounds();
        if (layerBounds.isValid()) bounds.extend(layerBounds);
      });
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [30, 30], maxZoom: 15 });
      }
      return;
    }

    if (donor && donor !== "missing") {
      const donorTerm = donor === "aramco" ? "aramco asia singapore" : donor;
      const normalizedVillage = village.toLowerCase();
      const matches = searchItems.filter(item =>
        (!layerId || item.layerId === layerId) &&
        (!village || item.text.includes(normalizedVillage)) &&
        (item.text.includes(donorTerm) || item.text.includes(donor))
      );
      const bounds = L.latLngBounds([]);

      matches.forEach(item => {
        if (item.parent && !map.hasLayer(item.parent)) item.parent.addTo(map);
        if (item.layer && typeof item.layer.getBounds === "function") {
          const itemBounds = item.layer.getBounds();
          if (itemBounds.isValid()) bounds.extend(itemBounds);
        } else if (item.layer && typeof item.layer.getLatLng === "function") {
          bounds.extend(item.layer.getLatLng());
        }
      });

      if (layerId) {
        const checkbox = document.getElementById("layer-" + layerId);
        if (checkbox) checkbox.checked = true;
      }
      const input = document.getElementById("search-input");
      if (input) input.value = donor === "aramco" ? "Aramco Asia Singapore" : donor;
      renderSearch(donor);
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [30, 30], maxZoom: 17 });
      } else if (layerId) {
        showLayerFromDashboard(layerId);
      }
      return;
    }

    if (layerId && village) {
      const normalizedVillage = village.toLowerCase();
      const matches = searchItems.filter(item =>
        item.layerId === layerId && item.text.includes(normalizedVillage)
      );
      const bounds = L.latLngBounds([]);

      matches.forEach(item => {
        if (item.parent && !map.hasLayer(item.parent)) item.parent.addTo(map);
        if (item.layer && typeof item.layer.getBounds === "function") {
          const itemBounds = item.layer.getBounds();
          if (itemBounds.isValid()) bounds.extend(itemBounds);
        } else if (item.layer && typeof item.layer.getLatLng === "function") {
          bounds.extend(item.layer.getLatLng());
        }
      });

      const checkbox = document.getElementById("layer-" + layerId);
      if (checkbox) checkbox.checked = true;
      const input = document.getElementById("search-input");
      if (input) input.value = village;
      renderSearch(village);
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [30, 30], maxZoom: 17 });
      } else {
        showLayerFromDashboard(layerId);
      }
      return;
    }

    if (layerId && showLayerFromDashboard(layerId)) return;

    if (donor === "missing") {
      const input = document.getElementById("search-input");
      if (input) input.value = "Donor belum diisi";
      renderSearch("__donor_missing__");
      return;
    }

    if (village) {
      const normalizedVillage = village.toLowerCase();
      const matches = searchItems.filter(item =>
        item.text.includes(normalizedVillage)
      );
      const bounds = L.latLngBounds([]);

      matches.forEach(item => {
        if (item.parent && !map.hasLayer(item.parent)) item.parent.addTo(map);
        if (item.layer && typeof item.layer.getBounds === "function") {
          const itemBounds = item.layer.getBounds();
          if (itemBounds.isValid()) bounds.extend(itemBounds);
        } else if (item.layer && typeof item.layer.getLatLng === "function") {
          bounds.extend(item.layer.getLatLng());
        }
      });

      const input = document.getElementById("search-input");
      if (input) input.value = village;
      renderSearch(village);
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [30, 30], maxZoom: 15 });
      }
      return;
    }

    if (search) {
      const input = document.getElementById("search-input");
      if (input) input.value = search;
      renderSearch(search);
    }
  }

  function applyPematangDukuDonorPolicy(feature) {
    const props = feature && feature.properties || {};
    const village = [
      props.Desa, props.WADMKD, props.NAMA_DESA,
      props.village, props.locationName
    ].filter(Boolean).join(" ").trim().toLowerCase();

    if (village.includes("pematang duku")) {
      props.Donor = "Pan Pacific Conservation Foundation";
      props.Donor_Cluster = "Pan Pacific Conservation Foundation";
    }
    return feature;
  }

  function applyAramcoCoastalAssetPolicy(feature) {
    const props = feature && feature.properties || {};
    const layerId = String(
      props.Layer_ID || props.Source_Layer || ""
    ).trim().toLowerCase();

    if (layerId === "nursery_mangrove" || layerId === "apo") {
      props.Donor = "Aramco Asia Singapore";
      props.Donor_Cluster = "Aramco Asia Singapore";
    }
    return feature;
  }

  function applyExternalPeatInfrastructureDonorPolicy(feature) {
    const props = feature && feature.properties || {};
    const layerId = String(
      props.Layer_ID || props.Source_Layer || ""
    ).trim().toLowerCase();
    const village = [
      props.Desa, props.WADMKD, props.NAMA_DESA,
      props.village, props.locationName
    ].filter(Boolean).join(" ").trim().toLowerCase();

    if ((layerId === "sekat_kanal" || layerId === "fdrs") &&
        !village.includes("pematang duku")) {
      props.Donor = "Global Environment Centre";
      props.Donor_Cluster = "Global Environment Centre";
    }
    return feature;
  }

  function applyRequestedDonorCorrections(feature) {
    const props = feature && feature.properties || {};
    const layerId = String(
      props.Layer_ID || props.Source_Layer || ""
    ).trim().toLowerCase();
    const reportId = String(
      props.reportId || props.Report_ID || props.Source_Report_ID || ""
    ).trim().toUpperCase();
    const objectId = String(props.Object_ID || "").trim().toUpperCase();
    const identity = [
      props.title, props.locationName, props.Nama_Objek,
      props.description, props.Keterangan
    ].filter(Boolean).join(" ").toLowerCase();
    let donor = "";

    if (layerId === "kopi") donor = "Global Environment Centre";
    if (identity.includes("rumah jemur semi permanen kopi liberika")) {
      donor = "Yayasan Penabulu";
    }
    if (identity.includes("menara tampung air nursery ktwmj")) {
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
        reportId === "COMMUNITY-YG-20260713-192917-711" ||
        objectId === "COMMUNITY-YG-20260713-192917-711") {
      donor = "Aliansi Kolibri";
    }
    if (reportId === "COMMUNITY-YG-20260716-163039-924" ||
        objectId === "COMMUNITY-YG-20260716-163039-924") {
      donor = "Aramco Asia Singapore";
    }

    if (donor) {
      props.Donor = donor;
      props.Donor_Cluster = donor;
    }
    return feature;
  }

  function initialize(data) {
    if (!data || data.type !== "FeatureCollection" || !Array.isArray(data.features)) {
      setStatus("Respons database tidak valid.", true);
      return;
    }

    const permanentReportIds = new Set(data.features.map(feature => {
      const p = feature && feature.properties || {};
      const layerId = String(p.Layer_ID || p.Source_Layer || "").toLowerCase();
      return layerId !== "community_reports"
        ? String(p.Source_Report_ID || "").trim()
        : "";
    }).filter(Boolean));

    rawFeatures = data.features
      .filter(feature => {
        if (!feature || !feature.geometry) return false;
        const p = feature.properties || {};
        const layerId = String(p.Layer_ID || p.Source_Layer || "").toLowerCase();
        const reportId = String(p.reportId || p.Report_ID || "").trim();
        return !(
          layerId === "community_reports" &&
          reportId &&
          permanentReportIds.has(reportId)
        );
      })
      .map(normalizeVerifiedCommunityAssets)
      .map(applyPematangDukuDonorPolicy)
      .map(applyAramcoCoastalAssetPolicy)
      .map(applyExternalPeatInfrastructureDonorPolicy)
      .map(applyRequestedDonorCorrections);
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

    applyInitialDashboardLink();

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

  function geometryPolygons(geometry) {
    if (!geometry || !Array.isArray(geometry.coordinates)) return [];

    if (geometry.type === "Polygon") {
      return [geometry.coordinates];
    }

    if (geometry.type === "MultiPolygon") {
      return geometry.coordinates;
    }

    return [];
  }

  function pointOnSegment(point, start, end) {
    const cross =
      (point[1] - start[1]) * (end[0] - start[0]) -
      (point[0] - start[0]) * (end[1] - start[1]);

    if (Math.abs(cross) > 1e-12) return false;

    return (
      point[0] >= Math.min(start[0], end[0]) - 1e-12 &&
      point[0] <= Math.max(start[0], end[0]) + 1e-12 &&
      point[1] >= Math.min(start[1], end[1]) - 1e-12 &&
      point[1] <= Math.max(start[1], end[1]) + 1e-12
    );
  }

  function pointInRing(point, ring) {
    let inside = false;

    for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
      const start = ring[j];
      const end = ring[i];

      if (pointOnSegment(point, start, end)) return true;

      const crosses =
        (end[1] > point[1]) !== (start[1] > point[1]) &&
        point[0] <
          ((start[0] - end[0]) * (point[1] - end[1])) /
            (start[1] - end[1]) +
          end[0];

      if (crosses) inside = !inside;
    }

    return inside;
  }

  function pointInPolygon(point, polygon) {
    if (!polygon.length || !pointInRing(point, polygon[0])) return false;

    for (let i = 1; i < polygon.length; i += 1) {
      if (pointInRing(point, polygon[i])) return false;
    }

    return true;
  }

  function segmentOrientation(a, b, c) {
    const value =
      (b[1] - a[1]) * (c[0] - b[0]) -
      (b[0] - a[0]) * (c[1] - b[1]);

    if (Math.abs(value) < 1e-12) return 0;
    return value > 0 ? 1 : 2;
  }

  function segmentsIntersect(a, b, c, d) {
    const o1 = segmentOrientation(a, b, c);
    const o2 = segmentOrientation(a, b, d);
    const o3 = segmentOrientation(c, d, a);
    const o4 = segmentOrientation(c, d, b);

    if (o1 !== o2 && o3 !== o4) return true;
    if (o1 === 0 && pointOnSegment(c, a, b)) return true;
    if (o2 === 0 && pointOnSegment(d, a, b)) return true;
    if (o3 === 0 && pointOnSegment(a, c, d)) return true;
    if (o4 === 0 && pointOnSegment(b, c, d)) return true;

    return false;
  }

  function ringsIntersect(first, second) {
    for (let i = 1; i < first.length; i += 1) {
      for (let j = 1; j < second.length; j += 1) {
        if (
          segmentsIntersect(
            first[i - 1],
            first[i],
            second[j - 1],
            second[j]
          )
        ) {
          return true;
        }
      }
    }

    return false;
  }

  function polygonsIntersect(first, second) {
    if (!first.length || !second.length) return false;

    if (ringsIntersect(first[0], second[0])) return true;
    if (pointInPolygon(first[0][0], second)) return true;
    if (pointInPolygon(second[0][0], first)) return true;

    return false;
  }

  function geometriesIntersect(firstGeometry, secondGeometry) {
    const firstPolygons = geometryPolygons(firstGeometry);
    const secondPolygons = geometryPolygons(secondGeometry);

    return firstPolygons.some(first =>
      secondPolygons.some(second => polygonsIntersect(first, second))
    );
  }

  function numericArea(value) {
    const normalized = String(value == null ? "" : value)
      .replace(",", ".")
      .match(/-?\d+(?:\.\d+)?/);

    return normalized ? Number(normalized[0]) : NaN;
  }

  function ringSurface(ring) {
    let surface = 0;

    for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
      surface +=
        (ring[j][0] * ring[i][1]) -
        (ring[i][0] * ring[j][1]);
    }

    return Math.abs(surface / 2);
  }

  function keepLargestPolygonPart(feature) {
    if (
      !feature ||
      !feature.geometry ||
      feature.geometry.type !== "MultiPolygon" ||
      !Array.isArray(feature.geometry.coordinates)
    ) {
      return feature;
    }

    const polygons = feature.geometry.coordinates;
    if (!polygons.length) return feature;

    const largest = polygons.reduce((best, polygon) => {
      const surface = polygon && polygon[0]
        ? ringSurface(polygon[0])
        : 0;

      return surface > best.surface
        ? { polygon: polygon, surface: surface }
        : best;
    }, { polygon: polygons[0], surface: -1 });

    return {
      ...feature,
      geometry: {
        type: "Polygon",
        coordinates: largest.polygon
      }
    };
  }

  function normalizedMatchValue(value) {
    return String(value == null ? "" : value)
      .trim()
      .toLowerCase()
      .replace(/[–—]/g, "-")
      .replace(/\s+/g, " ");
  }

  function phaseValue(value) {
    const match = normalizedMatchValue(value).match(
      /\b(?:phase|fase)\s*(i{1,3}|iv|v|\d+)\b/i
    );
    return match ? match[1].toLowerCase() : "";
  }

  function isMangroveMonitoringFeature(feature) {
    const props = feature && feature.properties || {};
    const layerId = normalizedMatchValue(
      props.Layer_ID || props.Source_Layer
    );
    const sourceType = normalizedMatchValue(props.Source_Type);
    const monitoringType = normalizedMatchValue(
      props.Monitoring_Type || props.monitoringType || props.Kategori
    );

    return (
      (layerId === "monitoring_reports" ||
        sourceType === "monitoring_report") &&
      monitoringType.includes("mangrove")
    );
  }

  function matchOfficialMangroveFeature(monitoring, officialFeatures) {
    const props = monitoring && monitoring.properties || {};
    const village = normalizedMatchValue(
      props.Desa || props.WADMKD || props.targetObjectName
    );
    const monitoringName = [
      props.Nama_Objek,
      props.targetObjectName,
      props.locationName,
      props.title
    ].filter(Boolean).join(" ");
    const monitoringPhase = phaseValue(monitoringName);
    const monitoredArea = numericArea(
      props.Luas_Terpantau_Ha ??
      props.monitoredAreaHa ??
      props.Luas_Ha
    );

    let candidates = (officialFeatures || []).filter(feature => {
      const officialProps = feature && feature.properties || {};
      return normalizedMatchValue(officialProps.Desa) === village;
    });

    if (!candidates.length) return null;

    if (monitoringPhase) {
      const samePhase = candidates.filter(feature => {
        const officialProps = feature && feature.properties || {};
        return phaseValue(
          officialProps.Ket || officialProps.Nama_Objek
        ) === monitoringPhase;
      });
      if (samePhase.length) candidates = samePhase;
    }

    if (Number.isFinite(monitoredArea)) {
      candidates.sort((first, second) => {
        const firstArea = numericArea(
          first && first.properties && first.properties.Luas_Ha
        );
        const secondArea = numericArea(
          second && second.properties && second.properties.Luas_Ha
        );
        return (
          Math.abs(firstArea - monitoredArea) -
          Math.abs(secondArea - monitoredArea)
        );
      });
    }

    /*
     * Fase yang sama merupakan pengenal kuat untuk laporan lama.
     * Tanpa fase, luas harus cukup dekat agar laporan tidak tertaut
     * ke plot lain yang kebetulan berada di desa yang sama.
     */
    const selected = candidates[0] || null;
    if (!selected || monitoringPhase || !Number.isFinite(monitoredArea)) {
      return selected;
    }

    const selectedArea = numericArea(
      selected.properties && selected.properties.Luas_Ha
    );
    const difference = Math.abs(selectedArea - monitoredArea);
    const tolerance = Math.max(0.05, monitoredArea * 0.1);
    return difference <= tolerance ? selected : null;
  }

  function mergeOfficialMangroveData(data, mangrove) {
    if (
      !data ||
      !Array.isArray(data.features) ||
      !mangrove ||
      mangrove.type !== "FeatureCollection" ||
      !Array.isArray(mangrove.features)
    ) {
      return data;
    }

    const databaseMangroveFeatures = data.features.filter(feature => {
      const props = feature && feature.properties || {};
      const layerId = normalizedMatchValue(
        props.Layer_ID || props.Source_Layer
      );
      return layerId === "area_mangrove";
    });

    function findDatabaseMangrove(officialFeature) {
      const officialProps = officialFeature && officialFeature.properties || {};
      const officialId = normalizedMatchValue(officialProps.Object_ID);
      const exact = databaseMangroveFeatures.find(feature =>
        normalizedMatchValue(
          feature && feature.properties && feature.properties.Object_ID
        ) === officialId
      );
      if (exact) return exact;

      const officialVillage = normalizedMatchValue(officialProps.Desa);
      const officialYear = normalizedMatchValue(officialProps.Tahun);
      const officialArea = numericArea(officialProps.Luas_Ha);
      if (!officialVillage || !officialYear || !Number.isFinite(officialArea)) {
        return null;
      }

      const candidates = databaseMangroveFeatures
        .map(feature => {
          const props = feature && feature.properties || {};
          const area = numericArea(props.Luas_Ha);
          if (
            normalizedMatchValue(props.Desa) !== officialVillage ||
            normalizedMatchValue(props.Tahun) !== officialYear ||
            !Number.isFinite(area)
          ) {
            return null;
          }
          return { feature, difference: Math.abs(area - officialArea) };
        })
        .filter(Boolean)
        .sort((left, right) => left.difference - right.difference);

      if (!candidates.length) return null;
      const tolerance = Math.max(0.0005, officialArea * 0.001);
      return candidates[0].difference <= tolerance
        ? candidates[0].feature
        : null;
    }

    mangrove.features.forEach(feature => {
      if (!feature.properties) feature.properties = {};
      if (!feature.properties.Layer_ID) {
        feature.properties.Layer_ID = "area_mangrove";
      }
      if (!feature.properties.Layer_Label) {
        feature.properties.Layer_Label = "Area Penanaman Mangrove";
      }
      if (!feature.properties.Nama_Objek) {
        feature.properties.Nama_Objek = "Area Penanaman Mangrove";
      }

      const databaseFeature = findDatabaseMangrove(feature);
      const databaseProps = databaseFeature && databaseFeature.properties || {};
      [
        "Donor",
        "Nama_Proyek",
        "Project_ID",
        "Nomor_Perjanjian",
        "Program",
        "Status_Objek",
        "Revision",
        "Updated_At",
        "Updated_By"
      ].forEach(key => {
        if (
          databaseProps[key] !== undefined &&
          databaseProps[key] !== null &&
          String(databaseProps[key]).trim() !== ""
        ) {
          feature.properties[key] = databaseProps[key];
        }
      });

      /*
       * Kebijakan kluster V1: seluruh Area Penanaman Mangrove
       * merupakan bagian dari dukungan Aramco Asia Singapore.
       * Nilai ini mengatasi donor kosong maupun alias donor lama.
       */
      feature.properties.Donor = "Aramco Asia Singapore";
      feature.properties.Donor_Cluster = "Aramco Asia Singapore";

      if (databaseProps.Object_ID) {
        feature.properties.Master_Object_ID = databaseProps.Object_ID;
      }
    });

    const nonMangroveFeatures = data.features.filter(feature => {
      const props = feature && feature.properties || {};
      const layerId = normalizedMatchValue(
        props.Layer_ID || props.Source_Layer
      );
      return layerId !== "area_mangrove";
    });

    /*
     * Laporan monitoring menyimpan geometri saat laporan dibuat.
     * Setelah tim GIS memperbaiki SHP, properti laporan tetap dipakai,
     * sedangkan bentuk pada peta mengikuti objek resmi terbaru.
     */
    const alignedFeatures = nonMangroveFeatures.map(feature => {
      if (!isMangroveMonitoringFeature(feature)) return feature;

      const official = matchOfficialMangroveFeature(
        feature,
        mangrove.features
      );
      if (!official) return feature;

      const officialProps = official.properties || {};
      const inheritedDonor =
        getDonor(feature.properties || {}) ||
        getDonor(officialProps);
      return {
        ...feature,
        geometry: JSON.parse(JSON.stringify(official.geometry)),
        properties: {
          ...(feature.properties || {}),
          Target_Object_ID_Current: officialProps.Object_ID || "",
          Target_Object_Name_Current: officialProps.Nama_Objek || "",
          Target_Layer_ID_Current: "area_mangrove",
          Geometry_Source: "area_mangrove_latest",
          Donor: inheritedDonor,
          Donor_Cluster: inheritedDonor
        }
      };
    });

    data.features = [
      ...alignedFeatures,
      ...mangrove.features
    ];
    return data;
  }

  function mergeOfficialCoffeeAreas(data, coffeeAreas) {
    if (
      !data ||
      !Array.isArray(data.features) ||
      !coffeeAreas ||
      coffeeAreas.type !== "FeatureCollection" ||
      !Array.isArray(coffeeAreas.features)
    ) {
      return data;
    }

    const sourceReportIds = new Set();

    coffeeAreas.features.forEach(feature => {
      if (!feature.properties) feature.properties = {};

      feature.properties.Layer_ID = "area_kopi";
      feature.properties.Source_Layer = "area_kopi";
      feature.properties.Layer_Label = "Wilayah Penanaman Kopi";
      feature.properties.Kategori =
        feature.properties.Kategori || "Agroforestri/Kopi";

      if (feature.properties.Source_Report_ID) {
        sourceReportIds.add(
          normalizedMatchValue(feature.properties.Source_Report_ID)
        );
      }
    });

    /*
     * Satu laporan Area/Poligon Baru dapat berisi MultiPolygon. Setelah
     * diverifikasi tim GIS, laporan sumber diganti pada peta oleh setiap
     * Polygon resmi dengan Object_ID permanen agar dapat dipilih dan
     * diperbarui secara terpisah.
     */
    const retainedFeatures = data.features.filter(feature => {
      const props = feature && feature.properties || {};
      const reportId = normalizedMatchValue(
        props.reportId || props.Report_ID || props.Source_Report_ID
      );

      return !sourceReportIds.has(reportId);
    });

    data.features = [
      ...retainedFeatures,
      ...coffeeAreas.features
    ];

    return data;
  }

  function mergeOfficialCoffeePoints(data, coffeePoints) {
    if (
      !data ||
      !Array.isArray(data.features) ||
      !coffeePoints ||
      coffeePoints.type !== "FeatureCollection" ||
      !Array.isArray(coffeePoints.features)
    ) {
      return data;
    }

    const databaseCoffee = data.features.filter(feature => {
      const props = feature && feature.properties || {};
      return normalizedMatchValue(
        props.Layer_ID || props.Source_Layer
      ) === "kopi";
    });

    coffeePoints.features.forEach(feature => {
      if (!feature.properties) feature.properties = {};
      const props = feature.properties;
      const objectId = normalizedMatchValue(props.Object_ID);
      const databaseFeature = databaseCoffee.find(candidate =>
        normalizedMatchValue(
          candidate && candidate.properties && candidate.properties.Object_ID
        ) === objectId
      );
      const databaseProps = databaseFeature && databaseFeature.properties || {};

      props.Layer_ID = "kopi";
      props.Source_Layer = "kopi";
      props.Layer_Label = "Lokasi Penanaman Kopi";
      props.Kategori = props.Kategori || "Agroforestri/Kopi";

      [
        "Donor",
        "Nama_Proyek",
        "Project_ID",
        "Nomor_Perjanjian",
        "Program",
        "Status_Objek",
        "Revision",
        "Updated_At",
        "Updated_By"
      ].forEach(key => {
        if (
          databaseProps[key] !== undefined &&
          databaseProps[key] !== null &&
          String(databaseProps[key]).trim() !== ""
        ) {
          props[key] = databaseProps[key];
        }
      });

      if (!getDonor(props)) {
        props.Donor = "Global Environment Centre";
      }
      props.Donor_Cluster = getDonor(props);
    });

    data.features = [
      ...data.features.filter(feature => {
        const props = feature && feature.properties || {};
        return normalizedMatchValue(
          props.Layer_ID || props.Source_Layer
        ) !== "kopi";
      }),
      ...coffeePoints.features
    ];

    return data;
  }

  async function loadOfficialMangrove() {
    const response = await fetch(
      "data/area_mangrove.geojson?v=" + Date.now(),
      { cache: "no-store" }
    );
    if (!response.ok) throw new Error("HTTP " + response.status);
    return response.json();
  }

  async function loadOfficialCoffeeAreas() {
    const response = await fetch(
      "data/area_kopi.geojson?v=" + Date.now(),
      { cache: "no-store" }
    );
    if (!response.ok) throw new Error("HTTP " + response.status);
    return response.json();
  }

  async function loadOfficialCoffeePoints() {
    const response = await fetch(
      "data/kopi.geojson?v=" + Date.now(),
      { cache: "no-store" }
    );
    if (!response.ok) throw new Error("HTTP " + response.status);
    return response.json();
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

    // 2. Selaraskan geometri laporan dengan SHP mangrove resmi terbaru.
    try {
      const mangrove = await loadOfficialMangrove();
      mergeOfficialMangroveData(data, mangrove);
    } catch (mangroveError) {
      console.warn("area_mangrove.geojson tidak dapat dimuat", mangroveError);
    }

    try {
      const coffeeAreas = await loadOfficialCoffeeAreas();
      mergeOfficialCoffeeAreas(data, coffeeAreas);
    } catch (coffeeAreaError) {
      console.warn("area_kopi.geojson tidak dapat dimuat", coffeeAreaError);
    }

    try {
      const coffeePoints = await loadOfficialCoffeePoints();
      mergeOfficialCoffeePoints(data, coffeePoints);
    } catch (coffeePointError) {
      console.warn("kopi.geojson tidak dapat dimuat", coffeePointError);
    }

    initialize(data);
    return;

  } catch (fetchError) {

    console.warn("Fetch gagal, mencoba JSONP.", fetchError);

    try {
      const data = await loadByJsonp();
      try {
        const mangrove = await loadOfficialMangrove();
        mergeOfficialMangroveData(data, mangrove);
      } catch (mangroveError) {
        console.warn(
          "area_mangrove.geojson tidak dapat dimuat melalui jalur cadangan",
          mangroveError
        );
      }
      try {
        const coffeeAreas = await loadOfficialCoffeeAreas();
        mergeOfficialCoffeeAreas(data, coffeeAreas);
      } catch (coffeeAreaError) {
        console.warn(
          "area_kopi.geojson tidak dapat dimuat melalui jalur cadangan",
          coffeeAreaError
        );
      }
      try {
        const coffeePoints = await loadOfficialCoffeePoints();
        mergeOfficialCoffeePoints(data, coffeePoints);
      } catch (coffeePointError) {
        console.warn(
          "kopi.geojson tidak dapat dimuat melalui jalur cadangan",
          coffeePointError
        );
      }
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







