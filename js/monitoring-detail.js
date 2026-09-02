(function(){
  'use strict';

  var BASE='https://script.google.com/macros/s/AKfycbxUe4QyBvSiL9UJsL-nsJ5XrohDabwqhYYR9q5CTgLYiW1ZCfVy429iMlpU-lCDUSvvRg/exec';
  var API=BASE+'?page=public-reports';
  var OFFICIAL_MANGROVE='data/area_mangrove.geojson?v=20260902-kelapa-pati-monitoring1';
  var CALLBACK='ygMonitoringDetailCallback';
  var STORAGE_KEY='monitoring-detail';
  var OBJECT_ALIASES={
    'area_mangrove:auto:1281388060':'MANGROVE-KELAPA-PATI-PHASE-III-2026-001',
    'area_mangrove:auto:1674337344':'MANGROVE-KELAPA-PATI-PHASE-III-2026-001',
    'area_mangrove:auto:645930758':'MANGROVE-KELAPA-PATI-PHASE-III-2026-001',
    'MANGROVE-KELAPA-PATI-PHASE-III-2025-001':'MANGROVE-KELAPA-PATI-PHASE-III-2026-001',
    'area_mangrove:auto:1732351650':'MANGROVE-SEPAHAT-PHASE-III-2025-001',
    'area_mangrove:auto:1601647125':'MANGROVE-SEPAHAT-PHASE-III-2025-001'
  };
  var REPORT_CORRECTIONS={
    'YG-20260717-205241-378':{aliveCount:2730,deadOrDamagedCount:600,survivalPercent:82},
    'YG-20260826-135016-915':{aliveCount:600,deadOrDamagedCount:0,survivalPercent:100}
  };
  var PUP1_OBJECT_ID='COMMUNITY-YG-20260820-190119-864';
  var PUP1_TREES=[
    ['D23','Nangka',150,169,'+19',1.22,1.59,'+0.37','Hidup'],
    ['A19','Kuras',74,169,'+95',0.74,1.27,'+0.53','Hidup'],
    ['G26','Cempedak',115,102,'-13*',1.15,1.27,'+0.12','Hidup'],
    ['D23','Nangka',155,130,'-25*',0.82,0.95,'+0.13','Hidup'],
    ['E23','Nangka',80,92,'+12',0.74,0.95,'+0.21','Hidup'],
    ['O24','Cempedak',90,170,'+80',1.08,1.59,'+0.51','Hidup'],
    ['A23','Kuras',94,89,'-5*',0.78,0.63,'-0.15*','Hidup'],
    ['D19','Cempedak',104,131,'+27',1.18,0.95,'-0.23*','Hidup'],
    ['B20','Kuras',135,190,'+55',1.11,1.91,'+0.80','Hidup'],
    ['B23','Kuras',136,206,'+70',1.21,1.27,'+0.06','Hidup'],
    ['A22','Meranti',65,153,'+88',0.64,0.95,'+0.31','Hidup'],
    ['O24','Cempedak',171,170,'-1*',1.70,1.59,'-0.11*','Hidup'],
    ['O21','Durian',112,120,'+8',0.81,1.27,'+0.46','Hidup'],
    ['O22','Matoa',73,133,'+60',0.66,1.27,'+0.61','Hidup'],
    ['B26','Kuras',80,123,'+43',0.42,0.95,'+0.53','Hidup'],
    ['E19','Cempedak',95,123,'+28',2.17,2.22,'+0.05','Hidup'],
    ['A26','Meranti Kunyit',44,100,'+56',2.00,0.63,'-1.37*','Hidup'],
    ['C20','Kuras',55,98,'+43',0.50,0.95,'+0.45','Hidup'],
    ['O26','Durian',106,123,'+17',1.25,1.27,'+0.02','Hidup'],
    ['C23','Kuras',130,177,'+47',1.13,1.59,'+0.46','Hidup'],
    ['E26','Nangka',118,null,'—',1.14,null,'—','Mati'],
    ['C26','Kuras',105,163,'+58',0.84,1.27,'+0.43','Hidup'],
    ['F23','Nangka',100,103,'+3',1.02,1.59,'+0.57','Hidup'],
    ['G24','Matoa',73,132,'+59',1.01,1.27,'+0.26','Hidup'],
    ['A21','Meranti Kunyit',40,104,'+64',0.74,0.95,'+0.21','Hidup'],
    ['A25','Meranti Kunyit',39,70,'+31',0.15,0.63,'+0.48','Hidup'],
    ['B21','Meranti Kunyit',25,71,'+46',0.50,0.63,'+0.13','Hidup']
  ];
  var PUP1_REPLANTING=[
    ['Kelat',2],['Alpukat',1],['Aren',1],['Meranti Kunyit',2],
    ['Kuras',12],['Gaharu',2],['Nangka',3],['Meranti',2]
  ];

  var params=new URLSearchParams(location.search);
  var objectKey=params.get('object')||'';
  var titleHint=decodeURIComponent(params.get('title')||'');
  if(!objectKey&&location.protocol==='file:'){
    objectKey='MANGROVE-KELAPA-PATI-PHASE-III-2026-001';
    titleHint='Kelapa Pati';
  }
  var selectedGroup=null;

  var kpiElement=document.getElementById('detail-kpi');
  var titleElement=document.getElementById('detail-title');
  var subtitleElement=document.getElementById('detail-subtitle');
  var growthElement=document.getElementById('detail-growth');
  var historyElement=document.getElementById('detail-history');
  var infoElement=document.getElementById('detail-info');
  var photosElement=document.getElementById('detail-photos');
  var treesCard=document.getElementById('detail-trees-card');
  var treesElement=document.getElementById('detail-trees');
  var mapElement=document.getElementById('detail-map');
  var detailMap=null;
  var detailMapLayer=null;

  function esc(v){
    return String(v==null?'':v).replace(/[&<>"']/g,function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  }
  function parseJSON(v){
    if(!v)return{};
    if(typeof v==='object')return v;
    try{return JSON.parse(v);}catch(e){return{};}
  }
  function dateValue(v){
    var text=String(v||'').trim();
    var dayFirst=text.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);
    var d=dayFirst
      ? new Date(Date.UTC(Number(dayFirst[3]),Number(dayFirst[2])-1,Number(dayFirst[1])))
      : new Date(v||0);
    return isNaN(d.getTime())?new Date(0):d;
  }
  function fmtDate(v){
    var d=dateValue(v);
    return d.getTime()?d.toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric',timeZone:'UTC'}):'—';
  }
  function has(v){
    return v!==undefined&&v!==null&&v!==''&&!(typeof v==='number'&&isNaN(v));
  }
  function parseMetricNumber(v){
    var matched=String(v==null?'':v).match(/-?\d[\d.,]*/);
    if(!matched)return null;
    var s=matched[0];
    var hasDot=s.indexOf('.')>-1;
    var hasComma=s.indexOf(',')>-1;
    if(hasDot&&hasComma){
      var lastDot=s.lastIndexOf('.');
      var lastComma=s.lastIndexOf(',');
      if(lastDot>lastComma){
        s=s.replace(/,/g,'');
      }else{
        s=s.replace(/\./g,'').replace(',','.');
      }
    }else if(hasComma){
      s=s.replace(',','.');
    }else if(hasDot){
      var parts=s.split('.');
      if(parts.length>1&&parts[parts.length-1].length===3){
        s=parts.join('');
      }
    }
    var n=Number(s);
    return isFinite(n)?n:null;
  }
  function num(v){
    return parseMetricNumber(v);
  }
  function parseAreaNumber(v){
    if(typeof v==='number')return isFinite(v)?v:null;
    var text=String(v==null?'':v).trim().replace(/\s/g,'');
    if(!text)return null;
    if(text.indexOf(',')>-1&&text.indexOf('.')>-1)text=text.replace(/\./g,'').replace(',','.');
    else if(text.indexOf(',')>-1)text=text.replace(',','.');
    text=text.replace(/[^0-9.-]/g,'');
    var number=Number(text);
    return isFinite(number)?number:null;
  }
  function keyText(v){
    var text=String(v||'').toLowerCase();
    if(text.normalize)text=text.normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    return text.replace(/[^a-z0-9]+/g,' ').trim();
  }
  function firstText(obj,keys){
    if(!obj||typeof obj!=='object')return'';
    for(var i=0;i<keys.length;i+=1){
      var value=obj[keys[i]];
      if(value===undefined||value===null)continue;
      var text=String(value).trim();
      if(text!=='')return text;
    }
    return'';
  }
  function toLowerText(v){
    return String(v==null?'':v).trim().toLowerCase();
  }
  function isMonitoringRecord(p){
    var typeKeys=[
      'reportType',
      'Report_Type',
      'type',
      'type_of_report',
      'jenisActivity',
      'jenis_aktivitas',
      'activityType',
      'activity_type',
      'jenis',
      'jenisLaporan',
      'jenis_laporan',
      'kategori',
      'category',
      'KATEGORI',
      'categoryName',
      'jenisDokumen'
    ];
    for(var i=0;i<typeKeys.length;i+=1){
      var text=toLowerText(p[typeKeys[i]]);
      if(!text)continue;
      if(text==='monitoring'||/monitoring|pemantauan/.test(text))return true;
    }
    var fields=['jenisLaporan','category','kategori','type','activityType','activity_type','type_of_report','jenis_dokumen'];
    for(var j=0;j<fields.length;j+=1){
      var value=p[fields[j]];
      if(typeof value!=='string')continue;
      var normalized=toLowerText(value);
      if(/(^|[^a-z])monitoring([^a-z]|$)/.test(normalized)||/pemantauan/.test(normalized))return true;
    }
    return false;
  }
  function cleanPhotos(value){
    if(!value)return[];
    if(typeof value==='string'){
      try{value=JSON.parse(value);}
      catch(e){value=value.match(/https?:\/\/[^\s,;|]+/gi)||value.split(/\r?\n/);}
    }
    if(!Array.isArray(value))value=[value];
    return value.map(function(item){
      if(item&&typeof item==='object')item=item.url||item.webViewLink||item.fileUrl||item.src||'';
      return String(item||'').trim();
    }).filter(function(url,index,array){
      return /^https?:\/\//i.test(url)&&array.indexOf(url)===index;
    });
  }
  function driveId(url){
    var s=String(url||'');
    var m=s.match(/\/file\/d\/([A-Za-z0-9_-]+)/i)||s.match(/[?&]id=([A-Za-z0-9_-]+)/i);
    return m?m[1]:'';
  }
  function thumb(url){
    var id=driveId(url);
    return id?'https://drive.google.com/thumbnail?id='+encodeURIComponent(id)+'&sz=w1200':url;
  }
  function original(url){
    var id=driveId(url);
    return id?'https://drive.google.com/file/d/'+encodeURIComponent(id)+'/view':url;
  }
  function geometryKey(geometry){
    var bounds=[Infinity,Infinity,-Infinity,-Infinity];
    function visit(value){
      if(!Array.isArray(value))return;
      if(value.length>=2&&typeof value[0]==='number'&&typeof value[1]==='number'){
        bounds[0]=Math.min(bounds[0],value[0]);
        bounds[1]=Math.min(bounds[1],value[1]);
        bounds[2]=Math.max(bounds[2],value[0]);
        bounds[3]=Math.max(bounds[3],value[1]);
        return;
      }
      value.forEach(visit);
    }
    visit(geometry&&geometry.coordinates);
    return isFinite(bounds[0])?bounds.map(function(v){return v.toFixed(5);}).join(''):'';
  }
  function typeOf(p,m){
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
  function waterStatus(cm){
    var n=num(cm);if(n===null)return null;
    if(n>=-20)return{key:'baik',label:'Sangat basah'};
    if(n>=-40)return{key:'waspada',label:'Perlu dipantau'};
    return{key:'masalah',label:'Waspada kering'};
  }
  function statusOf(p,m,type){
    if(type==='Tinggi Muka Air/FDRS'){var ws=waterStatus(m.waterTableCm);if(ws)return ws;}
    var text=String(m.condition||p.condition||p.description||'').toLowerCase();
    if(/rusak berat|hilang|kritis|tindak lanjut|kering parah|gagal/.test(text))return{key:'masalah',label:'Perlu tindak lanjut'};
    if(/sedang|rusak ringan|pantau|waspada|abrasi|hama/.test(text))return{key:'waspada',label:'Perlu dipantau'};
    return{key:'baik',label:m.condition||p.condition||'Baik/normal'};
  }

  function normalize(feature,index){
    var p=feature&&feature.properties||{};
    if(!isMonitoringRecord(p))return null;
    var m=parseJSON(p.proposedInformation);
    if(!Object.keys(m).length)m=parseJSON(p.proposedChanges).monitoring||{};
    if(!Object.keys(m).length&&(p.Monitoring_Type||p.Kondisi||has(p.Survival)||has(p.Jumlah_Hidup))){
      m={
        monitoringType:p.Monitoring_Type,condition:p.Kondisi,survivalPercent:p.Survival,
        aliveCount:p.Jumlah_Hidup,deadOrDamagedCount:p.Jumlah_Mati_Rusak,
        monitoredAreaHa:p.Luas_Terpantau_Ha,averageHeightCm:p.Tinggi_Rata_Rata_Cm,
        averageDiameterCm:p.Diameter_Rata_Rata_Cm,sedimentationCm:p.Sedimentasi_Cm,
        waterTableCm:p.Water_Table_Cm,threats:p.Ancaman,notes:p.Temuan,followUp:p.Tindak_Lanjut
      };
    }
    var title=p.locationName||p.targetObjectName||p.title||'Objek monitoring';
    var village=p.village||p.Desa||p.WADMKD||p.kelurahan||p.desa||'';
    var reporter=firstText(p,['name','namaPelapor','nama_pelapor','pelapor','reporter','reporterName','reporter_name','createdBy','created_by','createdby','author','authorName','submittedBy','submitted_by','submitter','submitterName','submitter_name','submitterBy','fullName','namaLengkap','organization'])||firstText(m,['reporter','name','namaPelapor','nama_pelapor','pelapor','createdBy','author','authorName','userName','nama','petugas'])||'';
    var layerKey=keyText(p.targetLayerId||p.targetLayerLabel||m.monitoringType||'monitoring');
    var nameKey=keyText(p.targetObjectName||p.locationName||p.title||title);
    var targetProperties=parseJSON(p.targetFeatureProperties);
    var rawArea=targetProperties.Luas_Ha||targetProperties.Luas||targetProperties.areaHa||targetProperties.luas_ha;
    var targetArea=parseAreaNumber(rawArea);
    if(targetArea!==null&&targetArea>0)m.monitoredAreaHa=targetArea;
    var boundsKey=geometryKey(feature&&feature.geometry);
    var areaKey=isFinite(targetArea)&&targetArea>0?targetArea.toFixed(4):'';
    var spatialObjectId=[layerKey,nameKey,areaKey,boundsKey].filter(Boolean).join('|');
    var permanentObjectId=String(
      targetProperties.Object_ID||targetProperties.OBJECT_ID||targetProperties.objectId||
      p.Target_Object_ID_Current||p.Target_Object_ID||p.targetObjectId||''
    ).trim();
    permanentObjectId=OBJECT_ALIASES[permanentObjectId]||permanentObjectId;
    var objectId=permanentObjectId||spatialObjectId||
      ((p.targetSourceType||'program_layer')+'|'+(p.targetLayerId||'monitoring')+'|'+keyText(title));
    var type=typeOf(p,m);
    var correction=REPORT_CORRECTIONS[String(p.reportId||p.Source_Report_ID||'').trim()];
    if(correction)Object.keys(correction).forEach(function(key){m[key]=correction[key];});
    reconcileSurvival(m);
    return{
      id:p.monitoringId||p.reportId||index,
      objectId:objectId,
      spatialObjectId:spatialObjectId,
      legacyObjectId:p.targetObjectId||'',
      title:title,
      type:type,
      date:p.activityDate||p.publishedAt||p.verifiedAt||p.receivedAt,
      village:village,
      villageKey:keyText(village),
      location:[village,p.district||p.Kecamatan,p.regency||p.Kabupaten].filter(Boolean).join(', '),
      reporter:reporter,
      reporterKey:keyText(reporter),
      organization:p.organization||'',
      description:m.notes||p.description||'',
      recommendation:m.followUp||m.recommendation||p.recommendation||'',
      photos:cleanPhotos(p.photos),
      geometry:feature&&feature.geometry||null,
      targetProperties:targetProperties,
      metrics:m,
      status:statusOf(p,m,type)
    };
  }

  function reconcileSurvival(metrics){
    metrics=metrics||{};
    var alive=parseMetricNumber(metrics.aliveCount);
    var dead=parseMetricNumber(metrics.deadOrDamagedCount);
    var reported=parseMetricNumber(metrics.survivalPercent);
    if(alive!==null&&dead!==null&&alive+dead>0){
      var calculated=alive/(alive+dead)*100;
      metrics.reportedSurvivalPercent=reported;
      metrics.calculatedSurvivalPercent=calculated;
      metrics.survivalPercent=calculated;
      metrics.survivalReconciled=reported!==null&&Math.abs(reported-calculated)>1;
    }
    return metrics;
  }

  function groupData(items){
    var map={};
    items.forEach(function(r){
      var key=r.objectId||'tanpa kode objek';
      if(!map[key]){
        map[key]={
          key:key,
          label:r.title||'Objek tanpa nama',
          mode:'object',
          history:[],
          villageKeys:{},
          reporterKeys:{},
          objectCode:r.objectId||'',
          location:r.location||'',
          latest:r
        };
      }
      var g=map[key];
      g.history.push(r);
      if(r.villageKey)g.villageKeys[r.villageKey]=1;
      if(r.reporterKey)g.reporterKeys[r.reporterKey]=1;
      if(!g.location&&r.location)g.location=r.location;
      g.objectCode=g.objectCode||r.objectId||'';
    });
    return Object.keys(map).map(function(k){
      var g=map[k];
      g.history=g.history.sort(function(a,b){return dateValue(b.date)-dateValue(a.date);});
      g.latest=g.history[0];
      return g;
    });
  }

  function applyOfficialObjectProperties(records,officialData){
    var features=Array.isArray(officialData&&officialData.features)
      ? officialData.features
      : [];
    var byId={};
    features.forEach(function(feature){
      var props=feature&&feature.properties||{};
      var id=String(props.Object_ID||'').trim();
      if(id)byId[id]=props;
    });
    records.forEach(function(record){
      var id=String(record.objectId||'').trim();
      var official=byId[id];
      if(!official)return;
      record.targetProperties=Object.assign({},record.targetProperties||{},official);
    });
  }

  function metricDefs(type){
    if(type==='Tinggi Muka Air/FDRS')return[
      ['waterTableCm','Muka air','cm'],['floatCondition','Kondisi pelampung',''],['weather','Cuaca',''],['monitoredAreaHa','Area terpantau','ha']
    ];
    if(type==='APO')return[
      ['sedimentationCm','Sedimentasi','cm'],['averageHeightCm','Tinggi mangrove','cm'],['survivalPercent','Survival','%'],['deadOrDamagedCount','Bagian rusak','']
    ];
    return[
      ['survivalPercent','Survival','%'],['aliveCount','Hidup/berfungsi',''],['deadOrDamagedCount','Mati/rusak',''],
      ['monitoredAreaHa','Luas terpantau','ha'],['averageHeightCm','Tinggi rata-rata','cm'],
      ['averageDiameterCm','Diameter rata-rata','cm'],['sedimentationCm','Sedimentasi','cm']
    ];
  }

  function metricNumber(m,keys){
    for(var i=0;i<keys.length;i+=1){
      var raw=m[keys[i]];
      if(raw===undefined||raw===null||raw==='')continue;
      var n=/area|luas/i.test(keys[i])?parseAreaNumber(raw):parseMetricNumber(raw);
      if(n!==null&&isFinite(n))return n;
    }
    return null;
  }

  function metricText(r,key,unit){
    var raw=r.metrics && r.metrics[key];
    if(raw===undefined||raw===null||raw==='')return '';
    var numValue=/area|luas/i.test(key)?parseAreaNumber(raw):parseMetricNumber(raw);
    if(numValue===null)numValue=Number(raw);
    if(numValue===null||!isFinite(numValue))return String(raw);
    return String(numValue)+(unit?' '+unit:'');
  }

  function uniqueReporters(group){
    var map={};
    group.history.forEach(function(r){
      var key=r.reporterKey||'pelapor-tidak-disebut';
      if(!map[key]){
        map[key]={
          name:r.reporter||'Pelapor tidak disebut',
          reports:0
        };
      }
      map[key].reports+=1;
    });
    return Object.keys(map).map(function(key){
      return map[key];
    }).sort(function(a,b){
      return b.reports-a.reports;
    });
  }

  function numberFormat(v){
    if(v===null||v===undefined||!isFinite(v))return '0';
    if(Math.floor(v)!==v)return v.toLocaleString('id-ID',{minimumFractionDigits:1,maximumFractionDigits:1});
    return String(Math.round(v)).toLocaleString('id-ID');
  }

  function areaFormat(v){
    var number=Number(v);
    if(!isFinite(number))return'—';
    return number.toLocaleString('id-ID',{maximumFractionDigits:3});
  }

  function metricItems(r,limit){
    var out=[];
    metricDefs(r.type).forEach(function(d){
      var metric=metricText(r,d[0],d[2]);
      if(metric!=='')out.push([d[1],metric]);
    });
    if(!out.length&&r.status&&r.status.label)out.push(['Kondisi',r.status.label]);
    return out.slice(0,limit||4);
  }

  function formatChartMetric(value,unit){
    var number=Number(value);
    if(!isFinite(number))return String(value==null?'—':value);
    var formatted=number.toLocaleString('id-ID',{
      minimumFractionDigits:unit==='%'?2:0,
      maximumFractionDigits:2
    });
    return formatted+(unit?' '+unit:'');
  }

  function chartSVG(history,definition){
    var chronological=history.slice().sort(function(a,b){return dateValue(a.date)-dateValue(b.date);});
    var points=chronological.map(function(r){
      var raw=r.metrics[definition[0]];
      return{date:r.date,value:has(raw)?(/area|luas/i.test(definition[0])?parseAreaNumber(raw):num(raw)):null};
    }).filter(function(point){return point.value!==null;});
    if(points.length<2)return'';
    var width=720,height=250,left=52,right=24,top=25,bottom=48;
    var values=points.map(function(point){return point.value;});
    var min=Math.min.apply(null,values),max=Math.max.apply(null,values);
    if(min===max){min=Math.max(0,min-1);max+=1;}
    var range=max-min;
    function x(index){return left+index*(width-left-right)/(points.length-1);}
    function y(value){return top+(max-value)*(height-top-bottom)/range;}
    var line=points.map(function(point,index){return x(index)+','+y(point.value);}).join(' ');
    var marks=points.map(function(point,index){
      return'<circle cx="'+x(index)+'" cy="'+y(point.value)+'" r="6"></circle>'+
        '<text x="'+x(index)+'" y="'+(y(point.value)-12)+'" text-anchor="middle">'+esc(formatChartMetric(point.value,definition[2]))+'</text>'+
        '<text x="'+x(index)+'" y="'+(height-17)+'" text-anchor="middle">'+esc(fmtDate(point.date))+'</text>';
    }).join('');
    return'<article class="chart-card"><div class="chart-heading"><h3>'+esc(definition[1])+'</h3><strong>'+esc(formatChartMetric(points[points.length-1].value,definition[2]))+'</strong></div>'+
      '<div class="chart-wrap"><svg viewBox="0 0 '+width+' '+height+'" role="img" aria-label="Grafik perubahan '+esc(definition[1])+'">'+
      '<line class="axis" x1="'+left+'" y1="'+(height-bottom)+'" x2="'+(width-right)+'" y2="'+(height-bottom)+'"></line>'+
      '<polyline class="trend-line" points="'+line+'"></polyline>'+marks+'</svg></div></article>';
  }

  function chartsHTML(group){
    if(!group||!group.history||group.history.length<2)return'<div class="chart-empty">Grafik pertumbuhan tersedia setelah minimal dua kali monitoring.</div>';
    var history=group.history;
    var defs=metricDefs(group.latest.type||'').filter(function(def){
      if(group.latest.type==='Penanaman Mangrove'&&def[0]==='monitoredAreaHa')return false;
      return metricNumber(history[0].metrics||{},[def[0]])!==null&&metricNumber(history[history.length-1].metrics||{},[def[0]])!==null;
    });
    var chronological=history.slice().sort(function(a,b){return dateValue(a.date)-dateValue(b.date);});
    var first=chronological[0],latest=chronological[chronological.length-1];
    var planted=metricNumber(group.latest.targetProperties||{},['Jumlah_Bib','Jumlah_Bibit','seedlings']);
    var alive=metricNumber(latest.metrics||{},['aliveCount','alive','jumlahHidup','tanamanHidup']);
    var dead=metricNumber(latest.metrics||{},['deadOrDamagedCount']);
    alive=alive===null?0:alive;
    dead=dead===null?0:dead;
    var monitoredTotal=alive+dead;
    var alivePct=monitoredTotal>0?alive/monitoredTotal*100:0;
    var deadPct=monitoredTotal>0?dead/monitoredTotal*100:0;
    var rows=defs.map(function(definition){
      var start=metricNumber(first.metrics||{},[definition[0]]),end=metricNumber(latest.metrics||{},[definition[0]]);
      if(start===null||end===null)return'';
      var delta=end-start,tone='neutral';
      if(definition[0]==='deadOrDamagedCount')tone=delta<=0?'good':'bad';
      else if(definition[0]!=='sedimentationCm')tone=delta>=0?'good':'bad';
      return'<div class="dumbbell-row '+tone+'"><div class="dumbbell-label">'+esc(definition[1])+'</div><div class="dumbbell-track"><span class="dumbbell-line"></span><span class="dumbbell-dot first"></span><span class="dumbbell-value first">'+esc(formatChartMetric(start,definition[2]))+'</span><span class="dumbbell-value latest">'+esc(formatChartMetric(end,definition[2]))+'</span><span class="dumbbell-dot latest"></span></div><div class="dumbbell-delta '+tone+'">'+esc((delta>0?'+':'')+formatChartMetric(delta,definition[2]))+'</div></div>';
    }).filter(Boolean).join('');
    if(!rows)return'<div class="chart-empty">Belum ada indikator yang dapat dibandingkan.</div>';
    return'<div class="condition-summary"><div class="condition-heading"><strong>Kondisi bibit terbaru</strong><span>'+esc(fmtDate(latest.date))+'</span></div><div class="condition-bar" aria-label="'+esc(numberFormat(alive))+' bibit hidup dan '+esc(numberFormat(dead))+' mati atau rusak"><div class="condition-part condition-alive" style="width:'+alivePct+'%"><span>'+esc(numberFormat(alive))+'<small>'+esc(numberFormat(alivePct))+'% hidup</small></span></div><div class="condition-part condition-dead" style="width:'+deadPct+'%"><span>'+esc(numberFormat(dead))+'<small>'+esc(numberFormat(deadPct))+'% mati/rusak</small></span></div></div><div class="condition-total"><span>Realisasi terkini · populasi dipantau '+esc(numberFormat(monitoredTotal))+'</span><strong>'+esc(numberFormat(planted))+' bibit pada Plot 1</strong></div></div><div class="dumbbell-chart"><div class="dumbbell-head"><strong>Indikator</strong><span><b>'+esc(fmtDate(first.date))+'</b><b>'+esc(fmtDate(latest.date))+'</b></span><strong>Perubahan</strong></div>'+rows+'</div>';
  }

  function renderKpis(group){
    var latest=group.latest;
    var latestTime=fmtDate(latest.date);
    var totalRecords=group.history.length;
    var reporters=Object.keys(group.reporterKeys||{}).length;
    var area=metricNumber(latest.targetProperties||{},['Luas_Ha','Luas','areaHa']);
    if(area===null)area=metricNumber(latest.metrics||{},['monitoredAreaHa','area','luas','luasHa','luas_ha','areaHa']);
    var alive=metricNumber(latest.metrics||{},['aliveCount','alive','jumlahHidup','tanamanHidup']);
    var baseline=metricNumber(latest.targetProperties||{},['Jumlah_Bib','Jumlah_Bibit','seedlings']);
    var reportedDead=metricNumber(latest.metrics||{},['deadOrDamagedCount','dead','mati','jumlahMati','tanamanMati','deadCount']);
    var totalPlants=baseline!==null?baseline:0;
    var dead=reportedDead;
    var monitoredTotal=alive!==null&&dead!==null?alive+dead:0;
    var alivePercent=monitoredTotal?alive/monitoredTotal*100:0;
    var deadPercent=monitoredTotal?dead/monitoredTotal*100:0;
    var kpis=[
      ['Bibit tertanam',totalPlants?numberFormat(totalPlants):'—','realisasi terkini Plot 1','primary'],
      ['Hidup',alive!==null?numberFormat(alive):'—',numberFormat(alivePercent)+'% dari populasi dipantau','alive'],
      ['Mati/rusak',dead!==null?numberFormat(dead):'—',numberFormat(deadPercent)+'% dari populasi dipantau','dead'],
      ['Survival',monitoredTotal?numberFormat(alivePercent)+'%':'—','kelangsungan hidup hasil monitoring',''],
      ['Luas polygon',area!==null?areaFormat(area)+' ha':'—','atribut terkini Plot 1','']
    ];
    kpiElement.innerHTML=kpis.map(function(item){
      return'<article class="'+esc(item[3]||'')+'"><span class="eyebrow">'+esc(item[0])+'</span><strong>'+esc(item[1])+'</strong><small class="muted">'+esc(item[2]||'')+'</small></article>';
    }).join('');
  }

  function renderInfo(group){
    var latest=group.latest;
    var reporters=uniqueReporters(group).map(function(item){
      return'<div>'+esc(item.name)+' '+(item.reports?'<span style="color:var(--muted);">('+item.reports+'x)</span>':'')+'</div>';
    }).join('');
    var targetSeedlings=metricNumber(latest.targetProperties||{},['Jumlah_Bib','Jumlah_Bibit','seedlings']);
    var targetArea=metricNumber(latest.targetProperties||{},['Luas_Ha','Luas','areaHa']);
    var itemList=[
      ['Nama objek',latest.title||group.label||'Objek monitoring'],
      ['Lokasi',latest.location||'Belum dicantumkan'],
      ['Monitoring terbaru',fmtDate(latest.date)+' · '+(latest.reporter||'Pelapor belum disebut')],
      ['Organisasi pelapor',latest.organization||'—'],
      ['Jenis monitoring',latest.type||'—'],
      ['Basis objek',targetSeedlings!==null?numberFormat(targetSeedlings)+' bibit · '+areaFormat(targetArea)+' ha':'Belum tersedia','Jumlah bibit dan luas resmi mengikuti atribut polygon.'],
      ['ID Objek',group.objectCode||'—'],
      ['Jumlah monitoring',group.history.length+' kali · '+Object.keys(group.reporterKeys||{}).length+' pelapor']
    ];
    infoElement.innerHTML=itemList.map(function(item){
      return'<div class="detail-timeline-item"><strong>'+esc(item[0])+'</strong><p>'+esc(item[1])+(item[2]?'<small class="detail-source-note">'+esc(item[2])+'</small>':'')+'</p></div>';
    }).join('')+
      '<div class="detail-timeline-item"><strong>Pelapor yang sudah melapor</strong><p>'+(reporters||'<span style="color:var(--muted);">Belum ada data pelapor</span>')+'</p></div>';
  }

  function renderHistory(group){
    if(!group.history.length){
      historyElement.innerHTML='<div class="empty">Belum ada catatan riwayat.</div>';
      return;
    }
    historyElement.innerHTML=group.history.map(function(r,index){
      var alive=metricNumber(r.metrics||{},['aliveCount','alive','jumlahHidup']);
      var reportedDead=metricNumber(r.metrics||{},['deadOrDamagedCount','dead','mati']);
      var total=alive!==null&&reportedDead!==null?alive+reportedDead:null;
      var dead=reportedDead;
      var survival=total?alive/total*100:null;
      return'<div class="detail-timeline-item">'+
        '<div class="detail-timeline-meta"><span>'+esc(fmtDate(r.date))+'</span><span class="status '+esc(r.status.key||'baik')+'">'+esc(r.status.label||'')+'</span></div>'+
        '<small style="display:block;margin-top:4px;color:var(--muted);">Pelapor: '+esc(r.reporter||'Belum disebut')+'</small>'+
        (total!==null?'<div class="history-metrics"><span>Total bibit<b>'+esc(numberFormat(total))+'</b></span><span>Hidup<b>'+esc(numberFormat(alive))+'</b></span><span>Mati/rusak<b>'+esc(numberFormat(dead))+'</b></span><span>Survival<b>'+esc(numberFormat(survival))+'%</b></span></div>':'')+
        '<p>'+esc(r.description||'Tidak ada catatan temuan.')+'</p>'+
        (r.recommendation?'<p><strong>Tindak lanjut:</strong> '+esc(r.recommendation)+'</p>':'')+
      '</div>';
    }).join('');
  }

  function renderPhotos(group){
    var latestPhotos=(group.latest.photos||[]).filter(function(url,index,array){return array.indexOf(url)===index;});
    var periods=group.history.filter(function(record){
      return record!==group.latest&&record.photos&&record.photos.length;
    }).map(function(record){
      return{date:record.date,label:'Foto laporan monitoring',photos:record.photos};
    });
    var label=String(group.label||group.latest.location||group.latest.title||'').toLowerCase();
    if(label.indexOf('kelapa pati')!==-1){
      periods.push({
        date:'16/07/2026',
        label:'Tambah Foto Kegiatan · Monitoring Penanaman Mangrove Aramco Fase 3',
        photos:[
          'https://drive.google.com/file/d/1P_shebiVd-NXp3C0rBLgiVxYK7hiI1dG/view?usp=drivesdk',
          'https://drive.google.com/file/d/1ePclkMmzTzhJ0elxXwmRcuVSmzcDqKVx/view?usp=drivesdk',
          'https://drive.google.com/file/d/15yAA7i2NoeA_-PX4S7i-BrZxIrEMZf18/view?usp=drivesdk',
          'https://drive.google.com/file/d/1hPmXUKzdIcDHpVRwtygIRTGLfJ0mpsuX/view?usp=drivesdk',
          'https://drive.google.com/file/d/1PBG76KHR-TM8psFuljLqPY3ya6Zhh8Fd/view?usp=drivesdk'
        ]
      });
    }
    var seen={};
    periods=periods.map(function(period){
      period.photos=(period.photos||[]).filter(function(url){
        if(!url||latestPhotos.indexOf(url)!==-1||seen[url])return false;
        seen[url]=true;return true;
      });
      return period;
    }).filter(function(period){return period.photos.length;});
    if(!latestPhotos.length&&!periods.length){
      photosElement.innerHTML='<div class="empty">Belum ada data foto.</div>';
      return;
    }
    var shown=latestPhotos.slice(0,12).map(function(url){
      return'<a href="'+esc(original(url))+'" target="_blank" rel="noopener"><img src="'+esc(thumb(url))+'" alt="Foto monitoring" style="max-width:100%;height:auto;border-radius:10px"></a>';
    }).join('');
    var archive=periods.map(function(period){
      var images=period.photos.map(function(url){return'<a href="'+esc(original(url))+'" target="_blank" rel="noopener"><img src="'+esc(thumb(url))+'" alt="Foto monitoring sebelumnya" loading="lazy"></a>';}).join('');
      return'<article class="photo-period"><header><strong>'+esc(fmtDate(period.date))+'</strong><span>'+period.photos.length+' foto</span></header><div class="photo-period-grid">'+images+'</div><p class="photo-period-note">'+esc(period.label)+'</p></article>';
    }).join('');
    photosElement.innerHTML=(shown?'<div class="photo-grid">'+shown+'</div>':'<div class="empty">Foto monitoring terbaru belum tersedia.</div>')+(archive?'<div class="photo-section-title"><strong>Foto monitoring sebelumnya</strong><span>'+periods.length+' periode</span></div><div class="photo-archive">'+archive+'</div>':'');
  }

  function renderMap(group){
    if(!mapElement||typeof L==='undefined')return;
    var report=group.history.find(function(item){return item.geometry&&item.geometry.coordinates;});
    if(!report){mapElement.innerHTML='<div class="chart-empty">Polygon objek belum tersedia.</div>';return;}
    if(!detailMap){
      mapElement.innerHTML='';
      detailMap=L.map(mapElement,{scrollWheelZoom:false,zoomControl:true});
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:20,attribution:'Tiles © Esri'}).addTo(detailMap);
    }
    if(detailMapLayer)detailMap.removeLayer(detailMapLayer);
    detailMapLayer=L.geoJSON(report.geometry,{style:{color:'#f6bd3b',weight:4,fillColor:'#0aa77c',fillOpacity:.22}}).addTo(detailMap);
    var bounds=detailMapLayer.getBounds();
    if(bounds.isValid())detailMap.fitBounds(bounds,{padding:[28,28],maxZoom:18});
    window.setTimeout(function(){detailMap.invalidateSize();},80);
  }

  function treeChartSVG(title,unit,records,valueKey1,valueKey2){
    var width=Math.max(1020,records.length*39+90),height=390;
    var left=58,right=24,top=28,bottom=94,plotHeight=height-top-bottom;
    var values=[];
    records.forEach(function(record){
      [record[valueKey1],record[valueKey2]].forEach(function(value){
        if(value!==null&&value!==undefined&&isFinite(value))values.push(Number(value));
      });
    });
    if(!values.length)return'';
    var max=Math.max.apply(null,values);
    var step=max>160?50:(max>80?25:(max>20?10:0.5));
    var yMax=Math.ceil(max/step)*step;
    if(yMax===0)yMax=step;
    function x(index){return left+(records.length===1?0:index*(width-left-right)/(records.length-1));}
    function y(value){return top+(yMax-Number(value))*plotHeight/yMax;}
    var grid='';
    for(var tick=0;tick<=5;tick+=1){
      var tickValue=yMax*tick/5;
      var tickY=y(tickValue);
      grid+='<line class="tree-chart-grid" x1="'+left+'" y1="'+tickY+'" x2="'+(width-right)+'" y2="'+tickY+'"></line>'+
        '<text class="tree-chart-label" x="'+(left-9)+'" y="'+(tickY+4)+'" text-anchor="end">'+esc(numberFormat(tickValue))+'</text>';
    }
    function series(key,lineClass,dotClass){
      var parts='',dots='';
      records.forEach(function(record,index){
        var value=record[key];
        if(value===null||value===undefined||!isFinite(value))return;
        if(index>0){
          var previous=records[index-1][key];
          if(previous!==null&&previous!==undefined&&isFinite(previous)){
            parts+='<line class="'+lineClass+'" x1="'+x(index-1)+'" y1="'+y(previous)+'" x2="'+x(index)+'" y2="'+y(value)+'"></line>';
          }
        }
        dots+='<circle class="'+dotClass+'" cx="'+x(index)+'" cy="'+y(value)+'" r="4"><title>'+esc(record.label+': '+numberFormat(Number(value))+' '+unit)+'</title></circle>';
      });
      return parts+dots;
    }
    var labels=records.map(function(record,index){
      return'<text class="tree-chart-label" transform="translate('+x(index)+' '+(height-bottom+20)+') rotate(-48)" text-anchor="end">'+esc(record.label)+'</text>';
    }).join('');
    return'<article class="tree-chart-card"><div class="tree-chart-head"><h3>'+esc(title)+'</h3>'+
      '<div class="tree-chart-legend"><span><i></i>Tahap I</span><span class="t2"><i></i>Tahap II</span></div></div>'+
      '<div class="tree-chart-scroll"><svg viewBox="0 0 '+width+' '+height+'" role="img" aria-label="'+esc(title+' Tahap I dan Tahap II')+'">'+
      grid+'<line class="tree-chart-axis" x1="'+left+'" y1="'+top+'" x2="'+left+'" y2="'+(height-bottom)+'"></line>'+
      '<line class="tree-chart-axis" x1="'+left+'" y1="'+(height-bottom)+'" x2="'+(width-right)+'" y2="'+(height-bottom)+'"></line>'+
      series(valueKey1,'tree-chart-t1','tree-chart-dot-t1')+series(valueKey2,'tree-chart-t2','tree-chart-dot-t2')+labels+
      '<text class="tree-chart-label" x="16" y="'+(top+plotHeight/2)+'" text-anchor="middle" transform="rotate(-90 16 '+(top+plotHeight/2)+')">'+esc(unit)+'</text>'+
      '</svg></div><div class="tree-chart-note">Geser grafik ke samping untuk melihat seluruh kode pohon. Sentuh titik untuk melihat nilainya.</div></article>';
  }

  function treeChartsHTML(records){
    return'<div class="tree-charts">'+
      treeChartSVG('Tinggi pohon','cm',records,'heightT1','heightT2')+
      treeChartSVG('Diameter batang','cm',records,'diameterT1','diameterT2')+
      '</div>';
  }

  function renderPup1FallbackTrees(){
    var records=PUP1_TREES.map(function(tree,index){
      return{
        label:(index+1)+'-'+tree[0],
        heightT1:tree[2],heightT2:tree[3],
        diameterT1:tree[5],diameterT2:tree[6]
      };
    });
    var replanting=PUP1_REPLANTING.map(function(item){
      return'<article><strong>'+esc(item[0])+'</strong><span>'+esc(item[1])+' batang · hidup</span></article>';
    }).join('');
    treesCard.hidden=false;
    treesElement.innerHTML=treeChartsHTML(records)+
      '<small class="detail-source-note">Garis terputus pada Tahap II menunjukkan pohon tanpa pengukuran karena tercatat mati. Kode D23 dan O24 yang berulang diberi nomor urut berbeda sesuai dokumen sumber.</small>'+
      '<h3>Komposisi 25 pohon sulaman</h3><p class="muted">Dokumen mencatat sulaman per jenis dan jumlah tanpa kode individual; seluruhnya hidup pada Tahap II.</p>'+
      '<div class="detail-replant-grid">'+replanting+'</div>'+
      '<small class="detail-source-note">Sumber: Laporan Monitoring Restorasi Hutan Adat Imbo Putui Tahap II, 2–3 Juni 2026.</small>';
  }

  function renderTrees(group){
    if(!treesCard||!treesElement)return;
    var reports=group.history.slice().sort(function(a,b){return dateValue(a.date)-dateValue(b.date);});
    var stages=[],rows={};
    reports.forEach(function(report){
      var trees=Array.isArray(report.metrics&&report.metrics.treeRecords)?report.metrics.treeRecords:[];
      var stage=report.metrics.pupStage||fmtDate(report.date);
      var stageKey=keyText(stage)+'|'+String(report.date||'');
      stages.push({key:stageKey,label:stage,date:report.date});
      var occurrences={};
      trees.forEach(function(tree,index){
        var id=String(tree.treeId||'').trim();
        if(!id)return;
        var normalized=keyText(id);
        occurrences[normalized]=(occurrences[normalized]||0)+1;
        var rowKey=normalized+'|'+occurrences[normalized];
        if(!rows[rowKey])rows[rowKey]={id:id,measurements:{},order:index};
        rows[rowKey].measurements[stageKey]=tree;
      });
    });
    var records=Object.keys(rows).map(function(key){
      var row=rows[key],first=row.measurements[stages[0]&&stages[0].key]||{};
      var last=row.measurements[stages[stages.length-1]&&stages[stages.length-1].key]||{};
      return{
        label:(row.order+1)+'-'+row.id,
        order:row.order,
        heightT1:num(first.heightCm),heightT2:num(last.heightCm),
        diameterT1:num(first.diameterCm),diameterT2:num(last.diameterCm)
      };
    }).sort(function(a,b){return a.order-b.order;});
    if(!records.length){
      if(String(group.objectCode||'').trim().toUpperCase()===PUP1_OBJECT_ID)renderPup1FallbackTrees();
      else treesCard.hidden=true;
      return;
    }
    treesCard.hidden=false;
    treesElement.innerHTML=treeChartsHTML(records);
  }

  function render(group){
    if(!group||!group.latest){
      renderNoData('Detail objek tidak ditemukan.');
      return;
    }
    var title=group.label||group.latest.title||titleHint||'Detail objek';
    titleElement.textContent='Detail: '+title;
    subtitleElement.textContent='Objek: '+title;
    renderKpis(group);
    growthElement.innerHTML=chartsHTML(group);
    renderHistory(group);
    renderInfo(group);
    renderPhotos(group);
    renderMap(group);
    renderTrees(group);
  }

  function renderNoData(message){
    kpiElement.innerHTML='<div class="empty">Tidak ada data: '+esc(message||'Data tidak tersedia')+'</div>';
    growthElement.innerHTML='<div class="chart-empty">Tidak ada data grafik untuk objek ini.</div>';
    historyElement.innerHTML='<div class="empty">Tidak ada riwayat laporan.</div>';
    infoElement.innerHTML='<div class="empty">Belum ada profil.</div>';
    photosElement.innerHTML='<div class="empty">Belum ada foto.</div>';
    if(mapElement)mapElement.innerHTML='<div class="chart-empty">Polygon objek belum tersedia.</div>';
    if(!titleElement.textContent||!titleElement.textContent.trim())titleElement.textContent='Detail objek';
  }

  function matchStoredGroup(saved){
    if(!saved||!saved.group||!saved.group.key)return null;
    if(objectKey&&saved.objectKey&&saved.objectKey===objectKey)return saved.group;
    if(objectKey&&saved.group.key===objectKey)return saved.group;
    if(!objectKey&&titleHint&&saved.group.label&&saved.group.label===titleHint)return saved.group;
    return null;
  }

  function loadJsonp(){
    var script=document.createElement('script');
    script.src=API+'&callback='+CALLBACK+'&t='+Date.now();
    script.async=true;
    script.onerror=function(){renderNoData('Data tidak dapat dimuat.');};
    document.head.appendChild(script);
  }

  function loadData(){
    if(typeof fetch!=='function'){
      loadJsonp();
      return;
    }
    var controller=typeof AbortController==='function'?new AbortController():null;
    var timeout=window.setTimeout(function(){
      if(controller)controller.abort();
    },45000);
    Promise.all([
      fetch(API+'&t='+Date.now(),{
        cache:'no-store',
        signal:controller?controller.signal:undefined
      }).then(function(response){
        if(!response.ok)throw new Error('HTTP '+response.status);
        return response.json();
      }),
      fetch(OFFICIAL_MANGROVE+'&t='+Date.now(),{cache:'no-store'})
        .then(function(response){return response.ok?response.json():null;})
        .catch(function(){return null;})
    ]).then(function(results){
      applyData(results[0],results[1]);
    }).catch(function(){
      loadJsonp();
    }).then(function(){
      window.clearTimeout(timeout);
    });
  }

  function applyData(data,officialData){
    var features=Array.isArray(data&&data.features)?data.features:[];
    if(!features.length&&Array.isArray(data&&data.reports))features=data.reports;
    if(!features.length&&Array.isArray(data&&data.updates))features=data.updates;
    if(!features.length&&Array.isArray(data&&data.items))features=data.items;
    if(!features.length&&Array.isArray(data&&data.data))features=data.data;
    if(!features.length&&data&&typeof data==='object'){
      var fallbackKeys=['records','reportData','result','results'];
      for(var i=0;i<fallbackKeys.length;i+=1){
        var candidate=data[fallbackKeys[i]];
        if(Array.isArray(candidate)){features=candidate;break;}
      }
    }
    var records=features.map(normalize).filter(Boolean);
    applyOfficialObjectProperties(records,officialData);
    var groups=groupData(records);
    var group=groups.find(function(g){return g.key===objectKey;});
    if(!group&&objectKey)group=groups.find(function(g){return g.objectCode===objectKey;});
    if(!group&&titleHint){
      var normalized=keyText(titleHint);
      group=groups.find(function(g){
        return keyText(g.label||'')===normalized||keyText(g.key||'')===normalized;
      });
    }
    if(!group){
      renderNoData('ID objek tidak cocok dengan data terbaru.');
      return;
    }
    render(group);
  }

  function init(){
    var savedRaw=null;
    try{savedRaw=sessionStorage.getItem(STORAGE_KEY);}catch(e){}
    if(savedRaw){
      try{
        var saved=JSON.parse(savedRaw);
        var restored=matchStoredGroup(saved);
        if(restored){
          restored.key=restored.key||saved.objectKey||objectKey;
          selectedGroup=restored;
          render(selectedGroup);
        }
      }catch(e){}
    }
    if(!objectKey&&!titleHint){
      renderNoData('Parameter objek tidak ada.');
      return;
    }
    loadData();
  }

  window[CALLBACK]=applyData;
  init();
})();

(function(){
  document.addEventListener('click',function(event){
    var link=event.target.closest('a');
    if(!link)return;
    var label=String(link.textContent||'').trim().toLowerCase();
    var href=String(link.getAttribute('href')||'').toLowerCase();
    if(label.indexOf('kembali')===-1||href.indexOf('monitoring')===-1)return;
    var referrer=document.referrer;
    if(!referrer)return;
    try{
      var previous=new URL(referrer,window.location.href);
      if(previous.origin!==window.location.origin||previous.href===window.location.href)return;
      event.preventDefault();
      window.history.back();
    }catch(error){}
  });
})();


