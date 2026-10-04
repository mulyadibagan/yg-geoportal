(function(root){
'use strict';
function inside(p,ring){let c=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if(((a[1]>p[1])!==(b[1]>p[1]))&&(p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0]))c=!c;}return c;}
function inPoly(p,poly){return inside(p,poly[0])&&!poly.slice(1).some(r=>inside(p,r));}
function plan(geometries,spacing,rows,gap,angle,excluded,margin){
 const coords=geometries.flatMap(g=>g.type==='Polygon'?[g.coordinates]:g.type==='MultiPolygon'?g.coordinates:[]);
 if(!coords.length)throw Error('Polygon gawangan tidak tersedia.');
 const origin=coords[0][0][0], sx=111320*Math.cos(origin[1]*Math.PI/180),sy=111320;
 const t=angle*Math.PI/180,c=Math.cos(t),s=Math.sin(t);
 const project=p=>{const x=(p[0]-origin[0])*sx,y=(p[1]-origin[1])*sy;return [x*c-y*s,x*s+y*c];};
 const unproject=p=>[(p[0]*c+p[1]*s)/sx+origin[0],(-p[0]*s+p[1]*c)/sy+origin[1]];
 const polys=coords.map(poly=>poly.map(r=>r.map(project))), verts=polys.flat(2);
 let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
 verts.forEach(p=>{minX=Math.min(minX,p[0]);maxX=Math.max(maxX,p[0]);minY=Math.min(minY,p[1]);maxY=Math.max(maxY,p[1]);});
 function distance(p,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],d=dx*dx+dy*dy;const t=d?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/d)):0;return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);}
 const period=(rows-1)*spacing+gap, points=[],lanes=[];
 let attempts=0;
 for(let k=0,y=minY+margin;y<=maxY-margin;k++,y=minY+margin+Math.floor(k/rows)*period+(k%rows)*spacing){
 for(let x=minX+margin;x<=maxX-margin;x+=spacing){
 if(++attempts>3000000)throw Error('Layout terlalu besar. Pilih satu blok atau gawangan.');
 const p=[x,y];
 if(!polys.some(poly=>inPoly(p,poly)))continue;
 if(margin>0&&polys.some(poly=>poly.some(r=>r.some((a,i)=>distance(p,a,r[(i+1)%r.length])<margin-1e-7))))continue;
 points.push(p);
 }
 if(k%rows===rows-1&&gap>spacing)lanes.push(y+gap/2);
 }
 const withheld=Math.ceil(points.length*excluded/100),active=points.slice(0,points.length-withheld),removed=points.slice(points.length-withheld);
 return {polys,active,removed,lanes,minX,minY,maxX,maxY,unproject};
}
function mount(id){
 const canvas=document.getElementById(id),ctx=canvas.getContext('2d');let layouts=[],scale=1,ox=0,oy=0,drag=null;
 function draw(){
 const w=canvas.clientWidth,h=canvas.clientHeight,dpr=window.devicePixelRatio||1;canvas.width=w*dpr;canvas.height=h*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='#f3f6ee';ctx.fillRect(0,0,w,h);
 const xy=p=>[ox+p[0]*scale,oy-p[1]*scale];
 layouts.forEach(g=>{
 ctx.beginPath();g.polys.forEach(poly=>poly.forEach(r=>{r.forEach((p,i)=>{const a=xy(p);i?ctx.lineTo(...a):ctx.moveTo(...a)});ctx.closePath();}));
 ctx.fillStyle='#e1ecd8';ctx.fill('evenodd');ctx.strokeStyle='#315f42';ctx.lineWidth=1.5;ctx.stroke();
 ctx.save();ctx.clip('evenodd');ctx.strokeStyle='#ce9b3a';ctx.lineWidth=3;
 g.lanes.forEach(line=>{ctx.beginPath();ctx.moveTo(...xy(line[0]));ctx.lineTo(...xy(line[1]));ctx.stroke();});ctx.restore();
 [[g.active,'#17653e'],[g.removed,'#9ba39b']].forEach(([pts,color])=>{ctx.fillStyle=color;const r=Math.max(.65,Math.min(3,scale*.13));pts.forEach(p=>{const a=xy(p);if(a[0]<0||a[0]>w||a[1]<0||a[1]>h)return;ctx.fillRect(a[0]-r,a[1]-r,r*2,r*2);});});
 ctx.fillStyle='#102f21';ctx.font='bold 13px system-ui';const a=xy([g.minX,g.maxY]);ctx.fillText(g.label,a[0]+4,a[1]-6);
 });
 ctx.fillStyle='#fff';ctx.fillRect(10,h-38,155,28);ctx.fillStyle='#20382c';ctx.font='12px system-ui';ctx.fillText('100 px ≈ '+(100/scale).toFixed(1)+' m',18,h-19);
 }
 function fit(){if(!layouts.length)return;const minX=Math.min(...layouts.map(g=>g.minX)),maxX=Math.max(...layouts.map(g=>g.maxX)),minY=Math.min(...layouts.map(g=>g.minY)),maxY=Math.max(...layouts.map(g=>g.maxY));scale=Math.min((canvas.clientWidth-60)/(maxX-minX||1),(canvas.clientHeight-60)/(maxY-minY||1));ox=canvas.clientWidth/2-(minX+maxX)*scale/2;oy=canvas.clientHeight/2+(minY+maxY)*scale/2;draw();}
 function zoom(f,x=canvas.clientWidth/2,y=canvas.clientHeight/2){scale*=f;ox=x+(ox-x)*f;oy=y+(oy-y)*f;draw();}
 canvas.addEventListener('wheel',e=>{e.preventDefault();const r=canvas.getBoundingClientRect();zoom(e.deltaY<0?1.2:1/1.2,e.clientX-r.left,e.clientY-r.top);},{passive:false});
 canvas.addEventListener('pointerdown',e=>{drag=[e.clientX,e.clientY];canvas.setPointerCapture(e.pointerId);});
 canvas.addEventListener('pointermove',e=>{if(!drag)return;ox+=e.clientX-drag[0];oy+=e.clientY-drag[1];drag=[e.clientX,e.clientY];draw();});
 canvas.addEventListener('pointerup',()=>drag=null);canvas.addEventListener('pointercancel',()=>drag=null);
 new ResizeObserver(()=>fit()).observe(canvas);
 return {show(items){layouts=items;fit();},zoom,fit,clear(){layouts=[];draw();}};
}
const api={plan,inside,inPoly,mount};if(typeof module!=='undefined')module.exports=api;else root.DayunPlantingLayout=api;
})(typeof window==='undefined'?globalThis:window);