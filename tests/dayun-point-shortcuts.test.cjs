const test=require('node:test'),assert=require('node:assert/strict');
const shortcuts=require('../js/dayun-point-shortcuts.js');
function fixture(){
 const target=()=>({handlers:new Map(),addEventListener(k,f){this.handlers.set(k,f)},removeEventListener(k){this.handlers.delete(k)},emit(k,e={}){return this.handlers.get(k)?.({button:0,clientX:0,clientY:0,target:this,preventDefault(){this.prevented=true},stopImmediatePropagation(){this.stopped=true},...e})}});
 const container=target(),doc=target(),win=target();let enabled=true,dragging=true,selected=[],deleted=0,undone=0,added=0,cancelled=0,rectangles=0,removed=0;
 container.contains=t=>t===container;container.focus=()=>doc.activeElement=container;doc.activeElement=container;
 global.L={rectangle:()=>{rectangles++;return{addTo(){return this},setBounds(){}}},latLngBounds:(a,b)=>({a,b})};
 const tool=shortcuts.mount({container,doc,win,map:{dragging:{enabled:()=>dragging,disable(){dragging=false},enable(){dragging=true}},mouseEventToLatLng:e=>({lat:e.clientY,lng:e.clientX}),removeLayer(){removed++;}},enabled:()=>enabled,selectBounds:b=>selected.push(b),deleteSelection:()=>deleted++,undoDelete:()=>undone++,cancelSelection:()=>cancelled++,addPoint:()=>added++});
 return{container,doc,win,tool,enable:v=>enabled=v,state:()=>({dragging,selected,deleted,undone,added,cancelled,rectangles,removed})};
}
test('Space drag selects once without a toolbar, suppresses its click and restores map panning',()=>{
 const s=fixture();s.win.emit('keydown',{code:'Space'});s.container.emit('mousedown');assert.equal(s.state().dragging,true);s.doc.emit('mousemove',{clientX:3});assert.equal(s.state().dragging,false);assert.equal(s.state().rectangles,0);s.doc.emit('mousemove',{clientX:40,clientY:50});s.doc.emit('mouseup',{clientX:40,clientY:50});
 assert.equal(s.state().selected.length,1);assert.equal(s.state().dragging,true);assert.equal(s.state().removed,1);
 let stopped=false;s.container.emit('click',{stopImmediatePropagation(){stopped=true}});assert.equal(stopped,true);
 s.win.emit('keydown',{key:'Delete'});assert.equal(s.state().deleted,1);s.tool.dispose();assert.equal(s.doc.handlers.size,0);assert.equal(s.win.handlers.size,0);
});
test('Plain drag pans, a normal click does not box-select, and marker handles retain dragging',()=>{
 const s=fixture();s.container.emit('mousedown');assert.equal(s.state().dragging,true);s.doc.emit('mousemove',{clientX:50});assert.equal(s.state().dragging,true);s.doc.emit('mouseup');assert.equal(s.state().selected.length,0);
 s.container.emit('mousedown');s.doc.emit('mouseup');assert.equal(s.state().selected.length,0);
 s.container.emit('mousedown',{target:{closest:()=>true}});assert.equal(s.state().dragging,true);s.tool.dispose();
});
test('Delete never handles typing, repeated keys, inactive maps or another focused panel',()=>{
 const s=fixture();s.win.emit('keydown',{key:'Delete',target:{closest:()=>true}});s.win.emit('keydown',{key:'Delete',repeat:true});s.enable(false);s.win.emit('keydown',{key:'Delete'});s.enable(true);s.doc.activeElement={};s.win.emit('keydown',{key:'Delete'});assert.equal(s.state().deleted,0);
 s.container.focus();s.win.emit('keydown',{key:'a'});assert.equal(s.state().added,1);s.win.emit('keydown',{code:'Space'});s.container.emit('mousedown');s.doc.emit('mousemove',{clientX:50});s.win.emit('keydown',{key:'Escape'});assert.equal(s.state().cancelled,1);assert.equal(s.state().dragging,true);s.doc.emit('mouseup');assert.equal(s.state().selected.length,0);s.tool.dispose();
});
test('tool changes, touch compatibility events and loss of focus cancel a drag without selecting',()=>{
 const s=fixture();s.win.emit('keydown',{code:'Space'});s.container.emit('mousedown',{sourceCapabilities:{firesTouchEvents:true}});assert.equal(s.state().dragging,true);s.container.emit('mousedown');s.enable(false);s.doc.emit('mousemove',{clientX:50});assert.equal(s.state().dragging,true);s.doc.emit('mouseup');assert.equal(s.state().selected.length,0);s.enable(true);s.container.emit('mousedown');s.win.emit('blur');assert.equal(s.state().dragging,true);s.tool.dispose();
});

test('Ctrl+Z and Cmd+Z undo map deletion while text editing and redo chords remain untouched',()=>{const s=fixture();s.win.emit('keydown',{key:'z',ctrlKey:true});s.win.emit('keydown',{key:'z',metaKey:true});assert.equal(s.state().undone,2);s.win.emit('keydown',{key:'z',ctrlKey:true,repeat:true});s.win.emit('keydown',{key:'z',ctrlKey:true,shiftKey:true});s.win.emit('keydown',{key:'z',ctrlKey:true,target:{closest:()=>true}});s.doc.activeElement={};s.win.emit('keydown',{key:'z',ctrlKey:true});assert.equal(s.state().undone,2);s.tool.dispose();});
