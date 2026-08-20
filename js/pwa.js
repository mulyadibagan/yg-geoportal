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
      navigator.serviceWorker.getRegistrations().then(registrations => {
        registrations.forEach(registration => registration.unregister());
      });
      return;
    }

    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("./service-worker.js?v=20260820-monitoring-legacy-photos", { updateViaCache: "none" })
        .then(registration => {
          registration.update();

          // Re-check periodically while the site stays open so tablets/phones
          // do not remain on an old worker for days.
          window.setInterval(() => registration.update(), 60 * 60 * 1000);
        })
        .catch(error => console.warn("Pendaftaran service worker gagal:", error));
    });

    navigator.serviceWorker.addEventListener("controllerchange", () => {
      const reloadKey = "yg-sw-freshness-20260820-6";
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
    rulesScript.src = "js/report-photo-rules.js?v=20260725-photo-simple1";
    rulesScript.async = false;
    document.head.appendChild(rulesScript);
  }
})();
