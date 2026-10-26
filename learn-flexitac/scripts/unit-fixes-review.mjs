// SUPERSEDED (2026-10-24): this checks the old five-step Lesson 2 ("One touch spot", then "Five layers" … "Seal the edges"
// with the layer inspector), which the rework replaced by three steps (one touch spot -> 2 × 2 -> 12 × 32, no inspector).
// Its step counts, the inspector and the old saved-progress case no longer apply: use scripts/lesson2-review.mjs (all
// three steps, the figure mirror, the dots, saved progress) and scripts/unit-3d-review.mjs (the unit card).
// Lesson 2 step 1: the review fixes (review/lesson2-unit-review) on a built site, headless Chrome over CDP, real input.
//   npx vite build --outDir /tmp/lf-dist && (cd /tmp/lf-dist && python3 -m http.server 8863 --bind 127.0.0.1) &
//   node scripts/unit-fixes-review.mjs --size 1440x900 --theme light [--phone] [--mode full|sweep]
//        [--base http://127.0.0.1:8863/] [--out review/lesson2-unit-fix]
// full: the pad taken apart in step 1 (the figure's "Take apart" button and Space) leaves the grid, the stage and the
// card exactly where they were (only the leader hides); the kicker is one line on cards >= 280 px; the ring stays
// saturated mid-press (oklch); Run in step 1 says when the inspector shows it (and is not covered); stacked layouts
// keep the steps bar on screen on Next and dot 1; restart from step 3 lands on step 1's pose with the card (never the
// page flow). sweep: the card's place, size and clearance at one window size.
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
const MODE = opt("mode", "full");
const BASE = opt("base", "http://127.0.0.1:8863/");
const OUT = resolve(root, opt("out", "review/lesson2-unit-fix"));
mkdirSync(OUT, { recursive: true });
const tag = `${W}x${H}-${THEME}${PHONE ? "-phone" : ""}`;
const results = [];
const ok = (name, pass, info = "") => {
  results.push({ name, pass: Boolean(pass), info });
  console.log(`${pass ? "PASS" : "FAIL"}  ${tag}  ${name}${info !== "" ? "  " + (typeof info === "string" ? info : JSON.stringify(info)) : ""}`);
};
const note = (name, info) => console.log(`NOTE  ${tag}  ${name}  ${typeof info === "string" ? info : JSON.stringify(info)}`);

const b = await launch({ width: W, height: H, mobile: PHONE, touch: PHONE, scale: 1 });
const { send, evaluate } = b;
await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: THEME }] });
await send("Page.addScriptToEvaluateOnNewDocument", {
  source: `if (window === window.top) { window.__errs = [];
    addEventListener('message', (e) => { const d = e.data; if (!d || typeof d.type !== 'string') return;
      if (d.type === 'ft:error') window.__errs.push(d);
      else if (d.type === 'ft:focus') window.__focus = d;
      else if (d.type === 'ft:state') window.__st = d.state; }); }`,
});
const snap = (name) => b.shot(join(OUT, `${tag}-${name}.png`));
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
const elBox = (sel) => evaluate(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; })()`);
const centre = (r) => [r.x + r.w / 2, r.y + r.h / 2];
const click = async (x, y) => {
  if (PHONE) {
    await send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y, id: 1 }] });
    await sleep(50);
    await send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    return;
  }
  await b.click(x, y);
};
const layout = () =>
  evaluate(`(() => { const v = document.querySelector('.lesson-view'); const cs = getComputedStyle(v); const st = document.querySelector('.stage').getBoundingClientRect(); const p = document.querySelector('.panel').getBoundingClientRect();
    const c = document.querySelector('.demo-card[data-demo="unit"]'); const cr = c && c.getBoundingClientRect();
    const L = document.querySelector('.demo-leader'); const lv = L && !L.classList.contains('is-hidden') && L.classList.contains('is-on');
    return { cols: cs.gridTemplateColumns, stage: [Math.round(st.x), Math.round(st.y), Math.round(st.width), Math.round(st.height)], panel: [Math.round(p.x), Math.round(p.width), Math.round(p.height)],
      card: c ? { place: c.dataset.place, compact: c.hasAttribute('data-compact'), on: c.classList.contains('is-on'), x: Math.round(cr.x), y: Math.round(cr.y), w: Math.round(cr.width), h: Math.round(cr.height), parent: c.parentElement.className } : null,
      leader: Boolean(lv), scrollY: Math.round(scrollY), docW: document.scrollingElement.scrollWidth }; })()`);
const cardOn = `(() => { const c = document.querySelector('.demo-card[data-demo="unit"]'); return c && c.classList.contains('is-on'); })()`;
const figBtn = async (labelRe) => {
  const fb = await frameBox();
  const r = await fr(`(() => { const b = [...document.querySelectorAll('button')].find(b => ${labelRe}.test(b.getAttribute('aria-label') || b.title || '')); if (!b) return null; const r = b.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2, b.getAttribute('aria-label')]; })()`);
  return r ? [fb.x + r[0], fb.y + r[1], r[2]] : null;
};
const figState = () => fr(`(() => { const s = window.__padExplore; const f = s && s.focus ? s.focus() : null; return { apart: window.__st ? null : null, focusOn: f ? f.on : null, shown: f ? f.shown : null, p: f ? f.p : null }; })()`);
const st = () => evaluate(`window.__st ? JSON.parse(JSON.stringify(window.__st)) : null`);
const apartNow = async () => {
  const s = await st();
  return s ? Object.values(s.shares).every((v) => v > 0.95) : null;
};
const together = async () => {
  const s = await st();
  return s ? Object.values(s.shares).every((v) => v < 0.01) : null;
};
const kicker = () => evaluate(`document.querySelector('.steps-kicker')?.textContent.trim()`);

await b.goto(`${BASE}#/lesson/the-sandwich`);
const opened = await until(`window.__focus && window.__focus.ring && ${cardOn}`, 15000);
await sleep(900);
const L0 = await layout();
ok("opens: card on", opened, L0.card);
note("layout at open", L0);
ok("grid has 2 columns (desktop) / 1 (stacked)", L0.cols.split(" ").length === (W >= 1024 && H >= 640 ? 2 : 1), L0.cols);
ok("no horizontal scroll", L0.docW <= W + 1, L0.docW);
await snap("01-open");

if (MODE === "sweep") {
  const fb = await frameBox();
  const s = await st();
  const pad = s?.feel?.pad;
  const c = L0.card;
  const over = pad && c && c.place === "beside" && c.x < fb.x + pad.x + pad.w;
  ok("card placed beside the pad, visible size", c && c.place === "beside" && c.w >= (W < 500 ? 100 : 200) && c.h > 120, c);
  ok("card not over the pad", !over, { padRight: pad && fb.x + pad.x + pad.w, cardLeft: c?.x });
  ok("card inside the viewport", c && c.x >= 0 && c.x + c.w <= W + 0.5 && (PHONE || W < 1024 || H < 640 || c.y + c.h <= H + 0.5), c);
  const k = await evaluate(`(() => { const k = document.querySelector('.ud-kicker'); const n = k.querySelector('.ud-name').getBoundingClientRect(); const i = k.querySelector('.ud-ill').getBoundingClientRect(); return { one: Math.abs(n.top - i.top) < 2, text: k.innerText.replace(/\\n/g, ' / '), ud: document.querySelector('.ud').clientWidth }; })()`);
  note("kicker", k);
  await finish();
}

// kicker on one line from 280 px cards
{
  const k = await evaluate(`(() => { const k = document.querySelector('.ud-kicker'); const n = k.querySelector('.ud-name').getBoundingClientRect(); const i = k.querySelector('.ud-ill').getBoundingClientRect(); const x = document.querySelector('.demo-close').getBoundingClientRect(); return { one: Math.abs(n.top - i.top) < 2, text: k.innerText.replace(/\\n/g, ' / '), illRight: i.right, closeLeft: x.left, card: document.querySelector('.demo-card').getBoundingClientRect().width }; })()`);
  ok("kicker: one line on a card >= 280 px (else two)", k.card >= 280 ? k.one && /·/.test(k.text) : true, k);
  ok("kicker: clear of the × button", !k.one || k.illRight <= k.closeLeft - 2, k);
}

// ---------------------------------------------------------------- 1. take apart in step 1 (toolbar button, real click)
{
  const before = await layout();
  const btn = await figBtn(`/Take apart/`);
  note("apart button", btn);
  if (btn) {
    await click(btn[0], btn[1]);
    await until(`window.__st && Object.values(window.__st.shares).every(v => v > 0.95)`, 5000);
    await sleep(900);
    const after = await layout();
    note("after apart (button)", after);
    ok("apart (button): pad apart", await apartNow());
    ok("apart (button): grid unchanged", after.cols === before.cols, [before.cols, after.cols]);
    ok("apart (button): stage size unchanged", JSON.stringify(after.stage) === JSON.stringify(before.stage), [before.stage, after.stage]);
    ok("apart (button): card stays in place (same place, x, y, w)", after.card && after.card.place === before.card.place && Math.abs(after.card.x - before.card.x) <= 1 && Math.abs(after.card.y - before.card.y) <= 1 && Math.abs(after.card.w - before.card.w) <= 1 && after.card.on, [before.card, after.card]);
    ok("apart (button): leader hidden", !after.leader);
    await snap("02-apart-button");
    // put it back together with the same button
    const btn2 = await figBtn(`/Put (it )?together|Take apart|Close|Assemble/`);
    note("together button", btn2);
    await click(btn2[0], btn2[1]);
    await until(`window.__st && Object.values(window.__st.shares).every(v => v < 0.01) && window.__focus && window.__focus.ring`, 5000);
    await sleep(900);
    const back = await layout();
    ok("together again: ring back, card same place, leader back", back.card && back.card.place === before.card.place && Math.abs(back.card.x - before.card.x) <= 1 && Math.abs(back.card.y - before.card.y) <= 1 && back.leader === before.leader, [before.card, back.card, back.leader]);
  }
}

// ---------------------------------------------------------------- 2. Space key in step 1
if (!PHONE) {
  const before = await layout();
  const fb = await frameBox();
  // focus the drawing: a click on the empty top-left of the figure (no part there)
  await click(fb.x + 30, fb.y + fb.h * 0.35);
  await sleep(300);
  await b.key(" ");
  await until(`window.__st && Object.values(window.__st.shares).every(v => v > 0.95)`, 5000);
  await sleep(900);
  const after = await layout();
  note("after Space", after);
  ok("Space: pad apart", await apartNow());
  ok("Space: grid and stage unchanged", after.cols === before.cols && JSON.stringify(after.stage) === JSON.stringify(before.stage), [before.stage, after.stage, after.cols]);
  ok("Space: card stays in place", after.card && after.card.place === before.card.place && Math.abs(after.card.x - before.card.x) <= 1 && Math.abs(after.card.y - before.card.y) <= 1 && after.card.on, [before.card, after.card]);
  await snap("03-space-apart");
  await b.key(" ");
  await until(`window.__st && Object.values(window.__st.shares).every(v => v < 0.01) && window.__focus && window.__focus.ring`, 5000);
  await sleep(900);
  const back = await layout();
  ok("Space again: together, card and leader back", back.card && back.card.place === before.card.place && back.leader === before.leader, [back.card, back.leader]);
}

// ---------------------------------------------------------------- 3. ring colour mid-press (oklch, saturated)
{
  const t0 = Date.now();
  let got = null;
  while (Date.now() - t0 < 7000) {
    const p = await fr(`window.__padExplore.focus().p`);
    if (p > 0.42 && p < 0.58) {
      got = await fr(`(() => { const r = document.querySelector('.pd-focus-ring'); return { p: window.__padExplore.focus().p, stroke: getComputedStyle(r).stroke }; })()`);
      break;
    }
    await sleep(30);
  }
  note("ring mid-press", got);
  const m = got && got.stroke.match(/oklch\(([\d.]+) ([\d.]+) ([\d.]+)/);
  ok("ring mid-press: saturated (oklch chroma >= 0.1)", m && +m[2] >= 0.1, got);
  if (got) {
    const fb = await frameBox();
    const f = await evaluate(`window.__focus`);
    if (f?.ring) await b.shot(join(OUT, `${tag}-04-ring-mid-zoom.png`), { x: Math.max(0, fb.x + f.ring.x - 60), y: Math.max(0, fb.y + f.ring.y - 40), width: 120, height: 80, scale: 3 });
  }
}

// ---------------------------------------------------------------- 4. Run in step 1 (inspector hidden)
{
  const run = await elBox(".code-card [data-run], .code-card .btn-run, .code-card button.btn-primary");
  if (run && run.w > 0 && !PHONE && W >= 1024) {
    const hit = await evaluate(`(() => { const r = document.querySelector('.code-card [data-run]').getBoundingClientRect(); const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return Boolean(e && e.closest('[data-run]')); })()`);
    ok("Run button not covered (by the card or anything)", hit);
    await click(...centre(run));
    await sleep(400);
    const lines = await evaluate(`[...document.querySelectorAll('.console-line')].map(l => l.textContent.trim())`);
    note("Run in step 1", lines);
    ok("Run in step 1: says when the inspector shows it", lines.some((l) => /layer inspector draws this from step 2/.test(l)), lines);
    await evaluate(`document.querySelector('.console-close')?.click()`);
  } else note("Run", "skipped (no visible Run button)");
}

// ---------------------------------------------------------------- 5. stacked: Next in step 1 keeps the bar in place
const goBox = () => elBox("[data-go]");
if (W < 1024 || H < 640) {
  await evaluate(`scrollTo(0, 0)`);
  await sleep(300);
  const g0 = await goBox();
  if (g0.y + g0.h > H) {
    // bring the bar on screen like a learner would (scroll just enough)
    await evaluate(`scrollBy(0, ${Math.ceil(g0.y + g0.h - H + 16)})`);
    await sleep(300);
  }
  const g1 = await goBox();
  await click(...centre(g1));
  await until(`/Step 2 of 5/.test(document.querySelector('.steps-kicker')?.textContent || '')`, 4000);
  await sleep(1500);
  const g2 = await goBox();
  const sb2 = await elBox(".stage-body");
  ok("stacked Next 1->2: the button stays on screen (moves down at most to the window's bottom)", g2.y >= g1.y - 2 && g2.y + g2.h <= H, { before: g1.y, after: g2.y, bottom: g2.y + g2.h, scrollY: await evaluate("scrollY") });
  ok("stacked Next 1->2: as much of the figure as fits stays in view", sb2.y + sb2.h > 60, sb2);
  await snap("05-stacked-step2");
  // dot 1 from step 2 (the bar where it is)
  const d = await elBox('.step-dot[data-k="0"]');
  const barBefore = await elBox(".steps");
  const sy0 = await evaluate("scrollY");
  await click(...centre(d));
  await until(`window.__focus && window.__focus.ring && ${cardOn}`, 10000);
  await sleep(1500);
  const barAfter = await elBox(".steps");
  const sb = await elBox(".stage-body");
  const L = await layout();
  const sy1 = await evaluate("scrollY");
  ok("stacked dot 1: the bar stays under the finger (or the page is back at its top)", Math.abs(barAfter.y - barBefore.y) <= 2 || (sy1 === 0 && barAfter.y < barBefore.y && barAfter.y > 0), { before: barBefore.y, after: barAfter.y, scrollY: [sy0, sy1] });
  ok("stacked dot 1: the figure is on screen (its bottom half at least)", sb.y + sb.h > 0 && sb.y + sb.h * 0.5 < H, sb);
  ok("stacked dot 1: card shown", L.card && L.card.on, L.card);
  note("stacked dot 1 layout", L);
  await snap("06-stacked-dot1");
  await evaluate(`scrollTo(0, 0)`);
  await sleep(300);
}

// ---------------------------------------------------------------- 6. step 3, then restart
{
  // two Nexts from step 1 (desktop: in view; stacked: scroll the bar into view)
  for (let k = 0; k < 2; k++) {
    await evaluate(`document.querySelector('[data-go]').scrollIntoView({ block: 'center' })`);
    await sleep(200);
    const g = await goBox();
    await click(...centre(g));
    await sleep(1500);
  }
  ok("at step 3", /Step 3 of 5/.test((await kicker()) || ""), await kicker());
  const before = await layout();
  const r = await elBox("[data-restart]");
  await click(...centre(r));
  const back = await until(`window.__focus && window.__focus.ring && ${cardOn}`, 10000);
  await sleep(1500);
  const after = await layout();
  const s = await st();
  ok("restart: Step 1 of 5", /Step 1 of 5 · One touch spot/.test((await kicker()) || ""), await kicker());
  ok("restart: figure back in step 1's pose (assembled, ring)", back && (await together()) && s?.focus?.on, { focus: s?.focus });
  ok("restart: card shown beside the pad", after.card && after.card.on && after.card.place === "beside", after.card);
  ok("restart: grid intact", after.cols === L0.cols, [L0.cols, after.cols]);
  // (short desktop windows scroll the outlet, so compare the stage's size, not its top)
  if (W >= 1024 && H >= 640) ok("restart: stage size as at open", after.stage[2] === L0.stage[2] && after.stage[3] === L0.stage[3], [L0.stage, after.stage]);
  note("restart layout", after);
  await evaluate(`scrollTo(0, 0)`);
  await sleep(300);
  await snap("07-after-restart");
}

await finish();

async function finish() {
  const errs = b.problems.filter((p) => !/favicon/i.test(p));
  const fe = await evaluate(`window.__errs`);
  ok("no console errors", errs.length === 0, errs.slice(0, 5));
  ok("no ft:error", !fe || fe.length === 0, fe);
  writeFileSync(join(OUT, `${tag}-${MODE}.json`), JSON.stringify(results, null, 1));
  const fails = results.filter((r) => !r.pass);
  console.log(`SUMMARY ${tag} ${MODE}: ${results.length - fails.length}/${results.length} pass`);
  b.close();
  process.exit(0);
}
