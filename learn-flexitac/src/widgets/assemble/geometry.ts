// Lesson 1.4's assembly game: where everything is (plan millimetres, x to the right, Y toward the viewer, z up from the
// mat's top). The rules (./engine.ts) and the 3D scene (../assemble3d/scene.ts) share these numbers.
//
// The pad is built the way Lesson 1.3 builds it. Each FPC lies copper up on a lamination sheet. The Velostat goes on the
// bottom part (the 32 drive lines). The top part (the 12 sense lines) turns face down over it, a half turn about the
// plan's Y axis, so its copper meets the Velostat and its lines cross the bottom part's at right angles. Then both tails
// leave the pad at the same corner, near the viewer, as on the real pad (the hardware guide's photo of the pad, seen
// from above): the bottom tail's 32 gold fingers, and just beyond them the top tail's 12, which bends up over the 32-pin
// connector. A connector (an extender: a tiny board with a socket on each side) takes each tail, and a flat cable runs
// from each connector forward to the reading board, whose two sockets face the pad: the 16-pin cable to FPC1, the
// 32-pin cable to FPC2. The FPC outlines and fingers come from the Gerbers (@shared/data/fpc_*.json), the board's parts
// and sockets from board.json; the sheets, the Velostat, the connectors and the cables are sized from Lesson 1.3's parts
// and the guide's photos.
import { components as BOARD_PARTS, connectors as BOARD_CONN, outline as BOARD_OUTLINE } from "@shared/data/board.json";

export type P2 = [number, number];

/** A pre-cut lamination sheet, the Velostat square (plan mm; t is the drawn thickness). */
export const SHEET = { w: 30, h: 72, t: 0.15 };
export const VELO = { w: 26, h: 66, t: 0.12 };

/** The drawn heights of the stack (z of each layer's underside, mm above the mat). */
export const Z = { sheet: 0, fpcOnSheet: 0.16, fpcBare: 0.02, velo: 0.18, topFpc: 0.31, topSheet: 0.32 };
/** How far the top tail rises over the 32-pin connector, and where (its Gerber x: the bend runs from x0 to x1). */
export const BEND = { h: 3.6, x0: -40, x1: -49 };

/** The connectors: an extender board (pcb) with a socket each side; w = across (x), d = along the tail (Y). */
export const CONN = {
  c16: { pins: 16, w: 11.4 },
  c32: { pins: 32, w: 19.4 },
  d: 12.4,
  pcbT: 0.8,
  sockH: 2.0,
};
/** The flat cables: width across (x), length when they lie straight, the stiffened blue ends. */
export const CABLE = { f16: { pins: 16, w: 9 }, f32: { pins: 32, w: 17 }, len: 82, tab: 6 };

/** The tails' gold fingers, relative to their part's block centre (plan): the fingers' centre, and the Y where they
 *  go into a socket (their inner end). bot: the bottom FPC, copper up. topUp: the top FPC copper up (before the
 *  sandwich); topPad: in the closed pad (face down, mirrored x). */
export const TAIL = {
  bot: { at: [61.75, 32.5] as P2, inner: 31 },
  topUp: { at: [-66.42, 42.5] as P2, inner: 41.2 },
  topPad: { at: [66.42, 42.5] as P2, inner: 41.2 },
};
/** A plugged connector: its centre relative to the pad (the socket's mouth at the fingers' inner end), its height. */
export const PLUG = {
  c32: { at: [TAIL.bot.at[0], TAIL.bot.inner + CONN.d / 2] as P2, z: 0 },
  // (on the bent tail, resting on the 32-pin connector's sockets: their tops are pcbT + sockH up)
  c16: { at: [TAIL.topPad.at[0], TAIL.topPad.inner + CONN.d / 2] as P2, z: 2.8 },
};

// ------------------------------------------------------------------ the reading board
/** board.json's frame is EasyEDA's (x right, y up); the board's own frame starts at its outline's lower left. */
const [bx0, by0, bx1, by1] = BOARD_OUTLINE.bbox as [number, number, number, number];
export const BOARD = {
  /** where the board's lower left corner lies (plan) */
  x: 22.3,
  w: bx1 - bx0,
  d: by1 - by0,
  /** its far edge (the sockets' edge, toward the pad) */
  Y: 100,
  t: 1.6,
  ox: bx0,
  oy: by0,
};
/** A board point (its own frame, mm) to plan. */
export const boardToPlan = (x: number, y: number): P2 => [BOARD.x + x, BOARD.Y + (BOARD.d - y)];
export type Socket = "fpc1" | "fpc2";
/** The board's two sockets: centre and pins in the board's frame, from board.json (pin 1 and the pin step). */
export const SOCKETS = (["FPC1", "FPC2"] as const).map((des) => {
  const c = BOARD_PARTS.find((p) => p.designator === des)!;
  const k = BOARD_CONN[des];
  const pins = ((des === "FPC1" ? (k as { pins16: number[][] }).pins16 : (k as { pins32: number[][] }).pins32) as number[][]).map(([x, y]) => [x - bx0, y - by0] as P2);
  const xs = pins.map((p) => p[0]);
  return { id: des.toLowerCase() as Socket, n: pins.length, pins, cx: (Math.min(...xs) + Math.max(...xs)) / 2, py: pins[0][1], body: { x: c.x - bx0, y: c.y - by0 } };
});
/** How deep a board socket is (pins to the cable side) and how wide, by pin count (datasheet-typical). */
export const SOCK = { d: 5.2, h: 2.0, w: (n: number) => (n - 1) * 0.5 + 4.2 };
/** Where a cable goes into a board socket (plan) and the socket's mouth height. */
export const portOnBoard = (s: Socket): P2 => {
  const k = SOCKETS.find((q) => q.id === s)!;
  return boardToPlan(k.cx, k.py + 0.55 + SOCK.d);
};
export const BOARD_PORT_Z = BOARD.t + 0.9;

/** The Nano: its outline's centre in the board's frame (it sits in the board's two 1 x 15 sockets). */
export const NANO_CENTRE: P2 = [9.129, 20.066];
export const nanoSeat = (): P2 => boardToPlan(...NANO_CENTRE);

// ------------------------------------------------------------------ the mat
/** Where everything starts (2026-11-16, user: the layout of the chapter's cover, scripts/cover-parts.mjs): every part
 *  laid out flat in two rows, 258 mm wide, built leftward from the reading board (which cannot move: x 21.5..79.1,
 *  y 99.6..141.7). Footprints measured from above.
 *  - top row, centred on y 36.65, 10 mm apart: the top FPC (its tail to the left), the two lamination sheets, the
 *    bottom FPC (its tail to the right): each FPC's sensing block next to a sheet. sheetA, the right one, is the near
 *    sheet the Hint lays the bottom FPC on (nearest the board)
 *  - bottom row, centred on the board's middle (y 120.65), 13.2 mm apart: the Velostat, the 32-pin extender over the
 *    16-pin one, the 32-pin cable over the 16-pin one, the Nano (USB toward the viewer), the board */
export const SPOT = { sheetA: [-30.2, 36.65] as P2, sheetB: [-70.4, 36.65] as P2 };
export const START = {
  sheetA: SPOT.sheetA,
  sheetB: SPOT.sheetB,
  top: [-108.4, 30.85] as P2,
  bot: [8.1, 35.65] as P2,
  velo: [-166.1, 120.65] as P2,
  c32: [-129.7, 111.4] as P2,
  c16: [-129.7, 129.9] as P2,
  nano: [-1.4, 119.1] as P2,
  f32: { a: [-105.8, 113.15] as P2, b: [-23.8, 113.15] as P2 },
  f16: { a: [-105.8, 132.15] as P2, b: [-23.8, 132.15] as P2 },
};
/** The start layout's extent (plan mm), the parts' footprints from above. */
export const LAYOUT = { x0: -179.1, x1: 79.1, y0: -2.35, y1: 153.65 };
/** Where the pad goes once the sandwich is closed (it slides there from its sheet): its 32-pin extender 50 mm in front
 *  of FPC2 and nearly in line with it, so the cables run short and smooth (from a sheet in the top row they would
 *  bunch up: the tails end 20-30 mm from the sockets). */
export const PAD_SPOT: P2 = [-7, 6];
/** How near a part has to be dropped to its place to snap in. */
export const SNAP = { big: 24, small: 11 };
