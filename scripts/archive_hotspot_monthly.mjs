import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = path.join(ROOT, process.env.HOTSPOT_POINTS_FILE || "data/hotspot-high-confidence.geojson");
const provincePath = path.join(ROOT, "data/batas_provinsi_riau_dissolve.geojson");
const archiveDir = path.join(ROOT, "data/fire-archive");
const finalReportDir = path.join(ROOT, "data/fire-monthly");

function pointInRing(point, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if (((yi > point[1]) !== (yj > point[1])) && point[0] < (xj - xi) * (point[1] - yi) / ((yj - yi) || Number.EPSILON) + xi) inside = !inside;
  }
  return inside;
}

function pointInGeometry(point, geometry) {
  const polygons = geometry?.type === "Polygon" ? [geometry.coordinates] : geometry?.type === "MultiPolygon" ? geometry.coordinates : [];
  return polygons.some((polygon) => polygon[0] && pointInRing(point, polygon[0]) && !polygon.slice(1).some((hole) => pointInRing(point, hole)));
}

function featureKey(feature) {
  const p = feature.properties || {}, c = feature.geometry?.coordinates || [];
  return [p.acq_date || "", String(p.acq_time || "").padStart(4, "0"), Number(c[0]).toFixed(5), Number(c[1]).toFixed(5), p.satellite || ""].join("|");
}

const [snapshot, province] = await Promise.all([
  readFile(sourcePath, "utf8").then(JSON.parse),
  readFile(provincePath, "utf8").then(JSON.parse)
]);
const provinceGeometry = province.features?.[0]?.geometry;
const grouped = new Map();
for (const feature of snapshot.features || []) {
  const date = String(feature.properties?.acq_date || "");
  const point = feature.geometry?.type === "Point" ? feature.geometry.coordinates : null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !point || !pointInGeometry(point, provinceGeometry)) continue;
  const month = date.slice(0, 7);
  if (!grouped.has(month)) grouped.set(month, []);
  grouped.get(month).push(feature);
}

await mkdir(archiveDir, { recursive: true });
for (const [month, incoming] of grouped) {
  const outputPath = path.join(archiveDir, `${month}.geojson`);
  let existing = { type: "FeatureCollection", features: [] };
  try { existing = JSON.parse(await readFile(outputPath, "utf8")); } catch (error) { if (error.code !== "ENOENT") throw error; }
  const merged = new Map((existing.features || []).map((feature) => [featureKey(feature), feature]));
  incoming.forEach((feature) => merged.set(featureKey(feature), feature));
  const features = [...merged.values()].sort((a, b) => featureKey(a).localeCompare(featureKey(b)));
  await writeFile(outputPath, `${JSON.stringify({
    type: "FeatureCollection",
    month,
    province: "Riau",
    updatedAt: new Date().toISOString(),
    source: "NASA FIRMS daily high-confidence snapshot archive",
    featureCount: features.length,
    features
  }, null, 2)}\n`, "utf8");
  console.log(`[ARCHIVE] ${month}: ${existing.features?.length || 0} + ${incoming.length} => ${features.length}`);
}

/*
 * A finalized report is permanent evidence and may contain a backfilled
 * detection that has already fallen outside the rolling 30-day NRT window.
 * Merge those points back into the matching R2 archive so a later scheduled
 * refresh cannot silently remove them (for example, 1 August 2026).
 */
let finalReportFiles = [];
try {
  finalReportFiles = (await readdir(finalReportDir))
    .filter((name) => /^\d{4}-\d{2}\.json$/.test(name));
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}

for (const file of finalReportFiles) {
  const report = JSON.parse(await readFile(path.join(finalReportDir, file), "utf8"));
  if (report.status !== "final" || !/^\d{4}-\d{2}$/.test(report.month || "")) continue;

  const incoming = (report.hotspots || []).map((hotspot) => ({
    type: "Feature",
    geometry: {
      type: "Point",
      coordinates: [Number(hotspot.longitude), Number(hotspot.latitude)]
    },
    properties: {
      acq_date: hotspot.date,
      acq_time: hotspot.time,
      satellite: hotspot.satellite,
      confidence: hotspot.confidence,
      brightness: hotspot.brightness,
      frp: hotspot.frp,
      village: hotspot.village,
      district: hotspot.district,
      regency: hotspot.regency,
      source: hotspot.satellite || "NASA FIRMS finalized monthly report"
    }
  })).filter((feature) => (
    Number.isFinite(feature.geometry.coordinates[0]) &&
    Number.isFinite(feature.geometry.coordinates[1]) &&
    /^\d{4}-\d{2}-\d{2}$/.test(feature.properties.acq_date || "")
  ));

  const outputPath = path.join(archiveDir, `${report.month}.geojson`);
  let existing = { type: "FeatureCollection", features: [] };
  try { existing = JSON.parse(await readFile(outputPath, "utf8")); } catch (error) { if (error.code !== "ENOENT") throw error; }
  const merged = new Map((existing.features || []).map((feature) => [featureKey(feature), feature]));
  incoming.forEach((feature) => merged.set(featureKey(feature), feature));
  const features = [...merged.values()].sort((a, b) => featureKey(a).localeCompare(featureKey(b)));
  await writeFile(outputPath, `${JSON.stringify({
    type: "FeatureCollection",
    month: report.month,
    province: "Riau",
    updatedAt: new Date().toISOString(),
    source: "NASA FIRMS daily high-confidence snapshot archive",
    featureCount: features.length,
    features
  }, null, 2)}\n`, "utf8");
  console.log(`[ARCHIVE FINAL] ${report.month}: ${existing.features?.length || 0} + ${incoming.length} => ${features.length}`);
}
