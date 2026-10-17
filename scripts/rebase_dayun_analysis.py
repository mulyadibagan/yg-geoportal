"""Reassign existing crown points to revised boundaries; never infer new plants.

Old imagery, analysis versions and staff correction heads remain immutable.
The output explicitly measures newly included area that needs a detector pass.
"""
import copy
from collections import Counter
from shapely.geometry import Point, box, mapping, shape
from shapely.ops import unary_union
from shapely.prepared import prep
from analyze_dayun_block import block_zones
from dayun_geographic_metrics import area


def rebase(analysis, candidates, old_zones, revised_map):
    result = copy.deepcopy(analysis)
    zones, audit = block_zones(revised_map['features'], result['block'])
    current_region = unary_union([z['geometry'] for z in zones])
    previous_region = unary_union([shape(f['geometry']) for f in old_zones['features']])
    delta = current_region.difference(previous_region)
    native = unary_union([box(*t['bounds']) for t in result['native_tiles']])
    indexed = [(z['id'], prep(z['geometry'])) for z in zones]
    features = copy.deepcopy(candidates['features'])
    singles, conflicts = Counter(), Counter()
    for f in features:
        point = Point(f['geometry']['coordinates'])
        ids = [key for key, geom in indexed if geom.covers(point)]
        f['properties'].update(zones=ids, boundary_conflict=len(ids) > 1, outside_revised_boundary=not ids)
        if len(ids) == 1:
            singles[ids[0]] += 1
        elif len(ids) > 1:
            conflicts.update(ids)
    rows, geo = [], []
    for z in zones:
        row = {k: v for k, v in z.items() if k != 'geometry'}
        row.update(candidate_crowns=singles[z['id']], boundary_conflict_candidates=conflicts[z['id']],
                   pineapple_count_validated=None, count_status='existing_candidates_reassigned_not_new_detection',
                   polygon_area_m2=area(z['geometry']),
                   newly_included_detection_area_m2=area(z['geometry'].difference(previous_region)),
                   outside_existing_native_area_m2=area(z['geometry'].difference(native)), census_changed=False)
        rows.append(row)
        geo.append({'type': 'Feature', 'properties': row, 'geometry': mapping(z['geometry'])})
    revision = revised_map['boundaryRevision']
    warning = ('Batas revisi diterapkan ke kandidat yang sudah ada; belum menjalankan ulang detektor. '
               'Area yang baru masuk batas belum memiliki hasil deteksi lengkap. Titik di luar batas baru '
               'dipertahankan untuk diperiksa, bukan dihapus. Analisis detail RGB lama tidak digunakan pada batas revisi.')
    result.update(boundary_revision=revision, zones=rows, candidate_count=len(features),
                  boundary_overlap_count=len(audit),
                  boundary_conflict_candidate_count=sum(f['properties']['boundary_conflict'] for f in features),
                  outside_revised_boundary_candidate_count=sum(not f['properties']['zones'] for f in features),
                  boundary_rebase=dict(status='existing_candidates_reassigned', detector_rerun=False,
                                       newly_included_detection_area_m2=area(delta),
                                       outside_existing_native_area_m2=area(current_region.difference(native)),
                                       previous_candidate_count=analysis['candidate_count'], warning=warning),
                  analysis_findings=[warning], analysis_report='boundary-report.txt', candidate_inspection=None,
                  full_block_count=None, detail_analysis=None)
    result['limitations'] = [warning] + list(analysis.get('limitations', []))
    return result, {'type': 'FeatureCollection', 'features': features}, {'type': 'FeatureCollection', 'features': geo}, {'type': 'FeatureCollection', 'features': audit}


def coverage_metadata(metadata, revised_map):
    result = copy.deepcopy(metadata)
    groups = {}
    for f in revised_map['features']:
        p = f['properties']
        if p['category'] == 'Gawangan Tanam':
            groups.setdefault(p['sourceGawanganId'], []).append(shape(f['geometry']))
    result['boundary_revision'] = revised_map['boundaryRevision']
    result['gawangan'] = []
    features = []
    for key, geometries in sorted(groups.items()):
        geom = unary_union(geometries)
        extent = box(*metadata['bounds'])
        row = dict(gawangan=key, block='Blok ' + key[3], source=metadata['label'], polygon_area_ha=area(geom)/10000,
                   geometric_extent_coverage_percent=100*area(geom.intersection(extent))/area(geom),
                   outside_raster_area_ha=area(geom.difference(extent))/10000,
                   valid_coverage_percent=None, valid_area_ha=None, nodata_area_ha=None,
                   status='revised_boundary_native_mask_recount_pending', tiles=[])
        result['gawangan'].append(row)
        features.append({'type': 'Feature', 'geometry': mapping(geom), 'properties': row})
    result['boundary_revision_notice'] = ('Batas gawangan memakai revisi pemilik. Cakupan berdasarkan batas raster tersedia; '
                                         'persentase piksel valid/nodata dan potongan per gawangan lama perlu dihitung ulang.')
    return result, {'type': 'FeatureCollection', 'features': features}
