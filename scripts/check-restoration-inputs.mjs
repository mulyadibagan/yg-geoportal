// Read-only input audit. Never fetches, uploads, approves, or modifies a dataset.
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import A from '../js/restoration-scoring.js';

export const MAX_BYTES = 64 * 1024 * 1024;
export function inspect(data) {
  if (data?.type !== 'FeatureCollection' || !Array.isArray(data.features) || !data.features.length || data.features.length > 25000)
    throw Error('Input harus FeatureCollection berisi 1–25000 fitur.');
  const indicators = A.INDICATORS.map(def => ({ id: def.id, label: def.label, weight: def.weight, complete: 0, blocked: 0, reasons: {} }));
  const categories = { Tinggi: 0, Sedang: 0, Rendah: 0, 'Belum dinilai': 0 };
  for (const feature of data.features) {
    if (feature?.type !== 'Feature' || !feature.properties || Array.isArray(feature.properties) || typeof feature.properties !== 'object' ||
        !['Polygon', 'MultiPolygon'].includes(feature.geometry?.type))
      throw Error('Setiap unit harus Feature poligon dengan properties. Audit ini tidak memeriksa koordinat/topologi.');
    const result = A.assess(feature.properties.restorationIndicators);
    categories[result.category]++;
    result.indicators.forEach((row, index) => {
      const target = indicators[index];
      if (row.score === null) {
        target.blocked++;
        target.reasons[row.reason] = (target.reasons[row.reason] || 0) + 1;
      } else target.complete++;
    });
  }
  const unassessed = categories['Belum dinilai'];
  return {
    schemaVersion: 1, modelVersion: A.VERSION, status: unassessed ? 'incomplete' : 'input-complete',
    featureCount: data.features.length, assessed: data.features.length - unassessed, unassessed, categories, indicators,
    scope: 'declared-input-readiness-only', approvalGranted: false, geometryValidated: false,
    implementationReadiness: 'Belum dinilai',
    nextSteps: indicators.filter(row => row.blocked).map(row => ({ indicator: row.id, blockedUnits: row.blocked, reasons: Object.keys(row.reasons) }))
  };
}

export async function readInput(file) {
  if ((await stat(file)).size > MAX_BYTES) throw Error('Input melampaui batas 64 MiB.');
  const chunks = [], hash = createHash('sha256');
  let bytes = 0;
  for await (const chunk of createReadStream(file)) {
    bytes += chunk.length;
    if (bytes > MAX_BYTES) throw Error('Input melampaui batas 64 MiB.');
    chunks.push(chunk); hash.update(chunk);
  }
  const report = inspect(JSON.parse(Buffer.concat(chunks).toString('utf8')));
  return { ...report, inputBytes: bytes, inputSha256: hash.digest('hex') };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.length !== 3) {
    console.error('Gunakan: node scripts/check-restoration-inputs.mjs <berkas.geojson>');
    process.exitCode = 1;
  } else {
    try {
      const report = await readInput(process.argv[2]);
      // Aggregate only: no geometry, raw values, IDs, source URLs, names or credentials.
      console.log(JSON.stringify(report, null, 2));
      process.exitCode = report.status === 'input-complete' ? 0 : 2;
    } catch {
      // Do not echo malformed input, filesystem paths or properties into CI logs.
      console.error('Input tidak dapat diperiksa. Periksa format GeoJSON, unit poligon, dan batas ukuran 64 MiB.');
      process.exitCode = 1;
    }
  }
}
