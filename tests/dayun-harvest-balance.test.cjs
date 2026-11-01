const test=require('node:test'),assert=require('node:assert/strict');
const {reconcileHarvest,plantingRange}=require('../js/dayun-work-summary.js');
const baseline=require('../data/dayun-work-counts.json'),details=require('../data/dayun-gawangan-details.json');
test('physical harvest includes rejects and consumption exactly once per gawangan and event',()=>{
 const result=reconcileHarvest(baseline,baseline,details);
 assert.equal(result.rows.reduce((n,r)=>n+r.harvestedFruits,0),844);
 assert.equal(result.rows.filter(r=>r.harvestEvents.some(id=>id.endsWith('2026-10-27'))).reduce((n,r)=>n+r.harvestedFruits,0),267);
 assert.deepEqual(reconcileHarvest(result,baseline,details),result);
 const repeated=structuredClone(details);for(const o of repeated.objects)for(const c of o.crops||[])if(c.crop==='NANAS')c.pineappleHarvest=[...(c.pineappleHarvest||[]),...(c.pineappleHarvest||[])];
 assert.deepEqual(reconcileHarvest(baseline,baseline,repeated),result);
 assert.equal(baseline.rows.reduce((n,r)=>n+r.fruits,0),2005);
 assert.equal(result.rows.reduce((n,r)=>n+r.fruitHarvestCorrection,0),417);
 assert.equal(result.rows.reduce((n,r)=>n+r.fruitCorrectedBaseline,0),2422);
 assert.equal(result.rows.reduce((n,r)=>n+r.remainingFruits,0),1578);
});
test('real harvest corrects underestimated fruit counts and later censuses exclude reflected harvest',()=>{
 const result=reconcileHarvest(baseline,baseline,details),b10=result.rows.find(r=>r.zone==='GT-B-10');
 assert.equal(b10.remainingFruits,0);assert.equal(b10.fruitHarvestCorrection,103);assert.equal(b10.fruitCorrectedBaseline,129);
 const next={...baseline,snapshotDate:'2026-10-30'};
 assert.equal(reconcileHarvest(next,next,details).rows.reduce((n,r)=>n+r.harvestedFruits,0),0);
 assert.equal(plantingRange(baseline.rows,'newPlantingMonth'),'Juli 2026 – Agustus 2026');
});
test('export retains original counts and separately records each harvest deduction and correction',async()=>{
 const ExcelJS=require('../assets/vendor/exceljs/exceljs-4.4.0.min.js'),exporter=require('../js/dayun-work-excel.js');
 const data=reconcileHarvest({...baseline,live:false,checkedAt:'2026-11-01T00:00:00+07:00'},baseline,details);
 const workbook=exporter.workbook(ExcelJS,data),loaded=new ExcelJS.Workbook();await loaded.xlsx.load(await workbook.xlsx.writeBuffer());
 const sheet=loaded.getWorksheet('Rekonsiliasi buah');assert(sheet);assert.equal(sheet.rowCount,41);
 const row=sheet.getRows(2,40).find(r=>r.getCell(1).value==='GT-B-10');
 assert.deepEqual([3,4,5,6].map(c=>row.getCell(c).value),[26,129,0,103]);
 assert.equal(loaded.worksheets[0].getCell('D46').value.result,2422);
});
