(function(){
 'use strict';
 const BYTES=256*256*4, MEMORY_LIMIT=128*1024*1024, API='https://webgis-api.yayasangambut.org';
 function header(p){
  const cols=p.width/256,rows=p.height/256,n=cols*rows;
  const offsets=new BigUint64Array(n),counts=new BigUint64Array(n);counts.fill(BigInt(BYTES));
  const keys=new Uint16Array([1,1,0,3,1024,0,1,1,1025,0,1,1,3072,0,1,3857]);
  const description=new Uint8Array(4096);
  const entries=[[270,2,description],[256,4,new Uint32Array([p.width])],[257,4,new Uint32Array([p.height])],[258,3,new Uint16Array([8,8,8,8])],[259,3,new Uint16Array([1])],[262,3,new Uint16Array([2])],[277,3,new Uint16Array([4])],[284,3,new Uint16Array([1])],[322,4,new Uint32Array([256])],[323,4,new Uint32Array([256])],[324,16,offsets],[325,16,counts],[338,3,new Uint16Array([2])],[33550,12,new Float64Array([p.resolution,p.resolution,0])],[33922,12,new Float64Array([0,0,0,p.xmin,p.ymax,0])],[34735,3,keys]].sort((a,b)=>a[0]-b[0]);
  let length=16+8+entries.length*20+8;const align=x=>Math.ceil(x/8)*8;length=align(length);
  const external=entries.map(e=>{if(e[2].byteLength<=8)return null;const pos=length;length=align(length+e[2].byteLength);return pos;});
  const bytes=new Uint8Array(length),v=new DataView(bytes.buffer);bytes[0]=73;bytes[1]=73;v.setUint16(2,43,true);v.setUint16(4,8,true);v.setBigUint64(8,16n,true);v.setBigUint64(16,BigInt(entries.length),true);
  let offsetsPosition,descriptionPosition;
  entries.forEach(([tag,type,array],i)=>{const at=24+i*20;v.setUint16(at,tag,true);v.setUint16(at+2,type,true);v.setBigUint64(at+4,BigInt(array.length),true);const pos=external[i];if(pos===null)bytes.set(new Uint8Array(array.buffer),at+12);else{v.setBigUint64(at+12,BigInt(pos),true);bytes.set(new Uint8Array(array.buffer),pos);}if(tag===324)offsetsPosition=pos===null?at+12:pos;if(tag===270)descriptionPosition=pos;});
  offsets.fill(BigInt(length));bytes.set(new Uint8Array(offsets.buffer),offsetsPosition);
  return {bytes,offsets,offsetsPosition,descriptionPosition,cols,blankOffset:length};
 }
 function describe(p,stats){
  const text=JSON.stringify({product:'Mosaik JPG Meritech',source:'https://petadasar.meritech.cloud/tile/{z}/{x}/{y}.jpg',village:p.village,bufferMeters:500,zoom:p.zoom,crs:'EPSG:3857',clipBounds:p.clipBounds,requestedTiles:p.tiles.length,...stats,acquisitionDate:null,note:'Di luar buffer dan tile tidak tersedia/gagal dibuat transparan. Tanggal unduh bukan tanggal perekaman.'});
  const result=new Uint8Array(4096),encoded=new TextEncoder().encode(text);if(encoded.length>=result.length)throw Error('Catatan sumber terlalu panjang.');result.set(encoded);return result;
 }
 async function requestTile(tile,p,token,valid,signal){
  for(let attempt=0;attempt<3;attempt++){
   if(signal.aborted||!valid())throw Error('Unduhan dibatalkan atau sesi staf berakhir.');
   const request=new AbortController(),abort=()=>request.abort();signal.addEventListener('abort',abort,{once:true});
   const timer=setTimeout(abort,60000);
   try{
    const response=await fetch(`${API}/api/staff/meritech/tile/${p.zoom}/${tile.x}/${tile.y}`,{headers:{Authorization:`Bearer ${token}`},signal:request.signal,cache:'no-store',credentials:'omit'});
    if(response.status===401||response.status===403){const error=Error('Sesi atau akses staf tidak valid. Masuk kembali.');error.fatal=true;throw error;}
    if(response.status===404)return {missing:true};
    if(!response.ok){await response.body?.cancel();throw Error(`HTTP ${response.status}`);}
    const bitmap=await createImageBitmap(await response.blob());
    if(bitmap.width!==256||bitmap.height!==256){bitmap.close();throw Error('Ukuran tile tidak valid.');}
    return {bitmap};
   }catch(error){
    if(error.fatal||signal.aborted||!valid())throw error;
    if(attempt===2)return {failed:true};
   }finally{clearTimeout(timer);signal.removeEventListener('abort',abort);}
   await new Promise(resolve=>setTimeout(resolve,250*(attempt+1)));
  }
 }
 async function download(p,token,valid,signal,status,handle){
  const h=header(p),memory=[],estimated=h.bytes.length+BYTES*(p.tiles.length+1);
  let staging=null,stream=null,position=0,queue=Promise.resolve(),done=0,missing=0,failed=0,received=0,next=0;
  const control=new AbortController(),abort=()=>control.abort();signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort();
  const retrievedAt=new Date().toISOString();
  async function write(data){
   const at=position;position+=data.byteLength;
   if(stream){const pending=queue.then(()=>stream.write({type:'write',position:at,data}));queue=pending.catch(()=>{});await pending;}
   else memory.push(data.slice());
   return at;
  }
  async function patch(at,data){if(stream)await stream.write({type:'write',position:at,data});else memory[0].set(data,at);}
  const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const ctx=canvas.getContext('2d');if(!ctx)throw Error('Canvas tidak tersedia.');
  try{
   if(handle)stream=await handle.createWritable();
   else if(estimated>MEMORY_LIMIT){
    if(!navigator.storage?.getDirectory)throw Error('Perangkat ini belum mendukung unduhan desa berukuran besar. Gunakan Chrome/Edge desktop atau pilih zoom 17.');
    const quota=await navigator.storage.estimate?.();if(quota?.quota&&quota.quota-quota.usage<estimated)throw Error('Ruang penyimpanan browser tidak cukup. Pilih zoom 17 atau simpan langsung melalui Chrome/Edge desktop.');
    const root=await navigator.storage.getDirectory(),directory=await root.getDirectoryHandle('yg-meritech-exports',{create:true}),name=`meritech-${Date.now()}-${Math.random().toString(36).slice(2)}.tif`;
    const file=await directory.getFileHandle(name,{create:true});staging={directory,name,file};stream=await file.createWritable();
   }
   h.bytes.set(describe(p,{retrievedAt,state:'processing'}),h.descriptionPosition);
   await write(h.bytes);await write(new Uint8Array(BYTES));
   async function worker(){
    while(next<p.tiles.length){
     const tile=p.tiles[next++];
     if(control.signal.aborted||!valid())throw Error('Unduhan dibatalkan atau sesi staf berakhir.');
     const result=await requestTile(tile,p,token,valid,control.signal);
     if(result.missing)missing++;
     else if(result.failed)failed++;
     else{
      const bitmap=result.bitmap;
      try{
       if(control.signal.aborted||!valid())throw Error('Unduhan dibatalkan atau sesi staf berakhir.');
       ctx.clearRect(0,0,256,256);ctx.drawImage(bitmap,0,0);
       window.YG_MERITECH_VILLAGE.mask(ctx,{...p,left:tile.x*256,top:tile.y*256});
       const pixels=new Uint8Array(ctx.getImageData(0,0,256,256).data.buffer);
       const index=(tile.y-p.top/256)*h.cols+tile.x-p.left/256;
       if(!Number.isInteger(index)||index<0||index>=h.offsets.length)throw Error('Indeks tile di luar area unduhan.');
       h.offsets[index]=BigInt(position);await write(pixels);received++;
      }finally{bitmap.close();}
     }
     status.textContent=`Menulis satu GeoTIFF: ${++done}/${p.tiles.length} tile · ${missing} tidak tersedia · ${failed} gagal setelah dicoba ulang…`;
    }
   }
   const results=await Promise.allSettled(Array.from({length:Math.min(4,p.tiles.length)},()=>worker().catch(error=>{control.abort();throw error;})));
   const failure=results.find(r=>r.status==='rejected');if(failure)throw failure.reason;
   if(!received)throw Error('Tidak ada citra yang berhasil diambil pada area ini. Berkas kosong tidak disimpan.');
   if(control.signal.aborted||!valid())throw Error('Unduhan dibatalkan atau sesi staf berakhir.');
   await queue;
   await patch(h.offsetsPosition,new Uint8Array(h.offsets.buffer));
   await patch(h.descriptionPosition,describe(p,{retrievedAt,state:failed?'partial':'finished',receivedTiles:received,missingTiles:missing,failedTiles:failed}));
   if(stream)await stream.close();
   if(!handle){
    const blob=staging?await staging.file.getFile():new Blob(memory,{type:'image/tiff'});
    const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=p.filename;document.body.appendChild(a);a.click();a.remove();
    const temporary=staging;setTimeout(()=>{URL.revokeObjectURL(url);temporary?.directory.removeEntry(temporary.name).catch(()=>{});},600000);
   }
   status.textContent=`Satu GeoTIFF selesai: seluruh desa + buffer 500 meter, ${p.width} × ${p.height} piksel, EPSG:3857. ${received} tile berhasil, ${missing} tidak tersedia, ${failed} gagal setelah dicoba ulang.${failed?' Citra belum lengkap; area gagal transparan dan tercatat dalam metadata.':''} Bagian di luar buffer transparan.`;
   return {received,missing,failed,bytes:position};
  }catch(error){control.abort();await queue;if(stream)await stream.abort().catch(()=>{});if(staging)await staging.directory.removeEntry(staging.name).catch(()=>{});throw error;}
  finally{signal.removeEventListener('abort',abort);}
 }
 window.YG_MERITECH_SINGLE={header,download};
})();
