import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] || "_site");
if (!fs.existsSync(root)) throw new Error(`Static artifact does not exist: ${root}`);

const forbiddenDirectories = [
  "private-data",
  "internal-data",
  "data/riau-geoportal",
  "cloudflare/yg-webgis-public-data/tmp"
];
const forbiddenFiles = /(?:^|\/)internal\/riau-geoportal\/(?:catalog|datasets|releases)(?:\/|$)|(?:^|\/)(?:source|display)\.(?:geojson|gpkg|fgb|parquet|pmtiles|zip|shp|dbf|shx|prj|xml)(?:\.gz)?$|(?:^|\/)riau[-_]?geoportal[^/]*\.(?:geojson|gpkg|fgb|parquet|pmtiles|zip|shp|dbf|shx|prj|xml)(?:\.gz)?$/i;
const found = [];

for (const relative of forbiddenDirectories) {
  const target = path.join(root, ...relative.split("/"));
  if (fs.existsSync(target)) found.push(path.relative(root, target));
}

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    const relative = path.relative(root, absolute).split(path.sep).join("/");
    if (entry.isDirectory() && ![".git", "node_modules", "_site"].includes(entry.name)) walk(absolute);
    else if (forbiddenFiles.test(relative)) found.push(relative);
  }
}
walk(root);

if (found.length) {
  throw new Error(`Riau Geoportal private artifacts entered the Pages build:\n${found.sort().join("\n")}`);
}
console.log("Riau Geoportal private-data boundary verified.");
