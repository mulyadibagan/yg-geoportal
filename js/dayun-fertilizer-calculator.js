(function(){
  "use strict";
  const form=document.getElementById("fertilizer-calculator");
  if(!form)return;
  const $=id=>document.getElementById(id);
  const number=id=>{const v=String($(id).value||"").replace(",",".");return Number(v)};
  const fmt=(v,d=1)=>new Intl.NumberFormat("id-ID",{maximumFractionDigits:d}).format(v);
  const modeInputs=form.querySelectorAll('input[name="population_mode"]');
  const manual=$("fert-manual-fields"), area=$("fert-area-fields");
  function syncMode(){
    const mode=form.querySelector('input[name="population_mode"]:checked').value;
    manual.hidden=mode!=="manual"; area.hidden=mode!=="area";
    $("fert-plant-count").required=mode==="manual";
    ["fert-area","fert-row-spacing","fert-plant-spacing"].forEach(id=>$(id).required=mode==="area");
    clearResult();
  }
  function clearResult(){
    $("fert-result").hidden=true;
    $("fert-error").hidden=true;
  }
  modeInputs.forEach(el=>el.addEventListener("change",syncMode));
  form.addEventListener("reset",()=>setTimeout(syncMode,0));
  form.addEventListener("input",clearResult);
  form.addEventListener("submit",ev=>{
    ev.preventDefault();
    const mode=form.querySelector('input[name="population_mode"]:checked').value;
    let plants;
    if(mode==="manual"){
      plants=number("fert-plant-count");
    }else{
      const hectares=number("fert-area"), row=number("fert-row-spacing"), plant=number("fert-plant-spacing");
      plants=(hectares*10000)/(row*plant);
    }
    const dose=number("fert-dose"), applications=number("fert-applications");
    const reserve=number("fert-reserve"), bag=number("fert-bag");
    const error=$("fert-error");
    if(![plants,dose,applications,reserve,bag].every(Number.isFinite)||plants<=0||dose<=0||applications<1||reserve<0||bag<=0){
      error.textContent="Lengkapi semua angka dengan nilai lebih dari nol. Cadangan boleh diisi 0%.";
      error.hidden=false; $("fert-result").hidden=true; return;
    }
    const roundedPlants=Math.floor(plants);
    const perApplication=roundedPlants*dose/1000;
    const cycle=perApplication*Math.floor(applications);
    const prepared=cycle*(1+reserve/100);
    const bags=prepared/bag;
    $("fert-result-plants").textContent=fmt(roundedPlants,0)+" tanaman";
    $("fert-result-application").textContent=fmt(perApplication,2)+" kg";
    $("fert-result-cycle").textContent=fmt(cycle,2)+" kg";
    $("fert-result-prepared").textContent=fmt(prepared,2)+" kg";
    $("fert-result-bags").textContent=fmt(bags,2)+" karung";
    $("fert-result-round").textContent=Math.ceil(bags)+" karung jika pembelian hanya dapat dilakukan per karung penuh.";
    $("fert-result-formula").textContent=fmt(roundedPlants,0)+" tanaman × "+fmt(dose,2)+" g × "+Math.floor(applications)+" aplikasi, ditambah cadangan "+fmt(reserve,1)+"%.";
    $("fert-result").hidden=false; error.hidden=true;
  });
  syncMode();
})();