(() => {
  "use strict";

  const DEFAULT_VIEW = [1.25, 102.05];
  const LAYERS = [
    { id: "area_mangrove", label: "Area Penanaman Mangrove", program: "mangrove", color: "#078a72", type: "polygon", visible: true },
    { id: "area_kopi", label: "Wilayah Penanaman Kopi", program: "livelihood", color: "#76513b", type: "polygon", visible: true },
    { id: "kopi", label: "Titik Kopi Liberika", program: "livelihood", color: "#9b6a44", type: "point", visible: true },
    { id: "apo", label: "Alat Pemecah Ombak", program: "mangrove", color: "#d55743", type: "line", visible: true },
    { id: "nursery_mangrove", label: "Rumah Pembibitan", program: "mangrove", color: "#86a437", type: "point", visible: true },
    { id: "fdrs", label: "FDRS", program: "fire", color: "#e47f2c", type: "point", visible: true },
    { id: "sekat_kanal", label: "Sekat Kanal", program: "peatland", color: "#1687a0", type: "point", visible: true },
    { id: "desa_intervensi", label: "Wilayah Intervensi", program: "administration", color: "#377d4c", type: "polygon", visible: false },
    { id: "titik_desa", label: "Titik Lokasi", program: "administration", color: "#3e79bd", type: "point", visible: false }
  ];

  const PROGRAMS = {
    mangrove: { label: "Restorasi Mangrove", caption: "Pesisir dan konservasi mangrove" },
    peatland: { label: "Restorasi Gambut", caption: "Pembasahan dan perlindungan gambut" },
    fire: { label: "Pencegahan Kebakaran", caption: "Pemantauan risiko karhutla" },
    livelihood: { label: "Penghidupan Berkelanjutan", caption: "Agroforestri dan usaha masyarakat" },
    administration: { label: "Administrasi", caption: "Konteks wilayah" }
  };

  const CATALOG = {
    donors: [
      { id: "aramco-asia-singapore", name: "Aramco Asia Singapore", aliases: ["Aramco", "AAS"] },
      { id: "ppcf", name: "Pan Pacific Conservation Foundation", aliases: ["PPCF"] }
    ],
    projects: [
      { id: "aramco-mangrove-p1", name: "Community-Based Mangrove Protection and Planting — Phase 1", program: "mangrove", donor: "aramco-asia-singapore", period: "Juni 2023–Mei 2024", places: ["Buruk Bakul"] },
      { id: "aramco-mangrove-p2", name: "Community-Based Mangrove Protection and Planting — Phase 2", program: "mangrove", donor: "aramco-asia-singapore", period: "Juni 2024–Mei 2025", places: ["Buruk Bakul", "Kelapa Pati"] },
      { id: "aramco-mangrove-p3", name: "Community-Based Mangrove Protection and Planting — Phase 3", program: "mangrove", donor: "aramco-asia-singapore", period: "2025–2026", places: ["Sepahat", "Tanjung Kuras"] }
    ],
    sources: [
      { type: "Baseline", title: "Final Baseline Mangrove 2024", scope: "Buruk Bakul dan Kelapa Pati" },
      { type: "Project report", title: "Aramco Phase 1 Final Report", scope: "Juni 2023–Mei 2024" },
      { type: "Project report", title: "Aramco Phase 2 Final Report", scope: "Juni 2024–Mei 2025" },
      { type: "Operations", title: "Restorasi Yayasan Gambut", scope: "12 kelompok data operasional" },
      { type: "Publication", title: "Annual Report 2025", scope: "Capaian dan dokumentasi" }
    ],
    monitoring: {
      "buruk bakul": [
        { project: "Phase 1", period: "2023–2024", survival: "bervariasi per sub-lokasi", note: "Monitoring komunitas dan replanting" },
        { project: "Phase 2 · Tambak Udang", period: "2024–2025", survival: "100%", note: "8.566 bibit dilaporkan tumbuh" },
        { project: "Phase 2 · Wave Breaker", period: "2025", survival: "25,3%", note: "Mortalitas dipengaruhi teritip dan genangan" }
      ],
      "kelapa pati": [
        { project: "Phase 2", period: "2024–2025", survival: "±99%", note: "4.992 dari 5.025 bibit dilaporkan hidup" }
      ]
    }
  };

  const state = {
    mapLayers: new Map(),
    records: [],
    bounds: L.latLngBounds([]),
    selected: null,
    filters: { program: "", donor: "", regency: "" },
    loaded: 0
  };

  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const normalize = value => String(value || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const getFirst = (p, keys) => keys.map(key => p[key]).find(value => value !== undefined && value !== null && String(value).trim() !== "") || "";
  const getName = p => getFirst(p, ["Nama_Objek", "NAMA_OBJEK", "title", "Nama", "NAMOBJ", "NAMA_DESA", "Desa", "WADMKD", "Keterangan"]) || "Objek program";
  const getVillage = p => getFirst(p, ["Desa", "desa", "Village", "village", "WADMKD", "NAMA_DESA"]);
  const getRegency = p => getFirst(p, ["Kabupaten", "kabupaten", "Regency", "regency", "WADMKK", "KABUPATEN"]);
  const getDonor = p => getFirst(p, ["Donor", "donor", "Funder", "funder", "Pendana", "pendana"]);
  const cleanLabel = key => ({
    Object_ID: "Object UUID", OBJECT_ID: "Object UUID", Nama_Objek: "Nama objek", WADMKD: "Desa",
    WADMKC: "Kecamatan", WADMKK: "Kabupaten", Tahun: "Tahun", Luas_Ha: "Luas",
    Jumlah_Bibit: "Jumlah bibit", Fase: "Fase", Keterangan: "Keterangan", Donor: "Donor"
  }[key] || key.replace(/_/g, " "));
  const hiddenKey = key => /^(OBJECTID|FID|FID_1|SRS_ID|Shape_|KODE_|X$|Y$|No$|No_)$/i.test(key);

  function stableUuid(layerId, properties, index) {
    const existing = getFirst(properties, ["Object_ID", "OBJECT_ID", "object_id", "UUID", "uuid", "id"]);
    if (existing) return String(existing);
    const seed = `${layerId}|${getName(properties)}|${getVillage(properties)}|${index}`;
    let hash = 2166136261;
    for (let i = 0; i < seed.length; i += 1) hash = Math.imul(hash ^ seed.charCodeAt(i), 16777619);
    return `YG-${layerId.toUpperCase().replace(/[^A-Z0-9]/g, "-")}-${(hash >>> 0).toString(16).padStart(8, "0").toUpperCase()}`;
  }

  function donorFor(record) {
    const direct = getDonor(record.properties);
    if (direct) return CATALOG.donors.find(d => [d.name, ...d.aliases].some(alias => normalize(alias) === normalize(direct)))?.id || normalize(direct);
    const village = normalize(record.village);
    const project = CATALOG.projects.find(item => item.program === record.config.program && item.places.some(place => normalize(place) === village));
    return project?.donor || "";
  }

  function projectFor(record) {
    const village = normalize(record.village);
    const phase = normalize(getFirst(record.properties, ["Fase", "fase", "Phase", "phase", "Keterangan"]));
    return CATALOG.projects.find(item => item.program === record.config.program
      && item.places.some(place => normalize(place) === village)
      && (!phase || normalize(item.name).includes(phase.replace("fase", "phase")))) || null;
  }

  const map = L.map("map", { preferCanvas: true, zoomControl: true, minZoom: 5 }).setView(DEFAULT_VIEW, 9);
  const baseMaps = {
    "Peta jalan": L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }),
    "Satelit Esri": L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { maxZoom: 19, attribution: "Tiles © Esri" })
  };
  baseMaps["Satelit Esri"].addTo(map);
  L.control.layers(baseMaps, null, { position: "topright" }).addTo(map);
  L.control.scale({ imperial: false, position: "bottomright" }).addTo(map);

  function renderLayerList() {
    $("program-layers").innerHTML = LAYERS.map(config => `<label class="layer-item" style="--layer:${config.color}">
      <span class="layer-symbol ${config.type}"></span>
      <span><strong>${esc(config.label)}</strong><small>${esc(PROGRAMS[config.program].label)}</small></span>
      <input type="checkbox" data-layer="${config.id}" ${config.visible ? "checked" : ""}>
      <i></i>
    </label>`).join("");
  }

  function styleFor(config) {
    return { color: config.color, fillColor: config.color, fillOpacity: config.type === "line" ? 0.08 : 0.24, weight: config.type === "line" ? 4 : 2, opacity: 0.95 };
  }

  function pointFor(config, latlng) {
    return L.circleMarker(latlng, { radius: 7, color: "#fff", weight: 2, fillColor: config.color, fillOpacity: 0.96 });
  }

  async function loadLayer(config) {
    try {
      const response = await fetch(`../data/${config.id}.geojson`, { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      let group;
      group = L.geoJSON(data, {
        style: () => styleFor(config),
        pointToLayer: (_feature, latlng) => pointFor(config, latlng),
        onEachFeature: (feature, leafletLayer) => {
          const properties = feature.properties || {};
          const record = {
            uuid: stableUuid(config.id, properties, state.records.length),
            name: getName(properties), village: getVillage(properties), regency: getRegency(properties),
            properties, feature, leafletLayer, group: null, config
          };
          record.donor = donorFor(record);
          record.project = projectFor(record);
          record.search = normalize([record.name, record.village, record.regency, config.label, PROGRAMS[config.program].label, record.project?.name, donorName(record.donor), ...Object.values(properties)].join(" "));
          state.records.push(record);
          leafletLayer.on("click", () => openRecord({ ...record, group }));
        }
      });
      state.mapLayers.set(config.id, group);
      group.eachLayer(layer => {
        const record = state.records.find(item => item.leafletLayer === layer);
        if (record) record.group = group;
      });
      if (config.visible) group.addTo(map);
      const bounds = group.getBounds();
      if (bounds.isValid()) state.bounds.extend(bounds);
    } catch (error) {
      console.error(`Gagal memuat ${config.id}`, error);
      document.querySelector(`[data-layer="${config.id}"]`)?.closest(".layer-item")?.classList.add("error");
    } finally {
      state.loaded += 1;
      $("data-status").textContent = state.loaded === LAYERS.length ? `${state.records.length} objek siap dijelajahi` : `Memuat layer ${state.loaded} dari ${LAYERS.length}…`;
    }
  }

  function donorName(id) {
    return CATALOG.donors.find(item => item.id === id)?.name || id || "";
  }

  function passesFilters(record) {
    return (!state.filters.program || record.config.program === state.filters.program)
      && (!state.filters.donor || record.donor === state.filters.donor)
      && (!state.filters.regency || normalize(record.regency) === state.filters.regency);
  }

  function applyFilters() {
    state.records.forEach(record => {
      const visible = passesFilters(record);
      if (record.leafletLayer.setStyle) record.leafletLayer.setStyle({ opacity: visible ? 0.95 : 0.08, fillOpacity: visible ? (record.config.type === "line" ? 0.08 : 0.24) : 0.02 });
      if (record.leafletLayer.setRadius) record.leafletLayer.setRadius(visible ? 7 : 3);
      record.leafletLayer.options.interactive = visible;
    });
    updateDashboard();
    renderSearch($("search-input").value);
  }

  function updateDashboard() {
    const filtered = state.records.filter(passesFilters);
    $("metric-objects").textContent = filtered.length.toLocaleString("id-ID");
    $("metric-projects").textContent = new Set(filtered.map(r => r.project?.id).filter(Boolean)).size.toLocaleString("id-ID");
    $("metric-donors").textContent = new Set(filtered.map(r => r.donor).filter(Boolean)).size.toLocaleString("id-ID");
    const area = filtered.filter(r => r.config.id === "area_mangrove").reduce((sum, record) => {
      const value = Number(getFirst(record.properties, ["Luas_Ha", "LUAS_HA", "luas_ha", "Luas", "luas"]) || 0);
      return sum + (Number.isFinite(value) ? value : 0);
    }, 0);
    $("metric-area").textContent = area ? `${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(area)} ha` : "—";
    const visible = filtered.filter(record => map.hasLayer(state.mapLayers.get(record.config.id))).length;
    $("visible-count").textContent = `${visible.toLocaleString("id-ID")} objek tampil`;
    $("active-count").textContent = [...state.mapLayers.values()].filter(layer => map.hasLayer(layer)).length;
  }

  function populateFilters() {
    const options = (items, value, label) => items.map(item => `<option value="${esc(value(item))}">${esc(label(item))}</option>`).join("");
    $("program-filter").insertAdjacentHTML("beforeend", options(Object.entries(PROGRAMS).filter(([id]) => id !== "administration"), ([id]) => id, ([, p]) => p.label));
    $("donor-filter").insertAdjacentHTML("beforeend", options(CATALOG.donors, d => d.id, d => d.name));
    const regencies = [...new Set(state.records.map(r => r.regency).filter(Boolean))].sort((a, b) => a.localeCompare(b, "id"));
    $("regency-filter").insertAdjacentHTML("beforeend", options(regencies, r => normalize(r), r => r));
  }

  function renderSources() {
    $("source-summary").innerHTML = CATALOG.sources.slice(0, 4).map(source => `<div><b>${esc(source.type)}</b><span>${esc(source.title)}</span></div>`).join("")
      + `<small>${CATALOG.sources.length} sumber inti tercatat · setiap nilai V2 menyimpan asal datanya.</small>`;
  }

  function openRecord(record) {
    state.selected = record;
    $("detail-program").textContent = PROGRAMS[record.config.program].label;
    $("detail-title").textContent = record.name;
    $("detail-location").textContent = [record.village, record.regency].filter(Boolean).join(", ") || "Lokasi belum dilengkapi";
    document.querySelectorAll("[data-tab]").forEach(button => button.classList.toggle("active", button.dataset.tab === "overview"));
    renderDetail("overview");
    $("detail-panel").classList.add("open");
    $("detail-panel").setAttribute("aria-hidden", "false");
    $("monitor-link").hidden = record.config.id !== "area_mangrove";
    if (!record.group || !map.hasLayer(record.group)) {
      const group = state.mapLayers.get(record.config.id);
      if (group) group.addTo(map);
    }
    focusRecord(record);
    closeSearch();
    closeMobilePanel();
  }

  function renderDetail(tab) {
    const record = state.selected;
    if (!record) return;
    if (tab === "overview") {
      const donor = donorName(record.donor) || "Belum diisi";
      const rows = [
        ["Object UUID", record.uuid],
        ["Program", PROGRAMS[record.config.program].label],
        ["Proyek", record.project?.name || "Belum ditautkan"],
        ["Donor", donor],
        ...Object.entries(record.properties).filter(([key, value]) => !hiddenKey(key) && value !== "" && value !== null && value !== undefined).slice(0, 10).map(([key, value]) => [cleanLabel(key), value])
      ];
      $("detail-body").innerHTML = `<div class="data-quality ${record.donor ? "complete" : ""}"><b>${record.donor ? "Identitas donor tersedia" : "Data donor belum diisi"}</b><span>${record.donor ? "Objek sudah dapat dikelompokkan dalam portofolio donor." : "Lengkapi donor melalui editor objek agar masuk ke kluster donor."}</span></div>
        <div class="detail-fields">${rows.map(([key, value]) => `<div><b>${esc(key)}</b><span>${esc(value)}</span></div>`).join("")}</div>`;
    } else if (tab === "monitoring") {
      const events = CATALOG.monitoring[normalize(record.village)] || [];
      $("detail-body").innerHTML = events.length ? `<div class="timeline">${events.map(event => `<article><i></i><div><small>${esc(event.period)}</small><b>${esc(event.project)}</b><strong>Survival ${esc(event.survival)}</strong><p>${esc(event.note)}</p></div></article>`).join("")}</div>` : emptyState("Belum ada monitoring terstruktur", "Monitoring baru akan terhubung ke UUID objek ini.");
    } else if (tab === "media") {
      $("detail-body").innerHTML = emptyState("Media belum dimigrasikan", "Foto dari laporan dan kegiatan akan ditautkan ke objek, kegiatan, atau monitoring tanpa duplikasi.");
    } else {
      const related = CATALOG.sources.filter(source => normalize(`${source.title} ${source.scope}`).includes(normalize(record.village)) || source.type === "Operations");
      $("detail-body").innerHTML = `<div class="source-list">${(related.length ? related : CATALOG.sources.slice(0, 2)).map(source => `<article><span>${esc(source.type)}</span><b>${esc(source.title)}</b><small>${esc(source.scope)}</small></article>`).join("")}</div>`;
    }
  }

  function emptyState(title, copy) {
    return `<div class="empty-state"><span>◎</span><b>${esc(title)}</b><p>${esc(copy)}</p></div>`;
  }

  function focusRecord(record) {
    const layer = record.leafletLayer;
    if (layer.getLatLng) map.setView(layer.getLatLng(), 16);
    else if (layer.getBounds && layer.getBounds().isValid()) map.fitBounds(layer.getBounds(), { padding: [48, 48], maxZoom: 16 });
  }

  function renderSearch(query = "") {
    const term = normalize(query);
    const matches = state.records.filter(record => passesFilters(record) && (!term || record.search.includes(term))).slice(0, 40);
    $("search-total").textContent = `${matches.length} hasil`;
    $("search-results").innerHTML = matches.length ? matches.map(record => `<button type="button" data-uuid="${esc(record.uuid)}" style="--result:${record.config.color}"><i></i><span><strong>${esc(record.name)}</strong><small>${esc([record.village, PROGRAMS[record.config.program].label, donorName(record.donor)].filter(Boolean).join(" · "))}</small></span><em>Lihat →</em></button>`).join("") : `<div class="search-empty">Tidak ada data yang sesuai.</div>`;
  }

  function openSearch() {
    $("search-dialog").hidden = false;
    renderSearch($("search-input").value);
    setTimeout(() => $("search-input").focus(), 20);
  }
  function closeSearch() { $("search-dialog").hidden = true; }
  function closeDetail() { $("detail-panel").classList.remove("open"); $("detail-panel").setAttribute("aria-hidden", "true"); }
  function closeMobilePanel() { $("sidebar").classList.remove("open"); }

  renderLayerList();
  renderSources();

  document.addEventListener("change", event => {
    if (event.target.matches("[data-layer]")) {
      const layer = state.mapLayers.get(event.target.dataset.layer);
      if (layer) event.target.checked ? layer.addTo(map) : map.removeLayer(layer);
      updateDashboard();
    }
    if (event.target.id === "program-filter") state.filters.program = event.target.value;
    if (event.target.id === "donor-filter") state.filters.donor = event.target.value;
    if (event.target.id === "regency-filter") state.filters.regency = event.target.value;
    if (event.target.matches("#program-filter,#donor-filter,#regency-filter")) applyFilters();
  });

  document.querySelectorAll("[data-tab]").forEach(button => button.addEventListener("click", () => {
    document.querySelectorAll("[data-tab]").forEach(item => item.classList.toggle("active", item === button));
    renderDetail(button.dataset.tab);
  }));
  $("search-open").addEventListener("click", openSearch);
  document.querySelector("[data-search-close]").addEventListener("click", closeSearch);
  $("search-input").addEventListener("input", event => renderSearch(event.target.value));
  $("search-results").addEventListener("click", event => {
    const button = event.target.closest("[data-uuid]");
    if (button) openRecord(state.records.find(record => record.uuid === button.dataset.uuid));
  });
  $("detail-close").addEventListener("click", closeDetail);
  $("detail-zoom").addEventListener("click", () => state.selected && focusRecord(state.selected));
  $("fit-all").addEventListener("click", () => state.bounds.isValid() && map.fitBounds(state.bounds, { padding: [28, 28], maxZoom: 11 }));
  $("reset-filter").addEventListener("click", () => {
    state.filters = { program: "", donor: "", regency: "" };
    ["program-filter", "donor-filter", "regency-filter"].forEach(id => $(id).value = "");
    applyFilters();
  });
  $("toggle-layers").addEventListener("click", event => {
    const anyVisible = [...state.mapLayers.values()].some(layer => map.hasLayer(layer));
    state.mapLayers.forEach((layer, id) => {
      anyVisible ? map.removeLayer(layer) : layer.addTo(map);
      const input = document.querySelector(`[data-layer="${id}"]`);
      if (input) input.checked = !anyVisible;
    });
    event.currentTarget.textContent = anyVisible ? "Aktifkan semua" : "Matikan semua";
    updateDashboard();
  });
  $("locate").addEventListener("click", () => map.locate({ setView: true, maxZoom: 16, enableHighAccuracy: true }));
  map.on("locationfound", e => L.circleMarker(e.latlng, { radius: 8, color: "#fff", weight: 3, fillColor: "#0b5d47", fillOpacity: 1 }).addTo(map).bindPopup("Lokasi Anda").openPopup());
  map.on("locationerror", () => toast("Lokasi tidak tersedia. Periksa izin browser."));
  $("fullscreen").addEventListener("click", async () => {
    try { document.fullscreenElement ? await document.exitFullscreen() : await document.documentElement.requestFullscreen(); } catch (_) { toast("Mode layar penuh tidak tersedia."); }
  });
  ["mobile-panel", "map-panel-trigger"].forEach(id => $(id).addEventListener("click", () => $("sidebar").classList.toggle("open")));
  document.addEventListener("keydown", event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); openSearch(); }
    if (event.key === "Escape") { closeSearch(); closeDetail(); }
  });

  let toastTimer;
  function toast(message) {
    clearTimeout(toastTimer);
    $("toast").textContent = message;
    $("toast").classList.add("show");
    toastTimer = setTimeout(() => $("toast").classList.remove("show"), 2800);
  }

  Promise.allSettled(LAYERS.map(loadLayer)).then(() => {
    populateFilters();
    applyFilters();
    if (state.bounds.isValid()) map.fitBounds(state.bounds, { padding: [28, 28], maxZoom: 11 });
    $("data-status").textContent = `${state.records.length} objek dari ${LAYERS.length} layer siap dijelajahi`;
    document.querySelector(".sync-state").classList.add("ready");
    renderSearch();
    setTimeout(() => map.invalidateSize(), 100);
  });
})();
