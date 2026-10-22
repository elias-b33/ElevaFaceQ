import { z } from "zod";
import { METRICS, HARMONY_CATALOG, FRONT_LANDMARKS, SIDE_LANDMARKS } from "@freeharmony/engine";
import { loadProfile, loadScans, saveProfile, persistScans, PROFILE_KEY, SCANS_KEY, type Profile, type StoredScan } from "./store";

const finite = z.number().finite();
const text = z.string().max(10_000);
const photo = z.string().max(4_000_000).refine(value => value === "" || /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(value), "Photos must be embedded local images.");
const sex = z.enum(["masculine", "feminine", "neutral"]);
const point = z.object({ x: finite, y: finite });
const point3 = point.extend({ z: finite });
const band = z.object({ lo: finite, hi: finite, sLo: finite.optional(), sHi: finite.optional() });
const area = z.object({ score: finite.min(0).max(100).nullable(), confidence: finite.min(0).max(1) });
const verdict = z.enum(["ideal", "near-ideal", "needs-work"]);
const gate = z.object({ code: text, severity: z.enum(["block", "warn"]), message: text, retake: text });
const metricKeys = new Set<string>(METRICS.map(metric => metric.key));
const anchors = z.object({ glabella: point, nasion: point, pronasale: point, subnasale: point, labialeSup: point, labialeInf: point, pogonion: point, menton: point });
const namedKeys = new Set([...FRONT_LANDMARKS, ...SIDE_LANDMARKS].map(p => p.key));
const harmonyKeys = new Set(HARMONY_CATALOG.map(m => m.key));
const normalized = finite.min(0).max(1);
const namedPoint = z.object({ x: normalized, y: normalized, source: z.enum(["mesh", "contour", "estimated", "manual", "template"]), reviewed: z.boolean(), confidence: normalized.optional(), evidence: z.string().max(1000).optional() });
const namedKey = z.string().refine(k => namedKeys.has(k));
const measurementDocument = z.object({
  points: z.record(namedKey, namedPoint).refine(p => Object.keys(p).length <= 80),
  aspect: finite.positive().max(100), imageHeight: finite.positive().max(50000), updatedAt: finite.min(0),
  automatic: z.object({ engine: z.string().max(100), at: finite.min(0), detected: finite.int().min(0).max(80), estimated: finite.int().min(0).max(80), missing: finite.int().min(0).max(80), warnings: z.array(z.string().max(2000)).max(30), facing: z.enum(["left", "right"]).optional(), meshFound: z.boolean() }).optional(),
  calibration: z.object({ from: namedKey, to: namedKey, millimeters: finite.positive().max(1000) }).refine(c => c.from !== c.to).optional(),
});
const range = z.object({ lo: finite.min(-100000).max(100000), hi: finite.min(-100000).max(100000) }).refine(r => r.lo < r.hi);
const measurements = z.object({ version: z.literal(1), front: measurementDocument.optional(), side: measurementDocument.optional(), ranges: z.record(z.string().refine(k => harmonyKeys.has(k)), range.nullable()).optional(), descriptiveOnly: z.boolean().optional(), notes: z.string().max(5000).optional() });
const gateReport = z.object({ pass:z.boolean(), blocking:z.array(gate).max(100), warnings:z.array(gate).max(100), confidenceMultiplier:finite, regionConfidence:z.record(finite), jawEdgeSupport:finite.nullable() });
const frame = z.object({ pts:z.array(point3).min(468).max(478), scale:finite.positive(), rollDeg:finite, yawDeg:finite.nullable(), pitchDeg:finite.nullable(), poseSource:z.enum(['matrix','landmark-proxy']), yawAsym:finite, imageWidth:finite.positive(), imageHeight:finite.positive(), hasIris:z.boolean() });
const areas = z.object({symmetry:area,eyeArea:area,midface:area,jawline:area});
const metric = z.object({key:z.string().refine(key=>metricKeys.has(key)),label:text,value:finite,unit:text,band,score:finite.min(0).max(100),verdict,confidence:normalized,flags:z.array(text).max(100),percentile:finite.nullable(),detail:z.record(z.union([finite,z.array(finite)])).optional()});
const diagnostic = z.object({
  kind:z.literal('post-refusal-diagnostic'),provisional:z.literal(true),accepted:z.literal(false),
  provisionalOverall:finite.min(0).max(100).nullable(),areas,
  omittedAreas:z.array(z.enum(['symmetry','eyeArea','midface','jawline'])).max(4),
  gates:gateReport,metrics:z.array(metric.extend({percentile:z.null()})).max(30),frame,
  bandProfile:z.enum(['faceharmony-parity','literature','calibrated']),sex,engineVersion:text,
}).refine(d=>!d.gates.pass && d.gates.blocking.length>0,'A provisional diagnostic must retain its failed photo checks.');
const scan = z.object({
  id: z.string().regex(/^scan_[A-Za-z0-9_-]+$/).max(100), createdAt: finite.min(0), photo, imageAspect: finite.positive().max(100).optional(),
  result: z.object({
    ok: z.boolean(), overall: finite.min(0).max(100).nullable(),
    overallPercentile: finite.nullable(), standardized: finite.nullable(),
    tier: z.enum(["excellent", "good", "fair", "needs-work"]).nullable(),
    engineVersion: text, bandProfile: z.enum(["faceharmony-parity", "literature", "calibrated"]), sex,
    gates: z.object({ pass: z.boolean(), blocking: z.array(gate).max(100), warnings: z.array(gate).max(100), confidenceMultiplier: finite, regionConfidence: z.record(finite), jawEdgeSupport: finite.nullable() }),
    frame: z.object({ pts: z.array(point3).min(468).max(478), scale: finite.positive(), rollDeg: finite, yawDeg: finite.nullable(), pitchDeg: finite.nullable(), poseSource: z.enum(["matrix", "landmark-proxy"]), yawAsym: finite, imageWidth: finite.positive(), imageHeight: finite.positive(), hasIris: z.boolean() }).nullable(),
    areas: z.object({ symmetry: area, eyeArea: area, midface: area, jawline: area }),
    metrics: z.array(z.object({ key: z.string().refine(key => metricKeys.has(key)), label: text, value: finite, unit: text, band, score: finite.min(0).max(100), verdict, confidence: finite.min(0).max(1), flags: z.array(text).max(100), percentile: finite.nullable(), detail: z.record(z.union([finite, z.array(finite)])).optional() })).max(30),
  }),
  diagnostic:diagnostic.optional(),
  input: z.object({ landmarks: z.array(point3).min(468).max(478), imageWidth:finite.positive().optional(),imageHeight:finite.positive().optional(),mirrored: z.boolean(), blendshapes: z.record(finite).optional(), transformationMatrix: z.array(finite).length(16).optional() }).optional(),
  overrides: z.record(z.string().regex(/^\d{1,3}$/).refine(value => Number(value) < 478), point).optional(),
  measurements: measurements.optional(),
  side: z.object({ photo, anchors, at: finite, imageAspect: finite.positive().optional(), results: z.array(z.object({ key: z.enum(["nasofrontalAngle", "nasolabialAngle", "facialConvexity", "eLineUpper", "eLineLower"]), label: text, value: finite, unit: z.enum(["deg", "ratio"]), band, score: finite.min(0).max(100), verdict, meaning: text })).max(5) }).optional(),
});
const profile = z.object({
  onboarded: z.boolean(), sex, ageRange: text.optional(), goal: text.optional(),
  skinType: z.enum(["oily", "dry", "normal", "combination", "sensitive"]).optional(),
  skincare: z.array(text).max(30).optional(), diet: z.enum(["balanced", "high-protein", "plant-based", "not-great"]).optional(),
  sleep: z.enum(["<5", "6-8", "8+", "irregular"]).optional(), activity: z.enum(["sedentary", "light", "regular", "athlete"]).optional(),
  concerns: z.array(text).max(30).optional(), experience: z.enum(["beginner", "intermediate", "advanced"]).optional(), goals: z.array(text).max(30).optional(),
});
const schema = z.object({ format: z.literal("local-faceiq"), version: z.union([z.literal(1), z.literal(2), z.literal(3)]), exportedAt: z.string().datetime(), profile, scans: z.array(scan).max(40) });

export function createBackup(): string {
  // AI credentials and AI caches are intentionally excluded. The core geometry,
  // photos, profile, corrections and side measurements are self-contained.
  const data = { format: "local-faceiq", version: 3, exportedAt: new Date().toISOString(), profile: loadProfile(), scans: loadScans() };
  return JSON.stringify(schema.parse(data), null, 2);
}
export function restoreBackup(raw: string): number {
  if (raw.length > 20_000_000) throw new Error("This backup is too large (maximum 20 MB).");
  let checked: z.infer<typeof schema>;
  try { checked = schema.parse(JSON.parse(raw)); }
  catch { throw new Error("This is not a valid ElevaFace backup. No data was changed."); }
  const existing = loadScans();
  const known = new Set(existing.map(item => item.id));
  const additions = (checked.scans as StoredScan[]).filter(item => {
    if (known.has(item.id)) return false;
    known.add(item.id);
    return true;
  });
  const merged = [...existing, ...additions].sort((left, right) => right.createdAt - left.createdAt);
  if (merged.length > 40) throw new Error("Restoring would exceed 40 analyses. Export and remove older scans first.");
  const oldScans = localStorage.getItem(SCANS_KEY);
  const oldProfile = localStorage.getItem(PROFILE_KEY);
  try {
    persistScans(merged);
    if (!loadProfile().onboarded) saveProfile(checked.profile as Profile);
  } catch (error) {
    // localStorage writes are atomic per key. Restore the previous snapshot if
    // the second write fails; never silently discard photos to make room.
    if (oldScans === null) localStorage.removeItem(SCANS_KEY); else localStorage.setItem(SCANS_KEY, oldScans);
    if (oldProfile === null) localStorage.removeItem(PROFILE_KEY); else localStorage.setItem(PROFILE_KEY, oldProfile);
    throw error;
  }
  return additions.length;
}
export function downloadBackup(): void {
  const url = URL.createObjectURL(new Blob([createBackup()], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `elevaface-backup-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
