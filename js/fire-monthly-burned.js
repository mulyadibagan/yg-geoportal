(function(){
  'use strict';
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
  function ha(n){return Number(n).toLocaleString('id-ID',{minimumFractionDigits:2,maximumFractionDigits:2})+' ha'}
  function key(a){return [a.regency,a.district,a.village].map(function(v){return String(v||'').trim().toLowerCase()}).join('|')}
  window.loadMonthlyBurned=function(map,month,d,control){
    var card=document.getElementById('fm-burned-area'),status=document.getElementById('fm-burned-status'),rows=document.getElementById('fm-area-rows');
    fetch('data/burned-area-monthly/index.json?t='+Date.now(),{cache:'no-store'}).then(function(r){if(!r.ok)throw Error('archive');return r.json()}).then(function(index){
      var report=(index.reports||[]).find(function(x){return x.month===month});
      if(!report){card.textContent='Belum tersedia';status.textContent='Bulan ini belum memiliki hasil estimasi tersimpan.';rows.innerHTML='<tr><td colspan="3">Estimasi luas belum tersedia; bukan berarti tidak ada kebakaran.</td></tr>';return null}
      return fetch(report.data+'?t='+Date.now(),{cache:'no-store'}).then(function(r){if(!r.ok)throw Error('archive');return r.json()});
    }).then(function(geo){
      if(!geo)return;
      card.textContent=ha(geo.estimatedAreaHa);
      status.textContent='Sementara · '+geo.eventCount+' kejadian · citra layak yang sudah tersedia · diperbarui '+new Date(geo.generatedAt).toLocaleString('id-ID',{timeZone:'Asia/Jakarta'})+' WIB';
      var villages=new Map();
      (d.villages||[]).forEach(function(v){villages.set(key(v),{village:v.village,district:v.district,regency:v.regency,hotspots:v.hotspots,area:null})});
      geo.features.forEach(function(f){(f.properties.villageAreas||[]).forEach(function(a){var k=key(a),r=villages.get(k)||{village:a.village,district:a.district,regency:a.regency,hotspots:d.unavailable?null:0,area:null};r.area=(r.area||0)+a.areaHa;villages.set(k,r)})});
      var regencies=new Map();villages.forEach(function(v){var r=regencies.get(v.regency)||{name:v.regency,hotspots:d.unavailable?null:0,area:null,villages:[]};if(r.hotspots!==null)r.hotspots+=Number(v.hotspots)||0;if(v.area!==null)r.area=(r.area||0)+v.area;r.villages.push(v);regencies.set(v.regency,r)});
      rows.innerHTML=Array.from(regencies.values()).sort(function(a,b){return (b.area||0)-(a.area||0)}).map(function(r){return '<tr><td><details><summary>'+esc(r.name||'Kabupaten belum teridentifikasi')+'</summary><table class="fm-table"><thead><tr><th>Desa / kecamatan</th><th>Hotspot</th><th>Estimasi luas</th></tr></thead><tbody>'+r.villages.sort(function(a,b){return (b.area||0)-(a.area||0)}).map(function(v){return '<tr><td>'+esc(v.village)+'<br><small>'+esc(v.district)+'</small></td><td>'+(v.hotspots===null?'—':v.hotspots)+'</td><td>'+(v.area===null?'Belum tersedia':ha(v.area))+'</td></tr>'}).join('')+'</tbody></table></details></td><td>'+(r.hotspots===null?'—':r.hotspots)+'</td><td>'+(r.area===null?'Belum tersedia':ha(r.area))+'</td></tr>'}).join('')||'<tr><td colspan="3">Belum ada estimasi tersimpan.</td></tr>';
      var burned=L.geoJSON(geo,{style:{color:'#b43e22',weight:2,fillColor:'#f16a35',fillOpacity:.35},onEachFeature:function(f,l){var p=f.properties;l.bindPopup('<strong>Area terindikasi terbakar</strong><br>'+ha(p.estimatedAreaHa)+'<br>'+esc((p.villages||[]).join(', '))+'<br>Deteksi pertama: '+esc(p.firstDetection.slice(0,10))+'<br><small>Estimasi sementara; bukan verifikasi lapangan.</small>')}}).addTo(map);
      control.addOverlay(burned,'Area terindikasi terbakar');if(d.unavailable&&burned.getBounds().isValid())map.fitBounds(burned.getBounds().pad(.1));
    }).catch(function(){card.textContent='Tidak tersedia';status.textContent='Arsip estimasi belum dapat dimuat. Silakan muat ulang halaman.';rows.innerHTML='<tr><td colspan="3">Arsip belum dapat dimuat.</td></tr>'});
  };
}());
