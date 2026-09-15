import fs from "node:fs/promises";

const path = process.argv[2] || "data/weather-riau.json";
const cache = JSON.parse(await fs.readFile(path, "utf8"));
for (const field of ["generatedAt", "validTime", "temperatureC", "windSpeedKmh", "source", "attribution", "licence", "termsUrl"]) {
  if (cache[field] === undefined || cache[field] === null || cache[field] === "") throw new Error(`Weather cache missing ${field}.`);
}
if (cache.schemaVersion !== 1) throw new Error(`Unsupported weather schema ${cache.schemaVersion}.`);
if (![Date.parse(cache.generatedAt), Date.parse(cache.validTime)].every(Number.isFinite)) throw new Error("Weather cache time metadata is invalid.");
if (![cache.temperatureC, cache.windSpeedKmh].every((value) => Number.isFinite(Number(value)))) throw new Error("Weather cache values are invalid.");
if (!/^https:\/\//.test(cache.termsUrl)) throw new Error("Weather terms URL must use HTTPS.");
console.log(`Validated Riau weather cache for ${cache.validTime}.`);
