// Lesson 1 step 1 "On a robot" (the robot grasp over the whole stage, GuidedStep.stage) and the step moves that came
// with it (Lesson 1: robot -> feel -> take apart; Lesson 2: Squeeze the Velostat -> one spot -> 2 × 2 -> whole pad), on a
// BUILT site, headless Chrome over CDP with real mouse input (no npm deps; Node 22).
//   npx vite build --outDir /tmp/lf-dist && npx vite preview --outDir /tmp/lf-dist --port 8871 --strictPort &
//   node scripts/l1-robot-review.mjs --size 1440x900 --theme light [--base http://127.0.0.1:8871/] [--out review/l1-robot]
//        [--only l1|l2|home|saved]
// Checks:
//   l1    step 1 opens with the robot layer over the whole stage body (no fade on load), the figure loaded underneath in
//         step 2's pose (feel mode, plan view), inert; the loop plays and the two maps show the video's frame (sampled,
//         and four captures: approach, contact, hold, open); the step text <= 3 lines (every step's); Next step
//         cross-fades to the figure, which shows at once (its camera unchanged) and the video pauses; a real press lights
//         the touch map; Show me presses and lets go; step 3 Show me takes the pad apart with all seven labels; dots in
//         odd orders land in each step's state; restart comes back to the robot; a theme switch mid-loop keeps the loop's
//         place and the maps in step; a theme switch in step 2 keeps the figure.
//   l2    step 1 opens on the Velostat: the pad apart, its label, the velostat card clear of the pad and the label, the
//         camera still after entry; Next step through steps 2-4 (their cards); dots in odd orders; restart.
//   saved old saved progress and quiz answers are moved onto today's steps and questions (src/state/store.ts).
//   home  the home page: the hero cover is the robot grasp (src/widgets/robot-grasp.ts, cover form) playing muted with its
//         two maps in step (sampled), the hold moment captured, a theme switch mid-loop keeps its place, reduced motion
//         shows the poster and the hold moment's maps, the pad section card keeps its finger-press loop, a click on the
//         hero opens lesson 1 on the robot; the lessons page and the lesson strip (the L01 thumbnail, unchanged).
// No console errors, no ft:error. PNGs and <tag>.json land in --out.
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { mkdirSync, writeFileSync } from "node:fs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const { launch, sleep } = await import(pathToFileURL(resolve(root, "../flexitac-anatomy/figures/pad/shots/clean/cdp.mjs")).href);

const args = process.argv.slice(2);
const opt = (n, d) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : d);
const [W, H] = opt("size", "1440x900").split("x").map(Number);
const THEME = opt("theme", "light");
const BASE = opt("base", "http://127.0.0.1:8871/");
const OUT = resolve(root, opt("out", "review/l1-robot"));
const ONLY = opt("only", "all");
const run = (part) => ONLY === "all" || ONLY.split(",").includes(part);
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
  source: `if (window === window.top) { window.__errs = []; window.__touch = null;
    addEventListener('message', (e) => { const d = e.data; if (!d || typeof d.type !== 'string') return;
      if (d.type === 'ft:error') window.__errs.push(d);
      else if (d.type === 'ft:state') window.__st = d.state;
      else if (d.type === 'ft:touch') window.__touch = d.frame; }); }`,
});
const snap = (name) => b.shot(join(OUT, `${tag}-${name}.png`));
// A full page load (a hash-only change is a same-document navigation: the site's in-memory copy of the saved progress,
// src/state/store.ts, would outlive a localStorage the test just seeded).
const fresh = async (url) => {
  await b.goto("about:blank");
  await b.goto(url);
};
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
const fr = (js) => evaluate(`(() => { const f = document.querySelector('iframe.figure-frame'); if (!f || !f.contentWindow || !f.contentWindow.__padExplore) return null; return f.contentWindow.eval(${JSON.stringify(js)}); })()`);
const frameBox = () => evaluate(`(() => { const f = document.querySelector('iframe.figure-frame'); const r = f.getBoundingClientRect(); return { x: r.left + f.clientLeft, y: r.top + f.clientTop, w: f.clientWidth, h: f.clientHeight }; })()`);
const box = (sel) => evaluate(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; })()`);
const centre = (r) => [r.x + r.w / 2, r.y + r.h / 2];
const clickSel = async (sel) => {
  const r = await box(sel);
  if (!r || !r.w) throw new Error(`nothing to click: ${sel}`);
  await b.click(...centre(r));
};
const kicker = () => evaluate(`document.querySelector('.steps-kicker')?.textContent.trim()`);
const goLabel = () => evaluate(`document.querySelector('.steps [data-go] .go-label:not(.go-sizer)')?.textContent.trim()`);
const cam = () => fr(`JSON.stringify(window.__padExplore.camera())`);
const lines = () =>
  evaluate(`(() => { const lh = (t) => parseFloat(getComputedStyle(t).lineHeight); const n = (t) => Math.round(t.getBoundingClientRect().height / lh(t));
    const cur = document.querySelector('.steps-text:not(.steps-sizer)'); return { now: n(cur), all: [...document.querySelectorAll('.steps-sizer')].map(n), w: Math.round(cur.getBoundingClientRect().width) }; })()`);
/** The robot layer: shown (on, not hidden), its box against the stage body's, the video and the maps' frame. */
const robot = () =>
  evaluate(`(() => { const o = document.querySelector('.stage-over'); const sb = document.querySelector('.stage-body'); const fs = document.querySelector('.figure-slot');
    const v = document.querySelector('.rg-video'); const rg = document.querySelector('.rg');
    const r = (e) => { if (!e) return null; const q = e.getBoundingClientRect(); return { x: Math.round(q.left), y: Math.round(q.top), w: Math.round(q.width), h: Math.round(q.height) }; };
    return { exists: Boolean(o), hidden: o ? o.hidden : null, on: o ? o.classList.contains('is-on') : false, op: o ? +getComputedStyle(o).opacity : null, display: o ? getComputedStyle(o).display : null,
      box: r(o), stage: r(sb), figInert: fs ? fs.inert : null, figAria: fs ? fs.getAttribute('aria-hidden') : null, dataStage: sb.dataset.stage || null,
      video: v ? { t: v.currentTime, paused: v.paused, src: v.currentSrc.split('/').pop(), ready: v.readyState } : null, frame: rg ? +rg.dataset.frame : null,
      counts: [...document.querySelectorAll('.rg-count')].map((c) => c.textContent.trim()), media: r(document.querySelector('.rg-media')), maps: [...document.querySelectorAll('.rg-map canvas')].map(r) }; })()`);
/** The maps' frame against the frame the video has PRESENTED (a requestVideoFrameCallback chain of our own records its
 *  mediaTime; currentTime runs ahead of the picture on screen, so it is no yardstick), sampled two animation frames
 *  later, so both callbacks for the same picture have run. */
const syncSample = (scope = "") =>
  evaluate(`new Promise((res) => { const v = document.querySelector('${scope} .rg-video'); if (!v) return res(null);
    if (v.__pfOn !== true) { v.__pfOn = true; const cb = (_n, m) => { v.__pf = Math.round(m.mediaTime * 30) % 270; v.requestVideoFrameCallback(cb); }; v.requestVideoFrameCallback(cb); }
    requestAnimationFrame(() => requestAnimationFrame(() => res({ pf: v.__pf ?? null, f: +document.querySelector('${scope} .rg').dataset.frame, t: v.currentTime, paused: v.paused }))); })`);
const frameGap = (s) => (s && s.pf !== null ? Math.min(Math.abs(s.pf - s.f), 270 - Math.abs(s.pf - s.f)) : 99);
const toggleTheme = async () => {
  const t = await box("[data-theme-toggle]");
  if (t && t.w > 0) await b.click(...centre(t));
  else await evaluate(`document.querySelector('[data-theme-toggle]').click()`);
};
const themeNow = () => evaluate(`document.documentElement.dataset.theme`);

// ------------------------------------------------------------------ Lesson 1
if (run("l1")) {
  await evaluate(`localStorage.clear()`).catch(() => {});
  await b.goto(`${BASE}#/lesson/meet-flexitac`);
  await evaluate(`localStorage.clear()`);
  await fresh(`${BASE}#/lesson/meet-flexitac`);
  // first paint: the layer is already on (no fade on load)
  const first = await robot();
  ok("l1 load: the robot layer is on from the first paint", first.exists && first.on && !first.hidden, { on: first.on, op: first.op });
  const playing = await until(`(() => { const v = document.querySelector('.rg-video'); return v && !v.paused && v.currentTime > 0.3; })()`, 15000);
  ok("l1 step 1: the loop plays", playing);
  const figReady = await until(`window.__st && window.__st.feel && window.__st.feel.on === true && window.__st.plan === 1`, 15000);
  ok("l1 step 1: the figure loaded underneath in step 2's pose (feel mode, plan view)", figReady);
  await sleep(600);
  let r = await robot();
  ok("l1 step 1: kicker", /Step 1 of 3 · On a robot/.test(await kicker()), await kicker());
  ok("l1 step 1: the layer covers the whole stage body", r.box && r.stage && r.box.x === r.stage.x && r.box.y === r.stage.y && r.box.w === r.stage.w && r.box.h === r.stage.h && r.op === 1, { box: r.box, stage: r.stage, op: r.op });
  ok("l1 step 1: the figure under it is inert and aria-hidden", r.figInert === true && r.figAria === "true");
  ok("l1 step 1: no demo card", (await evaluate(`document.querySelectorAll('.demo-card').length`)) === 0);
  ok("l1 step 1: the button reads Next step", (await goLabel()) === "Next step", await goLabel());
  const ln = await lines();
  ok(`l1: step texts <= 3 lines (${ln.w} px column)`, ln.now <= 3 && Math.max(...ln.all) <= 3, ln);
  ok("l1 step 1: video and maps laid out side by side inside the layer", r.media && r.maps.length === 2 && r.maps.every((m) => m.x > r.media.x + r.media.w - 1 && m.y >= r.box.y && m.y + m.h <= r.box.y + r.box.h), { media: r.media, maps: r.maps });
  ok("l1 step 1: no horizontal scroll", await evaluate(`document.scrollingElement.scrollWidth <= innerWidth + 1`));
  // sync: the maps show the frame the video is on (sampled while it plays)
  {
    const diffs = [];
    await syncSample();
    await sleep(200);
    for (let q = 0; q < 24; q++) {
      diffs.push(frameGap(await syncSample()));
      await sleep(137);
    }
    ok("l1 step 1: maps on the frame the video presents (24 samples, within one)", Math.max(...diffs) <= 1, { max: Math.max(...diffs), diffs: diffs.join("") });
  }
  // four moments of the loop
  const moments = [
    ["1-approach", 40, 0],
    ["2-contact", 100, 1],
    ["3-hold", 166, 1],
    ["4-open", 231, 0],
  ];
  for (const [name, f, lit] of moments) {
    const hit = await until(`(() => { const x = +document.querySelector('.rg').dataset.frame; return x >= ${f} && x <= ${f + 3}; })()`, 12000);
    r = await robot();
    await snap(`l1-step1-${name}`);
    const any = r.counts.some((c) => /lit/.test(c));
    ok(`l1 step 1 ${name}: frame ${r.frame}, maps ${lit ? "lit" : "dark"}`, hit && (lit ? r.counts.every((c) => /lit/.test(c)) : !any), { frame: r.frame, counts: r.counts });
  }
  // theme switch mid-loop: the loop keeps its place, the maps stay in step, the figure reloads underneath
  {
    await until(`(() => { const x = +document.querySelector('.rg').dataset.frame; return x >= 120 && x <= 125; })()`, 12000);
    const before = await robot();
    await toggleTheme();
    await sleep(900);
    const after = await robot();
    const t2 = await themeNow();
    const kept = after.video && before.video && after.video.src !== before.video.src && after.video.src.includes(t2) && after.video.t - before.video.t > -0.2 && after.video.t - before.video.t < 1.6;
    ok(`l1 step 1: theme switch (${THEME} -> ${t2}) keeps the loop's place`, kept, { before: before.video, after: after.video });
    await syncSample();
    await sleep(300);
    const s2 = await syncSample();
    ok("l1 step 1: after the switch the maps are in step and it plays", s2 && !s2.paused && frameGap(s2) <= 1, s2);
    const back = await until(`window.__st && window.__st.feel && window.__st.feel.on === true && window.__st.plan === 1`, 12000);
    ok("l1 step 1: the figure reloaded underneath, still in step 2's pose", back);
    await snap("l1-step1-theme-switched");
    await toggleTheme();
    await sleep(900);
    await until(`window.__st && window.__st.feel && window.__st.feel.on === true && window.__st.plan === 1`, 12000);
    await sleep(800);
  }
  // Next step: cross-fade to the figure, which is already in its pose
  {
    const c0 = await cam();
    await clickSel(".steps [data-go]");
    await sleep(120);
    const mid = await robot();
    await snap("l1-step2-crossfade");
    await sleep(500);
    r = await robot();
    const c1 = await cam();
    ok("l1 step 2: kicker", /Step 2 of 3 · Feel it/.test(await kicker()), await kicker());
    ok("l1 step 2: the layer fades out (mid-fade, then hidden)", mid.op > 0 && mid.op < 1 && r.hidden === true && r.display === "none", { midOp: mid.op, hidden: r.hidden });
    ok("l1 step 2: the figure is live again (not inert)", r.figInert === false && r.figAria === null && r.dataStage === null);
    ok("l1 step 2: the video paused", r.video && r.video.paused, r.video);
    ok("l1 step 2: the figure shows at once (camera unchanged by the step change)", c0 && c0 === c1, c0 === c1 ? "" : { c0, c1 });
    ok("l1 step 2: button reads Show me", (await goLabel()) === "Show me", await goLabel());
    await sleep(500);
    await snap("l1-step2-feel");
    // a real press on the sensing area
    const fb = await frameBox();
    const area = await fr(`window.__padExplore.feel().state.area`);
    const [x, y] = [fb.x + area.x + area.w * 0.4, fb.y + area.y + area.h * 0.55];
    await b.move(x, y);
    await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", buttons: 1, clickCount: 1 });
    await sleep(700);
    const lit = await evaluate(`window.__touch ? window.__touch.values.filter((v) => v > 0).length : 0`);
    await snap("l1-step2-press");
    await send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", buttons: 0, clickCount: 1 });
    ok(`l1 step 2: a real press lights the touch map (${lit} spots)`, lit > 0);
    await b.move(10, H / 2);
    await sleep(900);
    // Show me: the finger demo
    await clickSel(".steps [data-go]");
    await sleep(1200);
    const fl = await evaluate(`window.__touch ? { press: window.__touch.press, lit: window.__touch.values.filter((v) => v > 0).length } : null`);
    await snap("l1-step2-showme");
    ok("l1 step 2: Show me presses", fl && fl.press > 0.5 && fl.lit > 0, fl);
    await until(`window.__touch && window.__touch.press === 0`, 9000);
    await sleep(300);
    ok("l1 step 2: Show me lets go, button reads Next step", (await evaluate(`window.__touch.press`)) === 0 && (await goLabel()) === "Next step", await goLabel());
  }
  // step 3: Show me takes it apart, all labels
  {
    await clickSel(".steps [data-go]");
    await sleep(2400);
    ok("l1 step 3: kicker", /Step 3 of 3 · Take it apart/.test(await kicker()), await kicker());
    ok("l1 step 3: feel off, iso, closed, all-labels mode", await until(`window.__st && window.__st.feel && window.__st.feel.on === false && window.__st.plan === 0`, 4000));
    ok("l1 step 3: robot layer stays hidden", (await robot()).hidden === true);
    await clickSel(".steps [data-go]");
    await sleep(2600);
    const st = await fr(`(() => { const s = window.__padExplore.state(); return { apart: s.apart, labels: s.labels }; })()`);
    ok("l1 step 3: Show me takes it apart with all seven labels", st && st.apart === true && st.labels.length === 7, st);
    ok("l1 step 3: button reads Done (disabled)", (await goLabel()) === "Done" && (await evaluate(`document.querySelector('.steps [data-go]').disabled`)), await goLabel());
    await b.move(10, H / 2);
    await sleep(300);
    await snap("l1-step3-all-labels");
  }
  // dots in odd orders
  {
    const stateAt = async () => {
      const r2 = await robot();
      const f = await fr(`(() => { const s = window.__padExplore.state(); return { feel: window.__padExplore.feel().on, all: window.__padExplore.all() !== null, apart: s.apart, labels: s.labels.length }; })()`);
      return { over: r2.on && !r2.hidden, playing: r2.video && !r2.video.paused, ...f };
    };
    for (const order of [[0, 2, 1, 0, 2, 0, 1], [2, 1, 2, 0]]) {
      for (const k of order) {
        await clickSel(`.step-dot[data-k="${k}"]`);
        await sleep(k === 0 ? 1600 : 2400);
        const s = await stateAt();
        const want = k === 0 ? s.over && s.playing && s.feel : k === 1 ? !s.over && s.feel && !s.all : !s.over && !s.feel && s.all && !s.apart && s.labels === 0;
        ok(`l1 dots ${order.join("->")}: step ${k + 1} lands in its state`, want, s);
      }
    }
    await snap("l1-dots-end-step2");
  }
  // restart: back to the robot
  {
    await clickSel('.step-dot[data-k="2"]');
    await sleep(2400);
    await clickSel(".steps [data-go]"); // Show me: apart
    await sleep(2400);
    await clickSel(".steps [data-restart]");
    await sleep(1200);
    const r2 = await robot();
    const back = await until(`window.__st && window.__st.feel && window.__st.feel.on === true && window.__st.plan === 1`, 6000);
    ok("l1 restart: step 1, the robot layer on and playing, the figure back in step 2's pose", /Step 1 of 3/.test(await kicker()) && r2.on && !r2.hidden && r2.video && !r2.video.paused && back, { kicker: await kicker(), on: r2.on, v: r2.video });
    ok("l1 restart: the button reads Next step", (await goLabel()) === "Next step", await goLabel());
    await snap("l1-restart");
    // a theme switch in step 2 keeps the figure (and the layer stays hidden)
    await clickSel(".steps [data-go]");
    await sleep(900);
    await toggleTheme();
    const ok2 = await until(`window.__st && window.__st.feel && window.__st.feel.on === true && window.__st.plan === 1`, 12000);
    await sleep(1200);
    ok("l1 step 2: a theme switch keeps feel mode, the layer stays hidden", ok2 && (await robot()).hidden === true && /Feel it/.test(await kicker()));
    await snap("l1-step2-theme-switched");
    await toggleTheme();
    await sleep(1500);
  }
  const fe = await evaluate(`window.__errs`);
  ok("l1: no ft:error", !fe || fe.length === 0, fe);
}

// ------------------------------------------------------------------ Lesson 2
if (run("l2")) {
  await fresh(`${BASE}#/lesson/the-sandwich`);
  const cardOn = (id) => `(() => { const c = document.querySelector('.demo-card[data-demo="${id}"]'); return c && c.classList.contains('is-on'); })()`;
  const opened = await until(cardOn("velostat"), 15000);
  await sleep(900);
  ok("l2 step 1: kicker", /Step 1 of 4 · Squeeze the Velostat/.test(await kicker()), await kicker());
  ok("l2 step 1: the velostat card opens on load", opened);
  const st = await fr(`(() => { const s = window.__padExplore.state(); return { apart: s.apart, label: s.label, picked: s.picked }; })()`);
  ok("l2 step 1: the pad apart, the Velostat labelled", st && st.apart === true && JSON.stringify(st.label ?? "").includes("velostat"), st);
  ok("l2 step 1: no ring", !(await evaluate(`window.__st && window.__st.focus && window.__st.focus.on`)));
  // the card clear of the pad and the label
  const card = await box(".demo-card");
  const fb = await frameBox();
  const padPts = await fr(`(() => { const s = document.querySelector('svg.iso-svg').getBoundingClientRect(); const pts = []; for (let y = s.top; y < s.bottom; y += 5) for (let x = s.left; x < s.right; x += 5) { const h = window.__padExplore.hitAt(x, y); if (h && h.part) pts.push([x, y]); } return pts; })()`);
  const lab = await fr(`(() => { const e = document.querySelector('.ft-label'); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; })()`);
  const inCard = (x, y) => card && x >= card.x && x <= card.x + card.w && y >= card.y && y <= card.y + card.h;
  const padHits = padPts.filter(([x, y]) => inCard(fb.x + x, fb.y + y)).length;
  const labHit = lab && card && fb.x + lab.x < card.x + card.w && card.x < fb.x + lab.x + lab.w && fb.y + lab.y < card.y + card.h && card.y < fb.y + lab.y + lab.h;
  const place = await evaluate(`document.querySelector('.demo-card')?.dataset.place`);
  ok(`l2 step 1: the card (${place}) clear of the pad and the label`, padHits === 0 && !labHit && padPts.length > 50, { padHits, labHit, pts: padPts.length, card });
  const c0 = await cam();
  await sleep(3000);
  ok("l2 step 1: the camera stays put after entry", c0 === (await cam()));
  const ln = await lines();
  ok(`l2: step texts <= 3 lines (${ln.w} px column)`, ln.now <= 3 && Math.max(...ln.all) <= 3, ln);
  await b.move(10, H / 2);
  await snap("l2-step1-velostat");
  const steps = [
    ["unit", "2-one-spot", /Step 2 of 4 · One touch spot/],
    ["grid", "3-four-spots", /Step 3 of 4 · Four touch spots/],
    ["pad", "4-whole-pad", /Step 4 of 4 · The whole pad/],
  ];
  for (const [id, name, re] of steps) {
    await clickSel(".steps [data-go]");
    const on = await until(cardOn(id), 15000);
    await sleep(1200);
    const ca = await cam();
    await sleep(2000);
    const cb = await cam();
    ok(`l2 ${name}: kicker, the ${id} card, the velostat card gone, the camera still after entry`, on && re.test(await kicker()) && (await evaluate(`document.querySelectorAll('.demo-card').length`)) === 1 && ca === cb, { kicker: await kicker(), still: ca === cb });
    await snap(`l2-step${name}`);
  }
  for (const order of [[3, 0, 2, 1, 3, 0], [1, 0, 2]]) {
    for (const k of order) {
      await clickSel(`.step-dot[data-k="${k}"]`);
      const id = ["velostat", "unit", "grid", "pad"][k];
      const on = await until(cardOn(id), 15000);
      await sleep(500);
      const n = await evaluate(`document.querySelectorAll('.demo-card').length`);
      const f = await fr(`(() => { const s = window.__padExplore.state(); return { apart: s.apart, label: s.label }; })()`);
      const fs = await evaluate(`window.__st && window.__st.focus ? { on: window.__st.focus.on, span: window.__st.focus.span || null } : null`);
      const pose = k === 0 ? f.apart && JSON.stringify(f.label ?? "").includes("velostat") && !fs?.on : k === 3 ? !fs?.on : fs?.on && (k === 2) === Boolean(fs.span);
      ok(`l2 dots ${order.join("->")}: step ${k + 1}, the ${id} card, its pose`, on && n === 1 && pose, { n, f, fs });
    }
  }
  await snap("l2-dots-end-step1");
  await clickSel('.step-dot[data-k="2"]');
  await until(cardOn("grid"), 15000);
  await sleep(600);
  await clickSel(".steps [data-restart]");
  const back = await until(cardOn("velostat"), 15000);
  await sleep(900);
  const f2 = await fr(`(() => { const s = window.__padExplore.state(); return { apart: s.apart, label: s.label }; })()`);
  ok("l2 restart: step 1, the velostat card, the pad apart with its label", back && /Step 1 of 4/.test(await kicker()) && f2.apart && JSON.stringify(f2.label ?? "").includes("velostat"), { kicker: await kicker(), f2 });
  await snap("l2-restart");
  const fe = await evaluate(`window.__errs`);
  ok("l2: no ft:error", !fe || fe.length === 0, fe);
}

// ------------------------------------------------------------------ saved progress
if (run("saved")) {
  const cases = [
    // [label, lesson id, saved, want count, want rev, want dots]
    ["L1 old 1 of 3 (feel)", "meet-flexitac", { steps: { "meet-flexitac": 1 } }, 2, 2],
    ["L1 old 2 of 3 (feel, apart)", "meet-flexitac", { steps: { "meet-flexitac": 2 } }, 3, 2],
    ["L1 old 3 of 3 (all, velostat too)", "meet-flexitac", { steps: { "meet-flexitac": 3 }, done: ["meet-flexitac"] }, 3, 2],
    ["L1 nothing", "meet-flexitac", { steps: {} }, undefined, 2],
    ["L2 rev 2, 1 of 3 (one spot)", "the-sandwich", { steps: { "the-sandwich": 1 }, stepsRev: { "the-sandwich": 2 } }, 2, 3],
    ["L2 rev 2, 3 of 3", "the-sandwich", { steps: { "the-sandwich": 3 }, stepsRev: { "the-sandwich": 2 }, done: ["the-sandwich"] }, 4, 3],
    ["L2 rev 1, 5 old steps", "the-sandwich", { steps: { "the-sandwich": 5 }, stepsRev: { "the-sandwich": 1 } }, 2, 3],
    ["L2 before any change, 4 old steps", "the-sandwich", { steps: { "the-sandwich": 4 } }, 2, 3],
    ["L2 a count past the end (99)", "the-sandwich", { steps: { "the-sandwich": 99 }, stepsRev: { "the-sandwich": 2 } }, 4, 3],
  ];
  for (const [label, id, part, want, rev] of cases) {
    const saved = { done: [], quiz: {}, params: {}, ...part };
    await fresh(`${BASE}#/about`);
    await evaluate(`localStorage.setItem('learn-flexitac:v1', ${JSON.stringify(JSON.stringify(saved))})`);
    await fresh(`${BASE}#/lesson/${id}`);
    await sleep(2500);
    const s = await evaluate(`(() => { const s = JSON.parse(localStorage.getItem('learn-flexitac:v1')); return { n: s.steps['${id}'], rev: s.stepsRev && s.stepsRev['${id}'], dots: document.querySelectorAll('.step-dot.is-done').length, cur: document.querySelector('.step-dot.is-current')?.dataset.k, done: s.done.includes('${id}'), chip: !document.querySelector('.lesson-done-chip').hidden }; })()`);
    const wantDots = Math.min(want ?? 0, id === "meet-flexitac" ? 3 : 4);
    ok(`saved ${label}: count ${want ?? "none"}, rev ${rev}, ${wantDots} dots done, opens on step 1`, s.n === want && s.rev === rev && s.dots === wantDots && s.cur === "0" && s.done === (saved.done ?? []).includes(id) && s.chip === s.done, s);
  }
  // quiz answers: lesson 1's Velostat question (old #2) went to lesson 2 (its #6); lesson 1's #3 keeps its answer
  {
    const saved = { done: [], steps: {}, params: {}, quiz: { "meet-flexitac": [1, 1, 3], "the-sandwich": [1, 1, 2, 1, 1] } };
    await fresh(`${BASE}#/about`);
    await evaluate(`localStorage.setItem('learn-flexitac:v1', ${JSON.stringify(JSON.stringify(saved))})`);
    await fresh(`${BASE}#/lesson/meet-flexitac`);
    await sleep(1500);
    const q1 = await evaluate(`(() => { const s = JSON.parse(localStorage.getItem('learn-flexitac:v1')); return { saved: s.quiz['meet-flexitac'], rev: s.quizRev && s.quizRev['meet-flexitac'], n: document.querySelectorAll('.quiz .q').length, right: document.querySelectorAll('.quiz .q.is-right').length, wrong: document.querySelectorAll('.quiz .q.is-wrong').length, score: document.querySelector('.quiz-score').textContent }; })()`);
    ok("quiz L1: the Velostat answer dropped, 2 questions both still right", JSON.stringify(q1.saved) === "[1,3]" && q1.rev === 1 && q1.n === 2 && q1.right === 2 && q1.wrong === 0, q1);
    await fresh(`${BASE}#/lesson/the-sandwich`);
    await sleep(1500);
    const q2 = await evaluate(`(() => { const s = JSON.parse(localStorage.getItem('learn-flexitac:v1')); const qs = [...document.querySelectorAll('.quiz .q')]; return { saved: s.quiz['the-sandwich'], n: qs.length, right: document.querySelectorAll('.quiz .q.is-right').length, last: qs[qs.length - 1].querySelector('legend').textContent.trim() }; })()`);
    ok("quiz L2: 6 questions, the Velostat one last, the five saved answers kept", q2.n === 6 && /Velostat/.test(q2.last) && q2.right === 5 && JSON.stringify(q2.saved) === "[1,1,2,1,1]", q2);
    // a second load does not drop again
    await fresh(`${BASE}#/lesson/meet-flexitac`);
    await sleep(1200);
    const q3 = await evaluate(`JSON.parse(localStorage.getItem('learn-flexitac:v1')).quiz['meet-flexitac']`);
    ok("quiz L1: runs once (a reload keeps [1,3])", JSON.stringify(q3) === "[1,3]", q3);
    await evaluate(`localStorage.clear()`);
  }
}

// ------------------------------------------------------------------ home and lessons pages
if (run("home")) {
  const hero = () =>
    evaluate(`(() => { const a = document.querySelector('a.hero-fig'); const bx = document.querySelector('.hero-fig-img'); const rg = bx && bx.querySelector('.rg');
      const v = bx && bx.querySelector('.rg-video'); const btn = bx && bx.querySelector('.rg-play');
      const r = (e) => { if (!e) return null; const q = e.getBoundingClientRect(); return { x: Math.round(q.left), y: Math.round(q.top), w: Math.round(q.width), h: Math.round(q.height) }; };
      return { href: a ? a.getAttribute('href') : null, cap: document.querySelector('.hero-fig-cap')?.textContent.trim(), form: rg ? rg.dataset.form : null,
        ariaHidden: rg ? rg.getAttribute('aria-hidden') : null, box: r(bx), media: r(bx && bx.querySelector('.rg-media')), maps: bx ? [...bx.querySelectorAll('.rg-map canvas')].map(r) : [],
        video: v ? { t: v.currentTime, paused: v.paused, muted: v.muted, loop: v.loop, src: v.currentSrc.split('/').pop() } : null,
        poster: bx && bx.querySelector('.rg-poster') ? bx.querySelector('.rg-poster').src.split('/').pop() : null,
        btn: btn ? btn.checkVisibility() : false, tag: bx && bx.querySelector('.rg-tag') ? bx.querySelector('.rg-tag').checkVisibility() : false,
        frame: rg ? +rg.dataset.frame : null, counts: bx ? [...bx.querySelectorAll('.rg-count')].map((c) => c.textContent.trim()) : [] }; })()`);
  await fresh(`${BASE}#/`);
  const playing = await until(`(() => { const v = document.querySelector('.hero-fig .rg-video'); return v && !v.paused && v.currentTime > 0.3; })()`, 15000);
  let hh = await hero();
  ok("home hero: the robot grasp (cover form) plays, muted and looping, decorative", playing && hh.form === "cover" && hh.ariaHidden === "true" && hh.video?.muted && hh.video?.loop && hh.video.src.startsWith(`grasp-${THEME}`), hh);
  ok("home hero: no play button and no pad tag inside the link", !hh.btn && !hh.tag, { btn: hh.btn, tag: hh.tag });
  ok("home hero: a link to lesson 1, its caption", hh.href === "#/lesson/meet-flexitac" && /On a robot/.test(hh.cap ?? ""), { href: hh.href, cap: hh.cap });
  const inside = (q) => q && hh.box && q.x >= hh.box.x && q.y >= hh.box.y && q.x + q.w <= hh.box.x + hh.box.w && q.y + q.h <= hh.box.y + hh.box.h;
  ok("home hero: the video and both maps inside the box, maps right of the video", inside(hh.media) && hh.maps.length === 2 && hh.maps.every(inside) && hh.maps.every((m) => m.x >= hh.media.x + hh.media.w - 1), { box: hh.box, media: hh.media, maps: hh.maps });
  {
    const diffs = [];
    await syncSample(".hero-fig");
    await sleep(200);
    for (let q = 0; q < 16; q++) {
      diffs.push(frameGap(await syncSample(".hero-fig")));
      await sleep(151);
    }
    ok("home hero: maps on the frame the video presents (16 samples, within one)", Math.max(...diffs) <= 1, { diffs: diffs.join("") });
  }
  const atHold = await until(`(() => { const x = +document.querySelector('.hero-fig .rg').dataset.frame; return x >= 160 && x <= 168; })()`, 12000);
  hh = await hero();
  await snap("home");
  ok("home hero: the hold moment, both maps lit", atHold && hh.counts.every((c) => /lit/.test(c)), { frame: hh.frame, counts: hh.counts });
  {
    await until(`(() => { const x = +document.querySelector('.hero-fig .rg').dataset.frame; return x >= 60 && x <= 66; })()`, 12000);
    const before = await hero();
    await toggleTheme();
    await sleep(900);
    const after = await hero();
    const t2 = await themeNow();
    ok(`home hero: theme switch (${THEME} -> ${t2}) keeps the loop's place`, after.video && before.video && after.video.src.startsWith(`grasp-${t2}`) && after.video.t - before.video.t > -0.2 && after.video.t - before.video.t < 1.6 && !after.video.paused, { before: before.video, after: after.video });
    await syncSample(".hero-fig");
    await sleep(300);
    const s2 = await syncSample(".hero-fig");
    ok("home hero: after the switch the maps are in step", frameGap(s2) <= 1, s2);
    await snap("home-theme-switched");
    await toggleTheme();
    await sleep(900);
  }
  const card = await evaluate(`(() => { const c = document.querySelector('[data-card-loop="pad"]'); const m = c && c.querySelector('video, img'); return m ? (m.currentSrc || m.src || '').split('/').pop() : null; })()`);
  ok("home: the pad section card keeps its finger-press loop", /^cover-(light|dark)\.(webm|mp4|webp)$/.test(card ?? ""), card);
  // reduced motion: the poster (the hold moment) and that moment's maps, no video
  await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: THEME }, { name: "prefers-reduced-motion", value: "reduce" }] });
  await fresh(`${BASE}#/`);
  await until(`(() => { const r = document.querySelector('.hero-fig .rg'); return r && +r.dataset.frame === 166; })()`, 10000);
  await sleep(800);
  hh = await hero();
  ok("home hero, reduced motion: the poster and the hold moment's maps, no video", !hh.video && hh.poster === `grasp-${THEME}.webp` && hh.frame === 166 && hh.counts.every((c) => /lit/.test(c)), hh);
  await snap("home-reduced");
  await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: THEME }] });
  // a click on the hero opens lesson 1 on the robot
  await fresh(`${BASE}#/`);
  await sleep(1500);
  await clickSel(".hero-fig-img");
  const opened = await until(`location.hash === '#/lesson/meet-flexitac' && document.querySelector('.stage-over .rg-video') !== null`, 10000);
  ok("home hero: a click opens lesson 1 on step 1, the robot", opened && /Step 1 of 3 · On a robot/.test((await kicker()) ?? ""), await kicker());
  await fresh(`${BASE}#/lessons`);
  await sleep(1500);
  const th = await evaluate(`(() => { const i = [...document.querySelectorAll('.lesson-card-thumb img')].find((e) => /L01-/.test(e.src) && e.checkVisibility()); return i ? { src: i.src.split('/').pop(), w: i.naturalWidth, h: i.naturalHeight } : null; })()`);
  ok("lessons page: the L01 thumbnail (unchanged: Fig 1 feel pose) loads", th && th.w === 560 && th.h === 372, th);
  await snap("lessons");
  // the lesson strip under a lesson (the L01 card)
  await fresh(`${BASE}#/lesson/the-sandwich`);
  await sleep(2000);
  await evaluate(`document.querySelector('.strip-card') && document.querySelector('.strip-card').scrollIntoView({ block: 'center' })`);
  await sleep(400);
  const st = await evaluate(`(() => { const i = [...document.querySelectorAll('.strip-thumb img')].find((e) => /L01-/.test(e.src) && e.checkVisibility()); return i ? i.complete && i.naturalWidth : null; })()`);
  ok("lesson strip: the L01 thumbnail loads", st === 560, st);
  await snap("strip");
}

const errs = b.problems.filter((p) => !/favicon/i.test(p));
ok("no console errors or warnings", errs.length === 0, errs.slice(0, 6));
writeFileSync(join(OUT, `${tag}${ONLY === "all" ? "" : "-" + ONLY.replace(/,/g, "+")}.json`), JSON.stringify(results, null, 1));
const fails = results.filter((r) => !r.pass);
console.log(`SUMMARY ${tag}: ${results.length - fails.length}/${results.length} pass`);
b.close();
process.exit(fails.length ? 1 : 0);
