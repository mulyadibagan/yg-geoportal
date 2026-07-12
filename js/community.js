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

  function buildPopup(properties) {
    const photos = Array.isArray(properties.photos) ? properties.photos : [];
    let links = "";

    photos.forEach(function(url, index) {
      links +=
        '<a class="community-photo-link" href="' +
        escapeHtml(url) +
        '" target="_blank" rel="noopener">Foto ' +
        (index + 1) +
        "</a>";
    });

    if (properties.documentUrl) {
      links +=
        '<a class="community-photo-link" href="' +
        escapeHtml(properties.documentUrl) +
        '" target="_blank" rel="noopener">Dokumen</a>';
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
          '<div><b>Tanggal</b><span>' +
            escapeHtml(properties.activityDate || properties.receivedAt || "-") +
          '</span></div>' +
          '<div><b>Pelapor</b><span>' +
            escapeHtml(properties.organization || properties.reporterName || "-") +
          '</span></div>' +
          '<p>' + escapeHtml(properties.description || "-") + '</p>' +
          (links ? '<div class="community-popup-links">' + links + '</div>' : '') +
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
})();
