import fs from "node:fs/promises";

const output = process.env.GFS_ATMOSPHERE_OUTPUT || "data/gfs-atmosphere.json";
const grid = [];
for (let lat = -10; lat <= 6; lat += 2) {
  for (let lon = 96; lon <= 140; lon += 2) grid.push([lat, lon]);
}

const params = new URLSearchParams({
  latitude: grid.map((point) => point[0]).join(","),
  longitude: grid.map((point) => point[1]).join(","),
  hourly: [
    "wind_speed_925hPa", "wind_direction_925hPa",
    "wind_speed_850hPa", "wind_direction_850hPa",
    "wind_speed_700hPa", "wind_direction_700hPa",
    "vertical_velocity_925hPa", "boundary_layer_height", "precipitation"
  ].join(","),
  models: "gfs_seamless",
  past_days: "1",
  forecast_days: "1",
  timezone: "Asia/Jakarta"
});
const url = `https://api.open-meteo.com/v1/gfs?${params}`;

async function request(attempt = 0) {
  const response = await fetch(url, { headers: { "user-agent": "YG-GeoPortal-GFS-Atmosphere-Cache/1.0" } });
  if (response.ok) return response.json();
  if ((response.status === 429 || response.status >= 500) && attempt < 4) {
    const retryAfter = Number(response.headers.get("retry-after")) || Math.pow(2, attempt) * 15;
    await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
    return request(attempt + 1);
  }
  throw new Error(`GFS atmosphere request failed: HTTP ${response.status}`);
}

const payload = await request();
const rows = Array.isArray(payload) ? payload : [payload];
const required = [
  "wind_speed_925hPa", "wind_direction_925hPa",
  "wind_speed_850hPa", "wind_direction_850hPa",
  "wind_speed_700hPa", "wind_direction_700hPa",
  "vertical_velocity_925hPa", "boundary_layer_height", "precipitation"
];
if (rows.length !== grid.length || !rows.every((row) => {
  const hourly = row.hourly || {}, length = hourly.time?.length || 0;
  return length > 1 && required.every((key) => Array.isArray(hourly[key]) && hourly[key].length === length);
})) throw new Error("GFS atmosphere response is incomplete; existing cache was preserved.");

const toTimestamp = (value) => new Date(`${value}+07:00`).getTime();
const validFromMs = Math.max(...rows.map((row) => toTimestamp(row.hourly.time[0])));
const validUntilMs = Math.min(...rows.map((row) => toTimestamp(row.hourly.time.at(-1))));
if (!Number.isFinite(validFromMs) || !Number.isFinite(validUntilMs) || validUntilMs <= validFromMs) {
  throw new Error("GFS atmosphere response has invalid time coverage; existing cache was preserved.");
}

await fs.writeFile(output, `${JSON.stringify({
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  validFrom: new Date(validFromMs).toISOString(),
  validUntil: new Date(validUntilMs).toISOString(),
  source: "Open-Meteo GFS API",
  underlyingModel: "NOAA/NCEP GFS",
  productType: "deterministic atmospheric screening fields",
  attribution: "Open-Meteo; NOAA/NCEP GFS",
  termsUrl: "https://open-meteo.com/en/pricing",
  variables: required,
  gridCount: grid.length,
  grid: { latitudeStart: -10, latitudeEnd: 6, latitudeStep: 2, longitudeStart: 96, longitudeEnd: 140, longitudeStep: 2 },
  data: rows
})}\n`);
console.log(`Wrote ${rows.length} GFS atmosphere grid locations to ${output}`);
