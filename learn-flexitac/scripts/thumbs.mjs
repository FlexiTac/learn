// Lesson and home thumbnails -> public/thumbs/*.webp (WebP, ~560 px wide, both themes where it matters)
//   npm run thumbs        (needs Chrome and ffmpeg; run after `npm run sync-figures`)
//   npm run thumbs -- --only L01[,pad,...]   only these (the others stay as they are)
//   ... --png <dir>      also keep each picture as PNG in <dir> (to look at)
//   ... --lang zh        the Chinese pictures of the poses with words (L01, L04): <name>-zh-<theme>.webp
// - <fig>-<light|dark>.webp      the three figure cards on the home page (hero pose)
// - L<nn>-<light|dark>.webp      one per figure lesson (1-4), each in a pose that shows that lesson's idea
// - L05.webp                     a heatmap rendered from the shared scan model (a two-finger press, normalised, viridis)
// - L06.webp                     a frame of the build footage (public/media/clips), same in both themes: lesson 6 (Build
//                                your own), the connectors going on
// Figures are driven through their film contract (?record: window.__film.reset/act/step), so poses are exact.
// Thumbnails are committed, so this only needs re-running when a figure changes a lot.
import { execFileSync, spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const shared = process.env.FLEXITAC_SHARED ?? resolve(root, "../flexitac-anatomy/shared");
const { chromePort } = await import(pathToFileURL(resolve(root, "../anatomy/scripts/chrome-port.mjs")).href);
const { frameBytes } = await import(pathToFileURL(join(shared, "models/scan.mjs")).href);
const { VIRIDIS_RGB } = await import(pathToFileURL(join(shared, "models/viridis.mjs")).href);
const { ROWS, COLS } = await import(pathToFileURL(join(shared, "data/constants.mjs")).href);

const argv = process.argv.slice(2);
const argOf = (n) => (argv.includes(`--${n}`) ? argv[argv.indexOf(`--${n}`) + 1] : null);
// --lang zh: the Chinese pictures of the figure poses with words in them (the touch map's titles and legends): L01,
// L04 -> <name>-zh-<theme>.webp, the figure drawn with ?lang=zh. Nothing else is written then (the English files and
// the pictures without words stay as they are; the site shows the English file for those).
const LANG = argOf("lang") === "zh" ? "zh" : "en";
const ZH_NAMES = ["L01", "L04"];
const only0 = argOf("only") ? new Set(argOf("only").split(",")) : null;
const only = LANG === "zh" ? new Set(ZH_NAMES.filter((n) => !only0 || only0.has(n))) : only0;
const want = (name) => !only || only.has(name);
const keepPng = argOf("png") ? resolve(argOf("png")) : null;
if (keepPng) mkdirSync(keepPng, { recursive: true });
const out = join(root, "public/thumbs");
const tmp = mkdtempSync(join(tmpdir(), "lf-thumbs-"));
mkdirSync(out, { recursive: true });
const WIDTH = 560;
const webp = (src, dst, extra = []) =>
  execFileSync("ffmpeg", ["-v", "error", "-y", "-i", src, ...extra, "-vf", `scale=${WIDTH}:-2:flags=lanczos`, "-c:v", "libwebp", "-quality", "72", "-compression_level", "6", dst]);

// ------------------------------------------------------------------ figure poses
// name -> figure, acts (after reset; ["wait", s] lets the film run s seconds before the next act), seconds to let
// springs settle, optional zoom (fractions of the stage box; it may reach above the box, where the lifted Nano is drawn),
// bare (hide the card's corner texts, which a zoom reaching above the box would catch)
const POSES = {
  pad: { fig: "pad", acts: [] }, // hero pose (exploded, Bottom FPC picked)
  crossing: { fig: "crossing", acts: [] },
  board: { fig: "board", acts: [] },
  // lesson 1 opens on "Feel it": the plan view in feel mode, a fingertip pressing, the touch map lit on the left
  L01: { fig: "pad", acts: [["feel", true], ["press", { sense: 3.6, drive: 20.4, amount: 1 }]] },
  L02: { fig: "pad", acts: [["explode"], ["select", "velostat"]] },
  // lesson 3 "Meet the reading board": the board alone, the Nano lifted and see-through on its short floating pins, the
  // chips under it in view (no scan: the board at power-on)
  L03: { fig: "board", acts: [["reset"], ["lift"]], zoom: [0, -0.05, 1, 1.05], bare: true },
  // lesson 4 "One frame": the pad plugged in, a finger on it, the map part-way through a frame
  // (the finger presses fully before the scan reads its rows, so the map lights where it presses)
  L04: { fig: "board", acts: [["reset"], ["lift"], ["connect", "instant"], ["press", { sense: 6.4, drive: 20.6, amount: 1 }], ["wait", 1.5], ["seek", 1], ["seek", 300]], settle: 2 },
};

const profile = mkdtempSync(join(tmpdir(), "lf-chrome-"));
const chrome = spawn(process.env.CHROME_PATH ?? "/usr/bin/google-chrome", ["--headless=new", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "--no-first-run", "--hide-scrollbars", "--disable-gpu", "about:blank"], { stdio: ["ignore", "ignore", "pipe"] });
const port = await chromePort(chrome, profile);
const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
const ws = new WebSocket(targets.find((t) => t.type === "page").webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r));
let id = 0;
const pending = new Map();
ws.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) {
    pending.get(m.id)(m);
    pending.delete(m.id);
  }
});
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expr) => {
  const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description ?? r.result.exceptionDetails.text);
  return r.result?.result?.value;
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
await send("Page.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 1100, height: 900, deviceScaleFactor: 1, mobile: false });

for (const [name, pose] of Object.entries(POSES)) {
  if (!want(name)) continue;
  for (const theme of ["light", "dark"]) {
    const file = join(root, "public/figures", `${pose.fig}${theme === "light" ? "-light" : ""}.html`);
    const hero = !pose.acts.length;
    const query = [hero ? "" : "record", LANG === "zh" ? "lang=zh" : ""].filter(Boolean).join("&");
    await send("Page.navigate", { url: `${pathToFileURL(file).href}${query ? `?${query}` : ""}` });
    await wait(hero ? 3000 : 1500);
    // The plain page is in explore mode: hide its site-style overlays (viewbar, hotspot dots, callouts) for the
    // picture. ?record pages never draw them.
    if (hero) await ev(`(()=>{const s=document.createElement('style');s.textContent='.ft-viewbar,.ft-hotspot,.ft-hotspots,.ft-callout,.ft-callouts,.ft-leader,.ft-leaders{display:none!important}';document.head.append(s);})()`);
    if (pose.bare) await ev(`(()=>{const s=document.createElement('style');s.textContent='.iso-plate-corners{display:none!important}';document.head.append(s);})()`);
    if (!hero) {
      const acts = JSON.stringify(pose.acts);
      await ev(`(async()=>{const f=window.__film;f.reset();for(const [n,a] of ${acts}){if(n==="wait"){for(let i=0;i<Math.round(a*60);i++) f.step(1/60);}else f.act(n,a);}const n=Math.round(${pose.settle ?? 2.5}*60);for(let i=0;i<n;i++) f.step(1/60);})()`);
      await wait(200);
    }
    const box = await ev(`(()=>{const e=document.querySelector('.pd-stage, .iso-stage');const r=e.getBoundingClientRect();return {x:r.left+scrollX,y:r.top+scrollY,w:r.width,h:r.height}})()`);
    const [zx, zy, zw, zh] = pose.zoom ?? [0, 0, 1, 1];
    const clip = { x: box.x + box.w * zx, y: box.y + box.h * zy, width: box.w * zw, height: box.h * zh, scale: pose.zoom ? 2 : 1 };
    const r = await send("Page.captureScreenshot", { format: "png", clip, captureBeyondViewport: true });
    const tag = `${LANG === "zh" ? `${name}-zh` : name}-${theme}`;
    const png = join(tmp, `${tag}.png`);
    writeFileSync(png, Buffer.from(r.result.data, "base64"));
    if (keepPng) writeFileSync(join(keepPng, `${tag}.png`), Buffer.from(r.result.data, "base64"));
    webp(png, join(out, `${tag}.webp`));
    console.log("thumb", tag);
  }
}
ws.close();
// (and wait for it to exit, so its profile can be removed at the end)
const exited = new Promise((r) => (chrome.exitCode !== null ? r() : chrome.once("exit", r)));
chrome.kill();
await exited;

// ------------------------------------------------------------------ footage frame (lesson 6)
if (want("L06")) webp(join(root, "public/media/clips/step4-connect.jpg"), join(out, "L06.webp"));

// ------------------------------------------------------------------ heatmap (lesson 5), from the shared models
const blob = (r, c, r0, c0, s, k) => k * Math.exp(-((r - r0) ** 2 / (2 * s * s) + ((c - c0) * 0.75) ** 2 / (2 * s * s)));
const bytes = frameBytes((r, c) => Math.min(1, blob(r, c, 4.5, 9, 1.6, 0.95) + blob(r, c, 7, 22, 2, 0.75)));
const vals = Array.from(bytes.slice(2));
const lo = Math.min(...vals);
const hi = Math.max(...vals);
const rgb = Buffer.alloc(ROWS * COLS * 3);
vals.forEach((v, i) => rgb.set(VIRIDIS_RGB[Math.round(((v - lo) / (hi - lo || 1)) * 255)], i * 3));
const raw = join(tmp, "heat.rgb");
writeFileSync(raw, rgb);
if (want("L05")) execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", `${COLS}x${ROWS}`, "-i", raw, "-vf", `scale=${WIDTH}:${Math.round((WIDTH * ROWS) / COLS)}:flags=neighbor`, "-c:v", "libwebp", "-quality", "80", join(out, "L05.webp")]);

rmSync(tmp, { recursive: true, force: true });
// (Chrome may still be writing its profile as it exits: retry for a moment)
rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
console.log("thumbs: wrote public/thumbs/*.webp");
process.exit(0);
