(function(root){
  'use strict';
  function stamp(data){return Date.parse(data&&(data.snapshotGeneratedAt||data.generatedAt)||'')||0;}
  function freshest(sources){var valid=(sources||[]).filter(function(data){return data&&Array.isArray(data.features);});if(!valid.length)throw new Error('Snapshot publik belum tersedia');return valid.reduce(function(a,b){return stamp(b)>stamp(a)?b:a;});}
  function create(options){
    var revision=null,busy=false,stopped=false,lastCheck=0,now=options.now||Date.now;
    async function check(force){
      if(stopped||busy||!options.visible()||(!force&&now()-lastCheck<15000))return false;
      busy=true;lastCheck=now();
      try{var next=await options.revision();if(force||next!==revision){var data=await options.load();await options.apply(data);revision=next;}if(options.onSuccess)options.onSuccess();return true;}
      catch(error){if(options.onError)options.onError(error);return false;}
      finally{busy=false;}
    }
    return {check:check,stop:function(){stopped=true;}};
  }
  var api={freshest:freshest,create:create};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.VillageTimelineSync=api;
})(typeof window!=='undefined'?window:this);
