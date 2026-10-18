// Reuse the existing deployment identity. Never print credentials or signed URLs.
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {signPrivateAsset} from '../src/r2-private-assets.js';

const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN;
if(!account||!token)throw Error('Cloudflare deployment identity is missing');
async function api(path,options={},allowMissing=false){
  const response=await fetch('https://api.cloudflare.com/client/v4/'+path,{...options,headers:{authorization:'Bearer '+token,'content-type':'application/json',...options.headers}});
  if(allowMissing&&response.status===404)return {rules:[]};
  const data=await response.json();if(!response.ok||data.success!==true)throw Error(`Cloudflare configuration failed (HTTP ${response.status})`);return data.result;
}
let identity;
try{identity=await api('user/tokens/verify');}catch{identity=await api(`accounts/${account}/tokens/verify`);}
if(!identity?.id||identity.status!=='active')throw Error('Deployment API token is not active');
const credentials={DRONE_R2_ACCESS_KEY_ID:identity.id,DRONE_R2_SECRET_ACCESS_KEY:createHash('sha256').update(token).digest('hex')};
const bucket='yg-webgis-public-snapshots';
const prefix=`accounts/${account}/r2/buckets/`;
async function requirePrivate(name){
  const managed=await api(prefix+name+'/domains/managed'),custom=await api(prefix+name+'/domains/custom');
  if(managed.enabled!==false||!Array.isArray(custom.domains)||custom.domains.length)throw Error('Private drone bucket must have no public domains');
}
await requirePrivate(bucket);
// Test the existing identity's S3 access before changing any configuration.
const manifestResponse=await fetch(`https://api.cloudflare.com/client/v4/${prefix}${bucket}/objects/drone/analysis/dayun/results/Agro_ABC/index.json`,{headers:{authorization:'Bearer '+token}});
if(!manifestResponse.ok)throw Error('Cannot read the private drone manifest');
const manifest=await manifestResponse.json(),root='drone/analysis/dayun/results/Agro_ABC/';
const file=manifest.files?.find(file=>/\.tif$/i.test(file));
if(!file||!manifest.prefix?.startsWith(root)||manifest.prefix.split('/').some(p=>!p||p==='.'||p==='..')||file.split('/').some(p=>!p||p==='.'||p==='..'))throw Error('Private source TIFF is unavailable');
const settings={...credentials,DRONE_R2_ACCOUNT_ID:account,DRONE_R2_BUCKET:bucket};
const {url}=await signPrivateAsset(settings,manifest.prefix+'/'+file);
const test=await fetch(url,{headers:{range:'bytes=0-15'},redirect:'error'});
await test.body?.cancel();
if(test.status!==206)throw Error(`Existing deployment identity cannot read R2 over S3 (HTTP ${test.status}); no credentials or CORS were changed`);
const unsigned=await fetch(url.split('?')[0],{headers:{range:'bytes=0-15'},redirect:'error'});
await unsigned.body?.cancel();if(![401,403].includes(unsigned.status))throw Error('Unsigned private R2 access must be denied');
const previousCors=[];
try{for(const [environment,name]of [['staging',bucket+'-staging'],['production',bucket]]){
  await requirePrivate(name);
  let cors;try{cors=await api(prefix+name+'/cors',{},true);}catch(error){throw Error('Cannot safely read existing R2 CORS: '+error.message);}
  const existing=cors.rules||[];
  const origins=['https://webgisyg.id','https://www.webgisyg.id'];
  // Preserve unrelated rules; replace only this feature's exact rule.
  const rules=existing.filter(rule=>rule.id!=='yg-private-drone-read');
  rules.push({id:'yg-private-drone-read',allowed:{origins,methods:['GET','HEAD'],headers:['range','if-match','if-none-match']},exposeHeaders:['Content-Range','Content-Length','Accept-Ranges','ETag'],maxAgeSeconds:3600});
  previousCors.push({name,rules:existing});
  await api(prefix+name+'/cors',{method:'PUT',body:JSON.stringify({rules})});
  const result=spawnSync(process.execPath,['node_modules/wrangler/bin/wrangler.js','secret','bulk','--env',environment],{input:JSON.stringify(credentials),encoding:'utf8',env:process.env});
  if(result.status!==0)throw Error(`Cannot configure private asset signer for ${environment}`);
  const corsTest=await fetch(url,{method:'OPTIONS',headers:{origin:origins[0],'access-control-request-method':'GET','access-control-request-headers':'range'}});
  if(environment==='production'&&(!corsTest.ok||corsTest.headers.get('access-control-allow-origin')!==origins[0]))throw Error('Private R2 CORS verification failed');
  console.log(`Private drone R2 signer configured for ${environment}; public access remains disabled`);
}}catch(error){
  for(const {name,rules}of previousCors.reverse()){
    try{await api(prefix+name+'/cors',rules.length?{method:'PUT',body:JSON.stringify({rules})}:{method:'DELETE'});}
    catch{console.error('Could not restore prior CORS for '+name+'; check the bucket configuration');}
  }
  throw error;
}
