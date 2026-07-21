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
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("./service-worker.js?v=20260721-legacy-photo1", {
          updateViaCache: "none"
        })
        .then(registration => registration.update())
        .catch(error => console.warn("Service worker gagal:", error));
    });

    navigator.serviceWorker.addEventListener("controllerchange", () => {
      const reloadKey = "yg-sw-legacy-photo1";
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
