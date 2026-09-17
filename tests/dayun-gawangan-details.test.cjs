const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const details = JSON.parse(fs.readFileSync(path.join(root, 'data/dayun-gawangan-details.json'), 'utf8'));
const map = JSON.parse(fs.readFileSync(path.join(root, 'data/dayun-map.geojson'), 'utf8'));
const blocks = JSON.parse(fs.readFileSync(path.join(root, 'data/dayun-blocks.geojson'), 'utf8'));

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
    for (const crop of item.crops) { assert.ok(crop.crop, `${item.objectId} has an unnamed crop`); if (crop.crop === 'NANAS') assert.equal(crop.variety, 'Queen', `${item.objectId} pineapple variety`); }
  }
});

test('each block has a calculated planting-row area from unique gawangan objects', () => {
  const totals = new Map();
  const seen = new Set();
  for (const feature of map.features) {
    const properties = feature.properties || {};
    if (properties.category !== 'Gawangan Tanam' || seen.has(properties.objectId)) continue;
    seen.add(properties.objectId);
    totals.set(properties.block, (totals.get(properties.block) || 0) + Number(properties.sourceGawanganAreaHa));
  }
  assert.equal(seen.size, 60);
  assert.deepEqual(Object.fromEntries([...totals].map(([block, area]) => [block, Number(area.toFixed(4))])), {
    'Blok B': 4.0429,
    'Blok A': 1.7931,
    'Blok C': 3.1032,
    'Blok D': 3.908,
    'Blok E': 3.5753,
    'Blok F': 4.0854
  });
  for (const feature of blocks.features) {
    assert.ok(totals.get(feature.properties.name) <= feature.properties.areaHa);
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
  assert.match(script, /Luas gawangan tanam/);
  assert.match(script, /gawanganAreaByBlock/);
  assert.doesNotMatch(script, /Areal Agroforestri KUPS Rimba Sejahtera/);
  assert.match(script, /Gawangan tanam/);
  assert.match(script, /sourceGawanganAreaHa/);
  assert.match(script, /target="_blank" rel="noopener"/);
  assert.doesNotMatch(script, /window\.open\(profileUrl/);
  assert.match(script, /dy-gawangan-picker/);
  assert.match(profile, /id="dg-map"/);
  assert.match(profileScript, /data\/dayun-gawangan-details\.json/);
  assert.match(profileScript, /fetchEthrelWeather/);
  assert.doesNotMatch(profileScript, /November|Desember/);
  assert.match(profileScript, /Ethrel terakhir tercatat/);
  assert.match(profileScript, /Riwayat tanam menunjukkan/);
  assert.match(profileScript, /Prakiraan cuaca aplikasi/);
  assert.match(profileScript, /Selisih administrasi, bukan otomatis kandidat aplikasi/);
  assert.doesNotMatch(profile + profileScript, /DATA GAWANG|Sumber:/i);
});

test('gawangan core renders before optional reports and weather finish', () => {
  const script = fs.readFileSync(path.join(root, 'js/dayun-gawangan.js'), 'utf8');
  const source = fs.readFileSync(path.join(root, 'js/dayun-data-source.js'), 'utf8');
  const html = fs.readFileSync(path.join(root, 'dayun-gawangan.html'), 'utf8');
  const coreRender = script.indexOf('render(record,features,allIds,null,null)');
  const reportLoad = script.indexOf('jsonp(PUBLIC_REPORTS_API)', coreRender);
  const weatherLoad = script.indexOf('fetchEthrelWeather()', coreRender);
  assert.ok(coreRender > 0);
  assert.ok(reportLoad > coreRender);
  assert.ok(weatherLoad > coreRender);
  assert.match(script, /DayunDataSource\.fetchJSON\('data\/dayun-gawangan-details\.json/);
  assert.match(source, /workers\.dev/);
  assert.match(source, /return local\(localUrl\)/);
  assert.match(source, /AbortController/);
  assert.ok(html.indexOf('dayun-data-source.js') < html.indexOf('dayun-gawangan.js'));
});

test('all public Dayun data consumers load the Cloudflare source with a local fallback', () => {
  const pages = ['dayun-map.html','dayun-gawangan.html','dayun-blok.html','dayun-analisis-nanas.html','dayun-monitoring.html','dayun-sop-komoditas.html','dayun-sop-rambutan.html'];
  for (const page of pages) assert.match(fs.readFileSync(path.join(root, page), 'utf8'), /js\/dayun-data-source\.js/, page);
  const source = fs.readFileSync(path.join(root, 'js/dayun-data-source.js'), 'utf8');
  for (const file of ['dayun-program.json','dayun-map.geojson','dayun-context.geojson','dayun-gawangan-details.json','dayun-blocks.geojson']) {
    assert.match(source, new RegExp(file.replaceAll('.', '\\.')));
  }
});
