// Clean-start + detail-window review over CDP (no npm deps).
//   npm run build && npx vite preview --port 4351 --strictPort &   then
//   node --experimental-websocket scripts/clean-review.mjs <base> <outDir> <lessonId> <w> <h> <light|dark>
// 1. Loads the lesson and captures it at rest: no "Labels" switch, no stage inspector, and (figure side) no visible
//    callout cards or hotspot dots in the figure.
// 2. Picks a part (ft:act pick, as a guided step would) and then posts ft:details for it FROM INSIDE THE IFRAME
//    (window.parent.postMessage evaluated in the figure's realm, so event.source is the figure, exactly like its
//    "Details ›" link). Falls back to a demo record when the figure does not answer the pick.
// 3. Checks the detail window: open, the panel's left/right edges, top-aligned, no taller than the panel, focus inside,
//    and that nothing else moved: the figure's iframe box, its drawing's viewBox, the panel's cards.
//    Phones / stacked: a bottom sheet inside the viewport (above the phone's bottom bar).
// 4. Escape closes it and focus returns to the figure's iframe. Prints every console error / exception.
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromePort } from "../../anatomy/scripts/chrome-port.mjs";

const [base, outDir, lessonId, w = "1440", h = "900", scheme = "light"] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const tag = `${lessonId}-${w}x${h}-${scheme}`;
const profile = mkdtempSync(join(tmpdir(), "lfc-"));
const chrome = spawn(process.env.CHROME_PATH ?? "/usr/bin/google-chrome", ["--headless=new", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "--no-first-run", "--hide-scrollbars", "--disable-gpu", "about:blank"], { stdio: ["ignore", "ignore", "pipe"] });
const port = await chromePort(chrome, profile);
const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
const ws = new WebSocket(targets.find((t) => t.type === "page").webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r));
let id = 0;
const pending = new Map();
const errors = [];
const problems = [];
const bad = (m) => { problems.push(m); console.log("  !! " + m); };
ws.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  else if (m.method === "Runtime.consoleAPICalled" && ["error", "warning", "assert"].includes(m.params.type)) errors.push(`${m.params.type}: ${m.params.args.map((a) => a.value ?? a.description).join(" ")}`);
  else if (m.method === "Runtime.exceptionThrown") errors.push(`exception: ${m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text}`);
  else if (m.method === "Log.entryAdded" && m.params.entry.level === "error") errors.push(`log: ${m.params.entry.text} ${m.params.entry.url ?? ""}`);
});
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expr) => {
  const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.result?.exceptionDetails) return { __err: r.result.exceptionDetails.exception?.description };
  return r.result?.result?.value;
};
const J = async (expr) => { const v = await ev(`JSON.stringify(${expr})`); return typeof v === "string" ? JSON.parse(v) : v; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = async (name) => {
  const r = await send("Page.captureScreenshot", { format: "png" });
  const f = `${tag}-${name}.png`;
  writeFileSync(join(outDir, f), Buffer.from(r.result.data, "base64"));
  console.log("  saved", f);
};
const key = async (k, code, vk) => {
  await send("Input.dispatchKeyEvent", { type: "keyDown", key: k, code, windowsVirtualKeyCode: vk });
  await send("Input.dispatchKeyEvent", { type: "keyUp", key: k, code, windowsVirtualKeyCode: vk });
};

const mobile = Number(w) <= 600;
await send("Runtime.enable"); await send("Log.enable"); await send("Page.enable");
await send("Emulation.setDeviceMetricsOverride", { width: Number(w), height: Number(h), deviceScaleFactor: 1, mobile });
if (mobile) await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 2 });
await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: scheme }, { name: "prefers-reduced-motion", value: process.env.REDUCED ? "reduce" : "no-preference" }] });
await send("Page.addScriptToEvaluateOnNewDocument", {
  source: `if(window.parent===window){window.__ftlog=[];addEventListener('message',e=>{const d=e.data;if(d&&typeof d.type==='string'&&d.type.startsWith('ft:'))__ftlog.push(JSON.parse(JSON.stringify(d)))});}`,
});
await send("Page.navigate", { url: `${base}/#/lesson/${lessonId}` });
const t0 = Date.now();
let status = null;
while (Date.now() - t0 < 12000) {
  status = await ev(`document.querySelector('.figure-slot')?.dataset.status ?? 'nofig'`);
  if (status === "ready" || (status === "nofig" && Date.now() - t0 > 2500)) break;
  await wait(200);
}
await wait(2200); // the figure settles (fonts, first fit, reveal hint fade-in)
console.log(`[${tag}] status=${status} in ${Date.now() - t0} ms`);
if (status !== "ready") bad(`figure status ${status}`);

const F = `document.querySelector('.figure-frame')`;
const FD = `${F}.contentDocument`;
const rect = (sel) => `(()=>{const e=${sel};if(!e)return null;const r=e.getBoundingClientRect();return [r.left,r.top,r.width,r.height].map(v=>Math.round(v*10)/10)})()`;
// the figure's camera: the main drawing's viewBox (the first big svg in the figure)
const camera = () => J(`(()=>{const d=${FD};if(!d)return null;const s=[...d.querySelectorAll('svg[viewBox]')].sort((a,b)=>b.getBoundingClientRect().width*b.getBoundingClientRect().height-a.getBoundingClientRect().width*a.getBoundingClientRect().height)[0];return s?s.getAttribute('viewBox'):null})()`);
const visible = (sel) => `[...${FD}.querySelectorAll('${sel}')].filter(e=>{const r=e.getBoundingClientRect();const s=getComputedStyle(e);return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none'&&+s.opacity>0.1}).length`;

// ---------------------------------------------------------------- 1. clean start
const rest = await J(`({labels:!!document.querySelector('.labels-toggle'),inspector:!!document.querySelector('.inspector'),details:document.querySelector('.details')?(document.querySelector('.details').hidden?'hidden':'OPEN'):'none',callouts:${visible(".ft-callout")},dots:${visible(".ft-hotspot")},hint:${visible(".ft-reveal")},src:${F}.getAttribute('src'),sw:document.documentElement.scrollWidth,vw:innerWidth})`);
console.log("  at rest:", JSON.stringify(rest));
if (rest.labels) bad("a Labels switch is on the page");
if (rest.inspector) bad("the old stage inspector is on the page");
if (rest.details === "OPEN") bad("detail window open at rest");
if (rest.callouts || rest.dots) console.log(`  (figure side) ${rest.callouts} callout card(s), ${rest.dots} hotspot dot(s) visible at rest`);
if (rest.sw > rest.vw + 1) bad(`horizontal scroll ${rest.sw} > ${rest.vw}`);
if (mobile) { await ev(`window.scrollTo(0,0)`); await wait(300); }
await shot("1-initial");

// ---------------------------------------------------------------- 2. pick + ft:details from inside the iframe
const fig = await ev(`(__ftlog.find(m=>m.type==='ft:ready')||{}).fig||null`);
const parts = await J(`(__ftlog.find(m=>m.type==='ft:parts')||{}).parts||[]`);
const want = { pad: "velostat", crossing: "r1", board: "u2" }[fig] ?? parts[0]?.id;
let before = await ev(`__ftlog.length`);
if (want) await ev(`${F}.contentWindow.postMessage({type:'ft:act',name:'pick',arg:${JSON.stringify(want)}},'*')`);
await wait(1600);
let part = await J(`(()=>{const m=__ftlog.slice(${before}).reverse().find(m=>m.type==='ft:pick'&&m.part);return m?m.part:null})()`);
if (!part) {
  console.log("  (figure did not answer the pick: using a demo record)");
  part = { id: want ?? "demo", title: "Velostat", icon: "film", short: "Pressure-sensitive carbon film", lesson: 2,
    intro: "A thin black plastic film filled with carbon. Pressing it squeezes the carbon grains together, so its resistance drops.",
    facts: [{ label: "Thickness", value: "0.1 mm", src: "material/2604.28156v1.pdf Sec 3.1" }, { label: "Resistance", value: "falls as you press", src: "computed", badge: "illustrative" }] };
}
console.log(`  picked ${part.id} (${part.title}), lesson ${part.lesson}, facts ${part.facts?.length ?? 0}`);
// the frame is the reference for "nothing moved": measured after the pick (a pick may expand Fig 1 or zoom, which is
// the figure's business) and before the detail window
await wait(400);
const cam0 = await camera();
const frame0 = await J(rect(F));
const info0 = await J(rect(`document.querySelector('.info-card')`));
const code0 = await J(rect(`document.querySelector('.code-card')`));
const panel = await J(rect(`document.querySelector('.panel')`));
if (process.env.ALL) await shot("2-picked");
before = await ev(`__ftlog.length`);
const inFrame = `parent.postMessage(${JSON.stringify({ type: "ft:details", fig, part })},'*')`;
await ev(`${F}.contentWindow.eval(${JSON.stringify(inFrame)})`);
await wait(700);
const det = await J(`(()=>{const d=document.querySelector('.details');if(!d||d.hidden)return null;const r=d.getBoundingClientRect();const s=getComputedStyle(d);return {box:[r.left,r.top,r.width,r.height].map(v=>Math.round(v*10)/10),position:s.position,opacity:+s.opacity,title:d.querySelector('.det-title')?.textContent,facts:d.querySelectorAll('.det-fact').length,chips:d.querySelectorAll('.chip').length,badges:d.querySelectorAll('.badge').length,lesson:d.querySelector('.det-lesson')?.textContent.trim().replace(/\\s+/g,' ')??null,focusIn:d.contains(document.activeElement),scrollH:d.scrollHeight,clientH:d.clientHeight,vh:innerHeight,vw:innerWidth}})()`);
console.log("  details:", JSON.stringify(det));
if (!det) bad("detail window did not open on ft:details");
else {
  if (det.title !== part.title) bad(`detail title ${det.title} vs ${part.title}`);
  if (!det.focusIn) bad("focus did not move into the detail window");
  if (det.position === "absolute") {
    // desktop: over the right panel column
    const [l, t, ww, hh] = det.box;
    const [pl, pt, pw, ph] = panel;
    if (Math.abs(l - pl) > 1 || Math.abs(l + ww - (pl + pw)) > 1) bad(`detail edges ${l}..${l + ww} vs panel ${pl}..${pl + pw}`);
    if (Math.abs(t - pt) > 1) bad(`detail top ${t} vs panel ${pt}`);
    if (hh > ph + 1) bad(`detail height ${hh} > panel ${ph}`);
  } else {
    const [l, t, ww, hh] = det.box;
    if (l < 0 || l + ww > det.vw + 0.5 || t < 0 || t + hh > det.vh + 0.5) bad(`sheet off-screen ${det.box}`);
    if (mobile) {
      const bar = await J(rect(`document.querySelector('.sidebar')`));
      if (bar && t + hh > bar[1] + 0.5) bad(`sheet under the bottom bar: ${t + hh} > ${bar[1]}`);
    }
  }
}
const cam1 = await camera();
const frame1 = await J(rect(F));
const info1 = await J(rect(`document.querySelector('.info-card')`));
const code1 = await J(rect(`document.querySelector('.code-card')`));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
console.log(`  camera ${cam0} -> ${cam1}; frame ${frame0} -> ${frame1}`);
if (!same(frame0, frame1)) bad(`figure frame moved ${frame0} -> ${frame1}`);
if (cam0 !== cam1) bad(`figure camera changed ${cam0} -> ${cam1}`);
if (!same(info0, info1) || !same(code0, code1)) bad(`panel reflowed: info ${info0} -> ${info1}, code ${code0} -> ${code1}`);
await shot("3-details");

// another pick while open swaps the content (a guided step's select / a click on another part)
const other = parts.find((p) => p.id !== part.id);
if (other && det) {
  await ev(`${F}.contentWindow.postMessage({type:'ft:act',name:'pick',arg:${JSON.stringify(other.id)}},'*')`);
  await wait(1200);
  const t2 = await ev(`document.querySelector('.details:not([hidden]) .det-title')?.textContent ?? null`);
  const got = await J(`(()=>{const m=[...__ftlog].reverse().find(m=>m.type==='ft:pick');return m?m.part&&m.part.id:null})()`);
  console.log(`  pick ${other.id} while open -> figure ft:pick ${got}, window title: ${t2}`);
  if (got === other.id && t2 !== other.title) bad(`window did not follow the pick (${t2} vs ${other.title})`);
  if (got === other.id) await shot("4-swapped");
}

// ---------------------------------------------------------------- 4. Escape closes, focus back to the figure
if (det) {
  await ev(`document.querySelector('.details .det-title')?.focus()`);
  await key("Escape", "Escape", 27);
  await wait(500);
  const after = await J(`({open:!!document.querySelector('.details')&&!document.querySelector('.details').hidden,focus:document.activeElement===${F}})`);
  console.log("  after Escape:", JSON.stringify(after));
  if (after.open) bad("Escape did not close the detail window");
  if (!after.focus) bad("focus did not return to the figure");
  // and × does the same
  await ev(`${F}.contentWindow.eval(${JSON.stringify(inFrame)})`);
  await wait(500);
  await ev(`document.querySelector('.details .det-close')?.click()`);
  await wait(500);
  const x = await J(`({open:!!document.querySelector('.details')&&!document.querySelector('.details').hidden,focus:document.activeElement===${F}})`);
  console.log("  after ×:", JSON.stringify(x));
  if (x.open || !x.focus) bad("× did not close / return focus");
}
const hs = await J(`({sw:document.documentElement.scrollWidth,w:innerWidth})`);
if (hs.sw > hs.w + 1) bad(`horizontal scroll at end ${hs.sw} > ${hs.w}`);
console.log(errors.length ? "  CONSOLE:\n    " + errors.join("\n    ") : "  console: clean");
if (errors.length) problems.push(...errors.map((e) => "console " + e));
console.log(`  RESULT ${tag} ${problems.length ? "PROBLEMS " + problems.length : "OK"}`);
ws.close();
chrome.kill("SIGKILL");
await wait(300);
rmSync(profile, { recursive: true, force: true });
process.exit(0);
