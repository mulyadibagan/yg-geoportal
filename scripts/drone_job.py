#!/usr/bin/env python3
import argparse, json, os, shutil, subprocess
from datetime import datetime, timezone


def load(path):
    with open(path, encoding='utf-8') as f:
        return json.load(f)

def save(path, value):
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(value, f, ensure_ascii=False, indent=2)

def mark(path, status, **kwargs):
    d=load(path); d['status']=status; d.update(kwargs); save(path,d)

def qc(input_dir, rejected_dir, valid_list):
    os.makedirs(rejected_dir, exist_ok=True)
    valid=[]; rejected=[]
    for root,_,files in os.walk(input_dir):
        for name in sorted(files):
            if not name.lower().endswith(('.jpg','.jpeg')): continue
            path=os.path.join(root,name)
            try:
                pitch=subprocess.check_output(['exiftool','-s3','-GimbalPitchDegree',path], text=True, stderr=subprocess.DEVNULL).strip()
                p=float(pitch) if pitch else None
            except Exception:
                p=None
            if p is not None and p > -85:
                dst=os.path.join(rejected_dir,name)
                base,ext=os.path.splitext(dst); n=1
                while os.path.exists(dst): dst=f'{base}-{n}{ext}'; n+=1
                shutil.move(path,dst); rejected.append({'name':name,'pitch':p,'reason':'non_nadir'})
            else:
                valid.append(path)
    with open(valid_list,'w',encoding='utf-8') as f:
        for p in valid: f.write(p+'\n')
    return len(valid),rejected

def main():
    p=argparse.ArgumentParser(); sub=p.add_subparsers(dest='cmd',required=True)
    a=sub.add_parser('processing'); a.add_argument('job')
    a=sub.add_parser('qc'); a.add_argument('input'); a.add_argument('rejected'); a.add_argument('valid_list'); a.add_argument('summary')
    a=sub.add_parser('ready'); a.add_argument('job'); a.add_argument('gdalinfo'); a.add_argument('summary')
    a=sub.add_parser('failed'); a.add_argument('job'); a.add_argument('--error',default='processing_failed')
    args=p.parse_args(); now=datetime.now(timezone.utc).isoformat()
    if args.cmd=='processing': mark(args.job,'processing',processingStartedAt=now)
    elif args.cmd=='qc':
        valid,rejected=qc(args.input,args.rejected,args.valid_list); save(args.summary,{'validPhotos':valid,'excludedPhotos':len(rejected),'excluded':rejected}); print(valid)
    elif args.cmd=='ready':
        d=load(args.job); info=load(args.gdalinfo); q=load(args.summary); d.update({'status':'ready','completedAt':now,'validPhotos':q['validPhotos'],'excludedPhotos':q['excludedPhotos'],'excluded':q.get('excluded',[]),'cogKey':f"drone/results/{d['id']}/orthomosaic.cog.tif",'gdal':{'size':info.get('size'),'coordinateSystem':info.get('coordinateSystem'),'cornerCoordinates':info.get('cornerCoordinates') or {}}}); save(args.job,d)
    elif args.cmd=='failed': mark(args.job,'failed',failedAt=now,error=args.error)
if __name__=='__main__': main()
