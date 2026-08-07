(() => {
  "use strict";

  const ADMIN_REFERENCE_IDS = new Set([
    "batas_administrasi_desa_riau"
  ]);

  function sortRowsByVisibleLabel(rows) {
    const language = document.documentElement.lang === "en" ? "en" : "id";
    return rows.slice().sort((rowA, rowB) => {
      const labelA = rowA.querySelector("label")?.textContent.trim() || "";
      const labelB = rowB.querySelector("label")?.textContent.trim() || "";
      return labelA.localeCompare(labelB, language, {
        sensitivity: "base",
        numeric: true
      });
    });
  }

  function getProgramRow(list, layerId) {
    return list.querySelector(
      '.layer-row input[data-layer-id="' + layerId + '"]'
    )?.closest(".layer-row") || null;
  }

  function makeTitle(text, className) {
    const title = document.createElement("div");
    title.className = "yg-layer-section-title " + (className || "");
    title.textContent = text;
    return title;
  }

  function reorderLayerList() {
    const list = document.getElementById("layer-list");
    if (!list) return false;

    const monitoring = getProgramRow(list, "monitoring_reports");
    const villageBoundary = getProgramRow(list, "desa_intervensi");
    const environmentalRows = sortRowsByVisibleLabel(Array.from(
      list.querySelectorAll(".environment-layer-row")
    ));
    const referenceRows = Array.from(
      list.querySelectorAll(".reference-layer-row")
    );
    const administrativeReferenceRows = sortRowsByVisibleLabel(referenceRows.filter(row => {
      const referenceId = row.querySelector("input[data-reference-layer-id]")
        ?.getAttribute("data-reference-layer-id");
      return ADMIN_REFERENCE_IDS.has(referenceId || "");
    }));
    const generalReferenceRows = sortRowsByVisibleLabel(referenceRows.filter(
      row => !administrativeReferenceRows.includes(row)
    ));

    if (!monitoring || !villageBoundary) return false;

    const allProgramRows = Array.from(
      list.querySelectorAll('.layer-row input[data-layer-id]')
    ).map(input => input.closest(".layer-row"));

    const orderedRows = sortRowsByVisibleLabel(allProgramRows.filter(row =>
      row !== monitoring && row !== villageBoundary
    ));

    list.innerHTML = "";
    list.appendChild(monitoring);

    if (environmentalRows.length) {
      list.appendChild(makeTitle("PEMANTAUAN LINGKUNGAN", "yg-environment-title"));
      environmentalRows.forEach(row => list.appendChild(row));
    }

    list.appendChild(makeTitle("PROGRAM & LAPORAN YG", "yg-program-title"));

    orderedRows.forEach(row => {
      if (row !== monitoring) list.appendChild(row);
    });

    if (generalReferenceRows.length) {
      list.appendChild(makeTitle("DATA REFERENSI", "yg-reference-title"));
      generalReferenceRows.forEach(row => list.appendChild(row));
    }

    list.appendChild(makeTitle("BATAS ADMINISTRASI", "yg-boundary-title"));
    administrativeReferenceRows.forEach(row => list.appendChild(row));
    list.appendChild(villageBoundary);

    monitoring.classList.add("yg-priority-monitoring-row");
    villageBoundary.classList.add("yg-bottom-boundary-row");

    return true;
  }

  function reorderLegend() {
    const legend = document.getElementById("legend");
    if (!legend) return;

    const items = Array.from(legend.querySelectorAll(".legend-item"));
    if (!items.length) return;

    const monitoring = items.find(item =>
      /monitoring/i.test(item.textContent || "")
    );
    const villageBoundary = items.find(item =>
      /batas desa intervensi/i.test(item.textContent || "")
    );

    if (monitoring) legend.prepend(monitoring);
    if (villageBoundary) legend.appendChild(villageBoundary);
  }

  function applyOrder() {
    const changed = reorderLayerList();
    if (changed) reorderLegend();
    return changed;
  }

  const style = document.createElement("style");
  style.id = "yg-layer-order-v1-style";
  style.textContent = `
    .yg-priority-monitoring-row {
      border: 1px solid rgba(249, 168, 37, .38);
      background: #fff8df;
    }

    .yg-priority-monitoring-row label {
      font-weight: 900;
      color: #6f4b00;
    }

    .yg-bottom-boundary-row {
      border-top: 1px solid #dfe8e3;
      background: #f7f9f8;
    }

    .yg-bottom-boundary-row label {
      color: #51615b;
      font-weight: 700;
    }

    .yg-layer-section-title.yg-boundary-title {
      margin-top: 14px;
      background: #f0f3f2;
      color: #52625c;
    }

    .yg-layer-section-title.yg-reference-title {
      margin-top: 14px;
    }
  `;
  document.head.appendChild(style);

  if (!applyOrder()) {
    const target = document.getElementById("layer-list");

    if (target) {
      const observer = new MutationObserver(() => {
        if (applyOrder()) observer.disconnect();
      });

      observer.observe(target, {
        childList: true,
        subtree: true
      });

      window.setTimeout(() => observer.disconnect(), 30000);
    }
  }

  function scheduleOrder() {
    window.setTimeout(applyOrder, 50);
  }

  document.addEventListener("yg:environment-layer-controls-ready", scheduleOrder);
  window.addEventListener("yg:languagechange", scheduleOrder);
  window.setTimeout(applyOrder, 250);
})();
