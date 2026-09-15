import fs from "node:fs/promises";

const catalogPath = process.argv[2] || "data/smoke-validation-catalog.json";
const observedPath = process.argv[3] || "data/smoke-validation-observed.geojson";
const catalog = JSON.parse(await fs.readFile(catalogPath, "utf8"));
const observed = JSON.parse(await fs.readFile(observedPath, "utf8"));
const allowedStatus = new Set(["pending", "draft", "reviewed", "excluded"]);
const allowedVisibility = new Set(["clear", "partial", "unobservable"]);
const allowedConfidence = new Set(["high", "medium", "low"]);
const catalogIds = new Set((catalog.cases || []).map(({ id }) => id));
const cases = observed.metadata?.cases;

if (observed.type !== "FeatureCollection" || !Array.isArray(observed.features)) throw new Error("Observed annotations must be a GeoJSON FeatureCollection.");
if (observed.metadata?.modelVisibleDuringAnnotation !== false) throw new Error("Annotations must be created blind to model output.");
if (!Array.isArray(cases)) throw new Error("Observed metadata.cases is required.");
if (cases.length !== catalogIds.size) throw new Error("Observed metadata must contain exactly one record for every catalog case.");

function checkRing(ring, label) {
  if (!Array.isArray(ring) || ring.length < 4) throw new Error(`${label}: polygon ring needs at least four positions.`);
  for (const point of ring) {
    if (!Array.isArray(point) || point.length < 2 || !point.slice(0, 2).every(Number.isFinite)) throw new Error(`${label}: invalid coordinate.`);
    if (point[0] < -180 || point[0] > 180 || point[1] < -90 || point[1] > 90) throw new Error(`${label}: coordinate outside EPSG:4326 bounds.`);
  }
  const first = ring[0], last = ring.at(-1);
  if (first[0] !== last[0] || first[1] !== last[1]) throw new Error(`${label}: polygon ring is not closed.`);
}
function checkGeometry(geometry, label) {
  if (geometry?.type === "Polygon") geometry.coordinates.forEach((ring) => checkRing(ring, label));
  else if (geometry?.type === "MultiPolygon") geometry.coordinates.flat().forEach((ring) => checkRing(ring, label));
  else throw new Error(`${label}: only Polygon and MultiPolygon are allowed.`);
}

const records = new Map();
for (const record of cases) {
  if (!catalogIds.has(record.caseId)) throw new Error(`Unknown caseId in metadata: ${record.caseId}`);
  if (records.has(record.caseId)) throw new Error(`Duplicate metadata caseId: ${record.caseId}`);
  if (!allowedStatus.has(record.annotationStatus)) throw new Error(`${record.caseId}: invalid annotationStatus.`);
  records.set(record.caseId, record);
}
for (const id of catalogIds) if (!records.has(id)) throw new Error(`Missing metadata for ${id}.`);

const featuresByCase = new Map();
for (const [index, feature] of observed.features.entries()) {
  const id = feature.properties?.caseId;
  if (!catalogIds.has(id)) throw new Error(`Feature ${index}: unknown or missing caseId.`);
  checkGeometry(feature.geometry, `${id} feature ${index}`);
  featuresByCase.set(id, [...(featuresByCase.get(id) || []), feature]);
}

let scoreable = 0;
for (const [id, record] of records) {
  const count = (featuresByCase.get(id) || []).length;
  if (record.annotationStatus === "reviewed") {
    for (const field of ["imageryDate", "worldviewUrl", "accessedAt", "annotator", "reviewer"]) if (!record[field]) throw new Error(`${id}: reviewed case missing ${field}.`);
    if (!Array.isArray(record.layers) || !record.layers.length) throw new Error(`${id}: reviewed case needs at least one named NASA layer.`);
    if (!allowedVisibility.has(record.visibility)) throw new Error(`${id}: reviewed case has invalid visibility.`);
    if (!allowedConfidence.has(record.confidence)) throw new Error(`${id}: reviewed case has invalid confidence.`);
    if (record.blindToModel !== true) throw new Error(`${id}: reviewed case was not blind to the model.`);
    if (!count) throw new Error(`${id}: reviewed case has no polygon.`);
    if (["clear", "partial"].includes(record.visibility) && ["high", "medium"].includes(record.confidence)) scoreable++;
  }
  if (record.annotationStatus === "excluded") {
    if (!record.exclusionReason) throw new Error(`${id}: excluded case needs an exclusionReason.`);
    if (count) throw new Error(`${id}: excluded case must not contain invented geometry.`);
  }
  if (record.annotationStatus === "pending" && count) throw new Error(`${id}: pending case cannot contain geometry.`);
}

console.log(`Validated ${records.size} annotation records and ${observed.features.length} polygons; ${scoreable} cases are eligible for primary scoring.`);
