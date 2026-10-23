import { analyzeHarmony } from "../harmony/analyze";
import { HARMONY_CATALOG } from "../harmony/catalog";
import type { HarmonyView, MeasurementDocument, NamedPoint } from "../harmony/types";
import { IDEALS_BY_KEY, idealRange, type IdealSpec, type RatingGender } from "./ideals";
import { powerMean } from "./scale";

export interface MeasurementScore {
  key: string;
  label: string;
  group: string;
  view: HarmonyView;
  value: number;
  unit: string;
  ideal: readonly [number, number];
  score: number;
  /** Importance after discounting for estimated landmarks. */
  weight: number;
  baseWeight: number;
  position: "below" | "within" | "above";
  reading: string;
  /** 0–1: how directly the contributing landmarks were observed. */
  evidence: number;
  reviewed: boolean;
}
/** Within-pillar exponent: gentler than the overall mean, still favours weak items. */
export const HARMONY_P = 0.5;
export const VIEW_SHARE: Record<HarmonyView, number> = { front: 0.6, side: 0.4 };
const TAU = 1.3;

/** 10 inside the ideal range, falling smoothly with distance outside it in population SDs. */
export function measurementScore(value: number, spec: IdealSpec, gender: RatingGender): number {
  const [lo, hi] = idealRange(spec, gender);
  const d = value < lo ? (lo - value) / spec.sd : value > hi ? (value - hi) / spec.sd : 0;
  return 10 * Math.exp(-0.5 * (d / TAU) ** 2);
}
function pointEvidence(point: NamedPoint | undefined): number {
  if (!point) return 0;
  if (point.reviewed || point.source === "manual") return 1;
  const c = point.confidence ?? 0.85;
  if (point.source === "estimated") return c < 0.4 ? 0.4 : 0.7;
  return c >= 0.6 ? 1 : 0.85;
}
/** Scores every available scored measurement of one view. Distances are always scored in % of face height. */
export function scoreView(view: HarmonyView, doc: MeasurementDocument | undefined, gender: RatingGender): MeasurementScore[] {
  if (!doc) return [];
  const { calibration: _ignored, ...normalized } = doc;
  const report = analyzeHarmony(view, normalized, {});
  const out: MeasurementScore[] = [];
  for (const m of report.measurements) {
    const spec = IDEALS_BY_KEY.get(m.key), def = HARMONY_CATALOG.find(d => d.key === m.key);
    if (!spec || !def || m.value === null) continue;
    const ideal = idealRange(spec, gender);
    const evidence = Math.min(...m.required.map(k => pointEvidence(normalized.points[k])));
    const position = m.value < ideal[0] ? "below" : m.value > ideal[1] ? "above" : "within";
    out.push({
      key: m.key, label: def.label, group: def.group, view, value: m.value, unit: m.unit, ideal,
      score: measurementScore(m.value, spec, gender), weight: spec.weight * evidence, baseWeight: spec.weight,
      position, reading: position === "within" ? "Within the ideal range" : position === "below" ? spec.low : spec.high,
      evidence, reviewed: m.status === "reviewed",
    });
  }
  return out;
}
/** Raw (uncalibrated) harmony of a set of scored items. */
export function rawHarmony(items: readonly MeasurementScore[]): number | null {
  return powerMean(items, HARMONY_P);
}
/** Front and side combined with their fixed shares, each view averaged within itself. */
export function rawCombinedHarmony(front: readonly MeasurementScore[], side: readonly MeasurementScore[]): number | null {
  const views = ([["front", front], ["side", side]] as const).filter(([, items]) => items.some(i => i.weight > 0));
  if (!views.length) return null;
  const share = views.reduce((s, [v]) => s + VIEW_SHARE[v], 0);
  let acc = 0;
  for (const [view, items] of views) {
    const total = items.reduce((s, i) => s + i.weight, 0);
    acc += VIEW_SHARE[view] / share * items.reduce((s, i) => s + i.weight * Math.pow(Math.max(0.05, i.score), HARMONY_P), 0) / total;
  }
  return Math.pow(acc, 1 / HARMONY_P);
}
