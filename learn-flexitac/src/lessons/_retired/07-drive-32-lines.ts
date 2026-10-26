// Lesson 4: the 74HC595 chain. Facts from shared/data/sources.json, behaviour from the firmware port
// (@shared/models/scan.mjs = PyFlexiTac template.ino), widget: clock-stepper.
import { COLS, FRAME_HZ, ROWS } from "@shared/data/constants.mjs";
import { driveLineInfo } from "@shared/models/scan.mjs";
import { fact } from "../../content/facts";
import type { Lesson } from "../../types";

const TAXELS = ROWS * COLS;
const WIRES = ROWS + COLS;
const CHIPS = COLS / 8; // a 74HC595 has 8 outputs
const PER_ROW = COLS + 2; // shiftColumn(true) + shiftColumn(false), then one per drive line
const ASK = 20; // the drive line asked about in the quiz (1-based)
const askChip = driveLineInfo(ASK - 1).chip;
const chipChoices = [0, 1, 2, 3].map((g) => driveLineInfo(g * 8).chip);

export const lesson: Lesson = {
  id: "drive-32-lines",
  n: 4,
  title: "Driving 32 lines with 2 pins",
  kicker: "The board",
  lede: `${CHIPS} chained <b>74HC595</b> shift registers turn two Arduino pins into <b>${COLS}</b> outputs. Exactly one drive line is HIGH at a time; the other <b>${COLS - 1}</b> are held LOW.`,
  status: "ready",
  features: [
    { icon: "shift", title: `${CHIPS} × 74HC595`, text: "Chained: each chip passes its last bit to the next" },
    { icon: "clock", title: "Tied clocks", text: "One pin clocks both stages, so the outputs run one clock behind" },
    { icon: "bolt", title: `${COLS - 1} lines held LOW`, text: "#OE is wired to ground, so every output is always driven" },
  ],
  figure: {
    fig: "board",
    initial: [{ name: "reset" }],
    reset: [{ name: "reset" }, { name: "lower" }],
  },
  widget: "clock-stepper",
  overview: `
<p><b>The big idea: take turns.</b> The pad has ${TAXELS} taxels but only ${WIRES} wires (${COLS} drive lines + ${ROWS} sense
lines). Giving every taxel its own wire would need ${TAXELS}. Instead the board powers <i>one</i> drive line, listens to
<i>one</i> sense line, and reads the single crossing where they meet. Then it moves on to the next crossing, and the
next, until all ${TAXELS} have had a turn, ${FRAME_HZ} times a second. Sharing wires by taking turns like this is called
<dfn title="sharing a few wires among many signals by using them one after another, very quickly">time-multiplexing</dfn>.</p>
<p>This lesson is about the first half: choosing which drive line gets power. The Arduino Nano doesn't have ${COLS} spare
pins, and it doesn't need them. Two pins do the job: <b>D2</b> (data) and <b>D3</b> (clock).</p>
<p><b>A <a href="#/glossary/shift-register"><dfn>shift register</dfn></a> is a bucket brigade for bits.</b> A 74HC595
has 8 boxes in a row, each holding a 0 or a 1. Every time its clock pin goes from LOW to HIGH (a
<dfn title="the moment a signal switches from LOW to HIGH">rising edge</dfn>, one "tick"), every bit moves one box
along and the first box takes whatever is on the data pin. A second row, the
<dfn title="a copy of the shift boxes that drives the output pins">output latch</dfn>, copies the boxes onto 8 output
pins, labelled QA to QH.</p>
<p><b>Four chips make one row of ${COLS}.</b> The last box of U2 spills into U3 (its pin QH′ feeds U3's data input),
U3 into U4, U4 into U5. Drive line 1 is U2's QA; drive line ${COLS} is U5's QH. The firmware puts a single 1 in
(<code>shiftColumn(true)</code>), then clocks in 0s (<code>shiftColumn(false)</code>): the lonely 1 walks along the
${COLS} drive lines, one line per clock.</p>
<p><b>Why two clocks before the first reading?</b> On this board D3 is wired to <i>both</i> clock pins of every chip:
the shift clock (SRCLK) and the latch clock (RCLK). On one rising edge the latch copies the boxes as they were
<i>just before</i> they shifted. So the outputs always show what the boxes held one clock earlier. The first
<code>shiftColumn(true)</code> puts the 1 in the boxes, but no drive line lights up; the second clock makes it appear on
drive line 1. That's why each sense line costs ${PER_ROW} clocks: 2 to start, then 1 per drive line. Watch the
<i>outputs</i> row and the <i>shift stage</i> dots in the stepper: the dots are always one step ahead.</p>
<p><b>The other ${COLS - 1} lines are held LOW, not left loose.</b> The chips' <i>output enable</i> pin, #OE, is wired to
ground. The <code>#</code> means the pin is <dfn title="the pin does its job when it is LOW (0 V), not HIGH">active LOW</dfn>:
LOW means "outputs on". So every output is always driving: the chosen line sits at 5 V and the rest are pulled
firmly to 0 V instead of floating.</p>
<p>That matters when you press several spots at once. Current can sneak from the powered line through one pressed
taxel, along another line, and through more pressed taxels, so a crossing nobody touched looks pressed. This is
called <dfn title="a false reading at a crossing nobody pressed, caused by current sneaking through other pressed taxels">ghosting</dfn>.
Holding the unused drive lines at 0 V drains much of that sneak current to ground before it reaches A0. It limits
ghosting but doesn't remove it, and it can pull a reading down when other taxels on the same sense line are
pressed. A later lesson looks at this properly.</p>
<p class="aside">Try the stepper under the figure: <b>Clock</b> moves one D3 tick, <b>Step</b> shows every smaller step
of the firmware. The figure follows along.</p>`,
  wiring: {
    intro: "Two Nano pins fan out to all 32 drive lines. All of this comes from the board schematic and its copper traces.",
    rows: [
      { from: "Nano D2", to: "U2 SER (data in)", note: "HIGH for one clock at the start of each sense line, LOW otherwise." },
      { from: "Nano D3", to: "SRCLK + RCLK of U2–U5", note: "One wire, both clocks, all four chips: the outputs lag the shift stage by one clock." },
      { from: "U2 QH′ → U3 SER → U4 → U5", to: "the next chip's data in", note: "The chain: 4 × 8 boxes act as one row of 32. U5's QH′ is not connected." },
      ...[0, 1, 2, 3].map((g) => {
        const a = driveLineInfo(g * 8);
        const b = driveLineInfo(g * 8 + 7);
        return { from: `${a.chip} QA–QH`, to: `Drive lines ${g * 8 + 1}–${g * 8 + 8} (${a.net}–${b.net})`, note: `FPC2 pins ${a.fpc2Pin}–${b.fpc2Pin}.` };
      }),
      { from: "#OE of U2–U5", to: "GND", note: "Outputs always on: the selected line is HIGH, the other 31 are driven LOW." },
      { from: "FPC2 (32-pin)", to: "Bottom FPC drive lines", note: "Flat cable. Which copper line lands on which pin assumes a straight-through cable.", badge: "inferred" },
    ],
    foot: "Chips are numbered as on the board (U2–U5). <code>QH′</code> is the 595's serial output: the bit falling off its last box.",
  },
  code: {
    lang: "cpp",
    caption: "C++ · Arduino · from PyFlexiTac template.ino",
    source: `void shiftColumn(boolean is_first) {
  if (is_first) SET_SR_DATA_HIGH(); // D2
  SET_SR_CLK_HIGH();  // D3 rising edge:
  SET_SR_CLK_LOW();   //   shift + latch
  if (is_first) SET_SR_DATA_LOW();
}

// light drive line j+1 (j = {{line}}, 0-${COLS - 1}):
shiftColumn(true);    // a 1 enters U2
shiftColumn(false);   // latch: drive line 1 HIGH
for (int j = 0; j < {{line}}; j++)
  shiftColumn(false); // walk the 1 along`,
    params: [{ name: "line", label: "j (drive line j+1)", min: 0, max: COLS - 1, step: 1, value: 5 }],
    notes: [
      "<code>SET_SR_DATA_HIGH()</code> and friends are one-line macros that flip a single bit of the Nano's port D register (<code>PORTD |= B00000100</code> is D2). That is much faster than <code>digitalWrite</code>, which matters when it runs thousands of times a frame.",
      "One call is one rising edge on D3. With <code>is_first</code> true, D2 is HIGH during that edge, so a 1 goes into the first box.",
      "Because the shift clock and latch clock share D3, the outputs show the boxes one clock late. That's why it takes two calls before drive line 1 (<code>j = 0</code>) is HIGH.",
      `The lines after the function are not in the real firmware: they're a recipe to light drive line <code>j</code> + 1. The real loop (lesson 6) reads A0 before every <code>shiftColumn(false)</code>.`,
      "Change <code>j</code> and press <b>Run</b>: the stepper runs the scan until that drive line is HIGH, and the figure follows.",
    ],
  },
  specs: [
    fact("sensor.cols", "Drive lines", { note: "Bottom FPC, one HIGH at a time" }),
    fact("board.part.U2", "Shift registers", { value: (v) => `${CHIPS} × ${v.mpn} (U2–U5)`, note: "74HC595: 8-bit shift register with output latch" }),
    fact("board.595chain", "Chain"),
    fact("board.clockTie", "Clocks"),
    fact("board.OE", "Output enable"),
    { label: "Nano pins used", value: "2 (D2 data, D3 clock)", src: "material/tactile_reading_board_32x16.pdf" },
    { label: "Clocks per sense line", value: `${PER_ROW}`, src: "computed from refs/fw/pyflexitac/template.ino", note: "2 to load and latch the 1, then one per drive line" },
    { label: "Wires for all taxels", value: `${WIRES} for ${TAXELS}`, src: "computed from sensor.rows + sensor.cols", note: "One wire per taxel would need one per crossing" },
  ],
  steps: [
    {
      title: "Meet the chain",
      text: `Four 74HC595s, U2 to U5, drive the ${COLS} lines. U4 and U5 hide under the Nano, so lift it. Right now every drive line is LOW.`,
      act: [{ name: "reset" }, { name: "lift" }],
    },
    {
      title: "Load a 1",
      text: "One clock on D3 while D2 is HIGH: a 1 enters U2's first box. Look at the stepper: a dot appears in the shift stage, but no drive line lights up. The outputs are one clock behind.",
      act: { name: "clock" },
    },
    {
      title: "Latch it",
      text: "A second clock, with D2 LOW. The outputs catch up: drive line 1 goes HIGH. Now the board can read the first crossing.",
      act: { name: "clock" },
    },
    {
      title: "Walk the 1",
      text: `Let it run slowly. Every clock moves the 1 one line along, through U2, U3, U4 and U5. After drive line ${COLS} it falls off the end, and the next sense line starts over.`,
      act: { name: "play", arg: 2e-4 },
    },
  ],
  quiz: [
    {
      q: "Why does the firmware call shiftColumn twice before the first reading of every sense line?",
      choices: [
        "The chips need a warm-up clock after power-on",
        "D3 drives both clocks, so the outputs show the shift stage one clock late",
        "One call per pair of shift registers",
        "The first call sends the header byte",
      ],
      answer: 1,
      why: "The shift clock and the latch clock share D3. The latch copies the boxes from just before each shift, so the 1 that enters on the first clock only reaches drive line 1 on the second.",
    },
    {
      q: "While one drive line is HIGH, what are the other 31 doing?",
      choices: ["Floating, connected to nothing", "Held LOW at 0 V, because #OE is tied to ground", "Also HIGH, but weaker", "Switched off by the multiplexer"],
      answer: 1,
      why: "#OE is active LOW and wired to ground, so all 32 outputs are always driven. The unchosen ones sit firmly at 0 V, which drains sneak currents and limits ghosting.",
    },
    {
      q: `How many Arduino pins does it take to drive all ${COLS} drive lines?`,
      choices: [String(COLS), "8", String(CHIPS), "2"],
      answer: 3,
      why: "Just D2 (data) and D3 (clock). The chained shift registers turn a stream of bits on those two pins into 32 outputs.",
    },
    {
      q: `Drive line ${ASK} (counting from 1) comes from which chip?`,
      choices: chipChoices,
      answer: chipChoices.indexOf(askChip),
      why: `Each chip has 8 outputs: U2 drives lines 1–8, U3 9–16, U4 17–24 and U5 25–32. Line ${ASK} is output ${driveLineInfo(ASK - 1).q} of ${askChip}.`,
    },
  ],
};
