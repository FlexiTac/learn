// Tests for Lesson 2.2's build engine: the board, the netlist, the solver, the sketch and every verdict, one case per
// symptom, the reference build and several equivalent working builds. No framework: bundle and run it in node
// (README.md in this folder):
//   node_modules/.bin/esbuild src/widgets/build/engine.test.ts --bundle --platform=node --format=esm --outfile=<tmp>.mjs
//   node <tmp>.mjs
// It prints one line per case and throws at the end if any failed (node exits 1). Nothing imports this file, so the
// site's build leaves it out; tsc still checks it.
import { adcCode, MAX_CODE } from "@shared/models/adc.mjs";
import { readAt } from "../bench/fsr";
import {
  ALL_HOLES,
  addWire,
  checkNano,
  checkPart,
  checkWire,
  checkWireEnd,
  checkWiring,
  circuit,
  compile,
  connections,
  EMPTY_BUILD,
  F_PRESS,
  fsrPins,
  holeFree,
  joinedHoles,
  lineOf,
  moveWireEnd,
  NANO_LOWER,
  occupantName,
  NANO_UPPER,
  nanoBody,
  nanoPins,
  parseHole,
  pieces,
  placeFsr,
  placeNano,
  placeResistor,
  plugUsb,
  REFERENCE_BUILD,
  REFERENCE_SKETCH,
  removePart,
  removeWire,
  resistorPins,
  run,
  runner,
  say,
  sourceOf,
  stripHoles,
  stripOf,
  TRAY,
  V3V3,
  validBuild,
  whatIsAt,
  WORDS,
  type Build,
  type NanoRow,
  type Rot,
  type Sketch,
  type SymptomId,
  type Tile,
  type Verdict,
  type WireColor,
} from "./engine";

// ------------------------------------------------------------------ a tiny harness

const results: { name: string; ok: boolean; why?: string }[] = [];
function test(name: string, fn: () => void): void {
  try {
    fn();
    results.push({ name, ok: true });
  } catch (e) {
    results.push({ name, ok: false, why: (e as Error).message });
  }
}
let why = ""; // what the last failed check saw (eqv, hasSymptom, worksFor), added to assert's message
function assert(cond: unknown, msg: string): asserts cond {
  const w = why;
  why = "";
  if (!cond) throw new Error(w ? `${msg}: ${w}` : msg);
}
const show = (x: unknown) => JSON.stringify(x);
/** Keeps what a failed check saw, for the next assert's message; returns false. */
function debug(saw: string): false {
  why = saw;
  return false;
}
function eqv(got: unknown, want: unknown): boolean {
  return show(got) === show(want) || debug(`got ${show(got)}, want ${show(want)}`);
}

// ------------------------------------------------------------------ builders

interface Spec {
  nano?: [number, NanoRow] | null;
  fsr?: [string, Rot] | null;
  res?: [string, Rot] | null;
  wires?: [string, string, WireColor?][];
  usb?: boolean;
}
/** A build made through the engine's own edits, so every placement in a test is a legal one. */
function make(s: Spec): Build {
  let b: Build = EMPTY_BUILD;
  const must = (e: { ok: boolean; build: Build; text?: { en: string } }, what: string) => {
    if (!e.ok) throw new Error(`cannot place ${what}: ${e.text?.en}`);
    return e.build;
  };
  if (s.nano) b = must(placeNano(b, { col: s.nano[0], row: s.nano[1] }), "nano");
  if (s.fsr) b = must(placeFsr(b, { at: s.fsr[0], rot: s.fsr[1] }), "fsr");
  if (s.res) b = must(placeResistor(b, { at: s.res[0], rot: s.res[1] }), "resistor");
  for (const [a, z, color] of s.wires ?? []) b = must(addWire(b, a, z, color ?? "green"), `wire ${a}-${z}`);
  return plugUsb(b, s.usb ?? true);
}
/** The reference, as a spec, to vary. */
const REF: Required<Spec> = {
  nano: [3, "c"],
  fsr: ["24j", 0],
  res: ["25e", 90],
  wires: [
    ["14h", "24h", "red"],
    ["6i", "25i", "yellow"],
    ["14b", "25b", "black"],
  ],
  usb: true,
};
const ref = (over: Partial<Spec> = {}): Build => make({ ...REF, ...over });
const withWires = (w: [string, string, WireColor?][]): Build => ref({ wires: w });
const RED = REF.wires[0];
const YELLOW = REF.wires[1];
const BLACK = REF.wires[2];

let n = 0;
const T = {
  begin: (baud = "9600"): Tile => ({ id: `t${++n}`, kind: "begin", baud }),
  pinMode: (pin = "A0"): Tile => ({ id: `t${++n}`, kind: "pinMode", pin }),
  read: (pin = "A0"): Tile => ({ id: `t${++n}`, kind: "analogRead", pin }),
  dread: (pin = "A0"): Tile => ({ id: `t${++n}`, kind: "digitalRead", pin }),
  println: (): Tile => ({ id: `t${++n}`, kind: "println" }),
  print: (): Tile => ({ id: `t${++n}`, kind: "print" }),
  delay: (ms = "100"): Tile => ({ id: `t${++n}`, kind: "delay", ms }),
};
const sk = (setup: Tile[], loop: Tile[]): Sketch => ({ setup, loop });
const STD = (pin = "A0", baud = "9600", ms = "100") => sk([T.begin(baud)], [T.read(pin), T.println(), T.delay(ms)]);

const A0_AT = (f: number) => adcCode(readAt(f).volts); // Lesson 2.1's own numbers for the 5 V pull-down circuit

function hasSymptom(v: Verdict, id: SymptomId): boolean {
  const t = v.symptom;
  const all = t.line.en + t.line.zh + t.hint.en + t.hint.zh;
  if (t.id !== id) return debug(`symptom ${t.id} (${t.line.en}), want ${id}`);
  if (!(t.line.en && t.line.zh && t.hint.en && t.hint.zh)) return debug(`a text is empty`);
  if (/\{\w+\}/.test(all)) return debug(`an unfilled slot in ${all}`);
  return true;
}
/** The verdict when it works (pressing firmly moves the number on the monitor by 100 or more), else null. */
function worksFor(b: Build, s: Sketch = STD(), monitorBaud?: number): Verdict | null {
  const v = run(b, s, { monitorBaud });
  const p = run(b, s, { monitorBaud, force: F_PRESS });
  const pressed = Number(p.monitor.lines[p.monitor.lines.length - 1]);
  const rest = Number(v.monitor.lines[v.monitor.lines.length - 1]);
  if (!v.ok) return debug(`not ok: ${v.symptom.id}: ${v.symptom.line.en}`) || null;
  if (!v.circuitOk) return debug(`circuit not ok`) || null;
  if (p.monitor.kind !== "numbers") return debug(`monitor ${p.monitor.kind}`) || null;
  if (!(Math.abs(pressed - rest) >= 100)) return debug(`pressing moved ${rest} -> ${pressed}`) || null;
  return v;
}

// ------------------------------------------------------------------ the board

test("board-holes", () => {
  assert(eqv(ALL_HOLES.length, 400), "tie points");
  assert(eqv(new Set(ALL_HOLES).size, 400), "unique holes");
  assert(eqv(stripOf("12c"), "12a-e"), "upper strip");
  assert(eqv(stripOf("12f"), "12f-j"), "lower strip");
  assert(eqv(stripOf("TP3"), "TP"), "rail strip");
  assert(eqv(stripHoles("12a-e"), ["12a", "12b", "12c", "12d", "12e"]), "strip holes");
  assert(eqv(stripHoles("TN").length, 25), "rail holes");
  for (const bad of ["31a", "0a", "1k", "TP26", "TP0", "XP1", "", "1A"]) assert(parseHole(bad) === null, `not a hole: ${bad}`);
  assert(eqv(parseHole("30j"), { id: "30j", kind: "grid", col: 30, row: "j" }), "last hole");
});

test("nano-pins", () => {
  const pins = Object.fromEntries(nanoPins({ col: 3, row: "c" }).map((p) => [p.pin.key, p.hole]));
  assert(eqv([pins.D12, pins.D13, pins.A0, pins["5V"], pins["GND.upper"], pins["GND.lower"], pins.TX1, pins.VIN, pins["3V3"]], ["3c", "3g", "6g", "14g", "14c", "16g", "17c", "17g", "4g"]), "pin holes");
  const body = nanoBody({ col: 3, row: "c" });
  assert(eqv(body.length, 45), "body holes");
  assert(body.includes("3d") && body.includes("17f") && !body.includes("17g") && !body.includes("18e"), "body rows d..f, columns 3..17");
  assert(eqv(nanoBody({ col: 1, row: "b" }).filter((h) => h.endsWith("f")).length, 0), "upper b: lower header in f, nothing of the lower half under the body");
  // the reason the Nano straddles: GND (upper) sits across from 5V (lower)
  assert(eqv(NANO_UPPER.indexOf("GND"), NANO_LOWER.indexOf("5V")), "GND across from 5V");
});

test("nano-straddles", () => {
  for (const row of ["b", "c", "d", "e"]) assert(checkNano(EMPTY_BUILD, 1, row).ok, `row ${row} ok`);
  for (const row of ["a", "f", "g", "j"]) {
    const c = checkNano(EMPTY_BUILD, 3, row);
    assert(!c.ok && c.why === "nano-groove", `row ${row}: nano-groove`);
  }
  const off = checkNano(EMPTY_BUILD, 17, "c");
  assert(!off.ok && off.why === "off-board", "column 17 is off the board");
  assert(checkNano(EMPTY_BUILD, 16, "e").ok, "column 16 fits");
  assert(say("nanoPairs").zh.length > 0, "the pairs text exists");
});

test("part-pins", () => {
  assert(eqv(fsrPins({ at: "24j", rot: 0 }), { 1: "24j", 2: "25j" }), "fsr rot 0");
  assert(eqv(fsrPins({ at: "30a", rot: 0 }), null), "fsr off the right edge");
  assert(eqv(fsrPins({ at: "24a", rot: 90 }), { 1: "24a", 2: "24b" }), "fsr rot 90");
  assert(eqv(fsrPins({ at: "24e", rot: 90 }), null), "fsr rot 90 into the groove");
  assert(eqv(fsrPins({ at: "24j", rot: 90 }), null), "fsr rot 90 off the bottom");
  for (const [a, z] of [["5a", "5e"], ["5d", "5f"], ["5e", "5g"], ["5f", "5j"]]) assert(eqv(resistorPins({ at: a, rot: 90 })?.[2], z), `resistor ${a}`);
  for (const a of ["5b", "5c", "5g", "5h", "5i", "5j"]) assert(eqv(resistorPins({ at: a, rot: 90 }), null), `resistor rot 90 at ${a}`);
  assert(eqv(resistorPins({ at: "26c", rot: 0 }), { 1: "26c", 2: "30c" }), "resistor rot 0");
  assert(eqv(resistorPins({ at: "27c", rot: 0 }), null), "resistor off the edge");
  const g = checkPart(EMPTY_BUILD, "resistor", { at: "5b", rot: 90 });
  assert(!g.ok && g.why === "groove", "groove reason");
  const r = checkPart(EMPTY_BUILD, "fsr", { at: "TP3", rot: 0 });
  assert(!r.ok && r.why === "rail", "rail reason");
});

test("occupancy-rules", () => {
  const b = make({ nano: [3, "c"] });
  const under = checkPart(b, "fsr", { at: "5d", rot: 0 });
  assert(!under.ok && under.why === "under-nano" && under.hole === "5d", "fsr under the nano");
  const onPin = checkPart(b, "fsr", { at: "6g", rot: 0 });
  assert(!onPin.ok && onPin.why === "taken" && onPin.hole === "6g", "fsr on a nano pin");
  const w1 = checkWire(b, "14c", "20a");
  assert(!w1.ok && w1.why === "taken", "wire into a nano pin");
  const w2 = checkWire(b, "10e", "20a");
  assert(!w2.ok && w2.why === "under-nano", "wire under the nano");
  const w3 = checkWire(b, "20a", "20a");
  assert(!w3.ok && w3.why === "same-hole", "same hole");
  assert(checkWire(b, "20a", "20b").ok, "two holes of one strip are allowed");
  assert(checkWire(b, "TP1", "BN25").ok, "rail to rail");
  assert(holeFree(b, "20a").ok && !holeFree(b, "6g").ok && !holeFree(b, "x9").ok, "one hole");
  const withWire = make({ nano: null, wires: [["10e", "20a"]] });
  const cover = checkNano(withWire, 3, "c");
  assert(!cover.ok && cover.why === "covers" && cover.hole === "10e", "the nano can't cover a wire end");
  const pinOnWire = checkNano(make({ wires: [["6g", "20a"]] }), 3, "c");
  assert(!pinOnWire.ok && pinOnWire.why === "taken", "a nano pin can't go where a wire is");
  const two = make({ fsr: ["20a", 0] });
  const clash = checkPart(two, "resistor", { at: "17a", rot: 0 });
  assert(!clash.ok && clash.why === "taken" && clash.hole === "21a", "resistor onto the fsr");
  assert(checkPart(two, "fsr", { at: "21a", rot: 0 }).ok, "the fsr may move over its own old holes");
  assert(checkNano(ref(), 3, "c").ok, "the nano may stay where it is");
  const mv = checkWireEnd(ref(), "w1", "b", "14h");
  assert(!mv.ok && mv.why === "same-hole", "a wire's end onto its other end");
});

test("edits", () => {
  let b = make({ nano: [3, "c"] });
  const e1 = addWire(b, "14h", "24h", "red");
  assert(e1.ok, "add wire");
  b = e1.build;
  const e2 = addWire(b, "6i", "25i", "yellow");
  assert(e2.ok && e2.build.wires.map((w) => w.id).join() === "w1,w2", "wire ids");
  b = e2.build;
  const bad = addWire(b, "14h", "20a", "red");
  assert(!bad.ok && bad.build === b, "a refused edit hands the build back unchanged");
  const m = moveWireEnd(b, "w1", "b", "24i");
  assert(m.ok && m.build.wires[0].b === "24i", "move a wire end");
  assert(eqv(removeWire(m.build, "w1").wires.map((w) => w.id), ["w2"]), "remove wire");
  const p = plugUsb(b, true);
  assert(p.usb, "usb in");
  const off = removePart(p, "nano");
  assert(!off.usb && !off.nano, "no nano, no usb");
  assert(!plugUsb(EMPTY_BUILD, true).usb, "usb needs a nano");
  assert(validBuild(REFERENCE_BUILD), "reference is valid");
  assert(!validBuild({ ...REFERENCE_BUILD, fsr: { at: "14h", rot: 0 } }), "an fsr on a wire end is not valid");
  assert(eqv(show(ref()), show(REFERENCE_BUILD)), "the test's reference spec is the engine's REFERENCE_BUILD");
});

test("joined-holes", () => {
  const holes = joinedHoles(REFERENCE_BUILD, "6g");
  assert(holes.includes("25f") && holes.includes("6j") && holes.includes("25j"), "A0's strip lights up with the FSR's and the resistor's");
  assert(eqv(joinedHoles(REFERENCE_BUILD, "1a"), stripHoles("1a-e")), "an empty strip lights up alone");
});

// ------------------------------------------------------------------ what is connected to what

test("connections-reference", () => {
  const lines = connections(REFERENCE_BUILD);
  assert(eqv(lines.map((l) => l.text.en), ["5V — FSR pin 1", "A0 — FSR pin 2 — resistor", "GND — resistor"]), "english");
  assert(eqv(lines.map((l) => l.text.zh), ["5V — FSR 引脚 1", "A0 — FSR 引脚 2 — 电阻", "GND — 电阻"]), "chinese");
});

test("connections-other", () => {
  const b = make({ ...REF, fsr: ["24i", 90] , wires: [RED, ["6i", "25i", "yellow"], BLACK] });
  assert(eqv(connections(b).map((l) => l.text.en), ["5V — FSR (both pins)", "A0 — resistor", "GND — resistor"]), "fsr in one strip");
  const short = withWires([...REF.wires, ["14i", "16i"]]);
  assert(eqv(connections(short)[connections(short).length - 1].text.en, "5V — GND — FSR pin 1 — resistor"), "short: one net");
  assert(eqv(connections(make({ nano: [3, "c"], wires: [["6h", "7h"]] })).map((l) => l.text.en), ["A0 — A1"]), "two pins joined");
});

// ------------------------------------------------------------------ the solver

test("solver-matches-lesson-2-1", () => {
  const c = circuit(REFERENCE_BUILD);
  for (const f of [0, 0.2, 1, 3, 10, 20]) {
    const v = c.volts("A0", f) as number;
    assert(Math.abs(v - readAt(f).volts) < 1e-9, `A0 at ${f} N: ${v} vs ${readAt(f).volts}`);
  }
  assert(eqv(c.volts("5V", 0), 5), "5V");
  assert(eqv(c.volts("3V3", 0), V3V3), "3V3");
  assert(eqv(c.volts("GND", 0), 0), "GND");
  assert(eqv(c.volts("A1", 0), null), "A1 floats");
  assert(eqv(circuit({ ...REFERENCE_BUILD, usb: false }).volts("A0", 10), null), "no power, no voltage");
  assert(eqv(c.voltsAt("25h", 1), c.volts("A0", 1)), "a hole on A0's net");
  assert(eqv(c.voltsAt("TP1", 1), null), "an empty rail");
  assert(eqv(occupantName(whatIsAt(REFERENCE_BUILD, "25j")), { en: "FSR pin 2", zh: "FSR 引脚 2" }), "hover name");
  assert(eqv(occupantName(whatIsAt(REFERENCE_BUILD, "14c"))?.en, "GND"), "the upper GND");
  assert(eqv(occupantName(whatIsAt(REFERENCE_BUILD, "10e")), null), "under the nano");
});

// ------------------------------------------------------------------ the sketch

test("sketch-source", () => {
  const src = sourceOf(REFERENCE_SKETCH);
  assert(eqv(src, "void setup() {\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  int value = analogRead(A0);\n  Serial.println(value);\n  delay(100);\n}\n"), "source");
  for (const t of TRAY) assert(`  ${lineOf(t)}`.length <= 46, `line too long: ${lineOf(t)}`);
  assert(eqv(pieces(TRAY[0]), [{ code: "Serial.begin(" }, { field: "baud", value: "9600" }, { code: ");" }]), "pieces");
  assert(eqv(new Set(TRAY.map((t) => t.id)).size, TRAY.length), "tray ids unique");
});

test("compile-errors", () => {
  const err = (s: Sketch) => {
    const c = compile(s);
    if (c.ok) throw new Error("compiled");
    return c.error;
  };
  const e1 = err(sk([T.begin()], [T.println(), T.read()]));
  assert(eqv(e1.ide.en, "error: 'value' was not declared in this scope"), "print before read");
  assert(e1.line.en.includes("loop()"), "names the function");
  const e2 = err(sk([T.begin(), T.read()], [T.println(), T.delay()]));
  assert(e2.line.en.includes("setup()") && e2.line.en.includes("loop()"), "read in setup, printed in loop");
  assert(eqv(err(sk([], [T.read(), T.dread(), T.println()])).ide.en, "error: redeclaration of 'int value'"), "two reads");
  const e4 = err(sk([], [T.read("A9")]));
  assert(eqv(e4.ide.en, "error: 'A9' was not declared in this scope"), "no pin A9");
  assert(e4.line.zh.includes("A9"), "chinese names the pin");
  assert(eqv(err(sk([], [T.read("a0")])).line.en, say("cPin", { pin: "a0" }).en), "case matters");
  assert(eqv(err(sk([T.pinMode("D2")], [])).hint.en, say("cPinHintDigital").en), "D2 is not a name the AVR core has");
  assert(eqv(err(sk([], [T.read("")])).ide.en, "error: too few arguments to function 'int analogRead(uint8_t)'"), "empty pin");
  assert(eqv(err(sk([T.begin("")], [])).ide.en, "error: no matching function for call to 'HardwareSerial::begin()'"), "empty baud");
  assert(eqv(err(sk([], [T.delay(" ")])).ide.en, "error: too few arguments to function 'void delay(long unsigned int)'"), "empty pause");
  assert(eqv(err(sk([T.pinMode("")], [])).ide.en, "error: expected primary-expression before ',' token"), "empty pinMode pin");
  const dec = compile(sk([T.begin("9600.0")], [T.read(), T.println(), T.delay("1.5")]));
  assert(dec.ok && dec.program.loop[2].kind === "delay" && dec.program.loop[2].ms === 1 && dec.program.setup[0].kind === "begin" && dec.program.setup[0].baud === 9600, "decimals are cut to whole numbers");
  assert(eqv(err(sk([T.begin("96OO")], [])).line.en, say("cNumber", { code: "Serial.begin(96OO);" }).en), "a mistyped baud");
  assert(eqv(err(sk([], [T.delay("abc")])).ide.en, "error: 'abc' was not declared in this scope"), "a word for a delay");
  const ok = compile(sk([T.begin()], [T.read("0"), T.println(), T.delay("-1")]));
  assert(ok.ok, "numbers for pins compile");
  if (ok.ok) {
    assert(eqv(ok.program.loop[0].kind === "analogRead" && ok.program.loop[0].pin.name, "A0"), "analogRead(0) is A0");
    assert(eqv(ok.program.loop[2].kind === "delay" && ok.program.loop[2].ms, 4294967295), "delay(-1) waits 49 days");
  }
});

test("compile-symptom", () => {
  const v = run(REFERENCE_BUILD, sk([T.begin()], [T.println(), T.read()]));
  assert(eqv(v.stage, "compile"), "stage");
  assert(hasSymptom(v, "compile"), "compile");
  assert(v.circuitOk, "the wiring is still right");
});

// ------------------------------------------------------------------ working builds

test("reference-works", () => {
  const v = worksFor(REFERENCE_BUILD, REFERENCE_SKETCH);
  assert(v, "reference");
  assert(hasSymptom(v, "works"), "reference");
  assert(eqv(v.symptom.level, "ok"), "level");
  assert(eqv(v.stage, "run"), "stage");
  assert(eqv(v.power, "on"), "power");
  assert(eqv(v.rest.value, 0), "rest");
  assert(eqv(v.press.value, A0_AT(F_PRESS)), "press");
  assert(v.monitor.lines.every((l) => l === "0"), "untouched: zeros");
  assert(v.monitor.lines.length >= 18 && v.monitor.lines.length <= 21, `about 10 lines a second, got ${v.monitor.lines.length}`);
  const p = run(REFERENCE_BUILD, REFERENCE_SKETCH, { force: F_PRESS });
  assert(p.monitor.lines.every((l) => l === String(A0_AT(F_PRESS))), "pressed: the 2.1 number");
  assert(p.monitor.points.length === p.monitor.lines.length, "every line is a plot point");
  assert(v.symptom.line.en.includes(String(A0_AT(20))), "the top is the 20 N reading");
});

test("variant-rails-and-other-columns", () => {
  // Nano at column 1, upper header in d: 5V 12h, GND 14h, A0 4h, GND.upper 12d. Power through the rails.
  const b = make({
    nano: [1, "d"],
    fsr: ["20a", 0],
    res: ["21e", 0],
    wires: [
      ["12i", "TP1", "red"],
      ["14j", "BN25", "black"],
      ["TP5", "20c", "red"],
      ["4i", "21c", "yellow"],
      ["25b", "BN3", "black"],
    ],
  });
  assert(worksFor(b, STD()), "rails");
  assert(eqv(connections(b).map((l) => l.text.en), ["5V — FSR pin 1", "A0 — FSR pin 2 — resistor", "GND — resistor"]), "same circuit");
});

test("variant-fsr-turned-round", () => {
  const b = make({ ...REF, res: ["24e", 90], wires: [["14h", "25h", "red"], ["6i", "24i", "yellow"], ["14b", "24b", "black"]] });
  assert(worksFor(b, STD()), "fsr pins swapped");
});

test("variant-a3", () => {
  const b = withWires([RED, ["9i", "25i", "yellow"], BLACK]);
  assert(worksFor(b, STD("A3")), "A3");
  assert(worksFor(b, STD("17")), "analogRead(17) is A3");
});

test("variant-lower-gnd", () => {
  const b = make({ ...REF, res: ["21h", 0], wires: [RED, YELLOW, ["16i", "21j", "black"]] });
  assert(worksFor(b, STD()), "lower GND pin");
});

test("variant-other-holes", () => {
  assert(worksFor(withWires([["14i", "24i", "red"], ["6j", "25h", "yellow"], ["14a", "25c", "black"]]), STD()), "other holes");
});

test("variant-far-right", () => {
  // Nano at column 16, upper header in e: lower header in i, body over f..h; only row j is free below it.
  const b = make({
    nano: [16, "e"],
    fsr: ["3a", 0],
    res: ["4d", 90],
    wires: [
      ["27j", "3c", "red"],
      ["19j", "4c", "yellow"],
      ["29j", "4j", "black"],
    ],
  });
  assert(worksFor(b, STD()), "nano at column 16");
});

test("variant-sketches", () => {
  assert(worksFor(REFERENCE_BUILD, STD("A0", "115200"), 115200), "115200 both sides");
  assert(worksFor(REFERENCE_BUILD, sk([T.begin()], [T.read(), T.delay(), T.println()])), "read, pause, print");
  assert(worksFor(REFERENCE_BUILD, sk([T.begin()], [T.delay("50"), T.read("0"), T.println()])), "analogRead(0)");
  assert(worksFor(REFERENCE_BUILD, sk([T.begin(), T.read(), T.println()], [T.read(), T.println(), T.delay()])), "an extra reading in setup");
});

test("pull-up", () => {
  const b = withWires([["16h", "24h", "black"], YELLOW, ["14i", "25b", "red"]]);
  const v = worksFor(b, STD());
  assert(v, "pull-up");
  assert(hasSymptom(v, "pull-up"), "pull-up");
  assert(eqv(v.symptom.level, "note"), "a note");
  assert(eqv(v.rest.value, MAX_CODE), "rests at the top");
  assert(eqv(v.press.value, adcCode((5 * readAt(F_PRESS).ohms) / (10000 + readAt(F_PRESS).ohms))), "falls when pressed");
});

test("on-3v3", () => {
  const v = worksFor(withWires([["4h", "24h", "red"], YELLOW, BLACK]), STD());
  assert(v, "3V3");
  assert(hasSymptom(v, "on-3v3"), "3V3");
  assert(v.symptom.line.en.includes(String(adcCode(V3V3))), `names the ceiling ${adcCode(V3V3)}: ${v.symptom.line.en}`);
  assert(eqv(v.press.value, adcCode((V3V3 * 10000) / (10000 + readAt(F_PRESS).ohms))), "pressed");
});

test("notes-in-the-code", () => {
  const fast = run(REFERENCE_BUILD, sk([T.begin()], [T.read(), T.println()]));
  assert(fast.ok, "no pause still works");
  assert(hasSymptom(fast, "fast"), "fast");
  assert(fast.monitor.lines.length > 300, `rushes past: ${fast.monitor.lines.length} lines in 2 s`);
  const slow = run(REFERENCE_BUILD, STD("A0", "9600", "3000"));
  assert(slow.ok, "a slow pause still works");
  assert(hasSymptom(slow, "slow"), "slow");
  const tooSlow = run(REFERENCE_BUILD, STD("A0", "9600", "20000"));
  assert(!tooSlow.ok, "20 s is too slow");
  assert(hasSymptom(tooSlow, "too-slow"), "too slow");
  const inLoop = run(REFERENCE_BUILD, sk([], [T.begin(), T.read(), T.println(), T.delay()]));
  assert(inLoop.ok, "begin in loop still works");
  assert(hasSymptom(inLoop, "begin-in-loop"), "begin in loop");
});

// ------------------------------------------------------------------ what goes wrong

test("no-nano", () => {
  const v = run(EMPTY_BUILD, REFERENCE_SKETCH);
  assert(eqv(v.stage, "build"), "stage");
  assert(hasSymptom(v, "no-nano"), "no nano");
});

test("no-usb", () => {
  const v = run({ ...REFERENCE_BUILD, usb: false }, REFERENCE_SKETCH);
  assert(eqv([v.stage, v.power, v.ok, v.circuitOk], ["upload", "off", false, true]), "stage, power, ok, wiring");
  assert(hasSymptom(v, "no-usb"), "no usb");
  assert(eqv(v.monitor.kind, "empty"), "nothing comes");
});

test("short-circuits", () => {
  for (const [w, a, z] of [
    [["14i", "16i"], "5V", "GND"],
    [["4h", "16i"], "3V3", "GND"],
    [["4h", "14i"], "5V", "3V3"],
    [["14i", "TP1"], "", ""],
  ] as const) {
    const b = withWires([...REF.wires, [w[0], w[1]]]);
    const v = run(b, REFERENCE_SKETCH);
    if (!a) {
      assert(v.ok, "5V to a rail alone is no short");
      continue;
    }
    assert(eqv([v.power, v.stage, v.ok], ["short", "upload", false]), `${a}-${z}`);
    assert(hasSymptom(v, "short"), `${a}-${z}`);
    assert(v.symptom.line.en.startsWith(`${a} is joined straight to ${z}`), v.symptom.line.en);
    assert(eqv(v.symptom.badge, "inferred"), "badge");
  }
  // through a rail: 5V to TP, GND to TP
  const v = run(withWires([...REF.wires, ["14i", "TP1"], ["16i", "TP9"]]), REFERENCE_SKETCH);
  assert(hasSymptom(v, "short"), "through a rail");
});

test("reset-held", () => {
  const v = run(withWires([...REF.wires, ["15a", "TN1"], ["14a", "TN5"]]), REFERENCE_SKETCH);
  assert(hasSymptom(v, "reset-held"), "reset");
  assert(eqv(v.stage, "upload"), "stage");
});

test("fsr-bypassed", () => {
  // turned 90 degrees: both legs in strip 24 (lower); the learner wires 5V and A0 to that strip
  const b = make({ ...REF, fsr: ["24i", 90], res: ["24d", 90], wires: [RED, ["6i", "24g", "yellow"], ["14b", "24b", "black"]] });
  const v = run(b, REFERENCE_SKETCH);
  assert(hasSymptom(v, "fsr-bypassed"), "bypassed");
  assert(eqv([v.rest.value, v.press.value], [MAX_CODE, MAX_CODE]), "1023 all the time");
  assert(v.symptom.line.en.includes(String(MAX_CODE)), "says 1023");
  assert(v.monitor.lines.every((l) => l === String(MAX_CODE)), "monitor shows 1023");
  // the same, with A0 left on its own strip: it reads 0
  const v2 = run(make({ ...REF, fsr: ["24i", 90] }), REFERENCE_SKETCH);
  assert(hasSymptom(v2, "fsr-bypassed"), "bypassed, A0 elsewhere");
  // legs joined by a wire instead of a strip: with 5V on one of them, that joins A0 straight to 5V
  assert(hasSymptom(run(withWires([...REF.wires, ["24i", "25h"]]), REFERENCE_SKETCH), "stuck"), "joined by a wire, on 5V");
  const v3 = run(withWires([YELLOW, BLACK, ["24i", "25h"]]), REFERENCE_SKETCH);
  assert(hasSymptom(v3, "fsr-bypassed"), "joined by a wire");
  assert(v3.symptom.line.en === say("fsrJoined").en, "the wire text");
});

test("stuck", () => {
  const high = run(withWires([RED, ["6i", "14i", "yellow"], BLACK]), REFERENCE_SKETCH);
  assert(hasSymptom(high, "stuck"), "A0 on 5V");
  assert(eqv(high.symptom.line.en, "A0 is joined straight to 5V, so it reads 1023 all the time."), "text");
  const low = run(withWires([RED, ["6i", "16i", "yellow"], BLACK]), REFERENCE_SKETCH);
  assert(hasSymptom(low, "stuck"), "A0 on GND");
  assert(low.symptom.line.en.includes("GND") && low.symptom.hint.en.includes("10 kΩ"), low.symptom.line.en + low.symptom.hint.en);
});

test("no-resistor", () => {
  const v = run(ref({ res: null }), REFERENCE_SKETCH, { seed: 7 });
  assert(hasSymptom(v, "no-resistor"), "no resistor");
  assert(eqv(v.rest.value, null), "floats");
  assert(eqv(v.press.value, MAX_CODE), "pressed: 5 V");
  const values = v.monitor.lines.map(Number);
  assert(new Set(values).size > 5, `wanders: ${values.slice(0, 8).join(" ")}`);
  assert(eqv(v.symptom.badge, "illustrative"), "badge");
  const again = run(ref({ res: null }), REFERENCE_SKETCH, { seed: 7 });
  assert(eqv(again.monitor.text, v.monitor.text), "a seed repeats");
});

test("floating", () => {
  assert(hasSymptom(run(withWires([RED, YELLOW]), REFERENCE_SKETCH), "floating"), "no black wire");
  const b = make({ ...REF, res: ["25a", 90] });
  assert(hasSymptom(run(b, REFERENCE_SKETCH), "resistor-bypassed"), "resistor in one strip");
});

test("wrong-pin", () => {
  const v = run(withWires([RED, ["7i", "25i", "yellow"], BLACK]), REFERENCE_SKETCH);
  assert(hasSymptom(v, "wrong-pin"), "A1 vs A0");
  assert(eqv(v.symptom.line.en, "The sensor is on A1, but the sketch reads A0. Pressing changes A1, not A0."), "text");
  assert(!v.circuitOk, "not for A0");
  const d = run(withWires([RED, ["10b", "25i", "yellow"], BLACK]), REFERENCE_SKETCH);
  assert(hasSymptom(d, "wrong-pin-digital"), "D5 vs A0");
  assert(d.symptom.line.en.includes("D5"), d.symptom.line.en);
});

test("digital-read", () => {
  const s = sk([T.begin()], [T.dread(), T.println(), T.delay()]);
  const v = run(REFERENCE_BUILD, s);
  assert(hasSymptom(v, "digital-read"), "digitalRead");
  const p = run(REFERENCE_BUILD, s, { force: F_PRESS });
  assert(eqv([...new Set(v.monitor.lines)], ["0"]), "rest: 0");
  assert(eqv([...new Set(p.monitor.lines)], ["1"]), "pressed: 1");
  assert(v.circuitOk, "the wiring is right");
});

test("no-begin", () => {
  const v = run(REFERENCE_BUILD, sk([], [T.read(), T.println(), T.delay()]));
  assert(hasSymptom(v, "no-begin"), "no begin");
  assert(eqv(v.monitor.kind, "empty"), "empty");
  assert(eqv(v.monitor.reads.length > 0, true), "it still reads");
});

test("no-print-and-runs-once", () => {
  const v = run(REFERENCE_BUILD, sk([T.begin()], [T.read(), T.delay()]));
  assert(hasSymptom(v, "no-print"), "no print");
  assert(eqv(v.monitor.text, ""), "nothing sent");
  const once = run(REFERENCE_BUILD, sk([T.begin(), T.read(), T.println()], [T.delay()]));
  assert(hasSymptom(once, "runs-once"), "runs once");
  assert(eqv(once.monitor.lines, ["0"]), "one line");
  assert(eqv(once.monitor.kind, "numbers"), "a line of its own");
});

test("wrong-baud", () => {
  const v = run(REFERENCE_BUILD, REFERENCE_SKETCH, { monitorBaud: 115200 });
  assert(hasSymptom(v, "wrong-baud"), "wrong baud");
  assert(eqv(v.monitor.kind, "gibberish"), "kind");
  assert(v.monitor.text.includes("⸮") && !/\d{2}/.test(v.monitor.text), `gibberish: ${v.monitor.text.slice(0, 40)}`);
  assert(eqv(v.monitor.points.length, 0), "the plotter gets nothing");
  assert(v.symptom.line.en.includes("9600") && v.symptom.line.en.includes("115200"), "names both");
  const decoy = run(REFERENCE_BUILD, sk([T.begin("115200")], [T.read(), T.println(), T.delay()]));
  assert(hasSymptom(decoy, "wrong-baud"), "the 115200 tile with the monitor at 9600");
  assert(run(REFERENCE_BUILD, REFERENCE_SKETCH, { monitorBaud: 9600 }).ok, "9600 matches");
});

test("no-newline", () => {
  const v = run(REFERENCE_BUILD, sk([T.begin()], [T.read(), T.print(), T.delay()]), { force: F_PRESS });
  assert(hasSymptom(v, "no-newline"), "print");
  assert(eqv(v.monitor.kind, "run-together"), "kind");
  assert(!v.monitor.text.includes("\n") && v.monitor.text.startsWith(String(A0_AT(F_PRESS)).repeat(3)), v.monitor.text.slice(0, 30));
  assert(eqv(v.monitor.points.length, 0), "the plotter can't split them");
  assert(v.circuitOk && !v.ok, "the circuit works, the sketch doesn't show it");
});

test("doubled", () => {
  const v = run(REFERENCE_BUILD, sk([T.begin()], [T.read(), T.print(), T.println(), T.delay()]), { force: F_PRESS });
  assert(hasSymptom(v, "doubled"), "print and println");
  assert(!v.ok, "not working");
  assert(eqv(v.monitor.kind, "run-together"), "kind");
  const a = String(A0_AT(F_PRESS));
  assert(eqv(v.monitor.lines[0], a + a), "the reading twice a line");
  assert(eqv(v.monitor.points.length, 0), "the plotter can't read them");
  assert(v.circuitOk, "the circuit works");
  assert(hasSymptom(run(REFERENCE_BUILD, sk([T.begin()], [T.read(), T.println(), T.print(), T.delay()])), "doubled"), "println, then print");
});

test("pin-output", () => {
  const s = sk([T.begin(), T.pinMode()], [T.read(), T.println(), T.delay()]);
  const v = run(REFERENCE_BUILD, s);
  assert(hasSymptom(v, "pin-output"), "pinMode");
  assert(eqv(v.symptom.badge, "inferred"), "badge");
  assert((v.press.value ?? 999) < 100, `hardly moves: ${v.press.value}`);
  const fight = run(withWires([RED, ["6i", "14i", "yellow"], BLACK]), s);
  assert(hasSymptom(fight, "pin-output-short"), "pinMode against 5V");
  // pinMode on another pin joined to A0's strip drags A0 down too
  const other = run(withWires([...REF.wires, ["6h", "7h"]]), sk([T.begin(), T.pinMode("A1")], [T.read(), T.println(), T.delay()]));
  assert(hasSymptom(other, "pin-output"), "pinMode(A1) with A1 joined to A0");
  assert(other.symptom.line.en.startsWith("pinMode(A1, OUTPUT)"), other.symptom.line.en);
  assert(run(REFERENCE_BUILD, sk([T.begin(), T.pinMode("A1")], [T.read(), T.println(), T.delay()])).ok, "pinMode on a pin wired to nothing is harmless");
  // pinMode on A7 does nothing (no output driver)
  const a7 = run(REFERENCE_BUILD, sk([T.begin(), T.pinMode("A7")], [T.read(), T.println(), T.delay()]));
  assert(a7.ok, "pinMode(A7) is harmless");
});

test("sensor-wiring-faults", () => {
  assert(hasSymptom(run(ref({ fsr: null }), REFERENCE_SKETCH), "no-fsr"), "no fsr");
  assert(hasSymptom(run(ref({ fsr: ["20a", 0] }), REFERENCE_SKETCH), "fsr-unconnected"), "fsr on its own");
  const one = run(withWires([YELLOW, BLACK]), REFERENCE_SKETCH);
  assert(hasSymptom(one, "fsr-one-leg"), "no red wire");
  assert(eqv(one.symptom.hint.en, say("fsrOneLegHint5v").en), "wire it to 5V");
  const across = run(withWires([RED, ["16h", "25h", "black"]]), REFERENCE_SKETCH);
  assert(hasSymptom(across, "fsr-across"), "5V to GND through the fsr");
  assert(hasSymptom(run(withWires([RED, BLACK]), REFERENCE_SKETCH), "pin-unwired"), "no yellow wire");
  const gnd = run(withWires([["16h", "24h", "black"], YELLOW, BLACK]), REFERENCE_SKETCH);
  assert(hasSymptom(gnd, "both-gnd"), "both to GND");
  const v5 = run(withWires([RED, YELLOW, ["14i", "25b", "red"]]), REFERENCE_SKETCH);
  assert(hasSymptom(v5, "both-5v"), "both to 5V");
  assert(hasSymptom(run(withWires([["8b", "24h", "red"], YELLOW, BLACK]), REFERENCE_SKETCH), "fsr-no-supply"), "fsr to D7");
  // the sensor between A0 and A1, nothing else: A0 has the sensor on it, so its trouble is the missing 5V
  const a0a1 = run(ref({ res: null, wires: [["6i", "24i"], ["7i", "25i"]] }), REFERENCE_SKETCH);
  assert(hasSymptom(a0a1, "fsr-no-supply"), "fsr from A0 to A1");
});

test("check-wiring", () => {
  const w = checkWiring({ ...REFERENCE_BUILD, usb: false });
  assert(w.ok && w.problems.length === 0 && w.power === "on", "the reference wiring, before USB");
  const s = checkWiring(withWires([...REF.wires, ["14i", "16i"]]));
  assert(eqv([s.ok, s.power, s.problems[0].id], [false, "short", "short"]), "short");
  assert(eqv(checkWiring(EMPTY_BUILD).problems[0].id, "no-nano"), "empty");
});

// ------------------------------------------------------------------ the runner, live

test("runner-live", () => {
  const c = circuit(REFERENCE_BUILD);
  const prog = compile(REFERENCE_SKETCH);
  assert(prog.ok, "compiles");
  if (!prog.ok) return;
  const r = runner(c, prog.program);
  let text = "";
  const pts: { t: number; value: number }[] = [];
  for (let i = 0; i < 120; i++) {
    const ch = r.step(1000 / 60, i < 60 ? 0 : F_PRESS); // a second untouched, a second pressed, at 60 frames a second
    text += ch.text;
    pts.push(...ch.points);
  }
  assert(Math.abs(r.t - 2000) < 1e-6, `two seconds: ${r.t}`);
  assert(pts.length >= 19 && pts.length <= 21, `about 10 a second: ${pts.length}`);
  assert(pts.slice(0, 9).every((p) => p.value === 0) && pts.slice(-9).every((p) => p.value === A0_AT(F_PRESS)), show(pts.map((p) => p.value)));
  assert(eqv(text.split("\r\n").length - 1, pts.length), "one line a point");
  const off = runner(circuit({ ...REFERENCE_BUILD, usb: false }), prog.program);
  assert(eqv(off.step(500, 10).text, ""), "no power, no text");
});

// ------------------------------------------------------------------ the words

test("words-complete", () => {
  const slots = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join();
  for (const k of Object.keys(WORDS.en) as (keyof typeof WORDS.en)[]) {
    assert(WORDS.zh[k] && WORDS.zh[k].trim(), `no Chinese for ${k}`);
    assert(eqv(slots(WORDS.zh[k]), slots(WORDS.en[k])), `slots of ${k}`);
    assert(WORDS.en[k].split(/\s+/).length <= 30, `${k} is long: ${WORDS.en[k].split(/\s+/).length} words`);
    assert(!/\*\*|<b>/.test(WORDS.en[k] + WORDS.zh[k]), `${k}: no bold`);
  }
});

// ------------------------------------------------------------------ report

const bad = results.filter((r) => !r.ok);
for (const r of results) console.log(`${r.ok ? "ok  " : "FAIL"} ${r.name}${r.ok ? "" : `\n     ${r.why}`}`);
console.log(`\n${results.length - bad.length}/${results.length} passed`);
if (bad.length) throw new Error(`${bad.length} failed`);
