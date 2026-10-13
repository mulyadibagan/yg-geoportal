(function(){
  "use strict";
  const programs={
    phase1:{name:"Pemupukan I",time:"Bulan ke-3 setelah tanam",note:"Urea 3 kg + Cu/terusi 1 SDM / 16 gram per 600 tanaman.",materials:[{id:"urea",name:"Urea",amount:3,unit:"kg"},{id:"cu",name:"Cu/terusi",amount:16,unit:"g"}]},
    phase2:{name:"Pemupukan II",time:"Bulan ke-6 setelah tanam",note:"Urea 3 kg + Cu/terusi 1 SDM / 16 gram per 600 tanaman.",materials:[{id:"urea",name:"Urea",amount:3,unit:"kg"},{id:"cu",name:"Cu/terusi",amount:16,unit:"g"}]},
    phase3:{name:"Pemupukan III",time:"Bulan ke-8 setelah tanam",note:"Urea 2 kg + Cu/terusi 1 SDM / 16 gram + KCl 0,5 kg per 600 tanaman.",materials:[{id:"urea",name:"Urea",amount:2,unit:"kg"},{id:"cu",name:"Cu/terusi",amount:16,unit:"g"},{id:"kcl",name:"KCl",amount:0.5,unit:"kg"}]},
    cycle:{name:"Total tiga aplikasi",time:"Bulan ke-3, ke-6, dan ke-8",note:"Urea 8 kg + Cu/terusi 3 SDM / 48 gram + KCl 0,5 kg per 600 tanaman. Tidak termasuk campuran Ethrel.",materials:[{id:"urea",name:"Urea",amount:8,unit:"kg"},{id:"cu",name:"Cu/terusi",amount:48,unit:"g"},{id:"kcl",name:"KCl",amount:0.5,unit:"kg"}]}
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
  function selectedMembers(){
    const id=$("fert-gawangan").value;
    if(id==="ALL")return Object.values(gawangan);
    if(id.startsWith("BLOCK:"))return Object.values(gawangan).filter(x=>x.block===id.slice(6));
    return gawangan[id]?[gawangan[id]]:[];
  }
  const requestedParams=new URLSearchParams(location.search);
  const requestedPlants=requestedParams.get("plants");
  const requestedPhase=requestedParams.get("phase");
  if(requestedPhase&&(programs[requestedPhase]||requestedPhase==="ethrel"))$("fert-phase").value=requestedPhase;
  function syncPopulation(){
    const members=selectedMembers(),aggregate=$("fert-gawangan").value==="ALL"||$("fert-gawangan").value.startsWith("BLOCK:");
    if(aggregate){
      const known=members.filter(x=>populations[x.id]),missing=members.filter(x=>!populations[x.id]);
      $("fert-plant-count").value=known.length?known.reduce((sum,x)=>sum+populations[x.id].count,0):"";
      populationNote.textContent=known.length+"/"+members.length+" gawangan memiliki data populasi"+(missing.length?" · Belum tersedia: "+missing.map(x=>x.label).join(", "):"")+" · Total berdasarkan data tersedia; periksa tanaman hidup dan sasaran aplikasi.";
    }else{
      const item=populations[$("fert-gawangan").value];
      $("fert-plant-count").value=item?item.count:"";
      populationNote.textContent=item?item.label+" · "+item.date:populationStatus;
    }
    if(requestedPlants!==null&&requestedParams.get("gawangan")===$("fert-gawangan").value&&/^\d+$/.test(requestedPlants)){
      $("fert-plant-count").value=Number(requestedPlants);populationNote.textContent="Kelompok tanam "+(requestedParams.get("cohort")||"pilihan")+" · jumlah sasaran dari jadwal; periksa tanaman hidup.";
    }
    $("fert-plant-count").readOnly=false;
  }
  function refresh(){clearResult();if(selectedArea>0)calculate()}
  function loadPopulation(){
    fetch("data/dayun-gawangan-details.json",{cache:"no-store"}).then(r=>{if(!r.ok)throw Error();return r.json()}).then(data=>{
      (data.objects||[]).forEach(record=>{
        const crop=(record.crops||[]).find(c=>String(c.crop).toUpperCase()==="NANAS");
        if(!crop)return;
        const census=crop.populationCensus;
        const verified=census&&count(census.livingPlantCount)!==null;
        const pop=window.DayunAgroSummary.population(crop);
        const value=count(pop.planning);
        if(value!==null)populations[record.objectId]={count:value,label:verified?"Sensus hidup + tambahan setelah sensus":"Total sumber awal + tambahan tanam (belum sensus hidup)",date:verified?census.period:(data.updatedAt||"").slice(0,10)};
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
  function syncPhase(){
    const ethrel=$("fert-phase").value==="ethrel";
    $("fert-ethrel-fields").hidden=!ethrel;
    $("fert-phase-note").textContent=ethrel?"Bulan ke-9 jika tanaman siap. Ethrel 10 ml (2 tutup × 5 ml) + KCl 0,5 kg + air 16 liter per 600 tanaman.":phase().note;
    refresh();
  }
  function syncGawangan(){
    const members=selectedMembers();
    selectedArea=members.reduce((sum,x)=>sum+x.areaHa,0);
    $("fert-area").value=members.length?fmt(selectedArea,4):"—";
    syncPopulation();refresh();
  }
  function loadGawangan(){
    fetch("data/dayun-map.geojson",{cache:"no-store"}).then(r=>{if(!r.ok)throw new Error("Data gawangan tidak dapat dimuat.");return r.json()}).then(data=>{
      const grouped={};
      (data.features||[]).filter(f=>f.properties&&f.properties.category==="Gawangan Tanam"&&Number(f.properties.areaHa)>0).forEach(f=>{const p=f.properties,id=p.objectId;if(!grouped[id])grouped[id]={id:id,label:p.shortId||p.displayId||id,areaHa:0,block:(String(p.shortId||p.displayId||id).match(/GT-([A-F])-/)||[])[1]||""};grouped[id].areaHa=Number(p.sourceGawanganAreaHa||grouped[id].areaHa+Number(p.areaHa||0));});
      const items=Object.values(grouped).sort((a,b)=>a.label.localeCompare(b.label,undefined,{numeric:true}));
      gawangan={};items.forEach(x=>gawangan[x.id]=x);
      const select=$("fert-gawangan");select.innerHTML='<option value="">Pilih gawangan atau blok</option><optgroup label="Rekap blok"><option value="ALL">Seluruh blok A–F</option>'+['A','B','C','D','E','F'].map(b=>'<option value="BLOCK:'+b+'">Blok '+b+' · '+items.filter(x=>x.block===b).length+' gawangan</option>').join('')+'</optgroup><optgroup label="Per gawangan">'+items.map(x=>'<option value="'+x.id+'">'+x.label+' · '+fmt(x.areaHa,4)+' ha</option>').join("")+'</optgroup>';
      select.disabled=false;
      const requested=(new URLSearchParams(location.search).get("gawangan")||new URLSearchParams(location.search).get("object"));
      if(requested&&(gawangan[requested]||requested==="ALL"||/^BLOCK:[A-F]$/.test(requested))){select.value=requested;syncGawangan()}
    }).catch(()=>{
      $("fert-gawangan").innerHTML='<option value="">Data gawangan belum tersedia</option>';
      $("fert-error").textContent="Luas gawangan gagal dimuat. Muat ulang halaman atau buka kembali dari peta Dayun.";
      $("fert-error").hidden=false;
    });
  }
  function clearResult(){$("fert-block-detail").hidden=true;$("fert-result").hidden=true;$("fert-error").hidden=true}
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
    if($("fert-phase").value==="ethrel"){calculateEthrel(plants,area,reserve,bag);return;}
    const p=phase(),factor=1+reserve/100;
    $("fert-result-phase").textContent=p.name;
    $("fert-result-phase-label").textContent=p.time;
    $("fert-result-context").textContent=fmt(area,3)+" ha"+(plants?" · "+fmt(Math.floor(plants),0)+" tanaman acuan":"");
    $("fert-material-results").innerHTML=p.materials.map(m=>{
      const need=m.amount*plants/600,prepared=need*factor;
      const perPlant=m.unit==="kg"?fmt(m.amount*1000/600,3)+" g/tanaman":fmt(m.amount/600,3)+" g/tanaman";
      const packs=m.unit==="kg"?fmt(prepared/bag,3)+" sak ("+fmt(bag,1)+" kg/sak)":fmt(prepared/1000,3)+" kg terusi (1 SDM = 16 gram)";
      return '<article><header><span>'+m.name+'</span><small>'+(m.id==='cu'?fmt(m.amount/16,2)+' SDM / '+fmt(m.amount,2)+' gram':fmt(m.amount,2)+' '+m.unit)+' / 600 tanaman</small></header><strong>'+fmt(need,3)+' '+m.unit+'</strong><p>Kebutuhan berdasarkan tanaman sasaran</p><dl><div><dt>Acuan bahan</dt><dd>'+perPlant+'</dd></div><div><dt>Dengan cadangan pengadaan</dt><dd>'+fmt(prepared,3)+' '+m.unit+'</dd></div><div><dt>Setara kemasan</dt><dd>'+packs+'</dd></div></dl></article>';
    }).join("");
    const applications=$("fert-phase").value==="cycle"?3:1;
    const batches=plants/600,water=16*batches*applications;
    $("fert-material-results").innerHTML+='<article><header><span>Air · pemupukan</span><small>16 liter / 600 tanaman per aplikasi</small></header><strong>'+fmt(water,3)+' liter</strong><p>'+applications+' aplikasi pemupukan</p><dl><div><dt>Air per aplikasi</dt><dd>'+fmt(16*batches,3)+' liter</dd></div><div><dt>Setara tangki 16 liter</dt><dd>'+fmt(batches*applications,3)+' tangki; bagian akhir proporsional</dd></div><div><dt>Cadangan</dt><dd>Tidak menambah air atau dosis aplikasi</dd></div></dl></article>';
    $("fert-result-formula").textContent="Perhitungan: "+fmt(plants,0)+" tanaman ÷ 600 × bahan acuan"+(reserve?" × "+fmt(factor,3)+" untuk pengadaan dengan cadangan.":". Cadangan pengadaan tidak ditambahkan.")+" Campuran Ethrel tidak termasuk. Acuan terusi: 1 SDM = 16 gram. Pengenceran mengikuti arahan pendamping.";
    renderBlockDetail();
    $("fert-result").hidden=false;error.hidden=true;
  }
  function calculateEthrel(plants,area,reserve,bag){
    const cap=number("fert-cap-ml"),coverage=number("fert-batch-plants"),water=number("fert-batch-water"),bottle=number("fert-bottle-ml");
    if(![cap,coverage,water,bottle].every(v=>Number.isFinite(v)&&v>0)||!Number.isInteger(coverage)){
      $("fert-error").textContent="Isi volume satu tutup (ml), jumlah tanaman per campuran, air per campuran, dan isi botol Ethrel. Gunakan hasil pengukuran atau data lapangan terverifikasi.";
      $("fert-error").hidden=false;return;
    }
    const batches=plants/coverage,ethrel=2*cap*batches,kcl=0.5*batches,air=water*batches,factor=1+reserve/100;
    if(![batches,ethrel,kcl,air,ethrel*factor,kcl*factor].every(Number.isFinite)){
      $("fert-error").textContent="Angka terlalu besar untuk dihitung; periksa parameter campuran."; $("fert-error").hidden=false;return;
    }
    $("fert-result-phase").textContent="Induksi bunga · Ethrel";
    $("fert-result-phase-label").textContent="Bulan ke-9 setelah tanam · tanaman siap";
    $("fert-result-context").textContent=fmt(area,3)+" ha · "+fmt(plants,0)+" tanaman sasaran";
    const cards=[
      {name:"Ethrel",basis:"2 tutup × "+fmt(cap,3)+" ml / "+fmt(coverage,0)+" tanaman",need:fmt(ethrel,3)+" ml",per:fmt(2*cap/coverage,4)+" ml/tanaman",prepared:fmt(ethrel*factor,3)+" ml",packs:fmt(ethrel*factor/bottle,3)+" botol setara; beli "+fmt(Math.ceil(ethrel*factor/bottle),0)+" botol ("+fmt(bottle,1)+" ml)"},
      {name:"KCl · campuran Ethrel",basis:"0,5 kg / "+fmt(coverage,0)+" tanaman",need:fmt(kcl,3)+" kg",per:fmt(500/coverage,3)+" g/tanaman",prepared:fmt(kcl*factor,3)+" kg",packs:fmt(kcl*factor/bag,3)+" sak ("+fmt(bag,1)+" kg/sak)"},
      {name:"Air · campuran Ethrel",basis:fmt(water,3)+" liter / "+fmt(coverage,0)+" tanaman",need:fmt(air,3)+" liter",per:fmt(water*1000/coverage,3)+" ml air/tanaman",prepared:fmt(air,3)+" liter (tanpa cadangan)",packs:fmt(batches,3)+" campuran setara; campuran terakhir dihitung proporsional"}
    ];
    $("fert-material-results").innerHTML=cards.map(m=>'<article><header><span>'+m.name+'</span><small>'+m.basis+'</small></header><strong>'+m.need+'</strong><p>Kebutuhan berdasarkan isian campuran</p><dl><div><dt>Acuan per tanaman</dt><dd>'+m.per+'</dd></div><div><dt>Pengadaan</dt><dd>'+m.prepared+'</dd></div><div><dt>Setara kemasan/campuran</dt><dd>'+m.packs+'</dd></div></dl></article>').join("");
    $("fert-result-formula").textContent="Perhitungan: "+fmt(plants,0)+" ÷ "+fmt(coverage,0)+" = "+fmt(batches,3)+" campuran setara. Ethrel = campuran × 2 × "+fmt(cap,3)+" ml; KCl = campuran × 0,5 kg; air = campuran × "+fmt(water,3)+" liter. Rasio isian Ethrel terhadap air: "+fmt(2*cap/water,3)+" ml/liter, bukan rekomendasi konsentrasi. Cadangan "+fmt(reserve,1)+"% hanya untuk pengadaan Ethrel dan KCl. KCl ini terpisah dari pemupukan bulan ke-8.";
    renderBlockDetail();
    $("fert-result").hidden=false;$("fert-error").hidden=true;
  }
  function renderBlockDetail(){
    const members=selectedMembers(),container=$("fert-block-detail");
    if(members.length<=1){container.hidden=true;return;}
    const ethrel=$("fert-phase").value==="ethrel",p=phase();
    const cols=ethrel?["Ethrel (ml)","KCl (kg)","Air (liter)"]:p.materials.map(m=>m.name+" ("+m.unit+")").concat(["Air (liter)"]);
    const coverage=ethrel?number("fert-batch-plants"):600;
    const amounts=ethrel?[2*number("fert-cap-ml"),0.5,number("fert-batch-water")]:p.materials.map(m=>m.amount).concat([$("fert-phase").value==="cycle"?48:16]);
    const known=members.filter(x=>populations[x.id]),sourceTotal=known.reduce((sum,x)=>sum+populations[x.id].count,0),missing=members.length-known.length;
    const rows=members.map(x=>{
      const item=populations[x.id];
      const values=item?amounts.map(v=>'<td>'+fmt(item.count/coverage*v,3)+'</td>').join(""):cols.map(()=>'<td>—</td>').join("");
      return '<tr><td>'+x.label+'</td><td>'+fmt(x.areaHa,4)+'</td><td>'+(item?fmt(item.count,0):'Belum tersedia')+'</td>'+values+'<td>'+(item?item.label+" · "+item.date:"Belum tersedia")+'</td></tr>';
    }).join("");
    const totals=amounts.map(v=>'<td>'+fmt(sourceTotal/coverage*v,3)+'</td>').join("");
    container.innerHTML='<h3>Rincian per gawangan</h3><p>'+known.length+' dari '+members.length+' gawangan memiliki populasi.'+(missing?' Total sebagian; '+missing+' gawangan belum dihitung.':'')+' Rincian memakai populasi sumber tanpa cadangan. Untuk Ethrel, populasi ini belum memastikan semua tanaman siap induksi.'+(number("fert-plant-count")!==sourceTotal?' Jumlah sasaran pada kartu telah diubah; rincian berikut tetap memakai populasi sumber.':'')+'</p><div class="dy-table-wrap"><table class="dy-tech-table"><thead><tr><th>Gawangan</th><th>Luas (ha)</th><th>Tanaman</th>'+cols.map(x=>'<th>'+x+'</th>').join("")+'<th>Sumber populasi</th></tr></thead><tbody>'+rows+'<tr><td><strong>Total data tersedia</strong></td><td>'+fmt(selectedArea,4)+'</td><td>'+fmt(sourceTotal,0)+'</td>'+totals+'<td>'+known.length+'/'+members.length+' gawangan</td></tr></tbody></table></div>';
    container.hidden=false;
  }
  syncPhase();
  loadGawangan();
  loadPopulation();
  function syncPhaseButtons(){document.querySelectorAll('[data-calc-phase]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.calcPhase===$('fert-phase').value)));}
  document.querySelectorAll('[data-calc-phase]').forEach(b=>b.addEventListener('click',()=>{$('fert-phase').value=b.dataset.calcPhase;$('fert-phase').dispatchEvent(new Event('change',{bubbles:true}));syncPhaseButtons();}));
  $('fert-phase').addEventListener('change',syncPhaseButtons);
  actualForm.addEventListener('reset',()=>setTimeout(syncPhaseButtons,0));
  syncPhaseButtons();
})();
