(function(root){
'use strict';
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function month(v){var m=/^(\d{4})-(\d{2})/.exec(v||'');return m&&+m[2]>=1&&+m[2]<=12?+m[1]*12+ +m[2]-1:null;}
function date(m){return Math.floor(m/12)+'-'+String(m%12+1).padStart(2,'0');}
function build(details,now){
var current=month(now),rows=[];
(details.objects||[]).forEach(function(o){(o.crops||[]).filter(function(c){return String(c.crop).toUpperCase()==='NANAS';}).forEach(function(c){
(c.plantingCohorts||[]).forEach(function(g){var start=month(g.period),n=Number(g.plantedCount);if(start===null||!(n>0))return;
[[3,'phase1','Pemupukan I'],[6,'phase2','Pemupukan II'],[8,'phase3','Pemupukan III'],[9,'ethrel','Pemeriksaan Ethrel']].forEach(function(a){var due=start+a[0];rows.push({id:o.objectId,block:o.block,cohort:g.period,count:n,month:date(due),kind:a[1],title:a[2],past:due<current,current:due===current});});
});
});});return rows;
}
function create(opts){
var el=document.getElementById('dayun-field-work');if(!el)return;
var now=new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Jakarta'}),rows=build(opts.details,now),kind='current',block='',reports=[],colorMode=false;
function realized(r){
var seen={},hits=0;
(reports.features||[]).forEach(function(f){var p=f.properties||{},i;try{i=typeof p.proposedInformation==='string'?JSON.parse(p.proposedInformation):p.proposedInformation;}catch(_){return;}
if(!i||p.targetLayerId!=='dayun_gawangan'||!/^\d{4}-\d{2}-\d{2}$/.test(i.eventDate||p.activityDate||'')||(i.eventDate||p.activityDate)>now||p.targetObjectId!==r.id||String(i.crop).toUpperCase()!=='NANAS'||i.cohortPeriod!==r.cohort)return;
var same=r.kind==='ethrel'?i.activityType==='Ethrel':i.activityType==='Pemupukan'&&i.fertilizer&&i.fertilizer.phaseId===r.kind;
var key=p.reportId||p.id||i.recordKey;if(same&&key&&!seen[key]){seen[key]=true;hits++;}});
return hits;
}
function paint(){
Object.keys(opts.layers||{}).forEach(function(id){
var jobs=rows.filter(function(r){return r.id===id&&(!block||r.block===block);}),unreported=jobs.filter(function(r){return !realized(r);});
var state=unreported.some(function(r){return r.past;})?'late':unreported.some(function(r){return r.current;})?'current':jobs.some(function(r){return realized(r)>0;})?'reported':jobs.length?'future':'unknown';
var color={late:'#dc2626',current:'#d97706',reported:'#2563eb',future:'#64748b',unknown:'#64748b'}[state];
(opts.layers[id]||[]).forEach(function(layer){if(!layer.setStyle)return;var p=layer.feature&&layer.feature.properties||{};if(p.category!=='Gawangan Tanam')return;
if(!colorMode){if(opts.style)layer.setStyle(opts.style(layer.feature));return;}
layer.setStyle({color:color,fillColor:color,fillOpacity:state==='unknown'?.04:.3,weight:2,dashArray:state==='unknown'?'5 5':null});
});
});
}
function draw(){
var view=rows.filter(function(r){return !block||r.block===block;});
if(kind==='current'){view=view.filter(function(r){return r.current;});}
else if(kind==='late'){view=view.filter(function(r){return r.past;});}
else if(kind==='next'){var by={};view.filter(function(r){return !r.past;}).sort(function(a,b){return a.month.localeCompare(b.month);}).forEach(function(r){var k=r.id+'|'+r.cohort;if(!by[k])by[k]=r;});view=Object.values(by);}
else view=view.filter(function(r){return kind==='ethrel'?r.kind==='ethrel':r.kind!=='ethrel';});
view.sort(function(a,b){return a.month.localeCompare(b.month)||a.id.localeCompare(b.id,undefined,{numeric:true});});
el.innerHTML='<div class="dy-section-head"><div><span>PEKERJAAN LAPANGAN</span><h2>Pekerjaan Lapangan · '+new Date(now+'T12:00:00+07:00').toLocaleDateString('id-ID',{month:'long',year:'numeric'})+'</h2></div><p>Pilih blok dan kegiatan. Jadwal dihitung dari bulan tanam; periksa realisasi sebelum menetapkan pekerjaan.</p></div><div class="dy-work-controls"><label>Blok <select data-work-block><option value="">Semua blok</option>'+['A','B','C','D','E','F'].map(function(b){return '<option'+(block===b?' selected':'')+'>'+b+'</option>';}).join('')+'</select></label><label>Jadwal / kegiatan <select data-work-kind>'+[['current','Bulan ini'],['late','Rencana lewat'],['next','Jadwal berikutnya'],['fert','Pemupukan'],['ethrel','Pemeriksaan Ethrel']].map(function(v){return '<option value="'+v[0]+'"'+(kind===v[0]?' selected':'')+'>'+v[1]+'</option>';}).join('')+'</select></label><label><input type="checkbox" data-work-color '+(colorMode?'checked':'')+'> Warna status pada peta</label><a class="dy-work-calculator" href="dayun-sop-nanas.html?gawangan='+encodeURIComponent(block?'BLOCK:'+block:'ALL')+'#kalkulator-pupuk"><strong>Kalkulator pupuk &amp; Ethrel</strong><small>'+(block?'Hitung kebutuhan Blok '+esc(block):'Hitung kebutuhan seluruh blok atau pilih gawangan')+' →</small></a></div><div class="dy-work-legend"><span>🔴 Rencana lewat</span><span>🟠 Bulan ini</span><span>🔵 Ada laporan</span><span>⚪ Mendatang / data belum tersedia</span></div><details class="dy-work-help"><summary>Dasar jadwal dan status</summary><p>Jadwal ini untuk kelompok tanaman baru. Jumlah bibit ditanam belum memastikan jumlah hidup. Ada laporan berarti cakupan perlu diperiksa, bukan otomatis selesai. Tanaman lama mengikuti riwayat gawangan; garis putus-putus pada peta berarti kelompok tanam belum tersedia.</p></details><p class="dy-work-recap">'+view.length+' jadwal · '+new Set(view.map(function(r){return r.id;})).size+' gawangan · '+view.reduce(function(s,r){return s+r.count;},0).toLocaleString('id-ID')+' tanaman sasaran tercatat'+(kind==='fert'?' (jumlah lintas aplikasi)':'')+'</p><div class="dy-table-wrap"><table class="dy-tech-table"><thead><tr><th>Gawangan / kelompok</th><th>Bibit ditanam</th><th>Kegiatan</th><th>Bulan rencana</th><th>Status</th><th>Tindakan</th></tr></thead><tbody>'+view.map(function(r){return '<tr><td><button type="button" data-work-object="'+esc(r.id)+'">'+esc(r.id.replace('DAYUN-GT-',''))+'</button><br>Tanam '+esc(r.cohort)+'</td><td>'+r.count.toLocaleString('id-ID')+'</td><td>'+r.title+'</td><td>'+r.month+'</td><td>'+(realized(r)?'Ada '+realized(r)+' realisasi terpublikasi · periksa cakupan':r.past?'Rencana lewat · periksa realisasi':r.current?'Bulan ini · periksa realisasi':'Rencana mendatang')+'</td><td><a href="dayun-sop-nanas.html?gawangan='+encodeURIComponent(r.id)+'&phase='+r.kind+'&plants='+r.count+'&cohort='+encodeURIComponent(r.cohort)+'#kalkulator-pupuk">Hitung bahan</a> · <a href="dayun-monitoring.html?object='+encodeURIComponent(r.id)+'&cohort='+encodeURIComponent(r.cohort)+'&phase='+r.kind+'">Catat kegiatan</a></td></tr>';}).join('')+'</tbody></table></div>'+(view.length?'':'<p>Tidak ada jadwal kelompok tanam pada pilihan ini. Pilih Jadwal berikutnya untuk melihat rencana mendatang; pemeriksaan rutin dan tanaman lama tetap perlu dicatat.</p>')+'<details><summary>Pemeriksaan rutin: gulma, HPT, sulam, dan panen</summary><p>Periksa gulma, gejala hama/penyakit, tanaman mati untuk sulam, serta kematangan buah. Kebutuhan tindakan ditetapkan dari pemeriksaan lapangan, bukan umur saja. Pilih gawangan pada peta lalu gunakan “Catat kegiatan”.</p></details>';
paint();el.querySelector('[data-work-color]').addEventListener('change',function(e){colorMode=e.target.checked;paint();});
el.querySelector('[data-work-block]').addEventListener('change',function(e){block=e.target.value;draw();});el.querySelector('[data-work-kind]').addEventListener('change',function(e){kind=e.target.value;draw();});
el.querySelectorAll('[data-work-object]').forEach(function(btn){btn.addEventListener('click',function(){var ls=opts.layers[btn.dataset.workObject]||[],bounds=L.latLngBounds([]);ls.forEach(function(l){bounds.extend(l.getBounds());});if(bounds.isValid()){opts.map.fitBounds(bounds,{padding:[30,30],maxZoom:19});ls[0].openPopup();document.getElementById('dayun-map').scrollIntoView({behavior:'smooth',block:'center'});}});});
}
draw();return {update:function(payload){reports=payload||[];draw();}};
}
root.DayunFieldWork={build:build,create:create};
})(typeof window==='undefined'?globalThis:window);