// A pad made of points: the card for Lesson 3.2 ("In simulation"). How a simulator sees a FlexiTac pad: not as a
// sandwich of films but as 12 x 32 = 384 points on the finger's face, numbered exactly like a real frame.
//   (a) an isometric drawing of a fin-shaped soft finger (the UMI fin in its real orange TPU, D11), lying on its back
//       so its gripping face looks up at you: the open side shows its slanted ribs, the base its three mounting holes.
//       The amber pad lies on the face (its own outline and a laminate sheen, so it reads apart from the TPU), its tail
//       wraps over the fingertip to the back (the FlexiTac team's build). On the pad: faint gold lines and, where they
//       cross, the 384 points of the simulator (@shared/models/touchsim.mjs: the pad is a lattice at 2 mm pitch, in the
//       real frame order k = i * 32 + j).
//   (b) an object the learner moves over the face (a fingertip-size ball, or a tube lying across like the test tube
//       in the team's photo), drawn as glass so the points under it stay in view. Hover: it floats above, its shadow
//       on the face; press (hold the button): it comes down
//       1.3 mm into the face (PRESETS.firmDepth). Every point is tested against the object every frame (touchsim
//       measureDepth: the signed distance to its surface): a point inside it is TOUCHED (teal, as Lesson 2's touch
//       spots), one within 2.5 mm is NEAR (a fainter teal). Off the pad (near the base) nothing lights: only the points
//       can feel.
//   (c) the frame as a map: 12 rows (sense lines i, the far side of the pad on top) x 32 columns (drive lines j, base on
//       the left, fingertip on the right), so the map IS the pad seen from above. Hover a square (or the object's spot)
//       to read its number k = i x 32 + j. "Order" runs a cursor through k = 0, 1, 2, ... 383 on both the pad and the map,
//       slowly through the first row, then faster, leaving a trail: the reading order of a real frame.
//   (d) "Bent": the fin wraps (a smooth curl from where the pad starts to the tip, ~18°, the tip rising ~11 mm; the
//       base part stays straight); the points ride along with the face (touchsim Pad.setBend, the same arc) and keep
//       their numbers: the map does not change order.
// Motion: an idle tour moves the object (press, slide, lift, travel; once off the pad), with an exponential follow
// so nothing jumps. Pointer or keyboard pauses it; it resumes 3 s after the pointer leaves. Play / pause button.
// Reduced motion: no tour, no sweep animation (Order shows the whole trail at once), moves are immediate. The loop
// stops while the tab is hidden or the card is off screen.
// Forms from the drawing's width W: large (W >= 470: the map with its numbers beside the readout), medium (the map
// full width, the readout under it), mini (W < 300: no axis numbers, icon buttons). The drawing's scale fits the
// width, and under a height budget (data-max-h on the card or an ancestor, or the card's inline height) also the
// height; the host's compact form drops the closing sentence (.demo-extra).
// ILLUSTRATIVE: a simplified in-browser model (touchsim LABEL); the press depth is the engine's preset, not measured.
//
// The module also exports the art the other Section 3 cards share (sim-springs.ts, sim-playground.ts): the camera,
// the fin with its pad (FinView), the objects (ObjView: ball, tube, box edge, strawberry) and the 12 x 32 map
// (PadMap, viridis with a quiet neutral zero as Lesson 1's maps).
import {
  PRESETS,
  TAXELS,
  box,
  cylinder,
  makePad,
  measureDepth,
  pressOnto,
  rotMul,
  rotX,
  rotY,
  rotZ,
  sphere,
  strawberry,
  transformPoint,
  type Pad,
  type Shape,
} from "@shared/models/touchsim.mjs";
import { VIRIDIS_RGB } from "@shared/models/viridis.mjs";
import { fill as fillT, strings } from "../i18n";
import { paintText } from "../i18n/paint";
import type { WidgetCtx, WidgetInstance } from "../types";
import { h } from "../ui/dom";
import "./sim-points.css";

// ================================================================== shared helpers
export type Vec3 = [number, number, number];
export type Pt = [number, number];
export const NS = "http://www.w3.org/2000/svg";
export function svgEl<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>, parent: Element): SVGElementTagNameMap[K] {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  parent.append(el);
  return el;
}
export const f1 = (n: number) => (Math.round(n * 10) / 10).toString();
export const pathOf = (pts: Pt[], close = true) => pts.map(([x, y], i) => `${i ? "L" : "M"}${f1(x)} ${f1(y)}`).join("") + (close ? "Z" : "");
export const range = (a: number, b: number, n: number) => Array.from({ length: n + 1 }, (_, i) => a + ((b - a) * i) / n);
export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
/** A short, wide window (a phone on its side): a stacked page gives the card no height, and a card in its usual form
 *  (drawing over maps over controls) is two or three times the window's height, so the maps and the controls that
 *  change them are never on screen together. The cards then take their side form (drawing beside the maps; no
 *  taller than the window): sim-points, sim-springs, sim-playground. */
export const shortWindow = () => window.innerHeight < 560 && window.innerWidth > window.innerHeight;
/** Whether a card with no height budget (maxH 0) and `cardW` px wide takes its side form now. */
export const sideForm = (maxH: number, cardW: number) => !maxH && cardW >= 560 && shortWindow();
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const wave = (t: number) => 0.5 - 0.5 * Math.cos(Math.PI * clamp01(t));
const memo = new WeakMap<Element, Record<string, string>>();
/** Set an attribute only when it changes (the frame loops write many). */
export function setAttr(el: Element, name: string, v: string) {
  let m = memo.get(el);
  if (!m) memo.set(el, (m = {}));
  if (m[name] === v) return;
  m[name] = v;
  el.setAttribute(name, v);
}
/** Convex hull (monotone chain) of screen points. */
export function hull(pts: Pt[]): Pt[] {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const cr = (o: Pt, a: Pt, b: Pt) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo: Pt[] = [];
  for (const q of p) {
    while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop();
    lo.push(q);
  }
  const up: Pt[] = [];
  for (let i = p.length - 1; i >= 0; i--) {
    const q = p[i];
    while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop();
    up.push(q);
  }
  up.pop();
  lo.pop();
  return lo.concat(up);
}

// ------------------------------------------------------------------ the camera (orthographic iso, z up)
export interface Cam {
  CA: number;
  SA: number;
  SE: number;
  CE: number;
  /** px per mm, and the screen offset of the world origin */
  s: number;
  ux: number;
  uy: number;
  /** unit vector toward the viewer */
  view: Vec3;
  P(x: number, y: number, z: number): Pt;
  /** screen offset of a world point at s = 1 from the origin */
  raw(x: number, y: number, z: number): Pt;
  /** the world point (x, y) on the plane z that shows at screen (X, Y) */
  toPlane(X: number, Y: number, z: number): [number, number];
}
export function makeCam(azDeg: number, elDeg: number): Cam {
  const AZ = (azDeg * Math.PI) / 180;
  const EL = (elDeg * Math.PI) / 180;
  const CA = Math.cos(AZ);
  const SA = Math.sin(AZ);
  const SE = Math.sin(EL);
  const CE = Math.cos(EL);
  const vl = Math.hypot(SA, CA, SE / CE);
  const cam: Cam = {
    CA,
    SA,
    SE,
    CE,
    s: 1,
    ux: 0,
    uy: 0,
    view: [SA / vl, CA / vl, SE / CE / vl],
    raw: (x, y, z) => [x * CA - y * SA, (x * SA + y * CA) * SE - z * CE],
    P: (x, y, z) => [cam.ux + cam.s * (x * CA - y * SA), cam.uy + cam.s * ((x * SA + y * CA) * SE - z * CE)],
    toPlane: (X, Y, z) => {
      const xp = (X - cam.ux) / cam.s;
      const yp = ((Y - cam.uy) / cam.s + z * CE) / SE;
      return [CA * xp + SA * yp, -SA * xp + CA * yp];
    },
  };
  return cam;
}

// ------------------------------------------------------------------ colours for the maps
export type RGB = [number, number, number];
const VIR = VIRIDIS_RGB as unknown as number[][];
export function parseColor(s: string, fb: RGB): RGB {
  const m = s.trim().match(/^#([0-9a-f]{6})$/i);
  if (m) return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)) as RGB;
  const r = s.match(/rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)/);
  return r ? [+r[1], +r[2], +r[3]] : fb;
}
/** viridis 0..255 with 0 a quiet neutral and values under 0.1 blending in from it (Lesson 1's maps). */
export function viridisLut(zero: RGB): string[] {
  return Array.from({ length: 256 }, (_, q) => {
    if (q === 0) return `rgb(${zero.join(",")})`;
    const c = VIR[q];
    const t = Math.min(1, q / 255 / 0.1);
    return `rgb(${c.map((x, i) => Math.round(zero[i] + (x - zero[i]) * t)).join(",")})`;
  });
}
export const viridisCss = (v: number) => {
  const c = VIR[Math.max(0, Math.min(255, Math.round(255 * v)))];
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
};
export function cssVar(el: Element, name: string, fb: string) {
  return getComputedStyle(el).getPropertyValue(name).trim() || fb;
}

// ------------------------------------------------------------------ the 12 x 32 map (canvas)
/** A 12 x 32 touch map in the frame's layout: row i (sense line) top -> bottom, column j (drive line) left -> right,
 *  cell k = i * 32 + j. Painted on a canvas (device pixels), one square per point with a 1 px gap. */
export class PadMap {
  readonly canvas: HTMLCanvasElement;
  readonly g: CanvasRenderingContext2D;
  rows = 12;
  cols = 32;
  cell = 10;
  constructor(parent: HTMLElement, cls = "") {
    this.canvas = h("canvas", { class: `sp-canvas ${cls}`.trim() });
    parent.append(this.canvas);
    this.g = this.canvas.getContext("2d")!;
  }
  /** Cell size in CSS px (the map is cols x cell + 1 wide). */
  size(cell: number) {
    this.cell = Math.max(2, Math.floor(cell));
    const w = this.cols * this.cell + 1;
    const hh = this.rows * this.cell + 1;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(hh * dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${hh}px`;
    this.g.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  get width() {
    return this.cols * this.cell + 1;
  }
  get height() {
    return this.rows * this.cell + 1;
  }
  /** Paint every cell with fill(k); `gap` is the colour between cells; then extra(g, cell) draws on top. */
  paint(fill: (k: number) => string, gap: string, extra?: (g: CanvasRenderingContext2D, c: number) => void) {
    const { g, cell: c } = this;
    g.fillStyle = gap;
    g.fillRect(0, 0, this.width, this.height);
    const gp = c >= 6 ? 1 : 0.5;
    for (let i = 0; i < this.rows; i++)
      for (let j = 0; j < this.cols; j++) {
        g.fillStyle = fill(i * this.cols + j);
        g.fillRect(j * c + gp, i * c + gp, c - gp, c - gp);
      }
    extra?.(g, c);
  }
  /** The cell under a client point, or -1. */
  cellAt(cx: number, cy: number) {
    const b = this.canvas.getBoundingClientRect();
    const j = Math.floor(((cx - b.left) / b.width) * this.cols);
    const i = Math.floor(((cy - b.top) / b.height) * this.rows);
    return i >= 0 && i < this.rows && j >= 0 && j < this.cols ? i * this.cols + j : -1;
  }
}

// ================================================================== the fin finger and its pad
/** The UMI fin-shaped soft finger (papers.md §1: 40 x 123.4 x 25.8 mm, flat gripping face 25.8 x 119.4 mm), in its
 *  own frame: x along the face from the base (0) to the tip (LF), y across (FW wide, +y toward the viewer), z out of
 *  the face (the face is z = 0, the body below). The FlexiTac pad: a 25.6 x 68 mm laminate on the face whose 24 x 64
 *  mm sensing area starts 5 mm from the tip (as the robot figure, figures/robot/README.md). Ribs, walls and holes are
 *  drawn after the UMI finger's look (not to a drawing): illustrative. */
export const FIN = {
  LF: 119.4,
  FD: 40,
  FW: 25.8,
  /** tip thickness, face and back wall thickness */
  TT: 3.5,
  TW: 2,
  BW: 2,
  /** the solid base block's end and where the solid nose starts (the open side lies between) */
  XB: 10,
  XN: 106,
  /** rib thickness and their bottom ends on the back wall */
  RT: 1.4,
  RIBS: range(18.5, 101.5, 11),
  /** the pad: laminate thickness (drawn), its outline, its sensing area's centre, the tail's half width */
  PAD_T: 0.6,
  PAD_X0: 48.4,
  PAD_X1: 116.4,
  PAD_HW: 12.8,
  PAD_C: 82.4,
  TAIL_HW: 7,
  /** the curl of the "Bent" finger (1/mm), from where the pad starts (BEND_X0) to the tip: the front part wraps up by
   *  ~18°, the tip rises ~11 mm; the base part stays straight (a fin bends most toward its tip) */
  KAPPA: 0.0045,
  BEND_X0: 48.4,
  /** the three mounting holes through the base block (x, z), radius */
  HOLES: [
    [5, -9],
    [5, -19.5],
    [5, -30],
  ] as Pt[],
  HOLE_R: 2,
};
const zBack = (x: number) => -FIN.FD + ((FIN.FD - FIN.TT) * x) / FIN.LF;
const zBackIn = (x: number) => zBack(x) + FIN.BW;
const BL = Math.hypot(FIN.LF, FIN.FD - FIN.TT);
/** up the ribs: perpendicular to the back wall */
const RNX = -(FIN.FD - FIN.TT) / BL;
const RNZ = FIN.LF / BL;

/** A finger-frame point (x along the face, y across, z out of it) with the finger curled by k (1/mm) from BEND_X0 on
 *  (straight before it): the face line is a straight run then an arc, a point z below it sits z along its normal. */
export function finPoint(x: number, y: number, z: number, k: number): Vec3 {
  const x0 = FIN.BEND_X0;
  if (Math.abs(k) < 1e-9 || x <= x0) return [x, y, z];
  const th = k * (x - x0);
  const s = Math.sin(th);
  const c = Math.cos(th);
  return [x0 + s / k - z * s, y, (1 - c) / k + z * c];
}
/** The pad's top surface at (x, y): the face line lifted PAD_T (the engine pad's frame, so the points sit on it). */
export function padTop(x: number, y: number, k: number): Vec3 {
  const p = finPoint(x, y, 0, k);
  p[2] += FIN.PAD_T;
  return p;
}
/** The engine's pad on the face: origin at the sensing area's centre, u along the finger (drive line j runs base ->
 *  tip), v across (sense line i runs far -> near), normal out of the face. */
export function finPad(): Pad {
  return makePad({ frame: { origin: [FIN.PAD_C, 0, FIN.PAD_T], u: [1, 0, 0], v: [0, 1, 0] }, name: "fin" });
}
export function bendPad(pad: Pad, k: number) {
  pad.setBend({ kappa: k, anchor: FIN.BEND_X0 - FIN.PAD_C });
}
/** Screen bounds (at s = 1) of the finger in both poses, and a margin over the pad for an object up to `top` mm high. */
export function finBounds(cam: Cam, top: number) {
  const pts: Vec3[] = [];
  for (const k of [0, FIN.KAPPA])
    for (const x of range(0, FIN.LF, 12)) {
      for (const y of [-FIN.FW / 2, FIN.FW / 2]) {
        pts.push(finPoint(x, y, 0, k), finPoint(x, y, zBack(x), k));
        if (x >= FIN.PAD_X0 - 10) pts.push(finPoint(x, y, top, k));
      }
    }
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const p of pts) {
    const [x, y] = cam.raw(p[0], p[1], p[2]);
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
    y0 = Math.min(y0, y);
    y1 = Math.max(y1, y);
  }
  return { x0, x1, y0, y1 };
}

/** The finger and its pad, drawn into a group: build once, then draw(cam, k) whenever the camera or the curl changes.
 *  The 384 points are circles in k order (dots[k]); their look is the card's (classes / r). Painter's order: the open
 *  side's inside (clipped to the opening: the base block's end, the back wall's inner face, the ribs base -> tip),
 *  the side's solid parts with the mounting holes, the face, the tip's end, then the pad (its edges, top, sheen, gold
 *  lines, the tail over the tip) and the points. */
export class FinView {
  readonly g: SVGGElement;
  readonly dots: SVGCircleElement[] = [];
  private clip: SVGPathElement;
  private baseEnd: SVGPathElement;
  private backIn: SVGPathElement;
  private ribFace: SVGPathElement[] = [];
  private ribEnd: SVGPathElement[] = [];
  private side: SVGPathElement;
  private holes: SVGPathElement[] = [];
  private holeLit: SVGPathElement[] = [];
  private top: SVGPathElement;
  private tipEnd: SVGPathElement;
  private padEdge: SVGPathElement;
  private padStep: SVGPathElement;
  private padTop: SVGPathElement;
  private sheen: SVGPathElement;
  private lines: SVGPathElement;
  private tail: SVGPathElement;
  readonly dotG: SVGGElement;
  constructor(parent: Element, uid: string) {
    const g = (this.g = svgEl("g", { class: "sp-fin" }, parent));
    const defs = svgEl("defs", {}, g);
    const cp = svgEl("clipPath", { id: `${uid}-open` }, defs);
    this.clip = svgEl("path", {}, cp);
    const inside = svgEl("g", { "clip-path": `url(#${uid}-open)` }, g);
    this.baseEnd = svgEl("path", { class: "sp-tpu-in2" }, inside);
    this.backIn = svgEl("path", { class: "sp-tpu-in" }, inside);
    for (let r = 0; r < FIN.RIBS.length; r++) {
      this.ribFace.push(svgEl("path", { class: "sp-tpu-in2" }, inside));
      this.ribEnd.push(svgEl("path", { class: "sp-tpu-l" }, inside));
    }
    this.side = svgEl("path", { class: "sp-tpu-l", "fill-rule": "evenodd" }, g);
    for (let q = 0; q < FIN.HOLES.length; q++) {
      this.holes.push(svgEl("path", { class: "sp-hole" }, g));
      this.holeLit.push(svgEl("path", { class: "sp-hole-lit" }, g));
    }
    this.top = svgEl("path", { class: "sp-tpu-top" }, g);
    this.tipEnd = svgEl("path", { class: "sp-tpu-r" }, g);
    this.padEdge = svgEl("path", { class: "sp-fpc-l" }, g);
    this.padStep = svgEl("path", { class: "sp-fpc-r" }, g);
    this.tail = svgEl("path", { class: "sp-fpc-r" }, g);
    this.padTop = svgEl("path", { class: "sp-fpc-top" }, g);
    this.sheen = svgEl("path", { class: "sp-sheen" }, g);
    this.lines = svgEl("path", { class: "sp-lines" }, g);
    this.dotG = svgEl("g", { class: "sp-dots" }, g);
    for (let k = 0; k < TAXELS; k++) this.dots.push(svgEl("circle", { class: "sp-dot", r: 1 }, this.dotG));
  }

  /** Draw for a camera and a curl; `pad` is the engine's pad (already bent to k) for the points. */
  draw(cam: Cam, k: number, pad: Pad) {
    const { LF, FW, TT, TW, XB, XN, RT, PAD_X0: X0, PAD_X1: X1, PAD_HW: HW, TAIL_HW: T } = FIN;
    const yF = FW / 2;
    const P = (x: number, y: number, z: number) => {
      const w = finPoint(x, y, z, k);
      return cam.P(w[0], w[1], w[2]);
    };
    const T3 = (x: number, y: number) => {
      const w = padTop(x, y, k);
      return cam.P(w[0], w[1], w[2]);
    };
    const n = 30;
    // the opening of the open side (front plane y = +FW/2)
    const open: Pt[] = [...range(XB, XN, n).map((x) => P(x, yF, -TW)), ...range(XN, XB, n).map((x) => P(x, yF, zBackIn(x)))];
    this.clip.setAttribute("d", pathOf(open));
    this.baseEnd.setAttribute("d", pathOf([P(XB, yF, -TW), P(XB, -yF, -TW), P(XB, -yF, zBackIn(XB)), P(XB, yF, zBackIn(XB))]));
    this.backIn.setAttribute("d", pathOf([...range(XB, XN, n).map((x) => P(x, yF, zBackIn(x))), ...range(XN, XB, n).map((x) => P(x, -yF, zBackIn(x)))]));
    // ribs: slats perpendicular to the back wall, from it up to the face wall, across the whole width
    const ribLine = (xb: number) => {
      const zb = zBackIn(xb);
      const L = (-TW - zb) / RNZ;
      return range(0, L, 4).map((t) => [xb + RNX * t, zb + RNZ * t] as Pt);
    };
    FIN.RIBS.forEach((xb, r) => {
      const a = ribLine(xb - RT / 2);
      const b = ribLine(xb + RT / 2);
      this.ribFace[r].setAttribute("d", pathOf([...b.map(([x, z]) => P(x, yF, z)), ...[...b].reverse().map(([x, z]) => P(x, -yF, z))]));
      this.ribEnd[r].setAttribute("d", pathOf([...a.map(([x, z]) => P(x, yF, z)), ...[...b].reverse().map(([x, z]) => P(x, yF, z))]));
    });
    // the side: its outline with the opening cut out (even-odd)
    const outer: Pt[] = [...range(0, LF, n).map((x) => P(x, yF, 0)), P(LF, yF, -TT), ...range(LF, 0, n).map((x) => P(x, yF, zBack(x)))];
    this.side.setAttribute("d", pathOf(outer) + pathOf(open));
    FIN.HOLES.forEach(([hx, hz], q) => {
      const ring = range(0, 2 * Math.PI, 24).map((t) => P(hx + FIN.HOLE_R * Math.cos(t), yF, hz + FIN.HOLE_R * Math.sin(t)));
      this.holes[q].setAttribute("d", pathOf(ring));
      // the lit lower inner wall of the hole (light falls in from above)
      const lit = range(Math.PI * 1.08, Math.PI * 1.92, 8).map((t) => P(hx + FIN.HOLE_R * Math.cos(t), yF, hz + FIN.HOLE_R * Math.sin(t)));
      const lit2 = range(Math.PI * 1.92, Math.PI * 1.08, 8).map((t) => P(hx + FIN.HOLE_R * 0.92 * Math.cos(t), yF, hz + 0.5 + FIN.HOLE_R * 0.8 * Math.sin(t)));
      this.holeLit[q].setAttribute("d", pathOf([...lit, ...lit2]));
    });
    this.top.setAttribute("d", pathOf([...range(0, LF, n).map((x) => P(x, -yF, 0)), ...range(LF, 0, n).map((x) => P(x, yF, 0))]));
    this.tipEnd.setAttribute("d", pathOf([P(LF, yF, 0), P(LF, -yF, 0), P(LF, -yF, -TT), P(LF, yF, -TT)]));
    // the pad: its front edges (pad and tail), the step where the tail leaves it, the tail down the tip's end
    const m = 20;
    this.padEdge.setAttribute(
      "d",
      pathOf([...range(X0, X1, m).map((x) => P(x, HW, 0)), ...range(X1, X0, m).map((x) => T3(x, HW))]) +
        pathOf([...range(X1, LF, 3).map((x) => P(x, T, 0)), ...range(LF, X1, 3).map((x) => T3(x, T))]),
    );
    this.padStep.setAttribute("d", pathOf([P(X1, HW, 0), T3(X1, HW), T3(X1, T), P(X1, T, 0)]));
    {
      const th = k * (LF - FIN.BEND_X0);
      const tx = Math.cos(th) * FIN.PAD_T;
      const tz = Math.sin(th) * FIN.PAD_T;
      const E = (y: number, z: number) => {
        const w = finPoint(LF, y, z, k);
        return cam.P(w[0] + tx, w[1], w[2] + tz);
      };
      this.tail.setAttribute("d", pathOf([T3(LF, -T), T3(LF, T), E(T, -TT), E(-T, -TT)]));
    }
    const outline: Pt[] = [
      ...range(X0, X1, m).map((x) => T3(x, -HW)),
      T3(X1, -T),
      ...range(X1, LF, 3).map((x) => T3(x, -T)),
      ...range(LF, X1, 3).map((x) => T3(x, T)),
      T3(X1, HW),
      ...range(X1, X0, m).map((x) => T3(x, HW)),
    ];
    this.padTop.setAttribute("d", pathOf(outline));
    // the laminate's sheen: a lighter band across the pad, edge to edge
    const band = (xa: number, xb: number) => range(0, 1, 6).map((t) => T3(lerp(xa, xb, t), lerp(-HW, HW, t)));
    this.sheen.setAttribute("d", pathOf([...band(74, 62), ...[...band(81, 69)].reverse()]));
    // gold lines: 12 sense lines along the finger, 32 drive lines across, through the points
    let d = "";
    for (let i = 0; i < 12; i++) {
      const y = pad.rowB[i];
      d += pathOf([T3(FIN.PAD_C - 32.6, y), ...Array.from({ length: 32 }, (_, j) => T3(FIN.PAD_C + pad.colS[j], y)), T3(FIN.PAD_C + 32.6, y)], false);
    }
    for (let j = 0; j < 32; j++) {
      const x = FIN.PAD_C + pad.colS[j];
      d += pathOf([T3(x, -12.2), T3(x, 12.2)], false);
    }
    // (the lines follow the bend through the points: the engine's pad and padTop share one curve)
    this.lines.setAttribute("d", d);
    const pts = pad.points;
    for (let q = 0; q < TAXELS; q++) {
      const [x, y] = cam.P(pts[3 * q], pts[3 * q + 1], pts[3 * q + 2]);
      setAttr(this.dots[q], "cx", f1(x));
      setAttr(this.dots[q], "cy", f1(y));
    }
  }
}

// ================================================================== the objects
export type ObjKind = "ball" | "tube" | "box" | "berry";
/** The objects' names in the current language (call it: OBJ_NAMES()[kind]; docs/i18n.md). */
export const OBJ_NAMES = strings<Record<ObjKind, string>>({ ball: "Ball", tube: "Tube", box: "Edge", berry: "Strawberry" }, { ball: "球", tube: "圆管", box: "横条的棱", berry: "草莓" });
/** The tube's and the edge's angle from the finger's axis (they lie across the face, like the test tube in the team's
 *  photo, refs/s2s3-research/user-photos). */
const TUBE_ANG = (30 * Math.PI) / 180;
const BOX_ANG = (75 * Math.PI) / 180;
/** A shape for an object, at rest orientation (touchsim shapes; sizes illustrative): a fingertip-size ball (r 8 mm),
 *  a 12 mm tube 50 mm long, a 40 mm bar standing on one edge, a 30 x 24 mm strawberry on its side. */
export function makeShape(kind: ObjKind): Shape {
  if (kind === "ball") return sphere({ radius: PRESETS.fingertip.radius });
  if (kind === "tube") return cylinder({ radius: 6, length: 50, axis: "x", round: 1, pose: { rot: rotZ(TUBE_ANG) } });
  if (kind === "box") return box({ size: [40, 12, 12], round: 1, pose: { rot: rotMul(rotZ(BOX_ANG), rotX(Math.PI / 4)) } });
  return strawberry({ length: 30, width: 24, pose: { rot: rotMul(rotZ((32 * Math.PI) / 180), rotY(Math.PI / 2 + 0.12)) } });
}
/** How high (mm) an object reaches over its lowest point: for the camera's top margin. */
export const OBJ_TOP: Record<ObjKind, number> = { ball: 16, tube: 12, box: 17, berry: 24 };

/** An object's drawing: its soft shadow on the face, then the solid (four tones, crisp edge). draw() takes the shape
 *  as the engine has it posed, and the face spot under it for the shadow. */
export class ObjView {
  readonly g: SVGGElement;
  private uid: string;
  private kind: ObjKind | null = null;
  private shadow: SVGPathElement;
  private body: SVGGElement;
  private parts: SVGElement[] = [];
  private grad: SVGLinearGradientElement | null = null;
  /** the object's highest screen point after the last draw (px) */
  top = 0;
  constructor(parent: Element, uid: string) {
    this.uid = uid;
    this.g = svgEl("g", { class: "sp-obj" }, parent);
    const defs = svgEl("defs", {}, this.g);
    const sg = svgEl("radialGradient", { id: `${uid}-shadow` }, defs);
    svgEl("stop", { offset: 0, class: "sp-shadow-s0" }, sg);
    svgEl("stop", { offset: 1, class: "sp-shadow-s1" }, sg);
    const bg = svgEl("radialGradient", { id: `${uid}-ball`, cx: 0.4, cy: 0.34, r: 0.72, fx: 0.36, fy: 0.3 }, defs);
    svgEl("stop", { offset: 0, class: "sp-rub-s0" }, bg);
    svgEl("stop", { offset: 0.55, class: "sp-rub-s1" }, bg);
    svgEl("stop", { offset: 1, class: "sp-rub-s2" }, bg);
    // glass (the see-through look, so the points under an object stay in view): clear in the middle, tinted toward
    // the rim, as a glass ball or tube looks
    const gg = svgEl("radialGradient", { id: `${uid}-glass`, cx: 0.5, cy: 0.5, r: 0.5 }, defs);
    svgEl("stop", { offset: 0.55, class: "sp-glass-s0" }, gg);
    svgEl("stop", { offset: 0.92, class: "sp-glass-s1" }, gg);
    svgEl("stop", { offset: 1, class: "sp-glass-s2" }, gg);
    const rg = svgEl("radialGradient", { id: `${uid}-berry`, cx: 0.42, cy: 0.36, r: 0.7, fx: 0.38, fy: 0.3 }, defs);
    svgEl("stop", { offset: 0, class: "sp-berry-s0" }, rg);
    svgEl("stop", { offset: 0.6, class: "sp-berry-s1" }, rg);
    svgEl("stop", { offset: 1, class: "sp-berry-s2" }, rg);
    this.shadow = svgEl("path", { class: "sp-shadow", fill: `url(#${uid}-shadow)` }, this.g);
    this.body = svgEl("g", {}, this.g);
  }
  private glass = false;
  private reset(kind: ObjKind, glass: boolean) {
    this.kind = kind;
    this.glass = glass;
    this.body.replaceChildren();
    this.body.setAttribute("class", glass ? "is-glass" : "");
    this.parts = [];
    this.grad = null;
    const add = <K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>) => {
      const e = svgEl(tag, attrs, this.body);
      this.parts.push(e);
      return e;
    };
    if (kind === "ball") {
      add("circle", glass ? { class: "sp-glass", fill: `url(#${this.uid}-glass)` } : { class: "sp-ball", fill: `url(#${this.uid}-ball)` });
      add("path", { class: glass ? "sp-glass-hi" : "sp-ball-hi" });
    } else if (kind === "tube") {
      const defs = svgEl("defs", {}, this.body);
      this.grad = svgEl("linearGradient", { id: `${this.uid}-tube`, gradientUnits: "userSpaceOnUse" }, defs);
      if (glass) {
        svgEl("stop", { offset: 0, class: "sp-glass-s2" }, this.grad);
        svgEl("stop", { offset: 0.2, class: "sp-glass-s0" }, this.grad);
        svgEl("stop", { offset: 0.8, class: "sp-glass-s0" }, this.grad);
        svgEl("stop", { offset: 1, class: "sp-glass-s2" }, this.grad);
      } else {
        svgEl("stop", { offset: 0, class: "sp-alu-s0" }, this.grad);
        svgEl("stop", { offset: 0.42, class: "sp-alu-s1" }, this.grad);
        svgEl("stop", { offset: 1, class: "sp-alu-s2" }, this.grad);
      }
      add("path", { class: glass ? "sp-glass" : "sp-tube", fill: `url(#${this.uid}-tube)` });
      add("path", { class: glass ? "sp-glass-shine" : "sp-tube-shine" });
      add("path", { class: glass ? "sp-glass-cap" : "sp-tube-cap" });
      add("path", { class: glass ? "sp-glass-bore" : "sp-tube-bore" });
    } else if (kind === "box") {
      for (let f = 0; f < 3; f++) add("path", { class: "sp-box" });
    } else {
      add("path", { class: "sp-berry", fill: `url(#${this.uid}-berry)` });
      add("g", { class: "sp-seeds" });
      add("g", { class: "sp-calyx" });
    }
  }

  /** Draw the shape; `spot` = the face point under the object and its normal, `lift` = its lowest point's height over
   *  the face (mm, < 0 when it presses in). */
  draw(cam: Cam, kind: ObjKind, shape: Shape, spot: { point: Vec3; normal: Vec3 }, lift: number, glass = false) {
    if (kind !== this.kind || glass !== this.glass) this.reset(kind, glass);
    const pose = shape.pose;
    const W = (p: Vec3) => {
      const w = transformPoint(pose, p);
      return cam.P(w[0], w[1], w[2]);
    };
    const v = cam.view;
    // the shadow: a soft ellipse on the face under the object, darker and smaller as it comes down
    {
      const [px, py, pz] = spot.point;
      const nrm = spot.normal;
      // two directions in the face (the face normal's plane): along the object's long axis when it has one
      const ax: Vec3 = kind === "ball" ? [1, 0, 0] : (transformPoint({ rot: pose.rot }, kind === "berry" ? [0, 0, 1] : [1, 0, 0]) as Vec3);
      const dn = ax[0] * nrm[0] + ax[1] * nrm[1] + ax[2] * nrm[2];
      let e1: Vec3 = [ax[0] - dn * nrm[0], ax[1] - dn * nrm[1], ax[2] - dn * nrm[2]];
      const l1 = Math.hypot(...e1) || 1;
      e1 = [e1[0] / l1, e1[1] / l1, e1[2] / l1];
      const e2: Vec3 = [nrm[1] * e1[2] - nrm[2] * e1[1], nrm[2] * e1[0] - nrm[0] * e1[2], nrm[0] * e1[1] - nrm[1] * e1[0]];
      const sz = { ball: [7.5, 7.5], tube: [24, 6.5], box: [19, 5], berry: [15, 11] }[kind];
      const grow = 1 + Math.max(0, lift) * 0.06;
      const pts = range(0, 2 * Math.PI, 28).map((t) => {
        const a = Math.cos(t) * sz[0] * grow;
        const b = Math.sin(t) * sz[1] * grow;
        return cam.P(px + e1[0] * a + e2[0] * b + nrm[0] * 0.05, py + e1[1] * a + e2[1] * b + nrm[1] * 0.05, pz + e1[2] * a + e2[2] * b + nrm[2] * 0.05);
      });
      setAttr(this.shadow, "d", pathOf(pts));
      setAttr(this.shadow, "opacity", (0.85 - 0.5 * clamp01(lift / 6)).toFixed(2));
    }
    if (kind === "ball") {
      const c = W([0, 0, 0]);
      const r = PRESETS.fingertip.radius * cam.s;
      const e = this.parts[0];
      setAttr(e, "cx", f1(c[0]));
      setAttr(e, "cy", f1(c[1]));
      setAttr(e, "r", f1(r));
      this.top = c[1] - r;
      // a highlight: a short arc on the upper left, inside the rim
      // (a closed crescent, so no line ends on the bare surface)
      const out = range(Math.PI * 1.02, Math.PI * 1.5, 12).map((t) => [c[0] + 0.8 * r * Math.cos(t), c[1] + 0.8 * r * Math.sin(t)] as Pt);
      const inn = range(Math.PI * 1.5, Math.PI * 1.02, 12).map((t) => [c[0] + 0.1 * r + 0.72 * r * Math.cos(t), c[1] + 0.1 * r + 0.72 * r * Math.sin(t)] as Pt);
      setAttr(this.parts[1], "d", pathOf([...out, ...inn]));
    } else if (kind === "tube") {
      const R = 6;
      const HL = 25;
      const ring = (x: number) => range(0, 2 * Math.PI, 36).map((t) => [x, R * Math.cos(t), R * Math.sin(t)] as Vec3);
      const pts = [...ring(-HL), ...ring(HL)].map(W);
      const sil = hull(pts);
      setAttr(this.parts[0], "d", pathOf(sil));
      this.top = Math.min(...sil.map((p) => p[1]));
      // light across the tube: from its upper silhouette to its lower one, perpendicular to the axis on screen
      const a0 = W([-HL, 0, 0]);
      const a1 = W([HL, 0, 0]);
      let px = -(a1[1] - a0[1]);
      let py = a1[0] - a0[0];
      const pl = Math.hypot(px, py) || 1;
      px /= pl;
      py /= pl;
      if (py > 0) {
        px = -px;
        py = -py;
      }
      const mid: Pt = [(a0[0] + a1[0]) / 2, (a0[1] + a1[1]) / 2];
      const rr = R * cam.s;
      const g = this.grad!;
      setAttr(g, "x1", f1(mid[0] + px * rr));
      setAttr(g, "y1", f1(mid[1] + py * rr));
      setAttr(g, "x2", f1(mid[0] - px * rr));
      setAttr(g, "y2", f1(mid[1] - py * rr));
      // the shine: a line along the tube's lit side, from cap to cap
      const ax = transformPoint({ rot: pose.rot }, [1, 0, 0]);
      const capSign = ax[0] * v[0] + ax[1] * v[1] + ax[2] * v[2] >= 0 ? 1 : -1;
      const sh = (x: number) => W([x, -0.32 * R, 0.78 * R]);
      setAttr(this.parts[1], "d", pathOf([sh(-HL + 0.6), sh(HL - 0.6)], false));
      // the end facing the viewer: its rim and the tube's bore (a test tube is hollow: 1 mm wall)
      setAttr(this.parts[2], "d", pathOf(ring(capSign * HL).map(W)));
      setAttr(this.parts[3], "d", pathOf(range(0, 2 * Math.PI, 30).map((t) => W([capSign * HL, (R - 1) * Math.cos(t), (R - 1) * Math.sin(t)]))));
    } else if (kind === "box") {
      const hx = 20;
      const hy = 6;
      const hz = 6;
      const faces: { n: Vec3; c: Vec3[] }[] = [];
      for (const ax of [0, 1, 2])
        for (const sg of [-1, 1]) {
          const n: Vec3 = [0, 0, 0];
          n[ax] = sg;
          const H: Vec3 = [hx, hy, hz];
          const u = (ax + 1) % 3;
          const w = (ax + 2) % 3;
          const c: Vec3[] = [
            [1, 1],
            [1, -1],
            [-1, -1],
            [-1, 1],
          ].map(([a, b]) => {
            const p: Vec3 = [0, 0, 0];
            p[ax] = sg * H[ax];
            p[u] = a * H[u];
            p[w] = b * H[w];
            return p;
          });
          faces.push({ n, c });
        }
      const vis = faces
        .map((f) => ({ ...f, wn: transformPoint({ rot: pose.rot }, f.n) as Vec3 }))
        .filter((f) => f.wn[0] * v[0] + f.wn[1] * v[1] + f.wn[2] * v[2] > 1e-6);
      for (let q = 0; q < 3; q++) {
        const e = this.parts[q];
        const f = vis[q];
        if (!f) {
          setAttr(e, "d", "");
          continue;
        }
        const sx = f.wn[0] * cam.CA - f.wn[1] * cam.SA;
        const tone = f.wn[2] > 0.55 ? "top" : sx > 0 ? "r" : "l";
        setAttr(e, "class", `${glass ? "sp-box-glass g" : "sp-box sp-alu"}-${tone}`);
        const fp = f.c.map(W);
        setAttr(e, "d", pathOf(fp));
        this.top = Math.min(q ? this.top : Infinity, ...fp.map((p) => p[1]));
      }
    } else {
      const sb = shape as unknown as { rho: Float64Array; z: Float64Array; length: number };
      const M = sb.rho.length;
      const pts: Pt[] = [];
      for (let m = 0; m < M; m += 2) for (const t of range(0, 2 * Math.PI, 23)) pts.push(W([sb.rho[m] * Math.cos(t), sb.rho[m] * Math.sin(t), sb.z[m]]));
      pts.push(W([0, 0, sb.z[M - 1]]), W([0, 0, sb.z[0]]));
      const sil = hull(pts);
      setAttr(this.parts[0], "d", pathOf(sil));
      this.top = Math.min(...sil.map((p) => p[1]));
      // seeds: little yellow dots in pits on the visible side, fading toward the rim
      const seeds = this.parts[1];
      const rot = pose.rot;
      let html = "";
      let q = 0;
      for (let m = 6; m < M - 5; m += 3) {
        const ring = 9 + (m % 2);
        for (let a = 0; a < ring; a++) {
          const t = ((a + (m % 6 ? 0.5 : 0)) / ring) * 2 * Math.PI;
          const rho = sb.rho[m];
          const dr = sb.rho[m + 1] - sb.rho[m - 1];
          const dz = sb.z[m + 1] - sb.z[m - 1];
          const nl = Math.hypot(dr, dz) || 1;
          const nloc: Vec3 = [(dz / nl) * Math.cos(t), (dz / nl) * Math.sin(t), -dr / nl];
          const wn = transformPoint({ rot }, nloc);
          const facing = wn[0] * v[0] + wn[1] * v[1] + wn[2] * v[2];
          if (facing < 0.22) continue;
          const [x, y] = W([rho * Math.cos(t), rho * Math.sin(t), sb.z[m]]);
          const o = clamp01((facing - 0.22) / 0.35);
          const rx = Math.max(0.6, 0.55 * cam.s * 0.5);
          html += `<ellipse class="sp-seed" cx="${f1(x)}" cy="${f1(y)}" rx="${f1(rx)}" ry="${f1(rx * (0.55 + 0.45 * facing))}" opacity="${o.toFixed(2)}"/>`;
          q++;
        }
      }
      seeds.innerHTML = html;
      seeds.setAttribute("data-n", String(q));
      // the calyx: six sepals and a stem on the flat top, when the top faces the viewer
      const calyx = this.parts[2];
      const top = sb.z[M - 1];
      const ax = transformPoint({ rot }, [0, 0, 1]);
      const tf = ax[0] * v[0] + ax[1] * v[1] + ax[2] * v[2];
      let ch = "";
      if (tf > 0.05) {
        for (let s = 0; s < 6; s++) {
          const t = (s / 6) * 2 * Math.PI + 0.3;
          const L = 9 + (s % 2) * 2;
          const leaf = range(0, 1, 8).map((u) => {
            const along = u * L;
            const wdt = Math.sin(Math.PI * u) * 2.6;
            return [along, wdt] as Pt;
          });
          const back = [...leaf].reverse().map(([a, w]) => [a, -w] as Pt);
          const lp = [...leaf, ...back].map(([a, w]) => W([Math.cos(t) * a - Math.sin(t) * w, Math.sin(t) * a + Math.cos(t) * w, top + 0.4 + 0.08 * a]));
          ch += `<path class="sp-leaf" d="${pathOf(lp)}"/>`;
        }
        const stem = range(0, 2 * Math.PI, 12).map((t) => W([1.4 * Math.cos(t), 1.4 * Math.sin(t), top + 1.2]));
        const stemTop = range(0, 2 * Math.PI, 12).map((t) => W([1.2 * Math.cos(t), 1.2 * Math.sin(t), top + 6]));
        ch += `<path class="sp-stem" d="${pathOf(hull([...stem, ...stemTop]))}"/><path class="sp-stem-top" d="${pathOf(stemTop)}"/>`;
      }
      calyx.innerHTML = ch;
    }
  }
}

/** Place an object so its part nearest the pad sinks `depth` into the face at pad spot (a, b) (mm; depth < 0 floats it
 *  above; touchsim pressOnto). On a bent pad a long object placed by that spot's normal can sink one end deeper
 *  than `depth`; with `meas` (measureDepth's arrays) it is then lifted along the normal until no point is deeper:
 *  it rests on the curve. */
export function placeObject(shape: Shape, pad: Pad, a: number, b: number, depth: number, meas?: { dist: Float32Array; depth: Float32Array; which: Int16Array }) {
  pressOnto(shape, pad, { a, b, depth });
  if (!meas || depth <= 0) return;
  for (let it = 0; it < 4; it++) {
    measureDepth(pad, [shape], meas);
    let mx = 0;
    for (let q = 0; q < meas.depth.length; q++) if (meas.depth[q] > mx) mx = meas.depth[q];
    const ex = mx - depth;
    if (ex < 0.01) break;
    const n = pad.surface(a, b).normal;
    const p = shape.pose;
    shape.setPose({ pos: [p.pos[0] + n[0] * ex, p.pos[1] + n[1] * ex, p.pos[2] + n[2] * ex], rot: p.rot });
  }
}

/** A touch screen: the hint says tap, not hover. */
const COARSE = matchMedia("(pointer: coarse)");

// ================================================================== the card
// the card's words (docs/i18n.md): painted from STR() and again on a language switch (the drawing's labels too: it is
// built again)
const STR = strings(
  {
    illTip: "A simplified in-browser model (points + penetration), not a measurement. The press depth (1.3 mm) is the model's preset.",
    name: "A pad made of points",
    ill: "Illustrative",
    animAria:
      "A soft finger lying on its back with a FlexiTac pad on its face: 384 points. Move the pointer over it to move the object; hold the button to press it into the face. Arrow keys move it one point, Space presses or lifts.",
    frame: "The frame",
    axisJ: "drive line j →",
    mapAria: "The touch map: 12 rows (sense lines i) by 32 columns (drive lines j), in the order of a real frame. Hover a square to read its number.",
    touched: "Touched",
    near: "{n} near",
    object: "Object",
    finger: "Finger",
    flat: "Flat",
    bent: "Bent",
    order: "Order",
    pause: "Pause",
    play: "Play",
    pauseAria: "Pause the tour",
    playAria: "Play the tour",
    line: "To the simulator the pad is just 384 points, numbered like a real frame. A point is <b>touched</b> when it ends up inside the object (pale: within 2.5 mm of it); it rides along when the finger bends and keeps its number.",
    softFinger: "soft finger",
    pad: "FlexiTac pad",
    points: "384 points",
    hint: "Hover a square, or move the object over the pad: each point's number is <b>k</b> = <b>i</b> × 32 + <b>j</b>.",
    hintTap: "Tap a square, or move the object over the pad: each point's number is <b>k</b> = <b>i</b> × 32 + <b>j</b>.",
    kline: "sense line {i} · drive line {j}{t}",
    kTouched: ' · <span class="sp-kt">touched</span>',
    desc: "{n} of 384 points touched",
  },
  {
    illTip: "在浏览器里运行的简化模型（点 + 穿透），不是测量结果。按压深度（1.3 mm）是模型的预设值。",
    name: "由点组成的传感垫",
    ill: "示意",
    animAria: "一根仰躺的软指，指面上贴着 FlexiTac 传感垫：384 个点。把指针移到上面来移动物体；按住鼠标键把它压进指面。方向键一次移动一个点，空格键按下或抬起。",
    frame: "一帧",
    axisJ: "驱动线 j →",
    mapAria: "触觉图：12 行（感应线 i）× 32 列（驱动线 j），按真实帧的顺序排列。把指针移到一个方格上，读出它的编号。",
    touched: "被触碰",
    near: "{n} 个靠近",
    object: "物体",
    finger: "手指",
    flat: "平直",
    bent: "弯曲",
    order: "顺序",
    pause: "暂停",
    play: "播放",
    pauseAria: "暂停自动演示",
    playAria: "播放自动演示",
    line: "对仿真器来说，传感垫只是 384 个点，编号方式和真实的帧一样。一个点落进物体内部，就算<b>被触碰</b>（浅色：离物体不到 2.5 mm）；手指弯曲时它跟着移动，编号不变。",
    softFinger: "软指",
    pad: "FlexiTac 传感垫",
    points: "384 个点",
    hint: "把指针移到一个方格上，或把物体移到传感垫上：每个点的编号是 <b>k</b> = <b>i</b> × 32 + <b>j</b>。",
    hintTap: "轻点一个方格，或把物体移到传感垫上：每个点的编号是 <b>k</b> = <b>i</b> × 32 + <b>j</b>。",
    kline: "感应线 {i} · 驱动线 {j}{t}",
    kTouched: ' · <span class="sp-kt">被触碰</span>',
    desc: "384 个点中有 {n} 个被触碰",
  },
);
const HOVER = 4;
const DEPTH = PRESETS.firmDepth;
const NEAR = 2.5;
const RESUME_MS = 3000;
/** The object's range on the face, pad coordinates (mm): a along the finger (the face runs from a = -82.4 at the base
 *  to +37 at the tip), b across. */
const A_MIN = -72;
const A_MAX = 33;
const B_MAX = 12;
type Way = { a: number; b: number; down: boolean; t: number };
/** The idle tour: press, slide, lift, travel, press again, then once near the base, off the pad (nothing lights). */
const TOUR: Way[] = [
  { a: -20, b: 3, down: false, t: 1.0 },
  { a: -20, b: 3, down: true, t: 0.8 },
  { a: -2, b: -4, down: true, t: 2.0 },
  { a: -2, b: -4, down: true, t: 0.7 },
  { a: -2, b: -4, down: false, t: 0.6 },
  { a: 20, b: 5, down: false, t: 1.2 },
  { a: 20, b: 5, down: true, t: 0.8 },
  { a: 20, b: 5, down: true, t: 1.0 },
  { a: 20, b: 5, down: false, t: 0.6 },
  { a: -52, b: -1, down: false, t: 1.6 },
  { a: -52, b: -1, down: true, t: 0.8 },
  { a: -52, b: -1, down: true, t: 1.0 },
  { a: -52, b: -1, down: false, t: 0.6 },
  { a: -20, b: 3, down: false, t: 1.2 },
];
const TOUR_LEN = TOUR.reduce((s, w) => s + w.t, 0) - TOUR[0].t;
function tourAt(t: number) {
  let u = t % TOUR_LEN;
  for (let q = 1; q < TOUR.length; q++) {
    const w = TOUR[q];
    if (u <= w.t) {
      const p = TOUR[q - 1];
      const e = wave(u / w.t);
      return { a: lerp(p.a, w.a, e), b: lerp(p.b, w.b, e), h: lerp(p.down ? -DEPTH : HOVER, w.down ? -DEPTH : HOVER, e) };
    }
    u -= w.t;
  }
  return { a: TOUR[0].a, b: TOUR[0].b, h: HOVER };
}
/** The order sweep: the cursor's k at t seconds (6 a second through the first 36, then faster), the length, the hold. */
const SWEEP_SLOW = 36;
const SWEEP_RATE = 6;
const sweepK = (t: number) => (t < SWEEP_SLOW / SWEEP_RATE ? t * SWEEP_RATE : Math.min(TAXELS - 1, SWEEP_SLOW + 22 * (t - SWEEP_SLOW / SWEEP_RATE) ** 2));
const SWEEP_T = SWEEP_SLOW / SWEEP_RATE + Math.sqrt((TAXELS - 1 - SWEEP_SLOW) / 22);
const SWEEP_HOLD = 2.4;

export interface SimPointsState {
  object: "ball" | "tube";
  bent: boolean;
  /** the object's spot (pad mm) and its lowest point's height over the face (mm, < 0 pressing) */
  a: number;
  b: number;
  lift: number;
  touched: number;
  near: number;
  /** the point the readout names (hovered square, the point under the object, or the sweep's cursor), or null */
  k: number | null;
  playing: boolean;
  sweeping: boolean;
}
export interface SimPointsInstance extends WidgetInstance {
  play(): void;
  pause(): void;
  /** Move / set at once (no easing): the object, the curl, its spot and whether it presses. Pauses the tour. */
  set(v: { object?: "ball" | "tube"; bent?: boolean; a?: number; b?: number; down?: boolean }): void;
  /** Run the order sweep (true), stop it (false); `at` seeks it to that k and holds there (for reviews). */
  order(on?: boolean, at?: number): void;
  state(): SimPointsState;
}

const ICON_PLAY = `<svg class="sp-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z"/></svg>`;
const ICON_PAUSE = `<svg class="sp-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M7.5 5.5h3v13h-3zM13.5 5.5h3v13h-3z"/></svg>`;
const ICON_ORDER = `<svg class="sp-ico sp-ico-line" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h15M19 6l-15 6h15M19 12l-15 6h15"/></svg>`;

let seq = 0;

export function mount(el: HTMLElement, ctx: WidgetCtx): SimPointsInstance {
  const reduced = ctx.reducedMotion();
  const uid = `sp${++seq}`;
  const root = h("div", { class: "sim sp" });
  const T = STR();
  root.innerHTML = `
    <p class="sp-kicker mono"><i class="sp-key" aria-hidden="true"></i><span class="sp-name" data-t="name">${T.name}</span><span class="sp-sep" aria-hidden="true">·</span><span class="sp-ill" title="${T.illTip}" data-t-title="illTip" data-t="ill">${T.ill}</span></p>
    <div class="sp-anim" tabindex="0" role="group" aria-label="${T.animAria}" data-t-aria="animAria"><svg class="sp-svg" aria-hidden="true"></svg></div>
    <div class="sp-row">
      <div class="sp-mapbox">
        <p class="sp-maphead mono"><span data-t="frame">${T.frame}</span><span class="sp-sep" aria-hidden="true">·</span><span class="sp-formula"><b>k</b> = <b>i</b> × 32 + <b>j</b></span></p>
        <div class="sp-mapgrid">
          <span class="sp-ax sp-ax-j mono" aria-hidden="true"><span>j 0</span><span data-t="axisJ">${T.axisJ}</span><span>31</span></span>
          <span class="sp-ax sp-ax-i mono" aria-hidden="true"><span>i 0</span><span>11</span></span>
          <div class="sp-mapcell" role="img" aria-label="${T.mapAria}" data-t-aria="mapAria"></div>
        </div>
      </div>
      <div class="sp-side">
        <p class="sp-count mono">${T.touched} <b class="sp-n">0</b> / 384 <span class="sp-near-n"></span></p>
        <p class="sp-k" aria-live="off"></p>
      </div>
    </div>
    <div class="sp-ctl">
      <span class="sp-seg" role="group" aria-label="${T.object}" data-t-aria="object"><button type="button" class="sp-chip" data-obj="ball" aria-pressed="true">${OBJ_NAMES().ball}</button><button type="button" class="sp-chip" data-obj="tube" aria-pressed="false">${OBJ_NAMES().tube}</button></span>
      <span class="sp-seg" role="group" aria-label="${T.finger}" data-t-aria="finger"><button type="button" class="sp-chip" data-bend="0" aria-pressed="true" data-t="flat">${T.flat}</button><button type="button" class="sp-chip" data-bend="1" aria-pressed="false" data-t="bent">${T.bent}</button></span>
      <button type="button" class="sp-btn sp-order">${ICON_ORDER}<span class="sp-btn-t" data-t="order">${T.order}</span></button>
      <button type="button" class="sp-btn sp-play">${ICON_PAUSE}<span class="sp-btn-t">${T.pause}</span></button>
    </div>
    <p class="sp-line demo-extra" data-t="line">${T.line}</p>`;
  el.append(root);
  if (reduced) root.classList.add("is-reduced");
  const anim = root.querySelector<HTMLElement>(".sp-anim")!;
  const svg = anim.querySelector("svg")!;
  const mapCell = root.querySelector<HTMLElement>(".sp-mapcell")!;
  const nEl = root.querySelector<HTMLElement>(".sp-n")!;
  const nearEl = root.querySelector<HTMLElement>(".sp-near-n")!;
  const kEl = root.querySelector<HTMLElement>(".sp-k")!;
  const playBtn = root.querySelector<HTMLButtonElement>(".sp-play")!;
  const orderBtn = root.querySelector<HTMLButtonElement>(".sp-order")!;
  const objBtns = [...root.querySelectorAll<HTMLButtonElement>("[data-obj]")];
  const bendBtns = [...root.querySelectorAll<HTMLButtonElement>("[data-bend]")];
  const map = new PadMap(mapCell);

  // ------------------------------------------------------------------ the model
  const pad = finPad();
  const shapes: Record<"ball" | "tube", Shape> = { ball: makeShape("ball"), tube: makeShape("tube") };
  let object: "ball" | "tube" = "ball";
  const meas = { dist: new Float32Array(TAXELS), depth: new Float32Array(TAXELS), which: new Int16Array(TAXELS) };
  /** the object now (a, b, its lowest point's height h) and where it is heading */
  const cur = reduced ? { a: -2, b: -3, h: -DEPTH } : { ...tourAt(0) };
  const tgt = { ...cur };
  let bend = 0;
  let bendTo = 0;
  let playing = !reduced;
  let tourT = 0;
  /** a slower follow for a moment after the tour resumes, so the object glides back */
  let glide = 0;
  /** the sweep: time into it (null: off) */
  let sweepT: number | null = null;
  /** a sweep a host has put at one k (order(true, k)) stays there */
  let sweepHeld = false;
  let hoverK: number | null = null;
  let underK: number | null = null;

  const kappa = () => FIN.KAPPA * wave(bend);
  const place = () => {
    bendPad(pad, kappa());
    placeObject(shapes[object], pad, cur.a, cur.b, -cur.h, meas);
    measureDepth(pad, [shapes[object]], meas);
  };

  // ------------------------------------------------------------------ the drawing
  const cam = makeCam(22, 36);
  let fin: FinView | null = null;
  let obj: ObjView | null = null;
  let cursor: { ring: SVGCircleElement; tag: SVGGElement; text: SVGTextElement; box: SVGRectElement; lead: SVGPathElement } | null = null;
  let builtKey = "";
  let drawnK = -1;
  let dotDim = { r0: 1, r1: 2, rn: 1.5 };

  /** Build the drawing W px wide; under a height budget hMax (px) it shrinks, but not under sMin x the width's scale. */
  const build = (W: number, hMax: number, sMin = 0) => {
    svg.replaceChildren();
    const top = Math.max(OBJ_TOP.ball, OBJ_TOP.tube) + HOVER + 1;
    const b = finBounds(cam, top);
    const bw = b.x1 - b.x0;
    const bh = b.y1 - b.y0;
    const padT = 10;
    const sW = Math.min((W - 8) / bw, 7);
    let s = sW;
    if (hMax > 0) s = Math.max(sW * sMin, Math.min(s, (hMax - padT - 6) / bh));
    s = Math.max(1.2, s);
    cam.s = s;
    cam.ux = (W - bw * s) / 2 - b.x0 * s;
    cam.uy = padT - b.y0 * s;
    const H = Math.ceil(padT + bh * s + 6);
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.setAttribute("height", String(H));
    svg.dataset.scale = s.toFixed(2);
    fin = new FinView(svg, uid);
    // two names in the free band over the finger's base, with elbow leaders ending on a dot on the part
    if (W >= 300) {
      const gl = svgEl("g", { class: "sp-labels" }, svg);
      const yl = Math.max(padT + 8, cam.P(0, -FIN.FW / 2, 0)[1] - (W >= 470 ? 40 : 30));
      const T = STR();
      const items: [string, string, Vec3][] = [
        [T.softFinger, "TPU", [22, -5, 0]],
        [T.pad, T.points, [51, -FIN.PAD_HW + 2.4, FIN.PAD_T]],
      ];
      let x = cam.P(0, -FIN.FW / 2, 0)[0] + 2;
      for (const [name, sub, at] of items) {
        const t = svgEl("text", { class: "sp-lab", x: f1(x), y: f1(yl), "dominant-baseline": "central" }, gl);
        t.innerHTML = `<tspan class="sp-lab-name">${name}</tspan><tspan class="sp-lab-sub" dx="6">${sub}</tspan>`;
        const tw = t.getComputedTextLength() || name.length * 7;
        const [tx, ty] = cam.P(at[0], at[1], at[2]);
        const x0 = x + Math.min(10, tw / 4);
        svgEl("path", { class: "sp-lead", d: `M${f1(x0)} ${f1(yl + 7)}V${f1(Math.min(ty - 10, yl + 16))}L${f1(tx)} ${f1(ty)}` }, gl);
        svgEl("circle", { class: "sp-lead-end", cx: f1(tx), cy: f1(ty), r: 2.2 }, gl);
        x += tw + 26;
      }
    }
    obj = new ObjView(svg, uid);
    dotDim = { r0: Math.max(0.8, 0.26 * s), r1: Math.max(1.6, 0.62 * s), rn: Math.max(1.2, 0.44 * s) };
    // the cursor: a ring on a point and its number on a tag above it
    const cg = svgEl("g", { class: "sp-cursor", visibility: "hidden" }, svg);
    const lead = svgEl("path", { class: "sp-cur-lead" }, cg);
    const ring = svgEl("circle", { class: "sp-cur-ring", r: f1(Math.max(3, 0.95 * s)) }, cg);
    const tag = svgEl("g", {}, cg);
    const box = svgEl("rect", { class: "sp-cur-box", rx: 4, height: 18 }, tag);
    const text = svgEl("text", { class: "sp-cur-text", "dominant-baseline": "central" }, tag);
    cursor = { ring, tag, text, box, lead };
    drawnK = -1;
    lastBend = -1;
  };

  // ------------------------------------------------------------------ painting
  let lastBend = -1;
  let zeroRgb: RGB = [222, 222, 216];
  let gapCss = "#ffffff";
  let teal = "#15918f";
  let tealSoft: string[] = [];
  let trail = "#e0e0dc";
  const readColours = () => {
    zeroRgb = parseColor(cssVar(root, "--sp-map-zero", "#deded8"), [222, 222, 216]);
    gapCss = cssVar(root, "--face", "#ffffff");
    teal = cssVar(root, "--ft-hotspot", "#15918f");
    const tr = parseColor(teal, [21, 145, 143]);
    tealSoft = [0.22, 0.38, 0.55].map((t) => `rgb(${tr.map((c, i) => Math.round(zeroRgb[i] + (c - zeroRgb[i]) * t)).join(",")})`);
    const ink = parseColor(cssVar(root, "--accent", "#a24e0e"), [162, 78, 14]);
    trail = `rgb(${ink.map((c, i) => Math.round(zeroRgb[i] + (c - zeroRgb[i]) * 0.2)).join(",")})`;
  };
  readColours();
  const offTheme = ctx.onTheme(() => requestAnimationFrame(() => {
    readColours();
    mapKey = "";
    paint();
  }));

  /** what each point shows: 2 touched, 1 near (closeness 0..2), 0 nothing */
  const stateOf = (q: number) => (meas.depth[q] > 0 ? 3 : meas.dist[q] < NEAR ? Math.min(2, Math.floor((1 - meas.dist[q] / NEAR) * 3)) : -1);
  const nearLevel = new Int8Array(TAXELS).fill(-2);
  let mapKey = "";
  const sweepK0 = () => (sweepT === null ? null : Math.floor(sweepK(Math.min(sweepT, SWEEP_T))));
  const shownK = () => sweepK0() ?? hoverK ?? underK;

  const paint = () => {
    if (!fin || !obj) return;
    const kp = kappa();
    if (Math.abs(kp - lastBend) > 1e-7) {
      lastBend = kp;
      fin.draw(cam, kp, pad);
    }
    const spot = pad.surface(cur.a, cur.b);
    obj.draw(cam, object, shapes[object], spot, cur.h, true);
    let touched = 0;
    let near = 0;
    const sk = sweepK0();
    for (let q = 0; q < TAXELS; q++) {
      const st = stateOf(q);
      if (st === 3) touched++;
      else if (st >= 0) near++;
      const swept = sk !== null && q <= sk ? 1 : 0;
      const code = st * 2 + swept;
      if (nearLevel[q] === code) continue;
      nearLevel[q] = code;
      const d = fin.dots[q];
      d.setAttribute("class", st === 3 ? "sp-dot is-touched" : st >= 0 ? `sp-dot is-near n${st}` : swept ? "sp-dot is-swept" : "sp-dot");
      d.setAttribute("r", f1(st === 3 ? dotDim.r1 : st >= 0 ? dotDim.rn : dotDim.r0));
    }
    // the point under the object's spot (when it is over the pad)
    const jj = Math.round(cur.a / 2 + 15.5);
    const ii = Math.round(cur.b / 2 + 5.5);
    underK = Math.abs(cur.a) <= 32.5 && Math.abs(cur.b) <= 12 && jj >= 0 && jj < 32 && ii >= 0 && ii < 12 ? ii * 32 + jj : null;
    const k = shownK();
    nEl.textContent = String(touched);
    // (a count that is not 0, e.g. the tube still on the pad's edge, keeps its place beside the readout: sim-points.css)
    nEl.parentElement!.toggleAttribute("data-some", touched > 0 || near > 0);
    const T = STR();
    nearEl.textContent = near ? fillT(T.near, { n: near }) : "";
    // the readout: the point's number
    const kTxt =
      k === null
        ? `<span class="sp-hint">${COARSE.matches ? T.hintTap : T.hint}</span>`
        : `<b>k</b> = ${Math.floor(k / 32)} × 32 + ${k % 32} = <b class="sp-kv">${k}</b><span class="sp-kline">${fillT(T.kline, { i: Math.floor(k / 32), j: k % 32, t: meas.depth[k] > 0 ? T.kTouched : "" })}</span>`;
    if (kEl.dataset.v !== kTxt) {
      kEl.dataset.v = kTxt;
      kEl.innerHTML = kTxt;
    }
    // the cursor on the pad
    if (cursor) {
      if (k === null) setAttr(cursor.ring.parentElement!, "visibility", "hidden");
      else {
        setAttr(cursor.ring.parentElement!, "visibility", "visible");
        const [x, y] = [+fin.dots[k].getAttribute("cx")!, +fin.dots[k].getAttribute("cy")!];
        setAttr(cursor.ring, "cx", f1(x));
        setAttr(cursor.ring, "cy", f1(y));
        if (drawnK !== k) {
          drawnK = k;
          cursor.text.textContent = `k = ${k}`;
        }
        const tw = Math.ceil(cursor.text.getComputedTextLength() || 40) + 12;
        // the tag sits above the far edge of the pad, over its point's column
        const far = cam.P(...(padTop(FIN.PAD_C + pad.colS[k % 32], -FIN.PAD_HW - 1, kappa()) as Vec3));
        const ty = Math.max(12, Math.min(far[1] - 16, y - 22, obj.top - 14));
        const tx = Math.max(2, Math.min(+svg.getAttribute("viewBox")!.split(" ")[2] - tw - 2, x - tw / 2));
        setAttr(cursor.box, "x", f1(tx));
        setAttr(cursor.box, "y", f1(ty - 9));
        setAttr(cursor.box, "width", String(tw));
        setAttr(cursor.text, "x", f1(tx + 6));
        setAttr(cursor.text, "y", f1(ty));
        setAttr(cursor.lead, "d", `M${f1(x)} ${f1(ty + 9)}V${f1(y - Math.max(3, 0.95 * cam.s))}`);
      }
    }
    // the map
    let key = `${k}|${sk}|`;
    for (let q = 0; q < TAXELS; q++) key += String.fromCharCode(66 + nearLevel[q]);
    if (key !== mapKey) {
      mapKey = key;
      const zero = `rgb(${zeroRgb.join(",")})`;
      map.paint(
        (q) => {
          const st = stateOf(q);
          if (st === 3) return teal;
          if (st >= 0) return tealSoft[st];
          return sk !== null && q <= sk ? trail : zero;
        },
        gapCss,
        (g, c) => {
          if (sk !== null && !reduced) {
            // the reading order: a thin line through the cells read so far, row by row (the jump back to the next
            // row's start dashed and fainter)
            g.strokeStyle = cssVar(root, "--accent", "#a24e0e");
            g.lineWidth = 1.2;
            const at = (q: number) => [(q % 32) * c + c / 2 + 0.5, Math.floor(q / 32) * c + c / 2 + 0.5];
            for (let i = 0; i * 32 <= sk; i++) {
              const q0 = i * 32;
              const q1 = Math.min(sk, i * 32 + 31);
              g.globalAlpha = 0.85;
              g.setLineDash([]);
              g.beginPath();
              g.moveTo(at(q0)[0] - c * 0.3, at(q0)[1]);
              g.lineTo(at(q1)[0], at(q1)[1]);
              g.stroke();
              if (q1 === i * 32 + 31 && q1 < sk) {
                g.globalAlpha = 0.4;
                g.setLineDash([2, 2]);
                g.beginPath();
                g.moveTo(at(q1)[0], at(q1)[1]);
                g.lineTo(at(q1 + 1)[0] - c * 0.3, at(q1 + 1)[1]);
                g.stroke();
              }
            }
            g.setLineDash([]);
            g.globalAlpha = 1;
          }
          if (k !== null) {
            g.strokeStyle = cssVar(root, "--ink", "#18181a");
            g.lineWidth = 2;
            g.strokeRect((k % 32) * c + 0.5, Math.floor(k / 32) * c + 0.5, c, c);
          }
        },
      );
    }
    setAttr(anim, "aria-description", fillT(T.desc, { n: touched }));
  };

  // ------------------------------------------------------------------ motion
  let paused = !playing;
  let visible = !document.hidden;
  let onscreen = true;
  let raf = 0;
  let last = 0;
  let resumeT = 0;
  const holds = new Set<string>();
  const follow = (dt: number) => {
    const tau = glide > 0 ? 0.45 : 0.09;
    const e = reduced ? 1 : 1 - Math.exp(-dt / tau);
    const eh = reduced ? 1 : 1 - Math.exp(-dt / (glide > 0 ? 0.45 : 0.12));
    cur.a += (tgt.a - cur.a) * e;
    cur.b += (tgt.b - cur.b) * e;
    cur.h += (tgt.h - cur.h) * eh;
    glide = Math.max(0, glide - dt);
  };
  const tick = (now: number) => {
    raf = 0;
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (!paused && holds.size === 0 && !waiting) {
      tourT += dt;
      Object.assign(tgt, tourAt(tourT));
    }
    follow(dt);
    if (bend !== bendTo) bend = bendTo > bend ? Math.min(bendTo, bend + dt / 0.9) : Math.max(bendTo, bend - dt / 0.9);
    if (sweepT !== null && !sweepHeld) {
      sweepT += dt;
      if (sweepT > SWEEP_T + SWEEP_HOLD) endSweep();
    }
    place();
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
  /** after an instant change (reduced motion, or a host's set) */
  const now = () => {
    place();
    paint();
  };
  /** after the learner lets go, the tour waits RESUME_MS before it takes the object back */
  let waiting = false;
  const hold = (why: string) => {
    holds.add(why);
    glide = 0;
    waiting = true;
    clearTimeout(resumeT);
  };
  const unhold = (why: string) => {
    if (!holds.delete(why) || holds.size || reduced) return;
    clearTimeout(resumeT);
    resumeT = window.setTimeout(() => {
      // the tour starts again from its first spot; the object glides there
      if (holds.size) return;
      waiting = false;
      tourT = 0;
      glide = 1.2;
    }, RESUME_MS);
  };
  const paintPlay = () => {
    const T = STR();
    playBtn.innerHTML = `${playing ? ICON_PAUSE : ICON_PLAY}<span class="sp-btn-t">${playing ? T.pause : T.play}</span>`;
    playBtn.setAttribute("aria-label", playing ? T.pauseAria : T.playAria);
  };
  const setPlaying = (on: boolean) => {
    playing = on && !reduced;
    paused = !playing;
    paintPlay();
    if (playing) {
      glide = 1.2;
      waiting = false;
    }
  };
  function endSweep() {
    sweepT = null;
    sweepHeld = false;
    orderBtn.setAttribute("aria-pressed", "false");
    mapKey = "";
    nearLevel.fill(-2);
  }
  const startSweep = () => {
    sweepT = reduced ? SWEEP_T : 0;
    sweepHeld = reduced;
    orderBtn.setAttribute("aria-pressed", "true");
    nearLevel.fill(-2);
    if (reduced) now();
  };

  // ------------------------------------------------------------------ pointer: the object follows; hold to press
  let down = false;
  const toSpot = (e: PointerEvent) => {
    const b = svg.getBoundingClientRect();
    const vb = svg.viewBox.baseVal;
    const X = ((e.clientX - b.left) / b.width) * vb.width;
    const Y = ((e.clientY - b.top) / b.height) * vb.height;
    // the face under the pointer: the plane z = PAD_T first, then the bent face's height there
    let [x, y] = cam.toPlane(X, Y, FIN.PAD_T);
    const kp = kappa();
    for (let it = 0; it < 3 && kp > 1e-7; it++) {
      const xa = Math.min(FIN.LF, Math.max(0, x));
      const w = padTop(xa, 0, kp);
      [x, y] = cam.toPlane(X, Y, w[2]);
    }
    // world x -> arc position along the face
    const x0 = FIN.BEND_X0;
    const xa = kp > 1e-7 && x > x0 ? x0 + Math.asin(Math.max(-1, Math.min(1, kp * (x - x0)))) / kp : x;
    return { a: Math.min(A_MAX, Math.max(A_MIN, xa - FIN.PAD_C)), b: Math.min(B_MAX, Math.max(-B_MAX, y)) };
  };
  const onMove = (e: PointerEvent) => {
    if (e.pointerType === "touch" && !e.buttons) return;
    hold("pointer");
    const s = toSpot(e);
    tgt.a = s.a;
    tgt.b = s.b;
    tgt.h = down ? -DEPTH : HOVER;
    glide = 0;
    if (reduced) {
      Object.assign(cur, tgt);
      now();
    }
  };
  svg.addEventListener("pointerenter", (e) => {
    if (e.pointerType !== "touch") hold("pointer");
  });
  svg.addEventListener("pointermove", onMove);
  svg.addEventListener("pointerdown", (e) => {
    down = true;
    try {
      svg.setPointerCapture(e.pointerId);
    } catch {
      /* optional */
    }
    onMove(e);
  });
  const lift = (e: PointerEvent) => {
    down = false;
    tgt.h = HOVER;
    if (reduced) {
      cur.h = HOVER;
      now();
    }
    const b = svg.getBoundingClientRect();
    const inside = e.clientX >= b.left && e.clientX <= b.right && e.clientY >= b.top && e.clientY <= b.bottom;
    if (e.pointerType === "touch" || !inside) unhold("pointer");
  };
  svg.addEventListener("pointerup", lift);
  svg.addEventListener("pointercancel", lift);
  svg.addEventListener("pointerleave", () => {
    if (!down) unhold("pointer");
  });

  // keys: arrows move one point (2 mm), Space / Enter press or lift
  let keyDown = false;
  anim.addEventListener("keydown", (e) => {
    const step = 2;
    let used = true;
    if (e.key === "ArrowRight") tgt.a = Math.min(A_MAX, tgt.a + step);
    else if (e.key === "ArrowLeft") tgt.a = Math.max(A_MIN, tgt.a - step);
    else if (e.key === "ArrowDown") tgt.b = Math.min(B_MAX, tgt.b + step);
    else if (e.key === "ArrowUp") tgt.b = Math.max(-B_MAX, tgt.b - step);
    else if (e.key === " " || e.key === "Enter") {
      keyDown = !keyDown;
      tgt.h = keyDown ? -DEPTH : HOVER;
    } else used = false;
    if (!used) return;
    e.preventDefault();
    hold("key");
    // snap onto the grid so arrow keys walk point to point
    if (e.key.startsWith("Arrow")) {
      tgt.a = Math.round((tgt.a - 1) / 2) * 2 + 1;
      tgt.b = Math.round((tgt.b - 1) / 2) * 2 + 1;
    }
    if (reduced) {
      Object.assign(cur, tgt);
      now();
    }
  });
  anim.addEventListener("focus", () => {
    if (anim.matches(":focus-visible")) hold("key");
  });
  anim.addEventListener("blur", () => unhold("key"));

  // the map: hover names a square; a click brings the object down on that point
  mapCell.addEventListener("pointermove", (e) => {
    const q = map.cellAt(e.clientX, e.clientY);
    hoverK = q >= 0 ? q : null;
    if (reduced || !raf) paint();
  });
  mapCell.addEventListener("pointerleave", () => {
    hoverK = null;
    if (reduced || !raf) paint();
  });
  mapCell.addEventListener("click", (e) => {
    const q = map.cellAt(e.clientX, e.clientY);
    if (q < 0) return;
    hold("map");
    tgt.a = pad.colS[q % 32];
    tgt.b = pad.rowB[Math.floor(q / 32)];
    tgt.h = -DEPTH;
    if (reduced) {
      Object.assign(cur, tgt);
      now();
    }
    window.setTimeout(() => unhold("map"), 50);
  });

  // ------------------------------------------------------------------ controls
  const setObject = (o: "ball" | "tube") => {
    object = o;
    for (const b of objBtns) b.setAttribute("aria-pressed", String(b.dataset.obj === o));
    now();
  };
  const setBent = (on: boolean) => {
    bendTo = on ? 1 : 0;
    if (reduced) bend = bendTo;
    for (const b of bendBtns) b.setAttribute("aria-pressed", String((b.dataset.bend === "1") === on));
    now();
  };
  objBtns.forEach((b) => b.addEventListener("click", () => setObject(b.dataset.obj as "ball" | "tube")));
  bendBtns.forEach((b) => b.addEventListener("click", () => setBent(b.dataset.bend === "1")));
  orderBtn.addEventListener("click", () => (sweepT === null ? startSweep() : endSweep()));
  orderBtn.setAttribute("aria-pressed", "false");
  playBtn.addEventListener("click", () => setPlaying(!playing));

  // ------------------------------------------------------------------ layout
  const relayout = () => {
    if (!root.isConnected) return;
    let W = Math.round(anim.getBoundingClientRect().width);
    if (W < 60) return;
    const maxH = Number(root.closest<HTMLElement>("[data-max-h]")?.dataset.maxH) || 0;
    const compact = Boolean(root.closest("[data-compact]"));
    // the side form (a phone on its side, see sideForm): the drawing left, the frame and its counts right
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
      colW = Math.floor((inner - 16) * 0.5);
      W = Math.floor(inner - 16 - colW);
      root.style.setProperty("--sp-col", `${colW}px`);
    }
    const form = W >= 470 ? "large" : W >= 300 ? "medium" : "mini";
    root.dataset.form = form;
    // the map: as wide as it may be (large: beside the readout; else the full width; the side form: its column)
    const side = form === "large" && !sideOn ? 170 : 0;
    const axisW = form === "mini" ? 0 : 24;
    const cell = sideOn
      ? Math.max(4, Math.min(10, Math.floor((colW - axisW) / 32)))
      : Math.max(4, Math.min(form === "large" ? 14 : 10, Math.floor((W - side - axisW - (side ? 18 : 0)) / 32)));
    map.size(cell);
    // (sizing the canvas cleared it: paint the map again, though the frame it shows has not changed)
    mapKey = "";
    root.style.setProperty("--sp-mapw", `${map.width}px`);
    root.style.setProperty("--sp-maph", `${map.height}px`);
    build(W, 0);
    now();
    // (the side form: no taller than the window)
    const budget = maxH || (sideOn ? window.innerHeight - 24 : 0);
    if (budget) {
      // the drawing gives up the height the rest of the card needs; in the full form at most a fifth of its scale
      // (then the card is too tall and the host drops the closing sentence: compact), in compact as much as it must
      const card = root.closest<HTMLElement>(".demo-card") ?? el;
      const over = card.offsetHeight - budget;
      if (over > 0) {
        build(W, Math.max(90, anim.offsetHeight - over), compact || sideOn ? 0.45 : 0.8);
        now();
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

  // a language switch: the words, the buttons, and the drawing built again with its labels in the new language (the
  // object, the tour, the curl and the sweep carry on)
  const offLang = ctx.onLang(() => {
    paintText(root, STR());
    // ("Touched" is the count line's first text: a text node of its own, so the English line is drawn as it always was)
    const touchedTxt = nEl.parentElement!.firstChild;
    if (touchedTxt?.nodeType === Node.TEXT_NODE) touchedTxt.nodeValue = `${STR().touched} `;
    for (const b of objBtns) b.textContent = OBJ_NAMES()[b.dataset.obj as "ball" | "tube"];
    paintPlay();
    kEl.dataset.v = "";
    builtKey = "";
    relayout();
    // (the drawing and the map were made again: paint every point and the map anew, not only what changed; once more
    // after the host's own refit for the new words, which builds them again a frame later)
    const repaintAll = () => {
      if (!root.isConnected) return;
      nearLevel.fill(-2);
      mapKey = "";
      paint();
    };
    repaintAll();
    requestAnimationFrame(() => requestAnimationFrame(repaintAll));
  });

  setPlaying(playing);
  place();
  run();

  return {
    layout() {
      builtKey = "";
      relayout();
    },
    view(v) {
      if (!v) return;
      if (v.object === "ball" || v.object === "tube") setObject(v.object);
      if (typeof v.bent === "boolean") setBent(v.bent);
      if (v.order === true) startSweep();
      else if (v.order === false && sweepT !== null) endSweep();
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
    play: () => setPlaying(true),
    pause: () => setPlaying(false),
    set(v) {
      setPlaying(false);
      if (v.object) object = v.object;
      for (const b of objBtns) b.setAttribute("aria-pressed", String(b.dataset.obj === object));
      if (typeof v.bent === "boolean") {
        bendTo = bend = v.bent ? 1 : 0;
        for (const b of bendBtns) b.setAttribute("aria-pressed", String((b.dataset.bend === "1") === v.bent));
      }
      if (v.a !== undefined) cur.a = tgt.a = v.a;
      if (v.b !== undefined) cur.b = tgt.b = v.b;
      if (v.down !== undefined) cur.h = tgt.h = v.down ? -DEPTH : HOVER;
      glide = 0;
      now();
    },
    order(on = true, at) {
      if (!on) {
        if (sweepT !== null) endSweep();
        now();
        return;
      }
      startSweep();
      if (at !== undefined) {
        // seek: the time at which the sweep reaches k = at, then hold there
        const t = at <= SWEEP_SLOW ? at / SWEEP_RATE : SWEEP_SLOW / SWEEP_RATE + Math.sqrt((at - SWEEP_SLOW) / 22);
        sweepT = t + 1e-6;
        sweepHeld = true;
        setPlaying(false);
      }
      now();
    },
    state: () => ({
      object,
      bent: bendTo === 1,
      a: cur.a,
      b: cur.b,
      lift: cur.h,
      touched: meas.depth.reduce((n, d) => n + (d > 0 ? 1 : 0), 0),
      near: meas.dist.reduce((n, d, q) => n + (d < NEAR && meas.depth[q] <= 0 ? 1 : 0), 0),
      k: shownK(),
      playing,
      sweeping: sweepT !== null,
    }),
  };
}
