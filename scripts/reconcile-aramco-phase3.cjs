const fs=require('node:fs'),path=require('node:path'),root=path.resolve(__dirname,'..');
const api=require('../js/aramco-phase3-reconciliation.js'),data=require('../data/aramco-phase3-final.json');
if(process.argv.includes('--stdin')){let text='';process.stdin.on('data',c=>text+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(api.applyObjects(JSON.parse(text),data))));}
else{
 const read=f=>JSON.parse(fs.readFileSync(path.join(root,f),'utf8')),write=(f,d)=>fs.writeFileSync(path.join(root,f),JSON.stringify(d,null,2)+'\n');
 write('data/donors.json',api.reconcileDonors(read('data/donors.json'),data));
 const mangrove=read('data/area_mangrove.geojson'),updated=api.applyObjects(mangrove,data);updated.features=updated.features.filter(f=>f.properties.Object_ID!==data.activity.id);delete updated.featureCount;fs.writeFileSync(path.join(root,'data/area_mangrove.geojson'),JSON.stringify(updated)+'\n');
 for(const file of ['data/master-database-snapshot.json','data/dashboard-summary-snapshot.json']){const old=read(file),out=api.applyObjects(old,data);if(file.includes('dashboard'))out.features=out.features.map(f=>({type:'Feature',properties:f.properties}));fs.writeFileSync(path.join(root,file),JSON.stringify(out)+'\n');}
 console.log(JSON.stringify({phase3:api.totals(data),overall:api.cumulative(read('data/donors.json').find(d=>d.id==='DNR-ARAMCO'))}));
}
