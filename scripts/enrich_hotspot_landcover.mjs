import fs from "node:fs/promises";

const inputPath = process.argv[2] || "data/hotspot-high-confidence.geojson";
const outputPath = process.argv[3] || inputPath;
const layer = "esa-worldcover-map-10m-2021-v2_map";
const endpoint = "https://titiler.terrascope.be/wms";
const maxAgeHours = Number(process.env.WORLDCOVER_MAX_AGE_HOURS || 36);
const concurrency = Math.max(1, Number(process.env.WORLDCOVER_CONCURRENCY || 6));
const palette = new Map([
  ["0,100,0", [10, "tree cover"]], ["255,187,34", [20, "shrubland"]],
  ["255,255,76", [30, "grassland"]], ["240,150,255", [40, "cropland"]],
  ["250,0,0", [50, "built-up"]], ["180,180,180", [60, "bare / sparse vegetation"]],
  ["240,240,240", [70, "snow and ice"]], ["0,100,200", [80, "permanent water"]],
  ["0,150,160", [90, "herbaceous wetland"]], ["0,207,117", [95, "mangroves"]],
  ["250,230,160", [100, "moss and lichen"]]
]);

function featureTime(feature) {
  const p = feature.properties || {};
  const time = String(p.acq_time || "0000").padStart(4, "0");
  return new Date(`${p.acq_date}T${time.slice(0, 2)}:${time.slice(2, 4)}:00Z`).getTime();
}

function cellKey(lon, lat) {
  return `${Math.round(lat * 200) / 200}|${Math.round(lon * 200) / 200}`;
}

function classifyRgb(properties) {
  const rgb = [properties.band_1, properties.band_2, properties.band_3].map(Number).join(",");
  const match = palette.get(rgb);
  return match ? { class: match[0], label: match[1], rgb } : { class: null, label: "unclassified colour", rgb };
}

async function queryWorldCover(lon, lat) {
  const delta = 0.0025;
  const params = new URLSearchParams({
    service: "WMS", version: "1.3.0", request: "GetFeatureInfo",
    layers: layer, query_layers: layer, styles: "", time: "2021-01-01",
    crs: "EPSG:4326", bbox: `${lat - delta},${lon - delta},${lat + delta},${lon + delta}`,
    width: "3", height: "3", i: "1", j: "1",
    info_format: "application/geo+json", format: "image/png"
  });
  const response = await fetch(`${endpoint}?${params}`, { headers: { "User-Agent": "YG-GeoPortal/1.0" } });
  if (!response.ok) throw new Error(`WorldCover ${response.status}`);
  const json = await response.json();
  const properties = json.features?.[0]?.properties;
  if (!properties) throw new Error("WorldCover returned no pixel");
  return classifyRgb(properties);
}

async function pooled(items, worker) {
  let cursor = 0;
  const results = new Array(items.length);
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      try { results[index] = await worker(items[index]); }
      catch (error) { results[index] = { class: null, label: "lookup unavailable", error: error.message }; }
    }
  }));
  return results;
}

const geojson = JSON.parse(await fs.readFile(inputPath, "utf8"));
const now = Date.now();
const cutoff = now - maxAgeHours * 3600000;
const recent = (geojson.features || []).filter(feature => featureTime(feature) >= cutoff);
const cells = new Map();
for (const feature of recent) {
  const [lon, lat] = feature.geometry.coordinates;
  const key = cellKey(lon, lat);
  if (!cells.has(key)) cells.set(key, { key, lon, lat });
}
const entries = [...cells.values()];
const values = await pooled(entries, item => queryWorldCover(item.lon, item.lat));
entries.forEach((item, index) => cells.set(item.key, values[index]));

const history = new Map();
for (const feature of geojson.features || []) {
  const [lon, lat] = feature.geometry.coordinates;
  const key = cellKey(lon, lat);
  if (!history.has(key)) history.set(key, new Set());
  history.get(key).add(String(feature.properties?.acq_date || ""));
}

let enriched = 0;
for (const feature of recent) {
  const [lon, lat] = feature.geometry.coordinates;
  const key = cellKey(lon, lat);
  const value = cells.get(key) || {};
  const days = history.get(key)?.size || 0;
  Object.assign(feature.properties, {
    land_cover_class: value.class ?? null,
    land_cover_label: value.label || "lookup unavailable",
    land_cover_source: "ESA WorldCover 2021 v200 / Terrascope WMS categorical-colour triage",
    land_cover_checked_at: new Date().toISOString(),
    persistent_thermal_candidate: days >= 5,
    thermal_detection_days_30d: days
  });
  enriched++;
}

geojson.landCoverScreening = {
  generatedAt: new Date().toISOString(), layer, endpoint, maxAgeHours,
  enrichedFeatures: enriched, queriedCells: entries.length,
  method: "Centre-pixel categorical colour mapped to the published ESA WorldCover palette.",
  limitation: "Conservative triage only. The WMS is a rendered RGB service and ESA states it is not suitable for analysis; classifications must not be treated as fire verification.",
  license: "CC BY 4.0",
  attribution: "© ESA WorldCover project 2021 / Contains modified Copernicus Sentinel data (2021) processed by ESA WorldCover consortium"
};
await fs.writeFile(outputPath, `${JSON.stringify(geojson, null, 2)}\n`);
console.log(JSON.stringify(geojson.landCoverScreening));
