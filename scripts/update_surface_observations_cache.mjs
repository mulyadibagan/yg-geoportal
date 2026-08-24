import fs from "node:fs/promises";
import { gunzipSync } from "node:zlib";

const output = process.env.SURFACE_OBSERVATIONS_OUTPUT || "data/surface-observations.json";
const sourceUrl = "https://aviationweather.gov/data/cache/metars.cache.csv.gz";
// The workflow runs every six hours. Keep observations available long enough
// to cover normal GitHub Actions scheduling delays without hiding all stations.
const validityHours = 9;

function parseCsv(text) {
  const rows = [];
  let row = [], value = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') { value += '"'; i++; }
      else quoted = !quoted;
    } else if (char === "," && !quoted) { row.push(value); value = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(value); value = "";
      if (row.some(Boolean)) rows.push(row);
      row = [];
    } else value += char;
  }
  if (value || row.length) { row.push(value); rows.push(row); }
  return rows;
}

function number(value) {
  const parsed = Number.parseFloat(String(value || "").replace("+", ""));
  return Number.isFinite(parsed) ? parsed : null;
}

const response = await fetch(sourceUrl, { headers: { "user-agent": "YG-GeoPortal-Surface-Verification/1.0" } });
if (!response.ok) throw new Error(`METAR cache request failed: HTTP ${response.status}`);
const rows = parseCsv(gunzipSync(Buffer.from(await response.arrayBuffer())).toString("utf8"));
const observations = rows.slice(1).filter((row) => {
  const lat = number(row[3]), lon = number(row[4]);
  const stationId = row[1] || "";
  return /^(WI|WA)/.test(stationId) && lat !== null && lon !== null && lat >= -11.5 && lat <= 6.5 && lon >= 94 && lon <= 142;
}).map((row) => ({
  stationId: row[1], observedAt: row[2], latitude: number(row[3]), longitude: number(row[4]),
  temperatureC: number(row[5]), dewpointC: number(row[6]), windDirectionDeg: number(row[7]),
  windSpeedKt: number(row[8]), visibilityStatuteMiles: number(row[10]), weather: row[21] || null,
  precipitationIn: number(row[36]), rawObservation: row[0]
})).filter((row) => row.stationId && Number.isFinite(Date.parse(row.observedAt)));

if (!observations.length) throw new Error("No current Indonesian METAR observations were returned; existing cache was preserved.");
const newest = Math.max(...observations.map((row) => Date.parse(row.observedAt)));
await fs.writeFile(output, `${JSON.stringify({
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  newestObservationAt: new Date(newest).toISOString(),
  validUntil: new Date(newest + validityHours * 3600000).toISOString(),
  source: "NOAA/NWS Aviation Weather Center METAR cache",
  sourceUrl,
  termsUrl: "https://www.weather.gov/disclaimer",
  attribution: "NOAA/NWS Aviation Weather Center; originating METAR station",
  claimBoundary: "Visibility and present-weather observations are supporting evidence only; reduced visibility does not by itself prove biomass-burning smoke.",
  stationCount: observations.length,
  observations
})}\n`);
console.log(`Wrote ${observations.length} current Indonesian surface observations to ${output}`);
