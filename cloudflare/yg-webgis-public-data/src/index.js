const ROUTES = {
  "/snapshots/current/dashboard.json": {
    key: "snapshots/current/dashboard.json",
    github: "/data/dashboard-summary-snapshot.json",
    appsScriptPage: "objects"
  },
  "/snapshots/current/objects.json": {
    key: "snapshots/current/objects.json",
    github: "/data/master-database-snapshot.json",
    appsScriptPage: "objects"
  },
  "/manifests/current.json": {
    key: "manifests/current.json"
  }
};

const PUBLIC_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, HEAD, OPTIONS",
  "access-control-max-age": "86400",
  "x-content-type-options": "nosniff"
};

function jsonResponse(value, status, extraHeaders) {
  return new Response(JSON.stringify(value), {
    status: status || 200,
    headers: Object.assign({ "content-type": "application/json; charset=utf-8" },
      PUBLIC_HEADERS, extraHeaders || {})
  });
}

function withPublicHeaders(response, source, cacheControl) {
  const headers = new Headers(response.headers);
  Object.entries(PUBLIC_HEADERS).forEach(([key, value]) => headers.set(key, value));
  headers.set("cache-control", cacheControl);
  headers.set("x-yg-data-source", source);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

async function fromR2(request, env, route) {
  if (!env.PUBLIC_SNAPSHOTS || !route.key) return null;
  const object = await env.PUBLIC_SNAPSHOTS.get(route.key);
  if (!object) return null;
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  if (!headers.has("content-type")) headers.set("content-type", "application/json; charset=utf-8");
  const body = request.method === "HEAD" ? null : object.body;
  return withPublicHeaders(new Response(body, { headers }), "r2", "public, max-age=300, stale-while-revalidate=3600");
}

async function fetchFallback(request, env, route) {
  if (route.github) {
    try {
      const github = await fetch(env.GITHUB_ORIGIN + route.github, {
        headers: { accept: "application/json" }
      });
      if (github.ok) {
        return withPublicHeaders(
          new Response(request.method === "HEAD" ? null : github.body, {
            status: github.status,
            headers: github.headers
          }),
          "github-pages",
          "public, max-age=60, stale-while-revalidate=300"
        );
      }
    } catch (error) {
      console.warn({ event: "github_fallback_failed", path: route.github, message: error.message });
    }
  }
  if (route.appsScriptPage) {
    try {
      const appsScript = await fetch(env.APPS_SCRIPT_BASE + "?page=" + route.appsScriptPage, {
        headers: { accept: "application/json" },
        redirect: "follow"
      });
      if (appsScript.ok) {
        return withPublicHeaders(
          new Response(request.method === "HEAD" ? null : appsScript.body, {
            status: appsScript.status,
            headers: appsScript.headers
          }),
          "apps-script-fallback",
          "no-store"
        );
      }
    } catch (error) {
      console.error({ event: "apps_script_fallback_failed", message: error.message });
    }
  }
  return null;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: PUBLIC_HEADERS });
    if (request.method !== "GET" && request.method !== "HEAD") {
      return jsonResponse({ ok: false, error: "method_not_allowed" }, 405, { allow: "GET, HEAD, OPTIONS" });
    }
    if (url.pathname === "/health") {
      return jsonResponse({ ok: true, service: "yg-webgis-public-data", environment: env.ENVIRONMENT }, 200,
        { "cache-control": "no-store" });
    }
    const route = ROUTES[url.pathname];
    if (!route) return jsonResponse({ ok: false, error: "not_found" }, 404, { "cache-control": "no-store" });

    try {
      const r2 = await fromR2(request, env, route);
      if (r2) return r2;
    } catch (error) {
      console.error({ event: "r2_read_failed", key: route.key, message: error.message });
    }
    const fallback = await fetchFallback(request, env, route);
    if (fallback) return fallback;
    return jsonResponse({ ok: false, error: "snapshot_unavailable" }, 503,
      { "cache-control": "no-store", "retry-after": "60" });
  }
};
