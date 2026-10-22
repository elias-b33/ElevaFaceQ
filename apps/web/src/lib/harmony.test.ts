import { describe, expect, it } from "vitest";
import { analyze, analyzeHarmony, seedDocument } from "@freeharmony/engine";
import { canonicalInput } from "../../../../packages/engine/test/helpers";
import { reportMarkup, scanDocuments } from "./harmony";
import type { StoredScan } from "./store";

const scan: StoredScan = { id: "scan_fixture", createdAt: 1, photo: "", result: analyze(canonicalInput()), input: { landmarks: canonicalInput().landmarks, mirrored: false } };
describe("report migration and private export", () => {
  it("opens legacy scans without mutating original data or claiming reviewed points", () => {
    const before = JSON.stringify(scan), settings = scanDocuments(scan);
    expect(JSON.stringify(scan)).toBe(before);
    expect(settings.front!.points.cheekL.source).toBe("mesh");
    // The old 468-point topology has no iris center. Do not invent a pupil.
    expect(settings.front!.points.pupilL.source).toBe("template");
    expect(analyzeHarmony("front", settings.front).reviewed).toBe(0);
    expect(settings.front!.points.hairline.source).toBe("template");
  });
  it("preserves aspect ratio for manual scans without a detected face", () => {
    const original = { ...scan, imageAspect: .6, result: { ...scan.result, frame: null } };
    expect(scanDocuments(original).front!.aspect).toBe(.6);
  });
  it("replaces unreviewed old front guesses while retaining explicit manual corrections", () => {
    const front = seedDocument("front", .8, canonicalInput().landmarks);
    front.points.hairline = { x: .5, y: .1, source: "estimated", reviewed: false, confidence: .4 };
    front.points.tragionL = { x: .2, y: .4, source: "manual", reviewed: true };
    const original: StoredScan = { ...scan, imageAspect: .8, measurements: { version: 1, front },
      input: { ...scan.input!, imageWidth: 800, imageHeight: 1000 } };
    const before = JSON.stringify(original), migrated = scanDocuments(original).front!;
    expect(JSON.stringify(original)).toBe(before);
    expect(migrated.points.hairline.source).toBe("template");
    expect(migrated.points.tragionL).toEqual(front.points.tragionL);
    expect(migrated.imageHeight).toBe(1000);
    expect(migrated.aspect).toBe(.8);
    expect(migrated.automatic?.engine).toBe("facelab-observed-mesh-1.0");
  });
  it("never turns the legacy eight profile anchors into a complete 35-metric report", () => {
    const doc = seedDocument("side", .8);
    const keys = ["glabella", "nasion", "pronasale", "subnasale", "labialeSup", "labialeInf", "pogonion", "menton"];
    const anchors = Object.fromEntries(keys.map(k => [k, { x: .5, y: .5 }])) as NonNullable<StoredScan["side"]>["anchors"];
    const settings = scanDocuments({ ...scan, side: { photo: "", anchors, results: [], at: 1 } });
    expect(settings.side!.points.porion.source).toBe("template");
    expect(analyzeHarmony("side", settings.side).available).toBe(0);
    expect(doc.points.porion.source).toBe("template");
  });
  it("escapes user notes in the standalone report and includes both complete views", () => {
    const settings = { ...scanDocuments(scan), notes: '<img src=x onerror="fetch(\'https://remote.test\')">' };
    const html = reportMarkup(scan, settings, [analyzeHarmony("front", settings.front), analyzeHarmony("side", settings.side)]);
    expect(html).not.toContain('<img src=x');
    expect(html).toContain("&lt;img");
    expect(html.match(/<article>/g)).toHaveLength(71);
    expect(html).toContain("Provisional");
  });
  it("exports the same actual scale and leveling dependencies as the computed report", () => {
    const front = seedDocument("front", 1);
    for (const point of Object.values(front.points)) { point.source = "manual"; point.reviewed = true; }
    delete front.points.hairline;
    front.calibration = { from: "cheekL", to: "cheekR", millimeters: 140 };
    const report = analyzeHarmony("front", front);
    const result = report.measurements.find(m => m.key === "front.cupid-s-bow-depth")!;
    expect(result.unit).toBe("mm"); expect(result.status).toBe("reviewed");
    const html = reportMarkup(scan, { version: 1, front }, [report]);
    const article = html.split("<article>").find(part => part.startsWith('<div class="print-metric-heading"><h3>Cupid'))!.split("</article>")[0]!;
    expect(article).toContain("Left pupil center"); expect(article).toContain("Left cheekbone");
    expect(article).not.toContain("Hairline center");
  });
});
