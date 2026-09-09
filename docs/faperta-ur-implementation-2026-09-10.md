# Faperta UR integration — implementation record

## Scope

Additive first-stage integration of the UPT Kebun Percobaan Fakultas Pertanian Universitas Riau into YG GeoPortal. No existing programme, biodiversity, coastal, hotspot, village, social-forestry, donor, finance, or Apps Script data flow is replaced.

## Baseline and rollback

- Baseline branch: `main`
- Baseline commit: `4b1ee511b870c2b2c4f8127ae4495d68d0c9bed6`
- Work branch: `codex/faperta-ur-integration-20260910`
- Rollback: restore `main` to the baseline commit, or revert the single Faperta integration commit.
- Apps Script: unchanged; no deployment required for stage one.

## Spatial source verification

- Primary operational boundary: `UPT_Faperta_UNRI.shp`
- CRS: WGS 84 / EPSG:4326
- Features: 3 polygons
- SHP areas: 5.45461340695 ha; 1.98092521190 ha; 2.02885869496 ha
- Reference map: `PETA UPDATE LAHAN UPT 1-1.pdf`
- PDF labels: 5.4447430 ha; 2.0017681 ha; 3.2960828 ha

The source values do not fully reconcile. Geometry and SHP attributes are preserved for operations. PDF values are retained as `pdf_reference_area_ha`, and every polygon is marked `reconciliation_status: needs_review`. No geometry or area is altered to force a match.

## Architecture

The stage-one static schema follows:

`Organization → Site → Block/Plot → Crop Cycle → SOP → Scheduled Task → Realization → Monitoring → Harvest → Research`

SOP inputs and tasks are empty until official Faperta UR data is approved. Calculation hooks use crop-cycle planting dates and HST offsets; material requirements will only be calculated from a versioned SOP formula and plot population/area.

## Isolation boundary

- Existing WebGIS receives one workspace entry card and one independent reference layer.
- The Faperta workspace has its own HTML, CSS, JavaScript, and JSON files.
- No Apps Script files, public snapshots, existing object records, or existing module-specific files are modified.
- Future sensor, weather, drone/NDVI, student research, additional site, and partner-farmer extensions are declared without enabling speculative data.
