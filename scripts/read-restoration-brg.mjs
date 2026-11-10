// Local, read-only SHP/SHX/DBF reader. No source edits, downloads or executable metadata.
import {createHash} from 'node:crypto';
export const sha256=b=>createHash('sha256').update(b).digest('hex');
export function readDbf(b){
 if(b.length<33)throw Error('Truncated DBF');
 const count=b.readUInt32LE(4),header=b.readUInt16LE(8),width=b.readUInt16LE(10),fields=[];
 if(header<33||header>b.length||width<1||header+count*width>b.length)throw Error('Invalid DBF bounds');
 let offset=1,p=32;
 for(;p<header&&b[p]!==13;p+=32){
  if(p+32>header)throw Error('Truncated DBF field');
  const name=b.subarray(p,p+11).toString('ascii').split('\0')[0],type=String.fromCharCode(b[p+11]),length=b[p+16];
  if(!name||fields.some(f=>f.name===name)||!length)throw Error('Invalid/duplicate DBF field');
  fields.push({name,type,length,offset});offset+=length;
 }
 if(b[p]!==13||offset!==width)throw Error('Invalid DBF schema');
 return {count,fields,row(i){
  if(!Number.isInteger(i)||i<0||i>=count)throw Error('DBF index');
  const start=header+i*width;if(b[start]===42)return null;if(b[start]!==32)throw Error('Invalid DBF deletion flag');
  return Object.fromEntries(fields.map(f=>{const bytes=b.subarray(start+f.offset,start+f.offset+f.length);let v;try{v=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{v=new TextDecoder('windows-1252').decode(bytes);}return [f.name,v.trim()||null];}));
 }};
}
export function inspectShapefile(shp,shx,dbf){
 const check=b=>{if(b.length<100||b.readInt32BE(0)!==9994||b.readInt32LE(28)!==1000||b.readInt32BE(24)*2!==b.length)throw Error('Invalid SHP/SHX header or length');};
 check(shp);check(shx);
 const type=shp.readInt32LE(32);if(![13,15,3,5].includes(type)||shx.readInt32LE(32)!==type||(shx.length-100)%8)throw Error('Invalid shape type/index');
 const attributes=readDbf(dbf),count=(shx.length-100)/8;
 if(count!==attributes.count)throw Error('SHP index/DBF count mismatch');
 const entries=[];let next=100;
 for(let i=0;i<count;i++){
  const offset=shx.readInt32BE(100+i*8)*2,bytes=shx.readInt32BE(104+i*8)*2;
  if(offset!==next||bytes<4||offset+8+bytes>shp.length||shp.readInt32BE(offset)!==i+1||shp.readInt32BE(offset+4)*2!==bytes)throw Error('SHP/SHX record mismatch');
  entries.push({offset:offset+8,bytes});next=offset+8+bytes;
 }
 if(next!==shp.length)throw Error('Unindexed SHP trailing data');
 return {type,count,attributes,record(i){
  const e=entries[i];if(!e)throw Error('SHP record index');const b=shp.subarray(e.offset,e.offset+e.bytes),t=b.readInt32LE(0);
  if(t===0)return {nullShape:true};if(t!==type||b.length<44)throw Error('Record shape type/bounds');
  const parts=b.readInt32LE(36),points=b.readInt32LE(40),start=44+4*parts,xyEnd=start+16*points;
  if(parts<1||points<2||parts>points||xyEnd>b.length||(type>=10&&xyEnd+16+8*points>b.length))throw Error('Invalid shape part/point/Z bounds');
  const rings=[];let previous=0;
  for(let j=0;j<parts;j++){
   const from=b.readInt32LE(44+4*j),to=j+1<parts?b.readInt32LE(48+4*j):points;
   if(from!==previous||to<=from||to>points)throw Error('Invalid shape parts');previous=to;
   const ring=[];for(let k=from;k<to;k++){const p=[b.readDoubleLE(start+16*k),b.readDoubleLE(start+16*k+8)];if(!p.every(Number.isFinite))throw Error('Nonfinite XY');ring.push(p);}rings.push(ring);
  }
  return {rings,rawShapeSha256:sha256(b),bbox:[b.readDoubleLE(4),b.readDoubleLE(12),b.readDoubleLE(20),b.readDoubleLE(28)]};
 }};
}
export function ringSignedArea(r){
 const [x,y]=r[0];let sum=0;for(let i=1;i<r.length;i++)sum+=(r[i-1][0]-x)*(r[i][1]-y)-(r[i][0]-x)*(r[i-1][1]-y);return sum/2;
}
export function polygonFromEsriRings(rings,J){
 const reader=new J.io.GeoJSONReader(),shells=[],holes=[];
 for(const ring of rings){
  if(ring.length<4||ring[0][0]!==ring.at(-1)[0]||ring[0][1]!==ring.at(-1)[1])throw Error('Unclosed/short source ring');
  const area=ringSignedArea(ring);if(!area)throw Error('Zero-area source ring');
  const g=reader.read({type:'Polygon',coordinates:[ring]});
  (area<0?shells:holes).push({ring,g,area:Math.abs(area)});
 }
 if(!shells.length)throw Error('No clockwise ESRI shell; source not repaired');
 const groups=shells.map(s=>[s.ring]);
 for(const hole of holes){
  // A hole must be fully covered by its smallest enclosing shell, not assigned from one vertex.
  const candidates=shells.map((s,i)=>({...s,i})).filter(s=>s.g.covers(hole.g)).sort((a,b)=>a.area-b.area);
  if(!candidates.length)throw Error('Orphan/crossing ESRI hole');groups[candidates[0].i].push(hole.ring);
 }
 return {type:'MultiPolygon',coordinates:groups};
}
export function sourcePressureFacts(p){
 const fireFields=['BA__2015','BA__2016','BA__2017'];
 const fire=fireFields.map((f,i)=>({year:2015+i,value:p[f]??null}));
 const burnedYears=fire.filter(r=>r.value===`Terbakar ${r.year}`).map(r=>r.year);
 const fireUnknown=fire.some(r=>![`Terbakar ${r.year}`,`Tidak Terbakar ${r.year}`].includes(r.value));
 return {burnedYears,fireUnknown,canalLabel:['Berkanal','Tidak Berkanal'].includes(p.AREA_KANAL)?p.AREA_KANAL:null,
  landCover:p.KETERANGAN??null,forestClass:['Hutan','Non-Hutan'].includes(p.Hutan)?p.Hutan:null,
  // One non-forest class cannot establish forest loss or its date.
  forestOpening:null,validatedForScoring:false};
}
