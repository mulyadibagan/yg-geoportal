(() => {
  "use strict";

  if (document.querySelector('script[src*="data-updates.js"]')) {
    const targetFixScript = document.createElement("script");
    targetFixScript.src = "js/public-update-target-fix.js?v=20260721-legacy-photo1";
    targetFixScript.async = false;
    document.head.appendChild(targetFixScript);
  }

  if ("serviceWorker" in navigator) {
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
      navigator.serviceWorker.getRegistrations().then(registrations => registrations.forEach(registration => registration.unregister()));
    } else {
      window.addEventListener("load", () => {
        navigator.serviceWorker
          .register("./service-worker.js?v=20260829-pwa-install1", { updateViaCache: "none" })
          .then(registration => {
            registration.update();
            window.setInterval(() => registration.update(), 60 * 60 * 1000);
          })
          .catch(error => console.warn("Pendaftaran service worker gagal:", error));
      });

      navigator.serviceWorker.addEventListener("controllerchange", () => {
        const reloadKey = "yg-sw-freshness-20260829-pwa1";
        if (sessionStorage.getItem(reloadKey)) return;
        sessionStorage.setItem(reloadKey, "done");
        window.location.reload();
      });
    }
  }

  let deferredPrompt = null;
  const ua = navigator.userAgent || "";
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isStandalone = () => window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  const buttons = () => document.querySelectorAll("[data-install-app]");
  const showButtons = () => buttons().forEach(button => { button.hidden = false; });
  const hideButtons = () => buttons().forEach(button => { button.hidden = true; });

  function showIOSInstallGuide() {
    document.getElementById("yg-ios-install-guide")?.remove();
    const overlay = document.createElement("div");
    overlay.id = "yg-ios-install-guide";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.style.cssText = "position:fixed;inset:0;z-index:100000;background:rgba(15,23,42,.58);display:flex;align-items:flex-end;justify-content:center;padding:16px";
    overlay.innerHTML = `<div style="width:min(100%,520px);background:#fff;border-radius:20px;padding:20px;box-shadow:0 20px 60px rgba(0,0,0,.28);font-family:inherit;color:#17202a">
      <div style="display:flex;gap:12px;align-items:flex-start"><img src="assets/logo-yayasan-gambut-192.png" alt="" width="52" height="52" style="border-radius:12px;object-fit:contain"><div style="flex:1"><strong style="font-size:18px">Pasang YG GeoPortal</strong><p style="margin:5px 0 0;line-height:1.45;color:#52606d">Di iPhone/iPad, pemasangan dilakukan melalui menu Safari.</p></div><button type="button" data-close-ios-install aria-label="Tutup" style="border:0;background:#eef2f5;border-radius:50%;width:34px;height:34px;font-size:22px">×</button></div>
      <ol style="margin:18px 0 8px;padding-left:24px;line-height:1.7"><li>Ketuk <strong>Bagikan</strong> <span aria-hidden="true">□↑</span> di Safari.</li><li>Pilih <strong>Tambahkan ke Layar Utama</strong>.</li><li>Ketuk <strong>Tambah</strong>.</li></ol>
      <p style="margin:12px 0 0;padding:11px 12px;background:#f2f7f4;border-radius:12px;font-size:13px;line-height:1.45">YG GeoPortal kemudian dapat dibuka dari ikon layar utama seperti aplikasi.</p>
    </div>`;
    document.body.appendChild(overlay);
    const close = () => overlay.remove();
    overlay.querySelector("[data-close-ios-install]").addEventListener("click", close);
    overlay.addEventListener("click", event => { if (event.target === overlay) close(); });
  }

  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    deferredPrompt = event;
    if (!isStandalone()) showButtons();
  });

  document.addEventListener("click", async event => {
    const button = event.target.closest("[data-install-app]");
    if (!button) return;
    if (isStandalone()) { hideButtons(); return; }
    if (isIOS) { showIOSInstallGuide(); return; }
    if (deferredPrompt) {
      deferredPrompt.prompt();
      try { await deferredPrompt.userChoice; } catch (_) {}
      deferredPrompt = null;
      return;
    }
    alert("Untuk memasang YG GeoPortal, buka menu browser lalu pilih ‘Instal aplikasi’ atau ‘Tambahkan ke layar utama’. Jika pilihan belum muncul, muat ulang halaman lalu coba kembali.");
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    hideButtons();
  });

  if (isStandalone()) hideButtons();
  else if (isIOS) showButtons();

  if (document.getElementById("report-form")) {
    const rulesScript = document.createElement("script");
    rulesScript.src = "js/report-photo-rules.js?v=20260725-photo-simple1";
    rulesScript.async = false;
    document.head.appendChild(rulesScript);

    const maintenanceScript = document.createElement("script");
    maintenanceScript.src = "js/report-infrastructure-maintenance.js?v=20260821-maintenance1";
    maintenanceScript.async = false;
    document.head.appendChild(maintenanceScript);

    const maintenanceMapFixScript = document.createElement("script");
    maintenanceMapFixScript.src = "js/report-maintenance-map-fix.js?v=20260821-maintenance-map1";
    maintenanceMapFixScript.async = false;
    document.head.appendChild(maintenanceMapFixScript);
  }
})();
