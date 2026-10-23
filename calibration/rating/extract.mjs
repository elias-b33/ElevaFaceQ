// Run the vision harness over image paths (relative to CALIBRATION_DIR) and cache the model outputs.
import { chromium } from "playwright";
import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { basename, dirname, join } from "node:path";

const S = process.env.CALIBRATION_DIR;
if (!S) throw new Error("Set CALIBRATION_DIR.");
const list = readFileSync(process.argv[2], "utf8").split("\n").filter(Boolean);
const outDir = join(S, "cache");
mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const page = await browser.newPage();
page.on("pageerror", e => console.error("pageerror", e.message));
await page.goto("http://127.0.0.1:3111/");
await page.waitForFunction(() => window.ready === true, null, { timeout: 120000 });
let n = 0;
for (const rel of list) {
  const id = rel.replace(/[\/]/g, "__").replace(/\.\w+$/, "");
  const target = join(outDir, id + ".json");
  if (existsSync(target)) continue;
  const r = await page.evaluate(src => window.run(src), "/img/" + rel);
  const cat = Buffer.from(r.categories, "base64"), bg = Buffer.from(r.background, "base64");
  writeFileSync(join(outDir, id + ".cat.gz"), gzipSync(cat));
  writeFileSync(join(outDir, id + ".bg.gz"), gzipSync(bg));
  writeFileSync(join(outDir, id + ".jpg"), Buffer.from(r.jpeg.split(",")[1], "base64"));
  delete r.categories; delete r.background; delete r.jpeg;
  r.source = rel;
  writeFileSync(target, JSON.stringify(r));
  n++;
  console.log(`${n} ${rel} faces=${r.faces} low=${r.lowFaces} pose=${!!r.pose} ms=${JSON.stringify(Object.fromEntries(Object.entries(r.ms).map(([k, v]) => [k, Math.round(v)])))}`);
}
await browser.close();
