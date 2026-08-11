import fs from "node:fs/promises";
import path from "node:path";

const catalogPath = process.argv[2] || "data/smoke-validation-catalog.json";
const outputDirectory = process.argv[3] || "data/historical-transport";
const catalog = JSON.parse(await fs.readFile(catalogPath, "utf8"));
const variables = [
  "wind_speed_925hPa", "wind_direction_925hPa",
  "wind_speed_850hPa", "wind_direction_850hPa",
  "wind_speed_700hPa", "wind_direction_700hPa",
  "vertical_velocity_925hPa", "boundary_layer_height", "precipitation"
];

function isoOffset(date, days) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
function gridFor([west, south, east, north]) {
  const points = [];
  for (let lat = south; lat <= north; lat += 2) for (let lon = west; lon <= east; lon += 2) points.push([lat, lon]);
  return points;
}
function validateRows(rows, expected) {
  if (rows.length !== expected) throw new Error(`Expected ${expected} grid rows, received ${rows.length}.`);
  for (const [index, row] of rows.entries()) {
    if (!row.hourly?.time?.length) throw new Error(`Grid row ${index} has no hourly timestamps.`);
    for (const variable of variables) {
      if (!Array.isArray(row.hourly[variable]) || row.hourly[variable].length !== row.hourly.time.length) {
        throw new Error(`Grid row ${index} has incomplete ${variable}.`);
      }
    }
  }
}

await fs.mkdir(outputDirectory, { recursive: true });
for (const validationCase of catalog.cases || []) {
  if (!Array.isArray(validationCase.bbox) || validationCase.bbox.length !== 4) throw new Error(`${validationCase.id}: bbox is required.`);
  const grid = gridFor(validationCase.bbox);
  const params = new URLSearchParams({
    latitude: grid.map((point) => point[0]).join(","),
    longitude: grid.map((point) => point[1]).join(","),
    start_date: isoOffset(validationCase.date, -1),
    end_date: isoOffset(validationCase.date, 1),
    hourly: variables.join(","),
    models: "gfs_seamless",
    timezone: "Asia/Jakarta"
  });
  const url = `https://historical-forecast-api.open-meteo.com/v1/forecast?${params}`;
  const response = await fetch(url, { headers: { "user-agent": "YG-GeoPortal-Historical-Validation/1.0" } });
  if (!response.ok) throw new Error(`${validationCase.id}: historical API returned HTTP ${response.status}.`);
  const payload = await response.json();
  const rows = Array.isArray(payload) ? payload : [payload];
  validateRows(rows, grid.length);
  const output = {
    schemaVersion: 1,
    caseId: validationCase.id,
    generatedAt: new Date().toISOString(),
    source: "Open-Meteo Historical Forecast API",
    underlyingModel: "NCEP GFS seamless historical forecast",
    productType: "deterministic historical meteorology",
    ensembleMembers: 0,
    limitation: "Suitable for validating deterministic trajectory direction and multi-level heuristics; not sufficient to validate GEFS ensemble-support contours.",
    termsUrl: "https://open-meteo.com/en/docs/historical-forecast-api",
    requestedVariables: variables,
    grid,
    data: rows
  };
  const outputPath = path.join(outputDirectory, `${validationCase.id}.json`);
  await fs.writeFile(outputPath, `${JSON.stringify(output)}\n`);
  console.log(`Wrote ${rows.length} historical GFS grid rows to ${outputPath}.`);
}
