(function(root){
  'use strict';
  async function mount({host,comparisonHost=host,map,api,base,manifest,openRaster,save,current,autoOpen=false,onAutoOpen,onShowComparison,onEditMap}){
    const path=manifest.block_analyses?.A;
    if(!path||!manifest.files.includes(path))return()=>{};
    const folder=path.slice(0,path.lastIndexOf('/')+1);
    let assetFolder='';
    const listed=name=>manifest.files.includes(folder+name)||(assetFolder&&manifest.files.includes(assetFolder+name));
    const get=async name=>{const file=manifest.files.includes(folder+name)?folder+name:assetFolder+name;if(!manifest.files.includes(file))throw Error('Berkas analisis blok belum tersedia.');return api(base+'/files/'+file);};
    const result=await(await api(base+'/files/'+path)).json();if(!current())return()=>{};
    if(result.schema!=='dayun-block-analysis-v1'||result.source_run!==manifest.run||result.block!=='A')throw Error('Sumber analisis blok tidak sesuai.');
    if(result.asset_folder){if(!/^[\w-]+\/$/.test(result.asset_folder)||!manifest.files.includes(result.asset_folder+'analysis.json'))throw Error('Aset citra asli analisis tidak sesuai.');assetFolder=result.asset_folder;}
    let disposed=false,detail=false,loading=false,url=null;
    let geo=null,candidates=null,zonesData=null,editor=null,nativeBounds=null,nativeRequest=0;
    const active=()=>!disposed&&current();
    const reviewCells=new Map();let teamSummary=null;
    function updateReview({counts}){drawPoints();if(teamSummary)teamSummary.textContent=`Koreksi tim: tambahan ${counts.manual_additions}, ditolak ${counts.rejected}, diterima ${counts.accepted_by_staff}, belum diperiksa ${counts.unreviewed}, hitungan kerja ${counts.working_total.toLocaleString('id-ID')}. Hitungan kerja mencakup kandidat yang belum diperiksa; bukan sensus hidup.`;for(const row of counts.zones||[]){const cells=reviewCells.get(row.zone_id);if(cells)[row.manual_additions,row.rejected,row.accepted_by_staff,row.working_total].forEach((n,i)=>cells[i].textContent=n.toLocaleString('id-ID'));}}
    const group=L.layerGroup().addTo(map),points=L.layerGroup().addTo(map),diagnostics=L.layerGroup().addTo(map);
    let diagnosticData=null,diagnosticCells=null,showDiagnostics=false,sheetUrl=null;
    const el=(tag,text)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;return node;};
    host.replaceChildren();host.hidden=false;
    const title=el('h3',result.full_block_count?'Hitungan otomatis seluruh Blok A':'Blok A — kandidat & pemeriksaan batas');
    const note=el('p','Aktif/mati mengikuti kategori polygon sumber, bukan diagnosis tanaman. Kandidat tajuk belum terkonfirmasi sebagai nanas. Batas sumber tidak diubah.');note.className='note';if(result.capture_date)note.textContent+=' Tanggal citra: '+result.capture_date+' (keterangan pemilik data).';if(Array.isArray(result.analysis_findings))note.textContent+=' '+result.analysis_findings.join(' ');
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
    if(result.full_block_count){const count=result.full_block_count;details.open=false;
      const sensitivity=count.sensitivity_thresholds?count.sensitivity_thresholds.map(r=>`ambang ${r.threshold}: ${r.candidate_count.toLocaleString('id-ID')}`).join('; '):`ambang 0,25: ${count.threshold_025_count.toLocaleString('id-ID')}; ambang 0,40: ${count.threshold_040_count.toLocaleString('id-ID')}`;
      host.append(el('p',`Seluruh ${count.processed_tiles} potongan native selesai diproses. ${count.candidate_count.toLocaleString('id-ID')} kandidat pada ambang ${count.threshold}; keyakinan rendah. Uji sensitivitas ${sensitivity}. Ini bukan rentang jumlah tanaman atau selang kepercayaan.`));
      const pointsDownload=el('button','Unduh seluruh titik hasil Blok A');pointsDownload.onclick=async()=>{try{const blob=await(await get('candidates.geojson')).blob();if(active())save(blob,'dayun-blok-A-kandidat-seluruh-blok.geojson');}catch(error){if(active())status.textContent=error.message;}};host.append(pointsDownload);
      info.textContent+=' Penanda maksimal 3.000 per tampilan; tabel dan unduhan memuat seluruh hasil.';
    }
    if(result.model_calibration){const model=result.model_calibration,test=model.metrics.spatial_holdout,train=model.metrics.training;const panel=el('section');panel.className='block-calibration';panel.append(el('h3','Detektor dari koreksi tim'),el('p',`${model.label_count} titik positif ${model.label_gawangan.join(', ')}: ${train.positive_labels} untuk kalibrasi, ${test.positive_labels} uji spasial, ${model.metrics.guard_unused.positive_labels} penyangga. Revisi sumber: ${model.review_revision}.`),el('p',`Uji pada deteksi seluruh blok, toleransi 12 piksel: detektor lama ${test.baseline_matched_within_12px}/${test.positive_labels}; hasil utama ${test.calibrated_matched_within_12px}/${test.positive_labels}; uji ambang peka ${test.sensitive_matched_within_12px}/${test.positive_labels}. Ini hanya temuan kembali pada titik positif yang diketahui, bukan akurasi jumlah, presisi, atau recall semua tanaman.`),el('p',`Skala ${model.radii_native_pixels.join('/')} piksel; jarak penyaringan ${model.suppression_native_pixels} piksel. Ambang utama adalah median skor titik latih. ${result.full_block_count.model_proposals_represented_by_manual} usulan yang cocok dengan titik manual dikeluarkan dari lapisan otomatis; koreksi manual tetap tersimpan terpisah.`));
      if(result.previous_automatic_candidate_count!=null)panel.append(el('p',`Perbandingan hasil otomatis: versi lama ${result.previous_automatic_candidate_count.toLocaleString('id-ID')}; versi kalibrasi ${result.candidate_count.toLocaleString('id-ID')}. Kenaikan kandidat bukan bukti kenaikan jumlah nanas.`));
      panel.append(el('p',`Diagnostik ambang peka ${result.full_block_count.sensitive_diagnostic_threshold}: ${result.full_block_count.sensitive_diagnostic_candidates.toLocaleString('id-ID')} usulan. Terlalu banyak usulan lemah; tidak dipakai sebagai lapisan utama. Contoh masih dari satu area dan belum cukup contoh negatif.`));
      if(listed('calibration-label-preview.png')){const preview=el('button','Lihat pratinjau kalibrasi');preview.onclick=async()=>{try{const blob=await(await get('calibration-label-preview.png')).blob();if(!active())return;if(sheetUrl)URL.revokeObjectURL(sheetUrl);sheetUrl=URL.createObjectURL(blob);const dialog=el('dialog'),close=el('button','Tutup pratinjau'),img=el('img');dialog.style.cssText='width:96vw;max-width:1600px;max-height:95vh;overflow:auto';img.src=sheetUrl;img.alt='Citra asli pada titik pengguna: magenta manual, jingga usulan otomatis pada ambang utama';img.style.cssText='max-width:100%;height:auto';close.onclick=()=>dialog.close();dialog.append(close,el('p',img.alt+'; bukan hitungan acuan lengkap.'),img);panel.append(dialog);dialog.showModal();}catch(error){if(active())status.textContent=error.message;}};panel.append(preview);}host.append(panel);
    }
    const detailPath=manifest.block_details?.A;
    if(detailPath&&manifest.files.includes(detailPath)){
      const button=el('button','Analisis detail per gawangan'),panel=el('div');panel.hidden=true;host.append(button,panel);
      button.onclick=async()=>{button.disabled=true;try{
        const data=await(await api(base+'/files/'+detailPath)).json();if(!active())return;
        if(data.schema!=='dayun-block-detail-v1'||data.source_run!==manifest.run||data.block!=='A')throw Error('Sumber analisis detail tidak sesuai.');
        diagnosticData=data;panel.replaceChildren();panel.hidden=false;
        panel.append(el('p','Analisis resolusi asli: '+data.cell_count.toLocaleString('id-ID')+' petak; '+data.review_cell_count.toLocaleString('id-ID')+' lokasi perlu ditinjau. Vegetasi RGB mencakup gulma, pohon dan nanas. Sedikit vegetasi bukan bukti nanas mati atau celah barisan.'));
        if(data.local_trial_summary)panel.append(el('p',data.local_trial_summary));
        const toggle=el('button','Tampilkan petak pemeriksaan');toggle.onclick=async()=>{try{if(!diagnosticCells)diagnosticCells=await(await get('detail-cells.geojson')).json();if(!active())return;showDiagnostics=!showDiagnostics;toggle.textContent=showDiagnostics?'Sembunyikan petak pemeriksaan':'Tampilkan petak pemeriksaan';drawDiagnostics();}catch(error){if(active())status.textContent=error.message;}};panel.append(toggle);
        const table=el('table'),head=el('tr');['Gawangan','Luas polygon m²','Cakupan citra','Vegetasi RGB (bukan nanas)','Piksel gelap','Petak perlu ditinjau','Sampel native'].forEach(v=>head.append(el('th',v)));table.append(head);
        const pct=v=>v==null?'Belum tersedia':(100*v).toFixed(1)+'%';
        for(const row of data.zones){const tr=el('tr');[row.zone_id,row.polygon_area_m2.toFixed(1),pct(row.coverage_fraction),pct(row.vegetation_proxy_fraction),pct(row.dark_fraction),row.review_cells].forEach(v=>tr.append(el('td',String(v))));
          const cell=el('td');if(row.sample_sheet){const inspect=el('button','Lihat '+row.zone_id);inspect.onclick=async()=>{try{const blob=await(await get(row.sample_sheet)).blob();if(!active())return;if(sheetUrl)URL.revokeObjectURL(sheetUrl);sheetUrl=URL.createObjectURL(blob);preview.src=sheetUrl;preview.alt='Sampel native '+row.zone_id+': vegetasi rendah, median, tinggi; belum tervalidasi jenis tanaman';preview.hidden=false;sampleActions.replaceChildren();
            for(const sample of data.samples.filter(s=>s.zone_id===row.zone_id)){const nativeButton=el('button','Buka TIFF '+sample.stratum);nativeButton.onclick=async()=>{try{const blob=await(await get(sample.native_tile)).blob();if(active()){dialog.close();await openRaster(blob,{title:row.zone_id+' / '+sample.stratum+' / '+sample.native_tile,nativeReview:true});}}catch(error){if(active())status.textContent=error.message;}};sampleActions.append(nativeButton);}
            if(!dialog.open)dialog.showModal();select.value=row.zone_id;select.onchange();status.textContent='Sampel 512 piksel pada resolusi asli. Citra di sekitar petak dapat mencakup gawangan lain. Pemilihan berdasarkan vegetasi RGB; belum menjadi validasi hitung nanas.';}catch(error){if(active())status.textContent=error.message;}};cell.append(inspect);}tr.append(cell);table.append(tr);}
        const preview=el('img');preview.hidden=true;preview.setAttribute('style','max-width:100%;height:auto');
        const dialog=el('dialog'),close=el('button','Tutup sampel'),sampleActions=el('div');dialog.setAttribute('style','width:96vw;max-width:1600px;max-height:95vh;overflow:auto');close.onclick=()=>dialog.close();dialog.append(close,el('p','Sampel native: vegetasi RGB rendah / median / tinggi. Bukan klasifikasi nanas. Gunakan Buka TIFF untuk memeriksa detail berkoordinat.'),preview,sampleActions);panel.append(table,dialog);
        for(const [file,label] of [['detail-gawangan.csv','Unduh tabel analisis detail'],['detail-trial.json','Unduh uji pola tajuk lokal']]){if(!listed(file))continue;const download=el('button',label);download.onclick=async()=>{try{const blob=await(await get(file)).blob();if(active())save(blob,file);}catch(error){if(active())status.textContent=error.message;}};panel.append(download);}
        data.limitations.forEach(v=>panel.append(el('p',v)));
      }catch(error){if(active())status.textContent=error.message;}finally{if(active())button.disabled=false;}};
    }
    for(const [file,label] of [[result.analysis_report,'Unduh laporan analisis'],[result.candidate_inspection,'Unduh lembar pemeriksaan kandidat']]){
      if(file&&listed(file)){const button=el('button',label);button.onclick=async()=>{try{const blob=await(await get(file)).blob();if(active())save(blob,file);}catch(error){if(active())status.textContent=error.message;}};host.append(button);}
    }
    const referencePath=manifest.block_comparisons?.A;
    if(referencePath&&manifest.files.includes(referencePath)){
      try{
        const ref=await(await api(base+'/files/'+referencePath)).json();if(!current()){map.removeLayer(group);map.removeLayer(points);map.removeLayer(diagnostics);return()=>{};}
        if(ref.schema!=='dayun-ortho-database-comparison-v1'||ref.source_run!==manifest.run||ref.block!=='A')throw Error('Pembanding database bukan untuk citra ini.');
        const panel=el('section'),heading=el('h2','Pembanding database per gawangan — Blok A');panel.append(heading);if(comparisonHost!==host)comparisonHost.replaceChildren();comparisonHost.hidden=false;
        const jump=el('button','Lihat data pembanding di bawah peta');jump.onclick=()=>{onShowComparison?.();comparisonHost.scrollIntoView?.({behavior:'smooth',block:'start'});};host.append(jump);
        panel.append(el('p','Data sumber: '+(ref.database_updated_at||'tanggal belum tersedia')+'. Monitoring: '+(ref.provenance?.monitoring_snapshot_at||'tanggal belum tersedia')+'. Angka sumber, tambahan ditanam, sensus hidup dan stok bibit berbeda. Pecahan dipertahankan; kandidat citra bukan jumlah nanas. '+(ref.flight_date?'Tanggal terbang '+ref.flight_date+' menurut pemilik; umur berbasis bulan tanam adalah perkiraan.':'Umur saat terbang belum dapat dihitung.')));
        teamSummary=el('p','Memuat koreksi tim privat…');teamSummary.setAttribute('role','status');panel.append(teamSummary);
        const comparison=el('table'),header=el('tr');['Gawangan','Bulan tanam awal / tambahan','Umur awal saat terbang (±bulan)','Nanas awal (sumber)','Tambahan ditanam','Total tercatat awal + tambahan','Sensus hidup terpublikasi','Stok bibit (belum ditanam)','MPTS: sumber & bulan tanam','Kandidat otomatis awal','Tambahan titik tim','Titik ditolak','Diterima tim','Hitungan kerja, belum tervalidasi','Periksa / edit'].forEach(v=>header.append(el('th',v)));comparison.append(header);
        const num=v=>v===null||v===undefined?'Belum tersedia':Number(v).toLocaleString('id-ID',{maximumFractionDigits:3});
        for(const r of ref.rows){const row=el('tr');const periods=[r.pineapple_planting_period,...(r.pineapple_cohorts||[]).map(c=>c.period+': '+num(c.plantedCount)+(c.age_at_flight_months!=null?' (±'+c.age_at_flight_months+' bulan)':''))].filter(Boolean).join('; ');const trees=(r.mpts||[]).map(c=>c.species+': '+num(c.source_count)+' ('+(c.planting_period||'bulan belum tersedia')+')').join('; ');
          [r.gawangan,r.database_match?(periods||'Belum tersedia'):'Tidak ada padanan ID database',num(r.age_at_flight_months),num(r.pineapple_source_initial)+(r.source_matches_spacing_capacity?' · cocok kapasitas jarak tanam':''),num(r.pineapple_added_planted),num(r.pineapple_total_recorded),num(r.pineapple_living_census)+(r.pineapple_census_period?' · '+r.pineapple_census_period:''),num(r.seedling_stock),trees||'Belum tersedia',num(r.image_candidates)].forEach(v=>row.append(el('td',v)));
          const cells=[0,0,0,r.image_candidates].map(v=>el('td',num(v)));reviewCells.set(r.gawangan,cells);row.append(...cells);const action=el('td'),edit=el('button','Edit titik '+r.gawangan);edit.onclick=async()=>{onEditMap?.();if(!candidates)await show();if(!active())return;select.value=r.gawangan;select.onchange();editor?.setEditing(true);};action.append(edit);row.append(action);comparison.append(row);
        }
        const wrap=el('div');wrap.className='table-wrap';wrap.append(comparison);panel.append(wrap);const csv=referencePath.replace(/\.json$/,'.csv');if(manifest.files.includes(csv)){const button=el('button','Unduh pembanding database');button.onclick=async()=>{try{const blob=await(await api(base+'/files/'+csv)).blob();if(active())save(blob,'dayun-blok-A-pembanding-database.csv');}catch(error){if(active())status.textContent=error.message;}};panel.append(button);}comparisonHost.append(panel);
      }catch(error){if(current())host.append(el('p','Pembanding belum dapat dimuat: '+error.message));}
    }
    function drawDiagnostics(){diagnostics.clearLayers();if(!active()||!showDiagnostics||!diagnosticData||!diagnosticCells)return;if(map.getZoom()<20){status.textContent='Perbesar peta untuk melihat petak pemeriksaan. Jingga: sedikit vegetasi RGB; ungu: piksel gelap. Keduanya perlu diperiksa, bukan diagnosis tanaman.';return;}
      const view=map.getBounds();const features=diagnosticCells.features.filter(f=>f.properties.flags.length&&(!select.value||f.properties.zone_id===select.value)&&L.geoJSON(f).getBounds().intersects(view)).slice(0,1000);
      L.geoJSON({type:'FeatureCollection',features},{style:f=>({color:f.properties.flags.includes('dark_pixels_review')?'#5e4aa3':'#dc702c',weight:1,fillOpacity:.12}),onEachFeature:(f,l)=>l.bindTooltip(f.properties.zone_id+' · '+f.properties.flags.join(', ')+' · perlu pemeriksaan; bukan diagnosis')}).addTo(diagnostics);
    }
    function drawPoints(){points.clearLayers();if(!active()||!candidates||map.getZoom()<(result.full_block_count?17:22))return;const b=map.getBounds();let count=0;
      for(const f of editor?editor.features():candidates.features){if(select.value&&!f.properties.zones.includes(select.value))continue;const [x,y]=f.geometry.coordinates;if(!b.contains([y,x]))continue;if(count++>=3000)break;
        const p=f.properties,color=p.status==='rejected'?'#c72d40':p.origin==='manual_addition'?'#2563eb':p.status==='accepted'?'#137f63':'#df8e00';
        L.circleMarker([y,x],{radius:map.getZoom()<20?2:map.getZoom()<22?3:4,color,weight:1,fillOpacity:.65,bubblingMouseEvents:false}).bindTooltip(p.id+' · '+(p.status||'belum diperiksa')).on('click',()=>{if(editor?.isEditing())editor.pick(f);else status.textContent=p.id+' · '+(p.status||'kandidat belum tervalidasi')+' · '+p.zones.join(', ');}).addTo(points);
      }
    }
    async function show(){if(!active()||loading)return;loading=true;open.disabled=true;status.textContent='Membuka citra Blok A dan audit batas privat…';
      try{const [zones,crown,audit,image]=await Promise.all([(await get('zones.geojson')).json(),(await get('candidates.geojson')).json(),(await get('boundary-audit.geojson')).json(),(await get(result.overview)).blob()]);if(!active())return;
        group.clearLayers();if(url)URL.revokeObjectURL(url);url=URL.createObjectURL(image);const b=result.bounds;L.imageOverlay(url,[[b[1],b[0]],[b[3],b[2]]]).addTo(group);
        geo=L.geoJSON(zones,{style:f=>({color:f.properties.kind==='active_source'?'#137f63':'#ad6b32',weight:2,fillOpacity:.03}),onEachFeature:(f,l)=>l.bindTooltip(f.properties.id+' · '+f.properties.candidate_crowns+' kandidat belum tervalidasi')}).addTo(group);
        L.geoJSON(audit,{style:{color:'#c72d40',weight:3,fillOpacity:.35},onEachFeature:(f,l)=>l.bindTooltip(f.properties.zone_a+' / '+f.properties.zone_b+' · periksa batas')}).addTo(group);
        candidates=crown;zonesData=zones;map.fitBounds(geo.getBounds());editor?.refresh();drawPoints();status.textContent='Blok A terbuka. Perbesar peta untuk kandidat; aktifkan edit untuk menambah atau mengoreksi titik. Jingga: belum diperiksa, hijau: diterima, merah: ditolak, biru: tambahan tim. Asosiasi gawangan mati sementara.';
      }catch(error){if(active())status.textContent=error.message;}finally{loading=false;if(active())open.disabled=false;}
    }
    open.onclick=show;
    select.onchange=()=>{if(!active()||!geo)return;const selected=geo.getLayers().filter(l=>!select.value||l.feature.properties.id===select.value);const layer=L.featureGroup(selected);map.fitBounds(layer.getBounds());drawPoints();drawDiagnostics();};
    native.onclick=()=>{detail=!detail;native.textContent=detail?'Batal memilih detail citra':'Periksa citra asli di titik peta';status.textContent=detail?'Klik lokasi pada peta untuk membuka TIFF native di lokasi tersebut.':'Pemilihan detail dibatalkan.';};
    const contains=(c,b)=>b&&c[0]>=b[0]&&c[0]<=b[2]&&c[1]>=b[1]&&c[1]<=b[3];
    async function inspectAt(c){const tile=result.native_tiles.find(t=>contains(c,t.bounds));if(!tile)throw Error('Lokasi ini di luar potongan citra Blok A.');const request=++nativeRequest;const blob=await(await get(tile.file)).blob();if(!active()||request!==nativeRequest)return false;await openRaster(blob,{title:'Blok A / '+tile.file,nativeReview:true,preserveView:true});if(!active()||request!==nativeRequest)return false;nativeBounds=tile.bounds;map.setView([c[1],c[0]],Math.max(23,map.getZoom()));status.textContent='Citra asli terbuka. Klik pusat nanas untuk menambah titik; batas sumber tetap utuh.';return true;}
    const click=async event=>{if(!active()||!detail||loading)return;detail=false;native.textContent='Periksa citra asli di titik peta';try{await inspectAt([event.latlng.lng,event.latlng.lat]);}catch(error){if(active())status.textContent=error.message;}};
    download.onclick=async()=>{try{const blob=await(await get('gawangan.csv')).blob();if(active())save(blob,'dayun-blok-A-kandidat.csv');}catch(error){if(active())status.textContent=error.message;}};
    auditDownload.onclick=async()=>{try{const blob=await(await get('boundary-audit.geojson')).blob();if(active())save(blob,'dayun-blok-A-periksa-batas.geojson');}catch(error){if(active())status.textContent=error.message;}};
    map.on('moveend zoomend',drawPoints);map.on('moveend zoomend',drawDiagnostics);map.on('click',click);
    if(window.YG_DAYUN_BLOCK_EDIT&&active()){const editHost=el('section');editHost.className='block-editor';host.insertBefore(editHost,summary);editor=await window.YG_DAYUN_BLOCK_EDIT.mount({host:editHost,map,api,base,manifest,result,analysisPath:path,getCandidates:()=>candidates,getZones:()=>zonesData,onChanged:updateReview,preparePoint:async c=>{if(contains(c,nativeBounds))return true;await inspectAt(c);return false;},onInspect:inspectAt,current:active,save});if(!active())editor.dispose();}
    if(autoOpen&&active()){onAutoOpen?.();await show();}
    const dispose=()=>{disposed=true;nativeRequest++;editor?.dispose();map.off('moveend zoomend',drawPoints);map.off('moveend zoomend',drawDiagnostics);map.off('click',click);map.removeLayer(group);map.removeLayer(points);map.removeLayer(diagnostics);if(url)URL.revokeObjectURL(url);if(sheetUrl)URL.revokeObjectURL(sheetUrl);host.replaceChildren();host.hidden=true;if(comparisonHost!==host){comparisonHost.replaceChildren();comparisonHost.hidden=true;}};dispose.canLeave=()=>editor?.canLeave()??true;return dispose;
  }
  root.YG_DAYUN_BLOCK={mount};
})(window);
