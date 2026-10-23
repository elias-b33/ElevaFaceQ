"use client";

import { APPEAL, APPEAL_INPUT, appealCrop, appealFromEmbedding, appealTensor } from "@freeharmony/engine";

/** Self-hosted vision model, split into parts so no single static file is large. */
export const APPEAL_MODEL_PARTS = 4;
const MODEL_URL = (i: number) => `/models/clip-b16/vision_model_quantized.part${i}`;

type Session = import("onnxruntime-web").InferenceSession;
let session: Promise<{ ort: typeof import("onnxruntime-web"); session: Session }> | null = null;

function load() {
  session ??= (async () => {
    const ort = await import("onnxruntime-web/wasm");
    ort.env.wasm.wasmPaths = "/ort/";
    ort.env.wasm.numThreads = 1;
    ort.env.wasm.proxy = false;
    const parts = await Promise.all(Array.from({ length: APPEAL_MODEL_PARTS }, async (_, i) => {
      const response = await fetch(MODEL_URL(i));
      if (!response.ok) throw new Error("The appeal model could not be loaded.");
      return new Uint8Array(await response.arrayBuffer());
    }));
    const model = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
    let offset = 0;
    for (const p of parts) { model.set(p, offset); offset += p.length; }
    return { ort, session: await ort.InferenceSession.create(model, { executionProviders: ["wasm"], graphOptimizationLevel: "all" }) };
  })();
  session.catch(() => { session = null; });
  return session;
}

/** Start downloading the model early, e.g. when a rating begins. */
export function preloadAppeal(): void { void load().catch(() => undefined); }

/**
 * Appeal prediction for a front photo: the face is cropped from the landmark
 * mesh, run through the vision model and scored by the linear head.
 */
export async function measureAppeal(image: CanvasImageSource & { width: number; height: number }, mesh: readonly { x: number; y: number }[]): Promise<{ version: string; raw: number }> {
  const { ort, session: s } = await load();
  const crop = appealCrop(mesh, image.width, image.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = APPEAL_INPUT;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.fillStyle = "#000"; ctx.fillRect(0, 0, APPEAL_INPUT, APPEAL_INPUT);
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
  ctx.drawImage(image, crop.x, crop.y, crop.size, crop.size, 0, 0, APPEAL_INPUT, APPEAL_INPUT);
  const input = new ort.Tensor("float32", appealTensor(ctx.getImageData(0, 0, APPEAL_INPUT, APPEAL_INPUT).data), [1, 3, APPEAL_INPUT, APPEAL_INPUT]);
  const output = await s.run({ [s.inputNames[0]!]: input });
  const embedding = (output.image_embeds ?? output[s.outputNames[0]!])!.data as Float32Array;
  return { version: APPEAL.version, raw: appealFromEmbedding(embedding) };
}

/** Appeal for a saved photo (data URL) and its stored mesh. */
export async function measureSavedAppeal(photo: string, mesh: readonly { x: number; y: number }[]): Promise<{ version: string; raw: number }> {
  const img = new Image();
  img.src = photo;
  await img.decode();
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
  canvas.getContext("2d")!.drawImage(img, 0, 0);
  return measureAppeal(canvas, mesh);
}
