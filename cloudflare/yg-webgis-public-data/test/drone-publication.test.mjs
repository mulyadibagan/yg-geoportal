import assert from 'node:assert/strict';
import test from 'node:test';
import worker from '../src/main.js';

function droneEnv() {
  const store = new Map();
  return {
    ENVIRONMENT: 'test',
    GITHUB_ORIGIN: 'https://origin.invalid',
    APPS_SCRIPT_BASE: 'https://apps.invalid/exec',
    PUBLIC_SNAPSHOTS: {
      async get(key) {
        if (!store.has(key)) return null;
        const value = store.get(key);
        return {
          body: value,
          size: String(value).length,
          httpEtag: '"drone-test"',
          async text() { return String(value); },
          writeHttpMetadata(headers) {
            headers.set('content-type', key.endsWith('.json') ? 'application/json' : 'image/tiff');
          }
        };
      },
      async put(key, value) { store.set(key, String(value)); },
      async list({ prefix = '' } = {}) {
        return { objects: [...store.keys()].filter(key => key.startsWith(prefix)).map(key => ({ key })) };
      }
    },
    store
  };
}

const id = 'drn-publication-test';
const token = 'owner-token';
const jobKey = `drone/jobs/${id}.json`;
const cogKey = `drone/results/${id}/orthomosaic.cog.tif`;

function readyJob() {
  return {
    id,
    accessToken: token,
    title: 'Dayun Blok A',
    project: 'YG GeoPortal',
    status: 'ready',
    cogKey,
    surveyDate: '2026-09-17',
    completedAt: '2026-09-18T01:00:00.000Z',
    validPhotos: 42,
    excludedPhotos: 1
  };
}

function ownerRequest(path) {
  return new Request(`https://data.test${path}`, {
    method: 'POST',
    headers: { origin: 'https://webgisyg.id', 'x-job-token': token }
  });
}

test('publishes a completed orthomosaic to the cross-device public catalogue', async () => {
  const env = droneEnv();
  env.store.set(jobKey, JSON.stringify(readyJob()));
  env.store.set(cogKey, 'TIFF-DATA');

  const denied = await worker.fetch(new Request(`https://data.test/api/drone/jobs/${id}/publish`, {
    method: 'POST', headers: { origin: 'https://webgisyg.id', 'x-job-token': 'wrong-token' }
  }), env);
  assert.equal(denied.status, 401);

  const published = await worker.fetch(ownerRequest(`/api/drone/jobs/${id}/publish`), env);
  const publication = await published.json();
  assert.equal(published.status, 200);
  assert.equal(publication.job.public, true);
  assert.ok(publication.job.publishedAt);
  assert.equal(publication.job.accessToken, undefined);

  const catalogue = await worker.fetch(new Request('https://data.test/api/drone/public'), env);
  const catalogueData = await catalogue.json();
  assert.equal(catalogue.status, 200);
  assert.equal(catalogueData.items.length, 1);
  assert.equal(catalogueData.items[0].id, id);
  assert.equal(catalogueData.items[0].surveyDate, '2026-09-17');
  assert.equal(catalogueData.items[0].accessToken, undefined);
  assert.match(catalogue.headers.get('cache-control'), /public/);

  const cog = await worker.fetch(new Request(`https://data.test/api/drone/public/${id}/cog`), env);
  assert.equal(cog.status, 200);
  assert.match(cog.headers.get('cache-control'), /public/);
  assert.equal(await cog.text(), 'TIFF-DATA');
});

test('unpublishing removes catalogue access while preserving owner access', async () => {
  const env = droneEnv();
  const job = { ...readyJob(), public: true, publishedAt: '2026-09-18T02:00:00.000Z' };
  env.store.set(jobKey, JSON.stringify(job));
  env.store.set(cogKey, 'TIFF-DATA');
  env.store.set('drone/public/catalog.json', JSON.stringify({ version: 1, items: [{ id, title: job.title }] }));

  const response = await worker.fetch(ownerRequest(`/api/drone/jobs/${id}/unpublish`), env);
  assert.equal(response.status, 200);

  const catalogue = await worker.fetch(new Request('https://data.test/api/drone/public'), env);
  assert.deepEqual((await catalogue.json()).items, []);
  const publicCog = await worker.fetch(new Request(`https://data.test/api/drone/public/${id}/cog`), env);
  assert.equal(publicCog.status, 404);
  const ownerCog = await worker.fetch(new Request(`https://data.test/api/drone/jobs/${id}/cog?access=${token}`), env);
  assert.equal(ownerCog.status, 200);
});

test('authenticated staff can list and inspect team orthomosaic jobs without owner tokens', async () => {
  const env = droneEnv();
  env.store.set(jobKey, JSON.stringify({ ...readyJob(), status: 'processing', progress: 55, stageLabel: 'Menyusun foto' }));
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async url => {
    assert.match(String(url), /page=staff-reports/);
    assert.match(String(url), /sessionToken=staff-session/);
    return new Response(JSON.stringify({ reports: [], stats: {} }), { headers: { 'content-type': 'application/json' } });
  };
  try {
    const denied = await worker.fetch(new Request('https://data.test/api/staff/drone/jobs'), env);
    assert.equal(denied.status, 401);

    const headers = { origin: 'https://webgisyg.id', authorization: 'Bearer staff-session' };
    const catalogue = await worker.fetch(new Request('https://data.test/api/staff/drone/jobs', { headers }), env);
    const data = await catalogue.json();
    assert.equal(catalogue.status, 200);
    assert.equal(data.jobs.length, 1);
    assert.equal(data.jobs[0].id, id);
    assert.equal(data.jobs[0].accessToken, undefined);

    const detail = await worker.fetch(new Request(`https://data.test/api/drone/jobs/${id}`, { headers }), env);
    assert.equal(detail.status, 200);
    assert.equal((await detail.json()).job.stageLabel, 'Menyusun foto');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
