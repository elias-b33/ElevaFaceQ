import { APPEAL, HARMONY_CATALOG, IDEALS, idealRange, rateFace, type HarmonySettings, type RatingGender, type RatingResult, type Sex } from "@freeharmony/engine";
import { scanDocuments } from "./harmony";
import type { StoredScan } from "./store";

export function genderFromSex(sex: Sex | undefined): RatingGender | undefined {
  return sex === "masculine" ? "male" : sex === "feminine" ? "female" : undefined;
}
/** The gender a study is rated against: chosen when it was created, else its reference model. */
export function scanGender(scan: StoredScan): RatingGender {
  return scan.gender ?? genderFromSex(scan.result.sex) ?? "male";
}
/** Rate a study from its current (possibly unsaved) landmark documents. */
export function rateScan(scan: StoredScan, settings: HarmonySettings = scanDocuments(scan), gender: RatingGender = scanGender(scan)): RatingResult {
  return rateFace({ gender, front: settings.front, side: settings.side, image: scan.imageFeatures ?? null, appeal: scan.appeal?.version === APPEAL.version ? scan.appeal.raw : null });
}
export const formatScore = (score: number | null | undefined) => score === null || score === undefined ? "—" : score.toFixed(1);
export function formatRarity(rarity: number): string {
  if (!Number.isFinite(rarity)) return "1 in 100,000+";
  if (rarity >= 100_000) return "1 in 100,000+";
  return `1 in ${rarity >= 100 ? Math.round(rarity / 10) * 10 : rarity >= 10 ? Math.round(rarity) : rarity.toFixed(1)}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
/** "Top 6%" above average, "Bottom 30%" below. */
export function formatStanding(percentile: number): string {
  if (percentile >= 50) { const top = 100 - percentile; return `Top ${top < 1 ? top.toFixed(1) : Math.round(top)}%`; }
  return `Bottom ${percentile < 1 ? percentile.toFixed(1) : Math.round(percentile)}%`;
}
const decimals = (unit: string) => unit === "°" || unit === "%" || unit === "% FH" ? 1 : 2;
const unitSuffix = (unit: string) => unit === "×" ? " ×" : unit === "mm" || unit === "% FH" ? ` ${unit}` : unit;
function fixed(value: number, digits: number): string {
  const text = value.toFixed(digits);
  return /^-0\.?0*$/.test(text) ? text.slice(1) : text.replace("-", "−");
}
/** A measured value. Outside its ideal range it gains decimals rather than rounding onto the range's edge. */
export function formatValue(value: number, unit: string, ideal?: readonly [number, number]): string {
  let digits = decimals(unit);
  const edge = !ideal ? null : value < ideal[0] ? ideal[0] : value > ideal[1] ? ideal[1] : null;
  while (edge !== null && digits < 4 && fixed(value, digits) === fixed(edge, digits)) digits++;
  return fixed(value, digits) + unitSuffix(unit);
}
export function formatRange([lo, hi]: readonly [number, number], unit: string): string {
  const digits = decimals(unit);
  return `${fixed(lo, digits)}${lo < 0 ? " to " : "–"}${fixed(hi, digits)}${unitSuffix(unit)}`;
}
/** An item score; 10.0 is kept for values inside the ideal range. */
export function formatItemScore(score: number, value?: number, ideal?: readonly [number, number]): string {
  const outside = value !== undefined && ideal !== undefined && (value < ideal[0] || value > ideal[1]);
  return (outside ? Math.min(score, 9.9) : score).toFixed(1);
}
export function formatImpact(impact: number): string {
  return `${impact >= 0 ? "+" : "−"}${Math.abs(impact).toFixed(2)}`;
}
/** The rating's ideal ranges as harmony display ranges (distances only while uncalibrated). */
export function withIdeals(settings: HarmonySettings, gender: RatingGender): HarmonySettings {
  const ranges: NonNullable<HarmonySettings["ranges"]> = {};
  for (const spec of IDEALS) {
    const def = HARMONY_CATALOG.find(d => d.key === spec.key);
    if (def?.unit === "distance" && settings[def.view]?.calibration) continue;
    const [lo, hi] = idealRange(spec, gender);
    ranges[spec.key] = { lo, hi };
  }
  return { ...settings, ranges, descriptiveOnly: false };
}
