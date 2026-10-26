// Lesson 2 step 2's card ("One touch spot"; step 1 until "Squeeze the Velostat" came in front of it from lesson 1), a 3D
// crossing wired into the divider (src/widgets/unit-demo.ts): headless Chrome over CDP on a BUILT site, real mouse and
// key input (no npm deps; Node 22). The lesson opens on its step 1; a real click on the step-2 dot goes to the card.
//   npx vite build --outDir /tmp/lf-dist && npx vite preview --outDir /tmp/lf-dist --port 8931 &
//   node scripts/unit-3d-review.mjs --size 1440x900 --theme light [--reduced] [--base http://127.0.0.1:8931/]
//        [--out review/lesson2-unit-3d]
// Checks: the card opens beside the pad (never under it); three moments of the loop (rest, mid, hard: the tag's R and
// the voltmeter's V are the models' at the card's press, the figure's ring glows with the same press); the keys (Home,
// 10 × →, End: press 0, 0.5, 1 exactly, numbers against taxel.mjs and divider.mjs); a hover and a drag on the 3D unit
// scrub the press; the current's dots run ~I(hard)/I(rest) times faster pressed hard; no console errors. PNGs: the page
// and the card at each loop moment, and close crops of the unit at rest and pressed.
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { mkdirSync, writeFileSync } from "node:fs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const { launch, sleep } = await import(pathToFileURL(resolve(root, "../flexitac-anatomy/figures/pad/shots/clean/cdp.mjs")).href);
const { rTaxel } = await import(pathToFileURL(resolve(root, "../flexitac-anatomy/shared/models/taxel.mjs")).href);
const { vA0, R1, VCC } = await import(pathToFileURL(resolve(root, "../flexitac-anatomy/shared/models/divider.mjs")).href);

const args = process.argv.slice(2);
const opt = (n, d) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : d);
const flag = (n) => args.includes(`--${n}`);
const [W, H] = opt("size", "1440x900").split("x").map(Number);
const THEME = opt("theme", "light");
const REDUCED = flag("reduced");
const BASE = opt("base", "http://127.0.0.1:8931/");
const OUT = resolve(root, opt("out", "review/lesson2-unit-3d"));
const tag = `${W}x${H}-${THEME}${REDUCED ? "-reduced" : ""}`;
mkdirSync(OUT, { recursive: true });

const results = [];
const ok = (name, pass, info = "") => {
  results.push({ name, pass: Boolean(pass), info });
  console.log(`${pass ? "PASS" : "FAIL"}  ${tag}  ${name}${info !== "" ? "  " + (typeof info === "string" ? info : JSON.stringify(info)) : ""}`);
};
// the card's own formats (src/ui/ohms.ts fmtR; V to 2 decimals); V with R_on left out, as the card does
const fmtR = (r) => {
  const k = r / 1000;
  if (k >= 1000) return `${(k / 1000).toFixed(1)} MΩ`;
  if (k >= 10) return `${Math.round(k)} kΩ`;
  return `${k.toFixed(1)} kΩ`;
};
const want = (p) => {
  const r = rTaxel(p);
  return { R: `R = ${fmtR(r)}`, V: `V = ${vA0(r, { rOn: 0 }).toFixed(2)} V`, r, v: vA0(r, { rOn: 0 }) };
};

const b = await launch({ width: W, height: H, reduced: REDUCED, scale: 1 });
const { send, evaluate } = b;
const features = [{ name: "prefers-color-scheme", value: THEME }];
if (REDUCED) features.push({ name: "prefers-reduced-motion", value: "reduce" });
await send("Emulation.setEmulatedMedia", { features });
await send("Page.addScriptToEvaluateOnNewDocument", {
  source: `if (window === window.top) { window.__errs = [];
    addEventListener('message', (e) => { const d = e.data; if (!d || typeof d.type !== 'string') return;
      if (d.type === 'ft:error') window.__errs.push(d);
      else if (d.type === 'ft:focus') window.__focus = d;
      else if (d.type === 'ft:state') window.__st = d.state; }); }`,
});
const fr = (js) => evaluate(`(() => { const f = document.querySelector('iframe.figure-frame'); if (!f || !f.contentWindow) return null; return f.contentWindow.eval(${JSON.stringify(js)}); })()`);
const until = async (js, ms = 8000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try {
      if (await evaluate(js)) return true;
    } catch {}
    await sleep(40);
  }
  return false;
};
const box = (sel) => evaluate(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; })()`);
/** The card's state, read in one go: its press (2 decimals, from the slider's text), the tag's R, the meter's V. */
const state = () =>
  evaluate(`(() => { const c = document.querySelector('.demo-card[data-demo="unit"]'); if (!c) return null; const a = c.querySelector('.ud-anim'); const t = a.getAttribute('aria-valuetext') || '';
    const m = t.match(/press ([\\d.]+) of 1/); const r = c.getBoundingClientRect();
    return { p: m ? +m[1] : -1, R: c.querySelector('.ud-val')?.textContent ?? '', V: (() => { const t = c.querySelector('.ud-read')?.textContent ?? ''; return t && !t.startsWith('V = ') ? 'V = ' + t : t; })(), text: t, place: c.dataset.place, compact: c.hasAttribute('data-compact'), on: c.classList.contains('is-on'),
      card: { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) }, dots: +(getComputedStyle(c.querySelector('.ud-dot')).strokeDashoffset.replace('px', '')) || 0 }; })()`);
const figPress = async () => (await fr(`window.__padExplore && window.__padExplore.focus ? window.__padExplore.focus().p : -1`)) ?? -1;
const shotCard = async (name, scale = 2) => {
  const c = await box('.demo-card[data-demo="unit"]');
  await b.shot(join(OUT, `${tag}-${name}.png`), { x: c.x - 4, y: c.y - 4, width: c.w + 8, height: c.h + 8, scale });
};
const shotUnit = async (name) => {
  const u = await box(".ud-hit");
  const a = await box(".ud-anim");
  await b.shot(join(OUT, `${tag}-${name}.png`), { x: a.x, y: a.y - 4, width: a.w, height: u.h + 12, scale: 3 });
};
let mouse = [5, 5];
const mv = async (x, y, steps = 8) => {
  const [x0, y0] = mouse;
  for (let k = 1; k <= steps; k++) {
    await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: x0 + ((x - x0) * k) / steps, y: y0 + ((y - y0) * k) / steps, button: "none" });
    await sleep(12);
  }
  mouse = [x, y];
};

// ------------------------------------------------------------------ 1. open: the card beside the pad
await b.goto(`${BASE}#/lesson/the-sandwich`);
// the lesson opens on step 1 (the Velostat card); the step-2 dot, clicked for real, brings the unit card
await until(`(() => { const c = document.querySelector('.demo-card[data-demo="velostat"]'); return c && c.classList.contains('is-on'); })()`, 15000);
await sleep(600);
{
  const d = await box('.step-dot[data-k="1"]');
  await mv(d.x + d.w / 2, d.y + d.h / 2);
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x: d.x + d.w / 2, y: d.y + d.h / 2, button: "left", buttons: 1, clickCount: 1 });
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: d.x + d.w / 2, y: d.y + d.h / 2, button: "left", buttons: 0, clickCount: 1 });
}
const opened = await until(`window.__focus && window.__focus.ring && (() => { const c = document.querySelector('.demo-card[data-demo="unit"]'); return c && c.classList.contains('is-on'); })()`, 15000);
await sleep(900);
const s0 = await state();
ok("opens: card on, beside the pad", opened && s0 && s0.place === "beside", s0 && { place: s0.place, compact: s0.compact, card: s0.card });
const stage = await box(".stage-body");
ok("card inside the stage", s0.card.x >= stage.x && s0.card.y >= stage.y && s0.card.x + s0.card.w <= stage.x + stage.w + 0.5 && s0.card.y + s0.card.h <= stage.y + stage.h + 0.5, { card: s0.card, stage });
ok("no horizontal scroll", await evaluate(`document.scrollingElement.scrollWidth <= innerWidth + 1`));
const kick = await evaluate(`document.querySelector('.ud-kicker').innerText.replace(/\\n/g, ' ')`);
ok("kicker: ONE TOUCH SPOT · ILLUSTRATIVE", /ONE TOUCH SPOT/.test(kick) && /ILLUSTRATIVE/.test(kick), kick);
const lines = await evaluate(`(() => { const t = document.querySelector('.steps-text:not(.steps-sizer)'); if (!t) return null; const lh = parseFloat(getComputedStyle(t).lineHeight); return { h: t.getBoundingClientRect().height, lh, lines: Math.round(t.getBoundingClientRect().height / lh), w: t.getBoundingClientRect().width, text: t.innerText }; })()`);
ok(`step text: ${lines.lines} line(s) in a ${Math.round(lines.w)} px column`, lines.lines <= 3, lines.text);
const extents = await evaluate(`(() => { const s = document.querySelector('.ud-svg'); const sb = s.getBoundingClientRect(); let l = 1e9, r = -1e9; for (const e of s.querySelectorAll('text, path, circle, rect, ellipse')) { if (e.classList.contains('ud-hit') || e.closest('defs, mask')) continue; const q = e.getBoundingClientRect(); if (!q.width && !q.height) continue; l = Math.min(l, q.left); r = Math.max(r, q.right); } return { left: +(l - sb.left).toFixed(1), right: +(r - sb.left).toFixed(1), w: +sb.width.toFixed(1) }; })()`);
ok("drawing: every part and label inside the card's drawing width", extents.left >= -0.5 && extents.right <= extents.w + 0.5, extents);
await b.shot(join(OUT, `${tag}-00-page.png`));

// ------------------------------------------------------------------ 2. three moments of the loop
if (!REDUCED) {
  const moments = [
    ["01-rest", (s) => s.p === 0, 250],
    ["02-mid", (s) => s.p >= 0.46 && s.p <= 0.54, 0],
    ["03-hard", (s) => s.p === 1, 120],
  ];
  for (const [name, hit, settle] of moments) {
    let s = null;
    const t1 = Date.now();
    // (wait for the moment to come round; for rest and hard, make sure it is the steady part of the loop)
    while (Date.now() - t1 < 9000) {
      s = await state();
      if (s && hit(s)) {
        if (!settle) break;
        await sleep(settle);
        const s2 = await state();
        if (hit(s2)) {
          s = s2;
          break;
        }
      }
      await sleep(15);
    }
    // (the slider's text rounds the press to 2 decimals: the models must agree somewhere in that rounding)
    const near = [0, ...Array.from({ length: 101 }, (_, i) => -0.005 + i * 0.0001)].map((d) => want(Math.min(1, Math.max(0, s.p + d))));
    const w = near.find((n) => n.R === s.R && n.V === s.V) ?? near[0];
    const fp = await figPress();
    ok(`loop ${name}: press ${s.p.toFixed(2)} -> tag "${s.R}" (model ${w.R}), meter "${s.V}" (model ${w.V})`, s.R === w.R && s.V === w.V, { text: s.text });
    ok(`loop ${name}: figure's ring glows with the same press`, Math.abs(fp - s.p) < 0.15, { card: s.p, figure: +(+fp).toFixed(3) });
    await b.shot(join(OUT, `${tag}-${name}-page.png`));
    await shotCard(`${name}-card`);
  }
} else {
  const a = await state();
  await sleep(2000);
  const c = await state();
  ok("reduced motion: no loop (press stays 0) and the dots stand still", a.p === 0 && c.p === 0 && a.dots === c.dots, { a: [a.p, a.dots], c: [c.p, c.dots] });
}

// ------------------------------------------------------------------ 3. keys: press 0, 0.5, 1 exactly
{
  // focus the slider with a real click on the circuit (below the 3D unit: no scrub there)
  const vm = await box(".ud-vm");
  await mv(vm.x + vm.w / 2, vm.y + vm.h / 2, 6);
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x: mouse[0], y: mouse[1], button: "left", buttons: 1, clickCount: 1 });
  await sleep(30);
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: mouse[0], y: mouse[1], button: "left", buttons: 0, clickCount: 1 });
  await sleep(100);
  ok("a click on the circuit focuses the slider", await evaluate(`document.activeElement?.classList.contains('ud-anim')`));
  await mv(5, 5, 6);
  const checks = [
    ["Home", 0, ["Home"]],
    ["10 × →", 0.5, Array(10).fill("ArrowRight")],
    ["End", 1, ["End"]],
  ];
  const speeds = {};
  for (const [label, p, keys] of checks) {
    for (const k of keys) await b.key(k);
    await sleep(250);
    const s = await state();
    const w = want(p);
    ok(`keys ${label}: press ${p} -> ${s.R}, ${s.V} (models: R ${Math.round(w.r)} Ω, V ${w.v.toFixed(4)} V)`, s.p === p && s.R === w.R && s.V === w.V, { got: [s.p, s.R, s.V] });
    if (p === 0) await shotUnit("04-unit-rest");
    if (p === 1) await shotUnit("05-unit-pressed");
    if (p === 0.5) await shotUnit("04b-unit-mid");
    // the current's dots: how far they move in 1 s at this press
    const d0 = (await state()).dots;
    await sleep(1000);
    const d1 = (await state()).dots;
    speeds[p] = Math.abs(d1 - d0);
  }
  const iRatio = (VCC / (R1 + rTaxel(1))) / (VCC / (R1 + rTaxel(0)));
  if (!REDUCED) ok(`dots: speed ∝ current (rest ${speeds[0].toFixed(1)} px/s, mid ${speeds[0.5].toFixed(1)}, hard ${speeds[1].toFixed(1)}; I ratio ${iRatio.toFixed(1)})`, speeds[1] > speeds[0.5] && speeds[0.5] > speeds[0] && Math.abs(speeds[1] / speeds[0] - iRatio) / iRatio < 0.25);
  await evaluate(`document.activeElement?.blur()`);
}

// ------------------------------------------------------------------ 4. hover and drag on the 3D unit
{
  const u = await box(".ud-hit");
  const cx = u.x + u.w * 0.62;
  // hover at 44 % of the unit's height: press (0.44 - 0.14) / 0.6 = 0.5
  await mv(cx, u.y + u.h * 0.44, 10);
  await sleep(300);
  const h1 = await state();
  await sleep(700);
  const h2 = await state();
  ok("hover on the unit: press follows the pointer (~0.5), the loop pauses", Math.abs(h1.p - 0.5) < 0.06 && h1.p === h2.p, { p1: h1.p, p2: h2.p });
  ok("hover: tag and meter are the models' at that press", h2.R === want(h2.p).R && h2.V === want(h2.p).V, [h2.R, h2.V]);
  // drag down from the top of the unit: harder
  await mv(cx, u.y + u.h * 0.16, 6);
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x: mouse[0], y: mouse[1], button: "left", buttons: 1, clickCount: 1 });
  const d0 = await state();
  for (let k = 1; k <= 10; k++) {
    await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: cx, y: u.y + u.h * (0.16 + (0.62 * k) / 10), button: "left", buttons: 1 });
    await sleep(25);
  }
  const d1 = await state();
  await sleep(350);
  const fp = await figPress();
  await b.shot(join(OUT, `${tag}-06-drag-page.png`));
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: cx, y: u.y + u.h * 0.78, button: "left", buttons: 0, clickCount: 1 });
  mouse = [cx, u.y + u.h * 0.78];
  ok("drag down on the unit: press rises to hard", d0.p < 0.1 && d1.p > 0.95, { from: d0.p, to: d1.p });
  ok("drag: figure's ring in step", Math.abs(fp - d1.p) < 0.1, { figure: fp });
  await mv(5, 5, 6);
}

const errs = b.problems.filter((p) => !/favicon/i.test(p));
const fe = await evaluate(`window.__errs`);
ok("no console errors / exceptions", errs.length === 0, errs.slice(0, 5));
ok("no ft:error", !fe || fe.length === 0, fe);
writeFileSync(join(OUT, `${tag}.json`), JSON.stringify(results, null, 1));
const fails = results.filter((r) => !r.pass);
console.log(`SUMMARY ${tag}: ${results.length - fails.length}/${results.length} pass`);
b.close();
process.exit(0);
