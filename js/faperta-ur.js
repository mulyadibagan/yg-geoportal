(() => {
  "use strict";
  const DATA_URL = "data/faperta-ur.json?v=20260910-1";
  const BOUNDARY_URL = "data/faperta-ur-site.geojson?v=20260910-1";
  const state = { data: null, boundary: null, map: null, boundaryLayer: null };
  const $ = (selector) => document.querySelector(selector);
  const all = (selector) => Array.from(document.querySelectorAll(selector));
  const num = (value, digits = 2) => new Intl.NumberFormat("id-ID", { maximumFractionDigits: digits }).format(Number(value) || 0);

  function emptyMessage(title, detail) {
    return `<span><strong>${title}</strong><br>${detail}</span>`;
  }

  function renderSummary() {
    const d = state.data;
    const blocks = d.blocks || [];
    const activeCycles = (d.crop_cycles || []).filter((x) => x.status === "active");
    $("#metric-blocks").textContent = blocks.length;
    $("#metric-area").textContent = num(blocks.reduce((sum, x) => sum + Number(x.area_ha || 0), 0), 2);
    $("#metric-cycles").textContent = activeCycles.length;
    $("#kpi-plots").textContent = (d.plots || []).filter((x) => x.status !== "closed").length;
    const tasks = d.scheduled_tasks || [];
    const done = tasks.filter((x) => x.status === "done").length;
    $("#kpi-realization").textContent = tasks.length ? num(done * 100 / tasks.length, 1) + "%" : "0%";
    const latest = (d.monitoring || []).slice().sort((a, b) => String(b.observed_at).localeCompare(String(a.observed_at)))[0];
    $("#kpi-monitoring").textContent = latest ? new Date(latest.observed_at).toLocaleDateString("id-ID") : "–";
    const harvests = d.harvests || [];
    const kg = harvests.reduce((sum, x) => sum + Number(x.net_kg || 0), 0);
    $("#kpi-yield").textContent = harvests.length ? num(kg, 1) + " kg" : "–";
  }

  function taskDate(task, cycle) {
    if (task.due_date) return new Date(task.due_date + "T00:00:00");
    if (!cycle || !cycle.planted_at || !Number.isFinite(Number(task.hst_offset))) return null;
    const date = new Date(cycle.planted_at + "T00:00:00");
    date.setDate(date.getDate() + Number(task.hst_offset));
    return date;
  }

  function classifyTasks() {
    const d = state.data;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const cycles = Object.fromEntries((d.crop_cycles || []).map((x) => [x.id, x]));
    return (d.scheduled_tasks || []).filter((x) => x.status !== "done").map((task) => {
      const due = taskDate(task, cycles[task.crop_cycle_id]);
      let bucket = "upcoming";
      if (due && due.getTime() === today.getTime()) bucket = "today";
      if (due && due < today) bucket = "overdue";
      return { ...task, due, bucket };
    });
  }

  function renderTasks() {
    const tasks = classifyTasks();
    ["today", "upcoming", "overdue"].forEach((bucket) => {
      $("#count-" + bucket).textContent = tasks.filter((x) => x.bucket === bucket).length;
    });
    $("#today-tasks").innerHTML = tasks.length
      ? tasks.slice(0, 6).map((x) => `<div><strong>${x.title}</strong><small>${x.due ? x.due.toLocaleDateString("id-ID") : "Tanggal belum dihitung"}</small></div>`).join("")
      : emptyMessage("Belum ada pekerjaan terjadwal", "Buat plot dan crop cycle, lalu hubungkan SOP resmi yang telah disetujui.");
    $("#calendar-list").innerHTML = tasks.length
      ? tasks.map((x) => `<article><strong>${x.title}</strong><span>${x.bucket} · ${x.due ? x.due.toLocaleDateString("id-ID") : "tanpa tanggal"}</span></article>`).join("")
      : emptyMessage("Kalender belum aktif", "Tidak ada tanggal atau dosis yang dibuat berdasarkan asumsi.");
  }

  function renderBlocks() {
    const byId = Object.fromEntries((state.boundary.features || []).map((x) => [x.properties.block_id, x.properties]));
    $("#block-list").innerHTML = state.data.blocks.map((block) => {
      const spatial = byId[block.id] || {};
      const pdf = spatial.pdf_reference_area_ha;
      return `<article><span>${block.id}</span><strong>${block.name}</strong><small>SHP: ${num(block.area_ha, 4)} ha</small><small>PDF: ${pdf ? num(pdf, 4) + " ha" : "–"}</small><button type="button" data-focus-block="${block.id}">Fokus di peta →</button></article>`;
    }).join("");
  }

  function renderCollections() {
    const d = state.data;
    const configs = [
      ["#plots-list", d.plots, "Belum ada Plot Budidaya", "Digitasi plot dilakukan di dalam salah satu boundary blok UPT."],
      ["#sop-list", d.sops, "Belum ada SOP resmi", "Template siap diisi setelah SOP Faperta UR diterima dan disahkan."],
      ["#monitoring-list", d.monitoring, "Belum ada monitoring", "Form pertumbuhan, survival, OPT, kondisi, dan foto akan mengikuti crop cycle."],
      ["#harvest-list", d.harvests, "Belum ada catatan panen", "Produktivitas akan dihitung dari hasil panen dan luas efektif plot."],
      ["#research-list", d.research, "Belum ada Research Plot", "Struktur protokol, perlakuan, variabel, dan peneliti sudah tersedia pada skema data."]
    ];
    configs.forEach(([selector, rows, title, detail]) => {
      $(selector).innerHTML = rows.length ? rows.map((x) => `<article><strong>${x.name || x.title || x.id}</strong></article>`).join("") : emptyMessage(title, detail);
    });
  }

  function initMap() {
    state.map = L.map("faperta-map", { zoomControl: true }).setView([0.4822, 101.3808], 16);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 20, attribution: "&copy; OpenStreetMap contributors" }).addTo(state.map);
    state.boundaryLayer = L.geoJSON(state.boundary, {
      style: { color: "#b7791f", weight: 3, fillColor: "#e5b64d", fillOpacity: .23 },
      onEachFeature(feature, layer) {
        const p = feature.properties;
        layer.bindPopup(`<strong>${p.name}</strong><span>${p.block_id} · ${num(p.source_area_ha, 4)} ha (SHP)</span><span>Status verifikasi luas: perlu rekonsiliasi</span>`);
      }
    }).addTo(state.map);
    state.map.fitBounds(state.boundaryLayer.getBounds(), { padding: [24, 24] });
    $("#fit-boundary").addEventListener("click", () => state.map.fitBounds(state.boundaryLayer.getBounds(), { padding: [24, 24] }));
  }

  function bindUi() {
    all(".fu-tabs button").forEach((button) => button.addEventListener("click", () => {
      all(".fu-tabs button").forEach((x) => x.classList.toggle("active", x === button));
      all(".fu-view").forEach((x) => x.classList.toggle("active", x.dataset.panel === button.dataset.view));
      if (button.dataset.view === "overview" && state.map) setTimeout(() => state.map.invalidateSize(), 0);
    }));
    $("#block-list").addEventListener("click", (event) => {
      const button = event.target.closest("[data-focus-block]");
      if (!button) return;
      const layer = state.boundaryLayer.getLayers().find((x) => x.feature.properties.block_id === button.dataset.focusBlock);
      if (layer) { state.map.fitBounds(layer.getBounds(), { maxZoom: 18, padding: [35, 35] }); layer.openPopup(); }
    });
  }

  async function boot() {
    try {
      const [dataResponse, boundaryResponse] = await Promise.all([fetch(DATA_URL), fetch(BOUNDARY_URL)]);
      if (!dataResponse.ok || !boundaryResponse.ok) throw new Error("Data workspace tidak dapat dimuat.");
      [state.data, state.boundary] = await Promise.all([dataResponse.json(), boundaryResponse.json()]);
      renderSummary(); renderTasks(); renderBlocks(); renderCollections(); initMap(); bindUi();
    } catch (error) {
      document.querySelector("main").innerHTML = `<div class="fu-empty"><span><strong>Workspace belum dapat dimuat</strong><br>${error.message}</span></div>`;
    }
  }
  boot();
})();
