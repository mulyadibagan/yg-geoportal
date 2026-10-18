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

The single-size trial visibly removed larger radial crowns. Before activating
results, use a frozen 1/2× context ensemble: retain a candidate if any complete
scale passes, and preserve it for review if a requested context is unavailable.
The fitted weights and training-only threshold do not change. Evaluate that
protocol on fresh F sample centres separated by at least 3.5 metres from all
previous single-scale F test centres. Previous F measurements become historical
diagnostics, not the independent test for this protocol. Report positive-label
recovery at the base scale only; larger contexts in the compact labelled area
can overlap training plants and must not be called a new spatial holdout.

The 3× trial retained about one third of the D/E false proposals and was
rejected using training/validation data. Choose 1/2× before inspecting the fresh
F outcome. Require at least 80% rejection on that fresh negative sample and
preservation of the base-scale positive check. This is an explicit sensitivity /
specificity compromise, not a claim of 80% precision on A–C.
