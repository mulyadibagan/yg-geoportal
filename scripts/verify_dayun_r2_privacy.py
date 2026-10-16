"""Fail closed unless the existing Dayun bucket has no public R2 domains."""
import argparse
import json
import os
from pathlib import Path
import time
import tomllib
import urllib.error
import urllib.request

BUCKET='yg-webgis-public-snapshots'
ACCOUNT='f521af5ec1f2197e8f55d1e460c0296e'

def api_get(path, token, account=ACCOUNT):
    request=urllib.request.Request(f'https://api.cloudflare.com/client/v4/accounts/{account}/r2/buckets/{BUCKET}/{path}',headers={'Authorization':'Bearer '+token})
    try:
        with urllib.request.urlopen(request,timeout=30) as response:
            data=json.load(response)
    except urllib.error.HTTPError as error:
        raise RuntimeError(f'r2_privacy_http_{error.code}') from None
    except (urllib.error.URLError,ValueError):
        raise RuntimeError('r2_privacy_check_unavailable') from None
    if data.get('success') is not True or not isinstance(data.get('result'),dict):
        raise RuntimeError('r2_privacy_check_invalid_response')
    return data['result']

def verify(token=None, account=None):
    token=token or os.environ.get('CLOUDFLARE_API_TOKEN','')
    account=account or os.environ.get('CLOUDFLARE_ACCOUNT_ID',ACCOUNT)
    if not token: raise RuntimeError('r2_privacy_credentials_missing')
    managed=api_get('domains/managed',token,account)
    custom=api_get('domains/custom',token,account)
    if managed.get('enabled') is not False:
        raise RuntimeError('r2_managed_public_access_enabled_or_unknown')
    domains=custom.get('domains')
    if not isinstance(domains,list): raise RuntimeError('r2_custom_domains_unknown')
    # Even disabled custom domains are rejected: enabling one later would expose
    # every prefix. Do not change existing website domain settings automatically.
    if domains: raise RuntimeError('r2_custom_domains_present')
    return {'ok':True,'bucket':BUCKET,'prefix':'drone/analysis/dayun/',
            'managed_public_access':False,'custom_domains':0,'checked_at_unix':int(time.time())}

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--wrangler-config');p.add_argument('--output')
    args=p.parse_args()
    try:
        token=None
        if args.wrangler_config:
            token=tomllib.loads(Path(args.wrangler_config).read_text()).get('oauth_token')
        result=verify(token)
    except Exception as error:
        result={'ok':False,'error':str(error) if isinstance(error,RuntimeError) else 'r2_privacy_check_failed'}
    if args.output:
        path=Path(args.output);path.parent.mkdir(parents=True,exist_ok=True);path.write_text(json.dumps(result,indent=2))
    print(json.dumps(result))
    raise SystemExit(0 if result['ok'] else 1)
