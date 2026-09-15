(() => {
  "use strict";

  if (window.__YG_MONITORING_LIVE_SYNC_V2__) return;
  window.__YG_MONITORING_LIVE_SYNC_V2__ = true;

  const API = "https://script.google.com/macros/s/AKfycbxUe4QyBvSiL9UJsL-nsJ5XrohDabwqhYYR9q5CTgLYiW1ZCfVy429iMlpU-lCDUSvvRg/exec?page=public-reports";
  const VERIFIED_TARGETS = Object.freeze({
    "YG-20260713-202057-344": "MANGROVE-BURUK-BAKUL-PHASE-II-001",
    "YG-20260713-230541-911": "MANGROVE-SEPAHAT-2025-001",
    "YG-20260717-205241-378": "MANGROVE-KELAPA-PATI-PHASE-III-001",
    "YG-20260717-210140-375": "MANGROVE-BURUK-BAKUL-2025-001",
    "YG-20260717-211305-543": "MANGROVE-BURUK-BAKUL-2025-002",
    "YG-20260721-012602-224": "MANGROVE-SEPAHAT-2025-001"
  });
  const TARGET_ALIASES = Object.freeze({
    "mangrove-kelapa-pati-phase-iii-2026-001":
      "MANGROVE-KELAPA-PATI-PHASE-III-001",
    "mangrove-buruk-bakul-phase-ii-2024-001":
      "MANGROVE-BURUK-BAKUL-PHASE-II-001",
    "mangrove-buruk-bakul-phase-iii-2025-001":
      "MANGROVE-BURUK-BAKUL-2025-001",
    "mangrove-buruk-bakul-phase-iii-2025-002":
      "MANGROVE-BURUK-BAKUL-2025-002",
    "mangrove-buruk-bakul-phase-iii-2025-003":
      "MANGROVE-BURUK-BAKUL-2025-003",
    "mangrove-sepahat-phase-iii-2025-001":
      "MANGROVE-SEPAHAT-2025-001",
    "mangrove-tanjung-kuras-phase-iii-2026-001":
      "MANGROVE-TANJUNG-KURAS-2026-001"
  });
  const HIDDEN_GEOMETRY_REPORT_IDS = new Set([
    "YG-20260717-205241-378"
  ]);
  let activeRequest = null;

  function normalized(value) {
    return String(value == null ? "" : value).trim().toLowerCase();
  }

  function parsed(value) {
    if (!value) return null;
    if (typeof value === "object") return value;
    try {
      return JSON.parse(value);
    } catch (_error) {
      return null;
    }
  }

  function geometryOf(feature) {
    if (feature && feature.geometry) return feature.geometry;
    const props = feature && feature.properties || {};
    return parsed(
      props.geometry || props.Geometry || props.geometryGeoJSON ||
      props.Geometry_GeoJSON || props["Geometry GeoJSON"]
    );
  }

  function reportType(props) {
    return normalized(
      props.reportType || props.type || props.Jenis_Laporan ||
      props.jenisLaporan || props["Jenis Laporan"]
    );
  }

  function monitoringFeature(feature) {
    const props = feature && feature.properties || {};
    if (!reportType(props).includes("monitor")) return null;
    const geometry = geometryOf(feature);
    if (!geometry) return null;

    const changes = parsed(
      props.proposedChanges || props["Proposed Changes JSON"]
    ) || {};
    const monitoring = changes.monitoring ||
      parsed(props.proposedInformation) || {};
    const target = parsed(props.targetFeatureProperties) || {};
    const targetArea =
      target.Luas_Ha || target.Luas || target.areaHa || target.luas_ha;
    const targetLayerId = normalized(
      target.Layer_ID || target.Source_Layer
    );
    const inheritedDonor =
      target.Donor || target.Nama_Donor || target.Donor_Cluster ||
      props.Donor || props.Nama_Donor || props.Donor_Cluster ||
      (targetLayerId === "area_mangrove" ? "Aramco Asia Singapore" : "");
    const normalizedProps = Object.assign({}, props, {
      Layer_ID: "monitoring_reports",
      Layer_Label: "Hasil Monitoring Terverifikasi",
      Source_Type: "monitoring_report",
      Source_Report_ID: props.reportId,
      Object_ID: props.Object_ID || "MONITORING-" + props.reportId,
      Nama_Objek:
        props.Nama_Objek || props.targetObjectName || props.locationName ||
        props.title,
      Desa: props.Desa || props.village,
      Kondisi: props.Kondisi || monitoring.condition,
      Survival: props.Survival || monitoring.survivalPercent,
      Jumlah_Hidup: props.Jumlah_Hidup || monitoring.aliveCount,
      Jumlah_Mati_Rusak:
        props.Jumlah_Mati_Rusak || monitoring.deadOrDamagedCount,
      Luas_Terpantau_Ha:
        targetArea || props.Luas_Terpantau_Ha || monitoring.monitoredAreaHa,
      Donor: inheritedDonor,
      Donor_Cluster: inheritedDonor,
      Nama_Donor: inheritedDonor
    });

    return {
      type: "Feature",
      geometry: geometry,
      properties: normalizedProps
    };
  }

  function targetObjectId(props) {
    const reportId = String(
      props.reportId || props.Source_Report_ID || props.Monitoring_ID || ""
    ).trim();
    if (VERIFIED_TARGETS[reportId]) return VERIFIED_TARGETS[reportId];
    const target = parsed(props.targetFeatureProperties) || {};
    const candidates = [
      props.Target_Object_ID_Current,
      target.Object_ID,
      target.objectId,
      props.targetObjectId,
      props.Target_Object_ID
    ].map(value => String(value || "").trim()).filter(Boolean);

    /*
     * targetObjectId/Target_Object_ID pada laporan lama dapat berisi ID
     * geometry sementara (area_mangrove:auto:*). Ketika snapshot target sudah
     * membawa Object_ID permanen, selalu pakai ID itu agar monitoring tetap
     * menempel ke polygon resmi setelah data spasial diperbarui.
     */
    const selected = candidates.find(value =>
      normalized(value).startsWith("mangrove-")
    ) || candidates[0] || "";
    return TARGET_ALIASES[normalized(selected)] || selected;
  }

  function canonicalObjectId(value) {
    const id = normalized(value);
    // Plot laporan 19 Agustus 2026 adalah lokasi tersendiri, bukan Plot 1 2026.
    if (id === "mangrove-kelapa-pati-phase-iii-2025-001") return id;
    return id.replace(/-\d{4}-(\d{3})$/, "-$1");
  }

  function areaObjectIndex(api) {
    const index = new Map();
    const group = api.layerObjects && api.layerObjects.area_mangrove;
    if (!group || typeof group.eachLayer !== "function") return index;
    group.eachLayer(layer => {
      const feature = layer && layer.feature;
      const props = feature && feature.properties || {};
      const objectId = String(props.Object_ID || "").trim();
      if (!objectId || !feature.geometry) return;
      index.set(normalized(objectId), feature);
      index.set(canonicalObjectId(objectId), feature);
    });
    return index;
  }

  function reportTimestamp(props) {
    const raw = String(
      props.activityDate || props.Tanggal || props.publishedAt ||
      props.receivedAt || ""
    ).trim();
    const dayFirst = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    return dayFirst
      ? Date.UTC(Number(dayFirst[3]), Number(dayFirst[2]) - 1, Number(dayFirst[1]))
      : (Date.parse(raw) || 0);
  }

  function latestPerObject(features) {
    const latest = new Map();
    features.forEach(feature => {
      const props = feature.properties || {};
      const targetId = targetObjectId(props);
      const key = targetId
        ? canonicalObjectId(targetId)
        : "report:" + String(props.reportId || props.Source_Report_ID || "");
      const timestamp = reportTimestamp(props);
      const current = latest.get(key);
      if (!current || timestamp >= current.timestamp) {
        latest.set(key, { feature, timestamp });
      }
    });
    return Array.from(latest.values()).map(item => item.feature);
  }

  function apply(data) {
    const api = window.YG_MAP;
    if (
      !api ||
      typeof api.addLiveFeatures !== "function" ||
      !api.layerObjects ||
      !api.layerObjects.monitoring_reports ||
      !api.layerObjects.area_mangrove
    ) {
      return false;
    }

    const areaObjects = areaObjectIndex(api);
    const features = (data && Array.isArray(data.features)
      ? data.features
      : [])
      .map(monitoringFeature)
      .filter(Boolean)
      .filter(feature => {
        const props = feature.properties || {};
        const reportId = String(
          props.reportId || props.Source_Report_ID || props.Monitoring_ID || ""
        ).trim();
        return !HIDDEN_GEOMETRY_REPORT_IDS.has(reportId);
      })
      .map(feature => {
        const props = feature.properties || {};
        const targetId = targetObjectId(props);
        if (!normalized(targetId).startsWith("mangrove-")) return feature;
        const target = areaObjects.get(normalized(targetId)) ||
          areaObjects.get(canonicalObjectId(targetId));
        if (!target || !target.geometry) {
          /*
           * Registry polygon dan laporan live dimuat secara paralel. Jangan
           * membuang laporan terbaru bila polygon resminya belum tersedia
           * pada saat respons API tiba; geometry laporan tetap merupakan
           * fallback yang sah dan identitas targetnya tetap dipertahankan.
           */
          props.Target_Object_ID_Current = targetId;
          props.Target_Layer_ID_Current = "area_mangrove";
          props.Geometry_Source = "monitoring_report_fallback";
          return feature;
        }
        const targetProps = target.properties || {};
        const donor = targetProps.Donor || targetProps.Nama_Donor ||
          targetProps.Donor_Cluster || "";
        feature.geometry = JSON.parse(JSON.stringify(target.geometry));
        props.Target_Object_ID_Current = targetProps.Object_ID || targetId;
        props.Target_Layer_ID_Current = "area_mangrove";
        props.Geometry_Source = "permanent_monitoring_registry";
        if (donor) {
          props.Donor = donor;
          props.Donor_Cluster = donor;
          props.Nama_Donor = donor;
        }
        return feature;
      })
      .filter(Boolean);

    api.addLiveFeatures("monitoring_reports", latestPerObject(features));
    document.dispatchEvent(new CustomEvent("yg:monitoring-live-synced"));
    return true;
  }

  async function load() {
    if (activeRequest) return activeRequest;
    activeRequest = (async () => {
      const controller = new AbortController();
      // Apps Script kadang memerlukan lebih dari 15 detik saat cold start.
      // Fallback tetap tampil segera, tetapi respons 25 laporan tidak boleh
      // dibatalkan sebelum sinkronisasi lengkap selesai.
      const timeout = window.setTimeout(() => controller.abort(), 45000);
      try {
        const response = await fetch(API + "&t=" + Date.now(), {
          cache: "no-store",
          signal: controller.signal
        });
        if (!response.ok) throw new Error("HTTP " + response.status);
        const data = await response.json();
        for (let attempt = 0; attempt < 100; attempt += 1) {
          if (apply(data)) return;
          await new Promise(resolve => window.setTimeout(resolve, 250));
        }
        throw new Error("Layer peta belum siap menerima monitoring live.");
      } catch (error) {
        console.warn("Sinkronisasi monitoring live belum berhasil", error);
      } finally {
        window.clearTimeout(timeout);
        activeRequest = null;
      }
    })();
    return activeRequest;
  }

  load();
  window.addEventListener("online", load);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) load();
  });
})();
