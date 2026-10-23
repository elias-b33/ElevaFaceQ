// Minimal static server for the vision harness. Loopback only.
import { createServer } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";

const repo = new URL("../../", import.meta.url).pathname;
const work = process.env.CALIBRATION_DIR;
if (!work) throw new Error("Set CALIBRATION_DIR to the working folder holding images/ and models/.");
const routes = {
  "/tv/": repo + "apps/web/node_modules/@mediapipe/tasks-vision/",
  "/mp/": repo + "apps/web/public/mediapipe/",
  "/img/": work + "/",
  "/": new URL("./", import.meta.url).pathname,
};
const types = { ".html": "text/html", ".mjs": "text/javascript", ".js": "text/javascript", ".wasm": "application/wasm", ".jpg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".json": "application/json" };
const page = (u) => u === "/" ? "/harness.html" : u;
createServer((req, res) => {
  const url = page(decodeURIComponent(new URL(req.url, "http://x").pathname));
  const prefix = Object.keys(routes).find(p => url.startsWith(p));
  const file = normalize(join(routes[prefix], url.slice(prefix.length)));
  if (!file.startsWith(routes[prefix]) || !existsSync(file) || !statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "Content-Type": types[extname(file)] ?? "application/octet-stream", "Cross-Origin-Opener-Policy": "same-origin" });
  createReadStream(file).pipe(res);
}).listen(3111, "127.0.0.1", () => console.log("harness on http://127.0.0.1:3111"));
