# Numerical audit — 22 October 2026

Geometry version: `local-geometry-2.1.0`. Classic scoring engine:
`0.1.0-local.2`. All computation remains in the browser. No dependency or model
was installed for this audit.

## What was verified

All **36 front and 35 profile definitions** have independent numerical cases in
[`harmony-audit.spec.ts`](packages/engine/test/harmony-audit.spec.ts). The two
drafting fixtures use explicit coordinates in a 200 × 200 unit image. Expected
values come from measured dimensions, rational line intersections and
`atan2(|cross|, dot)` calculations, independently of the production angle helper
and anatomical template. The fixture covers each catalog entry exactly once.

For example, the front fixture has a 140-unit cheek width, 80-unit brow-to-lip
height and 180-unit full face height. Its FWHR is **1.75**, its full height/width
ratio is **1.285714…**, and its three vertical thirds add to **100%**. A 3.5-unit
Cupid's bow depth is **1.944444…% FH**; a known 50-unit span representing 60 mm
converts that depth to **4.2 mm**. Profile lip distances are perpendicular to
their reference lines, with their signs tested independently.

Two seeded property tests each generate 100 combined transformations, exercising
**7,100 measurement comparisons** across translation, uniform scaling, roll,
image aspect and reflection of a profile. Separate cases check millimeter
conversion of every distance, unchanged ratios and angles, reflex convexity,
missing points, review dependencies, tangent stability and placement sensitivity.

The classic score has independent arithmetic and invalid-data tests in
[`scoring-audit.spec.ts`](packages/engine/test/scoring-audit.spec.ts). Its existing
reference bands, curve, area weights and rounding convention are retained.

## Corrections made

| Issue | Corrected behavior |
| --- | --- |
| Coincident endpoints passed through `atan2(0, 0)` as a plausible 0° | The affected direction is invalid and receives no measured value. |
| Calibrated distances still required hairline/chin points used only for normalization | A valid measured scale removes only those normalization dependencies. Chin points needed by a jaw construction remain required. |
| Invalid calibration endpoints blocked the documented normalized fallback | Distances fall back to % FH when face height is available; a warning identifies the invalid scale. |
| A saved mm range could be applied after fallback to % FH | Distance ranges are paused until calibration is repaired or removed. |
| Some front measurements could be marked reviewed without any leveling baseline | Both pupils, or both outer corners as the fallback, are required. Their review state contributes to every affected result. |
| Sensitivity samples could silently change from mm to % FH | A scale failure makes that envelope unavailable, with a placement warning. Samples in different units are never compared. |
| Tangent intersection rejection depended on drawn segment length | A normalized cross product rejects nearly parallel directions consistently across scale. |
| Zero visible upper lid was rejected as a zero denominator | A zero numerator is accepted; the actual eye-opening denominator must still be positive. |
| Reversed nose-to-chin lines could invert documented lip signs | Reversed vertical reference order is rejected. |
| `NaN` could receive a perfect classic subscore or the top percentile | Nonfinite data receives no valid subscore/percentile and is excluded from aggregation. Invalid image dimensions and landmark coordinates are rejected before normalization. |
| Removing a metric could leave its area's coverage at 100% | Coverage uses all expected metric weight, including missing/invalid results. The existing refusal rule applies if two areas lack sufficient evidence. |

The editor's contributing-point list, overlay selection and exported report now
use the same actual dependencies as calculation and sensitivity. These include
the active leveling and calibration endpoints.

## Definition sources and deliberate differences

The [FaceIQ public index](https://www.faceiqlabs.com/support/harmony) currently
identifies 66 definitions used in its score and five supporting definitions.
Our 71-measurement report does not manufacture a combined score from these;
the inherited 18-metric FreeHarmony index remains a separate result.

The source definitions were checked for division order, eye aspect, frontal jaw
angle, lid exposure and signed offsets. In particular,
[total face height/width](https://www.faceiqlabs.com/support/harmony/total-facial-width-to-height-ratio)
is height divided by width despite the source's report label. The
[E-line guide](https://www.faceiqlabs.com/support/harmony/upper-lip-e-line-position)
defines negative as ahead of the line and positive as behind. These conventions
are explicit in the local catalog and tests.

Existing local adaptations remain labeled in the app: averaged Cupid's bow
peaks, an acute undirected Z-angle, the explicit nasal-dorsum construction and
the soft-tissue ramus/mandible construction. For example, the
[current nasal-projection guide](https://www.faceiqlabs.com/support/harmony/nasal-projection)
describes extending a tip-to-rhinion direction; our declared adaptation extends
nasion-to-supratip to glabella height. A numerical test of our construction is
not evidence that it duplicates the vendor's private implementation.

FaceIQ's distance guides describe scaling with an assumed 190 mm face height.
This app uses **% of marked vertical face height**, or a user-supplied actual
distance in the same image plane. It does not label an assumed face size as a
calibrated millimeter measurement.

## Practical limits and saved reports

These tests verify arithmetic and coordinate handling. They do not establish
landmark accuracy on real photos, validate reference ranges as beauty targets,
or validate a universal attractiveness score. Automatic profile ear, orbital and
jaw points can be inferred and remain provisional until the user reviews them.
Photo perspective and out-of-plane head rotation are not corrected by 2D roll
leveling. The ±2-pixel envelope moves one coordinate at a time; it is not a
statistical confidence interval or a bound on all photo/placement error.

The 71-measurement report is recomputed from saved named points with the current
geometry version. Historical classic scores keep their original engine version;
the scoring guardrails apply when a scan is newly calculated or rerun. Original
photos, saved point positions and reviewed corrections are not rewritten.
