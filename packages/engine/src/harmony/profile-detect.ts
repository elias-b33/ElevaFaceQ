import type { NamedPoint, XY } from "./types";

/** BlazePose-style landmark in normalized image coordinates (x right, y down). */
export interface PoseLandmark { x: number; y: number; z?: number; visibility?: number }
export interface ProfileDetectionInput {
  /** Selfie-multiclass labels: 0 background, 1 hair, 2 body skin, 3 face skin, 4 clothes, 5 other. */
  width: number;
  height: number;
  categories: Uint8Array;
  pixels?: { width: number; height: number; data: Uint8Array | Uint8ClampedArray };
  pose?: readonly PoseLandmark[];
}
export interface DetectedPoint extends XY { source: NamedPoint["source"]; confidence: number; evidence: string }
export interface ProfileDetection {
  facing: "left" | "right";
  points: Record<string, DetectedPoint>;
  warnings: string[];
  /** Refined anterior silhouette in normalized coordinates, forehead to neck. */
  contour: XY[];
}

type P = { x: number; y: number };
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const median = (values: number[]) => { const s = [...values].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)]! : NaN; };
/** Positive when p lies behind (posterior to) the downward chord a → b in a right-facing frame. */
const behind = (a: P, b: P, p: P) => ((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)) / Math.max(1e-9, Math.hypot(b.x - a.x, b.y - a.y));

function components(mask: Uint8Array, w: number, h: number) {
  const label = new Int32Array(mask.length).fill(-1), queue = new Int32Array(mask.length), sizes: number[] = [];
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || label[start]! >= 0) continue;
    const id = sizes.length;
    let read = 0, end = 1; queue[0] = start; label[start] = id;
    while (read < end) {
      const i = queue[read++]!, x = i % w;
      for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i >= w ? i - w : -1, i + w < mask.length ? i + w : -1]) {
        if (j >= 0 && mask[j] && label[j]! < 0) { label[j] = id; queue[end++] = j; }
      }
    }
    sizes.push(end);
  }
  return { label, sizes };
}
function largest(mask: Uint8Array, w: number, h: number) {
  const { label, sizes } = components(mask, w, h);
  if (!sizes.length) return undefined;
  const order = sizes.map((s, i) => [s, i] as const).sort((a, b) => b[0] - a[0]);
  const id = order[0]![1], out = new Uint8Array(mask.length);
  for (let i = 0; i < mask.length; i++) if (label[i] === id) out[i] = 1;
  return { mask: out, size: order[0]![0], second: order[1]?.[0] ?? 0 };
}
/** Clockwise (in y-down image coordinates) Moore-neighbour trace of a component's outer boundary. */
function traceOuter(mask: Uint8Array, w: number, h: number): P[] {
  let start = -1;
  for (let i = 0; i < mask.length && start < 0; i++) if (mask[i]) start = i;
  if (start < 0) return [];
  const dx = [-1, -1, 0, 1, 1, 1, 0, -1], dy = [0, -1, -1, -1, 0, 1, 1, 1];
  const on = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && mask[y * w + x] === 1;
  let cx = start % w, cy = Math.floor(start / w), back = 0;
  const path: P[] = [{ x: cx, y: cy }];
  for (let step = 0; step < 4 * mask.length; step++) {
    let moved = false;
    for (let k = 1; k <= 8; k++) {
      const d = (back + k) % 8;
      if (on(cx + dx[d]!, cy + dy[d]!)) {
        cx += dx[d]!; cy += dy[d]!;
        back = (d + 4) % 8; // search resumes clockwise from the pixel just left
        moved = true; break;
      }
    }
    if (!moved) break;
    // Jacob's criterion: stop only when the start pixel is left the same way again.
    if (path.length > 2 && path.at(-1)!.x === path[0]!.x && path.at(-1)!.y === path[0]!.y && cx === path[1]!.x && cy === path[1]!.y) { path.pop(); break; }
    path.push({ x: cx, y: cy });
  }
  return path;
}
function resample(path: P[], spacing: number): P[] {
  if (path.length < 2) return path;
  const out: P[] = [path[0]!];
  let carry = 0;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]!, b = path[i]!, len = Math.hypot(b.x - a.x, b.y - a.y);
    let t = spacing - carry;
    while (t <= len) { out.push({ x: a.x + (b.x - a.x) * t / len, y: a.y + (b.y - a.y) * t / len }); t += spacing; }
    carry = len - (t - spacing);
  }
  return out;
}
function smooth(path: P[], radius: number): P[] {
  return path.map((_, i) => {
    let sx = 0, sy = 0, sw = 0;
    for (let k = -radius; k <= radius; k++) {
      const p = path[clamp(i + k, 0, path.length - 1)]!, weight = Math.exp(-(k * k) / (2 * Math.max(.5, radius / 2) ** 2));
      sx += p.x * weight; sy += p.y * weight; sw += weight;
    }
    return { x: sx / sw, y: sy / sw };
  });
}
/** Least-squares line through points, as a centroid and unit direction. */
function fitLine(points: P[]) {
  const n = points.length, mx = points.reduce((s, p) => s + p.x, 0) / n, my = points.reduce((s, p) => s + p.y, 0) / n;
  let sxx = 0, sxy = 0, syy = 0;
  for (const p of points) { sxx += (p.x - mx) ** 2; sxy += (p.x - mx) * (p.y - my); syy += (p.y - my) ** 2; }
  const theta = .5 * Math.atan2(2 * sxy, sxx - syy), d = { x: Math.cos(theta), y: Math.sin(theta) };
  const residual = points.reduce((s, p) => s + ((p.x - mx) * d.y - (p.y - my) * d.x) ** 2, 0);
  return { c: { x: mx, y: my }, d, residual };
}
function intersect(a: { c: P; d: P }, b: { c: P; d: P }): P | undefined {
  const cross = a.d.x * b.d.y - a.d.y * b.d.x;
  if (Math.abs(cross) < 1e-6) return;
  const t = ((b.c.x - a.c.x) * b.d.y - (b.c.y - a.c.y) * b.d.x) / cross;
  return { x: a.c.x + a.d.x * t, y: a.c.y + a.d.y * t };
}

/**
 * Locates soft-tissue profile landmarks from a selfie-multiclass segmentation,
 * the photo pixels and (optionally) body-pose priors. Contour landmarks are
 * prominences and concavities of the refined silhouette; the jaw comes from a
 * two-line fit of the face/neck boundary; eye and ear references combine pose
 * priors with local image evidence. Every point carries its evidence label.
 */
export function detectProfile(input: ProfileDetectionInput): ProfileDetection | { error: string } {
  const { width: w, height: h, categories } = input;
  if (w < 32 || h < 32 || categories.length !== w * h) return { error: "The segmentation plane is invalid." };
  const pose = input.pose && input.pose.length >= 11 && input.pose.every(p => Number.isFinite(p.x) && Number.isFinite(p.y)) ? input.pose : undefined;
  const warnings: string[] = [];

  // Facing: pose nose vs ears, then face-skin vs hair/neck centroids.
  let facingRight: boolean | undefined;
  if (pose) {
    const ears = (pose[7]!.x + pose[8]!.x) / 2;
    if (Math.abs(pose[0]!.x - ears) > .01) facingRight = pose[0]!.x > ears;
  }
  if (facingRight === undefined) {
    const centroid = (label: number) => { let s = 0, n = 0; for (let i = 0; i < categories.length; i++) if (categories[i] === label) { s += i % w; n++; } return n > 50 ? s / n : NaN; };
    const face = centroid(3), rear = Number.isFinite(centroid(1)) ? centroid(1) : centroid(2);
    if (Number.isFinite(face) && Number.isFinite(rear) && Math.abs(face - rear) > w * .02) facingRight = face > rear;
    else {
      // No hair or neck: the nose makes the anterior edge the more protrusive one.
      const edge = (right: boolean) => {
        const xs: number[] = [];
        for (let y = 0; y < h; y++) {
          let v = NaN;
          for (let k = 0; k < w; k++) { const x = right ? w - 1 - k : k; if (categories[y * w + x] === 3) { v = right ? x : w - 1 - x; break; } }
          xs.push(v);
        }
        let best = 0;
        for (let y = 0; y < h; y++) {
          const a = xs[Math.max(0, y - Math.round(h * .08))]!, b = xs[Math.min(h - 1, y + Math.round(h * .08))]!;
          if ([xs[y]!, a, b].every(Number.isFinite)) best = Math.max(best, xs[y]! - (a + b) / 2);
        }
        return best;
      };
      if (!Number.isFinite(face)) return { error: "No usable face-skin region was found for the profile. Use a clear side photograph with the face and neck visible." };
      facingRight = edge(true) >= edge(false);
    }
  }
  const flip = !facingRight;
  const cat = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) cat[y * w + x] = categories[y * w + (flip ? w - 1 - x : x)]!;
  const toNorm = (p: P): XY => ({ x: ((flip ? w - 1 - p.x : p.x) + .5) / w, y: (p.y + .5) / h });
  const fromNorm = (p: XY): P => { const x = p.x * w - .5; return { x: flip ? w - 1 - x : x, y: p.y * h - .5 }; };
  const label = (x: number, y: number) => cat[clamp(Math.round(y), 0, h - 1) * w + clamp(Math.round(x), 0, w - 1)]!;

  const faceSkin = largest(cat.map(c => c === 3 ? 1 : 0), w, h);
  if (!faceSkin || faceSkin.size < w * h * .004) return { error: "No usable face-skin region was found for the profile. Use a clear side photograph with the face and neck visible." };
  if (faceSkin.second > faceSkin.size * .45) warnings.push("More than one face-sized region was found. Use a photograph containing one person.");
  let fy0 = h, fy1 = 0, fx0 = w, fx1 = 0;
  for (let i = 0; i < faceSkin.mask.length; i++) if (faceSkin.mask[i]) { const x = i % w, y = (i - x) / w; fy0 = Math.min(fy0, y); fy1 = Math.max(fy1, y); fx0 = Math.min(fx0, x); fx1 = Math.max(fx1, x); }
  const person = largest(cat.map(c => c ? 1 : 0), w, h)!;

  // Colour access in the right-facing mask frame.
  const px = input.pixels;
  const rgb = (x: number, y: number): [number, number, number] => {
    if (!px) { const c = label(x, y); return c ? [200, 160, 140] : [128, 128, 128]; }
    const n = toNorm({ x, y }), u = clamp(n.x * px.width - .5, 0, px.width - 1), v = clamp(n.y * px.height - .5, 0, px.height - 1);
    const x0 = Math.floor(u), y0 = Math.floor(v), x1 = Math.min(px.width - 1, x0 + 1), y1 = Math.min(px.height - 1, y0 + 1), fx = u - x0, fy = v - y0;
    const out: [number, number, number] = [0, 0, 0];
    for (let c = 0; c < 3; c++) {
      const a = px.data[(y0 * px.width + x0) * 4 + c]! * (1 - fx) + px.data[(y0 * px.width + x1) * 4 + c]! * fx;
      const b = px.data[(y1 * px.width + x0) * 4 + c]! * (1 - fx) + px.data[(y1 * px.width + x1) * 4 + c]! * fx;
      out[c] = a * (1 - fy) + b * fy;
    }
    return out;
  };
  const luma = (x: number, y: number) => { const [r, g, b] = rgb(x, y); return .2126 * r + .7152 * g + .0722 * b; };

  // Ordered anterior silhouette: clockwise from the top of the head runs down the face.
  const outer = traceOuter(person.mask, w, h);
  if (outer.length < 50) return { error: "The profile silhouette could not be traced. Retake against a plain contrasting background." };
  const raw = smooth(resample(outer, 1), 1);

  // Reference levels: the visible eye and mouth from pose, else face-skin proportions.
  let eye: P | undefined, mouth: P | undefined, poseEar: P | undefined;
  if (pose) {
    const near = (a: number[], b: number[]) => { const z = (ids: number[]) => ids.reduce((s, i) => s + (pose[i]!.z ?? 0), 0) / ids.length; return z(a) <= z(b) ? a : b; };
    const eyeIds = near([1, 2, 3], [4, 5, 6]);
    eye = fromNorm({ x: eyeIds.reduce((s, i) => s + pose[i]!.x, 0) / 3, y: eyeIds.reduce((s, i) => s + pose[i]!.y, 0) / 3 });
    mouth = fromNorm({ x: (pose[9]!.x + pose[10]!.x) / 2, y: (pose[9]!.y + pose[10]!.y) / 2 });
    poseEar = fromNorm((pose[7]!.z ?? 0) <= (pose[8]!.z ?? 0) ? pose[7]! : pose[8]!);
  }
  const faceH = fy1 - fy0;
  let unit = eye && mouth ? mouth.y - eye.y : NaN;
  if (!(unit > faceH * .18 && unit < faceH * .6)) {
    if (pose) warnings.push("Body-pose references were inconsistent with the face region; proportional estimates were used.");
    eye = { x: fx1 - faceH * .2, y: fy0 + faceH * .37 }; mouth = { x: fx1 - faceH * .15, y: fy0 + faceH * .76 }; unit = mouth.y - eye.y;
  }
  const U = unit, E = eye!, M = mouth!;

  // Keep the anterior run from the top of the head to below the chin.
  const anteriorStart = 0;
  let anteriorEnd = raw.length - 1;
  for (let i = 1; i < raw.length; i++) if (raw[i]!.y > M.y + 2.6 * U || (raw[i]!.y > M.y + U && raw[i]!.x < fx0 - U)) { anteriorEnd = i; break; }
  let contour = raw.slice(anteriorStart, anteriorEnd + 1);
  contour = refine(contour);
  if (contour.length < 40) return { error: "The profile silhouette could not be traced. Retake against a plain contrasting background." };

  /** Snap silhouette points to the strongest object/background colour transition along the normal. */
  function refine(path: P[]): P[] {
    if (!px) return path;
    // Background colour from confidently-labelled pixels just in front of the face.
    const bg: number[][] = [[], [], []];
    for (let y = Math.max(0, Math.round(E.y - U)); y < Math.min(h, Math.round(M.y + U)); y += 3) {
      let front = -1;
      for (let x = w - 1; x >= 0; x--) if (person.mask[y * w + x]) { front = x; break; }
      for (let x = front + 6; x < Math.min(w, front + 30); x += 3) if (cat[y * w + x] === 0) { const c = rgb(x, y); for (let k = 0; k < 3; k++) bg[k]!.push(c[k]!); }
    }
    if (bg[0]!.length < 20) return path;
    const bgc = bg.map(median);
    const spread = median(bg[0]!.map((_, i) => Math.hypot(bg[0]![i]! - bgc[0]!, bg[1]![i]! - bgc[1]!, bg[2]![i]! - bgc[2]!)));
    return smooth(path.map((p, i) => {
      const a = path[Math.max(0, i - 3)]!, b = path[Math.min(path.length - 1, i + 3)]!;
      const len = Math.hypot(b.x - a.x, b.y - a.y) || 1, n = { x: (b.y - a.y) / len, y: -(b.x - a.x) / len }; // outward for a clockwise trace
      const samples: number[] = [], t0 = -9;
      for (let t = t0; t <= 7; t += .5) { const c = rgb(p.x + n.x * t, p.y + n.y * t); samples.push(Math.hypot(c[0] - bgc[0]!, c[1] - bgc[1]!, c[2] - bgc[2]!)); }
      const inside = median(samples.slice(0, 5)), outside = median(samples.slice(-5));
      if (inside - outside < Math.max(18, 3 * spread)) return p;
      const mid = (inside + outside) / 2;
      let best: number | undefined;
      for (let k = 1; k < samples.length; k++) {
        const s0 = samples[k - 1]!, s1 = samples[k]!;
        if ((s0 - mid) * (s1 - mid) <= 0 && s0 !== s1) {
          const t = t0 + (k - 1) * .5 + .5 * (s0 - mid) / (s0 - s1);
          if (best === undefined || Math.abs(t) < Math.abs(best)) best = t;
        }
      }
      return best === undefined || Math.abs(best) > 6.5 ? p : { x: p.x + n.x * best, y: p.y + n.y * best };
    }), 1);
  }

  const range = (lo: number, hi: number) => { const out: number[] = []; for (let i = Math.max(0, lo); i <= Math.min(contour.length - 1, hi); i++) out.push(i); return out; };
  const argBest = (ids: number[], score: (p: P, i: number) => number) => { let best = -1, value = -Infinity; for (const i of ids) { const s = score(contour[i]!, i); if (s > value) { value = s; best = i; } } return best; };
  const inBand = (lo: number, hi: number) => contour.map((p, i) => [p, i] as const).filter(([p]) => p.y >= lo && p.y <= hi).map(([, i]) => i);
  const insideLabel = (i: number, depth = 4) => {
    const a = contour[Math.max(0, i - 3)]!, b = contour[Math.min(contour.length - 1, i + 3)]!, len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    return label(contour[i]!.x - (b.y - a.y) / len * depth, contour[i]!.y + (b.x - a.x) / len * depth);
  };

  // Nose tip: the most anterior silhouette point between eye and mouth levels.
  const iPrn = argBest(inBand(E.y + .12 * U, M.y - .12 * U).filter(i => insideLabel(i) === 3), p => p.x);
  if (iPrn < 0) return { error: "The nose could not be found on the profile silhouette. Use a true side view against a plain background." };
  // Glabella ↔ nasion: alternate the deepest concavity and the brow tangent seen from it.
  const browSkin = (i: number) => insideLabel(i) === 3 && insideLabel(i, 9) === 3;
  let iG = argBest(inBand(E.y - .85 * U, E.y + .05 * U).filter(i => i < iPrn && browSkin(i)), p => p.x);
  if (iG < 0) iG = argBest(inBand(E.y - .85 * U, E.y + .05 * U).filter(i => i < iPrn), p => p.x);
  if (iG < 0) return { error: "The forehead contour is hidden. Move hair away from the brow and retake." };
  let iN = iG;
  for (let pass = 0; pass < 3; pass++) {
    const G = contour[iG]!, Pr = contour[iPrn]!;
    iN = argBest(range(iG + 1, iPrn - 1), p => behind(G, Pr, p));
    if (iN < 0) return { error: "The nasal root could not be found on the silhouette." };
    const N = contour[iN]!;
    const next = argBest(inBand(E.y - 1.1 * U, N.y - .04 * U).filter(i => i < iN && browSkin(i)), p => Math.atan2(p.x - N.x, N.y - p.y));
    if (next < 0 || next === iG) break;
    iG = next;
  }
  // Lower face. The chin bottom is the lowest face skin near the front; the
  // lip–chin fold is the deepest concavity under the anterior convex hull; the
  // chin point is the tangent from nasion below that fold (soft-tissue
  // pogonion), which also holds for a retruded chin behind full lips.
  const Prn = contour[iPrn]!, N0 = contour[iN]!;
  let chinBottom = -1;
  for (let y = Math.min(h - 1, Math.round(M.y + 1.6 * U)); y > M.y && chinBottom < 0; y--) {
    for (let x = Math.round(Prn.x - .9 * U); x <= Prn.x + .2 * U; x++) if (x >= 0 && x < w && faceSkin.mask[y * w + x]) { chinBottom = y; break; }
  }
  if (chinBottom < 0) chinBottom = M.y + .9 * U;
  const iChinEnd = contour.findIndex((p, i) => i > iPrn && p.y >= chinBottom - .04 * U);
  if (iChinEnd < 0 || iChinEnd - iPrn < 20) return { error: "The chin could not be found on the profile silhouette. Include the full chin and neck." };
  // Concavities below the nose come in order: nose base, (lip seam), lip–chin fold.
  const depth = hullDepth(iPrn, iChinEnd), sep = Math.max(3, Math.round(.08 * U)), concave: number[] = [];
  for (let k = 1; k < depth.length - 1; k++) {
    const d = depth[k]!;
    if (d < .012 * U || contour[k + iPrn]!.y > chinBottom - .12 * U) continue;
    let peak = true;
    for (let j = Math.max(0, k - sep); j <= Math.min(depth.length - 1, k + sep) && peak; j++) if (depth[j]! > d) peak = false;
    if (peak && (!concave.length || k - concave.at(-1)! > sep)) concave.push(k);
  }
  const folds = concave.map(k => k + iPrn);
  let iSm0 = folds.length >= 2 && contour[folds.at(-1)!]!.y - contour[folds[0]!]!.y > .35 * U ? folds.at(-1)! : -1;
  if (iSm0 < 0) iSm0 = argBest(range(iPrn + 1, iChinEnd - 1).filter(i => contour[i]!.y > M.y + .15 * U && contour[i]!.y < chinBottom - .12 * U), (_, i) => depth[i - iPrn]!);
  const chinTop = iSm0 > 0 ? contour[iSm0]!.y + .12 * U : M.y + .3 * U;
  let iPg = argBest(range(iSm0 > 0 ? iSm0 + 1 : iPrn + 1, iChinEnd).filter(i => contour[i]!.y >= Math.min(chinTop, chinBottom - .2 * U) && contour[i]!.y <= chinBottom - .1 * U && insideLabel(i) === 3), p => Math.atan2(p.x - N0.x, p.y - N0.y));
  if (iPg < 0) iPg = argBest(range(iSm0 > 0 ? iSm0 + 1 : iPrn + 1, iChinEnd).filter(i => insideLabel(i) === 3), p => Math.atan2(p.x - N0.x, p.y - N0.y));
  if (iPg < 0) return { error: "The chin could not be found on the profile silhouette. Include the full chin and neck." };
  const Pg = contour[iPg]!;
  let iNk = -1;
  for (let i = iPg + 1; i < contour.length; i++) if (contour[i]!.y >= Pg.y + .8 * U && insideLabel(i) === 2) { iNk = i; break; }
  let iC = -1, iMe = -1;
  if (iNk > 0) {
    const Nk = contour[iNk]!;
    iC = argBest(range(iPg + 1, iNk - 1), p => behind(Pg, Nk, p));
    const C = contour[iC]!;
    iMe = argBest(range(iPg + 1, iC - 1), p => Math.atan2(p.y - C.y, p.x - C.x));
    if (iMe < 0 || iC - iPg < 4) { iC = -1; iMe = -1; }
  }
  if (iMe < 0) iMe = argBest(range(iPg + 1, contour.length - 1).filter(i => contour[i]!.x > Pg.x - .55 * U && contour[i]!.y < Pg.y + .6 * U), p => p.y);
  if (iMe < 0) return { error: "The lower chin contour could not be traced. Include the full chin and neck." };
  // Nose base and lips between the nose and the fold.
  const iSn = folds.length >= 2 && folds[0]! < iSm0 ? folds[0]! : argBest(range(iPrn + 1, iPg - 1).filter(i => contour[i]!.y < M.y - .08 * U), p => behind(Prn, Pg, p));
  if (iSn < 0) return { error: "The nose base could not be found on the silhouette." };
  const Sn = contour[iSn]!;
  const lipEnd = iSm0 > iSn ? iSm0 - 1 : iPg - 1;
  const prominent = (lo: number, hi: number, a: P, b: P) => argBest(range(lo, hi), p => -behind(a, b, p));
  const lipZone = range(iSn + 1, lipEnd);
  // Lips: the two most prominent local maxima against the subnasale–pogonion line.
  const prom = lipZone.map(i => -behind(Sn, Pg, contour[i]!));
  const peaks: number[] = [];
  const span = Math.max(2, Math.round(U * .06));
  lipZone.forEach((i, k) => { if (prom[k]! >= Math.max(...prom.slice(Math.max(0, k - span), k + span + 1))) peaks.push(i); });
  peaks.sort((a, b) => -behind(Sn, Pg, contour[b]!) + behind(Sn, Pg, contour[a]!));
  let [iLs, iLi] = peaks.slice(0, 2).sort((a, b) => a - b) as [number?, number?];
  if (iLs === undefined || iLi === undefined || contour[iLi]!.y - contour[iLs]!.y < .1 * U) {
    iLs = prominent(iSn + 1, inBand(Sn.y, M.y).at(-1) ?? iSn + 1, Sn, Pg);
    iLi = prominent(Math.max(iLs + 2, inBand(M.y, M.y).at(0) ?? iLs + 2), lipEnd, Sn, Pg);
  }
  if (iLs < 0 || iLi < 0 || iLi <= iLs) return { error: "The lips could not be separated on the silhouette. Keep the lips closed and relaxed." };
  const iSto = argBest(range(iLs + 1, iLi - 1), p => behind(contour[iLs!]!, contour[iLi!]!, p));
  const iSm = iSm0 > iLi ? iSm0 : argBest(range(iLi + 1, iPg - 1), p => behind(contour[iLi!]!, Pg, p));
  /** Depth of each contour point behind the anterior convex hull of the run lo..hi. */
  function hullDepth(lo: number, hi: number) {
    const hull: number[] = [];
    for (let i = lo; i <= hi; i++) {
      while (hull.length >= 2 && behind(contour[hull.at(-2)!]!, contour[i]!, contour[hull.at(-1)!]!) >= 0) hull.pop();
      hull.push(i);
    }
    const out = new Array<number>(hi - lo + 1).fill(0);
    for (let k = 1; k < hull.length; k++) for (let i = hull[k - 1]!; i <= hull[k]!; i++) out[i - lo] = behind(contour[hull[k - 1]!]!, contour[hull[k]!]!, contour[i]!);
    return out;
  }
  // Hairline: first forehead point whose inner side is face skin.
  let iHair = -1;
  for (let i = 0; i < iG; i++) if (insideLabel(i, 5) === 3 && insideLabel(Math.min(iG, i + 2), 5) === 3 && contour[i]!.y > E.y - 2.2 * U) { iHair = i; break; }
  // Nasal dorsum and columella tangents.
  const N = N0, nasal = iPrn - iN;
  const iSupratip = argBest(range(iN + Math.round(nasal * .35), iPrn - Math.max(2, Math.round(nasal * .12))), p => Math.atan2(p.x - N.x, p.y - N.y));
  const tipToBase = iSn - iPrn;
  const iInfratip = iPrn + Math.max(1, Math.round(tipToBase * .3));
  const iColumella = argBest(range(iPrn + Math.round(tipToBase * .2), iSn - Math.max(2, Math.round(tipToBase * .15))), p => -Math.atan2(Sn.y - p.y, p.x - Sn.x));

  const points: Record<string, DetectedPoint> = {};
  const set = (key: string, p: P | undefined, source: DetectedPoint["source"], confidence: number, evidence: string) => {
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return;
    const n = toNorm(p);
    if (n.x < .001 || n.x > .999 || n.y < .001 || n.y > .999) return;
    points[key] = { ...n, source, confidence, evidence };
  };
  const C = (i: number) => i >= 0 ? contour[i] : undefined;
  const silhouette = "Refined silhouette landmark; check its position on the profile edge";
  set("glabella", C(iG), "contour", .78, "Brow prominence: forehead tangent from the nasal root on the refined silhouette");
  set("nasion", C(iN), "contour", .8, "Deepest point between brow and nose on the refined silhouette");
  set("pronasale", C(iPrn), "contour", .86, "Most anterior point of the nose on the refined silhouette");
  set("supratip", C(iSupratip), "contour", .72, "Nasal dorsum tangent point seen from the nasal root");
  set("infratip", C(iInfratip), "contour", .7, "Lower tip contour, below the nasal tip");
  set("columella", C(iColumella), "contour", .7, "Columella tangent point seen from the nose base");
  set("subnasale", C(iSn), "contour", .8, "Junction of the columella and upper lip on the silhouette");
  set("upperLip", C(iLs), "contour", .8, silhouette);
  set("lowerLip", C(iLi), "contour", .8, silhouette);
  set("sublabiale", C(iSm), "contour", .76, "Deepest point of the lip–chin fold on the silhouette");
  set("pogonion", Pg, "contour", .82, "Most anterior point of the soft-tissue chin");
  set("menton", C(iMe), "contour", iC >= 0 ? .74 : .55, iC >= 0 ? "Chin underside tangent seen from the neck junction" : "Lowest chin contour point; neck junction not visible");
  if (iC >= 0) {
    const Cv = contour[iC]!;
    set("cervical", Cv, "contour", .72, "Deepest point between the under-chin contour and the front of the neck");
    const iNeck = argBest(range(iC + 1, iNk), p => -Math.abs(p.y - (Cv.y + .45 * U)));
    set("neck", C(iNeck), "contour", .7, "Front-of-neck silhouette below the neck junction");
  } else warnings.push("The neck contour is cropped or obscured. Include the full chin and front of the neck for the neck angle.");
  if (iHair >= 0 && contour[iG]!.y - contour[iHair]!.y > .35 * U) {
    set("hairline", C(iHair), "contour", .7, "Hair-to-skin boundary on the forehead silhouette");
    const forehead = argBest(range(iHair, iG), p => -Math.abs(p.y - (contour[iHair]!.y + contour[iG]!.y) / 2));
    set("forehead", C(forehead), "contour", .7, "Forehead silhouette midway between hairline and brow");
  } else {
    warnings.push("Hair covers the forehead silhouette. Hairline and forehead-slope measurements need a clear forehead.");
    const top = argBest(range(0, iG), p => -Math.abs(p.y - (contour[iG]!.y - .45 * U)));
    set("forehead", C(top), "contour", .45, "Forehead silhouette above the brow; the hairline is hidden");
  }
  const sto = C(iSto);

  // Jaw: two-line fit of the face-skin lower/posterior boundary behind the chin.
  const jaw = jawFit(contour[iMe]!);
  if (jaw && !jaw.weak) {
    set("gonionLower", jaw.lower, "contour", jaw.quality, "Lower jaw border fitted to the face/neck boundary");
    set("gonionUpper", jaw.upper, "contour", jaw.quality * .92, "Posterior jaw border fitted to the face/neck boundary");
    set("earNotch", jaw.top, "estimated", jaw.quality * .8, "Upper end of the fitted posterior jaw border, below the ear");
  } else {
    // No visible jaw corner: keep editable suggestions out of the measurements until confirmed.
    if (jaw) {
      set("gonionLower", jaw.lower, "estimated", .25, "No visible jaw corner in this photo; suggested position needs your confirmation");
      set("gonionUpper", jaw.upper, "estimated", .25, "No visible jaw corner in this photo; suggested position needs your confirmation");
      set("earNotch", jaw.top, "estimated", .25, "Suggested ear-notch position below the ear; confirm before use");
    }
    warnings.push("The jaw angle is not visible in this photo (soft light, beard, hair or a rounded jawline). Place the jaw points to include the jaw-angle measurements.");
  }

  function jawFit(me: P) {
    // Ordered face-skin boundary from the chin underside back and up to the ear lobe
    // (clockwise trace: front profile → chin → jaw → ramus → ear).
    const trace = resample(traceOuter(faceSkin!.mask, w, h), 1);
    if (trace.length < 30) return;
    let start = 0, nearest = Infinity;
    trace.forEach((p, i) => { const d = Math.hypot(p.x - me.x, p.y - me.y); if (d < nearest) { nearest = d; start = i; } });
    if (nearest > .35 * U) return;
    const lobe = E.y + .5 * U, path: P[] = [];
    for (let k = 1; k < trace.length; k++) {
      const p = trace[(start + k) % trace.length]!;
      if (p.y < lobe || p.x > me.x + .1 * U) break;
      path.push(p);
    }
    if (path.length < 24) return;
    // Two straight tangents with a free breakpoint; the rounded corner itself is skipped.
    const m = path.length, gap = Math.max(2, Math.round(m * .06)), skip = Math.round(m * .08);
    let best: { cost: number; lowerLine: ReturnType<typeof fitLine>; rearLine: ReturnType<typeof fitLine> } | undefined;
    for (let k = Math.round(m * .22); k <= Math.round(m * .8); k++) {
      const l = path.slice(skip, Math.max(skip + 4, k - gap)), r = path.slice(Math.min(m - 4, k + gap), m - skip);
      if (l.length < 6 || r.length < 6) continue;
      const ll = fitLine(l), rl = fitLine(r), cost = (ll.residual + rl.residual) / (l.length + r.length);
      if (!best || cost < best.cost) best = { cost, lowerLine: ll, rearLine: rl };
    }
    if (!best) return weakJaw(path, me);
    // A corner must be real: two tangents must fit far better than one line.
    const single = fitLine(path.slice(skip, m - skip)), singleCost = single.residual / Math.max(1, m - 2 * skip);
    const corner = intersect(best.lowerLine, best.rearLine);
    const angle = 180 - Math.acos(clamp(Math.abs(best.lowerLine.d.x * best.rearLine.d.x + best.lowerLine.d.y * best.rearLine.d.y), 0, 1)) * 180 / Math.PI;
    if (!corner || best.cost > singleCost * .45 || corner.x > me.x - .2 * U || corner.x < me.x - 2.6 * U || corner.y < lobe - .2 * U || corner.y > me.y + .6 * U || angle < 105 || angle > 160) return weakJaw(path, me);
    const along = (line: { c: P; d: P }, from: P, toward: P, t: number) => {
      const d = line.d, s = Math.sign((toward.x - from.x) * d.x + (toward.y - from.y) * d.y) || 1;
      const len = Math.hypot(toward.x - from.x, toward.y - from.y);
      return { x: from.x + d.x * s * len * t, y: from.y + d.y * s * len * t };
    };
    const end = path.at(-1)!, lower = along(best.lowerLine, corner, me, .35), upper = along(best.rearLine, corner, end, .45), top = along(best.rearLine, corner, end, 1);
    // Directed check, as the gonial angle is computed: ramus up toward the ear, body forward to the chin.
    const r = { x: top.x - upper.x, y: top.y - upper.y }, b = { x: me.x - lower.x, y: me.y - lower.y };
    const directed = Math.acos(clamp((r.x * b.x + r.y * b.y) / (Math.hypot(r.x, r.y) * Math.hypot(b.x, b.y) || 1), -1, 1)) * 180 / Math.PI;
    if (r.y > -.15 * U || b.x < .3 * U || directed < 105 || directed > 160) return weakJaw(path, me);
    const quality = clamp(.7 - Math.sqrt(best.cost) / U * 4, .34, .7);
    return { lower, upper, top, quality, weak: false };
  }
  /** Suggestion only: the boundary point farthest behind the lobe–chin chord. */
  function weakJaw(path: P[], me: P) {
    const end = path.at(-1)!;
    let corner = path[0]!, best = -Infinity;
    for (const p of path) { const d = -behind(end, me, p); if (d > best) { best = d; corner = p; } }
    const mix = (a: P, b: P, t: number) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    return { lower: mix(corner, me, .35), upper: mix(corner, end, .45), top: end, quality: .25, weak: true };
  }

  // Eye: darkest compact structure (lashes, iris) near the visible-eye prior.
  const eyeRegion = eyeDetect();
  function eyeDetect() {
    // The eye opening sits just below the nasal root; brows sit above it.
    const Nr = contour[iN]!, prior = { x: Math.min(E.x, Nr.x - .12 * U), y: clamp(E.y, Nr.y - .02 * U, Nr.y + .18 * U) };
    if (!px) return { cornea: { x: Nr.x - .1 * U, y: prior.y }, canthus: { x: Nr.x - .32 * U, y: prior.y }, lid: { x: Nr.x - .16 * U, y: prior.y + .05 * U }, center: prior, quality: .33 };
    const skin: number[] = [];
    const x0 = Math.round(prior.x - .35 * U), x1 = Math.round(Math.min(Nr.x, prior.x + .3 * U)), y0 = Math.round(Nr.y - .1 * U), y1 = Math.round(Nr.y + .3 * U);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (label(x, y) === 3) skin.push(luma(x, y));
    const ref = median(skin);
    if (!Number.isFinite(ref)) return;
    const dark = new Uint8Array(w * h);
    for (let y = Math.max(0, y0); y <= Math.min(h - 1, y1); y++) for (let x = Math.max(0, x0); x <= Math.min(w - 1, x1); x++) {
      if (label(x, y) !== 3 && label(x, y) !== 1) continue;
      if (luma(x, y) < ref * .62) dark[y * w + x] = 1;
    }
    const { label: ids, sizes } = components(dark, w, h);
    let bestId = -1, bestScore = -Infinity;
    sizes.forEach((size, id) => {
      if (size < Math.max(6, U * U * .002)) return;
      let sx = 0, sy = 0, n = 0;
      for (let i = 0; i < ids.length; i++) if (ids[i] === id) { sx += i % w; sy += Math.floor(i / w); n++; }
      const d = Math.hypot(sx / n - prior.x, (sy / n - prior.y) * 1.6) / U;
      const score = Math.log(size) - 6 * d;
      if (score > bestScore) { bestScore = score; bestId = id; }
    });
    if (bestId < 0) return;
    let front: P = { x: -Infinity, y: 0 }, rearP: P = { x: Infinity, y: 0 }, cy = 0, n = 0, bottom = -Infinity;
    for (let i = 0; i < ids.length; i++) if (ids[i] === bestId) {
      const x = i % w, y = Math.floor(i / w);
      cy += y; n++;
      if (x > front.x) front = { x, y };
      if (x < rearP.x) rearP = { x, y };
      bottom = Math.max(bottom, y);
    }
    cy /= n;
    const width = front.x - rearP.x;
    if (width < .08 * U || width > .7 * U) return;
    const center = { x: (front.x + rearP.x) / 2, y: cy };
    return { cornea: { x: front.x + .02 * U, y: cy }, canthus: rearP, lid: { x: center.x + width * .15, y: bottom }, center, quality: .55 };
  }
  const eyeQ = eyeRegion?.quality ?? .33;
  const eyeC = eyeRegion?.center ?? { x: contour[iN]!.x - .2 * U, y: E.y };
  set("cornea", eyeRegion?.cornea ?? { x: contour[iN]!.x - .1 * U, y: E.y }, "estimated", eyeQ, eyeRegion ? "Front of the visible eye opening (dark lid and iris structure)" : "Eye front inferred from the nasal root and pose eye position");
  set("lateralCanthus", eyeRegion?.canthus ?? { x: contour[iN]!.x - .32 * U, y: E.y }, "estimated", eyeQ, eyeRegion ? "Posterior end of the visible eye opening" : "Lateral eye corner inferred from the pose eye position");
  set("lowerEyelid", eyeRegion?.lid ?? { x: contour[iN]!.x - .16 * U, y: E.y + .06 * U }, "estimated", eyeQ * .95, eyeRegion ? "Lower margin of the visible eye opening" : "Lower eyelid inferred below the eye");

  // Ear: the posterior face-skin lobe at eye-to-nose height, refined by the
  // darkest concha shadow; porion sits at the top of the canal shadow.
  const ear = earDetect();
  function earDetect() {
    const fm = faceSkin!.mask, rows: { y: number; back: number }[] = [];
    for (let y = Math.round(E.y - .45 * U); y <= Math.round(E.y + .75 * U); y++) {
      if (y < 0 || y >= h) continue;
      for (let x = 0; x < w; x++) if (fm[y * w + x]) { rows.push({ y, back: x }); break; }
    }
    if (rows.length < 10) return;
    const backMost = rows.reduce((a, b) => b.back < a.back ? b : a);
    const earRows = rows.filter(r => r.back < backMost.back + .35 * U);
    const top = earRows[0]!.y, bottom = earRows.at(-1)!.y;
    if (bottom - top < .35 * U) return;
    const cx0 = backMost.back, cx1 = backMost.back + .62 * U;
    const ySpan = bottom - top;
    let best: P | undefined, bestDark = Infinity;
    const skin: number[] = [];
    for (let y = top; y <= bottom; y += 2) for (let x = Math.round(cx0); x <= cx1; x += 2) if (fm[y * w + x]) skin.push(luma(x, y));
    const ref = median(skin);
    // Smoothed darkness search for the canal/concha in the middle of the ear.
    for (let y = Math.round(top + ySpan * .3); y <= top + ySpan * .7; y += 1) {
      for (let x = Math.round(cx0 + .12 * U); x <= cx0 + .5 * U; x += 1) {
        if (!fm[y * w + x]) continue;
        let s = 0, n = 0;
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { s += luma(x + dx, y + dy); n++; }
        if (s / n < bestDark) { bestDark = s / n; best = { x, y }; }
      }
    }
    if (!best || !(bestDark < ref * .8)) return { porion: undefined, tragus: undefined, quality: .34, top, bottom, back: backMost.back };
    return { porion: { x: best.x, y: best.y - .05 * U }, tragus: { x: best.x + .07 * U, y: best.y + .03 * U }, quality: .5, top, bottom, back: backMost.back };
  }
  const earPrior = poseEar ? { x: poseEar.x - .25 * U, y: poseEar.y } : { x: eyeC.x - 1.05 * U, y: eyeC.y + .2 * U };
  const orbitale = { x: eyeC.x - .02 * U, y: eyeC.y + .2 * U };
  const detectedPorion = ear?.porion ?? (ear ? { x: ear.back + .3 * U, y: ear.top + (ear.bottom - ear.top) * .45 } : earPrior);
  // Frankfort tilt from two estimated points is noisy (several degrees); photos
  // taken in natural head position keep it near horizontal, so the measured
  // tilt is shrunk toward level before it orients every profile angle.
  const run = Math.max(.3 * U, orbitale.x - detectedPorion.x);
  const tilt = clamp(Math.atan2(orbitale.y - detectedPorion.y, run) * .4, -8 * Math.PI / 180, 8 * Math.PI / 180);
  const porion = { x: detectedPorion.x, y: orbitale.y - Math.tan(tilt) * run };
  const tragus = ear?.tragus ? { x: ear.tragus.x, y: ear.tragus.y + (porion.y - detectedPorion.y) } : { x: porion.x + .07 * U, y: porion.y + .08 * U };
  const earQ = ear?.porion ? ear.quality : .34;
  set("porion", porion, "estimated", earQ, ear?.porion ? "Top of the darkest ear-canal shadow in the visible ear" : "Ear-canal position inferred from the ear outline; check before relying on Frankfort angles");
  set("tragus", tragus, "estimated", earQ, ear?.porion ? "Cartilage in front of the detected ear-canal shadow" : "Tragus inferred in front of the ear-canal estimate");
  if (!points.earNotch) set("earNotch", { x: tragus.x + .04 * U, y: tragus.y + .1 * U }, "estimated", .33, "Ear notch inferred below the tragus");
  // Orbitale: soft-tissue lower orbital rim below the eye, refined toward Frankfort horizontal.
  set("orbitale", orbitale, "estimated", .34, "Lower orbital rim inferred below the visible eye; review it with porion for Frankfort leveling");
  // Mouth corner from the pose prior on the closed-lip line; alar base from the crease shadow.
  const corner = mouth && sto ? { x: Math.min(sto.x - .18 * U, Math.max(sto.x - .5 * U, M.x)), y: sto.y + .02 * U } : sto ? { x: sto.x - .3 * U, y: sto.y } : undefined;
  set("mouthCorner", corner, "estimated", pose ? .42 : .34, pose ? "Visible mouth corner from the pose mouth landmark on the lip line" : "Mouth corner inferred behind the lip silhouette");
  set("subalare", alarBase(), "estimated", .38, "Alar-facial crease shadow behind the nose base");
  function alarBase(): P {
    const fallback = { x: Sn.x - .32 * U, y: Sn.y - .05 * U };
    if (!px) return fallback;
    let best = fallback, score = 0;
    for (let y = Math.round(Sn.y - .16 * U); y <= Sn.y + .02 * U; y++) for (let x = Math.round(Sn.x - .5 * U); x <= Sn.x - .14 * U; x++) {
      if (label(x, y) !== 3) continue;
      const d = (luma(x - 3, y) + luma(x + 3, y)) / 2 - luma(x, y);
      if (d > score) { score = d; best = { x, y }; }
    }
    return score > 6 ? best : fallback;
  }

  return { facing: facingRight ? "right" : "left", points, warnings, contour: contour.filter((_, i) => i % 3 === 0).map(toNorm) };
}
