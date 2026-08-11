# Phase 2: smoke dispersion backend

## Product boundary

The current browser model remains an experimental **transport-likelihood screening** product. It must not be described as observed smoke, PM2.5 concentration, exposure, or health risk.

The screening model interpolates GFS/GEFS wind vectors from the four nearest grid locations and two surrounding forecast times. It selects 925 hPa by default, 850 hPa when PBL height reaches 1,400 m, and 700 hPa only when PBL reaches 2,800 m and the magnitude of 925-hPa vertical velocity reaches 0.05 Pa/s. These are explicit screening heuristics, not measured smoke-injection heights.

If the deterministic GFS context request fails but a non-expired GEFS ensemble remains available, the browser may display a clearly labelled limited mode at 925 hPa. In that mode it does not apply PBL-based level selection, vertical-motion attenuation, or precipitation removal; the dashed reference uses GEFS member 0 rather than deterministic GFS. This fallback may overstate plume persistence and never substitutes a fabricated contour when GEFS itself is unavailable.

GEFS cache eligibility is determined from forecast-time coverage rather than file age alone. The common time range across all accepted grid rows must include the model time. Detection complexes older than the available ensemble time range are excluded instead of being propagated with a clamped first-hour wind field.

The shared GEFS request includes one past day and one forecast day so the rolling 24-hour FIRMS source window can be matched to meteorology from the actual detection hours. The interface reports any source complexes still excluded by temporal coverage. These outputs are labelled **GEFS transport corridors** because the current kernel envelope is not a simulated or observed smoke polygon.

When a contour is displayed, the map summary exposes the underlying model/provider, the common GEFS validity interval, and whether the shared cache carries the validated version-2 provenance metadata. Older browser caches may be used only while their timestamps cover the model time and are explicitly labelled as having incomplete provenance.

Trajectory support is rasterised on a 0.25-degree grid with a 30 km Gaussian kernel, truncated at 75 km. Within one fire complex, each ensemble member contributes the maximum kernel weight encountered along its trajectory to a cell, preventing repeated trajectory samples from multiplying that member's vote. Source-specific support is divided by the number of valid equally weighted members; overlapping fire complexes use the maximum source-specific value rather than being added together.

Source-evidence reliability is deliberately separate from fire activity. A single high-confidence detection starts at 0.45. Multiple detections add up to 0.20, two or more independent satellite identifiers add 0.15, and detections in multiple hourly overpass buckets add up to 0.15; the score is capped at 0.95 because no satellite detection proves continuing combustion. Kernel-smoothed ensemble support is multiplied by this reliability. FRP is reported as observed radiative power but does not alter source reliability or trajectory direction.

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

Candidate dates may be identified from ASMC narrative reviews, but ASMC imagery must not be copied or scraped until reuse permission is established. Manual observed-plume polygons should instead be traced from appropriately attributed NASA Worldview/GIBS layers. `scripts/score_smoke_validation.mjs` rasterises predicted and observed polygons at 0.05 degrees and reports intersection-over-union, false-alarm ratio, miss ratio, and plume-axis angular error. The annotation and model runs must use separate calibration and evaluation cases.

Historical outlines must follow `docs/plume-annotation-protocol.md` and pass `node scripts/validate_smoke_annotations.mjs` before scoring. The observer must trace with model output hidden. Cloud-obscured or ambiguous cases are explicitly excluded rather than assigned a synthetic plume outline. The empty audit-ready record is stored in `data/smoke-validation-observed.geojson`.

`scripts/fetch_historical_transport.mjs` downloads official Open-Meteo historical GFS fields for the validation catalog and rejects incomplete grids. This archive is deterministic: it may validate reference-trajectory direction, multi-level selection, rain and PBL heuristics, but it cannot validate the GEFS ensemble-support contour. Full contour validation remains pending until a compliant historical GEFS-member archive is connected.

## Access still required

- Registered NOAA HYSPLIT executable or approved runtime.
- Copernicus Climate Data Store credentials for GFAS.
- A backend runner with enough storage for HYSPLIT-compatible meteorological files.

Credentials must be stored as deployment secrets and never committed to this repository.
