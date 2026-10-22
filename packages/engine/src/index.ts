import type {
  AreaKey,
  GateReport,
  ScanInput,
  ScanResult,
} from "./types";
import { buildFrame } from "./normalize";
import { runGates } from "./gates/index";
import { evaluateFrame } from "./scoring/evaluate";
import { diagnosticFromRefusal, validDiagnosticInput, type ScanDiagnostic } from "./scoring/diagnostic";
import {
  overallPercentileOf,
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

  const { metrics, aggregate: agg } = evaluateFrame(input, frame, gates, sex, bandProfile, true);
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

/** Optional inspection of a pose-refused photograph. The original analyze()
 * result stays refused. No blur, exposure, occlusion or topology gate is bypassed.
 */
export function analyzeDiagnostic(input: ScanInput): ScanDiagnostic | null {
  if (!validDiagnosticInput(input)) return null;
  return diagnosticFromRefusal(input, analyze(input));
}

// Public surface
export * from "./types";
export type { ScanDiagnostic } from "./scoring/diagnostic";
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
