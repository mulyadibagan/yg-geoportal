(function () {
  "use strict";

  const API = "https://yg-webgis-public-data.yg-webgis-public-data-worker.workers.dev";
  const CATALOG_PATH = "/api/staff/riau-geoportal/catalog";
  const MAX_ACTIVE_LAYERS = 3;
  const MAX_DISPLAY_BYTES = 12 * 1024 * 1024;
  const MAX_DISPLAY_FEATURES = 25000;
  const CATALOG_CACHE_KEY = "ygRiauGeoportalCatalogV1";
  const CATALOG_CACHE_MAX_AGE_MS = 15 * 60 * 1000;
  const COLORS = ["#08765f", "#d97706", "#2563a8", "#9b3f73", "#65752b", "#7a4bb7"];
  const state = { session: null, catalog: null, items: [], filtered: [], map: null, active: new Map(), pending: new Set(), currentDetail: null, mapExpanded: false };

  const el = id => document.getElementById(id);
  const escapeHtml = value => String(value == null ? "" : value)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#039;");

  function returnToLogin() {
    const target = location.pathname.split("/").pop() + location.search;
    location.replace("staff-login.html?return=" + encodeURIComponent(target));
  }

  function clearSessionAndLogin() {
    try {
      if (window.YG_AUTH) window.YG_AUTH.logout(state.session && state.session.token);
      else {
        localStorage.removeItem("ygEditorSessionV1");
        sessionStorage.removeItem("ygEditorSessionV1");
      }
    } catch (ignore) {}
    returnToLogin();
  }

  async function api(path, options) {
    const headers = new Headers(options && options.headers || {});
    headers.set("authorization", "Bearer " + state.session.token);
    const response = await fetch(API + path, { ...(options || {}), headers, cache: "no-store", credentials: "omit" });
    if (response.status === 401 || response.status === 403) {
      clearSessionAndLogin();
      throw new Error("Sesi staf berakhir.");
    }
    return response;
  }

  function firstObject() {
    for (const value of arguments) if (value && typeof value === "object") return value;
    return {};
  }

  function normalizeBbox(value) {
    if (!value) return null;
    if (Array.isArray(value) && value.length === 4 && value.every(Number.isFinite)) return value;
    const row = value;
    const bbox = [Number(row.minx ?? row.west), Number(row.miny ?? row.south), Number(row.maxx ?? row.east), Number(row.maxy ?? row.north)];
    return bbox.every(Number.isFinite) ? bbox : null;
  }

  function normalizeItem(row) {
    const mirror = firstObject(row.mirror, row.ingest, row.replica);
    const objects = firstObject(row.objects, mirror.objects);
    const artifacts = firstObject(row.artifacts);
    const sourceObject = firstObject(mirror.source, objects.source, artifacts.source, row.sourceObject);
    const displayObject = firstObject(mirror.display, objects.display, artifacts.display, row.displayObject);
    const identifiers = firstObject(row.identifiers);
    const metadata = firstObject(row.metadata);
    const metadataIdentifiers = firstObject(metadata.identifiers);
    const distribution = firstObject(metadata.distribution);
    const spatial = firstObject(row.spatial);
    const dates = firstObject(row.dates);
    const accessInfo = firstObject(row.access);
    const upstream = firstObject(row.upstream, row.source);
    const publisherValue = row.publisher || row.organization || (row.opd && (row.opd.nama_opd || row.opd.name)) || row.opd;
    const themeValue = (row.theme && typeof row.theme === "object" ? row.theme.name || row.theme.code : row.theme) || row.kugiTheme || (row.kugi_tema && (row.kugi_tema.nama || row.kugi_tema.name)) || row.kugi_tema || row.topicCategory;
    const uuid = String(row.uuid || row.datasetUuid || row.id || "").toLowerCase();
    const conflicts = [
      ...(Array.isArray(row.conflicts) ? row.conflicts : Array.isArray(metadata.conflicts) ? metadata.conflicts : []),
      ...(Array.isArray(row.qaWarnings) ? row.qaWarnings : [])
    ];
    const mirrorStatus = String(mirror.status || row.mirrorStatus || row.ingestStatus || row.planStatus || row.status || "pending").toLowerCase();
    const sourceAvailable = Boolean(sourceObject.available ?? sourceObject.key ?? mirror.sourceAvailable ?? row.sourceAvailable);
    const displayAvailable = Boolean(displayObject.available ?? displayObject.key ?? mirror.displayAvailable ?? row.displayAvailable ?? row.displayReady);
    const failed = /fail|error|blocked/.test(mirrorStatus) || Boolean(mirror.error || row.error);
    const detailUrl = String(upstream.detailUrl || row.detailUrl || `https://geoportal.riau.go.id/katalog/view/${uuid}`);
    return {
      raw: row,
      uuid,
      title: String(row.title || row.name || identifiers.dataset || "Dataset tanpa judul"),
      description: String(row.description || row.abstract || metadata.abstract || "Tidak ada ringkasan pada katalog."),
      publisher: String(publisherValue || "Penerbit tidak dicantumkan"),
      theme: String(themeValue || "Tema belum diklasifikasikan"),
      geometryType: String(row.geometryType || row.geomType || row.geom_type || spatial.geometryType || "—"),
      epsg: String(row.epsg || row.srs || row.epsg_code || spatial.srs || "—"),
      bbox: normalizeBbox(row.bbox || spatial.bbox || upstream.bbox),
      dataYear: row.dataYear ?? row.data_year ?? dates.dataYear ?? "—",
      publishedAt: row.publishedAt || row.published_at || dates.publishedAt || metadata.publicationDate || null,
      updatedAt: row.upstreamUpdatedAt || row.updatedAt || row.updated_at || dates.updatedAt || null,
      datasetIdentifier: String(identifiers.dataset || identifiers.datasetIdentifier || row.datasetIdentifier || row.dataset_identifier || "—"),
      metadataIdentifier: String(identifiers.metadataFile || identifiers.metadata || metadataIdentifiers.directoryPublicIdentifier || metadataIdentifiers.metadataDetailIdentifier || row.metadataIdentifier || "—"),
      license: String(row.license || distribution.license || metadata.license || "Belum terverifikasi"),
      access: String(typeof row.access === "string" ? row.access : distribution.access || metadata.access || "Belum terverifikasi"),
      mirrorStatus,
      mirrorError: String(mirror.error || row.mirrorError || row.error || ""),
      sourceAvailable,
      sourceBytes: Number(sourceObject.originalBytes || sourceObject.bytes || mirror.sourceBytes || row.sourceBytes || row.fileSize || row.file_size || spatial.fileSizeBytes || 0),
      sourceStoredBytes: Number(sourceObject.bytes || mirror.sourceBytes || row.sourceBytes || 0),
      sourceSha: String(sourceObject.originalSha256 || sourceObject.sha256 || mirror.sha256 || row.sha256 || ""),
      sourceCompression: String(sourceObject.compression ?? "identity"),
      displayAvailable,
      displayBytes: Number(displayObject.bytes || mirror.displayBytes || row.displayBytes || 0),
      featureCount: Number(displayObject.featureCount || mirror.featureCount || row.featureCount || 0),
      conflicts,
      detailUrl: String(accessInfo.detailUrl || detailUrl)
    };
  }

  function formatBytes(bytes) {
    const value = Number(bytes || 0);
    if (!value) return "—";
    const units = ["B", "KB", "MB", "GB", "TB"];
    const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
    return (value / Math.pow(1024, index)).toLocaleString("id-ID", { maximumFractionDigits: index ? 1 : 0 }) + " " + units[index];
  }

  function formatDate(value) {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
  }

  function statusKind(item) {
    if (item.displayAvailable) return "display";
    if (item.sourceAvailable) return "mirrored";
    if (item.mirrorError || /fail|error|blocked/.test(item.mirrorStatus)) return "issue";
    return "issue";
  }

  function statusLabel(item) {
    const kind = statusKind(item);
    return kind === "display" ? "SIAP PETA" : kind === "mirrored" ? "ARSIP INTERNAL" : "PERLU CEK";
  }

  function colorFor(uuid) {
    let hash = 0;
    for (const char of uuid) hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
    return COLORS[Math.abs(hash) % COLORS.length];
  }

  function safeOfficialUrl(value) {
    try {
      const url = new URL(value);
      return url.protocol === "https:" && url.hostname === "geoportal.riau.go.id" ? url.href : "";
    } catch (_) { return ""; }
  }

  function fillSelect(select, values, placeholder) {
    const current = select.value;
    select.innerHTML = `<option value="">${escapeHtml(placeholder)}</option>` + values
      .filter(Boolean).sort((a, b) => a.localeCompare(b, "id"))
      .map(value => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join("");
    if (values.includes(current)) select.value = current;
  }

  function catalogRows(catalog) {
    if (Array.isArray(catalog.datasets)) return catalog.datasets;
    if (Array.isArray(catalog.items)) return catalog.items;
    if (Array.isArray(catalog.records)) return catalog.records;
    return [];
  }

  function readCachedCatalog() {
    try {
      const cached = JSON.parse(sessionStorage.getItem(CATALOG_CACHE_KEY) || "null");
      if (!cached || cached.username !== state.session.username || !cached.savedAt || !cached.catalog) return null;
      if (Date.now() - Number(cached.savedAt) > CATALOG_CACHE_MAX_AGE_MS) return null;
      return cached.catalog;
    } catch (_) {
      return null;
    }
  }

  function cacheCatalog(catalog) {
    try {
      sessionStorage.setItem(CATALOG_CACHE_KEY, JSON.stringify({
        username: state.session.username,
        savedAt: Date.now(),
        catalog
      }));
    } catch (_) {}
  }

  function useCatalog(catalog) {
    const rows = catalogRows(catalog);
    if (!rows.length) throw new Error("Katalog privat belum berisi dataset.");
    const items = rows.map(normalizeItem).filter(item => /^[0-9a-f-]{36}$/.test(item.uuid));
    if (!items.length) throw new Error("Katalog tidak memiliki UUID dataset yang valid.");
    state.catalog = catalog;
    state.items = items.sort((a, b) => a.title.localeCompare(b.title, "id"));
    initializeMap();
    fillSelect(el("rg-publisher"), Array.from(new Set(state.items.map(item => item.publisher))), "Semua penerbit");
    fillSelect(el("rg-theme"), Array.from(new Set(state.items.map(item => item.theme))), "Semua tema");
    renderSummary();
    applyFilters();
  }

  function renderSummary() {
    const summary = state.catalog && state.catalog.summary || {};
    const total = state.items.length;
    const mirrored = state.items.filter(item => item.sourceAvailable).length;
    const display = state.items.filter(item => item.displayAvailable).length;
    const issues = state.items.filter(item => statusKind(item) === "issue").length;
    el("rg-kpi-total").textContent = Number(summary.discovered ?? summary.total ?? total).toLocaleString("id-ID");
    el("rg-kpi-mirrored").textContent = Number(summary.mirrored ?? mirrored).toLocaleString("id-ID");
    el("rg-kpi-display").textContent = Number(summary.displayReady ?? summary.display_ready ?? display).toLocaleString("id-ID");
    el("rg-kpi-issues").textContent = Number(summary.issues ?? summary.failed ?? issues).toLocaleString("id-ID");
    const syncedAt = state.catalog.generatedAt || state.catalog.syncedAt || state.catalog.updatedAt;
    el("rg-synced-at").textContent = formatDate(syncedAt);
    el("rg-source-status").textContent = total + " UUID katalog · sumber geoportal.riau.go.id";
  }

  function applyFilters() {
    const query = el("rg-search").value.trim().toLocaleLowerCase("id");
    const publisher = el("rg-publisher").value;
    const theme = el("rg-theme").value;
    const status = el("rg-status").value;
    state.filtered = state.items.filter(item => {
      const haystack = [item.title, item.description, item.publisher, item.theme, item.datasetIdentifier, item.uuid].join(" ").toLocaleLowerCase("id");
      return (!query || haystack.includes(query)) && (!publisher || item.publisher === publisher) &&
        (!theme || item.theme === theme) && (!status || statusKind(item) === status);
    });
    renderList();
  }

  function renderList() {
    el("rg-result-count").textContent = state.filtered.length.toLocaleString("id-ID") + " dataset";
    const list = el("rg-dataset-list");
    if (!state.filtered.length) {
      list.innerHTML = '<p class="rg-status">Tidak ada dataset yang cocok dengan filter.</p>';
      return;
    }
    list.innerHTML = state.filtered.map(item => {
      const kind = statusKind(item), active = state.active.has(item.uuid);
      const badgeClass = kind === "issue" ? "is-issue" : kind === "mirrored" ? "is-archive" : "";
      const loadLabel = active ? "Hapus dari peta" : item.displayAvailable ? "Tampilkan" : "Belum siap peta";
      return `<article class="rg-dataset-card${active ? " is-active" : ""}" data-uuid="${escapeHtml(item.uuid)}">
        <div class="rg-card-top"><h3>${escapeHtml(item.title)}</h3><span class="rg-badge ${badgeClass}">${statusLabel(item)}</span></div>
        <p>${escapeHtml(item.description)}</p>
        <div class="rg-card-meta"><span>${escapeHtml(item.publisher)}</span><span>${escapeHtml(item.theme)}</span><span>${escapeHtml(item.geometryType)}</span><span>${formatBytes(item.sourceBytes)}</span>${item.conflicts.length ? `<span>${item.conflicts.length} catatan metadata</span>` : ""}</div>
        <div class="rg-card-actions"><button type="button" data-action="toggle"${!item.displayAvailable && !active ? " disabled" : ""} class="${active ? "is-remove" : ""}">${loadLabel}</button><button type="button" data-action="detail">Metadata</button></div>
      </article>`;
    }).join("");
  }

  function initializeMap() {
    if (state.map) return true;
    if (!window.L) {
      el("rg-map-status").classList.add("is-error");
      el("rg-map-status").textContent = "Mesin peta belum tersedia. Periksa koneksi lalu muat ulang halaman.";
      return false;
    }
    state.map = L.map("rg-map", { preferCanvas: true, zoomControl: true, minZoom: 5 }).setView([0.55, 101.7], 7);
    const blank = L.layerGroup();
    const streets = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "&copy; OpenStreetMap contributors" }).addTo(state.map);
    const satellite = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { maxZoom: 19, maxNativeZoom: 18, attribution: "Tiles &copy; Esri" });
    L.control.layers({ "Peta jalan · eksternal": streets, "Citra satelit · eksternal": satellite, "Tanpa peta dasar": blank }, null, { collapsed: true }).addTo(state.map);
    return true;
  }

  async function readJsonWithinLimit(response, maxBytes) {
    const statedLength = response.headers.get("content-length");
    const statedBytes = Number(statedLength);
    if (statedLength && (!Number.isSafeInteger(statedBytes) || statedBytes < 1)) throw new Error("Ukuran turunan peta tidak valid.");
    if (statedLength && statedBytes > maxBytes) throw new Error("Turunan peta terlalu besar untuk browser. Gunakan snapshot sumber melalui alat GIS desktop.");
    if (!response.body || !response.body.getReader) {
      const text = await response.text();
      if (new TextEncoder().encode(text).length > maxBytes) throw new Error("Turunan peta melampaui batas aman browser.");
      return JSON.parse(text);
    }
    const reader = response.body.getReader(), chunks = [];
    let received = 0;
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      received += result.value.byteLength;
      if (received > maxBytes) {
        await reader.cancel();
        throw new Error("Turunan peta melampaui batas aman browser.");
      }
      chunks.push(result.value);
    }
    if (!received) throw new Error("Turunan peta kosong.");
    const bytes = new Uint8Array(received);
    let offset = 0;
    chunks.forEach(chunk => { bytes.set(chunk, offset); offset += chunk.byteLength; });
    return JSON.parse(new TextDecoder().decode(bytes));
  }

  function setMapExpanded(expanded) {
    state.mapExpanded = Boolean(expanded);
    const panel = document.querySelector(".rg-map-panel"), button = el("rg-map-expand");
    panel.classList.toggle("is-expanded", state.mapExpanded);
    document.body.classList.toggle("rg-map-expanded", state.mapExpanded);
    button.setAttribute("aria-pressed", String(state.mapExpanded));
    button.textContent = state.mapExpanded ? "Kecilkan peta" : "Perbesar peta";
    if (state.mapExpanded) panel.scrollIntoView({ block: "start" });
    window.requestAnimationFrame(() => {
      if (!state.map) return;
      state.map.invalidateSize();
      if (state.active.size) fitActive();
    });
  }

  function propertyPopup(item, properties) {
    const rows = Object.entries(properties || {}).filter(([, value]) => value != null && value !== "" && typeof value !== "object").slice(0, 10);
    return `<strong>${escapeHtml(item.title)}</strong><dl>${rows.map(([key, value]) => `<div><dt>${escapeHtml(key)}</dt><dd>${escapeHtml(String(value).slice(0, 500))}</dd></div>`).join("")}</dl>`;
  }

  function updateActiveUi() {
    const entries = Array.from(state.active.values());
    el("rg-active-count").textContent = entries.length + (state.pending.size ? " aktif · " + state.pending.size + " memuat" : "") + "/" + MAX_ACTIVE_LAYERS;
    el("rg-clear").disabled = !entries.length;
    el("rg-fit").disabled = !entries.length;
    const empty = document.querySelector("#rg-map .rg-map-empty");
    if (empty) empty.hidden = Boolean(entries.length);
    el("rg-active-layers").innerHTML = entries.length ? entries.map(entry => `<button type="button" data-remove="${escapeHtml(entry.item.uuid)}" title="Hapus layer"><i style="background:${entry.color}"></i>${escapeHtml(entry.item.title)} ×</button>`).join("") : "<span>Belum ada layer aktif.</span>";
    renderList();
  }

  function fitActive() {
    if (!state.map || !state.active.size) return;
    const bounds = L.latLngBounds([]);
    state.active.forEach(entry => {
      const layerBounds = entry.layer.getBounds && entry.layer.getBounds();
      if (layerBounds && layerBounds.isValid()) bounds.extend(layerBounds);
      else if (entry.item.bbox) bounds.extend([[entry.item.bbox[1], entry.item.bbox[0]], [entry.item.bbox[3], entry.item.bbox[2]]]);
    });
    if (bounds.isValid()) state.map.fitBounds(bounds, { padding: [28, 28], maxZoom: 14 });
  }

  function removeLayer(uuid) {
    const entry = state.active.get(uuid);
    if (!entry) return;
    state.map.removeLayer(entry.layer);
    state.active.delete(uuid);
    updateActiveUi();
    el("rg-map-status").textContent = "Layer dihapus dari peta; snapshot tetap tersimpan di ruang internal.";
  }

  async function loadLayer(item, button) {
    if (state.active.has(item.uuid)) return removeLayer(item.uuid);
    if (state.pending.has(item.uuid)) return;
    if (state.active.size + state.pending.size >= MAX_ACTIVE_LAYERS) {
      el("rg-map-status").textContent = "Batas tiga layer tercapai. Hapus satu layer sebelum memuat yang lain.";
      return;
    }
    state.pending.add(item.uuid);
    updateActiveUi();
    button.disabled = true;
    button.textContent = "Memuat…";
    el("rg-map-status").classList.remove("is-error");
    el("rg-map-status").textContent = "Mengambil turunan peta privat untuk “" + item.title + "”…";
    try {
      if (!initializeMap()) throw new Error("Peta belum dapat diinisialisasi.");
      if (item.displayBytes > MAX_DISPLAY_BYTES) throw new Error("Turunan peta terlalu besar untuk browser. Gunakan snapshot sumber melalui alat GIS desktop.");
      const response = await api(`/api/staff/riau-geoportal/datasets/${encodeURIComponent(item.uuid)}/display`);
      if (!response.ok) throw new Error(response.status === 503 ? "Turunan peta belum tersedia; arsip sumber tetap tercatat." : "Data peta gagal dimuat (" + response.status + ").");
      const geojson = await readJsonWithinLimit(response, MAX_DISPLAY_BYTES);
      if (!geojson || geojson.type !== "FeatureCollection" || !Array.isArray(geojson.features)) throw new Error("Format turunan peta tidak valid.");
      if (geojson.features.length > MAX_DISPLAY_FEATURES) throw new Error("Jumlah fitur melampaui batas aman tampilan browser.");
      const color = colorFor(item.uuid);
      const layer = L.geoJSON(geojson, {
        renderer: L.canvas({ padding: .35 }),
        style: { color, weight: 1.5, opacity: .9, fillColor: color, fillOpacity: .22 },
        pointToLayer(feature, latlng) { return L.circleMarker(latlng, { radius: 5, color: "#fff", weight: 1, fillColor: color, fillOpacity: .9 }); },
        onEachFeature(feature, featureLayer) { featureLayer.bindPopup(propertyPopup(item, feature && feature.properties), { maxWidth: 360 }); }
      }).addTo(state.map);
      state.active.set(item.uuid, { item, layer, color });
      state.map.invalidateSize();
      updateActiveUi();
      fitActive();
      if (window.matchMedia("(max-width: 1000px)").matches) {
        document.querySelector(".rg-map-panel").scrollIntoView({ behavior: "smooth", block: "start" });
      }
      el("rg-map-status").textContent = geojson.features.length.toLocaleString("id-ID") + " fitur ditampilkan dari snapshot internal “" + item.title + "”.";
    } catch (error) {
      el("rg-map-status").classList.add("is-error");
      el("rg-map-status").textContent = error.message || "Layer belum dapat dimuat.";
      button.disabled = false;
      button.textContent = "Tampilkan";
    } finally {
      state.pending.delete(item.uuid);
      updateActiveUi();
    }
  }

  function showDetail(item) {
    state.currentDetail = item;
    el("rg-detail-title").textContent = item.title;
    const fields = [
      ["UUID dataset", item.uuid], ["Identifier", item.datasetIdentifier], ["Metadata", item.metadataIdentifier],
      ["Penerbit", item.publisher], ["Tema KUGI", item.theme], ["Tahun data", item.dataYear],
      ["Geometri", item.geometryType], ["Sistem referensi", item.epsg], ["Ukuran sumber", formatBytes(item.sourceBytes)],
      ["Penyimpanan", item.sourceCompression === "gzip" ? "Gzip · " + formatBytes(item.sourceStoredBytes) : "GeoJSON"],
      ["Lisensi", item.license], ["Akses sumber", item.access], ["Hash SHA-256", item.sourceSha ? item.sourceSha.slice(0, 16) + "…" : "—"]
    ];
    el("rg-detail-grid").innerHTML = fields.map(([key, value]) => `<div><dt>${escapeHtml(key)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("");
    el("rg-detail-description").textContent = item.description;
    const official = safeOfficialUrl(item.detailUrl);
    el("rg-official-link").hidden = !official;
    if (official) el("rg-official-link").href = official;
    el("rg-download").disabled = !item.sourceAvailable;
    el("rg-download").textContent = item.sourceAvailable
      ? "Unduh snapshot internal" + (item.sourceCompression === "gzip" ? " (.gz)" : "")
      : "Snapshot belum tersedia";
    const notes = [];
    if (item.mirrorError) notes.push("Sinkronisasi: " + item.mirrorError);
    if (item.conflicts.length) notes.push(item.conflicts.length + " konflik metadata dipertahankan untuk pemeriksaan.");
    if (!notes.length) notes.push("Snapshot diidentifikasi dengan UUID dan checksum; perubahan sumber akan membuat rilis baru.");
    el("rg-detail-note").textContent = notes.join(" ");
    el("rg-detail").hidden = false;
    el("rg-detail").scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function safeFileName(item, compressed) {
    const stem = item.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 70) || "riau-geoportal";
    return stem + "-" + item.uuid.slice(0, 8) + ".geojson" + (compressed ? ".gz" : "");
  }

  async function downloadSource() {
    const item = state.currentDetail;
    if (!item || !item.sourceAvailable) return;
    const button = el("rg-download"), note = el("rg-detail-note");
    button.disabled = true;
    button.textContent = "Menyiapkan…";
    note.textContent = "Mengunduh melalui jalur staf; token tidak dimasukkan ke URL.";
    try {
      const response = await api(`/api/staff/riau-geoportal/datasets/${encodeURIComponent(item.uuid)}/source`);
      if (!response.ok) throw new Error("Snapshot sumber belum dapat diunduh (" + response.status + ").");
      const responseType = String(response.headers.get("content-type") || "").split(";", 1)[0].trim().toLowerCase();
      if (!new Set(["application/gzip", "application/geo+json"]).has(responseType)) {
        throw new Error("Format snapshot sumber tidak dikenali.");
      }
      const compressed = responseType === "application/gzip";
      const name = safeFileName(item, compressed);
      const contentLength = response.headers.get("content-length");
      const bytes = Number(contentLength);
      if (!contentLength || !Number.isSafeInteger(bytes) || bytes < 1) throw new Error("Ukuran snapshot sumber tidak dapat diverifikasi.");
      if (window.showSaveFilePicker && response.body) {
        const types = compressed
          ? [{ description: "GeoJSON terkompresi", accept: { "application/gzip": [".gz"] } }]
          : [{ description: "GeoJSON", accept: { "application/geo+json": [".geojson"] } }];
        const handle = await window.showSaveFilePicker({ suggestedName: name, types });
        const writable = await handle.createWritable();
        await response.body.pipeTo(writable);
      } else {
        if (bytes > 120 * 1024 * 1024) throw new Error("Berkas besar memerlukan Chrome/Edge agar dapat dialirkan langsung ke disk tanpa memenuhi memori browser.");
        const blob = await response.blob();
        const href = URL.createObjectURL(blob), anchor = document.createElement("a");
        anchor.href = href; anchor.download = name; anchor.click();
        setTimeout(() => URL.revokeObjectURL(href), 1000);
      }
      note.textContent = "Snapshot internal selesai disimpan." +
        (compressed ? " Ekstrak .gz untuk memperoleh GeoJSON mentah yang checksum-nya tercantum pada metadata." : " Periksa checksum pada metadata bila dipakai untuk analisis lanjutan.");
    } catch (error) {
      if (error && error.name === "AbortError") note.textContent = "Penyimpanan dibatalkan.";
      else note.textContent = error.message || "Unduhan gagal.";
    } finally {
      button.disabled = false;
      button.textContent = "Unduh snapshot internal" + (item.sourceCompression === "gzip" ? " (.gz)" : "");
    }
  }

  async function loadCatalog() {
    const status = el("rg-catalog-status"), list = el("rg-dataset-list");
    const cachedCatalog = readCachedCatalog();
    status.classList.remove("is-error");
    if (cachedCatalog) {
      try {
        useCatalog(cachedCatalog);
        status.textContent = state.items.length.toLocaleString("id-ID") + " dataset siap. Memeriksa pembaruan…";
      } catch (_) {
        sessionStorage.removeItem(CATALOG_CACHE_KEY);
      }
    }
    if (!state.catalog) {
      status.textContent = "Memuat inventaris privat…";
      list.innerHTML = "";
    }
    el("rg-refresh").disabled = true;
    try {
      const response = await api(CATALOG_PATH);
      if (!response.ok) throw new Error(response.status === 503 ? "Sinkronisasi pertama belum selesai. Coba lagi setelah pipeline penyimpanan selesai." : "Katalog tidak dapat dimuat (" + response.status + ").");
      const catalog = await response.json();
      useCatalog(catalog);
      cacheCatalog(catalog);
      status.textContent = state.items.length.toLocaleString("id-ID") + " dataset terbaca. Geometri hanya dimuat setelah dipilih.";
    } catch (error) {
      if (state.catalog) {
        status.textContent = state.items.length.toLocaleString("id-ID") + " dataset dari cache sesi. Pembaruan belum dapat diperiksa.";
      } else {
        status.classList.add("is-error");
        status.textContent = error.message || "Katalog belum dapat dimuat.";
        list.innerHTML = '<p class="rg-status is-error">Tidak ada data lokal pengganti; sistem berhenti aman agar data privat tidak diambil dari jalur publik.</p>';
      }
    } finally {
      document.documentElement.style.visibility = "visible";
      el("rg-refresh").disabled = false;
    }
  }

  function bindEvents() {
    ["rg-search", "rg-publisher", "rg-theme", "rg-status"].forEach(id => el(id).addEventListener(id === "rg-search" ? "input" : "change", applyFilters));
    el("rg-reset").addEventListener("click", () => {
      el("rg-search").value = ""; el("rg-publisher").value = ""; el("rg-theme").value = ""; el("rg-status").value = ""; applyFilters();
    });
    el("rg-refresh").addEventListener("click", loadCatalog);
    el("rg-dataset-list").addEventListener("click", event => {
      const button = event.target.closest("button[data-action]"), card = event.target.closest("[data-uuid]");
      if (!button || !card) return;
      const item = state.items.find(row => row.uuid === card.dataset.uuid);
      if (!item) return;
      if (button.dataset.action === "detail") showDetail(item);
      else loadLayer(item, button);
    });
    el("rg-active-layers").addEventListener("click", event => {
      const button = event.target.closest("button[data-remove]");
      if (button) removeLayer(button.dataset.remove);
    });
    el("rg-clear").addEventListener("click", () => Array.from(state.active.keys()).forEach(removeLayer));
    el("rg-fit").addEventListener("click", fitActive);
    el("rg-map-expand").addEventListener("click", () => setMapExpanded(!state.mapExpanded));
    el("rg-detail-close").addEventListener("click", () => { el("rg-detail").hidden = true; state.currentDetail = null; });
    el("rg-download").addEventListener("click", downloadSource);
    el("rg-logout").addEventListener("click", () => {
      sessionStorage.removeItem(CATALOG_CACHE_KEY);
      if (window.YG_AUTH) window.YG_AUTH.logout(state.session.token);
      location.replace("staff-login.html?loggedOut=1");
    });
    document.addEventListener("keydown", event => { if (event.key === "Escape" && state.mapExpanded) setMapExpanded(false); });
    window.addEventListener("resize", () => state.map && state.map.invalidateSize());
  }

  async function boot() {
    state.session = window.YG_AUTH && window.YG_AUTH.readStoredSession();
    if (!state.session) return returnToLogin();
    bindEvents();
    initializeMap();
    await loadCatalog();
    setTimeout(() => state.map && state.map.invalidateSize(), 100);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
