#!/usr/bin/env python3
"""Create an immutable district package from the resumable regency analysis."""
import argparse,json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]

def main():
    parser=argparse.ArgumentParser();parser.add_argument('district');parser.add_argument('--slug',required=True);args=parser.parse_args()
    foundation=json.loads((ROOT/'data/mangrove-priority-intervention.json').read_text(encoding='utf-8'))
    summary=json.loads((ROOT/'data/mangrove-priority-results.json').read_text(encoding='utf-8'))
    geo=json.loads((ROOT/'data/mangrove-priority-candidates.geojson').read_text(encoding='utf-8'))
    selected=[v for v in foundation['villages'] if v['district'].casefold()==args.district.casefold()]
    ids={v['id'] for v in selected}; records=[r for r in summary['villages'] if r['id'] in ids]
    missing=ids-{r['id'] for r in records if r.get('status')=='analysed'}
    if missing:raise SystemExit('District is incomplete: '+', '.join(sorted(missing)))
    foundation['villages']=selected;foundation['scope']=f'Kecamatan {args.district}'
    summary['villages']=records;summary['scope']=f'Kecamatan {args.district}';summary['status']='complete'
    geo['features']=[f for f in geo['features'] if f.get('properties',{}).get('id') in ids];geo['scope']=f'Kecamatan {args.district}'
    base=ROOT/'data'/f'mangrove-priority-{args.slug}'
    (base.with_name(base.name+'-villages.json')).write_text(json.dumps(foundation,ensure_ascii=False,indent=2),encoding='utf-8')
    (base.with_name(base.name+'-results.json')).write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf-8')
    (base.with_name(base.name+'-candidates.geojson')).write_text(json.dumps(geo,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    print(json.dumps({'district':args.district,'villages':len(selected),'records':len(records),'polygons':len(geo['features'])}))

if __name__=='__main__':main()
