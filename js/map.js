
(() => {
  "use strict";

  const CONFIG = window.YG_LAYER_CONFIG || [];
  const DEFAULT_CENTER = [1.15, 101.95];
  const DEFAULT_ZOOM = 8;

  const mapElement = document.getElementById("map");
  if (!mapElement || typeof L === "undefined") {
    console.error("Leaflet atau elemen #map tidak tersedia.");
    return;
  }

  const map = L.map(mapElement, {
    zoomControl: true,
    preferCanvas: true,
    minZoom: 6
  }).setView(DEFAULT_CENTER, DEFAULT_ZOOM);

  const osm = L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors"
    }
  ).addTo(map);

  const satellite = L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    {
      maxZoom: 19,
      attribution: "Tiles &copy; Esri"
    }
  );

  L.control.layers(
    {
      "Peta Jalan": osm,
      "Citra Satelit": satellite
    },
    null,
    {
      position: "topright",
      collapsed: false
    }
  ).addTo(map);

  L.control.scale({ imperial: false, position: "bottomleft" }).addTo(map);

  const layerObjects = {};
  const allBounds = L.latLngBounds([]);
  const searchable = [];
  let success = 0;
  let failed = 0;

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);
  }

  function prettyKey(key) {
    const labels = {
      NAMOBJ: "Nama Desa",
      WADMKD: "Desa",
      WADMKC: "Kecamatan",
      WADMKK: "Kabupaten",
      WADMPR: "Provinsi",
      NAMA_DESA: "Desa",
      NAMA_KEC: "Kecamatan",
      NAMA_KAB: "Kabupaten",
      NAMA_PROV: "Provinsi",
      Luas_Ha: "Luas (ha)",
      Panjang_M: "Panjang (m)",
      Ket: "Keterangan",
      Keterangan: "Keterangan",
      Tahun: "Tahun"
    };
    return labels[key] || key.replace(/_/g, " ");
  }

  function hiddenField(key) {
    return [
      "Id","No","OBJECTID","FID_1","KODE_DESA","KODE_KEC",
      "KODE_KAB","KODE_PROV","SRS_ID","iddesa","X","Y",
      "UUPP","REMARK","Foto","Foto_2"
    ].includes(key);
  }

  function popupHtml(feature, config) {
    const props = feature.properties || {};
    let rows = "";

    Object.entries(props).forEach(([key, value]) => {
      if (
        value === null ||
        value === "" ||
        typeof value === "undefined" ||
        hiddenField(key)
      ) return;

      rows += `
        <div class="popup-row">
          <b>${escapeHtml(prettyKey(key))}</b>
          <span>${escapeHtml(value)}</span>
        </div>`;
    });

    if (!rows) {
      rows = `<div class="popup-row"><span>Informasi atribut belum tersedia.</span></div>`;
    }

    return `
      <div class="popup-card">
        <div class="popup-head" style="background:${config.color}">
          <strong>${escapeHtml(config.label)}</strong>
          <span>Data spasial Yayasan Gambut</span>
        </div>
        ${rows}
      </div>`;
  }

  function updateStatus() {
    const box = document.getElementById("status-box");
    const text = document.getElementById("status-text");
    const total = CONFIG.length;

    if (success + failed < total) {
      text.textContent = `Memuat ${success + failed} dari ${total} layer...`;
      return;
    }

    if (failed === 0) {
      box.classList.add("ok");
      text.textContent = `Semua ${total} layer berhasil dimuat`;
    } else {
      box.classList.add("error");
      text.textContent = `${success} layer berhasil, ${failed} gagal`;
    }
  }

  async function loadLayer(config) {
    try {
      const response = await fetch(`data/${config.id}.geojson`, { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      let geoLayer;

      geoLayer = L.geoJSON(data, {
        style: () => ({
          color: config.color,
          fillColor: config.color,
          fillOpacity: config.type === "line" ? 0.10 : 0.24,
          weight: config.type === "line" ? 4 : 2.2,
          opacity: 0.95
        }),
        pointToLayer: (feature, latlng) => L.circleMarker(latlng, {
          radius: 7,
          fillColor: config.color,
          color: "#fff",
          weight: 1.7,
          opacity: 1,
          fillOpacity: 0.96
        }),
        onEachFeature: (feature, featureLayer) => {
          featureLayer.bindPopup(popupHtml(feature, config), { maxWidth: 330 });

          const values = Object.values(feature.properties || {}).join(" ");
          searchable.push({
            text: `${config.label} ${values}`.toLowerCase(),
            layer: featureLayer,
            parent: geoLayer
          });
        }
      });

      layerObjects[config.id] = geoLayer;
      if (config.visible) geoLayer.addTo(map);

      const bounds = geoLayer.getBounds();
      if (bounds && bounds.isValid()) allBounds.extend(bounds);

      const checkbox = document.querySelector(`[data-layer-id="${config.id}"]`);
      checkbox?.addEventListener("change", () => {
        if (checkbox.checked) geoLayer.addTo(map);
        else map.removeLayer(geoLayer);
      });

      success += 1;
    } catch (error) {
      console.error(`Gagal memuat ${config.id}:`, error);
      failed += 1;

      const checkbox = document.querySelector(`[data-layer-id="${config.id}"]`);
      if (checkbox) {
        checkbox.disabled = true;
        checkbox.closest(".layer-row")?.setAttribute("title", "Layer gagal dimuat");
      }
    } finally {
      updateStatus();
    }
  }

  Promise.allSettled(CONFIG.map(loadLayer)).then(() => {
    if (allBounds.isValid()) {
      map.fitBounds(allBounds, { padding: [24, 24] });
    }
    requestAnimationFrame(() => map.invalidateSize(true));
    setTimeout(() => map.invalidateSize(true), 300);
    setTimeout(() => map.invalidateSize(true), 1000);
  });

  function fitAll() {
    if (allBounds.isValid()) map.fitBounds(allBounds, { padding: [24, 24] });
    else map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
  }

  document.getElementById("fit-all")?.addEventListener("click", fitAll);
  document.getElementById("reset-map")?.addEventListener("click", () => {
    map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
  });

  document.getElementById("locate-me")?.addEventListener("click", () => {
    map.locate({ setView: true, maxZoom: 15, enableHighAccuracy: true });
  });

  map.on("locationfound", event => {
    L.circleMarker(event.latlng, {
      radius: 8,
      fillColor: "#7b1fa2",
      color: "#fff",
      weight: 2,
      fillOpacity: 1
    }).addTo(map).bindPopup("Lokasi Anda").openPopup();
  });

  map.on("locationerror", () => {
    alert("Lokasi tidak dapat ditemukan. Pastikan izin lokasi browser aktif.");
  });

  const searchInput = document.getElementById("search-input");

  function searchLocation() {
    const query = searchInput.value.trim().toLowerCase();
    if (query.length < 2) return;

    const result = searchable.find(item => item.text.includes(query));

    if (!result) {
      searchInput.style.borderColor = "#c62828";
      return;
    }

    searchInput.style.borderColor = "#079cde";

    if (!map.hasLayer(result.parent)) result.parent.addTo(map);

    if (result.layer.getLatLng) {
      map.setView(result.layer.getLatLng(), 15);
    } else if (result.layer.getBounds) {
      const bounds = result.layer.getBounds();
      if (bounds?.isValid()) {
        map.fitBounds(bounds, { padding: [35, 35], maxZoom: 15 });
      }
    }

    result.layer.openPopup();
    window.YG_UI?.closeMobileSidebar();
  }

  document.getElementById("search-button")?.addEventListener("click", searchLocation);
  searchInput?.addEventListener("keydown", event => {
    if (event.key === "Enter") searchLocation();
  });

  window.addEventListener("resize", () => {
    clearTimeout(window.__ygResizeTimer);
    window.__ygResizeTimer = setTimeout(() => map.invalidateSize(true), 180);
  });

  document.addEventListener("fullscreenchange", () => {
    setTimeout(() => map.invalidateSize(true), 180);
  });

  window.YG_MAP = { map, fitAll, layerObjects };
})();
