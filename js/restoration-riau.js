(function(){
'use strict';
let mounted=false;
async function mount({session}) {
 if(mounted)return;
 const host=document.getElementById('riau-clusters');
 if(!host||!session?.token)return;
 mounted=true;
 host.hidden=false;
 host.textContent='Memuat hasil prioritas dan kluster wilayah Riau…';
 try {
  if(window.top!==window.self||location.hostname!=='webgisyg.id'||location.protocol!=='https:')throw Error('Origin tidak diizinkan');
  const response=await fetch('https://webgis-api.yayasangambut.org/api/staff/restoration-riau-dashboard',{headers:{authorization:'Bearer '+session.token},cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(45000)});
  if(!response.ok)throw Error('Data prioritas belum dapat dimuat (HTTP '+response.status+')');
  const payload=await response.json();
  if(window.YG_AUTH?.readStoredSession()?.token!==session.token)throw Error('Sesi staf berubah. Silakan login ulang.');
  if(payload.schema!=='yg-restoration-riau-v1'||payload.data?.units?.length!==733||payload.data?.cells?.length!==192||typeof payload.template!=='string'||typeof payload.style!=='string')throw Error('Paket prioritas tidak valid');
  const D=payload.data;
  host.textContent='';
  const root=host.attachShadow({mode:'open'});
  root.innerHTML='<style>'+payload.style+'</style>'+payload.template;
const $=id=>root.getElementById(id),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let level='kab',page=0,shown=[],vb=[],fitted=[],drag=null,moved=false;const ranks={P1:1,P2:2,P3:3,D:4,N:5};
function populate(id,values,label){const old=$(id).value;$(id).innerHTML='<option value="">'+label+'</option>'+[...new Set(values)].sort((a,b)=>a.localeCompare(b,'id')).map(v=>'<option>'+esc(v)+'</option>').join('');if(values.includes(old))$(id).value=old;}
function match(r){return ['kab','kec','desa'].every((k,i)=>!$(k).value||r[['kabupaten','kecamatan','desa'][i]]===$(k).value);}
function current(){return D.desa.filter(r=>match(r)&&(!$('tier').value||r.prioritas_kluster===$('tier').value));}
function children(){populate('kec',D.desa.filter(r=>!$('kab').value||r.kabupaten===$('kab').value).map(r=>r.kecamatan),'Semua kecamatan');populate('desa',D.desa.filter(r=>(!$('kab').value||r.kabupaten===$('kab').value)&&(!$('kec').value||r.kecamatan===$('kec').value)).map(r=>r.desa),'Semua desa/area');}
function setview(b){vb=b.slice();$('map').setAttribute('viewBox',vb.join(' '));}
function fit(shapes){let b=D.extent;if(shapes.length){const x=Math.min(...shapes.map(s=>s.bbox[0])),y=Math.min(...shapes.map(s=>s.bbox[1])),mx=Math.max(...shapes.map(s=>s.bbox[0]+s.bbox[2])),my=Math.max(...shapes.map(s=>s.bbox[1]+s.bbox[3]));b=[x,y,mx-x,my-y];}const w=Math.max(b[2],5),h=Math.max(b[3],5);setview([b[0]-w*.07,b[1]-h*.07,w*1.14,h*1.14]);}
function update(){page=0;const rows=current(),keys=new Set(rows.map(r=>JSON.stringify([r.kabupaten,r.kecamatan,r.desa]))),rels=D.relations.filter(r=>keys.has(JSON.stringify([r.kabupaten,r.kecamatan,r.desa]))),ids=new Set(rels.map(r=>r.unit_id)),cs=D.cellxy.filter(r=>keys.has(JSON.stringify([r.kabupaten,r.kecamatan,r.desa])));
 $('nUnit').textContent=!$('kab').value&&!$('kec').value&&!$('desa').value&&!$('tier').value?'733':ids.size;$('nCell').textContent=cs.length;$('nDesa').textContent=rows.length;$('nP1').textContent=rows.filter(r=>r.prioritas_kluster==='P1').length;
 $('detail').innerHTML='<h2>'+esc($('desa').value||$('kec').value||$('kab').value||'Seluruh Riau')+'</h2><p>'+rows.length+' kluster desa/area. '+cs.length+' pusat sel bukti setempat.</p><p>Pilih baris tabel untuk membuka rincian wilayah, atau klik poligon gambut untuk melihat bukti unit.</p><p>Warna poligon berlaku pada unit sumber utuh. Tekanan belum tentu berada di seluruh bagian unit atau seluruh desa yang beririsan. Garis biru menunjukkan batas wilayah pilihan, lingkaran kuning menunjukkan pusat sel.</p>';
 root.querySelectorAll('.unit').forEach(p=>p.style.opacity=ids.has(p.dataset.id)?'.9':'.06');
 fitted=D.vshape.filter(s=>keys.has(JSON.stringify(s.k)));const selected=!!($('kab').value||$('kec').value||$('desa').value);$('outlines').innerHTML=selected?fitted.map(s=>'<path class="outline" d="'+s.path+'"/>').join(''):'';
 $('cellShapes').innerHTML=cs.map(c=>'<circle class="cell" cx="'+c.xy[0]+'" cy="'+c.xy[1]+'" r="1.7"/>').join('');fit(selected||$('tier').value?fitted:[]);table();}
function table(){const fields=level==='kab'?['kabupaten']:level==='kec'?['kabupaten','kecamatan']:['kabupaten','kecamatan','desa'];const q=$('search').value.toLowerCase();shown=D[level].filter(r=>fields.every((f,i)=>!$(['kab','kec','desa'][i]).value||r[f]===$(['kab','kec','desa'][i]).value)&&(!$('tier').value||r.prioritas_kluster===$('tier').value)&&fields.some(f=>r[f].toLowerCase().includes(q)));shown.sort((a,b)=>ranks[a.prioritas_kluster]-ranks[b.prioritas_kluster]||b.sel_bukti_setempat-a.sel_bukti_setempat||b.unit_P2_beririsan-a.unit_P2_beririsan||b.unit_P3_beririsan-a.unit_P3_beririsan);
 $('thead').innerHTML=fields.map(f=>'<th>'+esc(f)+'</th>').join('')+'<th>Prioritas kluster</th><th class="numeric">Sel setempat</th><th class="numeric">Unit P1</th><th class="numeric">Unit P2</th><th class="numeric">Unit P3</th>';
 const start=page*50;$('tbody').innerHTML=shown.slice(start,start+50).map((r,i)=>'<tr data-row="'+(start+i)+'">'+fields.map(f=>'<td>'+esc(r[f])+'</td>').join('')+'<td><span class="badge '+r.prioritas_kluster+'">'+r.prioritas_kluster+'</span></td>'+['sel_bukti_setempat','unit_P1_beririsan','unit_P2_beririsan','unit_P3_beririsan'].map(f=>'<td class="numeric">'+r[f]+'</td>').join('')+'</tr>').join('');$('count').textContent=shown.length?`${start+1}–${Math.min(start+50,shown.length)} dari ${shown.length} kluster`:'Tidak ada hasil';$('prev').disabled=page===0;$('next').disabled=(page+1)*50>=shown.length;
 root.querySelectorAll('[data-level]').forEach(b=>b.classList.toggle('active',b.dataset.level===level));}
populate('kab',D.desa.map(r=>r.kabupaten),'Seluruh Riau');children();update();
for(const id of ['kab','kec','desa','tier'])$(id).onchange=()=>{if(id==='kab'){$('kec').value='';$('desa').value='';children();level='kec';}if(id==='kec'){$('desa').value='';children();level='desa';}if(id==='desa')level='desa';update();};
root.querySelectorAll('[data-level]').forEach(b=>b.onclick=()=>{level=b.dataset.level;if(level==='kab'){$('kec').value='';$('desa').value='';}if(level==='kec')$('desa').value='';children();update();});$('search').oninput=()=>{page=0;table();};$('prev').onclick=()=>{page--;table();};$('next').onclick=()=>{page++;table();};
$('reset').onclick=()=>{for(const id of ['kab','kec','desa','tier','search'])$(id).value='';children();level='kab';update();};
$('tbody').onclick=e=>{const tr=e.target.closest('tr');if(!tr)return;const r=shown[+tr.dataset.row];$('kab').value=r.kabupaten;children();if(r.kecamatan){$('kec').value=r.kecamatan;children();}if(r.desa)$('desa').value=r.desa;level=r.desa?'desa':r.kecamatan?'desa':'kec';update();$('detail').innerHTML='<h2>'+esc(r.desa||r.kecamatan||r.kabupaten)+'</h2><p>'+esc([r.kabupaten,r.kecamatan,r.desa].filter(Boolean).join(' / '))+'</p><dl><dt>Prioritas kluster</dt><dd>'+r.prioritas_kluster+'</dd><dt>Sel bukti setempat</dt><dd>'+r.sel_bukti_setempat+'</dd><dt>Unit P1 beririsan</dt><dd>'+r.unit_P1_beririsan+'</dd><dt>Unit P2 beririsan</dt><dd>'+r.unit_P2_beririsan+'</dd><dt>Unit P3 beririsan</dt><dd>'+r.unit_P3_beririsan+'</dd></dl><p>Hitungan unit menunjukkan konteks wilayah. Sel bukti menunjukkan lokasi pusat sel. Periksa identitas admin dan kondisi lapangan sebelum menentukan tindakan.</p>';};
$('unitShapes').onclick=e=>{if(moved)return;const id=e.target.dataset.id,u=D.units.find(x=>x.unit_id===id);if(!u)return;$('detail').innerHTML='<h2>'+esc(id)+'</h2><p><span class="badge '+u.prioritas+'">'+u.prioritas+'</span></p><p>'+esc(u.alasan)+'</p><dl>'+[['Api 2015–2017',u.api_2015_17],['Kanal arsip',u.kanal_arsip],['Loss 2018–2025',u.loss_18_25],['Sel bukti di unit',u.sel_bukti],['Kelas gambut',u.kelas_gbt],['Prioritas final',u.prioritas_final]].map(([a,b])=>'<dt>'+esc(a)+'</dt><dd>'+esc(b)+'</dd>').join('')+'</dl><p>Unit sumber utuh. Prioritas tidak otomatis berlaku pada seluruh bagian poligon. Jumlah sel bukan luas restorasi.</p>';};
$('download').onclick=()=>{if(!shown.length)return;const cols=Object.keys(shown[0]),quote=v=>'"'+String(v??'').replace(/^[=+@-]/,"'$&").replaceAll('"','""')+'"',csv='\ufeff'+[cols,...shown.map(r=>cols.map(k=>r[k]))].map(r=>r.map(quote).join(',')).join('\r\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='Prioritas_Restorasi_Riau_'+level+'_20261116.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};

function zoom(f){setview([vb[0]+vb[2]*(1-f)/2,vb[1]+vb[3]*(1-f)/2,vb[2]*f,vb[3]*f]);}$('zin').onclick=()=>zoom(.7);$('zout').onclick=()=>zoom(1.4);$('fit').onclick=()=>fit(($('kab').value||$('kec').value||$('desa').value||$('tier').value)?fitted:[]);
$('map').onpointerdown=e=>{moved=false;drag={x:e.clientX,y:e.clientY,b:vb.slice()};};$('map').onpointermove=e=>{if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.abs(dx)+Math.abs(dy)>5)moved=true;const box=$('map').getBoundingClientRect(),scale=Math.max(drag.b[2]/box.width,drag.b[3]/box.height);setview([drag.b[0]-dx*scale,drag.b[1]-dy*scale,drag.b[2],drag.b[3]]);};window.addEventListener('pointerup',()=>{drag=null;});$('map').onwheel=e=>{e.preventDefault();zoom(e.deltaY>0?1.2:.85);};

 } catch(error) {
  host.textContent=error.message+'. Muat ulang halaman untuk mencoba kembali.';
  mounted=false;
 }
}
window.YG_RESTORATION_RIAU={mount};
})();
