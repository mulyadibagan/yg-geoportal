#!/usr/bin/env python3
"""Merge published coastal-regency packages into one province-wide package."""
import csv,json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
DATA=ROOT/'data'
REGIONS=('bengkalis','siak','dumai','rokan-hilir','kepulauan-meranti','indragiri-hilir','pelalawan')

def read(name):
    return json.loads((DATA/name).read_text(encoding='utf-8'))

villages=[]; results=[]; features=[]; periods=set(); generated=[]
for slug in REGIONS:
    foundation=read(f'mangrove-priority-{slug}-villages.json')
    summary=read(f'mangrove-priority-{slug}-results.json')
    geo=read(f'mangrove-priority-{slug}-candidates.geojson')
    periods.add((str(summary.get('baseline','')),str(summary.get('current','')),str(summary.get('latest',summary.get('current',''))),str(summary.get('methodVersion',''))))
    if summary.get('generatedAt'):generated.append(summary['generatedAt'])
    for village in foundation['villages']:
        village=dict(village); village['sourceId']=village['id']; village['id']=f"{slug}:{village['id']}"
        village['districtKey']=f"{village['regency']}|{village['district']}"; villages.append(village)
    for record in summary['villages']:
        record=dict(record); record['sourceId']=record['id']; record['id']=f"{slug}:{record['id']}"; results.append(record)
    for feature in geo['features']:
        props=feature['properties']; props['sourceId']=props['id']; props['id']=f"{slug}:{props['id']}"; features.append(feature)

if len(periods)!=1:raise SystemExit(f'Regional analysis periods do not match: {sorted(periods)}')
baseline,current,latest,method=next(iter(periods))
if not baseline or not current or not method:raise SystemExit('Regional analysis metadata is incomplete')
features.sort(key=lambda f:(-f['properties'].get('priorityScore',0),-f['properties'].get('areaHa',0),f['properties']['polygonId']))
for rank,feature in enumerate(features,1): feature['properties']['overallRank']=rank
generated_at=max(generated) if generated else None
foundation={'schemaVersion':1,'scope':'Provinsi Riau','regions':list(REGIONS),'baseline':baseline,'comparison':current,'generatedAt':generated_at,'updateFrequency':'annual','villages':villages}
summary={'schemaVersion':1,'scope':'Provinsi Riau','baseline':baseline,'current':current,'latest':latest,'generatedAt':generated_at,'updateFrequency':'annual','status':'complete','methodVersion':method,'villages':results}
geo={'type':'FeatureCollection','name':f'Prioritas Rehabilitasi Mangrove Provinsi Riau {baseline}–{current}','baseline':baseline,'current':current,'latest':latest,'generatedAt':generated_at,'updateFrequency':'annual','methodVersion':method,'features':features}
(DATA/'mangrove-priority-riau-villages.json').write_text(json.dumps(foundation,ensure_ascii=False,indent=2),encoding='utf-8')
(DATA/'mangrove-priority-riau-results.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf-8')
(DATA/'mangrove-priority-riau-candidates.geojson').write_text(json.dumps(geo,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
fields=['overallRank','villageRank','polygonId','village','district','regency','areaHa','priorityClass','priorityLabel','priorityScore','needScore','suitabilityScore','riskScore','confidence','decisionReason','methodVersion']
with (DATA/'mangrove-priority-riau-ranking.csv').open('w',newline='',encoding='utf-8-sig') as handle:
    writer=csv.DictWriter(handle,fieldnames=fields); writer.writeheader(); writer.writerows([{key:f['properties'].get(key) for key in fields} for f in features])
print(json.dumps({'regions':len(REGIONS),'villages':len(villages),'polygons':len(features),'areaHa':round(sum(f['properties'].get('areaHa',0) for f in features),2)},ensure_ascii=False))
