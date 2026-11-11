// Staff-only offline BRG QA/overlay. Never modifies sources or approves ecological inputs.
import fs from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline';
import {createReadStream,createWriteStream} from 'node:fs';
import {once} from 'node:events';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {inspectShapefile,polygonFromEsriRings,sha256,sourcePressureFacts} from './read-restoration-brg.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const stable=o=>JSON.stringify(Object.fromEntries(Object.entries(o).sort(([a],[b])=>a.localeCompare(b))));
export async function run(directory){
 const privateRoot=await fs.realpath(path.join(root,'private-data')),dir=await fs.realpath(path.resolve(root,directory));
 if(privateRoot!==path.join(await fs.realpath(root),'private-data')||!dir.startsWith(privateRoot+path.sep))throw Error('Private source package required');
 const inv=JSON.parse(await fs.readFile(path.join(dir,'inventory.json'),'utf8'));
 if(inv.access!=='staff_only'||inv.datasets.length!==6)throw Error('Unexpected source inventory');
 const require=createRequire(path.join(privateRoot,'restoration-runtime/package.json')),J=require('jsts'),T=require('@turf/turf');
 if(require('jsts/package.json').version!=='2.7.1'||require('@turf/turf/package.json').version!=='7.2.0')throw Error('Unexpected GIS engine version');
 const reader=new J.io.GeoJSONReader(),writer=new J.io.GeoJSONWriter(),out=await fs.mkdtemp(path.join(privateRoot,'restoration-brg-overlay-'));
 const manifest={access:'staff_only',createdAt:new Date().toISOString(),inventorySha256:sha256(await fs.readFile(path.join(dir,'inventory.json'))),sources:[],engines:{jsts:'2.7.1',turf:'7.2.0'},scoringValidated:false};
 const summaries=[],groupsByDataset=new Map(),mainFile=path.join(out,'valid-main-fragments.ndjson'),stream=createWriteStream(mainFile,{flags:'wx'});
 const write=async row=>{if(!stream.write(JSON.stringify(row)+'\n'))await once(stream,'drain');};
 async function component(relative,max){
  const file=await fs.realpath(path.join(dir,relative));if(!file.startsWith(dir+path.sep))throw Error('Source escaped private package');
  const listed=inv.archives.flatMap(a=>a.selectedFiles).find(s=>s.relativePath===relative);
  if(!listed||(await fs.stat(file)).size>max)throw Error('Unlisted/unbounded source');const b=await fs.readFile(file);
  if(sha256(b)!==listed.sha256)throw Error('Source hash mismatch');manifest.sources.push({path:relative,sha256:listed.sha256,bytes:b.length});return b;
 }
 for(const dataset of inv.datasets){
  const base=dataset.path.slice(0,-4),shp=await component(dataset.path,512*1024*1024),shx=await component(base+'.shx',8*1024*1024),dbf=await component(base+'.dbf',512*1024*1024),prj=(await component(base+'.prj',65536)).toString('utf8');
  const source=inspectShapefile(shp,shx,dbf),name=path.basename(base),isMain=name==='Prioritas_Indikatif_Restorasi_2',scope=source.attributes.fields.some(f=>f.name==='PROVINSI')?'PROVINSI = RIAU':'all source records';
  const summary={dataset:name,scope,totalRecords:source.count,structuralIndexChecksPassed:true,selectedRecords:0,validPolygons:0,invalidPolygons:0,nullOrDeleted:0,issues:[],xyGeometryDuplicateGroups:0,xyGeometryAttributeConflicts:0,rawShapeAndAttributeDuplicateRows:0};
  const groups=new Map(),exact=new Map();groupsByDataset.set(name,groups);
  if(source.type===15||source.type===5){
   if(!prj.startsWith('GEOGCS["GCS_WGS_1984"'))throw Error('Unexpected polygon CRS');
   for(let i=0;i<source.count;i++){
    const attrs=source.attributes.row(i);if(!attrs){summary.nullOrDeleted++;continue;}if(scope.startsWith('PROVINSI')&&attrs.PROVINSI!=='RIAU')continue;summary.selectedRecords++;
    try{
     const rec=source.record(i);if(rec.nullShape){summary.nullOrDeleted++;continue;}
     if(rec.rings.some(r=>r.some(p=>Math.abs(p[0])>180||Math.abs(p[1])>90)))throw Error('Polygon outside WGS84 bounds');
     const geometry=polygonFromEsriRings(rec.rings,J),g=reader.read(geometry),check=new J.operation.valid.IsValidOp(g);
     if(!check.isValid())throw Error(check.getValidationError().getMessage());
     g.normalize();const normalized=writer.write(g),geometryHash=sha256(JSON.stringify(normalized)),attributeHash=sha256(stable(attrs)),exactKey=rec.rawShapeSha256+':'+attributeHash;
     const prior=exact.get(exactKey);if(prior!==undefined)summary.rawShapeAndAttributeDuplicateRows++;else exact.set(exactKey,i);
     let group=groups.get(geometryHash);if(!group){group={rows:[],attributeHashes:[],rawHashes:[]};groups.set(geometryHash,group);}group.rows.push(i);group.attributeHashes.push(attributeHash);group.rawHashes.push(rec.rawShapeSha256);
     summary.validPolygons++;
     if(isMain)await write({sourceFeatureIndex:i,geometryHash,attributeHash,rawShapeSha256:rec.rawShapeSha256,exactDuplicateOf:prior??null,geometry:normalized,facts:sourcePressureFacts(attrs),khg:attrs.KODE_KHG});
    }catch(e){summary.invalidPolygons++;summary.issues.push({sourceFeatureIndex:i,reason:e.message});}
    if(i%5000===0)console.log(JSON.stringify({stage:'topology',dataset:name,sourceRow:i,selected:summary.selectedRecords}));
   }
  }else{
   if(!prj.startsWith('PROJCS["WGS_1984_Web_Mercator_Auxiliary_Sphere"')||!prj.includes('PARAMETER["Auxiliary_Sphere_Type",0.0]')||!prj.includes('PARAMETER["False_Easting",0.0]')||!prj.includes('PARAMETER["False_Northing",0.0]')||!prj.includes('PARAMETER["Central_Meridian",0.0]')||!prj.includes('PARAMETER["Standard_Parallel_1",0.0]'))throw Error('Unexpected canal projection; do not infer transformation');
   summary.lineRecords=0;summary.parts=0;summary.vertices=0;summary.zeroLengthSegments=0;
   for(let i=0;i<source.count;i++){
    try{const rec=source.record(i);if(rec.nullShape){summary.nullOrDeleted++;continue;}summary.selectedRecords++;summary.lineRecords++;
     for(const line of rec.rings){if(line.length<2)throw Error('Short line');summary.parts++;summary.vertices+=line.length;for(let k=1;k<line.length;k++)if(line[k][0]===line[k-1][0]&&line[k][1]===line[k-1][1])summary.zeroLengthSegments++;}
    }catch(e){summary.issues.push({sourceFeatureIndex:i,reason:e.message});}
   }
   summary.networkSimplicityChecked=false;summary.lineNote='Finite XY/parts/index checked; junctions, connectivity and duplicate segments checked separately';
  }
  summary.duplicateGroups=[...groups.entries()].filter(([,g])=>g.rows.length>1).map(([geometryHash,g])=>({geometryHash,sourceFeatureIndices:g.rows,attributeConflict:new Set(g.attributeHashes).size>1,rawShapeVariants:new Set(g.rawHashes).size}));
  summary.xyGeometryDuplicateGroups=summary.duplicateGroups.length;summary.xyGeometryAttributeConflicts=summary.duplicateGroups.filter(g=>g.attributeConflict).length;
  summaries.push(summary);console.log(JSON.stringify({stage:'dataset-complete',dataset:name,selected:summary.selectedRecords,valid:summary.validPolygons,invalid:summary.invalidPolygons,duplicates:summary.xyGeometryDuplicateGroups}));
 }
 stream.end();await once(stream,'finish');
 const mainGroups=groupsByDataset.get('Prioritas_Indikatif_Restorasi_2'),targetGroups=groupsByDataset.get('Prioritas_Indikatif_Restorasi_2,6');
 const subset={scope:'Riau valid polygons only; invalid source records are not silently matched',targetValidRecords:0,matchingNormalizedXyAndAttributes:0,matchingRawShapeAndAttributes:0,unmatched:[]};
 for(const [h,g] of targetGroups)for(let i=0;i<g.rows.length;i++){subset.targetValidRecords++;const main=mainGroups.get(h),matches=main?.attributeHashes.flatMap((a,j)=>a===g.attributeHashes[i]?[j]:[])||[];
  if(matches.length)subset.matchingNormalizedXyAndAttributes++;else subset.unmatched.push(g.rows[i]);if(matches.some(j=>main.rawHashes[j]===g.rawHashes[i]))subset.matchingRawShapeAndAttributes++;
 }
 await fs.writeFile(path.join(out,'topology-and-duplicates.json'),JSON.stringify({access:'staff_only',summaries,subsetComparison:subset},null,2));
 const originalBytes=await fs.readFile(path.join(root,'data/Gambut_BBSDLP_2019.geojson')),original=JSON.parse(originalBytes),seen=new Map(),units=[];
 manifest.peatSourceSha256=sha256(originalBytes);
 for(let i=0;i<original.features.length;i++){
  const f=original.features[i],key=sha256(JSON.stringify(f));if(seen.has(key)){seen.get(key).duplicateSourceRows.push(i);continue;}
  const row={sourceFeatureIndex:i,unitId:`bbsdlp-${manifest.peatSourceSha256.slice(0,16)}-${String(i+1).padStart(4,'0')}`,duplicateSourceRows:[],geometryValid:false,brgFragmentRefs:[],firePositiveRefs:[],canalLabelPositiveRefs:[],nonForestRefs:[],openLandRefs:[],forestRefs:[],canalPartsIntersecting:0,overlayErrors:[],forestOpening:null,score:null,category:'Belum dinilai'};
  try{const g=reader.read(f.geometry),check=new J.operation.valid.IsValidOp(g);row.geometryValid=check.isValid()&&T.booleanValid(f);if(!row.geometryValid)row.geometryIssue=check.getValidationError()?.getMessage()||'Turf geometry warning';else row.g=g;}catch(e){row.geometryIssue=e.message;}
  row.bbox=T.bbox(f);seen.set(key,row);units.push(row);
 }
 const index=new J.index.strtree.STRtree();for(const u of units)if(u.geometryValid)index.insert(u.g.getEnvelopeInternal(),u);
 const overlaySummary={fragmentsProcessed:0,duplicateRowsSkipped:0,conflictingGeometryGroupsSkipped:0,positiveAreaIntersections:0,boundaryOnlyContacts:0,overlayErrors:0};
 const conflicting=new Set([...mainGroups].filter(([,g])=>new Set(g.attributeHashes).size>1).map(([h])=>h));
 for await(const line of readline.createInterface({input:createReadStream(mainFile),crlfDelay:Infinity})){
  const f=JSON.parse(line);if(f.exactDuplicateOf!==null){overlaySummary.duplicateRowsSkipped++;continue;}if(conflicting.has(f.geometryHash)){overlaySummary.conflictingGeometryGroupsSkipped++;continue;}
  overlaySummary.fragmentsProcessed++;const g=reader.read(f.geometry),candidates=index.query(g.getEnvelopeInternal()).toArray();
  for(const u of candidates)try{
   const intersection=g.intersection(u.g);if(intersection.isEmpty())continue;if(intersection.getArea()<=0){overlaySummary.boundaryOnlyContacts++;continue;}
   overlaySummary.positiveAreaIntersections++;u.brgFragmentRefs.push(f.sourceFeatureIndex);
   if(f.facts.burnedYears.length)u.firePositiveRefs.push({sourceFeatureIndex:f.sourceFeatureIndex,years:f.facts.burnedYears});
   if(f.facts.canalLabel==='Berkanal')u.canalLabelPositiveRefs.push(f.sourceFeatureIndex);
   if(f.facts.forestClass==='Non-Hutan')u.nonForestRefs.push(f.sourceFeatureIndex);if(f.facts.forestClass==='Hutan')u.forestRefs.push(f.sourceFeatureIndex);if(f.facts.landCover==='Tanah Terbuka')u.openLandRefs.push(f.sourceFeatureIndex);
  }catch(e){overlaySummary.overlayErrors++;u.overlayErrors.push({sourceFeatureIndex:f.sourceFeatureIndex,reason:e.message});}
  if(overlaySummary.fragmentsProcessed%2000===0)console.log(JSON.stringify({stage:'polygon-overlay',processed:overlaySummary.fragmentsProcessed,errors:overlaySummary.overlayErrors}));
 }
 // Reproject source XY directly after the hashes, record index and projection have been checked above.
 const canalDataset=inv.datasets.find(d=>path.basename(d.path)==='Kanal_Riau.shp'),canalShp=await fs.readFile(path.join(dir,canalDataset.path)),canalDbf=await fs.readFile(path.join(dir,canalDataset.path.replace(/\.shp$/,'.dbf'))),canalShx=await fs.readFile(path.join(dir,canalDataset.path.replace(/\.shp$/,'.shx'))),canals=inspectShapefile(canalShp,canalShx,canalDbf);
 const segmentKeys=new Set(),canalQa={records:canals.count,parts:0,exactUndirectedDuplicateSegments:0,zeroLengthSegments:0,overlayErrors:0};
 for(let i=0;i<canals.count;i++){
  const rec=canals.record(i);if(rec.nullShape)continue;
  for(let j=0;j<rec.rings.length;j++){
   const raw=rec.rings[j];canalQa.parts++;
   for(let k=1;k<raw.length;k++){
    const a=JSON.stringify(raw[k-1]),b=JSON.stringify(raw[k]);if(a===b){canalQa.zeroLengthSegments++;continue;}const key=a<b?a+'|'+b:b+'|'+a;if(segmentKeys.has(key))canalQa.exactUndirectedDuplicateSegments++;else segmentKeys.add(key);
   }
   const coordinates=raw.map(([x,y])=>[x/6378137*180/Math.PI,(2*Math.atan(Math.exp(y/6378137))-Math.PI/2)*180/Math.PI]);
   const g=reader.read({type:'LineString',coordinates});
   for(const u of index.query(g.getEnvelopeInternal()).toArray())try{if(g.intersects(u.g))u.canalPartsIntersecting++;}catch(e){canalQa.overlayErrors++;u.overlayErrors.push({canalRecord:i,part:j,reason:e.message});}
  }
 }
 const result={access:'staff_only',purpose:'Observed historical intersections, not final pressure validation',unitCount:units.length,originalRows:original.features.length,excludedInvalidUnits:units.filter(u=>!u.geometryValid).map(u=>u.sourceFeatureIndex),polygonOverlay:overlaySummary,canalQa,
  summary:{unitsWithBrgIntersection:units.filter(u=>u.brgFragmentRefs.length).length,unitsWithBurn2015to2017Label:units.filter(u=>u.firePositiveRefs.length).length,unitsWithNonForestLabel:units.filter(u=>u.nonForestRefs.length).length,unitsWithOpenLandLabel:units.filter(u=>u.openLandRefs.length).length,unitsWithCanalLine:units.filter(u=>u.canalPartsIntersecting).length,unitsWithThreeHistoricalSignals:units.filter(u=>u.firePositiveRefs.length&&u.nonForestRefs.length&&u.canalPartsIntersecting).length,finalPriorityAssessed:0},
  limitations:['Only Riau-labelled fragments of three provincial polygon datasets undergo feature topology QA; two dissolved national layers undergo whole-record QA.','Positive area means a JSTS intersection has nonzero planar area; no degree-squared or sum of overlapping fragments is reported as hectares.','No observed intersection does not establish absence: invalid/excluded polygons, partial coverage and source year remain unresolved.','Non-Hutan and Tanah Terbuka are historical classes, not temporal proof of forest opening.','Exact XY duplicate groups do not establish full XYZ equivalence; raw record hashes are compared separately.','Unit overlaps/conflicting source attributes remain; counts cannot be summed into unique intervention areas.','No automatic ring repairs, snapping, buffer(0), inferred geometry, indicator approval or numeric scores.'],
  units:units.map(({g,bbox,...u})=>({...u,canalConditionVerified:false,scoringValidated:false}))};
 await fs.writeFile(path.join(out,'overlay.json'),JSON.stringify(result,null,2));
 for(const name of ['topology-and-duplicates.json','overlay.json','valid-main-fragments.ndjson'])manifest[name+'Sha256']=sha256(await fs.readFile(path.join(out,name)));
 await fs.writeFile(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2));
 console.log(JSON.stringify({output:out,summary:result.summary,invalidUnits:result.excludedInvalidUnits,polygonOverlay:overlaySummary,canalQa},null,2));return out;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)run(process.argv[2]).catch(e=>{console.error(e.stack);process.exitCode=1;});
