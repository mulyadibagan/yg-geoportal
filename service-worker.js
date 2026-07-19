const CACHE_NAME = "yg-geoportal-v4-20260720-monitoring-date-fix1";

const STATIC_ASSETS = [
  "./",
  "./index.html",
  "./webgis.html",
  "./monitoring.html",
  "./report.html",
  "./assets/logo-yayasan-gambut.png",
  "./assets/logo-yayasan-gambut-192.png",
  "./assets/logo-yayasan-gambut-512.png",
  "./css/app.css",
  "./css/webgis-v3.css",
  "./css/monitoring.css?v=20260720-103",
  "./css/monitoring-v1-fix.css?v=20260720-103",
  "./css/report.css",
  "./css/report-v6.css?v=20260713-40",
  "./js/config.js",
  "./js/report-v6.js?v=20260713-40",
  "./js/report-photo-rules.js?v=20260720-2",
  "./js/monitoring-data-compat.js?v=20260720-2",
  "./js/monitoring.js?v=20260720-103",
  "./js/monitoring-photo.js?v=20260720-103",
  "./js/pwa.js?v=20260720-103",
  "./js/map-v4.js?v=20260719-shapefile-authoritative-corrected5"
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
      fetch(request)
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