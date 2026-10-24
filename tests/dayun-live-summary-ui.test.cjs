const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
class Node{constructor(tag){this.tag=tag;this.children=[];this.style={};this.dataset={};this.textContent='';}append(...n){this.children.push(...n);}replaceChildren(...n){this.children=n;}setAttribute(k,v){this[k]=v;}querySelectorAll(){return this.children.flatMap(n=>[n,...n.querySelectorAll()]);}}
const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
test('live summary refreshes on poll/save/focus, preserves marked stale data on failure, and never fetches the snapshot',async()=>{
 const host=new Node('section');host.dataset.dayunWorkSummary='all';const events={},timers=new Map(),calls=[];let interval,id=0,fail=false,plants=10;
 const document={querySelector:()=>host,createElement:t=>new Node(t),addEventListener:(k,f)=>events[k]=f,visibilityState:'visible'};
 const window={addEventListener:(k,f)=>events[k]=f},fetch=async(url,options)=>{calls.push({url,options});if(fail)throw Error('offline');return{ok:true,json:async()=>({schema:'dayun-live-work-counts-v1',live:true,checkedAt:'2026-10-24T00:00:00Z',revisions:{A:{plants,fruits:2}},rows:[{objectId:'DAYUN-GT-A-01',zone:'GT-A-01',block:'A',plants,newPlants:3,fruits:2,allocated:1}]})};};
 vm.runInNewContext(fs.readFileSync('js/dayun-work-summary.js','utf8'),{window,document,fetch,URLSearchParams,location:{search:''},AbortSignal,Date,setTimeout:f=>{timers.set(++id,f);return id;},clearTimeout:i=>timers.delete(i),setInterval:f=>{interval=f;}});await flush();assert.equal(calls.length,1);
 const text=()=>host.querySelectorAll().map(n=>n.textContent).join(' ');assert.match(text(),/10 nanas/);plants=11;events['dayun:work-saved']();assert.match(text(),/memperbarui rekap/);[...timers.values()].at(-1)();await flush();assert.match(text(),/11 nanas/);
 fail=true;interval();await flush();assert.match(text(),/11 nanas/);assert.match(text(),/Sinkronisasi gagal/);fail=false;plants=12;events.visibilitychange();await flush();assert.match(text(),/12 nanas/);assert(calls.every(c=>c.url.endsWith('/dayun/live-work-counts.json')&&c.options.cache==='no-store'));
 document.visibilityState='hidden';const n=calls.length;interval();await flush();assert.equal(calls.length,n);
});
