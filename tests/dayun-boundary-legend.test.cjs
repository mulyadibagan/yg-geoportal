const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const summary=require('../js/dayun-agro-summary.js');
test('revised map legend derives geometry counts and areas without changing program or census records',()=>{
 const program=JSON.parse(fs.readFileSync('data/dayun-program.json','utf8')),
       map=JSON.parse(fs.readFileSync('data/dayun-map.geojson','utf8')),
       blocks=JSON.parse(fs.readFileSync('data/dayun-blocks.geojson','utf8'));
 const before=JSON.stringify(program),layer=program.layers.find(l=>l.id==='agroforestry'),result=summary.boundaryLegend(layer,map,blocks);
 assert.equal(JSON.stringify(program),before);assert.deepEqual(result.items.map(i=>i.featureCount),[86,75,16]);
 assert.equal(result.reportedTotalHa,blocks.totalAreaHa);assert.equal(result.boundaryReceivedDate,'2026-10-18');
 assert.notEqual(result.items[0].areaHa,layer.items[0].areaHa);
});
test('block display removes interior parcel seams while retaining every exterior and source measurement',()=>{
 const blocks=JSON.parse(fs.readFileSync('data/dayun-blocks.geojson','utf8'));blocks.features.forEach(f=>delete f.displayGeometry);const before=JSON.stringify(blocks);
 const display=summary.outerBlockBoundaries(blocks);
 assert.equal(JSON.stringify(blocks),before);
 assert.ok(blocks.features.some(f=>f.geometry.coordinates.length>1));
 display.features.forEach((f,i)=>{
  assert.equal(f.geometry.type,'Polygon');assert.equal(f.geometry.coordinates.length,1);
  assert.deepEqual(f.geometry.coordinates[0],blocks.features[i].geometry.coordinates[0]);
  assert.deepEqual(f.properties,blocks.features[i].properties);
 });
 const multi={type:'FeatureCollection',features:[{type:'Feature',properties:{areaHa:10},geometry:{type:'MultiPolygon',coordinates:[blocks.features[0].geometry.coordinates,blocks.features[1].geometry.coordinates]}}]};
 const result=summary.outerBlockBoundaries(multi);
 assert.equal(result.features[0].geometry.coordinates.length,2);
 assert.ok(result.features[0].geometry.coordinates.every(p=>p.length===1));
 assert.deepEqual(result.features[0].geometry.coordinates[1][0],multi.features[0].geometry.coordinates[1][0]);
 const script=fs.readFileSync('js/dayun-public.js','utf8');
 assert.match(script,/blockHalo=L\.geoJSON\(blockDisplay/);assert.match(script,/blockLines=L\.geoJSON\(blockDisplay/);
});

test('prepared display outlines override cracks while canonical geometry and measured area remain unchanged',()=>{
 const blocks=JSON.parse(fs.readFileSync('data/dayun-blocks.geojson','utf8')),before=JSON.stringify(blocks),display=summary.outerBlockBoundaries(blocks);
 for(let i=0;i<blocks.features.length;i++){assert.deepEqual(display.features[i].geometry,blocks.features[i].displayGeometry);assert.equal(display.features[i].properties.areaHa,blocks.features[i].properties.areaHa);}
 assert.equal(JSON.stringify(blocks),before);
});
