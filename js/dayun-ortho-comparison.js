(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./dayun-agro-summary.js'):root.DayunAgroSummary);if(typeof module==='object'&&module.exports)module.exports=api;root.YG_DAYUN_COMPARISON=api;})(typeof window!=='undefined'?window:globalThis,function(summary){
  'use strict';
  const numeric=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))?Number(v):null;
  function build(analysis,details,reports,provenance){
    const records=new Map((details.objects||[]).map(r=>[r.objectId,r]));
    const events=[];
    for(const f of reports?.features||[]){const p=f.properties||{};if(p.targetLayerId!=='dayun_gawangan')continue;let info;try{info=typeof p.proposedInformation==='string'?JSON.parse(p.proposedInformation):p.proposedInformation;}catch{continue;}if(info?.monitoringType!=='Agroforestri Dayun')continue;events.push({id:p.targetObjectId,date:info.eventDate||p.activityDate||'',info});}
    events.sort((a,b)=>a.date.localeCompare(b.date));
    const ids=new Set();
    const rows=analysis.zones.map(zone=>{
      if(ids.has(zone.id))throw Error('Duplicate gawangan comparison');ids.add(zone.id);
      const objectId=zone.kind==='active_source'?'DAYUN-'+zone.id:null;
      const original=records.get(objectId),record=original?JSON.parse(JSON.stringify(original)):null;
      if(record)for(const e of events.filter(e=>e.id===objectId)){
        const c=(record.crops||[]).find(c=>String(c.crop).trim().toUpperCase()===String(e.info.crop||'').trim().toUpperCase());if(!c)continue;
        const d=e.info.activityDetails||{},living=numeric(d.livingPlantCount),stock=numeric(d.readySeedlingCount);
        if(e.info.plantingDate)c.plantingDate=e.info.plantingDate;
        if(e.info.activityType==='Sensus tanaman'&&Number.isInteger(living)&&living>=0&&e.date>=String(c.populationCensus?.period||'')){
          if(c.sourcePopulationInitial===undefined)c.sourcePopulationInitial=c.vegetationCount;
          c.populationCensus={period:e.date,livingPlantCount:living};
        }
        if(e.info.activityType==='Sensus bibit'&&Number.isInteger(stock)&&stock>=0&&e.date>=String(c.seedlingCensus?.period||'')){c.seedlingAvailability=stock;c.seedlingCensus={period:e.date};}
      }
      const pineapple=record?.crops?.find(c=>String(c.crop).trim().toUpperCase()==='NANAS');
      const pop=pineapple?summary.population(pineapple):null;
      const mpts=(record?.crops||[]).filter(c=>summary.MPTS.includes(String(c.crop).trim().toUpperCase())).map(c=>({species:c.crop,source_count:numeric(c.sourcePopulationInitial??c.vegetationCount),living_census:numeric(c.populationCensus?.livingPlantCount),census_period:c.populationCensus?.period||null,planting_period:c.plantingDate||c.plantingPeriod||null}));
      const capacityMatch=pineapple&&numeric(pineapple.spacingM2)>0&&numeric(pineapple.widthM)>0&&numeric(pineapple.lengthM)>0&&pop.baseline!==null&&Math.abs(pop.baseline-pineapple.widthM*pineapple.lengthM/pineapple.spacingM2)<.001;
      return {gawangan:zone.id,category:zone.kind,object_id:objectId,database_match:!!record,pineapple_planting_period:pineapple?.plantingDate||pineapple?.plantingPeriod||null,pineapple_cohorts:JSON.parse(JSON.stringify(pineapple?.plantingCohorts||[])),pineapple_source_initial:pop?.baseline??null,pineapple_added_planted:pop?.added??null,pineapple_total_recorded:pop?.recorded??null,pineapple_living_census:pop?.living??null,pineapple_census_period:pop?.censusPeriod||null,seedling_stock:numeric(pineapple?.seedlingAvailability),seedling_census_period:pineapple?.seedlingCensus?.period||null,source_matches_spacing_capacity:!!capacityMatch,mpts,source_mpts_total:mpts.length&&mpts.every(c=>c.source_count!==null)?mpts.reduce((s,c)=>s+c.source_count,0):null,image_candidates:zone.candidate_crowns,validated_image_pineapple_count:null,count_difference:null,survival_percent:null,age_at_flight_months:null};
    });
    return {schema:'dayun-ortho-database-comparison-v1',block:analysis.block,source_run:analysis.source_run,database_updated_at:details.updatedAt||null,provenance,rows,census_changed:false,note:'Source population, planted additions, living census and seedling stock have different meanings. Fractional source values are preserved. Image crowns are unvalidated; no loss/survival or total-plant difference is computed. Flight date is unknown, so planting age at flight cannot be calculated. Dead-strip analysis IDs have no automatic census join.'};
  }
  function csv(value){const fields=['gawangan','category','database_match','pineapple_planting_period','pineapple_cohorts','pineapple_source_initial','pineapple_added_planted','pineapple_total_recorded','pineapple_living_census','pineapple_census_period','seedling_stock','seedling_census_period','source_matches_spacing_capacity','mpts','source_mpts_total','image_candidates','validated_image_pineapple_count','count_difference','survival_percent','age_at_flight_months'];const cell=v=>'"'+String(v==null?'':typeof v==='object'?JSON.stringify(v):v).replaceAll('"','""')+'"';return[fields.join(','),...value.rows.map(r=>fields.map(f=>cell(r[f])).join(','))].join('\n');}
  return{build,csv};
});
