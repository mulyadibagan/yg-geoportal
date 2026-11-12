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
    return result;
  }
  function preview(url){var m=url.match(/drive\.google\.com\/file\/d\/([\w-]+)/)||url.match(/drive\.google\.com\/.*[?&]id=([\w-]+)/);return m?'https://drive.google.com/thumbnail?id='+m[1]+'&sz=w1200':url;}
  function donorName(value){var text=String(value||'').trim();if(/^(yayasan\s+)?penabulu$/i.test(text))return 'Yayasan Penabulu';if(/^(gec|global environment centre(?:\s*\(gec\))?)$/i.test(text))return 'Global Environment Centre';return text||'Donor belum tercatat';}
  function buildRecords(features,trainings){
    var seen={},rows=[];
    (features||[]).forEach(function(feature){
      var p=feature.properties||{},target=p.targetFeatureProperties||{},id=p.Source_Report_ID||p.reportId||p.Object_ID;
      if(!id||seen[id])return;seen[id]=true;
      rows.push({id:id,title:p.title||p.Nama_Objek||'Kegiatan',date:dateInfo(p.activityDate),donor:donorName(p.Donor||target.Donor),copy:p.description||p.Temuan||p.Monitoring_Type||'',photos:photos(p),url:'webgis.html?layer='+encodeURIComponent(p.Layer_ID||p.Source_Layer||'community_reports')+'&object='+encodeURIComponent(p.Object_ID||id),label:'Buka laporan di peta',kind:p.Source_Type==='monitoring_report'?'Monitoring':'Kegiatan'});
    });
    (trainings||[]).forEach(function(row){var id=row.id;if(!id||seen[id])return;seen[id]=true;rows.push({id:id,title:row.name||'Pelatihan',date:dateInfo(row.date),donor:donorName(row.donor),copy:[row.topic,row.partner?'Mitra: '+row.partner:'',row.target?'Peserta: '+row.target:''].filter(Boolean).join(' · '),photos:photos(row),url:'capacity-building.html',label:'Lihat daftar pelatihan',kind:'Pelatihan'});});
    return rows.sort(function(a,b){return b.date.sort-a.date.sort||a.title.localeCompare(b.title);});
  }
  function mount(features,trainings){
    var section=document.getElementById('village-timeline');if(!section)return;
    var rows=buildRecords(features,trainings),year=document.getElementById('timeline-year'),donor=document.getElementById('timeline-donor'),list=document.getElementById('timeline-list'),count=document.getElementById('timeline-count'),limit=6,visible=[];
    section.hidden=false;
    year.innerHTML='<option value="">Semua tahun</option>'+Array.from(new Set(rows.map(function(r){return r.date.year;}))).sort().reverse().map(function(y){return '<option value="'+esc(y)+'">'+(y==='unknown'?'Tanggal belum tercatat':esc(y))+'</option>';}).join('');
    donor.innerHTML='<option value="">Semua donor</option>'+Array.from(new Set(rows.map(function(r){return r.donor;}))).sort().map(function(d){return '<option>'+esc(d)+'</option>';}).join('');
    function card(row,index){
      var images=row.photos.map(function(url,i){return '<button type="button" class="vt-photo" data-timeline-row="'+index+'" data-timeline-photo="'+i+'" aria-label="Perbesar foto '+(i+1)+' · '+esc(row.title)+'"><img src="'+esc(preview(url))+'" alt="Dokumentasi '+esc(row.title)+' · foto '+(i+1)+'" loading="lazy" decoding="async"><span>Foto '+(i+1)+' · Perbesar</span></button>';});
      return '<article class="vt-event"><div class="vt-date">'+esc(row.date.label)+'</div><div class="vt-body"><div class="vt-tags"><span>'+esc(row.donor)+'</span><span>'+esc(row.kind)+'</span></div><h3>'+esc(row.title)+'</h3>'+(row.copy?'<p>'+esc(row.copy.length>350?row.copy.slice(0,347)+'…':row.copy)+'</p>':'')+(images.length?'<div class="vt-photos">'+images.slice(0,3).join('')+'</div>'+(images.length>3?'<details><summary>Lihat '+(images.length-3)+' foto lainnya</summary><div class="vt-photos">'+images.slice(3).join('')+'</div></details>':''):'<p class="vt-no-photo">Foto belum tersedia pada catatan ini.</p>')+'<a href="'+esc(row.url)+'" target="_blank" rel="noopener">'+esc(row.label)+' ↗</a></div></article>';
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
    dialog.addEventListener('close',function(){document.getElementById('timeline-photo-image').removeAttribute('src');if(lastButton)lastButton.focus();});
    render();
  }
  var api={buildRecords:buildRecords,dateInfo:dateInfo,mount:mount};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.VillageActivityTimeline=api;
})(typeof window!=='undefined'?window:this);
