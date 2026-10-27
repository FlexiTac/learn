// How deep, how hard: the card for Lesson 3.3 ("In simulation"). How the simulator turns "the object is inside the pad"
// into a force, point by point (VT-Refine's tactile model, as @shared/models/touchsim.mjs implements it):
//   (a) an isometric close-up of ONE row of the pad (the contact row: sense line i = 5, the 9 or 13 points around the
//       press), each point drawn as a little cap (the pad at that point, amber) held up off the finger (orange TPU) by
//       an imagined spring and damper side by side (Kelvin-Voigt; they are a model, not parts of the sensor). A
//       fingertip-size ball (r 8 mm; glass, as on the points card, so the caps under it stay in view) comes down on the
//       row: every cap under it is pushed down to the ball's surface, by its penetration depth d (touchsim
//       measureDepth; the row runs through the ball's lowest point, so the caps meet its outline). The dashed
//       line is where the caps rest; the gap under it is d. Each touched cap pushes back with an arrow (the lesson
//       colour) as long as its force f = k_n d + k_d d' (touchsim Touch.step: normal force only, never pulling). Under
//       the finger, two rows of numbers line up with the caps: d (mm) and f (N).
//   (b) the formula for the middle point with its live numbers, a bar split into the spring's part and the damper's
//       part, and the whole pad's total.
//   (c) the depth map and the force map side by side (12 x 32, viridis on Lesson 1's quiet zero; fixed scales 0-1.5 mm
//       and 0-1 N, so a harder press is brighter), the drawn row outlined.
// Tours: "Slow press" (1.3 mm in 1.4 s, hold, out in 1 s: the damper's part is a sliver) and "Quick tap" (in 0.08 s,
// hold 0.12 s, out 0.08 s, PLAYED 10 x SLOWER so it can be followed: the damper adds ~30 % on the way in, takes it away
// on the way out, and the force reaches 0 a little before the ball has left: a pad only pushes). Drag up / down on the
// drawing (or ↑ ↓) to press by hand, in real time; the tour resumes 3 s after the pointer leaves. Reduced motion: no
// tour; "Slow press" holds a firm press, "Quick tap" shows the tap at its fastest (a still); drags jump. The loop
// stops while the tab is hidden or the card is off screen.
// Numbers: touchsim DEFAULTS (k_n 0.6 N/mm, k_d 0.012 N·s/mm per point) and PRESETS (ball r 8 mm, firm 1.3 mm):
// ILLUSTRATIVE (chosen, not measured; the paper's k_n = 1.0, k_d = 3e-3 are in SI units). Normal force only: a
// FlexiTac pad feels squeezing through its thickness, not sideways rubbing, so the model leaves shear out.
// Forms from the drawing's width W: large (W >= 470: 13 points, part labels), medium (9 points), mini (W < 300: 7
// points, no labels, icon buttons). Under a height budget (data-max-h) the drawing gets shorter; the host's compact
// form drops the closing sentence.
import { DEFAULTS, PRESETS, createTouch, makePad, pressOnto, sphere } from "@shared/models/touchsim.mjs";
import { fill, strings } from "../i18n";
import { paintText, setTextBeside } from "../i18n/paint";
import type { WidgetCtx, WidgetInstance } from "../types";
import { h } from "../ui/dom";
import { PadMap, clamp01, cssVar, f1, lerp, makeCam, parseColor, pathOf, range, setAttr, sideForm, svgEl, viridisCss, viridisLut, wave, type Pt, type RGB } from "./sim-points";
import "./sim-springs.css";

const KN = DEFAULTS.kn;
const KD = DEFAULTS.kd;
// the card's words (docs/i18n.md): painted from STR() and again on a language switch (the drawing's labels too: it is
// built again)
const STR = strings(
  {
    illTip: "A simplified in-browser model. k_n = 0.6 N/mm and k_d = 0.012 N·s/mm per point are chosen, not measured.",
    name: "How deep, how hard",
    ill: "Illustrative",
    animAria: "One row of the pad, close up, each point on an imagined spring and damper, and a ball pressing on it. Drag up or down, or use the up and down arrow keys, to press.",
    who: "middle point",
    units: "k<sub>n</sub> = {kn} N per mm · k<sub>d</sub> = {kd} N per mm/s · d in mm · ḋ (how fast d changes) in mm/s",
    depth: "Depth",
    force: "Force",
    pause: "Pause",
    play: "Play",
    pauseAria: "Pause the tour",
    playAria: "Play the tour",
    tour: "Tour",
    slow: "Slow press",
    tap: "Quick tap",
    slower: "played 10 × slower",
    drag: "drag ↕ · ↑ ↓",
    line: "Each point acts like a little <b>spring</b> (the deeper, the harder) and <b>damper</b> (the faster, the harder). The force points straight out of the pad: the model leaves out sideways rubbing, which FlexiTac cannot feel.",
    rest: "rest",
    spring: "spring",
    damper: "damper",
    finger: "finger",
    ballLong: "glass ball · r 8 mm",
    ball: "glass ball",
    clip: "(a pad only pushes: 0)",
    partS: "spring {v} N",
    partD: "damper {v} N",
    tot: "All 384 points: <b>{n} N</b> on <b>{c}</b> point{s}.",
    plural: "s",
    valuetext: "press {p} millimetres; middle point force {f} newtons; whole pad {t} newtons",
  },
  {
    illTip: "在浏览器里运行的简化模型。每个点的 k_n = 0.6 N/mm 和 k_d = 0.012 N·s/mm 是选定的，不是测量值。",
    name: "压多深，力多大",
    ill: "示意",
    animAria: "传感垫的一排点（放大），想象每个点下面有一个弹簧和一个阻尼器，一个球压在上面。上下拖动，或用上下方向键来按压。",
    who: "中间的点",
    units: "k<sub>n</sub> = {kn} N 每 mm · k<sub>d</sub> = {kd} N 每 mm/s · d 的单位是 mm · ḋ（d 变化的快慢）的单位是 mm/s",
    depth: "深度",
    force: "力",
    pause: "暂停",
    play: "播放",
    pauseAria: "暂停演示",
    playAria: "播放演示",
    tour: "演示",
    slow: "慢慢按",
    tap: "快速轻点",
    slower: "放慢 10 倍播放",
    drag: "拖动 ↕ · ↑ ↓",
    line: "每个点都像一个小<b>弹簧</b>（压得越深，力越大）加一个<b>阻尼器</b>（压得越快，力越大）。力垂直于传感垫向外：模型不考虑侧向摩擦，因为 FlexiTac 感觉不到它。",
    rest: "静止",
    spring: "弹簧",
    damper: "阻尼器",
    finger: "手指",
    ballLong: "玻璃球 · r 8 mm",
    ball: "玻璃球",
    clip: "（传感垫只会往外推：0）",
    partS: "弹簧 {v} N",
    partD: "阻尼器 {v} N",
    tot: "全部 384 个点：<b>{n} N</b>，分布在 <b>{c}</b> 个点上。",
    plural: "",
    valuetext: "按压 {p} 毫米；中间点的力 {f} 牛顿；整个传感垫 {t} 牛顿",
  },
);
const R = PRESETS.fingertip.radius;
const FIRM = PRESETS.firmDepth;
const D_MAX = 2;
/** the contact row and the ball's spot: right over point (i0, j0) */
const I0 = 5;
const J0 = 15;
const K0 = I0 * 32 + J0;
/** map scales (fixed, so a harder press is brighter) */
const DEPTH_SCALE = 1.5;
const FORCE_SCALE = 1;
const RESUME_MS = 3000;

// the drawing, mm (x along the row, y across it, z up; the finger's top is z = 0)
const H0 = 3.6; // cap top at rest (the imagined springs are drawn tall so their squeeze shows)
const CAP_T = 0.24;
const CAP_R = 0.84;
const RC = 0.34; // coil radius
const TURNS = 5;
const RD = 0.28; // damper body radius
const DB = 1.7; // damper body height
const SLAB = 1.3;
const SLAB_Y = 1.5;
const TOP = H0 + 4.4; // the drawing's top (the ball fades out under it)
/** arrow length per newton (mm) */
const ARROW_K = 2.4;

type Mode = "slow" | "tap";
const TOURS: Record<Mode, { inT: number; hold: number; outT: number; rest: number; slow: number }> = {
  slow: { inT: 1.4, hold: 1.2, outT: 1.0, rest: 1.0, slow: 1 },
  tap: { inT: 0.08, hold: 0.12, outT: 0.08, rest: 0.22, slow: 10 },
};
const tourLen = (m: Mode) => {
  const t = TOURS[m];
  return t.inT + t.hold + t.outT + t.rest;
};
/** the press depth (mm) at sim time t of the tour */
function tourDepth(m: Mode, t: number) {
  const T = TOURS[m];
  const u = ((t % tourLen(m)) + tourLen(m)) % tourLen(m);
  if (u < T.inT) return FIRM * wave(u / T.inT);
  if (u < T.inT + T.hold) return FIRM;
  if (u < T.inT + T.hold + T.outT) return FIRM * (1 - wave((u - T.inT - T.hold) / T.outT));
  return 0;
}

export interface SimSpringsState {
  mode: Mode;
  playing: boolean;
  /** the ball's press (mm, < 0 = above the pad), and the middle point's d, d', f and its two parts */
  press: number;
  d: number;
  rate: number;
  f: number;
  spring: number;
  damper: number;
  total: number;
  count: number;
  /** tour time (sim s) */
  t: number;
}
export interface SimSpringsInstance extends WidgetInstance {
  play(): void;
  pause(): void;
  /** Pause and show the tour at t sim-seconds (deterministic: d' from fixed 1/60 s steps). */
  seek(t: number, mode?: Mode): void;
  /** Pause and hold a press of `depth` mm (d' = 0). */
  press(depth: number): void;
  state(): SimSpringsState;
}

const ICON_PLAY = `<svg class="sp-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z"/></svg>`;
const ICON_PAUSE = `<svg class="sp-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M7.5 5.5h3v13h-3zM13.5 5.5h3v13h-3z"/></svg>`;
const V = { kn: KN, kd: KD };
const fmt2 = (v: number) => (Math.abs(v) < 0.005 ? "0.00" : v.toFixed(2));
const fmtRate = (v: number) => (Math.abs(v) < 0.05 ? "0.0" : v.toFixed(1));
const sgn = (v: number) => (v < -0.0049 ? "−" : "+");

let seq = 0;

export function mount(el: HTMLElement, ctx: WidgetCtx): SimSpringsInstance {
  const reduced = ctx.reducedMotion();
  const uid = `ss${++seq}`;
  const root = h("div", { class: "sim ss" });
  const T = STR();
  const ramp = Array.from({ length: 9 }, (_, q) => viridisCss(q / 8)).join(", ");
  root.innerHTML = `
    <p class="sp-kicker mono"><i class="ss-key" aria-hidden="true"></i><span class="sp-name" data-t="name">${T.name}</span><span class="sp-sep" aria-hidden="true">·</span><span class="sp-ill" title="${T.illTip}" data-t-title="illTip" data-t="ill">${T.ill}</span></p>
    <div class="sp-anim ss-anim" tabindex="0" role="slider" aria-label="${T.animAria}" data-t-aria="animAria" aria-valuemin="0" aria-valuemax="${D_MAX}"><svg class="ss-svg" aria-hidden="true"></svg></div>
    <div class="ss-read">
      <p class="ss-f mono"><span class="ss-who" data-t="who">${T.who}</span> <b>f</b> = <b>k<sub>n</sub></b>·<b>d</b> + <b>k<sub>d</sub></b>·<b>ḋ</b></p>
      <p class="ss-num mono" aria-live="off"></p>
      <p class="ss-key-units mono" aria-hidden="true" data-t="units">${fill(T.units, V)}</p>
      <div class="ss-barrow"><span class="ss-bar" aria-hidden="true"><i class="ss-bar-s"></i><i class="ss-bar-d"></i></span><span class="ss-parts mono"></span></div>
      <p class="ss-tot"></p>
    </div>
    <div class="ss-maps">
      <figure class="ss-map"><figcaption class="mono"><b data-t="depth">${T.depth}</b> d<span class="ss-unit">0–1.5 mm</span></figcaption><div class="ss-mapcell"></div><span class="ss-ramp" style="background:linear-gradient(90deg, ${ramp})"></span></figure>
      <figure class="ss-map"><figcaption class="mono"><b data-t="force">${T.force}</b> f<span class="ss-unit">0–1 N</span></figcaption><div class="ss-mapcell"></div><span class="ss-ramp" style="background:linear-gradient(90deg, ${ramp})"></span></figure>
    </div>
    <div class="sp-ctl">
      <button type="button" class="sp-btn ss-play">${ICON_PAUSE}<span class="sp-btn-t">${T.pause}</span></button>
      <span class="sp-seg" role="group" aria-label="${T.tour}" data-t-aria="tour"><button type="button" class="sp-chip" data-mode="slow" aria-pressed="true" data-t="slow">${T.slow}</button><button type="button" class="sp-chip" data-mode="tap" aria-pressed="false" data-t="tap">${T.tap}</button></span>
      <span class="ss-keys mono" aria-hidden="true"><span class="ss-slow" data-t="slower">${T.slower}</span><span class="ss-keys-drag"><span class="ss-slow"> · </span>${T.drag}</span></span>
    </div>
    <p class="sp-line demo-extra" data-t="line">${T.line}</p>`;
  el.append(root);
  if (reduced) root.classList.add("is-reduced");
  const anim = root.querySelector<HTMLElement>(".ss-anim")!;
  const svg = anim.querySelector("svg")!;
  const numEl = root.querySelector<HTMLElement>(".ss-num")!;
  const partsEl = root.querySelector<HTMLElement>(".ss-parts")!;
  const barS = root.querySelector<HTMLElement>(".ss-bar-s")!;
  const barD = root.querySelector<HTMLElement>(".ss-bar-d")!;
  const totEl = root.querySelector<HTMLElement>(".ss-tot")!;
  const playBtn = root.querySelector<HTMLButtonElement>(".ss-play")!;
  const modeBtns = [...root.querySelectorAll<HTMLButtonElement>("[data-mode]")];
  const cells = [...root.querySelectorAll<HTMLElement>(".ss-mapcell")];
  const mapD = new PadMap(cells[0]);
  const mapF = new PadMap(cells[1]);

  // ------------------------------------------------------------------ the model
  const pad = makePad();
  const ball = sphere({ radius: R });
  const touch = createTouch({ pad, kn: KN, kd: KD, maxRate: 80 });
  const A0 = pad.colS[J0];
  const B0 = pad.rowB[I0];
  let mode: Mode = "slow";
  let playing = !reduced;
  let tourT = 0;
  let press = reduced ? FIRM : 0;
  const stepTo = (depth: number, dt: number) => {
    press = depth;
    pressOnto(ball, pad, { a: A0, b: B0, depth });
    touch.step([ball], dt);
  };
  /** deterministic: the state at tour time t, d' from fixed 1/60 s steps */
  const seekTour = (t: number) => {
    touch.reset();
    const hh = 1 / 60 / TOURS[mode].slow;
    for (let q = 3; q >= 0; q--) stepTo(tourDepth(mode, t - q * hh), hh);
    tourT = t;
  };
  const hold = (depth: number) => {
    touch.reset();
    stepTo(depth, 1 / 60);
  };
  if (reduced) hold(FIRM);
  else seekTour(0);

  // ------------------------------------------------------------------ the drawing
  const cam = makeCam(8, 14);
  type Unit = {
    j: number;
    x: number;
    coilBack: SVGPathElement;
    coilFront: SVGPathElement;
    rod: SVGPathElement;
    capSide: SVGPathElement;
    capTop: SVGPathElement;
    dot: SVGEllipseElement;
    arrow: SVGPathElement;
    arrowHalo: SVGPathElement;
    dTxt: SVGTextElement;
    fTxt: SVGTextElement;
  };
  let units: Unit[] = [];
  let ballBack: SVGCircleElement | null = null;
  let ballHi: SVGPathElement | null = null;
  let mid: SVGEllipseElement | null = null;
  let builtKey = "";
  let form = "large";

  const build = (W: number, hMax: number) => {
    svg.replaceChildren();
    units = [];
    const n = form === "large" ? 6 : form === "medium" ? 4 : 3;
    const labels = form !== "mini";
    const half = n * 2 + 1.2;
    // the left margin for the part labels and the number rows' names (px)
    const lm = labels ? (form === "large" ? 62 : 44) : 6;
    const rowsH = labels ? 34 : 30;
    const topPad = 4;
    // the extent at s = 1
    const pts: Pt[] = [];
    for (const x of [-half, half]) for (const y of [-SLAB_Y, SLAB_Y]) for (const z of [-SLAB, TOP]) pts.push(cam.raw(x, y, z));
    const x0 = Math.min(...pts.map((p) => p[0]));
    const x1 = Math.max(...pts.map((p) => p[0]));
    const y0 = Math.min(...pts.map((p) => p[1]));
    const y1 = Math.max(...pts.map((p) => p[1]));
    let s = (W - lm - 6) / (x1 - x0);
    if (hMax > 0) s = Math.min(s, (hMax - rowsH - topPad) / (y1 - y0));
    s = Math.max(6, Math.min(s, 34));
    cam.s = s;
    cam.ux = lm + (W - lm - (x1 - x0) * s) / 2 - x0 * s;
    cam.uy = topPad - y0 * s;
    const yRows = topPad + (y1 - y0) * s + 6;
    const H = Math.ceil(yRows + rowsH);
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.setAttribute("height", String(H));
    svg.dataset.scale = s.toFixed(2);
    const P = cam.P;
    const defs = svgEl("defs", {}, svg);
    // the ball fades out toward the drawing's top
    const fg = svgEl("linearGradient", { id: `${uid}-fade`, gradientUnits: "userSpaceOnUse", x1: 0, x2: 0, y1: P(0, 0, TOP)[1], y2: P(0, 0, TOP - 2.2)[1] }, defs);
    svgEl("stop", { offset: 0, "stop-color": "#fff", "stop-opacity": 0 }, fg);
    svgEl("stop", { offset: 1, "stop-color": "#fff", "stop-opacity": 1 }, fg);
    const mask = svgEl("mask", { id: `${uid}-mask`, maskUnits: "userSpaceOnUse", x: 0, y: 0, width: W, height: H }, defs);
    svgEl("rect", { x: 0, y: 0, width: W, height: H, fill: `url(#${uid}-fade)` }, mask);
    // the ball is glass (as on the points card), so the caps under it stay in view
    const gg = svgEl("radialGradient", { id: `${uid}-glass`, cx: 0.5, cy: 0.5, r: 0.5 }, defs);
    svgEl("stop", { offset: 0.55, class: "sp-glass-s0" }, gg);
    svgEl("stop", { offset: 0.92, class: "sp-glass-s1" }, gg);
    svgEl("stop", { offset: 1, class: "sp-glass-s2" }, gg);

    // ---- the finger under the row (orange TPU: its top, front, right end)
    const gf = svgEl("g", { class: "ss-finger" }, svg);
    svgEl("path", { class: "sp-tpu-top", d: pathOf([P(-half, -SLAB_Y, 0), P(half, -SLAB_Y, 0), P(half, SLAB_Y, 0), P(-half, SLAB_Y, 0)]) }, gf);
    svgEl("path", { class: "sp-tpu-l", d: pathOf([P(-half, SLAB_Y, 0), P(half, SLAB_Y, 0), P(half, SLAB_Y, -SLAB), P(-half, SLAB_Y, -SLAB)]) }, gf);
    svgEl("path", { class: "sp-tpu-r", d: pathOf([P(half, SLAB_Y, 0), P(half, -SLAB_Y, 0), P(half, -SLAB_Y, -SLAB), P(half, SLAB_Y, -SLAB)]) }, gf);
    // the rest line: where every cap sits untouched
    svgEl("path", { class: "ss-rest", d: pathOf([P(-half + 0.2, 0, H0), P(half - 0.2, 0, H0)], false) }, svg);

    // ---- the units, left to right (nearer on the right: drawn later)
    const gu = svgEl("g", { class: "ss-units" }, svg);
    for (let q = -n; q <= n; q++) {
      const j = J0 + q;
      const x = q * 2;
      const g = svgEl("g", {}, gu);
      const coilBack = svgEl("path", { class: "ss-coil-back" }, g);
      // the damper: a fixed body (a short cylinder: side, top), its rod (set per frame)
      const xd = x + 0.48;
      const bodySide = range(Math.PI, 2 * Math.PI, 10).map((t) => P(xd + RD * Math.cos(t), -RD * Math.sin(t), 0));
      const bodyTop = range(0, 2 * Math.PI, 18).map((t) => P(xd + RD * Math.cos(t), RD * Math.sin(t), DB));
      svgEl("path", { class: "ss-body", d: pathOf([...range(0, Math.PI, 10).map((t) => P(xd + RD * Math.cos(t), RD * Math.sin(t), DB)), ...bodySide]) }, g);
      svgEl("path", { class: "ss-body-top", d: pathOf(bodyTop) }, g);
      svgEl("path", { class: "ss-body-hole", d: pathOf(range(0, 2 * Math.PI, 12).map((t) => P(xd + 0.11 * Math.cos(t), 0.11 * Math.sin(t), DB))) }, g);
      const rod = svgEl("path", { class: "ss-rod" }, g);
      const coilFront = svgEl("path", { class: "ss-coil" }, g);
      const capSide = svgEl("path", { class: "sp-fpc-l" }, g);
      const capTop = svgEl("path", { class: "sp-fpc-top" }, g);
      const dot = svgEl("ellipse", { class: "ss-dot" }, g);
      units.push({ j, x, coilBack, coilFront, rod, capSide, capTop, dot, arrow: null!, arrowHalo: null!, dTxt: null!, fTxt: null! });
    }
    // the middle point's marker: a ring round its dot
    mid = svgEl("ellipse", { class: "ss-mid" }, svg);
    // ---- the ball, glass, over the row (it fades out toward the drawing's top)
    const gb = svgEl("g", { class: "ss-ball", mask: `url(#${uid}-mask)` }, svg);
    ballBack = svgEl("circle", { class: "sp-glass", fill: `url(#${uid}-glass)` }, gb);
    ballHi = svgEl("path", { class: "sp-glass-hi" }, gb);
    // ---- the arrows (each touched cap pushes back on the ball) over everything
    const ga = svgEl("g", { class: "ss-arrows" }, svg);
    for (const u of units) {
      u.arrowHalo = svgEl("path", { class: "ss-arrow-halo" }, ga);
      u.arrow = svgEl("path", { class: "ss-arrow" }, ga);
    }
    // ---- the number rows under the finger, one column per cap
    const gr = svgEl("g", { class: "ss-rows" }, svg);
    const ty = (q: number) => yRows + 9 + q * 15;
    for (const u of units) {
      const cx = P(u.x, SLAB_Y, -SLAB)[0];
      u.dTxt = svgEl("text", { class: "ss-val", x: f1(cx), y: f1(ty(0)), "text-anchor": "middle", "dominant-baseline": "central" }, gr);
      u.fTxt = svgEl("text", { class: "ss-val ss-val-f", x: f1(cx), y: f1(ty(1)), "text-anchor": "middle", "dominant-baseline": "central" }, gr);
    }
    if (labels) {
      const lx = lm - 8;
      const lab = (x: number, y: number, t: string, cls = "ss-lab", anchor = "end") => {
        const e = svgEl("text", { class: cls, x: f1(x), y: f1(y), "text-anchor": anchor, "dominant-baseline": "central" }, svg);
        e.textContent = t;
        return e;
      };
      lab(lx, ty(0), "d mm", "ss-lab ss-lab-row");
      lab(lx, ty(1), "f N", "ss-lab ss-lab-row");
      // the first unit's parts and the rest line, named in the left margin with short leaders
      const u = units[0];
      // a leader: from the label's row to a point on the part (an elbow when the part sits off the row), ending on a dot
      const leaders: string[] = [];
      const lead = (y: number, to: Pt) => {
        const knee = Math.max(lx + 6, to[0] - Math.abs(to[1] - y));
        leaders.push(`M${f1(lx + 3)} ${f1(y)}H${f1(knee)}L${f1(to[0])} ${f1(to[1])}`);
        svgEl("circle", { class: "ss-lead-end", cx: f1(to[0]), cy: f1(to[1]), r: 2 }, svg);
      };
      const yRest = P(u.x - 1.2, 0, H0)[1];
      const L = STR();
      lab(lx, yRest, L.rest);
      lead(yRest, P(-half + 0.2, 0, H0));
      if (form === "large") {
        const ys = P(u.x - 0.48 - RC, 0, 1.2)[1];
        lab(lx, ys, L.spring);
        lead(ys, P(u.x - 0.48 - RC, 0, 1.2));
        const yd = P(u.x, 0, 0.6)[1] + 12;
        lab(lx, yd, L.damper);
        lead(yd, P(u.x + 0.48, RD, 0.6));
        const yf = P(-half, SLAB_Y, -SLAB / 2)[1];
        lab(lx, yf, L.finger);
        lead(yf, P(-half + 0.6, SLAB_Y, -SLAB / 2));
      }
      svg.insertBefore(svgEl("path", { class: "ss-leader", d: leaders.join("") }, svg), svg.querySelector(".ss-lead-end"));
      // the ball's name, left of it over the row (clear of its rim at any press)
      const bp = P(-8.4, 0, H0 + 2.4);
      const bt = lab(bp[0], bp[1], form === "large" ? L.ballLong : L.ball, "ss-lab ss-lab-ball");
      const bw = bt.getComputedTextLength() || 120;
      if (bp[0] - bw < 4) {
        bt.setAttribute("text-anchor", "start");
        bt.setAttribute("x", "4");
        bt.setAttribute("y", f1(P(0, 0, TOP - 0.6)[1]));
      }
    }
    lastKey = "";
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
      lastKey = "";
      paint();
    }),
  );
  let lastKey = "";
  let lastNum = "";

  const paint = () => {
    const P = cam.P;
    // the ball: its centre over the middle point, its lowest point `press` under the rest line
    const cz = H0 - press + R;
    if (ballBack && ballHi) {
      const c = P(0, 0, cz);
      const r = R * cam.s;
      setAttr(ballBack, "cx", f1(c[0]));
      setAttr(ballBack, "cy", f1(c[1]));
      setAttr(ballBack, "r", f1(r));
      // the highlight: a closed crescent on the upper left
      const out = range(Math.PI * 1.02, Math.PI * 1.5, 12).map((t) => [c[0] + 0.8 * r * Math.cos(t), c[1] + 0.8 * r * Math.sin(t)] as Pt);
      const inn = range(Math.PI * 1.5, Math.PI * 1.02, 12).map((t) => [c[0] + 0.1 * r + 0.72 * r * Math.cos(t), c[1] + 0.1 * r + 0.72 * r * Math.sin(t)] as Pt);
      setAttr(ballHi, "d", pathOf([...out, ...inn]));
    }
    let dRow = "";
    for (const u of units) {
      const k = I0 * 32 + u.j;
      const d = touch.depth[k];
      const f = touch.force[k];
      const zc = H0 - d; // the cap's top
      const zb = zc - CAP_T;
      // the coil: front (y > 0) and back (y < 0) strokes
      const xs = u.x - 0.48;
      let back = "";
      let front = "";
      const N = TURNS * 16;
      let prev: Pt | null = null;
      let prevFront = false;
      for (let q = 0; q <= N; q++) {
        const t = (q / N) * TURNS * 2 * Math.PI;
        const z = 0.05 + ((zb - 0.05) * q) / N;
        const p = P(xs + RC * Math.cos(t), RC * Math.sin(t), z);
        const isFront = Math.sin(t) >= 0;
        if (prev) {
          const seg = `M${f1(prev[0])} ${f1(prev[1])}L${f1(p[0])} ${f1(p[1])}`;
          if (isFront && prevFront) front += seg;
          else back += seg;
        }
        prev = p;
        prevFront = isFront;
      }
      setAttr(u.coilBack, "d", back);
      setAttr(u.coilFront, "d", front);
      const xd = u.x + 0.48;
      const r0 = P(xd, 0, DB);
      const r1 = P(xd, 0, zb);
      setAttr(u.rod, "d", `M${f1(r0[0])} ${f1(r0[1])}L${f1(r1[0])} ${f1(r1[1])}`);
      // the cap: a short amber disc (front band, top)
      const topE = range(0, 2 * Math.PI, 28).map((t) => P(u.x + CAP_R * Math.cos(t), CAP_R * Math.sin(t), zc));
      const band = [...range(0, Math.PI, 14).map((t) => P(u.x + CAP_R * Math.cos(t), CAP_R * Math.sin(t), zc)), ...range(Math.PI, 0, 14).map((t) => P(u.x + CAP_R * Math.cos(t), CAP_R * Math.sin(t), zb))];
      setAttr(u.capSide, "d", pathOf(band));
      setAttr(u.capTop, "d", pathOf(topE));
      const dc = P(u.x, 0, zc);
      setAttr(u.dot, "cx", f1(dc[0]));
      setAttr(u.dot, "cy", f1(dc[1]));
      setAttr(u.dot, "rx", f1(0.22 * cam.s));
      setAttr(u.dot, "ry", f1(0.22 * cam.s * cam.SE));
      setAttr(u.dot, "class", d > 0 ? "ss-dot is-touched" : "ss-dot");
      if (u.j === J0 && mid) {
        setAttr(mid, "cx", f1(dc[0]));
        setAttr(mid, "cy", f1(dc[1]));
        setAttr(mid, "rx", f1(0.5 * cam.s));
        setAttr(mid, "ry", f1(0.5 * cam.s * cam.SE + 1));
      }
      // the arrow: straight up out of the pad, from the cap's top, as long as the force
      const L = f * ARROW_K;
      if (L * cam.s > 6) {
        const a0 = P(u.x, 0, zc + 0.08);
        const a1 = P(u.x, 0, zc + 0.08 + L);
        // the head grows with the arrow (a short arrow is a short arrow, not a diamond)
        const hs = Math.min(6, 0.42 * L * cam.s);
        const d0 = `M${f1(a0[0])} ${f1(a0[1])}L${f1(a1[0])} ${f1(a1[1] + hs * 0.6)}`;
        const head = `M${f1(a1[0] - hs * 0.62)} ${f1(a1[1] + hs)}L${f1(a1[0])} ${f1(a1[1])}L${f1(a1[0] + hs * 0.62)} ${f1(a1[1] + hs)}Z`;
        setAttr(u.arrow, "d", d0 + head);
        setAttr(u.arrowHalo, "d", d0 + head);
      } else {
        setAttr(u.arrow, "d", "");
        setAttr(u.arrowHalo, "d", "");
      }
      const dt = d > 0 ? d.toFixed(2) : "0";
      const ft = f > 0.0049 ? f.toFixed(2) : "0";
      if (u.dTxt.textContent !== dt) u.dTxt.textContent = dt;
      if (u.fTxt.textContent !== ft) u.fTxt.textContent = ft;
      setAttr(u.dTxt, "class", `ss-val${d > 0 ? " is-on" : ""}${u.j === J0 ? " is-mid" : ""}`);
      setAttr(u.fTxt, "class", `ss-val ss-val-f${f > 0.0049 ? " is-on" : ""}${u.j === J0 ? " is-mid" : ""}`);
      dRow += dt;
    }
    // the readout: the middle point
    const d = touch.depth[K0];
    const rate = touch.rate[K0];
    const fs = KN * d;
    const fd = KD * rate;
    const f = touch.force[K0];
    const T = STR();
    const num = `= ${KN} × ${fmt2(d)} ${sgn(fd)} ${KD} × ${fmtRate(Math.abs(rate))} = <b>${fmt2(f)} N</b>${fs + fd < -0.0049 ? ` <span class="ss-clip">${T.clip}</span>` : ""}`;
    if (num !== lastNum) {
      lastNum = num;
      numEl.innerHTML = num;
      partsEl.innerHTML = `<span class="ss-ps">${fill(T.partS, { v: fmt2(fs) })}</span> <span class="ss-pd">${fill(T.partD, { v: `${sgn(fd)}${fmt2(Math.abs(fd))}` })}</span>`;
      totEl.innerHTML = fill(T.tot, { n: touch.total.toFixed(1), c: touch.count, s: touch.count === 1 ? "" : T.plural });
      anim.setAttribute("aria-valuenow", press.toFixed(2));
      anim.setAttribute("aria-valuetext", fill(T.valuetext, { p: Math.max(0, press).toFixed(2), f: fmt2(f), t: touch.total.toFixed(1) }));
    }
    // the bar: spring's part (solid) and the damper's (striped), out of 1 N
    const sw = clamp01(fs / FORCE_SCALE) * 100;
    const dw = (Math.max(-fs, fd) / FORCE_SCALE) * 100;
    barS.style.width = `${Math.max(0, fd < 0 ? sw + dw : sw).toFixed(1)}%`;
    barD.style.width = `${Math.abs(dw).toFixed(1)}%`;
    barD.classList.toggle("is-neg", fd < 0);
    // the maps
    const key = dRow + "|" + touch.total.toFixed(3);
    if (key !== lastKey) {
      lastKey = key;
      const n = units.length;
      const box = (g: CanvasRenderingContext2D, c: number) => {
        g.strokeStyle = inkCss;
        g.lineWidth = 1.5;
        g.strokeRect((J0 - (n - 1) / 2) * c + 0.25, I0 * c + 0.25, n * c + 0.5, c + 0.5);
      };
      mapD.paint((q) => lut[Math.round(255 * clamp01(touch.depth[q] / DEPTH_SCALE))], gapCss, box);
      mapF.paint((q) => lut[Math.round(255 * clamp01(touch.force[q] / FORCE_SCALE))], gapCss, box);
    }
  };

  // ------------------------------------------------------------------ motion
  let visible = !document.hidden;
  let onscreen = true;
  let raf = 0;
  let last = 0;
  let resumeT = 0;
  const holds = new Set<string>();
  /** a press set by hand (pointer / keys), eased toward in real time */
  let handTo: number | null = null;
  const tick = (now: number) => {
    raf = 0;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (holds.size || handTo !== null || waiting) {
      if (handTo !== null) {
        const e = 1 - Math.exp(-dt / (releasing ? 0.25 : 0.06));
        stepTo(lerp(press, handTo, e), Math.max(1e-3, dt));
        // handing back to the tour: once the ball has eased up to rest, the tour carries on from its rest
        if (releasing && Math.abs(press - handTo) < 0.005) {
          releasing = false;
          handTo = null;
          tourT = TOURS[mode].inT + TOURS[mode].hold + TOURS[mode].outT;
        }
      }
    } else if (playing) {
      const ds = dt / TOURS[mode].slow;
      tourT += ds;
      stepTo(tourDepth(mode, tourT), Math.max(1e-4, ds));
    }
    paint();
    run();
  };
  function run() {
    const want = !reduced && visible && onscreen;
    if (want && !raf) {
      if (!last || performance.now() - last > 100) last = performance.now();
      raf = requestAnimationFrame(tick);
    } else if (!want && raf) {
      cancelAnimationFrame(raf);
      raf = 0;
      last = 0;
    }
  }
  /** after the learner lets go the tour waits RESUME_MS, then the ball eases up to rest and the tour carries on */
  let waiting = false;
  let releasing = false;
  const holdOn = (why: string) => {
    holds.add(why);
    waiting = true;
    releasing = false;
    clearTimeout(resumeT);
  };
  const unhold = (why: string) => {
    if (!holds.delete(why) || holds.size || reduced) return;
    clearTimeout(resumeT);
    resumeT = window.setTimeout(() => {
      if (holds.size) return;
      waiting = false;
      if (handTo !== null || press > 0.005) {
        handTo = 0;
        releasing = true;
      } else tourT = TOURS[mode].inT + TOURS[mode].hold + TOURS[mode].outT;
    }, RESUME_MS);
  };
  const setPlaying = (on: boolean) => {
    playing = on && !reduced;
    paintPlay();
  };
  function paintPlay() {
    const T = STR();
    playBtn.innerHTML = `${playing ? ICON_PAUSE : ICON_PLAY}<span class="sp-btn-t">${playing ? T.pause : T.play}</span>`;
    playBtn.setAttribute("aria-label", playing ? T.pauseAria : T.playAria);
  }
  const setMode = (m: Mode) => {
    mode = m;
    for (const b of modeBtns) b.setAttribute("aria-pressed", String(b.dataset.mode === m));
    root.dataset.mode = m;
    handTo = null;
    releasing = false;
    waiting = false;
    if (!reduced) {
      seekTour(0);
      if (!playing) setPlaying(true);
    } else if (m === "tap") seekTour(0.045);
    else hold(FIRM);
    paint();
  };

  // pointer: drag up / down (the ball's lowest point follows the pointer: below the rest line = pressing)
  let dragging = false;
  const depthAt = (e: PointerEvent) => {
    const b = svg.getBoundingClientRect();
    const vb = svg.viewBox.baseVal;
    const Y = ((e.clientY - b.top) / b.height) * vb.height;
    const yRest = cam.P(0, 0, H0)[1];
    return Math.max(-0.8, Math.min(D_MAX, (Y - yRest) / (cam.s * cam.CE)));
  };
  const drive = (d: number) => {
    if (reduced) hold(d);
    else handTo = d;
    paint();
  };
  svg.addEventListener("pointerenter", (e) => {
    if (e.pointerType !== "touch") holdOn("pointer");
  });
  svg.addEventListener("pointerdown", (e) => {
    holdOn("pointer");
    dragging = true;
    try {
      svg.setPointerCapture(e.pointerId);
    } catch {
      /* optional */
    }
    drive(depthAt(e));
  });
  svg.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    drive(depthAt(e));
  });
  const up = (e: PointerEvent) => {
    dragging = false;
    const b = svg.getBoundingClientRect();
    const inside = e.clientX >= b.left && e.clientX <= b.right && e.clientY >= b.top && e.clientY <= b.bottom;
    if (e.pointerType === "touch" || !inside) unhold("pointer");
  };
  svg.addEventListener("pointerup", up);
  svg.addEventListener("pointercancel", up);
  svg.addEventListener("pointerleave", () => {
    if (!dragging) unhold("pointer");
  });
  anim.addEventListener("keydown", (e) => {
    const base = handTo ?? press;
    const to =
      e.key === "ArrowDown" ? base + 0.1
      : e.key === "ArrowUp" ? base - 0.1
      : e.key === "PageDown" ? base + 0.5
      : e.key === "PageUp" ? base - 0.5
      : e.key === "Home" ? 0
      : e.key === "End" ? D_MAX
      : null;
    if (to === null) return;
    e.preventDefault();
    holdOn("key");
    drive(Math.max(-0.5, Math.min(D_MAX, Math.round(to * 10) / 10)));
  });
  anim.addEventListener("focus", () => {
    if (anim.matches(":focus-visible")) holdOn("key");
  });
  anim.addEventListener("blur", () => unhold("key"));
  playBtn.addEventListener("click", () => {
    setPlaying(!playing);
    if (playing) {
      handTo = null;
      releasing = false;
      waiting = false;
      holds.clear();
    }
  });
  modeBtns.forEach((b) => b.addEventListener("click", () => setMode(b.dataset.mode as Mode)));

  // ------------------------------------------------------------------ layout
  const relayout = () => {
    if (!root.isConnected) return;
    let W = Math.round(anim.getBoundingClientRect().width);
    if (W < 60) return;
    const maxH = Number(root.closest<HTMLElement>("[data-max-h]")?.dataset.maxH) || 0;
    const compact = Boolean(root.closest("[data-compact]"));
    // the side form (a phone on its side, sim-points.ts sideForm): the drawing left; the readout and the two maps right
    const cardW = root.clientWidth;
    const sideOn = sideForm(maxH, cardW);
    const key = `${W} ${maxH} ${compact} ${sideOn} ${sideOn ? `${cardW}x${window.innerHeight}` : ""}`;
    if (key === builtKey) return;
    builtKey = key;
    root.toggleAttribute("data-side", sideOn);
    let colW = 0;
    if (sideOn) {
      const cs = getComputedStyle(root);
      const inner = cardW - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      colW = Math.floor((inner - 16) * 0.48);
      W = Math.floor(inner - 16 - colW);
      root.style.setProperty("--ss-col", `${colW}px`);
    }
    form = W >= 470 ? "large" : W >= 300 ? "medium" : "mini";
    root.dataset.form = form;
    // the two maps side by side: each half the width (the side form: its column's) less the gap
    const mw = ((sideOn ? colW : W) - 14) / 2;
    const cell = Math.max(3, Math.min(12, Math.floor((mw - 1) / 32)));
    mapD.size(cell);
    mapF.size(cell);
    root.style.setProperty("--ss-mapw", `${mapD.width}px`);
    build(W, 0);
    paint();
    // (the side form: no taller than the window)
    const budget = maxH || (sideOn ? window.innerHeight - 24 : 0);
    if (budget) {
      const card = root.closest<HTMLElement>(".demo-card") ?? el;
      const over = card.offsetHeight - budget;
      if (over > 0) {
        build(W, Math.max(sideOn ? 100 : 120, anim.offsetHeight - over));
        paint();
      }
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

  // a language switch: the words, the play button, and the drawing built again with its labels in the new language
  // (the tour, the press and the mode carry on)
  const offLang = ctx.onLang(() => {
    paintText(root, STR(), V);
    setTextBeside(root.querySelector(".ss-keys-drag > .ss-slow"), STR().drag, true);
    paintPlay();
    lastNum = "";
    builtKey = "";
    relayout();
    paint();
  });

  root.dataset.mode = mode;
  setPlaying(playing);
  run();

  return {
    layout() {
      builtKey = "";
      relayout();
    },
    view(v) {
      if (v && (v.mode === "slow" || v.mode === "tap")) setMode(v.mode);
    },
    destroy() {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      clearTimeout(resumeT);
      ro.disconnect();
      io.disconnect();
      offTheme();
      offLang();
      window.removeEventListener("resize", onWin);
      document.removeEventListener("visibilitychange", onVis);
      root.remove();
    },
    play: () => {
      handTo = null;
      releasing = false;
      waiting = false;
      setPlaying(true);
    },
    pause: () => setPlaying(false),
    seek(t, m) {
      setPlaying(false);
      handTo = null;
      if (m && m !== mode) {
        mode = m;
        for (const b of modeBtns) b.setAttribute("aria-pressed", String(b.dataset.mode === m));
        root.dataset.mode = m;
      }
      seekTour(t);
      paint();
    },
    press(depth) {
      setPlaying(false);
      handTo = null;
      hold(depth);
      paint();
    },
    state: () => ({
      mode,
      playing,
      press,
      d: touch.depth[K0],
      rate: touch.rate[K0],
      f: touch.force[K0],
      spring: KN * touch.depth[K0],
      damper: KD * touch.rate[K0],
      total: touch.total,
      count: touch.count,
      t: tourT,
    }),
  };
}
