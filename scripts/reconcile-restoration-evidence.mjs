// Derivative QA and observed overlaps only. No ecological scoring/approval.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const hash=value=>createHash('sha256').update(value).digest('hex');
export function canonicalize(units,original){
  const seen=new Map(),features=[],decisions=[];
  for(const unit of units.features){
    const source=original.features[unit.properties.sourceFeatureIndex];
    if(!source||JSON.stringify(source.geometry)!==JSON.stringify(unit.geometry)||
      Object.entries(unit.properties.sourceAttributes).some(([key,value])=>JSON.stringify(source.properties?.[key]??null)!==JSON.stringify(value)))
      throw Error('Unit does not match its original source row');
    const key=hash(JSON.stringify(source));
    if(seen.has(key)){
      const canonical=seen.get(key);canonical.properties.sourceUnitIds.push(unit.id);
      decisions.push({sourceUnitId:unit.id,canonicalUnitId:canonical.id,rule:'byte-equivalent-source-feature',sourceFeatureSha256:key});
    } else {
      const clone=JSON.parse(JSON.stringify(unit));clone.properties.sourceUnitIds=[unit.id];
      features.push(clone);seen.set(key,clone);
    }
  }
  const geometryGroups=new Map();
  for(const unit of features){const key=hash(JSON.stringify(unit.geometry));geometryGroups.set(key,(geometryGroups.get(key)||0)+1);}
  for(const unit of features){unit.properties.qa.remainingIdenticalGeometry=geometryGroups.get(hash(JSON.stringify(unit.geometry)))>1;}
  return {units:{type:'FeatureCollection',features},decisions};
}
export function enrich(units,boundaries,archive,T){
  const valid=feature=>{try{return T.booleanValid(feature)&&T.kinks(feature).features.length===0;}catch{return false;}};
  const overlaps=(a,b)=>!(a[0]>b[2]||a[2]<b[0]||a[1]>b[3]||a[3]<b[1]);
  const indexed=boundaries.features.map(feature=>({feature,bbox:T.bbox(feature),valid:valid(feature)}));
  const burned=archive.archives.flatMap(row=>row.data.features.map(feature=>({month:row.month,feature,bbox:T.bbox(feature),valid:valid(feature)})));
  const summary={canonicalUnits:units.features.length,geometryIssues:0,boundaryOverlayErrors:0,fireOverlayErrors:0,
    districtCasesWithEvidence:0,unitsWithBurnIndications:0,boundaryFeaturesExcluded:indexed.filter(row=>!row.valid).length,burnFeaturesExcluded:burned.filter(row=>!row.valid).length};
  for(const unit of units.features){
    const qa=unit.properties.qa,bbox=T.bbox(unit),unitValid=valid(unit);
    qa.geometryCheck={method:'Turf booleanValid and kinks',passed:unitValid,legalBoundaryValidated:false};
    if(!unitValid)summary.geometryIssues++;
    if(qa.districtConflict){
      const labels=new Set();let errors=0,excluded=0;
      if(unitValid)for(const row of indexed){
        if(!overlaps(bbox,row.bbox))continue;
        if(!row.valid){excluded++;continue;}
        try{const intersection=T.intersect(T.featureCollection([unit,row.feature]));if(intersection&&T.area(intersection)>0)labels.add(row.feature.properties?.WADMKK||'Label wilayah belum tersedia');}
        catch{errors++;}
      }
      qa.districtReference={sourceField:'WADMKK',labels:[...labels].sort(),overlayErrors:errors,excludedBoundaryFeatures:excluded,
        status:!unitValid||errors||excluded?'incomplete-reference-evidence':'reference-overlaps-only',
        appliedDistrict:null,authoritativeCorrection:false};
      summary.boundaryOverlayErrors+=errors;if(labels.size)summary.districtCasesWithEvidence++;
    }
    const observations=[];let fireErrors=0,fireExcluded=0;
    if(unitValid)for(const row of burned){
      if(!overlaps(bbox,row.bbox))continue;
      if(!row.valid){fireExcluded++;continue;}
      try{const intersection=T.intersect(T.featureCollection([unit,row.feature]));if(intersection&&T.area(intersection)>0)observations.push({month:row.month,
        archiveEventId:row.feature.properties?.archiveEventId??null,eventId:row.feature.properties?.eventId??null,
        firstDetection:row.feature.properties?.firstDetection??null,lastDetection:row.feature.properties?.lastDetection??null,
        sourceStatus:row.feature.properties?.status??null});}
      catch{fireErrors++;}
    }
    unit.properties.evidence.burnedIndications={observations:unitValid?observations:null,overlayErrors:fireErrors,
      excludedFeatures:fireExcluded,completeHistory:false,scoringValidated:false,
      status:!unitValid||fireErrors||fireExcluded?'incomplete-overlay':'partial-archive-observations-only'};
    if(observations.length)summary.unitsWithBurnIndications++;summary.fireOverlayErrors+=fireErrors;
  }
  return summary;
}
export async function reconcile(input){
  const privateRoot=await fs.realpath(path.join(root,'private-data')),directory=await fs.realpath(input);
  if(privateRoot!==path.join(await fs.realpath(root),'private-data')||!directory.startsWith(privateRoot+path.sep))throw Error('Input must be inside private-data');
  const read=async name=>JSON.parse(await fs.readFile(path.join(directory,name),'utf8'));
  const [units,manifest,review,archive]=await Promise.all(['units.geojson','manifest.json','unit-review.json','fire-archive.json'].map(read));
  const peatBytes=await fs.readFile(path.join(root,'data/Gambut_BBSDLP_2019.geojson'));
  if(manifest.access!=='staff_only'||hash(peatBytes)!==manifest.sources.find(row=>row.id==='peat')?.sha256)throw Error('Source provenance mismatch');
  const original=JSON.parse(peatBytes);
  if(units.features.length!==original.features.length||new Set(units.features.map(unit=>unit.properties.sourceFeatureIndex)).size!==original.features.length)throw Error('Incomplete source rows');
  const result=canonicalize(units,original);
  const boundaryBytes=await fs.readFile(path.join(root,'data/batas_administrasi_desa_riau.geojson'));
  const runtime=createRequire(path.join(privateRoot,'restoration-runtime','package.json'));
  const T=runtime('@turf/turf');
  const summary=enrich(result.units,JSON.parse(boundaryBytes),archive,T);
  const output=await fs.mkdtemp(path.join(privateRoot,'restoration-reconciled-'));
  for(const file of ['units.geojson','manifest.json','unit-review.json','fire-archive.json'])await fs.copyFile(path.join(directory,file),path.join(output,file));
  await fs.writeFile(path.join(output,'canonical-units.geojson'),JSON.stringify(result.units),{flag:'wx'});
  await fs.writeFile(path.join(output,'reconciliation.json'),JSON.stringify({schemaVersion:1,access:'staff_only',
    sourceManifestSha256:hash(await fs.readFile(path.join(directory,'manifest.json'))),originalRows:units.features.length,
    exactDuplicateRowsOmitted:result.decisions.length,decisions:result.decisions,summary,
    boundarySource:{path:'data/batas_administrasi_desa_riau.geojson',sha256:hash(boundaryBytes),year:null,authoritativeForCorrection:false},
    runtime:{turf:'7.2.0'},remainingDistrictReviews:review.districtReviews.length,
    scoringValidated:false,limitations:['Exact duplicate source rows are omitted only from the derivative, never from original data.',
      'District reference includes disputed/multiple labels and unknown vintage; no KK/KABKOT correction is applied.',
      'Burn indications remain partial satellite evidence, not verified fire history or a numeric indicator.',
      'All indicator values and approvals remain unchanged.']},null,2),{flag:'wx'});
  return {output,exactDuplicateRowsOmitted:result.decisions.length,summary};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){try{if(process.argv.length!==3)throw Error('Input required');console.log(JSON.stringify(await reconcile(process.argv[2]),null,2));}catch(error){console.error('Reconciliation failed: '+error.message);process.exitCode=1;}}
