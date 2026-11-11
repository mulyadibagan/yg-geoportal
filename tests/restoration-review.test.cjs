const {test}=require('node:test'),assert=require('node:assert/strict'),{createHash,webcrypto}=require('node:crypto'),R=require('../js/restoration-review.js');
const hash=b=>createHash('sha256').update(b).digest('hex');
// Algorithm-only fixtures: never published or used as spatial results.
function fixture(){
 const source=[{type:'Feature',properties:{KABKOT:'fixture'},geometry:{type:'Polygon',coordinates:[[[0,0],[0,1],[1,1],[0,0]]]}}],sourceHash=hash(JSON.stringify(source));
 const p={sourceFeatureIndex:0,sourceFeatureSha256:hash(JSON.stringify(source[0])),reviewCandidate:true,priority:'Belum dinilai',ecologicalScore:null,scoringValidated:false,sourceUnitApproved:false,forestObservationYear:null,canalObservationYear:null,implementationReadiness:{assessed:false,score:null},lossFragmentRefs:[1],canalPartsIntersecting:1};
 const g={type:'FeatureCollection',metadata:{access:'staff_only',sourceSha256:sourceHash},features:[{type:'Feature',id:`bbsdlp-${sourceHash.slice(0,16)}-0001`,geometry:structuredClone(source[0].geometry),properties:p}]};
 function encode(){const data=Buffer.from(JSON.stringify(g)),manifest=Buffer.from(JSON.stringify({access:'staff_only',sourceGeometryModified:false,priorityAssessed:false,originalPeatSha256:sourceHash,reviewCandidatesSha256:hash(data)}));return [data,manifest,source,sourceHash,webcrypto];}
 return {g,source,encode};
}
test('private review import binds checksums to original source geometry and never imports scoring fields',async()=>{
 const f=fixture();f.g.features[0].properties.restorationPressures={fire:{present:true,validated:true}};
 const r=await R.decode(...f.encode());assert.equal(r.features.length,1);assert.equal(r.features[0].properties.priority,'Belum dinilai');assert.equal(r.features[0].properties.ecologicalScore,null);assert.equal(r.features[0].properties.restorationPressures,undefined);assert.deepEqual(r.features[0].geometry,f.source[0].geometry);
});
test('private review import rejects edited bytes, mismatched sources and oversized inputs',async()=>{
 let args=fixture().encode();args[0]=Buffer.concat([args[0],Buffer.from(' ')]);await assert.rejects(R.decode(...args),/checksum/);
 args=fixture().encode();args[3]='a'.repeat(64);await assert.rejects(R.decode(...args));
 args=fixture().encode();args[0]=new Uint8Array(R.MAX_BYTES+1);await assert.rejects(R.decode(...args),/Ukuran/);
});
test('even a recalculated manifest cannot authorize altered geometry, duplicate rows or final priorities',async()=>{
 for(const mutate of [g=>g.features[0].geometry.coordinates[0][0][0]=.5,g=>g.features[0].properties.priority='Tinggi',g=>g.features[0].properties.ecologicalScore=0,g=>g.features[0].properties.sourceUnitApproved=true,g=>g.features.push(structuredClone(g.features[0]))]){
  const f=fixture();mutate(f.g);await assert.rejects(R.decode(...f.encode()));
 }
});
