#!/usr/bin/env python3
"""Backfill one closed monthly hotspot report into the burned-area archive."""
import argparse
import json
from collections import Counter
from datetime import datetime, timedelta, timezone
from pathlib import Path

from pystac_client import Client

from archive_burned_area_monthly import ARCHIVE, build_archive, merge_events
from burned_area_geography import RiauGeography, apply_geography
from update_burned_area_estimates import analyse_event, cluster_hotspots

ROOT = Path(__file__).resolve().parents[1]


def hotspot_feature(row):
    properties = dict(row)
    properties.update(acq_date=row['date'], acq_time=row['time'])
    return {
        'type': 'Feature',
        'properties': properties,
        'geometry': {'type': 'Point', 'coordinates': [row['longitude'], row['latitude']]},
    }


def backfill(month):
    report_path = ROOT / 'data/fire-monthly' / f'{month}.json'
    report = json.loads(report_path.read_text())
    if report.get('status') != 'final':
        raise ValueError(f'{month} is not a final monthly hotspot report')
    current_month = datetime.now(timezone.utc).astimezone(timezone(timedelta(hours=7))).strftime('%Y-%m')
    if month >= current_month:
        raise ValueError('The current or a future month cannot be published')

    geography = RiauGeography()
    candidates = [hotspot_feature(row) for row in report.get('hotspots', [])]
    events = cluster_hotspots(candidates, geography)
    catalog = Client.open('https://planetarycomputer.microsoft.com/api/stac/v1')
    output, states = [], []
    for index, event in enumerate(events, 1):
        try:
            features, state = analyse_event(event, catalog, index)
            if features:
                output.extend(features)
            states.append(state)
        except Exception as exc:
            states.append({'status': 'processing-error', 'reason': str(exc)[:180]})

    payload = {
        'type': 'FeatureCollection', 'schemaVersion': 1,
        'generatedAt': datetime.now(timezone.utc).isoformat(),
        'title': f'Estimasi Area Terindikasi Terbakar Riau {month}',
        'method': 'Sentinel-2 dNBR/NBR with FIRMS candidate events',
        'disclaimer': 'Estimasi berbasis citra satelit; bukan hasil pengukuran atau verifikasi lapangan.',
        'features': output,
    }
    summary = {'processing': dict(Counter(x['status'] for x in states))}
    payload, summary = apply_geography(payload, summary, geography)

    ARCHIVE.mkdir(parents=True, exist_ok=True)
    registry_path = ARCHIVE / 'events.json'
    previous = json.loads(registry_path.read_text()).get('events', {}) if registry_path.exists() else {}
    registry_path.write_text(json.dumps({'schemaVersion': 1, 'events': merge_events(previous, payload['features'])},
                                        ensure_ascii=False, separators=(',', ':')))
    build_archive()
    print(json.dumps({'month': month, 'candidateEvents': len(events), 'states': states,
                      'publishedEvents': summary['eventCount'], 'estimatedAreaHa': summary['estimatedAreaHa']}))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('month', help='Closed report month in YYYY-MM format')
    args = parser.parse_args()
    backfill(args.month)
