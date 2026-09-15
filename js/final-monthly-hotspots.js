(function(){
  "use strict";
  function el(id){return document.getElementById(id);}
  function esc(value){return String(value==null?"":value).replace(/[&<>"']/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];});}
  function monthLabel(value){var parts=String(value||"").split("-"),date=new Date(Date.UTC(Number(parts[0]),Number(parts[1])-1,1));return isNaN(date)?value:date.toLocaleDateString("id-ID",{month:"long",year:"numeric",timeZone:"UTC"});}
  function pointInRing(point,ring){var inside=false;for(var i=0,j=ring.length-1;i<ring.length;j=i++){var a=ring[i],b=ring[j];if(((a[1]>point[1])!==(b[1]>point[1]))&&point[0]<(b[0]-a[0])*(point[1]-a[1])/((b[1]-a[1])||Number.EPSILON)+a[0])inside=!inside;}return inside;}
  function pointInGeometry(point,geometry){var polygons=geometry&&geometry.type==="Polygon"?[geometry.coordinates]:geometry&&geometry.type==="MultiPolygon"?geometry.coordinates:[];return polygons.some(function(polygon){return polygon[0]&&pointInRing(point,polygon[0])&&!polygon.slice(1).some(function(hole){return pointInRing(point,hole);});});}
  function mergePolygonGeometries(features){var polygons=[];(features||[]).forEach(function(feature){var geometry=feature&&feature.geometry;if(!geometry)return;if(geometry.type==="Polygon")polygons.push(geometry.coordinates);if(geometry.type==="MultiPolygon")polygons=polygons.concat(geometry.coordinates);});return polygons.length?{type:"MultiPolygon",coordinates:polygons}:null;}
  async function json(url){var response=await fetch(url,{cache:"no-store"});if(!response.ok)throw new Error("HTTP "+response.status);return response.json();}
  async function mount(options){
    var select=el(options.selectId||"hotspot-month-select"),summary=el(options.summaryId||"hotspot-summary"),status=el(options.statusId||"hotspot-month-status"),body=el(options.tableBodyId||"hotspot-month-list"),link=el(options.linkId||"hotspot-report-link"),annualList=el(options.annualListId||"hotspot-annual-list"),annualStatus=el(options.annualStatusId||"hotspot-annual-status"),cache={};
    if(!select||!summary||!status||!body)return;
    if(!options.geometry){status.textContent="Polygon analisis tidak tersedia; hotspot tidak dihitung.";return;}
    function render(report){
      var points=(report.hotspots||[]).filter(function(point){return Number.isFinite(Number(point.longitude))&&Number.isFinite(Number(point.latitude))&&pointInGeometry([Number(point.longitude),Number(point.latitude)],options.geometry);});
      var days=new Set(points.map(function(point){return point.date;}));
      summary.innerHTML='<div class="vp-hotspot-box"><span>Hotspot bulan terpilih</span><strong>'+points.length.toLocaleString("id-ID")+'</strong></div><div class="vp-hotspot-box"><span>Hari dengan deteksi</span><strong>'+days.size.toLocaleString("id-ID")+'</strong></div>';
      status.textContent="Laporan final · "+report.period.start+" sampai "+report.period.end+" · titik di dalam polygon profil";
      body.innerHTML=points.length?points.slice().sort(function(a,b){return String(b.date+b.time).localeCompare(String(a.date+a.time));}).map(function(point){return'<tr><td>'+esc(point.date)+' '+esc(String(point.time||"").padStart(4,"0"))+'</td><td>'+esc(point.satellite||"—")+'</td><td>'+(point.frp==null?'—':Number(point.frp).toLocaleString("id-ID",{maximumFractionDigits:2})+' MW')+'</td><td>'+Number(point.latitude).toFixed(5)+', '+Number(point.longitude).toFixed(5)+'</td></tr>';}).join(""):'<tr><td colspan="4" class="vp-monthly-empty">Tidak ada hotspot high-confidence di dalam polygon pada bulan ini.</td></tr>';
      if(link)link.href="fire-monthly-report.html?month="+encodeURIComponent(report.month);
      if(typeof options.onPoints==="function")options.onPoints(points,report);
    }
    async function selectMonth(month){
      var meta=(options.reports||[]).find(function(report){return report.month===month;});if(!meta)return;
      status.textContent="Memuat laporan final "+monthLabel(month)+"…";
      try{cache[month]=cache[month]||await json(meta.data+"?v="+encodeURIComponent(meta.generatedAt||"1"));render(cache[month]);}
      catch(error){console.error(error);status.textContent="Laporan final bulan ini belum berhasil dimuat.";body.innerHTML='<tr><td colspan="4" class="vp-monthly-empty">Data belum tersedia.</td></tr>';}
    }
    async function loadAnnual(){
      if(!annualList||!annualStatus||!options.annualType)return;
      try{
        var data=await json("data/fire-monthly/profile-annual.json?v="+encodeURIComponent(options.indexUpdatedAt||"1")),keys=(options.annualKeys||[]).map(function(value){return String(value||"").trim().toLowerCase();}).filter(Boolean),yearly={};
        if(options.annualType==="village"){for(var i=0;i<keys.length;i++){if(data.villages&&data.villages[keys[i]]){yearly=data.villages[keys[i]];break;}}}
        if(options.annualType==="socialForestry"){var profile=(data.socialForestry||[]).find(function(item){return(item.keys||[]).some(function(key){return keys.indexOf(String(key).toLowerCase())!==-1;});});yearly=profile&&profile.yearly||{};}
        annualList.innerHTML=(data.years||[]).map(function(meta){var value=yearly[meta.year]||{hotspots:0,detectionDays:0},months=meta.months||[],coverage=months.length?(monthLabel(months[0])+(months.length>1?" – "+monthLabel(months[months.length-1]):"")):"Belum ada bulan final";return'<div class="vp-annual-row"><strong>'+esc(meta.year)+'</strong><span>'+Number(value.hotspots||0).toLocaleString("id-ID")+' hotspot</span><span>'+Number(value.detectionDays||0).toLocaleString("id-ID")+' hari deteksi</span><small>'+esc(coverage)+' · '+months.length+' laporan bulanan final</small></div>';}).join("")||'<p class="vp-monthly-empty">Belum ada rekap tahunan final.</p>';
        annualStatus.textContent="Rekap dihitung sejak Juli 2026. Tahun 2026 bukan periode Januari–Desember penuh.";
      }catch(error){console.error(error);annualStatus.textContent="Rekap tahunan belum berhasil dimuat.";}
    }
    select.innerHTML=(options.reports||[]).map(function(report){return'<option value="'+esc(report.month)+'">'+esc(monthLabel(report.month))+' · Final</option>';}).join("");
    select.onchange=function(){selectMonth(select.value);};
    if(!select.options.length){status.textContent="Belum ada laporan bulanan final.";body.innerHTML='<tr><td colspan="4" class="vp-monthly-empty">Laporan belum tersedia.</td></tr>';return;}
    await selectMonth(select.value);
    var schedule=window.requestIdleCallback||function(callback){window.setTimeout(callback,0);};schedule(loadAnnual,{timeout:1500});
  }
  async function init(options){
    var status=el(options.statusId||"hotspot-month-status");
    try{var index=await json("data/fire-monthly/index.json?v="+Date.now()),reports=(index.reports||[]).filter(function(report){return report.status==="final";});await mount(Object.assign({},options,{reports:reports,indexUpdatedAt:index.updatedAt}));}
    catch(error){console.error(error);if(status)status.textContent="Indeks laporan bulanan final belum berhasil dimuat.";}
  }
  window.YGFinalMonthlyHotspots={init:init,pointInGeometry:pointInGeometry,mergePolygonGeometries:mergePolygonGeometries};
})();
