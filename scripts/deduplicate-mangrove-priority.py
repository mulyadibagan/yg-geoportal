#!/usr/bin/env python3
"""Remove duplicate administrative village aliases from all working outputs."""
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
ALIASES={'kelapapati':'kelapa-pati'}

def load(name):
    path=ROOT/'data'/name
    return path,json.loads(path.read_text(encoding='utf-8'))

def write(path,data,compact=False):
    path.write_text(json.dumps(data,ensure_ascii=False,indent=None if compact else 2,separators=(',',':') if compact else None),encoding='utf-8')

def main():
    removed={}
    path,foundation=load('mangrove-priority-intervention.json')
    before=len(foundation['villages']);foundation['villages']=[v for v in foundation['villages'] if v['id'] not in ALIASES]
    removed['villages']=before-len(foundation['villages']);write(path,foundation)

    path,summary=load('mangrove-priority-results.json')
    before=len(summary['villages']);summary['villages']=[v for v in summary['villages'] if v['id'] not in ALIASES]
    removed['summaryRows']=before-len(summary['villages']);write(path,summary)

    path,geo=load('mangrove-priority-candidates.geojson')
    before=len(geo['features']);geo['features']=[f for f in geo['features'] if f.get('properties',{}).get('id') not in ALIASES]
    removed['polygons']=before-len(geo['features']);write(path,geo,True)

    path,progress=load('mangrove-priority-progress.json')
    for alias in ALIASES:progress.get('completed',{}).pop(alias,None);progress.get('failed',{}).pop(alias,None)
    valid={v['id'] for v in foundation['villages']};progress['totalVillages']=len(valid);progress['completedCount']=sum(i in valid for i in progress.get('completed',{}));write(path,progress)
    print(json.dumps(removed))

if __name__=='__main__':main()
