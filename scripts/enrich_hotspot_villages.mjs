import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const boundaryPath = path.join(ROOT, process.env.HOTSPOT_VILLAGE_BOUNDARY || "data/batas_administrasi_desa_riau.geojson");
const hotspotPath = path.join(ROOT, process.env.HOTSPOT_POINTS_FILE || "data/hotspot-high-confidence.geojson");

function ringContains(point, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
    if ((yi > point[1]) !== (yj > point[1]) && point[0] < (xj - xi) * (point[1] - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function polygonContains(point, polygon) {
  if (!polygon.length || !ringContains(point, polygon[0])) return false;
  return !polygon.slice(1).some((hole) => ringContains(point, hole));
}

function geometryContains(point, geometry) {
  if (!geometry) return false;
  if (geometry.type === "Polygon") return polygonContains(point, geometry.coordinates);
  if (geometry.type === "MultiPolygon") return geometry.coordinates.some((polygon) => polygonContains(point, polygon));
  return false;
}

function boundsOf(geometry) {
  const bounds = [Infinity, Infinity, -Infinity, -Infinity];
  (function visit(value) {
    if (typeof value[0] === "number") {
      bounds[0] = Math.min(bounds[0], value[0]); bounds[1] = Math.min(bounds[1], value[1]);
      bounds[2] = Math.max(bounds[2], value[0]); bounds[3] = Math.max(bounds[3], value[1]);
    } else value.forEach(visit);
  })(geometry.coordinates);
  return bounds;
}

const [boundary, hotspots] = await Promise.all([
  readFile(boundaryPath, "utf8").then(JSON.parse),
  readFile(hotspotPath, "utf8").then(JSON.parse)
]);
const villages = (boundary.features || []).map((feature) => ({
  feature,
  bounds: boundsOf(feature.geometry),
  village: feature.properties?.WADMKD || feature.properties?.NAMOBJ || "",
  district: feature.properties?.WADMKC || "",
  regency: feature.properties?.WADMKK || ""
}));
let identified = 0;
for (const feature of hotspots.features || []) {
  const point = feature.geometry?.type === "Point" ? feature.geometry.coordinates : null;
  if (!point) continue;
  const match = villages.find((item) => point[0] >= item.bounds[0] && point[0] <= item.bounds[2] && point[1] >= item.bounds[1] && point[1] <= item.bounds[3] && geometryContains(point, item.feature.geometry));
  feature.properties ||= {};
  if (match) {
    feature.properties.village = match.village;
    feature.properties.district = match.district;
    feature.properties.regency = match.regency;
    identified++;
  } else {
    delete feature.properties.village;
    delete feature.properties.district;
    delete feature.properties.regency;
  }
}
await writeFile(hotspotPath, JSON.stringify(hotspots, null, 2) + "\n");
console.log(`Identified ${identified} of ${(hotspots.features || []).length} hotspots in Riau villages.`);
