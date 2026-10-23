const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const T=require('../cloudflare/yg-webgis-public-data/node_modules/@turf/turf');
const context={window:{},setTimeout,console};vm.createContext(context);vm.runInContext(fs.readFileSync(require.resolve('../js/dayun-new-planting.js'),'utf8'),context);vm.runInContext(fs.readFileSync(require.resolve('../js/dayun-census-estimates.js'),'utf8'),context);const api=context.window.YG_DAYUN_CENSUS_ESTIMATES;
const zone='GT-C-08',boundary=T.polygon([[[102,0],[102.0001,0],[102.0001,.0001],[102,.0001],[102,0]]],{sourceGawanganId:zone});
const point=(id,x,y,status='candidate')=>T.point([x,y],{id,zones:[zone],status});
test('estimates reconcile with census without modifying observed points and avoid all existing/rejected positions',async()=>{
 const points=[point('a',102.00004,.00004),point('a',102.00004,.00004),point('rejected',102.00006,.00006,'rejected')],before=JSON.stringify(points);
 const result=await api.generate({rows:[{zone,count:80}],boundaries:T.featureCollection([boundary]),points,T,revision:12,sourceRun:'test',yieldWork:()=>Promise.resolve()});const p=result.features[0].properties;
 assert.equal(p.observedCount,1);assert.equal(p.estimatedCount,79);assert.equal(p.censusCount,80);assert.equal(p.positionVerified,false);assert.equal(JSON.stringify(points),before);
 const generated=api.pointCollection(result).features;assert.equal(generated.length,79);assert.equal(new Set(generated.map(f=>f.geometry.coordinates.join(','))).size,79);
 for(const f of generated){assert.equal(T.booleanPointInPolygon(f,boundary),true);for(const observed of points)assert.ok(T.distance(f,observed,{units:'meters'})>=.395);assert.equal(f.properties.origin,'census_position_estimate');}
});
test('insufficient room and observed totals exceeding census are rejected instead of forcing fictitious counts',async()=>{
 const args={rows:[{zone,count:10000}],boundaries:T.featureCollection([boundary]),points:[],T,revision:1,sourceRun:'test',yieldWork:()=>Promise.resolve()};await assert.rejects(api.generate(args),/ruang grid aman/);
 await assert.rejects(api.generate({...args,rows:[{zone,count:0}],points:[point('a',102.00004,.00004)]}),/melebihi sensus/);
});
test('holes remain empty; no synthetic positions for a fully reconciled zone',async()=>{
 const b=structuredClone(boundary);b.geometry.coordinates.push([[102.00003,.00003],[102.00003,.00007],[102.00007,.00007],[102.00007,.00003],[102.00003,.00003]]);
 const r=await api.generate({rows:[{zone,count:60}],boundaries:T.featureCollection([b]),points:[],T,revision:1,sourceRun:'test',yieldWork:()=>Promise.resolve()});for(const f of api.pointCollection(r).features)assert.equal(T.booleanPointInPolygon(f,b),true);
 const p=point('a',102.00001,.00001);const z=await api.generate({rows:[{zone,count:1}],boundaries:T.featureCollection([b]),points:[p],T,revision:1,sourceRun:'test'});assert.equal(z.features[0].properties.estimatedCount,0);
});
test('August targets remain 4193, 5522, 4902 and missing cohorts fail closed',()=>{
 const db=JSON.parse(fs.readFileSync(require.resolve('../data/dayun-gawangan-details.json'),'utf8'));assert.deepEqual(Array.from(api.targets(db),r=>r.count),[4193,5522,4902]);assert.throws(()=>api.targets({objects:[]}),/belum lengkap/);
});
test('real C8 C9 C10 boundary containers pass private area validation requirements',async()=>{
 const boundaries=JSON.parse(fs.readFileSync(require.resolve('../data/dayun-map.geojson'),'utf8'));
 const result=await api.generate({rows:['GT-C-08','GT-C-09','GT-C-10'].map(zone=>({zone,count:10})),boundaries,points:[],T,revision:1,sourceRun:'test',yieldWork:()=>Promise.resolve()});
 for(const f of result.features){assert.equal(T.booleanValid(f),true);assert.equal(T.kinks(f).features.length,0);}
});
