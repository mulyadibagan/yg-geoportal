const test=require('node:test');const assert=require('node:assert/strict');
test('TMAT parsing preserves zero and rejects missing/nonfinite values',async()=>{
 const {numeric}=await import('../scripts/audit-restoration-tmat.mjs');
 for(const value of [null,undefined,'',' ',false,'NaN','Infinity','-3 cm',NaN,Infinity])assert.equal(numeric(value),null);
 assert.equal(numeric('0'),0);assert.equal(numeric(0),0);assert.equal(numeric('-95'),-95);
});
test('TMAT audit flags conflicting measurements without choosing a value',async()=>{
 const {auditRows}=await import('../scripts/audit-restoration-tmat.mjs');
 assert.equal(auditRows(null).records,null);
 const result=auditRows([{Tanggal:'04-Nov-2026',Jam:'07:00',WaterLevel:'0'},{Tanggal:'04-Nov-2026',Jam:'07:00',WaterLevel:'-95'},{Tanggal:'04-Nov-2026',Jam:'07:30',WaterLevel:''}]);
 assert.equal(result.numericValues,2);assert.equal(result.missingValues,1);assert.equal(result.conflictingDateTime,1);
 assert.equal(result.scoringValidated,false);assert.equal(result.timezoneConfirmed,false);
});
test('TMAT requests accept only bounded public station identities and fixed detail duration',async()=>{
 const {detailUrl,publicSelection,observationAudit}=await import('../scripts/acquire-restoration-tmat.mjs');
 for(const station of [{station_id:'https://private.test',source:'simatag'},{station_id:'token=value',source:'simatag'},{station_id:'x',source:'private'},null])assert.throws(()=>detailUrl(station));
 const url=new URL(detailUrl({station_id:'MTI-JK3UT52ST1GS',source:'simatag'}));
 assert.equal(url.origin,'https://sitmat.kemenlh.go.id');assert.equal(url.searchParams.get('days'),'30');assert.equal(url.searchParams.has('geometry'),false);
 assert.equal(publicSelection({}),false);assert.equal(observationAudit({properties:{}}).recordCount,0);
});
