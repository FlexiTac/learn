// The "plug" view of chips-lab (Lesson 2.4 step 3, "Plug the pad in"): the whole chain from the pad to the reading board,
// cut through one line and seen from the side, not to scale (thicknesses enlarged): the pad's tail with its gold fingers
// -> an FFC extender (a tiny board with a socket on each side, as in Lesson 1.4) -> a flat cable -> FPC1, the reading
// board's socket for the Top FPC's 12-line tail. The cable's first end is already in the extender, locked; the learner
// makes the two other joints, in order (chips-lab.ts): at the extender, open its lock, slide the tail in and close it;
// then lift FPC1's latch, slide the cable's free end in and close it. The two kinds of socket differ (external):
//   - the extender's two sockets are top contact with a slide lock: the guide's Adafruit extenders (5203, 4523) take a
//     piece "with contacts pointing up", and their lock opens by prying "the two ears" out and closes by pushing them
//     back. So here the spring hangs from the roof, the tail and the cable's first end go in contacts up, and a black
//     lock (its ear at the mouth, its tongue under the piece) pulls straight out and pushes back in under the piece;
//   - FPC1 is step 2's kind (./ffc.ts), small: bottom contacts, a flip-up latch whose cam presses the piece onto a
//     spring (FPC1 and FPC2 are bottom-contact flip-top sockets, LCSC C283153 and the board photo), so the cable's free
//     end goes in contacts down. (The cable has its contacts on the same side at both ends, Type A-A, so on its way it
//     turns over; the side view leaves the turn out and just steps the cable down a level.)
// A piece turned over goes in just as easily but its contacts face away from the spring: nothing connects on that line
// (a small cross). The line lights (the drive path's quieter pink) from the pad as far as it is connected: along the tail
// to its gold fingers at once, on through the extender and the cable to the cable's free end once the tail's joint is
// made, and current dots run along all of it once both joints are made.
// Under the chain, in a panel, the joint being made up close: step 2's drawing (./ffc.ts; for the extender its top-contact
// kind), the tail into the extender or the cable into FPC1, moving with the chain; a soft halo in the chain marks which
// joint it is.
// Each joint moves on three numbers, as ./ffc.ts does (latch 0 closed .. 1 open, the extender's lock too; ins 0 out .. 1
// in; flip 0 contacts toward the socket's spring .. 1 turned over); go() eases both joints to a target together, and
// chips-lab.ts chains the moves.
import { drawFfc, FFC_SIZE, type FfcDrawing } from "./ffc";
import { el, ease, label, poly, rrect, type Frame } from "./svg";

export interface PlugPose {
  latch: number;
  ins: number;
  flip: number;
}
export interface PlugState {
  /** [the extender's socket (the tail), FPC1 (the cable's free end)] */
  j: [PlugPose, PlugPose];
  busy: boolean;
}
const pose0 = (): PlugPose => ({ latch: 0, ins: 0, flip: 0 });
export const plugState = (): PlugState => ({ j: [pose0(), pose0()], busy: false });
/** The joint conducts: the piece fully in, latched, contacts facing the spring. */
export const jointOk = (p: PlugPose) => p.ins > 0.99 && p.latch < 0.01 && p.flip < 0.5;
/** The joint to work on next (0 the extender, 1 FPC1), or 2 when both conduct. */
export const plugCur = (st: PlugState): 0 | 1 | 2 => (!jointOk(st.j[0]) ? 0 : !jointOk(st.j[1]) ? 1 : 2);

export interface PlugWords {
  tail: string;
  ext: string;
  cable: string;
  board: string;
  fpc1: string;
  /** The close-up's title, with {part}. */
  close: string;
  latch: string;
  spring: string;
  contacts: string;
  fingers: string;
  stiff: string;
}
export interface PlugDrawing {
  /** Ease both joints to `to`, then call `done`. */
  go(to: [PlugPose, PlugPose], done?: () => void): void;
  destroy(): void;
}

// ---- geometry (design units). One socket, in its own x from the mouth (0) to its back (SL), y up from the board's top:
const SL = 62;
const HX = 40; // the latch's hinge
const BUMP = 30; // the spring's top, under the piece's contacts
const Y0 = 150; // the boards' top
const YB = Y0 - 13; // a piece's underside, resting on the bump
const FILM = 6;
const STIFF = 6;
const YC = YB - (FILM + STIFF) / 2; // a piece's centre line (a flip turns about it)
const YF = YB - FILM / 2; // the film's centre: the conductor (a piece contacts down)
const YT = YB - FILM - STIFF; // a piece's top face, under a top-contact spring
const YFT = 2 * YC - YF; // the conductor of a piece contacts up
const RSP = Y0 - 27.5; // a top-contact spring's line, just under the roof
const SLIDE = 14; // how far the extender's lock pulls out
const EXT_OVER = 24; // the extender's board, past each mouth (so the lock pulled out still sits over it)
const DEEP = SL - 14; // how far a piece goes in
const OUT = 22; // how far out of the mouth it waits
const CONTACT: [number, number] = [2, 32]; // the bare contact, back from the piece's end
// the pieces
const XA = 102; // the extender's left mouth (the tail goes in here)
const XB = XA + 2 * SL; // its right mouth (the cable's first end, already in)
const BX = 350; // FPC1's mouth on the reading board
const FREE = 60; // the cable's free end that turns over
const RAMP = 16; // the bit of cable between its middle and that end
const STEP: [number, number] = [XB + 3, XB + 21]; // where the cable steps down from the extender's level to FPC1's
const TRACE_X1 = BX + SL + 50;
// the close-up: step 2's design (FFC_SIZE, its own units) at CS, in a panel under the chain
const CS = 1;
const PANEL = { x: 240 - (FFC_SIZE.w * CS) / 2 - 6, y: 208, w: FFC_SIZE.w * CS + 12, h: FFC_SIZE.h * CS + 26 };
const TOP_LIFT = 38; // the extender's close-up, lifted (its drawing has nothing above the socket's roof)
const DW = 480;
const DY0 = 68; // the design's top (the latch swung open)
const DH = PANEL.y + PANEL.h + 2 - DY0;

const tailEnd = (ins: number) => XA - OUT + (DEEP + OUT) * ins;
const cableEnd = (ins: number) => BX - OUT + (DEEP + OUT) * ins;

export function drawPlug(f: Frame, st0: PlugState, W: PlugWords, reduced: boolean, uid: string): PlugDrawing {
  const g = f.g;
  const pose: [PlugPose, PlugPose] = [{ ...st0.j[0] }, { ...st0.j[1] }];
  let raf = 0;

  // the tail fades out to the left (it goes on to the pad)
  const fade = el("linearGradient", { id: `${uid}-pfade`, x1: 0, y1: 0, x2: 1, y2: 0 }, f.defs);
  el("stop", { offset: 0, "stop-color": "#fff", "stop-opacity": 0 }, fade);
  el("stop", { offset: 0.16, "stop-color": "#fff", "stop-opacity": 1 }, fade);
  const mask = el("mask", { id: `${uid}-pmask`, maskUnits: "userSpaceOnUse", x: -20, y: DY0, width: XA + DEEP + 40, height: DH }, f.defs);
  el("rect", { x: -20, y: DY0, width: XA + DEEP + 40, height: DH, fill: `url(#${uid}-pfade)` }, mask);

  // ---- a soft halo behind the joint being made (under everything)
  const halo = el("path", { d: "", class: "cl-jhalo" }, g);
  const haloAt = (k: 0 | 1 | 2) => {
    if (k === 2) return "";
    const x = k === 0 ? XA : BX;
    return rrect(x - OUT - 30, DY0 + 2, SL + OUT + 36, Y0 + 20 - DY0 - 2, 10);
  };

  // ---- the boards: the extender's (a tiny board under its two sockets) and the reading board's end
  el("path", { d: rrect(XA - EXT_OVER, Y0, XB - XA + 2 * EXT_OVER, 9, 2.5), class: "cl-extpcb" }, g);
  el("path", { d: rrect(BX - 16, Y0, TRACE_X1 - BX + 26, 13, 3), class: "cl-pcb" }, g);
  el("rect", { x: BX + SL - 2, y: Y0 - 2.5, width: 12, height: 3, class: "cl-cu" }, g);
  el("rect", { x: BX + SL + 10, y: Y0 - 1.6, width: TRACE_X1 - BX - SL - 10, height: 1.8, class: "cl-cu" }, g);
  label(g, BX - 9, Y0 + 9.6, W.fpc1, "cl-t cl-t-onpcb");

  // ---- the pieces (under the sockets' housings, which hide what is inside)
  // the tail: amber film, a brown stiffener at its end, the gold finger on the other face, the copper inside (drawn
  // fingers down; turned over by paint(), as the extender takes them up)
  const tailX = el("g", { mask: `url(#${uid}-pmask)` }, g);
  const tailM = el("g", {}, tailX);
  const tail = el("g", {}, tailM);
  const LT = 420;
  el("rect", { x: -LT, y: YB - FILM, width: LT, height: FILM, class: "cl-pi cl-pi-side" }, tail);
  el("rect", { x: -LT, y: YF - 0.8, width: LT - CONTACT[1], height: 1.6, class: "cl-pi-trace" }, tail);
  el("rect", { x: -CONTACT[1], y: YB - 2.4, width: CONTACT[1] - CONTACT[0], height: 2.4, class: "cl-finger cl-finger-side" }, tail);
  el("path", { d: rrect(-CONTACT[1] - 12, YB - FILM - STIFF, CONTACT[1] + 12, STIFF, 1.5), class: "cl-stiff" }, tail);

  // the cable: its first end in the extender's right socket, its middle, and its free end (which can turn over)
  const cableG = el("g", {}, g);
  const midFilm = el("path", { d: "", class: "cl-ffc" }, cableG);
  const midCu = el("path", { d: "", class: "cl-ffc-culine" }, cableG);
  // the first end (fixed, locked, contacts up toward the extender's spring, the stiffener under it), its end at XB - DEEP
  const e1 = XB - DEEP;
  el("rect", { x: e1 + CONTACT[0], y: YT, width: CONTACT[1] - CONTACT[0], height: 2.4, class: "cl-ffc-bare" }, cableG);
  el("path", { d: rrect(e1, YB - STIFF, CONTACT[1] + 12, STIFF, 1.5), class: "cl-ffc-tab" }, cableG);
  // the free end: a group moved by ins and turned over by flip, its own film, contact, stiffener and copper
  const freeX = el("g", {}, cableG);
  const free = el("g", {}, freeX);
  el("rect", { x: -FREE, y: YB - FILM, width: FREE, height: FILM, class: "cl-ffc" }, free);
  el("rect", { x: -FREE, y: YF - 0.8, width: FREE - CONTACT[1], height: 1.6, class: "cl-ffc-cu" }, free);
  el("rect", { x: -CONTACT[1], y: YB - 2.4, width: CONTACT[1] - CONTACT[0], height: 2.4, class: "cl-ffc-bare" }, free);
  el("path", { d: rrect(-CONTACT[1] - 12, YB - FILM - STIFF, CONTACT[1] + 12, STIFF, 1.5), class: "cl-ffc-tab" }, free);

  // ---- the sockets: floor, back wall, roof (ivory), a spring (tin), a latch or a slide lock (black). dir +1: the mouth
  // on the left. top: the extender's kind, the spring under the roof, a roof the whole way to the mouth.
  const springPts = (x0: number, dir: 1 | -1, top: boolean): string => {
    const X = (x: number) => x0 + dir * x;
    if (top)
      return `M${X(SL)} ${Y0 - 1} L${X(SL - 4.5)} ${Y0 - 5} L${X(SL - 4.5)} ${Y0 - 23} L${X(SL - 11)} ${RSP} L${X(BUMP + 9)} ${RSP} Q${X(BUMP + 4)} ${RSP} ${X(BUMP)} ${YT} Q${X(BUMP - 5)} ${RSP + 0.5} ${X(BUMP - 12)} ${RSP + 1}`;
    return `M${X(SL)} ${Y0 - 1} L${X(SL - 6)} ${Y0 - 6} L${X(SL - 12)} ${Y0 - 10.5} L${X(BUMP + 9)} ${Y0 - 10.5} Q${X(BUMP + 4)} ${Y0 - 10.5} ${X(BUMP)} ${YB} Q${X(BUMP - 5)} ${Y0 - 11} ${X(BUMP - 12)} ${Y0 - 11.5}`;
  };
  const housing = (x0: number, dir: 1 | -1, top: boolean) => {
    const X = (x: number, w: number) => (dir > 0 ? x0 + x : x0 - x - w);
    el("path", { d: rrect(X(0, SL), Y0 - 9, SL, 9, 1.5), class: "cl-zif" }, g);
    el("path", { d: rrect(X(SL - 9, 9), Y0 - 36, 9, 36, 1.5), class: "cl-zif" }, g);
    const r0 = top ? 0 : HX - 4;
    el("path", { d: rrect(X(r0, SL - r0), Y0 - 36, SL - r0, 7, 1.5), class: "cl-zif" }, g);
    const sp = springPts(x0, dir, top);
    el("path", { d: sp, class: "cl-spring-edge cl-spring-sm" }, g);
    el("path", { d: sp, class: "cl-spring cl-spring-sm" }, g);
  };
  /** The extender's slide lock: its ear just outside the mouth, its tongue in under the piece (between the piece and the
   *  floor), so closed it presses the piece up onto the spring. Returns the part that slides. */
  const slideLock = (x0: number, dir: 1 | -1) => {
    const lg = el("g", { transform: `translate(${x0} 0) scale(${dir} 1)` }, g);
    const lr = el("g", {}, lg);
    el("path", { d: rrect(-3, YB + 0.4, BUMP + 13, Y0 - 9 - YB - 0.4, 1.2), class: "cl-zif-latch" }, lr);
    el("path", { d: rrect(-9, YB + 1.6, 9.5, Y0 - YB - 2.2, 1.8), class: "cl-zif-latch" }, lr);
    return lr;
  };
  const latch = (x0: number, dir: 1 | -1) => {
    const lg = el("g", { transform: `translate(${x0 + dir * HX} ${Y0 - 32.5}) scale(${dir} 1)` }, g);
    const lr = el("g", {}, lg);
    const lw = HX + 4;
    el("path", { d: rrect(-lw, -3.5, lw + 4, 7, 2.5), class: "cl-zif-latch" }, lr);
    // its cam, over the bump: presses the piece onto the spring when closed
    const camTop = 3.5;
    const camH = YB - FILM - STIFF - (Y0 - 32.5) - camTop;
    el("path", { d: rrect(-(HX - BUMP) - 9, camTop - 1, 18, camH + 1, 2.5), class: "cl-zif-latch" }, lr);
    el("circle", { cx: 0, cy: 0, r: 2.2, class: "cl-hinge" }, lg);
    return lr;
  };
  housing(XA, 1, true);
  housing(XB, -1, true);
  housing(BX, 1, false);
  // the extender's springs meet under its middle wall
  el("rect", { x: XA + SL - 4, y: Y0 - 2.2, width: 8, height: 2.2, class: "cl-cu" }, g);

  // ---- the line: lit from the pad as far as it connects; current dots once it reaches the board
  const lit1 = el("path", { d: "", class: "cl-plug-lit" }, g);
  const lit2 = el("path", { d: "", class: "cl-plug-lit" }, g);
  const flowGlow = el("path", { d: "", class: "cl-flow-glow" }, g);
  const flow = el("path", { d: "", class: "cl-flow" }, g);
  // (at the extender, the spring touches the piece's top face; at FPC1, its underside; a miss is marked on that side)
  const sparks = [
    el("circle", { cx: XA + BUMP, cy: YT + 0.5, r: 4, class: "cl-spark" }, g),
    el("circle", { cx: BX + BUMP, cy: YB - 0.5, r: 4, class: "cl-spark" }, g),
  ];
  const misses = [
    el("path", { d: `M${XA + BUMP + 9} ${YT - 2} l6 -6 m0 6 l-6 -6`, class: "cl-miss" }, g),
    el("path", { d: `M${BX + BUMP + 9} ${YB + 2} l6 6 m0 -6 l-6 6`, class: "cl-miss" }, g),
  ];

  // the locks over everything they press on; the first end's lock stays closed
  const latchA = slideLock(XA, 1);
  slideLock(XB, -1);
  const latchB = latch(BX, 1);

  // the names, under the pieces
  const ly = Y0 + 31;
  label(g, 44, ly, W.tail, "cl-t cl-t-dim", "middle");
  label(g, (XA + XB) / 2, ly, W.ext, "cl-t cl-t-dim", "middle");
  label(g, (XB + BX) / 2 + 4, ly, W.cable, "cl-t cl-t-dim", "middle");
  label(g, (BX - 16 + TRACE_X1 + 10) / 2, ly, W.board, "cl-t cl-t-dim", "middle");

  // ---- the close-up: a panel under the chain with step 2's drawing of the joint being made, clipped to the panel
  el("path", { d: rrect(PANEL.x, PANEL.y, PANEL.w, PANEL.h, 10), class: "cl-panel" }, g);
  const title = label(g, PANEL.x + 12, PANEL.y + 17, "", "cl-t cl-t-dim");
  const closeOuter = el("g", { transform: `translate(${PANEL.x + 6 - FFC_SIZE.x0 * CS} ${PANEL.y + 22 - FFC_SIZE.y0 * CS}) scale(${CS})` }, g);
  const clip = el("clipPath", { id: `${uid}-pclip`, clipPathUnits: "userSpaceOnUse" }, f.defs);
  el("rect", { x: FFC_SIZE.x0, y: FFC_SIZE.y0, width: FFC_SIZE.w, height: FFC_SIZE.h }, clip);
  const closeInner = el("g", { "clip-path": `url(#${uid}-pclip)` }, closeOuter);
  const activeOf = (p: [PlugPose, PlugPose]): 0 | 1 => (jointOk(p[0]) ? 1 : 0);
  let closeK = activeOf(pose);
  const mkClose = (): FfcDrawing => {
    closeInner.replaceChildren();
    title.textContent = W.close.replace("{part}", closeK === 0 ? W.ext : W.fpc1);
    const words = { latch: W.latch, spring: W.spring, contacts: closeK === 0 ? W.fingers : W.contacts, stiff: W.stiff, board: closeK === 0 ? W.ext : W.board };
    // (the extender's socket has no latch to swing up: its drawing sits lower in the design, so it is lifted to the
    // panel's middle)
    const sub = el("g", { transform: closeK === 0 ? `translate(0 ${-TOP_LIFT})` : "" }, closeInner);
    return drawFfc({ ...f, g: sub }, pose[closeK], words, reduced, { tail: closeK === 0, top: closeK === 0 });
  };
  let close = mkClose();

  const paint = () => {
    const [a, b] = pose;
    halo.setAttribute("d", haloAt(jointOk(a) ? (jointOk(b) ? 2 : 1) : 0));
    // (the extender's lock slides straight out; FPC1's latch swings up)
    latchA.setAttribute("transform", `translate(${Math.round(-SLIDE * a.latch * 100) / 100} 0)`);
    latchB.setAttribute("transform", `rotate(${Math.round(b.latch * 100 * 100) / 100})`);
    // the tail (drawn fingers down: the right way round, flip 0, is that turned over, fingers up)
    const te = tailEnd(a.ins);
    tailM.setAttribute("transform", `translate(${Math.round(te * 100) / 100} 0)`);
    const sa = -Math.cos(Math.PI * a.flip);
    tail.setAttribute("transform", `translate(0 ${YC}) scale(1 ${Math.round(sa * 1000) / 1000}) translate(0 ${-YC})`);
    // the cable's free end, and the middle up to it: a step down from the extender's level, then a short ramp when the
    // end is turned over
    const ce = cableEnd(b.ins);
    freeX.setAttribute("transform", `translate(${Math.round(ce * 100) / 100} 0)`);
    const sb = Math.cos(Math.PI * b.flip);
    free.setAttribute("transform", `translate(0 ${YC}) scale(1 ${Math.round(sb * 1000) / 1000}) translate(0 ${-YC})`);
    const x1 = ce - FREE;
    const x0 = x1 - RAMP;
    const [s0, s1] = STEP;
    const sm = (s0 + s1) / 2;
    // where the free end's film sits now (it turns about YC)
    const fy = (y: number) => YC + (y - YC) * sb;
    const [ft, fb] = [fy(YB - FILM), fy(YB)].sort((p, q) => p - q);
    midFilm.setAttribute(
      "d",
      `M${e1} ${YT} H${s0} C${sm} ${YT} ${sm} ${YB - FILM} ${s1} ${YB - FILM} H${x0} C${x0 + RAMP / 2} ${YB - FILM} ${x1 - RAMP / 2} ${ft} ${x1 + 0.5} ${ft} V${fb} C${x1 - RAMP / 2} ${fb} ${x0 + RAMP / 2} ${YB} ${x0} ${YB} H${s1} C${sm} ${YB} ${sm} ${YT + FILM} ${s0} ${YT + FILM} H${e1} Z`,
    );
    // the cable's conductor from its first end's contact to its free end's
    const cu = `C${sm} ${YFT} ${sm} ${YF} ${s1} ${YF} L${x0} ${YF} C${x0 + RAMP / 2} ${YF} ${x1 - RAMP / 2} ${fy(YF)} ${x1 + 0.5} ${fy(YF)}`;
    midCu.setAttribute("d", `M${e1 + CONTACT[1]} ${YFT} L${s0} ${YFT} ${cu}`);
    // the line
    const okA = jointOk(a);
    const okB = okA && jointOk(b);
    // from the pad along the tail to its fingers (always: the tail is part of the pad); once the tail's joint is made,
    // on through the extender (front to back through its left socket, then out through its right one) and along the
    // cable to its free end's contact; once both are made, on through FPC1 to the trace
    const tailY = YC + (YF - YC) * sa;
    const d1b =
      `M0 ${tailY} L${te - CONTACT[1]} ${tailY}` +
      (okA
        ? ` ${lineA(te)} L${XB - SL + 4.5} ${Y0 - 5} L${XB - SL + 4.5} ${Y0 - 23} L${XB - SL + 11} ${RSP} L${XB - BUMP - 9} ${RSP} L${XB - BUMP} ${YT + 1.2} L${e1 + CONTACT[1] - 2} ${YT + 1.2} L${e1 + CONTACT[1]} ${YFT} L${s0} ${YFT} ${cu} L${ce - CONTACT[1]} ${fy(YF)}`
        : "");
    const d2 = okB ? `M${ce - CONTACT[1]} ${YF} L${ce - CONTACT[1] + 2} ${YB - 1.2} L${BX + BUMP} ${YB - 1.2} L${BX + BUMP + 9} ${Y0 - 10.5} L${BX + SL - 12} ${Y0 - 10.5} L${BX + SL - 6} ${Y0 - 6} L${BX + SL} ${Y0 - 1} L${TRACE_X1} ${Y0 - 1}` : "";
    lit1.setAttribute("d", d1b);
    lit2.setAttribute("d", d2);
    const full = okB ? `${d1b} ${d2.replace(/^M/, "L")}` : "";
    flow.setAttribute("d", full);
    flowGlow.setAttribute("d", full);
    flow.classList.toggle("is-on", okB);
    flowGlow.classList.toggle("is-on", okB);
    sparks[0].classList.toggle("is-on", okA);
    sparks[1].classList.toggle("is-on", okB);
    misses[0].classList.toggle("is-on", a.ins > 0.99 && a.latch < 0.01 && !okA);
    misses[1].classList.toggle("is-on", b.ins > 0.99 && b.latch < 0.01 && !jointOk(b));
  };
  /** The line through the extender's left socket, on from the tail's conductor: up into its finger, onto the spring's
   *  bump, back along the spring under the roof and down the back wall to the board, under the middle wall. */
  const lineA = (te: number) =>
    poly([
      [te - CONTACT[1], YFT],
      [te - CONTACT[1] + 2, YT + 1.2],
      [XA + BUMP, YT + 1.2],
      [XA + BUMP + 9, RSP],
      [XA + SL - 11, RSP],
      [XA + SL - 4.5, Y0 - 23],
      [XA + SL - 4.5, Y0 - 5],
      [XA + SL, Y0 - 1],
    ]).replace(/^M/, "L");

  // the move in flight: a rebuild (resize, language) ends it at its target at once, so its callbacks still run
  let pending: { to: [PlugPose, PlugPose]; done?: () => void } | null = null;
  const go = (to: [PlugPose, PlugPose], done?: () => void) => {
    cancelAnimationFrame(raf);
    pending = { to, done };
    const from: [PlugPose, PlugPose] = [{ ...pose[0] }, { ...pose[1] }];
    let span = 0;
    for (const k of [0, 1]) for (const q of ["latch", "ins", "flip"] as const) span = Math.max(span, Math.abs(to[k][q] - from[k][q]));
    const finish = () => {
      pending = null;
      pose[0] = { ...to[0] };
      pose[1] = { ...to[1] };
      paint();
      // the joint just made: the close-up moves on to the next one
      const k = activeOf(pose);
      if (k !== closeK) {
        close.destroy();
        closeK = k;
        close = mkClose();
      }
      done?.();
    };
    close.go(to[closeK]);
    if (reduced || span < 0.001) {
      finish();
      return;
    }
    const dur = 360 + 420 * span; // (as ./ffc.ts: the close-up keeps step)
    const t0 = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / dur);
      const k = ease(t);
      for (const j of [0, 1])
        for (const q of ["latch", "ins", "flip"] as const) pose[j][q] = from[j][q] + (to[j][q] - from[j][q]) * k;
      paint();
      if (t < 1) raf = requestAnimationFrame(step);
      else finish();
    };
    raf = requestAnimationFrame(step);
  };
  paint();
  return {
    go,
    destroy: () => {
      cancelAnimationFrame(raf);
      close.destroy();
      const p = pending;
      pending = null;
      p?.done?.();
    },
  };
}

/** The part of the design the stage shows. */
export const PLUG_SIZE = { w: DW, h: DH, x0: 0, y0: DY0 };
