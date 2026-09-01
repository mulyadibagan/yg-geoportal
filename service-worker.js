const CACHE_NAME = "yg-geoportal-v24-20260901-fdrs-sync";

const OFFLINE_ASSETS = [
  "./assets/logo-yayasan-gambut.png",
  "./assets/logo-yayasan-gambut-192.png",
  "./assets/logo-yayasan-gambut-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(OFFLINE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

function isDynamicData(url) {
  return url.hostname === "script.google.com" ||
    url.hostname === "script.googleusercontent.com" ||
    /\/(data\/.*\.(?:json|geojson)|api\/)/i.test(url.pathname);
}

function isPublicSnapshot(url) {
  return /\/(?:master-database-snapshot|dashboard-summary-snapshot)\.json$/i
    .test(url.pathname);
}

function isFreshnessCritical(request, url) {
  return request.mode === "navigate" ||
    request.destination === "document" ||
    request.destination === "script" ||
    request.destination === "style" ||
    /\.(?:html?|js|css)$/i.test(url.pathname) ||
    isDynamicData(url);
}

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Public snapshots drive visible counts and popup evidence. Always prefer
  // the network response so a page never renders an older count first. The
  // cached copy is only an offline fallback.
  if (url.origin === self.location.origin && isPublicSnapshot(url)) {
    event.respondWith(
      caches.open(CACHE_NAME).then(cache =>
        fetch(request, { cache: "no-store" })
          .then(response => {
            if (response && response.ok) cache.put(request, response.clone());
            return response;
          })
          .catch(() => cache.match(request))
      )
    );
    return;
  }

  // Live API/data must never be answered from the service-worker cache.
  if (isDynamicData(url)) {
    event.respondWith(fetch(request, { cache: "no-store" }));
    return;
  }

  // HTML, JS and CSS are network-only while online. This prevents one device
  // from staying on an older WebGIS/Monitoring bundle after a deployment.
  if (isFreshnessCritical(request, url)) {
    event.respondWith(
      fetch(request, { cache: "no-store" }).catch(() => {
        if (request.mode === "navigate") {
          return caches.match(request).then(cached => cached || caches.match("./index.html"));
        }
        return caches.match(request);
      })
    );
    return;
  }

  // Only non-critical static assets use cache-first behavior.
  event.respondWith(
    caches.match(request).then(cached => cached || fetch(request).then(response => {
      if (response && response.ok && url.origin === self.location.origin) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
      }
      return response;
    }))
  );
});
