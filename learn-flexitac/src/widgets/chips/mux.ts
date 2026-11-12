// The multiplexer view of chips-lab (Lesson 2.3 step 1, "A switch that picks one"): the CD74HC4067 drawn as a 16-way
// rotary switch inside a dashed outline (the chip). Its 16 contacts (the channels) sit on an arc left of the hub; the
// blade points at the picked one and the hub's common pin, COM, runs right to A0, with Lesson 2.1's 10 kΩ pull-down from
// A0 to ground. Three FSRs are wired between a +5 V rail and channels 5, 8 and 11 (inside the reading board's range,
// 4-15): Lesson 2.1's circuit with the switch put between the FSR and A0. On the pad the rail is the one drive line the
// shift registers power and each FSR a crossing on it (the lesson's overview says so). Above the A0 wire, four toggles
// S3 S2 S1 S0 (the Nano's D7-D4) with their weights 8 4 2 1 spell the channel in binary, and E# (D8, active LOW)
// switches the whole chip off when HIGH. Under it all, a 16-cell bar fills with A0's reading, channel by channel, when
// the learner presses "Read them in turn" (chips-lab.ts runs the scan).
// Colours: the rail and the FSRs' outer leads in the powered colour, a quiet pink (they stand for the one powered drive
// line, the drive path's pink; the side card's 5 V supply is power, grey); a pressed FSR in the lesson colour (the
// learner set it); full pink only for current, which flows when the picked channel's FSR is pressed.
// Numbers: Lesson 2.1's FSR model (./press.ts from ../bench/fsr.ts, Adafruit's table): a pressed FSR is its light press,
// 1 N = 6 kΩ; A0 = vA0(R_FSR, {rOn: R_ON}) from @shared/models/divider.mjs (the switch's 70 Ω in series, so 3 counts
// under Lesson 2.1's bench at the same press), analogRead = adcCode() from @shared/models/adc.mjs. An FSR nobody presses
// is an open circuit (Interlink: > 10 MΩ), so A0 reads 0. Illustrative; no force is ever shown.
import { adcCode } from "@shared/models/adc.mjs";
import { R_ON, vA0 } from "@shared/models/divider.mjs";
import { VIRIDIS_RGB } from "@shared/models/viridis.mjs";
import { R_PRESSED } from "./press";
import { el, ease, ground, label, poly, rrect, viridisCss, zigzag, type Frame } from "./svg";

/** The channels that have an FSR on them. */
export const FSR_CH = [5, 8, 11] as const;

export interface MuxState {
  /** The channel the select pins spell, 0-15. */
  ch: number;
  /** E#'s level: 0 = LOW = the chip is on. */
  e: 0 | 1;
  /** The FSR channels pressed now. */
  pressed: Set<number>;
  /** "Read them in turn": A0's reading per channel (ADC codes), null = not read in this pass. */
  cells: (number | null)[];
  scanning: boolean;
}
export const muxState = (): MuxState => ({ ch: 0, e: 0, pressed: new Set([8]), cells: Array(16).fill(null), scanning: false });

/** Volts at A0 now. */
export function muxVolts(st: MuxState): number {
  if (st.e) return 0;
  return st.pressed.has(st.ch) ? vA0(R_PRESSED, { rOn: R_ON }) : 0;
}
/** analogRead(A0) now: 0-1023. */
export const muxRead = (st: MuxState): number => adcCode(muxVolts(st));
/** The reading a channel would give (for the scan). */
export const readAt = (st: MuxState, ch: number): number => (st.e ? 0 : st.pressed.has(ch) ? adcCode(vA0(R_PRESSED, { rOn: R_ON })) : 0);

export interface MuxWords {
  com: string;
  a0: string;
  kohm: string;
  gnd: string;
  v5: string;
  fsr: string;
  eName: string;
  on: string;
  off: string;
  read: string;
  bracket: string;
  sum: string;
  bitAria: string;
  eAria: string;
  fsrAria: string;
  pressed: string;
  notPressed: string;
  press: string;
  release: string;
  cellAria: string;
}
export interface MuxHandlers {
  bit(i: number): void;
  e(): void;
  fsr(ch: number): void;
}
export interface MuxDrawing {
  update(st: MuxState, animate: boolean): void;
  destroy(): void;
}

// ---- geometry (design units)
const P: [number, number] = [196, 160];
const RC = 112; // contacts
const RF = 150; // FSR centres
const RS = 12.5; // FSR radius
const R5 = 184; // the +5 V rail
const DW = 488;
const DH = 382;
const ang = (ch: number) => 252 - ch * 9.6; // degrees: channel 0 at the top, 15 at the bottom
const at = (r: number, deg: number): [number, number] => [P[0] + r * Math.cos((deg * Math.PI) / 180), P[1] + r * Math.sin((deg * Math.PI) / 180)];
const TOG_X = [70, 112, 154, 196]; // S3 S2 S1 S0 centres, from the hub
const E_X = 252;
const TOG_Y = -110; // box centre
const BOX = 36;
const NODE_X = 124;
const READ_X0 = 148;
const READ_X1 = 284;
const BAR_Y = 146;
const CELL = 25;
const PITCH = 28;
const BAR_X0 = 246 - (16 * PITCH - (PITCH - CELL)) / 2;
const RAIL_TOP = 212; // the rail's +5 V end (deg)
const RAIL_BOT = ang(FSR_CH[FSR_CH.length - 1]); // it ends at the last FSR's joint
const R_TICK = 133; // the few channel numbers, just outside the chip's outline
const R_CHIP = 123; // the chip's outline: between the contacts (112) and the FSRs (137.5)
const CHIP_R = 34; // its flat right side, past the hub where COM leaves the chip

export function drawMux(f: Frame, st0: MuxState, W: MuxWords, H: MuxHandlers, reduced: boolean): MuxDrawing {
  const g = f.g;
  const [px, py] = P;
  let bladeDeg = ang(st0.ch);
  let raf = 0;

  // ---- the +5 V rail and the FSR leads (under everything)
  const railArc = (a0: number, a1: number) => {
    const [x0, y0] = at(R5, a0);
    const [x1, y1] = at(R5, a1);
    return `M${x0} ${y0} A${R5} ${R5} 0 0 ${a1 > a0 ? 1 : 0} ${x1} ${y1}`;
  };
  el("path", { d: railArc(RAIL_BOT, RAIL_TOP), class: "cl-wire cl-power" }, g);
  const [tx, ty] = at(R5, RAIL_TOP);
  el("circle", { cx: tx, cy: ty, r: 3.4, class: "cl-term cl-power" }, g);
  label(g, tx - 4, ty - 9, W.v5, "cl-t cl-t-strong", "middle");

  // ---- the chip: a quiet dashed outline round the contacts, the blade and the hub (the FSRs, the rail, A0 and the
  // resistor are outside it). A "D": an arc round the contacts, closed on the right where COM leaves the chip.
  {
    const a0 = ang(0) + 8;
    const a1 = ang(15) - 8;
    const [x0, y0] = at(R_CHIP, a0);
    const [x1, y1] = at(R_CHIP, a1);
    const xr = px + CHIP_R;
    const q = 8; // the right corners' radius
    el(
      "path",
      {
        d: `M${x0} ${y0} A${R_CHIP} ${R_CHIP} 0 0 0 ${x1} ${y1} H${xr - q} Q${xr} ${y1} ${xr} ${y1 - q} V${y0 + q} Q${xr} ${y0} ${xr - q} ${y0} Z`,
        class: "cl-chip-outline",
      },
      g,
    );
  }

  // ---- the arc of contacts and the hub
  const contacts: SVGCircleElement[] = [];
  const leads = new Map<number, SVGPathElement>();
  for (let ch = 0; ch < 16; ch++) {
    const a = ang(ch);
    if ((FSR_CH as readonly number[]).includes(ch)) {
      const [x0, y0] = at(RC, a);
      const [x1, y1] = at(RF - RS, a);
      const [x2, y2] = at(RF + RS, a);
      const [x3, y3] = at(R5, a);
      leads.set(ch, el("path", { d: poly([[x0, y0], [x1, y1]]), class: "cl-wire cl-lead" }, g));
      el("path", { d: poly([[x2, y2], [x3, y3]]), class: "cl-wire cl-power" }, g);
      el("circle", { cx: x3, cy: y3, r: 2.2, class: "cl-joint cl-power" }, g);
    }
  }
  // tick numbers on a few channels (the FSRs carry their own)
  for (const ch of [0, 4, 12, 15]) {
    const [x, y] = at(R_TICK, ang(ch));
    label(g, x, y + 3.5, String(ch), "cl-t cl-t-dim", "middle");
  }

  for (let ch = 0; ch < 16; ch++) {
    const [x, y] = at(RC, ang(ch));
    contacts.push(el("circle", { cx: x, cy: y, r: 3.6, class: "cl-contact" }, g));
  }

  // the COM wire, A0 node, R1 and ground
  const comWire = el("path", { d: poly([[px, py], [px + NODE_X, py], [px + READ_X0, py]]), class: "cl-wire cl-listen" }, g);
  label(g, px + 16, py - 8, W.com, "cl-t cl-t-dim");
  el("path", { d: zigzag(px + NODE_X, py, py + 66, 6), class: "cl-wire" }, g);
  label(g, px + NODE_X + 13, py + 37, W.kohm, "cl-t");
  ground(g, px + NODE_X, py + 76, "cl-wire");
  label(g, px + NODE_X + 14, py + 84, W.gnd, "cl-t cl-t-dim");
  el("circle", { cx: px + NODE_X, cy: py, r: 2.8, class: "cl-node" }, g);
  label(g, px + NODE_X, py - 9, W.a0, "cl-t cl-t-strong", "middle");

  // the reading box: analogRead(A0), the number, volts, a bar 0-1023
  const rb = el("g", { class: "cl-readbox" }, g);
  el("path", { d: rrect(px + READ_X0, py - 27, READ_X1 - READ_X0, 54, 7), class: "cl-screen" }, rb);
  label(rb, px + READ_X0 + 10, py - 12, W.read, "cl-t cl-t-dim cl-t-code");
  const readV = label(rb, px + READ_X0 + 10, py + 12, "0", "cl-t-big");
  const readU = label(rb, px + READ_X1 - 10, py + 12, "0.00 V", "cl-t cl-t-dim", "end");
  el("rect", { x: px + READ_X0 + 10, y: py + 18, width: READ_X1 - READ_X0 - 20, height: 3, rx: 1.5, class: "cl-track" }, rb);
  const readBar = el("rect", { x: px + READ_X0 + 10, y: py + 18, width: 0, height: 3, rx: 1.5, class: "cl-bar" }, rb);

  // ---- the blade (rotates about the hub)
  const bladeG = el("g", { transform: `translate(${px} ${py})` }, g);
  const blade = el("g", { class: "cl-blade", transform: `rotate(${bladeDeg})` }, bladeG);
  const bladeLine = el("line", { x1: 0, y1: 0, x2: RC - 5, y2: 0, class: "cl-blade-line" }, blade);
  el("circle", { cx: px, cy: py, r: 6.5, class: "cl-hub" }, g);

  // ---- the current's path, over the blade: rail -> FSR -> contact -> hub -> COM -> A0 -> R -> GND
  const flowGlow = el("path", { d: "", class: "cl-flow-glow" }, g);
  const flow = el("path", { d: "", class: "cl-flow" }, g);

  // ---- the FSRs (over the leads)
  const fsrs = new Map<number, { g: SVGGElement; tip: SVGCircleElement }>();
  {
    // one quiet name, above the first FSR: these discs are Lesson 2.1's force sensors
    const [x, y] = at(RF, ang(FSR_CH[0]));
    label(g, x, y - RS - 6, W.fsr, "cl-t cl-t-dim", "middle");
  }
  for (const ch of FSR_CH) {
    const [x, y] = at(RF, ang(ch));
    const fg = el("g", { class: "cl-fsr", tabindex: 0, role: "button" }, g);
    el("circle", { cx: x, cy: y, r: RS + 6, class: "cl-hit" }, fg);
    el("circle", { cx: x, cy: y, r: RS, class: "cl-fsr-body" }, fg);
    el("circle", { cx: x, cy: y, r: RS - 3.2, class: "cl-fsr-face" }, fg);
    const tip = el("circle", { cx: x, cy: y, r: RS - 1.5, class: "cl-fsr-tip" }, fg);
    label(fg, x, y + 3.4, String(ch), "cl-t cl-fsr-n", "middle");
    fg.addEventListener("click", () => H.fsr(ch));
    fg.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        H.fsr(ch);
      }
    });
    fsrs.set(ch, { g: fg, tip });
  }

  // ---- the select toggles (S3 S2 S1 S0) and E#
  const toggles: { g: SVGGElement; box: SVGPathElement; d: SVGTextElement; bit: number }[] = [];
  const mkToggle = (cx: number, name: string, under: string, onClick: () => void) => {
    const tg = el("g", { class: "cl-tog", tabindex: 0, role: "button" }, g);
    const x = px + cx - BOX / 2;
    const y = py + TOG_Y - BOX / 2;
    el("rect", { x: x - 4, y: y - 18, width: BOX + 8, height: BOX + 38, class: "cl-hit" }, tg);
    label(tg, px + cx, y - 7, name, "cl-t cl-t-strong", "middle");
    el("path", { d: rrect(x - 4, y - 4, BOX + 8, BOX + 8, 10), class: "cl-focus" }, tg);
    const box = el("path", { d: rrect(x, y, BOX, BOX, 7), class: "cl-tog-box" }, tg);
    const d = label(tg, px + cx, py + TOG_Y + 6.5, "0", "cl-tog-d", "middle");
    const u = label(tg, px + cx, y + BOX + 14, under, "cl-t cl-t-dim", "middle");
    tg.addEventListener("click", onClick);
    tg.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onClick();
      }
    });
    return { tg, box, d, u };
  };
  [3, 2, 1, 0].forEach((bit, i) => {
    const t = mkToggle(TOG_X[i], `S${bit}`, `×${1 << bit}`, () => H.bit(bit));
    toggles.push({ g: t.tg, box: t.box, d: t.d, bit });
  });
  const eT = mkToggle(E_X, W.eName, W.on, () => H.e());
  eT.tg.classList.add("cl-tog-e");
  // a hairline between the select pins and E#
  el("path", { d: poly([[px + (TOG_X[3] + E_X) / 2, py + TOG_Y - 14], [px + (TOG_X[3] + E_X) / 2, py + TOG_Y + 14]]), class: "cl-hair" }, g);
  const sum = label(g, px + (TOG_X[0] + TOG_X[3]) / 2, py + TOG_Y + 56, "", "cl-t cl-sum", "middle");

  // ---- the 16-cell bar
  const cells: SVGRectElement[] = [];
  const cellG = el("g", { class: "cl-cells" }, g);
  for (let ch = 0; ch < 16; ch++) {
    const x = BAR_X0 + ch * PITCH;
    cells.push(el("rect", { x, y: py + BAR_Y, width: CELL, height: CELL, rx: 4, class: "cl-cell" }, cellG));
    label(cellG, x + CELL / 2, py + BAR_Y + CELL + 12, String(ch), "cl-t cl-t-dim", "middle");
  }
  // channels 4-15: the reading board's 12 sense lines
  const bx0 = BAR_X0 + 4 * PITCH;
  const bx1 = BAR_X0 + 15 * PITCH + CELL;
  const by = py + BAR_Y + CELL + 20;
  el("path", { d: `M${bx0} ${by - 4} V${by} H${bx1} V${by - 4}`, class: "cl-bracket" }, g);
  label(g, (bx0 + bx1) / 2, by + 13, W.bracket, "cl-t cl-t-dim", "middle");

  // ---- paint
  const flowPath = (st: MuxState): string => {
    const a = ang(st.ch);
    const [r0x, r0y] = at(R5, RAIL_TOP);
    const [r1x, r1y] = at(R5, a);
    const pts: [number, number][] = [at(RF + RS, a), at(RF - RS, a), at(RC, a), [px, py], [px + NODE_X, py]];
    const zig = zigzag(px + NODE_X, py, py + 66, 6).replace(/^M[^L]+/, "");
    return `M${r0x} ${r0y} A${R5} ${R5} 0 0 0 ${r1x} ${r1y} L${at(R5, a).join(" ")} ` + pts.map((p) => `L${p[0]} ${p[1]}`).join(" ") + ` ${zig} L${px + NODE_X} ${py + 70}`;
  };

  const setBlade = (deg: number) => blade.setAttribute("transform", `rotate(${Math.round(deg * 100) / 100})`);
  const update = (st: MuxState, animate: boolean) => {
    const on = st.e === 0;
    const target = ang(st.ch);
    cancelAnimationFrame(raf);
    if (!animate || reduced || Math.abs(target - bladeDeg) < 0.01) {
      bladeDeg = target;
      setBlade(target);
    } else {
      const from = bladeDeg;
      const t0 = performance.now();
      const dur = Math.min(420, 140 + Math.abs(target - from) * 2.2);
      const step = (now: number) => {
        const t = Math.min(1, (now - t0) / dur);
        bladeDeg = from + (target - from) * ease(t);
        setBlade(bladeDeg);
        if (t < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }
    blade.classList.toggle("is-off", !on);
    bladeLine.setAttribute("x2", String(on ? RC - 5 : RC - 24));
    contacts.forEach((c, ch) => c.classList.toggle("is-on", ch === st.ch && on));
    for (const [ch, ld] of leads) ld.classList.toggle("is-on", ch === st.ch && on);
    comWire.classList.toggle("is-on", on);
    for (const t of toggles) {
      const b = (st.ch >> t.bit) & 1;
      t.g.classList.toggle("is-1", b === 1);
      t.d.textContent = String(b);
      t.g.setAttribute("aria-label", fillW(W.bitAria, { s: `S${t.bit}`, d: `D${4 + t.bit}`, b, w: 1 << t.bit }));
      t.g.setAttribute("aria-pressed", String(b === 1));
    }
    eT.tg.classList.toggle("is-1", st.e === 1);
    eT.d.textContent = String(st.e);
    eT.u.textContent = st.e ? W.off : W.on;
    eT.tg.setAttribute("aria-label", fillW(W.eAria, { b: st.e, state: st.e ? W.off : W.on }));
    eT.tg.setAttribute("aria-pressed", String(st.e === 1));
    const parts = [3, 2, 1, 0].map((b) => ((st.ch >> b) & 1) * (1 << b));
    sum.textContent = fillW(W.sum, { expr: parts.join(" + "), n: st.ch });
    for (const [ch, fs] of fsrs) {
      const p = st.pressed.has(ch);
      fs.g.classList.toggle("is-pressed", p);
      fs.g.setAttribute("aria-pressed", String(p));
      fs.g.setAttribute("aria-label", fillW(W.fsrAria, { n: ch, state: p ? W.pressed : W.notPressed, act: p ? W.release : W.press }));
    }
    // current flows only when the picked channel's FSR is pressed and the chip is on
    const live = on && st.pressed.has(st.ch);
    for (const [ch, fs] of fsrs) fs.g.classList.toggle("is-live", live && ch === st.ch);
    const d = live ? flowPath(st) : "";
    flow.setAttribute("d", d);
    flowGlow.setAttribute("d", d);
    const code = muxRead(st);
    const v = muxVolts(st);
    readV.textContent = String(code);
    readU.textContent = `${v.toFixed(2)} V`;
    readBar.setAttribute("width", String(((READ_X1 - READ_X0 - 20) * code) / 1023));
    rb.classList.toggle("is-live", live);
    cells.forEach((c, ch) => {
      const val = st.cells[ch];
      c.classList.toggle("is-read", val !== null);
      c.classList.toggle("is-cur", ch === st.ch);
      c.style.fill = val === null ? "" : viridisCss(VIRIDIS_RGB, val / 1023);
      c.setAttribute("aria-label", fillW(W.cellAria, { n: ch, v: val === null ? "–" : val }));
    });
  };
  update(st0, false);
  return { update, destroy: () => cancelAnimationFrame(raf) };
}

/** {name} placeholders (the drawing keeps its own: no i18n import here). */
function fillW(s: string, vars: Record<string, string | number>): string {
  return s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

export const MUX_SIZE = { w: DW, h: DH };
