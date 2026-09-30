const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

test('failed Drive reason survives the progress renderer and clears after retry', () => {
  const elements = new Map();
  function element(id = '') {
    const el = {id, hidden:false, innerHTML:'', textContent:'', children:[],
      appendChild(child) { this.children.push(child); if(child.id) elements.set(child.id, child); },
      insertAdjacentElement(position, child) { elements.set(child.id, child); },
      addEventListener() {}};
    if(id) elements.set(id, el);
    return el;
  }
  for(const id of ['jobState','jobActions','resultInfo']) element(id);
  const listeners = new Map();
  const context = {document:{body:element(),head:element(),
    createElement:()=>element(),createTreeWalker:()=>({nextNode:()=>false}),
    getElementById:id=>elements.get(id)||null,
    querySelector:selector=>elements.get(selector.slice(1))||null},
    NodeFilter:{SHOW_TEXT:4},MutationObserver:class {observe() {}},
    localStorage:{getItem:()=>null},setTimeout:()=>{},console};
  context.window={alert(){},addEventListener(name, callback){
    if(!listeners.has(name)) listeners.set(name,[]);
    listeners.get(name).push(callback);
  }};
  vm.createContext(context);
  for(const file of ['drone-survey-public-copy.js','drone-survey-retry.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname,'../js',file),'utf8'),context);
  }
  const dispatch=job=>listeners.get('yg:drone-job').forEach(callback=>callback({detail:job}));
  dispatch({id:'drn-test',status:'failed',progress:15,error:'drive_access_denied'});
  assert.match(elements.get('ygProcessProgress').innerHTML,/Google Drive menolak akses/);
  assert.match(elements.get('resultInfo').textContent,/siapa saja yang memiliki link/);
  assert.equal(elements.get('ygRetryActions').hidden,false);
  dispatch({id:'drn-test',status:'pending',progress:0,queuePosition:1,queueSize:1});
  assert.doesNotMatch(elements.get('ygProcessProgress').innerHTML,/menolak akses/);
  assert.match(elements.get('ygProcessProgress').innerHTML,/antrean 1/);
  assert.equal(elements.get('ygRetryActions').hidden,true);
});
