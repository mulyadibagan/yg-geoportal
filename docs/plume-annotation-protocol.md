# Historical smoke-plume annotation protocol

## Purpose and product boundary

This protocol creates an independent visual reference for evaluating the direction and footprint of the experimental smoke-transport model. A traced feature means **satellite-visible plume-like material**, not surface PM2.5, exposure, a health-risk zone, or proof that every hotspot remained active.

The model output must be hidden while the observer traces the reference. Model polygons may be opened only after the observed GeoJSON has been saved and its review state recorded.

## Permitted imagery

Use official NASA Worldview/GIBS imagery and record the exact layer, instrument, acquisition date/time when available, Worldview URL, and access date. The preferred order is:

1. MODIS or VIIRS corrected reflectance true colour.
2. An alternative NASA corrected-reflectance layer from the same day when cloud or sunglint obscures the first view.
3. The adjacent day only as contextual evidence; it must not be merged into the target-day polygon.

ASMC narrative reviews may identify candidate dates, but ASMC imagery must not be copied, traced, or redistributed without established reuse permission.

## Blind annotation procedure

1. Open the catalog bounding box and target date in NASA Worldview.
2. Turn off every model trajectory, contour, wind arrow, and predicted plume layer.
3. Inspect at a stable regional scale. Record all NASA layers consulted.
4. Distinguish plume-like features from cloud using texture, source attachment, downwind continuity, shadows, and the same feature in an alternative NASA layer. Do not infer an invisible continuation.
5. Trace only the clearly visible envelope. A polygon may have several parts when visible material is genuinely discontinuous.
6. Record `visibility` as `clear`, `partial`, or `unobservable`, plus cloud/obstruction notes.
7. Record `confidence` as `high`, `medium`, or `low`. Low-confidence geometry is retained for audit but excluded from primary scoring.
8. A second observer reviews the geometry without seeing the model. Disagreements are resolved by retaining the common visible envelope or excluding the case—not by expanding the polygon toward the prediction.

## Inclusion rules

A case enters primary spatial scoring only when:

- `annotationStatus` is `reviewed`;
- `visibility` is `clear` or `partial`;
- `confidence` is `high` or `medium`;
- at least one polygon is present and valid;
- the NASA layer, acquisition date, URL, access date, annotator, and reviewer are recorded; and
- the polygon was created blind to the model output.

Mark a case `excluded` when cloud, haze/cloud ambiguity, missing imagery, sunglint, or scene-edge truncation prevents a defensible outline. An excluded case is a documented non-result and must never receive an invented polygon.

## Geometry conventions

- GeoJSON coordinates use longitude, latitude (WGS84 / EPSG:4326).
- Close every polygon ring and avoid self-intersections.
- Use one feature per visually coherent plume envelope.
- Every feature must contain the catalog `caseId` and may contain `sourceCoordinates` only when the source location is independently established from historical observations.
- Do not buffer a hotspot or use wind direction to construct the observed polygon.

## Metrics and interpretation

The evaluation reports intersection-over-union, false-alarm ratio, miss ratio, and—when an independent source coordinate exists—plume-axis angular error. These metrics assess agreement with a visible satellite feature on selected historical cases. They do not validate smoke concentration, ground-level air quality, or health impacts.

Calibration cases and final evaluation cases must be separated before thresholds are tuned. The three current candidates are a pilot set and are insufficient for a general performance claim.
