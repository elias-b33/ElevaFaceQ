import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { analyze, seedDocument } from "@freeharmony/engine";
import { canonicalInput } from "../../../../packages/engine/test/helpers";
import { createBackup, restoreBackup } from "./backup";
import { loadScans, saveProfile, saveScan, SCANS_KEY, type StoredScan } from "./store";

let entries: Map<string, string>;
let rejectNextWrite: boolean;
function exampleScan(id = "scan_example"): StoredScan {
  return { id, createdAt: 1_792_602_000_000, photo: "data:image/jpeg;base64,AA==", result: analyze(canonicalInput()) };
}
beforeEach(() => {
  entries = new Map(); rejectNextWrite = false;
  vi.stubGlobal("window", {});
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => { if (rejectNextWrite) { rejectNextWrite = false; throw new Error("QuotaExceededError"); } entries.set(key, value); },
    removeItem: (key: string) => entries.delete(key),
  });
  saveProfile({ onboarded: true, sex: "neutral" });
});
afterEach(() => vi.unstubAllGlobals());

describe("local scan persistence and backups", () => {
  it("updates corrected landmarks without duplicating a history entry", () => {
    const original = exampleScan(); saveScan(original);
    saveScan({ ...original, overrides: { 1: { x: .5, y: .5 } } });
    expect(loadScans()).toHaveLength(1);
    expect(loadScans()[0].overrides).toEqual({ 1: { x: .5, y: .5 } });
  });
  it("keeps every existing photo when storage is full", () => {
    saveScan(exampleScan()); const before = entries.get(SCANS_KEY);
    rejectNextWrite = true;
    expect(() => saveScan(exampleScan("scan_another"))).toThrow("existing photos have been kept");
    expect(entries.get(SCANS_KEY)).toBe(before);
  });
  it("restores a complete report and merges repeated backups without duplicates", () => {
    saveScan(exampleScan()); const backup = createBackup();
    entries.delete(SCANS_KEY);
    expect(restoreBackup(backup)).toBe(1);
    expect(restoreBackup(backup)).toBe(0);
    expect(loadScans()[0]).toEqual(JSON.parse(JSON.stringify(exampleScan())));
  });
  it("rejects remote photo URLs before changing local data", () => {
    saveScan(exampleScan()); const backup = JSON.parse(createBackup());
    backup.scans[0].photo = "https://remote.example/track-face.jpg";
    const before = entries.get(SCANS_KEY);
    expect(() => restoreBackup(JSON.stringify(backup))).toThrow("No data was changed");
    expect(entries.get(SCANS_KEY)).toBe(before);
  });
  it("rejects malformed measurement payloads rather than trusting a JSON file", () => {
    saveScan(exampleScan()); const backup = JSON.parse(createBackup());
    backup.scans[0].result.metrics[0].value = "<script>invalid</script>";
    expect(() => restoreBackup(JSON.stringify(backup))).toThrow("valid Local FaceIQ backup");
    expect(loadScans()).toHaveLength(1);
  });
  it("leaves the previous history intact if a restore cannot fit", () => {
    saveScan(exampleScan("scan_imported")); const backup = createBackup();
    entries.delete(SCANS_KEY); saveScan(exampleScan("scan_existing"));
    const before = entries.get(SCANS_KEY); rejectNextWrite = true;
    expect(() => restoreBackup(backup)).toThrow("storage is full");
    expect(entries.get(SCANS_KEY)).toBe(before);
  });
  it("round-trips all named landmarks, calibration, review state and custom ranges in v3", () => {
    const front = seedDocument("front", .8, canonicalInput().landmarks);
    front.points.hairline = { x: .5, y: .15, source: "manual", reviewed: true };
    front.calibration = { from: "hairline", to: "menton", millimeters: 185 };
    const original: StoredScan = { ...exampleScan(), measurements: { version: 1, front, side: seedDocument("side", 1.2), ranges: { "front.midface-ratio": { lo: .9, hi: 1.15 }, "side.nasofrontal-angle": null }, notes: "Same lens and distance.", descriptiveOnly: false } };
    saveScan(original); const backup = createBackup();
    expect(JSON.parse(backup).version).toBe(3);
    entries.delete(SCANS_KEY); restoreBackup(backup);
    expect(loadScans()[0]).toEqual(JSON.parse(JSON.stringify(original)));
  });
  it("still restores v1 backups from the original local app", () => {
    saveScan(exampleScan()); const backup = JSON.parse(createBackup()); backup.version = 1;
    entries.delete(SCANS_KEY); expect(restoreBackup(JSON.stringify(backup))).toBe(1);
    expect(loadScans()[0].result.engineVersion).toBe(exampleScan().result.engineVersion);
  });
  it("preserves automatic evidence and quality labels in a v3 backup", () => {
    const side=seedDocument("side",1);
    side.points.porion={x:.35,y:.4,source:"estimated",reviewed:false,confidence:.32,evidence:"Estimated ear-opening reference"};
    side.points.pronasale={x:.7,y:.48,source:"contour",reviewed:true,confidence:.76,evidence:"Visible skin boundary"};
    side.automatic={engine:"local-mesh-contour-1.0",at:42,detected:1,estimated:1,missing:25,warnings:["Review internal references."],facing:"right",meshFound:false};
    saveScan({...exampleScan(),measurements:{version:1,side}});
    const backup=createBackup();entries.delete(SCANS_KEY);restoreBackup(backup);
    expect(loadScans()[0].measurements!.side).toEqual(side);
  });
  it("still accepts v2 backup documents without provenance metadata", () => {
    saveScan({...exampleScan(),measurements:{version:1,front:seedDocument("front",.8)}});
    const backup=JSON.parse(createBackup());backup.version=2;
    entries.delete(SCANS_KEY);expect(restoreBackup(JSON.stringify(backup))).toBe(1);
  });
  it("rejects invalid named landmarks and reversed ranges atomically", () => {
    saveScan({ ...exampleScan(), measurements: { version: 1, front: seedDocument("front", .8) } });
    const before = entries.get(SCANS_KEY), backup = JSON.parse(createBackup());
    backup.scans[0].measurements.front.points.hairline.x = 2;
    expect(() => restoreBackup(JSON.stringify(backup))).toThrow("No data was changed");
    expect(entries.get(SCANS_KEY)).toBe(before);
    backup.scans[0].measurements.front.points.hairline.x = .5;
    backup.scans[0].measurements.ranges = { "front.midface-ratio": { lo: 2, hi: 1 } };
    expect(() => restoreBackup(JSON.stringify(backup))).toThrow("No data was changed");
    expect(entries.get(SCANS_KEY)).toBe(before);
  });
});
