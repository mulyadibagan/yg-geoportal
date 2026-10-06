(function () {
  'use strict';
  const API = 'https://webgis-api.yayasangambut.org';
  const TILE = 256, WORLD = 40075016.68557849;
  function plan(bounds, zoom) {
    if (![17,18,19].includes(zoom)) throw Error('Pilih zoom unduhan 17–19.');
    const west=bounds.getWest(), east=bounds.getEast(), south=bounds.getSouth(), north=bounds.getNorth();
    if (![west,east,south,north].every(Number.isFinite) || west>=east || south>=north || west<99.5 || east>104.5 || south< -1.5 || north>3.5) throw Error('Pilih wilayah Riau pada peta.');
    const size=TILE*2**zoom;
    const px=lon=>(lon+180)/360*size;
    const py=lat=>(1-Math.asinh(Math.tan(lat*Math.PI/180))/Math.PI)/2*size;
    const left=Math.floor(px(west)), top=Math.floor(py(north)), right=Math.ceil(px(east)), bottom=Math.ceil(py(south));
    const width=right-left, height=bottom-top, tiles=[];
    for(let y=Math.floor(top/TILE);y<=Math.floor((bottom-1)/TILE);y++) for(let x=Math.floor(left/TILE);x<=Math.floor((right-1)/TILE);x++) {
      if(tiles.length>=64) throw Error('Area terlalu luas: maksimal 64 tile. Perbesar peta atau pilih zoom unduhan lebih rendah.');
      tiles.push({x,y});
    }
    if(width>4096 || height>4096 || width*height>4194304) throw Error('Area terlalu besar. Perbesar peta untuk memperkecil area unduhan.');
    const resolution=WORLD/size;
    return {zoom,left,top,width,height,tiles,resolution,xmin:left*resolution-WORLD/2,ymax:WORLD/2-top*resolution,bounds:[west,south,east,north]};
  }
  function encode(pixels, p, writer, retrievedAt) {
    const citation=JSON.stringify({source:'https://petadasar.meritech.cloud/tile/{z}/{x}/{y}.jpg',product:'Mosaik tile JPG Meritech',retrievedAt,acquisitionDate:null,zoom:p.zoom,tileCount:p.tiles.length,requestedBounds:p.bounds,village:p.village||null,bufferKm:p.bufferKm||0,clipGeometry:p.clip||null,part:p.part||1,totalParts:p.totalParts||1,missingTiles:p.missingTiles||0,crs:'EPSG:3857',note:'Bukan GeoTIFF asli. Tanggal perekaman, cakupan dan resolusi sumber belum terverifikasi. Bagian kosong dari sumber tetap dipertahankan.'})+'|';
    return writer(pixels, {width:p.width,height:p.height,PhotometricInterpretation:2,SamplesPerPixel:4,BitsPerSample:[8,8,8,8],ExtraSamples:[2],ProjectedCSTypeGeoKey:3857,GTModelTypeGeoKey:1,GTRasterTypeGeoKey:1,ModelPixelScale:[p.resolution,p.resolution,0],ModelTiepoint:[0,0,0,p.xmin,p.ymax,0],GeoAsciiParams:citation,GeoKeyDirectory:[1,1,0,4,1024,0,1,1,1025,0,1,1,3072,0,1,3857,3073,34737,citation.length,0]});
  }
  function mount(container, map, readSession) {
    if(!container) return;
    const box=document.createElement('div'); box.className='meritech-info meritech-export';
    box.innerHTML='<hr><strong>Unduh citra Meritech</strong><label>Area unduhan <select data-export-mode><option value="viewport">Tampilan peta</option><option value="village">Batas desa + buffer 5 km</option></select></label><div data-export-village-controls hidden><label>Cari desa/kecamatan/kabupaten <input type="search" data-export-village-search placeholder="Nama desa"></label><label>Desa <select data-export-village><option value="">Pilih desa</option></select></label><label>Bagian unduhan <select data-export-part></select></label><p class="note">Unduh per bagian, lalu gabungkan di QGIS bila diperlukan. Piksel di luar batas desa + buffer 5 km dibuat transparan.</p></div><label>Zoom unduhan <select data-export-zoom><option value="17">17 · area lebih luas</option><option value="18">18 · lebih detail</option><option value="19">19 · paling detail tersedia</option></select></label><div class="meritech-actions actions"><button type="button" data-export-start>Unduh GeoTIFF area ini</button><button type="button" data-export-cancel hidden>Batalkan</button></div><p data-export-status class="note meritech-status" role="status">Mosaik JPG berkoordinat EPSG:3857, maksimal 64 tile. Bukan GeoTIFF asli; tanggal perekaman belum diketahui.</p>';
    container.appendChild(box);
    const zoom=box.querySelector('[data-export-zoom]'), start=box.querySelector('[data-export-start]'), cancel=box.querySelector('[data-export-cancel]'), status=box.querySelector('[data-export-status]');
    const village=window.YG_MERITECH_VILLAGE?.mount(box,()=>typeof map==='function'?map():map,readSession);
    let controller=null;
    cancel.onclick=()=>controller?.abort();
    start.onclick=async()=>{
      let expiryTimer, deadline;
      const current=readSession();
      const valid=()=>{const s=readSession();return s?.token && s.token===current?.token && (!s.expiresAt || Number(s.expiresAt)>Date.now());};
      try {
        if(!valid()) throw Error('Masuk sebagai staf untuk mengunduh.');
        if(!window.GeoTIFF?.writeArrayBuffer) throw Error('Pustaka GeoTIFF belum termuat. Muat ulang halaman.');
        const activeMap=typeof map==='function' ? map() : map;
        if(!activeMap) throw Error('Peta belum siap. Tunggu lalu coba kembali.');
        const p=village?.getPlan()||plan(activeMap.getBounds(),Number(zoom.value));
        p.missingTiles=0;
        controller=new AbortController(); const signal=controller.signal;
        start.disabled=true; zoom.disabled=true; village?.busy(true); cancel.hidden=false;
        expiryTimer=setInterval(()=>{if(!valid())controller?.abort();},1000);
        deadline=setTimeout(()=>controller?.abort(),180000);
        const canvas=document.createElement('canvas'); canvas.width=p.width; canvas.height=p.height;
        const ctx=canvas.getContext('2d'); if(!ctx) throw Error('Perangkat tidak mendukung ekspor citra.');
        let next=0, done=0, received=0;
        status.textContent=`Mengunduh 0/${p.tiles.length} tile…`;
        async function worker() {
          while(next<p.tiles.length) {
            if(signal.aborted || !valid()) throw Error('Unduhan dibatalkan atau sesi staf berakhir.');
            const tile=p.tiles[next++];
            const response=await fetch(`${API}/api/staff/meritech/tile/${p.zoom}/${tile.x}/${tile.y}`, {headers:{Authorization:`Bearer ${current.token}`},signal,cache:'no-store',credentials:'omit'});
            if(response.status===401 || response.status===403) throw Error('Sesi atau akses staf tidak valid. Masuk kembali.');
            if(response.status===404){p.missingTiles++;status.textContent=`Mengunduh ${++done}/${p.tiles.length} tile · ${p.missingTiles} tidak tersedia…`;continue;}
            if(!response.ok) throw Error(`Tile gagal diunduh (HTTP ${response.status}). Coba area lebih kecil atau ulangi nanti.`);
            const bitmap=await createImageBitmap(await response.blob());
            try { if(bitmap.width!==TILE || bitmap.height!==TILE) throw Error('Ukuran tile sumber tidak sesuai.'); ctx.drawImage(bitmap,tile.x*TILE-p.left,tile.y*TILE-p.top);received++; } finally {bitmap.close();}
            status.textContent=`Mengunduh ${++done}/${p.tiles.length} tile…`;
          }
        }
        const results=await Promise.allSettled([worker().catch(e=>{controller.abort();throw e;}),worker().catch(e=>{controller.abort();throw e;})]);
        const failure=results.find(r=>r.status==='rejected'); if(failure) throw failure.reason;
        if(!valid() || signal.aborted) throw Error('Unduhan dibatalkan atau sesi staf berakhir.');
        if(!received)throw Error('Tidak ada tile tersedia pada bagian ini. Pilih bagian lain.');
        window.YG_MERITECH_VILLAGE?.mask(ctx,p);
        status.textContent='Menyusun GeoTIFF…';
        const retrievedAt=new Date().toISOString();
        const buffer=encode(ctx.getImageData(0,0,p.width,p.height).data,p,GeoTIFF.writeArrayBuffer,retrievedAt);
        const url=URL.createObjectURL(new Blob([buffer],{type:'image/tiff'})), a=document.createElement('a');
        a.href=url; a.download=`meritech-${p.village?String(p.village).replace(/[^a-z0-9]+/gi,'-').slice(0,80)+'-buffer5km-bagian'+p.part+'-dari'+p.totalParts+'-':''}z${p.zoom}-${retrievedAt.slice(0,10)}.tif`; a.click(); setTimeout(()=>URL.revokeObjectURL(url),60000);
        status.textContent=`GeoTIFF siap: ${p.width} × ${p.height} piksel, ${p.tiles.length} tile, EPSG:3857. ${p.part?'Bagian '+p.part+'/'+p.totalParts+'. ':''}${p.missingTiles?p.missingTiles+' tile tidak tersedia dibuat transparan. ':''}Bagian putih/kosong pada sumber tetap ada. Tanggal unduh bukan tanggal perekaman.`;
      } catch(error) {status.textContent=error.name==='AbortError'?'Unduhan dibatalkan, sesi berakhir, atau waktu koneksi habis.':error.message;}
      finally {clearInterval(expiryTimer);clearTimeout(deadline);controller=null;start.disabled=false;zoom.disabled=false;village?.busy(false);cancel.hidden=true;}
    };
    window.addEventListener('pagehide',()=>controller?.abort(),{once:true});
    return ()=>{controller?.abort();village?.dispose();box.remove();};
  }
  window.YG_MERITECH_EXPORT={mount,plan,encode};
})();
