
(() => {
  "use strict";

  const dashboardActions = [
    {
      match: "desa intervensi",
      layerIds: ["desa_intervensi", "titik_desa"],
      message: "Menampilkan 13 desa intervensi"
    },
    {
      match: "area mangrove",
      layerIds: ["area_mangrove"],
      message: "Menampilkan area penanaman mangrove"
    },
    {
      match: "lokasi fdrs",
      layerIds: ["fdrs"],
      message: "Menampilkan 8 lokasi FDRS"
    },
    {
      match: "sekat kanal",
      layerIds: ["sekat_kanal"],
      message: "Menampilkan 11 lokasi sekat kanal"
    }
  ];

  function getMapApi() {
    return window.YG_MAP || null;
  }

  function setLayerVisible(layerId, visible) {
    const mapApi = getMapApi();
    if (!mapApi || !mapApi.map || !mapApi.layerObjects) return null;

    const layer = mapApi.layerObjects[layerId];
    if (!layer) return null;

    const checkbox = document.querySelector(
      'input[data-layer-id="' + layerId + '"]'
    );

    if (visible) {
      if (!mapApi.map.hasLayer(layer)) {
        layer.addTo(mapApi.map);
      }

      if (checkbox) checkbox.checked = true;
    } else {
      if (mapApi.map.hasLayer(layer)) {
        mapApi.map.removeLayer(layer);
      }

      if (checkbox) checkbox.checked = false;
    }

    return layer;
  }

  function collectBounds(layerIds) {
    let combinedBounds = null;

    layerIds.forEach(function (layerId) {
      const layer = setLayerVisible(layerId, true);
      if (!layer || typeof layer.getBounds !== "function") return;

      const bounds = layer.getBounds();
      if (!bounds || !bounds.isValid || !bounds.isValid()) return;

      if (!combinedBounds) {
        combinedBounds = L.latLngBounds(bounds);
      } else {
        combinedBounds.extend(bounds);
      }
    });

    return combinedBounds;
  }

  function updateStatus(message) {
    const statusBox = document.getElementById("status-box");
    const statusText = document.getElementById("status-text");

    if (statusBox) {
      statusBox.classList.remove("error");
      statusBox.classList.add("ok");
    }

    if (statusText) {
      statusText.textContent = message;
    }
  }

  function clearActiveCards() {
    document.querySelectorAll(".stats .stat.dashboard-active").forEach(function (card) {
      card.classList.remove("dashboard-active");
    });
  }

  function runDashboardAction(card, action) {
    const mapApi = getMapApi();

    if (!mapApi || !mapApi.map || !mapApi.layerObjects) {
      updateStatus("Peta masih memuat. Silakan klik kembali.");
      return;
    }

    clearActiveCards();
    card.classList.add("dashboard-active");

    const bounds = collectBounds(action.layerIds);

    if (bounds && bounds.isValid()) {
      mapApi.map.fitBounds(bounds, {
        padding: [30, 30],
        maxZoom: 15
      });
    }

    updateStatus(action.message);

    if (window.innerWidth <= 860) {
      const sidebar = document.getElementById("sidebar");
      const overlay = document.getElementById("overlay");

      if (sidebar) sidebar.classList.remove("open");
      if (overlay) overlay.classList.remove("show");

      window.setTimeout(function () {
        mapApi.map.invalidateSize(true);
      }, 250);
    }
  }

  function prepareDashboard() {
    const cards = Array.from(document.querySelectorAll(".stats .stat"));

    if (!cards.length) return;

    cards.forEach(function (card) {
      const text = card.textContent.toLowerCase().replace(/\s+/g, " ").trim();

      const action = dashboardActions.find(function (item) {
        return text.indexOf(item.match) !== -1;
      });

      if (!action) return;

      card.classList.add("dashboard-clickable");
      card.setAttribute("role", "button");
      card.setAttribute("tabindex", "0");
      card.setAttribute(
        "title",
        "Klik untuk menampilkan " + action.match + " pada peta"
      );

      card.addEventListener("click", function () {
        runDashboardAction(card, action);
      });

      card.addEventListener("keydown", function (event) {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          runDashboardAction(card, action);
        }
      });
    });
  }

  function waitForMap() {
    if (getMapApi() && getMapApi().layerObjects) {
      prepareDashboard();
      return;
    }

    window.setTimeout(waitForMap, 250);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", waitForMap);
  } else {
    waitForMap();
  }
})();
