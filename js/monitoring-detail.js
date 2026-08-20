(function(){
  'use strict';

  var BASE='https://script.google.com/macros/s/AKfycbxUe4QyBvSiL9UJsL-nsJ5XrohDabwqhYYR9q5CTgLYiW1ZCfVy429iMlpU-lCDUSvvRg/exec';
  var API=BASE+'?page=public-reports';
  var CALLBACK='ygMonitoringDetailCallback';
  var STORAGE_KEY='monitoring-detail';
  var REPORT_CORRECTIONS={
    'YG-20260717-205241-378':{aliveCount:2730,deadOrDamagedCount:600,survivalPercent:82}
  };

  var params=new URLSearchParams(location.search);
  var objectKey=params.get('object')||'';
  var titleHint=decodeURIComponent(params.get('title')||'');
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
    var title=p.locationName||p.targetObjectName||p.title||'Objek monitoring';
    var village=p.village||p.Desa||p.WADMKD||p.kelurahan||p.desa||'';
    var reporter=firstText(p,['name','namaPelapor','nama_pelapor','pelapor','reporter','reporterName','reporter_name','createdBy','created_by','createdby','author','authorName','submittedBy','submitted_by','submitter','submitterName','submitter_name','submitterBy','fullName','namaLengkap','organization'])||firstText(m,['reporter','name','namaPelapor','nama_pelapor','pelapor','createdBy','author','authorName','userName','nama','petugas'])||'';
    var layerKey=keyText(p.targetLayerId||p.targetLayerLabel||m.monitoringType||'monitoring');
    var nameKey=keyText(p.targetObjectName||p.locationName||p.title||title);
    var targetProperties=parseJSON(p.targetFeatureProperties);
    var rawArea=targetProperties.Luas_Ha||targetProperties.Luas||targetProperties.areaHa||targetProperties.luas_ha;
    var targetArea=parseMetricNumber(rawArea);
    var boundsKey=geometryKey(feature&&feature.geometry);
    var areaKey=isFinite(targetArea)&&targetArea>0?targetArea.toFixed(4):'';
    var objectId=[layerKey,nameKey,areaKey,boundsKey].filter(Boolean).join('|');
    if(!objectId)objectId=p.targetObjectId||((p.targetSourceType||'program_layer')+'|'+(p.targetLayerId||'monitoring')+'|'+keyText(title));
    var type=typeOf(p,m);
    var correction=REPORT_CORRECTIONS[String(p.reportId||p.Source_Report_ID||'').trim()];
    if(correction)Object.keys(correction).forEach(function(key){m[key]=correction[key];});
    reconcileSurvival(m);
    return{
      id:p.monitoringId||p.reportId||index,
      objectId:objectId,
      title:title,
      type:type,
      date:p.activityDate||p.publishedAt||p.verifiedAt||p.receivedAt,
      village:village,
      villageKey:keyText(village),
      location:[village,p.district,p.regency].filter(Boolean).join(', '),
      reporter:reporter,
      reporterKey:keyText(reporter),
      organization:p.organization||'',
      description:m.notes||p.description||'',
      recommendation:m.followUp||m.recommendation||p.recommendation||'',
      photos:cleanPhotos(p.photos),
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
      var n=parseMetricNumber(raw);
      if(n!==null&&isFinite(n))return n;
    }
    return null;
  }

  function metricText(r,key,unit){
    var raw=r.metrics && r.metrics[key];
    if(raw===undefined||raw===null||raw==='')return '';
    var numValue=parseMetricNumber(raw);
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

  function metricItems(r,limit){
    var out=[];
    metricDefs(r.type).forEach(function(d){
      var metric=metricText(r,d[0],d[2]);
      if(metric!=='')out.push([d[1],metric]);
    });
    if(!out.length&&r.status&&r.status.label)out.push(['Kondisi',r.status.label]);
    return out.slice(0,limit||4);
  }

  function chartSVG(history,definition){
    var chronological=history.slice().sort(function(a,b){return dateValue(a.date)-dateValue(b.date);});
    var points=chronological.map(function(r){
      var raw=r.metrics[definition[0]];
      return{date:r.date,value:has(raw)?num(raw):null};
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
        '<text x="'+x(index)+'" y="'+(y(point.value)-12)+'" text-anchor="middle">'+esc(point.value+(definition[2]?' '+definition[2]:''))+'</text>'+
        '<text x="'+x(index)+'" y="'+(height-17)+'" text-anchor="middle">'+esc(fmtDate(point.date))+'</text>';
    }).join('');
    return'<article class="chart-card"><div class="chart-heading"><h3>'+esc(definition[1])+'</h3><strong>'+esc(points[points.length-1].value+(definition[2]?' '+definition[2]:''))+'</strong></div>'+
      '<div class="chart-wrap"><svg viewBox="0 0 '+width+' '+height+'" role="img" aria-label="Grafik perubahan '+esc(definition[1])+'">'+
      '<line class="axis" x1="'+left+'" y1="'+(height-bottom)+'" x2="'+(width-right)+'" y2="'+(height-bottom)+'"></line>'+
      '<polyline class="trend-line" points="'+line+'"></polyline>'+marks+'</svg></div></article>';
  }

  function chartsHTML(group){
    if(!group||!group.history||group.history.length<2)return'<div class="chart-empty">Grafik pertumbuhan tersedia setelah minimal dua kali monitoring.</div>';
    var defs=metricDefs(group.latest.type||'').filter(function(def){return metricNumber(group.latest.metrics||{},[def[0]])!==null;});
    var charts=defs.map(function(definition){return chartSVG(group.history,definition);}).filter(Boolean);
    return charts.length?'<div class="charts-grid">'+charts.join('')+'</div>':'<div class="chart-empty">Belum ada metrik yang bisa digrafikkan.</div>';
  }

  function renderKpis(group){
    var latest=group.latest;
    var latestTime=fmtDate(latest.date);
    var totalRecords=group.history.length;
    var reporters=Object.keys(group.reporterKeys||{}).length;
    var area=metricNumber(latest.metrics||{},['monitoredAreaHa','area','luas','luasHa','luas_ha','areaHa']);
    var alive=metricNumber(latest.metrics||{},['aliveCount','alive','jumlahHidup','tanamanHidup']);
    var dead=metricNumber(latest.metrics||{},['deadOrDamagedCount','dead','mati','jumlahMati','tanamanMati','deadCount']);
    var totalPlants=0;
    if(alive!==null&&dead!==null)totalPlants=alive+dead;
    var kpis=[
      ['Objek',''+(group.label||'—'),''],
      ['Pelapor aktif',reporters,'orang'],
      ['Laporan masuk',totalRecords,'laporan'],
      ['Status',latest.status&&latest.status.label?latest.status.label:'—',''],
      ['Luas terpantau (terbaru)',area!==null?numberFormat(area):'—','ha'],
      ['Pohon hidup',alive!==null?numberFormat(alive):'—','pohon'],
      ['Pohon mati/rusak',dead!==null?numberFormat(dead):'—','pohon'],
      ['Terakhir dipantau',latestTime,'']
    ];
    if(totalPlants){
      kpis.push(['Kondisi hidup',Math.round((alive/totalPlants)*100),'% dari '+numberFormat(totalPlants)+' tanaman']);
    }
    kpiElement.innerHTML=kpis.map(function(item){
      return'<article><span class="eyebrow">'+esc(item[0])+'</span><strong>'+esc(item[1])+'</strong><small class="muted">'+esc(item[2]||'')+'</small></article>';
    }).join('');
  }

  function renderInfo(group){
    var latest=group.latest;
    var reporters=uniqueReporters(group).map(function(item){
      return'<div>'+esc(item.name)+' '+(item.reports?'<span style="color:var(--muted);">('+item.reports+'x)</span>':'')+'</div>';
    }).join('');
    var itemList=[
      ['Nama objek',latest.title||group.label||'Objek monitoring'],
      ['Lokasi',latest.location||'Belum dicantumkan'],
      ['Pelapor terakhir',latest.reporter||'Belum disebut'],
      ['Pelapor aktif',Object.keys(group.reporterKeys||{}).length+' orang'],
      ['Organisasi',latest.organization||'—'],
      ['Jenis monitoring',latest.type||'—'],
      ['Perhitungan survival','Pohon hidup ÷ (hidup + mati/rusak)','Satu rumus untuk kartu, detail, dan grafik'],
      ['ID Objek',group.objectCode||'—'],
      ['Jumlah riwayat',group.history.length+' kali']
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
      return'<div class="detail-timeline-item">'+
        '<div class="detail-timeline-meta"><span>'+esc(fmtDate(r.date))+'</span><span class="status '+esc(r.status.key||'baik')+'">'+esc(r.status.label||'')+'</span></div>'+
        '<small style="display:block;margin-top:4px;color:var(--muted);">Pelapor: '+esc(r.reporter||'Belum disebut')+'</small>'+
        '<p>'+esc(r.description||'Tidak ada catatan temuan.')+'</p>'+
      '</div>';
    }).join('');
  }

  function renderPhotos(group){
    var photos=group.history.reduce(function(acc,r){
      if(r.photos&&r.photos.length)acc=acc.concat(r.photos);
      return acc;
    },[]);
    if(!photos.length){
      photosElement.innerHTML='<div class="empty">Belum ada data foto.</div>';
      return;
    }
    var shown=photos.slice(0,12).map(function(url){
      return'<a href="'+esc(original(url))+'" target="_blank" rel="noopener"><img src="'+esc(thumb(url))+'" alt="Foto monitoring" style="max-width:100%;height:auto;border-radius:10px"></a>';
    }).join('');
    photosElement.innerHTML='<div class="photo-grid">'+shown+'</div>';
  }

  function renderTrees(group){
    if(!treesCard||!treesElement)return;
    var records=[];
    group.history.forEach(function(report){
      var trees=Array.isArray(report.metrics&&report.metrics.treeRecords)?report.metrics.treeRecords:[];
      trees.forEach(function(tree,index){records.push({stage:report.metrics.pupStage||fmtDate(report.date),date:report.date,tree:tree,index:index});});
    });
    if(!records.length){treesCard.hidden=true;return;}
    var counts={};records.forEach(function(item){var id=String(item.tree.treeId||'').toLowerCase();if(id)counts[id]=(counts[id]||0)+1;});
    treesCard.hidden=false;
    treesElement.innerHTML='<div style="overflow-x:auto"><table style="width:100%;min-width:760px;border-collapse:collapse"><thead><tr><th>ID</th><th>Tahap</th><th>Jenis</th><th>Tinggi</th><th>Diameter</th><th>Status</th><th>Catatan</th></tr></thead><tbody>'+records.map(function(item){var t=item.tree||{},duplicate=counts[String(t.treeId||'').toLowerCase()]>1;return'<tr><td style="padding:8px;border-bottom:1px solid var(--line)"><strong>'+esc(t.treeId||'—')+'</strong>'+(duplicate?'<small style="display:block;color:#a33">ID berulang</small>':'')+'</td><td>'+esc(item.stage||'—')+'</td><td>'+esc(t.species||'—')+'</td><td>'+esc(t.heightCm||'—')+' cm</td><td>'+esc(t.diameterCm||'—')+' cm</td><td>'+esc(t.status||'—')+'</td><td>'+esc(t.notes||'—')+'</td></tr>';}).join('')+'</tbody></table></div>';
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
    renderTrees(group);
  }

  function renderNoData(message){
    kpiElement.innerHTML='<div class="empty">Tidak ada data: '+esc(message||'Data tidak tersedia')+'</div>';
    growthElement.innerHTML='<div class="chart-empty">Tidak ada data grafik untuk objek ini.</div>';
    historyElement.innerHTML='<div class="empty">Tidak ada riwayat laporan.</div>';
    infoElement.innerHTML='<div class="empty">Belum ada profil.</div>';
    photosElement.innerHTML='<div class="empty">Belum ada foto.</div>';
    if(!titleElement.textContent||!titleElement.textContent.trim())titleElement.textContent='Detail objek';
  }

  function matchStoredGroup(saved){
    if(!saved||!saved.group||!saved.group.key)return null;
    if(objectKey&&saved.objectKey&&saved.objectKey===objectKey)return saved.group;
    if(objectKey&&saved.group.key===objectKey)return saved.group;
    if(!objectKey&&titleHint&&saved.group.label&&saved.group.label===titleHint)return saved.group;
    return null;
  }

  function loadData(){
    var script=document.createElement('script');
    script.src=API+'&callback='+CALLBACK+'&t='+Date.now();
    script.async=true;
    script.onerror=function(){renderNoData('Data tidak dapat dimuat.');};
    document.head.appendChild(script);
  }

  function applyData(data){
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
          return;
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


