(function(root){
 'use strict';
 function mount({host,api,getCollection,showCollection,onSaved=()=>{},current=()=>true,confirm=message=>root.confirm(message)}){
  const el=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
  const panel=el('details'),title=el('summary','Batas tim tersimpan'),name=el('input'),store=el('button','Simpan batas untuk tim'),select=el('select'),open=el('button','Buka batas tim'),reload=el('button','Perbarui daftar'),next=el('button','Batas berikutnya'),status=el('p');
  name.type='text';name.maxLength=120;name.placeholder='Nama batas, misalnya Batas lahan horti';name.setAttribute('aria-label','Nama batas lahan');select.setAttribute('aria-label','Batas analisis tersimpan privat');status.setAttribute('role','status');for(const b of [store,open,reload,next])b.type='button';panel.append(title,name,store,select,open,reload,next,status);host.append(panel);
  let id=null,revision=0,saved=null,busy=false,loaded=false,cursor=null,pending=null,disposed=false;
  const alive=()=>!disposed&&current(),fingerprint=(collection,label)=>JSON.stringify({name:label.trim(),features:collection.features.map(f=>({geometry:f.geometry,name:f.properties?.name}))});
  const dirty=()=>{const c=getCollection();return Boolean(pending)||(saved!==null||c.features.length>0)&&fingerprint(c,name.value||'')!==saved;};
  function refresh(){if(!alive())return;store.disabled=busy||!getCollection().features.length||!name.value.trim();open.disabled=busy||!select.value;reload.disabled=next.disabled=busy;next.hidden=!cursor;}
  async function list(more=false){if(!alive()||busy)return;busy=true;refresh();try{const d=await(await api('/api/staff/drone/analysis/areas'+(more&&cursor?'?cursor='+encodeURIComponent(cursor):''))).json();if(!alive())return;if(!more)select.replaceChildren();for(const item of d.items){const suffix=Number.isFinite(item.areaM2)?root.YG_ORTHO_MEASURE.format(item.areaM2):item.feature_count+' objek';const option=el('option',item.name+' · '+suffix);option.value=item.id;select.append(option);}if(!more&&select.options?.length)select.value=select.options[0].value;cursor=d.cursor;loaded=true;status.textContent=d.items.length?'Batas tersimpan privat untuk staf YG.':'Belum ada batas tim tersimpan.';}catch(e){if(alive())status.textContent='Daftar belum dimuat: '+e.message;}finally{busy=false;refresh();}}
  panel.ontoggle=()=>{if(panel.open&&!loaded)list();};reload.onclick=()=>list();next.onclick=()=>list(true);name.oninput=refresh;select.onchange=refresh;
  store.onclick=async()=>{if(!alive()||busy)return;const snapshot=pending?.body.collection||getCollection(),label=pending?.body.name||name.value.trim();if(!snapshot.features.length||!label)return;const fp=fingerprint(snapshot,label);if(!pending)pending={fingerprint:fp,body:{id:id||'area-'+crypto.randomUUID(),name:label,expected_revision:revision,operation_id:crypto.randomUUID(),collection:snapshot}};busy=true;refresh();status.textContent='Menyimpan batas privat…';try{const d=await(await api('/api/staff/drone/analysis/areas',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(pending.body)})).json();if(!alive())return;id=d.record.id;revision=d.record.revision;saved=fp;pending=null;loaded=false;status.textContent='Tersimpan privat · revisi '+revision+'.'+(dirty()?' Masih ada perubahan lokal yang belum tersimpan.':' Tim dapat membuka batas ini kembali.');onSaved(d.record);}catch(e){if(alive())status.textContent=e.status===409?'Batas diubah staf lain. Perubahan lokal tetap ada; ekspor dahulu sebelum memuat versi tim.':'Belum tersimpan: '+e.message+'. Gambar tetap ada; coba simpan lagi.';}finally{busy=false;refresh();}};
  open.onclick=async()=>{if(!alive()||busy||!select.value)return;if(dirty()&&!confirm('Buka batas tim dan ganti geometri lokal? Ekspor dahulu jika perubahan lokal masih diperlukan.'))return;busy=true;refresh();try{const d=await(await api('/api/staff/drone/analysis/areas?id='+encodeURIComponent(select.value))).json();if(!alive())return;showCollection(d.record.collection);id=d.record.id;revision=d.record.revision;name.value=d.record.name;saved=fingerprint(getCollection(),name.value);pending=null;status.textContent='Batas tim dibuka · revisi '+revision+' · privat.';}catch(e){if(alive())status.textContent='Batas belum dibuka: '+e.message;}finally{busy=false;refresh();}};
  const beforeUnload=e=>{if(dirty()){e.preventDefault();e.returnValue='';}};root.addEventListener('beforeunload',beforeUnload);refresh();
  return{refresh,canLeave:()=>!dirty(),dispose(){disposed=true;root.removeEventListener('beforeunload',beforeUnload);panel.remove();}};
 }
 // A read-only map layer, separate from editable measurements and point work.
 // Fetch only on entry or an explicit refresh/save, never on pan or zoom.
 function mountOverlay({host,map,api,current=()=>true}){
  const el=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
  const label=el('label',' Batas horti'),toggle=el('input'),reload=el('button','Perbarui batas'),status=el('small');
  toggle.type='checkbox';toggle.checked=true;reload.type='button';status.setAttribute('role','status');label.prepend(toggle);host.replaceChildren(label,reload,status);
  const pane=map.createPane('ortho-team-boundaries');pane.style.zIndex='450';pane.style.pointerEvents='none';
  const layer=root.L.layerGroup().addTo(map);let disposed=false,busy=false,again=false;
  const alive=()=>!disposed&&current();
  toggle.onchange=()=>{if(!alive())return;if(toggle.checked)layer.addTo(map);else map.removeLayer(layer);};
  async function refresh(){
   if(!alive())return;if(busy){again=true;return;}busy=true;reload.disabled=true;status.textContent='Memuat batas horti…';
   try{
    const items=[];let cursor=null;
    for(let page=0;page<5;page++){
     const d=await(await api('/api/staff/drone/analysis/areas'+(cursor?'?cursor='+encodeURIComponent(cursor):''))).json();if(!alive())return;
     items.push(...d.items.filter(item=>/\bhorti\b/i.test(item.name)));cursor=d.cursor;if(!cursor)break;
    }
    if(cursor)throw Error('Daftar batas belum lengkap.');
    const rendered=[];
    for(const item of new Map(items.map(item=>[item.id,item])).values()){
     const d=await(await api('/api/staff/drone/analysis/areas?id='+encodeURIComponent(item.id))).json();if(!alive())return;
     const polygons=d.record.collection.features.filter(f=>/^(Multi)?Polygon$/.test(f.geometry?.type));
     if(polygons.length)rendered.push(root.L.geoJSON({type:'FeatureCollection',features:polygons},{pane:'ortho-team-boundaries',interactive:false,style:{color:'#a21caf',weight:3,dashArray:'8 5',fill:false,fillOpacity:0}}));
    }
    if(!alive())return;layer.clearLayers();for(const shape of rendered)shape.addTo(layer);
    status.textContent=rendered.length?rendered.length+' batas horti privat':'Belum ada batas horti tersimpan.';
   }catch(error){if(alive())status.textContent='Batas horti belum diperbarui: '+error.message;}
   finally{busy=false;if(alive()){reload.disabled=false;if(again){again=false;refresh();}}}
  }
  reload.onclick=refresh;refresh();
  return{refresh,dispose(){disposed=true;map.removeLayer(layer);host.replaceChildren();}};
 }
 root.YG_ORTHO_AREA_STORE={mount,mountOverlay};
})(window);
