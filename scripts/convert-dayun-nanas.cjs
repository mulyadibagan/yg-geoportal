const fs = require('node:fs');
const [input, output] = process.argv.slice(2);
if (!input || !output) throw new Error('Usage: node scripts/convert-dayun-nanas.cjs input.shp output.geojson');
const prj = fs.readFileSync(input.replace(/\.shp$/i, '.prj'), 'utf8');
if (!prj.startsWith('GEOGCS["GCS_WGS_1984"')) throw new Error('Expected geographic WGS 84');
const shp = fs.readFileSync(input), dbf = fs.readFileSync(input.replace(/\.shp$/i, '.dbf'));
const header = dbf.readUInt16LE(8), size = dbf.readUInt16LE(10), fields = [];
let offset = 1;
for (let p = 32; p < header - 1; p += 32) {
  const length = dbf[p + 16];
  fields.push({name:dbf.toString('ascii', p, p + 11).replace(/\0/g, ''), offset, length});
  offset += length;
}
const features = [];
for (let cursor = 100, index = 0; cursor < shp.length; index++) {
  const start = cursor + 8, end = start + shp.readUInt32BE(cursor + 4) * 2;
  if (shp.readInt32LE(start) !== 5) throw new Error('Expected Polygon');
  const count = shp.readInt32LE(start + 36), n = shp.readInt32LE(start + 40);
  const starts = Array.from({length:count}, (_, i) => shp.readInt32LE(start + 44 + i * 4));
  const pointStart = start + 44 + count * 4;
  const points = Array.from({length:n}, (_, i) => [shp.readDoubleLE(pointStart + i * 16), shp.readDoubleLE(pointStart + i * 16 + 8)]);
  // This source consists of single-ring polygons; fail instead of misreading multipart topology.
  if (count !== 1) throw new Error('Multipart polygon requires topology handling');
  const record = header + index * size;
  if (dbf[record] !== 32) throw new Error('Unexpected deleted DBF record');
  const attributes = Object.fromEntries(fields.map(f => [f.name, dbf.toString('utf8', record + f.offset, record + f.offset + f.length).trim()]));
  features.push({type:'Feature', properties:{...attributes, areaHa:Number(attributes.Luas_Ha), sourceRecord:index + 1}, geometry:{type:'Polygon', coordinates:starts.map((s, i) => points.slice(s, starts[i + 1] ?? n))}});
  cursor = end;
}
if (features.length !== dbf.readUInt32LE(4)) throw new Error('SHP/DBF record mismatch');
const data = {type:'FeatureCollection', name:'Potensi Penanaman Nanas', source:'Potensi_Penanaman_Nanas.rar', sourceCrs:'EPSG:4326', receivedDate:'2026-10-30', features};
fs.writeFileSync(output, JSON.stringify(data, null, 2) + '\n');
console.log(JSON.stringify({features:features.length, areaHa:features.reduce((sum, f) => sum + f.properties.areaHa, 0)}));