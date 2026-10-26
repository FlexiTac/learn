// Smoke test over CDP (no npm deps): drives a lesson in headless Chrome and prints the figure bridge log,
// guided-step states, Run output, theme-toggle replay, quiz result and every console error/exception.
//   npm run preview -- --port 4317 &   then
//   node --experimental-websocket scripts/check.mjs "http://localhost:4317/#/lesson/meet-flexitac" /tmp/shots 1440 900 light steps
//   modes: steps (lesson 1 flow) | heat (lesson 11 widget) | pick (explore mode: pick a part, detail window, Esc)
//          | page (screenshot only).  REDUCED=1 emulates reduced motion, FULL=1 captures the whole page.
//   pick: if the figure announces its parts (ft:parts), its first part is picked with ft:act pick (as a guided step
//   would); otherwise ft:parts / ft:pick are posted from inside the iframe (window.parent.postMessage). Then ft:details
//   is posted from inside the iframe (what the label's "Details ›" link sends) and the detail window is checked.
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromePort } from "../../anatomy/scripts/chrome-port.mjs";
import { mkdirSync } from "node:fs";

const [url, outDir, w = "1440", h = "900", scheme = "light", mode = "steps"] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const profile = mkdtempSync(join(tmpdir(), "lf-"));
const chrome = spawn(process.env.CHROME_PATH ?? "/usr/bin/google-chrome", ["--headless=new", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "--no-first-run", "--hide-scrollbars", "--disable-gpu", "about:blank"], { stdio: ["ignore", "ignore", "pipe"] });
const port = await chromePort(chrome, profile);
const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
const ws = new WebSocket(targets.find((t) => t.type === "page").webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r));
let id = 0;
const pending = new Map();
const errors = [];
ws.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) {
    pending.get(m.id)(m);
    pending.delete(m.id);
  } else if (m.method === "Runtime.consoleAPICalled" && ["error", "warning", "assert"].includes(m.params.type)) errors.push(`${m.params.type}: ${m.params.args.map((a) => a.value ?? a.description).join(" ")}`);
  else if (m.method === "Runtime.exceptionThrown") errors.push(`exception: ${m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text}`);
  else if (m.method === "Log.entryAdded" && m.params.entry.level === "error") errors.push(`log: ${m.params.entry.text} ${m.params.entry.url ?? ""}`);
});
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expr) => (await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true })).result?.result?.value;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = async (name) => {
  // FULL=1: the whole page, not just the viewport.
  const full = process.env.FULL ? JSON.parse(await ev(`JSON.stringify({w:document.documentElement.scrollWidth,h:document.documentElement.scrollHeight})`)) : null;
  const r = await send("Page.captureScreenshot", full ? { format: "png", captureBeyondViewport: true, clip: { x: 0, y: 0, width: full.w, height: full.h, scale: 1 } } : { format: "png" });
  writeFileSync(join(outDir, name), Buffer.from(r.result.data, "base64"));
  console.log("saved", name);
};
await send("Runtime.enable");
await send("Log.enable");
await send("Page.enable");
const mobile = Number(w) <= 600;
await send("Emulation.setDeviceMetricsOverride", { width: Number(w), height: Number(h), deviceScaleFactor: 1, mobile });
if (mobile) await send("Emulation.setTouchEmulationEnabled", { enabled: true });
await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: scheme }, { name: "prefers-reduced-motion", value: process.env.REDUCED ? "reduce" : "no-preference" }] });
await send("Page.addScriptToEvaluateOnNewDocument", {
  source: `window.__ftlog=[];addEventListener('message',e=>{const d=e.data;if(d&&typeof d.type==='string'&&d.type.startsWith('ft:'))__ftlog.push({type:d.type,fig:d.fig,actions:d.actions,mode:d.mode,size:d.size||(d.width?{width:d.width,height:d.height}:null),state:d.state,message:d.message,parts:d.parts,part:d.part})});`,
});
await send("Page.navigate", { url });
await wait(4500);
const last = () => ev(`(()=>{const s=[...__ftlog].reverse().find(m=>m.state&&m.type!=='ft:ready')||[...__ftlog].reverse().find(m=>m.state);return JSON.stringify(s?{apart:s.state.apart,selected:s.state.selected,plan:s.state.plan,touch:s.state.touch,readout:s.state.readout}:null)})()`);
const summary = () => ev(`JSON.stringify(__ftlog.filter(m=>m.type!=='ft:state').map(m=>({type:m.type,fig:m.fig,mode:m.mode,size:m.size,actions:m.actions&&m.actions.length,message:m.message})))`);
console.log("bridge:", await summary());
console.log("figure status:", await ev(`document.querySelector('.figure-slot')?.dataset.status`));
if (mode === "steps") {
  await shot("00-loaded.png");
  // Show me / Next step until Done (a step with a `show` takes two presses: its pose, then its Show me)
  for (let k = 0; k < 8 && !(await ev(`document.querySelector('[data-go]').disabled`)); k++) {
    await ev(`document.querySelector('[data-go]').click()`);
    await wait(2200);
    console.log(`after press ${k + 1}:`, await last(), "| bar:", await ev(`document.querySelector('.steps-kicker').textContent+' / '+document.querySelector('[data-go]').innerText`));
    await shot(`0${k + 1}-step.png`);
  }
  console.log("progress:", await ev(`document.querySelector('.progress-count').textContent`));
  // Run with edited params
  await ev(`(()=>{const i=document.querySelector('input[data-param=row]');i.value='9';i.dispatchEvent(new Event('input',{bubbles:true}));i.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", modifiers: 2, windowsVirtualKeyCode: 13 });
  await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", modifiers: 2, windowsVirtualKeyCode: 13 });
  await wait(2000);
  console.log("console:", await ev(`document.querySelector('.console').innerText`));
  console.log("after run:", await last());
  await shot("04-run.png");
  // theme toggle -> reload other build + replay
  await ev(`document.querySelector('[data-theme-toggle]').click()`);
  await wait(4500);
  console.log("bridge after toggle:", await summary());
  console.log("after toggle:", await last(), "theme:", await ev(`document.documentElement.dataset.theme`), "src:", await ev(`document.querySelector('iframe').getAttribute('src')`));
  await shot("05-toggled.png");
  // quiz
  await ev(`(()=>{for(const [i,a] of [[0,1],[1,1],[2,3]]){const r=document.querySelectorAll('[data-q="'+i+'"] input')[a];r.checked=true;r.dispatchEvent(new Event('change',{bubbles:true}));}})()`);
  await wait(300);
  console.log("quiz:", await ev(`document.querySelector('.quiz-score').textContent`), "| storage:", await ev(`localStorage.getItem('learn-flexitac:v1')`));
} else if (mode === "heat") {
  await wait(500);
  await ev(`document.querySelector('[data-run]').click()`);
  const box = JSON.parse(await ev(`JSON.stringify(document.querySelector('.w-heat-canvas').getBoundingClientRect())`));
  const x = box.x + box.width * 0.4, y = box.y + box.height * 0.5;
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
  for (let k = 0; k < 10; k++) { await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: x + k * 6, y, button: "left", buttons: 1 }); await wait(60); }
  await wait(900);
  console.log("readout:", await ev(`document.querySelector('.w-heat-read').textContent`), "| console:", await ev(`document.querySelector('.console').innerText`));
  await shot("heat.png");
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: x + 60, y, button: "left", clickCount: 1 });
} else if (mode === "pick") {
  const fig = await ev(`(()=>{const f=__ftlog.find(m=>m.type==='ft:ready');return f?f.fig:null})()`);
  const real = await ev(`__ftlog.some(m=>m.type==='ft:parts')`);
  console.log("figure:", fig, "| emits ft:parts:", real, "| parts:", await ev(`JSON.stringify((__ftlog.find(m=>m.type==='ft:parts')||{}).parts?.map(p=>p.id)??null)`));
  console.log("clean start:", await ev(`JSON.stringify({labelsSwitch:!!document.querySelector('.labels-toggle'),details:!!document.querySelector('.details:not([hidden])')})`));
  await shot("pick-0-loaded.png");
  let part = null;
  if (real) {
    const first = await ev(`(__ftlog.find(m=>m.type==='ft:parts')).parts[0].id`);
    await ev(`document.querySelector('.figure-frame').contentWindow.postMessage({type:'ft:act',name:'pick',arg:${JSON.stringify(first)}},'*')`);
    await wait(1200);
    part = JSON.parse((await ev(`JSON.stringify([...__ftlog].reverse().find(m=>m.type==='ft:pick'&&m.part)?.part??null)`)) ?? "null");
  }
  if (!part) {
    part = { id: "demo", title: "Velostat", icon: "film", short: "Pressure-sensitive carbon film", lesson: 2,
      intro: "A thin black plastic film filled with carbon. Pressing it squeezes the carbon grains together, so its resistance drops. In FlexiTac it sits between the two copper grids.",
      facts: [{ label: "Thickness", value: "0.1 mm", src: "material/2604.28156v1.pdf Sec 3.1" }, { label: "Resistance", value: "falls as you press", src: "computed", badge: "illustrative" }] };
    // Posted from inside the iframe's realm (eval there), so event.source is the iframe window, as for the real figure.
    const inFrame = `parent.postMessage(${JSON.stringify({ type: "ft:parts", fig, parts: [{ id: part.id, title: part.title, icon: part.icon, short: part.short, lesson: part.lesson }] })},'*');parent.postMessage(${JSON.stringify({ type: "ft:pick", fig, part })},'*');`;
    await ev(`document.querySelector('.figure-frame').contentWindow.eval(${JSON.stringify(inFrame)})`);
    await wait(400);
  }
  // what the label's "Details ›" link sends
  await ev(`document.querySelector('.figure-frame').contentWindow.eval(${JSON.stringify(`parent.postMessage(${JSON.stringify({ type: "ft:details", fig, part })},'*')`)})`);
  await wait(900);
  const card = () => ev(`(()=>{const i=document.querySelector('.details');if(!i||i.hidden)return 'closed';const r=i.getBoundingClientRect();return JSON.stringify({title:i.querySelector('.det-title')?.textContent,facts:i.querySelectorAll('.det-fact').length,lesson:i.querySelector('.det-lesson')?.textContent.trim()??null,box:[r.left,r.top,r.width,r.height].map(Math.round),position:getComputedStyle(i).position,focusInside:i.contains(document.activeElement)})})()`);
  console.log("detail window:", await card());
  await shot("pick-1-details.png");
  await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await wait(700);
  console.log("after Esc:", await card(), "| focus on figure:", await ev(`document.activeElement===document.querySelector('.figure-frame')`), "| last pick from figure:", await ev(`JSON.stringify([...__ftlog].reverse().find(m=>m.type==='ft:pick')?.part?.id??null)`));
  await shot("pick-2-closed.png");
} else {
  await shot("page.png");
  const full = await ev(`JSON.stringify({h:document.documentElement.scrollHeight,sw:document.documentElement.scrollWidth,w:innerWidth})`);
  console.log("page:", full);
}
console.log(errors.length ? "ERRORS:\n  " + errors.join("\n  ") : "console: clean");
ws.close();
chrome.kill("SIGKILL");
await wait(300);
rmSync(profile, { recursive: true, force: true });
process.exit(0);
