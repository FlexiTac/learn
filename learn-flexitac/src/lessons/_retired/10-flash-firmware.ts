// Lesson 7: put the 12-row scanning firmware on the Arduino Nano (PyFlexiTac flexitac-flash or the Arduino IDE),
// check the stream, and fix the usual problems. Sources: refs/fw/pyflexitac (flash.py, sensor.py, template.ino),
// the PyFlexiTac README and the hardware repo README (refs/fw/readme.md).
import { BAUD, COLS, FRAME_BYTES, FRAME_HZ, HEADER, MUX_OFFSET, ROWS } from "@shared/data/constants.mjs";
import { fact } from "../../content/facts";
import type { Lesson } from "../../types";

/** Section heading inside the Overview (the shell has no .prose h3 style yet). */
const h3 = (t: string) => `<h3 class="section-title" style="margin:1.6em 0 .3em">${t}</h3>`;

const BAUD_TXT = BAUD.toLocaleString("en-US");
const LAST_CH = MUX_OFFSET + ROWS - 1;

export const lesson: Lesson = {
  id: "flash-firmware",
  n: 7,
  title: "Flash the firmware",
  kicker: "Use it",
  lede: `Put the scanning program on the Arduino Nano, check that ${FRAME_HZ} frames a second arrive, and fix the usual problems. One command does most of the work.`,
  status: "ready",
  features: [
    { icon: "flash", title: "Two ways to flash", text: "<code>flexitac-flash</code> or the Arduino IDE" },
    { icon: "chip", title: "Board: Arduino Nano", text: "Old bootloader if the upload won't sync" },
    { icon: "grid", title: `${ROWS} rows, offset ${MUX_OFFSET}`, text: `Mux channels ${MUX_OFFSET}–${LAST_CH}, ${BAUD_TXT} baud` },
  ],
  widget: "flash-doctor",
  overview: `
<p>The Nano arrives empty. To <dfn title="copy a program into a microcontroller's memory">flash</dfn> it means to copy
the <dfn>firmware</dfn>, the scanning program from lessons 4–6, into its memory over USB. You do it once; the Nano
keeps the program when unplugged and starts scanning as soon as it gets power.</p>
<p>The firmware has four settings, and they must match your pad and your viewer:</p>
<ul>
  <li><code>ROW_COUNT ${ROWS}</code>: how many sense lines to read (the firmware calls sense lines <i>rows</i>).</li>
  <li><code>COLUMN_COUNT ${COLS}</code>: how many drive lines (<i>columns</i>).</li>
  <li><code>MUX_CHANNEL_OFFSET ${MUX_OFFSET}</code>: the pad's first sense line sits on multiplexer channel ${MUX_OFFSET},
    so the ${ROWS} lines are channels ${MUX_OFFSET}–${LAST_CH}.</li>
  <li><code>BAUD_RATE ${BAUD_TXT}</code>: the <dfn>baud</dfn> rate, the speed of the USB serial link.</li>
</ul>
<p style="margin-top:.75em">PyFlexiTac's defaults are exactly these, so the short route needs no options.</p>

${h3("Route A · PyFlexiTac (recommended)")}
<ol>
  <li>Install Python 3, then <code>pip install "flexitac[examples]"</code>. This gives you <code>flexitac-flash</code>,
    <code>flexitac-stream</code>, <code>flexitac-heatmap</code> and <code>flexitac-find-port</code>.</li>
  <li>Install <dfn title="the Arduino command-line tool that compiles and uploads sketches">arduino-cli</dfn>, then once:
    <code>arduino-cli core update-index</code> and <code>arduino-cli core install arduino:avr</code> (the support package for the Nano's chip).</li>
  <li>Plug the Nano in with its USB cable. Run <code>flexitac-flash</code>. It fills the four settings into its firmware template,
    compiles it and uploads it.</li>
  <li>If it says <i>no Arduino board detected</i>, name the port and board yourself:
    <code>flexitac-flash --port /dev/ttyUSB0 --fqbn arduino:avr:nano</code>. The <dfn title="fully qualified board name">FQBN</dfn>
    is arduino-cli's name for a board type. <code>flexitac-find-port</code> finds the port: it asks you to unplug the board and sees which port disappears.</li>
</ol>

${h3("Route B · Arduino IDE")}
<ol>
  <li>Open the ${ROWS}-row sketch: PyFlexiTac's <code>flexitac/firmware/template.ino</code> already holds the four settings above.
    (The hardware repo's <code>32_16_fast.ino</code> is the 16-row version; if you use it, change its settings to match.)</li>
  <li><b>Tools → Board → Arduino AVR Boards → Arduino Nano.</b></li>
  <li><b>Tools → Processor → ATmega328P.</b> If the upload fails with <i>not in sync</i>, choose <b>ATmega328P (Old Bootloader)</b> and try again.
    The <dfn>bootloader</dfn> is the tiny program on the Nano that accepts new firmware; many Nanos, especially clones, have the old one.</li>
  <li><b>Tools → Port</b>: <code>/dev/ttyUSB0</code> on Linux, <code>COM3</code> or similar on Windows, <code>/dev/cu.usbserial-…</code> on macOS.</li>
  <li>Click <b>Upload</b> (the right arrow). Wait for <i>Done uploading</i>.</li>
</ol>
<p style="margin-top:.75em">Don't use the IDE's Serial Monitor to check: the frames are raw bytes, so it shows gibberish, and while it is open no other
program can use the port.</p>

${h3("Check it")}
<p>Run <code>flexitac-stream --port /dev/ttyUSB0</code>. You want three things:</p>
<ul>
  <li><b>fps</b> settles near the frame rate (${FRAME_HZ}). Zero, or a <code>TimeoutError</code>, means no frames are found:
    check that the rows, columns and baud match what you flashed.</li>
  <li><b>raw_max</b> is small at rest and jumps when you press. A flat 0 or a flat 255 is a <b>wiring</b> problem, not a flashing one.</li>
  <li><b>norm_max</b> stays near 0 at rest and rises toward 1 under a press.</li>
</ul>
<p style="margin-top:.75em">Then <code>flexitac-heatmap --port /dev/ttyUSB0</code> and press the pad: bright spots should follow your finger.
On Linux, a <i>Permission denied</i> error means your user isn't in the <code>dialout</code> group yet:
<code>sudo usermod -aG dialout "$USER"</code>, then log out and in again.</p>
<p class="aside">The <b>Flash doctor</b> (the panel with the symptoms) shows each of these symptoms. The pictures are computed: the shared scan model
plays the firmware you flashed against a correctly wired pad, and the real viewer code reads the bytes. Change <code>rows</code>
or <code>offset</code> in the code and press <b>Run</b> to see your own mistake.</p>`,
  wiring: {
    intro: "Flashing only needs the USB cable. The pad can stay plugged in.",
    rows: [
      { from: "Computer USB port", to: "Nano Mini-USB socket", note: "Power for the board and the serial link, both while flashing and while streaming." },
      { from: "Nano D2 / D3", to: "74HC595 data / clock", note: `Drive line selection: ${COLS} lines (lesson 4).` },
      { from: "Nano D4–D7, D8", to: "Multiplexer S0–S3, E#", note: `Sense line selection: channels ${MUX_OFFSET}–${LAST_CH} (lesson 5).` },
      { from: "Multiplexer output", to: "Nano A0", note: "The reading for one crossing at a time." },
    ],
    foot: `If the pad's flat cable were turned the other way, the sense lines would land on channels 0–${ROWS - 1} instead, and the
right offset would be 0. The site assumes a straight-through cable, as the PyFlexiTac defaults do.`,
  },
  code: {
    lang: "bash",
    caption: "Terminal · set up once, then flash and check",
    source: `# once: tools and the Nano's chip support
pip install "flexitac[examples]"
arduino-cli core update-index
arduino-cli core install arduino:avr

# flash (these are the defaults)
flexitac-flash --rows {{rows}} \\
  --mux-offset {{offset}} --baud ${BAUD}

# if no board is detected:
#   --port /dev/ttyUSB0 --fqbn arduino:avr:nano
# old bootloader:
#   --fqbn arduino:avr:nano:cpu=atmega328old

# check: fps, raw_max, norm_max
flexitac-stream --port /dev/ttyUSB0
flexitac-heatmap --port /dev/ttyUSB0`,
    params: [
      { name: "rows", label: "Rows (sense lines)", min: 1, max: 16, step: 1, value: ROWS },
      { name: "offset", label: "Mux channel offset", min: 0, max: 15, step: 1, value: MUX_OFFSET },
    ],
    notes: [
      "<code>pip install</code> gets PyFlexiTac, the Python tools for FlexiTac. <code>[examples]</code> adds the plotting library the heatmap needs.",
      "<code>arduino-cli core install arduino:avr</code> adds support for the AVR chip family, which includes the Nano's ATmega328P. You only do it once.",
      `<code>flexitac-flash</code> writes <code>ROW_COUNT</code>, <code>COLUMN_COUNT</code>, <code>BAUD_RATE</code> and <code>MUX_CHANNEL_OFFSET</code> into its firmware template, then compiles and uploads it with arduino-cli.`,
      "<code>--fqbn</code> names the board type. <code>cpu=atmega328old</code> is the Nano with the old bootloader (an Arduino setting).",
      "<code>flexitac-stream</code> prints fps and the largest raw and normalised values; <code>flexitac-heatmap</code> draws the live picture.",
      `Try <code>offset</code> = 0, or <code>rows</code> = 16, and press <b>Run</b>: the Flash doctor plays that firmware against a real pad and shows what the viewer would see.`,
    ],
    run(p) {
      const rows = Math.round(p.rows);
      const off = Math.round(p.offset);
      const size = HEADER.length + rows * COLS;
      return [
        `flexitac-flash: ${rows}x${COLS} @ ${BAUD} baud (mux_offset=${off})`,
        `frames of 2 + ${rows} × ${COLS} = ${size} bytes${size === FRAME_BYTES ? "" : ` (viewer default ${FRAME_BYTES})`}`,
      ];
    },
  },
  specs: [
    fact("firmware.default", "Default firmware"),
    fact("sensor.muxChannels", "Mux channels used", { note: `Offset ${MUX_OFFSET}: frame row 0 = channel ${MUX_OFFSET}` }),
    fact("sensor.rows", "Rows (sense lines)"),
    fact("sensor.cols", "Columns (drive lines)"),
    fact("firmware.baud", "Serial speed"),
    fact("firmware.frameBytes", "Frame size"),
    fact("firmware.header", "Frame header"),
    fact("system.frameRate", "Frame rate"),
    fact("firmware.repo16.frameBytes", "16-row firmware frame", { note: "32_16_fast.ino: 16 rows from channel 0, not the default here" }),
    {
      label: "Board in the IDE / arduino-cli",
      value: "Arduino Nano · <code>arduino:avr:nano</code>",
      src: "Arduino Nano on the reading board (material/FlexiTac Hardware Guide.docx BOM item 6); FQBN naming: Arduino documentation (external)",
      badge: "external",
      note: "Old bootloader: Processor → ATmega328P (Old Bootloader), or cpu=atmega328old",
    },
  ],
  quiz: [
    {
      q: `The pad's ${ROWS} sense lines sit on multiplexer channels ${MUX_OFFSET}–${LAST_CH}. Which firmware setting tells the Nano that?`,
      choices: [`BAUD_RATE ${BAUD}`, `MUX_CHANNEL_OFFSET ${MUX_OFFSET}`, `COLUMN_COUNT ${COLS}`, "The processor choice"],
      answer: 1,
      why: `The offset is added to every row number: frame row 0 reads channel ${MUX_OFFSET}, row ${ROWS - 1} reads channel ${LAST_CH}.`,
    },
    {
      q: "Frames arrive at the right rate, but every byte is 0 even when you press. What should you check first?",
      choices: ["Flash the firmware again", "Change the baud rate", "The flat cables and the pad's tails in their connectors", "Pick the old bootloader"],
      answer: 2,
      why: "Frames arriving means the firmware and baud rate work. A flat 0 or flat 255 is a wiring problem, so reseat the cables.",
    },
    {
      q: "On Linux, flexitac-stream says “Permission denied” for /dev/ttyUSB0. What's the clean fix?",
      choices: ["Run everything with sudo", "Add your user to the dialout group, then log in again", "Reinstall arduino-cli", "Use a different USB cable"],
      answer: 1,
      why: "Serial ports belong to the dialout group. Joining it (sudo usermod -aG dialout \"$USER\") lasts, and is safer than opening the port to everyone.",
    },
    {
      q: "The upload stops with “stk500_getsync(): not in sync”. What does the lesson suggest?",
      choices: ["Choose Processor → ATmega328P (Old Bootloader)", "Lower the baud rate to 9600", "Set ROW_COUNT to 16", "Unplug the pad"],
      answer: 0,
      why: "Many Nanos carry the old bootloader, which listens at a different upload speed. Picking it lets the upload sync.",
    },
  ],
};
