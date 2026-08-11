import fs from "node:fs/promises";

const input = process.argv[2] || "data/smoke-dispersion.geojson";
const statusOutput = process.argv[3] || "data/smoke-dispersion-status.json";
const raw = JSON.parse(await fs.readFile(input, "utf8"));
const required = ["generatedAt", "validUntil", "sourceObservationStart", "sourceObservationEnd", "meteorology", "emissions", "modelVersion"];

if (raw.type !== "FeatureCollection" || !Array.isArray(raw.features)) {
  throw new Error("Dispersion output must be a GeoJSON FeatureCollection.");
}
for (const key of required) {
  if (raw[key] == null || raw[key] === "") throw new Error(`Missing required provenance field: ${key}`);
}
for (const key of ["generatedAt", "validUntil", "sourceObservationStart", "sourceObservationEnd"]) {
  if (!Number.isFinite(Date.parse(raw[key]))) throw new Error(`Invalid ISO timestamp: ${key}`);
}
if (Date.parse(raw.validUntil) <= Date.parse(raw.generatedAt)) {
  throw new Error("validUntil must be later than generatedAt.");
}
if (Date.parse(raw.validUntil) <= Date.now()) {
  throw new Error("Dispersion output is expired and must not be published.");
}

const allowedBands = new Set(["low", "moderate", "high", "very-high"]);
raw.features.forEach((feature, index) => {
  if (!feature?.geometry || !["Polygon", "MultiPolygon"].includes(feature.geometry.type)) {
    throw new Error(`Feature ${index} is not a Polygon or MultiPolygon.`);
  }
  if (!allowedBands.has(feature.properties?.band)) {
    throw new Error(`Feature ${index} has an unsupported band.`);
  }
  if (!Number.isFinite(Number(feature.properties?.value))) {
    throw new Error(`Feature ${index} has no numeric model value.`);
  }
});

const status = {
  schemaVersion: 1,
  status: "ready",
  model: "HYSPLIT",
  modelVersion: raw.modelVersion,
  product: "smoke-dispersion",
  generatedAt: raw.generatedAt,
  validUntil: raw.validUntil,
  sourceObservationStart: raw.sourceObservationStart,
  sourceObservationEnd: raw.sourceObservationEnd,
  meteorology: raw.meteorology,
  emissions: raw.emissions,
  validation: Array.isArray(raw.validation) ? raw.validation : [],
  featureCount: raw.features.length,
  message: "Validated dispersion output is ready for publication."
};
await fs.writeFile(statusOutput, `${JSON.stringify(status, null, 2)}\n`);
console.log(`Validated ${raw.features.length} dispersion polygons from ${input}.`);
