const test=require('node:test');const assert=require('node:assert/strict');
test('research acquisition accepts only pinned public versions, licences and file checksums',async()=>{
 const {SOURCES,validateSource}=await import('../scripts/acquire-restoration-research-peat.mjs');
 for(const [key,source] of Object.entries(SOURCES)){
  const snapshot={id:source.id,version:1,doi:'10.17632/'+source.id+'.1',is_confidential:false,licence:{short_name:'CC BY 4.0'}};
  const files=[{filename:source.name,content_details:{sha256_hash:source.hash,size:source.bytes,content_type:source.type,download_url:'https://data.mendeley.com/public-files/datasets/'+source.id+'/files/'+source.fileId+'/file_downloaded'}}];
  assert.equal(validateSource(snapshot,files,key),files[0]);
  assert.throws(()=>validateSource({...snapshot,is_confidential:true},files,key),/identity or licence/);
  assert.throws(()=>validateSource({...snapshot,licence:{short_name:'unknown'}},files,key),/identity or licence/);
  const changed=JSON.parse(JSON.stringify(files));changed[0].content_details.sha256_hash='0'.repeat(64);
  assert.throws(()=>validateSource(snapshot,changed,key),/file version/);
  changed[0].content_details={...files[0].content_details,download_url:'https://unverified.example/file'};
  assert.throws(()=>validateSource(snapshot,changed,key),/download destination/);
 }
 assert.throws(()=>validateSource({},[],'unlisted'),/Unknown research source/);
});
