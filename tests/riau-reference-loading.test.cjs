const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
function setup(fetch) {
 const source=fs.readFileSync('js/riau-reference-workspace.js','utf8').replace(/\}\)\(\);\s*$/, 'window.testApi={loadCatalog,renderCatalogItems,catalogState,toggleCatalogLayer};})();');
 const window={YG_STAFF_DATA:{session:()=>({token:'test-only'})},YG_MAP:{map:{}},L:{}};
 const context={window,document:{readyState:'loading',addEventListener(){}},fetch,AbortController,setTimeout:fn=>setTimeout(fn,10),clearTimeout,TextEncoder,TextDecoder,URLSearchParams};
 vm.runInNewContext(source,context);
 const elements={};
 const panel={querySelector(key){return elements[key] ||= {textContent:'',innerHTML:'',disabled:false,classList:{remove(){},add(){}},querySelectorAll(){return []}}}};
 return {api:window.testApi,panel,elements};
}
test('stalled catalog body stops loading and enables retry', async()=>{
 const {api,panel,elements}=setup(async()=>({ok:true,status:200,json:()=>new Promise(()=>{})}));
 await api.loadCatalog(panel);
 assert.equal(api.catalogState.loading,false);
 assert.equal(elements['[data-riau-catalog-refresh]'].disabled,false);
 assert.equal(elements['[data-riau-ready-count]'].textContent,'Belum tersedia');
 assert.match(elements['[data-riau-catalog-status]'].textContent,/20 detik/);
 assert.doesNotMatch(elements['[data-riau-catalog-list]'].innerHTML,/Memuat/);
});
test('stalled layer body releases its checkbox and adds no geometry', async()=>{
 const {api,panel,elements}=setup(async()=>({ok:true,status:200,headers:{get:()=>null},text:()=>new Promise(()=>{})}));
 await api.toggleCatalogLayer({uuid:'12345678-1234-4234-8234-123456789001',title:'Layer uji'},true,panel);
 assert.equal(api.catalogState.pending.size,0);
 assert.equal(api.catalogState.active.size,0);
 assert.match(elements['[data-riau-catalog-status]'].textContent,/20 detik/);
});
test('catalog renders one expandable group per OPD and excludes unavailable geometry',async()=>{
 const row=(uuid,publisher,ready=true)=>({uuid,title:'Layer <uji>',opd:{nama_opd:publisher},artifacts:{display:{available:ready,status:'ready'}}});
 const data={datasets:[row('12345678-1234-4234-8234-123456789001','OPD A'),row('12345678-1234-4234-8234-123456789002','OPD A'),row('12345678-1234-4234-8234-123456789003','OPD B'),row('12345678-1234-4234-8234-123456789004','OPD C',false)]};
 const {api,panel,elements}=setup(async()=>({ok:true,status:200,json:async()=>data}));
 await api.loadCatalog(panel);
 const html=elements['[data-riau-catalog-list]'].innerHTML;
 assert.equal((html.match(/class="riau-reference-opd"/g)||[]).length,2);
 assert.match(html,/2 layer/);assert.match(html,/Layer &lt;uji&gt;/);
 assert.doesNotMatch(html,/OPD C/);assert.equal(api.catalogState.active.size,0);
});
