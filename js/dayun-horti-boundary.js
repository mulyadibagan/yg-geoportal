(function(root){
 'use strict';
 function mount({map,host,fetcher=root.fetch.bind(root)}){
  const initial=root.YG_AUTH?.readStoredSession();let view=null,disposed=false,timer=null;
  const session=()=>root.YG_AUTH?.readStoredSession();
  const current=()=>{const s=session();return !disposed&&Boolean(initial?.token)&&s?.token===initial.token&&Number(s.expiresAt)>Date.now();};
  host.hidden=true;
  function dispose(){if(disposed)return;disposed=true;clearTimeout(timer);view?.dispose();host.replaceChildren();host.hidden=true;root.removeEventListener('storage',check);root.removeEventListener('pageshow',check);root.document.removeEventListener('visibilitychange',check);}
  function check(){if(!current())dispose();}
  if(!current()||!root.YG_ORTHO_AREA_STORE?.mountOverlay)return{dispose};
  async function api(path,options){
   if(!current()) {dispose();throw Error('Sesi staf berakhir.');}
   if(options?.method&&options.method!=='GET'||!/^\/api\/staff\/drone\/analysis\/areas(?:\?|$)/.test(path))throw Error('Lapisan batas hanya dapat dibaca.');
   const response=await fetcher('https://webgis-api.yayasangambut.org'+path,{method:'GET',headers:{Authorization:'Bearer '+initial.token},cache:'no-store',credentials:'omit',redirect:'error',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(30000)});
   if(response.status===401||response.status===403)dispose();
   if(!response.ok)throw Error('HTTP '+response.status);
   return response;
  }
  host.hidden=false;
  view=root.YG_ORTHO_AREA_STORE.mountOverlay({map,host,api,current,title:'Area hortikultura',publicLabels:true});
  root.addEventListener('storage',check);root.addEventListener('pageshow',check);root.document.addEventListener('visibilitychange',check);
  timer=setTimeout(dispose,Math.min(2147483647,Math.max(0,Number(initial.expiresAt)-Date.now())));
  return{dispose};
 }
 root.YG_DAYUN_HORTI={mount};
})(window);
