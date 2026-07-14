(() => {
  "use strict";

  const config = window.YG_POLYGON_EDITOR_CONFIG || {};
  const api = config.api;
  const map = L.map("map", { preferCanvas: true }).setView([1.2, 102.1], 8);

  const road = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 20,
    attribution: "&copy; OpenStreetMap contributors"
  }).addTo(map);

  const satellite = L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    { maxZoom: 20, attribution: "Tiles &copy; Esri" }
  );

  L.control.layers({ "Peta Jalan": road, "Citra Satelit": satellite }).addTo(map);

  let collection = null;
  let objects = [];
  let filtered = [];
  let selectedFeature = null;
  let selectedLayer = null;
  let originalFeature = null;
  let editing = false;
  let saveInProgress = false;
  let pendingSave = null;
  let savePollTimer = null;

  const list = document.getElementById("object-list");
  const form = document.getElementById("object-form");
  const status = document.getElementById("status");
  const layerFilter = document.getElementById("layer-filter");
  const searchInput = document.getElementById("search-object");
  const saveOverlay = document.getElementById("save-overlay");
  const saveOverlayTitle = document.getElementById("save-overlay-title");
  const saveOverlayText = document.getElementById("save-overlay-text");
  const saveOverlayClose = document.getElementById("save-overlay-close");

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, char => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[char]);
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function props(feature) {
    return feature && feature.properties || {};
  }

  function valueOf(p, keys) {
    for (const key of keys) {
      if (p[key] !== undefined && p[key] !== null && String(p[key]).trim() !== "") {
        return p[key];
      }
    }
    return "";
  }

  function setStatus(message, state) {
    status.textContent = message || "";
    status.className = state ? "status-" + state : "";
  }

  function callbackLoad(url) {
    return new Promise((resolve, reject) => {
      const callback = "ygPolygonEditor_" + Date.now();
      const script = document.createElement("script");
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error("Waktu koneksi habis."));
      }, 30000);

      function cleanup() {
        clearTimeout(timer);
        script.remove();
        try { delete window[callback]; } catch (error) {}
      }

      window[callback] = data => {
        cleanup();
        resolve(data);
      };

      script.onerror = () => {
        cleanup();
        reject(new Error("Master Database tidak dapat dimuat."));
      };

      script.src = url + (url.includes("?") ? "&" : "?") +
        "callback=" + encodeURIComponent(callback) + "&t=" + Date.now();
      document.head.appendChild(script);
    });
  }

  async function loadObjects() {
    setStatus("Memuat Master Database…");
    clearSelection();

    try {
      collection = await callbackLoad(api + "?page=objects");
      objects = (collection.features || []).filter(feature => {
        const p = props(feature);
        const id = p.Layer_ID || p.Source_Layer || "";
        return feature.geometry &&
          !["monitoring_reports", "community_reports", "kawasan_hutan_sk_903", "gambut_bbsdlp_2019"].includes(id);
      });

      buildLayerFilter();
      applyFilter();
      setStatus(objects.length + " objek program siap diedit.", "ok");
    } catch (error) {
      setStatus(error.message, "error");
    }
  }

  function buildLayerFilter() {
    const layers = new Map();
    objects.forEach(feature => {
      const p = props(feature);
      const id = p.Layer_ID || p.Source_Layer || "lainnya";
      const label = p.Layer_Label || id.replace(/_/g, " ");
      layers.set(id, label);
    });

    layerFilter.innerHTML =
      '<option value="">Semua layer program</option>' +
      [...layers.entries()]
        .sort((a, b) => a[1].localeCompare(b[1], "id"))
        .map(([id, label]) =>
          '<option value="' + esc(id) + '">' + esc(label) + '</option>'
        ).join("");
  }

  function objectName(feature) {
    const p = props(feature);
    return valueOf(p, ["Nama_Objek", "title", "Desa"]) || "Objek tanpa nama";
  }

  function applyFilter() {
    const layerValue = layerFilter.value;
    const query = searchInput.value.trim().toLowerCase();

    filtered = objects.filter(feature => {
      const p = props(feature);
      const layerId = p.Layer_ID || p.Source_Layer || "lainnya";
      const text = [
        objectName(feature), p.Object_ID, p.Desa, p.Kecamatan, p.Kabupaten, p.Kategori
      ].filter(Boolean).join(" ").toLowerCase();

      return (!layerValue || layerId === layerValue) &&
        (!query || text.includes(query));
    });

    renderList();
  }

  function renderList() {
    list.innerHTML = filtered.map((feature, index) => {
      const p = props(feature);
      const id = p.Object_ID || "";
      const active = selectedFeature && p.Object_ID === props(selectedFeature).Object_ID;
      return '<button class="object-item' + (active ? " active" : "") +
        '" type="button" data-index="' + index + '">' +
        '<strong>' + esc(objectName(feature)) + '</strong>' +
        '<span>' + esc(id) + ' · ' + esc(p.Desa || "") + '</span>' +
        '</button>';
    }).join("") || '<p style="padding:14px">Tidak ada objek.</p>';

    document.getElementById("object-summary").textContent =
      filtered.length + " objek ditampilkan";
  }

  function layerStyle(feature) {
    const type = feature.geometry && feature.geometry.type || "";
    return {
      color: "#087653",
      weight: type.includes("Polygon") ? 4 : 3,
      fillColor: "#16a06f",
      fillOpacity: type.includes("Polygon") ? 0.23 : 0.8,
      radius: 9
    };
  }

  function showFeature(feature) {
    if (selectedLayer) {
      map.removeLayer(selectedLayer);
      selectedLayer = null;
    }

    selectedFeature = clone(feature);
    originalFeature = clone(feature);

    selectedLayer = L.geoJSON(selectedFeature, {
      style: () => layerStyle(selectedFeature),
      pointToLayer: (_f, latlng) => L.circleMarker(latlng, layerStyle(selectedFeature))
    }).addTo(map);

    const bounds = selectedLayer.getBounds();
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 18 });

    selectedLayer.eachLayer(layer => {
      layer.on("pm:edit", updateFromMap);
      layer.on("pm:update", updateFromMap);
      layer.on("pm:dragend", updateFromMap);
    });

    fillForm();
    toggleButtons(true);
    renderList();
  }

  function editableLeafletLayer() {
    if (!selectedLayer) return null;
    let first = null;
    selectedLayer.eachLayer(layer => { if (!first) first = layer; });
    return first;
  }

  function startEdit() {
    const layer = editableLeafletLayer();
    if (!layer || !layer.pm) return;

    editing = true;
    if (layer instanceof L.Marker || layer instanceof L.CircleMarker) {
      layer.pm.enableLayerDrag();
    } else {
      layer.pm.enable({
        allowSelfIntersection: false,
        snappable: true,
        pinning: false
      });
    }
    toggleButtons(true);
    setStatus("Mode edit aktif. Geser titik/objek pada peta.");
  }

  function finishEdit() {
    const layer = editableLeafletLayer();
    if (!layer || !layer.pm) return;

    updateFromMap({ target: layer });
    layer.pm.disable();
    if (layer.pm.disableLayerDrag) layer.pm.disableLayerDrag();
    editing = false;
    toggleButtons(true);
    setStatus("Geometri diperbarui secara lokal. Klik Simpan ke Master Database.", "ok");
  }

  function updateFromMap(event) {
    const layer = event.target || editableLeafletLayer();
    if (!layer || !selectedFeature) return;

    const geo = layer.toGeoJSON();
    selectedFeature.geometry = geo.geometry;
    document.getElementById("geometry-json").textContent =
      JSON.stringify(selectedFeature.geometry, null, 2);
    updateMetrics();
  }

  function resetGeometry() {
    if (!originalFeature) return;
    showFeature(originalFeature);
    setStatus("Geometri dikembalikan ke kondisi saat objek dipilih.", "ok");
  }

  function calculateAreaHa() {
    if (!selectedFeature || !selectedFeature.geometry) return "";
    const type = selectedFeature.geometry.type;
    if (!type.includes("Polygon") || !window.turf) return "";
    try {
      return turf.area(selectedFeature) / 10000;
    } catch (error) {
      return "";
    }
  }

  function updateMetrics() {
    const area = calculateAreaHa();
    document.getElementById("calculated-area").textContent =
      area === "" ? "Bukan polygon" :
      new Intl.NumberFormat("id-ID", { maximumFractionDigits: 4 }).format(area) + " ha";

    if (area !== "" && form.elements.areaHa && editing) {
      form.elements.areaHa.value = area.toFixed(6);
    }
  }

  function fillForm() {
    const p = props(selectedFeature);
    const mapping = {
      objectId: ["Object_ID"],
      objectName: ["Nama_Objek"],
      category: ["Kategori"],
      status: ["Status_Objek"],
      program: ["Program"],
      phase: ["Fase"],
      year: ["Tahun"],
      province: ["Provinsi"],
      regency: ["Kabupaten"],
      district: ["Kecamatan"],
      village: ["Desa"],
      areaHa: ["Luas_Ha"],
      lengthM: ["Panjang_M"],
      plantedCount: ["Jumlah_Tanam"]
    };

    Object.entries(mapping).forEach(([name, keys]) => {
      if (form.elements[name]) form.elements[name].value = valueOf(p, keys);
    });

    document.getElementById("empty-state").hidden = true;
    form.hidden = false;
    document.getElementById("selected-object-name").textContent = objectName(selectedFeature);
    document.getElementById("selected-layer-label").textContent =
      p.Layer_Label || p.Layer_ID || p.Source_Layer || "Layer";
    document.getElementById("geometry-type").textContent =
      selectedFeature.geometry && selectedFeature.geometry.type || "—";
    document.getElementById("revision-number").textContent = p.Revision || 0;
    document.getElementById("geometry-json").textContent =
      JSON.stringify(selectedFeature.geometry, null, 2);
    updateMetrics();
  }

  function syncFormToFeature() {
    const p = selectedFeature.properties || (selectedFeature.properties = {});
    const values = new FormData(form);

    const fields = {
      Object_ID: "objectId", Nama_Objek: "objectName", Kategori: "category",
      Status_Objek: "status", Program: "program", Fase: "phase", Tahun: "year",
      Provinsi: "province", Kabupaten: "regency", Kecamatan: "district",
      Desa: "village", Luas_Ha: "areaHa", Panjang_M: "lengthM",
      Jumlah_Tanam: "plantedCount"
    };

    Object.entries(fields).forEach(([key, name]) => {
      const value = values.get(name);
      if (["Luas_Ha", "Panjang_M", "Jumlah_Tanam"].includes(key)) {
        p[key] = value === "" ? "" : Number(value);
      } else {
        p[key] = String(value || "").trim();
      }
    });
  }

  function buildObjectData() {
    syncFormToFeature();
    const p = props(selectedFeature);
    return {
      objectId: p.Object_ID,
      layerId: p.Layer_ID || p.Source_Layer || "",
      layerLabel: p.Layer_Label || "",
      objectName: p.Nama_Objek || "",
      category: p.Kategori || "",
      sourceType: p.Source_Type || "program_layer",
      sourceReportId: p.Source_Report_ID || "",
      program: p.Program || "",
      phase: p.Fase || "",
      year: p.Tahun || "",
      province: p.Provinsi || "Riau",
      regency: p.Kabupaten || "",
      district: p.Kecamatan || "",
      village: p.Desa || "",
      areaHa: p.Luas_Ha === "" ? "" : Number(p.Luas_Ha || 0),
      lengthM: p.Panjang_M === "" ? "" : Number(p.Panjang_M || 0),
      plantedCount: p.Jumlah_Tanam === "" ? "" : Number(p.Jumlah_Tanam || 0),
      status: p.Status_Objek || "Aktif",
      geometry: selectedFeature.geometry,
      properties: p
    };
  }


  function stableStringify(value) {
    if (value === null || typeof value !== "object") return JSON.stringify(value);
    if (Array.isArray(value)) return "[" + value.map(stableStringify).join(",") + "]";
    return "{" + Object.keys(value).sort().map(key =>
      JSON.stringify(key) + ":" + stableStringify(value[key])
    ).join(",") + "}";
  }

  function comparableObjectData(data) {
    return {
      objectId: data.objectId || "",
      objectName: data.objectName || "",
      category: data.category || "",
      status: data.status || "",
      program: data.program || "",
      phase: data.phase || "",
      year: String(data.year || ""),
      province: data.province || "",
      regency: data.regency || "",
      district: data.district || "",
      village: data.village || "",
      areaHa: data.areaHa === "" ? "" : Number(data.areaHa || 0),
      lengthM: data.lengthM === "" ? "" : Number(data.lengthM || 0),
      plantedCount: data.plantedCount === "" ? "" : Number(data.plantedCount || 0),
      geometry: data.geometry || null
    };
  }

  function featureComparable(feature) {
    const p = props(feature);
    return {
      objectId: p.Object_ID || "",
      objectName: p.Nama_Objek || "",
      category: p.Kategori || "",
      status: p.Status_Objek || "",
      program: p.Program || "",
      phase: p.Fase || "",
      year: String(p.Tahun || ""),
      province: p.Provinsi || "",
      regency: p.Kabupaten || "",
      district: p.Kecamatan || "",
      village: p.Desa || "",
      areaHa: p.Luas_Ha === "" ? "" : Number(p.Luas_Ha || 0),
      lengthM: p.Panjang_M === "" ? "" : Number(p.Panjang_M || 0),
      plantedCount: p.Jumlah_Tanam === "" ? "" : Number(p.Jumlah_Tanam || 0),
      geometry: feature.geometry || null
    };
  }

  function showSaveOverlay(title, text, allowClose) {
    saveOverlayTitle.textContent = title;
    saveOverlayText.textContent = text;
    saveOverlayClose.hidden = !allowClose;
    saveOverlay.hidden = false;
  }

  function hideSaveOverlay() {
    saveOverlay.hidden = true;
  }

  function finishSaveSuccess(revision) {
    saveInProgress = false;
    pendingSave = null;
    if (savePollTimer) clearTimeout(savePollTimer);
    document.body.classList.remove("is-saving");

    const suffix = revision ? " Revisi " + revision + "." : "";
    setStatus("Berhasil disimpan ke Master Database." + suffix, "ok");
    showSaveOverlay(
      "Berhasil disimpan",
      "Perubahan sudah masuk ke OBJECTS dan dicatat di CHANGE_LOG." + suffix,
      true
    );
    document.getElementById("change-reason").value = "";
    loadObjects();
  }

  function finishSaveError(message) {
    saveInProgress = false;
    pendingSave = null;
    if (savePollTimer) clearTimeout(savePollTimer);
    document.body.classList.remove("is-saving");
    setStatus(message, "error");
    showSaveOverlay("Penyimpanan gagal", message, true);
  }

  async function verifySavedObject(attempt) {
    if (!saveInProgress || !pendingSave) return;

    try {
      const result = await callbackLoad(api + "?page=objects");
      const features = Array.isArray(result.features) ? result.features : [];
      const match = features.find(feature =>
        String(props(feature).Object_ID || "") === String(pendingSave.objectId)
      );

      if (match) {
        const revision = Number(props(match).Revision || 0);
        const dataMatches =
          stableStringify(featureComparable(match)) === pendingSave.fingerprint;

        if (revision > pendingSave.beforeRevision || dataMatches) {
          finishSaveSuccess(revision);
          return;
        }
      }
    } catch (error) {
      console.warn("Verifikasi simpan:", error);
    }

    if (attempt >= 15) {
      finishSaveError(
        "Permintaan POST telah dikirim, tetapi perubahan belum terlihat setelah 45 detik. " +
        "Periksa Apps Script → Eksekusi untuk baris doPost berjenis Aplikasi Web."
      );
      return;
    }

    saveOverlayText.textContent =
      "POST sudah dikirim. Memeriksa Master Database… (" + (attempt + 1) + "/15)";

    savePollTimer = setTimeout(() => verifySavedObject(attempt + 1), 3000);
  }

  async function sendSaveRequest(data, token, reason) {
    const body = new URLSearchParams();
    body.set("action", "update-master-object");
    body.set("token", token);
    body.set("reason", reason);
    body.set("objectData", JSON.stringify(data));

    /*
     * no-cors memang menghasilkan respons opaque, tetapi memastikan POST
     * dapat dikirim dari GitHub Pages ke Apps Script. Hasilnya diverifikasi
     * melalui endpoint JSONP page=objects.
     */
    await fetch(api, {
      method: "POST",
      mode: "no-cors",
      cache: "no-store",
      redirect: "follow",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"
      },
      body: body.toString()
    });
  }

  async function saveObject(event) {
    event.preventDefault();

    if (saveInProgress || !selectedFeature) return;
    if (editing) finishEdit();

    const token = document.getElementById("admin-token").value.trim();
    const reason = document.getElementById("change-reason").value.trim();

    if (!token) return setStatus("Token admin wajib diisi.", "error");
    if (!reason) return setStatus("Alasan perubahan wajib diisi.", "error");

    const data = buildObjectData();

    if (!data.objectId || !data.objectName || !data.geometry) {
      return setStatus(
        "Object ID, nama objek, dan geometri wajib tersedia.",
        "error"
      );
    }

    pendingSave = {
      objectId: data.objectId,
      beforeRevision: Number(props(selectedFeature).Revision || 0),
      fingerprint: stableStringify(comparableObjectData(data))
    };

    saveInProgress = true;
    document.body.classList.add("is-saving");
    setStatus("Mengirim POST ke Apps Script…", "saving");
    showSaveOverlay(
      "Mengirim perubahan…",
      "Mengirim POST langsung ke deployment Apps Script.",
      false
    );

    try {
      await sendSaveRequest(data, token, reason);
      setStatus("POST dikirim. Memverifikasi Master Database…", "saving");
      saveOverlayText.textContent =
        "POST sudah dikirim. Menunggu perubahan muncul di OBJECTS…";
      setTimeout(() => verifySavedObject(0), 1800);
    } catch (error) {
      finishSaveError("POST gagal dikirim: " + error.message);
    }
  }

  function cancelChanges() {
    if (!originalFeature) return;
    showFeature(originalFeature);
    setStatus("Perubahan dibatalkan.", "ok");
  }

  function clearSelection() {
    if (selectedLayer) map.removeLayer(selectedLayer);
    selectedLayer = null;
    selectedFeature = null;
    originalFeature = null;
    form.hidden = true;
    document.getElementById("empty-state").hidden = false;
    toggleButtons(false);
  }

  function toggleButtons(hasSelection) {
    document.getElementById("fit-object").disabled = !hasSelection;
    document.getElementById("start-edit").disabled = !hasSelection || editing;
    document.getElementById("finish-edit").disabled = !hasSelection || !editing;
    document.getElementById("reset-geometry").disabled = !hasSelection;
  }

  list.addEventListener("click", event => {
    const button = event.target.closest("[data-index]");
    if (!button) return;
    showFeature(filtered[Number(button.dataset.index)]);
  });

  layerFilter.addEventListener("change", applyFilter);
  searchInput.addEventListener("input", applyFilter);
  document.getElementById("reload-data").addEventListener("click", loadObjects);
  document.getElementById("start-edit").addEventListener("click", startEdit);
  document.getElementById("finish-edit").addEventListener("click", finishEdit);
  document.getElementById("reset-geometry").addEventListener("click", resetGeometry);
  document.getElementById("cancel-object").addEventListener("click", cancelChanges);
  document.getElementById("fit-object").addEventListener("click", () => {
    if (!selectedLayer) return;
    const bounds = selectedLayer.getBounds();
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [35, 35], maxZoom: 18 });
  });
  form.addEventListener("submit", saveObject);


  saveOverlayClose.addEventListener("click", hideSaveOverlay);

  map.whenReady(() => setTimeout(() => map.invalidateSize(true), 100));
  loadObjects();
})();
