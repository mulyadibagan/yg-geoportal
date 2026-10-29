(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.DayunCba=api;})(typeof window!=='undefined'?window:globalThis,function(){
 'use strict';
 function periods(plan,transactions,npmCosts,closedThrough='',asOf=''){
  const byMonth=new Map(plan.months.map(p=>[p.month,{...p,actualIncome:0,actualExpense:0,actualSales:0,npmActual:0,transactionCount:0,npmCount:0}]));
  for(const t of transactions||[]){const m=byMonth.get(String(t.date).slice(0,7));if(!m||t.deleted_at||!['income','expense'].includes(t.kind)||!Number.isFinite(t.amount))continue;m.transactionCount++;if(t.kind==='income'){m.actualIncome+=t.amount;if(/^Penjualan /.test(t.category||''))m.actualSales+=t.amount;}else m.actualExpense+=t.amount;}
  for(const t of npmCosts||[]){const m=byMonth.get(String(t.date).slice(0,7));if(m&&!t.deleted_at&&Number.isFinite(t.amount)){m.npmActual+=t.amount;m.npmCount++;}}
  let cash=plan.opening;
  return [...byMonth.values()].map(m=>{
   const closed=!!closedThrough&&m.month<=closedThrough&&m.month<=asOf,started=m.month<=asOf;
   // Open periods retain the unfulfilled plan. Recorded cash is counted exactly once.
   const remainingIncome=closed?0:Math.max(0,m.kups_income-m.actualSales),remainingCost=closed?0:Math.max(0,m.kups_cost-m.actualExpense);
   const forecastIncome=m.actualIncome+remainingIncome,forecastCost=m.actualExpense+remainingCost;
   cash+=forecastIncome-forecastCost+m.adjustment;
   return {...m,closed,started,remainingIncome,remainingCost,forecastIncome,forecastCost,forecastClosing:cash,salesVariance:m.actualSales-m.kups_income,costVariance:m.actualExpense-m.kups_cost,status:closed?'Bulan ditutup':started?'Berjalan · sisa rencana tetap dihitung':'Rencana'};
  });
 }
 function annual(months){const groups=new Map();for(const m of months){const year=m.month.slice(0,4);if(!groups.has(year))groups.set(year,{year,planIncome:0,planCost:0,planNpm:0,actualIncome:0,actualExpense:0,npmActual:0,forecastIncome:0,forecastCost:0});const a=groups.get(year);for(const [key,value] of Object.entries({planIncome:m.kups_income,planCost:m.kups_cost,planNpm:m.npm_cost,actualIncome:m.actualIncome,actualExpense:m.actualExpense,npmActual:m.npmActual,forecastIncome:m.forecastIncome,forecastCost:m.forecastCost}))a[key]+=value;a.planClosing=m.closing;a.forecastClosing=m.forecastClosing;}return [...groups.values()];}
 function publishedEvents(payload){const seen=new Set();return (payload?.features||[]).flatMap(f=>{const p=f.properties||{};if(p.targetLayerId!=='dayun_gawangan'||!/^DAYUN-GT-[A-F]-\d{2}$/.test(p.targetObjectId||''))return [];let info;try{info=typeof p.proposedInformation==='string'?JSON.parse(p.proposedInformation):p.proposedInformation;}catch{return [];}if(info?.monitoringType!=='Agroforestri Dayun')return [];const id=p.reportId||info.recordKey;if(!id||seen.has(id))return [];seen.add(id);return [{...info,id,objectId:p.targetObjectId,date:info.eventDate||p.activityDate}];});}
 function harvestRows(details,reconciliations,events=[]){
  const out=[],seen=new Set(),covered=new Set();
  for(const r of reconciliations||[]){for(const row of r.rows||[])covered.add([row.objectId,r.date,r.commodity].join('|'));const id=r.id||'harvest-'+r.date+'-'+r.commodity;if(seen.has(id))continue;seen.add(id);out.push({id,date:r.date,crop:r.commodity,objectId:'Rekap lintas gawangan',count:r.grossQuantityBeforeDeduction??r.quantityBeforeDeduction,unit:r.unit||'buah',reject:r.rejectQuantity??null,consumed:r.deduction??null,sold:r.sales?.soldQuantity??null,source:'Rekap panen'});}
  for(const o of details?.objects||[])for(const c of o.crops||[])for(const h of c.pineappleHarvest||[]){if(covered.has([o.objectId,h.period,c.crop].join('|')))continue;const id=[o.objectId,h.period,c.crop,h.cycle||'Panen utama',h.count].join('|');if(seen.has(id))continue;seen.add(id);out.push({id,date:h.period,crop:c.crop,objectId:o.objectId,count:Number(h.count),unit:'buah',source:'Riwayat gawangan'});}
  for(const e of events){if(e.activityType!=='Panen')continue;const d=e.activityDetails||{},count=Number(d.harvestCount??e.quantity);if(!Number.isFinite(count)||count<=0||covered.has([e.objectId,e.date,e.crop].join('|')))continue;const id=[e.objectId,e.date,e.crop,d.harvestCycle||'Panen utama',count].join('|');if(seen.has(id))continue;seen.add(id);out.push({id,date:e.date,crop:e.crop,objectId:e.objectId,count,unit:d.unit||e.unit||'buah',source:'Monitoring terpublikasi'});}
  return out.sort((a,b)=>String(b.date).localeCompare(String(a.date)));
 }
 return {periods,annual,publishedEvents,harvestRows};
});
