(function(){
  "use strict";
  const programs={
    phase1:{name:"Pemupukan I",time:"Bulan ke-3 setelah tanam",note:"Urea 3 kg + Cu/terusi 1 SDM per 600 tanaman.",materials:[{id:"urea",name:"Urea",amount:3,unit:"kg"},{id:"cu",name:"Cu/terusi",amount:1,unit:"SDM"}]},
    phase2:{name:"Pemupukan II",time:"Bulan ke-6 setelah tanam",note:"Urea 3 kg + Cu/terusi 1 SDM per 600 tanaman.",materials:[{id:"urea",name:"Urea",amount:3,unit:"kg"},{id:"cu",name:"Cu/terusi",amount:1,unit:"SDM"}]},
    phase3:{name:"Pemupukan III",time:"Bulan ke-8 setelah tanam",note:"Urea 2 kg + Cu/terusi 1 SDM + KCl 0,5 kg per 600 tanaman.",materials:[{id:"urea",name:"Urea",amount:2,unit:"kg"},{id:"cu",name:"Cu/terusi",amount:1,unit:"SDM"},{id:"kcl",name:"KCl",amount:0.5,unit:"kg"}]},
    cycle:{name:"Total tiga aplikasi",time:"Bulan ke-3, ke-6, dan ke-8",note:"Urea 8 kg + Cu/terusi 3 SDM + KCl 0,5 kg per 600 tanaman. Tidak termasuk campuran Ethrel.",materials:[{id:"urea",name:"Urea",amount:8,unit:"kg"},{id:"cu",name:"Cu/terusi",amount:3,unit:"SDM"},{id:"kcl",name:"KCl",amount:0.5,unit:"kg"}]}
  };
  window.YG_DAYUN_NANAS_FERTILIZER_PROGRAMS=programs;
  const actualForm=document.getElementById("fertilizer-calculator");
  if(!actualForm)return;
  const $=id=>document.getElementById(id);
  const fmt=(v,d=2)=>new Intl.NumberFormat("id-ID",{maximumFractionDigits:d}).format(v);
  const number=id=>Number(String($(id).value||"").replace(",","."));
  let gawangan={};
  let selectedArea=0;
  let populations={};
  let populationStatus="Memuat data tanaman…";
  const populationNote=$("fert-plant-count").nextElementSibling;
  function jsonp(url){return new Promise(function(resolve,reject){var callback='ygDayunPublic_'+Date.now()+'_'+Math.floor(Math.random()*100000),script=document.createElement('script'),timer=setTimeout(function(){cleanup();reject(Error('Data kegiatan belum dapat dimuat.'));},9000);function cleanup(){clearTimeout(timer);script.remove();try{delete window[callback];}catch(_){}}window[callback]=function(data){cleanup();resolve(data);};script.onerror=function(){cleanup();reject(Error('Data kegiatan belum dapat dimuat.'));};script.src=url+'&callback='+encodeURIComponent(callback)+'&t='+Date.now();document.head.appendChild(script);});}

  function count(value){return value!==null&&value!==undefined&&value!==""&&Number.isFinite(Number(value))&&Number(value)>=0?Math.round(Number(value)):null}
  function syncPopulation(){
    const item=populations[$("fert-gawangan").value];
    $("fert-plant-count").value=item?item.count:"";
    $("fert-plant-count").readOnly=false;
    populationNote.textContent=item?item.label+" · "+item.date:populationStatus;
  }
  function refresh(){clearResult();if(selectedArea>0)calculate()}
  function loadPopulation(){
    fetch("data/dayun-gawangan-details.json",{cache:"no-store"}).then(r=>{if(!r.ok)throw Error();return r.json()}).then(data=>{
      (data.objects||[]).forEach(record=>{
        const crop=(record.crops||[]).find(c=>String(c.crop).toUpperCase()==="NANAS");
        if(!crop)return;
        const census=crop.populationCensus;
        const verified=census&&count(census.livingPlantCount)!==null;
        const value=count(verified?census.livingPlantCount:crop.vegetationCount);
        if(value!==null)populations[record.objectId]={count:value,label:verified?"Sensus terpublikasi":"Data sementara",date:verified?census.period:(data.updatedAt||"").slice(0,10)};
      });
      populationStatus="Data nanas belum tersedia untuk gawangan ini; isi jumlah tanaman acuan.";
      syncPopulation();refresh();
    }).catch(()=>{populationStatus="Data tanaman gagal dimuat; isi manual atau muat ulang halaman.";syncPopulation();refresh()}).then(()=>{
      return jsonp("https://script.google.com/macros/s/AKfycbxUe4QyBvSiL9UJsL-nsJ5XrohDabwqhYYR9q5CTgLYiW1ZCfVy429iMlpU-lCDUSvvRg/exec?page=public-reports").then(payload=>{
        (payload.features||[]).map(f=>{
          const p=f.properties||{};let info;
          try{info=typeof p.proposedInformation==="string"?JSON.parse(p.proposedInformation):p.proposedInformation||{}}catch(_){return null}
          const value=count((info.activityDetails||{}).livingPlantCount);
          if(p.targetLayerId!=="dayun_gawangan"||info.monitoringType!=="Agroforestri Dayun"||String(info.crop).toUpperCase()!=="NANAS"||info.activityType!=="Sensus tanaman"||value===null)return null;
          return {id:p.targetObjectId,count:value,date:info.eventDate||p.activityDate||"",publishedAt:p.publishedAt||""};
        }).filter(Boolean).sort((a,b)=>(a.date+" "+a.publishedAt).localeCompare(b.date+" "+b.publishedAt)).forEach(item=>{
          const previous=populations[item.id];
          if(!item.date||previous&&previous.label==="Sensus terpublikasi"&&previous.date>item.date)return;
          populations[item.id]={count:item.count,label:"Sensus terpublikasi",date:item.date};
        });
        syncPopulation();refresh();
      }).catch(()=>{populationNote.textContent+=" · Pembaruan sensus belum dapat diperiksa."});
    });
  }
  function phase(){return programs[$("fert-phase").value]}
  function syncPhase(){$("fert-phase-note").textContent=phase().note;refresh()}
  function syncGawangan(){
    const item=gawangan[$("fert-gawangan").value];
    selectedArea=item?item.areaHa:0;
    $("fert-area").value=item?fmt(item.areaHa,4):"—";
    syncPopulation();refresh();
  }
  function loadGawangan(){
    fetch("data/dayun-map.geojson",{cache:"no-store"}).then(r=>{if(!r.ok)throw new Error("Data gawangan tidak dapat dimuat.");return r.json()}).then(data=>{
      const grouped={};
      (data.features||[]).filter(f=>f.properties&&f.properties.category==="Gawangan Tanam"&&Number(f.properties.areaHa)>0).forEach(f=>{const p=f.properties,id=p.objectId;if(!grouped[id])grouped[id]={id:id,label:p.shortId||p.displayId||id,areaHa:0};grouped[id].areaHa=Number(p.sourceGawanganAreaHa||grouped[id].areaHa+Number(p.areaHa||0));});
      const items=Object.values(grouped).sort((a,b)=>a.label.localeCompare(b.label,undefined,{numeric:true}));
      gawangan={};items.forEach(x=>gawangan[x.id]=x);
      const select=$("fert-gawangan");select.innerHTML='<option value="">Pilih gawangan</option>'+items.map(x=>'<option value="'+x.id+'">'+x.label+' · '+fmt(x.areaHa,4)+' ha</option>').join("");
      select.disabled=false;
      const requested=(new URLSearchParams(location.search).get("gawangan")||new URLSearchParams(location.search).get("object"));
      if(requested&&gawangan[requested]){select.value=requested;syncGawangan()}
    }).catch(()=>{
      $("fert-gawangan").innerHTML='<option value="">Data gawangan belum tersedia</option>';
      $("fert-error").textContent="Luas gawangan gagal dimuat. Muat ulang halaman atau buka kembali dari peta Dayun.";
      $("fert-error").hidden=false;
    });
  }
  function clearResult(){$("fert-result").hidden=true;$("fert-error").hidden=true}
  $("fert-phase").addEventListener("change",syncPhase);
  $("fert-gawangan").addEventListener("change",syncGawangan);
  actualForm.addEventListener("input",refresh);
  actualForm.addEventListener("reset",()=>setTimeout(()=>{syncGawangan();syncPhase()},0));
  actualForm.addEventListener("submit",ev=>{ev.preventDefault();calculate()});
  function calculate(){
    clearResult();
    const area=selectedArea,reserve=number("fert-reserve"),bag=number("fert-bag");
    const plantsRaw=String($("fert-plant-count").value??"").trim();
    const plants=plantsRaw?number("fert-plant-count"):null;
    const error=$("fert-error");
    if(!Number.isFinite(area)||area<=0||!Number.isFinite(reserve)||reserve<0||reserve>25||!Number.isFinite(bag)||bag<=0||(plants===null||!Number.isFinite(plants)||plants<0||!Number.isInteger(plants))){
      error.textContent=area<=0?"Pilih gawangan tanam terlebih dahulu.":"Periksa populasi, cadangan, dan berat kemasan.";
      error.hidden=false;return;
    }
    const p=phase(),factor=1+reserve/100;
    $("fert-result-phase").textContent=p.name;
    $("fert-result-phase-label").textContent=p.time;
    $("fert-result-context").textContent=fmt(area,3)+" ha"+(plants?" · "+fmt(Math.floor(plants),0)+" tanaman acuan":"");
    $("fert-material-results").innerHTML=p.materials.map(m=>{
      const need=m.amount*plants/600,prepared=need*factor;
      const perPlant=m.unit==="kg"?fmt(m.amount*1000/600,3)+" g/tanaman":fmt(m.amount,0)+" SDM per 600 tanaman; berat gram belum diverifikasi";
      const packs=m.unit==="kg"?fmt(prepared/bag,3)+" sak ("+fmt(bag,1)+" kg/sak)":"Belum dihitung; timbang SDM dalam gram";
      return '<article><header><span>'+m.name+'</span><small>'+fmt(m.amount,2)+' '+m.unit+' / 600 tanaman</small></header><strong>'+fmt(need,3)+' '+m.unit+'</strong><p>Kebutuhan berdasarkan tanaman sasaran</p><dl><div><dt>Acuan bahan</dt><dd>'+perPlant+'</dd></div><div><dt>Dengan cadangan pengadaan</dt><dd>'+fmt(prepared,3)+' '+m.unit+'</dd></div><div><dt>Setara kemasan</dt><dd>'+packs+'</dd></div></dl></article>';
    }).join("");
    $("fert-result-formula").textContent="Perhitungan: "+fmt(plants,0)+" tanaman ÷ 600 × bahan acuan"+(reserve?" × "+fmt(factor,3)+" untuk pengadaan dengan cadangan.":". Cadangan pengadaan tidak ditambahkan.")+" Campuran Ethrel tidak termasuk. Takaran SDM dan pengenceran perlu diverifikasi.";
    $("fert-result").hidden=false;error.hidden=true;
  }
  syncPhase();
  loadGawangan();
  loadPopulation();
})();
