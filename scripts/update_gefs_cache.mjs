import fs from "node:fs/promises";

const output = process.env.GEFS_OUTPUT || "data/gefs-multilevel.json";
const grid = [];
for (let lat = -10; lat <= 5; lat += 3) {
  for (let lon = 96; lon <= 140; lon += 4) grid.push([lat, lon]);
}

const latitudes = grid.map((point) => point[0]).join(",");
const longitudes = grid.map((point) => point[1]).join(",");
const params = new URLSearchParams({
  latitude: latitudes,
  longitude: longitudes,
  hourly: "wind_speed_925hPa,wind_direction_925hPa,wind_speed_850hPa,wind_direction_850hPa,wind_speed_700hPa,wind_direction_700hPa",
  models: "gfs_seamless",
  forecast_days: "1",
  timezone: "Asia/Jakarta"
});
const url = `https://ensemble-api.open-meteo.com/v1/ensemble?${params}`;

async function request(attempt = 0) {
  const response = await fetch(url, { headers: { "user-agent": "YG-GeoPortal-GEFS-Cache/1.0" } });
  if (response.ok) return response.json();
  if ((response.status === 429 || response.status >= 500) && attempt < 4) {
    const retryAfter = Number(response.headers.get("retry-after")) || Math.pow(2, attempt) * 15;
    await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
    return request(attempt + 1);
  }
  throw new Error(`GEFS request failed: HTTP ${response.status}`);
}

const data = await request();
const rows = Array.isArray(data) ? data : [data];
if (rows.length !== grid.length || !rows.every((row) => row.hourly?.time?.length)) {
  throw new Error("GEFS response is incomplete; existing cache was preserved.");
}

const memberCounts = rows.map((row) => Object.keys(row.hourly).filter((key) => /^wind_speed_925hPa(_member\d+)?$/.test(key)).length);
const memberCount = Math.min(...memberCounts);
const toTimestamp = (value) => new Date(`${value}+07:00`).getTime();
const validFromMs = Math.max(...rows.map((row) => toTimestamp(row.hourly.time[0])));
const validUntilMs = Math.min(...rows.map((row) => toTimestamp(row.hourly.time.at(-1))));
if (memberCount < 2 || !Number.isFinite(validFromMs) || !Number.isFinite(validUntilMs) || validUntilMs <= validFromMs) {
  throw new Error("GEFS response has invalid member or time coverage; existing cache was preserved.");
}

await fs.writeFile(output, `${JSON.stringify({
  schemaVersion: 2,
  generatedAt: new Date().toISOString(),
  validFrom: new Date(validFromMs).toISOString(),
  validUntil: new Date(validUntilMs).toISOString(),
  source: "Open-Meteo GEFS ensemble API",
  underlyingModel: "NOAA/NCEP GEFS via Open-Meteo gfs_seamless",
  attribution: "Open-Meteo; NOAA/NCEP GEFS",
  termsUrl: "https://open-meteo.com/en/pricing",
  levels: [925, 850, 700],
  gridCount: grid.length,
  memberCount,
  grid: { latitudeStart: -10, latitudeEnd: 5, latitudeStep: 3, longitudeStart: 96, longitudeEnd: 140, longitudeStep: 4 },
  data: rows
})}\n`);
console.log(`Wrote ${rows.length} GEFS grid locations and ${memberCount} members to ${output}`);
