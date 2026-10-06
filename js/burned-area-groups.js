(function(root){
  'use strict';
  var UNKNOWN='Kabupaten/kota belum teridentifikasi';
  function groupEvents(geo){
    var events=Object.create(null),groups=Object.create(null);
    (geo.features||[]).forEach(function(f){
      var p=f.properties||{},id=p.archiveEventId||p.eventId;
      if(!id)return;
      if(!events[id])events[id]={id:id,p:p,features:[],allocations:Object.create(null)};
      events[id].features.push(f);
    });
    var entries=Object.keys(events).map(function(id){return events[id]}),totalArea=0;
    entries.forEach(function(e){
      var p=e.p,total=Math.max(0,Number(p.estimatedAreaHa)||0),parts=Object.create(null),sum=0;
      totalArea+=total;
      (p.villageAreas||[]).forEach(function(v){
        var n=Math.max(0,Number(v.areaHa)||0),name=String(v.regency||'').trim()||UNKNOWN;
        if(name.includes('/'))name=UNKNOWN;
        parts[name]=(parts[name]||0)+n;sum+=n;
      });
      // Reconcile precision and overlapping administrative areas with event totals.
      var scale=sum>0&&(sum>total||Math.abs(sum-total)<0.02)?total/sum:1;
      Object.keys(parts).forEach(function(name){parts[name]*=scale});sum*=scale;
      if(!sum){
        var names=(p.regencies||[]).filter(function(n){return String(n).trim()});
        parts[names.length===1&&!String(names[0]).includes('/')?String(names[0]).trim():UNKNOWN]=total;
      }else if(total-sum>0.000001)parts[UNKNOWN]=(parts[UNKNOWN]||0)+total-sum;
      Object.keys(parts).forEach(function(name){
        if(parts[name]<=0&&total>0)return;
        e.allocations[name]=parts[name];
        if(!groups[name])groups[name]={name:name,areaHa:0,events:[]};
        groups[name].areaHa+=parts[name];groups[name].events.push(e);
      });
    });
    return {events:entries.sort(function(a,b){return Number(b.p.estimatedAreaHa)-Number(a.p.estimatedAreaHa)}),groups:Object.keys(groups).map(function(name){return groups[name]}).sort(function(a,b){return b.areaHa-a.areaHa}),areaHa:totalArea};
  }
  var api={groupEvents:groupEvents,unknown:UNKNOWN};
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.YG_BURNED_GROUPS=api;
})(typeof window==='object'?window:this);
