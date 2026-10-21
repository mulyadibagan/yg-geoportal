(function(root){
  'use strict';
  const format=m2=>`${Number(m2).toLocaleString('id-ID',{maximumFractionDigits:2})} m² · ${(m2/10000).toLocaleString('id-ID',{maximumFractionDigits:4})} ha`;
  function merge(features,turf){
    if(!features.length)throw Error('Batas polygon belum tersedia.');
    // Normalize sub-millimetre reprojection noise on copies before topological union.
    return features.map(f=>turf.cleanCoords(turf.truncate(f,{precision:8,mutate:false}))).reduce((a,b)=>a?turf.union(a,b):b,null);
  }
  function groups(data){
    const out=new Map();
    for(const f of data.features||[]){if(!/^(Multi)?Polygon$/.test(f.geometry?.type))continue;const p=f.properties||{},id=p.sourceGawanganId||p.displayId||p.shortId||p.featureId||p.objectId;
      if(!id)continue;if(!out.has(id))out.set(id,[]);out.get(id).push(f);
    }return out;
  }
  function mount({map,areas,onChanged,beforeDraw=()=>true,loadBoundaries=()=>fetch('data/dayun-map.geojson').then(r=>{if(!r.ok)throw Error('Batas gawangan gagal dimuat.');return r.json();})}){
    const L=root.L,T=root.turf,el=(tag,text)=>{const e=document.createElement(tag);if(text)e.textContent=text;return e;};
    const control=L.control({position:'topright'}),host=el('div'),output=el('output','Luas: mulai gambar batas lahan.'),draw=el('button','Ukur batas lahan'),details=el('details'),select=el('select'),use=el('button','Ukur batas terpilih');
    host.className='ortho-measure leaflet-bar';output.setAttribute('aria-live','polite');output.setAttribute('aria-label','Luas pengukuran');draw.type=use.type='button';select.setAttribute('aria-label','Batas lahan atau gawangan untuk diukur');
    details.append(el('summary','Batas agro / gawangan'),select,use,el('small','Gabungan polygon revisi; celah di luar polygon tidak termasuk.'));host.append(draw,output,details);L.DomEvent.disableClickPropagation(host);L.DomEvent.disableScrollPropagation(host);control.onAdd=()=>host;control.addTo(map);
    let vertices=[],active=null,handler=null,boundaries=null,corner=null,completed=false;
    const showFeature=f=>{if(f&&/Polygon/.test(f.geometry?.type))output.textContent='Luas: '+format(T.area(f));};
    const preview=cursor=>{if(active!=='polygon')return;const pts=vertices.map(p=>[p.lng,p.lat]);if(cursor&&(pts.length===0||pts.at(-1)[0]!==cursor.lng||pts.at(-1)[1]!==cursor.lat))pts.push([cursor.lng,cursor.lat]);if(pts.length<3){output.textContent='Luas: tentukan minimal 3 sudut batas.';return;}try{showFeature(T.polygon([[...pts,pts[0]]]));}catch{output.textContent='Periksa kembali bentuk batas.';}};
    map.on('draw:drawstart',e=>{map.orthoMeasuring=true;active=e.layerType;vertices=[];corner=null;completed=false;if(active==='polygon')preview();});
    map.on('draw:drawvertex',e=>{vertices=e.layers.getLayers().map(l=>l.getLatLng());preview();});
    map.on('mousedown',e=>{if(active==='rectangle')corner=e.latlng;});
    map.on('mousemove',e=>{preview(e.latlng);if(active==='rectangle'&&corner){const a=corner,b=e.latlng;showFeature(T.polygon([[[a.lng,a.lat],[b.lng,a.lat],[b.lng,b.lat],[a.lng,b.lat],[a.lng,a.lat]]]));}});
    map.on('draw:drawstop draw:editstop draw:deletestop',()=>{if(!completed){const last=areas.getLayers().at(-1);if(last)showFeature(last.toGeoJSON(false));else output.textContent='Luas: mulai gambar batas lahan.';}active=null;map.orthoMeasuring=false;});
    map.on('draw:editstart draw:deletestart',()=>{map.orthoMeasuring=true;});
    map.on('draw:editvertex draw:editmove draw:editresize',e=>{const layer=e.poly||e.layer;if(layer?.toGeoJSON)showFeature(layer.toGeoJSON(false));});
    map.on('draw:created',e=>{if(!e.layer.options?.dayunPlantSelection&&!e.layer.options?.dayunFruitSelection){completed=true;showFeature(e.layer.toGeoJSON(false));}});
    draw.onclick=()=>{if(!beforeDraw())return;handler?.disable();handler=new L.Draw.Polygon(map,{allowIntersection:false,showArea:true,shapeOptions:{color:'#2563eb',weight:3,fillOpacity:.08}});handler.enable();};
    details.ontoggle=async()=>{if(!details.open||boundaries)return;try{use.disabled=true;const data=await loadBoundaries();boundaries=groups(data);select.replaceChildren();select.append(new Option('Gabungan batas agro A–F','__ALL__'));for(const id of [...boundaries.keys()].sort())select.append(new Option(id,id));}catch(error){output.textContent=error.message;}finally{use.disabled=!boundaries;}};
    use.disabled=true;use.onclick=()=>{if(!boundaries||!beforeDraw())return;try{const id=select.value,all=id==='__ALL__',f=merge(all?[...boundaries.values()].flat():boundaries.get(id)||[],T);f.properties={name:all?'Gabungan batas agro A–F':id,method:'batas_gawangan_revisi',source:'data/dayun-map.geojson'};const layer=L.geoJSON(f,{style:{color:'#2563eb',weight:3,fillOpacity:.08}}).getLayers()[0];areas.addLayer(layer);onChanged();showFeature(f);map.fitBounds(layer.getBounds());}catch(error){output.textContent='Tidak dapat mengukur: '+error.message;}};
    return{element:host,showFeature,clear:()=>{output.textContent='Luas: mulai gambar batas lahan.';},control};
  }
  root.YG_ORTHO_MEASURE={format,merge,groups,mount};
})(window);
