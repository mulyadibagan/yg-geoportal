(function(){
  'use strict';

  var BASE='https://script.google.com/macros/s/AKfycbxUe4QyBvSiL9UJsL-nsJ5XrohDabwqhYYR9q5CTgLYiW1ZCfVy429iMlpU-lCDUSvvRg/exec';
  var REPORT_CALLBACK='ygMonitoringDashboardCallback';
  var UPDATE_CALLBACK='ygMonitoringPhotoUpdatesCallback';
  var originalCallback=window[REPORT_CALLBACK];
  var updatesReady=false;
  var updateFeatures=[];
  var pendingReports=null;

  if(typeof originalCallback!=='function') return;

  function text(value){return String(value==null?'':value).trim();}
  function keyText(value){return text(value).toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();}

  function cleanPhotos(value){
    var output=[];
    function collect(item){
      if(item==null||item==='')return;
      if(Array.isArray(item)){item.forEach(collect);return;}
      if(typeof item==='object'){
        collect(item.url||item.webViewLink||item.webContentLink||item.fileUrl||item.photoUrl||item.imageUrl||item.src||item.link||item.downloadUrl||'');
        Object.keys(item).forEach(function(k){if(/foto|photo|image|dokumentasi|attachment|file/i.test(k))collect(item[k]);});
        return;
      }
      var raw=text(item);
      if(!raw)return;
      try{var parsed=JSON.parse(raw);if(parsed!==raw){collect(parsed);return;}}catch(e){}
      var urls=raw.match(/https?:\/\/[^\s,;|"'<>\]\)]+/gi)||[];
      urls.forEach(function(url){url=url.replace(/[.,]+$/,'');if(output.indexOf(url)===-1)output.push(url);});
    }
    collect(value);
    return output;
  }

  function props(feature){return feature&&feature.properties?feature.properties:(feature||{});}
  function objectId(p){return text(p.targetObjectId||p.objectId||p.featureId||p.targetFeatureId);}
  function layerId(p){return keyText(p.targetLayerId||p.layerId||p.targetLayerLabel||p.layerLabel);}
  function title(p){return keyText(p.locationName||p.targetObjectName||p.objectName||p.title||p.location||p.namaLokasi);}

  function isPhotoUpdate(p){
    var type=keyText(p.reportType||p.type||p.updateType||p.category);
    return /tambah foto|foto kegiatan|photo|documentation/.test(type);
  }

  function matches(report,update){
    var reportId=objectId(report),updateId=objectId(update);
    if(reportId&&updateId&&reportId===updateId)return true;
    var reportTitle=title(report),updateTitle=title(update);
    if(!reportTitle||!updateTitle||reportTitle!==updateTitle)return false;
    var reportLayer=layerId(report),updateLayer=layerId(update);
    return !reportLayer||!updateLayer||reportLayer===updateLayer;
  }

  function mergeReports(data){
    if(!data||!Array.isArray(data.features)||!updateFeatures.length)return data;
    data.features.forEach(function(feature){
      var report=props(feature);
      if(keyText(report.reportType)!=='monitoring')return;
      var photos=cleanPhotos(report.photos);
      updateFeatures.forEach(function(updateFeature){
        var update=props(updateFeature);
        if(!isPhotoUpdate(update)||!matches(report,update))return;
        cleanPhotos(update.photos||update.photoUrls||update.images||update.documentation||update.attachments).forEach(function(url){
          if(photos.indexOf(url)===-1)photos.push(url);
        });
      });
      if(photos.length)report.photos=photos;
    });
    return data;
  }

  function flush(){
    if(!pendingReports)return;
    var data=pendingReports;
    pendingReports=null;
    originalCallback(mergeReports(data));
  }

  window[REPORT_CALLBACK]=function(data){
    pendingReports=data;
    if(updatesReady)flush();
    else window.setTimeout(function(){if(pendingReports)flush();},2500);
  };

  window[UPDATE_CALLBACK]=function(data){
    updateFeatures=data&&Array.isArray(data.features)?data.features:
      data&&Array.isArray(data.updates)?data.updates:
      data&&Array.isArray(data.reports)?data.reports:[];
    updatesReady=true;
    flush();
  };

  var script=document.createElement('script');
  script.src=BASE+'?page=public-updates&callback='+UPDATE_CALLBACK+'&t='+Date.now();
  script.async=true;
  script.onerror=function(){updatesReady=true;flush();};
  document.head.appendChild(script);
})();
