const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),annual=require('../js/fire-annual-summary.js');
test('selecting 2026 renders annual report and keeps the year URL',async()=>{
 const elements={};const node=id=>elements[id]||(elements[id]={innerHTML:'',textContent:'',hidden:false,style:{},removeAttribute(){},closest(){return node('article')}});
 const months=['2026-07','2026-08','2026-09','2026-10'];
 const reports=months.map(month=>({month,status:'final',data:'data/fire-monthly/'+month+'.json'}));
 const fetched=[],urls=[];
 const layer=()=>({addTo(){return this},bindTooltip(){return this},bindPopup(){return this},getBounds(){return {isValid:()=>false}}});
 const fetch=async url=>{fetched.push(url);let data=url.startsWith('data/fire-monthly/index')?{reports}:url.startsWith('data/burned-area-monthly')?{reports:[]}:url.includes('batas_administrasi')?{features:[]}:(()=>{const month=months.find(m=>url.includes(m));if(!month)throw Error(url);return {month,status:'final',period:{start:month+'-01',end:month+'-30'},hotspots:[{date:month+'-02',time:'1230',longitude:101,latitude:1,satellite:'N20',village:'Desa A',district:'Kecamatan A',regency:'Bengkalis'}]}})();return {ok:true,json:async()=>data}};
 const window={fetch,YG_STAFF_DATA:{fetch,session:()=>null},YG_FIRE_ANNUAL:annual,loadMonthlyBurned:async()=>null};
 const L={map:()=>({fitBounds(){return this}}),tileLayer:layer,geoJSON:layer,featureGroup:layer,circleMarker:layer,control:{layers:layer}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../js/fire-monthly-report.js'),'utf8'),{window,L,URLSearchParams,location:{search:'?year=2026'},history:{replaceState:(a,b,url)=>urls.push(url)},document:{getElementById:node},setTimeout:()=>0,console});
 for(let i=0;i<10;i++)await new Promise(resolve=>setImmediate(resolve));
 assert.equal(node('fm-title').textContent,'Laporan tahunan 2026');
 assert.equal(node('fm-hotspots').textContent,'4');
 assert.equal(node('fm-daily-title').textContent,'Deteksi per bulan');
 assert.equal(urls.at(-1),'?year=2026');
 for(const month of months)assert.ok(fetched.includes('data/fire-monthly/'+month+'.json'));
});
