const test=require('node:test'),assert=require('node:assert/strict'),A=require('../js/restoration-scoring.js');
const fixture=count=>Object.fromEntries(A.PRESSURES.map((p,i)=>[p.id,{present:i<count,validated:true,definition:'test-only observed pressure definition',validation:{reference:'test-only'},provenance:{source:'test-only',year:2026,version:'test-v1'},coverageComplete:true}]));
test('three-pressure screening uses observed convergence without TMAT or numerical scores',()=>{
 assert.deepEqual(A.PRESSURES.map(p=>p.id),['fire','forestOpening','canals']);
 for(const [count,category] of [[3,'Tinggi'],[2,'Sedang'],[1,'Rendah'],[0,'Tidak terindikasi pada cakupan data']]){
  const input=fixture(count),before=JSON.stringify(input),r=A.assessPressures(input);
  assert.equal(r.category,category);assert.equal(r.complete,true);assert.equal(r.pressureCount,count);assert.equal(r.score,null);
  assert.equal(JSON.stringify(input),before);
 }
});
test('unknown pressure, unvalidated layers and incomplete negative coverage never become absence',()=>{
 for(const id of A.PRESSURES.map(p=>p.id)){
  for(const mutate of [r=>delete r.present,r=>r.present=null,r=>r.present=0,r=>r.validated=false,r=>r.definition='',r=>delete r.provenance,r=>r.provenance.year=null,r=>r.validation.reference='']){
   const input=fixture(3);mutate(input[id]);assert.equal(A.assessPressures(input).category,'Belum dinilai');
  }
 }
 const input=fixture(2);input.canals.coverageComplete=false;
 assert.equal(A.assessPressures(input).pressureCount,null);assert.equal(A.assessPressures(input).complete,false);
 const features=[{properties:{restorationPressures:fixture(3),Luas_Ha:1}},{properties:{restorationPressures:input,Luas_Ha:2}}];
 const s=A.summarize(features,'pressures');assert.equal(s.assessed,1);assert.equal(s.priorityCount,1);assert.equal(s.unassessed,1);
});
