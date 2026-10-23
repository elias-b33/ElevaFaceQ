/**
 * The 0–10 rating scale. 5 is the population average and the scale is
 * percentile-based and non-linear: rarity grows quickly away from 5 and is
 * symmetrical, so a 3 is as uncommon as a 7. Anchors follow the published
 * FaceIQ Labs score guide (7 ≈ 1 in 18, 8 ≈ 1 in 250, 9 ≈ 1 in 20,000).
 */

/** [standard-normal z, score] pairs for the upper half; the lower half mirrors them. */
const ANCHORS: readonly (readonly [number, number])[] = [
  [0, 5], [0.566, 6], [1.02, 6.5], [1.593, 7], [2.128, 7.5], [2.652, 8], [3.353, 8.5], [3.891, 9], [4.265, 9.5], [5, 10],
];

export function scoreFromZ(z: number): number {
  if (!Number.isFinite(z)) return 5;
  const a = Math.abs(z), sign = Math.sign(z);
  for (let i = 1; i < ANCHORS.length; i++) {
    const [z0, s0] = ANCHORS[i - 1]!, [z1, s1] = ANCHORS[i]!;
    if (a <= z1) return 5 + sign * (s0 + (s1 - s0) * (a - z0) / (z1 - z0) - 5);
  }
  return sign > 0 ? 10 : 0;
}
export function zFromScore(score: number): number {
  const s = Math.max(0, Math.min(10, score)), d = Math.abs(s - 5), sign = Math.sign(s - 5);
  for (let i = 1; i < ANCHORS.length; i++) {
    const [z0, s0] = ANCHORS[i - 1]!, [z1, s1] = ANCHORS[i]!;
    if (d + 5 <= s1) return sign * (z0 + (z1 - z0) * (d + 5 - s0) / (s1 - s0));
  }
  return sign * 5;
}
/** Standard normal CDF (Abramowitz–Stegun 7.1.26, |error| < 1.5e-7). */
export function normalCdf(z: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2);
  const erf = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(z * z) / 2);
  return z >= 0 ? (1 + erf) / 2 : (1 - erf) / 2;
}
/** Share of the population scoring at or below this score, 0–100. */
export function percentileOfScore(score: number): number {
  return 100 * normalCdf(zFromScore(score));
}
/** "1 in N" rarity of a score at least this far from average, in its direction. */
export function rarityOfScore(score: number): number {
  const p = normalCdf(-Math.abs(zFromScore(score)));
  return p > 0 ? 1 / p : Infinity;
}

const LABELS: readonly (readonly [number, string])[] = [
  [9.5, "Near-idealised"], [9, "Approaching perfection"], [8.5, "Outstanding"], [8, "Exceptional"], [7.5, "Excellent"],
  [7, "Great"], [6.5, "Very good"], [6, "Good"], [5.5, "Above average"], [4.5, "Average"], [4, "Below average"],
  [3, "Poor"], [0, "Extreme disharmony"],
];
export function scoreLabel(score: number): string {
  return LABELS.find(([min]) => score >= min)?.[1] ?? "Extreme disharmony";
}
/** Label for a single measurement or assessment score. */
export function itemLabel(score: number): "Ideal" | "Strong" | "Good" | "Fair" | "Weak" | "Poor" {
  return score >= 9.5 ? "Ideal" : score >= 8 ? "Strong" : score >= 6.5 ? "Good" : score >= 5 ? "Fair" : score >= 3 ? "Weak" : "Poor";
}
export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
/**
 * Weighted power mean. p < 1 favours weaker items (p → 0 is the geometric
 * mean); scores are floored slightly above zero so one item cannot zero it.
 */
export function powerMean(items: readonly { score: number; weight: number }[], p: number): number | null {
  const valid = items.filter(i => i.weight > 0 && Number.isFinite(i.score));
  const total = valid.reduce((s, i) => s + i.weight, 0);
  if (!valid.length || total <= 0) return null;
  const floor = (s: number) => Math.max(0.05, Math.min(10, s));
  if (Math.abs(p) < 1e-9) return Math.exp(valid.reduce((s, i) => s + i.weight * Math.log(floor(i.score)), 0) / total);
  return Math.pow(valid.reduce((s, i) => s + i.weight * Math.pow(floor(i.score), p), 0) / total, 1 / p);
}
