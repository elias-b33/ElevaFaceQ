/**
 * Ideal ranges, tolerances and weights for the scored harmony measurements.
 *
 * Ranges combine published aesthetic norms (facial thirds, Ricketts E-line,
 * Steiner S-line, Burstone and Holdaway lines, Legan convexity, nasolabial,
 * nasofrontal, nasomental, mentolabial, gonial and cervicomental angles) with
 * the sex-specific distribution of this app's own constructions measured on
 * the Face Research Lab London Set (DeBruine & Jones 2017, CC BY 4.0). Where
 * a construction differs from the literature definition, the range is
 * anchored to the population and nudged in the direction that is rated more
 * attractive for that sex. `sd` is the population's robust spread and sets
 * how quickly a score falls outside the range. Distances are % of face height.
 */
export type RatingGender = "male" | "female";
export interface IdealSpec {
  key: string;
  male: readonly [number, number];
  female: readonly [number, number];
  sd: number;
  weight: number;
  /** Short readings for a value below / above the ideal range. */
  low: string;
  high: string;
}
const I = (key: string, male: readonly [number, number], female: readonly [number, number], sd: number, weight: number, low: string, high: string): IdealSpec => ({ key, male, female, sd, weight, low, high });

export const IDEALS: readonly IdealSpec[] = [
  // Front · facial thirds and face shape
  I("front.top-third", [31.5, 35], [32, 35.5], 2.7, 1, "Short upper third", "Tall forehead"),
  I("front.middle-third", [28.5, 31], [29.5, 32], 1.8, 1, "Short middle third", "Long middle third"),
  I("front.lower-third", [35, 38.5], [33, 36], 2.9, 1.5, "Short lower third", "Long lower third"),
  I("front.face-width-to-height-ratio", [1.88, 2.08], [1.78, 1.95], 0.14, 1.5, "Narrow, long midface (low FWHR)", "Wide, short midface (high FWHR)"),
  I("front.total-facial-width-to-height-ratio", [1.33, 1.45], [1.33, 1.45], 0.08, 1, "Short, wide face", "Long, narrow face"),
  I("front.midface-ratio", [0.98, 1.06], [0.98, 1.06], 0.07, 2, "Long midface", "Short, compact midface"),
  I("front.bitemporal-width", [99.5, 102], [100, 102.5], 0.8, 0.5, "Narrow temples", "Wide temples"),
  I("front.cheekbone-height", [62, 75], [66, 80], 7.3, 1.5, "Low-set cheekbones", "Very high cheekbones"),
  // Front · eyes and brows
  I("front.eye-separation-ratio", [44.5, 47.5], [45, 48], 2.6, 1.5, "Close-set eyes", "Wide-set eyes"),
  I("front.eye-aspect-ratio", [2.8, 3.2], [2.6, 3.0], 0.27, 1, "Round, open eyes", "Narrow eyes"),
  I("front.one-eye-apart-test", [0.97, 1.07], [0.97, 1.07], 0.066, 1, "Eyes closer than one eye apart", "Eyes more than one eye apart"),
  I("front.lateral-canthal-tilt", [3, 7], [4, 8.5], 2.1, 2, "Neutral or negative canthal tilt", "Steep upward canthal tilt"),
  I("front.eyebrow-tilt", [9, 14], [13, 18], 2.4, 0.75, "Flat brows", "Steeply angled brows"),
  I("front.eyebrow-low-setedness", [0.85, 1.3], [1.05, 1.5], 0.32, 1, "Very low-set brows", "High-set brows"),
  I("front.brow-length-to-face-width-ratio", [0.645, 0.68], [0.645, 0.68], 0.016, 0.75, "Short brows", "Long brows"),
  // Front · nose
  I("front.nose-tip-position", [-1.05, -0.6], [-1.05, -0.6], 0.26, 0.3, "Raised nose underside", "Low nose underside"),
  I("front.intercanthal-nasal-width-ratio", [0.98, 1.1], [0.92, 1.03], 0.084, 1.5, "Narrow nose", "Wide nose"),
  I("front.nose-bridge-to-nose-width", [2.4, 2.75], [2.2, 2.5], 0.19, 0.5, "Wide nasal bridge", "Narrow nasal bridge"),
  I("front.ipsilateral-alar-angle", [88, 95], [88, 95], 4.5, 1, "Narrow eye–nose triangle", "Wide eye–nose triangle"),
  I("front.midface-jaw-angle-difference", [0, 8], [0, 8], 8.8, 1, "—", "Midface and jaw tapers don't match"),
  // Front · mouth and chin
  I("front.lower-lip-to-upper-lip-ratio", [1.4, 1.75], [1.5, 1.85], 0.175, 1, "Thin lower lip relative to upper", "Very full lower lip relative to upper"),
  I("front.cupid-s-bow-depth", [0.75, 0.95], [0.75, 0.95], 0.09, 0.5, "Shallow Cupid's bow", "Deep Cupid's bow"),
  I("front.mouth-width-to-nose-width-ratio", [1.4, 1.55], [1.42, 1.58], 0.077, 1, "Small mouth for the nose", "Wide mouth for the nose"),
  I("front.interpupillary-mouth-width-ratio", [0.75, 0.83], [0.75, 0.83], 0.048, 0.75, "Narrow mouth", "Wide mouth"),
  I("front.mouth-corner-position", [-0.4, 0.6], [-0.4, 0.6], 0.8, 0.75, "Downturned mouth corners", "Strongly upturned mouth corners"),
  I("front.chin-to-philtrum-ratio", [2.2, 2.7], [1.95, 2.35], 0.34, 1, "Short chin / long philtrum", "Long chin / short philtrum"),
  // Front · jaw, ears and neck
  I("front.jaw-frontal-angle", [82, 92], [80, 88], 7, 1, "Narrow, tapered jaw", "Square jaw outline"),
  I("front.jaw-slope", [141, 147], [143, 149], 3.9, 0.75, "Steep jaw slope", "Flat jaw slope"),
  I("front.bigonial-width", [80, 85], [74.5, 78.5], 2, 1.5, "Narrow jaw", "Wide jaw"),
  I("front.lower-third-proportion", [32, 35.5], [32, 35.5], 2.1, 1, "Short upper lip", "Long upper lip"),
  I("front.ear-protrusion-ratio", [0, 11], [0, 11], 2.5, 0.4, "—", "Protruding ears"),
  I("front.ear-protrusion-angle", [0, 15], [0, 15], 4.3, 0.4, "—", "Ears angled outward"),
  I("front.neck-width", [100, 115], [88, 100], 8.6, 0.5, "Slim neck", "Thick neck"),
  // Side · upper third and profile
  I("side.browridge-inclination-angle", [10, 18], [12, 20], 5.9, 0.75, "Upright brow ridge", "Sloping brow ridge"),
  I("side.nasofrontal-angle", [118, 132], [128, 145], 10.3, 1, "Deep, sharp nasal root", "Shallow nasal root"),
  I("side.upper-forehead-slope", [0, 8], [2, 10], 4.6, 0.5, "Flat upper forehead", "Sloping forehead"),
  I("side.facial-convexity-nasion", [162, 172], [162, 172], 5.5, 1.25, "Convex profile", "Flat or concave profile"),
  I("side.facial-convexity-glabella", [165, 174], [165, 174], 5.1, 1.5, "Convex profile", "Flat or concave profile"),
  I("side.total-facial-convexity", [134, 142], [134, 142], 5.5, 1, "Prominent nose and convex profile", "Flat profile"),
  I("side.facial-depth-to-height-ratio", [1.25, 1.4], [1.3, 1.45], 0.14, 0.5, "Shallow facial depth", "Deep facial depth"),
  I("side.orbital-vector", [-7, -4], [-7, -4], 1.4, 0.25, "Prominent eyes over the cheek", "Projected infraorbital rim"),
  I("side.interior-midface-projection-angle", [62, 72], [62, 72], 8.1, 0.25, "Flat midface", "Projected midface"),
  I("side.z-angle", [74, 82], [72, 80], 6.9, 1, "Protrusive lips or retruded chin", "Strong chin, flat lips"),
  I("side.anterior-facial-depth", [62, 72], [62, 72], 9.3, 0.25, "Shallow anterior face", "Deep anterior face"),
  // Side · nose
  I("side.nasal-projection", [0.5, 0.6], [0.5, 0.6], 0.11, 0.5, "Under-projected nose", "Over-projected nose"),
  I("side.nasal-tip-angle", [128, 140], [128, 140], 7.9, 0.5, "Pointed nasal tip", "Blunt nasal tip"),
  I("side.nose-tip-rotation-angle", [20, 30], [24, 34], 7.3, 0.75, "Drooping nasal tip", "Upturned nasal tip"),
  I("side.nasolabial-angle", [94, 108], [98, 115], 11.3, 1.25, "Acute nasolabial angle", "Obtuse nasolabial angle"),
  I("side.nasofacial-angle", [30, 36], [31, 37], 3.9, 1, "Flat nose in profile", "Projecting nose in profile"),
  I("side.nasomental-angle", [122, 132], [122, 132], 5.7, 1, "Nose or chin too prominent", "Flat nose–chin relationship"),
  I("side.nasal-w-to-h-ratio", [0.8, 1.0], [0.8, 1.0], 0.17, 0.25, "Short nasal reach", "Long nasal reach"),
  I("side.frankfort-tip-angle", [35, 43], [35, 43], 4.7, 0.5, "Low nasal tip direction", "High nasal tip direction"),
  // Side · lips (positive = behind the line, % of face height)
  I("side.lower-lip-s-line-position", [-0.5, 1.2], [-1, 0.8], 2.1, 0.75, "Lower lip ahead of the S-line", "Lower lip behind the S-line"),
  I("side.upper-lip-s-line-position", [-0.3, 1.2], [-0.6, 0.9], 1.4, 0.75, "Upper lip ahead of the S-line", "Upper lip behind the S-line"),
  I("side.lower-lip-e-line-position", [0.5, 2.5], [0, 2], 2.2, 1, "Lower lip ahead of the E-line", "Lower lip far behind the E-line"),
  I("side.upper-lip-e-line-position", [1.5, 3.5], [1, 3], 1.7, 1, "Upper lip ahead of the E-line", "Upper lip far behind the E-line"),
  I("side.lower-lip-burstone-line", [-1.8, -0.4], [-2.2, -0.8], 1.65, 0.75, "Protrusive lower lip", "Retruded lower lip"),
  I("side.upper-lip-burstone-line", [-2.4, -1.2], [-2.8, -1.5], 1, 0.75, "Protrusive upper lip", "Retruded upper lip"),
  I("side.holdaway-h-line", [-0.4, 1], [-0.8, 0.6], 1.4, 0.75, "Lower lip ahead of the H-line", "Lower lip behind the H-line"),
  I("side.mentolabial-angle", [118, 132], [122, 138], 12.1, 1, "Deep lip–chin fold", "Shallow lip–chin fold"),
  // Side · jaw and neck
  I("side.gonial-angle", [114, 126], [122, 134], 14.3, 2, "Very sharp jaw angle", "Obtuse, soft jaw angle"),
  I("side.mandibular-plane-angle", [14, 24], [17, 27], 11.2, 1, "Flat mandibular plane", "Steep mandibular plane"),
  I("side.ramus-to-mandible-ratio", [0.7, 1], [0.7, 1], 0.44, 0.5, "Short ramus", "Long ramus"),
  I("side.gonion-to-mouth-line", [0, 10], [0, 10], 8.4, 0.5, "High jaw angle", "Low jaw angle"),
  I("side.recession-relative-to-frankfort-plane", [-1.5, 3], [-3.5, 1], 4.1, 1, "Recessed chin", "Projecting chin"),
  I("side.submental-cervical-angle", [100, 118], [102, 122], 15.5, 1, "Very sharp under-chin angle", "Soft under-chin and neck angle"),
];
export const IDEALS_BY_KEY: ReadonlyMap<string, IdealSpec> = new Map(IDEALS.map(i => [i.key, i]));
export function idealRange(spec: IdealSpec, gender: RatingGender): readonly [number, number] {
  return gender === "male" ? spec.male : spec.female;
}
