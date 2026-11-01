// Read-only diagnostics. Never reads a session/token or makes authenticated calls.
const localOrigin = 'http://127.0.0.1:8765';
const liveOrigin = 'https://webgisyg.id';
const base = 'https://webgis-api.yayasangambut.org';
const checks = [
  {name:'catalog-local-preflight',url:base+'/api/staff/riau-geoportal/catalog',method:'OPTIONS',origin:localOrigin,preflightMethod:'GET',preflightHeaders:'authorization'},
  {name:'feg-local-preflight',url:base+'/api/staff/feg-sk130-riau',method:'OPTIONS',origin:localOrigin,preflightMethod:'GET',preflightHeaders:'authorization'},
  {name:'login-exchange-local-preflight',url:'https://staff.yayasangambut.org/api/webgis/exchange',method:'OPTIONS',origin:localOrigin,preflightMethod:'POST',preflightHeaders:'content-type'},
  {name:'catalog-anonymous',url:base+'/api/staff/riau-geoportal/catalog',method:'GET',origin:liveOrigin},
  {name:'feg-anonymous',url:base+'/api/staff/feg-sk130-riau',method:'GET',origin:liveOrigin},
  {name:'session-introspection-anonymous',url:'https://staff.yayasangambut.org/api/webgis/introspect',method:'GET',origin:liveOrigin}
];
const results = await Promise.all(checks.map(async check=>{
  const headers={Origin:check.origin};
  if(check.preflightMethod){headers['Access-Control-Request-Method']=check.preflightMethod;headers['Access-Control-Request-Headers']=check.preflightHeaders;}
  try{
    const response=await fetch(check.url,{method:check.method,headers,redirect:'error',signal:AbortSignal.timeout(15000)});
    const allowedOrigin=response.headers.get('access-control-allow-origin');
    await response.body?.cancel();
    return {name:check.name,method:check.method,url:check.url,requestOrigin:check.origin,status:response.status,
      allowedOrigin,corsOriginMatches:allowedOrigin===check.origin||allowedOrigin==='*',
      allowedMethods:response.headers.get('access-control-allow-methods'),allowedHeaders:response.headers.get('access-control-allow-headers'),
      anonymousDenied:check.method==='GET'?[401,403].includes(response.status):null};
  }catch(error){return {name:check.name,url:check.url,error:error.name+': '+error.message};}
}));
const report={schemaVersion:1,checkedAt:new Date().toISOString(),mode:'anonymous-read-only-no-credentials',results};
console.log(JSON.stringify(report,null,2));
// A blocked local preflight is a finding, not a failed script execution.
if(results.some(result=>result.error))process.exitCode=1;
