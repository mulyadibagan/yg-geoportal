const ROUTES = { "/snapshots/current/dashboard.json": { name: "dashboard", github: "/data/dashboard-summary-snapshot.json" }, "/snapshots/current/objects.json": { name: "objects", github: "/data/master-database-snapshot.json" }, "/research/liberica-morphology-2026.json": { key: "research/liberica-morphology-2026.json", github: "/data/liberica-morphology-2026.json" }, "/references/kph_2019_riau.geojson": { key: "references/kph_2019_riau.geojson" }, "/manifests/current.json": { key: "manifests/current.json" } }, PUBLIC_HEADERS = { "access-control-allow-origin": "*", "access-control-allow-methods": "GET, HEAD, OPTIONS", "access-control-max-age": "86400", "x-content-type-options": "nosniff" }, STAFF_API_HEADERS = { "access-control-allow-origin": "https://webgisyg.id", "access-control-allow-methods": "GET, HEAD, OPTIONS", "access-control-allow-headers": "authorization", "access-control-max-age": "3600", vary: "Origin", "x-content-type-options": "nosniff" }, META = { httpMetadata: { contentType: "application/json; charset=utf-8", cacheControl: "public, max-age=300" } };
ROUTES["/references/rspo-riau-groups.geojson"] = { key: "references/rspo-riau-groups.geojson" };
function json(value, status = 200, headers = {}) {
  return new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json; charset=utf-8", ...PUBLIC_HEADERS, ...headers } });
}
function staffJson(value, status = 200, headers = {}) {
  return new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json; charset=utf-8", ...STAFF_API_HEADERS, "cache-control": "no-store", ...headers } });
}
function publicResponse(response, source, cache) {
  const h = new Headers(response.headers);
  return Object.entries(PUBLIC_HEADERS).forEach(([k, v]) => h.set(k, v)), h.set("cache-control", cache), h.set("x-yg-data-source", source), new Response(response.body, { status: response.status, headers: h });
}
async function hash(text) {
  const data = new TextEncoder().encode(text), digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}
async function authorized(request, secret) {
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  if (!secret || !supplied) return false;
  const [a, b] = await Promise.all([hash(supplied), hash(secret)]);
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return 0 === difference;
}
async function r2Key(env, route) {
  if (route.key) return route.key;
  const object = await env.PUBLIC_SNAPSHOTS.get("manifests/current.json");
  if (!object) return `snapshots/current/${route.name}.json`;
  try {
    const manifest = JSON.parse(await object.text());
    return String(manifest?.snapshots?.[route.name]?.path || "").replace(/^\//, "") || `snapshots/current/${route.name}.json`;
  } catch {
    return `snapshots/current/${route.name}.json`;
  }
}
async function fromR2(request, env, route) {
  if (!env.PUBLIC_SNAPSHOTS) return null;
  const object = await env.PUBLIC_SNAPSHOTS.get(await r2Key(env, route));
  if (!object) return null;
  const h = new Headers();
  return object.writeHttpMetadata(h), h.set("etag", object.httpEtag), h.has("content-type") || h.set("content-type", "application/json; charset=utf-8"), publicResponse(new Response("HEAD" === request.method ? null : object.body, { headers: h }), "r2", "public, max-age=300, stale-while-revalidate=3600");
}
async function fallback(request, env, route) {
  if (!route.github) return null;
  try {
    const response = await fetch(env.GITHUB_ORIGIN + route.github, { headers: { accept: "application/json" } });
    if (response.ok) return publicResponse(new Response("HEAD" === request.method ? null : response.body, { status: response.status, headers: response.headers }), "github-pages", "public, max-age=60, stale-while-revalidate=300");
  } catch (error) {
    console.warn({ event: "github_fallback_failed", message: error.message });
  }
  return null;
}
async function fetchJson(url) {
  const response = await fetch(url, { headers: { accept: "application/json", "user-agent": "YG-GeoPortal-Cloudflare-Snapshot/1.0" }, redirect: "follow" });
  if (!response.ok) throw new Error(`upstream_http_${response.status}`);
  const value = await response.json();
  if (!value || "object" != typeof value) throw new Error("invalid_upstream_json");
  return value;
}
function normalizeJson(value) {
  let current = value;
  for (let depth = 0; depth < 2 && "string" == typeof current; depth++) try {
    current = JSON.parse(current);
  } catch {
    return null;
  }
  return current && "object" == typeof current ? current : null;
}
function safeSession(session) {
  if (!session || "object" != typeof session) return {};
  const { createdByEmail, ...rest } = session;
  return rest;
}
function safeQuestion(question) {
  if (!question || "object" != typeof question) return {};
  const { createdByEmail, ...rest } = question;
  return rest;
}
async function prepostStaffApi(request, env, url) {
  const isDetail = "/api/prepost/session-detail" === url.pathname, sessionId = String(url.searchParams.get("sessionId") || "").trim();
  if (isDetail && !/^[a-zA-Z0-9_-]{1,100}$/.test(sessionId)) return staffJson({ ok: false, error: "invalid_session_id" }, 400);
  const upstream = new URL(env.APPS_SCRIPT_BASE);
  upstream.searchParams.set("page", isDetail ? "prepost-session-detail" : "prepost-live-summary"), isDetail ? upstream.searchParams.set("sessionId", sessionId) : upstream.searchParams.set("scope", "active");
  try {
    const response = await fetch(upstream.toString(), { headers: { accept: "application/json", "user-agent": "YG-GeoPortal-Cloudflare-Staff-API/1.0" }, redirect: "follow" });
    if (!response.ok) throw new Error(`upstream_http_${response.status}`);
    const data = normalizeJson(await response.json());
    if (!data) throw new Error("invalid_upstream_json");
    return staffJson(isDetail ? { ...data, session: safeSession(data.session), questions: Array.isArray(data.questions) ? data.questions.map(safeQuestion) : [] } : { ...data, sessions: Array.isArray(data.sessions) ? data.sessions.map((item) => safeSession(item?.session || item)) : [] }, 200, { "x-yg-data-source": "apps-script" });
  } catch (error) {
    return console.error({ event: "prepost_staff_api_failed", path: url.pathname, message: error.message }), staffJson({ ok: false, error: "upstream_unavailable" }, 502, { "retry-after": "30" });
  }
}
async function staffAuthResultApi(env, url) {
  const requestId = String(url.searchParams.get("requestId") || "").trim();
  if (!/^yg-auth-[a-zA-Z0-9_-]{1,100}$/.test(requestId)) return staffJson({ ok: false, error: "invalid_request_id" }, 400);
  const upstream = new URL(env.APPS_SCRIPT_BASE);
  upstream.searchParams.set("page", "editor-auth-result"), upstream.searchParams.set("requestId", requestId);
  try {
    const response = await fetch(upstream.toString(), { headers: { accept: "application/json", "user-agent": "YG-GeoPortal-Cloudflare-Staff-Auth/1.0" }, redirect: "follow" });
    if (!response.ok) throw new Error(`upstream_http_${response.status}`);
    const data = normalizeJson(await response.json());
    if (!data) throw new Error("invalid_upstream_json");
    return staffJson(data, 200, { "x-yg-data-source": "apps-script" });
  } catch (error) {
    return console.error({ event: "staff_auth_result_failed", message: error.message }), staffJson({ ok: false, error: "upstream_unavailable" }, 502, { "retry-after": "2" });
  }
}
async function donorProgrammeApi(request, env) {
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() || "", upstream = new URL(env.APPS_SCRIPT_BASE);
  upstream.searchParams.set("page", "donor-programmes"), supplied && upstream.searchParams.set("sessionToken", supplied);
  const respond = (value, status = 200, headers = {}) => supplied ? staffJson(value, status, headers) : json(value, status, { "cache-control": "no-store", ...headers });
  try {
    const response = await fetch(upstream.toString(), { headers: { accept: "application/json", "user-agent": "YG-GeoPortal-Cloudflare-Donor-API/1.0" }, redirect: "follow" });
    if (!response.ok) throw new Error(`upstream_http_${response.status}`);
    const data = normalizeJson(await response.json());
    if (!data) throw new Error("invalid_upstream_json");
    return respond(data, 200, { "x-yg-data-source": "apps-script" });
  } catch (error) {
    return console.error({ event: "donor_programme_api_failed", message: error.message }), respond({ ok: false, error: "upstream_unavailable" }, 502, { "retry-after": "30" });
  }
}
async function donorAdminResultApi(request, env, url) {
  const requestId = String(url.searchParams.get("requestId") || "").trim(), supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() || "";
  if (!/^yg-donor-[a-zA-Z0-9_-]{1,120}$/.test(requestId)) return staffJson({ ok: false, error: "invalid_request_id" }, 400);
  if (!supplied) return staffJson({ ok: false, error: "unauthorized" }, 401);
  const upstream = new URL(env.APPS_SCRIPT_BASE);
  upstream.searchParams.set("page", "donor-admin-result"), upstream.searchParams.set("requestId", requestId), upstream.searchParams.set("sessionToken", supplied);
  try {
    const response = await fetch(upstream.toString(), { headers: { accept: "application/json", "user-agent": "YG-GeoPortal-Cloudflare-Donor-Admin-API/1.0" }, redirect: "follow" });
    if (!response.ok) throw new Error(`upstream_http_${response.status}`);
    const data = normalizeJson(await response.json());
    if (!data) throw new Error("invalid_upstream_json");
    return staffJson(data);
  } catch (error) {
    return console.error({ event: "donor_admin_result_api_failed", message: error.message }), staffJson({ ok: false, error: "upstream_unavailable" }, 502, { "retry-after": "30" });
  }
}
async function validStaffToken(token, env) {
  if (!token) return false;
  const upstream = new URL(env.APPS_SCRIPT_BASE);
  upstream.searchParams.set("page", "staff-reports"), upstream.searchParams.set("sessionToken", token);
  try {
    const response = await fetch(upstream.toString(), { headers: { accept: "application/json", "user-agent": "YG-GeoPortal-Cloudflare-RSPO/1.0" }, redirect: "follow" });
    if (!response.ok) return false;
    const data = normalizeJson(await response.json());
    return Boolean(data) && true !== data.requiresLogin && false !== data.ok;
  } catch {
    return false;
  }
}
async function rspoGroupsApi(request, env) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() || "";
  if (!await validStaffToken(token, env)) return staffJson({ ok: false, error: "unauthorized" }, 401);
  try {
    const object = await env.PUBLIC_SNAPSHOTS?.get("internal/rspo/riau-groups.geojson");
    if (!object) return staffJson({ ok: false, error: "overview_unavailable" }, 503, { "retry-after": "30" });
    const headers = new Headers();
    return object.writeHttpMetadata(headers), Object.entries(STAFF_API_HEADERS).forEach(([k, v]) => headers.set(k, v)), headers.set("content-type", "application/geo+json; charset=utf-8"), headers.set("cache-control", "private, max-age=300"), headers.set("etag", object.httpEtag), headers.set("x-yg-data-source", "r2-private-route"), new Response("HEAD" === request.method ? null : object.body, { headers });
  } catch (error) {
    return console.error({ event: "rspo_groups_failed", message: error.message }), staffJson({ ok: false, error: "overview_unavailable" }, 503, { "retry-after": "30" });
  }
}
function enrich(objects, reports, updates) {
  if (!Array.isArray(objects.features) || !Array.isArray(reports.features)) throw new Error("invalid_feature_collection");
  const byReport = new Map(reports.features.map((f) => [String(f?.properties?.reportId || "").trim(), f?.properties || {}])), byObject = new Map(objects.features.map((f) => [String(f?.properties?.Object_ID || "").trim().toLowerCase(), f?.properties || {}]));
  for (const feature of objects.features) {
    const p = feature?.properties;
    if (!p) continue;
    const report = byReport.get(String(p.reportId || p.Source_Report_ID || "").trim());
    if (report) for (const key of ["reporterName", "organization", "targetFeatureProperties"]) void 0 !== report[key] && "" !== report[key] && (p[key] = report[key]);
  }
  let attached = 0;
  for (const feature of updates?.features || []) {
    const p = feature?.properties || {}, target = "object" == typeof p.targetFeatureProperties ? p.targetFeatureProperties : {}, object = byObject.get(String(target.Object_ID || p.Object_ID || "").trim().toLowerCase()), photos = Array.isArray(p.photos) ? p.photos.filter((url) => /^https?:\/\//i.test(String(url))) : [];
    object && photos.length && (object._ygPhotos = Array.from(/* @__PURE__ */ new Set([...Array.isArray(object._ygPhotos) ? object._ygPhotos : [], ...photos])), attached++);
  }
  return objects.publicUpdateAudit = { published: updates?.features?.length || 0, photosAttachedByPermanentObjectId: attached }, objects;
}
async function refresh(env, event) {
  if (!env.PUBLIC_SNAPSHOTS) throw new Error("r2_binding_missing");
  const base = env.APPS_SCRIPT_BASE, [raw, reports, prepost, updates] = await Promise.all([fetchJson(`${base}?page=objects`), fetchJson(`${base}?page=public-reports`), fetchJson(`${base}?page=prepost-live-summary&scope=active`), fetchJson(`${base}?page=public-updates`)]), now = (/* @__PURE__ */ new Date()).toISOString(), id = String(event.reportId || "publication").replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 80), version = `${now.replace(/[-:.TZ]/g, "")}-${id}`, objects = enrich(structuredClone(raw), reports, updates);
  objects.snapshotGeneratedAt = now;
  const dashboard = { type: "FeatureCollection", dashboardSnapshotVersion: 1, generatedAt: objects.generatedAt || now, snapshotGeneratedAt: now, featureCount: objects.features.length, source: "YG_MASTER_DATABASE_PUBLIC_SNAPSHOT", capacitySources: { reports, prepost }, features: objects.features.map((f) => ({ type: "Feature", properties: f?.properties || {} })) }, texts = { dashboard: JSON.stringify(dashboard), objects: JSON.stringify(objects) }, snapshots = {};
  for (const name of ["dashboard", "objects"]) {
    const data = "dashboard" === name ? dashboard : objects;
    snapshots[name] = { path: `/snapshots/${version}/${name}.json`, bytes: new TextEncoder().encode(texts[name]).length, sha256: await hash(texts[name]), featureCount: data.features.length, generatedAt: data.generatedAt || null };
  }
  await Promise.all(Object.entries(texts).map(([name, text]) => env.PUBLIC_SNAPSHOTS.put(`snapshots/${version}/${name}.json`, text, META)));
  const manifest = { schemaVersion: 1, service: "yg-webgis-public-data", version, publishedAt: now, trigger: { event: event.event || "report_published", reportId: event.reportId || null }, snapshots };
  return await env.PUBLIC_SNAPSHOTS.put("manifests/current.json", JSON.stringify(manifest), META), manifest;
}
var index_default = { async fetch(request, env) {
  const url = new URL(request.url), staffApi = "/api/prepost/sessions" === url.pathname || "/api/prepost/session-detail" === url.pathname || "/api/staff/auth-result" === url.pathname || "/api/donor/programmes" === url.pathname || "/api/donor/admin-result" === url.pathname || "/api/staff/rspo-groups" === url.pathname;
  if ("OPTIONS" === request.method) return new Response(null, { status: 204, headers: staffApi ? STAFF_API_HEADERS : PUBLIC_HEADERS });
  if ("/internal/refresh" === url.pathname) {
    if ("POST" !== request.method) return json({ ok: false, error: "method_not_allowed" }, 405, { allow: "POST, OPTIONS" });
    if (!await authorized(request, env.REFRESH_TOKEN)) return json({ ok: false, error: "unauthorized" }, 401, { "cache-control": "no-store" });
    try {
      const manifest = await refresh(env, await request.json() || {});
      return json({ ok: true, version: manifest.version, publishedAt: manifest.publishedAt }, 200, { "cache-control": "no-store" });
    } catch (error) {
      return console.error({ event: "snapshot_refresh_failed", message: error.message }), json({ ok: false, error: "refresh_failed" }, 502, { "cache-control": "no-store" });
    }
  }
  if ("GET" !== request.method && "HEAD" !== request.method) return json({ ok: false, error: "method_not_allowed" }, 405, { allow: "GET, HEAD, OPTIONS" });
  if ("/health" === url.pathname) return json({ ok: true, service: "yg-webgis-public-data", environment: env.ENVIRONMENT }, 200, { "cache-control": "no-store" });
  if ("/api/staff/auth-result" === url.pathname) return staffAuthResultApi(env, url);
  if ("/api/donor/programmes" === url.pathname) return donorProgrammeApi(request, env);
  if ("/api/donor/admin-result" === url.pathname) return donorAdminResultApi(request, env, url);
  if ("/api/staff/rspo-groups" === url.pathname) return rspoGroupsApi(request, env);
  if (staffApi) return prepostStaffApi(request, env, url);
  const route = ROUTES[url.pathname];
  if (!route) return json({ ok: false, error: "not_found" }, 404, { "cache-control": "no-store" });
  try {
    const response2 = await fromR2(request, env, route);
    if (response2) return response2;
  } catch (error) {
    console.error({ event: "r2_read_failed", message: error.message });
  }
  const response = await fallback(request, env, route);
  return response || json({ ok: false, error: "snapshot_unavailable" }, 503, { "cache-control": "no-store", "retry-after": "60" });
} };
export {
  index_default as default
};
