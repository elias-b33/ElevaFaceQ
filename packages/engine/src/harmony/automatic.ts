import { seedDocument } from "./landmarks";
import type { HarmonyView, MeasurementDocument, NamedPoint, XY } from "./types";

export interface SegmentationPlane { width: number; height: number; categories: Uint8Array }
export interface PixelPlane { width: number; height: number; data: Uint8Array | Uint8ClampedArray }
export interface AutomaticInput {
  view: HarmonyView;
  aspect: number;
  imageHeight: number;
  segmentation?: SegmentationPlane;
  pixels?: PixelPlane;
  mesh?: readonly (XY & { z?: number })[];
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
      const neckY = pt(152).y + h * .14;
      if (neckY < .98) {
        const row = Math.round(neckY * (seg.height - 1));
        const xs: number[] = [];
        for (let x = Math.max(0, Math.round((center - h / aspect * .35) * seg.width)); x < Math.min(seg.width, (center + h / aspect * .35) * seg.width); x++) if (seg.categories[row * seg.width + x] === 2) xs.push(x / (seg.width - 1));
        if (xs.length > seg.width * .04) { put("neckL", Math.min(...xs), neckY, "contour", .58, "Body-skin segmentation boundary just below the chin"); put("neckR", Math.max(...xs), neckY, "contour", .58, "Body-skin segmentation boundary at the same neck level"); }
      }
    } else warnings.push("Contour segmentation was unavailable. Mesh points are suggested; hairline, ear and neck points may need a quick review.");
    warnings.push("Hood, bridge and faint crease positions are estimates. Inspect these small features before relying on their ratios.");
    return finish(doc, warnings, true, input.at ?? 0);
  }
  if (!seg || !face) { warnings.push("No usable face-skin region was found for the profile. Use a clear side photograph with the face and neck visible."); return finish(doc, warnings, !!mesh?.length, input.at ?? 0); }
  const profileSeg = seg;
  const y0 = face.box.y0 / (seg.height - 1), y1 = face.box.y1 / (seg.height - 1), h = y1 - y0;
  const raw = sampler(seg, input, face);
  function prominence(forward: boolean) {
    const curve = (y: number) => { const x = raw.curve(y, forward); return forward ? x : -x; };
    let best = -Infinity;
    for (let y = y0 + h * .27; y < y0 + h * .67; y += 1 / profileSeg.height) {
      const x = curve(y), neighbors = [curve(Math.max(y0 + h * .1, y - h * .13)), curve(Math.min(y1, y + h * .17))];
      if (Number.isFinite(x) && neighbors.every(Number.isFinite)) best = Math.max(best, x - mean(neighbors));
    }
    return best;
  }
  let left = prominence(false) > prominence(true);
  if (mesh?.[4] && mesh[168] && Math.abs(mesh[4].x - mesh[168].x) * aspect > h * .05) left = mesh[4].x < mesh[168].x;
  const sample = sampler(seg, input, face, left), curve = sample.edgeCurve;
  const canonical = (p: XY) => ({ x: (left ? 1 - p.x : p.x) * aspect, y: p.y });
  const set = (key: string, u: number, y: number, source: NamedPoint["source"], quality: number, evidence: string) => put(key, left ? 1 - u / aspect : u / aspect, y, source, quality, evidence);
  function extremum(lo: number, hi: number, maximize: boolean) {
    let best = { x: NaN, y: NaN }, value = maximize ? -Infinity : Infinity;
    for (let y = clamp(lo, y0, y1); y <= Math.min(hi, y1); y += 1 / profileSeg.height) {
      const x = curve(y); if (!Number.isFinite(x)) continue;
      if (maximize ? x > value : x < value) { best = { x, y }; value = x; }
    }
    return best;
  }
  const meshAt = (i: number) => mesh?.[i] ? canonical(mesh[i]!) : undefined;
  const atHeight = (i: number, fallback: { x: number; y: number }) => {
    const p = meshAt(i); return p && p.y > y0 && p.y < y1 ? { x: curve(p.y), y: p.y } : fallback;
  };
  const meshTip = meshAt(4);
  const tip = extremum(meshTip ? meshTip.y - h * .045 : y0 + h * .42, meshTip ? meshTip.y + h * .045 : y0 + h * .7, true);
  if (!Number.isFinite(tip.x)) { warnings.push("The profile contour could not be traced. Retake against a plain contrasting background."); return finish(doc, warnings, !!mesh?.length, input.at ?? 0); }
  const root = atHeight(168, extremum(y0 + h * .3, tip.y - h * .065, false));
  const brow = atHeight(9, extremum(Math.max(y0 + h * .24, root.y - h * .15), root.y - h * .025, true));
  const upperAnchor = meshAt(0);
  const base = extremum(tip.y + h * .055, upperAnchor ? Math.min(upperAnchor.y, tip.y + h * .18) : tip.y + h * .18, false);
  const lipAt = (i: number, lo: number, hi: number) => { const p = meshAt(i); return p ? extremum(p.y - h * .02, p.y + h * .025, true) : extremum(lo, hi, true); };
  const upper = extremum(base.y + h * .02, base.y + h * .10, true);
  const lower = lipAt(17, upper.y + h * .045, upper.y + h * .13);
  const chin = extremum(Math.max(lower.y + h * .12, y0 + h * .82), y0 + h * .97, true);
  const fold = atHeight(18, extremum(lower.y + h * .035, chin.y - h * .025, false));
  const mentonY = y1 - h * .005;
  const menton = { x: curve(mentonY - h * .012), y: mentonY };
  for (const [key, p, quality] of [["pronasale", tip, .76], ["nasion", root, .53], ["glabella", brow, .53], ["subnasale", base, .57], ["upperLip", upper, .55], ["lowerLip", lower, .55], ["sublabiale", fold, .48], ["pogonion", chin, .61], ["menton", menton, .57]] as const) set(key, p.x, p.y, "contour", quality, "Extremum on the segmented visible profile contour; check the silhouette");
  set("forehead", curve(y0 + h * .1), y0 + h * .1, "contour", .55, "Upper visible forehead contour");
  set("hairline", curve(y0 + h * .012), y0 + h * .012, "estimated", .38, "Top of the visible face-skin mask; check the actual hairline");
  set("supratip", curve(tip.y - h * .055), tip.y - h * .055, "contour", .58, "Profile contour above the nasal tip");
  set("infratip", curve(tip.y + h * .025), tip.y + h * .025, "contour", .55, "Profile contour directly below the nasal tip");
  const colY = tip.y + (base.y - tip.y) * .55;
  set("columella", curve(colY), colY, "contour", .45, "Underside contour between the nasal tip and base");
  set("subalare", base.x - h * .065, base.y - h * .035, "estimated", .4, "Nasal-wing attachment estimated behind the nose base");
  const z = (indices: number[]) => mean(indices.map(i => mesh?.[i]?.z ?? 0));
  const near = z([33, 133, 159]) <= z([263, 362, 386]) ? "L" : "R";
  const eyeIndex = near === "L" ? { outer: 33, lower: 145, iris: [468, 469, 470, 471, 472], ear: 234 } : { outer: 263, lower: 374, iris: [473, 474, 475, 476, 477], ear: 454 };
  let eye = { x: root.x - h * .09, y: root.y - h * .035 };
  let eyeQuality = .33;
  if (mesh?.[eyeIndex.outer]) {
    const ring = eyeIndex.iris.map(i => mesh[i]).filter((p): p is NonNullable<typeof p> => !!p).map(canonical);
    if (ring.length) eye = ring.reduce((a, b) => a.x > b.x ? a : b);
    else eye = canonical(mesh[eyeIndex.outer]!);
    const corner = canonical(mesh[eyeIndex.outer]!), lid = canonical(mesh[eyeIndex.lower]!);
    set("lateralCanthus", corner.x, corner.y, "mesh", .65, "Near-side eye corner from the face mesh");
    set("lowerEyelid", lid.x, lid.y, "mesh", .62, "Near-side lower eyelid from the face mesh");
    eyeQuality = .58;
  } else {
    // Search for a local eye-region contrast feature, not skin-color thresholds.
    let best = 0;
    if (input.pixels) for (let y = root.y - h * .1; y < root.y + h * .025; y += 2 / input.imageHeight) for (let u = root.x - h * .22; u < root.x - h * .025; u += 2 / input.imageHeight) {
      if (sample.at(u, y) !== 3) continue;
      const contrast = mean([sample.gray(u - h * .02, y), sample.gray(u + h * .02, y), sample.gray(u, y - h * .02), sample.gray(u, y + h * .02)]) - sample.gray(u, y);
      if (contrast > best) { best = contrast; eye = { x: u, y }; }
    }
    eyeQuality = best > 18 ? .43 : .33;
    set("lateralCanthus", eye.x - h * .045, eye.y, "estimated", eyeQuality, "Eye-region contrast candidate; no profile eye landmark model was found");
    set("lowerEyelid", eye.x, eye.y + h * .025, "estimated", eyeQuality, "Lower-eye position inferred from the eye-region candidate");
  }
  set("cornea", eye.x + h * .012, eye.y, "estimated", eyeQuality, "Corneal-front estimate from the visible eye region; not a bony measurement");
  set("orbitale", eye.x - h * .015, eye.y + h * .055, "estimated", .35, "Soft-tissue orbital reference estimated below the eye; review for Frankfort leveling");
  let ear = { x: tip.x - h * .57, y: root.y + h * .11 };
  if (mesh?.[eyeIndex.ear]) { const p = canonical(mesh[eyeIndex.ear]!); if (p.x < root.x - h * .1) ear = { x: p.x - h * .02, y: eye.y + (base.y - eye.y) * .60 }; }
  // Ear opening is an internal anatomical reference; the segmentation model
  // cannot identify it. Keep this explicit instead of labelling a prior detected.
  set("tragus", ear.x, ear.y, "estimated", .34, "Preauricular geometric estimate; check the cartilage in front of the ear opening");
  set("porion", ear.x - h * .012, ear.y - h * .045, "estimated", .32, "Estimated ear-opening top; check before trusting Frankfort-oriented values");
  set("earNotch", ear.x + h * .005, ear.y - h * .012, "estimated", .34, "Estimated ear notch and upper jaw-side reference");
  set("mouthCorner", Math.min(upper.x, lower.x) - h * .09, (upper.y + lower.y) / 2, "estimated", .4, "Mouth corner inferred behind the visible lip silhouette");
  const jawX = Math.min(ear.x + h * .035, chin.x - h * .22);
  let jawY = menton.y - h * .13;
  const nativeX = left ? 1 - jawX / aspect : jawX / aspect;
  const col = clamp(Math.round(nativeX * (seg.width - 1)), 0, seg.width - 1);
  for (let y = Math.floor(base.y * seg.height); y < Math.min(seg.height, menton.y * seg.height); y++) if (face.members[y * seg.width + col]) jawY = y / (seg.height - 1);
  set("gonionUpper", jawX - h * .025, jawY - h * .13, "estimated", .38, "Ascending jaw tangent estimated from the preauricular region and lower face mask");
  set("gonionLower", jawX + h * .055, jawY + h * .025, "estimated", .4, "Lower jaw tangent estimated from the face-mask boundary; beard may hide it");
  const neckRows: { x: number; y: number }[] = [];
  for (let y = menton.y + h * .04; y < Math.min(.98, menton.y + h * .22); y += 1 / seg.height) {
    const bounds = sample.bounds(y, true); if (bounds && bounds[1] < chin.x - h * .04 && bounds[1] > jawX + h * .04) neckRows.push({ x: bounds[1], y });
  }
  if (neckRows.length >= 3) {
    const cervical = neckRows[Math.floor(neckRows.length * .3)]!, neck = neckRows[Math.floor(neckRows.length * .85)]!;
    set("cervical", cervical.x, cervical.y, "contour", .45, "Skin contour under the chin at the neck transition");
    set("neck", neck.x, neck.y, "contour", .53, "Lower front-neck skin boundary");
  } else warnings.push("The neck contour is cropped or obscured. Include the full chin and front of the neck for the neck angle.");
  warnings.push("Ear opening, orbital rim, jaw tangents and corneal front are anatomical estimates, not directly detected bone landmarks. Review the highlighted points.");
  if (!mesh?.length) warnings.push("This true profile used silhouette-assisted placement because the face mesh could not lock on. Eye and internal reference points need closer review.");
  return finish(doc, warnings, !!mesh?.length, input.at ?? 0, left ? "left" : "right");
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
