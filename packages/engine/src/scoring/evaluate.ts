import type { AreaKey, BandProfile, Frame, GateReport, MetricResult, ScanInput, Sex } from "../types";
import { METRICS } from "../metrics/registry";
import { aggregate } from "./aggregate";
import { resolveBand } from "./bands";
import { round1, subScore, verdictOf } from "./curve";
import { percentileOf } from "./norms";

/** Shared metric and coverage calculation for accepted scans and diagnostics.
 * The caller owns the gate decision. No confidence or coverage rules are relaxed.
 */
export function evaluateFrame(
  input: ScanInput,
  frame: Frame,
  gates: GateReport,
  sex: Sex,
  bandProfile: BandProfile,
  includePercentiles: boolean,
) {
  const ctx = { image: input.image ?? null, gates, sex, hasIris: frame.hasIris };
  const pitchUnknown = frame.pitchDeg === null;
  const metrics: MetricResult[] = [];
  const invalidMetrics: string[] = [];
  const weights: Record<string, { area: AreaKey; weight: number }> = {};

  for (const def of METRICS) {
    // Expected weights include omitted measurements so missing geometry cannot
    // inflate the area's coverage. Keep this before every early continue.
    weights[def.key] = { area: def.area, weight: def.weight };
    const computed = def.compute(frame, ctx);
    if (computed === null) continue;
    if (!Number.isFinite(computed.value) || !Number.isFinite(computed.confidence)) {
      invalidMetrics.push(def.label);
      continue;
    }
    let confidence = computed.confidence * gates.confidenceMultiplier;
    const regionCap = gates.regionConfidence[def.region];
    if (regionCap !== undefined) confidence = Math.min(confidence, regionCap);
    if (def.vertical && pitchUnknown) confidence = Math.min(confidence, 0.55);
    confidence = Math.max(0, Math.min(1, confidence));

    const band = resolveBand(def.bands[bandProfile], sex);
    const score = round1(subScore(computed.value, band));
    if (!Number.isFinite(score)) { invalidMetrics.push(def.label); continue; }
    metrics.push({
      key: def.key,
      label: def.label,
      value: computed.value,
      unit: def.unit,
      band,
      score,
      verdict: verdictOf(score),
      confidence,
      flags: computed.flags ?? [],
      percentile: includePercentiles ? percentileOf(def.key, computed.value) : null,
      detail: computed.detail,
    });
  }

  if (invalidMetrics.length) gates.warnings.push({
    code: "invalid-geometry", severity: "warn",
    message: `Undefined geometry was excluded: ${invalidMetrics.join(", ")}.`,
    retake: "Check coincident landmarks and use a level, relaxed front photograph.",
  });

  return { metrics, aggregate: aggregate(metrics, weights) };
}
