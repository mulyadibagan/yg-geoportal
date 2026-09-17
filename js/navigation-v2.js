(function(){
  'use strict';

  function isEnglish(){
    if(window.YG_I18N&&window.YG_I18N.language)return window.YG_I18N.language==='en';
    try{return localStorage.getItem('yg-language')==='en';}catch(error){return document.documentElement.lang==='en';}
  }

  function ensureAutoI18n(){
    if(!isEnglish())return;
    if(window.YG_I18N_AUTO_READY || document.querySelector('script[data-yg-i18n-auto]')) return;
    var load=function(){
      if(window.YG_I18N_AUTO_READY || document.querySelector('script[data-yg-i18n-auto]')) return;
      var script=document.createElement('script');
      script.src='js/i18n-auto.js?v=20260826-aramco-public-copy1';
      script.async=true;
      script.setAttribute('data-yg-i18n-auto','1');
      document.head.appendChild(script);
    };
    if('requestIdleCallback' in window) requestIdleCallback(load,{timeout:1200});
    else setTimeout(load,300);
  }

  function readSession(){
    var session=null;
    try{
      session=JSON.parse(localStorage.getItem('ygEditorSessionV1')||sessionStorage.getItem('ygEditorSessionV1')||'null');
    }catch(error){}
    if(!session||!session.token||!session.username||Number(session.expiresAt||0)<=Date.now()){
      try{sessionStorage.removeItem('ygEditorSessionV1');}catch(error){}
      try{localStorage.removeItem('ygEditorSessionV1');}catch(error){}
      return null;
    }
    return session;
  }

  function applyStaffOnlyVisibility(session){
    document.querySelectorAll('[data-staff-only-module]').forEach(function(module){
      if(session){
        module.hidden=false;
      }else{
        module.hidden=true;
      }
    });

    /* RSPO is internal-only. Keep legacy markup hidden for public visitors
       even when an older HTML document is still cached by the browser/CDN. */
    document.querySelectorAll('a[href="sawit-riau-rspo.html"],a[href="staff-rspo-dashboard.html"]').forEach(function(link){
      var section=link.closest('.home-collaboration');
      if(section){
        if(session){ section.hidden=false; }
        else{ section.hidden=true; }
        section.setAttribute('data-staff-only-module','');
      }
      if(session && link.getAttribute('href')==='sawit-riau-rspo.html'){
        link.setAttribute('href','staff-rspo-dashboard.html');
      }
    });
  }

  window.addEventListener('yg:languagechange',function(event){
    if(event&&event.detail&&event.detail.language==='en')ensureAutoI18n();
  });

  function ensureToolsMenu(nav){
    if(!nav || nav.querySelector('[data-yg-tools-menu]')) return;
    var reportLink=nav.querySelector('a[href="report.html"]');
    var group=document.createElement('div');
    group.className='yg-nav-group';
    group.setAttribute('data-yg-tools-menu','');
    group.innerHTML='<button class="yg-nav-trigger" type="button" aria-expanded="false">Tools</button><div class="yg-nav-menu"><a href="drone-survey.html">Drone Survey &amp; Mapping<small>Rencana misi, QC foto, dan orthomosaic</small></a></div>';
    if(reportLink) nav.insertBefore(group,reportLink);
    else nav.appendChild(group);
  }

  function applyStaffAccount(nav,session){
    var link=nav.querySelector('a[href="staff-login.html"]');
    if(!link)return;
    if(!session)return;
    var label=String(session.name||session.username).trim();
    if(!label)return;
    link.textContent=label;
    link.href='admin-dashboard.html';
    link.classList.add('yg-staff-account-link');
    link.setAttribute('aria-label','Dashboard staf '+label);
    link.title='Dashboard staf';
  }

  function closeAll(nav){
    nav.querySelectorAll('.yg-nav-group.is-open').forEach(function(group){
      group.classList.remove('is-open');
      var trigger = group.querySelector('.yg-nav-trigger');
      if(trigger) trigger.setAttribute('aria-expanded','false');
      var menu = group.querySelector('.yg-nav-menu');
      if(menu){
        menu.style.removeProperty('display');
        menu.setAttribute('aria-hidden','true');
      }
    });
  }

  document.addEventListener('DOMContentLoaded',function(){
    var session=readSession();
    applyStaffOnlyVisibility(session);

    document.querySelectorAll('[data-yg-navigation]').forEach(function(nav){
      ensureToolsMenu(nav);
      applyStaffAccount(nav,session);
      var toggle = document.querySelector('[data-yg-nav-toggle="' + nav.id + '"]');
      if(toggle){
        toggle.addEventListener('click',function(){
          var open = nav.classList.toggle('is-open');
          toggle.setAttribute('aria-expanded',String(open));
          if(!open) closeAll(nav);
        });
      }

      nav.querySelectorAll('.yg-nav-trigger').forEach(function(trigger){
        trigger.addEventListener('click',function(event){
          event.preventDefault();
          event.stopPropagation();
          var group = trigger.closest('.yg-nav-group');
          var open = group && !group.classList.contains('is-open');
          closeAll(nav);
          if(group && open){
            group.classList.add('is-open');
            trigger.setAttribute('aria-expanded','true');
            var menu = group.querySelector('.yg-nav-menu');
            if(menu){
              menu.style.setProperty('display','grid','important');
              menu.setAttribute('aria-hidden','false');
            }
          }
        });
      });
    });

    ensureAutoI18n();

    document.addEventListener('click',function(event){
      document.querySelectorAll('[data-yg-navigation]').forEach(function(nav){
        var toggle = document.querySelector('[data-yg-nav-toggle="' + nav.id + '"]');
        if(nav.contains(event.target) || (toggle && toggle.contains(event.target))) return;
        closeAll(nav);
      });
    });

    document.addEventListener('keydown',function(event){
      if(event.key !== 'Escape') return;
      document.querySelectorAll('[data-yg-navigation]').forEach(function(nav){
        nav.classList.remove('is-open');
        closeAll(nav);
      });
      document.querySelectorAll('.yg-nav-toggle').forEach(function(toggle){
        toggle.setAttribute('aria-expanded','false');
      });
    });
  });
})();
