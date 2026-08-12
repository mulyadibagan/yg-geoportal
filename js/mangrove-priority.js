(async function(){
  const version='20260812-analysis1';
  const [foundation,results,candidates]=await Promise.all([
    fetch(`data/mangrove-priority-intervention.json?v=${version}`).then(r=>r.json()),
    fetch(`data/mangrove-priority-results.json?v=${version}`).then(r=>r.json()),
    fetch(`data/mangrove-priority-candidates.geojson?v=${version}`).then(r=>r.json())
  ]);
  const villages=foundation.villages, records=new Map(results.villages.map(v=>[v.id,v]));
  const map=L.map('priority-map').setView([1.42,102.08],9);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap contributors'}).addTo(map);
  const candidateLayer=L.geoJSON(candidates,{style:f=>{const high=f.properties.suitabilityClass==='tinggi';return {color:high?'#087b61':'#d08a16',weight:2,fillColor:high?'#25a77d':'#efb64f',fillOpacity:.38}},onEachFeature:(f,l)=>l.bindPopup(`<strong>Kandidat indikatif · ${f.properties.village}</strong><br>${f.properties.recommendedAction}<br><small>Belum diverifikasi lapangan.</small>`)}).addTo(map);
  const layers=new Map();candidateLayer.eachLayer(l=>{const id=l.feature.properties.id;if(!layers.has(id))layers.set(id,[]);layers.get(id).push(l)});
  const markers=new Map(),list=document.getElementById('village-list'),fmt=n=>Number.isFinite(n)?n.toFixed(2):'—';
  function select(v){
    const r=records.get(v.id);document.querySelectorAll('.village-list button').forEach(b=>b.classList.toggle('active',b.dataset.id===v.id));
    document.getElementById('detail-name').textContent=v.village;document.getElementById('detail-meta').textContent=`${v.district} · Kabupaten ${v.regency}`;
    if(r){
      document.getElementById('analysis-status').textContent=`Dianalisis · keyakinan ${r.confidence}`;
      document.getElementById('need-score').textContent=`${r.needScore}/100 · ${r.needClass}`;document.getElementById('suitability-score').textContent=`${r.suitabilityScore}/100 · ${r.suitabilityClass}`;
      document.getElementById('recommended-action').textContent=r.recommendedAction;document.getElementById('candidate-area').textContent=`${fmt(r.candidateAreaHa)} ha`;
      document.getElementById('mangrove-area').textContent=`${fmt(r.baselineMangroveHa)} / ${fmt(r.currentMangroveHa)} ha`;document.getElementById('loss-area').textContent=`${fmt(r.indicativeMangroveLossHa)} ha`;document.getElementById('confidence').textContent=`${r.confidence} · bebas awan ${r.clearCoveragePct}%`;
    }
    const group=layers.get(v.id);if(group&&group.length){const bounds=L.featureGroup(group).getBounds();map.fitBounds(bounds,{padding:[30,30],maxZoom:14})}else map.setView([v.lat,v.lon],12);markers.get(v.id).openPopup();
  }
  villages.forEach(v=>{const r=records.get(v.id),button=document.createElement('button');button.dataset.id=v.id;button.innerHTML=`<strong>${v.village}</strong><small>${r?`${r.candidateAreaHa.toFixed(2)} ha · kebutuhan ${r.needClass}`:'Menunggu analisis'}</small>`;button.onclick=()=>select(v);list.appendChild(button);const marker=L.circleMarker([v.lat,v.lon],{radius:7,color:'#fff',weight:2,fillColor:'#087b61',fillOpacity:1}).addTo(map).bindPopup(`<strong>${v.village}</strong><br>${r?`${r.candidateAreaHa.toFixed(2)} ha kandidat indikatif`:'Belum dianalisis'}`);markers.set(v.id,marker)});
  const analysed=results.villages.filter(v=>v.status==='analysed'),total=analysed.reduce((s,v)=>s+(v.candidateAreaHa||0),0);
  document.getElementById('village-count').textContent=villages.length;document.getElementById('analysed-count').textContent=analysed.length;document.getElementById('candidate-total').textContent=`${total.toFixed(2)} ha`;
  document.getElementById('page-status').textContent=`Analisis indikatif selesai · ${analysed.length}/${villages.length} desa`;
  document.querySelector('.status p').textContent='Polygon adalah hasil penyaringan awal Sentinel-2 dan belum menjadi keputusan lokasi tanam.';
  document.querySelector('.resume').textContent=`status: complete · analysed: ${analysed.length}/${villages.length} · safe_to_resume: true`;
  select(villages[0]);
})().catch(error=>{document.getElementById('page-status').textContent='Data analisis gagal dimuat';console.error(error)});
