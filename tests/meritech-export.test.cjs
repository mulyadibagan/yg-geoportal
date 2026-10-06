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

const helperContext={window:{}};
vm.runInNewContext(fs.readFileSync('js/meritech-village-export.js','utf8'),helperContext);
const helper=helperContext.window.YG_MERITECH_VILLAGE;
test('village export requests a 5 km outward buffer and splits into unique bounded tile parts',()=>{
 const geometry={type:'Polygon',coordinates:[[[102,1],[102.1,1],[102.1,1.1],[102,1.1],[102,1]]]};
 const feature={type:'Feature',geometry,properties:{WADMKD:'Test'}};
 let bufferArguments;
 const turf={buffer(f,d,o){bufferArguments=[f,d,o.units];return feature;},bboxPolygon(b){return b;},booleanIntersects(){return true;}};
 const result=helper.partsFor(feature,17,turf);
 assert.equal(bufferArguments[0],feature);assert.equal(bufferArguments[1],5);assert.equal(bufferArguments[2],'kilometers');
 assert.ok(result.parts.length>1);const seen=new Set();
 for(const p of result.parts){assert.ok(p.tiles.length<=64);assert.ok(p.width*p.height<=4194304);assert.equal(p.bufferKm,5);assert.equal(p.totalParts,result.parts.length);
  for(const tile of p.tiles){const key=tile.x+'/'+tile.y;assert.ok(!seen.has(key));seen.add(key);}
 }
 assert.equal(seen.size,result.totalTiles);
});
test('polygon mask preserves holes using even-odd alpha clipping and metadata records area provenance',()=>{
 let rule,operation;
 const ctx={save(){},restore(){},beginPath(){operation=this.globalCompositeOperation;},moveTo(){},lineTo(){},closePath(){},fill(v){rule=v;}};
 const p={zoom:17,left:0,top:0,width:1,height:1,resolution:1,xmin:0,ymax:0,tiles:[],bounds:[],clip:{type:'Polygon',coordinates:[[[102,1],[102.1,1],[102,1.1],[102,1]],[[102.01,1.01],[102.02,1.01],[102.01,1.02],[102.01,1.01]]]},village:'Test',bufferKm:5,clipBounds:[102,1,102.1,1.1],part:2,totalParts:3,missingTiles:1};
 helper.mask(ctx,p);assert.equal(rule,'evenodd');assert.equal(operation,'destination-in');
 let m;encode(new Uint8Array(4),p,(pixels,metadata)=>{m=metadata},'2026-10-06');
 const source=JSON.parse(m.GeoAsciiParams.slice(0,-1));assert.equal(source.bufferKm,5);assert.equal(source.part,2);assert.equal(source.totalParts,3);assert.equal(source.missingTiles,1);assert.deepEqual(source.clipBounds,p.clipBounds);assert.equal(source.maskApplied,true);
});
