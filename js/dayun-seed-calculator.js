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
if(typeof module!=='undefined') module.exports={calculate};
if(typeof document==='undefined')return;
const form=document.getElementById('seed-form'), output=document.getElementById('seed-output');
const fmt=(n,d=0)=>n.toLocaleString('id-ID',{maximumFractionDigits:d});
let features=[];
function render(){
 if(!features.length)return;
 try{
 if(!form.checkValidity()){output.textContent='Lengkapi pengaturan dengan angka yang valid.';return;}
 const v=form.elements, spacing=Number(v.variety.value), rows=Number(v.rows.value);
 const gap=v.lanes.checked?Number(v.gap.value):spacing;
 const blocks=v.block.value==='ALL'?['D','E','F']:[v.block.value];
 let total=0;
 const lines=blocks.map(b=>{
 const area=features.filter(f=>f.properties.block==='Blok '+b).reduce((s,f)=>s+Number(f.properties.areaHa),0);
 const r=calculate(area,spacing,rows,gap,Number(v.excluded.value),Number(v.reserve.value));total+=r.total;
 return '<tr><td>Blok '+b+'</td><td>'+fmt(area,4)+'</td><td>'+fmt(r.effectiveHa,4)+'</td><td>'+fmt(r.plants)+'</td><td>'+fmt(r.spare)+'</td><td>'+fmt(r.total)+'</td></tr>';
 });
 output.innerHTML='<h2>Kebutuhan: '+fmt(total)+' bibit</h2><p>Estimasi rencana '+(spacing===0.8?'Queen · 80 × 80 cm':'Madu · 1,2 × 1,2 m')+'.</p><div class="table-scroll"><table><thead><tr><th>Blok</th><th>Gawangan (ha)</th><th>Efektif (ha)</th><th>Tanam</th><th>Sulaman</th><th>Total bibit</th></tr></thead><tbody>'+lines.join('')+'</tbody></table></div>';
 }catch(e){output.textContent=e.message;}
}
form.addEventListener('input',()=>{
 const v=form.elements;
 v.rows.disabled=v.gap.disabled=!v.lanes.checked;
 v.gap.min=v.variety.value;
 if(Number(v.gap.value)<Number(v.variety.value))v.gap.value=v.variety.value;
 render();
});
window.DayunDataSource.fetchJSON('data/dayun-map.geojson?v=20261004-seed').then(data=>{
 features=data.features.filter(f=>f.properties.category==='Gawangan Tanam'&&/^Blok [DEF]$/.test(f.properties.block));
 if(!features.length||features.some(f=>!Number.isFinite(Number(f.properties.areaHa))))throw Error('Luas gawangan belum tersedia.');
 render();
}).catch(()=>{output.textContent='Data luas gagal dimuat. Muat ulang halaman untuk mencoba kembali.';});
})();