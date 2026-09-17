#!/usr/bin/env python3
import argparse, json, os, shutil, subprocess, re
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

def parse_capture_time(value):
    value=str(value or '').strip()
    if not value:
        return None
    # exiftool commonly returns 2023:04:06 12:13:38 or ISO-like strings.
    value=re.sub(r'^(\d{4}):(\d{2}):(\d{2}) ', r'\1-\2-\3T', value)
    value=value.replace(' ', 'T', 1) if re.match(r'^\d{4}-\d{2}-\d{2} ', value) else value
    # Keep camera-local time when timezone is absent; do not invent a timezone.
    m=re.match(r'^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})(?:\.\d+)?(?:([+-]\d{2}:?\d{2}|Z))?', value)
    if not m:
        return None
    tz=m.group(3) or ''
    if tz and tz != 'Z' and ':' not in tz:
        tz=tz[:3]+':'+tz[3:]
    return f"{m.group(1)}T{m.group(2)}{tz}"

def inspect_exif(path):
    tags=['-DateTimeOriginal','-CreateDate','-GPSDateTime','-Model','-Make','-GimbalPitchDegree','-GPSLatitude','-GPSLongitude','-RelativeAltitude']
    try:
        raw=subprocess.check_output(['exiftool','-j']+tags+[path], text=True, stderr=subprocess.DEVNULL)
        data=(json.loads(raw) or [{}])[0]
    except Exception:
        data={}
    pitch=None
    try:
        pitch=float(data.get('GimbalPitchDegree')) if data.get('GimbalPitchDegree') not in (None,'') else None
    except Exception:
        pitch=None
    capture=None
    capture_source=''
    for key in ('DateTimeOriginal','CreateDate','GPSDateTime'):
        capture=parse_capture_time(data.get(key))
        if capture:
            capture_source=key
            break
    return {
        'pitch': pitch,
        'captureTime': capture,
        'captureTimeSource': capture_source,
        'cameraModel': str(data.get('Model') or '').strip(),
        'cameraMake': str(data.get('Make') or '').strip(),
        'gpsLatitude': data.get('GPSLatitude'),
        'gpsLongitude': data.get('GPSLongitude'),
        'relativeAltitude': data.get('RelativeAltitude')
    }

def qc(input_dir, rejected_dir, valid_list):
    os.makedirs(rejected_dir, exist_ok=True)
    valid=[]; rejected=[]; metadata=[]
    for root,_,files in os.walk(input_dir):
        for name in sorted(files):
            if not name.lower().endswith(('.jpg','.jpeg')): continue
            path=os.path.join(root,name)
            meta=inspect_exif(path)
            p=meta.get('pitch')
            metadata.append({'name':name, **meta})
            if p is not None and p > -85:
                dst=os.path.join(rejected_dir,name)
                base,ext=os.path.splitext(dst); n=1
                while os.path.exists(dst): dst=f'{base}-{n}{ext}'; n+=1
                shutil.move(path,dst); rejected.append({'name':name,'pitch':p,'reason':'non_nadir'})
            else:
                valid.append(path)
    with open(valid_list,'w',encoding='utf-8') as f:
        for p in valid: f.write(p+'\n')

    capture_times=sorted([m['captureTime'] for m in metadata if m.get('captureTime')])
    camera_models=sorted(set([m['cameraModel'] for m in metadata if m.get('cameraModel')]))
    camera_makes=sorted(set([m['cameraMake'] for m in metadata if m.get('cameraMake')]))
    survey_start=capture_times[0] if capture_times else None
    survey_end=capture_times[-1] if capture_times else None
    survey_date=survey_start[:10] if survey_start else None
    return {
        'validPhotos':len(valid),
        'excludedPhotos':len(rejected),
        'excluded':rejected,
        'photoCount':len(metadata),
        'metadataPhotoCount':len(capture_times),
        'surveyDate':survey_date,
        'surveyStartAt':survey_start,
        'surveyEndAt':survey_end,
        'cameraModels':camera_models,
        'cameraMakes':camera_makes,
        'metadata':metadata
    }

def apply_metadata(job_path, summary_path):
    d=load(job_path); q=load(summary_path)
    for key in ('photoCount','metadataPhotoCount','surveyDate','surveyStartAt','surveyEndAt','cameraModels','cameraMakes','validPhotos','excludedPhotos'):
        if key in q:
            d[key]=q.get(key)
    d['surveyDateSource']='photo_metadata' if q.get('surveyDate') else 'unavailable'
    d['metadataUpdatedAt']=now_iso()
    # Remove legacy automatically generated current-date titles; preserve custom names.
    title=str(d.get('title') or '').strip()
    if re.match(r'^Survei drone\s+\d{1,2}[/-]\d{1,2}[/-]\d{4}$', title, re.I):
        d['title']='Survei drone'
    save(job_path,d)

def main():
    p=argparse.ArgumentParser(); sub=p.add_subparsers(dest='cmd',required=True)
    a=sub.add_parser('processing'); a.add_argument('job')
    a=sub.add_parser('stage'); a.add_argument('job'); a.add_argument('stage'); a.add_argument('progress',type=int); a.add_argument('label'); a.add_argument('--valid',type=int); a.add_argument('--excluded',type=int)
    a=sub.add_parser('qc'); a.add_argument('input'); a.add_argument('rejected'); a.add_argument('valid_list'); a.add_argument('summary')
    a=sub.add_parser('metadata'); a.add_argument('job'); a.add_argument('summary')
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
        summary=qc(args.input,args.rejected,args.valid_list); save(args.summary,summary); print(summary['validPhotos'])
    elif args.cmd=='metadata':
        apply_metadata(args.job,args.summary)
    elif args.cmd=='ready':
        d=load(args.job); info=load(args.gdalinfo); q=load(args.summary); d.update({'status':'ready','stage':'complete','progress':100,'stageLabel':'Selesai','stageUpdatedAt':now,'completedAt':now,'validPhotos':q['validPhotos'],'excludedPhotos':q['excludedPhotos'],'excluded':q.get('excluded',[]),'surveyDate':q.get('surveyDate'),'surveyStartAt':q.get('surveyStartAt'),'surveyEndAt':q.get('surveyEndAt'),'cameraModels':q.get('cameraModels',[]),'cameraMakes':q.get('cameraMakes',[]),'surveyDateSource':'photo_metadata' if q.get('surveyDate') else 'unavailable','cogKey':f"drone/results/{d['id']}/orthomosaic.cog.tif",'gdal':{'size':info.get('size'),'coordinateSystem':info.get('coordinateSystem'),'cornerCoordinates':info.get('cornerCoordinates') or {}}}); add_history(d,'complete',100,'Selesai'); save(args.job,d)
    elif args.cmd=='failed':
        d=load(args.job); d.update({'status':'failed','stage':'failed','stageLabel':'Pemrosesan terhenti','stageUpdatedAt':now,'failedAt':now,'error':args.error}); add_history(d,'failed',int(d.get('progress') or 0),'Pemrosesan terhenti'); save(args.job,d)
if __name__=='__main__': main()
