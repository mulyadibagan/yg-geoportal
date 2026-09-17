/* Monthly internal overlay. Coordinates WGS84; areas projected to UTM 47N,
 * matching the Riau burned-area archive (EPSG:32647). No data persistence. */
(function(root){
  'use strict';
  const clip = typeof module === 'object' ? require('./vendor/polygon-clipping-0.15.7.js') : root.polygonClipping;
  const polygon = f => {
    const g = f && f.geometry;
    if (!g || !['Polygon','MultiPolygon'].includes(g.type)) throw Error('Batas atau estimasi tidak berupa poligon.');
    const coords = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
    if (!coords.length || coords.some(p => !p.length || p.some(r => r.length < 4 || r.some(c => !Number.isFinite(c[0]) || !Number.isFinite(c[1]))))) throw Error('Koordinat poligon tidak valid.');
    return coords;
  };
  function project(c){
    const rad=Math.PI/180, phi=c[1]*rad, lambda=(c[0]-99)*rad;
    const a=6378137, e2=0.0066943799901413165, ep=e2/(1-e2), k=.9996;
    const s=Math.sin(phi), co=Math.cos(phi), t=Math.tan(phi), N=a/Math.sqrt(1-e2*s*s), T=t*t, C=ep*co*co, A=co*lambda;
    const M=a*((1-e2/4-3*e2*e2/64-5*e2**3/256)*phi-(3*e2/8+3*e2*e2/32+45*e2**3/1024)*Math.sin(2*phi)+(15*e2*e2/256+45*e2**3/1024)*Math.sin(4*phi)-35*e2**3/3072*Math.sin(6*phi));
    return [500000+k*N*(A+(1-T+C)*A**3/6+(5-18*T+T*T+72*C-58*ep)*A**5/120),k*(M+N*t*(A*A/2+(5-T+9*C+4*C*C)*A**4/24+(61-58*T+T*T+600*C-330*ep)*A**6/720))];
  }
  function ringArea(ring){
    const p=ring.map(project), o=p[0];let sum=0;
    for(let i=0,j=p.length-1;i<p.length;j=i++) sum+=(p[j][0]-o[0])*(p[i][1]-o[1])-(p[i][0]-o[0])*(p[j][1]-o[1]);
    return Math.abs(sum)/2;
  }
  const area = polys => polys.reduce((sum,p)=>sum+Math.max(0,ringArea(p[0])-p.slice(1).reduce((s,r)=>s+ringArea(r),0)),0)/10000;
  const union = pieces => {
    // Balanced merges avoid repeatedly reprocessing an ever-growing company
    // boundary when GeoRSPO supplies thousands of parcel fragments.
    let level=pieces.slice();
    while(level.length>1){const next=[];for(let i=0;i<level.length;i+=2)next.push(i+1<level.length?clip.union(level[i],level[i+1]):level[i]);level=next;}
    return level[0]||[];
  };
  const box = polys => {const b=[Infinity,Infinity,-Infinity,-Infinity];polys.forEach(p=>p.forEach(r=>r.forEach(c=>{b[0]=Math.min(b[0],c[0]);b[1]=Math.min(b[1],c[1]);b[2]=Math.max(b[2],c[0]);b[3]=Math.max(b[3],c[1]);})));return b;};
  const overlaps = (a,b)=>a[0]<=b[2]&&a[2]>=b[0]&&a[1]<=b[3]&&a[3]>=b[1];
  function ringContains(p,r){let inside=false;for(let i=0,j=r.length-1;i<r.length;j=i++){const a=r[i],b=r[j];if(((a[1]>p[1])!==(b[1]>p[1]))&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;}
  const contains=(point,polys)=>polys.some(p=>ringContains(point,p[0])&&!p.slice(1).some(r=>ringContains(point,r)));
  function identity(p,kind){
    if(kind==='pbph')return {id:String(p.PBPH_ID||[p.NAMOBJ,p.NO_SK].filter(Boolean).join('|')),name:p.NAMOBJ,detail:p.NO_SK||'',level:'unit'};
    // Exact parent-scoped alias verified in Permata Group's own announcement.
    // Preserve the source abbreviation; never apply PHI to unrelated groups.
    const phi=/^PT\.?\s+PHI$/i.test(p.PO_COMPANY||'') && (p.RSPO_GROUP||p.Parent)==='Permata Group Pte. Ltd.';
    return {id:String(p.COMPANY_ID||p.MemberNum||p.Parent||p.PO_COMPANY||''),name:phi?'PT Permata Hijau Indonesia (PT PHI)':p.PO_COMPANY||p.Parent||p.RSPO_GROUP,detail:[p.SUPPLY_BASE,p.RSPO_GROUP||p.MemberNum].filter(Boolean).join(' · '),level:p.PO_COMPANY?'unit':'group',nameSource:phi?'https://www.linkedin.com/posts/permatagroup_two-of-permata-group-subsidiaries-pt-permata-activity-7053683515611086848-Z1zV':''};
  }
  function analyze(input){
    if(!Array.isArray(input.burned?.features))throw Error('Arsip estimasi belum tersedia.');
    const events=input.burned.features.map((f,i)=>({geometry:polygon(f),id:String(f.properties?.archiveEventId||f.properties?.eventId||i),first:f.properties?.firstDetection||'',last:f.properties?.lastDetection||''}));
    events.forEach(e=>e.box=box(e.geometry));
    const results={};const allPieces=[];
    for(const kind of ['pbph','rspo']){
      const source=input[kind];
      if(!source?.features?.length)throw Error('Batas '+(kind==='pbph'?'PBPH':'perkebunan RSPO')+' belum tersedia; luas tidak dapat dihitung.');
      const groups=new Map();
      for(const f of source.features){const id=identity(f.properties||{},kind);if(!id.id||!id.name)throw Error('Identitas batas '+kind+' belum lengkap.');if(!groups.has(id.id))groups.set(id.id,{...id,pieces:[]});groups.get(id.id).pieces.push(polygon(f));}
      const rows=[],categoryPieces=[];
      for(const g of groups.values()){
        const boundary=union(g.pieces),bounds=box(boundary),pieces=[],matches=new Map();
        for(const e of events){if(!overlaps(bounds,e.box))continue;const part=clip.intersection(boundary,e.geometry);if(part.length&&area(part)>1e-8){pieces.push(part);matches.set(e.id,{id:e.id,first:e.first,last:e.last});}}
        const burned=union(pieces),burnedHa=area(burned),boundaryHa=area(boundary),days=new Set();let hotspots=0;
        for(const h of input.report.hotspots||[]){const p=[Number(h.longitude),Number(h.latitude)];if(!p.every(Number.isFinite))continue;if(contains(p,boundary)){hotspots++;if(h.date)days.add(h.date);}}
        if(burnedHa>0||hotspots>0)rows.push({id:g.id,name:g.name,nameSource:g.nameSource,detail:g.detail,level:g.level,hotspots:input.report.unavailable?null:hotspots,days:input.report.unavailable?null:days.size,boundaryHa,burnedHa,percent:boundaryHa?100*burnedHa/boundaryHa:null,events:Array.from(matches.values()),geometry:{type:'MultiPolygon',coordinates:burned},boundary:{type:'MultiPolygon',coordinates:boundary}});
        if(burned.length)categoryPieces.push(burned);
      }
      const merged=union(categoryPieces);if(merged.length)allPieces.push(merged);
      results[kind]={rows:rows.sort((a,b)=>b.burnedHa-a.burnedHa||(b.hotspots||0)-(a.hotspots||0)),uniqueHa:area(merged),boundaryCount:groups.size,groupLevel:Array.from(groups.values()).some(g=>g.level==='group')};
    }
    results.combinedHa=area(union(allPieces));
    return results;
  }
  const api={analyze,area,project};if(typeof module==='object')module.exports=api;else root.YG_FIRE_GEOMETRY=api;
})(typeof self!=='undefined'?self:globalThis);
