(function(){
'use strict';
function calculate(areaHa, spacing, rows, gap, excluded, reserve){
 if (![areaHa,spacing,rows,gap,excluded,reserve].every(Number.isFinite)||areaHa<0||spacing<=0||!Number.isInteger(rows)||rows<1||gap<spacing||excluded<0||excluded>100||reserve<0||reserve>100) throw Error('Periksa angka: jarak jalur minimal sama dengan jarak antarbaris; persentase 0–100.');
 const available=areaHa*10000*(1-excluded/100);
 const density=rows/(spacing*((rows-1)*spacing+gap));
 const plants=Math.floor(available*density+1e-8);
 const spare=Math.ceil(plants*reserve/100);
 return {plants,spare,total:plants+spare,effectiveHa:available*(rows*spacing/((rows-1)*spacing+gap))/10000};
}
function groupGawangan(features){
 const groups=new Map();
 features.forEach(f=>{
 const p=f.properties;
 if(p.category!=='Gawangan Tanam'||!/^Blok [DEF]$/.test(p.block))return;
 if(!p.objectId||!Number.isFinite(Number(p.areaHa))||Number(p.areaHa)<0)throw Error('Data gawangan tidak lengkap.');
 if(!groups.has(p.objectId))groups.set(p.objectId,{id:p.objectId,label:p.objectId.replace(/^DAYUN-/,''),block:p.block.slice(-1),area:0,geometries:[]});
 groups.get(p.objectId).area+=Number(p.areaHa);
 groups.get(p.objectId).geometries.push(f.geometry);
 });
 return [...groups.values()].sort((a,b)=>a.id.localeCompare(b.id,undefined,{numeric:true}));
}
if(typeof module!=='undefined') module.exports={calculate,groupGawangan};
if(typeof document==='undefined')return;
const form=document.getElementById('seed-form'), output=document.getElementById('seed-output');
const fmt=(n,d=0)=>n.toLocaleString('id-ID',{maximumFractionDigits:d});
let features=[],details=new Map(),estimates=new Map();
const initialBlock=new URLSearchParams(location.search).get('block');
if(['D','E','F'].includes(initialBlock)){form.elements.block.value=initialBlock;form.elements.mode.value='block';}
function syncControls(){
 const v=form.elements;
 v.gawangan.disabled=v.mode.value==='block';
 document.getElementById('seed-gawangan-field').hidden=v.mode.value==='block';
 v.angle.disabled=v.autoAngle.checked;
 v.rows.disabled=v.recommend.value!=='four';
 v.pathWidth.disabled=v.recommend.value==='none';
 v.leafClearance.disabled=v.recommend.value!=='four';
}
syncControls();
const esc=s=>String(s).replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));
const layout=window.DayunPlantingLayout.mount('seed-layout');
document.getElementById('layout-in').onclick=()=>layout.zoom(1.5);
document.getElementById('layout-out').onclick=()=>layout.zoom(1/1.5);
document.getElementById('layout-fit').onclick=()=>layout.fit();
function choices(){
 const v=form.elements, previous=v.gawangan.value;
 v.gawangan.replaceChildren(new Option('Semua gawangan pada wilayah terpilih','ALL'));
 features.filter(g=>v.block.value==='ALL'||g.block===v.block.value).forEach(g=>v.gawangan.add(new Option(g.label+' · '+fmt(g.area,4)+' ha',g.id)));
 if([...v.gawangan.options].some(o=>o.value===previous))v.gawangan.value=previous;
}
function render(){
 if(!features.length)return;
 try{
 if(!form.checkValidity()){output.textContent='Lengkapi pengaturan dengan angka yang valid.';layout.clear();document.getElementById('seed-mpts').textContent='';return;}
 const v=form.elements, spacing=Number(v.plantSpacing.value), rowSpacing=Number(v.rowSpacing.value), rows=Number(v.rows.value);
 const mode=v.recommend.value,cleanWidth=Number(v.pathWidth.value);
 const gap=mode==='four'?window.DayunPlantingLayout.harvestGap(cleanWidth,Number(v.leafClearance.value),rowSpacing):rowSpacing;
 const perBlock=v.mode.value==='block';
 const selected=features.filter(g=>(v.block.value==='ALL'||g.block===v.block.value)&&(perBlock||v.gawangan.value==='ALL'||g.id===v.gawangan.value));
 const layouts=[];
 const results=selected.map(g=>{
 const api=window.DayunPlantingLayout,estimate=estimates.get(g.id)||api.estimateMpts(g.geometries,(details.get(g.id)||{}).crops||[]);
 const rec=api.recommend(spacing,estimate,Number(v.treeRadius.value)),auto=mode==='mpts';
 const angle=v.autoAngle.checked?rec.angle:Number(v.angle.value),usedRows=mode==='four'?rows:1,usedGap=gap;
 const trees=estimate.trees.map(t=>t.point),radius=Number(v.treeRadius.value);
 const p=api.plan(g.geometries,spacing,usedRows,usedGap,angle,auto?0:Number(v.excluded.value),Number(v.margin.value),{trees,radius,rowSpacing,lanesEveryGroup:mode==='four'});
 let lanes;
 if(auto){
 const corridor=api.mptsCorridors(p,trees,radius,Number(v.pathWidth.value));
 const n=Math.ceil(corridor.active.length*Number(v.excluded.value)/100);
 p.active=corridor.active.slice(0,corridor.active.length-n);p.removed=corridor.active.slice(corridor.active.length-n);
 lanes={segments:corridor.segments,interrupted:corridor.interrupted,count:corridor.count};
 }else lanes=api.laneSegments(p,trees,radius+(mode==='four'?cleanWidth/2:0));
 g.planning={auto,mode,pathWidth:Number(v.pathWidth.value),corridors:lanes.count,estimate,rec,angle,rows:usedRows,gap:usedGap,interrupted:lanes.interrupted};
 // Common local metric frame keeps separate gawangan in their geographic positions.
 const world=q=>{const ll=p.unproject(q);return [(ll[0]-102)*111320*Math.cos(.5*Math.PI/180),(ll[1]-.5)*111320];};
 const polys=p.polys.map(poly=>poly.map(r=>r.map(world))),vertices=polys.flat(2);
 let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
 vertices.forEach(q=>{minX=Math.min(minX,q[0]);maxX=Math.max(maxX,q[0]);minY=Math.min(minY,q[1]);maxY=Math.max(maxY,q[1]);});
 layouts.push({corridorWidth:mode!=='none'?cleanWidth:0,label:g.label,polys,active:p.active.map(world),removed:p.removed.map(world),lanes:lanes.segments.map(line=>line.map(world)),trees:estimate.trees.map(t=>({point:world((()=>{const ll=t.point;const a=p.unproject([0,0]),b=p.unproject([1,0]),c=p.unproject([0,1]);const dx=ll[0]-a[0],dy=ll[1]-a[1],ux=b[0]-a[0],uy=b[1]-a[1],vx=c[0]-a[0],vy=c[1]-a[1],det=ux*vy-uy*vx;return [(dx*vy-dy*vx)/det,(ux*dy-uy*dx)/det];})()),crop:t.crop})),radius,minX,minY,maxX,maxY});
 const plants=p.active.length,spare=Math.ceil(plants*Number(v.reserve.value)/100);
 return {...g,plants,spare,total:plants+spare,effectiveHa:plants*spacing*rowSpacing/10000};
 });
 layout.show(layouts);
 document.getElementById('seed-mpts').innerHTML='<h3>Dasar MPTS dan usulan jalur per gawangan</h3><div class="table-scroll"><table><thead><tr><th>Gawangan</th><th>MPTS: sumber → estimasi layout</th><th>Usulan jalur yang diterapkan</th></tr></thead><tbody>'+selected.map(g=>{
 const p=g.planning;
 const text=p.estimate.summary.map(c=>c.missing?esc(c.crop)+': jarak belum tersedia':esc(c.crop)+' · '+fmt(c.spacing,2)+' × '+fmt(c.spacing,2)+' m (asumsi persegi); sumber '+(c.sourceCount===null?'belum ada jumlah':fmt(c.sourceCount,2))+' → '+c.placed+' titik'+(c.shortfall?' · selisih '+c.shortfall+' dari pembulatan sumber':'')).join('<br>')||'Data MPTS belum tersedia; ruang pohon belum diperhitungkan.';
 return '<tr><td>'+g.label+'</td><td style="white-space:normal;text-align:left;min-width:250px">'+text+'</td><td style="white-space:normal;text-align:left;min-width:230px">'+(p.auto?p.angle+'° · '+p.corridors+' jalur kosong di antara barisan MPTS · lebar '+fmt(p.pathWidth,2)+' m':p.mode==='four'?p.angle+'° · setiap '+p.rows+' baris · jalan bersih '+fmt(p.pathWidth,2)+' m · jarak pusat tanaman melintasi jalan '+fmt(p.gap,2)+' m':p.angle+'° · tanpa jalur panen')+(p.interrupted?'<br>Jalur terputus di ruang MPTS: perlu sambungan/penyesuaian lapangan.':'<br>Verifikasi sambungan ke akses kebun di lapangan.')+'</td></tr>';
 }).join('')+'</tbody></table></div>';
 const total=results.reduce((a,r)=>a+r.total,0);
 function row(label,r){return '<tr><td>'+label+'</td><td>'+fmt(r.area,4)+'</td><td>'+fmt(r.effectiveHa,4)+'</td><td>'+fmt(r.plants)+'</td><td>'+fmt(r.spare)+'</td><td>'+fmt(r.total)+'</td></tr>';}
 const displayRows=perBlock?['D','E','F'].filter(b=>results.some(r=>r.block===b)).map(b=>{
 const sum=results.filter(r=>r.block===b).reduce((a,r)=>{['area','effectiveHa','plants','spare','total'].forEach(k=>a[k]+=r[k]);return a;},{label:'Blok '+b,area:0,effectiveHa:0,plants:0,spare:0,total:0});
 return sum;
 }):results;
 const lines=displayRows.map(r=>row(r.label,r));
 function table(label,lines){return '<div class="table-scroll"><table><thead><tr><th>'+label+'</th><th>Luas (ha)</th><th>Efektif (ha)</th><th>Tanam</th><th>Sulaman</th><th>Total bibit</th></tr></thead><tbody>'+lines.join('')+'</tbody></table></div>';}
 output.innerHTML='<h2>Kebutuhan: '+fmt(total)+' bibit</h2><p>'+results.length+' gawangan · '+('Jarak '+fmt(spacing,2)+' × '+fmt(rowSpacing,2)+' m')+'. '+(mode==='four'?'Setiap '+rows+' baris: jalan bersih '+fmt(cleanWidth,2)+' m; jarak pusat tanaman melintasi jalan '+fmt(gap,2)+' m.':mode==='mpts'?'Jalur mengikuti barisan MPTS.':'Tanpa jalur panen.')+'</p><h3>Rincian per '+(perBlock?'blok':'gawangan')+'</h3>'+table(perBlock?'Blok':'Gawangan',lines);

 }catch(e){output.textContent=e.message;layout.clear();document.getElementById('seed-mpts').textContent='';}
}
let renderTimer;
form.addEventListener('input',(event)=>{
 const v=form.elements;
 if(event.target===v.block)choices();
 if(event.target===v.variety&&v.variety.value!=='custom'){v.plantSpacing.value=v.rowSpacing.value=v.variety.value;}
 if(event.target===v.plantSpacing||event.target===v.rowSpacing)v.variety.value='custom';
 syncControls();
 clearTimeout(renderTimer);renderTimer=setTimeout(render,180);
});
document.getElementById('seed-calculate').onclick=()=>{clearTimeout(renderTimer);syncControls();render();};
Promise.all([window.DayunDataSource.fetchJSON('data/dayun-map.geojson?v=20261004-mpts'),window.DayunDataSource.fetchJSON('data/dayun-gawangan-details.json?v=20261004-mpts')]).then(([data,mpts])=>{
 details=new Map(mpts.objects.map(o=>[o.objectId,o]));
 features=groupGawangan(data.features);
 if(!features.length)throw Error('Luas gawangan belum tersedia.');
 features.forEach(g=>estimates.set(g.id,window.DayunPlantingLayout.estimateMpts(g.geometries,(details.get(g.id)||{}).crops||[])));
 choices();
 render();
}).catch(()=>{output.textContent='Data luas gagal dimuat. Muat ulang halaman untuk mencoba kembali.';});
})();

