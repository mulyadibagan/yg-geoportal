const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync(require.resolve('../js/dayun-work-summary.js'),'utf8');
function setup(){
 const nodes=[],node=tag=>{const n={tag,children:[],textContent:'',className:'',dataset:{},classList:{add(){}},attrs:{},append(...xs){this.children.push(...xs)},replaceChildren(...xs){this.children=xs},setAttribute(k,v){this.attrs[k]=v},get options(){return this.children},get value(){return this._value??(this.tag==='select'?this.children[0]?.value||'':'')},set value(v){this._value=v}};nodes.push(n);return n;};
 const host=node('section');host.dataset.dayunWorkSummary='all';const rows=Array.from({length:23},(_,i)=>{const block=i<13?'A':'B',g=i<13?i+1:i-12;return{block,zone:'GT-'+block+'-'+String(g).padStart(2,'0'),objectId:'DAYUN-GT-'+block+'-'+String(g).padStart(2,'0'),plants:100+i,newPlants:10,fruits:i,allocated:1,plantingMonth:'des 2024',newPlantingMonth:'agustus 2026'};});const data={schema:'dayun-live-work-counts-v1',live:true,rows,checkedAt:'2026-10-24T05:55:00Z',revisions:{A:{plants:1517,fruits:412}}};
 let exportData=null,interval;const context={window:{addEventListener(){},YG_DAYUN_WORK_EXCEL:{download:async d=>exportData=d}},document:{querySelector:()=>host,createElement:node,addEventListener(){},visibilityState:'visible'},location:{search:''},URLSearchParams,AbortSignal,Date,fetch:async()=>({ok:true,json:async()=>data}),setInterval:fn=>interval=fn,setTimeout:()=>0,clearTimeout(){}};vm.createContext(context);vm.runInContext(source,context);return{nodes,host,data,exported:()=>exportData,poll:()=>interval(),find:text=>nodes.find(n=>n.textContent===text),field:label=>nodes.find(n=>n.attrs['aria-label']===label)};
}
const flush=()=>new Promise(r=>setImmediate(r));
test('recap paginates and filters without changing source counts or exporting only the filtered subset',async()=>{
 const s=setup();await flush();const tbody=s.nodes.find(n=>n.tag==='tbody');assert.equal(tbody.children.length,10);assert.ok(s.find('1–10 dari 23 gawangan'));
 s.find('Berikutnya').onclick();assert.equal(tbody.children[0].children[0].children[0].textContent,'A11');
 const block=s.field('Filter blok rekap tanaman');block.value='B';block.onchange();assert.equal(tbody.children.length,10);assert.equal(tbody.children[0].children[0].children[0].textContent,'B1');
 const search=s.field('Cari gawangan pada rekap');search.value='B5';search.oninput();assert.equal(tbody.children.length,1);assert.equal(tbody.children[0].children[0].children[0].textContent,'B5');assert.ok(s.find('114'));
 await s.find('Unduh Excel').onclick();assert.equal(s.exported().rows.length,23);assert.equal(s.data.rows.length,23);assert.equal(search.value,'B5');assert.equal(block.value,'B');
 search.value='ZZ';search.oninput();assert.equal(tbody.children[0].children[0].textContent,'Tidak ada gawangan yang sesuai.');
});
test('visible copy omits implementation details and month/gawangan labels are readable',async()=>{
 const s=setup();await flush();const text=s.nodes.map(n=>n.textContent).join(' ');assert.doesNotMatch(text,/Tersinkron|titik r\d|buah r\d|Dari luar GT|Buah tim|snapshot|geometri/i);assert.match(text,/Desember 2024/);assert.match(text,/Agustus 2026/);assert.match(text,/Diperbarui/);assert.ok(s.find('Data nanas dan buah'));
});
test('map context does not render historical pineapple populations as current totals',()=>{
 const text=fs.readFileSync(require.resolve('../js/dayun-public.js'),'utf8'),start=text.indexOf('  function renderAgroSummary('),end=text.indexOf('\n  function ',start+5),nodes={'dayun-agro-summary':{},'dayun-block-overview':{}};
 const render=vm.runInNewContext('('+text.slice(start,end)+')',{document:{getElementById:id=>nodes[id]},fmtArea:n=>n+' ha',fmtInteger:String,cropGroupHtml:()=>'',window:{DayunAgroSummary:{MPTS:[],HORTICULTURE:['NANAS']}}});
 render({all:{blockAreaHa:28,gawanganAreaHa:20,mappedGawangan:60,mptsPlants:1954,pineappleRecorded:987654321,pineapplePlants:876543210},codes:['A'],blocks:{A:{name:'Blok A',mappedGawangan:15,blockAreaHa:4,gawanganAreaHa:3,mptsPlants:100,pineappleRecorded:987654321}}});
 assert.doesNotMatch(nodes['dayun-agro-summary'].innerHTML+nodes['dayun-block-overview'].innerHTML,/987654321|876543210|Nanas pada data sumber/);
 const html=fs.readFileSync(require.resolve('../dayun-map.html'),'utf8');assert.equal((html.match(/data-dayun-work-summary=/g)||[]).length,1);assert.doesNotMatch(html,/id="dayun-pineapple-entry"/);
});
