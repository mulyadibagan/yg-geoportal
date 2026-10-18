(function(root){
  'use strict';
  function create({api,current,fetcher=fetch,now=Date.now}){
    const manifests=new Map(),links=new Map(),pending=new Map(),downloadQueue=[];let generation=0,running=0,blockedUntil=0;
    function clear(){generation++;manifests.clear();links.clear();pending.clear();blockedUntil=0;for(const item of downloadQueue.splice(0))item.reject(Error('Sesi staf tidak aktif.'));}
    function pump(){
      while(running<2&&downloadQueue.length){
        const item=downloadQueue.shift();if(item.epoch!==generation||!current()){item.reject(Error('Sesi staf tidak aktif.'));continue;}
        running++;Promise.resolve().then(item.work).then(item.resolve,item.reject).finally(()=>{running--;pump();});
      }
    }
    function download(work){return new Promise((resolve,reject)=>{downloadQueue.push({work,resolve,reject,epoch:generation});pump();});}
    function register(base,manifest){
      if(manifest?.assetDelivery!=='r2-signed-v1')return;
      const previous=manifests.get(base);if(previous&&previous.run===manifest.run&&previous.files.length===manifest.files.length&&previous.files.every((file,i)=>file===manifest.files[i]))return;
      manifests.set(base,{files:[...manifest.files],run:manifest.run});
      // A new analysis revision must not reuse URLs from the previous run.
      for(const key of links.keys())if(key.startsWith(base+'/files/'))links.delete(key);
    }
    function eligible(path){const match=path.match(/^(\/api\/staff\/drone\/analysis\/(?:Agro_ABC|Agro_DEF))\/files\/(.+)$/);return match&&manifests.has(match[1])?match:null;}
    function validate(link){
      const url=new URL(link.url);
      if(url.protocol!=='https:'||! /^[a-f0-9]{32}\.r2\.cloudflarestorage\.com$/.test(url.hostname)||url.username||url.password||url.port||!url.searchParams.has('X-Amz-Signature')||!Number.isFinite(link.expiresAt)||link.expiresAt<=now())throw Error('Tautan citra privat tidak valid.');
    }
    async function resolve(path,force=false){
      if(!current())throw Error('Sesi staf tidak aktif.');
      const match=eligible(path);if(!match)throw Error('Citra belum memiliki jalur R2 privat.');
      const cached=links.get(path);if(!force&&cached&&cached.expiresAt>now()+30000)return cached.url;
      if(now()<blockedUntil)throw Object.assign(Error('Pembacaan citra dijeda sebentar. Coba kembali dalam '+Math.ceil((blockedUntil-now())/1000)+' detik.'),{status:429});
      const [,base,file]=match,manifest=manifests.get(base),index=manifest.files.indexOf(file);
      if(index<0)throw Error('Berkas citra tidak terdaftar.');
      const start=Math.floor(index/64)*64,batch=base+':'+start,epoch=generation;
      if(!pending.has(batch)){
        const promise=(async()=>{
          let response;
          try{response=await api(base+'/asset-links',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({files:manifest.files.slice(start,start+64)})});}
          catch(error){if(error.status===429)blockedUntil=now()+Math.min(300,Math.max(60,Number(error.details?.retry_after)||60))*1000;throw error;}
          const result=await response.json();
          if(epoch!==generation||!current()||manifests.get(base)!==manifest)throw Error('Sesi atau sumber citra sudah berubah.');
          if(!result.ok||!Array.isArray(result.links))throw Error('Tautan citra privat belum tersedia.');
          for(const link of result.links){if(!manifest.files.slice(start,start+64).includes(link.file))throw Error('Berkas citra tidak sesuai.');validate(link);links.set(base+'/files/'+link.file,link);}
        })();
        pending.set(batch,promise);promise.finally(()=>{if(pending.get(batch)===promise)pending.delete(batch);}).catch(()=>{});
      }
      await pending.get(batch);
      if(!current()||epoch!==generation)throw Error('Sesi staf tidak aktif.');
      const link=links.get(path);if(!link||link.expiresAt<=now())throw Error('Tautan citra privat tidak tersedia.');return link.url;
    }
    async function get(path,options={}){
      return download(async()=>{
      for(let attempt=0;attempt<2;attempt++){
        if(options.signal?.aborted)throw options.signal.reason||Error('Pembacaan citra dibatalkan.');
        const url=await resolve(path,attempt>0);
        if(!current())throw Error('Sesi staf tidak aktif.');
        const headers=new Headers();const range=new Headers(options.headers).get('range');if(range)headers.set('range',range);
        const response=await fetcher(url,{method:'GET',headers,mode:'cors',credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer',redirect:'error',signal:options.signal||AbortSignal.timeout(45000)});
        if(!current()){await response.body?.cancel();throw Error('Sesi staf tidak aktif.');}
        if((response.status===401||response.status===403)&&attempt===0){await response.body?.cancel();continue;}
        if(!response.ok){const error=Error(`Citra privat gagal dimuat (HTTP ${response.status}).`);error.status=response.status;throw error;}
        // Hold the two-download slot through body transfer, not just headers.
        const blob=await response.blob();
        if(!current())throw Error('Sesi staf tidak aktif.');
        const receivedHeaders=new Headers(response.headers);receivedHeaders.delete('content-encoding');receivedHeaders.set('content-length',String(blob.size));
        return new Response(blob,{status:response.status,headers:receivedHeaders});
      }
      });
    }
    return{register,eligible,get,resolve,clear};
  }
  root.YG_PRIVATE_R2={create};
  if(typeof module==='object'&&module.exports)module.exports={create};
})(typeof window==='object'?window:globalThis);
