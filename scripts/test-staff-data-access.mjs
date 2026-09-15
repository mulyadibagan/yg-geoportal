import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync('js/staff-data-access.js', 'utf8');
function setup(loggedIn) {
  const requests = [];
  const window = { YG_AUTH: { readStoredSession: () => loggedIn ? { token: 'test' } : null }, fetch: async (url, options) => {
    requests.push({ url, options }); return new Response(JSON.stringify({type:'FeatureCollection',features:[]}));
  }};
  vm.runInNewContext(source, {window, location: {href:'https://webgisyg.id/webgis.html',origin:'https://webgisyg.id'}, document:{getElementById:()=>null}, URL, Response, Map});
  return {api:window.YG_STAFF_DATA,requests};
}
const guest=setup(false);
await assert.rejects(guest.api.privateFetch('data/PBPH_RIAU_052026.geojson'));
assert.equal(guest.requests.length,0);
const staff=setup(true);
await staff.api.fetch('data/PBPH_RIAU_052026.geojson?v=1');
assert.match(staff.requests[0].url,/\/api\/staff\/pbph-riau$/);
assert.equal(staff.requests[0].options.headers.authorization,'Bearer test');
assert.equal(staff.requests[0].options.cache,'no-store');
await staff.api.fetch('data/fire-monthly/2026-08.json');
assert.match(staff.requests[1].url,/fire-monthly-report\?month=2026-08$/);
await staff.api.fetch('https://example.org/data/pbph-documents.json');
assert.equal(staff.requests[2].options,undefined);
console.log('Staff routing: passed; guests blocked; no tokens sent to external origins.');
