"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { defaultProfileAnchors, type ImageFeatures, type MeasurementDocument, type RatingGender } from "@freeharmony/engine";
import { downscaleToDataURL, runScan, type ScanOutcome } from "@/lib/scan";
import { detectAutomatic } from "@/lib/automatic";
import { measureAppeal, preloadAppeal } from "@/lib/appeal";
import { getScan, loadProfile, newScanId, saveProfile, saveScan } from "@/lib/store";
import { genderFromSex } from "@/lib/rating";
import { scanDocuments } from "@/lib/harmony";
import { LandmarkPreview, PhotoStage, usePhotoSource } from "./PhotoPicker";

type Step = "gender" | "front" | "side";
interface FrontDraft { photo: string; aspect: number; doc: MeasurementDocument; image: ImageFeatures | null; outcome: ScanOutcome; appeal: { version: string; raw: number } | null }
interface SideDraft { photo: string; aspect: number; doc: MeasurementDocument }
const paint = () => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
const placed = (doc: MeasurementDocument) => Object.values(doc.points).filter(p => p.source !== "template" && (p.confidence ?? 1) >= .3).length;
const STEPS: { key: Step | "rating"; label: string }[] = [{ key: "gender", label: "Gender" }, { key: "front", label: "Front photo" }, { key: "side", label: "Side profile" }, { key: "rating", label: "Your rating" }];

async function detectSide(canvas: HTMLCanvasElement, onProgress: (s: string) => void): Promise<SideDraft> {
  const { doc } = await detectAutomatic({ view: "side", canvas, onProgress });
  if (!doc.automatic || doc.automatic.detected < 8) throw new Error(doc.automatic?.warnings[0] ?? "The profile could not be traced. Use a true side view against a plain background.");
  return { photo: downscaleToDataURL(canvas, 768), aspect: canvas.width / canvas.height, doc };
}

export function NewAnalysis() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("gender");
  const [gender, setGender] = useState<RatingGender | null>(null);
  const [front, setFront] = useState<FrontDraft | null>(null);
  const [side, setSide] = useState<SideDraft | null>(null);
  const [busy, setBusy] = useState(false), [progress, setProgress] = useState(""), [error, setError] = useState("");
  useEffect(() => { const p = loadProfile(); setGender(p.gender ?? genderFromSex(p.sex) ?? null); preloadAppeal(); }, []);
  const view = step === "side" ? "side" : "front";
  const run = async (work: () => Promise<void>) => {
    setBusy(true); setError(""); setProgress("Reading your photograph");
    await paint();
    try { await work(); } catch (e) { setError(e instanceof Error && e.message ? e.message : "The local models could not analyse this photo. Try again."); }
    finally { setBusy(false); }
  };
  const analyzeFront = (canvas: HTMLCanvasElement) => run(async () => {
    const outcome = await runScan({ canvas, mirrored: false }, gender === "female" ? "feminine" : "masculine");
    const block = outcome.result.gates.blocking.find(g => g.code === "no-face" || g.code === "multiple-faces");
    if (block) throw new Error(`${block.message} ${block.retake}`);
    const { doc, image } = await detectAutomatic({ view: "front", canvas, mesh: outcome.input?.landmarks, onProgress: setProgress });
    if (!doc.automatic || doc.automatic.detected < 20) throw new Error(doc.automatic?.warnings[0] ?? "A usable face could not be found. Try a clearer photo.");
    setProgress("Scoring facial appeal");
    const appeal = outcome.input?.landmarks ? await measureAppeal(canvas, outcome.input.landmarks).catch(() => null) : null;
    setFront({ photo: outcome.photo, aspect: canvas.width / canvas.height, doc, image, outcome, appeal });
  });
  const analyzeSide = (canvas: HTMLCanvasElement) => run(async () => setSide(await detectSide(canvas, setProgress)));
  const source = usePhotoSource({ disabled: busy, onCanvas: canvas => void (view === "front" ? analyzeFront(canvas) : analyzeSide(canvas)) });
  const finish = (withSide: boolean) => {
    if (!front || !gender) return;
    try {
      const id = newScanId(), { result, diagnostic, photo, input } = front.outcome, now = Date.now();
      const profile = withSide && side ? side : null;
      saveScan({
        id, createdAt: now, result, diagnostic: diagnostic ?? undefined, photo, input: input ?? undefined, imageAspect: front.aspect,
        gender, imageFeatures: front.image ?? undefined, ...(front.appeal ? { appeal: front.appeal } : {}),
        measurements: { version: 1, front: front.doc, ...(profile ? { side: profile.doc } : {}) },
        ...(profile ? { side: { photo: profile.photo, anchors: defaultProfileAnchors(), results: [], at: now, imageAspect: profile.aspect } } : {}),
      });
      try { saveProfile({ ...loadProfile(), gender }); } catch { /* the rating itself is saved */ }
      router.push(`/results/${id}`);
    } catch (e) { setError(e instanceof Error ? e.message : "Your rating could not be saved in this browser."); }
  };
  const current = step === "gender" ? 0 : step === "front" ? 1 : 2;
  const draft = view === "front" ? front : side;
  const notes = view === "front" && front ? [...front.outcome.result.gates.blocking, ...front.outcome.result.gates.warnings].map(g => `${g.message} ${g.retake}`) : side && view === "side" ? side.doc.automatic?.warnings.filter(w => !w.startsWith("Ear opening")) ?? [] : [];

  return <main className="capture-page rating-flow">
    <div className="capture-heading"><Link className="back-link" href="/">← Home</Link><p className="eyebrow">STEP {current + 1} OF 3</p><h1>Rate your <em>face.</em></h1><p>Two photos, about a minute. Everything is analysed on this device and nothing is uploaded.</p></div>
    <nav className="study-steps" aria-label="Rating steps">{STEPS.map((s, i) => <button key={s.key} type="button" aria-current={i === current ? "step" : undefined} disabled={busy || i > current || s.key === "rating"} onClick={() => setStep(s.key as Step)}><b>{i + 1}</b> {s.label}</button>)}</nav>
    {step === "gender" ? <section className="gender-step">
      <div><span className="folio">GENDER</span><h2>Who is being rated?</h2><p>Ideal ranges and the dimorphism pillar differ between men and women. You can switch this later on your report.</p></div>
      <div className="gender-options" role="radiogroup" aria-label="Gender">{(["male", "female"] as const).map(g => <button key={g} type="button" role="radio" aria-checked={gender === g} className={gender === g ? "is-selected" : ""} onClick={() => setGender(g)}><span className="gender-mark">{g === "male" ? "M" : "F"}</span><strong>{g === "male" ? "Male" : "Female"}</strong><small>{g === "male" ? "Rated against male ideals" : "Rated against female ideals"}</small></button>)}</div>
      <button className="primary-button" disabled={!gender} onClick={() => setStep("front")}>Continue to your front photo <span>→</span></button>
    </section> : <div className="capture-layout">
      <PhotoStage source={source} view={view} busy={busy} step={progress} label={draft ? "Landmarks mapped" : "On-device"} mirrorPreview={view === "front"} preview={draft ? <LandmarkPreview photo={draft.photo} aspect={draft.aspect} doc={draft.doc} alt={`Your ${view} photo with detected landmarks`}/> : undefined}/>
      <section className="capture-copy">
        <span className="folio">{draft ? (view === "front" ? "FRONT PHOTO · DONE" : "SIDE PROFILE · DONE") : view === "front" ? "FRONT PHOTO" : "SIDE PROFILE"}</span>
        {draft ? <>
          <h2>{view === "front" ? <>Front <em>mapped.</em></> : <>Profile <em>mapped.</em></>}</h2>
          <div className="detection-counts"><div><strong>{placed(draft.doc)}</strong><span>landmarks placed</span></div><div><strong>{draft.doc.automatic?.estimated ?? 0}</strong><span>estimated points</span></div><div><strong>{view === "front" ? (front!.outcome.result.gates.blocking.length ? "Check" : "Pass") : side!.doc.automatic?.facing === "left" ? "Left" : "Right"}</strong><span>{view === "front" ? "photo checks" : "facing"}</span></div></div>
          {notes.length > 0 && <ul className="flow-notes">{notes.slice(0, 4).map(n => <li key={n}>{n}</li>)}</ul>}
          <p className="flow-hint">You can fine-tune every point later. Estimated points are drawn in amber.</p>
          {view === "front" ? <button className="primary-button" onClick={() => setStep("side")}>Continue to your side profile <span>→</span></button> : <button className="primary-button" onClick={() => finish(true)}>See my rating <span>→</span></button>}
          <button className="text-button" onClick={() => source.choose()}>Choose another photo</button>
        </> : <>
          <h2>{view === "front" ? <>Face the camera.<br/>Neutral and level.</> : <>Turn fully<br/>sideways.</>}</h2>
          <ol className="capture-notes">{(view === "front" ? [
            ["Straight ahead, eyes level.", " Relaxed, closed lips; no smile. Keep your forehead, hairline, ears and jaw visible."],
            ["Step back from the lens.", " About 1–2 m with the camera at eye level, then crop. Close-up selfies widen the nose and narrow the face."],
            ["Soft, even light.", " Face a window; avoid overhead or one-sided light, filters and glasses."],
          ] : [
            ["A true 90° profile.", " One eye visible, the near ear visible, chin level and neck uncovered."],
            ["Hair behind the ear.", " The forehead, nose, lips, chin and neck outline should meet a plain background."],
            ["Same distance and light", " as your front photo, camera at eye level."],
          ]).map(([b, t], i) => <li key={b}><span>{String(i + 1).padStart(2, "0")}</span><p><b>{b}</b>{t}</p></li>)}</ol>
          <div className="capture-actions"><button className="primary-button" disabled={busy || source.opening} onClick={() => source.choose()}>Choose a {view} photo <span>→</span></button>{source.camera ? <><button className="primary-button" disabled={busy || source.count !== null} onClick={source.capture}>Capture in 3 seconds</button><button className="secondary-button" onClick={source.cancelCamera}>Close camera</button></> : <button className="secondary-button" disabled={busy || source.opening} onClick={() => void source.startCamera()}>{source.opening ? "Opening camera…" : "Use camera"}</button>}</div>
          <p className="upload-hint">Or drag a photo onto the frame. JPEG, PNG or WebP, up to 20 MB.</p>
          {view === "side" && front && <button className="text-button" onClick={() => finish(false)}>Skip and rate my front photo only</button>}
        </>}
        {source.fileInput}
        {(error || source.error) && <p className="report-alert" role="alert">{error || source.error}</p>}
        <div className="capture-privacy"><span className="privacy-seal" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><rect x="5" y="10.5" width="14" height="10" rx="2.5" stroke="currentColor" strokeWidth="1.6"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" stroke="currentColor" strokeWidth="1.6"/></svg></span><p><strong>Private by design.</strong><span>Photos are analysed in your browser. No uploads, no account.</span></p></div>
      </section>
    </div>}
  </main>;
}

/** Add or replace the side profile of an existing rating. */
export function ProfileAttach({ id }: { id: string }) {
  const router = useRouter();
  const [draft, setDraft] = useState<SideDraft | null>(null);
  const [busy, setBusy] = useState(false), [progress, setProgress] = useState(""), [error, setError] = useState("");
  const source = usePhotoSource({ disabled: busy, onCanvas: canvas => void (async () => {
    setBusy(true); setError(""); await paint();
    try { setDraft(await detectSide(canvas, setProgress)); } catch (e) { setError(e instanceof Error ? e.message : "The profile could not be analysed."); }
    finally { setBusy(false); }
  })() });
  const save = () => {
    const scan = getScan(id);
    if (!scan || !draft) { setError("This rating is no longer in this browser."); return; }
    try {
      const settings = scanDocuments(scan), ranges = { ...settings.ranges };
      for (const key of Object.keys(ranges)) if (key.startsWith("side.")) delete ranges[key];
      saveScan({ ...scan, side: { photo: draft.photo, anchors: defaultProfileAnchors(), results: [], at: Date.now(), imageAspect: draft.aspect }, measurements: { ...settings, side: draft.doc, ranges } });
      router.push(`/results/${id}`);
    } catch (e) { setError(e instanceof Error ? e.message : "The profile could not be saved."); }
  };
  const notes = draft?.doc.automatic?.warnings.filter(w => !w.startsWith("Ear opening")) ?? [];
  return <main className="capture-page rating-flow">
    <div className="capture-heading"><Link className="back-link" href={`/results/${id}`}>← Your rating</Link><p className="eyebrow">SIDE PROFILE</p><h1>Add your <em>profile.</em></h1><p>The side profile completes Harmony and adds the chin, under-chin and brow-ridge assessments.</p></div>
    <div className="capture-layout">
      <PhotoStage source={source} view="side" busy={busy} step={progress} label={draft ? "Landmarks mapped" : "On-device"} mirrorPreview={false} preview={draft ? <LandmarkPreview photo={draft.photo} aspect={draft.aspect} doc={draft.doc} alt="Your side photo with detected landmarks"/> : undefined}/>
      <section className="capture-copy">
        <span className="folio">{draft ? "SIDE PROFILE · DONE" : "SIDE PROFILE"}</span>
        <h2>{draft ? <>Profile <em>mapped.</em></> : <>Turn fully<br/>sideways.</>}</h2>
        {draft ? <>{notes.length > 0 && <ul className="flow-notes">{notes.slice(0, 4).map(n => <li key={n}>{n}</li>)}</ul>}<button className="primary-button" onClick={save}>Update my rating <span>→</span></button><button className="text-button" onClick={() => source.choose()}>Choose another photo</button></>
          : <><p>One eye and the near ear visible, chin level, neck uncovered, against a plain background.</p><div className="capture-actions"><button className="primary-button" disabled={busy} onClick={() => source.choose()}>Choose a side photo <span>→</span></button>{source.camera ? <><button className="primary-button" disabled={busy || source.count !== null} onClick={source.capture}>Capture in 3 seconds</button><button className="secondary-button" onClick={source.cancelCamera}>Close camera</button></> : <button className="secondary-button" disabled={busy || source.opening} onClick={() => void source.startCamera()}>{source.opening ? "Opening camera…" : "Use camera"}</button>}</div></>}
        {source.fileInput}
        {(error || source.error) && <p className="report-alert" role="alert">{error || source.error}</p>}
      </section>
    </div>
  </main>;
}
