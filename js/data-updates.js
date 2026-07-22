(() => {
  "use strict";

  const API = "https://script.google.com/macros/s/AKfycbxUe4QyBvSiL9UJsL-nsJ5XrohDabwqhYYR9q5CTgLYiW1ZCfVy429iMlpU-lCDUSvvRg/exec?page=public-updates";
  const CALLBACK = "ygPublishedUpdatesCallback";
  const appliedUpdates = new Set();

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, char => ({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
    })[char]);
  }

  function normalize(value) {
    return String(value == null ? "" : value).trim().toLowerCase();
  }

  function valuesMatch(actual, expected) {
    if (actual == null || expected == null) return false;
    return normalize(actual) === normalize(expected);
  }

  function parseObject(value) {
    if (value && typeof value === "object") return value;
    if (typeof value !== "string" || !value.trim()) return {};
    try { return JSON.parse(value); } catch (error) { return {}; }
  }

  function objectId(properties) {
    const props = properties || {};
    const target = parseObject(props.targetFeatureProperties);
    const changes = parseObject(props.proposedChanges);
    const values = [
      target.Object_ID, target.Target_Object_ID_Current,
      target.Target_Object_ID, target.objectId, target.OBJECTID,
      props.Object_ID, props.Target_Object_ID_Current,
      props.Target_Object_ID, props.objectId, props.OBJECTID,
      changes.Object_ID, changes.Target_Object_ID_Current,
      changes.Target_Object_ID, changes.objectId, changes.OBJECTID,
      changes.targetObjectId, props.targetObjectId
    ];
    const value = values.find(item =>
      item !== null && item !== undefined && String(item).trim()
    );
    return normalize(value || "");
  }

  function isLegacyAutoId(value) {
    return /:auto:/i.test(String(value || ""));
  }

  function numeric(value) {
    const number = Number(String(value == null ? "" : value).replace(",", "."));
    return Number.isFinite(number) ? number : NaN;
  }

  function yearValue(value) {
    const match = String(value == null ? "" : value).match(/\b(20\d{2})\b/);
    return match ? match[1] : "";
  }

  function phaseValue(properties) {
    const props = properties || {};
    const value = props.Fase || props.Ket || props.Keterangan || props.Tahun || "";
    const match = String(value).match(/phase\s*(i{1,3}|iv|v|\d+)/i);
    return match ? normalize(match[0]).replace(/\s+/g, " ") : "";
  }

  function ringContainsPoint(ring, point) {
    if (!Array.isArray(ring) || ring.length < 3 || !point) return false;
    let inside = false;
    for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
      const currentPoint = ring[index];
      const previousPoint = ring[previous];
      if (!Array.isArray(currentPoint) || !Array.isArray(previousPoint)) continue;
      const intersects =
        (currentPoint[1] > point[1]) !== (previousPoint[1] > point[1]) &&
        point[0] <
          ((previousPoint[0] - currentPoint[0]) *
            (point[1] - currentPoint[1])) /
            (previousPoint[1] - currentPoint[1]) +
            currentPoint[0];
      if (intersects) inside = !inside;
    }
    return inside;
  }

  function geometryCenter(geometry) {
    if (!geometry || !Array.isArray(geometry.coordinates)) return null;
    let ring = null;
    if (geometry.type === "Polygon") ring = geometry.coordinates[0];
    if (geometry.type === "MultiPolygon") ring = geometry.coordinates[0] && geometry.coordinates[0][0];
    if (!Array.isArray(ring) || !ring.length) return null;
    const valid = ring.filter(point =>
      Array.isArray(point) && Number.isFinite(Number(point[0])) && Number.isFinite(Number(point[1]))
    );
    if (!valid.length) return null;
    return [
      valid.reduce((sum, point) => sum + Number(point[0]), 0) / valid.length,
      valid.reduce((sum, point) => sum + Number(point[1]), 0) / valid.length
    ];
  }

  function geometryContainsPoint(geometry, point) {
    if (!geometry || !point || !Array.isArray(geometry.coordinates)) return false;
    if (geometry.type === "Polygon") {
      return ringContainsPoint(geometry.coordinates[0], point);
    }
    if (geometry.type === "MultiPolygon") {
      return geometry.coordinates.some(polygon =>
        Array.isArray(polygon) && ringContainsPoint(polygon[0], point)
      );
    }
    return false;
  }

  function legacyPhotoMatches(feature, update, target) {
    const props = feature.properties || {};
    if (normalize(update.reportType) !== "tambah foto kegiatan") return false;

    const actualLayer = targetLayer(props);
    const expectedLayer = targetLayer(update);
    if (!actualLayer || actualLayer !== expectedLayer) return false;

    const actualVillage = normalize(props.Desa || props.desa || props.WADMKD);
    const expectedVillage = normalize(
      target.Desa || target.desa || update.locationName || update.targetObjectName
    );
    if (!actualVillage || !expectedVillage || actualVillage !== expectedVillage) {
      return false;
    }

    /*
     * Laporan lama memakai ID :auto: yang berubah ketika polygon direvisi.
     * Jika pusat geometry laporan lama berada tepat di dalam satu polygon
     * resmi yang baru, foto boleh diwariskan ke polygon tersebut. Cara ini
     * memulihkan foto lama tanpa menggabungkan seluruh foto satu desa.
     */
    const legacyCenter = geometryCenter(update.geometry);
    if (legacyCenter && geometryContainsPoint(feature.geometry, legacyCenter)) {
      return true;
    }

    const expectedYear = yearValue(target.Tahun);
    const actualYear = yearValue(props.Tahun);
    if (expectedYear && actualYear !== expectedYear) return false;

    const expectedPhase = phaseValue(target);
    const actualPhase = phaseValue(props);
    if (expectedPhase && actualPhase !== expectedPhase) return false;

    const expectedArea = numeric(
      target.Luas_Ha || target.Luas || target.Luas_Lahan_Ha
    );
    const actualArea = numeric(props.Luas_Ha || props.Luas || props.Luas_Lahan_Ha);
    if (!Number.isFinite(expectedArea) || !Number.isFinite(actualArea)) {
      return false;
    }

    const tolerance = Math.max(0.05, expectedArea * 0.1);
    return Math.abs(actualArea - expectedArea) <= tolerance;
  }

  function featureMatches(feature, update) {
    const props = feature.properties || {};
    const target = parseObject(update.targetFeatureProperties);

    // Unggahan baru membawa Object_ID permanen di targetFeatureProperties.
    // Jika ID tersedia, jangan pernah jatuh kembali ke nama/No/desa karena
    // beberapa polygon dapat memiliki atribut lama yang sama.
    const expectedObjectId = objectId(update);
    if (expectedObjectId) {
      const actualObjectId = objectId(props);
      if (actualObjectId && actualObjectId === expectedObjectId) return true;
      if (!isLegacyAutoId(expectedObjectId)) return false;
      return legacyPhotoMatches(feature, update, target);
    }

    const preferredKeys = [
      "No","OBJECTID","Id","ID","NAMOBJ","NAMA_DESA",
      "Desa","desa","Tahun","Nama","NAMA"
    ];

    const available = preferredKeys.filter(key =>
      Object.prototype.hasOwnProperty.call(target,key) &&
      Object.prototype.hasOwnProperty.call(props,key)
    );

    if (available.length) {
      return available.every(key => valuesMatch(props[key],target[key]));
    }

    const keys = Object.keys(target).filter(key =>
      Object.prototype.hasOwnProperty.call(props,key) &&
      typeof target[key] !== "object" &&
      target[key] !== null
    ).slice(0,4);

    return keys.length > 0 &&
      keys.every(key => valuesMatch(props[key],target[key]));
  }

function toDirectDriveUrl(url){
    const id = String(url).match(/\/d\/([^/]+)/);

    if(id){
        return "https://lh3.googleusercontent.com/d/" + id[1];
    }

    return url;
}

  function objectName(properties) {
    const props = properties || {};
    return normalize(
      props.targetObjectName ||
      props.locationName ||
      props.Nama_Objek ||
      props.Nama ||
      props.Lokasi ||
      props.title ||
      ""
    );
  }

  function targetLayer(properties) {
    const props = properties || {};
    return normalize(
      props.targetLayerId ||
      props.Layer_ID ||
      props.Source_Layer ||
      props.layerId ||
      ""
    );
  }

  function uniquePhotos(values) {
    const seen = new Set();
    return (values || []).filter(url => {
      const text = String(url || "").trim();
      const driveMatch = text.match(
        /\/file\/d\/([A-Za-z0-9_-]+)|[?&]id=([A-Za-z0-9_-]+)/
      );
      const key = driveMatch
        ? "drive:" + (driveMatch[1] || driveMatch[2])
        : text.split(/[?#]/)[0].replace(/\/+$/, "").toLowerCase();
      if (!text || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function isAdministrativePhotoNote(note) {
    const text = normalize(note).replace(/[^a-z0-9]+/g, " ").trim();
    return [
      "tambah foto",
      "tambahkan foto",
      "penambahan foto",
      "update foto",
      "update photo"
    ].includes(text);
  }

  function monitoringGallery(photos) {
    if (!photos.length) return "";
    return (
      '<div class="yg-v3-gallery yg-monitoring-update-gallery">' +
        photos.map((url,index) =>
          '<a class="yg-photo-card" href="' + escapeHtml(url) +
          '" target="_blank" rel="noopener noreferrer">' +
            '<img src="' + escapeHtml(toDirectDriveUrl(url)) +
            '" alt="Foto monitoring ' + (index + 1) +
            '" loading="lazy">' +
          '</a>'
        ).join("") +
      '</div>'
    );
  }

  function syncMonitoringPhotos(update) {
    if (
      normalize(update.reportType) !== "tambah foto kegiatan" ||
      !Array.isArray(update.photos) ||
      !update.photos.length
    ) {
      return;
    }

    const mapApi = window.YG_MAP;
    const monitoringGroup = mapApi && mapApi.layerObjects
      ? mapApi.layerObjects.monitoring_reports
      : null;
    if (!monitoringGroup || typeof monitoringGroup.eachLayer !== "function") {
      return;
    }

    const updateId = objectId(update);
    const updateLayer = targetLayer(update);
    const updateName = objectName(update);
    if (!updateId && (!updateLayer || !updateName)) return;

    monitoringGroup.eachLayer(layer => {
      const props = layer && layer.feature && layer.feature.properties || {};
      const matches = updateId
        ? objectId(props) === updateId
        : targetLayer(props) === updateLayer && objectName(props) === updateName;
      if (!matches) {
        return;
      }

      props._ygPhotos = uniquePhotos(
        (Array.isArray(props._ygPhotos) ? props._ygPhotos : [])
          .concat(update.photos)
      );

      if (!layer.getPopup || !layer.getPopup()) return;
      const popup = layer.getPopup();
      let content = String(popup.getContent() || "");
      const gallery = monitoringGallery(props._ygPhotos);

      content = content.replace(
        /<div class="yg-v3-gallery yg-monitoring-update-gallery">[\s\S]*?<\/div>/,
        ""
      );
      content = content.replace(
        /(<\/div>\s*<\/div>\s*)$/,
        gallery + "$1"
      );
      popup.setContent(content);
    });
  }

  function buildUpdatedPopup(feature, layerLabel) {
    const props = feature.properties || {};
    const photos = Array.isArray(props._ygPhotos) ? props._ygPhotos : [];
    const notes = Array.isArray(props._ygUpdateNotes) ? props._ygUpdateNotes : [];

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

    function row(label, value) {
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

    let rows = "";

    rows += row("No", valueOf(["No", "NO", "Id", "ID"]));
    rows += row("Object ID", valueOf([
      "Object_ID", "Target_Object_ID_Current", "Target_Object_ID",
      "objectId", "OBJECTID"
    ]));
    rows += row("Kabupaten", valueOf(["Kabupaten", "WADMKK"]));
    rows += row("Kecamatan", valueOf(["Kecamatan", "WADMKC"]));
    rows += row("Desa", valueOf(["Desa", "WADMKD"]));
    rows += row("Tahun", valueOf(["Tahun"]));
    rows += row("Fase/keterangan", valueOf(["Fase", "Ket", "Keterangan"]));
    rows += row("Luas", (() => {
      const value = valueOf(["Luas_Ha", "Luas", "Luas_Lahan_Ha"]);
      return value === "" ? "" : value + " ha";
    })());
    rows += row("Jumlah bibit", valueOf([
      "Jumlah_Tanam", "Jumlah_Bib", "Jumlah_Bibit", "Bibit_Ditanam"
    ]));
    rows += row("Panjang", (() => {
      const value = valueOf(["Panjang_M", "Panjang", "Panjang_m"]);
      return value === "" ? "" : value + " m";
    })());
    rows += row(
      "Nama objek",
      valueOf(["Nama_Objek", "Nama", "Lokasi", "NAMOBJ"])
    );
    rows += row(
      "Kategori",
      valueOf(["Kategori", "Layer_Label", "layerLabel"]) || layerLabel
    );

    const donorAliases = {
      "GEC": "Global Environment Centre",
      "PPCF": "Pan Pacific Conservation Foundation",
      "ARAMCO": "Aramco Asia Singapore"
    };
    let donorValue = valueOf([
      "Donor", "Donor_Cluster", "Nama_Donor", "Funding_Source",
      "donor", "nama_donor", "funding_source"
    ]);
    if (!donorValue) {
      let nested = props.targetFeatureProperties ||
        props.proposedChanges || {};
      if (typeof nested === "string") {
        try {
          nested = JSON.parse(nested);
        } catch (error) {
          nested = {};
        }
      }
      donorValue = [
        "Donor", "Donor_Cluster", "Nama_Donor", "Funding_Source",
        "donor", "nama_donor", "funding_source"
      ].map(key => nested && nested[key])
        .find(value => value !== null && value !== undefined && String(value).trim()) || "";
    }
    const donorCode = String(valueOf(["Ket"]) || "").trim().toUpperCase();
    const donor = donorValue || donorAliases[donorCode] || "";
    rows += row("Donor", donor);

    let gallery = "";
    if (photos.length) {
      gallery =
        '<div class="yg-update-gallery">' +
        photos.map((url, index) =>
          '<a href="' + escapeHtml(url) +
          '" target="_blank" rel="noopener noreferrer">' +
          '<img src="' + escapeHtml(toDirectDriveUrl(url)) +
          '" alt="Foto ' + (index + 1) +
          '" loading="lazy"></a>'
        ).join("") +
        '</div>';
    }

    let updateNotes = "";
    if (notes.length) {
      updateNotes =
        '<div class="yg-update-notes"><b>Pembaruan terverifikasi</b>' +
        notes.map(note =>
          '<p>' + escapeHtml(note) + '</p>'
        ).join("") +
        '</div>';
    }

    return (
      '<div class="popup-card yg-compact-updated-popup">' +
        '<div class="popup-head yg-updated-popup-head">' +
          '<strong>' + escapeHtml(
            valueOf(["Nama_Objek", "Nama", "Lokasi", "NAMOBJ"]) || layerLabel
          ) + '</strong>' +
          '<span>' + escapeHtml(layerLabel) + '</span>' +
        '</div>' +
        '<div class="popup-body yg-updated-popup-body">' +
          rows +
          gallery +
          updateNotes +
        '</div>' +
      '</div>'
    );
  }

  function updatePhotoGalleryOnly(layer, photos) {
    if (!layer || !layer.getPopup || !layer.getPopup()) return;

    const popup = layer.getPopup();
    let content = String(popup.getContent() || "");
    const gallery = photos.length
      ? '<div class="yg-update-gallery">' +
        photos.map((url, index) =>
          '<a href="' + escapeHtml(url) +
          '" target="_blank" rel="noopener noreferrer">' +
          '<img src="' + escapeHtml(toDirectDriveUrl(url)) +
          '" alt="Foto ' + (index + 1) +
          '" loading="lazy"></a>'
        ).join("") +
        '</div>'
      : "";

    /*
     * Tambah Foto Kegiatan hanya memperbarui galeri. Seluruh HTML atribut
     * yang sudah dibentuk dari objek master dipertahankan apa adanya agar
     * No, Object ID, wilayah, tahun, fase, luas, jumlah bibit, nama objek,
     * kategori, dan donor tidak pernah diganti oleh snapshot laporan foto.
     */
    content = content.replace(
      /<div class="yg-update-gallery">[\s\S]*?<\/div>/,
      ""
    );
    content = content.replace(
      /(<\/div>\s*<\/div>\s*)$/,
      gallery + "$1"
    );
    popup.setContent(content);
  }

  function applyUpdate(update) {
    syncMonitoringPhotos(update);

    const mapApi = window.YG_MAP;
    const parent = mapApi && mapApi.layerObjects
      ? mapApi.layerObjects[update.targetLayerId]
      : null;

    if (!parent || typeof parent.eachLayer !== "function") return false;

    let matched = false;

    parent.eachLayer(layer => {
      if (matched || !layer.feature) return;
      if (!featureMatches(layer.feature,update)) return;

      matched = true;
      const props = layer.feature.properties || {};

      if (update.reportType === "Perbaikan Informasi") {
        Object.entries(update.proposedChanges || {}).forEach(([key,value]) => {
          props[key] = value;
        });
      }

      props._ygPhotos = Array.isArray(props._ygPhotos)
        ? props._ygPhotos
        : [];

      (update.photos || []).forEach(url => {
        if (props._ygPhotos.indexOf(url) === -1) {
          props._ygPhotos.push(url);
        }
      });

      props._ygUpdateNotes = Array.isArray(props._ygUpdateNotes)
        ? props._ygUpdateNotes
        : [];

      // Tambah Foto hanya memperkaya galeri. Deskripsi/catatan laporan foto
      // tidak boleh menggantikan atau mengubah informasi objek utama.
      if (
        normalize(update.reportType) !== "tambah foto kegiatan" &&
        update.note &&
        !isAdministrativePhotoNote(update.note) &&
        props._ygUpdateNotes.indexOf(update.note) === -1
      ) {
        props._ygUpdateNotes.push(update.note);
      }

      if (normalize(update.reportType) === "tambah foto kegiatan") {
        updatePhotoGalleryOnly(layer, uniquePhotos(props._ygPhotos));
      } else {
        layer.bindPopup(
          buildUpdatedPopup(
            layer.feature,
            update.targetLayerLabel || update.targetLayerId
          ),
          {maxWidth:360}
        );
      }

      if (update.reportId) appliedUpdates.add(update.reportId);
    });

    return matched;
  }

  function applyAll(data, attempt = 0) {
    if (!window.YG_MAP || !window.YG_MAP.layerObjects) {
      setTimeout(() => applyAll(data,attempt+1),300);
      return;
    }

    let remaining = 0;

    (data.updates || []).forEach(update => {
      if (update.reportId && appliedUpdates.has(update.reportId)) return;
      if (!applyUpdate(update)) remaining++;
    });

    if (remaining && attempt < 20) {
      setTimeout(() => applyAll(data,attempt+1),400);
    }

    const status = document.getElementById("status-text");
    if (status && appliedUpdates.size) {
      status.textContent =
        "Layer berhasil dimuat • " + appliedUpdates.size +
        " pembaruan publik diterapkan";
    }
  }

  window[CALLBACK] = data => applyAll(data);

  const style = document.createElement("style");
  style.textContent = `
    .yg-updated-popup-head{background:#7b1fa2!important}
    .yg-compact-updated-popup{
      max-height:min(74vh,640px);
      overflow:hidden
    }
    .yg-updated-popup-body{
      max-height:min(58vh,500px);
      overflow-y:auto;
      overscroll-behavior:contain;
      scrollbar-width:thin
    }
    .yg-updated-popup-body::-webkit-scrollbar{width:7px}
    .yg-updated-popup-body::-webkit-scrollbar-thumb{
      background:#b7c7c0;border-radius:999px
    }
    .yg-update-gallery{
      display:grid;
      grid-template-columns:repeat(2,minmax(0,1fr));
      gap:7px;
      padding:10px
    }
    .yg-update-gallery a{
      display:block;
      overflow:hidden;
      border-radius:8px;
      background:#eef4f1
    }
    .yg-update-gallery img{
      width:100%;
      height:110px;
      object-fit:cover;
      border-radius:8px;
      display:block
    }
    .yg-update-notes{
      margin:8px 10px 10px;
      padding:9px;
      border-left:3px solid #7b1fa2;
      background:#f6effa;
      font-size:10px
    }
    .yg-update-notes p{margin:5px 0 0}
    @media(max-width:680px){
      .yg-compact-updated-popup{max-height:72vh}
      .yg-updated-popup-body{max-height:55vh}
    }
  `;
  document.head.appendChild(style);

  const script = document.createElement("script");
  script.src = API + "&callback=" + CALLBACK + "&t=" + Date.now();
  script.async = true;
  document.head.appendChild(script);
})();

