# Dayun block analysis in the existing internal viewer

This extends `orthomosaic-internal.html`; it is not a separate application.
The enlarged map keeps imagery beside scrollable review controls. Existing
sample corrections and their private revision history remain unchanged.

## Block A processing

`scripts/analyze_dayun_block.py` reuses the RGB crown matcher from
`propose_dayun_candidates.py`. It dissolves active polygon parts by source ID,
associates dead-strip components to the nearest block using their projected
centroid (UTM 48N), and labels that association as inferred. Dead-strip IDs are
analysis IDs, not new official gawangan IDs. Active/dead refers to the source
category, not a health classification from RGB.

The source has no individual dead-strip block attributes. For A, the inferred
16 components agree with the source's block summary, but this agreement is
not proof of the individual assignments. The source geometry audit found
two small active/dead overlaps: GT-A-07 / GM-A-P009 (0.178 m²) and
GT-A-11 / GM-A-P012 (0.136 m²). These do not establish image-to-boundary
misalignment. GCP validation and field review are still needed.

Processing reads the original verified private source checkpoint through a
seekable chunk cache. Each fetched chunk is size/SHA-256 checked. Completed
chunks survive interruption. Native, georeferenced RGB+alpha tiles are retained;
only crown detection uses 2x reduced RGB. Matching uses a 0.43 similarity
threshold and metric suppression across tile seams. Similarity is not a
pineapple probability, and the existing trial has not established counting
accuracy. No total pineapple estimate is asserted.

Tile outputs can resume only with matching source-run/config/map/method
provenance. Conflicting polygon memberships are recorded once as boundary
conflicts, outside each zone's unambiguous candidate count. The CSV includes
separate counts for unambiguous candidates and boundary-conflict candidates;
these columns must not be summed across zones. Confirmed pineapple counts
remain null. Crowns in a dead-source strip are field-review targets, not proof
that the source category is wrong.

## Private publication

Results are independent files under the existing private source manifest,
with `block_analyses.A` pointing to the matching `analysis.json` and every
file allowlisted in `manifest.files`. The viewer checks source-run identity
before opening them, uses the existing staff-authenticated file API, and
rejects unlisted native tiles. Source-run changes require a new analysis.
No public URL, catalogue entry, original boundary edit, or census write is
part of this feature. Existing private sample corrections are not training
labels for an entire block.

Outputs include a source overview, native TIFF tiles, candidate points,
dissolved/inferred zone polygons, boundary overlap audit, field-review zones,
CSV and a limitations report. The viewer renders candidates only when zoomed
in and limits the visible point layer to 3,000 markers; the table and downloads
contain the complete analysis. Viewing or counting markers on screen is not
a block count. Pilot block candidates are inspectable; the existing persisted
accept/reject controls still apply only to their explicitly identified trial
sample windows.

## Read-only database comparator

`js/dayun-ortho-comparison.js` joins source gawangan IDs exactly and uses the
existing `DayunAgroSummary.population` semantics. It preserves fractional
source populations, planted cohort additions and dates, published living
censuses with their observation dates, seedling stock, and MPTS species/counts
with their planting periods. Stock is never added to planted population.
Values matching the source width × length / spacing are flagged as such,
not promoted to independently observed plants. Missing data stays null.

Database and monitoring snapshot timestamps are retained. The comparator
reads published monitoring only, on a clone; it never writes source records.
Dead-strip analysis IDs are not assigned census records through proximity.
No survival percentage, actual-plant difference or age at flight is computed
from unvalidated image candidates and an unknown flight date.

Publish the comparison JSON/CSV under the private block result folder and
allowlist both files. Set `block_comparisons.A` to the matching JSON path.
The viewer verifies source-run identity before showing the comparator and
offers a separate CSV download. Existing census and candidate corrections
remain independent of this read-only snapshot.

An optional owner-reported flight date can now provide approximate calendar
ages for original planting periods, additional planting cohorts and MPTS.
The owner stated on 17 October 2026 that the imagery was acquired four days
earlier; the analysis records 13 October 2026 with `owner_reported` evidence,
not as a metadata-verified timestamp or upload date. Monitoring observations
after flight are excluded; raw source/cohort population figures remain reference
records rather than reconstructed living populations at flight. Future cohorts
are flagged and receive no age at flight. Month-only planting records yield
approximate months, not exact days.

The dated report and native crown inspection sheet are private, manifest-listed
downloads. A qualitative visual screen is not a labelled accuracy benchmark;
it must not turn the 19 unvalidated proposals into a confirmed pineapple count.

## Native diagnostics and local crown transfer test

`scripts/detail_dayun_block.py --directory <private block folder>` reads each
native RGBA tile, masks the dissolved zone polygons at pixel centres, and
reports valid coverage, visible RGB vegetation and dark pixel fractions per
zone. Areas use projected EPSG:32648 tile area per native pixel. Polygon area
and rasterized area are retained separately. Zone overlaps are not a block
area total. A fixed excess-green heuristic includes weeds and MPTS as well as
pineapple; it is not planted area, species classification or plant health.

Native 256px cells (about 2.36m for ABC, with smaller tile-edge cells) flag
incomplete coverage, dark pixels and low visible vegetation for inspection.
These flags do not diagnose missing plants, row gaps, or dead pineapple.
Native 512px context samples select low/median/high vegetation strata within
each zone; context may cross the zone boundary. Sampling is deterministic,
not an independent accuracy benchmark. Native TIFF source hashes and polygon
hashes are recorded; the source raster, polygons and census are never edited.
The block analyzer generates these diagnostic outputs after its existing
candidate pass, including resumed runs.

`scripts/trial_dayun_block_samples.py --directory <folder> --config <private
config>` reuses the existing template matcher with explicit local crown
exemplars. Calibration tiles are marked, matching is masked to the selected
zone, thresholds .43/.50/.60 are reported, and sample windows are never summed
or extrapolated. In the Blok A pilot three visual A02 exemplars matched only
their calibration sample; the remaining samples had no proposals at .43.
This exposes poor transfer and missed visible crowns, not absence of plants.
No precision, recall or pineapple total is reported without independent labels.

Publish diagnostics, review cells, sample sheets, local trial and provenance
through the existing private allowlisted source manifest. Set
`block_details.A` to `detail-analysis.json` in that same block result folder.
The staff viewer validates the source run, offers per-zone diagnostics and
CSV, a viewport-filtered review grid, enlarged sample sheets and native TIFF
inspection. Files use the existing authenticated API and are removed from
the UI on session disposal. No public imagery endpoint is added.
