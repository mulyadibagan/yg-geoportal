(function(root,factory){
  'use strict';
  var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.DayunEthrel=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  var MONTHS={jan:1,feb:2,mar:3,apr:4,mei:5,jun:6,jul:7,agu:8,sep:9,okt:10,nov:11,des:12};
  function num(v){return v!==null&&v!==''&&v!==undefined&&Number.isFinite(Number(v))?Math.max(0,Number(v)):null;}
  function month(v){var s=String(v||'').toLowerCase(),m=/^(\d{4})-(\d{2})(?:-\d{2})?$/.exec(s);if(m&&+m[2]>=1&&+m[2]<=12)return +m[1]*12+ +m[2]-1;m=/^([a-z]+)\s+(\d{4})$/.exec(s);return m&&MONTHS[m[1].slice(0,3)]?+m[2]*12+MONTHS[m[1].slice(0,3)]-1:null;}
  function today(){return new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Jakarta'});}
  function merge(details,payload,asOf){
    var result=JSON.parse(JSON.stringify(details||{objects:[]})),byId={};
    (result.objects||[]).forEach(function(o){byId[o.objectId]=o;});
    var events=(payload&&payload.features||[]).map(function(f){var p=f.properties||{},info;try{info=typeof p.proposedInformation==='string'?JSON.parse(p.proposedInformation):p.proposedInformation;}catch(_){return null;}
      if(p.targetLayerId!=='dayun_gawangan'||!info||info.monitoringType!=='Agroforestri Dayun'||String(info.crop||'').toUpperCase()!=='NANAS')return null;
      var date=info.eventDate||p.activityDate;if(!/^\d{4}-\d{2}-\d{2}$/.test(date||'')||date>asOf)return null;
      return {id:p.targetObjectId,info:info,date:date};
    }).filter(Boolean).sort(function(a,b){return a.date.localeCompare(b.date);});
    events.forEach(function(e){var o=byId[e.id];if(!o)return;var c=(o.crops||[]).find(function(c){return String(c.crop).toUpperCase()==='NANAS';});if(!c){c={crop:'NANAS'};(o.crops=o.crops||[]).push(c);}
      var i=e.info,d=i.activityDetails||{};if(i.plantingDate)c.plantingDate=i.plantingDate;
      if(i.activityType==='Sensus tanaman'&&num(d.livingPlantCount)!==null&&Number.isInteger(Number(d.livingPlantCount))){c.vegetationCount=Number(d.livingPlantCount);c.populationCensus={period:e.date};}
      if(i.activityType==='Ethrel'&&num(d.treatedPlantCount)>0){c.ethrel=c.ethrel||[];if(!c.ethrel.some(function(h){return h.period===e.date&&Number(h.count)===Number(d.treatedPlantCount);})){c.ethrel.push({period:e.date,count:Number(d.treatedPlantCount)});}}
      if(i.activityType==='Panen'&&d.unit==='buah'&&num(d.harvestCount)>0){c.pineappleHarvest=c.pineappleHarvest||[];if(!c.pineappleHarvest.some(function(h){return h.period===e.date&&Number(h.count)===Number(d.harvestCount);})){c.pineappleHarvest.push({period:e.date,count:Number(d.harvestCount)});}}
    });return result;
  }
  function build(details,payload,options){
    var asOf=options&&options.asOf||today(),data=merge(details,payload,asOf),rows=[];
    (data.objects||[]).forEach(function(o){var c=(o.crops||[]).find(function(c){return String(c.crop).toUpperCase()==='NANAS';});if(!c)return;
      var plants=num(c.vegetationCount);if(!(plants>0))return;
      var history=(c.ethrel||[]).filter(function(h){return num(h.count)>0;});
      var invalid=history.some(function(h){return month(h.period)!==null&&month(h.period)>month(asOf);});
      history=history.filter(function(h){return month(h.period)===null||month(h.period)<=month(asOf);});
      var treated=history.length?history.reduce(function(s,h){return s+num(h.count);},0):num(c.ethrelTotal),p=month(c.plantingDate||c.plantingPeriod),age=p!==null&&p<=month(asOf)?month(asOf)-p:null;
      var hasEthrel=treated>0,census=c.populationCensus&&c.populationCensus.period,harvest=(c.pineappleHarvest||[]).some(function(h){return num(h.count)>0;})||num(c.pineappleHarvestTotal)>0,flowers=num(c.pineappleFlowerCount)>0;
      var group='verify',label='Periksa kelayakan',reason='Belum ada aplikasi Ethrel tercatat. Periksa tanaman sehat, keseragaman, jumlah daun, dan cuaca sebelum aplikasi.';
      if(hasEthrel){group='followup';label='Sudah ada aplikasi';reason='Periksa kelompok yang belum mendapat Ethrel; riwayat seluruh gawangan tidak membuktikan semua tanaman sudah ditangani. Jangan mengulang aplikasi pada tanaman yang sama.';}
      else if(harvest||flowers||c.ratoonMonitoring&&c.ratoonMonitoring.length){label='Pisahkan kelompok tanaman';reason='Ada bunga, panen, atau ratoon tercatat. Hitung tanaman belum berbunga dan cocokkan riwayat sebelum aplikasi.';}
      else if(age===null){label='Verifikasi umur';reason='Bulan tanam belum tersedia atau tidak valid. Lengkapi umur dan kondisi tanaman.';}
      else if(age<9){group='maintenance';label='Pemeliharaan';reason='Umur sekitar '+age+' bulan; belum mencapai acuan pemeriksaan Ethrel umur 9 bulan.';}
      var remaining=treated!==null&&!census&&!invalid&&treated<=Math.round(plants)?Math.max(0,Math.round(plants)-Math.round(treated)):null;
      if(census&&hasEthrel)reason+=' Populasi sensus dan aplikasi kumulatif belum tentu berasal dari kelompok tanam yang sama.';
      if(invalid||treated>Math.round(plants)){group='verify';label='Cocokkan catatan';reason='Tanggal atau jumlah aplikasi tidak sejalan dengan populasi. Verifikasi kelompok tanam sebelum menentukan sisa.';remaining=null;}
      rows.push({id:o.objectId,shortId:String(o.objectId).replace('DAYUN-GT-',''),block:o.block||String(o.objectId).split('-')[2],plants:plants,age:age,treated:treated,remaining:remaining,history:history,census:census||null,group:group,label:label,reason:reason});
    });rows.sort(function(a,b){return a.shortId.localeCompare(b.shortId,'id',{numeric:true});});return {asOf:asOf,rows:rows};
  }
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function integer(v){return Math.round(v).toLocaleString('id-ID');}
  function summary(row){return '<div class="dy-ethrel-popup"><strong>Rekomendasi Ethrel · '+esc(row.label)+'</strong><p>'+esc(row.reason)+'</p><span>Umur: '+(row.age===null?'belum tersedia':'±'+row.age+' bulan')+' · '+(row.treated===null?'Aplikasi belum tercatat':'Aplikasi kumulatif '+integer(row.treated)+' tanaman')+'</span><span>Sisa belum diaplikasikan: '+(row.remaining===null?'perlu hitung lapangan':'±'+integer(row.remaining)+' tanaman (selisih sumber)')+'</span><a href="dayun-gawangan.html?object='+encodeURIComponent(row.id)+'">Lihat riwayat gawangan →</a></div>';}
  function create(options){
    var panel=document.createElement('section');panel.className='dy-ethrel-panel';panel.id='dayun-ethrel-panel';var open=false,filter='verify',block='',selected='',state=build(options.details,null),source='Data sumber awal · memuat laporan monitoring…',basePopups=new Map();
    function visible(){return state.rows.filter(function(r){return (!block||r.block===block)&&(filter==='all'||r.group===filter);});}
    function paint(){var ids=visible().map(function(r){return r.id;});Object.keys(options.layers).forEach(function(id){options.layers[id].forEach(function(l){if(!l.setStyle)return;var style=options.style(l.feature);if(open&&/^DAYUN-GT-/.test(id)){var r=state.rows.find(function(r){return r.id===id;});style=Object.assign({},style,ids.indexOf(id)>=0?{color:id===selected?'#fff':'#f59e0b',weight:id===selected?5:3,fillColor:r&&r.group==='maintenance'?'#64748b':r&&r.group==='followup'?'#2563eb':'#f59e0b',fillOpacity:.48}:{fillOpacity:.03,opacity:.4});}l.setStyle(style);});});}
    function render(){var rows=visible(),counts={verify:0,followup:0,maintenance:0};state.rows.forEach(function(r){counts[r.group]++;});
      panel.innerHTML='<button class="dy-ethrel-toggle" type="button" aria-expanded="'+open+'" aria-controls="dayun-ethrel-list">Gawangan perlu Ethrel <span>'+counts.verify+' perlu verifikasi</span></button><div id="dayun-ethrel-list"'+(open?'':' hidden')+'><p class="dy-ethrel-note">Umur 9 bulan adalah acuan pemeriksaan. Kesiapan aplikasi memerlukan verifikasi kondisi tanaman di lapangan.</p><label>Blok <select data-ethrel-block><option value="">Semua blok</option>'+['A','B','C','D','E','F'].map(function(b){return '<option'+(block===b?' selected':'')+'>'+b+'</option>';}).join('')+'</select></label><div class="dy-ethrel-filters" role="group" aria-label="Filter rekomendasi Ethrel">'+[['verify','Perlu verifikasi'],['followup','Sebagian / riwayat'],['maintenance','Pemeliharaan'],['all','Semua']].map(function(f){return '<button type="button" data-ethrel-filter="'+f[0]+'" aria-pressed="'+(filter===f[0])+'">'+f[1]+' ('+(f[0]==='all'?state.rows.length:counts[f[0]])+')</button>';}).join('')+'</div><p class="dy-ethrel-source" aria-live="polite">'+esc(source)+'</p><div class="dy-ethrel-rows">'+(rows.length?rows.map(function(r){return '<button type="button" class="dy-ethrel-row'+(selected===r.id?' is-selected':'')+'" data-ethrel-object="'+esc(r.id)+'"><span><b>'+esc(r.shortId)+'</b><em>'+esc(r.label)+'</em></span><small>Umur '+(r.age===null?'belum tersedia':'±'+r.age+' bulan')+' · '+integer(r.plants)+' tanaman'+(r.census?' (sensus)':' (sumber awal)')+'</small><small>Sisa belum diaplikasikan: '+(r.remaining===null?'perlu hitung lapangan':'±'+integer(r.remaining)+' (selisih sumber)')+'</small></button>';}).join(''):'<p class="dy-ethrel-empty">Tidak ada gawangan pada pilihan ini.</p>')+'</div><p class="dy-ethrel-note">Klik baris untuk menyorot polygon dan membuka detail. Selisih populasi sumber dan aplikasi kumulatif merupakan angka indikatif; sensus terbaru tidak dikurangi riwayat lama tanpa kecocokan kelompok.</p><a href="dayun-sop-nanas.html#program-pupuk">Panduan pemeriksaan Ethrel →</a></div>';
      panel.querySelector('.dy-ethrel-toggle').onclick=function(){open=!open;render();if(open)options.showGawangan();paint();};
      panel.querySelector('[data-ethrel-block]').onchange=function(e){block=e.target.value;selected='';render();paint();};
      panel.querySelectorAll('[data-ethrel-filter]').forEach(function(b){b.onclick=function(){filter=b.dataset.ethrelFilter;selected='';render();paint();};});
      panel.querySelectorAll('[data-ethrel-object]').forEach(function(b){b.onclick=function(){selected=b.dataset.ethrelObject;options.showGawangan();var layers=options.layers[selected]||[];if(!layers.length)return;var bounds=L.latLngBounds([]);layers.forEach(function(l){bounds.extend(l.getBounds());});options.map.fitBounds(bounds,{padding:[40,40],maxZoom:19});layers[0].openPopup();render();paint();if(window.matchMedia('(max-width: 900px)').matches)document.getElementById('dayun-map').scrollIntoView({behavior:'smooth',block:'center'});};});
    }
    function refresh(){state.rows.forEach(function(r){(options.layers[r.id]||[]).forEach(function(l){var popup=l.getPopup();if(!popup)return;if(!basePopups.has(l))basePopups.set(l,popup.getContent());popup.setContent(basePopups.get(l)+summary(r));});});render();paint();}
    function update(payload,label){state=build(options.details,payload);source=label;refresh();}
    refresh();return {panel:panel,update:update,repaint:paint};
  }
  function loadMonitoring(){
    var url='https://script.google.com/macros/s/AKfycbxUe4QyBvSiL9UJsL-nsJ5XrohDabwqhYYR9q5CTgLYiW1ZCfVy429iMlpU-lCDUSvvRg/exec?page=public-reports';
    function snapshot(){return fetch('data/dashboard-summary-snapshot.json',{cache:'no-cache'}).then(function(r){if(!r.ok)throw Error('Snapshot tidak tersedia');return r.json();}).then(function(d){var reports=d.capacitySources&&d.capacitySources.reports;if(!reports||!Array.isArray(reports.features))throw Error('Snapshot tidak valid');return {reports:reports,label:'Snapshot monitoring · '+(d.snapshotGeneratedAt||d.generatedAt||'tanggal belum tersedia')};});}
    if(!navigator.onLine)return snapshot();
    return new Promise(function(resolve,reject){var name='dayunEthrel_'+Date.now(),script=document.createElement('script'),timer=setTimeout(function(){clean();reject(Error('Monitoring tidak tersedia'));},9000);function clean(){clearTimeout(timer);script.remove();delete window[name];}window[name]=function(p){clean();if(!p||!Array.isArray(p.features)){reject(Error('Format monitoring tidak valid'));return;}resolve({reports:p,label:'Laporan monitoring dipublikasikan · diperiksa '+today()});};script.onerror=function(){clean();reject(Error('Monitoring tidak tersedia'));};script.src=url+'&callback='+name;document.head.appendChild(script);}).catch(snapshot);
  }
  return {build:build,merge:merge,create:create,loadMonitoring:loadMonitoring};
});
