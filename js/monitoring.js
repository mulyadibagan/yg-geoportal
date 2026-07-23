(function(){
  'use strict';

  var BASE='https://script.google.com/macros/s/AKfycbxUe4QyBvSiL9UJsL-nsJ5XrohDabwqhYYR9q5CTgLYiW1ZCfVy429iMlpU-lCDUSvvRg/exec';
  var API=BASE+'?page=public-reports';
  var OBJECTS_API=BASE+'?page=objects';
  var CALLBACK='ygMonitoringDashboardCallback';
  var OBJECTS_CALLBACK='ygMonitoringObjectsCallback';
var LEGACY_OBJECT_ALIASES={
  'area_mangrove:auto:374024597':'MANGROVE-BURUK-BAKUL-PHASE-III-2025-001',
  'area_mangrove:auto:1281388060':'MANGROVE-KELAPA-PATI-PHASE-III-2026-001'
};
  var records=[],groups=[],masterObjects=[];
  var list=document.getElementById('monitor-list');

  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function parseJSON(v){if(!v)return{};if(typeof v==='object')return v;try{return JSON.parse(v);}catch(e){return{};}}
  function dateValue(v){var d=new Date(v||0);return isNaN(d.getTime())?new Date(0):d;}
  function fmtDate(v){var d=dateValue(v);return d.getTime()?d.toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'}):'—';}
  function has(v){return v!==undefined&&v!==null&&v!==''&&!(typeof v==='number'&&isNaN(v));}
  function num(v){var n=Number(v);return isFinite(n)?n:null;}
  function keyText(v){
    var text=String(v||'').toLowerCase();
    if(text.normalize)text=text.normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    return text.replace(/[^a-z0-9]+/g,' ').trim();
  }

  function driveId(url){
    var s=String(url||'');
    var m=s.match(/\/file\/d\/([A-Za-z0-9_-]+)/i)||s.match(/[?&]id=([A-Za-z0-9_-]+)/i);
    return m?m[1]:'';
  }
  function thumb(url){var id=driveId(url);return id?'https://drive.google.com/thumbnail?id='+encodeURIComponent(id)+'&sz=w1200':url;}
  function original(url){var id=driveId(url);return id?'https://drive.google.com/file/d/'+encodeURIComponent(id)+'/view':url;}
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
    }).filter(function(url,index,array){return /^https?:\/\//i.test(url)&&array.indexOf(url)===index;});
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
    return isFinite(bounds[0])?bounds.map(function(v){return v.toFixed(5);}).join(','):'';
  }

  function permanentId(value){
    var id=String(value||'').trim();
    if(!id||/:auto:/i.test(id)||/^MONITORING-/i.test(id))return'';
    return id;
  }

  function normalizeMaster(feature){
    var p=feature&&feature.properties||{};
    var id=permanentId(p.Object_ID||p.OBJECT_ID||p.objectId);
    if(!id)return null;
    var area=Number(String(p.Luas_Ha||p.Luas||p.areaHa||p.luas_ha||'').replace(',','.'));
    return{
      id:id,
      layer:keyText(p.Source_Layer||p.Layer_ID||p.layerId||p.Kategori),
      name:keyText(p.Nama_Objek||p.objectName||p.Nama||p.name),
      village:keyText(p.Desa||p.WADMKD||p.village),
      area:isFinite(area)&&area>0?area:null,
      bounds:geometryKey(feature&&feature.geometry)
    };
  }

  function resolveMasterObject(p,targetProperties,feature,title,targetArea){
    var legacyId=String(p.targetObjectId||'').trim();
    if(LEGACY_OBJECT_ALIASES[legacyId])return LEGACY_OBJECT_ALIASES[legacyId];
    var direct=permanentId(
      targetProperties.Object_ID||targetProperties.OBJECT_ID||targetProperties.objectId||p.Object_ID
    );
    if(direct&&masterObjects.some(function(object){return object.id===direct;}))return direct;

    var layer=keyText(p.targetLayerId||p.targetLayerLabel||targetProperties.Source_Layer||targetProperties.Layer_ID);
    var village=keyText(p.village||targetProperties.Desa||targetProperties.WADMKD);
    var name=keyText(p.targetObjectName||p.locationName||title);
    var bounds=geometryKey(feature&&feature.geometry);
    var candidates=masterObjects.filter(function(object){
      if(layer&&object.layer&&object.layer!==layer)return false;
      if(village&&object.village&&object.village!==village)return false;
      return true;
    });

    var exactBounds=candidates.filter(function(object){return bounds&&object.bounds===bounds;});
    if(exactBounds.length===1)return exactBounds[0].id;

    if(isFinite(targetArea)&&targetArea>0){
      var exactArea=candidates.filter(function(object){
        return object.area!==null&&Math.abs(object.area-targetArea)<=Math.max(0.0002,targetArea*0.001);
      });
      if(exactArea.length===1)return exactArea[0].id;
    }

    var exactName=candidates.filter(function(object){return name&&object.name===name;});
    return exactName.length===1?exactName[0].id:'';
  }

  function normalize(feature,index){
    var p=feature&&feature.properties||{};
    if(String(p.reportType||'').toLowerCase()!=='monitoring')return null;
    var m=parseJSON(p.proposedInformation);
    if(!Object.keys(m).length)m=parseJSON(p.proposedChanges).monitoring||{};
    var title=p.locationName||p.targetObjectName||p.title||'Objek monitoring';
    // ID lama dapat berubah karena perbedaan presisi koordinat. Namun nama
    // yang sama dapat dimiliki beberapa polygon, sehingga identitas riwayat
    // juga memakai luas dan batas geometri target.
    var layerKey=keyText(p.targetLayerId||p.targetLayerLabel||m.monitoringType||'monitoring');
    var nameKey=keyText(p.targetObjectName||p.locationName||p.title||title);
    var targetProperties=parseJSON(p.targetFeatureProperties);
    var rawArea=targetProperties.Luas_Ha||targetProperties.Luas||targetProperties.areaHa||targetProperties.luas_ha;
    var targetArea=Number(String(rawArea==null?'':rawArea).replace(',','.'));
    var masterObjectId=resolveMasterObject(p,targetProperties,feature,title,targetArea);
    var areaKey=isFinite(targetArea)&&targetArea>0?targetArea.toFixed(4):'';
    var boundsKey=geometryKey(feature&&feature.geometry);
    var spatialKey=[layerKey,nameKey,areaKey,boundsKey].filter(Boolean).join('|');
    var objectId=(layerKey&&nameKey&&(areaKey||boundsKey))
      ? spatialKey
      : (p.targetObjectId||((p.targetSourceType||'program_layer')+'|'+(p.targetLayerId||'monitoring')+'|'+keyText(title)));
    var type=typeOf(p,m);
    return{
      id:p.monitoringId||p.reportId||index,
      objectId:objectId,
      masterObjectId:masterObjectId,
      legacyObjectId:p.targetObjectId||'',
      title:title,
      type:type,
      date:p.activityDate||p.publishedAt||p.verifiedAt||p.receivedAt,
      location:[p.village,p.district,p.regency].filter(Boolean).join(', '),
      reporter:p.name||p.reporterName||p.createdBy||p.organization||'',
      organization:p.organization||'',
      description:m.notes||p.description||'',
      recommendation:m.followUp||m.recommendation||p.recommendation||'',
      photos:cleanPhotos(p.photos),
      metrics:m,
      status:statusOf(p,m,type)
    };
  }

  function groupData(items){
    var map={};
    items.forEach(function(r){(map[r.objectId]||(map[r.objectId]=[])).push(r);});
    return Object.keys(map).map(function(k){
      var history=map[k].sort(function(a,b){return dateValue(b.date)-dateValue(a.date);});
      var masterObjectId=history.map(function(r){return r.masterObjectId;}).filter(Boolean)[0]||'';
      var objectCode=masterObjectId||'';
      return{key:k,latest:history[0],history:history,objectCode:objectCode};
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

  function metricItems(r,limit){
    var out=[];
    metricDefs(r.type).forEach(function(d){if(has(r.metrics[d[0]]))out.push([d[1],String(r.metrics[d[0]])+(d[2]?' '+d[2]:'')]);});
    if(!out.length)out.push(['Kondisi',r.status.label]);
    if(has(r.historyCount))out.push(['Riwayat',r.historyCount+' kali']);
    return out.slice(0,limit||4);
  }

  function render(){
    var q=document.getElementById('monitor-search').value.toLowerCase();
    var type=document.getElementById('monitor-type').value;
    var status=document.getElementById('monitor-status').value;
    var year=document.getElementById('monitor-year').value;
    var sort=document.getElementById('monitor-sort').value;
    var filtered=groups.filter(function(g){
      var r=g.latest;
      return(!q||(r.title+' '+r.location+' '+r.type+' '+g.objectCode).toLowerCase().indexOf(q)>-1)&&(!type||r.type===type)&&(!status||r.status.key===status)&&(!year||dateValue(r.date).getFullYear()===Number(year));
    });
    filtered.sort(function(a,b){
      if(sort==='name')return a.latest.title.localeCompare(b.latest.title);
      if(sort==='risk'){var rank={masalah:0,waspada:1,baik:2};return rank[a.latest.status.key]-rank[b.latest.status.key];}
      return dateValue(b.latest.date)-dateValue(a.latest.date);
    });
    document.getElementById('result-count').textContent=filtered.length+' objek';
    if(!filtered.length){list.innerHTML='<div class="empty">Belum ada hasil monitoring terverifikasi yang sesuai filter.</div>';return;}
    list.innerHTML=filtered.map(function(g){
      var r=g.latest;r.historyCount=g.history.length;
      var metrics=metricItems(r,4).map(function(x){return'<div class="metric"><span>'+esc(x[0])+'</span><strong>'+esc(x[1])+'</strong></div>';}).join('');
      return'<article class="monitor-card">'+
        '<div class="card-top"><div><span class="type-label">'+esc(r.type.toUpperCase())+'</span><h3>'+esc(r.title)+'</h3><span class="location">'+esc(r.location||'Lokasi belum dicantumkan')+'</span>'+(g.objectCode?'<span class="object-code">ID objek: '+esc(g.objectCode)+'</span>':'')+'</div><span class="status '+r.status.key+'">'+esc(r.status.label)+'</span></div>'+
        '<div class="metric-grid">'+metrics+'</div>'+
        '<div class="card-actions"><small>Terakhir '+esc(fmtDate(r.date))+' · '+g.history.length+' riwayat</small><button class="link" data-detail="'+esc(g.key)+'" type="button">Lihat perkembangan →</button></div>'+
      '</article>';
    }).join('');
  }

  function stats(){
    document.getElementById('stat-total').textContent=records.length;
    document.getElementById('stat-objects').textContent=groups.length;
    var action=groups.filter(function(g){return g.latest.status.key==='masalah'||g.latest.status.key==='waspada';});
    document.getElementById('stat-action').textContent=action.length;
    var newest=records.slice().sort(function(a,b){return dateValue(b.date)-dateValue(a.date);})[0];
    document.getElementById('stat-latest').textContent=newest?fmtDate(newest.date):'—';
    document.getElementById('action-list').innerHTML=action.length?action.slice(0,6).map(function(g){
      return'<button class="action-item" data-detail="'+esc(g.key)+'" type="button"><strong>'+esc(g.latest.title)+'</strong><span>'+esc(g.latest.status.label)+' · '+esc(fmtDate(g.latest.date))+'</span></button>';
    }).join(''):'<p>Belum ada objek berstatus tindak lanjut.</p>';
  }

  function filters(){
    var types=Array.from(new Set(records.map(function(r){return r.type;}))).sort();
    document.getElementById('monitor-type').innerHTML='<option value="">Semua jenis</option>'+types.map(function(t){return'<option>'+esc(t)+'</option>';}).join('');
    document.getElementById('category-strip').innerHTML='<button class="category-chip active" data-type="">Semua</button>'+types.map(function(t){
      var n=groups.filter(function(g){return g.latest.type===t;}).length;
      return'<button class="category-chip" data-type="'+esc(t)+'">'+esc(t)+' ('+n+')</button>';
    }).join('');
    var years=Object.keys(records.reduce(function(acc,r){
      var d=dateValue(r.date);
      if(d.getTime())acc[d.getFullYear()]=true;
      return acc;
    },{})).map(Number).sort(function(a,b){return b-a;});
    document.getElementById('monitor-year').innerHTML='<option value="">Semua tahun</option>'+years.map(function(y){return'<option value="'+esc(y)+'">'+esc(y)+'</option>';}).join('');
  }

  function buildMonitoringCsv(items){
    function csvEscape(value){
      var text=value==null?'':String(value);
      if(/["\r\n,]/.test(text))text='"'+text.replace(/"/g,'""')+'"';
      return text;
    }
    var rows=[['Tanggal','Tahun','Jenis','Nama objek','Lokasi','Pelapor','Organisasi','Kondisi','Rekomendasi','Catatan','Metrics','Foto']];
    items.forEach(function(r){
      var date=dateValue(r.date);
      rows.push([
        date.getTime()?date.toISOString().slice(0,10):'',
        date.getTime()?date.getFullYear():'',
        r.type,
        r.title,
        r.location,
        r.reporter,
        r.organization,
        r.status.label,
        r.recommendation,
        r.description,
        JSON.stringify(r.metrics),
        r.photos.join('; ')
      ].map(csvEscape));
    });
    return rows.map(function(row){return row.join(',');}).join('\r\n');
  }

  function buildMonitoringJson(items){
    return JSON.stringify(items.map(function(r){
      return {
        tanggal:r.date||'',
        tahun:dateValue(r.date).getTime()?dateValue(r.date).getFullYear():null,
        jenis:r.type,
        nama_objek:r.title,
        lokasi:r.location,
        pelapor:r.reporter,
        organisasi:r.organization,
        kondisi:r.status.label,
        rekomendasi:r.recommendation,
        catatan:r.description,
        metrics:r.metrics,
        foto:r.photos
      };
    }),null,2);
  }

  function downloadFile(filename, content, type){
    var blob=new Blob([content],{type:type});
    var url=URL.createObjectURL(blob);
    var anchor=document.createElement('a');
    anchor.href=url;
    anchor.download=filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }

  function getSelectedYear(){
    var year=document.getElementById('monitor-year').value;
    return year?Number(year):null;
  }

  function recordsForSelectedYear(){
    var year=getSelectedYear();
    return year?records.filter(function(r){
      var d=dateValue(r.date);
      return d.getTime()&&d.getFullYear()===year;
    }):records.slice();
  }

  function overviewHTML(g){
    var r=g.latest;r.historyCount=g.history.length;
    var all=metricItems(r,12).filter(function(x){return x[0]!=='Riwayat';});
    var latestPhoto=r.photos.length?'<a class="latest-photo" href="'+esc(original(r.photos[0]))+'" target="_blank" rel="noopener"><img src="'+esc(thumb(r.photos[0]))+'" alt="Foto monitoring terbaru '+esc(r.title)+'"></a>':'';
    return latestPhoto+'<div class="profile-summary">'+all.map(function(x){return'<div><span>'+esc(x[0])+'</span><strong>'+esc(x[1])+'</strong></div>';}).join('')+'</div>'+
      '<div class="detail-notes"><section><h3>Temuan terakhir</h3><p>'+esc(r.description||'Belum ada catatan temuan.')+'</p></section><section><h3>Rekomendasi/tindak lanjut</h3><p>'+esc(r.recommendation||'Belum ada rekomendasi.')+'</p></section></div>';
  }

  function historyMetricsHTML(r){
    var items=metricItems(r,8).filter(function(x){return x[0]!=='Riwayat';});
    return items.length?'<div class="timeline-metrics">'+items.map(function(x){return'<span><small>'+esc(x[0])+'</small><b>'+esc(x[1])+'</b></span>';}).join('')+'</div>':'';
  }

  function historyHTML(g){
    return'<div class="timeline">'+g.history.map(function(r,index){
      var by=r.reporter?'<span class="timeline-reporter">👤 '+esc(r.reporter)+(r.organization?' · '+esc(r.organization):'')+'</span>':'';
      var photos=r.photos.length?'<button class="timeline-photo-count" data-tab-jump="photos" type="button">📷 '+r.photos.length+' foto</button>':'<span class="timeline-no-photo">Tanpa foto</span>';
      return'<article class="timeline-item '+(index===0?'latest':'')+'"><time>'+esc(fmtDate(r.date))+'</time><div class="timeline-body">'+
        '<div class="timeline-heading"><span class="status '+r.status.key+'">'+esc(r.status.label)+'</span>'+photos+'</div>'+
        historyMetricsHTML(r)+by+'<p>'+esc(r.description||'Tidak ada catatan temuan.')+'</p>'+
        (r.recommendation?'<div class="timeline-follow-up"><b>Tindak lanjut:</b> '+esc(r.recommendation)+'</div>':'')+
      '</div></article>';
    }).join('')+'</div>';
  }

  function photosHTML(g){
    var sections=g.history.map(function(r){
      if(!r.photos.length)return'';
      return'<section class="photo-period"><h3>'+esc(fmtDate(r.date))+(r.reporter?' · '+esc(r.reporter):'')+'</h3><div class="photo-grid">'+r.photos.map(function(u,i){
        return'<a href="'+esc(original(u))+'" target="_blank" rel="noopener"><img src="'+esc(thumb(u))+'" alt="Dokumentasi '+esc(r.title)+' foto '+(i+1)+'" loading="lazy"></a>';
      }).join('')+'</div></section>';
    }).filter(Boolean);
    return sections.length?sections.join(''):'<div class="empty">Belum ada foto monitoring.</div>';
  }

  function chartSVG(history,definition){
    var chronological=history.slice().sort(function(a,b){return dateValue(a.date)-dateValue(b.date);});
    var points=chronological.map(function(r){
      var raw=r.metrics[definition[0]];
      return{date:r.date,value:has(raw)?num(raw):null};
    })
      .filter(function(point){return point.value!==null;});
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
        '<text x="'+x(index)+'" y="'+(y(point.value)-12)+'" text-anchor="middle">'+esc(point.value+(definition[2]?' '+definition[2]:''))+'</text>'+
        '<text x="'+x(index)+'" y="'+(height-17)+'" text-anchor="middle">'+esc(fmtDate(point.date))+'</text>';
    }).join('');
    return'<article class="chart-card"><div class="chart-heading"><h3>'+esc(definition[1])+'</h3><strong>'+esc(points[points.length-1].value+(definition[2]?' '+definition[2]:''))+'</strong></div>'+
      '<div class="chart-wrap"><svg viewBox="0 0 '+width+' '+height+'" role="img" aria-label="Grafik perubahan '+esc(definition[1])+'">'+
      '<line class="axis" x1="'+left+'" y1="'+(height-bottom)+'" x2="'+(width-right)+'" y2="'+(height-bottom)+'"></line>'+
      '<polyline class="trend-line" points="'+line+'"></polyline>'+marks+'</svg></div></article>';
  }

  function chartsHTML(g){
    if(g.history.length<2)return'<div class="chart-empty">Grafik perubahan tersedia setelah minimal dua kali monitoring.</div>';
    var charts=metricDefs(g.latest.type).map(function(definition){return chartSVG(g.history,definition);}).filter(Boolean);
    return charts.length?'<div class="charts-grid">'+charts.join('')+'</div>':'<div class="chart-empty">Belum ada metrik yang sama pada sedikitnya dua kunjungan.</div>';
  }

  function openDetail(key){
    var g=groups.find(function(x){return x.key===key;});if(!g)return;
    var r=g.latest;
    document.getElementById('detail-content').innerHTML=
      '<div class="profile-head"><div><span class="type-label">'+esc(r.type.toUpperCase())+'</span><h2>'+esc(r.title)+'</h2><p class="location">'+esc(r.location||'Lokasi belum dicantumkan')+'</p>'+(g.objectCode?'<span class="object-code">ID objek: '+esc(g.objectCode)+'</span>':'')+'</div><div class="profile-meta"><span class="status '+r.status.key+'">'+esc(r.status.label)+'</span><small>'+g.history.length+' kali monitoring</small><small>Terakhir '+esc(fmtDate(r.date))+'</small></div></div>'+
      '<div class="detail-tabs"><button class="active" data-tab="overview" type="button">Ringkasan</button><button data-tab="charts" type="button">Grafik perubahan</button><button data-tab="history" type="button">Riwayat ('+g.history.length+')</button><button data-tab="photos" type="button">Foto ('+g.history.reduce(function(n,x){return n+x.photos.length;},0)+')</button></div>'+
      '<div class="tab-panel active" data-panel="overview">'+overviewHTML(g)+'</div>'+
      '<div class="tab-panel" data-panel="charts">'+chartsHTML(g)+'</div>'+
      '<div class="tab-panel" data-panel="history">'+historyHTML(g)+'</div>'+
      '<div class="tab-panel" data-panel="photos">'+photosHTML(g)+'</div>';
    var modal=document.getElementById('detail-modal');
    modal.classList.add('open');modal.setAttribute('aria-hidden','false');document.body.classList.add('modal-open');
  }

  function applyData(data){
    var features=data&&Array.isArray(data.features)?data.features:[];
    records=features.map(normalize).filter(Boolean);
    groups=groupData(records);
    stats();filters();render();
  }

  window[CALLBACK]=applyData;
  window[OBJECTS_CALLBACK]=function(data){
    masterObjects=(data&&Array.isArray(data.features)?data.features:[]).map(normalizeMaster).filter(Boolean);
    loadReportsScript();
  };

  ['monitor-search','monitor-type','monitor-status','monitor-sort','monitor-year'].forEach(function(id){
    document.getElementById(id).addEventListener(id==='monitor-search'?'input':'change',render);
  });

  document.getElementById('download-monitor-data').addEventListener('click',function(){
    var items=recordsForSelectedYear();
    if(!items.length){
      window.alert('Tidak ada data monitoring untuk diunduh pada tahun yang dipilih.');
      return;
    }
    var year=getSelectedYear();
    var format=document.getElementById('monitor-download-format').value;
    if(format==='json'){
      var filename='monitoring-'+(year||'semua')+'.json';
      downloadFile(filename,buildMonitoringJson(items),'application/json;charset=utf-8;');
      return;
    }
    var filename='monitoring-'+(year||'semua')+'.csv';
    downloadFile(filename,buildMonitoringCsv(items),'text/csv;charset=utf-8;');
  });

  document.addEventListener('click',function(e){
    var d=e.target.closest('[data-detail]');if(d)openDetail(d.getAttribute('data-detail'));
    var chip=e.target.closest('.category-chip');
    if(chip){
      document.querySelectorAll('.category-chip').forEach(function(c){c.classList.remove('active');});
      chip.classList.add('active');document.getElementById('monitor-type').value=chip.getAttribute('data-type');render();
    }
    var jump=e.target.closest('[data-tab-jump]');
    if(jump){
      var detail=jump.closest('#detail-content');
      var target=jump.getAttribute('data-tab-jump');
      detail.querySelectorAll('[data-tab]').forEach(function(x){x.classList.toggle('active',x.getAttribute('data-tab')===target);});
      detail.querySelectorAll('[data-panel]').forEach(function(x){x.classList.toggle('active',x.getAttribute('data-panel')===target);});
    }
    var tab=e.target.closest('[data-tab]');
    if(tab){
      var root=tab.closest('#detail-content');
      root.querySelectorAll('[data-tab]').forEach(function(x){x.classList.remove('active');});
      root.querySelectorAll('[data-panel]').forEach(function(x){x.classList.remove('active');});
      tab.classList.add('active');root.querySelector('[data-panel="'+tab.getAttribute('data-tab')+'"]').classList.add('active');
    }
    if(e.target.closest('[data-close-modal]')){
      var m=document.getElementById('detail-modal');m.classList.remove('open');m.setAttribute('aria-hidden','true');document.body.classList.remove('modal-open');
    }
  });

  document.addEventListener('keydown',function(e){
    if(e.key==='Escape'){var close=document.querySelector('[data-close-modal]');if(close)close.click();}
  });

  function loadReportsScript(){
    var script=document.createElement('script');
    script.src=API+'&callback='+CALLBACK+'&t='+Date.now();
    script.async=true;
    script.onerror=function(){list.innerHTML='<div class="empty">Data monitoring belum dapat dimuat. Periksa koneksi atau endpoint Apps Script.</div>';};
    document.head.appendChild(script);
  }

  var objectsScript=document.createElement('script');
  objectsScript.src=OBJECTS_API+'&callback='+OBJECTS_CALLBACK+'&t='+Date.now();
  objectsScript.async=true;
  objectsScript.onerror=function(){masterObjects=[];loadReportsScript();};
  document.head.appendChild(objectsScript);
})();
