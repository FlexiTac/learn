// What is connected to what (Lesson 2.2's build engine): the board's hidden strips and rails, the jumper wires and the
// Nano's own inner joins (its two GND pins are one, and so are its two RST pins) become nets, by union-find. Each net
// knows its strips and holes (to light them up), the Nano pins, FSR pins and resistor legs on it; connections() says the
// ones that matter in plain words, in English and Chinese: "5V — FSR pin 1", "A0 — FSR pin 2 — resistor",
// "GND — resistor".
import { nanoPinByKey, nanoPins, pinsOf, stripHoles, stripOf, type Build, type HoleId, type NanoPin, type Occupant, type PinName, type StripId } from "./board";
import { join, same, say, type Text } from "./words";

/** One thing on a net: a Nano pin (by its key), an FSR pin or a resistor leg. */
export type Item = { kind: "nano"; pin: NanoPin } | { kind: "fsr"; pin: PinName } | { kind: "resistor"; pin: PinName };

export interface Net {
  /** 0.., in the order connections() lists nets */
  id: number;
  strips: StripId[];
  /** every hole of its strips (a rail brings all 25 of its holes) */
  holes: HoleId[];
  items: Item[];
  /** the Nano pins on it by name, each once ("GND" for both GND pins) */
  nano: string[];
  fsr: PinName[];
  resistor: PinName[];
}

export interface Netlist {
  nets: Net[];
  /** the net of a Nano pin by name ("A0", "5V", "GND"), of "fsr:1" / "fsr:2", or of "resistor:1" / "resistor:2" */
  netOf(ref: string): Net | null;
  /** the net a hole is on, or null for a strip with nothing in it */
  netOfHole(hole: HoleId): Net | null;
}

class UnionFind {
  private up = new Map<string, string>();
  find(a: string): string {
    let r = a;
    while (this.up.has(r) && this.up.get(r) !== r) r = this.up.get(r) as string;
    if (!this.up.has(a)) this.up.set(a, a);
    let x = a;
    while (x !== r) {
      const n = this.up.get(x) as string;
      this.up.set(x, r);
      x = n;
    }
    return r;
  }
  union(a: string, b: string): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.up.set(rb, ra);
  }
  keys(): string[] {
    return [...this.up.keys()];
  }
}

const POWER_ORDER = ["5V", "3V3", "VIN"];
/** Where a net comes in connections(): 5V first, then 3V3, the analog pins, the other pins, nets with no Nano pin, and
 *  GND last (so a pull-down circuit reads top to bottom: 5V, sensor, A0, resistor, GND). */
function rank(n: Pick<Net, "nano">): number {
  if (n.nano.includes("GND")) return 900;
  const p = POWER_ORDER.findIndex((x) => n.nano.includes(x));
  if (p >= 0) return p;
  const a = n.nano.map((x) => /^A(\d)$/.exec(x)).find(Boolean);
  if (a) return 10 + Number(a[1]);
  if (n.nano.length) return 100;
  return 500;
}
const pinOrder = (name: string): number => {
  if (POWER_ORDER.includes(name)) return POWER_ORDER.indexOf(name);
  const a = /^A(\d)$/.exec(name);
  if (a) return 10 + Number(a[1]);
  if (name === "GND") return 900;
  return 100;
};

/** The build's nets. Only strips with something in them (a pin or a wire end) make nets; a Nano pin alone in its strip
 *  is a net of one. */
export function netlist(b: Build): Netlist {
  const uf = new UnionFind();
  const items = new Map<string, Item>();
  const strips = new Set<StripId>();
  const add = (key: string, item: Item, hole: HoleId) => {
    const s = stripOf(hole);
    if (!s) return;
    items.set(key, item);
    strips.add(s);
    uf.union(`s:${s}`, key);
  };
  if (b.nano) {
    for (const { pin, hole } of nanoPins(b.nano)) add(`nano:${pin.key}`, { kind: "nano", pin }, hole);
    uf.union("nano:GND.upper", "nano:GND.lower");
    uf.union("nano:RST.upper", "nano:RST.lower");
  }
  for (const kind of ["fsr", "resistor"] as const) {
    const p = b[kind];
    const pins = p ? pinsOf(kind, p) : null;
    if (pins) for (const pin of ["1", "2"] as const) add(`${kind}:${pin}`, { kind, pin }, pins[pin]);
  }
  for (const w of b.wires) {
    const sa = stripOf(w.a);
    const sb = stripOf(w.b);
    if (!sa || !sb) continue;
    strips.add(sa);
    strips.add(sb);
    uf.union(`s:${sa}`, `s:${sb}`);
  }
  // group by root
  const groups = new Map<string, { strips: StripId[]; items: Item[] }>();
  const group = (root: string) => {
    let g = groups.get(root);
    if (!g) groups.set(root, (g = { strips: [], items: [] }));
    return g;
  };
  for (const s of strips) group(uf.find(`s:${s}`)).strips.push(s);
  for (const [key, item] of items) group(uf.find(key)).items.push(item);
  const nets: Net[] = [...groups.values()].map((g) => {
    const nano = [...new Set(g.items.filter((i) => i.kind === "nano").map((i) => (i as { pin: NanoPin }).pin.name))].sort((x, y) => pinOrder(x) - pinOrder(y) || x.localeCompare(y));
    const fsr = g.items.filter((i) => i.kind === "fsr").map((i) => i.pin as PinName).sort();
    const resistor = g.items.filter((i) => i.kind === "resistor").map((i) => i.pin as PinName).sort();
    return { id: 0, strips: g.strips, holes: g.strips.flatMap(stripHoles), items: g.items, nano, fsr, resistor };
  });
  nets.sort((x, y) => rank(x) - rank(y) || (x.holes[0] ?? "").localeCompare(y.holes[0] ?? ""));
  nets.forEach((n, i) => (n.id = i));
  const byStrip = new Map<StripId, Net>();
  for (const n of nets) for (const s of n.strips) byStrip.set(s, n);
  const netOf = (ref: string): Net | null => {
    const m = /^(fsr|resistor):([12])$/.exec(ref);
    if (m) return nets.find((n) => (m[1] === "fsr" ? n.fsr : n.resistor).includes(m[2] as PinName)) ?? null;
    return nets.find((n) => n.nano.includes(ref)) ?? null;
  };
  return { nets, netOf, netOfHole: (hole) => byStrip.get(stripOf(hole) ?? "") ?? null };
}

/** The holes to light up for a hole: its whole net, or its own strip when nothing is in it (empty for a non-hole). */
export function joinedHoles(b: Build, hole: HoleId): HoleId[] {
  const n = netlist(b).netOfHole(hole);
  if (n) return n.holes;
  const s = stripOf(hole);
  return s ? stripHoles(s) : [];
}

export interface Connection {
  /** "5V — FSR pin 1" / "5V — FSR 引脚 1" */
  text: Text;
  net: Net;
}

/** Things that matter to the circuit, in plain words: every net that joins two or more things (Nano pins, the FSR's
 *  pins, the resistor's legs), nothing else. A part with both pins on one net is named once, with "(both pins)". */
export function connections(b: Build): Connection[] {
  const out: Connection[] = [];
  for (const net of netlist(b).nets) {
    const words: Text[] = net.nano.map(same);
    if (net.fsr.length === 2) words.push(say("itemFsrBoth"));
    else for (const n of net.fsr) words.push(say("itemFsr", { n }));
    if (net.resistor.length === 2) words.push(say("itemResBoth"));
    else if (net.resistor.length) words.push(say("itemRes"));
    const things = net.nano.length + net.fsr.length + net.resistor.length;
    if (things < 2) continue;
    out.push({ text: join(words, same(" — ")), net });
  }
  return out;
}

/** What to call the thing in a hole, for a hover label: "A0", "FSR pin 2", "resistor"; null for a wire end or a hole
 *  under the Nano. */
export function occupantName(o: Occupant | undefined): Text | null {
  if (!o) return null;
  if (o.kind === "nano") return same(nanoPinByKey(o.pin)?.name ?? o.pin);
  if (o.kind === "fsr") return say("itemFsr", { n: o.pin });
  if (o.kind === "resistor") return say("itemRes");
  return null;
}
