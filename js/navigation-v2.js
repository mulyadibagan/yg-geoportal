(function(){
  'use strict';

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
