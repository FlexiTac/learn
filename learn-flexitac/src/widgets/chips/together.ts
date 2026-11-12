// The "together" view of chips-lab (Lesson 2.3 step 3, "Together"): both chips over a small grid of crossings, the
// scanning idea in its simplest form, before the real board (Lesson 2.5) and a whole frame (Lesson 2.6). It is Lesson
// 1.2's 2 × 2 card grown to 4 × 8, drawn flat in the style of steps 1 and 2:
//   - on top, a 74HC595 (its output latch: eight boxes, one holding the walking 1); each output runs down as a drive line,
//     the one at 1 powered (the drive path's quieter pink, as an output at 1 in step 2) with a small "5 V" under it;
//   - four sense lines run left to right, through the grid, onto four contacts of the multiplexer, drawn as step 1's
//     rotary switch in miniature (the same dashed "D" outline); its blade picks the sense line A0 listens to (teal);
//   - COM runs to A0, with Lesson 2.1's 10 kΩ pull-down to ground, and up into the reading box, analogRead(A0);
//   - at every crossing a tiny force sensor (step 1's FSR disc, small): click one to press it (the lesson colour).
// Only the crossing where the powered drive line meets the picked sense line can reach A0 (a ring marks it); when it is
// pressed, current flows (pink dots) from the powered output down its drive line, through that crossing, along the
// sense line, through the switch to A0 and the resistor to ground, and A0 reads it. The side card holds the map
// (mapPicture below): one cell per crossing, rows the sense lines, columns the drive lines, filled as each crossing is
// read (chips-lab.ts walks them: the multiplexer picks a sense line, then the walking 1 powers the drive lines one at a
// time, as the board's firmware orders them). Its cells press their crossings too.
// Numbers: a pressed crossing is Lesson 2.1's light press (./press.ts from ../bench/fsr.ts: 1 N = 6 kΩ, Adafruit's
// table), read as in step 1 through the switch's 70 Ω (vA0 with R_ON, @shared/models/divider.mjs; adcCode,
// @shared/models/adc.mjs); an unpressed crossing is an open circuit, so A0 reads 0. First order: other pressed crossings'
// paths are left out (divider.mjs NOTE). Illustrative, like step 1; no force is shown.
import { adcCode } from "@shared/models/adc.mjs";
import { R_ON, vA0 } from "@shared/models/divider.mjs";
import { VIRIDIS_RGB } from "@shared/models/viridis.mjs";
import { R_PRESSED } from "./press";
import { el, ease, ground, label, poly, rrect, viridisCss, zigzag, type Frame } from "./svg";

/** Sense lines (rows) and drive lines (columns) in the drawing: a small piece of the pad's 12 × 32. */
export const SENSE_N = 4;
export const DRIVE_N = 8;
const N = SENSE_N * DRIVE_N;

export interface TogetherState {
  /** The sense line the multiplexer picks (0-based row). */
  s: number;
  /** The drive line the shift register powers (0-based column). */
  d: number;
  /** Pressed crossings, by index s * DRIVE_N + d. */
  pressed: Set<number>;
  /** The map: A0's reading per crossing (ADC codes), null = not read yet. */
  cells: (number | null)[];
  /** The crossing the chips point at now has been read into its cell. */
  recorded: boolean;
  scanning: boolean;
}
/** The opening state: the chips on the first crossing, one crossing pressed (row 2, column 6), the map empty. */
export const togetherState = (): TogetherState => ({ s: 0, d: 0, pressed: new Set([1 * DRIVE_N + 5]), cells: Array(N).fill(null), recorded: false, scanning: false });

const A0_PRESSED = adcCode(vA0(R_PRESSED, { rOn: R_ON }));
const V_PRESSED = vA0(R_PRESSED, { rOn: R_ON });
/** analogRead(A0) for crossing i, were the chips on it. */
export const readCross = (st: TogetherState, i: number): number => (st.pressed.has(i) ? A0_PRESSED : 0);
/** analogRead(A0) now. */
export const readNow = (st: TogetherState): number => readCross(st, st.s * DRIVE_N + st.d);
/** The next crossing in the firmware's order: the drive lines one at a time, then the next sense line. */
export function nextCross(st: TogetherState): void {
  st.d++;
  if (st.d >= DRIVE_N) {
    st.d = 0;
    st.s = (st.s + 1) % SENSE_N;
  }
}

export interface TogetherWords {
  shiftName: string;
  muxName: string;
  /** Under the multiplexer's name: how many of its channels the drawing uses. */
  muxNote: string;
  driveLines: string;
  senseLines: string;
  v5: string;
  a0: string;
  kohm: string;
  gnd: string;
  read: string;
  crossAria: string;
  pressed: string;
  notPressed: string;
}
export interface TogetherHandlers {
  press(i: number): void;
}
export interface TogetherDrawing {
  update(st: TogetherState, animate: boolean): void;
  destroy(): void;
}

// ---- geometry (design units)
const DW = 592;
const DH = 318;
const GX0 = 110; // the first drive line
const CP = 36; // drive line pitch
const GY0 = 128; // the first sense line
const RP = 48; // sense line pitch
const cx = (d: number) => GX0 + d * CP;
const ry = (s: number) => GY0 + s * RP;
const GX1 = cx(DRIVE_N - 1);
const GY1 = ry(SENSE_N - 1);
const CHIP_Y0 = 12;
const CHIP_Y1 = 84;
const OB = 24; // an output box
const OBY = 44; // its top
const LINE_X0 = GX0 - 22; // the sense lines' left ends
const DRV_Y1 = GY1 + 22; // the drive lines' bottom ends
const HUB: [number, number] = [470, (GY0 + GY1) / 2];
const RC = 84; // the contacts' arc
const R_OUT = 96; // the chip's outline round them
const NODE_X = 528;
const RES_Y1 = HUB[1] + 58;
const BOX = { x0: 410, x1: 556, y0: 22, y1: 76 };
const RF = 8.5; // a crossing's disc

/** A sense line's contact on the arc, and its angle (degrees) seen from the hub. */
function contact(s: number): { x: number; y: number; deg: number } {
  const dy = ry(s) - HUB[1];
  const dx = Math.sqrt(RC * RC - dy * dy);
  // (0-360, all on the left: the blade turns through the left between any two)
  const deg = (Math.atan2(dy, -dx) * 180) / Math.PI;
  return { x: HUB[0] - dx, y: ry(s), deg: deg < 0 ? deg + 360 : deg };
}

export function drawTogether(f: Frame, st0: TogetherState, W: TogetherWords, H: TogetherHandlers, reduced: boolean): TogetherDrawing {
  const g = f.g;
  const [hx, hy] = HUB;
  let bladeDeg = contact(st0.s).deg;
  let raf = 0;

  // ---- the shift register: a dashed outline round its eight output boxes
  el("path", { d: rrect(GX0 - 26, CHIP_Y0, GX1 - GX0 + 52, CHIP_Y1 - CHIP_Y0, 10), class: "cl-chip-outline" }, g);
  label(g, GX1 + 20, CHIP_Y0 + 15, W.shiftName, "cl-t cl-t-dim", "end");
  // ---- the multiplexer: step 1's "D" outline, small (its flat top and bottom clear the end contacts)
  {
    const a0 = contact(0).deg + 12;
    const a1 = contact(SENSE_N - 1).deg - 12;
    const at = (deg: number): [number, number] => [hx + R_OUT * Math.cos((deg * Math.PI) / 180), hy + R_OUT * Math.sin((deg * Math.PI) / 180)];
    const [x0, y0] = at(a0);
    const [x1, y1] = at(a1);
    const xr = hx + 28;
    const q = 8;
    el("path", { d: `M${x0} ${y0} A${R_OUT} ${R_OUT} 0 0 0 ${x1} ${y1} H${xr - q} Q${xr} ${y1} ${xr} ${y1 - q} V${y0 + q} Q${xr} ${y0} ${xr - q} ${y0} Z`, class: "cl-chip-outline" }, g);
    // (its name, and under it how many of its 16 channels are drawn: two short lines, clear of the last drive line)
    label(g, xr, y0 - 17.5, W.muxName, "cl-t cl-t-dim", "end");
    label(g, xr, y0 - 6, W.muxNote, "cl-t cl-t-dim", "end");
  }

  // ---- the lines (under the crossings): drive lines down from the outputs, sense lines across into the contacts
  const drv: SVGPathElement[] = [];
  for (let d = 0; d < DRIVE_N; d++) drv.push(el("path", { d: poly([[cx(d), OBY + OB], [cx(d), DRV_Y1]]), class: "cl-wire cl-drv" }, g));
  const sns: SVGPathElement[] = [];
  const contacts: SVGCircleElement[] = [];
  for (let s = 0; s < SENSE_N; s++) {
    const c = contact(s);
    sns.push(el("path", { d: poly([[LINE_X0, ry(s)], [c.x, c.y]]), class: "cl-wire cl-sns" }, g));
  }
  for (let s = 0; s < SENSE_N; s++) {
    const c = contact(s);
    contacts.push(el("circle", { cx: c.x, cy: c.y, r: 3.4, class: "cl-contact" }, g));
  }
  label(g, GX0 - 10, 106, W.driveLines, "cl-t cl-t-dim", "end");
  label(g, LINE_X0 - 8, ry(0) + 3.6, W.senseLines, "cl-t cl-t-dim", "end");
  const v5 = label(g, cx(st0.d), DRV_Y1 + 15, W.v5, "cl-t cl-t-strong cl-v5", "middle");

  // ---- the output boxes (the latch: one 1, seven 0s)
  const outs: { box: SVGPathElement; dg: SVGTextElement }[] = [];
  for (let d = 0; d < DRIVE_N; d++) {
    const box = el("path", { d: rrect(cx(d) - OB / 2, OBY, OB, OB, 5), class: "cl-box cl-lbox" }, g);
    const dg = label(g, cx(d), OBY + OB / 2 + 5, "0", "cl-digit cl-digit-s cl-ldigit", "middle");
    outs.push({ box, dg });
  }

  // ---- COM, A0, the 10 kΩ to ground, and up into the reading box
  const comWire = el("path", { d: poly([[hx, hy], [NODE_X, hy]]), class: "cl-wire cl-listen" }, g);
  const upWire = el("path", { d: poly([[NODE_X, hy], [NODE_X, BOX.y1]]), class: "cl-wire cl-listen" }, g);
  el("path", { d: zigzag(NODE_X, hy, RES_Y1, 5.5), class: "cl-wire" }, g);
  label(g, NODE_X + 12, (hy + RES_Y1) / 2 + 4, W.kohm, "cl-t");
  ground(g, NODE_X, RES_Y1 + 10, "cl-wire");
  label(g, NODE_X + 13, RES_Y1 + 18, W.gnd, "cl-t cl-t-dim");
  el("circle", { cx: NODE_X, cy: hy, r: 2.8, class: "cl-node" }, g);
  label(g, NODE_X + 8, hy - 7, W.a0, "cl-t cl-t-strong");
  const rb = el("g", { class: "cl-readbox" }, g);
  el("path", { d: rrect(BOX.x0, BOX.y0, BOX.x1 - BOX.x0, BOX.y1 - BOX.y0, 7), class: "cl-screen" }, rb);
  label(rb, BOX.x0 + 10, BOX.y0 + 15, W.read, "cl-t cl-t-dim cl-t-code");
  const readV = label(rb, BOX.x0 + 10, BOX.y0 + 38, "0", "cl-t-big");
  const readU = label(rb, BOX.x1 - 10, BOX.y0 + 38, "0.00 V", "cl-t cl-t-dim", "end");
  el("rect", { x: BOX.x0 + 10, y: BOX.y0 + 44, width: BOX.x1 - BOX.x0 - 20, height: 3, rx: 1.5, class: "cl-track" }, rb);
  const readBar = el("rect", { x: BOX.x0 + 10, y: BOX.y0 + 44, width: 0, height: 3, rx: 1.5, class: "cl-bar" }, rb);

  // ---- the blade (rotates about the hub)
  const bladeG = el("g", { transform: `translate(${hx} ${hy})` }, g);
  const blade = el("g", { class: "cl-blade", transform: `rotate(${bladeDeg})` }, bladeG);
  el("line", { x1: 0, y1: 0, x2: RC - 4, y2: 0, class: "cl-blade-line" }, blade);
  el("circle", { cx: hx, cy: hy, r: 5.5, class: "cl-hub" }, g);

  // ---- the current's path (over the lines, under the crossings' discs)
  const flowGlow = el("path", { d: "", class: "cl-flow-glow" }, g);
  const flow = el("path", { d: "", class: "cl-flow" }, g);

  // ---- the crossings: a ring for the live one, a small FSR disc at each
  const ring = el("circle", { cx: cx(st0.d), cy: ry(st0.s), r: RF + 5.5, class: "cl-xring" }, g);
  const discs: SVGGElement[] = [];
  for (let s = 0; s < SENSE_N; s++)
    for (let d = 0; d < DRIVE_N; d++) {
      const i = s * DRIVE_N + d;
      const x = cx(d);
      const y = ry(s);
      const fg = el("g", { class: "cl-fsr cl-xfsr", tabindex: 0, role: "button" }, g);
      el("circle", { cx: x, cy: y, r: RF + 7, class: "cl-hit" }, fg);
      el("circle", { cx: x, cy: y, r: RF, class: "cl-fsr-body" }, fg);
      el("circle", { cx: x, cy: y, r: RF - 1.3, class: "cl-fsr-tip" }, fg);
      fg.addEventListener("click", () => H.press(i));
      fg.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          H.press(i);
        }
      });
      discs.push(fg);
    }

  const flowPath = (st: TogetherState): string => {
    const c = contact(st.s);
    const zig = zigzag(NODE_X, hy, RES_Y1, 5.5).replace(/^M[^L]+/, "");
    return poly([[cx(st.d), OBY + OB], [cx(st.d), ry(st.s)], [c.x, c.y], [hx, hy], [NODE_X, hy]]) + ` ${zig} L${NODE_X} ${RES_Y1 + 4}`;
  };
  const setBlade = (deg: number) => blade.setAttribute("transform", `rotate(${Math.round(deg * 100) / 100})`);

  const update = (st: TogetherState, animate: boolean) => {
    const target = contact(st.s).deg;
    cancelAnimationFrame(raf);
    if (!animate || reduced || Math.abs(target - bladeDeg) < 0.01) {
      bladeDeg = target;
      setBlade(target);
    } else {
      const from = bladeDeg;
      const t0 = performance.now();
      const dur = Math.min(300, 120 + Math.abs(target - from) * 2);
      const step = (now: number) => {
        const t = Math.min(1, (now - t0) / dur);
        bladeDeg = from + (target - from) * ease(t);
        setBlade(bladeDeg);
        if (t < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }
    drv.forEach((p, d) => p.classList.toggle("is-on", d === st.d));
    sns.forEach((p, s) => p.classList.toggle("is-on", s === st.s));
    contacts.forEach((c, s) => c.classList.toggle("is-on", s === st.s));
    outs.forEach((o, d) => {
      const one = d === st.d;
      o.dg.textContent = one ? "1" : "0";
      o.dg.classList.toggle("is-1", one);
      o.box.classList.toggle("is-1", one);
    });
    v5.setAttribute("x", String(cx(st.d)));
    ring.setAttribute("cx", String(cx(st.d)));
    ring.setAttribute("cy", String(ry(st.s)));
    const live = st.pressed.has(st.s * DRIVE_N + st.d);
    discs.forEach((fg, i) => {
      const p = st.pressed.has(i);
      const s = Math.floor(i / DRIVE_N);
      const d = i % DRIVE_N;
      fg.classList.toggle("is-pressed", p);
      fg.classList.toggle("is-live", p && s === st.s && d === st.d);
      fg.setAttribute("aria-pressed", String(p));
      fg.setAttribute("aria-label", fillW(W.crossAria, { s: s + 1, d: d + 1, state: p ? W.pressed : W.notPressed }));
    });
    ring.classList.toggle("is-live", live);
    const dd = live ? flowPath(st) : "";
    flow.setAttribute("d", dd);
    flowGlow.setAttribute("d", dd);
    comWire.classList.add("is-on");
    upWire.classList.add("is-on");
    const code = readNow(st);
    readV.textContent = String(code);
    readU.textContent = `${(live ? V_PRESSED : 0).toFixed(2)} V`;
    readBar.setAttribute("width", String(((BOX.x1 - BOX.x0 - 20) * code) / 1023));
    rb.classList.toggle("is-live", live);
  };
  update(st0, false);
  return { update, destroy: () => cancelAnimationFrame(raf) };
}

export const TOGETHER_SIZE = { w: DW, h: DH };

// ---- the side card's map: one cell per crossing, rows the sense lines, columns the drive lines (228 units wide, about
// 1:1 in the card, as the wiring pictures). It shows only what A0 has read: a press shows up when its cell is read.
export interface MapWords {
  rows: string;
  cols: string;
  cellAria: string;
}
export interface MapPicture {
  update(st: TogetherState): void;
}
export function mapPicture(svg: SVGSVGElement, st0: TogetherState, W: MapWords): MapPicture {
  svg.replaceChildren();
  const CELL = 22;
  const PITCH = 25;
  const X0 = 26;
  const Y0 = 24;
  const Wd = 228;
  const Hd = Y0 + SENSE_N * PITCH + 26;
  svg.setAttribute("viewBox", `0 0 ${Wd} ${Hd}`);
  // column numbers over the cells (drive lines), row numbers left of them (sense lines)
  label(svg, X0, 9, W.cols, "cl-m-axis");
  for (let d = 0; d < DRIVE_N; d++) label(svg, X0 + d * PITCH + CELL / 2, Y0 - 5, String(d + 1), "cl-m-n", "middle");
  for (let s = 0; s < SENSE_N; s++) label(svg, X0 - 8, Y0 + s * PITCH + CELL / 2 + 3.5, String(s + 1), "cl-m-n", "end");
  label(svg, X0, Y0 + SENSE_N * PITCH + 9, W.rows, "cl-m-axis");
  // the colour key, on its own line under the last cells: A0's reading 0 .. 1023, as the cells take it (so a
  // dark cell reads as 0, not as a pressed crossing)
  {
    const xr = X0 + (DRIVE_N - 1) * PITCH + CELL;
    const y = Y0 + SENSE_N * PITCH + 23;
    const n = 12;
    const sw = 2.6;
    const kx = xr - 25 - n * sw;
    label(svg, xr, y, "1023", "cl-m-axis", "end");
    for (let i = 0; i < n; i++) el("rect", { x: kx + i * sw, y: y - 6.5, width: sw + 0.3, height: 5, style: `fill:${viridisCss(VIRIDIS_RGB, i / (n - 1))}` }, svg);
    label(svg, kx - 3, y, "0", "cl-m-axis", "end");
  }
  const cells: SVGRectElement[] = [];
  for (let s = 0; s < SENSE_N; s++)
    for (let d = 0; d < DRIVE_N; d++) cells.push(el("rect", { x: X0 + d * PITCH, y: Y0 + s * PITCH, width: CELL, height: CELL, rx: 4, class: "cl-cell cl-mcell" }, svg));
  const update = (st: TogetherState) => {
    const cur = st.s * DRIVE_N + st.d;
    cells.forEach((c, i) => {
      const v = st.cells[i];
      c.classList.toggle("is-read", v !== null);
      c.classList.toggle("is-cur", i === cur);
      c.style.fill = v === null ? "" : viridisCss(VIRIDIS_RGB, v / 1023);
    });
    svg.setAttribute("aria-label", fillW(W.cellAria, { n: st.cells.filter((v) => v !== null).length, lit: st.cells.filter((v) => v !== null && v > 0).length }));
  };
  update(st0);
  return { update };
}

/** {name} placeholders (the drawing keeps its own: no i18n import here). */
function fillW(s: string, vars: Record<string, string | number>): string {
  return s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}
