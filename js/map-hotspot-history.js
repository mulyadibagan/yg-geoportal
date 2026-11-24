(function(root){
  'use strict';
  var START='2026-07';
  function esc(value){return String(value==null?'':value).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function monthLabel(month){return new Date(month+'-01T00:00:00Z').toLocaleDateString('id-ID',{month:'long',year:'numeric',timeZone:'UTC'});}
  function entries(index){
    var seen=new Set();
    return (index.reports||[]).filter(function(r){
      if(!/^20\d{2}-(0[1-9]|1[0-2])$/.test(r.month||'')||r.month<START||seen.has(r.month)){return false;}
      seen.add(r.month);return true;
    }).sort(function(a,b){return a.month.localeCompare(b.month);});
  }
  function points(report,month){
    var seen=new Set();
    return (report.hotspots||[]).filter(function(p){
      var lat=p.latitude,lng=p.longitude,time=String(p.time==null?'':p.time).padStart(4,'0');
      if(lat==null||lng==null||lat===''||lng===''||!Number.isFinite(Number(lat))||!Number.isFinite(Number(lng))||Math.abs(Number(lat))>90||Math.abs(Number(lng))>180){return false;}
      if(!/^\d{4}-\d{2}-\d{2}$/.test(p.date||'')||p.date.slice(0,7)!==month){return false;}
      var key=[p.date,time,Number(lat),Number(lng),p.satellite||''].join('|');
      if(seen.has(key)){return false;}seen.add(key);return true;
    });
  }
  function popup(p,month,status){
    var date=p.date.split('-').reverse().join('/'),raw=String(p.time==null?'':p.time).padStart(4,'0');
    var time=/^([01]\d|2[0-3])[0-5]\d$/.test(raw)?raw.slice(0,2)+':'+raw.slice(2)+' UTC':'Waktu tidak tersedia';
    return '<strong>Titik api Riau</strong><br>'+esc(date+' \u00b7 '+time)+'<br>'+esc([p.village,p.district,p.regency].filter(Boolean).join(', ')||'Lokasi administratif tidak tersedia')+
      '<br>Satelit: '+esc(p.satellite||'\u2014')+'<br>Koordinat: '+Number(p.latitude).toFixed(5)+', '+Number(p.longitude).toFixed(5)+
      (p.frp!=null?'<br>FRP: '+esc(p.frp)+' MW':'')+
      (status==='recent'?'<br>Data terbaru':('<br><a href="fire-monthly-report.html?month='+month+'">Laporan '+esc(monthLabel(month))+'</a> - '+(status==='final'?'Final':'Sementara')))+
      '<br><small>NASA FIRMS \u00b7 deteksi panas, bukan konfirmasi kebakaran.</small>';
  }
  async function loadReports(rows,fetchJson,cache){
    return Promise.all(rows.map(async function(row){
      try{
        var key=row.month+'|'+(row.generatedAt||'');
        if(!cache[key]||row.status!=='final'){
          var report=await fetchJson('data/fire-monthly/'+row.month+'.json?v='+encodeURIComponent(row.generatedAt||'1'));
          if(report.month!==row.month||report.unavailable||!Array.isArray(report.hotspots)){throw Error('Laporan belum tersedia');}
          cache[key]=report;
        }
        return {row:row,report:cache[key]};
      }catch(error){return {row:row,error:error};}
    }));
  }
  function inRing(point,ring){
    var inside=false;
    for(var i=0,j=ring.length-1;i<ring.length;j=i++){
      var a=ring[i],b=ring[j];
      if((a[1]>point[1])!==(b[1]>point[1])&&point[0]<(b[0]-a[0])*(point[1]-a[1])/(b[1]-a[1])+a[0]){inside=!inside;}
    }return inside;
  }
  function recentPoints(data,boundary,finalMonths){
    var geometries=(boundary.features||[]).map(function(f){return f.geometry;});
    return (data.features||[]).filter(function(f){
      var c=f.geometry&&f.geometry.type==='Point'&&f.geometry.coordinates,p=f.properties||{};
      if(!c||!Number.isFinite(c[0])||!Number.isFinite(c[1])||String(p.acq_date||'').slice(0,7)<START||finalMonths.has(String(p.acq_date||'').slice(0,7))){return false;}
      return geometries.some(function(g){return (g.type==='Polygon'?[g.coordinates]:g.type==='MultiPolygon'?g.coordinates:[]).some(function(rings){return inRing(c,rings[0])&&!rings.slice(1).some(function(r){return inRing(c,r);});});});
    }).map(function(f){var p=f.properties||{};return {date:p.acq_date,time:p.acq_time,latitude:f.geometry.coordinates[1],longitude:f.geometry.coordinates[0],satellite:p.satellite,frp:p.frp,village:p.village,district:p.district,regency:p.regency};});
  }
  var core={entries:entries,points:points,popup:popup,loadReports:loadReports,recentPoints:recentPoints};
  if(typeof module==='object'&&module.exports){module.exports=core;return;}
  var doc=root.document;
  var state={index:null,cache:{},generation:0,layer:null,renderer:null};
  async function json(url){
    var controller=new AbortController(),timer=root.setTimeout(function(){controller.abort();},15000);
    try{var response=await root.fetch(url,{cache:'no-store',signal:controller.signal});if(!response.ok){throw Error('HTTP '+response.status);}return await response.json();}
    finally{root.clearTimeout(timer);}
  }
  function mount(){
    var list=doc.getElementById('layer-list'),api=root.YG_MAP;
    if(!list||!api||!api.map||!list.querySelector('.environment-layer-row')){return false;}
    if(doc.getElementById('environment-layer-hotspot-history')){return true;}
    var map=api.map,L=root.L;
    state.layer=L.layerGroup();state.renderer=L.canvas({padding:.3});
    var row=doc.createElement('div');
    row.className='layer-row environment-layer-row yg-hotspot-history';
    row.style.cssText='grid-template-columns:auto auto minmax(0,1fr);align-items:center';
    row.innerHTML='<input id="environment-layer-hotspot-history" type="checkbox" data-env="hotspot-history">'+
      '<span class="swatch area" style="--yg-swatch-color:#b91c1c"></span><label for="environment-layer-hotspot-history">Titik api Riau</label>'+
      '<div data-history-controls hidden style="grid-column:1 / -1;min-width:0;padding:4px 0 0 0">'+
      '<p data-history-status role="status" aria-live="polite" style="font-size:11px;line-height:1.5;margin:7px 0 0"></p>'+
      '<button type="button" data-history-retry hidden>Coba lagi</button></div>';
    var input=row.querySelector('input'),controls=row.querySelector('[data-history-controls]'),note=row.querySelector('[data-history-status]'),retry=row.querySelector('button'),busy=false,lastRefresh=0;
    async function render(refresh){
      var generation=++state.generation;
      busy=true;retry.hidden=true;note.textContent='Memuat titik api\u2026';
      try{
        if(refresh||!state.index){
          var index=await json('data/fire-monthly/index.json?v='+Date.now());
          if(generation!==state.generation){return;}
          state.index=index;
        }
        var rows=entries(state.index);
        var results=await loadReports(rows,json,state.cache);
        var recent=await Promise.allSettled([json('data/hotspot-high-confidence.geojson?v='+Date.now()),json('data/batas_provinsi_riau_dissolve.geojson')]);
        if(generation!==state.generation||!input.checked){return;}
        state.layer.clearLayers();
        var count=0,failed=[],finalMonths=new Set(),latest='';
        function add(p,month,status){
          if(p.date>latest){latest=p.date;}
          L.circleMarker([Number(p.latitude),Number(p.longitude)],{renderer:state.renderer,radius:4,color:'#fff',weight:.8,fillColor:'#b91c1c',fillOpacity:.85})
            .bindPopup(popup(p,month,status)).addTo(state.layer);count++;
        }
        results.forEach(function(result){
          if(result.error){failed.push(monthLabel(result.row.month));return;}
          if(result.report.status==='final'){finalMonths.add(result.row.month);}
          points(result.report,result.row.month).forEach(function(p){add(p,result.row.month,result.report.status);});
        });
        if(recent.every(function(r){return r.status==='fulfilled';})){
          var seen=new Set();
          results.filter(function(r){return !r.error;}).forEach(function(r){points(r.report,r.row.month).forEach(function(p){seen.add([p.date,String(p.time||'').padStart(4,'0'),Number(p.latitude).toFixed(5),Number(p.longitude).toFixed(5),p.satellite||''].join('|'));});});
          recentPoints(recent[0].value,recent[1].value,finalMonths).forEach(function(p){
            var month=String(p.date||'').slice(0,7),key=[p.date,String(p.time||'').padStart(4,'0'),Number(p.latitude).toFixed(5),Number(p.longitude).toFixed(5),p.satellite||''].join('|');
            if(!seen.has(key)&&points({hotspots:[p]},month).length){seen.add(key);add(p,month,'recent');}
          });
        }else{failed.push('data terbaru');}
        note.textContent=count.toLocaleString('id-ID')+' deteksi sejak Juli 2026'+(latest?' \u00b7 terakhir '+latest.split('-').reverse().join('/'):'')+'.'+(failed.length?' Sebagian data belum termuat.':'');
        retry.hidden=!failed.length;lastRefresh=Date.now();
        if(input.checked){state.layer.addTo(map);}
      }catch(error){
        if(generation!==state.generation){return;}
        state.layer.clearLayers();note.textContent='Histori titik api belum dapat dimuat. Silakan coba lagi.';retry.hidden=false;
      }finally{if(generation===state.generation){busy=false;}}
    }
    input.addEventListener('change',function(){
      controls.hidden=!input.checked;
      if(input.checked){render(true);}else{state.generation++;busy=false;map.removeLayer(state.layer);}
    });
    retry.addEventListener('click',function(){render(true);});
    root.setInterval(function(){if(input.checked&&!busy&&!doc.hidden){render(true);}},300000);
    doc.addEventListener('visibilitychange',function(){if(input.checked&&!busy&&!doc.hidden&&Date.now()-lastRefresh>60000){render(true);}});
    var old=doc.getElementById('environment-layer-hotspot');
    if(old){old.closest('.environment-layer-row').remove();}
    list.appendChild(row);
    doc.dispatchEvent(new CustomEvent('yg:environment-layer-controls-ready'));
    return true;
  }
  doc.addEventListener('yg:environment-layer-controls-ready',mount);
  (function wait(){if(!mount()){root.setTimeout(wait,250);}})();
})(typeof window!=='undefined'?window:globalThis);
