"""Use the existing Wrangler/R2 identity; never store imagery in public Actions artifacts.

Checkpoints and outputs live outside all public Worker routes. Source chunks are
content-addressed so a failed checkpoint update cannot corrupt an older manifest.
"""
import argparse
import hashlib
import json
import re
import shutil
from pathlib import Path
import subprocess
import tempfile
import time
import sys

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
    require_private_bucket()
    node=shutil.which('node')
    if not node: raise RuntimeError('node_runtime_missing')
    command=[node,str(WRANGLER/'node_modules/wrangler/bin/wrangler.js'),'r2','object',action,f'{BUCKET}/{key}','--remote','--file',str(Path(path).resolve())]
    if action=='put': command+=['--content-type','application/octet-stream']
    result=subprocess.run(command,cwd=WRANGLER,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    if result.returncode and required: raise RuntimeError('private_storage_transfer_failed')
    return result.returncode==0

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
        parts=[]
        with partial.open('rb') as f:
            while data:=f.read(CHUNK):
                digest=hashlib.sha256(data).hexdigest(); key=f'{prefix}/{digest}.bin'
                if digest not in known:
                    chunk=root/'chunk'; chunk.write_bytes(data); transfer('put',key,chunk)
                parts.append({'key':key,'bytes':len(data),'sha256':digest})
        index=root/'index.json'; index.write_text(json.dumps({'identity':json.loads(marker.read_text()),'parts':parts}))
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
    for path in sorted(output.rglob('*')):
        if not path.is_file(): continue
        relative=path.relative_to(output).as_posix()
        transfer('put',f'{prefix}/{relative}',path); files.append(relative)
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
