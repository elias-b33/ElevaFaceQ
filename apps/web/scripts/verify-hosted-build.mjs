// Check the actual build output that CI and the Vercel project will serve.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const app = join(dirname(fileURLToPath(import.meta.url)), "..");
const fail = (message) => { throw new Error(`[hosted verification] ${message}`); };
const json = (name) => JSON.parse(readFileSync(join(app, ".next", name), "utf8"));

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
]) {
  const digest = createHash("sha256").update(readFileSync(join(app, "public", "mediapipe", name))).digest("hex");
  if (digest !== expected) fail(`The packaged ${name} does not match the pinned model.`);
}
const wasm = readdirSync(join(app, "public", "mediapipe", "wasm"));
if (!wasm.some(name => name.endsWith(".wasm")) || !wasm.some(name => name.endsWith(".js"))) {
  fail("The same-origin MediaPipe WASM loader or binary is missing.");
}
console.log("[hosted verification] Production output, hosted mode, CSP, model hashes and WASM assets passed.");
