"""Clip satellite indications to the portal's Riau boundary and allocate by village."""
import json
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from pyproj import Transformer
from shapely.geometry import shape, mapping
from shapely.ops import unary_union, transform
from shapely.strtree import STRtree

ROOT = Path(__file__).resolve().parents[1]

def polygonal(geom):
    if not geom.is_valid:
        geom = geom.buffer(0)
    if geom.geom_type in ('Polygon', 'MultiPolygon'):
        return geom
    return unary_union([polygonal(g) for g in getattr(geom, 'geoms', []) if g.geom_type in ('Polygon', 'MultiPolygon', 'GeometryCollection')])

class RiauGeography:
    def __init__(self):
        province = json.loads((ROOT / 'data/batas_provinsi_riau_dissolve.geojson').read_text())
        self.boundary = unary_union([polygonal(shape(f['geometry'])) for f in province['features']])
        if self.boundary.is_empty:
            raise ValueError('Missing Riau boundary')
        villages = json.loads((ROOT / 'data/batas_administrasi_desa_riau.geojson').read_text())
        self.rows = []
        for f in villages['features']:
            p = f['properties']
            if str(p.get('WADMPR') or p.get('NAMA_PROP') or '').strip().lower() != 'riau':
                continue
            g = polygonal(shape(f['geometry']))
            if not g.is_empty:
                self.rows.append((g, {'village': p.get('WADMKD') or p.get('NAMOBJ') or '', 'district': p.get('WADMKC') or '', 'regency': p.get('WADMKK') or ''}))
        if not self.rows:
            raise ValueError('Missing Riau villages')
        self.tree = STRtree([r[0] for r in self.rows])
        self.project = Transformer.from_crs(4326, 32647, always_xy=True).transform

    def area(self, geom):
        return transform(self.project, geom).area / 10000

    def clip(self, features):
        grouped = defaultdict(list)
        for f in features:
            grouped[f['properties']['eventId']].append(f)
        output = []
        for event_id, parts in grouped.items():
            g = polygonal(unary_union([polygonal(shape(f['geometry'])) for f in parts]).intersection(self.boundary))
            if g.is_empty or self.area(g) < .5:
                continue
            p = dict(parts[0]['properties'])
            remaining, allocations = g, []
            # Stable order; overlapping village references cannot double-count area.
            for i in sorted(self.tree.query(g).tolist()):
                village, identity = self.rows[i]
                piece = polygonal(remaining.intersection(village))
                if piece.is_empty or self.area(piece) < 1e-8:
                    continue
                allocations.append(dict(identity, areaHa=round(self.area(piece), 6)))
                remaining = polygonal(remaining.difference(village))
            p.update(estimatedAreaHa=round(self.area(g), 2), province='Riau', villageAreas=allocations,
                     unassignedAreaHa=round(self.area(remaining), 6),
                     villages=sorted({a['village'] for a in allocations if a['village']}),
                     districts=sorted({a['district'] for a in allocations if a['district']}),
                     regencies=sorted({a['regency'] for a in allocations if a['regency']}))
            output.append({'type': 'Feature', 'properties': p, 'geometry': mapping(g)})
        return output

def apply_geography(payload, summary, geography=None):
    geography = geography or RiauGeography()
    before = len({f['properties']['eventId'] for f in payload['features']})
    payload['features'] = geography.clip(payload['features'])
    props = [f['properties'] for f in payload['features']]
    now = datetime.now(timezone.utc).isoformat()
    metadata = {'province': 'Riau', 'boundarySource': 'data/batas_provinsi_riau_dissolve.geojson',
                'villageSource': 'data/batas_administrasi_desa_riau.geojson', 'spatiallyClipped': True,
                'areaCrs': 'EPSG:32647', 'administrativeUpdatedAt': now}
    payload.update(metadata)
    summary.update(metadata, eventCount=len(props), estimatedAreaHa=round(sum(p['estimatedAreaHa'] for p in props), 2),
                   unassignedAreaHa=round(sum(p['unassignedAreaHa'] for p in props), 2))
    summary.setdefault('processing', {})['published'] = len(props)
    summary['processing']['excludedByRiauBoundary'] = before - len(props)
    for field, keys in [('villageTotals', ('regency', 'district', 'village')), ('districtTotals', ('regency', 'district')), ('regencyTotals', ('regency',))]:
        totals = defaultdict(float)
        for p in props:
            for a in p['villageAreas']:
                totals[tuple(a[k] for k in keys)] += a['areaHa']
        summary[field] = [dict(zip(keys, key), areaHa=round(value, 2)) for key, value in sorted(totals.items())]
    return payload, summary

if __name__ == '__main__':
    output = ROOT / 'data/burned-area-estimates.geojson'
    summary_path = ROOT / 'data/burned-area-summary.json'
    payload, summary = apply_geography(json.loads(output.read_text()), json.loads(summary_path.read_text()))
    output.write_text(json.dumps(payload, ensure_ascii=False, separators=(',', ':')))
    summary_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2))
    print(json.dumps({'events': summary['eventCount'], 'areaHa': summary['estimatedAreaHa'], 'villages': len(summary['villageTotals']), 'unassignedAreaHa': summary['unassignedAreaHa']}))
