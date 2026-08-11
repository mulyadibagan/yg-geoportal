import fs from "node:fs/promises";

const predictedPath = process.argv[2];
const observedPath = process.argv[3];
const outputPath = process.argv[4] || "data/smoke-validation-results.json";
if (!predictedPath || !observedPath) throw new Error("Usage: node scripts/score_smoke_validation.mjs predicted.geojson observed.geojson [output.json]");

const predicted = JSON.parse(await fs.readFile(predictedPath, "utf8"));
const observed = JSON.parse(await fs.readFile(observedPath, "utf8"));
const step = 0.05;
const observedCases = new Map((observed.metadata?.cases || []).map((record) => [record.caseId, record]));
const eligibleCaseIds = new Set([...observedCases].filter(([, record]) =>
  record.annotationStatus === "reviewed" &&
  ["clear", "partial"].includes(record.visibility) &&
  ["high", "medium"].includes(record.confidence) &&
  record.blindToModel === true
).map(([caseId]) => caseId));

if (!observed.metadata?.protocol) throw new Error("Observed file is missing its annotation protocol reference.");
if (!eligibleCaseIds.size) throw new Error("No independently reviewed, scoreable observed cases are available.");

function rings(geometry) {
  if (!geometry) return [];
  if (geometry.type === "Polygon") return [geometry.coordinates];
  if (geometry.type === "MultiPolygon") return geometry.coordinates;
  return [];
}
function inRing(point, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > point[1]) !== (yj > point[1]) && point[0] < ((xj - xi) * (point[1] - yi)) / ((yj - yi) || 1e-12) + xi) inside = !inside;
  }
  return inside;
}
function contains(geometry, point) {
  return rings(geometry).some((polygon) => polygon.length && inRing(point, polygon[0]) && !polygon.slice(1).some((hole) => inRing(point, hole)));
}
function bounds(features) {
  const points = features.flatMap((feature) => rings(feature.geometry).flatMap((polygon) => polygon.flat()));
  return [Math.min(...points.map((p) => p[0])), Math.min(...points.map((p) => p[1])), Math.max(...points.map((p) => p[0])), Math.max(...points.map((p) => p[1]))];
}
function bearing(source, target) {
  const toRad = (v) => (v * Math.PI) / 180;
  const y = Math.sin(toRad(target[0] - source[0])) * Math.cos(toRad(target[1]));
  const x = Math.cos(toRad(source[1])) * Math.sin(toRad(target[1])) - Math.sin(toRad(source[1])) * Math.cos(toRad(target[1])) * Math.cos(toRad(target[0] - source[0]));
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}
function angularError(a, b) { const d = Math.abs(a - b) % 360; return Math.min(d, 360 - d); }

const predictedByCase = Map.groupBy(predicted.features || [], (feature) => feature.properties?.caseId);
const observedByCase = Map.groupBy((observed.features || []).filter((feature) => eligibleCaseIds.has(feature.properties?.caseId)), (feature) => feature.properties?.caseId);
const results = [];
for (const [caseId, observedFeatures] of observedByCase) {
  const predictedFeatures = predictedByCase.get(caseId) || [];
  if (!caseId || !predictedFeatures.length) continue;
  const extent = bounds([...observedFeatures, ...predictedFeatures]);
  let intersection = 0, union = 0, predictedCount = 0, observedCount = 0, predictedLon = 0, predictedLat = 0, observedLon = 0, observedLat = 0;
  for (let lat = extent[1]; lat <= extent[3]; lat += step) for (let lon = extent[0]; lon <= extent[2]; lon += step) {
    const point = [lon, lat], p = predictedFeatures.some((feature) => contains(feature.geometry, point)), o = observedFeatures.some((feature) => contains(feature.geometry, point));
    if (p || o) union++;
    if (p && o) intersection++;
    if (p) { predictedCount++; predictedLon += lon; predictedLat += lat; }
    if (o) { observedCount++; observedLon += lon; observedLat += lat; }
  }
  const source = observedFeatures[0].properties?.sourceCoordinates;
  const predictedCentre = predictedCount ? [predictedLon / predictedCount, predictedLat / predictedCount] : null;
  const observedCentre = observedCount ? [observedLon / observedCount, observedLat / observedCount] : null;
  results.push({
    caseId,
    rasterStepDegrees: step,
    intersectionOverUnion: union ? intersection / union : null,
    falseAlarmRatio: predictedCount ? (predictedCount - intersection) / predictedCount : null,
    missRatio: observedCount ? (observedCount - intersection) / observedCount : null,
    plumeAxisAngularErrorDegrees: source && predictedCentre && observedCentre ? angularError(bearing(source, predictedCentre), bearing(source, observedCentre)) : null
  });
}

await fs.writeFile(outputPath, `${JSON.stringify({generatedAt:new Date().toISOString(),predictedPath,observedPath,annotationProtocol:observed.metadata.protocol,eligibilityRule:"reviewed + clear/partial + high/medium confidence + blind annotation",caseCount:results.length,results}, null, 2)}\n`);
console.log(`Scored ${results.length} validation cases.`);
