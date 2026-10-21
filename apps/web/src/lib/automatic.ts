"use client";

import { FaceLandmarker, FilesetResolver, ImageSegmenter, type FaceLandmarkerResult } from "@mediapipe/tasks-vision";
import { automaticLandmarks, eulerFromMatrix, type HarmonyView, type MeasurementDocument, type SegmentationPlane, type XY } from "@freeharmony/engine";
import { getLandmarker } from "./landmarker";

let segmenter: Promise<ImageSegmenter> | undefined;
let profileModel: Promise<FaceLandmarker> | undefined;
let queue: Promise<unknown> = Promise.resolve();
const paint = () => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
const files = () => FilesetResolver.forVisionTasks("/mediapipe/wasm");

async function segmentationModel() {
  if (!segmenter) segmenter = (async () => {
    const runtime = await files();
    const create = (delegate: "GPU" | "CPU") => ImageSegmenter.createFromOptions(runtime, {
      baseOptions: { modelAssetPath: "/mediapipe/selfie_multiclass.tflite", delegate },
      runningMode: "IMAGE", outputCategoryMask: true, outputConfidenceMasks: false,
    });
    try { return await create("GPU"); } catch { return create("CPU"); }
  })().catch(error => { segmenter = undefined; throw error; });
  return segmenter;
}
async function profileLandmarker() {
  if (!profileModel) profileModel = (async () => {
    const runtime = await files();
    const create = (delegate: "GPU" | "CPU") => FaceLandmarker.createFromOptions(runtime, {
      baseOptions: { modelAssetPath: "/mediapipe/face_landmarker.task", delegate },
      runningMode: "IMAGE", numFaces: 2, minFaceDetectionConfidence: .2,
      minFacePresenceConfidence: .3, outputFacialTransformationMatrixes: true,
    });
    try { return await create("GPU"); } catch { return create("CPU"); }
  })().catch(error => { profileModel = undefined; throw error; });
  return profileModel;
}
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
/** All models and pixels stay on this origin. Serialize calls to shared WASM instances. */
export function detectAutomatic(options: DetectionOptions): Promise<MeasurementDocument> {
  const task = queue.then(() => detect(options));
  queue = task.catch(() => undefined); return task;
}
async function detect({ view, canvas: original, mesh: suppliedMesh, onProgress }: DetectionOptions) {
  const step = async (message: string) => { onProgress?.(message); await paint(); };
  await step("Opening local vision models");
  const canvas = document.createElement("canvas"), scale = Math.min(1, 1024 / Math.max(original.width, original.height));
  canvas.width = Math.max(1, Math.round(original.width * scale)); canvas.height = Math.max(1, Math.round(original.height * scale));
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(original, 0, 0, canvas.width, canvas.height);
  let segmentation: SegmentationPlane | undefined, detection: FaceLandmarkerResult | undefined;
  const warnings: string[] = [];
  await step("Tracing the face, hair and skin contours");
  try {
    const model = await segmentationModel();
    const result = model.segment(canvas);
    try { const mask = result.categoryMask; if (mask) segmentation = { width: mask.width, height: mask.height, categories: mask.getAsUint8Array().slice() }; }
    finally { result.close(); }
  } catch { warnings.push("The local contour model could not run. Retry detection or check the local assets."); }
  let mesh = suppliedMesh;
  if (!mesh?.length) {
    await step(view === "side" ? "Locating the visible eye and profile" : "Locating facial landmarks");
    const model = view === "side" ? await profileLandmarker() : await getLandmarker();
    detection = model.detect(canvas);
    if (detection.faceLandmarks.length > 1) throw new Error("More than one face was found. Use a photo containing one person.");
    mesh = detection.faceLandmarks[0];
    // A close crop helps the short-range face detector on small faces. Map its
    // normalized coordinates back onto the original image before any geometry.
    if (!mesh && view === "side" && segmentation) {
      const { width: w, height: h, categories } = segmentation;
      let x0 = w, x1 = 0, y0 = h, y1 = 0, count = 0;
      for (let i = 0; i < categories.length; i++) if (categories[i] === 3) { const x = i % w, y = Math.floor(i / w); x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); count++; }
      if (count > 100) {
        const pad = (y1 - y0) * .22, sx = Math.max(0, (x0 - pad) / w), sy = Math.max(0, (y0 - pad) / h);
        const sw = Math.min(1 - sx, (x1 - x0 + pad * 2) / w), sh = Math.min(1 - sy, (y1 - y0 + pad * 2) / h);
        const crop = document.createElement("canvas"); crop.width = Math.max(1, Math.round(sw * canvas.width)); crop.height = Math.max(1, Math.round(sh * canvas.height));
        crop.getContext("2d")!.drawImage(canvas, sx * canvas.width, sy * canvas.height, sw * canvas.width, sh * canvas.height, 0, 0, crop.width, crop.height);
        detection = model.detect(crop);
        if (detection.faceLandmarks.length > 1) throw new Error("More than one face was found in the profile crop.");
        mesh = detection.faceLandmarks[0]?.map(p => ({ ...p, x: sx + p.x * sw, y: sy + p.y * sh, z: p.z * sw }));
      }
    }
  }
  if (view === "side" && detection?.facialTransformationMatrixes[0]) {
    const yaw = Math.abs(eulerFromMatrix(detection.facialTransformationMatrixes[0].data).yawDeg);
    if (yaw < 45) throw new Error("This looks closer to a front or three-quarter view. Turn fully sideways for the profile report.");
    if (yaw < 65) warnings.push("The face appears partly turned toward the camera. A true 90° profile gives more useful silhouette measurements.");
  }
  await step("Constructing your measurement study");
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const doc = automaticLandmarks({ view, aspect: original.width / original.height, imageHeight: Math.min(768, original.height, 768 / (original.width / original.height)), segmentation, pixels: { width: pixels.width, height: pixels.height, data: pixels.data }, mesh, at: Date.now() });
  doc.automatic!.warnings.push(...warnings);
  return doc;
}
