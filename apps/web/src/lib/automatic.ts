"use client";

import { FaceLandmarker, FilesetResolver, ImageSegmenter, PoseLandmarker, type FaceLandmarkerResult } from "@mediapipe/tasks-vision";
import { automaticLandmarks, eulerFromMatrix, measureImageFeatures, type HarmonyView, type ImageFeatures, type MeasurementDocument, type PoseLandmark, type SegmentationPlane, type XY } from "@freeharmony/engine";
import { getLandmarker } from "./landmarker";

let segmenter: Promise<ImageSegmenter> | undefined;
let profileModel: Promise<FaceLandmarker> | undefined;
let poseModel: Promise<PoseLandmarker> | undefined;
let queue: Promise<unknown> = Promise.resolve();
const paint = () => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
const files = () => FilesetResolver.forVisionTasks("/mediapipe/wasm");
/** Long edge of the stored photo; landmark documents describe that image. */
export const PHOTO_EDGE = 768;

// All models run on the CPU, matching the reference calibration. A GPU
// delegate changes predictions by device, and with them the measurements.
function cached<T>(get: () => Promise<T> | undefined, set: (value: Promise<T> | undefined) => void, create: () => Promise<T>): Promise<T> {
  const existing = get();
  if (existing) return existing;
  const next = create().catch(error => { set(undefined); throw error; });
  set(next);
  return next;
}
const segmentationModel = () => cached(() => segmenter, v => { segmenter = v; }, async () => ImageSegmenter.createFromOptions(await files(), {
  baseOptions: { modelAssetPath: "/mediapipe/selfie_multiclass.tflite", delegate: "CPU" },
  runningMode: "IMAGE", outputCategoryMask: true, outputConfidenceMasks: false,
}));
const profileLandmarker = () => cached(() => profileModel, v => { profileModel = v; }, async () => FaceLandmarker.createFromOptions(await files(), {
  baseOptions: { modelAssetPath: "/mediapipe/face_landmarker.task", delegate: "CPU" },
  runningMode: "IMAGE", numFaces: 2, minFaceDetectionConfidence: .2, minFacePresenceConfidence: .3, outputFacialTransformationMatrixes: true,
}));
const poseLandmarker = () => cached(() => poseModel, v => { poseModel = v; }, async () => PoseLandmarker.createFromOptions(await files(), {
  baseOptions: { modelAssetPath: "/mediapipe/pose_landmarker_lite.task", delegate: "CPU" },
  runningMode: "IMAGE", numPoses: 1, minPoseDetectionConfidence: .3, minPosePresenceConfidence: .3,
}));

export async function photoCanvas(data: string): Promise<HTMLCanvasElement> {
  if (!/^data:image\/(jpeg|png|webp);base64,/.test(data)) throw new Error("Choose an embedded local photo.");
  const img = new Image();
  await new Promise<void>((resolve, reject) => { img.onload = () => resolve(); img.onerror = () => reject(new Error("The saved photo could not be opened.")); img.src = data; });
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
  canvas.getContext("2d")!.drawImage(img, 0, 0); return canvas;
}
export interface DetectionOptions {
  view: HarmonyView;
  canvas: HTMLCanvasElement;
  mesh?: readonly (XY & { z?: number })[];
  onProgress?: (step: string) => void;
}
export interface DetectionResult {
  doc: MeasurementDocument;
  /** Photo-based measurements for the rating; front view only. */
  image: ImageFeatures | null;
}
/** All models and pixels stay on this origin. Serialize calls to shared WASM instances. */
export function detectAutomatic(options: DetectionOptions): Promise<DetectionResult> {
  const task = queue.then(() => detect(options));
  queue = task.catch(() => undefined); return task;
}
async function detect({ view, canvas: original, mesh: suppliedMesh, onProgress }: DetectionOptions): Promise<DetectionResult> {
  const step = async (message: string) => { onProgress?.(message); await paint(); };
  await step("Opening local vision models");
  const canvas = document.createElement("canvas"), scale = Math.min(1, 1024 / Math.max(original.width, original.height));
  canvas.width = Math.max(1, Math.round(original.width * scale)); canvas.height = Math.max(1, Math.round(original.height * scale));
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(original, 0, 0, canvas.width, canvas.height);
  const aspect = original.width / original.height;
  const imageHeight = Math.round(original.height * Math.min(1, PHOTO_EDGE / Math.max(original.width, original.height)));
  const warnings: string[] = [];
  await step(view === "front" ? "Mapping your facial landmarks" : "Tracing your profile");
  let segmentation: SegmentationPlane | undefined;
  try {
    const result = (await segmentationModel()).segment(canvas);
    try { const mask = result.categoryMask; if (mask) segmentation = { width: mask.width, height: mask.height, categories: mask.getAsUint8Array().slice() }; }
    finally { result.close(); }
  } catch { warnings.push("The local contour model could not run. Retry detection or check the local assets."); }
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const plane = { width: pixels.width, height: pixels.height, data: pixels.data };

  if (view === "front") {
    let mesh = suppliedMesh;
    if (!mesh?.length) {
      const detection = (await getLandmarker()).detect(original);
      if (detection.faceLandmarks.length !== 1) throw new Error(detection.faceLandmarks.length > 1 ? "More than one face was found. Choose a photo containing one person." : "No face was found. Choose a clearer photograph.");
      mesh = detection.faceLandmarks[0];
    }
    await step("Measuring proportions, skin and features");
    const doc = automaticLandmarks({ view, aspect, imageHeight, segmentation, pixels: plane, mesh, at: Date.now() });
    doc.automatic!.warnings.push(...warnings);
    return { doc, image: mesh ? measureImageFeatures({ mesh, pixels: plane, segmentation }) : null };
  }

  await step("Locating the eye, ear and jaw");
  let pose: PoseLandmark[] | undefined;
  try { pose = (await poseLandmarker()).detect(canvas).landmarks[0]?.map(p => ({ x: p.x, y: p.y, z: p.z, visibility: p.visibility })); }
  catch { warnings.push("The local pose model could not run; eye and ear positions use facial proportions."); }
  let mesh = suppliedMesh, detection: FaceLandmarkerResult | undefined;
  if (!mesh?.length) {
    detection = (await profileLandmarker()).detect(canvas);
    if (detection.faceLandmarks.length > 1) throw new Error("More than one face was found. Use a photo containing one person.");
    mesh = detection.faceLandmarks[0];
  }
  if (detection?.facialTransformationMatrixes[0]) {
    const yaw = Math.abs(eulerFromMatrix(detection.facialTransformationMatrixes[0].data).yawDeg);
    if (yaw < 45) throw new Error("This looks closer to a front or three-quarter view. Turn fully sideways for the profile analysis.");
    if (yaw < 65) warnings.push("The face appears partly turned toward the camera. A true 90° profile gives more accurate measurements.");
  }
  await step("Measuring your profile");
  const doc = automaticLandmarks({ view, aspect, imageHeight, segmentation, pixels: plane, mesh, pose, at: Date.now() });
  doc.automatic!.warnings.push(...warnings);
  return { doc, image: null };
}
