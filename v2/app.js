(() => {
  "use strict";

  const API = "https://script.google.com/macros/s/AKfycbxUe4QyBvSiL9UJsL-nsJ5XrohDabwqhYYR9q5CTgLYiW1ZCfVy429iMlpU-lCDUSvvRg/exec?page=objects";
  const DEFAULT_VIEW = [1.25, 102.05];
  const DEFAULT_ZOOM = 9;
  const LAYERS = [
    { id: "desa_intervensi", label: "Desa Intervensi", caption: "Batas wilayah program", color: "#2f7d4c", type: "polygon", visible: true, staticFile: "desa_intervensi.geojson" },
    { id: "area_mangrove", label: "Penanaman Mangrove", caption: "Area rehabilitasi pesisir resmi", color: "#168b78", type: "polygon", visible: true, staticFile: "area_mangrove.geojson" },
    { id: "apo", label: "Pemecah Ombak", caption: "Infrastruktur perlindungan pesisir", color: "#d05b45", type: "line", visible: true },
    { id: "monitoring_reports", label: "Monitoring Terverifikasi", caption: "Hasil pemantauan lapangan", color: "#f9a825", type: "polygon", visible: true },
    { id: "community_reports", label: "Laporan Masyarakat", caption: "Laporan publik terverifikasi", color: "#7b1fa2", type: "point", visible: true },
    { id: "forest_land_restoration", label: "Restorasi Hutan & Lahan", caption: "Lokasi pemulihan ekosistem", color: "#388e3c", type: "polygon", visible: true },
    { id: "nursery_coffee", label: "Rumah Pembibitan Kopi", caption: "Pembibitan tanaman lahan gambut", color: "#795548", type: "point", visible: true },
    { id: "information_signs", label: "Plang Informasi", caption: "Informasi dan perlindungan kawasan", color: "#5e35b1", type: "point", visible: true },
    { id: "supporting_infrastructure", label: "Infrastruktur Pendukung", caption: "Sarana pendukung program", color: "#546e7a", type: "point", visible: true },
    { id: "area_kopi", label: "Wilayah Penanaman Kopi", caption: "Area agroforestri dan kopi", color: "#8e5a2b", type: "polygon", visible: true, staticFile: "area_kopi.geojson" },
    { id: "kopi", label: "Distribusi Kopi", caption: "Penguatan ekonomi masyarakat", color: "#79573d", type: "point", visible: true },
    { id: "fdrs", label: "FDRS / Water Table", caption: "Pemantauan risiko kebakaran", color: "#e58a3d", type: "point", visible: true },
    { id: "sekat_kanal", label: "Sekat Kanal", caption: "Infrastruktur pembasahan gambut", color: "#16829a", type: "point", visible: true },
    { id: "nursery_mangrove", label: "Pembibitan Mangrove", caption: "Rumah bibit masyarakat", color: "#91a83f", type: "point", visible: true },
    { id: "titik_desa", label: "Titik Desa", caption: "Pusat desa intervensi", color: "#397ac2", type: "point", visible: false }
  ];
  const REFERENCES = [
    { id: "kawasan_hutan_sk_903", file: "kawasan_hutan_sk_903.geojson", label: "Kawasan Hutan SK 903", caption: "Referensi fungsi kawasan", color: "#56645f", type: "polygon" },
    { id: "gambut_bbsdlp_2019", file: "Gambut_BBSDLP_2019.geojson", label: "Peta Gambut BBSDLP 2019", caption: "Referensi sebaran gambut", color: "#6d4c3d", type: "polygon" },
    { id: "iuphhk_ht_2014", file: "IUPHHK_HT_2014.geojson", label: "IUPHHK-HT 2014", caption: "Referensi perizinan pemanfaatan hutan", color: "#c62828", type: "polygon" },
    { id: "perhutanan_sosial_riau", file: "PERHUTANAN_SOSIAL_RIAU.geojson", label: "Perhutanan Sosial Riau", caption: "Referensi akses kelola masyarakat", color: "#00897b", type: "polygon" }
  ];
  const allConfigs = [...LAYERS, ...REFERENCES];
  const state = { layers: new Map(), features: [], bounds: L.latLngBounds([]), selected: null, loading: 0, databaseUpdated: "" };
  let masterDataPromise = null;

  const map = L.map("map", { preferCanvas: true, zoomControl: true, minZoom: 5 }).setView(DEFAULT_VIEW, DEFAULT_ZOOM);
  const baseMaps = {
    "Peta jalan": L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }),
    "Satelit": L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { maxZoom: 19, attribution: "Tiles © Esri" })
  };
  baseMaps["Peta jalan"].addTo(map);
  L.control.layers(baseMaps, null, { position: "topright" }).addTo(map);
  L.control.scale({ imperial: false, position: "bottomright" }).addTo(map);

  const $ = id => document.getElementById(id);
  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const cleanLabel = key => ({ NAMOBJ: "Nama desa", WADMKD: "Desa", WADMKC: "Kecamatan", WADMKK: "Kabupaten", WADMPR: "Provinsi", Luas_Ha: "Luas", Panjang_M: "Panjang", Ket: "Keterangan", Keterangan: "Keterangan", Tahun: "Tahun", Desa: "Desa", Kabupaten: "Kabupaten", Kecamatan: "Kecamatan" }[key] || key.replace(/_/g, " "));
  const hiddenKey = key => /^(OBJECTID|FID|FID_1|SRS_ID|Shape_|KODE_|X$|Y$|Id$|No$)/i.test(key);
  const featureName = feature => {
    const p = feature.properties || {};
    return p.Nama_Objek || p.title || p.NAMA_PRH || p.NAMA_HKM || p.NAMOBJ || p.NAMA_DESA || p.Desa || p.WADMKD || p.Keterangan || "Objek program";
  };

  function layerRow(config, reference = false) {
    return `<div class="layer-item" style="--layer:${config.color}">
      <span class="layer-symbol"><i class="${config.type}"></i></span>
      <span class="layer-copy"><strong>${escapeHtml(config.label)}</strong><small>${escapeHtml(config.caption)}</small></span>
      <label class="switch" title="Aktifkan ${escapeHtml(config.label)}"><input type="checkbox" data-layer="${config.id}" ${config.visible ? "checked" : ""}><span></span></label>
    </div>`;
  }

  $("program-layers").innerHTML = LAYERS.map(config => layerRow(config)).join("");
  $("reference-layers").innerHTML = REFERENCES.map(config => layerRow(config, true)).join("");

  function styleFor(config) {
    return { color: config.color, fillColor: config.color, fillOpacity: config.type === "line" ? 0.08 : 0.23, weight: config.type === "line" ? 4 : 1.8, opacity: 0.92 };
  }

  function pointFor(config, latlng) {
    return L.circleMarker(latlng, { radius: 7, color: "#fff", weight: 2, fillColor: config.color, fillOpacity: 0.96 });
  }

  function addSearchFeature(feature, leafletLayer, parentLayer, config) {
    const properties = feature.properties || {};
    state.features.push({
      name: String(featureName(feature)),
      text: `${config.label} ${Object.values(properties).join(" ")}`.toLowerCase(),
      feature, leafletLayer, parentLayer, config
    });
  }

  function openFeature(item) {
    if (!map.hasLayer(item.parentLayer)) {
      item.parentLayer.addTo(map);
      const input = document.querySelector(`[data-layer="${item.config.id}"]`);
      if (input) input.checked = true;
    }
    state.selected = item;
    const p = item.feature.properties || {};
    $("detail-category").textContent = item.config.caption;
    $("detail-layer").textContent = item.config.label;
    $("detail-title").textContent = item.name;
    $("detail-cover").style.setProperty("--detail-color", item.config.color);
    const rows = Object.entries(p).filter(([key, value]) => !hiddenKey(key) && value !== null && value !== "" && typeof value !== "undefined").slice(0, 14);
    const knownArea = Number(p.Luas_Ha || p.LUAS_HA || p.LUAS_POLI || p.LUAS_UKURA || 0);
    const calculatedArea = geometryAreaHa(item.feature.geometry);
    if ((!Number.isFinite(knownArea) || knownArea <= 0) && calculatedArea > 0) {
      rows.push(["Luas_Poligon_Otomatis_Ha", new Intl.NumberFormat("id-ID", {
        maximumFractionDigits: 2
      }).format(calculatedArea)]);
    }
    $("detail-fields").innerHTML = rows.length ? rows.map(([key, value]) => `<div class="detail-row"><b>${escapeHtml(cleanLabel(key))}</b><span>${escapeHtml(value)}</span></div>`).join("") : '<div class="detail-row"><span>Informasi atribut belum tersedia.</span></div>';
    $("detail-panel").classList.add("open");
    $("detail-panel").setAttribute("aria-hidden", "false");
    focusLayer(item.leafletLayer);
    closeSearch();
    closeMobileSidebar();
  }

  function focusLayer(layer) {
    if (layer.getLatLng) map.setView(layer.getLatLng(), 15);
    else if (layer.getBounds && layer.getBounds().isValid()) map.fitBounds(layer.getBounds(), { padding: [45, 45], maxZoom: 15 });
  }

  async function loadMasterData() {
    if (!masterDataPromise) {
      masterDataPromise = fetch(API + "&t=" + Date.now(), {
        cache: "no-store",
        redirect: "follow"
      }).then(response => {
        if (!response.ok) throw new Error("Master Database HTTP " + response.status);
        return response.json();
      }).then(data => {
        if (!data || !Array.isArray(data.features)) {
          throw new Error("Format Master Database tidak valid");
        }
        state.databaseUpdated = data.updatedAt || data.lastUpdated || "";
        return data;
      });
    }
    return masterDataPromise;
  }

  function layerIdOf(feature) {
    const p = feature && feature.properties || {};
    return String(p.Layer_ID || p.Source_Layer || "").trim().toLowerCase();
  }

  async function dataFor(config) {
    const reference = REFERENCES.some(item => item.id === config.id);
    if (reference || config.staticFile) {
      const file = reference ? config.file : config.staticFile;
      const response = await fetch("../data/" + file + "?v=20260721-v2", {
        cache: "no-store"
      });
      if (!response.ok) throw new Error("HTTP " + response.status);
      return response.json();
    }

    const database = await loadMasterData();
    return {
      type: "FeatureCollection",
      features: database.features.filter(feature =>
        layerIdOf(feature) === config.id
      )
    };
  }

  function ringAreaSquareMeters(ring) {
    if (!Array.isArray(ring) || ring.length < 3) return 0;
    const radius = 6378137;
    const radians = Math.PI / 180;
    let area = 0;
    for (let index = 0; index < ring.length; index += 1) {
      const current = ring[index];
      const next = ring[(index + 1) % ring.length];
      if (!current || !next) continue;
      area += (next[0] - current[0]) * radians *
        (2 + Math.sin(current[1] * radians) + Math.sin(next[1] * radians));
    }
    return Math.abs(area * radius * radius / 2);
  }

  function polygonAreaSquareMeters(rings) {
    if (!Array.isArray(rings) || !rings.length) return 0;
    return Math.max(0, ringAreaSquareMeters(rings[0]) -
      rings.slice(1).reduce((sum, ring) => sum + ringAreaSquareMeters(ring), 0));
  }

  function geometryAreaHa(geometry) {
    if (!geometry || !Array.isArray(geometry.coordinates)) return 0;
    const squareMeters = geometry.type === "Polygon"
      ? polygonAreaSquareMeters(geometry.coordinates)
      : geometry.type === "MultiPolygon"
        ? geometry.coordinates.reduce((sum, polygon) =>
            sum + polygonAreaSquareMeters(polygon), 0)
        : 0;
    return squareMeters / 10000;
  }

  async function loadLayer(config, shouldShow = config.visible) {
    if (state.layers.has(config.id)) {
      const existing = state.layers.get(config.id);
      if (shouldShow && !map.hasLayer(existing)) existing.addTo(map);
      return existing;
    }
    const input = document.querySelector(`[data-layer="${config.id}"]`);
    if (input) input.disabled = true;
    state.loading += 1;
    setStatus();
    try {
      const data = await dataFor(config);
      if (!data || !Array.isArray(data.features)) {
        throw new Error("GeoJSON tidak valid");
      }
      let geoLayer;
      geoLayer = L.geoJSON(data, {
        style: () => styleFor(config),
        pointToLayer: (_feature, latlng) => pointFor(config, latlng),
        onEachFeature: (feature, featureLayer) => {
          const item = { name: featureName(feature), feature, leafletLayer: featureLayer, parentLayer: null, config };
          featureLayer.on("click", () => openFeature({ ...item, parentLayer: geoLayer }));
          featureLayer.on("mouseover", event => { if (event.target.setStyle) event.target.setStyle({ weight: config.type === "line" ? 6 : 3, fillOpacity: 0.36 }); });
          featureLayer.on("mouseout", event => { if (geoLayer.resetStyle) geoLayer.resetStyle(event.target); });
          addSearchFeature(feature, featureLayer, geoLayer, config);
        }
      });
      state.layers.set(config.id, geoLayer);
      const bounds = geoLayer.getBounds();
      if (bounds.isValid() && !REFERENCES.some(item => item.id === config.id)) state.bounds.extend(bounds);
      if (shouldShow) geoLayer.addTo(map);
      if (input) input.checked = shouldShow;
      updateMetrics();
      return geoLayer;
    } catch (error) {
      console.error(`Gagal memuat ${config.id}`, error);
      if (input) { input.checked = false; input.closest(".layer-item").title = "Layer gagal dimuat"; }
      toast(`Layer ${config.label} gagal dimuat`);
      throw error;
    } finally {
      state.loading -= 1;
      if (input) input.disabled = false;
      setStatus();
      updateVisibleCount();
    }
  }

  function setStatus() {
    const loaded = state.layers.size;
    const text = state.loading ? `Memuat ${state.loading} layer…` : `${loaded} layer siap dijelajahi`;
    $("data-status").textContent = text;
    $("data-dot").parentElement.classList.toggle("ready", state.loading === 0 && loaded > 0);
  }

  function featureCount(id) {
    const layer = state.layers.get(id);
    return layer ? layer.getLayers().length : 0;
  }

  function updateMetrics() {
    $("metric-villages").textContent = featureCount("desa_intervensi").toLocaleString("id-ID") || "—";
    $("metric-fdrs").textContent = featureCount("fdrs").toLocaleString("id-ID") || "—";
    $("metric-canal").textContent = featureCount("sekat_kanal").toLocaleString("id-ID") || "—";
    const mangrove = state.features.filter(item => item.config.id === "area_mangrove");
    const area = mangrove.reduce((sum, item) => {
      const p = item.feature.properties || {};
      const value = Number(p.Luas_Ha || p.LUAS_HA || p.luas_ha || 0);
      return sum + (Number.isFinite(value) ? value : 0);
    }, 0);
    $("metric-mangrove").textContent = area > 0 ? `${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(area)} ha` : featureCount("area_mangrove").toLocaleString("id-ID") || "—";
  }

  function updateVisibleCount() {
    let count = 0;
    state.layers.forEach(layer => { if (map.hasLayer(layer)) count += layer.getLayers().length; });
    $("visible-feature-count").textContent = `${count.toLocaleString("id-ID")} objek tampil`;
    const active = [...state.layers.values()].filter(layer => map.hasLayer(layer)).length;
    $("active-layer-count").textContent = active;
  }

  document.addEventListener("change", async event => {
    const input = event.target.closest("[data-layer]");
    if (!input) return;
    const config = allConfigs.find(item => item.id === input.dataset.layer);
    if (!config) return;
    if (input.checked) {
      try { await loadLayer(config, true); } catch (_) { input.checked = false; }
    } else {
      const layer = state.layers.get(config.id);
      if (layer) map.removeLayer(layer);
    }
    updateVisibleCount();
  });

  function renderSearch(query = "") {
    const normalized = query.trim().toLowerCase();
    const matches = state.features.filter(item => !normalized || item.text.includes(normalized)).slice(0, 30);
    $("search-results").innerHTML = matches.length ? matches.map((item, index) => `<button class="search-result${index === 0 ? " active" : ""}" type="button" data-search-index="${state.features.indexOf(item)}" style="--result-color:${item.config.color}"><i class="search-result-dot"></i><span><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.config.label)}</small></span><em>Lihat →</em></button>`).join("") : `<div class="search-empty">Tidak ada lokasi yang cocok dengan “${escapeHtml(query)}”.</div>`;
  }

  function openSearch() {
    $("search-dialog").hidden = false;
    renderSearch($("search-input").value);
    setTimeout(() => $("search-input").focus(), 30);
  }
  function closeSearch() { $("search-dialog").hidden = true; }
  $("search-trigger").addEventListener("click", openSearch);
  document.querySelector("[data-close-search]").addEventListener("click", closeSearch);
  $("search-input").addEventListener("input", event => renderSearch(event.target.value));
  $("search-results").addEventListener("click", event => {
    const button = event.target.closest("[data-search-index]");
    if (button) openFeature(state.features[Number(button.dataset.searchIndex)]);
  });
  document.addEventListener("keydown", event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); openSearch(); }
    if (event.key === "Escape") { closeSearch(); closeDetail(); }
    if (event.key === "Enter" && !$("search-dialog").hidden) document.querySelector(".search-result")?.click();
  });

  function closeDetail() { $("detail-panel").classList.remove("open"); $("detail-panel").setAttribute("aria-hidden", "true"); }
  $("detail-close").addEventListener("click", closeDetail);
  $("detail-zoom").addEventListener("click", () => state.selected && focusLayer(state.selected.leafletLayer));
  $("fit-button").addEventListener("click", () => state.bounds.isValid() ? map.fitBounds(state.bounds, { padding: [30, 30] }) : map.setView(DEFAULT_VIEW, DEFAULT_ZOOM));
  document.querySelectorAll("[data-focus]").forEach(button => button.addEventListener("click", async () => {
    const config = allConfigs.find(item => item.id === button.dataset.focus);
    const layer = await loadLayer(config, true);
    if (layer.getBounds().isValid()) map.fitBounds(layer.getBounds(), { padding: [35, 35], maxZoom: 13 });
    updateVisibleCount();
  }));
  $("toggle-programs").addEventListener("click", () => {
    const visible = LAYERS.some(config => { const layer = state.layers.get(config.id); return layer && map.hasLayer(layer); });
    LAYERS.forEach(config => {
      const layer = state.layers.get(config.id);
      const input = document.querySelector(`[data-layer="${config.id}"]`);
      if (layer) visible ? map.removeLayer(layer) : layer.addTo(map);
      if (input && layer) input.checked = !visible;
    });
    $("toggle-programs").textContent = visible ? "Aktifkan semua" : "Matikan semua";
    updateVisibleCount();
  });
  $("locate-button").addEventListener("click", () => map.locate({ setView: true, maxZoom: 15, enableHighAccuracy: true }));
  map.on("locationfound", event => L.circleMarker(event.latlng, { radius: 8, color: "#fff", weight: 3, fillColor: "#123c2e", fillOpacity: 1 }).addTo(map).bindPopup("Lokasi Anda").openPopup());
  map.on("locationerror", () => toast("Lokasi tidak tersedia. Periksa izin lokasi browser."));
  $("fullscreen-button").addEventListener("click", async () => { try { if (!document.fullscreenElement) await document.documentElement.requestFullscreen(); else await document.exitFullscreen(); } catch (_) { toast("Mode layar penuh tidak tersedia"); } });
  map.on("zoomend", () => $("zoom-readout").textContent = `Zoom ${map.getZoom()}`);

  function toggleMobileSidebar() { $("sidebar").classList.toggle("open"); }
  function closeMobileSidebar() { $("sidebar").classList.remove("open"); }
  $("layers-mobile-button").addEventListener("click", toggleMobileSidebar);
  $("mobile-sheet-handle").addEventListener("click", toggleMobileSidebar);

  let toastTimer;
  function toast(message) { clearTimeout(toastTimer); $("toast").textContent = message; $("toast").classList.add("show"); toastTimer = setTimeout(() => $("toast").classList.remove("show"), 2800); }

  Promise.allSettled(LAYERS.map(config => loadLayer(config, config.visible))).then(() => {
    if (state.bounds.isValid()) map.fitBounds(state.bounds, { padding: [28, 28], maxZoom: 11 });
    setTimeout(() => map.invalidateSize(), 120);
    updateVisibleCount();
    renderSearch();
  });
})();
