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
function fieldFixture(buildTargets){
 const targets=buildTargets({access:'staff_only',rows:[unit()]}),t=targets.features[0],p=t.properties;
 const form={access:'staff_only',targets:[{targetId:t.id,unitId:p.unitId,sourceFeatureIndex:p.sourceFeatureIndex,sourceReferences:p.sourceSamples.map(s=>s.responseRef),score:null,canalConditionVerified:false,finalPriority:'Belum dinilai',observations:[]}]};return {targets,form};
}
test('Empty or incomplete field evidence cannot become verified canals, scores or priorities',async()=>{
 const {buildTargets,reviewFieldForm}=await modulePromise,{targets,form}=fieldFixture(buildTargets);
 let result=reviewFieldForm(form,targets,'2026-11-05',()=>true);assert.equal(result.rows[0].status,'Belum diperiksa');assert.equal(result.rows[0].observations.length,0);
 form.targets[0].observations=[{observedAt:'2026-02-30',geometry:{type:'Point',coordinates:point},objectType:'belum teridentifikasi',evidenceFiles:[]}];
 result=reviewFieldForm(form,targets,'2026-11-05',()=>false);const observation=result.rows[0].observations[0];assert.ok(observation.issues.length>=4);assert.equal(observation.intakeReady,false);assert.equal(observation.canalConditionVerified,false);assert.equal(observation.score,null);assert.equal(result.approvalGranted,false);
 form.targets[0].score=75;assert.throws(()=>reviewFieldForm(form,targets,'2026-11-05',()=>true));
});
test('Field metadata retains actual location/source requirements and rejects future dates and forged lineage',async()=>{
 const {buildTargets,reviewFieldForm}=await modulePromise,{targets,form}=fieldFixture(buildTargets);
 const observation={observedAt:'2026-11-04',geometry:{type:'Point',coordinates:point},objectType:'kanal',condition:'bersekat',drainageObservation:'Test-only observation, never runtime evidence',evidenceFiles:[{path:'evidence.txt',sha256:'a'.repeat(64),sourceReference:'test-only-source',version:'test-version',observationYear:2026}]};
 form.targets[0].observations=[observation];let result=reviewFieldForm(form,targets,'2026-11-05',()=>true);assert.equal(result.rows[0].observations[0].issues.length,0);assert.equal(result.rows[0].observations[0].intakeReady,false);
 observation.observedAt='2026-11-06';assert.ok(reviewFieldForm(form,targets,'2026-11-05',()=>true).rows[0].observations[0].issues.length);
 observation.observedAt='2026-11-04';observation.evidenceFiles[0].path='../outside.txt';assert.ok(reviewFieldForm(form,targets,'2026-11-05',()=>true).rows[0].observations[0].issues.length);
 form.targets[0].sourceReferences=['changed'];assert.throws(()=>reviewFieldForm(form,targets,'2026-11-05',()=>true));
});
test('Evidence files require original bytes inside the package and a bounded total read',async()=>{
 const {verifyEvidenceFile}=await modulePromise,fsp=require('node:fs/promises'),os=require('node:os'),crypto=require('node:crypto'),dir=await fsp.mkdtemp(path.join(os.tmpdir(),'restoration-evidence-test-'));
 try{
  const bytes=Buffer.from('test-only integrity fixture, not a field observation'),file=path.join(dir,'evidence.txt'),ref={path:'evidence.txt',sha256:crypto.createHash('sha256').update(bytes).digest('hex')};await fsp.writeFile(file,bytes);
  assert.deepEqual(await verifyEvidenceFile(dir,ref,1024),{bytesRead:bytes.length,valid:true});
  await assert.rejects(()=>verifyEvidenceFile(dir,{...ref,path:'../outside.txt'},1024));await assert.rejects(()=>verifyEvidenceFile(dir,ref,1));
  await fsp.writeFile(file,'changed');const mismatch=await verifyEvidenceFile(dir,ref,1024);assert.equal(mismatch.valid,false);assert.equal(mismatch.bytesRead,7);
  await assert.rejects(()=>verifyEvidenceFile(dir,ref,7-mismatch.bytesRead));
  await fsp.writeFile(file,'');await assert.rejects(()=>verifyEvidenceFile(dir,ref,1024));
 }finally{await fsp.unlink(path.join(dir,'evidence.txt'));await fsp.rmdir(dir);}
});
