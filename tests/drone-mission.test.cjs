const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const core=require('../js/drone-mission-core.js');
const xy=p=>[101+p[0]/111320,.7+p[1]/111320];
const poly=points=>({type:'Polygon',coordinates:[points.map(xy)]});
const square=ha=>{const s=Math.sqrt(ha*10000);return poly([[0,0],[s,0],[s,s],[0,s],[0,0]])};
for(const ha of [1,5,28])test(`${ha} ha grid, return routes, photo footprints and exports`,()=>{
 const m=core.generate(square(ha),{takeoff:xy([1,1])});m.id='DRN-test';
 assert.ok(Math.abs(m.areaHa-ha)<.02);assert.ok(m.lines.length>0&&m.photos.length>0);assert.ok(m.sorties.every(s=>s.withinBudget&&s.homeVerified));assert.ok(m.photoIntervalS>=5);assert.ok(m.sorties.every(s=>JSON.stringify(s.coordinates[0])===JSON.stringify(s.coordinates.at(-1))));assert.ok(core.geojson(m).features.some(f=>f.properties.kind==='waypoint'));assert.match(core.csv(m),/DRN-test/);assert.match(core.kml(m),/NOT verified/);assert.equal(m.flightReady,false);
 // Every sampled route point remains within the original square.
 const s=Math.sqrt(ha*10000);for(const route of m.sorties)for(const p of route.coordinates){const x=(p[0]-101)*111320,y=(p[1]-.7)*111320;assert.ok(x>=-1e-5&&y>=-1e-5&&x<=s+1e-5&&y<=s+1e-5)}
});
test('concave polygon connectors stay within boundary, holes exclude photo centres',()=>{
 const g=poly([[0,0],[200,0],[200,50],[50,50],[50,200],[0,200],[0,0]]),m=core.generate(g,{heading:30});assert.ok(m.lines.length);
 const origin=g.coordinates[0][0],scale=p=>[(p[0]-origin[0])*111320*Math.cos(.7*Math.PI/180),(p[1]-origin[1])*111320],rings=g.coordinates.map(r=>r.map(scale));
 for(const sortie of m.sorties)for(let i=1;i<sortie.coordinates.length;i++)assert.ok(core.segmentInside(scale(sortie.coordinates[i-1]),scale(sortie.coordinates[i]),rings));
 const h=square(5);h.coordinates.push([[30,30],[80,30],[80,80],[30,80],[30,30]].map(xy));const hm=core.generate(h);assert.ok(hm.photos.every(p=>{const x=(p.coordinates[0]-101)*111320,y=(p.coordinates[1]-.7)*111320;return !(x>30+1e-6&&x<80-1e-6&&y>30+1e-6&&y<80-1e-6)}));
});
test('altitude and overlap change density; invalid and non-nadir parameters rejected',()=>{const a=core.generate(square(1)),b=core.generate(square(1),{altitude:70}),c=core.generate(square(1),{frontOverlap:90,sideOverlap:90});assert.ok(b.photos.length<a.photos.length);assert.ok(c.photos.length>a.photos.length);assert.ok(b.gsdCm>a.gsdCm);assert.throws(()=>core.generate(square(1),{gimbal:-45}));assert.throws(()=>core.generate(square(1),{sideOverlap:100}));});
test('disjoint polygons use independent sorties and no invented inter-component transit',()=>{const a=square(1),b=poly([[300,0],[400,0],[400,100],[300,100],[300,0]]);const m=core.generate({type:'MultiPolygon',coordinates:[a.coordinates,b.coordinates]});assert.equal(new Set(m.sorties.map(s=>s.component)).size,2);assert.ok(m.sorties.every(s=>!s.homeVerified));});
test('Dayun database has six blocks, 28 ha and all multipart gawangan retained',()=>{const d=JSON.parse(fs.readFileSync('data/dayun-blocks.geojson'));assert.equal(d.features.length,6);assert.ok(Math.abs(d.features.reduce((s,f)=>s+f.properties.areaHa,0)-28.0638)<.001);const m=JSON.parse(fs.readFileSync('data/dayun-map.geojson'));assert.equal(new Set(m.features.filter(f=>f.properties.category==='Gawangan Tanam').map(f=>f.properties.objectId)).size,60);});

test('actual Dayun full-block geometry generates six components within battery budget',()=>{const blocks=JSON.parse(fs.readFileSync('data/dayun-blocks.geojson'));const m=core.generate({type:'MultiPolygon',coordinates:blocks.features.map(f=>f.geometry.coordinates)});assert.equal(new Set(m.sorties.map(s=>s.component)).size,6);assert.ok(m.sorties.every(s=>s.withinBudget));assert.ok(m.photos.length>500);assert.ok(m.areaHa>27&&m.areaHa<29);});
