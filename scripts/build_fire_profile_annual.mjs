import { readFile, writeFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPORT_DIR = path.join(ROOT, "data", "fire-monthly");
const EARLIEST_MONTH = "2026-07";
const PS_FILES = [
  "PERHUTANAN_SOSIAL_RIAU.geojson",
  "social-forestry-pkk-samj.geojson",
  "social-forestry-kud-agro-lestari.geojson",
  "social-forestry-derived-2025.geojson",
  "social-forestry-official-2026.geojson"
];
const VILLAGE_FILES = ["batas_administrasi_desa_riau.geojson", "desa_intervensi.geojson"];

function analysisKey(value) {
  return typeof value === "number" && Number.isInteger(value) ? value.toFixed(1) : String(value ?? "").trim().toLowerCase();
}
function featureKey(feature) {
  const p = feature?.properties || {};
  return analysisKey(p.PROFILE_KEY || p.OBJECTID || p.ID || p.NO_IUPHKM || p.SK || [p.NAMA_HKM, p.NAMA_DESA, p.NAMA_KAB].filter(Boolean).join("|"));
}
function permitKey(feature) {
  const p = feature?.properties || {};
  return analysisKey(p.PROFILE_KEY || p.NO_IUPHKM || p.SK || p.OBJECTID || p.ID || [p.NAMA_HKM, p.NAMA_DESA, p.NAMA_KAB].filter(Boolean).join("|"));
}
function pointInRing(point, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if (((a[1] > point[1]) !== (b[1] > point[1])) && point[0] < (b[0] - a[0]) * (point[1] - a[1]) / ((b[1] - a[1]) || Number.EPSILON) + a[0]) inside = !inside;
  }
  return inside;
}
function pointInGeometry(point, geometry) {
  const polygons = geometry?.type === "Polygon" ? [geometry.coordinates] : geometry?.type === "MultiPolygon" ? geometry.coordinates : [];
  return polygons.some((polygon) => polygon[0] && pointInRing(point, polygon[0]) && !polygon.slice(1).some((hole) => pointInRing(point, hole)));
}
function villageFeatureKey(feature) {
  const p = feature?.properties || {};
  return [p.WADMKD || p.Desa || p.NAMOBJ || p.Nama_Desa, p.WADMKC || p.Kecamatan, p.WADMKK || p.Kabupaten].filter(Boolean).join("|").trim().toLowerCase();
}
function add(target, year, count, dates) {
  if (!target[year]) target[year] = { hotspots: 0, dates: new Set() };
  target[year].hotspots += count;
  dates.forEach((date) => target[year].dates.add(date));
}
function finalize(yearly) {
  return Object.fromEntries(Object.entries(yearly).map(([year, value]) => [year, { hotspots: value.hotspots, detectionDays: value.dates.size }]));
}

const reportNames = (await readdir(REPORT_DIR)).filter((name) => /^\d{4}-\d{2}\.json$/.test(name)).sort();
const reports = [];
for (const name of reportNames) {
  const report = JSON.parse(await readFile(path.join(REPORT_DIR, name), "utf8"));
  if (report.status === "final" && report.month >= EARLIEST_MONTH) reports.push(report);
}

const years = new Map();
for (const report of reports) {
  const year = report.month.slice(0, 4);
  if (!years.has(year)) years.set(year, []);
  years.get(year).push(report.month);
}

const villageGroups = new Map();
for (const name of VILLAGE_FILES) {
  const geojson = JSON.parse(await readFile(path.join(ROOT, "data", name), "utf8"));
  for (const feature of geojson.features || []) {
    const key = villageFeatureKey(feature);
    if (!key || !feature.geometry) continue;
    if (!villageGroups.has(key)) villageGroups.set(key, []);
    villageGroups.get(key).push(feature.geometry);
  }
}
const villages = {};
for (const [key, geometries] of villageGroups) {
  const yearly = {};
  for (const report of reports) {
    const year = report.month.slice(0, 4), dates = new Set();
    let count = 0;
    for (const point of report.hotspots || []) {
      const coordinate = [Number(point.longitude), Number(point.latitude)];
      if (geometries.some((geometry) => pointInGeometry(coordinate, geometry))) { count++; dates.add(point.date); }
    }
    if (count) add(yearly, year, count, dates);
  }
  if (Object.keys(yearly).length) villages[key] = finalize(yearly);
}

const psFeatures = [];
for (const name of PS_FILES) {
  try {
    const geojson = JSON.parse(await readFile(path.join(ROOT, "data", name), "utf8"));
    psFeatures.push(...(geojson.features || []).filter((feature) => feature.geometry));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}
const psGroups = new Map();
for (const feature of psFeatures) {
  const canonical = permitKey(feature) || featureKey(feature);
  if (!canonical) continue;
  if (!psGroups.has(canonical)) psGroups.set(canonical, { keys: new Set(), name: feature.properties?.NAMA_HKM || "Perhutanan Sosial", geometries: [] });
  const group = psGroups.get(canonical);
  [canonical, permitKey(feature), featureKey(feature)].filter(Boolean).forEach((key) => group.keys.add(key));
  group.geometries.push(feature.geometry);
}

const socialForestry = [];
for (const group of psGroups.values()) {
  const yearly = {};
  for (const report of reports) {
    const year = report.month.slice(0, 4), dates = new Set();
    let count = 0;
    for (const point of report.hotspots || []) {
      const coordinate = [Number(point.longitude), Number(point.latitude)];
      if (group.geometries.some((geometry) => pointInGeometry(coordinate, geometry))) { count++; dates.add(point.date); }
    }
    if (count) add(yearly, year, count, dates);
  }
  if (Object.keys(yearly).length) socialForestry.push({ keys: [...group.keys], name: group.name, yearly: finalize(yearly) });
}

const output = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  earliestMonth: EARLIEST_MONTH,
  source: "NASA FIRMS monthly final reports",
  years: [...years.entries()].sort(([a], [b]) => b.localeCompare(a)).map(([year, months]) => ({ year, months, start: `${months[0]}-01`, end: reports.find((report) => report.month === months.at(-1))?.period?.end || "" })),
  villages,
  socialForestry
};
await writeFile(path.join(REPORT_DIR, "profile-annual.json"), `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(`Built annual profile hotspot summary from ${reports.length} final report(s), starting ${EARLIEST_MONTH}.`);
