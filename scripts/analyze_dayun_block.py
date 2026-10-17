"""Exploratory block crown proposals and boundary audit; never writes census data."""
import argparse
import bisect
import csv
import json
import hashlib
from pathlib import Path
import cv2
import numpy as np
import rasterio
from rasterio.features import geometry_mask, geometry_window
from rasterio.windows import Window, bounds
from rasterio.enums import Resampling
from shapely.geometry import shape, mapping, Point, box
from shapely.ops import unary_union, transform
from pyproj import Transformer
from PIL import Image
from propose_dayun_candidates import propose


def block_zones(features, block):
    groups = {}
    all_blocks = {}
    for f in features:
        p = f['properties']
        if p.get('category') != 'Gawangan Tanam':
            continue
        key = p.get('sourceGawanganId') or p.get('shortId')
        if key:
            groups.setdefault(key, []).append(shape(f['geometry']))
            all_blocks[key] = p.get('block', '')
    groups = {k: unary_union(v) for k, v in groups.items()}
    project = Transformer.from_crs(4326, 32648, always_xy=True).transform
    by_block = {b: transform(project, unary_union([v for k, v in groups.items() if all_blocks[k] == b])) for b in set(all_blocks.values())}
    zones = [{'id': k, 'kind': 'active_source', 'geometry': v, 'assignment': 'source_id'} for k, v in sorted(groups.items()) if all_blocks[k] == f'Blok {block}']
    active = unary_union([z['geometry'] for z in zones])
    dead = []
    for f in features:
        if f['properties'].get('category') == 'Gawangan mati':
            geom = shape(f['geometry'])
            dead.extend(list(geom.geoms) if geom.geom_type == 'MultiPolygon' else [geom])
    for i, geom in enumerate(dead, 1):
        projected = transform(project, geom)
        distances = sorted((projected.centroid.distance(g), name) for name, g in by_block.items())
        if distances[0][1] == f'Blok {block}':
            zones.append({'id': f'GM-{block}-P{i:03}', 'kind': 'dead_source', 'geometry': geom, 'assignment': 'nearest_centroid_block_inferred', 'assignment_margin_m': round(distances[1][0] - distances[0][0], 3)})
    audit = []
    for i, a in enumerate(zones):
        for b in zones[i + 1:]:
            overlap = a['geometry'].intersection(b['geometry'])
            area = transform(project, overlap).area
            if area > .01:
                audit.append({'type': 'Feature', 'geometry': mapping(overlap), 'properties': {'kind': 'boundary_overlap', 'zone_a': a['id'], 'zone_b': b['id'], 'area_m2': round(area, 3), 'action': 'verify_boundary_in_field_not_automatically_corrected'}})
    return zones, audit


def analyze(source, config_path, output, map_path, block='A', source_run=None, cache=None):
    out = Path(output)
    out.mkdir(parents=True, exist_ok=True)
    config = json.loads(Path(config_path).read_text())
    provenance = {'block': block, 'source_run': config['source_run'], 'config_sha256': hashlib.sha256(Path(config_path).read_bytes()).hexdigest(), 'map_sha256': hashlib.sha256(Path(map_path).read_bytes()).hexdigest(), 'method': 'template-2x-threshold043-distance14-v1'}
    marker = out / 'provenance.json'
    if marker.exists() and json.loads(marker.read_text()) != provenance:
        raise ValueError('block_resume_provenance_mismatch')
    marker.write_text(json.dumps(provenance))
    if source_run and config['source_run'] != source_run:
        raise ValueError('template_source_run_mismatch')
    zones, audit = block_zones(json.loads(Path(map_path).read_text())['features'], block)
    region = unary_union([z['geometry'] for z in zones])
    templates = []
    for ref in config['templates']:
        spec = next(s for s in config['samples'] if s['id'] == ref['sample'])
        with rasterio.open(spec['local_tif']) as ds:
            x, y = ref['center']
            half = ref['size'] // 2
            win = Window(spec['window'][0] + x - half, spec['window'][1] + y - half, 2 * half + 1, 2 * half + 1)
            rgb = np.moveaxis(ds.read([1, 2, 3], window=win), 0, -1)
            patch = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
            size = max(9, round(patch.shape[0] / 2)) | 1
            templates.append(cv2.resize(patch, (size, size)))
    reader = None
    if source == 'checkpoint':
        from dayun_checkpoint_reader import CheckpointReader
        reader = CheckpointReader('Agro_ABC', cache)
        ds = rasterio.open('source.tif', opener=reader.opener)
    else:
        ds = rasterio.open(source)
    candidates = []
    tiles = []
    with ds:
        if ds.crs.to_epsg() != 4326 or ds.dtypes[:3] != ('uint8',) * 3:
            raise ValueError('expected_native_rgb_epsg4326')
        win = geometry_window(ds, [mapping(region)]).round_offsets().round_lengths()
        if reader:
            # ABC uses one uncompressed interleaved strip per source row. Read TIFF
            # tags, then prefetch only chunks containing the selected block rows.
            limit = Image.MAX_IMAGE_PIXELS
            Image.MAX_IMAGE_PIXELS = ds.width * ds.height
            with Image.open(reader) as image:
                offsets = image.tag_v2[273]
                lengths = image.tag_v2[279]
                rows = image.tag_v2.get(278, 1)
                planar = image.tag_v2.get(284, 1)
                if rows != 1 or planar != 1 or len(offsets) != ds.height:
                    raise ValueError('unexpected_checkpoint_strip_layout')
                required = set()
                for y in range(max(0, int(win.row_off) - 48), min(ds.height, int(win.row_off + win.height) + 48)):
                    first, last = offsets[y], offsets[y] + lengths[y] - 1
                    required.update(range(bisect.bisect_right(reader.offsets, first) - 1, bisect.bisect_right(reader.offsets, last)))
            Image.MAX_IMAGE_PIXELS = limit
            print(f'Prefetching {len(required)} private chunks for block {block}', flush=True)
            reader.prefetch(required)
        overview_scale = min(1, 4096 / max(win.width, win.height))
        h, w = max(1, round(win.height * overview_scale)), max(1, round(win.width * overview_scale))
        rgb = ds.read([1, 2, 3], window=win, out_shape=(3, h, w), resampling=Resampling.average)
        valid = ds.dataset_mask(window=win, out_shape=(h, w), resampling=Resampling.nearest)
        rgb[:, valid == 0] = 255
        Image.fromarray(np.moveaxis(rgb, 0, -1)).save(out / 'overview.jpg', quality=95)
        extent = list(bounds(win, ds.transform))
        for y in range(int(win.row_off), int(win.row_off + win.height), 2048):
            for x in range(int(win.col_off), int(win.col_off + win.width), 2048):
                core = Window(x, y, min(2048, int(win.col_off + win.width) - x), min(2048, int(win.row_off + win.height) - y))
                if not region.intersects(box(*bounds(core, ds.transform))):
                    continue
                tile = out / 'native' / f'x{x}_y{y}.tif'
                tile.parent.mkdir(exist_ok=True)
                metadata = tile.with_suffix('.json')
                if metadata.exists():
                    row = json.loads(metadata.read_text())
                    candidates.extend(row['candidates'])
                    tiles.append(row['tile'])
                    continue
                halo = Window(max(0, x - 48), max(0, y - 48), min(ds.width, x + core.width + 48) - max(0, x - 48), min(ds.height, y + core.height + 48) - max(0, y - 48))
                data = ds.read([1, 2, 3], window=halo)
                mask = ds.dataset_mask(window=halo) > 0
                mask &= geometry_mask([mapping(region)], mask.shape, ds.window_transform(halo), invert=True)
                # Detection uses 2x reduced RGB, explicitly recorded. Native TIFFs
                # remain unchanged and georeferenced for visual checking.
                rh, rw = data.shape[1] // 2, data.shape[2] // 2
                small = cv2.resize(np.moveaxis(data, 0, -1), (rw, rh), interpolation=cv2.INTER_AREA)
                smask = cv2.resize(mask.astype('uint8'), (rw, rh), interpolation=cv2.INTER_NEAREST) > 0
                proposals = propose(small, smask, templates, threshold=.43, distance=14, limit=100000)
                found = []
                for score, px, py in proposals:
                    sx, sy = halo.col_off + (px + .5) * halo.width / rw, halo.row_off + (py + .5) * halo.height / rh
                    if not (x <= sx < x + core.width and y <= sy < y + core.height):
                        continue
                    lon, lat = ds.transform * (sx, sy)
                    point = Point(lon, lat)
                    matches = [z['id'] for z in zones if z['geometry'].covers(point)]
                    if not matches:
                        continue
                    found.append({'type': 'Feature', 'geometry': {'type': 'Point', 'coordinates': [lon, lat]}, 'properties': {'id': f'{block}-x{int(sx)}-y{int(sy)}', 'zones': matches, 'boundary_conflict': len(matches) > 1, 'similarity': round(score, 5), 'status': 'unvalidated_crown_candidate', 'native_tile': f'native/{tile.name}'}})
                core_data = ds.read([1, 2, 3], window=core)
                core_mask = ds.dataset_mask(window=core)
                profile = dict(driver='GTiff', width=int(core.width), height=int(core.height), count=4, dtype='uint8', crs=ds.crs, transform=ds.window_transform(core), compress='deflate', tiled=True)
                with rasterio.open(tile, 'w', **profile) as dst:
                    dst.write(core_data, indexes=[1, 2, 3])
                    dst.write(core_mask, 4)
                tile_row = {'file': f'native/{tile.name}', 'bounds': list(bounds(core, ds.transform))}
                metadata.write_text(json.dumps({'candidates': found, 'tile': tile_row}))
                candidates.extend(found)
                tiles.append(tile_row)
                print(f'Block {block}: {len(tiles)} native tiles, {len(candidates)} unvalidated crowns', flush=True)
    # A global distance pass removes tile seam duplicates without merging overlap
    # labels into multiple counts. Use projected coordinates for metric distances.
    projection = Transformer.from_crs(4326, 32648, always_xy=True)
    kept, cells = [], {}
    for f in sorted(candidates, key=lambda f: f['properties']['similarity'], reverse=True):
        mx, my = projection.transform(*f['geometry']['coordinates'])
        cell = (int(mx // .258), int(my // .258))
        neighbors = [p for dx in (-1, 0, 1) for dy in (-1, 0, 1) for p in cells.get((cell[0] + dx, cell[1] + dy), [])]
        if any((mx - a) ** 2 + (my - b) ** 2 < .258 ** 2 for a, b in neighbors):
            continue
        cells.setdefault(cell, []).append((mx, my))
        kept.append(f)
    rows, geo = [], []
    for zone in zones:
        single = sum(f['properties']['zones'] == [zone['id']] for f in kept)
        conflicts = sum(zone['id'] in f['properties']['zones'] and f['properties']['boundary_conflict'] for f in kept)
        row = {k: v for k, v in zone.items() if k != 'geometry'}
        row.update(candidate_crowns=single, boundary_conflict_candidates=conflicts, pineapple_count_validated=None, count_status='exploratory_not_validated', census_changed=False)
        row['field_check_reason'] = 'crowns_in_dead_source_verify_species_category_and_boundary' if zone['kind'] == 'dead_source' and single else 'boundary_overlap_verify_in_field' if conflicts else 'species_and_count_validation_required'
        rows.append(row)
        geo.append({'type': 'Feature', 'geometry': mapping(zone['geometry']), 'properties': row})
    result = {'schema': 'dayun-block-analysis-v1', 'block': block, 'source_run': config['source_run'], 'bounds': extent, 'overview': 'overview.jpg', 'zones': rows, 'native_tiles': tiles, 'candidate_count': len(kept), 'boundary_conflict_candidate_count': sum(f['properties']['boundary_conflict'] for f in kept), 'boundary_overlap_count': len(audit), 'census_changed': False, 'pineapple_count_validated': None, 'method': 'Existing RGB crown template matcher; 2x reduced detection; 0.43 similarity threshold; native TIFF inspection; metric seam deduplication', 'limitations': ['Crown candidates are not confirmed pineapple plants; accuracy has not been independently validated.', 'Active/dead means source polygon category, not health detected from imagery.', 'Dead strip block assignments are nearest-geometry inferences, not official IDs.', 'Overlapping source boundaries require field verification; candidates in overlaps are counted once separately.', 'No flight date or absolute geolocation accuracy verified.']}
    def write(name, value):
        (out / name).write_text(json.dumps(value, ensure_ascii=False), encoding='utf-8')
    write('analysis.json', result)
    write('zones.geojson', {'type': 'FeatureCollection', 'features': geo})
    write('candidates.geojson', {'type': 'FeatureCollection', 'features': kept})
    write('boundary-audit.geojson', {'type': 'FeatureCollection', 'features': audit})
    write('field-review.geojson', {'type': 'FeatureCollection', 'features': [f for f in geo if f['properties']['field_check_reason'] != 'species_and_count_validation_required']})
    with (out / 'gawangan.csv').open('w', newline='', encoding='utf-8') as dest:
        fields = sorted(set(k for row in rows for k in row))
        writer = csv.DictWriter(dest, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)
    (out / 'report.txt').write_text(f'Blok {block}: {len(kept)} kandidat tajuk belum tervalidasi; BUKAN jumlah nanas.\n' + '\n'.join(result['limitations']), encoding='utf-8')
    print(json.dumps({k: result[k] for k in ['block', 'candidate_count', 'boundary_conflict_candidate_count', 'boundary_overlap_count', 'census_changed']}), flush=True)
    return result


if __name__ == '__main__':
    p = argparse.ArgumentParser()
    p.add_argument('--source', required=True)
    p.add_argument('--config', required=True)
    p.add_argument('--output', required=True)
    p.add_argument('--map', default='data/dayun-map.geojson')
    p.add_argument('--block', choices=list('ABCDEF'), default='A')
    p.add_argument('--cache', default='.dayun-analysis-work/block-cache')
    a = p.parse_args()
    analyze(a.source, a.config, a.output, a.map, a.block, cache=a.cache)
