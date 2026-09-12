(function(){
"use strict";
const form=document.getElementById("hpt-calculator");
if(!form)return;
const $=id=>document.getElementById(id);
const fmt=(v,d=2)=>new Intl.NumberFormat("id-ID",{maximumFractionDigits:d}).format(v);
let areas={};
const guides={
  "Uret":{id:"hpt-uret",action:"Buka zona akar secara terbatas, kumpulkan larva secara manual, tandai titik temuan, lalu periksa tanaman di sekelilingnya."},
  "Kutu putih":{id:"hpt-kutu-putih",action:"Periksa pangkal dan akar, tandai koloninya, kendalikan semut, serta pisahkan tanaman dengan serangan berat."},
  "Kerusakan tikus":{id:"hpt-tikus",action:"Petakan jalur aktif, singkirkan tempat berlindung, panen buah matang tepat waktu, dan pasang perangkap mekanis yang diperiksa setiap hari."},
  "Layu nanas":{id:"hpt-layu",action:"Tandai tanaman, periksa kutu putih pada pangkal dan akar, serta hentikan perpindahan bibit dari titik bergejala."},
  "Busuk pangkal / busuk hitam":{id:"hpt-busuk-hitam",action:"Pisahkan bahan yang membusuk, bersihkan alat, hentikan pemindahan bibit atau buah sakit, dan catat sumber bibitnya."},
  "Busuk akar / busuk hati":{id:"hpt-busuk-hati",action:"Tandai titik basah, periksa daun muda dan pangkal, isolasi tanaman bergejala berat, serta cegah genangan tanpa membuat drainase dalam."}
};
function sync(){
  const a=areas[$("hpt-gawangan").value];
  $("hpt-area").value=a?fmt(a,4)+" ha":"—";
  $("hpt-result").hidden=true;
  $("hpt-guide-link").hidden=true;
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
  const guide=guides[type];
  const level=pct===0?"Belum ditemukan pada sampel. Lanjutkan pengamatan rutin.":pct<=5?"Temuan terbatas.":pct<=20?"Temuan perlu perhatian dan penilaian satu gawangan.":"Temuan meluas; lakukan pemeriksaan pendamping segera.";
  const action=guide&&pct>0?level+" Tindakan awal: "+guide.action:level;
  $("hpt-percent").textContent=fmt(pct,1)+"%";
  $("hpt-summary").textContent=type+" · "+g+" · "+fmt(areas[g],4)+" ha · "+fmt(affected,0)+" dari "+fmt(inspected,0)+" tanaman";
  $("hpt-action").textContent=action;
  const link=$("hpt-guide-link");
  if(guide){link.href="#"+guide.id;link.hidden=false}else{link.href="#hpt-guide-title";link.hidden=true}
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
