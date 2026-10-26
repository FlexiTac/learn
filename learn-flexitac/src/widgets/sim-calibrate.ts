// Make sim feel real: the content of Lesson 3.4's card, VT-Refine's calibration (VT-Refine §5.1, App. C.1) in three
// moves, all on the shared touch engine (@shared/models/touchsim.mjs):
//   (1) THE CURVE: one taxel pressed in 1.3 mm and let go (0.3 s, steady speed), its reading in newtons against how far
//       it is pressed in. The real pad's curve is ILLUSTRATIVE (touchsim illustrativeCurve(): no measured DMA data was
//       supplied, D8): dots, a little noisy, softly saturating, and higher on the way in than on the way out (a loop).
//       The sim's curve is the engine's spring and damper, f = k_n d + k_d d' (modelForce on the same press): a line.
//   (2) THE KNOBS: k_n (the spring: stiffer = a steeper line) and k_d (the damper: pushes back more while the press
//       moves = a wider loop) as sliders, and "Fit": the least-squares fit of both (touchsim fitKnKd, VT-Refine's
//       "iteratively tune k_n and k_d until the curves match"), which eases the sliders there. The gap between the
//       curves (root-mean-square, N) is shown live.
//   (3) THE CHECK: 28 presses (a fingertip, balls, rods, a tilted block, a strawberry; spots and depths spread
//       evenly over the pad) of 36 frames each at 100 Hz, read twice with the SAME rule (subtract the threshold, divide
//       by the frame's largest reading, or by the fixed noise scale when the frame is quiet): once as the real pad
//       (touchsim Readout "real": the stand-in pad below, bytes, noise, a baseline from 30 resting frames) and once
//       as the sim pad with the sliders' k_n / k_d (Readout "sim"). Two histograms of the touched taxels' readings
//       (0..1, ten bins): the real one as grey bars, the sim one as an outline, and their overlap (the share they
//       have in common). Off, they disagree; fitted, they overlap (~96 %), as in VT-Refine's Fig. 4.
// The stand-in real pad: the hidden settings behind touchsim's illustrativeCurve (k_n 0.61 N/mm, k_d 0.0123 N·s/mm,
// a soft saturation at 3 N per taxel; REAL_PAD below), so the curve and the frames tell the same story.
// Start: k_n 0.25, k_d 0 (a sim pad that is too soft and has no damper). Interaction: the sliders (keyboard too),
// Fit, Reset. Reduced motion: Fit jumps. view({focus: "curve" | "hist" | null, kn, kd, fit: true}) for the guided steps.
// Layout: the two charts share the height the card's budget leaves (layout(maxH) / fit(maxH), else the card's px
// max-height, else ~1.05 x the width); a short budget drops the closing sentence, then the rule line.
import {
  READOUT,
  createReadout,
  createTouch,
  curveRmse,
  cylinder,
  fingertip,
  fitKnKd,
  illustrativeCurve,
  makePad,
  modelForce,
  pressOnto,
  rotX,
  rotY,
  sphere,
  strawberry,
  box as tsBox,
} from "@shared/models/touchsim.mjs";
import type { Shape } from "@shared/models/touchsim.mjs";
import type { WidgetCtx, WidgetInstance } from "../types";
import { h } from "../ui/dom";
import "./sim-calibrate.css";

// ------------------------------------------------------------------ numbers
/** The stand-in real pad (illustrative): touchsim's illustrativeCurve() is this pad's press curve plus a little noise. */
const REAL_PAD = { kn: 0.61, kd: 0.0123, fSat: 3 };
/** Where the sim starts: too soft, no damper. */
const START = { kn: 0.25, kd: 0 };
const KN = { min: 0.2, max: 1, step: 0.01 };
const KD = { min: 0, max: 0.04, step: 0.0005 };
/** The curve chart's ranges (fixed, so the axes never jump): depth 0..1.3 mm, reading 0..1.2 N. */
const XMAX = 1.3;
const YMAX = 1.2;
/** The histogram: ten bins over 0..1, the share axis 0..40 % (a taller bar is clipped, its value written on it). */
const BINS = 10;
const HMAX = 0.4;
const FIT_MS = 900;
const fmtKn = (v: number) => v.toFixed(2);
const fmtKd = (v: number) => v.toFixed(3);
const pct = (v: number) => `${Math.round(v * 100)}%`;
const clampN = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
const ease = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const f1 = (v: number) => String(Math.round(v * 10) / 10);

// ------------------------------------------------------------------ the presses (geometry only: depth and rate per frame)
type Frame = { k: Int16Array; d: Float32Array; r: Float32Array };
const PRESSES = 28;
const FRAMES_IN = 14;
const FRAMES_HOLD = 8;
const FRAMES_OUT = 14;
const DT = 0.01;
function makeFrames(): Frame[] {
  const makers: (() => Shape)[] = [
    () => fingertip(),
    () => sphere({ radius: 14 }),
    () => cylinder({ radius: 6, length: 40, axis: "y" }),
    () => strawberry({ length: 34, width: 28, pose: { rot: rotX(Math.PI / 2) } }),
    () => tsBox({ size: [16, 16, 16], round: 3, pose: { rot: rotY(0.7) } }),
    () => cylinder({ radius: 9, length: 50, axis: "x" }),
    () => sphere({ radius: 10 }),
  ];
  const pad = makePad();
  const touch = createTouch({ pad, kn: 1, kd: 0 });
  const out: Frame[] = [];
  for (let q = 0; q < PRESSES; q++) {
    // spots and depths spread evenly (low-discrepancy steps), so every run gives the same 28 presses
    const g1 = (q * 0.6180339887 + 0.13) % 1;
    const g2 = (q * 0.7548776662 + 0.41) % 1;
    const g3 = (q * 0.569840291 + 0.27) % 1;
    const a = -24 + 48 * g1;
    const b = -5 + 10 * g2;
    const dMax = 0.6 + g3;
    const shape = makers[q % makers.length]();
    touch.reset();
    const prof: number[] = [];
    for (let m = 0; m < FRAMES_IN; m++) prof.push(-0.4 + ((dMax + 0.4) * m) / (FRAMES_IN - 1));
    for (let m = 0; m < FRAMES_HOLD; m++) prof.push(dMax);
    for (let m = 0; m < FRAMES_OUT; m++) prof.push(dMax - ((dMax + 0.4) * (m + 1)) / FRAMES_OUT);
    for (const depth of prof) {
      pressOnto(shape, pad, { a, b, depth });
      touch.step([shape], DT);
      const ks: number[] = [];
      for (let k = 0; k < pad.n; k++) if (touch.depth[k] > 0) ks.push(k);
      const fr: Frame = { k: Int16Array.from(ks), d: new Float32Array(ks.length), r: new Float32Array(ks.length) };
      ks.forEach((k, i) => {
        fr.d[i] = touch.depth[k];
        fr.r[i] = touch.rate[k];
      });
      out.push(fr);
    }
  }
  return out;
}

/** The touched taxels' readings, binned: shares per bin (sum 1), how many readings, how many quiet frames. */
function histogram(frames: Frame[], kn: number, kd: number, style: "real" | "sim") {
  const ro =
    style === "real"
      ? createReadout({ style: "real", seed: 5, response: (f: number) => READOUT.countsPerN * REAL_PAD.fSat * Math.tanh(f / REAL_PAD.fSat) })
      : createReadout({ style: "sim" });
  const force = new Float32Array(ro.n);
  const bins = new Array<number>(BINS).fill(0);
  let n = 0;
  let quiet = 0;
  for (const fr of frames) {
    force.fill(0);
    for (let i = 0; i < fr.k.length; i++) {
      const f = kn * fr.d[i] + kd * fr.r[i];
      force[fr.k[i]] = f > 0 ? f : 0;
    }
    ro.read(force);
    if (ro.quiet) quiet++;
    const v = ro.norm;
    for (let k = 0; k < v.length; k++)
      if (v[k] > 0) {
        bins[Math.min(BINS - 1, Math.floor(v[k] * BINS))]++;
        n++;
      }
  }
  return { share: bins.map((b) => (n ? b / n : 0)), n, quiet };
}
const overlapOf = (a: number[], b: number[]) => a.reduce((s, v, i) => s + Math.min(v, b[i]), 0);

// ------------------------------------------------------------------ the widget
type Focus = "curve" | "hist" | null;
export interface SimCalibrateState {
  kn: number;
  kd: number;
  /** The curves' root-mean-square gap (N). */
  rmse: number;
  /** The histograms' overlap, 0..1 (null until the frames are read). */
  overlap: number | null;
  fit: { kn: number; kd: number; rmse: number };
  focus: Focus;
  form: "large" | "medium";
}
export interface SimCalibrateInstance extends WidgetInstance {
  layout(maxH?: number): void;
  fit(maxH: number | null): void;
  /** focus: dim the other chart; kn / kd: set the sliders; fit: ease to the fit (as the button). */
  view(v?: { focus?: Focus; kn?: number; kd?: number; fit?: boolean; reset?: boolean }): void;
  state(): SimCalibrateState;
}

const ILL_TIP = "Illustrative: no measured force data for FlexiTac. The real curve and the real-style frames are a stand-in pad from the course's touch model; the method is VT-Refine's.";

let seq = 0;

export function mount(el: HTMLElement, ctx: WidgetCtx): SimCalibrateInstance {
  const reduced = ctx.reducedMotion();
  const uid = `sc${++seq}`;
  const real = illustrativeCurve();
  const best = fitKnKd(real);
  const root = h("div", { class: "sc" });
  root.innerHTML = `
    <p class="sc-kicker mono"><i class="sc-mark" aria-hidden="true"></i><span class="sc-name">Make sim feel real</span><span class="sc-sep" aria-hidden="true">·</span><span class="sc-ill" title="${ILL_TIP}">Illustrative</span></p>
    <p class="sc-title">Make the sim pad read like the real one</p>
    <section class="sc-panel sc-p-curve" aria-labelledby="${uid}-c">
      <div class="sc-ph"><p class="sc-pt" id="${uid}-c"><span class="sc-step">1</span>Press one taxel in, then let go</p><p class="sc-legend mono"><span><i class="sc-k sc-k-real" aria-hidden="true"></i>real pad</span><span><i class="sc-k sc-k-sim" aria-hidden="true"></i>sim</span></p></div>
      <svg class="sc-svg sc-csvg" role="img" aria-label="Force reading against how far the taxel is pressed in: the real pad's dots and the sim's line"></svg>
    </section>
    <div class="sc-ctl">
      <label class="sc-sl"><span class="sc-sl-h"><span class="sc-sl-n"><b>k<sub>n</sub></b> spring</span><output class="sc-v sc-v-kn mono"></output></span>
        <input type="range" class="sc-r sc-r-kn" min="${KN.min}" max="${KN.max}" step="${KN.step}" aria-describedby="${uid}-hn" />
        <span class="sc-hint" id="${uid}-hn">stiffer → steeper line</span></label>
      <label class="sc-sl"><span class="sc-sl-h"><span class="sc-sl-n"><b>k<sub>d</sub></b> damper</span><output class="sc-v sc-v-kd mono"></output></span>
        <input type="range" class="sc-r sc-r-kd" min="${KD.min}" max="${KD.max}" step="${KD.step}" aria-describedby="${uid}-hd" />
        <span class="sc-hint" id="${uid}-hd">more → wider loop (in vs out)</span></label>
      <div class="sc-act">
        <button type="button" class="sc-btn sc-btn-fit">Fit</button>
        <button type="button" class="sc-btn sc-btn-reset">Reset</button>
        <p class="sc-gap mono" aria-live="polite">curve gap <b class="sc-gap-v"></b> <span class="sc-tag"></span></p>
      </div>
    </div>
    <section class="sc-panel sc-p-hist" aria-labelledby="${uid}-h">
      <div class="sc-ph"><p class="sc-pt" id="${uid}-h"><span class="sc-step">2</span><span>Readings<span class="sc-long"> from ${PRESSES} presses</span></span></p><p class="sc-legend mono"><span><i class="sc-k sc-k-bar" aria-hidden="true"></i>real</span><span><i class="sc-k sc-k-out" aria-hidden="true"></i>sim</span><span class="sc-ov">overlap <b class="sc-ov-v">…</b></span></p></div>
      <svg class="sc-svg sc-hsvg" role="img" aria-label="Histograms of the normalised readings of the real pad and the sim pad"></svg>
      <p class="sc-rule">Same rule on both sides: subtract the threshold, then divide by the frame's peak (by a fixed ${READOUT.noiseScale} when the touch is light).</p>
    </section>
    <p class="sc-line demo-extra">VT-Refine tuned just these two numbers until its simulated pad matched a measured one; after that, the readings a robot sees in sim and on the real pad look alike.</p>`;
  el.append(root);
  const csvg = root.querySelector<SVGSVGElement>(".sc-csvg")!;
  const hsvg = root.querySelector<SVGSVGElement>(".sc-hsvg")!;
  const rKn = root.querySelector<HTMLInputElement>(".sc-r-kn")!;
  const rKd = root.querySelector<HTMLInputElement>(".sc-r-kd")!;
  const vKn = root.querySelector<HTMLOutputElement>(".sc-v-kn")!;
  const vKd = root.querySelector<HTMLOutputElement>(".sc-v-kd")!;
  const gapV = root.querySelector<HTMLElement>(".sc-gap-v")!;
  const gapTag = root.querySelector<HTMLElement>(".sc-tag")!;
  const ovV = root.querySelector<HTMLElement>(".sc-ov-v")!;
  const fitBtn = root.querySelector<HTMLButtonElement>(".sc-btn-fit")!;
  const resetBtn = root.querySelector<HTMLButtonElement>(".sc-btn-reset")!;

  let kn = START.kn;
  let kd = START.kd;
  let focus: Focus = null;
  let fixedMax: number | null = null;
  let form: SimCalibrateState["form"] = "large";
  let frames: Frame[] | null = null;
  let realHist: ReturnType<typeof histogram> | null = null;
  let simHist: ReturnType<typeof histogram> | null = null;
  let overlap: number | null = null;
  const simForce = new Float64Array(real.depth.length);

  // ------------------------------------------------------------------ the curve chart
  type Plot = { W: number; H: number; x0: number; x1: number; y0: number; y1: number };
  let CP: Plot | null = null;
  let HP: Plot | null = null;
  const X = (p: Plot, v: number) => p.x0 + ((p.x1 - p.x0) * v) / XMAX;
  const Y = (p: Plot, v: number) => p.y1 - ((p.y1 - p.y0) * v) / YMAX;
  let simPath: SVGPathElement | null = null;
  let simLab: SVGTextElement | null = null;

  const buildCurve = (W: number, H: number) => {
    const p: Plot = { W, H, x0: 40, x1: W - 10, y0: 10, y1: H - 26 };
    CP = p;
    csvg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    csvg.setAttribute("width", String(W));
    csvg.setAttribute("height", String(H));
    let s = `<defs><clipPath id="${uid}-cl"><rect x="${p.x0}" y="${p.y0 - 2}" width="${p.x1 - p.x0 + 2}" height="${p.y1 - p.y0 + 2}"/></clipPath></defs>`;
    for (const v of [0, 0.4, 0.8, 1.2]) {
      const y = f1(Y(p, v));
      s += `<path class="sc-grid" d="M${p.x0} ${y}H${p.x1}"/><text class="sc-tick" x="${p.x0 - 6}" y="${y}" text-anchor="end" dominant-baseline="middle">${v === 1.2 ? "1.2 N" : v.toFixed(1).replace(/\.0$/, "")}</text>`;
    }
    for (const v of [0, 0.5, 1]) {
      const x = f1(X(p, v));
      s += `<path class="sc-grid sc-grid-x" d="M${x} ${p.y0}V${p.y1}"/><text class="sc-tick" x="${x}" y="${p.y1 + 15}" text-anchor="middle">${v === 0 ? "0" : v === 1 ? "1.0 mm" : v.toFixed(1)}</text>`;
    }
    // the x axis' name, inside the plot's bottom-right corner (no curve ever reaches it: deep presses read high)
    s += `<text class="sc-blab sc-axis" x="${f1(p.x1 - 3)}" y="${f1(p.y1 - 6)}" text-anchor="end">pressed in →</text>`;
    s += `<path class="sc-base" d="M${p.x0} ${p.y1}H${p.x1}"/>`;
    // the real pad: dots every 4th sample (both branches), then its two branches named
    let dots = "";
    for (let m = 0; m < real.depth.length; m += 4) dots += `<circle class="sc-dot" cx="${f1(X(p, real.depth[m]))}" cy="${f1(Y(p, real.force[m]))}" r="3.4"/>`;
    s += `<g class="sc-dots">${dots}</g>`;
    // branch labels at 0.75 mm: "in" over the loading branch, "out" under the unloading one
    const n = real.depth.length;
    const near = (load: boolean, at: number) => {
      let bi = 0;
      let bd = Infinity;
      for (let m = 0; m < n; m++)
        if (Boolean(real.loading[m]) === load && Math.abs(real.depth[m] - at) < bd) {
          bd = Math.abs(real.depth[m] - at);
          bi = m;
        }
      return bi;
    };
    const mi = near(true, 0.75);
    const mo = near(false, 0.55);
    // (the labels sit over the sim's line, with a halo: the line moves under them)
    s += `<path class="sc-sim" clip-path="url(#${uid}-cl)"/>`;
    s += `<text class="sc-blab" x="${f1(X(p, real.depth[mi]) - 6)}" y="${f1(Y(p, real.force[mi]) - 10)}" text-anchor="end">pressing in ↗</text>`;
    s += `<text class="sc-blab" x="${f1(X(p, real.depth[mo]) + 8)}" y="${f1(Y(p, real.force[mo]) + 18)}">letting go ↙</text>`;
    s += `<text class="sc-dlab sc-dlab-sim"></text>`;
    csvg.innerHTML = s;
    simPath = csvg.querySelector(".sc-sim");
    simLab = csvg.querySelector(".sc-dlab-sim");
  };
  const drawCurve = () => {
    const p = CP;
    if (!p || !simPath || !simLab) return;
    modelForce(real, kn, kd, simForce);
    let d = "";
    for (let m = 0; m < simForce.length; m++) d += `${m ? "L" : "M"}${f1(X(p, real.depth[m]))} ${f1(Y(p, simForce[m]))}`;
    simPath.setAttribute("d", d);
    // its direct label at the turn (the deepest point), kept inside the plot
    const top = simForce[(simForce.length - 1) / 2];
    const yl = clampN(Y(p, top), p.y0 + 10, p.y1 - 6);
    simLab.setAttribute("x", f1(X(p, XMAX) - 4));
    simLab.setAttribute("y", f1(yl - 8));
    simLab.setAttribute("text-anchor", "end");
    simLab.textContent = top > YMAX ? "sim ↑" : "sim";
  };

  // ------------------------------------------------------------------ the histogram
  const buildHist = (W: number, H: number) => {
    const p: Plot = { W, H, x0: 40, x1: W - 10, y0: 8, y1: H - 22 };
    HP = p;
    hsvg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    hsvg.setAttribute("width", String(W));
    hsvg.setAttribute("height", String(H));
    const hy = (v: number) => p.y1 - ((p.y1 - p.y0) * v) / HMAX;
    let s = "";
    for (const v of [0, 0.2, 0.4]) {
      const y = f1(hy(v));
      s += `<path class="sc-grid" d="M${p.x0} ${y}H${p.x1}"/><text class="sc-tick" x="${p.x0 - 6}" y="${y}" text-anchor="end" dominant-baseline="middle">${v ? pct(v) : "0"}</text>`;
    }
    for (const v of [0, 0.5, 1]) s += `<text class="sc-tick" x="${f1(p.x0 + (p.x1 - p.x0) * v)}" y="${p.y1 + 15}" text-anchor="${v === 0 ? "start" : v === 1 ? "end" : "middle"}">${v === 1 ? "1 = the frame's peak" : v}</text>`;
    s += `<g class="sc-bars"></g><path class="sc-base" d="M${p.x0} ${p.y1}H${p.x1}"/><path class="sc-out"/><g class="sc-hits"></g>`;
    hsvg.innerHTML = s;
  };
  const drawHist = () => {
    const p = HP;
    if (!p) return;
    const bars = hsvg.querySelector(".sc-bars")!;
    const out = hsvg.querySelector(".sc-out")!;
    const hits = hsvg.querySelector(".sc-hits")!;
    if (!realHist || !simHist) {
      bars.innerHTML = "";
      out.setAttribute("d", "");
      return;
    }
    const bw = (p.x1 - p.x0) / BINS;
    const hy = (v: number) => p.y1 - ((p.y1 - p.y0) * Math.min(v, HMAX)) / HMAX;
    let b = "";
    let hit = "";
    for (let i = 0; i < BINS; i++) {
      const v = realHist.share[i];
      const x = p.x0 + i * bw + 1;
      const y = hy(v);
      const hgt = p.y1 - y;
      if (hgt > 0.5) b += `<path class="sc-bar" d="M${f1(x)} ${f1(p.y1)}V${f1(y + Math.min(3, hgt))}Q${f1(x)} ${f1(y)} ${f1(x + Math.min(3, hgt))} ${f1(y)}H${f1(x + bw - 2 - Math.min(3, hgt))}Q${f1(x + bw - 2)} ${f1(y)} ${f1(x + bw - 2)} ${f1(y + Math.min(3, hgt))}V${f1(p.y1)}Z"/>`;
      if (v > HMAX) b += `<text class="sc-over" x="${f1(x + bw / 2 - 1)}" y="${f1(p.y0 + 10)}" text-anchor="middle">${pct(v)}</text>`;
      const lo = (i / BINS).toFixed(1);
      const hi = ((i + 1) / BINS).toFixed(1);
      hit += `<rect x="${f1(p.x0 + i * bw)}" y="${p.y0}" width="${f1(bw)}" height="${f1(p.y1 - p.y0)}"><title>${lo}–${hi}: real ${pct(v)}, sim ${pct(simHist.share[i])}</title></rect>`;
    }
    bars.innerHTML = b;
    hits.innerHTML = hit;
    // the sim: one outline over its bins (a step line)
    let d = `M${f1(p.x0)} ${f1(p.y1)}`;
    for (let i = 0; i < BINS; i++) {
      const y = hy(simHist.share[i]);
      d += `V${f1(y)}H${f1(p.x0 + (i + 1) * bw)}`;
    }
    d += `V${f1(p.y1)}`;
    out.setAttribute("d", d);
  };

  // ------------------------------------------------------------------ state -> view
  let histRaf = 0;
  const update = (histNow = false) => {
    rKn.value = String(kn);
    rKd.value = String(kd);
    vKn.textContent = `${fmtKn(kn)} N/mm`;
    vKd.textContent = `${fmtKd(kd)} N·s/mm`;
    rKn.setAttribute("aria-valuetext", `${fmtKn(kn)} newtons per millimetre`);
    rKd.setAttribute("aria-valuetext", `${fmtKd(kd)} newton seconds per millimetre`);
    drawCurve();
    const gap = curveRmse(simForce, real.force);
    gapV.textContent = `${gap.toFixed(3)} N`;
    const tag = gap < 0.02 ? "match" : gap < 0.06 ? "close" : "far apart";
    gapTag.textContent = tag;
    gapTag.dataset.tag = tag === "match" ? "ok" : tag === "close" ? "near" : "off";
    const doHist = () => {
      histRaf = 0;
      if (!frames || !realHist) return;
      simHist = histogram(frames, kn, kd, "sim");
      overlap = overlapOf(realHist.share, simHist.share);
      ovV.textContent = pct(overlap);
      drawHist();
    };
    if (histNow) doHist();
    else if (!histRaf) histRaf = requestAnimationFrame(doHist);
  };

  // the frames: read once, after the first paint (the real pad's bytes take a moment)
  let framesTimer = window.setTimeout(() => {
    framesTimer = 0;
    frames = makeFrames();
    realHist = histogram(frames, REAL_PAD.kn, REAL_PAD.kd, "real");
    update(true);
  }, 0);

  // ------------------------------------------------------------------ controls
  let anim = 0;
  const stopAnim = () => {
    if (anim) cancelAnimationFrame(anim);
    anim = 0;
  };
  const easeTo = (tKn: number, tKd: number) => {
    stopAnim();
    if (reduced) {
      kn = tKn;
      kd = tKd;
      update(true);
      return;
    }
    const a = { kn, kd };
    const t0 = performance.now();
    const stepF = (now: number) => {
      const u = ease((now - t0) / FIT_MS);
      kn = a.kn + (tKn - a.kn) * u;
      kd = a.kd + (tKd - a.kd) * u;
      update();
      anim = u < 1 ? requestAnimationFrame(stepF) : 0;
    };
    anim = requestAnimationFrame(stepF);
  };
  rKn.addEventListener("input", () => {
    stopAnim();
    kn = clampN(Number(rKn.value), KN.min, KN.max);
    update();
  });
  rKd.addEventListener("input", () => {
    stopAnim();
    kd = clampN(Number(rKd.value), KD.min, KD.max);
    update();
  });
  fitBtn.addEventListener("click", () => easeTo(best.kn, best.kd));
  resetBtn.addEventListener("click", () => easeTo(START.kn, START.kd));
  const setFocus = (f: Focus) => {
    focus = f;
    if (f) root.dataset.focus = f;
    else delete root.dataset.focus;
  };

  // ------------------------------------------------------------------ layout
  const budget = () => {
    if (fixedMax !== null) return fixedMax;
    const card = root.closest<HTMLElement>(".demo-card");
    const mh = card ? parseFloat(card.style.maxHeight) : NaN;
    if (mh > 0) return mh - 2;
    return Math.round(root.clientWidth * 1.05);
  };
  const relayout = () => {
    const Wc = root.clientWidth;
    if (!Wc) return;
    form = Wc < 520 ? "medium" : "large";
    root.dataset.form = form;
    const cs = getComputedStyle(root);
    const W = Math.floor(Wc - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight));
    const rest = () => {
      for (const s of [csvg, hsvg]) {
        s.setAttribute("height", "10");
        s.style.height = "10px";
      }
      return root.offsetHeight - 20;
    };
    root.removeAttribute("data-noline");
    root.removeAttribute("data-norule");
    // the charts want about 0.62 x the width between them (at least MIN_C + MIN_H): a shorter budget drops the
    // closing sentence, then the rule line; what is left is shared (the curve ~56 %), each chart within its limits
    const MIN_C = form === "medium" ? 116 : 130;
    const MIN_H = form === "medium" ? 86 : 96;
    let free = budget() - rest();
    if (free < W * 0.62) {
      root.setAttribute("data-noline", "");
      free = budget() - rest();
    }
    if (free < Math.max(MIN_C + MIN_H + 30, W * 0.6)) {
      root.setAttribute("data-norule", "");
      free = budget() - rest();
    }
    let hc = Math.round(clampN(free * 0.56, MIN_C, W * 0.5));
    let hh = Math.round(clampN(free - hc, MIN_H, W * 0.36));
    if (hc + hh > free) {
      // (too short for both minimums: both shrink alike)
      const k = Math.max(0.5, free / (hc + hh));
      hc = Math.round(hc * k);
      hh = Math.round(hh * k);
    }
    for (const [s, hgt] of [
      [csvg, hc],
      [hsvg, hh],
    ] as const)
      s.style.height = `${hgt}px`;
    buildCurve(W, hc);
    buildHist(W, hh);
    update(true);
  };
  let lastW = 0;
  const ro = new ResizeObserver(() => {
    if (root.clientWidth !== lastW) {
      lastW = root.clientWidth;
      relayout();
    }
  });
  ro.observe(root);
  document.fonts?.ready.then(() => relayout());
  relayout();

  return {
    layout(maxH?: number) {
      if (maxH !== undefined) fixedMax = maxH;
      relayout();
    },
    fit(maxH: number | null) {
      fixedMax = maxH;
      relayout();
    },
    view(v = {}) {
      if (v.focus !== undefined) setFocus(v.focus);
      if (v.reset) easeTo(START.kn, START.kd);
      if (v.fit) easeTo(best.kn, best.kd);
      if (v.kn !== undefined || v.kd !== undefined) {
        stopAnim();
        kn = clampN(v.kn ?? kn, KN.min, KN.max);
        kd = clampN(v.kd ?? kd, KD.min, KD.max);
        update(true);
      }
    },
    state: () => ({ kn, kd, rmse: curveRmse(simForce, real.force), overlap, fit: { kn: best.kn, kd: best.kd, rmse: best.rmse }, focus, form }),
    destroy() {
      stopAnim();
      if (histRaf) cancelAnimationFrame(histRaf);
      clearTimeout(framesTimer);
      ro.disconnect();
      root.remove();
    },
  };
}
