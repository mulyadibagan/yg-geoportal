import https from "node:https";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const ANALYTICS_PATH = path.join(
  ROOT,
  process.env.FIRMS_ANALYTICS_OUTPUT || "data/village-forest-analytics.json"
);
const RECENT_POINTS_PATH = path.join(
  ROOT,
  process.env.FIRMS_RECENT_POINTS_OUTPUT || "data/hotspot-high-confidence.geojson"
);
const VILLAGE_GEOJSON_FILES = (process.env.FIRMS_VILLAGE_GEOJSON || "data/desa_intervensi.geojson")
  .split(",")
  .map((x) => x.trim())
  .filter(Boolean)
  .map((relativePath) => path.join(ROOT, relativePath));
const PS_GEOJSON_FILE = path.join(
  ROOT,
  process.env.FIRMS_PS_GEOJSON || "data/PERHUTANAN_SOSIAL_RIAU.geojson"
);
const INCLUDE_SOCIAL_FORESTRY = process.env.FIRMS_INCLUDE_SOCIAL_FORESTRY !== "0";

const FIRMS_KEY = process.env.FIRMS_MAP_KEY || "";
const DRY_RUN = process.env.FIRMS_DRY_RUN === "1";
const MODE = process.env.FIRMS_MODE || "recent";
const FIRMS_SOURCES = (process.env.FIRMS_SOURCES || "MODIS_SP,VIIRS_SNPP_SP,VIIRS_NOAA20_SP")
  .split(",")
  .map((x) => x.trim())
  .filter(Boolean);
const CHUNK_DAYS = Number(process.env.FIRMS_CHUNK_DAYS || 5);
const REQUEST_TIMEOUT_MS = Number(process.env.FIRMS_TIMEOUT_MS || 90000);
const REQUEST_MAX_ATTEMPTS = Number(process.env.FIRMS_RETRY_ATTEMPTS || 4);
const REQUEST_RETRY_BASE_MS = Number(process.env.FIRMS_RETRY_BASE_MS || 1200);
const HISTORY_START_YEAR = Number(process.env.FIRMS_START_YEAR || 2021);
const QUERY_BBOX = (process.env.FIRMS_QUERY_BBOX || "")
  .split(",")
  .map(Number);
const API_ROOT = "https://firms.modaps.eosdis.nasa.gov/api";

if (!FIRMS_KEY && !DRY_RUN) {
  throw new Error("FIRMS_MAP_KEY belum diset. Buat key di https://firms.modaps.eosdis.nasa.gov/api/map_key lalu set env FIRMS_MAP_KEY.");
}

function text(value) {
  return String(value || "").trim();
}

function villageKey(properties) {
  const stable =
    properties.Village_ID ||
    properties.VILLAGE_ID ||
    properties.Kode_Desa ||
    properties.KODE_DESA;
  if (stable) {
    return text(stable).toLowerCase();
  }
  return [
    text(properties.WADMKD || properties.Desa),
    text(properties.WADMKC || properties.Kecamatan),
    text(properties.WADMKK || properties.Kabupaten)
  ]
    .filter(Boolean)
    .join("|")
    .toLowerCase();
}

function villageName(properties) {
  return text(
    properties.WADMKD ||
    properties.Desa ||
    properties.NAMOBJ ||
    properties.Nama_Desa
  );
}

function analysisKeyValue(value) {
  if (typeof value === "number" && Number.isInteger(value)) {
    return value.toFixed(1);
  }
  return text(value);
}

function socialKey(properties) {
  const stable =
    properties.OBJECTID ||
    properties.ID ||
    properties.NO_IUPHKM ||
    properties.SK;
  if (stable) {
    return analysisKeyValue(stable).toLowerCase();
  }
  return [
    text(properties.NAMA_HKM),
    text(properties.NAMA_DESA),
    text(properties.NAMA_KAB)
  ]
    .filter(Boolean)
    .join("|")
    .toLowerCase();
}

function socialName(properties) {
  return text(
    properties.NAMA_HKM ||
    properties.NAMA_DESA ||
    properties.NAMA_KEC ||
    "Perhutanan sosial"
  );
}

function toIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

function parseIsoDate(iso) {
  return new Date(`${iso}T00:00:00.000Z`);
}

function daysBetween(a, b) {
  return Math.floor((a.getTime() - b.getTime()) / 86400000);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableStatus(statusCode) {
  return statusCode === 408 || statusCode === 429 || (statusCode >= 500 && statusCode <= 599);
}

function requestTextOnce(url) {
  return new Promise((resolve, reject) => {
    const request = https.get(
      url,
      {
        headers: {
          "User-Agent": "YG-GeoPortal/1.0"
        }
      },
      (response) => {
        let body = "";
        response.on("data", (chunk) => {
          body += chunk;
        });
        response.on("end", () => {
          const statusCode = response.statusCode || 0;
          if (statusCode < 200 || statusCode >= 300) {
            const error = new Error(`HTTP ${statusCode}: ${body.slice(0, 250)}`);
            error.statusCode = statusCode;
            reject(error);
            return;
          }
          resolve(body);
        });
      }
    );
    request.setTimeout(REQUEST_TIMEOUT_MS, () => {
      request.destroy(new Error(`Request timeout after ${REQUEST_TIMEOUT_MS}ms`));
    });
    request.on("error", reject);
  });
}

async function requestText(url) {
  let lastError = null;
  for (let attempt = 1; attempt <= REQUEST_MAX_ATTEMPTS; attempt += 1) {
    try {
      return await requestTextOnce(url);
    } catch (error) {
      lastError = error;
      const statusCode = Number(error && error.statusCode);
      const retryable = isRetryableStatus(statusCode) || statusCode === 0 || Number.isNaN(statusCode);
      if (!retryable || attempt >= REQUEST_MAX_ATTEMPTS) {
        throw error;
      }
      const backoffMs = REQUEST_RETRY_BASE_MS * Math.pow(2, attempt - 1);
      console.warn(`[FIRMS] Retry ${attempt}/${REQUEST_MAX_ATTEMPTS - 1} after error: ${error.message}`);
      await wait(backoffMs);
    }
  }
  throw lastError;
}

async function getSourceAvailability(source) {
  const csv = await requestText(`${API_ROOT}/data_availability/csv/${FIRMS_KEY}/${source}`);
  const lines = csv.trim().split(/\r?\n/);
  if (lines.length < 2) {
    throw new Error(`Data availability kosong untuk source ${source}`);
  }
  const values = lines[1].split(",");
  return {
    source: values[0],
    minDate: values[1],
    maxDate: values[2]
  };
}

function flattenRings(geometry) {
  if (!geometry) {
    return [];
  }
  if (geometry.type === "Polygon") {
    return [geometry.coordinates];
  }
  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates;
  }
  return [];
}

function pointInRing(point, ring) {
  let inside = false;
  const x = point[0];
  const y = point[1];
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const intersects = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / ((yj - yi) || 1e-12) + xi;
    if (intersects) {
      inside = !inside;
    }
  }
  return inside;
}

function pointInPolygon(point, polygonRings) {
  if (!polygonRings.length) {
    return false;
  }
  if (!pointInRing(point, polygonRings[0])) {
    return false;
  }
  for (let i = 1; i < polygonRings.length; i += 1) {
    if (pointInRing(point, polygonRings[i])) {
      return false;
    }
  }
  return true;
}

function pointInGeometry(point, geometry) {
  const polygons = flattenRings(geometry);
  for (const polygonRings of polygons) {
    if (pointInPolygon(point, polygonRings)) {
      return true;
    }
  }
  return false;
}

function geometryBounds(geometry) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  const walk = (coords) => {
    if (!Array.isArray(coords) || !coords.length) {
      return;
    }
    if (Array.isArray(coords[0])) {
      for (const child of coords) {
        walk(child);
      }
      return;
    }
    const x = Number(coords[0]);
    const y = Number(coords[1]);
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  };

  walk(geometry.coordinates);
  return { minX, minY, maxX, maxY };
}

function combineBounds(items) {
  return items.reduce(
    (acc, item) => ({
      minX: Math.min(acc.minX, item.bounds.minX),
      minY: Math.min(acc.minY, item.bounds.minY),
      maxX: Math.max(acc.maxX, item.bounds.maxX),
      maxY: Math.max(acc.maxY, item.bounds.maxY)
    }),
    { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
  );
}

function combineGeometryBounds(geometries) {
  return combineBounds(geometries.map((geometry) => ({
    bounds: geometryBounds(geometry)
  })));
}

function overlapsBBox(a, b) {
  return !(a.maxX < b.minX || a.minX > b.maxX || a.maxY < b.minY || a.minY > b.maxY);
}

async function fetchAreaCsv(source, bbox, startDateIso) {
  const bboxParam = [bbox.minX, bbox.minY, bbox.maxX, bbox.maxY].map((n) => n.toFixed(6)).join(",");
  // FIRMS interprets DATE as the first day of the requested range, not the
  // final day. Passing chunk.end silently retained only every fifth day after
  // the range filter below.
  const url = `${API_ROOT}/area/csv/${FIRMS_KEY}/${source}/${bboxParam}/${CHUNK_DAYS}/${startDateIso}`;
  return requestText(url);
}

function parseFirmsCsv(csvText) {
  const rows = csvText.trim() ? csvText.trim().split(/\r?\n/) : [];
  if (rows.length <= 1) {
    return [];
  }
  const header = rows[0].split(",").map((x) => x.trim().toLowerCase());
  const latIndex = header.findIndex((h) => h === "latitude");
  const lonIndex = header.findIndex((h) => h === "longitude");
  const dateIndex = header.findIndex((h) => h === "acq_date");
  const timeIndex = header.findIndex((h) => h === "acq_time");
  const satelliteIndex = header.findIndex((h) => h === "satellite");
  const confidenceIndex = header.findIndex((h) => h === "confidence");
  const brightnessIndex = header.findIndex((h) => h === "bright_ti4" || h === "brightness");
  const frpIndex = header.findIndex((h) => h === "frp");
  const daynightIndex = header.findIndex((h) => h === "daynight");
  const typeIndex = header.findIndex((h) => h === "type");
  if (latIndex < 0 || lonIndex < 0 || dateIndex < 0) {
    return [];
  }

  return rows.slice(1).map((line) => {
    const cols = line.split(",");
    return {
      lat: Number(cols[latIndex]),
      lon: Number(cols[lonIndex]),
      date: cols[dateIndex],
      time: timeIndex >= 0 ? text(cols[timeIndex]).padStart(4, "0") : "",
      satellite: satelliteIndex >= 0 ? text(cols[satelliteIndex]) : "",
      confidence: confidenceIndex >= 0 ? text(cols[confidenceIndex]).toLowerCase() : "",
      brightness: brightnessIndex >= 0 ? Number(cols[brightnessIndex]) : null,
      frp: frpIndex >= 0 ? Number(cols[frpIndex]) : null,
      daynight: daynightIndex >= 0 ? text(cols[daynightIndex]).toUpperCase() : "",
      type: typeIndex >= 0 ? text(cols[typeIndex]) : ""
    };
  }).filter((row) => Number.isFinite(row.lat) && Number.isFinite(row.lon) && /^\d{4}-\d{2}-\d{2}$/.test(row.date));
}

function isHighConfidence(point) {
  if (point.confidence === "h" || point.confidence === "high") return true;
  const numeric = Number(point.confidence);
  return Number.isFinite(numeric) && numeric >= 80;
}

function dateRangeChunks(startDate, endDate) {
  const chunks = [];
  let cursor = new Date(startDate);
  while (cursor <= endDate) {
    let chunkEnd = new Date(cursor.getTime() + (CHUNK_DAYS - 1) * 86400000);
    if (chunkEnd > endDate) {
      chunkEnd = endDate;
    }
    chunks.push({ start: new Date(cursor), end: new Date(chunkEnd) });
    cursor = new Date(chunkEnd.getTime() + 86400000);
  }
  return chunks;
}

function initYearRows(currentYear) {
  const rows = [];
  for (let year = Math.min(HISTORY_START_YEAR, currentYear); year <= currentYear; year += 1) {
    rows.push({ year: String(year), count: 0 });
  }
  return rows;
}

function hasPolygonGeometry(geometry) {
  return geometry && (geometry.type === "Polygon" || geometry.type === "MultiPolygon");
}

async function loadVillageBoundaryItems() {
  const byKey = new Map();

  for (const filePath of VILLAGE_GEOJSON_FILES) {
    let parsed;
    try {
      parsed = JSON.parse(await readFile(filePath, "utf-8"));
    } catch (error) {
      console.warn(`[FIRMS] Lewati boundary file ${filePath}: ${error.message}`);
      continue;
    }

    for (const feature of parsed.features || []) {
      const properties = feature.properties || {};
      const geometry = feature.geometry;
      if (!hasPolygonGeometry(geometry)) {
        continue;
      }
      const key = villageKey(properties);
      if (!key) {
        continue;
      }
      if (!byKey.has(key)) {
        byKey.set(key, { key, name: villageName(properties), geometries: [] });
      }
      byKey.get(key).geometries.push(geometry);
    }
  }

  return Array.from(byKey.values()).map((item) => ({
    ...item,
    bounds: combineGeometryBounds(item.geometries)
  }));
}

async function loadSocialForestryItems() {
  const parsed = JSON.parse(await readFile(PS_GEOJSON_FILE, "utf-8"));
  const byKey = new Map();
  let featureCount = 0;
  for (const feature of parsed.features || []) {
    const properties = feature.properties || {};
    const geometry = feature.geometry;
    if (!hasPolygonGeometry(geometry)) {
      continue;
    }
    const key = socialKey(properties);
    if (!key) {
      continue;
    }
    featureCount += 1;
    if (!byKey.has(key)) {
      byKey.set(key, {
        collection: "socialForestry",
        key,
        name: socialName(properties),
        geometries: []
      });
    }
    byKey.get(key).geometries.push(geometry);
  }
  const items = Array.from(byKey.values()).map((item) => ({
    ...item,
    bounds: combineGeometryBounds(item.geometries)
  }));
  return { items, featureCount };
}

function pointInUnit(point, unit) {
  return unit.geometries.some((geometry) => pointInGeometry(point, geometry));
}

async function main() {
  if (!["recent", "history", "all"].includes(MODE)) {
    throw new Error(`FIRMS_MODE tidak valid: ${MODE}`);
  }
  const analytics = JSON.parse(await readFile(ANALYTICS_PATH, "utf-8"));
  const rawVillageItems = await loadVillageBoundaryItems();
  const villageItems = rawVillageItems.map((item) => ({
    ...item,
    collection: "villages"
  }));
  const social = INCLUDE_SOCIAL_FORESTRY
    ? await loadSocialForestryItems()
    : { items: [], featureCount: 0 };
  const allItems = [...villageItems, ...social.items];
  const unitItems = allItems.filter(
    (item) => analytics?.[item.collection]?.[item.key]
  );
  const unmatchedItems = allItems.filter(
    (item) => !analytics?.[item.collection]?.[item.key]
  );
  if (!villageItems.length) {
    throw new Error("Tidak ada geometri desa polygon yang valid dari FIRMS_VILLAGE_GEOJSON.");
  }
  if (INCLUDE_SOCIAL_FORESTRY && !social.items.length) {
    throw new Error("Tidak ada geometri perhutanan sosial yang valid.");
  }
  if (unmatchedItems.length) {
    console.warn(
      `[FIRMS] Lewati ${unmatchedItems.length} unit tanpa record analitik; tidak membuat record baru.`
    );
  }

  console.log(
    `[FIRMS] Target units: matched=${unitItems.length}; unmatched=${unmatchedItems.length}; ` +
    `villages=${villageItems.length}; PS features=${social.featureCount}; PS units=${social.items.length}`
  );
  if (DRY_RUN) {
    return;
  }

  const analysisBounds = QUERY_BBOX.length === 4 && QUERY_BBOX.every(Number.isFinite)
    ? { minX: QUERY_BBOX[0], minY: QUERY_BBOX[1], maxX: QUERY_BBOX[2], maxY: QUERY_BBOX[3] }
    : combineBounds(unitItems);
  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const yearlyStart = new Date(Date.UTC(Math.min(HISTORY_START_YEAR, currentYear), 0, 1));
  const recentStart = new Date(now);
  recentStart.setUTCDate(recentStart.getUTCDate() - 29);
  recentStart.setUTCHours(0, 0, 0, 0);
  const requestedStart = MODE === "recent" ? recentStart : yearlyStart;

  const unitStats = new Map();
  for (const unit of unitItems) {
    unitStats.set(`${unit.collection}|${unit.key}`, {
      hotspot7d: 0,
      hotspot30d: 0,
      hotspotYearly5y: initYearRows(currentYear)
    });
  }

  const availability = [];
  if (MODE === "recent") {
    for (const source of FIRMS_SOURCES) {
      availability.push({
        source,
        minDate: toIsoDate(recentStart),
        maxDate: toIsoDate(now)
      });
    }
  } else {
    for (const source of FIRMS_SOURCES) {
      try {
        availability.push(await getSourceAvailability(source));
      } catch (error) {
        console.warn(`[FIRMS] Lewati source ${source}: ${error.message}`);
      }
    }
  }

  const activeSources = availability.filter((item) => {
    const maxDate = parseIsoDate(item.maxDate);
    return maxDate >= requestedStart;
  });

  if (!activeSources.length) {
    throw new Error(`Tidak ada source FIRMS aktif untuk mode ${MODE}.`);
  }

  const yearIndexByValue = new Map();
  const yearlyRows = initYearRows(currentYear);
  for (let i = 0; i < yearlyRows.length; i += 1) {
    yearIndexByValue.set(Number(yearlyRows[i].year), i);
  }

  const seenDetections = new Set();
  const recentDetections = [];
  const skippedChunks = [];
  for (const sourceInfo of activeSources) {
    const availableStart = parseIsoDate(sourceInfo.minDate);
    const availableEnd = parseIsoDate(sourceInfo.maxDate);
    const rangeStart = availableStart > requestedStart ? availableStart : requestedStart;
    const rangeEnd = availableEnd < now ? availableEnd : now;
    if (rangeStart > rangeEnd) {
      continue;
    }

    console.log(`[FIRMS] Source ${sourceInfo.source} ${toIsoDate(rangeStart)}..${toIsoDate(rangeEnd)}`);
    const chunks = dateRangeChunks(rangeStart, rangeEnd);

    for (let index = 0; index < chunks.length; index += 1) {
      const chunk = chunks[index];
      let csv = "";
      try {
        csv = await fetchAreaCsv(sourceInfo.source, analysisBounds, toIsoDate(chunk.start));
      } catch (error) {
        console.warn(`[FIRMS] Lewati chunk ${sourceInfo.source} ${toIsoDate(chunk.start)}..${toIsoDate(chunk.end)}: ${error.message}`);
        skippedChunks.push({
          source: sourceInfo.source,
          start: toIsoDate(chunk.start),
          end: toIsoDate(chunk.end),
          error: String(error.message || error)
        });
        continue;
      }
      const points = parseFirmsCsv(csv).filter(isHighConfidence).filter((point) => point.type !== "3").filter((point) => {
        const d = parseIsoDate(point.date);
        return d >= chunk.start && d <= chunk.end;
      }).filter((point) => {
        const detectionKey = [
          point.date,
          point.time,
          point.satellite,
          point.lat.toFixed(5),
          point.lon.toFixed(5)
        ].join("|");
        if (seenDetections.has(detectionKey)) {
          return false;
        }
        seenDetections.add(detectionKey);
        return true;
      });

      if (MODE !== "history") {
        recentDetections.push(...points);
      }

      for (const point of points) {
        const pointCoord = [point.lon, point.lat];
        const pointDate = parseIsoDate(point.date);
        const pointYear = pointDate.getUTCFullYear();

        for (const unit of unitItems) {
          if (!overlapsBBox(unit.bounds, {
            minX: point.lon,
            minY: point.lat,
            maxX: point.lon,
            maxY: point.lat
          })) {
            continue;
          }
          if (!pointInUnit(pointCoord, unit)) {
            continue;
          }

          const target = unitStats.get(`${unit.collection}|${unit.key}`);
          const ageDays = daysBetween(now, pointDate);
          if (MODE !== "history" && ageDays >= 0 && ageDays <= 6) {
            target.hotspot7d += 1;
          }
          if (MODE !== "history" && ageDays >= 0 && ageDays <= 29) {
            target.hotspot30d += 1;
          }

          if (MODE !== "recent" && yearIndexByValue.has(pointYear)) {
            const rowIndex = yearIndexByValue.get(pointYear);
            target.hotspotYearly5y[rowIndex].count += 1;
          }
        }
      }

      console.log(`[FIRMS] ${sourceInfo.source} chunk ${index + 1}/${chunks.length} points=${points.length}`);
    }
  }

  let updated = 0;
  for (const unit of unitItems) {
    const metrics = unitStats.get(`${unit.collection}|${unit.key}`);
    const target = analytics[unit.collection][unit.key];
    if (MODE !== "history") {
      target.hotspot7d = metrics.hotspot7d;
      target.hotspot30d = metrics.hotspot30d;
      target.hotspot90d = null;
    }
    if (MODE !== "recent") {
      target.hotspotYearly5y = metrics.hotspotYearly5y;
    }
    updated += 1;
  }

  const previousViirs = analytics.viirs || {};
  analytics.viirs = {
    ...previousViirs,
    source: "NASA FIRMS area API (point-in-polygon)",
    providers: activeSources.map((item) => item.source),
    updatedAt: new Date().toISOString(),
    recentUpdatedAt: MODE !== "history"
      ? new Date().toISOString()
      : previousViirs.recentUpdatedAt || null,
    historyUpdatedAt: MODE !== "recent"
      ? new Date().toISOString()
      : previousViirs.historyUpdatedAt || null,
    mode: MODE,
    periodDays: [7, 30],
    yearlyTrendYears: yearlyRows.length,
    historyStartYear: Math.min(HISTORY_START_YEAR, currentYear),
    status: skippedChunks.length ? "partial" : "complete",
    skippedChunks,
    units: {
      villages: villageItems.length,
      socialForestryFeatures: social.featureCount,
      socialForestryUnits: social.items.length,
      updated: updated
    },
    confidenceFilter: "high",
    notes: "Counts include only high-confidence FIRMS points, deduplicated and intersected with village and social-forestry polygons."
  };

  if (MODE !== "history") {
    const features = recentDetections.map((point) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [point.lon, point.lat] },
      properties: {
        acq_date: point.date,
        acq_time: point.time,
        satellite: point.satellite,
        confidence: "high",
        brightness: Number.isFinite(point.brightness) ? point.brightness : null,
        frp: Number.isFinite(point.frp) ? point.frp : null,
        daynight: point.daynight || null,
        type: point.type || null
      }
    }));
    await writeFile(RECENT_POINTS_PATH, `${JSON.stringify({
      type: "FeatureCollection",
      generatedAt: new Date().toISOString(),
      periodDays: 30,
      confidenceFilter: "high",
      sourceStatus: skippedChunks.length ? "partial" : "complete",
      skippedChunks,
      providers: activeSources.map((item) => item.source),
      coverageStart: toIsoDate(recentStart),
      coverageEnd: toIsoDate(now),
      features
    }, null, 2)}\n`, "utf-8");
  }

  await writeFile(ANALYTICS_PATH, `${JSON.stringify(analytics, null, 2)}\n`, "utf-8");
  console.log(
    `[FIRMS] Updated units: ${updated}; villages=${villageItems.length}; ` +
    `PS features=${social.featureCount}; PS units=${social.items.length}; ` +
    `skipped chunks=${skippedChunks.length}`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
