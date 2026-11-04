const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('public milestones exclude older phase final reports and preserve verified monitoring',()=>{
 const donor=require('../data/donors.json').find(d=>d.id==='DNR-ARAMCO'),programme=donor.programs.find(p=>p.id==='PRG-ARAMCO-PHASE-03');let section;
 const content={querySelector:()=>section||null,appendChild:s=>{section=s;}};
 const source=fs.readFileSync('js/donor-evidence-summary.js','utf8'),start=source.indexOf('  function renderMilestones('),end=source.indexOf('  function applyDonorEvidence()',start);
 const context=vm.createContext({document:{querySelector:()=>({querySelector:()=>content}),createElement:()=>({})},donorMap:{'Aramco Asia Singapore':{modal:'#aramco-dashboard'}},programmeForDonor:()=>programme,donorForName:()=>donor,esc:s=>String(s??''),statusFor:(done,target)=>({text:done>=target?'Completed':done?'In Progress':'Planned',cls:''}),outputName:r=>r.indicatorLabel?.split(' → ')[0]||'',evidenceDestination:r=>({href:r.evidenceUrl,label:'Open evidence',external:false}),displayPeriod:()=>programme.period,readStaffSession:()=>null});
 vm.runInContext(source.slice(start,end),context);context.renderMilestones('Aramco Asia Singapore',donor.verifiedEvidence);
 for(const [name,status]of [['Mangrove Rehabilitation','4/4 terverifikasi · Completed'],['Capacity Building','3/3 terverifikasi · Completed'],['Protection &amp; Monitoring','2/2 terverifikasi · Completed'],['Reporting','1/2 terverifikasi · In Progress']])assert(section.innerHTML.includes('<span>'+name.replace('&amp;','&')+'</span><b>'+status),name+' status incorrect');
 assert(!section.innerHTML.includes('Final Report Fase I'));assert(section.innerHTML.includes('not submitted'));
 const ids=new Set(require('../data/master-database-snapshot.json').features.map(f=>f.properties.Object_ID));for(const r of require('../data/aramco-phase3-final.json').monitoring.verifiedRecords)assert(ids.has(r.id));
});
test('profile retains separate milestone tags on one verified monitoring report',()=>{
 const donor=require('../data/donors.json').find(d=>d.id==='DNR-ARAMCO'),programme=donor.programs.find(p=>p.id==='PRG-ARAMCO-PHASE-03'),source=fs.readFileSync('js/aramco-dashboard.js','utf8');
 const c=vm.createContext({seededEvidence:donor.verifiedEvidence,liveEvidence:[],esc:s=>String(s??''),publicCopy:s=>s,normalize:s=>String(s||'').toLowerCase()});
 vm.runInContext(source.slice(source.indexOf('  function combinedEvidence()'),source.indexOf('  function renderEvidence(')),c);
 vm.runInContext(source.slice(source.indexOf('  function outputMarkup('),source.indexOf('  function flattenEvidence(')),c);
 for(const [id,count]of [['OUT-ARAMCO-P3-01','4/4'],['OUT-ARAMCO-P3-03','3/3'],['OUT-ARAMCO-P3-06','2/2'],['OUT-ARAMCO-P3-07','1/2']])assert(c.outputMarkup(programme.outputs.find(o=>o.id===id),programme.targets).includes(count+' verified'),id);
});
