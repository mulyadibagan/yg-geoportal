import baseWorker, { validStaffToken, rememberValidStaffToken } from './index.js';
import { staffLogin } from './staff-login.js';
import { isDroneRoute, handleDroneRequest } from './drone.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if(url.pathname==='/api/staff/login')return staffLogin(request,env,rememberValidStaffToken);
    if (isDroneRoute(url.pathname)) return handleDroneRequest(request, env, url, validStaffToken);
    return baseWorker.fetch(request, env, ctx);
  }
};
