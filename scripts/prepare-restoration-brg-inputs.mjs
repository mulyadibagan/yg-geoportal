// Bind real historical overlay evidence to the existing three-pressure engine; do not approve proxies.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import A from '../js/restoration-scoring.js';
import {sha256} from './read-restoration-brg.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export function prepareUnit(unit,sourceVersion){
 if(typeof sourceVersion!=='string'||!/^[a-f0-9]{64}$/.test(sourceVersion)||!Array.isArray(unit.firePositiveRefs)||!Array.isArray(unit.nonForestRefs)||!Array.isArray(unit.openLandRefs)||!Number.isSafeInteger(unit.canalPartsIntersecting)||unit.canalPartsIntersecting<0)throw Error('Source-bound overlay required');
 const years=[...new Set(unit.firePositiveRefs.flatMap(r=>r.years))].sort();if(years.some(y=>![2015,2016,2017].includes(y)))throw Error('Unexpected BRG fire year');
 const blocked=unit.geometryValid!==true||unit.overlayErrors.length>0;
 const inputs={
  fire:{present:!blocked&&years.length?true:null,validated:false,definition:'Positive-area intersection with source polygons labelled Terbakar in 2015–2017; historical map claim',provenance:{source:'BRG main Riau polygon archive; BA__2015/2016/2017',year:years.at(-1)??null,version:sourceVersion},evidence:{sourceFeatureIndices:unit.firePositiveRefs.map(r=>r.sourceFeatureIndex),years},validation:{reference:null}},
  canals:{present:!blocked&&unit.canalPartsIntersecting>0?true:null,validated:false,definition:'Intersection with archived Kanal_Riau vector lines; not proof of current channel condition or observation date',provenance:{source:'User-supplied BRG - Data Dasar.rar / Kanal_Riau.shp',year:null,version:sourceVersion},evidence:{intersectingSourceParts:unit.canalPartsIntersecting},validation:{reference:null}},
  forestOpening:{present:null,validated:false,definition:'Requires temporally compared forest cover; Non-Hutan or Tanah Terbuka alone does not establish forest loss',provenance:{source:'BRG PL17_ID/Hutan/KETERANGAN historical classes only',year:null,version:sourceVersion},evidence:{nonForestFragmentRefs:unit.nonForestRefs,openLandFragmentRefs:unit.openLandRefs},validation:{reference:null}}
 };
 const assessment=A.assessPressures(inputs);
 return {unitId:unit.unitId,sourceFeatureIndex:unit.sourceFeatureIndex,inputs,assessment,implementationReadiness:{assessed:false,score:null},sourceUnitApproved:false};
}
export async function run(directory){
 const privateRoot=await fs.realpath(path.join(root,'private-data')),dir=await fs.realpath(path.resolve(root,directory));if(!dir.startsWith(privateRoot+path.sep))throw Error('Private overlay required');
 const file=await fs.realpath(path.join(dir,'overlay.json'));if(!file.startsWith(dir+path.sep)||(await fs.stat(file)).size>64*1024*1024)throw Error('Bounded private overlay required');
 const bytes=await fs.readFile(file),manifest=JSON.parse(await fs.readFile(path.join(dir,'manifest.json'),'utf8'));
 if(manifest.access!=='staff_only'||manifest['overlay.jsonSha256']!==sha256(bytes))throw Error('Overlay hash mismatch');
 const overlay=JSON.parse(bytes),units=overlay.units.map(u=>prepareUnit(u,sha256(bytes))),output=await fs.mkdtemp(path.join(privateRoot,'restoration-brg-inputs-'));
 const summary={units:units.length,completeAssessments:units.filter(u=>u.assessment.complete).length,unassessed:units.filter(u=>!u.assessment.complete).length,approximateScores:0};
 await fs.writeFile(path.join(output,'pressure-inputs.json'),JSON.stringify({access:'staff_only',overlaySha256:sha256(bytes),summary,units},null,2));console.log(JSON.stringify({output,...summary},null,2));return output;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)run(process.argv[2]).catch(e=>{console.error(e.stack);process.exitCode=1;});
