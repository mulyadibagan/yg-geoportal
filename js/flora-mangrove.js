(function(){
  'use strict';
  var SOURCE='https://drive.google.com/file/d/1gwiTpEieu3N9waJ_fEQO1gM3O0jFFnXP/view?usp=sharing';
  var GALLERY_COUNTS={'rhizophora-apiculata':6,'rhizophora-mucronata':6,'sonneratia-alba':6,'sonneratia-ovata':6,'sonneratia-caseolaris':6,'avicennia-alba':6,'avicennia-lanata':6,'bruguiera-cylindrica':6,'bruguiera-gymnorhiza':6,'bruguiera-sexangula':6,'bruguiera-parviflora':6,'ceriops-tagal':6,'lumnitzera-littorea':6,'lumnitzera-racemosa':6,'excoecaria-agallocha':6,'scyphiphora-hydrophylacea':6,'nypa-fruticans':6,'xylocarpus-granatum':6,'xylocarpus-moluccensis':6,'heritiera-littoralis':6,'acanthus-ilicifolius':4,'acrostichum-speciosum':2,'acrostichum-aureum':2,'hibiscus-tiliaceus':2,'rotan-nasi':3,'oncosperma-tigillarium':1,'morinda-citrifolia':2,'terminalia-catappa':1,'teki-laut':2};
  var both=['Buruk Bakul','Kelapa Pati'];
  var data=[
    ['Bakau minyak/putih','Rhizophora apiculata','rhizophora-apiculata','Mangrove sejati','Least Concern',both],
    ['Blukap / bakau merah','Rhizophora mucronata','rhizophora-mucronata','Mangrove sejati','Least Concern',both],
    ['Prepat','Sonneratia alba','sonneratia-alba','Mangrove sejati','Least Concern',both],
    ['Kedabu','Sonneratia ovata','sonneratia-ovata','Mangrove sejati','Near Threatened',both],
    ['Berembang','Sonneratia caseolaris','sonneratia-caseolaris','Mangrove sejati','Least Concern',both,'Nama genus pada tabel Buruk Bakul berbeda dengan keterangan foto; katalog mengikuti keterangan foto.'],
    ['Api-api putih','Avicennia alba','avicennia-alba','Mangrove sejati','Least Concern',both],
    ['Api-api jambu','Avicennia lanata','avicennia-lanata','Mangrove sejati','Perlu verifikasi',both,'Laporan mencatat status Vulnerable di Buruk Bakul tetapi Least Concern di Kelapa Pati; status perlu diverifikasi kembali.'],
    ['Boseng','Bruguiera cylindrica','bruguiera-cylindrica','Mangrove sejati','Least Concern',both],
    ['Tumu merah','Bruguiera gymnorhiza','bruguiera-gymnorhiza','Mangrove sejati','Least Concern',both],
    ['Tumu putih','Bruguiera sexangula','bruguiera-sexangula','Mangrove sejati','Least Concern',both],
    ['Lenggadai','Bruguiera parviflora','bruguiera-parviflora','Mangrove sejati','Least Concern',both],
    ['Tengar','Ceriops tagal','ceriops-tagal','Mangrove sejati','Least Concern',both],
    ['Sesop merah','Lumnitzera littorea','lumnitzera-littorea','Mangrove sejati','Least Concern',both],
    ['Sesop putih','Lumnitzera racemosa','lumnitzera-racemosa','Mangrove sejati','Least Concern',both],
    ['Bebetak','Excoecaria agallocha','excoecaria-agallocha','Mangrove sejati','Least Concern',both],
    ['Cingam','Scyphiphora hydrophylacea','scyphiphora-hydrophylacea','Mangrove sejati','Least Concern',both],
    ['Nipah','Nypa fruticans','nypa-fruticans','Mangrove sejati','Least Concern',both],
    ['Nyirih bunga','Xylocarpus granatum','xylocarpus-granatum','Mangrove sejati','Least Concern',both],
    ['Nyirih batu','Xylocarpus moluccensis','xylocarpus-moluccensis','Mangrove sejati','Least Concern',['Buruk Bakul']],
    ['Dungun','Heritiera littoralis','heritiera-littoralis','Mangrove sejati','Least Concern',['Buruk Bakul']],
    ['Jeruju','Acanthus ilicifolius','acanthus-ilicifolius','Mangrove sejati','Least Concern',both],
    ['Piai lasa','Acrostichum speciosum','acrostichum-speciosum','Mangrove sejati','Least Concern',['Buruk Bakul']],
    ['Piai raya','Acrostichum aureum','acrostichum-aureum','Mangrove sejati','Least Concern',both],
    ['Bebaghu','Hibiscus tiliaceus','hibiscus-tiliaceus','Mangrove asosiasi','Belum tercantum',both],
    ['Rotan nasi','Belum dicantumkan dalam laporan','rotan-nasi','Mangrove asosiasi','Belum tercantum',both,'Nama ilmiah tidak dicantumkan dalam laporan baseline.'],
    ['Nibung','Oncosperma tigillarium','oncosperma-tigillarium','Mangrove asosiasi','Belum tercantum',both],
    ['Mengkudu','Morinda citrifolia','morinda-citrifolia','Mangrove asosiasi','Belum tercantum',both],
    ['Ketapang','Terminalia catappa','terminalia-catappa','Mangrove asosiasi','Belum tercantum',both],
    ['Teki laut','Belum dicantumkan dalam laporan','teki-laut','Mangrove asosiasi','Belum tercantum',both,'Nama ilmiah tidak dicantumkan dalam laporan baseline.']
  ].map(function(item,index){return {id:index+1,local:item[0],scientific:item[1],slug:item[2],category:item[3],status:item[4],locations:item[5],note:item[6]||''};});

  var grid=document.getElementById('flora-grid');
  var search=document.getElementById('flora-search');
  var locationFilter=document.getElementById('location-filter');
  var categoryFilter=document.getElementById('category-filter');
  var statusFilter=document.getElementById('status-filter');
  var summary=document.getElementById('result-summary');
  var empty=document.getElementById('empty-state');
  var dialog=document.getElementById('flora-dialog');
  var dialogContent=document.getElementById('dialog-content');

  function escapeHtml(value){return String(value||'').replace(/[&<>'"]/g,function(char){return {'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char];});}
  function statusClass(status){if(status==='Near Threatened')return 'status-nt';if(status==='Vulnerable')return 'status-vu';if(status==='Perlu verifikasi')return 'status-verify';return '';}
  function imagePath(item){return 'assets/flora-mangrove/'+item.slug+'.webp';}
  function galleryPath(item,index){return 'assets/flora-mangrove/gallery/'+item.slug+'/'+index+'.webp';}
  var SPECIAL_GALLERY_LABELS={
    'sonneratia-alba':['F. AKAR','B. DAUN','C. BUNGA/PUTIK','A. POHON','E. BATANG','D. BUAH']
  };
  function galleryLabel(item,count,index){
    var complete=['A. POHON','B. DAUN','C. BUNGA/PUTIK','D. BUAH','E. BATANG','F. AKAR'];
    if(SPECIAL_GALLERY_LABELS[item.slug])return SPECIAL_GALLERY_LABELS[item.slug][index-1];
    if(count===6)return complete[index-1];
    return 'DOKUMENTASI '+index;
  }
  function galleryHtml(item){
    var count=GALLERY_COUNTS[item.slug]||1;
    var thumbs='';
    for(var index=1;index<=count;index++){
      thumbs+='<button type="button" class="dialog-gallery-thumb'+(index===1?' is-active':'')+'" data-gallery-index="'+index+'" data-gallery-label="'+escapeHtml(galleryLabel(item,count,index))+'" aria-label="'+escapeHtml(galleryLabel(item,count,index))+'"><img src="'+galleryPath(item,index)+'" alt="'+escapeHtml(galleryLabel(item,count,index))+' '+escapeHtml(item.local)+'" loading="lazy"><span>'+escapeHtml(galleryLabel(item,count,index))+'</span></button>';
    }
    return '<div class="dialog-gallery" data-gallery-slug="'+escapeHtml(item.slug)+'"><div class="dialog-gallery-stage"><img src="'+galleryPath(item,1)+'" alt="'+escapeHtml(galleryLabel(item,count,1))+' '+escapeHtml(item.local)+'"><div class="dialog-gallery-caption"><strong>'+escapeHtml(galleryLabel(item,count,1))+'</strong><span>1 / '+count+'</span></div></div><div class="dialog-gallery-thumbs">'+thumbs+'</div><p>Seluruh foto identifikasi yang tersedia pada laporan baseline.</p></div>';
  }
  function card(item){
    return '<article class="flora-card"><button type="button" data-flora-id="'+item.id+'" aria-label="Lihat detail '+escapeHtml(item.local)+'">'+
      '<div class="flora-image"><img src="'+imagePath(item)+'" alt="Dokumentasi '+escapeHtml(item.local)+'" loading="lazy"><span>'+escapeHtml(item.locations.length===2?'2 lokasi':item.locations[0])+'</span></div>'+
      '<div class="flora-card-body"><h3>'+escapeHtml(item.local)+'</h3><p class="scientific">'+escapeHtml(item.scientific)+'</p><div class="card-meta"><span class="tag">'+escapeHtml(item.category)+'</span><span class="tag '+statusClass(item.status)+'">'+escapeHtml(item.status)+'</span></div></div></button></article>';
  }
  function filtered(){
    var term=search.value.trim().toLocaleLowerCase('id');
    return data.filter(function(item){
      return (!term||item.local.toLocaleLowerCase('id').includes(term)||item.scientific.toLocaleLowerCase('id').includes(term))&&
        (locationFilter.value==='all'||item.locations.includes(locationFilter.value))&&
        (categoryFilter.value==='all'||item.category===categoryFilter.value)&&
        (statusFilter.value==='all'||item.status===statusFilter.value);
    });
  }
  function render(){
    var rows=filtered();
    grid.innerHTML=rows.map(card).join('');
    summary.textContent=rows.length+' dari '+data.length+' jenis ditampilkan';
    empty.hidden=rows.length>0;
  }
  function openDetail(item){
    dialogContent.innerHTML='<div class="dialog-layout">'+galleryHtml(item)+'<div class="dialog-copy">'+
      '<p class="eyebrow">'+escapeHtml(item.category.toUpperCase())+'</p><h2>'+escapeHtml(item.local)+'</h2><p class="scientific">'+escapeHtml(item.scientific)+'</p>'+
      '<dl class="dialog-details"><div><dt>Status konservasi</dt><dd><span class="tag '+statusClass(item.status)+'">'+escapeHtml(item.status)+'</span></dd></div><div><dt>Lokasi ditemukan</dt><dd>'+escapeHtml(item.locations.join(' dan '))+'</dd></div><div><dt>Sumber foto</dt><dd>Final Baseline Mangrove 2024</dd></div></dl>'+
      (item.note?'<p class="dialog-note"><strong>Catatan data:</strong> '+escapeHtml(item.note)+'</p>':'')+
      '<a class="dialog-source" href="'+SOURCE+'" target="_blank" rel="noopener">Buka laporan baseline →</a></div></div>';
    dialog.showModal();
  }
  [search,locationFilter,categoryFilter,statusFilter].forEach(function(control){control.addEventListener(control===search?'input':'change',render);});
  grid.addEventListener('click',function(event){var button=event.target.closest('[data-flora-id]');if(!button)return;var item=data.find(function(row){return row.id===Number(button.dataset.floraId)});if(item)openDetail(item);});
  document.getElementById('dialog-close').addEventListener('click',function(){dialog.close();});
  dialog.addEventListener('click',function(event){if(event.target===dialog)dialog.close();});
  dialogContent.addEventListener('click',function(event){
    var thumb=event.target.closest('[data-gallery-index]');
    if(!thumb)return;
    var gallery=thumb.closest('.dialog-gallery');
    var index=Number(thumb.dataset.galleryIndex);
    var item=data.find(function(row){return row.slug===gallery.dataset.gallerySlug;});
    if(!item)return;
    var stage=gallery.querySelector('.dialog-gallery-stage');
    stage.querySelector('img').src=galleryPath(item,index);
    stage.querySelector('img').alt=thumb.dataset.galleryLabel+' '+item.local;
    stage.querySelector('.dialog-gallery-caption strong').textContent=thumb.dataset.galleryLabel;
    stage.querySelector('.dialog-gallery-caption span').textContent=index+' / '+(GALLERY_COUNTS[item.slug]||1);
    gallery.querySelectorAll('.dialog-gallery-thumb').forEach(function(button){button.classList.toggle('is-active',button===thumb);});
  });
  var requested=new URLSearchParams(location.search).get('location');
  if(requested&&Array.from(locationFilter.options).some(function(option){return option.value===requested;}))locationFilter.value=requested;
  document.getElementById('stat-species').textContent=data.length;
  render();
})();
