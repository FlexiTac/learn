// The flat-cable view of chips-lab (Lesson 2.4 step 2): a ZIF socket and a flat flexible cable (FFC) cut through the
// middle and seen from the side, not to scale (the real socket is about 2 mm tall). The socket is the reading board's
// kind: bottom contacts and a flip-up latch at the front (FPC2 is a 0.5 mm flip-top bottom-contact socket, LCSC C283153;
// the board photo shows FPC1 the same). Inside, a spring contact lies on the floor, its tail soldered to a pad on the
// board. The cable is plastic film with a flat conductor in it, bare on its underside near the end, with a blue
// stiffener on the other face (the same-side "Type A" cable, judged from the guide's photos).
// Lift the latch, slide the cable in (nothing presses on it: zero insertion force), press the latch down: its cam
// presses the cable onto the spring, the bare contact meets the spring and the line is connected (pink). Turned over,
// the cable goes in just as easily, but the spring meets the stiffener: nothing connects (Hirose FH12 operating
// instructions: bottom-contact sockets take the cable "with the exposed conductive traces facing down"; external).
// Three numbers move the drawing (latch 0 closed .. 1 open, ins 0 out .. 1 fully in, flip 0 contacts down .. 1 up);
// go() eases them all to a target together, and chips-lab.ts chains the moves.
// Lesson 2.4 step 3 (./plug.ts) shows a socket up close under its chain, for the joint being made: the flat cable into
// FPC1 (this drawing as it is), or the pad's tail into the FFC extender (opts.tail: the amber film, its gold finger and
// brown stiffener, on the extender's dark board; opts.top: the extender's own kind of socket). The guide's extenders
// (Adafruit 5203 and 4523) take a piece "with contacts pointing up" and lock with "two ears" (external): so with opts.top
// the spring hangs from the roof, the piece's contacts face up when it is the right way round (flip 0), and in place of
// the flip latch a black slide lock (its ear at the mouth, its tongue under the piece) pulls out to open and pushes back
// in under the piece to press it up onto the spring. `latch` still runs the lock (0 closed .. 1 pulled out).
import { el, ease, label, poly, rrect, type Frame } from "./svg";

export interface FfcPose {
  latch: number;
  ins: number;
  flip: number;
}
export interface FfcState extends FfcPose {
  busy: boolean;
}
export const ffcState = (): FfcState => ({ latch: 0, ins: 0, flip: 0, busy: false });
/** The line goes through: the cable fully in, latched, contacts facing the spring. */
export const ffcConnected = (s: FfcPose) => s.ins > 0.99 && s.latch < 0.01 && s.flip < 0.5;

export interface FfcWords {
  latch: string;
  spring: string;
  contacts: string;
  stiff: string;
  board: string;
}
export interface FfcDrawing {
  /** Ease to `to` (ms), then call `done`. */
  go(to: FfcPose, done?: () => void): void;
  destroy(): void;
}

// (design units: the whole drawing spans x 0-480, y 0-262; FFC_SIZE below is the part the stage shows)
// the socket
const FRONT = 232;
const BACK = 386;
const WALL = 16;
const TOP = 138;
const ROOF = 14;
const FLOOR_Y = 204; // the floor's top
const PCB_Y = 222;
const PCB_H = 22;
const HINGE: [number, number] = [314, TOP + ROOF / 2];
const BUMP: [number, number] = [282, 188]; // the spring's top
// the cable (its bottom rests on the bump; the end is 19 units thick: film 10 + stiffener 9)
const YB = BUMP[1];
const FILM = 10;
const STIFF = 9;
const X_IN = BACK - WALL - 4;
const X_OUT = 200; // (the cable out: its end and its two tags stay inside the frame below)
const BARE = 100; // the bare contact's length
const PAD_X = 392;
const BOARD_R = 448; // the board's right end
const TRACE_R = 442; // the trace's end, on toward the chip
const SPRING: [number, number][] = [[PAD_X + 28, PCB_Y - 1.5], [PAD_X, PCB_Y - 1.5], [BACK - 1, PCB_Y - 6], [BACK - WALL - 6, FLOOR_Y - 2.5], [300, FLOOR_Y - 2.5]];
// the top-contact socket (opts.top): the piece's top face, the spring along the roof's underside and up from the pad
// inside the back wall, a thicker floor, and the slide lock's tongue between the two
const YT = YB - FILM - STIFF;
const ROOF_B = TOP + ROOF; // the roof's underside
const FLOOR_T = YB + 8; // the floor's top under a top-contact socket
const SPRING_T: [number, number][] = [[PAD_X + 28, PCB_Y - 1.5], [PAD_X, PCB_Y - 1.5], [BACK - 1, PCB_Y - 6], [BACK - WALL / 2, PCB_Y - 14], [BACK - WALL / 2, ROOF_B + 10], [BACK - WALL - 6, ROOF_B + 2.5], [300, ROOF_B + 2.5]];
const SLIDE = 40; // how far the slide lock pulls out

export function drawFfc(f: Frame, st0: FfcPose, W: FfcWords, reduced: boolean, opts: { tail?: boolean; top?: boolean } = {}): FfcDrawing {
  const tail = opts.tail === true;
  const top = opts.top === true;
  const g = f.g;
  const pose: FfcPose = { latch: st0.latch, ins: st0.ins, flip: st0.flip };
  let raf = 0;

  // ---- the board and its copper: the spring's pad, and the trace on to the chip
  // (the board's both rounded ends show; its trace stops short of the right one; under a slide lock the board reaches
  // further out, so the lock pulled out still sits over it)
  const bx0 = top ? 160 : 196;
  el("path", { d: rrect(bx0, PCB_Y, BOARD_R - bx0, PCB_H, 3), class: tail ? "cl-extpcb" : "cl-pcb" }, g);
  el("rect", { x: PAD_X - 2, y: PCB_Y - 2.5, width: 34, height: 3, class: "cl-cu" }, g);
  el("rect", { x: PAD_X + 32, y: PCB_Y - 1.6, width: TRACE_R - PAD_X - 32, height: 1.8, class: "cl-cu" }, g);
  label(g, 208, PCB_Y + 14.5, W.board, "cl-t cl-t-onpcb");

  // ---- the cable (under the socket's front, so the housing hides what is inside it)
  const cableX = el("g", {}, g);
  const cable = el("g", {}, cableX);
  const yc = YB - (FILM + STIFF) / 2; // the cable end's centre line (the flip turns about it)
  const L = 520;
  // the film along the whole length (in the normal pose: film at the bottom of the end's stack)
  el("rect", { x: -L, y: YB - FILM, width: L, height: FILM, class: tail ? "cl-pi cl-pi-side" : "cl-ffc" }, cable);
  // the conductor inside it, bare on the underside near the end
  el("rect", { x: -L, y: YB - FILM / 2 - 0.9, width: L - BARE, height: 1.8, class: tail ? "cl-pi-trace" : "cl-ffc-cu" }, cable);
  el("rect", { x: -BARE, y: YB - 2.6, width: BARE - 3, height: 2.6, class: tail ? "cl-finger cl-finger-side" : "cl-ffc-bare" }, cable);
  // the stiffener on the other face
  el("path", { d: rrect(-BARE - 10, YB - FILM - STIFF, BARE + 10, STIFF, 1.5), class: tail ? "cl-stiff" : "cl-ffc-tab" }, cable);
  // its labels follow it (never flipped): "contacts" on the bare side, "stiffener" on the other
  const tags = el("g", { class: "cl-cable-tags" }, cableX);
  const tagC = label(tags, -BARE / 2 - 30, 0, W.contacts, "cl-t", "middle");
  const tagS = label(tags, -BARE / 2 - 30, 0, W.stiff, "cl-t", "middle");
  const leadC = el("path", { d: "", class: "cl-leader" }, tags);
  const leadS = el("path", { d: "", class: "cl-leader" }, tags);

  // ---- the socket: floor, back wall, roof (ivory), the spring (metal), the latch or the slide lock (black)
  el("path", { d: rrect(FRONT, top ? FLOOR_T : FLOOR_Y, BACK - FRONT, PCB_Y - (top ? FLOOR_T : FLOOR_Y), 2), class: "cl-zif" }, g);
  el("path", { d: rrect(BACK - WALL, TOP, WALL, PCB_Y - TOP, 2), class: "cl-zif" }, g);
  // (a slide-lock socket's roof runs to its mouth; a flip latch takes the front of it)
  el("path", { d: top ? rrect(FRONT, TOP, BACK - FRONT, ROOF, 2) : rrect(HINGE[0] - 4, TOP, BACK - HINGE[0] + 4, ROOF, 2), class: "cl-zif" }, g);
  const springD = top
    ? poly(SPRING_T) + ` Q${BUMP[0] + 10} ${ROOF_B + 2.5} ${BUMP[0]} ${YT} Q${BUMP[0] - 10} ${ROOF_B + 5} ${BUMP[0] - 20} ${ROOF_B + 7}`
    : poly(SPRING) + ` Q${BUMP[0] + 10} ${FLOOR_Y - 2.5} ${BUMP[0]} ${BUMP[1]} Q${BUMP[0] - 10} ${FLOOR_Y - 5} ${BUMP[0] - 20} ${FLOOR_Y - 7}`;
  // (a dark edge under the tin, so the thin spring reads on the ivory and on the white cable)
  el("path", { d: springD, class: "cl-spring-edge" }, g);
  el("path", { d: springD, class: "cl-spring" }, g);
  label(g, PAD_X + 2, PCB_Y - 10, W.spring, "cl-t");

  // the current through the joint: cable conductor -> bare contact -> spring -> pad -> trace
  const flowD = top
    ? `M${X_IN - L + 30} ${YT + FILM / 2} L${X_IN - BARE} ${YT + FILM / 2} L${X_IN - BARE + 4} ${YT + 1.5} L${BUMP[0]} ${YT + 1.5} Q${BUMP[0] + 10} ${ROOF_B + 2.5} 300 ${ROOF_B + 2.5} ${poly(SPRING_T.slice().reverse()).replace(/^M[^L]+/, "")} L${TRACE_R} ${PCB_Y - 0.7}`
    : `M${X_IN - L + 30} ${YB - FILM / 2} L${X_IN - BARE} ${YB - FILM / 2} L${X_IN - BARE + 4} ${YB - 1.5} L${BUMP[0]} ${YB - 1.5} Q${BUMP[0] + 10} ${FLOOR_Y - 2.5} 300 ${FLOOR_Y - 2.5} ${poly(SPRING.slice().reverse()).replace(/^M[^L]+/, "")} L${TRACE_R} ${PCB_Y - 0.7}`;
  const flowGlow = el("path", { d: flowD, class: "cl-flow-glow" }, g);
  const flow = el("path", { d: flowD, class: "cl-flow" }, g);
  const spark = el("circle", { cx: BUMP[0], cy: top ? YT + 0.5 : BUMP[1] - 0.5, r: 5, class: "cl-spark" }, g);
  const miss = el("path", { d: top ? `M${BUMP[0] + 14} ${YT - 1} l8 -8 m0 8 l-8 -8` : `M${BUMP[0] + 14} ${BUMP[1] + 1} l8 8 m0 -8 l-8 8`, class: "cl-miss" }, g);

  // the latch: a flap at the front, hinged at the roof; its cam presses the cable down when closed. Or (top) the slide
  // lock: its ear just outside the mouth, its tongue in under the piece; it pulls straight out
  const latchG = el("g", { transform: top ? "" : `translate(${HINGE[0]} ${HINGE[1]})` }, g);
  const latchR = el("g", {}, latchG);
  let latchName: SVGTextElement | null = null;
  if (top) {
    el("path", { d: rrect(FRONT - 4, YB + 0.5, BUMP[0] + 22 - FRONT + 4, FLOOR_T - YB - 0.5, 2), class: "cl-zif-latch" }, latchR);
    el("path", { d: rrect(FRONT - 18, YB + 3, 19, PCB_Y - YB - 3.5, 3), class: "cl-zif-latch" }, latchR);
  } else {
    const lw = HINGE[0] - FRONT + 8;
    el("path", { d: rrect(-lw, -ROOF / 2, lw + 5, ROOF, 3.5), class: "cl-zif-latch" }, latchR);
    const camH = YB - FILM - STIFF - HINGE[1] - ROOF / 2 + 1;
    el("path", { d: `M${-lw + 20} ${ROOF / 2 - 1} V${ROOF / 2 - 1 + camH - 5} Q${-lw + 20} ${ROOF / 2 - 1 + camH} ${-lw + 26} ${ROOF / 2 - 1 + camH} H${-lw + 58} Q${-lw + 64} ${ROOF / 2 - 1 + camH} ${-lw + 64} ${ROOF / 2 - 1 + camH - 5} V${ROOF / 2 - 1} Z`, class: "cl-zif-latch" }, latchR);
    latchName = label(latchR, -lw / 2 + 2, 3.6, W.latch, "cl-t cl-t-onlatch", "middle");
    el("circle", { cx: 0, cy: 0, r: 3, class: "cl-hinge" }, latchG);
  }

  const paint = () => {
    if (top) latchR.setAttribute("transform", `translate(${Math.round(-SLIDE * pose.latch * 100) / 100} 0)`);
    else latchR.setAttribute("transform", `rotate(${Math.round(pose.latch * 104 * 100) / 100})`);
    // its name only while it lies flat (turned up, the word would read sideways)
    if (latchName) latchName.style.opacity = String(Math.max(0, 1 - pose.latch * 4));
    const xt = X_OUT + (X_IN - X_OUT) * pose.ins;
    cableX.setAttribute("transform", `translate(${Math.round(xt * 100) / 100} 0)`);
    // (drawn contacts down: a top-contact socket takes them up, so there flip 0 is the drawing turned over)
    const s = Math.cos(Math.PI * pose.flip) * (top ? -1 : 1);
    cable.setAttribute("transform", `translate(0 ${yc}) scale(1 ${Math.round(s * 1000) / 1000}) translate(0 ${-yc})`);
    // the tags: bare contacts on the underside when s > 0, on top when s < 0
    const down = s >= 0;
    const ty = (onBottom: boolean) => (onBottom ? YB + 30 : YB - FILM - STIFF - 20);
    const cx = -BARE / 2 + 8;
    // (the slide lock's ear, pulled out, sits under the cable's end: the stiffener's tag keeps left of it)
    const sx = top ? -BARE / 2 - 2 : -BARE / 2 + 40;
    tagC.setAttribute("x", String(cx));
    tagC.setAttribute("y", String(ty(down)));
    tagS.setAttribute("x", String(sx));
    tagS.setAttribute("y", String(ty(!down)));
    leadC.setAttribute("d", down ? poly([[cx, YB + 1], [cx, YB + 18]]) : poly([[cx, YB - FILM - STIFF - 1], [cx, YB - FILM - STIFF - 15]]));
    leadS.setAttribute("d", down ? poly([[sx, YB - FILM - STIFF - 1], [sx, YB - FILM - STIFF - 15]]) : poly([[sx, YB + 1], [sx, YB + 18]]));
    // the tags hide while the cable is inside the socket (the housing covers that end) or mid-flip
    const show = pose.ins < 0.02 && Math.abs(s) > 0.9;
    tags.classList.toggle("is-hidden", !show);
    const ok = ffcConnected(pose);
    const latched = pose.ins > 0.99 && pose.latch < 0.01;
    flow.classList.toggle("is-on", ok);
    flowGlow.classList.toggle("is-on", ok);
    spark.classList.toggle("is-on", ok);
    miss.classList.toggle("is-on", latched && !ok);
  };

  // the move in flight: a rebuild (resize, language) ends it at its target at once, so its callbacks still run
  let pending: { to: FfcPose; done?: () => void } | null = null;
  const go = (to: FfcPose, done?: () => void) => {
    cancelAnimationFrame(raf);
    pending = { to, done };
    const from = { ...pose };
    const span = Math.max(Math.abs(to.latch - from.latch), Math.abs(to.ins - from.ins), Math.abs(to.flip - from.flip));
    if (reduced || span < 0.001) {
      pending = null;
      Object.assign(pose, to);
      paint();
      done?.();
      return;
    }
    const dur = 360 + 420 * span;
    const t0 = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / dur);
      const k = ease(t);
      pose.latch = from.latch + (to.latch - from.latch) * k;
      pose.ins = from.ins + (to.ins - from.ins) * k;
      pose.flip = from.flip + (to.flip - from.flip) * k;
      paint();
      if (t < 1) raf = requestAnimationFrame(step);
      else {
        pending = null;
        Object.assign(pose, to);
        paint();
        done?.();
      }
    };
    raf = requestAnimationFrame(step);
  };
  paint();
  return {
    go,
    destroy: () => {
      cancelAnimationFrame(raf);
      const p = pending;
      pending = null;
      p?.done?.();
    },
  };
}

/** The part of the design the stage shows, cropped to what moves: the cable's end and its tags when out, the latch
 *  swung open (its top at about y 56), the socket, the spring and the board's right end. */
export const FFC_SIZE = { w: 335, h: 215, x0: 120, y0: 45 };
/** The same, but centred on the socket with its latch down (y 138-244); the latch swung open then rises into the
 *  margin above, which chips-lab.ts uses only when the stage leaves room for it (down to LATCH_TOP). */
export const FFC_CLOSED = { w: 335, h: 160, x0: 120, y0: 104 };
export const LATCH_TOP = 52;
