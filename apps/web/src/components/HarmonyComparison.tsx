"use client";

import { useMemo, useState } from "react";
import { analyzeHarmony, formatMeasurement, HARMONY_CATALOG } from "@freeharmony/engine";
import { scanDocuments } from "@/lib/harmony";
import type { StoredScan } from "@/lib/store";

export function HarmonyComparison({ left, right }: { left: StoredScan; right: StoredScan }) {
  const [view, setView] = useState("all");
  const [query, setQuery] = useState("");
  const pair = useMemo(() => [left, right].map(scan => { const settings = scanDocuments(scan); return [...analyzeHarmony("front", settings.front, settings).measurements, ...analyzeHarmony("side", settings.side, settings).measurements]; }), [left, right]);
  const definitions = HARMONY_CATALOG.filter(d => (view === "all" || view === d.view) && `${d.label} ${d.group}`.toLowerCase().includes(query.toLowerCase()));
  return <div className="extended-comparison"><h3>Complete geometry · 71 measurements</h3><p className="text-xs text-ink-2 mt-2">Values marked * rely on unreviewed landmarks. Changes reflect photo conditions and point placement as well as geometry. Different units cannot be subtracted.</p><div className="measurement-filters mt-4"><input type="search" aria-label="Search comparison measurements" placeholder="Search a measurement…" value={query} onChange={e => setQuery(e.target.value)}/><select aria-label="Comparison view" value={view} onChange={e => setView(e.target.value)}><option value="all">Front & side</option><option value="front">Front only</option><option value="side">Side only</option></select></div><div className="comparison-scroll" style={{ maxHeight: 620 }}><table className="comparison-table"><thead><tr><th>Measurement</th><th>Reference</th><th>Comparison</th><th>Raw change</th></tr></thead><tbody>{definitions.map(def => {
    const a = pair[0]!.find(r => r.key === def.key)!, b = pair[1]!.find(r => r.key === def.key)!;
    const comparable = a.value !== null && b.value !== null && a.unit === b.unit;
    const delta = comparable ? b.value! - a.value! : null;
    return <tr key={def.key}><td>{def.label}<small className="block text-[8px] text-ink-3 mt-1">{def.view} · {def.group}</small></td><td>{formatMeasurement(a.value, a.unit)}{a.status === "provisional" ? " *" : ""}</td><td>{formatMeasurement(b.value, b.unit)}{b.status === "provisional" ? " *" : ""}</td><td>{delta === null ? a.unit !== b.unit ? "Different scales" : "—" : `${delta > 0 ? "+" : ""}${delta.toFixed(2)} ${b.unit === "%" || b.unit === "% FH" ? "percentage points" : b.unit}`}</td></tr>;
  })}</tbody></table></div></div>;
}
