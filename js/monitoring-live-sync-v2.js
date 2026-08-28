(() => {
  "use strict";

  if (window.__YG_MONITORING_LIVE_SYNC_V2__) return;
  window.__YG_MONITORING_LIVE_SYNC_V2__ = true;

  const API = "https://script.google.com/macros/s/AKfycbxUe4QyBvSiL9UJsL-nsJ5XrohDabwqhYYR9q5CTgLYiW1ZCfVy429iMlpU-lCDUSvvRg/exec?page=public-reports";
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
        targetArea || props.Luas_Terpantau_Ha || monitoring.monitoredAreaHa
    });

    return {
      type: "Feature",
      geometry: geometry,
      properties: normalizedProps
    };
  }

  function targetObjectId(props) {
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
    return candidates.find(value =>
      normalized(value).startsWith("mangrove-")
    ) || candidates[0] || "";
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

    const officialGeometryById = {};
    api.layerObjects.area_mangrove.eachLayer(layer => {
      const feature = layer && layer.feature;
      const props = feature && feature.properties || {};
      const objectId = String(props.Object_ID || "").trim();
      if (objectId && feature.geometry) {
        officialGeometryById[objectId] = feature.geometry;
      }
    });

    const features = (data && Array.isArray(data.features)
      ? data.features
      : [])
      .map(monitoringFeature)
      .filter(Boolean);

    features.forEach(feature => {
      const props = feature.properties || {};
      const objectId = targetObjectId(props);
      if (officialGeometryById[objectId]) {
        feature.geometry = officialGeometryById[objectId];
        props.Geometry_Source = "target_object_attribute";
      }
    });

    api.addLiveFeatures("monitoring_reports", features);
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
