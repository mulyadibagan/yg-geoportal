"""Recover a closed month's FIRMS archive from versioned, complete rolling snapshots."""
import argparse, calendar, datetime as dt, json, pathlib, subprocess
p=argparse.ArgumentParser(); p.add_argument('--month',required=True); p.add_argument('--output',required=True); p.add_argument('--snapshot',action='append'); a=p.parse_args()
start=dt.date.fromisoformat(a.month+'-01'); end=start.replace(day=calendar.monthrange(start.year,start.month)[1])
if end >= dt.datetime.now(dt.timezone.utc).date(): raise SystemExit('Only closed months can be finalized')
path='data/hotspot-high-confidence.geojson'
sources=[]
if a.snapshot:
    sources=[(s,json.loads(pathlib.Path(s).read_text())) for s in a.snapshot]
else:
    # A 30-day window cannot cover every day of a 31-day month.
    # Walk snapshots newest first until complete calendar coverage is recovered.
    refs=subprocess.check_output(['git','log','--format=%H %cI','--since='+start.isoformat()+'T00:00:00Z','--until='+(end+dt.timedelta(days=32)).isoformat()+'T23:59:59Z','--',path],text=True).splitlines()
    if not refs: raise SystemExit('No snapshots in git history for requested month')
    required={start+dt.timedelta(days=n) for n in range((end-start).days+1)}
    recovered=set()
    cutoff=None
    for entry in refs:
        ref,committed=entry.split(' ',1)
        if cutoff and dt.date.fromisoformat(committed[:10])>cutoff: continue
        j=json.loads(subprocess.check_output(['git','show',ref+':'+path],text=True))
        if j.get('sourceStatus')!='complete' or j.get('skippedChunks'): continue
        lo=dt.date.fromisoformat(j['coverageStart']); hi=dt.date.fromisoformat(j['coverageEnd'])
        overlap={day for day in required if lo<=day<=hi}
        if not overlap-recovered: continue
        sources.append((ref,j)); recovered.update(overlap)
        if required<=recovered: break
        cutoff=max(required-recovered)+dt.timedelta(days=1)
covered=set(); features={}; provenance=[]
for ref,j in sources:
    if j.get('sourceStatus')!='complete' or j.get('skippedChunks'): raise SystemExit('Incomplete source snapshot: '+ref)
    lo=dt.date.fromisoformat(j['coverageStart']); hi=dt.date.fromisoformat(j['coverageEnd'])
    covered.update(lo+dt.timedelta(days=n) for n in range((hi-lo).days+1))
    provenance.append({'snapshot':ref,'generatedAt':j.get('generatedAt'),'coverageStart':str(lo),'coverageEnd':str(hi),'providers':j.get('providers',[])})
    for f in j['features']:
        v=f.get('properties',{}); date=v.get('acq_date','')
        if not str(start)<=date<=str(end): continue
        c=f['geometry']['coordinates']; key=(date,str(v.get('acq_time','')).zfill(4),round(c[0],5),round(c[1],5),v.get('satellite',''))
        features[key]=f
missing=[str(start+dt.timedelta(days=n)) for n in range((end-start).days+1) if start+dt.timedelta(days=n) not in covered]
if missing: raise SystemExit('Missing coverage: '+','.join(missing))
out={'type':'FeatureCollection','month':a.month,'coverageStart':str(start),'coverageEnd':str(end),'sourceStatus':'complete','provenance':provenance,'features':[features[k] for k in sorted(features)]}
target=pathlib.Path(a.output);target.parent.mkdir(parents=True,exist_ok=True);target.write_text(json.dumps(out))
print('Recovered',a.month,len(features),'national detections; full calendar coverage')
