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
