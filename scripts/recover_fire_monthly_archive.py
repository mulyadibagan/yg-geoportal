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
    # Month-end covers the first days; the newest snapshot includes late arrivals.
    sha=subprocess.check_output(['git','log','-1','--format=%H','--until='+end.isoformat()+'T23:59:59Z','--',path],text=True).strip()
    if not sha: raise SystemExit('No month-end snapshot in git history')
    for ref in [sha,'HEAD']:
        sources.append((ref,json.loads(subprocess.check_output(['git','show',ref+':'+path],text=True))))
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
