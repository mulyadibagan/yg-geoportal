const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),storage=initial=>{const map=new Map(Object.entries(initial||{}));return {getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};};
test('KUPS reads the active tab session when shared storage is absent, expired or invalid',()=>{
 const s=fs.readFileSync(path.join(root,'js/kups-finance.js'),'utf8'),code=s.slice(s.indexOf('function readFinanceSession(){'),s.indexOf('const query='));
 const value=JSON.stringify({token:'yg-google-new',expiresAt:Date.now()+100000});const localStorage=storage({ygEditorSessionV1:'broken'}),sessionStorage=storage({ygEditorSessionV1:value});
 const ctx=vm.createContext({localStorage,sessionStorage,key:'ygEditorSessionV1',Date});vm.runInContext(code,ctx);assert.equal(vm.runInContext('readFinanceSession().token',ctx),'yg-google-new');
 localStorage.setItem('ygEditorSessionV1',value);vm.runInContext("clearFinanceSession('yg-google-old')",ctx);assert.equal(localStorage.getItem('ygEditorSessionV1'),value);assert.equal(sessionStorage.getItem('ygEditorSessionV1'),value);
 vm.runInContext("clearFinanceSession('yg-google-new')",ctx);assert.equal(localStorage.getItem('ygEditorSessionV1'),null);assert.equal(sessionStorage.getItem('ygEditorSessionV1'),null);
});
test('Google callback stores the same finite session in shared and tab storage, with visible status',async()=>{
 const localStorage=storage(),sessionStorage=storage({ygGoogleRequest:JSON.stringify({state:'state',created:Date.now(),verifier:'test-verifier',target:'kups-finance.html'})});
 let destination,after;const button={addEventListener(){},after(el){after=el;},disabled:false};
 const document={getElementById:()=>button,createElement:()=>({setAttribute(){}})};
 const ctx=vm.createContext({document,localStorage,sessionStorage,location:{hash:'#googleCode=test&state=state',pathname:'/staff-login.html',search:'',href:'https://webgisyg.id/staff-login.html',origin:'https://webgisyg.id',replace:v=>destination=v},history:{replaceState(){}},URL,URLSearchParams,Date,AbortSignal,fetch:async()=>({ok:true,json:async()=>({ok:true,sessionToken:'yg-google-test',username:'admin',scope:'webgis-staff',expiresAt:Date.now()+100000})})});
 vm.runInContext(fs.readFileSync(path.join(root,'js/google-staff-login.js'),'utf8'),ctx);await new Promise(r=>setTimeout(r,0));assert.equal(destination,'/kups-finance.html');assert.equal(after.id,'google-login-status');assert.equal(localStorage.getItem('ygEditorSessionV1'),sessionStorage.getItem('ygEditorSessionV1'));
});
