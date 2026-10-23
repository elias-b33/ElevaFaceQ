"use client";

import type {
  ProfileAnchors,
  ProfileMetricResult,
  ScanResult,
  Sex,
  HarmonySettings,
  ScanDiagnostic,
  ImageFeatures,
  RatingGender,
} from "@freeharmony/engine";
import type { StoredInput } from "./scan";

// Photos and measurements are kept in this browser. The optional AI path only
// accepts a local Ollama service; nothing here uploads data.

export interface Profile {
  onboarded: boolean;
  sex: Sex;
  /** Gender whose ideal ranges the rating uses; asked when a rating starts. */
  gender?: RatingGender;
  ageRange?: string;
  goal?: string;
  skinType?: "oily" | "dry" | "normal" | "combination" | "sensitive";
  skincare?: string[];
  diet?: "balanced" | "high-protein" | "plant-based" | "not-great";
  sleep?: "<5" | "6-8" | "8+" | "irregular";
  activity?: "sedentary" | "light" | "regular" | "athlete";
  concerns?: string[];
  experience?: "beginner" | "intermediate" | "advanced";
  /** legacy field kept for older profiles */
  goals?: string[];
}

/** The slice of the profile the advice engine personalizes against. */
export function personalContext(p: Profile) {
  return {
    sex: p.sex,
    ageRange: p.ageRange,
    goal: p.goal,
    skinType: p.skinType,
    skincare: p.skincare,
    diet: p.diet,
    sleep: p.sleep,
    activity: p.activity,
    concerns: p.concerns,
    experience: p.experience,
  };
}

export interface StoredScan {
  id: string;
  createdAt: number;
  result: ScanResult;
  /** Separate, explicitly provisional estimate for a pose-refused capture. */
  diagnostic?: ScanDiagnostic;
  /** JPEG data URL, long edge ≤ 768. */
  photo: string;
  /** Original photo aspect, including manual scans without a detected face. */
  imageAspect?: number;
  /** Raw landmarks etc. for re-analysis (Adjust Points, profile changes). */
  input?: StoredInput;
  /** Landmark overrides the user applied via Adjust Points. */
  overrides?: Record<number, { x: number; y: number }>;
  /** Versioned, named 70+ measurement landmarks; legacy geometry is preserved. */
  measurements?: HarmonySettings;
  /** Ideal ranges and calibration the rating is scored against. */
  gender?: RatingGender;
  /** Photo-based measurements from the original front photo (skin, eyes, hair, symmetry). */
  imageFeatures?: ImageFeatures;
  /** Appeal model prediction for the front photo, tagged with the model version. */
  appeal?: { version: string; raw: number };
  /** Optional AI annotations — never part of the score itself. */
  ai?: {
    sanity?: import("./ai/schema").SanityAnnotation;
    report?: import("./ai/schema").DeepReport;
    summary?: import("./ai/schema").DeepReport;
  };
  /** Side-profile capture: contour-anchor analysis, separate from the mesh. */
  side?: {
    photo: string;
    anchors: ProfileAnchors;
    results: ProfileMetricResult[];
    at: number;
    imageAspect?: number;
  };
}

export function updateScan(id: string, patch: Partial<StoredScan>): StoredScan | undefined {
  const scans = loadScans();
  const idx = scans.findIndex((s) => s.id === id);
  if (idx === -1) return undefined;
  const next = { ...scans[idx]!, ...patch };
  scans[idx] = next;
  persistScans(scans);
  return next;
}

export const PROFILE_KEY = "faceiq.profile.v1";
export const SCANS_KEY = "faceiq.scans.v1";
const MAX_SCANS = 40;

export function loadProfile(): Profile {
  if (typeof window === "undefined") return { onboarded: false, sex: "neutral" };
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (raw) return JSON.parse(raw) as Profile;
  } catch {
    // fall through to default
  }
  return { onboarded: false, sex: "neutral" };
}

export function saveProfile(p: Profile): void {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
}

export function loadScans(): StoredScan[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(SCANS_KEY);
    if (raw) return JSON.parse(raw) as StoredScan[];
  } catch {
    // corrupted store — treat as empty rather than crash
  }
  return [];
}

export function getScan(id: string): StoredScan | undefined {
  return loadScans().find((s) => s.id === id);
}

export function saveScan(scan: StoredScan): void {
  const existing = loadScans();
  const index = existing.findIndex(item => item.id === scan.id);
  if (index !== -1) {
    existing[index] = scan;
    persistScans(existing);
    return;
  }
  if (existing.length >= MAX_SCANS) {
    throw new Error("Your local history has 40 analyses. Export a backup and delete an older scan before adding another.");
  }
  persistScans([scan, ...existing]);
}

export function persistScans(scans: StoredScan[]): void {
  try {
    localStorage.setItem(SCANS_KEY, JSON.stringify(scans));
  } catch {
    throw new Error("Browser storage is full. Export a backup, then remove an older analysis. Your existing photos have been kept.");
  }
}

export function deleteScan(id: string): void {
  localStorage.setItem(
    SCANS_KEY,
    JSON.stringify(loadScans().filter((s) => s.id !== id)),
  );
}

export function nukeAllData(): void {
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith("faceiq.")) localStorage.removeItem(key);
  }
}

export function newScanId(): string {
  return `scan_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
