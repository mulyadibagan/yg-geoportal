import fs from "node:fs/promises";

const path = process.argv[2] || "data/gfs-atmosphere.json";
const cache = JSON.parse(await fs.readFile(path, "utf8"));
const variables = [
  "wind_speed_925hPa", "wind_direction_925hPa",
  "wind_speed_850hPa", "wind_direction_850hPa",
  "wind_speed_700hPa", "wind_direction_700hPa",
  "vertical_velocity_925hPa", "boundary_layer_height", "precipitation"
];
for (const field of ["generatedAt", "validFrom", "validUntil", "source", "underlyingModel", "attribution", "termsUrl", "gridCount"]) {
  if (cache[field] === undefined || cache[field] === null || cache[field] === "") throw new Error(`GFS atmosphere cache missing ${field}.`);
}
if (cache.schemaVersion !== 1) throw new Error(`Unsupported GFS atmosphere schema ${cache.schemaVersion}.`);
if (!Array.isArray(cache.variables) || variables.some((key) => !cache.variables.includes(key))) throw new Error("GFS atmosphere variables are incomplete.");
if (!Array.isArray(cache.data) || cache.data.length !== cache.gridCount || cache.gridCount < 100) throw new Error("GFS atmosphere grid is incomplete.");
const validFrom = Date.parse(cache.validFrom), validUntil = Date.parse(cache.validUntil);
if (!Number.isFinite(validFrom) || !Number.isFinite(validUntil) || validUntil <= validFrom) throw new Error("GFS atmosphere coverage is invalid.");
for (const [index, row] of cache.data.entries()) {
  const hourly = row.hourly || {}, length = hourly.time?.length || 0;
  if (length < 2 || variables.some((key) => !Array.isArray(hourly[key]) || hourly[key].length !== length)) throw new Error(`GFS atmosphere row ${index} is incomplete.`);
}
console.log(`Validated GFS atmosphere cache: ${cache.gridCount} locations, ${cache.validFrom} to ${cache.validUntil}.`);
