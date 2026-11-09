// The shift-register view of chips-lab (Lesson 2.2 step 2, "Eight boxes in a row"): the 74HC595 drawn as a row of
// eight boxes, QA to QH. DATA (the Nano's D2) is the bit waiting at the left; CLOCK moves every bit one box along and
// lets DATA into QA (its digit slides from DATA's box straight into QA), the bit in QH falling out to QH′; LATCH copies
// the boxes at once into a second row of eight under them, the output latch, which drives the eight outputs, each
// lighting an LED (on the reading board: a drive line). Chained, four chips stand in four rows (the latch then a thin
// band under each): each QH′ feeds the next chip's first box, so the 1 walks all 32 outputs (U2: drive lines 1-8 …
// U5: 25-32, as on the board). The latch is taught separately, as the chip has it; the reading board ties it to the
// clock (chips-lab.ts says so). State changes are pure (clock / latch below); the drawing animates from what it shows
// to the new state.
import { el, ease, label, poly, rrect, type Frame } from "./svg";

export interface ShiftState {
  /** The bit on DATA (D2). */
  data: 0 | 1;
  /** Four chips in a chain (32 boxes) or one (8). */
  chain: boolean;
  /** The shift stage, QA first (8 or 32). */
  boxes: number[];
  /** The output latch, what the LEDs show. */
  outs: number[];
}
export const shiftState = (): ShiftState => ({ data: 1, chain: false, boxes: Array(8).fill(0), outs: Array(8).fill(0) });
/** One clock: every bit one box along, DATA into the first; returns the bit that fell out of the last box (QH′). */
export function clockOnce(st: ShiftState): number {
  const out = st.boxes[st.boxes.length - 1];
  st.boxes = [st.data, ...st.boxes.slice(0, -1)];
  return out;
}
export function latchOnce(st: ShiftState): void {
  st.outs = st.boxes.slice();
}
export function setChain(st: ShiftState, on: boolean): void {
  st.chain = on;
  const n = on ? 32 : 8;
  st.boxes = Array(n).fill(0);
  st.outs = Array(n).fill(0);
}

export interface ShiftWords {
  data: string;
  latch: string;
  clock: string;
  qhp: string;
  outputs: string;
  rowLines: string;
  dataAria: string;
}
export interface ShiftHandlers {
  data(): void;
}
export interface ShiftDrawing {
  /** Show `st` at once. */
  update(st: ShiftState): void;
  /** Animate one clock into `st` (the state after it); `spill` = the bit that left the last box. */
  clock(st: ShiftState, spill: number): void;
  /** Animate a latch into `st` (`quiet`: the walking 1, a chain flashes only the row that holds the 1). */
  latch(st: ShiftState, quiet?: boolean): void;
  destroy(): void;
}

// one chip: the shift boxes, a second row of eight (the output latch) under them, the LEDs under that
// (narrow enough to scale up on a 1366-1440 px stage, whose drawing box is about 1.2 times as wide as it is tall)
const DW1 = 430;
const B1 = 36;
const P1 = 42;
const X1 = 60; // QA's box
const Y1 = 62; // the shift boxes' top
const LY1 = Y1 + B1 + 34; // the latch boxes' top
const LED1 = 13;
const LEDY1 = LY1 + B1 + 44 + LED1; // the LEDs' centres
// four chips
const DW4 = 500;
const B4 = 31;
const P4 = 36;
const X4 = 96;
const Y4 = 24;
const ROW4 = 72;

export function drawShift(f: Frame, st0: ShiftState, W: ShiftWords, H: ShiftHandlers, reduced: boolean): ShiftDrawing {
  const g = f.g;
  const chain = st0.chain;
  const n = chain ? 32 : 8;
  const rows = chain ? 4 : 1;
  const B = chain ? B4 : B1;
  const PITCH = chain ? P4 : P1;
  const X0 = chain ? X4 : X1;
  const rowY = (r: number) => (chain ? Y4 + r * ROW4 : Y1);
  const boxX = (i: number) => X0 + (i % 8) * PITCH;
  const boxY = (i: number) => rowY(Math.floor(i / 8));
  const rowR = X0 + 7 * PITCH + B; // a row's right end
  const ledY = (r: number) => (chain ? rowY(r) + B + 15 : LEDY1);
  const LED = chain ? 7 : LED1;
  const digitDy = chain ? 5 : 7; // a digit's baseline below its box's middle
  let shown = st0.boxes.slice();
  const timers: number[] = [];
  let raf = 0;
  let snapRaf = 0;

  // ---- one chip: its outline round both rows, with the clock line running over every shift box
  const clockEls: SVGElement[] = [];
  if (!chain) {
    el("path", { d: rrect(X0 - 12, 18, rowR - X0 + 24, LY1 + B + 12 - 18, 10), class: "cl-chip-outline" }, g);
    label(g, rowR + 6, 33, "74HC595", "cl-t cl-t-dim", "end");
    const by = Y1 - 12;
    clockEls.push(el("path", { d: poly([[X0 - 2, by], [rowR + 2, by]]), class: "cl-clockline" }, g));
    for (let i = 0; i < 8; i++) clockEls.push(el("path", { d: poly([[boxX(i) + B / 2, by], [boxX(i) + B / 2, Y1]]), class: "cl-clockline" }, g));
    label(g, X0 - 2, by - 6, W.clock, "cl-t cl-t-dim");
  }

  // ---- DATA: the bit waiting at the first box, outside the chip (the Nano's D2)
  const dx = X0 - PITCH - (chain ? 4 : 12);
  const dy = rowY(0);
  const dataG = el("g", { class: "cl-data", tabindex: 0, role: "button" }, g);
  el("rect", { x: dx - 6, y: dy - 22, width: B + 12, height: B + 28, class: "cl-hit" }, dataG);
  label(dataG, dx + B / 2, dy - 8, W.data, "cl-t cl-t-strong", "middle");
  el("path", { d: rrect(dx - 4, dy - 4, B + 8, B + 8, 10), class: "cl-focus" }, dataG);
  el("path", { d: rrect(dx, dy, B, B, chain ? 5 : 7), class: "cl-tog-box" }, dataG);
  const dataD = label(dataG, dx + B / 2, dy + B / 2 + digitDy, "1", chain ? "cl-tog-d cl-tog-d-s" : "cl-tog-d", "middle");
  const fire = () => H.data();
  dataG.addEventListener("click", fire);
  dataG.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fire();
    }
  });
  // its wire into the first box
  el("path", { d: poly([[dx + B, dy + B / 2], [X0 - 3, dy + B / 2]]), class: "cl-wire" }, g);

  // ---- the chain's links: each row's last box -> the next row's first (QH′ -> SER)
  if (chain) {
    for (let r = 0; r < 3; r++) {
      const y0 = rowY(r) + B / 2;
      const y1 = rowY(r + 1) + B / 2;
      const xr = rowR + 14;
      const yb = rowY(r) + B + 30;
      el("path", { d: poly([[rowR, y0], [xr, y0], [xr, yb], [X0 - 16, yb], [X0 - 16, y1], [X0 - 3, y1]]), class: "cl-wire" }, g);
    }
  }
  // the last QH′: out of the last box (one chip; in the chain, U5's QH′ is left unconnected, as on the board)
  const lastY = rowY(rows - 1) + B / 2;
  let qhp: SVGTextElement | null = null;
  if (!chain) {
    el("path", { d: poly([[rowR, lastY], [rowR + 18, lastY]]), class: "cl-wire" }, g);
    qhp = label(g, rowR + 21, lastY + 4, W.qhp, "cl-t cl-t-strong cl-qhp");
  }

  // ---- the boxes (shift stage) and their moving digits
  const boxes: SVGPathElement[] = [];
  for (let i = 0; i < n; i++) {
    boxes.push(el("path", { d: rrect(boxX(i), boxY(i), B, B, chain ? 5 : 7), class: "cl-box" }, g));
    if (!chain) label(g, boxX(i) + 5, boxY(i) + 11, `Q${"ABCDEFGH"[i]}`, "cl-t cl-t-dim cl-t-tiny");
  }
  // one group per row: digits at slots -1..7 (slot -1 holds the bit coming in). The first row's comes in from DATA's
  // own digit, so it starts exactly there and slides into QA (a little further than one pitch).
  const rowG: SVGGElement[] = [];
  const digits: SVGTextElement[][] = [];
  for (let r = 0; r < rows; r++) {
    const rg = el("g", { class: "cl-digits" }, g);
    rowG.push(rg);
    const ds: SVGTextElement[] = [];
    for (let s = -1; s < 8; s++) {
      const x = s < 0 && r === 0 ? dx + B / 2 : X0 + s * PITCH + B / 2;
      const y = rowY(r) + B / 2 + digitDy;
      ds.push(label(rg, x, y, "0", chain ? "cl-digit cl-digit-s" : "cl-digit", "middle"));
    }
    ds[0].classList.add("is-hidden");
    digits.push(ds);
  }
  const extra = X0 - dx - PITCH; // how much further DATA's bit travels than the others

  // ---- the latch and the outputs
  const latchBands: SVGElement[] = []; // what flashes on a latch, one entry per row
  const copyWires: SVGElement[] = [];
  const latchDigits: SVGTextElement[] = [];
  const outWires: SVGElement[] = [];
  const leds: SVGCircleElement[] = [];
  const ledHalo: SVGCircleElement[] = [];
  if (!chain) {
    // the output latch: a second row of eight boxes, each copied from the box above it on a latch
    const lg = el("g", { class: "cl-lrow" }, g);
    latchBands.push(lg);
    label(g, X0 - 18, LY1 + B / 2 + 4, W.latch, "cl-t cl-t-dim", "end");
    for (let i = 0; i < 8; i++) {
      const cx = boxX(i) + B / 2;
      copyWires.push(el("path", { d: poly([[cx, Y1 + B], [cx, LY1]]), class: "cl-wire cl-faint cl-copy" }, g));
      el("path", { d: rrect(boxX(i), LY1, B, B, 7), class: "cl-box cl-lbox" }, lg);
      latchDigits.push(label(lg, cx, LY1 + B / 2 + digitDy, "0", "cl-digit cl-ldigit", "middle"));
      // the output: quiet at 0 V, in the powered colour at 5 V
      outWires.push(el("path", { d: poly([[cx, LY1 + B], [cx, ledY(0) - LED]]), class: "cl-wire cl-out" }, g));
    }
  } else {
    for (let r = 0; r < 4; r++) {
      const ly = rowY(r) + B + 3;
      latchBands.push(el("rect", { x: X0 - 3, y: ly, width: rowR - X0 + 6, height: 3, rx: 1.5, class: "cl-latch" }, g));
    }
  }
  for (let i = 0; i < n; i++) {
    const r = Math.floor(i / 8);
    const cx = boxX(i) + B / 2;
    ledHalo.push(el("circle", { cx, cy: ledY(r), r: LED + 5, class: "cl-led-halo" }, g));
    leds.push(el("circle", { cx, cy: ledY(r), r: LED, class: "cl-led" }, g));
  }
  if (!chain) {
    label(g, X0 + (rowR - X0) / 2, ledY(0) + LED + 24, W.outputs, "cl-t cl-t-dim", "middle");
  } else {
    // each chip's name and its drive lines, right of its row
    for (let r = 0; r < 4; r++) {
      const lx = rowR + 32;
      label(g, lx, rowY(r) + B / 2 - 1, `U${r + 2}`, "cl-t cl-t-strong");
      label(g, lx, rowY(r) + B / 2 + 12, fillW(W.rowLines, { a: r * 8 + 1, b: r * 8 + 8 }), "cl-t cl-t-dim");
    }
  }

  // ---- paint
  const paintDigits = (bits: number[]) => {
    // (the digits jump back to their own boxes at once, without the fade: no ghost of the bit that came in)
    for (const rg of rowG) rg.classList.add("is-snap");
    for (let r = 0; r < rows; r++) {
      rowG[r].removeAttribute("transform");
      digits[r][0].removeAttribute("transform");
      for (let s = 0; s < 8; s++) {
        const b = bits[r * 8 + s];
        const d = digits[r][s + 1];
        d.textContent = String(b);
        d.classList.toggle("is-1", b === 1);
        d.classList.remove("is-out", "is-hidden");
      }
      digits[r][0].classList.add("is-hidden");
    }
    boxes.forEach((bx, i) => bx.classList.toggle("is-1", bits[i] === 1));
    cancelAnimationFrame(snapRaf);
    snapRaf = requestAnimationFrame(() => {
      snapRaf = requestAnimationFrame(() => rowG.forEach((rg) => rg.classList.remove("is-snap")));
    });
  };
  const paintOuts = (outs: number[]) => {
    leds.forEach((l, i) => l.classList.toggle("is-on", outs[i] === 1));
    ledHalo.forEach((l, i) => l.classList.toggle("is-on", outs[i] === 1));
    outWires.forEach((l, i) => l.classList.toggle("is-on", outs[i] === 1));
    latchDigits.forEach((d, i) => {
      d.textContent = String(outs[i]);
      d.classList.toggle("is-1", outs[i] === 1);
    });
  };
  const paintData = (st: ShiftState) => {
    dataD.textContent = String(st.data);
    dataG.classList.toggle("is-1", st.data === 1);
    dataG.setAttribute("aria-label", fillW(W.dataAria, { b: st.data }));
    dataG.setAttribute("aria-pressed", String(st.data === 1));
  };
  const clearTimers = () => {
    while (timers.length) clearTimeout(timers.pop());
    cancelAnimationFrame(raf);
  };
  const restart = (els: Element[], cls: string, ms: number) => {
    for (const e of els) {
      e.classList.remove(cls);
      void e.getBoundingClientRect();
      e.classList.add(cls);
    }
    timers.push(window.setTimeout(() => els.forEach((e) => e.classList.remove(cls)), ms));
  };

  const update = (st: ShiftState) => {
    clearTimers();
    shown = st.boxes.slice();
    paintDigits(shown);
    paintOuts(st.outs);
    paintData(st);
  };

  const flashQ = (spill: number) => {
    if (spill === 1 && qhp) restart([qhp], "is-flash", 700);
  };
  const clock = (st: ShiftState, spill: number) => {
    clearTimers();
    paintDigits(shown);
    paintData(st);
    if (clockEls.length) restart(clockEls, "is-tick", 380);
    if (reduced) {
      shown = st.boxes.slice();
      paintDigits(shown);
      flashQ(spill);
      return;
    }
    // the bit coming into each row: DATA for the first, the previous row's last bit for the others
    for (let r = 0; r < rows; r++) {
      const inc = r === 0 ? st.boxes[0] : shown[r * 8 - 1];
      const d0 = digits[r][0];
      d0.textContent = String(inc);
      d0.classList.toggle("is-1", inc === 1);
      d0.classList.remove("is-hidden");
      digits[r][8].classList.add("is-out");
    }
    const t0 = performance.now();
    const dur = 230;
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / dur);
      const k = ease(t);
      const x = PITCH * k;
      for (const rg of rowG) rg.setAttribute("transform", `translate(${Math.round(x * 100) / 100} 0)`);
      if (extra) digits[0][0].setAttribute("transform", `translate(${Math.round(extra * k * 100) / 100} 0)`);
      if (t < 1) raf = requestAnimationFrame(step);
      else {
        shown = st.boxes.slice();
        paintDigits(shown);
        flashQ(spill);
      }
    };
    raf = requestAnimationFrame(step);
  };

  /** `quiet` (the walking 1): in a chain, only the row that holds the 1 flashes, not all four at once. */
  const latch = (st: ShiftState, quiet = false) => {
    const flash = chain && quiet ? latchBands.filter((_, r) => st.outs.slice(r * 8, r * 8 + 8).some((b) => b === 1)) : latchBands;
    if (flash.length) restart(flash, "is-flash", 420);
    if (copyWires.length) restart(copyWires, "is-tick", 420);
    paintOuts(st.outs);
  };

  update(st0);
  return {
    update,
    clock,
    latch,
    destroy: () => {
      clearTimers();
      cancelAnimationFrame(snapRaf);
    },
  };
}

function fillW(s: string, vars: Record<string, string | number>): string {
  return s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

export const SHIFT_SIZE = { w: DW1, h: LEDY1 + LED1 + 34 };
export const SHIFT_SIZE_4 = { w: DW4, h: 318 };
