(function () {
  "use strict";

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
        <a href="staff-rdtr-bagansiapiapi.html">Kajian RDTR Bagansiapiapi →</a>
      </div>
      <small class="riau-reference-status" aria-live="polite">Pilih preset; tidak ada layer berat yang diaktifkan otomatis.</small>
      <details class="riau-reference-catalog">
        <summary>Status katalog data Riau</summary>
        <div class="riau-reference-catalog-grid">
          <article><strong>Administrasi & tata ruang</strong><span>Batas desa Riau dan RTRW Riau 2018–2038.</span><em>TERINTEGRASI</em></article>
          <article><strong>Kehutanan, gambut & kelola lahan</strong><span>Kawasan hutan, KPH, PBPH, perhutanan sosial, dan gambut.</span><em>TERINTEGRASI</em></article>
          <article><strong>Perkebunan</strong><span>Area anggota RSPO dan referensi perusahaan untuk analisis staf.</span><em>TERINTEGRASI INTERNAL</em></article>
          <article><strong>Pesisir, kelautan & perikanan</strong><span>Zonasi, budidaya, nelayan, armada, produksi, konservasi, kualitas air, dan ekosistem pesisir.</span><em class="pending">VERIFIKASI SUMBER/GEOMETRI</em></article>
          <article><strong>Hidrologi, kebencanaan & infrastruktur</strong><span>Sungai, DAS, banjir/rob, abrasi, jalan, fasilitas publik, dan jaringan layanan.</span><em class="pending">VERIFIKASI SUMBER/GEOMETRI</em></article>
          <article><strong>Sosial-ekonomi & komoditas</strong><span>Penduduk, kemiskinan, pertanian, peternakan, UMKM, pariwisata, dan layanan dasar.</span><em class="pending">VERIFIKASI SUMBER/ATRIBUT</em></article>
        </div>
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
    });

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
