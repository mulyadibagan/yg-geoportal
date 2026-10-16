"""Use the existing Wrangler/R2 identity; never store imagery in public Actions artifacts.

Checkpoints and outputs live outside all public Worker routes. Source chunks are
content-addressed so a failed checkpoint update cannot corrupt an older manifest.
"""
import argparse
import hashlib
import json
import re
import os
import shutil
from pathlib import Path
import subprocess
import tempfile
import time
import sys
import urllib.request
import urllib.error
import urllib.parse
from http.client import HTTPException
from concurrent.futures import ThreadPoolExecutor

sys.path.insert(0,str(Path(__file__).resolve().parent))
from verify_dayun_r2_privacy import verify

BUCKET='yg-webgis-public-snapshots'
PREFIX='drone/analysis/dayun'
CHUNK=128*1024*1024
WRANGLER=Path(__file__).resolve().parents[1]/'cloudflare/yg-webgis-public-data'
_privacy_checked=0

def require_private_bucket():
    global _privacy_checked
    if time.monotonic()-_privacy_checked>60 or not _privacy_checked:
        verify()
        _privacy_checked=time.monotonic()

def transfer(action,key,path,required=True):
    if not key.startswith(PREFIX+'/') or any(part in ('','..','.') for part in key.split('/')):
        raise RuntimeError('private_storage_invalid_key')
    if action=='get' and not required and not key.endswith('.json'):raise RuntimeError('optional_read_requires_manifest')
    require_private_bucket()
    if os.environ.get('CLOUDFLARE_API_TOKEN'):
        return api_transfer(action,key,path,required)
    if action=='get' and not required:
        # Optional reads are small manifests, not imagery. Only HTTP 404 means
        # "no checkpoint/request"; permission/network errors must fail the run.
        if not key.endswith('.json'):raise RuntimeError('optional_read_requires_manifest')
        account=os.environ.get('CLOUDFLARE_ACCOUNT_ID','')
        token=os.environ.get('CLOUDFLARE_API_TOKEN','')
        request=urllib.request.Request(f'https://api.cloudflare.com/client/v4/accounts/{account}/r2/buckets/{BUCKET}/objects/{urllib.parse.quote(key,safe="/")}',headers={'Authorization':'Bearer '+token})
        try:
            with urllib.request.urlopen(request,timeout=30) as response:data=response.read(4*1024*1024+1)
        except urllib.error.HTTPError as error:
            if error.code==404:return False
            raise RuntimeError('private_storage_read_denied') from None
        except urllib.error.URLError:
            raise RuntimeError('private_storage_read_unavailable') from None
        if len(data)>4*1024*1024:raise RuntimeError('private_manifest_too_large')
        Path(path).write_bytes(data)
        return True
    node=shutil.which('node')
    if not node: raise RuntimeError('node_runtime_missing')
    command=[node,str(WRANGLER/'node_modules/wrangler/bin/wrangler.js'),'r2','object',action,f'{BUCKET}/{key}','--remote','--file',str(Path(path).resolve())]
    if action=='put': command+=['--content-type','application/octet-stream']
    result=subprocess.run(command,cwd=WRANGLER,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    if result.returncode and required: raise RuntimeError('private_storage_transfer_failed')
    return result.returncode==0

def api_transfer(action,key,path,required=True):
    """Stream through the existing Cloudflare API token; retry transient failures."""
    if action not in ('get','put'):raise RuntimeError('private_storage_invalid_action')
    account=os.environ.get('CLOUDFLARE_ACCOUNT_ID','')
    url=f'https://api.cloudflare.com/client/v4/accounts/{account}/r2/buckets/{BUCKET}/objects/{urllib.parse.quote(key,safe="/")}'
    headers={'Authorization':'Bearer '+os.environ['CLOUDFLARE_API_TOKEN']}
    path=Path(path);receiving=path.with_name(path.name+'.receiving')
    for attempt in range(4):
        try:
            if action=='put':
                with path.open('rb') as source:
                    request=urllib.request.Request(url,data=source,method='PUT',headers={**headers,'Content-Type':'application/octet-stream','Content-Length':str(path.stat().st_size)})
                    with urllib.request.urlopen(request,timeout=300) as response:
                        result=json.loads(response.read(4*1024*1024))
                    if result.get('success') is not True:raise RuntimeError('private_storage_write_failed')
            else:
                with urllib.request.urlopen(urllib.request.Request(url,headers=headers),timeout=300) as response:
                    path.parent.mkdir(parents=True,exist_ok=True)
                    with receiving.open('wb') as dest:
                        if not required:
                            if not key.endswith('.json'):raise RuntimeError('optional_read_requires_manifest')
                            data=response.read(4*1024*1024+1)
                            if len(data)>4*1024*1024:raise RuntimeError('private_manifest_too_large')
                            dest.write(data)
                        else:shutil.copyfileobj(response,dest,8*1024*1024)
                receiving.replace(path)
            return True
        except urllib.error.HTTPError as error:
            if action=='get' and not required and error.code==404:return False
            if error.code not in (408,429,500,502,503,504):
                raise RuntimeError('private_storage_read_denied' if action=='get' else 'private_storage_write_denied') from None
        except (urllib.error.URLError,OSError,TimeoutError,HTTPException):pass
        finally:
            receiving.unlink(missing_ok=True)
        if attempt<3:time.sleep(2**attempt)
    raise RuntimeError('private_storage_transfer_failed') from None

def read_remote(key,root):
    path=root/'remote.json'
    if transfer('get',key,path,required=False): return json.loads(path.read_text())
    return None

def checkpoint(label,source):
    source=Path(source); partial=source.with_suffix(source.suffix+'.part'); marker=source.with_suffix(source.suffix+'.part.json')
    if source.exists() and source.with_suffix(source.suffix+'.source.json').exists():
        partial=source;marker=source.with_suffix(source.suffix+'.source.json')
    if not partial.exists() or not marker.exists(): return
    prefix=f'{PREFIX}/checkpoints/{label}'
    with tempfile.TemporaryDirectory() as temp:
        root=Path(temp); old=read_remote(prefix+'/index.json',root) or {}; known={p['sha256'] for p in old.get('parts',[])}
        identity=json.loads(marker.read_text())
        old_parts=old.get('parts',[]) if old.get('identity')==identity else []
        parts=[]
        with partial.open('rb') as f:
            while data:=f.read(CHUNK):
                digest=hashlib.sha256(data).hexdigest(); key=f'{prefix}/{digest}.bin'
                if digest not in known:
                    chunk=root/'chunk'; chunk.write_bytes(data); transfer('put',key,chunk)
                parts.append({'key':key,'bytes':len(data),'sha256':digest})
                # Commit every durable prefix, so a later upload failure can be
                # resumed. Never shorten a valid checkpoint of the same source.
                if len(parts)>len(old_parts) or parts!=old_parts[:len(parts)]:
                    index=root/'index.json';index.write_text(json.dumps({'identity':identity,'parts':parts}))
                    transfer('put',prefix+'/index.json',index)
        index=root/'index.json'; index.write_text(json.dumps({'identity':identity,'parts':parts}))
        transfer('put',prefix+'/index.json',index)

def restore(label,source):
    source=Path(source); source.parent.mkdir(parents=True,exist_ok=True)
    partial=source.with_suffix(source.suffix+'.part'); marker=source.with_suffix(source.suffix+'.part.json')
    if partial.exists() or source.exists(): return
    with tempfile.TemporaryDirectory() as temp:
        root=Path(temp); index=read_remote(f'{PREFIX}/checkpoints/{label}/index.json',root)
        if not index: return
        staging=source.with_suffix('.restoring')
        try:
            with staging.open('wb') as dst:
                for part in index['parts']:
                    if not part['key'].startswith(f'{PREFIX}/checkpoints/{label}/'): raise RuntimeError('invalid_checkpoint_key')
                    chunk=root/'chunk'; transfer('get',part['key'],chunk)
                    data=chunk.read_bytes()
                    if len(data)!=part['bytes'] or hashlib.sha256(data).hexdigest()!=part['sha256']: raise RuntimeError('invalid_checkpoint_chunk')
                    dst.write(data)
            marker.write_text(json.dumps(index['identity'])); staging.replace(partial)
        finally:
            staging.unlink(missing_ok=True)

def publish(label,output,run):
    if not re.fullmatch(r'[A-Za-z0-9_-]+',run): raise ValueError('invalid_run_id')
    output=Path(output); prefix=f'{PREFIX}/results/{label}/{run}'
    files=[]
    paths=sorted(path for path in output.rglob('*') if path.is_file())
    def upload(path):
        relative=path.relative_to(output).as_posix()
        transfer('put',f'{prefix}/{relative}',path)
        return relative
    with ThreadPoolExecutor(max_workers=4) as pool:
        files=list(pool.map(upload,paths))
    # Only advertise a complete upload. Failure results remain explicit.
    manifest={'schema':'dayun-private-v1','label':label,'run':run,'prefix':prefix,'files':files,
              'download':json.loads((output/'download-status.json').read_text()),
              'analysis': json.loads((output/'analysis-status.json').read_text()) if (output/'analysis-status.json').exists() else {'ok':False,'stage':'not_completed'}}
    with tempfile.TemporaryDirectory() as temp:
        path=Path(temp)/'index.json'; path.write_text(json.dumps(manifest))
        transfer('put',f'{PREFIX}/results/{label}/index.json',path)

if __name__=='__main__':
    p=argparse.ArgumentParser(); p.add_argument('action',choices=['restore','checkpoint','publish']); p.add_argument('label',choices=['Agro_ABC','Agro_DEF']); p.add_argument('path'); p.add_argument('--run',default='local')
    a=p.parse_args()
    if a.action=='publish': publish(a.label,a.path,a.run)
    else: globals()[a.action](a.label,a.path)
