(function(){
"use strict";
var originalFetch=window.fetch.bind(window);
function norm(v){return String(v==null?"":v).trim().toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")}
window.fetch=function(input,init){
  var url=typeof input==="string"?input:(input&&input.url)||"";
  if(url.indexOf("data/social-forestry-details.json")===-1)return originalFetch(input,init);
  return Promise.all([
    originalFetch(input,init).then(function(r){return r.json()}),
    originalFetch("data/social-forestry-process-2025.json?v=20260831-rohil-correction1",{cache:"no-store"}).then(function(r){return r.json()}).catch(function(){return{profiles:[]}})
  ]).then(function(result){
    var details=result[0]||{},processData=result[1]||{},approvedSignatures={};
    Object.keys(details).forEach(function(k){
      var d=details[k]||{},signature=norm([d.name,d.village].join("|")),decree=norm(d.decree),isProcess=norm(d.legalStatus).indexOf("proses")>-1||norm(d.skDocumentStatus)==="process"||decree==="proses";
      if(d.name&&d.village&&!isProcess&&decree)approvedSignatures[signature]=true;
    });
    (processData.profiles||[]).forEach(function(p){
      if(approvedSignatures[norm([p.name,p.village].join("|"))])return;
      var key="process-2025-"+norm([p.name,p.village,p.regency].join("-"));
      if(details[key])return;
      details[key]={
        name:p.name,
        decree:"PROSES",
        scheme:p.scheme==="HD"?"Hutan Desa - dalam proses":"Hutan Kemasyarakatan - dalam proses",
        areaHa:p.areaHa,
        village:p.village,
        district:p.district,
        regency:p.regency,
        province:p.province||"Riau",
        legalStatus:"Dalam proses persetujuan",
        beneficiaries:{total:p.members,male:p.male,female:p.female},
        bpsklProfile:{status:"PROSES",sourceSheet:"2025",updatedAt:"2026-08-29"},
        documents:[],
        skDocumentStatus:"process",
        sourceUpdate:"Data Perhutanan Sosial Riau 2025"
      };
    });
    return new Response(JSON.stringify(details),{status:200,headers:{"Content-Type":"application/json"}});
  });
};
})();
