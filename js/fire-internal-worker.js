'use strict';
importScripts('vendor/polygon-clipping-0.15.7.js','fire-internal-geometry.js?v=20260917-companies3');
self.onmessage=function(event){
  try{self.postMessage({ok:true,result:self.YG_FIRE_GEOMETRY.analyze(event.data)});}
  catch(error){self.postMessage({ok:false,error:error.message||'Perhitungan irisan gagal.'});}
};
