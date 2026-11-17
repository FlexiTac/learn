// Lesson 2.4: gold fingers and flat cables (2026-11-12, PLAN-section2-build.md): the parts that carry the pad's 44 lines
// to the reading board. Split out of the old "Chips and connectors" (PLAN-section2-basics.md, its steps 3-4); the
// multiplexer and the shift registers are Lesson 2.3. The tails' gold fingers, the FFC extender and the flat flexible
// cable (FFC), the ZIF socket and where else each is used; then the whole chain, plugged in joint by joint (step 3).
// Lesson 2.5 puts the chips and the two sockets on the reading board.
// Stage: the chips-lab widget (src/widgets/chips-lab.ts), no figure: one flat drawing per step (widgetView {view}) with
// a card beside it (where else the part is used and a photo from the hardware guide, or which tail goes to which socket).
// Numbers: the shared data (sources.json facts, stack.json's order options); the sockets' and the cables' datasheet facts
// are external, with their URLs (the research of 2026-11-09). FPC1's part number is left out on purpose: its BOM line
// names one part and its LCSC code another (the board was assembled with the LCSC one). The guide's FFC extenders are
// Adafruit's (5203, 20 pins; 4523, 40 pins; the guide's parts list swaps the two links): their pages say to plug the
// cables in "with contacts pointing up", to open and close the lock by its "two ears", and to use a cable with its
// contacts on the same side at both ends (fetched 2026-11-12). The board's sockets take the contacts facing down.
import { COLS, MUX_OFFSET, ROWS } from "@shared/data/constants.mjs";
import { stack } from "@shared/data/index.mjs";
import { fact, getFact } from "../content/facts";
import type { Lesson } from "../types";

const LINES = ROWS + COLS;
const LAST = MUX_OFFSET + ROWS - 1; // the last mux channel in use
const NF_T = getFact("fpc_top.fingers.count").value as number;
const NF_B = getFact("fpc_bot.fingers.count").value as number;
const FW = (getFact("fpc_top.fingers.size").value as [number, number])[0];
const PITCH = getFact("fpc_top.fingers.pitch").value as number;
const FPC_T = getFact("fpc_top.thickness").value as number;
const THICK = stack.fpcBuild.goldFingerThickness;
const nb = (t: string) => t.replace(/ /g, "&nbsp;");
// outside the FlexiTac materials (scratchpad research external-facts.md, 2026-11-09)
const HIROSE = "https://www.hirose.com/api/v1/series/FH12/documents/product_series_catalog/content?lang=EN";
const LCSC_FPC2 = "https://www.lcsc.com/product-detail/C283153.html";
const PHOTO = "material/FlexiTac Hardware Guide.docx";
const ADA_EXT = "https://www.adafruit.com/product/5203; https://www.adafruit.com/product/4523";

export const lesson: Lesson = {
  id: "fingers-and-cables",
  n: 9,
  title: "Gold fingers and flat cables",
  kicker: "Chips and connectors",
  lede: `How the pad's ${LINES} lines reach the reading board: gold fingers on its two tails, a flat cable, and a socket with a latch.`,
  status: "ready",
  features: [
    { icon: "gold", title: "Gold fingers", text: "Bare gold contacts at the end of each tail" },
    { icon: "cable", title: "Flat cable", text: "Flat copper strips side by side in plastic film" },
    { icon: "plug", title: "ZIF socket", text: "Lift the latch, slide the cable in, press it down" },
  ],
  widget: "chips-lab",
  overview: `
<p>Lesson 2.3's chips switch the pad's lines, but first the lines have to reach them. That is ${LINES} lines: the
${ROWS} sense lines of the Top FPC and the ${COLS} drive lines of the Bottom FPC. This lesson follows them from the pad's
two tails, through a small extender and a flat cable, into the reading board's two sockets.</p>

<p>Each FPC ends in a tail with a row of <dfn>gold fingers</dfn>: bare contacts plated with gold, which does not tarnish,
so they keep a clean contact. The Top FPC has ${NF_T}, the Bottom FPC ${NF_B}, each ${FW} mm wide, their centres ${PITCH} mm
apart. A <dfn>stiffener</dfn> glued behind them brings the ${FPC_T} mm film to ${THICK} mm, the thickness a socket expects.
Memory sticks, graphics cards and game cartridges plug in the same way.</p>

<p>Each tail plugs into a small extender, a tiny board with a socket on each side, as in Lesson 1.4. From its other side
a <dfn>flat flexible cable</dfn> (FFC) runs on to the reading board, so the board can sit away from the pad. The cable is
flat copper strips side by side in plastic film, bare at the ends, with a stiffener behind each end. Laptops, cameras and
printers use the same cables inside.</p>

<p>On the board, each cable plugs into a <dfn>ZIF connector</dfn>. ZIF stands for zero insertion force: you lift the
latch, slide the cable in with no force against the contacts, and press the latch down, so springs inside press onto the
bare contacts. The contacts must face the springs. A cable turned over goes in just as easily and connects nothing. The
board's two sockets are labelled FPC1, for the Top FPC's ${ROWS} sense lines, and FPC2, for the Bottom FPC's ${COLS}
drive lines.</p>

<p>Plugging the pad in is the same idea at every socket: open its lock, slide the piece in with its contacts toward the
springs, and close the lock. Only the side differs. The guide's extenders have their springs on top, so the tail goes in
with its gold fingers facing up. The board's sockets have them underneath, so the cable goes in with its contacts facing
down.</p>

<p>Step 3 lets you make both joints and watch the line light up from the pad to the board. The Bottom FPC's tail reaches
FPC2 the same way, through its own extender and cable.</p>

<p>Lesson 2.5 puts the Nano, Lesson 2.3's two kinds of chip and these two sockets on one small board, and follows that
board from a drawing to a factory.</p>`,
  wiring: {
    intro: "The path of the pad's lines from its two tails to the reading board's two sockets. Lesson 2.5 has every connection on the board.",
    rows: [
      { from: `Top FPC tail (${NF_T} gold fingers)`, to: "FFC extender", note: "One finger per sense line, facing up toward the extender's springs." },
      { from: "FFC extender", to: "Flat cable", note: "Socket to socket on a tiny board." },
      { from: "Flat cable", to: `FPC1, pins ${MUX_OFFSET + 1}–${LAST + 1}`, note: `The ${ROWS} sense lines, on to mux channels ${MUX_OFFSET}–${LAST} (Lesson 2.3).` },
      { from: `Bottom FPC tail (${NF_B} gold fingers)`, to: "FFC extender, then a flat cable to FPC2", note: `The ${COLS} drive lines, from the shift registers' outputs.` },
    ],
    foot: `${PITCH} mm pitch all the way. Socket pins count from 1 and mux channels from 0, as on the board.`,
  },
  specs: [
    fact("fpc_top.fingers.count", "Top FPC fingers", { note: "One per sense line" }),
    fact("fpc_bot.fingers.count", "Bottom FPC fingers", { note: "One per drive line" }),
    fact("fpc_top.fingers.size", "Finger size", { note: "Width × length, the same on both tails" }),
    fact("fpc_top.fingers.pitch", "Finger pitch", { note: "Centre to centre" }),
    { label: "Thickness at the fingers", value: `${THICK} mm`, src: stack.fpcBuild.src, note: `The ${FPC_T} mm FPC with its stiffener (an order option)` },
    { label: "FFC extender", value: "0.5 mm pitch · contacts up · ear lock", src: ADA_EXT, badge: "external", note: "The guide's Adafruit extenders, 20 and 40 pins. Pull the two ears out to open, push them back to lock. They take a cable with its contacts on the same side at both ends (Type A-A)" },
    fact("board.part.FPC2", "FPC2 socket", { value: (v) => `${v.mpn} · 32 pins`, note: `The ${COLS} drive lines` }),
    { label: "FPC2 type", value: "0.5 mm pitch · flip-top latch · bottom contacts", src: `${LCSC_FPC2} (THD0515-32CL-SN)`, badge: "external", note: "Takes a 0.3 mm thick cable" },
    { label: "FPC1 socket", value: "16 pins · 0.5 mm pitch", src: getFact("board.part.FPC1").src, badge: "inferred", note: `The ${ROWS} sense lines, on pins ${MUX_OFFSET + 1}–${LAST + 1}; a flip-top latch like FPC2's (board photo)` },
    { label: "Flat cable at the contacts", value: "0.3 mm thick · 0.5 mm pitch", src: `${LCSC_FPC2}; ${HIROSE}`, badge: "external", note: "What the board's sockets take (LCSC C283153; Hirose FH12 is the same, 0.3 ± 0.05 mm)" },
    { label: "Cable type", value: "Contacts on the same side at both ends", src: `${PHOTO} image 32 (the blue stiffeners sit on one face at both ends)`, badge: "inferred", note: "Called Type A" },
    { label: "Rated life of a common ZIF socket", value: "about 20 insertions", src: HIROSE, badge: "external", note: "Hirose FH12 (0.5 mm). The board's own sockets have no rating in the materials: unplug gently and not too often" },
  ],
  steps: [
    {
      title: "Gold fingers",
      // keep every step text to 3 lines in the text column at 1366-1440 px windows (the bar takes its longest step)
      text: `Each tail ends in a row of gold contacts, one per line: ${NF_T} on the Top FPC, ${NF_B} on the Bottom FPC, one every ${nb(`${PITCH} mm`)}. Click a finger to see it up close. Memory sticks plug in the same way.`,
      start: true,
      widgetView: { view: "fingers" },
    },
    {
      title: "Flat cables and their sockets",
      text: "Lift the latch, slide the cable in and press the latch down, and the springs press on its bare contacts. Then turn the cable over and try again. Its contacts face away, and nothing connects.",
      widgetView: { view: "ffc" },
    },
    {
      title: "Plug the pad in",
      text: "Open the extender's lock, slide the tail in with its gold fingers toward the springs, and close the lock. Then do the same with the cable in FPC1. Turn a piece over, and its line connects nothing.",
      widgetView: { view: "plug" },
    },
  ],
  quiz: [
    {
      q: "Why are the contacts at the end of each tail plated with gold?",
      choices: ["Gold does not tarnish, so the contact stays clean", "Gold makes the tail stiffer", "Copper cannot carry a signal", "So you can see which way is up"],
      answer: 0,
      why: "Bare copper slowly tarnishes, and a tarnished contact connects badly. Gold stays clean, so the fingers keep a good contact each time they are plugged in. The stiffener behind them is what makes the end stiff.",
    },
    {
      q: "A flat cable is fully in and latched, but the board reads nothing on those lines. What do you check first?",
      choices: ["That its bare contacts face the socket's springs", "That the cable is long enough", "That the latch is still open", "That the Nano gets 5 V"],
      answer: 0,
      why: "A cable turned over slides in just as easily, but its bare contacts face away from the springs, so no line connects. Lift the latch, turn the cable over and press the latch down again.",
    },
    {
      q: `The Top FPC's tail has ${NF_T} gold fingers. Which socket on the reading board does its cable go into?`,
      choices: ["FPC1", "FPC2", "Either one", "The Nano's USB socket"],
      answer: 0,
      why: `FPC1 takes the ${ROWS} sense lines, on its pins ${MUX_OFFSET + 1}–${LAST + 1}, and passes them to the multiplexer. FPC2 carries the shift registers' outputs to the Bottom FPC's ${COLS} drive lines.`,
    },
  ],
};
