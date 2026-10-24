(function(root){
 'use strict';
 function rowsFor(d,object,block){return d.rows.filter(r=>(!object||r.objectId===object)&&(!block||r.block===block));}
 function totals(rows){return rows.reduce((a,r)=>({plants:a.plants+r.plants,newPlants:a.newPlants+r.newPlants,fruits:a.fruits+r.fruits,allocated:a.allocated+r.allocated}),{plants:0,newPlants:0,fruits:0,allocated:0});}
 const api={rowsFor,totals};if(typeof module==='object'&&module.exports)module.exports=api;root.YG_DAYUN_WORK_SUMMARY=api;
 if(typeof document==='undefined')return;const host=document.querySelector('[data-dayun-work-summary]');if(!host)return;
 const make=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;},num=v=>v.toLocaleString('id-ID');host.append(make('p','Memuat rekap nanas dan buah per gawangan…'));
 let busy=false,again=false,last='',timer=null,exportBusy=false;const status=make('p'),download=make('button','Unduh Excel terbaru (semua gawangan A–C)');status.setAttribute('role','status');host.append(status);
 async function getLive(fresh=false){const r=await fetch('https://yg-webgis-public-data.yg-webgis-public-data-worker.workers.dev/dayun/live-work-counts.json'+(fresh?'?refresh=1':''),{cache:'no-store',signal:AbortSignal.timeout(60000)});if(!r.ok)throw Error('HTTP '+r.status);const d=await r.json();if(d.schema!=='dayun-live-work-counts-v1'||!d.live||!Array.isArray(d.rows))throw Error('Invalid live summary');return d;}
 download.onclick=async()=>{if(exportBusy)return;exportBusy=true;download.disabled=true;download.textContent='Mengambil data terbaru dan membuat Excel…';try{const d=await getLive(true);accept(d);await root.YG_DAYUN_WORK_EXCEL.download(d);status.textContent='Excel seluruh gawangan dibuat dari data terbaru yang diperiksa '+new Date(d.checkedAt).toLocaleString('id-ID')+'.';}catch(e){status.textContent='Excel tidak diunduh: '+e.message+' Tidak memakai data lama.';}finally{exportBusy=false;download.disabled=false;download.textContent='Unduh Excel terbaru (semua gawangan A–C)';}};
 function render(data){
  const p=new URLSearchParams(location.search),all=host.dataset.dayunWorkSummary==='all',rows=rowsFor(data,all?null:p.get('object'),all?null:p.get('block'));host.replaceChildren();if(!rows.length){host.hidden=true;return;}
  const t=totals(rows);host.append(make('h2','Rekap otomatis nanas dan buah'),make('p','Mengikuti titik tim tersimpan terbaru. Titik di luar batas masuk ke gawangan tanam terdekat.'),make('p',num(t.plants)+' nanas · termasuk '+num(t.newPlants)+' nanas baru · '+num(t.fruits)+' buah tim'),download,status);
  const wrap=make('div'),table=make('table'),head=make('tr');wrap.style.overflowX='auto';table.style.width='100%';table.style.borderCollapse='collapse';['Gawangan','Jumlah nanas','Dari luar GT','Nanas baru','Buah tim','Tanam lama','Tanam baru'].forEach(x=>head.append(make('th',x)));table.append(head);
  for(const r of rows){const tr=make('tr'),cell=make('td'),link=make('a',r.zone);link.href='dayun-gawangan.html?object='+encodeURIComponent(r.objectId);cell.append(link);tr.append(cell);[num(r.plants),num(r.allocated),num(r.newPlants),num(r.fruits),r.plantingMonth||'Belum tercatat',r.newPlantingMonth||'—'].forEach(x=>tr.append(make('td',x)));table.append(tr);}
  const foot=make('tr');['TOTAL',num(t.plants),num(t.allocated),num(t.newPlants),num(t.fruits),'',''].forEach(x=>foot.append(make('th',x)));table.append(foot);table.querySelectorAll('th,td').forEach(n=>{n.style.padding='10px';n.style.borderBottom='1px solid #ddd';n.style.textAlign='left';});wrap.append(table);host.append(wrap,make('p','Setiap titik dihitung sekali. Nanas baru merupakan bagian dari total. Buah terhubung mengikuti tanaman induk; buah lainnya mengikuti posisi penandanya. Sensus dan geometri tidak diubah.'),make('p','Tanam baru B5–B8: Juli 2026. Tambahan posisi penyesuaian sensus tetap perkiraan. Diperbarui setelah penyimpanan dan setiap 15 detik saat halaman aktif.'));
 }
 function accept(d){const signature=JSON.stringify([d.rows,d.revisions]);if(signature!==last){render(d);last=signature;}}
 async function refresh(){if(busy){again=true;return;}busy=true;try{
  const d=await getLive();
  accept(d);status.textContent='Tersinkron '+new Date(d.checkedAt).toLocaleString('id-ID')+' · '+Object.entries(d.revisions).map(([b,r])=>b+': titik r'+r.plants+', buah r'+r.fruits).join(' · ');
 }catch{status.textContent=last?'Sinkronisasi gagal. Angka terakhir dipertahankan; mencoba kembali otomatis.':'Rekap otomatis belum tersedia. Mencoba kembali otomatis; tidak memakai snapshot.';}finally{busy=false;if(again){again=false;schedule();}}}
 function schedule(){clearTimeout(timer);timer=setTimeout(refresh,2500);}
 document.addEventListener('dayun:work-saved',()=>{status.textContent='Perubahan tersimpan; memperbarui rekap…';schedule();});
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')refresh();});root.addEventListener('online',refresh);
 setInterval(()=>{if(document.visibilityState!=='hidden')refresh();},15000);refresh();
})(typeof window!=='undefined'?window:globalThis);
