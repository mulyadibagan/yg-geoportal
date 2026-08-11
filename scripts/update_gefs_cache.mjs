import fs from "node:fs/promises";

const output = process.env.GEFS_OUTPUT || "data/gefs-925hpa.json";
const grid = [];
for (let lat = -10; lat <= 5; lat += 3) {
  for (let lon = 96; lon <= 140; lon += 4) grid.push([lat, lon]);
}

const latitudes = grid.map((point) => point[0]).join(",");
const longitudes = grid.map((point) => point[1]).join(",");
const params = new URLSearchParams({
  latitude: latitudes,
  longitude: longitudes,
  hourly: "wind_speed_925hPa,wind_direction_925hPa",
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
if (!rows.length || !rows.every((row) => row.hourly?.time?.length)) {
  throw new Error("GEFS response is incomplete; existing cache was preserved.");
}

await fs.writeFile(output, `${JSON.stringify({
  generatedAt: new Date().toISOString(),
  source: "Open-Meteo GEFS ensemble API",
  level: "925 hPa",
  gridCount: grid.length,
  data: rows
})}\n`);
console.log(`Wrote ${rows.length} GEFS grid locations to ${output}`);
