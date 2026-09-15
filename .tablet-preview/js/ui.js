
(() => {
  "use strict";

  const shell = document.getElementById("app-shell");
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("overlay");
  const mapArea = document.getElementById("map-area");

  function openMobileSidebar() {
    sidebar.classList.add("open");
    overlay.classList.add("open");
  }

  function closeMobileSidebar() {
    sidebar.classList.remove("open");
    overlay.classList.remove("open");
  }

  function togglePanel() {
    if (window.innerWidth <= 760) {
      sidebar.classList.contains("open") ? closeMobileSidebar() : openMobileSidebar();
      return;
    }

    shell.classList.toggle("collapsed");
    setTimeout(() => window.YG_MAP?.map.invalidateSize(true), 260);
  }

  document.getElementById("desktop-panel")?.addEventListener("click", togglePanel);
  document.getElementById("map-panel")?.addEventListener("click", togglePanel);
  document.getElementById("mobile-panel")?.addEventListener("click", openMobileSidebar);
  overlay?.addEventListener("click", closeMobileSidebar);

  document.getElementById("fullscreen")?.addEventListener("click", async () => {
    try {
      if (!document.fullscreenElement) await mapArea.requestFullscreen();
      else await document.exitFullscreen();
    } catch (error) {
      console.warn("Mode fullscreen tidak tersedia:", error);
    }
  });

  const layerOrderScript = document.createElement("script");
  layerOrderScript.src = "js/layer-order-v1.js?v=20260720-2";
  layerOrderScript.async = true;
  document.head.appendChild(layerOrderScript);

  const monitoringFixScript = document.createElement("script");
  monitoringFixScript.src = "js/map-monitoring-fix-v1.js?v=20260720-1";
  monitoringFixScript.async = true;
  document.head.appendChild(monitoringFixScript);

  window.YG_UI = { openMobileSidebar, closeMobileSidebar, togglePanel };
})();