// Check the actual build output that CI and the Vercel project will serve.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const app = join(dirname(fileURLToPath(import.meta.url)), "..");
const fail = (message) => { throw new Error(`[hosted verification] ${message}`); };
const json = (name) => JSON.parse(readFileSync(join(app, ".next", name), "utf8"));

// Vercel reads configuration and resolves Next.js from its selected project root.
// Verify both supported imports so a successful compile cannot hide a static-site
// preset looking for "public" at the repository root again.
const repository = resolve(app, "..", "..");
const appPackage = JSON.parse(readFileSync(join(app, "package.json"), "utf8"));
for (const entry of [repository, app]) {
  const config = JSON.parse(readFileSync(join(entry, "vercel.json"), "utf8"));
  if (config.framework !== "nextjs" || resolve(entry, config.outputDirectory ?? ".next") !== resolve(app, ".next")) {
    fail(`Vercel at ${entry} must select Next.js and the web app's .next output.`);
  }
  const pkg = JSON.parse(readFileSync(join(entry, "package.json"), "utf8"));
  const installed = JSON.parse(readFileSync(join(entry, "node_modules", "next", "package.json"), "utf8"));
  if (pkg.dependencies?.next !== appPackage.dependencies.next || installed.version !== appPackage.dependencies.next) {
    fail(`Vercel at ${entry} must resolve the same pinned Next.js version as apps/web.`);
  }
}

if (!existsSync(join(app, ".next", "BUILD_ID"))) fail("No successful Next.js production build exists.");
const required = json("required-server-files.json");
if (required.config?.env?.NEXT_PUBLIC_HOSTED_EDITION !== "1") {
  fail("This is a local-edition build. Run pnpm build:vercel before hosted verification.");
}
const policies = json("routes-manifest.json").headers.flatMap(route => route.headers)
  .filter(header => header.key.toLowerCase() === "content-security-policy")
  .map(header => header.value);
if (!policies.length || policies.some(policy => /localhost|127\.0\.0\.1|'unsafe-eval'/.test(policy))) {
  fail("The hosted Content Security Policy is missing or permits local/development connections.");
}
for (const [name, expected] of [
  ["face_landmarker.task", "64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff"],
  ["selfie_multiclass.tflite", "c6748b1253a99067ef71f7e26ca71096cd449baefa8f101900ea23016507e0e0"],
  ["pose_landmarker_lite.task", "59929e1d1ee95287735ddd833b19cf4ac46d29bc7afddbbf6753c459690d574a"],
]) {
  const digest = createHash("sha256").update(readFileSync(join(app, "public", "mediapipe", name))).digest("hex");
  if (digest !== expected) fail(`The packaged ${name} does not match the pinned model.`);
}
const appealParts = [0, 1, 2, 3].map(i => join(app, "public", "models", "clip-b16", `vision_model_quantized.part${i}`));
if (!appealParts.every(existsSync) || createHash("sha256").update(Buffer.concat(appealParts.map(f => readFileSync(f)))).digest("hex") !== "44eece4fe5fe4e0359a88268a327adf758633a1aade3917690b952bef1501f96") fail("The appeal model is missing or failed integrity verification.");
if (!existsSync(join(app, "public", "ort", "ort-wasm-simd-threaded.wasm"))) fail("The ONNX Runtime WASM file is missing.");
const wasm = readdirSync(join(app, "public", "mediapipe", "wasm"));
if (!wasm.some(name => name.endsWith(".wasm")) || !wasm.some(name => name.endsWith(".js"))) {
  fail("The same-origin MediaPipe WASM loader or binary is missing.");
}
console.log("[hosted verification] Vercel entrypoints, Next.js resolution, production output, hosted mode, CSP, model hashes and WASM assets passed.");
