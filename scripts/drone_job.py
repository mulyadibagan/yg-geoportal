#!/usr/bin/env python3
import argparse, json, os, shutil, subprocess
from datetime import datetime, timezone


def load(path):
    with open(path, encoding='utf-8') as f:
        return json.load(f)

def save(path, value):
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(value, f, ensure_ascii=False, indent=2)

def now_iso():
    return datetime.now(timezone.utc).isoformat()

def add_history(d, stage, progress, label):
    history=d.get('stageHistory') if isinstance(d.get('stageHistory'), list) else []
    history.append({'stage':stage,'progress':progress,'label':label,'at':now_iso()})
    d['stageHistory']=history[-30:]

def mark(path, status, **kwargs):
    d=load(path); d['status']=status; d.update(kwargs); save(path,d)

def set_stage(path, stage, progress, label, **kwargs):
    d=load(path)
    d['status']='processing'
    d['stage']=stage
    d['progress']=max(0,min(100,int(progress)))
    d['stageLabel']=label
    d['stageUpdatedAt']=now_iso()
    d.update(kwargs)
    add_history(d,stage,d['progress'],label)
    save(path,d)

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
    a=sub.add_parser('stage'); a.add_argument('job'); a.add_argument('stage'); a.add_argument('progress',type=int); a.add_argument('label'); a.add_argument('--valid',type=int); a.add_argument('--excluded',type=int)
    a=sub.add_parser('qc'); a.add_argument('input'); a.add_argument('rejected'); a.add_argument('valid_list'); a.add_argument('summary')
    a=sub.add_parser('ready'); a.add_argument('job'); a.add_argument('gdalinfo'); a.add_argument('summary')
    a=sub.add_parser('failed'); a.add_argument('job'); a.add_argument('--error',default='processing_failed')
    args=p.parse_args(); now=now_iso()
    if args.cmd=='processing':
        d=load(args.job); d.update({'status':'processing','processingStartedAt':now,'stage':'starting','progress':5,'stageLabel':'Memulai pemrosesan','stageUpdatedAt':now}); add_history(d,'starting',5,'Memulai pemrosesan'); save(args.job,d)
    elif args.cmd=='stage':
        extra={}
        if args.valid is not None: extra['validPhotos']=args.valid
        if args.excluded is not None: extra['excludedPhotos']=args.excluded
        set_stage(args.job,args.stage,args.progress,args.label,**extra)
    elif args.cmd=='qc':
        valid,rejected=qc(args.input,args.rejected,args.valid_list); save(args.summary,{'validPhotos':valid,'excludedPhotos':len(rejected),'excluded':rejected}); print(valid)
    elif args.cmd=='ready':
        d=load(args.job); info=load(args.gdalinfo); q=load(args.summary); d.update({'status':'ready','stage':'complete','progress':100,'stageLabel':'Selesai','stageUpdatedAt':now,'completedAt':now,'validPhotos':q['validPhotos'],'excludedPhotos':q['excludedPhotos'],'excluded':q.get('excluded',[]),'cogKey':f"drone/results/{d['id']}/orthomosaic.cog.tif",'gdal':{'size':info.get('size'),'coordinateSystem':info.get('coordinateSystem'),'cornerCoordinates':info.get('cornerCoordinates') or {}}}); add_history(d,'complete',100,'Selesai'); save(args.job,d)
    elif args.cmd=='failed':
        d=load(args.job); d.update({'status':'failed','stage':'failed','stageLabel':'Pemrosesan terhenti','stageUpdatedAt':now,'failedAt':now,'error':args.error}); add_history(d,'failed',int(d.get('progress') or 0),'Pemrosesan terhenti'); save(args.job,d)
if __name__=='__main__': main()
