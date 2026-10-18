import {directAssetsEnabled, createPrivateAssetSigner} from './r2-private-assets.js';
const ALLOWED_ORIGINS = new Set(['https://webgisyg.id','https://www.webgisyg.id']);
const MAX_FILES = 800;
const MAX_FILE_BYTES = 40 * 1024 * 1024;
const MAX_TOTAL_BYTES = 8 * 1024 * 1024 * 1024;
const MAX_PENDING_JOBS = 20;
const PUBLIC_CATALOG_KEY = 'drone/public/catalog.json';

function cors(request){
  const origin=request.headers.get('origin')||'';
  return {
    'access-control-allow-origin': ALLOWED_ORIGINS.has(origin)?origin:'https://webgisyg.id',
    'access-control-allow-methods':'GET, HEAD, POST, PUT, OPTIONS',
    'access-control-allow-headers':'content-type, x-file-name, x-job-token, authorization, range',
    'access-control-expose-headers':'content-range, content-length, accept-ranges, etag',
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
function publicCatalogItem(job){return{id:job.id,missionId:job.missionId||null,polygonIds:job.polygonIds||[],missionGeometry:job.missionGeometry||null,title:job.title||'Survei drone',project:job.project||'YG GeoPortal',surveyDate:job.surveyDate||null,surveyStartAt:job.surveyStartAt||null,surveyEndAt:job.surveyEndAt||null,completedAt:job.completedAt||null,publishedAt:job.publishedAt||null,validPhotos:Number(job.validPhotos||0),excludedPhotos:Number(job.excludedPhotos||0),cameraModels:Array.isArray(job.cameraModels)?job.cameraModels.filter(Boolean).slice(0,5):[]}}
function suppliedJobToken(request,url){return String(request.headers.get('x-job-token')||url?.searchParams?.get('access')||'').trim()}
function authorizedJob(request,url,job){const supplied=suppliedJobToken(request,url);return Boolean(supplied&&job?.accessToken&&supplied===job.accessToken)}
function suppliedStaffToken(request){return String(request.headers.get('authorization')||'').replace(/^Bearer\s+/i,'').trim()}
async function authorizedStaff(request,env,verifyStaffToken){const token=suppliedStaffToken(request);return Boolean(token&&await verifyStaffToken(token,env))}
async function queueState(env,action=null,id=null,job=null){
  if(env.DRONE_QUEUE){const stub=env.DRONE_QUEUE.get(env.DRONE_QUEUE.idFromName('orthomosaic'));const response=await stub.fetch(new Request('https://queue.internal/',{method:action?'POST':'GET',...(action?{headers:{'content-type':'application/json'},body:JSON.stringify({action,id,job})}:{})}));if(!response.ok)throw Error(response.status===429?'queue_full':'queue_update_failed');return response.json();}
  // Test/local compatibility. Production uses Durable Object serialization.
  const key='drone/queue/pending.json',queue=await readJson(env,key,{jobs:[]});queue.jobs=Array.isArray(queue.jobs)?queue.jobs:[];
  if(action==='add'&&!queue.jobs.includes(id)){if(job)await writeJson(env,jobKey(id),job);queue.jobs.push(id);}
  if(action==='remove')queue.jobs=queue.jobs.filter(x=>x!==id);
  if(action)await writeJson(env,key,{...queue,updatedAt:new Date().toISOString()});return queue;
}
async function queueJob(env,id,job=null){return queueState(env,'add',id,job)}
async function pendingCount(env){return (await queueState(env)).jobs.length}
function missionMetadata(body){
  if(!body.missionId)return {};
  if(!/^DRN-[a-zA-Z0-9-]{1,80}$/.test(body.missionId)||!Array.isArray(body.polygonIds)||body.polygonIds.length>100||body.polygonIds.some(id=>typeof id!=='string'||!/^DAYUN-[a-zA-Z0-9-]+$/.test(id)))throw Error('invalid_mission_metadata');
  const g=body.missionGeometry,polys=g?.type==='Polygon'?[g.coordinates]:g?.type==='MultiPolygon'?g.coordinates:null;let count=0;
  if(!Array.isArray(polys)||!polys.length||polys.length>100)throw Error('invalid_mission_geometry');
  for(const poly of polys){if(!Array.isArray(poly)||!poly.length)throw Error('invalid_mission_geometry');for(const ring of poly){if(!Array.isArray(ring)||ring.length<4)throw Error('invalid_mission_geometry');for(const p of ring){if(!Array.isArray(p)||p.length<2||!Number.isFinite(p[0])||!Number.isFinite(p[1])||Math.abs(p[0])>180||Math.abs(p[1])>90||++count>30000)throw Error('invalid_mission_geometry');}if(ring[0][0]!==ring.at(-1)[0]||ring[0][1]!==ring.at(-1)[1])throw Error('invalid_mission_geometry');}}
  return {missionId:body.missionId,polygonIds:body.polygonIds,missionGeometry:g,missionPlan:{camera:String(body.missionPlan?.camera?.model||'DJI Air 3S').slice(0,100),status:'draft',flightReady:false},missionLinkedAt:new Date().toISOString()};
}
function newJob(body={}){const id=`drn-${crypto.randomUUID()}`;return{id,...missionMetadata(body),title:String(body.title||body.area||'Survei drone').slice(0,160),project:String(body.project||'YG GeoPortal').slice(0,160),sourceType:body.sourceType==='drive'?'drive':'upload',driveUrl:body.sourceType==='drive'?String(body.driveUrl||'').trim():null,status:body.sourceType==='drive'?'pending':'uploading',files:[],totalBytes:0,createdAt:new Date().toISOString(),accessToken:crypto.randomUUID().replace(/-/g,'')}}

async function createJob(request,env){
  if(await pendingCount(env)>=MAX_PENDING_JOBS)return reply(request,{ok:false,error:'queue_full'},429,{'retry-after':'300'});
  const body=await request.json().catch(()=>({}));
  let job;try{job=newJob(body)}catch(e){return reply(request,{ok:false,error:e.message},400)}
  if(job.sourceType==='drive'&&!/^https:\/\/drive\.google\.com\/drive\/folders\/[a-zA-Z0-9_-]+/i.test(job.driveUrl||''))return reply(request,{ok:false,error:'invalid_drive_folder_url'},400);
  if(job.status==='pending'){try{await queueJob(env,job.id,job)}catch(e){if(e.message==='queue_full')return reply(request,{ok:false,error:'queue_full'},429);throw e}}else await writeJson(env,jobKey(job.id),job);
  return reply(request,{ok:true,job:publicJob(job),accessToken:job.accessToken,limits:{maxFiles:MAX_FILES,maxFileMB:40,maxTotalGB:8}});
}
async function getJob(request,env,id,url,verifyStaffToken){
  const job=await readJson(env,jobKey(id));
  if(!job)return reply(request,{ok:false,error:'job_not_found'},404);
  if(!authorizedJob(request,url,job)&&!await authorizedStaff(request,env,verifyStaffToken))return reply(request,{ok:false,error:'unauthorized'},401);
  const safe=publicJob(job);
  if(job.status==='pending'){
    const queue=await queueState(env);
    const jobs=Array.isArray(queue?.jobs)?queue.jobs.map(String):[];
    const index=jobs.indexOf(id);
    safe.queuePosition=index>=0?index+1:null;
    safe.queueSize=jobs.length;
  }
  return reply(request,{ok:true,job:safe});
}
async function uploadFile(request,env,id,encodedName,url){
  const job=await readJson(env,jobKey(id));if(!job)return reply(request,{ok:false,error:'job_not_found'},404);if(!authorizedJob(request,url,job))return reply(request,{ok:false,error:'unauthorized'},401);
  if(job.sourceType!=='upload'||job.status!=='uploading')return reply(request,{ok:false,error:'job_not_uploadable'},409);
  const name=safeName(decodeURIComponent(encodedName||'photo.jpg'));const type=request.headers.get('content-type')||'application/octet-stream';if(!/^image\/(jpeg|jpg)$/i.test(type)&&!/\.jpe?g$/i.test(name))return reply(request,{ok:false,error:'jpeg_only'},415);
  const size=Number(request.headers.get('content-length')||0);if(!size)return reply(request,{ok:false,error:'content_length_required'},411);if(size>MAX_FILE_BYTES)return reply(request,{ok:false,error:'file_too_large'},413);
  const oldFiles=Array.isArray(job.files)?job.files:[];const existing=oldFiles.find(f=>f?.name===name);const nextCount=existing?oldFiles.length:oldFiles.length+1;if(nextCount>MAX_FILES)return reply(request,{ok:false,error:'too_many_files'},413);
  const oldBytes=Number(job.totalBytes||0)-Number(existing?.bytes||0);if(oldBytes+size>MAX_TOTAL_BYTES)return reply(request,{ok:false,error:'dataset_too_large'},413);
  const key=`drone/uploads/${id}/${name}`;await env.PUBLIC_SNAPSHOTS.put(key,request.body,{httpMetadata:{contentType:type,cacheControl:'private, max-age=0'}});
  const files=oldFiles.filter(f=>f?.key!==key&&f?.name!==name);files.push({name,key,bytes:size});job.files=files;job.totalBytes=oldBytes+size;job.updatedAt=new Date().toISOString();await writeJson(env,jobKey(id),job);
  return reply(request,{ok:true,id,file:{name,key},uploaded:files.length,totalBytes:job.totalBytes});
}
async function finalizeUpload(request,env,id,url){const job=await readJson(env,jobKey(id));if(!job)return reply(request,{ok:false,error:'job_not_found'},404);if(!authorizedJob(request,url,job))return reply(request,{ok:false,error:'unauthorized'},401);if(job.status==='pending')return reply(request,{ok:true,job:publicJob(job)});if(job.status!=='uploading')return reply(request,{ok:false,error:'job_not_uploadable'},409);if(job.sourceType!=='upload')return reply(request,{ok:false,error:'not_upload_job'},409);if(!Array.isArray(job.files)||job.files.length<3)return reply(request,{ok:false,error:'minimum_three_photos'},400);if(await pendingCount(env)>=MAX_PENDING_JOBS)return reply(request,{ok:false,error:'queue_full'},429,{'retry-after':'300'});job.status='pending';job.queuedAt=new Date().toISOString();await writeJson(env,jobKey(id),job);await queueJob(env,id);return reply(request,{ok:true,job:publicJob(job)})}
async function retryJob(request,env,id,url){
  const job=await readJson(env,jobKey(id));
  if(!job)return reply(request,{ok:false,error:'job_not_found'},404);
  if(!authorizedJob(request,url,job))return reply(request,{ok:false,error:'unauthorized'},401);
  if(job.status!=='failed')return reply(request,{ok:false,error:'retry_not_available'},409);
  if(await pendingCount(env)>=MAX_PENDING_JOBS)return reply(request,{ok:false,error:'queue_full'},429,{'retry-after':'300'});
  const now=new Date().toISOString();
  job.status='pending';
  job.stage='queued';
  job.stageLabel='Menunggu giliran pemrosesan';
  job.progress=0;
  job.queuedAt=now;
  job.updatedAt=now;
  job.retryCount=Number(job.retryCount||0)+1;
  job.lastError=job.error||null;
  delete job.error;
  delete job.failedAt;
  delete job.processingStartedAt;
  await writeJson(env,jobKey(id),job);
  await queueJob(env,id);
  return reply(request,{ok:true,job:publicJob(job)});
}
async function refineJob(request,env,id,url){
  const job=await readJson(env,jobKey(id));
  if(!job)return reply(request,{ok:false,error:'job_not_found'},404);
  if(!authorizedJob(request,url,job))return reply(request,{ok:false,error:'unauthorized'},401);
  if(job.status!=='ready')return reply(request,{ok:false,error:'refine_not_available'},409);
  if(job.sourceType==='upload'&&job.r2SourceRetained===false)return reply(request,{ok:false,error:'source_photos_expired'},409);
  if(await pendingCount(env)>=MAX_PENDING_JOBS)return reply(request,{ok:false,error:'queue_full'},429,{'retry-after':'300'});
  const now=new Date().toISOString();
  job.status='pending';
  job.stage='queued';
  job.stageLabel='Menunggu perapian hasil';
  job.progress=0;
  job.queuedAt=now;
  job.updatedAt=now;
  job.refineRequestedAt=now;
  job.refineCount=Number(job.refineCount||0)+1;
  delete job.completedAt;
  await writeJson(env,jobKey(id),job);
  await queueJob(env,id);
  return reply(request,{ok:true,job:publicJob(job)});
}
async function serveCog(request,env,id,url,verifyStaffToken){const job=await readJson(env,jobKey(id));if(!job||job.status!=='ready'||!job.cogKey)return reply(request,{ok:false,error:'orthomosaic_not_ready'},404);if(!authorizedJob(request,url,job)&&!await authorizedStaff(request,env,verifyStaffToken))return reply(request,{ok:false,error:'unauthorized'},401);const rangeHeader=request.headers.get('range');const object=await env.PUBLIC_SNAPSHOTS.get(job.cogKey,rangeHeader?{range:request.headers}:undefined);if(!object)return reply(request,{ok:false,error:'cog_missing'},404);const headers=new Headers(cors(request));object.writeHttpMetadata(headers);headers.set('etag',object.httpEtag);headers.set('accept-ranges','bytes');headers.set('content-length',String(object.range?.length ?? object.size));headers.set('cache-control','private, max-age=3600');if(object.range){const offset=object.range.offset||0;const length=object.range.length||object.size;headers.set('content-range',`bytes ${offset}-${offset+length-1}/${object.size}`)}return new Response(request.method==='HEAD'?null:object.body,{status:object.range?206:200,headers})}

async function listStaffJobs(request,env,verifyStaffToken){
  if(!await authorizedStaff(request,env,verifyStaffToken))return reply(request,{ok:false,error:'unauthorized'},401);
  const listing=await env.PUBLIC_SNAPSHOTS.list({prefix:'drone/jobs/',limit:1000});
  const jobs=(await Promise.all((listing?.objects||[]).map(async object=>publicJob(await readJson(env,object.key))))).filter(Boolean);
  const queue=await queueState(env);
  const queued=Array.isArray(queue?.jobs)?queue.jobs.map(String):[];
  jobs.forEach(job=>{const index=queued.indexOf(job.id);if(index>=0){job.queuePosition=index+1;job.queueSize=queued.length}});
  jobs.sort((a,b)=>String(b.updatedAt||b.createdAt||'').localeCompare(String(a.updatedAt||a.createdAt||'')));
  return reply(request,{ok:true,updatedAt:new Date().toISOString(),jobs:jobs.slice(0,100)});
}

async function publicCatalog(env){
  const value=await readJson(env,PUBLIC_CATALOG_KEY,{version:1,items:[]});
  return{version:1,updatedAt:value?.updatedAt||null,items:Array.isArray(value?.items)?value.items:[]};
}
async function savePublicCatalog(env,catalog){
  catalog.version=1;
  catalog.updatedAt=new Date().toISOString();
  await writeJson(env,PUBLIC_CATALOG_KEY,catalog);
}
async function publishJob(request,env,id,url){
  const job=await readJson(env,jobKey(id));
  if(!job)return reply(request,{ok:false,error:'job_not_found'},404);
  if(!authorizedJob(request,url,job))return reply(request,{ok:false,error:'unauthorized'},401);
  if(job.status!=='ready'||!job.cogKey)return reply(request,{ok:false,error:'publish_not_available'},409);
  if(!await env.PUBLIC_SNAPSHOTS.get(job.cogKey,{range:{offset:0,length:1}}))return reply(request,{ok:false,error:'cog_missing'},404);
  const now=new Date().toISOString();
  job.public=true;
  job.publishedAt=job.publishedAt||now;
  job.updatedAt=now;
  const catalog=await publicCatalog(env);
  catalog.items=[publicCatalogItem(job)].concat(catalog.items.filter(item=>item?.id!==id)).slice(0,100);
  await writeJson(env,jobKey(id),job);
  await savePublicCatalog(env,catalog);
  return reply(request,{ok:true,job:publicJob(job),publicItem:publicCatalogItem(job)});
}
async function unpublishJob(request,env,id,url){
  const job=await readJson(env,jobKey(id));
  if(!job)return reply(request,{ok:false,error:'job_not_found'},404);
  if(!authorizedJob(request,url,job))return reply(request,{ok:false,error:'unauthorized'},401);
  job.public=false;
  job.unpublishedAt=new Date().toISOString();
  job.updatedAt=job.unpublishedAt;
  const catalog=await publicCatalog(env);
  catalog.items=catalog.items.filter(item=>item?.id!==id);
  await writeJson(env,jobKey(id),job);
  await savePublicCatalog(env,catalog);
  return reply(request,{ok:true,job:publicJob(job)});
}
async function listPublicJobs(request,env){
  const catalog=await publicCatalog(env);
  return reply(request,{ok:true,...catalog},200,{'cache-control':'public, max-age=30, s-maxage=60'});
}
async function servePublicCog(request,env,id){
  const job=await readJson(env,jobKey(id));
  if(!job||job.public!==true||!job.publishedAt||!job.cogKey)return reply(request,{ok:false,error:'public_orthomosaic_not_found'},404);
  const rangeHeader=request.headers.get('range');
  const object=await env.PUBLIC_SNAPSHOTS.get(job.cogKey,rangeHeader?{range:request.headers}:undefined);
  if(!object)return reply(request,{ok:false,error:'cog_missing'},404);
  const headers=new Headers(cors(request));
  object.writeHttpMetadata(headers);
  headers.set('etag',object.httpEtag);
  headers.set('accept-ranges','bytes');headers.set('content-length',String(object.range?.length ?? object.size));
  headers.set('cache-control','public, max-age=3600, s-maxage=86400');
  if(object.range){const offset=object.range.offset||0;const length=object.range.length||object.size;headers.set('content-range',`bytes ${offset}-${offset+length-1}/${object.size}`)}
  return new Response(request.method==='HEAD'?null:object.body,{status:object.range?206:200,headers});
}

async function dayunAnalysis(request,env,url,verifyStaffToken){
  if(!await authorizedStaff(request,env,verifyStaffToken))return reply(request,{ok:false,error:'unauthorized'},401);
  const assets=url.pathname.match(/^\/api\/staff\/drone\/analysis\/(Agro_ABC|Agro_DEF)\/asset-links$/);
  if(assets){
    if(request.method!=='POST')return reply(request,{ok:false,error:'method_not_allowed'},405);
    if(!directAssetsEnabled(env))return reply(request,{ok:false,error:'private_asset_signer_unavailable'},503);
    const text=await request.text();if(text.length>32768)return reply(request,{ok:false,error:'asset_batch_too_large'},413);
    let body;try{body=JSON.parse(text)}catch{return reply(request,{ok:false,error:'invalid_asset_batch'},400);}
    if(!Array.isArray(body?.files)||!body.files.length||body.files.length>64||body.files.some(file=>typeof file!=='string'||file.length>400||file.split('/').some(p=>!p||p==='.'||p==='..')))return reply(request,{ok:false,error:'invalid_asset_batch'},400);
    const root=`drone/analysis/dayun/results/${assets[1]}`,manifest=await readJson(env,`${root}/index.json`);
    if(!manifest||!Array.isArray(manifest.files)||!manifest.prefix?.startsWith(root+'/')||manifest.prefix.split('/').some(p=>!p||p==='.'||p==='..'))return reply(request,{ok:false,error:'analysis_not_available'},404);
    if(body.files.some(file=>!manifest.files.includes(file)))return reply(request,{ok:false,error:'asset_not_found'},404);
    const sign=await createPrivateAssetSigner(env);
    const links=await Promise.all([...new Set(body.files)].map(async file=>({file,...await sign(`${manifest.prefix}/${file}`)})));
    return reply(request,{ok:true,links});
  }
  const fruiting=url.pathname.match(/^\/api\/staff\/drone\/analysis\/(Agro_ABC)\/fruiting-review$/);
  if(fruiting){
    if(!['GET','POST'].includes(request.method))return reply(request,{ok:false,error:'method_not_allowed'},405);
    if(!env.DRONE_QUEUE)return reply(request,{ok:false,error:'review_storage_unavailable'},503);
    let body={};if(request.method==='POST'){const text=await request.text();if(text.length>8192)return reply(request,{ok:false,error:'fruiting_review_too_large'},413);try{body=JSON.parse(text)}catch{return reply(request,{ok:false,error:'invalid_fruiting_json'},400);}if(!body||typeof body!=='object'||Array.isArray(body))return reply(request,{ok:false,error:'invalid_fruiting_json'},400);}
    const stub=env.DRONE_QUEUE.get(env.DRONE_QUEUE.idFromName('dayun-fruiting-review-Agro_ABC'));
    const response=await stub.fetch(new Request('https://queue.internal/dayun-fruiting-review',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({label:'Agro_ABC',block:url.searchParams.get('block'),action:request.method==='POST'?'save':'load',source_run:body.source_run,proposal_path:body.proposal_path,operation:body.operation})}));
    return reply(request,await response.json(),response.status,{'cache-control':'private, no-store'});
  }
  const blockReview=url.pathname.match(/^\/api\/staff\/drone\/analysis\/(Agro_ABC|Agro_DEF)\/block-review$/);
  if(blockReview){
    if(!['GET','POST'].includes(request.method))return reply(request,{ok:false,error:'method_not_allowed'},405);
    if(!env.DRONE_QUEUE)return reply(request,{ok:false,error:'review_storage_unavailable'},503);
    let body={};if(request.method==='POST'){const text=await request.text();if(text.length>8*1024*1024)return reply(request,{ok:false,error:'block_review_too_large'},413);try{body=JSON.parse(text)}catch{return reply(request,{ok:false,error:'invalid_block_review_json'},400);}if(!body||typeof body!=='object'||Array.isArray(body))return reply(request,{ok:false,error:'invalid_block_review_json'},400);}
    const stub=env.DRONE_QUEUE.get(env.DRONE_QUEUE.idFromName('dayun-block-review-'+blockReview[1]));
    const response=await stub.fetch(new Request('https://queue.internal/dayun-block-review',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({label:blockReview[1],block:url.searchParams.get('block'),action:request.method==='POST'?'save':'load',review:body.review,patch:body.patch,expected_revision:body.expected_revision})}));
    return reply(request,await response.json(),response.status,{'cache-control':'private, no-store'});
  }
  const reviewMatch=url.pathname.match(/^\/api\/staff\/drone\/analysis\/(Agro_ABC|Agro_DEF)\/review$/);
  if(reviewMatch){
    if(!['GET','POST'].includes(request.method))return reply(request,{ok:false,error:'method_not_allowed'},405);
    if(!env.DRONE_QUEUE)return reply(request,{ok:false,error:'review_storage_unavailable'},503);
    let body={};if(request.method==='POST'){
      const text=await request.text();if(text.length>2*1024*1024)return reply(request,{ok:false,error:'review_too_large'},413);
      try{body=JSON.parse(text)}catch{return reply(request,{ok:false,error:'invalid_review_json'},400);}
      if(!body||typeof body!=='object'||Array.isArray(body))return reply(request,{ok:false,error:'invalid_review_json'},400);
    }
    const stub=env.DRONE_QUEUE.get(env.DRONE_QUEUE.idFromName('dayun-review-'+reviewMatch[1]));
    const trial_id=url.searchParams.has('trial')?url.searchParams.get('trial'):undefined;
    const response=await stub.fetch(new Request('https://queue.internal/dayun-review',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({review:body.review,expected_revision:body.expected_revision,trial_id,label:reviewMatch[1],action:request.method==='POST'?'save':'load'})}));
    return reply(request,await response.json(),response.status,{'cache-control':'private, no-store'});
  }
  if(url.pathname==='/api/staff/drone/analysis/requests'){
    const root='drone/analysis/dayun/requests';
    if(request.method==='GET'){
      const jobs=(await Promise.all(['Agro_ABC','Agro_DEF'].map(label=>readJson(env,`${root}/${label}.json`)))).filter(Boolean);
      return reply(request,{ok:true,jobs});
    }
    if(request.method!=='POST')return reply(request,{ok:false,error:'method_not_allowed'},405);
    const body=await request.json().catch(()=>({}));
    let drive;try{drive=new URL(body.driveUrl)}catch{return reply(request,{ok:false,error:'invalid_drive_file_url'},400)}
    if(drive.protocol!=='https:'||drive.hostname!=='drive.google.com'||drive.port||drive.username||drive.password)return reply(request,{ok:false,error:'invalid_drive_file_url'},400);
    const fileId=drive.pathname.match(/^\/file\/d\/([\w-]+)(?:\/view)?\/?$/)?.[1] || (drive.pathname==='/open'?drive.searchParams.get('id'):null);
    const source={'11kWmzkdTWVuxrDJMOYk3JfN34xeoZNRx':['Agro_ABC',13677790714],'14d-Hui0iwSvHQtCbZJa3InBOlQ3OdGNo':['Agro_DEF',3432485808]}[fileId];
    if(!source)return reply(request,{ok:false,error:'dayun_source_not_registered',message:'Gunakan link berkas Agro_ABC.tif atau Agro_DEF.tif untuk analisis Dayun.'},400);
    if(!env.DRONE_QUEUE)return reply(request,{ok:false,error:'analysis_queue_unavailable'},503);
    const now=new Date().toISOString(),job={id:crypto.randomUUID(),label:source[0],fileId,expectedBytes:source[1],status:'pending',stage:'queued',createdAt:now,updatedAt:now,plantCountStatus:'not_tested',censusChanged:false};
    const stub=env.DRONE_QUEUE.get(env.DRONE_QUEUE.idFromName('dayun-analysis'));
    const response=await stub.fetch(new Request('https://queue.internal/dayun',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'submit',job})}));
    if(!response.ok)return reply(request,{ok:false,error:'analysis_queue_unavailable'},503);
    return reply(request,{ok:true,...await response.json()},202);
  }
  if(!['GET','HEAD'].includes(request.method))return reply(request,{ok:false,error:'method_not_allowed'},405);
  const match=url.pathname.match(/^\/api\/staff\/drone\/analysis\/(Agro_ABC|Agro_DEF)(?:\/files\/(.+))?$/);
  if(!match)return reply(request,{ok:false,error:'not_found'},404);
  const root=`drone/analysis/dayun/results/${match[1]}`;
  const manifest=await readJson(env,`${root}/index.json`);
  if(!manifest)return reply(request,{ok:false,error:'analysis_not_available'},404);
  if(!match[2])return reply(request,{...manifest,assetDelivery:directAssetsEnabled(env)?'r2-signed-v1':'worker'});
  const file=match[2];
  if(!Array.isArray(manifest.files)||!manifest.files.includes(file)||file.split('/').some(p=>!p||p==='.'||p==='..')||!manifest.prefix?.startsWith(root+'/'))return reply(request,{ok:false,error:'not_found'},404);
  const key=`${manifest.prefix}/${file}`,range=request.headers.get('range');
  let slice=null,total;
  if(range){
    const info=await env.PUBLIC_SNAPSHOTS.head(key);if(!info)return reply(request,{ok:false,error:'not_found'},404);total=info.size;
    const match=range.match(/^bytes=(\d*)-(\d*)$/);
    if(match&&(match[1]||match[2])&&match.slice(1).filter(Boolean).every(v=>Number.isSafeInteger(Number(v)))){
      const start=match[1]?Number(match[1]):Math.max(0,total-Number(match[2]));
      const end=match[1]?(match[2]?Math.min(Number(match[2]),total-1):total-1):total-1;
      if(Number.isSafeInteger(start)&&Number.isSafeInteger(end)&&start>=0&&start<=end&&start<total&&(!match[1]?Number(match[2])>0:true))slice={offset:start,length:end-start+1};
    }
    if(!slice)return reply(request,{ok:false,error:'invalid_byte_range'},416,{'content-range':`bytes */${total}`,'cache-control':'private, no-store'});
  }
  const object=request.method==='HEAD'?await env.PUBLIC_SNAPSHOTS.head(key):await env.PUBLIC_SNAPSHOTS.get(key,slice?{range:slice}:undefined);
  if(!object)return reply(request,{ok:false,error:'not_found'},404);
  const types={json:'application/json',geojson:'application/geo+json',csv:'text/csv',jpg:'image/jpeg',tif:'image/tiff',txt:'text/plain'};
  return new Response(request.method==='HEAD'?null:object.body,{status:slice?206:200,headers:{...cors(request),'cache-control':'private, no-store','accept-ranges':'bytes',...(slice?{'content-range':`bytes ${slice.offset}-${slice.offset+slice.length-1}/${total}`} : {}),'content-type':types[file.split('.').pop()]||'application/octet-stream','content-length':String(slice?.length??object.size)}});
}
export function isDroneRoute(pathname){return pathname==='/api/drone/jobs'||pathname.startsWith('/api/drone/jobs/')||pathname==='/api/drone/public'||pathname.startsWith('/api/drone/public/')||pathname==='/api/staff/drone/jobs'||pathname.startsWith('/api/staff/drone/analysis/')}
async function routeDroneRequest(request,env,url,verifyStaffToken=async()=>false){
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors(request)});
  const origin=request.headers.get('origin')||'';
  if(['POST','PUT'].includes(request.method)&&!ALLOWED_ORIGINS.has(origin))return reply(request,{ok:false,error:'origin_not_allowed'},403);
  if(origin&&!ALLOWED_ORIGINS.has(origin))return reply(request,{ok:false,error:'origin_not_allowed'},403);
  if(url.pathname.startsWith('/api/staff/drone/analysis/')&&['GET','HEAD','POST'].includes(request.method))return dayunAnalysis(request,env,url,verifyStaffToken);
  if(url.pathname==='/api/drone/public'&&(request.method==='GET'||request.method==='HEAD'))return listPublicJobs(request,env);
  if(url.pathname==='/api/staff/drone/jobs'&&request.method==='GET')return listStaffJobs(request,env,verifyStaffToken);
  const publicCogMatch=url.pathname.match(/^\/api\/drone\/public\/(drn-[a-zA-Z0-9-]+)\/cog$/);if(publicCogMatch&&(request.method==='GET'||request.method==='HEAD'))return servePublicCog(request,env,publicCogMatch[1]);
  const cogMatch=url.pathname.match(/^\/api\/drone\/jobs\/(drn-[a-zA-Z0-9-]+)\/cog$/);if(cogMatch&&(request.method==='GET'||request.method==='HEAD'))return serveCog(request,env,cogMatch[1],url,verifyStaffToken);
  if(url.pathname==='/api/drone/jobs'&&request.method==='POST')return createJob(request,env);
  const fileMatch=url.pathname.match(/^\/api\/drone\/jobs\/(drn-[a-zA-Z0-9-]+)\/files\/(.+)$/);if(fileMatch&&request.method==='PUT')return uploadFile(request,env,fileMatch[1],fileMatch[2],url);
  const ackMatch=url.pathname.match(/^\/api\/drone\/jobs\/(drn-[a-zA-Z0-9-]+)\/queue-complete$/);
  if(ackMatch&&request.method==='POST'){const job=await readJson(env,jobKey(ackMatch[1]));if(!job)return reply(request,{ok:false,error:'job_not_found'},404);if(!authorizedJob(request,url,job))return reply(request,{ok:false,error:'unauthorized'},401);if(!['ready','failed'].includes(job.status))return reply(request,{ok:false,error:'job_still_active'},409);await queueState(env,'remove',job.id);return reply(request,{ok:true});}
  const finalMatch=url.pathname.match(/^\/api\/drone\/jobs\/(drn-[a-zA-Z0-9-]+)\/finalize$/);if(finalMatch&&request.method==='POST')return finalizeUpload(request,env,finalMatch[1],url);
  const retryMatch=url.pathname.match(/^\/api\/drone\/jobs\/(drn-[a-zA-Z0-9-]+)\/retry$/);if(retryMatch&&request.method==='POST')return retryJob(request,env,retryMatch[1],url);
  const refineMatch=url.pathname.match(/^\/api\/drone\/jobs\/(drn-[a-zA-Z0-9-]+)\/refine$/);if(refineMatch&&request.method==='POST')return refineJob(request,env,refineMatch[1],url);
  const publishMatch=url.pathname.match(/^\/api\/drone\/jobs\/(drn-[a-zA-Z0-9-]+)\/publish$/);if(publishMatch&&request.method==='POST')return publishJob(request,env,publishMatch[1],url);
  const unpublishMatch=url.pathname.match(/^\/api\/drone\/jobs\/(drn-[a-zA-Z0-9-]+)\/unpublish$/);if(unpublishMatch&&request.method==='POST')return unpublishJob(request,env,unpublishMatch[1],url);
  const jobMatch=url.pathname.match(/^\/api\/drone\/jobs\/(drn-[a-zA-Z0-9-]+)$/);if(jobMatch&&request.method==='GET')return getJob(request,env,jobMatch[1],url,verifyStaffToken);
  return reply(request,{ok:false,error:'not_found'},404);
}

// Keep storage/runtime failures readable by browsers, including CORS headers.
export async function handleDroneRequest(request,env,url,verifyStaffToken=async()=>false){
  try{return await routeDroneRequest(request,env,url,verifyStaffToken)}
  catch(error){
    console.error('Drone service request failed',url.pathname,error?.name||'Error');
    return reply(request,{ok:false,error:'drone_service_unavailable'},503,{'retry-after':'30'});
  }
}
