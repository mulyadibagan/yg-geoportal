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
test('offline comparison detects real source conflicts without changing source attributes', async () => {
  const fs=require('node:fs');const path=require('node:path');
  const {createRequire}=require('node:module');
  const T=createRequire(path.resolve('private-data/restoration-runtime/package.json'))('@turf/turf');
  const {compareGroups}=await import('../scripts/compare-restoration-big-reference.mjs');
  const original=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/Gambut_BBSDLP_2019.geojson')));
  const before=JSON.stringify(original);
  const missing=compareGroups(original,[],T);
  assert.equal(missing.length,8);
  assert.ok(missing.every(row=>row.observations.length===0&&row.appliedCorrection===null&&!row.scoringValidated));
  // Positive control uses an unchanged real source polygon, not fabricated spatial data.
  const sameGeometry=compareGroups(original,[original.features[150]],T);
  assert.equal(sameGeometry.find(row=>row.sourceRows.includes(151)).observations.length,1);
  assert.equal(JSON.stringify(original),before);
});
test('offline reference loader refuses tampered metadata and incomplete indexed packages', async () => {
 const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
 const {createHash}=require('node:crypto');const hash=x=>createHash('sha256').update(x).digest('hex');
 const {BASE,PUBLIC_WHERE}=await import('../scripts/acquire-restoration-big-reference.mjs');
 const {loadReference}=await import('../scripts/compare-restoration-big-reference.mjs');
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'restoration-reference-test-'));
 const metadata='{}',index=JSON.stringify({objectIds:[8]});
 const manifest={source:BASE,selection:PUBLIC_WHERE,parts:[],metadataSha256:'incorrect',objectIdsSha256:hash(index),featureCount:1,totalBytes:0};
 try{
  await fs.writeFile(path.join(directory,'layer-metadata.json'),metadata);
  await fs.writeFile(path.join(directory,'public-object-ids.json'),index);
  await fs.writeFile(path.join(directory,'manifest.json'),JSON.stringify(manifest));
  await assert.rejects(loadReference(directory),/checksum mismatch/);
  manifest.metadataSha256=hash(metadata);
  await fs.writeFile(path.join(directory,'manifest.json'),JSON.stringify(manifest));
  await assert.rejects(loadReference(directory),/Incomplete reference package/);
 }finally{
  for(const file of ['manifest.json','public-object-ids.json','layer-metadata.json'])await fs.unlink(path.join(directory,file)).catch(()=>{});
  await fs.rmdir(directory);
 }
});
