// The gold-fingers view of chips-lab (Lesson 2.2 step 3): the ends of the pad's two tails, side by side and TO SCALE
// (18.5 design units per mm): the Top FPC's 12 fingers and the Bottom FPC's 32, 0.3 × 3.0 mm each at a 0.5 mm pitch
// (shared/data: fpc_top.fingers.*, fpc_bot.fingers.*), in the amber polyimide of the FPC photo look with ENIG fingers
// (src/ui/enig.ts) and the copper traces under the coverlay running up from each finger. A tail is 0.5 mm × (fingers + 1)
// wide, its fingers stopping a little short of the tip (as the Gerbers draw them).
// Starts clean: the tails sit in the middle with a one-line hint under them; a click on a finger (or "Show the sizes")
// moves them up and opens two small panels under them: the fingers up close
// (34 units per mm) with their width, pitch and length dimensioned, and the tail's end seen from the side, 0.3 mm thick
// with its stiffener (shared/data stack.fpcBuild.goldFingerThickness, an order option; the FPC itself is 0.2 mm, so the
// split shown between film and stiffener is inferred).
import { enigDefs, enigFill, enigGrain } from "../../ui/enig";
import { el, label, poly, rrect, type Frame } from "./svg";

export interface FingersState {
  /** The finger picked: tail 0 = Top FPC, 1 = Bottom FPC, and its index; null = none (the clean start). */
  sel: { tail: 0 | 1; i: number } | null;
}
export const fingersState = (): FingersState => ({ sel: null });

export interface FingersFacts {
  /** Finger counts [top, bottom]. */
  count: [number, number];
  /** Width × length (mm). */
  size: [number, number];
  pitch: number;
  /** Total thickness at the fingers (mm) and the FPC's own (mm). */
  thick: number;
  fpc: number;
}
export interface FingersWords {
  top: string;
  bottom: string;
  hint: string;
  close: string;
  side: string;
  wide: string;
  pitch: string;
  long: string;
  thick: string;
  finger: string;
  fpc: string;
  stiff: string;
  pickAria: string;
}
export interface FingersHandlers {
  pick(tail: 0 | 1, i: number): void;
}
export interface FingersDrawing {
  update(st: FingersState): void;
}

const DW = 500;
const DH = 364;
const MM = 18.5; // design units per mm in the tails
const ZM = 34; // up close
const TIP = 134;
const GAP = 46;
const TIP_GAP = 0.45; // mm from the fingers' end to the tail's tip (the Gerbers: 0.405 and 0.5 mm)

export function drawFingers(f: Frame, st0: FingersState, F: FingersFacts, W: FingersWords, H: FingersHandlers, uid: string): FingersDrawing {
  const g = f.g;
  enigDefs(f.defs, uid);
  // the film's fade at the top (the tail goes on up to the pad)
  const fade = el("linearGradient", { id: `${uid}-fade`, x1: 0, y1: 0, x2: 0, y2: 1 }, f.defs);
  el("stop", { offset: 0, "stop-color": "#fff", "stop-opacity": 0 }, fade);
  el("stop", { offset: 0.3, "stop-color": "#fff", "stop-opacity": 1 }, fade);
  const mask = el("mask", { id: `${uid}-mask`, maskUnits: "userSpaceOnUse", x: 0, y: -10, width: DW, height: TIP + 20 }, f.defs);
  el("rect", { x: 0, y: -10, width: DW, height: TIP + 20, fill: `url(#${uid}-fade)` }, mask);

  const [w, len] = F.size;
  const widthOf = (n: number) => F.pitch * (n + 1) * MM;
  const total = widthOf(F.count[0]) + GAP + widthOf(F.count[1]);
  const x0 = [(DW - total) / 2, (DW - total) / 2 + widthOf(F.count[0]) + GAP];
  const fingerEls: SVGPathElement[][] = [[], []];
  // the tails, their labels and the hint: one group, lowered to the middle while nothing is picked (chips-lab.css)
  const top = el("g", { class: "cl-ftop" }, g);
  const fy1 = TIP - TIP_GAP * MM;
  const fy0 = fy1 - len * MM;

  for (const t of [0, 1] as const) {
    const n = F.count[t];
    const tw = widthOf(n);
    const tg = el("g", { class: "cl-tail", mask: `url(#${uid}-mask)` }, top);
    el("path", { d: rrect(x0[t], -10, tw, TIP + 10, 1.5), class: "cl-pi" }, tg);
    for (let i = 0; i < n; i++) {
      const cx = x0[t] + F.pitch * (i + 1) * MM;
      // the trace under the coverlay, up from the finger
      el("rect", { x: cx - 2.15, y: -10, width: 4.3, height: fy0 + 10 + 2, class: "cl-pi-trace" }, tg);
    }
    const fg = el("g", { class: "cl-fingers" }, top);
    for (let i = 0; i < n; i++) {
      const cx = x0[t] + F.pitch * (i + 1) * MM;
      const d = rrect(cx - (w * MM) / 2, fy0, w * MM, len * MM, 0.8);
      const face = enigFill(el("path", { d, class: "cl-finger" }, fg), uid);
      enigGrain(fg, uid, d);
      fingerEls[t].push(face);
    }
    // a wide, invisible hit band over the fingers: a click picks the nearest finger
    const hit = el("rect", { x: x0[t], y: fy0 - 8, width: tw, height: len * MM + 16 + TIP_GAP * MM, class: "cl-hit cl-pick", tabindex: 0, role: "button" }, top);
    hit.setAttribute("aria-label", fillW(W.pickAria, { tail: fillW(t === 0 ? W.top : W.bottom, { n }) }));
    const pickAt = (clientX: number) => {
      const r = (hit as SVGGraphicsElement).getBoundingClientRect();
      const fx = ((clientX - r.left) / r.width) * tw;
      const i = Math.max(0, Math.min(n - 1, Math.round(fx / (F.pitch * MM)) - 1));
      H.pick(t, i);
    };
    hit.addEventListener("click", (e) => pickAt((e as MouseEvent).clientX));
    hit.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        H.pick(t, Math.floor(n / 2));
      }
    });
    label(top, x0[t] + tw / 2, TIP + 20, fillW(t === 0 ? W.top : W.bottom, { n }), "cl-t", "middle");
  }

  // ---- the hint, one quiet line under the tails' names: a small magnifier, then the words (centred together; if the
  // words can't be measured yet, the magnifier sits above them)
  const hint = el("g", { class: "cl-hintpill" }, top);
  const hintY = TIP + 50;
  const hintT = label(hint, DW / 2, hintY, W.hint, "cl-t cl-t-dim", "middle");
  const loupe = el("g", {}, hint);
  el("circle", { cx: -2, cy: -2, r: 5.5, class: "cl-loupe" }, loupe);
  el("path", { d: poly([[2, 2], [6, 6]]), class: "cl-loupe" }, loupe);
  let hw = 0;
  try {
    hw = hintT.getComputedTextLength();
  } catch {
    hw = 0;
  }
  if (hw > 0) {
    hintT.setAttribute("x", String(DW / 2 + 10));
    loupe.setAttribute("transform", `translate(${DW / 2 - hw / 2 - 4} ${hintY - 3.5})`);
  } else loupe.setAttribute("transform", `translate(${DW / 2} ${hintY - 20})`);

  // ---- the lower band: the two panels, once a finger is picked
  const PX = 20;
  const PY = 174;
  const PW = 250;
  const PH = 184;
  const band = el("g", { class: "cl-zoom" }, g);

  // up close: seven fingers at ZM units per mm, the middle one picked
  el("path", { d: rrect(PX, PY, PW, PH, 9), class: "cl-panel" }, band);
  label(band, PX + 12, PY + 17, W.close, "cl-t cl-t-dim");
  const zx = PX + 98; // the middle finger's centre
  const zy0 = PY + 28;
  const zl = len * ZM;
  const ztip = zy0 + zl + TIP_GAP * ZM;
  const zclip = el("clipPath", { id: `${uid}-zclip` }, f.defs);
  el("rect", { x: PX + 1, y: PY + 23, width: PW - 2, height: ztip - PY - 23 }, zclip);
  const zg = el("g", { "clip-path": `url(#${uid}-zclip)` }, band);
  // a strip of the tail, seven fingers wide (it goes on both ways: its ends fade out)
  const zx0 = zx - 3.5 * F.pitch * ZM;
  const zx1 = zx + 3.5 * F.pitch * ZM;
  const fadeZ = el("linearGradient", { id: `${uid}-fadeZ`, x1: 0, y1: 0, x2: 1, y2: 0 }, f.defs);
  for (const [o, a] of [[0, 0], [0.12, 1], [0.88, 1], [1, 0]] as const) el("stop", { offset: o, "stop-color": "#fff", "stop-opacity": a }, fadeZ);
  const maskZ = el("mask", { id: `${uid}-maskZ`, maskUnits: "userSpaceOnUse", x: zx0 - 14, y: PY, width: zx1 - zx0 + 28, height: PH }, f.defs);
  el("rect", { x: zx0 - 14, y: PY, width: zx1 - zx0 + 28, height: PH, fill: `url(#${uid}-fadeZ)` }, maskZ);
  el("rect", { x: zx0 - 14, y: PY + 20, width: zx1 - zx0 + 28, height: ztip - PY - 20, class: "cl-pi", mask: `url(#${uid}-maskZ)` }, zg);
  for (let k = -3; k <= 3; k++) {
    const cx = zx + k * F.pitch * ZM;
    el("rect", { x: cx - (0.254 * ZM) / 2, y: PY + 20, width: 0.254 * ZM, height: zy0 - PY - 18, class: "cl-pi-trace" }, zg);
    const d = rrect(cx - (w * ZM) / 2, zy0, w * ZM, zl, 1.2);
    enigFill(el("path", { d, class: k === 0 ? "cl-finger is-sel" : "cl-finger" }, zg), uid);
    enigGrain(zg, uid, d);
  }
  // dimension lines: the length right of the fingers, the width and the pitch under the tip
  const dim = (x1: number, y1: number, x2: number, y2: number) => el("path", { d: poly([[x1, y1], [x2, y2]]), class: "cl-dim" }, band);
  const tick = (x: number, y: number) => el("path", { d: poly([[x - 4, y], [x + 4, y]]), class: "cl-dim" }, band);
  const vtick = (x: number, y: number) => el("path", { d: poly([[x, y - 4], [x, y + 4]]), class: "cl-dim" }, band);
  const lx = zx + 3.5 * F.pitch * ZM + 5;
  dim(lx, zy0, lx, zy0 + zl);
  tick(lx, zy0);
  tick(lx, zy0 + zl);
  label(band, lx + 8, zy0 + zl / 2 + 4, fillW(W.long, { v: len.toFixed(1) }), "cl-t cl-t-dim");
  const wy = ztip + 12;
  const wl = zx - (w * ZM) / 2;
  const wr = zx + (w * ZM) / 2;
  el("path", { d: `${poly([[wl, ztip + 2], [wl, wy + 4]])} ${poly([[wr, ztip + 2], [wr, wy + 4]])}`, class: "cl-dim cl-dim-ext" }, band);
  dim(wl, wy, wr, wy);
  vtick(wl, wy);
  vtick(wr, wy);
  label(band, wl - 6, wy + 4, fillW(W.wide, { v: String(w) }), "cl-t cl-t-dim", "end");
  const p0 = zx;
  const p1 = zx + F.pitch * ZM;
  const py2 = wy + 15;
  el("path", { d: `${poly([[p1, ztip + 2], [p1, py2 + 4]])} ${poly([[p0, wy + 6], [p0, py2 + 4]])}`, class: "cl-dim cl-dim-ext" }, band);
  dim(p0, py2, p1, py2);
  vtick(p0, py2);
  vtick(p1, py2);
  label(band, p1 + 7, py2 + 4, fillW(W.pitch, { v: String(F.pitch) }), "cl-t cl-t-dim");

  // the side view: the tail's last few mm, the height drawn larger than the length (it is only 0.3 mm)
  const SX = 282;
  const SW = DW - PX - SX;
  el("path", { d: rrect(SX, PY, SW, PH, 9), class: "cl-panel" }, band);
  label(band, SX + 12, PY + 17, W.side, "cl-t cl-t-dim");
  const sx0 = SX + 14;
  const sx1 = SX + 106; // the tip
  const VZ = 160; // vertical units per mm
  const sTop = PY + 84;
  const fpcH = F.fpc * VZ;
  const stH = (F.thick - F.fpc) * VZ;
  const fadeL = el("linearGradient", { id: `${uid}-fadeL`, x1: 0, y1: 0, x2: 1, y2: 0 }, f.defs);
  el("stop", { offset: 0, class: "cl-fadeL-a" }, fadeL);
  el("stop", { offset: 1, class: "cl-fadeL-b" }, fadeL);
  el("rect", { x: sx0, y: sTop, width: sx1 - sx0, height: fpcH, class: "cl-pi" }, band);
  el("rect", { x: sx0, y: sTop + fpcH, width: sx1 - sx0, height: stH, class: "cl-stiff" }, band);
  const gx1 = sx1 - TIP_GAP * ZM;
  enigFill(el("path", { d: rrect(sx0, sTop - 3.5, gx1 - sx0, 4, 0.6), class: "cl-finger" }, band), uid);
  label(band, sx0 + 52, sTop + fpcH / 2 + 3.5, W.fpc, "cl-t cl-t-onpi", "middle");
  label(band, sx0 + 52, sTop + fpcH + stH / 2 + 3.5, W.stiff, "cl-t cl-t-onstiff", "middle");
  // the film goes on to the left: fade it out there
  el("rect", { x: sx0 - 1, y: sTop - 5, width: 30, height: fpcH + stH + 10, fill: `url(#${uid}-fadeL)` }, band);
  // thickness
  const tx = sx1 + 14;
  dim(tx, sTop - 3.5, tx, sTop + fpcH + stH);
  tick(tx, sTop - 3.5);
  tick(tx, sTop + fpcH + stH);
  label(band, tx + 8, sTop + (fpcH + stH) / 2 + 3, fillW(W.thick, { v: String(F.thick) }), "cl-t cl-t-dim");
  // the gold finger's name, with a short straight leader
  const gxm = sx0 + 62;
  el("path", { d: poly([[gxm, sTop - 4], [gxm, sTop - 22]]), class: "cl-leader" }, band);
  el("circle", { cx: gxm, cy: sTop - 2, r: 1.6, class: "cl-leader-dot" }, band);
  label(band, gxm, sTop - 27, W.finger, "cl-t", "middle");

  const update = (st: FingersState) => {
    for (const t of [0, 1] as const) fingerEls[t].forEach((e, i) => e.classList.toggle("is-sel", st.sel?.tail === t && st.sel.i === i));
    band.classList.toggle("is-on", st.sel !== null);
    hint.classList.toggle("is-on", st.sel === null);
    top.classList.toggle("is-low", st.sel === null);
  };
  update(st0);
  return { update };
}

function fillW(s: string, vars: Record<string, string | number>): string {
  return s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

export const FINGERS_SIZE = { w: DW, h: DH };
