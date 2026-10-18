// Admission controls for expensive drone reads/jobs only. Never gate staff login,
// correction writes or review polling through these shared counters.
const bindings={assets:'DRONE_ASSET_LIMIT',analysis:'DRONE_ANALYSIS_LIMIT',legacy:'DRONE_LEGACY_LIMIT',submit:'DRONE_SUBMIT_LIMIT'};
export async function droneUsageGuard(request,env,scope,actor){
  const limiter=env[bindings[scope]];
  if(!limiter){
    if(['staging','production'].includes(env.ENVIRONMENT))return{status:503,body:{ok:false,error:'drone_usage_guard_unavailable',retry_after:60}};
    return null;
  }
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(actor||'anonymous'));
  const key=scope+':'+Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
  const {success}=await limiter.limit({key});
  return success?null:{status:429,body:{ok:false,error:'drone_usage_limited',retry_after:60,message:'Permintaan citra atau analisis terlalu cepat. Tunggu satu menit lalu coba lagi. Login dan penyimpanan titik tetap tersedia.'}};
}
