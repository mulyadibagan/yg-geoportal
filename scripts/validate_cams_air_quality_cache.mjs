import fs from "node:fs/promises";

const path = process.argv[2] || "data/cams-air-quality.json";
const cache = JSON.parse(await fs.readFile(path, "utf8"));
if (cache.schemaVersion !== 1) throw new Error("Unsupported CAMS cache schema.");
for (const field of ["generatedAt", "validTime", "validUntil", "source", "underlyingModel", "attribution", "termsUrl"]) {
  if (!cache[field]) throw new Error(`CAMS cache missing ${field}.`);
}
if (!Array.isArray(cache.variables) || !["aerosol_optical_depth", "pm2_5", "dust", "carbon_monoxide"].every((v) => cache.variables.includes(v))) {
  throw new Error("CAMS cache variables are incomplete.");
}
if (!Array.isArray(cache.data) || cache.data.length !== 72 || cache.gridCount !== cache.data.length) throw new Error("CAMS grid is incomplete.");
if (!(Date.parse(cache.validUntil) > Date.parse(cache.validTime))) throw new Error("CAMS validity window is invalid.");
for (const row of cache.data) {
  const current = row.current || {};
  if (![row.latitude, row.longitude, current.aerosol_optical_depth, current.pm2_5, current.dust, current.carbon_monoxide].every(Number.isFinite)) {
    throw new Error("CAMS cache contains non-numeric evidence values.");
  }
}
console.log(`Validated ${cache.data.length} CAMS grid locations through ${cache.validUntil}.`);
