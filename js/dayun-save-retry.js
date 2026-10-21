(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.YG_DAYUN_SAVE_RETRY=api;})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  const delays=[5000,15000,30000];
  function eligible(path,options){
    if(options?.method!=='POST'||!/^\/api\/staff\/drone\/analysis\/(Agro_ABC|Agro_DEF)\/(block-review|fruiting-review)(\?|$)/.test(path))return false;
    try{const body=JSON.parse(options.body),plant=/\/block-review(\?|$)/.test(path);
      if(plant&&body.patch?.schema!=='dayun-block-point-patch-v1')return false;
      const ops=plant?body.patch.operations:body.operations||[body.operation];
      return Array.isArray(ops)&&ops.length>0&&ops.every(op=>typeof op?.operation_id==='string'&&/^[\w-]{8,100}$/.test(op.operation_id));
    }catch{return false;}
  }
  function transient(error){return [429,502,503,504].includes(error?.status)||!error?.status&&['TypeError','TimeoutError','NetworkError'].includes(error?.name);}
  async function run(send,{path,options,current=()=>true,onRetry,wait=ms=>new Promise(resolve=>setTimeout(resolve,ms)),random=Math.random}){
    const retryable=eligible(path,options);
    for(let attempt=0;;attempt++){
      try{return await send();}
      catch(error){
        if(!retryable||!transient(error)||attempt>=delays.length||!current())throw error;
        const delay=Math.min(60000,Math.max(delays[attempt],Number(error.retryAfterMs)||0))+Math.floor(random()*1000);
        onRetry?.({attempt:attempt+1,total:delays.length,delay});
        await wait(delay);
        if(!current())throw error;
      }
    }
  }
  return{eligible,transient,run};
});
