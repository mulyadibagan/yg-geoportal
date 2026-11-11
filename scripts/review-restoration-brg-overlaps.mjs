// Distinguish exact duplicates, shared boundaries and positive-area overlaps in valid Riau BRG fragments.
import fs from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import readline from 'node:readline';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {sha256} from './read-restoration-brg.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export async function run(directory){
 const privateRoot=await fs.realpath(path.join(root,'private-data')),dir=await fs.realpath(path.resolve(root,directory));if(!dir.startsWith(privateRoot+path.sep))throw Error('Private overlay package required');
 const file=await fs.realpath(path.join(dir,'valid-main-fragments.ndjson'));if(!file.startsWith(dir+path.sep)||(await fs.stat(file)).size>512*1024*1024)throw Error('Bounded private fragments required');
 const manifest=JSON.parse(await fs.readFile(path.join(dir,'manifest.json'),'utf8')),bytes=await fs.readFile(file);if(manifest.access!=='staff_only'||sha256(bytes)!==manifest['valid-main-fragments.ndjsonSha256'])throw Error('Source hash mismatch');
 const require=createRequire(path.join(privateRoot,'restoration-runtime/package.json')),J=require('jsts'),reader=new J.io.GeoJSONReader(),tree=new J.index.strtree.STRtree(),rows=[];
 for await(const line of readline.createInterface({input:createReadStream(file),crlfDelay:Infinity})){const f=JSON.parse(line),g=reader.read(f.geometry),row={i:f.sourceFeatureIndex,g,geometryHash:f.geometryHash,attributeHash:f.attributeHash};rows.push(row);tree.insert(g.getEnvelopeInternal(),row);}
 const overlaps=[],errors=[];let candidatePairs=0,boundaryOnly=0;
 for(let i=0;i<rows.length;i++){
  const a=rows[i];for(const b of tree.query(a.g.getEnvelopeInternal()).toArray())if(b.i>a.i){
   candidatePairs++;try{const intersection=a.g.intersection(b.g);if(intersection.isEmpty())continue;if(intersection.getArea()>0)overlaps.push({sourceFeatureIndices:[a.i,b.i],normalizedXyIdentical:a.geometryHash===b.geometryHash,attributesIdentical:a.attributeHash===b.attributeHash});else boundaryOnly++;}catch(e){errors.push({sourceFeatureIndices:[a.i,b.i],reason:e.message});}
  }
  if(i%5000===0)console.log(JSON.stringify({stage:'fragment-overlap',processed:i,candidatePairs,positiveAreaPairs:overlaps.length}));
 }
 const result={access:'staff_only',sourceFragmentsSha256:manifest['valid-main-fragments.ndjsonSha256'],scope:'Within-layer pairwise intersections of topology-valid Riau main BRG fragments only; excluded invalid source fragments remain unresolved',records:rows.length,candidatePairs,boundaryOnlyContacts:boundaryOnly,positiveAreaOverlapPairs:overlaps.length,affectedSourceRecords:[...new Set(overlaps.flatMap(r=>r.sourceFeatureIndices))].sort((a,b)=>a-b),overlaps,errors,scoringValidated:false,score:null,limitations:['A pair count is not an area or count of unique duplicated regions.','Any nonzero JSTS intersection area is reported without a hidden sliver threshold; precision effects require review.','No snapping, union, geometry repair, source deletion or ecological approval.']};
 const output=await fs.mkdtemp(path.join(privateRoot,'restoration-brg-overlap-review-'));await fs.writeFile(path.join(output,'overlap-review.json'),JSON.stringify(result,null,2));
 console.log(JSON.stringify({output,records:rows.length,candidatePairs,boundaryOnly,positiveAreaOverlapPairs:overlaps.length,affectedSourceRecords:result.affectedSourceRecords.length,errors:errors.length},null,2));return output;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)run(process.argv[2]).catch(e=>{console.error(e.stack);process.exitCode=1;});
