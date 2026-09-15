import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] || ".");
const dataRoot = path.join(root, "data");
const forbiddenPaths = [
  "data/PBPH_RIAU_052026.geojson",
  "data/pbph-documents.json",
  "data/phl-svlk-monthly"
];
const forbiddenKeys = new Set(["concession", "pbph052026", "permits"]);
const forbiddenStrings = /PBPH_RIAU_052026|data\/pbph-documents\.json|data\/phl-svlk-monthly/i;

for (const relative of forbiddenPaths) {
  if (fs.existsSync(path.join(root, relative))) {
    throw new Error(`Data PBPH tidak boleh berada di repository publik: ${relative}`);
  }
}

function visitFiles(directory, output = []) {
  if (!fs.existsSync(directory)) return output;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) visitFiles(target, output);
    else if (/\.(?:geo)?json$/i.test(entry.name)) output.push(target);
  }
  return output;
}

function inspect(value, file, trail = []) {
  if (Array.isArray(value)) {
    value.forEach((child, index) => inspect(child, file, [...trail, index]));
    return;
  }
  if (!value || typeof value !== "object") {
    if (typeof value === "string" && forbiddenStrings.test(value)) {
      throw new Error(`Referensi dataset PBPH ditemukan pada ${file}:${trail.join(".")}`);
    }
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    if (forbiddenKeys.has(key.toLowerCase())) {
      throw new Error(`Atribut PBPH ${key} ditemukan pada ${file}:${[...trail, key].join(".")}`);
    }
    inspect(child, file, [...trail, key]);
  }
}

for (const file of visitFiles(dataRoot)) {
  const relative = path.relative(root, file);
  const value = JSON.parse(fs.readFileSync(file, "utf8"));
  inspect(value, relative);
  if (relative.startsWith(`data${path.sep}fire-monthly${path.sep}`) && value && Object.hasOwn(value, "companies")) {
    throw new Error(`Ringkasan perusahaan PBPH ditemukan pada ${relative}`);
  }
  if (relative.startsWith(`data${path.sep}fire-monthly${path.sep}`) && value?.summary && Object.hasOwn(value.summary, "companies")) {
    throw new Error(`Jumlah perusahaan PBPH ditemukan pada ${relative}`);
  }
}

console.log("Repository publik bersih dari dataset dan atribut PBPH internal.");
