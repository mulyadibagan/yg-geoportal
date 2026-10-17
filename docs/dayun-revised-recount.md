# Recount on revised Dayun boundaries

`scripts/recount_dayun_revised.py` composes the existing checkpoint reader,
native block cropper and radial candidate detector. It does not write census,
monitoring or planting records. Run with private working paths for the source
manifest, source metadata, training metadata, frozen model and current review.
Use `--label Agro_ABC --block A|B|C` or `--label Agro_DEF --block D|E|F`.
The CLI rejects mismatched source/block pairs and unexpected source identities.

The revised `data/dayun-map.geojson` is dissolved by planting ID before native
core tiles are visited. Count resumes require matching provenance, including
the correction version and current manual-point exclusions. Coverage uses the
original alpha band and geodesic pixel areas. GSD, detector radii, suppression
and correction matching tolerances are transferred in metres between sources;
the existing operating threshold is frozen, not fitted to census totals.

Private publication must finish and verify native assets before switching
`block_analyses` and `block_comparisons`. Retain every old file and the existing
`block_review_bases`, source run, head and immutable correction versions. Read
the latest heads again before activation. Never replace a head from the input
snapshot: staff may have saved newer corrections while counting.

`review_grid()` produces a compact source-pixel index for the private correction
API. Publish it as `candidate-review-grid.json`, list it in the manifest and set
`analysis.review_index` to that filename. It contains every selected candidate,
its stable source-pixel identity and dissolved zone memberships. The full
GeoJSON remains the display/download artifact. Large DEF correction requests
can therefore avoid parsing and cloning tens of megabytes of feature metadata.
The server validates the index and supports per-point conflicts and retries for
both sources. Reads reassign zone memberships without rewriting user history.

## Reliability

Completion of all native tiles establishes processing coverage, not pineapple
count accuracy. Always keep `validated_pineapple_total` null until independently
validated. Source A label recovery statistics are historical and must not be
presented as validation on revised A or on other blocks. Source DEF has about
twice the pixel size. Native inspection shows false proposals on soil, litter
and other textures; an A-to-DEF downsampling experiment is diagnostic only,
not DEF ground truth. Mark those results
`count_reliability: not_reliable_on_DEF_native_samples`. The review UI opens
with staff-accepted points only for these results; all raw candidates remain
available through the explicit correction filter and private download.

Store native inspection previews, provenance, valid/nodata coverage, revised
per-zone tables and read-only database comparisons in the existing private R2
prefix. A source upload date is not a flight date. Preserve owner-reported dates
as such and leave unknown flight dates unknown. Do not report image candidate
minus planting capacity as mortality, survival or actual population change.
