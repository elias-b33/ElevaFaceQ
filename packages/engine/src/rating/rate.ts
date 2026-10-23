import { analyzeHarmony } from "../harmony/analyze";
import type { MeasurementDocument } from "../harmony/types";
import calibrationData from "./calibration.json";
import { VIEW_SHARE, rawCombinedHarmony, rawHarmony, scoreView, type MeasurementScore } from "./harmony";
import type { RatingGender } from "./ideals";
import type { ImageFeatures } from "./image-features";
import { ASSESSMENTS, OVERALL_P, PILLAR_LABELS, PILLAR_P, assessmentValue, type AssessmentDef, type Calibration, type PillarKey } from "./pillars";
import { itemLabel, percentileOfScore, powerMean, rarityOfScore, scoreFromZ, scoreLabel } from "./scale";

export const RATING_VERSION = "rating-1.0";
export const CALIBRATION = calibrationData as Calibration;

export interface ScoreSummary { score: number; label: string; percentile: number; rarity: number }
export interface AssessmentScore { key: string; label: string; pillar: PillarKey; score: number; weight: number; reading: string; grade: ReturnType<typeof itemLabel> }
export interface PillarResult { key: PillarKey; label: string; description: string; summary: ScoreSummary | null; items: AssessmentScore[]; coverage: number }
export interface Impact {
  key: string;
  label: string;
  pillar: PillarKey;
  kind: "measurement" | "assessment";
  score: number;
  /** Change in the overall score: positive for strengths, negative for flaws. */
  impact: number;
  reading: string;
  value?: number;
  unit?: string;
  ideal?: readonly [number, number];
}
export interface RatingResult {
  version: string;
  gender: RatingGender;
  overall: ScoreSummary | null;
  /** Overall score if the five largest flaws reached their ideal. */
  potential: number | null;
  pillars: Record<PillarKey, PillarResult>;
  harmony: { front: ScoreSummary | null; side: ScoreSummary | null; measurements: MeasurementScore[] };
  strengths: Impact[];
  flaws: Impact[];
  /** True once front and side are both measured and all four pillars are scored. */
  complete: boolean;
  notes: string[];
}
export interface RateInput {
  gender: RatingGender;
  front?: MeasurementDocument;
  side?: MeasurementDocument;
  image?: ImageFeatures | null;
}

/** Dimorphism readings describe masculinity; for a feminine target a high score reads as feminine. */
const reads = (def: AssessmentDef, score: number, gender: RatingGender) => (score >= 5) !== (!!def.dimorphic && gender === "female") ? def.high : def.low;
const summary = (score: number | null): ScoreSummary | null => score === null || !Number.isFinite(score) ? null : { score, label: scoreLabel(score), percentile: percentileOfScore(score), rarity: rarityOfScore(score) };
const MIN_ITEMS = { front: 15, side: 12 };

/** Every measurement value (scored and supporting), in % of face height for distances. */
function measurementValues(doc: MeasurementDocument | undefined, view: "front" | "side"): Record<string, number> {
  if (!doc) return {};
  const { calibration: _ignored, ...normalized } = doc;
  return Object.fromEntries(analyzeHarmony(view, normalized, {}).measurements.filter(m => m.value !== null).map(m => [m.key, m.value!]));
}
function harmonyScore(raw: number | null, which: "front" | "side" | "combined", gender: RatingGender, cal: Calibration): number | null {
  if (raw === null) return null;
  const s = cal.harmony[which][gender];
  return scoreFromZ(-(Math.log(10.1 - Math.min(10, raw)) - s.mean) / s.sd);
}
function pillarScore(items: readonly { score: number; weight: number }[], key: Exclude<PillarKey, "harmony">, gender: RatingGender, cal: Calibration): number | null {
  const raw = powerMean(items, PILLAR_P);
  if (raw === null) return null;
  const s = cal.pillars[key][gender];
  return scoreFromZ((raw - s.mean) / s.sd);
}

export function rateFace(input: RateInput, cal: Calibration = CALIBRATION): RatingResult {
  const { gender } = input;
  const notes: string[] = [];
  let front = scoreView("front", input.front, gender), side = scoreView("side", input.side, gender);
  if (front.length && front.length < MIN_ITEMS.front) { notes.push("Too few front measurements are available for a front harmony score. Check the front landmarks."); front = []; }
  if (side.length && side.length < MIN_ITEMS.side) { notes.push("Too few profile measurements are available for a side harmony score. Check the profile landmarks."); side = []; }
  if (!input.side) notes.push("Add a side profile to complete Harmony (about 40% of it) and the chin, under-chin and brow-ridge assessments.");
  const inputs = assessmentInputs(input);
  if (!input.image && input.front) notes.push("Photo-based assessments need the original front photo analysis; geometry-only assessments are shown.");

  // Harmony: each view calibrated on its own; the pillar combines 60% front / 40% side.
  const harmonyOf = (f: readonly MeasurementScore[], s: readonly MeasurementScore[]) => {
    if (f.length && s.length) return harmonyScore(rawCombinedHarmony(f, s), "combined", gender, cal);
    if (f.length) return harmonyScore(rawHarmony(f), "front", gender, cal);
    if (s.length) return harmonyScore(rawHarmony(s), "side", gender, cal);
    return null;
  };
  const harmony = harmonyOf(front, side);

  // Assessments and their pillars.
  const assessed = new Map<string, { def: AssessmentDef; score: number }>();
  for (const def of ASSESSMENTS) {
    const v = assessmentValue(def, inputs, cal), s = cal.assessments[def.key]?.[gender];
    if (v === null || !s || !(s.sd > 0)) continue;
    const z = (v - s.mean) / s.sd;
    assessed.set(def.key, { def, score: scoreFromZ(def.dimorphic && gender === "female" ? -z : z) });
  }
  const pillarItems = (key: Exclude<PillarKey, "harmony">, override?: { key: string; score: number }) => ASSESSMENTS.filter(d => d.pillar === key && assessed.has(d.key)).map(d => ({ key: d.key, weight: d.weight, score: override?.key === d.key ? override.score : assessed.get(d.key)!.score }));
  const coverageOf = (key: Exclude<PillarKey, "harmony">) => {
    const defs = ASSESSMENTS.filter(d => d.pillar === key), total = defs.reduce((s, d) => s + d.weight, 0);
    return defs.filter(d => assessed.has(d.key)).reduce((s, d) => s + d.weight, 0) / total;
  };
  const scoredPillar = (key: Exclude<PillarKey, "harmony">, override?: { key: string; score: number }) => coverageOf(key) >= .55 ? pillarScore(pillarItems(key, override), key, gender, cal) : null;
  const pillarScores: Record<PillarKey, number | null> = { harmony, angularity: scoredPillar("angularity"), dimorphism: scoredPillar("dimorphism"), features: scoredPillar("features") };
  const overallOf = (p: Record<PillarKey, number | null>) => {
    const values = Object.values(p);
    return values.every(v => v !== null) ? powerMean(values.map(score => ({ score: score!, weight: 1 })), OVERALL_P) : null;
  };
  const overall = overallOf(pillarScores);

  // Strengths and flaws: change in the overall score when an item becomes ideal (flaw) or typical (strength).
  const impacts: (Impact & { gain: number; loss: number })[] = [];
  const measurementItems = [...front, ...side];
  const harmonyWith = (key: string, score: number) => {
    const swap = (items: readonly MeasurementScore[]) => items.map(i => i.key === key ? { ...i, score } : i);
    return harmonyOf(swap(front), swap(side));
  };
  if (overall !== null) {
    for (const m of measurementItems) {
      if (m.weight <= 0) continue;
      const ideal = overallOf({ ...pillarScores, harmony: harmonyWith(m.key, 10) })!, typical = overallOf({ ...pillarScores, harmony: harmonyWith(m.key, 6) })!;
      impacts.push({ key: m.key, label: m.label, pillar: "harmony", kind: "measurement", score: m.score, impact: 0, gain: ideal - overall, loss: overall - typical, reading: m.position === "within" ? m.reading : m.score >= 7 ? "Close to the ideal range" : m.reading, value: m.value, unit: m.unit, ideal: m.ideal });
    }
    for (const { def, score } of assessed.values()) {
      const ideal = overallOf({ ...pillarScores, [def.pillar]: scoredPillar(def.pillar, { key: def.key, score: 10 }) })!;
      const typical = overallOf({ ...pillarScores, [def.pillar]: scoredPillar(def.pillar, { key: def.key, score: 5 }) })!;
      impacts.push({ key: def.key, label: def.label, pillar: def.pillar, kind: "assessment", score, impact: 0, gain: ideal - overall, loss: overall - typical, reading: reads(def, score, gender) });
    }
  }
  const flaws = impacts.filter(i => i.score < 7 && i.gain >= .02).sort((a, b) => b.gain - a.gain).slice(0, 12).map(({ gain, loss: _l, ...i }) => ({ ...i, impact: -gain }));
  const strengths = impacts.filter(i => i.score >= 7 && i.loss >= .02).sort((a, b) => b.loss - a.loss).slice(0, 12).map(({ gain: _g, loss, ...i }) => ({ ...i, impact: loss }));
  let potential: number | null = null;
  if (overall !== null && flaws.length) {
    const fix = new Set(flaws.slice(0, 5).map(f => f.key));
    const swap = (items: readonly MeasurementScore[]) => items.map(i => fix.has(i.key) ? { ...i, score: 10 } : i);
    const p: Record<PillarKey, number | null> = { ...pillarScores, harmony: harmonyOf(swap(front), swap(side)) };
    for (const key of ["angularity", "dimorphism", "features"] as const) {
      const items = pillarItems(key).map(i => fix.has(i.key) ? { ...i, score: 10 } : i);
      p[key] = coverageOf(key) >= .55 ? pillarScore(items, key, gender, cal) : null;
    }
    potential = overallOf(p);
  }

  const pillar = (key: PillarKey): PillarResult => {
    const items: AssessmentScore[] = key === "harmony" ? [] : ASSESSMENTS.filter(d => d.pillar === key && assessed.has(d.key)).map(d => {
      const score = assessed.get(d.key)!.score;
      return { key: d.key, label: d.label, pillar: key, score, weight: d.weight, reading: reads(d, score, gender), grade: itemLabel(score) };
    });
    return { key, ...PILLAR_LABELS[key], summary: summary(pillarScores[key]), items, coverage: key === "harmony" ? (front.length ? VIEW_SHARE.front : 0) + (side.length ? VIEW_SHARE.side : 0) : coverageOf(key) };
  };
  return {
    version: RATING_VERSION, gender,
    overall: summary(overall), potential,
    pillars: { harmony: pillar("harmony"), angularity: pillar("angularity"), dimorphism: pillar("dimorphism"), features: pillar("features") },
    harmony: { front: summary(front.length ? harmonyScore(rawHarmony(front), "front", gender, cal) : null), side: summary(side.length ? harmonyScore(rawHarmony(side), "side", gender, cal) : null), measurements: measurementItems },
    strengths, flaws,
    complete: !!front.length && !!side.length && Object.values(pillarScores).every(v => v !== null),
    notes,
  };
}
function assessmentInputs(input: RateInput): Record<string, number> {
  const inputs: Record<string, number> = { ...measurementValues(input.front, "front"), ...measurementValues(input.side, "side") };
  for (const [k, v] of Object.entries(input.image ?? {})) if (typeof v === "number" && k !== "version") inputs[`img.${k}`] = v;
  return inputs;
}
/** Uncalibrated values that the calibration script standardises (exported for reproducibility). */
export function ratingInputs(input: RateInput) {
  const front = scoreView("front", input.front, input.gender), side = scoreView("side", input.side, input.gender);
  return { front, side, inputs: assessmentInputs(input), raw: { front: front.length ? rawHarmony(front) : null, side: side.length ? rawHarmony(side) : null, combined: front.length && side.length ? rawCombinedHarmony(front, side) : null } };
}
