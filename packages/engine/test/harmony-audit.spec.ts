import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { analyzeHarmony, HARMONY_CATALOG, measurementOverlay, requiredMeasurementPoints, type HarmonyView, type MeasurementDocument } from "../src/harmony/index";
import { intersection } from "../src/harmony/geometry";

// Independent drafting fixtures in a 200 × 200 unit image. These deliberately
// do not use seedDocument's anatomical template or production geometry helpers.
// Expected values below were calculated from the labeled dimensions, rational
// line intersections and atan2(|cross|, dot), independently of the engine's acos.
const FRONT: Record<string, readonly [number, number]> = {
  hairline: [100, 10], menton: [100, 190], templeL: [40, 50], templeR: [160, 50],
  cheekL: [30, 105], cheekR: [170, 105], jawSideL: [40, 135], jawSideR: [160, 135],
  jawL: [40, 155], jawR: [160, 155], chinBorderL: [70, 180], chinBorderR: [130, 180],
  earL: [10, 135], earR: [190, 135], neckL: [55, 195], neckR: [145, 195],
  pupilL: [75, 80], pupilR: [125, 80], innerL: [85, 80], innerR: [115, 80],
  outerL: [55, 75], outerR: [145, 75], hoodL: [50, 75], hoodR: [150, 75],
  lidTopL: [75, 75], lidBottomL: [75, 85], lidTopR: [125, 75], lidBottomR: [125, 85],
  creaseL: [75, 69], creaseR: [125, 71], browInnerL: [85, 60], browInnerR: [115, 60],
  browInnerTopL: [85, 55], browInnerTopR: [115, 55], browArchL: [65, 50], browArchR: [135, 50],
  browPeakL: [65, 45], browPeakR: [135, 45], browTailL: [45, 55], browTailR: [155, 55],
  nasalBase: [100, 120], noseBottom: [100, 115], alarL: [80, 110], alarR: [120, 110],
  bridgeL: [90, 100], bridgeR: [110, 100], upperLip: [100, 140], lipPeakL: [95, 137],
  lipPeakR: [105, 136], mouthSeam: [100, 148], lowerLip: [100, 160], mouthL: [75, 146], mouthR: [125, 144],
};
const SIDE: Record<string, readonly [number, number]> = {
  porion: [30, 80], orbitale: [100, 80], hairline: [105, 20], forehead: [115, 35],
  glabella: [120, 55], nasion: [115, 70], supratip: [135, 90], pronasale: [155, 100],
  infratip: [145, 110], columella: [140, 115], subnasale: [130, 120], subalare: [115, 110],
  cornea: [125, 75], lowerEyelid: [120, 85], lateralCanthus: [105, 80], tragus: [30, 95],
  earNotch: [30, 90], gonionUpper: [40, 140], gonionLower: [45, 160],
  upperLip: [140, 135], lowerLip: [140, 145], mouthCorner: [125, 140], sublabiale: [125, 155],
  pogonion: [135, 170], menton: [125, 180], cervical: [85, 185], neck: [80, 195],
};
function drawing(view: HarmonyView): MeasurementDocument {
  return { aspect: 1, imageHeight: 2000, updatedAt: 0, points: Object.fromEntries(
    Object.entries(view === "front" ? FRONT : SIDE).map(([key, [x, y]]) => [key, { x: x / 200, y: y / 200, source: "manual", reviewed: true }]),
  ) };
}
const measure = (view: HarmonyView, doc: MeasurementDocument, key: string) => analyzeHarmony(view, doc).measurements.find(m => m.key === `${view}.${key}`)!;

// Distances are % of the 180-unit front or 160-unit profile height, not mm.
const EXPECTED_FRONT: Record<string, number> = {
  "top-third": 50 / 180 * 100, "middle-third": 55 / 180 * 100, "lower-third": 75 / 180 * 100,
  "face-width-to-height-ratio": 140 / 80, "total-facial-width-to-height-ratio": 180 / 140,
  "midface-ratio": 50 / 60, "bitemporal-width": 120 / 140 * 100, "cheekbone-height": 35 / 60 * 100,
  "eye-separation-ratio": 50 / 140 * 100, "eye-aspect-ratio": 3.0413812651491097,
  "one-eye-apart-test": 30 / 35, "lateral-canthal-tilt": 9.462322208025617,
  "eyebrow-tilt": 26.56505117707799, "eyebrow-low-setedness": 2, "brow-thickness": 5 / 35 * 100,
  "brow-length-to-face-width-ratio": 80 / 140, "nose-tip-position": -5 / 180 * 100,
  "intercanthal-nasal-width-ratio": 40 / 30, "nose-bridge-to-nose-width": 2,
  "ipsilateral-alar-angle": 102.68038349181984, "midface-jaw-angle-difference": 23.06924130728946,
  "lip-thickness": 20 / 70 * 100, "lower-lip-to-upper-lip-ratio": 1.5, "cupid-s-bow-depth": 3.5 / 180 * 100,
  "mouth-width-to-nose-width-ratio": 1.25, "interpupillary-mouth-width-ratio": 1,
  "mouth-corner-position": 3 / 180 * 100, "chin-to-philtrum-ratio": 1.5,
  "jaw-frontal-angle": 79.61114218453038, "jaw-slope": 148.2405199151872,
  "bigonial-width": 120 / 140 * 100, "lower-third-proportion": 44,
  "ear-protrusion-ratio": 20 / 140 * 100, "ear-protrusion-angle": 56.97613244420336,
  "neck-width": 75, "upper-eyelid-exposure": .5,
};
const EXPECTED_SIDE: Record<string, number> = {
  "browridge-inclination-angle": 23.19859051364819, "nasofrontal-angle": 116.56505117707799,
  "upper-forehead-slope": 9.16234704572171, "facial-convexity-nasion": 169.01134890350602,
  "facial-convexity-glabella": 176.96443087494444, "total-facial-convexity": 126.17962044797895,
  "facial-depth-to-height-ratio": 1.2043720128733029, "orbital-vector": -25 / 160 * 100,
  "interior-midface-projection-angle": 71.56505117707799, "z-angle": 81.86989764584403,
  "anterior-facial-depth": 91.30195267257889, "nasal-projection": .5628780357842335,
  "nasal-tip-angle": 71.56505117707799, "nose-tip-rotation-angle": 26.56505117707799,
  "nasolabial-angle": 82.87498365109819, "nasofacial-angle": 41.82016988013577,
  "nasomental-angle": 110.92450174492117, "nasal-w-to-h-ratio": 1.6, "frankfort-tip-angle": 38.659808254090095,
  "lower-lip-s-line-position": -1.1628256367738294, "upper-lip-s-line-position": -.38760854559127644,
  "lower-lip-e-line-position": 1.2877552870189595, "upper-lip-e-line-position": 3.0047623363775724,
  "lower-lip-burstone-line": -4.664236829109324, "upper-lip-burstone-line": -5.286135072990568,
  "holdaway-h-line": -.8838834764831843, "mentolabial-angle": 90, "gonial-angle": 115.34617594194671,
  "mandibular-plane-angle": 14.036243467926477, "ramus-to-mandible-ratio": .7055812494643758,
  "gonion-to-mouth-line": 12.335526315789473, "recession-relative-to-frankfort-plane": 12.5,
  "submental-cervical-angle": 123.6900675259798, "eye-protrusion": 3.125, "brow-bossing-angle": 18.43494882292201,
};

describe("independent numerical audit of all 71 definitions", () => {
  for (const view of ["front", "side"] as const) {
    const expected = view === "front" ? EXPECTED_FRONT : EXPECTED_SIDE;
    it(`${view} reference fixture covers every catalog definition exactly once`, () => {
      expect(Object.keys(expected).map(k => `${view}.${k}`).sort()).toEqual(HARMONY_CATALOG.filter(d => d.view === view).map(d => d.key).sort());
    });
    it.each(Object.entries(expected))(`${view}.%s matches an independent calculation`, (key, value) => {
      const result = measure(view, drawing(view), key);
      expect(result.status).toBe("reviewed");
      expect(result.value).toBeCloseTo(value, 8);
    });
    it(`${view} keeps every value under translation, uniform scaling, roll and recoding of image aspect`, () => {
      fc.assert(fc.property(
        fc.double({ min: .55, max: .85, noNaN: true }), fc.double({ min: -.10, max: .10, noNaN: true }),
        fc.double({ min: -.025, max: .025, noNaN: true }), fc.double({ min: 1, max: 1.5, noNaN: true }),
        fc.boolean(), (scale, roll, shift, aspect, mirror) => {
          const doc = drawing(view);
          const c = Math.cos(roll), s = Math.sin(roll);
          doc.aspect = aspect;
          doc.points = Object.fromEntries(Object.entries(doc.points).map(([key, p]) => {
            const x = scale * (p.x - .5), y = scale * (p.y - .5);
            const tx = .5 + shift + c * x - s * y;
            return [key, { ...p, x: (view === "side" && mirror ? 1 - tx : tx) / aspect, y: .5 + shift + s * x + c * y }];
          }));
          const report = analyzeHarmony(view, doc);
          for (const result of report.measurements) {
            expect(result.status, result.key).toBe("reviewed");
            expect(result.value, result.key).toBeCloseTo(expected[result.key.slice(view.length + 1)]!, 7);
          }
        }), { seed: 20261022, numRuns: 100 });
    });
    it(`${view} converts only distances when an independently known scale is supplied`, () => {
      const doc = drawing(view);
      // 180 (front) / 160 (side) virtual units = actual 216 / 192 mm.
      doc.calibration = { from: "hairline", to: "menton", millimeters: view === "front" ? 216 : Math.hypot(20, 160) * 1.2 };
      const factor = view === "front" ? 2.16 : 1.92;
      const report = analyzeHarmony(view, doc);
      for (const result of report.measurements) {
        const def = HARMONY_CATALOG.find(d => d.key === result.key)!;
        expect(result.value, result.key).toBeCloseTo(expected[result.key.slice(view.length + 1)]! * (def.unit === "distance" ? factor : 1), 7);
        if (def.unit === "distance") expect(result.unit).toBe("mm");
      }
    });
  }
});

describe("mathematical edge cases", () => {
  it("can measure calibrated distances without a visible hairline", () => {
    const doc = drawing("front"); delete doc.points.hairline;
    doc.calibration = { from: "pupilL", to: "pupilR", millimeters: 60 };
    const result = measure("front", doc, "cupid-s-bow-depth");
    expect(result.status).toBe("reviewed"); expect(result.unit).toBe("mm"); expect(result.value).toBeCloseTo(4.2, 8);
    expect(measure("front", { ...doc, calibration: undefined }, "cupid-s-bow-depth").missing).toContain("hairline");
  });
  it("keeps intrinsic chin dependencies even when face-height normalization is unnecessary", () => {
    const doc = drawing("side"); delete doc.points.menton;
    doc.calibration = { from: "porion", to: "orbitale", millimeters: 84 };
    expect(measure("side", doc, "gonion-to-mouth-line").missing).toContain("menton");
    expect(measure("side", doc, "orbital-vector").status).toBe("reviewed");
  });
  it("falls back to normalized distances when calibration endpoints are unplaced", () => {
    const doc = drawing("front");
    doc.calibration = { from: "hidden-point", to: "menton", millimeters: 180 };
    const result = measure("front", doc, "cupid-s-bow-depth");
    expect(result.status).toBe("reviewed"); expect(result.unit).toBe("% FH");
    expect(result.value).toBeCloseTo(3.5 / 180 * 100, 8);
    expect(analyzeHarmony("front", doc).warnings.join(" ")).toContain("calibration");
  });
  it("requires review of calibration endpoints used by a distance", () => {
    const doc = drawing("front"); doc.points.cheekL!.reviewed = false;
    doc.calibration = { from: "cheekL", to: "cheekR", millimeters: 168 };
    expect(measure("front", doc, "cupid-s-bow-depth").unreviewed).toContain("cheekL");
    expect(measure("front", doc, "cupid-s-bow-depth").status).toBe("provisional");
  });
  it("does not compare a saved millimeter range with a normalized fallback", () => {
    const doc = drawing("front"); doc.calibration = { from: "hidden-point", to: "menton", millimeters: 180 };
    const key = "front.cupid-s-bow-depth";
    const result = analyzeHarmony("front", doc, { ranges: { [key]: { lo: 1, hi: 3 } } }).measurements.find(m => m.key === key)!;
    expect(result.unit).toBe("% FH"); expect(result.reference).toBeNull(); expect(result.position).toBeNull();
  });
  it.each([{ lo: 2, hi: 1 }, { lo: NaN, hi: 2 }, { lo: 1, hi: Infinity }])("ignores an invalid working range (%j)", range => {
    const key = "front.midface-ratio";
    const report = analyzeHarmony("front", drawing("front"), { ranges: { [key]: range } });
    const result = report.measurements.find(m => m.key === key)!;
    expect(result.reference).toBeNull(); expect(result.position).toBeNull();
    expect(report.warnings.join(" ")).toContain("working range");
  });
  it("shares actual leveling and scale dependencies with the editor", () => {
    const doc = drawing("front"); delete doc.points.hairline;
    doc.calibration = { from: "cheekL", to: "cheekR", millimeters: 168 };
    const def = HARMONY_CATALOG.find(d => d.key === "front.cupid-s-bow-depth")!;
    const result = measure("front", doc, "cupid-s-bow-depth");
    expect(requiredMeasurementPoints(def, doc)).toEqual(result.required);
    expect(result.required).not.toContain("hairline");
    expect(result.required).toEqual(expect.arrayContaining(["pupilL", "pupilR", "cheekL", "cheekR"]));
  });
  it("rejects a reversed nose-to-chin reference instead of reversing lip signs", () => {
    const doc = drawing("side"); doc.points.pogonion!.y = .1;
    expect(measure("side", doc, "upper-lip-e-line-position").status).toBe("invalid");
  });
  it("does not assume an unlevelled front photo is a reviewed measurement", () => {
    const doc = drawing("front");
    for (const key of ["pupilL", "pupilR", "outerL", "outerR"]) delete doc.points[key];
    expect(analyzeHarmony("front", doc).available).toBe(0);
    expect(measure("front", doc, "nose-bridge-to-nose-width").missing).toEqual(expect.arrayContaining(["outerL", "outerR"]));
  });
  it("tracks both actual fallback leveling points for review", () => {
    const doc = drawing("front"); delete doc.points.pupilR; doc.points.outerL!.reviewed = false;
    expect(measure("front", doc, "nose-bridge-to-nose-width").unreviewed).toContain("outerL");
    expect(measure("front", doc, "nose-bridge-to-nose-width").status).toBe("provisional");
  });
  it.each([
    ["front", "lateral-canthal-tilt", "outerL", "innerL"],
    ["side", "interior-midface-projection-angle", "subalare", "lateralCanthus"],
    ["side", "nose-tip-rotation-angle", "subnasale", "columella"],
  ] as const)("rejects undefined directions in %s.%s", (view, key, from, to) => {
    const doc = drawing(view); doc.points[from] = { ...doc.points[to]! };
    expect(measure(view, doc, key).status).toBe("invalid");
  });
  it("accepts a zero exposed lid as a zero numerator, with the eye still open", () => {
    const doc = drawing("front");
    doc.points.creaseL = { ...doc.points.lidTopL! }; doc.points.creaseR = { ...doc.points.lidTopR! };
    expect(measure("front", doc, "upper-eyelid-exposure").status).toBe("reviewed");
    expect(measure("front", doc, "upper-eyelid-exposure").value).toBe(0);
  });
  it("rejects nearly parallel tangent intersections consistently at different scales", () => {
    for (const s of [.01, 1, 100]) expect(() => intersection(
      { x: 0, y: 0 }, { x: s, y: s }, { x: 0, y: s }, { x: s, y: (2 + 1e-7) * s },
    )).toThrow();
  });
  it("places the H-line foot on the perpendicular from the lower lip", () => {
    const doc = drawing("side"), def = HARMONY_CATALOG.find(d => d.key === "side.holdaway-h-line")!;
    const foot = measurementOverlay(def, doc).hFoot!;
    // Orthogonal projection of (140,145) onto (140,135)→(135,170).
    expect(foot.x * 200).toBeCloseTo(138.6, 8); expect(foot.y * 200).toBeCloseTo(144.8, 8);
  });
  it("never compares sensitivity samples across a switch of distance units", () => {
    const doc = drawing("front"); doc.imageHeight = 200;
    doc.points.bridgeL = { x: .4, y: .4, source: "manual", reviewed: true };
    doc.points.bridgeR = { x: .41, y: .4, source: "manual", reviewed: true };
    doc.calibration = { from: "bridgeL", to: "bridgeR", millimeters: 2 };
    const r = analyzeHarmony("front", doc, undefined, ["front.cupid-s-bow-depth"]).measurements.find(m => m.key === "front.cupid-s-bow-depth")!;
    expect(r.unit).toBe("mm"); expect(r.sensitivity).toBeNull(); expect(r.reason).toBeDefined();
  });
});
