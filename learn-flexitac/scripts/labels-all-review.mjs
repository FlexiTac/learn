// Lesson 1 "Take it apart": ALL the labels at once (Fig 1's `labels` act, figures/EMBED.md "Fig 1", All labels) on a
// BUILT site, headless Chrome over CDP, real mouse / touch input (no npm deps; Node 22).
//   npx vite build --outDir /tmp/lf-dist && npx vite preview --outDir /tmp/lf-dist --port 8957 &
//   node scripts/labels-all-review.mjs --size 1440x900 --theme dark [--interact] [--base http://127.0.0.1:8957/]
//        [--out review/labels-all] [--step K]
// The all-labels step is the one whose acts turn the mode on (`labels "all"`): found by its dot (the one titled "Take
// it apart" first, else every dot in turn, until the figure reports the mode), or --step K (1-based). The feel step is
// found the same way (feel mode on). A window under 500 px wide is driven as a phone (mobile, touch). For one size and
// theme:
//   a  the step entered (its dot), the pad still closed: only the "Click to expand" hint (no card, no leader);
//   b  a real click on the sensor expands it: the figure's camera (viewBox, .pd-world, .pd-view) is unchanged and all
//      seven labels fade in; measured: each column's cards share one x and one width and are evenly spaced (the five
//      layers top to bottom in stack order, then the two finger rows); full cards (title, ONE sentence on one line,
//      Details) at 1366 px and wider; every leader starts on its card's inner edge at the card's middle, is ONE straight
//      line or a level stub (the same length for every card) and one straight run, never steeper than 41 degrees, and
//      ends ON its part (the figure's own hit test at the dot); no two leaders cross or come within 2 px, no leader
//      crosses a card or the pill; a layer's leader passes over no other part, the Bottom fingers' over nothing but
//      their tail's margin, the Top fingers' over nothing but the two tails (the Top tail ends inside the Bottom FPC's
//      closed frame: no line from the right reaches it unseen); no card covers the pad (hit test every 3 px over it),
//      the viewbar, the "Click to collapse" pill or another card; all inside the drawing; no horizontal page scroll;
//      both columns one card height, every title on one line. Chips keep the level layout: each centred on its ONE
//      horizontal leader, at 10.5 px or more (8.5 on a phone), a shortest leader of 12 px, 2.5 px or more apart. The
//      step's button now reads Next step (the click did its Show me);
//   c  collapse (the pill): every label goes, the hint comes back;
//   d  the step again by its dot (the button reads Show me again), then Show me: the pad expands, the same labels, the
//      same camera;
//   --interact (and by default at 1440x900, 1024x768 and 390x844): hover floats a layer and its leader (desktop);
//      a click on a part picks it (its cards ringed, the others dimmed, no extra label); Details opens the site's detail
//      window (a chip: a tap on it); an empty-space click clears the pick and keeps the labels; collapse / expand;
//      the next step (if any): no all-labels cards (the Velostat label only, where it is "Squeeze the Velostat"); the
//      feel step: feel mode still presses; dot jumps in several orders land in each step's state.
// PNGs (<size>-<theme>-<step>.png) and <size>-<theme>.json land in --out.
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
const PHONE = W < 500;
const BASE = opt("base", "http://127.0.0.1:8957/");
const OUT = resolve(root, opt("out", "review/labels-all"));
const INTERACT = flag("interact") || ["1440x900", "1024x768", "390x844"].includes(`${W}x${H}`);
const STEP_OPT = opt("step", null);
const tag = `${W}x${H}-${THEME}`;
mkdirSync(OUT, { recursive: true });

const results = [];
const report = { size: `${W}x${H}`, theme: THEME };
const ok = (name, pass, info = "") => {
  results.push({ name, pass: Boolean(pass), info });
  console.log(`${pass ? "PASS" : "FAIL"}  ${tag}  ${name}${info !== "" ? "  " + (typeof info === "string" ? info : JSON.stringify(info)) : ""}`);
};

const b = await launch({ width: W, height: H, mobile: PHONE, touch: PHONE, scale: 1 });
const { send, evaluate } = b;
await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: THEME }] });
await send("Page.addScriptToEvaluateOnNewDocument", {
  source: `if (window === window.top) { window.__errs = []; window.__msgs = [];
    addEventListener('message', (e) => { const d = e.data; if (!d || typeof d.type !== 'string') return;
      if (d.type === 'ft:error') window.__errs.push(d);
      else if (d.type === 'ft:state') window.__st = d.state;
      else if (d.type === 'ft:touch') window.__touch = d.frame;
      else if (d.type === 'ft:pick' || d.type === 'ft:details') window.__msgs.push({ type: d.type, part: d.part ? d.part.id : null }); }); }`,
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

let mouse = [5, 5];
const move = async (x, y) => {
  const [x0, y0] = mouse;
  for (let k = 1; k <= 6; k++) {
    await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: x0 + ((x - x0) * k) / 6, y: y0 + ((y - y0) * k) / 6, button: "none" });
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
  await move(x, y);
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", buttons: 1, clickCount: 1 });
  await sleep(40);
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", buttons: 0, clickCount: 1 });
};
const away = async () => {
  if (PHONE) return;
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 3, y: 3, button: "none" });
  mouse = [3, 3];
};
const toStage = () => evaluate(`document.querySelector('.stage-body').scrollIntoView({ block: 'nearest' })`).then(() => sleep(120));
const clickEl = async (sel) => {
  await evaluate(`document.querySelector(${JSON.stringify(sel)}).scrollIntoView({ block: 'nearest' })`);
  await sleep(150);
  const q = await box(sel);
  await click(q.x + q.w / 2, q.y + q.h / 2);
};
// a click on an element inside the figure
const clickFr = async (sel) => {
  await toStage();
  const fb = await frameBox();
  const q = await fr(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e || e.hidden) return null; const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; })()`);
  if (!q) return false;
  await click(fb.x + q.x + q.w / 2, fb.y + q.y + q.h / 2);
  return true;
};
// a point of the drawing where the figure's hit test gives `part` (the middle one by x), or any part for null
const partPoint = (part) =>
  fr(`(() => { const pts = []; for (let y = 6; y < innerHeight; y += 3) for (let x = 6; x < innerWidth; x += 3) { const el = document.elementFromPoint(x, y); if (el && el.closest('.ft-label, .ft-viewbar, button')) continue; const h = window.__padExplore.hitAt(x, y); if (h && (${JSON.stringify(part)} === null ? h.part : h.part === ${JSON.stringify(part)})) pts.push([x, y]); } pts.sort((a, b) => a[0] - b[0]); return pts[Math.floor(pts.length / 2)] || null; })()`);
const clickPart = async (part) => {
  await toStage();
  const fb = await frameBox();
  const pt = await partPoint(part);
  if (!pt) return false;
  await click(fb.x + pt[0], fb.y + pt[1]);
  return true;
};
const hoverPart = async (part) => {
  await toStage();
  const fb = await frameBox();
  const pt = await partPoint(part);
  if (pt) await move(fb.x + pt[0], fb.y + pt[1]);
  return pt;
};
// an empty spot of the drawing (no part, no card, no button)
const clickEmpty = async () => {
  await toStage();
  const fb = await frameBox();
  // (16 px clear of any card or button all round: a phone's tap snaps to a target close by)
  const pt = await fr(`(() => { const s = document.querySelector('.pd-stage').getBoundingClientRect(); const clear = (x, y) => { for (const [dx, dy] of [[0, 0], [16, 0], [-16, 0], [0, 16], [0, -16], [12, 12], [-12, 12], [12, -12], [-12, -12]]) { const el = document.elementFromPoint(x + dx, y + dy); const h = window.__padExplore.hitAt(x + dx, y + dy); if (!el || el.closest('.ft-label, .ft-viewbar, button') || (h && h.part)) return false; } return true; }; for (let y = s.top + s.height * 0.75; y > s.top + 20; y -= 5) for (let x = s.right - 18; x > s.left + s.width * 0.5; x -= 5) if (clear(x, y)) return [x, y]; return null; })()`);
  if (pt) await click(fb.x + pt[0], fb.y + pt[1]);
  return Boolean(pt);
};
const shot = async (name) => {
  await toStage();
  const s = await box(".stage-body");
  await b.shot(join(OUT, `${tag}-${name}.png`), { x: s.x, y: Math.max(0, s.y), width: s.w, height: Math.min(s.h, H - Math.max(0, s.y)), scale: PHONE ? 2 : 1 });
};
const CAM = `(() => { const c = window.__padExplore.camera(); return c; })()`;
const nums = (s) => (String(s).match(/-?\d+(\.\d+)?/g) || []).map(Number);
const sameCam = (a, b) => ["viewBox", "world", "view"].every((k) => {
  const p = nums(a[k]);
  const q = nums(b[k]);
  return p.length === q.length && p.every((v, i) => Math.abs(v - q[i]) < 0.02);
});

// ---- the measurement of the seven labels (iframe px)
const MEASURE = `(() => {
  const vis = (e) => { if (!e || e.hidden) return false; const cs = getComputedStyle(e); const r = e.getBoundingClientRect(); return r.width > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
  const rect = (e) => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; };
  const lsvg = document.querySelector('.ft-leaders').getBoundingClientRect();
  const cards = [...document.querySelectorAll('.ft-all')].filter(vis).map((c) => { const b = c.querySelector('b'); const cs = getComputedStyle(b); const sh = c.querySelector('.ft-label-short'); const ss = getComputedStyle(sh); return { id: c.dataset.part, chip: c.classList.contains('is-chip'), compact: c.classList.contains('is-compact'), side: c.dataset.side, opacity: +getComputedStyle(c).opacity, title: b.textContent, font: parseFloat(cs.fontSize), lines: Math.round(b.getBoundingClientRect().height / (parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.2)), sentence: vis(sh) ? sh.textContent : null, sentenceLines: vis(sh) ? Math.round(sh.getBoundingClientRect().height / (parseFloat(ss.lineHeight) || parseFloat(ss.fontSize) * 1.35)) : 0, ...rect(c) }; });
  // each leader as drawn: its points (the card end first; "M x y L x y [L x y]"), its dot
  const leads = [...document.querySelectorAll('.ft-all-lead')].filter((g) => g.style.display !== 'none').map((g) => {
    const d = g.querySelector('.ft-leader').getAttribute('d') || '';
    const e = g.querySelector('.ft-leader-end');
    const n = (d.match(/-?[\\d.]+/g) || []).map(Number);
    const pts = [];
    for (let i = 0; i + 1 < n.length; i += 2) pts.push([lsvg.left + n[i], lsvg.top + n[i + 1]]);
    const form = /^M-?[\\d.]+ -?[\\d.]+(L-?[\\d.]+ -?[\\d.]+){1,2}$/.test(d);
    if (!form || pts.length < 2) return { id: g.dataset.part, d };
    const [a, b] = [pts[0], pts[pts.length - 1]];
    return { id: g.dataset.part, pts, x0: a[0], y0: a[1], x1: b[0], y1: b[1], dot: [lsvg.left + +e.getAttribute('cx'), lsvg.top + +e.getAttribute('cy')], segs: pts.length };
  });
  // every 1 px along a leader, from its card end to "skip" px short of its dot
  const along = (pts, skip = 0) => { const out = []; let len = 0; for (let k = 1; k < pts.length; k++) len += Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]); let at = 0; for (let k = 1; k < pts.length; k++) { const [ax, ay] = pts[k - 1]; const [bx, by] = pts[k]; const l = Math.hypot(bx - ax, by - ay); for (let t = 0; t < l; t += 1) { if (at + t > len - skip) return out; out.push([ax + ((bx - ax) * t) / l, ay + ((by - ay) * t) / l, at + t]); } at += l; } return out; };
  for (const l of leads) {
    if (!l.pts) continue;
    // the dot on its part: the figure's hit test at the dot and just past it, along the leader's last run
    const p = l.pts[l.pts.length - 2];
    const L = Math.hypot(l.x1 - p[0], l.y1 - p[1]) || 1;
    const ux = (l.x1 - p[0]) / L;
    const uy = (l.y1 - p[1]) / L;
    const tries = [[l.x1 + ux * 1.5, l.y1 + uy * 1.5], [l.x1, l.y1], [l.x1 + ux * 1.5, l.y1 + uy * 1.5 - 1], [l.x1 + ux * 1.5, l.y1 + uy * 1.5 + 1]];
    l.hit = tries.map(([x, y]) => { const h = window.__padExplore.hitAt(x, y); return h ? h.part : null; });
    // what the leader passes over between its card and its dot (4 px out: the dot itself), every px (part -> px)
    l.over = {};
    for (const [x, y] of along(l.pts, 4)) { const h = window.__padExplore.hitAt(x, y); if (h && h.part && h.part !== l.id) l.over[h.part] = (l.over[h.part] || 0) + 1; }
    // ...and over the cards (its own card left out) and the pill
    l.onCards = [];
    for (const [x, y, t] of along(l.pts)) {
      if (t < 1.5) continue;
      for (const c of cards) if (x > c.x + 0.5 && x < c.x + c.w - 0.5 && y > c.y + 0.5 && y < c.y + c.h - 0.5 && !l.onCards.includes(c.id)) l.onCards.push(c.id);
      const pl = document.querySelector('.ft-reveal-close');
      if (pl && vis(pl)) { const r = pl.getBoundingClientRect(); if (x > r.left && x < r.right && y > r.top && y < r.bottom && !l.onCards.includes('pill')) l.onCards.push('pill'); }
    }
  }
  // the pad under each card: the hit test every 3 px over it
  for (const c of cards) {
    const hits = {};
    for (let y = c.y + 1; y < c.y + c.h - 1; y += 3) for (let x = c.x + 1; x < c.x + c.w - 1; x += 3) { const h = window.__padExplore.hitAt(x, y); if (h && h.part) hits[h.part] = (hits[h.part] || 0) + 1; }
    c.padHits = hits;
  }
  const one = (sel) => { const e = document.querySelector(sel); return vis(e) ? rect(e) : null; };
  const stage = rect(document.querySelector('.pd-stage'));
  const single = [...document.querySelectorAll('.ft-label:not(.ft-all)')].filter(vis).map((e) => e.querySelector('b').textContent);
  return { cards, leads, pill: one('.ft-reveal-close'), bar: one('.ft-viewbar'), hint: [...document.querySelectorAll('.ft-reveal')].filter((e) => vis(e) && !e.classList.contains('is-leaving')).map(rect)[0] || null, stage, single, all: window.__padExplore.all(), state: window.__padExplore.state() };
})()`;
// the figure's camera sampled every 50 ms in the page: how many separate movements (a pause of 400 ms or more splits
// them) and when the last one ended
const SAMPLE = `(() => { const f = document.querySelector('iframe.figure-frame'); const d = f && f.contentDocument; if (!d) return ''; const s = d.querySelector('svg.pd-svg'); const w = d.querySelector('.pd-world'); const v = d.querySelector('.pd-view'); return (s ? s.getAttribute('viewBox') : '') + '|' + (w ? w.getAttribute('transform') || '' : '') + '|' + (v ? v.getAttribute('transform') || '' : ''); })()`;
const startSampler = () => evaluate(`(() => { window.__samples = []; const t0 = performance.now(); clearInterval(window.__sampler); window.__sampler = setInterval(() => window.__samples.push({ t: Math.round(performance.now() - t0), cam: ${SAMPLE} }), 50); return true; })()`);
const stopSampler = async () => {
  const samples = await evaluate(`(() => { clearInterval(window.__sampler); return window.__samples; })()`);
  const same = (a, c) => { const p = nums(a); const q = nums(c); return p.length === q.length && p.every((v, i) => Math.abs(v - q[i]) < 0.02); };
  let moves = 0;
  let last = -1;
  let prevT = -1e9;
  for (let i = 1; i < samples.length; i++) {
    if (same(samples[i].cam, samples[i - 1].cam)) continue;
    if (samples[i].t - prevT > 400) moves++;
    prevT = last = samples[i].t;
  }
  return { moves, last };
};
const overlap = (a, c, m = 0) => a && c && a.x < c.x + c.w - m && c.x < a.x + a.w - m && a.y < c.y + c.h - m && c.y < a.y + a.h - m;
const spread = (v) => (v.length ? Math.max(...v) - Math.min(...v) : 0);
const r2 = (v) => Math.round(v * 100) / 100;

async function checkLabels(label) {
  await sleep(450);
  const g = await fr(MEASURE);
  const L = ["lam_t", "fpc_t", "velostat", "fpc_b", "lam_b"].map((id) => g.cards.find((c) => c.id === id));
  const R = ["fingers_t", "fingers_b"].map((id) => g.cards.find((c) => c.id === id));
  ok(`${label}: all seven labels drawn (${g.all && g.all.form})`, g.cards.length === 7 && L.every(Boolean) && R.every(Boolean) && g.leads.length === 7, g.cards.map((c) => c.id));
  if (!(L.every(Boolean) && R.every(Boolean))) return null;
  ok(`${label}: no single label besides them`, g.single.length === 0, g.single);
  ok(`${label}: cards faded in (opacity 1)`, g.cards.every((c) => c.opacity > 0.98), g.cards.map((c) => c.opacity));
  const lead = (id) => g.leads.find((l) => l.id === id);
  // the left column
  const xs = L.map((c) => c.x);
  const ws = L.map((c) => c.w);
  const cy = L.map((c) => c.y + c.h / 2);
  const gaps = cy.slice(1).map((v, i) => v - cy[i]);
  const off = L.map((c) => lead(c.id).y1 - (c.y + c.h / 2));
  const tol = g.all.tol || 0;
  const chipsNow = g.cards.every((c) => c.chip);
  ok(`${label}: left cards flush on one x (spread ${r2(spread(xs))} px)`, spread(xs) < 0.6, xs.map(r2));
  ok(`${label}: left cards one width (spread ${r2(spread(ws))} px, ${r2(ws[0])} px)`, spread(ws) < 0.6, ws.map(r2));
  ok(`${label}: left cards evenly spaced (S ${r2(gaps[0])} px, spread ${r2(spread(gaps))} px)`, spread(gaps) < 0.6, gaps.map(r2));
  ok(`${label}: left cards top -> bottom in stack order`, gaps.every((d) => d > 0));
  const cardGap = Math.min(...L.slice(1).map((c, i) => c.y - (L[i].y + L[i].h)));
  // the right column
  ok(`${label}: right cards flush on one x, one width`, Math.abs(R[0].x - R[1].x) < 0.6 && Math.abs(R[0].w - R[1].w) < 0.6, R.map((c) => [r2(c.x), r2(c.w)]));
  ok(`${label}: right cards top -> bottom: Top tail, Bottom tail`, R[0].y < R[1].y);
  ok(`${label}: right cards on the right of the left ones`, R[0].x > L[0].x + L[0].w);
  // full cards on a desktop drawing: title, ONE sentence on one line, Details
  if (!PHONE && W >= 1366) {
    ok(`${label}: full cards (title, one sentence, Details) at ${W} px`, g.all.form === "full" && g.cards.every((c) => !c.compact && !c.chip && c.sentence && c.sentenceLines === 1), g.cards.map((c) => [c.id, c.sentence, c.sentenceLines]));
  }
  const angle = (l) => { const p = l.pts[l.pts.length - 2]; return (Math.atan2(Math.abs(l.y1 - p[1]), Math.abs(l.x1 - p[0])) * 180) / Math.PI; };
  if (chipsNow) {
    // chips keep the level layout: each centred on its ONE horizontal leader
    ok(`${label}: each left chip centred on its leader (max ${r2(Math.max(...off.map(Math.abs)))} px${tol ? `, allowed ${tol}` : ""})`, off.every((d) => Math.abs(d) <= Math.max(0.6, tol + 0.6)), off.map(r2));
    for (const c of [...L, ...R]) {
      const l = lead(c.id);
      const left = L.includes(c);
      const inner = left ? c.x + c.w : c.x;
      const flat = l.x1 !== undefined && l.segs === 2 && Math.abs(l.y0 - l.y1) < 0.05;
      const onPart = l.hit && l.hit.some((h) => h === c.id);
      ok(`${label}: ${c.id}: one horizontal leader from the chip's inner edge, its dot ON the part`, flat && Math.abs(l.x0 - inner) < 0.6 && (left ? l.x1 > l.x0 : l.x1 < l.x0) && Math.abs(l.dot[0] - l.x1) < 0.1 && Math.abs(l.dot[1] - l.y1) < 0.1 && onPart && l.y1 >= c.y && l.y1 <= c.y + c.h, { y0: r2(l.y0), y1: r2(l.y1), from: r2(l.x0), inner: r2(inner), to: r2(l.x1), hit: l.hit });
    }
  } else {
    // the fan: each leader from its card's inner edge at the card's middle, one straight line or a level stub (one
    // length for every card) and one straight run, toward the pad, never steeper than 41 degrees, its dot ON the part
    for (const c of [...L, ...R]) {
      const l = lead(c.id);
      const left = L.includes(c);
      const inner = left ? c.x + c.w : c.x;
      const dir = left ? 1 : -1;
      const okForm = Boolean(l.pts) && (l.segs === 2 || (l.segs === 3 && Math.abs(l.pts[1][1] - l.pts[0][1]) < 0.05 && dir * (l.pts[1][0] - l.pts[0][0]) > 0));
      const onPart = l.hit && l.hit.some((h) => h === c.id);
      const a = okForm ? angle(l) : 99;
      ok(`${label}: ${c.id}: leader from the card's middle on its inner edge, ${l.segs === 3 ? "stub + run" : "one line"} at ${r2(a)} deg, its dot ON the part`, okForm && Math.abs(l.x0 - inner) < 0.6 && Math.abs(l.y0 - (c.y + c.h / 2)) < 0.6 && dir * (l.x1 - l.x0) > 0 && a <= 41 && Math.abs(l.dot[0] - l.x1) < 0.1 && Math.abs(l.dot[1] - l.y1) < 0.1 && onPart, { from: [r2(l.x0), r2(l.y0)], mid: r2(c.y + c.h / 2), inner: r2(inner), to: [r2(l.x1), r2(l.y1)], angle: r2(a), hit: l.hit });
    }
    const stubs = g.leads.filter((l) => l.segs === 3).map((l) => Math.abs(l.pts[1][0] - l.pts[0][0]));
    ok(`${label}: every elbow's level stub one length (${stubs.length ? r2(stubs[0]) : "-"} px, spread ${r2(spread(stubs))})`, spread(stubs) < 0.6, stubs.map(r2));
  }
  // no two leaders cross or come within 2 px; no leader over a card (its own left out) or the pill
  const segDist = (a, b, c, d) => {
    const cr = (o, u, v) => (u[0] - o[0]) * (v[1] - o[1]) - (u[1] - o[1]) * (v[0] - o[0]);
    const d1 = cr(c, d, a), d2 = cr(c, d, b), d3 = cr(a, b, c), d4 = cr(a, b, d);
    if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return 0;
    const ps = (P, A, B) => { const dx = B[0] - A[0], dy = B[1] - A[1]; const t = Math.max(0, Math.min(1, ((P[0] - A[0]) * dx + (P[1] - A[1]) * dy) / (dx * dx + dy * dy || 1))); return Math.hypot(P[0] - A[0] - t * dx, P[1] - A[1] - t * dy); };
    return Math.min(ps(a, c, d), ps(b, c, d), ps(c, a, b), ps(d, a, b));
  };
  const near = [];
  g.leads.forEach((p, i) => g.leads.forEach((q, j) => {
    if (j <= i || !p.pts || !q.pts) return;
    let dmin = Infinity;
    for (let a = 1; a < p.pts.length; a++) for (let b = 1; b < q.pts.length; b++) dmin = Math.min(dmin, segDist(p.pts[a - 1], p.pts[a], q.pts[b - 1], q.pts[b]));
    if (dmin < 2) near.push([p.id, q.id, r2(dmin)]);
  }));
  ok(`${label}: no two leaders cross (or come within 2 px)`, near.length === 0, near);
  const onCards = g.leads.filter((l) => l.onCards && l.onCards.length).map((l) => [l.id, l.onCards]);
  ok(`${label}: no leader crosses a card or the pill`, onCards.length === 0, onCards);
  // a layer's leader passes over no other part; the finger leaders over nothing but their own tail: the Bottom
  // fingers' over at most its tail's margin beyond the last contact; the Top fingers' over its own tail and,
  // unavoidably, the Bottom FPC (the Top tail ends inside the Bottom FPC's closed frame: any line from the right
  // column to its contacts crosses the frame's arm or its tail) and nothing else
  const over = (id) => lead(id).over || {};
  if (!chipsNow) {
    const crossL = L.map((c) => [c.id, over(c.id)]).filter(([, o]) => Object.keys(o).length);
    ok(`${label}: no layer's leader passes over another part`, crossL.length === 0, crossL);
  }
  const ob = over("fingers_b");
  ok(`${label}: fingers_b: its leader passes over nothing but its own tail's margin`, Object.keys(ob).every((p) => p === "fpc_b") && (ob.fpc_b || 0) <= 8, ob);
  const ot = over("fingers_t");
  ok(`${label}: fingers_t: its leader passes over nothing but the two tails`, Object.keys(ot).every((p) => p === "fpc_t" || p === "fpc_b"), ot);
  // both columns one card height, every title on one line (a finger card's long title gives way to its short name)
  ok(`${label}: both columns one card height (${r2(L[0].h)} / ${r2(R[0].h)} px)`, Math.abs(L[0].h - R[0].h) < 0.6, [L[0].h, R[0].h].map(r2));
  ok(`${label}: every title on one line`, g.cards.every((c) => c.lines === 1), g.cards.filter((c) => c.lines !== 1).map((c) => [c.id, c.title, c.lines]));
  // chips: the callout title's size (11 px at least) except on a phone; a shortest leader of about 12 px; at least
  // 2.5 px between two chips
  const chips = g.cards.every((c) => c.chip);
  if (chips) {
    const fonts = [...new Set(g.cards.map((c) => c.font))];
    ok(`${label}: chip titles ${PHONE ? ">= 8.5 px (a phone)" : ">= 10.5 px"} (${fonts.join(", ")} px)`, fonts.every((f) => f >= (PHONE ? 8.5 : 10.5)), fonts);
    const shortest = Math.min(...g.leads.map((l) => Math.abs(l.x1 - l.x0)));
    ok(`${label}: chips: shortest leader ${r2(shortest)} px (>= 11.5)`, shortest >= 11.5, shortest);
    ok(`${label}: chips: ${r2(cardGap)} px between two chips (>= 2.5)`, cardGap >= 2.5, cardGap);
  }
  // clear of the pad, the pill, the viewbar, the hint, each other; inside the drawing
  const padHits = g.cards.filter((c) => Object.keys(c.padHits).length);
  ok(`${label}: no card covers the pad (hit test every 3 px)`, padHits.length === 0, padHits.map((c) => ({ id: c.id, hits: c.padHits })));
  ok(`${label}: no card under the "collapse" pill`, g.pill && !g.cards.some((c) => overlap(c, g.pill)), g.pill ? "" : "no pill");
  ok(`${label}: no card on the viewbar`, !g.cards.some((c) => overlap(c, g.bar)));
  ok(`${label}: no card on the hint`, !g.hint || !g.cards.some((c) => overlap(c, g.hint)));
  ok(`${label}: no two cards overlap`, !g.cards.some((c, i) => g.cards.some((d, j) => j > i && overlap(c, d))));
  ok(`${label}: cards inside the drawing`, g.cards.every((c) => c.x >= g.stage.x - 0.5 && c.y >= g.stage.y - 0.5 && c.x + c.w <= g.stage.x + g.stage.w + 0.5 && c.y + c.h <= g.stage.y + g.stage.h + 0.5));
  ok(`${label}: no horizontal page scroll`, await evaluate(`document.scrollingElement.scrollWidth <= innerWidth + 1`));
  return {
    form: g.all.form,
    fit: g.all.fit,
    tol,
    left: { x: r2(xs[0]), w: r2(ws[0]), h: r2(L[0].h), S: r2(gaps[0]), xSpread: r2(spread(xs)), wSpread: r2(spread(ws)), sSpread: r2(spread(gaps)), maxOffCentre: r2(Math.max(...off.map(Math.abs))), gap: r2(cardGap) },
    right: { x: r2(R[0].x), w: r2(R[0].w), h: r2(R[0].h), S: r2(R[1].y - R[0].y), offCentre: R.map((c) => r2(lead(c.id).y1 - (c.y + c.h / 2))) },
    leaders: g.leads.map((l) => ({ id: l.id, pts: l.pts ? l.pts.map((p) => p.map(r2)) : null, angle: l.pts ? r2(angle(l)) : null, len: l.pts ? r2(l.pts.slice(1).reduce((n, p, k) => n + Math.hypot(p[0] - l.pts[k][0], p[1] - l.pts[k][1]), 0)) : null, onPart: Boolean(l.hit && l.hit.includes(l.id)), over: l.over })),
    sentences: g.cards.map((c) => [c.id, c.sentence, c.sentenceLines]),
    titles: g.cards.map((c) => [c.id, c.title, c.font]),
    padHits: padHits.length,
  };
}
const labelsGone = async (label) => {
  const g = await fr(MEASURE);
  ok(`${label}: no label, no leader`, g.cards.length === 0 && g.leads.length === 0 && g.single.length === 0, { cards: g.cards.length, leads: g.leads.length, single: g.single });
  return g;
};

// ------------------------------------------------------------------ the steps
// which dot turns all labels on (K) and which feel mode (KF, the nearest one before K: a step whose own stage covers
// the figure, lesson 1's robot, leaves Fig 1 waiting underneath in feel mode): every dot in turn (a dot whose figure is
// not Fig 1 has no __padExplore), or K from --step; then a fresh load
const frSafe = async (js) => {
  try {
    return await fr(js);
  } catch {
    return null;
  }
};
await b.goto(`${BASE}#/lesson/meet-flexitac`);
await until(`window.__st && document.querySelector('.step-dot')`, 15000);
await sleep(1500);
const TITLES = await evaluate(`[...document.querySelectorAll('.step-dot')].map((d) => d.getAttribute('aria-label') || '')`);
let K = STEP_OPT ? Number(STEP_OPT) - 1 : -1;
let KF = -1;
const feelAt = [];
for (let k = 0; k < TITLES.length; k++) {
  // (a dot can be out of the page for a moment while a step's own stage takes over: wait for it)
  if (!(await until(`Boolean(document.querySelector('.step-dot[data-k="${k}"]'))`, 5000))) continue;
  await clickEl(`.step-dot[data-k="${k}"]`);
  await sleep(PHONE ? 2600 : 2400);
  const all = await frSafe(`Boolean(window.__padExplore && window.__padExplore.all())`);
  feelAt[k] = await frSafe(`Boolean(window.__padExplore && window.__padExplore.feel().on)`);
  if (all && K < 0) K = k;
}
for (let k = K - 1; k >= 0 && KF < 0; k--) if (feelAt[k]) KF = k;
const KN = K >= 0 && K + 1 < TITLES.length ? K + 1 : -1;
report.steps = { titles: TITLES, labels: K + 1, feel: KF + 1, next: KN + 1 };
ok(`the all-labels step found: step ${K + 1} of ${TITLES.length} (${TITLES[K] || "none"})`, K >= 0, TITLES);
if (K < 0) {
  writeFileSync(join(OUT, `${tag}.json`), JSON.stringify({ ...report, results }, null, 1));
  process.exit(1);
}
const DOT = `.step-dot[data-k="${K}"]`;

// ------------------------------------------------------------------ the all-labels step
await b.goto(`about:blank`);
await b.goto(`${BASE}#/lesson/meet-flexitac`);
await until(`window.__st && document.querySelector('${DOT}')`, 15000);
await sleep(1500);
await startSampler();
await clickEl(DOT);
await sleep(PHONE ? 2600 : 2400);
await away();
await sleep(300);
const camA = await fr(CAM);
const entry = await stopSampler();
ok(`a: step entry moves the figure in one go (${entry.moves} movement${entry.moves === 1 ? "" : "s"}, still from ${entry.last} ms)`, entry.moves <= 1, entry);
report.entry = entry;
const gA = await labelsGone("a (step 2, closed)");
ok("a: only the 'Click to expand' hint", Boolean(gA.hint) && !gA.pill, { hint: Boolean(gA.hint), pill: Boolean(gA.pill) });
ok("a: the figure is in all-labels mode", gA.all && gA.all.form !== null, gA.all);
await shot("a-closed");

// b: a real click on the sensor
await toStage();
await startSampler();
{
  const fb = await frameBox();
  const pt = await partPoint(null);
  await click(fb.x + pt[0], fb.y + pt[1]);
}
await sleep(2300);
await away();
const camB = await fr(CAM);
const exp = await stopSampler();
ok(`b: the expand never moves the camera (${exp.moves} movements)`, exp.moves === 0, exp);
ok("b: the camera did not move (viewBox, .pd-world, .pd-view)", sameCam(camA, camB), sameCam(camA, camB) ? "" : { camA, camB });
report.viewBox = camB.viewBox;
report.world = camB.world;
report.click = await checkLabels("b (click expand)");
await shot("b-click");
// (the click did the step's Show me by hand: the button moves on)
const goNow = () => evaluate(`document.querySelector('.steps [data-go] .go-label:not(.go-sizer)').textContent.trim()`);
ok(`b: the step's button reads ${KN >= 0 ? "Next step" : "Done"} (the click did its Show me)`, (await goNow()) === (KN >= 0 ? "Next step" : "Done"), await goNow());

// c: collapse with the pill
await clickFr(".ft-reveal-close");
await sleep(1600);
await away();
const gC = await labelsGone("c (collapsed)");
ok("c: the hint is back", Boolean(gC.hint));
ok("c: the camera did not move", sameCam(camA, await fr(CAM)));
if (INTERACT) await shot("c-collapsed");

// d: Show me. (After b's click the button reads Next step: the step is entered again by its dot, which closes the pad
// and gives the button back its Show me, then Show me takes the pad apart)
await clickEl(DOT);
await sleep(PHONE ? 2600 : 2400);
await away();
ok("d: the step again by its dot: the pad closed, the button reads Show me", (await fr(`window.__padExplore.state().apart`)) === false && (await goNow()) === "Show me", await goNow());
await clickEl(".steps [data-go]");
await sleep(2400);
await away();
ok("d: Show me expanded the pad", (await fr(`window.__padExplore.state().apart`)) === true);
ok("d: the camera did not move", sameCam(camA, await fr(CAM)));
report.showMe = await checkLabels("d (Show me)");
await shot("d-showme");

// ------------------------------------------------------------------ interaction
if (INTERACT) {
  const msgs0 = await evaluate(`window.__msgs.length`);
  if (!PHONE) {
    await hoverPart("velostat");
    await sleep(450);
    const fl = await fr(`({ floated: window.__padExplore.state().floated, lead: document.querySelector('.ft-all-lead[data-part="velostat"]').classList.contains('is-float'), t: getComputedStyle(document.querySelector('.ft-all-lead[data-part="velostat"]')).transform })`);
    ok("hover: the Velostat floats and its leader rises with it", fl.floated === "velostat" && fl.lead && /-4\)$/.test(fl.t), fl);
    await shot("e-hover");
    await away();
    await sleep(300);
  }
  const chips = (await fr(`window.__padExplore.all().form`)) === "chip";
  // a click on a part: its cards ringed, the others dimmed, still seven labels and no single one
  await away();
  await clickPart("fpc_b");
  await sleep(500);
  const p1 = await fr(`(() => { const st = window.__padExplore.state(); const ring = [...document.querySelectorAll('.ft-all.is-pick')].map((c) => c.dataset.part); const dim = [...document.querySelectorAll('.ft-all.is-dim')].map((c) => c.dataset.part); return { picked: st.picked, labels: st.labels, ring, dim }; })()`);
  ok("pick: a click on the Bottom FPC picks it", p1.picked === "fpc_b", p1);
  ok("pick: its cards ringed (the FPC and its gold fingers), the others dimmed", p1.ring.join() === "fpc_b,fingers_b" && p1.dim.length === 5, p1);
  ok("pick: still all seven labels, no extra one", p1.labels.length === 7 && (await fr(MEASURE)).single.length === 0);
  const pickMsg = await evaluate(`window.__msgs.slice(${msgs0})`);
  ok("pick: ft:pick posted", pickMsg.some((m) => m.type === "ft:pick" && m.part === "fpc_b"), pickMsg);
  if (chips) ok("chips: a tap on a part opens its Details", pickMsg.some((m) => m.type === "ft:details" && m.part === "fpc_b"), pickMsg);
  await shot("f-pick");
  // (the detail window: closed again, so it never covers the figure on a phone)
  await evaluate(`document.querySelector('.details .det-close') && document.querySelector('.details .det-close').click()`);
  await sleep(400);
  // Details: the card's link (a chip: the chip itself); the site's window opens
  const n1 = await evaluate(`window.__msgs.length`);
  await clickFr('.ft-all[data-part="velostat"] .ft-label-more');
  await sleep(700);
  const det = await evaluate(`(() => { const d = document.querySelector('.details'); return d && !d.hidden && d.classList.contains('is-on') ? d.querySelector('.det-title').textContent : null; })()`);
  const m2 = await evaluate(`window.__msgs.slice(${n1})`);
  ok(`Details${chips ? " (a tap on the chip)" : ""}: ft:details for the Velostat, the site's window shows it`, m2.some((m) => m.type === "ft:details" && m.part === "velostat") && det === "Velostat", { m2, det });
  ok("Details: the Velostat is picked (ringed)", (await fr(`window.__padExplore.state().picked`)) === "velostat");
  await shot("g-details");
  await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await sleep(400);
  await evaluate(`document.querySelector('.details .det-close') && document.querySelector('.details .det-close').click()`);
  await sleep(400);
  // an empty-space click: the pick clears, the labels stay
  await clickEmpty();
  await sleep(500);
  const p2 = await fr(`(() => { const st = window.__padExplore.state(); return { picked: st.picked, labels: st.labels.length, ring: document.querySelectorAll('.ft-all.is-pick').length, dim: document.querySelectorAll('.ft-all.is-dim').length }; })()`);
  ok("empty space: the pick clears, all seven labels stay", p2.picked === null && p2.labels === 7 && p2.ring === 0 && p2.dim === 0, p2);
  // collapse hides all; expanding shows them again
  await clickFr(".ft-reveal-close");
  await sleep(1500);
  await labelsGone("collapse again");
  {
    await toStage();
    const fb = await frameBox();
    const pt = await partPoint(null);
    await click(fb.x + pt[0], fb.y + pt[1]);
  }
  await sleep(2300);
  await away();
  const back = await fr(MEASURE);
  ok("expand again: all seven labels back", back.cards.length === 7);
  // the next step (if any): no all-labels cards; where it is "Squeeze the Velostat", only the Velostat label and its card
  const VELO = KN >= 0 && /velostat/i.test(TITLES[KN]);
  if (KN >= 0) {
    await clickEl(".steps [data-go]");
    await sleep(3200);
    await away();
    const g3 = await frSafe(MEASURE);
    ok(`step ${KN + 1}: all-labels mode off, no all-labels cards`, !g3 || (g3.all === null && g3.cards.length === 0 && g3.leads.length === 0), g3 && { all: g3.all, cards: g3.cards.length });
    if (VELO && g3) {
      const card3 = await evaluate(`(() => { const c = document.querySelector('.demo-card[data-demo="velostat"]'); return Boolean(c && c.classList.contains('is-on')); })()`);
      // (a phone: the figure's label has no room left of the band, so the card's own leader names the Velostat instead)
      const lead3 = await evaluate(`(() => { const s = document.querySelector('.demo-leader'); return Boolean(s && !s.classList.contains('is-hidden')); })()`);
      ok(`step ${KN + 1}: only the Velostat label${lead3 ? " (the card's leader)" : ""}`, (g3.state.labels.join() === "velostat" || (lead3 && g3.state.labels.length === 0)) && (g3.single.length === 0 || /VELOSTAT/i.test(g3.single.join())), { labels: g3.state.labels, single: g3.single, lead3 });
      ok(`step ${KN + 1}: the Velostat card beside the figure`, card3);
    }
    await shot("h-next");
  }
  // the feel step: feel mode still presses
  if (KF >= 0) {
    await clickEl(`.step-dot[data-k="${KF}"]`);
    await sleep(2600);
    await toStage();
    const fb = await frameBox();
    const area = await fr(`window.__padExplore.feel().state.area`);
    const x = fb.x + area.x + area.w / 2;
    const y = fb.y + area.y + area.h / 2;
    if (PHONE) {
      await send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y, id: 1 }] });
      await sleep(700);
      await send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    } else {
      await move(x, y);
      await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", buttons: 1, clickCount: 1 });
      await sleep(700);
      await send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", buttons: 0, clickCount: 1 });
    }
    const lit = await evaluate(`window.__touch ? window.__touch.values.filter((v) => v > 0).length : 0`);
    ok(`step ${KF + 1}: feel mode presses (${lit} touch spots lit)`, lit > 0);
    ok(`step ${KF + 1}: no all-labels cards`, (await fr(MEASURE)).cards.length === 0);
  }
  // dot jumps in several orders (the feel step, the all-labels step and the next one)
  const stateAt = async () => ({ ...((await frSafe(`(() => { const s = window.__padExplore.state(); return { all: window.__padExplore.all(), labels: s.labels, feel: window.__padExplore.feel().on, apart: s.apart, reveal: s.revealOpen, picked: s.picked }; })()`)) || { none: true }), lead: await evaluate(`(() => { const s = document.querySelector('.demo-leader'); return Boolean(s && !s.classList.contains('is-hidden')); })()`) });
  const have = (k) => k >= 0;
  for (const order of [[KN, K, KF, K, KN], [K, KN, K, KF]].map((o) => o.filter(have))) {
    for (const k of order) {
      await clickEl(`.step-dot[data-k="${k}"]`);
      await sleep(2600);
      await away();
      const s = await stateAt();
      const want = k === KF ? s.feel && s.all === null && s.labels.length === 0 : k === K ? !s.feel && s.all !== null && !s.apart && s.labels.length === 0 : s.none || (s.all === null && (!VELO || (s.picked === "velostat" && (s.labels.join() === "velostat" || (s.lead && s.labels.length === 0)))));
      ok(`dots ${order.map((q) => q + 1).join("->")}: step ${k + 1} lands in its state`, want, s);
    }
  }
}

const errs = await evaluate(`window.__errs`);
ok("no ft:error", errs.length === 0, errs);
ok("no console errors or exceptions", !b.problems.some((p) => /error|exception/i.test(p) && !/favicon/i.test(p)), b.problems.slice(0, 5));
report.pass = results.every((r) => r.pass);
report.failed = results.filter((r) => !r.pass).map((r) => r.name);
writeFileSync(join(OUT, `${tag}.json`), JSON.stringify({ ...report, results }, null, 1));
console.log(`${report.pass ? "ALL PASS" : "FAILURES"}  ${tag}  ${results.filter((r) => r.pass).length}/${results.length}`);
b.close();
process.exit(report.pass ? 0 : 1);
