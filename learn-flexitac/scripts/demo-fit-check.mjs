// Demo-card fit check over CDP (no npm deps): on phone-sized screens (320-430 px wide, touch, a phone's user agent),
// Lesson 1.2's four demo cards (velostat, unit, grid, pad: src/ui/demo.ts "beside") must sit inside the figure's slot:
// a card that reaches below it lies over the steps bar (its buttons over "Next step"). Walks each step by its dot, in
// English and Chinese, and prints one line per card; exits 1 if any card's bottom is below the slot's bottom (or no
// card shows).
//   npm run preview -- --port 4317 &   then
//   node --experimental-websocket scripts/demo-fit-check.mjs "http://localhost:4317/"
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromePort } from "../../anatomy/scripts/chrome-port.mjs";

const base = (process.argv[2] ?? "http://localhost:4317/").replace(/#.*$/, "");
const PHONES = [
  [320, 568, 2],
  [360, 780, 3],
  [390, 844, 3],
  [430, 932, 3],
];
const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const profile = mkdtempSync(join(tmpdir(), "lf-fit-"));
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
const ev = async (expr) => (await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true })).result?.result?.value;
await send("Runtime.enable");
await send("Page.enable");
await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
await send("Emulation.setUserAgentOverride", { userAgent: UA, platform: "iPhone" });

let bad = 0;
for (const [w, h, dpr] of PHONES) {
  await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: dpr, mobile: true });
  for (const lang of ["en", "zh"]) {
    await send("Page.navigate", { url: `${base}${lang === "zh" ? "?lang=zh" : ""}#/lesson/the-sandwich` });
    await wait(4500);
    for (let k = 0; k < 4; k++) {
      if (k > 0) {
        await ev(`document.querySelector('.step-dot[data-k="${k}"]')?.click()`);
        await wait(4500);
      }
      const r = await ev(`(()=>{const c=document.querySelector(".demo-card.is-on:not(.is-waiting)");const s=document.querySelector(".figure-slot");if(!c||!s)return null;const a=c.getBoundingClientRect(),b=s.getBoundingClientRect();return {demo:c.dataset.demo,bottom:Math.round(a.bottom),slot:Math.round(b.bottom),h:Math.round(a.height)}})()`);
      const ok = Boolean(r && r.bottom <= r.slot + 0.5);
      if (!ok) bad++;
      console.log(`${ok ? "ok  " : "FAIL"} ${w}x${h} ${lang} step ${k + 1}: ${r ? `${r.demo} card ${r.h} px tall, bottom ${r.bottom} / figure slot ${r.slot}` : "no card"}`);
    }
  }
}
ws.close();
chrome.kill("SIGKILL");
await wait(300);
rmSync(profile, { recursive: true, force: true });
console.log(bad ? `${bad} card(s) reach below the figure` : "every card sits inside the figure");
process.exit(bad ? 1 : 0);
