// The home page's cover for "From parts to robot" (Lessons 1.5-1.6): every part of one FlexiTac laid out on Lesson 1.5's
// bench, seen from straight above (scripts/covers.html?w=parts, the layout is there; the bench is
// src/widgets/assemble3d/scene.ts, shoot()).
//   public/media/covers/parts-{light,dark}.webp   880 x 605 (16 : 11, the home cards' picture box), no words in it
// Drawn at twice that size and scaled down. Needs Chrome, ffmpeg and THIS SITE'S DEV SERVER (it serves covers.html):
//   npx vite --port 8975 --strictPort     then     node scripts/cover-parts.mjs [--port 8975] [--png <dir>]
// Self-contained (Chrome's DevTools protocol over Node's WebSocket), unlike scripts/covers.mjs, which needs the
// anatomy repo's helpers.
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const argOf = (n) => (argv.includes(`--${n}`) ? argv[argv.indexOf(`--${n}`) + 1] : null);
const base = `http://127.0.0.1:${argOf("port") ?? "8975"}`;
const keepPng = argOf("png") ? resolve(argOf("png")) : null;
if (keepPng) mkdirSync(keepPng, { recursive: true });
const out = join(root, "public/media/covers");
mkdirSync(out, { recursive: true });
const COVER = [880, 605];
const [W, H] = [COVER[0] * 2, COVER[1] * 2];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const tmp = mkdtempSync(join(tmpdir(), "lf-cover-parts-"));
const profile = join(tmp, "profile");
// (WebGL without a GPU: SwiftShader, asked for by name)
const chrome = spawn(
  process.env.CHROME_PATH ?? "/usr/bin/google-chrome",
  ["--headless=new", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "--no-first-run", "--hide-scrollbars", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "about:blank"],
  { stdio: ["ignore", "ignore", "ignore"] },
);
try {
  // Chrome writes the port it took into the profile
  const portFile = join(profile, "DevToolsActivePort");
  for (let i = 0; i < 100 && !existsSync(portFile); i++) await wait(100);
  const port = readFileSync(portFile, "utf8").split("\n")[0];
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
  const send = (method, params = {}) =>
    new Promise((r) => {
      const i = ++id;
      pending.set(i, r);
      ws.send(JSON.stringify({ id: i, method, params }));
    });
  const ev = async (expr) => {
    const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description ?? r.result.exceptionDetails.text);
    return r.result?.result?.value;
  };
  await send("Page.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: W + 40, height: H + 40, deviceScaleFactor: 1, mobile: false });

  for (const theme of ["light", "dark"]) {
    await send("Page.navigate", { url: `${base}/scripts/covers.html?w=parts&theme=${theme}&size=${W}x${H}` });
    for (let i = 0; i < 150 && !(await ev("Boolean(window.__ready && window.__scene)").catch(() => false)); i++) await wait(100);
    if (!(await ev("Boolean(window.__scene)"))) throw new Error("the bench did not come up (is the dev server running?)");
    // (the textures and the shadow map settle)
    await wait(2500);
    await ev("window.__scene.render()");
    await wait(500);
    const r = await ev(`(()=>{const e=window.__stage.getBoundingClientRect();return {x:e.left+scrollX,y:e.top+scrollY,width:e.width,height:e.height}})()`);
    const shot = await send("Page.captureScreenshot", { format: "png", clip: { ...r, scale: 1 }, captureBeyondViewport: true });
    const png = join(tmp, `parts-${theme}.png`);
    writeFileSync(png, Buffer.from(shot.result.data, "base64"));
    if (keepPng) writeFileSync(join(keepPng, `parts-${theme}.png`), Buffer.from(shot.result.data, "base64"));
    const dst = join(out, `parts-${theme}.webp`);
    execFileSync("ffmpeg", ["-v", "error", "-y", "-i", png, "-vf", `scale=${COVER[0]}:${COVER[1]}:flags=lanczos`, "-c:v", "libwebp", "-quality", "82", "-compression_level", "6", dst]);
    console.log("wrote", dst.replace(root + "/", ""));
  }
  ws.close();
} finally {
  chrome.kill();
  await wait(300);
  rmSync(tmp, { recursive: true, force: true });
}
