// The whole pad: the content of Lesson 2 step 4's demo card ("the same rule, 12 × 32 times"), the third card of the
// series one touch spot (unit-demo.ts) -> 2 × 2 -> the whole pad. It mounts like every demo card (src/ui/demo.ts:
// mount(el, ctx), then layout() whenever the host has given it a width) and is registered by adding "pad" to DemoId.
//
// (1) TOP, the main part: a plan schematic of the sensor in Fig 1's plan-view orientation (figures/EMBED.md, the
//     ft:touch orientation table): sense line i = column i, left -> right; drive line j = row j, bottom -> top. The 32
//     drive lines (Bottom FPC) come from 4 shift registers (8 outputs each, stacked on the left: drive 0-7 in the bottom
//     chip); the 12 sense lines (Top FPC) run down into the multiplexer, a switch that picks 1 of 12 and hands it to A0.
//     Right of the pad, the touch map: one square per crossing, level with it, filled reading by reading (viridis,
//     shared/models/viridis.mjs; 0 is a quiet neutral, as in Fig 1's map). A fingertip footprint lies on the pad
//     (dashed again on the map), valued with Fig 1's feel model: value = (p·exp(−d²/2σ²) − 0.2) / 0.8, σ = 2.2 mm on
//     the real 2.0 mm pitch, firm press p = 1: twelve lit spots with the finger between crossings.
//     The scan: the powered drive line glows signal pink (5 V), the picked sense line teal (the line A0 listens to),
//     and a ring sits on their crossing; the reading's colour fills the ring, then its square on the map. ORDER is the
//     firmware's (shared/models/scan.mjs, PyFlexiTac template.ino; lesson 4 teaches it): the outer loop picks a sense
//     line, the inner loop powers the 32 drive lines one at a time; while the next sense line is picked the shift
//     registers reload (no drive line powered for that moment). The same picture comes out in either order.
//     Speeds: slow (10 readings a second, you can follow one line; 0.6 s for each new sense line), fast (160 a second:
//     the picture fills column by column) and real (38,400 a second = 100 pictures: every line glows faintly, too fast
//     to follow, and the map is always the latest whole picture). Counters: sense line i/12, drive line j/32, reading
//     n/384, picture number; in the large form also the voltage at A0 for the last reading (illustrative, the step 1
//     card's divider: V = 5 V × R1 / (R1 + R), R from the taxel curve with the value as the press).
// (2) BOTTOM (about a quarter of the card): a cross-section of the stack, top -> bottom, from stack.json: laminating
//     sheet (thickness not given: hatched, token height), Top FPC 0.2 mm (polyimide, copper DOWN: 12 sense lines, cut
//     across; its film is cut by the slots between them, from the Gerber data), Velostat 0.1 mm, Bottom FPC 0.2 mm
//     (copper UP: one drive line, cut along), laminating sheet; horizontal true scale, thickness drawn ×N (a nice
//     number that fits; the Velostat is visibly half an FPC). Brackets: the 0.5 mm the sources give and "whole pad
//     < 1 mm". The picked sense line's copper glows teal in step with the scan. One line under it: copper faces in.
// (3) Interaction: play / pause, speed (Slow · Fast · Real), and while paused "Next reading"; click, tap or drag on the
//     pad or the map moves the fingertip there (arrow keys on the focused drawing move it one line; Space plays or
//     pauses). Reduced motion: no loop; a static whole picture with "Next reading" and "Next line" to step the scan
//     by hand (no speeds: they would change nothing). The loop stops while the tab is hidden or the card is off screen.
// (4) The plain sentence (.demo-extra: a compact card drops it; the step text says the same).
// (5) Forms, from the card's width and a height budget: large (content >= 470 px wide: counters, controls and the
//     speeds (Slow · Fast · Real) in a column beside the drawing, two label rows, the label column "4 shift registers /
//     → 32 drive lines / Bottom FPC", A0's volts, the full cross-section), medium (190-470 px: a narrow side column with
//     one speed button that cycles, the shift registers' label run up their side, the cross-section as the cut with
//     one line per layer beside it) and mini (a phone's band, under 190 px: no title, the touch map alone, marked with
//     the picked column and the powered row, the counters under it, the cross-section as a thin labelled strip).
//     The height budget is layout(maxH) / fit(maxH) when the host passes one, else a px max-height on the card, else
//     about the card's width × 1.06 + 70 px (at most 700; a mini card: ~2.9 × its width). The drawing's pitch is the
//     largest that fits it; when it would get too small (large < 8 px, else < 5.5 px) the card drops, in this order,
//     the sentence, its title (the step's title says the same), the cross-section's room (to its minimum), the
//     cross-section's note, and then draws the cross-section as the thin strip. The host's compact form drops the sentence and takes 90 % of the default
//     budget; its short form takes the strip at once and 78 %.
// Sync: onScan(fn) (and a bubbling "pad-demo:scan" CustomEvent on the card's content) reports the sense line listened
// to and the drive line powered, exactly as the card shows them (null at real speed, drive null while the registers
// reload, both null on the still picture under reduced motion until the learner steps), the reading, the picture and
// the last whole picture (values[sense * 32 + drive], the layout of Fig 1's ft:touch), at most 30 times a second and on
// every change of line. The card sends nothing to the figure itself: the host mirrors it (src/ui/demo.ts, act scan).
// ILLUSTRATIVE / SIMULATED: the fingertip and its values are the feel model's, the volts the illustrative curve's.
import { fpcBot, fpcTop, stack } from "@shared/data/index.mjs";
import { PITCH } from "@shared/data/constants.mjs";
import { vA0 } from "@shared/models/divider.mjs";
import { rTaxel } from "@shared/models/taxel.mjs";
import { VIRIDIS_RGB } from "@shared/models/viridis.mjs";
import { getFact, num } from "../content/facts";
import { fill, strings } from "../i18n";
import { paintText, setTextBeside } from "../i18n/paint";
import type { WidgetCtx, WidgetInstance } from "../types";
import { h } from "../ui/dom";
import "./pad-demo.css";

// ------------------------------------------------------------------ numbers (shared/data, via the facts)
const SENSE = num("sensor.rows"); // 12 sense lines, Top FPC
const DRIVE = num("sensor.cols"); // 32 drive lines, Bottom FPC
const TAXELS = num("sensor.taxels"); // 384
const HZ = num("system.frameRate"); // 100 pictures a second
const RATE = TAXELS * HZ; // 38,400 readings a second
const CHIP_OUT = 8; // a 74HC595 has 8 outputs
const CHIPS = DRIVE / CHIP_OUT; // 4 shift registers
const MUX_CH = (getFact("sensor.muxChannels").value as number[])[1] + 1; // a 16-channel multiplexer (channels 4-15 used)
const fmtInt = (n: number) => n.toLocaleString("en-US");

/** The scan order. "sense-outer" is the firmware's (shared/models/scan.mjs): pick a sense line, power the drive lines
 *  one at a time, then the next sense line. "drive-outer" (power a drive line, listen to every sense line) would make
 *  the same picture; it is here only so a lesson could show it. */
type Order = "sense-outer" | "drive-outer";
const ORDER: Order = "sense-outer";
const INNER = ORDER === "sense-outer" ? DRIVE : SENSE;
const OUTER = TAXELS / INNER;
const senseAt = (k: number) => (ORDER === "sense-outer" ? Math.floor(k / INNER) : k % INNER);
const driveAt = (k: number) => (ORDER === "sense-outer" ? k % INNER : Math.floor(k / INNER));
const kOf = (s: number, d: number) => (ORDER === "sense-outer" ? s * DRIVE + d : d * SENSE + s);
/** A crossing's place in a picture: values[sense * 32 + drive] (the frame's byte order, and Fig 1's ft:touch). */
const vi = (s: number, d: number) => s * DRIVE + d;

export type Speed = "slow" | "fast" | "real";
/** Readings a second, and the extra time (in readings) to pick the next outer line (slow only: you see it switch). */
const SPEED: Record<Speed, { rate: number; gap: number }> = {
  slow: { rate: 10, gap: 6 },
  fast: { rate: 160, gap: 0 },
  real: { rate: RATE, gap: 0 },
};
// the card's words (docs/i18n.md): painted from S() (numbers from V) and again on a language switch (the drawings'
// labels too: they are built again, measuring them)
const S = strings(
  {
    sentenceSense:
      "Listen to one of the {S} top lines, power the {D} bottom lines one at a time, then move on to the next top line: {T} readings make one picture, {HZ} pictures every second.",
    sentenceDrive:
      "Power one of the {D} bottom lines, listen to each of the {S} top lines in turn, then the next bottom line: {T} readings make one picture, {HZ} pictures every second.",
    name: "The whole pad",
    simTip: "Simulated: the fingertip and its readings come from the same model as Fig 1's touch map (there is no force data); volts are illustrative.",
    sim: "Simulated",
    title: "The same rule, {S} × {D} times",
    planAria:
      "The pad's {S} sense lines and {D} drive lines, and its touch map. Click, tap or drag to move the fingertip; arrow keys move it one line, Space plays or pauses the scan.",
    listening: "listening to",
    senseK: "sense",
    senseLine: "sense line ",
    powered: "powered, 5 V",
    driveK: "drive",
    driveLine: "drive line ",
    reading: "reading",
    picture: "picture ",
    a0Tip: "Illustrative: the step 1 card's divider, V = 5 V × R1 / (R1 + R), for the last reading",
    a0: "A0 reads",
    illBadge: "illustrative",
    next: "Next reading",
    nextLineTip: "Next line: the next {INNER} readings",
    nextLine: "Next line",
    speedAria: "Scan speed",
    slow: "Slow",
    fast: "Fast",
    real: "Real",
    realTip: "Real speed: {RATE} readings a second",
    cycleAria: "Scan speed: {speed}. Change it",
    slowId: "slow",
    fastId: "fast",
    realId: "real",
    r1: "{T} readings",
    r1b: "= 1 picture",
    r2: "{HZ} pictures a second",
    r2s: "{HZ} pictures / s",
    light: "light",
    firm: "firm",
    secAria: "Cross-section of the pad",
    note: "Copper faces in: both copper sides touch the Velostat.",
    pause: "Pause",
    play: "Play",
    pauseAria: "Pause the scan",
    playAria: "Play the scan",
    all: "all",
    nSense: "{S} sense lines",
    senseLines: "sense lines",
    touchMap: "touch map",
    topFpc: "Top FPC",
    squares: "{T} squares",
    chips: "{C} shift registers",
    toDrive: "→ {D} drive lines",
    botFpc: "Bottom FPC",
    rotFull: "{C} shift registers → {D} drive lines",
    muxTitle: "A {M}-channel multiplexer: {S} of its channels carry the {S} sense lines",
    mux1: "multiplexer: picks 1 of {S} → A0",
    mux2: "multiplexer: picks 1 of {S}",
    mux3: "multiplexer: 1 of {S}",
    mux4: "multiplexer",
    lam: "Laminating sheet",
    cuDown: " · copper ↓",
    cuUp: " · copper ↑",
    notGiven: "not given",
    lamNotGiven: "Laminating sheet · not given",
    stripCapN: "mm · whole pad < {TOTAL} mm",
    stripCap: "copper faces in · whole pad < {TOTAL} mm",
    midCap: "layers drawn {E}× thicker · whole pad < {TOTAL} mm",
    subTop: "copper-down · {S} sense lines",
    subBot: "copper-up · {D} drive lines",
    wholePad: "whole pad",
    secCap: "CROSS-SECTION · sliced along one drive line",
    scale: "1 mm across · layers drawn {E}× thicker than real",
  },
  {
    sentenceSense: "听 {S} 条上层线中的一条，把 {D} 条下层线逐条通电，再换下一条上层线：{T} 个读数组成一张图，每秒 {HZ} 张图。",
    sentenceDrive: "给 {D} 条下层线中的一条通电，依次听 {S} 条上层线，再换下一条下层线：{T} 个读数组成一张图，每秒 {HZ} 张图。",
    name: "整个传感垫",
    simTip: "仿真：指尖和它的读数来自与图 1 触觉图相同的模型（没有力的测量数据）；电压是示意值。",
    sim: "仿真",
    title: "同一条规则，重复 {S} × {D} 次",
    planAria: "传感垫的 {S} 条感应线和 {D} 条驱动线，以及它的触觉图。点击、轻点或拖动来移动指尖；方向键一次移动一条线，空格键播放或暂停扫描。",
    listening: "正在听",
    senseK: "感应",
    senseLine: "感应线 ",
    powered: "通电，5 V",
    driveK: "驱动",
    driveLine: "驱动线 ",
    reading: "读数",
    picture: "图 ",
    a0Tip: "示意：用第 1 步卡片里的分压电路 V = 5 V × R1 / (R1 + R) 算出最近一个读数",
    a0: "A0 读到",
    illBadge: "示意",
    next: "下一个读数",
    nextLineTip: "下一条线：接下来的 {INNER} 个读数",
    nextLine: "下一条线",
    speedAria: "扫描速度",
    slow: "慢",
    fast: "快",
    real: "实际",
    realTip: "实际速度：每秒 {RATE} 个读数",
    cycleAria: "扫描速度：{speed}。点击切换",
    slowId: "慢",
    fastId: "快",
    realId: "实际",
    r1: "{T} 个读数",
    r1b: "= 1 张图",
    r2: "每秒 {HZ} 张图",
    r2s: "{HZ} 张图/秒",
    light: "轻",
    firm: "重",
    secAria: "传感垫的剖面",
    note: "铜面朝内：两面的铜都贴着 Velostat。",
    pause: "暂停",
    play: "播放",
    pauseAria: "暂停扫描",
    playAria: "播放扫描",
    all: "全部",
    nSense: "{S} 条感应线",
    senseLines: "感应线",
    touchMap: "触觉图",
    topFpc: "顶层 FPC",
    squares: "{T} 个方格",
    chips: "{C} 个移位寄存器",
    toDrive: "→ {D} 条驱动线",
    botFpc: "底层 FPC",
    rotFull: "{C} 个移位寄存器 → {D} 条驱动线",
    muxTitle: "一个 {M} 通道的多路选择器：其中 {S} 个通道接着 {S} 条感应线",
    mux1: "多路选择器：{S} 条中选 1 条 → A0",
    mux2: "多路选择器：{S} 条中选 1 条",
    mux3: "多路选择器：{S} 选 1",
    mux4: "多路选择器",
    lam: "覆膜",
    cuDown: " · 铜面 ↓",
    cuUp: " · 铜面 ↑",
    notGiven: "未给出",
    lamNotGiven: "覆膜 · 未给出",
    stripCapN: "mm · 整个传感垫 < {TOTAL} mm",
    stripCap: "铜面朝内 · 整个传感垫 < {TOTAL} mm",
    midCap: "各层厚度放大 {E} 倍 · 整个传感垫 < {TOTAL} mm",
    subTop: "铜面朝下 · {S} 条感应线",
    subBot: "铜面朝上 · {D} 条驱动线",
    wholePad: "整个传感垫",
    secCap: "剖面 · 沿一条驱动线切开",
    scale: "横向 1 mm · 各层厚度画成实际的 {E} 倍",
  },
);
/** The numbers the card's words carry. */
const V = { S: SENSE, D: DRIVE, T: TAXELS, HZ, INNER, RATE: fmtInt(RATE), C: CHIPS, M: MUX_CH };
const T = (k: keyof ReturnType<typeof S>, more?: Record<string, string | number>) => fill(S()[k], more ? { ...V, ...more } : V);
const SENTENCE_KEY = ORDER === "sense-outer" ? "sentenceSense" : "sentenceDrive";

// ------------------------------------------------------------------ the fingertip (Fig 1's feel model, pad/live.js)
const SIGMA = 2.2; // mm
const THRESH = 0.2;
const FLOOR = 0.005;
const PRESS = 1; // a firm press
const xOf = (s: number) => (s - (SENSE - 1) / 2) * PITCH; // sense line -> X mm (2i − 11)
const yOf = (d: number) => (d - (DRIVE - 1) / 2) * PITCH; // drive line -> Y mm (2j − 31)
const FINGER0 = { sense: 7.5, drive: 20.5 }; // between four crossings: twelve lit spots
/** The fingertip's contact patch drawn on the pad, in pitches (about 9 × 10 mm). */
const FOOT_RX = 2.2;
const FOOT_RY = 2.6;

function feel(fs: number, fd: number, out: Float32Array) {
  const X = xOf(fs);
  const Y = yOf(fd);
  const k = 1 / (2 * SIGMA * SIGMA);
  for (let s = 0; s < SENSE; s++)
    for (let d = 0; d < DRIVE; d++) {
      const dx = xOf(s) - X;
      const dy = yOf(d) - Y;
      const v = (PRESS * Math.exp(-(dx * dx + dy * dy) * k) - THRESH) / (1 - THRESH);
      out[vi(s, d)] = v < FLOOR ? 0 : Math.round(v * 1000) / 1000;
    }
}
/** The step 1 card's voltage across R1 for a reading (illustrative: the value taken as the press). */
const voltsOf = (v: number) => vA0(rTaxel(v), { rOn: 0 });

// ------------------------------------------------------------------ colours
const VIR = VIRIDIS_RGB as unknown as number[][];
type RGB = [number, number, number];
function parseColor(s: string, fb: RGB): RGB {
  const t = s.trim();
  let m = t.match(/^#([0-9a-f]{6})$/i);
  if (m) return [0, 2, 4].map((i) => parseInt(m![1].slice(i, i + 2), 16)) as RGB;
  m = t.match(/^#([0-9a-f]{3})$/i);
  if (m) return [0, 1, 2].map((i) => parseInt(m![1][i] + m![1][i], 16)) as RGB;
  const r = t.match(/rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)/);
  return r ? [+r[1], +r[2], +r[3]] : fb;
}
/** 256 fills for a value 0..1: viridis, 0 the quiet neutral, and values under 0.1 blending in from it (as Fig 1). */
function lutFor(zero: RGB): string[] {
  return Array.from({ length: 256 }, (_, q) => {
    if (q === 0) return `rgb(${zero.join(",")})`;
    const v = q / 255;
    const c = VIR[q];
    const t = Math.min(1, v / 0.1);
    return `rgb(${c.map((x, i) => Math.round(zero[i] + (x - zero[i]) * t)).join(",")})`;
  });
}
const qOf = (v: number) => Math.max(0, Math.min(255, Math.round(v * 255)));

// ------------------------------------------------------------------ the cross-section (stack.json + the Gerber data)
type StackLayer = { id: string; name: string; thickness: number | null };
type Span = [number, number];
type Rect = { x0: number; y0: number; x1: number; y1: number };
type FpcData = { outline: { pts: number[][] }; slots: { rects: Rect[] }; electrodes: { rects: Rect[] }; assembly: { padFrameTransform: { mirrorX: boolean } } };
const LAYERS = (stack.layers as unknown as StackLayer[]).filter((l) => !l.id.startsWith("pi_")); // the tape is not drawn
const TOTAL = (stack as unknown as { totalThickness: { value: number } }).totalThickness.value; // whole pad < 1 mm
const KNOWN = LAYERS.reduce((s, l) => s + (l.thickness ?? 0), 0); // 0.2 + 0.1 + 0.2 = 0.5 mm
const KIND: Record<string, "lam" | "fpc" | "velo"> = { lam_top: "lam", fpc_top: "fpc", velostat: "velo", fpc_bot: "fpc", lam_bot: "lam" };
const WIN: Span = [-13.5, 13.5]; // mm across the sense lines (the layer inspector's window)
const VELO_SPAN: Span = [-12, 12]; // display only: the Velostat sheet's size is not in the files
const TOKEN_MM = 0.08; // a layer with no thickness in the sources: hatched at this height
const CUT_Y = yOf(16); // sliced along one drive line (y = 1 mm)
const NICE = [2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40, 50];
/** (copied from layer-inspector.ts) x-intervals where a horizontal line at y is inside the polygon. */
function scanPoly(pts: number[][], y: number): Span[] {
  const xs: number[] = [];
  for (let i = 0; i < pts.length; i++) {
    const [ax, ay] = pts[i];
    const [bx, by] = pts[(i + 1) % pts.length];
    if (ay <= y !== by <= y) xs.push(ax + ((y - ay) / (by - ay)) * (bx - ax));
  }
  xs.sort((a, b) => a - b);
  const out: Span[] = [];
  for (let i = 0; i + 1 < xs.length; i += 2) out.push([xs[i], xs[i + 1]]);
  return out;
}
function subtract(spans: Span[], cuts: Span[]): Span[] {
  let out = spans;
  for (const [c0, c1] of cuts) {
    const next: Span[] = [];
    for (const [a, b] of out) {
      if (c1 <= a || c0 >= b) next.push([a, b]);
      else {
        if (c0 > a) next.push([a, c0]);
        if (c1 < b) next.push([c1, b]);
      }
    }
    out = next;
  }
  return out;
}
const clip = (spans: Span[], [w0, w1]: Span = WIN): Span[] => spans.map(([a, b]) => [Math.max(a, w0), Math.min(b, w1)] as Span).filter(([a, b]) => b - a > 1e-6);
function cutFpc(d: FpcData, y: number) {
  const m = d.assembly.padFrameTransform.mirrorX ? -1 : 1;
  const xs = (r: Rect): Span => (m > 0 ? [r.x0, r.x1] : [-r.x1, -r.x0]);
  const inY = (r: Rect) => y >= r.y0 && y <= r.y1;
  const outline = scanPoly(d.outline.pts.map(([x, yy]) => [m * x, yy]), y);
  const slots = d.slots.rects.filter(inY).map(xs);
  return { film: clip(subtract(outline, slots)), copper: clip(d.electrodes.rects.filter(inY).map(xs)).sort((a, b) => a[0] - b[0]) };
}
const CUT_TOP = cutFpc(fpcTop as unknown as FpcData, CUT_Y);
const CUT_BOT = cutFpc(fpcBot as unknown as FpcData, CUT_Y);
/** The Top FPC's copper strip of sense line i in the cut (its centre is nearest X = 2i − 11). */
const senseStrip = (i: number) => {
  let best = -1;
  let dist = Infinity;
  CUT_TOP.copper.forEach(([a, b], k) => {
    const dd = Math.abs((a + b) / 2 - xOf(i));
    if (dd < dist) {
      dist = dd;
      best = k;
    }
  });
  return dist < PITCH / 2 ? best : -1;
};

// ------------------------------------------------------------------ svg helpers
const NS = "http://www.w3.org/2000/svg";
function svgEl<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>, parent: Element): SVGElementTagNameMap[K] {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  parent.append(el);
  return el;
}
const f1 = (n: number) => (Math.round(n * 10) / 10).toString();
const clampN = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
const ease = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

export type Form = "large" | "medium" | "mini";
/** What the card reports (onScan, and the "pad-demo:scan" event's detail). */
export interface PadScanState {
  /** The sense line A0 listens to and the drive line powered (0-based), as the card shows them; null at real speed
   *  (every line, 100 times a second), drive null while the shift registers reload for the next sense line, and both
   *  null on the still picture under reduced motion until the learner steps the scan. */
  sense: number | null;
  drive: number | null;
  /** Readings taken in the picture being made, 0..384, and that picture's number (from 1). */
  reading: number;
  picture: number;
  speed: Speed;
  playing: boolean;
  /** The last whole picture, values 0..1 (simulated), values[sense * 32 + drive], as Fig 1's ft:touch. */
  values: number[];
  /** The fingertip's centre in 0-based line indices (fractional). */
  finger: { sense: number; drive: number };
}
export interface PadDemoInstance extends WidgetInstance {
  /** Lay out for the width the host gave the card, at most `maxH` px tall when given (the card's content height; it
   *  holds for later layouts, as fit(maxH) does). */
  layout(maxH?: number): void;
  /** The height budget for every later layout (null: back to the default), and a layout now. */
  fit(maxH: number | null): void;
  /** Called with the scan's state on every change of line (<= 30 a second) and once at once; returns an unsubscribe. */
  onScan(fn: (s: PadScanState) => void): () => void;
  state(): PadScanState;
}

let seq = 0;

export function mount(el: HTMLElement, ctx: WidgetCtx): PadDemoInstance {
  const reduced = ctx.reducedMotion();
  const uid = `wp${++seq}`;
  const root = h("div", { class: "wp" });
  const ICON_PLAY = `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 3v10l8.5-5z"/></svg>`;
  const ICON_PAUSE = `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 3h3v10H4zM9 3h3v10H9z"/></svg>`;
  const ICON_NEXT = `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 3.5v9l6.5-4.5zM11 3.5h2v9h-2z"/></svg>`;
  const ICON_LINE = `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M1.5 3.5v9l5-4.5zM7 3.5v9l5-4.5zM12.5 3.5h2v9h-2z"/></svg>`;
  root.innerHTML = `
    <p class="wp-kicker mono"><i class="wp-mark" aria-hidden="true"></i><span class="wp-name" data-t="name">${T("name")}</span><span class="wp-sep" aria-hidden="true">·</span><span class="wp-ill" title="${T("simTip")}" data-t-title="simTip" data-t="sim">${T("sim")}</span></p>
    <p class="wp-title" data-t="title">${T("title")}</p>
    <div class="wp-main">
      <div class="wp-plan" tabindex="0" role="group" aria-label="${T("planAria")}" data-t-aria="planAria"><svg class="wp-svg" aria-hidden="true"></svg></div>
      <div class="wp-side">
        <div class="wp-count">
          <p class="wp-c wp-c-s"><i aria-hidden="true"></i><span class="wp-k"><span class="wp-kl" data-t="listening">${T("listening")}</span><span class="wp-ks" data-t="senseK">${T("senseK")}</span></span><span class="wp-v"><span class="wp-long" data-t="senseLine">${T("senseLine")}</span><b class="wp-sv">1</b><span class="wp-of">/${SENSE}</span></span></p>
          <p class="wp-c wp-c-d"><i aria-hidden="true"></i><span class="wp-k"><span class="wp-kl" data-t="powered">${T("powered")}</span><span class="wp-ks" data-t="driveK">${T("driveK")}</span></span><span class="wp-v"><span class="wp-long" data-t="driveLine">${T("driveLine")}</span><b class="wp-dv">1</b><span class="wp-of">/${DRIVE}</span></span></p>
          <p class="wp-c wp-c-n"><span class="wp-k" data-t="reading">${T("reading")}</span><span class="wp-v"><b class="wp-nv">0</b>/${TAXELS}<span class="wp-pic"><span class="wp-dsep"> · </span>${T("picture")}<span class="wp-pv">1</span></span></span></p>
          <p class="wp-c wp-c-a" title="${T("a0Tip")}" data-t-title="a0Tip"><span class="wp-k" data-t="a0">${T("a0")}</span><span class="wp-v"><b class="wp-av">0.24 V</b><span class="badge badge-illustrative" data-t="illBadge">${T("illBadge")}</span></span></p>
        </div>
        <div class="wp-ctl">
          <button type="button" class="wp-btn wp-play" aria-pressed="false"></button>
          <button type="button" class="wp-btn wp-next" hidden title="${T("next")}" aria-label="${T("next")}" data-t-title="next" data-t-aria="next">${ICON_NEXT}<span data-t="next">${T("next")}</span></button>
          <button type="button" class="wp-btn wp-nextline" hidden title="${T("nextLineTip")}" aria-label="${T("nextLineTip")}" data-t-title="nextLineTip" data-t-aria="nextLineTip">${ICON_LINE}<span data-t="nextLine">${T("nextLine")}</span></button>
          <div class="wp-seg" role="group" aria-label="${T("speedAria")}" data-t-aria="speedAria">
            <button type="button" data-speed="slow" aria-pressed="true" data-t="slow">${T("slow")}</button><button type="button" data-speed="fast" aria-pressed="false" data-t="fast">${T("fast")}</button><button type="button" data-speed="real" aria-pressed="false" title="${T("realTip")}" data-t-title="realTip" data-t="real">${T("real")}</button>
          </div>
          <button type="button" class="wp-btn wp-cycle" aria-label="${T("speedAria")}"></button>
        </div>
        <p class="wp-rate mono"><span class="wp-r1"><span data-t="r1">${T("r1")}</span><span class="wp-r-sp"> </span><span data-t="r1b">${T("r1b")}</span></span><span class="wp-r2" data-t="r2">${T("r2")}</span><span class="wp-r2s" data-t="r2s">${T("r2s")}</span></p>
        <p class="wp-legend mono" aria-hidden="true"><span data-t="light">${T("light")}</span><i class="wp-bar"></i><span data-t="firm">${T("firm")}</span></p>
      </div>
    </div>
    <p class="wp-line demo-extra" data-t="${SENTENCE_KEY}">${T(SENTENCE_KEY)}</p>
    <div class="wp-sec"><svg class="wp-sec-svg" role="img" aria-label="${T("secAria")}" data-t-aria="secAria"></svg></div>
    <p class="wp-note" data-t="note">${T("note")}</p>`;
  el.append(root);
  const plan = root.querySelector<HTMLElement>(".wp-plan")!;
  const svg = root.querySelector<SVGSVGElement>(".wp-svg")!;
  const main = root.querySelector<HTMLElement>(".wp-main")!;
  const side = root.querySelector<HTMLElement>(".wp-side")!;
  const secBox = root.querySelector<HTMLElement>(".wp-sec")!;
  const secSvg = root.querySelector<SVGSVGElement>(".wp-sec-svg")!;
  const playBtn = root.querySelector<HTMLButtonElement>(".wp-play")!;
  const nextBtn = root.querySelector<HTMLButtonElement>(".wp-next")!;
  const lineBtn = root.querySelector<HTMLButtonElement>(".wp-nextline")!;
  const cycleBtn = root.querySelector<HTMLButtonElement>(".wp-cycle")!;
  const segBtns = [...root.querySelectorAll<HTMLButtonElement>(".wp-seg button")];
  const out = {
    s: root.querySelector<HTMLElement>(".wp-sv")!,
    d: root.querySelector<HTMLElement>(".wp-dv")!,
    n: root.querySelector<HTMLElement>(".wp-nv")!,
    p: root.querySelector<HTMLElement>(".wp-pv")!,
    a: root.querySelector<HTMLElement>(".wp-av")!,
    cs: root.querySelector<HTMLElement>(".wp-c-s")!,
    cd: root.querySelector<HTMLElement>(".wp-c-d")!,
    sOf: root.querySelector<HTMLElement>(".wp-c-s .wp-of")!,
    dOf: root.querySelector<HTMLElement>(".wp-c-d .wp-of")!,
  };
  root.querySelector<HTMLElement>(".wp-bar")!.style.background = `linear-gradient(90deg, ${[0, 32, 64, 96, 128, 160, 192, 224, 255].map((q) => `rgb(${VIR[q].join(",")})`).join(", ")})`;

  // ------------------------------------------------------------------ state
  const live = new Float32Array(TAXELS); // what the finger presses now
  const cur = new Float32Array(TAXELS); // this picture, as read so far
  const prev = new Float32Array(TAXELS); // the last whole picture
  let hasPrev = false;
  let fs = FINGER0.sense;
  let fd = FINGER0.drive;
  let ts = fs;
  let td = fd;
  feel(fs, fd, live);
  let speed: Speed = "slow";
  let playing = !reduced;
  let tau = 0; // scan time in readings (slots) within the picture, gaps included
  let taken = 0; // readings taken in this picture
  let picture = 1;
  let lastV = 0; // the last reading's value
  if (reduced) {
    // a static whole picture: the scan has just finished one
    cur.set(live);
    prev.set(live);
    hasPrev = true;
    taken = TAXELS;
    tau = perPicture();
  }

  function perPicture(sp: Speed = speed) {
    return OUTER * (INNER + SPEED[sp].gap);
  }
  /** Where the scan is at scan time t: the reading in progress (k), whether it is in the pause before its outer line
   *  (inGap) and how far through that pause or reading it is (f, 0..1). */
  function where(t: number, sp: Speed = speed) {
    const g = SPEED[sp].gap;
    const per = INNER + g;
    if (t >= perPicture(sp)) return { k: TAXELS - 1, inGap: false, f: 1 };
    const line = Math.min(OUTER - 1, Math.floor(t / per));
    const w = t - line * per;
    if (w < g) return { k: line * INNER, inGap: true, f: w / g };
    const kk = Math.min(INNER - 1, Math.floor(w - g));
    return { k: line * INNER + kk, inGap: false, f: Math.min(1, w - g - kk) };
  }
  const takenAt = (t: number) => {
    if (t >= perPicture()) return TAXELS;
    const w = where(t);
    return w.inGap ? w.k : w.f >= 0.5 ? w.k + 1 : w.k;
  };
  /** The scan time of reading k (just taken), for a speed. */
  const tauOf = (k: number, f: number, inGap: boolean, sp: Speed) => {
    const g = SPEED[sp].gap;
    const line = Math.floor(k / INNER);
    return line * (INNER + g) + (inGap ? f * g : g + (k % INNER) + f);
  };
  const takeUpTo = (t: number) => {
    for (; taken < t; taken++) {
      const s = senseAt(taken);
      const d = driveAt(taken);
      cur[vi(s, d)] = live[vi(s, d)];
      lastV = live[vi(s, d)];
    }
  };
  const finishPicture = () => {
    takeUpTo(TAXELS);
    prev.set(cur);
    hasPrev = true;
    picture++;
    taken = 0;
    emit(true);
  };
  /** Move the scan to time t (it may run past one or many pictures). */
  const advanceTo = (t: number) => {
    const P = perPicture();
    if (t >= P) {
      const whole = Math.floor(t / P);
      finishPicture();
      if (whole > 1) {
        // (real speed: several whole pictures in one animation frame, all of the finger as it is now)
        cur.set(live);
        prev.set(live);
        picture += whole - 1;
        lastV = live[vi(senseAt(TAXELS - 1), driveAt(TAXELS - 1))];
      }
      t -= whole * P;
    }
    tau = t;
    takeUpTo(takenAt(tau));
  };

  // ------------------------------------------------------------------ text measures
  /** The widest of these strings in a text style, measured in `host` (the plan's svg, or the cross-section's: their
   *  label styles differ), with a fallback for an unrendered card. */
  const textWidth = (cls: string, words: string[], px: number, host: SVGSVGElement = svg) => {
    const t = svgEl("text", { class: cls, x: 0, y: 0, visibility: "hidden" }, host);
    let w = 0;
    for (const word of words) {
      t.textContent = word;
      w = Math.max(w, t.getComputedTextLength());
    }
    t.remove();
    return Math.ceil(w || Math.max(...words.map((s) => s.length)) * px * 0.62);
  };

  // ------------------------------------------------------------------ the plan drawing
  type P = {
    form: Form;
    c: number;
    gx: number;
    gy: number;
    mx: number;
    chipX: number;
    chipW: number;
    muxX0: number;
    muxX1: number;
    muxY0: number;
    muxY1: number;
    px: number;
    py: number;
    ax: number;
    W: number;
    H: number;
    fs: number; // label font size
  };
  /** The plan's geometry at pitch c for a form (mini: the map alone). `lw` = the room left of the shift registers for
   *  their label (large: a column; medium: the label run up their side). */
  const geo = (form: Form, c: number, lw: number): P => {
    // (label sizes as pad-demo.css: at least 11 px outside the phone's mini form)
    const fsz = form === "mini" ? 9 : 11;
    const lh = fsz + 3.5;
    if (form === "mini") {
      const gy = Math.ceil(lh + 3);
      const gx = 3;
      return { form, c, gx, gy, mx: gx, chipX: 0, chipW: 0, muxX0: 0, muxX1: 0, muxY0: 0, muxY1: 0, px: 0, py: 0, ax: 0, W: Math.ceil(gx + SENSE * c + 3), H: Math.ceil(gy + DRIVE * c + 3), fs: fsz };
    }
    const chipW = clampN(2.2 * c, 12, 24);
    const stub = clampN(1.5 * c, 6, 14);
    const chipX = lw;
    const gx = chipX + chipW + stub;
    const gap = clampN(3.2 * c, 22, 40);
    const mx = gx + SENSE * c + gap;
    const gy = Math.ceil(form === "large" ? 2 * lh + 4 : lh + 4);
    const gb = gy + DRIVE * c;
    const muxY0 = gb + clampN(1.4 * c, 7, 14);
    const hm = clampN(2.6 * c, 18, 28);
    const muxY1 = muxY0 + hm;
    const muxX0 = gx - 3;
    const muxX1 = gx + SENSE * c + clampN(1.6 * c, 10, 16);
    const rows = 1;
    return {
      form,
      c,
      gx,
      gy,
      mx,
      chipX,
      chipW,
      muxX0,
      muxX1,
      muxY0,
      muxY1,
      px: muxX1 - 6,
      py: muxY0 + hm * 0.62,
      ax: mx + Math.max(4, 0.5 * c),
      W: Math.ceil(mx + SENSE * c + 2),
      H: Math.ceil(muxY1 + 5 + rows * lh),
      fs: fsz,
    };
  };

  type Drawn = {
    g: P;
    cells: SVGRectElement[];
    cellKey: string[];
    driveHalo: SVGPathElement | null;
    driveLine: SVGPathElement | null;
    senseHalo: SVGPathElement | null;
    senseLine: SVGPathElement | null;
    pin: SVGCircleElement | null;
    arm: SVGPathElement | null;
    armOn: SVGPathElement | null;
    outOn: SVGPathElement | null;
    a0: SVGCircleElement | null;
    foot: SVGEllipseElement | null;
    mapFoot: SVGEllipseElement;
    cell: SVGRectElement;
    ring: SVGCircleElement | null;
    dot: SVGCircleElement | null;
    colMark: SVGRectElement | null;
    rowMark: SVGRectElement | null;
  };
  let A: Drawn | null = null;

  /** Cross positions (pad) and cell corners (map). */
  const crossX = (g: P, s: number) => g.gx + (s + 0.5) * g.c;
  const crossY = (g: P, d: number) => g.gy + (DRIVE - 1 - d + 0.5) * g.c;
  const contactX = (g: P, s: number) => g.gx + (s + 0.5) * g.c;

  const buildPlan = (g: P, labels: { drive: string[]; rot: string }) => {
    svg.replaceChildren();
    const { c, gx, gy, mx, W, H } = g;
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.setAttribute("width", String(W));
    svg.setAttribute("height", String(H));
    svg.dataset.c = c.toFixed(2);
    const gb = gy + DRIVE * c;
    const strip = Math.max(1.4, 0.3 * c);
    const lab = (x: number, y: number, t: string, anchor: "start" | "middle" | "end", cls = "wp-lab", parent: Element = svg) => {
      const e = svgEl("text", { class: cls, x: f1(x), y: f1(y), "text-anchor": anchor, "dominant-baseline": "central" }, parent);
      e.textContent = t;
      return e;
    };
    const lh = g.fs + 3.5;
    const mini = g.form === "mini";
    let driveHalo = null;
    let driveLine = null;
    let senseHalo = null;
    let senseLine = null;
    let pin = null;
    let arm = null;
    let armOn = null;
    let outOn = null;
    let a0 = null;
    let foot = null;
    let ring = null;
    let dot = null;
    let colMark = null;
    let rowMark = null;
    if (!mini) {
      // ---- labels over the pad and the map (large: a second, muted row); the shift registers' label
      // (centred over the pad and the map; where those would touch, the pad's ends at its right edge and the map's
      // starts at its left one)
      const y1 = lh / 2 + 1;
      let tS = T("nSense");
      const wS = textWidth("wp-lab wp-lab-strong", [tS], g.fs);
      const wM = textWidth("wp-lab wp-lab-strong", [T("touchMap")], g.fs);
      const centred = gx + (SENSE * c) / 2 + wS / 2 + 6 <= mx + (SENSE * c) / 2 - wM / 2;
      if (!centred && gx + SENSE * c - wS < 0) tS = T("senseLines");
      const xS = centred ? gx + (SENSE * c) / 2 : gx + SENSE * c;
      const xM = centred ? mx + (SENSE * c) / 2 : mx;
      const aS = centred ? "middle" : "end";
      const aM = centred ? "middle" : "start";
      lab(xS, y1, tS, aS, "wp-lab wp-lab-strong");
      lab(xM, y1, T("touchMap"), aM, "wp-lab wp-lab-strong");
      if (g.form === "large") {
        lab(xS, y1 + lh, T("topFpc"), aS);
        lab(xM, y1 + lh, T("squares"), aM);
        const n = labels.drive.length;
        labels.drive.forEach((t, i) => lab(g.chipX - 7, gy + (DRIVE * c) / 2 + (i - (n - 1) / 2) * lh, t, "end", i === 0 ? "wp-lab wp-lab-strong" : i === n - 1 ? "wp-lab" : "wp-lab wp-lab-strong"));
      } else if (labels.rot) {
        const e = lab(0, 0, labels.rot, "middle", "wp-lab");
        e.setAttribute("transform", `translate(${f1(g.chipX - 7)} ${f1(gy + (DRIVE * c) / 2)}) rotate(-90)`);
      }
      // ---- wires: drive outputs (chip -> pad), sense lines (pad -> multiplexer)
      const gw = svgEl("g", { class: "wp-wires" }, svg);
      let dw = "";
      for (let d = 0; d < DRIVE; d++) dw += `M${f1(g.chipX + g.chipW)} ${f1(crossY(g, d))}H${f1(gx)}`;
      svgEl("path", { class: "wp-wire", d: dw }, gw);
      let sw = "";
      for (let s = 0; s < SENSE; s++) sw += `M${f1(crossX(g, s))} ${f1(gb)}V${f1(g.muxY0)}`;
      svgEl("path", { class: "wp-wire", d: sw }, gw);
      // ---- the copper lines: drive (Bottom FPC) under, sense (Top FPC) over
      const gs = svgEl("g", { class: "wp-strips" }, svg);
      let dd = "";
      for (let d = 0; d < DRIVE; d++) dd += `M${f1(gx)} ${f1(crossY(g, d))}H${f1(gx + SENSE * c)}`;
      svgEl("path", { class: "wp-strip wp-strip-d", d: dd, "stroke-width": f1(strip) }, gs);
      let ss = "";
      for (let s = 0; s < SENSE; s++) ss += `M${f1(crossX(g, s))} ${f1(gy)}V${f1(gb)}`;
      svgEl("path", { class: "wp-strip wp-strip-s", d: ss, "stroke-width": f1(strip) }, gs);
      // ---- the fingertip's footprint on the pad
      foot = svgEl("ellipse", { class: "wp-foot", rx: f1(FOOT_RX * c), ry: f1(FOOT_RY * c) }, svg);
      // ---- the scan: the powered drive line and the sense line listened to (halo + line), over the pad
      const gg = svgEl("g", { class: "wp-glow" }, svg);
      driveHalo = svgEl("path", { class: "wp-halo wp-halo-d", "stroke-width": f1(strip + 4) }, gg);
      senseHalo = svgEl("path", { class: "wp-halo wp-halo-s", "stroke-width": f1(strip + 4) }, gg);
      driveLine = svgEl("path", { class: "wp-on wp-on-d", "stroke-width": f1(strip) }, gg);
      senseLine = svgEl("path", { class: "wp-on wp-on-s", "stroke-width": f1(strip) }, gg);
      // ---- the shift registers: four chips, eight outputs each (drive 0-7 in the bottom one), chained
      const gc = svgEl("g", { class: "wp-chips" }, svg);
      const inset = Math.max(1.5, 0.22 * c);
      for (let k = 0; k < CHIPS; k++) {
        const y0 = gy + (DRIVE - CHIP_OUT * (k + 1)) * c + inset;
        const y1c = gy + (DRIVE - CHIP_OUT * k) * c - inset;
        svgEl("rect", { class: "wp-chip", x: f1(g.chipX), y: f1(y0), width: f1(g.chipW), height: f1(y1c - y0), rx: 2 }, gc);
        // the notch (pin 1 end)
        svgEl("path", { class: "wp-notch", d: `M${f1(g.chipX + g.chipW / 2 - 3)} ${f1(y1c)}a3 3 0 0 1 6 0` }, gc);
        if (k < CHIPS - 1 && g.form === "large") {
          // the chain: each chip passes its last bit on to the next one up
          const yn = gy + (DRIVE - CHIP_OUT * (k + 1)) * c;
          svgEl("path", { class: "wp-chain", d: `M${f1(g.chipX + 4)} ${f1(yn + inset)}V${f1(yn - inset)}` }, gc);
        }
      }
      for (let d = 0; d < DRIVE; d++) svgEl("circle", { class: "wp-pin", cx: f1(g.chipX + g.chipW), cy: f1(crossY(g, d)), r: f1(Math.max(1, 0.12 * c)) }, gc);
      pin = svgEl("circle", { class: "wp-pin-on", r: f1(Math.max(2, 0.24 * c)) }, gc);
      // ---- the multiplexer: 12 contacts, a switch that picks one, its output to A0
      const gm = svgEl("g", { class: "wp-mux" }, svg);
      const box = svgEl("rect", { class: "wp-mux-box", x: f1(g.muxX0), y: f1(g.muxY0), width: f1(g.muxX1 - g.muxX0), height: f1(g.muxY1 - g.muxY0), rx: 3 }, gm);
      svgEl("title", {}, box).textContent = T("muxTitle");
      for (let s = 0; s < SENSE; s++) svgEl("circle", { class: "wp-contact", cx: f1(contactX(g, s)), cy: f1(g.muxY0 + 3.2), r: 1.3 }, gm);
      arm = svgEl("path", { class: "wp-arm" }, gm);
      armOn = svgEl("path", { class: "wp-arm wp-arm-on" }, gm);
      svgEl("circle", { class: "wp-pivot", cx: f1(g.px), cy: f1(g.py), r: 2.2 }, gm);
      const outD = `M${f1(g.px)} ${f1(g.py)}H${f1(g.ax)}`;
      svgEl("path", { class: "wp-wire wp-out", d: outD }, gm);
      outOn = svgEl("path", { class: "wp-out-on", d: outD }, gm);
      // A0, and the reading going up into the picture
      svgEl("path", { class: "wp-arrow", d: `M${f1(g.ax)} ${f1(g.py - 3)}V${f1(gb + 4)}M${f1(g.ax - 3)} ${f1(gb + 7.5)}L${f1(g.ax)} ${f1(gb + 3)}L${f1(g.ax + 3)} ${f1(gb + 7.5)}` }, gm);
      a0 = svgEl("circle", { class: "wp-a0", cx: f1(g.ax), cy: f1(g.py), r: 2.6 }, gm);
      lab(g.ax + 6, g.py + 0.5, "A0", "start", "wp-lab wp-lab-strong");
      // the multiplexer's label, under it
      // (one row: as long as the plan's width allows)
      const yl = g.muxY1 + 4 + lh / 2;
      const muxT = [T("mux1"), T("mux2"), T("mux3"), T("mux4")];
      lab(g.muxX0, yl, muxT.find((t) => g.muxX0 + textWidth("wp-lab", [t], g.fs) <= W) ?? muxT[muxT.length - 1], "start");
    } else {
      lab(gx + (SENSE * c) / 2, (gy - 3) / 2 + 0.5, T("touchMap"), "middle", "wp-lab wp-lab-strong");
    }
    // ---- the touch map: one square per crossing, level with it (row 31 − j from the top)
    const gmap = svgEl("g", { class: "wp-map" }, svg);
    const cells: SVGRectElement[] = [];
    const rr = f1(Math.min(1.6, c / 5));
    for (let s = 0; s < SENSE; s++)
      for (let d = 0; d < DRIVE; d++) {
        cells[vi(s, d)] = svgEl("rect", { x: f1(mx + s * c + 0.5), y: f1(gy + (DRIVE - 1 - d) * c + 0.5), width: f1(c - 1), height: f1(c - 1), rx: rr }, gmap);
      }
    const mapFoot = svgEl("ellipse", { class: "wp-mapfoot", rx: f1(FOOT_RX * c), ry: f1(FOOT_RY * c) }, svg);
    if (mini) {
      // the picked column and the powered row, marked on the map itself
      colMark = svgEl("rect", { class: "wp-mark-s", width: f1(c + 1), height: f1(DRIVE * c + 1), y: f1(gy - 0.5), rx: 1.5 }, svg);
      rowMark = svgEl("rect", { class: "wp-mark-d", width: f1(SENSE * c + 1), height: f1(c + 1), x: f1(mx - 0.5), rx: 1.5 }, svg);
    }
    const cell = svgEl("rect", { class: "wp-cell", width: f1(c + 1), height: f1(c + 1), rx: 1.5 }, svg);
    if (!mini) {
      ring = svgEl("circle", { class: "wp-ring", r: f1(Math.max(3.4, 0.5 * c + 1)) }, svg);
      dot = svgEl("circle", { class: "wp-dot", r: f1(Math.max(1.6, 0.28 * c)) }, svg);
    }
    // the pointer: the pad and the map both move the fingertip
    svgEl("rect", { class: "wp-hit", x: 0, y: 0, width: W, height: H }, svg);
    A = { g, cells, cellKey: new Array(TAXELS).fill(""), driveHalo, driveLine, senseHalo, senseLine, pin, arm, armOn, outOn, a0, foot, mapFoot, cell, ring, dot, colMark, rowMark };
  };

  // ------------------------------------------------------------------ the cross-section drawing
  type SecLevel = "full" | "mid" | "strip";
  let secOn: SVGElement[] = []; // the Top FPC's copper strips, left -> right
  const nameOf = (id: string): string => (id === "fpc_top" ? T("topFpc") : id === "fpc_bot" ? T("botFpc") : id === "velostat" ? "Velostat" : T("lam"));
  const cuOf = (id: string): string => (id === "fpc_top" ? T("cuDown") : id === "fpc_bot" ? T("cuUp") : "");
  const mmTxt = (v: number) => `${+v.toFixed(2)} mm`;
  /** The cross-section at a width and height. All three cut the stack the same way (sliced along one drive line:
   *  the Top FPC's 12 copper strips cut across, between its slots; the Bottom FPC's drive line cut along it).
   *  full (large): a caption row; names, values and, under each FPC, which way its copper faces and which lines it
   *  carries, level with the bands; brackets for the sourced 0.5 mm and the whole pad; the 1 mm scale and ×E.
   *  mid (medium): the cut on the left, one line per layer on the right ("Top FPC · 0.2 mm · copper ↓"), under it
   *  "layers drawn ×E thicker · whole pad < 1 mm".
   *  strip (mini, short): five thin bands on the left (the sourced layers in true proportion: the Velostat half an
   *  FPC; the sheets hatched), their names on the right. Returns the thickness factor E (0 for the strip). */
  const buildSection = (W: number, Hs: number, level: SecLevel) => {
    secSvg.replaceChildren();
    secOn = [];
    const H = Math.round(Hs);
    secSvg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    secSvg.setAttribute("width", String(W));
    secSvg.setAttribute("height", String(H));
    secSvg.dataset.level = level;
    const defs = svgEl("defs", {}, secSvg);
    const pat = svgEl("pattern", { id: `${uid}-hatch`, width: 5, height: 5, patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)" }, defs);
    svgEl("rect", { width: 5, height: 5, class: "wp-hatch-bg" }, pat);
    svgEl("line", { x1: 0, y1: 0, x2: 0, y2: 5, class: "wp-hatch" }, pat);
    const lab = (x: number, y: number, t: string, anchor: "start" | "middle" | "end", cls = "wp-lab") => {
      const e = svgEl("text", { class: cls, x: f1(x), y: f1(y), "text-anchor": anchor, "dominant-baseline": "central" }, secSvg);
      e.textContent = t;
      return e;
    };
    const tw = (cls: string, words: string[], px: number) => textWidth(cls, words, px, secSvg);
    const band = (k: string, x: number, y: number, w: number, hh: number, hatched: boolean) => {
      const r = svgEl("rect", { class: `wp-b-${k}`, x: f1(x), y: f1(y), width: f1(w), height: f1(hh) }, secSvg);
      // (a style, not the fill attribute: the class's fill would win over an attribute)
      if (hatched) r.style.fill = `url(#${uid}-hatch)`;
      return r;
    };

    if (level === "strip") {
      const narrow = W < 220;
      const fsz = narrow ? 8.5 : 9;
      const hOf = (l: StackLayer) => (l.thickness != null ? l.thickness * (narrow ? 70 : 80) : narrow ? 5 : 9);
      const total = LAYERS.reduce((s, l) => s + hOf(l), 0);
      const capH = fsz + 4;
      const bw = narrow ? Math.max(26, Math.round(W * 0.24)) : Math.round(Math.min(120, W * 0.3));
      let y = Math.max(1, Math.round((H - capH - total) / 2));
      const lx = bw + 7;
      for (const l of LAYERS) {
        const hh = hOf(l);
        const k = KIND[l.id];
        band(k, 0.5, y, bw, hh, l.thickness == null);
        if (k === "fpc") {
          const ch = Math.max(1.4, hh * 0.22);
          svgEl("rect", { class: "wp-cu", x: 0.5, y: f1(l.id === "fpc_top" ? y + hh - ch : y), width: bw, height: f1(ch) }, secSvg);
        }
        const cy = y + hh / 2;
        if (k !== "lam") {
          const v = l.thickness!;
          const t = narrow ? `${nameOf(l.id)} ${v}` : `${nameOf(l.id)} · ${mmTxt(v)}${cuOf(l.id)}`;
          lab(lx, cy, t, "start", "wp-lab wp-lab-sm wp-lab-ink");
        } else if (!narrow) lab(lx, cy, T("lamNotGiven"), "start", "wp-lab wp-lab-sm wp-lab-ng");
        y += hh;
      }
      lab(0, y + capH / 2 + 2, narrow ? T("stripCapN", { TOTAL }) : T("stripCap", { TOTAL }), "start", "wp-lab wp-lab-sm");
      return 0;
    }

    if (level === "mid") {
      // the true cut on the left (true scale across, thickness ×E), one line per layer on the right, level with its
      // band and joined to it by one short horizontal leader; E is the largest nice factor that fits, at least the one
      // that makes the Velostat 9 px (so the five 11 px lines never touch); under it, how much thicker the layers are
      // drawn and the whole pad's bound
      const fsz = 11;
      const txt = (l: StackLayer) =>
        l.thickness == null ? `${nameOf(l.id)} · ${T("notGiven")}` : `${nameOf(l.id)} · ${mmTxt(l.thickness)}${cuOf(l.id)}`;
      const lw = tw("wp-lab wp-lab-sm wp-lab-ink", LAYERS.map(txt), fsz);
      const bw = Math.max(90, W - lw - 16);
      const capH = 20;
      const sx = bw / (WIN[1] - WIN[0]);
      const X = (v: number) => (v - WIN[0]) * sx;
      const TOK = 9; // px: a sheet with no thickness in the sources
      const raw = (H - capH - 2 * TOK) / (KNOWN * sx);
      const need = 9 / (0.1 * sx);
      const E = Math.max(NICE.filter((n) => n <= raw).pop() ?? NICE[0], NICE.find((n) => n >= need) ?? NICE[NICE.length - 1]);
      const sy = sx * E;
      const hOf = (l: StackLayer) => (l.thickness != null ? l.thickness * sy : TOK);
      const total = LAYERS.reduce((t, l) => t + hOf(l), 0);
      let y = Math.max(2.5, (H - capH - total) / 2);
      for (const l of LAYERS) {
        const hh = hOf(l);
        const k = KIND[l.id];
        const spans = k === "lam" ? [WIN] : k === "velo" ? [VELO_SPAN] : (l.id === "fpc_top" ? CUT_TOP : CUT_BOT).film;
        for (const [a, b] of spans) band(k, X(a), y, (b - a) * sx, hh, l.thickness == null);
        if (k === "fpc") {
          const ch = Math.max(1.6, hh * 0.2);
          const cy = l.id === "fpc_top" ? y + hh - ch : y;
          for (const [a, b] of (l.id === "fpc_top" ? CUT_TOP : CUT_BOT).copper) {
            const r = svgEl("rect", { class: "wp-cu", x: f1(X(a)), y: f1(cy), width: f1((b - a) * sx), height: f1(ch) }, secSvg);
            if (l.id === "fpc_top") secOn.push(r);
          }
        }
        const cy = y + hh / 2;
        svgEl("path", { class: "wp-lead", d: `M${f1(bw + 3)} ${f1(cy)}H${f1(bw + 10)}` }, secSvg);
        lab(bw + 13, cy, txt(l), "start", `wp-lab wp-lab-sm ${l.thickness == null ? "wp-lab-ng" : "wp-lab-ink"}`);
        y += hh;
      }
      lab(0, H - 6.5, T("midCap", { E, TOTAL }), "start", "wp-lab wp-lab-sm");
      return E;
    }

    // ---- full: labels | bands (true scale across, thickness ×E) | brackets
    const fsz = 11;
    const nameCls = "wp-lab wp-lab-strong";
    const valCls = "wp-lab wp-lab-val";
    const SUB: Record<string, string> = { fpc_top: T("subTop"), fpc_bot: T("subBot") };
    const maxName = tw(nameCls, LAYERS.map((l) => nameOf(l.id)), fsz);
    const valW = tw(valCls, ["0.2 mm", T("notGiven")], fsz);
    // names, then a value column (right-aligned); the FPCs' second line under them
    const lw = Math.max(maxName + 10 + valW, tw("wp-lab wp-lab-sub", Object.values(SUB), fsz));
    const wKnown = tw(valCls, [mmTxt(KNOWN)], fsz);
    const brW = 12 + wKnown + 12 + 4 + tw(valCls, [T("wholePad"), `< ${TOTAL} mm`], fsz) + 2;
    const x0 = Math.ceil(lw + 16);
    const x1 = Math.floor(W - brW);
    const topRoom = 17;
    const botRoom = 17;
    const avail = H - topRoom - botRoom;
    const sx = (x1 - x0) / (WIN[1] - WIN[0]);
    const X = (v: number) => x0 + (v - WIN[0]) * sx;
    const raw = avail / ((KNOWN + 2 * TOKEN_MM) * sx);
    const E = NICE.filter((n) => n <= raw).pop() ?? NICE[0];
    const sy = sx * E;
    const hOf = (l: StackLayer) => (l.thickness != null ? l.thickness : TOKEN_MM) * sy;
    const total = LAYERS.reduce((t, l) => t + hOf(l), 0);
    let y = topRoom + Math.max(0, (avail - total) / 2);
    lab(0, 6.5, T("secCap"), "start", "wp-lab wp-cap");
    const geoY: Record<string, { y: number; h: number }> = {};
    for (const l of LAYERS) {
      const hh = hOf(l);
      geoY[l.id] = { y, h: hh };
      const k = KIND[l.id];
      const spans = k === "lam" ? [WIN] : k === "velo" ? [VELO_SPAN] : (l.id === "fpc_top" ? CUT_TOP : CUT_BOT).film;
      for (const [a, b] of spans) band(k, X(a), y, (b - a) * sx, hh, l.thickness == null);
      if (k === "fpc") {
        // copper on the face that touches the Velostat: the Top FPC's underside, the Bottom FPC's top
        const ch = Math.max(1.6, hh * 0.2);
        const cy = l.id === "fpc_top" ? y + hh - ch : y;
        for (const [a, b] of (l.id === "fpc_top" ? CUT_TOP : CUT_BOT).copper) {
          const r = svgEl("rect", { class: "wp-cu", x: f1(X(a)), y: f1(cy), width: f1((b - a) * sx), height: f1(ch) }, secSvg);
          if (l.id === "fpc_top") secOn.push(r);
        }
      }
      // the label, level with its band, and one short horizontal leader to it
      const cy = y + hh / 2;
      const sub = SUB[l.id];
      const two = Boolean(sub) && hh >= 2 * fsz + 1;
      const ny = two ? cy - (fsz + 2) / 2 : cy;
      lab(0, ny, nameOf(l.id), "start", nameCls);
      lab(maxName + 10 + valW, ny, l.thickness != null ? mmTxt(l.thickness) : T("notGiven"), "end", l.thickness != null ? valCls : "wp-lab wp-lab-ng");
      if (two) lab(0, cy + (fsz + 2) / 2, sub, "start", "wp-lab wp-lab-sub");
      svgEl("path", { class: "wp-lead", d: `M${f1(lw + 5)} ${f1(cy)}H${f1(X(WIN[0]) - 3)}` }, secSvg);
      y += hh;
    }
    // brackets on the right: the sourced layers (0.2 + 0.1 + 0.2), and the whole pad < 1 mm
    const top = geoY.lam_top.y;
    const bot = geoY.lam_bot.y + geoY.lam_bot.h;
    const brk = (xb: number, ya: number, yb: number) => svgEl("path", { class: "wp-brk", d: `M${f1(xb - 4)} ${f1(ya)}H${f1(xb)}V${f1(yb)}H${f1(xb - 4)}` }, secSvg);
    const a = geoY.fpc_top.y;
    const bb = geoY.fpc_bot.y + geoY.fpc_bot.h;
    brk(x1 + 10, a + 0.5, bb - 0.5);
    lab(x1 + 14, (a + bb) / 2, mmTxt(KNOWN), "start", valCls);
    const xb = x1 + 14 + wKnown + 12;
    brk(xb, top + 0.5, bot - 0.5);
    lab(xb + 4, (top + bot) / 2 - fsz * 0.65, T("wholePad"), "start", "wp-lab wp-lab-sub");
    lab(xb + 4, (top + bot) / 2 + fsz * 0.65, `< ${TOTAL} mm`, "start", valCls);
    // the scale: 1 mm across (true scale), and how much thicker the layers are drawn
    const yS = H - 7;
    const xs0 = X(WIN[0]);
    svgEl("path", { class: "wp-scale", d: `M${f1(xs0)} ${yS}H${f1(xs0 + sx)}M${f1(xs0)} ${yS - 3}V${yS + 3}M${f1(xs0 + sx)} ${yS - 3}V${yS + 3}` }, secSvg);
    lab(xs0 + sx + 6, yS + 0.5, T("scale", { E }), "start", "wp-lab wp-lab-sm");
    return E;
  };

  // ------------------------------------------------------------------ layout: form, height budget, pitch
  let fixedMax: number | null = null;
  let lastKey = "";
  let form: Form = "large";
  const relayout = (maxH?: number) => {
    if (!root.isConnected) return;
    const cardW = Math.round(root.getBoundingClientRect().width);
    if (cardW < 60) return;
    const compact = Boolean(root.closest("[data-compact]"));
    const short = Boolean(root.closest("[data-short]"));
    // the height budget: given, a px max-height on the card, else from the width
    const card = root.closest<HTMLElement>(".demo-card");
    const cssMax = card ? parseFloat(getComputedStyle(card).maxHeight) : NaN;
    let B = maxH ?? fixedMax ?? (Number.isFinite(cssMax) ? cssMax - 2 : NaN);
    const given = Number.isFinite(B);
    if (!given) B = cardW < 190 ? Math.round(2.9 * cardW + 5) : Math.min(700, Math.round(1.06 * cardW + 70));
    if (!given && compact) B = Math.round(B * (short ? 0.78 : 0.9));
    const key = `${cardW}|${Math.round(B)}|${compact}|${short}|${ctx.theme()}`;
    if (key === lastKey) return;
    lastKey = key;
    const cs = getComputedStyle(root);
    const inner = cardW - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    form = cardW < 190 ? "mini" : inner >= 470 ? "large" : "medium";
    root.dataset.form = form;
    // what the card may drop to give the drawing room, in order (see the header)
    // (the card's title says what the step's title says: it goes before the cross-section shrinks)
    type Step = { line: boolean; sec: "pref" | "min" | "strip"; note: boolean; title: boolean };
    const steps: Step[] =
      form === "mini" || short
        ? [{ line: false, sec: "strip", note: false, title: form !== "mini" }]
        : [
            { line: !compact, sec: "pref", note: true, title: true },
            { line: false, sec: "pref", note: true, title: true },
            { line: false, sec: "pref", note: true, title: false },
            { line: false, sec: "min", note: true, title: false },
            { line: false, sec: "min", note: false, title: false },
            { line: false, sec: "strip", note: false, title: false },
          ];
    const cGood = form === "large" ? 8 : 5.5;
    const cMin = form === "large" ? 5 : 3.5;
    const cMax = form === "large" ? 13 : form === "medium" ? 11 : 10;
    const drive = [T("chips"), T("toDrive"), T("botFpc")];
    const lwCol = form === "large" ? textWidth("wp-lab wp-lab-strong", drive, 11) + 9 : 0;
    const rotFull = T("rotFull");
    const rotShort = T("chips");
    const wRotFull = form === "medium" ? textWidth("wp-lab", [rotFull], 11) : 0;
    const wRotShort = form === "medium" ? textWidth("wp-lab", [rotShort], 11) : 0;
    type Pick = { c: number; lw: number; rot: string; step: Step };
    let pick: Pick | null = null;
    let fallback: Pick | null = null;
    for (const st of steps) {
      root.toggleAttribute("data-noline", !st.line);
      root.toggleAttribute("data-nonote", !st.note);
      root.toggleAttribute("data-notitle", !st.title);
      // the cross-section first (its width is the card's), then what is left for the plan
      const secW = Math.floor(secBox.getBoundingClientRect().width) || Math.floor(inner);
      const level: SecLevel = st.sec === "strip" ? "strip" : form === "large" ? "full" : "mid";
      const Hs = st.sec === "strip" ? (form === "mini" ? 60 : 72) : st.sec === "min" ? (form === "large" ? 120 : 86) : form === "large" ? clampN(0.21 * B, 126, 172) : clampN(0.21 * B, 90, 132);
      buildSection(secW, Hs, level);
      // measure everything but the plan (drawn empty): beside the side column (large, medium) or above it (mini)
      svg.replaceChildren();
      svg.setAttribute("width", "0");
      svg.setAttribute("height", "0");
      const beside = form !== "mini";
      const sideH = side.getBoundingClientRect().height;
      const mainH0 = main.getBoundingClientRect().height;
      const F = root.getBoundingClientRect().height - mainH0;
      const availH = beside ? B - F : B - F - mainH0;
      const availW = Math.floor(plan.getBoundingClientRect().width);
      let best: Pick | null = null;
      for (let c = cMax; c >= cMin - 1e-9; c -= 0.25) {
        let rot = "";
        let lw = lwCol;
        if (form === "medium") {
          rot = wRotFull <= DRIVE * c - 8 ? rotFull : wRotShort <= DRIVE * c - 8 ? rotShort : "";
          lw = rot ? 15 : 2;
        }
        const g = geo(form, c, lw);
        if (g.W <= availW && g.H <= availH) {
          best = { c, lw, rot, step: st };
          break;
        }
      }
      const sideOk = !beside || sideH <= availH + 0.5;
      if (best && sideOk && best.c >= cGood) {
        pick = best;
        break;
      }
      if (best && sideOk && (!fallback || best.c > fallback.c)) fallback = best;
    }
    pick = pick ?? fallback ?? { c: cMin, lw: form === "large" ? lwCol : 2, rot: "", step: steps[steps.length - 1] };
    // (re-apply the chosen step: the loop may have gone past it)
    const st = pick.step;
    root.toggleAttribute("data-noline", !st.line);
    root.toggleAttribute("data-nonote", !st.note);
    root.toggleAttribute("data-notitle", !st.title);
    const secW = Math.floor(secBox.getBoundingClientRect().width) || Math.floor(inner);
    const level: SecLevel = st.sec === "strip" ? "strip" : form === "large" ? "full" : "mid";
    const Hs = st.sec === "strip" ? (form === "mini" ? 60 : 72) : st.sec === "min" ? (form === "large" ? 120 : 86) : form === "large" ? clampN(0.21 * B, 126, 172) : clampN(0.21 * B, 90, 132);
    const E = buildSection(secW, Hs, level);
    root.dataset.e = String(E);
    buildPlan(geo(form, pick.c, pick.lw), { drive, rot: pick.rot });
    root.dataset.c = pick.c.toFixed(2);
    render(true);
  };

  // ------------------------------------------------------------------ drawing the state
  let lut = lutFor([227, 227, 222]);
  const readTheme = () => {
    const zero = parseColor(getComputedStyle(root).getPropertyValue("--wp-map-zero"), [227, 227, 222]);
    lut = lutFor(zero);
    if (A) A.cellKey.fill("");
  };
  readTheme();

  let stepped = false; // reduced motion: the learner has stepped the scan
  /** The lines the card shows now (its counters, the highlighted lines and the ring): the sense line listened to and
   *  the drive line powered, or null for none (real speed, the registers reloading, a still picture under reduced
   *  motion before the learner steps). What onScan reports, so a mirror shows what the card shows. */
  const linesNow = () => {
    const real = speed === "real";
    const w = where(Math.max(0, Math.min(tau, perPicture() - 1e-9)));
    const done = taken >= TAXELS && !real;
    const k = done ? TAXELS - 1 : w.k;
    const powered = !real && !w.inGap && !(done && reduced && !stepped);
    const listening = !real && (!w.inGap || w.f > 0.6) && !(done && reduced && !stepped);
    return { sense: listening ? senseAt(k) : null, drive: powered ? driveAt(k) : null };
  };
  let lastCount = "";
  const render = (force = false) => {
    const real = speed === "real";
    root.dataset.speed = speed;
    const w = where(Math.min(tau, perPicture() - 1e-9));
    const done = taken >= TAXELS && !real;
    const kNow = done ? TAXELS - 1 : w.k;
    const sNow = senseAt(kNow);
    const dNow = driveAt(kNow);
    const powered = !real && !w.inGap && !(done && reduced && taken >= TAXELS && !stepped);
    const listening = !real && (!w.inGap || w.f > 0.6) && !(done && reduced && !stepped);
    // ---- counters
    const cnt = `${real}|${sNow}|${dNow}|${taken}|${picture}|${powered}|${listening}|${qOf(lastV)}`;
    if (cnt !== lastCount || force) {
      lastCount = cnt;
      // (a whole picture at rest, reduced motion before any step: no line is picked or powered)
      const idle = done && !stepped;
      out.s.textContent = real ? T("all") : idle ? "–" : String(sNow + 1);
      out.d.textContent = real ? T("all") : powered ? String(dNow + 1) : "–";
      out.sOf.textContent = real ? ` ${SENSE}` : `/${SENSE}`;
      out.dOf.textContent = real ? ` ${DRIVE}` : `/${DRIVE}`;
      out.n.textContent = String(real ? TAXELS : taken);
      out.p.textContent = fmtInt(picture);
      out.a.textContent = real ? "–" : `${voltsOf(lastV).toFixed(2)} V`;
      out.cs.classList.toggle("is-off", !listening && !real);
      out.cd.classList.toggle("is-off", !powered && !real);
    }
    if (!A) return;
    const g = A.g;
    const { c } = g;
    // ---- the map
    for (let s = 0; s < SENSE; s++)
      for (let d = 0; d < DRIVE; d++) {
        const i = vi(s, d);
        const read = real || kOf(s, d) < taken;
        const v = read ? cur[i] : prev[i];
        const q = qOf(v);
        const key = read ? `a${q}` : hasPrev ? `b${q}` : "e";
        if (key === A.cellKey[i]) continue;
        A.cellKey[i] = key;
        const r = A.cells[i];
        r.setAttribute("fill", key === "e" ? lut[0] : lut[q]);
        r.setAttribute("class", read ? "" : hasPrev ? "is-old" : "is-empty");
      }
    // ---- the fingertip
    const fx = (s: number, x0: number) => x0 + (s + 0.5) * c;
    const fy = (d: number) => g.gy + (DRIVE - 1 - d + 0.5) * c;
    if (A.foot) {
      A.foot.setAttribute("cx", f1(fx(fs, g.gx)));
      A.foot.setAttribute("cy", f1(fy(fd)));
    }
    A.mapFoot.setAttribute("cx", f1(fx(fs, g.mx)));
    A.mapFoot.setAttribute("cy", f1(fy(fd)));
    // ---- the scan: where the ring is (eased between crossings in slow motion)
    const showCell = !real && !(done && !stepped);
    A.cell.style.display = showCell ? "" : "none";
    if (A.ring) A.ring.style.display = showCell ? "" : "none";
    if (A.dot) A.dot.style.display = showCell ? "" : "none";
    let rs = sNow;
    let rd = dNow;
    let armS = sNow;
    if (!real && speed === "slow" && !done && playing) {
      const kPrev = kNow > 0 ? kNow - 1 : TAXELS - 1;
      const first = kNow % INNER === 0;
      const t = w.inGap ? ease(w.f / 0.8) : first ? 1 : ease(w.f / 0.35);
      rs = senseAt(kPrev) + (sNow - senseAt(kPrev)) * t;
      rd = driveAt(kPrev) + (dNow - driveAt(kPrev)) * t;
      armS = rs;
    }
    const isTaken = done || kOf(sNow, dNow) < taken;
    if (showCell) {
      A.cell.setAttribute("x", f1(g.mx + sNow * c - 0.5));
      A.cell.setAttribute("y", f1(g.gy + (DRIVE - 1 - dNow) * c - 0.5));
      A.cell.classList.toggle("is-taken", isTaken);
      if (A.ring && A.dot) {
        const cx = f1(fx(rs, g.gx));
        const cy = f1(fy(rd));
        A.ring.setAttribute("cx", cx);
        A.ring.setAttribute("cy", cy);
        A.dot.setAttribute("cx", cx);
        A.dot.setAttribute("cy", cy);
        A.dot.setAttribute("fill", isTaken ? lut[qOf(cur[vi(sNow, dNow)])] : "none");
        A.dot.classList.toggle("is-taken", isTaken);
      }
    }
    // the powered drive line (from its chip's pin across the pad) and the sense line listened to (down to its contact)
    const yD = fy(dNow);
    const xS = fx(sNow, g.gx);
    if (A.driveLine && A.driveHalo && A.pin) {
      const d = powered ? `M${f1(g.chipX + g.chipW)} ${f1(yD)}H${f1(g.gx + SENSE * c + 0.15 * c)}` : "";
      A.driveLine.setAttribute("d", d);
      A.driveHalo.setAttribute("d", d);
      A.pin.setAttribute("cx", f1(g.chipX + g.chipW));
      A.pin.setAttribute("cy", f1(yD));
      A.pin.style.display = powered ? "" : "none";
    }
    if (A.senseLine && A.senseHalo) {
      const d = listening ? `M${f1(xS)} ${f1(g.gy - 0.15 * c)}V${f1(g.muxY0 + 3.2)}` : "";
      A.senseLine.setAttribute("d", d);
      A.senseHalo.setAttribute("d", d);
    }
    if (A.arm && A.armOn && A.outOn && A.a0) {
      const ax = g.gx + (armS + 0.5) * c;
      const arm = real ? "" : `M${f1(g.px)} ${f1(g.py)}L${f1(ax)} ${f1(g.muxY0 + 3.2)}`;
      A.arm.setAttribute("d", arm);
      A.armOn.setAttribute("d", listening ? arm : "");
      A.outOn.style.display = listening || real ? "" : "none";
      A.a0.classList.toggle("is-on", listening || real);
    }
    if (A.colMark && A.rowMark) {
      A.colMark.setAttribute("x", f1(g.mx + sNow * c - 0.5));
      A.rowMark.setAttribute("y", f1(g.gy + (DRIVE - 1 - dNow) * c - 0.5));
      A.colMark.style.display = listening ? "" : "none";
      A.rowMark.style.display = powered ? "" : "none";
    }
    // the cross-section: the sense line listened to, its copper teal
    const on = listening ? senseStrip(sNow) : -1;
    secOn.forEach((r, i) => r.classList.toggle("is-on", i === on));
  };

  // ------------------------------------------------------------------ sync out
  const subs = new Set<(s: PadScanState) => void>();
  const snapshot = (): PadScanState => {
    const { sense, drive } = linesNow();
    return {
      sense,
      drive,
      reading: taken,
      picture,
      speed,
      playing,
      values: Array.from(hasPrev ? prev : cur, (v) => Math.round(v * 1000) / 1000),
      finger: { sense: +fs.toFixed(2), drive: +fd.toFixed(2) },
    };
  };
  let sentKey = "";
  let sentAt = -1e9;
  let sendTimer = 0;
  const flush = () => {
    sendTimer = 0;
    sentAt = performance.now();
    const st = snapshot();
    sentKey = `${st.sense}|${st.drive}|${st.picture}|${st.speed}|${st.playing}|${st.finger.sense}|${st.finger.drive}`;
    for (const fn of subs) fn(st);
    root.dispatchEvent(new CustomEvent("pad-demo:scan", { detail: st, bubbles: true }));
  };
  function emit(now = false) {
    const { sense, drive } = linesNow();
    const key = `${sense}|${drive}|${picture}|${speed}|${playing}|${+fs.toFixed(2)}|${+fd.toFixed(2)}`;
    if (key === sentKey && !now) return;
    if (sendTimer) return;
    const wait = sentAt + 33 - performance.now();
    if (wait <= 0) flush();
    else sendTimer = window.setTimeout(flush, wait);
  }

  // ------------------------------------------------------------------ controls
  const syncControls = () => {
    playBtn.innerHTML = `${playing ? ICON_PAUSE : ICON_PLAY}<span>${playing ? T("pause") : T("play")}</span>`;
    playBtn.setAttribute("aria-pressed", String(playing));
    playBtn.setAttribute("aria-label", playing ? T("pauseAria") : T("playAria"));
    playBtn.hidden = reduced;
    nextBtn.hidden = !(reduced || !playing) || speed === "real";
    lineBtn.hidden = !reduced || speed === "real";
    for (const b of segBtns) b.setAttribute("aria-pressed", String(b.dataset.speed === speed));
    cycleBtn.textContent = T(speed);
    cycleBtn.setAttribute("aria-label", T("cycleAria", { speed: T(`${speed}Id`) }));
    root.toggleAttribute("data-reduced", reduced);
  };
  const setSpeed = (sp: Speed) => {
    if (sp === speed) return;
    if (sp === "real") {
      // real speed: from here on every picture is whole
      takeUpTo(TAXELS);
      speed = sp;
      tau = tau % perPicture();
    } else {
      const w = where(Math.min(tau, perPicture() - 1e-9));
      const from = speed;
      speed = sp;
      if (from === "real") {
        // back to a followable speed: start a new picture
        prev.set(cur);
        hasPrev = true;
        taken = 0;
        tau = 0;
        picture++;
      } else tau = taken >= TAXELS ? perPicture() : tauOf(w.k, w.f, w.inGap, sp);
    }
    if (reduced && sp === "real") {
      cur.set(live);
      taken = TAXELS;
    }
    syncControls();
    render(true);
    emit(true);
  };
  /** Step the scan by hand: one reading, or to the last reading of the current (next) outer line. */
  const step = (line: boolean) => {
    if (speed === "real") return;
    stepped = true;
    if (taken >= TAXELS) {
      // a whole picture is up: start the next one
      prev.set(cur);
      hasPrev = true;
      taken = 0;
      picture++;
    }
    const target = line ? Math.min(TAXELS, (Math.floor(taken / INNER) + 1) * INNER) : taken + 1;
    const k = target - 1;
    tau = tauOf(k, 0.5, false, speed);
    takeUpTo(target);
    if (taken >= TAXELS) tau = tauOf(TAXELS - 1, 0.5, false, speed);
    render(true);
    emit(true);
  };
  playBtn.addEventListener("click", () => {
    playing = !playing;
    if (playing && taken >= TAXELS) {
      // carry on with a new picture
      finishPicture();
      tau = 0;
    }
    syncControls();
    render(true);
    emit(true);
    run();
  });
  nextBtn.addEventListener("click", () => step(false));
  lineBtn.addEventListener("click", () => step(true));
  for (const b of segBtns) b.addEventListener("click", () => setSpeed(b.dataset.speed as Speed));
  cycleBtn.addEventListener("click", () => setSpeed(speed === "slow" ? "fast" : speed === "fast" ? "real" : "slow"));

  // the fingertip: click, tap or drag on the pad or the map
  const moveFinger = (s: number, d: number, now: boolean) => {
    ts = clampN(s, 0, SENSE - 1);
    td = clampN(d, 0, DRIVE - 1);
    if (now || reduced) {
      fs = ts;
      fd = td;
      feel(fs, fd, live);
      if (reduced && taken >= TAXELS) cur.set(live);
      if (speed === "real") cur.set(live);
      render(true);
      emit(true);
    }
    run();
  };
  const fromPointer = (e: PointerEvent): [number, number] | null => {
    if (!A) return null;
    const b = svg.getBoundingClientRect();
    const x = e.clientX - b.left;
    const y = e.clientY - b.top;
    const g = A.g;
    const inY = y >= g.gy - g.c && y <= g.gy + (DRIVE + 1) * g.c;
    const d = DRIVE - 1 - ((y - g.gy) / g.c - 0.5);
    for (const x0 of g.form === "mini" ? [g.mx] : [g.gx, g.mx]) {
      if (inY && x >= x0 - g.c && x <= x0 + (SENSE + 1) * g.c) return [(x - x0) / g.c - 0.5, d];
    }
    return null;
  };
  let dragging = false;
  svg.addEventListener("pointerdown", (e) => {
    const at = fromPointer(e);
    if (!at) return;
    dragging = true;
    try {
      svg.setPointerCapture(e.pointerId);
    } catch {
      /* optional */
    }
    moveFinger(at[0], at[1], false);
  });
  svg.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const at = fromPointer(e);
    if (at) moveFinger(at[0], at[1], true);
  });
  const endDrag = () => {
    dragging = false;
  };
  svg.addEventListener("pointerup", endDrag);
  svg.addEventListener("pointercancel", endDrag);
  plan.addEventListener("keydown", (e) => {
    const dx = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    const dy = e.key === "ArrowUp" ? 1 : e.key === "ArrowDown" ? -1 : 0;
    if (dx || dy) {
      e.preventDefault();
      moveFinger(ts + dx, td + dy, false);
      return;
    }
    if ((e.key === " " || e.key === "Enter") && !reduced) {
      e.preventDefault();
      playBtn.click();
    }
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
    // the fingertip eases to where it was put
    if (Math.abs(ts - fs) > 1e-3 || Math.abs(td - fd) > 1e-3) {
      const k = 1 - Math.exp(-dt / 0.07);
      fs += (ts - fs) * k;
      fd += (td - fd) * k;
      if (Math.abs(ts - fs) < 0.01 && Math.abs(td - fd) < 0.01) {
        fs = ts;
        fd = td;
      }
      feel(fs, fd, live);
      if (speed === "real" || (reduced && taken >= TAXELS)) cur.set(live);
    }
    if (playing) advanceTo(tau + dt * SPEED[speed].rate);
    render();
    emit();
    run();
  };
  function run() {
    const moving = Math.abs(ts - fs) > 1e-3 || Math.abs(td - fd) > 1e-3;
    const want = visible && onscreen && (playing || moving);
    if (want && !raf) {
      if (!last || performance.now() - last > 100) last = performance.now();
      raf = requestAnimationFrame(tick);
    } else if (!want && raf) {
      cancelAnimationFrame(raf);
      raf = 0;
      last = 0;
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
  const ro = new ResizeObserver(() => relayout());
  ro.observe(root);
  const offTheme = ctx.onTheme(() => {
    readTheme();
    lastKey = "";
    relayout();
  });
  const mq = matchMedia("(prefers-color-scheme: dark)");
  const onMq = () => {
    readTheme();
    render(true);
  };
  mq.addEventListener("change", onMq);
  document.fonts?.ready.then(() => {
    lastKey = "";
    relayout();
  });

  // a language switch: the words, the controls, and both drawings built again with their labels in the new language
  // (the scan, the fingertip and the speed carry on)
  const offLang = ctx.onLang(() => {
    paintText(root, S(), V);
    setTextBeside(out.p, T("picture"));
    syncControls();
    lastKey = "";
    relayout();
    render(true);
  });

  syncControls();
  relayout();
  render(true);
  run();

  return {
    layout(maxH?: number) {
      // (a host's budget holds for the layouts that follow, e.g. on a resize of the card, until it gives another)
      if (maxH !== undefined) fixedMax = maxH;
      relayout();
    },
    fit(maxH: number | null) {
      fixedMax = maxH;
      lastKey = "";
      relayout();
    },
    onScan(fn) {
      subs.add(fn);
      fn(snapshot());
      return () => subs.delete(fn);
    },
    state: snapshot,
    destroy() {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      clearTimeout(sendTimer);
      subs.clear();
      ro.disconnect();
      io.disconnect();
      offTheme();
      offLang();
      mq.removeEventListener("change", onMq);
      document.removeEventListener("visibilitychange", onVis);
      root.remove();
    },
  };
}
