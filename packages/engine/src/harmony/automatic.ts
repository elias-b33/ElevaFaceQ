import { seedDocument } from "./landmarks";
import type { HarmonyView, MeasurementDocument, NamedPoint, XY } from "./types";
import { detectProfile, type PoseLandmark } from "./profile-detect";

export interface SegmentationPlane { width: number; height: number; categories: Uint8Array }
export interface PixelPlane { width: number; height: number; data: Uint8Array | Uint8ClampedArray }
export interface AutomaticInput {
  view: HarmonyView;
  aspect: number;
  imageHeight: number;
  segmentation?: SegmentationPlane;
  pixels?: PixelPlane;
  mesh?: readonly (XY & { z?: number })[];
  /** Optional body-pose landmarks (normalized), used as eye/ear/mouth priors in profiles. */
  pose?: readonly PoseLandmark[];
  at?: number;
}
type Box = { x0: number; x1: number; y0: number; y1: number; count: number };
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const mean = (values: number[]) => values.reduce((s, n) => s + n, 0) / Math.max(1, values.length);
const median = (values: number[]) => { const s = values.sort((a, b) => a - b); return s[Math.floor(s.length / 2)] ?? NaN; };

function faceComponent(seg: SegmentationPlane): { members: Uint8Array; box: Box; multiple: boolean } | undefined {
  const { width: w, height: h, categories: labels } = seg;
  if (w < 8 || h < 8 || w * h !== labels.length || labels.length > 4_194_304) return;
  const seen = new Uint8Array(labels.length), queue = new Int32Array(labels.length);
  const regions: { box: Box; indices: Int32Array }[] = [];
  for (let start = 0; start < labels.length; start++) {
    if (seen[start] || labels[start] !== 3) continue;
    let read = 0, end = 1; queue[0] = start; seen[start] = 1;
    const b = { x0: w, x1: 0, y0: h, y1: 0, count: 0 };
    while (read < end) {
      const i = queue[read++]!, x = i % w, y = Math.floor(i / w);
      b.x0 = Math.min(b.x0, x); b.x1 = Math.max(b.x1, x); b.y0 = Math.min(b.y0, y); b.y1 = Math.max(b.y1, y);
      for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]) if (j >= 0 && !seen[j] && labels[j] === 3) { seen[j] = 1; queue[end++] = j; }
    }
    b.count = end;
    if (end > Math.max(50, labels.length * .002)) regions.push({ box: b, indices: queue.slice(0, end) });
  }
  regions.sort((a, b) => b.box.count - a.box.count);
  const first = regions[0]; if (!first || first.box.y1 - first.box.y0 < h * .12) return;
  const second = regions[1];
  const multiple = !!second && second.box.count > first.box.count * .4 && Math.abs((first.box.x0 + first.box.x1) - (second.box.x0 + second.box.x1)) > w * .2;
  const members = new Uint8Array(labels.length); for (const i of first.indices) members[i] = 1;
  return { members, box: first.box, multiple };
}

function sampler(seg: SegmentationPlane, input: AutomaticInput, face: NonNullable<ReturnType<typeof faceComponent>>, left = false) {
  const { width: w, height: h, categories } = seg, { aspect } = input;
  const pixelX = (u: number) => clamp(Math.round((left ? 1 - u / aspect : u / aspect) * (w - 1)), 0, w - 1);
  const at = (u: number, y: number) => categories[clamp(Math.round(y * (h - 1)), 0, h - 1) * w + pixelX(u)];
  const norm = (x: number) => (left ? 1 - x / (w - 1) : x / (w - 1)) * aspect;
  function bounds(y: number, skin = false): [number, number] | undefined {
    const row = clamp(Math.round(y * (h - 1)), 0, h - 1);
    let lo = Infinity, hi = -Infinity;
    for (let x = 0; x < w; x++) {
      const i = row * w + x;
      if (skin ? categories[i] === 2 || face.members[i] : face.members[i]) { const u = norm(x); lo = Math.min(lo, u); hi = Math.max(hi, u); }
    }
    if (lo <= hi) return [lo, hi];
  }
  const curve = (y: number, forward = true) => {
    const values: number[] = [];
    for (let d = -2; d <= 2; d++) { const b = bounds(y + d / h); if (b) values.push(b[forward ? 1 : 0]); }
    return median(values);
  };
  function gray(u: number, v: number) {
    const p = input.pixels; if (!p) return 128;
    const x = clamp(Math.round((left ? 1 - u / aspect : u / aspect) * (p.width - 1)), 0, p.width - 1), y = clamp(Math.round(v * (p.height - 1)), 0, p.height - 1), i = (y * p.width + x) * 4;
    return .2126 * p.data[i]! + .7152 * p.data[i + 1]! + .0722 * p.data[i + 2]!;
  }
  function edgeCurve(y: number) {
    const predicted = curve(y), p = input.pixels;
    if (!p || !Number.isFinite(predicted)) return predicted;
    const pixel = input.aspect / p.width, radius = (face.box.y1 - face.box.y0) / h * .045;
    const rgb = (u: number, v: number) => {
      const x = clamp(Math.round((left ? 1 - u / aspect : u / aspect) * (p.width - 1)), 0, p.width - 1), row = clamp(Math.round(v * (p.height - 1)), 0, p.height - 1);
      return (row * p.width + x) * 4;
    };
    let best = predicted, bestScore = 12;
    for (let u = predicted - radius; u <= predicted + radius; u += pixel) {
      let contrast = 0;
      for (const dy of [-1, 0, 1]) {
        const a = rgb(u - pixel * 2, y + dy / p.height), b = rgb(u + pixel * 2, y + dy / p.height);
        contrast += Math.hypot(p.data[a]! - p.data[b]!, p.data[a + 1]! - p.data[b + 1]!, p.data[a + 2]! - p.data[b + 2]!) / (3 * Math.sqrt(3));
      }
      const score = contrast - Math.abs(u - predicted) / Math.max(radius, pixel) * 8;
      if (score > bestScore) { bestScore = score; best = u; }
    }
    return best;
  }
  return { at, bounds, curve, edgeCurve, gray, norm };
}

/** Automatic suggestions are evidence-labelled drafts, never confirmation.
 * Contour extraction is image driven; internal ear/bone references are explicitly
 * inferred. Low-quality (<.3) suggestions remain excluded until user review. */
export function automaticLandmarks(input: AutomaticInput): MeasurementDocument {
  const { view, aspect, mesh, segmentation: seg } = input;
  const doc = seedDocument(view, aspect, view === "front" ? mesh : undefined);
  doc.imageHeight = input.imageHeight; doc.updatedAt = input.at ?? 0;
  const warnings: string[] = [];
  const put = (key: string, x: number, y: number, source: NamedPoint["source"], confidence: number, evidence: string) => {
    if (!Number.isFinite(x) || !Number.isFinite(y) || x < .001 || x > .999 || y < .001 || y > .999) return;
    doc.points[key] = { x, y, source, reviewed: false, confidence, evidence };
  };
  for (const p of Object.values(doc.points)) if (p.source === "mesh") { p.confidence = .85; p.evidence = "Local face-mesh prediction"; }
  const face = seg ? faceComponent(seg) : undefined;
  if (face?.multiple) {
    warnings.push("More than one face region was found. Use a photograph containing one person.");
    for (const p of Object.values(doc.points)) { p.source = "template"; p.reviewed = false; }
    return finish(doc, warnings, !!mesh?.length, input.at ?? 0);
  }
  if (view === "front") {
    if (!mesh || mesh.length < 468) { warnings.push("A reliable front face mesh could not be found. Try a clearer, straight-on photograph."); return finish(doc, warnings, false, input.at ?? 0); }
    const pt = (i: number) => mesh[i]!;
    const h = Math.abs(pt(152).y - pt(10).y), center = (pt(133).x + pt(362).x) / 2;
    for (const [suffix, outer, inner, top, bottom, brow, bridge] of [["L", 33, 133, 159, 145, 55, 193], ["R", 263, 362, 386, 374, 285, 417]] as const) {
      const sign = suffix === "L" ? -1 : 1, eyeWidth = Math.abs(pt(outer).x - pt(inner).x);
      put(`hood${suffix}`, pt(outer).x + sign * eyeWidth * .12, pt(outer).y - (pt(bottom).y - pt(top).y) * .12, "estimated", .48, "Outer hood estimate from the eye-corner geometry; check the visible fold");
      put(`bridge${suffix}`, pt(bridge).x, pt(bridge).y, "estimated", .46, "Mesh-based nasal bridge proxy; check the visible bridge edge");
      let creaseY = pt(top).y - h * .025, score = 0;
      if (seg && face && input.pixels) {
        const sample = sampler(seg, input, face), x = (pt(outer).x + pt(inner).x) / 2 * aspect;
        const low = pt(brow).y + h * .015, high = pt(top).y - h * .012;
        for (let y = low; y < high; y += 1 / input.imageHeight) {
          const contrast = mean([-.08, 0, .08].map(d => { const u = x + d * eyeWidth * aspect; return Math.abs(sample.gray(u, y + 2 / input.imageHeight) - sample.gray(u, y - 2 / input.imageHeight)); }));
          if (contrast > score) { score = contrast; creaseY = y; }
        }
      }
      put(`crease${suffix}`, (pt(outer).x + pt(inner).x) / 2, creaseY, score > 10 ? "contour" : "estimated", score > 10 ? .53 : .24, score > 10 ? "Local upper-lid contrast edge; check that it is the crease" : "Crease is not distinct in this photo; excluded until reviewed");
    }
    if (seg && face) {
      const sample = sampler(seg, input, face);
      const { box } = face, cx = center * aspect;
      const browY = (pt(55).y + pt(285).y) / 2;
      const candidates: number[] = [];
      for (let d = -2; d <= 2; d++) {
        const u = cx + d * h * .012;
        for (let y = Math.max(.005, pt(10).y - h * .35); y < browY - h * .1; y += 1 / seg.height) {
          if (sample.at(u, y) === 3 && sample.at(u, y + .01) === 3) { candidates.push(y); break; }
        }
      }
      if (candidates.length) {
        const y = median(candidates), hairAbove = [0, -.02, .02].some(d => sample.at(cx + d * h, y - h * .035) === 1);
        put("hairline", center, y, hairAbove ? "contour" : "estimated", hairAbove ? .65 : .37, hairAbove ? "Hair-to-face segmentation boundary at the forehead center" : "Visible forehead boundary; actual hairline may be hidden or absent");
      }
      for (const [suffix, side, cheek] of [["L", 0, 116], ["R", 1, 345]] as const) {
        const candidates: { x: number; y: number }[] = [];
        for (let y = Math.max(box.y0 / seg.height, pt(33).y - .02 * h); y < pt(2).y + .06 * h; y += 1 / seg.height) {
          const bounds = sample.bounds(y, true); if (bounds) candidates.push({ x: bounds[side] / aspect, y });
        }
        candidates.sort((a, b) => suffix === "L" ? a.x - b.x : b.x - a.x);
        const ear = candidates[0];
        if (ear && Math.abs(ear.x - pt(cheek).x) * aspect > h * .025) put(`ear${suffix}`, ear.x, ear.y, "contour", .48, "Outermost skin boundary near ear level; hair and head rotation can obscure it");
      }
      // Neck width at its narrowest point below the jaw: the contiguous body-skin
      // run through the midline, so shoulders and an open collar are excluded.
      let neck: { y: number; l: number; r: number } | undefined;
      const mid = Math.round(((pt(152).x + pt(10).x) / 2) * (seg.width - 1));
      for (let y = pt(152).y + h * .05; y < Math.min(.985, pt(152).y + h * .3); y += 1 / seg.height) {
        const row = Math.round(y * (seg.height - 1)) * seg.width;
        if (seg.categories[row + mid] !== 2) continue;
        let l = mid, r = mid;
        while (l > 0 && seg.categories[row + l - 1] === 2) l--;
        while (r < seg.width - 1 && seg.categories[row + r + 1] === 2) r++;
        // Both edges must meet background or hair; clothing marks a collar, not the neck outline.
        const outside = (x: number) => x < 0 || x >= seg.width || seg.categories[row + x] === 0 || seg.categories[row + x] === 1;
        if (!outside(l - 1) || !outside(r + 1)) continue;
        if (!neck || r - l < neck.r - neck.l) neck = { y, l, r };
      }
      if (neck && (neck.r - neck.l) / (seg.width - 1) * aspect > h * .25) {
        put("neckL", neck.l / (seg.width - 1), neck.y, "contour", .62, "Narrowest neck width below the jaw, from the body-skin boundary");
        put("neckR", neck.r / (seg.width - 1), neck.y, "contour", .62, "Narrowest neck width below the jaw, at the same level");
      } else warnings.push("The neck is not visible below the jaw. Include the neck to measure neck width.");
    } else warnings.push("Contour segmentation was unavailable. Mesh points are suggested; hairline, ear and neck points may need a quick review.");
    warnings.push("Hood, bridge and faint crease positions are estimates. Inspect these small features before relying on their ratios.");
    return finish(doc, warnings, true, input.at ?? 0);
  }
  if (!seg) { warnings.push("No usable face-skin region was found for the profile. Use a clear side photograph with the face and neck visible."); return finish(doc, warnings, !!mesh?.length, input.at ?? 0); }
  const detected = detectProfile({ ...seg, pixels: input.pixels, pose: input.pose });
  if ("error" in detected) { warnings.push(detected.error); return finish(doc, warnings, !!mesh?.length, input.at ?? 0); }
  for (const [key, p] of Object.entries(detected.points)) put(key, p.x, p.y, p.source, p.confidence, p.evidence);
  warnings.push(...detected.warnings);
  warnings.push("Ear opening, orbital rim and eye references are estimated from the visible ear, eye and pose cues. Review the highlighted points.");
  return finish(doc, warnings, !!mesh?.length, input.at ?? 0, detected.facing);
}
function finish(doc: MeasurementDocument, warnings: string[], meshFound: boolean, at: number, facing?: "left" | "right") {
  const points = Object.values(doc.points);
  doc.automatic = { engine: "local-mesh-contour-1.0", at, detected: points.filter(p => p.source === "mesh" || p.source === "contour").length, estimated: points.filter(p => p.source === "estimated").length, missing: points.filter(p => p.source === "template" || (p.confidence ?? 1) < .3).length, warnings, meshFound, ...(facing ? { facing } : {}) };
  return doc;
}
export function mergeAutomaticDocument(existing: MeasurementDocument | undefined, automatic: MeasurementDocument): MeasurementDocument {
  if (!existing) return automatic;
  const points = { ...automatic.points };
  for (const [key, p] of Object.entries(existing.points)) if (p.source === "manual" || p.reviewed) points[key] = { ...p };
  return { ...automatic, points, ...(existing.calibration ? { calibration: existing.calibration } : {}) };
}
