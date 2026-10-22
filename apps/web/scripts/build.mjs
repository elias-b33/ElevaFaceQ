// Portable CI/Vercel build. Startup stays offline; only a fresh build fetches
// missing, pinned model assets. User photos never enter this pipeline.
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const app = join(dirname(fileURLToPath(import.meta.url)), "..");
const hosted = process.env.VERCEL === "1" || process.argv.includes("--hosted");
const env = {
  ...process.env,
  ...(hosted ? { VERCEL: "1" } : {}),
  NEXT_TELEMETRY_DISABLED: "1",
  DO_NOT_TRACK: "1",
};
console.log(`[build] Node ${process.version}; ${hosted ? "hosted" : "local"} edition`);
for (const args of [[join(app, "scripts", "prepare-assets.mjs")], [join(app, "node_modules", "next", "dist", "bin", "next"), "build"]]) {
  const result = spawnSync(process.execPath, args, { cwd: app, env, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
