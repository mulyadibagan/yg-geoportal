import {reviewOperation} from './dayun-feedback.js';
import {blockReviewOperation} from './dayun-block-corrections.js';
import {fruitingOperation} from './dayun-fruiting.js';
// One coordinator serializes queue changes; R2 mirror remains readable by the processor.
export class DroneQueue {
  constructor(state,env){this.state=state;this.env=env;}
  async fetch(request){return this.state.blockConcurrencyWhile(async()=>{
    if(new URL(request.url).pathname==='/dayun-fruiting-review'){
      try{return Response.json(await fruitingOperation(this.env,await request.json()));}
      catch(error){return Response.json({ok:false,error:error.status?error.message:'private_fruiting_storage_failed',...(error.fruit_id?{fruit_id:error.fruit_id}:{})},{status:error.status||503});}
    }
    if(new URL(request.url).pathname==='/dayun-block-review'){
      try{return Response.json(await blockReviewOperation(this.env,await request.json()));}
      catch(error){return Response.json({ok:false,error:error.status?error.message:'private_block_review_storage_failed',...(error.conflicts?{conflicts:error.conflicts}:{})},{status:error.status||503});}
    }
    if(new URL(request.url).pathname==='/dayun-review'){
      try{return Response.json(await reviewOperation(this.env,await request.json()));}
      catch(error){return Response.json({ok:false,error:error.status?error.message:'private_review_storage_failed'},{status:error.status||503});}
    }
    if(new URL(request.url).pathname==='/dayun'){
      const body=await request.json();
      if(body.action!=='submit'||!['Agro_ABC','Agro_DEF'].includes(body.job?.label))return Response.json({error:'invalid_analysis'},{status:400});
      const root='drone/analysis/dayun',key=`${root}/requests/${body.job.label}.json`;
      const object=await this.env.PUBLIC_SNAPSHOTS.get(key),previous=object?JSON.parse(await object.text()):null;
      if(previous?.status==='pending'||(previous?.status==='processing'&&(!previous.leaseExpiresAt||Date.parse(previous.leaseExpiresAt)>Date.now())))return Response.json({job:previous,reused:true});
      await this.env.PUBLIC_SNAPSHOTS.put(key,JSON.stringify(body.job),{httpMetadata:{contentType:'application/json',cacheControl:'private, no-store'}});
      return Response.json({job:body.job,reused:false});
    }
    let queue=await this.state.storage.get('queue');
    if(!queue){const object=await this.env.PUBLIC_SNAPSHOTS.get('drone/queue/pending.json');queue=object?JSON.parse(await object.text()):{jobs:[]};queue.jobs=Array.isArray(queue.jobs)?queue.jobs:[];}
    const body=request.method==='POST'?await request.json():{};
    if(body.action==='add'&&!queue.jobs.includes(body.id)){if(queue.jobs.length>=4)return Response.json({error:'queue_full'},{status:429});if(body.job)await this.env.PUBLIC_SNAPSHOTS.put('drone/jobs/'+body.id+'.json',JSON.stringify(body.job),{httpMetadata:{contentType:'application/json'}});queue.jobs.push(body.id);}
    if(body.action==='remove')queue.jobs=queue.jobs.filter(id=>id!==body.id);
    queue.updatedAt=new Date().toISOString();
    await this.state.storage.put('queue',queue);
    // Also repairs a mirror after an interrupted R2 write.
    await this.env.PUBLIC_SNAPSHOTS.put('drone/queue/pending.json',JSON.stringify(queue),{httpMetadata:{contentType:'application/json'}});
    return Response.json(queue);
  });}
}
