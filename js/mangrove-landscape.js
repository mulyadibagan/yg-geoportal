(function(){
  'use strict';
  const fmt=(value,digits=2)=>new Intl.NumberFormat('id-ID',{minimumFractionDigits:digits,maximumFractionDigits:digits}).format(Number(value||0));
  const safe=value=>String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
  const state={data:null,map:null,markers:new Map(),selected:null};
  const cards=document.getElementById('klm-cards');
  const status=document.getElementById('klm-map-status');
  const baseline=document.getElementById('klm-baseline');
  const balance=document.getElementById('transition-balance');
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
    cards.innerHTML=klms.map(klm=>`<button type="button" class="klm-card" data-klm="${safe(klm.code)}" style="--klm-color:${safe(klm.color)}"><header><div><small>KLM ${safe(klm.code)}</small><strong>${safe(klm.name.replace(/^KLM\s+/i,''))}</strong></div><b>Fokus peta</b></header><div class="klm-card-stats"><span><strong>${fmt(klm.initial_lindung_ha)} ha</strong>Lindung awal</span><span class="paired"><strong>+${fmt(klm.budidaya_to_lindung_true_ha)} ha</strong>Irisan budidaya dengan TRUE</span><span><strong>+${fmt(klm.additional_true_from_unclassified_ha)} ha</strong>Dari belum terklasifikasi</span><span><strong>${fmt(klm.validated_true_ha)} ha</strong>Lindung indikatif TRUE</span><span><strong>${fmt(klm.initial_budidaya_ha)} ha</strong>Budidaya awal</span><span class="paired"><strong>−${fmt(klm.budidaya_to_lindung_true_ha)} ha</strong>Pengurangan baseline budidaya</span><span><strong>${fmt(klm.budidaya_remaining_after_true_ha)} ha</strong>Sisa baseline budidaya</span><span><strong>${fmt(klm.budidaya_review_exposure_ha)} ha</strong>Budidaya dalam REVIEW</span></div><div class="klm-bar"><i style="width:${Math.min(100,klm.validated_true_percent)}%"></i></div></button>`).join('');
    cards.addEventListener('click',event=>{const button=event.target.closest('[data-klm]');if(!button)return;const klm=klms.find(item=>item.code===button.dataset.klm);if(klm)focusKlm(klm)});
  }

  function renderBaseline(data){
    baseline.innerHTML=`<article><span>Jumlah KLM sumber</span><strong>${data.klms.length}</strong><small>14.01 · 14.02 · 14.03</small></article><article><span>Total luas KLM sumber</span><strong>${fmt(data.totals.klm_source_total_area_ha)} ha</strong><small>luas atribut dataset KLM</small></article><article><span>Mangrove di dalam KLM</span><strong>${fmt(data.totals.inside_source_klm_area_ha)} ha</strong><small>${fmt(data.totals.inside_source_klm_percent)}% mangrove Riau</small></article><article><span>Di luar tiga KLM</span><strong>${fmt(data.totals.outside_source_klm_area_ha)} ha</strong><small>tidak dipaksakan masuk klaster</small></article>`;
  }

  function renderBalance(total){
    balance.innerHTML=`<article class="balance-side protection"><p class="eyebrow">NERACA FUNGSI LINDUNG INDIKATIF</p><div><span><small>Awal RPPEM</small><strong>${fmt(total.initial_lindung_ha)} ha</strong><em>${fmt(total.initial_percent)}%</em></span><b>+</b><span><small>Irisan budidaya dengan TRUE</small><strong>${fmt(total.budidaya_to_lindung_true_ha)} ha</strong><em>+ ${fmt(total.additional_true_from_unclassified_ha)} ha dari area belum terklasifikasi</em></span><b>=</b><span><small>Lindung indikatif TRUE</small><strong>${fmt(total.validated_true_ha)} ha</strong><em>${fmt(total.validated_true_percent)}%</em></span></div></article><article class="balance-side cultivation"><p class="eyebrow">NERACA BASELINE BUDIDAYA</p><div><span><small>Budidaya awal</small><strong>${fmt(total.initial_budidaya_ha)} ha</strong><em>${fmt(total.initial_budidaya_percent)}%</em></span><b>−</b><span><small>Irisan dengan indikasi TRUE</small><strong>${fmt(total.budidaya_to_lindung_true_ha)} ha</strong><em>${fmt(total.budidaya_reduction_true_percent_of_initial)}% dari awal</em></span><b>=</b><span><small>Sisa setelah overlay TRUE</small><strong>${fmt(total.budidaya_remaining_after_true_ha)} ha</strong><em>belum menjadi penetapan</em></span></div><p class="balance-review">REVIEW terpisah: ${fmt(total.budidaya_review_exposure_ha)} ha baseline budidaya masih memerlukan verifikasi.</p></article><p class="balance-explainer"><strong>Rekonsiliasi:</strong> overlay TRUE mengidentifikasi ${fmt(total.budidaya_to_lindung_true_ha)} ha baseline budidaya yang beririsan dengan indikasi fungsi lindung. Dalam neraca analitis, luas yang sama ditambahkan pada fungsi lindung indikatif dan dikurangkan dari baseline budidaya. Total tambahan lindung ${fmt(total.additional_true_beyond_initial_ha)} ha juga mencakup ${fmt(total.additional_true_from_unclassified_ha)} ha dari area awal belum terklasifikasi. Perhitungan ini bukan perubahan fungsi resmi.</p>`;
  }

  function renderRegencies(regencies){
    regencyBody.innerHTML=regencies.map(row=>`<tr><th>${safe(row.name)}</th><td>${fmt(row.mangrove_area_ha)} ha</td><td>${fmt(row.initial_lindung_ha)} ha<br><small>${fmt(row.initial_percent)}%</small></td><td class="positive paired">+${fmt(row.budidaya_to_lindung_true_ha)} ha</td><td class="positive">+${fmt(row.additional_true_from_unclassified_ha)} ha</td><td>${fmt(row.validated_true_ha)} ha<br><small>${fmt(row.validated_true_percent)}%</small></td><td>${fmt(row.initial_budidaya_ha)} ha</td><td class="negative paired">−${fmt(row.budidaya_to_lindung_true_ha)} ha</td><td>${fmt(row.budidaya_remaining_after_true_ha)} ha</td><td class="review-cell">${fmt(row.budidaya_review_exposure_ha)} ha</td></tr>`).join('');
  }

  async function init(){
    if(!window.L){status.textContent='Peta belum dapat dimuat';return}
    try{
      const response=await fetch('data/mangrove-klm-summary.json?v=20260827-functions2',{cache:'no-store'});
      if(!response.ok)throw new Error('Ringkasan KLM tidak tersedia');
      state.data=await response.json();
      state.map=L.map('klm-map',{zoomControl:true,minZoom:6,maxZoom:13});
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'}).addTo(state.map);
      const bounds=state.data.image.bounds;
      const overlays={};
      state.data.function_layers.forEach(item=>{
        const layer=L.imageOverlay(item.path,bounds,{opacity:1,interactive:false});
        overlays[item.label]=layer;
        if(item.visible)layer.addTo(state.map);
      });
      const boundaryLayer=L.imageOverlay(`${state.data.image.path}?v=20260827-neutral1`,bounds,{opacity:.92,interactive:false}).addTo(state.map);
      overlays['Batas KLM sumber']=boundaryLayer;
      L.control.layers(null,overlays,{collapsed:true,position:'topright'}).addTo(state.map);
      functionLegend.innerHTML=`<b>POLIGON FUNGSI INDIKATIF</b>${state.data.function_layers.map(item=>`<span><i style="background:${safe(item.color)}"></i>${safe(item.label)}</span>`).join('')}<small>Gunakan kontrol layer untuk menyalakan atau mematikan poligon.</small>`;
      state.map.fitBounds(bounds,{padding:[12,12]});
      state.data.klms.forEach(klm=>{
        const marker=L.circleMarker(klm.label_point,{radius:7,color:'#fff',weight:2,fillColor:'#073f3b',fillOpacity:1}).addTo(state.map).bindTooltip(klm.name.replace(/^KLM\s+/i,''),{permanent:true,direction:'top',className:'klm-label',offset:[0,-7]});
        marker.on('click',()=>focusKlm(klm));
        state.markers.set(klm.code,marker);
      });
      renderCards(state.data.klms);
      renderBaseline(state.data);
      renderBalance(state.data.totals);
      renderRegencies(state.data.regencies);
      selectKlm(state.data.klms[0]);
      status.textContent=`3 KLM sumber · ${fmt(state.data.totals.inside_source_klm_percent)}% mangrove Riau beririsan`;
      document.getElementById('klm-reconciliation').textContent=`Sebanyak ${fmt(state.data.totals.outside_source_klm_area_ha)} ha (${fmt(100-state.data.totals.inside_source_klm_percent)}%) unit mangrove berada di luar tiga poligon KLM sumber dan tidak dipaksakan masuk ke KLM mana pun.`;
    }catch(error){
      console.warn(error);
      status.textContent='Peta KLM belum dapat dimuat';
      cards.innerHTML='<article class="klm-loading">Ringkasan KLM belum tersedia. Muat ulang halaman untuk mencoba kembali.</article>';
    }
  }
  init();
})();
