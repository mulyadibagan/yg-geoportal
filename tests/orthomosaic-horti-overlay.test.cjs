const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function setup({active=true,paginated=false,withCounts=false}={}){
 let snapshot={block:'B',ready:true,dirty:false,features:[{properties:{status:'accepted'}},{properties:{status:'candidate'}}]};const events={};
 const requests=[],shapes=[],layer={shapes:[],addTo(){return this;},clearLayers(){this.shapes=[];}};
 const el=tag=>({tag,textContent:'',children:[],append(...n){this.children.push(...n)},prepend(n){this.children.unshift(n)},replaceChildren(...n){this.children=n},setAttribute(){}});
 const host=el('section'),pane={style:{}},map={createPane:()=>pane,removeLayer(){},fitBounds(){throw Error('Loading a boundary must not move the working map');},on(name,fn){if(!withCounts)throw Error('No zoom/pan polling');events[name]=fn;},off(name){delete events[name];}};
 const record={name:'Batas lahan horti',collection:{type:'FeatureCollection',features:[{type:'Feature',properties:{name:'Horti'},geometry:{type:'Polygon',coordinates:[[[102,.5],[102.001,.5],[102.001,.501],[102,.5]]]}}]}};
 let failure=false,hold=null;
 const api=async(url,options)=>{requests.push({url,options});if(hold)await hold;if(failure)throw Error('offline');return{json:async()=>url.includes('?id=')?{record}:url.includes('?cursor=')?{items:[{name:record.name,id:'area-horti'}],cursor:null}:{items:paginated?[{name:'Batas lain',id:'area-other'}]:[{name:record.name,id:'area-horti'}],cursor:paginated?'next-page':null}};};
 const context={window:{YG_DAYUN_NEW_PLANTING:{countPoints:(polys,points)=>({total:points.filter(f=>f.properties.status!=='rejected').length})},L:{layerGroup:()=>layer,geoJSON:(collection,options)=>{const shape={collection:structuredClone(collection),options,addTo(target){target.shapes.push(this);return this;}};shapes.push(shape);return shape;}}},document:{createElement:el}};
 vm.runInNewContext(fs.readFileSync('js/orthomosaic-area-store.js','utf8'),context);
 const control=context.window.YG_ORTHO_AREA_STORE.mountOverlay({host,map,api,current:()=>active,...(withCounts?{getSnapshot:()=>snapshot}:{})});
 return{control,requests,shapes,layer,host,pane,record,events,setSnapshot:s=>snapshot=s,stop:()=>active=false,fail:()=>failure=true,hold:p=>hold=p};
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
test('saved horti renders automatically as a nonblocking private boundary without writes, measurement edits or map movement',async()=>{
 const s=setup();await flush();assert.equal(s.requests.length,2);assert.ok(s.requests.every(r=>r.options===undefined&&r.url.startsWith('/api/staff/drone/analysis/areas')));
 assert.equal(s.layer.shapes.length,1);assert.deepEqual(s.layer.shapes[0].collection,s.record.collection);assert.equal(s.shapes[0].options.interactive,false);assert.equal(s.shapes[0].options.style.fill,false);assert.equal(s.pane.style.pointerEvents,'none');
 const toggle=s.host.children[0].children[0];toggle.checked=false;toggle.onchange();toggle.checked=true;toggle.onchange();assert.equal(s.requests.length,2);s.control.dispose();
});
test('paginated discovery only opens horti documents; a failed refresh retains the last visible boundary',async()=>{
 const s=setup({paginated:true});await flush();assert.equal(s.requests.length,3);assert.ok(!s.requests.some(r=>r.url.includes('id=area-other')));const shape=s.layer.shapes[0];s.fail();await s.control.refresh();assert.equal(s.layer.shapes[0],shape);assert.match(s.host.children[2].textContent,/belum diperbarui/);s.control.dispose();
});
test('expired sessions and late responses never reveal a private boundary',async()=>{
 const closed=setup({active:false});await flush();assert.equal(closed.requests.length,0);assert.equal(closed.shapes.length,0);closed.control.dispose();
 const s=setup();await flush();let resolve;s.hold(new Promise(r=>resolve=r));const pending=s.control.refresh();s.stop();s.control.dispose();resolve();await pending;assert.equal(s.host.children.length,0);assert.equal(s.shapes.length,1);
});

test('new planting counts refresh from the live point snapshot without refetching boundaries or polling on pan',async()=>{const s=setup({withCounts:true});await flush();const text=n=>[n.textContent,...(n.children||[]).map(text)].join(' '),reads=s.requests.length;assert.match(text(s.host),/2 titik/);s.setSnapshot({block:'B',ready:true,dirty:false,features:[{properties:{status:'accepted'}}]});s.events['dayun:plantschanged']();assert.match(text(s.host),/1 titik/);assert.equal(s.requests.length,reads);s.setSnapshot({block:'B',ready:true,dirty:true});s.events['dayun:plantschanged']();assert.match(text(s.host),/Menunggu koreksi tersimpan/);assert.deepEqual(Object.keys(s.events),['dayun:plantschanged']);s.control.dispose();assert.equal(Object.keys(s.events).length,0);});
