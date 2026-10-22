"use client";

import { useRef, useState } from "react";
import { measurementOverlay, requiredMeasurementPoints, type LandmarkDefinition, type MeasurementDefinition, type MeasurementDocument, type NamedPoint } from "@freeharmony/engine";

interface Props {
  photo?: string;
  doc: MeasurementDocument;
  definitions: readonly LandmarkDefinition[];
  metric: MeasurementDefinition;
  editing: boolean;
  active: string;
  onActive: (key: string) => void;
  onPoint: (key: string, point: NamedPoint) => void;
  onBegin: () => void;
}
export function LandmarkWorkspace({ photo, doc, definitions, metric, editing, active, onActive, onPoint, onBegin }: Props) {
  const [zoom, setZoom] = useState(1);
  const [showAll, setShowAll] = useState(false);
  const svg = useRef<SVGSVGElement>(null);
  const dragging = useRef<string | null>(null);
  const coords = measurementOverlay(metric, doc);
  const activeDef = definitions.find(p => p.key === active);
  const required = requiredMeasurementPoints(metric, doc);
  const pointKeys = new Set(editing ? showAll ? definitions.map(p => p.key) : [...required, active] : required);
  const W = 1000 * doc.aspect, H = 1000;
  const moveAt = (event: React.PointerEvent, key: string) => {
    const rect = svg.current!.getBoundingClientRect();
    onPoint(key, { x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)), y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)), source: "manual", reviewed: true });
  };
  return <div className="landmark-workspace">
    <div className="photo-toolbar"><span>{editing ? "PLACE & REVIEW" : "MEASUREMENT OVERLAY"}</span><div><button aria-label="Zoom out" disabled={zoom <= 1} onClick={() => setZoom(z => Math.max(1, z - .5))}>−</button><output aria-label="Photo zoom">{Math.round(zoom * 100)}%</output><button aria-label="Zoom in" disabled={zoom >= 3} onClick={() => setZoom(z => Math.min(3, z + .5))}>+</button></div></div>
    <div className="landmark-scroll" tabIndex={editing ? 0 : -1} aria-label={editing ? "Landmark editor. Arrow keys move the selected point. Hold Shift for larger steps." : "Photo with measurement overlay"} onKeyDown={event => {
      if (!editing || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
      event.preventDefault(); onBegin();
      const p = doc.points[active]; if (!p) return;
      const step = (event.shiftKey ? 5 : 1) / doc.imageHeight;
      onPoint(active, { ...p, x: Math.max(0, Math.min(1, p.x + (event.key === "ArrowLeft" ? -step / doc.aspect : event.key === "ArrowRight" ? step / doc.aspect : 0))), y: Math.max(0, Math.min(1, p.y + (event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0))), source: "manual", reviewed: true });
    }}>
      <div className="landmark-canvas" style={{ width: `${zoom * 100}%`, aspectRatio: doc.aspect }}>
        {photo ? <img src={photo} alt={`${metric.view === "front" ? "Front" : "Side"} photo with local measurement landmarks`} draggable={false}/> : <div className="photo-missing"><span>No photo in this analysis.</span><small>Geometry is shown on an empty canvas.</small></div>}
        <svg ref={svg} viewBox={`0 0 ${W} ${H}`} className={editing ? "is-editing" : ""} aria-label={`${metric.label} construction`} onPointerDown={event => {
          if (!editing) return;
          event.preventDefault();
          const key = (event.target as SVGElement).closest("[data-point]")?.getAttribute("data-point") ?? active;
          onBegin(); onActive(key); dragging.current = key;
          event.currentTarget.setPointerCapture(event.pointerId);
          moveAt(event, key);
        }} onPointerMove={event => { if (dragging.current) moveAt(event, dragging.current); }} onPointerUp={() => { dragging.current = null; }} onPointerCancel={() => { dragging.current = null; }}>
          <defs><filter id="point-shadow"><feDropShadow dx="0" dy="1" stdDeviation="2" floodColor="#000" floodOpacity=".9"/></filter></defs>
          {metric.lines.map((line, index) => { const pts = line.map(key => coords[key]); if (pts.some(p => !p)) return null; return <polyline key={index} points={pts.map(p => `${p!.x * W},${p!.y * H}`).join(" ")} fill="none" stroke={index % 2 ? "#efd1a4" : "#fff4dc"} strokeWidth={2} vectorEffect="non-scaling-stroke" strokeDasharray={index % 2 ? "6 4" : undefined} style={{ filter: "drop-shadow(0 1px 2px #000)" }}/>; })}
          {metric.view === "side" && coords.porion && coords.orbitale && <line x1={coords.porion.x * W} y1={coords.porion.y * H} x2={coords.orbitale.x * W} y2={coords.orbitale.y * H} stroke="#c4d6e4" strokeWidth="1.3" strokeDasharray="7 5" vectorEffect="non-scaling-stroke"/>}
          {definitions.filter(def => pointKeys.has(def.key)).map((def, index) => {
            const p = doc.points[def.key]; if (!p) return null;
            const isActive = editing && def.key === active, template = p.source === "template";
            const color = isActive ? "#fff" : template ? "#f5aa77" : p.reviewed ? "#c9e8ca" : p.source === "estimated" ? "#f1c176" : "#c4d6e4";
            return <g key={def.key} data-point={def.key} style={{ cursor: editing ? "crosshair" : "default" }}><title>{def.label} · {template ? "unplaced template" : p.reviewed ? "reviewed" : p.source === "estimated" ? "inferred position" : "image suggestion"}</title><circle cx={p.x * W} cy={p.y * H} r={isActive ? 13 : 7} fill={template ? "#08171566" : "#091b18"} stroke={color} strokeWidth={isActive ? 2.5 : 1.5} vectorEffect="non-scaling-stroke" strokeDasharray={template ? "3 2" : undefined}/><circle cx={p.x * W} cy={p.y * H} r="2" fill={color}/>{(isActive || (!editing && required.length < 7)) && <text x={p.x * W + 14} y={p.y * H - 12} fill={color} fontSize="18" style={{ filter: "url(#point-shadow)", pointerEvents: "none" }}>{isActive ? activeDef?.label : index + 1}</text>}{editing && <circle cx={p.x * W} cy={p.y * H} r="18" fill="transparent"/>}</g>;
          })}
        </svg>
      </div>
    </div>
    <div className="photo-legend"><span><i className="dot-reviewed"/> Reviewed</span><span><i className="dot-suggested"/> Suggested</span><span><i className="dot-estimated"/> Inferred</span><span><i className="dot-template"/> Unplaced</span>{editing && <label><input type="checkbox" checked={showAll} onChange={e => setShowAll(e.target.checked)}/> All points</label>}</div>
    {editing && <p className="editor-help">Select a landmark, then tap its position or drag its dot. Use zoom for fine placement. Arrow keys move 1 photo pixel; Shift moves 5.</p>}
  </div>;
}
