import fs from "node:fs/promises";

const path = process.argv[2] || "data/surface-observations.json";
const cache = JSON.parse(await fs.readFile(path, "utf8"));
if (cache.schemaVersion !== 1) throw new Error("Unsupported surface-observation cache schema.");
for (const field of ["generatedAt", "newestObservationAt", "validUntil", "source", "sourceUrl", "termsUrl", "attribution", "claimBoundary"]) {
  if (!cache[field]) throw new Error(`Surface-observation cache missing ${field}.`);
}
if (!Array.isArray(cache.observations) || !cache.observations.length || cache.stationCount !== cache.observations.length) {
  throw new Error("Surface-observation cache is empty or inconsistent.");
}
if (!(Date.parse(cache.validUntil) > Date.parse(cache.newestObservationAt))) throw new Error("Surface-observation validity window is invalid.");
const validityHours = (Date.parse(cache.validUntil) - Date.parse(cache.newestObservationAt)) / 3600000;
if (validityHours < 8 || validityHours > 12) throw new Error("Surface-observation validity window must cover the six-hour refresh cadence.");
for (const row of cache.observations) {
  if (!row.stationId || !Number.isFinite(Date.parse(row.observedAt)) || !Number.isFinite(row.latitude) || !Number.isFinite(row.longitude)) {
    throw new Error("Surface-observation cache contains an invalid station record.");
  }
  if (row.latitude < -11.5 || row.latitude > 6.5 || row.longitude < 94 || row.longitude > 142) throw new Error("Station lies outside Indonesia bounds.");
}
console.log(`Validated ${cache.observations.length} surface observations through ${cache.validUntil}.`);
