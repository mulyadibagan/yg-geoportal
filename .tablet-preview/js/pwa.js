(() => {
  "use strict";

  /*
   * data-updates.js dimuat lebih dahulu dan menyiapkan callback JSONP.
   * Muat koreksi target segera setelahnya agar foto lama FDRS, sekat kanal,
   * dan objek program kembali dicocokkan ke Object ID sasaran yang benar.
   */
  if (document.querySelector('script[src*="data-updates.js"]')) {
    const targetFixScript = document.createElement("script");
    targetFixScript.src = "js/public-update-target-fix.js?v=20260721-legacy-photo1";
    targetFixScript.async = false;
    document.head.appendChild(targetFixScript);
  }

  if ("serviceWorker" in navigator) {
    // Don't register service worker on localhost to avoid caching issues during development.
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
      console.log('PWA Service Worker tidak diaktifkan di lingkungan development.');
      navigator.serviceWorker.getRegistrations().then(function(registrations) {
        for (const registration of registrations) {
          registration.unregister();
          console.log('Service worker lama dihapus untuk development.');
        }
      });
      return;
    }

    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("./service-worker.js?v=20260723-layout-hotfix")
        .then(registration => {
          console.log("Service worker terdaftar:", registration);
          registration.update();
        })
        .catch(error => console.warn("Pendaftaran service worker gagal:", error));
    });

    navigator.serviceWorker.addEventListener("controllerchange", () => {
      const reloadKey = "yg-sw-layout-hotfix";
      if (sessionStorage.getItem(reloadKey)) return;
      sessionStorage.setItem(reloadKey, "done");
      window.location.reload();
    });
  }

  let deferredPrompt = null;

  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    deferredPrompt = event;

    document.querySelectorAll("[data-install-app]").forEach(button => {
      button.hidden = false;
    });
  });

  document.addEventListener("click", async event => {
    const button = event.target.closest("[data-install-app]");
    if (!button || !deferredPrompt) return;

    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    button.hidden = true;
  });

  window.addEventListener("appinstalled", () => {
    document.querySelectorAll("[data-install-app]").forEach(button => {
      button.hidden = true;
    });
  });

  if (document.getElementById("report-form")) {
    const rulesScript = document.createElement("script");
    rulesScript.src = "js/report-photo-rules.js?v=20260720-photo-loop-fix1";
    rulesScript.async = false;
    document.head.appendChild(rulesScript);

    const guardScript = document.createElement("script");
    guardScript.src = "js/report-photo-guard.js?v=20260720-photo-loop-fix1";
    guardScript.async = false;
    document.head.appendChild(guardScript);
  }
})();
