#!/usr/bin/env python3
"""Identify Riau village polygons that touch the OSM marine coastline."""
import argparse, json, zipfile
from datetime import datetime, timezone
from pathlib import Path

import shapefile
from pyproj import Transformer
from shapely.geometry import LineString, MultiLineString, mapping, shape
from shapely.ops import transform, unary_union

ROOT=Path(__file__).resolve().parents[1]
ADMIN=ROOT/'data'/'batas_administrasi_desa_riau.geojson'
INTERVENTIONS=ROOT/'data'/'intervention-villages.json'
DEFAULT_COAST=ROOT/'.coastal-cache'/'coastlines-split-4326.zip'
OUT_JSON=ROOT/'data'/'coastal-villages-riau.json'
OUT_GEOJSON=ROOT/'data'/'coastal-villages-riau.geojson'
RIAU_BBOX=(99.9,-1.4,104.2,3.1)
MAX_DISTANCE_M=250

def norm(value):
    return ' '.join(str(value or '').casefold().replace('-',' ').split())

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--coastline',type=Path,default=DEFAULT_COAST)
    args=parser.parse_args()
    admin=json.loads(ADMIN.read_text(encoding='utf-8'))
    interventions=json.loads(INTERVENTIONS.read_text(encoding='utf-8'))['villages']
    intervention_names={norm(v['name']) for v in interventions}
    intervention_names|={norm(v.get('sourceName')) for v in interventions if v.get('sourceName')}
    for v in interventions: intervention_names|={norm(x) for x in v.get('aliases',[])}

    reader=shapefile.Reader(str(args.coastline))
    coast_parts=[]
    for item in reader.iterShapes(bbox=RIAU_BBOX):
        points=item.points
        cuts=list(item.parts)+[len(points)]
        for start,end in zip(cuts,cuts[1:]):
            if end-start>=2: coast_parts.append(LineString(points[start:end]))
    coast=unary_union(coast_parts)
    project=Transformer.from_crs(4326,32647,always_xy=True).transform
    coast_projected=transform(project,coast)
    candidates=[]; features=[]
    for feature in admin.get('features',[]):
        props=feature.get('properties') or {}
        geom=shape(feature['geometry'])
        if not geom.bounds[2]>=RIAU_BBOX[0] or not geom.bounds[0]<=RIAU_BBOX[2]: continue
        distance=transform(project,geom).distance(coast_projected)
        if distance>MAX_DISTANCE_M: continue
        name=props.get('WADMKD') or props.get('NAMOBJ') or props.get('DESA') or 'Tanpa nama'
        district=props.get('WADMKC') or props.get('KECAMATAN')
        regency=props.get('WADMKK') or props.get('WIADKK') or props.get('KABUPATEN')
        is_intervention=norm(name) in intervention_names
        row={'village':name,'district':district,'regency':regency,'intervention':is_intervention,
             'coastlineDistanceM':round(distance,1),'status':'candidate'}
        candidates.append(row)
        copy={'type':'Feature','properties':dict(props),'geometry':feature['geometry']}
        copy['properties'].update({'Coastal_Candidate':True,'Coast_Distance_M':round(distance,1),'Intervention':is_intervention})
        features.append(copy)
    candidates.sort(key=lambda x:(str(x['regency']),str(x['district']),str(x['village'])))
    generated=datetime.now(timezone.utc).isoformat()
    summary={'schemaVersion':1,'generatedAt':generated,'source':'OpenStreetMap coastline via osmdata.openstreetmap.de',
             'method':'Village polygon within 250 m of OSM marine coastline; candidate list requires Sentinel-2 water-edge confirmation.',
             'candidateCount':len(candidates),'interventionCandidateCount':sum(x['intervention'] for x in candidates),'villages':candidates}
    OUT_JSON.write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf-8')
    OUT_GEOJSON.write_text(json.dumps({'type':'FeatureCollection','generatedAt':generated,'features':features},ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    print(json.dumps({'candidates':len(candidates),'interventions':summary['interventionCandidateCount'],'coastParts':len(coast_parts)},ensure_ascii=False))

if __name__=='__main__': main()
