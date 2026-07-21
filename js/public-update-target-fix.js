(() => {
  "use strict";

  const API = "https://script.google.com/macros/s/AKfycbxUe4QyBvSiL9UJsL-nsJ5XrohDabwqhYYR9q5CTgLYiW1ZCfVy429iMlpU-lCDUSvvRg/exec?page=public-updates";
  const CALLBACK = "ygLegacyObjectPhotos_" + Date.now();

  function normalize(value) {
    return String(value == null ? "" : value).trim().toLowerCase();
  }

  function parseObject(value) {
    if (value && typeof value === "object") return value;
    if (typeof value !== "string" || !value.trim()) return {};
    try { return JSON.parse(value); } catch (error) { return {}; }
  }

  function firstValue(values) {
    return values.find(value =>
      value !== null && value !== undefined && String(value).trim() !== ""
    );
  }

  function driveId(url) {
    const text = String(url || "").trim();
    const match = text.match(
      /\/file\/d\/([A-Za-z0-9_-]+)|\/d\/([A-Za-z0-9_-]+)|[?&]id=([A-Za-z0-9_-]+)/i
    );
    return match ? (match[1] || match[2] || match[3]) : "";
  }

  function thumbUrl(url) {
    const id = driveId(url);
    return id
      ? "https://drive.google.com/thumbnail?id=" + encodeURIComponent(id) + "&sz=w1200"
      : String(url || "").trim();
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, char => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[char]);
  }

  function targetInfo(update) {
    const target = parseObject(update.targetFeatureProperties);
    const changes = parseObject(update.proposedChanges);
    return {
      layerId: normalize(firstValue([
        update.targetLayerId, update.Target_Layer_ID_Current,
        update.Target_Layer_ID, target.Layer_ID, target.Source_Layer,
        changes.targetLayerId, changes.Layer_ID
      ])),
      objectId: normalize(firstValue([
        update.targetObjectId, update.Target_Object_ID_Current,
        update.Target_Object_ID, target.Object_ID,
        target.Target_Object_ID_Current, target.Target_Object_ID,
        changes.targetObjectId, changes.Target_Object_ID_Current,
        changes.Target_Object_ID
      ])),
      name: normalize(firstValue([
        update.targetObjectName, target.Nama_Objek, target.Nama,
        target.Lokasi, target.title, update.locationName, update.title
      ])),
      no: normalize(firstValue([target.No, target.NO, target.Id, target.ID])),
      village: normalize(firstValue([target.Desa, target.WADMKD, target.NAMA_DESA])),
      year: normalize(firstValue([target.Tahun, target.Year]))
    };
  }

  function featureMatches(feature, target) {
    const props = feature && feature.properties || {};
    const featureId = normalize(firstValue([
      props.Object_ID, props.objectId, props.OBJECTID, props.ID
    ]));
    if (target.objectId && featureId) return target.objectId === featureId;

    const featureName = normalize(firstValue([
      props.Nama_Objek, props.Nama, props.Lokasi, props.title
    ]));
    if (target.name && featureName && target.name === featureName) return true;

    const checks = [];
    if (target.no) checks.push(target.no === normalize(firstValue([props.No, props.NO, props.Id, props.ID])));
    if (target.village) checks.push(target.village === normalize(firstValue([props.Desa, props.WADMKD, props.NAMA_DESA])));
    if (target.year) checks.push(target.year === normalize(firstValue([props.Tahun, props.Year])));
    return checks.length >= 2 && checks.every(Boolean);
  }

  function uniquePhotos(values) {
    const seen = new Set();
    return (values || []).map(value => String(value || "").trim()).filter(url => {
      if (!url) return false;
      const id = driveId(url);
      const key = id ? "drive:" + id : url.split(/[?#]/)[0].toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return /^https?:\/\//i.test(url) || Boolean(id);
    });
  }

  function galleryHtml(photos) {
    if (!photos.length) return "";
    return '<div class="yg-v3-gallery yg-legacy-object-gallery">' +
      photos.map((url, index) =>
        '<a class="yg-photo-card" href="' + escapeHtml(url) +
        '" target="_blank" rel="noopener noreferrer">' +
        '<img src="' + escapeHtml(thumbUrl(url)) + '" alt="Foto ' +
        (index + 1) + '" loading="lazy" ' +
        'onerror="this.style.display=&quot;none&quot;;this.nextElementSibling.style.display=&quot;flex&quot;;">' +
        '<span class="yg-photo-fallback" style="display:none">Buka Foto ' +
        (index + 1) + '</span></a>'
      ).join("") + '</div>';
  }

  function attachPhotos(layer, photos) {
    if (!layer || !photos.length) return;
    const props = layer.feature && layer.feature.properties || {};
    props._ygPhotos = uniquePhotos((props._ygPhotos || []).concat(photos));
    if (!layer.getPopup || !layer.getPopup()) return;

    const popup = layer.getPopup();
    let content = String(popup.getContent() || "");
    content = content.replace(
      /<div class="yg-v3-gallery yg-legacy-object-gallery">[\s\S]*?<\/div>/,
      ""
    );
    const gallery = galleryHtml(props._ygPhotos);
    if (!gallery) return;
    content = content.replace(/(<\/div>\s*<\/div>\s*)$/, gallery + "$1");
    popup.setContent(content);
  }

  function applyUpdates(data, attempt = 0) {
    const mapApi = window.YG_MAP;
    if (!mapApi || !mapApi.layerObjects) {
      if (attempt < 30) setTimeout(() => applyUpdates(data, attempt + 1), 250);
      return;
    }

    (data && data.updates || []).forEach(update => {
      const photos = uniquePhotos(update.photos || []);
      if (!photos.length) return;
      const target = targetInfo(update);
      const group = mapApi.layerObjects[target.layerId];
      if (!group || typeof group.eachLayer !== "function") return;

      group.eachLayer(layer => {
        if (featureMatches(layer.feature, target)) attachPhotos(layer, photos);
      });
    });
  }

  window[CALLBACK] = data => {
    try { applyUpdates(data); } finally {
      try { delete window[CALLBACK]; } catch (error) {}
    }
  };

  const script = document.createElement("script");
  script.src = API + "&callback=" + encodeURIComponent(CALLBACK) + "&t=" + Date.now();
  script.async = true;
  document.head.appendChild(script);
})();