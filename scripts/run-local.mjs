// Local launcher: no downloads, package installation, or network exposure.
import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const app = join(root, "apps", "web");
const mode = process.argv[2] ?? "start";
if (!["dev", "build", "start"].includes(mode)) {
  console.error("Use: node scripts/run-local.mjs [dev|build|start]");
  process.exit(1);
}
const cli = join(app, "node_modules", "next", "dist", "bin", "next");
if (!existsSync(cli)) {
  console.error("Dependencies are missing. See README.md for the reviewed setup steps.");
  process.exit(1);
}
if (!existsSync(join(app, "public", "mediapipe", "face_landmarker.task"))) {
  console.error("Local face model is missing. Run pnpm setup:assets once while online.");
  process.exit(1);
}
const modelHash = createHash("sha256").update(readFileSync(join(app, "public", "mediapipe", "face_landmarker.task"))).digest("hex");
if (modelHash !== "64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff") {
  console.error("Local model integrity check failed. The server was not started.");
  process.exit(1);
}
const contourFile = join(app, "public", "mediapipe", "selfie_multiclass.tflite");
if (!existsSync(contourFile) || createHash("sha256").update(readFileSync(contourFile)).digest("hex") !== "c6748b1253a99067ef71f7e26ca71096cd449baefa8f101900ea23016507e0e0") {
  console.error("Local contour model is missing or failed integrity verification. Run the reviewed asset setup.");
  process.exit(1);
}
const poseFile = join(app, "public", "mediapipe", "pose_landmarker_lite.task");
if (!existsSync(poseFile) || createHash("sha256").update(readFileSync(poseFile)).digest("hex") !== "59929e1d1ee95287735ddd833b19cf4ac46d29bc7afddbbf6753c459690d574a") {
  console.error("Local pose model is missing or failed integrity verification. Run the reviewed asset setup.");
  process.exit(1);
}
if (mode === "start" && !existsSync(join(app, ".next", "BUILD_ID"))) {
  console.error("Build the app first with pnpm build, or use pnpm dev for development.");
  process.exit(1);
}
const args = mode === "build" ? [cli, "build"] : [cli, mode, "--hostname", "127.0.0.1", "--port", "3000"];
const child = spawn(process.execPath, args, {
  cwd: app,
  stdio: "inherit",
  env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1", DO_NOT_TRACK: "1" },
});
process.on("SIGINT", () => child.kill("SIGINT"));
process.on("SIGTERM", () => child.kill("SIGTERM"));
child.on("error", (error) => { console.error(error.message); process.exitCode = 1; });
child.on("exit", (code) => { process.exitCode = code ?? 1; });
