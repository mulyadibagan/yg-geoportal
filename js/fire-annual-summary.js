(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.YG_FIRE_ANNUAL=api;})(typeof window==='undefined'?globalThis:window,function(){
'use strict';
function aggregate(year,reports){
 const start=year==='2026'?year+'-07':year+'-01';
 const eligible=reports.filter(r=>r.status==='final'&&r.month>=start&&r.month<=year+'-12').sort((a,b)=>a.month.localeCompare(b.month));
 if(!eligible.length)throw Error('Belum ada laporan final untuk tahun ini');
 const seen=new Set(),hotspots=[],villages=new Map(),regencies=new Set();
 for(const report of eligible)for(const p of report.hotspots||[]){
  if(!String(p.date||'').startsWith(report.month+'-'))continue;
  const id=[p.date,String(p.time||'').padStart(4,'0'),Number(p.longitude).toFixed(5),Number(p.latitude).toFixed(5),p.satellite].join('|');
  if(seen.has(id))continue;seen.add(id);hotspots.push(p);
  if(p.regency)regencies.add(p.regency);
  if(p.village){const key=[p.village,p.district,p.regency].join('|');if(!villages.has(key))villages.set(key,{village:p.village,district:p.district,regency:p.regency,hotspots:0});villages.get(key).hotspots++;}
 }
 const months=eligible.map(r=>r.month),last=months[months.length-1],missing=[];
 for(let m=Number(start.slice(5));m<=Number(last.slice(5));m++){const key=year+'-'+String(m).padStart(2,'0');if(!months.includes(key))missing.push(key);}
 return {year,month:last,annual:true,status:'partial',generatedAt:new Date().toISOString(),months,missingMonths:missing,period:{start:start+'-01',end:eligible[eligible.length-1].period.end},summary:{hotspots:hotspots.length,villages:villages.size,regencies:regencies.size},daily:eligible.map(r=>({date:r.month,hotspots:hotspots.filter(p=>p.date.startsWith(r.month+'-')).length})),villages:[...villages.values()],hotspots};
}
return {aggregate};
});
