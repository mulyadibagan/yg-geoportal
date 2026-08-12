#!/usr/bin/env python3
"""Remove OpenStreetMap road corridors from mangrove-priority candidates."""
import json,time,urllib.parse,urllib.request
from pathlib import Path
from pyproj import Transformer
from shapely.geometry import LineString,MultiLineString,mapping,shape
from shapely.ops import transform,unary_union

ROOT=Path(__file__).resolve().parents[1]
GEO=ROOT/'data'/'mangrove-priority-candidates.geojson'
SUMMARY=ROOT/'data'/'mangrove-priority-results.json'
CACHE=ROOT/'data'/'mangrove-priority-roads-osm.geojson'
ENDPOINTS=['https://overpass-api.de/api/interpreter','https://overpass.kumi.systems/api/interpreter']
BUFFERS={'motorway':30,'trunk':25,'primary':22,'secondary':18,'tertiary':15,'residential':12,'service':10,'unclassified':12,'living_street':10,'track':8,'path':5,'footway':4}

def fetch(bbox):
    s,w,n,e=bbox;query=f'[out:json][timeout:120];way["highway"]({s},{w},{n},{e});out geom;'
    data=urllib.parse.urlencode({'data':query}).encode();last=None
    for endpoint in ENDPOINTS:
        try:
            req=urllib.request.Request(endpoint,data=data,headers={'User-Agent':'YG-GeoPortal/1.0'})
            with urllib.request.urlopen(req,timeout=180) as response:return json.loads(response.read())
        except Exception as exc:last=exc;time.sleep(2)
    raise last

def main():
    geo=json.loads(GEO.read_text(encoding='utf-8')); summary=json.loads(SUMMARY.read_text(encoding='utf-8'))
    groups={}
    for feature in geo['features']: groups.setdefault(feature['properties']['id'],[]).append(shape(feature['geometry']))
    elements={}
    for village_id,geometries in groups.items():
        minx,miny,maxx,maxy=unary_union(geometries).bounds
        raw=fetch((miny-.005,minx-.005,maxy+.005,maxx+.005))
        for element in raw.get('elements',[]): elements[element['id']]=element
        print(village_id,len(raw.get('elements',[])),flush=True)
    road_features=[]
    for element in elements.values():
        coords=[(p['lon'],p['lat']) for p in element.get('geometry',[])]
        if len(coords)<2:continue
        road_features.append({'type':'Feature','properties':{'osmId':element['id'],'highway':element.get('tags',{}).get('highway'),'name':element.get('tags',{}).get('name')},'geometry':mapping(LineString(coords))})
    CACHE.write_text(json.dumps({'type':'FeatureCollection','source':'OpenStreetMap contributors via Overpass','features':road_features},ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    output=[]; removed=0
    for feature in geo['features']:
        geom=shape(feature['geometry']);zone=32600+int((geom.centroid.x+180)//6)+1
        forward=Transformer.from_crs(4326,zone,always_xy=True).transform; inverse=Transformer.from_crs(zone,4326,always_xy=True).transform
        projected=transform(forward,geom); nearby=[]
        for road in road_features:
            line=shape(road['geometry'])
            if not line.bounds[2]<geom.bounds[0] and not line.bounds[0]>geom.bounds[2] and not line.bounds[3]<geom.bounds[1] and not line.bounds[1]>geom.bounds[3]:
                width=BUFFERS.get(road['properties']['highway'],8);nearby.append(transform(forward,line).buffer(width))
        cleaned=projected.difference(unary_union(nearby)) if nearby else projected
        parts=list(cleaned.geoms) if hasattr(cleaned,'geoms') else [cleaned]
        for part in parts:
            area=part.area/10000
            if part.is_empty or area<.05:continue
            clone={'type':'Feature','properties':dict(feature['properties']),'geometry':mapping(transform(inverse,part))}
            clone['properties']['areaHa']=round(area,3);clone['properties']['roadExclusion']='OpenStreetMap road corridors buffered 4–30 m';output.append(clone)
        removed+=max(0,projected.area-cleaned.area)/10000
    geo['features']=output;geo['roadExclusionSource']='© OpenStreetMap contributors via Overpass';geo['roadExclusionAreaHa']=round(removed,2)
    GEO.write_text(json.dumps(geo,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    by_village={}
    for f in output:by_village.setdefault(f['properties']['id'],[]).append(f['properties']['areaHa'])
    for record in summary['villages']:
        areas=by_village.get(record['id'],[]);record['roadFilteredAreaHa']=round(sum(areas),2);record['roadFilteredPolygonCount']=len(areas)
    summary['roadExclusionSource']='© OpenStreetMap contributors via Overpass';summary['roadExclusionAreaHa']=round(removed,2)
    SUMMARY.write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({'roads':len(road_features),'polygonsBefore':len(geo.get('features',[])),'polygonsAfter':len(output),'roadExcludedHa':round(removed,2),'remainingHa':round(sum(f['properties']['areaHa'] for f in output),2)}))
if __name__=='__main__':main()
