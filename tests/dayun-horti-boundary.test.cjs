const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function fixture(initial={token:'test-staff-token',expiresAt:200000}){
 let session=initial,options,status=200,pause=null;const requests=[],events={},timers=[],drawn=[];
 const el=tag=>({tag,children:[],append(...n){this.children.push(...n)},prepend(n){this.children.unshift(n)},replaceChildren(...n){this.children=n},setAttribute(){}});
 const document={createElement:el,addEventListener:(k,fn)=>events[k]=fn,removeEventListener:k=>delete events[k]},host=el('section'),group={shapes:[],addTo(){return this;},clearLayers(){this.shapes=[];}};
 const map={createPane:()=>({style:{}}),removeLayer(){this.removed=true;},on(){assert.fail('No map movement polling');},fitBounds(){assert.fail('Do not change the user viewport');}};
 const record={id:'area-synthetic',name:'Batas lahan horti',revision:1,collection:{type:'FeatureCollection',features:[{type:'Feature',properties:{},geometry:{type:'Polygon',coordinates:[[[102,.5],[102.001,.5],[102.001,.501],[102,.5]]]}}]}};
 const root={document,YG_AUTH:{readStoredSession:()=>session},addEventListener:(k,fn)=>events[k]=fn,removeEventListener:k=>delete events[k],L:{layerGroup:()=>group,geoJSON:(collection,style)=>{const shape={collection:structuredClone(collection),style,addTo(target){target.shapes.push(this);return this;}};drawn.push(shape);return shape;}},fetch:async(url,init)=>{requests.push({url,init});if(pause)await pause;return new Response(JSON.stringify(url.includes('?id=')?{record}:{items:[{id:record.id,name:record.name}],cursor:null}),{status});}};
 const context={window:root,document,Date:{now:()=>100000},AbortSignal,setTimeout:(fn,ms)=>(timers.push({fn,ms}),timers.length),clearTimeout(){}};
 vm.runInNewContext(fs.readFileSync('js/orthomosaic-area-store.js','utf8'),context);const mount=root.YG_ORTHO_AREA_STORE.mountOverlay;root.YG_ORTHO_AREA_STORE.mountOverlay=o=>{options=o;return mount(o);};
 vm.runInNewContext(fs.readFileSync('js/dayun-horti-boundary.js','utf8'),context);const control=root.YG_DAYUN_HORTI.mount({map,host});
 return{requests,events,timers,host,map,group,drawn,record,control,api:()=>options.api,session:s=>session=s,status:s=>status=s,pause:p=>pause=p};
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
test('anonymous and expired visitors load no private boundary or API requests',async()=>{
 for(const initial of [null,{token:'old-token',expiresAt:99999}]){const s=fixture(initial);await flush();assert.equal(s.requests.length,0);assert.equal(s.drawn.length,0);assert.equal(s.host.hidden,true);assert.equal(s.timers.length,0);s.control.dispose();}
});
test('staff Agro map uses the exact Orthomosaic renderer and current private geometry via GET only',async()=>{
 const s=fixture();await flush();assert.equal(s.requests.length,2);assert.equal(s.host.hidden,false);assert.deepEqual(s.group.shapes[0].collection,s.record.collection);assert.equal(s.group.shapes[0].style.style.color,'#a21caf');
 for(const r of s.requests){assert.match(r.url,/^https:\/\/webgis-api\.yayasangambut\.org\/api\/staff\/drone\/analysis\/areas/);assert.equal(r.init.method,'GET');assert.equal(r.init.headers.Authorization,'Bearer test-staff-token');assert.equal(r.init.cache,'no-store');assert.equal(r.init.credentials,'omit');assert.equal(r.init.redirect,'error');}
 await assert.rejects(s.api()('/api/staff/drone/analysis/areas',{method:'POST'}),/hanya dapat dibaca/);await assert.rejects(s.api()('/api/staff/drone/analysis/Agro_ABC/block-review'),/hanya dapat dibaca/);assert.equal(s.requests.length,2);s.control.dispose();
});
test('logout, session replacement and expiry remove private geometry without changing public map',async()=>{
 for(const action of ['logout','replace','expiry']){const s=fixture();await flush();assert.equal(s.drawn.length,1);if(action==='expiry')s.timers[0].fn();else{s.session(action==='logout'?null:{token:'new-token',expiresAt:200000});s.events.storage();}assert.equal(s.host.hidden,true);assert.equal(s.host.children.length,0);assert.equal(s.map.removed,true);assert.equal(s.requests.length,2);}
});
test('rejected credentials and late responses cannot display private geometry',async()=>{
 const denied=fixture();denied.status(401);await flush();assert.equal(denied.drawn.length,0);assert.equal(denied.host.hidden,true);
 const s=fixture();await flush();let resolve;s.pause(new Promise(r=>resolve=r));const updating=s.host.children[1].onclick();s.session(null);s.events.visibilitychange();resolve();await updating;assert.equal(s.host.hidden,true);assert.equal(s.drawn.length,1);assert.equal(s.host.children.length,0);
});
test('map loads shared renderer before bootstrap and keeps the same private host through legend changes',()=>{
 const html=fs.readFileSync('dayun-map.html','utf8'),code=fs.readFileSync('js/dayun-public.js','utf8');assert.ok(html.indexOf('js/auth.js')<html.indexOf('js/dayun-horti-boundary.js'));assert.ok(html.indexOf('js/orthomosaic-area-store.js')<html.indexOf('js/dayun-horti-boundary.js'));assert.ok(html.indexOf('js/dayun-horti-boundary.js')<html.indexOf('js/dayun-public.js'));assert.match(code,/if\(hortiHost\)legendEl.appendChild\(hortiHost\)/);
});
test('the offline worker never caches an authenticated horti response',async()=>{
 const handlers={},calls=[];let response;
 const context={self:{location:{origin:'https://webgisyg.id'},addEventListener:(name,fn)=>handlers[name]=fn},URL,Response,fetch:async(request,options)=>{calls.push({request,options});return Response.json({private:true});},caches:{open(){assert.fail('Private responses must never enter offline storage');},match(){assert.fail('No private cache fallback');}}};
 vm.runInNewContext(fs.readFileSync('service-worker.js','utf8'),context);
 const request=new Request('https://webgis-api.yayasangambut.org/api/staff/drone/analysis/areas',{headers:{Authorization:'Bearer test-staff-token'}});
 handlers.fetch({request,respondWith:p=>response=p});assert.deepEqual(await(await response).json(),{private:true});assert.equal(calls[0].options.cache,'no-store');assert.equal(calls[0].request,request);
});
