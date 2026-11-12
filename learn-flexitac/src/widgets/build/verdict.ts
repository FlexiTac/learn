// The verdict of Lesson 2.2's build (src/widgets/build/): run(build, sketch) says how far it got (built, compiled,
// uploaded, running), what the Arduino sees on the pin the sketch reads, what the Serial Monitor shows, whether it
// works, and if not, why and what to do, in English and Chinese.
// "Works" is electrical, never a match against one answer: pressing the FSR firmly (F_PRESS) must move the reading on the
// pin the sketch reads by at least RESPONSIVE steps, from a steady value at rest, and the monitor must show it as numbers,
// one a line. Any wiring that does that counts, wherever the parts sit. A few that work but differ from Lesson 2.1 get a
// note (pull-up wiring, 3V3 instead of 5V, no pause, Serial.begin in loop()).
// The problems are listed in the order a learner meets them: build, compile, upload, power, then what the monitor shows
// (empty, gibberish, run together or doubled, 0 or 1), then the wiring.
import { adcCode, MAX_CODE } from "@shared/models/adc.mjs";
import type { Badge } from "../../types";
import { F_MAX } from "../bench/fsr";
import { fsrPins, stripOf, type Build } from "./board";
import { ANALOG_ONLY, circuit, R1, V3V3, type Circuit, type Power } from "./circuit";
import type { Net } from "./netlist";
import { baudsMatch, compile, runner, V_HIGH, type CompileError, type Op, type Point, type Program, type Sketch } from "./sketch";
import { say, type Text, type Vars, type WordKey } from "./words";

/** A firm press (N): a point of Adafruit's FSR table (10 N, 1 kΩ), inside Interlink's 0.2–20 N range. */
export const F_PRESS = 10;
/** Pressing must move the reading by at least this many steps (of 1023) to count as working (about 0.5 V). */
export const RESPONSIVE = 100;
/** A pause longer than this (ms) between readings gets a note; one this long is too slow to call working. */
export const SLOW_MS = 2000;
export const TOO_SLOW_MS = 10000;
/** A working circuit that rests above this many steps gets a note. */
const REST_HIGH = 50;

export type SymptomId =
  | "works"
  | "no-nano"
  | "compile"
  | "no-usb"
  | "short"
  | "reset-held"
  | "no-begin"
  | "no-print"
  | "runs-once"
  | "wrong-baud"
  | "no-newline"
  | "doubled"
  | "digital-read"
  | "pin-output"
  | "pin-output-short"
  | "wrong-pin"
  | "wrong-pin-digital"
  | "no-fsr"
  | "fsr-bypassed"
  | "fsr-unconnected"
  | "fsr-one-leg"
  | "fsr-across"
  | "fsr-no-supply"
  | "stuck"
  | "no-resistor"
  | "floating"
  | "resistor-bypassed"
  | "pin-unwired"
  | "both-gnd"
  | "both-5v"
  | "no-change"
  | "too-slow"
  | "pull-up"
  | "on-3v3"
  | "rest-high"
  | "fast"
  | "slow"
  | "begin-in-loop";

export interface Symptom {
  id: SymptomId;
  /** "fail": it doesn't work; "note": it works, with a remark; "ok": it works as Lesson 2.1's does */
  level: "ok" | "note" | "fail";
  /** how sure the explanation is (null: it follows from the models and the sources) */
  badge: Badge | null;
  /** what the learner sees and why, one line */
  line: Text;
  /** what to do */
  hint: Text;
}

/** What the read pin gives: its voltage (null when floating or unpowered) and the value the sketch reads (null when
 *  floating: it wanders). */
export interface Reading {
  volts: number | null;
  value: number | null;
}

export type MonitorKind = "empty" | "numbers" | "run-together" | "gibberish";
export interface Monitor {
  kind: MonitorKind;
  /** everything that arrived, as text */
  text: string;
  /** the text split into lines (the last one may be unfinished) */
  lines: string[];
  /** the values printed, for the Serial Plotter (none unless they come one a line, readable) */
  points: Point[];
  /** every value the sketch read */
  reads: Point[];
}

export interface Verdict {
  /** it works: pressing changes the number on the monitor as it should (notes allowed) */
  ok: boolean;
  /** how far it got: "build" (no Nano), "compile", "upload" (no USB, a short, held in reset), "run" */
  stage: "build" | "compile" | "upload" | "run";
  power: Power;
  compileError: CompileError | null;
  /** the pin the sketch reads ("A0" when it reads none) and how */
  pin: string;
  read: "analogRead" | "digitalRead" | null;
  /** the read pin's voltage at the options' force (null: floating, or the board isn't running) */
  volts: number | null;
  rest: Reading;
  press: Reading;
  /** the wiring works for the pin the sketch reads (whatever the code does) */
  circuitOk: boolean;
  monitor: Monitor;
  /** the first of the problems, or what works */
  symptom: Symptom;
  /** every problem found, in the order to fix them; then the notes */
  problems: Symptom[];
}

export interface VerdictOptions {
  /** the Serial Monitor's baud rate, 9600 by default */
  monitorBaud?: number;
  /** how hard the FSR is pressed while the monitor runs (N, 0 = untouched; ../bench/fsr.ts forceAt() maps 0..1) */
  force?: number;
  /** how long the monitor runs (ms), 2000 by default */
  ms?: number;
  /** seeds the wandering numbers and the gibberish */
  seed?: number;
}

const BADGE: Partial<Record<SymptomId, Badge>> = {
  works: "illustrative",
  short: "inferred",
  "reset-held": "inferred",
  "pin-output": "inferred",
  "pin-output-short": "inferred",
  "digital-read": "illustrative",
  "wrong-baud": "illustrative",
  "no-resistor": "illustrative",
  floating: "illustrative",
  "resistor-bypassed": "illustrative",
  "pin-unwired": "illustrative",
};
const NOTES = new Set<SymptomId>(["pull-up", "on-3v3", "rest-high", "fast", "slow", "begin-in-loop"]);

function symptom(id: SymptomId, line: Text, hint: Text): Symptom {
  return { id, level: id === "works" ? "ok" : NOTES.has(id) ? "note" : "fail", badge: BADGE[id] ?? null, line, hint };
}
const sym = (id: SymptomId, key: WordKey, hintKey: WordKey, vars?: Vars, hintVars: Vars | undefined = vars) => symptom(id, say(key, vars), say(hintKey, hintVars));

const ohms = (r: number) => (r >= 1000 ? `${r / 1000} kΩ` : `${r} Ω`);
const SUPPLY_PINS = new Set(["5V", "3V3", "GND", "VIN"]);
const NOT_SIGNAL = new Set([...SUPPLY_PINS, "RST", "AREF"]);

// ------------------------------------------------------------------ the wiring

export interface Wiring {
  /** the pin responds to a press as a sensor should */
  ok: boolean;
  /** the wiring's problem (one), or its notes */
  problems: Symptom[];
}

/** Does the wiring work for `pin` (read with `fn`)? Without any pinMode: that is the code's business. */
export function wiring(c: Circuit, pin: string, fn: "analogRead" | "digitalRead" = "analogRead"): Wiring {
  const code = (v: number | null) => (v === null ? null : adcCode(v));
  const cr = code(c.volts(pin, 0));
  const cp = code(c.volts(pin, F_PRESS));
  const f1 = c.net("fsr:1");
  const f2 = c.net("fsr:2");
  const r1 = c.net("resistor:1");
  const r2 = c.net("resistor:2");
  const pNet = c.net(pin);
  const supply = (n: Net | null) => c.supplyOf(n);
  const fail = (s: Symptom): Wiring => ({ ok: false, problems: [s] });
  const r = ohms(R1);

  if (cr !== null && cp !== null && Math.abs(cp - cr) >= RESPONSIVE) {
    if (cp < cr) return { ok: true, problems: [sym("pull-up", "pullUp", "pullUpHint")] };
    if (supply(f1) === "3V3" || supply(f2) === "3V3") return { ok: true, problems: [sym("on-3v3", "on3v3", "on3v3Hint", { top: adcCode(V3V3), max: MAX_CODE })] };
    if (cr > REST_HIGH) return { ok: true, problems: [sym("rest-high", "restHigh", "restHighHint", { code: cr })] };
    return { ok: true, problems: [] };
  }
  if (cr === null && cp !== null) {
    if (!r1 || !r2) return fail(sym("no-resistor", "noResistor", "noResistorHint", { pin, r }));
    if (r1 === r2) return fail(sym("resistor-bypassed", "resistorBypassed", "resistorBypassedHint", { pin }));
    return fail(sym("floating", "floating", "floatingHint", { pin }));
  }
  if (!f1 || !f2) return fail(sym("no-fsr", "noFsr", "noFsrHint"));
  const src = supply(pNet);
  if (f1 === f2) {
    const legs = c.build.fsr ? fsrPins(c.build.fsr) : null;
    if (legs && stripOf(legs["1"]) === stripOf(legs["2"]))
      return fail(cr === null ? sym("fsr-bypassed", "fsrBypassed", "fsrBypassedHint") : sym("fsr-bypassed", "fsrBypassedCode", "fsrBypassedHint", { pin, code: cr }));
    if (!src) return fail(sym("fsr-bypassed", "fsrJoined", "fsrJoinedHint"));
  }
  const lonely = (n: Net) => n.items.length === 1;
  if (lonely(f1) && lonely(f2)) return fail(sym("fsr-unconnected", "fsrUnconnected", "fsrUnconnectedHint", { pin }));
  const sensorSide = [f1, f2].filter((n) => !lonely(n) && !supply(n));
  const on = sensorSide.flatMap((n) => n.nano).filter((x) => !NOT_SIGNAL.has(x));
  if (on.length && !on.includes(pin)) {
    const analog = on.find((x) => /^A\d$/.test(x));
    if (analog) return fail(sym("wrong-pin", "wrongPin", "wrongPinHint", { on: analog, pin, fn }));
    return fail(sym("wrong-pin-digital", "wrongPinDigital", "wrongPinDigitalHint", { on: on[0], pin }));
  }
  if (src) return fail(sym("stuck", "stuck", src === "GND" ? "stuckHintLow" : "stuckHintHigh", { pin, src, code: cr ?? 0, r }));
  if (lonely(f1) || lonely(f2)) {
    const other = lonely(f1) ? f2 : f1;
    return fail(supply(other) ? sym("fsr-one-leg", "fsrOneLeg", "fsrOneLegHintPin", { pin }) : sym("fsr-one-leg", "fsrOneLeg", "fsrOneLegHint5v"));
  }
  const s1 = supply(f1);
  const s2 = supply(f2);
  if (s1 && s2) {
    const [a, b] = s1 === "GND" ? [s2, s1] : [s1, s2];
    return fail(sym("fsr-across", "fsrAcross", "fsrAcrossHint", { a, b, pin }));
  }
  // (a pin with something on its strip isn't "unwired": the sensor's own trouble comes first)
  if (cr === null && (!pNet || pNet.items.length <= 1)) return fail(sym("pin-unwired", "pinUnwired", "pinUnwiredHint", { pin }));
  if (!s1 && !s2) return fail(sym("fsr-no-supply", "fsrNoSupply", "fsrNoSupplyHint"));
  if (cr === null) return fail(!r1 || !r2 ? sym("no-resistor", "noResistor", "noResistorHint", { pin, r }) : sym("floating", "floating", "floatingHint", { pin }));
  if (pNet && r1 && r2 && (pNet === f1 || pNet === f2) && (pNet === r1 || pNet === r2)) {
    const sf = supply(pNet === f1 ? f2 : f1);
    const sr = supply(pNet === r1 ? r2 : r1);
    if (sf === "GND" && sr === "GND") return fail(sym("both-gnd", "bothGnd", "bothGndHint", { pin, code: cr }));
    if (sf && sf !== "GND" && sr && sr !== "GND") return fail(sym("both-5v", "both5v", "both5vHint", { pin, code: cr, src: sr }));
  }
  return fail(sym("no-change", "noChange", "noChangeHint", { pin, code: cr }));
}

// ------------------------------------------------------------------ the whole run

/** The read the sketch's loop() makes (else setup()'s), or null. */
function readOp(p: Program): Extract<Op, { kind: "analogRead" | "digitalRead" }> | null {
  for (const ops of [p.loop, p.setup]) {
    const r = ops.find((o): o is Extract<Op, { kind: "analogRead" | "digitalRead" }> => o.kind === "analogRead" || o.kind === "digitalRead");
    if (r) return r;
  }
  return null;
}

const emptyMonitor = (): Monitor => ({ kind: "empty", text: "", lines: [], points: [], reads: [] });
const NONE: Reading = { volts: null, value: null };

export function run(b: Build, sketch: Sketch, opts: VerdictOptions = {}): Verdict {
  const monitorBaud = opts.monitorBaud ?? 9600;
  const force = opts.force ?? 0;
  const c = circuit(b);
  // the wiring is judged as if USB were in, so the interface can say "the wiring is right" before the upload
  const cw = b.usb ? c : circuit({ ...b, usb: b.nano !== null });
  const compiled = compile(sketch);
  const base = {
    ok: false,
    power: c.power.state,
    compileError: compiled.ok ? null : compiled.error,
    pin: "A0",
    read: null,
    volts: null,
    rest: NONE,
    press: NONE,
    circuitOk: false,
    monitor: emptyMonitor(),
  } satisfies Partial<Verdict>;
  const stop = (stage: Verdict["stage"], s: Symptom, extra: Partial<Verdict> = {}): Verdict => ({ ...base, ...extra, stage, symptom: s, problems: [s] });

  if (!b.nano) return stop("build", sym("no-nano", "noNano", "noNanoHint"));
  const op = compiled.ok ? readOp(compiled.program) : null;
  const pin = op?.pin?.name ?? "A0";
  const read = op?.kind ?? null;
  const wired = wiring(cw, pin, read ?? "analogRead");
  const pre = { pin, read, circuitOk: cw.power.state === "on" && !cw.power.reset && wired.ok };
  if (!compiled.ok) {
    const e = compiled.error;
    return stop("compile", symptom("compile", e.line, e.hint), pre);
  }
  if (!b.usb) return stop("upload", sym("no-usb", "noUsb", "noUsbHint"), pre);
  if (c.power.state === "short" && c.power.short) return stop("upload", sym("short", "short", "shortHint", c.power.short), pre);
  if (c.power.reset) return stop("upload", sym("reset-held", "resetHeld", "resetHeldHint"), pre);

  // ---- it runs
  const prog = compiled.program;
  const all = [...prog.setup, ...prog.loop];
  const outputs = new Set(all.flatMap((o) => (o.kind === "pinMode" && o.pin ? [o.pin.name] : [])));
  const sample = (f: number): Reading => {
    const v = c.volts(pin, f, outputs);
    if (v === null) return { volts: null, value: null };
    if (read === "digitalRead") return { volts: v, value: ANALOG_ONLY.has(pin) || v < V_HIGH ? 0 : 1 };
    return { volts: v, value: adcCode(v) };
  };
  const rest = sample(0);
  const press = sample(F_PRESS);

  const r = runner(c, prog, { monitorBaud, seed: opts.seed });
  const chunk = r.step(opts.ms ?? 2000, force);
  const loopPrints = prog.loop.filter((o) => o.kind === "println" || o.kind === "print");
  const begins = [...prog.setup, ...prog.loop].filter((o): o is Extract<Op, { kind: "begin" }> => o.kind === "begin");
  const loopBegin = prog.loop.filter((o): o is Extract<Op, { kind: "begin" }> => o.kind === "begin").pop();
  const baud = (loopBegin ?? begins[begins.length - 1])?.baud ?? null;
  const matched = baud !== null && baudsMatch(baud, monitorBaud);
  // (print and println in one loop: each line holds the reading twice, run together)
  const doubled = loopPrints.some((o) => o.kind === "print") && loopPrints.some((o) => o.kind === "println");
  const newline = (loopPrints.length ? loopPrints : all).some((o) => o.kind === "println") && !doubled;
  const kind: MonitorKind = !chunk.text ? "empty" : !matched ? "gibberish" : newline ? "numbers" : "run-together";
  const lines = chunk.text ? chunk.text.split("\r\n") : [];
  if (lines.length && lines[lines.length - 1] === "") lines.pop();
  const monitor: Monitor = { kind, text: chunk.text, lines, points: chunk.points, reads: chunk.reads };

  const fails: Symptom[] = [];
  const notes: Symptom[] = [];
  const anyPrint = all.some((o) => o.kind === "println" || o.kind === "print");
  if (!begins.length) fails.push(sym("no-begin", "noBegin", "noBeginHint"));
  if (!anyPrint) fails.push(sym("no-print", "noPrint", "noPrintHint"));
  else if (!loopPrints.length) fails.push(sym("runs-once", "runsOnce", "runsOnceHint"));
  if (baud !== null && !matched && anyPrint) fails.push(sym("wrong-baud", "wrongBaud", "wrongBaudHint", { sketch: baud, monitor: monitorBaud }));
  if (loopPrints.length && !loopPrints.some((o) => o.kind === "println")) fails.push(sym("no-newline", "noNewline", "noNewlineHint"));
  if (doubled) fails.push(sym("doubled", "doubled", "doubledHint"));
  if (read === "digitalRead") fails.push(sym("digital-read", "digitalRead", "digitalReadHint", { pin, max: MAX_CODE }));
  for (const o of outputs) {
    if (ANALOG_ONLY.has(o)) continue; // (no output driver: pinMode does nothing)
    const src = c.supplyOf(c.net(o));
    if (src === "5V" || src === "3V3") fails.push(sym("pin-output-short", "pinOutputShort", "pinOutputShortHint", { pin: o, src }));
    else if (o === pin || (c.net(o) !== null && c.net(o) === c.net(pin))) fails.push(sym("pin-output", "pinOutput", "pinOutputHint", { pin: o }));
  }
  for (const s of wired.problems) (s.level === "fail" ? fails : notes).push(s);
  const pause = prog.loop.reduce((t, o) => t + (o.kind === "delay" ? o.ms : 0), 0);
  if (pause >= TOO_SLOW_MS) fails.push(sym("too-slow", "slow", "slowHint", { s: +(pause / 1000).toFixed(1) }));
  else if (pause >= SLOW_MS) notes.push(sym("slow", "slow", "slowHint", { s: +(pause / 1000).toFixed(1) }));
  else if (pause === 0 && loopPrints.length) notes.push(sym("fast", "fast", "fastHint"));
  if (prog.loop.some((o) => o.kind === "begin")) notes.push(sym("begin-in-loop", "beginInLoop", "beginInLoopHint"));

  // (and, as a last guard, the reading the sketch really gets must move when pressed)
  const responds = rest.value !== null && press.value !== null && Math.abs(press.value - rest.value) >= RESPONSIVE;
  const ok = fails.length === 0 && wired.ok && responds;
  const works = sym("works", "works", "worksHint", { top: adcCode(c.volts(pin, F_MAX) ?? 0) });
  const problems = [...fails, ...notes];
  return {
    ...base,
    ...pre,
    ok,
    stage: "run",
    volts: c.volts(pin, force, outputs),
    rest,
    press,
    monitor,
    symptom: problems[0] ?? works,
    problems,
  };
}

/** Quick: does the wiring alone work for a pin (A0 by default), with USB in? For the interface's "check your wiring"
 *  before any code exists. */
export function checkWiring(b: Build, pin = "A0"): Wiring & { power: Power } {
  const c = circuit({ ...b, usb: b.nano !== null });
  if (!b.nano) return { ok: false, problems: [sym("no-nano", "noNano", "noNanoHint")], power: "off" };
  if (c.power.state === "short" && c.power.short) return { ok: false, problems: [sym("short", "short", "shortHint", c.power.short)], power: "short" };
  if (c.power.reset) return { ok: false, problems: [sym("reset-held", "resetHeld", "resetHeldHint")], power: "on" };
  return { ...wiring(c, pin), power: c.power.state };
}
