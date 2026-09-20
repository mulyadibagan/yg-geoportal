(function(){
  'use strict';
  var WORKER='https://yg-webgis-public-data.yg-webgis-public-data-worker.workers.dev';
  var ROUTES={
    'data/dayun-program.json':'/dayun/program.json',
    'data/dayun-map.geojson':'/dayun/map.geojson',
    'data/dayun-context.geojson':'/dayun/context.geojson',
    'data/dayun-gawangan-details.json':'/dayun/gawangan-details.json',
    'data/dayun-blocks.geojson':'/dayun/blocks.geojson'
  };
  function checkedJson(response){if(!response.ok)throw Error('HTTP '+response.status);return response.json();}
  function local(localUrl){return fetch(localUrl,{cache:'force-cache'}).then(checkedJson);}
  function fetchJSON(localUrl){
    var source=String(localUrl||''),query=source.indexOf('?')>=0?source.slice(source.indexOf('?')):'',path=source.split('?')[0].replace(/^\.\//,''),route=ROUTES[path];
    if(!route)return local(localUrl);
    if(typeof navigator!=='undefined'&&navigator.onLine===false)return local(localUrl);
    var controller=typeof AbortController==='function'?new AbortController():null,timer=controller?setTimeout(function(){controller.abort();},4000):null;
    return fetch(WORKER+route+query,{cache:'default',mode:'cors',signal:controller&&controller.signal}).then(checkedJson).catch(function(error){console.warn('Cloudflare Dayun fallback:',route,error&&error.message||error);return local(localUrl);}).finally(function(){if(timer)clearTimeout(timer);});
  }
  window.DayunDataSource={fetchJSON:fetchJSON,worker:WORKER};
})();
