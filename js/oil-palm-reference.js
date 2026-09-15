(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.YGOilPalmReference=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  var VERSION='georspo-riau-growers-20260912-v1';
  function ring(p,r){var inside=false;for(var i=0,j=r.length-1;i<r.length;j=i++){var a=r[i],b=r[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside}return inside}
  function polygon(p,r){return r.length&&ring(p,r[0])&&!r.slice(1).some(function(h){return ring(p,h)})}
  function contains(p,g){return g.type==='Polygon'?polygon(p,g.coordinates):g.type==='MultiPolygon'&&g.coordinates.some(function(r){return polygon(p,r)})}
  function index(geo){
    if(!geo||geo.type!=='FeatureCollection'||!Array.isArray(geo.features)||geo.referenceVersion!==VERSION)throw Error('Versi area perkebunan anggota RSPO tidak sesuai');
    return geo.features.map(function(f){
      if(!f.geometry||!['Polygon','MultiPolygon'].includes(f.geometry.type)||!f.properties.COMPANY_ID)throw Error('Polygon perusahaan tidak valid');
      var b=[Infinity,Infinity,-Infinity,-Infinity];
      (function visit(c){if(typeof c[0]==='number'){b[0]=Math.min(b[0],c[0]);b[1]=Math.min(b[1],c[1]);b[2]=Math.max(b[2],c[0]);b[3]=Math.max(b[3],c[1])}else c.forEach(visit)})(f.geometry.coordinates);
      return {feature:f,bounds:b};
    });
  }
  function attach(hotspots,geo){
    var units=index(geo),total=0;
    (hotspots.features||[]).forEach(function(f){
      f.properties=f.properties||{};delete f.properties.oilPalmCompanyRef;
      if(!f.geometry||f.geometry.type!=='Point')return;
      var p=f.geometry.coordinates,matches=new Map();
      units.forEach(function(u){var b=u.bounds;if(p[0]<b[0]||p[0]>b[2]||p[1]<b[1]||p[1]>b[3]||!contains(p,u.feature.geometry))return;
        var a=u.feature.properties;matches.set(a.COMPANY_ID,{id:a.COMPANY_ID,name:a.PO_COMPANY,group:a.RSPO_GROUP,supplyBase:a.SUPPLY_BASE,regency:a.REFERENCE_DISTRICTS,referenceVersion:VERSION});
      });
      if(matches.size){f.properties.oilPalmCompanyRef=Array.from(matches.values()).sort(function(a,b){return a.id.localeCompare(b.id)});total++}
    });
    return total;
  }
  return {version:VERSION,attach:attach};
});
