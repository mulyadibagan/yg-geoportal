(function () {
  "use strict";

  const API = "https://yg-webgis-public-data.yg-webgis-public-data-worker.workers.dev";
  const CATALOG_PATH = "/api/staff/riau-geoportal/catalog";
  const MAX_ACTIVE_CATALOG_LAYERS = 8;
  const MAX_DISPLAY_BYTES = 12 * 1024 * 1024;
  const MAX_DISPLAY_FEATURES = 25000;
  const CATALOG_COLORS = ["#08765f", "#d97706", "#2563a8", "#9b3f73", "#65752b", "#7a4bb7"];
  const catalogState = { items: [], active: new Map(), pending: new Set(), loading: false };

  const PRESETS = {
    baseline: {
      label: "Dasar provinsi",
      layers: ["batas_administrasi_desa_riau", "rtrw_riau_2018_2038"]
    },
    spatial_ecology: {
      label: "Tata ruang & ekologi",
      layers: ["rtrw_riau_2018_2038", "pptpkh_riau_2023", "kawasan_hutan_sk_903", "gambut_bbsdlp_2019", "feg_sk130_riau"]
    },
    governance: {
      label: "Izin & wilayah kelola",
      layers: ["pbph_riau_052026", "perusahaan_sawit_riau", "perhutanan_sosial_riau", "kph_2019_riau"]
    },
    programme: {
      label: "Perencanaan program YG",
      layers: ["social_forestry_intervention_yg", "perhutanan_sosial_riau", "pptpkh_riau_2023", "gambut_bbsdlp_2019", "feg_sk130_riau", "rtrw_riau_2018_2038"]
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

  async function staffApi(path, signal) {
    const current = session();
    if (!current || !current.token) throw new Error("Login staf diperlukan.");
    const response = await fetch(API + path, {
      headers: { authorization: "Bearer " + current.token },
      cache: "no-store",
      credentials: "omit", signal
    });
    if (response.status === 401 || response.status === 403) throw new Error("Sesi staf berakhir. Silakan login kembali.");
    return response;
  }

  async function boundedRequest(action) {
    const controller = new AbortController();
    let timer;
    try {
      return await Promise.race([action(controller.signal), new Promise((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error("Koneksi katalog melewati 20 detik. Klik Muat ulang untuk mencoba lagi."));
          controller.abort();
        }, 20000);
      })]);
    } finally { clearTimeout(timer); }
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
    const publisherValue = row.opd || row.publisher || row.organization;
    const publisher = publisherValue && typeof publisherValue === "object" ? publisherValue.nama_opd || publisherValue.name || publisherValue.title : publisherValue;
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

  function renderCatalogItems(panel) {
    const list = panel.querySelector("[data-riau-catalog-list]");
    const rows = catalogState.items;
    const opened = new Set(Array.from(list.querySelectorAll("details[open]")).map(el => el.dataset.opd));
    updateCatalogSummary(panel);
    if (!rows.length) {
      list.innerHTML = '<small class="riau-reference-empty">Tidak ada layer siap-peta yang cocok.</small>';
      return;
    }
    const groups = new Map();
    rows.forEach(item => { if (!groups.has(item.publisher)) groups.set(item.publisher, []); groups.get(item.publisher).push(item); });
    list.innerHTML = Array.from(groups).sort(([a], [b]) => a.localeCompare(b, "id")).map(([publisher, items]) => `<details class="riau-reference-opd" data-opd="${escapeHtml(publisher)}"${opened.has(publisher) ? " open" : ""}><summary>${escapeHtml(publisher)}<span>${items.length} layer</span></summary><div>${items.map(item => {
      const active = catalogState.active.has(item.uuid), pending = catalogState.pending.has(item.uuid), color = colorFor(item.uuid);
      return `<label class="riau-reference-layer${active ? " is-active" : ""}" data-riau-uuid="${escapeHtml(item.uuid)}">
        <input type="checkbox" data-riau-catalog-layer="${escapeHtml(item.uuid)}"${active ? " checked" : ""}${pending ? " disabled" : ""}>
        <i style="--riau-layer-color:${escapeHtml(color)}"></i>
        <span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.publisher)}</small>${item.warningCount ? `<em>${item.warningCount} catatan metadata</em>` : ""}</span>
      </label>`;
    }).join("")}</div></details>`).join("");
  }

  async function loadCatalog(panel) {
    if (catalogState.loading) return;
    catalogState.loading = true;
    const refresh = panel.querySelector("[data-riau-catalog-refresh]");
    refresh.disabled = true;
    const token = session()?.token;
    const status = panel.querySelector("[data-riau-catalog-status]");
    panel.querySelector("[data-riau-ready-count]").textContent = "Memuat…";
    status.classList.remove("is-error");
    status.textContent = "Memuat katalog privat…";
    try {
      const data = await boundedRequest(async signal => {
        const response = await staffApi(CATALOG_PATH, signal);
        if (!response.ok) throw new Error("Katalog Geoportal belum dapat dimuat (" + response.status + ").");
        return response.json();
      });
      if (!token || session()?.token !== token) throw new Error("Sesi staf berubah. Silakan buka ulang peta setelah login.");
      const rows = catalogRows(data);
      catalogState.items = rows.map(normalizeCatalogItem)
        .filter(item => item.displayReady && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(item.uuid))
        .sort((a, b) => a.title.localeCompare(b.title, "id"));
      renderCatalogItems(panel);
      status.textContent = catalogState.items.length.toLocaleString("id-ID") + " layer siap-peta tersedia. Data baru dimuat setelah dicentang.";
    } catch (error) {
      status.classList.add("is-error");
      status.textContent = error.message || "Katalog Geoportal belum dapat dimuat.";
      panel.querySelector("[data-riau-ready-count]").textContent = catalogState.items.length ? "Pembaruan gagal" : "Belum tersedia";
      if (!catalogState.items.length) panel.querySelector("[data-riau-catalog-list]").innerHTML = '<small class="riau-reference-empty">Katalog belum tersedia. Gunakan tombol Muat ulang.</small>';
    } finally {
      catalogState.loading = false;
      refresh.disabled = false;
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
      status.textContent = "Maksimal delapan layer Geoportal aktif. Matikan satu layer terlebih dahulu.";
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


  function addMeritech(panel) {
    const box=document.createElement('div');
    box.className='riau-reference-catalog';
    box.innerHTML='<h3>Citra drone · Meritech</h3><label><input type="checkbox" data-meritech-toggle> Tampilkan layer Meritech</label><label style="display:block;margin-top:10px"><input type="checkbox" data-meritech-coverage> Garis area citra terdeteksi</label><small style="display:block">Garis biru: batas tile yang berhasil dimuat, bukan batas survei resmi. Klik garis atau penanda untuk membuka citra. Area tanpa garis belum dipastikan; kegagalan koneksi tidak dianggap tanpa citra.</small><small data-meritech-coverage-count style="display:block" aria-live="polite"></small><label style="display:block;margin-top:10px">Transparansi <input type="range" min="0" max="1" step="0.05" value="0.85" data-meritech-opacity aria-label="Transparansi citra Meritech"></label><p><button type="button" data-meritech-zoom>Perbesar lokasi ini</button> <button type="button" data-meritech-example>Lihat contoh Bengkalis</button></p><button type="button" data-meritech-retry style="display:block;margin:8px 0">Muat ulang citra</button><small data-meritech-status aria-live="polite">Citra detail ditampilkan mulai zoom 17. Klik Perbesar lokasi ini atau Lihat contoh Bengkalis.</small><p><small>Sumber: petadasar.meritech.cloud. Tanggal perekaman, resolusi, dan cakupan lengkap belum terverifikasi.</small></p>';
    panel.appendChild(box);
    const toggle=box.querySelector('[data-meritech-toggle]'), opacity=box.querySelector('[data-meritech-opacity]'), status=box.querySelector('[data-meritech-status]');
    let layer=null, map=null, loaded=0, failed=0, loadTimer=null;
    
    const coverageToggle=box.querySelector('[data-meritech-coverage]');
    const footprints=new Map();
    let coverage=null, coverageMap=null, coverageWait=null;
    function tileBounds(c){
      const n=Math.pow(2,c.z);
      const latitude=y=>Math.atan(Math.sinh(Math.PI*(1-2*y/n)))*180/Math.PI;
      return [[latitude(c.y+1),c.x/n*360-180],[latitude(c.y),(c.x+1)/n*360-180]];
    }
    function openFootprint(bounds){
      if(!session()||!coverageMap)return;
      coverageMap.setView(L.latLngBounds(bounds).getCenter(),17);
      if(!toggle.checked)status.textContent='Lokasi siap. Centang Tampilkan layer Meritech untuk memuat citra.';
    }
    function rememberTile(c){
      if(!session()||!coverageToggle.checked||!coverage||!c)return;
      const key=c.z+'/'+c.x+'/'+c.y;
      if(footprints.has(key)||footprints.size>=2000)return;
      const bounds=tileBounds(c);
      const outline=L.rectangle(bounds,{color:'#38bdf8',weight:2,fillOpacity:0.035,dashArray:'5 3'});
      outline.bindTooltip('Citra Meritech terdeteksi · klik untuk memperbesar');
      outline.on('click',()=>openFootprint(bounds));
      coverage.addLayer(outline);
      footprints.set(key,outline);
      box.querySelector('[data-meritech-coverage-count]').textContent=footprints.size+' tile terdeteksi. Indeks belum lengkap; bertambah saat citra dibuka (maks. 2.000 tile per sesi).';
    }
    function initCoverage(attempts){
      if(!session()||!coverageToggle.checked)return;
      coverageMap=window.YG_MAP?.map;
      if(!coverageMap||!window.L){
        if(attempts>0)coverageWait=setTimeout(()=>initCoverage(attempts-1),500);
        return;
      }
      if(coverage)return;
      coverage=L.featureGroup();
      if(coverageToggle.checked)coverage.addTo(coverageMap);
      // XYZ tile visually verified on 2026-10-06; this is a tile extent, not a survey footprint.
      rememberTile({z:17,x:102716,y:64997});
      L.circleMarker([1.48,102.12],{radius:6,color:'#fff',weight:2,fillColor:'#0284c7',fillOpacity:1})
        .bindTooltip('Citra Meritech terverifikasi · Bengkalis')
        .on('click',()=>openFootprint(tileBounds({z:17,x:102716,y:64997}))).addTo(coverage);
    }
    coverageToggle.addEventListener('change',()=>{
      initCoverage(0);
      if(!coverageMap||!coverage)return;
      if(coverageToggle.checked)coverage.addTo(coverageMap);else coverageMap.removeLayer(coverage);
    });
    function clearCoverage(){
      clearTimeout(coverageWait);
      if(coverage&&coverageMap)coverageMap.removeLayer(coverage);
      coverageToggle.checked=false;
    }
    // Coverage is initialized only after its checkbox is selected.

    function zoomHint(){if(toggle.checked&&map&&map.getZoom()<17){clearTimeout(loadTimer);status.textContent='Peta masih terlalu jauh. Klik Perbesar lokasi ini atau Lihat contoh Bengkalis untuk membuka citra pada zoom 17.';}}
    function remove(){clearTimeout(loadTimer);if(map)map.off('zoomend',zoomHint);if(layer&&map)map.removeLayer(layer);layer=null;toggle.checked=false;}
    toggle.addEventListener('change',()=>{
      if(!toggle.checked){remove();status.textContent='Layer Meritech dinonaktifkan.';return;}
      map=window.YG_MAP?.map;
      if(!session()||!map||!window.L){remove();status.textContent='Peta atau sesi staf belum siap. Silakan coba kembali.';return;}
      if(!map.getPane('yg-meritech-pane')){const pane=map.createPane('yg-meritech-pane');pane.style.zIndex='250';pane.style.pointerEvents='none';}
      loaded=failed=0;
      map.on('zoomend',zoomHint);
      layer=L.tileLayer('https://petadasar.meritech.cloud/tile/{z}/{x}/{y}.jpg',{
        pane:'yg-meritech-pane',minZoom:17,maxZoom:22,maxNativeZoom:19,opacity:Number(opacity.value),
        updateWhenIdle:true,updateWhenZooming:false,keepBuffer:1,
        attribution:'Citra: Meritech · tanggal belum terverifikasi'
      });
      layer.on('loading',()=>{loaded=failed=0;clearTimeout(loadTimer);status.textContent='Memuat citra Meritech pada area tampilan…';loadTimer=setTimeout(()=>{status.textContent='Layanan Meritech belum merespons setelah 30 detik. Klik Muat ulang citra untuk mencoba lagi.';},30000);});
      layer.on('tileload',event=>{loaded++;rememberTile(event.coords);});
      layer.on('tileerror',()=>failed++);
      layer.on('load',()=>{clearTimeout(loadTimer);status.textContent=loaded
        ?'Citra Meritech berhasil dimuat.'+(failed?' Sebagian tile tidak tersedia pada area ini.':'')
        :'Citra belum tersedia pada area/zoom ini atau layanan sumber tidak dapat dijangkau. Geser peta atau ubah zoom.';});
      layer.addTo(map);
      zoomHint();
    });
    function focusImagery(example){
      const targetMap=window.YG_MAP?.map;
      if(!session()||!targetMap){status.textContent='Peta atau sesi staf belum siap.';return;}
      targetMap.setView(example?[1.48,102.12]:targetMap.getCenter(),17);
      if(!toggle.checked)status.textContent='Lokasi siap. Centang Tampilkan layer Meritech untuk memuat citra.';
    }
    box.querySelector('[data-meritech-zoom]').addEventListener('click',()=>focusImagery(false));
    box.querySelector('[data-meritech-example]').addEventListener('click',()=>focusImagery(true));
    box.querySelector('[data-meritech-retry]').addEventListener('click',()=>{if(!toggle.checked){status.textContent='Centang Tampilkan layer Meritech terlebih dahulu.';return;}remove();toggle.checked=true;toggle.dispatchEvent(new Event('change'));});
    opacity.addEventListener('input',()=>layer?.setOpacity(Number(opacity.value)));
    panel.querySelector('[data-riau-clear]').addEventListener('click',()=>{remove();clearCoverage();status.textContent='Layer Meritech dinonaktifkan.';});
    const timer=setInterval(()=>{if(!session()){remove();clearCoverage();box.remove();clearInterval(timer);}},15000);
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
      <p>Buka OPD untuk melihat data yang tersedia, lalu centang layer yang ingin ditampilkan.</p>
      <div class="riau-reference-actions">
        <button type="button" data-riau-clear>Matikan referensi</button>
        <a href="staff-riau-reference.html">Katalog Riau Geoportal →</a>
        <a href="staff-rdtr-bagansiapiapi.html">Kajian RDTR Bagansiapiapi →</a>
      </div>
      <small class="riau-reference-status" aria-live="polite">Layer dimuat setelah dipilih.</small>
      <details class="riau-reference-catalog" open>
        <summary>Data berdasarkan OPD <span data-riau-ready-count>Memuat…</span></summary>
        <div class="riau-reference-catalog-head"><strong data-riau-active-count>0/8 aktif</strong><div><button type="button" data-riau-catalog-refresh>Muat ulang</button><button type="button" data-riau-catalog-clear disabled>Matikan layer</button></div></div>
        <div class="riau-reference-layer-list" data-riau-catalog-list><small class="riau-reference-empty">Memuat katalog privat…</small></div>
        <small class="riau-reference-catalog-status" data-riau-catalog-status aria-live="polite">Memeriksa layer siap-peta…</small>
      </details>`;

    layerPanel.parentNode.appendChild(panel);
    const status = panel.querySelector(".riau-reference-status");
    panel.querySelector("[data-riau-clear]").addEventListener("click", () => {
      clearReferenceLayers(status);
      clearCatalogLayers(panel);
    });
    panel.querySelector("[data-riau-catalog-refresh]").addEventListener("click", () => loadCatalog(panel));
    panel.querySelector("[data-riau-catalog-clear]").addEventListener("click", () => clearCatalogLayers(panel));
    panel.querySelector("[data-riau-catalog-list]").addEventListener("change", event => {
      const checkbox = event.target.closest("input[data-riau-catalog-layer]");
      if (!checkbox) return;
      const item = catalogState.items.find(row => row.uuid === checkbox.dataset.riauCatalogLayer);
      if (item) toggleCatalogLayer(item, checkbox.checked, panel);
    });
    addMeritech(panel);
    loadCatalog(panel);

    const params = new URLSearchParams(location.search);
    if (params.get("workspace") === "riau-reference") {
      panel.scrollIntoView({ block: "start" });

    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => window.setTimeout(createPanel, 100));
  } else {
    window.setTimeout(createPanel, 100);
  }
})();
