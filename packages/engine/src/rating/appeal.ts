import appealData from "./appeal.json";
import type { RatingGender } from "./ideals";
import { scoreFromZ, zFromScore } from "./scale";

/**
 * Facial appeal: a model of human attractiveness ratings. A CLIP ViT-B/16
 * image embedding of the face crop goes through a linear head fitted to the
 * SCUT-FBP5500 mean ratings (scripts/train-appeal.py), and the prediction is
 * standardised per gender against the London reference adults.
 */
export interface AppealModel {
  version: string;
  model: string;
  blend: number;
  bias: number;
  coef: number[];
  gender: Record<RatingGender, { mean: number; sd: number; blendSd: number }>;
}
export const APPEAL = appealData as AppealModel;
export const APPEAL_INPUT = 224;
const MEAN = [0.48145466, 0.4578275, 0.40821073], STD = [0.26862954, 0.26130258, 0.27577711];

/** Square face crop in pixels, framed like the training photographs (forehead to chin with a margin). */
export function appealCrop(mesh: readonly { x: number; y: number }[], width: number, height: number): { x: number; y: number; size: number } {
  let top = Infinity, bottom = -Infinity, left = Infinity, right = -Infinity;
  for (const p of mesh) { const x = p.x * width, y = p.y * height; top = Math.min(top, y); bottom = Math.max(bottom, y); left = Math.min(left, x); right = Math.max(right, x); }
  const h = bottom - top, size = 1.62 * h, cx = (left + right) / 2, cy = (top + bottom) / 2 - 0.08 * h;
  return { x: cx - size / 2, y: cy - size / 2, size };
}
/** CHW float input for the vision model from RGBA pixels of a 224×224 crop. */
export function appealTensor(rgba: ArrayLike<number>): Float32Array {
  const n = APPEAL_INPUT * APPEAL_INPUT, out = new Float32Array(3 * n);
  for (let i = 0; i < n; i++) for (let c = 0; c < 3; c++) out[c * n + i] = (rgba[i * 4 + c]! / 255 - MEAN[c]!) / STD[c]!;
  return out;
}
/** Predicted mean rating (1–5 scale of the training data) from an image embedding. */
export function appealFromEmbedding(embedding: ArrayLike<number>, model: AppealModel = APPEAL): number {
  let norm = 0;
  for (let i = 0; i < embedding.length; i++) norm += embedding[i]! ** 2;
  norm = Math.sqrt(norm) || 1;
  let s = model.bias;
  for (let i = 0; i < model.coef.length; i++) s += model.coef[i]! * embedding[i]! / norm;
  return s;
}
/** Standard score of a prediction among adults of the same gender. */
export function appealZ(raw: number, gender: RatingGender, model: AppealModel = APPEAL): number {
  const g = model.gender[gender];
  return (raw - g.mean) / g.sd;
}
/** Overall score: the appeal model blended with the measured structure score. */
export function blendOverall(raw: number, structure: number | null, gender: RatingGender, model: AppealModel = APPEAL): number {
  const z = appealZ(raw, gender, model);
  if (structure === null) return scoreFromZ(z);
  return scoreFromZ((model.blend * z + (1 - model.blend) * zFromScore(structure)) / model.gender[gender].blendSd);
}
