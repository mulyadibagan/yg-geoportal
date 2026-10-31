const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const valid={token:'yg-google-test-fixture',expiresAt:Date.now()+60000};
function storage(initial={}){const values=new Map(Object.entries(initial));return {getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};}
function app({local={},session={},query='?event=dayun-panen-20261030'}={}){
 const nodes=new Map(),listeners={},documentListeners={},calls=[],assigned=[];
 function element(id){if(!nodes.has(id))nodes.set(id,{id,hidden:false,value:'',textContent:'',innerHTML:'',classList:{toggle(){},add(){}},addEventListener(type,fn){this[type]=fn;},replaceChildren(){this.innerHTML='';},reset(){},close(){this.open=false;},showModal(){this.open=true;}});return nodes.get(id);}
 const form=element('event-form');form.elements=Object.fromEntries(['title','date','time','kind','location','notes','result'].map(k=>[k,element(k)]));
 const localStorage=storage(local),sessionStorage=storage(session);
 const event={id:'dayun-panen-20261030',date:'2026-10-30',title:'Panen 30 Oktober',time:'',kind:'Panen',location:'Blok B dan C',participants:[{id:'p1',name:'Yurmayenti',status:'present'}]};
 const context={document:{getElementById:element,addEventListener:(k,v)=>documentListeners[k]=v,visibilityState:'visible'},window:{addEventListener:(k,v)=>listeners[k]=v},location:{search:query,assign:url=>assigned.push(url)},sessionStorage,localStorage,URLSearchParams,Date,AbortSignal,TextEncoder,crypto:globalThis.crypto,btoa,fetch:async(url,options)=>{calls.push({url,options});return {ok:true,status:200,json:async()=>({user:{name:'Pengurus'},canManage:true,events:[event]})};}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../js/dayun-kegiatan.js'),'utf8'),context);
 return {element,calls,listeners,sessionStorage,localStorage,assigned};
}
test('signed-out attendance requires login and never requests the roster',()=>{
 const a=app();assert.equal(a.element('app').hidden,true);assert.equal(a.element('login-panel').hidden,false);assert.equal(a.calls.length,0);
});
test('attendance session opens the exact linked harvest and report after login',async()=>{
 const a=app({local:{ygDayunAttendanceSession:JSON.stringify(valid)}});await new Promise(setImmediate);
 assert.equal(a.calls[0].options.headers.Authorization,'Bearer '+valid.token);assert.equal(a.element('app').hidden,false);assert.equal(a.element('editor').open,true);
 assert.match(a.element('events').innerHTML,/dayun.html#panen-nanas-20261030/);assert.match(a.element('events').innerHTML,/Yurmayenti/);
});
test('old shared-session removal cannot erase a dedicated attendance login',async()=>{
 const a=app({local:{ygDayunAttendanceSession:JSON.stringify(valid),ygEditorSessionV1:JSON.stringify(valid)}});await new Promise(setImmediate);
 a.localStorage.removeItem('ygEditorSessionV1');a.listeners.storage({key:'ygEditorSessionV1'});await new Promise(setImmediate);
 assert.equal(a.element('app').hidden,false);assert.equal(a.element('login-panel').hidden,true);assert(a.localStorage.getItem('ygDayunAttendanceSession'));assert.equal(a.calls.length,1);
});
test('tab session restores attendance even if shared local storage was cleared',async()=>{
 const a=app({session:{ygDayunAttendanceSession:JSON.stringify(valid)}});await new Promise(setImmediate);assert.equal(a.element('app').hidden,false);
});
test('expired attendance session stays signed out',()=>{
 const a=app({local:{ygDayunAttendanceSession:JSON.stringify({...valid,expiresAt:1})}});assert.equal(a.element('app').hidden,true);assert.equal(a.calls.length,0);
});
test('login request retains the selected activity through OAuth',async()=>{
 const a=app();await a.element('login').click();const p=JSON.parse(a.sessionStorage.getItem('ygGoogleRequest'));
 assert.equal(p.target,'dayun-kegiatan.html?event=dayun-panen-20261030');assert.equal(p.verifier.length,64);assert.match(a.assigned[0],/^https:\/\/staff.yayasangambut.org\/auth\/kups\?/);
});
async function callback(scope='kups-finance',target='dayun-kegiatan.html?event=dayun-panen-20261030'){
 const localStorage=storage(),sessionStorage=storage({ygGoogleRequest:JSON.stringify({verifier:'test-verifier',state:'test-state',created:Date.now(),target})}),nodes={},replaced=[];
 const get=id=>nodes[id]||(nodes[id]={addEventListener(){},textContent:'',disabled:false});
 const context={document:{getElementById:get},location:{href:'https://webgisyg.id/staff-login.html#googleCode=test-code&state=test-state',origin:'https://webgisyg.id',pathname:'/staff-login.html',search:'',hash:'#googleCode=test-code&state=test-state',replace:url=>replaced.push(url)},history:{replaceState(){}},URL,URLSearchParams,Date,localStorage,sessionStorage,fetch:async()=>({ok:true,json:async()=>({ok:true,sessionToken:valid.token,username:'fixture',name:'Fixture',scope,expiresAt:valid.expiresAt})})};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../js/google-staff-login.js'),'utf8'),context);await new Promise(setImmediate);
 return {localStorage,sessionStorage,replaced};
}
test('Google callback saves isolated attendance session and preserves the linked event',async()=>{
 for(const scope of ['kups-finance','webgis-staff']){
  const a=await callback(scope);assert.equal(a.replaced[0],'/dayun-kegiatan.html?event=dayun-panen-20261030');
  assert.equal(JSON.parse(a.localStorage.getItem('ygDayunAttendanceSession')).token,valid.token);
  assert.equal(JSON.parse(a.sessionStorage.getItem('ygDayunAttendanceSession')).token,valid.token);
  assert.equal(a.localStorage.getItem('ygEditorSessionV1'),null);
 }
});
test('restricted Google login never redirects to an untrusted return URL',async()=>{
 const a=await callback('kups-finance','https://example.com/dayun-kegiatan.html');assert.equal(a.replaced[0],'kups-finance.html');assert.equal(a.localStorage.getItem('ygDayunAttendanceSession'),null);
});
