import { analyzeHarmony, describeMeasurement, formatMeasurement, FRONT_LANDMARKS, HARMONY_CATALOG, HARMONY_VERSION, REFERENCE_NOTE, seedDocument, SIDE_LANDMARKS, type HarmonyReport, type HarmonySettings, type MeasurementDocument } from "@freeharmony/engine";
import type { StoredScan } from "./store";

/** Derive an editor document without silently rewriting or deleting old scans. */
export function scanDocuments(scan: StoredScan): HarmonySettings {
  const frontAspect = scan.imageAspect ?? (scan.result.frame ? scan.result.frame.imageWidth / scan.result.frame.imageHeight : 1);
  const front = scan.measurements?.front ?? seedDocument("front", frontAspect, scan.input?.landmarks, scan.overrides);
  let side: MeasurementDocument | undefined = scan.measurements?.side;
  if (!side && scan.side) {
    side = seedDocument("side", scan.side.imageAspect ?? 1);
    const mapping: Record<string, string> = { glabella: "glabella", nasion: "nasion", pronasale: "pronasale", subnasale: "subnasale", labialeSup: "upperLip", labialeInf: "lowerLip", pogonion: "pogonion", menton: "menton" };
    for (const [old, key] of Object.entries(mapping)) {
      const point = scan.side.anchors[old as keyof typeof scan.side.anchors];
      if (point) side.points[key] = { ...point, source: "manual", reviewed: false };
    }
  }
  return { ...scan.measurements, version: 1, front, side };
}
function download(content: string, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function downloadMeasurements(scan: StoredScan, settings: HarmonySettings, format: "csv" | "json") {
  const reports = [analyzeHarmony("front", settings.front, settings), analyzeHarmony("side", settings.side, settings)];
  const stem = `local-faceiq-${scan.id}`;
  if (format === "json") {
    download(JSON.stringify({ format: "local-faceiq-measurements", version: 1, engine: HARMONY_VERSION, createdAt: new Date(scan.createdAt).toISOString(), exportedAt: new Date().toISOString(), referenceNote: REFERENCE_NOTE, settings, reports }, null, 2), stem + ".json", "application/json"); return;
  }
  const csv = (v: unknown) => `"${String(v ?? "").replaceAll('"', '""')}"`;
  const rows = [["View", "Group", "Measurement", "Value", "Unit", "Status", "Range low", "Range high", "Range position", "Missing points", "Formula", "Definition source", "Local adaptation"]];
  for (const report of reports) for (const result of report.measurements) {
    const def = HARMONY_CATALOG.find(d => d.key === result.key)!;
    rows.push([report.view, def.group, def.label, result.value === null ? "" : String(result.value), result.unit, result.status, result.reference?.lo.toString() ?? "", result.reference?.hi.toString() ?? "", result.position ?? "", result.missing.join("; "), def.formula, def.source, def.adaptation ?? ""]);
  }
  download("\uFEFF" + rows.map(row => row.map(csv).join(",")).join("\r\n"), stem + ".csv", "text/csv;charset=utf-8");
}
export const escapeHtml = (s: string) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
export function reportMarkup(scan: StoredScan, settings: HarmonySettings, reports: HarmonyReport[]) {
  const e = escapeHtml;
  return `<header><p class="print-kicker">LOCAL FACEIQ / PERSONAL GEOMETRY REPORT</p><h1>Your front & profile report</h1><p>${e(new Date(scan.createdAt).toLocaleString())} · ${HARMONY_CATALOG.length} defined measurements · ${e(HARMONY_VERSION)}</p><p>All calculations run locally. A photograph is not a calibrated 3D or clinical assessment. Provisional measurements contain unreviewed points.</p></header>${settings.notes ? `<section><h2>Your notes</h2><p>${e(settings.notes)}</p></section>` : ""}${reports.map(report => `<section><h2>${report.view === "front" ? "Front view" : "Side profile"}</h2><p>${report.available}/${report.total} available · ${report.reviewed} fully reviewed · ${report.inRange}/${report.compared} within selected ranges · ${report.calibrated ? "User supplied scale; mm remain photographic estimates" : "Distances normalized as % of face height (% FH)"}</p>${(report.view === "front" ? scan.photo : scan.side?.photo) ? `<img class="print-photo" src="${e((report.view === "front" ? scan.photo : scan.side!.photo))}" alt="${report.view} analysis photo"/>` : ""}<p>${report.warnings.map(e).join(" ")}</p>${report.measurements.map(result => { const def = HARMONY_CATALOG.find(d => d.key === result.key)!; const landmarks = report.view === "front" ? FRONT_LANDMARKS : SIDE_LANDMARKS; return `<article><div class="print-metric-heading"><h3>${e(def.label)}</h3><strong>${e(formatMeasurement(result.value, result.unit))}</strong></div><p><small>${e(def.group)} · ${e(result.status)}${def.supporting ? " · supporting measurement" : ""}</small></p><p>${e(describeMeasurement(def, result))} ${e(def.explanation)}</p><p><b>Formula:</b> ${e(def.formula)}</p><p><b>Landmarks:</b> ${e(def.required.map(k => landmarks.find(p => p.key === k)?.label ?? k).join(", "))}</p>${def.adaptation ? `<p><b>Local construction:</b> ${e(def.adaptation)}</p>` : ""}<p><b>Photo sensitivity:</b> ${e(def.caution)}</p><p><a href="${e(def.source)}">Public definition reference</a></p></article>`; }).join("")}</section>`).join("")}<footer><p>${e(REFERENCE_NOTE)}</p><p>All 71 public measurement guides are included: 36 front and 35 side. FaceIQ's overview and current guide counts differ. This is an independent local implementation built on FreeHarmony (AGPL-3.0), with its own transparent constructions and editable ranges.</p></footer>`;
}
export const PRINT_CSS = `body{font:12px/1.6 system-ui,sans-serif;color:#292a25;background:white;margin:30px auto;max-width:960px;padding:0 22px}h1{font:42px/1.05 Georgia,serif;letter-spacing:-1px}h2{font-family:Georgia,serif;font-weight:400;margin-top:35px;border-bottom:2px solid #9c6f49;padding-bottom:8px}h3{font-size:14px;margin:0}p{margin:6px 0}small,.print-kicker{color:#8f7b5e}.print-metric-heading{display:flex;justify-content:space-between;gap:20px}.print-metric-heading strong{white-space:nowrap;font-size:17px}.print-photo{max-width:190px;max-height:230px;object-fit:contain;border-radius:8px}article{break-inside:avoid;border-bottom:1px solid #d8cbb6;padding:15px 0}a{color:#98533d}footer{margin-top:30px;font-size:11px}section{clear:both}header p,footer p{max-width:90ch}@media print{body{margin:0;max-width:none;font-size:10px;padding:0}h1{font-size:24px}h2{break-after:avoid}h3{font-size:12px}article{padding:10px 0}.print-metric-heading strong{font-size:14px}@page{size:A4;margin:15mm}}`;
export function downloadReport(scan: StoredScan, settings: HarmonySettings) {
  const reports = [analyzeHarmony("front", settings.front, settings), analyzeHarmony("side", settings.side, settings)];
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>Local FaceIQ · Personal report</title><style>${PRINT_CSS}</style></head><body>${reportMarkup(scan, settings, reports)}</body></html>`;
  download(html, `local-faceiq-report-${scan.id}.html`, "text/html;charset=utf-8");
}
