
(() => {
  "use strict";

  const input = document.getElementById("search-input");
  const button = document.getElementById("search-button");
  const searchBox = input ? input.closest(".search") : null;

  if (!input || !button || !searchBox) return;

  let resultsPanel = document.getElementById("yg-search-results");

  if (!resultsPanel) {
    resultsPanel = document.createElement("div");
    resultsPanel.id = "yg-search-results";
    resultsPanel.className = "yg-search-results";
    resultsPanel.hidden = true;
    searchBox.appendChild(resultsPanel);
  }

  function normalize(value) {
    return String(value == null ? "" : value)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function humanizeKey(key) {
    const labels = {
      NAMOBJ: "Nama Desa",
      WADMKD: "Desa",
      WADMKC: "Kecamatan",
      WADMKK: "Kabupaten",
      NAMA_DESA: "Desa",
      NAMA_KEC: "Kecamatan",
      NAMA_KAB: "Kabupaten",
      Desa: "Desa",
      Kecamatan: "Kecamatan",
      Kabupaten: "Kabupaten",
      Keterangan: "Keterangan",
      Ket: "Keterangan",
      title: "Judul",
      locationName: "Lokasi",
      village: "Desa",
      district: "Kecamatan",
      regency: "Kabupaten"
    };

    return labels[key] || String(key).replace(/_/g, " ");
  }

  function featureTitle(feature, fallbackLabel) {
    const props = (feature && feature.properties) || {};
    const preferredKeys = [
      "NAMOBJ", "NAMA_DESA", "WADMKD", "Desa", "desa",
      "Nama", "NAMA", "Nama_Desa", "NAMA_KEGIATAN",
      "Kegiatan", "KEGIATAN", "title", "locationName"
    ];

    for (let i = 0; i < preferredKeys.length; i++) {
      const value = props[preferredKeys[i]];
      if (value !== null && value !== undefined && String(value).trim()) {
        return String(value).trim();
      }
    }

    const firstValue = Object.values(props).find(value =>
      value !== null &&
      value !== undefined &&
      typeof value !== "object" &&
      String(value).trim()
    );

    return firstValue ? String(firstValue).trim() : fallbackLabel;
  }

  function layerLabel(layerId) {
    if (layerId === "community_reports") {
      return "Laporan Masyarakat Terverifikasi";
    }

    const config = (window.YG_LAYER_CONFIG || []).find(item => item.id === layerId);
    return config ? config.label : layerId.replace(/_/g, " ");
  }

  function buildSearchIndex() {
    const mapApi = window.YG_MAP;
    if (!mapApi || !mapApi.layerObjects) return [];

    const index = [];

    Object.keys(mapApi.layerObjects).forEach(layerId => {
      const parentLayer = mapApi.layerObjects[layerId];
      if (!parentLayer || typeof parentLayer.eachLayer !== "function") return;

      const parentLabel = layerLabel(layerId);

      parentLayer.eachLayer(featureLayer => {
        const feature = featureLayer.feature || {};
        const props = feature.properties || {};

        const searchableValues = [
          parentLabel,
          ...Object.keys(props).map(key => humanizeKey(key)),
          ...Object.values(props)
        ]
          .filter(value => value !== null && value !== undefined)
          .map(value => String(value))
          .join(" ");

        index.push({
          text: normalize(searchableValues),
          title: featureTitle(feature, parentLabel),
          subtitle: parentLabel,
          layerId,
          parentLayer,
          featureLayer
        });
      });
    });

    if (window.YG_COMMUNITY_LAYER &&
        !mapApi.layerObjects.community_reports &&
        typeof window.YG_COMMUNITY_LAYER.eachLayer === "function") {
      window.YG_COMMUNITY_LAYER.eachLayer(featureLayer => {
        const feature = featureLayer.feature || {};
        const props = feature.properties || {};

        index.push({
          text: normalize(
            "Laporan Masyarakat Terverifikasi " +
            Object.values(props).filter(Boolean).join(" ")
          ),
          title: featureTitle(feature, "Laporan Masyarakat"),
          subtitle: "Laporan Masyarakat Terverifikasi",
          layerId: "community_reports",
          parentLayer: window.YG_COMMUNITY_LAYER,
          featureLayer
        });
      });
    }

    return index;
  }

  function ensureLayerVisible(result) {
    const mapApi = window.YG_MAP;
    if (!mapApi || !mapApi.map) return;

    if (!mapApi.map.hasLayer(result.parentLayer)) {
      result.parentLayer.addTo(mapApi.map);
    }

    const checkbox = document.querySelector(
      'input[data-layer-id="' + result.layerId + '"]'
    );

    if (checkbox) checkbox.checked = true;
  }

  function focusResult(result) {
    const mapApi = window.YG_MAP;
    if (!mapApi || !mapApi.map) return;

    const map = mapApi.map;
    ensureLayerVisible(result);

    if (typeof result.featureLayer.getLatLng === "function") {
      map.setView(result.featureLayer.getLatLng(), 16);
    } else if (typeof result.featureLayer.getBounds === "function") {
      const bounds = result.featureLayer.getBounds();

      if (bounds && bounds.isValid && bounds.isValid()) {
        map.fitBounds(bounds, {
          padding: [35, 35],
          maxZoom: 16
        });
      }
    }

    if (typeof result.featureLayer.openPopup === "function") {
      window.setTimeout(() => result.featureLayer.openPopup(), 180);
    }

    input.value = result.title;
    input.classList.remove("search-error");
    input.classList.add("search-success");
    closeResults();

    if (window.YG_UI && typeof window.YG_UI.closeMobileSidebar === "function") {
      window.YG_UI.closeMobileSidebar();
    }

    const statusText = document.getElementById("status-text");
    if (statusText) {
      statusText.textContent =
        'Lokasi ditemukan: "' + result.title + '" — ' + result.subtitle;
    }
  }

  function closeResults() {
    resultsPanel.hidden = true;
    resultsPanel.innerHTML = "";
  }

  function showResults(results, query) {
    resultsPanel.innerHTML = "";

    if (!results.length) {
      const empty = document.createElement("div");
      empty.className = "yg-search-empty";
      empty.textContent = 'Lokasi "' + query + '" tidak ditemukan.';
      resultsPanel.appendChild(empty);
      resultsPanel.hidden = false;
      input.classList.remove("search-success");
      input.classList.add("search-error");
      return;
    }

    results.slice(0, 8).forEach(result => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "yg-search-result";
      item.innerHTML =
        "<strong></strong><span></span>";

      item.querySelector("strong").textContent = result.title;
      item.querySelector("span").textContent = result.subtitle;

      item.addEventListener("click", () => focusResult(result));
      resultsPanel.appendChild(item);
    });

    resultsPanel.hidden = false;
    input.classList.remove("search-error");
  }

  function performSearch(event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === "function") {
        event.stopImmediatePropagation();
      }
    }

    const query = normalize(input.value);

    if (query.length < 2) {
      input.classList.add("search-error");
      showResults([], input.value.trim() || "tersebut");
      return;
    }

    const index = buildSearchIndex();
    const words = query.split(" ").filter(Boolean);

    const matched = index
      .filter(item => words.every(word => item.text.includes(word)))
      .sort((a, b) => {
        const aTitle = normalize(a.title);
        const bTitle = normalize(b.title);

        const aExact = aTitle === query ? 0 : aTitle.startsWith(query) ? 1 : 2;
        const bExact = bTitle === query ? 0 : bTitle.startsWith(query) ? 1 : 2;

        return aExact - bExact || a.title.localeCompare(b.title);
      });

    if (matched.length === 1) {
      focusResult(matched[0]);
      return;
    }

    showResults(matched, input.value.trim());
  }

  button.addEventListener("click", performSearch, true);

  input.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      performSearch(event);
    } else if (event.key === "Escape") {
      closeResults();
    }
  }, true);

  input.addEventListener("input", () => {
    input.classList.remove("search-error", "search-success");

    const query = normalize(input.value);
    if (query.length < 2) {
      closeResults();
      return;
    }

    const index = buildSearchIndex();
    const words = query.split(" ").filter(Boolean);
    const matched = index
      .filter(item => words.every(word => item.text.includes(word)))
      .slice(0, 8);

    showResults(matched, input.value.trim());
  });

  document.addEventListener("click", event => {
    if (!searchBox.contains(event.target)) {
      closeResults();
    }
  });

  window.YG_SEARCH = {
    search: performSearch,
    rebuild: buildSearchIndex
  };
})();
