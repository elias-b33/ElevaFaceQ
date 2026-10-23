// Full rating on calibration inputs; prints JSONL of summary scores per pairing.
import { readFileSync, writeFileSync } from "node:fs";
import { rateFace } from "../../packages/engine/src/rating/rate";

const [file, out] = process.argv.slice(2);
const rows = readFileSync(file!, "utf8").trim().split("\n").map(l => JSON.parse(l));
const lines: string[] = [];
const t0 = performance.now();
let n = 0;
for (const r of rows) for (const [k, side] of r.sides.entries()) {
  const res = rateFace({ gender: r.gender, front: r.front, side, image: r.image });
  n++;
  lines.push(JSON.stringify({ id: r.id.replace("london-", ""), side: k === 0 ? "L" : "R", gender: r.gender, age: r.age,
    overall: res.overall?.score ?? null, potential: res.potential,
    harmony: res.pillars.harmony.summary?.score ?? null, front: res.harmony.front?.score ?? null, sideH: res.harmony.side?.score ?? null,
    angularity: res.pillars.angularity.summary?.score ?? null, dimorphism: res.pillars.dimorphism.summary?.score ?? null, features: res.pillars.features.summary?.score ?? null,
    items: Object.fromEntries(["angularity", "dimorphism", "features"].flatMap(p => (res.pillars as any)[p].items.map((i: any) => [i.key, i.score]))),
    flaws: res.flaws.slice(0, 3).map(f => `${f.label} ${f.impact.toFixed(2)}`), strengths: res.strengths.slice(0, 3).map(f => `${f.label} +${f.impact.toFixed(2)}`), complete: res.complete }));
}
writeFileSync(out!, lines.join("\n") + "\n");
console.log(`${n} ratings in ${(performance.now() - t0).toFixed(0)} ms`);
