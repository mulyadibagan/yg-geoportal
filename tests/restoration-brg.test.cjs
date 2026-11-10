const {test}=require('node:test'),assert=require('node:assert/strict');
const api=import('../scripts/read-restoration-brg.mjs');
// Synthetic binary fixtures are used only for parser regression tests, never as analysis data.
function fixture(){
 const dbf=Buffer.alloc(72,32);dbf[0]=3;dbf.writeUInt32LE(1,4);dbf.writeUInt16LE(65,8);dbf.writeUInt16LE(7,10);dbf.fill(0,32,64);dbf.write('LABEL',32);dbf[43]=67;dbf[48]=6;dbf[64]=13;dbf.write(' RIAU  ',65);
 const points=[[0,0],[0,1],[1,1],[1,0],[0,0]],content=Buffer.alloc(48+points.length*16);content.writeInt32LE(5,0);content.writeDoubleLE(1,20);content.writeDoubleLE(1,28);content.writeInt32LE(1,36);content.writeInt32LE(5,40);content.writeInt32LE(0,44);points.forEach(([x,y],i)=>{content.writeDoubleLE(x,48+i*16);content.writeDoubleLE(y,56+i*16);});
 function header(size){const b=Buffer.alloc(size);b.writeInt32BE(9994,0);b.writeInt32BE(size/2,24);b.writeInt32LE(1000,28);b.writeInt32LE(5,32);return b;}
 const shp=header(108+content.length);shp.writeInt32BE(1,100);shp.writeInt32BE(content.length/2,104);content.copy(shp,108);
 const shx=header(108);shx.writeInt32BE(50,100);shx.writeInt32BE(content.length/2,104);return {shp,shx,dbf};
}
test('BRG binary reader binds indexed geometry to its DBF row and preserves coordinates',async()=>{
 const {inspectShapefile}=await api,{shp,shx,dbf}=fixture(),r=inspectShapefile(shp,shx,dbf);
 assert.equal(r.count,1);assert.equal(r.attributes.row(0).LABEL,'RIAU');assert.deepEqual(r.record(0).rings[0],[[0,0],[0,1],[1,1],[1,0],[0,0]]);assert.match(r.record(0).rawShapeSha256,/^[a-f0-9]{64}$/);
});
test('BRG binary reader rejects mismatched SHX offsets, record IDs, truncation and point bounds',async()=>{
 const {inspectShapefile:r}=await api;
 for(const mutate of [f=>f.shx.writeInt32BE(51,100),f=>f.shp.writeInt32BE(2,100),f=>f.shp.writeInt32BE(20,24),f=>f.dbf.writeUInt32LE(2,4)]){const f=fixture();mutate(f);assert.throws(()=>r(f.shp,f.shx,f.dbf));}
 const f=fixture();f.shp.writeInt32LE(100,148);assert.throws(()=>r(f.shp,f.shx,f.dbf).record(0));
});
test('BRG binary reader rejects nonfinite XY and invalid part starts',async()=>{
 const {inspectShapefile:r}=await api;let f=fixture();f.shp.writeDoubleLE(NaN,156);assert.throws(()=>r(f.shp,f.shx,f.dbf).record(0));
 f=fixture();f.shp.writeInt32LE(1,152);assert.throws(()=>r(f.shp,f.shx,f.dbf).record(0));
});
test('Deleted DBF rows remain unavailable rather than becoming empty attributes',async()=>{
 const {readDbf}=await api,f=fixture();f.dbf[65]=42;assert.equal(readDbf(f.dbf).row(0),null);assert.throws(()=>readDbf(f.dbf).row(1));
});
test('ESRI shell orientation calculation remains stable away from origin',async()=>{
 const {ringSignedArea:a}=await api,r=[[102,1],[102,2],[103,2],[103,1],[102,1]];assert.equal(a(r),-1);assert.equal(a(r.slice().reverse()),1);
});
test('Historical BRG labels retain missing fire values and never imply temporal forest opening',async()=>{
 const {sourcePressureFacts:f}=await api;
 let r=f({BA__2015:'Terbakar 2015',BA__2016:'Tidak Terbakar 2016',BA__2017:'Tidak Terbakar 2017',AREA_KANAL:'Berkanal',Hutan:'Non-Hutan',KETERANGAN:'Tanah Terbuka'});
 assert.deepEqual(r.burnedYears,[2015]);assert.equal(r.fireUnknown,false);assert.equal(r.forestOpening,null);assert.equal(r.validatedForScoring,false);
 r=f({BA__2015:null,BA__2016:'0',BA__2017:'',AREA_KANAL:'0',Hutan:'0'});assert.equal(r.fireUnknown,true);assert.equal(r.forestClass,null);assert.equal(r.canalLabel,null);assert.equal(r.forestOpening,null);
});
let J;try{J=require('../private-data/restoration-runtime/node_modules/jsts');}catch{}
test('ESRI conversion preserves multiple shells, holes and islands, rejecting orphan holes without repair',{skip:!J&&'Local GIS runtime unavailable'},async()=>{
 const {polygonFromEsriRings:p}=await api,reader=new J.io.GeoJSONReader();
 const shell=[[0,0],[0,10],[10,10],[10,0],[0,0]],hole=[[2,2],[8,2],[8,8],[2,8],[2,2]],island=[[4,4],[4,6],[6,6],[6,4],[4,4]];
 const g=reader.read(p([hole,island,shell],J));assert.equal(g.getArea(),68);assert.equal(new J.operation.valid.IsValidOp(g).isValid(),true);
 assert.equal(g.contains(reader.read({type:'Point',coordinates:[3,3]})),false);assert.equal(g.contains(reader.read({type:'Point',coordinates:[5,5]})),true);
 assert.throws(()=>p([hole],J));assert.throws(()=>p([shell,[[9,9],[11,9],[11,11],[9,11],[9,9]]],J));assert.throws(()=>p([shell.slice(0,-1)],J));
});
test('Real BRG overlay input adapter keeps unknown forest loss, missing canal year and unvalidated evidence unassessed',async()=>{
 const {prepareUnit:p}=await import('../scripts/prepare-restoration-brg-inputs.mjs');
 const u={unitId:'test-only',sourceFeatureIndex:0,geometryValid:true,overlayErrors:[],firePositiveRefs:[{sourceFeatureIndex:1,years:[2015]}],nonForestRefs:[1],openLandRefs:[1],canalPartsIntersecting:2};
 let r=p(u,'a'.repeat(64));assert.equal(r.inputs.fire.present,true);assert.equal(r.inputs.canals.present,true);assert.equal(r.inputs.canals.provenance.year,null);assert.equal(r.inputs.forestOpening.present,null);assert.equal(r.assessment.complete,false);assert.equal(r.assessment.score,null);assert.equal(r.assessment.pressureCount,null);assert.equal(r.assessment.category,'Belum dinilai');
 r=p({...u,geometryValid:false},'a'.repeat(64));assert.equal(r.inputs.fire.present,null);assert.equal(r.inputs.canals.present,null);
 r=p({...u,firePositiveRefs:[],canalPartsIntersecting:0},'a'.repeat(64));assert.equal(r.inputs.fire.present,null);assert.equal(r.inputs.canals.present,null);
 assert.throws(()=>p({...u,firePositiveRefs:[{years:[2025]}]},'a'.repeat(64)));
});
test('BRG forest comparison excludes plantation/mangrove and accepts only explicit peat-swamp forest classes',async()=>{
 const {naturalSwampForest:f}=await import('../scripts/review-restoration-brg-forest-loss.mjs');
 assert.equal(f('Hutan Rawa Primer'),true);assert.equal(f('Hutan Rawa Sekunder'),true);
 for(const label of ['Hutan Tanaman','Hutan Mangrove Sekunder','Hutan Lahan Kering Sekunder','Non-Hutan','Tanah Terbuka',null,''])assert.equal(f(label),false);
});
test('BRG native loss comparison separates the 2017/2018 boundary without claiming a verified baseline year or interpreting zero as absence',async()=>{
 const {summarizeCounts:s}=await import('../scripts/review-restoration-brg-forest-loss.mjs'),counts={lossYearCounts:Array(26).fill(0)};
 counts.lossYearCounts[17]=2;let r=s(counts);assert.equal(r.lossPixels2001to2025,2);assert.equal(r.lossPixels2018to2025,0);assert.equal(r.mappedTreeLoss2018to2025,null);
 counts.lossYearCounts[18]=3;counts.lossYearCounts[25]=4;r=s(counts);assert.equal(r.lossPixels2018to2025,7);assert.equal(r.archiveForestObservationYear,null);assert.equal(r.forestOpeningValidated,false);assert.equal(r.score,null);
 assert.throws(()=>s({lossYearCounts:[0,1]}));counts.lossYearCounts[18]=-1;assert.throws(()=>s(counts));
});
test('BRG forest review selection does not require a pre-existing Non-Hutan label',async()=>{
 const {historicalFireCanalCandidate:f}=await import('../scripts/review-restoration-brg-forest-loss.mjs');
 const u={geometryValid:true,overlayErrors:[],firePositiveRefs:[{sourceFeatureIndex:1,years:[2015]}],canalPartsIntersecting:1,nonForestRefs:[]};
 assert.equal(f(u),true);assert.equal(f({...u,nonForestRefs:[1]}),true);
 assert.equal(f({...u,geometryValid:false}),false);assert.equal(f({...u,overlayErrors:[{}]}),false);assert.equal(f({...u,firePositiveRefs:[]}),false);assert.equal(f({...u,canalPartsIntersecting:0}),false);assert.equal(f({...u,canalPartsIntersecting:null}),false);
});
test('BRG review queue preserves original holes/attributes and never promotes observed pixels to final priorities',async()=>{
 const {reviewFeature:f}=await import('../scripts/prepare-restoration-brg-review-queue.mjs'),hash='a'.repeat(64),id=`bbsdlp-${hash.slice(0,16)}-0001`;
 const source={type:'Feature',geometry:{type:'Polygon',coordinates:[[[0,0],[0,4],[4,4],[4,0],[0,0]],[[1,1],[2,1],[2,2],[1,2],[1,1]]]},properties:{KK:'test fixture',KABKOT:'conflicting fixture'}};
 const unit={unitId:id,sourceFeatureIndex:0,score:null,forestOpeningValidated:false,finalPriority:'Belum dinilai',errors:[],loss2018to2025Refs:[2]},overlay={unitId:id,sourceFeatureIndex:0,geometryValid:true,overlayErrors:[],firePositiveRefs:[{sourceFeatureIndex:2,years:[2015]}],canalPartsIntersecting:1};
 const result=f(source,unit,overlay,hash);assert.deepEqual(result.geometry,source.geometry);assert.deepEqual(result.properties.sourceAttributes,source.properties);assert.equal(result.properties.priority,'Belum dinilai');assert.equal(result.properties.ecologicalScore,null);assert.equal(result.properties.forestObservationYear,null);assert.equal(result.properties.canalObservationYear,null);assert.equal(result.properties.sourceUnitApproved,false);
 result.geometry.coordinates[0][0][0]=50;assert.equal(source.geometry.coordinates[0][0][0],0);
 assert.throws(()=>f(source,{...unit,score:0},overlay,hash));assert.throws(()=>f(source,{...unit,errors:[{}]},overlay,hash));assert.throws(()=>f(source,{...unit,forestOpeningValidated:true},overlay,hash));assert.throws(()=>f(source,unit,{...overlay,unitId:'wrong'},hash));
});
