export type HarmonyView = "front" | "side";
export interface XY { x: number; y: number }
export interface NamedPoint extends XY {
  source: "mesh" | "contour" | "estimated" | "manual" | "template";
  reviewed: boolean;
  /** Heuristic placement quality, not a calibrated probability. */
  confidence?: number;
  evidence?: string;
}
export interface LandmarkDefinition {
  key: string;
  label: string;
  hint: string;
  group: string;
  view: HarmonyView;
  template: XY;
  mesh?: number | readonly number[];
  /** A model coordinate can seed the editor without being an anatomical measurement. */
  manual?: boolean;
}
export interface MeasurementDocument {
  points: Record<string, NamedPoint>;
  aspect: number;
  imageHeight: number;
  updatedAt: number;
  calibration?: { from: string; to: string; millimeters: number };
  automatic?: {
    engine: string;
    at: number;
    detected: number;
    estimated: number;
    missing: number;
    warnings: string[];
    facing?: "left" | "right";
    meshFound: boolean;
  };
}
export interface ReferenceRange { lo: number; hi: number }
export interface HarmonySettings {
  version: 1;
  front?: MeasurementDocument;
  side?: MeasurementDocument;
  /** null explicitly disables a working range. */
  ranges?: Record<string, ReferenceRange | null>;
  descriptiveOnly?: boolean;
  notes?: string;
}
export interface Construction {
  points: Record<string, XY>;
  aspect: number;
  mmPerUnit: number | null;
  faceHeight: number;
}
export interface MeasurementDefinition {
  key: string;
  label: string;
  view: HarmonyView;
  group: string;
  unit: "ratio" | "deg" | "pct" | "distance";
  required: readonly string[];
  /** Extra face-height endpoints needed only without a valid measured scale. */
  normalizationOnly?: readonly string[];
  lines: readonly (readonly string[])[];
  formula: string;
  explanation: string;
  caution: string;
  source: string;
  supporting?: boolean;
  adaptation?: string;
  reference?: ReferenceRange;
  compute: (context: Construction) => number;
}
export interface HarmonyMeasurement {
  key: string;
  value: number | null;
  unit: string;
  status: "missing" | "invalid" | "provisional" | "reviewed";
  /** Actual anatomy, leveling and scale dependencies for this result. */
  required: string[];
  missing: string[];
  unreviewed: string[];
  reason?: string;
  reference: ReferenceRange | null;
  position: "below" | "within" | "above" | null;
  /** Deterministic perturbation envelope, not a statistical confidence interval. */
  sensitivity: { lo: number; hi: number; pixels: number } | null;
}
export interface HarmonyReport {
  version: string;
  view: HarmonyView;
  measurements: HarmonyMeasurement[];
  total: number;
  available: number;
  reviewed: number;
  inRange: number;
  compared: number;
  warnings: string[];
  roll: number | null;
  calibrated: boolean;
}
