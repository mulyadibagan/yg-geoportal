#!/usr/bin/env python3
"""Refresh the public, cacheable WebGIS snapshot from Apps Script."""
import json,urllib.request
from datetime import datetime,timezone
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
URL='https://script.google.com/macros/s/AKfycbxUe4QyBvSiL9UJsL-nsJ5XrohDabwqhYYR9q5CTgLYiW1ZCfVy429iMlpU-lCDUSvvRg/exec?page=objects'
request=urllib.request.Request(URL,headers={'User-Agent':'YG-GeoPortal-Snapshot/1.0'})
with urllib.request.urlopen(request,timeout=90) as response:
    data=json.load(response)
if not isinstance(data,dict) or not isinstance(data.get('features'),list):
    raise RuntimeError('Master Database response is not a GeoJSON FeatureCollection')
target=ROOT/'data'/'master-database-snapshot.json'
if target.exists():
    previous=json.loads(target.read_text(encoding='utf-8'))
    previous.pop('snapshotGeneratedAt',None)
    if previous==data:
        print(json.dumps({'features':len(data['features']),'target':str(target),'changed':False},ensure_ascii=False))
        raise SystemExit(0)
data['snapshotGeneratedAt']=datetime.now(timezone.utc).isoformat()
target.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
print(json.dumps({'features':len(data['features']),'target':str(target),'changed':True},ensure_ascii=False))
