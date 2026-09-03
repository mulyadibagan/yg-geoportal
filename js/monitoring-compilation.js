(function(){
  'use strict';

  var kpis=document.getElementById('compilation-kpis');
  var reporters=document.getElementById('compilation-reporters');
  var objects=document.getElementById('compilation-objects');
  var count=document.getElementById('compilation-count');
  var cluster=document.getElementById('compilation-cluster');
  var clusterValue=document.getElementById('compilation-cluster-value');
  var search=document.getElementById('compilation-search');
  var villageChart=document.getElementById('compilation-village-chart');
  var activeData=null;
  var SNAPSHOT_URL='https://yg-webgis-public-data-staging.yg-webgis-public-data-worker.workers.dev/snapshots/current/dashboard.json';
  var OBJECT_ALIASES={
    'area_mangrove:auto:1281388060':'MANGROVE-KELAPA-PATI-PHASE-III-001',
    'area_mangrove:auto:1674337344':'MANGROVE-KELAPA-PATI-PHASE-III-001',
    'area_mangrove:auto:645930758':'MANGROVE-KELAPA-PATI-PHASE-III-001',
    'MANGROVE-KELAPA-PATI-PHASE-III-2025-001':'MANGROVE-KELAPA-PATI-PHASE-III-001',
    'MANGROVE-KELAPA-PATI-PHASE-III-2026-001':'MANGROVE-KELAPA-PATI-PHASE-III-001',
    'area_mangrove:auto:1732351650':'MANGROVE-SEPAHAT-2025-001',
    'area_mangrove:auto:1601647125':'MANGROVE-SEPAHAT-2025-001',
    'MANGROVE-SEPAHAT-PHASE-III-2025-001':'MANGROVE-SEPAHAT-2025-001',
    'area_mangrove:auto:613256434':'MANGROVE-BURUK-BAKUL-PHASE-II-001',
    'MANGROVE-BURUK-BAKUL-PHASE-II-2024-001':'MANGROVE-BURUK-BAKUL-PHASE-II-001',
    'area_mangrove:auto:374024597':'MANGROVE-BURUK-BAKUL-2025-001',
    'MANGROVE-BURUK-BAKUL-PHASE-III-2025-001':'MANGROVE-BURUK-BAKUL-2025-001',
    'area_mangrove:auto:56906758':'MANGROVE-BURUK-BAKUL-2025-002',
    'MANGROVE-BURUK-BAKUL-PHASE-III-2025-002':'MANGROVE-BURUK-BAKUL-2025-002',
    'MANGROVE-BURUK-BAKUL-PHASE-III-2025-003':'MANGROVE-BURUK-BAKUL-2025-003',
    'MANGROVE-TANJUNG-KURAS-PHASE-III-2026-001':'MANGROVE-TANJUNG-KURAS-2026-001'
  };
  var OBJECT_MASTER_OVERRIDES={
    'MANGROVE-BURUK-BAKUL-PHASE-II-001':{plantedCount:10200,areaHa:0.97},
    'MANGROVE-BURUK-BAKUL-2025-001':{plantedCount:236,areaHa:0.118},
    'MANGROVE-BURUK-BAKUL-2025-002':{plantedCount:3164,areaHa:1.582},
    'MANGROVE-BURUK-BAKUL-2025-003':{plantedCount:600,areaHa:0.3}
  };
  var REPORT_METRIC_OVERRIDES={
    'YG-20260713-202057-344':{aliveCount:10200,deadOrDamagedCount:0},
    'YG-20260826-135016-915':{aliveCount:600,deadOrDamagedCount:0}
  };

  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function numberFormat(v){
    v=Number(v);
    if(!isFinite(v))return'0';
    return v.toLocaleString('id-ID',{maximumFractionDigits:1});
  }
  function dateValue(v){var text=String(v||'').trim();var local=text.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);var d=local?new Date(Date.UTC(Number(local[3]),Number(local[2])-1,Number(local[1]))):new Date(v||0);return isNaN(d.getTime())?new Date(0):d;}
  function fmtDate(v){var d=dateValue(v);return d.getTime()?d.toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric',timeZone:'UTC'}):'—';}
  function metricNumber(v){
    if(v===undefined||v===null||v==='')return null;
    if(typeof v==='number')return isFinite(v)?v:null;
    var text=String(v).trim().replace(/\s/g,'');
    if(text.indexOf(',')>-1&&text.indexOf('.')>-1)text=text.replace(/\./g,'').replace(',','.');
    else if(text.indexOf(',')>-1)text=text.replace(',','.');
    text=text.replace(/[^0-9.-]/g,'');
    var n=Number(text);
    return isFinite(n)?n:null;
  }

  function parseJSON(v){if(!v)return{};if(typeof v==='object')return v;try{return JSON.parse(v);}catch(e){return{};}}
  function keyText(v){
    var text=String(v||'').toLowerCase();
    if(text.normalize)text=text.normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    return text.replace(/[^a-z0-9]+/g,' ').trim();
  }
  function canonicalVillage(v){
    var text=String(v||'').trim();
    if(keyText(text).replace(/\s+/g,'')==='kelapapati')return'Kelapa Pati';
    return text;
  }
  function normalizeCompiledVillages(groups){
    function normalizeRecord(record){
      if(!record)return;
      record.village=canonicalVillage(record.village);
      record.villageKey=keyText(record.village);
      if(record.location)record.location=String(record.location).replace(/\bkelapapati\b/gi,'Kelapa Pati');
    }
    (groups||[]).forEach(function(group){
      group.villageKeys={};
      (group.history||[]).forEach(function(record){normalizeRecord(record);if(record.villageKey)group.villageKeys[record.villageKey]=1;});
      normalizeRecord(group.latest);
      if(group.latest&&group.latest.villageKey)group.villageKeys[group.latest.villageKey]=1;
    });
  }
  function firstText(obj,keys){
    if(!obj||typeof obj!=='object')return'';
    for(var i=0;i<keys.length;i+=1){
      var value=obj[keys[i]];
      if(value!==undefined&&value!==null&&String(value).trim()!=='')return String(value).trim();
    }
    return'';
  }
  function publishedNumber(v){
    var matched=String(v==null?'':v).match(/-?\d[\d.,]*/);
    if(!matched)return null;
    var text=matched[0],hasDot=text.indexOf('.')>-1,hasComma=text.indexOf(',')>-1;
    if(hasDot&&hasComma){
      text=text.lastIndexOf('.')>text.lastIndexOf(',')?text.replace(/,/g,''):text.replace(/\./g,'').replace(',','.');
    }else if(hasComma){
      text=text.replace(',','.');
    }else if(hasDot){
      var parts=text.split('.');
      if(parts.length>1&&parts[parts.length-1].length===3)text=parts.join('');
    }
    var number=Number(text);
    return isFinite(number)?number:null;
  }
  function publishedAreaNumber(v){
    if(typeof v==='number')return isFinite(v)?v:null;
    var text=String(v==null?'':v).trim().replace(/\s/g,'');
    if(!text)return null;
    if(text.indexOf(',')>-1&&text.indexOf('.')>-1)text=text.replace(/\./g,'').replace(',','.');
    else if(text.indexOf(',')>-1)text=text.replace(',','.');
    text=text.replace(/[^0-9.-]/g,'');
    var number=Number(text);
    return isFinite(number)?number:null;
  }
  function isMonitoringRecord(p){
    var values=[p.reportType,p.Report_Type,p.type,p.type_of_report,p.jenisActivity,p.jenis_aktivitas,p.activityType,p.activity_type,p.jenis,p.jenisLaporan,p.jenis_laporan,p.kategori,p.category,p.KATEGORI];
    return values.some(function(value){return /monitoring|pemantauan/i.test(String(value||''));});
  }
  function reportType(p,m){
    var id=String(p.targetLayerId||m.monitoringType||p.targetLayerLabel||'').toLowerCase();
    if(id==='fdrs'||/water|muka air|fdrs/.test(id))return'Tinggi Muka Air/FDRS';
    if(/restorasi.*hutan|imbo putuih/.test(id))return'Restorasi Hutan';
    if(/restorasi.*gambut/.test(id))return'Restorasi Gambut';
    if(/area_mangrove|penanaman/.test(id))return'Penanaman Mangrove';
    if(/hutan.*mangrove/.test(id))return'Hutan Mangrove';
    if(/sekat/.test(id))return'Sekat Kanal';
    if(/apo|pemecah ombak/.test(id))return'APO';
    if(/nursery|pembibitan/.test(id))return'Pembibitan';
    if(/kopi|agroforestri/.test(id))return'Agroforestri/Kopi';
    return m.monitoringType||p.targetLayerLabel||'Monitoring Umum';
  }
  function phaseOf(source){
    source=source||{};
    var values=[source.Fase,source.fase,source.Ket,source.phase,source.Tahun,source.Object_ID,source.Nama_Objek];
    for(var i=0;i<values.length;i+=1){
      var match=String(values[i]||'').match(/(?:fase|phase)[\s_-]*([ivx]+|\d+)/i);
      if(match)return'Fase '+match[1].toUpperCase();
    }
    return'';
  }
  function normalizePublished(feature,index){
    var p=feature&&feature.properties||feature||{};
    if(!isMonitoringRecord(p))return null;
    var m=parseJSON(p.proposedInformation);
    if(!Object.keys(m).length)m=parseJSON(p.proposedChanges).monitoring||{};
    if(!Object.keys(m).length)m={
      monitoringType:p.Monitoring_Type,condition:p.Kondisi,survivalPercent:p.Survival,
      aliveCount:p.Jumlah_Hidup,deadOrDamagedCount:p.Jumlah_Mati_Rusak,
      monitoredAreaHa:p.Luas_Terpantau_Ha,averageHeightCm:p.Tinggi_Rata_Rata_Cm,
      sedimentationCm:p.Sedimentasi_Cm,waterTableCm:p.Water_Table_Cm
    };
    var target=parseJSON(p.targetFeatureProperties);
    var targetArea=publishedAreaNumber(target.Luas_Ha||target.Luas||target.areaHa||target.luas_ha);
    var plantedCount=publishedNumber(target.Jumlah_Bib||target.Jumlah_Tanam||target.plantedCount||target.jumlahBibit||target.jumlah_bibit);
    if(targetArea!==null&&targetArea>0)m.monitoredAreaHa=targetArea;
    if(String(p.reportId||p.Source_Report_ID||'')==='YG-20260717-205241-378'){
      m.aliveCount=2730;m.deadOrDamagedCount=600;m.survivalPercent=82;
    }
    var reportMetricOverride=REPORT_METRIC_OVERRIDES[String(p.reportId||p.Source_Report_ID||'')];
    if(reportMetricOverride){m.aliveCount=reportMetricOverride.aliveCount;m.deadOrDamagedCount=reportMetricOverride.deadOrDamagedCount;m.survivalPercent=100;}
    var alive=publishedNumber(m.aliveCount),dead=publishedNumber(m.deadOrDamagedCount);
    if(alive!==null&&dead!==null&&alive+dead>0)m.survivalPercent=alive/(alive+dead)*100;
    var title=p.locationName||p.targetObjectName||p.title||target.Nama_Objek||'Objek monitoring';
    var village=canonicalVillage(p.village||p.Desa||p.WADMKD||p.kelurahan||p.desa||target.Desa||target.WADMKD||'');
    var reporter=firstText(p,['name','namaPelapor','nama_pelapor','pelapor','reporter','reporterName','createdBy','authorName','submittedBy','submitterName','fullName','namaLengkap','organization'])||firstText(m,['reporter','name','namaPelapor','pelapor','createdBy','authorName','nama','petugas']);
    var donor=firstText(p,['Donor','Donor_Cluster','Nama_Donor','Funding_Source','donor'])||firstText(target,['Donor','Donor_Cluster','Nama_Donor','Funding_Source','donor']);
    var phase=phaseOf(p)||phaseOf(target);
    var condition=String(m.condition||p.condition||p.description||'').toLowerCase();
    var status=/rusak berat|hilang|kritis|tindak lanjut|kering parah|gagal/.test(condition)?{key:'masalah',label:'Perlu tindak lanjut'}:/sedang|rusak ringan|pantau|waspada|abrasi|hama/.test(condition)?{key:'waspada',label:'Perlu dipantau'}:{key:'baik',label:m.condition||p.condition||'Baik/normal'};
    var objectCode=String(target.Object_ID||target.OBJECT_ID||target.objectId||p.Object_ID||p.targetObjectId||'').trim();
    objectCode=OBJECT_ALIASES[objectCode]||objectCode;
    var masterOverride=OBJECT_MASTER_OVERRIDES[objectCode];
    if(masterOverride){plantedCount=masterOverride.plantedCount;m.monitoredAreaHa=masterOverride.areaHa;}
    var objectKey=objectCode||[p.targetLayerId||p.targetLayerLabel||'monitoring',title,targetArea||''].map(keyText).join('|');
    return{
      id:p.monitoringId||p.reportId||index,objectId:objectKey,masterObjectId:objectCode,
      title:title,type:reportType(p,m),date:p.activityDate||p.publishedAt||p.verifiedAt||p.receivedAt,
      village:village,villageKey:keyText(village),location:[village,p.district,p.regency].filter(Boolean).join(', '),
      reporter:reporter,reporterKey:keyText(reporter),donor:donor,donorKey:keyText(donor),
      phase:phase,phaseKey:keyText(phase),plantedCount:plantedCount,metrics:m,status:status
    };
  }
  function compilePublished(records,type){
    records=records.filter(function(record){return !type||record.type===type;});
    var map={};
    records.forEach(function(record){
      var key=record.masterObjectId||record.objectId||String(record.id);
      if(!map[key])map[key]={key:key,label:record.title,history:[],villageKeys:{},reporterKeys:{},donorKeys:{},phaseKeys:{},objectCode:record.masterObjectId||''};
      var group=map[key];
      group.history.push(record);
      if(record.villageKey)group.villageKeys[record.villageKey]=1;
      if(record.reporterKey)group.reporterKeys[record.reporterKey]=1;
      if(record.donorKey)group.donorKeys[record.donorKey]=1;
      if(record.phaseKey)group.phaseKeys[record.phaseKey]=1;
    });
    var groups=Object.keys(map).map(function(key){
      var group=map[key];
      group.history.sort(function(a,b){return dateValue(b.date)-dateValue(a.date);});
      group.latest=group.history[0];
      return group;
    }).sort(function(a,b){return dateValue(b.latest.date)-dateValue(a.latest.date);});
    var alive=0,dead=0,area=0,planted=0,plantedObjects=0,reporterMap={};
    groups.forEach(function(group){
      var metrics=group.latest.metrics||{};
      var live=metricValue(metrics,metricDefs[0]),lost=metricValue(metrics,metricDefs[1]),size=metricValue(metrics,metricDefs[6]);
      if(live!==null)alive+=live;if(lost!==null)dead+=lost;if(size!==null)area+=size;
      if(group.latest.plantedCount!==null&&group.latest.plantedCount!==undefined){planted+=Number(group.latest.plantedCount)||0;plantedObjects+=1;}
    });
    records.forEach(function(record){
      var key=record.reporterKey||'pelapor-tidak-disebut';
      if(!reporterMap[key])reporterMap[key]={key:key,name:record.reporter||'Pelapor tidak disebut',reports:0,objects:{}};
      reporterMap[key].reports+=1;reporterMap[key].objects[record.masterObjectId||record.objectId]=1;
    });
    var reporters=Object.keys(reporterMap).map(function(key){return reporterMap[key];}).sort(function(a,b){return b.reports-a.reports;});
    return{generatedAt:Date.now(),type:type,summary:{objects:groups.length,reports:records.length,reporters:reporters.length,area:area,alive:alive,dead:dead,planted:plantedObjects===groups.length?planted:null,totalPlants:plantedObjects===groups.length?planted:null,condition:alive+dead?Math.round(alive/(alive+dead)*100):0},reporters:reporters,groups:groups};
  }
  function compilePayload(payload,type,storageKey){
    var features=[];
    if(payload&&Array.isArray(payload.features))features=payload.features;
    else if(payload&&Array.isArray(payload.reports))features=payload.reports;
    else if(payload&&Array.isArray(payload.items))features=payload.items;
    else if(Array.isArray(payload))features=payload;
    if(!features.length)throw new Error('public_reports_empty');
    var data=compilePublished(features.map(normalizePublished).filter(Boolean),type);
    try{sessionStorage.setItem(storageKey,JSON.stringify(data));}catch(e){}
    render(data);refreshClusterValues();
  }
  function loadPublishedJsonp(type,storageKey){
    var callback='ygMonitoringCompilationCallback'+Date.now();
    var script=document.createElement('script');
    var settled=false;
    function cleanup(){if(script.parentNode)script.parentNode.removeChild(script);try{delete window[callback];}catch(e){window[callback]=undefined;}}
    window[callback]=function(payload){
      settled=true;
      try{compilePayload(payload,type,storageKey);}catch(e){}
      cleanup();
    };
    script.src='https://script.google.com/macros/s/AKfycbxUe4QyBvSiL9UJsL-nsJ5XrohDabwqhYYR9q5CTgLYiW1ZCfVy429iMlpU-lCDUSvvRg/exec?page=public-reports&callback='+encodeURIComponent(callback)+'&t='+Date.now();
    script.async=true;
    script.onerror=function(){
      cleanup();
      if(!activeData){
        objects.innerHTML='<div class="empty">Data publik belum dapat dimuat. Silakan coba beberapa saat lagi.</div>';
        reporters.innerHTML='<span class="muted">Koneksi sumber data gagal.</span>';
        if(villageChart)villageChart.innerHTML='<div class="village-chart-empty">Ringkasan desa belum dapat dimuat karena sumber data tidak terhubung.</div>';
      }
    };
    document.head.appendChild(script);
    window.setTimeout(function(){if(!settled&&script.parentNode)script.onerror();},15000);
  }
  function loadPublished(type,storageKey){
    if(typeof fetch!=='function'){
      loadPublishedJsonp(type,storageKey);
      return;
    }
    fetch(SNAPSHOT_URL,{cache:'default'}).then(function(response){
      if(!response.ok)throw new Error('HTTP '+response.status);
      return response.json();
    }).then(function(snapshot){
      var payload=snapshot&&snapshot.capacitySources&&snapshot.capacitySources.reports;
      compilePayload(payload||snapshot,type,storageKey);
    }).catch(function(){
      loadPublishedJsonp(type,storageKey);
    });
  }

  var metricDefs=[
    {keys:['aliveCount','alive','jumlahHidup','tanamanHidup'],label:'Tanaman hidup',unit:'pohon'},
    {keys:['deadOrDamagedCount','dead','mati','jumlahMati','tanamanMati','deadCount'],label:'Tanaman mati/rusak',unit:'pohon'},
    {keys:['survivalPercent','survival','persenHidup'],label:'Kelangsungan hidup',unit:'%'},
    {keys:['averageHeightCm','heightCm','tinggiRataRata'],label:'Tinggi rata-rata',unit:'cm'},
    {keys:['waterTableCm','waterLevelCm','mukaAir'],label:'Tinggi muka air',unit:'cm'},
    {keys:['sedimentationCm','sedimentCm'],label:'Sedimentasi',unit:'cm'},
    {keys:['monitoredAreaHa','area','luas','luasHa','luas_ha','areaHa'],label:'Luas terpantau',unit:'ha'}
  ];

  function metricValue(metrics,definition){
    metrics=metrics||{};
    for(var i=0;i<definition.keys.length;i+=1){
      var value=metricNumber(metrics[definition.keys[i]]);
      if(value!==null)return value;
    }
    return null;
  }

  function latestMetrics(group){
    var metrics=group.latest&&group.latest.metrics||{};
    return metricDefs.map(function(definition){
      return{definition:definition,value:metricValue(metrics,definition)};
    }).filter(function(item){return item.value!==null;}).slice(0,4);
  }

  function trendSeries(group){
    var history=(group.history||[]).slice().sort(function(a,b){return dateValue(a.date)-dateValue(b.date);});
    for(var i=0;i<metricDefs.length;i+=1){
      var definition=metricDefs[i];
      var points=history.map(function(record){
        return{date:record.date,value:metricValue(record.metrics,definition)};
      }).filter(function(point){return point.value!==null;});
      if(points.length>1)return{definition:definition,points:points};
    }
    return null;
  }

  function trendSVG(group){
    var series=trendSeries(group);
    if(!series)return'<div class="chart-empty">Grafik pertumbuhan tersedia setelah objek memiliki sedikitnya dua laporan dengan indikator yang sama.</div>';
    var values=series.points.map(function(point){return point.value;});
    var min=Math.min.apply(null,values),max=Math.max.apply(null,values);
    if(max===min){max+=1;min-=1;}
    var width=720,height=180,left=45,right=24,top=18,bottom=35;
    var usableW=width-left-right,usableH=height-top-bottom;
    var coordinates=series.points.map(function(point,index){
      return{
        x:left+(series.points.length===1?usableW/2:(index/(series.points.length-1))*usableW),
        y:top+((max-point.value)/(max-min))*usableH,
        point:point
      };
    });
    var line=coordinates.map(function(point){return point.x.toFixed(1)+','+point.y.toFixed(1);}).join(' ');
    var marks=coordinates.map(function(point){
      return'<circle cx="'+point.x+'" cy="'+point.y+'" r="5"></circle><text x="'+point.x+'" y="'+(point.y-10)+'" text-anchor="middle">'+esc(numberFormat(point.point.value))+'</text><text x="'+point.x+'" y="'+(height-10)+'" text-anchor="middle">'+esc(fmtDate(point.point.date))+'</text>';
    }).join('');
    return'<div class="compilation-trend"><h4>'+esc(series.definition.label)+' ('+esc(series.definition.unit)+')</h4><svg viewBox="0 0 '+width+' '+height+'" role="img" aria-label="Grafik '+esc(series.definition.label)+'"><line class="axis" x1="'+left+'" y1="'+(height-bottom)+'" x2="'+(width-right)+'" y2="'+(height-bottom)+'"></line><polyline class="trend" points="'+line+'"></polyline>'+marks+'</svg></div>';
  }

  function villageSummary(groups){
    var villages={};
    (groups||[]).forEach(function(group){
      var latest=group.latest||{};
      var key=latest.villageKey||keyText(latest.village||'');
      if(!key)return;
      if(!villages[key])villages[key]={key:key,label:latest.village||latest.location||key,objects:0,reports:0,alive:0,dead:0,area:0,planted:0,plantedObjects:0,hasPlanted:false};
      var village=villages[key],metrics=latest.metrics||{};
      var alive=metricValue(metrics,metricDefs[0]),dead=metricValue(metrics,metricDefs[1]),area=metricValue(metrics,metricDefs[6]);
      village.objects+=1;
      village.reports+=(group.history||[]).length;
      if(alive!==null)village.alive+=alive;
      if(dead!==null)village.dead+=dead;
      if(area!==null)village.area+=area;
      if(latest.plantedCount!==null&&latest.plantedCount!==undefined){village.planted+=Number(latest.plantedCount)||0;village.plantedObjects+=1;}
    });
    return Object.keys(villages).map(function(key){
      var village=villages[key],total=village.alive+village.dead;
      village.total=total;
      village.survival=total?Math.round(village.alive/total*100):null;
      village.hasPlanted=village.plantedObjects===village.objects;
      return village;
    }).sort(function(a,b){return b.total-a.total||a.label.localeCompare(b.label,'id');});
  }

  function renderVillageChart(groups){
    if(!villageChart)return;
    var villages=villageSummary(groups);
    if(!villages.length){villageChart.innerHTML='<div class="village-chart-empty">Belum ada nama desa pada objek yang ditampilkan.</div>';return;}
    var maxTotal=Math.max.apply(null,villages.map(function(village){return village.total;}));
    if(!maxTotal)maxTotal=1;
    villageChart.innerHTML=villages.map(function(village){
      var aliveWidth=village.alive/maxTotal*100,deadWidth=village.dead/maxTotal*100;
      var survival=village.survival===null?'—':numberFormat(village.survival)+'%';
      var planted=village.hasPlanted?numberFormat(village.planted):'—';
      var aria=village.label+', '+planted+' bibit tertanam, '+numberFormat(village.alive)+' tanaman hidup, '+numberFormat(village.dead)+' mati atau rusak, kondisi hidup '+survival;
      return'<button type="button" class="village-chart-row" data-village-chart-key="'+esc(village.key)+'" aria-label="'+esc(aria)+'. Saring objek desa ini">'+
        '<span class="village-chart-name"><strong>'+esc(village.label)+'</strong><small>'+village.objects+' objek · '+village.reports+' laporan</small></span>'+
        '<span class="village-bar-line"><span class="village-bar-track" role="img" aria-label="'+esc(aria)+'"><i class="village-bar-alive" style="width:'+aliveWidth.toFixed(2)+'%"></i><i class="village-bar-dead" style="width:'+deadWidth.toFixed(2)+'%"></i></span><b>'+esc(survival)+'</b></span>'+
        '<span class="village-chart-stats"><span class="village-planted-total"><b>'+esc(planted)+'</b>bibit tertanam</span><span><b>'+esc(numberFormat(village.alive))+'</b>hidup</span><span><b>'+esc(numberFormat(village.dead))+'</b>mati/rusak</span><span><b>'+esc(numberFormat(village.area))+' ha</b>terpantau</span></span>'+
      '</button>';
    }).join('');
  }

  function applyMasterObjectData(data){
    var groups=data&&data.groups||[],summary=data.summary||{};
    groups.forEach(function(group){
      var original=group.objectCode||group.key||'';
      var canonical=OBJECT_ALIASES[original]||original;
      var master=OBJECT_MASTER_OVERRIDES[canonical];
      if(!master)return;
      group.key=canonical;group.objectCode=canonical;
      function update(record){if(!record)return;record.objectId=canonical;record.masterObjectId=canonical;record.plantedCount=master.plantedCount;record.metrics=record.metrics||{};record.metrics.monitoredAreaHa=master.areaHa;var correction=REPORT_METRIC_OVERRIDES[String(record.id||'')];if(correction){record.metrics.aliveCount=correction.aliveCount;record.metrics.deadOrDamagedCount=correction.deadOrDamagedCount;record.metrics.survivalPercent=100;}}
      (group.history||[]).forEach(update);update(group.latest);
    });
    var alive=0,dead=0,area=0,planted=0,plantedObjects=0;
    groups.forEach(function(group){
      var latest=group.latest||{},metrics=latest.metrics||{};
      var live=metricValue(metrics,metricDefs[0]),lost=metricValue(metrics,metricDefs[1]),size=metricValue(metrics,metricDefs[6]);
      if(live!==null)alive+=live;if(lost!==null)dead+=lost;if(size!==null)area+=size;
      if(latest.plantedCount!==null&&latest.plantedCount!==undefined){planted+=Number(latest.plantedCount)||0;plantedObjects+=1;}
    });
    summary.area=area;summary.alive=alive;summary.dead=dead;summary.planted=plantedObjects===groups.length?planted:null;summary.totalPlants=summary.planted;summary.condition=alive+dead?Math.round(alive/(alive+dead)*100):0;
    data.summary=summary;
  }

  function render(data){
    applyMasterObjectData(data);
    normalizeCompiledVillages(data.groups);
    activeData=data;
    var summary=data.summary||{};
    var kpiItems=[
      ['Objek dipantau',summary.objects,'objek'],['Laporan masuk',summary.reports,'laporan'],
      ['Pelapor aktif',summary.reporters,'orang'],['Luas terpantau',summary.area,'ha'],
      ['Tanaman hidup',summary.alive,'pohon'],['Tanaman mati/rusak',summary.dead,'pohon'],
      ['Bibit tertanam',summary.planted,'bibit'],['Kondisi hidup',summary.condition,'%']
    ];
    kpis.innerHTML=kpiItems.map(function(item){return'<article><span>'+esc(item[0])+'</span><strong>'+esc(item[1]==null?'—':numberFormat(item[1]))+'</strong><small>'+esc(item[2])+'</small></article>';}).join('');
    reporters.innerHTML=(data.reporters||[]).map(function(item){return'<button type="button" class="reporter-pill" data-reporter-key="'+esc(item.key||keyText(item.name))+'"><b>'+esc(item.name)+'</b> · '+item.reports+' laporan · '+Object.keys(item.objects||{}).length+' objek</button>';}).join('')||'<span class="muted">Belum ada nama pelapor.</span>';
    var groups=(data.groups||[]).filter(function(group){
      var value=clusterValue&&clusterValue.value||'';
      var mode=cluster&&cluster.value||'object';
      var latest=group.latest||{};
      var query=String(search&&search.value||'').toLowerCase();
      var matchesValue=!value||
        (mode==='village'&&group.villageKeys&&group.villageKeys[value])||
        (mode==='reporter'&&group.reporterKeys&&group.reporterKeys[value])||
        (mode==='donor'&&group.donorKeys&&group.donorKeys[value])||
        (mode==='phase'&&group.phaseKeys&&group.phaseKeys[value]);
      var hay=[group.label,latest.title,latest.location,latest.village,latest.reporter,latest.donor,latest.phase,group.objectCode].join(' ').toLowerCase();
      return matchesValue&&(!query||hay.indexOf(query)>-1);
    });
    count.textContent=groups.length+' objek';
    renderVillageChart(groups);
    objects.innerHTML=groups.map(function(group){
      var latest=group.latest||{};
      var quick=latestMetrics(group).map(function(item){return'<span><small>'+esc(item.definition.label)+'</small><b>'+esc(numberFormat(item.value))+' '+esc(item.definition.unit)+'</b></span>';}).join('');
      var href='monitoring-detail.html?object='+encodeURIComponent(group.key)+'&title='+encodeURIComponent(group.label||latest.title||'Objek monitoring');
      return'<article class="compilation-object">'+
        '<div class="compilation-object-head"><div><span class="type-label">'+esc(String(latest.type||'Monitoring').toUpperCase())+'</span><h3>'+esc(group.label||latest.title||'Objek monitoring')+'</h3><span class="compilation-object-meta">'+esc(latest.location||'Lokasi belum dicantumkan')+(latest.reporter?' · Pelapor terakhir: '+esc(latest.reporter):'')+'</span></div><span class="status '+esc(latest.status&&latest.status.key||'baik')+'">'+esc(latest.status&&latest.status.label||'')+'</span></div>'+
        (quick?'<div class="object-quick-metrics">'+quick+'</div>':'')+
        trendSVG(group)+
        '<div class="compilation-object-actions"><small>'+group.history.length+' laporan · terakhir '+esc(fmtDate(latest.date))+'</small><a href="'+href+'" data-object-key="'+esc(group.key)+'">Buka detail objek →</a></div>'+
      '</article>';
    }).join('')||'<div class="empty">Belum ada objek dalam kompilasi ini.</div>';
  }

  function refreshClusterValues(){
    if(!activeData||!clusterValue)return;
    var mode=cluster.value;
    var values={};
    (activeData.groups||[]).forEach(function(group){
      var latest=group.latest||{};
      if(mode==='village'&&latest.villageKey)values[latest.villageKey]=latest.village||latest.location||latest.villageKey;
      if(mode==='reporter'){
        (group.history||[]).forEach(function(record){
          if(record.reporterKey)values[record.reporterKey]=record.reporter||record.reporterKey;
        });
      }
      if(mode==='donor'&&latest.donorKey)values[latest.donorKey]=latest.donor||latest.donorKey;
      if(mode==='phase'&&latest.phaseKey)values[latest.phaseKey]=latest.phase||latest.phaseKey;
    });
    clusterValue.parentElement.style.display=mode==='object'?'none':'';
    clusterValue.innerHTML='<option value="">Semua</option>'+Object.keys(values).sort().map(function(key){
      return'<option value="'+esc(key)+'">'+esc(values[key])+'</option>';
    }).join('');
    render(activeData);
  }

  if(cluster)cluster.addEventListener('change',refreshClusterValues);
  if(clusterValue)clusterValue.addEventListener('change',function(){render(activeData);});
  if(search)search.addEventListener('input',function(){render(activeData);});

  if(villageChart)villageChart.addEventListener('click',function(event){
    var row=event.target.closest('[data-village-chart-key]');
    if(!row||!cluster||!clusterValue)return;
    cluster.value='village';
    refreshClusterValues();
    clusterValue.value=row.getAttribute('data-village-chart-key');
    render(activeData);
    clusterValue.focus();
  });

  if(reporters)reporters.addEventListener('click',function(event){
    var button=event.target.closest('[data-reporter-key]');
    if(!button||!cluster||!clusterValue)return;
    cluster.value='reporter';
    refreshClusterValues();
    clusterValue.value=button.getAttribute('data-reporter-key');
    render(activeData);
    clusterValue.focus();
    if(objects)objects.scrollIntoView({behavior:'smooth',block:'start'});
  });

  document.addEventListener('click',function(event){
    var link=event.target.closest('[data-object-key]');
    if(!link)return;
    var key=link.getAttribute('data-object-key');
    var group=activeData&&activeData.groups&&activeData.groups.find(function(item){return item.key===key;});
    if(group){
      try{sessionStorage.setItem('monitoring-detail',JSON.stringify({objectKey:group.key,objectId:group.objectCode||'',generatedAt:Date.now(),group:group}));}catch(e){}
    }
  });

  var saved=null;
  var requestedType=new URLSearchParams(location.search).get('type')||'';
  var storageKey=requestedType?'monitoring-compilation:'+String(requestedType).toLowerCase().replace(/[^a-z0-9]+/g,' ').trim():'monitoring-compilation';
  try{saved=JSON.parse(sessionStorage.getItem(storageKey)||'null');}catch(e){}
  if(requestedType){
    var heading=document.querySelector('.compilation-hero h1');
    if(heading)heading.textContent='Monitoring '+requestedType;
  }
  if(saved&&saved.groups){
    render(saved);
    refreshClusterValues();
  }else{
    objects.innerHTML='<div class="loading">Memuat laporan monitoring terpublikasi…</div>';
    kpis.innerHTML='';
    reporters.innerHTML='<span class="muted">Menghubungkan ke sumber data publik…</span>';
    if(villageChart)villageChart.innerHTML='<div class="village-chart-empty">Menghubungkan ke sumber data publik…</div>';
  }
  loadPublished(requestedType,storageKey);
})();


