(function(root){
  'use strict';
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function safeUrl(v){v=String(v||'').trim();return /^https?:\/\//i.test(v)||/^(?:assets\/|capacity-building\.html\?|webgis\.html\?)/.test(v)?v:'';}
  function dateInfo(value){
    var text=String(value||'').trim(),m=text.match(/^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/)||text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/),year,month,day;
    if(!m)return {year:'unknown',sort:0,label:'Tanggal belum tercatat'};
    if(m[1].length===4){year=+m[1];month=+m[2];day=+m[3];}else{year=+m[3];month=+m[2];day=+m[1];}
    var date=new Date(Date.UTC(year,month-1,day));
    if(date.getUTCFullYear()!==year||date.getUTCMonth()!==month-1||date.getUTCDate()!==day)return {year:'unknown',sort:0,label:'Tanggal belum tercatat'};
    return {year:String(year),sort:date.getTime(),label:date.toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'})};
  }
  function photos(p){
    var result=[];
    [p.photos,p._ygPhotos,p.Foto,p.Foto_2].forEach(function(value){(Array.isArray(value)?value:[value]).forEach(function(url){url=safeUrl(url);if(url&&result.indexOf(url)<0)result.push(url);});});
    return uniquePhotos(result);
  }
  function uniquePhotos(values){var seen={};return values.filter(function(url){var m=url.match(/drive\.google\.com\/file\/d\/([\w-]+)/)||url.match(/drive\.google\.com\/.*[?&]id=([\w-]+)/),id=m?'drive:'+m[1]:url;if(seen[id])return false;seen[id]=true;return true;});}
  function preview(url){var m=url.match(/drive\.google\.com\/file\/d\/([\w-]+)/)||url.match(/drive\.google\.com\/.*[?&]id=([\w-]+)/);return m?'https://drive.google.com/thumbnail?id='+m[1]+'&sz=w1200':url;}
  function donorName(value){var text=String(value||'').trim();if(/^(yayasan\s+)?penabulu$/i.test(text))return 'Yayasan Penabulu';if(/^(gec|global environment centre(?:\s*\(gec\))?)$/i.test(text))return 'Global Environment Centre';if(/^(aliansi\s+)?kolibri$/i.test(text))return 'Aliansi Kolibri';if(/^aramco(?: asia singapore)?$/i.test(text))return 'Aramco Asia Singapore';if(/^(ppcf|pan pacific conservation foundation(?:\s*\(ppcf\))?)$/i.test(text))return 'Pan Pacific Conservation Foundation (PPCF)';return !text||/^donor belum tercatat$/i.test(text)?'Donor belum tercatat':text;}
  function canonicalId(id){return String(id||'').trim().replace(/^(?:COMMUNITY-|MONITORING-)(YG-)/i,'$1').toLowerCase();}
  function publicCopy(p){var copy=p.description||p.Temuan||p.Monitoring_Type||'';return /nursery|rumah bibit/i.test(p.title||p.Nama_Objek||'')&&/stok bibit/i.test(copy)?'Stok bibit dalam laporan masih menunggu verifikasi terhadap kapasitas rumah pembibitan.':copy;}
  function published(p){return !/pending|rejected|draft|unverified|menunggu|ditolak|belum diverifikasi/i.test(String(p.status||p.Status_Verifikasi||'').trim())&&p.published!==false&&p.verified!==false&&p.staffOnly!==true&&p.access!=='staff';}
  // These two instrument reports describe the same explicitly documented four-day installation.
  var eventGroups={'yg-20260901-201544-276':'temiang-ews-20260823','yg-20260901-202530-896':'temiang-ews-20260823'};
  function buildRecords(features,trainings,options){
    options=options||{};var seen={},rows=[],evidence={},objects={},attributions={};
    (options.attributions||[]).forEach(function(a){var id=canonicalId(a.evidenceId);if(id&&a.donor&&a.source&&!attributions[id])attributions[id]=a;});
    (options.donors||[]).forEach(function(donor){(donor.verifiedEvidence||[]).filter(published).forEach(function(row){var id=canonicalId(row.evidenceId);if(!evidence[id])evidence[id]={donor:donor.name,programme:(donor.programs||[]).find(function(p){return p.id===row.programmeId;}),row:row};});});
    (options.objects||features||[]).forEach(function(f){var p=f.properties||{};if(p.Object_ID&&published(p))objects[canonicalId(p.Object_ID)]=f;});
    function upsert(row,rank){
      var eventId=eventGroups[canonicalId(row.id)]||canonicalId(row.eventId)||canonicalId(row.id),previous=seen[eventId];
      row.links=[{url:row.url,label:row.label}];
      if(previous){
        var sameReport=canonicalId(previous.id)===canonicalId(row.id),keep=rank>previous.rank?row:previous;
        if(sameReport){
          var other=keep===row?previous:row;if(keep.donor==='Donor belum tercatat')keep.donor=other.donor;if(!keep.phase)keep.phase=other.phase;
          if(keep.asset!==other.asset)keep.photos=uniquePhotos(keep.photos.concat(other.photos));else if(!keep.photos.length)keep.photos=other.photos;
        }else{keep.photos=uniquePhotos(previous.photos.concat(row.photos));keep.links=previous.links.concat(row.links).filter(function(link,i,all){return all.findIndex(function(v){return v.url===link.url;})===i;});}
        keep.rank=Math.max(rank,previous.rank);rows[rows.indexOf(previous)]=keep;seen[eventId]=keep;
      }else{row.rank=rank;rows.push(row);seen[eventId]=row;}
    }
    (features||[]).forEach(function(feature){
      var p=feature.properties||{},target=p.targetFeatureProperties||{},id=p.Source_Report_ID||p.reportId||p.Object_ID;if(!id||!published(p))return;
      var attribution=attributions[canonicalId(id)]||attributions[canonicalId(p.Object_ID)],meta=evidence[canonicalId(id)]||evidence[canonicalId(p.Object_ID)],referenced=objects[canonicalId(p.Target_Object_ID)]||objects[canonicalId(target.Object_ID)],ref=referenced&&referenced.properties||{},phase=p.Fase||(attribution&&attribution.phase)||target.Fase||ref.Fase||(meta&&meta.programme&&meta.programme.phase)||(/phase\s*iii|fase\s*3/i.test(target.Ket||'')?'Fase 3':'');
      var donor=[p.Donor,attribution&&attribution.donor,target.Donor,ref.Donor,meta&&meta.donor].map(donorName).find(function(d){return d!=='Donor belum tercatat';})||'Donor belum tercatat',date=dateInfo(p.activityDate);
      if(eventGroups[canonicalId(id)]){date=dateInfo('2026-08-26');date.label='23–26 Agustus 2026';}
      upsert({id:id,eventId:p.Activity_ID||p.Event_ID,asset:p.Source_Type==='verified_report_asset',title:p.title||p.Nama_Objek||'Kegiatan',date:date,donor:donor,phase:phase,copy:publicCopy(p),photos:photos(p),url:'webgis.html?layer='+encodeURIComponent(p.Layer_ID||p.Source_Layer||'community_reports')+'&object='+encodeURIComponent(p.Object_ID||id),label:'Buka laporan di peta',kind:p.Source_Type==='monitoring_report'?'Monitoring':'Kegiatan'},(p.Source_Type==='verified_report_asset'?0:1000000)+(Number(p.Revision)||0));
    });
    (trainings||[]).forEach(function(row){var id=row.id;if(!id||!published(row))return;var attribution=attributions[canonicalId(id)],meta=evidence[canonicalId(id)];upsert({id:id,title:row.name||'Pelatihan',date:dateInfo(row.date),donor:donorName(row.donor||(attribution&&attribution.donor)||(meta&&meta.donor)),phase:(attribution&&attribution.phase)||meta&&meta.programme&&meta.programme.phase||'',copy:[row.topic,row.partner?'Mitra: '+row.partner:'',row.target?'Peserta: '+row.target:''].filter(Boolean).join(' · '),photos:photos(row),url:'capacity-building.html',label:'Lihat daftar pelatihan',kind:'Pelatihan'},0);});
    // Add dated, verified planting evidence only when it references an actual object in this village.
    Object.keys(evidence).forEach(function(id){var meta=evidence[id],f=objects[id],p=f&&f.properties;if(!p||!dateInfo(meta.row.activityDate).sort||seen[id]||!options.localObjectIds||options.localObjectIds.indexOf(id)<0)return;upsert({id:p.Object_ID,title:meta.row.evidenceTitle||p.Nama_Objek,date:dateInfo(meta.row.activityDate),donor:donorName(meta.donor),phase:meta.programme&&meta.programme.phase||'',copy:meta.row.note||'',photos:photos(p),url:'webgis.html?object='+encodeURIComponent(p.Object_ID),label:'Buka bukti penanaman',kind:'Penanaman'},0);});
    return rows.sort(function(a,b){return b.date.sort-a.date.sort||a.title.localeCompare(b.title);});
  }
  var mounted=null;
  function mount(features,trainings,options){
    options=options||{};
    if(mounted){mounted.update(buildRecords(features,trainings,options));return;}
    var section=document.getElementById('village-timeline');if(!section)return;
    var rows=[],year=document.getElementById('timeline-year'),donor=document.getElementById('timeline-donor'),list=document.getElementById('timeline-list'),count=document.getElementById('timeline-count'),limit=6,visible=[],signature='',pending=null;
    section.hidden=false;
    var context=document.getElementById('timeline-context');
    if(context){context.hidden=!(String(options.name||'').toLowerCase()==='sepahat'&&String(options.regency||'').toLowerCase()==='bengkalis');context.textContent='Sepahat bergabung dalam program Aramco Asia Singapore mulai Fase III (Juli 2025–Desember 2026). Timeline juga memuat kegiatan donor lainnya.';}
    function update(next){
      if(dialog&&dialog.open){pending=next;return;}
      var nextSignature=JSON.stringify(next);if(nextSignature===signature)return;signature=nextSignature;rows=next;
      var selectedYear=year.value,selectedDonor=donor.value;
      year.innerHTML='<option value="">Semua tahun</option>'+Array.from(new Set(rows.map(function(r){return r.date.year;}))).sort(function(a,b){return a==='unknown'?1:b==='unknown'?-1:Number(b)-Number(a);}).map(function(y){return '<option value="'+esc(y)+'">'+(y==='unknown'?'Tanggal belum tercatat':esc(y))+'</option>';}).join('');
      donor.innerHTML='<option value="">Semua donor</option>'+Array.from(new Set(rows.map(function(r){return r.donor;}))).sort().map(function(d){return '<option>'+esc(d)+'</option>';}).join('');
      year.value=Array.from(year.options).some(function(o){return o.value===selectedYear;})?selectedYear:'';donor.value=Array.from(donor.options).some(function(o){return o.value===selectedDonor;})?selectedDonor:'';render();
    }
    function card(row,index){
      var images=row.photos.map(function(url,i){return '<button type="button" class="vt-photo" data-timeline-row="'+index+'" data-timeline-photo="'+i+'" aria-label="Perbesar foto '+(i+1)+' · '+esc(row.title)+'"><img src="'+esc(preview(url))+'" alt="Dokumentasi '+esc(row.title)+' · foto '+(i+1)+'" loading="lazy" decoding="async"><span>Foto '+(i+1)+' · Perbesar</span></button>';});
      return '<article class="vt-event"><div class="vt-date">'+esc(row.date.label)+'</div><div class="vt-body"><div class="vt-tags"><span>'+esc(row.donor)+'</span><span>'+esc(row.kind)+'</span>'+(row.phase?'<span>'+esc(row.phase)+'</span>':'')+'</div><h3>'+esc(row.title)+'</h3>'+(row.copy?'<p>'+esc(row.copy.length>350?row.copy.slice(0,347)+'…':row.copy)+'</p>':'')+(images.length?'<div class="vt-photos">'+images.slice(0,3).join('')+'</div>'+(images.length>3?'<details><summary>Lihat '+(images.length-3)+' foto lainnya</summary><div class="vt-photos">'+images.slice(3).join('')+'</div></details>':''):'<p class="vt-no-photo">Foto belum tersedia pada catatan ini.</p>')+(row.links||[]).map(function(link,i){return '<a href="'+esc(link.url)+'" target="_blank" rel="noopener">'+esc(i?'Laporan terkait '+(i+1):link.label)+' ↗</a>';}).join(' · ')+'</div></article>';
    }
    function render(){
      visible=rows.filter(function(r){return (!year.value||r.date.year===year.value)&&(!donor.value||r.donor===donor.value);});
      count.textContent=visible.length+' catatan kegiatan';
      var shown=visible.slice(0,limit),dated=shown.filter(function(r){return r.date.sort;}),undated=shown.filter(function(r){return !r.date.sort;});
      list.innerHTML=(dated.map(function(r){return card(r,visible.indexOf(r));}).join(''))+(undated.length?'<h3 class="vt-undated">Tanggal belum tercatat</h3>'+undated.map(function(r){return card(r,visible.indexOf(r));}).join(''):'');
      if(!visible.length)list.innerHTML='<p class="vt-empty">Belum ada catatan yang sesuai dengan filter.</p>';
      var more=document.getElementById('timeline-more');more.hidden=limit>=visible.length;more.textContent='Lihat '+Math.min(6,visible.length-limit)+' catatan berikutnya';
    }
    year.addEventListener('change',function(){limit=6;render();});donor.addEventListener('change',function(){limit=6;render();});
    document.getElementById('timeline-more').addEventListener('click',function(){limit+=6;render();});
    var dialog=document.getElementById('timeline-photo-dialog'),lastButton=null;
    list.addEventListener('click',function(event){var button=event.target.closest('[data-timeline-photo]');if(!button)return;var row=visible[Number(button.dataset.timelineRow)],url=row.photos[Number(button.dataset.timelinePhoto)];lastButton=button;document.getElementById('timeline-photo-image').src=preview(url);document.getElementById('timeline-photo-caption').textContent=row.title+' · '+row.date.label;document.getElementById('timeline-photo-source').href=url;dialog.showModal();});
    list.addEventListener('error',function(event){if(event.target.tagName==='IMG'){event.target.hidden=true;event.target.parentNode.querySelector('span').textContent='Foto tidak termuat · Buka foto';}},true);
    document.getElementById('timeline-photo-close').addEventListener('click',function(){dialog.close();});
    dialog.addEventListener('close',function(){document.getElementById('timeline-photo-image').removeAttribute('src');if(lastButton)lastButton.focus();if(pending){var next=pending;pending=null;update(next);}});
    mounted={update:update};update(buildRecords(features,trainings,options));
  }
  var api={buildRecords:buildRecords,dateInfo:dateInfo,mount:mount};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.VillageActivityTimeline=api;
})(typeof window!=='undefined'?window:this);
