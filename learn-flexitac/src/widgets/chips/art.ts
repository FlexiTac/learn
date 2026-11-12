// The side card's pictures for chips-lab (src/widgets/chips-lab.ts):
//  - the wiring pictures: the Nano drawn as a labelled pin strip on the left, the chip on the right with its pin names,
//    one straight coloured wire per connection, as the reading board has them (shared/data facts board.muxSelect,
//    board.A0, board.595chain, board.clockTie, board.OE; #SRCLR to 5 V per the schematic). Each wire in the colour of
//    its job, as Lesson 2.5's schematic and Fig 3 have them: the drive path pink (D2's DATA, D3's clocks, the chain,
//    the outputs), the sense path teal (D4-D7 to the select pins, D8 to E#, COM to A0), power and ground grey (5 V, GND,
//    and #SRCLR and #OE tied to them). Wires carry the state (chips-lab.ts): a wire at 1 (a select pin, E#, DATA) and
//    a clock just ticked are lit in their path's colour, a 0 is a quiet tint of it; A0's wire goes quiet while E# is
//    HIGH (no channel reaches it). A junction dot is drawn right after the wire it belongs to, so chips-lab.css can
//    light it with that wire.
//  - "where else" line drawings, no brands: a memory stick, a graphics card and a game cartridge (gold fingers), a laptop,
//    a camera module and a printer (flat cables).
// No words of its own: chips-lab.ts passes them.
import { el, ground, label, poly, rrect, zigzag } from "./svg";

export interface PinRow {
  nano?: string;
  chip: string;
  cls: string;
  /** A branch: this chip pin shares the Nano pin of the row above (a junction on that wire). */
  branch?: boolean;
}

/** A Nano strip and one chip, joined row by row (drawn 228 units wide: about 1:1 in the side card). Returns the wires
 *  by row index (to light them). */
export function wiringPicture(
  svg: SVGSVGElement,
  opts: { nanoTitle: string; chipTitle: string; rows: PinRow[]; chipX?: [number, number]; outs?: string; qh?: string; a0Row?: number; kohm?: string },
): SVGPathElement[] {
  svg.replaceChildren();
  const ROW = 19;
  const top = 26;
  const rowsY = opts.rows.map((_, i) => top + 11 + i * ROW);
  const bottom = rowsY[rowsY.length - 1] + 12;
  const extra = opts.a0Row !== undefined ? 42 : 4;
  const H = bottom + extra;
  const W = 228;
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  const NX0 = 3;
  const NX1 = 52;
  const [CX0, CX1] = opts.chipX ?? [150, 224];
  // the Nano strip
  label(svg, NX0, 15, opts.nanoTitle, "cl-w-title");
  el("path", { d: rrect(NX0, top, NX1 - NX0, bottom - top, 5), class: "cl-w-nano" }, svg);
  // the chip
  label(svg, CX1, 15, opts.chipTitle, "cl-w-title", "end");
  el("path", { d: rrect(CX0, top, CX1 - CX0, bottom - top, 4), class: "cl-w-chip" }, svg);
  el("circle", { cx: CX1 - 7, cy: top + 6, r: 2, class: "cl-w-dot1" }, svg);
  const wires: SVGPathElement[] = [];
  let lastNanoY = 0;
  const jx = NX1 + (CX0 - NX1) * 0.48;
  const rx = NX1 + 26; // A0's resistor, on A0's wire
  opts.rows.forEach((r, i) => {
    const y = rowsY[i];
    el("rect", { x: CX0 - 5, y: y - 1.6, width: 5, height: 3.2, class: "cl-w-lead" }, svg);
    label(svg, CX0 + 6, y + 3.5, r.chip, "cl-w-pin cl-w-pin-chip");
    if (r.nano) {
      el("rect", { x: NX1 - 6, y: y - 3, width: 6, height: 6, rx: 1, class: "cl-w-pad" }, svg);
      label(svg, NX1 - 9, y + 3.5, r.nano, "cl-w-pin cl-w-pin-nano", "end");
      wires.push(el("path", { d: poly([[NX1, y], [CX0 - 5, y]]), class: `cl-w ${r.cls}` }, svg));
      if (i === opts.a0Row) el("circle", { cx: rx, cy: y, r: 2.3, class: `cl-w-joint ${r.cls}` }, svg);
      lastNanoY = y;
    } else if (r.branch) {
      wires.push(el("path", { d: poly([[jx, lastNanoY], [jx, y], [CX0 - 5, y]]), class: `cl-w ${r.cls}` }, svg));
      el("circle", { cx: jx, cy: lastNanoY, r: 2.3, class: `cl-w-joint ${r.cls}` }, svg);
    }
  });
  // the chip's other side: its 8 outputs, and QH′
  if (opts.outs) {
    const y0 = rowsY[0];
    const y1 = rowsY[3];
    for (let k = 0; k < 8; k++) {
      const y = y0 + ((y1 - y0) * k) / 7;
      el("path", { d: poly([[CX1, y], [CX1 + 6, y]]), class: "cl-w cl-w-out cl-w-thin" }, svg);
    }
    label(svg, CX1 + 9, (y0 + y1) / 2 + 3.5, opts.outs, "cl-w-pin cl-w-pin-out");
  }
  if (opts.qh) {
    const y = rowsY[rowsY.length - 1];
    el("path", { d: poly([[CX1, y], [CX1 + 6, y]]), class: "cl-w cl-w-out" }, svg);
    label(svg, CX1 + 9, y + 3.5, opts.qh, "cl-w-pin cl-w-pin-out");
  }
  // A0's resistor to ground, under its wire (its junction dot is drawn with the wire, above): the resistor in ink, as
  // a part, its ground grey
  if (opts.a0Row !== undefined) {
    const y = rowsY[opts.a0Row];
    el("path", { d: zigzag(rx, y, y + 28, 4.5), class: "cl-w cl-w-plain" }, svg);
    ground(svg, rx, y + 35, "cl-w cl-w-gnd");
    label(svg, rx + 9, y + 19, opts.kohm ?? "", "cl-w-pin cl-w-pin-out");
  }
  return wires;
}

/** Four 74HC595s in a chain: D2 into the first, D3 to every chip's clocks, each QH′ into the next SER. */
export function chainPicture(svg: SVGSVGElement, W: { nanoTitle: string; chips: string[]; ser: string; clk: string; qh: string; lines: string[] }): { data: SVGPathElement; clock: SVGPathElement[] } {
  svg.replaceChildren();
  const Wd = 228;
  const H = 222;
  svg.setAttribute("viewBox", `0 0 ${Wd} ${H}`);
  const NX0 = 3;
  const NX1 = 52;
  const CX0 = 140;
  const CX1 = 196;
  const CH = 38;
  const ys = [26, 75, 124, 173];
  label(svg, NX0, 15, W.nanoTitle, "cl-w-title");
  el("path", { d: rrect(NX0, 26, NX1 - NX0, 64, 5), class: "cl-w-nano" }, svg);
  const yD2 = ys[0] + 11;
  const yD3 = ys[0] + 27;
  for (const [y, t] of [[yD2, "D2"], [yD3, "D3"]] as const) {
    el("rect", { x: NX1 - 6, y: y - 3, width: 6, height: 6, rx: 1, class: "cl-w-pad" }, svg);
    label(svg, NX1 - 9, y + 3.5, t, "cl-w-pin cl-w-pin-nano", "end");
  }
  const data = el("path", { d: poly([[NX1, yD2], [CX0 - 5, yD2]]), class: "cl-w cl-w-data" }, svg);
  const clock: SVGPathElement[] = [];
  const BUS = 104; // (clear of the label under the Nano, and left of the chain wires' jog at CX0 - 20)
  clock.push(el("path", { d: poly([[NX1, yD3], [BUS, yD3], [BUS, ys[3] + 27]]), class: "cl-w cl-w-clk" }, svg));
  label(svg, NX0, 26 + 64 + 15, W.clk, "cl-w-pin cl-w-pin-out");
  ys.forEach((y, k) => {
    el("path", { d: rrect(CX0, y, CX1 - CX0, CH, 4), class: "cl-w-chip" }, svg);
    label(svg, (CX0 + CX1) / 2 + 3, y + 16, W.chips[k], "cl-w-pin cl-w-pin-chip", "middle");
    label(svg, (CX0 + CX1) / 2 + 3, y + 29, W.lines[k], "cl-w-pin cl-w-pin-chip cl-w-pin-sub", "middle");
    el("rect", { x: CX0 - 5, y: y + 9.4, width: 5, height: 3.2, class: "cl-w-lead" }, svg);
    el("rect", { x: CX0 - 5, y: y + 25.4, width: 5, height: 3.2, class: "cl-w-lead" }, svg);
    if (k === 0) label(svg, CX0 - 8, y + 7, W.ser, "cl-w-pin cl-w-pin-out", "end");
    // its clocks, from the bus
    clock.push(el("path", { d: poly([[BUS, y + 27], [CX0 - 5, y + 27]]), class: "cl-w cl-w-clk" }, svg));
    el("circle", { cx: BUS, cy: y + 27, r: 2.2, class: "cl-w-joint cl-w-clk" }, svg);
    // QH′ on to the next chip's SER
    if (k < 3) {
      const yn = ys[k + 1] + 11;
      el("path", { d: poly([[CX1, y + 30], [CX1 + 8, y + 30], [CX1 + 8, y + CH + 5.5], [CX0 - 20, y + CH + 5.5], [CX0 - 20, yn], [CX0 - 5, yn]]), class: "cl-w cl-w-chain" }, svg);
    }
  });
  label(svg, CX1 + 11, ys[0] + 33.5, W.qh, "cl-w-pin cl-w-pin-out");
  return { data, clock };
}

// ---- "where else": 80 × 54 line drawings
const ICON_W = 80;
const ICON_H = 54;
function iconSvg(): SVGSVGElement {
  const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  s.setAttribute("viewBox", `0 0 ${ICON_W} ${ICON_H}`);
  s.setAttribute("class", "cl-use-svg");
  s.setAttribute("aria-hidden", "true");
  return s;
}
const fingersRow = (g: Element, x0: number, x1: number, y: number, h: number, step = 2.6, skip?: [number, number]) => {
  for (let x = x0; x <= x1; x += step) {
    if (skip && x > skip[0] && x < skip[1]) continue;
    el("rect", { x: x, y, width: step * 0.55, height: h, class: "cl-use-gold" }, g);
  }
};

export function useIcon(kind: "ram" | "gpu" | "cart" | "laptop" | "camera" | "printer"): SVGSVGElement {
  const s = iconSvg();
  if (kind === "ram") {
    el("path", { d: rrect(4, 14, 72, 26, 2), class: "cl-use-board" }, s);
    for (let i = 0; i < 4; i++) el("rect", { x: 9 + i * 17, y: 18, width: 11, height: 11, rx: 1, class: "cl-use-chip" }, s);
    fingersRow(s, 6, 73, 33, 6, 2.6, [41, 46]);
    el("path", { d: "M42 40 V36 H45 V40", class: "cl-use-line" }, s);
  } else if (kind === "gpu") {
    el("path", { d: rrect(10, 8, 66, 32, 3), class: "cl-use-board" }, s);
    el("path", { d: "M5 4 H10 V46 H5 Z", class: "cl-use-line" }, s);
    el("circle", { cx: 32, cy: 24, r: 10, class: "cl-use-line" }, s);
    el("circle", { cx: 56, cy: 24, r: 10, class: "cl-use-line" }, s);
    el("circle", { cx: 32, cy: 24, r: 2.4, class: "cl-use-chip" }, s);
    el("circle", { cx: 56, cy: 24, r: 2.4, class: "cl-use-chip" }, s);
    el("path", { d: "M20 40 H66 V45 H20 Z", class: "cl-use-board" }, s);
    fingersRow(s, 21, 64, 40.5, 4.5, 2.4, [30, 34]);
  } else if (kind === "cart") {
    el("path", { d: "M18 44 V10 Q18 4 24 4 H56 Q62 4 62 10 V44 Z", class: "cl-use-board" }, s);
    el("path", { d: rrect(24, 11, 32, 20, 2), class: "cl-use-line" }, s);
    el("path", { d: "M24 44 H56 V51 H24 Z", class: "cl-use-pcb" }, s);
    fingersRow(s, 25.5, 54, 45, 6, 2.5);
  } else if (kind === "laptop") {
    el("path", { d: rrect(16, 4, 48, 32, 2.5), class: "cl-use-board" }, s);
    el("path", { d: rrect(20, 8, 40, 24, 1), class: "cl-use-line" }, s);
    el("path", { d: "M8 42 L16 37 H64 L72 42 V45 H8 Z", class: "cl-use-board" }, s);
    // the flat cable through the hinge, seen through the case
    el("path", { d: "M37 26 V43", class: "cl-use-ffc" }, s);
    el("path", { d: "M37 26 V30", class: "cl-use-tab" }, s);
  } else if (kind === "camera") {
    el("path", { d: rrect(22, 4, 30, 28, 2), class: "cl-use-pcb" }, s);
    el("circle", { cx: 37, cy: 18, r: 9, class: "cl-use-board" }, s);
    el("circle", { cx: 37, cy: 18, r: 4.5, class: "cl-use-chip" }, s);
    el("path", { d: "M37 32 V44 Q37 48 41 48 H66", class: "cl-use-ffc" }, s);
    el("path", { d: "M62 48 H68", class: "cl-use-tab" }, s);
  } else {
    el("path", { d: rrect(6, 18, 68, 26, 3), class: "cl-use-board" }, s);
    el("path", { d: "M22 18 V8 H58 V18", class: "cl-use-line" }, s);
    el("path", { d: "M12 25 H68", class: "cl-use-line cl-use-faint" }, s);
    el("path", { d: rrect(30, 21, 12, 9, 1.5), class: "cl-use-chip" }, s);
    el("path", { d: "M36 30 Q36 39 46 39 H60 Q66 39 66 33", class: "cl-use-ffc" }, s);
  }
  return s;
}
