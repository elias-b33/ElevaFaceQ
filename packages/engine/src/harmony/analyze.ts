import { HARMONY_CATALOG, HARMONY_VERSION } from "./catalog";
import { FRONT_LANDMARKS, SIDE_LANDMARKS } from "./landmarks";
import { distance, intersection, midpoint, vector } from "./geometry";
import type { Construction, HarmonyMeasurement, HarmonyReport, HarmonySettings, HarmonyView, MeasurementDefinition, MeasurementDocument, NamedPoint, XY } from "./types";

const usable = (point: NamedPoint | undefined): point is NamedPoint => !!point && point.source !== "template" && (point.reviewed || (point.confidence ?? 1) >= .3) && Number.isFinite(point.x) && Number.isFinite(point.y) && point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1;

const levelingKeys = (view: HarmonyView, points: Record<string, XY>) => view === "side" ? ["porion", "orbitale"] : points.pupilL && points.pupilR ? ["pupilL", "pupilR"] : ["outerL", "outerR"];
function dependencies(def: MeasurementDefinition, doc: MeasurementDocument | undefined, levelKeys: string[], calibrated: boolean): string[] {
  return [...new Set([
    ...def.required.filter(key => !calibrated || !def.normalizationOnly?.includes(key)),
    ...levelKeys,
    ...(calibrated && doc?.calibration && def.unit === "distance" ? [doc.calibration.from, doc.calibration.to] : []),
  ])];
}
/** The same dependency list powers status, perturbations, the editor and exports. */
export function requiredMeasurementPoints(def: MeasurementDefinition, doc?: MeasurementDocument): string[] {
  if (doc) try {
    const geometry = prepareGeometry(def.view, doc);
    return dependencies(def, doc, geometry.levelKeys, geometry.context.mmPerUnit !== null);
  } catch { /* Keep the missing/invalid photo editable. */ }
  const points = Object.fromEntries(Object.entries(doc?.points ?? {}).filter(([, p]) => usable(p)));
  return dependencies(def, doc, levelingKeys(def.view, points), false);
}

/** All geometry uses equal image units, then levels to pupils or Frankfort.
 * A left-facing profile is reflected BEFORE rotation so signed results agree. */
export function prepareGeometry(view: HarmonyView, doc: MeasurementDocument) {
  if (!Number.isFinite(doc.aspect) || doc.aspect <= 0 || !Number.isFinite(doc.imageHeight) || doc.imageHeight <= 0) throw new Error("The image dimensions are invalid.");
  const original = Object.fromEntries(Object.entries(doc.points).filter(([, p]) => usable(p)).map(([key, p]) => [key, { x: p.x * doc.aspect, y: p.y }])) as Record<string, XY>;
  // The anatomical ear-to-eye baseline also determines facing in a partial
  // profile. Requiring a nose tip here would silently invert signed results
  // until that otherwise unrelated landmark had been placed.
  const facesLeft = original.porion && original.orbitale
    ? original.orbitale.x < original.porion.x
    : original.pronasale && (original.tragus ?? original.nasion) && original.pronasale.x < (original.tragus ?? original.nasion)!.x;
  const facing = view === "side" && facesLeft ? -1 : 1;
  const projected = Object.fromEntries(Object.entries(original).map(([key, p]) => [key, { x: p.x * facing, y: p.y }])) as Record<string, XY>;
  const levelKeys = levelingKeys(view, projected);
  const left = projected[levelKeys[0]!], right = projected[levelKeys[1]!];
  let radians = 0;
  if (left && right) {
    if (distance(left, right) < .015) throw new Error("The leveling landmarks are too close together. Place them on distinct anatomical features.");
    radians = Math.atan2(right.y - left.y, right.x - left.x);
    // Front coordinates use image-left/right labels. Only an upside-down
    // image or reversed point labels would make the baseline point backwards.
    if (view === "front" && Math.abs(radians) > Math.PI / 2) throw new Error("Left and right leveling points are reversed. Left means the left of the image.");
  }
  const cos = Math.cos(radians), sin = Math.sin(radians);
  const points: Record<string, XY> = Object.fromEntries(Object.entries(projected).map(([key, p]) => [key, { x: p.x * cos + p.y * sin, y: -p.x * sin + p.y * cos }]));
  const mid = (name: string, a: string, b: string) => { if (points[a] && points[b]) points[name] = midpoint(points[a]!, points[b]!); };
  const cross = (name: string, a: string, b: string, c: string, d: string) => {
    if ([a, b, c, d].every(k => points[k])) {
      try { points[name] = intersection(points[a]!, points[b]!, points[c]!, points[d]!); } catch { /* Only metrics depending on this construction are invalid. */ }
    }
  };
  mid("brow", "browInnerL", "browInnerR"); mid("pupil", "pupilL", "pupilR"); mid("cheek", "cheekL", "cheekR"); mid("bowPeak", "lipPeakL", "lipPeakR");
  for (const side of ["L", "R"]) {
    mid(`browInnerMid${side}`, `browInner${side}`, `browInnerTop${side}`);
    mid(`browArchMid${side}`, `browArch${side}`, `browPeak${side}`);
    cross(`jawIntersection${side}`, `cheek${side}`, `jawSide${side}`, `jaw${side}`, `chinBorder${side}`);
    if (points[`cheek${side}`] && points.mouthSeam) {
      points[`earRef${side}`] = { x: points[`cheek${side}`]!.x, y: points.mouthSeam.y };
      points[`earVertical${side}`] = { x: points[`cheek${side}`]!.x, y: points.mouthSeam.y - .1 };
    }
  }
  mid("sMid", "subnasale", "pronasale");
  cross("gonion", "earNotch", "gonionUpper", "gonionLower", "menton");
  if (points.pogonion) {
    points.chinVerticalTop = points.pogonion;
    points.chinVerticalBottom = { x: points.pogonion.x, y: points.pogonion.y + .1 };
    cross("chinVertical", "gonionLower", "menton", "chinVerticalTop", "chinVerticalBottom");
  }
  if (points.glabella) {
    points.browHorizontalEnd = { x: points.glabella.x + .1, y: points.glabella.y };
    cross("dorsumRoot", "nasion", "supratip", "glabella", "browHorizontalEnd");
  }
  if (points.nasion) points.nasionVertical = { x: points.nasion.x, y: points.nasion.y - .1 };
  for (const [line, top] of [["s", "sMid"], ["e", "pronasale"], ["burstone", "subnasale"], ["h", "upperLip"]]) {
    if (points[top!] && points.pogonion) for (const lip of ["upperLip", "lowerLip"]) if (points[lip]) {
      const a = points[top!]!, b = points.pogonion, p = points[lip]!, d = vector(a, b), length2 = d.x * d.x + d.y * d.y;
      if (length2 > 1e-12) {
        const t = ((p.x - a.x) * d.x + (p.y - a.y) * d.y) / length2;
        points[line === "h" ? "hFoot" : `${lip}-${line}-foot`] = { x: a.x + t * d.x, y: a.y + t * d.y };
      }
    }
  }
  const faceHeight = points.hairline && points.menton ? points.menton.y - points.hairline.y : 0;
  let mmPerUnit: number | null = null;
  const calibration = doc.calibration;
  if (calibration && usable(doc.points[calibration.from]) && usable(doc.points[calibration.to])) {
    const span = distance(points[calibration.from]!, points[calibration.to]!);
    if (span > .005 && Number.isFinite(calibration.millimeters) && calibration.millimeters > 0 && calibration.millimeters <= 1000) mmPerUnit = calibration.millimeters / span;
  }
  const context: Construction = { points, aspect: doc.aspect, mmPerUnit, faceHeight };
  const unproject = (p: XY): XY => ({ x: (p.x * cos - p.y * sin) * facing / doc.aspect, y: p.x * sin + p.y * cos });
  return { context, roll: left && right ? radians * 180 / Math.PI : null, unproject, levelKeys };
}

function calculate(def: MeasurementDefinition, doc: MeasurementDocument, calibrated: boolean): number {
  const { context } = prepareGeometry(def.view, doc);
  if (def.unit === "distance" && (context.mmPerUnit !== null) !== calibrated) throw new Error("The calibration becomes invalid after a small point movement.");
  const value = def.compute(context);
  if (!Number.isFinite(value) || Math.abs(value) > 100_000) throw new Error("The geometry is unstable. Check coincident points and nearly parallel tangents.");
  return value;
}

export function analyzeHarmony(view: HarmonyView, doc?: MeasurementDocument, settings?: Pick<HarmonySettings, "ranges" | "descriptiveOnly">, sensitivityKeys: readonly string[] = []): HarmonyReport {
  const definitions = HARMONY_CATALOG.filter(d => d.view === view);
  let geometry: ReturnType<typeof prepareGeometry> | undefined;
  let error: string | undefined;
  const warnings: string[] = [];
  if (doc?.automatic) warnings.push(...doc.automatic.warnings);
  if (doc) try { geometry = prepareGeometry(view, doc); } catch (e) { error = e instanceof Error ? e.message : "Invalid geometry."; warnings.push(error); }
  if (view === "front" && !geometry?.context.points.pupil) warnings.push("Place both pupil centers to level the front photo. A corner baseline is used when available.");
  if (view === "side") warnings.push(doc?.automatic ? "Automatic profile placement combines visible contour evidence with anatomical estimates. Check the ear opening, orbital reference and jaw tangents first." : "Position porion and orbitale first to establish the Frankfort reference. Automatic suggestions are available from the photo tools.");
  if (geometry?.roll !== null && geometry?.roll !== undefined && Math.abs(geometry.roll) > 15) warnings.push("The leveling rotation exceeds 15°. Check the reference points and consider a level retake.");
  const calibrated = geometry?.context.mmPerUnit !== null && geometry?.context.mmPerUnit !== undefined;
  if (doc?.calibration && !calibrated) warnings.push("The calibration endpoints or distance are invalid. Distance results use % of face height, and distance ranges are paused until the scale is repaired or removed.");
  const measurements = definitions.map((def): HarmonyMeasurement => {
    let reference = settings?.descriptiveOnly ? null : settings?.ranges && Object.hasOwn(settings.ranges, def.key) ? settings.ranges[def.key] ?? null : def.reference ?? null;
    // A saved mm range cannot be applied to a % FH fallback after scale failure.
    if (def.unit === "distance" && doc?.calibration && !calibrated) reference = null;
    if (reference && (!Number.isFinite(reference.lo) || !Number.isFinite(reference.hi) || reference.lo >= reference.hi)) {
      warnings.push(`The working range for ${def.label} is invalid and was not applied.`);
      reference = null;
    }
    const unit = def.unit === "distance" ? calibrated ? "mm" : "% FH" : def.unit === "deg" ? "°" : def.unit === "pct" ? "%" : "×";
    const required = geometry ? dependencies(def, doc, geometry.levelKeys, calibrated) : requiredMeasurementPoints(def, doc);
    const missing = required.filter(k => !usable(doc?.points[k]));
    const unreviewed = required.filter(k => usable(doc?.points[k]) && !doc!.points[k]!.reviewed);
    const base = { key: def.key, unit, required, missing, unreviewed, reference, position: null, sensitivity: null };
    if (!doc || missing.length) return { ...base, value: null, status: "missing" };
    if (error) return { ...base, value: null, status: "invalid", reason: error };
    try {
      const value = def.compute(geometry!.context);
      if (!Number.isFinite(value) || Math.abs(value) > 100_000) throw new Error("The geometry is unstable. Check nearly parallel tangents or coincident landmarks.");
      let lo = value, hi = value;
      let unstable = false;
      const sampleKeys = sensitivityKeys.includes(def.key) ? required : [];
      for (const key of sampleKeys) for (const axis of ["x", "y"] as const) for (const sign of [-1, 1]) {
        const p = doc.points[key]!;
        const step = 2 / (doc.imageHeight * (axis === "x" ? doc.aspect : 1));
        const moved = { ...p, [axis]: Math.min(1, Math.max(0, p[axis] + step * sign)) };
        try {
          const sample = calculate(def, { ...doc, points: { ...doc.points, [key]: moved } }, calibrated);
          lo = Math.min(lo, sample); hi = Math.max(hi, sample);
        } catch { unstable = true; }
      }
      return { ...base, value, status: unreviewed.length ? "provisional" : "reviewed", position: reference ? value < reference.lo ? "below" : value > reference.hi ? "above" : "within" : null, sensitivity: unstable || !sampleKeys.length ? null : { lo, hi, pixels: 2 }, reason: unstable ? "A small point movement makes this construction undefined. Check its landmarks." : undefined };
    } catch (e) { return { ...base, value: null, status: "invalid", reason: e instanceof Error ? e.message : "The construction is invalid." }; }
  });
  return { version: HARMONY_VERSION, view, measurements, total: definitions.length, available: measurements.filter(m => m.value !== null).length, reviewed: measurements.filter(m => m.status === "reviewed").length, inRange: measurements.filter(m => m.position === "within").length, compared: measurements.filter(m => m.position !== null).length, warnings, roll: geometry?.roll ?? null, calibrated };
}

export function measurementOverlay(def: MeasurementDefinition, doc: MeasurementDocument): Record<string, XY> {
  try {
    const { context, unproject } = prepareGeometry(def.view, doc);
    return Object.fromEntries(Object.entries(context.points).map(([key, p]) => [key, unproject(p)]));
  } catch { return Object.fromEntries(Object.entries(doc.points).filter(([, p]) => usable(p))); }
}
export function formatMeasurement(value: number | null, unit: string, digits = 2): string {
  if (value === null) return "—";
  return `${value.toFixed(unit === "°" || unit === "%" || unit === "% FH" ? 1 : digits)}${unit === "×" ? " ×" : unit === "mm" || unit === "% FH" ? " " + unit : unit}`;
}
export function describeMeasurement(def: MeasurementDefinition, result: HarmonyMeasurement): string {
  if (result.status === "missing") {
    const points = def.view === "front" ? FRONT_LANDMARKS : SIDE_LANDMARKS;
    return `Place ${result.missing.map(k => points.find(p => p.key === k)?.label.toLowerCase() ?? k).join(", ")} to calculate this measurement. Template dots are placeholders and are never used as measured anatomy.`;
  }
  if (result.status === "invalid") return result.reason ?? "Check the landmark construction.";
  const value = formatMeasurement(result.value, result.unit);
  const read = result.reference && result.position ? ` It is ${result.position === "within" ? "within" : result.position} the selected working range (${formatMeasurement(result.reference.lo, result.unit)}–${formatMeasurement(result.reference.hi, result.unit)}).` : " This is a descriptive measurement; no target range is applied.";
  return `This photo measures ${value}.${read} ${result.status === "provisional" ? "Some contributing points still need review." : "All contributing landmarks have been marked as reviewed."}`;
}
