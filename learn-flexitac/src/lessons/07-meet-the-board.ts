// Lesson 3: meet the reading board. Like lesson 1's "Take it apart": the board closed with one small hint, "Click to
// lift the Nano"; a click (or Show me) lifts the Arduino Nano straight up out of its sockets, and every component gets a
// card at once (two aligned columns: its name, ONE plain sentence about its job, "Details ›" for the site's detail
// window). No scanning here: how the parts take turns is lesson 4 ("One frame").
// It replaced "Pick one crossing" (2026-10-25; now src/lessons/_retired/07-pick-one-crossing.ts, whose scan steps moved
// to lesson 4): old links and saved progress come here (src/state/store.ts MOVED, migrateIds).
// Figure: Fig 3 in its all-labels mode (figures/EMBED.md "Fig 3 `board`: all labels": act labels "all"; the cards come
// from figures/board/parts.mjs CARDS). Facts from shared/data/sources.json.
import { COLS, FRAME_HZ, MUX_OFFSET, R1, ROWS } from "@shared/data/constants.mjs";
import { driveLineInfo } from "@shared/models/scan.mjs";
import { fact } from "../content/facts";
import type { Lesson } from "../types";

const TAXELS = ROWS * COLS;
const CHIPS = COLS / 8; // a 74HC595 has 8 outputs
const LAST = MUX_OFFSET + ROWS - 1; // the last mux channel in use
const KOHM = `${R1 / 1000}&nbsp;kΩ`;
const ASK = 20; // the drive line asked about in the quiz (1-based)
const askChip = driveLineInfo(ASK - 1).chip;
const chipChoices = [0, 1, 2, 3].map((g) => driveLineInfo(g * 8).chip);
const nb = (t: string) => t.replace(/ /g, "&nbsp;");

export const lesson: Lesson = {
  id: "meet-the-board",
  n: 7,
  title: "Meet the reading board",
  kicker: "The board",
  lede: `The small board that reads the pad. Lift its Arduino Nano and every part gets a label: what it is, and the one job it does.`,
  status: "ready",
  features: [
    { icon: "chip", title: "Arduino Nano", text: `Runs the scan and sends each frame to your computer over USB` },
    { icon: "shift", title: `2 pins → ${COLS} drive lines`, text: `${CHIPS} chained shift registers, U2–U5` },
    { icon: "mux", title: `4 pins → ${ROWS} sense lines`, text: "One multiplexer, U6, to the Nano's A0 pin" },
  ],
  figure: {
    fig: "board",
    // The board closed, the Nano on its sockets, and ONE hint, "Click to lift the Nano" (labels "all": the figure makes
    // room for the two card columns now, once). A click on the board or Show me lifts the Nano and the cards fade in;
    // a click on the bare board lowers it again. The restart button and a dot jump come back here (reset keeps the
    // mode on: the Nano eases down and the cards go).
    // (a card the learner picked goes too: pick null)
    initial: [{ name: "reset" }, { name: "labels", arg: "all" }],
    reset: [{ name: "reset" }, { name: "pick", arg: null }, { name: "labels", arg: "all" }],
  },
  overview: `
<p><b>What the board is for.</b> The pad is only copper lines and Velostat: it cannot tell anyone what it feels. The
reading board asks it. It checks the ${TAXELS} crossings one at a time, turns each one into a number and sends them all to
your computer through a USB cable, ${FRAME_HZ} times a second.</p>

<p><b>Lift the Nano.</b> The Arduino Nano sits on top, plugged into two rows of sockets, and hides two chips. Lift it and
every part gets a label:</p>
<ul>
  <li><b>Arduino Nano</b>: the brain. A small computer on one chip (a
  <dfn title="a tiny computer on one chip that runs one program">microcontroller</dfn>) runs the
  <a href="#/glossary/firmware"><dfn>firmware</dfn></a>, the program that does the scan, and sends each frame.</li>
  <li><b>USB port</b>: one cable does both jobs: power comes in from the laptop, frames go out to it.</li>
  <li><b>Header sockets</b>: the Nano's pins push in here, so it comes off and goes back on without soldering.</li>
  <li><b>Shift registers U2–U5</b> (74HC595): four chips in a chain, ${CHIPS} × 8 = ${COLS} outputs, one per drive line. A
  <a href="#/glossary/shift-register"><dfn>shift register</dfn></a> is a row of boxes that each hold a 1 or a 0 and pass it
  one box along at every tick. Fed by just two Nano pins, <b>D2</b> (data) and <b>D3</b> (clock), the chain powers one drive
  line at a time. U4 and U5 sit under the Nano.</li>
  <li><b>FPC2</b>, the 32-pin connector: the ${COLS} drive lines leave the board here, for the pad's Bottom FPC.</li>
  <li><b>FPC1</b>, the 16-pin connector: the ${ROWS} sense lines of the Top FPC come in here.</li>
  <li><b>Multiplexer U6</b> (CD74HC4067): a <a href="#/glossary/multiplexer"><dfn>multiplexer</dfn></a> is an electronic
  rotary switch. It has 16 inputs, called <dfn title="one of the 16 numbered inputs of the multiplexer">channels</dfn>, and
  one output, wired to the Nano's <b>A0</b> pin. Four Nano pins, <b>D4</b> to <b>D7</b>, choose the channel (the
  <dfn title="the four pins S0–S3 that choose the channel">select pins</dfn>), so A0 hears one sense line at a time.</li>
  <li><b>R1</b>, ${KOHM}: Lesson 1.2's resistor. The current from the chosen sense line flows through it to ground, and
  the voltage it makes is what A0 measures.</li>
</ul>

<p><b>Two paths.</b> Follow the parts in order and you get the two halves of Lesson 1.2's rule, now in real chips. The
<b>drive path</b> powers one drive line: D2 and D3 → U2–U5 → FPC2 → the pad. The <b>sense path</b> listens to one sense
line: the pad → FPC1 → U6 → A0, with R1. The single crossing where the two lines meet is the one being read. How the
board walks through all ${TAXELS} crossings, row by row, is the next lesson.</p>

<p><b>12 of 16 channels.</b> The multiplexer has 16 channels but the pad has ${ROWS} sense lines. They are wired to
channels ${MUX_OFFSET} to ${LAST} (FPC1 pins ${MUX_OFFSET + 1}–${LAST + 1}); channels 0–${MUX_OFFSET - 1} carry nothing on this pad.</p>

<p class="aside"><b>The other ${COLS - 1} lines are held at 0 V.</b> The shift registers' output-enable pin, #OE, is wired to
ground (the <code>#</code> means <dfn title="the pin does its job when it is LOW (0 V), not HIGH">active LOW</dfn>: LOW
means "outputs on"). So the chosen drive line sits at 5 V and the other ${COLS - 1} are pulled firmly to 0 V, not left
floating. That drains much of the current that could sneak through other pressed crossings and make an untouched one look
pressed (<dfn title="a false reading at a crossing nobody pressed, caused by current sneaking through other pressed taxels">ghosting</dfn>).
It limits ghosting but does not remove it.</p>`,
  wiring: {
    intro: "How the parts are joined. All but the cable mapping come from the board schematic and its copper traces. Lesson 2.2 shows what travels on each wire during a frame.",
    rows: [
      { from: "Nano D2", to: "U2 SER (data in)", note: "The data pin: the 1 or 0 that goes into the first shift register." },
      { from: "Nano D3", to: "SRCLK + RCLK of U2–U5", note: "The clock: one wire ticks all four chips at once." },
      { from: "U2 QH′ → U3 SER → U4 → U5", to: "the next chip's data in", note: "The chain: 4 × 8 boxes act as one row of 32. U5's QH′ is not connected." },
      ...[0, 1, 2, 3].map((g) => {
        const a = driveLineInfo(g * 8);
        const b = driveLineInfo(g * 8 + 7);
        return { from: `${a.chip} QA–QH`, to: `Drive lines ${g * 8 + 1}–${g * 8 + 8} (${a.net}–${b.net})`, note: `FPC2 pins ${a.fpc2Pin}–${b.fpc2Pin}.` };
      }),
      { from: "#OE of U2–U5", to: "GND", note: "Outputs always on: the selected line is HIGH, the other 31 are driven LOW." },
      { from: "Nano D4, D5, D6, D7", to: "U6 S0, S1, S2, S3", note: "The channel number in binary; S0 is the 1s bit." },
      { from: "Nano D8", to: "U6 E# (enable, active LOW)", note: "LOW switches the multiplexer on." },
      { from: "FPC1 pin k (16-pin)", to: "U6 channel k − 1", note: `So pins 1–${MUX_OFFSET} (channels 0–${MUX_OFFSET - 1}) carry nothing on this pad.` },
      { from: "U6 COM", to: `Nano A0, plus R1 ${R1 / 1000} kΩ to GND`, note: "The selected sense line's current becomes a voltage at A0." },
      { from: "Nano USB", to: "Your computer", note: "5 V power in; the frames out." },
      { from: "FPC2 (32-pin) · FPC1 (16-pin)", to: `Bottom FPC drive lines · Top FPC sense lines (FPC1 pins ${MUX_OFFSET + 1}–${LAST + 1})`, note: "Flat cables. Which copper line lands on which pin assumes straight-through cables.", badge: "inferred" },
    ],
    foot: "Chips are numbered as on the board (U2–U6). <code>QH′</code> is the 595's serial output, the bit falling off its last box. Pins count from 1, mux channels from 0, as on the board and in the chips' datasheets.",
  },
  specs: [
    fact("board.size", "Board", { value: (v: number[]) => `${v[0].toFixed(1)} × ${v[1].toFixed(1)} mm`, note: "2 copper layers" }),
    { label: "Nano pins used", value: "8: D2, D3 (drive) · D4–D8 (mux) · A0", src: "material/tactile_reading_board_32x16.pdf", note: "2 for the shift registers, 4 select + 1 enable for the multiplexer, 1 analog input" },
    fact("board.part.U2", "Shift registers", { value: (v) => `${CHIPS} × ${v.mpn} (U2–U5)`, note: "74HC595: 8 outputs each, one per drive line" }),
    fact("board.595chain", "Chain"),
    fact("board.clockTie", "Clocks"),
    fact("board.OE", "Output enable"),
    fact("board.part.U6", "Multiplexer", { value: (v) => `${v.mpn} (U6)`, note: "16 channels to one output, COM" }),
    fact("sensor.muxChannels", "Channels used", { note: `Sense line n → channel n + ${MUX_OFFSET - 1}; channels 0–${MUX_OFFSET - 1} unused` }),
    fact("board.muxSelect", "Select and enable"),
    fact("board.A0", "Output"),
    fact("board.R1", "R1"),
    fact("board.part.FPC2", "FPC2", { value: (v) => `${v.mpn} · 32 pins`, note: `The ${COLS} drive lines, out to the Bottom FPC` }),
    fact("board.part.FPC1", "FPC1", { value: (v) => `${v.mpn} · 16 pins`, note: `The ${ROWS} sense lines in, on pins ${MUX_OFFSET + 1}–${LAST + 1}` }),
    fact("board.R_on", "Switch resistance", { badge: "external", note: "Small next to the 10 kΩ resistor and the taxel" }),
  ],
  steps: [
    {
      title: "The reading board",
      // keep every step text to 3 lines in the text column at 1366-1440 px windows: the bar takes its longest step's
      // height, and the figure keeps the rest
      text: `This board reads the pad: it checks all ${TAXELS} crossings and sends them to your computer over USB, ${nb(`${FRAME_HZ} times`)} a second. <span class="only-mouse">Click</span><span class="only-touch">Tap</span> the board to lift the Nano and see its parts.`,
      // the lesson opens here (figure.initial is this pose): the board closed and the hint. Show me lifts the Nano;
      // the learner's own click on the board does the same and counts (src/ui/steps.ts)
      start: true,
      act: { name: "labels", arg: "all" },
      show: [{ name: "lift" }],
    },
    {
      title: "Two paths",
      text: `<b>Drive:</b> D2 and D3 → shift registers U2–U5 → FPC2 → the ${COLS} drive lines. <b>Sense:</b> the ${ROWS} sense lines → FPC1 → multiplexer U6 → A0, with R1. <span class="only-mouse">Click a card for its details.</span><span class="only-touch">Tap a part for its details.</span>`,
      // the Nano up, every card shown (no scan: that is lesson 4)
      act: { name: "lift" },
    },
  ],
  // the first two come from "Pick one crossing" with their saved answers (src/state/store.ts migrateIds)
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
      q: "What does the multiplexer, U6, do?",
      choices: [
        "Powers one drive line at a time",
        "Connects one sense line at a time to the Nano's A0 pin",
        "Stores a frame until the computer asks for it",
        "Turns the USB power into 5 V",
      ],
      answer: 1,
      why: `It is an electronic rotary switch: D4–D7 choose one of its 16 channels, and the sense line on that channel reaches A0. The ${ROWS} sense lines sit on channels ${MUX_OFFSET}–${LAST}.`,
    },
    {
      q: "Two chips hide under the Nano. Which?",
      choices: ["U2 and U3", "U4 and U5", "U6 and R1", "FPC1 and FPC2"],
      answer: 1,
      why: "U4 and U5, the last two shift registers of the chain: lift the Nano to see them. U2, U3, U6 and R1 sit in the open.",
    },
  ],
};
