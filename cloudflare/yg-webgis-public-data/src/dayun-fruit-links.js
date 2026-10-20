// Logical links only. Never modify pineapple corrections, fruit evidence coordinates or census.
export const distance=(a,b)=>Math.hypot((a[0]-b[0])*111320*Math.cos((a[1]+b[1])*Math.PI/360),(a[1]-b[1])*110574);
export function plantIndex(features){
  const byId=new Map(features.filter(f=>f.properties.status!=='rejected').map(f=>[f.properties.id,f]));
  const cells=new Map(),lat=features[0]?.geometry.coordinates[1]||0,sx=111320*Math.cos(lat*Math.PI/180),sy=110574;
  const cell=c=>[Math.floor(c[0]*sx),Math.floor(c[1]*sy)];
  for(const f of byId.values()){const key=cell(f.geometry.coordinates).join('/');if(!cells.has(key))cells.set(key,[]);cells.get(key).push(f);}
  const nearby=(c,r=.6)=>{const [x,y]=cell(c),out=[];for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(const f of cells.get([x+dx,y+dy].join('/'))||[]){const d=distance(c,f.geometry.coordinates);if(d<=r)out.push({f,d});}return out.sort((a,b)=>a.d-b.d||a.f.properties.id.localeCompare(b.f.properties.id));};
  const match=c=>{const found=nearby(c,.45);return found[0]?.d<=.20&&(!found[1]||found[1].d-found[0].d>=.15)?found[0].f:null;};
  return{byId,nearby,match};
}
export function linkedFruitFeatures(features,plants){
  const used=new Map(),resolved=features.map(f=>{
    const p=f.properties,stored=p.plant_id,plant=stored?plants.byId.get(stored):plants.match(f.geometry.coordinates);
    const plantId=stored||plant?.properties.id||null;
    return{...f,properties:{...p,plant_id:plantId,link_method:p.link_method||(plant?'spatial_unique':null),link_state:stored&&!plant?'plant_unavailable':plant?'linked':'needs_link'}};
  });
  for(const f of [...resolved.filter(f=>f.properties.status==='confirmed'),...resolved.filter(f=>!['confirmed','rejected'].includes(f.properties.status))])if(f.properties.plant_id&&!used.has(f.properties.plant_id))used.set(f.properties.plant_id,f.properties.id);
  return resolved.map(f=>{const p=f.properties,owner=used.get(p.plant_id),duplicate=p.status!=='rejected'&&p.plant_id&&owner!==p.id?owner:null;return{...f,properties:{...p,duplicate_of:duplicate,counted:!duplicate}};});
}
