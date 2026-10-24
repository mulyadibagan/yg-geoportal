const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const ExcelJS=require('../assets/vendor/exceljs/exceljs-4.4.0.min.js'),exporter=require('../js/dayun-work-excel.js');
const stored=require('../data/dayun-work-counts.json');
const fixture=()=>({...structuredClone(stored),schema:'dayun-live-work-counts-v1',live:true,checkedAt:'2026-10-24T05:00:00Z',revisions:{A:{plants:1517,fruits:412},B:{plants:4335,fruits:1614},C:{plants:3146,fruits:1}}});
test('real XLSX roundtrip includes all 40 rows, numeric values, cached totals, source revisions and planting months',async()=>{
 const d=fixture();d.rows.find(r=>r.zone==='GT-B-05').newPlantingMonth='Juli 2026';const w=exporter.workbook(ExcelJS,d),bytes=await w.xlsx.writeBuffer();assert(bytes.byteLength>5000);assert.equal(bytes[0],80);assert.equal(bytes[1],75);
 const read=new ExcelJS.Workbook();await read.xlsx.load(bytes);const s=read.worksheets[0];assert.equal(read.worksheets.length,1);assert.equal(s.getCell('B45').value,'GT-C-10');assert.equal(s.getCell('B35').value,'GT-B-15');assert.equal(s.getCell('D35').value,229);assert.equal(s.getCell('H25').value,'Juli 2026');
 assert.equal(s.getCell('C46').value.result,74465);assert.equal(s.getCell('D46').value.result,2005);assert.equal(s.getCell('E46').value.result,30244);assert.equal(s.getCell('F46').value.result,3113);assert.match(s.getCell('A49').value,/buah 1614/);assert.match(s.getCell('A2').value,/12:00:00 WIB/);assert.equal(s.views[0].state,'frozen');assert.equal(s.autoFilter,'A5:H45');
 for(let i=0;i<40;i++){const r=d.rows[i],n=i+6;assert.equal(s.getCell('B'+n).value,r.zone);assert.equal(s.getCell('C'+n).value,r.plants);assert.equal(s.getCell('D'+n).value,r.fruits);assert.equal(s.getCell('E'+n).value,r.newPlants);}
});
test('export uses the newly fetched numbers and refuses incomplete, duplicate, stale-schema and invalid data',()=>{
 const d=fixture();d.rows[0].plants+=7;const w=exporter.workbook(ExcelJS,d);assert.equal(w.worksheets[0].getCell('C6').value,d.rows[0].plants);assert.equal(w.worksheets[0].getCell('C46').value.result,74472);
 for(const mutate of [d=>d.rows.pop(),d=>d.rows[1].zone=d.rows[0].zone,d=>d.live=false,d=>d.rows[0].plants=-1,d=>d.rows[0].fruits=NaN,d=>d.checkedAt='invalid']){const invalid=fixture();mutate(invalid);assert.throws(()=>exporter.workbook(ExcelJS,invalid));}
 const js=fs.readFileSync('js/dayun-work-excel.js','utf8');assert.match(js,/assets\/vendor\/exceljs\/exceljs-4\.4\.0\.min\.js/);assert.match(js,/URL.revokeObjectURL/);
});
