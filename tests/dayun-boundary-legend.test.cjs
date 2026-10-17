const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const summary=require('../js/dayun-agro-summary.js');
test('revised map legend derives geometry counts and areas without changing program or census records',()=>{
 const program=JSON.parse(fs.readFileSync('data/dayun-program.json','utf8')),
       map=JSON.parse(fs.readFileSync('data/dayun-map.geojson','utf8')),
       blocks=JSON.parse(fs.readFileSync('data/dayun-blocks.geojson','utf8'));
 const before=JSON.stringify(program),layer=program.layers.find(l=>l.id==='agroforestry'),result=summary.boundaryLegend(layer,map,blocks);
 assert.equal(JSON.stringify(program),before);assert.deepEqual(result.items.map(i=>i.featureCount),[86,75,16]);
 assert.equal(result.reportedTotalHa,blocks.totalAreaHa);assert.equal(result.boundaryReceivedDate,'2026-10-18');
 assert.notEqual(result.items[0].areaHa,layer.items[0].areaHa);
});
