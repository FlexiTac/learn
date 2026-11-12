// The electrical model of Lesson 2.2's build (src/widgets/build/): what voltage every net sits at.
//   - USB plugged in powers the Nano: its 5V pin gives VCC (5 V, @shared/data/constants.mjs) and its 3V3 pin 3.3 V (the
//     Nano's pinout: "+3V3"); GND is 0 V. Without USB nothing runs.
//   - 5V or 3V3 joined straight to GND, or 5V to 3V3, is a short circuit: the power cuts out and the board shuts off
//     (INFERRED: a USB port limits its current and the classic Nano has a USB fuse; we don't model how fast).
//   - RST joined straight to GND holds the Nano in reset: it never starts (INFERRED from RST being active low).
//   - The FSR is a resistance at the press force (./../bench/fsr.ts, Adafruit's table: ILLUSTRATIVE curve), an open
//     circuit when untouched (more than 10 MΩ, Interlink). The resistor is R1, 10 kΩ (the reading board's own).
//   - Every other pin is a high-impedance input, except one the sketch has set with pinMode(pin, OUTPUT): it drives
//     LOW through R_OUT (ILLUSTRATIVE, about what the ATmega328P's output-voltage curves give at 5 V). A6 and A7 have
//     no output driver (they are analog inputs only, datasheet §1.1.9), so pinMode does nothing to them.
//   - A small nodal analysis gives each net's voltage. A net with no path through resistances to 5V, 3V3 or GND is
//     floating (null): nothing sets its voltage, and an analog read of it wanders (sketch.ts, ILLUSTRATIVE).
import { R1, VCC } from "@shared/data/constants.mjs";
import { fsrOhms } from "../bench/fsr";
import type { Build } from "./board";
import { netlist, type Net, type Netlist } from "./netlist";

/** The Nano's 3V3 pin (Arduino Nano pinout and datasheet: "+3V3"). */
export const V3V3 = 3.3;
export { R1, VCC };
/** ILLUSTRATIVE: an ATmega328P output pin driving LOW, as a resistance to GND (about 0.5 V at 20 mA). */
export const R_OUT = 25;
/** Analog-only pins: pinMode has no output to switch on (datasheet §1.1.9: "ADC7:6 serve as analog inputs"). */
export const ANALOG_ONLY = new Set(["A6", "A7"]);

export type Power = "off" | "on" | "short";
export interface PowerState {
  state: Power;
  /** when shorted: the two supply pins joined, e.g. { a: "5V", b: "GND" } */
  short?: { a: string; b: string };
  /** RST is joined straight to GND: the Nano is held in reset */
  reset: boolean;
}

const SUPPLIES = ["5V", "3V3", "GND"] as const;

/** Whether the board has power: no Nano or no USB is "off"; a supply joined to another is "short". */
export function powerOf(b: Build, nl: Netlist = netlist(b)): PowerState {
  if (!b.nano || !b.usb) return { state: "off", reset: false };
  const net = (n: string) => nl.netOf(n);
  for (const [a, z] of [["5V", "GND"], ["3V3", "GND"], ["5V", "3V3"]] as const) {
    if (net(a) && net(a) === net(z)) return { state: "short", short: { a, b: z }, reset: false };
  }
  const rst = net("RST");
  return { state: "on", reset: rst !== null && rst === net("GND") };
}

/** The fixed voltages: the supplies' nets (only when the board is on). */
function fixed(nl: Netlist, p: PowerState): Map<number, number> {
  const m = new Map<number, number>();
  if (p.state !== "on") return m;
  const v: Record<(typeof SUPPLIES)[number], number> = { "5V": VCC, "3V3": V3V3, GND: 0 };
  for (const s of SUPPLIES) {
    const n = nl.netOf(s);
    if (n) m.set(n.id, v[s]);
  }
  return m;
}

interface Element {
  a: number;
  b: number;
  ohms: number;
}

/** Every net's voltage for a press force (N, 0 = untouched) and a set of pins the sketch drives LOW: null where a net
 *  is floating (or the board is off). */
export function solve(nl: Netlist, p: PowerState, force: number, outputs: ReadonlySet<string> = new Set()): (number | null)[] {
  const n = nl.nets.length;
  const out: (number | null)[] = new Array(n).fill(null);
  const fix = fixed(nl, p);
  if (!fix.size) return out;
  const els: Element[] = [];
  const f1 = nl.netOf("fsr:1");
  const f2 = nl.netOf("fsr:2");
  const rf = fsrOhms(force);
  if (f1 && f2 && Number.isFinite(rf)) els.push({ a: f1.id, b: f2.id, ohms: rf });
  const r1 = nl.netOf("resistor:1");
  const r2 = nl.netOf("resistor:2");
  if (r1 && r2) els.push({ a: r1.id, b: r2.id, ohms: R1 });
  const gnd = nl.netOf("GND");
  for (const pin of outputs) {
    const net = nl.netOf(pin);
    if (net && gnd && !ANALOG_ONLY.has(pin)) els.push({ a: net.id, b: gnd.id, ohms: R_OUT });
  }
  // which nets reach a fixed one through resistances
  const adj: number[][] = Array.from({ length: n }, () => []);
  for (const e of els) {
    if (e.a === e.b) continue;
    adj[e.a].push(e.b);
    adj[e.b].push(e.a);
  }
  const reached = new Set<number>(fix.keys());
  const queue = [...fix.keys()];
  while (queue.length) {
    const x = queue.shift() as number;
    for (const y of adj[x]) if (!reached.has(y)) reached.add(y), queue.push(y);
  }
  for (const [id, v] of fix) out[id] = v;
  const unknown = [...reached].filter((id) => !fix.has(id));
  if (!unknown.length) return out;
  const idx = new Map(unknown.map((id, i) => [id, i]));
  const m = unknown.length;
  const G = Array.from({ length: m }, () => new Array<number>(m + 1).fill(0));
  for (const e of els) {
    if (e.a === e.b) continue;
    const g = 1 / e.ohms;
    const ia = idx.get(e.a);
    const ib = idx.get(e.b);
    if (ia !== undefined) {
      G[ia][ia] += g;
      if (ib !== undefined) G[ia][ib] -= g;
      else if (fix.has(e.b)) G[ia][m] += g * (fix.get(e.b) as number);
    }
    if (ib !== undefined) {
      G[ib][ib] += g;
      if (ia !== undefined) G[ib][ia] -= g;
      else if (fix.has(e.a)) G[ib][m] += g * (fix.get(e.a) as number);
    }
  }
  const x = gauss(G);
  unknown.forEach((id, i) => (out[id] = x[i]));
  return out;
}

/** Solves the augmented system in place (Gaussian elimination with partial pivoting). */
function gauss(A: number[][]): number[] {
  const m = A.length;
  for (let c = 0; c < m; c++) {
    let p = c;
    for (let r = c + 1; r < m; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    [A[c], A[p]] = [A[p], A[c]];
    const d = A[c][c] || 1e-300;
    for (let r = 0; r < m; r++) {
      if (r === c) continue;
      const k = A[r][c] / d;
      if (k) for (let j = c; j <= m; j++) A[r][j] -= k * A[c][j];
    }
  }
  return A.map((row, i) => row[m] / (row[i] || 1e-300));
}

/** A build's circuit, ready to be asked for voltages (the netlist and the power are worked out once). */
export interface Circuit {
  build: Build;
  nl: Netlist;
  power: PowerState;
  /** the voltage on a Nano pin by name ("A0"), or on "fsr:1" etc.; null when floating, when the board is off, or for a
   *  pin that is not on the board */
  volts(ref: string, force: number, outputs?: ReadonlySet<string>): number | null;
  /** the voltage of the net a hole is on (null: floating, off, or a strip with nothing in it) */
  voltsAt(hole: string, force: number, outputs?: ReadonlySet<string>): number | null;
  /** the net of a pin: see Netlist.netOf */
  net(ref: string): Net | null;
  /** the net is one of the supplies (5V, 3V3 or GND): its name, else null */
  supplyOf(net: Net | null): "5V" | "3V3" | "GND" | null;
}

export function circuit(b: Build): Circuit {
  const nl = netlist(b);
  const power = powerOf(b, nl);
  const cache = new Map<string, (number | null)[]>();
  const all = (force: number, outputs: ReadonlySet<string>) => {
    const key = `${force}|${[...outputs].sort().join(",")}`;
    let v = cache.get(key);
    if (!v) {
      if (cache.size > 256) cache.clear();
      cache.set(key, (v = solve(nl, power, force, outputs)));
    }
    return v;
  };
  return {
    build: b,
    nl,
    power,
    net: (ref) => nl.netOf(ref),
    volts(ref, force, outputs = new Set()) {
      const n = nl.netOf(ref);
      return n ? all(force, outputs)[n.id] : null;
    },
    voltsAt(hole, force, outputs = new Set()) {
      const n = nl.netOfHole(hole);
      return n ? all(force, outputs)[n.id] : null;
    },
    supplyOf(net) {
      if (!net) return null;
      for (const s of SUPPLIES) if (net.nano.includes(s)) return s;
      return null;
    },
  };
}
