const test = require('node:test');
const assert = require('node:assert/strict');
test('BIG acquisition selects public KHG codes without transmitting local geometry', async () => {
  const {queryUrl, PUBLIC_WHERE, BASE} = await import('../scripts/acquire-restoration-big-reference.mjs');
  const url = new URL(queryUrl());
  assert.equal(url.origin + url.pathname, BASE + '/query');
  assert.equal(url.searchParams.get('where'), PUBLIC_WHERE);
  assert.deepEqual([...url.searchParams.keys()].sort(), ['f','returnIdsOnly','where']);
  const part = new URL(queryUrl([8,10,11]));
  assert.equal(part.searchParams.get('objectIds'), '8,10,11');
  assert.equal(part.searchParams.get('outSR'), '4326');
  assert.deepEqual([...part.searchParams.keys()].sort(), ['f','objectIds','outFields','outSR','returnGeometry']);
});
test('BIG acquisition rejects geometry, arbitrary queries and invalid object IDs', async () => {
  const {queryUrl} = await import('../scripts/acquire-restoration-big-reference.mjs');
  for (const value of ['1=1', {geometry:[100,0]}, [], [1,1], [-1], [1.5], ['1'], Array.from({length:101},(_,i)=>i)]) {
    assert.throws(() => queryUrl(value), /Invalid public object IDs/);
  }
});
