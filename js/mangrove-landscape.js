(function(){
  'use strict';
  const fmt=(value,digits=2)=>new Intl.NumberFormat('id-ID',{minimumFractionDigits:digits,maximumFractionDigits:digits}).format(Number(value||0));
  const safe=value=>String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
  const state={data:null,map:null,markers:new Map(),selected:null};
  const detail=document.getElementById('klm-detail');
  const cards=document.getElementById('klm-cards');
  const status=document.getElementById('klm-map-status');

  function renderDetail(klm){
    state.selected=klm.code;
    detail.innerHTML=`<p class="eyebrow">KLM TERPILIH</p><h3>${safe(klm.name)}</h3><span class="klm-code">KODE ${safe(klm.code)}</span><div class="klm-detail-grid"><div><span>Luas KLM sumber</span><strong>${fmt(klm.source_area_ha)} ha</strong></div><div><span>Mangrove PMN 2025</span><strong>${fmt(klm.mangrove_area_ha)} ha</strong></div><div><span>Fungsi awal RPPEM</span><strong>${fmt(klm.initial_percent)}%</strong></div><div><span>TRUE tervalidasi</span><strong>${fmt(klm.validated_true_percent)}%</strong></div><div><span>TRUE + REVIEW</span><strong>${fmt(klm.true_plus_review_percent)}%</strong></div><div><span>Unit beririsan</span><strong>${new Intl.NumberFormat('id-ID').format(klm.unit_count)}</strong></div></div><p class="klm-detail-note">Tambahan REVIEW ${fmt(klm.review_increment_ha)} ha tetap dipisahkan dari TRUE dan memerlukan verifikasi.</p>`;
    document.querySelectorAll('.klm-card').forEach(card=>card.classList.toggle('is-active',card.dataset.klm===klm.code));
  }

  function focusKlm(klm){
    const [west,south,east,north]=klm.bbox;
    state.map.fitBounds([[south,west],[north,east]],{padding:[25,25],maxZoom:10});
    renderDetail(klm);
    const marker=state.markers.get(klm.code);
    if(marker)marker.openTooltip();
  }

  function renderCards(klms){
    cards.innerHTML=klms.map(klm=>`<button type="button" class="klm-card" data-klm="${safe(klm.code)}" style="--klm-color:${safe(klm.color)}"><header><div><small>KLM ${safe(klm.code)}</small><strong>${safe(klm.name.replace(/^KLM\s+/i,''))}</strong></div><b>Fokus peta</b></header><div class="klm-card-stats"><span><strong>${fmt(klm.mangrove_area_ha)} ha</strong>Mangrove PMN 2025</span><span><strong>${fmt(klm.validated_true_percent)}%</strong>TRUE tervalidasi</span><span><strong>${fmt(klm.initial_percent)}%</strong>Fungsi awal</span><span><strong>${fmt(klm.true_plus_review_percent)}%</strong>TRUE + REVIEW</span></div><div class="klm-bar"><i style="width:${Math.min(100,klm.true_plus_review_percent)}%"></i></div></button>`).join('');
    cards.addEventListener('click',event=>{const button=event.target.closest('[data-klm]');if(!button)return;const klm=klms.find(item=>item.code===button.dataset.klm);if(klm)focusKlm(klm)});
  }

  async function init(){
    if(!window.L){status.textContent='Peta belum dapat dimuat';return}
    try{
      const response=await fetch('data/mangrove-klm-summary.json?v=20260827-klm1',{cache:'no-store'});
      if(!response.ok)throw new Error('Ringkasan KLM tidak tersedia');
      state.data=await response.json();
      state.map=L.map('klm-map',{zoomControl:true,minZoom:6,maxZoom:13});
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'}).addTo(state.map);
      const bounds=state.data.image.bounds;
      L.imageOverlay(state.data.image.path,bounds,{opacity:.92,interactive:false}).addTo(state.map);
      state.map.fitBounds(bounds,{padding:[12,12]});
      state.data.klms.forEach(klm=>{
        const marker=L.circleMarker(klm.label_point,{radius:7,color:'#fff',weight:2,fillColor:klm.color,fillOpacity:1}).addTo(state.map).bindTooltip(klm.name.replace(/^KLM\s+/i,''),{permanent:true,direction:'top',className:'klm-label',offset:[0,-7]});
        marker.on('click',()=>focusKlm(klm));
        state.markers.set(klm.code,marker);
      });
      renderCards(state.data.klms);
      renderDetail(state.data.klms[0]);
      status.textContent=`3 KLM sumber · ${fmt(state.data.totals.inside_source_klm_percent)}% mangrove Riau beririsan`;
      document.getElementById('klm-reconciliation').textContent=`Sebanyak ${fmt(state.data.totals.outside_source_klm_area_ha)} ha (${fmt(100-state.data.totals.inside_source_klm_percent)}%) unit mangrove berada di luar tiga polygon KLM sumber dan tidak dipaksakan masuk ke KLM mana pun.`;
    }catch(error){
      console.warn(error);
      status.textContent='Peta KLM belum dapat dimuat';
      cards.innerHTML='<article class="klm-loading">Ringkasan KLM belum tersedia. Muat ulang halaman untuk mencoba kembali.</article>';
    }
  }
  init();
})();
