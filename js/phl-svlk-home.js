(function(){
"use strict";
var target=document.getElementById("dash-phl-summary");
if(!target)return;
Promise.all([
  fetch("data/PBPH_RIAU_052026.geojson?v=20260912-phl1",{cache:"no-store"}).then(function(r){if(!r.ok)throw Error();return r.json()}),
  fetch("data/pbph-documents.json?v=20260912-phl1",{cache:"no-store"}).then(function(r){if(!r.ok)throw Error();return r.json()})
]).then(function(data){
  var ids=new Set((data[0].features||[]).map(function(f){var p=f.properties||{};return String(p.PBPH_ID||[p.NAMOBJ,p.NO_SK].filter(Boolean).join("|")).trim()}));
  var verified=Object.values(data[1].profiles||{}).filter(function(p){return p.svlk&&p.svlk.status==="certificate-verified"}).length;
  target.textContent=ids.size.toLocaleString("id-ID")+" PBPH · "+verified.toLocaleString("id-ID")+" S-PHL terverifikasi · terhubung ke arsip Karhutla";
}).catch(function(){target.textContent="Direktori PBPH · status dokumen · terhubung ke arsip Karhutla"});
})();
