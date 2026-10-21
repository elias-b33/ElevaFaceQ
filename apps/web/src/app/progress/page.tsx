"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { METRICS, analyzeHarmony } from "@freeharmony/engine";
import { deleteScan, loadScans, type StoredScan } from "@/lib/store";
import { HarmonyComparison } from "@/components/HarmonyComparison";
import { scanDocuments } from "@/lib/harmony";

export default function ProgressPage() {
  const [scans, setScans] = useState<StoredScan[]>([]);
  const [leftId, setLeftId] = useState("");
  const [rightId, setRightId] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { const saved = loadScans(); setScans(saved); setLeftId(saved[1]?.id ?? ""); setRightId(saved[0]?.id ?? ""); }, []);
  const left = scans.find(scan => scan.id === leftId);
  const right = scans.find(scan => scan.id === rightId);
  const scored = [...scans].reverse().filter(scan => scan.result.overall !== null);
  const date = (scan: StoredScan) => new Date(scan.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  return <main className="prose-local collection-page"><header><p className="eyebrow">THE STUDIO ARCHIVE</p><h1>Your private <em>collection.</em></h1><p className="page-subtitle">Explore the measurements behind a change, with both reports side by side.</p></header>
    {scored.length >= 2 && <section className="card"><p className="label-caps mb-4">Original FreeHarmony score over time</p><Sparkline values={scored.map(scan => scan.result.overall!)}/><p className="text-xs text-ink-3 mt-3">Photo conditions and landmark corrections can change the numbers. Compare similar photos.</p></section>}
    {scans.length >= 2 && <section className="card flex flex-col gap-4"><h2>Compare measurements</h2><div className="grid grid-cols-2 gap-3"><label className="text-xs text-ink-2 flex flex-col gap-2">Earlier / reference<select className="bg-surface-raised border border-line rounded-chip p-3 text-xs" value={leftId} onChange={event => setLeftId(event.target.value)}>{scans.map(scan => <option key={scan.id} value={scan.id}>{date(scan)}</option>)}</select></label><label className="text-xs text-ink-2 flex flex-col gap-2">Later / comparison<select className="bg-surface-raised border border-line rounded-chip p-3 text-xs" value={rightId} onChange={event => setRightId(event.target.value)}>{scans.map(scan => <option key={scan.id} value={scan.id}>{date(scan)}</option>)}</select></label></div>{left && right && <>{left.id === right.id && <p className="text-xs text-work">You selected the same analysis twice.</p>}{(left.result.sex !== right.result.sex || left.result.engineVersion !== right.result.engineVersion || left.result.bandProfile !== right.result.bandProfile) && <p className="text-xs text-work">The reference settings or engine version differ. Raw measurements are more useful here than score changes.</p>}<HarmonyComparison left={left} right={right}/><details className="legacy-comparison"><summary>Original FreeHarmony metrics & score</summary><div className="comparison-scroll"><table className="comparison-table"><thead><tr><th>Measurement</th><th>Reference</th><th>Comparison</th><th>Change</th></tr></thead><tbody><tr><td>Harmony score</td><td>{left.result.overall?.toFixed(1) ?? "—"}</td><td>{right.result.overall?.toFixed(1) ?? "—"}</td><td>{delta(left.result.overall, right.result.overall)}</td></tr>{METRICS.map(metric => { const a = left.result.metrics.find(item => item.key === metric.key); const b = right.result.metrics.find(item => item.key === metric.key); if (!a && !b) return null; const suffix = metric.unit === "deg" ? "°" : metric.unit === "pct" ? "%" : ""; return <tr key={metric.key}><td>{metric.label}</td><td>{a ? a.value.toFixed(2) + suffix : "—"}</td><td>{b ? b.value.toFixed(2) + suffix : "—"}</td><td>{delta(a?.value ?? null, b?.value ?? null, 2)}</td></tr>; })}</tbody></table></div></details></>}</section>}
    {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    {!scans.length ? <section className="card flex flex-col items-start gap-4"><h2>No analyses saved yet.</h2><p>Start with a clear front photo. You can add a side profile after reviewing your first report.</p><Link href="/scan" className="primary-button">Start your first analysis →</Link></section> : <section className="flex flex-col gap-3"><p className="label-caps">{scans.length} saved analyses</p>{scans.map(scan => <div key={scan.id} className="card history-dossier">{scan.photo && <img src={scan.photo} alt="Saved analysis thumbnail" className="history-photo"/>}<div className="flex-1 min-w-28"><Link href={`/results/${scan.id}`} className="text-sm text-ink">{date(scan)}</Link><p className="text-xs text-ink-2 mt-1">{scan.side ? "Front + side profile" : "Front analysis"} · {scan.result.sex}</p></div><ScanCoverage scan={scan}/><Link href={`/results/${scan.id}`} className="text-sm text-gold">Open →</Link>{confirmId === scan.id ? <div className="flex gap-3 text-xs"><button className="text-danger" onClick={() => { try { deleteScan(scan.id); setScans(loadScans()); setConfirmId(null); } catch { setError("This analysis could not be deleted."); } }}>Confirm delete</button><button onClick={() => setConfirmId(null)} className="text-ink-2">Cancel</button></div> : <button aria-label={`Delete analysis from ${date(scan)}`} onClick={() => setConfirmId(scan.id)} className="text-ink-3 hover:text-danger text-xs">Delete</button>}</div>)}</section>}
  </main>;
}
function delta(a: number | null, b: number | null, decimals = 1) { if (a === null || b === null) return "—"; const change = b - a; return `${change > 0 ? "+" : ""}${change.toFixed(decimals)}`; }
function Sparkline({ values }: { values: number[] }) {
  const min = Math.min(...values) - 2, max = Math.max(...values) + 2;
  const points = values.map((value, index) => `${(index / (values.length - 1)) * 600},${85 - ((value - min) / (max - min)) * 75}`);
  return <svg viewBox="-5 0 610 95" className="w-full" role="img" aria-label="Harmony score trend"><path d="M0 85H600" stroke="#98533d20"/><polyline points={points.join(" ")} fill="none" stroke="#98533d" strokeWidth="2" strokeLinejoin="round"/>{points.map((point, index) => { const [cx, cy] = point.split(","); return <circle key={index} cx={cx} cy={cy} r="3" fill="#98533d"/>; })}</svg>;
}

function ScanCoverage({ scan }: { scan: StoredScan }) {
  const settings = scanDocuments(scan);
  const count = analyzeHarmony("front", settings.front, settings).available + analyzeHarmony("side", settings.side, settings).available;
  return <div className="history-coverage"><strong>{count}<small>/71</small></strong><span>measured</span></div>;
}
