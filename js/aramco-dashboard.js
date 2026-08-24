(function(){
  'use strict';
  var DONOR_FILE='data/donors.json?v=20260808-penabulu-plan-evidence1';
  var DONOR_API='https://yg-webgis-public-data-staging.yg-webgis-public-data-worker.workers.dev/api/donor/programmes';
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function text(id,value){var el=document.getElementById(id);if(el)el.textContent=value;}
  function active(program){return /^(aktif|berjalan|direncanakan)$/i.test(String(program.status||'').trim());}
  function metricMarkup(row){return '<article><strong>'+esc(row.value||'—')+'</strong><span>'+esc(row.label||'')+'</span></article>';}
  function locationMarkup(name,index){var region=/tanjung kuras/i.test(name)?'Kabupaten Siak':'Kabupaten Bengkalis';return '<a class="aramco-location-card" href="webgis.html?search='+encodeURIComponent(name)+'"><small>Lokasi '+(index+1)+'</small><strong>'+esc(name)+'</strong><span>'+esc(region)+' · buka di peta →</span></a>';}
  function phaseMarkup(p){var on=active(p);return '<article class="aramco-phase-card'+(on?' is-active':'')+'"><header><strong>'+esc(p.phase||p.name||'Fase')+'</strong><em>'+esc(on?'AKTIF':(p.status||'SELESAI').toUpperCase())+'</em></header><p>'+esc(p.period||'')+(p.summary?' · '+esc(p.summary):'')+'</p></article>';}
  function targetItems(targets){var rows=[['rehabilitationAreaHa','ha','Target rehabilitasi'],['mangroveTrees',' pohon','Target penanaman'],['waveBreakerMeters',' m','Wave breaker'],['communityNurseries',' unit','Rumah bibit'],['learningExchangeParticipants',' orang','Peserta learning exchange'],['learningExchangeDays',' hari','Durasi learning exchange']];return rows.filter(function(r){return targets&&targets[r[0]]!=null;}).map(function(r){return '<article class="aramco-target"><strong>'+esc(targets[r[0]])+esc(r[1])+'</strong><span>'+esc(r[2])+'</span></article>';}).join('');}
  function outputMarkup(output){var acts=(output.activities||[]).map(function(a){return '<li>'+esc(a.name||'')+(a.indicator?' — '+esc(a.indicator):'')+'</li>';}).join('');return '<article class="aramco-output"><h3>'+esc(output.name||'Output program')+'</h3><ul>'+acts+'</ul></article>';}
  function flattenEvidence(payload){var out=[];function walk(v){if(!v)return;if(Array.isArray(v)){v.forEach(walk);return;}if(typeof v!=='object')return;var donor=String(v.donorName||v.donor||v.funder||v.partner||'');var title=v.evidenceTitle||v.title||v.name||'';var id=v.evidenceId||v.reportId||v.id||'';if(/aramco/i.test(donor)||/aramco/i.test(String(v.programmeName||v.program||v.indicatorLabel||''))){if(title||id)out.push(v);}Object.keys(v).forEach(function(k){if(typeof v[k]==='object')walk(v[k]);});}walk(payload);var seen={};return out.filter(function(r){var k=String(r.evidenceId||r.reportId||r.id||r.evidenceTitle||r.title||Math.random());if(seen[k])return false;seen[k]=1;return true;});}
  function renderEvidence(rows){text('aramco-evidence-count',rows.length?rows.length+' evidence terverifikasi':'Evidence mengikuti data terverifikasi');var list=document.getElementById('aramco-evidence-list');if(!list)return;if(!rows.length){list.innerHTML='';return;}var latest=rows.slice().sort(function(a,b){return String(b.activityDate||b.verifiedAt||b.date||'').localeCompare(String(a.activityDate||a.verifiedAt||a.date||''));}).slice(0,6);list.innerHTML=latest.map(function(r){var date=r.activityDateLabel||r.verifiedAtLabel||r.activityDate||r.verifiedAt||'';var title=r.evidenceTitle||r.title||r.name||r.evidenceId||r.reportId||'Evidence program';return '<article class="aramco-evidence-card"><small>'+esc(date||'Terverifikasi')+'</small><strong>'+esc(title)+'</strong></article>';}).join('');}
  function render(donor){
    text('aramco-focus',donor.focus||'Restorasi mangrove dan pelibatan masyarakat pesisir');
    text('aramco-period',donor.period||'2023–2026');
    text('aramco-location-count',(donor.locations||[]).length+' desa');
    var metrics=document.getElementById('aramco-metrics');if(metrics)metrics.innerHTML=(donor.indicators||[]).map(metricMarkup).join('');
    var locations=document.getElementById('aramco-locations');if(locations)locations.innerHTML=(donor.locations||[]).map(locationMarkup).join('');
    var phases=document.getElementById('aramco-phases');if(phases)phases.innerHTML=(donor.programs||[]).map(phaseMarkup).join('');
    var phase=(donor.programs||[]).find(active)||(donor.programs||[]).slice(-1)[0]||{};
    text('aramco-active-title',(phase.phase||'Fase aktif')+' · '+(phase.period||''));
    text('aramco-active-summary',phase.summary||'Rincian fase aktif mengikuti data program Aramco pada YG GeoPortal.');
    var targets=document.getElementById('aramco-targets');if(targets)targets.innerHTML=targetItems(phase.targets||{});
    var outputs=document.getElementById('aramco-outputs');if(outputs)outputs.innerHTML=(phase.outputs||[]).map(outputMarkup).join('');
    text('aramco-updated','Data program terhubung · '+new Intl.DateTimeFormat('id-ID',{day:'numeric',month:'short',year:'numeric'}).format(new Date()));
  }
  document.addEventListener('DOMContentLoaded',function(){
    fetch(DONOR_FILE,{cache:'no-store'}).then(function(r){if(!r.ok)throw new Error('donors');return r.json();}).then(function(rows){var donor=(rows||[]).find(function(d){return d.slug==='aramco'||/Aramco Asia Singapore/i.test(d.name||'');});if(!donor)throw new Error('aramco');render(donor);}).catch(function(){text('aramco-updated','Data program belum dapat dimuat');});
    fetch(DONOR_API,{cache:'no-store'}).then(function(r){if(!r.ok)throw new Error('api');return r.json();}).then(function(data){renderEvidence(flattenEvidence(data));}).catch(function(){renderEvidence([]);});
  });
})();
