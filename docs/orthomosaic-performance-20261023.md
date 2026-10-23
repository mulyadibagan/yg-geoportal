# Orthomosaic Blok B performance — 23 October 2026

Baseline: `40cc34f` (the existing membership cache, effective-feature cache and shared Canvas renderer are included). No census, correction, imagery or saved-area records are changed by this release.

## Evidence and scope

The production staff UI was used to export Blok B candidates, current team corrections, its matching analysis/zones, and the saved nine-polygon collection. These private fixtures remain in an ignored `private-data/orthomosaic-performance/` directory, excluded from both Git and the Pages deployment artifact.

The benchmark snapshot contains **14,113 original candidates, 19,024 correction features, 29,145 effective features and 25,194 non-rejected working points**, across 33 named gawangan. Production staff were actively editing: the initial live UI showed revision 4279 and 25,224 working points, before the later exported snapshot. A changing live count must not be mistaken for data lost by this release.

The browser harness mounts the actual before/after block editor and review scripts on Leaflet 1.9.4 with Turf 6.5, using the entire exported dataset and its actual zone geometry. It mocks authenticated endpoints and native-read readiness, so deleting/restoring 250 points and saving never writes to production. Timings measure JavaScript work, not end-to-end internet download time, TIFF decoding, frame rate, or an SLA. The harness and raw fixtures are retained locally for reproduction.

## Measurements

Final paired browser interaction run, milliseconds (median / p95 where sampled):

| Operation | Before | After |
| --- | ---: | ---: |
| Pan handler, 20 samples after warmup | 6.3 / 10.6 | 0.1 / 0.7 |
| Box selection of 250 points, 20 samples | 6.4 / 9.8 | 2.8 / 4.2 |
| Delete 250 points, one batch | 73.1 | 11.3 |
| Undo the same batch | 68.2 | 7.7 |
| Count saved polygon union, 10 samples | 215.6 / 264.7 | 0.2 / 0.8 |

Polygon counting varied with browser load: earlier before-runs measured 31.5–33.6 ms median, versus 0.2–0.3 ms after. Both versions already retained unchanged Canvas markers: zero marker creations during the repeated small pans. The improvement removes the whole-dataset filtering and serialization surrounding that existing renderer, rather than replacing it with a second renderer.

Five repeated mounts, with fixture loading outside the timer, measured before `[1039.5,1062.8,987.5,945.6,950.2]` ms and after `[343.5,301.8,278.4,294.3,320.2]` ms (medians **987.5 → 301.8 ms**). Earlier individual mounts were approximately 339–355 ms before and 318–393 ms after; startup varies substantially with browser load. These are local mount measurements, not a claimed production network-load improvement.

## Changes

- Extend the editor's existing effective-point cache with an ID map, spatial grid and incremental totals/progress. Build the initial index directly from the latest correction snapshot. Local batches update only changed IDs; unchanged remote features retain identity and do not repeat point-in-polygon work.
- Use the same index for viewport markers, box selection, ID lookups during delete/undo, and exact counting within polygon bounding boxes. Existing polygon union/deduplication, rejection and team-conflict semantics remain intact.
- Keep the existing Canvas renderer and marker map; pan no longer filters/counts the entire block or serializes unchanged markers. Dispose its renderer on leaving the block.
- Reuse the existing bounded, session-only private R2 byte cache for run-scoped candidate/boundary GeoJSON as well as imagery. Live review JSON and byte-range responses remain uncached. Source revision changes and logout invalidate retained bytes; native imagery resolution is unchanged.
- Fetch block zones/candidates/overview concurrently, omit the unused conflict-audit download from opening, and skip the general source overview when directly opening a block. Audit downloads remain explicitly available. Boundaries displayed on the map remain gawangan only.

## Data preservation

Before deployment the staff UI opened **“Batas nanas baru Blok A sampai A9”, revision 2**, containing nine polygons. Exported baseline areas were 491.09, 113.76, 248.11, 154.11, 280.29, 576.12, 1009.68, 825.26 and 687.82 m². No area-save or correction-write request was sent to production during testing. The separate August planting layer remains unchanged.

## Validation

Targeted editor, rendering, membership, polygon, undo, idempotent retry, multistaff synchronization, shortcuts, native viewport and private-cache tests pass. Full Worker suite: **159/159 pass** (rerun outside the Windows sandbox because it denied temporary-file renames).

The broader Dayun/orthomosaic suite has 285 passes and six unrelated existing failures in HPT photos, public monitoring form assertions, fertilizer SOP consistency, pineapple analysis fixture coverage and SOP navigation. Those source files are unchanged. These failures are not counted as passing release checks.

Deployment verification must check the served `20261023-viewport1` script versions, authenticated Blok B display/native imagery, and re-export/hash comparison of the nine saved polygon geometries after Pages reports success.
