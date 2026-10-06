const ORIGINS = new Set(['https://webgisyg.id', 'https://www.webgisyg.id']);
export async function meritechTile(request, env, verifyStaffToken, upstreamFetch = fetch) {
  const origin = request.headers.get('origin') || '';
  const headers = {'access-control-allow-origin': ORIGINS.has(origin) ? origin : 'https://webgisyg.id', 'access-control-allow-methods': 'GET, OPTIONS', 'access-control-allow-headers': 'authorization', vary: 'Origin, Authorization', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff'};
  const error = (message, status) => new Response(JSON.stringify({error: message}), {status, headers: {...headers, 'content-type': 'application/json'}});
  if (origin && !ORIGINS.has(origin)) return error('origin_not_allowed', 403);
  if (request.method === 'OPTIONS') return new Response(null, {status: 204, headers});
  if (request.method !== 'GET') return error('method_not_allowed', 405);
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token || !await verifyStaffToken(token, env)) return error('unauthorized', 401);
  const match = new URL(request.url).pathname.match(/^\/api\/staff\/meritech\/tile\/(17|18|19)\/(\d{1,6})\/(\d{1,6})$/);
  if (!match) return error('invalid_tile', 400);
  const [z,x,y] = match.slice(1).map(Number), n = 2 ** z;
  const lon = (x + .5) / n * 360 - 180;
  const lat = Math.atan(Math.sinh(Math.PI * (1 - 2 * (y + .5) / n))) * 180 / Math.PI;
  if (x >= n || y >= n || lon < 99.5 || lon > 104.5 || lat < -1.5 || lat > 3.5) return error('outside_riau_window', 400);
  try {
    const response = await upstreamFetch(`https://petadasar.meritech.cloud/tile/${z}/${x}/${y}.jpg`, {redirect: 'manual', signal: AbortSignal.timeout(15000)});
    if (!response.ok) return error('source_unavailable', 502);
    if (!/^image\/(?:jpeg|jpg)(?:;|$)/i.test(response.headers.get('content-type') || '')) return error('invalid_source_image', 502);
    if (Number(response.headers.get('content-length')) > 1024 * 1024) return error('source_too_large', 502);
    const reader = response.body.getReader(), chunks = []; let bytes = 0;
    while (true) { const {done, value} = await reader.read(); if (done) break; bytes += value.byteLength; if (bytes > 1024 * 1024) { await reader.cancel(); return error('source_too_large', 502); } chunks.push(value); }
    return new Response(new Blob(chunks), {headers: {...headers, 'content-type': 'image/jpeg'}});
  } catch { return error('source_unavailable', 502); }
}
