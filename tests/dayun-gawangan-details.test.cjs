const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const details = JSON.parse(fs.readFileSync(path.join(root, 'data/dayun-gawangan-details.json'), 'utf8'));
const map = JSON.parse(fs.readFileSync(path.join(root, 'data/dayun-map.geojson'), 'utf8'));

test('public Dayun details match the official gawangan polygons', () => {
  const detailIds = new Set(details.objects.map(item => item.objectId));
  const mapIds = new Set(map.features
    .filter(feature => feature.properties && feature.properties.category === 'Gawangan Tanam')
    .map(feature => feature.properties.objectId));
  assert.equal(detailIds.size, 59);
  assert.equal(mapIds.size, 60);
  assert.deepEqual([...mapIds].filter(id => !detailIds.has(id)), ['DAYUN-GT-B-15']);
  assert.deepEqual([...detailIds].filter(id => !mapIds.has(id)), []);
  assert.deepEqual(details.summary.missingObjectIds, ['DAYUN-GT-B-15']);
});

test('every published crop belongs to one gawangan and has a crop name', () => {
  assert.equal(details.source, undefined);
  assert.equal(details.objects.reduce((total, item) => total + item.crops.length, 0), 139);
  for (const item of details.objects) {
    assert.match(item.objectId, /^DAYUN-GT-[A-F]-\d{2}$/);
    assert.ok(item.crops.length > 0, item.objectId);
    for (const crop of item.crops) assert.ok(crop.crop, `${item.objectId} has an unnamed crop`);
  }
});

test('each planting polygon popup shows block and gawangan areas with a profile link', () => {
  const html = fs.readFileSync(path.join(root, 'dayun-map.html'), 'utf8');
  const script = fs.readFileSync(path.join(root, 'js/dayun-public.js'), 'utf8');
  const profile = fs.readFileSync(path.join(root, 'dayun-gawangan.html'), 'utf8');
  const profileScript = fs.readFileSync(path.join(root, 'js/dayun-gawangan.js'), 'utf8');
  assert.doesNotMatch(html, /id="dayun-gawangan-detail"/);
  assert.match(script, /data\/dayun-gawangan-details\.json/);
  assert.match(script, /Luas blok/);
  assert.match(script, /Gawangan tanam/);
  assert.match(script, /sourceGawanganAreaHa/);
  assert.match(script, /target="_blank" rel="noopener"/);
  assert.doesNotMatch(script, /window\.open\(profileUrl/);
  assert.match(script, /dy-gawangan-picker/);
  assert.match(profile, /id="dg-map"/);
  assert.match(profileScript, /data\/dayun-gawangan-details\.json/);
  assert.doesNotMatch(profile + profileScript, /DATA GAWANG|Sumber:/i);
});
