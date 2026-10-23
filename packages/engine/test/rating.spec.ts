import { describe, expect, it } from "vitest";
import {
  ASSESSMENTS, CALIBRATION, HARMONY_CATALOG, IDEALS, automaticLandmarks, measurementScore, percentileOfScore, powerMean,
  rarityOfScore, rateFace, scoreFromZ, scoreLabel, zFromScore, type ImageFeatures, type MeasurementDocument,
} from "../src/index";
import { canonicalInput } from "./helpers";

const front = (): MeasurementDocument => automaticLandmarks({ view: "front", aspect: 0.8, imageHeight: 768, mesh: canonicalInput().landmarks });

describe("rating scale", () => {
  it("follows the published rarity anchors, symmetrically around 5", () => {
    expect(scoreFromZ(0)).toBe(5);
    expect(rarityOfScore(7)).toBeGreaterThan(16);
    expect(rarityOfScore(7)).toBeLessThan(20);
    expect(rarityOfScore(8)).toBeGreaterThan(220);
    expect(rarityOfScore(8)).toBeLessThan(280);
    expect(percentileOfScore(7)).toBeCloseTo(94.4, 0);
    expect(rarityOfScore(3)).toBeCloseTo(rarityOfScore(7), 6);
    expect(scoreFromZ(-1.593)).toBeCloseTo(10 - scoreFromZ(1.593), 9);
    for (const s of [0.5, 2, 4.2, 5, 6.3, 7.9, 9.4]) expect(scoreFromZ(zFromScore(s))).toBeCloseTo(s, 9);
    expect(scoreFromZ(50)).toBe(10);
    expect(scoreFromZ(-50)).toBe(0);
    expect(scoreLabel(7.2)).toBe("Great");
    expect(scoreLabel(5)).toBe("Average");
  });
  it("combines pillars with a power mean that penalises the weakest", () => {
    const four = (a: number, b: number, c: number, d: number) => powerMean([a, b, c, d].map(score => ({ score, weight: 1 })), 0.1)!;
    expect(four(7, 7, 7, 7)).toBeCloseTo(7, 9);
    // The published example: three 8s and a 4 give about 6.7.
    expect(four(8, 8, 8, 4)).toBeGreaterThan(6.65);
    expect(four(8, 8, 8, 4)).toBeLessThan(6.8);
    expect(powerMean([], 0.5)).toBeNull();
  });
});

describe("measurement curves", () => {
  it("scores 10 inside the ideal range and falls with distance outside it", () => {
    const spec = IDEALS.find(i => i.key === "front.lateral-canthal-tilt")!;
    expect(measurementScore(5, spec, "male")).toBe(10);
    const near = measurementScore(spec.male[0] - spec.sd * .5, spec, "male"), far = measurementScore(spec.male[0] - spec.sd * 2, spec, "male");
    expect(near).toBeLessThan(10);
    expect(far).toBeLessThan(near);
    expect(measurementScore(spec.male[1] + spec.sd, spec, "male")).toBeCloseTo(measurementScore(spec.male[0] - spec.sd, spec, "male"), 9);
  });
  it("covers exactly the 66 scored measurements and none of the supporting ones", () => {
    const scored = HARMONY_CATALOG.filter(d => !d.supporting).map(d => d.key).sort();
    expect(IDEALS.map(i => i.key).sort()).toEqual(scored);
    expect(scored).toHaveLength(66);
    for (const i of IDEALS) {
      expect(i.male[0]).toBeLessThan(i.male[1]);
      expect(i.female[0]).toBeLessThan(i.female[1]);
      expect(i.sd).toBeGreaterThan(0);
    }
  });
  it("has calibration for every assessment input", () => {
    for (const def of ASSESSMENTS) {
      expect(CALIBRATION.assessments[def.key]?.male.sd).toBeGreaterThan(0);
      for (const t of def.terms) expect(CALIBRATION.features[t.feature]?.sd, t.feature).toBeGreaterThan(0);
    }
  });
});

describe("face rating", () => {
  it("is deterministic and bounded", () => {
    const a = rateFace({ gender: "male", front: front() }), b = rateFace({ gender: "male", front: front() });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    const scores = [a.overall, a.pillars.harmony.summary, a.harmony.front].filter(Boolean).map(s => s!.score);
    expect(scores.length).toBeGreaterThan(0);
    for (const s of scores) { expect(s).toBeGreaterThanOrEqual(0); expect(s).toBeLessThanOrEqual(10); }
  });
  it("marks a front-only study incomplete and asks for the profile", () => {
    const result = rateFace({ gender: "female", front: front() });
    expect(result.complete).toBe(false);
    expect(result.harmony.side).toBeNull();
    expect(result.notes.join(" ")).toContain("side profile");
  });
  it("ranks flaws as score costs and strengths as score gains, with potential above the overall", () => {
    // Population-typical photo features let all four pillars score on a front-only study.
    const image = Object.fromEntries(Object.entries(CALIBRATION.features).filter(([k]) => k.startsWith("img.")).map(([k, v]) => [k.slice(4), v.mean])) as unknown as ImageFeatures;
    const result = rateFace({ gender: "male", front: front(), image: { ...image, version: 1 } });
    expect(result.overall).not.toBeNull();
    expect(result.flaws.length).toBeGreaterThan(0);
    for (const f of result.flaws) expect(f.impact).toBeLessThan(0);
    for (const s of result.strengths) expect(s.impact).toBeGreaterThan(0);
    expect([...result.flaws].sort((a, b) => a.impact - b.impact)).toEqual(result.flaws);
    expect(result.potential!).toBeGreaterThanOrEqual(result.overall!.score);
  });
  it("returns no score for an empty study", () => {
    const result = rateFace({ gender: "male" });
    expect(result.overall).toBeNull();
    expect(result.pillars.harmony.summary).toBeNull();
    expect(result.flaws).toEqual([]);
  });
});
