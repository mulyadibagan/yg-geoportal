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
