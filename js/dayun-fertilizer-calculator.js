(function(){
  "use strict";
  const actualForm=document.getElementById("fertilizer-calculator");
  if(!actualForm)return;
  const $=id=>document.getElementById(id);
  const fmt=(v,d=2)=>new Intl.NumberFormat("id-ID",{maximumFractionDigits:d}).format(v);
  const number=id=>Number(String($(id).value||"").replace(",","."));
  const programs={
    base:{name:"Pemupukan dasar",time:"7 hari sebelum tanam atau saat tanam",note:"Pupuk organik 5–10 ton/ha.",materials:[{name:"Pupuk organik",min:5000,max:10000}]},
    phase1:{name:"Pemupukan I",time:"Akar mulai terlihat, sekitar 3 BST",note:"Urea 300–400 kg/ha dan NPK 15-15-15 100–200 kg/ha.",materials:[{name:"Urea",min:300,max:400},{name:"NPK 15-15-15",min:100,max:200}]},
    phase2:{name:"Pemupukan II",time:"1 bulan sebelum induksi pembungaan",note:"Urea 300 kg/ha dan NPK 15-15-15 150–200 kg/ha.",materials:[{name:"Urea",min:300,max:300},{name:"NPK 15-15-15",min:150,max:200}]},
    phase3:{name:"Pemupukan III",time:"Setelah bunga keluar",note:"NPK 15-15-15 50–150 kg/ha.",materials:[{name:"NPK 15-15-15",min:50,max:150}]}
  };
  function phase(){return programs[$("fert-phase").value]}
  function syncPhase(){$("fert-phase-note").textContent=phase().note;clearResult()}
  function clearResult(){$("fert-result").hidden=true;$("fert-error").hidden=true}
  $("fert-phase").addEventListener("change",syncPhase);
  actualForm.addEventListener("input",clearResult);
  actualForm.addEventListener("reset",()=>setTimeout(syncPhase,0));
  actualForm.addEventListener("submit",ev=>{
    ev.preventDefault();
    const area=number("fert-area"),reserve=number("fert-reserve"),bag=number("fert-bag");
    const plantsRaw=String($("fert-plant-count").value||"").trim();
    const plants=plantsRaw?number("fert-plant-count"):null;
    const error=$("fert-error");
    if(!Number.isFinite(area)||area<=0||!Number.isFinite(reserve)||reserve<0||reserve>25||!Number.isFinite(bag)||bag<=0||(plants!==null&&(!Number.isFinite(plants)||plants<1))){
      error.textContent="Isi luas gawangan dengan benar. Populasi bersifat opsional; cadangan 0–25%.";
      error.hidden=false;return;
    }
    const p=phase(),factor=1+reserve/100;
    $("fert-result-phase").textContent=p.name;
    $("fert-result-phase-label").textContent=p.time;
    $("fert-result-context").textContent=fmt(area,3)+" ha"+(plants?" · "+fmt(Math.floor(plants),0)+" tanaman aktif":"");
    $("fert-material-results").innerHTML=p.materials.map(m=>{
      const low=m.min*area,high=m.max*area,prepLow=low*factor,prepHigh=high*factor;
      const dose=plants?((low*1000/plants).toFixed(2)+(low===high?"":"–"+(high*1000/plants).toFixed(2))+" g/tanaman"):"Isi populasi untuk dosis/tanaman";
      const packs=prepLow/bag===prepHigh/bag?fmt(prepLow/bag,2):fmt(prepLow/bag,2)+"–"+fmt(prepHigh/bag,2);
      const need=low===high?fmt(low,2)+" kg":fmt(low,2)+"–"+fmt(high,2)+" kg";
      const prepared=prepLow===prepHigh?fmt(prepLow,2)+" kg":fmt(prepLow,2)+"–"+fmt(prepHigh,2)+" kg";
      return '<article><header><span>'+m.name+'</span><small>'+fmt(m.min,0)+(m.min===m.max?'':'–'+fmt(m.max,0))+' kg/ha</small></header><strong>'+need+'</strong><p>Kebutuhan sesuai luas</p><dl><div><dt>Per tanaman</dt><dd>'+dose+'</dd></div><div><dt>Dengan cadangan</dt><dd>'+prepared+'</dd></div><div><dt>Setara kemasan</dt><dd>'+packs+' kemasan</dd></div></dl></article>';
    }).join("");
    $("fert-result-formula").textContent="Perhitungan: dosis SOP (kg/ha) × "+fmt(area,3)+" ha"+(reserve?" × "+fmt(factor,3)+" untuk pengadaan dengan cadangan.":". Cadangan pengadaan tidak ditambahkan.");
    $("fert-result").hidden=false;error.hidden=true;
  });
  syncPhase();
})();