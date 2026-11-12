const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),api=require('../js/planting-inventory.js');
const read=p=>JSON.parse(fs.readFileSync(require('path').join(__dirname,'..',p))),snapshot=read('data/master-database-snapshot.json'),objects=api.mergeFeatureCollections(snapshot,['area_mangrove.geojson','kopi.geojson','area_kopi.geojson'].map(p=>read('data/'+p))),attrs=read('data/village-activity-attributions.json').attributions,boundaries=read('data/desa_intervensi.geojson').features,rows=api.summarize(objects,attrs,boundaries);
test('shared map, donor and village counts reconcile every intervention village',()=>{
 for(const boundary of boundaries){const p=boundary.properties,n=p.WADMKD||p.Desa||p.NAMOBJ,d=p.WADMKC||p.Kecamatan,r=p.WADMKK||p.Kabupaten,selected=objects.filter(f=>api.activityMatchesPlace(f,n,d,r,boundary));const direct=api.plantInventory(selected,[],attrs),summary=api.aggregate(rows,row=>row.villages.some(v=>v.name===n));assert.deepEqual(summary,direct,n);}
 const donorTotals=[...new Set(rows.map(r=>r.donor))].map(d=>api.aggregate(rows,r=>r.donor===d));for(const category of ['mangrove','coffee','peat','forest'])assert.equal(donorTotals.reduce((n,t)=>n+t[category],0),api.aggregate(rows)[category]);
 assert.deepEqual(api.aggregate(rows),{mangrove:47225,coffee:14230,peat:0,forest:1200});
 assert.equal(api.aggregate(rows,r=>r.donor==='Aramco Asia Singapore').mangrove,45225);assert.equal(api.aggregate(rows,r=>r.donor==='Aliansi Kolibri').forest,1200);assert.equal(api.aggregate(rows,r=>r.donor==='Donor belum tercatat').coffee,10500);
 assert.equal(rows.filter(r=>r.villages.length===0).length,0);
});
test('all surfaces load the shared engine before consumers',()=>{
 for(const [html,consumer]of [['index.html','js/dashboard-v3.js'],['webgis.html','js/map-v4.js'],['village-profile.html','js/village-profile.js'],['donor-detail.html','js/donor-detail.js'],['aramco.html','js/aramco-dashboard.js']]){const s=fs.readFileSync(require('path').join(__dirname,'..',html),'utf8');assert.ok(s.indexOf('js/planting-inventory.js?')<s.indexOf(consumer+'?'),html);}
});
