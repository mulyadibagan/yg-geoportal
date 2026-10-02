"""Retain document-backed monitoring updates across scheduled source refreshes."""
import copy
import json

def merge_monitoring_supplemental(collection, root):
    path = root / 'data' / 'monitoring-supplemental.json'
    if not path.exists():
        return collection
    additions = json.loads(path.read_text(encoding='utf-8'))['features']
    ids = {f['properties']['reportId'] for f in additions}
    collection['features'] = [f for f in collection.get('features', [])
        if (f.get('properties') or {}).get('reportId') not in ids] + copy.deepcopy(additions)
    if 'featureCount' in collection:
        collection['featureCount'] = len(collection['features'])
    return collection
