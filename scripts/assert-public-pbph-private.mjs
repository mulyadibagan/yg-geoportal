import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] || "_site");
const forbiddenFiles = [
  "data/PBPH_RIAU_052026.geojson",
  "data/pbph-documents.json"
];

for (const relative of forbiddenFiles) {
  if (fs.existsSync(path.join(root, relative))) {
    throw new Error(`Data PBPH internal ikut masuk artefak publik: ${relative}`);
  }
}

if (fs.existsSync(path.join(root, "data", "phl-svlk-monthly"))) {
  throw new Error("Arsip PHL/SVLK internal ikut masuk artefak publik.");
}

const geometryWithheldFiles = [
  "data/PERUSAHAAN_SAWIT_RIAU_REFERENSI.geojson",
  "data/PERHUTANAN_SOSIAL_RIAU.geojson",
  "data/social-forestry-official-2026.geojson"
];

for (const relative of geometryWithheldFiles) {
  const file = path.join(root, relative);
  if (!fs.existsSync(file)) continue;
  const value = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!Array.isArray(value.features)) {
    throw new Error(`Placeholder geometri publik tidak valid: ${relative}`);
  }
  if (value.features.length) {
    throw new Error(`Geometri referensi internal ikut masuk artefak publik: ${relative}`);
  }
  if (value.visibility !== "internal") {
    throw new Error(`Status internal hilang dari placeholder publik: ${relative}`);
  }
}

const protectedKeys = new Set(["concession", "pbph052026", "permits"]);
function assertRedacted(value, file) {
  if (Array.isArray(value)) {
    value.forEach(child => assertRedacted(child, file));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (protectedKeys.has(key)) throw new Error(`Atribut ${key} masih ada pada ${file}`);
    assertRedacted(child, file);
  }
}

const candidates = [
  "data/administrative-village-analytics.json",
  "data/village-forest-analytics.json",
  "data/hotspot-high-confidence.geojson"
];
const shardDir = path.join(root, "data", "administrative-village-analytics");
if (fs.existsSync(shardDir)) {
  for (const name of fs.readdirSync(shardDir).filter(name => name.endsWith(".json"))) {
    candidates.push(path.join("data", "administrative-village-analytics", name));
  }
}

for (const relative of candidates) {
  const file = path.join(root, relative);
  if (!fs.existsSync(file)) continue;
  assertRedacted(JSON.parse(fs.readFileSync(file, "utf8")), relative);
}

const fireDir = path.join(root, "data", "fire-monthly");
if (fs.existsSync(fireDir)) {
  for (const name of fs.readdirSync(fireDir).filter(name => name.endsWith(".json"))) {
    const relative = path.join("data", "fire-monthly", name);
    assertRedacted(JSON.parse(fs.readFileSync(path.join(root, relative), "utf8")), relative);
  }
}

console.log("Artefak publik bersih dari PBPH serta geometri mentah RSPO/Perhutanan Sosial internal.");
