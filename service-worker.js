const CACHE_NAME = "yg-geoportal-v4-20260721-mangrove-area1";

const STATIC_ASSETS = [
  "./",
  "./index.html",
  "./webgis.html",
  "./monitoring.html",
  "./report.html",
  "./assets/logo-yayasan-gambut.png",
  "./assets/logo-yayasan-gambut-192.png",
  "./assets/logo-yayasan-gambut-512.png",
  "./data/area_kopi.geojson",
  "./css/app.css?v=20260720-search-nursery1",
  "./css/site-brand.css?v=20260720-program-dashboard1",
  "./css/dashboard-v3.css?v=20260720-dashboard-layout2",
  "./css/webgis-v3.css?v=20260720-popup-monitoring1",
  "./css/monitoring.css?v=20260721-object-id1",
  "./css/monitoring-v1-fix.css?v=20260720-104",
  "./css/report.css",
  "./css/report-v6.css?v=20260720-photo-worker2",
  "./js/config.js?v=20260720-area-kopi1",
  "./js/report-v6.js?v=20260720-endpoint1",
  "./js/report-image-worker.js?v=20260720-photo-worker2",
  "./js/report-photo-rules.js?v=20260720-photo-loop-fix1",
  "./js/report-photo-guard.js?v=20260720-photo-loop-fix1",
  "./js/monitoring-data-compat.js?v=20260720-endpoint1",
  "./js/monitoring.js?v=20260721-object-id1",
  "./js/monitoring-photo.js?v=20260720-edge-refresh1",
  "./js/dashboard-v3.js?v=20260720-program-clean1",
  "./js/pwa.js?v=20260720-program-clean1",
  "./js/i18n.js?v=20260720-popup-monitoring2",
  "./js/map-v4.js?v=20260720-donor-audit1",
  "./js/layer-order-v1.js?v=20260720-area-kopi1"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== "GET") return;

  if (
    url.hostname === "script.google.com" ||
    url.hostname === "script.googleusercontent.com"
  ) {
    event.respondWith(fetch(request));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request, { cache: "no-store" })
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
          return response;
        })
        .catch(() =>
          caches.match(request).then(cached =>
            cached || caches.match("./index.html")
          )
        )
    );
    return;
  }

  /*
   * JavaScript dan CSS harus mengutamakan jaringan. Ini mencegah Edge/PWA
   * terus menjalankan bundle lama setelah rilis GitHub Pages terbaru.
   * Cache hanya menjadi cadangan ketika perangkat benar-benar offline.
   */
  if (
    request.destination === "script" ||
    request.destination === "style" ||
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith(".geojson")
  ) {
    event.respondWith(
      fetch(request, { cache: "no-store" })
        .then(response => {
          if (response && response.ok && url.origin === self.location.origin) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => {
      const network = fetch(request)
        .then(response => {
          if (response && response.ok && url.origin === self.location.origin) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);

      return cached || network;
    })
  );
});
