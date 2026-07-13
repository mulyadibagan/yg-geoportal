(() => {
  "use strict";

  const API = "https://script.google.com/macros/s/AKfycbxeGTDZXkR0DyLZmBHTq2M-52Iu4dTTGpH164S7sYHg8qPzvffobC6-r-TBLVHMT3HU-A/exec?page=public-reports";
  const CALLBACK_NAME = "ygCommunityReportsCallback";
  const LAYER_ID = "community_reports";
  const LAYER_LABEL = "Laporan Masyarakat Terverifikasi";
  const LAYER_COLOR = "#7b1fa2";

  let communityLayer = null;

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function(char) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      }[char];
    });
  }

  function normalizePhotoUrl(url) {
    const value = String(url || "").trim();
    if (!value) return "";

    const patterns = [
      /drive\.google\.com\/file\/d\/([A-Za-z0-9_-]+)/,
      /[?&]id=([A-Za-z0-9_-]+)/
    ];

    for (let i = 0; i < patterns.length; i += 1) {
      const match = value.match(patterns[i]);
      if (match && match[1]) {
        return "https://drive.google.com/thumbnail?id=" +
          encodeURIComponent(match[1]) + "&sz=w1000";
      }
    }

    return value;
  }

  function buildPopup(properties) {
    const photos = Array.isArray(properties.photos)
      ? properties.photos.filter(Boolean)
      : [];

    let gallery = "";

    if (photos.length) {
      const items = photos.map(function(url, index) {
        const imageUrl = normalizePhotoUrl(url);
        return (
          '<button type="button" class="community-photo-thumb" ' +
          'data-community-photo="' + escapeHtml(imageUrl) + '" ' +
          'data-community-photo-number="' + (index + 1) + '">' +
            '<img src="' + escapeHtml(imageUrl) + '" alt="Foto dokumentasi ' + (index + 1) + '" loading="lazy">' +
            '<span>Foto ' + (index + 1) + '</span>' +
          '</button>'
        );
      }).join("");

      gallery =
        '<div class="community-photo-section">' +
          '<div class="community-photo-title"><b>Dokumentasi</b><span>' + photos.length + ' foto</span></div>' +
          '<div class="community-photo-grid">' + items + '</div>' +
        '</div>';
    }

    let documentLink = "";
    if (properties.documentUrl) {
      documentLink =
        '<a class="community-document-link" href="' +
        escapeHtml(properties.documentUrl) +
        '" target="_blank" rel="noopener noreferrer">Lihat dokumen pendukung</a>';
    }

    const location = [
      properties.locationName,
      properties.village,
      properties.district,
      properties.regency
    ].filter(Boolean).join(", ");

    return (
      '<div class="community-popup">' +
        '<div class="community-popup-head">' +
          '<strong>' + escapeHtml(properties.title || "Laporan Masyarakat") + '</strong>' +
          '<span>Terverifikasi Yayasan Gambut</span>' +
        '</div>' +
        '<div class="community-popup-body">' +
          '<div><b>Jenis</b><span>' + escapeHtml(properties.reportType || "-") + '</span></div>' +
          '<div><b>Lokasi</b><span>' + escapeHtml(location || "-") + '</span></div>' +
          '<div><b>Tanggal</b><span>' + escapeHtml(properties.activityDate || properties.receivedAt || "-") + '</span></div>' +
          '<div><b>Pelapor</b><span>' + escapeHtml(properties.organization || properties.reporterName || "-") + '</span></div>' +
          '<p>' + escapeHtml(properties.description || "-") + '</p>' +
          gallery + documentLink +
        '</div>' +
      '</div>'
    );
  }

  function createSidebarLayerRow(featureCount) {
    const layerList = document.querySelector(".layer-list");
    if (!layerList) return null;

    let existing = document.querySelector('[data-layer-id="' + LAYER_ID + '"]');
    if (existing) {
      const row = existing.closest(".layer-row");
      const count = row ? row.querySelector(".count") : null;
      if (count) count.textContent = String(featureCount);
      return existing;
    }

    const row = document.createElement("div");
    row.className = "layer-row community-layer-row";
    row.innerHTML =
      '<input id="layer-' + LAYER_ID + '" data-layer-id="' + LAYER_ID + '" type="checkbox" checked>' +
      '<span class="swatch" style="background:' + LAYER_COLOR + '"></span>' +
      '<label for="layer-' + LAYER_ID + '">' + LAYER_LABEL + '</label>' +
      '<span class="count">' + featureCount + '</span>';

    layerList.appendChild(row);
    return row.querySelector("input");
  }

  function createLegendItem() {
    const legend = document.querySelector(".legend");
    if (!legend) return;

    if (document.getElementById("legend-" + LAYER_ID)) return;

    const item = document.createElement("div");
    item.className = "legend-item";
    item.id = "legend-" + LAYER_ID;
    item.innerHTML =
      '<span class="legend-mark point" style="background:' + LAYER_COLOR + '"></span>' +
      '<span>' + LAYER_LABEL + '</span>';

    legend.appendChild(item);
  }

  function updateSidebarStatus(featureCount) {
    const statusBox = document.getElementById("status-box");
    const statusText = document.getElementById("status-text");

    if (!statusBox || !statusText) return;

    if (featureCount > 0) {
      statusBox.classList.remove("error");
      statusBox.classList.add("ok");
      statusText.textContent =
        "8 layer utama + " + featureCount + " laporan terverifikasi berhasil dimuat";
    } else {
      statusText.textContent =
        "8 layer utama berhasil dimuat; belum ada laporan terverifikasi";
    }
  }

  function addSearchableFeatures(layer) {
    // Search integration is optional. Existing map search still works for static layers.
    window.YG_COMMUNITY_SEARCH = [];

    layer.eachLayer(function(featureLayer) {
      const feature = featureLayer.feature || {};
      const properties = feature.properties || {};

      const text = [
        LAYER_LABEL,
        properties.title,
        properties.locationName,
        properties.village,
        properties.district,
        properties.regency,
        properties.description
      ].filter(Boolean).join(" ").toLowerCase();

      window.YG_COMMUNITY_SEARCH.push({
        text: text,
        layer: featureLayer,
        parent: layer
      });
    });
  }

  function mountCommunityLayer(data) {
    const mapApi = window.YG_MAP;
    const map = mapApi && mapApi.map;

    if (!map || typeof L === "undefined") {
      window.setTimeout(function() {
        mountCommunityLayer(data);
      }, 300);
      return;
    }

    if (communityLayer && map.hasLayer(communityLayer)) {
      map.removeLayer(communityLayer);
    }

    communityLayer = L.geoJSON(data, {
      style: function(feature) {
        const type = feature && feature.geometry ? feature.geometry.type : "";

        if (type === "Polygon" || type === "MultiPolygon") {
          return {
            color: LAYER_COLOR,
            weight: 3,
            fillColor: LAYER_COLOR,
            fillOpacity: 0.25,
            opacity: 0.95
          };
        }

        if (type === "LineString" || type === "MultiLineString") {
          return {
            color: LAYER_COLOR,
            weight: 4,
            opacity: 0.95
          };
        }

        return {};
      },

      pointToLayer: function(feature, latlng) {
        return L.circleMarker(latlng, {
          radius: 8,
          fillColor: LAYER_COLOR,
          color: "#ffffff",
          weight: 2,
          opacity: 1,
          fillOpacity: 0.96
        });
      },

      onEachFeature: function(feature, layer) {
        layer.bindPopup(buildPopup(feature.properties || {}), {
          maxWidth: 340
        });
      }
    });

    communityLayer.addTo(map);

    if (mapApi.layerObjects) {
      mapApi.layerObjects[LAYER_ID] = communityLayer;
    }

    const featureCount =
      typeof data.featureCount === "number"
        ? data.featureCount
        : Array.isArray(data.features)
          ? data.features.length
          : 0;

    const checkbox = createSidebarLayerRow(featureCount);

    if (checkbox && !checkbox.dataset.communityBound) {
      checkbox.dataset.communityBound = "true";

      checkbox.addEventListener("change", function() {
        if (checkbox.checked) {
          communityLayer.addTo(map);
        } else {
          map.removeLayer(communityLayer);
        }
      });
    }

    createLegendItem();
    addSearchableFeatures(communityLayer);
    updateSidebarStatus(featureCount);

    window.YG_COMMUNITY_LAYER = communityLayer;
  }

  window[CALLBACK_NAME] = function(data) {
    if (!data || data.type !== "FeatureCollection") {
      console.warn("Data laporan masyarakat bukan FeatureCollection.");
      return;
    }

    mountCommunityLayer(data);
  };

  const script = document.createElement("script");
  script.src =
    API +
    "&callback=" +
    CALLBACK_NAME +
    "&t=" +
    Date.now();

  script.async = true;

  script.onerror = function() {
    console.warn("Laporan masyarakat belum dapat dimuat.");

    const statusBox = document.getElementById("status-box");
    const statusText = document.getElementById("status-text");

    if (statusBox) statusBox.classList.add("error");
    if (statusText) {
      statusText.textContent =
        "Layer utama berhasil dimuat, tetapi laporan masyarakat gagal dimuat";
    }
  };

  document.head.appendChild(script);

  function installGalleryStyles() {
    if (document.getElementById("yg-community-gallery-style")) return;
    const style = document.createElement("style");
    style.id = "yg-community-gallery-style";
    style.textContent = `
      .community-photo-section{margin-top:12px;padding-top:10px;border-top:1px solid #e6ebe8}
      .community-photo-title{display:flex!important;align-items:center;justify-content:space-between;border:0!important;padding:0 0 8px!important}
      .community-photo-title b{font-size:12px}.community-photo-title span{font-size:9px;color:#7b1fa2;background:#f2e7f7;padding:3px 7px;border-radius:20px}
      .community-photo-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}
      .community-photo-thumb{position:relative;height:95px;padding:0;border:0;border-radius:10px;overflow:hidden;background:#edf1ef;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.14)}
      .community-photo-thumb:only-child{grid-column:1/-1;height:155px}
      .community-photo-thumb img{display:block;width:100%;height:100%;object-fit:cover}
      .community-photo-thumb span{position:absolute;right:6px;bottom:6px;padding:3px 6px;border-radius:5px;background:rgba(0,0,0,.62);color:#fff;font-size:8px;font-weight:800}
      .community-document-link{display:block;margin-top:10px;padding:9px;border-radius:9px;background:#f2e7f7;color:#6f168c!important;text-align:center;font-size:10px;font-weight:800;text-decoration:none}
      .yg-photo-lightbox{position:fixed;inset:0;z-index:999999;display:none;align-items:center;justify-content:center;padding:16px;background:rgba(0,0,0,.9)}
      .yg-photo-lightbox.open{display:flex}.yg-photo-lightbox img{max-width:96vw;max-height:86vh;object-fit:contain;border-radius:10px;background:#fff}
      .yg-photo-lightbox button{position:absolute;top:14px;right:14px;width:42px;height:42px;border:0;border-radius:50%;background:#fff;color:#6f168c;font-size:28px;cursor:pointer}
      @media(max-width:600px){.community-photo-thumb{height:86px}.community-photo-thumb:only-child{height:140px}}
    `;
    document.head.appendChild(style);
  }

  function ensureLightbox() {
    let box = document.getElementById("yg-photo-lightbox");
    if (box) return box;
    box = document.createElement("div");
    box.id = "yg-photo-lightbox";
    box.className = "yg-photo-lightbox";
    box.innerHTML = '<button type="button" aria-label="Tutup">×</button><img alt="Dokumentasi kegiatan">';
    document.body.appendChild(box);
    box.addEventListener("click", function(event) {
      if (event.target === box || event.target.tagName === "BUTTON") {
        box.classList.remove("open");
        box.querySelector("img").src = "";
      }
    });
    return box;
  }

  document.addEventListener("click", function(event) {
    const button = event.target.closest("[data-community-photo]");
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    const box = ensureLightbox();
    box.querySelector("img").src = button.getAttribute("data-community-photo");
    box.classList.add("open");
  });

  document.addEventListener("keydown", function(event) {
    if (event.key === "Escape") {
      const box = document.getElementById("yg-photo-lightbox");
      if (box) box.classList.remove("open");
    }
  });

  installGalleryStyles();

})();
