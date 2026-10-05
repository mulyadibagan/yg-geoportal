const ORIGIN='https://webgisyg.id';
const HEADERS={'access-control-allow-origin':ORIGIN,'access-control-allow-methods':'POST, OPTIONS','access-control-allow-headers':'content-type','access-control-max-age':'3600','cache-control':'no-store','content-type':'application/json; charset=utf-8','x-content-type-options':'nosniff',vary:'Origin'};
const attempts=new Map();
function reply(data,status=200){return new Response(JSON.stringify(data),{status,headers:HEADERS});}
export async function staffLogin(request,env,onVerified){
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:HEADERS});
  if(request.method!=='POST')return reply({ok:false,error:'method_not_allowed'},405);
  const origin=request.headers.get('origin');
  if(origin && origin!==ORIGIN)return reply({ok:false,error:'origin_not_allowed'},403);
  const key=request.headers.get('cf-connecting-ip');
  const now=Date.now();
  if(key){
    const recent=(attempts.get(key)||[]).filter(t=>now-t<60000);
    if(recent.length>=8)return reply({ok:false,error:'rate_limited',message:'Terlalu banyak percobaan login. Tunggu satu menit.'},429);
    recent.push(now);attempts.set(key,recent);
    if(attempts.size>2000)for(const [ip,times]of attempts)if(times.at(-1)<now-60000)attempts.delete(ip);
  }
  if(Number(request.headers.get('content-length')||0)>8192)return reply({ok:false,error:'invalid_request'},400);
  let body;
  try{const text=await request.text();if(text.length>8192)throw Error();body=JSON.parse(text);}catch{return reply({ok:false,error:'invalid_request'},400);}
  if(!body||typeof body!=='object'||Array.isArray(body))return reply({ok:false,error:'invalid_request'},400);
  const username=String(body.username||'').trim().toLowerCase(),password=String(body.password||'');
  if(!/^[a-z][a-z0-9._-]{2,31}$/.test(username)||!password||password.length>1024)return reply({ok:false,error:'invalid_credentials',message:'Isi username dan password dengan benar.'},400);
  const requestId='yg-auth-'+crypto.randomUUID();
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),60000);
  try{
    // Credentials are forwarded only to the configured authentication service.
    // Never place credentials in URLs, logs, caches or persistent storage.
    const posted=await fetch(env.APPS_SCRIPT_BASE,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({action:'editor-login',requestId,username,password}).toString(),redirect:'follow',signal:controller.signal});
    if(!posted.ok)throw Error('upstream_unavailable');
    await posted.body?.cancel();
    const resultUrl=new URL(env.APPS_SCRIPT_BASE);resultUrl.searchParams.set('page','editor-auth-result');resultUrl.searchParams.set('requestId',requestId);
    for(let poll=0;poll<4;poll++){
      const response=await fetch(resultUrl,{headers:{accept:'application/json'},redirect:'follow',signal:controller.signal});
      if(!response.ok)throw Error('upstream_unavailable');
      let result=await response.json();if(typeof result==='string')result=JSON.parse(result);
      if(result?.pending===true){await new Promise(resolve=>setTimeout(resolve,300));continue;}
      if(result?.ok===false)return reply({ok:false,message:result.message||'Username atau password tidak benar.'});
      if(result?.ok!==true||!result.sessionToken||!result.username||!result.role||!Number.isFinite(Number(result.expiresAt))||Number(result.expiresAt)<=Date.now())throw Error('invalid_auth_result');
      onVerified(result.sessionToken);
      return reply({ok:true,sessionToken:result.sessionToken,username:result.username,name:result.name||result.username,role:result.role,expiresAt:Number(result.expiresAt)});
    }
    throw Error('auth_pending');
  }catch{return reply({ok:false,error:'auth_service_unavailable',message:'Layanan verifikasi belum merespons. Silakan coba lagi.'},503);}
  finally{clearTimeout(timer);}
}
