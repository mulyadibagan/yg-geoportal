(function(){
  'use strict';

  var API='https://script.google.com/macros/s/AKfycbxUe4QyBvSiL9UJsL-nsJ5XrohDabwqhYYR9q5CTgLYiW1ZCfVy429iMlpU-lCDUSvvRg/exec?page=public-reports';
  var CALLBACK='ygMonitoringDashboardCallback';
  var EDIT_OBJECT_URL='https://script.google.com/macros/s/AKfycbxUe4QyBvSiL9UJsL-nsJ5XrohDabwqhYYR9q5CTgLYiW1ZCfVy429iMlpU-lCDUSvvRg/exec?page=edit-object';
  var records=[],groups=[];
  var list=document.getElementById('monitor-list');

  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function parseJSON(v){if(!v)return{};if(typeof v==='object')return v;try{return JSON.parse(v);}catch(e){return{};}}
  function dateValue(v){var d=new Date(v||0);return isNaN(d.getTime())?new Date(0):d;}
  function fmtDate(v){var d=dateValue(v);return d.getTime()?d.toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'}):'—';}
  function has(v){return v!==undefined&&v!==null&&v!==''&&!(typeof v==='number'&&isNaN(v));}
  function num(v){var n=Number(v);return isFinite(n)?n:null;}
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
  function waterStatus(cm){var n=num(cm);if(n===null)return null;if(n>=-20)return{key:'baik',label:'Sangat basah'};if(n>=-40)return{key:'waspada',label:'Perlu dipantau'};return{key:'masalah',label:'Waspada kering'};}
  function statusOf(p,m,type){
    if(type==='Tinggi Muka Air/FDRS'){
      var ws=waterStatus(m.waterTableCm);if(ws)return ws;
    }
    var text=String(m.condition||p.condition||p.description||'').toLowerCase();
    if(/rusak berat|hilang|kritis|tindak lanjut|kering parah|gagal/.test(text))return{key:'masalah',label:'Perlu tindak lanjut'};
    if(/sedang|rusak ringan|pantau|waspada|abrasi|hama/.test(text))return{key:'waspada',label:'Perlu dipantau'};
    return{key:'baik',label:m.condition||p.condition||'Baik/normal'};
  }
  function normalize(feature,index){
    var p=feature.properties||{};
    if(String(p.reportType||'').toLowerCase()!=='monitoring')return null;
    var m=parseJSON(p.proposedInformation);
    if(!Object.keys(m).length)m=parseJSON(p.proposedChanges).monitoring||{};
    var title=p.locationName||p.targetObjectName||p.title||'Objek monitoring';
    var objectId=p.targetObjectId||((p.targetSourceType||'program_layer')+'|'+(p.targetLayerId||'monitoring')+'|'+title.toLowerCase().trim());
    var type=typeOf(p,m);
    return{
      id:p.monitoringId||p.reportId||index,
      objectId:objectId,
      sourceType:p.targetSourceType||'program_layer',
      layerId:p.targetLayerId||'',
      title:title,
      type:type,
      date:p.activityDate||p.receivedAt||p.verifiedAt,
      location:[p.village,p.district,p.regency].filter(Boolean).join(', '),
      description:p.description||m.notes||'',
      recommendation:m.recommendation||p.recommendation||'',
      threats:m.threats||p.threats||'',
      photos:Array.isArray(p.photos)?p.photos:[],
      documentUrl:p.documentUrl||'',
      props:p,
      metrics:m,
      status:statusOf(p,m,type)
    };
  }
  function groupData(items){
    var map={};
    items.forEach(function(r){(map[r.objectId]||(map[r.objectId]=[])).push(r);});
    return Object.keys(map).map(function(k){
      var history=map[k].sort(function(a,b){return dateValue(b.date)-dateValue(a.date);});
      return{key:k,latest:history[0],history:history};
    });
  }
  function metricDefs(type){
    if(type==='Tinggi Muka Air/FDRS')return[
      ['waterTableCm','Muka air','cm'],['floatCondition','Kondisi pelampung',''],['weather','Cuaca',''],['monitoredAreaHa','Area terpantau','ha']
    ];
    if(type==='APO')return[
      ['sedimentationCm','Sedimentasi','cm'],['averageHeightCm','Tinggi mangrove','cm'],['survivalPercent','Survival','%'],['deadOrDamagedCount','Bagian rusak','']
    ];
    if(type==='Restorasi Hutan'||type==='Penanaman Mangrove'||type==='Hutan Mangrove')return[
      ['survivalPercent','Survival','%'],['averageHeightCm','Tinggi rata-rata','cm'],['averageDiameterCm','Diameter rata-rata','cm'],['sedimentationCm','Sedimentasi','cm'],['aliveCount','Hidup',''],['deadOrDamagedCount','Mati/rusak',''],['monitoredAreaHa','Luas terpantau','ha']
    ];
    return[
      ['survivalPercent','Survival','%'],['aliveCount','Hidup/berfungsi',''],['deadOrDamagedCount','Mati/rusak',''],['monitoredAreaHa','Luas','ha'],['averageHeightCm','Tinggi rata-rata','cm'],['averageDiameterCm','Diameter rata-rata','cm'],['sedimentationCm','Sedimentasi','cm']
    ];
  }
  function metricItems(r,limit){
    var m=r.metrics||{},out=[];
    metricDefs(r.type).forEach(function(d){if(has(m[d[0]]))out.push([d[1],String(m[d[0]])+(d[2]?' '+d[2]:'')]);});
    if(!out.length)out.push(['Kondisi',r.status.label]);
    out.push(['Riwayat',r.historyCount+' kali']);
    return out.slice(0,limit||4);
  }
  function render(){
    var q=document.getElementById('monitor-search').value.toLowerCase();
    var type=document.getElementById('monitor-type').value;
    var status=document.getElementById('monitor-status').value;
    var sort=document.getElementById('monitor-sort').value;
    var filtered=groups.filter(function(g){var r=g.latest;return(!q||(r.title+' '+r.location+' '+r.type).toLowerCase().indexOf(q)>-1)&&(!type||r.type===type)&&(!status||r.status.key===status);});
    filtered.sort(function(a,b){if(sort==='name')return a.latest.title.localeCompare(b.latest.title);if(sort==='risk'){var rank={masalah:0,waspada:1,baik:2};return rank[a.latest.status.key]-rank[b.latest.status.key];}return dateValue(b.latest.date)-dateValue(a.latest.date);});
    document.getElementById('result-count').textContent=filtered.length+' objek';
    if(!filtered.length){list.innerHTML='<div class="empty">Belum ada hasil monitoring terverifikasi yang sesuai filter.</div>';return;}
    list.innerHTML=filtered.map(function(g){
      var r=g.latest;r.historyCount=g.history.length;
      var metrics=metricItems(r,4).map(function(x){return'<div class="metric"><span>'+esc(x[0])+'</span><strong>'+esc(x[1])+'</strong></div>';}).join('');
      return'<article class="monitor-card">'+
        '<div class="card-top"><div><span class="type-label">'+esc(r.type.toUpperCase())+'</span><h3>'+esc(r.title)+'</h3><span class="location">'+esc(r.location||'Lokasi belum dicantumkan')+'</span></div><span class="status '+r.status.key+'">'+esc(r.status.label)+'</span></div>'+
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
    document.getElementById('stat-latest').textContent=records.length?fmtDate(records.slice().sort(function(a,b){return dateValue(b.date)-dateValue(a.date);})[0].date):'—';
    document.getElementById('action-list').innerHTML=action.length?action.slice(0,6).map(function(g){return'<button class="action-item" data-detail="'+esc(g.key)+'" type="button"><strong>'+esc(g.latest.title)+'</strong><span>'+esc(g.latest.status.label)+' · '+esc(fmtDate(g.latest.date))+'</span></button>';}).join(''):'<p>Belum ada objek berstatus tindak lanjut.</p>';
  }
  function filters(){
    var types=Array.from(new Set(records.map(function(r){return r.type;}))).sort();
    document.getElementById('monitor-type').innerHTML='<option value="">Semua jenis</option>'+types.map(function(t){return'<option>'+esc(t)+'</option>';}).join('');
    document.getElementById('category-strip').innerHTML='<button class="category-chip active" data-type="">Semua</button>'+types.map(function(t){var n=groups.filter(function(g){return g.latest.type===t;}).length;return'<button class="category-chip" data-type="'+esc(t)+'">'+esc(t)+' ('+n+')</button>';}).join('');
  }
  function series(g,key){
    return g.history.slice().reverse().map(function(r){var v=num((r.metrics||{})[key]);return v===null?null:{date:r.date,value:v};}).filter(Boolean);
  }
  function chartSVG(points,label,unit){
    if(points.length<2)return'<div class="chart-empty">Grafik akan muncul setelah minimal dua kali monitoring dengan indikator '+esc(label.toLowerCase())+'.</div>';
    var W=720,H=230,padL=48,padR=18,padT=18,padB=38;
    var vals=points.map(function(p){return p.value;});var min=Math.min.apply(null,vals),max=Math.max.apply(null,vals);if(min===max){min-=1;max+=1;}
    var x=function(i){return padL+(W-padL-padR)*(i/(points.length-1));};
    var y=function(v){return padT+(H-padT-padB)*(1-(v-min)/(max-min));};
    var line=points.map(function(p,i){return(i?'L':'M')+x(i).toFixed(1)+' '+y(p.value).toFixed(1);}).join(' ');
    var dots=points.map(function(p,i){return'<circle cx="'+x(i)+'" cy="'+y(p.value)+'" r="4"><title>'+esc(fmtDate(p.date))+': '+esc(p.value)+' '+esc(unit)+'</title></circle>';}).join('');
    var labels=points.map(function(p,i){if(points.length>6&&i!==0&&i!==points.length-1&&i%Math.ceil(points.length/5)!==0)return'';return'<text x="'+x(i)+'" y="'+(H-12)+'" text-anchor="middle">'+esc(fmtDate(p.date).replace(/\s\d{4}$/,''))+'</text>';}).join('');
    return'<div class="chart-wrap"><svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Grafik '+esc(label)+'"><line class="axis" x1="'+padL+'" y1="'+(H-padB)+'" x2="'+(W-padR)+'" y2="'+(H-padB)+'"></line><path class="trend-line" d="'+line+'"></path>'+dots+labels+'<text class="chart-max" x="6" y="'+(padT+7)+'">'+esc(max)+' '+esc(unit)+'</text><text class="chart-min" x="6" y="'+(H-padB)+'">'+esc(min)+' '+esc(unit)+'</text></svg></div>';
  }
  function overviewHTML(g){
    var r=g.latest;r.historyCount=g.history.length;
    var all=metricItems(r,12).filter(function(x){return x[0]!=='Riwayat';});
    return'<div class="profile-summary">'+all.map(function(x){return'<div><span>'+esc(x[0])+'</span><strong>'+esc(x[1])+'</strong></div>';}).join('')+'</div>'+
      '<div class="detail-notes"><section><h3>Temuan terakhir</h3><p>'+esc(r.description||'Belum ada catatan temuan.')+'</p></section><section><h3>Rekomendasi/tindak lanjut</h3><p>'+esc(r.recommendation||'Belum ada rekomendasi.')+'</p></section></div>';
  }
  function developmentHTML(g){
    var defs=metricDefs(g.latest.type).filter(function(d){return ['survivalPercent','averageHeightCm','averageDiameterCm','sedimentationCm','waterTableCm','aliveCount','deadOrDamagedCount'].indexOf(d[0])>-1;});
    var blocks=defs.map(function(d){var pts=series(g,d[0]);if(!pts.length)return'';return'<section class="chart-card"><div class="chart-heading"><h3>'+esc(d[1])+'</h3><strong>'+esc(pts[pts.length-1].value)+' '+esc(d[2])+'</strong></div>'+chartSVG(pts,d[1],d[2])+'</section>';}).filter(Boolean);
    return blocks.length?'<div class="charts-grid">'+blocks.join('')+'</div>':'<div class="empty">Belum ada indikator numerik yang dapat dibuat grafik.</div>';
  }
  function historyHTML(g){
    return'<div class="timeline">'+g.history.map(function(r){var m=r.metrics||{},items=[];metricDefs(r.type).forEach(function(d){if(has(m[d[0]]))items.push('<span><b>'+esc(d[1])+':</b> '+esc(m[d[0]])+(d[2]?' '+esc(d[2]):'')+'</span>');});return'<article class="timeline-item"><time>'+esc(fmtDate(r.date))+'</time><div class="timeline-body"><div class="timeline-metrics">'+items.join('')+'</div><p>'+esc(r.description||m.notes||'Tidak ada catatan.')+'</p>'+(r.recommendation?'<p><b>Tindak lanjut:</b> '+esc(r.recommendation)+'</p>':'')+'</div></article>';}).join('')+'</div>';
  }
  function photosHTML(g){
    var sections=g.history.map(function(r){if(!r.photos||!r.photos.length)return'';return'<section class="photo-period"><h3>'+esc(fmtDate(r.date))+'</h3><div class="photo-grid">'+r.photos.map(function(u,i){return'<a href="'+esc(u)+'" target="_blank" rel="noopener"><img src="'+esc(u)+'" alt="Dokumentasi '+esc(r.title)+' foto '+(i+1)+'" loading="lazy"></a>';}).join('')+'</div></section>';}).filter(Boolean);
    return sections.length?sections.join(''):'<div class="empty">Belum ada foto monitoring.</div>';
  }
  function openDetail(key){
    var g=groups.find(function(x){return x.key===key;});if(!g)return;
    var r=g.latest;
    document.getElementById('detail-content').innerHTML=
      '<div class="profile-head"><div><span class="type-label">'+esc(r.type.toUpperCase())+'</span><h2 id="detail-title">'+esc(r.title)+'</h2><p class="location">'+esc(r.location||'Lokasi belum dicantumkan')+'</p></div><div class="profile-meta"><span class="status '+r.status.key+'">'+esc(r.status.label)+'</span><small>'+g.history.length+' kali monitoring</small><small>Terakhir '+esc(fmtDate(r.date))+'</small><a class="edit-object-button" href="'+esc(EDIT_OBJECT_URL+'&reportId='+encodeURIComponent(r.id))+'" target="_blank" rel="noopener">✏ Perbaiki objek</a></div></div>'+
      '<div class="detail-tabs" role="tablist"><button class="active" data-tab="overview" type="button">Ringkasan</button><button data-tab="development" type="button">Perkembangan</button><button data-tab="history" type="button">Riwayat</button><button data-tab="photos" type="button">Foto</button></div>'+
      '<div class="tab-panel active" data-panel="overview">'+overviewHTML(g)+'</div>'+
      '<div class="tab-panel" data-panel="development">'+developmentHTML(g)+'</div>'+
      '<div class="tab-panel" data-panel="history">'+historyHTML(g)+'</div>'+
      '<div class="tab-panel" data-panel="photos">'+photosHTML(g)+'</div>';
    var modal=document.getElementById('detail-modal');modal.classList.add('open');modal.setAttribute('aria-hidden','false');document.body.classList.add('modal-open');
  }

  window[CALLBACK]=function(data){var features=data&&Array.isArray(data.features)?data.features:[];records=features.map(normalize).filter(Boolean);groups=groupData(records);stats();filters();render();};
  ['monitor-search','monitor-type','monitor-status','monitor-sort'].forEach(function(id){document.getElementById(id).addEventListener(id==='monitor-search'?'input':'change',render);});
  document.addEventListener('click',function(e){
    var d=e.target.closest('[data-detail]');if(d)openDetail(d.getAttribute('data-detail'));
    var chip=e.target.closest('.category-chip');if(chip){document.querySelectorAll('.category-chip').forEach(function(c){c.classList.remove('active');});chip.classList.add('active');document.getElementById('monitor-type').value=chip.getAttribute('data-type');render();}
    var tab=e.target.closest('[data-tab]');if(tab){var root=tab.closest('#detail-content');root.querySelectorAll('[data-tab]').forEach(function(x){x.classList.remove('active');});root.querySelectorAll('[data-panel]').forEach(function(x){x.classList.remove('active');});tab.classList.add('active');root.querySelector('[data-panel="'+tab.getAttribute('data-tab')+'"]').classList.add('active');}
    if(e.target.closest('[data-close-modal]')){var m=document.getElementById('detail-modal');m.classList.remove('open');m.setAttribute('aria-hidden','true');document.body.classList.remove('modal-open');}
  });
  document.addEventListener('keydown',function(e){if(e.key==='Escape'){var close=document.querySelector('[data-close-modal]');if(close)close.click();}});
  var script=document.createElement('script');script.src=API+'&callback='+CALLBACK+'&t='+Date.now();script.async=true;script.onerror=function(){list.innerHTML='<div class="empty">Data monitoring belum dapat dimuat. Periksa koneksi atau endpoint Apps Script.</div>';};document.head.appendChild(script);
})();
