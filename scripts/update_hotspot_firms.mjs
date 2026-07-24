import https from "node:https";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const ANALYTICS_PATH = path.join(ROOT, "data", "village-forest-analytics.json");
const VILLAGE_GEOJSON_FILES = (process.env.FIRMS_VILLAGE_GEOJSON || "data/desa_intervensi.geojson")
  .split(",")
  .map((x) => x.trim())
  .filter(Boolean)
  .map((relativePath) => path.join(ROOT, relativePath));

const FIRMS_KEY = process.env.FIRMS_MAP_KEY || "";
const FIRMS_SOURCES = (process.env.FIRMS_SOURCES || "VIIRS_SNPP_SP,VIIRS_NOAA20_SP,VIIRS_SNPP_NRT,VIIRS_NOAA20_NRT,VIIRS_NOAA21_NRT")
  .split(",")
  .map((x) => x.trim())
  .filter(Boolean);
const CHUNK_DAYS = 5;
const REQUEST_TIMEOUT_MS = Number(process.env.FIRMS_TIMEOUT_MS || 90000);
const REQUEST_MAX_ATTEMPTS = Number(process.env.FIRMS_RETRY_ATTEMPTS || 4);
const REQUEST_RETRY_BASE_MS = Number(process.env.FIRMS_RETRY_BASE_MS || 1200);
const API_ROOT = "https://firms.modaps.eosdis.nasa.gov/api";

if (!FIRMS_KEY) {
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

function overlapsBBox(a, b) {
  return !(a.maxX < b.minX || a.minX > b.maxX || a.maxY < b.minY || a.minY > b.maxY);
}

async function fetchAreaCsv(source, bbox, endDateIso) {
  const bboxParam = [bbox.minX, bbox.minY, bbox.maxX, bbox.maxY].map((n) => n.toFixed(6)).join(",");
  const url = `${API_ROOT}/area/csv/${FIRMS_KEY}/${source}/${bboxParam}/${CHUNK_DAYS}/${endDateIso}`;
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
  if (latIndex < 0 || lonIndex < 0 || dateIndex < 0) {
    return [];
  }

  return rows.slice(1).map((line) => {
    const cols = line.split(",");
    return {
      lat: Number(cols[latIndex]),
      lon: Number(cols[lonIndex]),
      date: cols[dateIndex]
    };
  }).filter((row) => Number.isFinite(row.lat) && Number.isFinite(row.lon) && /^\d{4}-\d{2}-\d{2}$/.test(row.date));
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
  for (let year = currentYear - 4; year <= currentYear; year += 1) {
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
      if (!key || byKey.has(key)) {
        continue;
      }
      byKey.set(key, {
        key,
        name: villageName(properties),
        geometry,
        bounds: geometryBounds(geometry)
      });
    }
  }

  return Array.from(byKey.values());
}

async function main() {
  const analytics = JSON.parse(await readFile(ANALYTICS_PATH, "utf-8"));
  const villageItems = await loadVillageBoundaryItems();
  if (!villageItems.length) {
    throw new Error("Tidak ada geometri desa polygon yang valid dari FIRMS_VILLAGE_GEOJSON.");
  }

  const villageBounds = combineBounds(villageItems);
  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const yearlyStart = new Date(Date.UTC(currentYear - 4, 0, 1));

  const villageStats = {};
  for (const village of villageItems) {
    villageStats[village.key] = {
      hotspot7d: 0,
      hotspot30d: 0,
      hotspotYearly5y: initYearRows(currentYear)
    };
  }

  const availability = [];
  for (const source of FIRMS_SOURCES) {
    try {
      availability.push(await getSourceAvailability(source));
    } catch (error) {
      console.warn(`[FIRMS] Lewati source ${source}: ${error.message}`);
    }
  }

  const activeSources = availability.filter((item) => {
    const maxDate = parseIsoDate(item.maxDate);
    return maxDate >= yearlyStart;
  });

  if (!activeSources.length) {
    console.warn("[FIRMS] Tidak ada source FIRMS aktif yang overlap dengan periode 5 tahun terakhir. Lewati update.");
    return;
  }

  const yearIndexByValue = new Map();
  for (let i = 0; i < 5; i += 1) {
    yearIndexByValue.set(currentYear - 4 + i, i);
  }

  for (const sourceInfo of activeSources) {
    const availableStart = parseIsoDate(sourceInfo.minDate);
    const availableEnd = parseIsoDate(sourceInfo.maxDate);
    const rangeStart = availableStart > yearlyStart ? availableStart : yearlyStart;
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
        csv = await fetchAreaCsv(sourceInfo.source, villageBounds, toIsoDate(chunk.end));
      } catch (error) {
        console.warn(`[FIRMS] Lewati chunk ${sourceInfo.source} ${toIsoDate(chunk.start)}..${toIsoDate(chunk.end)}: ${error.message}`);
        continue;
      }
      const points = parseFirmsCsv(csv).filter((point) => {
        const d = parseIsoDate(point.date);
        return d >= chunk.start && d <= chunk.end;
      });

      for (const point of points) {
        const pointCoord = [point.lon, point.lat];
        const pointDate = parseIsoDate(point.date);
        const pointYear = pointDate.getUTCFullYear();

        for (const village of villageItems) {
          if (!overlapsBBox(village.bounds, {
            minX: point.lon,
            minY: point.lat,
            maxX: point.lon,
            maxY: point.lat
          })) {
            continue;
          }
          if (!pointInGeometry(pointCoord, village.geometry)) {
            continue;
          }

          const target = villageStats[village.key];
          const ageDays = daysBetween(now, pointDate);
          if (ageDays >= 0 && ageDays <= 6) {
            target.hotspot7d += 1;
          }
          if (ageDays >= 0 && ageDays <= 29) {
            target.hotspot30d += 1;
          }

          if (yearIndexByValue.has(pointYear)) {
            const rowIndex = yearIndexByValue.get(pointYear);
            target.hotspotYearly5y[rowIndex].count += 1;
          }
        }
      }

      console.log(`[FIRMS] ${sourceInfo.source} chunk ${index + 1}/${chunks.length} points=${points.length}`);
    }
  }

  if (!analytics.villages || typeof analytics.villages !== "object") {
    analytics.villages = {};
  }

  let updated = 0;
  let created = 0;
  const villageByKey = new Map(villageItems.map((item) => [item.key, item]));

  for (const [key, metrics] of Object.entries(villageStats)) {
    const existing = analytics.villages[key];
    if (!existing) {
      const source = villageByKey.get(key);
      analytics.villages[key] = {
        name: source && source.name ? source.name : key,
        village: source && source.name ? source.name : key,
        baselineForestHa: null,
        currentForestHa: null,
        totalLossHa: null,
        gainHa: null,
        annualLossHa: {},
        referenceAreasHa: null,
        hotspot7d: 0,
        hotspot30d: 0,
        hotspot90d: null,
        hotspotYearly5y: initYearRows(currentYear)
      };
      created += 1;
    }

    analytics.villages[key].hotspot7d = metrics.hotspot7d;
    analytics.villages[key].hotspot30d = metrics.hotspot30d;
    analytics.villages[key].hotspot90d = null;
    analytics.villages[key].hotspotYearly5y = metrics.hotspotYearly5y;
    updated += 1;
  }

  analytics.viirs = {
    source: "NASA FIRMS area API (point-in-polygon from village geometry)",
    providers: activeSources.map((item) => item.source),
    updatedAt: new Date().toISOString(),
    periodDays: [7, 30],
    yearlyTrendYears: 5,
    notes: "Counts are derived from FIRMS points intersecting village polygons."
  };

  await writeFile(ANALYTICS_PATH, `${JSON.stringify(analytics, null, 2)}\n`, "utf-8");
  console.log(`[FIRMS] Updated villages: ${updated}, created villages: ${created}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
