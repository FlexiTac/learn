// Lesson 5: the CD74HC4067 multiplexer. Facts from shared/data/sources.json, behaviour from the firmware port
// (@shared/models/scan.mjs = PyFlexiTac template.ino), widget: clock-stepper (dial-first layout).
import { COLS, MUX_OFFSET, R1, ROWS } from "@shared/data/constants.mjs";
import { VARIANTS, muxChannelInfo } from "@shared/models/scan.mjs";
import { fact } from "../../content/facts";
import type { Lesson } from "../../types";

const LAST = MUX_OFFSET + ROWS - 1;
const bits = (ch: number) => (ch & 15).toString(2).padStart(4, "0");
const Q_ROW = 6; // quiz: sense line i (0-based)
const qCh = Q_ROW + MUX_OFFSET;
const EX = 13; // worked example channel
const exRow = muxChannelInfo(EX).row as number;
const repo16 = VARIANTS.repo16;

export const lesson: Lesson = {
  id: "listen-12-lines",
  n: 5,
  title: "Listening to 12 lines with one pin",
  kicker: "The board",
  lede: `A 16-channel <b>multiplexer</b> connects one sense line at a time to the Arduino's analog pin <b>A0</b>. The pad's ${ROWS} sense lines sit on channels <b>${MUX_OFFSET}–${LAST}</b>.`,
  status: "ready",
  features: [
    { icon: "mux", title: "CD74HC4067", text: "16 channels in, one out" },
    { icon: "chip", title: "4 select pins", text: "D4–D7 spell the channel number in binary" },
    { icon: "grid", title: `Channels ${MUX_OFFSET}–${LAST}`, text: `Sense line i → channel i + ${MUX_OFFSET}` },
  ],
  figure: {
    fig: "board",
    initial: [{ name: "reset" }],
    reset: [{ name: "reset" }],
  },
  widget: "clock-stepper",
  overview: `
<p>Lesson 4 chose which drive line gets power. Now the other half: which sense line to <i>listen</i> to. The Nano
measures voltage with its <a href="#/glossary/adc">ADC</a> through an analog pin. Instead of using ${ROWS}
analog pins, the board puts a <a href="#/glossary/multiplexer"><dfn>multiplexer</dfn></a> ("mux") in between: an
electronic rotary switch with 16 inputs, called <dfn title="one of the 16 numbered inputs of the multiplexer">channels</dfn>,
and one output, called <b>COM</b>. COM is wired to A0, and to the ${R1 / 1000} kΩ resistor to ground that turns the
taxel's current into a voltage (the voltage divider of lesson 2, step 1).</p>
<p><b>The channel number is written in binary.</b> Four <dfn title="the four pins S0–S3 that choose the channel">select pins</dfn>,
S0 to S3, sit on Nano pins D4 to D7. Each is a 0 or a 1, and together they spell the channel number: S0 is worth 1,
S1 is worth 2, S2 is worth 4, S3 is worth 8. Channel ${EX} = 8 + 4 + 1, so S3 S2 S1 S0 = <code>${bits(EX)}</code>.
Four pins give 2 × 2 × 2 × 2 = 16 channels, 0 to 15.</p>
<p><b>Why channels ${MUX_OFFSET}–${LAST}?</b> The chip has 16 channels, but the pad only has ${ROWS} sense lines, and they
are wired to channels ${MUX_OFFSET} to ${LAST}. Channels 0–${MUX_OFFSET - 1} are left empty. So the firmware adds
<code>MUX_CHANNEL_OFFSET = ${MUX_OFFSET}</code>. The firmware numbers sense lines from 0 (<code>i</code>), so sense line 1 is
<code>i = 0</code> and its channel is <code>i + ${MUX_OFFSET}</code> = ${MUX_OFFSET}. Sense line ${ROWS} (<code>i = ${ROWS - 1}</code>) is channel ${LAST},
and channel ${EX} is sense line ${exRow + 1} (<code>i = ${exRow}</code>).</p>
<p><b>E# switches the whole chip.</b> The mux's enable pin E# (on D8) is active LOW: LOW means on. The firmware gives it
one short HIGH pulse at the start of every frame, then leaves it LOW. The code is written so it can handle boards with
more than one multiplexer, where that pulse would hand over to the next chip. A second enable pin, D9, exists in the
firmware, but it isn't connected on this board.</p>
<p><b>Together:</b> pick a sense line with D4–D7, walk the HIGH along all ${COLS} drive lines (lesson 4), read A0 at each
step, then pick the next sense line. Every reading is one crossing, and the drive line and sense line together say which one.
Lesson 6 puts all ${ROWS} × ${COLS} readings into one frame.</p>
<p class="aside">Click a channel on the stepper's dial, or use <b>Next sense line</b>. Clicking 0–${MUX_OFFSET - 1} shows a
channel the firmware never picks.</p>`,
  wiring: {
    intro: "From the Top FPC's sense lines to one analog pin. All but the cable mapping come from the schematic and copper traces.",
    rows: [
      { from: `Top FPC · ${ROWS} sense lines`, to: `FPC1 pins ${MUX_OFFSET + 1}–${LAST + 1}`, note: "Flat cable. Which copper line lands on which pin assumes a straight-through cable.", badge: "inferred" },
      { from: "FPC1 pin k (16-pin)", to: "U6 CD74HC4067 channel k − 1", note: `So pins 1–${MUX_OFFSET} (channels 0–${MUX_OFFSET - 1}) carry nothing on this pad.` },
      { from: "Nano D4, D5, D6, D7", to: "S0, S1, S2, S3", note: "The channel number in binary; S0 is the 1s bit." },
      { from: "Nano D8", to: "E# (enable, active LOW)", note: "One HIGH pulse per frame, LOW the rest of the time." },
      { from: "U6 COM", to: `Nano A0, plus R1 ${R1 / 1000} kΩ to GND`, note: "The selected sense line's current becomes a voltage at A0." },
      { from: "Nano D9", to: "not connected", note: "The firmware's enable pin for a second multiplexer." },
    ],
    foot: "Pin and channel numbers start at 1 and 0 respectively, as printed on the board and in the chip's datasheet.",
  },
  code: {
    lang: "cpp",
    caption: "C++ · Arduino · from PyFlexiTac template.ino (lightly shortened)",
    source: `#define MUX_CHANNEL_OFFSET {{offset}}

void setRow(int row_number) {  // = i
  // (i = 0 only: pulse E# on D8, see notes)
  int mux_channel =
      row_number + MUX_CHANNEL_OFFSET;
  for (int i = 0; i < 4; i++) {  // S0..S3
    int pin = PIN_MUX_CHANNEL_0 + i; // D4+i
    if (bitRead(mux_channel, i))
      digitalWrite(pin, HIGH);
    else
      digitalWrite(pin, LOW);
  }
}

setRow({{row}});`,
    params: [
      { name: "offset", label: "MUX_CHANNEL_OFFSET", min: 0, max: 15, step: 1, value: MUX_OFFSET },
      { name: "row", label: "i (sense line i+1)", min: 0, max: 15, step: 1, value: 0 },
    ],
    notes: [
      "<code>bitRead(x, i)</code> gives bit <code>i</code> of <code>x</code>, a 0 or a 1. Bit 0 goes to S0 on D4, bit 3 to S3 on D7.",
      `<code>MUX_CHANNEL_OFFSET</code> is ${MUX_OFFSET} because the sense lines land on channels ${MUX_OFFSET}–${LAST}. Set it to 0 and the firmware would read channels 0–${ROWS - 1}: four empty channels, and only ${ROWS - MUX_OFFSET} of the sense lines.`,
      `Before setting the bits, the real <code>setRow()</code> checks <code>row_number % ROWS_PER_MUX == 0</code> (ROWS_PER_MUX is 16). With ${ROWS} sense lines that is only true for <code>i = 0</code> (sense line 1), so E# pulses once per frame.`,
      `Only 4 bits leave the Nano, so a channel above 15 wraps around: i = ${ROWS} + offset ${MUX_OFFSET} = 16 = <code>10000</code> would select channel 0. Try <code>i = ${ROWS}</code>.`,
      `The hardware repo's ${repo16.rows}-row firmware uses all 16 channels with offset ${repo16.muxOffset}. That build is for a ${repo16.rows}-line sensor, not this pad.`,
      "Change the values and press <b>Run</b>: the stepper runs the scan to that channel and the figure turns its dial.",
    ],
  },
  specs: [
    fact("sensor.muxChannels", "Channels used", { note: `Sense line n (i = n − 1) → channel i + ${MUX_OFFSET}; channels 0–${MUX_OFFSET - 1} unused` }),
    fact("board.part.U6", "Multiplexer", { value: (v) => `${v.mpn} (U6)`, note: "16 channels to one COM pin" }),
    fact("board.muxSelect", "Select and enable"),
    fact("board.A0", "Output"),
    fact("board.FPC1", "Connector FPC1"),
    fact("firmware.enablePulse", "E# pulse"),
    fact("board.D9", "D9"),
    fact("board.R_on", "Switch resistance", { badge: "external", note: "Small next to the 10 kΩ resistor and the taxel" }),
    { label: "Nano pins used", value: "6 (D4–D8, A0)", src: "material/tactile_reading_board_32x16.pdf", note: "4 select + 1 enable + 1 analog input" },
  ],
  steps: [
    {
      title: `Channel ${MUX_OFFSET} = sense line 1`,
      text: `The scan starts at channel ${MUX_OFFSET}: D7 D6 D5 D4 = <code>${bits(MUX_OFFSET)}</code>. Sense line 1 is now connected to A0; channels 0–${MUX_OFFSET - 1} are skipped.`,
      act: [{ name: "reset" }, { name: "mux", arg: MUX_OFFSET }],
    },
    {
      title: "Count in binary",
      text: `Channel ${EX} is 8 + 4 + 1 = <code>${bits(EX)}</code>. That is sense line ${exRow + 1} (i = ${exRow} in the firmware).`,
      act: { name: "mux", arg: EX },
    },
    {
      title: "An empty channel",
      text: `Channel 2 exists on the chip, but nothing is wired to it on this pad. The firmware never selects it.`,
      act: { name: "mux", arg: 2 },
    },
    {
      title: "Watch it switch",
      text: `Let the scan run. The dial steps ${MUX_OFFSET} → ${LAST}, one sense line per ${COLS} drive lines, then E# blinks and the next frame begins at ${MUX_OFFSET} again.`,
      act: [{ name: "mux", arg: LAST }, { name: "play", arg: 2e-3 }],
    },
  ],
  quiz: [
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
    {
      q: "How often does the enable pin E# (D8) pulse?",
      choices: ["Before every reading", "Once per sense line", "Once per frame", "Never"],
      answer: 2,
      why: `setRow() only pulses E# when row_number % 16 == 0. With ${ROWS} sense lines that is just i = 0 (sense line 1), once per frame.`,
    },
    {
      q: `How many Nano pins does it take to listen to all ${ROWS} sense lines?`,
      choices: [String(ROWS), "6: D4–D8 and A0", "1: just A0", "16"],
      answer: 1,
      why: "Four select pins (D4–D7), one enable (D8) and one analog input (A0). Only one of them is analog, which is the point: the mux shares A0 among all the sense lines.",
    },
  ],
};
