// Lesson 2.2: chips and connectors (2026-11-09, PLAN-section2-basics.md). Lesson 2.1 read one FSR through one analog pin
// and ended on a question: how can one A0 read the pad's 384 crossings? The pad's grid already lets the board read one
// crossing at a time (Lesson 1.2); two kinds of chip do the switching: the multiplexer picks the sense line A0 listens
// to, the shift registers power one drive line at a time (the "pick one" and "drive" boxes of Lesson 1.2's cards). Then
// the parts that carry the pad's 44 lines to the board: the tails' gold fingers, the FFC extender, the flat flexible
// cable (FFC) and its ZIF socket, and where else each is used. Lesson 2.3 puts all of these on the reading board; 2.4
// runs the scan.
// Stage: the chips-lab widget (src/widgets/chips-lab.ts), no figure: one flat drawing per step (widgetView {view}) with
// a card beside it (the wiring to the Nano, or where else the part is used and a photo from the hardware guide).
// Numbers: the shared data (constants, sources.json facts, stack.json's order options); the chips' and the sockets'
// datasheet facts are external, with their URLs (the research of 2026-11-09). The FSR in the drawing is Lesson 2.1's
// model (src/widgets/bench/fsr.ts). FPC1's part number is left out on purpose: its BOM line names one part and its LCSC
// code another (the board was assembled with the LCSC one).
// The sketch on the code card runs on the reading board's pins: one clock a loop, a 1 every 32nd loop, so one drive
// line is HIGH at a time across the chain of four (as the board's firmware does), slow enough to watch.
import { COLS, MUX_OFFSET, R1, ROWS } from "@shared/data/constants.mjs";
import { stack } from "@shared/data/index.mjs";
import { adcCode } from "@shared/models/adc.mjs";
import { R_ON, vA0 } from "@shared/models/divider.mjs";
import { fact, getFact } from "../content/facts";
import type { Lesson } from "../types";
import { FSR_SRC, PRESS_N, R_PRESSED } from "../widgets/chips/press";

const TAXELS = ROWS * COLS;
const LINES = ROWS + COLS;
const LAST = MUX_OFFSET + ROWS - 1; // the last mux channel in use
const CHIPS = COLS / 8; // a 74HC595 has 8 outputs
const CHIPS_W = ["one", "two", "three", "four", "five", "six"][CHIPS - 1] ?? String(CHIPS); // (in prose)
const KOHM = `${R1 / 1000}&nbsp;kΩ`;
const NF_T = getFact("fpc_top.fingers.count").value as number;
const NF_B = getFact("fpc_bot.fingers.count").value as number;
const FW = (getFact("fpc_top.fingers.size").value as [number, number])[0];
const PITCH = getFact("fpc_top.fingers.pitch").value as number;
const FPC_T = getFact("fpc_top.thickness").value as number;
const THICK = stack.fpcBuild.goldFingerThickness;
const nb = (t: string) => t.replace(/ /g, "&nbsp;");
const WALK_MS = 500; // the sketch's delay per loop: one drive line along every half second
// outside the FlexiTac materials (scratchpad research external-facts.md, 2026-11-09)
const HIROSE = "https://www.hirose.com/api/v1/series/FH12/documents/product_series_catalog/content?lang=EN";
const TI_4067 = "https://www.ti.com/lit/ds/symlink/cd74hc4067.pdf";
const LCSC_FPC2 = "https://www.lcsc.com/product-detail/C283153.html";
const PHOTO = "material/FlexiTac Hardware Guide.docx";
// the pressed FSR of the drawing: Lesson 2.1's light press; the switch's resistance takes a few counts off A0
const R_FSR_K = Math.round(R_PRESSED / 100) / 10;
const A0_HERE = adcCode(vA0(R_PRESSED, { rOn: R_ON }));
const A0_BENCH = adcCode(vA0(R_PRESSED, { rOn: 0 })); // Lesson 2.1's bench: no switch

export const lesson: Lesson = {
  id: "chips-and-connectors",
  n: 8,
  title: "Chips and connectors",
  kicker: "The basics",
  lede: `Two kinds of small chip let one analog pin read all ${TAXELS} crossings, one at a time. Gold fingers, a flat cable and its socket carry the pad's ${LINES} lines to the board.`,
  status: "ready",
  features: [
    { icon: "mux", title: "Multiplexer", text: "A 16-way switch: four pins pick what A0 hears" },
    { icon: "shift", title: "Shift register", text: "Eight boxes that pass a 1 along, one output at a time" },
    { icon: "gold", title: "Fingers, cable, socket", text: `Carry the pad's ${LINES} lines to the board` },
  ],
  widget: "chips-lab",
  overview: `
<p>Lesson 2.1 ended on a problem. The pad has ${TAXELS} crossings, each a tiny force sensor, and the Nano has only 8
analog pins. The pad's wiring already helps. Its ${ROWS} sense lines and ${COLS} drive lines meet at every crossing, so the
board can power one drive line, listen to one sense line and read the one crossing where they meet (Lesson 1.2). Then it
moves on to the next, fast enough to read the whole pad many times a second.</p>

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

<p>The rest of the lesson is the path from the pad to the board, ${LINES} lines in all. Each FPC ends in a tail with a
row of <dfn>gold fingers</dfn>: bare contacts plated with gold, which does not tarnish, so they keep a clean contact. The
Top FPC has ${NF_T}, the Bottom FPC ${NF_B}, each ${FW} mm wide, their centres ${PITCH} mm apart. A <dfn>stiffener</dfn>
glued behind them brings the ${FPC_T} mm film to ${THICK} mm, the thickness a socket expects. Memory sticks, graphics cards
and game cartridges plug in the same way.</p>

<p>Each tail plugs into a small extender, a tiny board with a socket on each side, as in Lesson 1.5. From its other side
a <dfn>flat flexible cable</dfn> (FFC) runs on to the reading board, so the board can sit away from the pad. The cable is
flat copper strips side by side in plastic film, bare at the ends, with a stiffener behind each end. Laptops, cameras and
printers use the same cables inside.</p>

<p>On the board, each cable plugs into a <dfn>ZIF connector</dfn>. ZIF stands for zero insertion force: you lift the
latch, slide the cable in with no force against the contacts, and press the latch down, so springs inside press onto the
bare contacts. The contacts must face the springs. A cable turned over goes in just as easily and connects nothing. The
board's two sockets are labelled FPC1, for the Top FPC's ${ROWS} sense lines, and FPC2, for the Bottom FPC's ${COLS}
drive lines.</p>

<p>Lesson 2.3 puts the Nano, these two kinds of chip and two of these sockets on one small board, and follows that board
from a drawing to a factory.</p>`,
  wiring: {
    intro: "How the Nano drives the two kinds of chip on the reading board, and how the pad's lines reach them. Pins are named as the chip makers name them: SER is DATA, SRCLK the clock and RCLK the latch. A # before or after a name marks an active-LOW pin. U2–U5 are the four shift registers and U6 the multiplexer, as printed on the board. Lesson 2.3 has every connection.",
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
      { from: `Pad tails (${NF_T} and ${NF_B} gold fingers)`, to: "FFC extenders, then flat cables to FPC1 and FPC2", note: `${PITCH} mm pitch all the way.` },
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
      "<code>analogRead(A0)</code> then reads whichever line the multiplexer picked, 0 to 1023, as in Lesson 2.1. Press <b>Run</b>: the multiplexer in step 1's drawing turns to the same channel, and the console shows what the Serial Monitor would print.",
      "<code>clockOnce()</code> sends one pulse on D3: HIGH, then LOW. The moment D3 goes HIGH, called a <dfn>rising edge</dfn>, every bit moves one box along. On the reading board D3 also drives the latch, so each pulse latches too (Lesson 2.4 shows what that changes).",
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
    fact("fpc_top.fingers.count", "Top FPC fingers", { note: "One per sense line" }),
    fact("fpc_bot.fingers.count", "Bottom FPC fingers", { note: "One per drive line" }),
    fact("fpc_top.fingers.size", "Finger size", { note: "Width × length, the same on both tails" }),
    fact("fpc_top.fingers.pitch", "Finger pitch", { note: "Centre to centre" }),
    { label: "Thickness at the fingers", value: `${THICK} mm`, src: stack.fpcBuild.src, note: `The ${FPC_T} mm FPC with its stiffener (an order option)` },
    fact("board.part.FPC2", "FPC2 socket", { value: (v) => `${v.mpn} · 32 pins`, note: `The ${COLS} drive lines` }),
    { label: "FPC2 type", value: "0.5 mm pitch · flip-top latch · bottom contacts", src: `${LCSC_FPC2} (THD0515-32CL-SN)`, badge: "external", note: "Takes a 0.3 mm thick cable" },
    { label: "FPC1 socket", value: "16 pins · 0.5 mm pitch", src: getFact("board.part.FPC1").src, badge: "inferred", note: `The ${ROWS} sense lines, on pins ${MUX_OFFSET + 1}–${LAST + 1}; a flip-top latch like FPC2's (board photo)` },
    { label: "Flat cable at the contacts", value: "0.3 mm thick · 0.5 mm pitch", src: `${LCSC_FPC2}; ${HIROSE}`, badge: "external", note: "What the board's sockets take (LCSC C283153; Hirose FH12 is the same, 0.3 ± 0.05 mm)" },
    { label: "Cable type", value: "Contacts on the same side at both ends", src: `${PHOTO} image 32 (the blue stiffeners sit on one face at both ends)`, badge: "inferred", note: "Called Type A" },
    { label: "Rated life of a common ZIF socket", value: "about 20 insertions", src: HIROSE, badge: "external", note: "Hirose FH12 (0.5 mm). The board's own sockets have no rating in the materials: unplug gently and not too often" },
    { label: "FSR in the drawing", value: `${R_FSR_K} kΩ pressed (${PRESS_N} N) · open when not`, src: FSR_SRC, badge: "illustrative", note: `Lesson 2.1's light press, from Adafruit's table. A0 reads ${A0_HERE} here and ${A0_BENCH} on Lesson 2.1's bench: the switch's ${R_ON} Ω takes ${A0_BENCH - A0_HERE} off` },
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
      title: "Gold fingers",
      text: `Each tail ends in a row of gold contacts, one per line: ${NF_T} on the Top FPC, ${NF_B} on the Bottom FPC, one every ${nb(`${PITCH} mm`)}. Click a finger to see it up close. Memory sticks plug in the same way.`,
      widgetView: { view: "fingers" },
    },
    {
      title: "Flat cables and their sockets",
      text: "Lift the latch, slide the cable in and press the latch down, and the springs press on its bare contacts. Then turn the cable over and try again. Its contacts face away, and nothing connects.",
      widgetView: { view: "ffc" },
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
      q: "A flat cable is fully in and latched, but the board reads nothing on those lines. What do you check first?",
      choices: ["That its bare contacts face the socket's springs", "That the cable is long enough", "That the latch is still open", "That the Nano gets 5 V"],
      answer: 0,
      why: "A cable turned over slides in just as easily, but its bare contacts face away from the springs, so no line connects. Lift the latch, turn the cable over and press the latch down again.",
    },
  ],
};
