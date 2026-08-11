# Phase 2: smoke dispersion backend

## Product boundary

The current browser model remains an experimental **transport-likelihood screening** product. It must not be described as observed smoke, PM2.5 concentration, exposure, or health risk.

The screening model interpolates GFS/GEFS wind vectors from the four nearest grid locations and two surrounding forecast times. It selects 925 hPa by default, 850 hPa when PBL height reaches 1,400 m, and 700 hPa only when PBL reaches 2,800 m and the magnitude of 925-hPa vertical velocity reaches 0.05 Pa/s. These are explicit screening heuristics, not measured smoke-injection heights.

The phase-2 product is published only after a backend HYSPLIT run passes the repository validator. Missing, incomplete, or expired output is withheld rather than replaced by a visual fallback.

## Required inputs

1. GFAS 1.4.2 biomass-burning emissions and injection height for the source period.
2. HYSPLIT-compatible GFS/GDAS meteorology with three-dimensional wind, vertical motion, mixing depth, and precipitation.
3. Particle properties and wet/dry deposition configuration recorded with the run.
4. Source timestamps that preserve the distinction between satellite detection and confirmed continuing combustion.

## Required output metadata

`data/smoke-dispersion.geojson` must be a GeoJSON FeatureCollection containing:

- `modelVersion`
- `generatedAt` and `validUntil`
- `sourceObservationStart` and `sourceObservationEnd`
- `meteorology`
- `emissions`
- optional `validation` references

Every polygon requires a numeric `value` and one display band: `low`, `moderate`, `high`, or `very-high`. These bands cannot be labelled as health-risk categories unless they are later calibrated against an approved air-quality standard.

Run `node scripts/validate_smoke_dispersion.mjs` before publication. The validator rejects expired products and writes the public status manifest only after all provenance checks pass.

## Validation sequence

1. Compare plume direction and spatial overlap with Himawari/ASMC observations.
2. Compare arrival timing and relative intensity with available PM2.5 stations.
3. Record misses, false alarms, intersection-over-union, plume-axis angular error, and arrival-time error.
4. Calibrate thresholds on a historical period separate from the evaluation period.
5. Publish uncertainty and validation dates beside the map.

## Access still required

- Registered NOAA HYSPLIT executable or approved runtime.
- Copernicus Climate Data Store credentials for GFAS.
- A backend runner with enough storage for HYSPLIT-compatible meteorological files.

Credentials must be stored as deployment secrets and never committed to this repository.
