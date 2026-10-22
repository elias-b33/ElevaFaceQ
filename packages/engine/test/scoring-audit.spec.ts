import { describe, expect, it } from "vitest";
import { analyze, type MetricKey, type MetricResult } from "../src/index";
import { aggregate } from "../src/scoring/aggregate";
import { subScore } from "../src/scoring/curve";
import { overallPercentileOf, percentileOf, standardizedOverall } from "../src/scoring/norms";
import { canonicalInput } from "./helpers";

function metric(key: MetricKey, score = 80, confidence = 1): MetricResult {
  return { key, label: key, value: 1, unit: "ratio", band: { lo: .9, hi: 1.1 }, score, confidence, verdict: "near-ideal", flags: [], percentile: null };
}
const WEIGHTS = {
  overallSymmetry: { area: "symmetry", weight: 1 },
  canthalTilt: { area: "eyeArea", weight: 1 },
  midfaceRatio: { area: "midface", weight: .1 },
  fwhr: { area: "midface", weight: .9 },
  jawAngularity: { area: "jawline", weight: 1 },
} as const;
const COMPLETE = [metric("overallSymmetry"), metric("canthalTilt"), metric("midfaceRatio"), metric("fwhr"), metric("jawAngularity")];

describe("score arithmetic and missing evidence", () => {
  it("never turns an undefined raw value into a perfect subscore", () => {
    for (const value of [NaN, Infinity, -Infinity]) expect(Number.isNaN(subScore(value, { lo: 1, hi: 2 }))).toBe(true);
  });
  it("does not assign percentiles to undefined measurements or scores", () => {
    for (const value of [NaN, Infinity, -Infinity]) {
      expect(percentileOf("canthalTilt", value)).toBeNull();
      expect(overallPercentileOf(value)).toBeNull();
      expect(standardizedOverall(value)).toBeNull();
    }
  });
  it("uses all expected weight when measuring area coverage", () => {
    const result = aggregate(COMPLETE.filter(m => m.key !== "fwhr"), WEIGHTS);
    expect(result.areas.midface.confidence).toBeCloseTo(.1, 12);
    expect(result.areas.midface.score).toBeNull();
    expect(result.overall).toBe(80);
  });
  it("refuses an overall score when two areas lack sufficient evidence", () => {
    const result = aggregate(COMPLETE.filter(m => m.key !== "fwhr" && m.key !== "jawAngularity"), WEIGHTS);
    expect(result.overall).toBeNull(); expect(result.tier).toBeNull();
  });
  it.each([NaN, Infinity, -Infinity])("excludes invalid scores from the rollup (%s)", score => {
    const result = aggregate(COMPLETE.map(m => m.key === "fwhr" ? { ...m, score } : m), WEIGHTS);
    expect(result.areas.midface.score).toBeNull();
    expect(result.areas.midface.confidence).toBeCloseTo(.1, 12);
    expect(result.overall).toBe(80);
  });
  it("matches a hand-calculated confidence-weighted example", () => {
    // Midface: (.1·1·20 + .9·.5·100) / (.1·1 + .9·.5) = 85.45 → 85.
    // Overall: (.18·80 + .28·80 + .27·.55·85 + .27·80) / .8785 = 80.845 → 80.8.
    const rows = COMPLETE.map(m => m.key === "midfaceRatio" ? { ...m, score: 20 } : m.key === "fwhr" ? { ...m, score: 100, confidence: .5 } : m);
    const result = aggregate(rows, WEIGHTS);
    expect(result.areas.midface.confidence).toBeCloseTo(.55, 12);
    expect(result.areas.midface.score).toBe(85); expect(result.overall).toBe(80.8);
  });
});

describe("classic engine numeric input validation", () => {
  it.each([NaN, Infinity, -Infinity])("refuses nonfinite landmark coordinates (%s)", value => {
    const input = canonicalInput(); input.landmarks[1]!.x = value;
    const result = analyze(input);
    expect(result.ok).toBe(false); expect(result.overall).toBeNull(); expect(result.metrics).toEqual([]);
    expect(result.gates.blocking.some(g => g.code === "invalid-landmarks")).toBe(true);
  });
  it.each([0, -1, NaN, Infinity])("refuses an invalid image dimension (%s)", imageWidth => {
    const result = analyze(canonicalInput({ imageWidth }));
    expect(result.ok).toBe(false); expect(result.overall).toBeNull();
    expect(result.gates.blocking.some(g => g.code === "invalid-image")).toBe(true);
  });
  it("excludes a ratio with a zero denominator and explains the missing metric", () => {
    const input = canonicalInput(); input.landmarks[0] = { ...input.landmarks[13]! };
    const result = analyze(input);
    expect(result.metrics.some(m => m.key === "lipRatio")).toBe(false);
    expect(result.gates.warnings.some(g => g.code === "invalid-geometry")).toBe(true);
    expect(result.metrics.every(m => Number.isFinite(m.value) && Number.isFinite(m.score))).toBe(true);
  });
});
