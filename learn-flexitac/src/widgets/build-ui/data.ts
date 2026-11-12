// Lesson 2.2's workbench pictures and where things sit on them (src/widgets/build-bench.ts). The renders
// (flexitac-anatomy/figures/bench/topdown, render.mjs) write public/media/build/build.json: every picture at one scale
// (pxPerMm, a 2.54 mm pitch of pitchPx), each part's pin pixels, the board's 400 hole pixels. The workbench's "scene"
// is the board picture's own pixels: a part sits right when its pin pixel lies on its hole's pixel. The engine
// (../build/) works in hole ids and pin names only; this file turns those into scene pixels and back.
//   - The Nano's pins: build.json keys its two GND and two RST pins "GND/upper" ..., the engine "GND.upper" ...
//   - The FSR's and the resistor's pin "1" is the hole a placement names (left at rot 0, upper at rot 90).
import type { Theme } from "../../types";
import { nanoPins, pinsOf, type Build, type HoleId, type NanoPlace, type PartKind, type PartPlace, type WireColor } from "../build/engine";

export const BASE = `${import.meta.env.BASE_URL}media/build` + "/";

export type Pt = [number, number];
export type Box = [number, number, number, number];
interface Pic {
  src: Record<Theme, string>;
  size: [number, number];
}
export interface PartPic extends Pic {
  pins: Record<"1" | "2", Pt>;
}
export interface FsrPic extends PartPic {
  press: Pt;
  discRadiusPx: number;
  activeRadiusPx: number;
}
export interface Shade {
  body: string;
  hi: string;
  edge: string;
  profile: string[];
}
export interface BuildData {
  pxPerMm: number;
  pitchPx: number;
  board: Pic & { holes: Record<string, Pt>; outline: Box; groove: [number, number] };
  parts: {
    nano: Pic & { pins: Record<string, Pt>; usb: Pt; pcb: Box };
    usbPlug: Pic & { socket: Pt };
    fsr: Record<"rot0" | "rot90", FsrPic>;
    resistor: Record<"rot0" | "rot90", PartPic>;
  };
  wire: {
    endSrc: Record<Theme, string>;
    endSize: [number, number];
    endPin: Pt;
    housingPx: number;
    housingHeightMm: number;
    colors: Record<WireColor, string>;
    shade: Record<Theme, Record<WireColor, Shade>>;
    radiusPx: number;
  };
  light: { fromDeg: number; shadowPxPerMm: Pt; partShadow: Record<Theme, number> };
}

let dataPromise: Promise<BuildData> | null = null;
export function loadData(): Promise<BuildData> {
  dataPromise ??= fetch(`${BASE}build.json`).then((r) => {
    if (!r.ok) throw new Error(`build.json: ${r.status}`);
    return r.json() as Promise<BuildData>;
  });
  return dataPromise;
}

/** What the camera frames (scene px): the board with room on its left for the USB plug, and the parts tray below it,
 *  where an FSR's disc also hangs when its legs sit in the lower rows. */
export const FRAME: Box = [-170, 4, 1812, 1772];
/** The parts tray, a band under the board (scene px), and the scale its pictures are drawn at. */
export const TRAY_BAND: Box = [-96, 1306, 1752, 1756];
export const TRAY_SCALE = 0.5;
/** How much of the USB cable the tray shows (scene px of the plug picture, from its plug end). */
export const USB_TRAY_CROP = 880;

export interface Placed {
  left: number;
  top: number;
  w: number;
  h: number;
}
const box = (at: Pt, pin: Pt, size: [number, number]): Placed => ({ left: at[0] - pin[0], top: at[1] - pin[1], w: size[0], h: size[1] });

export function geometry(d: BuildData) {
  const holes = d.board.holes;
  const ids = Object.keys(holes);
  const pitch = d.pitchPx;
  const nanoKey = (k: string) => k.replace("/", ".");
  const nanoPinPx: Record<string, Pt> = {};
  for (const [k, p] of Object.entries(d.parts.nano.pins)) nanoPinPx[nanoKey(k)] = p;
  const hole = (id: HoleId): Pt => holes[id];
  /** The hole nearest a scene point, within `reach` pitches (null: none). */
  const nearest = (p: Pt, reach = 0.55): HoleId | null => {
    let best: HoleId | null = null;
    let bd = (reach * pitch) ** 2;
    for (const id of ids) {
      const q = holes[id];
      const dd = (q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2;
      if (dd < bd) {
        bd = dd;
        best = id;
      }
    }
    return best;
  };
  const nanoBox = (pl: NanoPlace): Placed => box(hole(`${pl.col}${pl.row}`), nanoPinPx.D12, d.parts.nano.size);
  const partPic = (kind: PartKind, rot: 0 | 90) => (kind === "fsr" ? d.parts.fsr : d.parts.resistor)[rot === 0 ? "rot0" : "rot90"];
  const partBox = (kind: PartKind, pl: PartPlace): Placed => {
    const pic = partPic(kind, pl.rot);
    return box(hole(pl.at), pic.pins["1"], pic.size);
  };
  /** Where the USB plug picture goes for a Nano at `pl` (its socket on the Nano's port). */
  const usbBox = (pl: NanoPlace): Placed => {
    const nb = nanoBox(pl);
    const u = d.parts.nano.usb;
    return box([nb.left + u[0], nb.top + u[1]], d.parts.usbPlug.socket, d.parts.usbPlug.size);
  };
  /** The FSR's disc (centre and radius, scene px) where it sits. */
  const fsrDisc = (pl: PartPlace): { c: Pt; r: number; active: number } => {
    const pic = d.parts.fsr[pl.rot === 0 ? "rot0" : "rot90"];
    const b = partBox("fsr", pl);
    return { c: [b.left + pic.press[0], b.top + pic.press[1]], r: pic.discRadiusPx, active: pic.activeRadiusPx };
  };
  /** Is a scene point on a part (what a press there picks up)? The Nano: its board and USB port; the FSR: its legs,
   *  its tail and its disc; the resistor: its legs and body. */
  const onNano = (pl: NanoPlace, p: Pt): boolean => {
    const b = nanoBox(pl);
    const [x0, y0, x1, y1] = d.parts.nano.pcb;
    const x = p[0] - b.left;
    const y = p[1] - b.top;
    return (x >= x0 - 4 && x <= x1 + 4 && y >= y0 - 4 && y <= y1 + 4) || (x >= 0 && x <= x0 + 40 && y >= 150 && y <= 290);
  };
  const onFsr = (pl: PartPlace, p: Pt, discOnly = false): boolean => {
    const disc = fsrDisc(pl);
    if ((p[0] - disc.c[0]) ** 2 + (p[1] - disc.c[1]) ** 2 <= disc.r ** 2) return true;
    if (discOnly) return false;
    const pic = d.parts.fsr[pl.rot === 0 ? "rot0" : "rot90"];
    const b = partBox("fsr", pl);
    const x = p[0] - b.left;
    const y = p[1] - b.top;
    const [a, z] = [pic.pins["1"], pic.pins["2"]];
    // the legs and the tail: a band from the pins to the disc, half a pitch either side of the two legs
    if (pl.rot === 0) return x >= a[0] - 30 && x <= z[0] + 30 && y >= a[1] - 30 && y <= pic.press[1];
    return y >= a[1] - 30 && y <= z[1] + 30 && x >= a[0] - 30 && x <= pic.press[0];
  };
  const onResistor = (pl: PartPlace, p: Pt): boolean => {
    const pic = partPic("resistor", pl.rot);
    const b = partBox("resistor", pl);
    const [a, z] = [pic.pins["1"], pic.pins["2"]];
    const x = p[0] - b.left;
    const y = p[1] - b.top;
    return pl.rot === 0 ? x >= a[0] - 22 && x <= z[0] + 22 && Math.abs(y - a[1]) <= 30 : y >= a[1] - 22 && y <= z[1] + 22 && Math.abs(x - a[0]) <= 30;
  };
  /** The pins of a placement, in scene px (for markers). */
  const pinsPx = (kind: "nano" | PartKind, pl: NanoPlace | PartPlace): Pt[] => {
    if (kind === "nano") return nanoPins(pl as NanoPlace).map((x) => hole(x.hole));
    const pins = pinsOf(kind, pl as PartPlace);
    return pins ? [hole(pins["1"]), hole(pins["2"])] : [];
  };
  return { holes, ids, pitch, nanoPinPx, hole, nearest, nanoBox, partPic, partBox, usbBox, fsrDisc, onNano, onFsr, onResistor, pinsPx };
}
export type Geometry = ReturnType<typeof geometry>;

/** The things placed on a board, top first (what a press picks up). */
export function partAt(g: Geometry, b: Build, p: Pt, discPressable: boolean): "nano" | PartKind | "usb" | null {
  if (b.fsr && g.onFsr(b.fsr, p) && !(discPressable && g.onFsr(b.fsr, p, true))) return "fsr";
  if (b.resistor && g.onResistor(b.resistor, p)) return "resistor";
  if (b.nano && b.usb) {
    const u = g.usbBox(b.nano);
    // (the plug's metal and its grip, up to the frame's left edge)
    if (p[0] >= Math.max(u.left + u.w - 700, FRAME[0]) && p[0] <= u.left + u.w + 6 && p[1] >= u.top + 8 && p[1] <= u.top + 228) return "usb";
  }
  if (b.nano && g.onNano(b.nano, p)) return "nano";
  return null;
}
