(function () {
  "use strict";

  const API = "https://yg-webgis-public-data.yg-webgis-public-data-worker.workers.dev";
  const CATALOG_PATH = "/api/staff/riau-geoportal/catalog";
  const MAX_ACTIVE_CATALOG_LAYERS = 3;
  const MAX_DISPLAY_BYTES = 12 * 1024 * 1024;
  const MAX_DISPLAY_FEATURES = 25000;
  const CATALOG_COLORS = ["#08765f", "#d97706", "#2563a8", "#9b3f73", "#65752b", "#7a4bb7"];
  const catalogState = { items: [], active: new Map(), pending: new Set() };

  const PRESETS = {
    baseline: {
      label: "Dasar provinsi",
      layers: ["batas_administrasi_desa_riau", "rtrw_riau_2018_2038"]
    },
    spatial_ecology: {
      label: "Tata ruang & ekologi",
      layers: ["rtrw_riau_2018_2038", "kawasan_hutan_sk_903", "gambut_bbsdlp_2019"]
    },
    governance: {
      label: "Izin & wilayah kelola",
      layers: ["pbph_riau_052026", "perusahaan_sawit_riau", "perhutanan_sosial_riau", "kph_2019_riau"]
    },
    programme: {
      label: "Perencanaan program YG",
      layers: ["social_forestry_intervention_yg", "perhutanan_sosial_riau", "gambut_bbsdlp_2019", "rtrw_riau_2018_2038"]
    }
  };

  function session() {
    return window.YG_STAFF_DATA && window.YG_STAFF_DATA.session
      ? window.YG_STAFF_DATA.session()
      : null;
  }

  const escapeHtml = value => String(value == null ? "" : value)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#039;");

  function firstObject() {
    for (const value of arguments) if (value && typeof value === "object") return value;
    return {};
  }

  async function staffApi(path) {
    const current = session();
    if (!current || !current.token) throw new Error("Login staf diperlukan.");
    const response = await fetch(API + path, {
      headers: { authorization: "Bearer " + current.token },
      cache: "no-store",
      credentials: "omit"
    });
    if (response.status === 401 || response.status === 403) throw new Error("Sesi staf berakhir. Silakan login kembali.");
    return response;
  }

  function catalogRows(catalog) {
    if (Array.isArray(catalog && catalog.datasets)) return catalog.datasets;
    if (Array.isArray(catalog && catalog.items)) return catalog.items;
    if (Array.isArray(catalog && catalog.records)) return catalog.records;
    return [];
  }

  function normalizeCatalogItem(row) {
    const artifacts = firstObject(row.artifacts);
    const mirror = firstObject(row.mirror, row.ingest, row.replica);
    const objects = firstObject(row.objects, mirror.objects);
    const display = firstObject(artifacts.display, mirror.display, objects.display, row.displayObject);
    const metadata = firstObject(row.metadata);
    const conflicts = [
      ...(Array.isArray(row.conflicts) ? row.conflicts : Array.isArray(metadata.conflicts) ? metadata.conflicts : []),
      ...(Array.isArray(row.qaWarnings) ? row.qaWarnings : [])
    ];
    const uuid = String(row.datasetUuid || row.uuid || row.id || "").toLowerCase();
    const displayReady = display.available === true && String(display.status || "").toLowerCase() === "ready";
    const publisher = row.publisher || row.organization || (row.opd && (row.opd.nama_opd || row.opd.name)) || row.opd;
    const theme = (row.theme && typeof row.theme === "object" ? row.theme.name || row.theme.code : row.theme) || row.kugiTheme || row.topicCategory;
    return {
      uuid,
      title: String(row.title || row.name || "Dataset tanpa judul"),
      publisher: String(publisher || "Penerbit belum dicantumkan"),
      theme: String(theme || "Tema belum diklasifikasikan"),
      displayReady,
      displayBytes: Number(display.bytes || row.displayBytes || 0),
      featureCount: Number(display.featureCount || row.featureCount || 0),
      warningCount: conflicts.length
    };
  }

  function colorFor(uuid) {
    let hash = 0;
    for (const char of uuid) hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
    return CATALOG_COLORS[Math.abs(hash) % CATALOG_COLORS.length];
  }

  async function readJsonWithinLimit(response, maxBytes) {
    const statedLength = response.headers.get("content-length"), statedBytes = Number(statedLength);
    if (statedLength && (!Number.isSafeInteger(statedBytes) || statedBytes < 1)) throw new Error("Ukuran turunan peta tidak valid.");
    if (statedLength && statedBytes > maxBytes) throw new Error("Layer terlalu besar untuk tampilan browser.");
    if (!response.body || !response.body.getReader) {
      const text = await response.text();
      if (new TextEncoder().encode(text).length > maxBytes) throw new Error("Layer melampaui batas aman browser.");
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
        throw new Error("Layer melampaui batas aman browser.");
      }
      chunks.push(result.value);
    }
    if (!received) throw new Error("Layer peta kosong.");
    const bytes = new Uint8Array(received);
    let offset = 0;
    chunks.forEach(chunk => { bytes.set(chunk, offset); offset += chunk.byteLength; });
    return JSON.parse(new TextDecoder().decode(bytes));
  }

  function catalogPopup(item, properties) {
    const rows = Object.entries(properties || {})
      .filter(([, value]) => value != null && value !== "" && typeof value !== "object")
      .slice(0, 10);
    return `<strong>${escapeHtml(item.title)}</strong><dl>${rows.map(([key, value]) => `<div><dt>${escapeHtml(key)}</dt><dd>${escapeHtml(String(value).slice(0, 500))}</dd></div>`).join("")}</dl>`;
  }

  function updateCatalogSummary(panel) {
    const readyCount = catalogState.items.length;
    const activeCount = catalogState.active.size;
    panel.querySelector("[data-riau-ready-count]").textContent = readyCount.toLocaleString("id-ID") + " siap peta";
    panel.querySelector("[data-riau-active-count]").textContent = activeCount + "/" + MAX_ACTIVE_CATALOG_LAYERS + " aktif";
    panel.querySelector("[data-riau-catalog-clear]").disabled = activeCount === 0;
  }

  function filteredCatalogItems(panel) {
    const query = panel.querySelector("[data-riau-catalog-search]").value.trim().toLocaleLowerCase("id");
    const theme = panel.querySelector("[data-riau-catalog-theme]").value;
    return catalogState.items.filter(item => {
      const haystack = [item.title, item.publisher, item.theme].join(" ").toLocaleLowerCase("id");
      return (!query || haystack.includes(query)) && (!theme || item.theme === theme);
    });
  }

  function renderCatalogItems(panel) {
    const list = panel.querySelector("[data-riau-catalog-list]");
    const rows = filteredCatalogItems(panel);
    updateCatalogSummary(panel);
    if (!rows.length) {
      list.innerHTML = '<small class="riau-reference-empty">Tidak ada layer siap-peta yang cocok.</small>';
      return;
    }
    list.innerHTML = rows.map(item => {
      const active = catalogState.active.has(item.uuid), pending = catalogState.pending.has(item.uuid), color = colorFor(item.uuid);
      return `<label class="riau-reference-layer${active ? " is-active" : ""}" data-riau-uuid="${escapeHtml(item.uuid)}">
        <input type="checkbox" data-riau-catalog-layer="${escapeHtml(item.uuid)}"${active ? " checked" : ""}${pending ? " disabled" : ""}>
        <i style="--riau-layer-color:${escapeHtml(color)}"></i>
        <span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.publisher)} · ${escapeHtml(item.theme)}</small>${item.warningCount ? `<em>${item.warningCount} catatan metadata</em>` : ""}</span>
      </label>`;
    }).join("");
  }

  function fillCatalogThemes(panel) {
    const select = panel.querySelector("[data-riau-catalog-theme]");
    const themes = Array.from(new Set(catalogState.items.map(item => item.theme))).sort((a, b) => a.localeCompare(b, "id"));
    select.innerHTML = '<option value="">Semua tema</option>' + themes.map(theme => `<option value="${escapeHtml(theme)}">${escapeHtml(theme)}</option>`).join("");
  }

  async function loadCatalog(panel) {
    const status = panel.querySelector("[data-riau-catalog-status]");
    status.classList.remove("is-error");
    status.textContent = "Memuat katalog privat…";
    try {
      const response = await staffApi(CATALOG_PATH);
      if (!response.ok) throw new Error("Katalog Geoportal belum dapat dimuat (" + response.status + ").");
      const rows = catalogRows(await response.json());
      catalogState.items = rows.map(normalizeCatalogItem)
        .filter(item => item.displayReady && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(item.uuid))
        .sort((a, b) => a.title.localeCompare(b.title, "id"));
      fillCatalogThemes(panel);
      renderCatalogItems(panel);
      status.textContent = catalogState.items.length.toLocaleString("id-ID") + " layer siap-peta tersedia. Data baru dimuat setelah dicentang.";
    } catch (error) {
      status.classList.add("is-error");
      status.textContent = error.message || "Katalog Geoportal belum dapat dimuat.";
    }
  }

  function removeCatalogLayer(uuid, panel) {
    const entry = catalogState.active.get(uuid), mapApi = window.YG_MAP;
    if (entry && mapApi && mapApi.map && mapApi.map.hasLayer(entry.layer)) mapApi.map.removeLayer(entry.layer);
    catalogState.active.delete(uuid);
    renderCatalogItems(panel);
  }

  function clearCatalogLayers(panel) {
    Array.from(catalogState.active.keys()).forEach(uuid => removeCatalogLayer(uuid, panel));
    panel.querySelector("[data-riau-catalog-status]").textContent = "Layer Geoportal dimatikan; layer program YG tidak berubah.";
  }

  async function toggleCatalogLayer(item, checked, panel) {
    const status = panel.querySelector("[data-riau-catalog-status]"), mapApi = window.YG_MAP;
    if (!checked) return removeCatalogLayer(item.uuid, panel);
    if (!mapApi || !mapApi.map || !window.L) {
      status.classList.add("is-error");
      status.textContent = "Peta utama belum siap. Muat ulang halaman.";
      return renderCatalogItems(panel);
    }
    if (catalogState.active.size + catalogState.pending.size >= MAX_ACTIVE_CATALOG_LAYERS) {
      status.classList.add("is-error");
      status.textContent = "Maksimal tiga layer Geoportal aktif. Matikan satu layer terlebih dahulu.";
      return renderCatalogItems(panel);
    }
    catalogState.pending.add(item.uuid);
    renderCatalogItems(panel);
    status.classList.remove("is-error");
    status.textContent = "Memuat “" + item.title + "”…";
    try {
      if (item.displayBytes > MAX_DISPLAY_BYTES) throw new Error("Layer terlalu besar untuk tampilan browser.");
      const response = await staffApi(`/api/staff/riau-geoportal/datasets/${encodeURIComponent(item.uuid)}/display`);
      if (!response.ok) throw new Error("Layer belum tersedia (" + response.status + ").");
      const geojson = await readJsonWithinLimit(response, MAX_DISPLAY_BYTES);
      if (!geojson || geojson.type !== "FeatureCollection" || !Array.isArray(geojson.features)) throw new Error("Format GeoJSON tidak valid.");
      if (geojson.features.length > MAX_DISPLAY_FEATURES) throw new Error("Jumlah fitur melampaui batas aman peta.");
      const color = colorFor(item.uuid);
      const layer = L.geoJSON(geojson, {
        pane: "yg-reference-pane",
        renderer: L.svg({ pane: "yg-reference-pane", padding: .5 }),
        style: { color, weight: 1.5, opacity: .92, fillColor: color, fillOpacity: .2 },
        pointToLayer(feature, latlng) { return L.circleMarker(latlng, { pane: "yg-reference-pane", radius: 5, color: "#fff", weight: 1, fillColor: color, fillOpacity: .9 }); },
        onEachFeature(feature, featureLayer) { featureLayer.bindPopup(catalogPopup(item, feature && feature.properties), { maxWidth: 360 }); }
      }).addTo(mapApi.map);
      catalogState.active.set(item.uuid, { item, layer });
      const bounds = layer.getBounds && layer.getBounds();
      if (bounds && bounds.isValid()) mapApi.map.fitBounds(bounds, { padding: [20, 20], maxZoom: 12, animate: false });
      if (window.matchMedia("(max-width: 760px)").matches && window.YG_UI && typeof window.YG_UI.closeMobileSidebar === "function") window.YG_UI.closeMobileSidebar();
      requestAnimationFrame(() => mapApi.map.invalidateSize(false));
      status.textContent = geojson.features.length.toLocaleString("id-ID") + " fitur ditampilkan: “" + item.title + "”.";
    } catch (error) {
      status.classList.add("is-error");
      status.textContent = item.title + " gagal dimuat: " + (error.message || "kesalahan tidak diketahui");
    } finally {
      catalogState.pending.delete(item.uuid);
      renderCatalogItems(panel);
    }
  }

  function referenceInputs() {
    return Array.from(document.querySelectorAll("input[data-reference-layer-id]"));
  }

  function toggleInput(input, checked) {
    if (!input || input.checked === checked) return;
    input.checked = checked;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function waitUntilSettled(input, timeoutMs) {
    return new Promise(resolve => {
      const started = Date.now();
      const check = () => {
        if (!input.disabled || Date.now() - started >= timeoutMs) return resolve();
        window.setTimeout(check, 120);
      };
      window.setTimeout(check, 0);
    });
  }

  function whenReferenceInputsReady(callback, status, attempts, onFailure) {
    if (referenceInputs().length) return callback();
    if (attempts <= 0) {
      status.textContent = "Kontrol layer belum siap. Muat ulang halaman atau periksa koneksi data.";
      if (typeof onFailure === "function") onFailure();
      return;
    }
    status.textContent = "Menunggu daftar layer selesai disiapkan…";
    window.setTimeout(() => whenReferenceInputsReady(callback, status, attempts - 1, onFailure), 250);
  }

  async function applyPreset(name, status) {
    const preset = PRESETS[name];
    if (!preset) return;
    const wanted = new Set(preset.layers);
    const inputs = referenceInputs();
    const available = new Set(inputs.map(input => input.dataset.referenceLayerId));
    const missing = preset.layers.filter(id => !available.has(id));

    inputs.forEach(input => {
      if (!wanted.has(input.dataset.referenceLayerId)) toggleInput(input, false);
    });
    for (const layerId of preset.layers) {
      const input = inputs.find(row => row.dataset.referenceLayerId === layerId);
      if (!input || input.checked) continue;
      toggleInput(input, true);
      await waitUntilSettled(input, 30000);
    }
    status.textContent = "Preset “" + preset.label + "” diterapkan. Layer dimuat satu per satu agar peta tetap ringan." +
      (missing.length ? " " + missing.length + " layer internal belum tersedia pada sesi ini." : "");
  }

  function clearReferenceLayers(status) {
    referenceInputs().forEach(input => toggleInput(input, false));
    status.textContent = "Seluruh layer referensi dinonaktifkan. Layer program YG tidak diubah.";
  }

  function createPanel() {
    if (!session() || document.querySelector(".riau-reference-panel")) return;
    const layerPanel = document.getElementById("layer-list")?.closest(".panel");
    if (!layerPanel) return;

    const panel = document.createElement("section");
    panel.className = "panel riau-reference-panel";
    panel.innerHTML = `
      <div class="riau-reference-head">
        <h2 class="panel-title">Peta Referensi Riau <small>analisis lintas sektor</small></h2>
        <span class="riau-reference-badge">INTERNAL STAF</span>
      </div>
      <p>Gabungkan layer yang sudah tervalidasi. Preset tidak mengubah data program dan tidak mempublikasikan data privat.</p>
      <div class="riau-reference-preset">
        <select aria-label="Preset analisis Peta Referensi Riau">
          ${Object.entries(PRESETS).map(([id, row]) => `<option value="${id}">${row.label}</option>`).join("")}
        </select>
        <button type="button" data-riau-apply>Terapkan</button>
      </div>
      <div class="riau-reference-actions">
        <button type="button" data-riau-clear>Matikan referensi</button>
        <a href="staff-riau-reference.html">Katalog Riau Geoportal →</a>
        <a href="staff-rdtr-bagansiapiapi.html">Kajian RDTR Bagansiapiapi →</a>
      </div>
      <small class="riau-reference-status" aria-live="polite">Pilih preset; tidak ada layer berat yang diaktifkan otomatis.</small>
      <details class="riau-reference-catalog" open>
        <summary>Layer Geoportal siap peta <span data-riau-ready-count>Memuat…</span></summary>
        <div class="riau-reference-catalog-tools">
          <input type="search" data-riau-catalog-search placeholder="Cari data, OPD, atau tema…" aria-label="Cari layer Geoportal Riau">
          <select data-riau-catalog-theme aria-label="Filter tema Geoportal Riau"><option value="">Semua tema</option></select>
        </div>
        <div class="riau-reference-catalog-head"><strong data-riau-active-count>0/3 aktif</strong><div><button type="button" data-riau-catalog-refresh>Muat ulang</button><button type="button" data-riau-catalog-clear disabled>Matikan layer</button></div></div>
        <div class="riau-reference-layer-list" data-riau-catalog-list><small class="riau-reference-empty">Memuat katalog privat…</small></div>
        <small class="riau-reference-catalog-status" data-riau-catalog-status aria-live="polite">Memeriksa layer siap-peta…</small>
      </details>`;

    layerPanel.parentNode.insertBefore(panel, layerPanel);
    const status = panel.querySelector(".riau-reference-status");
    panel.querySelector("[data-riau-apply]").addEventListener("click", event => {
      const button = event.currentTarget;
      button.disabled = true;
      whenReferenceInputsReady(
        () => applyPreset(panel.querySelector("select").value, status)
          .finally(() => { button.disabled = false; }),
        status,
        20,
        () => { button.disabled = false; }
      );
    });
    panel.querySelector("[data-riau-clear]").addEventListener("click", () => {
      clearReferenceLayers(status);
      clearCatalogLayers(panel);
    });
    panel.querySelector("[data-riau-catalog-search]").addEventListener("input", () => renderCatalogItems(panel));
    panel.querySelector("[data-riau-catalog-theme]").addEventListener("change", () => renderCatalogItems(panel));
    panel.querySelector("[data-riau-catalog-refresh]").addEventListener("click", () => loadCatalog(panel));
    panel.querySelector("[data-riau-catalog-clear]").addEventListener("click", () => clearCatalogLayers(panel));
    panel.querySelector("[data-riau-catalog-list]").addEventListener("change", event => {
      const checkbox = event.target.closest("input[data-riau-catalog-layer]");
      if (!checkbox) return;
      const item = catalogState.items.find(row => row.uuid === checkbox.dataset.riauCatalogLayer);
      if (item) toggleCatalogLayer(item, checkbox.checked, panel);
    });
    loadCatalog(panel);

    const params = new URLSearchParams(location.search);
    if (params.get("workspace") === "riau-reference") {
      panel.scrollIntoView({ block: "start" });
      const requested = params.get("preset");
      if (requested && PRESETS[requested]) {
        panel.querySelector("select").value = requested;
        whenReferenceInputsReady(() => applyPreset(requested, status), status, 20);
      }
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => window.setTimeout(createPanel, 100));
  } else {
    window.setTimeout(createPanel, 100);
  }
})();
