(function(){
 'use strict';
 var key=String(new URLSearchParams(location.search).get('key')||'').trim().toLowerCase();
 if(!['2942','2942.0','sk.4281/menlhk-pskl/pkps/psl.0/7/2020'].includes(key))return;
 var anchor=document.getElementById('sf-spatial-analysis');if(!anchor)return;
 var style=document.createElement('style');style.textContent='#sf-field-updates{margin-bottom:24px}#sf-field-updates .vp-section-head{margin-bottom:8px}.sf-field-report{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;padding:14px 0;border-top:1px solid #dce7e0}.sf-field-report details{min-width:0}.sf-field-report summary{cursor:pointer;line-height:1.5}.sf-field-report summary strong{font-size:15px}.sf-field-report summary small{display:block;margin:5px 0 0 18px;color:#61746a}.sf-field-report .sf-report-body{padding:10px 0 0 18px;overflow-wrap:anywhere;font-size:14px;line-height:1.65}.sf-report-body p{margin:8px 0}.sf-report-body figure{margin:14px 0}.sf-report-body img{display:block;width:100%;max-width:420px;max-height:420px;object-fit:contain;border-radius:10px;background:#edf3ef}.sf-report-body figcaption{font-size:12px;color:#61746a}.sf-field-report>button{align-self:start;white-space:normal}#village-map{height:560px;min-height:560px}.sf-report-popup{position:absolute!important;left:50%!important;top:18px!important;bottom:auto!important;transform:translateX(-50%)!important;margin:0!important;z-index:700}.sf-report-popup .leaflet-popup-tip-container{display:none}.sf-report-popup .leaflet-popup-content{margin:14px 18px;max-width:calc(100vw - 100px);overflow-wrap:anywhere}.sf-internal-popup strong{display:block;font-size:15px;line-height:1.4;white-space:normal}.sf-internal-popup p{margin:8px 0;line-height:1.5}.sf-internal-popup .sf-popup-meta{font-size:12px;color:#61746a}.sf-internal-popup .sf-popup-description{max-height:84px;overflow:auto;overscroll-behavior:contain}.sf-internal-popup img{display:block;width:100%;height:180px;object-fit:contain;background:#edf3ef;border-radius:8px}.sf-internal-popup button{width:100%;padding:8px}.sf-internal-popup button{min-height:36px;border:1px solid #bcd1c4;border-radius:8px;background:#eef7f1;color:#16563d;font-weight:700;cursor:pointer}.sf-report-pin{display:grid!important;place-items:center;background:#d97706;border:2px solid #fff;border-radius:50%;box-shadow:0 1px 7px #173e2c70;color:#fff;font-size:18px}.sf-loss-note{font-size:12px!important;line-height:1.5}@media(max-width:600px){#village-map{height:520px;min-height:520px}.sf-internal-popup img{height:150px}.sf-field-report{grid-template-columns:minmax(0,1fr)}.sf-field-report>button{justify-self:start;margin-left:18px}}';
 style.textContent+=' body.sf-map-expanded{overflow:hidden}#village-map.sf-map-fullscreen{position:fixed!important;inset:0!important;width:100vw!important;height:100dvh!important;min-height:0!important;max-height:none!important;border-radius:0!important;z-index:10000!important;background:#173e2c}.sf-map-fullscreen-control button{display:block;border:0;background:#fff;color:#173e2c;font:700 18px/30px sans-serif;width:34px;height:34px;cursor:pointer}.sf-map-fullscreen-control button:focus-visible{outline:3px solid #d97706;outline-offset:2px}';
 document.head.appendChild(style);
 var section=document.createElement('section');section.id='sf-field-updates';section.className='vp-card';section.setAttribute('aria-label','Update internal lapangan');
 section.innerHTML='<div class="vp-section-head"><div><span class="vp-kicker">CATATAN LAPANGAN</span><h2>Update internal lapangan</h2></div><span class="sf-internal-badge">INTERNAL · STAF YG</span></div><p role="status">Memuat laporan internal…</p>';
 anchor.before(section);
 var base='https://webgis-api.yayasangambut.org',urls=[],initial=window.YG_AUTH&&window.YG_AUTH.readStoredSession(),context=null,markerGroup=null,lossLayer=null,clipSvg=null,updates=[],entries=new Map(),photoPromises=new Map();
 function active(){var s=window.YG_AUTH&&window.YG_AUTH.readStoredSession();return s&&initial&&s.token===initial.token&&Number(s.expiresAt)>Date.now();}
 function clear(){if(context){context.map.closePopup();if(markerGroup){context.map.removeLayer(markerGroup);context.control.removeLayer(markerGroup);}if(lossLayer){context.map.removeLayer(lossLayer);context.control.removeLayer(lossLayer);}}if(clipSvg)clipSvg.remove();urls.forEach(function(url){URL.revokeObjectURL(url);});urls=[];photoPromises.clear();section.replaceChildren();section.hidden=true;}
 async function get(path){if(!active())throw Error('Login staf diperlukan.');var r=await fetch(base+path,{headers:{Authorization:'Bearer '+initial.token},cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('HTTP '+r.status);if(!active())throw Error('Sesi staf berubah.');return r;}
 function text(tag,value,parent){var node=document.createElement(tag);node.textContent=value||'';parent.appendChild(node);return node;}
 function date(update){return new Date(update.observedAt).toLocaleString('id-ID',{day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'Asia/Jakarta'})+' WIB';}
 function photoUrl(photo){if(!/^\/api\/staff\/social-forestry-sungai-linau-photo-\d{8}$/.test(photo.path))return Promise.reject(Error('Foto tidak sesuai.'));
  if(!photoPromises.has(photo.path))photoPromises.set(photo.path,get(photo.path).then(function(r){return r.blob();}).then(function(blob){if(!active())throw Error('Sesi berakhir.');var url=URL.createObjectURL(blob);urls.push(url);return url;}).catch(function(e){photoPromises.delete(photo.path);throw e;}));return photoPromises.get(photo.path);
 }
 function showPhoto(photo,host,title){var placeholder=text('p','Memuat foto internal…',host);photoUrl(photo).then(function(url){if(!active()||!host.isConnected)return;var link=document.createElement('a');link.href=url;link.target='_blank';link.rel='noopener';var img=document.createElement('img');img.src=url;img.alt=title;link.appendChild(img);placeholder.replaceWith(link);if(context)context.map.getContainer().dispatchEvent(new Event('sf-photo-loaded'));}).catch(function(){placeholder.textContent='Foto internal belum dapat dimuat. Muat ulang halaman untuk mencoba lagi.';});}
 function attachLoss(ctx){
  var map=ctx.map,geometry=ctx.feature.geometry,pane=map.createPane('sf-forest-loss');pane.style.cssText='z-index:350;width:100%;height:100%;pointer-events:none';
  var ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg'),defs=document.createElementNS(ns,'defs'),clip=document.createElementNS(ns,'clipPath'),path=document.createElementNS(ns,'path'),id='sf-loss-clip-'+L.stamp(map);
  clip.id=id;clip.setAttribute('clipPathUnits','userSpaceOnUse');path.setAttribute('clip-rule','evenodd');clip.appendChild(path);defs.appendChild(clip);svg.appendChild(defs);svg.setAttribute('aria-hidden','true');svg.style.cssText='position:absolute;width:0;height:0;overflow:hidden';map.getContainer().appendChild(svg);clipSvg=svg;pane.style.clipPath='url(#'+id+')';pane.style.webkitClipPath='url(#'+id+')';
  function ring(r){return r.map(function(c,i){var p=map.latLngToLayerPoint([c[1],c[0]]);return(i?'L':'M')+p.x.toFixed(1)+' '+p.y.toFixed(1);}).join('')+'Z';}
  function redraw(){var polygons=geometry.type==='Polygon'?[geometry.coordinates]:geometry.coordinates;path.setAttribute('d',polygons.map(function(p){return p.map(ring).join('');}).join(''));}
  map.on('move zoom viewreset resize',redraw);redraw();
  var bounds=L.geoJSON(ctx.feature).getBounds();
  lossLayer=L.tileLayer('https://tiles.globalforestwatch.org/umd_tree_cover_loss/latest/dynamic/{z}/{x}/{y}.png?render_type=true_color&tree_cover_density_threshold=30',{pane:'sf-forest-loss',bounds:bounds,opacity:.7,maxZoom:18,updateWhenIdle:true,keepBuffer:1,attribution:'UMD / Global Forest Watch · kehilangan tutupan pohon'}).addTo(map);
  ctx.control.addOverlay(lossLayer,'Bukaan hutan · kehilangan tutupan pohon (UMD/GFW)');
  var note=document.createElement('p');note.className='vp-caption sf-loss-note';note.textContent='Merah: kehilangan tutupan pohon UMD/GFW di dalam batas PS. Indikasi perubahan tutupan, bukan konfirmasi pembalakan ilegal.';map.getContainer().after(note);
  lossLayer.on('tileerror',function(){note.textContent='Sebagian layer bukaan hutan belum termuat. Coba muat ulang peta. Sumber: UMD/GFW.';});
  map.on('unload',function(){map.off('move zoom viewreset resize',redraw);svg.remove();});
 }
 function popup(update,entry){
  var root=document.createElement('div');root.className='sf-internal-popup';text('strong',update.title,root);text('p',date(update)+' · '+update.status,root).className='sf-popup-meta';
  if(update.photos&&update.photos[0])showPhoto(update.photos[0],root,update.title);
  text('p',update.description,root).className='sf-popup-description';
  var button=text('button','Buka catatan lengkap',root);button.type='button';button.addEventListener('click',function(){entry.details.open=true;entry.details.dispatchEvent(new Event('toggle'));entry.card.scrollIntoView({behavior:'smooth',block:'center'});});
  return root;
 }
 function attachMarkers(){if(!context||!active()||!updates.length)return;if(markerGroup)return;markerGroup=L.featureGroup().addTo(context.map);context.control.addOverlay(markerGroup,'Titik laporan internal');
  updates.forEach(function(update){var loc=update.location||{},lat=Number(loc.latitude),lng=Number(loc.longitude),entry=entries.get(update.id);if(!entry||!Number.isFinite(lat)||!Number.isFinite(lng))return;
   var marker=L.marker([lat,lng],{title:update.title,keyboard:true,icon:L.divIcon({className:'sf-report-pin',html:'<span aria-hidden="true">⌂</span>',iconSize:[28,28],iconAnchor:[14,14]})}).bindTooltip(update.title).bindPopup(function(){return popup(update,entry);},{className:'sf-report-popup',minWidth:240,maxWidth:340,maxHeight:Math.max(260,context.map.getSize().y-90),autoPan:false,keepInView:false,autoPanPaddingTopLeft:[18,18],autoPanPaddingBottomRight:[18,18]}).addTo(markerGroup);
   entry.marker=marker;entry.button.disabled=false;
   marker.on('popupopen',function(){var container=context.map.getContainer();container.appendChild(marker.getPopup().getElement());var refresh=function(){if(marker.isPopupOpen())marker.getPopup().update();};container.addEventListener('sf-photo-loaded',refresh,{once:true});});
  });
 }

 function attachFullscreen(ctx){
  var map=ctx.map,container=map.getContainer(),expanded=false,previousOverflow='',previousFocus=null;
  var control=L.control({position:'topleft'}),button;
  function resize(){map.invalidateSize({pan:false});if(map.getPopup&&map.getPopup())map.getPopup().update();}
  function setExpanded(value){
   if(expanded===value)return;expanded=value;
   if(value){previousOverflow=document.body.style.overflow;previousFocus=document.activeElement;document.body.style.overflow='hidden';}
   container.classList.toggle('sf-map-fullscreen',value);document.body.classList.toggle('sf-map-expanded',value);
   if(!value)document.body.style.overflow=previousOverflow;
   button.textContent=value?'✕':'⛶';button.title=value?'Keluar layar penuh':'Peta layar penuh';button.setAttribute('aria-label',button.title);button.setAttribute('aria-pressed',String(value));
   requestAnimationFrame(function(){resize();button.focus({preventScroll:true});if(!value){container.scrollIntoView({block:'center'});if(previousFocus&&previousFocus.isConnected)previousFocus.focus({preventScroll:true});}});
  }
  control.onAdd=function(){var box=L.DomUtil.create('div','leaflet-bar sf-map-fullscreen-control');button=L.DomUtil.create('button','',box);button.type='button';button.textContent='⛶';button.title='Peta layar penuh';button.setAttribute('aria-label',button.title);button.setAttribute('aria-pressed','false');button.setAttribute('aria-controls',container.id);L.DomEvent.disableClickPropagation(box);L.DomEvent.disableScrollPropagation(box);button.addEventListener('click',function(){setExpanded(!expanded);});return box;};
  control.addTo(map);
  function escape(event){if(expanded&&event.key==='Escape'){event.preventDefault();setExpanded(false);}}
  document.addEventListener('keydown',escape);
  map.on('unload',function(){if(expanded){document.body.style.overflow=previousOverflow;document.body.classList.remove('sf-map-expanded');}document.removeEventListener('keydown',escape);});
 }

 function onMap(ctx){if(context||!active())return;context=ctx;attachFullscreen(ctx);attachLoss(ctx);attachMarkers();}
 document.addEventListener('yg:ps-map-ready',function(event){onMap(event.detail);});
 if(window.YG_PS_PROFILE_MAP)onMap(window.YG_PS_PROFILE_MAP);
 get('/api/staff/social-forestry-sungai-linau-field-updates').then(function(r){return r.json();}).then(function(data){
  if(!active()||data.access!=='staff_only'||data.profileKey!=='2942.0')throw Error('Data tidak sesuai profil.');
  updates=data.updates||[];section.querySelector('[role=status]').textContent=updates.length+' laporan · buka judul untuk catatan dan foto.';
  updates.forEach(function(update){
   var card=document.createElement('article');card.className='sf-field-report';var details=document.createElement('details'),summary=document.createElement('summary');text('strong',update.title,summary);text('small',date(update)+' · '+update.status,summary);details.appendChild(summary);
   var body=document.createElement('div');body.className='sf-report-body';text('p',update.description,body);text('p',update.verificationNote,body);var loc=update.location||{};text('p','Lokasi: '+[loc.village,loc.district,loc.regency].filter(Boolean).join(' · '),body);text('p',loc.coordinateSource,body);text('p',loc.boundaryNote,body);text('p','Tindak lanjut: '+update.followup,body);
   var photosLoaded=false;details.addEventListener('toggle',function(){if(!details.open||photosLoaded)return;photosLoaded=true;(update.photos||[]).forEach(function(photo){var figure=document.createElement('figure');body.appendChild(figure);showPhoto(photo,figure,update.title);text('figcaption',photo.caption,figure);});});
   details.appendChild(body);card.appendChild(details);var button=text('button','Lihat titik pada peta',card);button.type='button';button.className='vp-button vp-button--quiet';button.disabled=true;var entry={card:card,details:details,button:button,marker:null};entries.set(update.id,entry);
   button.addEventListener('click',function(){if(!context||!entry.marker)return;markerGroup.addTo(context.map);context.map.setView(entry.marker.getLatLng(),17,{animate:false});entry.marker.openPopup();context.map.getContainer().scrollIntoView({behavior:'smooth',block:'center'});});
   section.appendChild(card);
  });attachMarkers();
 }).catch(function(){if(!active()){clear();return;}section.querySelector('[role=status]').textContent='Update internal belum dapat dimuat. Silakan muat ulang halaman.';});
 window.addEventListener('storage',function(event){if(event.key==='ygEditorSessionV1'&&!active())clear();});
 window.addEventListener('unload',clear);
})();
