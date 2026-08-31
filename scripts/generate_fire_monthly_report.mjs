import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MONTH = process.argv.includes("--month") ? process.argv[process.argv.indexOf("--month") + 1] : "2026-07";
const ARCHIVE_DIR = process.argv.includes("--archive-dir") ? process.argv[process.argv.indexOf("--archive-dir") + 1] : "";
const GEOJSON_ARCHIVE = process.argv.includes("--geojson-archive") ? process.argv[process.argv.indexOf("--geojson-archive") + 1] : "";
const MAP_KEY = process.env.FIRMS_MAP_KEY || "";
const API_SOURCES = ["MODIS_SP", "VIIRS_SNPP_SP", "VIIRS_NOAA20_SP"];
const API = "https://firms.modaps.eosdis.nasa.gov/api/area/csv";
if (!/^\d{4}-\d{2}$/.test(MONTH)) throw new Error("Format bulan harus YYYY-MM");
if (!ARCHIVE_DIR && !GEOJSON_ARCHIVE && !MAP_KEY) throw new Error("FIRMS_MAP_KEY belum tersedia");

const [year, month] = MONTH.split("-").map(Number);
const start = new Date(Date.UTC(year, month - 1, 1));
const end = new Date(Date.UTC(year, month, 0));
const iso = (d) => d.toISOString().slice(0, 10);
const outputDir = path.join(ROOT, "data", "fire-monthly");
const province = JSON.parse(await readFile(path.join(ROOT, "data", "batas_provinsi_riau_dissolve.geojson"), "utf8"));
const villages = JSON.parse(await readFile(path.join(ROOT, "data", "batas_administrasi_desa_riau.geojson"), "utf8"));
const permits = JSON.parse(await readFile(path.join(ROOT, "data", "PBPH_RIAU_052026.geojson"), "utf8"));

function csvRows(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i], next = text[i + 1];
    if (c === '"' && quoted && next === '"') { field += '"'; i++; }
    else if (c === '"') quoted = !quoted;
    else if (c === "," && !quoted) { row.push(field); field = ""; }
    else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && next === "\n") i++;
      row.push(field); if (row.some(Boolean)) rows.push(row); row = []; field = "";
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const headers = rows.shift() || [];
  return rows.map((values) => Object.fromEntries(headers.map((h, i) => [h.trim(), values[i] ?? ""])));
}

function pointInRing(point, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
    if (((yi > point[1]) !== (yj > point[1])) && point[0] < (xj - xi) * (point[1] - yi) / ((yj - yi) || Number.EPSILON) + xi) inside = !inside;
  }
  return inside;
}
function pointInGeometry(point, geometry) {
  if (!geometry) return false;
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.type === "MultiPolygon" ? geometry.coordinates : [];
  return polygons.some((polygon) => polygon[0] && pointInRing(point, polygon[0]) && !polygon.slice(1).some((hole) => pointInRing(point, hole)));
}
function boundsOf(geometry) {
  const points = [];
  if (!geometry || !geometry.coordinates) return null;
  (function walk(value) { if (Array.isArray(value) && typeof value[0] === "number") points.push(value); else if (Array.isArray(value)) value.forEach(walk); })(geometry.coordinates);
  if (!points.length) return null;
  return points.reduce((b, p) => [Math.min(b[0], p[0]), Math.min(b[1], p[1]), Math.max(b[2], p[0]), Math.max(b[3], p[1])], [Infinity, Infinity, -Infinity, -Infinity]);
}
function indexed(features) {
  return features.map((feature) => ({ feature, bounds: boundsOf(feature.geometry) })).filter((item) => item.bounds);
}
function contains(item, point) {
  const b = item.bounds;
  return point[0] >= b[0] && point[0] <= b[2] && point[1] >= b[1] && point[1] <= b[3] && pointInGeometry(point, item.feature.geometry);
}
function highConfidence(row) {
  const value = String(row.confidence || "").toLowerCase();
  return value === "h" || value === "high" || Number(value) >= 80;
}
async function fetchChunk(source, chunkStart, days) {
  const bbox = "100.0,-1.3,104.9,2.9";
  const chunkEnd = new Date(chunkStart.getTime() + (days - 1) * 86400000);
  const url = `${API}/${MAP_KEY}/${source}/${bbox}/${days}/${iso(chunkEnd)}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${source} ${iso(chunkStart)} HTTP ${response.status}`);
  const body = await response.text();
  const rows = csvRows(body);
  console.log(`[FIRMS] ${source} ${iso(chunkStart)} +${days}d: ${rows.length} rows`);
  if (!rows.length && body.trim() && !/^latitude,/i.test(body.trim())) console.warn(`[FIRMS] Response: ${body.trim().slice(0, 240)}`);
  return rows;
}

const raw = [];
const sourcesUsed = [];
if (GEOJSON_ARCHIVE) {
  const archive = JSON.parse(await readFile(path.resolve(ROOT, GEOJSON_ARCHIVE), "utf8"));
  for (const feature of archive.features || []) {
    const p = feature.properties || {}, coordinates = feature.geometry?.coordinates || [];
    raw.push({ ...p, longitude: coordinates[0], latitude: coordinates[1], source: p.source || p.satellite || "NASA FIRMS daily archive" });
  }
  sourcesUsed.push(...new Set(raw.map((row) => row.source)));
  console.log(`[R2 ARCHIVE] ${raw.length} rows`);
} else if (ARCHIVE_DIR) {
  const archivePath = path.resolve(ROOT, ARCHIVE_DIR);
  const files = (await readdir(archivePath)).filter((name) => name.toLowerCase().endsWith(".csv")).sort();
  if (!files.length) throw new Error(`CSV arsip tidak ditemukan di ${archivePath}`);
  for (const file of files) {
    const source = file.includes("M-C61") ? "MODIS C6.1" : file.includes("J1V-C2") ? "VIIRS NOAA-20 C2" : file.includes("J2V-C2") ? "VIIRS NOAA-21 C2" : file.includes("SV-C2") ? "VIIRS S-NPP C2" : file;
    const rows = csvRows(await readFile(path.join(archivePath, file), "utf8"));
    rows.forEach((row) => raw.push({ ...row, source }));
    sourcesUsed.push(source);
    console.log(`[ARCHIVE] ${source}: ${rows.length} rows`);
  }
} else {
  for (const source of API_SOURCES) {
    for (let cursor = new Date(start); cursor <= end;) {
      const remaining = Math.floor((end - cursor) / 86400000) + 1;
      const days = Math.min(5, remaining);
      const rows = await fetchChunk(source, cursor, days);
      rows.forEach((row) => raw.push({ ...row, source }));
      cursor = new Date(cursor.getTime() + days * 86400000);
    }
    sourcesUsed.push(source);
  }
}
if (!raw.length) throw new Error("NASA FIRMS tidak mengembalikan baris data untuk Juli 2026; snapshot kosong tidak diterbitkan.");

const provinceGeometry = province.features[0].geometry;
const villageIndex = indexed(villages.features || []);
const permitIndex = indexed(permits.features || []);
const seen = new Set(), detections = [];
let highConfidenceRows = 0, datedRows = 0, riauRows = 0;
for (const row of raw) {
  if (!highConfidence(row)) continue;
  highConfidenceRows++;
  if (!row.acq_date || row.acq_date < iso(start) || row.acq_date > iso(end)) continue;
  datedRows++;
  const lon = Number(row.longitude), lat = Number(row.latitude), point = [lon, lat];
  if (!Number.isFinite(lon) || !Number.isFinite(lat) || !pointInGeometry(point, provinceGeometry)) continue;
  riauRows++;
  const key = [row.acq_date, row.acq_time, lon.toFixed(5), lat.toFixed(5), row.satellite || row.source].join("|");
  if (seen.has(key)) continue;
  seen.add(key);
  const village = villageIndex.find((item) => contains(item, point));
  const permitMatches = permitIndex.filter((item) => contains(item, point));
  detections.push({
    date: row.acq_date, time: row.acq_time, longitude: lon, latitude: lat,
    satellite: row.satellite || row.source, confidence: row.confidence,
    brightness: Number(row.bright_ti4 || row.brightness || row.bright_t31) || null,
    frp: Number(row.frp) || null,
    village: village ? village.feature.properties.WADMKD || village.feature.properties.NAMOBJ || "" : "",
    district: village ? village.feature.properties.WADMKC || "" : "",
    regency: village ? village.feature.properties.WADMKK || "" : "",
    permits: permitMatches.map(({ feature }) => ({
      name: feature.properties.NAMOBJ || "Tidak teridentifikasi",
      sk: feature.properties.NO_SK || "",
      areaHa: Number(feature.properties.LSSK) || null
    })).filter((value, index, array) => array.findIndex((x) => x.name === value.name && x.sk === value.sk) === index)
  });
}
console.log(`[FILTER] raw=${raw.length}; high=${highConfidenceRows}; dated=${datedRows}; insideRiau=${riauRows}; unique=${detections.length}`);
if (!detections.length) throw new Error("Tidak ada deteksi yang lolos filter Riau; snapshot kosong tidak diterbitkan.");

const dailyMap = new Map(), villageMap = new Map(), companyMap = new Map(), regencies = new Set();
for (const item of detections) {
  dailyMap.set(item.date, (dailyMap.get(item.date) || 0) + 1);
  if (item.village) {
    const key = [item.village, item.district, item.regency].join("|");
    if (!villageMap.has(key)) villageMap.set(key, { village: item.village, district: item.district, regency: item.regency, hotspots: 0, dates: new Set(), lastDetection: "" });
    const target = villageMap.get(key); target.hotspots++; target.dates.add(item.date); if (item.date > target.lastDetection) target.lastDetection = item.date;
    if (item.regency) regencies.add(item.regency);
  }
  for (const permit of item.permits) {
    const key = [permit.name, permit.sk].join("|");
    if (!companyMap.has(key)) companyMap.set(key, { name: permit.name, sk: permit.sk, areaHa: permit.areaHa, hotspots: 0, dates: new Set(), villages: new Set() });
    const target = companyMap.get(key); target.hotspots++; target.dates.add(item.date); if (item.village) target.villages.add(item.village);
  }
}
const daily = [];
for (let cursor = new Date(start); cursor <= end; cursor = new Date(cursor.getTime() + 86400000)) daily.push({ date: iso(cursor), hotspots: dailyMap.get(iso(cursor)) || 0 });
const villageRows = [...villageMap.values()].map((x) => ({ ...x, detectionDays: x.dates.size, dates: undefined })).sort((a, b) => b.hotspots - a.hotspots || a.village.localeCompare(b.village));
const companyRows = [...companyMap.values()].map((x) => ({ ...x, detectionDays: x.dates.size, villages: [...x.villages].sort(), dates: undefined })).sort((a, b) => b.hotspots - a.hotspots || a.name.localeCompare(b.name));
const report = {
  schemaVersion: 1, month: MONTH, period: { start: iso(start), end: iso(end) }, province: "Riau",
  status: "final",
  generatedAt: new Date().toISOString(), source: "NASA FIRMS",
  sources: sourcesUsed,
  methodology: "Deteksi kategori high confidence di dalam polygon Provinsi Riau; pencocokan desa dan PBPH Riau pembaruan Mei 2026 dilakukan secara spasial.",
  disclaimer: "PBPH Mei 2026 adalah referensi areal kerja terkini pada sumber. Irisan hotspot bukan bukti penyebab atau tanggung jawab pemegang PBPH.",
  summary: { hotspots: detections.length, villages: villageRows.length, regencies: regencies.size, companies: companyRows.length, companyHotspots: detections.filter((x) => x.permits.length).length },
  daily, villages: villageRows, companies: companyRows, hotspots: detections
};
await mkdir(outputDir, { recursive: true });
await writeFile(path.join(outputDir, `${MONTH}.json`), `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(`Generated ${MONTH}: ${detections.length} hotspots, ${villageRows.length} villages, ${companyRows.length} company references.`);
