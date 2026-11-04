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
test('TMAT calendar validation flags impossible dates and equivalent clock representations',async()=>{
 const {calendarDate,auditRows}=await import('../scripts/audit-restoration-tmat.mjs');
 assert.equal(calendarDate('29-Feb-2024'),'2024-02-29');
 for(const value of ['29-Feb-2026','31-Apr-2026','04-XYZ-2026','2026-13-01','today',null])assert.equal(calendarDate(value),null);
 const result=auditRows([{Tanggal:'04-Nov-2026',Jam:'07:00',WaterLevel:'0'},{Tanggal:'2026-11-04',Jam:'07:00:00',WaterLevel:'-95'},{Tanggal:'31-Apr-2026',Jam:'07:00',WaterLevel:'1'}]);
 assert.equal(result.missingDateTime,1);assert.equal(result.observedCalendarDays,1);
 assert.equal(result.conflictingTimes.length,1);assert.equal(result.conflictingTimes[0].selectedValue,null);
 assert.deepEqual(result.conflictingTimes[0].records.map(row=>row.sourceRecordIndex),[0,1]);
 assert.equal(result.conflictingTimes[0].timezone,null);assert.equal(result.completePeriodValidated,false);
});
