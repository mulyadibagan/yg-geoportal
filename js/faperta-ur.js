(() => {
  "use strict";
  const DATA_URL = "data/faperta-ur.json?v=20260910-1";
  const BOUNDARY_URL = "data/faperta-ur-site.geojson?v=20260910-1";
  const WEATHER_CACHE_KEY = "yg-faperta-weather-v1";
  const WEATHER_CACHE_MS = 30 * 60 * 1000;
  const RAIN_CACHE_KEY = "yg-faperta-nasa-rain-v1";
  const RAIN_CACHE_MS = 6 * 60 * 60 * 1000;
  const WEATHER_URL = "https://api.open-meteo.com/v1/forecast?latitude=0.4822&longitude=101.3808&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum&forecast_days=7&timezone=Asia%2FJakarta";
  const state = { data: null, boundary: null, map: null, boundaryLayer: null, basemaps: {} };
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

  function configurePublicSections() {
    const d = state.data;
    const collections = {
      plots: d.plots || [],
      calendar: d.scheduled_tasks || [],
      sop: d.sops || [],
      monitoring: d.monitoring || [],
      harvest: d.harvests || [],
      research: d.research || []
    };
    let hasAdditionalSection = false;
    Object.entries(collections).forEach(([view, rows]) => {
      const available = rows.length > 0;
      const button = document.querySelector(`[data-view="${view}"]`);
      if (button) button.hidden = !available;
      hasAdditionalSection ||= available;
    });
    $("#module-tabs").hidden = !hasAdditionalSection;

    const activeCycles = (d.crop_cycles || []).filter((item) => item.status === "active");
    $("#metric-cycles-card").hidden = activeCycles.length === 0;

    const tasks = d.scheduled_tasks || [];
    $("#garden-activity").hidden = tasks.length === 0;
    $(".fu-layout").classList.toggle("public-map-only", tasks.length === 0);

    const hasProgress = [d.plots, d.crop_cycles, d.scheduled_tasks, d.realizations, d.monitoring, d.harvests]
      .some((rows) => Array.isArray(rows) && rows.length > 0);
    $("#garden-progress").hidden = !hasProgress;
  }


function weatherLabel(code) {
  const labels = {
    0: "Cerah", 1: "Cerah berawan", 2: "Berawan", 3: "Mendung",
    45: "Berkabut", 48: "Kabut tebal", 51: "Gerimis ringan", 53: "Gerimis",
    55: "Gerimis lebat", 61: "Hujan ringan", 63: "Hujan sedang", 65: "Hujan lebat",
    80: "Hujan setempat", 81: "Hujan sedang", 82: "Hujan lebat",
    95: "Hujan petir", 96: "Hujan petir", 99: "Hujan petir"
  };
  return labels[Number(code)] || "Cuaca berubah";
}

function renderWeather(weather) {
  const current = weather.current || {};
  const daily = weather.daily || {};
  const todayKey = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jakarta" });
  const rows = (daily.time || []).map((date, index) => ({
    date,
    code: daily.weather_code[index],
    min: daily.temperature_2m_min[index],
    max: daily.temperature_2m_max[index],
    rain: daily.precipitation_sum[index]
  }));
  const forecast = rows.filter((row) => row.date >= todayKey).slice(0, 7);
  $("#weather-current").innerHTML = [
    ["Suhu", num(current.temperature_2m, 1) + " °C"],
    ["Kelembapan", num(current.relative_humidity_2m, 0) + "%"],
    ["Kondisi model", weatherLabel(current.weather_code)],
    ["Angin", num(current.wind_speed_10m, 1) + " km/jam"]
  ].map(([label, value]) => `<article><small>${label}</small><strong>${value}</strong></article>`).join("");
  $("#weather-forecast").innerHTML = forecast.map((row) => {
    const day = new Intl.DateTimeFormat("id-ID", { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Jakarta" }).format(new Date(row.date + "T12:00:00+07:00"));
    return `<article><small>${day}</small><strong>${weatherLabel(row.code)}</strong><span>${num(row.min, 0)}–${num(row.max, 0)} °C</span><span>Hujan ${num(row.rain, 1)} mm</span></article>`;
  }).join("");
  $("#weather-updated").textContent = current.time
    ? "Model Open-Meteo · diperbarui " + new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }).format(new Date(current.time + ":00+07:00")) + " WIB"
    : "";
  $("#garden-weather").hidden = false;
}

function dateKey(date) {
  return date.toLocaleDateString("sv-SE", { timeZone: "Asia/Jakarta" }).replaceAll("-", "");
}

function nasaRainUrl() {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - 45);
  return "https://power.larc.nasa.gov/api/temporal/daily/point" +
    `?parameters=PRECTOTCORR&community=AG&longitude=101.3808&latitude=0.4822&start=${dateKey(start)}&end=${dateKey(end)}&format=JSON`;
}

function displayRainDate(key) {
  const iso = `${key.slice(0, 4)}-${key.slice(4, 6)}-${key.slice(6, 8)}`;
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" })
    .format(new Date(iso + "T12:00:00+07:00"));
}

function renderRainfall(payload, cached = false) {
  const values = payload?.properties?.parameter?.PRECTOTCORR || {};
  const rows = Object.entries(values)
    .map(([date, rain]) => ({ date, rain: Number(rain) }))
    .filter((row) => Number.isFinite(row.rain) && row.rain >= 0)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (!rows.length) throw new Error("Data hujan NASA belum tersedia");
  const total = (days) => rows.slice(-days).reduce((sum, row) => sum + row.rain, 0);
  const latest = rows[rows.length - 1].date;
  const sevenStart = rows[Math.max(0, rows.length - 7)].date;
  $("#rain-7d").textContent = num(total(7), 1) + " mm";
  $("#rain-30d").textContent = num(total(30), 1) + " mm";
  $("#rain-source-note").textContent =
    `Estimasi NASA POWER, bukan alat ukur lapangan. Periode 7 data terbaru: ${displayRainDate(sevenStart)}–${displayRainDate(latest)}${cached ? " · cache" : ""}.`;
  $("#garden-weather").hidden = false;
}

async function loadRainfall() {
  let stored = null;
  try { stored = JSON.parse(localStorage.getItem(RAIN_CACHE_KEY) || "null"); } catch (_) {}
  if (stored?.data && Date.now() - stored.savedAt < RAIN_CACHE_MS) {
    renderRainfall(stored.data, true);
    return;
  }
  try {
    const response = await fetch(nasaRainUrl());
    if (!response.ok) throw new Error("Data hujan NASA tidak tersedia");
    const rainfall = await response.json();
    renderRainfall(rainfall);
    try { localStorage.setItem(RAIN_CACHE_KEY, JSON.stringify({ savedAt: Date.now(), data: rainfall })); } catch (_) {}
  } catch (error) {
    if (stored?.data) {
      renderRainfall(stored.data, true);
      return;
    }
    $("#rain-7d").textContent = "Belum tersedia";
    $("#rain-30d").textContent = "Belum tersedia";
    $("#rain-source-note").textContent = "Data NASA sementara tidak dapat dimuat; prakiraan Open-Meteo tetap tersedia.";
  }
}

async function loadWeather() {
  const cached = (() => {
    try {
      const value = JSON.parse(localStorage.getItem(WEATHER_CACHE_KEY) || "null");
      return value && Date.now() - value.savedAt < WEATHER_CACHE_MS ? value.data : null;
    } catch (_) {
      return null;
    }
  })();
  if (cached) {
    renderWeather(cached);
    return;
  }
  const response = await fetch(WEATHER_URL);
  if (!response.ok) throw new Error("Cuaca tidak tersedia");
  const weather = await response.json();
  renderWeather(weather);
  try {
    localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify({ savedAt: Date.now(), data: weather }));
  } catch (_) {}
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
      : emptyMessage("Belum ada kegiatan terjadwal", "Jadwal akan tampil setelah petak, masa tanam, dan panduan budidaya resmi tersedia.");
    $("#calendar-list").innerHTML = tasks.length
      ? tasks.map((x) => `<article><strong>${x.title}</strong><span>${x.bucket === "today" ? "Hari ini" : x.bucket === "overdue" ? "Terlambat" : "Akan datang"} · ${x.due ? x.due.toLocaleDateString("id-ID") : "tanggal belum tersedia"}</span></article>`).join("")
      : emptyMessage("Jadwal belum tersedia", "Jadwal akan ditampilkan setelah tanggal tanam dan panduan resmi tersedia.");
  }

  function renderBlocks() {
    const byId = Object.fromEntries((state.boundary.features || []).map((x) => [x.properties.block_id, x.properties]));
    $("#block-list").innerHTML = state.data.blocks.map((block) => {
      const spatial = byId[block.id] || {};
      return `<article><strong>${block.name}</strong><small>Luas area: ${num(spatial.source_area_ha || block.area_ha, 2)} hektare</small><button type="button" data-focus-block="${block.id}">Lihat di peta →</button></article>`;
    }).join("");
  }

  function renderCollections() {
    const d = state.data;
    const configs = [
      ["#plots-list", d.plots, "Belum ada petak budidaya", "Petak budidaya akan ditampilkan setelah batas dan informasi tanamnya disahkan."],
      ["#sop-list", d.sops, "Belum ada panduan budidaya", "Panduan akan ditampilkan setelah dokumen resmi Faperta UR diterima dan disahkan."],
      ["#monitoring-list", d.monitoring, "Belum ada hasil pemantauan", "Catatan pertumbuhan, daya hidup, OPT, kondisi, dan foto akan tampil di sini."],
      ["#harvest-list", d.harvests, "Belum ada catatan panen", "Produktivitas akan dihitung dari hasil panen dan luas efektif petak."],
      ["#research-list", d.research, "Belum ada kegiatan penelitian", "Informasi kegiatan penelitian lapangan akan ditampilkan di bagian ini."]
    ];
    configs.forEach(([selector, rows, title, detail]) => {
      $(selector).innerHTML = rows.length ? rows.map((x) => `<article><strong>${x.name || x.title || x.id}</strong></article>`).join("") : emptyMessage(title, detail);
    });
  }

  function initMap() {
    state.map = L.map("faperta-map", { zoomControl: true }).setView([0.4822, 101.3808], 16);
    state.basemaps.street = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 20, attribution: "&copy; OpenStreetMap contributors" });
    state.basemaps.satellite = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { maxZoom: 19, attribution: "Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community" });
    state.basemaps.street.addTo(state.map);
    state.boundaryLayer = L.geoJSON(state.boundary, {
      style: { color: "#b7791f", weight: 3, fillColor: "#e5b64d", fillOpacity: .23 },
      onEachFeature(feature, layer) {
        const p = feature.properties;
        layer.bindPopup(`<strong>${p.name}</strong><span>Luas area: ${num(p.source_area_ha, 2)} hektare</span><span>Kebun Percobaan Faperta UR</span>`);
      }
    }).addTo(state.map);
    state.map.fitBounds(state.boundaryLayer.getBounds(), { padding: [24, 24] });
    $("#fit-boundary").addEventListener("click", () => state.map.fitBounds(state.boundaryLayer.getBounds(), { padding: [24, 24] }));
    all("[data-basemap]").forEach((button) => button.addEventListener("click", () => {
      const selected = button.dataset.basemap;
      Object.values(state.basemaps).forEach((layer) => state.map.removeLayer(layer));
      state.basemaps[selected].addTo(state.map).bringToBack();
      all("[data-basemap]").forEach((item) => item.classList.toggle("active", item === button));
    }));
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
      if (!dataResponse.ok || !boundaryResponse.ok) throw new Error("Informasi kebun tidak dapat dimuat.");
      [state.data, state.boundary] = await Promise.all([dataResponse.json(), boundaryResponse.json()]);
      configurePublicSections(); renderSummary(); renderTasks(); renderBlocks(); renderCollections(); initMap(); bindUi();
      loadWeather().catch(() => {});
      loadRainfall();
    } catch (error) {
      document.querySelector("main").innerHTML = `<div class="fu-empty"><span><strong>Informasi belum dapat ditampilkan</strong><br>${error.message}</span></div>`;
    }
  }
  boot();
})();
