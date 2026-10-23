import type { RatingGender } from "./ideals";

export type PillarKey = "harmony" | "angularity" | "dimorphism" | "features";
export interface Term { feature: string; sign: 1 | -1; weight: number }
export interface AssessmentDef {
  key: string;
  pillar: Exclude<PillarKey, "harmony">;
  label: string;
  /** What a high score means, and what a low score means. */
  high: string;
  low: string;
  terms: readonly Term[];
  weight: number;
  /** Dimorphism items are masculinity indices; a feminine target reverses them. */
  dimorphic?: boolean;
}
const T = (feature: string, sign: 1 | -1, weight = 1): Term => ({ feature, sign, weight });
const A = (pillar: AssessmentDef["pillar"], key: string, label: string, high: string, low: string, terms: Term[], weight = 1, dimorphic = false): AssessmentDef => ({ key: `${pillar}.${key}`, pillar, label, high, low, terms, weight, dimorphic });

/**
 * Assessments from geometry and in-photo comparisons. Feature keys are harmony
 * measurement keys (front.* / side.*) or image features (img.*). Each feature is
 * standardised against the reference population before it is combined.
 */
export const ASSESSMENTS: readonly AssessmentDef[] = [
  // Angularity: soft → defined.
  A("angularity", "cheekbones", "Cheekbone prominence", "Prominent, high cheekbones", "Flat or low cheekbones", [T("front.cheekbone-height", 1), T("img.submalarShadow", 1), T("front.bigonial-width", -1, .5), T("img.lowerFaceWidth", -1, .5)]),
  A("angularity", "jaw", "Jaw definition", "Sharp, defined jawline", "Soft, undefined jawline", [T("img.jawShadow", 1, 1.5), T("side.gonial-angle", -1), T("front.jaw-slope", -1, .75), T("front.jaw-frontal-angle", 1, .5)]),
  A("angularity", "cheeks", "Cheek leanness", "Lean cheeks with visible hollows", "Full, rounded cheeks", [T("img.lowerFaceWidth", -1, 1.5), T("img.submalarShadow", 1), T("front.face-width-to-height-ratio", -1, .5)]),
  A("angularity", "chin", "Chin definition", "Defined, projected chin", "Soft or recessed chin", [T("side.mentolabial-angle", -1), T("side.recession-relative-to-frankfort-plane", 1, .75), T("front.chin-to-philtrum-ratio", 1, .5)]),
  A("angularity", "submental", "Submental definition", "Sharp chin–neck angle", "Soft under-chin and neck", [T("side.submental-cervical-angle", -1, 1.5), T("img.jawShadow", 1, .5)]),
  // Dimorphism: masculinity indices.
  A("dimorphism", "jaw", "Jaw", "Broad, angular jaw", "Narrow, tapered jaw", [T("front.bigonial-width", 1), T("side.gonial-angle", -1, .75), T("front.lower-third", 1, .5), T("front.jaw-frontal-angle", 1, .5)], 1.25, true),
  A("dimorphism", "brow-ridge", "Brow ridge", "Prominent brow ridge", "Smooth brow", [T("side.brow-bossing-angle", 1), T("side.nasofrontal-angle", -1)], 1, true),
  A("dimorphism", "eyebrows", "Eyebrow thickness", "Thick, low, straight brows", "Fine, high, arched brows", [T("front.brow-thickness", 1), T("img.browContrast", 1), T("front.eyebrow-tilt", -1, .5), T("front.eyebrow-low-setedness", -1, .5)], 1, true),
  // Canthal tilt and cheekbone height are attractive in both sexes, so they are not counted as feminine.
  A("dimorphism", "eyes", "Eyes", "Narrower, deeper-set eyes", "Larger, more open eyes", [T("front.eye-aspect-ratio", 1), T("front.eyebrow-low-setedness", -1, .5)], 0.5, true),
  A("dimorphism", "face-shape", "Face shape", "Broad, robust face", "Tapered, delicate face", [T("front.face-width-to-height-ratio", 1), T("front.total-facial-width-to-height-ratio", -1, .5)], 1.25, true),
  A("dimorphism", "facial-hair", "Facial hair", "Visible beard or stubble", "Clear lower face", [T("img.facialHair", 1)], 0.75, true),
  A("dimorphism", "hair-length", "Hair length", "Short hair", "Long hair", [T("img.hairLength", -1)], 0.5, true),
  A("dimorphism", "hairline", "Hairline", "Squared or M-shaped hairline", "Rounded hairline", [T("img.templeRecession", 1)], 0.5, true),
  A("dimorphism", "lips", "Lips", "Thinner lips", "Fuller lips", [T("front.lip-thickness", -1), T("front.lower-lip-to-upper-lip-ratio", -1, .5)], 0.5, true),
  A("dimorphism", "nose", "Nose", "Larger, broader nose", "Smaller, narrower nose", [T("front.intercanthal-nasal-width-ratio", 1), T("front.nose-bridge-to-nose-width", 1, .5), T("side.nasal-projection", 1, .5)], 1, true),
  // Features: quality.
  A("features", "symmetry", "Facial symmetry", "Highly symmetrical", "Noticeable asymmetry", [T("img.asymmetry", -1)], 1.5),
  A("features", "skin", "Skin quality", "Smooth, clear skin", "Visible texture or blemishes", [T("img.skinTexture", -1), T("img.skinBlotch", -1, .5)], 1.5),
  A("features", "under-eyes", "Under-eye area", "Bright under-eyes", "Dark circles or shadowing", [T("img.underEye", 1)]),
  A("features", "sclera", "Sclera", "Bright, white sclera", "Dull or reddened sclera", [T("img.scleraBrightness", 1), T("img.scleraRedness", -1)], 0.75),
  A("features", "creasing", "Facial creasing", "Smooth, uncreased skin", "Visible lines and creases", [T("img.creasing", -1)]),
  A("features", "brows", "Brows & lashes", "Dense, defined brows", "Sparse or faint brows", [T("img.browContrast", 1), T("front.brow-thickness", 1, .5)], 0.75),
  A("features", "eyelids", "Upper eyelids", "Tidy, lightly exposed lids", "Heavy upper-lid exposure", [T("front.upper-eyelid-exposure", -1)], 0.75),
  A("features", "lips", "Lip quality", "Full, well-coloured lips", "Thin or pale lips", [T("img.lipContrast", 1), T("front.lip-thickness", 1, .5)], 0.75),
  A("features", "nose", "Nose shape", "Straight, centred nose", "Deviated or asymmetric nose", [T("img.noseAsymmetry", -1)], 0.75),
  A("features", "hair", "Hairline & hair", "Full hairline", "Receding temples", [T("img.templeRecession", -1)], 0.5),
];
export const PILLAR_P = 0.5;
export const OVERALL_P = 0.1;
export const PILLAR_LABELS: Record<PillarKey, { label: string; description: string }> = {
  harmony: { label: "Harmony", description: "How your proportions compare with ideal ranges across front and profile measurements." },
  angularity: { label: "Angularity", description: "Definition of the cheekbones, jaw, cheeks, chin and under-chin, from soft to sharp." },
  dimorphism: { label: "Dimorphism", description: "How masculine or feminine ten regions read, scored against your selected gender." },
  features: { label: "Features", description: "Quality of skin, eyes, brows, lips and symmetry, measured from your photo." },
};

/** Population constants produced by the calibration script. */
export interface Calibration {
  source: string;
  /** Pooled mean/SD of every assessment input feature. */
  features: Record<string, { mean: number; sd: number }>;
  /** Per-gender mean/SD of each assessment's combined value. */
  assessments: Record<string, Record<RatingGender, { mean: number; sd: number }>>;
  /** Per-gender mean/SD of each pillar's raw power mean (0–10). */
  pillars: Record<Exclude<PillarKey, "harmony">, Record<RatingGender, { mean: number; sd: number }>>;
  /** Per-gender mean/SD of ln(10.1 − raw harmony). */
  harmony: Record<"front" | "side" | "combined", Record<RatingGender, { mean: number; sd: number }>>;
}

/** Standardised, weighted combination of an assessment's available inputs. */
export function assessmentValue(def: AssessmentDef, inputs: Readonly<Record<string, number>>, calibration: Calibration): number | null {
  let total = 0, weight = 0;
  for (const t of def.terms) {
    const x = inputs[t.feature], stat = calibration.features[t.feature];
    if (x === undefined || !Number.isFinite(x) || !stat || !(stat.sd > 0)) continue;
    total += t.weight * t.sign * (x - stat.mean) / stat.sd; weight += t.weight;
  }
  // An assessment needs at least half of its evidence weight.
  const available = def.terms.reduce((s, t) => s + t.weight, 0);
  return weight >= available * .45 ? total / weight : null;
}
