const {test}=require('node:test'),assert=require('node:assert/strict');
const forest=import('../scripts/review-restoration-four-unit-forest.mjs');
test('Forest comparison preserves plantation, non-TMF and temporal source conflicts without scores',async()=>{
 const {compareClasses:c}=await forest;
 const opened=c(1,3,53);assert.equal(opened.forestToDeforestedObserved,true);assert.equal(opened.validated,false);assert.equal(opened.score,null);
 assert.equal(c(2,2,54).forestDisturbanceObserved,true);
 const conflict=c(3,3,53);assert.equal(conflict.temporalConflict,true);assert.equal(conflict.forestToDeforestedObserved,null);
 assert.equal(c(1,3,41).temporalConflict,true);
 assert.equal(c(3,3,41).deforestedLandObservedAtSample,true);
 assert.equal(c(3,3,41).forestToDeforestedObserved,null);
 assert.equal(c(1,3,86).plantationClassObserved,true);assert.equal(c(1,3,86).forestToDeforestedObserved,null);
 for(const values of [[0,3,53],[6,6,91],[3,3,41],[1,3,0]])assert.equal(c(...values).forestToDeforestedObserved,null);
 assert.throws(()=>c(7,3,53));assert.throws(()=>c(1,3,99));assert.throws(()=>c(null,3,53));
});
test('Byte-range verification rejects changed offsets, incomplete bytes and unbounded full responses',async()=>{
 const {checkRange:c}=await forest;
 assert.deepEqual(c('bytes=0-65536','bytes 0-65536/90000',65537),{start:0,end:65536,total:90000});
 assert.deepEqual(c('bytes=65536-131072','bytes 65536-89999/90000',24464),{start:65536,end:89999,total:90000});
 assert.throws(()=>c('bytes=0-65536','bytes 1-65536/90000',65536));
 assert.throws(()=>c('bytes=0-65536','bytes 0-65536/90000',65536));
 assert.throws(()=>c('bytes=0-65536',null,65537));
 assert.throws(()=>c('bytes=0-1,4-5','bytes 0-1/90000',2));
 assert.throws(()=>c('bytes=0-9999999','bytes 0-9999999/10000000',10000000));
});
test('Forest acquisition uses fixed public tile/product URLs without private queries',async()=>{
 const {mirrorUrl}=await forest,{sourceUrl}=await import('../scripts/acquire-restoration-jrc-forest.mjs');
 assert.equal(new URL(mirrorUrl('AnnualChange_2025')).search,'');
 assert.equal(new URL(sourceUrl('AnnualChange_2024')).searchParams.get('lat'),'N10');
 for(const value of ['../private','AnnualChange_2026','AnnualChange_2024&point=secret']){assert.throws(()=>mirrorUrl(value));assert.throws(()=>sourceUrl(value));}
});
