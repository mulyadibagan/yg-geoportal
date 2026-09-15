#!/usr/bin/env python3
"""Build the tiny intervention-village supplement used at WebGIS startup."""
import json
from pathlib import Path

root=Path(__file__).resolve().parents[1]
source=root/'data'/'batas_administrasi_desa_riau.geojson'
target=root/'data'/'merempan-hulu-boundary.geojson'
data=json.loads(source.read_text(encoding='utf-8'))
features=[]
for feature in data.get('features',[]):
    properties=feature.get('properties') or {}
    name=str(properties.get('WADMKD') or properties.get('NAMOBJ') or '').strip().lower()
    if name=='merempan hulu':
        features.append(feature)
if not features:
    raise RuntimeError('Batas Desa Merempan Hulu tidak ditemukan')
target.write_text(json.dumps({'type':'FeatureCollection','features':features},ensure_ascii=False,separators=(',',':')),encoding='utf-8')
print(json.dumps({'features':len(features),'target':str(target)},ensure_ascii=False))
