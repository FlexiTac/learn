// Real -> sim -> real: the content of Lesson 3.5's card, VT-Refine's pipeline and its real-robot results.
//   (1) THE PIPELINE, four tiles in a row, each a small isometric picture drawn with the iso toolkit of sim-loop.ts (the
//       same robot, policy chip and simulation as Lesson 3.1's loop): 1 record demos (the real robot, a REC dot),
//       2 pre-train a policy (the chip), 3 practise in sim (the digital twin's copies), 4 back to the real robot (the
//       block held up). A tile click (or view({step})) selects it; one plain sentence under the row says what happens
//       there. VT-Refine §4, App. D: 30 teleoperated demos per task; a diffusion policy pre-trained on them; fine-tuned
//       with RL (DPPO) in 100 simulated copies, a reward of 1 only when the parts fit; then run on the real robot.
//   (2) THE RESULTS, VT-Refine Table 1, the tabletop two-arm robot with fin-shaped soft fingers (four FlexiTac-type
//       pads), real-robot success rate on five plug-and-socket insertions (AutoMate part IDs; the paper names no task
//       for each ID): one pair of bars per task, vision + touch (the lesson colour) and vision only (grey). The light
//       part of a bar is the pre-trained policy; the full bar is after practice in sim. "Before sim" / "After sim"
//       (and the selected step: 1-2 before, 3-4 after) eases the bars between the two. The ranges under the chart:
//       with touch 35-65 % -> 75-95 %, vision only 20-40 % -> 30-75 %, and the average gains (+35 vs +19 points),
//       computed from the table. Every number on this card is the paper's (no "illustrative" badge); the pictures
//       are drawings.
// Reduced motion: the bars jump. Layout: from the card's width and its height budget (layout(maxH) / fit(maxH), else
// the card's px max-height, else ~1.0 x the width); a card under 520 px is "medium" (shorter tile titles, thinner
// bars). A short budget drops the closing sentence, then shortens the bars.
import type { WidgetCtx, WidgetInstance } from "../types";
import { h } from "../ui/dom";
import { IsoScene, fitScene, gripAt, policyChip, realStation, simStatic } from "./sim-loop";
import "./sim-results.css";

// ------------------------------------------------------------------ the paper's numbers (VT-Refine, CoRL 2025, Table 1)
const TASKS = ["00081", "00186", "00007", "00446", "00581"];
/** Real tabletop robot, success rate, pre-trained -> after RL fine-tuning in sim. */
const RESULTS = {
  touch: { pre: [0.55, 0.55, 0.65, 0.4, 0.35], post: [0.85, 0.9, 0.95, 0.8, 0.75] },
  vision: { pre: [0.35, 0.4, 0.4, 0.2, 0.35], post: [0.5, 0.65, 0.75, 0.3, 0.45] },
};
const SRC = "https://binghao-huang.github.io/vt_refine/";
const pct = (v: number) => `${Math.round(v * 100)}`;
const range = (a: number[]) => `${pct(Math.min(...a))}–${pct(Math.max(...a))}%`;
const meanGain = (s: { pre: number[]; post: number[] }) => Math.round((100 * s.post.reduce((a, v, i) => a + v - s.pre[i], 0)) / s.post.length);
const f1 = (v: number) => String(Math.round(v * 10) / 10);
const ease = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const clampN = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));

const STEPS = [
  { t: "Record demos", s: "Record", d: "<b>Record 30 demos.</b> A person drives the robot through the task; the camera and the touch pads are recorded." },
  { t: "Pre-train a policy", s: "Train", d: "<b>Pre-train a policy.</b> It learns to copy the demos, and succeeds only some of the time (the light part of each bar)." },
  { t: "Practise in sim", s: "Practise", d: "<b>Practise in sim.</b> 100 simulated copies, with simulated touch, try again and again; a try scores only when the parts fit." },
  { t: "Back to the real robot", s: "Test", d: "<b>Back to the real robot.</b> The improved policy runs on the real robot, with no more training (the full bars)." },
];

type Phase = "pre" | "post";
export interface SimResultsState {
  step: number;
  phase: Phase;
  /** How far the bars are from before (0) to after (1). */
  p: number;
  form: "large" | "medium";
}
export interface SimResultsInstance extends WidgetInstance {
  layout(maxH?: number): void;
  fit(maxH: number | null): void;
  /** step: select a pipeline tile (0-3; the bars follow it); phase: show the bars before / after practice in sim. */
  view(v?: { step?: number; phase?: Phase }): void;
  state(): SimResultsState;
}

let seq = 0;

export function mount(el: HTMLElement, ctx: WidgetCtx): SimResultsInstance {
  const reduced = ctx.reducedMotion();
  const uid = `sr${++seq}`;
  const root = h("div", { class: "sr sx" });
  const tiles = STEPS.map(
    (s, i) =>
      `<li class="sr-li"><button type="button" class="sr-tile" data-i="${i}" aria-pressed="false" aria-describedby="${uid}-d"><svg class="sr-pic" aria-hidden="true"></svg><span class="sr-tt"><span class="sr-n">${i + 1}</span><span class="sr-tl">${s.t}</span><span class="sr-ts">${s.s}</span></span></button></li>`,
  ).join("");
  root.innerHTML = `
    <p class="sr-kicker mono"><i class="sr-mark" aria-hidden="true"></i><span class="sr-name">Real → sim → real</span><span class="sr-sep" aria-hidden="true">·</span><span class="sr-src" title="Huang et al., VT-Refine: Learning Bimanual Assembly with Visuo-Tactile Feedback via Simulation Fine-Tuning, CoRL 2025">VT-Refine, CoRL 2025</span></p>
    <p class="sr-title">Practise in sim, then test on the real robot</p>
    <ol class="sr-steps" aria-label="The four steps">${tiles}</ol>
    <p class="sr-detail" id="${uid}-d" aria-live="polite"></p>
    <section class="sr-res" aria-labelledby="${uid}-r">
      <div class="sr-ph">
        <p class="sr-pt" id="${uid}-r">Success on the real robot<span class="sr-pt-x">, 5 insertion tasks</span></p>
        <div class="sr-seg" role="group" aria-label="Show the results"><button type="button" data-ph="pre" aria-pressed="false">Before sim</button><button type="button" data-ph="post" aria-pressed="true">After sim</button></div>
      </div>
      <p class="sr-sum" id="${uid}-s"><span class="sr-row"><i class="sr-k sr-k-touch" aria-hidden="true"></i><span>Vision + touch <b>${range(RESULTS.touch.pre)} → ${range(RESULTS.touch.post)}</b><span class="sr-gain"> · +${meanGain(RESULTS.touch)} points on average</span></span></span><span class="sr-row"><i class="sr-k sr-k-vision" aria-hidden="true"></i><span>Vision only <b>${range(RESULTS.vision.pre)} → ${range(RESULTS.vision.post)}</b><span class="sr-gain"> · +${meanGain(RESULTS.vision)}</span></span></span><span class="sr-row sr-leg-pre"><i class="sr-k sr-k-pre" aria-hidden="true"></i><span>A bar's light part: before practice in sim</span></span></p>
      <svg class="sr-chart" role="img" aria-labelledby="${uid}-r ${uid}-s"></svg>
    </section>
    <p class="sr-cite">Source: <a href="${SRC}" target="_blank" rel="noopener">VT-Refine</a> (Huang et al., CoRL 2025), Table 1: a two-arm tabletop robot with fin-shaped soft fingers. Tasks are named by their AutoMate part IDs.</p>
    <p class="sr-line demo-extra">Touch helps twice: the policy starts better, and it gains more from practice, because it can feel when the parts line up.</p>`;
  el.append(root);
  const tileBtns = [...root.querySelectorAll<HTMLButtonElement>(".sr-tile")];
  const pics = [...root.querySelectorAll<SVGSVGElement>(".sr-pic")];
  const detail = root.querySelector<HTMLElement>(".sr-detail")!;
  const chart = root.querySelector<SVGSVGElement>(".sr-chart")!;
  const segBtns = [...root.querySelectorAll<HTMLButtonElement>(".sr-seg button")];

  let step = 3;
  let phase: Phase = "post";
  let p = 1;
  let fixedMax: number | null = null;
  let form: SimResultsState["form"] = "large";

  // ------------------------------------------------------------------ the tiles' pictures
  const drawPics = () => {
    const w = Math.floor(pics[0].getBoundingClientRect().width);
    if (!w) return;
    const hgt = Math.round(w * 0.62);
    const builds: ((sc: IsoScene) => void)[] = [
      (sc) => realStation(sc, gripAt(0.12)),
      (sc) => policyChip(sc),
      (sc) => simStatic(sc, 1.3),
      (sc) => realStation(sc, gripAt(0.52)),
    ];
    builds.forEach((b, i) => {
      const svg = pics[i];
      svg.setAttribute("viewBox", `0 0 ${w} ${hgt}`);
      svg.setAttribute("height", String(hgt));
      const pad = i === 1 ? 0.62 : 0.9;
      // (tiles 1 and 3 keep a band on top for their badge)
      const band = i === 0 || i === 2 ? 13 : 0;
      const f = fitScene((sc) => b(sc), [0], w / 2, (hgt + band) / 2 + 1, w * pad, hgt * 0.9 - band);
      const sc = new IsoScene(f.cam);
      b(sc);
      let extra = "";
      // step 1: recording (a red dot and REC in the corner); step 4: a tick for the success
      if (i === 0) extra = `<circle class="sr-rec" cx="9" cy="9" r="3.5"/><text class="sr-pic-lab" x="16" y="12.5">REC</text>`;
      if (i === 2) extra = `<text class="sr-pic-lab" x="${w - 4}" y="12.5" text-anchor="end">×100</text>`;
      svg.innerHTML = sc.render() + extra;
    });
  };

  // ------------------------------------------------------------------ the chart
  type Geo = { W: number; H: number; x0: number; x1: number; y0: number; row: number; bar: number; gap: number };
  let G: Geo | null = null;
  const buildChart = (W: number, H: number) => {
    const medium = form === "medium";
    const bar = medium ? 9 : 12;
    const gap = 2;
    const x0 = medium ? 50 : 58;
    const x1 = W - (medium ? 54 : 62);
    const row = (H - 22) / TASKS.length;
    G = { W, H, x0, x1, y0: 4, row, bar, gap };
    chart.setAttribute("viewBox", `0 0 ${W} ${H}`);
    chart.setAttribute("width", String(W));
    chart.setAttribute("height", String(H));
    let s = "";
    for (const v of [0, 0.25, 0.5, 0.75, 1]) {
      const x = f1(x0 + (x1 - x0) * v);
      s += `<path class="sr-grid" d="M${x} ${G.y0}V${f1(H - 20)}"/>`;
      if (v === 0 || v === 0.5 || v === 1) s += `<text class="sr-tick" x="${x}" y="${f1(H - 6)}" text-anchor="middle">${pct(v)}%</text>`;
    }
    TASKS.forEach((t, i) => {
      const cy = G!.y0 + row * (i + 0.5);
      s += `<text class="sr-task" x="${x0 - 8}" y="${f1(cy)}" text-anchor="end" dominant-baseline="middle">${t}</text>`;
    });
    s += `<g class="sr-bars"></g><path class="sr-axis" d="M${x0} ${G.y0}V${f1(H - 20)}"/>`;
    chart.innerHTML = s;
    drawBars();
  };
  /** A bar from x = a to x = b, rounded (4 px) at its data end only. */
  const barPath = (a: number, b: number, y: number, t: number, round: boolean) => {
    const r = round ? Math.min(4, t / 2, b - a) : 0;
    if (b - a < 0.5) return "";
    return `M${f1(a)} ${f1(y)}H${f1(b - r)}Q${f1(b)} ${f1(y)} ${f1(b)} ${f1(y + r)}V${f1(y + t - r)}Q${f1(b)} ${f1(y + t)} ${f1(b - r)} ${f1(y + t)}H${f1(a)}Z`;
  };
  const drawBars = () => {
    if (!G) return;
    const g = G;
    const X = (v: number) => g.x0 + (g.x1 - g.x0) * v;
    let s = "";
    TASKS.forEach((task, i) => {
      const cy = g.y0 + g.row * (i + 0.5);
      (["touch", "vision"] as const).forEach((k, j) => {
        const pre = RESULTS[k].pre[i];
        const post = RESULTS[k].post[i];
        const now = pre + (post - pre) * p;
        const y = cy - g.bar - g.gap / 2 + j * (g.bar + g.gap);
        // the light part (before practice), then the gain (a surface gap of 2 px between them)
        const split = X(pre);
        const end = X(now);
        const grown = end - split > 3;
        s += `<path class="sr-bar sr-pre sr-${k}" d="${barPath(X(0), grown ? split - 1 : split, y, g.bar, !grown)}"/>`;
        if (grown) s += `<path class="sr-bar sr-post sr-${k}" d="${barPath(split + 1, end, y, g.bar, true)}"/>`;
        const lab = p > 0.5 ? `${pct(pre)}→${pct(post)}%` : `${pct(pre)}%`;
        s += `<text class="sr-val${k === "touch" ? " is-touch" : ""}" x="${f1(end + 5)}" y="${f1(y + g.bar / 2)}" dominant-baseline="middle">${lab}</text>`;
        s += `<rect class="sr-hit" x="${f1(X(0))}" y="${f1(y - 1)}" width="${f1(g.x1 - g.x0)}" height="${f1(g.bar + 2)}"><title>Task ${task}, ${k === "touch" ? "vision + touch" : "vision only"}: ${pct(pre)}% before practice in sim, ${pct(post)}% after</title></rect>`;
      });
    });
    chart.querySelector(".sr-bars")!.innerHTML = s;
  };

  // ------------------------------------------------------------------ state -> view
  let anim = 0;
  const setPhase = (ph: Phase, now = false) => {
    phase = ph;
    for (const b of segBtns) b.setAttribute("aria-pressed", String(b.dataset.ph === ph));
    root.dataset.phase = ph;
    const target = ph === "post" ? 1 : 0;
    if (anim) cancelAnimationFrame(anim);
    anim = 0;
    if (reduced || now) {
      p = target;
      drawBars();
      return;
    }
    const from = p;
    const t0 = performance.now();
    const dur = 700 * Math.abs(target - from) + 1;
    const stepF = (tNow: number) => {
      const u = ease((tNow - t0) / dur);
      p = from + (target - from) * u;
      drawBars();
      anim = u < 1 ? requestAnimationFrame(stepF) : 0;
    };
    anim = requestAnimationFrame(stepF);
  };
  const setStep = (i: number, now = false) => {
    step = clampN(Math.round(i), 0, STEPS.length - 1);
    tileBtns.forEach((b, k) => b.setAttribute("aria-pressed", String(k === step)));
    detail.innerHTML = STEPS[step].d;
    setPhase(step >= 2 ? "post" : "pre", now);
  };
  for (const b of tileBtns) b.addEventListener("click", () => setStep(Number(b.dataset.i)));
  for (const b of segBtns) b.addEventListener("click", () => setPhase(b.dataset.ph as Phase));

  // ------------------------------------------------------------------ layout
  const budget = () => {
    if (fixedMax !== null) return fixedMax;
    const card = root.closest<HTMLElement>(".demo-card");
    const mh = card ? parseFloat(card.style.maxHeight) : NaN;
    if (mh > 0) return mh - 2;
    return Math.round(root.clientWidth * 1.0);
  };
  const relayout = () => {
    const Wc = root.clientWidth;
    if (!Wc) return;
    form = Wc < 520 ? "medium" : "large";
    root.dataset.form = form;
    const cs = getComputedStyle(root);
    const W = Math.floor(Wc - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight));
    drawPics();
    const rest = () => {
      chart.setAttribute("height", "10");
      chart.style.height = "10px";
      return root.offsetHeight - 10;
    };
    root.removeAttribute("data-noline");
    root.removeAttribute("data-notitle");
    // the chart wants ~38 px a task (30 medium), at least 24: a short budget drops the closing sentence, then the
    // title (the kicker and the step text say the same), then the chart shrinks
    const want = TASKS.length * (form === "medium" ? 30 : 38) + 22;
    const least = TASKS.length * 23 + 22;
    let free = budget() - rest();
    if (free < want) {
      root.setAttribute("data-noline", "");
      free = budget() - rest();
    }
    if (free < least) {
      root.setAttribute("data-notitle", "");
      free = budget() - rest();
    }
    const H = Math.round(clampN(free, least, want + 30));
    chart.style.height = `${H}px`;
    buildChart(W, H);
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
  setStep(step, true);
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
      if (v.step !== undefined) setStep(v.step);
      if (v.phase !== undefined) setPhase(v.phase);
    },
    state: () => ({ step, phase, p, form }),
    destroy() {
      if (anim) cancelAnimationFrame(anim);
      ro.disconnect();
      root.remove();
    },
  };
}
