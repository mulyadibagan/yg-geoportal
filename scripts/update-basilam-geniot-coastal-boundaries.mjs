import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataPath = name => path.join(root, 'data', name);
const readJson = name => JSON.parse(fs.readFileSync(dataPath(name), 'utf8'));
const writeJson = (name, value, compact = false) => fs.writeFileSync(
  dataPath(name),
  JSON.stringify(value, null, compact ? 0 : 2) + (compact ? '' : '\n'),
  'utf8'
);

const codes = new Set(['14.72.04.1004', '14.72.04.1006']);
const administrative = readJson('batas_administrasi_desa_riau.geojson');
const coastal = readJson('coastal-villages-riau.geojson');
const overrides = administrative.features.filter(feature => codes.has(String(feature.properties?.KODE_DESA)));

if (overrides.length !== 2) throw new Error(`Expected 2 boundary overrides, found ${overrides.length}`);

const overrideNames = new Set(overrides.map(feature => feature.properties.WADMKD));
coastal.features = coastal.features.filter(feature => !overrideNames.has(feature.properties?.WADMKD));
for (const feature of overrides) {
  coastal.features.push({
    ...feature,
    properties: {
      ...feature.properties,
      Coastal_Candidate: true,
      Coast_Distance_M: 0,
      Intervention: false,
      Boundary_Source: feature.properties.UUPP,
    },
  });
}

writeJson('coastal-villages-riau.geojson', coastal, true);

console.log(JSON.stringify({
  coastalFeatures: coastal.features.length,
  updated: overrides.map(feature => ({
    code: feature.properties.KODE_DESA,
    village: feature.properties.WADMKD,
    source: feature.properties.UUPP,
  })),
}, null, 2));
