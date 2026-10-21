"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { defaultProfileAnchors, type MeasurementDocument } from "@freeharmony/engine";
import { runScan, type ScanOutcome, downscaleToDataURL } from "@/lib/scan";
import { getScan, loadProfile, newScanId, saveScan } from "@/lib/store";
import { detectAutomatic } from "@/lib/automatic";
import { scanDocuments } from "@/lib/harmony";
import { AnatomyPlate } from "./AnatomyPlate";

export function PhotoCapture({ view, attach }: { view: "front" | "side"; attach?: string | null }) {
  const router = useRouter(), video = useRef<HTMLVideoElement>(null), stream = useRef<MediaStream | null>(null), timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const input = useRef<HTMLInputElement>(null), mounted = useRef(true);
  const [opening, setOpening] = useState(false);
  const [camera, setCamera] = useState(false), [count, setCount] = useState<number | null>(null), [busy, setBusy] = useState(false), [step, setStep] = useState("");
  const [error, setError] = useState(""), [dragging, setDragging] = useState(false);
  const [draft, setDraft] = useState<{ photo: string; aspect: number; doc: MeasurementDocument; outcome?: ScanOutcome } | null>(null);
  const side = view === "side";
  const stop = () => { stream.current?.getTracks().forEach(t => t.stop()); stream.current = null; };
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; stop(); if (timer.current) clearInterval(timer.current); }; }, []);
  const start = async () => {
    if (opening || busy) return;
    if (timer.current) clearInterval(timer.current); setCount(null);
    setOpening(true); setError(""); setDraft(null); stop(); setCamera(true);
    try {
      const next = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
      if (!mounted.current) { next.getTracks().forEach(t => t.stop()); return; }
      stream.current = next;
      if (video.current) { video.current.srcObject = next; await video.current.play(); }
    } catch { stop(); setCamera(false); setError("Camera access was blocked. Choose a JPEG, PNG or WebP photo instead."); }
    finally { if (mounted.current) setOpening(false); }
  };
  const analyze = async (canvas: HTMLCanvasElement) => {
    if (timer.current) clearInterval(timer.current); setCount(null);
    stop(); setCamera(false); setBusy(true); setError(""); setDraft(null); setStep("Reading your photograph");
    await new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r())));
    try {
      const outcome = side ? undefined : await runScan({ canvas, mirrored: false }, loadProfile().sex);
      if (outcome?.result.gates.blocking.some(g => g.code === "multiple-faces" || g.code === "no-face")) throw new Error(outcome.result.gates.blocking.map(g => `${g.message} ${g.retake}`).join(" "));
      const doc = await detectAutomatic({ view, canvas, mesh: outcome?.input?.landmarks, onProgress: setStep });
      if (!doc.automatic || doc.automatic.detected + doc.automatic.estimated < 8) throw new Error(doc.automatic?.warnings[0] ?? "A usable face could not be found. Try a clearer photo.");
      setDraft({ photo: outcome?.photo ?? downscaleToDataURL(canvas, 768), aspect: canvas.width / canvas.height, doc, outcome });
    } catch (e) { setError(e instanceof Error ? e.message : "The local model could not analyze this photo. Try again."); }
    finally { setBusy(false); }
  };
  const upload = async (file: File) => {
    if (busy || opening) return;
    if (timer.current) clearInterval(timer.current); setCount(null);
    setError("");
    try {
      if (file.size > 20_000_000) throw new Error("Choose an image smaller than 20 MB.");
      const bitmap = await createImageBitmap(file);
      if (bitmap.width * bitmap.height > 80_000_000) { bitmap.close(); throw new Error("Choose an image smaller than 80 megapixels."); }
      const canvas = document.createElement("canvas"), scale = Math.min(1, 2048 / Math.max(bitmap.width, bitmap.height));
      canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
      canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close();
      await analyze(canvas);
    } catch (e) { setError(e instanceof Error ? e.message : "This photo could not be opened. Try a JPEG or PNG."); }
  };
  const capture = () => {
    if (timer.current) clearInterval(timer.current);
    let n = 3; setCount(n);
    timer.current = setInterval(() => {
      n--; setCount(n); if (n > 0) return;
      clearInterval(timer.current); setCount(null);
      const v = video.current; if (!v?.videoWidth) { setError("The camera is still opening. Try again."); return; }
      const canvas = document.createElement("canvas"); canvas.width = v.videoWidth; canvas.height = v.videoHeight;
      canvas.getContext("2d")!.drawImage(v, 0, 0); void analyze(canvas);
    }, 1000);
  };
  const save = () => {
    if (!draft) return;
    try {
      if (side) {
        const scan = attach ? getScan(attach) : undefined;
        if (!scan) throw new Error("The front study is no longer in this browser.");
        const settings = scanDocuments(scan), ranges = { ...settings.ranges };
        for (const key of Object.keys(ranges)) if (key.startsWith("side.")) delete ranges[key];
        saveScan({ ...scan, side: { photo: draft.photo, anchors: defaultProfileAnchors(), results: [], at: Date.now(), imageAspect: draft.aspect }, measurements: { ...settings, side: draft.doc, ranges } });
        router.push(`/results/${scan.id}#side`);
      } else if (draft.outcome) {
        const id = newScanId(), { result, photo, input } = draft.outcome;
        saveScan({ id, createdAt: Date.now(), result, photo, input: input ?? undefined, imageAspect: draft.aspect, measurements: { version: 1, front: draft.doc } });
        router.push(`/results/${id}`);
      }
    } catch (e) { setError(e instanceof Error ? e.message : "Your study could not be saved."); }
  };
  if (side && !attach) return <main className="prose-local"><p className="eyebrow">THE SECOND VIEW</p><h1>Every profile needs a counterpart.</h1><p>Create your front study first. Your side report will sit alongside it in one personal dossier.</p><Link className="primary-button" href="/scan">Begin your front study →</Link></main>;
  const priorities = draft ? Object.values(draft.doc.points).filter(p => p.source === "template" || p.source === "estimated" || (p.confidence ?? 1) < .45).length : 0;
  return <main className="capture-page">
    <div className="capture-heading"><Link className="back-link" href={side ? `/results/${attach}` : "/"}>← {side ? "Your dossier" : "The studio"}</Link><p className="eyebrow">NEW STUDY / {side ? "02 — THE PROFILE" : "01 — EN FACE"}</p><h1>{side ? <>A different <em>perspective.</em></> : <>Your next <em>close-up.</em></>}</h1><p>{side ? "The silhouette tells the other half of the story." : "A considered look at what makes your face yours."} Automatic landmarks. A detailed report. Entirely on your device.</p><div className="capture-quick">{draft ? <button className="primary-button" onClick={save}>Open my {side ? "profile report" : "dossier"} ↗</button> : <><button className="primary-button" disabled={busy || opening} onClick={() => input.current?.click()}>Choose a photo ↗</button><button className="secondary-button" aria-label="Open camera from quick actions" disabled={busy || opening} onClick={() => void start()}>{opening ? "Opening…" : "Use camera"}</button></>}</div></div>
    <nav className="study-steps" aria-label="Study steps"><span aria-current={!draft ? "step" : undefined}><b>01</b> Your photograph</span><span aria-current={draft ? "step" : undefined}><b>02</b> Review the details</span><span><b>03</b> Your dossier</span></nav>
    <div className="capture-layout">
      <section className={`capture-stage ${dragging ? "is-dragging" : ""}`} onDragOver={e => { e.preventDefault(); if (!busy && !opening) setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f && !busy && !opening) void upload(f); }}>
        <div className="capture-stage-label"><span>{side ? "PLATE II" : "PLATE I"}</span><span>{draft ? "PHOTOGRAPH SELECTED" : "PRIVATE PHOTO STUDIO"}</span></div>
        <video ref={video} muted playsInline className={side ? "" : "camera-mirror"} style={{ display: camera ? "block" : "none" }}/>
        {!camera && (draft ? <img className="capture-preview" src={draft.photo} alt={`Your selected ${view} photograph`}/> : <div className="capture-art"><AnatomyPlate view={view}/><span>{side ? "A true 90° profile" : "Face the lens. Find your light."}</span></div>)}
        {count !== null && <span className="capture-count">{count}</span>}
        {busy && <div className="detection-progress" role="status" aria-live="polite"><span className="detect-spinner"/><strong>{step}</strong><p>Your photo is being processed on this device.</p></div>}
        <div className="capture-stage-foot"><span>{side ? "LEFT OR RIGHT FACING" : "NEUTRAL EXPRESSION"}</span><span>LOCAL VISION / 01</span></div>
      </section>
      <section className="capture-copy">
        <span className="folio">{draft ? "YOUR LANDMARK DRAFT" : "A NOTE ON COMPOSITION"}</span>
        <h2>{draft ? "Your study is ready." : <>Good light.<br/>A natural presence.</>}</h2>
        {draft ? <><p>We suggested <b>{draft.doc.automatic!.detected + draft.doc.automatic!.estimated}</b> of {Object.keys(draft.doc.points).length} landmarks. Open your dossier to explore the measurements and fine-tune the points.</p><div className="detection-counts"><div><strong>{draft.doc.automatic!.detected}</strong><span>mesh & contour</span></div><div><strong>{draft.doc.automatic!.estimated}</strong><span>inferred positions</span></div><div><strong>{priorities}</strong><span>priority checks</span></div></div>{!draft.outcome?.result.ok && draft.outcome && <p className="capture-quality-note">Photo checks: {draft.outcome.result.gates.blocking.map(g => g.message).join(" ")} Your geometry draft is available; a score needs a photo that passes the checks.</p>}<button className="primary-button" onClick={save}>Open my {side ? "profile report" : "dossier"} <span>↗</span></button><button className="text-button" onClick={() => input.current?.click()}>Choose another photograph ↗</button></> : <><ol className="capture-notes"><li><span>01</span><p><b>{side ? "Turn fully sideways." : "Look straight ahead."}</b>{side ? " One eye, the near ear and the full neck in view. Move hair away from the silhouette." : " Eyes level, lips relaxed. Keep your forehead, ears and jaw visible."}</p></li><li><span>02</span><p><b>Give the camera some distance.</b> Step back, use eye-level framing and crop. Soft window light works well.</p></li><li><span>03</span><p><b>Let the local models do the work.</b> Review highlighted estimates after detection. You can adjust every point.</p></li></ol><div className="capture-actions"><button className="primary-button" disabled={busy || opening} onClick={() => input.current?.click()}>Choose a {side ? "side" : "front"} photo <span>↗</span></button><button className="secondary-button" disabled={busy || opening} onClick={() => void start()}>{opening ? "Opening camera…" : camera ? "Restart camera" : "Use camera"}</button>{camera && <button className="primary-button" disabled={busy || opening || count !== null} onClick={capture}>Capture in 3 seconds</button>}</div><p className="upload-hint">Or drop a photograph onto the plate.<br/>JPEG, PNG or WebP · up to 20 MB</p></>}
        <input ref={input} className="sr-only" aria-label={`Choose a ${side ? "side" : "front"} photo file`} type="file" accept="image/jpeg,image/png,image/webp" disabled={busy || opening} onChange={e => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ""; }}/>
        {error && <p className="report-alert" role="alert">{error}</p>}
        <div className="capture-privacy"><span className="privacy-seal">F.</span><p><strong>For your eyes only.</strong><span>No uploads. No account. No subscription.</span></p></div>
      </section>
    </div>
  </main>;
}
