const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const modulePromise=import('../scripts/prepare-restoration-site-review.mjs');
// Public source vertices exercise grouping without putting private BPBD coordinates in Git.
const source=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/Gambut_BBSDLP_2019.geojson'))).features[0].geometry;
const point=(source.type==='Polygon'?source.coordinates[0][0]:source.coordinates[0][0][0]).slice(0,2);
function sample(ref,p=point){return {responseRef:ref,pointIndex:0,date:'2025-01-01',point:p.slice(),sourceValues:{},comparison:{score:null}};}
function unit(id='source-unit',samples=[sample('test-reference')]){return {unitId:id,sourceFeatureIndex:0,samples,score:null,sourceUnitApproved:false};}
test('Targets retain original coordinates including Z, repeated source references and empty observations',async()=>{
 const {buildTargets}=await modulePromise,p=[...point,0],review={access:'staff_only',rows:[unit('source-unit',[sample('test-reference-1',p),sample('test-reference-2',p)])]},before=JSON.stringify(review);
 const result=buildTargets(review);assert.equal(result.features.length,1);assert.deepEqual(result.features[0].geometry.coordinates,p);
 const props=result.features[0].properties;assert.equal(props.sourceSamples.length,2);assert.deepEqual(props.observations,[]);assert.equal(props.canalConditionVerified,false);assert.equal(props.score,null);assert.equal(props.status,'Belum diperiksa');
 assert.equal(result.metadata.observationsCompleted,0);assert.equal(result.metadata.uniqueIncidents,null);assert.equal(JSON.stringify(review),before);
 assert.equal(buildTargets(review).features[0].id,result.features[0].id);
});
test('Identical coordinates across source units are not merged or counted as surveyed canals',async()=>{
 const {buildTargets}=await modulePromise,result=buildTargets({access:'staff_only',rows:[unit('unit-a'),unit('unit-b')]});
 assert.equal(result.features.length,2);assert.notEqual(result.features[0].id,result.features[1].id);
 assert.ok(result.features.every(f=>f.properties.finalPriority==='Belum dinilai'&&f.properties.sourceUnitApproved===false));
});
test('Site worklists reject invalid coordinates, repeated identities and preapproved source input',async()=>{
 const {buildTargets}=await modulePromise;
 for(const rows of [[],[unit(),unit()],[unit('a',[sample('same'),sample('same')])],[unit('a',[sample('bad',[NaN,0])])],[unit('a',[sample('bad',[181,0])])],[{...unit(),sourceUnitApproved:true}],[{...unit(),score:75}]])assert.throws(()=>buildTargets({access:'staff_only',rows}));
 assert.throws(()=>buildTargets({access:'public',rows:[unit()]}));
});
