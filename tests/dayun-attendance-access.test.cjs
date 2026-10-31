const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
function app(saved=null,query=''){
 const nodes=new Map(),listeners={};
 function element(id){if(!nodes.has(id))nodes.set(id,{id,hidden:false,value:'',textContent:'',innerHTML:'',classList:{toggle(){},add(){}},addEventListener(type,fn){this[type]=fn;},replaceChildren(){this.innerHTML='';},reset(){},close(){this.open=false;},showModal(){this.open=true;}});return nodes.get(id);}
 const form=element('event-form');form.elements=Object.fromEntries(['title','date','time','kind','location','notes','result'].map(k=>[k,element(k)]));
 const calls=[],sessionStore=new Map();
 const event={id:'dayun-sensus-20261031',date:'2026-10-31',title:'Sensus',time:'07:00',kind:'Sensus tanaman',location:'Blok B dan C',participants:[]};
 const context={document:{getElementById:element},window:{addEventListener(k,v){listeners[k]=v;}},location:{search:query},sessionStorage:{getItem:k=>sessionStore.get(k)||null,setItem:(k,v)=>sessionStore.set(k,v),removeItem:k=>sessionStore.delete(k)},localStorage:{getItem:()=>saved?JSON.stringify(saved):null,removeItem(){}},URLSearchParams,Date,AbortSignal,crypto:globalThis.crypto,fetch:async(url,options)=>{calls.push({url,options});return {ok:true,status:200,json:async()=>({user:{name:'Pengurus'},canManage:true,events:[event]})};}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../js/dayun-kegiatan.js'),'utf8'),context);
 return {element,calls,sessionStore};
}
test('signed-out attendance requires login and never requests the named roster',()=>{
 const a=app(null,'?event=dayun-sensus-20261031');
 assert.equal(a.element('app').hidden,true);assert.equal(a.element('login-panel').hidden,false);assert.equal(a.calls.length,0);assert.match(a.element('status').textContent,/Masuk/);
});
test('authenticated linked attendance opens the exact event and links back to its field report',async()=>{
 const a=app({token:'yg-google-test-fixture',expiresAt:Date.now()+60000},'?event=dayun-sensus-20261031');
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(a.calls.length,1);assert.equal(a.calls[0].options.headers.Authorization,'Bearer yg-google-test-fixture');
 assert.equal(a.element('app').hidden,false);assert.equal(a.element('login-panel').hidden,true);assert.equal(a.element('editor').open,true);
 assert.match(a.element('events').innerHTML,/dayun.html#sensus-beruk-20261031/);
});
test('field attendance uses only the public summary endpoint without credentials',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../js/dayun-field-attendance.js'),'utf8');
 assert.match(source,/activities\/summary\?group=dayun-rimba-sejahtera/);assert.match(source,/credentials:'omit'/);
});
