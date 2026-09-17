const ALLOWED_ORIGINS = new Set(['https://webgisyg.id','https://www.webgisyg.id']);
const MAX_FILES = 800;
const MAX_FILE_BYTES = 40 * 1024 * 1024;
const MAX_TOTAL_BYTES = 8 * 1024 * 1024 * 1024;
const MAX_PENDING_JOBS = 20;

function cors(request){
  const origin=request.headers.get('origin')||'';
  return {
    'access-control-allow-origin': ALLOWED_ORIGINS.has(origin)?origin:'https://webgisyg.id',
    'access-control-allow-methods':'GET, HEAD, POST, PUT, OPTIONS',
    'access-control-allow-headers':'content-type, x-file-name, x-job-token',
    'access-control-max-age':'3600',
    vary:'Origin',
    'x-content-type-options':'nosniff'
  };
}
function reply(request,value,status=200,extra={}){return new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...cors(request),...extra}})}
function safeName(value){return String(value||'photo.jpg').replace(/[^a-zA-Z0-9._-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,140)||'photo.jpg'}
async function readJson(env,key,fallback=null){const object=await env.PUBLIC_SNAPSHOTS?.get(key);if(!object)return fallback;try{return JSON.parse(await object.text())}catch{return fallback}}
async function writeJson(env,key,value){await env.PUBLIC_SNAPSHOTS.put(key,JSON.stringify(value),{httpMetadata:{contentType:'application/json; charset=utf-8',cacheControl:'no-store'}})}
function jobKey(id){return `drone/jobs/${id}.json`}
function publicJob(job){if(!job)return null;const {accessToken,...safe}=job;return safe}
function suppliedJobToken(request,url){return String(request.headers.get('x-job-token')||url?.searchParams?.get('access')||'').trim()}
function authorizedJob(request,url,job){const supplied=suppliedJobToken(request,url);return Boolean(supplied&&job?.accessToken&&supplied===job.accessToken)}
async function queueJob(env,id){const key='drone/queue/pending.json';const queue=await readJson(env,key,{jobs:[]});const jobs=Array.isArray(queue?.jobs)?queue.jobs.map(String):[];if(!jobs.includes(id))jobs.push(id);await writeJson(env,key,{jobs,updatedAt:new Date().toISOString()})}
async function pendingCount(env){const queue=await readJson(env,'drone/queue/pending.json',{jobs:[]});return Array.isArray(queue?.jobs)?queue.jobs.length:0}
function newJob(body={}){const id=`drn-${crypto.randomUUID()}`;return{id,title:String(body.title||body.area||'Survei drone').slice(0,160),project:String(body.project||'YG GeoPortal').slice(0,160),sourceType:body.sourceType==='drive'?'drive':'upload',driveUrl:body.sourceType==='drive'?String(body.driveUrl||'').trim():null,status:body.sourceType==='drive'?'pending':'uploading',files:[],totalBytes:0,createdAt:new Date().toISOString(),accessToken:crypto.randomUUID().replace(/-/g,'')}}

async function createJob(request,env){
  if(await pendingCount(env)>=MAX_PENDING_JOBS)return reply(request,{ok:false,error:'queue_full'},429,{'retry-after':'300'});
  const body=await request.json().catch(()=>({}));
  const job=newJob(body);
  if(job.sourceType==='drive'&&!/^https:\/\/drive\.google\.com\/drive\/folders\/[a-zA-Z0-9_-]+/i.test(job.driveUrl||''))return reply(request,{ok:false,error:'invalid_drive_folder_url'},400);
  await writeJson(env,jobKey(job.id),job);
  if(job.status==='pending')await queueJob(env,job.id);
  return reply(request,{ok:true,job:publicJob(job),accessToken:job.accessToken,limits:{maxFiles:MAX_FILES,maxFileMB:40,maxTotalGB:8}});
}
async function getJob(request,env,id,url){
  const job=await readJson(env,jobKey(id));
  if(!job)return reply(request,{ok:false,error:'job_not_found'},404);
  if(!authorizedJob(request,url,job))return reply(request,{ok:false,error:'unauthorized'},401);
  const safe=publicJob(job);
  if(job.status==='pending'){
    const queue=await readJson(env,'drone/queue/pending.json',{jobs:[]});
    const jobs=Array.isArray(queue?.jobs)?queue.jobs.map(String):[];
    const index=jobs.indexOf(id);
    safe.queuePosition=index>=0?index+1:null;
    safe.queueSize=jobs.length;
  }
  return reply(request,{ok:true,job:safe});
}
async function uploadFile(request,env,id,encodedName,url){
  const job=await readJson(env,jobKey(id));if(!job)return reply(request,{ok:false,error:'job_not_found'},404);if(!authorizedJob(request,url,job))return reply(request,{ok:false,error:'unauthorized'},401);
  if(job.sourceType!=='upload'||!['uploading','pending'].includes(job.status))return reply(request,{ok:false,error:'job_not_uploadable'},409);
  const name=safeName(decodeURIComponent(encodedName||'photo.jpg'));const type=request.headers.get('content-type')||'application/octet-stream';if(!/^image\/(jpeg|jpg)$/i.test(type)&&!/\.jpe?g$/i.test(name))return reply(request,{ok:false,error:'jpeg_only'},415);
  const size=Number(request.headers.get('content-length')||0);if(!size)return reply(request,{ok:false,error:'content_length_required'},411);if(size>MAX_FILE_BYTES)return reply(request,{ok:false,error:'file_too_large'},413);
  const oldFiles=Array.isArray(job.files)?job.files:[];const existing=oldFiles.find(f=>f?.name===name);const nextCount=existing?oldFiles.length:oldFiles.length+1;if(nextCount>MAX_FILES)return reply(request,{ok:false,error:'too_many_files'},413);
  const oldBytes=Number(job.totalBytes||0)-Number(existing?.bytes||0);if(oldBytes+size>MAX_TOTAL_BYTES)return reply(request,{ok:false,error:'dataset_too_large'},413);
  const key=`drone/uploads/${id}/${name}`;await env.PUBLIC_SNAPSHOTS.put(key,request.body,{httpMetadata:{contentType:type,cacheControl:'private, max-age=0'}});
  const files=oldFiles.filter(f=>f?.key!==key&&f?.name!==name);files.push({name,key,bytes:size});job.files=files;job.totalBytes=oldBytes+size;job.updatedAt=new Date().toISOString();await writeJson(env,jobKey(id),job);
  return reply(request,{ok:true,id,file:{name,key},uploaded:files.length,totalBytes:job.totalBytes});
}
async function finalizeUpload(request,env,id,url){const job=await readJson(env,jobKey(id));if(!job)return reply(request,{ok:false,error:'job_not_found'},404);if(!authorizedJob(request,url,job))return reply(request,{ok:false,error:'unauthorized'},401);if(job.sourceType!=='upload')return reply(request,{ok:false,error:'not_upload_job'},409);if(!Array.isArray(job.files)||job.files.length<3)return reply(request,{ok:false,error:'minimum_three_photos'},400);if(await pendingCount(env)>=MAX_PENDING_JOBS)return reply(request,{ok:false,error:'queue_full'},429,{'retry-after':'300'});job.status='pending';job.queuedAt=new Date().toISOString();await writeJson(env,jobKey(id),job);await queueJob(env,id);return reply(request,{ok:true,job:publicJob(job)})}
async function serveCog(request,env,id,url){const job=await readJson(env,jobKey(id));if(!job||job.status!=='ready'||!job.cogKey)return reply(request,{ok:false,error:'orthomosaic_not_ready'},404);if(!authorizedJob(request,url,job))return reply(request,{ok:false,error:'unauthorized'},401);const rangeHeader=request.headers.get('range');const object=await env.PUBLIC_SNAPSHOTS.get(job.cogKey,rangeHeader?{range:request.headers}:undefined);if(!object)return reply(request,{ok:false,error:'cog_missing'},404);const headers=new Headers(cors(request));object.writeHttpMetadata(headers);headers.set('etag',object.httpEtag);headers.set('accept-ranges','bytes');headers.set('cache-control','private, max-age=3600');if(object.range){const offset=object.range.offset||0;const length=object.range.length||object.size;headers.set('content-range',`bytes ${offset}-${offset+length-1}/${object.size}`)}return new Response(request.method==='HEAD'?null:object.body,{status:object.range?206:200,headers})}

export function isDroneRoute(pathname){return pathname==='/api/drone/jobs'||pathname.startsWith('/api/drone/jobs/')}
export async function handleDroneRequest(request,env,url){
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors(request)});
  const origin=request.headers.get('origin')||'';
  if(['POST','PUT'].includes(request.method)&&!ALLOWED_ORIGINS.has(origin))return reply(request,{ok:false,error:'origin_not_allowed'},403);
  if(origin&&!ALLOWED_ORIGINS.has(origin))return reply(request,{ok:false,error:'origin_not_allowed'},403);
  const cogMatch=url.pathname.match(/^\/api\/drone\/jobs\/(drn-[a-zA-Z0-9-]+)\/cog$/);if(cogMatch&&(request.method==='GET'||request.method==='HEAD'))return serveCog(request,env,cogMatch[1],url);
  if(url.pathname==='/api/drone/jobs'&&request.method==='POST')return createJob(request,env);
  const fileMatch=url.pathname.match(/^\/api\/drone\/jobs\/(drn-[a-zA-Z0-9-]+)\/files\/(.+)$/);if(fileMatch&&request.method==='PUT')return uploadFile(request,env,fileMatch[1],fileMatch[2],url);
  const finalMatch=url.pathname.match(/^\/api\/drone\/jobs\/(drn-[a-zA-Z0-9-]+)\/finalize$/);if(finalMatch&&request.method==='POST')return finalizeUpload(request,env,finalMatch[1],url);
  const jobMatch=url.pathname.match(/^\/api\/drone\/jobs\/(drn-[a-zA-Z0-9-]+)$/);if(jobMatch&&request.method==='GET')return getJob(request,env,jobMatch[1],url);
  return reply(request,{ok:false,error:'not_found'},404);
}
