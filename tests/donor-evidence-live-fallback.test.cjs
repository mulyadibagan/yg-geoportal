const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

test('local dashboard falls back to the public donor-programmes JSONP feed', () => {
  const source = fs.readFileSync(path.join(ROOT, 'js/donor-evidence-summary.js'), 'utf8');
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

  assert.match(source, /DONOR_JSONP_API = API \+ '\?page=donor-programmes'/);
  assert.match(source, /yg-webgis-public-data\.yg-webgis-public-data-worker\.workers\.dev\/api\/donor\/programmes/);
  assert.doesNotMatch(source, /yg-webgis-public-data-staging/);
  assert.match(source, /function requestDonorProgrammes\(staffSession, donorHeaders\)/);
  assert.match(source, /if \(staffSession\) throw error/);
  assert.match(source, /return jsonp\(DONOR_JSONP_API\)/);
  assert.match(source, /donor-evidence-counts-snapshot\.json\?v=20260902-1/);
  assert.match(source, /assignmentsUnavailable && Number\.isFinite\(fallbackCount\)/);
  assert.match(html, /donor-evidence-summary\.js\?v=20260902-ma-earth-progress2/);
});
