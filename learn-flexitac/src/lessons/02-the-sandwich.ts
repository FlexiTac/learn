// Lesson 2: from the Velostat to the whole pad. Step 1 squeezes the Velostat (the pad taken apart, its label, a press ->
// resistance card; it came from lesson 1); step 2 shows ONE crossing (a top line over a bottom line, Velostat between)
// wired to a meter; step 3 four of them (2 × 2) read one crossing at a time; step 4 the whole 12 × 32 pad read line by
// line, with a cross-section of its layers and their thicknesses. The overview keeps the five layers (what each
// is made of, how thick the sources say it is, why the Top FPC is flipped) and adds how a grid is read.
import { COLS, ROWS } from "@shared/data/constants.mjs";
import stack from "@shared/data/stack.json";
import { R1 } from "@shared/data/constants.mjs";
import { vA0 } from "@shared/models/divider.mjs";
import { R_HARD, R_REST } from "@shared/models/taxel.mjs";
import { fact, getFact, num } from "../content/facts";
import { BESIDE_ROOM } from "../ui/demo";
import { fmtR } from "../ui/ohms";
import type { Lesson } from "../types";

const FPC = num("fpc_top.thickness");
const VELO = num("velostat.thickness");
const LIMIT = stack.totalThickness.value; // paper: total thickness < 1 mm
const CORE = 2 * FPC + VELO; // the three layers the sources give
const BUILD = stack.fpcBuild;
const AREA = getFact("pad.activeArea").value as number[]; // [w, h] mm
const TAXELS = num("sensor.taxels"); // 384
const HZ = num("system.frameRate"); // 100 pictures a second
const mm = (v: number) => `${+v.toFixed(2)} mm`;
/** A number and its unit never split across lines ("1.4 kΩ"). */
const nb = (t: string) => t.replace(/ /g, "&nbsp;");
// Step 2's numbers, from the same models as its card (src/widgets/unit-demo.ts): the voltage across R1 untouched and
// pressed hard, V = 5 V × R1 / (R1 + R) (R_on left out, as the card does). Illustrative: ≈ 0.24 V and ≈ 4.4 V.
const V_REST = vA0(R_REST, { rOn: 0 }).toFixed(2);
const V_HARD = vA0(R_HARD, { rOn: 0 }).toFixed(1);
// The ringed crossing of step 2 (0-based: sense line 6 × drive line 16; step 3 rings the 2 × 2 block that starts there,
// sense lines 6-7 × drive lines 16-17) and the band kept right of the pad for the card (src/ui/demo.ts BESIDE_ROOM: half
// the drawing on a desktop, so the pad and the card share the stage; a phone's narrower band for the cards' mini forms).
// Step 4's band (the same width) is reserved by src/ui/demo.ts for the pad card.
const SPOT = { sense: 5, drive: 15 };
const ONE = { ...SPOT, room: BESIDE_ROOM };
const FOUR = { ...SPOT, span: 2, room: BESIDE_ROOM };

export const lesson: Lesson = {
  id: "the-sandwich",
  n: 2,
  title: "The sandwich",
  kicker: "The pad",
  lede: `Squeeze the Velostat and its resistance falls. Then from one touch spot to the whole pad: a top line over a bottom line with Velostat between, then four of them, then all ${TAXELS}, read one crossing at a time. Five thin layers, under ${LIMIT}&nbsp;mm in all.`,
  status: "ready",
  features: [
    { icon: "touch", title: "One touch spot", text: "A top line, Velostat, a bottom line: press and the reading rises" },
    { icon: "grid", title: "One crossing at a time", text: `Listen to one top line, power one bottom line: ${TAXELS} readings a picture` },
    { icon: "ruler", title: `Under ${LIMIT} mm`, text: `${mm(CORE)} of it is sourced; the laminate and tape are not` },
  ],
  figure: {
    fig: "pad",
    // The lesson opens on step 1, "Squeeze the Velostat": the pad taken apart in the iso view, no ring, the Velostat
    // labelled (its label left of the pad), and the press -> resistance card beside it (src/widgets/velostat-demo.ts; on a
    // narrow stage the figure keeps a band free for it, src/ui/demo.ts). initial and reset both land in that pose (step 1
    // is the start step: the restart button plays only reset, then shows step 1), like lesson 1. A later step's dot
    // replays steps 1..k after reset. Step 2, "One touch spot", closes the pad and puts a ring on one crossing (sense
    // line 6 × drive line 16, 0-based 5 × 15; figures/EMBED.md "Fig 1 pad: focus"), which keeps half the drawing free on
    // the right (room) for the unit card (src/widgets/unit-demo.ts), joined to the ring by a leader.
    initial: [{ name: "deselect" }, { name: "focus", arg: null }, { name: "iso" }, { name: "explode" }, { name: "select", arg: "velostat" }],
    reset: [{ name: "deselect" }, { name: "focus", arg: null }, { name: "iso" }, { name: "explode" }, { name: "select", arg: "velostat" }],
  },
  overview: `
<p>A sandwich works because every layer has a job: bread to hold, butter to stick, filling to taste.
FlexiTac is the same. Five sheets, stacked flat, and each one is there for a reason. From the top down:</p>
<ul>
  <li>A <b>laminating sheet</b> (top and bottom).</li>
  <li>The <b>Top FPC</b> with the ${ROWS} sense lines.</li>
  <li>The <b>Velostat</b> in the middle.</li>
  <li>The <b>Bottom FPC</b> with the ${COLS} drive lines.</li>
</ul>
<p><b>The middle three do the sensing.</b> An <dfn title="flexible printed circuit">FPC</dfn> is a circuit board
printed on a thin, bendable plastic film instead of stiff fibreglass. Each of FlexiTac's two FPCs is
<b>${FPC} mm</b> thick, about two sheets of paper. The <dfn>Velostat</dfn> between them is <b>${VELO} mm</b>.
Current can only reach a sense line by going <i>through</i> the Velostat, so the Velostat decides how much gets
through: squeeze it and more does.</p>
<p><b>One touch spot.</b> Where one copper line of the Top FPC crosses one of the Bottom FPC, with the Velostat
between them, is one <dfn title="one crossing of a top line and a bottom line: the sensor's pixel">touch spot</dfn>.
Press it and the Velostat there conducts better, so more current gets through and the voltage the board measures
rises.</p>
<p><b>Reading a grid.</b> The ${ROWS} <dfn title="a copper line on the Top FPC that the board listens to">sense lines</dfn>
run one way and the ${COLS} <dfn title="a copper line on the Bottom FPC that the board powers">drive lines</dfn> the other, so
every sense line crosses every drive line once: ${ROWS} × ${COLS} = ${TAXELS} touch spots. The board never reads
them all at once. It listens to one sense line and powers one drive line at a time (that line at 5 V, the others at
0 V), so current can reach the sense line only through the one spot where the two cross: each reading is about that
spot alone. It powers the drive lines one by one, then moves on to the next sense line. ${TAXELS} readings make one
picture, ${HZ} pictures every second.</p>
<p><b>Copper faces in.</b> Each FPC has copper on <b>one side only</b>: the manufacturing files have nothing on the
other side. For a crossing to work, both copper strips have to touch the Velostat. So the Bottom FPC lies copper-up,
and the Top FPC must be turned over, <b>copper-down</b>. The sources never say this outright; we worked it out from the
files and the guide photo, so it carries an <span class="badge badge-inferred">inferred</span> badge.</p>
<p><b>The outer two hold it together.</b> A <dfn title="a thin plastic film with glue on one side">laminating sheet</dfn>
is a thin plastic film with glue on one side. In the build guide each FPC is first stuck onto its own sheet and lined
up by its corners. The sheets keep the FPCs flat and in place, and together they enclose the whole stack, so the
copper stays against the Velostat at all ${ROWS * COLS} crossings. The Velostat itself is simply laid between the two
prepared sheets (guide step 2) and held there by the stack.</p>
<p>Last, the border is sealed with <dfn>polyimide</dfn> tape. (We leave the tape out of the figure and the cross-section,
so the five main layers are easier to see.) Polyimide is the tough, amber plastic that the FPCs
are made of, so the tape is thin, strong and flexible like the sensor itself. The guide's reason is simple: it makes
the pad <i>"more robust so it lasts longer in real experiments"</i>.</p>
<p><b>How thick is it all?</b> The paper says the whole pad is <b>under ${LIMIT} mm</b>. The FPCs and Velostat give
${FPC} + ${VELO} + ${FPC} = <b>${mm(CORE)}</b>. The sources give no thickness for the laminating sheets or the tape.
We can still say one thing for sure: together, the two laminating sheets and the edge tape must be thinner than ${LIMIT} − ${mm(CORE)} =
<b>${mm(LIMIT - CORE)}</b>.</p>
<p class="aside">The cross-section in step 4 draws the layers much thicker than they are, so you can see them. At true
scale, next to the pad's ${AREA[0]} mm width, the whole sandwich would be a thin sliver.</p>`,
  specs: [
    fact("pad.layers", "Layers", { value: () => "5 + edge tape", note: "Laminate, Top FPC, Velostat, Bottom FPC, laminate; polyimide tape seals the edges" }),
    fact("pad.thickness", "Whole pad", { value: () => `< ${LIMIT} mm` }),
    fact("fpc_top.thickness", "Top FPC", { note: `${ROWS} sense lines, mounted copper-down` }),
    fact("fpc_bot.thickness", "Bottom FPC", { note: `${COLS} drive lines, copper-up` }),
    fact("velostat.thickness", "Velostat", { note: "Adafruit 1361, 4 mil" }),
    fact("velostat.volumeResistivity", "Velostat resistivity", { note: "Pressing lowers its resistance" }),
    fact("stack.lam_top.thickness", "Laminating sheet", { value: () => "not given", note: "Each FPC is stuck to one (guide step 1)" }),
    fact("stack.pi_top.thickness", "Polyimide tape", { value: () => "not given", note: "Seals the border (guide step 3); not drawn" }),
    fact("fpc_top.copperSide", "FPC copper", { value: () => "one side only", note: "The other copper layer in the files is empty" }),
    fact("fpc_top.mounting", "Top FPC mounting", { value: () => "copper-down", note: "So both copper faces touch the Velostat" }),
    { label: "FPC build", value: `${BUILD.copper} Cu · ENIG`, src: BUILD.src, note: `Polyimide ${BUILD.dielectric_um} µm, coverlay ${BUILD.coverlay}` },
  ],
  // "One touch spot" was added in front of the four old steps; then the old steps 2-5 (five layers, copper faces in,
  // stick and align, seal the edges) gave way to "Four touch spots" and "The whole pad" (saved progress past "One touch
  // spot" drops to it); then "Squeeze the Velostat" (lesson 1's old step 3) came in front as step 1 (a saved count moves
  // up by one). src/state/store.ts migrateSteps.
  stepsAdded: [0, { keep: 1 }, 0],
  steps: [
    {
      title: "Squeeze the Velostat",
      // keep it to 3 lines in the text column at 1366-1440 px windows, like the other steps: the bar takes its longest
      // step's height
      text: `<b>Velostat</b> is black plastic filled with carbon, ${nb(`${VELO} mm`)} thin. Squeeze it: the carbon grains crowd together, current finds more paths and the resistance drops. It is <i>piezoresistive</i>.`,
      // the lesson opens here (figure.initial is this pose): the pad taken apart, no ring, the Velostat labelled (the
      // label sits left of the pad)
      start: true,
      act: [{ name: "deselect" }, { name: "focus", arg: null }, { name: "iso" }, { name: "explode" }, { name: "select", arg: "velostat" }],
      // the press -> resistance card beside the pad (src/widgets/velostat-demo.ts), illustrative
      demo: "velostat",
    },
    {
      title: "One touch spot",
      // keep it to 3 lines in a 406-460 px text column (1366-1440 px windows), like the other steps: the bar takes its
      // longest step's height
      // (R1 is the card's name for the resistor; its circuit, wired as the board is: 5 V -> the bottom strip -> the touch
      // spot -> the top strip -> A0 -> R1 -> GND)
      text: `Top strip over bottom strip, Velostat between: one touch spot. Bottom strip at 5&nbsp;V, top strip to R1 (${nb(fmtR(R1))}). Press: its resistance falls, so the voltage on R1 rises, ≈${V_REST} → ${nb(`${V_HARD} V`)} <span class="badge badge-illustrative">illustrative</span>.`,
      // the pad closes, the ring on one crossing
      act: [{ name: "deselect" }, { name: "collapse" }, { name: "iso" }, { name: "focus", arg: ONE }],
      // the unit card beside the pad: the crossing in 3D, wired with R1 to 5 V and a voltmeter, pressed in a loop
      // (src/widgets/unit-demo.ts)
      demo: "unit",
    },
    {
      title: "Four touch spots",
      text: "Two top lines over two bottom lines: four touch spots. Listen to one top line, power one bottom line at a time: each reading is the one spot where they cross.",
      // the ring grows around a 2 × 2 block (sense lines 6-7 × drive lines 16-17); the grid card reads it one crossing at
      // a time (src/widgets/grid-demo.ts), and the figure marks the crossing it reads and the pressed ones (act scan,
      // sent by src/ui/demo.ts)
      act: [{ name: "deselect" }, { name: "collapse" }, { name: "iso" }, { name: "focus", arg: FOUR }],
      demo: "grid",
    },
    {
      title: "The whole pad: 12 × 32",
      text: `The same rule ${ROWS} × ${COLS} times: ${TAXELS} touch spots, one reading each, ${HZ} pictures a second. Under the scan, a cut through the layers: ${nb(`${FPC} mm`)} FPCs, ${nb(`${VELO} mm`)} Velostat, under ${nb(`${LIMIT} mm`)} in all.`,
      // the pad taken apart, no ring: the Top FPC's sense lines and the Bottom FPC's drive lines both show, and the figure
      // lights the two the pad card reads (act scan). The card's band is reserved by src/ui/demo.ts (BESIDE_ROOM).
      act: [{ name: "deselect" }, { name: "focus", arg: null }, { name: "iso" }, { name: "explode" }],
      demo: "pad",
    },
  ],
  // (saved answers are kept by question index, src/ui/quiz.ts: a new question goes at the END, so the answers saved
  // for the questions before it still meet the same questions; the last one came from lesson 1 with the Velostat step)
  quiz: [
    {
      q: "Which layers have a thickness given in the sources?",
      choices: ["All five", "The two FPCs and the Velostat", "Only the laminating sheets", "None of them"],
      answer: 1,
      why: `The FPCs are ${FPC} mm each (from the FPC order in the guide) and the Velostat is ${VELO} mm (Adafruit 1361). The laminating sheets and tape have no thickness in the materials.`,
    },
    {
      q: "Why is the Top FPC mounted copper-down?",
      choices: [
        "To protect the copper from your finger",
        "Its copper is on one side only, and that side has to touch the Velostat",
        "So the laminating sheet sticks better",
        "It isn't; both FPCs face up",
      ],
      answer: 1,
      why: "Current must flow copper → Velostat → copper at each crossing. With copper on one side only, both FPCs must face the Velostat, so the top one is flipped. (Worked out from the files, so it's marked inferred.)",
    },
    {
      q: "What do the laminating sheets and polyimide tape do?",
      choices: ["They sense the pressure", "They carry the drive lines", "They hold the layers flat, aligned and sealed", "They make the pad stiff"],
      answer: 2,
      why: "They carry no current. They keep the FPCs flat and lined up, press the copper against the Velostat, and seal the edges so the pad survives use.",
    },
    {
      q: `The paper says the pad is under ${LIMIT} mm. The FPCs and Velostat make ${mm(CORE)}. What follows for the laminating sheets and the edge tape together?`,
      choices: [`Exactly ${mm(LIMIT - CORE)}`, `Less than ${mm(LIMIT - CORE)}`, `More than ${mm(LIMIT - CORE)}`, "Nothing at all"],
      answer: 1,
      why: `${LIMIT} − ${mm(CORE)} leaves less than ${mm(LIMIT - CORE)} for two laminating sheets and two strips of tape. That's a bound, not a measurement.`,
    },
    {
      q: "In the 2 × 2, the board listens to S2 and powers D1. Which touch spot does that reading tell you about?",
      choices: ["All four at once", "The spot where S2 crosses D1", "Every spot along S2", "The spot where S1 crosses D2"],
      answer: 1,
      why: "Only D1 is at 5 V (D2 is held at 0 V) and only S2 is connected to the meter, so current can reach S2 only through the Velostat at the one spot where it crosses D1. Four readings like this make one picture of the 2 × 2.",
    },
    {
      q: "You press harder on the Velostat. What happens to its resistance?",
      choices: ["It goes up", "It goes down", "It stays the same"],
      answer: 1,
      why: "Velostat is piezoresistive: squeezing it lowers its resistance, so more current flows through that crossing.",
    },
  ],
};
