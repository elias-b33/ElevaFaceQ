// Copies the MediaPipe WASM runtime from node_modules and downloads the
// face_landmarker model into public/ so the deployed app is fully
// self-contained — no runtime calls to Google's CDN, which is part of the
// "your face never leaves your device" claim (the model is fetched from OUR
// origin, and inference is local).
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const app = join(root, "..");
const wasmSrc = join(app, "node_modules", "@mediapipe", "tasks-vision", "wasm");
const wasmDst = join(app, "public", "mediapipe", "wasm");
const modelDst = join(app, "public", "mediapipe", "face_landmarker.task");
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const MODEL_SHA256 = "64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff";
const verify = (buffer) => {
  if (createHash("sha256").update(buffer).digest("hex") !== MODEL_SHA256) {
    throw new Error("Face model integrity check failed. The model has not been approved for use.");
  }
};

mkdirSync(join(app, "public", "mediapipe"), { recursive: true });

if (existsSync(wasmSrc)) {
  cpSync(wasmSrc, wasmDst, { recursive: true });
  console.log("[assets] wasm copied to public/mediapipe/wasm");
} else {
  throw new Error("@mediapipe/tasks-vision WASM is missing. Run the reviewed dependency installation first.");
}

if (!existsSync(modelDst)) {
  console.log("[assets] downloading face_landmarker.task …");
  const res = await fetch(MODEL_URL);
  if (!res.ok) throw new Error(`model download failed: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  verify(buf);
  writeFileSync(modelDst, buf);
  console.log(`[assets] model saved (${(buf.length / 1e6).toFixed(1)} MB)`);
} else {
  verify(readFileSync(modelDst));
  console.log("[assets] model already present");
}

// Pinned official Apache-2.0 model. The exact bytes were reviewed and scanned;
// no dependency or executable is installed by this asset setup step.
const contourDst = join(app, "public", "mediapipe", "selfie_multiclass.tflite");
const contourHash = "c6748b1253a99067ef71f7e26ca71096cd449baefa8f101900ea23016507e0e0";
const contourUrl = "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/1/selfie_multiclass_256x256.tflite";
const contour = existsSync(contourDst) ? readFileSync(contourDst) : Buffer.from(await (async () => {
  const response = await fetch(contourUrl);
  if (!response.ok) throw new Error(`Contour model download failed: ${response.status}`);
  return response.arrayBuffer();
})());
if (createHash("sha256").update(contour).digest("hex") !== contourHash) throw new Error("Contour model integrity check failed.");
if (!existsSync(contourDst)) writeFileSync(contourDst, contour);
console.log("[assets] contour model verified");

// Pinned official Apache-2.0 body-pose model (lite). It supplies eye, ear and
// mouth priors for side profiles, where the face mesh cannot lock on.
const poseDst = join(app, "public", "mediapipe", "pose_landmarker_lite.task");
const poseHash = "59929e1d1ee95287735ddd833b19cf4ac46d29bc7afddbbf6753c459690d574a";
const poseUrl = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";
const pose = existsSync(poseDst) ? readFileSync(poseDst) : Buffer.from(await (async () => {
  const response = await fetch(poseUrl);
  if (!response.ok) throw new Error(`Pose model download failed: ${response.status}`);
  return response.arrayBuffer();
})());
if (createHash("sha256").update(pose).digest("hex") !== poseHash) throw new Error("Pose model integrity check failed.");
if (!existsSync(poseDst)) writeFileSync(poseDst, pose);
console.log("[assets] pose model verified");

// Pinned facial-appeal vision model: CLIP ViT-B/16 image encoder (MIT, OpenAI;
// ONNX export by Xenova). It is split into parts so no static file is large.
const appealDir = join(app, "public", "models", "clip-b16");
const appealHash = "44eece4fe5fe4e0359a88268a327adf758633a1aade3917690b952bef1501f96";
const appealUrl = "https://huggingface.co/Xenova/clip-vit-base-patch16/resolve/342fdf2f67aded64d138ff074745fb4a5d2bba5f/onnx/vision_model_quantized.onnx";
const APPEAL_PARTS = 4;
const appealPart = (i) => join(appealDir, `vision_model_quantized.part${i}`);
const appealHave = Array.from({ length: APPEAL_PARTS }, (_, i) => appealPart(i)).every(existsSync);
const appeal = appealHave ? Buffer.concat(Array.from({ length: APPEAL_PARTS }, (_, i) => readFileSync(appealPart(i)))) : Buffer.from(await (async () => {
  console.log("[assets] downloading appeal model …");
  const response = await fetch(appealUrl);
  if (!response.ok) throw new Error(`Appeal model download failed: ${response.status}`);
  return response.arrayBuffer();
})());
if (createHash("sha256").update(appeal).digest("hex") !== appealHash) throw new Error("Appeal model integrity check failed.");
if (!appealHave) {
  mkdirSync(appealDir, { recursive: true });
  const size = Math.ceil(appeal.length / APPEAL_PARTS);
  for (let i = 0; i < APPEAL_PARTS; i++) writeFileSync(appealPart(i), appeal.subarray(i * size, (i + 1) * size));
}
console.log("[assets] appeal model verified");

// ONNX Runtime Web (MIT) WASM runtime for the appeal model, from the frozen install.
const ortSrc = join(app, "node_modules", "onnxruntime-web", "dist");
const ortDst = join(app, "public", "ort");
mkdirSync(ortDst, { recursive: true });
for (const name of ["ort-wasm-simd-threaded.wasm", "ort-wasm-simd-threaded.mjs"]) cpSync(join(ortSrc, name), join(ortDst, name));
console.log("[assets] onnxruntime-web runtime copied");
