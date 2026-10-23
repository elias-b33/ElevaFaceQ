/**
 * Fits the rating's population constants (src/rating/calibration.json).
 *
 * Input: JSONL, one reference person per line:
 *   { "id", "gender": "male"|"female", "front": MeasurementDocument,
 *     "sides": MeasurementDocument[], "image": ImageFeatures }
 * produced by running this app's own automatic landmark and image-feature
 * code over reference photographs (see calibration/rating/README.md). Each
 * front is paired with each of the person's profiles, as the app would see it.
 *
 * Usage: pnpm calibrate:rating <inputs.jsonl> [source description]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ASSESSMENTS, assessmentValue, type Calibration } from "../src/rating/pillars";
import { PILLAR_P } from "../src/rating/pillars";
import { powerMean, scoreFromZ } from "../src/rating/scale";
import { ratingInputs } from "../src/rating/rate";
import type { MeasurementDocument } from "../src/harmony/types";
import type { ImageFeatures } from "../src/rating/image-features";
import type { RatingGender } from "../src/rating/ideals";

interface Row { id: string; gender: RatingGender; front: MeasurementDocument; sides: MeasurementDocument[]; image: ImageFeatures | null }
const file = process.argv[2];
if (!file) { console.error("usage: pnpm calibrate:rating <inputs.jsonl> [source]"); process.exit(1); }
const source = process.argv[3] ?? "Reference photographs measured with this app's automatic landmarks";
const rows = readFileSync(file, "utf8").split("\n").filter(Boolean).map(l => JSON.parse(l) as Row);
const genders: RatingGender[] = ["male", "female"];
const robust = (v: number[]) => {
  const s = [...v].sort((a, b) => a - b), med = s[Math.floor(s.length / 2)]!;
  const mean = v.reduce((a, b) => a + b, 0) / v.length, sd = Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, v.length - 1));
  const mad = [...v.map(x => Math.abs(x - med))].sort((a, b) => a - b)[Math.floor(v.length / 2)]! * 1.4826;
  // Robust centre and spread; fall back to the SD when most values coincide.
  return { mean: med, sd: mad > sd * .25 ? mad : sd };
};
const r4 = (n: number) => Number(n.toPrecision(6));

// One sample per front/profile pairing (front alone when no profile exists).
const samples = rows.flatMap(r => (r.sides.length ? r.sides : [undefined]).map(side => ({ gender: r.gender, ...ratingInputs({ gender: r.gender, front: r.front, side, image: r.image }) })));
const cal: Calibration = { source, features: {}, assessments: {}, pillars: {} as Calibration["pillars"], harmony: {} as Calibration["harmony"] };

for (const which of ["front", "side", "combined"] as const) {
  cal.harmony[which] = {} as Calibration["harmony"]["front"];
  for (const g of genders) {
    const v = samples.filter(s => s.gender === g && s.raw[which] !== null).map(s => Math.log(10.1 - Math.min(10, s.raw[which]!)));
    const mean = v.reduce((a, b) => a + b, 0) / v.length, sd = Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / (v.length - 1));
    cal.harmony[which][g] = { mean: r4(mean), sd: r4(sd) };
  }
}
const features = [...new Set(ASSESSMENTS.flatMap(a => a.terms.map(t => t.feature)))];
for (const f of features) {
  const v = samples.map(s => s.inputs[f]).filter((x): x is number => x !== undefined && Number.isFinite(x));
  if (v.length < 20) { console.warn(`skipping ${f}: ${v.length} values`); continue; }
  const st = robust(v);
  cal.features[f] = { mean: r4(st.mean), sd: r4(st.sd) };
}
for (const def of ASSESSMENTS) {
  cal.assessments[def.key] = {} as Calibration["assessments"][string];
  for (const g of genders) {
    const v = samples.filter(s => s.gender === g).map(s => assessmentValue(def, s.inputs, cal)).filter((x): x is number => x !== null);
    const st = robust(v);
    cal.assessments[def.key]![g] = { mean: r4(st.mean), sd: r4(st.sd) };
  }
}
for (const pillar of ["angularity", "dimorphism", "features"] as const) {
  cal.pillars[pillar] = {} as Calibration["pillars"]["angularity"];
  for (const g of genders) {
    const raws = samples.filter(s => s.gender === g).map(s => {
      const items = ASSESSMENTS.filter(d => d.pillar === pillar).flatMap(d => {
        const v = assessmentValue(d, s.inputs, cal), st = cal.assessments[d.key]![g];
        if (v === null) return [];
        const z = (v - st.mean) / st.sd;
        return [{ score: scoreFromZ(d.dimorphic && g === "female" ? -z : z), weight: d.weight }];
      });
      return powerMean(items, PILLAR_P);
    }).filter((x): x is number => x !== null);
    const mean = raws.reduce((a, b) => a + b, 0) / raws.length, sd = Math.sqrt(raws.reduce((a, b) => a + (b - mean) ** 2, 0) / (raws.length - 1));
    cal.pillars[pillar][g] = { mean: r4(mean), sd: r4(sd) };
  }
}
const target = join(import.meta.dirname, "..", "src", "rating", "calibration.json");
writeFileSync(target, JSON.stringify(cal, null, 1) + "\n");
console.log(`calibrated from ${rows.length} people / ${samples.length} pairings → ${target}`);
console.log(JSON.stringify({ harmony: cal.harmony, pillars: cal.pillars }, null, 1));
