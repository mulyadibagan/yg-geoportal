(function(){
  'use strict';

  if(!document.getElementById('report-form')) return;

  function refreshLeafletLayout(){
    window.dispatchEvent(new Event('resize'));
    window.setTimeout(function(){ window.dispatchEvent(new Event('resize')); },120);
    window.setTimeout(function(){ window.dispatchEvent(new Event('resize')); },350);
  }

  document.addEventListener('change',function(event){
    var target = event.target;
    if(!target || target.id !== 'maintenance-report-radio' || !target.checked) return;
    window.setTimeout(refreshLeafletLayout,20);
  });

  var geometrySection = document.getElementById('geometry-section');
  if(geometrySection && typeof MutationObserver === 'function'){
    new MutationObserver(function(){
      if(!geometrySection.hidden) refreshLeafletLayout();
    }).observe(geometrySection,{attributes:true,attributeFilter:['hidden','style','class']});
  }

  window.addEventListener('load',function(){
    var maintenanceRadio = document.getElementById('maintenance-report-radio');
    if(maintenanceRadio && maintenanceRadio.checked) refreshLeafletLayout();
  });
})();
