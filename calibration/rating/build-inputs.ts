// Build rating calibration inputs (one JSON line per London subject) from cached
// MediaPipe outputs, using the engine's own automatic landmark and image code.
// Usage: tsx build-inputs.ts out.jsonl
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { createRequire } from "node:module";
import { automaticLandmarks, measureImageFeatures } from "../../packages/engine/src/index";

const S = process.env.CALIBRATION_DIR;
if (!S) throw new Error("Set CALIBRATION_DIR.");
const require = createRequire(S + "/package.json");
const jpeg = require("jpeg-js");
const info = new Map(readFileSync(`${S}/london/archives/london_faces_info.csv`, "utf8").replace(/^﻿/, "").trim().split("\n").slice(1).map(l => { const [id, age, gender, eth] = l.split(","); return [id!, { age: age ? Number(age) : null, gender: gender!.trim(), eth: eth!.trim() }]; }));
const files = readdirSync(S + "/cache").filter(f => f.endsWith(".json"));
function load(id: string) {
  const meta = JSON.parse(readFileSync(`${S}/cache/${id}.json`, "utf8"));
  const img = jpeg.decode(readFileSync(`${S}/cache/${id}.jpg`), { useTArray: true });
  const categories = new Uint8Array(gunzipSync(readFileSync(`${S}/cache/${id}.cat.gz`)));
  return { meta, pixels: { width: img.width, height: img.height, data: img.data }, segmentation: { width: meta.maskW, height: meta.maskH, categories } };
}
const out: string[] = [];
for (const [subject, who] of info) {
  const frontId = files.find(f => f.includes(`neutral_front__${subject}_`))?.slice(0, -5);
  if (!frontId) continue;
  const f = load(frontId);
  if (!f.meta.mesh) continue;
  const mesh = f.meta.mesh.map(([x, y, z]: number[]) => ({ x, y, z }));
  const front = automaticLandmarks({ view: "front", aspect: f.meta.width / f.meta.height, imageHeight: Math.min(768, f.meta.height), segmentation: f.segmentation, pixels: f.pixels, mesh, at: 0 });
  const image = measureImageFeatures({ mesh, pixels: f.pixels, segmentation: f.segmentation });
  const sides: unknown[] = [];
  for (const kind of ["left_profile", "right_profile"]) {
    const sideId = files.find(n => n.includes(`neutral_${kind}__${subject}_`))?.slice(0, -5);
    if (!sideId) continue;
    const s = load(sideId);
    sides.push(automaticLandmarks({ view: "side", aspect: s.meta.width / s.meta.height, imageHeight: Math.min(768, s.meta.height), segmentation: s.segmentation, pixels: s.pixels, mesh: s.meta.lowMesh?.map(([x, y, z]: number[]) => ({ x, y, z })), pose: s.meta.pose?.map(([x, y, z, visibility]: number[]) => ({ x, y, z, visibility })), at: 0 }));
  }
  out.push(JSON.stringify({ id: `london-${subject}`, gender: who.gender === "male" ? "male" : "female", age: who.age, ethnicity: who.eth, front, sides, image }));
}
writeFileSync(process.argv[2]!, out.join("\n") + "\n");
console.log("subjects", out.length);
