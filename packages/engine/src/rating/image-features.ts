import type { XY } from "../harmony/types";
import { SYM_PAIRS, MIDLINE } from "../landmarks/indices";

/**
 * Photo-based facial measurements used by the Features, Angularity and
 * Dimorphism pillars. All values are relative within the same photo (a region
 * compared with the person's own cheek or forehead skin), which limits but
 * does not remove the influence of lighting, white balance and compression.
 * Every value is null when its region is not visible.
 */
export interface ImageFeatures {
  version: 1;
  /** Mean bilateral landmark asymmetry, as a fraction of pupil distance. */
  asymmetry: number | null;
  /** High-frequency luminance energy in cheek/forehead skin (texture, pores, blemishes). */
  skinTexture: number | null;
  /** Low-frequency chroma variation across the same skin (redness, blotches). */
  skinBlotch: number | null;
  /** Under-eye luminance relative to the cheeks (lower = darker circles). */
  underEye: number | null;
  /** Sclera brightness relative to the cheeks and its redness. */
  scleraBrightness: number | null;
  scleraRedness: number | null;
  /** High-frequency energy at crow's feet, forehead and nasolabial folds. */
  creasing: number | null;
  /** Brow darkness against forehead skin. */
  browContrast: number | null;
  /** Lip redness against cheek skin. */
  lipContrast: number | null;
  /** Lower-face darkening and texture versus the cheeks (facial hair, stubble). */
  facialHair: number | null;
  /** Hair below the mouth level, in face-width² units (long hair). */
  hairLength: number | null;
  /** Temple hairline height above the central hairline, as a fraction of face height (M-shape). */
  templeRecession: number | null;
  /** Darkness of the skin just below the jawline relative to the cheeks (shadow = definition). */
  jawShadow: number | null;
  /** Darkening under the cheekbones relative to the cheekbone highlight. */
  submalarShadow: number | null;
  /** Width of the lower face at mouth level relative to cheekbone width. */
  lowerFaceWidth: number | null;
  /** Nose tip and nostril offset from the facial midline, as a fraction of pupil distance. */
  noseAsymmetry: number | null;
}
export interface ImageFeatureInput {
  /** 468/478 MediaPipe face mesh, normalized. */
  mesh: readonly XY[];
  pixels: { width: number; height: number; data: Uint8Array | Uint8ClampedArray };
  segmentation?: { width: number; height: number; categories: Uint8Array };
}

type Px = { x: number; y: number };
const mean = (v: number[]) => v.length ? v.reduce((s, n) => s + n, 0) / v.length : NaN;
const std = (v: number[]) => { const m = mean(v); return Math.sqrt(mean(v.map(x => (x - m) ** 2))); };
const finite = (n: number) => Number.isFinite(n) ? n : null;

export function measureImageFeatures({ mesh, pixels, segmentation }: ImageFeatureInput): ImageFeatures | null {
  if (mesh.length < 468 || pixels.width < 32 || pixels.height < 32 || pixels.data.length !== pixels.width * pixels.height * 4) return null;
  const W = pixels.width, H = pixels.height, d = pixels.data;
  const P = (i: number): Px => ({ x: mesh[i]!.x * W, y: mesh[i]!.y * H });
  const lerp = (a: Px, b: Px, t: number): Px => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  const faceW = Math.hypot(P(454).x - P(234).x, P(454).y - P(234).y), faceH = Math.hypot(P(152).x - P(10).x, P(152).y - P(10).y);
  if (!(faceW > 40 && faceH > 40)) return null;
  const mid = mean(MIDLINE.map(i => P(i).x));
  const outward = (p: Px, amount: number): Px => ({ x: p.x + Math.sign(p.x - mid) * amount, y: p.y });
  const seg = (p: Px) => segmentation ? segmentation.categories[Math.min(segmentation.height - 1, Math.max(0, Math.round(p.y / H * segmentation.height - .5))) * segmentation.width + Math.min(segmentation.width - 1, Math.max(0, Math.round(p.x / W * segmentation.width - .5)))] : 3;
  const at = (x: number, y: number) => (Math.min(H - 1, Math.max(0, Math.round(y))) * W + Math.min(W - 1, Math.max(0, Math.round(x)))) * 4;
  const luma = (i: number) => .2126 * d[i]! + .7152 * d[i + 1]! + .0722 * d[i + 2]!;
  const cr = (i: number) => .5 * d[i]! - .4187 * d[i + 1]! - .0813 * d[i + 2]!;
  const cb = (i: number) => -.1687 * d[i]! - .3313 * d[i + 1]! + .5 * d[i + 2]!;
  // Box-filtered luminance for high-pass texture, at a scale tied to face size.
  const r = Math.max(1, Math.round(faceW * .008));
  const boxL = (x: number, y: number, radius: number) => { let s = 0, n = 0; for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) { s += luma(at(x + dx, y + dy)); n++; } return s / n; };
  const inside = (poly: Px[], x: number, y: number) => {
    let hit = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[i]!, b = poly[j]!;
      if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) hit = !hit;
    }
    return hit;
  };
  const step = Math.max(1, Math.round(faceW / 180));
  /** Pixel offsets in a disc or polygon, restricted to face skin when a mask exists. */
  function region(shape: { center: Px; radius: number } | Px[], skin = true, exclude?: (x: number, y: number) => boolean): number[] {
    const pts: number[] = [];
    const poly = Array.isArray(shape) ? shape : undefined, disc = Array.isArray(shape) ? undefined : shape;
    const box = poly ? { x0: Math.min(...poly.map(p => p.x)), x1: Math.max(...poly.map(p => p.x)), y0: Math.min(...poly.map(p => p.y)), y1: Math.max(...poly.map(p => p.y)) } : { x0: disc!.center.x - disc!.radius, x1: disc!.center.x + disc!.radius, y0: disc!.center.y - disc!.radius, y1: disc!.center.y + disc!.radius };
    for (let y = Math.max(0, Math.floor(box.y0)); y <= Math.min(H - 1, Math.ceil(box.y1)); y += step) for (let x = Math.max(0, Math.floor(box.x0)); x <= Math.min(W - 1, Math.ceil(box.x1)); x += step) {
      if (poly ? !inside(poly, x, y) : Math.hypot(x - disc!.center.x, y - disc!.center.y) > disc!.radius) continue;
      if (skin && seg({ x, y }) !== 3) continue;
      if (exclude?.(x, y)) continue;
      pts.push(y * W + x);
    }
    return pts;
  }
  const L = (idx: number[]) => mean(idx.map(i => luma(i * 4)));
  const highPass = (idx: number[]) => { const v = idx.map(i => { const x = i % W, y = (i - x) / W; return luma(i * 4) - boxL(x, y, r); }); return Math.sqrt(mean(v.map(n => n * n))); };

  const cheeks = [...region({ center: lerp(P(50), P(205), .3), radius: faceW * .06 }), ...region({ center: lerp(P(280), P(425), .3), radius: faceW * .06 })];
  const forehead = region({ center: lerp(P(151), P(9), .2), radius: faceW * .08 });
  const skin = [...cheeks, ...forehead];
  const cheekL = L(cheeks), foreheadL = L(forehead);
  const enough = (idx: number[]) => idx.length >= 12;
  const skinTexture = enough(skin) ? highPass(skin) / Math.max(1, L(skin)) : NaN;
  const skinBlotch = enough(skin) ? Math.hypot(std(skin.map(i => { const x = i % W, y = (i - x) / W; let s = 0, n = 0; for (let dy = -3 * r; dy <= 3 * r; dy += r) for (let dx = -3 * r; dx <= 3 * r; dx += r) { s += cr(at(x + dx, y + dy)); n++; } return s / n; })), std(skin.map(i => cb(i * 4)))) / Math.max(1, L(skin)) * 100 : NaN;
  const underEyeIdx = [...region({ center: lerp(P(145), P(50), .38), radius: faceW * .03 }), ...region({ center: lerp(P(374), P(280), .38), radius: faceW * .03 })];
  const underEye = enough(underEyeIdx) && enough(cheeks) ? L(underEyeIdx) / cheekL : NaN;
  // Sclera: inside the lid contour, outside the iris disc.
  const eye = (contour: number[], iris: number, ring: number[]) => {
    const c = P(iris), radius = mean(ring.map(i => Math.hypot(P(i).x - c.x, P(i).y - c.y))) * 1.1;
    return region(contour.map(P), false, (x, y) => Math.hypot(x - c.x, y - c.y) < radius);
  };
  const sclera = mesh.length >= 478 ? [
    ...eye([33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246], 468, [469, 470, 471, 472]),
    ...eye([263, 249, 390, 373, 374, 380, 381, 382, 362, 398, 384, 385, 386, 387, 388, 466], 473, [474, 475, 476, 477]),
  ] : [];
  // Keep the brighter half: lashes and lid shadow are not sclera.
  const scleraBright = [...sclera].sort((a, b) => luma(b * 4) - luma(a * 4)).slice(0, Math.ceil(sclera.length / 2));
  const scleraBrightness = scleraBright.length >= 6 && enough(cheeks) ? L(scleraBright) / cheekL : NaN;
  const scleraRedness = scleraBright.length >= 6 ? mean(scleraBright.map(i => (d[i * 4]! - d[i * 4 + 1]!) / Math.max(1, luma(i * 4)))) : NaN;
  const crease = [
    ...region({ center: outward(P(33), faceW * .05), radius: faceW * .035 }), ...region({ center: outward(P(263), faceW * .05), radius: faceW * .035 }),
    ...region({ center: outward(lerp(P(48), P(61), .5), faceW * .015), radius: faceW * .03 }), ...region({ center: outward(lerp(P(278), P(291), .5), faceW * .015), radius: faceW * .03 }),
    ...forehead,
  ];
  const creasing = enough(crease) ? highPass(crease) / Math.max(1, L(crease)) : NaN;
  const brow = [...region([70, 63, 105, 66, 107, 55, 65, 52, 53, 46].map(P), false), ...region([300, 293, 334, 296, 336, 285, 295, 282, 283, 276].map(P), false)];
  const browContrast = enough(brow) && enough(forehead) ? 1 - L(brow) / foreheadL : NaN;
  const lips = region([61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84, 181, 91, 146].map(P), false);
  const lipContrast = enough(lips) && enough(cheeks) ? (mean(lips.map(i => cr(i * 4))) - mean(cheeks.map(i => cr(i * 4)))) / Math.max(1, cheekL) * 100 : NaN;
  // Facial hair: chin, jaw and moustache areas against the cheeks.
  const beard = [
    ...region({ center: lerp(P(17), P(152), .55), radius: faceW * .06 }, false),
    ...region({ center: lerp(P(150), P(61), .25), radius: faceW * .045 }, false), ...region({ center: lerp(P(379), P(291), .25), radius: faceW * .045 }, false),
    ...region({ center: lerp(P(2), P(0), .5), radius: faceW * .025 }, false),
  ];
  const facialHair = enough(beard) && enough(cheeks) ? (1 - L(beard) / cheekL) + 2 * (highPass(beard) / Math.max(1, L(beard)) - highPass(cheeks) / Math.max(1, cheekL)) : NaN;
  // Hair length and temple recession from the hair segmentation class.
  let hairLength = NaN, templeRecession = NaN;
  if (segmentation) {
    const sw = segmentation.width, sh = segmentation.height, cat = segmentation.categories;
    const mouthY = P(0).y / H, cx = mid / W, half = faceW / W * .9;
    let n = 0;
    for (let y = Math.ceil(mouthY * sh); y < sh; y++) for (let x = Math.max(0, Math.floor((cx - half) * sw)); x < Math.min(sw, Math.ceil((cx + half) * sw)); x++) if (cat[y * sw + x] === 1) n++;
    hairLength = n / (sw * sh) / ((faceW / W) * (faceH / H));
    const hairline = (x: number) => {
      const col = Math.min(sw - 1, Math.max(0, Math.round(x / W * sw)));
      const stop = Math.round(Math.min(P(105).y, P(334).y) / H * sh);
      let hair = -1;
      for (let y = 0; y < stop; y++) { const c = cat[y * sw + col]; if (c === 1) hair = y; else if (c === 3 && hair >= 0) return y / sh * H; }
      return NaN;
    };
    const center = hairline(P(10).x), lateral = mean([hairline(P(70).x), hairline(P(300).x)].filter(Number.isFinite));
    templeRecession = Number.isFinite(center) && Number.isFinite(lateral) ? (center - lateral) / faceH : NaN;
  }
  // Jawline shadow: darkness just below the mandible contour against the cheeks
  // (measured below the border, so a beard above it does not count as definition).
  const jawPts = [172, 136, 150, 149, 176, 148, 152, 377, 400, 378, 379, 365, 397];
  const shade: number[] = [];
  for (const i of jawPts) {
    const p = P(i), down = { x: p.x, y: p.y + faceH * .035 };
    if (segmentation && seg(down) !== 2 && seg(down) !== 3) continue;
    shade.push(1 - boxL(down.x, down.y, r * 2) / Math.max(1, cheekL));
  }
  const jawShadow = shade.length >= 5 ? mean(shade) : NaN;
  const submalar = [...region({ center: lerp(P(205), P(213), .5), radius: faceW * .04 }), ...region({ center: lerp(P(425), P(433), .5), radius: faceW * .04 })];
  const malar = [...region({ center: lerp(P(116), P(50), .5), radius: faceW * .04 }), ...region({ center: lerp(P(345), P(280), .5), radius: faceW * .04 })];
  const submalarShadow = enough(submalar) && enough(malar) ? 1 - L(submalar) / L(malar) : NaN;
  const lowerFaceWidth = Math.hypot(P(361).x - P(132).x, P(361).y - P(132).y) / faceW;
  // Symmetry: bilateral pairs after removing roll and centring on the midline.
  const roll = Math.atan2(P(473).y - P(468).y, P(473).x - P(468).x);
  const cos = Math.cos(-roll), sin = Math.sin(-roll);
  const level = (p: Px): Px => ({ x: p.x * cos - p.y * sin, y: p.x * sin + p.y * cos });
  const ipd = Math.hypot(P(473).x - P(468).x, P(473).y - P(468).y);
  const midX = mean(MIDLINE.map(i => level(P(i)).x));
  let asym = 0, total = 0;
  for (const [a, b, wgt] of SYM_PAIRS) {
    if (!mesh[a] || !mesh[b]) continue;
    const pa = level(P(a)), pb = level(P(b));
    asym += wgt * (Math.abs((pa.x - midX) + (pb.x - midX)) + Math.abs(pa.y - pb.y)) / ipd; total += wgt;
  }
  const noseAsymmetry = (Math.abs(level(P(4)).x - midX) + Math.abs((level(P(48)).x - midX) + (level(P(278)).x - midX)) / 2) / ipd;
  return {
    version: 1, asymmetry: total ? asym / total : null, noseAsymmetry: finite(noseAsymmetry),
    skinTexture: finite(skinTexture), skinBlotch: finite(skinBlotch), underEye: finite(underEye),
    scleraBrightness: finite(scleraBrightness), scleraRedness: finite(scleraRedness), creasing: finite(creasing),
    browContrast: finite(browContrast), lipContrast: finite(lipContrast), facialHair: finite(facialHair),
    hairLength: finite(hairLength), templeRecession: finite(templeRecession), jawShadow: finite(jawShadow),
    submalarShadow: finite(submalarShadow), lowerFaceWidth: finite(lowerFaceWidth),
  };
}
