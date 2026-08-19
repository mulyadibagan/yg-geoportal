(function(){
  'use strict';
  var name='ygMonitoringDashboardCallback';
  var current=window[name];
  if(typeof current!=='function')return;

  function parse(v){
    if(!v)return{};
    if(typeof v==='object')return v;
    try{return JSON.parse(v);}catch(e){return{};}
  }
  function hasMetrics(o){
    if(!o||typeof o!=='object')return false;
    return ['survivalPercent','aliveCount','deadOrDamagedCount','monitoredAreaHa','averageHeightCm','averageDiameterCm','sedimentationCm','waterTableCm'].some(function(k){return o[k]!==undefined&&o[k]!==null&&o[k]!=='';});
  }
  function merge(a,b){
    var out={},k;
    a=a&&typeof a==='object'?a:{};
    b=b&&typeof b==='object'?b:{};
    for(k in a)if(Object.prototype.hasOwnProperty.call(a,k))out[k]=a[k];
    for(k in b)if(Object.prototype.hasOwnProperty.call(b,k)&&b[k]!==undefined&&b[k]!==null&&b[k]!=='')out[k]=b[k];
    return out;
  }
  function repair(data){
    if(!data||typeof data!=='object')return data;
    var features=Array.isArray(data.features)?data.features:[];
    features.forEach(function(feature){
      var p=feature&&feature.properties;
      if(!p)return;
      var info=parse(p.proposedInformation);
      var changes=parse(p.proposedChanges);
      var monitoring=changes&&changes.monitoring&&typeof changes.monitoring==='object'?changes.monitoring:{};
      if(!hasMetrics(monitoring)&&hasMetrics(changes))monitoring=changes;
      if(hasMetrics(monitoring)){
        p.proposedInformation=merge(info,monitoring);
      }
    });
    return data;
  }

  try{delete window[name];}catch(e){}
  window[name]=function(data){return current(repair(data));};
})();
