(() => {
  "use strict";

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("./service-worker.js?v=20260720-edge-refresh1", {
          updateViaCache: "none"
        })
        .then(registration => registration.update())
        .catch(error => console.warn("Service worker gagal:", error));
    });

    navigator.serviceWorker.addEventListener("controllerchange", () => {
      const reloadKey = "yg-sw-edge-refresh1";
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
    rulesScript.src = "js/report-photo-rules.js?v=20260720-area-photo-optional1";
    rulesScript.async = false;
    document.head.appendChild(rulesScript);

    const guardScript = document.createElement("script");
    guardScript.src = "js/report-photo-guard.js?v=20260720-area-photo-optional1";
    guardScript.async = false;
    document.head.appendChild(guardScript);
  }
})();
