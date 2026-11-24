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
    return '<strong>Titik api Riau</strong><br>'+esc(date+' � '+time)+'<br>'+esc([p.village,p.district,p.regency].filter(Boolean).join(', ')||'Lokasi administratif tidak tersedia')+
      '<br>Satelit: '+esc(p.satellite||'-')+'<br>Koordinat: '+Number(p.latitude).toFixed(5)+', '+Number(p.longitude).toFixed(5)+
      (p.frp!=null?'<br>FRP: '+esc(p.frp)+' MW':'')+
      '<br><a href="fire-monthly-report.html?month='+month+'">Laporan '+esc(monthLabel(month))+'</a> � '+(status==='final'?'Final':'Sementara')+
      '<br><small>NASA FIRMS � deteksi panas, bukan konfirmasi kebakaran.</small>';
  }
  async function loadReports(rows,fetchJson,cache){
    return Promise.all(rows.map(async function(row){
      try{
        var key=row.month+'|'+(row.generatedAt||'');
        if(!cache[key]){
          var report=await fetchJson('data/fire-monthly/'+row.month+'.json?v='+encodeURIComponent(row.generatedAt||'1'));
          if(report.month!==row.month||report.unavailable||!Array.isArray(report.hotspots)){throw Error('Laporan belum tersedia');}
          cache[key]=report;
        }
        return {row:row,report:cache[key]};
      }catch(error){return {row:row,error:error};}
    }));
  }
  var core={entries:entries,points:points,popup:popup,loadReports:loadReports};
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
      '<span class="swatch area" style="--yg-swatch-color:#b91c1c"></span><label for="environment-layer-hotspot-history">Histori titik api Riau</label>'+
      '<div data-history-controls hidden style="grid-column:1 / -1;min-width:0;padding:4px 0 0 0">'+
      '<label for="hotspot-history-month" style="display:block;font-size:11px;margin:4px 0">Periode laporan</label>'+
      '<select id="hotspot-history-month" style="display:block;width:100%;max-width:100%;min-height:36px;border:1px solid #cbdcd3;border-radius:7px;background:#fff;color:#244337;padding:6px;font:inherit"></select>'+
      '<p data-history-status role="status" aria-live="polite" style="font-size:11px;line-height:1.5;margin:7px 0 0"></p>'+
      '<button type="button" data-history-retry hidden>Coba lagi</button></div>';
    var input=row.querySelector('input'),controls=row.querySelector('[data-history-controls]'),select=row.querySelector('select'),note=row.querySelector('[data-history-status]'),retry=row.querySelector('button');
    function options(rows,value){
      select.innerHTML='<option value="all">Semua laporan sejak Juli 2026</option>'+rows.map(function(r){return '<option value="'+r.month+'">'+esc(monthLabel(r.month))+(r.status==='final'?'':' � sementara')+'</option>';}).join('');
      select.value=rows.some(function(r){return r.month===value;})?value:'all';
    }
    async function render(refresh){
      var generation=++state.generation;
      retry.hidden=true;select.disabled=true;note.textContent='Memuat histori titik api.';
      try{
        if(refresh||!state.index){
          var index=await json('data/fire-monthly/index.json?v='+Date.now());
          if(generation!==state.generation){return;}
          state.index=index;options(entries(index),select.value);
        }
        var available=entries(state.index),selected=select.value||'all';
        var rows=available.filter(function(r){return selected==='all'||r.month===selected;});
        var results=await loadReports(rows,json,state.cache);
        if(generation!==state.generation||!input.checked){return;}
        state.layer.clearLayers();
        var count=0,loaded=0,failed=[],temporary=false;
        results.forEach(function(result){
          if(result.error){failed.push(monthLabel(result.row.month));return;}
          loaded++;temporary=temporary||result.report.status!=='final';
          points(result.report,result.row.month).forEach(function(p){
            L.circleMarker([Number(p.latitude),Number(p.longitude)],{renderer:state.renderer,radius:4,color:'#fff',weight:.8,fillColor:'#b91c1c',fillOpacity:.85})
              .bindPopup(popup(p,result.row.month,result.report.status)).addTo(state.layer);count++;
          });
        });
        if(!rows.length){note.textContent='Belum ada laporan titik api sejak Juli 2026.';}
        else{
          note.textContent=count.toLocaleString('id-ID')+' deteksi � '+loaded+' laporan'+(temporary?' � termasuk laporan sementara':' final')+'. '+
            (selected==='all'?'Arsip tersedia: '+monthLabel(available[0].month)+'-'+monthLabel(available[available.length-1].month)+'. ':'')+
            (failed.length?'Belum termuat: '+failed.join(', ')+'.':'');
        }
        retry.hidden=!failed.length;
        if(input.checked){state.layer.addTo(map);}
      }catch(error){
        if(generation!==state.generation){return;}
        state.layer.clearLayers();note.textContent='Histori titik api belum dapat dimuat. Silakan coba lagi.';retry.hidden=false;
      }finally{if(generation===state.generation){select.disabled=false;}}
    }
    input.addEventListener('change',function(){
      controls.hidden=!input.checked;
      if(input.checked){render(true);}else{state.generation++;select.disabled=false;map.removeLayer(state.layer);}
    });
    select.addEventListener('change',function(){render(false);});
    retry.addEventListener('click',function(){render(true);});
    list.appendChild(row);
    doc.dispatchEvent(new CustomEvent('yg:environment-layer-controls-ready'));
    return true;
  }
  doc.addEventListener('yg:environment-layer-controls-ready',mount);
  (function wait(){if(!mount()){root.setTimeout(wait,250);}})();
})(typeof window!=='undefined'?window:globalThis);
