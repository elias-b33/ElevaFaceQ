import type { AreaKey, AreaResult, BandProfile, Frame, GateReport, MetricResult, ScanInput, ScanResult, Sex } from "../types";
import { evaluateFrame } from "./evaluate";

/** A rejected photograph's provisional geometry calculation, never an accepted
 * ScanResult, population percentile, or learned attractiveness prediction.
 */
export interface ScanDiagnostic {
  kind: "post-refusal-diagnostic";
  provisional: true;
  accepted: false;
  /** Existing 0–100 geometry aggregate over eligible areas; null with poor coverage. */
  provisionalOverall: number | null;
  areas: Record<AreaKey, AreaResult>;
  omittedAreas: AreaKey[];
  /** Original blocking gates remain present and pass remains false. */
  gates: GateReport;
  /** Metric percentiles are always null for this provisional calculation. */
  metrics: MetricResult[];
  frame: Frame;
  bandProfile: BandProfile;
  sex: Sex;
  engineVersion: string;
}

const POSE_BLOCKS = new Set(["yaw", "pitch", "roll"]);
const finitePositive = (n: number) => Number.isFinite(n) && n > 0;

/** Additional defensive checks apply only to the optional diagnostic boundary.
 * analyze() keeps its existing validation and refusal behavior unchanged.
 */
export function validDiagnosticInput(input: ScanInput): boolean {
  if (!input || !Array.isArray(input.landmarks) || ![468, 478].includes(input.landmarks.length)) return false;
  if (!finitePositive(input.imageWidth) || !finitePositive(input.imageHeight)) return false;
  if (Array.from(input.landmarks).some(p => !p || ![p.x, p.y, p.z].every(Number.isFinite) || p.x < 0 || p.x > 1 || p.y < 0 || p.y > 1)) return false;
  if (Object.values(input.overrides ?? {}).some(p => !p || ![p.x, p.y].every(Number.isFinite) || p.x < 0 || p.x > 1 || p.y < 0 || p.y > 1)) return false;
  if (input.transformationMatrix !== undefined &&
    (!Array.isArray(input.transformationMatrix) || input.transformationMatrix.length !== 16 || !Array.from(input.transformationMatrix).every(Number.isFinite))) return false;
  if (Object.values(input.blendshapes ?? {}).some(value => !Number.isFinite(value))) return false;
  if (input.bandProfile !== undefined && !["faceharmony-parity", "literature", "calibrated"].includes(input.bandProfile)) return false;
  if (input.sex !== undefined && !["neutral", "masculine", "feminine"].includes(input.sex)) return false;
  if (input.image) {
    const image = input.image;
    if (!Number.isSafeInteger(image.width) || !Number.isSafeInteger(image.height) || image.width <= 0 || image.height <= 0 ||
      image.width !== input.imageWidth || image.height !== input.imageHeight ||
      !(image.data instanceof Uint8ClampedArray) || image.data.length !== image.width * image.height * 4) return false;
  }
  return true;
}

export function diagnosticFromRefusal(input: ScanInput, original: ScanResult): ScanDiagnostic | null {
  if (original.ok || original.gates.pass || !original.frame || !original.gates.blocking.length ||
    original.gates.blocking.some(gate => !POSE_BLOCKS.has(gate.code))) return null;
  const frame = original.frame;
  if (!finitePositive(frame.scale) || !Number.isFinite(frame.rollDeg) || !Number.isFinite(frame.yawAsym) ||
    (frame.yawDeg !== null && !Number.isFinite(frame.yawDeg)) ||
    (frame.pitchDeg !== null && !Number.isFinite(frame.pitchDeg)) ||
    Array.from(frame.pts).some(p => !p || ![p.x, p.y, p.z].every(Number.isFinite))) return null;

  // evaluateFrame can append invalid-geometry warnings; preserve the original
  // refusal report so a diagnostic cannot rewrite its normal analysis result.
  const gates: GateReport = {
    ...original.gates,
    blocking: original.gates.blocking.map(gate => ({ ...gate })),
    warnings: original.gates.warnings.map(gate => ({ ...gate })),
    regionConfidence: { ...original.gates.regionConfidence },
  };
  const evaluated = evaluateFrame(input, frame, gates, original.sex, original.bandProfile, false);
  return {
    kind: "post-refusal-diagnostic", provisional: true, accepted: false,
    provisionalOverall: evaluated.aggregate.overall,
    areas: evaluated.aggregate.areas,
    omittedAreas: (Object.keys(evaluated.aggregate.areas) as AreaKey[]).filter(area => evaluated.aggregate.areas[area].score === null),
    gates, metrics: evaluated.metrics, frame,
    bandProfile: original.bandProfile, sex: original.sex, engineVersion: original.engineVersion,
  };
}
