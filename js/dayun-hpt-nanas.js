(function(){
"use strict";
const form=document.getElementById("hpt-calculator");
if(!form)return;
const $=id=>document.getElementById(id);
const fmt=(v,d=2)=>new Intl.NumberFormat("id-ID",{maximumFractionDigits:d}).format(v);
let areas={};
function sync(){
  const a=areas[$("hpt-gawangan").value];
  $("hpt-area").value=a?fmt(a,4)+" ha":"—";
  $("hpt-result").hidden=true;
}
$("hpt-gawangan").addEventListener("change",sync);
form.addEventListener("reset",()=>setTimeout(sync,0));
form.addEventListener("submit",e=>{
  e.preventDefault();
  const inspected=Number($("hpt-inspected").value),affected=Number($("hpt-affected").value);
  const type=$("hpt-type").value,g=$("hpt-gawangan").value,error=$("hpt-error");
  if(!g||!type||!Number.isFinite(inspected)||inspected<1||!Number.isFinite(affected)||affected<0||affected>inspected){
    error.textContent="Pilih gawangan dan gejala, lalu pastikan jumlah bergejala tidak melebihi jumlah yang diperiksa.";
    error.hidden=false;return;
  }
  const pct=affected/inspected*100;
  let action=pct===0?"Belum ditemukan pada sampel. Lanjutkan pengamatan rutin.":pct<=5?"Temuan terbatas. Tandai titik, lakukan tindakan awal, dan periksa tanaman sekitar.":pct<=20?"Temuan perlu perhatian. Pendamping menilai sebaran dan menetapkan tindakan satu gawangan.":"Temuan meluas. Batasi perpindahan bahan dan alat, dokumentasikan, dan lakukan pemeriksaan pendamping segera.";
  $("hpt-percent").textContent=fmt(pct,1)+"%";
  $("hpt-summary").textContent=type+" · "+g+" · "+fmt(areas[g],4)+" ha · "+fmt(affected,0)+" dari "+fmt(inspected,0)+" tanaman";
  $("hpt-action").textContent=action;
  $("hpt-result").hidden=false;error.hidden=true;
});
fetch("data/dayun-map.geojson?v=20260910-3").then(r=>{if(!r.ok)throw new Error();return r.json()}).then(data=>{
  const items=data.features.filter(f=>f.properties&&f.properties.category==="Gawangan Tanam").map(f=>({id:f.properties.objectId,label:f.properties.shortId,area:Number(f.properties.areaHa)})).sort((a,b)=>a.label.localeCompare(b.label,undefined,{numeric:true}));
  areas={};items.forEach(x=>areas[x.id]=x.area);
  const s=$("hpt-gawangan");
  s.innerHTML='<option value="">Pilih gawangan</option>'+items.map(x=>'<option value="'+x.id+'">'+x.label+' · '+fmt(x.area,4)+' ha</option>').join("");
  s.disabled=false;
  const q=new URLSearchParams(location.search).get("gawangan");
  if(q&&areas[q]){s.value=q;sync()}
}).catch(()=>{
  $("hpt-error").textContent="Data gawangan belum dapat dimuat. Muat ulang halaman.";
  $("hpt-error").hidden=false;
});
})();