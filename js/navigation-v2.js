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

  window.addEventListener('yg:languagechange',function(event){
    if(event&&event.detail&&event.detail.language==='en')ensureAutoI18n();
  });

  function applyStaffAccount(nav){
    var link=nav.querySelector('a[href="staff-login.html"]');
    if(!link)return;
    var session=null;
    try{session=JSON.parse(sessionStorage.getItem('ygEditorSessionV1')||'null');}catch(error){}
    if(!session||!session.token||!session.username||Number(session.expiresAt||0)<=Date.now()){
      try{sessionStorage.removeItem('ygEditorSessionV1');}catch(error){}
      return;
    }
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
    document.querySelectorAll('[data-yg-navigation]').forEach(function(nav){
      applyStaffAccount(nav);
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
