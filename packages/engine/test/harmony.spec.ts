import { describe, expect, it } from "vitest";
import { analyzeHarmony, FRONT_LANDMARKS, HARMONY_CATALOG, measurementOverlay, seedDocument, SIDE_LANDMARKS, type MeasurementDocument } from "../src/harmony/index";

function placed(view: "front" | "side", aspect = .8): MeasurementDocument {
  const doc = seedDocument(view, aspect);
  for (const p of Object.values(doc.points)) { p.source = "manual"; p.reviewed = true; }
  return doc;
}
const row = (doc: MeasurementDocument, view: "front" | "side", key: string) => analyzeHarmony(view, doc).measurements.find(r => r.key === `${view}.${key}`)!;
function transform(doc: MeasurementDocument, radians: number): MeasurementDocument {
  const cx = doc.aspect / 2, cy = .5;
  return { ...doc, points: Object.fromEntries(Object.entries(doc.points).map(([key, p]) => {
    const x = p.x * doc.aspect - cx, y = p.y - cy;
    return [key, { ...p, x: (x * Math.cos(radians) - y * Math.sin(radians) + cx) / doc.aspect, y: x * Math.sin(radians) + y * Math.cos(radians) + cy }];
  })) };
}
describe("complete public measurement geometry", () => {
  it("covers all 71 unique published guides, including the five supporting definitions", () => {
    expect(HARMONY_CATALOG).toHaveLength(71);
    expect(new Set(HARMONY_CATALOG.map(d => d.key)).size).toBe(71);
    expect(HARMONY_CATALOG.filter(d => d.view === "front")).toHaveLength(36);
    expect(HARMONY_CATALOG.filter(d => d.view === "side")).toHaveLength(35);
    expect(HARMONY_CATALOG.filter(d => d.supporting)).toHaveLength(5);
    for (const d of HARMONY_CATALOG) {
      const points = d.view === "front" ? FRONT_LANDMARKS : SIDE_LANDMARKS;
      for (const required of d.required) expect(points.some(p => p.key === required), `${d.key}: ${required}`).toBe(true);
    }
  });
  it.each(["front", "side"] as const)("never measures a %s template as anatomy", view => {
    const report = analyzeHarmony(view, seedDocument(view, .8));
    expect(report.available).toBe(0);
    expect(report.measurements.every(m => m.status === "missing" && m.value === null)).toBe(true);
  });
  it.each(["front", "side"] as const)("can calculate every %s measurement with its actual required points", view => {
    const report = analyzeHarmony(view, placed(view));
    expect(report.measurements.filter(r => r.status === "invalid")).toEqual([]);
    expect(report.available).toBe(report.total);
    expect(report.reviewed).toBe(report.total);
    for (const m of report.measurements) expect(Number.isFinite(m.value)).toBe(true);
  });
  it("uses true division order and keeps thirds summing to 100", () => {
    const doc = placed("front");
    doc.points.hairline!.y = .1; doc.points.menton!.y = .9;
    doc.points.browInnerL!.y = doc.points.browInnerR!.y = .1 + .8 / 3;
    doc.points.noseBottom!.y = .1 + 1.6 / 3;
    const values = ["top-third", "middle-third", "lower-third"].map(k => row(doc, "front", k).value!);
    for (const n of values) expect(n).toBeCloseTo(100 / 3, 8);
    expect(values.reduce((a, b) => a + b)).toBeCloseTo(100, 8);
    expect(row(doc, "front", "total-facial-width-to-height-ratio").value).toBeCloseTo(.8 / ((.76 - .24) * .8), 8);
  });
  it("keeps suggestions provisional until every contributing landmark is reviewed", () => {
    const doc = placed("front"); doc.points.pupilL!.source = "mesh"; doc.points.pupilL!.reviewed = false;
    expect(row(doc, "front", "midface-ratio").status).toBe("provisional");
    doc.points.pupilL!.reviewed = true;
    expect(row(doc, "front", "midface-ratio").status).toBe("reviewed");
  });
  it("preserves all profile values and signs when the photo is mirrored", () => {
    const doc = placed("side");
    const mirrored = { ...doc, points: Object.fromEntries(Object.entries(doc.points).map(([k, p]) => [k, { ...p, x: 1 - p.x }])) };
    const a = analyzeHarmony("side", doc), b = analyzeHarmony("side", mirrored);
    for (let i = 0; i < a.total; i++) expect(b.measurements[i]!.value, a.measurements[i]!.key).toBeCloseTo(a.measurements[i]!.value!, 7);
  });
  it("orients a partial left-facing profile before the nose tip has been placed", () => {
    const doc = placed("side"); delete doc.points.pronasale; delete doc.points.tragus;
    const mirrored = { ...doc, points: Object.fromEntries(Object.entries(doc.points).map(([k, p]) => [k, { ...p, x: 1 - p.x }])) };
    for (const key of ["recession-relative-to-frankfort-plane", "brow-bossing-angle", "orbital-vector", "nose-tip-rotation-angle"]) {
      expect(row(mirrored, "side", key).value).toBeCloseTo(row(doc, "side", key).value!, 8);
    }
  });
  it.each(["front", "side"] as const)("corrects %s geometry for photo aspect ratio", view => {
    const doc = placed(view, .8);
    const recoded = { ...doc, aspect: 1.2, points: Object.fromEntries(Object.entries(doc.points).map(([k, p]) => [k, { ...p, x: p.x * .8 / 1.2 }])) };
    const a = analyzeHarmony(view, doc), b = analyzeHarmony(view, recoded);
    for (let i = 0; i < a.total; i++) expect(b.measurements[i]!.value, a.measurements[i]!.key).toBeCloseTo(a.measurements[i]!.value!, 7);
  });
  it.each(["front", "side"] as const)("levels a rotated %s image before computing measurements", view => {
    const doc = placed(view, 1);
    const a = analyzeHarmony(view, doc), b = analyzeHarmony(view, transform(doc, .12));
    for (let i = 0; i < a.total; i++) expect(b.measurements[i]!.value, a.measurements[i]!.key).toBeCloseTo(a.measurements[i]!.value!, 7);
  });
  it("retains reflex convexity rather than folding a concave profile below 180 degrees", () => {
    const doc = placed("side", 1);
    doc.points.porion = { x: .2, y: .4, source: "manual", reviewed: true };
    doc.points.orbitale = { x: .6, y: .4, source: "manual", reviewed: true };
    doc.points.nasion!.x = .65; doc.points.nasion!.y = .3;
    doc.points.pogonion!.x = .65; doc.points.pogonion!.y = .8;
    doc.points.subnasale!.x = .75; doc.points.subnasale!.y = .5;
    expect(row(doc, "side", "facial-convexity-nasion").value).toBeLessThan(180);
    doc.points.subnasale!.x = .55;
    expect(row(doc, "side", "facial-convexity-nasion").value).toBeGreaterThan(180);
  });
  it("reports signed lip-line offsets with negative in front and positive behind", () => {
    const doc = placed("side", 1);
    doc.points.porion!.y = doc.points.orbitale!.y = .4;
    doc.points.pronasale!.x = doc.points.pogonion!.x = .7;
    doc.points.upperLip!.x = .6;
    expect(row(doc, "side", "upper-lip-e-line-position").value).toBeGreaterThan(0);
    doc.points.upperLip!.x = .8;
    expect(row(doc, "side", "upper-lip-e-line-position").value).toBeLessThan(0);
  });
  it("uses normalized face height until an actual calibration is supplied", () => {
    const doc = placed("front", 1);
    const a = row(doc, "front", "cupid-s-bow-depth");
    expect(a.unit).toBe("% FH");
    doc.calibration = { from: "hairline", to: "menton", millimeters: 180 };
    const b = row(doc, "front", "cupid-s-bow-depth");
    expect(b.unit).toBe("mm"); expect(b.value).toBeCloseTo(a.value! * 1.8, 8);
  });
  it("rejects coincident dimensions and isolates invalid tangent constructions", () => {
    const doc = placed("front"); doc.points.alarR = { ...doc.points.alarL! };
    expect(row(doc, "front", "mouth-width-to-nose-width-ratio").status).toBe("invalid");
    expect(row(doc, "front", "top-third").status).toBe("reviewed");
    doc.points.browInnerL!.y = doc.points.browInnerR!.y = .99;
    expect(row(doc, "front", "middle-third").status).toBe("invalid");
  });
  it("shows the effect of point placement without claiming statistical confidence", () => {
    const doc = placed("front");
    const result = analyzeHarmony("front", doc, undefined, ["front.midface-ratio"]).measurements.find(m => m.key === "front.midface-ratio")!;
    expect(result.sensitivity!.pixels).toBe(2);
    expect(result.sensitivity!.lo).toBeLessThan(result.value!);
    expect(result.sensitivity!.hi).toBeGreaterThan(result.value!);
  });
  it("supports optional custom ranges and descriptive-only reports", () => {
    const doc = placed("front");
    const key = "front.midface-ratio";
    expect(analyzeHarmony("front", doc, { ranges: { [key]: { lo: .001, hi: .01 } } }).measurements.find(m => m.key === key)!.position).toBe("above");
    expect(analyzeHarmony("front", doc, { descriptiveOnly: true }).compared).toBe(0);
  });
  it("maps constructed overlay points back onto a rotated, left-facing photograph", () => {
    let doc = transform(placed("side", 1), .1);
    doc = { ...doc, points: Object.fromEntries(Object.entries(doc.points).map(([k, p]) => [k, { ...p, x: 1 - p.x }])) };
    const def = HARMONY_CATALOG.find(d => d.key === "side.ramus-to-mandible-ratio")!;
    const overlay = measurementOverlay(def, doc);
    for (const key of ["porion", "orbitale", "pronasale", "menton"]) {
      expect(overlay[key]!.x).toBeCloseTo(doc.points[key]!.x, 8);
      expect(overlay[key]!.y).toBeCloseTo(doc.points[key]!.y, 8);
    }
    expect(overlay.gonion).toBeDefined(); expect(overlay.chinVertical).toBeDefined();
  });
});
