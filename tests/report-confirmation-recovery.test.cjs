const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname,'../js/report-v6.js'),'utf8');
function functionSource(name){
  const start=source.search(new RegExp('  (?:async )?function '+name+'\\('));
  const next=source.slice(start+3).search(/\n  (?:async )?function /);
  return source.slice(start,next<0?undefined:start+3+next);
}
test('confirmation reads JSON directly and falls back to JSONP on network failures',async()=>{
  let fallback=0;
  const result={pending:false,type:'yg-report-submission-result',ok:true,reportId:'saved'};
  const ctx=vm.createContext({PREPOST_API:'https://example.org/exec',AbortController,setTimeout,clearTimeout,encodeURIComponent,
    fetch:async()=>({ok:true,json:async()=>result}),jsonpRequest:async()=>{fallback++;return result;}});
  vm.runInContext(functionSource('readSubmissionStatus'),ctx);
  assert.equal((await ctx.readSubmissionStatus('yg-test')).reportId,'saved');assert.equal(fallback,0);
  ctx.fetch=async()=>{throw Error('network');};
  assert.equal((await ctx.readSubmissionStatus('yg-test')).reportId,'saved');assert.equal(fallback,1);
});
test('reload resumes the original submission without uploading again',()=>{
  const calls=[];
  const ctx=vm.createContext({submissionStarted:false,activeSubmissionId:'',submissionPollSequence:3,pendingSubmissionKey:'key',
    sessionStorage:{getItem:()=>JSON.stringify({id:'yg-original',startedAt:Date.now()})},
    statusText:{},submitButton:{},scheduleSubmissionStatusPoll:(...args)=>calls.push(args),Date,JSON,Number});
  const body=functionSource('resumeSubmissionConfirmation').split("  submitButton.addEventListener")[0];
  vm.runInContext(body,ctx);ctx.resumeSubmissionConfirmation();
  assert.equal(ctx.activeSubmissionId,'yg-original');assert.equal(ctx.submissionStarted,true);
  assert.deepEqual(calls,[['yg-original',3,1]]);
  assert.equal(ctx.submitButton.disabled,false);
});
test('a completed poll confirms the saved report and stops polling',async()=>{
  let confirmed=0;
  const result={pending:false,type:'yg-report-submission-result',ok:true,reportId:'saved'};
  const ctx=vm.createContext({submissionStarted:true,submissionPollSequence:1,submissionPollTimer:null,
    clearTimeout(){},setTimeout:fn=>{fn();return 1;},readSubmissionStatus:async()=>result,
    handleSubmissionResponse:r=>{assert.equal(r.reportId,'saved');confirmed++;}});
  vm.runInContext(functionSource('scheduleSubmissionStatusPoll'),ctx);
  ctx.scheduleSubmissionStatusPoll('yg-original',1,1);
  await new Promise(resolve=>setImmediate(resolve));assert.equal(confirmed,1);
});
