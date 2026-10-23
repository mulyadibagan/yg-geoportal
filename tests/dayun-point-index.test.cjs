const test=require('node:test'),assert=require('node:assert/strict');
const {createPointIndex,effective,summarize}=require('../js/dayun-block-edit.js');
const point=(id,x,y,zones=['Z1'],status='candidate',origin='automated')=>({type:'Feature',geometry:{type:'Point',coordinates:[x,y]},properties:{id,zones,status,origin}});
const bounds=(w,s,e,n)=>({getWest:()=>w,getEast:()=>e,getSouth:()=>s,getNorth:()=>n});
test('incremental counts/progress equal the reference for edits, zone moves, manual removal and undo',()=>{
 const original=[point('a',1,1),point('b',2,2,['Z1','Z2']),point('c',3,3,[])],ids=['Z1','Z2'],index=createPointIndex(original,ids),changes=new Map();
 const check=()=>assert.deepEqual(index.counts(),summarize(effective(original,[...changes.values()]),original.length,ids,original));check();
 const steps=[point('a',1,1,['Z1'],'rejected'),point('manual',2,2,['Z2'],'accepted','manual_addition'),point('b',4,4,['Z2'],'accepted'),point('a',1,1,['Z1'],'accepted'),point('manual',2,2,[],'rejected','manual_addition')];
 for(const f of steps){changes.set(f.properties.id,f);index.patch(f.properties.id,f);check();}
 changes.delete('manual');index.patch('manual',null);check();changes.delete('a');index.patch('a',null);check();
 index.reconcile([...changes.values()].map(f=>structuredClone(f)));check();assert.equal(index.get('b').geometry.coordinates[0],4);
});
test('spatial queries include border points and update only moved/removed IDs without rebuilding other features',()=>{
 const index=createPointIndex([point('a',-.0001,0),point('b',0,0),point('c',.0001,.0001)],['Z1']),stable=index.get('a');
 assert.deepEqual(index.query(bounds(-.0001,0,.0001,.0001)).map(f=>f.properties.id).sort(),['a','b','c']);
 index.patch('b',point('b',1,1));index.patch('manual',point('manual',0,0,[],'accepted','manual_addition'));
 assert.equal(index.get('a'),stable);assert.deepEqual(index.query(bounds(-.00001,-.00001,.00001,.00001)).map(f=>f.properties.id),['manual']);
 index.patch('manual',null);assert.equal(index.query(bounds(-.00001,-.00001,.00001,.00001)).length,0);
});
test('unchanged remote snapshots retain feature identity and do not change the rendering revision',()=>{
 const original=[point('a',0,0)],index=createPointIndex(original,['Z1']),changes=[point('a',0,0,['Z1'],'accepted')];index.reconcile(changes);const a=index.get('a'),revision=index.revision;
 index.reconcile(structuredClone(changes));assert.equal(index.get('a'),a);assert.equal(index.revision,revision);
 index.reconcile([]);assert.equal(index.get('a').properties.status,'candidate');assert.equal(original[0].properties.status,'candidate');
});
test('a remote edit recalculates membership only for that point, preserving normalized raw identity',()=>{
 const original=[point('a',0,0),point('b',1,1)],index=createPointIndex(original,['Z1','Z2']);let checked=0;
 const normalize=f=>{checked++;return{...f,properties:{...f.properties,zones:['Z2']}};};
 const changes=[point('a',0,0,['Z1'],'accepted'),point('b',1,1,['Z1'],'accepted')];index.reconcile(changes,normalize);assert.equal(checked,2);
 const next=structuredClone(changes);next[0].geometry.coordinates=[2,2];index.reconcile(next,normalize);assert.equal(checked,3);
 assert.deepEqual(index.get('b').properties.zones,['Z2']);
});
test('opening builds the index once from the latest team snapshot without installing superseded originals',()=>{
 const original=[point('a',0,0),point('b',1,1)],changes=[point('a',2,2,['Z2'],'rejected'),point('manual',3,3,[],'accepted','manual_addition')],zones=['Z1','Z2'];
 const index=createPointIndex(original,zones,changes);assert.deepEqual(index.counts(),summarize(effective(original,changes),2,zones,original));assert.equal(index.get('a'),changes[0]);
 assert.equal(index.query(bounds(-.1,-.1,.1,.1)).length,0);
});
