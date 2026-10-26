// Lesson 6, the last: build a pad in ~3 minutes (the hardware guide's 4 steps, with its photos and short clips from the
// authors' video), test it (First light), flash the firmware onto the Nano, and fix the usual problems; then order the
// FPCs and the reading board, and what it costs. The stage is the build-checklist widget, which reads BUILD below; its
// last card ("Fix") is the Troubleshooter (src/widgets/flash-doctor.ts). Flashing and troubleshooting were their own
// lessons ("Flash the firmware", then "Troubleshooting": src/lessons/_retired/10-flash-firmware.ts and
// 13-troubleshooting.ts) until 2026-10-24; their old links lead here (src/state/store.ts MOVED).
// Photos: material/FlexiTac Hardware Guide.docx word/media (resized to public/media/guide).
// Clips: material/FlexiTac … Robotic Systems.mp4, cropped to the build window, muted, <= 6 s (public/media/clips).
// Flashing and the symptoms: refs/fw/pyflexitac (flash.py, sensor.py, template.ino), the PyFlexiTac README
// (refs/web/ext/pyflexitac.md), the hardware repo README and viewer (refs/fw/readme.md, fast_32_16.py). A symptom whose
// cause the materials do not state is marked inferred (worked out from the firmware, the viewer and the shared models)
// or external.
import { BAUD, COLS, FRAME_HZ, HEADER, MUX_OFFSET, R1, ROWS } from "@shared/data/constants.mjs";
import { fact, getFact, num } from "../content/facts";
import { tx } from "../i18n/strings";
import type { Lesson, MediaItem } from "../types";

/** Section heading inside the Overview (the shell has no .prose h3 style yet). */
const h3 = (t: string) => `<h3 class="section-title" style="margin:1.6em 0 .3em">${t}</h3>`;

export interface BuildPhoto {
  /** docx image number, e.g. 19 -> media/guide/guide-19(-sm).webp */
  n: number;
  alt: string;
}
export interface BuildStep {
  id: string;
  title: string;
  /** Its button in the checklist's row of steps. */
  tab: string;
  /** HTML, plain words. */
  text: string;
  photos: BuildPhoto[];
  clip?: { src: string; poster: string; caption: string };
  /** Commands to type, shown in place of photos (the flash step): `# …` lines are comments. */
  term?: { lines: string[]; caption: string };
  /** The step's card is the Troubleshooter (src/widgets/flash-doctor.ts) under the step's text. */
  doctor?: boolean;
  /** Ticked boxes, saved in this browser. A step without any has no done mark. */
  checks: { id: string; text: string }[];
}

const GUIDE = "material/FlexiTac Hardware Guide.docx";
const BUILD_MIN = num("build.time");
const BAUD_TXT = BAUD.toLocaleString("en-US");
const LAST_CH = MUX_OFFSET + ROWS - 1;
const HDR = HEADER.map((b) => b.toString(16).toUpperCase()).join(" ");
const inf = '<span class="badge badge-inferred" title="Worked out from the firmware, the viewer and the shared models, not stated in the materials">inferred</span>';
const ext = '<span class="badge badge-external" title="From outside the FlexiTac materials">external</span>';

export const BUILD: BuildStep[] = [
  {
    id: "parts",
    tab: "Parts",
    title: "Lay out the parts",
    text: "Everything for one pad fits on a cutting mat: the two FPCs, two pre-cut lamination sheets, a square of Velostat, and polyimide tape. Keep a hobby knife or scissors nearby.",
    photos: [{ n: 14, alt: "Cutting mat with labelled parts: FPCs, lamination sheet, Velostat and a roll of polyimide tape" }],
    checks: [
      { id: "fpcs", text: `Top FPC (${ROWS} sense lines) and Bottom FPC (${COLS} drive lines)` },
      { id: "lam", text: "Two pre-cut adhesive lamination sheets" },
      { id: "velo", text: "One square of Velostat, big enough to cover the electrode block" },
      { id: "tape", text: "Polyimide tape and a knife or scissors" },
    ],
  },
  {
    id: "step1",
    tab: "1",
    title: "1 · Attach each FPC to a lamination sheet",
    text: "Peel a pre-cut lamination sheet and press the top FPC's electrode block onto its sticky side. Do the same for the bottom FPC. Line the corners up exactly as in the photos, so the two grids will sit on top of each other later.",
    photos: [
      { n: 19, alt: "Peeling the backing off a lamination sheet" },
      { n: 20, alt: "Pressing the top FPC onto the lamination sheet" },
      { n: 17, alt: "The top FPC laminated, held up to the camera" },
      { n: 26, alt: "The bottom FPC laminated and aligned at the corner" },
    ],
    clip: { src: "media/clips/step1-attach.mp4", poster: "media/clips/step1-attach.jpg", caption: "Top FPC onto its sheet · real time" },
    checks: [
      { id: "top", text: "Top FPC pressed flat onto its sheet, no bubbles" },
      { id: "bot", text: "Bottom FPC pressed flat onto its sheet" },
      { id: "corner", text: "Corners aligned as in the guide's photos" },
    ],
  },
  {
    id: "step2",
    tab: "2",
    title: "2 · Stack the Velostat between them",
    text: "Lay the Velostat on one electrode block, centred, then fold the other FPC over it so the lines cross at right angles. Once it is centred, the sandwich already works as a sensor.",
    photos: [
      { n: 22, alt: "Placing the black Velostat square on the laminated electrodes" },
      { n: 24, alt: "The sandwich closed: Velostat between the two FPCs" },
    ],
    clip: { src: "media/clips/step2-velostat.mp4", poster: "media/clips/step2-velostat.jpg", caption: "Velostat in, sandwich closed · real time" },
    checks: [
      { id: "cover", text: "Velostat covers the whole electrode block" },
      { id: "cross", text: "Top and bottom lines cross at right angles" },
      { id: "nofold", text: "No wrinkles or folds in the Velostat" },
    ],
  },
  {
    id: "step3",
    tab: "3",
    title: "3 · Seal the edges with polyimide",
    text: "Lay a strip of polyimide tape sticky side up, trim it, set the sandwich on it and wrap the borders. The seal keeps the layers from sliding, so the pad survives real experiments.",
    photos: [
      { n: 23, alt: "A strip of polyimide tape laid sticky side up and trimmed" },
      { n: 28, alt: "Setting the sensor onto the tape" },
      { n: 27, alt: "Wrapping the tape over one edge" },
      { n: 18, alt: "Wrapping the opposite edge" },
      { n: 25, alt: "Pressing the seal down" },
      { n: 21, alt: "The sealed pad on the mat" },
    ],
    clip: { src: "media/clips/step3-seal.mp4", poster: "media/clips/step3-seal.jpg", caption: "Wrapping the edges · sped up 4×" },
    checks: [
      { id: "strip", text: "Tape strip cut to length" },
      { id: "wrap", text: "All borders wrapped and pressed down" },
      { id: "tails", text: "The gold fingers on both tails stay bare" },
    ],
  },
  {
    id: "step4",
    tab: "4",
    title: "4 · Connect to the reading board",
    text: "Push each tail's gold fingers into its connector (extender), then run the flat cables to the reading board: the top FPC's narrow cable to FPC1, the bottom FPC's wide cable to FPC2.",
    photos: [
      { n: 32, alt: "Sealed pad, reading board, two flat flexible cables and connectors laid out" },
      { n: 31, alt: "Inserting the gold fingers into a connector" },
      { n: 29, alt: "Fitting the flat cable" },
      { n: 30, alt: "The full chain: pad, cables and reading board with the Nano" },
    ],
    clip: { src: "media/clips/step4-connect.mp4", poster: "media/clips/step4-connect.jpg", caption: "Connectors onto the gold fingers · sped up 3×" },
    checks: [
      { id: "fingers", text: "Both tails fully inserted, contacts facing the connector's contacts" },
      { id: "fpc1", text: `Top FPC (${ROWS} lines) → 16-pin cable → FPC1` },
      { id: "fpc2", text: `Bottom FPC (${COLS} lines) → 32-pin cable → FPC2` },
      { id: "latch", text: "Connector latches closed on both ends" },
    ],
  },
  {
    id: "light",
    tab: "Test",
    title: "First light",
    text: "Plug the Nano into your computer with its USB cable and start the heatmap. Squeeze the pad: a bright spot should follow your finger. A new Nano arrives empty: flash the scanning firmware onto it first (<b>Flash</b>, next). Picture dark or wrong? See <b>Fix</b>.",
    photos: [{ n: 7, alt: "Labelled photo of an assembled system and the pad with its 24 × 64 mm sensing area" }],
    clip: { src: "media/clips/first-light.mp4", poster: "media/clips/first-light.jpg", caption: "The live heatmap follows the press · real time" },
    checks: [
      { id: "usb", text: "Nano plugged in by USB, firmware on it (Flash)" },
      { id: "heat", text: "flexitac-heatmap: the spot follows your finger" },
    ],
  },
  {
    id: "flash",
    tab: "Flash",
    title: "Flash the firmware",
    text: `Copy the scanning program onto the Nano once; it keeps it when unplugged. <code>flexitac-flash</code> fills in the four settings (${ROWS} rows, ${COLS} columns, mux offset ${MUX_OFFSET}, ${BAUD_TXT} baud), compiles and uploads. In the Arduino IDE instead: open <code>template.ino</code>, <b>Tools → Board → Arduino Nano</b>, then <b>Upload</b>; if it won't sync, pick <b>Processor → ATmega328P (Old Bootloader)</b>.`,
    photos: [],
    term: {
      lines: [
        "# once: the tools, and support for the Nano's chip",
        'pip install "flexitac[examples]"',
        "arduino-cli core update-index",
        "arduino-cli core install arduino:avr",
        "",
        `# flash: ${ROWS} rows, mux offset ${MUX_OFFSET}, ${BAUD_TXT} baud (the defaults)`,
        "flexitac-flash",
        "# no board detected? name the port and the board",
        "flexitac-flash --port /dev/ttyUSB0 --fqbn arduino:avr:nano",
        "# upload not in sync? the old bootloader",
        "flexitac-flash --fqbn arduino:avr:nano:cpu=atmega328old",
        "",
        `# check: fps near ${FRAME_HZ}, raw_max jumps when you press`,
        "flexitac-stream --port /dev/ttyUSB0",
      ],
      caption: "Terminal · PyFlexiTac and arduino-cli",
    },
    checks: [
      { id: "tools", text: "PyFlexiTac and arduino-cli installed (once)" },
      { id: "upload", text: "flexitac-flash (or the IDE's Upload) finished without errors" },
      { id: "stream", text: `flexitac-stream: fps near ${FRAME_HZ}, raw_max jumps under a press` },
    ],
  },
  {
    id: "fix",
    tab: "Fix",
    title: "When the picture looks wrong",
    text: "Pick the symptom you see. Each one shows what the terminal or the viewer would show, why, and the fix. The pictures are computed: the firmware against a pad wired as the symptom says, read by the real viewer code.",
    photos: [],
    doctor: true,
    checks: [],
  },
];

/** The guide's bill of materials, per sensor + board. Prices are as printed in the guide (USD); `share` = how much
 *  of a pack one sensor uses. */
export const BOM: { id: number; key: string; part: string; share: number; price: number; group: "Pad" | "Board" | "Cables & tools"; note?: string }[] = [
  { id: 1, key: "FPC pair", part: "Top + Bottom FPC pair", share: 1, price: num("cost.fpcPair"), group: "Pad", note: "FPC service" },
  { id: 2, key: "Polyimide tape", part: "Polyimide tape, 4 in × 108 ft", share: 0.01, price: 21.98, group: "Pad" },
  { id: 3, key: "Velostat", part: "Velostat / Linqstat sheet (Adafruit 1361)", share: 0.05, price: 4.95, group: "Pad" },
  { id: 4, key: "Lamination", part: "Adhesive laminating sheets", share: 0.01, price: 6.29, group: "Pad" },
  { id: 5, key: "Board (PCBA)", part: "Reading board PCB, assembled", share: 1, price: 5, group: "Board", note: "PCB service" },
  { id: 6, key: "Arduino Nano", part: "Arduino Nano", share: 1, price: num("cost.nano"), group: "Board" },
  { id: 7, key: "FFC 32-pin", part: "Flat cable, 32-pin (5 pack)", share: 0.2, price: 5.09, group: "Cables & tools" },
  { id: 8, key: "FFC 16-pin", part: "Flat cable, 16-pin (5 pack)", share: 0.2, price: 6.09, group: "Cables & tools" },
  { id: 9, key: "USB cable", part: "Mini USB cable (2 pack)", share: 0.5, price: 11.99, group: "Cables & tools" },
  { id: 10, key: "Extender 20", part: "20-pin FFC extender (Adafruit 4523)", share: 1, price: 0.95, group: "Cables & tools" },
  { id: 11, key: "Extender 40", part: "40-pin FFC extender (Adafruit 5203)", share: 1, price: 0.95, group: "Cables & tools" },
];
export const usd = (v: number) => `$${v.toFixed(2)}`;
export const perSensor = (g?: string) => BOM.filter((b) => !g || b.group === g).reduce((s, b) => s + b.share * b.price, 0);

/** Reading-board parts with their LCSC codes (board BOM csv; R1's code from the guide's JLC screenshot). */
export const LCSC = [
  { ref: "FPC1", part: "FFC05001-16SBB124W5M", what: "16-pin, 0.5 mm flat-cable socket: sense lines in", code: "C2856801" },
  { ref: "FPC2", part: "THD0515-32CL-SN", what: "32-pin, 0.5 mm flat-cable socket: drive lines out", code: "C283153" },
  { ref: "R1", part: "1206W4F1002T5E", what: `${R1 / 1000} kΩ resistor, the bottom of the voltage divider`, code: "C17902" },
  { ref: "U2–U5", part: "SN74HC595NSR × 4", what: `Shift registers: ${COLS} drive lines`, code: "C191873" },
  { ref: "U6", part: "CD74HC4067M96", what: `16-channel multiplexer: ${ROWS} sense lines on ${MUX_OFFSET}–${MUX_OFFSET + ROWS - 1}`, code: "C496123" },
];

const fpcThick = getFact("fpc_top.thickness").value as number;

export const lesson: Lesson = {
  id: "build-your-own",
  n: 6,
  title: `Build your own in ~${BUILD_MIN} minutes`,
  kicker: "Use it",
  lede: `Order two flexible circuits and a small board, then build the pad by hand: laminate, add Velostat, seal, connect. Once the parts are on your desk it takes about ${BUILD_MIN} minutes. Then flash the Nano, and fix the picture if it looks wrong.`,
  status: "ready",
  features: [
    { icon: "tools", title: "4 steps", text: "Laminate, stack, seal, connect" },
    { icon: "clock", title: `~${BUILD_MIN} minutes`, text: "Once the parts are in hand" },
    { icon: "flash", title: "Test, flash, fix", text: "First light, <code>flexitac-flash</code>, then the usual suspects" },
  ],
  widget: "build-checklist",
  media: BUILD.flatMap((s): MediaItem[] => [
    ...s.photos.map((p): MediaItem => ({ kind: "image", src: `media/guide/guide-${String(p.n).padStart(2, "0")}.webp`, alt: p.alt, caption: s.title })),
    ...(s.clip ? [{ kind: "video" as const, src: s.clip.src, alt: s.clip.caption, caption: s.clip.caption }] : []),
  ]),
  overview: `
<p>Everything in this course comes down to a pad you can make at a desk. The two
<dfn title="flexible printed circuits">FPCs</dfn> carry the copper lines and are made by a circuit factory; the rest is
stationery: <dfn title="clear plastic film with glue on one side">lamination sheets</dfn>, a square of Velostat, and
<dfn>polyimide</dfn> tape, the heat-proof amber tape that electronics people use everywhere. The photos and clips in the
build checklist come from the authors' hardware guide and video. Tick the boxes as you go; the page remembers them.</p>

${h3("The four steps")}
<ol>
  <li><b>Attach each FPC to a lamination sheet and align.</b> The sheet gives the thin circuit a stiff, flat backing.</li>
  <li><b>Stack the Velostat between them.</b> Centre it on the electrodes and close the sandwich: now it already senses.</li>
  <li><b>Seal the edges with polyimide.</b> The tape locks the layers so they cannot slide apart in use.</li>
  <li><b>Connect to the reading board.</b> Each tail's <dfn title="gold-plated contact strips at the end of a flexible circuit">gold fingers</dfn>
    go into a connector, and flat cables (<dfn title="flat flexible cable">FFCs</dfn>) run to the board.</li>
</ol>
<p class="aside" style="margin-top:.75em">The guide says “&lt; 3 mins” per pad; the paper says about 5 minutes. Both assume the parts are already cut.</p>

${h3("First light")}
<p>Plug the Nano into your computer with its USB cable, start the viewer and squeeze the pad: a bright spot should
follow your finger. A new Nano arrives empty, so the first time it needs the scanning program. The last two cards of the
build checklist, <b>Flash</b> and <b>Fix</b>, go with the two sections below.</p>

${h3("Flash the firmware")}
<p>To <dfn title="copy a program into a microcontroller's memory">flash</dfn> the Nano means to copy the
<dfn>firmware</dfn>, the scanning program of Lesson 1.4, into its memory over USB. You do it once; the Nano keeps
the program when unplugged and starts scanning as soon as it gets power. Four settings must match your pad and your
viewer:</p>
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
  <li>Plug the Nano in and run <code>flexitac-flash</code>. It fills the four settings into its firmware template, compiles
    it and uploads it.</li>
  <li>If it says <i>no Arduino board detected</i>, name the port and the board yourself:
    <code>flexitac-flash --port /dev/ttyUSB0 --fqbn arduino:avr:nano</code>. The <dfn title="fully qualified board name">FQBN</dfn>
    is arduino-cli's name for a board type.</li>
</ol>
<p><b>Route B · Arduino IDE</b></p>
<ol>
  <li>Open the ${ROWS}-row sketch: PyFlexiTac's <code>flexitac/firmware/template.ino</code> already holds the four settings.
    (The hardware repo's <code>32_16_fast.ino</code> is the 16-row version; if you use it, change its settings to match.)</li>
  <li><b>Tools → Board → Arduino AVR Boards → Arduino Nano</b>, and <b>Tools → Port</b>: <code>/dev/ttyUSB0</code> on Linux,
    <code>COM3</code> or similar on Windows, <code>/dev/cu.usbserial-…</code> on macOS.</li>
  <li>Click <b>Upload</b> and wait for <i>Done uploading</i>. If it fails with <i>not in sync</i>, choose
    <b>Tools → Processor → ATmega328P (Old Bootloader)</b> and try again ${ext}. The <dfn>bootloader</dfn> is the tiny
    program on the Nano that accepts new firmware; many Nanos, especially clones, have the old one. (With
    <code>flexitac-flash</code>: <code>--fqbn arduino:avr:nano:cpu=atmega328old</code>.)</li>
</ol>
<p style="margin-top:.75em"><b>Check it.</b> Run <code>flexitac-stream --port /dev/ttyUSB0</code>: <b>fps</b> settles near
${FRAME_HZ}, <b>raw_max</b> is small at rest and jumps when you press. Then <code>flexitac-heatmap --port /dev/ttyUSB0</code>.
Don't check with the IDE's Serial Monitor: the frames are raw bytes, so it shows gibberish, and while it is open no other
program can use the port.</p>

${h3("When the picture looks wrong")}
<p>Problems come in two kinds. Either no frames reach the computer (the program, the port or the speed), or frames
arrive and the picture is wrong (the cables and the pad). The usual suspects:</p>
<ul>
  <li><b>No serial port, or the wrong one.</b> <code>flexitac-find-port</code> asks you to unplug the board and names the port
    that disappears. On Linux, <i>Permission denied</i> means your user isn't in the <code>dialout</code> group yet:
    <code>sudo usermod -aG dialout "$USER"</code>, then log out and in again. No port at all: try another USB cable (some
    carry power only) and socket ${ext}.</li>
  <li><b>Wrong baud: fps is 0, or a <code>TimeoutError</code>.</b> The viewer finds no frames. Both sides must use
    ${BAUD_TXT} baud, and the rows and columns you give the viewer must match what you flashed.</li>
  <li><b>Frames out of step.</b> Every frame starts with the header <code>${HDR}</code>; the viewer finds it and takes the
    next rows × columns bytes as one picture. Expecting a different frame size from the one the board sends (for example
    the hardware repo's 16-row viewer on the ${ROWS}-row firmware), it cuts the stream in the wrong places and the picture
    gets extra or shifted rows ${inf}.</li>
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
<p class="aside">The checklist's <b>Fix</b> card is a Troubleshooter for these and a few more (no board detected, the old
bootloader, a mux offset left at 0). Its pictures are computed: the shared scan model plays the firmware against a pad
wired as the symptom says, and the real viewer code reads the bytes.</p>

${h3("Order the FPCs")}
<p>FPCs come from a PCB service such as JLCPCB. You send it <dfn title="the standard file set that describes a circuit board's layers">Gerber files</dfn>,
a zip of drawings of each copper layer, and pick options on its quote page. The guide's steps:</p>
<ol>
  <li>Upload <code>Gerber_Top_FPC_2026-03-02.zip</code>. Base material: <b>Flex</b>. Thickness: <b>${fpcThick} mm</b>.</li>
  <li>High-spec options: <b>Gold fingers: Yes</b>, gold finger thickness <b>0.3 mm</b>, so the tails slide firmly into the connectors.</li>
  <li>Repeat with <code>Gerber_Bottom_FPC_2026-03-02.zip</code>. The guide's quote for 100 of each was $133.32 + $123.98, about
    <b>$2.57 per pair</b>.</li>
</ol>

${h3("Order the reading board, assembled")}
<p><dfn title="printed circuit board assembly: the factory also solders the parts on">PCBA</dfn> means the factory solders the chips on for you.
You send three files: the Gerber zip, the <dfn title="bill of materials: the list of parts">BOM</dfn>, and the pick-and-place file that says where each part sits.</p>
<ol>
  <li>Upload <code>Gerber_16_32.zip</code> and switch on <b>PCB Assembly</b> near the bottom of the quote page.</li>
  <li>Upload <code>BOM_05mm_FFC_16_32_1mux_4sr_2025-11-01.csv</code> and <code>PickAndPlace_PCB_05mm_FFC_16_32_1mux_4sr_2025-11-01.csv</code>.
    Check that all five parts are matched and in stock:</li>
</ol>
<div class="table-wrap" style="margin:.75em 0">
<table class="pin-table">
  <thead><tr><th scope="col">Ref</th><th scope="col">Part</th><th scope="col">LCSC</th></tr></thead>
  <tbody>${LCSC.map((p) => `<tr><td>${p.ref}</td><td>${p.part}<br><span class="foot">${p.what}</span></td><td><code>${p.code}</code></td></tr>`).join("")}</tbody>
</table></div>
<ol start="3">
  <li>Review the assembly preview and the 3D render: every chip should sit on its pads.</li>
  <li>The guide's order of 5 boards came to <b>$40.41</b> ($2.00 for the boards, $38.41 for assembly), delivered in about a week.
    Most of that is one-off fees (setup $8.12, extended-component fee $12.16), so the price per board drops a lot in bigger orders.</li>
</ol>
<p style="margin-top:.75em">The Nano is not part of the assembly order. The board has two rows of 15 holes for it; solder the Nano (or two 15-pin sockets) in place.
<span class="badge badge-inferred" title="From the board's drill file; the guide does not show this step">inferred</span></p>

${h3("What it costs")}
<p>Prices as printed in the guide's bill of materials, for one pad and one board. “Share” is how much of a pack one sensor uses.</p>
<div class="table-wrap" style="margin:.75em 0">
<table class="pin-table">
  <thead><tr><th scope="col">Part</th><th scope="col">Price</th><th scope="col">Share</th><th scope="col">Per sensor</th></tr></thead>
  <tbody>${BOM.map((b) => `<tr><td>${b.part}</td><td>${usd(b.price)}</td><td>${b.share}</td><td>${usd(b.share * b.price)}</td></tr>`).join("")}
  <tr><td><b>Pad</b> · <b>Board</b> · <b>Cables</b></td><td colspan="3"><b>${usd(perSensor("Pad"))}</b> · <b>${usd(perSensor("Board"))}</b> · <b>${usd(perSensor("Cables & tools"))}</b></td></tr></tbody>
</table></div>
<p class="foot" style="margin-top:.75em">Source: hardware guide BOM (the guide rounds these to ~$4, ~$30 and ~$10). The paper (Sec 2.4) quotes an FPC pair at $3.55 for 30 units
and $1.36 for 1000, a bare board at $3.10 for 30 and $2.61 for 1000, and about $30 for a complete unit. Prices change; check before ordering.</p>
<p class="foot">Connectors: the guide's video uses compact Adafruit extenders (BOM items 10–11, listed as 20- and 40-pin) that need careful alignment.
It also suggests an easier, bulkier extender from AliExpress (item 12, $0.55–0.88): pick the 16-pin and 32-pin versions.</p>`,
  wiring: {
    intro: "Step 4 in detail, and the USB cable for flashing and streaming: what plugs into what.",
    rows: [
      { from: `Top FPC tail · ${ROWS} gold fingers`, to: "16-pin connector + 16-pin FFC", note: "The sense lines. The tail has 12 fingers; the socket has 16 positions." },
      { from: "16-pin FFC", to: "Board FPC1", note: `Multiplexer channels ${MUX_OFFSET}–${MUX_OFFSET + ROWS - 1}, assuming a straight-through cable.`, badge: "inferred" },
      { from: `Bottom FPC tail · ${COLS} gold fingers`, to: "32-pin connector + 32-pin FFC", note: "The drive lines." },
      { from: "32-pin FFC", to: "Board FPC2", note: `The four shift registers' ${COLS} outputs.` },
      { from: "Arduino Nano", to: "Computer, Mini-USB cable", note: "Power in, frames out; the same cable flashes the firmware. The pad can stay plugged in while you flash." },
    ],
    foot: `Which finger lands on which socket pin depends on how each cable is turned; the materials don't say, so that mapping is marked <i>inferred</i>. If the heatmap shows touches shifted by 4 rows, a dead row or nothing at all, see <b>When the picture looks wrong</b> in the Overview, or the checklist's <b>Fix</b> card.`,
  },
  code: {
    lang: "python",
    caption: "Python · what n sensors cost (guide prices)",
    source: `# per sensor: price × share of the pack
BOM = {
${BOM.map((b) => `    "${b.key}": ${b.price} * ${b.share},`).join("\n")}
}
n = {{n}}               # sensors to build
each = sum(BOM.values())
print(f"{n} × \${each:.2f} = \${n * each:.2f}")`,
    params: [{ name: "n", label: "Sensors", min: 1, max: 100, step: 1, value: 2 }],
    notes: [
      "Each entry is the guide's price times the share one sensor uses: a 5-pack of cables at 0.2, a sheet of Velostat at 0.05.",
      "Every sensor here gets its own reading board and Nano, which is most of the cost. Ordering many boards at once lowers the board price a lot (see the paper's numbers in the Overview).",
      "Press <b>Run</b> to total it for your <code>n</code>.",
    ],
    pureRun: true,
    run(p) {
      const n = Math.round(p.n);
      const each = perSensor();
      return [
        `${n} × ${usd(each)} = ${usd(n * each)}`,
        tx(
          `pad ${usd(perSensor("Pad"))} · board ${usd(perSensor("Board"))} · cables ${usd(perSensor("Cables & tools"))} (each)`,
          `传感垫 ${usd(perSensor("Pad"))} · 读取板 ${usd(perSensor("Board"))} · 排线 ${usd(perSensor("Cables & tools"))}（每个）`,
        ),
      ];
    },
  },
  specs: [
    fact("build.time", "Build time", { value: (v) => `~${v} min`, note: "Per pad, parts pre-cut; the paper says ~5 min" }),
    fact("fpc_top.thickness", "FPC thickness (order option)"),
    { label: "Gold finger thickness (order option)", value: "0.3 mm", src: `${GUIDE} FPC Manufacturing Guide Step 2` },
    { label: "FPC price, 100 pairs", value: "~$2.57 per pair", src: `${GUIDE} FPC Manufacturing Guide Step 3 (JLC cart screenshot image12)` },
    fact("cost.fpcPair", "FPC pair (BOM)"),
    { label: "Board PCBA, 5 boards", value: "$40.41 total", src: `${GUIDE} Reading Board Manufacturing Guide Step 4 (screenshot image5)`, note: "Delivery about one week" },
    fact("cost.nano", "Arduino Nano (BOM)"),
    fact("cost.unit", "Complete unit", { value: (v) => `~$${v}` }),
    fact("velostat.thickness", "Velostat"),
    fact("pad.activeArea", "Sensing area"),
    fact("board.headerHoles", "Nano header holes", { note: "Two rows of 15" }),
    fact("firmware.default", "Default firmware"),
    fact("sensor.muxChannels", "Mux channels used", { note: `Offset ${MUX_OFFSET}: frame row 0 = channel ${MUX_OFFSET}` }),
    fact("firmware.baud", "Serial speed"),
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
  quiz: [
    {
      q: "Which flat cable carries the sense lines to the board?",
      choices: ["The 32-pin cable, to FPC2", "The 16-pin cable, to FPC1", "The Mini-USB cable", "Either; they are the same"],
      answer: 1,
      why: `The top FPC's ${ROWS} sense lines go through the 16-pin cable to FPC1 and the multiplexer; the ${COLS} drive lines use the 32-pin cable to FPC2.`,
    },
    {
      q: "What is the polyimide seal in step 3 for?",
      choices: ["It makes the pad sense pressure", "It keeps the layers from sliding so the pad lasts in real use", "It insulates the gold fingers", "It sets the baseline"],
      answer: 1,
      why: "The sandwich already senses after step 2. The guide adds the seal to make it robust enough for real experiments.",
    },
    {
      q: "The guide's 5 assembled boards cost $40.41, but the paper quotes $3.10 per board at 30 units. Why the gap?",
      choices: ["The paper is wrong", "Small orders carry one-off setup and component fees that big orders spread out", "The guide's boards have more layers", "Shipping is included in the paper's price"],
      answer: 1,
      why: "Setup and extended-component fees are charged once per order. Over 5 boards they dominate; over 30 or 1000 they almost vanish.",
    },
    // from the flashing and troubleshooting part (2026-10-24, from the retired "Flash the firmware" lesson)
    {
      q: "The upload stops with “stk500_getsync(): not in sync”. What should you try?",
      choices: ["Choose Processor → ATmega328P (Old Bootloader)", "Lower the baud rate to 9600", "Set ROW_COUNT to 16", "Unplug the pad"],
      answer: 0,
      why: "Many Nanos carry the old bootloader, which listens at a different upload speed. Picking it lets the upload sync.",
    },
    {
      q: "Frames arrive at the right rate, but every byte is 0 even when you press. What should you check first?",
      choices: ["Flash the firmware again", "Change the baud rate", "The flat cables and the pad's tails in their connectors", "Pick the old bootloader"],
      answer: 2,
      why: "Frames arriving means the firmware and the baud rate work. A flat 0 or flat 255 is a wiring problem, so reseat the cables.",
    },
  ],
};
