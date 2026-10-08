const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const core=require('../js/drone-mission-core.js');
const source=fs.readFileSync('js/drone-mission-ui.js','utf8');
function harness(){
 const status={textContent:''},buttons=[{disabled:false}],links=[],blobs=[],timers=[];
 const document={getElementById:()=>status,querySelectorAll:()=>buttons,body:{appendChild(link){link.attached=true}},createElement:()=>{const link={click(){assert.equal(this.attached,true);this.clicked=true},remove(){this.removed=true}};links.push(link);return link}};
 const ctx={document,window:{YGDroneMission:core},Blob,URL:{createObjectURL(blob){blobs.push(blob);return 'blob:test'},revokeObjectURL(){}},setTimeout(fn,delay){timers.push({fn,delay})},clearTimeout(){}};
 vm.createContext(ctx);vm.runInContext(source.replace('window.YGDronePlanner={attach,generate,invalidate,jobMetadata};','window.YGDronePlanner={attach,generate,invalidate,jobMetadata,download};'),ctx);
 return {...ctx,status,buttons,links,blobs,timers,planner:ctx.window.YGDronePlanner};
}
function mission(){const m=core.generate({type:'Polygon',coordinates:[[[101,.7],[101.001,.7],[101.001,.701],[101,.701],[101,.7]]]});return Object.assign(m,{id:'DRN-test',area:'Dayun / Blok A'});}
for(const format of ['kml','csv','geojson'])test(`downloads ${format} with complete route coordinates and area filename`,async()=>{
 const h=harness(),m=mission();h.planner.download(m,format);
 assert.equal(h.links[0].download,'Dayun-Blok-A-DRN-test.'+format);assert.ok(h.links[0].clicked&&h.links[0].removed);assert.match(h.status.textContent,/Unduhan dimulai/);assert.ok(h.timers[0].delay>=1000);
 const text=await h.blobs[0].text();
 if(format==='kml'){assert.equal((text.match(/<Placemark>/g)||[]).length,m.sorties.length);assert.ok(text.includes(m.sorties[0].coordinates[0].concat(m.options.altitude).join(',')));assert.match(text,/NOT verified/);}
 if(format==='csv')assert.equal(text.split('\r\n').length,m.sorties.reduce((sum,s)=>sum+s.coordinates.length,0)+1);
 if(format==='geojson')assert.equal(JSON.parse(text).features.filter(f=>f.properties.kind==='route').length,m.sorties.length);
});
test('incomplete saved plan cannot download an empty route',()=>{const h=harness();h.planner.download({id:'old'},'kml');assert.equal(h.links.length,0);assert.match(h.status.textContent,/Buka rencana/);});
test('failed regeneration disables previously enabled downloads',()=>{const h=harness();h.planner.generate({preview:true});assert.ok(h.buttons.every(b=>b.disabled));assert.match(h.status.textContent,/Komponen geometri/);});
