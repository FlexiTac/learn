// Lesson 8, the last: Troubleshooting. When the heatmap stays dark, freezes or looks scrambled: flash the 12-row scanning
// firmware again (PyFlexiTac flexitac-flash or the Arduino IDE), then check the usual suspects one symptom at a time.
// It was lesson 7, "Flash the firmware" (id flash-firmware, now src/lessons/_retired/10-flash-firmware.ts), before
// "Bytes to touch" and "Build your own" moved in front of it; saved progress moves here (src/state/store.ts migrateIds).
// Sources: refs/fw/pyflexitac (flash.py, sensor.py, template.ino), the PyFlexiTac README (refs/web/ext/pyflexitac.md),
// the hardware repo README and viewer (refs/fw/readme.md, fast_32_16.py). A symptom whose cause the materials do not
// state is marked inferred (worked out from the firmware, the viewer and the shared models) or external.
// Widget: the Flash doctor (src/widgets/flash-doctor.ts), shown as "Troubleshooter"; each guided step picks its symptom
// there (widgetView.symptom).
import { BAUD, COLS, FRAME_BYTES, FRAME_HZ, HEADER, MUX_OFFSET, ROWS } from "@shared/data/constants.mjs";
import { fact } from "../../content/facts";
import type { Lesson } from "../../types";

/** Section heading inside the Overview (the shell has no .prose h3 style yet). */
const h3 = (t: string) => `<h3 class="section-title" style="margin:1.6em 0 .3em">${t}</h3>`;

const BAUD_TXT = BAUD.toLocaleString("en-US");
const LAST_CH = MUX_OFFSET + ROWS - 1;
const HDR = HEADER.map((b) => b.toString(16).toUpperCase()).join(" ");
const inf = '<span class="badge badge-inferred" title="Worked out from the firmware, the viewer and the shared models, not stated in the materials">inferred</span>';
const ext = '<span class="badge badge-external" title="From outside the FlexiTac materials">external</span>';

export const lesson: Lesson = {
  id: "troubleshooting",
  n: 8,
  title: "Troubleshooting",
  kicker: "Use it",
  lede: "When the heatmap stays dark, freezes or looks scrambled: flash the firmware again and check the usual suspects, one symptom at a time.",
  status: "ready",
  features: [
    { icon: "flash", title: "Flash it again", text: "<code>flexitac-flash</code> or the Arduino IDE" },
    { icon: "usb", title: "Port and baud", text: `The right port, ${BAUD_TXT} baud on both sides` },
    { icon: "cable", title: "Then the cables", text: "A flat 0, a dead line, a bright map" },
  ],
  widget: "flash-doctor",
  overview: `
<p>Most problems are one of two kinds. Either the Nano isn't running the right program, or no frames reach the computer,
and the fix is to <dfn title="copy a program into a microcontroller's memory">flash</dfn> it again and check the port and
the speed. Or frames arrive but the picture is wrong, and the fix is in the cables and the pad. This lesson starts with
flashing, then goes through the symptoms in the <b>Troubleshooter</b> beside it.</p>

${h3("Flash the firmware")}
<p>To flash the Nano means to copy the <dfn>firmware</dfn>, the scanning program of lessons 4 and 5, into its memory over
USB. You do it once; the Nano keeps the program when unplugged and starts scanning as soon as it gets power. A new Nano
arrives empty, so do this before your first heatmap. The firmware has four settings, and they must match your pad and
your viewer:</p>
<ul>
  <li><code>ROW_COUNT ${ROWS}</code>: how many sense lines to read (the firmware calls sense lines <i>rows</i>).</li>
  <li><code>COLUMN_COUNT ${COLS}</code>: how many drive lines (<i>columns</i>).</li>
  <li><code>MUX_CHANNEL_OFFSET ${MUX_OFFSET}</code>: the pad's first sense line sits on multiplexer channel ${MUX_OFFSET},
    so the ${ROWS} lines are channels ${MUX_OFFSET}–${LAST_CH}.</li>
  <li><code>BAUD_RATE ${BAUD_TXT}</code>: the <dfn>baud</dfn> rate, the speed of the USB serial link.</li>
</ul>
<p style="margin-top:.75em">PyFlexiTac's defaults are exactly these, so the short route needs no options.</p>

<p><b>Route A · PyFlexiTac (recommended)</b></p>
<ol>
  <li>Install Python 3, then <code>pip install "flexitac[examples]"</code>. This gives you <code>flexitac-flash</code>,
    <code>flexitac-stream</code>, <code>flexitac-heatmap</code> and <code>flexitac-find-port</code>.</li>
  <li>Install <dfn title="the Arduino command-line tool that compiles and uploads sketches">arduino-cli</dfn>, then once:
    <code>arduino-cli core update-index</code> and <code>arduino-cli core install arduino:avr</code> (the support package for the Nano's chip).</li>
  <li>Plug the Nano in with its USB cable. Run <code>flexitac-flash</code>. It fills the four settings into its firmware template,
    compiles it and uploads it.</li>
  <li>If it says <i>no Arduino board detected</i>, name the port and board yourself:
    <code>flexitac-flash --port /dev/ttyUSB0 --fqbn arduino:avr:nano</code>. The <dfn title="fully qualified board name">FQBN</dfn>
    is arduino-cli's name for a board type.</li>
</ol>
<p><b>Route B · Arduino IDE</b></p>
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
  <li><b>fps</b> settles near the frame rate (${FRAME_HZ}).</li>
  <li><b>raw_max</b> is small at rest and jumps when you press.</li>
  <li><b>norm_max</b> stays near 0 at rest and rises toward 1 under a press.</li>
</ul>
<p style="margin-top:.75em">Then <code>flexitac-heatmap --port /dev/ttyUSB0</code> and press the pad: bright spots should follow your finger.
If not, find your symptom below.</p>

${h3("The usual suspects")}
<ul>
  <li><b>No serial port, or the wrong one.</b> <code>flexitac-find-port</code> asks you to unplug the board and names the port
    that disappears. On Linux, <i>Permission denied</i> means your user isn't in the <code>dialout</code> group yet:
    <code>sudo usermod -aG dialout "$USER"</code>, then log out and in again. No port at all: try another USB cable (some
    carry power only) and socket ${ext}.</li>
  <li><b>fps is 0, or a <code>TimeoutError</code>.</b> The firmware isn't sending frames the viewer can find: check that the
    rows, columns and baud you give the viewer match what you flashed. Both sides must use ${BAUD_TXT} baud.</li>
  <li><b>Frames out of step.</b> Every frame starts with the header <code>${HDR}</code>; the viewer finds it and takes the
    next rows × columns bytes as one picture. If it expects a different frame size from the one the board sends (for
    example the hardware repo's 16-row viewer on the ${ROWS}-row firmware), it cuts the stream in the wrong places and the
    picture gets extra or shifted rows ${inf}.</li>
  <li><b>Everything reads 0</b> (or everything 255), pressed or not, while frames arrive: PyFlexiTac's README calls a flat 0
    or flat 255 <b>a wiring issue, not a flashing issue</b>. Reseat both flat cables and both pad tails: fully in, contacts
    facing the connector's contacts, latches closed. A cable in upside down, or a tail not pushed home, is the likely
    culprit ${inf}.</li>
  <li><b>One dead row or column.</b> Each row of the picture is one sense line, each column one drive line, so a row or
    column that never changes points at that one line: a contact in a connector, a cable in at a slant, or a cracked trace
    ${inf}.</li>
  <li><b>Everything bright</b> with nothing on the pad. The viewer learns each crossing's resting value when it starts. If
    the pad is bent, clamped or squeezed afterwards (a taut cable or tail pulling on its edge counts), everything reads
    above rest and the map lights up. Lay it flat, cables slack, and restart the viewer ${inf}.</li>
</ul>
<p class="aside">The <b>Troubleshooter</b> shows each symptom. The pictures are computed: the shared scan model plays the
firmware you flashed against a pad wired as the scenario says, and the real viewer code reads the bytes. Change
<code>rows</code> or <code>offset</code> in the code and press <b>Run</b> to see your own mistake.</p>`,
  wiring: {
    intro: "Flashing only needs the USB cable. The pad can stay plugged in.",
    rows: [
      { from: "Computer USB port", to: "Nano Mini-USB socket", note: "Power for the board and the serial link, both while flashing and while streaming." },
      { from: "Nano D2 / D3", to: "74HC595 data / clock", note: `Drive line selection: ${COLS} lines (lesson 4).` },
      { from: "Nano D4–D7, D8", to: "Multiplexer S0–S3, E#", note: `Sense line selection: channels ${MUX_OFFSET}–${LAST_CH} (lesson 4).` },
      { from: "Multiplexer output", to: "Nano A0", note: "The reading for one crossing at a time." },
      { from: "Top FPC tail → 16-pin cable", to: "Board FPC1", note: "The 12 sense lines: one dead row in the picture points here." },
      { from: "Bottom FPC tail → 32-pin cable", to: "Board FPC2", note: "The 32 drive lines: one dead column points here." },
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

# which port is the Nano?
flexitac-find-port

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
      "<code>flexitac-find-port</code> lists the serial ports, asks you to unplug the board, and reports the one that disappeared.",
      "<code>flexitac-stream</code> prints fps and the largest raw and normalised values; <code>flexitac-heatmap</code> draws the live picture.",
      `Try <code>offset</code> = 0, or <code>rows</code> = 16, and press <b>Run</b>: the Troubleshooter plays that firmware against a real pad and shows what the viewer would see.`,
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
    { label: "Flat 0 or flat 255", value: "a wiring issue, not a flashing issue", src: "refs/web/ext/pyflexitac.md (PyFlexiTac README, flexitac-stream)" },
    { label: "No frames (fps 0, TimeoutError)", value: "rows, columns and baud must match what you flashed", src: "refs/web/ext/pyflexitac.md; refs/fw/pyflexitac/sensor.py (read_timeout_s 5.0)" },
  ],
  steps: [
    {
      title: "Flash the firmware",
      text: `Plug in the Nano and run <code>flexitac-flash</code> (or upload <code>template.ino</code> from the Arduino IDE, board: Arduino Nano). Then <code>flexitac-stream</code> should show fps near ${FRAME_HZ}.`,
      widgetView: { symptom: "ok" },
    },
    {
      title: "No serial port",
      text: "Nothing under <code>/dev/ttyUSB*</code>, or the wrong board answers. <code>flexitac-find-port</code> asks you to unplug the Nano and names the port that disappears. No port at all: try another cable.",
      widgetView: { symptom: "noport" },
    },
    {
      title: "No frames: check the baud",
      text: `fps stays at 0, or a <code>TimeoutError</code>: the viewer finds no frames. Both sides must talk at ${BAUD_TXT} baud, and the viewer must expect the rows and columns you flashed.`,
      widgetView: { symptom: "baud" },
    },
    {
      title: "Frames out of step",
      text: `A scrambled picture: every frame starts with <code>${HDR}</code> and the viewer takes the next rows × columns bytes. Expecting the wrong size, it cuts the stream in the wrong places.`,
      widgetView: { symptom: "viewer16" },
    },
    {
      title: "Everything reads 0",
      text: "Frames arrive but every byte is 0, pressed or not: a wiring problem, not a flashing one. Reseat both flat cables and both tails, contacts facing contacts, latches closed.",
      widgetView: { symptom: "flat0" },
    },
    {
      title: "One dead row or column",
      text: "A row of the picture is one sense line, a column one drive line. One that never changes points at that line: a connector contact, a cable in at a slant, a cracked trace.",
      widgetView: { symptom: "dead" },
    },
    {
      title: "Everything bright",
      text: "The whole map lights with no finger on it: the pad was bent, clamped or pulled by a taut cable after the viewer learned its rest. Lay it flat, cables slack, and restart the viewer.",
      widgetView: { symptom: "bright" },
    },
  ],
  // the old lesson's four questions in their order (saved answers move with them: src/state/store.ts), new ones after
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
    {
      q: "One row of the heatmap stays dark, even under your finger, while the rest works. Where do you look?",
      choices: ["The baud rate", "That sense line's path: its contact in the 16-pin connector, the cable, the tail", "The baseline: restart the viewer", "The bootloader"],
      answer: 1,
      why: "Each row of the frame is one sense line. Frames arrive and the other rows work, so the firmware and the link are fine: that one line isn't reaching the multiplexer.",
    },
  ],
};
