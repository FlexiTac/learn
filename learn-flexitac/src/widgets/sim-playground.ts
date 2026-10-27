// Playground: the card for Lesson 3.4 ("In simulation"; it was 3.6). Everything from 3.2-3.3 in one place, to try freely:
//   (a) the fin finger's front half with its pad (the shared art from sim-points.ts, cropped at the base: the finger
//       runs off the drawing's left edge and fades), an object pressing in and out on a loop (ball, tube, a bar on its
//       edge, a strawberry; the first three see-through so the points under them stay in view). The pad's points take
//       the sim frame's colours (viridis, as the maps).
//   (b) two 12 x 32 frames side by side, both made by the same rule (touchsim Readout, the FlexiTac normalisation:
//       subtract a threshold, clip, divide by the frame's top value, or by a fixed 60 when that top value is under
//       the threshold): "Simulated" (force x 125 counts per newton, clean) and "Real-style" (the same force turned into
//       bytes first: a resting byte per point (12-24), noise, rounding; the baseline is the median of the first 30
//       frames, as the real viewer does). Under each: how many points lit, the top value and which divisor was used.
//   (c) sliders: press depth (0-2 mm) and press time (how long the press in takes), k_n (spring), k_d (damper), noise
//       (counts, real-style only) and the threshold (counts, both). Reset puts them back. Drag on the drawing, or click
//       a map square, to move where the object presses.
// The engine runs at a fixed 100 steps a second (a real pad's 100 frames), so the damper and the noise do not depend
// on the screen's frame rate; seek(t) replays it from 0 for reviews (deterministic, the real-style noise included).
// Reduced motion: no loop; the object holds its press (the frames after 40 steps, recomputed on every change).
// The loop stops while the tab is hidden or the card is off screen.
// Forms from the drawing's width W: large (W >= 470: sliders in three columns, full labels), medium (two columns,
// short labels, icon buttons), mini (W < 300: two columns). Under a height budget (data-max-h) the drawing shrinks;
// the host's compact form drops the closing sentence. A short, wide window with no height given (a phone on its side,
// sim-points.ts sideForm) takes the side form: the drawing beside the maps, the controls under the drawing, the knobs
// under both, no taller than the window. Each slider is named by its long name (aria-labelledby) and its value with
// its unit (aria-valuetext).
// ILLUSTRATIVE: touchsim's chosen constants (k_n 0.6 N/mm, k_d 0.012 N·s/mm, 125 counts/N; the viewer's threshold 15
// and noise scale 60 are the real ones), not measurements.
import { DEFAULTS, PRESETS, READOUT, TAXELS, createReadout, createTouch, type Readout, type Shape } from "@shared/models/touchsim.mjs";
import { fill, strings } from "../i18n";
import { paintText } from "../i18n/paint";
import type { WidgetCtx, WidgetInstance } from "../types";
import { h } from "../ui/dom";
import {
  FIN,
  FinView,
  OBJ_NAMES,
  OBJ_TOP,
  ObjView,
  PadMap,
  clamp01,
  cssVar,
  f1,
  finPad,
  finPoint,
  makeCam,
  makeShape,
  parseColor,
  placeObject,
  range,
  sideForm,
  svgEl,
  viridisCss,
  viridisLut,
  wave,
  type ObjKind,
  type RGB,
} from "./sim-points";
import "./sim-playground.css";

// the card's words (docs/i18n.md): painted from STR() and again on a language switch
const STR = strings(
  {
    illTip: "A simplified in-browser model with chosen constants, not a measurement. The threshold (15) and the noise scale (60) are the real viewer's.",
    name_depth: "Press depth",
    short_depth: "Depth",
    name_time: "Press time",
    short_time: "Time",
    name_kn: "Spring k<sub>n</sub>",
    short_kn: "k<sub>n</sub>",
    name_kd: "Damper k<sub>d</sub>",
    short_kd: "k<sub>d</sub>",
    name_noise: "Noise",
    short_noise: "Noise",
    name_threshold: "Threshold",
    short_threshold: "Thresh.",
    name: "Playground",
    ill: "Illustrative",
    animAria: "The finger's pad with an object pressing on it in a loop. Drag to move where it presses; arrow keys move it one point.",
    sim: "Simulated",
    simHow: "force × 125",
    real: "Real-style",
    realHow: "bytes + noise − baseline",
    rule: "Both: <b>− threshold</b>, clip, <b>÷ the top value</b>, or <b>÷ 60</b> when the top is under the threshold",
    object: "Object",
    pause: "Pause",
    play: "Play",
    pauseAria: "Pause the press loop",
    playAria: "Play the press loop",
    resetAria: "Reset the sliders",
    reset: "Reset",
    line: "Turn the knobs and watch the two frames: the spring and the threshold decide how many points light; the top point always reads 1; noise only shows up in the real-style frame.",
    quiet: "top {top} &lt; {thr} → <b>÷ 60</b>",
    loud: "top {top} → <b>÷ {top}</b>",
    stat: '<span class="sg-nw"><b>{lit}</b> lit</span><span class="sg-dot"> · </span><span class="sg-nw">{div}</span>',
    total: "<b>{n} N</b> total · press {mm} mm",
    unit_counts: "counts",
  },
  {
    illTip: "在浏览器里运行的简化模型，常数是选定的，不是测量结果。阈值（15）和噪声缩放值（60）取自真实的查看器。",
    name_depth: "按压深度",
    short_depth: "深度",
    name_time: "按压时间",
    short_time: "时间",
    name_kn: "弹簧 k<sub>n</sub>",
    name_kd: "阻尼器 k<sub>d</sub>",
    name_noise: "噪声",
    short_noise: "噪声",
    name_threshold: "阈值",
    short_threshold: "阈值",
    name: "实验场",
    ill: "示意",
    animAria: "手指上的传感垫，一个物体反复压在上面。拖动来改变按压的位置；方向键一次移动一个点。",
    sim: "仿真",
    simHow: "力 × 125",
    real: "类真实",
    realHow: "字节 + 噪声 − 基线",
    rule: "两者都是：<b>− 阈值</b>，截断，<b>÷ 最大值</b>；最大值低于阈值时 <b>÷ 60</b>",
    object: "物体",
    pause: "暂停",
    play: "播放",
    pauseAria: "暂停按压循环",
    playAria: "播放按压循环",
    resetAria: "重置滑块",
    reset: "重置",
    line: "调一调旋钮，看两帧的变化：弹簧和阈值决定有多少个点亮起；最大的那个点读数总是 1；噪声只出现在类真实的那一帧里。",
    quiet: "最大 {top} &lt; {thr} → <b>÷ 60</b>",
    loud: "最大 {top} → <b>÷ {top}</b>",
    stat: '<span class="sg-nw"><b>{lit}</b> 个亮起</span><span class="sg-dot"> · </span><span class="sg-nw">{div}</span>',
    total: "总计 <b>{n} N</b> · 按压 {mm} mm",
    unit_counts: "计数",
  },
);
const HZ = 100;
const DT = 1 / HZ;
const HOLD = 0.8;
const REST = 0.7;
const LIFT = 2;
/** how far the drawing reaches toward the finger's base (finger mm); the rest fades out at the left edge */
const CROP_X = 34;

type Params = { depth: number; time: number; kn: number; kd: number; noise: number; threshold: number };
const DEFAULT_P: Params = { depth: PRESETS.firmDepth, time: 0.6, kn: DEFAULTS.kn, kd: DEFAULTS.kd, noise: READOUT.noise, threshold: READOUT.threshold };
// (each slider's name and short name: name_<key> / short_<key> in STR)
type SliderDef = { key: keyof Params; unit: string; min: number; max: number; step: number; dec: number };
const SLIDERS: SliderDef[] = [
  { key: "depth", unit: "mm", min: 0, max: 2, step: 0.05, dec: 2 },
  { key: "time", unit: "s", min: 0.05, max: 1.5, step: 0.05, dec: 2 },
  { key: "kn", unit: "N/mm", min: 0.1, max: 2, step: 0.05, dec: 2 },
  { key: "kd", unit: "N·s/mm", min: 0, max: 0.06, step: 0.002, dec: 3 },
  { key: "noise", unit: "counts", min: 0, max: 8, step: 0.5, dec: 1 },
  { key: "threshold", unit: "counts", min: 0, max: 40, step: 1, dec: 0 },
];
const KINDS: ObjKind[] = ["ball", "tube", "box", "berry"];
/** see-through objects (the points under them stay in view); the strawberry stays a strawberry */
const GLASS: Record<ObjKind, boolean> = { ball: true, tube: true, box: true, berry: false };

export interface SimPlaygroundState {
  object: ObjKind;
  params: Params;
  a: number;
  b: number;
  /** loop time (s), the press now (mm), total force (N) */
  t: number;
  press: number;
  total: number;
  sim: { lit: number; max: number; quiet: boolean };
  real: { lit: number; max: number; quiet: boolean };
  playing: boolean;
}
export interface SimPlaygroundInstance extends WidgetInstance {
  play(): void;
  pause(): void;
  /** Change the object, the spot (pad mm) and any parameter (as the controls do). */
  set(v: Partial<Params> & { object?: ObjKind; a?: number; b?: number }): void;
  /** Pause and replay the engine from 0 to t seconds of the loop (deterministic). */
  seek(t: number): void;
  state(): SimPlaygroundState;
}

const ICON_PLAY = `<svg class="sp-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z"/></svg>`;
const ICON_PAUSE = `<svg class="sp-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M7.5 5.5h3v13h-3zM13.5 5.5h3v13h-3z"/></svg>`;
const ICON_RESET = `<svg class="sp-ico sp-ico-line" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12a7 7 0 1 0 2.2-5.1M5 4.5v3.4h3.4"/></svg>`;

let seq = 0;

export function mount(el: HTMLElement, ctx: WidgetCtx): SimPlaygroundInstance {
  const reduced = ctx.reducedMotion();
  const uid = `sg${++seq}`;
  const root = h("div", { class: "sim sg" });
  const ramp = Array.from({ length: 9 }, (_, q) => viridisCss(q / 8)).join(", ");
  const T = STR();
  const sliders = SLIDERS.map(
    (s) =>
      // (the input comes before the value's <output> in the label, so the label labels the slider, not the output; and
      // the slider is named by the long name, read even while the short one shows, and its value with its unit)
      `<label class="sg-sl" data-k="${s.key}"><span class="sg-sl-name"><span class="sg-long" id="${uid}-n-${s.key}" data-t="name_${s.key}">${T[`name_${s.key}`]}</span><span class="sg-short" data-t="short_${s.key}">${T[`short_${s.key}`]}</span></span><input type="range" min="${s.min}" max="${s.max}" step="${s.step}" aria-labelledby="${uid}-n-${s.key}"><output class="sg-sl-v mono" aria-hidden="true"></output></label>`,
  ).join("");
  root.innerHTML = `
    <p class="sp-kicker mono"><i class="sg-key" aria-hidden="true"></i><span class="sp-name" data-t="name">${T.name}</span><span class="sp-sep" aria-hidden="true">·</span><span class="sp-ill" title="${T.illTip}" data-t-title="illTip" data-t="ill">${T.ill}</span></p>
    <div class="sp-anim sg-anim" tabindex="0" role="group" aria-label="${T.animAria}" data-t-aria="animAria"><svg class="sg-svg" aria-hidden="true"></svg></div>
    <div class="sg-maps">
      <figure class="sg-map"><figcaption class="mono"><b data-t="sim">${T.sim}</b><span class="sg-how" data-t="simHow">${T.simHow}</span></figcaption><div class="sg-mapcell"></div><p class="sg-stat mono" data-m="sim"></p></figure>
      <figure class="sg-map"><figcaption class="mono"><b data-t="real">${T.real}</b><span class="sg-how" data-t="realHow">${T.realHow}</span></figcaption><div class="sg-mapcell"></div><p class="sg-stat mono" data-m="real"></p></figure>
    </div>
    <p class="sg-rule mono"><span class="sg-ramp" style="background:linear-gradient(90deg, ${ramp})" aria-hidden="true"></span><span data-t="rule">${T.rule}</span></p>
    <div class="sp-ctl sg-ctl">
      <span class="sp-seg" role="group" aria-label="${T.object}" data-t-aria="object">${KINDS.map((k) => `<button type="button" class="sp-chip" data-obj="${k}" aria-pressed="${k === "ball"}">${OBJ_NAMES()[k]}</button>`).join("")}</span>
      <button type="button" class="sp-btn sg-play">${ICON_PAUSE}<span class="sp-btn-t">${T.pause}</span></button>
      <button type="button" class="sp-btn sg-reset" aria-label="${T.resetAria}" data-t-aria="resetAria">${ICON_RESET}<span class="sp-btn-t" data-t="reset">${T.reset}</span></button>
      <span class="sg-total mono" aria-live="off"></span>
    </div>
    <div class="sg-sliders">${sliders}</div>
    <p class="sp-line demo-extra" data-t="line">${T.line}</p>`;
  el.append(root);
  if (reduced) root.classList.add("is-reduced");
  const anim = root.querySelector<HTMLElement>(".sg-anim")!;
  const svg = anim.querySelector("svg")!;
  const playBtn = root.querySelector<HTMLButtonElement>(".sg-play")!;
  const resetBtn = root.querySelector<HTMLButtonElement>(".sg-reset")!;
  const totalEl = root.querySelector<HTMLElement>(".sg-total")!;
  const objBtns = [...root.querySelectorAll<HTMLButtonElement>("[data-obj]")];
  const cells = [...root.querySelectorAll<HTMLElement>(".sg-mapcell")];
  const stats = [...root.querySelectorAll<HTMLElement>(".sg-stat")];
  const mapS = new PadMap(cells[0]);
  const mapR = new PadMap(cells[1]);
  const sliderEls = new Map<keyof Params, { input: HTMLInputElement; out: HTMLOutputElement; def: SliderDef }>();
  for (const lab of root.querySelectorAll<HTMLLabelElement>(".sg-sl")) {
    const def = SLIDERS.find((s) => s.key === lab.dataset.k)!;
    sliderEls.set(def.key, { input: lab.querySelector("input")!, out: lab.querySelector("output")!, def });
  }

  // ------------------------------------------------------------------ the model
  const pad = finPad();
  const shapes = {} as Record<ObjKind, Shape>;
  for (const k of KINDS) shapes[k] = makeShape(k);
  let object: ObjKind = "ball";
  const p: Params = { ...DEFAULT_P };
  let spot = { a: 0, b: 0 };
  const touch = createTouch({ pad, kn: p.kn, kd: p.kd, maxRate: 200 });
  let sim: Readout = createReadout({ style: "sim", threshold: p.threshold });
  let real: Readout = createReadout({ style: "real", threshold: p.threshold, noise: p.noise });
  const meas = { dist: new Float32Array(TAXELS), depth: new Float32Array(TAXELS), which: new Int16Array(TAXELS) };
  let loopT = 0;
  let press = 0;
  let playing = !reduced;
  const cycle = () => 2 * p.time + HOLD + REST;
  /** the press (mm) at loop time t: in over `time`, hold, out over `time`, rest lifted */
  const pressAt = (t: number) => {
    const u = t % cycle();
    if (u < p.time) return lerpD(wave(u / p.time));
    if (u < p.time + HOLD) return p.depth;
    if (u < 2 * p.time + HOLD) return lerpD(1 - wave((u - p.time - HOLD) / p.time));
    return -LIFT;
  };
  const lerpD = (e: number) => -LIFT + (p.depth + LIFT) * e;
  /** one engine step (1/100 s) at the press for loop time t */
  const stepAt = (t: number) => {
    press = pressAt(t);
    placeObject(shapes[object], pad, spot.a, spot.b, press, press > 0 ? meas : undefined);
    touch.step([shapes[object]], DT);
    sim.read(touch.force);
    real.read(touch.force);
  };
  /** replay from 0 to t (deterministic) */
  const replay = (t: number) => {
    touch.reset();
    sim = createReadout({ style: "sim", threshold: p.threshold });
    real = createReadout({ style: "real", threshold: p.threshold, noise: p.noise });
    const n = Math.round(t * HZ);
    for (let q = 0; q <= n; q++) stepAt(q * DT);
    loopT = n * DT;
  };
  /** reduced motion: the held press, 40 frames in */
  const holdStill = () => {
    touch.reset();
    sim = createReadout({ style: "sim", threshold: p.threshold });
    real = createReadout({ style: "real", threshold: p.threshold, noise: p.noise });
    for (let q = 0; q < 40; q++) {
      press = p.depth;
      placeObject(shapes[object], pad, spot.a, spot.b, press, press > 0 ? meas : undefined);
      touch.step([shapes[object]], DT);
      sim.read(touch.force);
      real.read(touch.force);
    }
  };

  // ------------------------------------------------------------------ the drawing
  // (a little higher than the points card's camera: the pad's face opens up, objects stand less tall)
  const cam = makeCam(22, 46);
  let fin: FinView | null = null;
  let obj: ObjView | null = null;
  let builtKey = "";
  let form = "large";
  let dotR = { r0: 1, r1: 2 };

  const build = (W: number, hMax: number, sMin = 0) => {
    svg.replaceChildren();
    // the bounds: the finger from CROP_X to the tip, and room over the pad for the tallest object
    const top = Math.max(...KINDS.map((k) => OBJ_TOP[k])) + LIFT + 1;
    let x0 = Infinity;
    let x1 = -Infinity;
    let y0 = Infinity;
    let y1 = -Infinity;
    for (const x of range(CROP_X, FIN.LF, 10))
      for (const y of [-FIN.FW / 2, FIN.FW / 2])
        for (const z of [0, -FIN.FD + ((FIN.FD - FIN.TT) * x) / FIN.LF, x >= FIN.PAD_X0 - 6 ? top : 0]) {
          const w = finPoint(x, y, z, 0);
          const [sx, sy] = cam.raw(w[0], w[1], w[2]);
          x0 = Math.min(x0, sx);
          x1 = Math.max(x1, sx);
          y0 = Math.min(y0, sy);
          y1 = Math.max(y1, sy);
        }
    const bw = x1 - x0;
    const bh = y1 - y0;
    const padT = 6;
    const sW = Math.min((W - 6) / bw, 9);
    let s = sW;
    if (hMax > 0) s = Math.max(sW * sMin, Math.min(s, (hMax - padT - 4) / bh));
    s = Math.max(1.2, s);
    cam.s = s;
    cam.ux = (W - bw * s) / 2 - x0 * s;
    cam.uy = padT - y0 * s;
    const H = Math.ceil(padT + bh * s + 4);
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.setAttribute("height", String(H));
    svg.dataset.scale = s.toFixed(2);
    // the finger runs off the left edge: it fades out over the first 56 px
    const defs = svgEl("defs", {}, svg);
    const fg = svgEl("linearGradient", { id: `${uid}-fade`, gradientUnits: "userSpaceOnUse", x1: 0, x2: 56, y1: 0, y2: 0 }, defs);
    svgEl("stop", { offset: 0, "stop-color": "#fff", "stop-opacity": 0 }, fg);
    svgEl("stop", { offset: 1, "stop-color": "#fff", "stop-opacity": 1 }, fg);
    const mask = svgEl("mask", { id: `${uid}-crop`, maskUnits: "userSpaceOnUse", x: -10, y: -10, width: W + 20, height: H + 20 }, defs);
    svgEl("rect", { x: -10, y: -10, width: W + 20, height: H + 20, fill: `url(#${uid}-fade)` }, mask);
    const g = svgEl("g", { mask: `url(#${uid}-crop)` }, svg);
    fin = new FinView(g, uid);
    fin.draw(cam, 0, pad);
    obj = new ObjView(svg, uid);
    dotR = { r0: Math.max(0.8, 0.26 * s), r1: Math.max(1.4, 0.5 * s) };
    dotCode.fill(-1);
  };

  // ------------------------------------------------------------------ painting
  let zeroRgb: RGB = [222, 222, 216];
  let lut: string[] = viridisLut(zeroRgb);
  let gapCss = "#ffffff";
  let inkCss = "#18181a";
  const readColours = () => {
    zeroRgb = parseColor(cssVar(root, "--sp-map-zero", "#deded8"), [222, 222, 216]);
    lut = viridisLut(zeroRgb);
    gapCss = cssVar(root, "--face", "#ffffff");
    inkCss = cssVar(root, "--ink", "#18181a");
  };
  readColours();
  const offTheme = ctx.onTheme(() =>
    requestAnimationFrame(() => {
      readColours();
      dotCode.fill(-1);
      paint();
    }),
  );
  const dotCode = new Int16Array(TAXELS).fill(-1);
  const spotK = () => {
    const j = Math.round(spot.a / 2 + 15.5);
    const i = Math.round(spot.b / 2 + 5.5);
    return i >= 0 && i < 12 && j >= 0 && j < 32 ? i * 32 + j : -1;
  };
  /** a frame's stats: points lit, and the divisor the rule used (its top value after the threshold, or the fixed 60) */
  const statHtml = (r: Readout) => {
    const T = STR();
    const top = Math.round(r.max);
    const div = r.quiet ? fill(T.quiet, { top, thr: Math.round(r.threshold) }) : fill(T.loud, { top });
    return fill(T.stat, { lit: r.lit, div });
  };
  let lastStat = "";

  const paint = () => {
    if (!fin || !obj) return;
    const sp = pad.surface(spot.a, spot.b);
    obj.draw(cam, object, shapes[object], sp, press, GLASS[object]);
    // the points take the simulated frame's colours
    for (let q = 0; q < TAXELS; q++) {
      const v = sim.norm[q];
      const code = v > 0 ? 1 + Math.round(v * 254) : 0;
      if (dotCode[q] === code) continue;
      dotCode[q] = code;
      const d = fin.dots[q];
      if (code) {
        d.setAttribute("class", "sp-dot is-lit");
        d.setAttribute("style", `fill:${lut[code]}`);
        d.setAttribute("r", f1(dotR.r1));
      } else {
        d.setAttribute("class", "sp-dot");
        d.removeAttribute("style");
        d.setAttribute("r", f1(dotR.r0));
      }
    }
    const sk = spotK();
    const ring = (g: CanvasRenderingContext2D, c: number) => {
      if (sk < 0) return;
      g.strokeStyle = inkCss;
      g.lineWidth = 1.5;
      g.setLineDash([2, 2]);
      g.strokeRect((sk % 32) * c + 0.5, Math.floor(sk / 32) * c + 0.5, c, c);
      g.setLineDash([]);
    };
    mapS.paint((q) => lut[Math.round(255 * clamp01(sim.norm[q]))], gapCss, ring);
    mapR.paint((q) => lut[Math.round(255 * clamp01(real.norm[q]))], gapCss, ring);
    const st = statHtml(sim) + "|" + statHtml(real) + "|" + touch.total.toFixed(1) + "|" + Math.max(0, press).toFixed(2);
    if (st !== lastStat) {
      lastStat = st;
      stats[0].innerHTML = statHtml(sim);
      stats[1].innerHTML = statHtml(real);
      totalEl.innerHTML = fill(STR().total, { n: touch.total.toFixed(1), mm: Math.max(0, press).toFixed(2) });
    }
  };

  // ------------------------------------------------------------------ motion
  let visible = !document.hidden;
  let onscreen = true;
  let raf = 0;
  let last = 0;
  let acc = 0;
  const tick = (now: number) => {
    raf = 0;
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (playing) {
      acc += dt;
      let n = 0;
      while (acc >= DT && n < 12) {
        acc -= DT;
        loopT += DT;
        stepAt(loopT);
        n++;
      }
      if (n === 12) acc = 0;
    }
    paint();
    run();
  };
  function run() {
    const want = !reduced && visible && onscreen && playing;
    if (want && !raf) {
      if (!last || performance.now() - last > 100) last = performance.now();
      raf = requestAnimationFrame(tick);
    } else if (!want && raf) {
      cancelAnimationFrame(raf);
      raf = 0;
      last = 0;
    }
  }
  /** after a change while still (paused or reduced motion): recompute the frames shown */
  const refresh = () => {
    if (reduced) holdStill();
    else if (!playing) replay(loopT);
    paint();
  };
  const paintPlay = () => {
    const T = STR();
    playBtn.innerHTML = `${playing ? ICON_PAUSE : ICON_PLAY}<span class="sp-btn-t">${playing ? T.pause : T.play}</span>`;
    playBtn.setAttribute("aria-label", playing ? T.pauseAria : T.playAria);
  };
  const setPlaying = (on: boolean) => {
    playing = on && !reduced;
    paintPlay();
    run();
  };

  // ------------------------------------------------------------------ controls
  const showSlider = (k: keyof Params) => {
    const s = sliderEls.get(k)!;
    s.input.value = String(p[k]);
    // (the byte unit has words: "counts" / 计数; the others are symbols)
    const unit = s.def.unit === "counts" ? STR().unit_counts : s.def.unit;
    s.out.innerHTML = `${p[k].toFixed(s.def.dec)} <span class="sg-u">${unit}</span>`;
    s.input.setAttribute("aria-valuetext", `${p[k].toFixed(s.def.dec)} ${unit}`);
  };
  const apply = (k: keyof Params) => {
    if (k === "kn" || k === "kd") touch.setGains({ kn: p.kn, kd: p.kd });
    if (k === "threshold") {
      sim.threshold = p.threshold;
      real.threshold = p.threshold;
    }
    if (k === "noise") real = createReadout({ style: "real", threshold: p.threshold, noise: p.noise });
    showSlider(k);
  };
  for (const [k, s] of sliderEls) {
    showSlider(k);
    s.input.addEventListener("input", () => {
      p[k] = Number(s.input.value);
      apply(k);
      refresh();
    });
  }
  const setObject = (k: ObjKind) => {
    object = k;
    for (const b of objBtns) b.setAttribute("aria-pressed", String(b.dataset.obj === k));
    touch.reset();
    refresh();
  };
  objBtns.forEach((b) => b.addEventListener("click", () => setObject(b.dataset.obj as ObjKind)));
  playBtn.addEventListener("click", () => setPlaying(!playing));
  resetBtn.addEventListener("click", () => {
    Object.assign(p, DEFAULT_P);
    touch.setGains({ kn: p.kn, kd: p.kd });
    sim = createReadout({ style: "sim", threshold: p.threshold });
    real = createReadout({ style: "real", threshold: p.threshold, noise: p.noise });
    for (const k of sliderEls.keys()) showSlider(k);
    refresh();
  });

  // where the object presses: drag on the drawing (the face under the pointer), or click a map square
  const moveTo = (a: number, b: number) => {
    spot = { a: Math.max(-31, Math.min(31, a)), b: Math.max(-11, Math.min(11, b)) };
    touch.reset();
    refresh();
  };
  let dragging = false;
  const fromPointer = (e: PointerEvent) => {
    const r = svg.getBoundingClientRect();
    const vb = svg.viewBox.baseVal;
    const [x, y] = cam.toPlane(((e.clientX - r.left) / r.width) * vb.width, ((e.clientY - r.top) / r.height) * vb.height, FIN.PAD_T);
    moveTo(x - FIN.PAD_C, y);
  };
  svg.addEventListener("pointerdown", (e) => {
    dragging = true;
    try {
      svg.setPointerCapture(e.pointerId);
    } catch {
      /* optional */
    }
    fromPointer(e);
  });
  svg.addEventListener("pointermove", (e) => {
    if (dragging) fromPointer(e);
  });
  const up = () => {
    dragging = false;
  };
  svg.addEventListener("pointerup", up);
  svg.addEventListener("pointercancel", up);
  for (const [q, m] of [mapS, mapR].entries())
    cells[q].addEventListener("click", (e) => {
      const k = m.cellAt(e.clientX, e.clientY);
      if (k >= 0) moveTo(pad.colS[k % 32], pad.rowB[Math.floor(k / 32)]);
    });
  anim.addEventListener("keydown", (e) => {
    const d = e.key === "ArrowRight" ? [2, 0] : e.key === "ArrowLeft" ? [-2, 0] : e.key === "ArrowDown" ? [0, 2] : e.key === "ArrowUp" ? [0, -2] : null;
    if (!d) return;
    e.preventDefault();
    moveTo(Math.round((spot.a + d[0] - 1) / 2) * 2 + 1, Math.round((spot.b + d[1] - 1) / 2) * 2 + 1);
  });

  // ------------------------------------------------------------------ layout
  const relayout = () => {
    if (!root.isConnected) return;
    const W = Math.round(anim.getBoundingClientRect().width);
    if (W < 60) return;
    const maxH = Number(root.closest<HTMLElement>("[data-max-h]")?.dataset.maxH) || 0;
    const compact = Boolean(root.closest("[data-compact]"));
    // a wide card in a short window with no height from the host (a phone on its side: the stage takes the card's
    // height): the drawing and the maps side by side, the controls under the maps, so the maps and the knobs that
    // change them are on the screen together
    const sideW = Math.round(root.clientWidth);
    const side = sideForm(maxH, sideW);
    const key = `${W} ${maxH} ${compact} ${side} ${sideW}`;
    if (key === builtKey) return;
    builtKey = key;
    root.toggleAttribute("data-side", side);
    if (side) {
      sideLayout();
      return;
    }
    form = W >= 470 ? "large" : W >= 300 ? "medium" : "mini";
    root.dataset.form = form;
    const mw = (W - 14) / 2;
    const cell = Math.max(3, Math.min(12, Math.floor((mw - 1) / 32)));
    mapS.size(cell);
    mapR.size(cell);
    root.style.setProperty("--sg-mapw", `${mapS.width}px`);
    build(W, 0);
    dotCode.fill(-1);
    paint();
    if (maxH) {
      const card = root.closest<HTMLElement>(".demo-card") ?? el;
      const over = card.offsetHeight - maxH;
      if (over > 0) {
        build(W, Math.max(80, anim.offsetHeight - over), compact ? 0.4 : 0.8);
        paint();
      }
    }
  };
  /** The side form: the drawing on the left (as tall as the window allows), the maps, the rule and the controls on the
   *  right, the knobs in three columns under both. */
  const sideLayout = () => {
    form = "large";
    root.dataset.form = form;
    const cs = getComputedStyle(root);
    const inner = root.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const colW = Math.floor((inner - 16) * 0.48);
    const drawW = Math.floor(inner - 16 - colW);
    const cell = Math.max(3, Math.min(8, Math.floor((colW - 14 - 1) / 2 / 32)));
    mapS.size(cell);
    mapR.size(cell);
    root.style.setProperty("--sg-mapw", `${mapS.width}px`);
    root.style.setProperty("--sg-col", `${colW}px`);
    build(drawW, 0);
    dotCode.fill(-1);
    paint();
    // (the card no taller than the window: the drawing gives up the height, down to ~100 px)
    const card = root.closest<HTMLElement>(".demo-card") ?? root;
    const over = card.offsetHeight - (window.innerHeight - 24);
    if (over > 0) {
      build(drawW, Math.max(100, anim.offsetHeight - over), 0.3);
      dotCode.fill(-1);
      paint();
    }
  };
  const ro = new ResizeObserver(() => relayout());
  ro.observe(anim);
  // (the side form depends on the window's height too)
  const onWin = () => relayout();
  window.addEventListener("resize", onWin);
  const onVis = () => {
    visible = !document.hidden;
    run();
  };
  document.addEventListener("visibilitychange", onVis);
  const io = new IntersectionObserver((es) => {
    onscreen = es[es.length - 1].isIntersecting;
    run();
  });
  io.observe(root);

  // a language switch: the words and the buttons (the loop, the spot and the sliders carry on; the drawing has no
  // words of its own, but the card's height may change)
  const offLang = ctx.onLang(() => {
    paintText(root, STR());
    for (const b of objBtns) b.textContent = OBJ_NAMES()[b.dataset.obj as ObjKind];
    for (const k of sliderEls.keys()) showSlider(k);
    paintPlay();
    lastStat = "";
    // (the card's height may change with the words: fit the drawing again)
    builtKey = "";
    relayout();
    paint();
  });

  if (reduced) holdStill();
  else replay(0);
  setPlaying(playing);

  return {
    layout() {
      builtKey = "";
      relayout();
    },
    // a guided step's form (GuidedStep.widgetView): {object} picks the object, {noise} sets the real-style noise (counts;
    // Lesson 3.4 step 2 turns it up so the real-style map visibly speckles, steps 1 and 3 put it back)
    view(v) {
      if (!v) return;
      if (typeof v.object === "string" && (KINDS as string[]).includes(v.object)) setObject(v.object as ObjKind);
      if (typeof v.noise === "number" && Number.isFinite(v.noise) && v.noise !== p.noise) {
        p.noise = Math.max(0, Math.min(8, v.noise));
        apply("noise");
        refresh();
      }
    },
    destroy() {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      ro.disconnect();
      io.disconnect();
      offTheme();
      offLang();
      window.removeEventListener("resize", onWin);
      document.removeEventListener("visibilitychange", onVis);
      root.remove();
    },
    play: () => setPlaying(true),
    pause: () => setPlaying(false),
    set(v) {
      if (v.object) {
        object = v.object;
        for (const b of objBtns) b.setAttribute("aria-pressed", String(b.dataset.obj === object));
      }
      if (v.a !== undefined || v.b !== undefined) spot = { a: v.a ?? spot.a, b: v.b ?? spot.b };
      for (const k of Object.keys(DEFAULT_P) as (keyof Params)[]) {
        if (v[k] === undefined) continue;
        p[k] = v[k]!;
        apply(k);
      }
      touch.reset();
      refresh();
    },
    seek(t) {
      setPlaying(false);
      replay(t);
      paint();
    },
    state: () => ({
      object,
      params: { ...p },
      a: spot.a,
      b: spot.b,
      t: loopT,
      press,
      total: touch.total,
      sim: { lit: sim.lit, max: sim.max, quiet: sim.quiet },
      real: { lit: real.lit, max: real.max, quiet: real.quiet },
      playing,
    }),
  };
}
