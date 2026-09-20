const CACHE_NAME = "yg-geoportal-v27-20260920-dayun-entry";
const DAYUN_CACHE_NAME = "yg-dayun-offline-v1";
const DAYUN_META_URL = "/__dayun_offline_meta__";

const OFFLINE_ASSETS = [
  "./assets/logo-yayasan-gambut.png",
  "./assets/logo-yayasan-gambut-192.png",
  "./assets/logo-yayasan-gambut-512.png"
];

const DAYUN_CORE_ASSETS = [
  "/dayun-map.html",
  "/dayun.html",
  "/dayun-gawangan.html",
  "/dayun-blok.html",
  "/dayun-analisis-nanas.html",
  "/dayun-panduan-budidaya.html",
  "/manifest-dayun.webmanifest",
  "/assets/logo-yayasan-gambut.png",
  "/assets/logo-yayasan-gambut-192.png",
  "/assets/logo-yayasan-gambut-512.png",
  "/css/style.css",
  "/css/language-switcher.css",
  "/css/navigation-v2.css",
  "/css/user-location-control.css",
  "/css/dayun.css",
  "/css/dayun-gawangan.css",
  "/css/dayun-analisis-nanas.css",
  "/js/auth.js",
  "/js/navigation-v2.js",
  "/js/user-location-control.js",
  "/js/dayun-data-source.js",
  "/js/dayun-agro-summary.js",
  "/js/dayun-public.js",
  "/js/dayun-offline.js",
  "/js/dayun-gawangan.js",
  "/js/dayun-blok.js",
  "/js/dayun-pineapple-analysis.js",
  "/js/dayun-analisis-nanas.js",
  "/data/dayun-program.json",
  "/data/dayun-map.geojson",
  "/data/dayun-context.geojson",
  "/data/dayun-gawangan-details.json",
  "/data/dayun-blocks.geojson",
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css",
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
];

const DAYUN_PATHS = new Set(DAYUN_CORE_ASSETS
  .filter(asset => asset.startsWith("/"))
  .map(asset => new URL(asset, self.location.origin).pathname));

function tileNumberX(longitude, zoom) {
  return Math.floor((longitude + 180) / 360 * Math.pow(2, zoom));
}

function tileNumberY(latitude, zoom) {
  const radians = latitude * Math.PI / 180;
  return Math.floor((1 - Math.asinh(Math.tan(radians)) / Math.PI) / 2 * Math.pow(2, zoom));
}

function tileUrls(bounds, minZoom, maxZoom, padding) {
  const urls = [];
  for (let zoom = minZoom; zoom <= maxZoom; zoom += 1) {
    const minX = tileNumberX(bounds.west, zoom) - padding;
    const maxX = tileNumberX(bounds.east, zoom) + padding;
    const minY = tileNumberY(bounds.north, zoom) - padding;
    const maxY = tileNumberY(bounds.south, zoom) + padding;
    for (let x = minX; x <= maxX; x += 1) {
      for (let y = minY; y <= maxY; y += 1) {
        urls.push(`https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${zoom}/${y}/${x}`);
      }
    }
  }
  return urls;
}

const DAYUN_TILE_ASSETS = [
  // Kampung Dayun/HKm context at overview zooms.
  ...tileUrls({ west: 101.83839, south: 0.52919, east: 102.36539, north: 0.78469 }, 10, 12, 0),
  // The mapped agroforestry blocks with one-tile field buffer.
  ...tileUrls({ west: 102.0040, south: 0.5793, east: 102.0141, north: 0.5888 }, 13, 18, 1)
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
        keys
          .filter(key => key.startsWith("yg-geoportal-v") && key !== CACHE_NAME)
          .map(key => caches.delete(key))
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

function isDayunRequest(url) {
  return (url.origin === self.location.origin && DAYUN_PATHS.has(url.pathname)) ||
    url.hostname === "server.arcgisonline.com" ||
    (url.hostname === "unpkg.com" && /\/leaflet@1\.9\.4\/dist\/leaflet\.(?:css|js)$/.test(url.pathname));
}

async function cacheDayunResource(cache, asset) {
  const url = new URL(asset, self.location.origin);
  const external = url.origin !== self.location.origin;
  const request = new Request(url.href, {
    mode: external ? "no-cors" : "same-origin",
    credentials: external ? "omit" : "same-origin",
    cache: "reload"
  });
  const response = await fetch(request);
  if (!external && !response.ok) throw new Error(`HTTP ${response.status}: ${url.pathname}`);
  await cache.put(request, response.clone());
}

async function notifyDayunClients(payload) {
  const clients = await self.clients.matchAll({ includeUncontrolled: true, type: "window" });
  clients.forEach(client => client.postMessage(payload));
}

let dayunDownloadPromise = null;

async function downloadDayunPackage() {
  const cache = await caches.open(DAYUN_CACHE_NAME);
  const assets = [...DAYUN_CORE_ASSETS, ...DAYUN_TILE_ASSETS];
  let completed = 0;
  const batchSize = 6;
  for (let index = 0; index < assets.length; index += batchSize) {
    const batch = assets.slice(index, index + batchSize);
    await Promise.all(batch.map(asset => cacheDayunResource(cache, asset).then(() => {
      completed += 1;
      return notifyDayunClients({ type: "DAYUN_OFFLINE_PROGRESS", completed, total: assets.length });
    })));
  }
  const meta = { ready: true, savedAt: new Date().toISOString(), assetCount: assets.length, tileCount: DAYUN_TILE_ASSETS.length };
  await cache.put(DAYUN_META_URL, new Response(JSON.stringify(meta), { headers: { "Content-Type": "application/json" } }));
  await notifyDayunClients({ type: "DAYUN_OFFLINE_READY", meta });
  return meta;
}

async function dayunStatus() {
  const cache = await caches.open(DAYUN_CACHE_NAME);
  const response = await cache.match(DAYUN_META_URL);
  if (!response) return { ready: false };
  try { return await response.json(); } catch (_) { return { ready: false }; }
}

async function offlineNavigationFallback(request) {
  const requestUrl = new URL(request.url);
  const opensGeneralPwa = requestUrl.origin === self.location.origin &&
    (requestUrl.pathname === "/" || requestUrl.pathname === "/index.html");
  if (opensGeneralPwa) {
    const meta = await dayunStatus();
    if (meta.ready) {
      const dayunCache = await caches.open(DAYUN_CACHE_NAME);
      const dayunMap = await dayunCache.match(new URL("/dayun-map.html", self.location.origin).href, { ignoreSearch: true });
      if (dayunMap) return dayunMap;
    }
  }
  const cached = await caches.match(request, { ignoreSearch: true });
  return cached || caches.match("./index.html");
}

self.addEventListener("message", event => {
  const data = event.data || {};
  if (data.type === "DAYUN_OFFLINE_DOWNLOAD") {
    if (!dayunDownloadPromise) {
      dayunDownloadPromise = downloadDayunPackage()
        .catch(async error => {
          await notifyDayunClients({ type: "DAYUN_OFFLINE_ERROR", message: error && error.message ? error.message : "Unduhan gagal" });
          throw error;
        })
        .finally(() => { dayunDownloadPromise = null; });
    }
    event.waitUntil(dayunDownloadPromise.catch(() => undefined));
    return;
  }
  if (data.type === "DAYUN_OFFLINE_STATUS") {
    event.waitUntil(dayunStatus().then(meta => event.ports[0] && event.ports[0].postMessage(meta)));
    return;
  }
  if (data.type === "DAYUN_OFFLINE_DELETE") {
    event.waitUntil(caches.delete(DAYUN_CACHE_NAME).then(() => {
      if (event.ports[0]) event.ports[0].postMessage({ ready: false });
      return notifyDayunClients({ type: "DAYUN_OFFLINE_DELETED" });
    }));
  }
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  if (isDayunRequest(url)) {
    event.respondWith(
      fetch(request, { cache: "no-store" })
        .then(response => {
          if (response && (response.ok || response.type === "opaque")) {
            caches.open(DAYUN_CACHE_NAME).then(cache => cache.put(request, response.clone()));
          }
          return response;
        })
        .catch(() => caches.open(DAYUN_CACHE_NAME).then(cache => cache.match(request, { ignoreSearch: true })))
    );
    return;
  }

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
        if (request.mode === "navigate") return offlineNavigationFallback(request);
        return caches.match(request, { ignoreSearch: true });
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
