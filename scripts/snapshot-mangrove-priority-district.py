#!/usr/bin/env python3
"""Create an immutable district or regency package from a resumable analysis."""
import argparse,csv,json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]

def main():
    parser=argparse.ArgumentParser();parser.add_argument('area');parser.add_argument('--slug',required=True);parser.add_argument('--level',choices=('district','regency'),default='district');args=parser.parse_args()
    foundation=json.loads((ROOT/'data/mangrove-priority-intervention.json').read_text(encoding='utf-8'))
    summary=json.loads((ROOT/'data/mangrove-priority-results.json').read_text(encoding='utf-8'))
    geo=json.loads((ROOT/'data/mangrove-priority-candidates.geojson').read_text(encoding='utf-8'))
    field='district' if args.level=='district' else 'regency'
    selected=[v for v in foundation['villages'] if v.get(field,'').casefold()==args.area.casefold()]
    ids={v['id'] for v in selected}; records=[r for r in summary['villages'] if r['id'] in ids]
    missing=ids-{r['id'] for r in records if r.get('status') in {'analysed','insufficient-data'}}
    if missing:raise SystemExit(f'{args.level.title()} is incomplete: '+', '.join(sorted(missing)))
    label=('Kecamatan ' if args.level=='district' else 'Kabupaten/Kota ')+args.area
    foundation['villages']=selected;foundation['scope']=label
    summary['villages']=records;summary['scope']=label;summary['status']='complete'
    geo['features']=[f for f in geo['features'] if f.get('properties',{}).get('id') in ids];geo['scope']=label
    base=ROOT/'data'/f'mangrove-priority-{args.slug}'
    (base.with_name(base.name+'-villages.json')).write_text(json.dumps(foundation,ensure_ascii=False,indent=2),encoding='utf-8')
    (base.with_name(base.name+'-results.json')).write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf-8')
    (base.with_name(base.name+'-candidates.geojson')).write_text(json.dumps(geo,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    fields=['overallRank','villageRank','polygonId','village','district','regency','areaHa','priorityClass','priorityLabel','priorityScore','needScore','suitabilityScore','riskScore','confidence','decisionReason','methodVersion']
    ranked=sorted((f['properties'] for f in geo['features']),key=lambda p:(-p.get('priorityScore',0),-p.get('areaHa',0),p.get('polygonId','')))
    with base.with_name(base.name+'-ranking.csv').open('w',newline='',encoding='utf-8-sig') as handle:
        writer=csv.DictWriter(handle,fieldnames=fields);writer.writeheader();writer.writerows([{key:p.get(key) for key in fields} for p in ranked])
    print(json.dumps({'level':args.level,'area':args.area,'villages':len(selected),'records':len(records),'polygons':len(geo['features'])}))

if __name__=='__main__':main()
