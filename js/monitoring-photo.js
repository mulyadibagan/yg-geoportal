(() => {
  "use strict";
  let gallery=[];
  let index=0;

  function driveId(url){
    var s=String(url||'');
    var m=s.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:[^#]*&)?id=)([A-Za-z0-9_-]+)/i)||s.match(/[?&]id=([A-Za-z0-9_-]+)/i);
    return m?m[1]:'';
  }
  function urls(url){
    var original=String(url||'').trim(),id=driveId(original);
    return id?{
      thumb:'https://drive.google.com/thumbnail?id='+encodeURIComponent(id)+'&sz=w1200',
      high:'https://drive.google.com/uc?export=view&id='+encodeURIComponent(id),
      original:original
    }:{thumb:original,high:original,original:original};
  }
  function box(){
    var el=document.getElementById('monitor-photo-lightbox');
    if(el)return el;
    el=document.createElement('div');
    el.id='monitor-photo-lightbox';
    el.className='monitor-photo-lightbox';
    el.setAttribute('aria-hidden','true');
    el.innerHTML='<div class="monitor-photo-backdrop" data-photo-close></div><section class="monitor-photo-panel" role="dialog" aria-modal="true"><button class="monitor-photo-close" type="button" data-photo-close>×</button><button class="monitor-photo-nav prev" type="button" data-photo-prev>‹</button><div class="monitor-photo-stage"><div class="monitor-photo-loading">Memuat foto resolusi tinggi…</div><img alt="Dokumentasi monitoring"></div><button class="monitor-photo-nav next" type="button" data-photo-next>›</button><footer><span class="monitor-photo-counter"></span><a class="monitor-photo-full" target="_blank" rel="noopener noreferrer">Buka foto resolusi penuh ↗</a></footer></section>';
    document.body.appendChild(el);return el;
  }
  function scan(){
    document.querySelectorAll('.monitor-photo-trigger').forEach(function(btn){
      if(btn.dataset.ready)return;
      var u=urls(btn.dataset.photoUrl),img=btn.querySelector('img');
      btn.dataset.ready='1';btn.dataset.high=u.high;btn.dataset.original=u.original;
      if(img){img.src=u.thumb;img.onerror=function(){this.alt='Foto tidak dapat dimuat';this.classList.add('photo-error');};}
    });
    gallery=Array.from(document.querySelectorAll('.monitor-photo-trigger')).map(function(btn){return{high:btn.dataset.high||btn.dataset.photoUrl,original:btn.dataset.original||btn.dataset.photoUrl,title:btn.dataset.photoTitle||'Dokumentasi monitoring'};});
  }
  function render(){
    if(!gallery.length)return;var el=box(),item=gallery[index],img=el.querySelector('img'),loading=el.querySelector('.monitor-photo-loading');
    loading.style.display='block';loading.textContent='Memuat foto resolusi tinggi…';img.style.display='none';
    img.onload=function(){loading.style.display='none';img.style.display='block';};
    img.onerror=function(){loading.textContent='Foto tidak dapat ditampilkan. Gunakan tombol buka foto resolusi penuh.';};
    img.src=item.high;img.alt=item.title;el.querySelector('.monitor-photo-full').href=item.original||item.high;el.querySelector('.monitor-photo-counter').textContent='Foto '+(index+1)+' dari '+gallery.length;
    el.querySelector('[data-photo-prev]').hidden=gallery.length<2;el.querySelector('[data-photo-next]').hidden=gallery.length<2;
  }
  function openAt(i){scan();index=Math.max(0,Math.min(i,gallery.length-1));var el=box();render();el.classList.add('open');el.setAttribute('aria-hidden','false');document.body.classList.add('photo-open');}
  function close(){var el=document.getElementById('monitor-photo-lightbox');if(!el)return;el.classList.remove('open');el.setAttribute('aria-hidden','true');document.body.classList.remove('photo-open');}
  function move(n){index=(index+n+gallery.length)%gallery.length;render();}
  document.addEventListener('click',function(e){
    var trigger=e.target.closest('.monitor-photo-trigger');if(trigger){e.preventDefault();scan();openAt(Array.from(document.querySelectorAll('.monitor-photo-trigger')).indexOf(trigger));return;}
    if(e.target.closest('[data-photo-close]'))close();
    if(e.target.closest('[data-photo-prev]'))move(-1);
    if(e.target.closest('[data-photo-next]'))move(1);
  });
  document.addEventListener('keydown',function(e){var el=document.getElementById('monitor-photo-lightbox');if(!el||!el.classList.contains('open'))return;if(e.key==='Escape')close();if(e.key==='ArrowLeft')move(-1);if(e.key==='ArrowRight')move(1);});
  new MutationObserver(function(){requestAnimationFrame(scan);}).observe(document.body,{childList:true,subtree:true});
  scan();
})();
