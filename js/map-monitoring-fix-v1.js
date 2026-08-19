(function () {
  'use strict';

  if (window.__YG_MAP_MONITORING_FIX_ACTIVE__) return;
  window.__YG_MAP_MONITORING_FIX_ACTIVE__ = true;

  var REPORTS_API = 'https://script.google.com/macros/s/AKfycbxUe4QyBvSiL9UJsL-nsJ5XrohDabwqhYYR9q5CTgLYiW1ZCfVy429iMlpU-lCDUSvvRg/exec?page=public-reports';
  var latestReportsData = null;

  function clean(v){ return String(v == null ? '' : v).trim(); }
  function normalize(v){ return clean(v).toLowerCase(); }
  function parseJson(v){ if (!v) return null; if (typeof v === 'object') return v; try { return JSON.parse(v); } catch(e){ return null; } }

  function geometryOf(feature){
    if (feature && feature.geometry) return feature.geometry;
    var p = feature && feature.properties || {};
    return parseJson(p.geometry || p.Geometry || p.geometryGeoJSON || p.Geometry_GeoJSON || p['Geometry GeoJSON']);
  }

  function monitoringOf(p){
    var direct = parseJson(p.proposedInformation) || {};
    var changes = parseJson(p.proposedChanges || p.Proposed_Changes_JSON || p['Proposed Changes JSON']) || {};
    return changes.monitoring || direct.monitoring || direct || {};
  }

  function reportTypeOf(p){
    return normalize(p.reportType || p.type || p.Jenis_Laporan || p.jenisLaporan || p['Jenis Laporan']);
  }

  function toLiveFeature(feature){
    var p = feature && feature.properties || {};
    if (reportTypeOf(p).indexOf('monitor') === -1) return null;
    var geometry = geometryOf(feature);
    if (!geometry) return null;
    var monitoring = monitoringOf(p);
    var copy = { type:'Feature', geometry:geometry, properties:Object.assign({}, p) };
    var q = copy.properties;
    q.Layer_ID = 'monitoring_reports';
    q.Layer_Label = 'Hasil Monitoring Terverifikasi';
    q.Source_Type = 'monitoring_report';
    q.Source_Report_ID = q.reportId || q.Source_Report_ID;
    q.Object_ID = q.Object_ID || ('MONITORING-' + (q.reportId || Date.now()));
    q.Nama_Objek = q.Nama_Objek || q.targetObjectName || q.locationName || q.title;
    q.Desa = q.Desa || q.village || q.desa;
    q.Kecamatan = q.Kecamatan || q.district;
    q.Kabupaten = q.Kabupaten || q.regency;
    q.Monitoring_ID = q.Monitoring_ID || q.reportId;
    q.Monitoring_Type = q.Monitoring_Type || monitoring.monitoringType;
    q.Kondisi = q.Kondisi || monitoring.condition;
    q.Survival = q.Survival || monitoring.survivalPercent;
    q.Jumlah_Hidup = q.Jumlah_Hidup || monitoring.aliveCount;
    q.Jumlah_Mati_Rusak = q.Jumlah_Mati_Rusak || monitoring.deadOrDamagedCount;
    q.Luas_Terpantau_Ha = q.Luas_Terpantau_Ha || monitoring.monitoredAreaHa;
    q.Tinggi_Rata_Rata_Cm = q.Tinggi_Rata_Rata_Cm || monitoring.averageHeightCm;
    q.Diameter_Rata_Rata_Cm = q.Diameter_Rata_Rata_Cm || monitoring.averageDiameterCm;
    q.Sedimentasi_Cm = q.Sedimentasi_Cm || monitoring.sedimentationCm;
    q.Water_Table_Cm = q.Water_Table_Cm || monitoring.waterTableCm;
    q.Ancaman = q.Ancaman || monitoring.threats;
    q.Temuan = q.Temuan || monitoring.notes;
    q.Tindak_Lanjut = q.Tindak_Lanjut || monitoring.followUp;
    q.Target_Object_ID = q.Target_Object_ID || q.targetObjectId || (parseJson(q.proposedChanges)||{}).targetObjectId;
    return copy;
  }

  function apply(data){
    latestReportsData = data;
    var api = window.YG_MAP;
    if (!api || typeof api.addLiveFeatures !== 'function') return false;
    var features = (data && Array.isArray(data.features) ? data.features : []).map(toLiveFeature).filter(Boolean);
    api.addLiveFeatures('monitoring_reports', features);
    var group = api.layerObjects && api.layerObjects.monitoring_reports;
    if (group && typeof group.eachLayer === 'function') group.eachLayer(function(layer){ if(layer.bringToFront) layer.bringToFront(); });
    return true;
  }

  function loadJsonp(){
    var callback = 'ygMonitoring_' + Date.now() + '_' + Math.floor(Math.random()*100000);
    var script = document.createElement('script');
    var done = false;
    function finish(data){
      if(done) return; done=true;
      try { delete window[callback]; } catch(e){ window[callback]=undefined; }
      if(script.parentNode) script.parentNode.removeChild(script);
      var tries=0;
      (function retry(){ tries++; if(!apply(data) && tries<80) setTimeout(retry,250); })();
    }
    window[callback]=finish;
    script.async=true;
    script.src=REPORTS_API+'&callback='+encodeURIComponent(callback)+'&t='+Date.now();
    script.onerror=function(){ finish({features:[]}); };
    document.head.appendChild(script);
    setTimeout(function(){ if(!done) finish({features:[]}); },30000);
  }

  // Always load live reports in the page itself. No dependency on PWA/service worker.
  loadJsonp();
  document.addEventListener('visibilitychange', function(){ if(!document.hidden) loadJsonp(); });
  window.addEventListener('online', loadJsonp);
})();
