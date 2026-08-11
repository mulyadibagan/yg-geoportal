import fs from "node:fs/promises";

const path = process.argv[2] || "data/source-registry.json";
const registry = JSON.parse(await fs.readFile(path, "utf8"));
const allowed = new Set(["approved", "conditional", "review-required", "blocked"]);
const required = ["id", "name", "used", "dataKind", "access", "termsUrl", "licence", "attribution", "commercialUse", "redistribution", "status"];
const ids = new Set();

if (!Array.isArray(registry.sources) || !registry.sources.length) throw new Error("Source registry is empty.");
for (const source of registry.sources) {
  for (const field of required) {
    if (source[field] === undefined || source[field] === null || source[field] === "") throw new Error(`${source.id || "source"}: missing ${field}`);
  }
  if (ids.has(source.id)) throw new Error(`Duplicate source id: ${source.id}`);
  ids.add(source.id);
  if (!allowed.has(source.status)) throw new Error(`${source.id}: unsupported status ${source.status}`);
  if (!/^https:\/\//.test(source.termsUrl)) throw new Error(`${source.id}: termsUrl must use HTTPS`);
  if (source.used && ["blocked", "review-required"].includes(source.status)) {
    throw new Error(`${source.id}: source cannot be used while status is ${source.status}`);
  }
}
console.log(`Validated ${registry.sources.length} registered sources; ${registry.sources.filter((source) => source.used).length} are in use.`);
