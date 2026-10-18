# Negative-control refinement of existing Dayun candidates

This extends the existing radial engine with a second-stage candidate filter;
it does not create a new application or a census. `dayun_negative_filter.py`
extracts rotation-independent leaf-edge support and local colour/texture
contrast. RGB patches are antialiased onto a shared metric grid before feature
extraction. It never learns source IDs, coordinates, absolute brightness or
database population totals as features. Native core neighbours are joined so
an artificial TIFF tile seam does not discard a candidate.

Private owner-reported unplanted D proposals supply training negatives.
E validation and F independent test samples are kept out of fitting. The
existing spatial split of staff positives uses 17 training plants, seven test
plants and six buffer plants. Five small centre jitters per training plant are
augmentation, not 85 independent plants. The metric context and jitter fit
within the positive spatial separation. A strongly regularized linear
discriminant uses the lower five percent of training-positive patch scores as
its frozen threshold. Scores are not species probabilities.

Apply the private frozen model with `refine_dayun_candidates.py --input ...
--native ... --model ... --output ... --gsd <x_m> <y_m>`. This visits every
existing A/B/C native tile and refines all upstream selected proposals. It
retains source-pixel IDs, coordinates and zone memberships. Missing context
stays visible for staff review. Resume refuses mismatched model, source-result,
candidate or descriptor hashes. The positive and negative test gates must pass
before producing a refined analysis. Preserve upstream sensitivity diagnostics
as explicitly upstream measurements; they are not refined count intervals.

Publish analysis, selected GeoJSON, compact correction index, per-zone before /
after CSV, private model/provenance, native comparison previews and read-only
database comparisons as a new private result version. Preserve existing
`block_review_bases`, current heads and immutable versions; never replace staff
corrections with a training snapshot. Corrections can refer to proposals
removed by the filter and must remain editable and included in team results.

This experiment has two source flights and only one small positive area.
Neither physical normalization nor relative features remove every domain
difference. A negative-control rejection rate is not A–C precision. Scoring
known positive coordinates is not finding those plants: also report matches
to the actual upstream detections. Filtering cannot recover plants missed by
the radial stage. No validated population, mortality or census update follows
from a lower candidate count. Keep original candidates and filter decisions
available privately for review and reversal.
