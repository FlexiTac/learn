// SUPERSEDED (2026-10-24): this checks the old five-step Lesson 2 ("One touch spot", then "Five layers" … "Seal the edges"
// with the layer inspector), which the rework replaced by three steps (one touch spot -> 2 × 2 -> 12 × 32, no inspector).
// Its step counts, the inspector and the old saved-progress case no longer apply: use scripts/lesson2-review.mjs (all
// three steps, the figure mirror, the dots, saved progress) and scripts/unit-3d-review.mjs (the unit card).
// Lesson 2 step 1 ("One touch spot") end to end on a built site, headless Chrome over CDP with real mouse / touch / key
// input (no npm deps; Node 22).
//   npx vite build --outDir /tmp/lf-dist && (cd /tmp/lf-dist && python3 -m http.server 8842 --bind 127.0.0.1) &
//   node scripts/unit-review.mjs --size 1440x900 --theme light [--phone] [--reduced] [--old-progress]
//        [--base http://127.0.0.1:8842/] [--out review/lesson2-unit]
// Checks: step 1 opens with no layer inspector (the figure has the whole stage); Fig 1's focus ring on sense 6 × drive 16
// (ft:focus); the unit card right of the pad (never over the pad or the mat: left of it is the figure's free band),
// vertically centred on the ring (or clamped inside the stage), with ONE horizontal leader from the ring's right edge to
// the card's left edge and its dot on the ring (on a phone too: the card's narrow form in the band, 120+ px); three
// moments of the loop (the meter reads rTaxel(press) and drops, the figure's ring glows with the same press); a hover
// scrub and the keys (loop paused, figure in step); a theme toggle; step 2 (inspector back, ring and card gone); step 1
// again via its dot; no horizontal scroll; no console errors, no ft:error. On a phone the card sits in the band beside
// the pad too (place "beside", 10 px gaps), in its mini form (R and V as text rows). --old-progress starts from progress saved
// with the 4-step lesson (steps = 2) and checks it is moved onto the same steps. PNGs and <tag>.json land in --out.
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { mkdirSync, writeFileSync } from "node:fs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const { launch, sleep } = await import(pathToFileURL(resolve(root, "../flexitac-anatomy/figures/pad/shots/clean/cdp.mjs")).href);
const { rTaxel } = await import(pathToFileURL(resolve(root, "../flexitac-anatomy/shared/models/taxel.mjs")).href);

const args = process.argv.slice(2);
const opt = (n, d) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : d);
const flag = (n) => args.includes(`--${n}`);
const [W, H] = opt("size", "1440x900").split("x").map(Number);
const THEME = opt("theme", "light");
const PHONE = flag("phone");
const REDUCED = flag("reduced");
const OLD = flag("old-progress");
const BASE = opt("base", "http://127.0.0.1:8842/");
const OUT = resolve(root, opt("out", "review/lesson2-unit"));
const tag = `${THEME}-${W}x${H}${PHONE ? "-phone" : ""}${REDUCED ? "-reduced" : ""}${OLD ? "-oldprogress" : ""}`;
mkdirSync(OUT, { recursive: true });

const results = [];
const ok = (name, pass, info = "") => {
  results.push({ name, pass: Boolean(pass), info });
  console.log(`${pass ? "PASS" : "FAIL"}  ${tag}  ${name}${info ? "  " + (typeof info === "string" ? info : JSON.stringify(info)) : ""}`);
};

const b = await launch({ width: W, height: H, reduced: REDUCED, mobile: PHONE, touch: PHONE, scale: 1 });
const { send, evaluate } = b;
const features = [{ name: "prefers-color-scheme", value: THEME }];
if (REDUCED) features.push({ name: "prefers-reduced-motion", value: "reduce" });
await send("Emulation.setEmulatedMedia", { features });
await send("Page.addScriptToEvaluateOnNewDocument", {
  source: `if (window === window.top) { window.__errs = []; window.__acts = 0;
    ${OLD ? `try { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.setItem('learn-flexitac:v1', JSON.stringify({ done: [], steps: { 'the-sandwich': 2 }, quiz: {}, params: {} })); } } catch {}` : ""}
    addEventListener('message', (e) => { const d = e.data; if (!d || typeof d.type !== 'string') return;
      if (d.type === 'ft:error') window.__errs.push(d);
      else if (d.type === 'ft:focus') window.__focus = d;
      else if (d.type === 'ft:state') window.__st = d.state; }); }`,
});
const snap = async (name) => b.shot(join(OUT, `${tag}-${name}.png`));
const fr = (js) => evaluate(`(() => { const f = document.querySelector('iframe.figure-frame'); if (!f || !f.contentWindow) return null; return f.contentWindow.eval(${JSON.stringify(js)}); })()`);
const frameBox = () => evaluate(`(() => { const f = document.querySelector('iframe.figure-frame'); const r = f.getBoundingClientRect(); return { x: r.left + f.clientLeft, y: r.top + f.clientTop, w: f.clientWidth, h: f.clientHeight }; })()`);
const until = async (js, ms = 8000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try {
      if (await evaluate(js)) return true;
    } catch {}
    await sleep(80);
  }
  return false;
};
const elBox = (sel) => evaluate(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, vis: e.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) && r.width > 0 }; })()`);
const centre = (r) => [r.x + r.w / 2, r.y + r.h / 2];
let mouse = [5, 5];
const mv = async (x, y, steps = 8) => {
  const [x0, y0] = mouse;
  for (let k = 1; k <= steps; k++) {
    await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: x0 + ((x - x0) * k) / steps, y: y0 + ((y - y0) * k) / steps, button: "none" });
    await sleep(12);
  }
  mouse = [x, y];
};
const click = async (x, y) => {
  if (PHONE) {
    await send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y, id: 1 }] });
    await sleep(50);
    await send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    return;
  }
  await mv(x, y, 3);
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", buttons: 1, clickCount: 1 });
  await sleep(40);
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", buttons: 0, clickCount: 1 });
};
const kicker = () => evaluate(`document.querySelector('.steps-kicker')?.textContent.trim()`);
const focusMsg = () => evaluate(`window.__focus ? JSON.parse(JSON.stringify(window.__focus)) : null`);
const st = () => evaluate(`window.__st ? JSON.parse(JSON.stringify(window.__st)) : null`);
const noHScroll = () => evaluate(`document.scrollingElement.scrollWidth <= innerWidth + 1`);
const inspectorShown = () => evaluate(`(() => { const w = document.querySelector('.widget-slot'); return Boolean(w && !w.hidden && w.getBoundingClientRect().height > 40); })()`);
const card = () =>
  evaluate(`(() => { const c = document.querySelector('.demo-card[data-demo="unit"]'); if (!c) return null; const r = c.getBoundingClientRect(); const a = c.querySelector('.ud-anim');
    const mini = c.querySelector('.ud.is-mini .ud-mini-rv');
    return { x: r.left, y: r.top, w: r.width, h: r.height, place: c.dataset.place, on: c.classList.contains('is-on'), read: mini ? 'R = ' + mini.textContent : c.querySelector('.ud-val')?.textContent ?? '', now: a ? +a.getAttribute('aria-valuenow') : -1, text: a?.getAttribute('aria-valuetext') ?? '' }; })()`);
const leader = () =>
  evaluate(`(() => { const s = document.querySelector('.demo-leader'); if (!s || s.classList.contains('is-hidden') || getComputedStyle(s).visibility === 'hidden') return null; const r = s.getBoundingClientRect(); const d = s.querySelector('.demo-leader-line').getAttribute('d'); const m = d.match(/^M([\\d.-]+) ([\\d.-]+)H([\\d.-]+)$/); const e = s.querySelector('.demo-leader-end');
    return m ? { x0: r.left + +m[1], y: r.top + +m[2], x1: r.left + +m[3], dot: [r.left + +e.getAttribute('cx'), r.top + +e.getAttribute('cy')], opacity: +getComputedStyle(s).opacity, d } : { d }; })()`);
const stageBody = () => elBox(".stage-body");
const overlap = (a, c) => a && c && a.x < c.x + c.w - 0.5 && c.x < a.x + a.w - 0.5 && a.y < c.y + c.h - 0.5 && c.y < a.y + a.h - 0.5;
const pressOf = (c) => (c ? c.now / 100 : -1);
const figPress = async () => (await fr(`window.__padExplore.focus().p`)) ?? -1;

/** The ring, leader and card in page px; asserts the geometry. */
async function checkLayout(label, { expectBeside }) {
  const f = await focusMsg();
  const fb = await frameBox();
  const c = await card();
  const sb = await stageBody();
  const s = await st();
  const ring = f && f.ring ? { x: fb.x + f.ring.x, y: fb.y + f.ring.y, rx: f.ring.rx, ry: f.ring.ry } : null;
  const pad = s?.feel?.pad ? { x: fb.x + s.feel.pad.x, y: fb.y + s.feel.pad.y, w: s.feel.pad.w, h: s.feel.pad.h } : null;
  const band = f && f.room ? fb.x + f.room.x : null;
  ok(`${label}: ring on sense 6 × drive 16`, f && f.sense === 5 && f.drive === 15 && ring && ring.rx >= 8, { ring });
  ok(`${label}: card shown`, c && c.on, c);
  if (!c || !ring) return { f, c, ring, pad };
  if (expectBeside) {
    const L = await leader();
    ok(`${label}: card beside the pad (place "beside")`, c.place === "beside", c.place);
    // (the card's right margin: 16 px, 10 px on a phone's stage under 480 px; src/ui/demo.ts gapsAt)
    const edge = sb.w < 480 ? 10 : 16;
    ok(`${label}: card on the right edge of the stage`, Math.abs(sb.x + sb.w - edge - (c.x + c.w)) < 1.5, { cardRight: +(c.x + c.w).toFixed(1), stageRight: +(sb.x + sb.w).toFixed(1) });
    ok(`${label}: card clear of the pad and the mat (right of the figure's free band)`, band !== null && c.x >= band - 0.5 && !overlap(c, pad), { cardLeft: +c.x.toFixed(1), band: band && +band.toFixed(1), padRight: pad && +(pad.x + pad.w).toFixed(1) });
    ok(`${label}: card inside the stage`, c.x >= sb.x - 0.5 && c.y >= sb.y - 0.5 && c.x + c.w <= sb.x + sb.w + 0.5 && c.y + c.h <= sb.y + sb.h + 0.5, { c, sb });
    const mid = c.y + c.h / 2;
    // clamped: by the figure's top / bottom corner text, or (a narrow stage) above its viewbar where the card is over
    // the viewbar's columns (ft:focus bar, 8 px clear)
    const bar = f && f.bar ? { x: fb.x + f.bar.x, y: fb.y + f.bar.y, w: f.bar.w } : null;
    const overBar = bar && bar.x < c.x + c.w + 8 && bar.x + bar.w > c.x - 8;
    ok(`${label}: card clear of the figure's viewbar`, !overBar || c.y + c.h <= bar.y - 7.5, { cardBottom: c.y + c.h, barTop: bar && bar.y });
    // (the lowest it may reach: 64 px above the stage's bottom, or higher where the drawing ends and the figure's bottom
    // text starts (ft:focus room / text: a phone))
    const low = Math.min(sb.y + sb.h - 64, Math.max(fb.y + f.room.y + f.room.h, f.text != null ? fb.y + f.text - 6 : -Infinity));
    const clamped = c.y <= sb.y + 40.5 || c.y + c.h >= low - 0.5 || (overBar && c.y + c.h >= bar.y - 8.5);
    ok(`${label}: card centred on the ring (or clamped in the stage)`, Math.abs(mid - ring.y) < 1.5 || (clamped && ring.y > c.y + 12 && ring.y < c.y + c.h - 12), { mid: +mid.toFixed(1), ringY: ring.y, clamped });
    ok(`${label}: one horizontal leader, ring's right edge -> card's left edge`, L && L.x0 !== undefined && Math.abs(L.x0 - (ring.x + ring.rx)) < 1 && Math.abs(L.y - ring.y) < 1 && Math.abs(L.x1 - c.x) < 1, L);
    ok(`${label}: leader's dot on the ring`, L && L.dot && Math.abs(L.dot[0] - (ring.x + ring.rx)) < 1 && Math.abs(L.dot[1] - ring.y) < 1);
    if (PHONE) ok(`${label}: card width ${Math.round(c.w)} px within 100-204 (a phone's band)`, c.w >= 99.5 && c.w <= 204.5);
    else ok(`${label}: card width ${Math.round(c.w)} px within 204-320`, c.w >= 203.5 && c.w <= 320.5);
  } else {
    // (there is no place under the figure any more: the card is beside it at every size, src/ui/demo.ts)
    ok(`${label}: card beside the pad (place ${c.place})`, false, { place: c.place });
  }
  return { f, c, ring, pad };
}

// ------------------------------------------------------------------ 1. open lesson 2
await b.goto(`${BASE}#/lesson/the-sandwich`);
const t0 = Date.now();
const opened = await until(`window.__focus && window.__focus.ring && (() => { const c = document.querySelector('.demo-card[data-demo="unit"]'); return c && c.classList.contains('is-on'); })()`, 15000);
ok("step 1 opens: ring reported, unit card on", opened, `${Date.now() - t0} ms`);
await sleep(700);
ok("step 1 is 'One touch spot' (1 of 5)", /Step 1 of 5 · One touch spot/.test((await kicker()) || ""), await kicker());
ok("no layer inspector in step 1", !(await inspectorShown()));
ok("split stage off in step 1", !(await evaluate(`document.querySelector('.stage-body').classList.contains('is-split')`)));
if (OLD) {
  const saved = await evaluate(`JSON.parse(localStorage.getItem('learn-flexitac:v1'))`);
  const dots = await evaluate(`[...document.querySelectorAll('.step-dot')].map(d => d.classList.contains('is-done'))`);
  ok("old progress (2 of 4) moved onto the same steps (3 of 5)", saved.steps["the-sandwich"] === 3 && saved.stepsRev?.["the-sandwich"] === 1, saved);
  ok("dots 1-3 done, 4-5 not", JSON.stringify(dots) === JSON.stringify([true, true, true, false, false]), dots);
}
const s1 = await st();
ok("figure assembled in the iso view", s1 && s1.plan === 0 && Object.values(s1.shares).every((v) => v < 0.01), { plan: s1?.plan });
ok("figure readout names the crossing", /one touch spot · sense line 6 × drive line 16/.test(s1?.readout || ""), s1?.readout);
const besideWanted = true;
let L1 = await checkLayout("step 1", { expectBeside: besideWanted });
ok("no horizontal scroll", await noHScroll());
await snap("01-step1");

// ------------------------------------------------------------------ 2. three moments of the loop
if (!REDUCED) {
  const moments = [
    ["a-start", (p) => p > 0.04 && p < 0.25],
    ["b-mid", (p) => p > 0.45 && p < 0.65],
    ["c-hard", (p) => p > 0.97],
  ];
  const reads = [];
  for (const [name, want] of moments) {
    let c = null;
    const t1 = Date.now();
    while (Date.now() - t1 < 7000) {
      c = await card();
      if (c && want(pressOf(c))) break;
      await sleep(25);
    }
    await sleep(120);
    c = await card();
    const fp = await figPress();
    const p = pressOf(c);
    const expect = rTaxel(p);
    const shown = c.read.match(/R = ([\d.]+) (k|M)Ω/);
    const val = shown ? +shown[1] * (shown[2] === "M" ? 1e6 : 1e3) : NaN;
    ok(`loop ${name}: meter reads rTaxel(press) (press ${p.toFixed(2)} -> ${c.read})`, Math.abs(val - expect) / expect < 0.08, { val, expect: Math.round(expect) });
    ok(`loop ${name}: the figure's ring glows with the same press`, Math.abs(fp - p) < 0.15, { card: p, figure: +fp.toFixed(3) });
    reads.push(val);
    await snap(`02${name}-loop`);
  }
  ok("loop: the reading drops as the press grows", reads[0] > reads[1] && reads[1] > reads[2] && reads[2] < 2000, reads);
}

// ------------------------------------------------------------------ 3. scrub (hover / drag) and keys
{
  // (the scrub area is the 3D unit, .ud-hit: press = (y - 14 %) / 60 % of its height)
  const a = await elBox(".ud-hit");
  if (!PHONE) {
    await mv(a.x + a.w * 0.6, a.y + a.h * 0.14 + a.h * 0.6 * 0.7, 10);
    await sleep(250);
    const c1 = await card();
    await sleep(600);
    const c2 = await card();
    const fp = await figPress();
    ok("hover scrub: press follows the pointer (~0.7) and the loop pauses", Math.abs(pressOf(c1) - 0.7) < 0.08 && c1.now === c2.now, { p1: pressOf(c1), p2: pressOf(c2) });
    ok("hover scrub: figure in step", Math.abs(fp - pressOf(c2)) < 0.06, { figure: fp });
    await snap("03-scrub");
    // drag up toward untouched
    await send("Input.dispatchMouseEvent", { type: "mousePressed", x: mouse[0], y: mouse[1], button: "left", buttons: 1, clickCount: 1 });
    for (let k = 1; k <= 8; k++) {
      await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: mouse[0], y: mouse[1] - (a.h * 0.4 * k) / 8, button: "left", buttons: 1 });
      await sleep(20);
    }
    await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: mouse[0], y: mouse[1] - a.h * 0.4, button: "left", buttons: 0, clickCount: 1 });
    mouse = [mouse[0], mouse[1] - a.h * 0.4];
    await sleep(200);
    const c3 = await card();
    ok("drag up: press goes down", pressOf(c3) < pressOf(c2) - 0.3, { p: pressOf(c3) });
  } else {
    // touch: a drag on the drawing scrubs
    const x = a.x + a.w * 0.45;
    await send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y: a.y + a.h * 0.2, id: 1 }] });
    for (let k = 1; k <= 8; k++) {
      await send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: a.y + a.h * 0.2 + (a.h * 0.38 * k) / 8, id: 1 }] });
      await sleep(25);
    }
    const c1 = await card();
    const fp = await figPress();
    await sleep(150);
    ok("touch drag scrubs the press", pressOf(c1) > 0.4, { p: pressOf(c1) });
    ok("touch scrub: figure in step", Math.abs(fp - pressOf(c1)) < 0.15, { figure: fp });
    await snap("03-scrub");
    await send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  }
  // keys: focus the drawing (a real click focuses it), then ← / →
  if (!PHONE) {
    await click(a.x + a.w * 0.9, a.y + a.h * 0.15);
    await sleep(100);
    const p0 = pressOf(await card());
    await b.key("ArrowRight");
    await b.key("ArrowRight");
    await sleep(150);
    const p1 = pressOf(await card());
    await b.key("ArrowLeft");
    await sleep(150);
    const p2 = pressOf(await card());
    ok("keys: → twice +0.10, ← −0.05", Math.abs(p1 - p0 - 0.1) < 0.011 && Math.abs(p1 - p2 - 0.05) < 0.011, { p0, p1, p2 });
    ok("keys: the drawing is focused", await evaluate(`document.activeElement?.classList.contains('ud-anim')`));
    // pointer away; the loop resumes after 3 s
    await mv(5, 5, 6);
    await evaluate(`document.activeElement?.blur()`);
  }
}

// ------------------------------------------------------------------ 3b. zoom and pan in the figure: the leader follows the ring
if (!PHONE) {
  const f0 = await focusMsg();
  const fb = await frameBox();
  const c0 = await card();
  const at = [fb.x + f0.ring.x, fb.y + f0.ring.y];
  await mv(...at, 8);
  for (let k = 0; k < 3; k++) {
    await send("Input.dispatchMouseEvent", { type: "mouseWheel", x: at[0], y: at[1], deltaX: 0, deltaY: -120 });
    await sleep(60);
  }
  await sleep(900);
  const f1 = await focusMsg();
  const c1 = await card();
  const L = await leader();
  const ring = { x: fb.x + f1.ring.x, y: fb.y + f1.ring.y, rx: f1.ring.rx };
  const zoomed = (await st())?.view?.zoom ?? 1;
  // (the ring grows with the zoom, from its 9 px floor on a small stage)
  ok("zoom in: ft:focus follows (the ring grows)", zoomed > 1.2 && f1.ring.rx > f0.ring.rx * 1.1, { zoom: zoomed, rx0: f0.ring.rx, rx1: f1.ring.rx });
  ok("zoom in: the card stays beside, same width and left edge", c1.place === "beside" && Math.abs(c1.x - c0.x) < 0.5 && Math.abs(c1.w - c0.w) < 0.5, { c0: [c0.x, c0.w], c1: [c1.x, c1.w] });
  ok("zoom in: leader still ring -> card, horizontal (or hidden off the card's rows)", L ? Math.abs(L.x0 - (ring.x + ring.rx)) < 1 && Math.abs(L.y - ring.y) < 1 && Math.abs(L.x1 - c1.x) < 1 : ring.y < c1.y + 12 || ring.y > c1.y + c1.h - 12 || ring.x + ring.rx > c1.x - 8, L);
  await snap("03b-zoomed");
  // back to the home view: the figure's own fit button (a real click inside the iframe)
  const reset = await fr(`(() => { const r = document.querySelector('.ft-viewbar [data-tool="reset"]').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()`);
  await click(fb.x + reset[0], fb.y + reset[1]);
  await sleep(900);
  const f2 = await focusMsg();
  ok("view reset: the ring is back where it was", Math.abs(f2.ring.x - f0.ring.x) < 1 && Math.abs(f2.ring.y - f0.ring.y) < 1, { f0: f0.ring, f2: f2.ring });
  await mv(5, 5, 6);
}

// ------------------------------------------------------------------ 4. theme toggle in step 1
{
  const t = await elBox("[data-theme-toggle]");
  if (t && t.w > 0) await click(...centre(t));
  else await evaluate(`document.querySelector('[data-theme-toggle]').click()`);
  await sleep(600);
  const back = await until(`window.__focus && window.__focus.ring && document.querySelector('iframe.figure-frame').src.includes(${JSON.stringify(THEME === "light" ? "pad.html" : "pad-light.html")})`, 12000);
  await sleep(900);
  ok("theme toggle: ring back, still no inspector", back && !(await inspectorShown()));
  await checkLayout("after theme toggle", { expectBeside: besideWanted });
  await snap("04-theme-toggled");
  // and back
  const t2 = await elBox("[data-theme-toggle]");
  if (t2 && t2.w > 0) await click(...centre(t2));
  else await evaluate(`document.querySelector('[data-theme-toggle]').click()`);
  await until(`window.__focus && window.__focus.ring && document.querySelector('iframe.figure-frame').src.includes(${JSON.stringify(THEME === "light" ? "pad-light.html" : "pad.html")})`, 12000);
  await sleep(900);
}

// ------------------------------------------------------------------ 5. step 2: the inspector is back, the ring gone
{
  await evaluate(`document.querySelector('[data-go]').scrollIntoView({ block: 'center' })`);
  await sleep(150);
  const g = await elBox("[data-go]");
  await click(...centre(g));
  const went = await until(`/Step 2 of 5/.test(document.querySelector('.steps-kicker')?.textContent || '')`, 4000);
  const apart = await until(`window.__st && Object.values(window.__st.shares).every(v => v > 0.95)`, 6000);
  await sleep(900);
  const f = await focusMsg();
  ok("step 2 'Five layers' reached", went, await kicker());
  ok("step 2: layer inspector back", await inspectorShown());
  ok("step 2: ring gone (ft:focus ring null, no crossing)", f && f.ring === null && f.sense === null, f);
  ok("step 2: pad apart", apart);
  ok("step 2: unit card and leader gone", (await evaluate(`document.querySelectorAll('.demo-card, .demo-leader').length`)) === 0);
  ok("step 2: no ring drawn in the figure", !(await fr(`window.__padExplore.focus().shown`)));
  ok("no horizontal scroll (step 2)", await noHScroll());
  await evaluate(`scrollTo(0, 0)`);
  await sleep(200);
  await snap("05-step2");
}

// ------------------------------------------------------------------ 6. step 1 again via its dot
{
  await evaluate(`document.querySelector('.step-dot[data-k="0"]').scrollIntoView({ block: 'center' })`);
  await sleep(150);
  const d = await elBox('.step-dot[data-k="0"]');
  await click(...centre(d));
  // (a phone: the dot sits below the figure; bring the figure back into view, as a learner would)
  await sleep(300);
  await evaluate(`scrollTo(0, 0)`);
  const back = await until(`window.__focus && window.__focus.ring && (() => { const c = document.querySelector('.demo-card[data-demo="unit"]'); return c && c.classList.contains('is-on'); })()`, 10000);
  await sleep(1200);
  ok("step-1 dot: still lesson 2, ring and card back", back && /Step 1 of 5/.test((await kicker()) || ""));
  ok("step-1 dot: inspector hidden again", !(await inspectorShown()));
  const s = await st();
  ok("step-1 dot: pad assembled again", s && Object.values(s.shares).every((v) => v < 0.01));
  await checkLayout("step 1 again", { expectBeside: besideWanted });
  await evaluate(`scrollTo(0, 0)`);
  await sleep(200);
  await snap("06-step1-again");
}

await finish();

function finish() {
  const errs = b.problems.filter((p) => !/favicon/i.test(p));
  return evaluate(`window.__errs`).then((fe) => {
    ok("no console errors / exceptions", errs.length === 0, errs.slice(0, 5));
    ok("no ft:error", !fe || fe.length === 0, fe);
    writeFileSync(join(OUT, `${tag}.json`), JSON.stringify(results, null, 1));
    const fails = results.filter((r) => !r.pass);
    console.log(`SUMMARY ${tag}: ${results.length - fails.length}/${results.length} pass`);
    b.close();
    process.exit(0);
  });
}
