#!/usr/bin/env python3
"""Add every Bengkalis coastal village to the mangrove-priority queue."""
import json,re
from pathlib import Path
from shapely.geometry import shape

ROOT=Path(__file__).resolve().parents[1]
FOUNDATION=ROOT/'data'/'mangrove-priority-intervention.json'
SOURCE=ROOT/'data'/'coastal-villages-riau.geojson'
PROGRESS=ROOT/'data'/'mangrove-priority-progress.json'

def slug(text):
    return re.sub(r'[^a-z0-9]+','-',text.casefold()).strip('-')

def compact(text):
    return re.sub(r'[^a-z0-9]+','',text.casefold())

def main():
    foundation=json.loads(FOUNDATION.read_text(encoding='utf-8'))
    source=json.loads(SOURCE.read_text(encoding='utf-8'))
    existing={v['id']:v for v in foundation['villages']}
    existing_names={compact(v['village']) for v in existing.values()}
    for feature in source['features']:
        p=feature.get('properties') or {}
        if (p.get('WADMKK') or p.get('WIADKK'))!='Bengkalis':continue
        name=p.get('WADMKD') or p.get('NAMOBJ');district=p.get('WADMKC') or p.get('WIADKC') or '—'
        if not name or name.casefold() in {'area saling klaim','area tidak terdefinisi'}:continue
        candidate_id=slug(name)
        if candidate_id in existing or compact(name) in existing_names:continue
        centroid=shape(feature['geometry']).representative_point()
        existing[candidate_id]={'id':candidate_id,'village':name,'district':district,'regency':'Bengkalis','lat':round(centroid.y,6),'lon':round(centroid.x,6),'scope':'Bengkalis coastal screening'}
        existing_names.add(compact(name))
    foundation['product']='Prioritas Rehabilitasi Mangrove 2016–2025'
    foundation['scope']='Seluruh desa pesisir Kabupaten Bengkalis dan Tanjung Kuras'
    foundation['villages']=sorted(existing.values(),key=lambda v:(v['regency']!='Bengkalis',v['district'],v['village']))
    FOUNDATION.write_text(json.dumps(foundation,ensure_ascii=False,indent=2),encoding='utf-8')
    progress=json.loads(PROGRESS.read_text(encoding='utf-8'))
    ids={v['id'] for v in foundation['villages']};pending=[x for x in ids if x not in progress.get('completed',{})]
    progress.update(totalVillages=len(ids),completedCount=len(progress.get('completed',{})),nextVillage=sorted(pending)[0] if pending else None,status='processing' if pending else 'complete',safeToResume=True)
    PROGRESS.write_text(json.dumps(progress,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({'villages':len(ids),'completed':progress['completedCount'],'pending':len(pending)},ensure_ascii=False))
if __name__=='__main__':main()
