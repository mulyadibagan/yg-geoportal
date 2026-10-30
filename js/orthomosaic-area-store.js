(function(root){
 'use strict';
 function matchZones(collection,boundaries,T){
  const groups=new Map(),overlaps=(a,b)=>a[0]<=b[2]&&a[2]>=b[0]&&a[1]<=b[3]&&a[3]>=b[1];
  for(const f of boundaries.features||[]){const p=f.properties||{},id=p.sourceGawanganId||p.displayId||p.shortId;if(!/^GT-[A-F]-\d+$/.test(id||'')||!/^(Multi)?Polygon$/.test(f.geometry?.type))continue;if(!groups.has(id))groups.set(id,[]);groups.get(id).push({feature:f,bbox:T.bbox(f)});}
  return collection.features.filter(f=>/^(Multi)?Polygon$/.test(f.geometry?.type)).map((f,i)=>{const box=T.bbox(f),areaM2=T.area(f),matches=[],errors=[];
   for(const [id,parts]of groups){const hits=[];try{for(const part of parts)if(overlaps(box,part.bbox)){const hit=T.intersect(f,part.feature);if(hit)hits.push(hit);}if(!hits.length)continue;const intersection=hits.reduce((a,b)=>a?T.union(a,b):b,null),area=T.area(intersection);if(area>=Math.max(.5,areaM2*.005))matches.push({zone:id,areaM2:area,percent:area/areaM2*100});}catch(error){errors.push(id);}}
   matches.sort((a,b)=>b.areaM2-a.areaM2);return{name:f.properties?.name||'Area '+(i+1),areaM2,matches,errors};});
 }
 function mount({host,api,getCollection,showCollection,onSaved=()=>{},current=()=>true,confirm=message=>root.confirm(message)}){
  const el=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
  const panel=el('details'),title=el('summary','Batas tim tersimpan'),name=el('input'),store=el('button','Simpan batas untuk tim'),select=el('select'),open=el('button','Buka batas tim'),reload=el('button','Perbarui daftar'),next=el('button','Batas berikutnya'),analyze=el('button','Rincian gawangan batas tersimpan'),zoneResults=el('div'),status=el('p');
  name.type='text';name.maxLength=120;name.placeholder='Nama batas, misalnya Batas lahan horti';name.setAttribute('aria-label','Nama batas lahan');select.setAttribute('aria-label','Batas analisis tersimpan privat');status.setAttribute('role','status');for(const b of [store,open,reload,next,analyze])b.type='button';panel.append(title,name,store,select,open,reload,next,analyze,zoneResults,status);host.append(panel);
  let id=null,revision=0,saved=null,busy=false,loaded=false,cursor=null,pending=null,disposed=false;
  const importer=el('input'),importLabel=el('label','Impor batas GeoJSON');importer.type='file';importer.accept='.geojson,.json,application/geo+json,application/json';importer.setAttribute('aria-label','Impor batas GeoJSON');importLabel.append(importer);panel.append(importLabel);
  importer.onchange=async()=>{const file=importer.files?.[0];if(!file||busy||!alive())return;try{
   if(file.size>1024*1024)throw Error('Berkas batas maksimal 1 MB.');const collection=JSON.parse(await file.text());
   if(collection.type!=='FeatureCollection'||!Array.isArray(collection.features)||!collection.features.length||collection.features.length>50)throw Error('GeoJSON harus berisi 1–50 poligon.');
   for(const f of collection.features){if(f.type!=='Feature'||!/^(Multi)?Polygon$/.test(f.geometry?.type))throw Error('Impor hanya menerima poligon.');const coordinates=f.geometry.coordinates.flat(Infinity);if(!coordinates.length||!coordinates.every(Number.isFinite))throw Error('Koordinat poligon tidak valid.');if(root.turf?.kinks(f).features.length)throw Error('Batas berpotongan; perbaiki berkas dahulu.');}
   if(!alive())return;if(dirty()&&!confirm('Ganti gambar lokal dengan batas dari berkas? Salinan tersimpan tim tidak diubah.'))return;
   showCollection(collection);id=null;revision=0;saved=null;pending=null;name.value=String(collection.name||file.name.replace(/\.(geojson|json)$/i,'')).slice(0,120);refresh();status.textContent=collection.features.length+' poligon diimpor sebagai batas baru; belum tersimpan untuk tim.';
  }catch(error){if(alive())status.textContent='Impor belum selesai: '+error.message;}finally{importer.value='';}};
  const alive=()=>!disposed&&current(),fingerprint=(collection,label)=>JSON.stringify({name:label.trim(),features:collection.features.map(f=>({geometry:f.geometry,name:f.properties?.name}))});
  const dirty=()=>{const c=getCollection();return Boolean(pending)||(saved!==null||c.features.length>0)&&fingerprint(c,name.value||'')!==saved;};
  function refresh(){if(!alive())return;store.disabled=busy||!getCollection().features.length||!name.value.trim();open.disabled=analyze.disabled=busy||!select.value;reload.disabled=next.disabled=busy;next.hidden=!cursor;}
  async function list(more=false){if(!alive()||busy)return;busy=true;refresh();try{const d=await(await api('/api/staff/drone/analysis/areas'+(more&&cursor?'?cursor='+encodeURIComponent(cursor):''))).json();if(!alive())return;if(!more)select.replaceChildren();for(const item of d.items){const suffix=Number.isFinite(item.areaM2)?root.YG_ORTHO_MEASURE.format(item.areaM2):item.feature_count+' objek';const option=el('option',item.name+' · '+suffix);option.value=item.id;select.append(option);}if(!more&&select.options?.length)select.value=select.options[0].value;cursor=d.cursor;loaded=true;status.textContent=d.items.length?'Batas tersimpan privat untuk staf YG.':'Belum ada batas tim tersimpan.';}catch(e){if(alive())status.textContent='Daftar belum dimuat: '+e.message;}finally{busy=false;refresh();}}
  panel.ontoggle=()=>{if(panel.open&&!loaded)list();};reload.onclick=()=>list();next.onclick=()=>list(true);name.oninput=refresh;select.onchange=refresh;
  store.onclick=async()=>{if(!alive()||busy)return;const snapshot=pending?.body.collection||getCollection(),label=pending?.body.name||name.value.trim();if(!snapshot.features.length||!label)return;const fp=fingerprint(snapshot,label);if(!pending)pending={fingerprint:fp,body:{id:id||'area-'+crypto.randomUUID(),name:label,expected_revision:revision,operation_id:crypto.randomUUID(),collection:snapshot}};busy=true;refresh();status.textContent='Menyimpan batas privat…';try{const d=await(await api('/api/staff/drone/analysis/areas',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(pending.body)})).json();if(!alive())return;id=d.record.id;revision=d.record.revision;saved=fp;pending=null;loaded=false;status.textContent='Tersimpan privat · revisi '+revision+'.'+(dirty()?' Masih ada perubahan lokal yang belum tersimpan.':' Tim dapat membuka batas ini kembali.');onSaved(d.record);}catch(e){if(alive())status.textContent=e.status===409?'Batas diubah staf lain. Perubahan lokal tetap ada; ekspor dahulu sebelum memuat versi tim.':'Belum tersimpan: '+e.message+'. Gambar tetap ada; coba simpan lagi.';}finally{busy=false;refresh();}};
  open.onclick=async()=>{if(!alive()||busy||!select.value)return;if(dirty()&&!confirm('Buka batas tim dan ganti geometri lokal? Ekspor dahulu jika perubahan lokal masih diperlukan.'))return;busy=true;refresh();try{const d=await(await api('/api/staff/drone/analysis/areas?id='+encodeURIComponent(select.value))).json();if(!alive())return;showCollection(d.record.collection);id=d.record.id;revision=d.record.revision;name.value=d.record.name;saved=fingerprint(getCollection(),name.value);pending=null;status.textContent='Batas tim dibuka · revisi '+revision+' · privat.';}catch(e){if(alive())status.textContent='Batas belum dibuka: '+e.message;}finally{busy=false;refresh();}};
  analyze.onclick=async()=>{if(!alive()||busy||!select.value)return;busy=true;refresh();status.textContent='Mencocokkan poligon tersimpan dengan batas gawangan revisi…';try{const d=await(await api('/api/staff/drone/analysis/areas?id='+encodeURIComponent(select.value))).json();if(!alive())return;const response=await fetch('data/dayun-map.geojson',{cache:'no-cache'});if(!response.ok)throw Error('Batas gawangan belum dimuat');const boundaries=await response.json();if(!alive())return;const rows=matchZones(d.record.collection,boundaries,root.turf),table=el('table'),head=el('tr');table.setAttribute('aria-label','Kecocokan poligon tersimpan dan gawangan');for(const text of ['Poligon','Luas (m²)','Gawangan yang beririsan'])head.append(el('th',text));table.append(head);for(const row of rows){const tr=el('tr');for(const text of [row.name,row.areaM2.toLocaleString('id-ID',{maximumFractionDigits:2}),row.matches.map(m=>m.zone+' ('+m.percent.toLocaleString('id-ID',{maximumFractionDigits:1})+'%)').join('; ')||'Di luar gawangan'])tr.append(el('td',text));if(row.errors.length)tr.append(el('td','Perlu diperiksa: '+row.errors.join(', ')));table.append(tr);}zoneResults.replaceChildren(table);status.textContent=d.record.name+' · revisi '+d.record.revision+' · '+rows.length+' poligon diperiksa. Persentase menunjukkan bagian luas poligon di dalam gawangan; nama dan geometri tidak diubah.';}catch(e){if(alive())status.textContent='Pencocokan belum selesai: '+e.message;}finally{busy=false;refresh();}};
  const beforeUnload=e=>{if(dirty()){e.preventDefault();e.returnValue='';}};root.addEventListener('beforeunload',beforeUnload);refresh();
  return{refresh,canLeave:()=>!dirty(),dispose(){disposed=true;root.removeEventListener('beforeunload',beforeUnload);panel.remove();}};
 }
 // A read-only map layer, separate from editable measurements and point work.
 // Fetch only on entry or an explicit refresh/save, never on pan or zoom.
 function mountOverlay({host,map,api,current=()=>true,title="Batas horti",matches=item=>/\bhorti\b/i.test(item.name),paneName="ortho-team-boundaries",color="#a21caf",getSnapshot,publicLabels=false,initialVisible=true}){
  const el=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
  const label=el('label',' '+title),toggle=el('input'),reload=el('button','Perbarui batas'),status=el('small');
  toggle.type='checkbox';toggle.checked=initialVisible;reload.type='button';status.setAttribute('role','status');label.prepend(toggle);host.replaceChildren(label,reload,status);
  const pane=map.createPane(paneName);pane.style.zIndex='450';pane.style.pointerEvents='none';
  const layer=root.L.layerGroup();if(initialVisible)layer.addTo(map);let disposed=false,busy=false,again=false;
  const alive=()=>!disposed&&current();
  const countsHost=getSnapshot?el('details'):null,annotations=[];let records=[];
  if(countsHost)host.append(countsHost);
  function updateLabelVisibility(){const snapshot=getSnapshot?.();for(const a of annotations){if(snapshot?.ready&&(!a.block||a.block===snapshot.block)&&(map.getZoom?.()??22)>=22)a.layer.openTooltip?.();else a.layer.closeTooltip?.();}}
  function updateCounts(){if(!alive()||!countsHost)return;const snapshot=getSnapshot(),heading=el('summary','Jumlah titik dalam area nanas baru'),table=el('table'),head=el('tr');head.append(el('th','Area'),el('th','Titik nanas'));table.append(head);
   const count=(polygons,block)=>{if(!snapshot?.ready||block&&block!==snapshot.block)return block?'Buka Blok '+block:'Buka blok terkait';if(snapshot.dirty)return'Menunggu koreksi tersimpan';const value=root.YG_DAYUN_NEW_PLANTING.countPoints(polygons,snapshot.pointsInBounds||snapshot.features,root.turf);return value.total.toLocaleString('id-ID')+' titik';};
   for(const record of records){const block=record.name.match(/\bBlok\s+([A-F])\b/i)?.[1]?.toUpperCase()||record.collection.features[0]?.properties?.zoneId?.match(/^GT-([A-F])-/)?.[1];for(const f of record.collection.features){if(!/^(Multi)?Polygon$/.test(f.geometry?.type))continue;const row=el('tr');row.append(el('td',f.properties?.name||record.name),el('td',count([f],block)));table.append(row);}const row=el('tr');row.append(el('td',record.name+' · total unik'),el('td',count(record.collection.features,block)));table.append(row);}
   countsHost.replaceChildren(heading,table,el('small','Jumlah nanas dalam setiap area.'));
   for(const a of annotations)a.label.textContent=(a.feature.properties?.name||a.name)+' · '+count([a.feature],a.block);updateLabelVisibility();
  }
  const changed=()=>updateCounts();if(getSnapshot){map.on('dayun:plantschanged',changed);map.on('zoomend',updateLabelVisibility);}
  toggle.onchange=()=>{if(!alive())return;if(toggle.checked)layer.addTo(map);else map.removeLayer(layer);};
  async function refresh(){
   if(!alive())return;if(busy){again=true;return;}busy=true;reload.disabled=true;status.textContent='Memuat '+title+'…';
   try{
    const items=[];let cursor=null;
    for(let page=0;page<5;page++){
     const d=await(await api('/api/staff/drone/analysis/areas'+(cursor?'?cursor='+encodeURIComponent(cursor):''))).json();if(!alive())return;
     items.push(...d.items.filter(matches));cursor=d.cursor;if(!cursor)break;
    }
    if(cursor)throw Error('Daftar batas belum lengkap.');
    const rendered=[],nextRecords=[],nextAnnotations=[];
    for(const item of new Map(items.map(item=>[item.id,item])).values()){
     const d=await(await api('/api/staff/drone/analysis/areas?id='+encodeURIComponent(item.id))).json();if(!alive())return;
     const polygons=d.record.collection.features.filter(f=>/^(Multi)?Polygon$/.test(f.geometry?.type));
     nextRecords.push({...d.record,collection:{type:'FeatureCollection',features:polygons}});
     if(polygons.length)rendered.push(root.L.geoJSON({type:'FeatureCollection',features:polygons},{pane:paneName,interactive:false,style:{color,weight:3,dashArray:'8 5',fill:false,fillOpacity:0},...(getSnapshot?{onEachFeature:(feature,l)=>{const label=el('span'),block=d.record.name.match(/\bBlok\s+([A-F])\b/i)?.[1]?.toUpperCase()||feature.properties?.zoneId?.match(/^GT-([A-F])-/)?.[1];l.bindTooltip(label,{permanent:true,direction:'center'});nextAnnotations.push({feature,label,block,layer:l,name:d.record.name});}}:{})}));
    }
    if(!alive())return;layer.clearLayers();for(const shape of rendered)shape.addTo(layer);records=nextRecords;annotations.splice(0,annotations.length,...nextAnnotations);updateCounts();
    status.textContent=publicLabels?(rendered.length?rendered.length+' area':'Belum ada area tersimpan.'):(rendered.length?rendered.length+' area':'Belum ada '+title+' tersimpan.');
   }catch(error){if(alive())status.textContent=publicLabels?'Area belum dapat diperbarui.':title+' belum diperbarui: '+error.message;}
   finally{busy=false;if(alive()){reload.disabled=false;if(again){again=false;refresh();}}}
  }
  reload.onclick=refresh;refresh();
  return{refresh,updateCounts,dispose(){disposed=true;if(getSnapshot){map.off('dayun:plantschanged',changed);map.off('zoomend',updateLabelVisibility);}map.removeLayer(layer);host.replaceChildren();}};
 }
 root.YG_ORTHO_AREA_STORE={mount,mountOverlay,matchZones};
})(window);
