// Private R2 downloads: authorize in the API, transfer bytes directly from S3.
const encoder = new TextEncoder();
const hex = bytes => Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
const encode = value => encodeURIComponent(value).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
async function digest(value) { return hex(await crypto.subtle.digest('SHA-256', encoder.encode(value))); }
async function hmac(key, value) {
  const imported = await crypto.subtle.importKey('raw', typeof key === 'string' ? encoder.encode(key) : key, {name:'HMAC', hash:'SHA-256'}, false, ['sign']);
  return crypto.subtle.sign('HMAC', imported, encoder.encode(value));
}
export function directAssetsEnabled(env) { return Boolean(env.DRONE_R2_ACCOUNT_ID && env.DRONE_R2_BUCKET && env.DRONE_R2_ACCESS_KEY_ID && env.DRONE_R2_SECRET_ACCESS_KEY); }
export async function createPrivateAssetSigner(env, {now = new Date(), ttl = 300} = {}) {
  if (!directAssetsEnabled(env)) throw Error('private_asset_signer_unavailable');
  if (!/^[a-f0-9]{32}$/.test(env.DRONE_R2_ACCOUNT_ID) || !/^[a-z0-9-]+$/.test(env.DRONE_R2_BUCKET)) throw Error('invalid_private_asset_storage');
  ttl = Math.min(300, Math.max(1, Math.floor(ttl)));
  const host = `${env.DRONE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  const date = now.toISOString().replace(/[:-]|\.\d{3}/g, ''), day = date.slice(0,8), scope = `${day}/auto/s3/aws4_request`;
  const query = new URLSearchParams({'X-Amz-Algorithm':'AWS4-HMAC-SHA256','X-Amz-Credential':`${env.DRONE_R2_ACCESS_KEY_ID}/${scope}`,'X-Amz-Date':date,'X-Amz-Expires':String(ttl),'X-Amz-SignedHeaders':'host','response-cache-control':'private, no-store'});
  const canonical = [...query].sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,v])=>`${encode(k)}=${encode(v)}`).join('&');
  const signingKey = await hmac(await hmac(await hmac(await hmac('AWS4'+env.DRONE_R2_SECRET_ACCESS_KEY,day),'auto'),'s3'),'aws4_request');
  return async key => {
    const path = '/' + [env.DRONE_R2_BUCKET, ...key.split('/')].map(encode).join('/');
    const request = `GET\n${path}\n${canonical}\nhost:${host}\n\nhost\nUNSIGNED-PAYLOAD`;
    const signature = hex(await hmac(signingKey,`AWS4-HMAC-SHA256\n${date}\n${scope}\n${await digest(request)}`));
    return {url:`https://${host}${path}?${canonical}&X-Amz-Signature=${signature}`,expiresAt:now.getTime()+ttl*1000};
  };
}
export async function signPrivateAsset(env,key,options) { return (await createPrivateAssetSigner(env,options))(key); }
