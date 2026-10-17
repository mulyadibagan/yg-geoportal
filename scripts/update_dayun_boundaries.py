"""Apply an audited WGS84 shapefile conversion, preserving census join IDs.

Convert the supplied SHP with mapshaper -proj wgs84 first. Only the map and
block geometry outputs are writable; this module never opens the census file.
"""
import argparse
import copy
import hashlib
import json
from collections import Counter, defaultdict
from pathlib import Path

from pyproj import Transformer
from shapely.geometry import mapping, shape
from shapely.ops import transform, unary_union


PROJECT = Transformer.from_crs(4326, 32648, always_xy=True).transform


def revise(old, revised, blocks, provenance):
    groups = defaultdict(list)
    for index, feature in enumerate(revised['features'], 1):
        p = feature['properties']
        if p['Informasi'] not in ('Gawangan Tanam', 'Gawangan mati', 'Infrastructure'):
            raise ValueError('unknown_boundary_category')
        if p['Blok'] not in [f'Blok {b}' for b in 'ABCDEF']:
            raise ValueError('missing_official_block')
        geom = shape(feature['geometry'])
        if not geom.is_valid or geom.is_empty or geom.geom_type not in ('Polygon', 'MultiPolygon'):
            raise ValueError('invalid_source_geometry')
        if not (101 < geom.bounds[0] < geom.bounds[2] < 103 and 0 < geom.bounds[1] < geom.bounds[3] < 2):
            raise ValueError('unexpected_dayun_coordinates')
        key = f"GT-{p['Blok'][-1]}-{int(p['Gawangan']):02}" if p['Informasi'] == 'Gawangan Tanam' else p['Informasi'] + '/' + p['Blok']
        groups[key].append((index, feature))
    previous = defaultdict(list)
    for f in old['features']:
        if f['properties']['category'] == 'Gawangan Tanam':
            previous[f['properties']['sourceGawanganId']].append(f)
    if set(previous) != {k for k in groups if k.startswith('GT-')}:
        raise ValueError('census_join_ids_changed')
    result = copy.deepcopy(old)
    result['features'] = []
    result['boundaryRevision'] = provenance
    audit = []
    for key, items in sorted(groups.items()):
        items.sort(key=lambda i: (shape(i[1]['geometry']).centroid.y, shape(i[1]['geometry']).centroid.x))
        united = unary_union([shape(f['geometry']) for _, f in items])
        total = round(transform(PROJECT, united).area / 10000, 4)
        if key in previous:
            before = unary_union([shape(f['geometry']) for f in previous[key]])
            audit.append({'id': key, 'before_ha': round(transform(PROJECT, before).area / 10000, 4), 'after_ha': total,
                          'added_m2': round(transform(PROJECT, united.difference(before)).area, 3),
                          'removed_m2': round(transform(PROJECT, before.difference(united)).area, 3)})
        for part, (record, f) in enumerate(items, 1):
            src = f['properties']; block = src['Blok'][-1]; category = src['Informasi']
            if key in previous:
                closest = max(previous[key], key=lambda x: shape(x['geometry']).intersection(shape(f['geometry'])).area)
                p = copy.deepcopy(closest['properties'])
                p.update(sourcePartIndex=part, sourcePartCount=len(items), sourceGawanganAreaHa=total,
                         featureId=f'DAYUN-{key}-P{part:02}', sourceGawangan=str(int(src['Gawangan'])))
            else:
                zone = f'GM-{block}-P{part:03}' if category == 'Gawangan mati' else f'INFRA-{block}-P{part:03}'
                p = dict(objectId='DAYUN-' + zone, featureId='DAYUN-' + zone, name=category + ' ' + src['Blok'],
                         category=category, layerId='agroforestry', color='#b9834e' if category == 'Gawangan mati' else '#788891',
                         publicDetail=False, monitoringEnabled=False, sourceZoneId=zone)
            p.update(block=src['Blok'], areaHa=round(transform(PROJECT, shape(f['geometry'])).area / 10000, 4),
                     source='Jaluran_Rev.shp', sourceCrs='EPSG:32648', sourceRecord=record,
                     sourceFeatureCount=1, sourceReceivedFile=provenance['archive_name'],
                     sourceReceivedDate=provenance['received_date'], boundaryRevision=provenance['id'])
            result['features'].append({'type': 'Feature', 'properties': p, 'geometry': f['geometry']})
    counts = Counter(f['properties']['block'] for f in result['features'] if f['properties']['category'] == 'Gawangan Tanam')
    active_count = sum(counts.values())
    result['numbering'].update(sourceCoverage=f'{active_count} poligon Gawangan Tanam; 60 ID gawangan unik pada Blok A–F', featureCount=active_count)
    updated_blocks = copy.deepcopy(blocks)
    updated_blocks.update(datasetVersion=provenance['id'], boundaryRevision=provenance)
    for feature in updated_blocks['features']:
        p = feature['properties']
        union = unary_union([shape(f['geometry']) for f in result['features'] if f['properties']['block'] == p['name']])
        feature['geometry'] = mapping(union)
        p['areaHa'] = round(transform(PROJECT, union).area / 10000, 4)
    updated_blocks['totalAreaHa'] = round(sum(f['properties']['areaHa'] for f in updated_blocks['features']), 4)
    return result, updated_blocks, {'revision': provenance, 'gawangan': audit, 'census_join_ids_preserved': True, 'census_changed': False}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--revised', required=True)
    parser.add_argument('--archive', required=True)
    parser.add_argument('--received-date', required=True)
    parser.add_argument('--map', default='data/dayun-map.geojson')
    parser.add_argument('--blocks', default='data/dayun-blocks.geojson')
    parser.add_argument('--audit', required=True)
    args = parser.parse_args()
    sha = hashlib.sha256(Path(args.archive).read_bytes()).hexdigest()
    provenance = dict(id='dayun-boundaries-' + sha[:16], archive_name=Path(args.archive).name,
                      archive_sha256=sha, converted_geojson_sha256=hashlib.sha256(Path(args.revised).read_bytes()).hexdigest(),
                      received_date=args.received_date, source_crs='EPSG:32648', output_crs='EPSG:4326')
    load = lambda p: json.loads(Path(p).read_text(encoding='utf-8'))
    result, blocks, audit = revise(load(args.map), load(args.revised), load(args.blocks), provenance)
    for path, value in [(args.map, result), (args.blocks, blocks), (args.audit, audit)]:
        Path(path).write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
