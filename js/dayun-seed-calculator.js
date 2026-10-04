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
 if(!groups.has(p.objectId))groups.set(p.objectId,{id:p.objectId,label:p.objectId.replace(/^DAYUN-/,''),block:p.block.slice(-1),area:0});
 groups.get(p.objectId).area+=Number(p.areaHa);
 });
 return [...groups.values()].sort((a,b)=>a.id.localeCompare(b.id,undefined,{numeric:true}));
}
if(typeof module!=='undefined') module.exports={calculate,groupGawangan};
if(typeof document==='undefined')return;
const form=document.getElementById('seed-form'), output=document.getElementById('seed-output');
const fmt=(n,d=0)=>n.toLocaleString('id-ID',{maximumFractionDigits:d});
let features=[];
function choices(){
 const v=form.elements, previous=v.gawangan.value;
 v.gawangan.replaceChildren(new Option('Semua gawangan pada wilayah terpilih','ALL'));
 features.filter(g=>v.block.value==='ALL'||g.block===v.block.value).forEach(g=>v.gawangan.add(new Option(g.label+' · '+fmt(g.area,4)+' ha',g.id)));
 if([...v.gawangan.options].some(o=>o.value===previous))v.gawangan.value=previous;
}
function render(){
 if(!features.length)return;
 try{
 if(!form.checkValidity()){output.textContent='Lengkapi pengaturan dengan angka yang valid.';return;}
 const v=form.elements, spacing=Number(v.variety.value), rows=Number(v.rows.value);
 const gap=v.lanes.checked?Number(v.gap.value):spacing;
 const perBlock=v.mode.value==='block';
 const selected=features.filter(g=>(v.block.value==='ALL'||g.block===v.block.value)&&(perBlock||v.gawangan.value==='ALL'||g.id===v.gawangan.value));
 const results=selected.map(g=>({...g,...calculate(g.area,spacing,rows,gap,Number(v.excluded.value),Number(v.reserve.value))}));
 const total=results.reduce((a,r)=>a+r.total,0);
 function row(label,r){return '<tr><td>'+label+'</td><td>'+fmt(r.area,4)+'</td><td>'+fmt(r.effectiveHa,4)+'</td><td>'+fmt(r.plants)+'</td><td>'+fmt(r.spare)+'</td><td>'+fmt(r.total)+'</td></tr>';}
 const displayRows=perBlock?['D','E','F'].filter(b=>results.some(r=>r.block===b)).map(b=>{
 const sum=results.filter(r=>r.block===b).reduce((a,r)=>{['area','effectiveHa','plants','spare','total'].forEach(k=>a[k]+=r[k]);return a;},{label:'Blok '+b,area:0,effectiveHa:0,plants:0,spare:0,total:0});
 return sum;
 }):results;
 const lines=displayRows.map(r=>row(r.label,r));
 function table(label,lines){return '<div class="table-scroll"><table><thead><tr><th>'+label+'</th><th>Luas (ha)</th><th>Efektif (ha)</th><th>Tanam</th><th>Sulaman</th><th>Total bibit</th></tr></thead><tbody>'+lines.join('')+'</tbody></table></div>';}
 output.innerHTML='<h2>Kebutuhan: '+fmt(total)+' bibit</h2><p>'+results.length+' gawangan · '+(spacing===0.8?'Queen · 80 × 80 cm':'Madu · 1,2 × 1,2 m')+'. Pengaturan berlaku untuk semua gawangan yang ditampilkan.</p><h3>Rincian per '+(perBlock?'blok':'gawangan')+'</h3>'+table(perBlock?'Blok':'Gawangan',lines);

 }catch(e){output.textContent=e.message;}
}
form.addEventListener('input',(event)=>{
 const v=form.elements;
 if(event.target===v.block)choices();
 v.gawangan.disabled=v.mode.value==='block';
 document.getElementById('seed-gawangan-field').hidden=v.mode.value==='block';
 v.rows.disabled=v.gap.disabled=!v.lanes.checked;
 v.gap.min=v.variety.value;
 if(Number(v.gap.value)<Number(v.variety.value))v.gap.value=v.variety.value;
 render();
});
window.DayunDataSource.fetchJSON('data/dayun-map.geojson?v=20261004-seed').then(data=>{
 features=groupGawangan(data.features);
 if(!features.length)throw Error('Luas gawangan belum tersedia.');
 choices();
 render();
}).catch(()=>{output.textContent='Data luas gagal dimuat. Muat ulang halaman untuk mencoba kembali.';});
})();