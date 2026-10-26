// Lesson 1 "Feel it" and "Take it apart" (its steps 2 and 3, after step 1 "On a robot", whose robot picture covers the
// stage: scripts/l1-robot-review.mjs checks that one) and "Squeeze the Velostat" (lesson 2's step 1 since the robot came
// in: it moved there from lesson 1) on a built site, headless Chrome over CDP with real mouse / touch / key input (no npm
// deps; Node 22).
//   npx vite build --outDir /tmp/lf-dist && (cd /tmp/lf-dist && python3 -m http.server 8823 --bind 127.0.0.1) &
//   node scripts/feel-review.mjs --size 1440x900 --theme light [--phone] [--reduced] [--base http://127.0.0.1:8823/]
//        [--out review/feel] [--only first]
// Checks: lesson 1 opens on the robot with the figure ready underneath in feel mode; Next step shows "Feel it" (feel
// mode, plan view, the "Click to touch the sensor" hint, no site demo card, the figure's
// touch map exactly the size of the sensing area and level with it, left of the pad, all in view); hover (the finger
// only over the sensing area); presses at three crossings (ft:touch peak, the map's brightest cell and its row line up
// with the crossing; release fades to one all-zero frame; no page scroll on a phone); a drag (<= 30 Hz); Show me;
// a theme toggle in "Feel it"; "Take it apart" (iso view, "Click to expand", a real click expands in place, the collapse
// pill, Show me); the "Feel it" dot and the robot's dot; then lesson 2 step 1 (the Velostat label, the velostat card clear
// of the pad and label, R at press 0 / 0.5 / 1 against @shared/models/taxel.mjs with the dot on the curve, keys, hover
// scrub, the loop or reduced motion, Details ›, a theme toggle); no console errors, no ft:error. PNGs and <tag>.json
// land in --out.
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { mkdirSync, writeFileSync } from "node:fs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const { launch, sleep } = await import(pathToFileURL(resolve(root, "../flexitac-anatomy/figures/pad/shots/clean/cdp.mjs")).href);

const args = process.argv.slice(2);
const opt = (n, d) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : d);
const flag = (n) => args.includes(`--${n}`);
const [W, H] = opt("size", "1440x900").split("x").map(Number);
const THEME = opt("theme", "light");
const PHONE = flag("phone");
const REDUCED = flag("reduced");
const BASE = opt("base", "http://127.0.0.1:8823/");
const OUT = resolve(root, opt("out", "review/feel"));
const ONLY = opt("only", "all");
const tag = `${THEME}-${W}x${H}${PHONE ? "-phone" : ""}${REDUCED ? "-reduced" : ""}`;
mkdirSync(OUT, { recursive: true });

const results = [];
const ok = (name, pass, info = "") => {
  results.push({ name, pass: Boolean(pass), info });
  console.log(`${pass ? "PASS" : "FAIL"}  ${tag}  ${name}${info ? "  " + (typeof info === "string" ? info : JSON.stringify(info)) : ""}`);
};

const b = await launch({ width: W, height: H, reduced: REDUCED, mobile: PHONE, touch: PHONE, scale: 1 });
const { send, evaluate, shot } = b;
const features = [{ name: "prefers-color-scheme", value: THEME }];
if (REDUCED) features.push({ name: "prefers-reduced-motion", value: "reduce" });
await send("Emulation.setEmulatedMedia", { features });
await send("Page.addScriptToEvaluateOnNewDocument", {
  source: `if (window === window.top) { window.__touch = []; window.__errs = []; window.__acts = [];
    addEventListener('message', (e) => { const d = e.data; if (!d || typeof d.type !== 'string') return;
      if (d.type === 'ft:touch') window.__touch.push({ t: performance.now(), f: d.frame });
      else if (d.type === 'ft:error') window.__errs.push(d);
      else if (d.type === 'ft:state') window.__st = d.state; }); }`,
});
const snap = async (name) => shot(join(OUT, `${tag}-${name}.png`));
/** Step 3 in a phone's band: the card is beside the pad and its leader is on (from the Velostat's right point). */
const cardLeads = () =>
  evaluate(`(() => { const c = document.querySelector('.demo-card[data-demo="velostat"]'); const l = document.querySelector('.demo-leader'); const on = Boolean(c && c.dataset.place === 'beside' && l && !l.classList.contains('is-hidden'));
    const d = l?.querySelector('.demo-leader-line')?.getAttribute('d') ?? ''; const m = d.match(/^M([\\d.-]+) ([\\d.-]+)H([\\d.-]+)$/); const sb = document.querySelector('.stage-body').getBoundingClientRect(); const r = c ? c.getBoundingClientRect() : null;
    return { ok: Boolean(on && m && r && Math.abs(sb.left + +m[3] - r.left) < 1), place: c?.dataset.place, d }; })()`);
const fr = (js) => evaluate(`(() => { const f = document.querySelector('iframe.figure-frame'); if (!f || !f.contentWindow) return null; return f.contentWindow.eval(${JSON.stringify(js)}); })()`);
const frameBox = () => evaluate(`(() => { const f = document.querySelector('iframe.figure-frame'); const r = f.getBoundingClientRect(); return { x: r.left + f.clientLeft, y: r.top + f.clientTop, w: f.clientWidth, h: f.clientHeight }; })()`);
const until = async (js, ms = 8000, inFrame = false) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try {
      if (await (inFrame ? fr(js) : evaluate(js))) return true;
    } catch {}
    await sleep(100);
  }
  return false;
};
const cam = () => fr(`JSON.stringify(window.__padExplore.camera())`);
const st = () => evaluate(`window.__st ? JSON.parse(JSON.stringify(window.__st)) : null`);
const toPage = async ([x, y]) => {
  const f = await frameBox();
  return [f.x + x, f.y + y];
};
const crossing = async (i, j) => toPage(await fr(`window.__padExplore.crossingClient(${i}, ${j})`));
const argmax = (v) => v.reduce((m, x, k) => (x > v[m] ? k : m), 0);
const ij = (k) => [Math.floor(k / 32), k % 32];
const scrollY = () => evaluate(`scrollY`);
const noHScroll = async () => evaluate(`document.scrollingElement.scrollWidth <= innerWidth + 1`);
let mouse = [5, 5];
const mv = async (x, y, steps = 6) => {
  const [x0, y0] = mouse;
  for (let k = 1; k <= steps; k++) {
    await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: x0 + ((x - x0) * k) / steps, y: y0 + ((y - y0) * k) / steps, buttons: mouseDown ? 1 : 0, button: mouseDown ? "left" : "none" });
    await sleep(14);
  }
  mouse = [x, y];
};
let mouseDown = false;
const down = async (x, y) => {
  await mv(x, y, 2);
  mouseDown = true;
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", buttons: 1, clickCount: 1 });
};
const up = async () => {
  mouseDown = false;
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: mouse[0], y: mouse[1], button: "left", buttons: 0, clickCount: 1 });
};
const tdown = async (x, y) => send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y, id: 1 }] });
const tmove = async (x, y) => send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y, id: 1 }] });
const tup = async () => send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
const press = async (x, y, ms) => {
  if (PHONE) {
    await tdown(x, y);
    await sleep(ms);
  } else {
    await down(x, y);
    await sleep(ms);
  }
};
const release = async () => (PHONE ? tup() : up());
const click = async (x, y) => {
  if (PHONE) {
    await tdown(x, y);
    await sleep(50);
    await tup();
    return;
  }
  await down(x, y);
  await sleep(40);
  await up();
};
const centre = (r) => [r.x + r.w / 2, r.y + r.h / 2];
const elBox = (sel) => evaluate(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; })()`);
const frElBox = (sel) => fr(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; const cs = getComputedStyle(e); const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, vis: e.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) && r.width > 0 && +cs.opacity > 0.2, text: e.textContent.trim().slice(0, 80) }; })()`);
const goBtn = async () => evaluate(`(() => { const b = document.querySelector('[data-go]'); const r = b.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, text: b.querySelector('.go-label:not(.go-sizer)')?.textContent.trim() ?? b.textContent.trim() }; })()`);
const clickGo = async () => {
  const g = await goBtn();
  await evaluate(`document.querySelector('[data-go]').scrollIntoView({ block: 'nearest' })`);
  const g2 = await goBtn();
  await click(...centre(g2));
  return g.text;
};
const kicker = () => evaluate(`document.querySelector('.steps-kicker')?.textContent.trim()`);
const stepText = () => evaluate(`document.querySelector('.steps-text:not(.steps-sizer)')?.textContent.trim()`);

// ------------------------------------------------------------------ 1. "Feel it" (step 2, after the robot)
await b.goto(`${BASE}#/lesson/meet-flexitac`);
const tLoad = Date.now();
const ready = await until(`window.__st && window.__st.feel && window.__st.feel.on === true && window.__st.plan === 1 && window.__st.feel.map`, 15000);
ok("lesson 1 opens on step 1 'On a robot', the figure underneath in feel mode + plan view", ready && /On a robot/.test((await kicker()) || ""), `${Date.now() - tLoad} ms, ${await kicker()}`);
{
  const label = await clickGo();
  ok("step 1 button reads Next step", /Next step/.test(label), label);
  // the robot layer fades out (views/lesson.ts STAGE_FADE_MS), the figure shows
  await until(`(() => { const o = document.querySelector('.stage-over'); return !o || o.hidden; })()`, 3000);
}
await sleep(REDUCED ? 600 : 1400);
let s = await st();
let fb = await frameBox();
ok("Feel it: step 2 'Feel it'", /Step 2 of 3 · Feel it/.test((await kicker()) || ""), await kicker());
ok("no site demo card in Feel it", (await evaluate(`document.querySelectorAll('.demo-card').length`)) === 0);
const hint = await frElBox(".ft-reveal.ft-feel");
ok("feel hint visible", hint?.vis, hint?.text);
const exp = await frElBox(".ft-reveal:not(.ft-feel)");
ok("'Click to expand' hidden", !exp || !exp.vis);
const pill = await frElBox(".ft-reveal-close");
ok("collapse pill hidden", !pill || !pill.vis);
ok("no label", !(await fr(`window.__padExplore.state().label`)));
const A = s.feel.area,
  M = s.feel.map,
  P = s.feel.pad;
const dTop = Math.abs(M.y - A.y),
  dBot = Math.abs(M.y + M.h - (A.y + A.h)),
  dW = Math.abs(M.w - A.w),
  dH = Math.abs(M.h - A.h);
ok("map aligned with sensing area (top/bottom/size < 1 px)", dTop < 1 && dBot < 1 && dW < 1 && dH < 1, { dTop: +dTop.toFixed(3), dBot: +dBot.toFixed(3), dW: +dW.toFixed(3), dH: +dH.toFixed(3), areaH: +A.h.toFixed(1) });
ok("map left of the pad, clear", M.x + M.w < P.x - 4, { mapRight: +(M.x + M.w).toFixed(1), padLeft: +P.x.toFixed(1) });
const K = s.feel.kicker,
  L = s.feel.legend;
const inside = (r) => r && r.x >= -0.5 && r.y >= -0.5 && r.x + r.w <= fb.w + 0.5 && r.y + r.h <= fb.h + 0.5;
ok("map, kicker, legend inside the figure", inside(M) && inside(K) && inside(L), { K, L, fw: fb.w, fh: fb.h });
// visible on screen (the stage may scroll on stacked layouts: at least the map is in the viewport at the top of the page)
const vis = (r) => fb.y + r.y >= 0 && fb.y + r.y + r.h <= H && fb.x + r.x >= 0 && fb.x + r.x + r.w <= W;
ok("map fully in the viewport at load", vis(M) && vis(K), { mapPageTop: +(fb.y + M.y).toFixed(1), mapPageBottom: +(fb.y + M.y + M.h).toFixed(1) });
const hintB = hint;
const overlap = (a, c) => a && c && a.x < c.x + c.w && c.x < a.x + a.w && a.y < c.y + c.h && c.y < a.y + a.h;
ok("hint clear of the map and kicker", !overlap(hintB, M) && !overlap(hintB, K));
ok("hint clear of the sensing area", !overlap(hintB, { ...A, y: A.y + 1 }));
ok("no horizontal scroll", await noHScroll());
const kText = await fr(`[...document.querySelectorAll('.pd-fm-text text, .pd-fm-text tspan')].map(t => t.textContent).join(' | ')`);
console.log("   map text:", kText);
console.log("   boxes:", JSON.stringify({ frame: fb, area: A, map: M, pad: P, kicker: K, legend: L }));
await snap("01-first");

if (ONLY === "first") await finish();

// ------------------------------------------------------------------ 2. hover
const cam0 = await cam();
if (!PHONE) {
  const off = await toPage([(M.x + M.w + P.x) / 2, A.y + A.h / 2]);
  await mv(...off, 10);
  await sleep(250);
  let f = await fr(`(() => { const x = window.__padExplore.feel(); return { finger: x.finger && x.finger.shown, cursor: x.cursor }; })()`);
  ok("off the area: no finger, normal cursor", !f.finger && f.cursor !== "none", f);
  const mapPt = await toPage(centre(M));
  await mv(...mapPt, 10);
  await sleep(200);
  f = await fr(`(() => { const x = window.__padExplore.feel(); return { finger: x.finger && x.finger.shown, cursor: x.cursor }; })()`);
  ok("over the map: no finger", !f.finger, f);
  const c = await toPage(centre(A));
  await mv(...c, 10);
  await sleep(250);
  f = await fr(`(() => { const x = window.__padExplore.feel(); const el = document.elementFromPoint(${centre(A)[0]}, ${centre(A)[1]}); return { finger: x.finger && x.finger.shown, cursor: x.cursor, css: el ? getComputedStyle(el).cursor : '' }; })()`);
  ok("over the area: finger, cursor none", f.finger && (f.cursor === "none" || f.css === "none"), f);
  ok("hover posts no ft:touch", (await evaluate(`window.__touch.length`)) === 0);
  await snap("02-hover");
}

// ------------------------------------------------------------------ 3. presses at 3 spots
const spots = [
  ["top-left", 0, 31],
  ["centre", 6, 16],
  ["bottom-right", 11, 0],
];
let n = 3;
for (const [name, i, j] of spots) {
  const p = await crossing(i, j);
  const before = await evaluate(`window.__touch.length`);
  const y0 = await scrollY();
  await press(...p, 650);
  const fl = await evaluate(`window.__touch[window.__touch.length - 1]?.f ?? null`);
  const k = fl ? argmax(fl.values) : -1;
  const levels = await fr(`window.__padExplore.map().levels`);
  const km = argmax(levels);
  const peak = await fr(`window.__padExplore.feel().frame.peak`);
  const readout = await fr(`document.querySelector('.iso-plate-corner.readout, [data-readout], .ft-readout')?.textContent.trim() ?? ''`);
  ok(`press ${name}: ft:touch peak at sense ${i} drive ${j}`, fl && fl.press > 0.8 && k >= 0 && ij(k)[0] === i && ij(k)[1] === j, { press: fl?.press, peak: ij(k), lit: fl?.values.filter((v) => v > 0).length });
  ok(`press ${name}: map's brightest cell on the same crossing`, ij(km)[0] === i && ij(km)[1] === j, { map: ij(km), figPeak: peak });
  if (PHONE) ok(`press ${name}: no page scroll while pressing`, Math.abs((await scrollY()) - y0) < 1);
  const mapCell = await fr(`window.__padExplore.map().cell(${i}, ${j})`);
  const cross = await fr(`window.__padExplore.crossingClient(${i}, ${j})`);
  ok(`press ${name}: map cell row level with the crossing`, Math.abs(mapCell[1] + mapCell[3] / 2 - cross[1]) < 1, { cellMidY: +(mapCell[1] + mapCell[3] / 2).toFixed(2), crossY: +cross[1].toFixed(2) });
  console.log("   readout:", readout);
  await snap(`0${n++}-press-${name}`);
  await release();
  await sleep(150);
  if (name === "centre") await snap(`0${n++}-letting-go`);
  await sleep(650);
  const after = await evaluate(`window.__touch.slice(${before}).map(x => x.f)`);
  const zeros = after.filter((f) => f.press === 0 && f.values.every((v) => v === 0) && f.at === null);
  const last = after[after.length - 1];
  ok(`press ${name}: release fades to one all-zero frame`, zeros.length === 1 && last === zeros[0] || (zeros.length === 1 && last.press === 0), { frames: after.length, zeros: zeros.length });
}
ok("hint gone after the first press", !(await frElBox(".ft-reveal.ft-feel"))?.vis);
ok("camera unchanged by presses", (await cam()) === cam0);

// ------------------------------------------------------------------ 4. drag
{
  const p0 = await crossing(2, 6);
  const p1 = await crossing(9, 26);
  const before = await evaluate(`window.__touch.length`);
  if (PHONE) {
    await tdown(...p0);
    await sleep(400);
    for (let k = 1; k <= 20; k++) {
      await tmove(p0[0] + ((p1[0] - p0[0]) * k) / 20, p0[1] + ((p1[1] - p0[1]) * k) / 20);
      await sleep(30);
    }
    await sleep(200);
  } else {
    await down(...p0);
    await sleep(400);
    for (let k = 1; k <= 20; k++) {
      await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: p0[0] + ((p1[0] - p0[0]) * k) / 20, y: p0[1] + ((p1[1] - p0[1]) * k) / 20, button: "left", buttons: 1 });
      await sleep(30);
    }
    mouse = p1;
    await sleep(200);
  }
  const fl = await evaluate(`window.__touch[window.__touch.length - 1].f`);
  const k = argmax(fl.values);
  await snap(`0${n++}-drag-end`);
  await release();
  await sleep(800);
  const all = await evaluate(`window.__touch.slice(${before})`);
  const ats = all.map((x) => x.f.at).filter(Boolean);
  const gaps = all.slice(1).map((x, q) => x.t - all[q].t);
  ok("drag: the press follows the pointer", ij(k)[0] === 9 && ij(k)[1] === 26 && ats.length > 5 && ats[ats.length - 1].drive > ats[0].drive + 10, { end: ij(k), frames: all.length });
  ok("drag: frames <= 30 Hz", Math.min(...gaps) >= 25, { minGap: +Math.min(...gaps).toFixed(1) });
}
ok("camera unchanged by drag", (await cam()) === cam0);

// ------------------------------------------------------------------ 5. Show me
{
  const before = await evaluate(`window.__touch.length`);
  const label = await clickGo();
  ok("Feel it button reads Show me", /Show me/.test(label), label);
  await sleep(700);
  const fl = await evaluate(`window.__touch[window.__touch.length - 1]?.f`);
  const levels = await fr(`window.__padExplore.map().levels`);
  ok("Show me presses: map reacts", fl && fl.press > 0.5 && levels.some((v) => v > 0), { press: fl?.press });
  await snap(`0${n++}-showme`);
  // (the show is the home cover's 7.2 s choreography, lesson 1 fingerDemo: wait for its release and the fade after it)
  await until(`(() => { const f = window.__touch[window.__touch.length - 1]?.f; return f && f.press === 0; })()`, 9000);
  const last = await evaluate(`window.__touch[window.__touch.length - 1]?.f`);
  ok("Show me lets go", last && last.press === 0, { press: last?.press, frames: (await evaluate(`window.__touch.length`)) - before });
  ok("button now reads Next step", /Next step/.test((await goBtn()).text), (await goBtn()).text);
}

// ------------------------------------------------------------------ 6. theme toggle in "Feel it"
const toggleTheme = async () => {
  const t = await elBox("[data-theme-toggle]");
  if (!t || t.w === 0) {
    await evaluate(`document.querySelector('[data-theme-toggle]').click()`);
    return "js";
  }
  await click(...centre(t));
  return "real";
};
{
  const how = await toggleTheme();
  await sleep(400);
  const back = await until(`window.__st && window.__st.feel && window.__st.feel.on === true && window.__st.plan === 1 && window.__st.feel.map`, 12000);
  await sleep(900);
  s = await st();
  const dt = Math.abs(s.feel.map.y - s.feel.area.y),
    dh = Math.abs(s.feel.map.h - s.feel.area.h);
  ok(`theme toggle (${how}) keeps Feel it: feel + map aligned`, back && dt < 1 && dh < 1 && /Feel it/.test(await kicker()), { dt, dh, theme: await evaluate(`document.documentElement.dataset.theme`) });
  await snap(`0${n++}-theme-toggled`);
  await toggleTheme();
  await sleep(400);
  await until(`window.__st && window.__st.feel && window.__st.feel.on === true && window.__st.plan === 1 && window.__st.feel.map`, 12000);
  await sleep(900);
}

// ------------------------------------------------------------------ 7. step 3: take it apart
{
  const label = await clickGo();
  const t2 = Date.now();
  await until(`window.__st && window.__st.plan === 0`, 6000);
  const tPlan0 = Date.now() - t2;
  // the camera settles (the map's room eases out with the turn)
  let cA = await cam(), tSettle = 0;
  for (let q = 0; q < 40; q++) { await sleep(100); const cB = await cam(); if (cB === cA) { tSettle = Date.now() - t2; break; } cA = cB; }
  console.log(`   step 3: plan 0 after ${tPlan0} ms, camera settled after ${tSettle} ms`);
  ok("step 3: camera settles after the turn (< 3.2 s; critically damped tail)", tSettle > 0 && tSettle < 3200, { tPlan0, tSettle });
  await sleep(300);
  s = await st();
  ok("step 3 'Take it apart'", /Step 3 of 3 · Take it apart/.test(await kicker()), `${label} -> ${await kicker()}`);
  ok("step 3: feel off, iso view", s.feel?.on === false && s.plan === 0, { feel: s.feel?.on, plan: s.plan });
  const e = await frElBox(".ft-reveal:not(.ft-feel)");
  ok("step 3: 'Click to expand' hint visible", e?.vis, e?.text);
  const mp = await fr(`window.__padExplore.map()`);
  ok("step 3: touch map gone", !mp || !mp.shown || +mp.opacity === 0, mp && { shown: mp.shown, op: mp.opacity });
  ok("step 3: no demo card", (await evaluate(`document.querySelectorAll('.demo-card').length`)) === 0);
  await snap(`${n++}-step3`);
  // a real click on the pad (a point the figure says is a layer)
  const pt = await fr(`(() => { const s = document.querySelector('svg.iso-svg').getBoundingClientRect(); for (let y = s.top + s.height * 0.3; y < s.bottom - s.height * 0.2; y += 6) for (let x = s.left + s.width * 0.3; x < s.right - s.width * 0.3; x += 6) { const h = window.__padExplore.hitAt(x, y); if (h && h.part === 'lam_t') return [x, y]; } return null; })()`);
  const c0 = await cam();
  if (pt) {
    await click(...(await toPage(pt)));
    await sleep(REDUCED ? 500 : 1700);
    s = await st();
    // (all-labels mode: expanding shows every label at once, scripts/labels-all-review.mjs; no ONE picked label)
    ok("step 3: click on the pad expands in place", s.reveal?.open === true && (await cam()) === c0, { open: s.reveal?.open, camSame: (await cam()) === c0 });
    ok("step 3: no single picked label after expanding", !(await fr(`window.__padExplore.state().label`)));
    const cp = await frElBox(".ft-reveal-close");
    ok("collapse pill visible", cp?.vis, cp?.text);
    await snap(`${n++}-expanded`);
    if (cp?.vis) {
      await click(...(await toPage(centre(cp))));
      await sleep(REDUCED ? 500 : 1600);
      s = await st();
      const e2 = await frElBox(".ft-reveal:not(.ft-feel)");
      ok("collapse pill closes the pad, hint back", s.reveal?.open === false && e2?.vis && (await cam()) === c0, { open: s.reveal?.open });
      await snap(`${n++}-collapsed`);
    }
  } else ok("found a point on the pad to click", false);
}

// ------------------------------------------------------------------ 8. step 3's Show me, then the dots back
{
  // (the click above already did the step's show: its dot enters the step afresh, closed, the button reading Show me)
  const d2 = await elBox('.step-dot[data-k="2"]');
  await click(...centre(d2));
  await until(`window.__st && window.__st.reveal && window.__st.reveal.open === false`, 6000);
  await sleep(REDUCED ? 500 : 1500);
  const label = await clickGo(); // Show me (explode)
  await sleep(REDUCED ? 500 : 1600);
  ok("step 3 (by its dot) Show me expands; the last step's button reads Done", /Show me/.test(label) && (await st()).reveal?.open === true && /Done/.test((await goBtn()).text), `${label} -> ${(await goBtn()).text}`);
  // the "Feel it" dot: feel mode and the map back, aligned, no card
  const d = await elBox('.step-dot[data-k="1"]');
  await click(...centre(d));
  const back = await until(`window.__st && window.__st.feel && window.__st.feel.on === true && window.__st.plan === 1 && window.__st.feel.map`, 8000);
  await sleep(REDUCED ? 600 : 1500);
  s = await st();
  ok("the Feel it dot brings feel mode + map back aligned, no card", back && Math.abs(s.feel.map.y - s.feel.area.y) < 1 && (await evaluate(`document.querySelectorAll('.demo-card').length`)) === 0 && /Feel it/.test(await kicker()));
  await snap(`${n++}-back-to-feel`);
  // the robot's dot: its picture over the stage again, the figure still in feel mode underneath
  const d0 = await elBox('.step-dot[data-k="0"]');
  await click(...centre(d0));
  await sleep(REDUCED ? 400 : 900);
  const over = await evaluate(`(() => { const o = document.querySelector('.stage-over'); return Boolean(o && !o.hidden && o.classList.contains('is-on')); })()`);
  s = await st();
  ok("the robot's dot: the robot picture on, the figure in feel mode underneath", over && s.feel?.on === true && /On a robot/.test(await kicker()), { over, feel: s.feel?.on });
}

// ------------------------------------------------------------------ 9. lesson 2 step 1: Squeeze the Velostat
{
  await b.goto(`${BASE}#/lesson/the-sandwich`);
  const okCard = await until(`(() => { const c = document.querySelector('.demo-card[data-demo="velostat"]'); return c && c.classList.contains('is-on'); })()`, 15000);
  await sleep(900);
  ok("lesson 2 step 1 'Squeeze the Velostat'", /Step 1 of 4 · Squeeze the Velostat/.test(await kicker()), await kicker());
  const lab = await fr(`window.__padExplore.state().label`);
  // a phone's band leaves the figure's label no room left of it: the card in the band then leads to the Velostat itself
  // (one horizontal leader from the layer's right point to the card, src/ui/demo.ts)
  const leads = await cardLeads();
  ok("L2 step 1: Velostat label (or, in a phone's band, the card's own leader to the Velostat)", lab === "velostat" || lab?.id === "velostat" || JSON.stringify(lab).includes("velostat") || leads.ok, { lab, leads });
  ok("L2 step 1: velostat demo card on", okCard);
  const place = await evaluate(`document.querySelector('.demo-card')?.dataset.place`);
  const card = await elBox(".demo-card");
  fb = await frameBox();
  // the pad: sample the figure's hit test over the drawing; the label card
  const padPts = await fr(`(() => { const s = document.querySelector('svg.iso-svg').getBoundingClientRect(); const pts = []; for (let y = s.top; y < s.bottom; y += 5) for (let x = s.left; x < s.right; x += 5) { const h = window.__padExplore.hitAt(x, y); if (h && h.part) pts.push([x, y]); } return pts; })()`);
  const labB = await frElBox(".ft-label");
  const inCard = (x, y) => card && x >= card.x && x <= card.x + card.w && y >= card.y && y <= card.y + card.h;
  const padHits = padPts.filter(([x, y]) => inCard(fb.x + x, fb.y + y)).length;
  const labHit = labB && card && overlap({ x: fb.x + labB.x, y: fb.y + labB.y, w: labB.w, h: labB.h }, card);
  ok(`L2 step 1: card (${place}) clear of the pad and label`, padHits === 0 && !labHit, { place, padHits, labHit, card });
  await snap(`${n++}-step3`);
  // Velostat demo review
  const text = await evaluate(`document.querySelector('.demo-card').textContent`);
  ok("velostat card says illustrative, no newtons", /illustrative/i.test(text) && !/newton|\b\d+(\.\d+)?\s?N\b/i.test(text), text.replace(/\s+/g, " ").slice(0, 160));
  await evaluate(`document.querySelector('.demo-card').scrollIntoView({ block: 'nearest' })`);
  await sleep(200);
  const readAt = async (keys) => {
    for (const k of keys) await b.key(k);
    await sleep(80);
    return evaluate(`(() => { const c = document.querySelector('.vd-chart'); const svg = c.querySelector('svg'); const vb = svg.viewBox.baseVal; const d = svg.querySelector('.vd-dot'); return { now: +c.getAttribute('aria-valuenow'), read: document.querySelector('.vd-read-v').textContent, cx: +d.getAttribute('cx'), cy: +d.getAttribute('cy'), W: vb.width, H: vb.height }; })()`);
  };
  await evaluate(`document.querySelector('.vd-chart').focus({ focusVisible: true })`);
  const exp = (p) => {
    const e = 1 - (1 - p) * (1 - p);
    return 200e3 * Math.pow(1.4e3 / 200e3, e);
  };
  const fmt = (r) => (r / 1000 >= 1000 ? `${(r / 1e6).toFixed(1)} MΩ` : r / 1000 >= 10 ? `${Math.round(r / 1000)} kΩ` : `${(r / 1000).toFixed(1)} kΩ`);
  const onCurve = (q, p) => {
    // (the chart's margins: velostat-demo.ts, narrower on a phone-narrow chart under 150 px)
    const M = q.W < 150 ? { l: 28, r: 8, t: 7, b: 18 } : { l: 34, r: 10, t: 8, b: 20 };
    const pw = q.W - M.l - M.r,
      ph = q.H - M.t - M.b;
    const X = M.l + p * pw,
      Y = M.t + ((6 - Math.log10(exp(p))) / 3) * ph;
    return Math.abs(q.cx - X) < 0.2 && Math.abs(q.cy - Y) < 0.2;
  };
  const q0 = await readAt(["Home"]);
  ok("velostat press 0: R = 200 kΩ, dot on curve", q0.now === 0 && q0.read === `R = ${fmt(exp(0))}` && onCurve(q0, 0), q0);
  await snap(`${n++}-velostat-0`);
  const q5 = await readAt(Array(10).fill("ArrowRight"));
  ok("velostat press 0.5: R matches taxel.mjs, dot on curve", q5.now === 50 && q5.read === `R = ${fmt(exp(0.5))}` && onCurve(q5, 0.5), { ...q5, want: fmt(exp(0.5)) });
  await snap(`${n++}-velostat-05`);
  const q1 = await readAt(["End"]);
  ok("velostat press 1: R = 1.4 kΩ, dot on curve", q1.now === 100 && q1.read === `R = ${fmt(exp(1))}` && onCurve(q1, 1), q1);
  await snap(`${n++}-velostat-1`);
  const qd = await readAt(["PageDown"]);
  ok("velostat PageDown -0.2", qd.now === 80, qd.now);
  await evaluate(`document.querySelector('.vd-chart').blur()`);
  if (!PHONE) {
    // scrub with a real mouse on the chart at 25 % of the plot
    const cb = await elBox(".vd-chart");
    const x = cb.x + 34 + 0.25 * (cb.w - 44);
    await mv(x, cb.y + cb.h / 2, 8);
    await sleep(150);
    const sc = await evaluate(`+document.querySelector('.vd-chart').getAttribute('aria-valuenow')`);
    ok("velostat scrub (hover) sets press ~0.25", Math.abs(sc - 25) <= 2, sc);
    await mv(10, 10, 6);
  }
  // loop motion vs reduced motion
  await evaluate(`document.querySelector('.demo-card').scrollIntoView({ block: 'center' })`);
  await sleep(3300);
  const samples = [];
  for (let q = 0; q < 8; q++) {
    samples.push(await evaluate(`+document.querySelector('.vd-chart').getAttribute('aria-valuenow')`));
    await sleep(350);
  }
  const moved = new Set(samples).size > 1;
  if (REDUCED) ok("reduced motion: no loop (press stays)", !moved, samples.join(","));
  else ok("loop resumes after the pointer / keys leave", moved, samples.join(","));

  // details window from the label
  await evaluate(`document.querySelector('iframe.figure-frame').scrollIntoView({ block: 'nearest' })`);
  await sleep(300);
  const more = await frElBox(".ft-label-more");
  if (more?.vis) {
    await click(...(await toPage(centre(more))));
    const opened = await until(`(() => { const d = document.querySelector('.details'); return d && !d.hidden && d.getBoundingClientRect().width > 0; })()`, 3000);
    await sleep(400);
    ok("Details › opens the site's details window", opened, await evaluate(`document.querySelector('.det-title')?.textContent`));
    await snap(`${n++}-details`);
    await b.key("Escape");
    await sleep(400);
    ok("Escape closes details", await evaluate(`(() => { const d = document.querySelector('.details'); return !d || d.hidden || d.getBoundingClientRect().width === 0; })()`));
  } else if (leads.ok) ok("no label to open Details from: the card in the band names the Velostat (a phone)", true, leads);
  else ok("label has a visible Details ›", false);

  // theme toggle in lesson 2 step 1 keeps the pose
  await toggleTheme();
  await sleep(500);
  // (lesson 2's figure has no reveal mode: "apart" is the explode act's state)
  const back = await until(`(() => { const s = window.__padExplore && window.__padExplore.state(); return Boolean(s && s.apart === true && (JSON.stringify(s.label ?? '').includes('velostat') || ${leads.ok})); })()`, 12000, true);
  const okCard2 = await until(`(() => { const c = document.querySelector('.demo-card[data-demo="velostat"]'); return c && c.classList.contains('is-on'); })()`, 6000);
  await sleep(800);
  ok("theme toggle in L2 step 1: expanded + label + card back", back && okCard2 && /Velostat/.test(await kicker()), { label: (await st())?.label });
  await snap(`${n++}-l2-step1-theme`);
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
