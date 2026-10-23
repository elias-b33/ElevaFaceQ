"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { MeasurementDocument } from "@freeharmony/engine";
import { AnatomyPlate } from "./AnatomyPlate";

/** Upload, drag-and-drop and camera capture, delivered as a canvas (long edge ≤ 2048). */
export function usePhotoSource({ onCanvas, disabled }: { onCanvas: (canvas: HTMLCanvasElement) => void; disabled: boolean }) {
  const video = useRef<HTMLVideoElement>(null), input = useRef<HTMLInputElement>(null), stream = useRef<MediaStream | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined), mounted = useRef(true);
  const [camera, setCamera] = useState(false), [opening, setOpening] = useState(false), [count, setCount] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false), [error, setError] = useState("");
  const stop = () => { stream.current?.getTracks().forEach(t => t.stop()); stream.current = null; };
  const clear = () => { if (timer.current) clearInterval(timer.current); timer.current = undefined; setCount(null); };
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; stop(); if (timer.current) clearInterval(timer.current); }; }, []);
  const deliver = (canvas: HTMLCanvasElement) => { clear(); stop(); setCamera(false); setError(""); onCanvas(canvas); };
  const file = async (f: File) => {
    if (disabled || opening) return;
    clear(); setError("");
    try {
      if (!/^image\/(jpeg|png|webp)$/.test(f.type)) throw new Error("Choose a JPEG, PNG or WebP photo.");
      if (f.size > 20_000_000) throw new Error("Choose an image smaller than 20 MB.");
      const bitmap = await createImageBitmap(f);
      if (bitmap.width * bitmap.height > 80_000_000) { bitmap.close(); throw new Error("Choose an image smaller than 80 megapixels."); }
      const canvas = document.createElement("canvas"), scale = Math.min(1, 2048 / Math.max(bitmap.width, bitmap.height));
      canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
      canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close();
      deliver(canvas);
    } catch (e) { setError(e instanceof Error && e.message ? e.message : "This photo could not be opened. Try a JPEG or PNG."); }
  };
  const startCamera = async () => {
    if (opening || disabled) return;
    clear(); setOpening(true); setError(""); stop(); setCamera(true);
    try {
      const next = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
      if (!mounted.current) { next.getTracks().forEach(t => t.stop()); return; }
      stream.current = next;
      if (video.current) { video.current.srcObject = next; await video.current.play(); }
    } catch { stop(); setCamera(false); setError("Camera access was blocked. Choose a photo instead."); }
    finally { if (mounted.current) setOpening(false); }
  };
  const capture = () => {
    clear();
    let n = 3; setCount(n);
    timer.current = setInterval(() => {
      n--; setCount(n); if (n > 0) return;
      clear();
      const v = video.current; if (!v?.videoWidth) { setError("The camera is still opening. Try again."); return; }
      const canvas = document.createElement("canvas"); canvas.width = v.videoWidth; canvas.height = v.videoHeight;
      // The live preview is mirrored for comfort; the capture keeps true pixels so left and right stay anatomical.
      canvas.getContext("2d")!.drawImage(v, 0, 0); deliver(canvas);
    }, 1000);
  };
  const cancelCamera = () => { clear(); stop(); setCamera(false); };
  const fileInput = <input ref={input} className="sr-only" aria-label="Choose a photo file" type="file" accept="image/jpeg,image/png,image/webp" disabled={disabled || opening} onChange={e => { const f = e.target.files?.[0]; if (f) void file(f); e.target.value = ""; }}/>;
  const drop = {
    onDragOver: (e: React.DragEvent) => { e.preventDefault(); if (!disabled && !opening) setDragging(true); },
    onDragLeave: () => setDragging(false),
    onDrop: (e: React.DragEvent) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f && !disabled && !opening) void file(f); },
  };
  return { video, camera, opening, count, dragging, error, setError, choose: () => input.current?.click(), startCamera, capture, cancelCamera, fileInput, drop };
}

/** The photo with its detected landmarks, preserving the original aspect. */
export function LandmarkPreview({ photo, aspect, doc, alt }: { photo: string; aspect: number; doc?: MeasurementDocument; alt: string }) {
  const w = 1000 * aspect;
  const points = Object.entries(doc?.points ?? {}).filter(([, p]) => p.source !== "template" && (p.reviewed || (p.confidence ?? 1) >= .3));
  return <div className="landmark-preview" style={{ aspectRatio: String(aspect) }}>
    <img src={photo} alt={alt}/>
    {points.length > 0 && <svg viewBox={`0 0 ${w} 1000`} aria-hidden="true">
      {points.map(([key, p], i) => <circle key={key} cx={p.x * w} cy={p.y * 1000} r={6} className={`preview-point is-${p.source}`} style={{ animationDelay: `${i * 18}ms` }}/>)}
    </svg>}
  </div>;
}

export function PhotoStage({ source, view, busy, step, preview, label, mirrorPreview }: {
  source: ReturnType<typeof usePhotoSource>; view: "front" | "side"; busy: boolean; step: string;
  preview?: ReactNode; label: string; mirrorPreview: boolean;
}) {
  return <section className={`capture-stage ${source.dragging ? "is-dragging" : ""}`} {...source.drop}>
    <div className="capture-stage-label"><span>{view === "front" ? "Front photo" : "Side profile"}</span><span>{label}</span></div>
    <video ref={source.video} muted playsInline className={mirrorPreview ? "camera-mirror" : ""} style={{ display: source.camera ? "block" : "none" }}/>
    {!source.camera && (preview ?? <div className="capture-art"><AnatomyPlate view={view}/><span>{view === "front" ? "Face the camera, straight on" : "Turn a full 90°"}</span></div>)}
    {source.count !== null && <span className="capture-count">{source.count}</span>}
    {busy && <div className="detection-progress" role="status" aria-live="polite"><span className="detect-spinner"/><strong>{step || "Analysing"}</strong><p>Your photo is processed on this device. Nothing is uploaded.</p></div>}
    <div className="capture-stage-foot"><span>{view === "front" ? "Neutral expression · eye level" : "Either direction · ear visible"}</span><span>Drop a photo here</span></div>
  </section>;
}
