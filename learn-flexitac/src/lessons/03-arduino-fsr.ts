// Lesson 2.1: Arduino reads one force sensor (2026-11-09, PLAN-section2-basics.md). A short meeting with the Arduino Nano
// (modelled on Learn Arduino's "Meet the board" and "Feel the force", structure only: no assets reused), then one
// force-sensing resistor (FSR) read through a 10 kΩ pull-down on A0 with analogRead, and, leading into Lesson 2.3, how
// 8 analog pins read FlexiTac's 384 crossings: a switch on each line joins one crossing at a time to A0 (2026-11-15). The stage is src/widgets/arduino-bench.ts (a realistic render of the bench,
// flexitac-anatomy/figures/bench); each step picks its view. Numbers: the Arduino and Interlink docs (external), the
// shared data (R1, the ADC, the frame rate), and an illustrative FSR curve through Adafruit's table
// (src/widgets/bench/fsr.ts, which Lesson 2.3 reuses).
import { COLS, FRAME_HZ, ROWS } from "@shared/data/constants.mjs";
import { adcCode, CONVERSION_S, PRESCALER, STEPS } from "@shared/models/adc.mjs";
import { fact } from "../content/facts";
import type { Lesson } from "../types";
import { FSR_TABLE, FSR_TABLE_SRC, STEP_MV } from "../widgets/bench/fsr";

const TAXELS = ROWS * COLS;
/** The Arduino core's own ADC prescaler at 16 MHz (ArduinoCore-avr wiring.c "16 MHz / 128 = 125 KHz"). */
const ARDUINO_PRESCALER = 128;
const FASTER = ARDUINO_PRESCALER / PRESCALER; // 8
const FIRMWARE_US = Math.round(CONVERSION_S * 1e6); // 13
const ohms = (r: number) => (r >= 1000 ? `${r / 1000} kΩ` : `${r} Ω`);
const NANO = "https://docs.arduino.cc/hardware/nano/ (Tech Specs)";
const READ = "https://docs.arduino.cc/language-reference/en/functions/analog-io/analogRead/";
const FSR_SHEET = "https://www.interlinkelectronics.com/downloads/datasheets/fsr-400-series-datasheet.pdf";

export const lesson: Lesson = {
  id: "arduino-fsr",
  n: 7,
  title: "Arduino reads one force sensor",
  kicker: "Arduino basics",
  lede: `Meet the Arduino Nano, the small computer on the reading board. Then wire one force sensor to it and read how hard you press, as a number from 0 to ${STEPS - 1}.`,
  status: "ready",
  features: [
    { icon: "chip", title: "Arduino Nano", text: "A small board you program from your computer" },
    { icon: "touch", title: "One force sensor", text: "Press it and its resistance falls" },
    { icon: "pulse", title: "analogRead(A0)", text: `Turns 0–5 V into a number from 0 to ${STEPS - 1}` },
  ],
  widget: "arduino-bench",
  overview: `
<p>An <dfn>Arduino</dfn> is a small open-source board with one programmable chip on it, plus the free Arduino IDE, the
program on your computer where you write its code. It was made for students who had never built electronics. FlexiTac's
reading board runs on one too, an Arduino Nano.</p>
<p>The chip is a <dfn>microcontroller</dfn>, a whole small computer on one chip. On the Nano it is an ATmega328P. You
write a program for it on your computer, called a <dfn>sketch</dfn>, and upload it over the USB cable. Every sketch has
a <code>setup()</code>, which runs once when the board starts, and a <code>loop()</code>, which then runs again and again
for as long as the board has power.</p>
<p>The pins along the Nano's two long edges join it to the circuit you build. The <dfn>digital pins</dfn>, D0 to D13,
have only two states, <dfn>HIGH</dfn> (5 V) and LOW (0 V), which is enough to switch a light on and off. The
<dfn>analog pins</dfn>, A0 to A7, can measure any voltage from 0 to 5 V. The power pins feed what you connect. The two
you will use most are 5V and <dfn>ground</dfn> (GND), the 0 V side that every voltage is measured from.</p>
<p>To try a circuit without soldering, you push the Nano into a <dfn>breadboard</dfn>. Inside it, a metal strip joins
each short row of five holes, so parts pushed into the same row are connected. A groove down the middle keeps the rows
on its two sides apart, so the Nano sits across it and its two rows of pins are not joined. <dfn>Jumper wires</dfn> join
rows that are far apart.</p>
<p>The sensor is a <dfn>force-sensing resistor</dfn>, or FSR, a thin disc whose resistance falls as you press it. It
goes from more than 10 MΩ (ten million ohms) when nothing touches it to a few hundred ohms under a hard press. But the
Arduino cannot measure a resistance. Its analog pins measure only voltage.</p>
<p>So the FSR gets a partner, a 10 kΩ resistor from A0 to ground called a <dfn>pull-down resistor</dfn>. Current goes
from 5V through the FSR, then through the 10 kΩ, to ground. A0 sits between the two.</p>
<p>Together they make a <dfn>voltage divider</dfn>. The two share the 5 V, and the bigger resistance takes the bigger
share. Untouched, the FSR is so large that it takes nearly all of it, and A0 sits at about 0 V. Press, and the FSR
shrinks. More of the 5 V lands on the 10 kΩ, and A0, at the top of that resistor, climbs toward 5 V.</p>
<p>As a formula, A0 gets V = 5 V × 10 kΩ / (10 kΩ + R<sub>FSR</sub>), where R<sub>FSR</sub> is the FSR's resistance.
Press until it falls to 10 kΩ, the same as its partner, and A0 sits at 2.5 V, halfway. Lesson 1.2's touch spot used the
same circuit with the same 10 kΩ, which the reading board calls R1.</p>
<p>Inside the microcontroller, an <dfn>ADC</dfn> (analog-to-digital converter) turns that voltage into a number. It splits
0–5 V into ${STEPS} steps of about ${STEP_MV.toFixed(1)} mV each, so <dfn>analogRead()</dfn> returns a whole number from 0
to ${STEPS - 1}. One reading takes about 100 µs, so the Nano can read A0 about 10,000 times a second. That is too slow for
FlexiTac, which reads all ${TAXELS} crossings ${FRAME_HZ} times a second. Its firmware runs the ADC ${FASTER} times faster,
about ${FIRMWARE_US} µs a reading (Lesson 2.6).</p>
<p>To see the numbers, the sketch sends each one back over USB with <code>Serial.println()</code>. The Arduino IDE shows
them as lines of text in its <dfn>Serial Monitor</dfn>, or draws them as a moving line in its Serial Plotter.</p>
<p>FlexiTac's own firmware sends raw bytes instead of text, because that is faster. That is why Lesson 1.4 warns that the
Serial Monitor shows gibberish there. A byte goes only up to 255, so the firmware divides each reading by 4 before
sending it. Those are the 0 to 255 readings you met in Lesson 1.3.</p>
<p>Each crossing of a FlexiTac pad works like a tiny FSR. It is a top line and a bottom line with Velostat between, and
its resistance falls when you press. There is one difference. Velostat conducts a little even when nothing presses it,
so an untouched crossing never reads exactly 0.</p>
<p>One pad has ${TAXELS} crossings, and the Nano has 8 analog pins, so one pin per crossing cannot work. FlexiTac does
not need that. The pad has only ${ROWS} sense lines and ${COLS} drive lines, and every crossing is where one of each meets.
A switch on each line picks one crossing: 5 V goes onto its drive line, and its sense line is joined to A0. A0 then reads
that crossing alone, the same way it reads the FSR here. Then the switches move to the next crossing, through all
${TAXELS} of them ${FRAME_HZ} times a second. Step 4 shows this slowed down, and Lesson 2.3 builds the switches from two
kinds of chip.</p>`,
  wiring: {
    intro: "Three jumper wires make the circuit. Each FSR pin and each resistor leg shares a short row of five holes with a wire's end, and the holes of one row are joined inside the board. The resistor reaches across the groove to a row of its own, where the black wire meets it. Neither the FSR nor the resistor has a right way round, and either GND pin will do.",
    rows: [
      { from: "Nano 5V", to: "FSR, one pin", note: "Red wire: 5 V into the sensor" },
      { from: "FSR, other pin", to: "Nano A0", note: "Yellow wire: A0 measures the voltage here" },
      { from: "FSR, other pin", to: "10 kΩ resistor", note: "Same row: the pull-down starts where A0 listens" },
      { from: "10 kΩ resistor", to: "Nano GND", note: "Black wire: back to 0 V" },
      { from: "Nano USB", to: "Computer", note: "Power in, the sketch in, the readings out" },
    ],
    foot: "Any analog pin would do. This sketch reads A0, the same pin the reading board reads every crossing through.",
  },
  code: {
    lang: "cpp",
    caption: "C++ · Arduino · one force sensor on A0",
    source: `// One force sensor on A0, sent as text
const int WAIT = {{ms}}; // in ms
const int SENSOR = A0;

void setup() {
  Serial.begin(9600); // open the USB link
}

void loop() {
  int value = analogRead(SENSOR); // 0-1023
  Serial.println(value);  // one line of text
  delay(WAIT);            // pause
}`,
    params: [{ name: "ms", label: "WAIT (ms)", min: 10, max: 1000, step: 10, value: 100 }],
    notes: [
      "<code>setup()</code> runs once, when the board starts. <code>Serial.begin(9600)</code> opens the USB link at 9600 baud, a speed the Serial Monitor must match.",
      `<code>loop()</code> runs over and over. Each time, <code>analogRead(SENSOR)</code> measures the voltage on A0 (the pin <code>SENSOR</code> names) and returns a whole number from 0 to ${STEPS - 1}.`,
      "<code>Serial.println(value)</code> sends the number as text and starts a new line, so each reading is one line in the Serial Monitor and one point in the Serial Plotter.",
      "<code>delay(WAIT)</code> pauses for <code>WAIT</code> milliseconds, so 100 means about 10 readings a second.",
    ],
  },
  specs: [
    { label: "Microcontroller", value: "ATmega328P, 16 MHz", src: NANO, badge: "external" },
    { label: "Pins", value: "14 digital (D0–D13), 8 analog (A0–A7)", src: NANO, badge: "external" },
    { label: "Working voltage", value: "5 V", src: NANO, badge: "external", note: "Powered from USB, or 7–12 V on VIN" },
    { label: "USB", value: "Mini-B", src: NANO, badge: "external" },
    { label: "Board size", value: "18 × 45 mm", src: NANO, badge: "external" },
    { label: "ADC", value: `10 bits: 0–${STEPS - 1} for 0–5 V`, src: READ, badge: "external", note: `About ${STEP_MV.toFixed(1)} mV a step` },
    { label: "One analogRead", value: "~100 µs", src: READ, badge: "external", note: "About 10,000 readings a second" },
    { label: "FSR, untouched", value: "> 10 MΩ", src: FSR_SHEET, badge: "external", note: "An open circuit until pressed" },
    { label: "FSR force range", value: "~0.2–20 N", src: FSR_SHEET, badge: "external" },
    fact("board.R1", "Pull-down resistor", { note: "Same value as R1 on the reading board, which is a tiny surface-mount part" }),
    {
      label: "FSR curve on the bench",
      value: "Adafruit's 4 points, joined on log-log axes",
      src: FSR_TABLE_SRC,
      badge: "illustrative",
      note: `${FSR_TABLE.map(([f, r]) => `${f} N → ${ohms(r)}`).join(", ")}; real FSRs vary by about 10 %`,
    },
  ],
  steps: [
    {
      title: "Meet the Arduino Nano",
      // keep every text to 3 lines in a 475-530 px column (1366-1440 px windows)
      text: "This is an Arduino Nano, the same small board that runs FlexiTac. Its microcontroller runs your program, and its pins join it to your circuit. Click a label or a part to light it up.",
      start: true,
      widgetView: { view: "nano" },
    },
    {
      title: "Wire one force sensor",
      text: "Three wires and a 10 kΩ resistor: 5V to the force sensor (FSR), its other pin to A0, the resistor from there to GND. Watch the path light up in that order, and the same circuit in the panel.",
      widgetView: { view: "wire" },
    },
    {
      title: "Press it",
      text: "Press and hold the sensor, and drag down to press harder. Its resistance falls, the voltage at A0 rises and analogRead climbs from 0 toward 1023. The plotter draws it, like the Arduino IDE's.",
      widgetView: { view: "press" },
    },
    {
      title: `8 pins, ${TAXELS} crossings`,
      text: `How can 8 analog pins read ${TAXELS} crossings? Not with a pin each: switches join one crossing at a time to A0 and step through all ${TAXELS}, ${FRAME_HZ} times a second. Lesson 2.3 shows the chips.`,
      widgetView: { view: "pins" },
    },
  ],
  quiz: [
    {
      q: "Why does the force sensor need a 10 kΩ resistor to ground?",
      choices: [
        "It stops the sensor from getting hot",
        "The Arduino needs it to switch on",
        "The Arduino measures only voltage, and the two make a voltage divider",
        "It stores the reading until analogRead asks for it",
      ],
      answer: 2,
      why: "An analog pin measures voltage, not resistance. With the pull-down, the FSR's changing resistance becomes a changing voltage at A0.",
    },
    {
      q: "Nothing touches the FSR. What does analogRead(A0) return?",
      choices: ["0", "512", "1023", "A random number"],
      answer: 0,
      why: `Untouched, the FSR is an open circuit. No current flows, so the pull-down holds A0 at 0 V and analogRead returns ${adcCode(0)}. Without the pull-down, A0 would be joined to nothing and its readings would wander at random.`,
    },
    {
      q: "A0 is at 2.5 V. About what does analogRead(A0) return?",
      choices: ["250", "512", "1023", "2500"],
      answer: 1,
      why: `The ADC splits 0–5 V into ${STEPS} steps, so 2.5 V is halfway: 2.5 × ${STEPS} / 5 = ${adcCode(2.5)}.`,
    },
    {
      q: `How does the reading board read ${TAXELS} crossings with the Nano's 8 analog pins?`,
      choices: [
        `Each analog pin reads ${TAXELS / 8} crossings at once`,
        "Switches join one crossing at a time to A0",
        "It reads 8 crossings and works out the rest",
        `The pad has ${TAXELS} wires, one for each crossing`,
      ],
      answer: 1,
      why: `Switches put 5 V on one drive line and join one sense line to A0, so A0 reads only the crossing where the two meet. Then they move on, through all ${TAXELS} crossings ${FRAME_HZ} times a second.`,
    },
  ],
};
