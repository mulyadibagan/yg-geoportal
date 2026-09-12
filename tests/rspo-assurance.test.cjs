const test=require('node:test');
const assert=require('node:assert/strict');
const {evidence,ish}=require('../js/rspo-assurance.js');
const examples=require('../js/rspo-criteria-learning.js');
test('all company criteria have evidence and verification guidance',()=>{
  assert.deepEqual(Object.keys(evidence).sort(),Object.keys(examples).sort());
  for(const pair of Object.values(evidence)) { assert.equal(pair.length,2);pair.forEach(text=>assert.ok(text.length>30)); }
});
test('ISH numbering is separate and complete',()=>{
  assert.deepEqual(ish.map(p=>p[1].length),[2,5,6,9]);
  ish.forEach((p,i)=>p[1].forEach((c,j)=>{assert.equal(c[0],`${i+1}.${j+1}`);assert.ok(c[1]&&c[2]);}));
});
