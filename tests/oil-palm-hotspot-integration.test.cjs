const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const read = f => fs.readFileSync(path.join(__dirname,'..',f),'utf8');
test('legacy company layer is unavailable on main map',()=>{
 assert.doesNotMatch(read('js/map-v4.js'), /perusahaan_sawit_riau:|PERUSAHAAN_SAWIT_RIAU_REFERENSI/);
});
test('old company report exits before map or data load, without reporting zero hotspots',()=>{
 const els={}; const sections=[{},{}];
 const document={getElementById:id=>els[id]||(els[id]={}),querySelectorAll:()=>sections};
 sections.forEach(x=>x.style={});
 vm.runInNewContext(read('js/hotspot-analysis.js'),{location:{search:'?scope=oil-palm&date=2026-09-12'},URLSearchParams,document});
 assert.match(els['analysis-status'].textContent,/belum tersedia/);
 assert.ok(sections.every(x=>x.hidden&&x.style.display==='none'));
});
test('historical matching is suspended and village/PBPH matching remains',()=>{
 const s=read('scripts/enrich_hotspot_villages.mjs');
 assert.doesNotMatch(s,/readFile\(oilPalmPath|HOTSPOT_OIL_PALM_BOUNDARY/);
 assert.ok(s.includes('Promise.resolve({ type: "FeatureCollection", features: [] })'));
 assert.ok(s.includes('feature.properties.pbph052026 ='));
 assert.ok(s.includes('feature.properties.village ='));
 assert.ok(s.includes('delete feature.properties.oilPalmCompanyRef'));
});
test('cached company references are removed before rendering other hotspot reports',()=>{
 for(const f of ['js/fire-weather.js','js/hotspot-analysis.js']){
  assert.ok(read(f).includes('if(f.properties)delete f.properties.oilPalmCompanyRef'));
 }
 const lines=read('fire-weather.html').split('\n').filter(x=>x.includes('data-analysis-scope="oil-palm"')||x.includes('id="oil-palm-source-count"'));
 assert.equal(lines.length,2);
 assert.ok(lines.every(x=>x.startsWith('<div hidden style="display:none">')));
});
