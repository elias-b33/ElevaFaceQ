import type { RatingGender } from "./ideals";

export type PillarKey = "harmony" | "angularity" | "dimorphism" | "features";
export interface Term { feature: string; sign: 1 | -1; weight: number }
export interface AssessmentDef {
  key: string;
  pillar: Exclude<PillarKey, "harmony">;
  label: string;
  /** What a high, a middling and a low score mean. */
  high: string;
  mid: string;
  low: string;
  terms: readonly Term[];
  weight: number;
  /** Dimorphism items are masculinity indices; a feminine target reverses them. */
  dimorphic?: boolean;
  /** Scored for one gender only. */
  only?: RatingGender;
}
const T = (feature: string, sign: 1 | -1, weight = 1): Term => ({ feature, sign, weight });
const A = (pillar: AssessmentDef["pillar"], key: string, label: string, [high, mid, low]: readonly [string, string, string], terms: Term[], weight = 1, dimorphic = false, only?: RatingGender): AssessmentDef => ({ key: `${pillar}.${key}`, pillar, label, high, mid, low, terms, weight, dimorphic, ...(only ? { only } : {}) });

/**
 * Assessments from geometry and in-photo comparisons. Feature keys are harmony
 * measurement keys (front.* / side.*) or image features (img.*). Each feature is
 * standardised against the reference population before it is combined.
 */
export const ASSESSMENTS: readonly AssessmentDef[] = [
  // Angularity: soft → defined.
  A("angularity", "cheekbones", "Cheekbone prominence", ["Prominent, high cheekbones", "Moderate cheekbones", "Flat or low cheekbones"], [T("front.cheekbone-height", 1), T("img.submalarShadow", 1), T("front.bigonial-width", -1, .5), T("img.lowerFaceWidth", -1, .5)]),
  A("angularity", "jaw", "Jaw definition", ["Sharp, defined jawline", "Moderately defined jawline", "Soft, undefined jawline"], [T("img.jawShadow", 1, 1.5), T("side.gonial-angle", -1), T("front.jaw-slope", -1, .75), T("front.jaw-frontal-angle", 1, .5)]),
  A("angularity", "cheeks", "Cheek leanness", ["Lean cheeks with visible hollows", "Some cheek fullness", "Full, rounded cheeks"], [T("img.lowerFaceWidth", -1, 1.5), T("img.submalarShadow", 1), T("front.face-width-to-height-ratio", -1, .5)]),
  A("angularity", "chin", "Chin definition", ["Defined, projected chin", "Moderately defined chin", "Soft or recessed chin"], [T("side.mentolabial-angle", -1), T("side.recession-relative-to-frankfort-plane", 1, .75), T("front.chin-to-philtrum-ratio", 1, .5)]),
  A("angularity", "submental", "Submental definition", ["Sharp chin–neck angle", "Moderate chin–neck angle", "Soft under-chin and neck"], [T("side.submental-cervical-angle", -1, 1.5), T("img.jawShadow", 1, .5)]),
  // Dimorphism: masculinity indices.
  A("dimorphism", "jaw", "Jaw", ["Broad, angular jaw", "Average jaw width", "Narrow, tapered jaw"], [T("front.bigonial-width", 1), T("side.gonial-angle", -1, .75), T("front.lower-third", 1, .5), T("front.jaw-frontal-angle", 1, .5)], 1.25, true),
  A("dimorphism", "brow-ridge", "Brow ridge", ["Prominent brow ridge", "Moderate brow ridge", "Smooth brow"], [T("side.brow-bossing-angle", 1), T("side.nasofrontal-angle", -1)], 1, true),
  A("dimorphism", "eyebrows", "Eyebrow thickness", ["Thick, low, straight brows", "Medium brows", "Fine, high, arched brows"], [T("front.brow-thickness", 1), T("img.browContrast", 1), T("front.eyebrow-tilt", -1, .5), T("front.eyebrow-low-setedness", -1, .5)], 1, true),
  // Canthal tilt and cheekbone height are attractive in both sexes, so they are not counted as feminine.
  A("dimorphism", "eyes", "Eyes", ["Narrower, deeper-set eyes", "Average eye shape", "Larger, more open eyes"], [T("front.eye-aspect-ratio", 1), T("front.eyebrow-low-setedness", -1, .5)], 0.5, true),
  A("dimorphism", "face-shape", "Face shape", ["Broad, robust face", "Balanced face shape", "Tapered, delicate face"], [T("front.face-width-to-height-ratio", 1), T("front.total-facial-width-to-height-ratio", -1, .5)], 1.25, true),
  A("dimorphism", "facial-hair", "Facial hair", ["Visible beard or stubble", "Light stubble", "Clean-shaven or sparse"], [T("img.facialHair", 1)], 0.75, true, "male"),
  A("dimorphism", "hair-length", "Hair length", ["Short hair", "Medium-length hair", "Long hair"], [T("img.hairLength", -1)], 0.5, true),
  A("dimorphism", "hairline", "Hairline", ["Squared or M-shaped hairline", "Average hairline shape", "Rounded hairline"], [T("img.templeRecession", 1)], 0.5, true),
  A("dimorphism", "lips", "Lips", ["Thinner lips", "Medium lips", "Fuller lips"], [T("front.lip-thickness", -1), T("front.lower-lip-to-upper-lip-ratio", -1, .5)], 0.5, true),
  A("dimorphism", "nose", "Nose", ["Larger, broader nose", "Average nose size", "Smaller, narrower nose"], [T("front.intercanthal-nasal-width-ratio", 1), T("front.nose-bridge-to-nose-width", 1, .5), T("side.nasal-projection", 1, .5)], 1, true),
  // Features: quality.
  A("features", "symmetry", "Facial symmetry", ["Highly symmetrical", "Mostly symmetrical", "Noticeable asymmetry"], [T("img.asymmetry", -1)], 1.5),
  A("features", "skin", "Skin quality", ["Smooth, clear skin", "Some visible texture", "Visible texture or blemishes"], [T("img.skinTexture", -1), T("img.skinBlotch", -1, .5)], 1.5),
  A("features", "under-eyes", "Under-eye area", ["Bright under-eyes", "Mild under-eye shadowing", "Dark circles or shadowing"], [T("img.underEye", 1)]),
  A("features", "sclera", "Sclera", ["Bright, white sclera", "Typical sclera", "Dull or reddened sclera"], [T("img.scleraBrightness", 1), T("img.scleraRedness", -1)], 0.75),
  A("features", "creasing", "Facial creasing", ["Smooth, uncreased skin", "Some fine lines", "Visible lines and creases"], [T("img.creasing", -1)]),
  A("features", "brows", "Brows & lashes", ["Dense, defined brows", "Average brow density", "Sparse or faint brows"], [T("img.browContrast", 1), T("front.brow-thickness", 1, .5)], 0.75),
  A("features", "eyelids", "Upper eyelids", ["Tidy, lightly exposed lids", "Moderate upper-lid exposure", "Heavy upper-lid exposure"], [T("front.upper-eyelid-exposure", -1)], 0.75),
  A("features", "lips", "Lip quality", ["Full, well-coloured lips", "Average lip colour and fullness", "Thin or pale lips"], [T("img.lipContrast", 1), T("front.lip-thickness", 1, .5)], 0.75),
  A("features", "nose", "Nose shape", ["Straight, centred nose", "Mostly straight nose", "Deviated or asymmetric nose"], [T("img.noseAsymmetry", -1)], 0.75),
  A("features", "hair", "Hairline & hair", ["Full hairline", "Average hairline", "Receding temples"], [T("img.templeRecession", -1)], 0.5),
];
export const PILLAR_P = 0.5;
export const OVERALL_P = 0.1;
export const PILLAR_LABELS: Record<PillarKey, { label: string; description: string }> = {
  harmony: { label: "Harmony", description: "How your proportions compare with ideal ranges across front and profile measurements." },
  angularity: { label: "Angularity", description: "Definition of the cheekbones, jaw, cheeks, chin and under-chin, from soft to sharp." },
  dimorphism: { label: "Dimorphism", description: "How masculine or feminine your jaw, brow, eyes, nose, lips and hair read, scored against your selected gender." },
  features: { label: "Features", description: "Quality of skin, eyes, brows, lips and symmetry, measured from your photo." },
};

/** Population constants produced by the calibration script. */
export interface Calibration {
  source: string;
  /** Pooled mean/SD of every assessment input feature. */
  features: Record<string, { mean: number; sd: number }>;
  /** Per-gender mean/SD of each assessment's combined value (only for the genders it is scored for). */
  assessments: Record<string, Partial<Record<RatingGender, { mean: number; sd: number }>>>;
  /** Per-gender mean/SD of each pillar's raw power mean (0–10). */
  pillars: Record<Exclude<PillarKey, "harmony">, Record<RatingGender, { mean: number; sd: number }>>;
  /** Per-gender mean/SD of ln(10.1 − raw harmony). */
  harmony: Record<"front" | "side" | "combined", Record<RatingGender, { mean: number; sd: number }>>;
}

/** The assessments scored for a gender. */
export const assessmentsFor = (gender: RatingGender) => ASSESSMENTS.filter(d => !d.only || d.only === gender);
/**
 * Reading of an assessment score: the favourable description from 6 (top ~30%),
 * the unfavourable one below 4 (bottom ~30%), the middling one between.
 * Dimorphism descriptions are written as masculinity, so a feminine target swaps them.
 */
export function readingOf(def: AssessmentDef, score: number, gender: RatingGender): string {
  if (score >= 4 && score < 6) return def.mid;
  return (score >= 6) !== (!!def.dimorphic && gender === "female") ? def.high : def.low;
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
