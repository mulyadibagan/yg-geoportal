(function(){
  'use strict';

  var kpis=document.getElementById('compilation-kpis');
  var reporters=document.getElementById('compilation-reporters');
  var objects=document.getElementById('compilation-objects');
  var count=document.getElementById('compilation-count');
  var cluster=document.getElementById('compilation-cluster');
  var clusterValue=document.getElementById('compilation-cluster-value');
  var search=document.getElementById('compilation-search');
  var activeData=null;

  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function numberFormat(v){
    v=Number(v);
    if(!isFinite(v))return'0';
    return v.toLocaleString('id-ID',{maximumFractionDigits:1});
  }
  function dateValue(v){var d=new Date(v||0);return isNaN(d.getTime())?new Date(0):d;}
  function fmtDate(v){var d=dateValue(v);return d.getTime()?d.toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'}):'—';}
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

  function render(data){
    activeData=data;
    var summary=data.summary||{};
    var kpiItems=[
      ['Objek dipantau',summary.objects,'objek'],['Laporan masuk',summary.reports,'laporan'],
      ['Pelapor aktif',summary.reporters,'orang'],['Luas terpantau',summary.area,'ha'],
      ['Tanaman hidup',summary.alive,'pohon'],['Tanaman mati/rusak',summary.dead,'pohon'],
      ['Total tanaman',summary.totalPlants,'pohon'],['Kondisi hidup',summary.condition,'%']
    ];
    kpis.innerHTML=kpiItems.map(function(item){return'<article><span>'+esc(item[0])+'</span><strong>'+esc(numberFormat(item[1]))+'</strong><small>'+esc(item[2])+'</small></article>';}).join('');
    reporters.innerHTML=(data.reporters||[]).map(function(item){return'<span class="reporter-pill"><b>'+esc(item.name)+'</b> · '+item.reports+' laporan · '+Object.keys(item.objects||{}).length+' objek</span>';}).join('')||'<span class="muted">Belum ada nama pelapor.</span>';
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
      if(mode==='reporter'&&latest.reporterKey)values[latest.reporterKey]=latest.reporter||latest.reporterKey;
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

  document.addEventListener('click',function(event){
    var link=event.target.closest('[data-object-key]');
    if(!link)return;
    var key=link.getAttribute('data-object-key');
    var saved=null;
    try{saved=JSON.parse(sessionStorage.getItem('monitoring-compilation')||'null');}catch(e){}
    var group=saved&&saved.groups&&saved.groups.find(function(item){return item.key===key;});
    if(group){
      try{sessionStorage.setItem('monitoring-detail',JSON.stringify({objectKey:group.key,objectId:group.objectCode||'',generatedAt:Date.now(),group:group}));}catch(e){}
    }
  });

  var saved=null;
  var requestedType=new URLSearchParams(location.search).get('type')||'';
  var storageKey=requestedType?'monitoring-compilation:'+String(requestedType).toLowerCase().replace(/[^a-z0-9]+/g,' ').trim():'monitoring-compilation';
  try{saved=JSON.parse(sessionStorage.getItem(storageKey)||'null');}catch(e){}
  if(!saved||!saved.groups){
    objects.innerHTML='<div class="empty">Data kompilasi belum tersedia. Kembali ke halaman monitoring dan buka kartu kompilasi setelah data selesai dimuat.</div>';
    kpis.innerHTML='';
    reporters.innerHTML='<span class="muted">Belum ada data.</span>';
    return;
  }
  if(requestedType){
    var heading=document.querySelector('.compilation-hero h1');
    if(heading)heading.textContent='Monitoring '+requestedType;
  }
  render(saved);
  refreshClusterValues();
})();


