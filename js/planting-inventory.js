(function(root,factory){var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.YG_PLANTING_INVENTORY=api;})(typeof window==='undefined'?globalThis:window,function(){
'use strict';
function number(value){if(value==null||String(value).trim()==='')return null;var n=Number(value);return Number.isFinite(n)?n:null;}
function normalized(value){return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();}
  function mergeFeatureCollections(primary,collections){
    var merged=[],seen={};
    [primary].concat(collections||[]).forEach(function(collection){
      var features=Array.isArray(collection&&collection.features)?collection.features:[];
      features.forEach(function(feature){
        var p=feature&&feature.properties||{},id=String(p.Object_ID||p.Source_Object_ID||"").trim();
        var dedupe=id?"id:"+id:[layerId(feature),p.Nama_Objek||p.title||"",JSON.stringify(feature&&feature.geometry||null)].join("|");
        if(seen[dedupe]){
          var existing=seen[dedupe].properties;
          if((existing.Jumlah_Tanam==null||String(existing.Jumlah_Tanam).trim()==="")&&number(p.Jumlah_Tanam)>0){
            existing.Jumlah_Tanam=p.Jumlah_Tanam;
            existing.Riwayat_Penanaman=p.Riwayat_Penanaman||existing.Riwayat_Penanaman;
            existing.Sumber_Data=p.Sumber_Data||existing.Sumber_Data;
          }
          return;
        }
        var copy=Object.assign({},feature,{properties:Object.assign({},p)});seen[dedupe]=copy;merged.push(copy);
      });
    });
    return merged;
  }
  function layerId(feature){var p=feature&&feature.properties||{};return String(p.Layer_ID||p.Source_Layer||"").toLowerCase();}
  function sourceType(feature){var p=feature&&feature.properties||{};return String(p.Source_Type||"").toLowerCase();}
  function isActivityFeature(feature){
    var id=layerId(feature),type=sourceType(feature);
    return ["community_report","monitoring_report","titik_penanaman"].indexOf(type)!==-1||["community_reports","monitoring_reports","titik_penanaman"].indexOf(id)!==-1;
  }
  function placeAliases(feature,name){
    var props=feature&&feature.properties||{},aliases=Array.isArray(props.Intervention_Aliases)?props.Intervention_Aliases:[];
    return [name,props.Intervention_Source_Name].concat(aliases).map(normalized).filter(Boolean);
  }
  function containsPlace(value,aliases){
    var text=" "+normalized(value)+" ";
    return aliases.some(function(alias){return text.indexOf(" "+alias+" ")!==-1;});
  }
  function pointInRing(point,ring){
    if(!point||!Array.isArray(ring)){return false;}
    var x=point[0],y=point[1],inside=false;
    for(var i=0,j=ring.length-1;i<ring.length;j=i++){
      var xi=ring[i][0],yi=ring[i][1],xj=ring[j][0],yj=ring[j][1];
      var crosses=((yi>y)!==(yj>y))&&(x<(xj-xi)*(y-yi)/(yj-yi)+xi);
      if(crosses){inside=!inside;}
    }
    return inside;
  }
  function pointInGeometry(point,geometry){
    if(!geometry||!point){return false;}
    var polygons=geometry.type==="Polygon"?[geometry.coordinates]:(geometry.type==="MultiPolygon"?geometry.coordinates:[]);
    return polygons.some(function(polygon){
      return polygon.length&&pointInRing(point,polygon[0])&&!polygon.slice(1).some(function(hole){return pointInRing(point,hole);});
    });
  }
  function representativePoint(geometry){
    if(!geometry||!Array.isArray(geometry.coordinates)){return null;}
    if(geometry.type==="Point"){return geometry.coordinates;}
    if(geometry.type==="MultiPoint"||geometry.type==="LineString"){return geometry.coordinates[Math.floor(geometry.coordinates.length/2)]||null;}
    var ring=geometry.type==="Polygon"?geometry.coordinates[0]:(geometry.type==="MultiPolygon"&&geometry.coordinates[0]?geometry.coordinates[0][0]:null);
    if(!Array.isArray(ring)||!ring.length){return null;}
    var total=ring.reduce(function(sum,point){sum[0]+=point[0];sum[1]+=point[1];return sum;},[0,0]);
    return [total[0]/ring.length,total[1]/ring.length];
  }
  function segmentIntersects(a,b,c,d){
    if(!a||!b||!c||!d){return false;}
    var epsilon=1e-12;
    if(Math.max(a[0],b[0])+epsilon<Math.min(c[0],d[0])||Math.max(c[0],d[0])+epsilon<Math.min(a[0],b[0])||Math.max(a[1],b[1])+epsilon<Math.min(c[1],d[1])||Math.max(c[1],d[1])+epsilon<Math.min(a[1],b[1])){return false;}
    function cross(p,q,r){return (q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]);}
    var abC=cross(a,b,c),abD=cross(a,b,d),cdA=cross(c,d,a),cdB=cross(c,d,b);
    return ((abC<=epsilon&&abD>=-epsilon)||(abD<=epsilon&&abC>=-epsilon))&&((cdA<=epsilon&&cdB>=-epsilon)||(cdB<=epsilon&&cdA>=-epsilon));
  }
  function ringsIntersect(a,b){
    if(!Array.isArray(a)||!Array.isArray(b)){return false;}
    for(var i=1;i<a.length;i+=1){for(var j=1;j<b.length;j+=1){if(segmentIntersects(a[i-1],a[i],b[j-1],b[j])){return true;}}}
    return false;
  }
  function geometryIntersectsBoundary(geometry,boundaryGeometry){
    if(!geometry||!boundaryGeometry){return false;}
    if(geometry.type==="Point"){return pointInGeometry(geometry.coordinates,boundaryGeometry);}
    if(geometry.type==="MultiPoint"){return geometry.coordinates.some(function(point){return pointInGeometry(point,boundaryGeometry);});}
    if(geometry.type==="LineString"||geometry.type==="MultiLineString"){
      var lines=geometry.type==="LineString"?[geometry.coordinates]:geometry.coordinates;
      var boundaryPolygons=boundaryGeometry.type==="Polygon"?[boundaryGeometry.coordinates]:(boundaryGeometry.type==="MultiPolygon"?boundaryGeometry.coordinates:[]);
      return lines.some(function(line){return line.some(function(point){return pointInGeometry(point,boundaryGeometry);})||boundaryPolygons.some(function(poly){return ringsIntersect(line,poly[0]);});});
    }
    var featurePolygons=geometry.type==="Polygon"?[geometry.coordinates]:(geometry.type==="MultiPolygon"?geometry.coordinates:[]);
    var boundaryPolygons=boundaryGeometry.type==="Polygon"?[boundaryGeometry.coordinates]:(boundaryGeometry.type==="MultiPolygon"?boundaryGeometry.coordinates:[]);
    return featurePolygons.some(function(featurePolygon){
      var featureRing=featurePolygon[0]||[];
      return featureRing.some(function(point){return pointInGeometry(point,boundaryGeometry);})||boundaryPolygons.some(function(boundaryPolygon){
        var boundaryRing=boundaryPolygon[0]||[];
        return boundaryRing.some(function(point){return pointInGeometry(point,geometry);})||ringsIntersect(featureRing,boundaryRing);
      });
    });
  }
  function featureMatchesPlace(feature,name,district,regency,boundary){
    var props=feature&&feature.properties||{},target=props.targetFeatureProperties||{},aliases=placeAliases(boundary,name);
    var villageValues=[props.Desa,props.village,props.Village,props.Nama_Desa,target.Desa,target.village].filter(Boolean);
    var regencyValue=props.Kabupaten||props.regency||target.Kabupaten||"";
    var regencyOk=!regencyValue||!regency||normalized(regencyValue)===normalized(regency);
    var textValues=[props.Nama_Objek,props.title,props.locationName,props.location,props.Lokasi,props.description].filter(Boolean);
    if(villageValues.length){
      if(regencyOk&&villageValues.some(function(value){return aliases.indexOf(normalized(value))!==-1;})){return true;}
      return regencyOk&&textValues.some(function(value){return containsPlace(value,aliases);});
    }
    if(regencyOk&&textValues.some(function(value){return containsPlace(value,aliases);})){return true;}
    var point=representativePoint(feature&&feature.geometry);
    return !!(point&&boundary&&pointInGeometry(point,boundary.geometry));
  }
  function activityMatchesPlace(feature,name,district,regency,boundary){
    if(featureMatchesPlace(feature,name,district,regency,boundary)){return true;}
    if(feature&&feature.geometry&&representativePoint(feature.geometry)&&boundary&&boundary.geometry){
      return geometryIntersectsBoundary(feature.geometry,boundary.geometry);
    }
    return false;
  }
  function vegetationClass(feature){
    var props=feature.properties||{},target=props.targetFeatureProperties||{},id=layerId(feature),text=normalized([id,props.Program,props.Kategori,props.Kategori_Ekosistem,props.Jenis_Ekosistem,props.Komoditas,props.Jenis_Tanaman,props.Nama_Objek,target.Program,target.Kategori_Ekosistem,target.Komoditas,target.Jenis_Tanaman].join(" "));
    var targetLayer=String(target.Layer_ID||target.Source_Layer||props.Target_Layer_ID||props.targetLayerId||"").toLowerCase();
    if(id==="kopi"||id==="area_kopi"||(id==="monitoring_reports"&&(targetLayer==="kopi"||targetLayer==="area_kopi"))){return "coffee";}
    if(id==="area_mangrove"||id==="titik_penanaman"){return "mangrove";}
    if(id==="mineral_land_restoration_area"){return "forest";}
    if(/kopi|liberika|liberica/.test(text)){return "coffee";}
    if(/mangrove/.test(text)){return "mangrove";}
    if(/lahan mineral|restorasi hutan|hutan adat/.test(text)){return "forest";}
    if(/gambut|peat|geronggang|jelutung/.test(text)){return "peat";}
    return "";
  }
  function firstPlantCount(props){
    var fields=['Jumlah_Tanam','Jumlah_Bib'];
    for(var i=0;i<fields.length;i++){var n=number(props[fields[i]]);if(n!=null&&n>=0)return n;}
    return null;
  }
  function plantedCount(feature){
    var p=feature.properties||{},target=p.targetFeatureProperties||{},id=layerId(feature),type=sourceType(feature);
    if(id==='nursery_mangrove'||id==='nursery_kopi'||p.Count_In_Establishment_Total===false)return 0;
    // Monitoring is not new planting. Read the planting baseline, never alive/dead/sample counts.
    var count=(id==='monitoring_reports'||type==='monitoring_report')?number(p.Jumlah_Bib):firstPlantCount(p);
    if(count==null)count=firstPlantCount(target);
    return count!=null&&count>=0?count:0;
  }
  function plantInventoryLedger(programs,reports,attributions){
    var records={mangrove:{},coffee:{},peat:{},forest:{}},reviewed={},parent={},all=programs.concat(reports),entries=[];
    function key(id){return String(id||'').trim().replace(/^(?:COMMUNITY-|MONITORING-)(YG-)/i,'$1').toLowerCase();}
    function find(id){id=key(id);if(!id)return '';if(!parent[id])parent[id]=id;return parent[id]===id?id:(parent[id]=find(parent[id]));}
    function join(a,b){a=find(a);b=find(b);if(a&&b&&a!==b)parent[a]=b;}
    // Reviewed location aliases already used by monitoring-compilation.js and monitoring-live-sync-v2.js.
    var aliases={
      'area_mangrove:auto:1281388060':'MANGROVE-KELAPA-PATI-PHASE-III-001',
      'area_mangrove:auto:1674337344':'MANGROVE-KELAPA-PATI-PHASE-III-001',
      'MANGROVE-KELAPA-PATI-PHASE-III-2026-001':'MANGROVE-KELAPA-PATI-PHASE-III-001',
      'area_mangrove:auto:1732351650':'MANGROVE-SEPAHAT-2025-001',
      'area_mangrove:auto:1601647125':'MANGROVE-SEPAHAT-2025-001',
      'MANGROVE-SEPAHAT-PHASE-III-2025-001':'MANGROVE-SEPAHAT-2025-001',
      'area_mangrove:auto:613256434':'MANGROVE-BURUK-BAKUL-PHASE-II-001',
      'MANGROVE-BURUK-BAKUL-PHASE-II-2024-001':'MANGROVE-BURUK-BAKUL-PHASE-II-001',
      'area_mangrove:auto:374024597':'MANGROVE-BURUK-BAKUL-2025-001',
      'MANGROVE-BURUK-BAKUL-PHASE-III-2025-001':'MANGROVE-BURUK-BAKUL-2025-001',
      'area_mangrove:auto:56906758':'MANGROVE-BURUK-BAKUL-2025-002',
      'MANGROVE-BURUK-BAKUL-PHASE-III-2025-002':'MANGROVE-BURUK-BAKUL-2025-002',
      'MANGROVE-BURUK-BAKUL-PHASE-III-2025-003':'MANGROVE-BURUK-BAKUL-2025-003',
      'MANGROVE-KELAPA-PATI-PHASE-II-2025-003':'MANGROVE-KELAPA-PATI-PHASE-II-003',
      'MANGROVE-TANJUNG-KURAS-PHASE-III-2026-001':'MANGROVE-TANJUNG-KURAS-2026-001'
    };
    Object.keys(aliases).forEach(function(id){join(id,aliases[id]);});
    (attributions||[]).forEach(function(a){if(a.plantingInventory)reviewed[key(a.evidenceId)]=a.plantingInventory;});
    function connect(p,depth){
      if(depth>20||!p)return;
      var id=p.Object_ID||p.Source_Report_ID||p.reportId,type=String(p.Source_Type||'').toLowerCase(),target=p.targetFeatureProperties||{};
      if(type==='community_report'||type==='monitoring_report'||type==='verified_report_asset'){join(id,p.Source_Report_ID||p.reportId);}
      var linkedPlantingReport=type==='community_report'&&String(p.Layer_ID||'').toLowerCase()!=='titik_penanaman'&&!p.Planting_Cohort_ID&&p.Count_In_Establishment_Total!==true;
      if(type==='monitoring_report'||String(p.Layer_ID||'').toLowerCase()==='monitoring_reports'||linkedPlantingReport){
        join(id,p.Target_Object_ID||p.targetObjectId);join(id,target.Object_ID);
        connect(target,depth+1);
      }
    }
    all.forEach(function(f,index){
      var p=f.properties||{},id=p.Object_ID||p.Source_Report_ID||p.reportId||'unlinked:'+index;connect(p,0);
      var inventory=reviewed[key(p.Source_Report_ID||p.reportId||id)];
      if(inventory){join(id,'reviewed:'+inventory.id);entries.push({id:id,category:inventory.category,count:number(inventory.total),rank:100,source:p.Object_ID||id});return;}
      var category=vegetationClass(f),count=plantedCount(f),type=sourceType(f),monitoring=type==='monitoring_report'||layerId(f)==='monitoring_reports';
      if(!category||p.Count_In_Establishment_Total===false||layerId(f)==='nursery_mangrove'||layerId(f)==='nursery_kopi')return;
      var own=monitoring?number(p.Jumlah_Bib):firstPlantCount(p),rank=monitoring?1:(type==='community_report'?2:3);
      // Preserve an explicit zero from the planting object, rather than reviving an old baseline.
      if(own==null&&count===0)return;
      entries.push({id:id,category:category,count:count,rank:rank,source:p.Object_ID||id});
    });
    entries.forEach(function(e){
      if(!records[e.category]||e.count==null||e.count<0)return;
      var id=find(e.id),previous=records[e.category][id];
      if(!previous)records[e.category][id]={count:e.count,rank:e.rank,sources:[e.source]};
      else{if(e.rank>previous.rank||(e.rank===previous.rank&&e.count>previous.count)){previous.count=e.count;previous.rank=e.rank;}if(previous.sources.indexOf(e.source)<0)previous.sources.push(e.source);}
    });
    return records;
  }
  function plantInventory(programs,reports,attributions){
    var records=plantInventoryLedger(programs,reports,attributions),totals={};
    Object.keys(records).forEach(function(category){totals[category]=Object.keys(records[category]).reduce(function(total,id){return total+records[category][id].count;},0);});
    return totals;
  }

function canonical(id){return String(id||'').trim().replace(/^(?:COMMUNITY-|MONITORING-)(YG-)/i,'$1').toLowerCase();}
function donorName(value){var v=String(value||'').trim();if(/^aramco/i.test(v))return 'Aramco Asia Singapore';if(/^(gec|global environment centre)/i.test(v))return 'Global Environment Centre';if(/^(ppcf|pan pacific conservation foundation)/i.test(v))return 'Pan Pacific Conservation Foundation (PPCF)';if(/kolibri/i.test(v))return 'Aliansi Kolibri';if(/^bpdp|badan pengelola dana perkebunan/i.test(v))return 'BPDP';if(/^(yg|yayasan gambut)$/i.test(v))return 'Yayasan Gambut';return v;}
function published(f){var p=f.properties||{};return p.verified!==false&&p.published!==false&&p.staffOnly!==true&&!/pending|rejected|draft|unverified|menunggu|ditolak|belum diverifikasi/i.test(p.status||p.Status_Verifikasi||'');}
function applyDonorAttributions(features,attributions){var confirmed={};(attributions||[]).filter(a=>a.confirmedAt&&a.donor&&a.source).forEach(a=>confirmed[canonical(a.evidenceId)]=a);return (features||[]).map(function(f){var p=f.properties||{},a=confirmed[canonical(p.Source_Report_ID||p.reportId||p.Object_ID)]||confirmed[canonical(p.Object_ID)];return a?Object.assign({},f,{properties:Object.assign({},p,{Donor:donorName(a.donor),Donor_Cluster:donorName(a.donor),Donor_Confirmed_At:a.confirmedAt})}):f;});}
function summarize(objects,attributions,boundaries){
 var index={},attrs={};objects=applyDonorAttributions(objects,attributions).filter(published);objects.forEach(function(f){var p=f.properties||{};[p.Object_ID,p.Source_Report_ID,p.reportId].filter(Boolean).forEach(function(id){var k=canonical(id);(index[k]||(index[k]=[])).push(f);});});(attributions||[]).forEach(function(a){attrs[canonical(a.evidenceId)]=a;});
 var ledger=plantInventoryLedger(objects,[],attributions),rows=[];
 Object.keys(ledger).forEach(function(category){Object.keys(ledger[category]).forEach(function(id){var item=ledger[category][id],features=item.sources.flatMap(function(id){return index[canonical(id)]||[];}),names=[];
 features.forEach(function(f){var p=f.properties||{},a=attrs[canonical(p.Source_Report_ID||p.reportId||p.Object_ID)],d=donorName(p.Donor||p.Donor_Cluster||(a&&a.donor)||((p.targetFeatureProperties||{}).Donor));if(d&&names.indexOf(d)<0)names.push(d);});
 // Keep the established official mangrove source attribution; never guess a coffee donor from village.
 if(!names.length&&features.some(function(f){return layerId(f)==='area_mangrove'&&/^MANGROVE-/.test((f.properties||{}).Object_ID||'');}))names=['Aramco Asia Singapore'];
 var donor=names.length===1?names[0]:(names.length?'Donor perlu verifikasi':'Donor belum tercatat');
 var matches=(boundaries||[]).filter(function(b){var p=b.properties;return features.some(function(f){return activityMatchesPlace(f,p.WADMKD||p.Desa||p.NAMOBJ,p.WADMKC||p.Kecamatan,p.WADMKK||p.Kabupaten,b);});}).map(function(b){var p=b.properties;return {name:p.WADMKD||p.Desa||p.NAMOBJ,key:[p.WADMKD||p.Desa||p.NAMOBJ,p.WADMKC||p.Kecamatan,p.WADMKK||p.Kabupaten].join('|').toLowerCase()};});
 rows.push({id:id,category:category,count:item.count,donor:donor,villages:matches,sources:item.sources});
 });});return rows;
}
function aggregate(rows,filter){var out={mangrove:0,coffee:0,peat:0,forest:0};rows.filter(filter||function(){return true;}).forEach(function(r){out[r.category]+=r.count;});return out;}
var pending=null;
function load(){if(pending)return pending;function json(url){var controller=new AbortController(),timer=setTimeout(function(){controller.abort();},8000);return fetch(url,{cache:'no-store',signal:controller.signal}).then(function(r){if(!r.ok)throw Error('Inventaris tanaman belum tersedia');return r.json();}).finally(function(){clearTimeout(timer);});}
 pending=Promise.all([Promise.allSettled([json('data/master-database-snapshot.json'),json('https://webgis-api.yayasangambut.org/snapshots/current/objects.json')]),json('data/area_mangrove.geojson'),json('data/kopi.geojson'),json('data/area_kopi.geojson'),json('data/village-activity-attributions.json'),json('data/desa_intervensi.geojson')]).then(function(parts){var snapshots=parts[0].filter(function(r){return r.status==='fulfilled'&&Array.isArray(r.value.features);}).map(function(r){return r.value;}).sort(function(a,b){return Date.parse(b.snapshotGeneratedAt||b.generatedAt||0)-Date.parse(a.snapshotGeneratedAt||a.generatedAt||0);});if(!snapshots.length)throw Error('Snapshot tanaman belum tersedia');var snapshot=snapshots[0],objects=mergeFeatureCollections(snapshot,[parts[1],parts[2],parts[3]]),attributions=parts[4].attributions||[],rows=summarize(objects,attributions,parts[5].features);return {objects:objects,attributions:attributions,rows:rows,totals:aggregate(rows),generatedAt:snapshot.snapshotGeneratedAt||snapshot.generatedAt};}).catch(function(e){pending=null;throw e;});return pending;
}
return {vegetationClass:vegetationClass,plantedCount:plantedCount,plantInventoryLedger:plantInventoryLedger,plantInventory:plantInventory,applyDonorAttributions:applyDonorAttributions,mergeFeatureCollections:mergeFeatureCollections,featureMatchesPlace:featureMatchesPlace,activityMatchesPlace:activityMatchesPlace,summarize:summarize,aggregate:aggregate,canonical:canonical,donorName:donorName,load:load};
});
