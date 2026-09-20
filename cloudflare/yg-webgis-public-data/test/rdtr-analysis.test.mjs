import assert from "node:assert/strict";
import test from "node:test";
import { featureCollection, polygon } from "@turf/turf";
import { buildAnalysis } from "../scripts/build-rdtr-bagansiapiapi-analysis.mjs";

const names = [
  "Kelurahan Bagan Barat", "Kelurahan Bagan Hulu", "Kelurahan Bagan Kota",
  "Kelurahan Bagan Punak", "Kelurahan Bagan Timur", "Bagan Jawa",
  "Bagan Jawa Pesisir", "Bagan Punak Meranti", "Bagan Punak Pesisir",
  "Labuhan Tangga Besar", "Labuhan Tangga Hilir"
];

function square(x, properties) {
  return polygon([[[x, 2], [x + 0.01, 2], [x + 0.01, 2.01], [x, 2.01], [x, 2]]], properties);
}

test("builds an internal baseline for exactly the 11 invited planning-area villages", () => {
  const administration = featureCollection(names.map((name, index) => square(100 + index * 0.01, {
    WADMKK: "Rokan Hilir", WADMKC: "Bangko", WADMKD: name
  })));
  const mask = polygon([[[99.9, 1.9], [100.2, 1.9], [100.2, 2.2], [99.9, 2.2], [99.9, 1.9]]]);
  const result = buildAnalysis({
    administration,
    rtrw: featureCollection([{ ...mask, properties: { RENCANA: "Kawasan Permukiman", DASAR_HUKUM: "Perda No.10 Tahun 2018" } }]),
    peat: featureCollection([{ ...mask, properties: { KELAS_GBT: "100-<200 cm", KETEBALAN: "Sedang" } }]),
    forest: featureCollection([{ ...mask, properties: { fungsi: "HP" } }]),
    mangrove: { villages: [{ village: "Bagan Jawa Pesisir", status: "analysed", currentMangroveHa: 10, indicativeMangroveLossHa: 30 }] }
  });
  assert.equal(result.metadata.access, "staff_only");
  assert.equal(result.metadata.officialDraftGeometryStatus, "not_received");
  assert.equal(result.summary.villageCount, 11);
  assert.equal(result.villages.length, 11);
  assert.ok(result.summary.peatAreaHa > 0);
  assert.ok(result.summary.forestAreaHa > 0);
  assert.equal(result.summary.mangroveAnalysedVillageCount, 1);
  assert.ok(result.consultationQuestions.length >= 6);
  assert.equal(result.regulatoryAssessments.length, 10);
  assert.ok(result.regulationRegister.length >= 18);
  assert.equal(result.decisionClasses.length, 4);
  assert.ok(result.villages.every(row => row.regulatoryAssessments.length >= 4));
  assert.ok(result.regulatoryAssessments.some(row => row.theme === "Perlindungan ekosistem gambut" && row.decision === "hold"));
  assert.ok(result.regulationRegister.some(row => row.code.includes("11/2021") && row.code.includes("6/2026")));
});
