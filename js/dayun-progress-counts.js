(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.YG_DAYUN_PROGRESS_COUNTS=api;})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  function compute(original,effective,zoneIds){
    const old=new Map(original.map(f=>[f.properties.id,f])),now=new Map(effective.filter(f=>f.properties.status!=='rejected').map(f=>[f.properties.id,f]));
    const rows=new Map([...new Set([...zoneIds,'UNASSIGNED'])].map(id=>[id,{zone_id:id,initial:new Set(),current:new Set()}]));
    function add(features,key){for(const [id,f]of features){const ids=f.properties.zones?.length?[...new Set(f.properties.zones)]:['UNASSIGNED'];for(const zone of ids)rows.get(zone)?.[key].add(id);}}
    add(old,'initial');add(now,'current');
    function compare(a,b){return{initial:a.size,added:[...b].filter(id=>!a.has(id)).length,removed:[...a].filter(id=>!b.has(id)).length,current:b.size};}
    return{schema:'dayun-team-progress-v1',...compare(new Set(old.keys()),new Set(now.keys())),zones:[...rows.values()].map(r=>({zone_id:r.zone_id,...compare(r.initial,r.current)})),census_changed:false};
  }
  return{compute};
});
