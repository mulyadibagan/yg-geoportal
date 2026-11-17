import { normalizeSource, validatePlan } from '../../../js/restoration-plan-model.mjs';
const PREFIX = '/api/staff/restoration/';
const KEYS = { source: 'internal/restoration/planning-source.json', plan: 'internal/restoration/bengkalis-dumai-plan.json' };
const LIMIT = 6 * 1024 * 1024;
const HEADERS = {
  'access-control-allow-origin': 'https://webgisyg.id',
  'access-control-allow-methods': 'GET, HEAD, PUT, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type',
  'content-type': 'application/json; charset=utf-8', 'cache-control': 'private, no-store',
  'x-content-type-options': 'nosniff', vary: 'Origin'
};
const reply = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: HEADERS });
export const isRestorationRoute = path => [PREFIX + 'source', PREFIX + 'plan'].includes(path);
async function readLimited(request) {
  if (Number(request.headers.get('content-length')) > LIMIT) throw Object.assign(Error('payload_too_large'), { status: 413 });
  if (!request.body) throw Error('empty_body');
  const reader = request.body.getReader(); let size = 0; const chunks = [];
  try {
    for (;;) { const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength; if (size > LIMIT) throw Object.assign(Error('payload_too_large'), { status: 413 }); chunks.push(value); }
  } catch (error) { await reader.cancel().catch(() => {}); throw error; }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
}
export async function handleRestoration(request, env, authorize) {
  const resource = new URL(request.url).pathname.slice(PREFIX.length);
  if (!KEYS[resource]) return reply({ ok: false, error: 'not_found' }, 404);
  const origin = request.headers.get('origin');
  if (origin && origin !== 'https://webgisyg.id') return new Response(null, { status: 403 });
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: HEADERS });
  if (!['GET', 'HEAD', 'PUT'].includes(request.method)) return reply({ ok: false, error: 'method_not_allowed' }, 405);
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim() || '';
  if (!token || !await authorize(token, env)) return reply({ ok: false, error: 'unauthorized' }, 401);
  if (!env.PUBLIC_SNAPSHOTS) return reply({ ok: false, error: 'storage_unavailable' }, 503);
  try {
    if (request.method !== 'PUT') {
      const object = await env.PUBLIC_SNAPSHOTS.get(KEYS[resource]);
      if (!object) return reply({ ok: false, error: 'not_found' }, 404);
      if (request.method === 'HEAD') return new Response(null, { headers: HEADERS });
      return reply({ ok: true, version: object.etag, value: await object.json() });
    }
    if (origin !== 'https://webgisyg.id') return reply({ ok: false, error: 'origin_required' }, 403);
    if (!request.headers.get('content-type')?.startsWith('application/json')) return reply({ ok: false, error: 'json_required' }, 415);
    const body = await readLimited(request);
    if (!Object.hasOwn(body, 'expectedVersion') || !(body.expectedVersion === null || typeof body.expectedVersion === 'string' && /^[a-zA-Z0-9-]{1,128}$/.test(body.expectedVersion))) {
      return reply({ ok: false, error: 'expected_version_required' }, 428);
    }
    let value;
    if (resource === 'source') value = normalizeSource(body.value);
    else {
      const sourceObject = await env.PUBLIC_SNAPSHOTS.get(KEYS.source);
      if (!sourceObject) return reply({ ok: false, error: 'source_required' }, 409);
      if (body.value?.sourceVersion !== sourceObject.etag) return reply({ ok: false, error: 'source_changed' }, 409);
      value = validatePlan(body.value, await sourceObject.json());
    }
    const data = JSON.stringify(value), hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data))), b => b.toString(16).padStart(2, '0')).join('');
    const condition = new Headers();
    condition.set(body.expectedVersion === null ? 'if-none-match' : 'if-match', body.expectedVersion === null ? '*' : '"' + body.expectedVersion + '"');
    await env.PUBLIC_SNAPSHOTS.put('internal/restoration/history/' + resource + '/' + hash + '.json', data, {
      httpMetadata: { contentType: 'application/json; charset=utf-8', cacheControl: 'private, no-store' }
    });
    const stored = await env.PUBLIC_SNAPSHOTS.put(KEYS[resource], data, {
      onlyIf: condition, httpMetadata: { contentType: 'application/json; charset=utf-8', cacheControl: 'private, no-store' }
    });
    if (!stored) return reply({ ok: false, error: 'version_conflict' }, 409);
    return reply({ ok: true, version: stored.etag, value });
  } catch (error) {
    return reply({ ok: false, error: error.status === 413 ? 'payload_too_large' : 'invalid_or_unavailable_data' }, error.status || 400);
  }
}

