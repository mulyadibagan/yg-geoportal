(async function(){
  const data=await fetch('data/mangrove-priority-intervention.json?v=20260812-foundation1').then(r=>r.json());
  const villages=data.villages;
  const map=L.map('priority-map').setView([1.42,102.08],9);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap contributors'}).addTo(map);
  const markers=new Map();
  const list=document.getElementById('village-list');
  function select(v){
    document.querySelectorAll('.village-list button').forEach(b=>b.classList.toggle('active',b.dataset.id===v.id));
    document.getElementById('detail-name').textContent=v.village;
    document.getElementById('detail-meta').textContent=`${v.district} · Kabupaten ${v.regency}`;
    map.setView([v.lat,v.lon],12);markers.get(v.id).openPopup();
  }
  villages.forEach(v=>{
    const button=document.createElement('button');button.dataset.id=v.id;button.innerHTML=`<strong>${v.village}</strong><small>${v.district} · ${v.regency}</small>`;button.onclick=()=>select(v);list.appendChild(button);
    const marker=L.circleMarker([v.lat,v.lon],{radius:8,color:'#fff',weight:2,fillColor:'#087b61',fillOpacity:1}).addTo(map).bindPopup(`<strong>${v.village}</strong><br>Fondasi analisis · belum dinilai`);markers.set(v.id,marker);
  });
  document.getElementById('village-count').textContent=villages.length;
  select(villages[0]);
})().catch(error=>{document.getElementById('page-status').textContent='Fondasi data gagal dimuat';console.error(error)});
