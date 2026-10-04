(function(root){
'use strict';
function inside(p,ring){let c=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if(((a[1]>p[1])!==(b[1]>p[1]))&&(p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0]))c=!c;}return c;}
function inPoly(p,poly){return inside(p,poly[0])&&!poly.slice(1).some(r=>inside(p,r));}
function plan(geometries,spacing,rows,gap,angle,excluded,margin,options={}){
 const coords=geometries.flatMap(g=>g.type==='Polygon'?[g.coordinates]:g.type==='MultiPolygon'?g.coordinates:[]);
 if(!coords.length)throw Error('Polygon gawangan tidak tersedia.');
 const origin=coords[0][0][0], sx=111320*Math.cos(origin[1]*Math.PI/180),sy=111320;
 const t=(angle-90)*Math.PI/180,c=Math.cos(t),s=Math.sin(t);
 const project=p=>{const x=(p[0]-origin[0])*sx,y=(p[1]-origin[1])*sy;return [x*c-y*s,x*s+y*c];};
 const unproject=p=>[(p[0]*c+p[1]*s)/sx+origin[0],(-p[0]*s+p[1]*c)/sy+origin[1]];
 const polys=coords.map(poly=>poly.map(r=>r.map(project))), verts=polys.flat(2);
 let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
 verts.forEach(p=>{minX=Math.min(minX,p[0]);maxX=Math.max(maxX,p[0]);minY=Math.min(minY,p[1]);maxY=Math.max(maxY,p[1]);});
 function distance(p,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],d=dx*dx+dy*dy;const t=d?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/d)):0;return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);}
 const period=(rows-1)*spacing+gap, points=[],lanes=[];
 const trees=(options.trees||[]).map(t=>project(t)),radius=options.radius||0;
 const phase=options.phase||0;
 let attempts=0;
 for(let k=0,y=minY+margin+phase;y<=maxY-margin;k++,y=minY+margin+phase+Math.floor(k/rows)*period+(k%rows)*spacing){
 for(let x=minX+margin;x<=maxX-margin;x+=spacing){
 if(++attempts>3000000)throw Error('Layout terlalu besar. Pilih satu blok atau gawangan.');
 const p=[x,y];
 if(!polys.some(poly=>inPoly(p,poly)))continue;
 if(margin>0&&polys.some(poly=>poly.some(r=>r.some((a,i)=>distance(p,a,r[(i+1)%r.length])<margin-1e-7))))continue;
 if(trees.some(t=>Math.hypot(p[0]-t[0],p[1]-t[1])<radius))continue;
 points.push(p);
 }
 if(k%rows===rows-1&&gap>spacing)lanes.push(y+gap/2);
 }
 const withheld=Math.ceil(points.length*excluded/100),active=points.slice(0,points.length-withheld),removed=points.slice(points.length-withheld);
 return {polys,active,removed,lanes,minX,minY,maxX,maxY,unproject};
}

function direction(geometries){
 const rings=geometries.flatMap(g=>g.type==='Polygon'?[g.coordinates[0]]:g.coordinates.map(p=>p[0]));
 let best=0,angle=0;
 rings.forEach(r=>r.forEach((p,i)=>{const q=r[(i+1)%r.length],dx=(q[0]-p[0])*Math.cos(p[1]*Math.PI/180),dy=q[1]-p[1],d=dx*dx+dy*dy;if(d>best){best=d;angle=(Math.atan2(dx,dy)*180/Math.PI+180)%180;}}));
 return Math.round(angle);
}
function estimateMpts(geometries,crops){
 const angle=direction(geometries),supported=crops.filter(c=>['PETAI','JENGKOL','RAMBUTAN','NANGKA','ASAM KANDIS'].includes(String(c.crop).toUpperCase()));
 const trees=[],summary=[];let start=0;
 const weight=c=>Number(c.operationalAreaHa)>0?Number(c.operationalAreaHa):1;
 const total=supported.reduce((s,c)=>s+weight(c),0);
 supported.forEach(c=>{
 const end=start+weight(c)/total,spacing=Math.sqrt(Number(c.spacingM2));
 if(!(spacing>0)){summary.push({crop:c.crop,missing:true});start=end;return;}
 const p=plan(geometries,spacing,1,spacing,angle,0,.5);
 let candidates=p.active.filter(q=>{const f=(q[0]-p.minX)/(p.maxX-p.minX||1);return f>=start&&f<end;});
 const target=Number.isFinite(c.vegetationCount)?Math.round(c.vegetationCount):null;
 if(target!==null&&candidates.length>target)candidates=Array.from({length:target},(_,i)=>candidates[Math.floor(i*candidates.length/target)]);
 candidates.forEach(q=>trees.push({point:p.unproject(q),crop:c.crop}));
 summary.push({crop:c.crop,spacing,sourceCount:c.vegetationCount??null,target,placed:candidates.length,shortfall:target===null?0:Math.max(0,target-candidates.length)});
 start=end;
 });
 return {trees,summary,angle};
}
function recommend(spacing,estimate,radius){
 const distances=estimate.summary.filter(s=>s.spacing>0).map(s=>s.spacing);
 const m=distances.length?Math.min(...distances):8;
 return {angle:estimate.angle,rows:Math.max(2,Math.min(6,Math.floor(m/(2*spacing)))),gap:spacing+1.2};
}
function laneSegments(p,treePoints,radius){
 // Trim the proposed corridor centreline around estimated tree clearance circles.
 const trees=treePoints.map(ll=>{
 const a=p.unproject([0,0]),b=p.unproject([1,0]),c=p.unproject([0,1]);
 const dx=ll[0]-a[0],dy=ll[1]-a[1],ux=b[0]-a[0],uy=b[1]-a[1],vx=c[0]-a[0],vy=c[1]-a[1],det=ux*vy-uy*vx;
 return [(dx*vy-dy*vx)/det,(ux*dy-uy*dx)/det];
 });
 let interrupted=0;const segments=[];
 p.lanes.forEach(y=>{
 let intervals=[[p.minX,p.maxX]];
 trees.forEach(t=>{const d=Math.abs(t[1]-y);if(d>=radius)return;const h=Math.sqrt(radius*radius-d*d),lo=t[0]-h,hi=t[0]+h;let hit=false;
 intervals=intervals.flatMap(([a,b])=>{if(hi<=a||lo>=b)return [[a,b]];hit=true;return [...(lo>a?[[a,lo]]:[]),...(hi<b?[[hi,b]]:[])];});if(hit)interrupted++;
 });
 intervals.forEach(([a,b])=>segments.push([[a,y],[b,y]]));
 });
 return {segments,interrupted};
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
 (g.trees||[]).forEach(t=>{const a=xy(t.point);ctx.beginPath();ctx.arc(a[0],a[1],g.radius*scale,0,Math.PI*2);ctx.fillStyle='rgba(118,65,144,.12)';ctx.fill();ctx.strokeStyle='#79478f';ctx.lineWidth=1;ctx.stroke();ctx.beginPath();ctx.arc(a[0],a[1],Math.max(2,Math.min(5,scale*.4)),0,Math.PI*2);ctx.fillStyle='#79478f';ctx.fill();});
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
const api={plan,inside,inPoly,mount,direction,estimateMpts,recommend,laneSegments};if(typeof module!=='undefined')module.exports=api;else root.DayunPlantingLayout=api;
})(typeof window==='undefined'?globalThis:window);