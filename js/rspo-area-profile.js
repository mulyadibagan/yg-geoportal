(function(){'use strict';
var query=new URLSearchParams(location.search),requestedId=query.get('id'),requestedGroup=query.get('group'),map;
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function ringArea(ring){if(!ring||ring.length<3)return 0;var sum=0,R=6378137,d=Math.PI/180;for(var i=0;i<ring.length;i++){var a=ring[i],b=ring[(i+1)%ring.length];sum+=(b[0]-a[0])*d*(2+Math.sin(a[1]*d)+Math.sin(b[1]*d))}return Math.abs(sum*R*R/2)}
function geometryArea(g){if(!g)return 0;var polygons=g.type==='Polygon'?[g.coordinates]:g.coordinates||[];return polygons.reduce(function(total,p){return total+Math.max(0,ringArea(p[0])-p.slice(1).reduce(function(s,r){return s+ringArea(r)},0))},0)/10000}
function monthLabel(value){return new Date(value+'-01T00:00:00Z').toLocaleDateString('id-ID',{month:'long',year:'numeric',timeZone:'UTC'})}
function profileUrl(f){return'rspo-area-profile.html?id='+encodeURIComponent(f.properties.COMPANY_ID)}
Promise.all([
 fetch('data/PERUSAHAAN_SAWIT_RIAU_REFERENSI.geojson').then(function(r){if(!r.ok)throw Error('referensi area tidak tersedia');return r.json()}),
 fetch('data/fire-monthly/index.json',{cache:'no-store'}).then(function(r){if(!r.ok)throw Error('indeks laporan tidak tersedia');return r.json()}),
 fetch('data/rspo-area-portfolios.json?v=20260912-all-areas1',{cache:'no-store'}).then(function(r){return r.ok?r.json():{}}).catch(function(){return{}}),
 fetch('data/rspo-burned-area-monitoring.json?v=20260912-v1',{cache:'no-store'}).then(function(r){return r.ok?r.json():{areas:{}}}).catch(function(){return{areas:{}}}),
 fetch('data/rspo-tree-cover-monitoring.json?v=20260912-v1',{cache:'no-store'}).then(function(r){return r.ok?r.json():{areas:{}}}).catch(function(){return{areas:{}}}),
 fetch('data/rspo-complaint-monitoring.json?v=20260912-v1',{cache:'no-store'}).then(function(r){return r.ok?r.json():{groups:{}}}).catch(function(){return{groups:{}}})
]).then(function(base){
 var geo=base[0],index=base[1],all=geo.features||[],selected,mode='area';
 if(requestedGroup){selected=all.filter(function(f){return f.properties.RSPO_GROUP===requestedGroup});mode='group'}else{var found=all.find(function(f){return f.properties.COMPANY_ID===requestedId})||all[0];selected=found?[found]:[];requestedId=found&&found.properties.COMPANY_ID}
 if(!selected.length)throw Error('profil yang dipilih tidak ditemukan');
 var p=selected[0].properties,group=p.RSPO_GROUP,title=mode==='group'?group:p.PO_COMPANY,subtitle=mode==='group'?'Ringkasan '+selected.length+' area perkebunan anggota RSPO di Riau':[p.SUPPLY_BASE,p.REFERENCE_DISTRICTS].filter(Boolean).join(' · ');
 document.title=title+' | Profil RSPO YG GeoPortal';document.getElementById('rap-title').textContent=title;document.getElementById('rap-subtitle').textContent=subtitle;document.getElementById('rap-type').textContent=mode==='group'?'PROFIL GRUP RSPO':'PORTOFOLIO REFERENSI AREA';document.getElementById('rap-updated').textContent='Data area diperbarui '+p.REFERENCE_UPDATED;document.getElementById('rap-unit-count').textContent=selected.length;document.getElementById('rap-area').textContent=Math.round(selected.reduce(function(s,f){return s+geometryArea(f.geometry)},0)).toLocaleString('id-ID');
 var groupLink=document.getElementById('rap-group-link');groupLink.href=mode==='group'?'sawit-riau-rspo.html':'rspo-area-profile.html?group='+encodeURIComponent(group);groupLink.textContent=mode==='group'?'Kembali ke modul RSPO':'Lihat profil grup';
 var locations=Array.from(new Set(selected.map(function(f){return f.properties.REFERENCE_DISTRICTS}).filter(Boolean))).join(', '),identity=[['Perusahaan/unit',mode==='group'?selected.length+' area dari '+new Set(selected.map(function(f){return f.properties.PO_COMPANY})).size+' perusahaan':p.PO_COMPANY],['Grup RSPO',group],['Estate/supply base',mode==='group'?'Beragam unit':p.SUPPLY_BASE],['Kabupaten',locations],['Jenis referensi',p.REFERENCE_TYPE],['Pembaruan',p.REFERENCE_UPDATED]];
 document.getElementById('rap-identity').innerHTML=identity.map(function(x){return'<div><dt>'+esc(x[0])+'</dt><dd>'+esc(x[1]||'Belum tersedia')+'</dd></div>'}).join('');
 renderPortfolio(mode==='area'?(base[2]||{})[requestedId]:null,p,selected);
 renderBurnedMonitoring(mode==='area'?((base[3]||{}).areas||{})[requestedId]:null);
 renderTreeCoverMonitoring(mode==='area'?((base[4]||{}).areas||{})[requestedId]:null,(base[4]||{}).method||{});
 renderComplaintMonitoring(((base[5]||{}).groups||{})[group],mode==='area'?requestedId:null,(base[5]||{}).method||{},(base[5]||{}).checkedAt);
 map=L.map('rap-leaflet',{preferCanvas:true});var street=L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap'}),satellite=L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:19,attribution:'Tiles &copy; Esri'}).addTo(map),areaLayer=L.geoJSON({type:'FeatureCollection',features:selected},{style:{color:'#f97316',weight:2.4,fillColor:'#ef7b2d',fillOpacity:.18},onEachFeature:function(f,l){l.bindTooltip('<strong>'+esc(f.properties.PO_COMPANY)+'</strong><br>'+esc(f.properties.SUPPLY_BASE||''))}}).addTo(map);L.control.layers({'Citra satelit':satellite,'Peta jalan':street},{'Area anggota RSPO':areaLayer},{collapsed:false}).addTo(map);map.fitBounds(areaLayer.getBounds().pad(.08));
 var ids=new Set(selected.map(function(f){return f.properties.COMPANY_ID}));return Promise.all((index.reports||[]).map(function(entry){return fetch(entry.data+'?v='+encodeURIComponent(entry.generatedAt||'1'),{cache:'no-store'}).then(function(r){return r.json()}).then(function(report){return{entry:entry,report:report}})})).then(function(archives){renderArchive(archives,ids,selected);renderRelated(all,group,mode,requestedId)})
}).catch(function(error){var status=document.getElementById('rap-status');status.className='rap-status error';status.textContent='Profil belum dapat dimuat: '+error.message});
function renderTreeCoverMonitoring(summary,method){
 var el=document.getElementById('rap-monitor-cover'),signal=document.getElementById('rap-signal');
 if(!el)return;
 if(!summary){el.textContent='Data belum tersedia';return}
 var annual=summary.annualLossHa||{},years=Object.keys(annual).filter(function(y){return annual[y]!=null}).sort(),year=years[years.length-1],loss=Number(annual[year]||0);
 el.textContent=loss.toLocaleString('id-ID',{maximumFractionDigits:2})+' ha pada '+year;
 var note=el.nextElementSibling;
 if(note)note.textContent='Kehilangan tutupan pohon ≥30% berdasarkan Hansen/UMD. Sinyal dapat mencakup peremajaan atau panen dan bukan bukti deforestasi ilegal.';
 if(signal)signal.dataset.coverLoss=loss>0?'yes':'no';
}
function renderBurnedMonitoring(summary){
 var el=document.getElementById('rap-monitor-burned');
 if(!el)return;
 if(!summary){el.textContent='Data belum tersedia';return}
 var rows=summary.monthly||[],positive=rows.filter(function(x){return Number(x.estimatedAreaHa||0)>0}),total=Number(summary.estimatedAreaHa||0);
 if(total>0){
  el.textContent=total.toLocaleString('id-ID',{maximumFractionDigits:2})+' ha indikatif';
  var note=el.nextElementSibling;if(note)note.textContent=positive.length+' bulan memiliki irisan poligon estimasi. Hasil citra bukan bukti penyebab atau tanggung jawab.';
 }else{
  el.textContent='0 ha terdeteksi pada arsip';
  var noteZero=el.nextElementSibling;if(noteZero)noteZero.textContent='Tidak ada irisan dengan poligon estimasi area terbakar pada '+rows.length+' laporan yang tersedia; ini bukan jaminan tidak terjadi kebakaran.';
 }
}
function renderComplaintMonitoring(summary,areaId,method,checkedAt){
 var el=document.getElementById('rap-monitor-complaint'),signal=document.getElementById('rap-signal');
 if(!el)return;
 if(!summary){
  el.textContent='Tidak ada kecocokan nama';
  var noDataNote=el.nextElementSibling;if(noDataNote)noDataNote.textContent=(method&&method.noMatchWarning)||'Tidak ditemukannya kecocokan bukan jaminan tidak pernah ada pengaduan.';
  return;
 }
 var direct=(summary.directAreaCases||[]).filter(function(c){return areaId&&(c.areaIds||[]).indexOf(areaId)>-1}),directActive=direct.filter(function(c){return!/closed/i.test(c.status||'')});
 var active=Number(summary.active||0),decision=Number(summary.officialDecisionPendingAppeal||0),total=Number(summary.totalMatched||0),post=Number(summary.postComplaintMonitoring||0),scope=areaId?(direct.length?direct.length+' perkara cocok langsung dengan nama entitas area; ':'Tidak ada perkara yang cocok langsung dengan nama entitas area; '):'';
 if(directActive.length)el.textContent=directActive.length+' pengaduan aktif terkait langsung';
 else if(active)el.textContent=active+' pengaduan aktif pada grup';
 else if(post&&direct.length)el.textContent='Ditutup · pemantauan pascapengaduan';
 else el.textContent=total+' perkara grup · seluruhnya ditutup';
 var note=el.nextElementSibling;if(note)note.textContent=scope+total+' perkara terkait grup ditemukan pada Case Tracker RSPO'+(decision?'; '+decision+' keputusan masih dalam masa banding':'')+'. Pengaduan bukan bukti pelanggaran.'+(checkedAt?' Diperiksa '+new Date(checkedAt).toLocaleDateString('id-ID',{timeZone:'UTC'})+'.':'');
 if(signal){signal.dataset.complaintReview=active?'yes':'no';signal.dataset.complaintDecision=decision?'yes':'no'}
}
function renderPortfolio(profile,p,selected){
 var area=Math.round(selected.reduce(function(s,f){return s+geometryArea(f.geometry)},0)).toLocaleString('id-ID')+' ha';
 var fallback={
  portfolioVersion:'Format dasar',
  verificationDate:p.REFERENCE_UPDATED||'Belum tersedia',
  publicStatus:'Referensi spasial area perusahaan',
  certificationStatus:'Belum diverifikasi pada tingkat kebun/unit',
  certificationTone:'pending',
  verificationSummary:'Profil menampilkan identitas dan batas referensi. Status keanggotaan grup tidak otomatis berarti seluruh kebun atau poligon telah tersertifikasi.',
  facts:[
   {label:'Entitas',value:p.PO_COMPANY||'Belum tersedia',status:'Tersedia',note:'Nama pada dataset referensi YG.'},
   {label:'Grup perusahaan',value:p.RSPO_GROUP||'Belum tersedia',status:'Referensi',note:'Perlu dicocokkan dengan profil anggota resmi.'},
   {label:'Cakupan lokasi',value:p.REFERENCE_DISTRICTS||'Belum tersedia',status:'Tersedia',note:'Lokasi administratif pada dataset.'},
   {label:'Luas spasial',value:area,status:'Referensi',note:'Hasil perhitungan poligon; bukan luas HGU atau luas tersertifikasi.'},
   {label:'Sertifikasi unit',value:'Belum dikonfirmasi',status:'Perlu dokumen',note:'Memerlukan sertifikat yang menyebut unit dan cakupannya.'},
   {label:'Legalitas lahan',value:'Belum tersedia',status:'Perlu sumber resmi',note:'HGU/IUP hanya ditampilkan dari dokumen publik resmi.'}
  ],
  sourceLinks:[{label:'GeoRSPO',publisher:'Roundtable on Sustainable Palm Oil',url:'https://rspo.org/as-an-organisation/tools/georspo/',use:'Konteks data geospasial anggota RSPO',accessed:'12 September 2026'}],
  nextEvidence:['Profil anggota dan nomor keanggotaan RSPO','Sertifikat unit beserta masa berlaku','Luas tersertifikasi dan cakupan estate/pabrik','Dokumen HGU/IUP dari sumber publik resmi']
 };
 var d=profile||fallback;
 document.getElementById('rap-portfolio-version').textContent=(d.portfolioVersion||'Format portofolio')+' · ditelaah '+(d.verificationDate||'—');
 document.getElementById('rap-public-status').textContent=d.publicStatus||fallback.publicStatus;
 var cert=document.getElementById('rap-certification-status');cert.textContent=d.certificationStatus||fallback.certificationStatus;cert.className='is-'+(d.certificationTone||'pending');
 var monitorCert=document.getElementById('rap-monitor-certificate'),monitorCertNote=document.getElementById('rap-monitor-certificate-note');
 if(monitorCert)monitorCert.textContent=d.certificationStatus||fallback.certificationStatus;
 if(monitorCertNote)monitorCertNote.textContent=(d.certificationStatus||'').toLowerCase().indexOf('belum')>-1?'Keanggotaan atau referensi area tidak digunakan sebagai bukti sertifikasi unit.':'Status mengikuti dokumen sertifikat yang dicatat pada portofolio.';
 document.getElementById('rap-verification-summary').textContent=d.verificationSummary||fallback.verificationSummary;
 document.getElementById('rap-fact-grid').innerHTML=(d.facts||fallback.facts).map(function(x){var value=x.label==='Luas spasial'?area:x.value;return'<article><span>'+esc(x.label)+'</span><strong>'+esc(value)+'</strong><em>'+esc(x.status||'Referensi')+'</em><p>'+esc(x.note||'')+'</p></article>'}).join('');
 document.getElementById('rap-source-list').innerHTML=(d.sourceLinks||fallback.sourceLinks).map(function(x){return'<a href="'+esc(x.url)+'" target="_blank" rel="noopener"><span>'+esc(x.publisher)+'</span><strong>'+esc(x.label)+' ↗</strong><p>'+esc(x.use||'')+'</p><small>Diakses '+esc(x.accessed||d.verificationDate||'—')+'</small></a>'}).join('');
 document.getElementById('rap-evidence-list').innerHTML=(d.nextEvidence||fallback.nextEvidence).map(function(x){return'<li>'+esc(x)+'</li>'}).join('');
}
function renderArchive(archives,ids,selected){var rows=[],points=[],total=0,days=new Set();archives.slice().reverse().forEach(function(x){var hits=(x.report.hotspots||[]).filter(function(h){return(h.rspoAreas||[]).some(function(a){return ids.has(a.id)})});hits.forEach(function(h){total++;days.add(h.date);points.push(h)});rows.push({month:x.report.month,status:x.report.status,hotspots:hits.length,days:new Set(hits.map(function(h){return h.date})).size,villages:Array.from(new Set(hits.map(function(h){return h.village}).filter(Boolean)))})});document.getElementById('rap-hotspots').textContent=total.toLocaleString('id-ID');document.getElementById('rap-days').textContent=days.size.toLocaleString('id-ID');document.getElementById('rap-month-range').textContent=rows.length?monthLabel(rows[0].month)+'–'+monthLabel(rows[rows.length-1].month):'Belum ada arsip';document.getElementById('rap-monthly').innerHTML=rows.slice().reverse().map(function(r){return'<tr><td><strong>'+esc(monthLabel(r.month))+'</strong></td><td>'+r.hotspots+'</td><td>'+r.days+'</td><td>'+esc(r.villages.join(', ')||'—')+'</td><td>'+(r.status==='final'?'Final':'Sementara')+'</td></tr>'}).join('');var maximum=Math.max.apply(null,rows.map(function(r){return r.hotspots}).concat([1]));document.getElementById('rap-chart').innerHTML=rows.map(function(r){return'<div class="rap-bar '+(r.hotspots?'has':'')+'"><i style="height:'+Math.max(3,r.hotspots/maximum*105)+'px">'+(r.hotspots?'<b>'+r.hotspots+'</b>':'')+'</i><small>'+esc(r.month.slice(5))+'/'+esc(r.month.slice(2,4))+'</small></div>'}).join('');var pointLayer=L.featureGroup();points.forEach(function(h){L.circleMarker([h.latitude,h.longitude],{radius:5,color:'#fff',weight:1.2,fillColor:'#df342e',fillOpacity:.95}).bindPopup('<strong>Hotspot high confidence</strong><br>'+esc(h.date)+' '+esc(h.time||'')+'<br>'+esc([h.village,h.district,h.regency].filter(Boolean).join(', '))).addTo(pointLayer)});pointLayer.addTo(map);L.control.layers(null,{'Hotspot dalam arsip bulanan':pointLayer},{collapsed:false,position:'bottomright'}).addTo(map);document.getElementById('rap-status').textContent='Profil aktif · '+selected.length+' area · '+total+' hotspot dalam '+rows.length+' laporan bulanan';
var hotspotEl=document.getElementById('rap-monitor-hotspot'),hotspotNote=document.getElementById('rap-monitor-hotspot-note'),signal=document.getElementById('rap-signal');
if(hotspotEl)hotspotEl.textContent=total?total+' hotspot terdeteksi':'0 hotspot terdeteksi';
if(hotspotNote)hotspotNote.textContent=total?days.size+' hari deteksi dalam '+rows.length+' laporan; perlu pemeriksaan citra dan lapangan.':'Tidak ada irisan hotspot pada '+rows.length+' laporan bulanan yang tersedia.';
if(signal){var coverReview=signal.dataset.coverLoss==='yes',complaintReview=signal.dataset.complaintReview==='yes',complaintDecision=signal.dataset.complaintDecision==='yes',review=total||coverReview||complaintReview||complaintDecision;signal.textContent=complaintDecision?'Keputusan RSPO tersedia · periksa status banding':total?'Indikasi hotspot perlu pemeriksaan':complaintReview?'Pengaduan aktif · belum merupakan pelanggaran':coverReview?'Indikasi perubahan tutupan':'Tidak ada indikasi pada data tersedia';signal.className='rap-signal '+(review?'is-review':'is-clear')}}
function renderRelated(all,group,mode,id){var related=all.filter(function(f){return f.properties.RSPO_GROUP===group&&(mode==='group'||f.properties.COMPANY_ID!==id)});document.getElementById('rap-related-title').textContent=mode==='group'?'Daftar area dalam grup':'Area lain dalam grup yang sama';document.getElementById('rap-related').innerHTML=related.length?related.map(function(f){var p=f.properties;return'<a href="'+profileUrl(f)+'"><strong>'+esc(p.PO_COMPANY)+'</strong><small>'+esc([p.SUPPLY_BASE,p.REFERENCE_DISTRICTS].filter(Boolean).join(' · '))+'</small></a>'}).join(''):'<p>Tidak ada area lain dalam grup yang sama.</p>'}
}());
