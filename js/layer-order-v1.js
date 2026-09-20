(() => {
  "use strict";

  const ADMIN_REFERENCE_IDS = new Set([
    "batas_administrasi_desa_riau"
  ]);
  const INTERVENTION_REFERENCE_IDS = new Set([
    "social_forestry_intervention_yg"
  ]);
  const STAFF_ONLY_REFERENCE_IDS = new Set([
    "rtrw_riau_2018_2038",
    "pbph_riau_052026",
    "perhutanan_sosial_riau",
    "perusahaan_sawit_riau",
    "feg_sk130_riau",
    "pptpkh_riau_2023",
    "upt_faperta_ur"
  ]);

  const REFERENCE_SECTIONS = [
    { id: "spatial_planning", title: "TATA RUANG · INTERNAL STAF", className: "yg-spatial-title", staffOnly: true },
    { id: "forest_governance", title: "KEHUTANAN & KELOLA LAHAN", className: "yg-forest-title" },
    { id: "peat_environment", title: "GAMBUT & LINGKUNGAN", className: "yg-peat-title" },
    { id: "plantations", title: "PERKEBUNAN · INTERNAL STAF", className: "yg-plantation-title", staffOnly: true },
    { id: "partnership", title: "KOLABORASI AKADEMIK", className: "yg-partnership-title", staffOnly: true },
    { id: "general", title: "DATA REFERENSI", className: "yg-reference-title" }
  ];

  function hasStaffSession() {
    return Boolean(window.YG_STAFF_DATA && window.YG_STAFF_DATA.session && window.YG_STAFF_DATA.session());
  }

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

  function referenceId(row) {
    return row.querySelector("input[data-reference-layer-id]")
      ?.getAttribute("data-reference-layer-id") || "";
  }

  function referenceSection(row) {
    return row.querySelector("input[data-reference-layer-id]")
      ?.getAttribute("data-reference-section") || "general";
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
    const allowStaffOnly = hasStaffSession();
    const referenceRows = Array.from(
      list.querySelectorAll(".reference-layer-row")
    ).filter(row => allowStaffOnly || !STAFF_ONLY_REFERENCE_IDS.has(referenceId(row)));
    const administrativeReferenceRows = sortRowsByVisibleLabel(referenceRows.filter(row => {
      return ADMIN_REFERENCE_IDS.has(referenceId(row));
    }));
    const interventionReferenceRows = sortRowsByVisibleLabel(referenceRows.filter(row => {
      return INTERVENTION_REFERENCE_IDS.has(referenceId(row));
    }));
    const groupedReferenceRows = new Map();
    REFERENCE_SECTIONS.forEach(section => groupedReferenceRows.set(section.id, []));
    referenceRows.filter(row =>
      !administrativeReferenceRows.includes(row) &&
      !interventionReferenceRows.includes(row)
    ).forEach(row => {
      const section = referenceSection(row);
      const key = groupedReferenceRows.has(section) ? section : "general";
      groupedReferenceRows.get(key).push(row);
    });

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

    if (interventionReferenceRows.length || villageBoundary) {
      list.appendChild(makeTitle("WILAYAH INTERVENSI YG", "yg-intervention-title"));
      interventionReferenceRows.forEach(row => list.appendChild(row));
      if (villageBoundary) list.appendChild(villageBoundary);
    }

    REFERENCE_SECTIONS.forEach(section => {
      if (section.staffOnly && !allowStaffOnly) return;
      const rows = sortRowsByVisibleLabel(groupedReferenceRows.get(section.id) || []);
      if (!rows.length) return;
      list.appendChild(makeTitle(section.title, section.className));
      rows.forEach(row => list.appendChild(row));
    });

    if (administrativeReferenceRows.length) {
      list.appendChild(makeTitle("BATAS ADMINISTRASI", "yg-boundary-title"));
      administrativeReferenceRows.forEach(row => list.appendChild(row));
    }

    monitoring.classList.add("yg-priority-monitoring-row");
    villageBoundary.classList.add("yg-intervention-boundary-row");

    return true;
  }

  function reorderLegend() {
    const legend = document.getElementById("legend");
    if (!legend) return;

    const items = Array.from(legend.querySelectorAll(".legend-item"));
    if (!items.length) return;

    if (!hasStaffSession()) {
      items.forEach(item => {
        if (/rspo|perkebunan anggota|faperta|kebun percobaan/i.test(item.textContent || "")) item.remove();
      });
    }

    const remainingItems = Array.from(legend.querySelectorAll(".legend-item"));
    const monitoring = remainingItems.find(item =>
      /monitoring/i.test(item.textContent || "")
    );
    const villageBoundary = remainingItems.find(item =>
      /batas (?:administrasi )?desa intervensi/i.test(item.textContent || "")
    );

    if (monitoring) legend.prepend(monitoring);
    if (villageBoundary) {
      const socialForestryIntervention = remainingItems.find(item =>
        /perhutanan sosial intervensi yg/i.test(item.textContent || "")
      );
      if (socialForestryIntervention) {
        socialForestryIntervention.insertAdjacentElement("afterend", villageBoundary);
      }
    }
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

    .yg-intervention-boundary-row {
      border-top: 1px solid rgba(109, 40, 217, .16);
      background: #faf7ff;
    }

    .yg-intervention-boundary-row label {
      color: #4c1d95;
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

    .yg-layer-section-title.yg-spatial-title,
    .yg-layer-section-title.yg-plantation-title {
      margin-top: 14px;
      background: #fff4df;
      color: #7a4a00;
    }

    .yg-layer-section-title.yg-forest-title {
      margin-top: 14px;
      background: #e9f5e9;
      color: #285b31;
    }

    .yg-layer-section-title.yg-peat-title {
      margin-top: 14px;
      background: #f3ece6;
      color: #684531;
    }

    .yg-layer-section-title.yg-intervention-title {
      margin-top: 14px;
      background: #f1ebff;
      color: #5b21b6;
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
