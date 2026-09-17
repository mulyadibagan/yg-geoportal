import baseWorker from './index.js';
import { isDroneRoute, handleDroneRequest } from './drone.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (isDroneRoute(url.pathname)) return handleDroneRequest(request, env, url);
    return baseWorker.fetch(request, env, ctx);
  }
};
