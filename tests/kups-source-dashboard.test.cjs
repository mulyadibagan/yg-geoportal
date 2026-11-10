const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
function setup(){
 const nodes=new Map();
 const node=id=>{if(!nodes.has(id))nodes.set(id,{hidden:false,value:id.includes('month')?'all':'',innerHTML:'',textContent:'',addEventListener(type,fn){this[type]=fn;},replaceChildren(){this.innerHTML='';this.textContent='';},parentElement:{after(){}}});return nodes.get(id);};
 const window={};vm.runInNewContext(fs.readFileSync(require.resolve('../js/kups-source-review.js'),'utf8'),{window,URLSearchParams,document:{getElementById:node,createElement:()=>node('pending')}});
 return {node,review:window.YG_KUPS_SOURCE_REVIEW};
}
const months=[{month:'2026-01',opening:100,income:10,expense:20,closing:90,source:'https://drive.google.com/a'},{month:'2026-02',opening:85,income:30,expense:5,closing:110,source:'https://drive.google.com/b'}];
const snapshot={title:'Test',reviewed_at:'2026-11-10',months,rows:[['1','2026-01','','A','income',10],['2','2026-02','','B','income',30]],notes:[['1','','Opening','ref','check']],pending:[]};
test('historical dashboard sums source once, preserves opening gaps and filters selected month',async()=>{
 const {node,review}=setup();const calls=[];
 await review.load({group:'a',admin:true,fmt:String,esc:String,api:async path=>{calls.push(path);return {review:snapshot,version:1};}});
 assert.deepEqual(calls,['/source-review?group=a']);
 assert.match(node('source-overview-summary').innerHTML,/Pemasukan sumber<\/span><strong>40</);
 assert.match(node('source-overview-summary').innerHTML,/Saldo akhir sumber<\/span><strong>110</);
 assert.equal((node('source-overview-chart').innerHTML.match(/class="chart-row"/g)||[]).length,2);
 assert.match(node('source-overview-table').innerHTML,/-5 · perlu dicocokkan/);
 node('source-overview-month').value='2026-02';node('source-overview-month').change();
 assert.match(node('source-overview-summary').innerHTML,/Pemasukan sumber<\/span><strong>30</);
 assert.doesNotMatch(node('source-overview-chart').innerHTML,/2026-01/);
 assert.match(node('source-overview-table').innerHTML,/-5 · perlu dicocokkan/);
 review.reset();assert.equal(node('source-review-notice').hidden,true);assert.equal(node('source-overview-summary').innerHTML,'');assert.equal(node('source-overview-chart').innerHTML,'');
});
test('changing groups clears private source dashboard when next group request fails',async()=>{
 const {node,review}=setup();await review.load({group:'a',fmt:String,esc:String,api:async()=>({review:snapshot,version:1})});
 await review.load({group:'b',fmt:String,esc:String,api:async()=>{throw Error('denied');}});
 assert.equal(node('source-review-notice').hidden,true);assert.equal(node('source-overview-summary').innerHTML,'');assert.equal(node('source-overview-table').innerHTML,'');
});
