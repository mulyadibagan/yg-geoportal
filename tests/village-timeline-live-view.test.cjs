const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
test('live refresh preserves filters, avoids duplicate event handlers and defers photo dialog replacement',()=>{
 class Element{
  constructor(){this.value='';this.innerHTML='';this.events={};this.hidden=false;this.open=false;}
  addEventListener(name,fn){(this.events[name]??=[]).push(fn);}
  get options(){return [...this.innerHTML.matchAll(/<option(?: value="([^"]*)")?>([^<]*)<\/option>/g)].map(m=>({value:m[1]===undefined?m[2]:m[1]}));}
  removeAttribute(){}
 }
 const nodes={};for(const id of ['village-timeline','timeline-year','timeline-donor','timeline-list','timeline-count','timeline-more','timeline-context','timeline-photo-dialog','timeline-photo-close','timeline-photo-image'])nodes[id]=new Element();
 const context={window:{},document:{getElementById:id=>nodes[id]}};vm.createContext(context);
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/village-activity-timeline.js'),'utf8'),context);
 const mount=context.window.VillageActivityTimeline.mount;
 const row=(id,copy)=>({properties:{reportId:id,title:id,activityDate:'2026-11-09',Donor:'Aramco',description:copy}});
 mount([row('A','original')],[],{name:'Sepahat',regency:'Bengkalis'});
 nodes['timeline-donor'].value='Aramco Asia Singapore';nodes['timeline-year'].value='2026';
 mount([row('A','updated'),row('B','new verified report')],[]);
 assert.equal(nodes['timeline-donor'].value,'Aramco Asia Singapore');assert.equal(nodes['timeline-year'].value,'2026');
 assert.match(nodes['timeline-list'].innerHTML,/updated/);assert.match(nodes['timeline-list'].innerHTML,/new verified report/);
 assert.equal(nodes['timeline-more'].events.click.length,1);assert.equal(nodes['timeline-year'].events.change.length,1);
 nodes['timeline-photo-dialog'].open=true;mount([row('A','deferred update')],[]);
 assert.doesNotMatch(nodes['timeline-list'].innerHTML,/deferred update/);
 nodes['timeline-photo-dialog'].open=false;nodes['timeline-photo-dialog'].events.close[0]();
 assert.match(nodes['timeline-list'].innerHTML,/deferred update/);assert.doesNotMatch(nodes['timeline-list'].innerHTML,/new verified report/);
});
