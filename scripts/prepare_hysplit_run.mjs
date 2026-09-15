import fs from "node:fs/promises";
import path from "node:path";

const hotspotFile = process.env.HOTSPOT_FILE || "data/hotspot-high-confidence.geojson";
const runRoot = process.env.HYSPLIT_RUN_DIR || "build/hysplit-run";
const executable = process.env.HYSPLIT_EXECUTABLE || "";
const meteorology = (process.env.HYSPLIT_MET_FILES || "").split(path.delimiter).filter(Boolean);
const emissions = process.env.GFAS_EMISSIONS_FILE || "";
const requiredFiles = [["registered HYSPLIT executable", executable], ["GFAS emissions/injection-height file", emissions], ...meteorology.map((file, i) => [`HYSPLIT meteorology file ${i + 1}`, file])];
const missing = [];
for (const [label, file] of requiredFiles) {
  if (!file) missing.push(`${label}: path is not configured`);
  else try { await fs.access(file); } catch { missing.push(`${label}: ${file} is not readable`); }
}
if (!meteorology.length) missing.push("HYSPLIT meteorology: no ARL-format files configured");

const hotspot = JSON.parse(await fs.readFile(hotspotFile, "utf8"));
const features = (hotspot.features || []).filter((feature) => feature.geometry?.type === "Point" && Number(feature.properties?.frp) > 0);
const times = features.map((feature) => { const p = feature.properties || {}; const hhmm = String(p.acq_time || "0000").padStart(4, "0"); return Date.parse(`${p.acq_date}T${hhmm.slice(0, 2)}:${hhmm.slice(2, 4)}:00Z`); }).filter(Number.isFinite);
const manifest = {
  schemaVersion: 1, status: missing.length ? "blocked" : "inputs-ready", product: "experimental-smoke-dispersion", preparedAt: new Date().toISOString(),
  source: { file: hotspotFile, featureCount: features.length, observationStart: times.length ? new Date(Math.min(...times)).toISOString() : null, observationEnd: times.length ? new Date(Math.max(...times)).toISOString() : null },
  runtime: { executable: executable || null, meteorology, emissions: emissions || null }, blockers: missing,
  safeguards: ["FIRMS FRP is not converted to particulate mass by this preparer.", "No concentration or smoke polygon is produced until GFAS source terms and HYSPLIT output pass validation.", "The NOAA READY web service is not automated or scraped."]
};
await fs.mkdir(runRoot, { recursive: true });
await fs.writeFile(path.join(runRoot, "run-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
if (missing.length) { console.error(`HYSPLIT run is blocked:\n- ${missing.join("\n- ")}`); process.exitCode = 2; }
else { await fs.writeFile(path.join(runRoot, "README.txt"), "Inputs passed preflight. Generate CONTROL, SETUP.CFG and EMITIMES from the approved GFAS processor before invoking HYSPLIT.\n"); console.log(`HYSPLIT input preflight passed for ${features.length} FIRMS observations.`); }
