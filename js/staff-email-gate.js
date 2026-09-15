(function(){
  'use strict';

  var STORAGE_KEY = 'yg-staff-email';
  var EMAIL_PATTERN = /^[^\s@]+@yayasangambut\.org$/i;

  function reveal(email){
    document.querySelectorAll('[data-staff-access]').forEach(function(node){ node.hidden = true; });
    document.querySelectorAll('[data-staff-protected]').forEach(function(node){ node.hidden = false; });
    document.querySelectorAll('#prepost-staff-email').forEach(function(input){
      if(!input.value) input.value = email;
    });
    window.dispatchEvent(new CustomEvent('yg:staff-access-granted',{detail:{email:email}}));
  }

  document.addEventListener('DOMContentLoaded',function(){
    if(!document.body.hasAttribute('data-require-staff')) return;
    var form = document.querySelector('[data-staff-access-form]');
    var input = document.querySelector('[data-staff-access-email]');
    var status = document.querySelector('[data-staff-access-status]');
    var remembered = '';
    try{ remembered = sessionStorage.getItem(STORAGE_KEY) || ''; }catch(error){}

    if(EMAIL_PATTERN.test(remembered)){
      reveal(remembered);
      return;
    }

    if(form){
      form.addEventListener('submit',function(event){
        event.preventDefault();
        var email = String(input && input.value || '').trim().toLowerCase();
        if(!EMAIL_PATTERN.test(email)){
          if(status) status.textContent = 'Gunakan email resmi dengan domain @yayasangambut.org.';
          if(input) input.focus();
          return;
        }
        try{ sessionStorage.setItem(STORAGE_KEY,email); }catch(error){}
        reveal(email);
      });
    }
  });
})();
