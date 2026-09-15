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
PUBLIC_UPDATES_URL=URL.replace('page=objects','page=public-updates')

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

def attach_public_update_photos(data,updates):
    """Attach verified photos to their permanent object before public delivery."""
    by_id={
        str(((feature or {}).get('properties') or {}).get('Object_ID') or '').strip().casefold():
        (feature.get('properties') or {})
        for feature in data.get('features') or [] if isinstance(feature,dict)
    }
    attached_reports=[]
    for feature in (updates or {}).get('features') or []:
        props=(feature or {}).get('properties') or {}
        target=props.get('targetFeatureProperties') or {}
        if isinstance(target,str):
            try: target=json.loads(target)
            except json.JSONDecodeError: target={}
        object_id=str((target or {}).get('Object_ID') or props.get('Object_ID') or '').strip().casefold()
        target_props=by_id.get(object_id)
        photos=props.get('photos') or []
        if isinstance(photos,str): photos=[photos]
        photos=[str(value).strip() for value in photos if str(value).strip().startswith(('http://','https://'))]
        if not target_props or not photos: continue
        current=target_props.get('_ygPhotos') or []
        if isinstance(current,str): current=[current]
        target_props['_ygPhotos']=list(dict.fromkeys(current+photos))
        attached_reports.append(str(props.get('reportId') or '').strip())
    data['publicUpdateAudit']={
        'published':len((updates or {}).get('features') or []),
        'photosAttachedByPermanentObjectId':len(attached_reports),
        'attachedReportIds':attached_reports
    }
    return data

def report_audit(data,reports,updates,snapshot_generated_at):
    report_features=(reports or {}).get('features') or []
    master_features=data.get('features') or []
    report_types={}
    monitoring=[]
    survival_mismatches=[]
    reporter_names=set()
    completeness={key:[] for key in ('missingDate','missingLocation','missingReporter','missingPhotos','missingRawDonor')}
    for feature in report_features:
        props=(feature or {}).get('properties') or {}
        report_type=str(props.get('reportType') or 'Tanpa jenis').strip()
        report_id=str(props.get('reportId') or '').strip()
        report_types[report_type]=report_types.get(report_type,0)+1
        if not props.get('activityDate'):
            completeness['missingDate'].append(report_id)
        if not (props.get('locationName') or props.get('village')):
            completeness['missingLocation'].append(report_id)
        if not props.get('reporterName'):
            completeness['missingReporter'].append(report_id)
        if not props.get('photos'):
            completeness['missingPhotos'].append(report_id)
        proposed=props.get('proposedInformation') or {}
        if isinstance(proposed,str):
            try: proposed=json.loads(proposed)
            except json.JSONDecodeError: proposed={}
        capacity=proposed.get('capacityBuilding') or proposed if isinstance(proposed,dict) else {}
        target=props.get('targetFeatureProperties') or {}
        raw_donor=(capacity.get('donor') if isinstance(capacity,dict) else None) or \
            target.get('Donor') or target.get('Donor_Cluster') or target.get('Nama_Donor')
        if not raw_donor:
            completeness['missingRawDonor'].append(report_id)
        if report_type.lower()!='monitoring':
            continue
        monitoring.append(feature)
        reporter=str(props.get('reporterName') or '').strip()
        if reporter:
            reporter_names.add(reporter.casefold())
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
    point_features=[feature for feature in master_features
                    if ((feature or {}).get('geometry') or {}).get('type')=='Point']
    hidden_points=[feature for feature in point_features
                   if str(((feature or {}).get('properties') or {}).get('Layer_ID') or '')=='titik_desa']
    visible_points=[feature for feature in point_features if feature not in hidden_points]
    coordinate_groups={}
    for feature in visible_points:
        coordinates=((feature or {}).get('geometry') or {}).get('coordinates') or []
        if len(coordinates)<2: continue
        key='{:.7f},{:.7f}'.format(float(coordinates[0]),float(coordinates[1]))
        coordinate_groups.setdefault(key,[]).append(
            str(((feature or {}).get('properties') or {}).get('Object_ID') or ''))
    duplicate_points=[{'coordinates':key,'objectIds':ids} for key,ids in coordinate_groups.items() if len(ids)>1]
    update_features=(updates or {}).get('features') or []
    return {
        'generatedAt':snapshot_generated_at,
        'status':'pass' if monitoring_ids.issubset(master_report_ids) else 'review',
        'publicReports':len(report_features),'reportTypes':report_types,
        'completeness':{
            key:{'count':len(values),'reportIds':values}
            for key,values in completeness.items()
        },
        'monitoring':{
            'reports':len(monitoring),'reporters':len(reporter_names),
            'presentInMasterSnapshot':len(monitoring_ids & master_report_ids),
            'missingFromMasterSnapshot':sorted(monitoring_ids-master_report_ids),
            'survivalFormula':'alive / (alive + deadOrDamaged) * 100',
            'survivalReconciliations':survival_mismatches,
            'displayPolicy':'calculated survival is authoritative when alive and dead/damaged are available'
        },
        'map':{
            'totalFeatures':len(master_features),
            'pointFeatures':len(point_features),
            'visiblePointFeatures':len(visible_points),
            'hiddenAdministrativeCentroids':len(hidden_points),
            'exactCoordinateOverlaps':duplicate_points,
            'publicUpdates':len(update_features),
            'photosAttachedByPermanentObjectId':data.get('publicUpdateAudit',{}).get('photosAttachedByPermanentObjectId',0),
            'photoDeliveryPolicy':'permanent Object_ID photos are embedded in the Cloudflare object snapshot; legacy updates remain available through the compatibility index'
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
public_updates={'type':'FeatureCollection','features':[]} if args.source else fetch_json(PUBLIC_UPDATES_URL)
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
attach_public_update_photos(data,public_updates)
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
audit_payload=report_audit(data,public_reports or capacity_sources.get('reports') or {},public_updates,snapshot_generated_at)
audit_changed=write_if_changed(audit_target,audit_payload,('generatedAt',))
print(json.dumps({'features':len(data['features']),
    'master':{'target':str(master_target),'changed':master_changed},
    'dashboard':{'target':str(dashboard_target),'changed':dashboard_changed},
    'audit':{'target':str(audit_target),'changed':audit_changed,'status':audit_payload['status']}},ensure_ascii=False))
