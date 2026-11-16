// Lesson 2.2's Hint button (src/widgets/build-bench.ts): the next single thing to do, worked out from the learner's own
// build and sketch, not from one fixed answer. Where the learner put the Nano, the sensor and the resistor stays theirs;
// a hint suggests holes that fit what is already there, says why in a sentence, and its "Do this step" does that one
// thing only. The circuit it steers toward is lesson 2.1's: 5V to one leg of the FSR; the other leg, the read pin (A0)
// and one leg of the 10 kΩ resistor on one strip; the resistor's other leg to GND.
// Order: something joined that must stay apart (a short, a bypassed part, A0 tied to 5V or GND) comes first, then the
// Nano, the FSR, the resistor, then the wires one at a time (5V, the read pin, the resistor if it isn't on the sensor's
// strip, GND). The sketch: decoy tiles out, then Serial.begin in setup(), analogRead, println and delay in loop(), then
// the boxes. Pure logic over the engine (../build/), no DOM.
import {
  checkNano,
  checkPart,
  checkWiring,
  holeFree,
  MONITOR_BAUDS,
  nanoPins,
  netlist,
  NANO_COL_MAX,
  parseHole,
  pinsOf,
  REFERENCE_BUILD,
  removePart,
  removeWire,
  stripHoles,
  stripOf,
  type Build,
  type HoleId,
  type NanoPlace,
  type NanoRow,
  type Net,
  type Netlist,
  type PartKind,
  type PartPlace,
  type PinName,
  type Text,
  type WireColor,
} from "../build/engine";
import type { ListId, SketchState } from "./sketch-ui";

type P2 = [number, number];
export type Pos = (h: HoleId) => P2;
export type Stage = "nano" | "parts" | "wires";

/** What a hint points at: holes to ring, pairs to join with a dashed line, the Nano's outline, a wire, a part on the mat,
 *  a code tile (and where it goes, or which box to fill). */
export interface CoachMarks {
  holes: HoleId[];
  pairs: [HoleId, HoleId][];
  nano: NanoPlace | null;
  wire: string | null;
  tray: "nano" | PartKind | "usb" | null;
  tile: { id: string; to?: { list: ListId; index: number }; field?: "pin" | "baud" | "ms" } | null;
}
export type Act =
  | { kind: "nano"; place: NanoPlace }
  | { kind: "part"; part: PartKind; place: PartPlace }
  | { kind: "wire"; a: HoleId; b: HoleId; color: WireColor }
  | { kind: "unwire"; id: string }
  | { kind: "sketch"; state: SketchState }
  | { kind: "usb" }
  | { kind: "upload" }
  | { kind: "baud"; baud: number }
  | { kind: "press" };
export interface Hint {
  text: Text;
  marks: CoachMarks;
  act: Act | null;
  /** nothing left to do in this step */
  done: boolean;
}

const t = (en: string, zh: string): Text => ({ en, zh });
const fill = (x: Text, v: Record<string, string | number>): Text => {
  const f = (s: string) => s.replace(/\{(\w+)\}/g, (m, k: string) => (k in v ? String(v[k]) : m));
  return { en: f(x.en), zh: f(x.zh) };
};
const marks = (m: Partial<CoachMarks> = {}): CoachMarks => ({ holes: [], pairs: [], nano: null, wire: null, tray: null, tile: null, ...m });
export const hint = (text: Text, m: Partial<CoachMarks> = {}, act: Act | null = null, done = false): Hint => ({ text, marks: marks(m), act, done });
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// ------------------------------------------------------------------------------------------------ the words
const W = {
  nano: t(
    "Drag the Nano onto the board so it sits across the groove in the middle. The ringed holes are one place that works: its pins in rows {r1} and {r2}, columns {c0} to {c1}.",
    "把 Nano 拖到面包板上，让它跨在中间的凹槽上。圈出的孔是一个可行的位置：引脚在 {r1} 行和 {r2} 行，第 {c0} 列到第 {c1} 列。",
  ),
  nanoNoRoom: t("Make room for the Nano: it needs 15 free columns across the groove.", "给 Nano 腾出位置：它需要跨过凹槽的 15 列空位。"),
  nanoDone: t(
    "The Nano is in. Point at one of its pins to see which holes join it, then go on to the next step.",
    "Nano 放好了。指向它的一个引脚，看看哪些孔和它相连，然后进入下一步。",
  ),
  fsr: t(
    "Drag the FSR onto the board, its legs in {a} and {b}: two strips with nothing in them yet. Its tail can hang off the edge.",
    "把 FSR 拖到面包板上，两条腿插在 {a} 和 {b}：两个还空着的小排。它的尾巴可以伸出板边。",
  ),
  fsrBypassed: t(
    "Both legs of the FSR are in one strip, so the strip joins them and no current goes through the sensor. Move it so its legs sit in {a} and {b}.",
    "FSR 的两条腿在同一个小排里，小排把它们直接连在一起，电流不会经过传感器。把它移到 {a} 和 {b}。",
  ),
  fsrNoRoom: t("Find two empty strips side by side for the FSR's legs.", "给 FSR 的两条腿找两个相邻的空小排。"),
  res: t(
    "Drag the 10 kΩ resistor onto the board. One leg goes in {near}, in the strip of the FSR's leg at {sig}; the other in {far}, a strip of its own. A wire will take that strip to GND.",
    "把 10 kΩ 电阻拖到面包板上。一条腿插在 {near}，和 FSR 在 {sig} 的腿同一个小排；另一条腿插在 {far}，单独占一个小排。之后用一根跳线把那个小排接到 GND。",
  ),
  resBypassed: t(
    "Both legs of the resistor are in one strip, so it does nothing. Move it so its legs sit in {near} and {far}.",
    "电阻的两条腿在同一个小排里，它就不起作用了。把它移到 {near} 和 {far}。",
  ),
  resNoRoom: t(
    "Put the resistor with one leg in the strip of the FSR's leg at {sig} and the other in an empty strip.",
    "把电阻的一条腿插进 FSR 在 {sig} 的腿所在的小排，另一条腿插进一个空小排。",
  ),
  partsDone: t("The Nano, the FSR and the resistor are all in. Go on to the next step to wire them.", "Nano、FSR 和电阻都放好了。进入下一步，把它们用跳线接起来。"),
  w5v: t(
    "Lay a red wire from {a}, in the strip of the Nano's 5V pin, to {b}, in the strip of the FSR's leg. It brings 5 V to the sensor.",
    "从 {a}（Nano 的 5V 引脚所在的小排）到 {b}（FSR 一条腿所在的小排）接一根红色跳线，把 5 V 送到传感器。",
  ),
  wPin: t(
    "Lay a yellow wire from {a}, in the strip of the Nano's {pin} pin, to {b}, in the strip of the FSR's other leg. {pin} reads the voltage there.",
    "从 {a}（Nano 的 {pin} 引脚所在的小排）到 {b}（FSR 另一条腿所在的小排）接一根黄色跳线，{pin} 就读这里的电压。",
  ),
  wRes: t(
    "Lay a wire from {a}, in the strip of the FSR's other leg, to {b}, in the strip of the resistor's leg. The resistor has to meet the sensor where {pin} reads.",
    "从 {a}（FSR 另一条腿所在的小排）到 {b}（电阻一条腿所在的小排）接一根跳线。电阻要和传感器在 {pin} 读数的那一点相接。",
  ),
  wGnd: t(
    "Lay a black wire from {a}, in the strip of the Nano's GND pin, to {b}, in the strip of the resistor's other leg. That ties the pull-down to GND.",
    "从 {a}（Nano 的 GND 引脚所在的小排）到 {b}（电阻另一条腿所在的小排）接一根黑色跳线，下拉电阻就接到了 GND。",
  ),
  wNoRoom: t("Join {x} to {y} with a jumper wire: free a hole in each strip first.", "用一根跳线把{x}和{y}连起来：先在两个小排里各空出一个孔。"),
  wiresDone: t("The circuit is complete: all four links in the diagram are lit. Go on to the next step.", "电路接好了：示意图里的四段连接都亮了。进入下一步吧。"),
  // things joined that must stay apart
  short: t("{p} and GND are joined: a short circuit.", "{p} 和 GND 连在了一起，这是短路。"),
  reset: t("RST is joined to GND, which holds the Nano in reset: it never runs the sketch.", "RST 连到了 GND，Nano 会一直处于复位状态，程序永远不会运行。"),
  fsrJoined: t("The FSR's two legs are joined, so the current skips the sensor.", "FSR 的两条腿连在了一起，电流绕过了传感器。"),
  resJoined: t("The resistor's two legs are joined, so it does nothing.", "电阻的两条腿连在了一起，它就不起作用了。"),
  pinHigh: t("{pin} is joined straight to 5V, so it would always read 1023.", "{pin} 直接连到了 5V，读数会一直是 1023。"),
  pinLow: t("{pin} is joined straight to GND, so it would always read 0.", "{pin} 直接连到了 GND，读数会一直是 0。"),
  apart: t("{x} and {y} are joined, but this circuit keeps them apart.", "{x}和{y}连在了一起，但这个电路里它们应该分开。"),
  byWire: t("This wire joins them: take it out.", "是这根跳线把它们连起来的：把它拔掉。"),
  moveFsr: t("Move the FSR so its legs sit in {a} and {b}.", "把 FSR 移到 {a} 和 {b}。"),
  moveRes: t("Move the resistor so its legs sit in {a} and {b}.", "把电阻移到 {a} 和 {b}。"),
  movePart: t("Move the {part} to strips with nothing else in them.", "把{part}移到没有别的东西的小排里。"),
  // names
  fsrLeg: t("the FSR's leg at {h}", "FSR 在 {h} 的腿"),
  resLeg: t("the resistor's leg at {h}", "电阻在 {h} 的腿"),
  nanoPin: t("the Nano's {p} pin", "Nano 的 {p} 引脚"),
  fsrName: t("FSR", "FSR"),
  resName: t("resistor", "电阻"),
};

// ------------------------------------------------------------------------------------------------ places that fit
/** One place for the Nano (lesson 2.1's, columns 3 to 17 with its pins in rows c and g, when free). */
function suggestNano(b: Build): NanoPlace | null {
  const bare = removePart(b, "nano");
  const ref = REFERENCE_BUILD.nano!;
  if (checkNano(bare, ref.col, ref.row).ok) return ref;
  for (const row of ["c", "b", "d", "e"] as NanoRow[]) for (let col = 1; col <= NANO_COL_MAX; col++) if (checkNano(bare, col, row).ok) return { col, row };
  return null;
}
const empty = (nl: Netlist, h: HoleId) => nl.netOfHole(h) === null;
/** One place for the FSR: its two legs in two empty strips, near the near edge (its tail hangs off), toward column 24. */
function suggestFsr(b: Build): PartPlace | null {
  const bare = removePart(b, "fsr");
  const nl = netlist(bare);
  const fits = (pl: PartPlace) => {
    if (!checkPart(bare, "fsr", pl).ok) return false;
    const ps = pinsOf("fsr", pl);
    return Boolean(ps && stripOf(ps["1"]) !== stripOf(ps["2"]) && empty(nl, ps["1"]) && empty(nl, ps["2"]));
  };
  const ref = REFERENCE_BUILD.fsr!;
  if (fits(ref)) return ref;
  const cols = Array.from({ length: 29 }, (_, i) => i + 1).sort((x, y) => Math.abs(x - 24) - Math.abs(y - 24) || y - x);
  for (const row of ["j", "i", "h", "a", "b"]) for (const col of cols) if (fits({ at: `${col}${row}`, rot: 0 })) return { at: `${col}${row}`, rot: 0 };
  return null;
}
/** One place for the resistor: a leg in the strip of the FSR's leg at `sig`, the other in an empty strip. */
function suggestResistor(b: Build, sig: HoleId): { place: PartPlace; near: HoleId; far: HoleId } | null {
  const bare = removePart(b, "resistor");
  const nl = netlist(bare);
  const h = parseHole(sig);
  if (!h || h.kind !== "grid") return null;
  const s = stripOf(sig);
  const C = h.col;
  const upper = "abcde".includes(h.row);
  const rows = upper ? ["c", "b", "d", "a", "e"] : ["h", "g", "i", "f", "j"];
  const cands: PartPlace[] = [
    { at: `${C}e`, rot: 90 },
    { at: `${C}d`, rot: 90 },
  ];
  for (const r of rows) cands.push({ at: `${C}${r}`, rot: 0 }, { at: `${C - 4}${r}`, rot: 0 });
  for (const pl of cands) {
    if (!parseHole(pl.at) || !checkPart(bare, "resistor", pl).ok) continue;
    const ps = pinsOf("resistor", pl);
    if (!ps) continue;
    const [near, far] = stripOf(ps["1"]) === s ? [ps["1"], ps["2"]] : stripOf(ps["2"]) === s ? [ps["2"], ps["1"]] : [null, null];
    if (!near || !far || stripOf(far) === s || !empty(nl, far)) continue;
    return { place: pl, near, far };
  }
  return null;
}

// ------------------------------------------------------------------------------------------------ the circuit's roles
const other = (p: PinName): PinName => (p === "1" ? "2" : "1");
interface Roles {
  /** the FSR leg that goes to 5V, and the one on the read pin */
  p5: PinName;
  sig: PinName;
  /** the resistor leg on the read pin's strip, and the one that goes to GND */
  near: PinName;
  far: PinName;
}
function rolesOf(b: Build, nl: Netlist, pin: string, pos: Pos): Roles {
  const has = (ref: string, name: string) => Boolean(nl.netOf(ref)?.nano.includes(name));
  const same = (x: string, y: string) => {
    const a = nl.netOf(x);
    const z = nl.netOf(y);
    return Boolean(a && z && a.id === z.id);
  };
  let p5: PinName = "1";
  if (has("fsr:2", "5V") && !has("fsr:1", "5V")) p5 = "2";
  else if (!has("fsr:1", "5V") && (has("fsr:1", pin) || same("fsr:1", "resistor:1") || same("fsr:1", "resistor:2"))) p5 = "2";
  const sig = other(p5);
  let far: PinName = "2";
  if (has("resistor:1", "GND") && !has("resistor:2", "GND")) far = "1";
  else if (has("resistor:2", "GND")) far = "2";
  else if (same("resistor:1", `fsr:${sig}`) || has("resistor:1", pin)) far = "2";
  else if (same("resistor:2", `fsr:${sig}`) || has("resistor:2", pin)) far = "1";
  else if (b.resistor && b.fsr) {
    const rp = pinsOf("resistor", b.resistor);
    const fp = pinsOf("fsr", b.fsr);
    if (rp && fp) {
      const d = (x: HoleId, y: HoleId) => Math.hypot(pos(x)[0] - pos(y)[0], pos(x)[1] - pos(y)[1]);
      far = d(rp["1"], fp[sig]) <= d(rp["2"], fp[sig]) ? "2" : "1";
    }
  }
  return { p5, sig, near: other(far), far };
}

/** Two things joined that the circuit keeps apart (refs as netlist().netOf takes them, or "nano:D2" for any other pin). */
interface Clash {
  x: string;
  y: string;
}
const netOfRef = (nl: Netlist, ref: string): Net | null => nl.netOf(ref.startsWith("nano:") ? ref.slice(5) : ref);
const joined = (nl: Netlist, x: string, y: string) => {
  const a = netOfRef(nl, x);
  const z = netOfRef(nl, y);
  return Boolean(a && z && a.id === z.id);
};
function clashes(nl: Netlist, r: Roles, pin: string): Clash[] {
  const groups = [
    ["5V", `fsr:${r.p5}`],
    [pin, `fsr:${r.sig}`, `resistor:${r.near}`],
    ["GND", `resistor:${r.far}`],
  ];
  const out: Clash[] = [];
  const seen = new Set<string>();
  const add = (x: string, y: string) => {
    const k = [x, y].sort().join("|");
    if (!seen.has(k)) (seen.add(k), out.push({ x, y }));
  };
  for (let i = 0; i < groups.length; i++)
    for (let j = i + 1; j < groups.length; j++) for (const x of groups[i]) for (const y of groups[j]) if (joined(nl, x, y)) add(x, y);
  // (another Nano pin on one of the circuit's nets: RST on GND holds the board in reset, 3V3 on 5V fights it, ...)
  const expect = new Set(["5V", pin, "GND"]);
  for (const g of groups)
    for (const x of g) {
      const n = netOfRef(nl, x);
      if (n) for (const name of n.nano) if (!expect.has(name)) add(x, `nano:${name}`);
    }
  return out;
}

// ------------------------------------------------------------------------------------------------ wires
const dist = (pos: Pos, x: HoleId, y: HoleId) => Math.hypot(pos(x)[0] - pos(y)[0], pos(x)[1] - pos(y)[1]);
/** A wire between two nets: a free hole in each, close together (and close to `anchor`, the Nano pin it starts by). */
function linkWire(b: Build, from: Net, to: Net, pos: Pos, anchor: HoleId | null): [HoleId, HoleId] | null {
  const free = (n: Net) => n.strips.flatMap((s) => stripHoles(s)).filter((h) => holeFree(b, h).ok);
  const A = free(from);
  const Z = free(to);
  const rail = (h: HoleId) => (parseHole(h)?.kind === "rail" ? 6 : 0);
  let best: [HoleId, HoleId] | null = null;
  let bs = Infinity;
  for (const a of A)
    for (const z of Z) {
      const s = dist(pos, a, z) + (anchor ? 0.35 * dist(pos, a, anchor) : 0) + rail(a) + rail(z);
      if (s < bs - 1e-6) {
        bs = s;
        best = [a, z];
      }
    }
  return best;
}
const pinHole = (b: Build, name: string, near: HoleId | null, pos: Pos): HoleId | null => {
  if (!b.nano) return null;
  const hs = nanoPins(b.nano)
    .filter((x) => x.pin.name === name)
    .map((x) => x.hole);
  if (!near) return hs[0] ?? null;
  return hs.sort((x, y) => dist(pos, x, near) - dist(pos, y, near))[0] ?? null;
};

// ------------------------------------------------------------------------------------------------ the build
/** The next thing to do on the board, for a step: "nano" looks at the Nano only, "parts" at the three parts, "wires" at
 *  everything. `pin` is the pin the sketch reads (A0 unless the learner typed another). */
export function buildHint(b: Build, stage: Stage, pin: string, pos: Pos): Hint {
  // the Nano
  if (!b.nano) {
    const pl = suggestNano(b);
    if (!pl) return hint(W.nanoNoRoom, { tray: "nano" });
    const ps = nanoPins(pl);
    const rows = [...new Set(ps.map((x) => x.hole.replace(/^\d+/, "")))];
    return hint(fill(W.nano, { r1: rows[0], r2: rows[1], c0: pl.col, c1: pl.col + 14 }), { holes: ps.map((x) => x.hole), nano: pl, tray: "nano" }, { kind: "nano", place: pl });
  }
  if (stage === "nano") return hint(W.nanoDone, {}, null, true);

  // a short first, before anything else: a supply pin straight to GND (or RST held there) by a wire
  {
    const nl0 = netlist(b);
    const power: [string, string, Text][] = [
      ["5V", "GND", fill(W.short, { p: "5V" })],
      ["nano:3V3", "GND", fill(W.short, { p: "3V3" })],
      ["nano:VIN", "GND", fill(W.short, { p: "VIN" })],
      ["nano:RST", "GND", W.reset],
    ];
    for (const [x, y, why] of power) {
      if (!joined(nl0, x, y)) continue;
      const w = [...b.wires].reverse().find((w) => !joined(netlist(removeWire(b, w.id)), x, y));
      if (w) return hint({ en: `${why.en} ${W.byWire.en}`, zh: `${why.zh}${W.byWire.zh}` }, { wire: w.id, holes: [w.a, w.b] }, { kind: "unwire", id: w.id });
    }
  }

  // the FSR: on the board, its legs in two strips
  const fsrPlace = () => {
    const pl = suggestFsr(b);
    const ps = pl ? pinsOf("fsr", pl) : null;
    return pl && ps ? { pl, a: ps["1"], z: ps["2"] } : null;
  };
  if (!b.fsr) {
    const s = fsrPlace();
    if (!s) return hint(W.fsrNoRoom, { tray: "fsr" });
    return hint(fill(W.fsr, { a: s.a, b: s.z }), { holes: [s.a, s.z], pairs: [[s.a, s.z]], tray: "fsr" }, { kind: "part", part: "fsr", place: s.pl });
  }
  const fp = pinsOf("fsr", b.fsr)!;
  if (stripOf(fp["1"]) === stripOf(fp["2"])) {
    const s = fsrPlace();
    if (!s) return hint(W.fsrNoRoom);
    return hint(fill(W.fsrBypassed, { a: s.a, b: s.z }), { holes: [s.a, s.z], pairs: [[s.a, s.z]] }, { kind: "part", part: "fsr", place: s.pl });
  }

  // the resistor: a leg on the sensor's other leg's strip, the other in a strip of its own
  let nl = netlist(b);
  const r = rolesOf(b, nl, pin, pos);
  const resPlace = () => suggestResistor(b, fp[r.sig]);
  if (!b.resistor) {
    const s = resPlace();
    if (!s) return hint(fill(W.resNoRoom, { sig: fp[r.sig] }), { holes: [fp[r.sig]], tray: "resistor" });
    return hint(fill(W.res, { near: s.near, far: s.far, sig: fp[r.sig] }), { holes: [s.near, s.far], pairs: [[s.near, s.far]], tray: "resistor" }, { kind: "part", part: "resistor", place: s.place });
  }
  const rp = pinsOf("resistor", b.resistor)!;
  if (stripOf(rp["1"]) === stripOf(rp["2"])) {
    const s = resPlace();
    if (!s) return hint(fill(W.resNoRoom, { sig: fp[r.sig] }), { holes: [fp[r.sig]] });
    return hint(fill(W.resBypassed, { near: s.near, far: s.far }), { holes: [s.near, s.far], pairs: [[s.near, s.far]] }, { kind: "part", part: "resistor", place: s.place });
  }

  // anything joined that must stay apart: the wire that does it comes out, or the part that does it moves
  const named = (ref: string): Text => {
    if (ref.startsWith("fsr:")) return fill(W.fsrLeg, { h: fp[ref.slice(4) as PinName] });
    if (ref.startsWith("resistor:")) return fill(W.resLeg, { h: rp[ref.slice(9) as PinName] });
    const p = ref.startsWith("nano:") ? ref.slice(5) : ref;
    return p === "5V" || p === "GND" || p === pin ? t(p, p) : fill(W.nanoPin, { p });
  };
  const why = (c: Clash): Text => {
    const k = new Set([c.x, c.y]);
    const has = (...xs: string[]) => xs.every((x) => k.has(x));
    if (has("5V", "GND")) return fill(W.short, { p: "5V" });
    if (has(`fsr:${r.p5}`, `fsr:${r.sig}`)) return W.fsrJoined;
    if (has(`resistor:${r.near}`, `resistor:${r.far}`)) return W.resJoined;
    if (k.has(pin) && (k.has("5V") || k.has(`fsr:${r.p5}`))) return fill(W.pinHigh, { pin });
    if (k.has(pin) && (k.has("GND") || k.has(`resistor:${r.far}`))) return fill(W.pinLow, { pin });
    const x = named(c.x);
    const y = named(c.y);
    return { en: fill(W.apart, { x: cap(x.en), y: y.en }).en, zh: fill(W.apart, { x: x.zh, y: y.zh }).zh };
  };
  const join2 = (a: Text, z: Text): Text => ({ en: `${a.en} ${z.en}`, zh: `${a.zh}${z.zh}` });
  for (const c of clashes(nl, r, pin)) {
    for (const w of [...b.wires].reverse()) {
      if (!joined(netlist(removeWire(b, w.id)), c.x, c.y)) return hint(join2(why(c), W.byWire), { wire: w.id, holes: [w.a, w.b] }, { kind: "unwire", id: w.id });
    }
    for (const part of ["resistor", "fsr"] as const) {
      if (joined(netlist(removePart(b, part)), c.x, c.y)) continue;
      if (part === "fsr") {
        const s = fsrPlace();
        if (s) return hint(join2(why(c), fill(W.moveFsr, { a: s.a, b: s.z })), { holes: [s.a, s.z], pairs: [[s.a, s.z]] }, { kind: "part", part: "fsr", place: s.pl });
      } else {
        const s = resPlace();
        if (s) return hint(join2(why(c), fill(W.moveRes, { a: s.near, b: s.far })), { holes: [s.near, s.far], pairs: [[s.near, s.far]] }, { kind: "part", part: "resistor", place: s.place });
      }
      const nm = part === "fsr" ? W.fsrName : W.resName;
      return hint(join2(why(c), { en: fill(W.movePart, { part: nm.en }).en, zh: fill(W.movePart, { part: nm.zh }).zh }));
    }
    return hint(why(c));
  }
  if (stage === "parts") return hint(W.partsDone, {}, null, true);

  // the wires, one at a time
  const links: { x: string; y: string; color: WireColor; text: Text; from: string | null }[] = [
    { x: "5V", y: `fsr:${r.p5}`, color: "red", text: W.w5v, from: "5V" },
    { x: pin, y: `fsr:${r.sig}`, color: "yellow", text: W.wPin, from: pin },
    { x: `fsr:${r.sig}`, y: `resistor:${r.near}`, color: "green", text: W.wRes, from: null },
    { x: "GND", y: `resistor:${r.far}`, color: "black", text: W.wGnd, from: "GND" },
  ];
  for (const l of links) {
    nl = netlist(b);
    if (joined(nl, l.x, l.y)) continue;
    const nx = netOfRef(nl, l.x);
    const ny = netOfRef(nl, l.y);
    const target = l.y.startsWith("fsr:") ? fp[l.y.slice(4) as PinName] : rp[l.y.slice(9) as PinName];
    const anchor = l.from ? pinHole(b, l.from, target, pos) : null;
    const pair = nx && ny ? linkWire(b, nx, ny, pos, anchor) : null;
    if (!pair) {
      const x = named(l.x);
      const y = named(l.y);
      return hint({ en: fill(W.wNoRoom, { x: x.en, y: y.en }).en, zh: fill(W.wNoRoom, { x: x.zh, y: y.zh }).zh });
    }
    const [a, z] = pair;
    return hint(fill(l.text, { a, b: z, pin }), { holes: [a, z], pairs: [[a, z]] }, { kind: "wire", a, b: z, color: l.color });
  }
  const c = checkWiring(b, pin);
  if (!c.ok && c.problems[0]) return hint({ en: `${c.problems[0].line.en} ${c.problems[0].hint.en}`, zh: `${c.problems[0].line.zh}${c.problems[0].hint.zh}` });
  return hint(W.wiresDone, {}, null, true);
}

// ------------------------------------------------------------------------------------------------ the sketch
const S = {
  out: {
    "pin-mode": t(
      "Take pinMode(A0, OUTPUT); out of the sketch. It would make the pin an output, and an output can't read the sensor.",
      "把 pinMode(A0, OUTPUT); 从程序里拿出来。它会把这个引脚变成输出，输出就读不了传感器了。",
    ),
    "digital-read": t(
      "Take int value = digitalRead(A0); out. It only gives 0 or 1; analogRead gives the whole range, 0 to 1023.",
      "把 int value = digitalRead(A0); 拿出来。它只会给出 0 或 1，analogRead 才能给出 0 到 1023 的整个范围。",
    ),
    print: t(
      "Take Serial.print(value); out and use Serial.println(value); instead, so each reading gets a line of its own.",
      "把 Serial.print(value); 拿出来，换成 Serial.println(value);，这样每个读数单独占一行。",
    ),
  } as Record<string, Text>,
  twoBegins: t("Take the second Serial.begin out. One, in setup(), is enough.", "把第二个 Serial.begin 拿出来，setup() 里有一个就够了。"),
  beginUp: t("Move Serial.begin to the top of setup(). The link to the computer only needs opening once, at the start.", "把 Serial.begin 移到 setup() 的第一行。和电脑之间的串口只需要在开始时打开一次。"),
  begin: t("Drag Serial.begin(9600); into setup(). It opens the link to the computer at 9600 baud.", "把 Serial.begin(9600); 拖进 setup()。它以 9600 波特率打开和电脑之间的串口。"),
  read: t(
    "Drag int value = analogRead({pin}); to the top of loop(). It reads the voltage on {pin} as a number from 0 to 1023, again and again.",
    "把 int value = analogRead({pin}); 拖到 loop() 的第一行。它一遍又一遍地把 {pin} 上的电压读成 0 到 1023 之间的数。",
  ),
  println: t("Drag Serial.println(value); under the analogRead line. It sends each number to the Serial Monitor.", "把 Serial.println(value); 拖到 analogRead 那一行下面。它把每个数发送到串口监视器。"),
  delay: t("Drag delay(100); to the end of loop(). It waits a tenth of a second between readings.", "把 delay(100); 拖到 loop() 的最后。它让两次读数之间等十分之一秒。"),
  pin: t("Type {pin} in analogRead: it's the pin the sensor is wired to.", "在 analogRead 里填 {pin}：传感器接在这个引脚上。"),
  baud: t("Type a baud rate in Serial.begin, such as 9600.", "在 Serial.begin 里填一个波特率，比如 9600。"),
  ms: t("Type a pause in delay, such as 100 (milliseconds).", "在 delay 里填一个暂停时间，比如 100（毫秒）。"),
  done: t("The sketch is complete. Press Verify to check it, then go on to the next step.", "程序拼好了。按“验证”检查一下，然后进入下一步。"),
};
const move = (st: SketchState, id: string, to: ListId, index: number): SketchState => {
  const setup = st.setup.filter((x) => x !== id);
  const loop = st.loop.filter((x) => x !== id);
  if (to === "setup") setup.splice(Math.max(0, Math.min(index, setup.length)), 0, id);
  if (to === "loop") loop.splice(Math.max(0, Math.min(index, loop.length)), 0, id);
  return { ...st, setup, loop };
};
const setField = (st: SketchState, id: string, f: "pin" | "baud" | "ms", v: string): SketchState => ({ ...st, tiles: { ...st.tiles, [id]: { ...st.tiles[id], [f]: v } } });

/** The next thing to do in the sketch (pin: the pin the sensor is wired to). */
export function sketchHint(st: SketchState, pin: string): Hint {
  const used = [...st.setup, ...st.loop];
  const out = (id: string, text: Text) => hint(text, { tile: { id, to: { list: "tray", index: 0 } } }, { kind: "sketch", state: move(st, id, "tray", 0) });
  const to = (id: string, list: ListId, index: number, text: Text) => hint(text, { tile: { id, to: { list, index } } }, { kind: "sketch", state: move(st, id, list, index) });
  // the decoys
  for (const id of ["pin-mode", "digital-read", "print"]) if (used.includes(id)) return out(id, S.out[id]);
  // one Serial.begin, first in setup()
  const begins = used.filter((id) => st.tiles[id]?.kind === "begin");
  if (begins.length > 1) {
    const keep = st.setup[0] && begins.includes(st.setup[0]) ? st.setup[0] : begins.includes("begin") ? "begin" : begins[0];
    return out(begins.find((x) => x !== keep)!, S.twoBegins);
  }
  if (!begins.length) return to("begin", "setup", 0, S.begin);
  const b = begins[0];
  if (st.setup[0] !== b) return to(b, "setup", 0, S.beginUp);
  // analogRead, println, delay: the first three lines of loop(), in that order
  if (st.loop[0] !== "read") return to("read", "loop", 0, fill(S.read, { pin }));
  if (st.loop[1] !== "println") return to("println", "loop", 1, S.println);
  if (st.loop[2] !== "delay") return to("delay", "loop", 2, S.delay);
  // the boxes
  const baud = (st.tiles[b].baud ?? "").trim();
  if (!/^\d+$/.test(baud) || !(MONITOR_BAUDS as readonly number[]).includes(Number(baud)))
    return hint(S.baud, { tile: { id: b, field: "baud" } }, { kind: "sketch", state: setField(st, b, "baud", "9600") });
  const rp = (st.tiles.read.pin ?? "").trim().toUpperCase();
  if (rp !== pin.toUpperCase()) return hint(fill(S.pin, { pin }), { tile: { id: "read", field: "pin" } }, { kind: "sketch", state: setField(st, "read", "pin", pin) });
  const ms = (st.tiles.delay.ms ?? "").trim();
  if (!/^\d+$/.test(ms) || Number(ms) < 1 || Number(ms) > 5000) return hint(S.ms, { tile: { id: "delay", field: "ms" } }, { kind: "sketch", state: setField(st, "delay", "ms", "100") });
  return hint(S.done, {}, null, true);
}

// ------------------------------------------------------------------------------------------------ step 5
export const RUN = {
  usb: t("Plug the USB cable into the Nano: click the cable on the mat, or the USB button in the panel.", "把 USB 线插到 Nano 上：点一下垫子上的 USB 线，或者点面板里的 USB 按钮。"),
  upload: t("Press Upload to send the sketch to the Nano.", "按“上传”，把程序发送到 Nano。"),
  wait: t("The sketch is on its way to the Nano. Wait a moment.", "程序正在传到 Nano 上，稍等一下。"),
  baud: t(
    "The Serial Monitor is set to {monitor} baud, the sketch talks at {sketch}. Set the monitor to {sketch}.",
    "串口监视器设成了 {monitor} 波特率，程序用的是 {sketch}。把监视器也设成 {sketch}。",
  ),
  press: t(
    "It works. Press and hold the sensor's round pad, and drag down to press harder: the numbers in the Serial Monitor climb.",
    "成功了。按住传感器的圆形区域，往下拖表示更用力：串口监视器里的数字会往上升。",
  ),
};
