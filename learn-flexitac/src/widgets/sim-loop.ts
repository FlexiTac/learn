// Why simulate touch: the content of Lesson 3.1's card ("real -> sim -> real"). A loop diagram in the course's isometric
// look (solid faces, four tones per material: top lightest, lit side, shadow side, a crisp edge):
//   (1) LEFT, the real robot: a small arm on a table (silver links, near-black joints, a lime turret: the reBot's
//       colours) with fin-shaped soft fingers in orange TPU and an amber FlexiTac pad on each, grasping a block. It
//       makes ONE slow try at a time (7 s a try) and lifts the block.
//   (2) TOP, the policy: a chip with a small network on it: the program that turns what the camera sees and the
//       fingers feel into the next move. A few real demos teach it first.
//   (3) RIGHT, the simulation: a "digital twin" plate (cool slate tones, a fine grid) with 12 copies of the gripper,
//       each trying the same grasp in a staggered wave (4 s a try); a few miss at first and fewer later (practice).
//       Their pads glow while they hold something: the copies feel touch too.
//   (4) BOTTOM, touch must match: the real robot's grasp as two 12 x 32 maps, read the real way ("real pad": bytes,
//       noise, a baseline) and replayed in sim ("sim pad"), side by side with "≈" between them, both from the shared
//       touch engine (@shared/models/touchsim.mjs: a soft-edged block pressed into a pad, Kelvin-Voigt force, the
//       viewer's normalisation rule), on the arrow that brings the better policy back to the real robot.
// Three arrows close the loop (demos -> policy -> practice in sim -> back to the real robot) and a small dot travels
// it, 12 s a lap. Under the drawing, three aligned label cards (Real robot · Same touch · Simulation, in the order the
// drawing has them) with a running tally of tries; a card click (or view({focus})) dims everything else.
// ILLUSTRATIVE: a diagram, not a measurement. The one number from a source is VT-Refine's 100 parallel copies
// (DPPO config n_envs: 100; refs/s2s3-research/papers.md §3.7); the 12 shown stand for them.
// Lesson steps (3.1): view({focus: "real"}) "a real robot is slow", "sim" "many copies at once", "touch" "the sim pad
// must read like the real one" ("policy" also works); null shows everything.
// Motion: everything is a function of one clock (seek(t) poses it exactly; reviews use it). It runs only while the
// card is on screen and the tab is visible; the play / pause button stops it (an auto-playing loop longer than 5 s
// needs one). Reduced motion: no loop, one still moment (the real robot holding the block up, the copies at rest).
// Layout: the drawing's size comes from the card's width and its height budget (layout(maxH) / fit(maxH), else the
// card's px max-height, else ~1.06 x the width), at most 0.72 x its width; a short budget drops the closing sentence
// first. The stations are scaled to fit their places. A card under 520 px wide is "medium" (shorter card text, an
// icon-only play button), under 220 px "mini" (no cards: the drawing only). A drawing under NARROW (a phone) is taller
// (0.9 x its width, with no height given), leaves the policy's job out and puts "learn from demos" on two lines where
// it must; a card under 420 px stacks its three cards. A short, wide window with no height given (a phone on its side)
// takes the side form: the loop left, the three cards one under the other right, no taller than the window.
//
// THE ISO TOOLKIT (exported; sim-results.ts draws its pipeline with it): a camera (azimuth, elevation), an IsoScene
// that collects convex solids (box, beam, extruded prism, upright cylinder) as painter-sorted items, each face shaded
// by its normal (top / left = lit side / right = shadow side, edge = outline; colours from the .sx material classes in
// sim-loop.css, light and dark), and the stations (realStation, policyChip, simStatic) built from it.
import { VIRIDIS_RGB } from "@shared/models/viridis.mjs";
import { box as tsBox, createReadout, createTouch, makePad, pressOnto, rotY } from "@shared/models/touchsim.mjs";
import { strings } from "../i18n";
import { paintText, setTextBeside } from "../i18n/paint";
import type { WidgetCtx, WidgetInstance } from "../types";
import { h } from "../ui/dom";
import "./sim-loop.css";

// ================================================================== the iso toolkit
export type V3 = [number, number, number];
export type Tone = "top" | "left" | "right";
/** An orthographic camera: screen x = s (x cos az - y sin az), screen y = s ((x sin az + y cos az) sin el - z cos el). */
export interface Cam {
  s: number;
  ox: number;
  oy: number;
  ca: number;
  sa: number;
  se: number;
  ce: number;
}
export function camera(azDeg = 40, elDeg = 30, s = 1, ox = 0, oy = 0): Cam {
  const a = (azDeg * Math.PI) / 180;
  const e = (elDeg * Math.PI) / 180;
  return { s, ox, oy, ca: Math.cos(a), sa: Math.sin(a), se: Math.sin(e), ce: Math.cos(e) };
}
export const project = (c: Cam, p: V3): [number, number] => [
  c.ox + c.s * (p[0] * c.ca - p[1] * c.sa),
  c.oy + c.s * ((p[0] * c.sa + p[1] * c.ca) * c.se - p[2] * c.ce),
];
/** Larger = nearer the viewer. */
export const depthOf = (c: Cam, p: V3) => (p[0] * c.sa + p[1] * c.ca) * c.ce + p[2] * c.se;
/** The screen offset of a world displacement (for translating a group instead of redrawing it). */
export const shift = (c: Cam, d: V3): [number, number] => [c.s * (d[0] * c.ca - d[1] * c.sa), c.s * ((d[0] * c.sa + d[1] * c.ca) * c.se - d[2] * c.ce)];

const f1 = (v: number) => String(Math.round(v * 10) / 10);
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a: V3): V3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
const mean = (ps: V3[]): V3 => mul(ps.reduce((s, p) => add(s, p), [0, 0, 0] as V3), 1 / ps.length);

function toneOf(c: Cam, n: V3): Tone | null {
  if (n[0] * c.sa * c.ce + n[1] * c.ca * c.ce + n[2] * c.se <= 1e-6) return null;
  if (n[2] >= 0.6) return "top";
  return n[0] * c.ca - n[1] * c.sa >= 0 ? "right" : "left";
}

export interface SolidOpts {
  /** Extra classes on the solid's group (e.g. "sx-pad"). */
  cls?: string;
  /** Added to the painter's depth (to settle a near tie). */
  bias?: number;
}
export interface Item {
  d: number;
  svg: string;
}

/** Collects solids as painter-sorted items; render() gives the SVG (far first). Faces of one convex solid never overlap
 *  each other on screen, so each solid is one item, sorted by its centroid's depth. */
export class IsoScene {
  readonly items: Item[] = [];
  x0 = Infinity;
  y0 = Infinity;
  x1 = -Infinity;
  y1 = -Infinity;
  constructor(readonly cam: Cam) {}
  pt(p: V3): [number, number] {
    const q = project(this.cam, p);
    if (q[0] < this.x0) this.x0 = q[0];
    if (q[0] > this.x1) this.x1 = q[0];
    if (q[1] < this.y0) this.y0 = q[1];
    if (q[1] > this.y1) this.y1 = q[1];
    return q;
  }
  path(ps: V3[], close = true) {
    return `M${ps.map((p) => this.pt(p).map(f1).join(" ")).join("L")}${close ? "Z" : ""}`;
  }
  /** A convex polyhedron: vertices and faces (vertex index cycles); normals point away from its centroid. */
  poly(verts: V3[], faces: number[][], mat: string, o: SolidOpts = {}): Item {
    const C = mean(verts);
    let svg = "";
    for (const f of faces) {
      const P = f.map((i) => verts[i]);
      // Newell's normal, turned outward
      let n: V3 = [0, 0, 0];
      for (let i = 0; i < P.length; i++) {
        const a = P[i];
        const b = P[(i + 1) % P.length];
        n = add(n, [(a[1] - b[1]) * (a[2] + b[2]), (a[2] - b[2]) * (a[0] + b[0]), (a[0] - b[0]) * (a[1] + b[1])]);
      }
      n = unit(n);
      if (dot(n, sub(mean(P), C)) < 0) n = mul(n, -1);
      const tone = toneOf(this.cam, n);
      if (!tone) continue;
      svg += `<path class="sx-f sx-${tone}" d="${this.path(P)}"/>`;
    }
    const it = { d: depthOf(this.cam, C) + (o.bias ?? 0), svg: `<g class="sx-m-${mat}${o.cls ? ` ${o.cls}` : ""}">${svg}</g>` };
    this.items.push(it);
    return it;
  }
  box(c: V3, s: V3, mat: string, o?: SolidOpts) {
    const v: V3[] = [];
    for (let i = 0; i < 8; i++) v.push([c[0] + ((i & 1 ? 1 : -1) * s[0]) / 2, c[1] + ((i & 2 ? 1 : -1) * s[1]) / 2, c[2] + ((i & 4 ? 1 : -1) * s[2]) / 2]);
    return this.poly(v, BOX_FACES, mat, o);
  }
  /** A square-ish bar from a to b, w wide (sideways, horizontal) and t thick. */
  beam(a: V3, b: V3, w: number, t: number, mat: string, o?: SolidOpts) {
    const u = unit(sub(b, a));
    let side = cross(u, [0, 0, 1]);
    if (Math.hypot(...side) < 1e-6) side = [0, 1, 0];
    side = unit(side);
    const up = unit(cross(side, u));
    const v: V3[] = [];
    for (let i = 0; i < 8; i++) {
      const base = i & 1 ? b : a;
      v.push(add(add(base, mul(side, ((i & 2 ? 1 : -1) * w) / 2)), mul(up, ((i & 4 ? 1 : -1) * t) / 2)));
    }
    return this.poly(v, BOX_FACES, mat, o);
  }
  /** A convex profile (p, q) in the plane at + p P + q Q, extruded `width` along E (centred). */
  prism(profile: [number, number][], at: V3, P: V3, Q: V3, E: V3, width: number, mat: string, o?: SolidOpts) {
    const N = profile.length;
    const v: V3[] = [];
    for (const side of [-0.5, 0.5]) for (const [p, q] of profile) v.push(add(add(add(at, mul(P, p)), mul(Q, q)), mul(E, side * width)));
    const faces: number[][] = [
      [...Array(N).keys()],
      [...Array(N).keys()].map((k) => N + k),
    ];
    for (let k = 0; k < N; k++) faces.push([k, (k + 1) % N, N + ((k + 1) % N), N + k]);
    return this.poly(v, faces, mat, o);
  }
  /** An upright cylinder: base centre c, radius r, height hgt. Its side is two tones (lit half, shadow half). */
  cyl(c: V3, r: number, hgt: number, mat: string, o: SolidOpts = {}) {
    const cam = this.cam;
    const az = Math.atan2(cam.sa, cam.ca);
    const tR = -az;
    const tF = Math.PI / 2 - az;
    const tL = Math.PI - az;
    const at = (t: number, z: number): V3 => [c[0] + r * Math.cos(t), c[1] + r * Math.sin(t), z];
    const arc = (t0: number, t1: number, z: number) => {
      const n = Math.max(4, Math.ceil(Math.abs(t1 - t0) / 0.12));
      return Array.from({ length: n + 1 }, (_, i) => at(t0 + ((t1 - t0) * i) / n, z));
    };
    const z0 = c[2];
    const z1 = c[2] + hgt;
    const half = (a: number, b: number) => this.path([...arc(a, b, z0), ...arc(b, a, z1)]);
    const top = this.path(arc(0, 2 * Math.PI, z1));
    const side = this.path([...arc(tL, tR, z0), ...arc(tR, tL, z1)]);
    const svg =
      `<g class="sx-m-${mat}${o.cls ? ` ${o.cls}` : ""}"><path class="sx-left" d="${half(tF, tL)}"/><path class="sx-right" d="${half(tR, tF)}"/>` +
      `<path class="sx-f sx-line" d="${side}"/><path class="sx-f sx-top" d="${top}"/></g>`;
    const it = { d: depthOf(cam, [c[0], c[1], c[2] + hgt / 2]) + (o.bias ?? 0), svg };
    this.items.push(it);
    return it;
  }
  /** Extra svg drawn right after an item (a decal on its top face). */
  decal(it: Item, svg: string) {
    it.svg = it.svg.replace(/<\/g>$/, `${svg}</g>`);
  }
  render() {
    return [...this.items]
      .sort((a, b) => a.d - b.d)
      .map((i) => i.svg)
      .join("");
  }
  get bbox() {
    return { x: this.x0, y: this.y0, w: this.x1 - this.x0, h: this.y1 - this.y0 };
  }
}
const BOX_FACES = [
  [0, 2, 6, 4],
  [1, 3, 7, 5],
  [0, 1, 5, 4],
  [2, 3, 7, 6],
  [0, 1, 3, 2],
  [4, 5, 7, 6],
];

/** Draw `build` scaled to fit a w x h box centred at (cx, cy) (at most `maxS`); returns the svg, the camera and the box
 *  it actually took. `poses` lets a moving part reserve its whole range: build is called with each and the union is
 *  fitted. */
export function fitScene<P>(build: (sc: IsoScene, pose: P) => void, poses: P[], cx: number, cy: number, w: number, hgt: number, maxS = Infinity, az = 40, el = 30) {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of poses) {
    const sc = new IsoScene(camera(az, el));
    build(sc, p);
    x0 = Math.min(x0, sc.x0);
    y0 = Math.min(y0, sc.y0);
    x1 = Math.max(x1, sc.x1);
    y1 = Math.max(y1, sc.y1);
  }
  const s = Math.min(maxS, w / (x1 - x0), hgt / (y1 - y0));
  const cam = camera(az, el, s, cx - (s * (x0 + x1)) / 2, cy - (s * (y0 + y1)) / 2);
  return { cam, box: { x: cx - (s * (x1 - x0)) / 2, y: cy - (s * (y1 - y0)) / 2, w: s * (x1 - x0), h: s * (y1 - y0) } };
}

// ------------------------------------------------------------------ a grasp, as a function of time
export interface GripPose {
  /** How high the fingertips are above the grasp height, 0..1 of the station's travel. */
  lift: number;
  /** 1 = open, 0 = closed on the block. */
  open: number;
  /** How far the block has been carried up, 0..1 of the travel. */
  carry: number;
  /** How hard the pads press the block, 0..1 (0 when a try misses). */
  press: number;
}
const ease = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
/** One try at phase u (0..1): down, close, lift, hold, lower, open, up. `held` = the try grips the block (a miss
 *  closes beside it: the block stays and the pads feel nothing). `top` = the lift's height as a share of the travel. */
export function gripAt(u: number, held = true, top = 0.7): GripPose {
  const seg = (a: number, b: number) => ease((u - a) / (b - a));
  let lift: number;
  let open: number;
  if (u < 0.18) {
    lift = 1 - seg(0, 0.18);
    open = 1;
  } else if (u < 0.28) {
    lift = 0;
    open = 1 - seg(0.18, 0.28);
  } else if (u < 0.46) {
    lift = top * seg(0.28, 0.46);
    open = 0;
  } else if (u < 0.6) {
    lift = top;
    open = 0;
  } else if (u < 0.76) {
    lift = top * (1 - seg(0.6, 0.76));
    open = 0;
  } else if (u < 0.84) {
    lift = 0;
    open = seg(0.76, 0.84);
  } else {
    lift = seg(0.84, 1);
    open = 1;
  }
  const closed = 1 - open;
  return { lift, open, carry: held ? (closed > 0.98 ? lift : 0) : 0, press: held ? ease(closed) : 0 };
}

// ------------------------------------------------------------------ the stations
/** The real robot's travel (world units ~ mm): fingertip height span, and the block. */
const REAL = { travel: 26, block: 14, gOpen: 13, x: 24, fw: 15 };
/** The real station: table, arm (two links, elbow up, solved for the wrist), fin fingers with pads, the block. */
export function realStation(sc: IsoScene, pose: GripPose, o: { tableW?: number } = {}) {
  const tip = 2 + pose.lift * REAL.travel;
  const g = REAL.block / 2 + pose.open * (REAL.gOpen - REAL.block / 2);
  const X = REAL.x;
  const zTop = tip + 30;
  const W: V3 = [X, 0, zTop + 13];
  const S: V3 = [-58, 0, 34];
  const L = 56;
  const dx = W[0] - S[0];
  const dz = W[2] - S[2];
  const d = Math.min(2 * L - 0.01, Math.hypot(dx, dz));
  const a = Math.atan2(dz, dx);
  const b = Math.acos(d / (2 * L));
  const E: V3 = [S[0] + L * Math.cos(a + b), 0, S[2] + L * Math.sin(a + b)];
  const tw = o.tableW ?? 128;
  sc.box([-18, 0, -4], [tw, 80, 8], "table", { bias: -1000 });
  sc.cyl([-58, 0, 0], 16, 7, "black", { bias: -40 });
  sc.cyl([-58, 0, 7], 12, 18, "lime", { bias: -30 });
  sc.box(S, [18, 20, 16], "black");
  sc.beam(S, E, 12, 11, "alu");
  sc.box(E, [14, 18, 14], "black");
  sc.beam(E, W, 10, 10, "alu");
  sc.box(W, [12, 14, 12], "black");
  sc.box([X, 0, zTop + 3.5], [13, 52, 7], "alu");
  fingers(sc, X, g, tip, 30, 9, REAL.fw, "tpu", "pad", pose.press);
  sc.box([X, 0, REAL.block / 2 + pose.carry * REAL.travel], [REAL.block, REAL.block, REAL.block], "block");
}
/** Two fin fingers (inner faces at y = ±(g + pad)), each with a pad facing the other. */
function fingers(sc: IsoScene, X: number, g: number, tip: number, len: number, thick: number, width: number, mat: string, padMat: string, press: number) {
  const pad = 1.2;
  const prof: [number, number][] = [
    [0, len],
    [thick, len],
    [thick * 0.2, 0],
    [0, 0],
  ];
  const lit = press > 0.05 ? " is-lit" : "";
  for (const side of [-1, 1]) {
    sc.prism(prof, [X, side * (g + pad), tip], [0, side, 0], [0, 0, 1], [1, 0, 0], width, mat);
    sc.box([X, side * (g + pad / 2), tip + len * 0.47], [width * 0.72, pad, len * 0.66], padMat, { cls: `sx-pad${lit}`, bias: 0.01 });
  }
}
/** The policy: a chip (black epoxy, tin pins) with a small network on its top face. */
export function policyChip(sc: IsoScene) {
  const S = 46;
  const T = 8;
  const chip = sc.box([0, 0, T / 2], [S, S, T], "ic");
  for (let k = 0; k < 6; k++) {
    const p = -S / 2 + 6 + (k * (S - 12)) / 5;
    sc.box([p, -S / 2 - 1.6, 2], [3, 3.4, 2.4], "tin");
    sc.box([p, S / 2 + 1.6, 2], [3, 3.4, 2.4], "tin");
    sc.box([-S / 2 - 1.6, p, 2], [3.4, 3, 2.4], "tin");
    sc.box([S / 2 + 1.6, p, 2], [3.4, 3, 2.4], "tin");
  }
  // the network: 3 -> 4 -> 2 nodes, from the back-left corner to the front-right
  const layers = [
    [-11, 0, 11],
    [-15, -5, 5, 15],
    [-7, 7],
  ];
  const lx = [-14, 0, 14];
  const z = T + 0.05;
  let lines = "";
  for (let l = 0; l < 2; l++) for (const a of layers[l]) for (const b of layers[l + 1]) lines += sc.path([[lx[l], a, z], [lx[l + 1], b, z]], false);
  let nodes = "";
  for (let l = 0; l < 3; l++)
    for (const a of layers[l]) {
      const ring: V3[] = Array.from({ length: 14 }, (_, i) => [lx[l] + 2.6 * Math.cos((i * Math.PI) / 7), a + 2.6 * Math.sin((i * Math.PI) / 7), z]);
      nodes += sc.path(ring);
    }
  sc.decal(chip, `<path class="sx-net" d="${lines}"/><path class="sx-node" d="${nodes}"/>`);
}
/** The sim plate and its copies' grid (cols along x, rows along y), world units. */
export const SIM = { cols: 4, rows: 3, dx: 36, dy: 34, block: 10, travel: 15, gOpen: 9, len: 17, thick: 5.5, width: 10.5 };
const simPlate = (sc: IsoScene) => {
  const W = SIM.cols * SIM.dx + 8;
  const D = SIM.rows * SIM.dy + 8;
  const plate = sc.box([0, 0, -3], [W, D, 6], "plate", { bias: -1000 });
  let grid = "";
  for (let x = -W / 2 + 4; x <= W / 2 - 3.9; x += SIM.dx / 3)
    grid += sc.path([[x, -D / 2, 0.02], [x, D / 2, 0.02]], false);
  for (let y = -D / 2 + 4; y <= D / 2 - 3.9; y += SIM.dy / 3)
    grid += sc.path([[-W / 2, y, 0.02], [W / 2, y, 0.02]], false);
  sc.decal(plate, `<path class="sx-grid" d="${grid}"/>`);
};
const copyAt = (c: number, r: number): V3 => [(c - (SIM.cols - 1) / 2) * SIM.dx, (r - (SIM.rows - 1) / 2) * SIM.dy, 0];
/** One sim copy (gripper + block, all in the sim's tones), posed. */
function simCopy(sc: IsoScene, at: V3, pose: GripPose) {
  const tip = at[2] + 1.5 + pose.lift * SIM.travel;
  const g = SIM.block / 2 + pose.open * (SIM.gOpen - SIM.block / 2);
  const zTop = tip + SIM.len;
  sc.box([at[0], at[1], zTop + 2.5], [9, 2 * (SIM.gOpen + 1.2 + SIM.thick) + 2, 5], "sim");
  sc.beam([at[0], at[1], zTop + 5], [at[0], at[1], zTop + 11], 4.5, 4.5, "sim");
  fingersAt(sc, at, g, tip, pose.press);
  sc.box([at[0], at[1], at[2] + SIM.block / 2 + pose.carry * SIM.travel], [SIM.block, SIM.block, SIM.block], "simblock");
}
function fingersAt(sc: IsoScene, at: V3, g: number, tip: number, press: number) {
  const pad = 1.2;
  const prof: [number, number][] = [
    [0, SIM.len],
    [SIM.thick, SIM.len],
    [SIM.thick * 0.2, 0],
    [0, 0],
  ];
  const lit = press > 0.05 ? " is-lit" : "";
  for (const side of [-1, 1]) {
    sc.prism(prof, [at[0], at[1] + side * (g + pad), tip], [0, side, 0], [0, 0, 1], [1, 0, 0], SIM.width, "sim");
    sc.box([at[0], at[1] + side * (g + pad / 2), tip + SIM.len * 0.47], [SIM.width * 0.72, pad, SIM.len * 0.66], "simpad", { cls: `sx-pad${lit}`, bias: 0.01 });
  }
}
/** The simulation, still: the plate and every copy at its pose for time t (s). */
export function simStatic(sc: IsoScene, t: number) {
  simPlate(sc);
  for (let r = 0; r < SIM.rows; r++) for (let c = 0; c < SIM.cols; c++) simCopy(sc, copyAt(c, r), copyPose(c, r, t).pose);
}

// ------------------------------------------------------------------ timing (seconds)
const T_REAL = 7;
const T_SIM = 4;
const T_LAP = 12;
/** A copy's phase offset (a slow diagonal wave with a little jitter) and whether its try n grips the block: misses get
 *  rarer with practice (55 % at first, ~10 % after a dozen tries). Deterministic. */
const offOf = (c: number, r: number) => ((((c * 0.29 + r * 0.17 + hash01(c * 7 + r * 13) * 0.18) % 1) + 1) % 1) * T_SIM;
function hash01(n: number) {
  let x = (n | 0) * 0x45d9f3b + 0x2f6b;
  x = ((x >>> 16) ^ x) * 0x45d9f3b;
  x = ((x >>> 16) ^ x) >>> 0;
  return (x % 10007) / 10007;
}
function copyPose(c: number, r: number, t: number) {
  const k = t + offOf(c, r);
  const n = Math.floor(k / T_SIM);
  const miss = 0.08 + 0.47 * Math.exp(-n / 4);
  const held = hash01(n * 131 + c * 17 + r * 29 + 5) >= miss;
  return { pose: gripAt((k % T_SIM) / T_SIM, held, 0.75), tries: n };
}

// ================================================================== the widget
type Focus = "real" | "touch" | "sim" | "policy" | null;
export interface SimLoopState {
  t: number;
  playing: boolean;
  focus: Focus;
  realTries: number;
  simTries: number;
  form: "large" | "medium" | "mini";
  /** The drawing's size (px). */
  size: [number, number];
}
export interface SimLoopInstance extends WidgetInstance {
  layout(maxH?: number): void;
  fit(maxH: number | null): void;
  /** focus: dim everything but one part (a card click does the same); playing: start / stop the clock. */
  view(v?: { focus?: Focus; playing?: boolean }): void;
  /** Pause and pose everything at t seconds (reviews). */
  seek(t: number): void;
  state(): SimLoopState;
}

const VIR = VIRIDIS_RGB as number[][];
const ICON_PLAY = `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 3v10l8.5-5z"/></svg>`;
const ICON_PAUSE = `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 3h3v10H4zM9 3h3v10H9z"/></svg>`;
// the card's words (docs/i18n.md): painted from STR() and again on a language switch (the drawing's labels too: it is
// built again)
const STR = strings(
  {
    illTip: "Illustrative: a diagram of the idea, not a measurement. The touch maps come from the course's simplified touch model.",
    name: "Real → sim → real",
    ill: "Illustrative",
    title: "Why practise in simulation?",
    svgTitle:
      "A loop: a real robot learns from a few demos, its policy practises in many simulated copies at once, then the better policy goes back to the real robot. The real pad's touch map and a simulated pad's map look the same.",
    realT: "Real robot",
    realS: '<span class="sl-long">Learns from a few demos a person gives. </span>One try at a time, in real time.',
    tries: "tries so far",
    touchT: "Same touch",
    touchS: 'The sim pad must read like the real pad<span class="sl-long">, or the practice teaches the wrong thing</span>.',
    tuned: "tuned in 3.4",
    simT: "Simulation",
    simS: 'Many copies practise at once<span class="sl-long">, faster than real time (VT-Refine ran 100)</span>.',
    line: "Practice is cheap in simulation: many copies, no broken parts. It only helps if touch there reads like the real pad.",
    policy: "Policy",
    policyJob: "sees + feels → moves",
    realPad: "real pad",
    simPad: "sim pad",
    learn: "learn from demos",
    practise: "practise",
    back: "back to the real robot",
    pause: "Pause",
    play: "Play",
    pauseAria: "Pause the animation",
    playAria: "Play the animation",
  },
  {
    illTip: "示意：这是一张说明思路的图，不是测量结果。触觉图来自本课程简化的触觉模型。",
    name: "真实 → 仿真 → 真实",
    ill: "示意",
    title: "为什么要在仿真中练习？",
    svgTitle: "一个循环：真实机器人先从少量示教中学习，它的策略在许多个仿真副本里同时练习，然后更好的策略回到真实机器人上。真实传感垫的触觉图和仿真传感垫的触觉图看起来一样。",
    realT: "真实机器人",
    realS: '<span class="sl-long">从人给的少量示教中学习。</span>一次只能试一次，按真实时间进行。',
    tries: "已尝试",
    touchT: "同样的触觉",
    touchS: '仿真传感垫的读数必须和真实的一样<span class="sl-long">，否则练习会学错东西</span>。',
    tuned: "在第 3.4 课调校",
    simT: "仿真",
    simS: '许多副本同时练习<span class="sl-long">，比真实时间更快（VT-Refine 同时跑了 100 个）</span>。',
    line: "在仿真中练习很便宜：副本很多，也不会弄坏零件。但只有那里的触觉读数和真实传感垫一样，练习才有用。",
    policy: "策略",
    policyJob: "看 + 摸 → 动作",
    realPad: "真实传感垫",
    simPad: "仿真传感垫",
    learn: "从示教中学习",
    practise: "练习",
    back: "回到真实机器人",
    pause: "暂停",
    play: "播放",
    pauseAria: "暂停动画",
    playAria: "播放动画",
  },
);
const fmtInt = (n: number) => n.toLocaleString("en-US");
/** Under this drawing width (a phone) the drawing is taller and leaves the policy's job out (see build). */
const NARROW = 440;

let seq = 0;

export function mount(el: HTMLElement, ctx: WidgetCtx): SimLoopInstance {
  const reduced = ctx.reducedMotion();
  const uid = `sl${++seq}`;
  const root = h("div", { class: "sl sx" });
  // (reduced motion: one still moment, so the running tallies mean nothing and are left out)
  if (reduced) root.dataset.reduced = "";
  root.innerHTML = `
    <p class="sl-kicker mono"><i class="sl-mark" aria-hidden="true"></i><span class="sl-name" data-t="name">${STR().name}</span><span class="sl-sep" aria-hidden="true">·</span><span class="sl-ill" title="${STR().illTip}" data-t-title="illTip" data-t="ill">${STR().ill}</span></p>
    <div class="sl-head"><p class="sl-title" data-t="title">${STR().title}</p><button type="button" class="sl-btn sl-play" aria-pressed="true"></button></div>
    <div class="sl-draw"><svg class="sl-svg" role="img" aria-labelledby="${uid}-d"><title id="${uid}-d" data-t="svgTitle">${STR().svgTitle}</title><g class="sl-arcs"></g><g class="sl-g sl-pol"></g><g class="sl-g sl-realg"></g><g class="sl-g sl-simg"></g><g class="sl-g sl-maps"></g><g class="sl-tok"></g></svg></div>
    <div class="sl-cards">
      <button type="button" class="sl-card" data-k="real" aria-pressed="false"><span class="sl-card-t"><i class="sl-key sl-key-real" aria-hidden="true"></i>${STR().realT}</span><span class="sl-card-s" data-t="realS">${STR().realS}</span><span class="sl-card-n mono">${STR().tries} <b class="sl-n-real">0</b></span></button>
      <button type="button" class="sl-card" data-k="touch" aria-pressed="false"><span class="sl-card-t"><i class="sl-key sl-key-touch" aria-hidden="true">≈</i>${STR().touchT}</span><span class="sl-card-s" data-t="touchS">${STR().touchS}</span><span class="sl-card-n mono" data-t="tuned">${STR().tuned}</span></button>
      <button type="button" class="sl-card" data-k="sim" aria-pressed="false"><span class="sl-card-t"><i class="sl-key sl-key-sim" aria-hidden="true"></i>${STR().simT}</span><span class="sl-card-s" data-t="simS">${STR().simS}</span><span class="sl-card-n mono">${STR().tries} <b class="sl-n-sim">0</b></span></button>
    </div>
    <p class="sl-line demo-extra" data-t="line">${STR().line}</p>`;
  el.append(root);
  const svg = root.querySelector<SVGSVGElement>(".sl-svg")!;
  const gArcs = svg.querySelector<SVGGElement>(".sl-arcs")!;
  const gPol = svg.querySelector<SVGGElement>(".sl-pol")!;
  const gReal = svg.querySelector<SVGGElement>(".sl-realg")!;
  const gSim = svg.querySelector<SVGGElement>(".sl-simg")!;
  const gMaps = svg.querySelector<SVGGElement>(".sl-maps")!;
  const gTok = svg.querySelector<SVGGElement>(".sl-tok")!;
  const playBtn = root.querySelector<HTMLButtonElement>(".sl-play")!;
  const cards = [...root.querySelectorAll<HTMLButtonElement>(".sl-card")];
  const nReal = root.querySelector<HTMLElement>(".sl-n-real")!;
  const nSim = root.querySelector<HTMLElement>(".sl-n-sim")!;

  // ------------------------------------------------------------------ state
  // reduced motion: one still moment, the real robot holding the block up
  const STILL = T_REAL * 0.52;
  let t = reduced ? STILL : 0;
  let playing = !reduced;
  let focus: Focus = null;
  let fixedMax: number | null = null;
  let form: SimLoopState["form"] = "large";
  let size: [number, number] = [0, 0];

  // the touch maps: the shared engine, a rounded block pressed into a flat 12 x 32 pad
  const mapPads = { real: makePad(), sim: makePad() };
  const mapTouch = { real: createTouch({ pad: mapPads.real }), sim: createTouch({ pad: mapPads.sim }) };
  // (a block with soft edges, held a little skew: real grasps are never perfectly flat)
  const grasped = () => tsBox({ size: [16, 16, 16], round: 6, pose: { rot: rotY(0.1) } });
  const mapShape = { real: grasped(), sim: grasped() };
  const mapRead = { real: createReadout({ style: "real", seed: 3 }), sim: createReadout({ style: "sim" }) };
  const PRESS_MM = 1.2;
  let lastMapKey = "";

  // ------------------------------------------------------------------ layout
  let L: {
    W: number;
    H: number;
    realCam: Cam;
    realBox: { x: number; y: number; w: number; h: number };
    simCam: Cam;
    simBox: { x: number; y: number; w: number; h: number };
    copies: { c: number; r: number; g: SVGGElement; key: string }[];
    cells: { real: SVGRectElement[]; sim: SVGRectElement[] };
    arcs: SVGPathElement[];
    tok: SVGCircleElement;
  } | null = null;

  /** A label's width in the drawing (the .sl-lab style at the drawing's type scale). */
  const textW = (t: string) => {
    const e = document.createElementNS("http://www.w3.org/2000/svg", "text");
    e.setAttribute("class", "sl-lab sl-arc-lab");
    e.setAttribute("visibility", "hidden");
    e.textContent = t;
    svg.append(e);
    const w = e.getComputedTextLength();
    e.remove();
    return w || t.length * 6.6;
  };
  /** A label on one line if it fits `room` px, else on two (split at the space nearest its middle; a label with no
   *  space, Chinese, in the middle). */
  const fitLines = (t: string, room: number): string[] => {
    if (textW(t) <= room) return [t];
    const mid = t.length / 2;
    let at = -1;
    for (let i = 0; i < t.length; i++) if (t[i] === " " && (at < 0 || Math.abs(i - mid) < Math.abs(at - mid))) at = i;
    return at > 0 ? [t.slice(0, at), t.slice(at + 1)] : [t.slice(0, Math.ceil(mid)), t.slice(Math.ceil(mid))];
  };
  const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;");

  const budget = () => {
    if (fixedMax !== null) return fixedMax;
    const card = root.closest<HTMLElement>(".demo-card");
    const mh = card ? parseFloat(card.style.maxHeight) : NaN;
    if (mh > 0) return mh - 2;
    return Math.round(root.clientWidth * 1.06);
  };

  const relayout = () => {
    const Wc = root.clientWidth;
    if (!Wc) return;
    form = Wc < 220 ? "mini" : Wc < 520 ? "medium" : "large";
    root.dataset.form = form;
    const cs = getComputedStyle(root);
    const W = Math.floor(Wc - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight));
    // the height the drawing may take: the budget less everything else (measured with a token drawing); a short
    // budget first drops the closing sentence (the step text says the same)
    const rest = () => {
      svg.setAttribute("height", "10");
      svg.style.height = "10px";
      return root.offsetHeight - 10;
    };
    root.removeAttribute("data-noline");
    // (a phone's narrow drawing with no height given, a stacked page: as tall as its width wants, the card takes its
    // own height, its three cards one under the other)
    const given = fixedMax !== null || parseFloat(root.closest<HTMLElement>(".demo-card")?.style.maxHeight ?? "") > 0;
    // (a phone on its side, a stacked page with no height given: the loop on the left, its three cards one under the
    // other on the right, the whole card no taller than the window)
    const side = !given && Wc >= 560 && window.innerHeight < 560 && window.innerWidth > window.innerHeight;
    root.toggleAttribute("data-side", side);
    if (side) {
      const colW = Math.floor((W - 16) * 0.36);
      const dW = W - 16 - colW;
      root.style.setProperty("--sl-col", `${colW}px`);
      root.setAttribute("data-noline", "");
      svg.setAttribute("height", "10");
      svg.style.height = "10px";
      const cardsH = (root.querySelector(".sl-cards") as HTMLElement).offsetHeight;
      const restS = root.offsetHeight - Math.max(10, cardsH);
      build(dW, Math.round(Math.max(150, Math.min(dW * 0.72, window.innerHeight - 26 - restS))));
      return;
    }
    if (W < NARROW && !given) {
      build(W, Math.round(Math.max(150, W * 0.9)));
      return;
    }
    let H = budget() - rest();
    if (H < W * 0.62) {
      root.setAttribute("data-noline", "");
      H = budget() - rest();
    }
    // (a phone's narrow drawing is a little taller: its stations, labels and maps need the rows)
    build(W, Math.round(Math.max(150, Math.min(W * (W < NARROW ? 0.9 : 0.72), H))));
  };

  const build = (W: number, H: number) => {
    size = [W, H];
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.setAttribute("width", String(W));
    svg.setAttribute("height", String(H));
    svg.style.height = `${H}px`;
    // marks scale with the drawing; type a little less (never under ~10.5 px)
    const k = Math.min(1.25, Math.max(0.78, W / 560));
    const kt = Math.min(1.15, Math.max(0.96, W / 560));
    root.style.setProperty("--sl-k", String(kt));
    // places: the policy on top, the real robot left, the simulation right, the maps and the return arrow below
    // (a narrow drawing: the stations end higher, so the pads' names over the maps keep clear of their bases)
    const narrow = W < NARROW;
    const mapY = H * (narrow ? 0.845 : 0.835);
    const stTop = H * (narrow ? 0.29 : 0.27);
    const stBot = H * (narrow ? 0.665 : 0.74);
    const stH = stBot - stTop;
    const real = fitScene(
      (sc, p: GripPose) => realStation(sc, p),
      [gripAt(0), gripAt(0.5)],
      W * 0.215,
      (stTop + stBot) / 2,
      W * 0.4,
      stH,
    );
    const sim = fitScene(
      (sc, p: number) => {
        simPlate(sc);
        simCopy(sc, copyAt(0, 0), gripAt(p, true, 0.75));
        simCopy(sc, copyAt(SIM.cols - 1, SIM.rows - 1), gripAt(p, true, 0.75));
        simCopy(sc, copyAt(SIM.cols - 1, 0), gripAt(p, true, 0.75));
      },
      [0, 0.5],
      W * 0.785,
      (stTop + stBot) / 2,
      W * 0.4,
      stH,
    );
    // the policy chip, its name and job centred under it (between the two stations)
    const lab = Math.round(11 * kt * 10) / 10;
    const polSc = (() => {
      const f = fitScene((sc) => policyChip(sc), [0], W * 0.5, H * 0.1, W * 0.16, H * 0.15, 1.3);
      const sc = new IsoScene(f.cam);
      policyChip(sc);
      return { sc, box: f.box };
    })();
    const pb = polSc.box;
    const T = STR();
    // (a narrow drawing leaves the policy's job out: it would run into both stations; the step text says it)
    gPol.innerHTML =
      polSc.sc.render() +
      `<text class="sl-lab sl-lab-strong" x="${f1(W / 2)}" y="${f1(pb.y + pb.h + lab * 1.45)}" text-anchor="middle">${T.policy}</text>` +
      (narrow ? "" : `<text class="sl-lab" x="${f1(W / 2)}" y="${f1(pb.y + pb.h + lab * 2.85)}" text-anchor="middle">${T.policyJob}</text>`);

    // the copies: one group each (back to front), its parts translated per frame
    gSim.innerHTML = "";
    const plate = new IsoScene(sim.cam);
    simPlate(plate);
    gSim.insertAdjacentHTML("beforeend", `<g class="sl-plate">${plate.render()}</g>`);
    const order: [number, number][] = [];
    for (let r = 0; r < SIM.rows; r++) for (let c = 0; c < SIM.cols; c++) order.push([c, r]);
    order.sort((a, b) => depthOf(sim.cam, copyAt(a[0], a[1])) - depthOf(sim.cam, copyAt(b[0], b[1])));
    const copies: NonNullable<typeof L>["copies"] = [];
    for (const [c, r] of order) {
      const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
      g.setAttribute("class", "sl-copy");
      gSim.append(g);
      copies.push({ c, r, g, key: "" });
    }
    // the maps: 32 columns (along the pad) x 12 rows, a cell per taxel, one under each station's inner side
    const cell = Math.max(1.6, Math.min(4, (W * 0.22) / 32));
    const mw = cell * 32;
    const mh = cell * 12;
    const mapX = { real: W * 0.385 - mw, sim: W * 0.615 };
    const mk = (x0: number, kind: "real" | "sim") => {
      let s = `<g class="sl-map sl-map-${kind}"><rect class="sl-map-bg" x="${f1(x0 - 2)}" y="${f1(mapY - mh / 2 - 2)}" width="${f1(mw + 4)}" height="${f1(mh + 4)}" rx="2"/>`;
      for (let i = 0; i < 12; i++) for (let j = 0; j < 32; j++) s += `<rect x="${f1(x0 + j * cell)}" y="${f1(mapY - mh / 2 + i * cell)}" width="${f1(cell + 0.05)}" height="${f1(cell + 0.05)}"/>`;
      return `${s}</g>`;
    };
    const tagY = mapY - mh / 2 - 6;
    gMaps.innerHTML =
      mk(mapX.real, "real") +
      mk(mapX.sim, "sim") +
      `<text class="sl-lab" x="${f1(mapX.real)}" y="${f1(tagY)}">${T.realPad}</text>` +
      `<text class="sl-lab" x="${f1(mapX.sim + mw)}" y="${f1(tagY)}" text-anchor="end">${T.simPad}</text>` +
      `<text class="sl-approx" x="${f1(W / 2)}" y="${f1(mapY + 1)}" text-anchor="middle" dominant-baseline="middle">≈</text>`;
    const cellsOf = (kind: string) => [...gMaps.querySelectorAll<SVGRectElement>(`.sl-map-${kind} rect:not(.sl-map-bg)`)];

    // the loop: demos -> policy, policy -> sim, sim -> back to the real robot (under the maps)
    const rb = real.box;
    const sb = sim.box;
    const midY = pb.y + pb.h * 0.5;
    const a1 = { p0: [rb.x + rb.w * 0.62, rb.y - 4], c: [rb.x + rb.w * 0.62, midY], p1: [pb.x - 8, midY] };
    const a2 = { p0: [pb.x + pb.w + 8, midY], c: [sb.x + sb.w * 0.42, midY], p1: [sb.x + sb.w * 0.42, sb.y - 4] };
    const yBot = Math.min(H - 17 * kt, mapY + mh / 2 + 10);
    // (the way back runs round the maps: down right of the sim map, under both, up left of the real one)
    const x30 = Math.min(sb.x + sb.w - 10, Math.max(sb.x + sb.w * 0.3, mapX.sim + mw + 14));
    const x31 = Math.max(rb.x + 10, Math.min(rb.x + rb.w * 0.72, mapX.real - 14));
    const a3 = { p0: [x30, sb.y + sb.h + 2], p1: [x31, rb.y + rb.h + 2] };
    const q = (a: { p0: number[]; c: number[]; p1: number[] }) => `M${a.p0.map(f1).join(" ")}Q${a.c.map(f1).join(" ")} ${a.p1.map(f1).join(" ")}`;
    // (a U with round corners: down, along under the maps, up)
    const r3 = Math.min(14, (yBot - Math.max(a3.p0[1], a3.p1[1])) * 0.8);
    const d3 =
      `M${f1(x30)} ${f1(a3.p0[1])}V${f1(yBot - r3)}Q${f1(x30)} ${f1(yBot)} ${f1(x30 - r3)} ${f1(yBot)}` +
      `H${f1(x31 + r3)}Q${f1(x31)} ${f1(yBot)} ${f1(x31)} ${f1(yBot - r3)}V${f1(a3.p1[1])}`;
    const head = (tip: number[], from: number[]) => {
      const ang = Math.atan2(tip[1] - from[1], tip[0] - from[0]);
      const s = 5.5 * k;
      const p = (da: number) => [tip[0] - s * Math.cos(ang + da), tip[1] - s * Math.sin(ang + da)].map(f1).join(" ");
      return `M${p(0.5)}L${tip.map(f1).join(" ")}L${p(-0.5)}`;
    };
    // the arcs' labels stay inside the drawing: "learn from demos" left of its arc, on two lines where one does not
    // fit (a phone), "practise" right of its arc, against the right edge where it would run past it
    const learnX = a1.p0[0] - 7;
    const learnY = (a1.p0[1] + a1.p1[1]) / 2 + 4;
    const lines = fitLines(T.learn, learnX - 3);
    const learnSvg =
      lines.length === 1
        ? `<text class="sl-lab sl-arc-lab" x="${f1(learnX)}" y="${f1(learnY)}" text-anchor="end">${esc(lines[0])}</text>`
        : `<text class="sl-lab sl-arc-lab" x="${f1(learnX)}" y="${f1(learnY - lab * 0.62)}" text-anchor="end">${lines.map((l, i) => `<tspan x="${f1(learnX)}" dy="${i ? f1(lab * 1.25) : 0}">${esc(l)}</tspan>`).join("")}</text>`;
    const prX = a2.c[0] + 7;
    const prW = textW(T.practise);
    const practiseSvg =
      prX + prW > W - 2
        ? `<text class="sl-lab sl-arc-lab" x="${f1(W - 2)}" y="${f1((a2.p0[1] + a2.p1[1]) / 2 + 8)}" text-anchor="end">${T.practise}</text>`
        : `<text class="sl-lab sl-arc-lab" x="${f1(prX)}" y="${f1((a2.p0[1] + a2.p1[1]) / 2 + 8)}" text-anchor="start">${T.practise}</text>`;
    gArcs.innerHTML =
      `<path class="sl-arc" d="${q(a1)}"/><path class="sl-arc" d="${q(a2)}"/><path class="sl-arc" d="${d3}"/>` +
      `<path class="sl-head" d="${head(a1.p1, a1.c)}${head(a2.p1, a2.c)}${head(a3.p1, [x31, a3.p1[1] + 10])}"/>` +
      learnSvg +
      practiseSvg +
      `<text class="sl-lab sl-arc-lab" x="${f1(W / 2)}" y="${f1(Math.min(H - 3, yBot + 14 * kt))}" text-anchor="middle">${T.back}</text>`;
    const arcs = [...gArcs.querySelectorAll<SVGPathElement>(".sl-arc")];
    gTok.innerHTML = `<circle class="sl-tok-dot" r="${f1(4.2 * k)}" cx="-99" cy="-99"/>`;
    L = {
      W,
      H,
      realCam: real.cam,
      realBox: real.box,
      simCam: sim.cam,
      simBox: sim.box,
      copies,
      cells: { real: cellsOf("real"), sim: cellsOf("sim") },
      arcs,
      tok: gTok.querySelector("circle")!,
    };
    lastMapKey = "";
    render();
  };

  // ------------------------------------------------------------------ per frame
  const realPoseAt = (tt: number) => gripAt((tt % T_REAL) / T_REAL, true, 0.7);
  const drawMap = (kind: "real" | "sim", press: number, frame: number) => {
    if (!L) return;
    const pad = mapPads[kind];
    const touch = mapTouch[kind];
    const shape = mapShape[kind];
    const ro = mapRead[kind];
    touch.reset();
    pressOnto(shape, pad, { a: -14, b: 0.6, depth: press > 0 ? press * PRESS_MM : -1 });
    touch.step([shape], 0);
    // (real style: the noise follows the frame number, so a still picture is still)
    ro.frame = frame;
    ro.read(touch.force);
    const cells = L.cells[kind];
    for (let i = 0; i < 12; i++)
      for (let j = 0; j < 32; j++) {
        const v = ro.norm[i * 32 + j];
        const r = cells[i * 32 + j];
        if (v <= 0.004) {
          if (r.style.fill) r.style.removeProperty("fill");
          continue;
        }
        const c = VIR[Math.max(0, Math.min(255, Math.round(v * 255)))];
        r.style.fill = `rgb(${c[0]},${c[1]},${c[2]})`;
      }
  };

  const render = () => {
    if (!L) return;
    // the real robot (redrawn: its arm solves for the wrist each frame)
    const rp = realPoseAt(t);
    const sc = new IsoScene(L.realCam);
    realStation(sc, rp);
    gReal.innerHTML = sc.render();
    // the copies: redraw only those whose pose changed (rounded), so a still frame costs nothing
    let simTries = 0;
    for (const cp of L.copies) {
      const { pose, tries } = copyPose(cp.c, cp.r, t);
      simTries += tries;
      const key = [pose.lift, pose.open, pose.carry].map((v) => Math.round(v * 200)).join(",") + (pose.press > 0.05 ? "p" : "");
      if (key === cp.key) continue;
      cp.key = key;
      const s2 = new IsoScene(L.simCam);
      simCopy(s2, copyAt(cp.c, cp.r), pose);
      cp.g.innerHTML = s2.render();
    }
    const realTries = Math.floor(t / T_REAL);
    nReal.textContent = fmtInt(realTries);
    nSim.textContent = fmtInt(simTries);
    // the maps: the real robot's grasp, read the real way and replayed in sim (at most ~15 a second: the real one's
    // noise would flicker otherwise)
    const frame = Math.floor(t * 15);
    const mapKey = `${frame}|${Math.round(rp.press * 50)}`;
    if (mapKey !== lastMapKey) {
      lastMapKey = mapKey;
      drawMap("real", rp.press, frame);
      drawMap("sim", rp.press, frame);
    }
    // the travelling dot: 3 s along each arrow, then 1 s "inside" the station it reaches
    const lap = (t % T_LAP) / (T_LAP / 3);
    const leg = Math.min(2, Math.floor(lap));
    const u = (lap - leg) / 0.75;
    const arc = L.arcs[leg];
    if (u <= 1 && arc && !reduced) {
      const len = arc.getTotalLength();
      const p = arc.getPointAtLength(ease(u) * len);
      L.tok.setAttribute("cx", f1(p.x));
      L.tok.setAttribute("cy", f1(p.y));
      L.tok.style.opacity = String(Math.min(1, u * 6, (1 - u) * 6));
    } else L.tok.style.opacity = "0";
  };

  // ------------------------------------------------------------------ focus, play
  const setFocus = (f: Focus) => {
    focus = f;
    if (f) root.dataset.focus = f;
    else delete root.dataset.focus;
    for (const c of cards) c.setAttribute("aria-pressed", String(c.dataset.k === f));
  };
  for (const c of cards) c.addEventListener("click", () => setFocus(focus === c.dataset.k ? null : (c.dataset.k as Focus)));
  const syncPlay = () => {
    const T = STR();
    playBtn.innerHTML = playing ? `${ICON_PAUSE}<span>${T.pause}</span>` : `${ICON_PLAY}<span>${T.play}</span>`;
    playBtn.setAttribute("aria-pressed", String(playing));
    playBtn.setAttribute("aria-label", playing ? T.pauseAria : T.playAria);
    playBtn.hidden = reduced;
  };
  playBtn.addEventListener("click", () => {
    playing = !playing;
    syncPlay();
    run();
  });

  // ------------------------------------------------------------------ motion
  let visible = !document.hidden;
  let onscreen = true;
  let raf = 0;
  let last = 0;
  const tick = (now: number) => {
    raf = 0;
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    t += dt;
    render();
    run();
  };
  function run() {
    const want = visible && onscreen && playing;
    if (want && !raf) {
      last = performance.now();
      raf = requestAnimationFrame(tick);
    } else if (!want && raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  }
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
  let lastW = 0;
  const ro = new ResizeObserver(() => {
    if (root.clientWidth !== lastW) {
      lastW = root.clientWidth;
      relayout();
    }
  });
  ro.observe(root);
  // (the side form depends on the window's height too)
  let lastWinH = window.innerHeight;
  const onWin = () => {
    if (window.innerHeight === lastWinH) return;
    lastWinH = window.innerHeight;
    relayout();
  };
  window.addEventListener("resize", onWin);
  document.fonts?.ready.then(() => relayout());

  // a language switch: the words, the play button, and the drawing built again with its labels in the new language
  // (the loop's time, the focus and the tallies carry on)
  const offLang = ctx.onLang(() => {
    paintText(root, STR());
    setTextBeside(root.querySelector(".sl-key-real"), STR().realT, true);
    setTextBeside(root.querySelector(".sl-key-touch"), STR().touchT, true);
    setTextBeside(root.querySelector(".sl-key-sim"), STR().simT, true);
    setTextBeside(nReal, `${STR().tries} `);
    setTextBeside(nSim, `${STR().tries} `);
    syncPlay();
    relayout();
  });

  syncPlay();
  relayout();
  run();

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
      if (v.playing !== undefined && !reduced) {
        playing = v.playing;
        syncPlay();
        run();
      }
    },
    seek(tt: number) {
      playing = false;
      syncPlay();
      run();
      t = tt;
      for (const cp of L?.copies ?? []) cp.key = "";
      lastMapKey = "";
      render();
    },
    state: () => ({
      t,
      playing,
      focus,
      realTries: Math.floor(t / T_REAL),
      simTries: Number(nSim.textContent?.replace(/,/g, "") || 0),
      form,
      size,
    }),
    destroy() {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("resize", onWin);
      offLang();
      root.remove();
    },
  };
}
