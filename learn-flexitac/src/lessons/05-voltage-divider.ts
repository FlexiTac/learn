// Lesson 5: the voltage divider. V_A0 = VCC * R1 / (R1 + R_taxel + R_on), first-order. Widget: divider-calc.
import { R1, R_ON, VCC } from "@shared/data/constants.mjs";
import { current, vA0 } from "@shared/models/divider.mjs";
import { R_HARD, R_REST, R_STOPS } from "@shared/models/taxel.mjs";
import { fact, getFact } from "../content/facts";
import type { Lesson } from "../types";
import { kOhm, milliamps, volts } from "./_crossing";

const R1K = R1 / 1000;
const MPN = (getFact("board.part.R1").value as { mpn: string }).mpn; // 1206W4F1002T5E
const CODE = MPN.match(/F(\d{4})/)?.[1] ?? ""; // "1002"
const V_REST = vA0(R_REST);
const V_EQ = vA0(R1);
const V_HARD = vA0(R_HARD);
const STOP_R1 = R_STOPS.indexOf(R1); // the figure's 10 kOhm stop

export const lesson: Lesson = {
  id: "voltage-divider",
  n: 5,
  title: "The voltage divider",
  kicker: "The crossing",
  lede: `A taxel and the board's fixed ${R1K} kΩ resistor share ${VCC} V between them. The share left over at pin A0 tells the Arduino how hard you press.`,
  status: "ready",
  features: [
    { icon: "bolt", title: `${VCC} V in`, text: "From the one drive line that is switched on" },
    { icon: "chip", title: `${R1K} kΩ to ground`, text: "R1, soldered on the reading board" },
    { icon: "pulse", title: "Voltage at A0", text: `Rises from ${volts(V_REST)} to ${volts(V_HARD)} as you press (illustrative)` },
  ],
  figure: {
    fig: "crossing",
    reset: [{ name: "release" }],
  },
  widget: "divider-calc",
  overview: `
<p><b>The problem.</b> The Arduino can't measure resistance. Its analog pins measure only <dfn>voltage</dfn>: the
electrical "push" between two points, in volts (V). So we need a circuit that turns "the taxel's resistance changed"
into "a voltage changed". The simplest one is a <dfn>voltage divider</dfn>.</p>

<p><b>Picture it as water.</b> The ${VCC} V supply is a tank on a hill; ground (0 V) is the sea. Water runs down one pipe
with two narrow sections in a row: first the taxel, then a fixed resistor called <b>R1</b>. The narrow sections use up the
drop between them, and the narrower one uses up more. Pin A0 is a pressure gauge in the pipe <i>between</i> the two.
Press the taxel and its section gets wider, so it uses up less of the drop and more pressure is left at the gauge:
the voltage at A0 goes up.</p>

<p><b>Now with resistors.</b> Two resistances in a row (in <dfn>series</dfn>) carry the same <dfn>current</dfn>, the
flow of charge, measured in amps (A). <dfn>Ohm's law</dfn> says the voltage across each is V = I × R, so each one takes a
share of the ${VCC} V in proportion to its resistance. A0 sees the share across R1:</p>
<p style="text-align:center;font-family:var(--mono)">V<sub>A0</sub> = ${VCC} V × R1 ÷ (R1 + R<sub>taxel</sub> + R<sub>on</sub>)</p>
<p>R<sub>on</sub> is the multiplexer's switch (lesson 8), which is not a perfect wire: about ${R_ON} Ω
<span class="badge badge-external" title="From outside the FlexiTac materials (e.g. a datasheet)">external</span>. Next to
${R1K} kΩ it hardly matters.</p>

<p><b>Check the ends</b> (with the illustrative taxel values from lesson 4):</p>
<ul>
  <li>Untouched, R<sub>taxel</sub> ≈ ${kOhm(R_REST)}: the taxel takes almost everything, and A0 sits at <b>${volts(V_REST)}</b>.</li>
  <li>When R<sub>taxel</sub> = R1 = ${R1K} kΩ, the two share almost equally: <b>${volts(V_EQ)}</b>, just under half.</li>
  <li>Pressed hard, R<sub>taxel</sub> ≈ ${kOhm(R_HARD)}: R1 takes most of it: <b>${volts(V_HARD)}</b>.</li>
</ul>
<p>A0 never reaches 0 V or ${VCC} V: the taxel is never a perfect break or a perfect wire.</p>

<p><b>Why ${R1K} kΩ?</b> A divider reacts most to a change in R<sub>taxel</sub> when R<sub>taxel</sub> is close to R1. Velostat
spends most of a press between a few kΩ and a couple of hundred kΩ, and ${R1K} kΩ sits in the middle of that on a log scale
<span class="badge badge-inferred" title="Worked out from the sources, not stated in them">inferred</span>. That is a common rule
of thumb; the designers don't say why they chose it.</p>

<p><b>Fixed in hardware.</b> R1 is a tiny resistor soldered onto the reading board. Its part number contains the code
<code>${CODE}</code>: "${CODE.slice(0, 3)}" followed by ${CODE.slice(3)} zeros, so ${R1.toLocaleString("en-US")} Ω. (The schematic's
"20k" label is a documentation mistake; the part list and the authors confirm ${R1K} kΩ.) Changing a number in your code
can't change it; you would need a soldering iron. Code that turns readings back into resistance must use the real value.</p>

<p><b>A first-order model.</b> The formula pretends the selected taxel is alone. If other taxels on the same sense line are
pressed too, they connect that sense line to drive lines sitting at 0 V. Those are extra paths to ground beside R1, so A0
reads <i>lower</i> than the formula says. This is one source of "ghost" readings in grid sensors.</p>

<p class="aside">Drag the slider under the figure: the plunger follows, and you can watch the ${VCC} V split between the taxel and R1.</p>`,
  wiring: {
    intro: "The divider is a single loop from the Nano's +5V pin, through the selected crossing, to ground.",
    rows: [
      { from: "Arduino Nano +5V", to: "74HC595 supply", note: `${VCC} V feeds the shift registers.` },
      { from: "Selected 74HC595 output", to: "Drive line", note: `Pushes ${VCC} V into one drive line; the others sit at 0 V.` },
      { from: "Drive line → Velostat → sense line", to: "R_taxel", note: "The pressed crossing: the resistance that changes (illustrative values)." , badge: "illustrative" },
      { from: "Sense line → FPC1", to: "CD74HC4067 input", note: `The mux switch adds R_on ≈ ${R_ON} Ω.`, badge: "external" },
      { from: "Mux COM", to: "A0", note: "The point between the two resistances: what the Arduino measures." },
      { from: "A0", to: `R1 (${R1K} kΩ) → GND`, note: "The fixed lower half of the divider." },
    ],
    foot: "First-order: the 74HC595's own output resistance, the tiny current into A0 and the paths through other pressed taxels are left out.",
  },
  code: {
    lang: "python",
    caption: "Python · the divider by hand",
    source: `R1   = ${R1}   # ohms, soldered on the board
R_ON = ${R_ON}      # ohms, mux switch
VCC  = ${VCC.toFixed(1)}     # volts

r_taxel = {{rk}} * 1000  # kOhm -> ohms
i = VCC / (r_taxel + R_ON + R1)  # amps
v_a0 = i * R1                    # Ohm's law
print(f"I = {i * 1000:.3f} mA")
print(f"V_A0 = {v_a0:.2f} V")`,
    params: [{ name: "rk", label: "R_taxel (kΩ)", min: 0.1, max: 1000, step: 0.1, value: R1K }],
    notes: [
      `The three constants are the circuit: R1 and the ${VCC} V supply are on the board, R<sub>on</sub> is the multiplexer switch from its datasheet.`,
      "Current first: the whole loop is one path, so I = V ÷ (sum of the resistances).",
      "Then Ohm's law for R1 alone: the voltage across it, which is what A0 sees, is I × R1.",
      `Try <code>rk = ${R1K}</code> (equal to R1): V<sub>A0</sub> lands just under half of ${VCC} V. Try 1 and 1000 to see it bunch up near the ends.`,
      `Press <b>Run</b>: the slider and the figure jump to that resistance. The figure's illustrative curve only spans ${kOhm(R_HARD)} to ${kOhm(R_REST)}, so values outside that are clamped there.`,
    ],
    run(p) {
      const r = p.rk * 1000;
      const i = current(r);
      const v = vA0(r);
      return [`I = ${(i * 1000).toFixed(3)} mA`, `V_A0 = ${v.toFixed(2)} V   (R_taxel ${kOhm(r)})`];
    },
  },
  specs: [
    fact("board.R1", "R1"),
    fact("board.part.R1", "R1 part", { value: (v) => `<code>${v.mpn}</code> · ${v.footprint}` }),
    fact("board.R_on", "Mux on-resistance R_on", { badge: "external" }),
    fact("board.A0", "A0 node"),
    fact("board.OE", "Unused drive lines"),
    {
      label: "Supply",
      value: `${VCC} V`,
      src: "material/tactile_reading_board_32x16.pdf (Arduino Nano +5V = board VCC)",
    },
    {
      label: "V_A0 range",
      value: `${volts(V_REST)} untouched → ${volts(V_HARD)} hard`,
      src: "computed: shared/models/divider.mjs + shared/models/taxel.mjs",
      badge: "illustrative",
      note: "From the illustrative taxel values",
    },
    {
      label: "Loop current",
      value: `${milliamps(current(R_REST))} → ${milliamps(current(R_HARD))}`,
      src: "computed: shared/models/divider.mjs + shared/models/taxel.mjs",
      badge: "illustrative",
    },
  ],
  steps: [
    {
      title: "Nothing pressed",
      text: `Untouched, the taxel (${kOhm(R_REST)}) is ${Math.round(R_REST / R1)} times bigger than R1, so it takes almost all of the ${VCC} V. A0 sits at only <b>${volts(V_REST)}</b>.`,
      act: { name: "stop", arg: 0 },
    },
    {
      title: "Taxel = R1",
      text: `Pressed until R<sub>taxel</sub> = ${R1K} kΩ, the two halves are equal and share the voltage: A0 reads <b>${volts(V_EQ)}</b>, just under half (R<sub>on</sub> takes a sliver).`,
      act: { name: "stop", arg: STOP_R1 >= 0 ? STOP_R1 : { ohms: R1 } },
    },
    {
      title: "Press hard",
      text: `At about ${kOhm(R_HARD)} the taxel is the small one now, so R1 gets most of the voltage: <b>${volts(V_HARD)}</b>. Watch the split bar under the figure.`,
      act: { name: "press", arg: 1 },
    },
  ],
  quiz: [
    {
      q: "You press the taxel harder. What happens to the voltage at A0?",
      choices: ["It goes up", "It goes down", `It stays at ${(VCC / 2).toFixed(1)} V`, "It flips to negative"],
      answer: 0,
      why: `Pressing lowers R_taxel, so the taxel takes a smaller share of the ${VCC} V and more is left across R1, which is what A0 measures.`,
    },
    {
      q: `If R_taxel were exactly ${R1K} kΩ (ignore R_on), what would A0 read?`,
      choices: ["0 V", `About ${(VCC / 2).toFixed(1)} V`, `${VCC} V`, `${R1K} V`],
      answer: 1,
      why: `Equal resistances in series share the voltage equally: ${VCC} V × ${R1K} ÷ (${R1K} + ${R1K}) = ${(VCC / 2).toFixed(1)} V.`,
    },
    {
      q: "Someone edits R1 = 20000 in the code. What changes on the board?",
      choices: ["R1 becomes 20 kΩ", "Nothing: R1 is a soldered part; only the code's maths changes", "The Arduino measures twice as fast", "The voltage at A0 doubles"],
      answer: 1,
      why: `The ${R1K} kΩ resistor is soldered on. A wrong number in code only makes the code's resistance estimates wrong.`,
    },
    {
      q: "Another taxel on the same sense line is also pressed. Compared with the formula, A0 reads…",
      choices: ["Higher", "Lower", "Exactly the same"],
      answer: 1,
      why: "The other pressed taxel links the sense line to a drive line at 0 V, an extra path to ground beside R1, which pulls A0 down. The formula is only first-order.",
    },
  ],
};
