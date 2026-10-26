// Layout probe: for each lesson at one window size, the stage rows (figure / widget), whether the widget's content
// fits its row or overflows it (and whether the row scrolls), and the figure frame's size.
//   node scripts/layout-probe.mjs [base] [w] [h] [lessons]
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromePort } from "../../anatomy/scripts/chrome-port.mjs";
const [base = "http://127.0.0.1:4361", w = "1024", h = "768", list = "1,2,3,4,5,6,7,8,9"] = process.argv.slice(2);
const IDS = { 1: "meet-flexitac", 2: "the-sandwich", 3: "electrodes-slots-beam", 4: "one-crossing", 5: "voltage-divider", 6: "volts-to-byte", 7: "drive-32-lines", 8: "listen-12-lines", 9: "one-frame", 10: "flash-firmware", 11: "bytes-to-touch", 12: "build-your-own" };
const profile = mkdtempSync(join(tmpdir(), "lf-lp-"));
const chrome = spawn("/usr/bin/google-chrome", ["--headless=new", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "--no-first-run", "--hide-scrollbars", "about:blank"], { stdio: ["ignore", "ignore", "pipe"] });
const port = await chromePort(chrome, profile);
const t = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((x) => x.type === "page");
const ws = new WebSocket(t.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r));
let id = 0; const pend = new Map();
ws.addEventListener("message", (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (x) => (await send("Runtime.evaluate", { expression: x, returnByValue: true, awaitPromise: true })).result?.result?.value;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
await send("Emulation.setDeviceMetricsOverride", { width: +w, height: +h, deviceScaleFactor: 1, mobile: false });
for (const n of list.split(",").map(Number)) {
  await send("Page.navigate", { url: `${base}/#/lesson/${IDS[n]}` });
  await wait(3500);
  const r = await ev(`JSON.stringify((()=>{const q=(s)=>{const e=document.querySelector(s);if(!e)return null;const b=e.getBoundingClientRect();return [Math.round(b.width),Math.round(b.height)]};
    const ws=document.querySelector('.widget-slot');const kid=ws?.firstElementChild;
    const over=(e)=>e?{client:e.clientHeight,scroll:e.scrollHeight,ov:getComputedStyle(e).overflowY}:null;
    const deep=kid?[...kid.querySelectorAll('*')].filter(e=>{const b=e.getBoundingClientRect();const k=kid.getBoundingClientRect();return b.height>0&&b.bottom>k.bottom+1}).length:null;
    return {stage:q('.stage-body'),fig:q('.figure-slot'),widget:q('.widget-slot'),slot:over(ws),kid:over(kid),cls:kid?.className,clippedEls:deep,page:[document.documentElement.scrollWidth,document.documentElement.scrollHeight]}})())`);
  console.log(`L${n}`, r);
}
ws.close(); chrome.kill("SIGKILL"); await wait(200); rmSync(profile, { recursive: true, force: true });
