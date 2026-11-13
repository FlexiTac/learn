// Lesson 2.3: two chips that take turns (2026-11-12, PLAN-section2-build.md; split out of the old "Chips and
// connectors", PLAN-section2-basics.md). Lessons 2.1 and 2.2 read one FSR through one analog pin and ended on a question:
// how can one A0 read the pad's 384 crossings? The pad's grid already lets the board read one crossing at a time (Lesson
// 1.2); two kinds of chip do the switching: the multiplexer picks the sense line A0 listens to, the shift registers power
// one drive line at a time (the "pick one" and "drive" boxes of Lesson 1.2's cards). Step 3 puts the two together over a
// 4 x 8 grid of crossings and reads them all, one at a time, into a small map: the scanning idea in its simplest form.
// Lesson 2.4 carries the pad's 44 lines to the board (gold fingers, flat cables, sockets); 2.5 puts the chips and the
// sockets on the reading board; 2.6 runs the scan on a whole frame.
// Stage: the chips-lab widget (src/widgets/chips-lab.ts), no figure: one flat drawing per step (widgetView {view}) with
// a card beside it (the wiring to the Nano, or the map).
// Numbers: the shared data (constants, sources.json facts); the chips' datasheet facts are external, with their URLs
// (the research of 2026-11-09). The FSRs in the drawings are Lesson 2.1's model (src/widgets/bench/fsr.ts, through
// src/widgets/chips/press.ts).
// The sketch on the code card runs on the reading board's pins: one clock a loop, a 1 every 32nd loop, so one drive
// line is HIGH at a time across the chain of four (as the board's firmware does), slow enough to watch.
import { COLS, MUX_OFFSET, R1, ROWS } from "@shared/data/constants.mjs";
import { adcCode } from "@shared/models/adc.mjs";
import { R_ON, vA0 } from "@shared/models/divider.mjs";
import { fact } from "../content/facts";
import type { Lesson } from "../types";
import { FSR_SRC, PRESS_N, R_PRESSED } from "../widgets/chips/press";

const TAXELS = ROWS * COLS;
const LINES = ROWS + COLS;
const LAST = MUX_OFFSET + ROWS - 1; // the last mux channel in use
const CHIPS = COLS / 8; // a 74HC595 has 8 outputs
const CHIPS_W = ["one", "two", "three", "four", "five", "six"][CHIPS - 1] ?? String(CHIPS); // (in prose)
const KOHM = `${R1 / 1000}&nbsp;kΩ`;
const nb = (t: string) => t.replace(/ /g, "&nbsp;");
const WALK_MS = 500; // the sketch's delay per loop: one drive line along every half second
// step 3's grid (src/widgets/chips/together.ts SENSE_N × DRIVE_N): a small piece of the pad's grid
const G_S = 4;
const G_D = 8;
// outside the FlexiTac materials (scratchpad research external-facts.md, 2026-11-09)
const TI_4067 = "https://www.ti.com/lit/ds/symlink/cd74hc4067.pdf";
// the pressed FSR of the drawings: Lesson 2.1's light press; the switch's resistance takes a few counts off A0
const R_FSR_K = Math.round(R_PRESSED / 100) / 10;
const A0_HERE = adcCode(vA0(R_PRESSED, { rOn: R_ON }));
const A0_BENCH = adcCode(vA0(R_PRESSED, { rOn: 0 })); // Lesson 2.1's bench: no switch

export const lesson: Lesson = {
  id: "two-chips",
  n: 9,
  title: "Two chips that take turns",
  kicker: "Chips and connectors",
  lede: `Two kinds of small chip let one analog pin read all ${TAXELS} crossings. One powers a single drive line, the other listens to a single sense line, and they take turns.`,
  status: "ready",
  features: [
    { icon: "mux", title: "Multiplexer", text: "A 16-way switch: four pins pick what A0 hears" },
    { icon: "shift", title: "Shift register", text: "Eight boxes that pass a 1 along, one output at a time" },
    { icon: "grid", title: "Together", text: "One powered line, one picked line, one crossing read" },
  ],
  widget: "chips-lab",
  overview: `
<p>In Lessons 2.1 and 2.2, one force sensor took one analog pin. The Nano has 8, and the pad has ${TAXELS} crossings, each
a tiny force sensor. The pad's wiring already helps. Its ${ROWS} sense lines and ${COLS} drive lines meet at every
crossing, so the board can power one drive line, listen to one sense line and read the one crossing where they meet
(Lesson 1.2). Then it moves on to the next, fast enough to read the whole pad many times a second.</p>

<p>That still leaves ${LINES} lines. The Nano has 8 analog pins for the ${ROWS} sense lines and 14 digital pins for the
${COLS} drive lines, too few for either. Two kinds of cheap chip do the switching. A <dfn>multiplexer</dfn> (mux for
short) picks the sense line that A0 listens to, and <dfn>shift registers</dfn> power one drive line at a time. They are
the “pick one” and “drive” boxes on Lesson 1.2's cards.</p>

<p>The multiplexer is an electronic rotary switch. It has 16 inputs, called <dfn>channels</dfn>, and one common pin, COM,
wired to A0. Lesson 2.1's circuit is still there, with the switch between the FSR and A0. Current from the picked channel
flows through the ${KOHM} pull-down and makes the voltage A0 reads. When that channel carries no current, the pull-down
holds A0 at 0 V.</p>

<p>Four <dfn>select pins</dfn>, S0 to S3, pick the channel. The Nano sets each one HIGH or LOW, a 1 or a 0. Each pin set
to 1 adds its worth to the channel number: S0 adds 1, S1 2, S2 4 and S3 8. Written S3 first, the way we write the
biggest place first, 1101 is 8 + 4 + 0 + 1, channel 13. That way of writing numbers is <dfn>binary</dfn>. One more pin,
E#, is <dfn>active LOW</dfn>: LOW switches the chip on, and HIGH disconnects every channel.</p>

<p>A shift register is a row of eight boxes that each hold one <dfn>bit</dfn>, a 1 or a 0. One pin, DATA, sets the bit
that goes in next. Each time another pin, the <dfn>clock</dfn>, goes from LOW to HIGH, every bit moves one box along and
the new bit drops into the first box. A third pin, the latch, copies all eight boxes at once into a second row of eight,
the <dfn>output latch</dfn>, which drives the eight outputs, QA to QH.</p>

<p>Put in a single 1, keep clocking and latching, and the outputs switch on one at a time. The last box spills into a pin
called QH′, which feeds the next chip, so ${CHIPS_W} chips in a chain act as one row of ${COLS} boxes. On the reading board
the Nano runs all ${CHIPS_W} with two pins. D2 is DATA, and D3 drives the clock and the latch together.</p>

<p>Together, the two kinds of chip read one crossing at a time. The shift registers put 5 V on one drive line and hold
the other ${COLS - 1} at 0 V. The multiplexer connects one sense line to A0. Current can reach A0 only through the crossing
where those two lines meet. Step 1's drawing shows that moment from the multiplexer's side: its +5 V is the powered drive
line, and each FSR is a crossing on it.</p>

<p>Step 3 puts both chips over a small grid, ${G_S} sense lines by ${G_D} drive lines, like Lesson 1.2's 2 × 2 card made
bigger. The walking 1 powers the drive lines one by one, then the multiplexer moves to the next sense line. Each reading
fills one cell of a map, so a press lights exactly one cell. The board reads its ${ROWS} × ${COLS} crossings the same
way.</p>

<p>Lesson 2.4 follows the pad's ${LINES} lines from its two tails to the board: gold fingers, flat cables and their
sockets. Lesson 2.5 then shows these chips on the real reading board, and Lesson 2.6 reads a whole frame.</p>`,
  wiring: {
    intro: "How the Nano drives the two kinds of chip on the reading board. Pins are named as the chip makers name them: SER is DATA, SRCLK the clock and RCLK the latch. A # before or after a name marks an active-LOW pin. U2–U5 are the four shift registers and U6 the multiplexer, as printed on the board. Lesson 2.5 has every connection.",
    rows: [
      { from: "Nano D4, D5, D6, D7", to: "Mux S0, S1, S2, S3", note: "The channel number in binary: S0 is worth 1, S3 is worth 8." },
      { from: "Nano D8", to: "Mux E# (enable)", note: "Active LOW: LOW switches the multiplexer on." },
      { from: "Mux COM", to: `Nano A0, and ${R1 / 1000} kΩ to GND`, note: "Whichever channel is picked reaches A0." },
      { from: `Mux channels ${MUX_OFFSET}–${LAST}`, to: `The ${ROWS} sense lines (FPC1)`, note: `Channels 0–${MUX_OFFSET - 1} carry nothing on this pad.` },
      { from: "Nano D2", to: "U2 SER (DATA)", note: "The bit that goes into the first box." },
      { from: "Nano D3", to: "SRCLK and RCLK of U2–U5", note: "One pin for the clock and the latch: every clock also latches." },
      { from: "QH′ of U2, U3, U4", to: "SER of the next chip", note: `The chain: ${CHIPS} × 8 boxes act as one row of ${COLS}.` },
      { from: "QA–QH of U2–U5", to: `The ${COLS} drive lines (FPC2)`, note: "One output per drive line." },
      { from: "#OE of U2–U5", to: "GND", note: "Active LOW, so the outputs always drive." },
      { from: "#SRCLR of U2–U5", to: "5 V", note: "Active LOW, so the boxes are never cleared." },
    ],
    foot: "Pins count from 1 and mux channels from 0, as on the board.",
  },
  code: {
    lang: "cpp",
    caption: "C++ · Arduino · a sketch to try the two chips",
    source: `// Pick a mux channel and read it; then
// walk a 1 through the shift registers
const int DATA = 2, CLK = 3;   // 74HC595s
// D4-D7 = S0-S3, D8 = E#, A0 = COM

void setChannel(int ch) {
  for (int b = 0; b < 4; b++)  // S0..S3
    digitalWrite(4 + b, bitRead(ch, b));
}

void clockOnce() {   // D3: shift (and latch)
  digitalWrite(CLK, HIGH);  // rising edge
  digitalWrite(CLK, LOW);
}

void setup() {
  Serial.begin(9600);
  for (int p = 2; p <= 8; p++)
    pinMode(p, OUTPUT);  // all LOW: E# on
}

int k = 0;  // clocks since the last 1

void loop() {
  setChannel({{ch}});
  Serial.println(analogRead(A0));
  if (k == 0) digitalWrite(DATA, HIGH);  // a 1
  else digitalWrite(DATA, LOW);          // ${COLS - 1} 0s
  clockOnce();
  k = k + 1;
  if (k == ${COLS}) k = 0;  // ${COLS} boxes: U2-U5
  delay(${WALK_MS});
}`,
    params: [{ name: "ch", label: "setChannel (0–15)", min: 0, max: 15, step: 1, value: 8 }],
    notes: [
      "<code>digitalWrite(pin, HIGH)</code> puts 5 V on a pin, and <code>LOW</code> puts 0 V. In <code>setup()</code>, <code>pinMode(p, OUTPUT)</code> makes D2–D8 outputs. They start LOW, so E# on D8 is LOW and the multiplexer is on.",
      "<code>setChannel(ch)</code> writes the channel number onto D4–D7, one bit per pin. <code>bitRead(ch, b)</code> is bit <code>b</code> of <code>ch</code>, a 0 or a 1: <code>setChannel(13)</code> writes 1, 0, 1, 1 to D4, D5, D6, D7. Read from D7 down to D4, that is 1101.",
      "<code>analogRead(A0)</code> then reads whichever line the multiplexer picked, 0 to 1023, as in Lesson 2.1.",
      "<code>clockOnce()</code> sends one pulse on D3: HIGH, then LOW. The moment D3 goes HIGH, called a <dfn>rising edge</dfn>, every bit moves one box along. On the reading board D3 also drives the latch, so each pulse latches too (Lesson 2.6 shows what that changes).",
      `Each loop reads A0 once and clocks once. Only every ${COLS}nd loop puts in a 1, so a single 1 walks along all ${COLS} outputs of the ${CHIPS_W} chips, one drive line at a time, as on the board. At <code>delay(${WALK_MS})</code> it takes ${(COLS * WALK_MS) / 1000} seconds to cross; LEDs on the outputs would show it walk.`,
    ],
  },
  specs: [
    fact("board.part.U6", "Multiplexer", { value: (v) => `${v.mpn} (U6)`, note: "16 channels and one common pin, COM" }),
    fact("board.muxSelect", "Select and enable", { value: () => "D4–D7 → S0–S3 · D8 → E#" }),
    fact("sensor.muxChannels", "Channels used", { note: `The ${ROWS} sense lines; channels 0–${MUX_OFFSET - 1} are free` }),
    // (the value from the shared data, the source the datasheet itself)
    { ...fact("board.R_on", "Switch resistance", { value: (v) => `≈ ${v} Ω`, note: `Typical at 4.5 V; small next to the ${R1 / 1000} kΩ resistor` }), src: TI_4067, badge: "external" },
    fact("board.part.U2", "Shift registers", { value: (v) => `${CHIPS} × ${v.mpn} (U2–U5)`, note: "8 outputs each; QH′ passes the last bit to the next chip" }),
    fact("board.clockTie", "Clocks", { value: () => "D3 → SRCLK and RCLK of U2–U5", note: "Every clock also latches, so the outputs run one clock behind" }),
    fact("board.OE", "Output enable", { value: () => "#OE → GND", note: `The outputs always drive: the ${COLS - 1} drive lines not picked sit at 0 V` }),
    { label: "FSR in the drawings", value: `${R_FSR_K} kΩ pressed (${PRESS_N} N) · open when not`, src: FSR_SRC, badge: "illustrative", note: `Lesson 2.1's light press, from Adafruit's table. A0 reads ${A0_HERE} here and ${A0_BENCH} on Lesson 2.1's bench: the switch's ${R_ON} Ω takes ${A0_BENCH - A0_HERE} off` },
    { label: "Grid in step 3", value: `${G_S} sense × ${G_D} drive lines`, src: "in-browser model (src/widgets/chips/together.ts)", badge: "illustrative", note: `A small piece of the pad's ${ROWS} × ${COLS}, on ${G_S} of the multiplexer's 16 channels, read in the same order` },
  ],
  steps: [
    {
      title: "A switch that picks one",
      // keep every step text to 3 lines in the text column at 1366-1440 px windows (the bar takes its longest step)
      text: `The multiplexer is a 16-way switch. Click S0–S3, and each 1 adds its worth to the channel. A0 reads an FSR only when it is pressed and its channel is picked. Then try <b>${nb("Read them in turn")}</b>.`,
      start: true,
      widgetView: { view: "mux" },
    },
    {
      title: "Eight boxes in a row",
      text: `Set DATA and press <b>Clock</b>, and every bit moves one box along. <b>Latch</b> copies the boxes down to the outputs. Play the walking 1, then chain four chips for ${COLS} outputs on the same two Nano pins.`,
      widgetView: { view: "shift" },
    },
    {
      title: "Together",
      text: `The shift register powers one drive line and the multiplexer picks one sense line: only their crossing reaches A0. Press a few crossings, then <b>${nb("Read them all")}</b>. Each press lights one cell of the map.`,
      widgetView: { view: "together" },
    },
  ],
  // (saved answers are kept by question index, src/ui/quiz.ts: a new question goes at the END)
  quiz: [
    {
      q: "S3, S2, S1 and S0 are 1, 0, 1, 0. Which channel does the multiplexer pick?",
      choices: ["5", "10", "12", "3"],
      answer: 1,
      why: "Read them as one binary number: S3 is worth 8 and S1 is worth 2, so 1010 is 8 + 2 = 10. S2 (worth 4) and S0 (worth 1) are 0.",
    },
    {
      q: "Only the FSR on channel 8 is pressed, and the select pins pick channel 5. What does A0 read?",
      choices: ["The same as channel 8 would give", "0", "1023", "Half of channel 8's reading"],
      answer: 1,
      why: "A0 hears only the picked channel. Channel 5's FSR is not pressed, so no current reaches A0 and the pull-down holds it at 0 V. Pick channel 8 and the reading comes back.",
    },
    {
      q: "A 74HC595 holds all 0s. DATA is 1 for one clock, then 0 for three more clocks. Which box holds the 1?",
      choices: ["QA", "QC", "QD", "QH"],
      answer: 2,
      why: "The first clock puts the 1 into QA. Each clock after that moves it one box along: QB, QC, QD. A latch would then show it on output QD.",
    },
    {
      q: "The shift register powers drive line 5, and the multiplexer picks sense line 2. Which crossing can A0 read?",
      choices: ["Only the one where drive line 5 meets sense line 2", "Every crossing on drive line 5", "Every crossing on sense line 2", "All of them at once"],
      answer: 0,
      why: "Current comes in on the powered drive line and leaves through the picked sense line. Only one crossing sits on both, so A0 reads that one alone. Then the scan moves on to the next.",
    },
  ],
};
