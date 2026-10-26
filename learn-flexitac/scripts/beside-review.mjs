// Demo cards BESIDE the figure at every window size (src/ui/demo.ts; Fig 1's reserve act and focus room): Lesson 1 step
// 3 (velostat) and Lesson 2 step 1 (unit) on a BUILT site, headless Chrome over CDP, real mouse / touch input (no npm
// deps; Node 22).
//   npx vite build --outDir /tmp/lf-dist && npx vite preview --outDir /tmp/lf-dist --port 8957 &
//   node scripts/beside-review.mjs --size 390x844 --theme dark [--reduced] [--base http://127.0.0.1:8957/]
//        [--out review/beside]
// A window under 500 px wide is driven as a phone (mobile, touch). Sizes reviewed (one run each): 320x568 (the WCAG
// reflow width), 340x720, 360x780, 375x667, 390x844, 412x915, 768x1024, 1024x640, 1024x768, 1152x648, 1280x720,
// 1280x800, 1366x768, 1440x900, 1920x1080. Checks, for each card:
//   - the card sits beside the figure: over the stage (side, corner or the band "beside"; there is no other place);
//     inside the stage; no horizontal page scroll;
//   - it covers none of the pad (the figure's own hit test, sampled every 4 px over the card), the pad's label, the
//     "Click to collapse" pill or the viewbar;
//   - a leader, if drawn, is ONE horizontal line from the ring (unit) or the Velostat's right point (velostat, when the
//     figure's label has no room left of the band) to the card's left edge, its dot there;
//   - the figure moves only on step entry: sampled every 50 ms in the page, it is still once the card shows, and it
//     moved in one go (no second movement after a pause);
//   - the figure's "Click to collapse" pill is off the pad and the mat (lesson 1);
//   - another part picked (a real click / tap on it): the card steps aside, the figure does not move, and that part's
//     labels show (an FPC: its label and its gold fingers' label), inside the drawing and off the other parts; picking
//     the step's part again (lesson 1) or nothing (lesson 2) brings the card back;
//   - lesson 1: a theme toggle in step 3 keeps the band and the card beside; leaving step 3 (dot 2) gives the band back
//     and the figure lands exactly where it was in step 2;
//   - lesson 2: Next step gives the band back (Fig 1's --ft-band 0, the focus camera home).
// PNGs (the stage, and the card at 3x) and <tag>.json land in --out.
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
const REDUCED = flag("reduced");
const PHONE = W < 500;
const BASE = opt("base", "http://127.0.0.1:8957/");
const OUT = resolve(root, opt("out", "review/beside"));
const tag = `${W}x${H}-${THEME}${REDUCED ? "-reduced" : ""}`;
mkdirSync(OUT, { recursive: true });

const results = [];
const ok = (name, pass, info = "") => {
  results.push({ name, pass: Boolean(pass), info });
  console.log(`${pass ? "PASS" : "FAIL"}  ${tag}  ${name}${info !== "" ? "  " + (typeof info === "string" ? info : JSON.stringify(info)) : ""}`);
};

const b = await launch({ width: W, height: H, reduced: REDUCED, mobile: PHONE, touch: PHONE, scale: 1 });
const { send, evaluate } = b;
const features = [{ name: "prefers-color-scheme", value: THEME }];
if (REDUCED) features.push({ name: "prefers-reduced-motion", value: "reduce" });
await send("Emulation.setEmulatedMedia", { features });
await send("Page.addScriptToEvaluateOnNewDocument", {
  source: `if (window === window.top) { window.__errs = [];
    addEventListener('message', (e) => { const d = e.data; if (!d || typeof d.type !== 'string') return;
      if (d.type === 'ft:error') window.__errs.push(d);
      else if (d.type === 'ft:focus') window.__focus = d;
      else if (d.type === 'ft:band') window.__band = d;
      else if (d.type === 'ft:state') window.__st = d.state; }); }`,
});

const until = async (js, ms = 10000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try {
      if (await evaluate(js)) return true;
    } catch {}
    await sleep(50);
  }
  return false;
};
const fr = (js) => evaluate(`(() => { const f = document.querySelector('iframe.figure-frame'); if (!f || !f.contentWindow) return null; return f.contentWindow.eval(${JSON.stringify(js)}); })()`);
const box = (sel) => evaluate(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; })()`);
const frameBox = () => evaluate(`(() => { const f = document.querySelector('iframe.figure-frame'); const r = f.getBoundingClientRect(); return { x: r.left + f.clientLeft, y: r.top + f.clientTop, w: f.clientWidth, h: f.clientHeight }; })()`);
/** A box inside the figure (iframe px), or null when it is hidden. */
const frBox = (sel) => fr(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e || e.hidden) return null; const r = e.getBoundingClientRect(); if (!r.width || !r.height || getComputedStyle(e).visibility === 'hidden' || +getComputedStyle(e).opacity < 0.05) return null; return { x: r.left, y: r.top, w: r.width, h: r.height }; })()`);
const overlap = (a, c, m = 0) => a && c && a.x < c.x + c.w - m && c.x < a.x + a.w - m && a.y < c.y + c.h - m && c.y < a.y + a.h - m;
const shift = (q, o) => q && { x: q.x + o.x, y: q.y + o.y, w: q.w, h: q.h };

// real input: a tap on a phone, a mouse click elsewhere
let mouse = [5, 5];
const click = async (x, y) => {
  if (PHONE) {
    await send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y, id: 1 }] });
    await sleep(50);
    await send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    return;
  }
  const [x0, y0] = mouse;
  for (let k = 1; k <= 6; k++) {
    await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: x0 + ((x - x0) * k) / 6, y: y0 + ((y - y0) * k) / 6, button: "none" });
    await sleep(12);
  }
  mouse = [x, y];
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", buttons: 1, clickCount: 1 });
  await sleep(40);
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", buttons: 0, clickCount: 1 });
};
const clickEl = async (sel) => {
  await evaluate(`document.querySelector(${JSON.stringify(sel)}).scrollIntoView({ block: 'nearest' })`);
  await sleep(150);
  const q = await box(sel);
  await click(q.x + q.w / 2, q.y + q.h / 2);
};
const away = async () => {
  if (!PHONE) {
    await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 3, y: 3, button: "none" });
    mouse = [3, 3];
  }
};

/** The figure's camera now (its world and reader transforms) and its band, for "did it move". */
const CAM = `(() => { const f = document.querySelector('iframe.figure-frame'); const d = f && f.contentDocument; if (!d) return ''; const w = d.querySelector('.pd-world'); const v = d.querySelector('.pd-view');
  return (w ? w.getAttribute('transform') || '' : '') + '|' + (v ? v.getAttribute('transform') || '' : '') + '|' + getComputedStyle(d.querySelector('.pd')).getPropertyValue('--ft-band').trim(); })()`;
const cam = () => evaluate(CAM);
const startSampler = () =>
  evaluate(`(() => { window.__samples = []; const t0 = performance.now(); clearInterval(window.__sampler);
    window.__sampler = setInterval(() => { const c = document.querySelector('.demo-card'); window.__samples.push({ t: Math.round(performance.now() - t0), cam: ${CAM}, on: Boolean(c && c.classList.contains('is-on')) }); }, 50); return true; })()`);
const stopSampler = () => evaluate(`(() => { clearInterval(window.__sampler); return window.__samples; })()`);
/** Two camera strings the same within 0.05 px (the transforms are printed to 0.01: a sub-pixel drift is not a move). */
const nums = (s) => (s.match(/-?\d+(\.\d+)?/g) || []).map(Number);
const sameCam = (a, b) => {
  const p = nums(a);
  const q = nums(b);
  return p.length === q.length && p.every((v, i) => Math.abs(v - q[i]) < 0.05);
};
/** From the samples: when the card came on, the figure's last change, and how many separate movements it made (a pause
 *  of 400 ms or more splits them). */
function motion(samples) {
  const on = samples.find((s) => s.on);
  let last = -1;
  let moves = 0;
  let prevT = -1e9;
  for (let i = 1; i < samples.length; i++) {
    if (!sameCam(samples[i].cam, samples[i - 1].cam)) {
      if (samples[i].t - prevT > 400) moves++;
      prevT = samples[i].t;
      last = samples[i].t;
    }
  }
  return { cardOn: on ? on.t : null, lastMove: last, moves };
}

/** The card's place and the figure around it: every placement check. */
async function checkCard(label, demo) {
  const c = await evaluate(`(() => { const c = document.querySelector('.demo-card[data-demo="${demo}"]'); if (!c) return null; const r = c.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height, place: c.dataset.place, compact: c.hasAttribute('data-compact'), narrow: c.hasAttribute('data-narrow'), on: c.classList.contains('is-on') && !c.classList.contains('is-waiting') && +getComputedStyle(c).opacity > 0.9 }; })()`);
  ok(`${label}: card on`, c && c.on, c);
  if (!c) return null;
  ok(`${label}: card beside the figure (place ${c.place}${c.compact ? ", compact" : ""}${c.narrow ? ", narrow" : ""})`, ["side", "corner", "beside"].includes(c.place), c.place);
  const sb = await box(".stage-body");
  ok(`${label}: card inside the stage`, c.x >= sb.x - 0.5 && c.y >= sb.y - 0.5 && c.x + c.w <= sb.x + sb.w + 0.5 && c.y + c.h <= sb.y + sb.h + 0.5, { card: c, stage: sb });
  ok(`${label}: no horizontal page scroll`, await evaluate(`document.scrollingElement.scrollWidth <= innerWidth + 1`));
  const fb = await frameBox();
  // the pad under the card: the figure's own hit test, every 4 px over the card (iframe px)
  const hits = await fr(`(() => { const out = []; for (let y = ${c.y - fb.y}; y < ${c.y + c.h - fb.y}; y += 4) for (let x = ${c.x - fb.x}; x < ${c.x + c.w - fb.x}; x += 4) { const h = window.__padExplore.hitAt(x, y); if (h && h.part) out.push(h.part); } return out; })()`);
  ok(`${label}: card covers none of the pad`, hits.length === 0, hits.length ? { parts: [...new Set(hits)], n: hits.length } : "");
  // (the first label on show: the second one, an FPC's gold fingers', may come first in the DOM, hidden)
  const lab = shift(await frBox(".ft-label:not([hidden])"), fb);
  ok(`${label}: card clear of the pad's label`, !overlap(c, lab), lab ? { label: lab } : "no label shown");
  const pill = shift(await frBox(".ft-reveal-close"), fb);
  ok(`${label}: card clear of the "collapse" pill`, !overlap(c, pill), pill ?? "no pill");
  const bar = shift(await frBox(".ft-viewbar"), fb);
  ok(`${label}: card clear of the viewbar`, !overlap(c, bar), bar ?? "");
  // the leader, if any: one horizontal line ending on the card's left edge, its dot on the anchor
  const L = await evaluate(`(() => { const s = document.querySelector('.demo-leader'); if (!s || s.classList.contains('is-hidden')) return null; const r = s.getBoundingClientRect(); const d = s.querySelector('.demo-leader-line').getAttribute('d') || ''; const m = d.match(/^M([\\d.-]+) ([\\d.-]+)H([\\d.-]+)$/); const e = s.querySelector('.demo-leader-end');
    return m ? { x0: r.left + +m[1], y: r.top + +m[2], x1: r.left + +m[3], dot: [r.left + +e.getAttribute('cx'), r.top + +e.getAttribute('cy')] } : { d }; })()`);
  if (demo === "unit") {
    const f = await evaluate(`window.__focus`);
    const ring = f && f.ring ? { x: fb.x + f.ring.x, y: fb.y + f.ring.y, rx: f.ring.rx } : null;
    ok(`${label}: one horizontal leader, ring -> card`, L && L.x0 !== undefined && ring && Math.abs(L.x0 - (ring.x + ring.rx)) < 1 && Math.abs(L.y - ring.y) < 1 && Math.abs(L.x1 - c.x) < 1, { L, ring });
  } else if (c.place === "beside" && !lab) {
    const band = await evaluate(`window.__band`);
    const a = band && band.anchor ? { x: fb.x + band.anchor.x, y: fb.y + band.anchor.y } : null;
    ok(`${label}: no room for the figure's label: one horizontal leader, the Velostat -> card`, L && L.x0 !== undefined && a && band.anchor.id === "velostat" && Math.abs(L.x0 - a.x) < 1 && Math.abs(L.y - a.y) < 1 && Math.abs(L.x1 - c.x) < 1, { L, anchor: band && band.anchor });
  } else ok(`${label}: no leader (the figure's label names the Velostat)`, !L, L ?? "");
  return c;
}
const shots = async (name) => {
  const s = await box(".stage-body");
  await evaluate(`document.querySelector('.stage-body').scrollIntoView({ block: 'nearest' })`);
  await sleep(100);
  const s2 = await box(".stage-body");
  await b.shot(join(OUT, `${tag}-${name}-stage.png`), { x: s2.x, y: Math.max(0, s2.y), width: s2.w, height: Math.min(s2.h, H - Math.max(0, s2.y)), scale: PHONE ? 2 : 1 });
  const c = await box(".demo-card");
  if (c) await b.shot(join(OUT, `${tag}-${name}-card.png`), { x: c.x - 4, y: c.y - 4, width: c.w + 8, height: c.h + 8, scale: 3 });
  return s;
};

/** Click / tap a part of the figure: the middle (by x) of the points the figure's own hit test gives it. */
const pickPart = async (part) => {
  await evaluate(`document.querySelector('.stage-body').scrollIntoView({ block: 'nearest' })`);
  await sleep(150);
  const fb = await frameBox();
  const pt = await fr(`(() => { const pts = []; for (let y = 6; y < innerHeight; y += 3) for (let x = 6; x < innerWidth; x += 3) { const h = window.__padExplore.hitAt(x, y); if (h && h.part === ${JSON.stringify(part)}) pts.push([x, y]); } pts.sort((a, b) => a[0] - b[0]); return pts[Math.floor(pts.length / 2)] || null; })()`);
  if (!pt) return false;
  await click(fb.x + pt[0], fb.y + pt[1]);
  return true;
};
/** Nothing picked: Escape (mouse), or a tap on an empty spot of the drawing (phone). */
const pickNothing = async () => {
  if (!PHONE) {
    await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
    await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
    return;
  }
  const fb = await frameBox();
  const pt = await fr(`(() => { for (let y = 60; y < innerHeight * 0.6; y += 6) for (let x = 12; x < innerWidth * 0.5; x += 6) { const h = window.__padExplore.hitAt(x, y); const el = document.elementFromPoint(x, y); if (!(h && h.part) && el && !el.closest('.ft-label, .ft-viewbar, button')) return [x, y]; } return null; })()`);
  if (pt) await click(fb.x + pt[0], fb.y + pt[1]);
};
/** The figure's labels on show: title, box (page px), inside the drawing, and the other parts under each (hit test). */
const figLabels = async () => {
  const fb = await frameBox();
  const list = await fr(`(() => [...document.querySelectorAll('.ft-label')].filter((e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return !e.hidden && r.width && cs.visibility !== 'hidden' && +cs.opacity > 0.05; }).map((e) => { const r = e.getBoundingClientRect(); const hits = {}; for (let y = r.top; y < r.bottom; y += 2) for (let x = r.left; x < r.right; x += 2) { const h = window.__padExplore.hitAt(x, y); if (h && h.part) hits[h.part] = (hits[h.part] || 0) + 1; } return { t: e.querySelector('b') ? e.querySelector('b').textContent : '', x: r.left, y: r.top, w: r.width, h: r.height, inside: r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight, hits }; }))()`);
  return list.map((l) => ({ ...l, x: l.x + fb.x, y: l.y + fb.y }));
};
const cardOn = (demo) => evaluate(`(() => { const c = document.querySelector('.demo-card[data-demo="${demo}"]'); return Boolean(c && c.classList.contains('is-on') && !c.classList.contains('is-waiting')); })()`);
/** Pick `part` while `demo`'s card is up: the card steps aside, the figure stays, the part's labels show clear. */
async function pickAside(label, demo, part, want) {
  await away();
  const before = await cam();
  await pickPart(part);
  await sleep(1600);
  ok(`${label}: ${part} picked: the card steps aside`, !(await cardOn(demo)));
  ok(`${label}: ${part} picked: the figure does not move`, sameCam(before, await cam()), sameCam(before, await cam()) ? "" : { before, now: await cam() });
  const labs = await figLabels();
  const titles = labs.map((l) => l.t.replace(/\u00a0/g, " "));
  ok(`${label}: ${part} picked: its labels show (${titles.join(" + ") || "none"})`, want.every((w) => titles.some((t) => t.toUpperCase().startsWith(w))), titles);
  ok(`${label}: ${part} picked: labels inside the drawing, off the other parts`, labs.every((l) => l.inside && Object.keys(l.hits).length === 0), labs.map((l) => ({ t: l.t, inside: l.inside, hits: l.hits })));
  return before;
}

const settle = REDUCED ? 700 : 1800;

// ------------------------------------------------------------------ lesson 1, step 3 (velostat)
await b.goto(`${BASE}#/lesson/meet-flexitac`);
await until(`window.__st && document.querySelector('.step-dot[data-k="1"]')`, 15000);
await sleep(1500);
await clickEl('.step-dot[data-k="1"]');
await sleep(settle);
await away();
const cam2 = await cam();
await startSampler();
await clickEl('.step-dot[data-k="2"]');
const on1 = await until(`(() => { const c = document.querySelector('.demo-card[data-demo="velostat"]'); return c && c.classList.contains('is-on'); })()`, 10000);
await sleep(2000);
const m1 = motion(await stopSampler());
ok("L1 step 3: card opens", on1);
ok(`L1 step 3: the figure is still once the card shows (card at ${m1.cardOn} ms, last move ${m1.lastMove} ms)`, m1.cardOn !== null && m1.lastMove <= m1.cardOn, m1);
ok(`L1 step 3: the figure moved in one go on step entry (${m1.moves} movement${m1.moves === 1 ? "" : "s"})`, m1.moves <= 1, m1);
const c1 = await checkCard("L1 step 3", "velostat");
const band1 = await evaluate(`window.__band ? window.__band.right : 0`);
ok(`L1 step 3: Fig 1 keeps a band only where no wide place takes the card (${c1?.place}, band ${band1} px)`, c1 && (c1.place === "beside" ? band1 > 0 : band1 === 0), { place: c1?.place, band: band1 });
await shots("L1s3");
{
  const fb = await frameBox();
  const pill = await frBox(".ft-reveal-close");
  const hits = pill ? await fr(`(() => { let n = 0; for (let y = ${pill?.y ?? 0}; y < ${(pill?.y ?? 0) + (pill?.h ?? 0)}; y += 2) for (let x = ${pill?.x ?? 0}; x < ${(pill?.x ?? 0) + (pill?.w ?? 0)}; x += 2) { const h = window.__padExplore.hitAt(x, y); if (h && h.part) n++; } return n; })()`) : 0;
  ok(`L1 step 3: the "collapse" pill is off the pad`, hits === 0, pill ? { pill: shift(pill, fb), hits } : "no pill");
}
// another part picked: the Top FPC (its label and its gold fingers'; a 320 px phone's 274 px drawing has room for the
// FPC's label only: both sit right of the pad there, level with each other), then the Velostat again
await pickAside("L1 step 3", "velostat", "fpc_t", W >= 340 ? ["TOP FPC", "GOLD FINGERS"] : ["TOP FPC"]);
await shots("L1s3-pick-fpc_t");
await pickPart("velostat");
ok("L1 step 3: the Velostat picked again: the card is back", await until(`(() => { const c = document.querySelector('.demo-card[data-demo="velostat"]'); return c && c.classList.contains('is-on'); })()`, 8000));
await sleep(800);
await checkCard("L1 step 3 (back)", "velostat");

// a theme toggle in step 3: the band is put back at once, the card back beside
{
  const before = await cam();
  await clickEl("[data-theme-toggle]");
  await sleep(400);
  const back = await until(`(() => { const c = document.querySelector('.demo-card[data-demo="velostat"]'); return c && c.classList.contains('is-on') && window.__st && window.__st.reveal && window.__st.reveal.open; })()`, 15000);
  await sleep(1500);
  const after = await cam();
  const bandOf = (s) => s.split("|")[2];
  ok("L1 step 3, theme toggled: card back", back);
  ok(`L1 step 3, theme toggled: the same band (${bandOf(before)} -> ${bandOf(after)})`, Math.abs(parseFloat(bandOf(before)) - parseFloat(bandOf(after))) < 1);
  await checkCard("L1 step 3 (theme toggled)", "velostat");
  await clickEl("[data-theme-toggle]");
  await until(`(() => { const c = document.querySelector('.demo-card[data-demo="velostat"]'); return c && c.classList.contains('is-on'); })()`, 15000);
  await sleep(1500);
}

// leaving step 3 (dot 2): the band goes, the figure lands where it was in step 2
{
  await away();
  await clickEl('.step-dot[data-k="1"]');
  await sleep(settle + 600);
  const back = await cam();
  const gone = await evaluate(`!document.querySelector('.demo-card')`);
  ok("L1 step 2 again: card gone", gone);
  ok("L1 step 2 again: the band is given back (--ft-band 0)", /\|0(\.0)?px$/.test(back) || back.endsWith("|"), back.split("|")[2]);
  ok("L1 step 2 again: the figure is exactly where it was in step 2", sameCam(back, cam2), back === cam2 ? "" : { step2: cam2, now: back });
}

// ------------------------------------------------------------------ lesson 2, step 1 (unit)
await b.goto(`${BASE}#/lesson/the-sandwich`);
await until(`document.querySelector('iframe.figure-frame') && document.querySelector('iframe.figure-frame').contentDocument && document.querySelector('iframe.figure-frame').contentDocument.querySelector('.pd-world')`, 15000);
await startSampler();
const on2 = await until(`(() => { const c = document.querySelector('.demo-card[data-demo="unit"]'); return c && c.classList.contains('is-on'); })()`, 15000);
await sleep(2000);
const m2 = motion(await stopSampler());
ok("L2 step 1: card opens", on2);
ok(`L2 step 1: the figure is still once the card shows (card at ${m2.cardOn} ms, last move ${m2.lastMove} ms)`, m2.cardOn !== null && m2.lastMove <= m2.cardOn, m2);
const c2 = await checkCard("L2 step 1", "unit");
const mini = await evaluate(`Boolean(document.querySelector('.ud.is-mini'))`);
if (mini) {
  const t = await evaluate(`document.querySelector('.ud-mini').innerText.replace(/\\s+/g, ' ')`);
  ok(`L2 step 1: mini form reads R and V (${t})`, /R = [\d.]+ [kM]Ω/.test(t) && /V = [\d.]+ V/.test(t), t);
}
await shots("L2s1");
// a layer picked in step 1: the card steps aside (the label uses the band), nothing picked brings it back
await pickAside("L2 step 1", "unit", "fpc_t", ["TOP FPC"]);
await shots("L2s1-pick-fpc_t");
await pickNothing();
ok("L2 step 1: nothing picked: the card is back", await until(`(() => { const c = document.querySelector('.demo-card[data-demo="unit"]'); return c && c.classList.contains('is-on'); })()`, 8000));
await sleep(800);
await checkCard("L2 step 1 (back)", "unit");
// Next step: the ring and its band go
{
  await away();
  await clickEl("[data-go]");
  await sleep(settle + 900);
  const f = await fr(`window.__padExplore.focus()`);
  const band = (await cam()).split("|")[2];
  ok("L2 step 2: card gone", await evaluate(`!document.querySelector('.demo-card')`));
  // (the camera eases home critically damped: its last 0.1 % takes a while; the band is 0.0 px long before)
  ok(`L2 step 2: the band is given back (camera home, --ft-band ${band})`, f && f.cam.x < 1e-3 && f.cam.target === 0 && parseFloat(band) === 0, f && f.cam);
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
