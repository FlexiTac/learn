// Lesson 2.6: one frame. The pad plugged into the board, the scan row by row that makes the 386-byte frame, a press.
// It holds the scanning (it came from "Pick one crossing", src/lessons/_retired/07-pick-one-crossing.ts, 2026-10-25).
// Since 2026-11-09 Lesson 2.1 teaches analogRead and raw bytes, 2.2 the chips (select pins and binary, the walking 1,
// the output latch, the clocks tied on D3) and 2.3 the board and its two paths: this lesson points back to them and
// adds what the firmware does with them (the offset, the one-clock lag, the loop, the byte order, the header, the
// timing). Its own glossary terms: time-multiplexing, header, baud, prescaler.
// Facts from shared/data/sources.json, behaviour from the firmware port (@shared/models/scan.mjs = PyFlexiTac
// template.ino). Figure: Fig 3 in connect mode (figures/EMBED.md "Fig 3 board: connect mode"): the FlexiTac pad wired to
// the board by its two flat cables, the sense line listened to (teal) and the drive line powered (pink) lit on the pad
// as on the board, and a 12 x 32 map of the readings beside it that fills row by row. The Nano stays lifted and
// see-through, as at the end of Lesson 2.5. Widget: the frame runner in its strip form on every step (the frame bar
// AA 55 + 12 blocks and one status line, following the figure; a click on a block seeks the figure there): one row
// height for the whole lesson, so a step change never resizes the figure.
import { BAUD, COLS, FRAME_BYTES, FRAME_HZ, HEADER, MUX_OFFSET, ROWS } from "@shared/data/constants.mjs";
import { ADC_CLOCK_HZ, CONVERSION_CYCLES, CONVERSION_S, PRESCALER } from "@shared/models/adc.mjs";
import { byteIndex, frameSize, VARIANTS } from "@shared/models/scan.mjs";
import { fact } from "../content/facts";
import type { Lesson } from "../types";

const TAXELS = ROWS * COLS;
const LAST = MUX_OFFSET + ROWS - 1; // the last mux channel in use
const hx = (n: number) => n.toString(16).toUpperCase().padStart(2, "0");
const HDR = HEADER.map(hx).join(" ");
const FRAME_MS = 1000 / FRAME_HZ;
const BPS = FRAME_BYTES * FRAME_HZ;
const BITS_PER_BYTE = 10; // 8N1 serial: start bit + 8 data bits + stop bit (external: Arduino default)
const LINK_SHARE = Math.round(((BPS * BITS_PER_BYTE) / BAUD) * 100);
const READ_US = Math.round(CONVERSION_S * 1e6);
const READS_MS = (TAXELS * CONVERSION_S * 1000).toFixed(1);
// Lesson 2.1's analogRead, at the Arduino core's own ADC prescaler (ArduinoCore-avr wiring.c "16 MHz / 128 = 125 KHz",
// as in 03-arduino-fsr.ts): 13 cycles at 125 kHz = 104 µs, "about 100 µs" there and here (to 10 µs)
const ARDUINO_PRESCALER = 128;
const CPU_HZ = ADC_CLOCK_HZ * PRESCALER; // the Nano's 16 MHz
const ARD_S = (CONVERSION_CYCLES * ARDUINO_PRESCALER) / CPU_HZ;
const ARD_US = Math.round((ARD_S * 1e6) / 10) * 10; // 100
const ARD_MS = Math.round((TAXELS * ARD_S * 1000) / 10) * 10; // 40: the 384 readings at that pace
const ARD_X = Math.round(TAXELS * ARD_S * FRAME_HZ); // 4 frames' worth
const TIMES = ["once", "twice", "three times", "four times", "five times", "six times"][ARD_X - 1] ?? `${ARD_X} times`;
const PER_ROW = COLS + 2; // shiftColumn(true) + shiftColumn(false), then one per drive line
const CALLS = ROWS * PER_ROW; // shiftColumn calls (D3 rising edges) in a frame: 408
const repo16 = VARIANTS.repo16;
const REPO16_BYTES = frameSize(repo16);
const bits = (ch: number) => (ch & 15).toString(2).padStart(4, "0");
const SLOW = 2e-4; // step 2: about eight readings a second, so each clock can be followed (a frame takes 50 s)
// step 3 before Show me (user, 2026-10-25: "the press step can scan at 1/100× by default"): a frame a second, so the
// map refreshes every second and the pressed squares show soon after the finger lands
const BRISK = 1e-2;
const PRESS = { sense: 6.4, drive: 20.6, amount: 1 }; // step 3's fingertip (0-based line indices, as Fig 1 feel mode)
const PRESS2 = { sense: 3.2, drive: 9.4, amount: 1 }; // step 3's Show me: at real speed the finger moves
const STRIP = { grid: false }; // the frame runner's strip form (the figure draws the map)
const nb = (t: string) => t.replace(/ /g, "&nbsp;");
const Q = { row: 1, col: 0 }; // quiz: sense line 2 (i = 1), drive line 1 (j = 0)
const qByte = byteIndex(Q.row, Q.col) + 1;
const Q_ROW = 6; // quiz: sense line i (0-based), from "Pick one crossing"
const qCh = Q_ROW + MUX_OFFSET;
const band = (r: number) => `${byteIndex(r, 0) + 1}–${byteIndex(r, COLS - 1) + 1}`;

export const lesson: Lesson = {
  id: "one-frame",
  n: 12,
  title: "One frame",
  kicker: "The board",
  lede: `Plug in the pad and watch the board read it, row by row: one sense line, all ${COLS} drive lines, then the next. The ${TAXELS} readings, with <code>${HDR}</code> in front, make one ${FRAME_BYTES}-byte frame, sent ${FRAME_HZ} times a second.`,
  status: "ready",
  features: [
    { icon: "grid", title: "Row by row", text: `One sense line, all ${COLS} drive lines, then the next` },
    { icon: "byte", title: `${FRAME_BYTES} bytes`, text: `${HDR} + ${TAXELS} readings, one byte each` },
    { icon: "pulse", title: `${FRAME_HZ} frames/s`, text: `A full picture every ${FRAME_MS} ms, over USB` },
  ],
  figure: {
    fig: "board",
    // step 1's pose (the lesson opens there): the board alone, the Nano lifted (as Lesson 2.5 ends); step 1's Show me
    // plugs the pad in (Fig 3 connect)
    initial: [{ name: "reset" }, { name: "lift" }],
    // restart: everything back to the start (reset: the scan at power-on, speed 1/10,000×, paused, the map and its
    // frame count cleared, the finger gone at once), the pad unplugged (the camera eases back once), the Nano up. A dot
    // jump to step 2 or 3 replays step 2's connect right after, in the same batch, so a pad that was in stays in (no
    // replay of the plug-in) and the scan starts afresh from power-on.
    reset: [{ name: "reset" }, { name: "connect", arg: false }, { name: "lift" }],
  },
  widget: "frame-runner",
  // the steps were "Watch one frame", "The first reading", "The last reading", "Real speed"; then "Plug in the pad" came
  // in front, and everything after "Watch one frame" was replaced; then (2026-10-25, the scanning from "Pick one
  // crossing" came in) "Press and scan" and "Real speed" became one step, "Press it, real speed" (a count of 5 drops to
  // 4); then (2026-10-25, user: "steps 2 and 3 can be one") "Scan row by row" and "386 bytes" became one step, "Scan one
  // frame" (a count of 4 drops to 3, of 3 to 2; a count of 2, the scan seen but not the bytes, drops to 1).
  // src/state/store.ts migrateSteps.
  stepsAdded: [0, { keep: 2 }, { keep: 4 }, { merge: 1 }],
  overview: `
<p>Two flat cables join the pad to the board of Lesson 2.5: the Bottom FPC's ${COLS} drive lines go to FPC2, next to the
shift registers, and the Top FPC's ${ROWS} sense lines to FPC1, next to the multiplexer. Lesson 2.5 ended on the board's
two paths; now they reach the pad. The sense line the board listens to glows teal on the pad, the drive line it powers
glows pink, and each reading lands in one square of the map beside the pad. Taking turns like this, which Lesson 2.3
began, is called <dfn>time-multiplexing</dfn>: a few wires shared by many crossings, one after another.</p>

<p>The drive lines get Lesson 2.3's walking 1. The firmware puts a single 1 into U2, then clocks in 0s, and every rising
edge on D3 moves the 1 one drive line along. Because D3 also latches, the outputs show the boxes one clock behind: the
first clock puts the 1 into the first box, the second makes drive line 1 HIGH.</p>

<p>The sense lines get Lesson 2.3's channel numbers on D4–D7, with one twist. They sit on channels ${MUX_OFFSET}–${LAST},
so the firmware adds <code>MUX_CHANNEL_OFFSET = ${MUX_OFFSET}</code> to the sense line's number. It counts the sense lines
from 0 (<code>i</code>), so sense line 1 is <code>i = 0</code>, channel ${MUX_OFFSET}. The enable pin E# (D8) stays LOW, which
keeps the multiplexer on, apart from one short HIGH pulse at the start of every frame.</p>

<p>The firmware's loop goes row by row. First it sends the two header bytes. Then, for each of the ${ROWS} sense lines, it
points the multiplexer at that line, puts a single 1 into the shift registers and latches it (2 clocks). Now, ${COLS}
times, it reads A0, shrinks the reading to one byte, sends it and moves the HIGH to the next drive line (1 clock). That
is ${PER_ROW} clocks per sense line and ${TAXELS} readings per pass. Each pass makes one frame; then the loop starts again.</p>

<p>Because the drive-line loop sits <i>inside</i> the sense-line loop, the bytes arrive as all ${COLS} drive lines of sense
line 1 (<code>i = 0</code>), then all ${COLS} of sense line 2 (<code>i = 1</code>), and so on. The firmware counts from 0, so
sense line <i>n</i> is <code>i = n − 1</code> and drive line <i>m</i> is <code>j = m − 1</code>. The reading for the crossing
<code>(i, j)</code> is always at <code>byte index = 2 + i × ${COLS} + j</code>. The 2 skips the header. The strip under the
figure shows the frame in that order, <code>${HDR}</code> and then one block per sense line; click a block and the board
goes to that crossing.</p>

<p>USB serial delivers one endless stream of bytes with no gaps between frames. When the computer starts listening, it
lands somewhere in the middle of a frame. The <dfn>header</dfn> <code>${HDR}</code> (${HEADER.join(" and ")}) is a
bookmark: the viewer searches for that pair, then takes the next ${TAXELS} bytes as one picture. It doesn't double-check,
so two neighbouring readings of exactly ${HEADER[0]} then ${HEADER[1]} would fool it. That would need a sharp jump between
neighbouring crossings, which is unusual.</p>

<p>Lesson 2.1's <code>analogRead()</code> takes about ${ARD_US} µs. At that pace the ${TAXELS} readings alone would take
about ${ARD_MS} ms, ${TIMES} as long as a ${FRAME_MS} ms frame. So the firmware speeds up the ADC. The ADC's clock is the
Nano's ${CPU_HZ / 1e6} MHz divided by a number called the <dfn>prescaler</dfn>. Arduino's own code sets it to
${ARDUINO_PRESCALER}, and the firmware to ${PRESCALER}, for a ${ADC_CLOCK_HZ / 1e6} MHz ADC clock. One reading then takes about
${READ_US} µs, and the ${TAXELS} take about ${READS_MS} ms of each ${FRAME_MS} ms frame.</p>

<p>The USB link has room to spare. ${FRAME_BYTES} bytes × ${FRAME_HZ} frames is ${BPS.toLocaleString("en-US")} bytes a
second. Serial sends each byte as ${BITS_PER_BYTE} bits (a start bit, 8 data bits and a stop bit), so the link is about
${LINK_SHARE}% busy at ${BAUD.toLocaleString("en-US")} <dfn>baud</dfn>.</p>

<p>Each taxel is read for only about ${READ_US} µs, once per frame. The first and last readings of a frame are a few
milliseconds apart, so the picture isn't one single instant, like a phone camera's rolling shutter. A fingertip moves far
less than a taxel in that time, so the frame works as a snapshot: ${ROWS + COLS} wires, ${TAXELS} taxels, one picture every
${FRAME_MS} ms.</p>

<p>The hardware repo also has a ${repo16.rows}-row firmware that reads every mux channel: 2 + ${repo16.rows} × ${COLS} =
${REPO16_BYTES} bytes. The computer has to expect the same size as the board sends, or frames won't line up. Try it in the
code card: set <code>ROW_COUNT</code> to ${repo16.rows} and the offset to ${repo16.muxOffset}.</p>`,
  wiring: {
    intro: `What each Nano pin does during one frame, and where each byte of the ${FRAME_BYTES} comes from (counting bytes from 1). Lesson 2.5's Wiring tab has every connection on the board.`,
    rows: [
      { from: "Nano D2", to: "U2 SER (data in)", note: "HIGH for one clock at the start of each sense line (the 1 goes in), LOW otherwise." },
      { from: "Nano D3", to: "SRCLK + RCLK of U2–U5", note: `${PER_ROW} ticks per sense line: 2 to load and latch the 1, then one per drive line. The outputs lag the boxes by one tick.` },
      { from: "Nano D4–D7", to: "U6 S0–S3", note: `The sense line's channel, i + ${MUX_OFFSET}, in binary; set once per sense line.` },
      { from: "Nano D8", to: "U6 E# (enable, active LOW)", note: "One HIGH pulse per frame, LOW the rest of the time." },
      { from: "U6 COM", to: "Nano A0 (and R1 to GND)", note: `Read ${COLS} times per sense line, once while each drive line is HIGH.` },
      { from: "Bytes 1–2", to: `Header ${HDR}`, note: "Marks the start of a frame. Not a reading." },
      { from: `Bytes ${band(0)}`, to: `Sense line 1 (channel ${MUX_OFFSET})`, note: `Drive lines 1 to ${COLS}, in order.` },
      { from: `Bytes ${band(1)}`, to: `Sense line 2 (channel ${MUX_OFFSET + 1})`, note: `Drive lines 1 to ${COLS}.` },
      { from: "…", to: "…", note: `One block of ${COLS} for each sense line.` },
      { from: `Bytes ${band(ROWS - 1)}`, to: `Sense line ${ROWS} (channel ${LAST})`, note: `The last block; byte ${FRAME_BYTES} is drive line ${COLS}.` },
      { from: "Nano USB", to: "Your computer", note: `${FRAME_HZ} frames a second at ${BAUD.toLocaleString("en-US")} baud, raw bytes (not text).` },
    ],
    foot: "The figure and this table count from 1. Code counts from 0, so byte 3 here is <code>frame[2]</code> there, and sense line 1 is <code>i = 0</code>.",
  },
  code: {
    lang: "cpp",
    caption: "C++ · Arduino · PyFlexiTac template.ino (shortened)",
    source: `#define ROW_COUNT          {{rows}}
#define COLUMN_COUNT       ${COLS}
#define MUX_CHANNEL_OFFSET {{offset}}

void setRow(int i) {           // D4-D7: the channel
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

void loop() {
  Serial.write(0x${hx(HEADER[0])});  // header
  Serial.write(0x${hx(HEADER[1])});
  for (int i = 0; i < ROW_COUNT; i++) {
    setRow(i);           // listen to sense line i+1
    shiftColumn(true);   // a 1 into U2
    shiftColumn(false);  // latch: drive line 1 HIGH
    for (int j = 0; j < COLUMN_COUNT; j++) {
      int raw = analogRead(A0); // 0-1023
      Serial.write((byte)(raw >> 2));
      shiftColumn(false); // next drive line
    }
  }
}`,
    params: [
      { name: "rows", label: "ROW_COUNT (sense lines)", min: 1, max: 16, step: 1, value: ROWS },
      { name: "offset", label: "MUX_CHANNEL_OFFSET", min: 0, max: 15, step: 1, value: MUX_OFFSET },
    ],
    notes: [
      `<code>setRow(i)</code> is Lesson 2.3's <code>setChannel</code> with the offset added: it writes channel <code>i + ${MUX_OFFSET}</code> onto D4–D7, and the multiplexer connects that sense line to A0: the teal line on the pad. (The real setRow also pulses E# on D8 once per frame; left out here.)`,
      `One <code>shiftColumn</code> call is one rising edge on D3, like Lesson 2.3's <code>clockOnce()</code>. <code>SET_SR_DATA_HIGH()</code> and friends flip one bit of the Nano's port D register, much faster than <code>digitalWrite</code>. That matters: a frame takes ${CALLS} calls.`,
      "Because the shift clock and the latch clock share D3, the outputs show the boxes one clock late: it takes two calls before drive line 1 (<code>j = 0</code>) is HIGH. After that, each call moves the HIGH one drive line on: the pink line on the pad.",
      `The inner loop runs ${COLS} times for every pass of the outer loop, which is why the map fills row by row and the bytes come out sense line by sense line: <code>index = 2 + i × ${COLS} + j</code>.`,
      "<code>raw &gt;&gt; 2</code> is Lesson 2.1's divide by 4: it drops the two lowest bits of the 10-bit reading, turning 0–1023 into 0–255 so it fits one byte.",
      "<code>Serial.write</code> sends the number itself as one raw byte. <code>Serial.print(12)</code> would send the text \"12\": two bytes, and a much bigger frame. Lesson 2.1's sketch sent text like that, with <code>Serial.println</code>.",
      `<code>ROW_COUNT</code> and <code>MUX_CHANNEL_OFFSET</code> must match the sensor: ${ROWS} and ${MUX_OFFSET} for this pad. With offset 0 the firmware would read four empty channels and miss the last four sense lines.`,
      `Try <code>ROW_COUNT ${repo16.rows}</code>, offset <code>${repo16.muxOffset}</code> (the repo's ${REPO16_BYTES}-byte build) and press <b>Run</b>: the frame strip under the figure redraws for that frame (the figure keeps the real ${ROWS} × ${COLS} pad). Rows + offset above 16 wrap around to channel 0.`,
    ],
  },
  specs: [
    fact("firmware.frameBytes", "Frame size", { note: `${HDR} + ${TAXELS} readings` }),
    fact("firmware.header", "Header", { value: (v) => `${v} (${HEADER.join(", ")})` }),
    fact("system.frameRate", "Frame rate", { note: `One frame every ${FRAME_MS} ms` }),
    fact("firmware.baud", "Serial speed"),
    fact("board.clockTie", "Clocks", { note: "The outputs run one clock behind the boxes" }),
    fact("firmware.scanStart", "Start of a sense line"),
    { label: "Clocks per sense line", value: `${PER_ROW}`, src: "computed from refs/fw/pyflexitac/template.ino", note: "2 to load and latch the 1, then one per drive line" },
    fact("sensor.muxChannels", "Channels used", { note: `Sense line n (i = n − 1) → channel i + ${MUX_OFFSET}` }),
    fact("firmware.enablePulse", "E# pulse"),
    fact("firmware.adcToByte", "Reading → byte"),
    fact("firmware.adcPrescaler", "ADC prescaler"),
    { label: "Time per reading", value: `≈ ${READ_US} µs`, src: "ATmega328P datasheet (external): 13 ADC clocks per conversion at 1 MHz", badge: "external" },
    // (Lesson 2.1's pace, which the overview compares with: the same source as 2.1's "One analogRead")
    {
      label: "Lesson 2.1's analogRead",
      value: `≈ ${ARD_US} µs a reading`,
      src: "https://docs.arduino.cc/language-reference/en/functions/analog-io/analogRead/",
      badge: "external",
      note: `Arduino's own prescaler, ${ARDUINO_PRESCALER}: the ${TAXELS} readings would take about ${ARD_MS} ms`,
    },
    { label: "Data rate", value: `${BPS.toLocaleString("en-US")} B/s`, src: "computed from firmware.frameBytes × system.frameRate", note: `About ${LINK_SHARE}% of the link with 8N1 serial (${BITS_PER_BYTE} bits a byte)` },
    fact("firmware.repo16.frameBytes", "16-row build", { note: `2 + ${repo16.rows} × ${COLS}; not the default` }),
  ],
  // every step keeps its text to 3 lines in the text column at 1366-1440 px windows (the bar takes its longest step's
  // height, the figure the rest), and every step shows the frame strip (one row height: a step change never resizes
  // the figure)
  steps: [
    {
      title: "Plug in the pad",
      text: `Two flat cables join the pad to the board: its ${COLS} drive lines to FPC2, by the shift registers, and its ${ROWS} sense lines to FPC1, by the multiplexer. <b>Show&nbsp;me</b> plugs it in; then <span class="only-mouse">hover</span><span class="only-touch">tap</span> a cable to light its lines.`,
      // the lesson opens here (figure.initial is this pose: the board alone, the Nano up), as the lessons before it
      // open on their first step; Show me plays the plug-in
      start: true,
      show: [{ name: "connect", arg: true }],
      widgetView: STRIP,
    },
    {
      title: "Scan one frame",
      text: `The multiplexer listens to one sense line (teal) while a HIGH walks the drive lines (pink): one crossing at a time. ${HDR} + ${TAXELS} readings = ${FRAME_BYTES} bytes, the first is byte 3. <b>Show&nbsp;me</b> the last, ${nb(`byte ${FRAME_BYTES}`)}.`,
      // (shows are never replayed on a dot jump: the pad goes in here too; a pad already in stays in)
      act: [{ name: "connect", arg: true }, { name: "play", arg: SLOW }],
      // the scan runs on to sense line 12 × drive line 32 and stops there, the map full
      show: [{ name: "seek", arg: TAXELS }],
      widgetView: STRIP,
    },
    {
      title: "Press it",
      text: `A fingertip squeezes about a dozen crossings. At 1/100× a frame takes one second: their squares light up as the scan reaches them. <b>Show&nbsp;me</b> real speed: ${FRAME_HZ} frames a second, one live picture.`,
      act: [{ name: "press", arg: PRESS }, { name: "play", arg: BRISK }],
      // real speed, then the finger moves and the map follows at once
      show: [{ name: "speed", arg: 1 }, { name: "press", arg: PRESS2, at: 3000 }],
      widgetView: STRIP,
    },
  ],
  // (saved answers are kept by question index: the last two came from "Pick one crossing" with their saved answers,
  // src/state/store.ts migrateIds)
  quiz: [
    {
      q: `Counting bytes from 1, which byte of the frame holds sense line ${Q.row + 1} (i = ${Q.row}), drive line ${Q.col + 1} (j = ${Q.col})?`,
      choices: [`byte ${qByte - 2}`, `byte ${qByte - 1}`, `byte ${qByte}`, `byte ${qByte + COLS - 1}`],
      answer: 2,
      why: `index = 2 + ${Q.row} × ${COLS} + ${Q.col} = ${qByte - 1}, and index ${qByte - 1} counted from 0 is byte ${qByte} counted from 1.`,
    },
    {
      q: `Why does every frame start with ${HDR}?`,
      choices: [
        "It tells the computer how many rows the sensor has",
        "So the computer can find where each frame begins in the endless byte stream",
        "It is the reading of an empty taxel",
        "It switches the multiplexer on",
      ],
      answer: 1,
      why: "Serial is one long stream with no gaps. The viewer searches for the header pair and treats the next bytes as one frame, so it can join mid-stream and still line up.",
    },
    {
      q: `How big is a frame from the ${repo16.rows}-row firmware in the hardware repo?`,
      choices: [String(FRAME_BYTES), String(REPO16_BYTES - 2), String(REPO16_BYTES), String(REPO16_BYTES + COLS)],
      answer: 2,
      why: `2 header bytes + ${repo16.rows} × ${COLS} readings = ${REPO16_BYTES}. The computer must expect the same size the board sends.`,
    },
    {
      q: "The board reads one crossing at a time. Why does the heatmap still look like one picture?",
      choices: [
        "The Nano reads all taxels at the same instant",
        `All ${TAXELS} readings happen within one ${FRAME_MS} ms frame, much faster than a finger moves`,
        "The computer guesses the missing taxels",
        "Each taxel has its own wire",
      ],
      answer: 1,
      why: `Time-multiplexing works because it is quick: every crossing gets its turn in each ${FRAME_MS} ms frame, ${FRAME_HZ} times a second.`,
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
