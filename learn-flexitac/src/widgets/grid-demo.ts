// Four touch spots: the 2 × 2 sequel of the unit card (src/widgets/unit-demo.ts), for Lesson 2 step 3. Same drawing
// vocabulary (camera, gold strips with four-tone faces, the Velostat's tinted glass, the dashed teal touch spot, the
// rubber press tip, pink current dots, a 10 kΩ R1 with a voltmeter), now with TWO top strips and TWO bottom strips:
//   (a) an isometric 2 × 2: two top strips S1 (back) and S2 (front) run left-right ABOVE a Velostat sheet, two bottom
//       strips D1 (left) and D2 (right) run front-back BELOW it. The sheet is drawn as tinted glass (as the unit card's
//       front half), so all four touch spots stay legible: each is the slice of film between a crossing's strips, its
//       front face outlined in the ring's teal (dashed) right under the top strip's edge, with up to three conductive
//       paths (signal pink) that light when that spot is pressed. At rest the layers sit a few px apart (exploded); a
//       press closes the gaps at that crossing only and bends the top strip into it.
//   (b) the circuit, the real board in miniature: each bottom strip's front end is wired down to a switch from a +5 V
//       rail in a chip box labelled "drive" (the board's shift registers: one line at 5 V at a time, the other at 0 V);
//       each top strip's right end is wired to one input of a 2-way selector in a chip box labelled "pick one" (the
//       board's multiplexer), whose output is A0 -> R1 (10 kΩ) -> GND, a voltmeter across R1.
//   (c) a 2 × 2 touch map (viridis, @shared/models/viridis.mjs, of V / 5 V): rows S1 (back, top) and S2 (front), columns
//       D1 (left) and D2 (right), as the crossings sit in the drawing; it fills cell by cell as readings arrive.
// The animation scans one picture = 4 readings, slowly (~12 s a picture), in the firmware's order (shared/models/
// scan.mjs, and the step 3 card, pad-demo.ts: the outer loop picks a sense line, the inner one powers the drive lines
// one at a time): pick S1 (the selector's blade swings over; both drive lines at 0 V) -> power D1 (its switch closes,
// the line glows, the other line is tagged 0 V) -> the loop is closed: pink dots run along the ONE live path (+5 V ->
// the powered drive line -> the crossing -> the picked sense line -> selector -> A0 -> R1 -> GND) at a speed set by its
// current, everything off that path dims, the meter settles -> the value goes into the map -> D1 off, power D2 -> ...;
// pick S2 -> D1, D2. Then "picture done", the finger moves (lifts, travels, presses another crossing; once two at once)
// and the scan repeats. A one-line caption follows each reading ("Listen to S1 · power D2 → 4.39 V → bright").
// Numbers: R from @shared/models/taxel.mjs (200 kΩ untouched, 1.4 kΩ pressed hard), V from @shared/models/divider.mjs
// with R_on left out (vOf, as the unit card: the same press reads the same 0.24 V / 4.39 V as step 1). FIRST ORDER: the
// other pressed spots' parallel paths are left out (divider.mjs NOTE). ILLUSTRATIVE: there is no force data; press is a
// unitless 0..1 and never shown in newtons.
// Interaction: click / tap a crossing (in the drawing, or its map cell, a button) to press or release it: the learner
// then drives the presses (the finger's tour stops) and the scan keeps going. Play / pause; "One reading" plays the
// next reading and stops (pressed again mid-way, it finishes that one at once and plays the next); ← / → step back /
// on (back jumps). Reduced motion: no loop and no moving dots; steps and presses jump. The loop stops while the tab is
// hidden or the card is off screen.
// Forms, from the drawing's width W (the card's less its padding) and the host's data-compact / data-short (src/ui/
// demo.ts): W < 200 "mini" (a phone's band: the 3D 2 × 2 with S/D names only, V as a text row, the map, a short
// caption, icon buttons); 200 <= W < 400 "full" (the circuit under the 2 × 2, V as a text row under the drawing, the
// map beside the caption); W >= 400 "large" (the meter's reading box in the drawing when it fits, the map's cells with
// their values). The circuit's labels keep their size while the 2 × 2 shrinks, so where its scale would fall under
// S_NARROW (a card under ~330 px: a tablet's band, a zoomed page) the full form draws the 2 × 2 alone, as the mini form
// does; in a small circuit D2's level goes right of its wire and the chip's job left of D1's switch (splitOf), and the
// selector moves right of both (selDxOf). A phone's band in the host's last form gets the free height beside the pad
// as data-max-h and drops, in order, V's row (the buttons then stand beside the map), the reading count and the 3D
// 2 × 2 until it fits (TIGHT_LEVELS, grid-demo.css [data-tight]). Both name the chips twice: their job ("drive", "pick one") and the board's part ("shift registers",
// "multiplexer"), so this step hands over to step 3's. The drawing's scale is the largest that fits the width (capped),
// and, when the card (or an ancestor) carries data-max-h="<px>", also the card's height. Its type and symbols grow with
// the card (TYPE_K: the svg is drawn W / k wide and shown W wide, so its 9.5 px labels show at 11.4 px and more; the
// 3D parts' edges keep 1 px, grid-demo.css). Compact drops the closing sentence (.demo-extra) and "1 picture = 4
// readings" (the step text and the caption say it), never the S / D key; short also drops the key and caps the
// drawing's scale.
// Sync: the instance (GridDemoInstance) has subscribe(fn), and the root dispatches a bubbling "gd:reading"
// CustomEvent, with the reading in progress (phase, sense i, drive k, volts), the pressed crossings and the picture so
// far (in reading order: index sense * 2 + drive), whenever one of them changes, so the figure can mirror them (the
// host wires it, src/ui/demo.ts; this card never acts on the figure).
import { rTaxel, squash } from "@shared/models/taxel.mjs";
import { R1, VCC, vA0 } from "@shared/models/divider.mjs";
import { VIRIDIS_RGB } from "@shared/models/viridis.mjs";
import { fill, strings } from "../i18n";
import { paintText } from "../i18n/paint";
import type { WidgetCtx, WidgetInstance } from "../types";
import { h } from "../ui/dom";
import "./grid-demo.css";

// ------------------------------------------------------------------ the sync API
export type GridPhase = "idle" | "pick" | "power" | "read" | "record" | "done" | "move";
export interface GridCrossing {
  /** 0 = D1 (left bottom strip), 1 = D2. */
  drive: 0 | 1;
  /** 0 = S1 (back top strip), 1 = S2. */
  sense: 0 | 1;
}
export interface GridReading {
  /** What the scan is doing: the selector moving to the next sense line, every drive line off ("pick"), a drive line
   *  switching on ("power"; the loop closes as it comes on), the meter settling ("read"), the value going into the
   *  map ("record"), the picture complete ("done"), the finger moving ("move"), or nothing yet ("idle", reduced motion
   *  before the first step). One picture: pick S1, (power, read, record) D1 and D2, pick S2, the same, done. */
  phase: GridPhase;
  /** The sense line listened to (picked first) and the drive line powered (null when none). */
  sense: 0 | 1 | null;
  drive: 0 | 1 | null;
  /** Volts across R1 for the live crossing once the loop is closed (illustrative), else null. */
  volts: number | null;
  /** The crossings pressed now, with their press (0..1, unitless, illustrative), in reading order (sense, then drive). */
  pressed: (GridCrossing & { amount: number })[];
  /** This picture's readings so far, in reading order: index sense * 2 + drive (S1·D1, S1·D2, S2·D1, S2·D2; the
   *  layout of the step 3 card's values[sense * 32 + drive] and Fig 1's ft:touch), volts, or null not read yet. */
  picture: (number | null)[];
  playing: boolean;
}
export interface GridDemoInstance extends WidgetInstance {
  /** Calls fn with every new reading state (and once at once). Returns an unsubscribe function. */
  subscribe(fn: (r: GridReading) => void): () => void;
  readonly reading: GridReading;
  play(): void;
  pause(): void;
  /** One reading on (1, played) or back (-1, a jump). */
  step(dir?: 1 | -1): void;
  /** Press (on = true), release (false) or toggle (undefined) a crossing, as a click on it does. */
  toggle(drive: 0 | 1, sense: 0 | 1, on?: boolean): void;
  /** Pause and put the scan at t seconds into picture `pic` (default: this one), its readings up to there taken. For
   *  reviews, tests and a host that drives the card. */
  seek(t: number, pic?: number): void;
}

// ------------------------------------------------------------------ numbers
// the card's words (docs/i18n.md): painted from S() and again on a language switch (the drawing's labels too: it is
// built again, measuring them)
const S = strings(
  {
    illTip: "Shape only: there is no force data. Press is unitless (0 = untouched, 1 = hard press).",
    name: "Four touch spots",
    ill: "Illustrative",
    animAria: "Two top strips over two bottom strips: four touch spots, read one at a time. Left and right arrow keys step one reading.",
    legendLong: '<span class="gd-term"><b>S</b> top strip · sense line</span> <span class="gd-sep" aria-hidden="true">·</span> <span class="gd-term"><b>D</b> bottom strip · drive line</span>',
    legendShort: '<span class="gd-term"><b>S</b> = top strip (sense)</span> <span class="gd-sep" aria-hidden="true">·</span> <span class="gd-term"><b>D</b> = bottom strip (drive)</span>',
    mapAria: "Touch map, one cell per touch spot. Press a cell to press or release that spot.",
    per: "1 picture = 4 readings",
    pause: "Pause",
    play: "Play",
    pauseAria: "Pause the scan",
    playAria: "Play the scan",
    one: "One reading",
    click: "click a spot to press it · ",
    line: "Listen to one top line and power one bottom line at a time: each reading is about the one spot where they cross. 2 × 2 = 4 spots = 4 readings per picture.",
    drive: "drive",
    shift: "shift registers",
    pick: "pick one",
    mux: "multiplexer",
    bright: "bright",
    dim: "dim",
    dark: "dark",
    cellAria: "{name}: {state}{read}. Press to {act} it.",
    cellRead: ", read {v}, {level}",
    pressed: "pressed",
    notPressed: "not pressed",
    release: "release",
    press: "press",
    and: " and ",
    ready: "Ready",
    idleShort: "Finger on {list}",
    none: "none",
    idle: "A finger presses {list}. Press <b>One reading</b> to take the first reading.",
    nothing: "nothing",
    next: "Next picture",
    moveShort: "Finger → {list}",
    moveShort2: "Fingers → {list}",
    moveFirst: "A finger presses {list} and holds.",
    moveTwo: "Two fingers now: {list}.",
    move: "The finger moves to {name}.",
    done: "Picture done",
    where0: "no bright spot: nothing pressed",
    where1: "one bright spot, where the finger is",
    whereN: "{n} bright spots, where the fingers are",
    n2: "two",
    n3: "three",
    n4: "four",
    doneCap: "Picture done: 4 readings, {where}.",
    doneShort: "Done: {n} bright",
    count: "Reading {n} of 4",
    pickShort: "Listen to {s}",
    pickCap: "Listen to <b>{s}</b>: the selector picks it. Both drive lines are at 0 V.",
    powerShort: "{s} · power {d}",
    powerCap: "Listen to <b>{s}</b> · power <b>{d}</b>; the other drive line stays at 0 V.",
    readCap: "Listen to <b>{s}</b> · power <b>{d}</b>{tail}",
  },
  {
    illTip: "只示意形状，没有实测数据。按压没有单位（0 = 没碰，1 = 用力按）。",
    name: "四个触摸点",
    ill: "示意",
    animAria: "两条上层铜条叠在两条下层铜条上：四个触摸点，一次读一个。用左右方向键一次走一个读数。",
    legendLong: '<span class="gd-term"><b>S</b> 上层铜条 · 感应线</span> <span class="gd-sep" aria-hidden="true">·</span> <span class="gd-term"><b>D</b> 下层铜条 · 驱动线</span>',
    legendShort: '<span class="gd-term"><b>S</b> = 上层铜条（感应）</span> <span class="gd-sep" aria-hidden="true">·</span> <span class="gd-term"><b>D</b> = 下层铜条（驱动）</span>',
    mapAria: "触觉图，每个格子是一个触摸点。点一个格子，按下或松开那个点。",
    per: "1 张图 = 4 个读数",
    pause: "暂停",
    play: "播放",
    pauseAria: "暂停扫描",
    playAria: "播放扫描",
    one: "读一次",
    click: "点一个点来按压 · ",
    line: "每次只听一条上层线、只给一条下层线通电：每个读数只反映它们交叉的那一个点。2 × 2 = 4 个点 = 每张图 4 个读数。",
    drive: "驱动",
    shift: "移位寄存器",
    pick: "选一条",
    mux: "多路选择器",
    bright: "亮",
    dim: "微亮",
    dark: "暗",
    cellAria: "{name}：{state}{read}。点击可{act}。",
    cellRead: "，读数 {v}，{level}",
    pressed: "已按下",
    notPressed: "未按下",
    release: "松开",
    press: "按下",
    and: "和",
    ready: "就绪",
    idleShort: "手指在 {list}",
    none: "无",
    idle: "一根手指按着 {list}。点 <b>读一次</b>，读第一个读数。",
    nothing: "空处",
    next: "下一张图",
    moveShort: "手指 → {list}",
    moveShort2: "手指 → {list}",
    moveFirst: "一根手指按住 {list}。",
    moveTwo: "现在有两根手指：{list}。",
    move: "手指移到 {name}。",
    done: "一张图完成",
    where0: "没有亮点：什么都没按",
    where1: "一个亮点，就在手指的位置",
    whereN: "{n} 个亮点，就在手指的位置",
    n2: "两",
    n3: "三",
    n4: "四",
    doneCap: "一张图完成：4 个读数，{where}。",
    doneShort: "完成：{n} 个亮",
    count: "读数 {n} / 4",
    pickShort: "听 {s}",
    pickCap: "听 <b>{s}</b>：选择器选中它。两条驱动线都是 0 V。",
    powerShort: "{s} · 给 {d} 通电",
    powerCap: "听 <b>{s}</b> · 给 <b>{d}</b> 通电；另一条驱动线保持 0 V。",
    readCap: "听 <b>{s}</b> · 给 <b>{d}</b> 通电{tail}",
  },
);
/** V across R1 (R_on left out, as the unit card: its numbers and these agree for the same press). */
const vOf = (r: number) => vA0(r, { rOn: 0 });
const ampsOf = (r: number) => VCC / (R1 + r);
const I_HARD = ampsOf(rTaxel(1));
const DOT_MAX = 34;
const fmtV = (v: number) => `${v.toFixed(2)} V`;
const levelOf = (v: number) => (v >= 2.5 ? "bright" : v >= 0.6 ? "dim" : "dark");
const viridis = (v: number) => {
  const c = VIRIDIS_RGB[Math.max(0, Math.min(255, Math.round((255 * v) / VCC)))];
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
};
const NAME_D = ["D1", "D2"];
const NAME_S = ["S1", "S2"];
/** A crossing's name, sense line first (as the readings, the map's rows and the quiz name it): "S1 · D2". */
const cName = (c: number) => `${NAME_S[c & 1]} · ${NAME_D[c >> 1]}`;

// ------------------------------------------------------------------ the scan's timeline (seconds)
type SegKind = "pick" | "power" | "read" | "record" | "done" | "move";
type Seg = { kind: SegKind; k: number; i: number; dur: number; t0: number };
const T_POWER = 0.8;
const T_PICK = 0.65;
const T_READ = 0.7;
const T_RECORD = 1.05;
const T_DONE = 2.1;
const T_MOVE = 1.9;
/** "One reading" plays the next reading this much faster than the loop. */
const STEP_RATE = 1.6;
/** One picture, the firmware's order: pick S1 (no drive line on), then (power, read, record) D1 and D2; pick S2, the
 *  same; done; and (the finger's tour) a move. */
function segsFor(move: boolean): Seg[] {
  const out: Seg[] = [];
  let t = 0;
  const add = (kind: SegKind, k: number, i: number, dur: number) => {
    out.push({ kind, k, i, dur, t0: t });
    t += dur;
  };
  for (let i = 0; i < 2; i++) {
    add("pick", -1, i, T_PICK);
    for (let k = 0; k < 2; k++) {
      add("power", k, i, T_POWER);
      add("read", k, i, T_READ);
      add("record", k, i, T_RECORD);
    }
  }
  add("done", -1, -1, T_DONE);
  if (move) add("move", -1, -1, T_MOVE);
  return out;
}
const SEGS_TOUR = segsFor(true);
const SEGS_USER = segsFor(false);
const durOf = (segs: Seg[]) => segs[segs.length - 1].t0 + segs[segs.length - 1].dur;
/** The finger's tour: the crossings pressed in picture n (index drive * 2 + sense): S1·D2, S2·D1, two at once (S1·D1 and
 *  S2·D2), S2·D2. */
const TOUR = [[2], [1], [0, 3], [3]];
const tourAt = (pic: number) => (pic < 0 ? [] : TOUR[pic % TOUR.length]);

// ------------------------------------------------------------------ the 2 × 2, in world units (z up)
/** Strip width, thickness (bottom, top); the lines at ±C (D1, D2 at x; S1, S2 at y); the Velostat sheet's half side and
 *  thickness; the exploded gap at rest; the strips' wired (near) and free (far) half-lengths. */
const SW = 22;
const HS = SW / 2;
const TB = 4;
const TT = 4;
const C = 36;
const XD = [-C, C];
const YS = [-C, C];
const HV = 64;
const VT = 10;
const G0 = 5;
const LN = 100;
const LF = 82;
/** The mini form (no wires) has shorter strips, both ends just past the sheet. */
const L_MINI = 76;
const lensOf = (plan: string) => (plan === "mini" ? { ln: L_MINI, lf: L_MINI } : { ln: LN, lf: LF });
/** The drive chip's height: its switches (the rail 28 under its top) and, under the rail, its board name. */
const CHIP_H = 46;
/** A compact card's drawing never shrinks under this scale (its own units): below it the circuit's labels would crowd
 *  the 2 × 2. A card still too tall then is the host's next form (short). */
const S_FLOOR = 0.8;
/** The circuit's labels keep their own size (TYPE_K) while the 2 × 2 shrinks: under this scale they would no longer fit
 *  round it (a card under ~330 px wide: a tablet's band, a zoomed page), and the drawing is the 2 × 2 alone, as a
 *  phone's (the step's text and the caption name the drive and pick-one chips). */
const S_NARROW = 0.55;
/** A phone's band (src/ui/demo.ts gives the card the free height beside the pad): the levels the mini form drops
 *  through to fit it (grid-demo.css [data-tight]), and the least height its 3D 2 × 2 keeps before it goes. */
const TIGHT_LEVELS = 3;
/** The drawing width (px) under which a card in the host's last form may drop to its tight levels (a phone's band, a
 *  phone on its side's ~330 px card, a zoomed page's ~250 px card; never a desktop's large card). */
const TIGHT_W = 360;
const MIN_DRAW = 46;
const Z_V0 = TB + G0;
const Z_V1 = Z_V0 + VT;
const Z_TB = Z_V1 + G0;
/** The press tip (as the unit card's): radius, rounded end's height (flattened pressed hard), lift at rest, and how
 *  high it hovers while it travels (world units). */
const TIP_R = 10;
const TIP_HD0 = 9;
const TIP_HD1 = 5;
const TIP_LIFT = 8;
const HOVER = 14;
/** Conductive paths through a touch spot (on its front face): x offset, the press at which it lights, grain heights
 *  and sideways jitter (the unit card's, for a thinner film). */
const PATH_X = [-6, 0.5, 6.5];
const PATH_ON = [0.12, 0.36, 0.6];
const PATH_V = [0.76, 0.5, 0.24];
const PATH_JIT = [2, -2, 1.6];

// the camera (the unit card's): azimuth 25°, 30° down
const AZ = (25 * Math.PI) / 180;
const EL = (30 * Math.PI) / 180;
const CA = Math.cos(AZ);
const SA = Math.sin(AZ);
const SE = Math.sin(EL);
const CE = Math.cos(EL);
const sxOf = (x: number, y: number) => x * CA - y * SA;
const syOf = (x: number, y: number, z: number) => (x * SA + y * CA) * SE - z * CE;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const wave = (t: number) => 0.5 - 0.5 * Math.cos(Math.PI * clamp01(t));
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const fall = (d: number, r0: number, r1: number) => (d <= r0 ? 1 : d >= r1 ? 0 : 0.5 + 0.5 * Math.cos((Math.PI * (d - r0)) / (r1 - r0)));
const dentX = (dx: number) => fall(Math.abs(dx), 8, 30);
/** A crossing pressed p: its gaps, the squeeze, and how far the top strip comes down over it. */
const crossPose = (p: number) => {
  const g = G0 * (1 - smooth(0, 0.3, p));
  const dent = squash(p) * VT;
  return { g, dent, zV0: TB + g, drop: 2 * (G0 - g) + dent };
};

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
/** Deterministic scatter (the unit card's), so the grains sit in the same places every time. */
function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** Set an attribute only when it changes (the frame loop writes many). */
const memo = new WeakMap<Element, Record<string, string>>();
function set(el: Element, name: string, v: string) {
  let m = memo.get(el);
  if (!m) memo.set(el, (m = {}));
  if (m[name] === v) return;
  m[name] = v;
  el.setAttribute(name, v);
}

const ICON_PLAY = `<svg class="gd-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z"/></svg>`;
const ICON_PAUSE = `<svg class="gd-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M7.5 5.5h3v13h-3zM13.5 5.5h3v13h-3z"/></svg>`;
const ICON_STEP = `<svg class="gd-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 5.5v13l9-6.5z"/><path d="M16.5 5.5h2.2v13h-2.2z"/></svg>`;

/** The drawing's type and symbol scale for a drawing Wr px wide: none on a phone's band (mini), 1.2 in the full form
 *  (its 9.5 px labels show at 11.4 px), and in the large form growing with the card up to 1.45 (a 650 px drawing). */
const TYPE_K = (Wr: number) => (Wr < 200 ? 1 : Wr < 400 ? 1.2 : Math.min(1.45, Math.max(1.2, Wr / 450)));

let seq = 0;

export function mount(el: HTMLElement, ctx: WidgetCtx): GridDemoInstance {
  const reduced = ctx.reducedMotion();
  const uid = `gd${++seq}`;
  const root = h("div", { class: "gd" });
  const cells = [0, 1, 2, 3]
    .map((c) => {
      const k = c >> 1;
      const i = c & 1;
      // (grid placement: row = sense line, column = drive line, as the crossings sit in the drawing)
      return `<button type="button" class="gd-cell" data-c="${c}" style="grid-row:${i + 1};grid-column:${k + 2}"><span class="gd-cell-v mono"></span><i class="gd-cell-ring" aria-hidden="true"></i></button>`;
    })
    .join("");
  root.innerHTML = `
    <p class="gd-kicker mono"><i class="gd-ring" aria-hidden="true"></i><span class="gd-name" data-t="name">${S().name}</span><span class="gd-sep" aria-hidden="true">·</span><span class="gd-ill" title="${S().illTip}" data-t-title="illTip" data-t="ill">${S().ill}</span></p>
    <div class="gd-anim" tabindex="0" role="group" aria-label="${S().animAria}" data-t-aria="animAria"><svg class="gd-svg" aria-hidden="true"></svg></div>
    <p class="gd-legend mono"><span class="gd-legend-long" data-t="legendLong">${S().legendLong}</span><span class="gd-legend-short" data-t="legendShort">${S().legendShort}</span></p>
    <div class="gd-row">
      <div class="gd-mapbox">
        <div class="gd-map" role="group" aria-label="${S().mapAria}" data-t-aria="mapAria">
          <span class="gd-ml mono" style="grid-row:1;grid-column:1">S1</span><span class="gd-ml mono" style="grid-row:2;grid-column:1">S2</span>
          <span class="gd-ml gd-ml-d mono" style="grid-row:3;grid-column:2">D1</span><span class="gd-ml gd-ml-d mono" style="grid-row:3;grid-column:3">D2</span>
          ${cells}
        </div>
        <p class="gd-per mono" data-t="per">${S().per}</p>
      </div>
      <div class="gd-side">
        <p class="gd-count mono"></p>
        <p class="gd-cap" aria-live="off"></p>
        <div class="gd-volts mono" aria-hidden="true"><span><b>V</b> = <span class="gd-volts-v">0.00 V</span></span><span class="gd-volts-track"><i class="gd-volts-bar"></i></span></div>
      </div>
    </div>
    <div class="gd-ctl">
      <button type="button" class="gd-btn gd-play">${ICON_PAUSE}<span class="gd-btn-t">${S().pause}</span></button>
      <button type="button" class="gd-btn gd-step">${ICON_STEP}<span class="gd-btn-t" data-t="one">${S().one}</span></button>
      <span class="gd-keys mono" aria-hidden="true"><span class="gd-keys-click" data-t="click">${S().click}</span>← →</span>
    </div>
    <p class="gd-line demo-extra" data-t="line">${S().line}</p>`;
  el.append(root);
  const anim = root.querySelector<HTMLElement>(".gd-anim")!;
  const svg = anim.querySelector("svg")!;
  const capEl = root.querySelector<HTMLElement>(".gd-cap")!;
  const countEl = root.querySelector<HTMLElement>(".gd-count")!;
  const voltsV = root.querySelector<HTMLElement>(".gd-volts-v")!;
  const voltsBar = root.querySelector<HTMLElement>(".gd-volts-bar")!;
  const cellEls = [...root.querySelectorAll<HTMLButtonElement>(".gd-cell")];
  const playBtn = root.querySelector<HTMLButtonElement>(".gd-play")!;
  const stepBtn = root.querySelector<HTMLButtonElement>(".gd-step")!;
  if (reduced) root.classList.add("is-reduced");

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

  // ------------------------------------------------------------------ state
  /** The scan's cursor: picture number (-1: the finger's first press, before the first picture) and the time in it. */
  let pic = reduced ? 0 : -1;
  let tc = reduced ? 0 : durOf(SEGS_TOUR) - T_MOVE;
  /** The finger's tour (true) or the learner's own presses (false, from the first click on a crossing). */
  let tour = true;
  let playing = !reduced;
  /** A step in progress: the picture and the time in it it plays to. */
  let goal: { pic: number; t: number } | null = null;
  /** Reduced motion, before the first step: nothing powered yet. */
  let idle = reduced;
  /** This picture's readings (volts), index drive * 2 + sense. */
  const picture: (number | null)[] = [null, null, null, null];
  /** The learner's tips: one per pressed crossing, easing in real time (instant with reduced motion). */
  type UTip = { c: number; on: boolean; u: number };
  const userTips: UTip[] = [];
  /** The meter's shown value (eases to its target). */
  let meterV = 0;

  const segs = () => (tour ? SEGS_TOUR : SEGS_USER);
  const segAt = (t: number) => {
    const list = segs();
    for (let j = list.length - 1; j >= 0; j--) if (t >= list[j].t0) return { seg: list[j], j };
    return { seg: list[0], j: 0 };
  };
  /** The step stops in a picture: (just before) the end of each reading (record) and of "done". */
  const stops = () =>
    segs()
      .filter((s) => s.kind === "record" || s.kind === "done")
      .map((s) => s.t0 + s.dur - 0.001);

  // drive / selector targets per segment (-1 = none / open)
  const driveOf = (s: Seg) => (s.kind === "done" || s.kind === "move" || s.kind === "pick" ? -1 : s.k);
  const selOf = (s: Seg) => (s.kind === "done" || s.kind === "move" ? 0.5 : s.i);
  const prevSeg = (j: number) => {
    const list = segs();
    return j > 0 ? list[j - 1] : list[list.length - 1];
  };

  /** The tips of the finger's tour at the cursor: position (world), press, hover (0 = down, 1 = HOVER up), alpha. */
  type Tip = { x: number; y: number; p: number; hv: number; a: number };
  const tourTips = (): Tip[] => {
    const { seg } = segAt(tc);
    const now = tourAt(pic);
    const at = (c: number): Tip => ({ x: XD[c >> 1], y: YS[c & 1], p: 1, hv: 0, a: 1 });
    if (seg.kind !== "move" || !tour) return now.map(at);
    const next = tourAt(pic + 1);
    const u = (tc - seg.t0) / seg.dur;
    const out: Tip[] = [];
    const lift = { p: 1 - smooth(0, 0.14, u), hv: smooth(0.08, 0.3, u) };
    const land = { p: smooth(0.82, 1, u), hv: 1 - smooth(0.64, 0.86, u) };
    const n = Math.max(now.length, next.length);
    for (let j = 0; j < n; j++) {
      const a = now[j];
      const b = next[j];
      if (a !== undefined && b !== undefined) {
        if (a === b) {
          out.push(at(a));
          continue;
        }
        const m = smooth(0.3, 0.66, u);
        const A = at(a);
        const B = at(b);
        const inAir = u < 0.66;
        out.push({ x: lerp(A.x, B.x, m), y: lerp(A.y, B.y, m), p: inAir ? lift.p : land.p, hv: inAir ? lift.hv : land.hv, a: 1 });
      } else if (a !== undefined) {
        // a finger that leaves: lifts, then fades as it rises
        const A = at(a);
        out.push({ ...A, p: lift.p, hv: smooth(0.08, 0.3, u) + 0.6 * smooth(0.3, 0.66, u), a: 1 - smooth(0.3, 0.6, u) });
      } else if (b !== undefined) {
        // a finger that arrives: fades in high over its crossing, then comes down
        const B = at(b);
        out.push({ ...B, p: land.p, hv: u < 0.66 ? 1 + 0.5 * (1 - smooth(0.3, 0.6, u)) : land.hv, a: smooth(0.32, 0.6, u) });
      }
    }
    return out;
  };
  const userTipsNow = (): Tip[] =>
    userTips.map((t) => {
      // u: 0 = high and faded, 0.5 = touching, 1 = pressed hard
      const hv = 1 - smooth(0, 0.5, t.u);
      return { x: XD[t.c >> 1], y: YS[t.c & 1], p: smooth(0.5, 1, t.u), hv: hv * 1.4, a: smooth(0, 0.3, t.u) };
    });
  const tipsNow = () => (tour ? tourTips() : userTipsNow());
  /** Press at each crossing (0..1) from the tips over it. */
  const pressNow = (tips: Tip[]) => {
    const p = [0, 0, 0, 0];
    for (const t of tips)
      for (let c = 0; c < 4; c++) if (Math.abs(t.x - XD[c >> 1]) < 1 && Math.abs(t.y - YS[c & 1]) < 1) p[c] = Math.max(p[c], t.p);
    return p;
  };

  /** Everything the frame shows, from the cursor (and the presses). */
  type Frame = {
    seg: Seg;
    u: number;
    drvOn: number[];
    sel: number;
    k: number;
    i: number;
    closed: boolean;
    tips: Tip[];
    press: number[];
    target: number;
  };
  const frameNow = (): Frame => {
    const { seg, j } = segAt(tc);
    const t = tc - seg.t0;
    const prev = prevSeg(j);
    const e1 = wave(Math.min(1, t / 0.45));
    const dPrev = idle ? -1 : driveOf(prev);
    const dNow = idle ? -1 : driveOf(seg);
    const drvOn = [0, 1].map((kk) => lerp(dPrev === kk ? 1 : 0, dNow === kk ? 1 : 0, e1));
    const sPrev = idle ? 0.5 : selOf(prev);
    const sNow = idle ? 0.5 : selOf(seg);
    const sel = lerp(sPrev, sNow, wave(Math.min(1, t / 0.5)));
    const k = dNow;
    const i = seg.kind === "done" || seg.kind === "move" ? -1 : seg.i;
    const closed = !idle && k >= 0 && i >= 0 && drvOn[k] > 0.995 && Math.abs(sel - i) < 0.005;
    const tips = tipsNow();
    const press = pressNow(tips);
    const target = closed ? vOf(rTaxel(press[k * 2 + i])) : 0;
    return { seg, u: seg.dur ? t / seg.dur : 0, drvOn, sel, k, i, closed, tips, press, target };
  };

  // ------------------------------------------------------------------ the drawing
  type Chain = { g: SVGGElement; glow: SVGPathElement; core: SVGPathElement; nodes: SVGCircleElement[]; grains: SVGCircleElement[]; x: number; flip: number };
  type Pt = [number, number];
  type Cir = {
    drvW: SVGGElement[];
    senW: SVGGElement[];
    rail: SVGGElement;
    out: SVGGElement;
    swBlade: SVGLineElement[];
    swPivot: Pt[];
    swLen: number;
    tags: SVGTextElement[];
    selBlade: SVGLineElement;
    selPivot: Pt;
    selC: Pt[];
    loopIn: SVGPathElement;
    loopOut: SVGPathElement;
    loopGnd: SVGPathElement;
    geo: { xT: number; yRail: number; swTop: Pt[]; dEnd: Pt[]; sEnd: Pt[]; yR0: number; yR1: number; yG: number };
    read: SVGTextElement | null;
    bar: SVGRectElement | null;
    barW: number;
  };
  let A: {
    plan: "mini" | "narrow" | "wide";
    s: number;
    /** The strips' wired and free half-lengths in this plan. */
    ln: number;
    lf: number;
    P: (x: number, y: number, z: number) => Pt;
    dG: SVGGElement[];
    dHalo: SVGPathElement[];
    dDots: SVGPathElement[];
    sG: SVGGElement[];
    sHalo: SVGPathElement[];
    sTop: SVGPathElement[];
    sFront: SVGPathElement[];
    sEnd: SVGPathElement[];
    sDots: SVGPathElement[];
    spotG: SVGGElement[];
    spotFace: SVGPathElement[];
    spotLine: SVGPathElement[];
    chains: Chain[][];
    tips: { g: SVGGElement; body: SVGPathElement; hi: SVGPathElement }[];
    /** The circuit (none in the mini form). */
    cir: Cir | null;
    hits: SVGEllipseElement[];
  } | null = null;
  let builtKey = "";

  /** In a small drawing the two drive lines' wires come close: where a drive line's level ("5 V" / "0 V") would no
   *  longer fit between them, D2's goes right of its wire (D1's stays left of its own); where the chip's job ("drive")
   *  would no longer fit between the two switches, it goes left of D1's switch, inside the chip (which widens for it). */
  const splitOf = (s: number, ln: number, w: Widths) => {
    const gap = (sxOf(XD[1], ln) - sxOf(XD[0], ln)) * s;
    return { tags: gap < w.wLvl + 9, drive: gap < w.wDrive + 24 };
  };
  /** The drive chip's left and right edges at scale s (from the 2 × 2's centre): 14 past the bottom strips' wires, or
   *  wider where its board name ("shift registers", under its rail) or its job, left of D1's switch, needs it. */
  const chipXOf = (s: number, ln: number, w: Widths) => {
    const a = sxOf(XD[0], ln) * s;
    const b = sxOf(XD[1], ln) * s;
    let half = Math.max((b - a) / 2 + 14, w.wSub / 2 + 8);
    if (splitOf(s, ln, w).drive) half = Math.max(half, (b - a) / 2 + 6 + w.wDrive + 6);
    return [(a + b) / 2 - half, (a + b) / 2 + half];
  };
  /** The selector chip's offset right of the top strips' ends at scale s: 10, or more where its names ("pick one",
   *  "multiplexer", left of it) would otherwise reach over D2's front end, the drive chip's corner (level with them in
   *  a small drawing) or D2's level where it went right of its wire. */
  const selDxOf = (s: number, ln: number, w: Widths) => {
    let need = sxOf(XD[1] + HS, ln) * s + 8;
    const ySel = syOf(ln, YS[1], Z_TB + TT / 2) * s + 24;
    const yU = syOf(XD[1] + HS, ln, 0) * s;
    const [top, bot] = [ySel - 6, ySel + 14 + 6];
    if (bot > yU + 26) need = Math.max(need, chipXOf(s, ln, w)[1] + 6);
    if (splitOf(s, ln, w).tags && bot > yU + 17 - 6 && top < yU + 17 + 6) need = Math.max(need, sxOf(XD[1], ln) * s + 5 + w.wLvl + 6);
    return 10 + Math.max(0, need + w.wPick + 15 - (sxOf(ln, YS[1]) * s + 10));
  };
  /** The drawing's extents (px from the 2 × 2's centre) at scale s for a plan, and its labels' widths. */
  type Plan = "mini" | "narrow" | "wide";
  type Widths = { bare: boolean; velo: boolean; wSub: number; wS: number; wVelo: number; w5: number; wPick: number; wBox: number; wR1: number; wGnd: number; wA0: number; wLvl: number; wDrive: number };
  const extentOf = (s: number, plan: Plan, w: Widths) => {
    const { ln, lf } = lensOf(plan);
    const xS2L = sxOf(-lf, YS[1]); // S2's free end (the leftmost strip end)
    const xS1R = sxOf(ln, YS[0]); // S1's wired end (the rightmost)
    const xD1 = sxOf(XD[0], ln);
    const yTop = Math.min(syOf(-lf, YS[0] - HS, Z_TB + TT), syOf(-HV, -HV, Z_V1), syOf(XD[0] - HS, -lf, TB));
    const yD2 = syOf(XD[1] + HS, ln, 0); // the unit's lowest point (D2's front end)
    // the tip over a back crossing, hovering as it travels: its end and a stretch of it in view
    const yTip = syOf(XD[0], YS[0], Z_TB + TT + HOVER + TIP_HD0);
    const lefts = [xS2L * s - (w.bare ? 2 : 6 + w.wS)];
    const rights = [xS1R * s + 4];
    const top = Math.min(yTop * s - 4, yTip * s - 12);
    let bottom = yD2 * s + (plan === "mini" && !w.bare ? 15 : 4);
    if (plan === "mini") {
      if (!w.bare) lefts.push(xD1 * s - 4 - w.wS);
    } else {
      // the drive chip under the bottom strips' front ends (its board name under its rail), its +5 V terminal left of
      // it (label under it: narrow), "Velostat" left of the sheet (wide)
      const cx0 = chipXOf(s, ln, w)[0];
      lefts.push(plan === "wide" || w.velo ? cx0 - 12 - 4 - 6 - w.w5 : cx0 - 18 - Math.max(4, w.w5 / 2 + 1));
      if (plan === "wide" || w.velo) lefts.push(sxOf(-HV, HV) * s - 6 - w.wVelo);
      const yBox = yD2 * s + 26;
      bottom = Math.max(bottom, yBox + CHIP_H + 1);
      // the selector under the top strips' right ends, A0 -> R1 -> GND under it, the meter right of R1
      const dx = selDxOf(s, ln, w);
      const xS1c = xS1R * s + dx;
      const xS2c = sxOf(ln, YS[1]) * s + dx;
      const xm = (xS1c + xS2c) / 2;
      const ySel = syOf(ln, YS[1], Z_TB + TT / 2) * s + 24;
      rights.push(xS1c + 10, xm + 30 + 9.5 + 2 + (plan === "wide" ? 7 + w.wBox : 0));
      lefts.push(xS2c - 9 - 6 - w.wPick, xm - 9 - w.wR1, xm - 11 - w.wGnd, xm - 7 - w.wA0);
      const rLen = plan === "wide" ? 30 : 24;
      bottom = Math.max(bottom, ySel + 34 + 6 + rLen + 7 + 13);
    }
    return { left: Math.min(...lefts), right: Math.max(...rights), top, bottom };
  };

  /** Build the drawing for a width Wr (px shown; and the host's compact / short; a height budget for the drawing in px
   *  shown, or 0). The drawing is laid out W = Wr / k wide (TYPE_K) and shown Wr wide: every length below is in its
   *  own units (labels, chips, offsets), scaled by k on screen. */
  const build = (Wr: number, short: boolean, maxDrawHr: number, sFloor = 0, miniOk = false) => {
    svg.replaceChildren();
    A = null;
    if (Wr < 56) return;
    const mini = Wr < 200;
    // (from the width less the base form's 14 px side padding: is-large's own 16 px would flip the test it came from)
    const large = root.clientWidth - 28 >= 400;
    const k = TYPE_K(Wr);
    const W = Wr / k;
    const maxDrawH = maxDrawHr / k;
    const wLab = (t: string[]) => Math.ceil(textWidth("gd-lab", t, 9.5));
    const w: Widths = {
      // (a phone's narrowest band: the 2 × 2 without its names; the map under it names the lines)
      bare: Wr < 120,
      velo: true,
      wSub: Math.ceil(textWidth("gd-chip-sub", [S().shift], 9.5)),
      wS: Math.ceil(textWidth("gd-lab gd-lab-strong", ["S2", "D2"], 10)),
      wVelo: wLab(["Velostat"]),
      w5: wLab(["+5 V"]),
      wPick: Math.max(Math.ceil(textWidth("gd-chip-t", [S().pick], 9.5)), Math.ceil(textWidth("gd-chip-sub", [S().mux], 9.5))),
      wBox: Math.ceil(textWidth("gd-read", ["V = 4.44 V"], 11.5)) + 14,
      wR1: Math.max(wLab(["10 kΩ"]), Math.ceil(textWidth("gd-lab gd-lab-strong", ["R1"], 10))),
      wGnd: wLab(["GND"]),
      wA0: wLab(["A0"]),
      wLvl: Math.ceil(textWidth("gd-level is-on", ["5 V", "0 V"], 9.5)),
      wDrive: Math.ceil(textWidth("gd-chip-t", [S().drive], 9.5)),
    };
    const sMax = mini ? (short ? 0.5 : 0.8) : short ? 1.05 : 2.15;
    // (tall: the height is no limit, for the scale the width alone allows)
    const fit = (plan: Plan, tall = false, top = sMax) => {
      let s = top;
      for (; s > 0.3; s -= 0.01) {
        const e = extentOf(s, plan, w);
        if (e.right - e.left > W - 6) continue;
        // (the drawing is its extent plus 4 px; under a budget it shrinks, down to the floor)
        if (tall || !maxDrawH || e.bottom - e.top + 5 <= maxDrawH || s <= sFloor) break;
      }
      return { s, plan, ...extentOf(s, plan, w) };
    };
    // the wide plan (the meter's reading box, "+5 V" beside its terminal) where the WIDTH allows it a scale of 1.3 or
    // more; a height budget may then shrink it further
    // (narrow: "Velostat" left of the sheet and "+5 V" left of its terminal too, unless that costs the drawing more
    // than 8 % of its scale)
    let F = mini ? fit("mini") : fit(fit("wide", true).s >= 1.3 ? "wide" : "narrow");
    if (F.plan === "narrow") {
      w.velo = false;
      const bare = fit("narrow");
      w.velo = bare.s <= F.s / 0.92;
      if (!w.velo) F = bare;
      if (fit("narrow", true).s < S_NARROW) F = fit("mini", false, short ? 0.7 : 1);
    }
    // (a tight level's budget that the circuit's labels keep the drawing over: the 2 × 2 alone, as a phone's band)
    if (miniOk && maxDrawH && F.plan !== "mini" && F.bottom - F.top + 5 > maxDrawH) F = fit("mini", false, short ? 0.7 : 1);
    const { s, plan } = F;
    const ux = Math.round(3 - F.left + (W - 6 - (F.right - F.left)) / 2);
    const uy = Math.round(-F.top + 2);
    const H = Math.ceil(uy + F.bottom + 2);
    const P = (x: number, y: number, z: number): Pt => [ux + s * sxOf(x, y), uy + s * syOf(x, y, z)];
    svg.dataset.plan = `${plan} ${s.toFixed(2)} k ${k.toFixed(2)}`;
    svg.setAttribute("viewBox", `0 0 ${f1(W)} ${H}`);
    const Hr = Math.ceil(H * k);
    svg.setAttribute("height", String(Hr));
    anim.style.height = `${Hr}px`;
    // (a line's halo and the current's dots keep to the drawing's scale)
    svg.style.setProperty("--gd-halo-w", f1(Math.max(3, Math.min(6, 3.4 * s))));
    svg.style.setProperty("--gd-dot-w", f1(Math.max(1.8, Math.min(2.4, 1.6 * s))));
    root.classList.toggle("is-mini", mini);
    root.classList.toggle("is-large", large);
    root.classList.toggle("has-box", plan === "wide");

    const defs = svgEl("defs", {}, svg);
    const grad = svgEl("linearGradient", { id: `${uid}-tip`, x1: 0, x2: 1, y1: 0, y2: 0 }, defs);
    svgEl("stop", { offset: 0, class: "gd-tip-s0" }, grad);
    svgEl("stop", { offset: 0.4, class: "gd-tip-s1" }, grad);
    svgEl("stop", { offset: 1, class: "gd-tip-s2" }, grad);
    const fadeG = svgEl("linearGradient", { id: `${uid}-fadeg`, gradientUnits: "userSpaceOnUse", x1: 0, y1: 0, x2: 0, y2: 16 }, defs);
    svgEl("stop", { offset: 0, "stop-color": "#fff", "stop-opacity": 0 }, fadeG);
    svgEl("stop", { offset: 1, "stop-color": "#fff", "stop-opacity": 1 }, fadeG);
    const mask = svgEl("mask", { id: `${uid}-fade`, maskUnits: "userSpaceOnUse", x: 0, y: -2, width: W, height: H + 4 }, defs);
    svgEl("rect", { x: 0, y: -2, width: W, height: H + 4, fill: `url(#${uid}-fadeg)` }, mask);

    const { ln, lf } = lensOf(plan);
    const dEnd = XD.map((x) => P(x, ln, TB / 2));
    const sEnd = YS.map((y) => P(ln, y, Z_TB + TT / 2));
    const yUnit = uy + s * syOf(XD[1] + HS, ln, 0);

    // ---- the circuit's wires (under the unit; they leave from the strips' end faces)
    const gW = svgEl("g", { class: "gd-wires" }, svg);
    let cir: Cir | null = null;
    const lab = (x: number, y: number, t: string, anchor: "start" | "middle" | "end", cls = "gd-lab", parent: Element = svg) => {
      const e = svgEl("text", { class: cls, x: f1(x), y: f1(y), "text-anchor": anchor, "dominant-baseline": "central" }, parent);
      e.textContent = t;
      return e;
    };
    if (plan !== "mini") {
      // the drive chip: two switches from a +5 V rail up to the bottom strips' front ends
      // (under the strips' ends: each drive line's name and level, stacked left of its wire, then the chip)
      const yBox = Math.round(yUnit + 26);
      const [x0, x1] = chipXOf(s, ln, w).map((x) => ux + x);
      const split = splitOf(s, ln, w);
      const yUp = yBox + 8;
      const swLen = 14;
      const yLo = yUp + swLen;
      const yRail = yLo + 6;
      // ("+5 V" left of the terminal; a narrow drawing with no room for it there: under it, clear of the chip)
      const side5 = plan === "wide" || w.velo;
      const xT = x0 - (side5 ? 12 : 15);
      // (the chip: its job between the switches, its board name under the rail)
      svgEl("rect", { class: "gd-chip", x: f1(x0), y: yBox, width: f1(x1 - x0), height: CHIP_H, rx: 4 }, gW);
      const drvW = dEnd.map((e) => {
        const g = svgEl("g", { class: "gd-dimmable" }, gW);
        svgEl("path", { class: "gd-wire", d: `M${f1(e[0])} ${f1(e[1])}V${yUp}M${f1(e[0])} ${yLo}V${yRail}` }, g);
        return g;
      });
      const rail = svgEl("g", { class: "gd-dimmable" }, gW);
      svgEl("path", { class: "gd-wire", d: `M${f1(xT)} ${yRail}H${f1(dEnd[1][0])}` }, rail);
      // the selector chip under the top strips' right ends, its output A0 -> R1 -> GND, the meter across R1
      const selDx = selDxOf(s, ln, w);
      const xS = sEnd.map((e) => e[0] + selDx);
      const ySel = Math.round(sEnd[1][1] + 24);
      const xm = (xS[0] + xS[1]) / 2;
      const yPv = ySel + 17;
      const yA = ySel + 34;
      const yR0 = yA + 6;
      const rLen = plan === "wide" ? 30 : 24;
      const yR1 = yR0 + rLen;
      const yG = yR1 + 7;
      const xV = xm + 30;
      const cyV = (yA + yG) / 2;
      const RV = 9.5;
      svgEl("rect", { class: "gd-chip", x: f1(xS[1] - 9), y: ySel - 8, width: f1(xS[0] - xS[1] + 18), height: 33, rx: 4 }, gW);
      const senW = sEnd.map((e, i) => {
        const g = svgEl("g", { class: "gd-dimmable" }, gW);
        svgEl("path", { class: "gd-wire", d: `M${f1(e[0])} ${f1(e[1])}H${f1(xS[i])}V${ySel}` }, g);
        return g;
      });
      const out = svgEl("g", { class: "gd-dimmable" }, gW);
      svgEl("path", { class: "gd-wire", d: `M${f1(xm)} ${yPv}V${yR0}` }, out);
      let zz = `M${f1(xm)} ${yR0}`;
      for (let q = 0; q < 6; q++) zz += `L${f1(xm + (q % 2 ? -4.5 : 4.5))} ${f1(yR0 + ((q + 0.5) * rLen) / 6)}`;
      zz += `L${f1(xm)} ${yR1}V${yG}V${yG + 4}`;
      svgEl("path", { class: "gd-wire", d: zz }, out);
      svgEl("path", { class: "gd-wire gd-gnd", d: `M${f1(xm - 7)} ${yG + 4}H${f1(xm + 7)}M${f1(xm - 4.5)} ${yG + 7}H${f1(xm + 4.5)}M${f1(xm - 2)} ${yG + 10}H${f1(xm + 2)}` }, out);
      svgEl("path", { class: "gd-wire", d: `M${f1(xm)} ${yA}H${f1(xV)}V${f1(cyV - RV)}M${f1(xV)} ${f1(cyV + RV)}V${yG}H${f1(xm)}` }, out);
      // the live loop's current: pink dots (paths set per reading)
      const gD = svgEl("g", { class: "gd-dots" }, gW);
      const loopIn = svgEl("path", { class: "gd-dot" }, gD);
      const loopOut = svgEl("path", { class: "gd-dot" }, gD);
      const loopGnd = svgEl("path", { class: "gd-dot" }, gD);

      // symbols: switch contacts and blades, the selector, nodes, the +5 V terminal, the meter
      const gS = svgEl("g", { class: "gd-sym" }, svg);
      const swBlade = dEnd.map((e) => {
        svgEl("circle", { class: "gd-contact", cx: f1(e[0]), cy: yUp, r: 1.9 }, gS);
        svgEl("circle", { class: "gd-contact", cx: f1(e[0]), cy: yLo, r: 1.9 }, gS);
        return svgEl("line", { class: "gd-blade", x1: f1(e[0]), y1: yLo }, gS);
      });
      const selC: Pt[] = xS.map((x) => [x, ySel]);
      for (const c of selC) svgEl("circle", { class: "gd-contact", cx: f1(c[0]), cy: c[1], r: 1.9 }, gS);
      svgEl("circle", { class: "gd-contact", cx: f1(xm), cy: yPv, r: 1.9 }, gS);
      const selBlade = svgEl("line", { class: "gd-blade", x1: f1(xm), y1: yPv }, gS);
      svgEl("circle", { class: "gd-node-dot", cx: f1(xm), cy: yA, r: 2.4 }, gS);
      svgEl("circle", { class: "gd-node-dot", cx: f1(xm), cy: yG, r: 2.4 }, gS);
      svgEl("circle", { class: "gd-term", cx: f1(xT), cy: yRail, r: 3 }, gS);
      svgEl("circle", { class: "gd-vm", cx: f1(xV), cy: f1(cyV), r: RV }, gS);
      lab(xV, cyV + 0.5, "V", "middle", "gd-vm-v", gS);
      let read: SVGTextElement | null = null;
      let bar: SVGRectElement | null = null;
      if (plan === "wide") {
        const bx = xV + RV + 7;
        const by = cyV - 13;
        svgEl("rect", { class: "gd-screen", x: f1(bx), y: f1(by), width: w.wBox, height: 19, rx: 4 }, gS);
        read = lab(bx + w.wBox / 2, by + 10, "", "middle", "gd-read", gS);
        svgEl("rect", { class: "gd-track", x: f1(bx + 2), y: f1(by + 23), width: w.wBox - 4, height: 3.5, rx: 1.75 }, gS);
        bar = svgEl("rect", { class: "gd-bar", x: f1(bx + 2), y: f1(by + 23), width: 0, height: 3.5, rx: 1.75 }, gS);
      }
      // labels: the chips (their job, and the board's names for them), +5 V, the levels on the drive lines, A0, R1, GND
      const xMid = (dEnd[0][0] + dEnd[1][0]) / 2;
      if (split.drive) lab(dEnd[0][0] - 6, yBox + 13, S().drive, "end", "gd-chip-t");
      else lab(xMid, yBox + 13, S().drive, "middle", "gd-chip-t");
      lab(xMid, yRail + 10.5, S().shift, "middle", "gd-chip-sub");
      lab(xS[1] - 9 - 6, ySel + 2, S().pick, "end", "gd-chip-t");
      lab(xS[1] - 9 - 6, ySel + 14, S().mux, "end", "gd-chip-sub");
      if (side5) lab(xT - 6, yRail, "+5 V", "end");
      else lab(xT - 3, yRail + 13, "+5 V", "middle");
      const tags = dEnd.map((e, k) => (split.tags && k === 1 ? lab(e[0] + 5, yUnit + 17, "", "start", "gd-level") : lab(e[0] - 5, yUnit + 17, "", "end", "gd-level")));
      lab(xm - 7, yA, "A0", "end");
      lab(xm - 9, (yR0 + yR1) / 2 - 6, "R1", "end", "gd-lab gd-lab-strong");
      lab(xm - 9, (yR0 + yR1) / 2 + 6, "10 kΩ", "end");
      lab(xm - 11, yG + 7, "GND", "end");
      cir = {
        drvW,
        senW,
        rail,
        out,
        swBlade,
        swPivot: dEnd.map((e) => [e[0], yLo] as Pt),
        swLen,
        tags,
        selBlade,
        selPivot: [xm, yPv],
        selC,
        loopIn,
        loopOut,
        loopGnd,
        geo: { xT, yRail, swTop: dEnd.map((e) => [e[0], yUp] as Pt), dEnd, sEnd, yR0, yR1, yG },
        read,
        bar,
        barW: w.wBox - 4,
      };
    }

    // ---- the bottom strips (D1, D2): they lie still; a halo while powered, the current's dots along them
    const gU = svgEl("g", { class: "gd-unit" }, svg);
    const dG: SVGGElement[] = [];
    const dHalo: SVGPathElement[] = [];
    const dDots: SVGPathElement[] = [];
    XD.forEach((x, k) => {
      const g = svgEl("g", { class: "gd-dimmable" }, gU);
      dG.push(g);
      const topPts = [P(x - HS, -lf, TB), P(x + HS, -lf, TB), P(x + HS, ln, TB), P(x - HS, ln, TB)];
      dHalo.push(svgEl("path", { class: "gd-halo", d: pathOf([P(x - HS, -lf, TB), P(x + HS, -lf, TB), P(x + HS, -lf, 0), P(x + HS, ln, 0), P(x - HS, ln, 0), P(x - HS, ln, TB)]) }, g));
      svgEl("path", { class: "gd-g-top", d: pathOf(topPts) }, g);
      svgEl("path", { class: "gd-g-r", d: pathOf([P(x + HS, -lf, 0), P(x + HS, ln, 0), P(x + HS, ln, TB), P(x + HS, -lf, TB)]) }, g);
      svgEl("path", { class: "gd-g-l", d: pathOf([P(x - HS, ln, 0), P(x + HS, ln, 0), P(x + HS, ln, TB), P(x - HS, ln, TB)]) }, g);
      // the sheet's shadow on it (light from straight above)
      svgEl("path", { class: "gd-shade", d: pathOf([P(x - HS, -HV, TB), P(x + HS, -HV, TB), P(x + HS, HV, TB), P(x - HS, HV, TB)]) }, g);
      dDots.push(svgEl("path", { class: "gd-dot gd-dot-on-strip" }, g));
      if (plan !== "mini") svgEl("circle", { class: "gd-joint", cx: f1(dEnd[k][0]), cy: f1(dEnd[k][1]), r: 2.2 }, g);
    });

    // ---- the Velostat sheet as tinted glass: its far sides (seen through its top) and their lower edges, the four
    // touch spots inside it (front faces; back row first), then its near faces (top lightest) and its own edges
    const gF = svgEl("g", { class: "gd-film" }, gU);
    svgEl("path", { class: "gd-gh-far", d: pathOf([P(-HV, -HV, Z_V0), P(-HV, HV, Z_V0), P(-HV, HV, Z_V1), P(-HV, -HV, Z_V1)]) }, gF);
    svgEl("path", { class: "gd-gh-far", d: pathOf([P(-HV, -HV, Z_V0), P(HV, -HV, Z_V0), P(HV, -HV, Z_V1), P(-HV, -HV, Z_V1)]) }, gF);
    svgEl("path", { class: "gd-gh-far-edge", d: pathOf([P(-HV, HV, Z_V0), P(-HV, -HV, Z_V0), P(HV, -HV, Z_V0)], false) + pathOf([P(-HV, -HV, Z_V0), P(-HV, -HV, Z_V1)], false) }, gF);
    const spotG: SVGGElement[] = [];
    const spotFace: SVGPathElement[] = [];
    const spotLine: SVGPathElement[] = [];
    const chains: Chain[][] = [];
    const rs = f1(Math.max(0.8, 1.1 * Math.min(1.2, s)));
    // (crossing c = drive * 2 + sense; drawn back row (S1) first)
    for (const c of [0, 2, 1, 3]) {
      const g = svgEl("g", { class: "gd-spot gd-dimmable" }, gF);
      spotG[c] = g;
      spotFace[c] = svgEl("path", { class: "gd-spot-face" }, g);
      const gp = svgEl("g", { class: "gd-paths" }, g);
      chains[c] = PATH_X.map((x, q) => {
        const gq = svgEl("g", {}, gp);
        return {
          g: gq,
          grains: PATH_V.map(() => svgEl("circle", { class: "gd-grain", r: rs }, gq)),
          glow: svgEl("path", { class: "gd-path-glow" }, gq),
          core: svgEl("path", { class: "gd-path" }, gq),
          nodes: PATH_V.map(() => svgEl("circle", { class: "gd-node", r: rs }, gq)),
          x,
          flip: q % 2 ? -1 : 1,
        };
      });
      spotLine[c] = svgEl("path", { class: "gd-spot-line" }, g);
    }
    const ghT = [P(-HV, -HV, Z_V1), P(HV, -HV, Z_V1), P(HV, HV, Z_V1), P(-HV, HV, Z_V1)];
    svgEl("path", { class: "gd-gh-top", d: pathOf(ghT) }, gF);
    svgEl("path", { class: "gd-gh-l", d: pathOf([P(-HV, HV, Z_V0), P(HV, HV, Z_V0), P(HV, HV, Z_V1), P(-HV, HV, Z_V1)]) }, gF);
    svgEl("path", { class: "gd-gh-r", d: pathOf([P(HV, -HV, Z_V0), P(HV, HV, Z_V0), P(HV, HV, Z_V1), P(HV, -HV, Z_V1)]) }, gF);
    // a few faint carbon grains, kept off the touch spots' lines of sight
    const gGr = svgEl("g", { class: "gd-gh-grains" }, gF);
    const rand = rng(4127);
    const nearLine = (v: number) => YS.some((y) => Math.abs(v - y) < HS + 6) ;
    for (let n = 0, q = 0; n < 22 && q < 600; q++) {
      const x = -HV + 4 + rand() * (2 * HV - 8);
      const y = -HV + 4 + rand() * (2 * HV - 8);
      if (nearLine(y) || nearLine(y - 14)) continue;
      const [cx, cy] = P(x, y, Z_V1);
      const rx = (0.9 + rand() * 0.5) * Math.max(0.7, Math.min(1.3, s));
      svgEl("ellipse", { cx: f1(cx), cy: f1(cy), rx: f1(rx), ry: f1(rx * 0.58) }, gGr);
      n++;
    }
    for (let n = 0; n < 7; n++) {
      const x = -HV + 4 + rand() * (2 * HV - 8);
      const [cx, cy] = P(x, HV, Z_V0 + (0.2 + rand() * 0.6) * VT);
      svgEl("ellipse", { cx: f1(cx), cy: f1(cy), rx: f1(Math.max(0.7, Math.min(1.3, s))), ry: f1(Math.max(0.7, Math.min(1.3, s))) }, gGr);
    }
    svgEl(
      "path",
      {
        class: "gd-gh-edge",
        d:
          pathOf([...ghT, ghT[0]], false) +
          pathOf([P(-HV, HV, Z_V1), P(-HV, HV, Z_V0), P(HV, HV, Z_V0), P(HV, -HV, Z_V0), P(HV, -HV, Z_V1)], false) +
          pathOf([P(HV, HV, Z_V0), P(HV, HV, Z_V1)], false),
      },
      gF,
    );

    // ---- the top strips (S1 back, then S2 front): bent into a pressed crossing; a halo while picked; the dots
    const sG: SVGGElement[] = [];
    const sHalo: SVGPathElement[] = [];
    const sTop: SVGPathElement[] = [];
    const sFront: SVGPathElement[] = [];
    const sEndF: SVGPathElement[] = [];
    const sDots: SVGPathElement[] = [];
    YS.forEach((_, i) => {
      const g = svgEl("g", { class: "gd-dimmable" }, gU);
      sG.push(g);
      sHalo.push(svgEl("path", { class: "gd-halo" }, g));
      sFront.push(svgEl("path", { class: "gd-g-l" }, g));
      sEndF.push(svgEl("path", { class: "gd-g-r" }, g));
      sTop.push(svgEl("path", { class: "gd-g-top" }, g));
      sDots.push(svgEl("path", { class: "gd-dot gd-dot-on-strip" }, g));
      if (plan !== "mini") svgEl("circle", { class: "gd-joint", cx: f1(sEnd[i][0]), cy: f1(sEnd[i][1]), r: 2.2 }, g);
    });

    // ---- the press tips (rubber, from the top, faded in): a pool of four
    const gT = svgEl("g", { class: "gd-tips", mask: `url(#${uid}-fade)` }, svg);
    const tips = [0, 1, 2, 3].map(() => {
      const g = svgEl("g", { class: "gd-tip" }, gT);
      return { g, body: svgEl("path", { class: "gd-tip-body", fill: `url(#${uid}-tip)` }, g), hi: svgEl("path", { class: "gd-tip-hi" }, g) };
    });

    // ---- the strips' names (and the film's, where it has room)
    if (!w.bare) YS.forEach((y, i) => {
      const [x0, y0] = P(-lf, y, Z_TB + TT / 2);
      lab(x0 - 6, y0, NAME_S[i], "end", "gd-lab gd-lab-strong gd-name-s");
    });
    if (!w.bare) XD.forEach((x, k) => {
      if (plan === "mini") {
        const [x0, y0] = P(x, ln, 0);
        lab(x0, y0 + 9, NAME_D[k], "middle", "gd-lab gd-lab-strong gd-name-d");
      } else {
        const [x0] = dEnd[k];
        lab(x0 - 5, yUnit + 6, NAME_D[k], "end", "gd-lab gd-lab-strong gd-name-d");
      }
    });
    if (plan === "wide" || (plan === "narrow" && w.velo)) {
      const [vx, vy] = P(-HV, HV, Z_V0 + VT / 2);
      lab(vx - 6, vy, "Velostat", "end");
    }

    // ---- the crossings' hit areas: click / tap presses or releases one
    const hits = [0, 1, 2, 3].map((c) => {
      const [cx, cy] = P(XD[c >> 1], YS[c & 1], Z_V1);
      const e = svgEl("ellipse", { class: "gd-hit", cx: f1(cx), cy: f1(cy), rx: f1(Math.max(12, 20 * s)), ry: f1(Math.max(10, 14 * s)) }, svg);
      e.addEventListener("click", () => toggle(c));
      e.addEventListener("pointerenter", () => spotG[c].classList.add("is-hover"));
      e.addEventListener("pointerleave", () => spotG[c].classList.remove("is-hover"));
      return e;
    });

    A = { plan, s, P, ln, lf, dG, dHalo, dDots, sG, sHalo, sTop, sFront, sEnd: sEndF, sDots, spotG, spotFace, spotLine, chains, tips, cir, hits };
  };

  // ------------------------------------------------------------------ the frame
  let liveKey = "";
  const draw = (fr: Frame) => {
    // the meter, the map, the caption (HTML) first: they exist in every form
    drawText(fr);
    if (!A) return;
    const { P } = A;
    const poses = fr.press.map(crossPose);
    // the top strips' undersides along x, bent into pressed crossings
    const zTb = (i: number, x: number) => {
      let d = 0;
      for (let k = 0; k < 2; k++) d = Math.max(d, dentX(x - XD[k]) * poses[k * 2 + i].drop);
      return Z_TB - d;
    };
    const { ln, lf } = A;
    const xs = range(-lf, ln, 64);
    const active = fr.k >= 0;
    YS.forEach((y, i) => {
      const top = (x: number) => zTb(i, x) + TT;
      const yb = y - HS;
      const yf = y + HS;
      set(A!.sTop[i], "d", pathOf([...xs.map((x) => P(x, yb, top(x))), ...[...xs].reverse().map((x) => P(x, yf, top(x)))]));
      set(A!.sFront[i], "d", pathOf([...xs.map((x) => P(x, yf, top(x))), ...[...xs].reverse().map((x) => P(x, yf, zTb(i, x)))]));
      set(A!.sEnd[i], "d", pathOf([P(ln, yb, zTb(i, ln)), P(ln, yf, zTb(i, ln)), P(ln, yf, top(ln)), P(ln, yb, top(ln))]));
      // (the halo: the strip's outline as seen, top face, its end and its front face)
      set(A!.sHalo[i], "d", pathOf([...xs.map((x) => P(x, yb, top(x))), P(ln, yb, zTb(i, ln)), ...[...xs].reverse().map((x) => P(x, yf, zTb(i, x))), P(-lf, yf, top(-lf))]));
      const live = fr.closed && fr.i === i;
      A!.sHalo[i].style.opacity = live ? "1" : "0";
      // (a sense line dims once the other one is picked; while a drive line powers up, only the other drive line dims)
      A!.sG[i].classList.toggle("is-dim", fr.i >= 0 && fr.i !== i);
      // the current's dots along the picked sense line, from the live crossing to its wired end
      if (live) set(A!.sDots[i], "d", pathOf(range(XD[fr.k], ln - 3, 24).map((x) => P(x, y, top(x))), false));
      A!.sDots[i].style.opacity = live ? "1" : "0";
    });
    XD.forEach((x, k) => {
      A!.dHalo[k].style.opacity = f1(fr.drvOn[k]);
      A!.dG[k].classList.toggle("is-dim", active && fr.k !== k);
      const live = fr.closed && fr.k === k;
      if (live) set(A!.dDots[k], "d", pathOf([P(x, ln - 3, TB), P(x, YS[fr.i], TB)], false));
      A!.dDots[k].style.opacity = live ? "1" : "0";
    });
    // the touch spots: the film between each crossing's strips (front face), squeezed when pressed; conductive paths
    for (let c = 0; c < 4; c++) {
      const k = c >> 1;
      const i = c & 1;
      const xc = XD[k];
      const yF = YS[i] + HS;
      const ps = poses[c];
      const zV1 = (x: number) => ps.zV0 + VT - ps.dent * dentX(x - xc);
      const topXs = range(xc + HS - 0.8, xc - HS + 0.8, 10);
      set(A.spotFace[c], "d", pathOf([P(xc - HS, yF, ps.zV0), P(xc + HS, yF, ps.zV0), ...range(xc + HS, xc - HS, 10).map((x) => P(x, yF, zV1(x)))]));
      set(A.spotLine[c], "d", pathOf([P(xc - HS + 0.8, yF, ps.zV0 + 0.6), P(xc + HS - 0.8, yF, ps.zV0 + 0.6), ...topXs.map((x) => P(x, yF, zV1(x) - 0.6))]));
      const live = fr.closed && fr.k === k && fr.i === i;
      A.spotG[c].classList.toggle("is-live", live);
      // (dimmed while it is off the picked sense line, or off the powered drive line)
      A.spotG[c].classList.toggle("is-dim", (fr.i >= 0 && fr.i !== i) || (active && fr.k !== k));
      const p = fr.press[c];
      const sq = ps.dent / (0.35 * VT);
      A.chains[c].forEach((ch, q) => {
        const on = smooth(PATH_ON[q], PATH_ON[q] + 0.12, p);
        const o = (on * (live ? 1 : 0.42)).toFixed(3);
        ch.glow.style.opacity = live ? o : "0";
        ch.core.style.opacity = o;
        ch.g.style.display = on > 0 ? "" : "none";
        if (on <= 0) return;
        const pts: Pt[] = [P(xc + ch.x, yF, zV1(xc + ch.x))];
        PATH_V.forEach((vv, jj) => {
          const x = xc + ch.x + PATH_JIT[jj] * ch.flip * (1 - 0.35 * sq);
          pts.push(P(x, yF, ps.zV0 + 0.12 + vv * (zV1(x) - ps.zV0 - 0.24)));
        });
        pts.push(P(xc + ch.x, yF, ps.zV0));
        const d = pathOf(pts, false);
        set(ch.glow, "d", d);
        set(ch.core, "d", d);
        ch.nodes.forEach((nd, jj) => {
          for (const e of [nd, ch.grains[jj]]) {
            set(e, "cx", f1(pts[jj + 1][0]));
            set(e, "cy", f1(pts[jj + 1][1]));
          }
          nd.style.opacity = o;
        });
      });
    }
    // the tips: back to front
    const tips = [...fr.tips].sort((a, b) => a.y - b.y || b.x - a.x);
    A.tips.forEach((t, n) => {
      const tp = tips[n];
      if (!tp || tp.a <= 0.01) {
        t.g.style.display = "none";
        return;
      }
      t.g.style.display = "";
      t.g.style.opacity = f1(tp.a);
      // the strip top under the tip (over a crossing: bent; between: the rest height)
      const i = Math.abs(tp.y - YS[0]) < Math.abs(tp.y - YS[1]) ? 0 : 1;
      const onStrip = Math.abs(tp.y - YS[i]) < HS;
      const zTop = onStrip ? zTb(i, tp.x) + TT : Z_V1;
      const lift = TIP_LIFT * (1 - smooth(0, 0.08, tp.p)) + HOVER * tp.hv;
      const hd = TIP_HD0 - (TIP_HD0 - TIP_HD1) * smooth(0.08, 1, tp.p);
      const apex = zTop + lift;
      const [tx, ya] = P(tp.x, tp.y, apex);
      const yb = P(tp.x, tp.y, apex + hd)[1];
      const rx = TIP_R * A!.s;
      const ry = Math.max(rx * SE, ya - yb);
      set(t.body, "d", `M${f1(tx - rx)} -2V${f1(yb)}A${f1(rx)} ${f1(ry)} 0 0 0 ${f1(tx + rx)} ${f1(yb)}V-2Z`);
      set(t.hi, "d", `M${f1(tx - rx * 0.5)} -2V${f1(yb + ry * 0.35)}`);
    });
    // the circuit: switch blades, the selector's blade, the levels, the live loop and what is off it (dimmed)
    const cir = A.cir;
    if (!cir) return;
    cir.swBlade.forEach((b, k) => {
      const ang = ((1 - fr.drvOn[k]) * 34 * Math.PI) / 180;
      const [px, py] = cir.swPivot[k];
      set(b, "x2", f1(px + cir.swLen * Math.sin(ang)));
      set(b, "y2", f1(py - cir.swLen * Math.cos(ang)));
      cir.drvW[k].classList.toggle("is-dim", active && fr.k !== k);
      cir.drvW[k].classList.toggle("is-live", fr.closed && fr.k === k);
      const on = fr.drvOn[k] > 0.5;
      const tag = on ? "5 V" : "0 V";
      if (cir.tags[k].textContent !== tag) cir.tags[k].textContent = tag;
      cir.tags[k].classList.toggle("is-on", on);
    });
    const [pvx, pvy] = cir.selPivot;
    const a1 = Math.atan2(cir.selC[0][1] - pvy, cir.selC[0][0] - pvx);
    const a2 = Math.atan2(cir.selC[1][1] - pvy, cir.selC[1][0] - pvx);
    const ang = lerp(a1, a2, fr.sel);
    const full = Math.hypot(cir.selC[0][0] - pvx, cir.selC[0][1] - pvy);
    const len = full * (0.8 + 0.2 * Math.max(0, 1 - 6 * Math.min(Math.abs(fr.sel), Math.abs(1 - fr.sel))));
    set(cir.selBlade, "x2", f1(pvx + len * Math.cos(ang)));
    set(cir.selBlade, "y2", f1(pvy + len * Math.sin(ang)));
    cir.senW.forEach((g, i) => {
      g.classList.toggle("is-dim", fr.i >= 0 && fr.i !== i);
      g.classList.toggle("is-live", fr.closed && fr.i === i);
    });
    cir.rail.classList.toggle("is-live", fr.closed);
    cir.out.classList.toggle("is-live", fr.closed);
    cir.out.classList.toggle("is-dim", active && !fr.closed);
    const key = fr.closed ? `${fr.k}${fr.i}` : "";
    if (key !== liveKey) {
      liveKey = key;
      const g = cir.geo;
      if (fr.closed) {
        const [dx, dy] = g.dEnd[fr.k];
        const [sx, sy] = g.sEnd[fr.i];
        const [cx] = cir.selC[fr.i];
        set(cir.loopIn, "d", `M${f1(g.xT)} ${g.yRail}H${f1(dx)}V${f1(dy)}`);
        set(cir.loopOut, "d", `M${f1(sx)} ${f1(sy)}H${f1(cx)}V${f1(cir.selC[fr.i][1])}L${f1(pvx)} ${f1(pvy)}V${g.yR0}`);
        set(cir.loopGnd, "d", `M${f1(pvx)} ${g.yR1}V${g.yG + 4}`);
      }
      for (const p of [cir.loopIn, cir.loopOut, cir.loopGnd]) p.style.opacity = fr.closed ? "1" : "0";
    }
    if (cir.read) {
      const t = `V = ${fmtV(meterV)}`;
      if (cir.read.textContent !== t) cir.read.textContent = t;
      set(cir.bar!, "width", f1(Math.max(1.5, (cir.barW * meterV) / VCC)));
    }
  };

  // ------------------------------------------------------------------ the HTML: meter row, map, count, caption
  let lastCap = "";
  let lastCells = "";
  const drawText = (fr: Frame) => {
    const vTxt = fmtV(meterV);
    if (voltsV.textContent !== vTxt) voltsV.textContent = vTxt;
    voltsBar.style.width = `${((100 * meterV) / VCC).toFixed(1)}%`;
    // the map: recorded cells in viridis, the cell being read outlined, pressed crossings ringed
    const cur = fr.k >= 0 && fr.i >= 0 ? fr.k * 2 + fr.i : -1;
    const ck = picture.map((v, c) => `${v === null ? "-" : v.toFixed(2)}${c === cur ? "*" : ""}${fr.press[c] > 0.5 ? "p" : ""}`).join("|");
    if (ck !== lastCells) {
      lastCells = ck;
      cellEls.forEach((b, c) => {
        const v = picture[c];
        b.classList.toggle("is-read", v !== null);
        b.classList.toggle("is-cur", c === cur);
        b.classList.toggle("is-pressed", fr.press[c] > 0.5);
        b.style.background = v === null ? "" : viridis(v);
        b.style.color = v === null ? "" : v / VCC > 0.55 ? "#111114" : "#ffffff";
        b.querySelector(".gd-cell-v")!.textContent = v === null ? "" : v.toFixed(2);
        const T = S();
        const on = fr.press[c] > 0.5;
        b.setAttribute(
          "aria-label",
          fill(T.cellAria, { name: cName(c), state: on ? T.pressed : T.notPressed, read: v === null ? "" : fill(T.cellRead, { v: fmtV(v), level: T[levelOf(v)] }), act: on ? T.release : T.press }),
        );
        b.setAttribute("aria-pressed", fr.press[c] > 0.5 ? "true" : "false");
      });
    }
    const { count, cap } = captionOf(fr);
    if (cap !== lastCap) {
      lastCap = cap;
      capEl.innerHTML = cap;
      countEl.textContent = count;
    }
  };

  const short = () => root.classList.contains("is-mini");
  const b = (t: string) => `<b>${t}</b>`;
  const captionOf = (fr: Frame): { count: string; cap: string } => {
    const sh = short();
    const seg = fr.seg;
    const T = S();
    if (idle) {
      const now = pressedList(fr).map(cName);
      return {
        count: T.ready,
        cap: sh ? fill(T.idleShort, { list: now.join(", ") || T.none }) : fill(T.idle, { list: now.map(b).join(T.and) || T.nothing }),
      };
    }
    if (seg.kind === "move") {
      const next = tour ? tourAt(pic + 1) : [];
      const names = next.map(cName);
      const two = names.length > 1;
      return {
        count: T.next,
        cap: sh
          ? fill(two ? T.moveShort2 : T.moveShort, { list: names.join(", ") })
          : pic < 0
            ? fill(T.moveFirst, { list: names.map(b).join(T.and) })
            : two
              ? fill(T.moveTwo, { list: names.map(b).join(T.and) })
              : fill(T.move, { name: b(names[0] ?? "") }),
      };
    }
    if (seg.kind === "done") {
      const bright = picture.filter((v) => v !== null && v >= 2.5).length;
      const words = ["", "", T.n2, T.n3, T.n4];
      const where = bright === 0 ? T.where0 : bright === 1 ? T.where1 : fill(T.whereN, { n: words[bright] });
      return { count: T.done, cap: sh ? fill(T.doneShort, { n: bright }) : fill(T.doneCap, { where }) };
    }
    const sName = NAME_S[seg.i];
    // (readings in the firmware's order: S1·D1, S1·D2, S2·D1, S2·D2)
    const nth = seg.kind === "pick" ? seg.i * 2 + 1 : seg.i * 2 + seg.k + 1;
    const count = fill(T.count, { n: nth });
    if (seg.kind === "pick") return { count, cap: sh ? fill(T.pickShort, { s: sName }) : fill(T.pickCap, { s: sName }) };
    const kName = NAME_D[seg.k];
    if (seg.kind === "power") return { count, cap: sh ? fill(T.powerShort, { s: sName, d: kName }) : fill(T.powerCap, { s: sName, d: kName }) };
    const v = fr.closed ? vOf(rTaxel(fr.press[seg.k * 2 + seg.i])) : null;
    let tail = "";
    if (seg.kind === "read" && v !== null) tail = ` ${arrowS} ${b(fmtV(v))}`;
    if (seg.kind === "record") {
      const rv = picture[seg.k * 2 + seg.i] ?? v ?? 0;
      tail = ` ${arrowS} ${b(fmtV(rv))} ${arrowS} <span class="gd-lvl gd-lvl-${levelOf(rv)}">${T[levelOf(rv)]}</span>`;
    }
    if (sh) return { count, cap: `${sName}·${kName}${tail.replace(/<\/?b>/g, "")}` };
    return { count, cap: fill(T.readCap, { s: sName, d: kName, tail }) };
  };
  const arrowS = `<span class="gd-arrow" aria-hidden="true">→</span>`;
  const pressedList = (fr: Frame) => [0, 1, 2, 3].filter((c) => fr.press[c] > 0.5);

  // ------------------------------------------------------------------ the sync: subscribe / "gd:reading"
  const subs = new Set<(r: GridReading) => void>();
  let lastEmit = "";
  let lastReading: GridReading | null = null;
  const readingOf = (fr: Frame): GridReading => {
    const phase: GridPhase = idle ? "idle" : fr.seg.kind;
    return {
      phase,
      sense: fr.i >= 0 ? (fr.i as 0 | 1) : null,
      drive: fr.k >= 0 ? (fr.k as 0 | 1) : null,
      volts: fr.closed ? Math.round(vOf(rTaxel(fr.press[fr.k * 2 + fr.i])) * 1000) / 1000 : null,
      // (in reading order, sense major; the card keeps its own cells drive major, c = drive * 2 + sense)
      pressed: [0, 2, 1, 3].filter((c) => fr.press[c] > 0.001).map((c) => ({ sense: (c & 1) as 0 | 1, drive: (c >> 1) as 0 | 1, amount: Math.round(fr.press[c] * 1000) / 1000 })),
      picture: [picture[0], picture[2], picture[1], picture[3]],
      playing,
    };
  };
  const emit = (fr: Frame) => {
    const r = readingOf(fr);
    const key = JSON.stringify([r.phase, r.drive, r.sense, r.volts === null ? null : r.volts.toFixed(2), r.pressed.map((p) => `${p.drive}${p.sense}${p.amount.toFixed(2)}`), r.picture, r.playing]);
    lastReading = r;
    if (key === lastEmit) return;
    lastEmit = key;
    for (const fn of subs) fn(r);
    root.dispatchEvent(new CustomEvent<GridReading>("gd:reading", { detail: r, bubbles: true }));
  };

  // ------------------------------------------------------------------ the cursor
  /** Records the reading of a "record" segment the cursor is in (once per picture). */
  const recordNow = () => {
    if (idle) return;
    const { seg } = segAt(tc);
    if (seg.kind !== "record") return;
    const c = seg.k * 2 + seg.i;
    if (picture[c] !== null) return;
    const fr = frameNow();
    picture[c] = vOf(rTaxel(fr.press[c]));
  };
  /** The cursor on by dt seconds (into the next picture past the end). */
  const advance = (dt: number) => {
    let left = dt;
    while (left > 0) {
      const d = durOf(segs());
      // stop at each segment's start, so a record is never skipped
      const { seg } = segAt(tc);
      const end = Math.min(d, seg.t0 + seg.dur);
      const stepT = Math.min(left, end - tc);
      tc += stepT;
      left -= stepT;
      if (tc >= d - 1e-9) {
        pic++;
        tc = 0;
        picture.fill(null);
      }
      recordNow();
      if (stepT <= 0 && left > 0) tc += 1e-6;
    }
  };

  const paintPlay = () => {
    playBtn.innerHTML = `${playing ? ICON_PAUSE : ICON_PLAY}<span class="gd-btn-t">${playing ? S().pause : S().play}</span>`;
    playBtn.setAttribute("aria-label", playing ? S().pauseAria : S().playAria);
  };
  const setPlaying = (on: boolean) => {
    if (reduced) on = false;
    playing = on;
    if (on) goal = null;
    paintPlay();
    // a screen reader hears each reading only while the learner steps through them
    capEl.setAttribute("aria-live", on ? "off" : "polite");
    run();
    paint();
  };

  /** Cursor time from here to (pic g, time t), across pictures. */
  const ahead = (g: { pic: number; t: number }) => (g.pic - pic) * durOf(segs()) + g.t - tc;
  /** Jump the cursor to a goal, recording the readings on the way. */
  const jumpTo = (g: { pic: number; t: number }) => {
    const d = ahead(g);
    if (d > 0) advance(d);
    if (pic === g.pic) tc = g.t;
    recordNow();
    meterV = frameNow().target;
  };
  /** One reading on (played, or a jump with reduced motion) or back (a jump). */
  const step = (dir: 1 | -1 = 1) => {
    if (playing) setPlaying(false);
    if (dir === 1) {
      if (idle) {
        idle = false;
        tc = 0;
        picture.fill(null);
      }
      // finish a step in progress at once, then play to the next stop
      if (goal) jumpTo(goal);
      const st = stops();
      const nxt = st.find((t) => t > tc + 1e-6);
      // (past "done", while the finger moves: the next picture's first reading)
      goal = nxt === undefined ? { pic: pic + 1, t: st[0] } : { pic, t: nxt };
      if (reduced) {
        jumpTo(goal);
        goal = null;
      }
    } else {
      goal = null;
      const prv = [...stops()].reverse().find((t) => t < tc - 1e-6);
      if (prv === undefined) {
        tc = 0;
        picture.fill(null);
      } else {
        tc = prv;
        // forget the readings after it
        for (const sg of segs()) if (sg.kind === "record" && sg.t0 >= prv) picture[sg.k * 2 + sg.i] = null;
        recordNow();
      }
      meterV = frameNow().target;
    }
    run();
    paint();
  };

  /** Press / release a crossing: the learner's presses from now on (the finger's tour stops). */
  const toggle = (c: number, on?: boolean) => {
    if (tour) {
      // keep the tour's fingers where they are (or where they were going)
      const { seg } = segAt(tc);
      const keep = seg.kind === "move" ? tourAt(pic + 1) : tourAt(pic);
      if (seg.kind === "move") {
        // the move is skipped: on to the next picture
        pic++;
        tc = 0;
        picture.fill(null);
      }
      tour = false;
      userTips.length = 0;
      for (const kc of keep) userTips.push({ c: kc, on: true, u: 1 });
      if (tc > durOf(SEGS_USER)) tc = 0;
    }
    const t = userTips.find((x) => x.c === c);
    const want = on ?? !(t && t.on);
    if (t) t.on = want;
    else if (want) userTips.push({ c, on: true, u: 0 });
    if (reduced) for (const x of userTips) x.u = x.on ? 1 : 0;
    run();
    paint();
  };

  // ------------------------------------------------------------------ the loop
  let dotOff = 0;
  const moveDots = (dt: number, fr: Frame) => {
    if (!A) return;
    const amps = fr.closed ? ampsOf(rTaxel(fr.press[fr.k * 2 + fr.i])) : 0;
    dotOff -= ((DOT_MAX * amps) / I_HARD) * dt;
    if (dotOff < -1e4) dotOff += 1e4;
    const o = f1(dotOff);
    const all = [...A.dDots, ...A.sDots, ...(A.cir ? [A.cir.loopIn, A.cir.loopOut, A.cir.loopGnd] : [])];
    for (const p of all) p.style.strokeDashoffset = o;
  };
  const paint = (dt = 0) => {
    const fr = frameNow();
    if (reduced || dt === 0) meterV = fr.target;
    else meterV += (fr.target - meterV) * (1 - Math.exp(-dt / 0.14));
    if (!reduced) moveDots(dt, fr);
    draw(fr);
    emit(fr);
  };

  let visible = !document.hidden;
  let onscreen = true;
  let raf = 0;
  let last = 0;
  const tick = (now: number) => {
    raf = 0;
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (playing) advance(dt);
    else if (goal) {
      if (ahead(goal) <= dt * STEP_RATE) {
        // (land exactly on the stop)
        jumpTo(goal);
        goal = null;
      } else advance(dt * STEP_RATE);
    }
    // the learner's tips ease down / up (0.6 s), and fade out once up
    for (const t of userTips) t.u = clamp01(t.u + (t.on ? 1 : -1) * dt / 0.6);
    for (let n = userTips.length - 1; n >= 0; n--) if (!userTips[n].on && userTips[n].u <= 0) userTips.splice(n, 1);
    paint(dt);
    run();
  };
  // the frame loop runs while the card is seen and something moves (the scan, a step, a tip; the current's dots)
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

  playBtn.addEventListener("click", () => setPlaying(!playing));
  stepBtn.addEventListener("click", () => step(1));
  cellEls.forEach((btn, c) => btn.addEventListener("click", () => toggle(c)));
  root.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    if ((e.target as HTMLElement).closest("input, textarea, select")) return;
    e.preventDefault();
    step(e.key === "ArrowRight" ? 1 : -1);
  });

  // sizes come from the card's width (and the host's compact / short, and a data-max-h on the card or an ancestor)
  const relayout = (W: number) => {
    W = Math.round(W);
    const card = root.closest<HTMLElement>(".demo-card");
    const compact = Boolean(root.closest("[data-compact]"));
    const shortF = Boolean(root.closest("[data-short]"));
    const maxH = Number(root.closest<HTMLElement>("[data-max-h]")?.dataset.maxH) || 0;
    const key = `${W}${compact ? " c" : ""}${shortF ? " s" : ""} ${maxH}`;
    if (key === builtKey) return;
    builtKey = key;
    delete root.dataset.tight;
    const rebuild = (short: boolean, maxDrawHr: number, sFloor = 0, miniOk = false) => {
      build(W, short, maxDrawHr, sFloor, miniOk);
      lastCap = lastCells = "";
      liveKey = "-";
      paint();
    };
    rebuild(shortF && !maxH, 0);
    const box = card ?? el;
    // (the card's whole height: once the host caps it (max-height, overflow-y auto) its box stops at the cap)
    const boxH = () => box.offsetHeight + Math.max(0, box.scrollHeight - box.clientHeight);
    // (a phone's band, or a card under ~330 px with the 2 × 2 alone (a zoomed page), in the host's last form: first the
    // plain short form, its drawing at the short scale)
    const tightOk = maxH > 0 && shortF && W < TIGHT_W;
    if (tightOk && boxH() > maxH) rebuild(true, 0);
    if (tightOk && boxH() > maxH) {
      // a phone's band, the host's last form, still too tall for the free height beside the pad (the steps bar is
      // right under it): the card gives up, in this order, until it fits: V as its own row (the caption gives the
      // volts; the buttons move beside the map), the reading count (the map shows the picture filling), then the 3D
      // 2 × 2 itself (the figure marks the same scan on its own block); the drawing shrinks to the room left at each
      // level, down to MIN_DRAW px
      for (let lv = 1; lv <= TIGHT_LEVELS; lv++) {
        root.dataset.tight = String(lv);
        rebuild(true, 0);
        const over = boxH() - maxH;
        if (over <= 0) break;
        // (the last level shrinks too, below the floor if it must: the levels above only hide things on a mini card,
        // and a card that came back at full size here hid its map and buttons below its capped height)
        if (anim.offsetHeight - over >= MIN_DRAW || (lv === TIGHT_LEVELS && anim.offsetHeight > 0)) {
          const budget = anim.offsetHeight - over;
          rebuild(true, budget, 0.34);
          if (boxH() <= maxH) break;
          // (the last level that keeps the drawing: one the circuit's labels hold over its budget is the 2 × 2 alone, a
          // px or two under the budget for the rounding)
          if (lv === TIGHT_LEVELS - 1) {
            rebuild(true, budget - 2, 0.34, true);
            if (boxH() <= maxH) break;
          }
        }
      }
      return;
    }
    if (maxH) {
      // the drawing gives up the height the rest of the card needs under the budget; in the full form it gives up
      // at most a fifth of its scale (then the card is too tall, and the host drops the closing line: compact)
      const over = boxH() - maxH;
      if (over > 0) {
        const s0 = A ? A.s : 1;
        build(W, false, Math.max(80, anim.offsetHeight - over), compact ? S_FLOOR : s0 * 0.8);
        lastCap = lastCells = "";
        liveKey = "-";
        paint();
      }
    }
  };
  // (the drawing's width is the card's content width: measured on the card's content, as the tightest phone form hides
  // the drawing)
  const contentW = () => {
    const cs = getComputedStyle(root);
    return root.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  };
  const ro = new ResizeObserver(() => {
    if (root.isConnected && root.clientWidth > 0) relayout(contentW());
  });
  ro.observe(root);

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
  // (the scan, its picture and the pressed spots carry on)
  const offLang = ctx.onLang(() => {
    paintText(root, S());
    paintPlay();
    builtKey = "";
    lastCap = lastCells = "";
    if (root.isConnected) relayout(contentW());
    paint();
  });

  setPlaying(playing);
  paint();

  return {
    layout() {
      if (root.isConnected) relayout(contentW());
    },
    destroy() {
      offLang();
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      subs.clear();
      root.remove();
    },
    subscribe(fn) {
      subs.add(fn);
      if (lastReading) fn(lastReading);
      return () => subs.delete(fn);
    },
    get reading() {
      return lastReading ?? readingOf(frameNow());
    },
    play: () => setPlaying(true),
    pause: () => setPlaying(false),
    step,
    toggle: (drive, sense, on) => toggle(drive * 2 + sense, on),
    seek(t, p) {
      if (playing) setPlaying(false);
      goal = null;
      idle = false;
      if (p !== undefined) pic = p;
      tc = 0;
      picture.fill(null);
      recordNow();
      advance(Math.max(0, Math.min(t, durOf(segs()) - 0.001)));
      meterV = frameNow().target;
      paint();
    },
  };
}
