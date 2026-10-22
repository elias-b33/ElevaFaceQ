import type {
  AreaKey,
  GateReport,
  MetricResult,
  ScanInput,
  ScanResult,
} from "./types";
import { buildFrame } from "./normalize";
import { runGates } from "./gates/index";
import { METRICS } from "./metrics/registry";
import { resolveBand } from "./scoring/bands";
import { round1, subScore, verdictOf } from "./scoring/curve";
import { aggregate } from "./scoring/aggregate";
import {
  overallPercentileOf,
  percentileOf,
  standardizedOverall,
} from "./scoring/norms";

export const ENGINE_VERSION = "0.1.0-local.2";

const EMPTY_AREAS: Record<AreaKey, { score: null; confidence: number }> = {
  symmetry: { score: null, confidence: 0 },
  eyeArea: { score: null, confidence: 0 },
  midface: { score: null, confidence: 0 },
  jawline: { score: null, confidence: 0 },
};

/**
 * The engine's single entry point. Deterministic: identical input produces a
 * byte-identical result. No DOM, no I/O, no randomness, no clock.
 */
export function analyze(input: ScanInput): ScanResult {
  const sex = input.sex ?? "neutral";
  const bandProfile = input.bandProfile ?? "faceharmony-parity";

  const missingFace = input.landmarks.length !== 468 && input.landmarks.length !== 478;
  const invalidImage = !Number.isFinite(input.imageWidth) || !Number.isFinite(input.imageHeight) || input.imageWidth <= 0 || input.imageHeight <= 0;
  const invalidLandmarks = Array.from(input.landmarks).some(p => !p || !Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.z))
    || Object.values(input.overrides ?? {}).some(p => !p || !Number.isFinite(p.x) || !Number.isFinite(p.y));
  if (missingFace || invalidImage || invalidLandmarks) {
    const gates: GateReport = {
      pass: false,
      blocking: [
        {
          code: missingFace ? "no-face" : invalidImage ? "invalid-image" : "invalid-landmarks",
          severity: "block",
          message: missingFace ? "No face detected." : invalidImage ? "The image dimensions are invalid." : "The landmark coordinates contain an invalid number.",
          retake: missingFace ? "Center your face in the frame with good lighting." : "Select a valid photograph and detect the landmarks again.",
        },
      ],
      warnings: [],
      confidenceMultiplier: 1,
      regionConfidence: {},
      jawEdgeSupport: null,
    };
    return {
      ok: false,
      gates,
      frame: null,
      metrics: [],
      areas: { ...EMPTY_AREAS },
      overall: null,
      overallPercentile: null,
      standardized: null,
      tier: null,
      engineVersion: ENGINE_VERSION,
      bandProfile,
      sex,
    };
  }

  const { frame } = buildFrame(input);
  const gates = runGates(input, frame);

  if (!gates.pass) {
    return {
      ok: false,
      gates,
      frame,
      metrics: [],
      areas: { ...EMPTY_AREAS },
      overall: null,
      overallPercentile: null,
      standardized: null,
      tier: null,
      engineVersion: ENGINE_VERSION,
      bandProfile,
      sex,
    };
  }

  const ctx = {
    image: input.image ?? null,
    gates,
    sex,
    hasIris: frame.hasIris,
  };

  const pitchUnknown = frame.pitchDeg === null;
  const metrics: MetricResult[] = [];
  const invalidMetrics: string[] = [];
  const weights: Record<string, { area: AreaKey; weight: number }> = {};

  for (const def of METRICS) {
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
      percentile: percentileOf(def.key, computed.value),
      detail: computed.detail,
    });
  }

  if (invalidMetrics.length) gates.warnings.push({
    code: "invalid-geometry", severity: "warn",
    message: `Undefined geometry was excluded: ${invalidMetrics.join(", ")}.`,
    retake: "Check coincident landmarks and use a level, relaxed front photograph.",
  });

  const agg = aggregate(metrics, weights);
  const refused = agg.overall === null;

  return {
    ok: !refused,
    gates: refused
      ? {
          ...gates,
          pass: false,
          blocking: [
            ...gates.blocking,
            {
              code: "insufficient-data",
              severity: "block",
              message: "Too much of the face couldn't be measured reliably.",
              retake: "Retake with even lighting, no occlusions, facing straight on.",
            },
          ],
        }
      : gates,
    frame,
    metrics,
    areas: agg.areas,
    overall: agg.overall,
    overallPercentile:
      agg.overall !== null && bandProfile === "calibrated"
        ? overallPercentileOf(agg.overall)
        : null,
    standardized:
      agg.overall !== null && bandProfile === "calibrated"
        ? standardizedOverall(agg.overall)
        : null,
    tier: agg.tier,
    engineVersion: ENGINE_VERSION,
    bandProfile,
    sex,
  };
}

// Public surface
export * from "./types";
export { buildFrame } from "./normalize";
export { runGates, eyeAspectRatio } from "./gates/index";
export { METRICS, TRICHION_K, computeJawEdgeSupport } from "./metrics/registry";
export { BANDS, resolveBand } from "./scoring/bands";
export { subScore, verdictOf, round1 } from "./scoring/curve";
export {
  percentileOf,
  overallPercentileOf,
  standardizedOverall,
  overallScoreStats,
  NORMS_META,
} from "./scoring/norms";
export { AREA_WEIGHTS, AREA_LABELS, aggregate, tierOf } from "./scoring/aggregate";
export * as LANDMARKS from "./landmarks/indices";
export {
  analyzeProfile,
  defaultProfileAnchors,
  profileFacing,
  PROFILE_ANCHOR_LABELS,
  PROFILE_ANCHOR_ORDER,
} from "./profile";
export type {
  ProfileAnchor,
  ProfileAnchorKey,
  ProfileAnchors,
  ProfileMetricKey,
  ProfileMetricResult,
} from "./profile";
export { CANONICAL_VERTS } from "./landmarks/canonical";
export { regionalResiduals } from "./procrustes";
export * from "./harmony/index";
export {
  estimatePose,
  eulerFromMatrix,
  isColumnMajor,
  yawAsymmetry,
  YAW_PROXY_TO_DEG,
} from "./pose";
