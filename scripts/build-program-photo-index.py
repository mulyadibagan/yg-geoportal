#!/usr/bin/env python3
"""Build a compact Object_ID -> verified web photo URL index."""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LAYERS = (
    'apo', 'area_mangrove', 'mineral_land_restoration_area',
    'titik_penanaman', 'fdrs', 'kopi', 'area_kopi',
    'nursery_mangrove', 'sekat_kanal'
)
URL_PATTERN = re.compile(r'https?://[^\s,]+', re.I)
index = {}

for layer in LAYERS:
    path = ROOT / 'data' / f'{layer}.geojson'
    if not path.exists():
        continue
    data = json.loads(path.read_text(encoding='utf-8'))
    for feature in data.get('features', []):
        props = feature.get('properties') or {}
        object_id = str(props.get('Object_ID') or props.get('objectId') or '').strip()
        if not object_id:
            continue
        urls = []
        for key in ('Foto', 'Foto_2', 'photos'):
            value = props.get(key)
            values = value if isinstance(value, list) else [value]
            for item in values:
                if not item:
                    continue
                urls.extend(URL_PATTERN.findall(str(item)))
        if urls:
            index[object_id] = list(dict.fromkeys(urls))

target = ROOT / 'data' / 'program-photo-index.json'
target.write_text(
    json.dumps(index, ensure_ascii=False, separators=(',', ':')),
    encoding='utf-8'
)
print(json.dumps({'objects': len(index), 'target': str(target)}, ensure_ascii=False))
