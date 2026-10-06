const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const context={window:{}};vm.runInNewContext(fs.readFileSync('js/meritech-export.js','utf8'),context);
const {plan,encode}=context.window.YG_MERITECH_EXPORT;
const bounds=(w,s,e,n)=>({getWest:()=>w,getSouth:()=>s,getEast:()=>e,getNorth:()=>n});
test('a known tile is covered at native size with north-up Web Mercator coordinates',()=>{
 const z=17,x=102023,y=65224,n=2**z;
 const lon=v=>v/n*360-180,lat=v=>Math.atan(Math.sinh(Math.PI*(1-2*v/n)))*180/Math.PI;
 const p=plan(bounds(lon(x+.001),lat(y+.999),lon(x+.999),lat(y+.001)),z);
 assert.equal(p.width,256);assert.equal(p.height,256);assert.equal(p.tiles.length,1);
 assert.equal(p.tiles[0].x,x);assert.equal(p.tiles[0].y,y);
 let metadata;encode(new Uint8Array(256*256*4),p,(pixels,m)=>{metadata=m},'2026-10-06T00:00:00Z');
 assert.equal(metadata.ProjectedCSTypeGeoKey,3857);assert.ok(metadata.ModelPixelScale[1]>0);
 assert.equal(metadata.ModelTiepoint[3],p.xmin);assert.equal(metadata.ModelTiepoint[4],p.ymax);
 assert.equal(JSON.parse(metadata.GeoAsciiParams.slice(0,-1)).acquisitionDate,null);
});
test('large exports and regions outside the allowed window fail early',()=>{
 assert.throws(()=>plan(bounds(100,0,104,2),19),/terlalu luas/);
 assert.throws(()=>plan(bounds(0,0,1,1),17),/wilayah Riau/);
});
