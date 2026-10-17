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

## Correctable radial crown pilot

`propose_dayun_candidates.radial_propose` adds an orientation response to the
existing proposal engine. It measures tangential image gradients around candidate
centres at native radii 40/55/75px, masks invalid annuli and zone centres, and
suppresses peaks within 65px. It uses no copied exemplar pixels and no green-pixel
count. Fixed mature-crown scales can miss small plants, while litter, overlapping
leaves, weeds and pale crowns still produce false proposals and missed centres.
Scores are shape agreement, not species probabilities.

`scripts/propose_dayun_radial_trial.py` prepares six existing native 512px samples
from the detail output, with unchanged RGB/alpha pixels and coordinate transforms.
The A02 median window is the development visual screen. A01/A03 median, A02 low,
A09 mixed vegetation and one inferred dead-strip window are unlabelled transfer
checks. The pilot produces respectively 8/2/0/2/0/1 candidates at .30, versus
3/0/0/0/0/0 for the former local pixel-template trial. More proposals do not prove
better precision or recall; no independent user labels yet exist for these windows.
Unlabelled zero-detection samples remain available to add missed plants.

The review trial retains the existing schema, editing controls, optimistic
revision checks, immutable private history and feedback calibration. A manifest
`candidate_trials` map resolves a named trial to an allowlisted private JSON;
`preferred_candidate_trial` selects it initially. Review GET/POST uses a validated
`?trial=<name>` selector; raw paths are rejected. Dataset IDs include the method,
configuration and source provenance signature, separating new labels from the
legacy A/C review history. Switching trials requires saved or exported edits.
Only the review namespace changes; no census writes are introduced.

Stored proposals extend to .20 so completed user reviews can calibrate a threshold
on that actual candidate pool. Accepted additions restore missed crowns within
reviewed windows; moved accepted/rejected candidates suppress their original
automatic positions to avoid resurrecting duplicates. Threshold adjustment is
feedback reconciliation, not a trained species detector or validated block count.

Staff can open one sample directly with the existing internal viewer:
`orthomosaic-internal.html?source=Agro_ABC&trial=block-A-radial-v1&sample=ABC-A01-R01`.
An optional `point` names a feature ID to select. Only validated source/trial/sample
identifiers are accepted; the manifest allowlist and stored source-run checks
still apply. Authentication runs before all private reads, and the local login
return preserves the sample selection. A valid link opens the native sample,
numbered candidates and expanded map without fetching whole-block imagery.
Opening a link performs no review POST, count change or census write.

## Whole Blok A native count

`scripts/count_dayun_block.py` reuses the existing checkpoint reader and radial
detector over every native block core. A 160px halo comes from the original
source rather than a resized overview or clipped neighbouring crop. Native grid
checks reject a mismatched crop; half-open core assignment and global 65px
suppression prevent seam duplicates. Provenance-gated per-core checkpoints allow
interrupted counting to resume without reprocessing completed native cores.

Outputs retain the existing block-analysis schema and include candidate points,
per-zone CSV, whole-block report, method provenance and threshold .25/.40
sensitivity counts. The primary threshold is .30 until usable stored calibration
exists. Fixed mature-crown scales can miss small seedlings, and weeds/litter can
look radial. The result is a low-confidence whole-block crown proposal count;
no validated living pineapple total or confidence interval is claimed.
Active/dead remains the original polygon category. Overlap memberships are
reported per zone; global count assigns every proposal once.

Keep the previous template analysis as private derivative history. Publish the
new analysis, points, zone counts and CSV together within the existing private
block folder, retaining native files and all saved review histories. Update only
the image candidate fields in the private database comparator, never the source
population, cohorts, planting dates, stock or monitoring. The viewer offers a
full-point GeoJSON download and renders up to 3,000 viewport markers, with all
results retained in CSV/downloads.

Versioned full-count manifests may set `asset_folder` to the existing private
block folder. The viewer resolves a derived file in the new result folder first,
then an explicitly named original asset folder, and requires every resolved file
in the same private manifest allowlist. This preserves the previous analysis and
reuses all native TIFFs/overview without copying or changing their bytes. Invalid
asset folder paths are rejected. Checkpoint counting requires an explicit expected
source MD5; optional exclusion files must identify the matching source run and
explicitly rejected coordinates. Saved trial histories remain independent.

`orthomosaic-internal.html?source=Agro_ABC&block=A` opens the full block and enlarged
map after staff login, with the sample panel collapsed. No sample review is
required to view the whole-block result; opening the link performs no writes.
