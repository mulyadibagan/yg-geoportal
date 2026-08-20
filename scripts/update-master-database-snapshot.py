#!/usr/bin/env python3
"""Refresh cacheable public snapshots for WebGIS and the Home dashboard."""
import argparse
import json
import urllib.request
from datetime import datetime,timezone
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
URL='https://script.google.com/macros/s/AKfycbxUe4QyBvSiL9UJsL-nsJ5XrohDabwqhYYR9q5CTgLYiW1ZCfVy429iMlpU-lCDUSvvRg/exec?page=objects'
PUBLIC_REPORTS_URL=URL.replace('page=objects','page=public-reports')
PREPOST_URL=URL.replace('page=objects','page=prepost-live-summary&scope=active')

def fetch_json(url):
    request=urllib.request.Request(url,headers={'User-Agent':'YG-GeoPortal-Snapshot/2.0'})
    with urllib.request.urlopen(request,timeout=90) as response:
        return json.load(response)

def load_source(source_path):
    if source_path:
        return json.loads(Path(source_path).read_text(encoding='utf-8'))
    return fetch_json(URL)

def load_capacity_sources(local_source):
    dashboard_target=ROOT/'data'/'dashboard-summary-snapshot.json'
    if local_source and dashboard_target.exists():
        current=json.loads(dashboard_target.read_text(encoding='utf-8'))
        cached=current.get('capacitySources')
        if isinstance(cached,dict):
            return cached
    reports=fetch_json(PUBLIC_REPORTS_URL)
    features=reports.get('features') if isinstance(reports,dict) else []
    relevant=[]
    for feature in features or []:
        properties=feature.get('properties') if isinstance(feature,dict) else {}
        report_type=str((properties or {}).get('reportType') or '')
        target=str((properties or {}).get('targetFeatureProperties') or '')
        if report_type=='Capacity Building' or any(
            key in target for key in ('Jumlah_Peserta','Peserta','participants')
        ):
            relevant.append(feature)
    return {
        'reports':{'type':'FeatureCollection','features':relevant},
        'prepost':fetch_json(PREPOST_URL)
    }

def write_if_changed(target,payload,volatile_keys):
    comparable=dict(payload)
    for key in volatile_keys:
        comparable.pop(key,None)
    if target.exists():
        previous=json.loads(target.read_text(encoding='utf-8'))
        for key in volatile_keys:
            previous.pop(key,None)
        if previous==comparable:
            return False
    target.write_text(json.dumps(payload,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    return True

parser=argparse.ArgumentParser()
parser.add_argument('--source',help='Use a local FeatureCollection instead of the public endpoint')
args=parser.parse_args()
data=load_source(args.source)
if not isinstance(data,dict) or not isinstance(data.get('features'),list):
    raise RuntimeError('Master Database response is not a GeoJSON FeatureCollection')
snapshot_generated_at=datetime.now(timezone.utc).isoformat()
capacity_sources=load_capacity_sources(args.source)
data['snapshotGeneratedAt']=snapshot_generated_at
master_target=ROOT/'data'/'master-database-snapshot.json'
master_changed=write_if_changed(master_target,data,('snapshotGeneratedAt',))

# Home uses all public properties for programme/donor cards, but no geometry.
dashboard_data={
    'type':'FeatureCollection','dashboardSnapshotVersion':1,
    'generatedAt':data.get('generatedAt') or snapshot_generated_at,
    'snapshotGeneratedAt':snapshot_generated_at,
    'featureCount':len(data['features']),
    'source':'YG_MASTER_DATABASE_PUBLIC_SNAPSHOT',
    'capacitySources':capacity_sources,
    'features':[{'type':'Feature','properties':feature.get('properties') or {}}
                for feature in data['features'] if isinstance(feature,dict)]
}
dashboard_target=ROOT/'data'/'dashboard-summary-snapshot.json'
dashboard_changed=write_if_changed(dashboard_target,dashboard_data,('snapshotGeneratedAt',))
print(json.dumps({'features':len(data['features']),
    'master':{'target':str(master_target),'changed':master_changed},
    'dashboard':{'target':str(dashboard_target),'changed':dashboard_changed}},ensure_ascii=False))
