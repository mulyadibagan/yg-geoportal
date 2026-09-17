(function(){
  'use strict';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const number=n=>Number(n).toLocaleString('id-ID',{minimumFractionDigits:2,maximumFractionDigits:2});
  const ha=n=>number(n)+' ha';
  window.renderMonthlyInternal=function(map,month,report,burned,pbph,rspo,control){
    const session=window.YG_STAFF_DATA.session();
    if(!session)return Promise.resolve();
    const panel=document.createElement('section');panel.className='fm-panel';panel.style.marginBottom='24px';panel.id='fm-internal-burned';
    panel.innerHTML='<h2>Estimasi luas kebakaran dalam PBPH dan perkebunan</h2><p>Analisis internal · <span id="fm-internal-progress" role="status">Menghitung irisan poligon…</span></p>';
    document.querySelector('.fm-tables').before(panel);
    const status=panel.querySelector('#fm-internal-progress');
    if(!burned){status.textContent='Arsip estimasi belum tersedia. Luas tidak dapat dihitung; bukan berarti nol kebakaran.';return Promise.resolve();}
    let worker;
    return new Promise((resolve,reject)=>{
      worker=new Worker('js/fire-internal-worker.js?v=20260917-1');
      worker.onmessage=e=>e.data.ok?resolve(e.data.result):reject(Error(e.data.error));
      worker.onerror=()=>reject(Error('Perhitungan belum dapat dijalankan. Silakan muat ulang laporan.'));
      worker.postMessage({burned,pbph,rspo,report:{hotspots:report.hotspots||[],unavailable:report.unavailable}});
    }).then(result=>{
      if(window.YG_STAFF_DATA.session()?.token!==session.token){panel.remove();return;}
      const layers=[];
      const cleanup=()=>{layers.forEach(l=>{map.removeLayer(l);control.removeLayer(l);});panel.remove();};
      const timer=setInterval(()=>{if(window.YG_STAFF_DATA.session()?.token!==session.token){clearInterval(timer);cleanup();}},2000);
      window.addEventListener('pagehide',()=>{clearInterval(timer);cleanup();},{once:true});
      status.textContent='Sementara · '+month+' · luas unik gabungan '+ha(result.combinedHa);
      const note=document.createElement('p');note.textContent='Luas dihitung dari irisan poligon estimasi dengan batas referensi yang tersedia, menggunakan UTM zona 47N. Poligon yang bertumpang tindih digabung sebelum luas dihitung. Luas mengikuti bulan deteksi pertama kejadian; hotspot mengikuti tanggal deteksi bulan laporan. Arsip masih parsial: tidak ada irisan belum berarti tidak ada kebakaran. Persentase menggunakan luas poligon referensi, bukan luas izin dalam SK.';panel.append(note);
      if(result.rspo.groupLevel){const p=document.createElement('p');p.textContent='Batas perkebunan yang tersedia mencakup agregat grup anggota RSPO; hasil berlabel grup tidak dapat diartikan sebagai luas per perusahaan atau unit kebun. Cakupan ini belum mewakili seluruh perkebunan sawit Riau.';panel.append(p);}
      const selection=new Map();
      for(const kind of ['pbph','rspo']){
        const category=result[kind],title=kind==='pbph'?'PBPH':(category.groupLevel?'Perkebunan anggota RSPO · grup / unit':'Perkebunan anggota RSPO');
        const section=document.createElement('section');
        section.innerHTML='<h3>'+title+'</h3><p><strong>'+ha(category.uniqueHa)+'</strong> luas irisan unik · '+category.rows.filter(r=>r.burnedHa>0).length+' area dengan irisan · '+category.boundaryCount+' batas dianalisis</p><div class="fm-table-wrap"><table class="fm-table"><thead><tr><th>Nama / batas referensi</th><th>Hotspot / hari</th><th>Estimasi terbakar</th><th>Luas poligon</th><th>Persentase</th><th>Kejadian / peta</th></tr></thead><tbody>'+category.rows.map((r,i)=>{
          const key=kind+'-'+i;
          const link=kind==='pbph'?'<a target="_blank" rel="noopener noreferrer" href="pbph-profile.html?id='+encodeURIComponent(r.id)+'">'+esc(r.name)+'</a>':esc(r.name);
          selection.set(key,r);
          return '<tr><td><strong>'+link+'</strong><br><small>'+esc(r.detail)+(r.level==='group'?' · Agregat grup':'')+'</small></td><td>'+(r.hotspots===null?'Belum tersedia':r.hotspots+' / '+r.days+' hari')+'</td><td>'+(r.burnedHa>0?ha(r.burnedHa):'Tidak ada irisan dalam arsip')+'</td><td>'+ha(r.boundaryHa)+'</td><td>'+number(r.percent||0)+'%</td><td><button type="button" data-fire-area="'+key+'">Lihat peta</button><details><summary>'+r.events.length+' kejadian beririsan</summary>'+r.events.map(e=>'<p><small>'+esc(e.id)+'<br>'+esc(e.first.slice(0,10))+' – '+esc(e.last.slice(0,10))+'</small></p>').join('')+'</details></td></tr>';
        }).join('')+'</tbody></table></div>';
        if(!category.rows.length)section.querySelector('tbody').innerHTML='<tr><td colspan="6">Tidak ada irisan estimasi maupun hotspot pada batas yang tersedia. Arsip estimasi masih parsial.</td></tr>';
        panel.append(section);
        const features=category.rows.filter(r=>r.burnedHa>0).map(r=>({type:'Feature',geometry:r.geometry,properties:{name:r.name,area:r.burnedHa,percent:r.percent}}));
        const layer=L.geoJSON({type:'FeatureCollection',features},{style:{color:kind==='pbph'?'#b66100':'#237b39',weight:2.5,fillOpacity:.6},onEachFeature:(f,l)=>l.bindPopup('<strong>'+esc(f.properties.name)+'</strong><br>Estimasi irisan: '+ha(f.properties.area)+'<br>'+number(f.properties.percent)+'% dari poligon referensi<br><small>Sementara · '+esc(month)+'</small>')}).addTo(map);
        layers.push(layer);control.addOverlay(layer,'Irisan terbakar · '+title);
        const oldRows=document.getElementById(kind==='pbph'?'fm-company-rows':'fm-rspo-rows');if(oldRows)oldRows.closest('article').hidden=true;
        const card=document.getElementById(kind==='pbph'?'fm-companies':'fm-rspo-areas');card.textContent=report.unavailable?'—':category.rows.filter(r=>r.hotspots>0).length;
      }
      document.getElementById('fm-rspo-hotspots').textContent=report.unavailable?'Arsip hotspot belum tersedia':'Area dengan hotspot · batas tersedia';
      // A single selection boundary keeps the map readable and includes areas
      // with burned-area intersections even when there are no hotspot points.
      let focus;
      panel.addEventListener('click',e=>{
        const button=e.target.closest('[data-fire-area]');if(!button)return;
        const row=selection.get(button.dataset.fireArea);if(!row)return;
        if(focus){map.removeLayer(focus);const i=layers.indexOf(focus);if(i>=0)layers.splice(i,1);}
        focus=L.geoJSON({type:'Feature',geometry:row.boundary,properties:{}},{style:{color:'#315bc0',weight:3,dashArray:'6 4',fillOpacity:.04}}).addTo(map);layers.push(focus);
        if(focus.getBounds().isValid())map.fitBounds(focus.getBounds().pad(.1));
        document.getElementById('monthly-fire-map').scrollIntoView({behavior:'smooth',block:'center'});
      });
      const foot=document.createElement('p');foot.textContent='Total tiap kategori dan gabungan dihitung sebagai luas unik. Penjumlahan baris dapat lebih besar jika batas referensi saling tumpang tindih. Hasil menunjukkan lokasi irisan, bukan penyebab kebakaran atau tanggung jawab pihak tertentu.';panel.append(foot);
    }).catch(error=>{status.textContent='Analisis luas belum tersedia: '+error.message;}).finally(()=>{if(worker)worker.terminate();});
  };
})();
