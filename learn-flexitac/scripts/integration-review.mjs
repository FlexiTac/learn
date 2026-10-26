// End-to-end review of the explore flow on the built site, with headless Chrome over CDP (no npm deps).
//   npm run build && npx vite preview --port 4361 --strictPort &
//   node scripts/integration-review.mjs [--base http://127.0.0.1:4361] [--out review/clean-integration]
//        [--lessons 1-9] [--sizes 2560x1440,1920x1080,1440x900,1024x768] [--themes light,dark] [--phone 1,4,7]
//        [--jobs 4] [--only-phone] [--reduced]
// Per lesson x size x theme (a fresh browser context each, so no saved progress or theme leaks between runs):
//  1. clean start: no label, no leader, no hotspot dot or callout card in the figure; no Labels switch, no stage
//     inspector, no open detail window on the site. Lesson 1 (taken to step 2 "Take it apart" first; its step 1, FEEL
//     mode, is scripts/feel-review.mjs): only the animated "Click to expand" hint (a <button>).
//  2. lesson 1: a real click on the pad expands it IN PLACE (camera = viewBox + svg box + .pd-world/.pd-view
//     transforms, unchanged), the hint goes, no label appears.
//  3. hover two parts (real mouse): the figure reports the part hovered, the element under the pointer rises ~4 px
//     (not in plan view), the hint corner shows the title, the camera is unchanged.
//  4. click each: ONE label with the title, a "Details ›" button and one horizontal leader from the card's edge to a
//     dot; ft:pick with the part; camera unchanged; the frame did not move.
//  5. "Details ›" (real click): the site's detail window floats over the right panel column (same left/right/top),
//     the panel's cards and the figure frame do not move, the camera is unchanged; Escape closes it (focus back on the
//     figure), Details again, × closes it.
//  6. a click on empty drawing removes the label (ft:pick null).
//  7. view bar: zoom in moves the camera, fit brings it back to the home camera.
//  8. theme switch (site toggle) with a label shown: the other build loads, the label (and lesson 1's expanded pad)
//     come back, no camera drift against the fresh home view.
//  9. guided steps: Show me / Next through every step; no ft:error, no "has no action" warnings.
// 10. no console errors / exceptions, no horizontal page scroll.
// Phones (390 x 844, touch): clean start, lesson 1 tap expands, tap a part -> label, Details -> bottom sheet above the
// bottom bar, × closes; no horizontal scroll.
// PNGs: <out>/<w>x<h>-<theme>-L<nn>-<k>-<step>.png; a summary in <out>/summary.json and on stdout.
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const { chromePort } = await import(pathToFileURL(resolve(root, "../anatomy/scripts/chrome-port.mjs")).href);

// ------------------------------------------------------------------ args
const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : dflt;
};
const flag = (name) => args.includes(`--${name}`);
const range = (s) =>
  s.split(",").flatMap((p) => {
    const [a, b] = p.split("-").map(Number);
    return b ? Array.from({ length: b - a + 1 }, (_, k) => a + k) : [a];
  });
const BASE = opt("base", "http://127.0.0.1:4361");
const OUT = resolve(root, opt("out", "review/clean-integration"));
const LESSONS = range(opt("lessons", "1-9"));
const SIZES = opt("sizes", "2560x1440,1920x1080,1440x900,1024x768").split(",").filter(Boolean).map((s) => s.split("x").map(Number));
const THEMES = opt("themes", "light,dark").split(",");
const PHONE = range(opt("phone", "1,4,7"));
const JOBS = Number(opt("jobs", "4"));
const REDUCED = flag("reduced");
const SHOTS = opt("shots", "all"); // all | key | none
mkdirSync(OUT, { recursive: true });

const LESSON_IDS = {
  1: "meet-flexitac", 2: "the-sandwich", 3: "electrodes-slots-beam", 4: "one-crossing", 5: "voltage-divider",
  6: "volts-to-byte", 7: "drive-32-lines", 8: "listen-12-lines", 9: "one-frame",
};
// two parts to hover and click per figure (first choice, then fallbacks when one is not on screen in that pose)
// Fig 1 labels an FPC together with its gold fingers: a click on either shows two cards (the FPC's, then the fingers')
const PAIRED = { pad: ["fpc_t", "fpc_b", "fingers_t", "fingers_b"] };
const PARTS = {
  pad: ["velostat", "fpc_t", "fpc_b", "lam_t", "lam_b", "fingers_b"],
  crossing: ["r1", "velostat", "plunger", "mux", "display", "adc"],
  board: ["u2", "nano", "fpc1", "u4", "pcb", "r1"],
};

// ------------------------------------------------------------------ CDP
class CDP {
  static async open(url) {
    const c = new CDP();
    c.ws = new WebSocket(url);
    c.id = 0;
    c.pending = new Map();
    c.handlers = [];
    c.ws.addEventListener("message", (e) => {
      const m = JSON.parse(e.data);
      if (m.id && c.pending.has(m.id)) {
        c.pending.get(m.id)(m);
        c.pending.delete(m.id);
      } else if (m.method) for (const h of c.handlers) h(m);
    });
    await new Promise((r, f) => {
      c.ws.addEventListener("open", r);
      c.ws.addEventListener("error", f);
    });
    return c;
  }
  send(method, params = {}) {
    return new Promise((r) => {
      const i = ++this.id;
      this.pending.set(i, r);
      this.ws.send(JSON.stringify({ id: i, method, params }));
    });
  }
  on(fn) {
    this.handlers.push(fn);
  }
  close() {
    try {
      this.ws.close();
    } catch {}
  }
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ------------------------------------------------------------------ the in-figure probe (evaluated inside the iframe)
const PROBE = String.raw`(() => {
  if (window.__ir) return true;
  const fig = document.querySelector('.pd-stage') ? 'pad' : document.querySelector('.bd-stage') ? 'board' : 'crossing';
  const X = () => window.__padExplore || window.__ftExplore || null;
  const area = (e) => { const r = e.getBoundingClientRect(); return r.width * r.height; };
  const overlaySvg = (s) => s.closest('.ft-overlay, .ft-ov') || s.classList.contains('ft-leaders') || s.classList.contains('ft-marks');
  const mainSvg = () => [...document.querySelectorAll('svg[viewBox]')].filter((s) => !overlaySvg(s)).sort((a, b) => area(b) - area(a))[0];
  const vis = (e) => {
    if (!e || !e.isConnected) return false;
    if (e.closest('[hidden]')) return false;
    if (!e.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return false;
    const r = e.getBoundingClientRect();
    if (r.width <= 0 && r.height <= 0) return false;
    let o = 1;
    for (let n = e; n && n.nodeType === 1; n = n.parentElement) o *= +getComputedStyle(n).opacity;
    return o > 0.15;
  };
  const box = (r) => [r.left, r.top, r.width, r.height].map((v) => Math.round(v * 10) / 10);
  const UI = '.ft-viewbar, .ft-label, .ft-reveal, .ft-inspector, .ft-info, .iso-plate-corners, .ft-key, .ft-keys';
  const partAt = (x, y) => {
    const top = document.elementFromPoint(x, y);
    if (!top) return null;
    if (top.closest(UI)) return '#ui';
    const s = mainSvg();
    if (!s || !s.contains(top)) return null;
    try {
      // (Fig 1's plan view: the active area is the drag-to-touch handle, where a press touches and never picks)
      if (fig === 'pad') return X().onActive && X().onActive(x, y) ? '#ui' : X().hitAt(x, y).part || null;
      if (fig === 'crossing') return (X().hitAt ? X().hitAt(x, y) : X().partOfEl(top)) || null;
      const el = top.closest('[data-part]');
      return el ? el.dataset.part : null;
    } catch (e) { return null; }
  };
  window.__ir = {
    fig,
    cam() {
      const s = mainSvg();
      return { vb: s.getAttribute('viewBox'), box: box(s.getBoundingClientRect()), world: document.querySelector('.pd-world')?.getAttribute('transform') || '', view: document.querySelector('.pd-view')?.getAttribute('transform') || '' };
    },
    svgBox() { return box(mainSvg().getBoundingClientRect()); },
    // a grid scan: the most interior point of every part, and the emptiest drawing point
    scan(stepPx) {
      const s = mainSvg().getBoundingClientRect();
      const x0 = Math.max(2, s.left), y0 = Math.max(2, s.top), x1 = Math.min(innerWidth - 2, s.right), y1 = Math.min(innerHeight - 2, s.bottom);
      const st = stepPx || Math.max(4, Math.round(Math.min(x1 - x0, y1 - y0) / 110));
      const nx = Math.floor((x1 - x0) / st), ny = Math.floor((y1 - y0) / st);
      const g = [];
      for (let j = 0; j <= ny; j++) { const row = []; for (let i = 0; i <= nx; i++) row.push(partAt(x0 + i * st, y0 + j * st)); g.push(row); }
      const best = {}; const empty = { score: -1 };
      const R = 2;
      for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
        const p = g[j][i];
        if (p === '#ui') continue;
        let n = 0;
        const RR = p ? R : 4;
        for (let dj = -RR; dj <= RR; dj++) for (let di = -RR; di <= RR; di++) if (g[j + dj] && g[j + dj][i + di] === p) n++;
        const pt = [x0 + i * st, y0 + j * st];
        if (!p) { if (n > empty.score) Object.assign(empty, { score: n, pt }); continue; }
        const b = best[p] || (best[p] = { score: -1, count: 0, sx: 0, sy: 0, cands: [] });
        b.count++; b.sx += pt[0]; b.sy += pt[1];
        b.cands.push([n, pt]);
      }
      const out = {};
      for (const [p, b] of Object.entries(best)) {
        const cx = b.sx / b.count, cy = b.sy / b.count;
        b.cands.sort((a, c) => c[0] - a[0] || Math.hypot(a[1][0] - cx, a[1][1] - cy) - Math.hypot(c[1][0] - cx, c[1][1] - cy));
        out[p] = { pts: b.cands.slice(0, 4).map((c) => c[1]), score: b.cands[0][0], count: b.count };
      }
      return { parts: out, empty: empty.pt || null, step: st };
    },
    partAt,
    hovered() { const d = X() && X().debug ? X().debug() : {}; return d.hovered ?? d.hot ?? null; },
    labels() {
      return [...document.querySelectorAll('.ft-label')].filter(vis).map((l) => {
        const more = l.querySelector('.ft-more, .ft-label-more');
        return { box: box(l.getBoundingClientRect()), title: (l.querySelector('b')?.textContent || '').trim(), text: l.textContent.replace(/\s+/g, ' ').trim(), more: more && vis(more) ? box(more.getBoundingClientRect()) : null, moreTag: more ? more.tagName : null };
      });
    },
    leaders() {
      const lines = [...document.querySelectorAll('.ft-leader, .ft-lead-line')].filter(vis).map((e) => box(e.getBoundingClientRect()));
      const dots = [...document.querySelectorAll('.ft-leader-end, .ft-leader-dot, .ft-lead-end')].filter(vis).map((e) => { const r = e.getBoundingClientRect(); return [Math.round((r.left + r.width / 2) * 10) / 10, Math.round((r.top + r.height / 2) * 10) / 10]; });
      return { lines, dots };
    },
    clutter() {
      const sel = '.ft-hotspot, .ft-hotspots > *, .ft-dot, .ft-callout, .ft-callouts > *';
      return [...document.querySelectorAll(sel)].filter((e) => vis(e) && e.getBoundingClientRect().width >= 3).length;
    },
    reveal() {
      const b = document.querySelector('.ft-reveal');
      if (!b) return null;
      const anim = b.getAnimations({ subtree: true }).filter((a) => a.playState === 'running').length;
      return { vis: vis(b), tag: b.tagName, text: b.textContent.trim(), anim, box: box(b.getBoundingClientRect()) };
    },
    hint() { return (document.querySelector('[data-corner="hint"]')?.textContent || '').trim(); },
    cursorAt(x, y) { const e = document.elementFromPoint(x, y); return e ? getComputedStyle(e).cursor : null; },
    // tag the element under a point and report its box (to measure the hover float)
    tagAt(x, y) {
      for (const e of document.querySelectorAll('[data-ir]')) e.removeAttribute('data-ir');
      const e = document.elementFromPoint(x, y);
      if (!e) return null;
      e.setAttribute('data-ir', '1');
      return box(e.getBoundingClientRect());
    },
    tagged() { const e = document.querySelector('[data-ir]'); return e ? box(e.getBoundingClientRect()) : null; },
    btn(sel) { const b = document.querySelector(sel); return b && vis(b) ? box(b.getBoundingClientRect()) : null; },
    state() { const x = X(); return x && x.state ? x.state() : null; },
    focusRing() { const a = document.activeElement; return a ? (a.className || a.tagName) : null; },
  };
  return true;
})()`;

// ------------------------------------------------------------------ one run
async function runOne(browser, port, job) {
  const { n, w, h, theme, phone } = job;
  const lessonId = LESSON_IDS[n];
  const tag = `${w}x${h}-${theme}-L${String(n).padStart(2, "0")}`;
  const log = [];
  const problems = [];
  const notes = [];
  const say = (m) => log.push(m);
  const bad = (m) => {
    problems.push(m);
    log.push("  !! " + m);
  };
  const ctx = (await browser.send("Target.createBrowserContext")).result.browserContextId;
  const { targetId } = (await browser.send("Target.createTarget", { url: "about:blank", browserContextId: ctx })).result;
  const page = await CDP.open(`ws://127.0.0.1:${port}/devtools/page/${targetId}`);
  const errors = [];
  page.on((m) => {
    if (m.method === "Runtime.consoleAPICalled" && ["error", "warning", "assert"].includes(m.params.type)) errors.push(`${m.params.type}: ${m.params.args.map((a) => a.value ?? a.description).join(" ")}`);
    else if (m.method === "Runtime.exceptionThrown") errors.push(`exception: ${m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text}`);
    else if (m.method === "Log.entryAdded" && m.params.entry.level === "error") errors.push(`log: ${m.params.entry.text} ${m.params.entry.url ?? ""}`);
  });
  const ev = async (expr) => {
    const r = await page.send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.result?.exceptionDetails) return { __err: r.result.exceptionDetails.exception?.description ?? r.result.exceptionDetails.text };
    return r.result?.result?.value;
  };
  const J = async (expr) => {
    const v = await ev(`(()=>{const v=(${expr});return JSON.stringify(v===undefined?null:v)})()`);
    if (v && v.__err) return v;
    return typeof v === "string" ? JSON.parse(v) : v;
  };
  const F = `document.querySelector('.figure-frame')`;
  // evaluate inside the figure's window
  const fx = (code) => J(`(()=>{const w=${F}?.contentWindow;if(!w||!w.document)return null;w.eval(${JSON.stringify(PROBE)});return w.eval(${JSON.stringify("(" + code + ")")})})()`);
  const frameBox = () => J(`(()=>{const f=${F};if(!f)return null;const r=f.getBoundingClientRect();return [r.left+f.clientLeft,r.top+f.clientTop,r.width,r.height]})()`);
  let shotN = 0;
  const shot = async (name, key = false) => {
    if (SHOTS === "none" || (SHOTS === "key" && !key)) return;
    const r = await page.send("Page.captureScreenshot", { format: "png" });
    const f = `${tag}-${String(++shotN).padStart(2, "0")}-${name}.png`;
    writeFileSync(join(OUT, f), Buffer.from(r.result.data, "base64"));
  };
  const move = (x, y) => page.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y, pointerType: "mouse" });
  const click = async (x, y) => {
    if (phone) {
      await page.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
      await wait(50);
      await page.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      return;
    }
    await move(x, y);
    await wait(30);
    await page.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1, buttons: 1 });
    await wait(40);
    await page.send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1, buttons: 0 });
  };
  const key = async (k, code, vk) => {
    await page.send("Input.dispatchKeyEvent", { type: "keyDown", key: k, code, windowsVirtualKeyCode: vk });
    await page.send("Input.dispatchKeyEvent", { type: "keyUp", key: k, code, windowsVirtualKeyCode: vk });
  };
  const toPage = async (pt) => {
    const fb = await frameBox();
    return [fb[0] + pt[0], fb[1] + pt[1]];
  };
  const camEq = (a, b, tol = 0.6) => {
    if (!a || !b) return false;
    const nums = (s) => (String(s).match(/-?\d+(\.\d+)?(e-?\d+)?/g) || []).map(Number);
    const A = [...nums(a.vb), ...a.box, ...nums(a.world), ...nums(a.view)];
    const B = [...nums(b.vb), ...b.box, ...nums(b.world), ...nums(b.view)];
    return A.length === B.length && A.every((v, i) => Math.abs(v - B[i]) <= tol * Math.max(1, Math.abs(v) * 0.001));
  };
  const camStr = (c) => (c ? `${c.vb} | ${c.box.join(",")} | ${c.world} | ${c.view}` : "null");
  const ftlog = (since = 0) => J(`(window.__ftlog||[]).slice(${since})`);
  const ftlen = () => ev(`(window.__ftlog||[]).length`);
  const waitReady = async (ms = 15000) => {
    const t0 = Date.now();
    let s = null;
    while (Date.now() - t0 < ms) {
      s = await ev(`document.querySelector('.figure-slot')?.dataset.status ?? 'nofig'`);
      if (s === "ready") return s;
      await wait(150);
    }
    return s;
  };

  const result = { tag, lesson: n, w, h, theme, phone: !!phone, problems, notes, errors, log };
  try {
    await page.send("Runtime.enable");
    await page.send("Log.enable");
    await page.send("Page.enable");
    await page.send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: !!phone });
    if (phone) await page.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 2 });
    await page.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: theme }, { name: "prefers-reduced-motion", value: REDUCED ? "reduce" : "no-preference" }] });
    await page.send("Page.addScriptToEvaluateOnNewDocument", {
      source: `if(window.parent===window){window.__ftlog=[];addEventListener('message',e=>{const d=e.data;if(d&&typeof d.type==='string'&&d.type.startsWith('ft:'))__ftlog.push(JSON.parse(JSON.stringify(d)))});}`,
    });
    await page.send("Page.navigate", { url: `${BASE}/#/lesson/${lessonId}` });
    const t0 = Date.now();
    const status = await waitReady();
    say(`[${tag}] ${lessonId} status=${status} in ${Date.now() - t0} ms`);
    if (status !== "ready") {
      bad(`figure status ${status}`);
      return result;
    }
    await wait(2600); // fonts, the first fit, the hint fading in, initial acts settling
    // Lesson 1 opens on step 1, "Feel it" (FEEL mode: the plan view, the touch map; scripts/feel-review.mjs checks it).
    // The explore checks below are about step 2's pose, the closed pad behind its "Click to expand" hint: go there first.
    if (n === 1) {
      await ev(`document.querySelector('.step-dot[data-k="1"]').scrollIntoView({block:'center'})`);
      const dot = await J(`(()=>{const r=document.querySelector('.step-dot[data-k="1"]').getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2]})()`);
      await click(dot[0], dot[1]);
      await wait(3200); // feel off, the turn back to the isometric view (critically damped), the hint fading in
      if (phone) await ev(`scrollTo(0, 0)`);
    }
    const fig = await fx(`__ir.fig`);
    result.fig = fig;
    const parts = await J(`((window.__ftlog||[]).find(m=>m.type==='ft:parts')||{}).parts||[]`);
    const titleOf = Object.fromEntries(parts.map((p) => [p.id, p.title]));

    // ---------------------------------------------------------- 1. clean start
    const site = await J(`({labels:!!document.querySelector('.labels-toggle, [data-labels]'),inspector:!!document.querySelector('.inspector, .stage-inspector'),details:document.querySelector('.details')?(document.querySelector('.details').hidden?'hidden':'OPEN'):'none',sw:document.documentElement.scrollWidth,vw:innerWidth,src:${F}.getAttribute('src')})`);
    const labels0 = await fx(`__ir.labels()`);
    const leads0 = await fx(`__ir.leaders()`);
    const clutter0 = await fx(`__ir.clutter()`);
    const hint0 = await fx(`__ir.reveal()`);
    say(`  rest: labels=${labels0.length} leaders=${leads0.lines.length} dots=${leads0.dots.length} clutter=${clutter0} reveal=${JSON.stringify(hint0)} site=${JSON.stringify(site)}`);
    if (site.labels) bad("site: a Labels switch is on the page");
    if (site.inspector) bad("site: the old stage inspector is on the page");
    if (site.details === "OPEN") bad("site: detail window open at rest");
    if (site.sw > site.vw + 1) bad(`horizontal page scroll ${site.sw} > ${site.vw}`);
    if (labels0.length) bad(`clean start: ${labels0.length} label(s) visible at rest (${labels0.map((l) => l.title).join(", ")})`);
    if (leads0.lines.length || leads0.dots.length) bad(`clean start: leader/dot visible at rest`);
    if (clutter0) bad(`clean start: ${clutter0} hotspot dot(s) / callout card(s) visible`);
    if (n === 1) {
      if (!hint0 || !hint0.vis) bad("lesson 1: no visible reveal hint");
      else {
        if (hint0.tag !== "BUTTON") bad(`lesson 1: hint is a ${hint0.tag}, not a button`);
        if (!/(Click|Tap) to expand/i.test(hint0.text)) bad(`lesson 1: hint text "${hint0.text}"`);
        if (!REDUCED && hint0.anim < 1) bad("lesson 1: hint not animated");
        if (REDUCED && hint0.anim > 0) bad(`lesson 1: hint animates under reduced motion (${hint0.anim})`);
      }
    } else if (hint0 && hint0.vis) bad(`lesson ${n}: a reveal hint is visible`);
    if (phone) {
      await ev(`document.querySelector('.figure-slot').scrollIntoView({block:'start'})`);
      await wait(400);
    }
    await shot("initial", true);
    let home = await fx(`__ir.cam()`);
    const frame0 = await frameBox();

    // ---------------------------------------------------------- 2. lesson 1: expand in place
    if (n === 1) {
      const sc = await fx(`__ir.scan()`);
      const target = ["lam_t", "velostat", "fpc_t", "lam_b", "fpc_b"].map((p) => sc.parts[p]).find(Boolean);
      if (!target) bad("lesson 1: no point on the closed pad found");
      else {
        const pt = await toPage(target.pts[0]);
        if (!phone) {
          await move(pt[0], pt[1]);
          await wait(450);
          const hov = await fx(`({h:__ir.hovered(),cur:__ir.cursorAt(${target.pts[0][0]},${target.pts[0][1]}),hint:__ir.hint(),st:__ir.state()})`);
          say(`  closed-pad hover: ${JSON.stringify(hov)}`);
          if (hov.cur !== "pointer") bad(`lesson 1: closed pad hover cursor ${hov.cur}`);
          await shot("closed-hover");
        }
        const before = await ftlen();
        await click(pt[0], pt[1]);
        await wait(1900);
        const after = await fx(`({st:__ir.state(),cam:__ir.cam(),labels:__ir.labels(),hint:__ir.reveal()})`);
        const picks = (await ftlog(before)).filter((m) => m.type === "ft:pick");
        say(`  expand: ${JSON.stringify(after.st)} hint=${JSON.stringify(after.hint)} picks=${picks.length}`);
        if (!after.st?.revealOpen || !after.st?.apart) bad("lesson 1: click on the pad did not expand it");
        if (after.labels.length) bad("lesson 1: a label appeared on expand");
        if (picks.length) bad("lesson 1: expand posted ft:pick");
        if (after.hint?.vis) bad("lesson 1: hint still visible after expand");
        if (!camEq(home, after.cam)) bad(`lesson 1: camera changed on expand: ${camStr(home)} -> ${camStr(after.cam)}`);
        const fb = await frameBox();
        if (JSON.stringify(fb) !== JSON.stringify(frame0)) bad(`lesson 1: frame moved on expand ${frame0} -> ${fb}`);
        await shot("expanded", true);
      }
    }

    // ---------------------------------------------------------- 3 + 4. hover and click two parts
    if (!phone) await move(4, 4);
    await wait(350);
    const sc = await fx(`__ir.scan()`);
    const want = PARTS[fig].filter((p) => sc.parts[p] && sc.parts[p].score >= 6);
    const others = Object.entries(sc.parts).sort((a, b) => b[1].count - a[1].count).map(([p]) => p);
    const chosen = [...new Set([...want, ...others])].slice(0, 2);
    say(`  on screen: ${Object.keys(sc.parts).join(",")}; testing ${chosen.join(", ")}`);
    const st0 = await fx(`__ir.state()`);
    const planView = fig === "pad" && st0 && st0.plan > 0;
    let lastLabel = null;
    for (const [k, pid] of chosen.entries()) {
      const pts = sc.parts[pid].pts;
      let used = null;
      if (!phone) {
        // hover (real mouse), trying the candidate points until the figure reports this part
        for (const p of pts) {
          await move(4, 4);
          await wait(320);
          const before = await fx(`__ir.tagAt(${p[0]},${p[1]})`);
          const pt = await toPage(p);
          await move(pt[0], pt[1]);
          await wait(420);
          const hv = await fx(`({h:__ir.hovered(),tag:__ir.tagged(),cur:__ir.cursorAt(${p[0]},${p[1]}),hint:__ir.hint(),cam:__ir.cam()})`);
          if (hv.h !== pid) continue;
          used = p;
          const rise = before && hv.tag ? +(before[1] - hv.tag[1]).toFixed(2) : null;
          say(`  hover ${pid}: rise=${rise} cursor=${hv.cur} hint="${hv.hint}"`);
          notes.push({ hover: pid, rise, cursor: hv.cur });
          // (Fig 2's plunger knob is a press-and-hold handle: its cursor says so)
          if (hv.cur !== "pointer" && !(fig === "crossing" && pid === "plunger" && hv.cur === "ns-resize")) bad(`hover ${pid}: cursor ${hv.cur}`);
          if (titleOf[pid] && !hv.hint.toLowerCase().includes(titleOf[pid].toLowerCase().split(" · ")[0].slice(0, 10))) bad(`hover ${pid}: hint corner "${hv.hint}" lacks the title "${titleOf[pid]}"`);
          const expectRise = !REDUCED && !planView && !(fig === "crossing" && pid === "press");
          if (expectRise && (rise === null || rise < 2.5 || rise > 5.5)) bad(`hover ${pid}: rise ${rise} px (want ~4)`);
          if (!expectRise && rise && Math.abs(rise) > 0.5) bad(`hover ${pid}: rose ${rise} px where it should not`);
          if (!camEq(home, hv.cam)) bad(`hover ${pid}: camera changed ${camStr(home)} -> ${camStr(hv.cam)}`);
          if (k === 0) await shot(`hover-${pid}`, true);
          break;
        }
        if (!used) {
          bad(`hover ${pid}: the figure never reported it hovered at ${JSON.stringify(pts)}`);
          used = pts[0];
        }
      } else used = pts[0];
      // click -> one label
      const before = await ftlen();
      const pt = await toPage(used);
      await click(pt[0], pt[1]);
      await wait(700);
      if (!phone) {
        await move(pt[0], pt[1] + 0.01);
      }
      const after = await fx(`({labels:__ir.labels(),lead:__ir.leaders(),cam:__ir.cam(),svg:__ir.svgBox()})`);
      const picks = (await ftlog(before)).filter((m) => m.type === "ft:pick");
      const lastPick = picks.at(-1);
      say(`  click ${pid}: labels=${JSON.stringify(after.labels.map((l) => [l.title, l.box]))} lead=${JSON.stringify(after.lead)} pick=${lastPick?.part?.id ?? lastPick?.part}`);
      if (lastPick?.part?.id !== pid) bad(`click ${pid}: ft:pick ${JSON.stringify(lastPick?.part?.id ?? null)}`);
      // (a phone frame may have no room for the second card: then the FPC's card shows alone)
      const wantLabels = (PAIRED[fig] || []).includes(pid) ? 2 : 1;
      if (after.labels.length !== wantLabels && !(phone && wantLabels === 2 && after.labels.length === 1)) bad(`click ${pid}: ${after.labels.length} labels visible (want ${wantLabels})`);
      if (after.lead.lines.length !== after.labels.length) bad(`click ${pid}: ${after.lead.lines.length} leader lines for ${after.labels.length} labels`);
      for (const [li, L] of after.labels.entries()) {
        if (titleOf[pid] && L.title.toLowerCase() !== titleOf[pid].toLowerCase()) notes.push({ labelTitle: L.title, partTitle: titleOf[pid] });
        if (!L.more) bad(`click ${pid}: no visible Details button`);
        else if (L.moreTag !== "BUTTON") bad(`click ${pid}: Details is a ${L.moreTag}`);
        const ln = after.lead.lines[li];
        if (ln) {
          const [lx, ly, lw, lh] = ln;
          if (lh > 0.75) bad(`click ${pid}: leader not horizontal (bbox h ${lh})`);
          const [cx, cy, cw, ch] = L.box;
          const touchesL = Math.abs(lx + lw - cx) <= 3 || Math.abs(lx - cx) <= 3;
          const touchesR = Math.abs(lx - (cx + cw)) <= 3 || Math.abs(lx + lw - (cx + cw)) <= 3;
          if (!touchesL && !touchesR) bad(`click ${pid}: leader ${ln} does not start at the card's edge ${L.box}`);
          if (ly < cy - 0.5 || ly > cy + ch + 0.5) bad(`click ${pid}: leader y ${ly} outside the card ${cy}..${cy + ch}`);
          const dot = after.lead.dots[li];
          if (!dot) bad(`click ${pid}: no leader dot`);
          else {
            const far = touchesL && !touchesR ? (Math.abs(lx + lw - cx) <= 3 ? lx : lx + lw) : Math.abs(lx - (cx + cw)) <= 3 ? lx + lw : lx;
            if (Math.abs(dot[0] - far) > 3 || Math.abs(dot[1] - ly) > 1.5) bad(`click ${pid}: dot ${dot} not at the leader's end (${far}, ${ly})`);
          }
          const sv = after.svg;
          if (cx < sv[0] - 1 || cy < sv[1] - 1 || cx + cw > sv[0] + sv[2] + 1 || cy + ch > sv[1] + sv[3] + 1) bad(`click ${pid}: card ${L.box} outside the drawing ${sv}`);
        }
        if (li === 0) lastLabel = { pid, L };
      }
      if (!camEq(home, after.cam)) bad(`click ${pid}: camera changed ${camStr(home)} -> ${camStr(after.cam)}`);
      const fb = await frameBox();
      if (JSON.stringify(fb) !== JSON.stringify(frame0)) bad(`click ${pid}: frame moved ${frame0} -> ${fb}`);
      await shot(`label-${pid}`, true);
    }

    // ---------------------------------------------------------- 5. Details -> the site's window
    if (lastLabel?.L?.more) {
      const panelBox = async () => J(`(()=>{const q=(s)=>{const e=document.querySelector(s);if(!e)return null;const r=e.getBoundingClientRect();return [r.left,r.top,r.width,r.height].map(v=>Math.round(v*10)/10)};return {panel:q('.panel'),info:q('.info-card'),code:q('.code-card'),stage:q('.stage'),frame:q('.figure-frame')}})()`);
      const pb0 = await panelBox();
      const cam0 = await fx(`__ir.cam()`);
      const m = lastLabel.L.more;
      const pt = await toPage([m[0] + m[2] / 2, m[1] + m[3] / 2]);
      const before = await ftlen();
      await click(pt[0], pt[1]);
      await wait(750);
      const dets = (await ftlog(before)).filter((x) => x.type === "ft:details");
      const det = await J(`(()=>{const d=document.querySelector('.details');if(!d||d.hidden)return null;const r=d.getBoundingClientRect();const s=getComputedStyle(d);return {box:[r.left,r.top,r.width,r.height].map(v=>Math.round(v*10)/10),position:s.position,opacity:+s.opacity,title:d.querySelector('.det-title')?.textContent,intro:(d.querySelector('.det-intro')?.textContent||'').length,facts:d.querySelectorAll('.det-fact').length,chips:d.querySelectorAll('.chip').length,lesson:d.querySelector('.det-lesson')?.textContent.trim().replace(/\\s+/g,' ')??null,focusIn:d.contains(document.activeElement),vh:innerHeight,vw:innerWidth,bar:(()=>{const b=document.querySelector('.sidebar');if(!b)return null;const q=b.getBoundingClientRect();return [q.left,q.top,q.width,q.height]})()}})()`);
      say(`  details: msgs=${dets.length} window=${JSON.stringify(det)}`);
      if (!dets.length) bad("Details: no ft:details posted");
      else {
        const p = dets[0].part;
        for (const f of ["id", "title", "icon", "short", "intro", "facts"]) if (p[f] === undefined) bad(`Details: ft:details part lacks ${f}`);
      }
      if (!det) bad("Details: the detail window did not open");
      else {
        if (!det.focusIn) bad("Details: focus did not move into the window");
        if (!det.intro) bad("Details: no intro text");
        if (det.lesson && /Lesson (\d+)/.exec(det.lesson)?.[1] === String(n)) bad(`Details: "Taught in" points at the current lesson`);
        if (det.position === "absolute") {
          const [l, t, ww, hh] = det.box;
          const [pl, pt2, pw, ph] = pb0.panel;
          if (Math.abs(l - pl) > 1 || Math.abs(l + ww - (pl + pw)) > 1) bad(`Details: window edges ${l}..${l + ww} vs panel ${pl}..${pl + pw}`);
          if (Math.abs(t - pt2) > 1) bad(`Details: window top ${t} vs panel ${pt2}`);
          if (hh > ph + 1) bad(`Details: window taller than the panel ${hh} > ${ph}`);
        } else {
          const [l, t, ww, hh] = det.box;
          if (l < 0 || l + ww > det.vw + 0.5 || t < 0 || t + hh > det.vh + 0.5) bad(`Details: sheet off-screen ${det.box}`);
          if (phone && det.bar && t + hh > det.bar[1] + 0.5) bad(`Details: sheet under the bottom bar ${t + hh} > ${det.bar[1]}`);
        }
      }
      const pb1 = await panelBox();
      for (const k of ["panel", "info", "code", "stage", "frame"]) if (JSON.stringify(pb0[k]) !== JSON.stringify(pb1[k])) bad(`Details: ${k} moved ${pb0[k]} -> ${pb1[k]}`);
      const cam1 = await fx(`__ir.cam()`);
      if (!camEq(cam0, cam1)) bad(`Details: camera changed ${camStr(cam0)} -> ${camStr(cam1)}`);
      await shot("details", true);
      if (det) {
        await key("Escape", "Escape", 27);
        await wait(450);
        const a = await J(`({open:!document.querySelector('.details')?.hidden&&document.querySelector('.details')?.classList.contains('is-on'),focus:document.activeElement===${F}})`);
        if (a.open) bad("Details: Escape did not close the window");
        if (!a.focus) bad("Details: focus did not return to the figure after Escape");
        const lab = await fx(`__ir.labels().length`);
        if (lab !== 1) notes.push({ afterEscapeLabels: lab });
        // Details again, then ×
        const L2 = await fx(`__ir.labels()`);
        if (L2[0]?.more) {
          const m2 = L2[0].more;
          const p2 = await toPage([m2[0] + m2[2] / 2, m2[1] + m2[3] / 2]);
          await click(p2[0], p2[1]);
          await wait(650);
          const xb = await J(`(()=>{const b=document.querySelector('.details:not([hidden]) .det-close');if(!b)return null;const r=b.getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2]})()`);
          if (!xb) bad("Details: did not reopen");
          else {
            await click(xb[0], xb[1]);
            await wait(450);
            const b = await J(`({open:!document.querySelector('.details')?.hidden&&document.querySelector('.details')?.classList.contains('is-on'),focus:document.activeElement===${F}})`);
            if (b.open) bad("Details: × did not close the window");
            if (!b.focus) bad("Details: focus did not return to the figure after ×");
          }
        }
      }
    } else bad("no label with Details to test");

    // ---------------------------------------------------------- 6. empty click removes the label
    // (scanned again now: the label sits over the drawing and must not be the "empty" point)
    const scE = await fx(`__ir.scan()`);
    if (scE.empty) {
      const before = await ftlen();
      const pt = await toPage(scE.empty);
      await click(pt[0], pt[1]);
      await wait(600);
      const labs = await fx(`__ir.labels().length`);
      const picks = (await ftlog(before)).filter((m) => m.type === "ft:pick");
      say(`  empty click at ${scE.empty}: labels=${labs} picks=${JSON.stringify(picks.map((p) => p.part?.id ?? null))}`);
      if (labs) bad(`empty click: ${labs} label(s) remain`);
      const cam = await fx(`__ir.cam()`);
      if (!camEq(home, cam)) bad(`empty click: camera changed`);
    } else notes.push({ empty: "no empty point found" });

    // ---------------------------------------------------------- 7. zoom in, fit
    if (!phone) {
      const zin = await fx(`__ir.btn('.ft-viewbar [data-tool="in"], .ft-viewbar [data-v="in"], .ft-viewbar [data-view="in"]')`);
      const zfit = `__ir.btn('.ft-viewbar [data-tool="reset"], .ft-viewbar [data-v="reset"], .ft-viewbar [data-view="reset"]')`;
      if (!zin) bad("view bar: no zoom-in button");
      else {
        const p = await toPage([zin[0] + zin[2] / 2, zin[1] + zin[3] / 2]);
        await click(p[0], p[1]);
        await wait(800);
        const camZ = await fx(`__ir.cam()`);
        if (camEq(home, camZ)) bad("view bar: zoom in did not move the camera");
        const f = await fx(zfit);
        if (!f) bad("view bar: no fit button (or hidden)");
        else {
          const q = await toPage([f[0] + f[2] / 2, f[1] + f[3] / 2]);
          await click(q[0], q[1]);
          await wait(1000);
          const camR = await fx(`__ir.cam()`);
          if (!camEq(home, camR)) bad(`view bar: fit did not return home ${camStr(home)} -> ${camStr(camR)}`);
        }
      }
      await move(4, 4);
    }

    // ---------------------------------------------------------- 8. theme switch keeps the state
    if (!phone && chosen[0]) {
      // label a part again (real click), then toggle the site theme
      const sc2 = await fx(`__ir.scan()`);
      const pid = chosen.find((p) => sc2.parts[p]) ?? Object.keys(sc2.parts)[0];
      const pt = await toPage(sc2.parts[pid].pts[0]);
      await click(pt[0], pt[1]);
      await wait(700);
      const pre = await fx(`({st:__ir.state(),labels:__ir.labels().map(l=>l.title)})`);
      const srcA = await ev(`${F}.getAttribute('src')`);
      await ev(`document.querySelector('[data-theme-toggle]').click()`);
      await wait(400);
      const st = await waitReady();
      await wait(2600);
      const srcB = await ev(`${F}.getAttribute('src')`);
      const post = await fx(`({st:__ir.state(),labels:__ir.labels().map(l=>l.title),cam:__ir.cam()})`);
      say(`  theme: ${srcA} -> ${srcB} status=${st} pre=${JSON.stringify(pre)} post=${JSON.stringify({ st: post?.st, labels: post?.labels })}`);
      if (srcA === srcB) bad("theme: the figure did not switch builds");
      if (!post) bad("theme: no figure after the switch");
      else {
        if (JSON.stringify(pre.labels) !== JSON.stringify(post.labels)) bad(`theme: labels ${JSON.stringify(pre.labels)} -> ${JSON.stringify(post.labels)}`);
        if ((pre.st?.picked ?? null) !== (post.st?.picked ?? null)) bad(`theme: picked ${pre.st?.picked} -> ${post.st?.picked}`);
        if (fig === "pad" && pre.st && post.st && (pre.st.revealOpen !== post.st.revealOpen || pre.st.apart !== post.st.apart || pre.st.plan !== post.st.plan)) bad(`theme: pad pose ${JSON.stringify(pre.st)} -> ${JSON.stringify(post.st)}`);
      }
      await shot("theme-switched", true);
      home = post?.cam ?? home;
    }

    // ---------------------------------------------------------- 9. guided steps
    const nSteps = await ev(`document.querySelectorAll('.step-dot').length`);
    if (nSteps) {
      const before = await ftlen();
      const e0 = errors.length;
      for (let s = 0; s < nSteps; s++) {
        // "Show me" plays the step; "Next step" moves on and plays the next one
        await ev(`document.querySelector('.steps [data-go]').click()`);
        await wait(s === 0 ? 2200 : 2200);
        const info = await fx(`({st:__ir.state(),labels:__ir.labels().map(l=>l.title),hint:__ir.reveal()})`);
        const txt = await ev(`document.querySelector('.steps-kicker')?.textContent`);
        say(`  step ${s + 1}/${nSteps} "${txt}": ${JSON.stringify(info)}`);
        await shot(`step${s + 1}`, s === nSteps - 1);
      }
      const msgs = (await ftlog(before)).filter((m) => m.type === "ft:error");
      if (msgs.length) bad(`steps: ft:error ${JSON.stringify(msgs)}`);
      const warn = errors.slice(e0).filter((e) => /has no action|failed/.test(e));
      if (warn.length) bad(`steps: ${warn.join(" | ")}`);
    }

    // ---------------------------------------------------------- 10. page-level
    const hs = await J(`({sw:document.documentElement.scrollWidth,w:innerWidth})`);
    if (hs.sw > hs.w + 1) bad(`horizontal page scroll at end ${hs.sw} > ${hs.w}`);
    const allErr = (await ftlog(0)).filter((m) => m.type === "ft:error");
    if (allErr.length) bad(`ft:error during the run: ${JSON.stringify(allErr.map((m) => [m.name, m.message]))}`);
  } catch (err) {
    bad(`script error: ${err.stack || err}`);
  } finally {
    const real = errors.filter((e) => !/favicon/.test(e));
    if (real.length) for (const e of real) bad(`console ${e}`);
    page.close();
    await browser.send("Target.disposeBrowserContext", { browserContextId: ctx });
  }
  return result;
}

// ------------------------------------------------------------------ queue + workers
const jobs = [];
if (!flag("only-phone"))
  for (const n of LESSONS) for (const [w, h] of SIZES) for (const theme of THEMES) jobs.push({ n, w, h, theme });
for (const n of PHONE) for (const theme of THEMES) jobs.push({ n, w: 390, h: 844, theme, phone: true });
const results = [];
async function worker(k) {
  const profile = mkdtempSync(join(tmpdir(), `lf-ir-${k}-`));
  const chrome = spawn(process.env.CHROME_PATH ?? "/usr/bin/google-chrome", ["--headless=new", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "--no-first-run", "--hide-scrollbars", "--disable-gpu", "--enable-unsafe-swiftshader", "about:blank"], { stdio: ["ignore", "ignore", "pipe"] });
  const port = await chromePort(chrome, profile);
  const ver = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
  const browser = await CDP.open(ver.webSocketDebuggerUrl);
  while (jobs.length) {
    const job = jobs.shift();
    const r = await runOne(browser, port, job);
    results.push(r);
    console.log(r.log.join("\n"));
    console.log(`  RESULT ${r.tag} ${r.problems.length ? "PROBLEMS " + r.problems.length : "OK"}`);
  }
  browser.close();
  chrome.kill("SIGKILL");
  await wait(300);
  rmSync(profile, { recursive: true, force: true });
}
const t0 = Date.now();
await Promise.all(Array.from({ length: Math.max(1, JOBS) }, (_, k) => worker(k)));
results.sort((a, b) => a.tag.localeCompare(b.tag));
writeFileSync(join(OUT, "summary.json"), JSON.stringify(results.map(({ log, ...r }) => r), null, 1));
const badRuns = results.filter((r) => r.problems.length);
console.log(`\n${results.length} runs in ${((Date.now() - t0) / 1000).toFixed(0)} s, ${badRuns.length} with problems`);
for (const r of badRuns) console.log(`  ${r.tag}: ${r.problems.join(" || ")}`);
process.exit(0);
