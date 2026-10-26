// Lesson 2 steps 2-4 (one touch spot -> 2 × 2 -> 12 × 32; step 1, "Squeeze the Velostat", came from lesson 1 and is
// checked by scripts/feel-review.mjs and scripts/l1-robot-review.mjs) on a BUILT site: headless Chrome over CDP, real
// mouse input (no npm deps; Node 22). Desktop sizes only for now (phones and tablets are reviewed once the content is
// final).
//   npx vite build --outDir /tmp/lf-dist && npx vite preview --outDir /tmp/lf-dist --port 8994 &
//   node scripts/lesson2-review.mjs --size 1920x1080 --theme light [--base http://127.0.0.1:8994/] [--out review/lesson2-grid]
// Checks, per step (reached with "Next step" from step 1, real clicks): the card opens BESIDE the pad (its left edge
// right of everything the figure keeps in frame, both poses), about as wide as the pad's half, inside the stage; steps
// 2-3 one horizontal leader from the ring to the card; the figure camera does not move after the step is entered (two
// samples 3 s apart); the card's animation runs; the figure mirrors the card (step 3: the crossing read and the pressed
// ones; step 4: the sense line and the drive line) once the card is paused; the step text is at most 3 lines. Then the
// dots in any order (4, 1, 2, 3, 4, 3, 2, 1: the right card each time, no console errors) and saved progress from
// before the reworks (5 old steps done -> "Squeeze the Velostat" and "One touch spot" marked). PNGs of each step.
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { mkdirSync, writeFileSync } from "node:fs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const { launch, sleep } = await import(pathToFileURL(resolve(root, "../flexitac-anatomy/figures/pad/shots/clean/cdp.mjs")).href);
const args = process.argv.slice(2);
const opt = (n, d) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : d);
const [W, H] = opt("size", "1920x1080").split("x").map(Number);
const THEME = opt("theme", "light");
const BASE = opt("base", "http://127.0.0.1:8994/");
const OUT = resolve(root, opt("out", "review/lesson2-grid"));
const tag = `${W}x${H}-${THEME}`;
mkdirSync(OUT, { recursive: true });
const results = [];
const ok = (name, pass, info = "") => {
  results.push({ name, pass: Boolean(pass), info });
  console.log(`${pass ? "PASS" : "FAIL"}  ${tag}  ${name}${info !== "" ? "  " + (typeof info === "string" ? info : JSON.stringify(info)) : ""}`);
};

const b = await launch({ width: W, height: H, scale: 1 });
const { send, evaluate } = b;
await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: THEME }] });
await send("Page.addScriptToEvaluateOnNewDocument", {
  source: `if (window === window.top) { window.__errs = [];
    addEventListener('message', (e) => { const d = e.data; if (!d || typeof d.type !== 'string') return;
      if (d.type === 'ft:error') window.__errs.push(d);
      else if (d.type === 'ft:focus') window.__focus = d;
      else if (d.type === 'ft:band') window.__band = d;
      else if (d.type === 'ft:state') window.__st = d.state; });
    document.addEventListener('gd:reading', (e) => { window.__gd = e.detail; window.__gdN = (window.__gdN || 0) + 1; }, true);
    document.addEventListener('pad-demo:scan', (e) => { window.__pd = e.detail; window.__pdN = (window.__pdN || 0) + 1; }, true); }`,
});
const until = async (js, ms = 12000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try {
      if (await evaluate(js)) return true;
    } catch {}
    await sleep(60);
  }
  return false;
};
const fr = (js) => evaluate(`(() => { const f = document.querySelector('iframe.figure-frame'); return f.contentWindow.eval(${JSON.stringify(js)}); })()`);
const center = async (sel) => evaluate(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; const r = e.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })()`);
const clickSel = async (sel) => {
  const p = await center(sel);
  if (!p) throw new Error(`no ${sel}`);
  await b.click(p[0], p[1]);
};
const cardOn = (id) => `(() => { const c = document.querySelector('.demo-card[data-demo="${id}"]'); return c && c.classList.contains('is-on') && !c.classList.contains('is-waiting'); })()`;
const camera = () => fr(`(() => { const w = document.querySelector('.pd-world'); const v = document.querySelector('.pd-view'); return (w ? w.getAttribute('transform') : '') + '|' + (v ? v.getAttribute('transform') : ''); })()`);
const geo = () =>
  evaluate(`(() => {
    const r = (el) => { const b = el.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; };
    const sb = r(document.querySelector('.stage-body')); const card = document.querySelector('.demo-card'); const f = document.querySelector('iframe.figure-frame'); const fb = r(f);
    const lead = document.querySelector('.demo-leader'); const lp = lead && lead.querySelector('.demo-leader-line');
    const room = (window.__focus && window.__focus.sense !== null && window.__focus.room) || (window.__band && window.__band.right > 0 && window.__band.room) || null;
    const lines = (() => { const t = document.querySelector('.steps-text:not(.steps-sizer)'); const lh = parseFloat(getComputedStyle(t).lineHeight); return Math.round(t.getBoundingClientRect().height / lh); })();
    const sizers = [...document.querySelectorAll('.steps-sizer')].map((t) => Math.round(t.getBoundingClientRect().height / parseFloat(getComputedStyle(t).lineHeight)));
    return { stage: sb, frame: fb, card: card ? { ...r(card), demo: card.dataset.demo, compact: card.hasAttribute('data-compact'), large: card.hasAttribute('data-large'), overflow: card.scrollHeight - card.clientHeight } : null,
      padRight: room ? fb.x + room.x : null, ring: window.__focus && window.__focus.ring ? { x: fb.x + window.__focus.ring.x, y: fb.y + window.__focus.ring.y, rx: window.__focus.ring.rx } : null, span: window.__focus ? window.__focus.span || null : null,
      leader: lead ? { hidden: lead.classList.contains('is-hidden'), d: lp ? lp.getAttribute('d') : null } : null, lines, sizers };
  })()`);

await b.goto(`${BASE}#/lesson/the-sandwich`);
// the lesson opens on step 1 (the Velostat card); each "Next step" below goes one on
await until(cardOn("velostat"), 15000);
await sleep(800);
const steps = [
  { id: "unit", name: "2-one-spot" },
  { id: "grid", name: "3-four-spots" },
  { id: "pad", name: "4-whole-pad" },
];
for (const [i, st] of steps.entries()) {
  const k = i + 1; // the step's 0-based index in the lesson (step 1 is the Velostat)
  await clickSel(".steps [data-go]");
  const opened = await until(cardOn(st.id), 15000);
  ok(`step ${k + 1}: the ${st.id} card opens`, opened);
  await sleep(1200);
  const cam0 = await camera();
  const g = await geo();
  const c = g.card;
  // beside the pad, never over it; about the pad's half; inside the stage
  ok(`step ${k + 1}: card right of the pad (no overlap)`, c && g.padRight !== null && c.x >= g.padRight + 8, { cardLeft: Math.round(c?.x), padRight: Math.round(g.padRight) });
  ok(`step ${k + 1}: card inside the stage`, c && c.x + c.w <= g.stage.x + g.stage.w + 0.5 && c.y >= g.stage.y && c.y + c.h <= g.stage.y + g.stage.h, { card: c && [Math.round(c.x), Math.round(c.y), Math.round(c.w), Math.round(c.h)] });
  const half = g.stage.w / 2;
  ok(`step ${k + 1}: card about half the stage (large form)`, c && c.large && c.w >= half * 0.85 && c.w <= half * 1.05 && c.h >= g.stage.h * 0.55, { w: Math.round(c?.w), h: Math.round(c?.h), half: Math.round(half), stageH: Math.round(g.stage.h), compact: c?.compact });
  ok(`step ${k + 1}: card content not clipped`, c && c.overflow <= 1, c?.overflow);
  if (st.id !== "pad") {
    const m = g.leader?.d?.match(/^M([\d.]+) ([\d.]+)H([\d.]+)$/);
    ok(`step ${k + 1}: one horizontal leader from the ring to the card`, g.leader && !g.leader.hidden && m && g.ring && Math.abs(Number(m[2]) - (g.ring.y - g.stage.y)) < 1.5 && Math.abs(Number(m[3]) - (c.x - g.stage.x - 1)) < 3, { d: g.leader?.d, ring: g.ring });
    ok(`step ${k + 1}: ring ${st.id === "grid" ? "around the 2 × 2" : "on one crossing"}`, st.id === "grid" ? JSON.stringify(g.span) === "[2,2]" : g.span === null, g.span);
  } else ok(`step 4: no ring, no leader`, (!g.leader || g.leader.hidden) && !g.ring);
  ok(`step ${k + 1}: step text <= 3 lines`, g.lines <= 3 && Math.max(...g.sizers) <= 3, { lines: g.lines, all: g.sizers });
  // the animation runs: the card changes over 2.5 s
  const sig = () => evaluate(`(() => { const c = document.querySelector('.demo-card .demo-body'); return c ? c.innerHTML.length + ':' + (c.textContent || '').replace(/\\s+/g, ' ').slice(0, 400) + ':' + [...c.querySelectorAll('[transform],[d],[cx],[style]')].slice(0, 400).map((e) => (e.getAttribute('transform') || '') + (e.getAttribute('cx') || '') + (e.getAttribute('style') || '')).join('').length : ''; })()`);
  const s0 = await sig();
  await b.shot(`${OUT}/${tag}-${st.name}.png`);
  await sleep(2600);
  const s1 = await sig();
  ok(`step ${k + 1}: the card animates`, s0 !== s1);
  const cam1 = await camera();
  ok(`step ${k + 1}: the figure camera stays put after entry`, cam0 === cam1, cam0 === cam1 ? "" : { cam0, cam1 });
  // the mirror: pause the card, then compare its last report with the figure's scan
  if (st.id === "grid") {
    await clickSel(".demo-card .gd-play");
    await sleep(700);
    const m = await evaluate(`(() => { const r = window.__gd; const s = window.__st && window.__st.scan; const f = window.__focus; return { r, s, f: f && [f.sense, f.drive] }; })()`);
    const want = m.r && m.f ? { sense: m.r.sense === null || m.r.drive === null ? null : m.f[0] + m.r.sense, drive: m.r.sense === null || m.r.drive === null ? null : m.f[1] + m.r.drive, pressed: m.r.pressed.map((q) => [m.f[0] + q.sense, m.f[1] + q.drive]).sort().join(";") } : null;
    const got = m.s ? { sense: m.s.sense, drive: m.s.drive, pressed: m.s.pressed.map((q) => [q.sense, q.drive]).sort().join(";") } : null;
    ok("step 3: the figure marks the card's reading and its pressed spots", want && got && JSON.stringify(want) === JSON.stringify(got), { want, got, phase: m.r?.phase, volts: m.r?.volts });
    ok("step 3: volts from the models (0.24 V rest / 4.39 V hard)", !m.r || m.r.volts === null || [0.24, 4.39].some((v) => Math.abs(m.r.volts - v) < 0.006) || m.r.pressed.length > 0, m.r?.volts);
    await clickSel(".demo-card .gd-play");
  }
  if (st.id === "pad") {
    await sleep(400);
    const pause = await evaluate(`(() => { const b = [...document.querySelectorAll('.demo-card button')].find((e) => /pause/i.test(e.getAttribute('aria-label') || e.textContent)); if (!b) return null; const r = b.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })()`);
    if (pause) await b.click(pause[0], pause[1]);
    await sleep(800);
    const m = await evaluate(`({ p: window.__pd && { sense: window.__pd.sense, drive: window.__pd.drive }, s: window.__st && window.__st.scan && { sense: window.__st.scan.sense, drive: window.__st.scan.drive } })`);
    ok("step 4: the figure lights the card's sense and drive line", m.p && m.s && m.p.sense === m.s.sense && m.p.drive === m.s.drive, m);
    const lit = await fr(`(() => { const d = document.querySelector('.pd-scan-drive'), s = document.querySelector('.pd-scan-sense'); return { drive: d ? +d.style.opacity : null, sense: s ? +s.style.opacity : null }; })()`);
    ok("step 4: both lines drawn on the apart pad", (m.s?.sense === null || lit.sense > 0.9) && (m.s?.drive === null || lit.drive > 0.9), lit);
    if (pause) await b.click(pause[0], pause[1]);
  }
}
// the dots, in any order (0-based: 0 the Velostat, 1 one spot, 2 the 2 × 2, 3 the whole pad)
const IDS = ["velostat", ...steps.map((x) => x.id)];
for (const k of [3, 0, 1, 2, 3, 2, 1, 0]) {
  await clickSel(`.step-dot[data-k="${k}"]`);
  const id = IDS[k];
  const opened = await until(cardOn(id), 15000);
  await sleep(500);
  const g = await geo();
  const only = await evaluate(`document.querySelectorAll('.demo-card').length`);
  const fs = await evaluate(`window.__st && window.__st.focus ? { on: window.__st.focus.on, span: window.__st.focus.span || null } : null`);
  ok(`dot ${k + 1}: the ${id} card, one card, the right ring`, opened && only === 1 && (k === 0 || k === 3 ? !fs?.on : fs?.on && (k === 2) === Boolean(fs.span)), { only, fs, card: g.card?.demo });
}
await b.shot(`${OUT}/${tag}-dots-back-to-1.png`);
const errs = await evaluate(`window.__errs.map((e) => e.name + ': ' + e.message)`);
ok("no figure errors and no console errors", !errs.length && !b.problems.length, { errs, problems: b.problems });

// saved progress from before the reworks: old step count 5 of 5 (rev 1) -> only "One touch spot" kept, and the
// Velostat step in front of it: 2 marked done (src/state/store.ts migrateSteps; the lesson's stepsAdded has 3 changes)
for (const [label, saved] of [
  ["rev 1, all 5 old steps", { done: [], steps: { "the-sandwich": 5 }, quiz: {}, params: {}, stepsRev: { "the-sandwich": 1 } }],
  ["before step 1 existed, 4 old steps", { done: [], steps: { "the-sandwich": 4 }, quiz: {}, params: {} }],
  ["rev 1, nothing done", { done: [], steps: { "the-sandwich": 0 }, quiz: {}, params: {}, stepsRev: { "the-sandwich": 1 } }],
]) {
  // (written and reloaded in one go: the open page keeps its own copy and would write it back on its next update)
  await evaluate(`localStorage.setItem('learn-flexitac:v1', ${JSON.stringify(JSON.stringify(saved))}); location.reload()`);
  await sleep(3000);
  const st = await evaluate(`(() => { const s = JSON.parse(localStorage.getItem('learn-flexitac:v1')); return { n: s.steps['the-sandwich'], rev: s.stepsRev && s.stepsRev['the-sandwich'], dots: document.querySelectorAll('.step-dot.is-done').length, cur: document.querySelector('.step-dot.is-current')?.dataset.k }; })()`);
  const want = saved.steps["the-sandwich"] > 0 ? 2 : 0;
  ok(`saved progress (${label}): ${want} dots done`, st.n === want && st.rev === 3 && st.dots === want && st.cur === "0", st);
}
writeFileSync(`${OUT}/${tag}.json`, JSON.stringify(results, null, 2));
b.close();
const fails = results.filter((r) => !r.pass).length;
console.log(`${tag}: ${results.length - fails}/${results.length} passed`);
process.exit(fails ? 1 : 0);
