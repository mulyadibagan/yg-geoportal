(() => {
  "use strict";

  const API = "https://script.google.com/macros/s/AKfycbxUe4QyBvSiL9UJsL-nsJ5XrohDabwqhYYR9q5CTgLYiW1ZCfVy429iMlpU-lCDUSvvRg/exec?page=objects";
  const CALLBACK = "ygDashboardV3Callback";
  const CAPACITY_BASELINE_URL = "data/capacity-building.json?v=20260722-3";
  const PUBLIC_REPORTS_API = API.replace("?page=objects", "?page=public-reports");
  const OFFICIAL_LAYERS = [
    { id: "area_mangrove", url: "data/area_mangrove.geojson" },
    { id: "area_kopi", url: "data/area_kopi.geojson" },
    { id: "kopi", url: "data/kopi.geojson" }
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

  function calculateEstimatedPeatRewettingArea(unitCount) {
    var count = Number(unitCount);
    if (!Number.isFinite(count) || count < 0) {
      count = 11;
    }
    return count * 50;
  }

  function numericValue(props, keys) {
    let raw = "";
    for (const key of keys) {
      if (props && props[key] !== null && props[key] !== undefined &&
          String(props[key]).trim() !== "") {
        raw = props[key];
        break;
      }
    }
    if (raw === "") return 0;

    // Nilai numerik dari GeoJSON harus dipertahankan apa adanya. Sebelumnya
    // 0.971 diubah menjadi teks lalu titiknya dianggap pemisah ribuan,
    // sehingga terbaca sebagai 971 hektare.
    if (typeof raw === "number") {
      return Number.isFinite(raw) ? raw : 0;
    }

    const normalized = String(raw).replace(/\s+/g, "")
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
    if (!element) return;
    if (!Number.isFinite(Number(value))) {
      element.textContent = "Data belum tersedia";
      return;
    }
    animateCounter(element, Number(value), digits, suffix);
  }

  function setText(id, value) {
    const element = document.getElementById(id);
    if (!element) return;
    element.textContent = value;
  }

  function setStateBadge(id, stateText, stateClass) {
    const element = document.getElementById(id);
    if (!element) return;
    element.textContent = stateText;
    element.classList.remove("state-in-progress", "state-completed");
    if (stateClass) element.classList.add(stateClass);
  }

  function compactSentence(value, limit = 170) {
    const raw = String(value || "").replace(/\s+/g, " ").trim();
    if (!raw) return "";
    if (raw.length <= limit) return raw;
    return raw.slice(0, limit - 1).trimEnd() + "…";
  }

  function animateCounter(element, value, digits = 0, suffix = "") {
    const reduceMotion = window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion || value === 0) {
      element.textContent = formatNumber(value, digits) + suffix;
      return;
    }
    const startedAt = performance.now();
    const duration = 650;
    function frame(now) {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      element.textContent = formatNumber(value * eased, digits) + suffix;
      if (progress < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  function layerIdOf(feature) {
    const props = feature.properties || {};
    const normalizedProps = Object.keys(props).reduce((acc, key) => {
      acc[key.toLowerCase()] = props[key];
      return acc;
    }, {});

    const candidates = [
      "layer_id",
      "source_layer",
      "layerid",
      "layer_id",
      "layerid",
      "layer",
      "id"
    ];

    for (const candidate of candidates) {
      const value = normalizedProps[candidate];
      if (value !== null && value !== undefined) {
        const normalized = String(value).trim();
        if (normalized) return normalized.toLowerCase();
      }
    }

    return "";
  }

  function firstValue(props, keys) {
    for (const key of keys) {
      const value = String(props[key] == null ? "" : props[key]).trim();
      if (value) return value;
    }
    return "";
  }

  function numericFrom(props, keys) {
    for (const key of keys) {
      const value = numericValue(props || {}, [key]);
      if (Number.isFinite(value) && value !== 0) return value;
    }
    return 0;
  }

  function parseObject(value) {
    if (!value) return {};
    if (typeof value === "object" && !Array.isArray(value)) return value;
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (error) {
      return {};
    }
  }

  function jsonp(url) {
    return new Promise((resolve, reject) => {
      const callback = "ygCapacitySummary" + Date.now() + Math.floor(Math.random() * 1000);
      const script = document.createElement("script");
      const separator = url.includes("?") ? "&" : "?";
      const cleanup = () => {
        delete window[callback];
        script.remove();
      };
      window[callback] = data => {
        cleanup();
        resolve(data);
      };
      script.onerror = () => {
        cleanup();
        reject(new Error("Data peningkatan kapasitas tidak dapat dimuat."));
      };
      script.src = url + separator + "callback=" + callback + "&t=" + Date.now();
      document.head.appendChild(script);
    });
  }

  function capacityRecordFromFeature(feature) {
    const props = (feature && feature.properties) || {};
    const proposed = parseObject(props.proposedChanges);
    const information = parseObject(props.proposedInformation);
    const details = proposed.capacityBuilding || information.capacityBuilding ||
      (Object.keys(proposed).length ? proposed : information);
    return {
      id: firstValue(props, ["reportId", "Object_ID"]),
      name: firstValue(props, ["title", "Nama_Objek"]),
      date: firstValue(props, ["activityDate", "publishedAt"]),
      location: firstValue(props, ["locationName", "Desa", "village"]),
      village: firstValue(props, ["Desa", "village"]),
      male: numericFrom(details, ["maleParticipants", "male"]),
      female: numericFrom(details, ["femaleParticipants", "female"]),
      group: firstValue(details, ["communityGroup", "group"]),
      target: firstValue(details, ["participantTarget", "target"])
    };
  }

  function capacityVillage(record) {
    const explicit = String(record.village || "").trim();
    if (explicit) return explicit;
    const first = String(record.location || "").split(",")[0].trim();
    // Beberapa baseline menulis lokasi kelembagaan (HKm/KTH) sebelum nama
    // desa. Satukan keduanya agar Siarang Arang tidak dihitung dua kali.
    if (/siarang arang/i.test(first)) return "Siarang Arang";
    if (/^kantor bupati/i.test(first)) return "";
    return first;
  }

  async function loadCapacitySummary() {
    const [baselineResult, reportsResult] = await Promise.allSettled([
      fetch(CAPACITY_BASELINE_URL).then(response =>
        response.ok ? response.json() : []
      ),
      jsonp(PUBLIC_REPORTS_API)
    ]);
    const baseline = baselineResult.status === "fulfilled" &&
      Array.isArray(baselineResult.value) ? baselineResult.value : [];
    const reports = reportsResult.status === "fulfilled"
      ? reportsResult.value : null;
    const live = ((reports && reports.features) || [])
        .filter(feature => firstValue((feature && feature.properties) || {}, ["reportType"]) === "Capacity Building")
        .map(capacityRecordFromFeature);

    const seen = new Set();
    const records = baseline.concat(live).filter(record => {
      const key = String(record.id || [record.name, record.date, record.location].join("|")).trim();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    const villages = new Set();
    const groups = new Set();
    let participants = 0;
    records.forEach(record => {
      participants += Number(record.male || 0) + Number(record.female || 0);
      const village = capacityVillage(record);
      if (village) villages.add(village.toLowerCase());
      const group = String(record.group || record.target || "").trim();
      if (group) groups.add(group.toLowerCase());
    });
    return { loaded: records.length > 0, trainings: records.length, participants, villages, groups };
  }

  function normalizedText(props) {
    return [
      firstValue(props, ["Nama_Objek", "title", "locationName"]),
      firstValue(props, ["Kategori", "Layer_Label", "reportType"]),
      firstValue(props, ["Program", "Nama_Program"]),
      firstValue(props, ["description", "Ket", "Keterangan"])
    ].join(" ").toLowerCase();
  }

  function featureIdentity(feature, index) {
    const props = (feature && feature.properties) || {};
    return firstValue(props, [
      "Object_ID", "objectId", "Target_Object_ID", "reportId", "Monitoring_ID"
    ]) || [layerIdOf(feature), normalizedText(props), index].join("|");
  }

  function uniqueFeatures(features) {
    const seen = new Set();
    return features.filter((feature, index) => {
      const identity = featureIdentity(feature, index).toLowerCase();
      if (seen.has(identity)) return false;
      seen.add(identity);
      return true;
    });
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

  function toPhotoList(value) {
    if (!value) return [];
    if (Array.isArray(value)) {
      return value.map(item => String(item || "").trim()).filter(Boolean);
    }
    const raw = String(value).trim();
    if (!raw) return [];
    if (raw.startsWith("{") && raw.endsWith("}")) {
      return raw.slice(1, -1).split(",").map(item =>
        item.trim().replace(/^"|"$/g, "")
      ).filter(Boolean);
    }
    return raw.split(",").map(item => item.trim()).filter(Boolean);
  }

  function toPreviewImage(url) {
    const raw = String(url || "").trim();
    if (!raw) return "";
    const match = raw.match(/\/d\/([^/]+)/);
    if (match && match[1]) {
      return "https://drive.google.com/thumbnail?id=" +
        encodeURIComponent(match[1]) + "&sz=w1600";
    }
    return raw;
  }

  function featureText(feature) {
    const props = (feature && feature.properties) || {};
    return [
      firstValue(props, ["Nama_Objek", "title", "locationName"]),
      firstValue(props, ["description", "Keterangan", "Ket"]),
      firstValue(props, ["Desa", "village"]),
      firstValue(props, ["Donor", "Donor_Cluster"])
    ].join(" ").toLowerCase();
  }

  function findFeaturePhoto(features, includeTerms) {
    const terms = includeTerms.map(term => term.toLowerCase());
    const hit = features.find(feature => {
      const text = featureText(feature);
      return terms.every(term => text.includes(term));
    });
    if (!hit) return "";
    const props = hit.properties || {};
    const photos = toPhotoList(props.photos || props.Photos || props.photo || props.image);
    return photos.length ? toPreviewImage(photos[0]) : "";
  }

  function setPhotoSlot(slotName, url) {
    if (!url) return;
    const node = document.querySelector('[data-penabulu-photo-slot="' + slotName + '"]');
    if (!node) return;
    node.src = url;
  }

  function hydratePenabuluPhotos(features) {
    const penabuluWaterTowerPinned = "https://drive.google.com/thumbnail?id=1QyL6V-1Nw0s1OjPbjBoav4dPYa8_Mb7a&sz=w1000";
    const penabuluSopPinned = "https://drive.google.com/thumbnail?id=1h1S-K3MLPEHKNHazOUjzSRN5kEh_9o8E&sz=w1200";
    const penabuluWomenGroupPinned = "https://drive.google.com/thumbnail?id=1DTCCNQnzs31pohWySwQKonmexcrIy9sX&sz=w1600";
    const penabuluMicroMillPinned = "https://drive.google.com/thumbnail?id=1txXo6MOZS-sMAsK4KB65FjMeGIuZyoAU&sz=w1200";
    const dryingHouse = findFeaturePhoto(features, ["rumah jemur", "temiang"]);
    const waterTower = penabuluWaterTowerPinned ||
      findFeaturePhoto(features, ["menara", "temiang"]);
    const nursery = findFeaturePhoto(features, ["nursery", "temiang"]);

    setPhotoSlot("drying-house", dryingHouse);
    setPhotoSlot("gallery-drying-house", dryingHouse);

    setPhotoSlot("water-system", waterTower);
    setPhotoSlot("gallery-water-tower", waterTower);
    setPhotoSlot("sop", penabuluSopPinned);
    setPhotoSlot("gallery-sop", penabuluSopPinned);

    // Sampai foto khusus tersedia di data peta, gunakan foto lapangan terdekat.
    setPhotoSlot("micro-mill", penabuluMicroMillPinned || nursery || dryingHouse);
    setPhotoSlot("gallery-micro-mill", penabuluMicroMillPinned || nursery || dryingHouse);
    setPhotoSlot("gallery-women-group", penabuluWomenGroupPinned || nursery || dryingHouse);
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
    const layerResults = await Promise.all(OFFICIAL_LAYERS.map(async source => {
      try {
        const response = await fetch(source.url);
        if (!response.ok) throw new Error("HTTP " + response.status);
        return { source, data: await response.json() };
      } catch (error) {
        console.warn("Layer resmi dashboard gagal dimuat:", source.id, error);
        return { source, data: null };
      }
    }));

    for (const result of layerResults) {
      const source = result.source;
      const data = result.data;
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
              : source.id === "kopi"
                ? ((feature.properties || {}).Donor || "Global Environment Centre")
                : (feature.properties || {}).Donor,
            Donor_Cluster: source.id === "area_mangrove"
              ? "Aramco Asia Singapore"
              : source.id === "kopi"
                ? ((feature.properties || {}).Donor_Cluster ||
                  (feature.properties || {}).Donor ||
                  "Global Environment Centre")
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
    const objectId = firstValue(props, ["Object_ID"]).toUpperCase();
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

  async function renderDashboard(data) {
    if (!data || data.type !== "FeatureCollection" || !Array.isArray(data.features)) {
      document.getElementById("dashboard-updated").textContent =
        "Respons database tidak valid.";
      return;
    }

    const capacitySummary = await loadCapacitySummary();
    const mergedFeatures = (await mergeOfficialLayers(data.features))
      .map(applyPematangDukuDonorPolicy)
      .map(applyAramcoCoastalAssetPolicy)
      .map(applyExternalPeatInfrastructureDonorPolicy)
      .map(applyRequestedDonorCorrections);
    const active = uniqueFeatures(mergedFeatures.filter(feature => {
      if (!feature || !feature.geometry) return false;
      const props = feature.properties || {};
      const status = String(props.Status_Objek || props.status || "Aktif").toLowerCase();
      return !["nonaktif", "ditolak", "menunggu verifikasi", "perlu perbaikan"]
        .includes(status);
    }));

    const regencies = new Set();
    const villages = new Set();
    const programs = {};
    const programLayers = {};
    const donors = {};
    const donorPrograms = {};
    const regencyCounts = {};
    let restorationArea = 0;
    let plantedSeedlings = 0;
    const programmeMetrics = {
      mangrove: { area: 0, seedlings: 0, nurseries: new Set(), wave: 0, villages: new Set() },
      peat: { area: 0, coffee: 0, forest: 0, canals: 0, rewetting: 0, fireInfra: 0, nurseries: 0 },
      mineral: { area: 0, seedlings: 0, towers: 0, signs: 0, plots: 0 },
      capacity: { trainings: 0, participants: 0, villages: new Set(), groups: new Set() }
    };
    if (capacitySummary.loaded) {
      programmeMetrics.capacity = capacitySummary;
    }

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
      const text = normalizedText(props);
      const area = numericFrom(props, [
        "Luas_Ha", "Luas", "luas_ha", "Area_Ha", "Restoration_Area_Ha"
      ]);
      const seedlings = numericFrom(props, [
        "Jumlah_Bib", "Jumlah_Bibit", "Jumlah_Tanam", "Bibit_Ditanam",
        "Pohon_Ditanam", "jumlah_bibit", "jumlah_tanam"
      ]);
      const forestSeedlings = numericFrom(props, [
        "Bibit_Hutan_MPTS", "Jumlah_Bibit_Hutan", "Jumlah_MPTS", "Forest_MPTS_Seedlings"
      ]);
      const participants = numericFrom(props, [
        "Jumlah_Peserta", "Peserta", "Participants", "participant_count"
      ]);
      const isNursery = /nursery|rumah bibit|pembibitan|persemaian/.test(text);
      const isMangrove = layerId === "area_mangrove" ||
        layerId === "apo" || layerId === "nursery_mangrove" ||
        layerId === "persemaian_mangrove" || text.includes("mangrove") ||
        (isNursery && !/kopi|coffee|ktwmj/.test(text));
      const isPeat = ["area_kopi", "kopi", "nursery_kopi", "sekat_kanal", "fdrs"]
        .includes(layerId) || /gambut|peat|agroforestri|kopi/.test(text);
      const isMineral = /hutan adat|hutan desa|imbo putui|lahan mineral|plot ukur permanen|\bpup\b/.test(text);
      const isCapacity = /pelatihan|peningkatan kapasitas|workshop|sosialisasi|pendampingan/.test(text) || participants > 0;
      const isAdministrative = ["desa_intervensi", "titik_desa"].includes(layerId);
      const isObservation = ["monitoring_reports", "fdrs"].includes(layerId) ||
        (layerId === "community_reports" && area <= 0 && seedlings <= 0 &&
          !isMineral && !isCapacity && !isNursery);

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

      if (!isAdministrative && !isObservation && !isNursery) {
        restorationArea += area;
        plantedSeedlings += seedlings;
      }

      if (isMangrove) {
        if (layerId === "area_mangrove") {
          programmeMetrics.mangrove.area += area;
          programmeMetrics.mangrove.seedlings += seedlings;
        }
        if (isNursery) {
          // Satu rumah bibit dapat hadir sebagai objek Master Database dan
          // sebagai laporan masyarakat terverifikasi. Hitung lokasi unik agar
          // aset yang sama tidak tampil dua kali pada dashboard.
          const nurseryVillage = village.toLowerCase() ||
            (["buruk bakul", "kelapa pati", "sepahat", "tanjung kuras"]
              .find((name) => text.includes(name)) || "");
          const nurseryKey = nurseryVillage || firstValue(props, [
            "Object_ID", "objectId", "Nama_Objek", "objectName", "title"
          ]).toLowerCase();
          if (nurseryKey) programmeMetrics.mangrove.nurseries.add(nurseryKey);
        }
        if (layerId === "apo" || /wave breaker|hybrid engineering|pemecah ombak/.test(text)) {
          programmeMetrics.mangrove.wave += numericFrom(props,
            ["Panjang_M", "Panjang_m", "Panjang", "Length_m"]);
        }
        if (village) programmeMetrics.mangrove.villages.add(village.toLowerCase());
      }

      if (isPeat) {
        if (layerId === "area_kopi" || /restorasi gambut|agroforestri/.test(text)) {
          programmeMetrics.peat.area += area;
        }
        // Titik penanaman kopi resmi disimpan pada layer `kopi`, sedangkan
        // Pematang Duku disimpan sebagai `area_kopi`. Jumlahkan keduanya,
        // tetapi abaikan rumah bibit agar stok persemaian tidak dianggap
        // sebagai bibit yang sudah ditanam.
        if (
          !isNursery &&
          (layerId === "kopi" || layerId === "area_kopi" || /kopi|coffee/.test(text))
        ) {
          programmeMetrics.peat.coffee += seedlings;
        }
        programmeMetrics.peat.forest += forestSeedlings;
        if (layerId === "sekat_kanal" || /sekat kanal/.test(text)) {
          programmeMetrics.peat.canals += 1;
        }
        if (layerId === "fdrs" || layerId === "sekat_kanal" || /sekat kanal/.test(text)) {
          programmeMetrics.peat.fireInfra += 1;
        }
        if (isNursery) programmeMetrics.peat.nurseries += 1;
        programmeMetrics.peat.rewetting += numericFrom(props,
          ["Luas_Rewetting_Ha", "Rewetting_Area_Ha", "Area_Rewetting"]);
      }

      if (isMineral) {
        programmeMetrics.mineral.area += area;
        programmeMetrics.mineral.seedlings += seedlings;
        if (/menara air|tower air|water tower/.test(text)) programmeMetrics.mineral.towers += 1;
        if (/plang restorasi|restoration sign/.test(text)) programmeMetrics.mineral.signs += 1;
        if (/plot ukur permanen|\bpup\b/.test(text)) programmeMetrics.mineral.plots += 1;
      }

      if (isCapacity && !capacitySummary.loaded) {
        programmeMetrics.capacity.trainings += 1;
        programmeMetrics.capacity.participants += participants;
        if (village) programmeMetrics.capacity.villages.add(village.toLowerCase());
        const group = firstValue(props, [
          "Kelompok", "Nama_Kelompok", "Community_Group", "organization"
        ]);
        if (group) programmeMetrics.capacity.groups.add(group.toLowerCase());
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
    const aramcoMappedTrees = sumProperties(aramcoMangrove,
      ["Jumlah_Bib", "Jumlah_Bibit", "Jumlah bibit", "jumlah_bibit", "Jumlah_Tanam", "Pohon"]);
    setMetric("aramco-tree-count", Math.max(42545, aramcoMappedTrees));
    setMetric("aramco-village-count",
      officialMetric(villageCount(aramcoProgrammeAssets), 4));
    const aramcoMappedArea = sumProperties(aramcoMangrove,
      ["Luas_Ha", "Luas", "luas_ha"]);
    // Laporan 13,1 ha menjadi nilai minimum. Atribut resmi polygon menjadi
    // sumber utama sehingga setiap revisi atau penambahan langsung tersinkron.
    setMetric("aramco-area-count", Math.max(13.1, aramcoMappedArea), 2, " ha");
    // Empat rumah bibit adalah baseline resmi; objek kelima dan seterusnya
    // yang masuk WebGIS akan menaikkan angka secara otomatis.
    setMetric("aramco-nursery-count", Math.max(4, aramcoNurseries.length));
    setMetric("aramco-wave-count", Math.max(300, sumProperties(aramcoWave,
      ["Panjang_m", "Panjang", "panjang_m", "Length_m"])), 0, " m");
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

    const isGec2026 = feature => {
      const props = (feature && feature.properties) || {};
      const donorName = donorOf(props);

      const programme = firstValue(props, [
        "Programme", "programme", "Program", "program",
        "Nama_Program", "Program_Name", "program_name"
      ]).toLowerCase();
      const reportType = firstValue(props, ["reportType", "Report_Type"]).toLowerCase();
      const village = firstValue(props, [
        "Desa", "WADMKD", "NAMA_DESA", "village", "locationName"
      ]).toLowerCase();
      const yearValue = firstValue(props, [
        "programme_year", "Programme_Year", "program_year",
        "Program_Year", "Tahun", "Year", "year"
      ]).toLowerCase();
      const text = normalizedText(props);

      const hasGecDonor = donorName === "Global Environment Centre" ||
        /global environment centre|\bgec\b/.test(text);
      const byProgrammeField = /gec\s*2026|sustainable peatland management|community livelihood strengthening/.test(programme);
      const byYearField = /(^|\D)2026(\D|$)/.test(yearValue);
      const byYearSignal = byYearField || /(^|\D)2026(\D|$)/.test(text);
      const byTextFallback = /2026/.test(text) && /gec|global environment centre/.test(text);
      const byCapacityVillageFallback =
        byYearSignal &&
        /capacity building|pelatihan|training/.test(reportType + " " + text) &&
        /pedekik|temiang|dayun/.test(village + " " + text) &&
        /kopi|coffee|nursery|gambut|peat|tmat|fdrs|sekat kanal|agroforestri/.test(text);

      return (hasGecDonor && (byProgrammeField || byYearField || byTextFallback)) ||
        byCapacityVillageFallback;
    };

    const gec2026Assets = uniqueFeatures(active.filter(isGec2026));
    const coffee2026Features = gec2026Assets.filter(feature => {
      const layerId = layerIdOf(feature).toLowerCase();
      const text = normalizedText((feature && feature.properties) || {});
      return layerId === "area_kopi" || /kopi|coffee|agroforestri|agroforestry/.test(text);
    });
    const coffeeArea2026 = sumProperties(coffee2026Features, [
      "Luas_Ha", "Luas", "luas_ha", "Area_Ha", "Restoration_Area_Ha"
    ]);
    const canal2026 = layerAssets(gec2026Assets, ["sekat_kanal"]).length;
    const fdrs2026 = layerAssets(gec2026Assets, ["fdrs"]).length;
    const nurseryVillages2026 = new Set(
      gec2026Assets.filter(feature => {
        const layerId = layerIdOf(feature).toLowerCase();
        const text = normalizedText((feature && feature.properties) || {});
        return layerId === "nursery_kopi" ||
          (text.includes("nursery") && (text.includes("pelatihan") || text.includes("training")));
      }).map(feature => firstValue((feature && feature.properties) || {}, [
        "Desa", "WADMKD", "NAMA_DESA", "village", "locationName"
      ]).toLowerCase()).filter(Boolean)
    );
    const nursery2026 = nurseryVillages2026.size;

    const training2026 = gec2026Assets.filter(feature => {
      const props = (feature && feature.properties) || {};
      const text = normalizedText(props);
      const reportType = firstValue(props, ["reportType", "Report_Type"]).toLowerCase();
      return /capacity building|pelatihan|training/.test(reportType + " " + text);
    }).sort((a, b) => {
      const aDate = firstValue((a && a.properties) || {}, ["activityDate", "publishedAt"]);
      const bDate = firstValue((b && b.properties) || {}, ["activityDate", "publishedAt"]);
      return String(bDate).localeCompare(String(aDate), "id");
    });

    setText("gec2026-progress-coffee", formatNumber(coffeeArea2026, 1) + " / 3.0 ha");
    setText("gec2026-progress-canal", formatNumber(canal2026) + " / 3");
    setText("gec2026-progress-fdrs", formatNumber(fdrs2026) + " / 3");
    setText("gec2026-progress-nursery", formatNumber(nursery2026) + " / 2 villages");

    const outreachSignals = gec2026Assets.filter(feature => {
      const text = normalizedText((feature && feature.properties) || {});
      return /video|campaign|outreach|komunikasi|website|publikasi|publication/.test(text);
    }).length;
    const auditSignals = gec2026Assets.filter(feature => {
      const text = normalizedText((feature && feature.properties) || {});
      return /audit/.test(text);
    }).length;

    const statusOf = (value, target) => {
      if (value >= target) return { text: "Completed", cls: "state-completed" };
      if (value > 0) return { text: "In Progress", cls: "state-in-progress" };
      return { text: "Planned", cls: "" };
    };
    const nurseryStatus = statusOf(nursery2026, 2);
    const coffeeStatus = statusOf(coffeeArea2026, 3);
    const canalStatus = statusOf(canal2026, 3);
    const fdrsStatus = statusOf(fdrs2026, 3);
    const outreachStatus = statusOf(outreachSignals, 1);
    const auditStatus = statusOf(auditSignals, 1);

    setStateBadge("gec2026-status-nursery", nurseryStatus.text, nurseryStatus.cls);
    setStateBadge("gec2026-status-coffee", coffeeStatus.text, coffeeStatus.cls);
    setStateBadge("gec2026-status-canal", canalStatus.text, canalStatus.cls);
    setStateBadge("gec2026-status-fdrs", fdrsStatus.text, fdrsStatus.cls);
    setStateBadge("gec2026-status-outreach", outreachStatus.text, outreachStatus.cls);
    setStateBadge("gec2026-status-audit", auditStatus.text, auditStatus.cls);

    if (training2026.length) {
      const latest = training2026[0].properties || {};
      const village = firstValue(latest, ["Desa", "WADMKD", "village"]);
      const date = firstValue(latest, ["activityDate", "publishedAt"]);
      const title = firstValue(latest, ["title", "Nama_Objek"]) || "Capacity Building";
      const description = compactSentence(firstValue(latest, ["description", "Keterangan", "Ket"]), 180);
      setText("gec2026-update-title", title);
      const metaParts = [];
      if (village) metaParts.push(village);
      if (date) metaParts.push(date);
      setText("gec2026-update-meta", (metaParts.join(" · ") + (description ? " · " + description : "")).trim());

      const nurseryPhotoNode = document.getElementById("gec2026-nursery-photo");
      const nurseryBriefNode = document.getElementById("gec2026-nursery-brief");
      const photos = toPhotoList(latest.photos || latest.Photos || latest.photo || latest.image);
      const photoUrl = photos.length ? toPreviewImage(photos[0]) : "";
      if (nurseryPhotoNode && photoUrl) {
        nurseryPhotoNode.src = photoUrl;
      }

      const participantMatch = String(latest.description || "").match(/(\d+)\s+peserta/i);
      const participantText = participantMatch ? participantMatch[1] + " peserta" : "Peserta terdata";
      const briefParts = [];
      if (village) briefParts.push(village);
      if (date) briefParts.push(date);
      briefParts.push(participantText);
      if (nurseryBriefNode) {
        nurseryBriefNode.textContent = "Pelatihan pembibitan kopi Liberika: " + briefParts.join(" · ");
      }
    }

    const estimatedPeatRewettingArea = calculateEstimatedPeatRewettingArea(programmeMetrics.peat.canals);
    const peatRewettingArea = programmeMetrics.peat.rewetting > 0
      ? programmeMetrics.peat.rewetting
      : estimatedPeatRewettingArea;
    programmeMetrics.peat.rewetting = peatRewettingArea;

    const revisedPeatForestSeedlings = 4300;
    programmeMetrics.peat.forest = programmeMetrics.peat.forest > 0
      ? programmeMetrics.peat.forest
      : revisedPeatForestSeedlings;

    const mineralArea = Math.max(11.44, programmeMetrics.mineral.area);
    const mineralSeedlings = Math.max(1200, programmeMetrics.mineral.seedlings);
    const totalRestorationArea = programmeMetrics.mangrove.area +
      programmeMetrics.peat.area + mineralArea;
    const totalPlantedSeedlings = programmeMetrics.mangrove.seedlings +
      programmeMetrics.peat.coffee + programmeMetrics.peat.forest +
      mineralSeedlings;

    window.YG_DASHBOARD_STATS = {
      totalRestorationArea: totalRestorationArea,
      totalPlantedSeedlings: totalPlantedSeedlings,
      rewettingArea: peatRewettingArea,
      participants: programmeMetrics.capacity.participants,
      regencies: regencies.size,
      villages: villages.size
    };

    setMetric("dash-restoration-area", totalRestorationArea, 2);
    setMetric("dash-seedlings-planted", totalPlantedSeedlings);
    setMetric("dash-rewetting-area", peatRewettingArea, 0);
    setMetric("dash-participants", programmeMetrics.capacity.participants);
    setMetric("dash-regencies", regencies.size);
    setMetric("dash-villages", villages.size);

    const displayMetric = (value, suffix = "", digits = 0) =>
      Number(value) > 0 ? formatNumber(value, digits) + suffix : "Data belum tersedia";
    const metricRows = rows => rows.map(row =>
      '<li><span>' + escapeHtml(row[0]) + '</span><strong>' +
      escapeHtml(displayMetric(row[1], row[2] || "", row[3] || 0)) +
      '</strong></li>'
    ).join("");
    const programmeCards = [
      {
        name: "Restorasi Mangrove",
        icon: "🌊",
        url: mapUrl({ layers: "area_mangrove,nursery_mangrove,apo" }),
        rows: [
          ["Luas Restorasi", programmeMetrics.mangrove.area, " ha", 2],
          ["Pohon Mangrove Ditanam", programmeMetrics.mangrove.seedlings],
          ["Rumah Bibit", Math.max(4, programmeMetrics.mangrove.nurseries.size)],
          ["Hybrid Engineering", Math.max(300, programmeMetrics.mangrove.wave), " m"],
          ["Desa Program", programmeMetrics.mangrove.villages.size]
        ]
      },
      {
        name: "Restorasi Gambut",
        icon: "🌿",
        url: mapUrl({ layers: "area_kopi,kopi,sekat_kanal,fdrs" }),
        rows: [
          ["Luas Gambut / Agroforestri", programmeMetrics.peat.area, " ha", 2],
          ["Bibit Kopi Ditanam", programmeMetrics.peat.coffee],
          ["Bibit Pohon Hutan & MPTS", programmeMetrics.peat.forest],
          ["Sekat Kanal", programmeMetrics.peat.canals],
          ["Estimasi Area Rewetting", peatRewettingArea, " ha", 2],
          ["Infrastruktur Pencegahan Kebakaran", programmeMetrics.peat.fireInfra],
          ["Rumah Bibit", programmeMetrics.peat.nurseries]
        ]
      },
      {
        name: "Restorasi Lahan Mineral",
        icon: "🌳",
        url: mapUrl({ layer: "community_reports", search: "Imbo Putui" }),
        rows: [
          ["Luas Restorasi", Math.max(11.44, programmeMetrics.mineral.area), " ha", 2],
          ["Bibit Ditanam", Math.max(1200, programmeMetrics.mineral.seedlings)],
          ["Menara Air", Math.max(1, programmeMetrics.mineral.towers)],
          ["Plang Restorasi", Math.max(1, programmeMetrics.mineral.signs)],
          ["Plot Ukur Permanen", Math.max(1, programmeMetrics.mineral.plots)]
        ]
      },
      {
        name: "Peningkatan Kapasitas",
        icon: "👥",
        url: mapUrl({ search: "Pelatihan" }),
        rows: [
          ["Pelatihan", programmeMetrics.capacity.trainings],
          ["Peserta", programmeMetrics.capacity.participants],
          ["Desa Terlibat", programmeMetrics.capacity.villages.size],
          ["Kelompok Masyarakat Didampingi", programmeMetrics.capacity.groups.size]
        ]
      }
    ];
    document.getElementById("category-grid").innerHTML = programmeCards.map(card =>
      '<a class="programme-card dashboard-link" href="' + escapeHtml(card.url) + '">' +
        '<header><i aria-hidden="true">' + card.icon + '</i><h3>' +
        escapeHtml(card.name) + '</h3><span aria-hidden="true">→</span></header>' +
        '<ul>' + metricRows(card.rows) + '</ul>' +
      '</a>'
    ).join("");

    const ppcfName = "Pan Pacific Conservation Foundation (PPCF)";
    const aramcoName = "Aramco Asia Singapore";
    const gecName = "Global Environment Centre";
    const kolibriName = "Aliansi Kolibri";
    const penabuluName = "Yayasan Penabulu";
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
    if (!donorEntries.some(([name]) => name === kolibriName)) {
      donorEntries.push([kolibriName, 0]);
    }
    if (!donorEntries.some(([name]) => name === penabuluName)) {
      donorEntries.push([penabuluName, 0]);
    }
    document.getElementById("donor-grid").innerHTML = donorEntries.length
      ? donorEntries.map(([name, count]) => {
          const programCount = Object.keys(donorPrograms[name] || {}).length;
          if (name === "Pan Pacific Conservation Foundation (PPCF)") {
            return '<button class="category-card dashboard-link funding-card" type="button" data-open-ppcf>' +
              '<i class="category-icon" aria-hidden="true">🤝</i>' + // PPCF
              '<span>' + escapeHtml(name) + '</span>' +
              '<strong>2025\u20132026</strong>' +
              '<small>Pematang Duku \u00b7 lihat ringkasan program</small>' +
            '</button>';
          }
          if (name === "Aramco Asia Singapore") {
            return '<button class="category-card dashboard-link funding-card" type="button" data-open-aramco>' +
              '<i class="category-icon" aria-hidden="true">🌿</i>' + // Aramco
              '<span>' + escapeHtml(name) + '</span>' +
              '<strong>2023–2026</strong>' +
              '<small>4 desa · lihat ringkasan program</small>' +
            '</button>';
          }
          if (name === "Global Environment Centre") {
            return '<button class="category-card dashboard-link funding-card" type="button" data-open-gec>' +
              '<i class="category-icon" aria-hidden="true">💧</i>' + // GEC
              '<span>' + escapeHtml(name) + '</span>' +
              '<strong>2021 - Sekarang</strong>' +
              '<small>Bengkalis &amp; Siak · lihat ringkasan program</small>' +
            '</button>';
          }
          if (name === "Aliansi Kolibri") {
            return '<button class="category-card dashboard-link funding-card" type="button" data-open-kolibri>' +
              '<i class="category-icon" aria-hidden="true">🐦</i>' + // Kolibri
              '<span>' + escapeHtml(name) + '</span>' +
              '<strong>2025\u20132026</strong>' +
              '<small>Imbo Putui \u00b7 lihat ringkasan program</small>' +
            '</button>';
          }
          if (name === "Yayasan Penabulu") {
            return '<button class="category-card dashboard-link funding-card funding-card-penabulu" type="button" data-open-penabulu>' +
              '<i class="category-icon" aria-hidden="true">🌍</i>' +
              '<span class="funding-penabulu-name">' + escapeHtml(name) + '</span>' +
              '<strong class="funding-penabulu-period">2025–2026</strong>' +
              '<small>Temiang Village \u00b7 lihat ringkasan program</small>' +
            '</button>';
          }
          const donorUrl = mapUrl({ search: donorSearchTerm(name) });
          return '<a class="category-card dashboard-link" href="' +
            escapeHtml(donorUrl) + '">' +
            '<span>' + escapeHtml(name) + '</span>' +
            '<strong>' + formatNumber(count) + ' objek terpetakan</strong>' +
            '<small>' + formatNumber(programCount) + ' program</small>' +
          '</a>';
        }).join("")
      : '<div class="dashboard-empty">Belum ada data</div>';

    hydratePenabuluPhotos(active);

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

  const ppcfDetails = {
    training: '<h4>Pelatihan PPCF</h4><div class="funding-detail-grid"><article><strong>69 peserta</strong><span>Pelatihan pengelolaan gambut berkelanjutan dan pertanian tanpa bakar · 7 Agustus 2025</span></article><article><strong>50 peserta</strong><span>Pelatihan agroforestri kopi Liberika, termasuk 13 perempuan · 19 Desember 2025</span></article></div>',
    market: '<h4>Kemitraan pasar kopi</h4><p>MoU antara Kelompok Tani Ketiau Jaya dan Suvarnabhumi Coffee ditandatangani pada 20 Januari 2026. Suvarnabhumi Coffee bertindak sebagai calon pembeli utama kopi Liberika sesuai mutu, harga, dan kapasitas pasokan yang disepakati.</p><a href="webgis.html?layer=kopi&amp;village=Pematang+Duku">Lihat lokasi kelompok tani →</a>'
  };
  const aramcoDetails = {
    nursery: '<h4>Rumah Bibit Mangrove</h4><p>Pilih desa untuk langsung menuju lokasi rumah bibit di peta.</p><div class="funding-location-grid"><a href="webgis.html?layer=nursery_mangrove&amp;village=Buruk+Bakul">Desa Buruk Bakul <span>→</span></a><a href="webgis.html?layer=nursery_mangrove&amp;village=Kelapa+Pati">Desa Kelapa Pati <span>→</span></a><a href="webgis.html?layer=nursery_mangrove&amp;village=Sepahat">Desa Sepahat <span>→</span></a><a href="webgis.html?layer=nursery_mangrove&amp;village=Tanjung+Kuras">Desa Tanjung Kuras <span>→</span></a></div>',
    wave: '<h4>Hybrid Engineering (Wave Breaker)</h4><p>Pilih segmen untuk melakukan zoom ke lokasi di peta.</p><div class="funding-location-grid"><a href="webgis.html?layer=apo&amp;village=Buruk+Bakul"><b>200 meter</b> – Desa Buruk Bakul <span>→</span></a><a href="webgis.html?layer=apo&amp;village=Tanjung+Kuras"><b>100 meter</b> – Desa Tanjung Kuras <span>→</span></a></div>'
  };
  const gecDetails = {
    fdrs: '<h4>Fire Danger Rating System (FDRS)</h4><p>Pilih lokasi untuk melihat titik FDRS yang tercantum dalam laporan program 2024.</p><div class="funding-location-grid"><a href="webgis.html?layer=fdrs&amp;village=Tanjung+Kuras">Tanjung Kuras <span>→</span></a><a href="webgis.html?layer=fdrs&amp;village=Simpang+Ayam">Simpang Ayam <span>→</span></a></div>',
    coffee: '<h4>Penanaman Kopi Liberika</h4><p>Pilih lokasi untuk melihat data lapangan penanaman kopi.</p><div class="funding-location-grid"><a href="webgis.html?layer=kopi&amp;village=Temiang"><b>1.700 bibit</b> – Temiang <span>→</span></a><a href="webgis.html?layer=kopi&amp;village=Tanjung+Kuras"><b>1.100 bibit</b> – Tanjung Kuras <span>→</span></a><a href="webgis.html?layer=kopi&amp;village=Buruk+Bakul"><b>600 bibit</b> – Buruk Bakul <span>→</span></a></div>',
    training: '<h4>Pelatihan Program GEC</h4><div class="funding-detail-grid"><article><strong>22 peserta</strong><span>Pelatihan pembibitan kopi Liberika · Temiang · 28 Oktober 2024</span></article><article><strong>50 peserta</strong><span>Pelatihan pemeliharaan dan panen kopi Liberika · Temiang · 29 Oktober 2025</span></article></div>'
  };

  const ppcfDashboard = document.getElementById("ppcf-dashboard");
  const ppcfDetail = document.getElementById("ppcf-detail");
  const aramcoDashboard = document.getElementById("aramco-dashboard");
  const aramcoDetail = document.getElementById("aramco-detail");
  const gecDashboard = document.getElementById("gec-dashboard");
  const gecDetail = document.getElementById("gec-detail");
  const kolibriDashboard = document.getElementById("kolibri-dashboard");
  const penabuluDashboard = document.getElementById("penabulu-dashboard");
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
    if (event.target.closest("[data-open-kolibri]")) {
      openFundingDashboard(kolibriDashboard);
    }
    if (event.target.closest("[data-open-penabulu]")) {
      openFundingDashboard(penabuluDashboard);
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
    if (event.target.closest("[data-close-kolibri]")) {
      closeFundingDashboard(kolibriDashboard);
    }
    if (event.target.closest("[data-close-penabulu]")) {
      closeFundingDashboard(penabuluDashboard);
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
    if (!kolibriDashboard.hidden) {
      closeFundingDashboard(kolibriDashboard);
    }
    if (!penabuluDashboard.hidden) {
      closeFundingDashboard(penabuluDashboard);
    }
  });
})();

function loadDynamicContent() {
  const API_URL = 'https://script.google.com/macros/s/AKfycbxUe4QyBvSiL9UJsL-nsJ5XrohDabwqhYYR9q5CTgLYiW1ZCfVy429iMlpU-lCDUSvvRg/exec';
  const callbackName = 'ygWebContentCallback_' + Date.now();

  window[callbackName] = function(data) {
    delete window[callbackName];
    if (!data || !Array.isArray(data)) return;

    const textMap = new Map(data.map(item => [item.key, item.content]));

    document.querySelectorAll('[data-editable-id]').forEach(element => {
      const key = element.getAttribute('data-editable-id');
      if (textMap.has(key)) {
        const content = textMap.get(key);
        if (content) element.innerHTML = content;
      }
    });
  };

  const script = document.createElement('script');
  script.src = `${API_URL}?page=web-content&callback=${callbackName}&t=${Date.now()}`;
  script.onerror = () => { delete window[callbackName]; };
  document.head.appendChild(script);
}

// Panggil fungsi ini saat halaman selesai dimuat
document.addEventListener('DOMContentLoaded', loadDynamicContent);
