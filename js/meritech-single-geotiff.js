(function(){
 'use strict';
 const BYTES=256*256*4, API='https://webgis-api.yayasangambut.org';
 function header(p){
  const cols=p.width/256,rows=p.height/256,n=cols*rows;
  const offsets=new BigUint64Array(n),counts=new BigUint64Array(n);counts.fill(BigInt(BYTES));
  const keys=new Uint16Array([1,1,0,3,1024,0,1,1,1025,0,1,1,3072,0,1,3857]);
  const entries=[[256,4,new Uint32Array([p.width])],[257,4,new Uint32Array([p.height])],[258,3,new Uint16Array([8,8,8,8])],[259,3,new Uint16Array([1])],[262,3,new Uint16Array([2])],[277,3,new Uint16Array([4])],[284,3,new Uint16Array([1])],[322,4,new Uint32Array([256])],[323,4,new Uint32Array([256])],[324,16,offsets],[325,16,counts],[338,3,new Uint16Array([2])],[33550,12,new Float64Array([p.resolution,p.resolution,0])],[33922,12,new Float64Array([0,0,0,p.xmin,p.ymax,0])],[34735,3,keys]];
  let length=16+8+entries.length*20+8;const align=x=>Math.ceil(x/8)*8;length=align(length);
  const external=entries.map(e=>{if(e[2].byteLength<=8)return null;const pos=length;length=align(length+e[2].byteLength);return pos;});
  const bytes=new Uint8Array(length),v=new DataView(bytes.buffer);bytes[0]=73;bytes[1]=73;v.setUint16(2,43,true);v.setUint16(4,8,true);v.setBigUint64(8,16n,true);v.setBigUint64(16,BigInt(entries.length),true);
  let offsetsPosition;
  entries.forEach(([tag,type,array],i)=>{const at=24+i*20;v.setUint16(at,tag,true);v.setUint16(at+2,type,true);v.setBigUint64(at+4,BigInt(array.length),true);const pos=external[i];if(pos===null)bytes.set(new Uint8Array(array.buffer),at+12);else{v.setBigUint64(at+12,BigInt(pos),true);bytes.set(new Uint8Array(array.buffer),pos);}if(tag===324)offsetsPosition=pos===null?at+12:pos;});
  offsets.fill(BigInt(length));bytes.set(new Uint8Array(offsets.buffer),offsetsPosition);
  return {bytes,offsets,offsetsPosition,cols,blankOffset:length};
 }
 async function download(p,token,valid,signal,status,handle){
  const h=header(p),memory=[],estimated=h.bytes.length+BYTES*(p.tiles.length+1);
  if(!handle&&estimated>128*1024*1024)throw Error('Unduhan besar memerlukan Chrome atau Edge desktop agar dapat ditulis langsung ke satu file.');
  const stream=handle?await handle.createWritable():null;let position=0,done=0,missing=0,received=0;
  async function write(data){if(stream)await stream.write({type:'write',position,data});else memory.push(data.slice());position+=data.byteLength;}
  const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const ctx=canvas.getContext('2d');if(!ctx)throw Error('Canvas tidak tersedia.');
  try{
   await write(h.bytes);await write(new Uint8Array(BYTES));
   for(const tile of p.tiles){
    if(signal.aborted||!valid())throw Error('Unduhan dibatalkan atau sesi staf berakhir.');
    const response=await fetch(`${API}/api/staff/meritech/tile/${p.zoom}/${tile.x}/${tile.y}`,{headers:{Authorization:`Bearer ${token}`},signal,cache:'no-store',credentials:'omit'});
    if(response.status===404){missing++;}else{
     if(!response.ok)throw Error(`Tile gagal (HTTP ${response.status}). Unduhan belum lengkap; silakan ulangi.`);
     const bitmap=await createImageBitmap(await response.blob());ctx.clearRect(0,0,256,256);
     try{if(bitmap.width!==256||bitmap.height!==256)throw Error('Ukuran tile tidak valid.');ctx.drawImage(bitmap,0,0);}finally{bitmap.close();}
     window.YG_MERITECH_VILLAGE.mask(ctx,{...p,left:tile.x*256,top:tile.y*256});
     const index=(tile.y-p.top/256)*h.cols+tile.x-p.left/256;
     h.offsets[index]=BigInt(position);await write(new Uint8Array(ctx.getImageData(0,0,256,256).data.buffer));received++;
    }
    status.textContent=`Menulis satu GeoTIFF: ${++done}/${p.tiles.length} tile${missing?' · '+missing+' tidak tersedia':''}…`;
   }
   if(!received)throw Error('Tidak ada citra tersedia pada area ini.');
   if(signal.aborted||!valid())throw Error('Unduhan dibatalkan atau sesi staf berakhir.');
   const offsetBytes=new Uint8Array(h.offsets.buffer);
   if(stream){await stream.write({type:'write',position:h.offsetsPosition,data:offsetBytes});await stream.close();}
   else{memory[0].set(offsetBytes,h.offsetsPosition);const url=URL.createObjectURL(new Blob(memory,{type:'image/tiff'}));const a=document.createElement('a');a.href=url;a.download=p.filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);}
   status.textContent=`Satu GeoTIFF selesai: seluruh desa + buffer 500 meter, ${p.width} × ${p.height} piksel, EPSG:3857. ${missing} tile tidak tersedia. Bagian di luar buffer transparan.`;
  }catch(e){if(stream)await stream.abort().catch(()=>{});throw e;}
 }
 window.YG_MERITECH_SINGLE={header,download};
})();
