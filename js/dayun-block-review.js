(function(root){
  'use strict';
  async function mount({host,map,api,base,manifest,openRaster,save,current}){
    const path=manifest.block_analyses?.A;
    if(!path||!manifest.files.includes(path))return()=>{};
    const folder=path.slice(0,path.lastIndexOf('/')+1);
    const get=async name=>{const file=folder+name;if(!manifest.files.includes(file))throw Error('Berkas analisis blok belum tersedia.');return api(base+'/files/'+file);};
    const result=await(await api(base+'/files/'+path)).json();if(!current())return()=>{};
    if(result.schema!=='dayun-block-analysis-v1'||result.source_run!==manifest.run||result.block!=='A')throw Error('Sumber analisis blok tidak sesuai.');
    let disposed=false,detail=false,loading=false,url=null;
    const group=L.layerGroup().addTo(map),points=L.layerGroup().addTo(map);
    const el=(tag,text)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;return node;};
    host.replaceChildren();host.hidden=false;
    const title=el('h3','Blok A — kandidat & pemeriksaan batas');
    const note=el('p','Aktif/mati mengikuti kategori polygon sumber, bukan diagnosis tanaman. Kandidat tajuk belum terkonfirmasi sebagai nanas. Batas sumber tidak diubah.');note.className='note';
    const open=el('button','Buka seluruh Blok A'),native=el('button','Periksa citra asli di titik peta'),download=el('button','Unduh tabel Blok A'),auditDownload=el('button','Unduh lokasi pemeriksaan batas');
    const select=el('select');select.setAttribute('aria-label','Gawangan Blok A');select.add(new Option('Seluruh Blok A',''));
    result.zones.forEach(z=>select.add(new Option(z.id+' · '+(z.kind==='active_source'?'aktif':'mati, asosiasi sementara')+' · '+z.candidate_crowns+' kandidat',z.id)));
    const status=el('p','Buka blok untuk melihat citra dan seluruh batas.');status.setAttribute('role','status');
    const summary=el('p',`${result.candidate_count.toLocaleString('id-ID')} kandidat tajuk; ${result.boundary_conflict_candidate_count} kandidat pada batas tumpang tindih; ${result.boundary_overlap_count} zona tumpang tindih. Bukan jumlah nanas.`);
    const info=el('p','Hijau: gawangan tanam; cokelat: gawangan mati; merah: batas tumpang tindih; jingga: kandidat. Perbesar peta untuk melihat titik.');info.className='note';
    const table=el('table'),head=el('tr');['Gawangan','Kategori sumber','Kandidat di luar konflik','Kandidat konflik batas'].forEach(s=>head.append(el('th',s)));table.append(head);
    result.zones.forEach(z=>{const row=el('tr');[z.id,z.kind==='active_source'?'Aktif':'Mati (sementara)',z.candidate_crowns,z.boundary_conflict_candidates].forEach(v=>row.append(el('td',String(v))));table.append(row);});
    const details=el('details'),caption=el('summary','Tabel per gawangan');details.append(caption,table);
    host.append(title,note,open,select,native,summary,info,download,auditDownload,details,status);
    const referencePath=manifest.block_comparisons?.A;
    if(referencePath&&manifest.files.includes(referencePath)){
      try{
        const ref=await(await api(base+'/files/'+referencePath)).json();if(!current()){map.removeLayer(group);map.removeLayer(points);return()=>{};}
        if(ref.schema!=='dayun-ortho-database-comparison-v1'||ref.source_run!==manifest.run||ref.block!=='A')throw Error('Pembanding database bukan untuk citra ini.');
        const panel=el('details'),heading=el('summary','Pembanding database per gawangan');panel.append(heading);
        panel.append(el('p','Data sumber: '+(ref.database_updated_at||'tanggal belum tersedia')+'. Monitoring: '+(ref.provenance?.monitoring_snapshot_at||'tanggal belum tersedia')+'. Angka sumber, tambahan ditanam, sensus hidup dan stok bibit berbeda. Pecahan dipertahankan; kandidat citra bukan jumlah nanas. Umur saat terbang belum dapat dihitung.'));
        const comparison=el('table'),header=el('tr');['Gawangan','Tanam awal / tambahan','Nanas awal (sumber)','Tambahan ditanam','Sensus hidup terpublikasi','Stok bibit','MPTS: sumber & bulan tanam','Kandidat citra'].forEach(v=>header.append(el('th',v)));comparison.append(header);
        const num=v=>v===null||v===undefined?'Belum tersedia':Number(v).toLocaleString('id-ID',{maximumFractionDigits:3});
        for(const r of ref.rows){const row=el('tr');const periods=[r.pineapple_planting_period,...(r.pineapple_cohorts||[]).map(c=>c.period+': '+num(c.plantedCount))].filter(Boolean).join('; ');const trees=(r.mpts||[]).map(c=>c.species+': '+num(c.source_count)+' ('+(c.planting_period||'bulan belum tersedia')+')').join('; ');
          [r.gawangan,r.database_match?(periods||'Belum tersedia'):'Tidak ada padanan ID database',num(r.pineapple_source_initial)+(r.source_matches_spacing_capacity?' · cocok kapasitas jarak tanam':''),num(r.pineapple_added_planted),num(r.pineapple_living_census)+(r.pineapple_census_period?' · '+r.pineapple_census_period:''),num(r.seedling_stock),trees||'Belum tersedia',num(r.image_candidates)].forEach(v=>row.append(el('td',v)));comparison.append(row);
        }
        panel.append(comparison);const csv=referencePath.replace(/\.json$/,'.csv');if(manifest.files.includes(csv)){const button=el('button','Unduh pembanding database');button.onclick=async()=>{try{const blob=await(await api(base+'/files/'+csv)).blob();if(active())save(blob,'dayun-blok-A-pembanding-database.csv');}catch(error){if(active())status.textContent=error.message;}};panel.append(button);}host.append(panel);
      }catch(error){if(current())host.append(el('p','Pembanding belum dapat dimuat: '+error.message));}
    }
    let geo=null,candidates=null;
    const active=()=>!disposed&&current();
    function drawPoints(){points.clearLayers();if(!active()||!candidates||map.getZoom()<22)return;const b=map.getBounds();let count=0;
      for(const f of candidates.features){if(select.value&&!f.properties.zones.includes(select.value))continue;const [x,y]=f.geometry.coordinates;if(!b.contains([y,x]))continue;if(count++>=3000)break;
        L.circleMarker([y,x],{radius:4,color:f.properties.boundary_conflict?'#c72d40':'#df8e00',weight:1,fillOpacity:.65}).bindTooltip(f.properties.id+' · kandidat belum tervalidasi').on('click',()=>{status.textContent=f.properties.id+' · kemiripan '+f.properties.similarity+' (bukan probabilitas nanas) · '+f.properties.zones.join(', ');}).addTo(points);
      }
    }
    async function show(){if(!active()||loading)return;loading=true;open.disabled=true;status.textContent='Membuka citra Blok A dan audit batas privat…';
      try{const [zones,crown,audit,image]=await Promise.all([(await get('zones.geojson')).json(),(await get('candidates.geojson')).json(),(await get('boundary-audit.geojson')).json(),(await get(result.overview)).blob()]);if(!active())return;
        group.clearLayers();if(url)URL.revokeObjectURL(url);url=URL.createObjectURL(image);const b=result.bounds;L.imageOverlay(url,[[b[1],b[0]],[b[3],b[2]]]).addTo(group);
        geo=L.geoJSON(zones,{style:f=>({color:f.properties.kind==='active_source'?'#137f63':'#ad6b32',weight:2,fillOpacity:.03}),onEachFeature:(f,l)=>l.bindTooltip(f.properties.id+' · '+f.properties.candidate_crowns+' kandidat belum tervalidasi')}).addTo(group);
        L.geoJSON(audit,{style:{color:'#c72d40',weight:3,fillOpacity:.35},onEachFeature:(f,l)=>l.bindTooltip(f.properties.zone_a+' / '+f.properties.zone_b+' · periksa batas')}).addTo(group);
        candidates=crown;map.fitBounds(geo.getBounds());drawPoints();status.textContent='Blok A terbuka. Perbesar peta untuk kandidat; klik Periksa citra asli lalu lokasi yang ingin diperiksa. Asosiasi gawangan mati sementara.';
      }catch(error){if(active())status.textContent=error.message;}finally{loading=false;if(active())open.disabled=false;}
    }
    open.onclick=show;
    select.onchange=()=>{if(!active()||!geo)return;const selected=geo.getLayers().filter(l=>!select.value||l.feature.properties.id===select.value);const layer=L.featureGroup(selected);map.fitBounds(layer.getBounds());drawPoints();};
    native.onclick=()=>{detail=!detail;native.textContent=detail?'Batal memilih detail citra':'Periksa citra asli di titik peta';status.textContent=detail?'Klik lokasi pada peta untuk membuka TIFF native di lokasi tersebut.':'Pemilihan detail dibatalkan.';};
    const click=async event=>{if(!active()||!detail||loading)return;const {lng:x,lat:y}=event.latlng;const tile=result.native_tiles.find(t=>x>=t.bounds[0]&&x<=t.bounds[2]&&y>=t.bounds[1]&&y<=t.bounds[3]);if(!tile){status.textContent='Lokasi ini di luar potongan Blok A.';return;}loading=true;detail=false;native.textContent='Periksa citra asli di titik peta';
      try{const blob=await(await get(tile.file)).blob();if(active()){await openRaster(blob,{title:'Blok A / '+tile.file,nativeReview:true});status.textContent='TIFF native berkoordinat terbuka. Bandingkan tajuk dengan batas; pergeseran batas belum dikonfirmasi dengan pengukuran lapangan.';}}catch(error){if(active())status.textContent=error.message;}finally{loading=false;}
    };
    download.onclick=async()=>{try{const blob=await(await get('gawangan.csv')).blob();if(active())save(blob,'dayun-blok-A-kandidat.csv');}catch(error){if(active())status.textContent=error.message;}};
    auditDownload.onclick=async()=>{try{const blob=await(await get('boundary-audit.geojson')).blob();if(active())save(blob,'dayun-blok-A-periksa-batas.geojson');}catch(error){if(active())status.textContent=error.message;}};
    map.on('moveend zoomend',drawPoints);map.on('click',click);
    return()=>{disposed=true;map.off('moveend zoomend',drawPoints);map.off('click',click);map.removeLayer(group);map.removeLayer(points);if(url)URL.revokeObjectURL(url);host.replaceChildren();host.hidden=true;};
  }
  root.YG_DAYUN_BLOCK={mount};
})(window);
