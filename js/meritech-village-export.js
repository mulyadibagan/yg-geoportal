(function () {
  'use strict';
  const WORLD=40075016.68557849, TILE=256;
  function project(point,zoom){const size=TILE*2**zoom;return [(point[0]+180)/360*size,(1-Math.asinh(Math.tan(point[1]*Math.PI/180))/Math.PI)/2*size];}
  function villageName(f){const p=f.properties||{};return [p.WADMKD||p.Desa||p.NAMA_DESA||p.NAMOBJ||'Desa',p.WADMKC||p.Kecamatan||'',p.WADMKK||p.Kabupaten||''].filter(Boolean).join(' · ');}
  function polygonBounds(g){let w=Infinity,s=Infinity,e=-Infinity,n=-Infinity;const polygons=g.type==='Polygon'?[g.coordinates]:g.coordinates;for(const poly of polygons)for(const ring of poly)for(const [x,y] of ring){w=Math.min(w,x);e=Math.max(e,x);s=Math.min(s,y);n=Math.max(n,y);}return [w,s,e,n];}
  function buffered(feature,turf){if(!['Polygon','MultiPolygon'].includes(feature?.geometry?.type))throw Error('Batas desa harus berupa poligon.');const result=turf.buffer(feature,1,{units:'kilometers',steps:16});if(!result?.geometry)throw Error('Buffer batas desa gagal dibuat.');return result;}
  function partsFor(feature,zoom,turf){
    if(![17,18,19].includes(zoom))throw Error('Zoom tidak valid.');
    const clip=buffered(feature,turf),b=polygonBounds(clip.geometry);
    if(b[0]<99.3||b[2]>104.7||b[1]<-1.7||b[3]>3.7)throw Error('Batas desa berada di luar wilayah Riau.');
    const tl=project([b[0],b[3]],zoom),br=project([b[2],b[1]],zoom),left=Math.floor(tl[0]/TILE),top=Math.floor(tl[1]/TILE),right=Math.ceil(br[0]/TILE),bottom=Math.ceil(br[1]/TILE);
    if((right-left)*(bottom-top)>20000)throw Error('Area terlalu besar pada zoom ini. Pilih zoom 17.');
    const invLat=y=>Math.atan(Math.sinh(Math.PI*(1-2*y/2**zoom)))*180/Math.PI,invLon=x=>x/2**zoom*360-180;
    const parts=[],resolution=WORLD/(TILE*2**zoom);let totalTiles=0,totalBytes=0;
    for(let y=top;y<bottom;y+=8)for(let x=left;x<right;x+=8){
      const ex=Math.min(x+8,right),ey=Math.min(y+8,bottom),bounds=[invLon(x),invLat(ey),invLon(ex),invLat(y)],tiles=[];
      for(let yy=y;yy<ey;yy++)for(let xx=x;xx<ex;xx++){
        const tilePoly=turf.bboxPolygon([invLon(xx),invLat(yy+1),invLon(xx+1),invLat(yy)]);
        if(turf.booleanIntersects(clip,tilePoly))tiles.push({x:xx,y:yy});
      }
      if(!tiles.length)continue;
      const width=(ex-x)*TILE,height=(ey-y)*TILE;
      parts.push({zoom,left:x*TILE,top:y*TILE,width,height,tiles,resolution,xmin:x*TILE*resolution-WORLD/2,ymax:WORLD/2-y*TILE*resolution,bounds,clip:clip.geometry,village:villageName(feature),bufferKm:1,clipBounds:b,part:parts.length+1});
      totalTiles+=tiles.length;totalBytes+=width*height*4;
    }
    if(!parts.length)throw Error('Tidak ada area unduhan.');
    for(const p of parts)p.totalParts=parts.length;
    return {clip,parts,totalTiles,totalBytes};
  }
  function mask(ctx,p){
    if(!p.clip)return;
    ctx.save();ctx.globalCompositeOperation='destination-in';ctx.beginPath();
    const polygons=p.clip.type==='Polygon'?[p.clip.coordinates]:p.clip.coordinates;
    for(const poly of polygons)for(const ring of poly){ring.forEach((point,i)=>{const xy=project(point,p.zoom);if(i)ctx.lineTo(xy[0]-p.left,xy[1]-p.top);else ctx.moveTo(xy[0]-p.left,xy[1]-p.top);});ctx.closePath();}
    ctx.fillStyle='#fff';ctx.fill('evenodd');ctx.restore();
  }
  function mount(box,getMap,readSession){
    const mode=box.querySelector('[data-export-mode]'),controls=box.querySelector('[data-export-village-controls]'),select=box.querySelector('[data-export-village]'),search=box.querySelector('[data-export-village-search]'),part=box.querySelector('[data-export-part]'),status=box.querySelector('[data-export-status]'),zoom=box.querySelector('[data-export-zoom]');
    let collection=null,selection=null,preview=null,load=null,generation=0,disposed=false;
    function removePreview(){if(preview){getMap()?.removeLayer(preview);preview=null;}}
    function reset(){selection=null;part.replaceChildren();removePreview();}
    function update(){
      reset();if(disposed||mode.value!=='village'||select.value===''||!readSession()?.token)return;
      const feature=collection?.features[Number(select.value)];if(!feature)return;
      try{selection=partsFor(feature,Number(zoom.value),window.turf);for(const p of selection.parts){const o=document.createElement('option');o.value=String(p.part-1);o.textContent=`Bagian ${p.part}/${p.totalParts} · ${p.tiles.length} tile`;part.appendChild(o);}
        preview=L.featureGroup([L.geoJSON(feature,{style:{color:'#007bff',weight:2,fill:false}}),L.geoJSON(selection.clip,{style:{color:'#e67700',weight:2,dashArray:'6 4',fillOpacity:.06}})]).addTo(getMap());
        getMap().fitBounds(preview.getBounds(),{padding:[20,20]});
        status.textContent=`Batas desa biru; buffer 1 km oranye. ${selection.parts.length} bagian, ${selection.totalTiles} tile. Perkiraan GeoTIFF total ${(selection.totalBytes/1048576).toFixed(0)} MB (tanpa kompresi). Unduh satu bagian lalu pilih bagian berikutnya. Ketersediaan citra diperiksa saat unduh.`;
      }catch(e){status.textContent=e.message;}
    }
    function filter(){const q=search.value.trim().toLocaleLowerCase('id');select.replaceChildren();const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent='Pilih desa';select.appendChild(placeholder);collection.features.forEach((f,i)=>{const name=villageName(f);if(q&&!name.toLocaleLowerCase('id').includes(q))return;const o=document.createElement('option');o.value=String(i);o.textContent=name;select.appendChild(o);});reset();}
    mode.addEventListener('change',async()=>{
      ++generation;load?.abort();box.querySelector('[data-export-start]').textContent=mode.value==='village'?'Unduh GeoTIFF bagian terpilih':'Unduh GeoTIFF area ini';controls.hidden=mode.value!=='village';reset();if(mode.value!=='village')return;
      const id=generation;if(!readSession()?.token)return;
      status.textContent='Memuat batas desa Riau…';
      try{if(!window.turf?.buffer)throw Error('Pustaka buffer belum siap. Muat ulang halaman.');if(!collection){load?.abort();load=new AbortController();const activeLoad=load;const timeout=setTimeout(()=>activeLoad.abort(),45000);try{const r=await fetch('data/batas_administrasi_desa_riau.geojson',{signal:activeLoad.signal});if(!r.ok)throw Error('Batas desa gagal dimuat.');const d=await r.json();if(!Array.isArray(d.features))throw Error('Data desa tidak valid.');collection={features:d.features.filter(f=>['Polygon','MultiPolygon'].includes(f.geometry?.type)).sort((a,b)=>villageName(a).localeCompare(villageName(b),'id'))};}finally{clearTimeout(timeout);}}
        if(disposed||id!==generation||!readSession()?.token)return;filter();status.textContent='Cari dan pilih desa. Buffer 1 km dihitung dari seluruh batas desa.';
      }catch(e){if(!disposed&&id===generation)status.textContent=e.name==='AbortError'?'Batas desa belum merespons. Pilih mode desa kembali untuk mencoba ulang.':e.message;}
    });
    search.addEventListener('input',()=>{if(collection)filter();});select.addEventListener('change',()=>{if(select.value!=='')update();else reset();});zoom.addEventListener('change',update);
    return {getPlan(){if(mode.value!=='village')return null;if(!selection||select.value==='')throw Error('Pilih desa dan tunggu pratinjau area.');return selection.parts[Number(part.value)];},busy(value){for(const el of [mode,select,search,part])el.disabled=value;},dispose(){disposed=true;++generation;load?.abort();reset();}};
  }
  window.YG_MERITECH_VILLAGE={project,polygonBounds,buffered,partsFor,mask,mount,villageName};
})();
