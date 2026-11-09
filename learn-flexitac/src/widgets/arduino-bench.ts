// Lesson 2.1's bench (PLAN-section2-basics.md §2.1): a realistic render of an Arduino Nano seated on a half-size
// breadboard, wired by three jumper wires to one round force-sensing resistor (FSR) and a 10 kΩ pull-down, with an SVG
// layer over it for everything that lights or moves. It fills the stage; the guided steps pick its form (view):
//   nano   step 1: the camera eases in on the Nano (the bench before its wires go in) and five label cards fade in, in
//          two aligned columns with horizontal leaders: USB port, microcontroller, digital pins, analog pins, power.
//          A click on a card or on the part lights both.
//   wire   step 2: the whole bench, wired. The path lights in order, 5V -> FSR -> A0 -> 10 kΩ -> GND, the column strips
//          inside the breadboard with it, and the side panel draws the same circuit small.
//   press  step 3: press and hold the FSR (drag down = harder; keyboard: Space / Enter on it, arrows for force; the
//          panel's slider): pink current flows, the panel follows force -> resistance -> volts at A0 -> analogRead, a
//          Serial Plotter strip keeps the last 10 s and the Serial Monitor prints a line per reading. The first time,
//          one gentle automatic press and release (never with reduced motion).
//   pins   step 4: the Nano's 8 analog pins lit; the panel sets 8 pins against the pad's 384 crossings.
// Pictures: public/media/bench/{light,dark}/{base,wired,nano}.webp and bench.json, rendered by
// flexitac-anatomy/figures/bench (render.mjs: Fig 3's materials and studio, an orthographic camera). bench.json gives
// each picture's box and every anchor (pins, outlines, wire centre lines, the current's path) in frame units (mm on the
// picture plane); the camera is a scale k (px per unit) and an offset. The readings: ./bench/fsr.ts (an illustrative
// FSR curve fitted to Adafruit's table; the divider and analogRead exact). Code card: run({ms}) makes the sketch's delay
// the sampling period and prints the last readings; say() repeats them in the language on show.
import { COLS, ROWS } from "@shared/data/constants.mjs";
import { lang, strings, tx } from "../i18n";
import { paintText } from "../i18n/paint";
import type { IconId, Theme, WidgetCtx, WidgetInstance } from "../types";
import { badge } from "../ui/bits";
import { icon } from "../ui/icons";
import { fmtR } from "../ui/ohms";
import { F_MAX, forceAt, MAX_CODE, readAt, type Reading } from "./bench/fsr";
import "./arduino-bench.css";

const BASE = `${import.meta.env.BASE_URL}media/bench/`;
const NS = "http://www.w3.org/2000/svg";

type Pt = [number, number];
type Box = [number, number, number, number];
interface Pic {
  src: string;
  box: Box;
  px: [number, number];
}
type Seg = "red" | "fsr" | "yellow" | "resistor" | "black";
interface Bench {
  frame: [number, number];
  content: Box;
  pictures: Record<Theme, { base: Pic; wired: Pic; nano: Pic }>;
  pins: Record<string, Pt>;
  usb: { at: Pt; hull: Pt[] };
  mcu: { at: Pt; hull: Pt[] };
  nano: { hull: Pt[] };
  fsr: { at: Pt; ring: Pt[]; active: Pt[] };
  resistor: { at: Pt; hull: Pt[] };
  path: Record<Seg, Pt[]>;
  /** hole centres by name ("25c"): columns 4, 12, 24 and 25, rows a-j */
  holes: Record<string, Pt>;
}
let benchPromise: Promise<Bench> | null = null;
function loadBench(): Promise<Bench> {
  benchPromise ??= fetch(`${BASE}bench.json`).then((r) => {
    if (!r.ok) throw new Error(`bench.json: ${r.status}`);
    return r.json() as Promise<Bench>;
  });
  return benchPromise;
}

export type View = "nano" | "wire" | "press" | "pins";
const VIEWS: View[] = ["nano", "wire", "press", "pins"];

const TAXELS = ROWS * COLS;
const AMPS_MAX = readAt(F_MAX).amps; // the hardest press the bench offers
const S = strings(
  {
    aria: "An Arduino Nano on a breadboard, wired to one force sensor and a 10 kΩ resistor",
    kicker: "Arduino Nano · one force sensor",
    "hint.nano": "Click a label or a part",
    "hint.nano.touch": "Tap a label or a part",
    "hint.press": "Press and hold the sensor · drag down to press harder",
    "hint.press.touch": "Press and hold the sensor · drag down to press harder",
    replay: "Replay",
    "replay.aria": "Light the path again",
    "card.usb.t": "USB port",
    "card.usb.s": "Power and programs in, readings out",
    "card.mcu.t": "Microcontroller",
    "card.mcu.s": "The ATmega328P runs your program",
    "card.digital.t": "Digital pins",
    "card.digital.s": "D0–D13: each one is HIGH or LOW",
    "card.analog.t": "Analog pins",
    "card.analog.s": "A0–A7: each measures 0 to 5\u00a0V",
    "card.power.t": "Power pins",
    "card.power.s": "5V and GND power your circuit",
    press: "Press",
    fsr: "FSR",
    a0: "Voltage at A0",
    code: "analogRead(A0)",
    open: "open",
    formula: "V = 5 V × 10 kΩ / (10 kΩ + R<sub>FSR</sub>)",
    plotter: "Serial Plotter",
    monitor: "Monitor",
    "fsr.aria": "The force sensor: hold Space or Enter to press it, the arrow keys press harder or lighter",
    "slider.aria": "How hard to press the force sensor",
    "pins.a": "The Nano: {n} analog pins",
    "pins.b": "One FlexiTac pad: {n} crossings",
    "pins.c": "Each crossing is a tiny force sensor. With one pin each, the {k} pins read just {k} of them.",
    "sch.aria": "The circuit: 5V, the FSR, A0 between it and the 10 kΩ resistor, then GND",
    "sch.fsr": "FSR",
    "sch.r": "10 kΩ",
  },
  {
    aria: "一块插在面包板上的 Arduino Nano，接着一个力传感器和一个 10 kΩ 电阻",
    kicker: "Arduino Nano · 一个力传感器",
    "hint.nano": "点击标签或零件",
    "hint.nano.touch": "轻点标签或零件",
    "hint.press": "按住传感器 · 往下拖表示更用力",
    "hint.press.touch": "按住传感器 · 往下拖表示更用力",
    replay: "再演示一遍",
    "replay.aria": "让电路再亮一遍",
    "card.usb.t": "USB 口",
    "card.usb.s": "电和程序从这里进来，读数从这里出去",
    "card.mcu.t": "微控制器",
    "card.mcu.s": "一颗 ATmega328P，运行你写的程序",
    "card.digital.t": "数字引脚",
    "card.digital.s": "D0–D13：每个只有 HIGH 或 LOW",
    "card.analog.t": "模拟引脚",
    "card.analog.s": "A0–A7：每个都能测 0 到 5\u00a0V 的电压",
    "card.power.t": "电源引脚",
    "card.power.s": "5V 和 GND 给你的电路供电",
    press: "按压",
    fsr: "FSR",
    a0: "A0 上的电压",
    open: "断开",
    plotter: "串口绘图器",
    monitor: "串口监视器",
    "fsr.aria": "力传感器：按住空格或回车来按压，方向键加大或减小力度",
    "slider.aria": "按压力传感器的力度",
    "pins.a": "Nano：{n} 个模拟引脚",
    "pins.b": "FlexiTac 传感垫：{n} 个交叉点",
    "pins.c": "每个交叉点都是一个小小的力传感器。一个引脚读一个，{k} 个引脚只能读其中 {k} 个。",
    "sch.aria": "电路：5V、FSR、夹在它和 10 kΩ 电阻之间的 A0，最后是 GND",
  },
);

type CardId = "usb" | "mcu" | "digital" | "analog" | "power";
const CARDS: { id: CardId; icon: IconId }[] = [
  { id: "usb", icon: "usb" },
  { id: "mcu", icon: "chip" },
  { id: "digital", icon: "pulse" },
  { id: "analog", icon: "wave" },
  { id: "power", icon: "bolt" },
];
// the pins each card lights (bench.json pins: the back row's GND / RESET carry "b", the front row's "f")
const GROUP_PINS: Record<"digital" | "analog" | "power", string[]> = {
  digital: ["D0", "D1", "D2", "D3", "D4", "D5", "D6", "D7", "D8", "D9", "D10", "D11", "D12", "D13"],
  analog: ["A0", "A1", "A2", "A3", "A4", "A5", "A6", "A7"],
  power: ["5V", "GNDf", "GNDb"],
};
// Where each card sits: the USB port and the chip in a column on the left (horizontal leaders), the digital pins above
// the Nano and the analog and power pins below it (vertical leaders), so no leader runs along or across a row of pins.
// The places never change with the language (every card keeps room for a two-line sentence, arduino-bench.css).
type Place = "left" | "top" | "bottom";
// the pins a vertical leader may land on, best first: the middle of the digital row (well away from the tall ICSP
// header at its right end), A0 (the pin this lesson reads), 5V (the one it uses)
const LEAD_PINS: Record<"digital" | "analog" | "power", string[]> = {
  digital: ["D6", "D7", "D5", "D8", "D4", "D9", "D3"],
  analog: ["A0", "A1", "A2", "A3"],
  power: ["5V", "GNDf"],
};
// where along a top or bottom card its leader may meet it (a fraction of the card's width, best first): the analog
// card reaches left of its pin and the power card right of its, so the two sit side by side
const LEAD_AT: Record<"digital" | "analog" | "power", number[]> = {
  digital: [0.5, 0.36, 0.64, 0.22, 0.78],
  analog: [0.78, 0.62, 0.9, 0.5],
  power: [0.22, 0.38, 0.1, 0.5],
};
const SEGS: { id: Seg; kind: "current" | "sense" }[] = [
  { id: "red", kind: "current" },
  { id: "fsr", kind: "current" },
  { id: "yellow", kind: "sense" },
  { id: "resistor", kind: "current" },
  { id: "black", kind: "current" },
];

// the breadboard strips the step-2 path lights as a whole (five joined holes each), and the segment that lights each:
// the 5 V strip where the red wire meets the FSR, the A0 strip where the FSR, the yellow wire and the resistor meet
// (teal, held for a beat), and the ground strip where the resistor meets the black wire
const STRIPS: { id: string; from: string; to: string; kind: "current" | "sense"; after: Seg }[] = [
  { id: "s24", from: "24a", to: "24e", kind: "current", after: "red" },
  { id: "s25", from: "25a", to: "25e", kind: "sense", after: "fsr" },
  { id: "s25g", from: "25f", to: "25j", kind: "current", after: "resistor" },
];

const CAM_MS = 720;
const SEG_MS = 560;
// when each segment starts lighting (ms): one after another, with a beat on the A0 strip before the yellow wire
const SEG_T0: Record<Seg, number> = { red: 0, fsr: 700, yellow: 1950, resistor: 2650, black: 3350 };
const SEQ_MS = SEG_T0.black + SEG_MS + 200;
const WINDOW_S = 10; // the plotter's span
const MON_LINES = 30; // (the monitor's box shows as many as fit, the newest at the bottom, the oldest fading out)
const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
const svg = <K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}): SVGElementTagNameMap[K] => {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
};
const pathD = (pts: Pt[]) => pts.map((p, i) => `${i ? "L" : "M"}${p[0]},${p[1]}`).join("");
const polyPts = (pts: Pt[]) => pts.map((p) => `${p[0]},${p[1]}`).join(" ");

export function mount(el: HTMLElement, ctx: WidgetCtx): WidgetInstance {
  const reduced = ctx.reducedMotion();
  const root = document.createElement("div");
  root.className = "w-bench";
  root.dataset.view = "nano";
  root.setAttribute("role", "group");
  root.dataset.tAria = "aria";
  root.classList.toggle("is-reduced", reduced);
  root.innerHTML = `
    <div class="wb-stage">
      <div class="wb-cam">
        <img class="wb-img wb-base" alt="" decoding="async" draggable="false">
        <img class="wb-img wb-nano" alt="" decoding="async" draggable="false">
        <img class="wb-img wb-wired" alt="" decoding="async" draggable="false">
        <svg class="wb-ov" aria-hidden="true"></svg>
      </div>
      <svg class="wb-leads" aria-hidden="true"></svg>
      <div class="wb-cards"></div>
      <button type="button" class="wb-hit" data-t-aria="fsr.aria" aria-pressed="false"></button>
      <p class="wb-kicker mono" data-t="kicker"></p>
      <div class="wb-foot">
        <p class="wb-hint"></p>
        <button type="button" class="wb-replay" data-t="replay" data-t-aria="replay.aria"></button>
      </div>
    </div>
    <aside class="wb-panel">
      <section class="wb-sec wb-chain">
        <div class="wb-row wb-row-press" data-k="force"><span class="wb-lab"><span data-t="press"></span><span class="wb-badge"></span></span><b class="wb-val"></b><input type="range" min="0" max="100" step="1" value="0" data-t-aria="slider.aria"></div>
        <div class="wb-row" data-k="ohms"><span class="wb-lab" data-t="fsr"></span><b class="wb-val"></b></div>
        <div class="wb-row" data-k="volts"><span class="wb-lab" data-t="a0"></span><b class="wb-val"></b></div>
        <div class="wb-row wb-row-code" data-k="code"><span class="wb-lab"><code data-t="code"></code></span><b class="wb-val"></b></div>
        <div class="wb-bar" aria-hidden="true"><i></i></div>
      </section>
      <section class="wb-sec wb-schem"></section>
      <p class="wb-sec wb-formula mono" data-t="formula"></p>
      <section class="wb-sec wb-serial">
        <div class="wb-plot"><p class="wb-cap mono" data-t="plotter"></p><div class="wb-plot-box"><span class="wb-ax wb-ax-hi mono">${MAX_CODE}</span><span class="wb-ax wb-ax-lo mono">0</span><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path class="wb-grid" d="M0,0.5H100M0,50H100M0,99.5H100"/><polyline class="wb-trace" points=""/></svg></div></div>
        <div class="wb-mon"><p class="wb-cap mono" data-t="monitor"></p><ol class="mono"></ol></div>
      </section>
      <section class="wb-sec wb-pinsfig"></section>
    </aside>`;
  el.append(root);
  const $ = <T extends Element>(sel: string) => root.querySelector<T>(sel)!;
  const stageEl = $<HTMLElement>(".wb-stage");
  const camEl = $<HTMLElement>(".wb-cam");
  const imgs = { base: $<HTMLImageElement>(".wb-base"), nano: $<HTMLImageElement>(".wb-nano"), wired: $<HTMLImageElement>(".wb-wired") };
  const ov = $<SVGSVGElement>(".wb-ov");
  const leads = $<SVGSVGElement>(".wb-leads");
  const cardsEl = $<HTMLElement>(".wb-cards");
  const hit = $<HTMLButtonElement>(".wb-hit");
  const hintEl = $<HTMLElement>(".wb-hint");
  const replayBtn = $<HTMLButtonElement>(".wb-replay");
  const slider = $<HTMLInputElement>(".wb-row-press input");
  const trace = $<SVGPolylineElement>(".wb-trace");
  const monList = $<HTMLOListElement>(".wb-mon ol");

  let data: Bench | null = null;
  let view: View = "nano";
  let theme: Theme = ctx.theme();
  let alive = true;
  const coarse = matchMedia("(hover: none)");

  // ---------------------------------------------------------------------------------------- words
  const paintWords = () => {
    paintText(root, S());
    $<HTMLElement>(".wb-badge").innerHTML = badge("illustrative");
    const touch = coarse.matches;
    hintEl.textContent = view === "nano" ? S()[touch ? "hint.nano.touch" : "hint.nano"] : view === "press" ? S()[touch ? "hint.press.touch" : "hint.press"] : view === "wire" ? "5V → FSR → A0 → 10 kΩ → GND" : "";
    for (const c of CARDS) {
      const card = cardsEl.querySelector<HTMLElement>(`[data-card="${c.id}"]`);
      if (!card) continue;
      card.querySelector("b")!.textContent = S()[`card.${c.id}.t` as const];
      card.querySelector(".wb-card-line")!.textContent = S()[`card.${c.id}.s` as const];
    }
    paintPins();
    paintReadout(true);
  };

  // ---------------------------------------------------------------------------------------- the camera
  // cam: screen = (ox + u * k, oy + v * k) in the stage's px, u/v in frame units
  interface Cam {
    ox: number;
    oy: number;
    k: number;
  }
  let cam: Cam = { ox: 0, oy: 0, k: 1 };
  let camFrom: Cam | null = null;
  let camTo: Cam = cam;
  let camT0 = 0;
  let size = { w: 0, h: 0 };
  const panelW = () => Math.round(clamp(size.w * 0.28, 236, 312));
  const narrow = () => size.w < 620;
  // the bench's room in the stage's px: all of it for the Nano, beside the panel after (under it when narrow)
  const area = (v: View) => (narrow() ? { w: stageEl.clientWidth, h: stageEl.clientHeight } : { w: v === "nano" ? size.w : size.w - panelW(), h: size.h });
  const PAD = 16;
  const colW = () => Math.round(clamp(size.w * 0.22, 170, 214));
  const bbox = (pts: Pt[]): Box => [Math.min(...pts.map((p) => p[0])), Math.min(...pts.map((p) => p[1])), Math.max(...pts.map((p) => p[0])), Math.max(...pts.map((p) => p[1]))];
  const target = (v: View): Cam => {
    const d = data!;
    const a = area(v);
    if (v === "nano") {
      // (at most half the stage wide, so calm stage shows round it; room on the left for the cards' column and above
      // and below for the pin cards)
      const [x0, y0, x1, y1] = bbox(d.nano.hull);
      const room = Math.min(a.w - 2 * (PAD + colW() + 18), a.w * 0.5);
      const k = Math.max(1, Math.min(room / (x1 - x0), (a.h - 2 * 124) / (y1 - y0)));
      return { k, ox: a.w / 2 - ((x0 + x1) / 2) * k, oy: a.h / 2 + 4 - ((y0 + y1) / 2) * k };
    }
    const [x0, y0, x1, y1] = d.content;
    const top = 38;
    const bottom = 44;
    const k = Math.max(1, Math.min((a.w - 2 * 22) / (x1 - x0), (a.h - top - bottom) / (y1 - y0)));
    if (v === "pins") {
      // the Nano closer (at most 1.6 times the whole bench's scale), its analog row in plain view
      const [n0, m0, n1, m1] = bbox(d.nano.hull);
      const kp = Math.max(1, Math.min((a.w - 2 * 40) / (n1 - n0 + 8), (a.h - 110) / (m1 - m0 + 8), k * 1.6));
      return { k: kp, ox: a.w / 2 - ((n0 + n1) / 2) * kp, oy: a.h / 2 - ((m0 + m1) / 2) * kp };
    }
    return { k, ox: a.w / 2 - ((x0 + x1) / 2) * k, oy: top + (a.h - top - bottom) / 2 - ((y0 + y1) / 2) * k };
  };
  const applyCam = () => {
    if (!data) return;
    const [W, H] = data.frame;
    camEl.style.left = `${cam.ox.toFixed(2)}px`;
    camEl.style.top = `${cam.oy.toFixed(2)}px`;
    camEl.style.width = `${(W * cam.k).toFixed(2)}px`;
    camEl.style.height = `${(H * cam.k).toFixed(2)}px`;
    root.style.setProperty("--wb-k", cam.k.toFixed(3));
  };
  const toScreen = (p: Pt): Pt => [cam.ox + p[0] * cam.k, cam.oy + p[1] * cam.k];

  // ---------------------------------------------------------------------------------------- pictures
  const placeImg = (img: HTMLImageElement, pic: Pic, feather: number) => {
    const [W, H] = data!.frame;
    const [u0, v0, u1, v1] = pic.box;
    img.style.left = `${(u0 / W) * 100}%`;
    img.style.top = `${(v0 / H) * 100}%`;
    img.style.width = `${((u1 - u0) / W) * 100}%`;
    img.style.height = `${((v1 - v0) / H) * 100}%`;
    // a soft edge, so a picture laid over another never shows its rectangle
    img.style.setProperty("--fx", `${((feather / (u1 - u0)) * 100).toFixed(2)}%`);
    img.style.setProperty("--fy", `${((feather / (v1 - v0)) * 100).toFixed(2)}%`);
  };
  const loadPics = (t: Theme) => {
    if (!data) return;
    const set = data.pictures[t];
    const parts = [
      [imgs.base, set.base, 3.5],
      [imgs.nano, set.nano, 2.2],
      [imgs.wired, set.wired, 1.2],
    ] as const;
    // swap only once the new pictures have decoded: no blank frame on a theme switch
    const fresh = parts.map(([, pic]) => {
      const im = new Image();
      im.decoding = "async";
      im.src = BASE + pic.src;
      return im.decode().catch(() => undefined).then(() => im.src);
    });
    void Promise.all(fresh).then((srcs) => {
      if (!alive || theme !== t) return;
      parts.forEach(([img, pic, f], i) => {
        placeImg(img, pic, f);
        img.src = srcs[i];
      });
      root.classList.add("is-ready");
    });
  };

  // ---------------------------------------------------------------------------------------- overlays (frame units)
  const g = (cls: string) => {
    const el = svg("g", { class: cls });
    ov.append(el);
    return el;
  };
  let gSegs: SVGGElement;
  let gFlow: SVGGElement;
  let gPress: SVGGElement;
  let gHot: SVGGElement;
  let gPins: SVGGElement;
  const segEls: Partial<Record<Seg, { glow: SVGPathElement; core: SVGPathElement; len: number }>> = {};
  const stripEls: Partial<Record<string, SVGPathElement>> = {};
  let flowPath: SVGPathElement;
  let flowHalo: SVGPathElement;
  let flowOff = 0;
  let sensePath: SVGPathElement;
  let senseStrip: SVGPathElement;
  let pressGlow: SVGPolygonElement;
  let pressRing: SVGPolygonElement;
  const hot: Partial<Record<CardId, SVGElement>> = {};
  // (a strip of five joined holes as one soft capsule, frame units)
  const strip = (from: string, to: string, cls: string) => svg("path", { d: pathD([data!.holes[from], data!.holes[to]]), class: cls });
  const inside = (p: Pt, poly: Pt[]) => {
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i];
      const [xj, yj] = poly[j];
      if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) c = !c;
    }
    return c;
  };
  // the FSR's path from the top of its tail's curl on the pin-1 side to the top on the pin-2 side (the highest point of
  // each half, on screen)
  const fsrVisible = (path: Pt[]): Pt[] => {
    const half = Math.floor(path.length / 2);
    let i0 = 0;
    let i1 = path.length - 1;
    for (let i = 0; i < half; i++) if (path[i][1] < path[i0][1]) i0 = i;
    for (let i = path.length - 1; i >= half; i--) if (path[i][1] < path[i1][1]) i1 = i;
    return path.slice(i0, i1 + 1);
  };
  const buildOverlay = () => {
    const d = data!;
    const [W, H] = d.frame;
    ov.setAttribute("viewBox", `0 0 ${W} ${H}`);
    ov.innerHTML = `<defs><radialGradient id="wb-press-grad"><stop offset="0" stop-color="var(--ft-signal)" stop-opacity=".75"/><stop offset=".7" stop-color="var(--ft-signal)" stop-opacity=".28"/><stop offset="1" stop-color="var(--ft-signal)" stop-opacity="0"/></radialGradient></defs>`;
    // step 2: the path, one segment after another (a soft glow under a thin bright line). Inside the breadboard a
    // segment stops at its strip, and the strip lights as one capsule (the five holes it joins)
    gSegs = g("wb-segs");
    for (const st of STRIPS) {
      const el = strip(st.from, st.to, `wb-strip wb-strip-${st.kind}`);
      el.dataset.strip = st.id;
      gSegs.append(el);
      stripEls[st.id] = el;
    }
    // (the FSR's traces only where the picture shows them: from the top of the tail's curl on one side, down to the disc
    // and back up to the top of the curl on the other. Where they rise out of the crimps they are hidden behind the curl)
    const fsrV = fsrVisible(d.path.fsr);
    const trim: Record<Seg, Pt[]> = {
      red: d.path.red.slice(0, -1), // (to 24c, where the wire goes in)
      fsr: fsrV,
      yellow: d.path.yellow.slice(1), // (from 25c)
      resistor: d.path.resistor.slice(1), // (from 25e)
      black: d.path.black.slice(1), // (from 25j)
    };
    for (const s of SEGS) {
      const sg = svg("g", { class: `wb-seg wb-seg-${s.kind}`, "data-seg": s.id });
      const dd = pathD(trim[s.id]);
      const glow = svg("path", { d: dd, class: "wb-seg-glow" });
      const core = svg("path", { d: dd, class: "wb-seg-core" });
      sg.append(glow, core);
      gSegs.append(sg);
      segEls[s.id] = { glow, core, len: 0 };
    }
    // step 3: the current (pink beads round the loop: down one trace of the FSR's tail, into the middle of the disc and
    // back up the other) and the listened-to branch (teal: the A0 strip and the yellow wire)
    gFlow = g("wb-flow");
    const fsrLoop: Pt[] = [];
    for (const p of fsrV) {
      if (!inside(p, d.fsr.ring)) fsrLoop.push(p);
      else if (fsrLoop[fsrLoop.length - 1] !== d.fsr.at) fsrLoop.push(d.fsr.at);
    }
    // 5V, the red wire to 24c, over the curl and down the tail, through the disc, back up and into the A0 strip at 25c,
    // along it to the resistor, across to the ground strip, the black wire, GND
    const loop: Pt[] = [...d.path.red.slice(0, -1), ...fsrLoop, d.holes["25c"], ...d.path.resistor.slice(1), ...d.path.black];
    senseStrip = strip("25a", "25e", "wb-sense-strip");
    sensePath = svg("path", { d: pathD(d.path.yellow.slice(1)), class: "wb-sense" });
    flowHalo = svg("path", { d: pathD(loop), class: "wb-dots-halo" });
    flowPath = svg("path", { d: pathD(loop), class: "wb-dots" });
    gFlow.append(senseStrip, sensePath, flowHalo, flowPath);
    // the press: a pink glow over the sensing area, and a ring round the disc that says "press here"
    gPress = g("wb-press");
    pressGlow = svg("polygon", { points: polyPts(d.fsr.active), class: "wb-press-glow", fill: "url(#wb-press-grad)" });
    pressRing = svg("polygon", { points: polyPts(d.fsr.ring), class: "wb-press-ring" });
    gPress.append(pressGlow, pressRing);
    // step 4: the 8 analog pins
    gPins = g("wb-pins");
    for (const id of GROUP_PINS.analog) {
      const [x, y] = d.pins[id];
      gPins.append(svg("circle", { cx: x, cy: y, r: 0.95, class: id === "A0" ? "wb-pin is-used" : "wb-pin" }));
    }
    // step 1: the parts, pickable (an outline for the USB port and the chip, a ring per pin for the pin groups)
    gHot = g("wb-hot");
    const part = (id: CardId, el: SVGElement) => {
      el.setAttribute("data-card", id);
      gHot.append(el);
      hot[id] = el;
    };
    part("usb", svg("polygon", { points: polyPts(d.usb.hull), class: "wb-hot-shape" }));
    part("mcu", svg("polygon", { points: polyPts(d.mcu.hull), class: "wb-hot-shape" }));
    for (const id of ["digital", "analog", "power"] as const) {
      const grp = svg("g", { class: "wb-hot-pins" });
      for (const p of GROUP_PINS[id]) {
        const [x, y] = d.pins[p];
        grp.append(svg("circle", { cx: x, cy: y, r: 1.2 }));
      }
      part(id, grp);
    }
  };
  const measureSegs = () => {
    for (const s of SEGS) {
      const e = segEls[s.id];
      if (!e) continue;
      e.len = e.core.getTotalLength();
      for (const p of [e.glow, e.core]) p.style.strokeDasharray = `${e.len} ${e.len}`;
    }
  };

  // ---------------------------------------------------------------------------------------- label cards (step 1)
  let picked: CardId | null = null;
  let hovered: CardId | null = null;
  const cardEls: Partial<Record<CardId, HTMLButtonElement>> = {};
  for (const c of CARDS) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "wb-card";
    b.dataset.card = c.id;
    b.setAttribute("aria-pressed", "false");
    b.innerHTML = `<span class="wb-card-icon">${icon(c.icon)}</span><b></b><span class="wb-card-line"></span>`;
    cardsEl.append(b);
    cardEls[c.id] = b;
  }
  const paintPick = () => {
    for (const c of CARDS) {
      const on = picked === c.id;
      cardEls[c.id]!.classList.toggle("is-pick", on);
      cardEls[c.id]!.classList.toggle("is-hover", hovered === c.id && !on);
      cardEls[c.id]!.classList.toggle("is-dim", Boolean(picked) && !on);
      cardEls[c.id]!.setAttribute("aria-pressed", String(on));
      hot[c.id]?.classList.toggle("is-pick", on);
      hot[c.id]?.classList.toggle("is-hover", hovered === c.id && !on);
    }
    leads.querySelectorAll<SVGGElement>("[data-card]").forEach((l) => {
      l.classList.toggle("is-pick", l.dataset.card === picked);
      l.classList.toggle("is-dim", Boolean(picked) && l.dataset.card !== picked);
    });
  };
  const pick = (id: CardId | null) => {
    picked = picked === id ? null : id;
    paintPick();
  };
  cardsEl.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>("[data-card]");
    if (b) pick(b.dataset.card as CardId);
  });
  cardsEl.addEventListener("pointerover", (e) => {
    hovered = ((e.target as HTMLElement).closest<HTMLElement>("[data-card]")?.dataset.card as CardId) ?? null;
    paintPick();
  });
  cardsEl.addEventListener("pointerleave", () => {
    hovered = null;
    paintPick();
  });
  ov.addEventListener("click", (e) => {
    if (view !== "nano") return;
    const t = (e.target as Element).closest("[data-card]");
    pick(t ? (t.getAttribute("data-card") as CardId) : null);
  });
  ov.addEventListener("pointerover", (e) => {
    if (view !== "nano") return;
    hovered = ((e.target as Element).closest("[data-card]")?.getAttribute("data-card") as CardId) ?? null;
    paintPick();
  });
  ov.addEventListener("pointerout", () => {
    if (hovered) {
      hovered = null;
      paintPick();
    }
  });
  // ---- placing them (screen px of the stage). Every leader is straight and level or upright: from the left column to
  // the USB port's or the chip's left edge, or straight down (or up) from a card to one pin of its group.
  interface Laid {
    id: CardId;
    place: Place;
    x: number;
    y: number;
    w: number;
    h: number;
    /** from the card's edge to the dot on the part */
    lead: [Pt, Pt];
    cost: number;
  }
  // the USB port and the chip: the outline's left edge at each height
  const edgeAnchors = (id: "usb" | "mcu"): Pt[] => {
    const hull = data![id].hull.map(toScreen);
    const [, y0, , y1] = bbox(hull);
    const out: Pt[] = [];
    for (let y = Math.ceil(y0 + 3); y <= y1 - 3; y += 2) {
      let best: number | null = null;
      for (let i = 0; i < hull.length; i++) {
        const a = hull[i];
        const b = hull[(i + 1) % hull.length];
        if ((a[1] - y) * (b[1] - y) > 0 || a[1] === b[1]) continue;
        const x = a[0] + ((y - a[1]) / (b[1] - a[1])) * (b[0] - a[0]);
        if (best === null || x < best) best = x;
      }
      if (best !== null) out.push([best + 2.5, y]);
    }
    return out;
  };
  // the Nano's outline over a stretch of the stage: its highest top and lowest bottom between x0 and x1 (null: none)
  const hullSpan = (x0: number, x1: number): [number, number] | null => {
    const hull = data!.nano.hull.map(toScreen);
    let top = Infinity;
    let bot = -Infinity;
    const at = (x: number) => {
      for (let i = 0; i < hull.length; i++) {
        const a = hull[i];
        const b = hull[(i + 1) % hull.length];
        if ((a[0] - x) * (b[0] - x) > 0 || a[0] === b[0]) continue;
        const y = a[1] + ((x - a[0]) / (b[0] - a[0])) * (b[1] - a[1]);
        top = Math.min(top, y);
        bot = Math.max(bot, y);
      }
    };
    for (let x = x0; x <= x1; x += 4) at(x);
    at(x1);
    for (const [x, y] of hull)
      if (x >= x0 && x <= x1) {
        top = Math.min(top, y);
        bot = Math.max(bot, y);
      }
    return Number.isFinite(top) ? [top, bot] : null;
  };
  // (a level or upright leader through a card, or two leaders crossing; a little slack round each card)
  const hitsCard = ([p, q]: [Pt, Pt], r: Laid) => {
    const [xa, xb] = [Math.min(p[0], q[0]), Math.max(p[0], q[0])];
    const [ya, yb] = [Math.min(p[1], q[1]), Math.max(p[1], q[1])];
    return xa < r.x + r.w + 3 && xb > r.x - 3 && ya < r.y + r.h + 3 && yb > r.y - 3;
  };
  const leadsCross = (l: [Pt, Pt], m: [Pt, Pt]) => {
    const box = (s: [Pt, Pt]) => [Math.min(s[0][0], s[1][0]), Math.min(s[0][1], s[1][1]), Math.max(s[0][0], s[1][0]), Math.max(s[0][1], s[1][1])];
    const [a0, b0, a1, b1] = box(l);
    const [c0, d0, c1, d1] = box(m);
    return a0 <= c1 + 4 && c0 <= a1 + 4 && b0 <= d1 + 4 && d0 <= b1 + 4;
  };
  const apart = (r: Laid, o: Laid) =>
    !(r.x < o.x + o.w + 8 && o.x < r.x + r.w + 8 && r.y < o.y + o.h + 8 && o.y < r.y + r.h + 8) && !hitsCard(r.lead, o) && !hitsCard(o.lead, r) && !leadsCross(r.lead, o.lead);
  // a pin as a small disc a little below its top: what a level leader keeps clear of
  const pinClear = (y: number, xa: number, xb: number) =>
    Object.values(data!.pins).every((p) => {
      const [x, py] = toScreen(p);
      const cy = py + 0.2 * cam.k;
      const r = 0.85 * cam.k + 3;
      return x < xa - r || x > xb + r || Math.abs(cy - y) >= r;
    });
  // the left column, close to the Nano: the USB port and the chip, in order, apart, each leader short and near the
  // part's middle
  const solveLeft = (w: number, topY: number, botY: number): Laid[] | null => {
    const GAP = 8;
    const x = Math.max(PAD, bbox(data!.nano.hull.map(toScreen))[0] - 22 - w);
    const edge = x + w;
    const list = (["usb", "mcu"] as const).map((id) => ({
      id,
      h: cardEls[id]!.offsetHeight,
      nice: toScreen(data![id].at)[1],
      cand: edgeAnchors(id).filter((p) => pinClear(p[1], edge, p[0] - 4)),
    }));
    list.sort((p, q) => p.nice - q.nice);
    const cost = (it: (typeof list)[number], p: Pt) => Math.abs(p[1] - it.nice) * 1.4 + Math.abs(p[0] - edge) * 0.3;
    let best: Pt[] | null = null;
    let bestCost = Infinity;
    const pickAt = (i: number, prevY: number, acc: number, chosen: Pt[]) => {
      if (acc >= bestCost) return;
      if (i === list.length) {
        best = chosen.slice();
        bestCost = acc;
        return;
      }
      const it = list[i];
      const lo = i ? prevY + (list[i - 1].h + it.h) / 2 + GAP : topY + it.h / 2;
      for (const p of it.cand) {
        if (p[1] < lo || p[1] > botY - it.h / 2) continue;
        chosen.push(p);
        pickAt(i + 1, p[1], acc + cost(it, p), chosen);
        chosen.pop();
      }
    };
    pickAt(0, 0, 0, []);
    const found = best as Pt[] | null;
    if (!found) return null;
    return list.map((it, i) => ({ id: it.id, place: "left" as const, x, y: found[i][1] - it.h / 2, w, h: it.h, lead: [[edge, found[i][1]], found[i]] as [Pt, Pt], cost: cost(it, found[i]) }));
  };
  // a card above or below the Nano: every pin it may point at, every place along it the leader may meet it
  const solveUpright = (id: "digital" | "analog" | "power", place: "top" | "bottom", a: { w: number; h: number }, w: number, topY: number, botY: number): Laid[] => {
    const h = cardEls[id]!.offsetHeight;
    const out: Laid[] = [];
    LEAD_PINS[id].forEach((pin, rank) => {
      const [px, py] = toScreen(data!.pins[pin]);
      LEAD_AT[id].forEach((f, j) => {
        const x = clamp(px - f * w, PAD, a.w - PAD - w);
        const at = px - x;
        if (at < 18 || at > w - 18) return;
        const span = hullSpan(x - 8, x + w + 8);
        let y: number;
        if (place === "top") {
          y = Math.min(py - 22, (span ? span[0] : py) - 10) - h;
          if (y < topY) return;
        } else {
          y = Math.max(py + 22, (span ? span[1] : py) + 10);
          if (y + h > botY) return;
        }
        const from: Pt = [px, place === "top" ? y + h : y];
        out.push({ id, place, x, y, w, h, lead: [from, [px, py]], cost: Math.abs(from[1] - py) + rank * 40 + j * 6 });
      });
    });
    return out.sort((p, q) => p.cost - q.cost);
  };
  const solveAll = (a: { w: number; h: number }, w: number): Laid[] | null => {
    const topY = 40;
    const botY = a.h - 46;
    const left = solveLeft(w, topY, botY);
    if (!left) return null;
    const top = solveUpright("digital", "top", a, w, topY, botY).find((c) => left.every((o) => apart(c, o)));
    if (!top) return null;
    const placed = [...left, top];
    const an = solveUpright("analog", "bottom", a, w, topY, botY).filter((c) => placed.every((o) => apart(c, o)));
    const pw = solveUpright("power", "bottom", a, w, topY, botY).filter((c) => placed.every((o) => apart(c, o)));
    let pair: [Laid, Laid] | null = null;
    for (const p of an)
      for (const q of pw)
        if ((!pair || p.cost + q.cost < pair[0].cost + pair[1].cost) && apart(p, q)) pair = [p, q];
    return pair ? [...placed, ...pair] : null;
  };
  const layoutCards = () => {
    leads.innerHTML = "";
    if (!data || view !== "nano" || camFrom) return;
    const a = area("nano");
    const w = colW();
    for (const c of CARDS) cardEls[c.id]!.style.width = `${w}px`;
    // every card with its sentence; failing that, icon and title only; failing that, each at its own best
    let got: Laid[] | null = null;
    for (const short of [false, true]) {
      cardsEl.toggleAttribute("data-short", short);
      got = solveAll(a, w);
      if (got) break;
    }
    if (!got) {
      const left = solveLeft(w, 0, a.h) ?? [];
      const one = (id: "digital" | "analog" | "power", place: "top" | "bottom") => solveUpright(id, place, a, w, 0, a.h)[0];
      got = [...left, one("digital", "top"), one("analog", "bottom"), one("power", "bottom")].filter(Boolean);
    }
    for (const it of got) {
      const el = cardEls[it.id]!;
      el.style.transform = `translate(${it.x.toFixed(1)}px, ${it.y.toFixed(1)}px)`;
      el.dataset.side = it.place;
      const delay = `${(CARDS.findIndex((c) => c.id === it.id) * 70).toFixed(0)}ms`;
      el.style.setProperty("--wb-delay", delay);
      const [p, q] = it.lead;
      const dd = `M${p[0].toFixed(1)},${p[1].toFixed(1)}L${q[0].toFixed(1)},${q[1].toFixed(1)}`;
      const lg = svg("g", { class: "wb-lead", "data-card": it.id, style: `--wb-delay: ${delay}` });
      lg.append(svg("path", { d: dd, class: "wb-lead-halo" }), svg("path", { d: dd, class: "wb-lead-line" }), svg("circle", { cx: q[0], cy: q[1], r: 3.2, class: "wb-lead-end" }));
      leads.append(lg);
    }
    paintPick();
  };

  // ---------------------------------------------------------------------------------------- the panel's drawings
  const schem = $<HTMLElement>(".wb-schem");
  schem.innerHTML = `<svg viewBox="38 4 132 166" role="img" data-t-aria="sch.aria">
      <g class="wb-sch-base">
        <path d="M62 17.2V34l-7 2.67 14 5.33-14 5.33 14 5.34-14 5.33 14 5.33L62 66V138l-7-2.67 14-5.33-14-5.33 14-5.34-14-5.33 14-5.33L62 106"/>
        <path d="M46 60 78 40M72.6 39.6 78 40l-2.2 4.8"/>
        <path d="M62 138V150M50 150H74M54.5 155.5H69.5M59 161H65"/>
        <path d="M62 86H136"/>
        <circle cx="62" cy="14" r="3.2"/>
        <circle cx="139.5" cy="86" r="3.2"/>
        <circle cx="62" cy="86" r="2.6" class="wb-sch-node"/>
      </g>
      <g class="wb-sch-seg" data-seg="red"><path d="M62 17.2V34"/></g>
      <g class="wb-sch-seg" data-seg="fsr"><path d="M62 34l-7 2.67 14 5.33-14 5.33 14 5.34-14 5.33 14 5.33L62 66V86"/><path d="M46 60 78 40M72.6 39.6 78 40l-2.2 4.8"/></g>
      <g class="wb-sch-seg wb-sch-sense" data-seg="yellow"><path d="M62 86H136"/></g>
      <g class="wb-sch-seg" data-seg="resistor"><path d="M62 86V106l-7 2.67 14 5.33-14 5.33 14 5.34-14 5.33 14 5.33L62 138"/></g>
      <g class="wb-sch-seg" data-seg="black"><path d="M62 138V150"/><path d="M50 150H74M54.5 155.5H69.5M59 161H65"/></g>
      <g class="wb-sch-text mono">
        <text x="70" y="17">5V</text>
        <text x="80" y="54" data-t="sch.fsr">FSR</text>
        <text x="148" y="90">A0</text>
        <text x="76" y="125" data-t="sch.r">10 kΩ</text>
        <text x="72" y="164">GND</text>
      </g>
    </svg>`;
  // step 4: the Nano's 8 analog pins over the pad's 384 crossings, each pin joined to the one crossing it could read
  const paintPins = () => {
    const fig = $<HTMLElement>(".wb-pinsfig");
    const G = 44; // where the grid starts (viewBox units: 5 per cell)
    const col = (i: number) => Math.round(1 + (i * 29) / 7); // the column under pin i
    let pins = "";
    for (let i = 0; i < 8; i++) {
      const x = col(i) * 5 + 2;
      pins += `<text x="${x}" y="7" class="mono">A${i}</text><path d="M${x},22.6V${G - 0.8}" class="wb-pins-line"/><circle cx="${x}" cy="17" r="5"/>`;
    }
    const lit = new Set(Array.from({ length: 8 }, (_, i) => col(i)));
    const cells: string[] = [];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) cells.push(`<rect x="${c * 5}" y="${G + r * 5}" width="4" height="4" rx=".6"${r === 0 && lit.has(c) ? ' class="is-read"' : ""}/>`);
    fig.innerHTML = `
      <p class="wb-pins-cap">${S()["pins.a"].replace("{n}", "8")}</p>
      <svg class="wb-pins-fig" viewBox="-1 0 162 ${G + ROWS * 5}" aria-hidden="true">${pins}${cells.join("")}</svg>
      <p class="wb-pins-cap wb-pins-cap-b">${S()["pins.b"].replace("{n}", String(TAXELS))}</p>
      <p class="wb-pins-note">${S()["pins.c"].replace(/\{k\}/g, "8")}</p>`;
  };

  // ---------------------------------------------------------------------------------------- the readings
  let level = 0.42; // how hard the next press is, 0..1 (forceAt: 0.2..20 N)
  let pressActive = false; // a pointer or a key holds the FSR now
  let holdLevel = 0; // the panel's slider (0 = not pressed)
  let force = 0; // N, eased toward the target
  let pressedOnce = false;
  let demo: { t0: number } | null = null;
  let demoDone = false;
  const pressedNow = () => pressActive || holdLevel > 0 || (Boolean(demo) && demoLevel() > 0.001);
  const levelNow = () => (pressActive ? level : holdLevel > 0 ? holdLevel : demo ? demoLevel() : level);
  let rd: Reading = readAt(0);
  const fmtF = (f: number) => (f >= 10 ? `${Math.round(f)} N` : `${f.toFixed(1)} N`);
  const rows = {
    force: $<HTMLElement>('[data-k="force"] .wb-val'),
    ohms: $<HTMLElement>('[data-k="ohms"] .wb-val'),
    volts: $<HTMLElement>('[data-k="volts"] .wb-val'),
    code: $<HTMLElement>('[data-k="code"] .wb-val'),
  };
  const bar = $<HTMLElement>(".wb-bar i");
  let shown = "";
  const paintReadout = (force_ = false) => {
    const key = `${rd.code}|${rd.force.toFixed(2)}|${lang()}`;
    if (key === shown && !force_) return;
    shown = key;
    rows.force.textContent = rd.force > 0 ? fmtF(rd.force) : "0 N";
    rows.ohms.textContent = Number.isFinite(rd.ohms) ? fmtR(rd.ohms) : `${S().open} · > 10 MΩ`;
    rows.volts.textContent = `${rd.volts.toFixed(2)} V`;
    rows.code.textContent = String(rd.code);
    bar.style.transform = `scaleX(${(rd.code / MAX_CODE).toFixed(4)})`;
    const on = pressedNow();
    // (the slider follows a press on the bench; while it is dragged, it is the press)
    if (document.activeElement !== slider) slider.value = String(on ? Math.max(1, Math.round(levelNow() * 100)) : 0);
    hit.setAttribute("aria-pressed", String(on));
  };

  // the Serial Plotter and Monitor: one reading every `delayMs` of the sketch (the code card's delay), noise of +-1
  // count while pressed (a real ADC's last bit flickers)
  let delayMs = 100;
  let simT = 0; // s, runs only while the press view is on
  let acc = 0;
  const samples: { t: number; v: number }[] = [];
  const monitor: number[] = [];
  const sample = () => {
    const v = rd.code > 0 ? clamp(rd.code + Math.round((Math.random() - 0.5) * 2.2), 0, MAX_CODE) : 0;
    samples.push({ t: simT, v });
    while (samples.length && samples[0].t < simT - WINDOW_S - 1) samples.shift();
    monitor.push(v);
    if (monitor.length > 64) monitor.shift();
  };
  const paintSerial = () => {
    const t0 = simT - WINDOW_S;
    trace.setAttribute("points", samples.filter((s) => s.t >= t0 - 0.2).map((s) => `${(((s.t - t0) / WINDOW_S) * 100).toFixed(2)},${(100 - (s.v / MAX_CODE) * 100).toFixed(2)}`).join(" "));
    const last = monitor.slice(-MON_LINES);
    monList.innerHTML = last.map((v) => `<li>${v}</li>`).join("");
  };

  // ---------------------------------------------------------------------------------------- views
  let seqT0 = -1; // the wire view's lighting sequence (ms, performance.now)
  const setSeg = (id: Seg, p: number) => {
    const e = segEls[id];
    if (!e) return;
    const off = `${(e.len * (1 - p)).toFixed(2)}`;
    e.glow.style.strokeDashoffset = off;
    e.core.style.strokeDashoffset = off;
    // (hidden until it starts: a round cap would otherwise leave a dot at its start)
    e.glow.style.visibility = e.core.style.visibility = p > 0.001 ? "" : "hidden";
    schem.querySelector(`[data-seg="${id}"]`)?.classList.toggle("is-lit", p > 0.05);
    // (a strip lights once the segment that reaches it has)
    for (const st of STRIPS) if (st.after === id) stripEls[st.id]?.classList.toggle("is-lit", p >= 0.98);
  };
  const startSeq = () => {
    if (reduced) {
      for (const s of SEGS) setSeg(s.id, 1);
      seqT0 = -1;
      return;
    }
    for (const s of SEGS) setSeg(s.id, 0);
    seqT0 = performance.now() + (camFrom ? CAM_MS * 0.6 : 0) + 260;
    kick();
  };
  replayBtn.addEventListener("click", startSeq);

  const demoLevel = () => {
    if (!demo) return 0;
    const t = (performance.now() - demo.t0) / 1000;
    if (t < 0) return 0;
    if (t < 1.0) return 0.5 * ease(t / 1.0);
    if (t < 2.0) return 0.5;
    return 0.5 * (1 - ease(Math.min(1, (t - 2.0) / 0.6)));
  };

  const show = (v: View, animate: boolean) => {
    const prev = view;
    view = v;
    root.dataset.view = v;
    if (v !== "nano" && picked) {
      picked = null;
      paintPick();
    }
    if (v !== "press") {
      demo = null;
      pressActive = false;
      root.classList.remove("is-hit-hover");
    }
    // (the path stays whole once step 2 is left, however far its lighting got)
    if (v !== "wire" && seqT0 >= 0) seqT0 = -1;
    if (v !== "wire") for (const s of SEGS) setSeg(s.id, 1);
    paintWords();
    if (!data) return;
    const to = target(v);
    if (animate && !reduced && prev !== v) {
      camFrom = { ...cam };
      camTo = to;
      camT0 = performance.now();
      leads.innerHTML = "";
      root.classList.add("is-moving");
      kick();
    } else {
      camFrom = null;
      cam = camTo = to;
      applyCam();
    }
    if (v === "wire") startSeq();
    if (v === "press" && !demoDone && !reduced && !pressedOnce) {
      demoDone = true;
      demo = { t0: performance.now() + (camFrom ? CAM_MS : 0) + 500 };
    }
    layoutAll();
    kick();
  };

  // ---------------------------------------------------------------------------------------- the press (FSR)
  let dragY = 0;
  let dragLevel = 0;
  const startPress = () => {
    demo = null;
    pressActive = true;
    pressedOnce = true;
    root.classList.add("was-pressed");
    kick();
  };
  const endPress = () => {
    pressActive = false;
    kick();
  };
  hit.addEventListener("pointerdown", (e) => {
    if (view !== "press") return;
    e.preventDefault();
    hit.setPointerCapture(e.pointerId);
    hit.focus({ preventScroll: true });
    dragY = e.clientY;
    dragLevel = level;
    startPress();
  });
  hit.addEventListener("pointermove", (e) => {
    if (!pressActive || !hit.hasPointerCapture(e.pointerId)) return;
    level = clamp(dragLevel + (e.clientY - dragY) / 140, 0, 1);
    kick();
  });
  for (const t of ["pointerup", "pointercancel", "lostpointercapture"] as const) hit.addEventListener(t, () => pressActive && endPress());
  hit.addEventListener("keydown", (e) => {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      if (!e.repeat) startPress();
    } else if (e.key === "ArrowUp" || e.key === "ArrowRight") {
      e.preventDefault();
      level = clamp(level + 0.1, 0, 1);
      kick();
    } else if (e.key === "ArrowDown" || e.key === "ArrowLeft") {
      e.preventDefault();
      level = clamp(level - 0.1, 0, 1);
      kick();
    }
  });
  hit.addEventListener("keyup", (e) => {
    if (e.key === " " || e.key === "Enter") endPress();
  });
  // (the accent ring only for the keyboard; a mouse press focuses the sensor too, but shows nothing more)
  hit.addEventListener("focus", () => root.classList.toggle("is-hit-focus", hit.matches(":focus-visible")));
  hit.addEventListener("blur", () => {
    root.classList.remove("is-hit-focus");
    if (pressActive) endPress();
  });
  hit.addEventListener("pointerenter", () => root.classList.add("is-hit-hover"));
  hit.addEventListener("pointerleave", () => root.classList.remove("is-hit-hover"));
  slider.addEventListener("input", () => {
    demo = null;
    holdLevel = Number(slider.value) / 100;
    if (holdLevel > 0) {
      level = holdLevel;
      pressedOnce = true;
      root.classList.add("was-pressed");
    }
    kick();
  });

  // ---------------------------------------------------------------------------------------- layout
  const placeHit = () => {
    if (!data) return;
    const ring = data.fsr.ring.map(toScreen);
    const [x0, y0, x1, y1] = bbox(ring);
    hit.style.left = `${x0}px`;
    hit.style.top = `${y0}px`;
    hit.style.width = `${x1 - x0}px`;
    hit.style.height = `${y1 - y0}px`;
    hit.style.clipPath = `polygon(${ring.map(([x, y]) => `${(((x - x0) / (x1 - x0)) * 100).toFixed(1)}% ${(((y - y0) / (y1 - y0)) * 100).toFixed(1)}%`).join(",")})`;
  };
  const layoutAll = () => {
    placeHit();
    layoutCards();
  };
  const onResize = () => {
    const r = root.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return;
    size = { w: r.width, h: r.height };
    root.toggleAttribute("data-narrow", narrow());
    root.style.setProperty("--wb-panel", `${panelW()}px`);
    if (!data) return;
    camFrom = null;
    root.classList.remove("is-moving");
    cam = camTo = target(view);
    applyCam();
    layoutAll();
  };
  const ro = new ResizeObserver(onResize);
  ro.observe(root);

  // ---------------------------------------------------------------------------------------- the frame loop
  let raf = 0;
  let last = 0;
  let onScreen = true;
  // (the press view runs on: the plotter scrolls like the IDE's)
  const busy = () => Boolean(camFrom) || (view === "wire" && seqT0 >= 0) || view === "press" || force > 0 || pressedNow();
  const frame = (now: number) => {
    raf = 0;
    if (!alive || !data) return;
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
    last = now;
    // the camera
    if (camFrom) {
      const p = Math.min(1, (now - camT0) / CAM_MS);
      const e = ease(p);
      cam = { ox: camFrom.ox + (camTo.ox - camFrom.ox) * e, oy: camFrom.oy + (camTo.oy - camFrom.oy) * e, k: camFrom.k + (camTo.k - camFrom.k) * e };
      applyCam();
      if (p >= 1) {
        camFrom = null;
        root.classList.remove("is-moving");
        layoutAll();
      }
    }
    // step 2's lighting
    if (view === "wire" && seqT0 >= 0) {
      const t = now - seqT0;
      for (const s of SEGS) setSeg(s.id, clamp((t - SEG_T0[s.id]) / SEG_MS, 0, 1));
      if (t > SEQ_MS) seqT0 = -1;
    }
    // the press: force eases toward what is held (a release falls to "untouched" below the FSR's 0.2 N)
    if (demo && performance.now() - demo.t0 > 2700) demo = null;
    const want = pressedNow() ? forceAt(levelNow()) : 0;
    const k = reduced ? 1 : 1 - Math.exp(-dt / 0.085);
    force += (want - force) * k;
    if (!pressedNow() && force < 0.2) force = 0;
    if (demo && demoLevel() <= 0.001) force = 0;
    rd = readAt(force);
    root.style.setProperty("--wb-press", (force > 0 ? 0.35 + 0.65 * Math.log(force / 0.2) / Math.log(100) : 0).toFixed(3));
    root.style.setProperty("--wb-volts", (rd.volts / 5).toFixed(3));
    root.classList.toggle("is-pressed", force > 0);
    paintReadout();
    // the current: beads round the loop, a little faster the larger the current (22-60 px a second on screen)
    if (view === "press" && force > 0 && !reduced) {
      flowOff = (flowOff - (dt * (22 + 38 * Math.min(1, rd.amps / AMPS_MAX))) / cam.k) % 1000;
      flowPath.style.strokeDashoffset = flowHalo.style.strokeDashoffset = flowOff.toFixed(2);
    }
    // the sketch's readings
    if (view === "press" && onScreen) {
      simT += dt;
      acc += dt * 1000;
      let n = 0;
      while (acc >= delayMs && n < 50) {
        acc -= delayMs;
        sample();
        n++;
      }
      paintSerial();
    }
    if (busy() && onScreen && !document.hidden) raf = requestAnimationFrame(frame);
    else last = 0;
  };
  function kick() {
    if (!raf && alive && data && onScreen && !document.hidden) {
      last = 0;
      raf = requestAnimationFrame(frame);
    }
  }
  const io = new IntersectionObserver((es) => {
    onScreen = es.some((e) => e.isIntersecting);
    if (onScreen) kick();
  });
  io.observe(root);
  const onVis = () => !document.hidden && kick();
  document.addEventListener("visibilitychange", onVis);

  // ---------------------------------------------------------------------------------------- start
  paintWords();
  const offTheme = ctx.onTheme((t) => {
    theme = t;
    loadPics(t);
  });
  const offLang = ctx.onLang(() => {
    paintWords();
    layoutAll();
  });
  const onCoarse = () => paintWords();
  coarse.addEventListener("change", onCoarse);
  loadBench()
    .then((d) => {
      if (!alive) return;
      data = d;
      buildOverlay();
      measureSegs();
      loadPics(theme);
      onResize();
      show(view, false);
    })
    .catch((err: Error) => {
      root.classList.add("is-failed");
      $<HTMLElement>(".wb-kicker").textContent = err.message;
    });

  const lastValues = (n: number): number[] => (monitor.length ? monitor.slice(-n) : [rd.code]);
  let lastRun: { ms: number; values: number[]; on: View } | null = null;
  const sayRun = (): string[] => {
    if (!lastRun) return [];
    const { ms, values, on } = lastRun;
    const out = [tx("Serial Monitor · 9600 baud · a line every {ms} ms:", "串口监视器 · 9600 baud · 每 {ms} ms 一行：", { ms }), ...values.map(String)];
    if (values.every((v) => v === 0))
      out.push(
        on === "press"
          ? tx("(all 0: nothing presses the sensor. Press it on the bench, then Run again.)", "（全是 0：没有东西按着传感器。在工作台上按住它，再点一次“运行”。）")
          : tx("(all 0: go to step 3, press the sensor, then Run again.)", "（全是 0：到第 3 步按住传感器，再点一次“运行”。）"),
      );
    return out;
  };

  return {
    view(v) {
      const want = VIEWS.includes(v?.view as View) ? (v!.view as View) : "nano";
      show(want, Boolean(data));
    },
    run(params) {
      const ms = Math.round(clamp(Number(params.ms) || 100, 10, 1000));
      delayMs = ms;
      acc = 0;
      lastRun = { ms, values: lastValues(8), on: view };
      return sayRun();
    },
    say() {
      return sayRun();
    },
    layout() {
      onResize();
    },
    destroy() {
      alive = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      coarse.removeEventListener("change", onCoarse);
      offTheme();
      offLang();
      root.remove();
    },
  };
}
