(function (root) {
  'use strict';
  function summarize(features) {
    var byGawangan = {}, seen = new Set(), unassigned = {Petai:0, Jengkol:0}, total = {Petai:0, Jengkol:0};
    (features || []).forEach(function (feature) {
      var p = feature.properties || {}, key = p.pointId;
      if (!key || seen.has(key)) return;
      seen.add(key);
      var ids = Array.from(new Set((p.spatialMatches || []).filter(function (id) { return /^DAYUN-GT-[A-F]-\d{2}$/.test(id); })));
      var row = ids.length === 1 ? (byGawangan[ids[0]] || (byGawangan[ids[0]] = {objectId:ids[0], observed:0, Petai:0, Jengkol:0})) : null;
      if (row) row.observed++;
      if (p.condition !== 'Mati' || !Object.prototype.hasOwnProperty.call(total, p.species)) return;
      total[p.species]++;
      (row || unassigned)[p.species]++;
    });
    return {rows:Object.keys(byGawangan).sort().map(function (id) { return byGawangan[id]; }), byGawangan:byGawangan, unassigned:unassigned, total:total};
  }
  function inventory(features) {
    var seen=new Set(),species={},byGawangan={},total=0,dead=0,unassigned=0;
    (features||[]).forEach(function(f){var p=f.properties||{};if(!p.pointId||seen.has(p.pointId))return;seen.add(p.pointId);total++;species[p.species]=(species[p.species]||0)+1;if(p.condition==='Mati')dead++;
      var ids=Array.from(new Set(p.spatialMatches||[]));if(ids.length!==1){unassigned++;return;}var id=ids[0],row=byGawangan[id]||(byGawangan[id]={total:0,species:{}});row.total++;row.species[p.species]=(row.species[p.species]||0)+1;
    });return {total:total,dead:dead,unknown:total-dead,species:species,byGawangan:byGawangan,unassigned:unassigned};
  }
  function plantingPeriods(feature,details){
    var p=feature.properties||{},normalize=function(v){return String(v||'').trim().replace(/\s+/g,' ').toUpperCase();},species=normalize(p.species),ids=Array.from(new Set(p.spatialMatches||[])),rows=[];
    ids.forEach(function(id){var record=((details||{}).objects||[]).find(function(r){return r.objectId===id;});(record&&record.crops||[]).filter(function(c){return normalize(c.crop)===species;}).forEach(function(c){var value=c.plantingDate||c.plantingPeriod;if(value)rows.push({objectId:id,period:plantingLabel(value)});});});
    return rows.filter(function(row,i){return rows.findIndex(function(r){return r.objectId===row.objectId&&r.period===row.period;})===i;});
  }
  function plantingLabel(value){
    var text=String(value||'').trim(),months=['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'],iso=text.match(/^(20\d{2})-(0[1-9]|1[0-2])(?:-|$)/);if(iso)return months[Number(iso[2])-1]+' '+iso[1];
    var match=text.match(/(?:^|\s)(jan(?:uari)?|feb(?:ruari)?|mar(?:et)?|apr(?:il)?|mei|jun(?:i)?|jul(?:i)?|agu(?:stus)?|agustus|aug(?:ust)?|sep(?:t(?:ember)?)?|okt(?:ober)?|oct(?:ober)?|nov(?:ember)?|des(?:ember)?|dec(?:ember)?)\s+(20\d{2}|\d{2})(?:$|\s)/i);if(!match)return text;
    var key=match[1].slice(0,3).toLowerCase(),index={jan:0,feb:1,mar:2,apr:3,mei:4,jun:5,jul:6,agu:7,aug:7,sep:8,okt:9,oct:9,nov:10,des:11,dec:11}[key];return months[index]+' '+(match[2].length===2?'20':'')+match[2];
  }
  var api = {summarize:summarize,inventory:inventory,plantingPeriods:plantingPeriods,plantingLabel:plantingLabel};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.DayunMptsSummary = api;
})(typeof window !== 'undefined' ? window : this);
