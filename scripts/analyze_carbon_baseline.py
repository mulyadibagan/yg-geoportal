import json
from pathlib import Path

from pyproj import Transformer
from shapely import make_valid
from shapely.geometry import shape
from shapely.ops import transform, unary_union


ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
TO_EQUAL_AREA = Transformer.from_crs("EPSG:4326", "EPSG:6933", always_xy=True).transform


def load_features(filename):
    with (DATA / filename).open("r", encoding="utf-8") as source:
        return json.load(source).get("features", [])


def feature_geometry(feature):
    geometry = feature.get("geometry")
    if not geometry:
        return None
    value = make_valid(shape(geometry))
    return value if not value.is_empty else None


def union_features(filename):
    geometries = [
        geometry
        for feature in load_features(filename)
        if (geometry := feature_geometry(feature)) is not None
    ]
    return unary_union(geometries)


def area_hectares(geometry):
    return transform(TO_EQUAL_AREA, geometry).area / 10_000


villages = union_features("desa_intervensi.geojson")
peat = union_features("Gambut_BBSDLP_2019.geojson")
forest_estate = union_features("kawasan_hutan_sk_903.geojson")
timber_licenses = union_features("IUPHHK_HT_2014.geojson")
social_forestry = union_features("PERHUTANAN_SOSIAL_RIAU.geojson")
mangrove_features = load_features("area_mangrove.geojson")
mangrove = unary_union([
    geometry
    for feature in mangrove_features
    if (geometry := feature_geometry(feature)) is not None
])

forest_context = unary_union([forest_estate, timber_licenses, social_forestry])
mangrove_attribute_area = sum(
    float(feature.get("properties", {}).get("Luas_Ha") or 0)
    for feature in mangrove_features
    if str(feature.get("properties", {}).get("Status_Objek", "Aktif")).lower() == "aktif"
)

result = {
    "analysis_unit_villages_ha": round(area_hectares(villages), 2),
    "peat_in_intervention_villages_ha": round(area_hectares(peat.intersection(villages)), 2),
    "forest_context_in_intervention_villages_ha": round(
        area_hectares(forest_context.intersection(villages)), 2
    ),
    "forest_estate_in_intervention_villages_ha": round(
        area_hectares(forest_estate.intersection(villages)), 2
    ),
    "timber_licenses_in_intervention_villages_ha": round(
        area_hectares(timber_licenses.intersection(villages)), 2
    ),
    "social_forestry_in_intervention_villages_ha": round(
        area_hectares(social_forestry.intersection(villages)), 2
    ),
    "mangrove_activity_attribute_ha": round(mangrove_attribute_area, 3),
    "mangrove_activity_geometry_ha": round(area_hectares(mangrove), 3),
}

print(json.dumps(result, indent=2))
