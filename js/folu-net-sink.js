(function () {
  "use strict";

  const VERSION = "20260808-folu-portfolio1";
  const PATHWAY_COLORS = {
    ro1: "#2f6f4e",
    ro2: "#8b5e34",
    ro9: "#1d7286",
    ro10: "#527d3b",
    ro11: "#70579a",
    ro12: "#087653",
    "bidang-v": "#37516c"
  };
  const STATUS_LABELS = {
    verified: "Capaian terverifikasi",
    mapped: "Capaian terpetakan",
    supporting: "Kontribusi pendukung"
  };
  const ECOSYSTEM_LABELS = {
    mangrove: "Mangrove",
    peat: "Gambut & agroforestri",
    "social-forestry": "Perhutanan sosial",
    "cross-cutting": "Lintas tema"
  };
  const DOCUMENT_SCOPE_LABELS = {
    national: "Nasional & NDC",
    subnational: "Provinsi Riau",
    thematic: "Bidang tematik",
    law: "Peraturan aktif",
    yg: "Dokumen kerja YG"
  };

  const state = {
    data: null,
    datasets: null,
    metrics: null,
    contributionFilters: { search: "", pathway: "", ecosystem: "", status: "" },
    documentScope: "",
    mapFilters: { pathway: "", ecosystem: "", status: "" },
    map: null,
    mapGroup: null,
    mapItems: [],
    siteItems: new Map()
  };

  const elements = {
    position: document.getElementById("folu-position"),
    accountingNote: document.getElementById("folu-accounting-note"),
    statusKey: document.getElementById("folu-status-key"),
    pathways: document.getElementById("folu-pathways"),
    search: document.getElementById("folu-search"),
    pathway: document.getElementById("folu-pathway"),
    ecosystem: document.getElementById("folu-ecosystem"),
    status: document.getElementById("folu-status"),
    reset: document.getElementById("folu-reset"),
    resultCount: document.getElementById("folu-result-count"),
    contributions: document.getElementById("folu-contributions"),
    documentScope: document.getElementById("folu-document-scope"),
    documentCount: document.getElementById("folu-document-count"),
    documents: document.getElementById("folu-documents"),
    map: document.getElementById("folu-map"),
    mapPathway: document.getElementById("folu-map-pathway"),
    mapEcosystem: document.getElementById("folu-map-ecosystem"),
    mapStatus: document.getElementById("folu-map-status"),
    mapReset: document.getElementById("folu-map-reset"),
    mapCount: document.getElementById("folu-map-count"),
    locationList: document.getElementById("folu-location-list")
  };

  const escapeHtml = value => String(value ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  const normalize = value => String(value || "").toLowerCase().normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
  const features = collection => Array.isArray(collection && collection.features) ? collection.features : [];
  const properties = feature => feature && feature.properties ? feature.properties : {};
  const formatNumber = (value, maximumFractionDigits) => Number(value || 0).toLocaleString("id-ID", {
    maximumFractionDigits: maximumFractionDigits == null ? 0 : maximumFractionDigits
  });
  const sumProperty = (collection, keys) => features(collection).reduce((sum, feature) => {
    const props = properties(feature);
    const key = keys.find(candidate => props[candidate] !== null && props[candidate] !== undefined && props[candidate] !== "");
    return sum + (Number(key ? props[key] : 0) || 0);
  }, 0);
  const distinctProperty = (collection, keys) => [...new Set(features(collection).map(feature => {
    const props = properties(feature);
    const key = keys.find(candidate => props[candidate]);
    return key ? String(props[key]).trim() : "";
  }).filter(Boolean))];
  const pathwayById = id => state.data.pathways.find(pathway => pathway.id === id);

  function fetchJson(url) {
    return fetch(url + (url.includes("?") ? "&" : "?") + "v=" + VERSION, { cache: "no-store" })
      .then(response => {
        if (!response.ok) throw new Error("Gagal memuat " + url);
        return response.json();
      });
  }

  function calculateMetrics() {
    const d = state.datasets;
    const capacity = Array.isArray(d.capacity) ? d.capacity : [];
    const mangroveArea = sumProperty(d.mangrove, ["Luas_Ha", "luas_ha"]);
    const mangroveSeedlings = sumProperty(d.mangrove, ["Jumlah_Bib", "Jumlah_Bibit", "Jumlah_Tanam"]);
    const coffeePointPlants = sumProperty(d.coffee, ["Jumlah_Tanam", "Jumlah_Bibit"]);
    const coffeeAreaPlants = sumProperty(d.coffeeAreas, ["Jumlah_Tanam", "Jumlah_Bibit"]);
    const targetSocialForestry = features(d.socialForestry).filter(feature => {
      const name = normalize(properties(feature).NAMA_HKM);
      return name === "kth mandiri sejahtera" || name === "kth siarang arang";
    });
    const attendance = capacity.reduce((sum, item) => sum + Number(item.male || 0) + Number(item.female || 0), 0);
    const women = capacity.reduce((sum, item) => sum + Number(item.female || 0), 0);
    const men = capacity.reduce((sum, item) => sum + Number(item.male || 0), 0);
    const fireEvents = capacity.filter(item => /zero.?burning|karhutla|kebakaran|rspo|sawit di gambut/i.test([
      item.name, item.topic
    ].join(" ")));
    const livelihoodEvents = capacity.filter(item => /kopi|coffee|nipah|produk kreatif|ekowisata|ikan|gaplek|kompos|usaha/i.test([
      item.name, item.topic
    ].join(" ")));
    const physicalObjects = [d.mangrove, d.coffeeAreas, d.coffee, d.canalBlocks, d.fdrs, d.apo, d.mangroveNursery]
      .reduce((sum, collection) => sum + features(collection).length, 0) + targetSocialForestry.length;
    const mangroveVillages = distinctProperty(d.mangrove, ["Desa", "NAMOBJ"]);
    const coffeeVillages = [...new Set([
      ...distinctProperty(d.coffee, ["Desa", "NAMOBJ"]),
      ...distinctProperty(d.coffeeAreas, ["Desa", "NAMOBJ"])
    ])];

    state.metrics = {
      mangroveArea,
      mangroveSeedlings,
      mangroveVillages,
      agroforestryArea: sumProperty(d.coffeeAreas, ["Luas_Ha", "luas_ha"]),
      agroforestryPlants: coffeePointPlants + coffeeAreaPlants,
      agroforestryVillages: coffeeVillages,
      canalBlocks: features(d.canalBlocks).length,
      canalVillages: distinctProperty(d.canalBlocks, ["Desa", "NAMOBJ"]),
      fdrs: features(d.fdrs).length,
      fdrsVillages: distinctProperty(d.fdrs, ["Desa", "NAMOBJ"]),
      apoLength: sumProperty(d.apo, ["Panjang_M", "Panjang", "length_m"]),
      apoVillages: distinctProperty(d.apo, ["Desa", "NAMOBJ"]),
      capacityEvents: capacity.length,
      attendance,
      women,
      men,
      fireEvents,
      livelihoodEvents,
      socialForestryAreas: targetSocialForestry.reduce((sum, feature) => sum + Number(properties(feature).L_IUPHKM || 0), 0),
      socialForestryFeatures: targetSocialForestry,
      physicalObjects,
      sites: state.data.sites.length
    };
  }

  function metricText(key) {
    const m = state.metrics;
    const fireAttendance = m.fireEvents.reduce((sum, item) => sum + Number(item.male || 0) + Number(item.female || 0), 0);
    switch (key) {
      case "mangrove":
        return formatNumber(m.mangroveSeedlings) + " mangrove tertanam · " + formatNumber(m.mangroveArea, 2) + " ha · " + m.mangroveVillages.length + " desa";
      case "apo":
        return formatNumber(m.apoLength) + " m APO/perangkap sedimen · " + m.apoVillages.length + " desa";
      case "mangroveNursery":
        return "4 rumah bibit komunitas · 4 desa · seluruh unit perlu logbook stok dan koordinat terverifikasi";
      case "mangroveMonitoring":
        return "100+ catatan monitoring · 4 desa · transek, pertumbuhan, survival, sedimentasi, foto, dan biodiversitas";
      case "canalBlocks":
        return formatNumber(m.canalBlocks) + " sekat kanal · " + m.canalVillages.length + " desa · setiap titik mempunyai tahun dan dokumentasi";
      case "fdrs":
        return formatNumber(m.fdrs) + " unit FDRS/TMAT · " + m.fdrsVillages.length + " desa · terhubung dengan pemantauan hotspot dan cuaca";
      case "agroforestry":
        return formatNumber(m.agroforestryPlants) + " tanaman kopi tercatat · " + formatNumber(m.agroforestryArea, 2) + " ha poligon terpetakan · " + m.agroforestryVillages.length + " lokasi";
      case "fireCapacity":
        return m.fireEvents.length + " sesi relevan · " + formatNumber(fireAttendance) + " kehadiran · dashboard risiko karhutla aktif";
      case "socialForestry":
        return formatNumber(m.socialForestryAreas) + " ha wilayah izin/dampingan · 2 lanskap HKm/KTH · bukan luas restorasi";
      case "biodiversity":
        return "Baseline mangrove di 2 lokasi · katalog flora-fauna · pelatihan pengamanan kawasan HKm";
      case "livelihoods":
        return "4 paket evidence Penabulu · " + m.livelihoodEvents.length + " sesi livelihood/usaha tercatat lintas program";
      case "capacity":
        return m.capacityEvents + " sesi · " + formatNumber(m.attendance) + " kehadiran · " + formatNumber(m.women) + " perempuan dan " + formatNumber(m.men) + " laki-laki";
      case "mrv":
        return formatNumber(m.physicalObjects) + " objek fisik pada layer inti · 100+ catatan monitoring · evidence terhubung ke program dan kebijakan";
      case "policy":
        return "KKMD Riau · RAD Bengkalis Lestari · GREEN for Riau · bahan komunikasi FOLU tapak";
      default:
        return "Evidence dan lokasi tersedia pada YG GeoPortal";
    }
  }

  function renderStats() {
    const m = state.metrics;
    const values = {
      sites: m.sites,
      mangroveSeedlings: m.mangroveSeedlings,
      agroforestryPlants: m.agroforestryPlants,
      canalBlocks: m.canalBlocks,
      fdrs: m.fdrs,
      attendance: m.attendance
    };
    Object.entries(values).forEach(([key, value]) => {
      const node = document.querySelector('[data-folu-stat="' + key + '"]');
      if (node) node.textContent = formatNumber(value, key === "mangroveArea" ? 2 : 0);
    });
    const areaNote = document.querySelector('[data-folu-stat-note="mangroveArea"]');
    if (areaNote) areaNote.textContent = formatNumber(m.mangroveArea, 2) + " ha pada " + m.mangroveVillages.length + " desa";
    const womenNote = document.querySelector('[data-folu-stat-note="women"]');
    if (womenNote) womenNote.textContent = formatNumber(m.women) + " perempuan · data per sesi";
  }

  function renderBoundary() {
    elements.position.textContent = state.data.meta.position;
    elements.accountingNote.textContent = state.data.meta.accountingNote;
    elements.statusKey.innerHTML = state.data.statusDefinitions.map(item =>
      '<article><span class="folu-badge is-' + escapeHtml(item.id) + '">' + escapeHtml(item.label) + '</span><p>' + escapeHtml(item.description) + '</p></article>'
    ).join("");
  }

  function renderPathways() {
    elements.pathways.innerHTML = state.data.pathways.map(pathway => {
      const count = state.data.contributions.filter(item => item.pathways.includes(pathway.id)).length;
      const color = PATHWAY_COLORS[pathway.id] || PATHWAY_COLORS.ro12;
      return '<article class="folu-pathway" style="--pathway-color:' + color + '">' +
        '<div class="folu-pathway-head"><span class="folu-pathway-code">' + escapeHtml(pathway.code) + '</span><span class="folu-pathway-count">' + count + ' kontribusi</span></div>' +
        '<h3>' + escapeHtml(pathway.title) + '</h3><small>' + escapeHtml(pathway.field) + '</small><p>' + escapeHtml(pathway.description) + '</p>' +
      '</article>';
    }).join("");
  }

  function fillPathwaySelects() {
    const options = state.data.pathways.map(pathway => '<option value="' + escapeHtml(pathway.id) + '">' + escapeHtml(pathway.code + " · " + pathway.title) + '</option>').join("");
    elements.pathway.insertAdjacentHTML("beforeend", options);
    elements.mapPathway.insertAdjacentHTML("beforeend", options);
  }

  function contributionSearchText(item) {
    return normalize([
      item.title, item.period, item.ecosystem, item.status, item.codes.join(" "), item.locations.join(" "),
      item.programmes.join(" "), item.rationale, item.pathways.map(id => {
        const pathway = pathwayById(id);
        return pathway ? pathway.code + " " + pathway.title : id;
      }).join(" ")
    ].join(" "));
  }

  function filteredContributions() {
    const filters = state.contributionFilters;
    const query = normalize(filters.search);
    return state.data.contributions.filter(item => {
      if (filters.pathway && !item.pathways.includes(filters.pathway)) return false;
      if (filters.ecosystem && item.ecosystem !== filters.ecosystem) return false;
      if (filters.status && item.status !== filters.status) return false;
      return !query || contributionSearchText(item).includes(query);
    });
  }

  function renderContribution(item) {
    const pathwayCodes = item.pathways.map(id => pathwayById(id)).filter(Boolean).map(pathway => pathway.code).join(" · ");
    const codes = item.codes.map(code => '<span>' + escapeHtml(code) + '</span>').join("");
    const evidence = item.evidence.map(link => '<a href="' + escapeHtml(link.url) + '" target="_blank" rel="noopener">' + escapeHtml(link.label) + ' ↗</a>').join("");
    return '<article class="folu-contribution" data-contribution="' + escapeHtml(item.id) + '">' +
      '<div class="folu-contribution-head"><div class="folu-contribution-title-wrap"><span class="folu-contribution-ecosystem">' + escapeHtml(ECOSYSTEM_LABELS[item.ecosystem] || item.ecosystem) + ' · ' + escapeHtml(pathwayCodes) + '</span><h3>' + escapeHtml(item.title) + '</h3></div><span class="folu-badge is-' + escapeHtml(item.status) + '">' + escapeHtml(STATUS_LABELS[item.status]) + '</span></div>' +
      '<div class="folu-contribution-metric">' + escapeHtml(metricText(item.metricKey)) + '</div>' +
      '<div class="folu-contribution-codes">' + codes + '</div>' +
      '<div class="folu-contribution-meta"><span>📅 ' + escapeHtml(item.period) + '</span><span>📍 ' + escapeHtml(item.locations.join(" · ")) + '</span></div>' +
      '<details><summary>Lihat dasar pemetaan dan program</summary><div class="folu-contribution-detail"><div><strong>Program/mitra:</strong> ' + escapeHtml(item.programmes.join("; ")) + '</div><div><strong>Dasar keterkaitan:</strong> ' + escapeHtml(item.rationale) + '</div></div></details>' +
      '<div class="folu-evidence-links">' + evidence + '<button type="button" class="folu-map-focus" data-folu-map-focus="' + escapeHtml(item.id) + '">Sorot lokasi di peta</button></div>' +
    '</article>';
  }

  function renderContributions() {
    const filtered = filteredContributions();
    elements.resultCount.textContent = filtered.length + " dari " + state.data.contributions.length + " kontribusi ditampilkan";
    elements.contributions.innerHTML = filtered.length
      ? filtered.map(renderContribution).join("")
      : '<div class="folu-empty"><strong>Tidak ada kontribusi yang cocok.</strong><br>Ubah kata pencarian atau reset filter.</div>';
  }

  function renderDocuments() {
    const documents = state.data.documents.filter(item => !state.documentScope || item.scope === state.documentScope);
    elements.documentCount.textContent = documents.length + " dokumen ditampilkan";
    elements.documents.innerHTML = documents.map(item => {
      const links = [
        item.driveUrl ? '<a href="' + escapeHtml(item.driveUrl) + '" target="_blank" rel="noopener">Buka di Google Drive ↗</a>' : "",
        item.officialUrl ? '<a class="is-official" href="' + escapeHtml(item.officialUrl) + '" target="_blank" rel="noopener">Sumber resmi ↗</a>' : ""
      ].join("");
      return '<article class="folu-document"><span class="folu-document-scope">' + escapeHtml(DOCUMENT_SCOPE_LABELS[item.scope] || item.scope) + '</span><h3>' + escapeHtml(item.title) + '</h3><p>' + escapeHtml(item.description) + '</p><div class="folu-document-links">' + links + '</div></article>';
    }).join("");
  }

  function bindContentFilters() {
    document.getElementById("folu-filters").addEventListener("submit", event => event.preventDefault());
    elements.search.addEventListener("input", event => { state.contributionFilters.search = event.target.value; renderContributions(); });
    elements.pathway.addEventListener("change", event => { state.contributionFilters.pathway = event.target.value; renderContributions(); });
    elements.ecosystem.addEventListener("change", event => { state.contributionFilters.ecosystem = event.target.value; renderContributions(); });
    elements.status.addEventListener("change", event => { state.contributionFilters.status = event.target.value; renderContributions(); });
    elements.reset.addEventListener("click", () => {
      state.contributionFilters = { search: "", pathway: "", ecosystem: "", status: "" };
      elements.search.value = ""; elements.pathway.value = ""; elements.ecosystem.value = ""; elements.status.value = "";
      renderContributions();
    });
    elements.documentScope.addEventListener("change", event => { state.documentScope = event.target.value; renderDocuments(); });
    elements.contributions.addEventListener("click", event => {
      const button = event.target.closest("[data-folu-map-focus]");
      if (button) focusContributionOnMap(button.getAttribute("data-folu-map-focus"));
    });
  }

  function firstValue(props, keys) {
    const key = keys.find(candidate => props[candidate] !== null && props[candidate] !== undefined && props[candidate] !== "");
    return key ? props[key] : "";
  }

  function mapLink(props, layerId) {
    const id = firstValue(props, ["Object_ID", "object_id", "OBJECTID"]);
    if (id) return "webgis.html?search=" + encodeURIComponent(String(id));
    const village = firstValue(props, ["Desa", "NAMOBJ", "NAMA_DESA"]);
    return "webgis.html?layer=" + encodeURIComponent(layerId) + (village ? "&village=" + encodeURIComponent(String(village)) : "");
  }

  function popupMetric(kind, props) {
    if (kind === "mangrove") return formatNumber(firstValue(props, ["Jumlah_Bib", "Jumlah_Bibit"])) + " bibit · " + formatNumber(firstValue(props, ["Luas_Ha"]), 2) + " ha";
    if (kind === "agroforestry-area") return formatNumber(firstValue(props, ["Jumlah_Tanam"])) + " tanaman · " + formatNumber(firstValue(props, ["Luas_Ha"]), 2) + " ha";
    if (kind === "agroforestry") return firstValue(props, ["Jumlah_Tanam"]) ? formatNumber(firstValue(props, ["Jumlah_Tanam"])) + " tanaman" : "Rumah bibit/demplot agroforestri";
    if (kind === "canal") return "Sekat kanal · " + escapeHtml(firstValue(props, ["Tahun"]) || "tahun belum dicatat");
    if (kind === "fdrs") return "FDRS/TMAT · " + escapeHtml(firstValue(props, ["Tahun"]) || "tahun belum dicatat");
    if (kind === "apo") return formatNumber(firstValue(props, ["Panjang_M"])) + " m APO/perlindungan pesisir";
    if (kind === "social") return formatNumber(firstValue(props, ["L_IUPHKM", "LUAS_POLI"]), 2) + " ha wilayah izin HKm";
    if (kind === "nursery") return "Rumah pembibitan mangrove";
    return "Lokasi kontribusi YG";
  }

  function popupHtml(kind, props, layerId) {
    const title = firstValue(props, ["Nama_Objek", "NAMA_HKM", "name", "NAMOBJ"]) || "Objek kontribusi FOLU";
    const village = firstValue(props, ["Desa", "NAMA_DESA", "NAMOBJ"]);
    const regency = firstValue(props, ["Kabupaten", "NAMA_KAB", "WADMKK"]);
    return '<div class="folu-popup"><strong>' + escapeHtml(title) + '</strong><small>' + escapeHtml([village, regency].filter(Boolean).join(", ")) + '</small><p>' + popupMetric(kind, props) + '</p><a href="' + escapeHtml(mapLink(props, layerId)) + '">Buka pada Peta Interaktif →</a></div>';
  }

  function registerGeoCollection(collection, config) {
    features(collection).forEach(feature => {
      const props = properties(feature);
      const leafletLayer = L.geoJSON(feature, {
        style: config.style,
        pointToLayer: (_feature, latlng) => L.circleMarker(latlng, config.pointStyle || { radius: 6, color: config.color, weight: 2, fillColor: config.color, fillOpacity: .82 })
      });
      leafletLayer.bindPopup(popupHtml(config.kind, props, config.layerId));
      state.mapItems.push({
        layer: leafletLayer,
        kind: config.kind,
        ecosystem: config.ecosystem,
        pathways: config.pathways,
        status: config.status,
        contributionIds: config.contributionIds,
        siteName: firstValue(props, ["Desa", "NAMA_DESA", "NAMOBJ"]) || ""
      });
    });
  }

  function targetSocialForestryCollection() {
    return {
      type: "FeatureCollection",
      features: state.metrics.socialForestryFeatures
    };
  }

  function siteMatchesContribution(site, contribution) {
    const aliases = site.aliases.map(normalize);
    return contribution.locations.some(location => {
      const normalizedLocation = normalize(location);
      return aliases.some(alias => normalizedLocation === alias || normalizedLocation.includes(alias) || alias.includes(normalizedLocation));
    });
  }

  function registerSiteMarkers() {
    const villageFeatures = features(state.datasets.villages);
    state.data.sites.forEach(site => {
      const boundaryFeature = villageFeatures.find(feature => {
        const props = properties(feature);
        const names = [props.NAMOBJ, props.WADMKD, props.Intervention_Source_Name].filter(Boolean).map(normalize);
        return site.aliases.some(alias => names.includes(normalize(alias)));
      });
      if (!boundaryFeature) return;
      const bounds = L.geoJSON(boundaryFeature).getBounds();
      if (!bounds.isValid()) return;
      const marker = L.circleMarker(bounds.getCenter(), {
        radius: 7,
        color: "#087653",
        weight: 3,
        fillColor: "#ffffff",
        fillOpacity: .92
      });
      const linked = state.data.contributions.filter(contribution => siteMatchesContribution(site, contribution));
      const list = linked.slice(0, 6).map(contribution => '<li>' + escapeHtml(contribution.title) + '</li>').join("");
      marker.bindPopup('<div class="folu-popup"><strong>' + escapeHtml(site.name) + '</strong><small>' + escapeHtml(site.regency) + '</small><p>' + linked.length + ' kelompok kontribusi terdokumentasi</p><ul>' + list + '</ul><a href="webgis.html?village=' + encodeURIComponent(site.aliases[0]) + '">Buka lokasi pada Peta Interaktif →</a></div>');
      const item = {
        layer: marker,
        kind: "site",
        ecosystem: site.ecosystems,
        pathways: site.pathways,
        status: "mapped",
        contributionIds: linked.map(contribution => contribution.id),
        siteName: site.name,
        siteId: site.id
      };
      state.mapItems.push(item);
      state.siteItems.set(site.id, item);
    });
  }

  function mapItemMatches(item) {
    const filters = state.mapFilters;
    const ecosystems = Array.isArray(item.ecosystem) ? item.ecosystem : [item.ecosystem];
    if (filters.ecosystem && !ecosystems.includes(filters.ecosystem)) return false;
    if (filters.pathway && !item.pathways.includes(filters.pathway)) return false;
    if (filters.status && item.status !== filters.status) return false;
    return true;
  }

  function extendBounds(bounds, layer) {
    if (layer.getBounds) {
      const layerBounds = layer.getBounds();
      if (layerBounds && layerBounds.isValid()) bounds.extend(layerBounds);
    } else if (layer.getLatLng) {
      bounds.extend(layer.getLatLng());
    }
  }

  function fitMap(items) {
    if (!state.map || !window.L) return;
    const bounds = L.latLngBounds([]);
    (items || state.mapItems.filter(mapItemMatches)).forEach(item => extendBounds(bounds, item.layer));
    if (bounds.isValid()) state.map.fitBounds(bounds.pad(.12), { maxZoom: 12 });
  }

  function renderLocationList() {
    const sites = state.data.sites.filter(site => {
      if (state.mapFilters.ecosystem && !site.ecosystems.includes(state.mapFilters.ecosystem)) return false;
      if (state.mapFilters.pathway && !site.pathways.includes(state.mapFilters.pathway)) return false;
      return true;
    });
    elements.locationList.innerHTML = sites.map(site => '<article class="folu-location"><div><strong>' + escapeHtml(site.name) + '</strong><small>' + escapeHtml(site.regency) + '</small></div><button type="button" data-folu-site="' + escapeHtml(site.id) + '">Lihat</button></article>').join("");
  }

  function refreshMap(options) {
    if (!state.mapGroup) return;
    const visible = state.mapItems.filter(mapItemMatches);
    state.mapGroup.clearLayers();
    visible.forEach(item => state.mapGroup.addLayer(item.layer));
    elements.mapCount.textContent = visible.length + " objek/lokasi ditampilkan";
    renderLocationList();
    if (!options || options.fit !== false) fitMap(visible);
  }

  function focusContributionOnMap(contributionId) {
    if (!state.map) return;
    const contribution = state.data.contributions.find(item => item.id === contributionId);
    if (!contribution) return;
    state.mapFilters = {
      pathway: contribution.pathways[0] || "",
      ecosystem: contribution.ecosystem === "cross-cutting" ? "" : contribution.ecosystem,
      status: ""
    };
    elements.mapPathway.value = state.mapFilters.pathway;
    elements.mapEcosystem.value = state.mapFilters.ecosystem;
    elements.mapStatus.value = "";
    refreshMap({ fit: false });
    const matching = state.mapItems.filter(item => item.contributionIds.includes(contributionId) && mapItemMatches(item));
    fitMap(matching.length ? matching : state.mapItems.filter(mapItemMatches));
    document.getElementById("peta-kontribusi").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function bindMapFilters() {
    document.getElementById("folu-map-filters").addEventListener("submit", event => event.preventDefault());
    elements.mapEcosystem.addEventListener("change", event => { state.mapFilters.ecosystem = event.target.value; refreshMap(); });
    elements.mapPathway.addEventListener("change", event => { state.mapFilters.pathway = event.target.value; refreshMap(); });
    elements.mapStatus.addEventListener("change", event => { state.mapFilters.status = event.target.value; refreshMap(); });
    elements.mapReset.addEventListener("click", () => {
      state.mapFilters = { pathway: "", ecosystem: "", status: "" };
      elements.mapPathway.value = ""; elements.mapEcosystem.value = ""; elements.mapStatus.value = "";
      refreshMap();
    });
    elements.locationList.addEventListener("click", event => {
      const button = event.target.closest("[data-folu-site]");
      if (!button) return;
      const item = state.siteItems.get(button.getAttribute("data-folu-site"));
      if (!item) return;
      const marker = item.layer;
      state.map.setView(marker.getLatLng(), 12);
      marker.openPopup();
    });
  }

  function initializeMap() {
    if (!elements.map) return;
    if (!window.L) {
      elements.map.innerHTML = '<div class="folu-empty">Peta tidak dapat dimuat. Gunakan tombol “Buka seluruh layer di Peta Interaktif”.</div>';
      elements.mapCount.textContent = "Peta belum tersedia";
      renderLocationList();
      return;
    }
    state.map = L.map(elements.map, { scrollWheelZoom: false, zoomControl: true }).setView([1.15, 101.85], 8);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors"
    }).addTo(state.map);
    state.mapGroup = L.featureGroup().addTo(state.map);

    registerGeoCollection(state.datasets.mangrove, {
      layerId: "area_mangrove", kind: "mangrove", ecosystem: "mangrove", pathways: ["ro12"], status: "verified", contributionIds: ["mangrove-restoration", "mangrove-monitoring"],
      style: { color: "#087653", weight: 2, fillColor: "#31a77d", fillOpacity: .38 }
    });
    registerGeoCollection(state.datasets.apo, {
      layerId: "apo", kind: "apo", ecosystem: "mangrove", pathways: ["ro12"], status: "verified", contributionIds: ["coastal-protection"],
      style: { color: "#c9513a", weight: 5, opacity: .9 }
    });
    registerGeoCollection(state.datasets.mangroveNursery, {
      layerId: "nursery_mangrove", kind: "nursery", ecosystem: "mangrove", pathways: ["ro12"], status: "mapped", contributionIds: ["mangrove-nursery"],
      color: "#8fa600", pointStyle: { radius: 7, color: "#617200", weight: 2, fillColor: "#b8cf28", fillOpacity: .88 }
    });
    registerGeoCollection(state.datasets.canalBlocks, {
      layerId: "sekat_kanal", kind: "canal", ecosystem: "peat", pathways: ["ro9", "ro10"], status: "verified", contributionIds: ["peat-rewetting"],
      color: "#1d7286", pointStyle: { radius: 7, color: "#145264", weight: 2, fillColor: "#42a0b5", fillOpacity: .9 }
    });
    registerGeoCollection(state.datasets.fdrs, {
      layerId: "fdrs", kind: "fdrs", ecosystem: "peat", pathways: ["ro2", "ro9", "bidang-v"], status: "verified", contributionIds: ["hydrology-ews", "fire-prevention"],
      color: "#e1782f", pointStyle: { radius: 7, color: "#9e4316", weight: 2, fillColor: "#f1904c", fillOpacity: .9 }
    });
    registerGeoCollection(state.datasets.coffeeAreas, {
      layerId: "area_kopi", kind: "agroforestry-area", ecosystem: "peat", pathways: ["ro2", "ro10"], status: "mapped", contributionIds: ["peat-agroforestry"],
      style: { color: "#6d4728", weight: 2, fillColor: "#a67649", fillOpacity: .38 }
    });
    registerGeoCollection(state.datasets.coffee, {
      layerId: "kopi", kind: "agroforestry", ecosystem: "peat", pathways: ["ro2", "ro10"], status: "mapped", contributionIds: ["peat-agroforestry", "sustainable-livelihoods"],
      color: "#8b5e34", pointStyle: { radius: 6, color: "#603e20", weight: 2, fillColor: "#a9794d", fillOpacity: .88 }
    });
    registerGeoCollection(targetSocialForestryCollection(), {
      layerId: "PERHUTANAN_SOSIAL_RIAU", kind: "social", ecosystem: "social-forestry", pathways: ["ro1", "ro2", "ro11", "bidang-v"], status: "supporting", contributionIds: ["social-forestry", "biodiversity-protection"],
      style: { color: "#70579a", weight: 3, dashArray: "7 5", fillColor: "#8d75af", fillOpacity: .17 }
    });
    registerSiteMarkers();
    bindMapFilters();
    refreshMap();
    setTimeout(() => state.map.invalidateSize(), 80);
  }

  function renderPage() {
    calculateMetrics();
    renderStats();
    renderBoundary();
    renderPathways();
    fillPathwaySelects();
    renderContributions();
    renderDocuments();
    bindContentFilters();
    initializeMap();
  }

  Promise.all([
    fetchJson("data/folu-contributions.json"),
    fetchJson("data/area_mangrove.geojson"),
    fetchJson("data/area_kopi.geojson"),
    fetchJson("data/kopi.geojson"),
    fetchJson("data/sekat_kanal.geojson"),
    fetchJson("data/fdrs.geojson"),
    fetchJson("data/apo.geojson"),
    fetchJson("data/nursery_mangrove.geojson"),
    fetchJson("data/PERHUTANAN_SOSIAL_RIAU.geojson"),
    fetchJson("data/desa_intervensi.geojson"),
    fetchJson("data/capacity-building.json")
  ]).then(results => {
    state.data = results[0];
    state.datasets = {
      mangrove: results[1], coffeeAreas: results[2], coffee: results[3], canalBlocks: results[4],
      fdrs: results[5], apo: results[6], mangroveNursery: results[7], socialForestry: results[8],
      villages: results[9], capacity: results[10]
    };
    renderPage();
  }).catch(error => {
    console.error(error);
    elements.resultCount.textContent = "Data FOLU belum dapat dimuat";
    elements.contributions.innerHTML = '<div class="folu-empty"><strong>Data belum tersedia.</strong><br>' + escapeHtml(error.message) + '</div>';
    elements.mapCount.textContent = "Peta belum dapat dimuat";
    elements.documentCount.textContent = "Dokumen belum dapat dimuat";
  });
})();
