// The sketch of Lesson 2.2 (src/widgets/build/): a fixed set of code tiles the learner arranges into setup() and loop(),
// a compiler that catches what a real one would (a value printed before it is read, a pin the Nano doesn't have, an
// empty box), and a runner that plays the sketch on the build over time and says what the Serial Monitor shows.
//   - analogRead: the ADC model (@shared/models/adc.mjs: 10 bits, 0..1023 for 0..5 V, AVcc reference). About 100 µs
//     a read (Arduino's analogRead page). A floating pin reads a wandering value (ILLUSTRATIVE: a random walk).
//   - digitalRead: 1 above 0.6 VCC, 0 below 0.3 VCC, unchanged between (ILLUSTRATIVE thresholds, after the ATmega328P's
//     VIH / VIL); a floating pin flips at random. A6 and A7 have no digital input: 0.
//   - Serial: Serial.begin(baud) opens the link; a print before it sends nothing. Each byte takes 10 bits (8N1, Arduino's
//     default) on the wire, so a busy loop is held back by the baud rate. The monitor shows the text when its baud
//     matches the sketch's (within 2 %), gibberish when it doesn't (ILLUSTRATIVE: mostly ⸮, the Arduino IDE's sign for a
//     byte it can't show), nothing without Serial.begin.
import { adcCode, MAX_CODE } from "@shared/models/adc.mjs";
import { ANALOG_ONLY, VCC, type Circuit } from "./circuit";
import { say, type Text } from "./words";

export type TileKind = "begin" | "pinMode" | "analogRead" | "digitalRead" | "println" | "print" | "delay";
/** A field the learner types: the pin, the baud rate, the delay. Kept as typed (a string), parsed by compile(). */
export type FieldName = "pin" | "baud" | "ms";

export interface Tile {
  /** unique within a sketch (the tray's ids below) */
  id: string;
  kind: TileKind;
  pin?: string;
  baud?: string;
  ms?: string;
}
export interface Sketch {
  setup: readonly Tile[];
  loop: readonly Tile[];
}
export type Fn = "setup" | "loop";

/** The tiles the lesson offers (each once): the five a working sketch needs, and four decoys (a second Serial.begin at
 *  another speed, pinMode OUTPUT, digitalRead, Serial.print). The fields hold their first values; the learner edits
 *  them. */
export const TRAY: readonly Tile[] = [
  { id: "begin", kind: "begin", baud: "9600" },
  { id: "begin-fast", kind: "begin", baud: "115200" },
  { id: "pin-mode", kind: "pinMode", pin: "A0" },
  { id: "read", kind: "analogRead", pin: "A0" },
  { id: "digital-read", kind: "digitalRead", pin: "A0" },
  { id: "println", kind: "println" },
  { id: "print", kind: "print" },
  { id: "delay", kind: "delay", ms: "100" },
];
export const tileById = (id: string): Tile | undefined => TRAY.find((t) => t.id === id);
/** The fields a kind of tile has. */
export const FIELDS: Readonly<Record<TileKind, readonly FieldName[]>> = {
  begin: ["baud"],
  pinMode: ["pin"],
  analogRead: ["pin"],
  digitalRead: ["pin"],
  println: [],
  print: [],
  delay: ["ms"],
};

/** Lesson 2.1's sketch as tiles: Serial.begin(9600) in setup(); analogRead(A0), Serial.println(value), delay(100) in
 *  loop(). */
export const REFERENCE_SKETCH: Sketch = {
  setup: [{ id: "begin", kind: "begin", baud: "9600" }],
  loop: [
    { id: "read", kind: "analogRead", pin: "A0" },
    { id: "println", kind: "println" },
    { id: "delay", kind: "delay", ms: "100" },
  ],
};
export const EMPTY_SKETCH: Sketch = { setup: [], loop: [] };

/** Each kind of tile's line of code, {field} where the learner types. */
const LINES: Readonly<Record<TileKind, string>> = {
  begin: "Serial.begin({baud});",
  pinMode: "pinMode({pin}, OUTPUT);",
  analogRead: "int value = analogRead({pin});",
  digitalRead: "int value = digitalRead({pin});",
  println: "Serial.println(value);",
  print: "Serial.print(value);",
  delay: "delay({ms});",
};
/** A tile's line of code in pieces, so the interface can put a box where each field goes:
 *  [{ code: "Serial.begin(" }, { field: "baud", value: "9600" }, { code: ");" }]. */
export type Piece = { code: string } | { field: FieldName; value: string };
export function pieces(t: Tile): Piece[] {
  return LINES[t.kind]
    .split(/(\{\w+\})/)
    .filter(Boolean)
    .map((s): Piece => {
      const f = /^\{(\w+)\}$/.exec(s)?.[1] as FieldName | undefined;
      return f ? { field: f, value: t[f] ?? "" } : { code: s };
    });
}
/** A tile's line of code: "int value = analogRead(A0);". */
export const lineOf = (t: Tile): string => pieces(t).map((p) => ("code" in p ? p.code : p.value)).join("");

/** The whole sketch as the Arduino IDE would show it (lines under 46 characters). */
export function sourceOf(s: Sketch): string {
  const body = (ts: readonly Tile[]) => ts.map((t) => `  ${lineOf(t)}\n`).join("");
  return `void setup() {\n${body(s.setup)}}\n\nvoid loop() {\n${body(s.loop)}}\n`;
}

// ------------------------------------------------------------------ compiling

/** A pin as the code names it: "A0".."A7" (analog channel 0..7; digital pin 14..21) or a digital pin "D0".."D13". */
export interface PinRef {
  /** the name on the Nano's board: "A0", "D2", "RX0" (digital 0), "TX1" (digital 1) */
  name: string;
  /** 0..7 for A0..A7, else null */
  channel: number | null;
}
export type Op =
  | { kind: "begin"; baud: number; tile: string }
  | { kind: "pinMode"; pin: PinRef | null; tile: string }
  | { kind: "analogRead"; pin: PinRef; tile: string }
  | { kind: "digitalRead"; pin: PinRef | null; tile: string }
  | { kind: "println" | "print"; tile: string }
  | { kind: "delay"; ms: number; tile: string };
export interface Program {
  setup: Op[];
  loop: Op[];
}
export interface CompileError {
  /** the tile the error points at, and where it is */
  tile: string;
  fn: Fn;
  /** what the IDE prints (English in both languages, as the IDE does) */
  ide: Text;
  /** what it means, and what to do */
  line: Text;
  hint: Text;
}
export type Compiled = { ok: true; program: Program } | { ok: false; error: CompileError };

const fnName = (fn: Fn) => `${fn}()`;
const DIGITAL_NAMES = ["RX0", "TX1", "D2", "D3", "D4", "D5", "D6", "D7", "D8", "D9", "D10", "D11", "D12", "D13"];

type Parsed<T> = { ok: true; v: T } | { ok: false; why: "empty" | "undeclared" | "number"; text: string };
/** A pin field as C++ reads it: A0..A7 (case matters), or a number (analogRead: 0..7 and 14..21 are A0..A7, and the
 *  ATmega328P core takes any other number modulo 8; digitalRead and pinMode: 0..13 are D0..D13, 14..21 are A0..A7, and
 *  a larger number is no pin at all). */
function parsePin(text: string | undefined, analog: boolean): Parsed<PinRef | null> {
  const s = (text ?? "").trim();
  if (!s) return { ok: false, why: "empty", text: s };
  const a = /^A([0-7])$/.exec(s);
  if (a) return { ok: true, v: { name: s, channel: Number(a[1]) } };
  if (/^\d+$/.test(s)) {
    const n = Number(s);
    if (analog) {
      const ch = (n >= 14 ? n - 14 : n) & 7;
      return { ok: true, v: { name: `A${ch}`, channel: ch } };
    }
    if (n <= 13) return { ok: true, v: { name: DIGITAL_NAMES[n], channel: null } };
    if (n <= 21) return { ok: true, v: { name: `A${n - 14}`, channel: n - 14 } };
    return { ok: true, v: null };
  }
  return /^[A-Za-z_]\w*$/.test(s) ? { ok: false, why: "undeclared", text: s } : { ok: false, why: "number", text: s };
}
/** A number field: a whole number, or a decimal that C++ cuts to a whole one (delay(1.5) waits 1 ms); C++ turns a
 *  negative one into a huge unsigned one (delay(-1) waits 49 days). */
function parseCount(text: string | undefined): Parsed<number> {
  const s = (text ?? "").trim();
  if (!s) return { ok: false, why: "empty", text: s };
  if (/^-?\d+(\.\d*)?$/.test(s)) {
    const n = Math.trunc(Number(s));
    return { ok: true, v: n < 0 ? n >>> 0 : n };
  }
  return /^[A-Za-z_]\w*$/.test(s) ? { ok: false, why: "undeclared", text: s } : { ok: false, why: "number", text: s };
}

/** What g++ prints for a call with its box left empty (the AVR core's own signatures). */
function emptyIde(kind: TileKind): Text {
  switch (kind) {
    case "begin":
      return say("ideNoBegin");
    case "delay":
      return say("ideTooFew", { sig: "void delay(long unsigned int)" });
    case "analogRead":
      return say("ideTooFew", { sig: "int analogRead(uint8_t)" });
    case "digitalRead":
      return say("ideTooFew", { sig: "int digitalRead(uint8_t)" });
    default:
      return say("ideExpectedComma"); // pinMode(, OUTPUT)
  }
}

function fieldError(t: Tile, fn: Fn, field: FieldName, p: { why: "empty" | "undeclared" | "number"; text: string }): CompileError {
  const code = lineOf(t);
  const example = field === "pin" ? "A0" : field === "baud" ? "9600" : "100";
  if (p.why === "empty") return { tile: t.id, fn, ide: emptyIde(t.kind), line: say("cEmpty", { code }), hint: say("cEmptyHint", { example }) };
  if (p.why === "undeclared" && field === "pin") {
    const hint = say(t.kind === "analogRead" ? "cPinHintAnalog" : "cPinHintDigital");
    return { tile: t.id, fn, ide: say("ideUndeclared", { name: p.text }), line: say("cPin", { pin: p.text }), hint };
  }
  const ide = p.why === "undeclared" ? say("ideUndeclared", { name: p.text }) : say("ideExpected");
  return { tile: t.id, fn, ide, line: say("cNumber", { code }), hint: say("cNumberHint", { example }) };
}

/** Compiles a sketch: the first error in reading order (setup, then loop), or the program. */
export function compile(s: Sketch): Compiled {
  const program: Program = { setup: [], loop: [] };
  for (const fn of ["setup", "loop"] as const) {
    let declared = false;
    for (const t of s[fn]) {
      switch (t.kind) {
        case "begin": {
          const p = parseCount(t.baud);
          if (!p.ok) return { ok: false, error: fieldError(t, fn, "baud", p) };
          program[fn].push({ kind: "begin", baud: p.v, tile: t.id });
          break;
        }
        case "delay": {
          const p = parseCount(t.ms);
          if (!p.ok) return { ok: false, error: fieldError(t, fn, "ms", p) };
          program[fn].push({ kind: "delay", ms: p.v, tile: t.id });
          break;
        }
        case "pinMode": {
          const p = parsePin(t.pin, false);
          if (!p.ok) return { ok: false, error: fieldError(t, fn, "pin", p) };
          program[fn].push({ kind: "pinMode", pin: p.v, tile: t.id });
          break;
        }
        case "analogRead":
        case "digitalRead": {
          const p = parsePin(t.pin, t.kind === "analogRead");
          if (!p.ok) return { ok: false, error: fieldError(t, fn, "pin", p) };
          if (declared) return { ok: false, error: { tile: t.id, fn, ide: say("ideRedeclared"), line: say("cRedeclared", { fn: fnName(fn) }), hint: say("cRedeclaredHint", { fn: fnName(fn) }) } };
          declared = true;
          if (t.kind === "analogRead") program[fn].push({ kind: "analogRead", pin: p.v as PinRef, tile: t.id });
          else program[fn].push({ kind: "digitalRead", pin: p.v, tile: t.id });
          break;
        }
        case "println":
        case "print": {
          if (!declared) {
            const other: Fn = fn === "setup" ? "loop" : "setup";
            const elsewhere = s[other].some((x) => x.kind === "analogRead" || x.kind === "digitalRead");
            const ide = say("ideUndeclared", { name: "value" });
            const error: CompileError = elsewhere
              ? { tile: t.id, fn, ide, line: say("cElsewhere", { from: fnName(other), fn: fnName(fn) }), hint: say("cElsewhereHint", { fn: fnName(fn) }) }
              : { tile: t.id, fn, ide, line: say("cUndeclared", { fn: fnName(fn) }), hint: say("cUndeclaredHint") };
            return { ok: false, error };
          }
          program[fn].push({ kind: t.kind, tile: t.id });
          break;
        }
      }
    }
  }
  return { ok: true, program };
}

// ------------------------------------------------------------------ running

/** About how long one analogRead takes (Arduino's analogRead page: "about 100 microseconds"), in ms. */
export const ANALOG_READ_MS = 0.1;
/** The UART's transmit buffer (ArduinoCore-avr HardwareSerial.h: SERIAL_TX_BUFFER_SIZE 64). */
export const TX_BUFFER = 64;
/** Bits on the wire per byte: start, 8 data, stop (Serial.begin's default "8 data bits, no parity, one stop bit"). */
export const BITS_PER_BYTE = 10;
/** The rates the Serial Monitor offers. */
export const MONITOR_BAUDS = [300, 1200, 2400, 4800, 9600, 19200, 38400, 57600, 74880, 115200, 230400, 250000, 500000, 1000000, 2000000] as const;
/** ILLUSTRATIVE: the digital input thresholds, as fractions of VCC (ATmega328P VIL max 0.3 VCC, VIH min 0.6 VCC). */
export const V_LOW = 0.3 * VCC;
export const V_HIGH = 0.6 * VCC;
/** A UART still understands a baud rate off by this much. */
const BAUD_SLACK = 0.02;
export const baudsMatch = (a: number, b: number): boolean => a > 0 && b > 0 && Math.abs(a / b - 1) <= BAUD_SLACK;

/** A small seeded random source (mulberry32), so the wandering numbers and the gibberish repeat for a seed. */
export function rng(seed: number): () => number {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** One value the sketch read, for the Serial Plotter. */
export interface Point {
  /** ms since the sketch started */
  t: number;
  value: number;
}
/** What reached the Serial Monitor in a while. */
export interface Chunk {
  /** the text, as it arrives (lines end in "\r\n"); gibberish when the bauds differ */
  text: string;
  /** the values printed, when the monitor can read them and each is on a line of its own (what the plotter draws) */
  points: Point[];
  /** every value the sketch read in that time, printed or not (for a readout beside the bench) */
  reads: Point[];
}

export interface RunOptions {
  /** the Serial Monitor's baud rate (9600 unless the learner changes it) */
  monitorBaud?: number;
  /** seeds the wandering of a floating pin and the gibberish */
  seed?: number;
}

/** Plays a compiled program on a circuit, a little at a time: step(ms, force) runs the sketch for that long with the FSR
 *  pressed at that force (N, 0 = untouched) and returns what came out. The interface calls it every frame. */
export interface Runner {
  step(ms: number, force: number): Chunk;
  /** ms since the sketch started */
  readonly t: number;
  /** pins the sketch has set to OUTPUT so far */
  readonly outputs: ReadonlySet<string>;
  /** the baud rate the sketch opened the link at (null: not yet, or never) */
  readonly baud: number | null;
}

/** Most loop passes a step runs; past that, time moves on without them (a loop with no pause and nothing to send). */
const MAX_PASSES = 4000;
/** A pass of loop() takes at least this long, even an empty one (ms). */
const MIN_PASS = 0.004;
const GLYPHS = "⸮⸮⸮⸮⸮⸮⸮⸮ÿ~x�pøà`ü";

export function runner(c: Circuit, program: Program, opts: RunOptions = {}): Runner {
  const monitor = opts.monitorBaud ?? 9600;
  const rand = rng(opts.seed ?? 1);
  let t = 0; // the sketch's own clock (ms): it runs ahead of now by up to one pass
  let now = 0; // how long the board has been running (the sum of step()s)
  let started = false;
  let baud: number | null = null;
  let txFree = 0;
  const outputs = new Set<string>();
  let walk = MAX_CODE / 2; // a floating pin's wandering value
  const dstate = new Map<string, number>(); // a digital input's last level
  let value = 0;
  let garble = 0; // gibberish characters owed (a fraction carried over)
  let midLine = false; // a print() came since the last line break: the next println() ends a line the plotter can't read

  const volts = (pin: PinRef, force: number) => c.volts(pin.name, force, outputs);
  function analogRead(pin: PinRef, force: number): number {
    const v = volts(pin, force);
    if (v !== null) {
      const code = adcCode(v);
      walk = code; // a pin let go keeps its charge for a moment, then wanders from there
      return code;
    }
    walk += (rand() - 0.5) * 200 + (MAX_CODE * 0.45 - walk) * 0.06;
    walk = Math.min(MAX_CODE, Math.max(0, walk));
    return Math.round(walk);
  }
  function digitalRead(pin: PinRef | null, force: number): number {
    if (!pin || ANALOG_ONLY.has(pin.name)) return 0;
    const v = volts(pin, force);
    const last = dstate.get(pin.name) ?? 0;
    const level = v === null ? (rand() < 0.3 ? 1 - last : last) : v >= V_HIGH ? 1 : v <= V_LOW ? 0 : last;
    dstate.set(pin.name, level);
    return level;
  }

  function exec(ops: Op[], force: number, out: Chunk) {
    for (const op of ops) {
      switch (op.kind) {
        case "begin":
          baud = op.baud;
          txFree = t;
          break;
        case "pinMode":
          if (op.pin) outputs.add(op.pin.name);
          break;
        case "analogRead":
          value = analogRead(op.pin, force);
          t += ANALOG_READ_MS;
          out.reads.push({ t, value });
          break;
        case "digitalRead":
          value = digitalRead(op.pin, force);
          t += 0.005;
          out.reads.push({ t, value });
          break;
        case "println":
        case "print": {
          if (!baud) break; // the link was never opened: nothing goes out
          const text = op.kind === "println" ? `${value}\r\n` : `${value}`;
          const byteMs = (BITS_PER_BYTE * 1000) / baud;
          const start = Math.max(t, txFree);
          txFree = start + text.length * byteMs;
          const wait = txFree - t - TX_BUFFER * byteMs; // the buffer is full: print() waits for room
          if (wait > 0) t += wait;
          if (baudsMatch(baud, monitor)) {
            out.text += text;
            if (op.kind === "println" && !midLine) out.points.push({ t, value });
          } else {
            garble += text.length * Math.min(2, Math.max(0.2, monitor / baud));
            for (; garble >= 1; garble--) out.text += rand() < 0.04 ? "\r\n" : GLYPHS[Math.floor(rand() * GLYPHS.length)];
          }
          midLine = op.kind === "print";
          break;
        }
        case "delay":
          t += op.ms;
          break;
      }
    }
  }

  return {
    get t() {
      return now;
    },
    get outputs() {
      return outputs;
    },
    get baud() {
      return baud;
    },
    step(ms: number, force: number): Chunk {
      const out: Chunk = { text: "", points: [], reads: [] };
      now += Math.max(0, ms);
      if (c.power.state !== "on" || c.power.reset) {
        t = now;
        return out;
      }
      if (!started) {
        started = true;
        exec(program.setup, force, out);
      }
      let passes = 0;
      while (t < now && passes < MAX_PASSES) {
        const before = t;
        exec(program.loop, force, out);
        if (t - before < MIN_PASS) t = before + MIN_PASS;
        passes++;
      }
      if (t < now) t = now; // (passes the step had no room for: nothing a learner could tell apart)
      if (out.text.length > 20000) out.text = out.text.slice(-20000);
      return out;
    },
  };
}
