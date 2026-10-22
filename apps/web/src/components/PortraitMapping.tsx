"use client";

import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { FaceLandmarker } from "@mediapipe/tasks-vision";
import { FRONT_LANDMARKS, SIDE_LANDMARKS, formatMeasurement, measurementOverlay, prepareGeometry, requiredMeasurementPoints, type MeasurementDefinition, type MeasurementDocument, type NamedPoint, type XY } from "@freeharmony/engine";
import { finitePoint, normalizedPoint, observedAnchor, observedFaceBounds, projectPortrait, type PhotoBounds } from "./portrait-mapping-geometry";
import "./portrait-mapping.css";

export interface PortraitMappingProps {
  photo: string;
  doc: MeasurementDocument;
  /** Normalized points in the supplied photograph's orientation, never leveled frame coordinates. */
  mesh?: readonly { x: number; y: number; z?: number }[];
  selected: MeasurementDefinition;
  value: number | null;
}

type Layer = "mesh" | "contours" | "anchors" | "measurements";
type Anchor = { key: string; label: string; point: NamedPoint };
const DURATION = 20;
const FULL_PHOTO: PhotoBounds = { x: 0, y: 0, width: 1, height: 1 };
const EMPTY_MESH: readonly XY[] = [];
const LAYERS: readonly { key: Layer; label: string }[] = [
  { key: "mesh", label: "Mesh" }, { key: "contours", label: "Contours" },
  { key: "anchors", label: "Landmarks" }, { key: "measurements", label: "Measurement" },
];
const CONTOURS = [FaceLandmarker.FACE_LANDMARKS_FACE_OVAL, FaceLandmarker.FACE_LANDMARKS_LEFT_EYEBROW,
  FaceLandmarker.FACE_LANDMARKS_RIGHT_EYEBROW, FaceLandmarker.FACE_LANDMARKS_LEFT_EYE,
  FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE, FaceLandmarker.FACE_LANDMARKS_LEFT_IRIS,
  FaceLandmarker.FACE_LANDMARKS_RIGHT_IRIS, FaceLandmarker.FACE_LANDMARKS_LIPS];
// Straight guides join adjacent observed contour anchors only; missing positions break the chain.
const SIDE_CONTOUR = ["glabella", "nasion", "supratip", "pronasale", "infratip", "columella", "subnasale", "upperLip", "lowerLip", "sublabiale", "pogonion", "menton", "cervical", "neck"];
const clamp = (n: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, n));
const phase = (time: number, start: number, end: number) => { const p = clamp((time - start) / (end - start)); return p * p * (3 - 2 * p); };
const timeText = (time: number) => `00:${Math.floor(time).toString().padStart(2, "0")}`;
const sourceLabel = (point: NamedPoint) => point.source === "manual" ? "Placed by you" : point.reviewed ? point.source === "estimated" ? "Reviewed position" : "Reviewed landmark" : point.source === "contour" ? "Image contour" : "Mesh prediction";

/** Read-only presentation. Editing and scoring remain in the surrounding workbench. */
export function PortraitMapping({ photo, doc, mesh = EMPTY_MESH, selected, value }: PortraitMappingProps) {
  const id = useId();
  const canvas = useRef<HTMLCanvasElement>(null);
  const clock = useRef(DURATION);
  const selectedBefore = useRef(selected.key);
  const [time, setTime] = useState(DURATION);
  const [playing, setPlaying] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [imageError, setImageError] = useState(false);
  const [size, setSize] = useState({ width: 1, height: 1, dpr: 1 });
  const [view, setView] = useState<"face" | "photo">("face");
  const [layers, setLayers] = useState<Record<Layer, boolean>>({ mesh: true, contours: true, anchors: true, measurements: true });
  const [inspected, setInspected] = useState<string | null>(null);
  const [hover, setHover] = useState<{ key: string; x: number; y: number } | null>(null);

  const anchors = useMemo<Anchor[]>(() => (selected.view === "front" ? FRONT_LANDMARKS : SIDE_LANDMARKS)
    .filter(def => observedAnchor(doc.points[def.key]))
    .map(def => ({ key: def.key, label: def.label, point: doc.points[def.key]! })), [doc, selected.view]);
  // Keep original indices: dropping one invalid point must not reconnect the mesh to different anatomy.
  const points = useMemo(() => [468, 478].includes(mesh.length) ? mesh : EMPTY_MESH, [mesh]);
  const validMesh = useMemo(() => points.filter(normalizedPoint), [points]);
  const crop = useMemo(() => {
    const oval = FaceLandmarker.FACE_LANDMARKS_FACE_OVAL.flatMap(edge => [points[edge.start], points[edge.end]]).filter(normalizedPoint);
    return observedFaceBounds(oval.length ? oval : anchors.map(anchor => anchor.point));
  }, [points, anchors]);
  const projection = useMemo(() => image ? projectPortrait(image.naturalWidth, image.naturalHeight, size.width, size.height, view === "face" && crop ? crop : FULL_PHOTO, view === "photo" ? 14 : 0) : null, [image, size, view, crop]);
  const aspectMismatch = !!image && (!Number.isFinite(doc.aspect) || Math.abs(doc.aspect - image.naturalWidth / image.naturalHeight) > .01 * image.naturalWidth / image.naturalHeight);
  const construction = useMemo(() => {
    const cleanDoc: MeasurementDocument = { ...doc, points: Object.fromEntries(Object.entries(doc.points).filter(([, point]) => observedAnchor(point))) };
    const required = requiredMeasurementPoints(selected, doc);
    let valid = value !== null && Number.isFinite(value) && required.every(key => observedAnchor(doc.points[key]));
    let unit = selected.unit === "deg" ? "°" : selected.unit === "pct" ? "%" : selected.unit === "ratio" ? "×" : "% FH";
    try {
      const geometry = prepareGeometry(selected.view, cleanDoc);
      if (selected.unit === "distance" && geometry.context.mmPerUnit !== null) unit = "mm";
    } catch { valid = false; }
    return { valid, required: new Set(required), points: valid ? measurementOverlay(selected, cleanDoc) : {}, unit };
  }, [doc, selected, value]);
  const canMeasure = construction.valid && !aspectMismatch;
  const caption = canMeasure ? `${selected.label} · ${formatMeasurement(value, construction.unit)}` : `${selected.label} · Awaiting reviewed landmarks`;
  const active = anchors.find(anchor => anchor.key === (hover?.key ?? inspected));
  const minY = validMesh.length ? Math.min(...validMesh.map(p => p.y)) : 0;
  const maxY = validMesh.length ? Math.max(...validMesh.map(p => p.y)) : 1;
  const cutoff = minY + (maxY - minY) * phase(time, 3, 7) + 1e-9;
  const visibleCount = time < 3 ? 0 : validMesh.length ? validMesh.filter(point => point.y <= cutoff).length : Math.floor(anchors.length * phase(time, 7, 11));
  const stage = time >= DURATION ? "Mapping complete" : time < 3 ? "01 / Framing the portrait" : time < 7 ? "02 / Revealing the mesh" : time < 11 ? "03 / Placing the landmarks" : "04 / Tracing the measurement";

  const seek = (next: number) => { clock.current = clamp(next, 0, DURATION); setTime(clock.current); };
  const replay = () => { seek(0); setHover(null); setInspected(null); setPlaying(true); };
  const togglePlaying = () => { if (time >= DURATION) replay(); else setPlaying(current => !current); };

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const change = () => { setReducedMotion(preference.matches); if (preference.matches) { clock.current = DURATION; setTime(DURATION); setPlaying(false); } };
    change(); preference.addEventListener("change", change);
    return () => preference.removeEventListener("change", change);
  }, []);

  useEffect(() => {
    let current = true;
    setImage(null); setImageError(false); setPlaying(false); setHover(null); setInspected(null);
    const portrait = new Image();
    portrait.onload = () => {
      if (!current) return;
      if (!portrait.naturalWidth || !portrait.naturalHeight) { setImageError(true); return; }
      setImage(portrait);
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      clock.current = reduce ? DURATION : 0; setTime(clock.current); setPlaying(!reduce);
    };
    portrait.onerror = () => { if (current) setImageError(true); };
    portrait.src = photo;
    return () => { current = false; portrait.onload = null; portrait.onerror = null; };
  }, [photo]);

  useEffect(() => {
    if (selectedBefore.current === selected.key) return;
    selectedBefore.current = selected.key;
    clock.current = DURATION; setTime(DURATION); setPlaying(false); setHover(null); setInspected(null);
    setLayers(current => ({ ...current, measurements: true }));
  }, [selected.key]);

  useEffect(() => {
    const node = canvas.current;
    if (!node) return;
    const resize = () => {
      const rect = node.getBoundingClientRect();
      setSize({ width: Math.max(1, rect.width), height: Math.max(1, rect.height), dpr: Math.min(window.devicePixelRatio || 1, 2) });
    };
    const observer = new ResizeObserver(resize); observer.observe(node); resize();
    window.addEventListener("resize", resize);
    return () => { observer.disconnect(); window.removeEventListener("resize", resize); };
  }, []);

  useEffect(() => {
    if (!playing || !image) return;
    let frame: number, previous: number | undefined;
    const tick = (now: number) => {
      const elapsed = previous === undefined || document.hidden ? 0 : Math.min((now - previous) / 1000, .1);
      previous = now; clock.current = Math.min(DURATION, clock.current + elapsed); setTime(clock.current);
      if (clock.current >= DURATION) { setPlaying(false); return; }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, image]);

  useEffect(() => {
    const node = canvas.current, context = node?.getContext("2d");
    if (!node || !context) return;
    const { width, height, dpr } = size;
    const pixelWidth = Math.round(width * dpr), pixelHeight = Math.round(height * dpr);
    if (node.width !== pixelWidth || node.height !== pixelHeight) { node.width = pixelWidth; node.height = pixelHeight; }
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, width, height); context.fillStyle = "#302e29"; context.fillRect(0, 0, width, height);
    context.fillStyle = "#e7d7bc12";
    for (let x = 12; x < width; x += 24) for (let y = 12; y < height; y += 24) { context.beginPath(); context.arc(x, y, .6, 0, Math.PI * 2); context.fill(); }
    if (!image || !projection) return;
    const { source, destination: frame, map } = projection;
    context.save(); context.beginPath(); context.rect(frame.x, frame.y, frame.width, frame.height); context.clip();
    context.drawImage(image, source.x, source.y, source.width, source.height, frame.x, frame.y, frame.width, frame.height);
    context.fillStyle = `rgba(31, 29, 24, ${.03 + .14 * phase(time, 3, 8)})`; context.fillRect(frame.x, frame.y, frame.width, frame.height);
    const shade = context.createLinearGradient(0, frame.y, 0, frame.y + frame.height);
    shade.addColorStop(0, "#241f1910"); shade.addColorStop(.65, "#241f1900"); shade.addColorStop(1, "#241f1970");
    context.fillStyle = shade; context.fillRect(frame.x, frame.y, frame.width, frame.height);
    if (layers.mesh && time > 3) {
      context.strokeStyle = "#f8edda47"; context.lineWidth = .55; context.beginPath();
      for (const edge of FaceLandmarker.FACE_LANDMARKS_TESSELATION) {
        const a = points[edge.start], b = points[edge.end];
        if (!normalizedPoint(a) || !normalizedPoint(b) || (a.y + b.y) / 2 > cutoff) continue;
        const p = map(a), q = map(b); context.moveTo(p.x, p.y); context.lineTo(q.x, q.y);
      }
      context.stroke(); context.fillStyle = "#fff5e380";
      for (const point of validMesh) { if (point.y > cutoff) continue; const p = map(point); context.beginPath(); context.arc(p.x, p.y, .8, 0, Math.PI * 2); context.fill(); }
    }
    if (layers.contours) {
      const reveal = phase(time, 6, 10);
      context.lineWidth = 1.25; context.strokeStyle = `rgba(225, 214, 173, ${reveal * .9})`;
      for (const edges of CONTOURS) {
        context.beginPath();
        for (const edge of edges.slice(0, Math.ceil(edges.length * reveal))) {
          const a = points[edge.start], b = points[edge.end]; if (!normalizedPoint(a) || !normalizedPoint(b)) continue;
          const p = map(a), q = map(b); context.moveTo(p.x, p.y); context.lineTo(q.x, q.y);
        }
        context.stroke();
      }
      if (!validMesh.length && selected.view === "side") {
        context.beginPath();
        for (let i = 1; i < Math.ceil(SIDE_CONTOUR.length * reveal); i++) {
          const a = doc.points[SIDE_CONTOUR[i - 1]!], b = doc.points[SIDE_CONTOUR[i]!];
          if (!observedAnchor(a) || !observedAnchor(b)) continue;
          const p = map(a), q = map(b); context.moveTo(p.x, p.y); context.lineTo(q.x, q.y);
        }
        context.stroke();
      }
    }
    if (layers.anchors) {
      const reveal = phase(time, 7, 11);
      anchors.forEach((anchor, index) => {
        const alpha = clamp(reveal * 1.7 - index / Math.max(1, anchors.length) * .7); if (!alpha) return;
        const p = map(anchor.point), focused = anchor.key === (hover?.key ?? inspected);
        context.save(); context.globalAlpha = alpha; context.lineWidth = 1;
        context.fillStyle = anchor.point.reviewed || anchor.point.source === "manual" ? "#cfdfbb" : "#f4dfb7";
        context.strokeStyle = "#302d25"; context.beginPath(); context.arc(p.x, p.y, focused ? 5 : construction.required.has(anchor.key) ? 3.1 : 2.2, 0, Math.PI * 2); context.fill(); context.stroke();
        if (focused) { context.strokeStyle = "#fff9e7"; context.beginPath(); context.arc(p.x, p.y, 9, 0, Math.PI * 2); context.stroke(); }
        context.restore();
      });
    }
    if (layers.measurements && canMeasure && time > 11) {
      context.save(); context.globalAlpha = phase(time, 11, 12); context.lineJoin = "round"; context.lineCap = "round";
      selected.lines.forEach((line, index) => {
        const coordinates = line.map(key => construction.points[key]);
        if (coordinates.length < 2 || !coordinates.every(finitePoint)) return;
        const mapped = coordinates.map(map); context.strokeStyle = index % 2 ? "#fff0cb" : "#efae82"; context.lineWidth = 1.8;
        context.setLineDash(index % 2 ? [5, 4] : []); context.beginPath();
        mapped.forEach((p, i) => i ? context.lineTo(p.x, p.y) : context.moveTo(p.x, p.y)); context.stroke(); context.setLineDash([]);
        for (const p of [mapped[0]!, mapped[mapped.length - 1]!]) { context.fillStyle = "#f5c59a"; context.beginPath(); context.arc(p.x, p.y, 3.2, 0, Math.PI * 2); context.fill(); }
      });
      context.restore();
    }
    if (time < 4 && crop) {
      const topLeft = map({ x: crop.x, y: crop.y }), bottomRight = map({ x: crop.x + crop.width, y: crop.y + crop.height });
      const scanY = topLeft.y + (bottomRight.y - topLeft.y) * phase(time, 0, 3);
      context.save(); context.globalAlpha = 1 - phase(time, 3, 4); context.strokeStyle = "#ecd4ae"; context.lineWidth = 1;
      context.beginPath(); context.moveTo(topLeft.x, scanY); context.lineTo(bottomRight.x, scanY); context.stroke();
      const beam = context.createLinearGradient(0, scanY - 30, 0, scanY); beam.addColorStop(0, "#ecd4ae00"); beam.addColorStop(1, "#ecd4ae2c");
      context.fillStyle = beam; context.fillRect(topLeft.x, scanY - 30, bottomRight.x - topLeft.x, 30); context.restore();
    }
    context.restore();
  }, [image, projection, size, time, layers, points, validMesh, cutoff, anchors, hover?.key, inspected, construction, selected, canMeasure, crop, doc]);

  const inspect = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!projection || !layers.anchors || time < 7) return;
    const rect = event.currentTarget.getBoundingClientRect(), x = event.clientX - rect.left, y = event.clientY - rect.top;
    let nearest: Anchor | undefined, distance = event.pointerType === "touch" ? 24 : 15;
    for (const anchor of anchors) {
      const point = projection.map(anchor.point), separation = Math.hypot(point.x - x, point.y - y);
      if (separation < distance) { nearest = anchor; distance = separation; }
    }
    setHover(nearest ? { key: nearest.key, x: clamp(x + 12, 8, Math.max(8, size.width - 230)), y: clamp(y - 58, 66, Math.max(66, size.height - 95)) } : null);
  };

  return <section className="portrait-mapping" aria-labelledby={`${id}-heading`}>
    <div className="pm-heading"><span id={`${id}-heading`}>THE PORTRAIT / {selected.view === "front" ? "FRONT VIEW" : "SIDE PROFILE"}</span><span aria-live="polite">{stage}</span></div>
    <div className="pm-stage">
      <canvas ref={canvas} tabIndex={0} role="img" aria-label={`${selected.view === "front" ? "Frontal" : "Profile"} photograph with ${validMesh.length} predicted mesh points, ${anchors.length} observed or reviewed landmarks, and ${selected.label} construction`} aria-describedby={`${id}-help`} onPointerMove={inspect} onPointerDown={inspect} onPointerLeave={() => setHover(null)} onKeyDown={event => {
        if (event.code === "Space" && image) { event.preventDefault(); togglePlaying(); }
        if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
          event.preventDefault(); setPlaying(false); seek(event.key === "Home" ? 0 : event.key === "End" ? DURATION : clock.current + (event.key === "ArrowLeft" ? -.5 : .5));
        }
      }}>Use the controls below to inspect the photograph's landmarks and selected measurement.</canvas>
      {!image && <div className="pm-load-state" role="status">{imageError ? "This photograph could not be opened." : "Opening the portrait…"}</div>}
      <div className="pm-stage-top"><span className="pm-source">{selected.view === "front" ? "01 / FRONTAL" : "02 / PROFILE"}</span><div className="pm-views" role="group" aria-label="Photo framing"><button type="button" aria-pressed={view === "face"} disabled={!crop} onClick={() => { setView("face"); setHover(null); }}>Face detail</button><button type="button" aria-pressed={view === "photo"} onClick={() => { setView("photo"); setHover(null); }}>Full photo</button></div></div>
      <div className="pm-counter" aria-hidden="true"><span>{visibleCount.toString().padStart(3, "0")}</span><small>{validMesh.length ? "MESH POINTS" : "PLACED LANDMARKS"}</small></div>
      <div className="pm-stage-caption"><span>{time > 11 ? caption : image ? `${image.naturalWidth} × ${image.naturalHeight} px · Original photo coordinates` : "LOCAL PORTRAIT STUDY"}</span></div>
      {hover && active && <div className="pm-tooltip" style={{ left: hover.x, top: hover.y }}><strong>{active.label}</strong><span>{sourceLabel(active.point)} · x {active.point.x.toFixed(3)} · y {active.point.y.toFixed(3)}</span></div>}
    </div>
    <div className="pm-transport">
      <button className="pm-play" type="button" disabled={!image} aria-label={playing ? "Pause mapping animation" : time >= DURATION ? "Replay mapping animation" : "Play mapping animation"} onClick={togglePlaying}>{playing ? <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7 4v12M13 4v12"/></svg> : <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m6 3 10 7-10 7Z"/></svg>}</button>
      <button className="pm-replay" type="button" disabled={!image} aria-label="Restart 20-second mapping animation" onClick={replay}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 7a6.5 6.5 0 1 1-.4 5M4 3v5h5"/></svg></button>
      <div className="pm-timeline"><input type="range" min="0" max={DURATION} step="0.1" value={time} disabled={!image} aria-label="Mapping animation position" aria-valuetext={`${time.toFixed(1)} of 20 seconds`} style={{ "--pm-progress": `${time / DURATION * 100}%` } as CSSProperties} onChange={event => { setPlaying(false); setHover(null); seek(Number(event.target.value)); }}/><div aria-hidden="true"><span>PORTRAIT</span><span>MESH</span><span>LANDMARKS</span><span>MEASUREMENT</span></div></div>
      <output className="pm-time" aria-label="Animation elapsed time">{timeText(time)}<span> / 00:20</span></output>
    </div>
    <div className="pm-layers" role="group" aria-label="Mapping layers"><span>LAYERS</span>{LAYERS.map(layer => <button type="button" key={layer.key} disabled={layer.key === "mesh" && !validMesh.length || layer.key === "contours" && !validMesh.length && selected.view !== "side"} aria-pressed={layers[layer.key]} onClick={() => { setLayers(current => ({ ...current, [layer.key]: !current[layer.key] })); if (layer.key === "anchors") { setHover(null); setInspected(null); } }}><i className={`pm-dot pm-dot-${layer.key}`} aria-hidden="true"/>{layer.label}</button>)}</div>
    <div className="pm-inspect"><label htmlFor={`${id}-anchor`}>Inspect a landmark</label><select id={`${id}-anchor`} value={inspected ?? ""} disabled={!anchors.length} onChange={event => { setInspected(event.target.value || null); setHover(null); setPlaying(false); seek(DURATION); setLayers(current => ({ ...current, anchors: true })); }}><option value="">{anchors.length ? `${anchors.length} observed / reviewed positions` : "No observed landmarks available"}</option>{anchors.map(anchor => <option value={anchor.key} key={anchor.key}>{anchor.label}</option>)}</select></div>
    {inspected && active && <p className="pm-anchor-detail" aria-live="polite">{active.label} · {sourceLabel(active.point)} · x {active.point.x.toFixed(3)}, y {active.point.y.toFixed(3)}</p>}
    {aspectMismatch ? <p className="pm-notice">The photo proportions differ from the measurement document. Review the source photo before displaying a measurement construction.</p> : !canMeasure && <p className="pm-notice">Place or review the required landmarks to reveal this measurement. Unplaced templates and unreviewed estimates are hidden.</p>}
    <p className="pm-note" id={`${id}-help`}>The animation reveals the saved mapping. Hover, tap or select a landmark to inspect it. On the portrait, Space plays or pauses; arrow keys move through time.{reducedMotion && " Reduced motion is on; playback starts only when requested."}</p>
  </section>;
}
