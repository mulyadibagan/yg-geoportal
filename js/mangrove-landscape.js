(function(){
  'use strict';
  const fmt=(value,digits=2)=>new Intl.NumberFormat('id-ID',{minimumFractionDigits:digits,maximumFractionDigits:digits}).format(Number(value||0));
  const safe=value=>String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
  const state={data:null,map:null,markers:new Map(),selected:null};
  const cards=document.getElementById('klm-cards');
  const status=document.getElementById('klm-map-status');
  const baseline=document.getElementById('klm-baseline');
  const regencyBody=document.getElementById('regency-transition-body');
  const functionLegend=document.getElementById('function-map-legend');

  function selectKlm(klm){
    state.selected=klm.code;
    document.querySelectorAll('.klm-card').forEach(card=>card.classList.toggle('is-active',card.dataset.klm===klm.code));
  }

  function focusKlm(klm){
    const [west,south,east,north]=klm.bbox;
    state.map.fitBounds([[south,west],[north,east]],{padding:[25,25],maxZoom:10});
    selectKlm(klm);
    const marker=state.markers.get(klm.code);
    if(marker)marker.openTooltip();
  }

  function renderCards(klms){
    cards.innerHTML=klms.map(klm=>`<button type="button" class="klm-card" data-klm="${safe(klm.code)}" style="--klm-color:${safe(klm.color)}"><header><div><small>KLM ${safe(klm.code)}</small><strong>${safe(klm.name.replace(/^KLM\s+/i,''))}</strong></div><b>Fokus peta</b></header><div class="klm-card-stats"><span class="total"><strong>${fmt(klm.mangrove_area_ha)} ha</strong>Mangrove referensi</span><span><strong>${fmt(klm.initial_lindung_ha)} ha</strong>Lindung sumber · ${fmt(klm.initial_percent)}%</span><span><strong>${fmt(klm.indicative_lindung_ha)} ha</strong>Lindung indikatif · ${fmt(klm.indicative_lindung_percent)}%</span><span><strong>${fmt(klm.initial_budidaya_ha)} ha</strong>Budidaya sumber · ${fmt(klm.initial_budidaya_percent)}%</span><span><strong>${fmt(klm.indicative_budidaya_ha)} ha</strong>Budidaya indikatif · ${fmt(klm.indicative_budidaya_percent)}%</span></div><div class="klm-bar"><i style="width:${Math.min(100,klm.indicative_lindung_percent)}%"></i></div></button>`).join('');
    cards.addEventListener('click',event=>{const button=event.target.closest('[data-klm]');if(!button)return;const klm=klms.find(item=>item.code===button.dataset.klm);if(klm)focusKlm(klm)});
  }

  function renderBaseline(data){
    const mangroveShareOfKlm=data.totals.klm_source_total_area_ha?data.totals.inside_source_klm_area_ha/data.totals.klm_source_total_area_ha*100:0;
    baseline.innerHTML=`<article><span>Jumlah KLM</span><strong>${data.klms.length}</strong><small>kode 14.01 · 14.02 · 14.03</small></article><article><span>Total luas tiga KLM</span><strong>${fmt(data.totals.klm_source_total_area_ha)} ha</strong><small>seluruh bentang lanskap dalam batas sumber</small></article><article><span>Mangrove referensi di dalam KLM</span><strong>${fmt(data.totals.inside_source_klm_area_ha)} ha</strong><small>${fmt(mangroveShareOfKlm)}% dari total luas tiga KLM</small></article>`;
  }

  function renderOverview(data){
    const riau=data.statewide;
    document.getElementById('overview-source-lindung').textContent=`${fmt(riau.initial_lindung_ha)} ha`;
    document.getElementById('overview-source-lindung-percent').textContent=`${fmt(riau.initial_percent)}% dari mangrove referensi`;
    document.getElementById('overview-source-budidaya').textContent=`${fmt(riau.initial_budidaya_ha)} ha`;
    document.getElementById('overview-source-budidaya-percent').textContent=`${fmt(riau.initial_budidaya_percent)}% dari mangrove referensi`;
    document.getElementById('overview-indicative-lindung').textContent=`${fmt(riau.indicative_lindung_ha)} ha`;
    document.getElementById('overview-indicative-lindung-percent').textContent=`${fmt(riau.indicative_lindung_percent)}% · TRUE + skenario REVIEW`;
    document.getElementById('overview-indicative-budidaya').textContent=`${fmt(riau.indicative_budidaya_ha)} ha`;
    document.getElementById('overview-indicative-budidaya-percent').textContent=`${fmt(riau.indicative_budidaya_percent)}% · hasil indikatif`;
  }

  function renderRegencies(regencies){
    regencyBody.innerHTML=regencies.map(row=>`<tr><th>${safe(row.name)}</th><td>${fmt(row.mangrove_area_ha)} ha</td><td>${fmt(row.initial_lindung_ha)} ha<br><small>${fmt(row.initial_percent)}%</small></td><td class="analysis-value">${fmt(row.indicative_lindung_ha)} ha<br><small>${fmt(row.indicative_lindung_percent)}%</small></td><td>${fmt(row.initial_budidaya_ha)} ha<br><small>${fmt(row.initial_budidaya_percent)}%</small></td><td class="analysis-value">${fmt(row.indicative_budidaya_ha)} ha<br><small>${fmt(row.indicative_budidaya_percent)}%</small></td></tr>`).join('');
  }

  async function init(){
    if(!window.L){status.textContent='Peta belum dapat dimuat';return}
    try{
      const response=await fetch('data/mangrove-klm-summary.json?v=20260827-reviewscenario1',{cache:'no-store'});
      if(!response.ok)throw new Error('Ringkasan KLM tidak tersedia');
      state.data=await response.json();
      state.map=L.map('klm-map',{zoomControl:true,minZoom:6,maxZoom:18});
      state.map.createPane('klmBoundaryPane');
      state.map.getPane('klmBoundaryPane').style.zIndex=620;
      state.map.getPane('klmBoundaryPane').style.pointerEvents='none';
      state.map.createPane('labelsPane');
      state.map.getPane('labelsPane').style.zIndex=650;
      state.map.getPane('labelsPane').style.pointerEvents='none';
      const satellite=L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:18,attribution:'Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community'}).addTo(state.map);
      const streets=L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'});
      const placeLabels=L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',{maxZoom:18,pane:'labelsPane',attribution:'Labels &copy; Esri'}).addTo(state.map);
      const bounds=state.data.image.bounds;
      const overlays={};
      state.data.function_layers.forEach(item=>{
        const images=(item.images||[{path:item.path,bounds}]).map(image=>L.imageOverlay(`${image.path}?v=20260827-reviewscenario1`,image.bounds||bounds,{opacity:1,interactive:false}));
        const layer=L.layerGroup(images);
        overlays[item.label]=layer;
        if(item.visible)layer.addTo(state.map);
      });
      const boundaryConfig=state.data.boundary_layer||{};
      let boundaryLayer;
      if(boundaryConfig.vector_path){
        const boundaryResponse=await fetch(`${boundaryConfig.vector_path}?v=20260827-purplevector1`,{cache:'no-store'});
        if(!boundaryResponse.ok)throw new Error('Batas KLM tidak tersedia');
        boundaryLayer=L.geoJSON(await boundaryResponse.json(),{pane:'klmBoundaryPane',interactive:false,style:{color:boundaryConfig.color||'#7c3aed',weight:Number(boundaryConfig.weight||1.25),opacity:.95,fill:false,lineCap:'round',lineJoin:'round'}}).addTo(state.map);
      }else{
        const boundaryImages=(boundaryConfig.images||[{path:state.data.image.path,bounds}]).map(image=>L.imageOverlay(`${image.path}?v=20260827-klmboundary2`,image.bounds||bounds,{opacity:1,interactive:false,pane:'klmBoundaryPane'}));
        boundaryLayer=L.layerGroup(boundaryImages).addTo(state.map);
      }
      overlays[boundaryConfig.label||'Batas KLM sumber']=boundaryLayer;
      overlays['Label tempat']=placeLabels;
      L.control.layers({'Citra satelit':satellite,'Peta jalan':streets},overlays,{collapsed:true,position:'topright'}).addTo(state.map);
      functionLegend.innerHTML=`<b>POLIGON FUNGSI INDIKATIF</b>${state.data.function_layers.map(item=>`<span><i style="background:${safe(item.color)}"></i>${safe(item.label)}</span>`).join('')}<span class="boundary-key"><i style="border-top-color:${safe(boundaryConfig.color||'#7c3aed')}"></i>${safe(boundaryConfig.label||'Batas KLM sumber')}</span><small>Hijau menunjukkan lindung indikatif, jingga menunjukkan budidaya indikatif, dan garis ungu tipis menunjukkan batas KLM.</small>`;
      state.map.fitBounds(bounds,{padding:[12,12]});
      state.data.klms.forEach(klm=>{
        const marker=L.circleMarker(klm.label_point,{radius:7,color:'#fff',weight:2,fillColor:'#073f3b',fillOpacity:1}).addTo(state.map).bindTooltip(klm.name.replace(/^KLM\s+/i,''),{permanent:true,direction:'top',className:'klm-label',offset:[0,-7]});
        marker.on('click',()=>focusKlm(klm));
        state.markers.set(klm.code,marker);
      });
      renderCards(state.data.klms);
      renderBaseline(state.data);
      renderOverview(state.data);
      renderRegencies(state.data.regencies);
      selectKlm(state.data.klms[0]);
      status.textContent=`Analisis dibatasi pada 3 KLM · zoom hingga level 18`;
      document.getElementById('klm-reconciliation').textContent=`Peta dan kartu KLM memakai area di dalam tiga batas KLM. Ringkasan Riau dan tabel kabupaten/kota memakai seluruh mangrove referensi Riau, termasuk ${fmt(state.data.totals.outside_source_klm_area_ha)} ha yang berada di luar gabungan tiga KLM.`;
    }catch(error){
      console.warn(error);
      status.textContent='Peta KLM belum dapat dimuat';
      cards.innerHTML='<article class="klm-loading">Ringkasan KLM belum tersedia. Muat ulang halaman untuk mencoba kembali.</article>';
    }
  }
  init();
})();
