// The breadboard of Lesson 2.2 "Build it and make it work" and where the parts' pins go, in hole ids and pin names only
// (never pixels: the renders' build.json maps them to pictures). It follows the build's shared contract (CONTRACT.md,
// 2026-11-12); this folder's README.md documents the API.
//   - A half-size board: columns 1..30, rows a..j. The five holes a..e of one column are one strip, f..j another; the
//     groove lies between e and f (rows at 0..4 and 7..11 pitches of 2.54 mm).
//   - Four continuous power rails of 25 holes: TP and TN along the top edge, BP and BN along the bottom.
//   - The Nano straddles the groove, USB to the left: the column of its leftmost pins (1..16) and the row of its upper
//     header (b..e); the lower header sits 6 pitches below it (f..i). Its body covers the holes between the two rows.
//   - The FSR and the resistor sit by an anchor hole (their pin "1") and a turn, 0 or 90 degrees. Their legs go in the
//     middle of the board only (the rails take wires); only the Nano's body blocks holes.
// Every edit returns a new Build (nothing is changed in place), so the interface can keep an undo list for free.
import { say, type Text } from "./words";

export const COLS = 30;
export const ROWS = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"] as const;
export type Row = (typeof ROWS)[number];
/** Each row's place across the board, in pitches from row a: the groove is the gap between e (4) and f (7). */
export const ROW_Y: Readonly<Record<Row, number>> = { a: 0, b: 1, c: 2, d: 3, e: 4, f: 7, g: 8, h: 9, i: 10, j: 11 };
export const RAILS = ["TP", "TN", "BP", "BN"] as const;
export type Rail = (typeof RAILS)[number];
export const RAIL_HOLES = 25;

/** "12c" (column and row) or "TP7" (rail and its hole, 1..25). */
export type HoleId = string;
/** A strip of holes joined inside the board: "12a-e", "12f-j", or a whole rail "TP" / "TN" / "BP" / "BN". */
export type StripId = string;

export type Hole = { id: HoleId; kind: "grid"; col: number; row: Row } | { id: HoleId; kind: "rail"; rail: Rail; n: number };

const GRID_RE = /^([1-9]|[12]\d|30)([a-j])$/;
const RAIL_RE = /^(TP|TN|BP|BN)([1-9]|1\d|2[0-5])$/;

/** The hole an id names, or null when the board has no such hole. */
export function parseHole(id: string): Hole | null {
  const g = GRID_RE.exec(id);
  if (g) return { id, kind: "grid", col: Number(g[1]), row: g[2] as Row };
  const r = RAIL_RE.exec(id);
  if (r) return { id, kind: "rail", rail: r[1] as Rail, n: Number(r[2]) };
  return null;
}
export const isHole = (id: string): boolean => parseHole(id) !== null;
const isRow = (r: string): r is Row => (ROWS as readonly string[]).includes(r);

/** The hole at a column and a row, or null off the board. */
export function holeAt(col: number, row: string): HoleId | null {
  return Number.isInteger(col) && col >= 1 && col <= COLS && isRow(row) ? `${col}${row}` : null;
}
/** The row `dy` pitches below `row` (negative: above), or null where that lands in the groove or off the board. */
export function rowBelow(row: Row, dy: number): Row | null {
  const y = ROW_Y[row] + dy;
  return ROWS.find((r) => ROW_Y[r] === y) ?? null;
}
export const isUpperRow = (row: Row): boolean => ROW_Y[row] <= ROW_Y.e;

/** The strip a hole belongs to (null for an id that is not a hole). */
export function stripOf(id: HoleId): StripId | null {
  const h = parseHole(id);
  if (!h) return null;
  return h.kind === "rail" ? h.rail : `${h.col}${isUpperRow(h.row) ? "a-e" : "f-j"}`;
}
/** Every hole of a strip, in order (empty for an unknown strip id). */
export function stripHoles(strip: StripId): HoleId[] {
  if ((RAILS as readonly string[]).includes(strip)) return Array.from({ length: RAIL_HOLES }, (_, i) => `${strip}${i + 1}`);
  const m = /^(\d+)(a-e|f-j)$/.exec(strip);
  if (!m || Number(m[1]) < 1 || Number(m[1]) > COLS) return [];
  const rows: readonly Row[] = m[2] === "a-e" ? ROWS.slice(0, 5) : ROWS.slice(5);
  return rows.map((r) => `${m[1]}${r}`);
}
/** Every hole of the board: the grid column by column (1a..1j, 2a..), then the rails TP, TN, BP, BN. */
export const ALL_HOLES: readonly HoleId[] = [
  ...Array.from({ length: COLS }, (_, c) => ROWS.map((r) => `${c + 1}${r}`)).flat(),
  ...RAILS.flatMap((r) => stripHoles(r)),
];

// ------------------------------------------------------------------ the parts

/** The Nano's upper header, left (USB end) to right, and its lower one (CONTRACT.md). */
export const NANO_UPPER = ["D12", "D11", "D10", "D9", "D8", "D7", "D6", "D5", "D4", "D3", "D2", "GND", "RST", "RX0", "TX1"] as const;
export const NANO_LOWER = ["D13", "3V3", "AREF", "A0", "A1", "A2", "A3", "A4", "A5", "A6", "A7", "5V", "RST", "GND", "VIN"] as const;
/** Pitches between the two header rows (0.6 in). */
export const NANO_SPAN = 6;
/** The rows the upper header may take, so that the lower one lands across the groove (f..i). */
export const NANO_ROWS = ["b", "c", "d", "e"] as const;
export type NanoRow = (typeof NANO_ROWS)[number];
/** The rightmost column the Nano's leftmost pins may take (15 pins wide). */
export const NANO_COL_MAX = COLS - NANO_UPPER.length + 1;

export interface NanoPlace {
  /** the column of its leftmost pins (D12 and D13), 1..16 */
  col: number;
  /** the row of its upper header (D12..TX1), b..e */
  row: NanoRow;
}
export interface NanoPin {
  /** unique: the name, except the two GND and the two RST pins, which are "GND.upper", "GND.lower", "RST.upper",
   *  "RST.lower" */
  key: string;
  /** as printed on the board: "A0", "5V", "GND" ... */
  name: string;
  upper: boolean;
  /** 0..14 from the USB end */
  index: number;
}
const twice = new Set(["GND", "RST"]);
export const NANO_PINS: readonly NanoPin[] = [
  ...NANO_UPPER.map((name, index) => ({ key: twice.has(name) ? `${name}.upper` : name, name, upper: true, index })),
  ...NANO_LOWER.map((name, index) => ({ key: twice.has(name) ? `${name}.lower` : name, name, upper: false, index })),
];
export const nanoPinByKey = (key: string): NanoPin | undefined => NANO_PINS.find((p) => p.key === key);

/** Each of the Nano's 30 pins with its hole. */
export function nanoPins(p: NanoPlace): { pin: NanoPin; hole: HoleId }[] {
  const lower = rowBelow(p.row, NANO_SPAN) as Row;
  return NANO_PINS.map((pin) => ({ pin, hole: `${p.col + pin.index}${pin.upper ? p.row : lower}` }));
}
/** The holes under the Nano's body: those between its two header rows, in its 15 columns. */
export function nanoBody(p: NanoPlace): HoleId[] {
  const top = ROW_Y[p.row];
  const rows = ROWS.filter((r) => ROW_Y[r] > top && ROW_Y[r] < top + NANO_SPAN);
  return Array.from({ length: NANO_UPPER.length }, (_, i) => rows.map((r) => `${p.col + i}${r}`)).flat();
}

export type Rot = 0 | 90;
/** The FSR or the resistor: the hole of its pin "1" and how it is turned. */
export interface PartPlace {
  at: HoleId;
  rot: Rot;
}
export type PinName = "1" | "2";
export type PartPins = Record<PinName, HoleId>;
export type PartKind = "fsr" | "resistor";
/** The resistor's legs are bent to this many pitches. */
export const RESISTOR_SPAN = 4;

/** Where a part's two pins go, or why they can't: rot 0 runs to the right along a row; rot 90 runs down a column (the
 *  FSR's pins are one pitch apart, the resistor's legs four). */
function partPins(kind: PartKind, p: PartPlace): PartPins | "rail" | "groove" | "off-board" {
  const h = parseHole(p.at);
  if (!h) return "off-board";
  if (h.kind === "rail") return "rail";
  const span = kind === "fsr" ? 1 : RESISTOR_SPAN;
  if (p.rot === 0) {
    const b = holeAt(h.col + span, h.row);
    return b ? { "1": p.at, "2": b } : "off-board";
  }
  const y = ROW_Y[h.row] + span;
  const r = rowBelow(h.row, span);
  if (r) return { "1": p.at, "2": `${h.col}${r}` };
  return y > ROW_Y.j ? "off-board" : "groove";
}
/** The FSR's two pins (rot 0: side by side in one row, the tail running down; rot 90: one above the other in a column,
 *  the tail running right, which puts both in one strip), or null where it can't go. */
export function fsrPins(p: PartPlace): PartPins | null {
  const r = partPins("fsr", p);
  return typeof r === "string" ? null : r;
}
/** The resistor's two legs (rot 0: four columns apart in one row; rot 90: four pitches apart down a column, so only
 *  a-e, d-f, e-g and f-j), or null where it can't go. */
export function resistorPins(p: PartPlace): PartPins | null {
  const r = partPins("resistor", p);
  return typeof r === "string" ? null : r;
}
export const pinsOf = (kind: PartKind, p: PartPlace): PartPins | null => (kind === "fsr" ? fsrPins(p) : resistorPins(p));

// ------------------------------------------------------------------ the build

export const WIRE_COLORS = ["red", "black", "yellow", "blue", "green"] as const;
export type WireColor = (typeof WIRE_COLORS)[number];
export interface Wire {
  id: string;
  a: HoleId;
  b: HoleId;
  color: WireColor;
}
export interface Build {
  nano: NanoPlace | null;
  fsr: PartPlace | null;
  resistor: PartPlace | null;
  wires: readonly Wire[];
  /** the USB cable is plugged into the Nano (it powers the board and carries the sketch and the readings) */
  usb: boolean;
}
export const EMPTY_BUILD: Build = { nano: null, fsr: null, resistor: null, wires: [], usb: false };

/** What sits in a hole. */
export type Occupant =
  | { kind: "nano"; pin: string }
  | { kind: "nano-body" }
  | { kind: "fsr"; pin: PinName }
  | { kind: "resistor"; pin: PinName }
  | { kind: "wire"; id: string; end: "a" | "b" };
/** A part, a whole wire or one end of a wire: left out of occupancy() while it is being moved. */
export type Thing = "nano" | PartKind | { wire: string; end?: "a" | "b" };

/** Every used hole and what is in it (`leave` out: the thing being moved). */
export function occupancy(b: Build, leave?: Thing): Map<HoleId, Occupant> {
  const m = new Map<HoleId, Occupant>();
  if (b.nano && leave !== "nano") {
    for (const h of nanoBody(b.nano)) m.set(h, { kind: "nano-body" });
    for (const { pin, hole } of nanoPins(b.nano)) m.set(hole, { kind: "nano", pin: pin.key });
  }
  for (const kind of ["fsr", "resistor"] as const) {
    const p = b[kind];
    const pins = p && leave !== kind ? pinsOf(kind, p) : null;
    if (pins) for (const pin of ["1", "2"] as const) m.set(pins[pin], { kind, pin });
  }
  for (const w of b.wires) {
    for (const end of ["a", "b"] as const) {
      if (typeof leave === "object" && leave.wire === w.id && (!leave.end || leave.end === end)) continue;
      m.set(w[end], { kind: "wire", id: w.id, end });
    }
  }
  return m;
}

// ------------------------------------------------------------------ may it go there?

export type Problem = "off-board" | "rail" | "groove" | "nano-groove" | "taken" | "under-nano" | "covers" | "same-hole" | "no-wire";
export type Check = { ok: true } | { ok: false; why: Problem; hole?: HoleId; text: Text };
const OK: Check = { ok: true };
function no(why: Problem, hole?: HoleId): Check {
  const vars = hole ? { hole } : undefined;
  const key = { "off-board": "offBoard", rail: "rail", groove: "groove", "nano-groove": "nanoGroove", taken: "taken", "under-nano": "underNano", covers: "covers", "same-hole": "sameHole", "no-wire": "noWire" } as const;
  return { ok: false, why, ...(hole ? { hole } : {}), text: say(key[why], vars) };
}
/** A hole a new pin or wire end may take: on the board, not used, not under the Nano. */
function free(occ: Map<HoleId, Occupant>, hole: HoleId): Check {
  if (!isHole(hole)) return no("off-board");
  const o = occ.get(hole);
  if (!o) return OK;
  return o.kind === "nano-body" ? no("under-nano", hole) : no("taken", hole);
}

/** May a pin or a wire end go into this one hole (the start of a wire's drag)? */
export const holeFree = (b: Build, hole: HoleId): Check => free(occupancy(b), hole);

/** May the Nano go with its leftmost pins in `col` and its upper header in `row` (any row letter: a row that does not
 *  put the two headers across the groove gives "nano-groove", whose text says why; the interface may add
 *  `say("nanoPairs")`)? The Nano already on the board is moved, so its own holes don't count. */
export function checkNano(b: Build, col: number, row: string): Check {
  if (!(NANO_ROWS as readonly string[]).includes(row)) return isRow(row) ? no("nano-groove") : no("off-board");
  if (!Number.isInteger(col) || col < 1 || col > NANO_COL_MAX) return no("off-board");
  const place: NanoPlace = { col, row: row as NanoRow };
  const occ = occupancy(b, "nano");
  for (const { hole } of nanoPins(place)) {
    const c = free(occ, hole);
    if (!c.ok) return c;
  }
  for (const hole of nanoBody(place)) if (occ.has(hole)) return no("covers", hole);
  return OK;
}

/** May the FSR or the resistor go there (the one already on the board is moved, so its own holes don't count)? */
export function checkPart(b: Build, kind: PartKind, p: PartPlace): Check {
  const pins = partPins(kind, p);
  if (typeof pins === "string") return no(pins);
  const occ = occupancy(b, kind);
  for (const pin of ["1", "2"] as const) {
    const c = free(occ, pins[pin]);
    if (!c.ok) return c;
  }
  return OK;
}

/** May a new wire (or wire `id`, moved whole) run from hole `a` to hole `z`? Two ends in one strip are allowed: it
 *  joins nothing new, as on a real board. */
export function checkWire(b: Build, a: HoleId, z: HoleId, id?: string): Check {
  if (a === z) return no("same-hole");
  const occ = occupancy(b, id ? { wire: id } : undefined);
  for (const h of [a, z]) {
    const c = free(occ, h);
    if (!c.ok) return c;
  }
  return OK;
}

/** May one end of wire `id` move to `hole`? */
export function checkWireEnd(b: Build, id: string, end: "a" | "b", hole: HoleId): Check {
  const w = b.wires.find((x) => x.id === id);
  if (!w) return no("no-wire");
  if (w[end === "a" ? "b" : "a"] === hole) return no("same-hole");
  return free(occupancy(b, { wire: id, end }), hole);
}

// ------------------------------------------------------------------ edits (each returns a new Build)

export type Edit = { ok: true; build: Build } | { ok: false; why: Problem; hole?: HoleId; text: Text; build: Build };
const done = (build: Build): Edit => ({ ok: true, build });
const refused = (c: Check, build: Build): Edit => (c.ok ? done(build) : { ...c, build });

export function placeNano(b: Build, p: NanoPlace): Edit {
  const c = checkNano(b, p.col, p.row);
  return c.ok ? done({ ...b, nano: { col: p.col, row: p.row } }) : refused(c, b);
}
export function placePart(b: Build, kind: PartKind, p: PartPlace): Edit {
  const c = checkPart(b, kind, p);
  return c.ok ? done({ ...b, [kind]: { at: p.at, rot: p.rot } }) : refused(c, b);
}
export const placeFsr = (b: Build, p: PartPlace): Edit => placePart(b, "fsr", p);
export const placeResistor = (b: Build, p: PartPlace): Edit => placePart(b, "resistor", p);
/** Takes a part off the board (its wires stay where they are). Without the Nano there is nothing to plug USB into. */
export function removePart(b: Build, kind: "nano" | PartKind): Build {
  return kind === "nano" ? { ...b, nano: null, usb: false } : { ...b, [kind]: null };
}

/** A new id for a wire: "w1", "w2", ... (one more than the highest in use). */
export function nextWireId(b: Build): string {
  const n = b.wires.reduce((m, w) => Math.max(m, Number(/^w(\d+)$/.exec(w.id)?.[1] ?? 0)), 0);
  return `w${n + 1}`;
}
export function addWire(b: Build, a: HoleId, z: HoleId, color: WireColor, id: string = nextWireId(b)): Edit {
  if (b.wires.some((w) => w.id === id)) id = nextWireId(b);
  const c = checkWire(b, a, z);
  return c.ok ? done({ ...b, wires: [...b.wires, { id, a, b: z, color }] }) : refused(c, b);
}
export function moveWireEnd(b: Build, id: string, end: "a" | "b", hole: HoleId): Edit {
  const c = checkWireEnd(b, id, end, hole);
  return c.ok ? done({ ...b, wires: b.wires.map((w) => (w.id === id ? { ...w, [end]: hole } : w)) }) : refused(c, b);
}
export function moveWire(b: Build, id: string, a: HoleId, z: HoleId): Edit {
  if (!b.wires.some((w) => w.id === id)) return refused(no("no-wire"), b);
  const c = checkWire(b, a, z, id);
  return c.ok ? done({ ...b, wires: b.wires.map((w) => (w.id === id ? { ...w, a, b: z } : w)) }) : refused(c, b);
}
export const recolorWire = (b: Build, id: string, color: WireColor): Build => ({ ...b, wires: b.wires.map((w) => (w.id === id ? { ...w, color } : w)) });
export const removeWire = (b: Build, id: string): Build => ({ ...b, wires: b.wires.filter((w) => w.id !== id) });
/** Plugs the USB cable in or out (only into a Nano that is on the board). */
export const plugUsb = (b: Build, on: boolean): Build => ({ ...b, usb: on && b.nano !== null });
/** Which part or wire end is in a hole, if any (the interface's pick-up). */
export const whatIsAt = (b: Build, hole: HoleId): Occupant | undefined => occupancy(b).get(hole);

// ------------------------------------------------------------------ the reference

/** Lesson 2.1's circuit on this board, for "Show me" and the tests: the Nano at column 3 (digital header in row c,
 *  analog header in row g), the FSR's pins side by side at the board's lower edge (24j and 25j, the tail running off
 *  the board), the resistor across the groove in column 25 (25e to 25g), and three wires: red 5V (14h) to the FSR's
 *  strip 24, yellow A0 (6i) to strip 25, black from the upper GND's strip (14b) to the resistor's upper strip (25b).
 *  The same topology as 2.1's bench render (bench/README.md: 5V -> FSR 24, A0 -> FSR 25, resistor across the groove
 *  in 25, black wire from the digital row's GND), turned so the analog header faces the FSR. */
export const REFERENCE_BUILD: Build = {
  nano: { col: 3, row: "c" },
  fsr: { at: "24j", rot: 0 },
  resistor: { at: "25e", rot: 90 },
  wires: [
    { id: "w1", a: "14h", b: "24h", color: "red" },
    { id: "w2", a: "6i", b: "25i", color: "yellow" },
    { id: "w3", a: "14b", b: "25b", color: "black" },
  ],
  usb: true,
};

/** Whether a build is complete enough to be one (every placement legal, no two things in one hole), for builds that
 *  come from saved state rather than from the edits above. */
export function validBuild(b: Build): boolean {
  let x: Build = { ...EMPTY_BUILD, usb: false };
  if (b.nano) {
    const e = placeNano(x, b.nano);
    if (!e.ok) return false;
    x = e.build;
  }
  for (const kind of ["fsr", "resistor"] as const) {
    const p = b[kind];
    if (!p) continue;
    const e = placePart(x, kind, p);
    if (!e.ok) return false;
    x = e.build;
  }
  for (const w of b.wires) {
    if (!(WIRE_COLORS as readonly string[]).includes(w.color)) return false;
    const e = addWire(x, w.a, w.b, w.color, w.id);
    if (!e.ok || e.build.wires[e.build.wires.length - 1].id !== w.id) return false;
    x = e.build;
  }
  return !b.usb || b.nano !== null;
}
