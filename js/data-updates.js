(() => {
  "use strict";

  const API = "https://script.google.com/macros/s/AKfycbxeGTDZXkR0DyLZmBHTq2M-52Iu4dTTGpH164S7sYHg8qPzvffobC6-r-TBLVHMT3HU-A/exec?page=public-updates";
  const CALLBACK = "ygPublishedUpdatesCallback";
  const appliedUpdates = [];

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

  function featureMatches(feature, update) {
    const props = feature.properties || {};
    const target = update.targetFeatureProperties || {};

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

  function toDirectDriveUrl(url) {
    const match = String(url || "").match(/\/d\/([^/]+)/);
    return match
      ? "https://drive.google.com/thumbnail?id=" + match[1] + "&sz=w1000"
      : url;
  }

  function buildUpdatedPopup(feature, layerLabel) {
    const props = feature.properties || {};
    const photos = Array.isArray(props._ygPhotos) ? props._ygPhotos : [];
    const notes = Array.isArray(props._ygUpdateNotes) ? props._ygUpdateNotes : [];

    const hidden = new Set([
      "_ygPhotos","_ygUpdateNotes","Foto","Foto_2",
      "OBJECTID","FID_1","X","Y"
    ]);

    let rows = "";
    Object.entries(props).forEach(([key,value]) => {
      if (
        hidden.has(key) ||
        value === null ||
        value === "" ||
        typeof value === "undefined" ||
        typeof value === "object"
      ) return;

      rows +=
        '<div class="popup-row"><b>' + escapeHtml(key.replace(/_/g," ")) +
        '</b><span>' + escapeHtml(value) + '</span></div>';
    });

    let gallery = "";
    if (photos.length) {
      gallery = '<div class="yg-update-gallery">' +
        photos.map((url,index) =>
          '<a href="' + escapeHtml(url) + '" target="_blank" rel="noopener">' +
          '<img src="' + escapeHtml(toDirectDriveUrl(url)) +
          '" alt="Foto ' + (index+1) + '" loading="lazy"></a>'
        ).join("") +
        '</div>';
    }

    let updateNotes = "";
    if (notes.length) {
      updateNotes =
        '<div class="yg-update-notes"><b>Pembaruan terverifikasi</b>' +
        notes.map(note => '<p>' + escapeHtml(note) + '</p>').join("") +
        '</div>';
    }

    return '<div class="popup-card">' +
      '<div class="popup-head yg-updated-popup-head">' +
      '<strong>' + escapeHtml(layerLabel) + '</strong>' +
      '<span>Data diperbarui melalui verifikasi publik</span></div>' +
      rows + gallery + updateNotes + '</div>';
  }

  function applyUpdate(update) {
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

      if (update.note && props._ygUpdateNotes.indexOf(update.note) === -1) {
        props._ygUpdateNotes.push(update.note);
      }

      layer.bindPopup(
        buildUpdatedPopup(layer.feature,update.targetLayerLabel || update.targetLayerId),
        {maxWidth:360}
      );

      appliedUpdates.push(update.reportId);
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
      if (!applyUpdate(update)) remaining++;
    });

    if (remaining && attempt < 20) {
      setTimeout(() => applyAll(data,attempt+1),400);
    }

    const status = document.getElementById("status-text");
    if (status && appliedUpdates.length) {
      status.textContent =
        "Layer berhasil dimuat • " + appliedUpdates.length +
        " pembaruan publik diterapkan";
    }
  }

  window[CALLBACK] = data => applyAll(data);

  const style = document.createElement("style");
  style.textContent = `
    .yg-updated-popup-head{background:#7b1fa2!important}
    .yg-update-gallery{
      display:grid;grid-template-columns:repeat(2,1fr);
      gap:6px;padding:9px 10px
    }
    .yg-update-gallery img{
      width:100%;height:100px;object-fit:cover;
      border-radius:7px;display:block
    }
    .yg-update-notes{
      margin:8px 10px 10px;padding:9px;
      border-left:3px solid #7b1fa2;background:#f6effa;
      font-size:10px
    }
    .yg-update-notes p{margin:5px 0 0}
  `;
  document.head.appendChild(style);

  const script = document.createElement("script");
  script.src = API + "&callback=" + CALLBACK + "&t=" + Date.now();
  script.async = true;
  document.head.appendChild(script);
})();
