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

def load_capacity_sources(local_source,reports=None):
    dashboard_target=ROOT/'data'/'dashboard-summary-snapshot.json'
    if local_source and dashboard_target.exists():
        current=json.loads(dashboard_target.read_text(encoding='utf-8'))
        cached=current.get('capacitySources')
        if isinstance(cached,dict):
            return cached
    reports=reports or fetch_json(PUBLIC_REPORTS_URL)
    return {
        # Simpan seluruh laporan publik sebagai satu sumber kanonik. Setiap
        # halaman melakukan filter jenis laporan dari snapshot yang sama.
        'reports':reports,
        'prepost':fetch_json(PREPOST_URL)
    }

def report_audit(data,reports,snapshot_generated_at):
    report_features=(reports or {}).get('features') or []
    master_features=data.get('features') or []
    report_types={}
    monitoring=[]
    survival_mismatches=[]
    reporter_names=set()
    for feature in report_features:
        props=(feature or {}).get('properties') or {}
        report_type=str(props.get('reportType') or 'Tanpa jenis').strip()
        report_types[report_type]=report_types.get(report_type,0)+1
        if report_type.lower()!='monitoring':
            continue
        monitoring.append(feature)
        reporter=str(props.get('reporterName') or '').strip()
        if reporter:
            reporter_names.add(reporter.casefold())
        proposed=props.get('proposedInformation') or {}
        if isinstance(proposed,str):
            try: proposed=json.loads(proposed)
            except json.JSONDecodeError: proposed={}
        alive_number=proposed.get('aliveCount')
        dead_number=proposed.get('deadOrDamagedCount')
        survival_number=proposed.get('survivalPercent')
        try:
            alive=float(str(alive_number).replace(',','.'))
            dead=float(str(dead_number).replace(',','.'))
            reported=float(str(survival_number).replace(',','.'))
        except (TypeError,ValueError):
            continue
        if alive+dead<=0:
            continue
        calculated=alive/(alive+dead)*100
        if abs(reported-calculated)>1:
            survival_mismatches.append({
                'reportId':props.get('reportId'),'reported':reported,
                'calculated':round(calculated,2),'alive':alive,'dead':dead
            })
    master_report_ids={
        str(((feature or {}).get('properties') or {}).get('Source_Report_ID') or '').strip()
        for feature in master_features
    }
    monitoring_ids={
        str(((feature or {}).get('properties') or {}).get('reportId') or '').strip()
        for feature in monitoring
    }
    return {
        'generatedAt':snapshot_generated_at,
        'status':'pass' if monitoring_ids.issubset(master_report_ids) else 'review',
        'publicReports':len(report_features),'reportTypes':report_types,
        'monitoring':{
            'reports':len(monitoring),'reporters':len(reporter_names),
            'presentInMasterSnapshot':len(monitoring_ids & master_report_ids),
            'missingFromMasterSnapshot':sorted(monitoring_ids-master_report_ids),
            'survivalFormula':'alive / (alive + deadOrDamaged) * 100',
            'survivalReconciliations':survival_mismatches,
            'displayPolicy':'calculated survival is authoritative when alive and dead/damaged are available'
        }
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
public_reports=None if args.source else fetch_json(PUBLIC_REPORTS_URL)
if public_reports:
    report_by_id={
        str((feature.get('properties') or {}).get('reportId') or '').strip():
        (feature.get('properties') or {})
        for feature in public_reports.get('features') or [] if isinstance(feature,dict)
    }
    for feature in data['features']:
        properties=feature.get('properties') if isinstance(feature,dict) else None
        if not isinstance(properties,dict):
            continue
        report_id=str(properties.get('reportId') or properties.get('Source_Report_ID') or '').strip()
        report=report_by_id.get(report_id)
        if not report:
            continue
        for key in ('reporterName','organization','targetFeatureProperties'):
            if report.get(key) not in (None,''):
                properties[key]=report[key]
capacity_sources=load_capacity_sources(args.source,public_reports)
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
audit_target=ROOT/'data'/'report-data-audit.json'
audit_payload=report_audit(data,public_reports or capacity_sources.get('reports') or {},snapshot_generated_at)
audit_changed=write_if_changed(audit_target,audit_payload,('generatedAt',))
print(json.dumps({'features':len(data['features']),
    'master':{'target':str(master_target),'changed':master_changed},
    'dashboard':{'target':str(dashboard_target),'changed':dashboard_changed},
    'audit':{'target':str(audit_target),'changed':audit_changed,'status':audit_payload['status']}},ensure_ascii=False))
