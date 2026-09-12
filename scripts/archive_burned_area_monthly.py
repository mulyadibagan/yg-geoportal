"""Permanent monthly archive; a missing rolling-window event is never a deletion."""
import hashlib
import json
from datetime import datetime, timezone, timedelta
from pathlib import Path
from shapely.geometry import shape

ROOT = Path(__file__).resolve().parents[1]
ARCHIVE = ROOT / 'data/burned-area-monthly'

def merge_events(previous, incoming):
    events = dict(previous)
    used = set()
    for f in incoming:
        p = f['properties']
        first, last = p['firstDetection'], p['lastDetection']
        matches = [key for key, old in previous.items() if key not in used
                   if first <= old['properties']['lastDetection'] and last >= old['properties']['firstDetection']
                   and shape(f['geometry']).intersects(shape(old['geometry']))]
        if matches:
            geom = shape(f['geometry'])
            key = max(matches, key=lambda k: geom.intersection(shape(previous[k]['geometry'])).area / max(geom.union(shape(previous[k]['geometry'])).area, 1e-20))
            first = min(first, events[key]['properties']['firstDetection'])
            used.add(key)
        else:
            key = 'BA-' + hashlib.sha256((first + json.dumps(f['geometry'], sort_keys=True)).encode()).hexdigest()[:16]
        feature = json.loads(json.dumps(f))
        feature['properties'].update(archiveEventId=key, firstDetection=first)
        # WIB calendar month; the event is stored once even when it spans months.
        feature['properties']['reportMonth'] = datetime.fromisoformat(first.replace('Z', '+00:00')).astimezone(timezone(timedelta(hours=7))).strftime('%Y-%m')
        events[key] = feature
    return events

def build_archive():
    source = json.loads((ROOT / 'data/burned-area-estimates.geojson').read_text())
    if not source.get('spatiallyClipped') or source.get('province') != 'Riau':
        raise ValueError('Only Riau-clipped estimates may enter the archive')
    ARCHIVE.mkdir(parents=True, exist_ok=True)
    registry_path = ARCHIVE / 'events.json'
    previous = json.loads(registry_path.read_text()).get('events', {}) if registry_path.exists() else {}
    events = merge_events(previous, source['features'])
    registry_path.write_text(json.dumps({'schemaVersion': 1, 'events': events}, ensure_ascii=False, separators=(',', ':')))
    now = datetime.now(timezone.utc).isoformat()
    months = sorted({f['properties']['reportMonth'] for f in events.values()}, reverse=True)
    # Include previously archived months even if a revised first detection moves an event.
    old_index = ARCHIVE / 'index.json'
    if old_index.exists():
        months = sorted(set(months) | {r['month'] for r in json.loads(old_index.read_text())['reports']}, reverse=True)
    reports = []
    for month in months:
        features = [f for f in events.values() if f['properties']['reportMonth'] == month]
        total = round(sum(f['properties']['estimatedAreaHa'] for f in features), 2)
        payload = {'type': 'FeatureCollection', 'schemaVersion': 1, 'month': month, 'status': 'partial',
                   'generatedAt': now, 'sourceGeneratedAt': source.get('generatedAt'), 'province': 'Riau',
                   'assignment': 'firstDetectionAsiaJakarta', 'estimatedAreaHa': total,
                   'eventCount': len(features), 'features': features}
        (ARCHIVE / (month + '.geojson')).write_text(json.dumps(payload, ensure_ascii=False, separators=(',', ':')))
        reports.append({'month': month, 'status': 'partial', 'estimatedAreaHa': total, 'eventCount': len(features),
                        'data': 'data/burned-area-monthly/' + month + '.geojson'})
    old_index.write_text(json.dumps({'schemaVersion': 1, 'generatedAt': now, 'retention': 'permanent',
                                    'reports': reports}, ensure_ascii=False, indent=2))
    print(json.dumps(reports))

if __name__ == '__main__':
    build_archive()
