import {runFruitLinkJob} from './dayun-fruit-link-job.js';
export { DroneQueue } from './drone-queue.js';
import { meritechTile } from './meritech.js';
import baseWorker, { validStaffToken, rememberValidStaffToken } from './index.js';
import { staffLogin } from './staff-login.js';
import { isDroneRoute, handleDroneRequest } from './drone.js';

export default {
  async scheduled(controller, env, ctx) { ctx.waitUntil(runFruitLinkJob(env)); },
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if(['/dayun/live-work-counts.json','/dayun/new-planting.geojson'].includes(url.pathname)){
      const headers={'access-control-allow-origin':'*','access-control-allow-methods':'GET, HEAD, OPTIONS','cache-control':'no-store','content-type':'application/json','x-content-type-options':'nosniff'};
      if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
      if(!['GET','HEAD'].includes(request.method))return new Response(null,{status:405,headers});
      const stub=env.DRONE_QUEUE.get(env.DRONE_QUEUE.idFromName('dayun-live-counts-Agro_ABC'));
      const response=await stub.fetch(new Request('https://queue.internal/'+(url.pathname==='/dayun/new-planting.geojson'?'dayun-agro-map':'dayun-live-counts')+(url.searchParams.get('refresh')==='1'?'?refresh=1':'')));
      return new Response(request.method==='HEAD'?null:response.body,{status:response.status,headers});
    }
    if(url.pathname.startsWith('/api/staff/meritech/tile/')) return meritechTile(request, env, validStaffToken);
    if(url.pathname==='/api/staff/login')return staffLogin(request,env,rememberValidStaffToken);
    if (isDroneRoute(url.pathname)) return handleDroneRequest(request, env, url, validStaffToken);
    return baseWorker.fetch(request, env, ctx);
  }
};

