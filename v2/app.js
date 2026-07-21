(() => {
  "use strict";

  const API_ROOT = "https://script.google.com/macros/s/AKfycbxUe4QyBvSiL9UJsL-nsJ5XrohDabwqhYYR9q5CTgLYiW1ZCfVy429iMlpU-lCDUSvvRg/exec";
  const API = API_ROOT + "?page=objects";
  const UPDATES_API = API_ROOT + "?page=public-updates";
  const DEFAULT_VIEW = [1.25, 102.05];
  const DEFAULT_ZOOM = 9;
  const LAYERS = [
    { id: "desa_intervensi", label: "Desa Intervensi", caption: "Batas wilayah program", color: "#2f7d4c", type: "polygon", visible: true, staticFile: "desa_intervensi.geojson" },
    { id: "area_mangrove", label: "Penanaman Mangrove", caption: "Area rehabilitasi pesisir resmi", color: "#168b78", type: "polygon", visible: true, staticFile: "area_mangrove.geojson" },
    { id: "apo", label: "Pemecah Ombak", caption: "Infrastruktur perlindungan pesisir", color: "#d05b45", type: "line", visible: true },
    { id: "monitoring_reports", label: "Monitoring Terverifikasi", caption: "Hasil pemantauan lapangan", color: "#f9a825", type: "polygon", visible: true },
    { id: "community_reports", label: "Laporan Masyarakat", caption: "Laporan publik terverifikasi", color: "#7b1fa2", type: "point", visible: true },
    { id: "forest_land_restoration", label: "Restorasi Hutan & Lahan", caption: "Lokasi pemulihan ekosistem", color: "#388e3c", type: "polygon", visible: true },
    { id: "nursery_coffee", label: "Rumah Pembibitan Kopi", caption: "Pembibitan tanaman lahan gambut", color: "#795548", type: "point", visible: true },
    { id: "information_signs", label: "Plang Informasi", caption: "Informasi dan perlindungan kawasan", color: "#5e35b1", type: "point", visible: true },
    { id: "supporting_infrastructure", label: "Infrastruktur Pendukung", caption: "Sarana pendukung program", color: "#546e7a", type: "point", visible: true },
    { id: "area_kopi", label: "Wilayah Penanaman Kopi", caption: "Area agroforestri dan kopi", color: "#8e5a2b", type: "polygon", visible: true, staticFile: "area_kopi.geojson" },
    { id: "kopi", label: "Distribusi Kopi", caption: "Penguatan ekonomi masyarakat", color: "#79573d", type: "point", visible: true },
    { id: "fdrs", label: "FDRS / Water Table", caption: "Pemantauan risiko kebakaran", color: "#e58a3d", type: "point", visible: true },
    { id: "sekat_kanal", label: "Sekat Kanal", caption: "Infrastruktur pembasahan gambut", color: "#16829a", type: "point", visible: true },
    { id: "nursery_mangrove", label: "Pembibitan Mangrove", caption: "Rumah bibit masyarakat", color: "#91a83f", type: "point", visible: true },
    { id: "titik_desa", label: "Titik Desa", caption: "Pusat desa intervensi", color: "#397ac2", type: "point", visible: false }
  ];
  const REFERENCES = [
    { id: "kawasan_hutan_sk_903", file: "kawasan_hutan_sk_903.geojson", label: "Kawasan Hutan SK 903", caption: "Referensi fungsi kawasan", color: "#56645f", type: "polygon" },
    { id: "gambut_bbsdlp_2019", file: "Gambut_BBSDLP_2019.geojson", label: "Peta Gambut BBSDLP 2019", caption: "Referensi sebaran gambut", color: "#6d4c3d", type: "polygon" },
    { id: "iuphhk_ht_2014", file: "IUPHHK_HT_2014.geojson", label: "IUPHHK-HT 2014", caption: "Referensi perizinan pemanfaatan hutan", color: "#c62828", type: "polygon" },
    { id: "perhutanan_sosial_riau", file: "PERHUTANAN_SOSIAL_RIAU.geojson", label: "Perhutanan Sosial Riau", caption: "Referensi akses kelola masyarakat", color: "#00897b", type: "polygon" }
  ];
  const EN_LAYER = {
    desa_intervensi: ["Intervention Villages", "Programme administrative boundaries"],
    area_mangrove: ["Mangrove Planting", "Official coastal rehabilitation areas"],
    apo: ["Wave Breakers", "Coastal protection infrastructure"],
    monitoring_reports: ["Verified Monitoring", "Field monitoring results"],
    community_reports: ["Community Reports", "Verified public reports"],
    forest_land_restoration: ["Forest & Land Restoration", "Ecosystem recovery sites"],
    nursery_coffee: ["Coffee Nursery", "Peatland plant nursery"],
    information_signs: ["Information Signs", "Area information and protection"],
    supporting_infrastructure: ["Supporting Infrastructure", "Programme supporting facilities"],
    area_kopi: ["Coffee Planting Areas", "Coffee and agroforestry areas"],
    kopi: ["Coffee Distribution", "Community livelihood strengthening"],
    fdrs: ["FDRS / Water Table", "Fire-risk monitoring"],
    sekat_kanal: ["Canal Blocks", "Peatland rewetting infrastructure"],
    nursery_mangrove: ["Mangrove Nursery", "Community seedling nurseries"],
    titik_desa: ["Village Points", "Intervention village centres"],
    kawasan_hutan_sk_903: ["Forest Estate SK 903", "Forest-function reference"],
    gambut_bbsdlp_2019: ["BBSDLP Peat Map 2019", "Peat-distribution reference"],
    iuphhk_ht_2014: ["IUPHHK-HT 2014", "Forest-utilisation licence reference"],
    perhutanan_sosial_riau: ["Riau Social Forestry", "Community forest access reference"]
  };
  let currentLanguage = localStorage.getItem("yg-v2-language") === "en" ? "en" : "id";

  const allConfigs = [...LAYERS, ...REFERENCES];
  const state = { layers: new Map(), features: [], bounds: L.latLngBounds([]), selected: null, loading: 0, databaseUpdated: "" };
  let masterDataPromise = null;
  let publicUpdatesPromise = null;
  let baselinePolicyPromise = null;

  const map = L.map("map", { preferCanvas: true, zoomControl: true, minZoom: 5 }).setView(DEFAULT_VIEW, DEFAULT_ZOOM);
  const baseMaps = {
    "Peta jalan": L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }),
    "Satelit": L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { maxZoom: 19, attribution: "Tiles © Esri" })
  };
  baseMaps["Peta jalan"].addTo(map);
  L.control.layers(baseMaps, null, { position: "topright" }).addTo(map);
  L.control.scale({ imperial: false, position: "bottomright" }).addTo(map);

  const $ = id => document.getElementById(id);
  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const cleanLabel = key => ({ NAMOBJ: "Nama desa", WADMKD: "Desa", WADMKC: "Kecamatan", WADMKK: "Kabupaten", WADMPR: "Provinsi", Luas_Ha: "Luas", Panjang_M: "Panjang", Ket: "Keterangan", Keterangan: "Keterangan", Tahun: "Tahun", Desa: "Desa", Kabupaten: "Kabupaten", Kecamatan: "Kecamatan" }[key] || key.replace(/_/g, " "));
  const hiddenKey = key => /^(OBJECTID|FID|FID_1|SRS_ID|Shape_|KODE_|X$|Y$|Id$|No$|_yg|Last_Verified_Report_ID)/i.test(key);
  function directPhotoUrl(url) {
    const text = String(url || "");
    const match = text.match(/\/d\/([A-Za-z0-9_-]+)/) ||
      text.match(/[?&]id=([A-Za-z0-9_-]+)/);
    return match
      ? "https://lh3.googleusercontent.com/d/" + match[1]
      : text;
  }

  const featureName = feature => {
    const p = feature.properties || {};
    return p.Nama_Objek || p.title || p.NAMA_PRH || p.NAMA_HKM || p.NAMOBJ || p.NAMA_DESA || p.Desa || p.WADMKD || p.Keterangan || "Objek program";
  };

  function layerText(config) {
    const english = EN_LAYER[config.id];
    return currentLanguage === "en" && english
      ? { label: english[0], caption: english[1] }
      : { label: config.label, caption: config.caption };
  }

  function layerRow(config) {
    const localized = layerText(config);
    const existing = state.layers.get(config.id);
    const checked = existing ? map.hasLayer(existing) : Boolean(config.visible);
    return `<div class="layer-item" style="--layer:${config.color}">
      <span class="layer-symbol"><i class="${config.type}"></i></span>
      <span class="layer-copy"><strong>${escapeHtml(localized.label)}</strong><small>${escapeHtml(localized.caption)}</small></span>
      <label class="switch" title="${currentLanguage === "en" ? "Enable" : "Aktifkan"} ${escapeHtml(localized.label)}"><input type="checkbox" data-layer="${config.id}" ${checked ? "checked" : ""}><span></span></label>
    </div>`;
  }

  function renderLayerControls() {
    $("program-layers").innerHTML = LAYERS.map(layerRow).join("");
    $("reference-layers").innerHTML = REFERENCES.map(layerRow).join("");
  }

  renderLayerControls();

  function styleFor(config) {
    return { color: config.color, fillColor: config.color, fillOpacity: config.type === "line" ? 0.08 : 0.23, weight: config.type === "line" ? 4 : 1.8, opacity: 0.92 };
  }

  function pointFor(config, latlng) {
    return L.circleMarker(latlng, { radius: 7, color: "#fff", weight: 2, fillColor: config.color, fillOpacity: 0.96 });
  }

  function addSearchFeature(feature, leafletLayer, parentLayer, config) {
    const properties = feature.properties || {};
    state.features.push({
      name: String(featureName(feature)),
      text: `${config.label} ${Object.values(properties).join(" ")}`.toLowerCase(),
      feature, leafletLayer, parentLayer, config
    });
  }

  function openFeature(item) {
    if (!map.hasLayer(item.parentLayer)) {
      item.parentLayer.addTo(map);
      const input = document.querySelector(`[data-layer="${item.config.id}"]`);
      if (input) input.checked = true;
    }
    state.selected = item;
    const p = item.feature.properties || {};
    $("detail-category").textContent = item.config.caption;
    $("detail-layer").textContent = item.config.label;
    $("detail-title").textContent = item.name;
    $("detail-cover").style.setProperty("--detail-color", item.config.color);
    const rows = Object.entries(p).filter(([key, value]) => !hiddenKey(key) && value !== null && value !== "" && typeof value !== "undefined").slice(0, 14);
    const knownArea = Number(p.Luas_Ha || p.LUAS_HA || p.LUAS_POLI || p.LUAS_UKURA || 0);
    const calculatedArea = geometryAreaHa(item.feature.geometry);
    if ((!Number.isFinite(knownArea) || knownArea <= 0) && calculatedArea > 0) {
      rows.push(["Luas_Poligon_Otomatis_Ha", new Intl.NumberFormat("id-ID", {
        maximumFractionDigits: 2
      }).format(calculatedArea)]);
    }
    $("detail-fields").innerHTML = rows.length ? rows.map(([key, value]) => `<div class="detail-row"><b>${escapeHtml(cleanLabel(key))}</b><span>${escapeHtml(value)}</span></div>`).join("") : '<div class="detail-row"><span>Informasi atribut belum tersedia.</span></div>';

    const photoCandidates = [
      ...(Array.isArray(p._ygPhotos) ? p._ygPhotos : []),
      p.Foto, p.Foto_1, p.Foto_2, p.Photo, p.photoUrl
    ].filter(Boolean);
    const photos = [...new Set(photoCandidates.map(String))];
    if ($("detail-gallery")) {
      $("detail-gallery").innerHTML = photos.length
        ? photos.map((url, index) =>
            `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer"><img src="${escapeHtml(directPhotoUrl(url))}" alt="Dokumentasi ${index + 1}" loading="lazy"></a>`
          ).join("")
        : "";
      $("detail-gallery").hidden = photos.length === 0;
    }

    $("detail-panel").classList.add("open");
    $("detail-panel").setAttribute("aria-hidden", "false");
    focusLayer(item.leafletLayer);
    closeSearch();
    closeMobileSidebar();
  }

  function focusLayer(layer) {
    if (layer.getLatLng) map.setView(layer.getLatLng(), 15);
    else if (layer.getBounds && layer.getBounds().isValid()) map.fitBounds(layer.getBounds(), { padding: [45, 45], maxZoom: 15 });
  }

  function normalizeVerifiedCommunityAsset(feature) {
    const props = feature && feature.properties || {};
    const layerId = String(props.Layer_ID || props.Source_Layer || "")
      .trim().toLowerCase();
    const geometryType = String(
      feature && feature.geometry && feature.geometry.type || ""
    );
    if (layerId !== "community_reports" || geometryType !== "Point") {
      return feature;
    }

    const identity = [
      props.title, props.locationName, props.Nama_Objek,
      props.description, props.reportType
    ].filter(Boolean).join(" ").toLowerCase();

    let target = null;
    if (
      identity.includes("menara tampung air") ||
      identity.includes("tower air") ||
      identity.includes("pendopo")
    ) {
      target = ["supporting_infrastructure", "Infrastruktur Pendukung",
        "Infrastruktur Pendukung Program"];
    } else if (identity.includes("plang")) {
      target = ["information_signs", "Plang Informasi & Perlindungan",
        "Plang Informasi dan Perlindungan"];
    } else if (
      identity.includes("nursery sepahat") ||
      identity.includes("rumah bibit sepahat") ||
      identity.includes("rumah bibit kelapa pati")
    ) {
      target = ["nursery_mangrove", "Rumah Pembibitan Mangrove",
        "Pembibitan Mangrove"];
    } else if (
      identity.includes("nursery ktwmj") ||
      identity.includes("rumah bibit kopi") ||
      identity.includes("nursery kopi")
    ) {
      target = ["nursery_coffee", "Rumah Pembibitan Kopi",
        "Pembibitan Kopi"];
    } else if (
      identity.includes("restorasi hutan adat imbo putui") ||
      identity.includes("lokasi pup 2")
    ) {
      target = ["forest_land_restoration", "Restorasi Hutan & Lahan",
        "Restorasi Hutan dan Lahan"];
    }

    if (!target) return feature;
    props.Audit_Source_Layer = props.Layer_ID || props.Source_Layer;
    props.Layer_ID = target[0];
    props.Source_Layer = target[0];
    props.Layer_Label = target[1];
    props.Kategori = target[2];
    props.Nama_Objek = props.locationName || props.title ||
      props.Nama_Objek || target[2];
    return feature;
  }

  function applyRequestedDonorCorrections(feature) {
    const props = feature && feature.properties || {};
    const layerId = String(props.Layer_ID || props.Source_Layer || "")
      .trim().toLowerCase();
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

  async function loadMasterData() {
    if (!masterDataPromise) {
      masterDataPromise = fetch(API + "&t=" + Date.now(), {
        cache: "no-store",
        redirect: "follow"
      }).then(response => {
        if (!response.ok) throw new Error("Master Database HTTP " + response.status);
        return response.json();
      }).then(data => {
        if (!data || !Array.isArray(data.features)) {
          throw new Error("Format Master Database tidak valid");
        }
        state.databaseUpdated = data.updatedAt || data.lastUpdated || "";
        data.features = data.features
          .map(normalizeVerifiedCommunityAsset)
          .map(applyRequestedDonorCorrections);
        return data;
      });
    }
    return masterDataPromise;
  }

  function layerIdOf(feature) {
    const p = feature && feature.properties || {};
    return String(p.Layer_ID || p.Source_Layer || "").trim().toLowerCase();
  }

  async function loadBaselinePolicy() {
    if (!baselinePolicyPromise) {
      baselinePolicyPromise = fetch("baseline-policy.json?v=20260721-1", {
        cache: "no-store"
      }).then(response => {
        if (!response.ok) throw new Error("Baseline policy HTTP " + response.status);
        return response.json();
      }).catch(error => {
        console.warn("Baseline policy menggunakan aturan aman bawaan", error);
        return {
          public_policy: {
            exclude_statuses: [
              "menunggu verifikasi", "ditolak", "draft",
              "rejected", "pending verification"
            ]
          }
        };
      });
    }
    return baselinePolicyPromise;
  }

  function stableHash(value) {
    let hash = 2166136261;
    const text = String(value || "");
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36).toUpperCase();
  }

  function identityFor(feature, layerId) {
    const p = feature && feature.properties || {};
    const sourceId = p.Object_ID || p.Master_Object_ID ||
      p.Source_Report_ID || p.reportId || p.Report_ID ||
      p.OBJECTID || p.FID;
    if (sourceId !== null && sourceId !== undefined &&
        String(sourceId).trim() !== "") {
      return layerId + ":" + normalizedValue(sourceId);
    }
    return layerId + ":legacy:" + stableHash(
      JSON.stringify(feature.geometry || {}) + "|" + featureName(feature)
    );
  }

  async function applyBaselinePolicy(data, config) {
    if (!data || !Array.isArray(data.features)) return data;
    const reference = REFERENCES.some(item => item.id === config.id);
    if (reference) return data;

    const policy = await loadBaselinePolicy();
    const excluded = new Set(
      (policy.public_policy && policy.public_policy.exclude_statuses || [])
        .map(normalizedValue)
    );
    const unique = new Map();

    data.features.forEach(feature => {
      if (!feature || !feature.geometry) return;
      const p = feature.properties || (feature.properties = {});
      const status = normalizedValue(
        p.Status_Verifikasi || p.Verification_Status ||
        p.Status_Laporan || p.Status
      );
      if (status && excluded.has(status)) return;

      const identity = identityFor(feature, config.id);
      if (!p.Object_ID) {
        p.Object_ID = "LEGACY-" + config.id.toUpperCase() + "-" +
          identity.split(":").pop().toUpperCase();
        p.Object_ID_Status = "Generated from baseline; requires admin confirmation";
      }
      p.Layer_ID = config.id;
      p.Source_Layer = config.id;
      p.Data_Source = config.staticFile
        ? "Official SHP / GeoJSON + Master Database"
        : "Master Database";
      p.Publication_Status = status || "legacy baseline";
      unique.set(identity, feature);
    });

    data.features = [...unique.values()];
    return data;
  }

  async function loadPublicUpdates() {
    if (!publicUpdatesPromise) {
      publicUpdatesPromise = fetch(UPDATES_API + "&t=" + Date.now(), {
        cache: "no-store",
        redirect: "follow"
      }).then(response => {
        if (!response.ok) throw new Error("Pembaruan publik HTTP " + response.status);
        return response.json();
      }).then(data => Array.isArray(data.updates) ? data.updates : [])
        .catch(error => {
          console.warn("Pembaruan publik belum dapat dimuat", error);
          return [];
        });
    }
    return publicUpdatesPromise;
  }

  function updateMatchesFeature(update, feature) {
    const target = update.targetFeatureProperties || {};
    const props = feature && feature.properties || {};
    const preferred = [
      "Object_ID", "No", "OBJECTID", "Id", "ID",
      "NAMOBJ", "NAMA_DESA", "Desa", "Tahun", "Nama", "NAMA"
    ];
    const keys = preferred.filter(key =>
      Object.prototype.hasOwnProperty.call(target, key) &&
      Object.prototype.hasOwnProperty.call(props, key)
    );
    if (keys.length) {
      return keys.every(key =>
        normalizedValue(target[key]) === normalizedValue(props[key])
      );
    }
    const fallback = Object.keys(target).filter(key =>
      Object.prototype.hasOwnProperty.call(props, key) &&
      target[key] !== null && typeof target[key] !== "object"
    ).slice(0, 4);
    return fallback.length > 0 && fallback.every(key =>
      normalizedValue(target[key]) === normalizedValue(props[key])
    );
  }

  async function applyPublishedUpdates(data, layerId) {
    if (!data || !Array.isArray(data.features)) return data;
    const updates = await loadPublicUpdates();

    updates.filter(update =>
      normalizedValue(update.targetLayerId) === normalizedValue(layerId)
    ).forEach(update => {
      const feature = data.features.find(candidate =>
        updateMatchesFeature(update, candidate)
      );
      if (!feature) return;
      const props = feature.properties || (feature.properties = {});

      if (normalizedValue(update.reportType) === "perbaikan informasi") {
        Object.assign(props, update.proposedChanges || {});
      }

      const photos = Array.isArray(update.photos) ? update.photos : [];
      props._ygPhotos = [...new Set([
        ...(Array.isArray(props._ygPhotos) ? props._ygPhotos : []),
        ...photos
      ].filter(Boolean))];

      if (update.note) {
        props._ygUpdateNotes = [...new Set([
          ...(Array.isArray(props._ygUpdateNotes) ? props._ygUpdateNotes : []),
          update.note
        ])];
      }
      props.Last_Verified_Report_ID = update.reportId || "";
    });

    return data;
  }

  function normalizedValue(value) {
    return String(value == null ? "" : value).trim().toLowerCase();
  }

  function numericValue(value) {
    const match = String(value == null ? "" : value)
      .replace(",", ".").match(/-?\d+(?:\.\d+)?/);
    return match ? Number(match[0]) : NaN;
  }

  function enrichOfficialData(config, official, database) {
    if (!official || !Array.isArray(official.features) ||
        !database || !Array.isArray(database.features)) return official;

    const candidates = database.features.filter(feature =>
      layerIdOf(feature) === config.id
    );

    official.features.forEach(feature => {
      const p = feature.properties || (feature.properties = {});
      const objectId = normalizedValue(p.Object_ID || p.OBJECTID);
      const reportId = normalizedValue(p.Source_Report_ID);
      let match = candidates.find(candidate => {
        const cp = candidate.properties || {};
        return objectId && normalizedValue(
          cp.Object_ID || cp.OBJECTID || cp.Master_Object_ID
        ) === objectId;
      });

      if (!match && reportId) {
        match = candidates.find(candidate => {
          const cp = candidate.properties || {};
          return normalizedValue(
            cp.Source_Report_ID || cp.reportId || cp.Report_ID
          ) === reportId;
        });
      }

      if (!match) {
        const village = normalizedValue(p.Desa || p.WADMKD || p.NAMA_DESA);
        const year = normalizedValue(p.Tahun || p.TAHUN);
        const area = numericValue(
          p.Luas_Ha || p.LUAS_HA || p.LUAS_POLI || p.LUAS_UKURA
        );
        const ranked = candidates.map(candidate => {
          const cp = candidate.properties || {};
          const candidateVillage = normalizedValue(
            cp.Desa || cp.WADMKD || cp.NAMA_DESA
          );
          const candidateYear = normalizedValue(cp.Tahun || cp.TAHUN);
          const candidateArea = numericValue(
            cp.Luas_Ha || cp.LUAS_HA || cp.LUAS_POLI || cp.LUAS_UKURA
          );
          if (!village || candidateVillage !== village) return null;
          if (year && candidateYear && year !== candidateYear) return null;
          return {
            feature: candidate,
            difference: Number.isFinite(area) && Number.isFinite(candidateArea)
              ? Math.abs(area - candidateArea)
              : Number.MAX_SAFE_INTEGER
          };
        }).filter(Boolean).sort((a, b) => a.difference - b.difference);
        match = ranked.length ? ranked[0].feature : null;
      }

      if (match) {
        feature.properties = {
          ...(match.properties || {}),
          ...p,
          Master_Object_ID: (match.properties || {}).Object_ID ||
            p.Master_Object_ID || ""
        };
      }

      feature.properties.Layer_ID = config.id;
      feature.properties.Source_Layer = config.id;
    });

    return official;
  }

  async function dataFor(config) {
    const reference = REFERENCES.some(item => item.id === config.id);
    if (reference || config.staticFile) {
      const file = reference ? config.file : config.staticFile;
      const response = await fetch("../data/" + file + "?v=20260721-v2", {
        cache: "no-store"
      });
      if (!response.ok) throw new Error("HTTP " + response.status);
      const data = await response.json();

      if (!reference && config.staticFile) {
        try {
          const database = await loadMasterData();
          const enriched = enrichOfficialData(config, data, database);
          return applyBaselinePolicy(
            await applyPublishedUpdates(enriched, config.id), config
          );
        } catch (error) {
          console.warn("Atribut Master Database tidak dapat digabungkan", error);
        }
      }
      return reference ? data : applyBaselinePolicy(
        await applyPublishedUpdates(data, config.id), config
      );
    }

    const database = await loadMasterData();
    const prepared = await applyPublishedUpdates({
      type: "FeatureCollection",
      features: database.features.filter(feature =>
        layerIdOf(feature) === config.id
      )
    }, config.id);
    return applyBaselinePolicy(prepared, config);
  }

  function ringAreaSquareMeters(ring) {
    if (!Array.isArray(ring) || ring.length < 3) return 0;
    const radius = 6378137;
    const radians = Math.PI / 180;
    let area = 0;
    for (let index = 0; index < ring.length; index += 1) {
      const current = ring[index];
      const next = ring[(index + 1) % ring.length];
      if (!current || !next) continue;
      area += (next[0] - current[0]) * radians *
        (2 + Math.sin(current[1] * radians) + Math.sin(next[1] * radians));
    }
    return Math.abs(area * radius * radius / 2);
  }

  function polygonAreaSquareMeters(rings) {
    if (!Array.isArray(rings) || !rings.length) return 0;
    return Math.max(0, ringAreaSquareMeters(rings[0]) -
      rings.slice(1).reduce((sum, ring) => sum + ringAreaSquareMeters(ring), 0));
  }

  function geometryAreaHa(geometry) {
    if (!geometry || !Array.isArray(geometry.coordinates)) return 0;
    const squareMeters = geometry.type === "Polygon"
      ? polygonAreaSquareMeters(geometry.coordinates)
      : geometry.type === "MultiPolygon"
        ? geometry.coordinates.reduce((sum, polygon) =>
            sum + polygonAreaSquareMeters(polygon), 0)
        : 0;
    return squareMeters / 10000;
  }

  async function loadLayer(config, shouldShow = config.visible) {
    if (state.layers.has(config.id)) {
      const existing = state.layers.get(config.id);
      if (shouldShow && !map.hasLayer(existing)) existing.addTo(map);
      return existing;
    }
    const input = document.querySelector(`[data-layer="${config.id}"]`);
    if (input) input.disabled = true;
    state.loading += 1;
    setStatus();
    try {
      const data = await dataFor(config);
      if (!data || !Array.isArray(data.features)) {
        throw new Error("GeoJSON tidak valid");
      }
      let geoLayer;
      geoLayer = L.geoJSON(data, {
        style: () => styleFor(config),
        pointToLayer: (_feature, latlng) => pointFor(config, latlng),
        onEachFeature: (feature, featureLayer) => {
          const item = { name: featureName(feature), feature, leafletLayer: featureLayer, parentLayer: null, config };
          featureLayer.on("click", () => openFeature({ ...item, parentLayer: geoLayer }));
          featureLayer.on("mouseover", event => { if (event.target.setStyle) event.target.setStyle({ weight: config.type === "line" ? 6 : 3, fillOpacity: 0.36 }); });
          featureLayer.on("mouseout", event => { if (geoLayer.resetStyle) geoLayer.resetStyle(event.target); });
          addSearchFeature(feature, featureLayer, geoLayer, config);
        }
      });
      state.layers.set(config.id, geoLayer);
      const bounds = geoLayer.getBounds();
      if (bounds.isValid() && !REFERENCES.some(item => item.id === config.id)) state.bounds.extend(bounds);
      if (shouldShow) geoLayer.addTo(map);
      if (input) input.checked = shouldShow;
      updateMetrics();
      return geoLayer;
    } catch (error) {
      console.error(`Gagal memuat ${config.id}`, error);
      if (input) { input.checked = false; input.closest(".layer-item").title = "Layer gagal dimuat"; }
      toast(`Layer ${config.label} gagal dimuat`);
      throw error;
    } finally {
      state.loading -= 1;
      if (input) input.disabled = false;
      setStatus();
      updateVisibleCount();
    }
  }

  function setStatus() {
    const loaded = state.layers.size;
    const text = currentLanguage === "en"
      ? (state.loading ? `Loading ${state.loading} layers…` : `${loaded} layers ready to explore`)
      : (state.loading ? `Memuat ${state.loading} layer…` : `${loaded} layer siap dijelajahi`);
    $("data-status").textContent = text;
    $("data-dot").parentElement.classList.toggle("ready", state.loading === 0 && loaded > 0);
  }

  function featureCount(id) {
    const layer = state.layers.get(id);
    return layer ? layer.getLayers().length : 0;
  }

  function updateMetrics() {
    $("metric-villages").textContent = featureCount("desa_intervensi").toLocaleString("id-ID") || "—";
    $("metric-fdrs").textContent = featureCount("fdrs").toLocaleString("id-ID") || "—";
    $("metric-canal").textContent = featureCount("sekat_kanal").toLocaleString("id-ID") || "—";
    const programFeatures = state.features.filter(item =>
      !REFERENCES.some(reference => reference.id === item.config.id)
    );
    const mangrove = programFeatures.filter(item =>
      item.config.id === "area_mangrove"
    );
    const area = mangrove.reduce((sum, item) => {
      const p = item.feature.properties || {};
      const value = Number(p.Luas_Ha || p.LUAS_HA || p.luas_ha || 0);
      return sum + (Number.isFinite(value) ? value : 0);
    }, 0);
    $("metric-mangrove").textContent = area > 0 ? `${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(area)} ha` : featureCount("area_mangrove").toLocaleString("id-ID") || "—";

    const donors = new Set();
    const districts = new Set();
    programFeatures.forEach(item => {
      const p = item.feature.properties || {};
      const donor = p.Donor || p.Nama_Donor || p.Funding_Source;
      const district = p.Kabupaten || p.WADMKK || p.NAMA_KAB;
      if (donor) donors.add(normalizedValue(donor));
      if (district) districts.add(normalizedValue(district));
    });
    if ($("metric-objects")) $("metric-objects").textContent =
      programFeatures.length.toLocaleString("id-ID");
    if ($("metric-donors")) $("metric-donors").textContent =
      donors.size.toLocaleString("id-ID");
    if ($("metric-districts")) $("metric-districts").textContent =
      districts.size.toLocaleString("id-ID");
    if ($("metric-monitoring")) $("metric-monitoring").textContent =
      featureCount("monitoring_reports").toLocaleString("id-ID");
  }

  function updateVisibleCount() {
    let count = 0;
    state.layers.forEach(layer => { if (map.hasLayer(layer)) count += layer.getLayers().length; });
    $("visible-feature-count").textContent = currentLanguage === "en" ? `${count.toLocaleString("en-US")} visible objects` : `${count.toLocaleString("id-ID")} objek tampil`;
    const active = [...state.layers.values()].filter(layer => map.hasLayer(layer)).length;
    $("active-layer-count").textContent = active;
  }

  document.addEventListener("change", async event => {
    const input = event.target.closest("[data-layer]");
    if (!input) return;
    const config = allConfigs.find(item => item.id === input.dataset.layer);
    if (!config) return;
    if (input.checked) {
      try { await loadLayer(config, true); } catch (_) { input.checked = false; }
    } else {
      const layer = state.layers.get(config.id);
      if (layer) map.removeLayer(layer);
    }
    updateVisibleCount();
  });

  function renderSearch(query = "") {
    const normalized = query.trim().toLowerCase();
    const matches = state.features.filter(item => !normalized || item.text.includes(normalized)).slice(0, 30);
    $("search-results").innerHTML = matches.length ? matches.map((item, index) => `<button class="search-result${index === 0 ? " active" : ""}" type="button" data-search-index="${state.features.indexOf(item)}" style="--result-color:${item.config.color}"><i class="search-result-dot"></i><span><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.config.label)}</small></span><em>Lihat →</em></button>`).join("") : `<div class="search-empty">Tidak ada lokasi yang cocok dengan “${escapeHtml(query)}”.</div>`;
  }

  function openSearch() {
    $("search-dialog").hidden = false;
    renderSearch($("search-input").value);
    setTimeout(() => $("search-input").focus(), 30);
  }
  function closeSearch() { $("search-dialog").hidden = true; }
  $("search-trigger").addEventListener("click", openSearch);
  document.querySelector("[data-close-search]").addEventListener("click", closeSearch);
  $("search-input").addEventListener("input", event => renderSearch(event.target.value));
  $("search-results").addEventListener("click", event => {
    const button = event.target.closest("[data-search-index]");
    if (button) openFeature(state.features[Number(button.dataset.searchIndex)]);
  });
  document.addEventListener("keydown", event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); openSearch(); }
    if (event.key === "Escape") { closeSearch(); closeDetail(); }
    if (event.key === "Enter" && !$("search-dialog").hidden) document.querySelector(".search-result")?.click();
  });

  function closeDetail() { $("detail-panel").classList.remove("open"); $("detail-panel").setAttribute("aria-hidden", "true"); }
  $("detail-close").addEventListener("click", closeDetail);
  $("detail-zoom").addEventListener("click", () => state.selected && focusLayer(state.selected.leafletLayer));
  $("fit-button").addEventListener("click", () => state.bounds.isValid() ? map.fitBounds(state.bounds, { padding: [30, 30] }) : map.setView(DEFAULT_VIEW, DEFAULT_ZOOM));
  document.querySelectorAll("[data-focus]").forEach(button => button.addEventListener("click", async () => {
    const config = allConfigs.find(item => item.id === button.dataset.focus);
    const layer = await loadLayer(config, true);
    if (layer.getBounds().isValid()) map.fitBounds(layer.getBounds(), { padding: [35, 35], maxZoom: 13 });
    updateVisibleCount();
  }));
  $("toggle-programs").addEventListener("click", () => {
    const visible = LAYERS.some(config => { const layer = state.layers.get(config.id); return layer && map.hasLayer(layer); });
    LAYERS.forEach(config => {
      const layer = state.layers.get(config.id);
      const input = document.querySelector(`[data-layer="${config.id}"]`);
      if (layer) visible ? map.removeLayer(layer) : layer.addTo(map);
      if (input && layer) input.checked = !visible;
    });
    $("toggle-programs").textContent = visible ? "Aktifkan semua" : "Matikan semua";
    updateVisibleCount();
  });
  $("locate-button").addEventListener("click", () => map.locate({ setView: true, maxZoom: 15, enableHighAccuracy: true }));
  map.on("locationfound", event => L.circleMarker(event.latlng, { radius: 8, color: "#fff", weight: 3, fillColor: "#123c2e", fillOpacity: 1 }).addTo(map).bindPopup("Lokasi Anda").openPopup());
  map.on("locationerror", () => toast("Lokasi tidak tersedia. Periksa izin lokasi browser."));
  $("fullscreen-button").addEventListener("click", async () => { try { if (!document.fullscreenElement) await document.documentElement.requestFullscreen(); else await document.exitFullscreen(); } catch (_) { toast("Mode layar penuh tidak tersedia"); } });
  map.on("zoomend", () => $("zoom-readout").textContent = `Zoom ${map.getZoom()}`);

  function toggleMobileSidebar() { $("sidebar").classList.toggle("open"); }
  function closeMobileSidebar() { $("sidebar").classList.remove("open"); }
  $("layers-mobile-button").addEventListener("click", toggleMobileSidebar);
  $("mobile-sheet-handle").addEventListener("click", toggleMobileSidebar);

  function setText(selector, idText, enText) {
    const element = document.querySelector(selector);
    if (element) element.textContent = currentLanguage === "en" ? enText : idText;
  }

  function applyLanguage() {
    document.documentElement.lang = currentLanguage;
    $("language-button").textContent = currentLanguage === "en" ? "ID" : "EN";
    $("language-button").title = currentLanguage === "en" ? "Bahasa Indonesia" : "English";
    setText(".intro-card .eyebrow", "Peta dampak program", "Programme impact map");
    setText(".intro-card h1", "Memantau bentang alam, dari data menuju aksi.", "Monitoring landscapes, from data to action.");
    setText(".intro-card p", "Jelajahi kerja Yayasan Gambut untuk ekosistem gambut, mangrove, pesisir, dan masyarakat.", "Explore Yayasan Gambut's work across peatlands, mangroves, coasts and communities.");
    setText("#summary-title", "Cakupan program", "Programme coverage");
    setText("#baseline-title", "Kualitas dan cakupan data", "Data quality and coverage");
    setText("#system-title", "Alur pengelolaan", "Management workflow");
    setText("#program-title", "Layer program", "Programme layers");
    setText("#reference-title", "Layer referensi", "Reference layers");
    setText("#fit-button", "Lihat semua", "View all");
    setText("#toggle-programs", "Matikan semua", "Turn all off");
    setText("#metric-villages + span", "Desa intervensi", "Intervention villages");
    setText("#metric-mangrove + span", "Area mangrove", "Mangrove area");
    setText("#metric-fdrs + span", "Lokasi FDRS", "FDRS locations");
    setText("#metric-canal + span", "Sekat kanal", "Canal blocks");
    setText("#metric-objects + span", "Objek program", "Programme objects");
    setText("#metric-districts + span", "Kabupaten terdata", "Regencies covered");
    setText("#metric-donors + span", "Donor/mitra", "Donors/partners");
    setText("#metric-monitoring + span", "Monitoring terverifikasi", "Verified monitoring");
    const search = $("search-input");
    if (search) search.placeholder = currentLanguage === "en" ? "Search villages, programmes or locations…" : "Cari desa, program, atau lokasi…";
    renderLayerControls();
    setStatus();
    updateVisibleCount();
  }

  $("language-button").addEventListener("click", () => {
    currentLanguage = currentLanguage === "id" ? "en" : "id";
    localStorage.setItem("yg-v2-language", currentLanguage);
    applyLanguage();
    renderSearch($("search-input").value);
  });
  applyLanguage();

  let toastTimer;
  function toast(message) { clearTimeout(toastTimer); $("toast").textContent = message; $("toast").classList.add("show"); toastTimer = setTimeout(() => $("toast").classList.remove("show"), 2800); }

  Promise.allSettled(LAYERS.map(config => loadLayer(config, config.visible))).then(() => {
    if (state.bounds.isValid()) map.fitBounds(state.bounds, { padding: [28, 28], maxZoom: 11 });
    setTimeout(() => map.invalidateSize(), 120);
    updateVisibleCount();
    renderSearch();
  });
})();
