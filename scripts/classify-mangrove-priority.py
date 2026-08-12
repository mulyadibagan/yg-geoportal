#!/usr/bin/env python3
"""Assign deterministic priority classes and ranks to candidate polygons."""
import csv,hashlib,json,math
from pathlib import Path
from pyproj import Transformer
from shapely.geometry import shape
from shapely.ops import transform

ROOT=Path(__file__).resolve().parents[1]
GEO=ROOT/'data'/'mangrove-priority-candidates.geojson'
SUMMARY=ROOT/'data'/'mangrove-priority-results.json'
CSV=ROOT/'data'/'mangrove-priority-ranking.csv'
METHOD='mangrove-priority-2016-2025-v0.1'

def area_ha(geometry):
    geom=shape(geometry); zone=32600+int((geom.centroid.x+180)//6)+1
    projected=transform(Transformer.from_crs(4326,zone,always_xy=True).transform,geom)
    return projected.area/10000

def classify(need,suitability,risk,area,confidence):
    if confidence=='rendah': return 'U','Data belum memadai','Keyakinan data rendah.'
    if area<0.05: return 'X','Tidak direkomendasikan','Area terlalu kecil dan terisolasi untuk diprioritaskan.'
    if risk>=70: return 'P4','Perlindungan pantai dahulu','Risiko ketidakstabilan pesisir relatif tinggi.'
    if need>=65 and suitability>=70: return 'P1','Penanaman aktif','Kebutuhan dan kelayakan relatif tinggi.'
    if suitability>=68: return 'P2','Regenerasi alami terbantu','Kondisi biofisik relatif mendukung pemulihan vegetasi.'
    if suitability>=48: return 'P3','Pemulihan hidrologi','Kelayakan sedang; konektivitas pasang surut perlu dipulihkan.'
    return 'P5','Perlindungan mangrove eksisting','Penambahan tanam bukan tindakan utama pada kondisi ini.'

def main():
    geo=json.loads(GEO.read_text(encoding='utf-8')); summary=json.loads(SUMMARY.read_text(encoding='utf-8'))
    villages={r['id']:r for r in summary['villages']}
    rows=[]
    for feature in geo['features']:
        p=feature['properties']; village=villages[p['id']]; area=area_ha(feature['geometry'])
        village_need=int(village['needScore']); village_suitability=int(village['suitabilityScore'])
        loss=float(village['indicativeMangroveLossHa']); current=float(village['currentMangroveHa'])
        need=min(100,round(village_need+min(18,area*1.2)))
        suitability=max(0,round(village_suitability-min(28,area*1.4)))
        risk=min(100,round(20+min(55,loss*.42)+min(25,area*1.5)+15*(1-village_suitability/100)))
        priority=round(.45*need+.35*suitability+.20*(100-risk),1)
        code,label,reason=classify(need,suitability,risk,area,village['confidence'])
        centroid=shape(feature['geometry']).centroid
        token=f"{p['id']}|{centroid.x:.6f}|{centroid.y:.6f}|{area:.4f}"
        polygon_id='MPR-'+hashlib.sha1(token.encode()).hexdigest()[:10].upper()
        p.update(polygonId=polygon_id,methodVersion=METHOD,areaHa=round(area,3),needScore=need,
            suitabilityScore=suitability,riskScore=risk,priorityScore=priority,priorityClass=code,
            priorityLabel=label,decisionReason=reason)
        rows.append(p)
    rows.sort(key=lambda r:(-r['priorityScore'],-r['areaHa'],r['polygonId']))
    for index,row in enumerate(rows,1): row['overallRank']=index
    village_groups={}
    for row in rows: village_groups.setdefault(row['id'],[]).append(row)
    for group in village_groups.values():
        for index,row in enumerate(group,1): row['villageRank']=index
    lookup={r['polygonId']:r for r in rows}
    for feature in geo['features']: feature['properties'].update(lookup[feature['properties']['polygonId']])
    geo['methodVersion']=METHOD; geo['name']='Prioritas Rehabilitasi Mangrove 2016–2025'
    geo['features'].sort(key=lambda f:f['properties']['overallRank'])
    for village_id,record in villages.items():
        group=village_groups.get(village_id,[]); record['methodVersion']=METHOD
        record['priorityPolygonCount']=len(group); record['priorityAreaHa']=round(sum(x['areaHa'] for x in group),2)
        record['priorityClasses']={code:sum(1 for x in group if x['priorityClass']==code) for code in ('P1','P2','P3','P4','P5','X','U')}
        record['topPriorityScore']=max((x['priorityScore'] for x in group),default=None)
    summary['methodVersion']=METHOD; summary['product']='Prioritas Rehabilitasi Mangrove 2016–2025'
    summary['description']='Hasil analisis penginderaan jauh, kondisi pesisir, dan data lingkungan yang tersedia.'
    GEO.write_text(json.dumps(geo,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    SUMMARY.write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf-8')
    fields=['overallRank','villageRank','polygonId','village','district','regency','areaHa','priorityClass','priorityLabel','priorityScore','needScore','suitabilityScore','riskScore','confidence','decisionReason','methodVersion']
    with CSV.open('w',newline='',encoding='utf-8-sig') as handle:
        writer=csv.DictWriter(handle,fieldnames=fields);writer.writeheader();writer.writerows([{k:r.get(k) for k in fields} for r in rows])
    print(json.dumps({'polygons':len(rows),'areaHa':round(sum(x['areaHa'] for x in rows),2),'classes':{c:sum(1 for x in rows if x['priorityClass']==c) for c in ('P1','P2','P3','P4','P5','X','U')}},ensure_ascii=False))
if __name__=='__main__':main()
