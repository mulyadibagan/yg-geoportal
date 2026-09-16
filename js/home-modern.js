(function(){'use strict';
var KEY='ygEditorSessionV1';
function session(){try{var s=JSON.parse(localStorage.getItem(KEY)||sessionStorage.getItem(KEY)||'null');if(!s||!s.token||Number(s.expiresAt||0)<=Date.now())return null;return s}catch(e){return null}}
function setRspoVisibility(){var card=document.querySelector('.home-rspo-card');var section=card&&card.closest('.home-collaboration');if(!section)return;var s=session();section.hidden=!s;if(s){section.setAttribute('data-staff-only-module','');var head=section.querySelector('.home-collaboration__head span');if(head)head.textContent='PEMANTAUAN INTERNAL STAF';var action=card.querySelector('.home-faperta-card__action');if(action)action.innerHTML='Buka modul internal <i aria-hidden="true">→</i>';}}
setRspoVisibility();
window.addEventListener('storage',function(e){if(e.key===KEY)setRspoVisibility()});
var script=document.createElement('script');script.src='js/home-modern-base.js?v=20260916-rspo-internal1';script.async=false;document.head.appendChild(script);
})();