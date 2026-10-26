// RETIRED 2026-10-25: lesson 3 became "Meet the reading board" (src/lessons/07-meet-the-board.ts) and the scanning
// moved into lesson 4 "One frame"; old links and saved progress go there (src/state/store.ts MOVED, migrateIds).
// Lesson 3: pick one crossing. Two Nano pins and four chained 74HC595s power ONE drive line; four pins and the
// CD74HC4067 multiplexer connect ONE sense line to A0, which reads the crossing where they meet; then the board moves on,
// one sense line at a time (row by row). Lesson 2's rule (listen to one top line, power one bottom line), now in chips.
// It merges the old lessons "Driving 32 lines with 2 pins" (drive-32-lines) and "Listening to 12 lines with one pin"
// (listen-12-lines), now in src/lessons/_retired/; saved progress moves here (src/state/store.ts migrateIds).
// Facts from shared/data/sources.json, behaviour from the firmware port (@shared/models/scan.mjs = PyFlexiTac
// template.ino). Figure: Fig 3 (board), the Nano lifted on its long header pins and drawn see-through from step 1 on (its
// own "Lower Nano" button puts it back). Widget: the scan stepper (clock-stepper), plain (a 12 × 32 grid that fills row
// by row) except where a step needs one extra: the outputs and shift stage (steps 2-3), the mux dial (step 4).
import { COLS, MUX_OFFSET, R1, ROWS } from "@shared/data/constants.mjs";
import { driveLineInfo, muxChannelInfo } from "@shared/models/scan.mjs";
import { fact } from "../../content/facts";
import type { Lesson } from "../../types";

const TAXELS = ROWS * COLS;
const WIRES = ROWS + COLS;
const CHIPS = COLS / 8; // a 74HC595 has 8 outputs
const PER_ROW = COLS + 2; // shiftColumn(true) + shiftColumn(false), then one per drive line
const LAST = MUX_OFFSET + ROWS - 1; // the last mux channel in use
const bits = (ch: number) => (ch & 15).toString(2).padStart(4, "0");
const EX = 13; // the worked example channel (step 4's Show me)
const exRow = muxChannelInfo(EX).row as number;
const SLOW = 2e-4; // figure speed for "Walk the 1" and "Both at once": about eight drive lines a second
const FAST = 1e-3; // step 5's Show me: a whole sense line in about a third of a second
const ASK = 20; // the drive line asked about in the quiz (1-based)
const askChip = driveLineInfo(ASK - 1).chip;
const chipChoices = [0, 1, 2, 3].map((g) => driveLineInfo(g * 8).chip);
const Q_ROW = 6; // quiz: sense line i (0-based)
const qCh = Q_ROW + MUX_OFFSET;
const nb = (t: string) => t.replace(/ /g, "&nbsp;");

export const lesson: Lesson = {
  id: "pick-one-crossing",
  n: 3,
  title: "Pick one crossing",
  kicker: "The board",
  lede: `Six Arduino pins pick any one of the <b>${TAXELS}</b> crossings: two pins and four shift registers power one drive line, four pins and a multiplexer connect one sense line to <b>A0</b>, which reads it.`,
  status: "ready",
  features: [
    { icon: "shift", title: `2 pins → ${COLS} drive lines`, text: `${CHIPS} chained 74HC595s walk a single 1 along them` },
    { icon: "mux", title: `4 pins → ${ROWS} sense lines`, text: `A 16-channel multiplexer, channels ${MUX_OFFSET}–${LAST}, to A0` },
    { icon: "grid", title: "Row by row", text: `One sense line, all ${COLS} drive lines, then the next` },
  ],
  figure: {
    fig: "board",
    // the real board first (the Nano seated); step 1 lifts it, and every step after keeps it up
    initial: [{ name: "reset" }],
    reset: [{ name: "reset" }],
  },
  widget: "clock-stepper",
  overview: `
<p><b>Take turns.</b> The pad has ${TAXELS} crossings but only ${WIRES} wires: ${COLS} drive lines and ${ROWS} sense lines.
Lesson 2 gave the rule: power <i>one</i> drive line, listen to <i>one</i> sense line, and the reading belongs to the single
crossing where they meet. Then move on, crossing after crossing, until all ${TAXELS} have had a turn. Sharing a few wires
by taking turns like this is called
<dfn title="sharing a few wires among many signals by using them one after another, very quickly">time-multiplexing</dfn>.
This lesson shows the chips that do it.</p>

<p><b>Power one drive line: a bucket brigade.</b> The Nano has no ${COLS} spare pins, and needs only two: <b>D2</b> (data)
and <b>D3</b> (clock). They feed a <a href="#/glossary/shift-register"><dfn>shift register</dfn></a>, the 74HC595: a row of
8 boxes, each holding a 0 or a 1. Every time the clock pin goes from LOW to HIGH (a
<dfn title="the moment a signal switches from LOW to HIGH">rising edge</dfn>), every bit moves one box along and the first
box takes whatever is on the data pin. A second row, the
<dfn title="a copy of the shift boxes that drives the output pins">output latch</dfn>, copies the boxes onto 8 output pins.
Four chips, U2 to U5, are chained into one row of ${COLS}: drive line 1 is U2's first output, drive line ${COLS} is U5's
last. The firmware puts a single 1 in, then clocks in 0s, so the lonely 1 walks along the drive lines, one line per clock.</p>
<p>Two details. On this board D3 drives both the shift clock and the latch clock, so the outputs always show the boxes
<i>one clock late</i>: the first clock puts the 1 in the boxes, the second makes drive line 1 HIGH. And the chips' output
enable pin, #OE, is wired to ground (the <code>#</code> means
<dfn title="the pin does its job when it is LOW (0 V), not HIGH">active LOW</dfn>, so LOW means "outputs on"): the chosen
line sits at 5 V and the other ${COLS - 1} are held firmly at 0 V, not left floating. That drains much of the current that
could sneak through other pressed crossings and make an untouched one look pressed
(<dfn title="a false reading at a crossing nobody pressed, caused by current sneaking through other pressed taxels">ghosting</dfn>);
it limits ghosting but doesn't remove it.</p>

<p><b>Listen to one sense line: a rotary switch.</b> The Nano measures voltage on an analog pin. Instead of ${ROWS} analog
pins, the board uses a <a href="#/glossary/multiplexer"><dfn>multiplexer</dfn></a> ("mux"), an electronic rotary switch
with 16 inputs, called <dfn title="one of the 16 numbered inputs of the multiplexer">channels</dfn>, and one output, COM,
wired to <b>A0</b> and to the ${R1 / 1000} kΩ resistor of lesson 2's touch spot. Four
<dfn title="the four pins S0–S3 that choose the channel">select pins</dfn>, S0 to S3 on Nano pins D4 to D7, spell the
channel number in binary: S0 is worth 1, S1 2, S2 4 and S3 8. Channel ${EX} = 8 + 4 + 1, so D7 D6 D5 D4 =
<code>${bits(EX)}</code>.</p>
<p><b>Why channels ${MUX_OFFSET}–${LAST}?</b> The chip has 16 channels but the pad has ${ROWS} sense lines, wired to channels
${MUX_OFFSET} to ${LAST}; channels 0–${MUX_OFFSET - 1} are empty. So the firmware adds
<code>MUX_CHANNEL_OFFSET = ${MUX_OFFSET}</code> to the sense line's number, which it counts from 0 (<code>i</code>): sense line 1
is <code>i = 0</code>, channel ${MUX_OFFSET}. The mux's enable pin E# (on D8, active LOW) gets one short HIGH pulse at the
start of every frame and stays LOW the rest of the time.</p>

<p><b>Both at once, row by row.</b> The firmware picks a sense line with D4–D7, then walks the 1 along all ${COLS} drive lines
and reads A0 at each step: ${COLS} crossings, one per clock. Then it picks the next sense line. That is ${PER_ROW} clocks per
sense line (2 to load and latch the 1, then 1 per drive line) and ${TAXELS} readings for the whole pad: one frame, the next
lesson.</p>
<p class="aside">The stepper under the figure shows the same scan as a ${ROWS} × ${COLS} grid, one row per sense line:
<b>Clock</b> moves one D3 tick, <b>Next line</b> picks the next sense line, and the figure follows along.</p>`,
  wiring: {
    intro: "Six Nano pins choose the crossing and A0 reads it. All but the cable mapping come from the board schematic and its copper traces.",
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
      { from: "Nano D4, D5, D6, D7", to: "U6 S0, S1, S2, S3", note: "The channel number in binary; S0 is the 1s bit." },
      { from: "Nano D8", to: "U6 E# (enable, active LOW)", note: "One HIGH pulse per frame, LOW the rest of the time." },
      { from: "FPC1 pin k (16-pin)", to: "U6 channel k − 1", note: `So pins 1–${MUX_OFFSET} (channels 0–${MUX_OFFSET - 1}) carry nothing on this pad.` },
      { from: "U6 COM", to: `Nano A0, plus R1 ${R1 / 1000} kΩ to GND`, note: "The selected sense line's current becomes a voltage at A0." },
      { from: "FPC2 (32-pin) · FPC1 (16-pin)", to: `Bottom FPC drive lines · Top FPC sense lines (FPC1 pins ${MUX_OFFSET + 1}–${LAST + 1})`, note: "Flat cables. Which copper line lands on which pin assumes straight-through cables.", badge: "inferred" },
    ],
    foot: "Chips are numbered as on the board (U2–U6). <code>QH′</code> is the 595's serial output, the bit falling off its last box. Pins count from 1, mux channels from 0, as on the board and in the chips' datasheets.",
  },
  code: {
    lang: "cpp",
    caption: "C++ · Arduino · from PyFlexiTac template.ino (shortened)",
    source: `#define MUX_CHANNEL_OFFSET ${MUX_OFFSET}

void setRow(int i) {          // D4-D7: the channel
  int ch = i + MUX_CHANNEL_OFFSET;
  for (int b = 0; b < 4; b++)  // S0..S3
    digitalWrite(4 + b, bitRead(ch, b));
}

void shiftColumn(boolean is_first) {
  if (is_first) SET_SR_DATA_HIGH(); // D2
  SET_SR_CLK_HIGH();  // D3 rising edge:
  SET_SR_CLK_LOW();   //   shift + latch
  if (is_first) SET_SR_DATA_LOW();
}

// read crossing (i, j): i = {{row}}, j = {{line}}
setRow({{row}});      // listen to sense line i+1
shiftColumn(true);    // a 1 enters U2
shiftColumn(false);   // latch: drive line 1 HIGH
for (int j = 0; j < {{line}}; j++)
  shiftColumn(false); // walk the 1 along
int raw = analogRead(A0);`,
    params: [
      { name: "row", label: "i (sense line i+1)", min: 0, max: ROWS - 1, step: 1, value: 2 },
      { name: "line", label: "j (drive line j+1)", min: 0, max: COLS - 1, step: 1, value: 16 },
    ],
    notes: [
      "<code>setRow(i)</code> writes the channel number <code>i + 4</code> onto D4–D7, one bit per pin: <code>bitRead(ch, b)</code> is bit <code>b</code>, a 0 or a 1. The mux then connects that sense line to A0.",
      `<code>MUX_CHANNEL_OFFSET</code> is ${MUX_OFFSET} because the sense lines sit on channels ${MUX_OFFSET}–${LAST}. With 0 the firmware would read four empty channels and miss the last four sense lines.`,
      "<code>SET_SR_DATA_HIGH()</code> and friends flip one bit of the Nano's port D register (<code>PORTD |= B00000100</code> is D2), much faster than <code>digitalWrite</code>. That matters when it runs thousands of times a frame.",
      "One <code>shiftColumn</code> call is one rising edge on D3. Because the shift clock and the latch clock share D3, the outputs show the boxes one clock late, so it takes two calls before drive line 1 (<code>j = 0</code>) is HIGH.",
      `The lines after the functions are a recipe for ONE crossing, not the real loop: the firmware reads A0 before every <code>shiftColumn(false)</code>, ${COLS} readings per sense line (lesson 4).`,
      "Change <code>i</code> and <code>j</code> and press <b>Run</b>: the stepper runs the scan to that crossing, and the figure follows.",
    ],
  },
  specs: [
    fact("sensor.cols", "Drive lines", { note: "Bottom FPC, one HIGH at a time" }),
    fact("board.part.U2", "Shift registers", { value: (v) => `${CHIPS} × ${v.mpn} (U2–U5)`, note: "74HC595: 8-bit shift register with output latch" }),
    fact("board.595chain", "Chain"),
    fact("board.clockTie", "Clocks"),
    fact("board.OE", "Output enable"),
    fact("sensor.muxChannels", "Channels used", { note: `Sense line n (i = n − 1) → channel i + ${MUX_OFFSET}; channels 0–${MUX_OFFSET - 1} unused` }),
    fact("board.part.U6", "Multiplexer", { value: (v) => `${v.mpn} (U6)`, note: "16 channels to one COM pin" }),
    fact("board.muxSelect", "Select and enable"),
    fact("firmware.enablePulse", "E# pulse"),
    fact("board.A0", "Output"),
    fact("board.FPC1", "Connector FPC1"),
    fact("board.R_on", "Switch resistance", { badge: "external", note: "Small next to the 10 kΩ resistor and the taxel" }),
    { label: "Nano pins used", value: "8: D2, D3 (drive) · D4–D8 (mux) · A0", src: "material/tactile_reading_board_32x16.pdf", note: "2 for the shift registers, 4 select + 1 enable for the multiplexer, 1 analog input" },
    { label: "Clocks per sense line", value: `${PER_ROW}`, src: "computed from refs/fw/pyflexitac/template.ino", note: "2 to load and latch the 1, then one per drive line" },
    { label: "Wires for all taxels", value: `${WIRES} for ${TAXELS}`, src: "computed from sensor.rows + sensor.cols", note: "One wire per taxel would need one per crossing" },
  ],
  steps: [
    {
      title: "Meet the board",
      text: `The Nano rises straight up on its long header pins and turns see-through. Under it: U2–U5, four shift registers for the ${COLS} drive lines; U6, the multiplexer for the ${ROWS} sense lines; FPC2 and FPC1, where the pad plugs in.`,
      act: { name: "lift" },
      // the board gets the whole stage here; the stepper comes in with step 2
      widget: false,
    },
    {
      title: "Power one drive line",
      text: `One clock on D3 with D2 HIGH: a 1 enters U2's first box, but no output lights yet, because the outputs run one clock behind. <b>Show me</b> gives the second clock: drive line 1 goes HIGH, the other ${COLS - 1} stay LOW.`,
      act: { name: "clock" },
      show: [{ name: "clock" }],
      widgetView: { extra: "outputs" },
    },
    {
      title: "Walk the 1",
      text: `Each clock moves the 1 one line along, through U2, U3, U4 and U5: exactly one drive line is HIGH at a time. After drive line ${COLS} it falls off the end.`,
      act: { name: "play", arg: SLOW },
      widgetView: { extra: "outputs" },
    },
    {
      title: "Listen to one sense line",
      text: `D7 D6 D5 D4 = <code>${bits(MUX_OFFSET)}</code>: channel ${MUX_OFFSET}, sense line 1, now wired to A0. Channels 0–${MUX_OFFSET - 1} are not wired, so the scan starts at ${MUX_OFFSET}. <b>Show me</b>: <code>${bits(EX)}</code> = ${nb(`channel ${EX}`)}, sense line ${exRow + 1}.`,
      act: [{ name: "pause" }, { name: "mux", arg: MUX_OFFSET }],
      show: [{ name: "mux", arg: EX }],
      widgetView: { extra: "mux" },
    },
    {
      title: "Both at once: one crossing",
      text: `The mux holds one sense line while the 1 walks all ${COLS} drive lines; at each clock A0 reads the one crossing where they meet. Then the next sense line: row by row, ${TAXELS} crossings. The same rule as lesson 2, now in chips.`,
      act: [{ name: "mux", arg: MUX_OFFSET }, { name: "play", arg: SLOW }],
      show: [{ name: "speed", arg: FAST }],
      widgetView: { extra: null },
    },
  ],
  // two questions from each of the two lessons this one merges (saved answers move with them: src/state/store.ts)
  quiz: [
    {
      q: `How many Arduino pins does it take to drive all ${COLS} drive lines?`,
      choices: [String(COLS), "8", String(CHIPS), "2"],
      answer: 3,
      why: `Just D2 (data) and D3 (clock). The chained shift registers turn a stream of bits on those two pins into ${COLS} outputs.`,
    },
    {
      q: `Drive line ${ASK} (counting from 1) comes from which chip?`,
      choices: chipChoices,
      answer: chipChoices.indexOf(askChip),
      why: `Each chip has 8 outputs: U2 drives lines 1–8, U3 9–16, U4 17–24 and U5 25–32. Line ${ASK} is output ${driveLineInfo(ASK - 1).q} of ${askChip}.`,
    },
    {
      q: `The firmware selects sense line ${Q_ROW + 1} (i = ${Q_ROW}). Which channel is that, and what are D7 D6 D5 D4?`,
      choices: [`channel ${Q_ROW} · ${bits(Q_ROW)}`, `channel ${qCh} · ${bits(qCh)}`, `channel ${qCh} · ${bits(qCh).split("").reverse().join("")}`, `channel ${Q_ROW - MUX_OFFSET} · ${bits(Q_ROW - MUX_OFFSET)}`],
      answer: 1,
      why: `${Q_ROW} + ${MUX_OFFSET} = ${qCh}, which is ${bits(qCh)} in binary. D7 carries S3 (the 8s bit) and D4 carries S0 (the 1s bit), so they read ${bits(qCh)} left to right.`,
    },
    {
      q: `Why does the firmware add ${MUX_OFFSET} to every sense line number?`,
      choices: [
        "The first channels are reserved for the header bytes",
        `The pad's sense lines are wired to channels ${MUX_OFFSET}–${LAST}; 0–${MUX_OFFSET - 1} are empty`,
        "To skip the four shift registers",
        "Low channels are too slow to read",
      ],
      answer: 1,
      why: `The chip has 16 channels and the pad uses ${ROWS} of them, starting at channel ${MUX_OFFSET}. Adding the offset points each sense line at the channel it is actually wired to.`,
    },
  ],
};
