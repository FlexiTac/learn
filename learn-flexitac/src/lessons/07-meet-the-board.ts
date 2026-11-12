// Lesson 2.5: how the reading board was made (2026-11-09, PLAN-section2-basics.md; it was "Meet the reading board").
// Every part on the board was met in Lessons 2.1 (the Nano, R1), 2.3 (the shift registers, the multiplexer) and 2.4 (the
// sockets); this lesson follows them from a drawing to a board: what a PCB is, the schematic, the PCB layout (and how
// EasyEDA turns one into the other), the factory order, the work by hand, and at the end the two paths that read one
// crossing.
//   step 1  Fig 3 in its all-labels mode (figures/EMBED.md "Fig 3 `board`: all labels"): the board closed with "Click to
//           lift the Nano"; a click (or Show me) lifts the Nano and every part gets a card.
//   steps 2-4  the PCB design picture over the whole stage (GuidedStep.stage "pcb-design", src/widgets/pcb-design.ts):
//           its schematic (simplified, or the real EasyEDA page), its copper layout (opening with the clock net lit, so
//           its vias show; "Before the copper" shows the ratlines it was routed from), the factory order. Fig 3 stays
//           underneath with the Nano lifted, ready for step 5.
//   step 5  Fig 3 again, the cards gone (labels null: the two paths are the only colour on the board), the scan paused
//           on reading 1 (seek 1): the drive path lights pink and the sense path teal. The restart button and a dot jump
//           bring the all-labels mode back (figure.reset).
// The steps went from 2 to 5 (stepsAdded: the first stayed); the first two questions carry answers migrated from "Pick
// one crossing" (src/state/store.ts migrateIds) and stay where they are; new questions go at the end.
// Facts from shared/data/sources.json and board.json; the price and times from the hardware guide (./pcb/cost.ts); how
// EasyEDA goes from schematic to layout from its own documentation (external, with its URLs in Specs). FPC1's part
// number is left out of its value, as in Lesson 2.4: the BOM names one part and its LCSC code another (the note says
// which was fitted).
import { COLS, FRAME_HZ, MUX_OFFSET, R1, ROWS } from "@shared/data/constants.mjs";
import { driveLineInfo } from "@shared/models/scan.mjs";
import { fact, getFact, num } from "../content/facts";
import type { Lesson } from "../types";
import { ORDER, ORDER_SRC, ORDER_TOTAL, usd } from "../widgets/pcb/cost";

const TAXELS = ROWS * COLS;
const LINES = ROWS + COLS;
const CHIPS = COLS / 8; // a 74HC595 has 8 outputs
const LAST = MUX_OFFSET + ROWS - 1; // the last mux channel in use
const KOHM = `${R1 / 1000}&nbsp;kΩ`;
const ASK = 20; // the drive line asked about in the quiz (1-based)
const askChip = driveLineInfo(ASK - 1).chip;
const chipChoices = [0, 1, 2, 3].map((g) => driveLineInfo(g * 8).chip);
// the outline from the Gerbers to 0.1 mm (56.754 × 39.86: 56.8 × 39.9, as the paper gives it)
const SIZE = (getFact("board.size").value as number[]).map((v) => v.toFixed(1)).join("&nbsp;×&nbsp;");
const VIAS = num("board.vias");
const HOLES = num("board.headerHoles");
const TRACE = "0.254"; // mm: the one track aperture in Gerber_TopLayer.GTL / GBL (shared/data board.json trackWidth)
const GAP = "0.152"; // mm: the board's clearance rule (its EasyEDA project's design rules)
const INFERRED = `<span class="badge badge-inferred" title="The guide's photos show the Nano on sockets; how to fit them is not described">inferred</span>`;
const EXTERNAL = `<span class="badge badge-external" title="How EasyEDA works, from its own documentation (links in Specs)">external</span>`;
// EasyEDA's documentation: from the schematic to the layout (Specs "Schematic to layout"), and the design-rule check
// (Specs "Traces": one link a row, as a row's chips are one per site)
const EDA_CONVERT = "https://docs.easyeda.com/en/Schematic/Convert-to-PCB/";
const EDA_DRC = "https://docs.easyeda.com/en/PCB/Design-Rule-Check/";

export const lesson: Lesson = {
  id: "meet-the-board",
  n: 11,
  title: "How the reading board was made",
  kicker: "The board",
  lede: `How the reading board went from a drawing of its circuit, to copper on a board, to ${ORDER.boards} boards from a factory.`,
  status: "ready",
  features: [
    { icon: "chip", title: "Parts you know", text: `A Nano, ${CHIPS} shift registers, a multiplexer, R1 and two sockets` },
    { icon: "layers", title: "2 copper layers", text: `${TRACE} mm traces, ${VIAS} vias between the two sides` },
    { icon: "tools", title: `${usd(ORDER_TOTAL)} for ${ORDER.boards}`, text: "A factory made the boards and soldered the parts" },
  ],
  figure: {
    fig: "board",
    // The board closed, the Nano on its sockets, and ONE hint, "Click to lift the Nano" (labels "all": the figure makes
    // room for the two card columns now, once). A click on the board or Show me lifts the Nano and the cards fade in.
    // The restart button and a dot jump come back here (reset keeps the mode on: the Nano eases down and the cards go;
    // a card the learner picked goes too: pick null; step 5 ended the mode: labels "all" turns it on again).
    initial: [{ name: "reset" }, { name: "labels", arg: "all" }],
    reset: [{ name: "reset" }, { name: "pick", arg: null }, { name: "labels", arg: "all" }],
  },
  overview: `
<p>The reading board is a small <dfn>PCB</dfn>, a printed circuit board: a stiff board whose copper paths join the
parts soldered onto it. On a breadboard like the one in Lesson 2.1, the same circuit would need dozens of jumper wires,
${LINES} for the pad's lines alone.</p>

<p>Its parts are ones you have met, and each has a short name that the drawings use. The Nano from Lesson 2.1 is U1.
R1 is a ${KOHM} resistor doing the job of the one in that lesson: it turns a change in resistance into a voltage on A0.
The four shift registers of Lesson 2.3 are U2 to U5, and its multiplexer is U6. The two cable sockets are FPC1, for the
Top FPC's ${ROWS} sense lines, and FPC2, for the Bottom FPC's ${COLS} drive lines.</p>

<p>A board starts as a <dfn>schematic</dfn>: a drawing that shows which pin connects to which, and nothing about where
the parts sit. In the real drawing, many wires end in a name tag, such as SC5, instead of running all the way: pins
with the same tag are joined. The board was drawn in EasyEDA, an <dfn>EDA</dfn> (electronic design automation) program
that runs in a web browser.</p>

<p>One choice you can read in the schematic: each shift register's #OE (output enable) pin is wired to ground. The #
means active LOW, as in Lesson 2.3: the pin does its job at 0&nbsp;V, so the outputs are always on. The chosen drive
line sits at 5&nbsp;V and the other ${COLS - 1} are held at 0&nbsp;V instead of being left unconnected. That drains
much of the current that could sneak through other pressed crossings and make an untouched one look pressed, which is
called <dfn>ghosting</dfn>. It limits ghosting but does not remove it.</p>

<p>Next comes the <dfn>PCB layout</dfn>: the board at its real size, ${SIZE}&nbsp;mm, with every part in its place and
copper joining them. EasyEDA builds it from the schematic. Each part arrives as its <dfn>footprint</dfn>, the copper
pads its pins are soldered to, and a thin straight line, a <dfn>ratline</dfn>, joins every two pads that must connect. The
designer drags the parts into place, then draws a copper path along each ratline. Before the files go out, a
design-rule check flags any path closer than ${GAP}&nbsp;mm to another ${EXTERNAL}.</p>

<p>Each copper path is a <dfn>trace</dfn>, ${TRACE}&nbsp;mm wide on this board. The board has two copper layers, one on
each side. Where one trace would have to cross another, it goes down through a <dfn>via</dfn>, a small copper-plated
hole, and carries on along the other side; this board has ${VIAS}. The Nano stands on two rows of <dfn>header sockets</dfn>,
strips of small metal-lined holes that its pins push into. They hold it high enough for two of the shift registers, U4
and U5, to sit underneath, and that keeps the board small.</p>

<p>To have it made, EasyEDA exports three kinds of file. The <dfn>Gerber files</dfn> are one drawing per layer: the
copper, the <dfn>solder mask</dfn> (the green coating), the <dfn>silkscreen</dfn> (the white lettering), the outline
and the holes. The <dfn>BOM</dfn> (bill of materials) lists the five kinds of part, and the <dfn>pick-and-place
file</dfn> gives each of the eight small parts its position and angle. A factory such as JLCPCB makes the boards and
solders the parts on, which is called <dfn>PCBA</dfn>.</p>

<p>Five boards cost ${usd(ORDER_TOTAL)} before shipping: ${usd(ORDER.pcb)} for the boards and ${usd(ORDER.pcba)} for
the assembly. Most of the assembly price is paid once per order: ${usd(ORDER.setup)} to set up and
${usd(ORDER.extended)} for the four less common parts, so each board costs far less in a bigger order. The boards take
about a week to arrive.</p>

<p>The Nano is not part of that order. You solder two 15-pin header sockets into the board's ${HOLES} holes
${INFERRED} and press the Nano in, or solder the Nano straight in, then flash the firmware, as Lesson 1.4 shows. To
order the same board, use the Gerber, BOM and pick-and-place files linked from the hardware guide.</p>

<p>Put together, the parts make two paths. The drive path powers one drive line: D2 and D3, then U2–U5, then FPC2 and
the pad. The sense path listens to one sense line: the pad, then FPC1, U6 and A0, with R1. The reading belongs to the
one crossing where the two lines meet. Lesson 2.6 shows how the board walks through all ${TAXELS} of them,
${FRAME_HZ} times a second.</p>`,
  wiring: {
    intro: "The schematic as a table: every connection on the board. All but the cable mapping come from the board schematic and were checked against its copper traces. Lesson 2.6 shows what travels on each wire during a frame.",
    rows: [
      { from: "Nano D2", to: "U2 SER (data in)", note: "The data pin: the 1 or 0 that goes into the first shift register." },
      { from: "Nano D3", to: "SRCLK and RCLK of U2–U5", note: "Shift clock and latch clock on one wire: each tick moves the bits and latches them (Lesson 2.3)." },
      { from: "QH′ of U2, U3, U4", to: "SER of the next chip", note: `The chain: ${CHIPS} × 8 boxes act as one row of ${COLS}. U5's QH′ is not connected.` },
      ...[0, 1, 2, 3].map((g) => {
        const a = driveLineInfo(g * 8);
        const b = driveLineInfo(g * 8 + 7);
        return { from: `${a.chip} QA–QH`, to: `Drive lines ${g * 8 + 1}–${g * 8 + 8} (${a.net}–${b.net})`, note: `FPC2 pins ${a.fpc2Pin}–${b.fpc2Pin}.` };
      }),
      { from: "#OE of U2–U5", to: "GND", note: `Outputs always on: the selected line is HIGH, the other ${COLS - 1} are driven LOW.` },
      { from: "#SRCLR of U2–U5", to: "5 V", note: "Never cleared: the boxes keep their bits." },
      { from: "Nano D4, D5, D6, D7", to: "U6 S0, S1, S2, S3", note: "The channel number in binary; S0 is the 1s bit." },
      { from: "Nano D8", to: "U6 E# (enable, active LOW)", note: "LOW switches the multiplexer on." },
      { from: "FPC1 pin k (16-pin)", to: "U6 channel k − 1", note: `So pins 1–${MUX_OFFSET} (channels 0–${MUX_OFFSET - 1}) carry nothing on this pad.` },
      { from: "U6 COM", to: `Nano A0, plus R1 ${R1 / 1000} kΩ to GND`, note: "The selected sense line's current becomes a voltage at A0." },
      { from: "Nano 5V · GND", to: "VCC · GND of U2–U6", note: "Power for every chip, from the USB cable." },
      { from: "Nano USB", to: "Your computer", note: "5 V power in, the frames out." },
      { from: "FPC2 (32-pin) · FPC1 (16-pin)", to: `Bottom FPC drive lines · Top FPC sense lines (FPC1 pins ${MUX_OFFSET + 1}–${LAST + 1})`, note: "Flat cables. Which copper line lands on which pin assumes straight-through cables.", badge: "inferred" },
    ],
    foot: "The Nano is U1; the chips are U2–U6, as on the board. <code>QH′</code> is the 595's serial output, the bit falling off its last box. Pins count from 1, mux channels from 0, as on the board and in the chips' datasheets.",
  },
  specs: [
    fact("board.size", "Board", { value: (v: number[]) => `${v[0].toFixed(2)} × ${v[1].toFixed(2)} mm`, note: "Rounded to 56.8 × 39.9 mm in the FlexiTac paper" }),
    {
      label: "Designed in",
      value: "EasyEDA Standard (v6.5)",
      src: "material/Gerber_16_32.zip (every layer's header: G04 EasyEDA v6.5.51); https://docs.easyeda.com/en/Introduction/Introduction-to-EasyEDA/",
      note: "Schematic and layout, in a web browser",
    },
    {
      label: "Schematic to layout",
      value: "Footprints joined by ratlines, then traces drawn along them",
      src: EDA_CONVERT,
      badge: "external",
      note: "EasyEDA's Convert to PCB",
    },
    // (board.copperLayers, written out: the fact's src "material/Gerber_16_32.zip (GTL + GBL)" would show a stray "GBL)"
    // chip in a build before src/content/sources.ts stopped splitting inside parentheses)
    { label: "Copper layers", value: String(num("board.copperLayers")), src: "material/Gerber_16_32.zip: Gerber_TopLayer.GTL and Gerber_BottomLayer.GBL", note: "One on each side, joined by vias" },
    { label: "Traces", value: `${TRACE} mm wide, at least ${GAP} mm apart`, src: `material/Gerber_16_32.zip + EasyEDA design rules; ${EDA_DRC}`, note: "Every trace has the same width; the spacing is the board's own design rule, which EasyEDA's design-rule check holds the copper to" },
    fact("board.vias", "Vias", { value: (v: number) => `${v} · ${num("board.viaDrill")} mm holes`, note: "Each joins a trace on top to one underneath" }),
    fact("board.headerHoles", "Nano holes", { note: "Two rows of 15, for the Nano's header sockets" }),
    {
      label: "Gerber files",
      value: "11: GTL, GBL, GTS, GBS, GTO, GBO, GTP, GKO, GDL and 2 drill files",
      src: "material/Gerber_16_32.zip",
      note: "Copper, solder mask and silkscreen for each side, solder paste, outline, notes and holes",
    },
    { label: "Nano pins used", value: "8: D2, D3 (drive) · D4–D8 (mux) · A0", src: "material/tactile_reading_board_32x16.pdf", note: "2 for the shift registers, 4 select + 1 enable for the multiplexer, 1 analog input" },
    fact("board.part.U2", "Shift registers", { value: (v) => `${CHIPS} × ${v.mpn} (U2–U5)`, note: "74HC595: 8 outputs each, one per drive line" }),
    fact("board.595chain", "Chain", { value: () => "D2 → U2 → U3 → U4 → U5", note: "Each QH′ feeds the next chip's SER; U5's QH′ is not connected" }),
    fact("board.clockTie", "Clocks", { value: () => "D3 → SRCLK and RCLK of all four 595s", note: "One wire for shift and latch, so the outputs run one clock behind" }),
    fact("board.OE", "Output enable", { value: () => "#OE → GND", note: "Outputs always on; unselected drive lines held LOW" }),
    fact("board.part.U6", "Multiplexer", { value: (v) => `${v.mpn} (U6)`, note: "16 channels to one output, COM" }),
    fact("sensor.muxChannels", "Channels used", { note: `Sense line n → channel n + ${MUX_OFFSET - 1}; channels 0–${MUX_OFFSET - 1} unused` }),
    fact("board.muxSelect", "Select and enable", { value: () => "D4–D7 → S0–S3 · D8 → E#" }),
    fact("board.A0", "Output", { value: () => "U6 COM → A0 · R1 from A0 to GND" }),
    fact("board.R1", "R1", { note: "The schematic and the pick-and-place file say 20k: a mistake in the documents" }),
    fact("board.part.FPC2", "FPC2", { value: (v) => `${v.mpn} · 32 pins`, note: `The ${COLS} drive lines, out to the Bottom FPC` }),
    {
      label: "FPC1",
      value: "16 pins · 0.5 mm pitch",
      src: `${getFact("board.part.FPC1").src} + material/FlexiTac Hardware Guide.docx guide image2 (JLCPCB's part match)`,
      note: `The ${ROWS} sense lines in, on pins ${MUX_OFFSET + 1}–${LAST + 1}. The BOM names FFC05001-16SBB124W5M, but its LCSC code (C2856801) is FPC-05F-16PH20, the socket JLCPCB fitted`,
    },
    { label: "Switch resistance", value: "70 Ω", src: "https://www.ti.com/lit/ds/symlink/cd74hc4067.pdf", badge: "external", note: "Typical, at 4.5 V; small next to the 10 kΩ resistor and the taxel" },
    { label: `${ORDER.boards} assembled boards`, value: usd(ORDER_TOTAL), src: ORDER_SRC, note: `${usd(ORDER.pcb)} for the boards + ${usd(ORDER.pcba)} for the assembly, about ${usd(ORDER_TOTAL / ORDER.boards)} a board, before shipping` },
    { label: "Time to make", value: "About a week", src: ORDER_SRC, note: "Boards in 24 hours, assembly in 2–3 days, then shipping" },
  ],
  steps: [
    {
      title: "One board, parts you know",
      // keep every step text to 3 lines in the text column at 1366-1440 px windows: the bar takes its longest step's
      // height, and the figure keeps the rest
      text: `The parts here are the ones from Lessons 2.1, 2.3 and 2.4: the Nano, R1, two kinds of chip and two cable sockets. <span class="only-mouse">Click</span><span class="only-touch">Tap</span> the board to lift the Nano and see each one named.`,
      // the lesson opens here (figure.initial is this pose): the board closed and the hint. Show me lifts the Nano;
      // the learner's own click on the board does the same and counts (src/ui/steps.ts)
      start: true,
      act: { name: "labels", arg: "all" },
      show: [{ name: "lift" }],
    },
    {
      title: "Draw the circuit",
      text: `A schematic shows which pins connect, not where the parts sit. Follow D2 and D3 to the chain of four shift registers. <span class="only-mouse">Click</span><span class="only-touch">Tap</span> a part to see its wires, or open the real drawing.`,
      stage: "pcb-design",
      widgetView: { view: "schematic" },
      // (Fig 3 underneath: the Nano up, as step 5 starts)
      act: { name: "lift" },
    },
    {
      title: "Place the parts, draw the copper",
      text: `The real board, ${SIZE}&nbsp;mm, with traces on both sides. The lit clock wire takes vias to the other side. Press <b>Before the copper</b> to see the lines the traces were drawn along.`,
      stage: "pcb-design",
      // the clock net lit as it opens (the schematic's pink clock wire: both sides, 3 vias)
      widgetView: { view: "layout", net: "D3_CLK" },
    },
    {
      title: "Send it to a factory",
      text: `EasyEDA exports three kinds of file. A factory made ${ORDER.boards} boards with their parts for ${usd(ORDER_TOTAL)} plus shipping, in about a week. You add the Nano and flash it (Lesson&nbsp;1.4).`,
      stage: "pcb-design",
      widgetView: { view: "order" },
    },
    {
      title: "Two paths",
      text: `The shift registers power one drive line (pink); the multiplexer passes one sense line to A0 (teal). The two meet at one crossing on the pad, which Lesson 2.6 plugs in.`,
      // the cards go (their teal leaders would read as the sense path), the Nano up, the scan paused on the first
      // reading: both paths lit and the only colour on the board
      act: [{ name: "labels", arg: null }, { name: "lift" }, { name: "seek", arg: 1 }],
    },
  ],
  // (2026-11-09: the two steps became five; only the first stayed)
  stepsAdded: [{ keep: 1 }],
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
      choices: ["U2 and U3", "U4 and U5", "U3 and U6", "U2 and U6"],
      answer: 1,
      why: "U4 and U5, the last two shift registers of the chain: lift the Nano to see them. U2, U3, U6 and R1 sit in the open.",
    },
    {
      q: "The schematic and the PCB layout describe the same board. What does only the layout show?",
      choices: ["Which pins are joined to each other", "Where each part sits and where the copper runs", "Which part number each chip has", "Which pin is the clock"],
      answer: 1,
      why: "A schematic only says which pin joins which. The layout is the real board: where every part sits, and the path, side and width of every trace.",
    },
    {
      q: "On a two-layer board, one trace has to cross another. What does the designer use?",
      choices: ["A via, to take one trace through to the other side", "A wider trace", "A resistor between the two", "A blob of solder where they meet"],
      answer: 0,
      why: `A via is a small copper-plated hole through the board. The trace goes down through it, runs under the other trace on the far side, and can come back up through another via. This board has ${VIAS}. A blob of solder would join the two traces into one wire.`,
    },
  ],
};
