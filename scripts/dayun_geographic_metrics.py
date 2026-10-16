"""Measure WGS84 native rasters in metres without changing their pixel grid."""
from pyproj import Geod
from shapely.geometry import shape,box,MultiPolygon
from shapely.geometry.polygon import orient

GEOD=Geod(ellps='WGS84')

def area(geometry):
    if geometry.is_empty:return 0.0
    if geometry.geom_type=='Polygon':return abs(GEOD.geometry_area_perimeter(orient(geometry,sign=1))[0])
    return sum(area(part) for part in geometry.geoms if part.geom_type in ('Polygon','MultiPolygon','GeometryCollection'))

def pixel_area(lon,lat,dx,dy):
    return abs(GEOD.polygon_area_perimeter([lon-dx/2,lon+dx/2,lon+dx/2,lon-dx/2],[lat-dy/2,lat-dy/2,lat+dy/2,lat+dy/2])[0])

def apply_geographic_metrics(summary,features):
    if summary.get('crs')!='EPSG:4326':return False
    transform=summary.get('transform')
    if transform and (transform[1] or transform[3]):raise ValueError('Rotated geographic raster requires per-pixel geodesic measurement')
    dx,dy=summary['resolution_crs_units'];bounds=summary['bounds']
    lon=(bounds[0]+bounds[2])/2;lat=(bounds[1]+bounds[3])/2
    summary['gsd_m']=[abs(GEOD.inv(lon,lat,lon+dx,lat)[2]),abs(GEOD.inv(lon,lat,lon,lat+dy)[2])]
    summary['pixel_area_m2']=pixel_area(lon,lat,dx,dy)
    summary['metric_method']='WGS84 geodesic polygon area; native valid-pixel count times geodesic pixel area at gawangan centroid. Pixel-area bounds evaluated at polygon latitude extrema; pixel-centre boundary uncertainty remains.'
    by_id={f['properties']['gawangan']:f for f in features}
    raster_extent=box(*bounds)
    for row in summary['gawangan']:
        feature=by_id[row['gawangan']];geometry=shape(feature['geometry']);centre=geometry.centroid
        total=area(geometry);unit=pixel_area(centre.x,centre.y,dx,dy)
        units=[pixel_area(centre.x,y,dx,dy) for y in [geometry.bounds[1],centre.y,geometry.bounds[3]]]
        valid=row['valid_pixels']*unit
        values={
            'polygon_area_ha':total/10000,'valid_area_ha':valid/10000,
            'valid_coverage_percent':min(100,100*valid/total) if total else None,
            'nodata_area_ha':max(0,row['polygon_pixels']-row['valid_pixels'])*unit/10000,
            'outside_raster_area_ha':area(geometry.difference(raster_extent))/10000,
            'pixel_area_variation_percent':100*(max(units)-min(units))/unit,
        }
        row.update(values);feature['properties'].update(values)
    summary['metric_revision']='wgs84-geodesic-native-v1'
    return True
