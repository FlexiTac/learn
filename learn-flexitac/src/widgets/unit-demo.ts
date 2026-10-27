// One touch spot: the content of Lesson 2 step 2's demo card (src/ui/demo.ts mounts it; GuidedStep.demo "unit").
// Fig 1 rings ONE crossing of the assembled pad (act focus); this card, beside it and joined to the ring by a leader,
// shows that crossing on its own, in 3D, wired into the reading circuit:
//   (a) a small isometric drawing of the unit, like the 3D-ViTac "sensor unit" inset: a square block of Velostat
//       (carbon grains), ONE top strip (gold) running left-right across it ABOVE and ONE bottom strip running
//       front-back BELOW it, at right angles. At rest the three layers sit a few px apart (an exploded view), so the
//       stacking reads. The block is cut in half by a vertical section along the top strip's front edge (y = HS), and
//       both halves are drawn: the back half solid and dark, as the film is, and the front half as tinted glass (faint
//       fills, top lightest, crisp thin edges, a few faint grains; its far side and that side's lower edge show through
//       its top, so it reads as a box). Through the glass the back half's front face, the section face, shows the
//       slice of film BETWEEN the two strips: that is the touch spot, outlined there in the ring's teal (dashed) and
//       tagged "touch spot" with its resistance R (a thin teal leader from the tag; the tag sits right of the glass as
//       far as the card allows). Where the halves meet, the section line is the back half's edges (the light rim on
//       its top edge). A rubber press tip comes down on the crossing: the gaps close, both halves squeeze a little
//       under it, and up to three conductive paths light up (signal pink) on the section face from strip to strip.
//   (b) a schematic hung on the strips' real ends, wired as the board is (steps 2 and 3, and the real pad: the bottom
//       strip is the drive line the board powers, the top strip the sense line it listens to): +5 V -> a short stub up
//       into the bottom strip's front end; the top strip's right end -> a column down to node A0 -> R1 (10 kΩ) -> GND,
//       a voltmeter across R1 (left of the column, its reading left of it) reading V. Pink dots run along the circuit
//       (wires and strips: +5 V -> the bottom strip -> up through the touch spot -> the top strip -> A0 -> R1 -> GND)
//       at a speed set by the current, I = 5 V / (R1 + R): almost still untouched, ~18 x faster pressed hard.
//   (c) the formula line, V = 5 V × R1 / (R1 + R), and one plain line (.demo-extra: a card too tall for a short stage
//       hides it, see src/ui/demo.ts; the step text says the same).
// Numbers: R from @shared/models/taxel.mjs (200 kΩ untouched -> 1.4 kΩ pressed hard), V from
// @shared/models/divider.mjs with R_on left out (see vOf), so 0.24 V -> 4.39 V.
// While it moves, the card sends Fig 1 the act press {sense, drive, amount, focus: true} for the ringed crossing (<= 30 a
// second, momentary: not replayed after a reload), so the ring and the crossing in the figure glow in step. (focus: true
// makes it the ring's press only: one that lands after the next step has taken the ring away is dropped.)
// ILLUSTRATIVE: there is no force data. Press is a unitless 0..1 knob and is never shown in newtons.
// Motion: press 0 -> 1 (2.2 s, ease-in-out), hold 0.6 s, release 1.4 s, rest 0.6 s, looping. Hovering or dragging on
// the 3D unit (up / down: push down = press harder) scrubs the press and pauses the loop; it resumes 3 s after the
// pointer leaves. The drawing is a focusable slider: ← → (and ↑ ↓, Page Up / Down, Home / End). Reduced motion: no
// loop and no moving dots, scrub only (it starts untouched). Everything stops while the tab is hidden or the card is
// off screen.
// Layout from the card's width (and the host's compact mode): the unit's scale is the largest at which it and its labels
// fit, over three plans (see build): labels beside the unit, or (narrower) "Velostat" under the film and "bottom strip"
// under its end, the voltmeter's reading shortened to "0.24 V" when even that is too wide. Compact (a short stage) caps
// the scale and shortens R1, so the card stays beside the pad. A phone's band (a drawing under 150 px wide) gets the mini
// form: the unit over a mini loop (the short tags "top" and "bottom" instead of the strip names, no film name and no
// touch-spot tag; "R1 10 kΩ" inside the loop, left of R1, shorter when compact), R and V as text rows under it with V's
// share of the 5 V, and no formula.
// The LARGE form: a card given about half the stage (Lesson 2 step 2 on a desktop: the pad on the left, this card on the
// right as a second figure, about as big). It is picked from the card's size alone: a card at least LARGE_W px wide
// (its inner width, the box this module is mounted in; 360 px with the card's border), so today's beside-cards (at most
// 320 px) keep the forms above unchanged. Its height: the host gives the card a fixed height through its inline
// style.height (as it gives its width through style.width) and calls layout(); the large form then fills exactly that
// height (see budgetOf). With no height given it takes its own (a little air round the drawing). In it the unit is drawn
// as large as the width allows (labels beside it, 13-16 px type, 1 px edges, thicker wires, dots and paths), capped by
// the height left after the kicker, the formula lines and the plain line; R1 then grows a little with the spare height
// and the rest is shared above the unit (a longer tip), between the unit and the circuit, and under it. Under the
// formula, a second line puts the live numbers in it: = 5 V × 10 kΩ / (10 kΩ + R) = V (dropped when the height, not
// the width, limits the unit, so the unit grows instead). Measured (Chrome): the unit reaches the size its width allows
// at about 400 × 470, 420 × 500, 560 × 560, 640 × 620, 760 × 700 (card px); a shorter card shrinks it, and one too
// short for LARGE_S[0] (e.g. 420 × 380) overflows its bottom: give the large form at least ~0.9 × its width.
import { R_HARD, rTaxel, squash } from "@shared/models/taxel.mjs";
import { R1, VCC, vA0 } from "@shared/models/divider.mjs";
import { fill as fillT, strings } from "../i18n";
import { paintText } from "../i18n/paint";
import type { WidgetCtx, WidgetInstance } from "../types";
import { h } from "../ui/dom";
import { fmtR } from "../ui/ohms";
import "./unit-demo.css";

const T_PRESS = 2.2;
const T_HOLD = 0.6;
const T_REL = 1.4;
const T_REST = 0.6;
const LOOP = T_PRESS + T_HOLD + T_REL + T_REST;
const RESUME_MS = 3000;
/** The figure hears the press at most this often (ms). */
const SEND_MS = 33;
// the card's words (docs/i18n.md): painted from S() and again on a language switch (the drawing's labels too: it is
// built again, measuring them)
const S = strings(
  {
    illTip: "Shape only: there is no force data. Press is unitless (0 = untouched, 1 = hard press).",
    name: "One touch spot",
    ill: "Illustrative",
    aria: "Press on the touch spot, illustrative, no units. Arrow keys change it; the voltmeter shows the voltage across R1.",
    line: "Press {a} the Velostat's resistance falls {a} more of the 5&nbsp;V lands on R1 {a} the voltage across R1 rises. That voltage is what the board measures.",
    topStrip: "top strip",
    botStrip: "bottom strip",
    top: "top",
    bottom: "bottom",
    spot: "touch spot",
    valuetext: "press {p} of 1: R = {r}, V across R1 = {v}",
  },
  {
    illTip: "只示意形状，没有实测数据。按压没有单位（0 = 没碰，1 = 用力按）。",
    name: "一个触摸点",
    ill: "示意",
    aria: "按压这个触摸点（示意，无单位）。用方向键调节；电压表显示 R1 两端的电压。",
    line: "按压 {a} Velostat 的电阻变小 {a} 5&nbsp;V 中落在 R1 上的部分变多 {a} R1 两端的电压升高。读取板测量的就是这个电压。",
    topStrip: "上层铜条",
    botStrip: "下层铜条",
    top: "上",
    bottom: "下",
    spot: "触摸点",
    valuetext: "按压 {p}（满值 1）：R = {r}，R1 两端电压 = {v}",
  },
);

/** V across R1 for a Velostat resistance r: the divider model with R_on LEFT OUT (rOn: 0). The card's circuit has no
 *  mux switch in it, so the meter agrees exactly with the formula it shows, V = 5 V × R1 / (R1 + R); the board's
 *  ~70 Ω switch would lower V by under 1 %. */
const vOf = (r: number) => vA0(r, { rOn: 0 });
/** Current (A) in the loop, and the pink dots' speed (px/s) for it: pressed hard = DOT_MAX. */
const ampsOf = (r: number) => VCC / (R1 + r);
const DOT_MAX = 34;
const I_HARD = ampsOf(R_HARD);
const fmtV = (v: number) => `${v.toFixed(2)} V`;

/** The large form: from this inner card width (px; a 360 px card), its unit's scale range (the largest first, the
 *  smallest a short card may shrink it to) and R1's longest length. */
const LARGE_W = 358;
const LARGE_S = [1.2, 4.4];
const LARGE_R_MAX = 76;
/** The drawing's type, symbols and spacings (px): today's forms (BASE) and the large form's (LARGE). The text sizes
 *  match unit-demo.css (.ud-lab etc., and their .ud.is-large sizes); here they are only the fallback for a card measured
 *  before it renders. */
const BASE = {
  lab: 9.5,
  strong: 10,
  tag: 9.5,
  val: 11,
  read: 11.5,
  /** a label's gap to the part it names; the A0, R1 and GND labels' gaps to their wire (R1's two lines ± r1dy) */
  gap: 6,
  a0: 7,
  r1: 9,
  r1dy: 6,
  gnd: 11,
  gndDy: 7,
  /** the "top strip" label's rise over the strip's far ends; the +5 V terminal's radius */
  y5: 9,
  term: 3,
  /** room over the strips' far ends (for "top strip") and over the tip's rounded end */
  topLab: 15,
  topTip: 16,
  /** A0's drop under the unit (wide plan, narrow, narrow compact), R1's lead-in, length (compact) and tail, the GND
   *  symbol's room and its three bars (half-widths, drops), the zigzag's half-width */
  dropW: 10,
  dropN: 22,
  dropNC: 19,
  r0: 6,
  rLen: 30,
  rLenC: 24,
  r1Tail: 7,
  gndRoom: 13,
  gndW: [7, 4.5, 2],
  gndY: [4, 7, 10],
  zig: 4.5,
  node: 2.4,
  joint: 2.2,
  /** the voltmeter: its radius and offset left of R1 (wide plan, narrow); its reading's box (left of the meter: gap,
   *  padding, top above the meter's centre, height, corner), the text's drop in it, the bar's drop and height */
  RV: 9.5,
  DVw: 40,
  DVn: 30,
  boxGap: 7,
  boxPad: 14,
  boxTop: 13,
  boxH: 19,
  boxR: 4,
  readDy: 10,
  barDy: 23,
  barH: 3.5,
  /** the touch spot's tag: its drop under the glass, its R line's drop, its leader's start left of it; "bottom
   *  strip"'s drop under the unit (narrow plan) */
  tagDy: 7,
  tagLine: 13,
  leadX: 3,
  botDy: 8,
  /** the current's dots: their speed scale (their spacing is wider in the large form, unit-demo.css) */
  dotK: 1,
};
const LARGE: typeof BASE = {
  lab: 13,
  strong: 14,
  tag: 13,
  val: 16,
  read: 16,
  gap: 8,
  a0: 10,
  r1: 13,
  r1dy: 9,
  gnd: 15,
  gndDy: 10,
  y5: 13,
  term: 4,
  topLab: 21,
  topTip: 20,
  dropW: 14,
  dropN: 31,
  dropNC: 31,
  r0: 8,
  rLen: 36,
  rLenC: 36,
  r1Tail: 10,
  gndRoom: 18,
  gndW: [10, 6.5, 3],
  gndY: [5, 9, 13],
  zig: 6.5,
  node: 3.2,
  joint: 3,
  RV: 14,
  DVw: 60,
  DVn: 46,
  boxGap: 10,
  boxPad: 22,
  boxTop: 19,
  boxH: 28,
  boxR: 6,
  readDy: 14.5,
  barDy: 34,
  barH: 5,
  tagDy: 10,
  tagLine: 19,
  leadX: 4,
  botDy: 11,
  dotK: 10 / 7,
};
/** The large form's sizes for a drawing W px wide: LARGE, and up to 1.2 x it on the widest cards (its type 13 -> 15.6 px,
 *  the circuit's symbols and spacings with it; the dots' speed stays). Halves stay exact, so no path gets float noise.
 *  (unit-demo.css scales the same text by --ud-k.) */
const largeK = (W: number) => Math.min(1.2, Math.max(1, 1 + (W - 380) / 1000));
const largeSizes = (k: number): typeof BASE => {
  const half = (v: number) => Math.round(v * k * 2) / 2;
  const out: Record<string, number | number[]> = {};
  for (const [key, v] of Object.entries(LARGE)) out[key] = key === "dotK" ? v : Array.isArray(v) ? v.map(half) : half(v);
  return out as unknown as typeof BASE;
};

// ------------------------------------------------------------------ the unit, in world units (z up)
/** Strip half-length, width, thickness (bottom, top); the Velostat's side and thickness; the exploded gap at rest. */
const L = 84;
const SW = 24;
const TB = 4;
const TT = 4;
const VA = 96;
const VT = 14;
const G0 = 6;
const HV = VA / 2;
const HS = SW / 2;
/** The press tip: radius, and its rounded end's height (it flattens to TIP_HD1 pressed hard); it hovers TIP_LIFT above
 *  the strip at rest. */
const TIP_R = 10;
const TIP_HD0 = 9;
const TIP_HD1 = 5;
const TIP_LIFT = 10;
/** Conductive paths through the touch spot: where each crosses the film (world x on the section face), the press at which it
 *  starts to light, its grains' heights (fraction of the film's thickness) and their sideways jitter. */
const PATH_X = [-6.5, 0.5, 7];
const PATH_ON = [0.12, 0.36, 0.6];
const PATH_V = [0.76, 0.5, 0.24];
const PATH_JIT = [2.2, -2.2, 1.8];

// the camera: azimuth 25° (the top strip runs nearly left-right, the bottom strip front-back), 30° down
const AZ = (25 * Math.PI) / 180;
const EL = (30 * Math.PI) / 180;
const CA = Math.cos(AZ);
const SA = Math.sin(AZ);
const SE = Math.sin(EL);
const CE = Math.cos(EL);
/** Screen offset of a world point from the unit's origin, before scaling. */
const sxOf = (x: number, y: number) => x * CA - y * SA;
const syOf = (x: number, y: number, z: number) => (x * SA + y * CA) * SE - z * CE;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const wave = (t: number) => 0.5 - 0.5 * Math.cos(Math.PI * clamp01(t));
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
/** 1 inside r0, easing to 0 at r1. */
const fall = (d: number, r0: number, r1: number) => (d <= r0 ? 1 : d >= r1 ? 0 : 0.5 + 0.5 * Math.cos((Math.PI * (d - r0)) / (r1 - r0)));
/** Where the tip squeezes the film: the crossing, easing out over ~18 units round it (along y it spans the whole strip). */
const dentX = (x: number) => fall(Math.abs(x), 8, 30);
const dentY = (y: number) => fall(Math.abs(y), HS, 30);
const loopPress = (ph: number) =>
  ph < T_PRESS ? wave(ph / T_PRESS) : ph < T_PRESS + T_HOLD ? 1 : ph < T_PRESS + T_HOLD + T_REL ? 1 - wave((ph - T_PRESS - T_HOLD) / T_REL) : 0;
/** The time in the press stroke at which the loop reaches `p`, so it resumes from where a scrub left it. */
const phaseFor = (p: number) => (T_PRESS * Math.acos(1 - 2 * clamp01(p))) / Math.PI;

const NS = "http://www.w3.org/2000/svg";
function svgEl<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>, parent: Element): SVGElementTagNameMap[K] {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  parent.append(el);
  return el;
}
const f1 = (n: number) => (Math.round(n * 10) / 10).toString();
const pathOf = (pts: number[][], close = true) => pts.map(([x, y], i) => `${i ? "L" : "M"}${f1(x)} ${f1(y)}`).join("") + (close ? "Z" : "");
const range = (a: number, b: number, n: number) => Array.from({ length: n + 1 }, (_, i) => a + ((b - a) * i) / n);

/** Deterministic scatter, so the grains sit in the same places every time. */
function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The layers' heights for a press: the gap (closes first), the squeeze at the crossing, the tip's lift and end. */
function poseOf(p: number) {
  const g = G0 * (1 - smooth(0, 0.3, p));
  const dent = squash(p) * VT;
  const zV0 = TB + g;
  return {
    g,
    dent,
    zV0,
    /** The Velostat's top at (x, y). */
    zV1: (x: number, y: number) => zV0 + VT - dent * dentX(x) * dentY(y),
    /** The top strip's underside along its length (it follows the squeeze). */
    zTb: (x: number) => zV0 + VT - dent * dentX(x) + g,
    lift: TIP_LIFT * (1 - smooth(0, 0.08, p)),
    hd: TIP_HD0 - (TIP_HD0 - TIP_HD1) * smooth(0.08, 1, p),
  };
}
const REST = poseOf(0);

let seq = 0;

export function mount(el: HTMLElement, ctx: WidgetCtx): WidgetInstance {
  const reduced = ctx.reducedMotion();
  const figure = ctx.figure;
  const uid = `ud${++seq}`;
  const root = h("div", { class: "ud" });
  const arrow = `<span class="ud-arrow" aria-hidden="true">→</span>`;
  root.innerHTML = `
    <p class="ud-kicker mono"><i class="ud-ring" aria-hidden="true"></i><span class="ud-name" data-t="name">${S().name}</span><span class="ud-sep" aria-hidden="true">·</span><span class="ud-ill" title="${S().illTip}" data-t-title="illTip" data-t="ill">${S().ill}</span></p>
    <div class="ud-anim" tabindex="0" role="slider" aria-label="${S().aria}" data-t-aria="aria" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><svg class="ud-svg" aria-hidden="true"></svg></div>
    <div class="ud-mini mono" aria-hidden="true"><span class="ud-mini-r"><b>R</b> = <span class="ud-mini-rv"></span></span><span class="ud-mini-v"><b>V</b> = <span class="ud-mini-vv"></span></span><span class="ud-mini-track"><i class="ud-mini-bar"></i></span></div>
    <p class="ud-formula mono"><b>V</b> = 5&nbsp;V × <b>R1</b> / (<b>R1</b> + <b>R</b>)</p>
    <p class="ud-sub mono" aria-hidden="true">= 5&nbsp;V × ${fmtR(R1)} / (${fmtR(R1)} + <span class="ud-sub-r"></span>) = <b class="ud-sub-v"></b></p>
    <p class="ud-line demo-extra" data-t="line">${fillT(S().line, { a: arrow })}</p>`;
  el.append(root);
  const anim = root.querySelector<HTMLElement>(".ud-anim")!;
  const svg = anim.querySelector("svg")!;
  // the narrow (mini) form's readouts, under the drawing
  const miniR = root.querySelector<HTMLElement>(".ud-mini-rv")!;
  const miniV = root.querySelector<HTMLElement>(".ud-mini-vv")!;
  const miniBar = root.querySelector<HTMLElement>(".ud-mini-bar")!;
  // the large form's formula with the live numbers in it
  const subR = root.querySelector<HTMLElement>(".ud-sub-r")!;
  const subV = root.querySelector<HTMLElement>(".ud-sub-v")!;

  let press = 0;

  /** The widest of these strings in a text style (measured in the svg), with a fallback for an unrendered card. */
  const textWidth = (cls: string, words: string[], px: number) => {
    const t = svgEl("text", { class: cls, x: 0, y: 0, visibility: "hidden" }, svg);
    let w = 0;
    for (const word of words) {
      t.textContent = word;
      w = Math.max(w, t.getComputedTextLength());
    }
    t.remove();
    return w || Math.max(...words.map((s) => s.length)) * px * 0.62;
  };

  // ------------------------------------------------------------------ the drawing
  type Grain = { x: number; y: number; v: number; face: "top" | "wall" | "front" | "side"; el: SVGEllipseElement };
  type Chain = { glow: SVGPathElement; core: SVGPathElement; nodes: SVGCircleElement[]; grains: SVGCircleElement[]; x: number; flip: number };
  let A: {
    /** The meter shows "0.24 V" (a narrow card), not "V = 0.24 V". */
    short: boolean;
    P: (x: number, y: number, z: number) => [number, number];
    s: number;
    ux: number;
    vTop: SVGPathElement;
    vSide: SVGPathElement;
    vShade: SVGPathElement;
    vRim: SVGPathElement;
    vWall: SVGPathElement;
    ghLeft: SVGPathElement;
    ghFarEdge: SVGPathElement;
    ghTop: SVGPathElement;
    ghFront: SVGPathElement;
    ghSide: SVGPathElement;
    ghEdge: SVGPathElement;
    grains: Grain[];
    chains: Chain[];
    spot: SVGPathElement;
    tTop: SVGPathElement;
    tFront: SVGPathElement;
    tEnd: SVGPathElement;
    tDots: SVGPathElement;
    tipBody: SVGPathElement;
    tipHi: SVGPathElement;
    /** The sense column: from the top strip's right end (it comes down with the layers) over to x = xc, down to R1 (yR0). */
    wireC: SVGPathElement;
    dotsC: SVGPathElement;
    jointC: SVGCircleElement;
    xc: number;
    yR0: number;
    dotPaths: SVGPathElement[];
    /** The touch spot's R tag and the voltmeter's reading and bar (none in the mini form: HTML rows under it). */
    tag: SVGTextElement | null;
    /** The tag's R line again, in the mask that stops the glass's edges short of it; the tag's leader and its start. */
    tagKnock: SVGTextElement | null;
    lead: SVGPathElement | null;
    leadFrom: [number, number];
    read: SVGTextElement | null;
    bar: SVGRectElement | null;
    barW: number;
    hit: { y0: number; y1: number };
    /** The current's dots' speed scale (BASE / LARGE). */
    dotK: number;
  } | null = null;
  let builtKey = "";

  /** Build the drawing for a width; `compact` (the host's short-stage mode, src/ui/demo.ts) also makes it shorter: a
   *  smaller unit and a shorter R1. `large`: the large form (see the header), `budget` the height it fills (0: its own). */
  const build = (W: number, compact: boolean, large: boolean, budget: number, forceMini = false): { s: number; sW: number } | null => {
    svg.replaceChildren();
    A = null;
    // a phone's band (a card under ~172 px): the mini form, the unit over a mini loop, its R and V as text under it
    const mini = forceMini || (!large && W < 150);
    root.classList.toggle("is-mini", mini);
    if (W < 90) return null;
    const Z = large ? largeSizes(largeK(W)) : BASE;
    // (the large form's text scales with it: unit-demo.css; set before the labels are measured)
    if (large) root.style.setProperty("--ud-k", String(largeK(W)));
    else root.style.removeProperty("--ud-k");
    // label widths (mono)
    const wLab = (t: string[]) => Math.ceil(textWidth("ud-lab", t, Z.lab));
    const wVelo = wLab(["Velostat"]);
    const wBot = wLab([S().botStrip]);
    const wA0 = wLab(["A0"]);
    const w5 = wLab(["+5 V"]);
    const wR1 = Math.max(wLab(["10 kΩ"]), Math.ceil(textWidth("ud-lab ud-lab-strong", ["R1"], Z.strong)));
    const wGnd = wLab(["GND"]);
    const wTag = Math.max(Math.ceil(textWidth("ud-tag", [S().spot], Z.tag)), Math.ceil(textWidth("ud-val", ["R = 200 kΩ"], Z.val)));
    const wLong = Math.ceil(textWidth("ud-read", ["V = 4.44 V"], Z.read)) + Z.boxPad;
    const wShort = Math.ceil(textWidth("ud-read", ["4.44 V"], Z.read)) + Z.boxPad;
    const RV = Z.RV; // the voltmeter's radius
    const xb = sxOf(0, L); // the bottom strip's front end (the +5 V stub), unscaled
    const xc0 = sxOf(L, 0); // the top strip's right end (its end face's middle: the sense column, A0 and R1), unscaled
    const armL = [sxOf(-HS, 70), syOf(-HS, 70, TB)]; // the bottom strip's front arm, left edge: "bottom strip" (wide)
    const armV = [sxOf(-HS, 53), syOf(-HS, 53, TB)]; // the same edge just under the film: "Velostat" (narrow)
    const cut = [sxOf(HS, HS), syOf(HS, HS, REST.zV0)]; // the touch spot's lower right corner on the section face
    const ends = sxOf(L, -HS); // the top strip's ends: x = ±ends
    const vLeft = sxOf(-HV, HV); // the Velostat's leftmost corner
    // the top: the Velostat's back corner, the "top strip" label and +5 V over the strip's ends, a stretch of the tip
    const zTt0 = REST.zTb(0) + TT;
    const yEnds = syOf(-L, -HS, zTt0); // the top strip's far ends, top (unscaled)
    const topOf = (s: number) => Math.max(-syOf(-HV, -HV, REST.zV0 + VT) * s + 2, -yEnds * s + Z.topLab, -syOf(0, 0, zTt0 + TIP_LIFT + TIP_HD0) * s + Z.topTip);
    const yLow = Math.max(syOf(HS, L, 0), syOf(-HS, L, 0)); // the unit's lowest point (the bottom strip's front end), unscaled
    // Three plans; the unit's scale is the largest at which it and every label fit the width (the first plan within
    // 10 % of the best wins):
    //   wide:   "Velostat" left of the film, "bottom strip" left of its front arm; the voltmeter 40 px left of R1, its
    //           reading "V = 0.24 V" left of it.
    //   narrow: "Velostat" just under the film (left of the bottom strip's front arm), "bottom strip" under its front
    //           end (right of the +5 V stub); the voltmeter 30 px left of R1, its reading "V = 0.24 V", or only "0.24 V".
    //   mini:   (a phone) the short tags "top" and "bottom" only, no touch-spot tag (the dashed touch spot stays);
    //           "R1 / 10 kΩ" left of R1, inside the loop, the voltmeter 52 px left of R1 and no reading beside it (R and
    //           V are text rows under the drawing), "GND" left of its symbol, so the circuit stays inside the unit's
    //           own width.
    // In every plan the sense column (A0, R1, GND, their labels right of it) hangs from the top strip's right end, and
    // the +5 V terminal sits on a short stub under the bottom strip's front end ("+5 V" left of it), above the A0 row:
    // the meter's reading may reach left under it. The touch spot's tag sits between the glass and the column: the
    // column moves right of the strip's end as far as the tag needs (the wire then runs right before it drops).
    type Plan = { narrow: boolean; DV: number; boxW: number; short: boolean; mini?: boolean };
    const plans: Plan[] = mini
      ? [{ narrow: true, DV: 52, boxW: 0, short: true, mini: true }]
      : [
          { narrow: false, DV: Z.DVw, boxW: wLong, short: false },
          { narrow: true, DV: Z.DVn, boxW: wLong, short: false },
          { narrow: true, DV: Z.DVn, boxW: wShort, short: true },
        ];
    /** The sense column's x at a scale (from the unit's origin): under the top strip's end, or right of it as far as the
     *  touch spot's tag needs (the tag at its leftmost, over the glass, then a gap). */
    const xcOf = (s: number, p: Plan) => (p.mini ? xc0 * s : Math.max(xc0 * s, cut[0] * s + 2 * Z.gap + wTag));
    const extent = (s: number, p: Plan) => {
      const xc = xcOf(s, p);
      if (p.mini) return { left: Math.min(-ends * s, xb * s - 3 - 4 - w5), right: Math.max(ends * s + 0.5, xc + 7 + wA0 + 1) };
      // (the meter's reading, left of the meter, may reach under the +5 V terminal: a row above it)
      const lefts = [-ends * s, xb * s - Z.term - Z.gap - w5, xc - p.DV - RV - Z.boxGap - p.boxW];
      const rights = [ends * s + 0.5, xc + Z.a0 + wA0, xc + Z.r1 + wR1, xc + Z.gnd + wGnd];
      if (p.narrow) {
        lefts.push(armV[0] * s - Z.gap - wVelo);
        rights.push(xb * s + Z.gap + wBot);
      } else lefts.push(vLeft * s - Z.gap - wVelo, armL[0] * s - Z.gap - wBot);
      return { left: Math.min(...lefts), right: Math.max(...rights) };
    };
    // A0's drop under the unit, R1's length, and (the large form, which also has a height to fit) the drawing's height
    // at a scale: the unit, A0, R1 and GND
    // (the mini form beside a short phone's pad, compact: a shorter loop, so the card fits the drawing's height)
    const dropOf = (p: Plan) => (p.mini ? (compact ? 7 : 8) : p.narrow ? (compact ? Z.dropNC : Z.dropN) : Z.dropW);
    const rLen0 = mini ? (compact ? 16 : 20) : compact ? Z.rLenC : Z.rLen;
    const heightOf = (s: number, p: Plan) => Math.ceil(Math.ceil(topOf(s) + 1) + s * yLow + dropOf(p)) + Z.r0 + rLen0 + Z.r1Tail + Z.gndRoom;
    // (tall: the height is no limit, for the scale the width alone allows)
    const fit = (p: Plan, tall = false) => {
      let s = large ? LARGE_S[1] : p.mini ? (compact ? 0.8 : 0.9) : compact ? 0.9 : 1.5;
      for (; s > (large ? LARGE_S[0] : p.mini ? 0.3 : 0.5); s -= 0.01) {
        const e = extent(s, p);
        if (e.right - e.left <= W - 6 && (tall || !(budget > 0 && heightOf(s, p) > budget))) break;
      }
      return { s, p, ...extent(s, p) };
    };
    const fits = plans.map((p) => fit(p));
    const best = Math.max(...fits.map((f) => f.s));
    const F = fits.find((f) => f.s >= best * 0.9)!;
    const { s, p: plan } = F;
    const { narrow, DV } = plan;
    const ux = 3 - F.left + (W - 6 - (F.right - F.left)) / 2;
    // the large form fills the height it is given (or takes a little air of its own): R1 grows a little, and the rest
    // is shared above the unit (the tip comes from further up), between the unit and the circuit, and under it
    let rLen = rLen0;
    let padTop = 0;
    let padMid = 0;
    let fill = 0;
    if (large) {
      const need = heightOf(s, plan);
      fill = budget > 0 ? budget : need + 28;
      const extra = Math.max(0, fill - need);
      const grow = Math.round(Math.min(LARGE_R_MAX - rLen0, extra * 0.4));
      rLen += grow;
      padTop = (extra - grow) * 0.5;
      padMid = (extra - grow) * 0.2;
    }
    const uy = Math.ceil(topOf(s) + padTop + 1);
    const P = (x: number, y: number, z: number): [number, number] => [ux + s * sxOf(x, y), uy + s * syOf(x, y, z)];
    // the circuit under the unit: the +5 V stub under the bottom strip's front end; the sense column (A0, R1, GND) under
    // the top strip's right end; the voltmeter left of R1
    const [ebx, eby] = P(0, L, TB / 2); // the bottom strip's front end: the +5 V stub's top
    const yUnit = uy + s * yLow;
    const yA = Math.round(yUnit + dropOf(plan) + padMid);
    // (the +5 V terminal: a short drop under the strip, above the A0 row)
    const yT = Math.round(yUnit + Math.max(Z.term + 2.5, 0.55 * dropOf(plan)));
    const yR0 = yA + Z.r0;
    const yR1 = yR0 + rLen;
    const yG = yR1 + Z.r1Tail;
    const xc = ux + xcOf(s, plan);
    const xV = xc - DV;
    const cyV = (yA + yG) / 2;
    const H = Math.max(fill, Math.ceil(yG + Z.gndRoom));
    // (for reviews: which plan and scale this width got, and every plan's best scale)
    svg.dataset.plan = `${large ? "large " : ""}${plan.mini ? "mini" : narrow ? "narrow" : "wide"}${plan.short && !plan.mini ? " short" : ""} ${s.toFixed(2)} (${fits.map((f) => f.s.toFixed(2)).join(" / ")})`;
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.setAttribute("height", String(H));
    anim.style.height = `${H}px`;

    const defs = svgEl("defs", {}, svg);
    const grad = svgEl("linearGradient", { id: `${uid}-tip`, x1: 0, x2: 1, y1: 0, y2: 0 }, defs);
    svgEl("stop", { offset: 0, class: "ud-tip-s0" }, grad);
    svgEl("stop", { offset: 0.4, class: "ud-tip-s1" }, grad);
    svgEl("stop", { offset: 1, class: "ud-tip-s2" }, grad);
    const fadeG = svgEl("linearGradient", { id: `${uid}-fadeg`, gradientUnits: "userSpaceOnUse", x1: 0, y1: 0, x2: 0, y2: 16 }, defs);
    svgEl("stop", { offset: 0, "stop-color": "#fff", "stop-opacity": 0 }, fadeG);
    svgEl("stop", { offset: 1, "stop-color": "#fff", "stop-opacity": 1 }, fadeG);
    const mask = svgEl("mask", { id: `${uid}-fade`, maskUnits: "userSpaceOnUse", x: 0, y: -2, width: W, height: H + 4 }, defs);
    svgEl("rect", { x: 0, y: -2, width: W, height: H + 4, fill: `url(#${uid}-fadeg)` }, mask);

    // ---- the circuit's wires, under the unit (they leave from the strips' end faces)
    const gW = svgEl("g", { class: "ud-wires" }, svg);
    const yTop = uy + s * yEnds - Z.y5; // the "top strip" label's row
    // +5 V -> the bottom strip's front end (a short stub)
    svgEl("path", { class: "ud-wire", d: `M${f1(ebx)} ${f1(eby)}V${f1(yT - Z.term)}` }, gW);
    // the top strip's right end -> the column (set per frame: the strip comes down with the layers) -> R1
    const wireC = svgEl("path", { class: "ud-wire" }, gW);
    // R1: a zigzag, six peaks
    let zz = `M${f1(xc)} ${yR0}`;
    for (let i = 0; i < 6; i++) zz += `L${f1(xc + (i % 2 ? -Z.zig : Z.zig))} ${f1(yR0 + ((i + 0.5) * rLen) / 6)}`;
    zz += `L${f1(xc)} ${yR1}V${yG}V${yG + Z.gndY[0]}`;
    svgEl("path", { class: "ud-wire", d: zz }, gW);
    // GND
    svgEl("path", { class: "ud-wire ud-gnd", d: Z.gndW.map((w, i) => `M${f1(xc - w)} ${yG + Z.gndY[i]}H${f1(xc + w)}`).join("") }, gW);
    // the voltmeter across R1: A0 -> V -> GND
    svgEl("path", { class: "ud-wire", d: `M${f1(xc)} ${yA}H${f1(xV)}V${f1(cyV - RV)}M${f1(xV)} ${f1(cyV + RV)}V${yG}H${f1(xc)}` }, gW);
    // the current: pink dots along the wires (+5 V -> the bottom strip; the top strip -> A0 -> R1 -> GND)
    const gD = svgEl("g", { class: "ud-dots" }, gW);
    const dotsC = svgEl("path", { class: "ud-dot" }, gD);
    const dotPaths = [dotsC, svgEl("path", { class: "ud-dot", d: `M${f1(ebx)} ${f1(yT - Z.term)}V${f1(eby)}` }, gD), svgEl("path", { class: "ud-dot", d: `M${f1(xc)} ${yR1}V${yG + Z.gndY[0]}` }, gD)];

    // ---- the bottom strip (it lies still; everything else comes down onto it)
    const gU = svgEl("g", { class: "ud-unit" }, svg);
    svgEl("path", { class: "ud-g-top", d: pathOf([P(-HS, -L, TB), P(HS, -L, TB), P(HS, L, TB), P(-HS, L, TB)]) }, gU);
    svgEl("path", { class: "ud-g-r", d: pathOf([P(HS, -L, 0), P(HS, L, 0), P(HS, L, TB), P(HS, -L, TB)]) }, gU);
    svgEl("path", { class: "ud-g-l", d: pathOf([P(-HS, L, 0), P(HS, L, 0), P(HS, L, TB), P(-HS, L, TB)]) }, gU);
    // the film's shadow on it (seen through the glass half and the gap under the section face while the layers are
    // apart), and the glass half's, fainter
    svgEl("path", { class: "ud-shade", d: pathOf([P(-HS, -HV, TB), P(HS, -HV, TB), P(HS, HS, TB), P(-HS, HS, TB)]) }, gU);
    svgEl("path", { class: "ud-shade ud-shade-gh", d: pathOf([P(-HS, HS, TB), P(HS, HS, TB), P(HS, HV, TB), P(-HS, HV, TB)]) }, gU);
    const bDots = svgEl("path", { class: "ud-dot ud-dot-on-strip", d: pathOf([P(0, L - 3, TB), P(0, HS + 1, TB)], false) }, gU);
    dotPaths.push(bDots);

    // ---- the Velostat, one square block cut in half by a vertical section along the top strip's front edge (y = HS):
    // the back half, black (its top, its right side, and its front: the section face), then the front half as tinted
    // glass (below), through which the section face shows
    const vTop = svgEl("path", { class: "ud-v-top" }, gU);
    const vSide = svgEl("path", { class: "ud-v-r" }, gU);
    const vWall = svgEl("path", { class: "ud-v-l ud-v-cut" }, gU);
    // the top strip's shadow on the film (seen through the gap over the section face), and the light on the back half's
    // top edges (the section's top edge among them)
    const vShade = svgEl("path", { class: "ud-shade" }, gU);
    const vRim = svgEl("path", { class: "ud-rim" }, gU);
    const gGr = svgEl("g", { class: "ud-grains" }, gU);
    const rand = rng(1361);
    const grains: Grain[] = [];
    // one scatter for the whole block; the grains that fall in the glass half are drawn there, later and faint
    type GrainAt = { face: Grain["face"]; x: number; y: number; v: number; rx: number };
    const inGlass: GrainAt[] = [];
    const grain = (face: Grain["face"], x: number, y: number, v: number, rnd = rand, spread = 0.55) => {
      const at = { face, x, y, v, rx: (0.95 + rnd() * spread) * Math.max(0.9, s) };
      if (face === "front" || (face !== "wall" && y > HS)) inGlass.push(at);
      else grains.push({ face, x, y, v, el: svgEl("ellipse", { rx: f1(at.rx), ry: 0 }, gGr) });
    };
    for (let i = 0, n = 0; n < 16 && i < 400; i++) {
      const x = -HV + 3 + rand() * (VA - 6);
      const y = -HV + 3 + rand() * (VA - 6);
      if (Math.abs(y) < HS + 5 || (x > -HS - 3 && y > HS - 3)) continue;
      grain("top", x, y, 0);
      n++;
    }
    // (the section face: right of the touch spot, then left of it)
    for (let i = 0; i < 6; i++) grain("wall", HS + 3 + rand() * (HV - HS - 6), HS, 0.18 + rand() * 0.64);
    for (let i = 0; i < 4; i++) grain("front", -HV + 3 + rand() * (HV - HS - 6), HV, 0.18 + rand() * 0.64);
    for (let i = 0; i < 5; i++) grain("side", HV, -HV + 3 + rand() * (HV + HS - 6), 0.18 + rand() * 0.64);
    for (let i = 0; i < 6; i++) grain("wall", -HV + 3 + rand() * (HV - HS - 6), HS, 0.18 + rand() * 0.64);
    // (and a few more in the glass half's right part, kept off the line of sight to the touch spot)
    const randG = rng(2417);
    for (let i = 0; i < 3; i++) grain("top", HS + 12 + randG() * (HV - HS - 16), HS + 14 + randG() * (HV - HS - 18), 0, randG, 0.45);
    for (let i = 0; i < 3; i++) grain("front", -HS + 4 + randG() * (HV + HS - 8), HV, 0.2 + randG() * 0.6, randG, 0.45);
    for (let i = 0; i < 2; i++) grain("side", HV, HS + 4 + randG() * (HV - HS - 8), 0.2 + randG() * 0.6, randG, 0.45);
    // the conductive paths through the touch spot (on the section face), each a chain of touching grains
    const gPaths = svgEl("g", { class: "ud-paths" }, gU);
    const chains: Chain[] = PATH_X.map((x, k) => {
      const g = svgEl("g", {}, gPaths);
      const rs = f1(1.25 * Math.max(0.9, s));
      return {
        grains: PATH_V.map(() => svgEl("circle", { class: "ud-grain", r: rs }, g)),
        glow: svgEl("path", { class: "ud-path-glow" }, g),
        core: svgEl("path", { class: "ud-path" }, g),
        nodes: PATH_V.map(() => svgEl("circle", { class: "ud-node", r: rs }, g)),
        x,
        flip: k % 2 ? -1 : 1,
      };
    });
    // the touch spot: the slice of film between the two strips, outlined on the section face in the ring's teal
    const spot = svgEl("path", { class: "ud-spot" }, gU);

    // ---- the front half, tinted glass. First what is seen through its top: its far (left) side, faint, and that
    // side's lower edge, so the glass reads as a box the section face stands in (not a plate under the black half).
    // Then its three seen faces, fills only (top lightest; they never overlap on screen), its faint grains, and one
    // path for its own edges (where it meets the back half, the back half's edges are the section line: no edge is
    // drawn twice)
    const gGh = svgEl("g", { class: "ud-ghost" }, gU);
    const ghLeft = svgEl("path", { class: "ud-gh-far" }, gGh);
    const ghFarEdge = svgEl("path", { class: "ud-gh-far-edge" }, gGh);
    const ghTop = svgEl("path", { class: "ud-gh-top" }, gGh);
    const ghFront = svgEl("path", { class: "ud-gh-l" }, gGh);
    const ghSide = svgEl("path", { class: "ud-gh-r" }, gGh);
    const gGhGr = svgEl("g", { class: "ud-gh-grains" }, gGh);
    for (const g of inGlass) grains.push({ ...g, el: svgEl("ellipse", { rx: f1(g.rx), ry: 0 }, gGhGr) });
    const ghEdge = svgEl("path", { class: "ud-gh-edge" }, gGh);

    // ---- the top strip (it bends into the squeeze), its current dots, the solder joints
    const tFront = svgEl("path", { class: "ud-g-l" }, gU);
    const tEnd = svgEl("path", { class: "ud-g-r" }, gU);
    const tTop = svgEl("path", { class: "ud-g-top" }, gU);
    const tDots = svgEl("path", { class: "ud-dot ud-dot-on-strip" }, gU);
    dotPaths.push(tDots);
    const jointC = svgEl("circle", { class: "ud-joint", r: Z.joint }, gU);
    svgEl("circle", { class: "ud-joint", cx: f1(ebx), cy: f1(eby), r: Z.joint }, gU);

    // ---- the press tip: a rubber cylinder with a rounded end, coming in from the top (faded in)
    const gT = svgEl("g", { class: "ud-tip", mask: `url(#${uid}-fade)` }, svg);
    const tipBody = svgEl("path", { class: "ud-tip-body", fill: `url(#${uid}-tip)` }, gT);
    const tipHi = svgEl("path", { class: "ud-tip-hi" }, gT);

    // ---- symbols over the wires: nodes, the +5 V terminal, the voltmeter, its reading
    const gS = svgEl("g", { class: "ud-sym" }, svg);
    svgEl("circle", { class: "ud-node-dot", cx: f1(xc), cy: yA, r: Z.node }, gS);
    svgEl("circle", { class: "ud-node-dot", cx: f1(xc), cy: yG, r: Z.node }, gS);
    svgEl("circle", { class: "ud-term", cx: f1(ebx), cy: f1(yT), r: Z.term }, gS);
    const rv = plan.mini ? 8 : RV;
    svgEl("circle", { class: "ud-vm", cx: f1(xV), cy: f1(cyV), r: rv }, gS);
    const vt = svgEl("text", { class: "ud-vm-v", x: f1(xV), y: f1(cyV + 0.5), "text-anchor": "middle", "dominant-baseline": "central" }, gS);
    vt.textContent = "V";
    const boxW = plan.boxW;
    let read: SVGTextElement | null = null;
    let bar: SVGRectElement | null = null;
    if (!plan.mini) {
      const bx = xV - RV - Z.boxGap - boxW;
      const by = cyV - Z.boxTop;
      svgEl("rect", { class: "ud-screen", x: f1(bx), y: f1(by), width: boxW, height: Z.boxH, rx: Z.boxR }, gS);
      read = svgEl("text", { class: "ud-read", x: f1(bx + boxW / 2), y: f1(by + Z.readDy), "text-anchor": "middle", "dominant-baseline": "central" }, gS);
      // the share of the 5 V that lands on R1
      svgEl("rect", { class: "ud-track", x: f1(bx + 2), y: f1(by + Z.barDy), width: boxW - 4, height: Z.barH, rx: Z.barH / 2 }, gS);
      bar = svgEl("rect", { class: "ud-bar", x: f1(bx + 2), y: f1(by + Z.barDy), width: 0, height: Z.barH, rx: Z.barH / 2 }, gS);
    }

    // ---- labels
    const lab = (x: number, y: number, t: string, anchor: "start" | "end", cls = "ud-lab") => {
      const e = svgEl("text", { class: cls, x: f1(x), y: f1(y), "text-anchor": anchor, "dominant-baseline": "central" }, svg);
      e.textContent = t;
      return e;
    };
    const T = S();
    if (!plan.mini) lab(ux - s * ends, yTop, T.topStrip, "start");
    lab(ebx - Z.term - (plan.mini ? 4 : Z.gap), yT, "+5 V", "end");
    if (plan.mini) {
      // short tags (no room for the long names): "top" over the top strip's left end (level with "+5 V") and "bottom"
      // beside the bottom strip's front end. (The film has no free side for a "Velostat" tag at this size: under its
      // front it would sit right over "bottom" and read as one label; the step text names it.)
      lab(ux - s * ends, uy + s * yEnds - 9, T.top, "start", "ud-lab ud-lab-mini");
      const [bx, by] = P(HS, L, TB / 2);
      lab(bx + 5, by, T.bottom, "start", "ud-lab ud-lab-mini");
    } else if (narrow) {
      lab(ux + s * armV[0] - Z.gap, uy + s * armV[1], "Velostat", "end");
      lab(ebx + Z.gap, yUnit + Z.botDy, T.botStrip, "start");
    } else {
      const [vlx, vly] = P(-HV, HV, REST.zV0 + VT / 2);
      lab(vlx - Z.gap, vly, "Velostat", "end");
      lab(ux + s * armL[0] - Z.gap, uy + s * armL[1], T.botStrip, "end");
    }
    if (plan.mini) {
      lab(xc + 7, yA, "A0", "start");
      lab(xc - 9, (yR0 + yR1) / 2 - 6, "R1", "end", "ud-lab ud-lab-strong");
      lab(xc - 9, (yR0 + yR1) / 2 + 6, "10 kΩ", "end");
      lab(xc - 11, yG + 8, "GND", "end");
    } else {
      lab(xc + Z.a0, yA, "A0", "start");
      lab(xc + Z.r1, (yR0 + yR1) / 2 - Z.r1dy, "R1", "start", "ud-lab ud-lab-strong");
      lab(xc + Z.r1, (yR0 + yR1) / 2 + Z.r1dy, "10 kΩ", "start");
      lab(xc + Z.gnd, yG + Z.gndDy, "GND", "start");
    }
    // the touch spot's tag, right of the spot and clear of the section face's lower edge even pressed hard (the film
    // then sits on the bottom strip, z = TB), with a thin teal leader to the spot. It sits right of the glass half's
    // right side (at its lowest, pressed hard) as far as the sense column (a gap left of it) allows; in a card too
    // narrow for that its first letters lie over the glass, whose edges stop short of them
    const gb = [s * sxOf(HV, HS), s * syOf(HV, HS, TB)]; // the glass's back-right bottom corner, pressed hard
    const gf = [s * sxOf(HV, HV), s * syOf(HV, HV, TB)]; // and its front-right one
    const yTag = uy + gb[1] + Z.tagDy;
    const xGlass = gb[0] + (2 * (gf[0] - gb[0])) / (gf[1] - gb[1]); // the glass's right edge at the tag's top (2 px down)
    const xTag = ux + Math.max(cut[0] * s + Z.gap, Math.min(xGlass + Z.gap, xc - ux - Z.gap - wTag));
    let tag: SVGTextElement | null = null;
    let tagKnock: SVGTextElement | null = null;
    let lead: SVGPathElement | null = null;
    if (!plan.mini) {
      lead = svgEl("path", { class: "ud-lead" }, svg);
      lab(xTag, yTag, T.spot, "start", "ud-tag");
      tag = lab(xTag, yTag + Z.tagLine, "", "start", "ud-val");
      // (the glass's edges stop short of the tag's letters: a mask with the same two lines, a little bolder)
      const knock = svgEl("mask", { id: `${uid}-knock`, maskUnits: "userSpaceOnUse", x: 0, y: -2, width: W, height: H + 4 }, defs);
      svgEl("rect", { x: 0, y: -2, width: W, height: H + 4, fill: "#fff" }, knock);
      svgEl("text", { class: "ud-knock-tag", x: f1(xTag), y: f1(yTag), "dominant-baseline": "central" }, knock).textContent = T.spot;
      tagKnock = svgEl("text", { class: "ud-knock-val", x: f1(xTag), y: f1(yTag + Z.tagLine), "dominant-baseline": "central" }, knock);
      ghEdge.setAttribute("mask", `url(#${uid}-knock)`);
    }

    // the scrub area: the unit (above the circuit); push down = press harder
    const hit = { y0: 0, y1: Math.round(yUnit) };
    const hr = svgEl("rect", { class: "ud-hit", x: f1(ux - s * (ends + 4)), y: 0, width: f1(s * (ends + 4) * 2), height: hit.y1 }, svg);
    hr.addEventListener("pointerenter", onEnter);
    hr.addEventListener("pointerleave", onLeave);
    hr.addEventListener("pointerdown", onDown);
    hr.addEventListener("pointermove", onMove);
    hr.addEventListener("pointerup", onUp);
    hr.addEventListener("pointercancel", onLeave);

    // (a card too narrow for the unit and its labels even at the smallest scale, ~185-216 px beside the pad in a 480-650
    // px window: the labels would run past the card's edges, which cut them (more than a 1 px nick); the mini form, whose
    // short labels fit. Not in the host's short form, its last try in a short band (a 640 x 360 phone on its side): the
    // mini form, taller, would not fit there either and the card would be capped, its V row cut in half)
    const box = !mini && !large && !root.closest("[data-short]") ? el.closest<HTMLElement>(".demo-card") : null;
    if (box) {
      let bb: DOMRect | null = null;
      try {
        bb = svg.getBBox();
      } catch {
        bb = null; // (not rendered)
      }
      const sx = svg.getBoundingClientRect().left;
      const br = box.getBoundingClientRect();
      if (bb && bb.width && (sx + bb.x < br.left + box.clientLeft - 1.5 || sx + bb.x + bb.width > br.right - box.clientLeft + 1.5))
        return build(W, compact, large, budget, true);
    }
    // (the large form: the scale it got, and the one its width alone allows its plan, so relayout can give it more
    // height)
    const got = { s, sW: large && budget > 0 ? fit(plan, true).s : s };
    if (large) svg.dataset.plan += ` width-only ${got.sW.toFixed(2)}`;
    A = { short: plan.short, P, s, ux, vTop, vSide, vShade, vRim, vWall, ghLeft, ghFarEdge, ghTop, ghFront, ghSide, ghEdge, grains, chains, spot, tTop, tFront, tEnd, tDots, tipBody, tipHi, wireC, dotsC, jointC, xc, yR0, dotPaths, tag, tagKnock, lead, leadFrom: [xTag - Z.leadX, yTag], read, bar, barW: boxW - 4, hit, dotK: Z.dotK };
    return got;
  };

  let lastAria = -1;
  let lastR = "";
  let lastV = "";
  const draw = () => {
    const r = rTaxel(press);
    const v = vOf(r);
    const rTxt = `R = ${fmtR(r)}`;
    const vTxt = `V = ${fmtV(v)}`;
    const pv = Math.round(press * 100);
    if (pv !== lastAria || rTxt !== lastR || vTxt !== lastV) {
      lastAria = pv;
      anim.setAttribute("aria-valuenow", String(pv));
      anim.setAttribute("aria-valuetext", fillT(S().valuetext, { p: press.toFixed(2), r: fmtR(r), v: fmtV(v) }));
    }
    if (!A) return;
    if (rTxt !== lastR) {
      lastR = rTxt;
      subR.textContent = fmtR(r);
      if (A.tag) A.tag.textContent = rTxt;
      if (A.tagKnock) A.tagKnock.textContent = rTxt;
      else miniR.textContent = fmtR(r);
    }
    if (vTxt !== lastV) {
      lastV = vTxt;
      subV.textContent = fmtV(v);
      if (A.read) A.read.textContent = A.short ? fmtV(v) : vTxt;
      else miniV.textContent = fmtV(v);
    }
    if (A.bar) A.bar.setAttribute("width", f1(Math.max(1.5, (A.barW * v) / VCC)));
    else miniBar.style.width = `${((100 * v) / VCC).toFixed(1)}%`;
    const { P } = A;
    const k = poseOf(press);
    const { zV0, zV1, zTb } = k;
    const zTop0 = zV0 + VT;
    // the Velostat's back half: its top (dipping where the tip squeezes it), its right side, its section face (y = HS)
    const wallXs = range(HV, -HV, 40);
    const wallTop = wallXs.map((x) => P(x, HS, zV1(x, HS)));
    A.vTop.setAttribute("d", pathOf([P(-HV, -HV, zTop0), P(HV, -HV, zTop0), ...wallTop]));
    A.vSide.setAttribute("d", pathOf([P(HV, -HV, zV0), P(HV, HS, zV0), P(HV, HS, zTop0), P(HV, -HV, zTop0)]));
    A.vWall.setAttribute("d", pathOf([P(-HV, HS, zV0), P(HV, HS, zV0), ...wallTop]));
    const shXs = range(-HV, HV, 32);
    A.vShade.setAttribute("d", pathOf([...shXs.map((x) => P(x, -HS, zV1(x, -HS))), ...[...shXs].reverse().map((x) => P(x, HS, zV1(x, HS)))]));
    A.vRim.setAttribute(
      "d",
      pathOf([P(HV, -HV, zTop0), ...wallTop], false),
    );
    // grains ride on their faces (a fraction up the side's thickness)
    for (const g of A.grains) {
      let q: [number, number];
      if (g.face === "top") q = P(g.x, g.y, zV1(g.x, g.y));
      else if (g.face === "wall") q = P(g.x, g.y, zV0 + g.v * (zV1(g.x, g.y) - zV0));
      else q = P(g.x, g.y, zV0 + g.v * VT);
      const rx = +(g.el.getAttribute("rx") || 1);
      g.el.setAttribute("cx", f1(q[0]));
      g.el.setAttribute("cy", f1(q[1]));
      g.el.setAttribute("ry", f1(g.face === "top" ? rx * 0.58 : rx));
    }
    // the paths: top strip -> a chain of touching grains -> bottom strip, on the section face (y = HS)
    const sq = k.dent / (0.35 * VT);
    A.chains.forEach((c, i) => {
      const on = smooth(PATH_ON[i], PATH_ON[i] + 0.12, press);
      const pts: [number, number][] = [P(c.x, HS, zV1(c.x, HS))];
      PATH_V.forEach((vv, j) => {
        const x = c.x + PATH_JIT[j] * c.flip * (1 - 0.35 * sq);
        pts.push(P(x, HS, zV0 + 0.12 + vv * (zV1(x, HS) - zV0 - 0.24)));
      });
      pts.push(P(c.x, HS, zV0));
      const d = pathOf(pts, false);
      c.glow.setAttribute("d", d);
      c.core.setAttribute("d", d);
      const o = on.toFixed(3);
      c.glow.style.opacity = c.core.style.opacity = o;
      c.nodes.forEach((nd, j) => {
        for (const e of [nd, c.grains[j]]) {
          e.setAttribute("cx", f1(pts[j + 1][0]));
          e.setAttribute("cy", f1(pts[j + 1][1]));
        }
        nd.style.opacity = o;
      });
    });
    // the touch spot's outline: the film between the strips, on the section face; the tag's leader to its right side
    A.spot.setAttribute("d", pathOf([P(-HS + 0.8, HS, zV0 + 0.7), P(HS - 0.8, HS, zV0 + 0.7), ...range(HS - 0.8, -HS + 0.8, 12).map((x) => P(x, HS, zV1(x, HS) - 0.7))]));
    if (A.lead) A.lead.setAttribute("d", pathOf([A.leadFrom, P(HS - 0.8, HS, (zV0 + zV1(HS, HS)) / 2)], false));
    // the glass front half, squeezed with the back half (its top dips beside the crossing): its top, front and right
    // side, and its own edges (the top's left edge, the front's three, the right side's two; its back edges are the
    // section face's, drawn with the back half)
    A.ghLeft.setAttribute("d", pathOf([P(-HV, HS, zV0), P(-HV, HV, zV0), P(-HV, HV, zTop0), P(-HV, HS, zTop0)]));
    A.ghFarEdge.setAttribute("d", pathOf([P(-HV, HS, zV0), P(-HV, HV, zV0)], false));
    A.ghTop.setAttribute("d", pathOf([...[...wallTop].reverse(), P(HV, HV, zTop0), P(-HV, HV, zTop0)]));
    A.ghFront.setAttribute("d", pathOf([P(-HV, HV, zV0), P(HV, HV, zV0), P(HV, HV, zTop0), P(-HV, HV, zTop0)]));
    A.ghSide.setAttribute("d", pathOf([P(HV, HS, zV0), P(HV, HV, zV0), P(HV, HV, zTop0), P(HV, HS, zTop0)]));
    A.ghEdge.setAttribute(
      "d",
      pathOf([P(-HV, HS, zTop0), P(-HV, HV, zTop0), P(HV, HV, zTop0), P(HV, HS, zTop0)], false) +
        pathOf([P(-HV, HV, zTop0), P(-HV, HV, zV0), P(HV, HV, zV0), P(HV, HS, zV0)], false) +
        pathOf([P(HV, HV, zV0), P(HV, HV, zTop0)], false),
    );
    // the top strip, bent into the squeeze
    const xs = range(-L, L, 56);
    const top = (x: number) => zTb(x) + TT;
    A.tTop.setAttribute("d", pathOf([...xs.map((x) => P(x, -HS, top(x))), ...[...xs].reverse().map((x) => P(x, HS, top(x)))]));
    A.tFront.setAttribute("d", pathOf([...xs.map((x) => P(x, HS, top(x))), ...[...xs].reverse().map((x) => P(x, HS, zTb(x)))]));
    A.tEnd.setAttribute("d", pathOf([P(L, -HS, zTb(L)), P(L, HS, zTb(L)), P(L, HS, top(L)), P(L, -HS, top(L))]));
    A.tDots.setAttribute("d", pathOf(range(0, L - 3, 28).map((x) => P(x, 0, top(x))), false));
    // the sense column: from the top strip's right end (which comes down with the layers) to R1
    const [ex, ey] = P(L, 0, zTb(L) + TT / 2);
    const col = `M${f1(ex)} ${f1(ey)}${Math.abs(A.xc - ex) > 0.5 ? `H${f1(A.xc)}` : ""}V${A.yR0}`;
    A.wireC.setAttribute("d", col);
    A.dotsC.setAttribute("d", col);
    A.jointC.setAttribute("cx", f1(ex));
    A.jointC.setAttribute("cy", f1(ey));
    // the tip: hovers at rest, lands on the crossing, then pushes; its rounded end flattens as it pushes
    const apex = top(0) + k.lift;
    const [tx, ya] = P(0, 0, apex);
    const yb = P(0, 0, apex + k.hd)[1];
    const rx = TIP_R * A.s;
    const ry = Math.max(rx * SE, ya - yb);
    A.tipBody.setAttribute("d", `M${f1(tx - rx)} -2V${f1(yb)}A${f1(rx)} ${f1(ry)} 0 0 0 ${f1(tx + rx)} ${f1(yb)}V-2Z`);
    const hx = tx - rx * 0.5;
    A.tipHi.setAttribute("d", `M${f1(hx)} -2V${f1(yb + ry * 0.35)}`);
  };

  // ------------------------------------------------------------------ the current: dots move at a speed set by it
  let dotOff = 0;
  const moveDots = (dt: number) => {
    if (!A) return;
    dotOff -= ((DOT_MAX * A.dotK * ampsOf(rTaxel(press))) / I_HARD) * dt;
    if (dotOff < -1e4) dotOff += 1e4;
    const o = f1(dotOff);
    for (const p of A.dotPaths) p.style.strokeDashoffset = o;
  };

  // ------------------------------------------------------------------ the figure: press the ringed crossing in step
  let sentP = 0;
  let sentAt = -1e9;
  let sendTimer = 0;
  const canSend = () => Boolean(figure && figure.status === "ready" && figure.supports("focus") && figure.lastFocus && figure.lastFocus.sense !== null);
  const send = () => {
    sendTimer = 0;
    if (!canSend()) return;
    const p = Math.round(press * 1000) / 1000;
    if (Math.abs(p - sentP) < 0.004 && !(p === 0 && sentP !== 0) && !(p === 1 && sentP !== 1)) return;
    sentP = p;
    sentAt = performance.now();
    const f = figure!.lastFocus!;
    // (focus: true: only ever the ring's press; a late one after the ring has gone is dropped, never feel mode's)
    figure!.act("press", { sense: f.sense, drive: f.drive, amount: p, focus: true }, { once: true });
  };
  const sync = () => {
    if (sendTimer) return;
    const wait = sentAt + SEND_MS - performance.now();
    if (wait <= 0) send();
    else sendTimer = window.setTimeout(send, wait);
  };
  // after a reload (a theme switch) the figure starts untouched: tell it where the press is now
  const offStatus = figure
    ? figure.onStatus((s) => {
        if (s === "loading") sentP = 0;
        else if (s === "ready") window.setTimeout(sync, 300);
      })
    : () => {};

  const setPress = (p: number) => {
    press = clamp01(p);
    draw();
    sync();
  };

  // the large form (see the header): the card the host gives it, and the height it fills there
  const card = el.closest<HTMLElement>(".demo-card");
  /** The height the large form's drawing fills: the card's inner height (given through its inline style.height) less
   *  this card's padding, its other rows (kicker, formula lines, the plain line unless compact) and the gaps between
   *  them; 0 when the card has no height given (the drawing takes its own). */
  const budgetOf = () => {
    if (!card || !card.style.height) return 0;
    const cs = getComputedStyle(root);
    const top = root.getBoundingClientRect().top - card.getBoundingClientRect().top - card.clientTop;
    let h = card.clientHeight - top - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    let rows = 0;
    for (const c of Array.from(root.children)) {
      const st = getComputedStyle(c);
      if (st.display === "none") continue;
      rows++;
      if (c !== anim) h -= c.getBoundingClientRect().height + parseFloat(st.marginTop) + parseFloat(st.marginBottom);
    }
    h -= (parseFloat(cs.rowGap) || 0) * Math.max(0, rows - 1);
    return Math.max(0, Math.floor(h));
  };

  // sizes come from the card's size: the drawing is rebuilt at the width it is shown (on a resize, or at once when the
  // card's host asks, layout(), so the card's height is true when the host measures it); a large card (LARGE_W) gets
  // the large form, filling the height its host gives it
  // (a large card whose height, not its width, limits the unit drops the live-numbers line, so the unit grows instead)
  let subOff = false;
  const relayout = () => {
    if (!root.isConnected) return;
    const large = el.clientWidth >= LARGE_W;
    root.classList.toggle("is-large", large);
    root.classList.remove("no-sub");
    // (the drawing's width after the form's padding; the same measure on every path, so they never disagree by 1 px)
    const W = Math.round(anim.getBoundingClientRect().width);
    const compact = Boolean(root.closest("[data-compact]"));
    const budget = large ? budgetOf() : 0;
    const key = `${W}${compact ? " compact" : ""}${root.closest("[data-short]") ? " short" : ""}${large ? ` large ${budget}` : ""}`;
    if (key === builtKey) {
      root.classList.toggle("no-sub", subOff);
      return;
    }
    builtKey = key;
    subOff = false;
    const got = build(W, compact, large, budget);
    if (got && large && budget > 0 && got.s < got.sW * 0.96) {
      subOff = true;
      root.classList.add("no-sub");
      build(W, compact, large, budgetOf());
    }
    lastR = lastV = "";
    draw();
    moveDots(0);
  };
  // (the drawing's width, and the card's size: a host that gives the large form a new height)
  const ro = new ResizeObserver(() => relayout());
  ro.observe(anim);
  if (card) ro.observe(card);

  // ------------------------------------------------------------------ motion
  let phase = 0;
  let paused = reduced;
  let visible = !document.hidden;
  let onscreen = true;
  let raf = 0;
  let last = 0;
  let resumeT = 0;
  const holds = new Set<string>();

  const tick = (now: number) => {
    raf = 0;
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (!paused) {
      phase = (phase + dt) % LOOP;
      setPress(loopPress(phase));
    }
    moveDots(dt);
    run();
  };
  // the frame loop runs while the card is seen: it moves the press (unless paused) and the current's dots (which keep
  // flowing at the scrubbed press); reduced motion moves neither
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
  const hold = (why: string) => {
    holds.add(why);
    paused = true;
    clearTimeout(resumeT);
  };
  const unhold = (why: string) => {
    if (!holds.delete(why) || holds.size || reduced) return;
    clearTimeout(resumeT);
    resumeT = window.setTimeout(() => {
      // carry on from the current press (on the way down), so nothing jumps
      phase = phaseFor(press);
      paused = false;
    }, RESUME_MS);
  };

  // scrubbing: up / down on the 3D unit (push down = press harder)
  const fromHit = (e: PointerEvent) => {
    if (!A) return press;
    const b = svg.getBoundingClientRect();
    const y = e.clientY - b.top;
    const hh = A.hit.y1 - A.hit.y0;
    return (y - A.hit.y0 - hh * 0.14) / (hh * 0.6);
  };
  function onEnter(e: PointerEvent) {
    if (e.pointerType !== "touch") hold("pointer");
  }
  function onLeave() {
    if (!dragging) unhold("pointer");
  }
  let dragging = false;
  function onDown(e: PointerEvent) {
    hold("pointer");
    dragging = true;
    try {
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
    } catch {
      /* capture is optional */
    }
    setPress(fromHit(e));
  }
  function onMove(e: PointerEvent) {
    if (e.pointerType === "touch" && !e.buttons) return;
    if (!holds.has("pointer")) hold("pointer");
    setPress(fromHit(e));
  }
  function onUp(e: PointerEvent) {
    dragging = false;
    // a mouse that let go over the drawing keeps the hover hold until it leaves
    const t = e.currentTarget as Element;
    const b = t.getBoundingClientRect();
    const inside = e.clientX >= b.left && e.clientX <= b.right && e.clientY >= b.top && e.clientY <= b.bottom;
    if (e.pointerType === "touch" || !inside) unhold("pointer");
  }

  anim.addEventListener("keydown", (e) => {
    const step = e.shiftKey ? 0.2 : 0.05;
    const to =
      e.key === "ArrowRight" || e.key === "ArrowUp" ? press + step
      : e.key === "ArrowLeft" || e.key === "ArrowDown" ? press - step
      : e.key === "PageUp" ? press + 0.2
      : e.key === "PageDown" ? press - 0.2
      : e.key === "Home" ? 0
      : e.key === "End" ? 1
      : null;
    if (to === null) return;
    e.preventDefault();
    hold("key");
    // keys move in clean steps from wherever the loop was
    setPress(Math.round(to * 100) / 100);
  });
  // keyboard focus pauses the loop too (a screen reader would otherwise hear the value change all the time)
  anim.addEventListener("focus", () => {
    if (anim.matches(":focus-visible")) hold("key");
  });
  anim.addEventListener("blur", () => unhold("key"));

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

  // a language switch: the words, and the drawing built again with its labels in the new language (the press, the loop
  // and the figure's crossing carry on)
  const offLang = ctx.onLang(() => {
    paintText(root, S(), { a: arrow });
    builtKey = "";
    lastAria = -1;
    relayout();
  });

  draw();
  run();

  return {
    layout() {
      relayout();
    },
    destroy() {
      offLang();
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      clearTimeout(resumeT);
      clearTimeout(sendTimer);
      offStatus();
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      // let go of the crossing in the figure
      if (sentP > 0 && canSend()) figure!.act("press", null, { once: true });
      root.remove();
    },
  };
}
