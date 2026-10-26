// End-to-end explore-mode review over CDP.
//   node --experimental-websocket scripts/explore-review.mjs <base> <outDir> <lessonId> <n> <w> <h> <light|dark> [linkTest]
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromePort } from "../../anatomy/scripts/chrome-port.mjs";

let [base, outDir, lessonId, nStr, w = "1440", h = "900", scheme = "light", linkTest = ""] = process.argv.slice(2);
if (linkTest === "-") linkTest = "";
const n = String(nStr).padStart(2, "0");
mkdirSync(outDir, { recursive: true });
const tag = `${w}-${scheme}-L${n}`;
const profile = mkdtempSync(join(tmpdir(), "lfr-"));
const chrome = spawn("/usr/bin/google-chrome", ["--headless=new", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "--no-first-run", "--hide-scrollbars", "--disable-gpu", "about:blank"], { stdio: ["ignore", "ignore", "pipe"] });
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
let shotN = 0;
const shot = async (name) => {
  const r = await send("Page.captureScreenshot", { format: "png" });
  const f = `${tag}-${++shotN}-${name}.png`;
  writeFileSync(join(outDir, f), Buffer.from(r.result.data, "base64"));
};
const mobile = Number(w) <= 600;
await send("Runtime.enable"); await send("Log.enable"); await send("Page.enable");
await send("Emulation.setDeviceMetricsOverride", { width: Number(w), height: Number(h), deviceScaleFactor: 1, mobile });
if (mobile) await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 2 });
await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: scheme }] });
await send("Page.addScriptToEvaluateOnNewDocument", {
  source: `if(window.parent===window){window.__ftlog=[];addEventListener('message',e=>{const d=e.data;if(d&&typeof d.type==='string'&&d.type.startsWith('ft:'))__ftlog.push(JSON.parse(JSON.stringify(d)))});}`,
});
await send("Page.navigate", { url: `${base}/#/lesson/${lessonId}` });
const t0 = Date.now();
let status = null;
while (Date.now() - t0 < 12000) {
  status = await ev(`document.querySelector('.figure-slot')?.dataset.status ?? 'nofig'`);
  if (status === "ready" || status === "nofig" && Date.now() - t0 > 2500) break;
  await wait(200);
}
await wait(1200);
const hasFig = status !== "nofig";
console.log(`[${tag}] ${lessonId} status=${status} in ${Date.now() - t0} ms`);
if (hasFig && status !== "ready") bad(`figure status ${status}`);
const accent = await ev(`getComputedStyle(document.querySelector('.lesson-view')).getPropertyValue('--accent').trim()`);
console.log("  accent:", accent);
const F = `document.querySelector('.figure-frame')`;
const FD = `${F}.contentDocument`;
const lastState = () => J(`(()=>{const s=[...__ftlog].reverse().find(m=>m.type==='ft:state'||m.type==='ft:ready');return s?s.state:null})()`);
const frameRect = () => J(`(()=>{const r=${F}.getBoundingClientRect();return {x:r.left,y:r.top,w:r.width,h:r.height}})()`);
// Scale between iframe CSS px and page px (embed=fit scales the card inside the frame, not the frame itself)
const mouse = async (type, x, y, extra = {}) => send("Input.dispatchMouseEvent", { type, x, y, button: "left", clickCount: type === "mouseMoved" ? 0 : 1, buttons: type === "mouseReleased" ? 0 : 1, ...extra });
const click = async (x, y) => {
  if (mobile) {
    await send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
    await wait(40);
    await send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  } else {
    await send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
    await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1, buttons: 1 });
    await send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
  }
};
const key = async (k, code, vk) => {
  await send("Input.dispatchKeyEvent", { type: "keyDown", key: k, code, windowsVirtualKeyCode: vk });
  await send("Input.dispatchKeyEvent", { type: "keyUp", key: k, code, windowsVirtualKeyCode: vk });
};

await shot("loaded");
// horizontal scroll
const hs = await J(`({sw:document.documentElement.scrollWidth,w:innerWidth})`);
if (hs.sw > hs.w + 1) bad(`horizontal scroll ${hs.sw} > ${hs.w}`);

if (hasFig) {
  const ready = await J(`__ftlog.filter(m=>m.type==='ft:ready').map(m=>({fig:m.fig,mode:m.mode,acts:m.actions}))`);
  const parts = await J(`(__ftlog.find(m=>m.type==='ft:parts')||{}).parts||null`);
  console.log("  ready:", ready.map((r) => `${r.fig}/${r.mode}`).join(","), "| parts:", parts ? parts.length : "NONE", "| src:", await ev(`${F}.getAttribute('src')`));
  if (!parts) bad("no ft:parts");
  // clean start: no Labels switch, no detail window, and the figure shows no callout cards or hotspot dots at rest
  const visibleIn = (sel) => J(`[...${FD}.querySelectorAll('${sel}')].filter(e=>{const r=e.getBoundingClientRect();const s=getComputedStyle(e);return r.width>0&&s.visibility!=='hidden'&&s.display!=='none'&&+s.opacity>0.1}).length`);
  const rest = { labelsSwitch: await ev(`!!document.querySelector('.labels-toggle')`), details: await ev(`!!document.querySelector('.details:not([hidden])')`), callouts: await visibleIn(".ft-callout"), dots: await visibleIn(".ft-hotspot") };
  console.log("  at rest:", JSON.stringify(rest));
  if (rest.labelsSwitch) bad("Labels switch on the page");
  if (rest.details) bad("detail window open at rest");
  if (rest.callouts || rest.dots) bad(`not clean at rest: ${rest.callouts} callout card(s), ${rest.dots} hotspot dot(s)`);
  // guided steps
  const nSteps = await ev(`document.querySelectorAll('.step-dot').length`);
  for (let k = 0; k < nSteps; k++) {
    const before = await ev(`__ftlog.length`);
    await ev(`document.querySelector('[data-go]').click()`);
    await wait(k === nSteps - 1 ? 3200 : 2400);
    const errs = await J(`__ftlog.slice(${before}).filter(m=>m.type==='ft:error').map(m=>m.name+': '+m.message)`);
    const st = await lastState();
    console.log(`  step ${k + 1}/${nSteps}: ${await ev(`document.querySelector('.steps-kicker').textContent`)} | readout: ${st?.readout ?? "-"}`);
    if (errs.length) bad(`step ${k + 1} ft:error ${errs.join("; ")}`);
    if (k === 0 && nSteps > 1) await shot("step1");
  }
  if (nSteps) await shot("steps-done");
  // scroll figure into view on phones
  if (mobile) { await ev(`${F}.scrollIntoView({block:'center'})`); await wait(400); }
  let fr = await frameRect();
  // pan + zoom inside the iframe
  const v0 = (await lastState())?.view;
  // a point on the drawing near the middle that is not a hotspot dot, callout card or the view bar (a big stage-mode
  // drawing puts dots right at the middle, and a drag that starts on a dot is a pick, not a pan)
  const free = await J(`(()=>{const a=${F}.getBoundingClientRect();const d=${FD};const ok=(x,y)=>{const e=d.elementFromPoint(x-a.left,y-a.top);return !!e&&!e.closest('.ft-hotspot,.ft-callout,.ft-viewbar,button')&&!!e.closest('svg')};for(const [fx,fy] of [[.5,.45],[.45,.5],[.55,.5],[.5,.55],[.42,.42],[.58,.42],[.5,.35],[.4,.6],[.6,.6]]){const x=a.left+a.width*fx,y=a.top+a.height*fy;if(ok(x,y))return {x,y}}return null})()`);
  const cx = free ? free.x : fr.x + fr.w * 0.5, cy = free ? free.y : fr.y + fr.h * 0.45;
  if (!mobile) {
    await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: cx, y: cy });
    for (let k = 0; k < 3; k++) { await send("Input.dispatchMouseEvent", { type: "mouseWheel", x: cx, y: cy, deltaX: 0, deltaY: -120 }); await wait(80); }
    await wait(600);
    const v1 = (await lastState())?.view;
    // drag from a spot: find an empty-ish point
    await mouse("mousePressed", cx, cy);
    for (let k = 1; k <= 8; k++) { await mouse("mouseMoved", cx + k * 12, cy + k * 5); await wait(30); }
    await mouse("mouseReleased", cx + 96, cy + 40);
    await wait(600);
    const v2 = (await lastState())?.view;
    const picked2 = (await lastState())?.picked;
    console.log(`  view: start ${JSON.stringify(v0)} wheel ${JSON.stringify(v1)} drag ${JSON.stringify(v2)} picked-after-drag ${picked2}`);
    if (!v1 || !(v1.zoom > (v0?.zoom ?? 1) + 0.05)) bad("wheel did not zoom");
    if (!v2 || (Math.abs(v2.x - v1.x) < 1 && Math.abs(v2.y - v1.y) < 1)) bad("drag did not pan");
    await shot("zoomed");
  } else {
    // pinch zoom with two touch points
    // pinch around a spot where neither finger starts on a dot / card / toolbar
    const spot = await J(`(()=>{const a=${F}.getBoundingClientRect();const d=${FD};const free=(x,y)=>{const e=d.elementFromPoint(x-a.left,y-a.top);return e&&!e.closest('.ft-hotspot,.ft-callout,.ft-viewbar')};for(let fy=0.3;fy<0.8;fy+=0.04)for(let fx=0.35;fx<0.66;fx+=0.05){const x=a.left+a.width*fx,y=a.top+a.height*fy;let ok=true;for(let k=30;k<=90;k+=5)if(!free(x-k,y)||!free(x+k,y)){ok=false;break}if(ok)return {x,y}}return null})()`);
    const px = spot ? spot.x : cx, py = spot ? spot.y : cy;
    const pts = (d) => [{ x: px - d, y: py, id: 0 }, { x: px + d, y: py, id: 1 }];
    await send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: pts(30) });
    for (let d = 35; d <= 90; d += 5) { await send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: pts(d) }); await wait(25); }
    await send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await wait(600);
    const v1 = (await lastState())?.view;
    // one-finger pan once zoomed
    await send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: cx, y: cy }] });
    for (let k = 1; k <= 8; k++) { await send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: cx + k * 8, y: cy + k * 3 }] }); await wait(30); }
    await send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await wait(600);
    const v2 = (await lastState())?.view;
    console.log(`  view (touch): start ${JSON.stringify(v0)} pinch ${JSON.stringify(v1)} pan ${JSON.stringify(v2)}`);
    if (!v1 || !(v1.zoom > (v0?.zoom ?? 1) + 0.05)) bad("pinch did not zoom");
    if (!v2 || (Math.abs(v2.x - v1.x) < 1 && Math.abs(v2.y - v1.y) < 1)) bad("one-finger pan (zoomed) did not pan");
    await shot("zoomed");
  }
  // reset via viewbar button
  const rb = await J(`(()=>{const b=[...${FD}.querySelectorAll('.ft-viewbar button')].find(b=>/reset|fit/i.test(b.getAttribute('aria-label')||''));if(!b)return null;const r=b.getBoundingClientRect(),a=${F}.getBoundingClientRect();return {x:a.left+r.left+r.width/2,y:a.top+r.top+r.height/2,label:b.getAttribute('aria-label'),vis:r.width>0}})()`);
  // the iframe might be scaled (embed=fit uses CSS scale inside the doc) -> use elementFromPoint check
  if (!rb) bad("no viewbar reset button");
  else {
    await click(rb.x, rb.y); await wait(900);
    const v3 = (await lastState())?.view;
    console.log(`  reset (${rb.label}): ${JSON.stringify(v3)}`);
    if (!v3 || Math.abs(v3.zoom - 1) > 0.01 || Math.abs(v3.x) > 0.5 || Math.abs(v3.y) > 0.5) bad(`reset did not fit: ${JSON.stringify(v3)}`);
  }
  // pick 3 parts, spread across the parts list, the way a guided step does (ft:act pick; a click on a part is the
  // figure's own business, checked in the figure reviews), then open each one's detail window: a real click on the
  // label's "Details ›" link when the figure draws one, otherwise ft:details posted from inside the iframe
  const ids = (parts || []).map((p) => p.id);
  const chooseIds = ids.length <= 3 ? ids : [ids[0], ids[Math.floor(ids.length / 2)], ids[ids.length - 1]];
  const detailsCard = () => J(`(()=>{const i=document.querySelector('.details');if(!i||i.hidden)return null;const r=i.getBoundingClientRect();return {title:i.querySelector('.det-title')?.textContent,intro:(i.querySelector('.det-intro')?.textContent||'').slice(0,70),facts:i.querySelectorAll('.det-fact').length,lesson:i.querySelector('.det-lesson')?.getAttribute('href')??null,box:[r.left,r.top,r.width,r.height].map(Math.round),position:getComputedStyle(i).position,vh:innerHeight,vw:innerWidth}})()`);
  const pickPart = async (pid) => {
    const before = await ev(`__ftlog.length`);
    await ev(`${F}.contentWindow.postMessage({type:'ft:act',name:'pick',arg:${JSON.stringify(pid)}},'*')`);
    await wait(1000);
    return J(`(()=>{const m=__ftlog.slice(${before}).reverse().find(m=>m.type==='ft:pick');return m?m.part:null})()`);
  };
  const openDetails = async (pk) => {
    const fig = await ev(`(__ftlog.find(m=>m.type==='ft:ready')||{}).fig`);
    // (the picked part's own card first: an FPC's pick also labels its gold fingers, and lesson 1 step 2 labels every
    // part at once, each card with its own Details link)
    const btn = await J(`(()=>{const a=${F}.getBoundingClientRect();const d=${FD};const vis=(e)=>e.getBoundingClientRect().width>0&&getComputedStyle(e).visibility!=='hidden';const own=d.querySelector('.ft-label[data-part=${JSON.stringify(pk.id)}]:not([hidden]) .ft-label-more');const b=own&&vis(own)?own:[...d.querySelectorAll('button,a,[role=button]')].find(e=>/details/i.test(e.textContent||'')&&vis(e));if(!b)return null;const r=b.getBoundingClientRect();return {x:a.left+r.left+r.width/2,y:a.top+r.top+r.height/2}})()`);
    const before = await ev(`__ftlog.length`);
    if (btn) { await click(btn.x, btn.y); await wait(700); }
    const sent = await ev(`__ftlog.slice(${before}).some(m=>m.type==='ft:details')`);
    if (!sent) {
      await ev(`${F}.contentWindow.eval(${JSON.stringify(`parent.postMessage(${JSON.stringify({ type: "ft:details", fig, part: pk })},'*')`)})`);
      await wait(700);
    }
    return sent ? "figure link" : "posted";
  };
  let linkPart = null;
  for (const pid of chooseIds) {
    const frame0 = await frameRect();
    const pk = await pickPart(pid);
    if (!pk) { bad(`pick ${pid}: no ft:pick`); continue; }
    const how = await openDetails(pk);
    const card = await detailsCard();
    const frame1 = await frameRect();
    console.log(`  pick ${pid}: ft:pick=${pk.id} | details (${how}): ${JSON.stringify(card)}`);
    if (!card || card.title !== pk.title) bad(`pick ${pid}: detail window ${card?.title} vs pick ${pk.title}`);
    if (card && (card.box[0] + card.box[2] > card.vw + 1 || card.box[0] < -1 || card.box[1] + card.box[3] > card.vh + 1)) bad(`detail window off-screen ${card.box}`);
    if (JSON.stringify(frame0) !== JSON.stringify(frame1)) bad(`figure frame moved ${JSON.stringify(frame0)} -> ${JSON.stringify(frame1)}`);
    if (pk.facts && pk.facts.length < 2) bad(`part ${pk.id} has ${pk.facts.length} facts`);
    if (card?.lesson) linkPart = card.lesson;
  }
  await shot("picked");
  // click on the drawing, away from the label: a point on the drawing near the centre
  const drawPt = await J(`(()=>{const a=${F}.getBoundingClientRect();const d=${FD};for(const [fx,fy] of [[.5,.5],[.45,.55],[.55,.4],[.4,.4],[.6,.6]]){const x=a.width*fx,y=a.height*fy;const e=d.elementFromPoint(x,y);if(e&&!e.closest('.ft-hotspot,.ft-callout,.ft-viewbar,button')&&e.closest('svg'))return {x:a.left+x,y:a.top+y,tag:e.tagName+'.'+(e.getAttribute('class')||'')}}return null})()`);
  if (drawPt) {
    const before = await ev(`__ftlog.length`);
    await click(drawPt.x, drawPt.y); await wait(800);
    const pk = await J(`(()=>{const m=__ftlog.slice(${before}).reverse().find(m=>m.type==='ft:pick');return m?(m.part?m.part.id:null):'nochange'})()`);
    console.log(`  click drawing at (${Math.round(drawPt.x)},${Math.round(drawPt.y)}) ${drawPt.tag.slice(0, 40)} -> ${pk}, detail window: ${(await detailsCard())?.title ?? "closed"}`);
  }
  // Escape with the figure focused: the figure drops its label (ft:pick null), and the detail window goes with it
  if (chooseIds[0]) {
    const pk = await pickPart(chooseIds[0]);
    if (pk) await openDetails(pk);
    await ev(`${F}.focus()`);
    const before = await ev(`__ftlog.length`);
    await key("Escape", "Escape", 27); await wait(700);
    const got = await J(`(()=>{const m=__ftlog.slice(${before}).reverse().find(m=>m.type==='ft:pick');return m?(m.part?m.part.id:null):'nochange'})()`);
    const open = Boolean(await detailsCard());
    console.log(`  Escape (figure focused): pick -> ${got}, detail window open: ${open}`);
    if (got === null && open) bad("label cleared but the detail window stayed open");
  }
  // Escape from the page (focus in the detail window): the window closes, focus goes back to the figure, the pick stays
  if (chooseIds[0]) {
    const pk = await pickPart(chooseIds[0]);
    if (pk) await openDetails(pk);
    const inside = await ev(`document.querySelector('.details')?.contains(document.activeElement)`);
    await key("Escape", "Escape", 27); await wait(700);
    const open = Boolean(await detailsCard());
    const focusFig = await ev(`document.activeElement===${F}`);
    const st = await lastState();
    console.log(`  Escape (page focused, focus was in the window: ${inside}): window open: ${open}, focus on figure: ${focusFig}, figure picked: ${st?.picked}`);
    if (!inside) bad("focus did not move into the detail window");
    if (open) bad("Escape (page) did not close the detail window");
    if (!focusFig) bad("focus did not return to the figure");
  }
  // theme toggle keeps the pick and the open detail window
  if (chooseIds[1] || chooseIds[0]) {
    const pk = await pickPart(chooseIds[1] || chooseIds[0]);
    if (pk) await openDetails(pk);
    const sBefore = await lastState();
    const before = await ev(`__ftlog.length`);
    await ev(`document.querySelector('[data-theme-toggle]').click()`);
    const t1 = Date.now();
    while (Date.now() - t1 < 9000) { if (await ev(`__ftlog.slice(${before}).some(m=>m.type==='ft:ready')`) && await ev(`document.querySelector('.figure-slot')?.dataset.status`) === "ready") break; await wait(200); }
    await wait(2500);
    const sAfter = await lastState();
    const card = await detailsCard();
    console.log(`  theme toggle -> ${await ev(`document.documentElement.dataset.theme`)} src=${await ev(`${F}.getAttribute('src')`)}`);
    console.log(`    picked ${sBefore?.picked} -> ${sAfter?.picked}; detail window: ${card?.title ?? null}; readout before: ${sBefore?.readout}\n    readout after:  ${sAfter?.readout}`);
    if (sBefore?.picked !== sAfter?.picked) bad(`theme toggle lost pick ${sBefore?.picked} -> ${sAfter?.picked}`);
    if (!card) bad("detail window closed after theme toggle");
    await shot("toggled");
  }
  // lesson link
  linkPart = (await ev(`document.querySelector('.details:not([hidden]) .det-lesson')?.getAttribute('href')??null`)) || linkPart;
  if (linkTest && linkPart) {
    if (!(await detailsCard())) {
      // reopen a part whose window had the link
      for (const pid of chooseIds) { const pk = await pickPart(pid); if (pk) await openDetails(pk); if (await ev(`!!document.querySelector('.details:not([hidden]) .det-lesson')`)) break; }
    }
    await ev(`document.querySelector('.details:not([hidden]) .det-lesson')?.click()`);
    await wait(3500);
    console.log(`  lesson link ${linkPart} -> hash ${await ev(`location.hash`)} title ${await ev(`document.querySelector('h1')?.textContent`)} status ${await ev(`document.querySelector('.figure-slot')?.dataset.status`)} detail window ${Boolean(await detailsCard())}`);
    if (!(await ev(`location.hash`)).endsWith(linkPart.split("/").pop())) bad("lesson link did not navigate");
    await shot("linked");
  }
} else {
  // widget-only lesson: steps if any, theme toggle
  const nSteps = await ev(`document.querySelectorAll('.step-dot').length`);
  for (let k = 0; k < nSteps; k++) { await ev(`document.querySelector('[data-go]').click()`); await wait(1500); }
  await ev(`document.querySelector('[data-theme-toggle]').click()`); await wait(1500);
  await shot("toggled");
}
const hs2 = await J(`({sw:document.documentElement.scrollWidth,w:innerWidth})`);
if (hs2.sw > hs2.w + 1) bad(`horizontal scroll at end ${hs2.sw} > ${hs2.w}`);
console.log(errors.length ? "  CONSOLE:\n    " + errors.join("\n    ") : "  console: clean");
if (errors.length) problems.push(...errors.map((e) => "console " + e));
console.log(`  RESULT ${tag} ${problems.length ? "PROBLEMS " + problems.length : "OK"}`);
ws.close();
chrome.kill("SIGKILL");
await wait(300);
rmSync(profile, { recursive: true, force: true });
process.exit(0);
