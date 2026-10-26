// Lesson 4: one crossing = one taxel. Piezoresistance intuition and the ILLUSTRATIVE press -> resistance curve.
import { COLS, ROWS } from "@shared/data/constants.mjs";
import { ILLUSTRATIVE, R_HARD, R_REST, rTaxel } from "@shared/models/taxel.mjs";
import { fact, getFact, num } from "../content/facts";
import type { Lesson } from "../types";
import { curveSvg, kOhm } from "./_crossing";

const THICK_MM = num("velostat.thickness"); // 0.1
const CROSS = getFact("pad.crossing").value as [number, number]; // 0.6 x 0.6 mm (inferred)
const PITCH = num("fpc_top.electrodes.pitch"); // 2.0
const WIDTH = num("fpc_top.electrodes.width"); // 0.6
const RHO = Number(String(getFact("velostat.volumeResistivity").value).replace(/[^\d.]/g, "")); // "< 500" ohm*cm
// R = rho * L / A, in centimetres (the datasheet unit)
const L_CM = THICK_MM / 10;
const A_CM2 = (CROSS[0] / 10) * (CROSS[1] / 10);
const R_BULK = (RHO * L_CM) / A_CM2;
const GAP = +(PITCH - WIDTH).toFixed(2); // copper-free gap between neighbouring lines
const HALF = rTaxel(0.5);

export const lesson: Lesson = {
  id: "one-crossing",
  n: 4,
  title: "One crossing = one taxel",
  kicker: "The crossing",
  lede: "Zoom into a single crossing: a drive line below, a sense line above, and a speck of Velostat between them. Press it and its resistance falls.",
  status: "ready",
  features: [
    { icon: "touch", title: "One spot, one reading", text: `Each of the ${ROWS * COLS} crossings is read on its own` },
    { icon: "wave", title: "Squeeze → lower resistance", text: `${kOhm(R_REST)} untouched, about ${kOhm(R_HARD)} pressed hard (illustrative)` },
    { icon: "bolt", title: "Current goes through", text: "Drive line → Velostat → sense line" },
  ],
  figure: {
    fig: "crossing",
    reset: [{ name: "release" }],
  },
  overview: `
<p>Lesson 1 said that every place where a drive line crosses a sense line is one taxel. Now we zoom in on one.
The bottom sheet's drive line and the top sheet's sense line cross at right angles. Where they overlap, a
${CROSS[0]} × ${CROSS[1]} mm square of copper sits over another one <span class="badge badge-inferred" title="Worked out from the sources, not stated in them">inferred</span>,
with a ${THICK_MM} mm layer of Velostat squeezed between them. That little copper–Velostat–copper stack is the whole taxel.</p>

<p><b>Why pressing changes anything.</b> Velostat is plastic with tiny grains of carbon mixed in. Carbon conducts
electricity; the plastic around it does not. To get through the film, current has to hop from grain to grain.
Left alone, only a few grains touch, so there are only a few paths: the <dfn>resistance</dfn> (how hard it is
for current to get through, in ohms, Ω) is high. Press down and the grains are pushed together, more chains of
touching grains form, and the copper sits more firmly on the film. More paths side by side means lower resistance,
just as opening more checkout lanes lets the same crowd out of a shop faster.</p>

<p>A material that changes its resistance when squeezed is <dfn>piezoresistive</dfn> (<i>piezo</i> is Greek for
"press"). The effect is called <dfn>piezoresistance</dfn>, and it is the only physics the pad needs.</p>

<p><b>The shape of the curve.</b> Nobody has measured FlexiTac's force-to-resistance curve, so the curve here is
<i>illustrative</i>: it shows the shape, not real values. Resistance drops steeply at the first touch and then
levels off, because once most grains already touch, squeezing harder adds few new paths. The x axis is a plain
"how hard" from 0 (just touching) to 1 (a hard press). It is not in newtons, because there is no force data.</p>
${ILLUSTRATIVE ? curveSvg() : ""}

<p>The two ends are educated guesses. Untouched, we use ${kOhm(R_REST)}: that puts the resting reading inside the range
the PyFlexiTac software expects (lesson 6). Pressed hard, we assume the loose contacts are gone and what is left is
roughly the film itself. Velostat's datasheet gives a <dfn>resistivity</dfn> (resistance of a standard 1 cm cube) of
ρ &lt; ${RHO} Ω·cm. For a block, R = ρ × thickness ÷ area = ${RHO} × ${L_CM} cm ÷ ${A_CM2.toFixed(4)} cm²
≈ ${kOhm(R_BULK)}, which is where the ${kOhm(R_HARD)} we use comes from.</p>

<p><b>Which way the current goes.</b> When the board selects this crossing, it puts 5 V on the drive line. Current
flows up through the ${THICK_MM} mm of Velostat into the sense line, then off to the board. Going sideways to the next
copper line would mean crossing a ${GAP} mm gap, more than ten times farther, so almost all the current takes the short
path straight through. That is why each crossing behaves like its own little resistor.</p>

<p><b>What a taxel feels.</b> Squeezing makes the film thinner and denser, so a taxel reports how hard you <i>push into</i>
the pad. Sliding a finger sideways hardly squeezes the film, so a taxel feels sliding far less than pressing.</p>

<p class="aside">Use the guided steps, or hold the plunger in the figure. Watch R<sub>taxel</sub> in the readout fall and the
current dashes speed up. The next lesson turns that resistance into a voltage the Arduino can measure.</p>`,
  wiring: {
    intro: "The path the current takes through one selected crossing, from the board and back again.",
    rows: [
      { from: "74HC595 output (selected)", to: "Drive line on the Bottom FPC", note: "5 V on this one drive line; all the others are held at 0 V." },
      { from: "Drive line copper", to: "Velostat", note: `Current crosses the ${THICK_MM} mm film where the lines overlap.` },
      { from: "Velostat", to: "Sense line on the Top FPC", note: "The pressed spot lets more current through." },
      { from: "Sense line", to: "Multiplexer → A0", note: "The board listens to one sense line at a time (lessons 5 and 8)." },
    ],
    foot: "How the copper lines map onto the cable pins assumes a straight-through flat cable, so that mapping is <i>inferred</i>.",
  },
  code: {
    lang: "python",
    caption: "Python · the illustrative curve",
    source: `# Illustrative only: no force data exists.
R_REST = ${R_REST}  # ohms, untouched
R_HARD = ${R_HARD}    # ohms, pressed hard
press = {{press}}  # 0 = touching, 1 = hard

s = 1 - (1 - press) ** 2  # fast, then slow
r = R_REST * (R_HARD / R_REST) ** s
print(f"R_taxel = {r / 1000:.1f} kOhm")`,
    params: [{ name: "press", label: "How hard (0 to 1)", min: 0, max: 1, step: 0.05, value: 0.5 }],
    notes: [
      `<code>press</code> is a unitless knob from 0 (tip just touching) to 1 (a hard press). It is <i>not</i> a force: there is no force data for FlexiTac, so this whole curve is illustrative.`,
      `<code>s</code> eases the press so the resistance falls quickly at first and then levels off, like real Velostat does.`,
      `The resistance moves between the two ends on a <b>log scale</b>: each step multiplies it by the same factor instead of subtracting the same amount. That matches how Velostat goes from hundreds of kΩ to a few kΩ.`,
      `Press <b>Run</b>: the plunger in the figure goes to that press and the readout shows the same R<sub>taxel</sub>.`,
    ],
    run(p, ctx) {
      const press = Math.min(1, Math.max(0, p.press));
      const r = rTaxel(press);
      ctx.figure?.act("press", press);
      return [`R_taxel = ${(r / 1000).toFixed(1)} kOhm   (press ${press}, illustrative)`, "figure: plunger moves to that press"];
    },
  },
  specs: [
    fact("velostat.behaviour", "Velostat"),
    fact("velostat.thickness", "Velostat thickness"),
    fact("velostat.volumeResistivity", "Volume resistivity", { value: (v) => `${String(v).replace("<", "&lt; ")} Ω·cm` }),
    fact("pad.crossing", "Copper overlap per crossing", { value: (v) => `${v[0]} × ${v[1]} mm` }),
    fact("fpc_top.electrodes.pitch", "Line pitch", { note: "Centre to centre, both sheets" }),
    {
      label: "R_taxel untouched",
      value: kOhm(R_REST),
      src: "shared/models/taxel.mjs; refs/fw/pyflexitac/sensor.py (PyFlexiTac resting values 10-40)",
      badge: "illustrative",
      note: "Chosen so the resting byte lands in PyFlexiTac's typical range",
    },
    {
      label: "R_taxel pressed hard",
      value: `≈ ${kOhm(R_HARD)}`,
      src: "shared/models/taxel.mjs; computed from Velostat resistivity × thickness ÷ crossing area",
      badge: "illustrative",
      note: "The bulk limit of one crossing",
    },
    fact("characterization", "Force data"),
  ],
  steps: [
    {
      title: "Untouched",
      text: `The plunger is up. Only a few carbon grains touch, so the taxel is about <b>${kOhm(R_REST)}</b> (illustrative). Hardly any current gets through.`,
      act: { name: "release" },
    },
    {
      title: "Just touching",
      text: "The tip now rests on the pad but isn't squeezing it. The resistance has barely changed: touching is not pressing.",
      act: { name: "press", arg: 0 },
    },
    {
      title: "Press halfway",
      text: `Halfway down, the resistance has already fallen to about <b>${kOhm(HALF)}</b>. Most of the change happens early.`,
      act: { name: "press", arg: 0.5 },
    },
    {
      title: "Press hard",
      text: `A hard press only takes it down to about <b>${kOhm(R_HARD)}</b>. The curve has levelled off, and the current dashes run fastest.`,
      act: { name: "press", arg: 1 },
    },
  ],
  quiz: [
    {
      q: "Why does Velostat's resistance fall when you squeeze it?",
      choices: ["The copper heats up", "More carbon grains touch, so there are more paths for current", "The plastic melts into copper", "The voltage on the drive line rises"],
      answer: 1,
      why: "Current hops from carbon grain to carbon grain. Squeezing pushes grains together, so more side-by-side paths form and the resistance drops.",
    },
    {
      q: "The curve in this lesson has no newtons on it. Why?",
      choices: ["Newtons are too small to show", "Velostat can't feel force", "No force measurements exist for FlexiTac, so the curve only shows the shape", "The Arduino measures in grams"],
      answer: 2,
      why: "There is no force or characterization data, so the curve is illustrative: it shows that resistance falls fast and then levels off, not real values.",
    },
    {
      q: "Which change lowers the taxel's resistance by the bigger factor?",
      choices: ["Press 0 → 0.5", "Press 0.5 → 1", "They are the same"],
      answer: 0,
      why: `On the illustrative curve, 0 → 0.5 takes it from ${kOhm(R_REST)} to about ${kOhm(HALF)} (×${Math.round(R_REST / HALF)} lower), while 0.5 → 1 only goes to ${kOhm(R_HARD)} (×${(HALF / R_HARD).toFixed(1)}). Most of the change happens at the first touch.`,
    },
    {
      q: "When a crossing is selected, which way does most of the current go?",
      choices: ["Sideways along the Velostat to the next line", "From the drive line, up through the Velostat, into the sense line", "Through the laminating sheet", "It doesn't move until you press"],
      answer: 1,
      why: `The film is only ${THICK_MM} mm thick, while the next copper line is ${GAP} mm away, so the short path straight through the crossing wins by far.`,
    },
  ],
};
