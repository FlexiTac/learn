// Lesson 2.2: build it and make it work (2026-11-12, PLAN-section2-build.md). The learner rebuilds lesson 2.1's circuit
// from an empty breadboard: place the Nano, the FSR and the 10 kΩ resistor, lay the jumper wires, put the sketch
// together from code tiles, plug in USB, upload and press. The stage is src/widgets/build-bench.ts, a 3D bench since
// 2026-11-12 (src/widgets/build3d/, the models of flexitac-anatomy/figures/bench/topdown drawn live with three.js; the
// panel's circuit diagram is build-ui/schematic.ts); each step picks its view, and the widget's own "Show me" does the
// step. The check is electrical (src/widgets/build/: the board's strips and rails become nets, a
// small solver gives every pin's voltage), so any working build counts, and a wrong one fails the way a real bench does,
// with its reason and a hint. Numbers: SparkFun's breadboard pages (external), the shared data (R1), the engine's pass
// mark (F_PRESS, RESPONSIVE) and the illustrative FSR curve of lesson 2.1 (src/widgets/bench/fsr.ts).
import { COLS, ROWS } from "@shared/data/constants.mjs";
import { fact } from "../content/facts";
import type { Lesson } from "../types";
import { FSR_TABLE, FSR_TABLE_SRC } from "../widgets/bench/fsr";
import { F_PRESS, RESPONSIVE } from "../widgets/build/engine";

const TAXELS = ROWS * COLS;
const ohms = (r: number) => (r >= 1000 ? `${r / 1000} kΩ` : `${r} Ω`);
/** SparkFun's half-size breadboard: "2 power buses, 10 columns, and 30 rows - a total of 400 tie in points. All pins
 *  are spaced by a standard 0.1"." */
const SF_BOARD = "https://www.sparkfun.com/products/12002";
/** SparkFun's "How to Use a Breadboard": five clips to a strip, the ravine keeps the two sides apart, the power rails are
 *  typically connected along their length (some larger boards split them). */
const SF_HOW = "https://learn.sparkfun.com/tutorials/how-to-use-a-breadboard/all";

export const lesson: Lesson = {
  id: "build-the-circuit",
  n: 8,
  title: "Build it and make it work",
  kicker: "Arduino basics",
  lede: `Build lesson 2.1's circuit yourself on an empty breadboard, put its sketch together, upload it and press the sensor. It works only when the wiring and the code agree.`,
  status: "ready",
  features: [
    { icon: "board", title: "Breadboard", text: "Place the Nano, the sensor and the resistor" },
    { icon: "cable", title: "Jumper wires", text: "Join the strips that must connect" },
    { icon: "play", title: "Upload and press", text: "It works only if the wiring and the code agree" },
  ],
  widget: "build-bench",
  overview: `
<p>In lesson 2.1 the circuit came ready-made. Here you build it yourself, from an empty breadboard to a sensor that
answers your press. You place the parts, lay the jumper wires, put the sketch together and upload it.</p>
<p>A breadboard looks like rows of separate holes, but metal clips inside join them in groups. On this board each
numbered column has two groups of five holes, rows a to e and rows f to j. Each group is a
<dfn>strip</dfn>.
A leg or a wire in one hole of a strip touches everything else in that strip, and nothing more.</p>
<p>Along the top and bottom edges run the
<dfn>power rails</dfn>,
marked + and −. Each rail is one long strip, so a wire can bring 5V or GND to anywhere along the board.</p>
<p>The groove down the middle has no clips across it, so the two halves stay apart. The Nano's two rows of pins are too
far apart to fit in one strip, so it sits across the groove, one row on each side. Every pin then has a strip of its
own.</p>
<p>The circuit is lesson 2.1's. 5V goes into one leg of the force sensor (FSR). Its other leg goes to A0 and to the
10 kΩ pull-down resistor, and the resistor's other leg goes to GND. On a breadboard, "goes to" means "is in the same
strip as", directly or through a jumper wire.</p>
<p>The bench checks your build the way electricity would, not against one right answer. It works out which holes are
joined, then the voltage on every pin, then what <code>analogRead()</code> returns. Any build that joins the right things
works, wherever the parts sit and whatever colour the wires are.</p>
<p>When something is wrong, the symptom tells you where to look. A board that shuts off as soon as USB goes in has a
<dfn>short circuit</dfn>:
5V joined straight to GND. A reading stuck at 1023 means A0 is joined straight to 5V. Readings that wander at random mean
A0 is
<dfn>floating</dfn>:
nothing holds its voltage.</p>
<p>An empty Serial Monitor points at the code or the USB cable. Gibberish means the sketch and the monitor use different
<dfn>baud</dfn> rates, the speed of the link. The bench gives each failure its reason and a hint.</p>
<p>One problem from lesson 2.1 is still there. This one sensor took one of the Nano's 8 analog pins, and a FlexiTac pad
has ${TAXELS} crossings. Lesson 2.3 shows the two chips that let one pin read them all.</p>`,
  wiring: {
    intro: "Check your work against this build, lesson 2.1's circuit on the bench's board. Yours may sit somewhere else and still be right. What matters is which strips are joined.",
    rows: [
      { from: "Nano", to: "Columns 3–17, rows c and g", note: "Across the groove: digital pins in row c, analog and power pins in row g" },
      { from: "Nano 5V (14g)", to: "FSR pin 1 (24j)", note: "Red wire from 14h to 24h" },
      { from: "Nano A0 (6g)", to: "FSR pin 2 (25j)", note: "Yellow wire from 6i to 25i" },
      { from: "FSR pin 2 (25j)", to: "10 kΩ resistor (25g)", note: "Same strip, 25f–25j: where A0 listens" },
      { from: "10 kΩ resistor (25e)", to: "Nano GND (14c)", note: "Black wire from 25b to 14b. The resistor itself crosses the groove." },
      { from: "Nano USB", to: "Computer", note: "Power in, the sketch in, the readings out" },
    ],
    foot: "The FSR's tail runs off the board's lower edge. Either GND pin works, and so does a wire through the rails.",
  },
  code: {
    lang: "cpp",
    caption: "C++ · Arduino · the sketch the tiles make",
    source: `// Lesson 2.1's sketch, built from tiles
void setup() {
  Serial.begin(9600);  // open the USB link
}

void loop() {
  int value = analogRead(A0);  // 0-1023
  Serial.println(value);  // one line each
  delay(100);  // about 10 a second
}`,
    params: [],
    notes: [
      "<code>setup()</code> runs once. <code>Serial.begin(9600)</code> opens the USB link at 9600 baud, and the Serial Monitor must listen at the same rate.",
      "<code>loop()</code> runs again and again: read A0 into <code>value</code>, send it as one line, pause for 100 ms.",
      "Order matters. A variable exists only after the line that makes it, and only inside its own function. A sketch that prints <code>value</code> before reading it does not compile.",
      "Each decoy tile breaks one thing. <code>digitalRead</code> gives only 0 or 1, <code>Serial.print</code> runs the numbers together, and <code>pinMode(A0, OUTPUT)</code> fights the sensor. 115200 baud works only with the monitor at 115200 too.",
    ],
  },
  specs: [
    { label: "Breadboard", value: "Half size, 400 holes", src: SF_BOARD, badge: "external", note: "30 columns of 10 holes, and 2 pairs of power rails" },
    { label: "Hole spacing", value: "2.54 mm (0.1 in)", src: SF_BOARD, badge: "external" },
    { label: "One strip", value: "5 holes joined", src: SF_HOW, badge: "external", note: "Rows a–e of one column, or rows f–j" },
    { label: "Middle groove", value: "Keeps the two halves apart", src: SF_HOW, badge: "external", note: "Chips and the Nano sit across it" },
    { label: "Power rails", value: "Joined along their length", src: SF_HOW, badge: "external", note: "Usually; some longer boards break them in the middle" },
    fact("board.R1", "Pull-down resistor", { note: "Same value as R1 on the reading board" }),
    {
      label: "Counts as working",
      value: `A ${F_PRESS} N press moves the reading by ${RESPONSIVE} or more`,
      src: "in-browser model: src/widgets/build/verdict.ts (F_PRESS, RESPONSIVE)",
      badge: "illustrative",
      note: "This bench's own pass mark, about 0.5 V",
    },
    {
      label: "FSR curve on the bench",
      value: "Adafruit's 4 points, joined on log-log axes",
      src: FSR_TABLE_SRC,
      badge: "illustrative",
      note: `${FSR_TABLE.map(([f, r]) => `${f} N → ${ohms(r)}`).join(", ")}; the same curve as lesson 2.1`,
    },
  ],
  steps: [
    {
      title: "Place the Nano",
      // keep every text to 3 lines in a 475-530 px column (1366-1440 px windows)
      text: "Drag the Nano from the tray on the right onto the breadboard. It snaps across the middle groove, one row of pins on each side. Click any part to see what it is, and drag empty space to turn the view.",
      start: true,
      widgetView: { view: "nano" },
    },
    {
      title: "Add the sensor and the resistor",
      text: "Drag the force sensor (FSR) and the 10 kΩ resistor onto the board. Each leg needs its own strip, or the part is bypassed. To turn a part, pick it and press R.",
      widgetView: { view: "parts" },
    },
    {
      title: "Wire it",
      text: "Drag from a hole to a hole to lay a jumper wire: 5V to one FSR leg, A0 to the other leg and the resistor, the resistor to GND. The diagram in the panel lights each link you make.",
      widgetView: { view: "wires" },
    },
    {
      title: "Write the sketch",
      text: "Drag the code tiles into setup() and loop(). Some are decoys. You can type in the boxes: pin, baud rate and pause. Verify checks that it compiles.",
      widgetView: { view: "sketch" },
    },
    {
      title: "Upload and press",
      text: `Plug in USB, upload, then press the sensor. One sensor took one of the Nano's 8 analog pins, and a pad has ${TAXELS} crossings. Lesson 2.3 shows how one pin reads them all.`,
      widgetView: { view: "run" },
    },
  ],
  quiz: [
    {
      q: "The Serial Monitor shows 1023 all the time, pressed or not. What went wrong?",
      choices: [
        "The sensor's two legs are in one strip",
        "The resistor is missing",
        "The sketch and the monitor use different baud rates",
        "The USB cable is unplugged",
      ],
      answer: 0,
      why: "The strip joins the sensor's two legs, so the sensor is bypassed. A0 sits at 5 V and analogRead returns 1023 whatever you do. Turn the sensor so its legs go into two strips.",
    },
    {
      q: "The readings wander at random, even when nobody touches the sensor. What went wrong?",
      choices: ["The sketch reads A0 too often", "Nothing links A0 to GND", "The sensor is pressed too lightly", "The 5V wire is too long"],
      answer: 1,
      why: "Untouched, the sensor is an open circuit. Without the pull-down resistor to GND, nothing sets A0's voltage, so the pin floats and its readings drift. The 10 kΩ from A0's strip to GND holds it at 0 V.",
    },
    {
      q: "The Serial Monitor fills with ⸮⸮⸮ and odd signs. What went wrong?",
      choices: ["The sensor is pressed too hard", "The resistor is in backwards", "The sketch and the monitor use different baud rates", "Serial.println should be Serial.print"],
      answer: 2,
      why: "Both ends must agree on how fast the bits come. At different rates the monitor cuts the stream in the wrong places, and the bytes come out as gibberish. Set the monitor to the rate in Serial.begin. A resistor has no backwards, by the way.",
    },
  ],
};
