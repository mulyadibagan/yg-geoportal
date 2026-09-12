import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import oilPalmReference from "../js/oil-palm-reference.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const reference = JSON.parse(await readFile(path.join(ROOT, "data/PERUSAHAAN_SAWIT_RIAU_REFERENSI.geojson"), "utf8"));
const months = process.argv.slice(2).length ? process.argv.slice(2) : ["2026-07", "2026-08"];

for (const month of months) {
  const target = path.join(ROOT, `data/fire-monthly/${month}.json`);
  const report = JSON.parse(await readFile(target, "utf8"));
  const points = { type: "FeatureCollection", features: (report.hotspots || []).map((hotspot) => ({
    type: "Feature",
    geometry: { type: "Point", coordinates: [hotspot.longitude, hotspot.latitude] },
    properties: {}
  })) };
  oilPalmReference.attach(points, reference);
  const areas = new Map();
  (report.hotspots || []).forEach((hotspot, index) => {
    hotspot.rspoAreas = points.features[index].properties.oilPalmCompanyRef || [];
    hotspot.rspoAreas.forEach((area) => {
      if (!areas.has(area.id)) areas.set(area.id, { id: area.id, name: area.name, group: area.group, supplyBase: area.supplyBase, regency: area.regency, hotspots: 0, dates: new Set(), villages: new Set() });
      const row = areas.get(area.id); row.hotspots++; row.dates.add(hotspot.date); if (hotspot.village) row.villages.add(hotspot.village);
    });
  });
  report.rspoAreas = [...areas.values()].map((area) => ({ ...area, detectionDays: area.dates.size, villages: [...area.villages].sort(), dates: undefined })).sort((a, b) => b.hotspots - a.hotspots || a.name.localeCompare(b.name));
  report.summary.rspoAreas = report.rspoAreas.length;
  report.summary.rspoHotspots = report.hotspots.filter((hotspot) => hotspot.rspoAreas.length).length;
  report.sources = [...new Set([...(report.sources || []), "GeoRSPO / RSPO"] )];
  report.schemaVersion = 2;
  await writeFile(target, JSON.stringify(report, null, 2) + "\n");
  console.log(`${month}: ${report.summary.rspoHotspots} hotspot pada ${report.summary.rspoAreas} area RSPO`);
}
