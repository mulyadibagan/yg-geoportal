import fs from "node:fs/promises";

const output = process.env.CAMS_OUTPUT || "data/cams-air-quality.json";
const grid = [];
for (let lat = -10; lat <= 5; lat += 3) {
  for (let lon = 96; lon <= 140; lon += 4) grid.push([lat, lon]);
}
const params = new URLSearchParams({
  latitude: grid.map((point) => point[0]).join(","),
  longitude: grid.map((point) => point[1]).join(","),
  current: "aerosol_optical_depth,pm2_5,dust,carbon_monoxide",
  domains: "cams_global",
  timezone: "Asia/Jakarta"
});

async function request(attempt = 0) {
  const response = await fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?${params}`, {
    headers: { "user-agent": "YG-GeoPortal-CAMS-Cache/1.0" }
  });
  if (response.ok) return response.json();
  if ((response.status === 429 || response.status >= 500) && attempt < 4) {
    await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 10000));
    return request(attempt + 1);
  }
  throw new Error(`CAMS request failed: HTTP ${response.status}`);
}

const data = await request();
const rows = Array.isArray(data) ? data : [data];
if (rows.length !== grid.length || !rows.every((row) => row.current?.time)) {
  throw new Error("CAMS response is incomplete; existing cache was preserved.");
}
const times = rows.map((row) => new Date(`${row.current.time}+07:00`).getTime());
const validTimeMs = Math.min(...times);
if (!Number.isFinite(validTimeMs)) throw new Error("CAMS response has invalid timestamps.");

await fs.writeFile(output, `${JSON.stringify({
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  validTime: new Date(validTimeMs).toISOString(),
  validUntil: new Date(validTimeMs + 6 * 3600000).toISOString(),
  source: "Open-Meteo Air Quality API",
  underlyingModel: "Copernicus Atmosphere Monitoring Service global forecast",
  attribution: "Open-Meteo; CAMS ENSEMBLE",
  termsUrl: "https://open-meteo.com/en/pricing",
  variables: ["aerosol_optical_depth", "pm2_5", "dust", "carbon_monoxide"],
  gridCount: grid.length,
  data: rows
})}\n`);
console.log(`Wrote ${rows.length} CAMS grid locations to ${output}`);
