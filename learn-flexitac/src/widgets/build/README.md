# Lesson 2.2's build engine (`src/widgets/build/`)

The circuit and code engine behind lesson 2.2, "Build it and make it work" (`build-the-circuit`). It is pure
TypeScript with no DOM. It works in hole ids and pin names only, never in pixels; the renders' `build.json` maps those to
pictures. It follows the build's shared contract (`CONTRACT.md` in the session scratchpad). Everything is exported from
one module:

```ts
import { run, REFERENCE_BUILD, REFERENCE_SKETCH, connections, checkPart, runner, circuit, compile } from "./build/engine";
```

| File | What it holds |
|---|---|
| `board.ts` | Holes, strips and rails; where each part's pins go; what may go where; edits that return a new `Build` |
| `netlist.ts` | Union-find nets; `connections()` (plain-language lines); `joinedHoles()`; `occupantName()` |
| `circuit.ts` | Power (off, on or short; reset held); nodal solver; the voltage on any pin or hole at a press force |
| `sketch.ts` | Code tiles (`TRAY`), `compile()`, `sourceOf()`, `pieces()`, and the `runner()` that plays the sketch over time |
| `verdict.ts` | `run()`, which says whether it works and why not; `wiring()` and `checkWiring()` for the wiring alone |
| `words.ts` | Every English and Chinese text, as `Text = { en, zh }` |
| `engine.test.ts` | 44 cases. Run: `node_modules/.bin/esbuild src/widgets/build/engine.test.ts --bundle --platform=node --format=esm --outfile=<tmp>/t.mjs && node <tmp>/t.mjs` |

## Texts

Every text the engine returns is a `Text = { en: string; zh: string }`, with its `{slots}` already filled. To show one,
pick the language on every paint: `tx(t.en, t.zh)` (from `src/i18n`), or `t[lang()]`. On `ctx.onLang`, paint again;
there is nothing to recompute. The tables live in `words.ts`, in a local `strings(en, zh)` that the i18n check reads like
the site's own helper. Every English key needs its Chinese key, and TypeScript enforces this too.

## The board (`board.ts`)

- A hole id is a column plus a row letter, `"12c"` (columns 1–30, rows a–j), or a rail plus a number, `"TP7"` (rails
  `TP`, `TN`, `BP`, `BN`, holes 1–25). `ALL_HOLES` lists all 400. `parseHole(id)` returns `null` for an id that is not a
  hole.
- A strip is the set of holes joined inside the board: `"12a-e"`, `"12f-j"`, or a whole rail, `"TP"`. Use
  `stripOf(hole)` and `stripHoles(strip)`. `ROW_Y` gives each row's position in pitches from row a: a=0 … e=4, f=7 … j=11.
- **Nano:** `{ col: 1..16, row: "b"|"c"|"d"|"e" }`. `col` is the column of its leftmost pins (D12 and D13); `row` is the
  row of the upper header. The lower header sits 6 pitches below, in f–i.
  - `nanoPins(place)` gives `[{ pin, hole }]` for all 30 pins. `nanoBody(place)` gives the holes under the board between
    the two headers; those holes are blocked.
  - **Pin keys:** each pin's key is its printed name, except the two GND and the two RST pins, which become
    `"GND.upper"`, `"GND.lower"`, `"RST.upper"` and `"RST.lower"`. The renderer's `build.json` cannot have two keys
    named `"GND"`, so the interface needs to map its pin names to these keys (`NANO_PINS`, `nanoPinByKey`).
- **FSR and resistor:** `{ at: HoleId, rot: 0 | 90 }`. Pin `"1"` sits at `at`.
  - FSR, rot 0: the second pin is one column to the right, and the tail runs down. FSR, rot 90: the second pin is one
    row below, in the same strip, so the sensor is bypassed. That is a lesson mistake, so it can be placed.
  - Resistor, rot 0: the second leg is four columns to the right. Resistor, rot 90: four pitches down, so only a–e, d–f,
    e–g or f–j.
  - `fsrPins(place)` and `resistorPins(place)` return `null` where the part cannot go.
  - Parts go in the middle of the board only; the rails take wires. The FSR's tail and the resistor's body block no
    holes. Only the Nano's body does.
- **Build:** `{ nano, fsr, resistor, wires: [{ id, a, b, color }], usb }`. Wire colours are `WIRE_COLORS` (red, black,
  yellow, blue, green). `EMPTY_BUILD` is empty. `REFERENCE_BUILD` is lesson 2.1's circuit, the "Show me" layout:
  - the Nano at column 3, row c;
  - the FSR at 24j, rot 0, with its tail off the bottom edge;
  - the resistor at 25e, rot 90 (25e to 25g, across the groove);
  - red wire 14h→24h, yellow 6i→25i, black 14b→25b;
  - USB in.
- **May it go there?** Each check returns `{ ok: true }`, or `{ ok: false, why, hole?, text }`. The checks are
  `checkNano(b, col, row)`, `checkPart(b, "fsr"|"resistor", place)`, `checkWire(b, a, z, id?)`,
  `checkWireEnd(b, id, end, hole)` and `holeFree(b, hole)`. The thing being moved does not block itself.

  | `why` | When |
  |---|---|
  | `off-board` | A pin would land off the board, or a hole id is not a hole |
  | `rail` | A part's leg is in a rail |
  | `groove` | A turned part's leg would land in the groove |
  | `nano-groove` | The Nano is not across the groove (any row other than b–e). `say("nanoPairs")` adds why: across from each other, GND would meet 5V |
  | `taken` | The hole is used by a pin or a wire end (`hole` names it) |
  | `under-nano` | The hole is under the Nano's body |
  | `covers` | The Nano's body would cover a used hole |
  | `same-hole` | A wire's two ends are in one hole |
  | `no-wire` | No wire has that id |

- **Edits** each return a new `Build` and change nothing in place, so an undo list is free. Each returns
  `{ ok: true, build }`, or `{ ok: false, why, hole?, text, build }`, with the old build when refused.
  - `placeNano(b, place)`, `placeFsr` / `placeResistor` / `placePart(b, kind, place)`
  - `addWire(b, a, z, color, id?)` (ids are `"w1"`, `"w2"` …), `moveWireEnd(b, id, "a"|"b", hole)`,
    `moveWire(b, id, a, z)`
  - These return a `Build` directly: `removeWire(b, id)`, `recolorWire(b, id, color)`, `removePart(b, kind)` (taking
    the Nano off also unplugs USB), `plugUsb(b, on)` (only into a Nano on the board).
- `occupancy(b)` maps each used hole to what is in it. `whatIsAt(b, hole)` returns one occupant, for picking things up.
  `validBuild(b)` checks a build that came from saved state.

## What is connected to what (`netlist.ts`)

- `netlist(b)` returns `{ nets, netOf(ref), netOfHole(hole) }`. A ref is a Nano pin name (`"A0"`, `"GND"`) or one of
  `"fsr:1"`, `"fsr:2"`, `"resistor:1"`, `"resistor:2"`. Each net has its `strips`, its `holes` (to light up), its
  `items`, and its `nano` pin names (GND once), `fsr` pins and `resistor` legs.
- `connections(b)` lists every net that joins two or more things, in plain words, with 5V first and GND last. For the
  reference build:
  - "5V — FSR pin 1"
  - "A0 — FSR pin 2 — resistor"
  - "GND — resistor"

  The Chinese lines are "5V — FSR 引脚 1", "A0 — FSR 引脚 2 — 电阻" and "GND — 电阻". A part with both pins on one net is
  named once: "FSR (both pins)".
- `joinedHoles(b, hole)` gives the holes to light up for a hole: its whole net, or its own strip if nothing is in it.
- `occupantName(whatIsAt(b, hole))` gives a hover label, such as "A0", "FSR pin 2" or "resistor".

## The electrical model (`circuit.ts`)

- `circuit(b)` returns `{ build, nl, power, volts(ref, force, outputs?), voltsAt(hole, force, outputs?), net(ref),
  supplyOf(net) }`. Voltages are `null` when a net is floating or the board is off. `force` is in newtons, 0 when
  untouched; `../bench/fsr.ts` `forceAt(0..1)` maps a slider to 0.2–20 N.
- `power`: `{ state: "off" | "on" | "short", short?: { a, b }, reset }`.
  - `off`: no Nano, or no USB.
  - `short`: 5V or 3V3 is joined straight to GND, or 5V to 3V3.
  - `reset`: RST is joined straight to GND.
- With USB in, 5V is `VCC` (5 V) and 3V3 is `V3V3` (3.3 V); GND is 0 V.
- The FSR is `fsrOhms(force)` from `../bench/fsr.ts`, open when untouched. The resistor is `R1` (10 kΩ).
- Inputs are high-impedance. A pin set with pinMode(OUTPUT) drives LOW through `R_OUT` (25 Ω). A6 and A7 cannot be
  outputs.
- `solve()` runs a nodal analysis over the nets. A net with no path through resistances to a supply is floating.
- On the reference build, A0 equals lesson 2.1's `readAt(f).volts` at every force; a test checks this.

## The sketch (`sketch.ts`)

- `TRAY` is the fixed set of tiles, each used once. Five make a working sketch: `begin` (Serial.begin(9600)), `read`
  (int value = analogRead(A0)), `println`, `delay` (delay(100)), plus the decoys. The four decoys are:
  - `begin-fast` (Serial.begin(115200))
  - `pin-mode` (pinMode(A0, OUTPUT))
  - `digital-read` (int value = digitalRead(A0))
  - `print` (Serial.print(value))
- A tile is `{ id, kind, pin?, baud?, ms? }`. Fields are kept as typed strings. `FIELDS[kind]` names a kind's fields.
  `pieces(tile)` splits its line into code and field boxes: `[{code:"Serial.begin("}, {field:"baud", value:"9600"},
  {code:");"}]`. `lineOf(tile)` gives the plain line.
- A sketch is `{ setup: Tile[], loop: Tile[] }`. `REFERENCE_SKETCH` and `EMPTY_SKETCH` are provided. `sourceOf(sketch)`
  gives the whole program as the IDE shows it; every line is 46 characters or fewer.
- `compile(sketch)` returns `{ ok: true, program }` or `{ ok: false, error }`. The error is `{ tile, fn, ide, line,
  hint }`: `tile` is the one to highlight, and `ide` is the compiler's own English line. It catches what a real compiler
  would:
  - a print before any read in the same function ("'value' was not declared in this scope"), with its own words when
    the read is in the other function;
  - two reads in one function ("redeclaration of 'int value'");
  - a pin the Nano has no name for. Case matters (`a0`), and the AVR core has no `D2`;
  - an empty box, and a word where a number goes.

  Numbers work as on the AVR: `analogRead(0)` and `analogRead(14)` both read A0, and `delay(-1)` waits 49 days.
- `runner(circuit(b), program, { monitorBaud?, seed? })` returns `{ step(ms, force) → { text, points, reads }, t,
  outputs, baud }`. Call `step` every frame with the frame time and the current press.
  - `text` is what reached the Serial Monitor, with lines ending in `\r\n`, or gibberish.
  - `points` are what the Serial Plotter draws (only numbers one to a line, at a matching baud).
  - `reads` holds every value read.

  It is a small interpreter:
  - Setup runs once, then loop.
  - Prints before Serial.begin send nothing.
  - Each byte takes 10 bits on the wire, and print blocks once the 64-byte buffer is full, so a loop with no delay is
    held back by the baud rate.
  - analogRead takes about 0.1 ms.
  - The monitor shows text when its baud matches the sketch's within 2 %.
  - Nothing runs while the board is off, shorted or held in reset.

## The verdict (`verdict.ts`)

`run(build, sketch, { monitorBaud = 9600, force = 0, ms = 2000, seed })` returns a `Verdict`:

| Field | Meaning |
|---|---|
| `ok` | It works: a firm press (`F_PRESS`, 10 N) moves the reading on the read pin by `RESPONSIVE` (100) or more from a steady rest value, and the monitor shows it one number a line (notes allowed) |
| `stage` | How far it got: `"build"` (no Nano), `"compile"`, `"upload"` (no USB, a short, or held in reset), or `"run"` |
| `power` | `"off"`, `"on"` or `"short"` |
| `compileError` | The compile error, or null |
| `pin`, `read` | The pin the sketch reads (`"A0"` if none) and how (`"analogRead"`, `"digitalRead"`, or null) |
| `volts` | The read pin's voltage at `force` (null when floating) |
| `rest`, `press` | `{ volts, value }` at 0 N and at 10 N. `value` is null when floating, because it wanders |
| `circuitOk` | The wiring works for that pin, whatever the code does. It is judged as if USB were in, so the lesson can say "the wiring is right, now plug in" |
| `monitor` | `{ kind: "empty" \| "numbers" \| "run-together" \| "gibberish", text, lines, points, reads }` over `ms` at `force` |
| `symptom` | The first problem, or `works` |
| `problems` | Every problem in the order to fix them, then the notes |

A symptom is `{ id, level: "ok" | "note" | "fail", badge, line: Text, hint: Text }`. `line` is one line saying what the
learner sees and why; `hint` says what to do. Symptoms come in the order a learner meets them:

| `id` | Level | When | Badge |
|---|---|---|---|
| `works` | ok | Works as in lesson 2.1; the line names the top reading at 20 N | illustrative (FSR curve) |
| `no-nano` | fail | No Nano on the board | |
| `compile` | fail | `compileError` holds the details | |
| `no-usb` | fail | Upload fails: no board found | |
| `short` | fail | 5V–GND, 3V3–GND or 5V–3V3: the board shuts off | inferred |
| `reset-held` | fail | RST joined to GND | inferred |
| `no-begin` | fail | No Serial.begin: the monitor is empty | |
| `no-print` | fail | Nothing prints | |
| `runs-once` | fail | The print is only in setup(): one number, then nothing | |
| `wrong-baud` | fail | The sketch's baud and the monitor's differ: gibberish | illustrative |
| `no-newline` | fail | Serial.print only: the numbers run together (`circuitOk` may still be true) | |
| `doubled` | fail | Serial.print and Serial.println both in loop(): each line holds the reading twice, run together; the plotter gets nothing | |
| `digital-read` | fail | digitalRead: only 0 or 1 | illustrative |
| `pin-output` | fail | pinMode(OUTPUT) on the read pin, or on a pin joined to it: it fights the sensor | inferred |
| `pin-output-short` | fail | pinMode(OUTPUT) on a pin wired to 5V or 3V3 | inferred |
| `wrong-pin` | fail | The sensor is on another analog pin than the one the sketch reads | |
| `wrong-pin-digital` | fail | The sensor is on a digital pin | |
| `no-fsr` | fail | No FSR | |
| `fsr-bypassed` | fail | Both FSR legs in one strip (with the reading, e.g. 1023, when there is one), or joined by a wire | |
| `fsr-unconnected` | fail | The FSR's strips hold nothing else | |
| `fsr-one-leg` | fail | One FSR leg connects to nothing | |
| `fsr-across` | fail | The FSR sits straight between two supplies | |
| `stuck` | fail | The read pin is joined straight to 5V, 3V3 or GND: reads 1023, 675 or 0 | |
| `no-resistor` | fail | No resistor: floating at rest, 1023 when pressed | illustrative |
| `floating` | fail | The resistor does not reach GND | illustrative |
| `resistor-bypassed` | fail | Both resistor legs in one strip | illustrative |
| `pin-unwired` | fail | Nothing on the read pin's net but the pin itself | illustrative |
| `both-gnd` | fail | The FSR and the resistor both lead to GND | |
| `both-5v` | fail | The FSR and the resistor both lead to 5V | |
| `fsr-no-supply` | fail | The FSR does not reach a supply | |
| `no-change` | fail | Anything else that does not respond | |
| `too-slow` | fail | A pause of 10 s or more in loop() | |
| `pull-up` | note | Works backwards: 1023 at rest, falls when pressed | |
| `on-3v3` | note | Fed from 3V3: it can't pass 675, which is adcCode(3.3 V) | |
| `rest-high` | note | Works, but rests above 50 | |
| `fast` | note | No delay in loop(): the numbers rush past | |
| `slow` | note | A pause of 2 to 10 s | |
| `begin-in-loop` | note | Serial.begin in loop() | |

`checkWiring(b, pin = "A0")` gives `{ ok, problems, power }` for the wiring alone, as if USB were in, for step 3 before
any code exists. `wiring(circuit, pin, fn)` is the same, given a circuit.

## Numbers and where they come from

| Number | Value | Source | Badge |
|---|---|---|---|
| VCC, the 5V pin | 5 V | `@shared/data/constants.mjs` | |
| R1, the resistor | 10 kΩ | `@shared/data/constants.mjs` | |
| V3V3, the 3V3 pin | 3.3 V | The Arduino Nano pinout ("+3V3") | |
| analogRead | floor(V × 1024 / 5), 0–1023 | `@shared/models/adc.mjs` (ATmega328P datasheet §24.7) | |
| FSR resistance | Through Adafruit's four points on log-log axes; open when untouched | `../bench/fsr.ts` | illustrative |
| F_PRESS | 10 N | A point in Adafruit's table | |
| analogRead time | About 0.1 ms | Arduino's analogRead page | |
| Serial frame | 10 bits; 64-byte TX buffer | Serial.begin's default 8N1; ArduinoCore-avr | |
| R_OUT | 25 Ω | A pin driving LOW, read off the ATmega328P's output curves | illustrative |
| V_LOW, V_HIGH | 0.3 and 0.6 × VCC | ATmega328P VIL and VIH | illustrative |
| Floating reading | A seeded random walk | | illustrative |
| Gibberish | Mostly ⸮, the IDE's sign for an unreadable byte | | illustrative |
| RESPONSIVE | 100 steps | This lesson's own pass mark, about 0.5 V | |
| Short cuts the power | | The USB port's current limit and the classic Nano's USB fuse | inferred |

## Notes for the interface and the renderer

- The plan says 3V3 "tops out near 690". The model gives 675 (adcCode(3.3 V)), and 634 at the bench's hardest press
  (20 N). The note's text names 675.
- The contract places the Nano only across the groove. A drop elsewhere gets `nano-groove`, and its text explains why.
- The FSR's tail never blocks holes, even when it lies over the board (rot 0 in rows a–e).
