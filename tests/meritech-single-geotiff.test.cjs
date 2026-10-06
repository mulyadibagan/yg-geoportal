const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync('js/meritech-single-geotiff.js','utf8');
function harness({statuses={},opfs=false,delay=0}={}){
 const writes=[],requests=[],state={closed:false,aborted:false,saved:false,maxConcurrent:0},blobPixels=new Uint8Array(256*256*4);blobPixels.fill(123);
 let concurrent=0;
 const stream={async write(record){writes.push({position:record.position,data:new Uint8Array(record.data)});await new Promise(r=>setImmediate(r))},async close(){state.closed=true},async abort(){state.aborted=true}};
 const handle={createWritable:async()=>stream,getFile:async()=>new Blob(['file'])};
 const directory={getFileHandle:async()=>handle,removeEntry:async()=>{}};
 const ctx={clearRect(){},drawImage(){},getImageData:()=>({data:blobPixels})};
 const context={window:{YG_MERITECH_VILLAGE:{mask(){}}},document:{body:{appendChild(){}},createElement(tag){return tag==='canvas'?{getContext:()=>ctx}:{click(){state.saved=true},remove(){}}}},navigator:opfs?{storage:{estimate:async()=>({quota:1e10,usage:0}),getDirectory:async()=>({getDirectoryHandle:async()=>directory})}}:{},TextEncoder,Blob,AbortController,URL:{createObjectURL:()=> 'blob:test',revokeObjectURL(){}},setTimeout:(fn,ms)=>setTimeout(fn,ms===600000?0:ms===60000?60000:0),clearTimeout,fetch:async(url,options)=>{
  requests.push(url);state.maxConcurrent=Math.max(state.maxConcurrent,++concurrent);
  await new Promise(r=>setTimeout(r,delay));concurrent--;
  if(options.signal.aborted)throw Error('aborted');
  const coords=url.split('/').slice(-2).join('/'),values=statuses[coords]||[200];const status=values.length>1?values.shift():values[0];
  return {status,ok:status===200,blob:async()=>new Blob(['tile']),body:{cancel:async()=>{}}};
 },createImageBitmap:async()=>({width:256,height:256,close(){}})};
 vm.runInNewContext(source,context);const api=context.window.YG_MERITECH_SINGLE;
 const p={width:512,height:512,left:102023*256,top:65224*256,zoom:17,resolution:1,xmin:10,ymax:20,village:'Test',bufferKm:.5,clipBounds:[100,0,101,1],filename:'test.tif',tiles:[{x:102023,y:65224},{x:102024,y:65224},{x:102023,y:65225},{x:102024,y:65225}]};
 function bytes(){let length=0;for(const w of writes)length=Math.max(length,w.position+w.data.length);const result=new Uint8Array(length);for(const w of writes)result.set(w.data,w.position);return result;}
 return {api,p,state,writes,requests,bytes,handle};
}
function entries(bytes){const v=new DataView(bytes.buffer),count=Number(v.getBigUint64(16,true)),tags=new Map();for(let i=0;i<count;i++){const at=24+i*20;tags.set(v.getUint16(at,true),{type:v.getUint16(at+2,true),count:Number(v.getBigUint64(at+4,true)),position:Number(v.getBigUint64(at+12,true))})}return tags;}
test('parallel tile writes reserve unique offsets and retry transient errors',async()=>{
 const h=harness({statuses:{'102023/65224':[503,200],'102024/65225':[404]},delay:2}),status={};
 const result=await h.api.download(h.p,'test',()=>true,new AbortController().signal,status,h.handle);
 assert.equal(result.received,3);assert.equal(result.missing,1);assert.equal(result.failed,0);assert.equal(h.requests.length,5);assert.ok(h.state.maxConcurrent>1);assert.ok(h.state.maxConcurrent<=4);assert.equal(h.state.closed,true);
 const b=h.bytes(),tags=entries(b),offset=tags.get(324).position,view=new DataView(b.buffer),addresses=[];
 for(let i=0;i<4;i++)addresses.push(Number(view.getBigUint64(offset+i*8,true)));
 assert.equal(new Set(addresses.slice(0,3)).size,3);assert.equal(b[addresses[3]],0);for(const a of addresses.slice(0,3))assert.equal(b[a],123);
 const metadata=JSON.parse(new TextDecoder().decode(b.slice(tags.get(270).position,tags.get(270).position+4096)).split('\0')[0]);assert.equal(metadata.receivedTiles,3);assert.equal(metadata.bufferMeters,500);
});
test('exhausted retries preserve available imagery and explicitly mark partial coverage',async()=>{
 const h=harness({statuses:{'102023/65224':[502]}}),status={};const result=await h.api.download(h.p,'test',()=>true,new AbortController().signal,status,h.handle);
 assert.equal(result.failed,1);assert.equal(result.received,3);assert.match(status.textContent,/Citra belum lengkap/);assert.equal(h.state.closed,true);
});
test('staff rejection and cancellation abort the file rather than reporting success',async()=>{
 const h=harness({statuses:{'102023/65224':[401]}});await assert.rejects(h.api.download(h.p,'test',()=>true,new AbortController().signal,{},h.handle));assert.equal(h.state.aborted,true);assert.equal(h.state.closed,false);
 const c=harness();const signal=new AbortController();signal.abort();await assert.rejects(c.api.download(c.p,'test',()=>true,signal.signal,{},c.handle));assert.equal(c.state.closed,false);
});
test('large exports without a desktop picker stream through browser storage instead of the 128 MB memory cap',async()=>{
 const h=harness({opfs:true});h.p.width=600*256;h.p.height=256;h.p.tiles=Array.from({length:600},(_,i)=>({x:102023+i,y:65224}));
 const result=await h.api.download(h.p,'test',()=>true,new AbortController().signal,{},null);
 assert.equal(result.received,600);assert.equal(h.state.closed,true);assert.equal(h.state.saved,true);
});
