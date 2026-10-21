(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.YG_DAYUN_POINT_SHORTCUTS=api;})(typeof window!=='undefined'?window:globalThis,function(){
 'use strict';
 function mount({container,map,enabled,selectBounds,deleteSelection,cancelSelection,addPoint,doc=document,win=window}){
  if(!container)return {focus(){},dispose(){}};
  let drag=null,space=false,suppressUntil=0,rectangle=null;
  const typing=t=>!!t?.closest?.('input,textarea,select,button,[contenteditable="true"],[role="textbox"],.leaflet-control,.leaflet-marker-icon');
  const focus=()=>container.focus?.({preventScroll:true});
  const focused=()=>container.contains(doc.activeElement);
  const point=e=>map.mouseEventToLatLng(e);
  function finish(){if(drag?.wasDragging)map.dragging?.enable();drag=null;if(rectangle)map.removeLayer(rectangle);rectangle=null;}
  function down(e){
   if(e.button!==0||e.sourceCapabilities?.firesTouchEvents||space||e.ctrlKey||e.metaKey||e.altKey||typing(e.target)||!enabled())return;
   finish();drag={x:e.clientX,y:e.clientY,start:point(e),moved:false,wasDragging:map.dragging?.enabled?.()};
  }
  function move(e){
   if(!drag)return;if(!enabled()){finish();return;}
   // Let Leaflet see mousedown and reset its previous drag flag, then stop its
   // move handler in capture phase before the map can pan under the selection.
   if(!drag.suspended){map.dragging?.disable();drag.suspended=true;}
   if(!drag.moved&&Math.hypot(e.clientX-drag.x,e.clientY-drag.y)<6)return;
   drag.moved=true;e.preventDefault();const bounds=[drag.start,point(e)];
   if(rectangle)rectangle.setBounds(bounds);else rectangle=L.rectangle(bounds,{color:'#2563eb',weight:2,fillOpacity:.08,interactive:false}).addTo(map);
  }
  function up(e){
   if(!drag)return;const moved=drag.moved,bounds=moved&&enabled()?L.latLngBounds(drag.start,point(e)):null;
   if(moved){suppressUntil=Date.now()+350;e.preventDefault();}finish();focus();if(bounds)selectBounds(bounds);
  }
  function click(e){if(Date.now()<suppressUntil){e.preventDefault();e.stopImmediatePropagation();}}
  function keydown(e){
   if(typing(e.target)||!focused()||!enabled()||e.ctrlKey||e.metaKey||e.altKey)return;
   if(e.code==='Space'||e.key===' '){space=true;e.preventDefault();return;}
   if(e.repeat)return;
   if(e.key==='Delete'){e.preventDefault();deleteSelection();}
   else if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation?.();finish();cancelSelection();}
   else if(e.key?.toLowerCase()==='a'){e.preventDefault();addPoint();}
  }
  function keyup(e){if(e.code==='Space'||e.key===' ')space=false;}
  function blur(){space=false;finish();}
  container.addEventListener('mousedown',down,true);container.addEventListener('click',click,true);
  doc.addEventListener('mousemove',move,true);doc.addEventListener('mouseup',up);
  win.addEventListener('keydown',keydown,true);win.addEventListener('keyup',keyup);win.addEventListener('blur',blur);
  return {focus,dispose(){blur();container.removeEventListener('mousedown',down,true);container.removeEventListener('click',click,true);doc.removeEventListener('mousemove',move,true);doc.removeEventListener('mouseup',up);win.removeEventListener('keydown',keydown,true);win.removeEventListener('keyup',keyup);win.removeEventListener('blur',blur);}};
 }
 return {mount};
});
