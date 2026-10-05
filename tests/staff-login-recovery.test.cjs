const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const authCode=fs.readFileSync('js/auth.js','utf8');
function setup(read){
 const stored=new Map(),calls=[];let active=0,maxActive=0;
 const storage={getItem:key=>stored.get(key)||null,setItem:(key,value)=>stored.set(key,value),removeItem:key=>stored.delete(key)};
 const context={window:{addEventListener(){}},document:{readyState:'loading',addEventListener(){}},localStorage:storage,sessionStorage:{getItem:()=>null,removeItem(){}},crypto:require('node:crypto').webcrypto,URLSearchParams,AbortController,Date,Math,console,setTimeout:(fn,ms)=>setTimeout(fn,ms<=1500?0:ms),clearTimeout,
 fetch:async(url,options)=>{calls.push({url,method:options.method});if(options.method==='POST')return{};active++;maxActive=Math.max(maxActive,active);try{return await read(url,calls.filter(c=>c.method!=='POST').length)}finally{active--}}};
 vm.runInNewContext(authCode,context);
 return{auth:context.window.YG_AUTH,calls,stored,maxActive:()=>maxActive};
}
const response=data=>({ok:true,json:async()=>data});
const success=()=>({ok:true,sessionToken:'fixture-token',username:'fixture',expiresAt:Date.now()+60000});

test('login starts reading results immediately without an initial polling sleep',async()=>{
 const s=setup(async()=>response(success()));
 const promise=s.auth.login('fixture','fixture-password');
 assert.equal(s.calls.length,2,'POST and first result request begin in the same turn');
 await promise;
 assert.equal(s.maxActive(),1);
});
test('consume-on-read login keeps a single reader and does not lose a ready result to pending',async()=>{
 const s=setup(async(url,n)=>{await new Promise(r=>setTimeout(r,3));return response(n===1?{pending:true}:success())});
 const progress=[];await s.auth.login('fixture','fixture-password',text=>progress.push(text));
 assert.equal(s.maxActive(),1);assert.equal(s.calls.length,3);
 assert.ok(s.calls.filter(c=>c.method!=='POST').every(c=>!c.url.includes('-staging.')));
 assert.equal(JSON.parse(s.stored.get('ygEditorSessionV1')).token,'fixture-token');assert.ok(progress.length>=2);
});
test('transport failure moves to fallback only after primary read settles',async()=>{
 const s=setup(async(url,n)=>{if(n===1)throw Error('network');return response(success())});
 await s.auth.login('fixture','fixture-password');assert.equal(s.maxActive(),1);
 assert.match(s.calls[2].url,/-staging\./);
});
test('incorrect credentials are shown immediately without retrying the other result reader',async()=>{
 const s=setup(async()=>response({ok:false,message:'Username atau password tidak benar.'}));
 await assert.rejects(s.auth.login('fixture','bad'),/Username atau password/);assert.equal(s.calls.length,2);assert.equal(s.stored.size,0);
});
test('malformed successful response never stores an invalid session',async()=>{
 const s=setup(async()=>response({ok:true,username:'fixture',expiresAt:'invalid'}));
 await assert.rejects(s.auth.login('fixture','fixture-password'),/Data sesi/);assert.equal(s.stored.size,0);
});
function loginPage(returnValue){
 const elements=new Map(),redirects=[];const el=id=>{if(!elements.has(id))elements.set(id,{hidden:true,addEventListener(){},classList:{toggle(){}}});return elements.get(id)};
 const context={document:{getElementById:el,querySelectorAll:()=>[]},window:{location:{search:'?return='+encodeURIComponent(returnValue),href:'https://webgisyg.id/staff-login.html',origin:'https://webgisyg.id',replace:url=>redirects.push(url)},YG_AUTH:{readStoredSession:()=>({token:'stale-but-unexpired'})}},URL,URLSearchParams};
 vm.runInNewContext(fs.readFileSync('js/staff-login.js','utf8'),context);return{el,redirects};
}
test('stored session never auto-redirects away from login recovery',()=>{
 const s=loginPage('orthomosaic-internal.html');assert.equal(s.redirects.length,0);assert.equal(s.el('staff-existing-session').hidden,false);assert.equal(s.el('staff-continue-session').href,'/orthomosaic-internal.html');
});
test('session continuation cannot redirect to a different origin through backslashes',()=>{
 const s=loginPage('\\\\example.org');assert.equal(s.el('staff-continue-session').href,'admin-dashboard.html');
});
