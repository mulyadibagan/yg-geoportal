import fs from "node:fs/promises";

const output = process.env.WEATHER_OUTPUT || "data/weather-riau.json";
const latitude = 1.45;
const longitude = 102.1;
const url = `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${latitude}&lon=${longitude}`;
const existing = await fs.readFile(output, "utf8").then(JSON.parse).catch(() => null);
const headers = { "user-agent": "YG-GeoPortal/1.0 https://webgisyg.id/" };
if (existing?.sourceLastModified) headers["if-modified-since"] = existing.sourceLastModified;

const response = await fetch(url, { headers });
if (response.status === 304) {
  console.log("MET Norway weather cache is unchanged.");
  process.exit(0);
}
if (!response.ok) throw new Error(`MET Norway request failed: HTTP ${response.status}`);

const payload = await response.json();
const series = payload?.properties?.timeseries || [];
const now = Date.now();
const row = series.reduce((best, candidate) => {
  const time = Date.parse(candidate.time);
  if (!Number.isFinite(time)) return best;
  if (!best) return candidate;
  return Math.abs(time - now) < Math.abs(Date.parse(best.time) - now) ? candidate : best;
}, null);
const details = row?.data?.instant?.details;
if (!row || !details || !Number.isFinite(Number(details.air_temperature)) || !Number.isFinite(Number(details.wind_speed))) {
  throw new Error("MET Norway response has no usable current forecast; existing cache was preserved.");
}
const precipitation = row.data?.next_1_hours?.details?.precipitation_amount;

await fs.writeFile(output, `${JSON.stringify({
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  validTime: row.time,
  location: { name: "Riau pesisir", latitude, longitude },
  temperatureC: Number(details.air_temperature),
  windSpeedKmh: Math.round(Number(details.wind_speed) * 36) / 10,
  windFromDegrees: Number(details.wind_from_direction),
  precipitationMmNextHour: Number.isFinite(Number(precipitation)) ? Number(precipitation) : null,
  relativeHumidityPercent: Number.isFinite(Number(details.relative_humidity)) ? Number(details.relative_humidity) : null,
  source: "MET Norway Locationforecast 2.0",
  attribution: "Weather forecast from MET Norway",
  licence: "CC BY 4.0",
  termsUrl: "https://docs.api.met.no/doc/TermsOfService.html",
  sourceUpdatedAt: payload.properties?.meta?.updated_at || null,
  sourceLastModified: response.headers.get("last-modified") || null
})}\n`);
console.log(`Wrote Riau weather cache for ${row.time} to ${output}`);
