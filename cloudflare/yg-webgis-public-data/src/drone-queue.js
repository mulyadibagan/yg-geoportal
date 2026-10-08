// One coordinator serializes queue changes; R2 mirror remains readable by the processor.
export class DroneQueue {
  constructor(state,env){this.state=state;this.env=env;}
  async fetch(request){return this.state.blockConcurrencyWhile(async()=>{
    let queue=await this.state.storage.get('queue');
    if(!queue){const object=await this.env.PUBLIC_SNAPSHOTS.get('drone/queue/pending.json');queue=object?JSON.parse(await object.text()):{jobs:[]};queue.jobs=Array.isArray(queue.jobs)?queue.jobs:[];}
    const body=request.method==='POST'?await request.json():{};
    if(body.action==='add'&&!queue.jobs.includes(body.id)){if(queue.jobs.length>=20)return Response.json({error:'queue_full'},{status:429});if(body.job)await this.env.PUBLIC_SNAPSHOTS.put('drone/jobs/'+body.id+'.json',JSON.stringify(body.job),{httpMetadata:{contentType:'application/json'}});queue.jobs.push(body.id);}
    if(body.action==='remove')queue.jobs=queue.jobs.filter(id=>id!==body.id);
    queue.updatedAt=new Date().toISOString();
    await this.state.storage.put('queue',queue);
    // Also repairs a mirror after an interrupted R2 write.
    await this.env.PUBLIC_SNAPSHOTS.put('drone/queue/pending.json',JSON.stringify(queue),{httpMetadata:{contentType:'application/json'}});
    return Response.json(queue);
  });}
}
