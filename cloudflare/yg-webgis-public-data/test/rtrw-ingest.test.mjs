import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { prepareRtrwRiau } from "../scripts/prepare-rtrw-riau.mjs";

function fixtureCollection() {
  return {
    type: "FeatureCollection",
    features: Array.from({ length: 33 }, (_, index) => {
      const x = 100 + (index % 6) * 0.05;
      const y = 0.2 + Math.floor(index / 6) * 0.05;
      return {
        type: "Feature",
        properties: {
          objectid: 210 + index,
          wadmpr: "RIAU",
          nothpd: "Perda No.10 Tahun 2018",
          rtrsys: `Kelas ${index % 23}`,
          rtrppr: `Pola ${index % 23}`,
          metadata: "RTRWP.xls"
        },
        geometry: {
          type: "Polygon",
          coordinates: [[
            [x, y], [x + 0.01, y], [x + 0.01, y + 0.01],
            [x, y + 0.01], [x, y]
          ]]
        }
      };
    })
  };
}

test("prepares a fail-closed internal RTRW display layer", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "rtrw-riau-test-"));
  const rawPath = path.join(directory, "raw.geojson");
  const simplifiedPath = path.join(directory, "simplified.geojson");
  const outputPath = path.join(directory, "display.geojson");
  const manifestPath = path.join(directory, "manifest.json");
  const fixture = fixtureCollection();
  fs.writeFileSync(rawPath, JSON.stringify(fixture));
  fs.writeFileSync(simplifiedPath, JSON.stringify(fixture));

  const manifest = prepareRtrwRiau(
    rawPath,
    simplifiedPath,
    outputPath,
    manifestPath
  );
  const output = JSON.parse(fs.readFileSync(outputPath, "utf8"));

  assert.equal(manifest.sourceFeatureCount, 33);
  assert.equal(manifest.classCount, 23);
  assert.equal(output.metadata.crs, "EPSG:4326");
  assert.match(output.metadata.sourceUrl, /^https:\/\/kspservices\.big\.go\.id\//);
  assert.equal(output.features[0].properties.Layer_ID, "rtrw_riau_2018_2038");
  assert.equal(output.features[0].properties.RENCANA, "Kelas 0");
  assert.equal(output.features[0].properties.DASAR_HUKUM, "Perda No.10 Tahun 2018");

  const validation = execFileSync(
    process.execPath,
    ["scripts/validate-rtrw.mjs", outputPath],
    { cwd: path.resolve(import.meta.dirname, ".."), encoding: "utf8" }
  );
  assert.match(validation, /"ok": true/);
});
