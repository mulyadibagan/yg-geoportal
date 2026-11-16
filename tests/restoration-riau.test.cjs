const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../js/restoration-riau.js'), 'utf8');

async function attempt({token = 'test-session-only', stored = token, host = 'webgisyg.id', protocol = 'https:', framed = false, status = 403, payload = {}} = {}) {
  const calls = [], node = {hidden: true, textContent: ''};
  const window = {YG_AUTH: {readStoredSession: () => stored ? {token: stored} : null}};
  window.self = window; window.top = framed ? {} : window;
  const context = {window, document: {getElementById: () => node}, location: {hostname: host, protocol}, AbortSignal,
    fetch: async (url, options) => {calls.push({url, options}); return {ok: status === 200, status, json: async () => payload};}};
  vm.runInNewContext(source, context);
  await window.YG_RESTORATION_RIAU.mount({session: token ? {token} : null});
  return {calls, node};
}

test('no session never loads the internal restoration object', async () => {
  const result = await attempt({token: null});
  assert.equal(result.calls.length, 0); assert.equal(result.node.hidden, true);
});
test('framing, HTTP and unapproved origins never transmit the staff token', async () => {
  for (const options of [{framed: true}, {protocol: 'http:'}, {host: 'localhost'}]) assert.equal((await attempt(options)).calls.length, 0);
});
test('the private endpoint receives the bearer token and rejects failed authorization', async () => {
  for (const status of [401, 403, 503]) {
    const result = await attempt({status});
    assert.equal(result.calls.length, 1);
    assert.equal(result.calls[0].url, 'https://webgis-api.yayasangambut.org/api/staff/restoration-riau-dashboard');
    assert.equal(result.calls[0].options.headers.authorization, 'Bearer test-session-only');
    assert.equal(result.calls[0].options.cache, 'no-store');
    assert.equal(result.calls[0].options.credentials, 'omit');
    assert.match(result.node.textContent, new RegExp('HTTP ' + status));
  }
});
test('session changes and invalid payloads never render a dataset', async () => {
  assert.match((await attempt({status: 200, stored: 'changed-test-session'})).node.textContent, /Sesi staf berubah/);
  assert.match((await attempt({status: 200})).node.textContent, /Paket prioritas tidak valid/);
});
test('the public module contains interaction code without the source evidence or map', () => {
  assert.doesNotMatch(source, /bbsdlp-168b6afb|"sel_id":|M585\.26,768\.66/);
  assert.match(source, /root\.getElementById/);
  assert.match(source, /attachShadow/);
  assert.match(source, /text\/csv;charset=utf-8/);
  assert.match(source, /shown\.map/);
  assert.doesNotMatch(source, /eval\(|new Function\(/);
});
