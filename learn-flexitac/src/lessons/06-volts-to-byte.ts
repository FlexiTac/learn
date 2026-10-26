// Lesson 6: from volts to a byte. 10-bit ADC (0-1023), raw >> 2 -> 0-255, why a byte, and the ADC clock trade-off
// (external: ATmega328P datasheet). Widget: adc-ladder. Code: a minimal Arduino sketch that reads one crossing.
import { BAUD, COLS, FRAME_BYTES, FRAME_HZ, MUX_OFFSET, R1, ROWS, VCC } from "@shared/data/constants.mjs";
import { ADC_CLOCK_HZ, BITS, CONVERSION_CYCLES, MAX_CODE, PRESCALER, STEPS, adcCode, toByte } from "@shared/models/adc.mjs";
import { vA0 } from "@shared/models/divider.mjs";
import { R_HARD, R_REST, R_STOPS } from "@shared/models/taxel.mjs";
import { fact, getFact } from "../content/facts";
import type { Lesson } from "../types";
import { bits, kOhm, volts } from "./_crossing";

const R1K = R1 / 1000;
const STEP_MV = (VCC / STEPS) * 1000; // 4.88 mV
const BYTE_MV = STEP_MV * 4; // 19.5 mV
const MAX_BYTE = toByte(MAX_CODE); // 255

const at = (r: number) => {
  const v = vA0(r);
  const code = adcCode(v);
  return { v, code, byte: toByte(code) };
};
const REST = at(R_REST);
const MID = at(R1);
const HARD = at(R_HARD);
const STOP_R1 = R_STOPS.indexOf(R1);
const [REST_LO, REST_HI] = getFact("host.restingBytes").value as [number, number];

// Timing: how long the firmware may spend on each reading, and what the ADC clock allows.
const TAXELS = ROWS * COLS;
const BUDGET_US = 1e6 / (TAXELS * FRAME_HZ); // ~26 us per reading at 100 frames/s
const CPU_HZ = ADC_CLOCK_HZ * PRESCALER; // 16 MHz
const DEFAULT_PRESCALER = 128; // Arduino core default at 16 MHz (external)
const DEFAULT_ADC_HZ = CPU_HZ / DEFAULT_PRESCALER; // 125 kHz
const conv_us = (hz: number) => (CONVERSION_CYCLES / hz) * 1e6;
const DEFAULT_FPS = Math.floor(1e6 / (conv_us(DEFAULT_ADC_HZ) * TAXELS)); // ~25 frames/s, conversions alone
// Serial: one byte travels as 10 bits on the wire (start + 8 data + stop, external)
const BYTES_PER_S = FRAME_BYTES * FRAME_HZ;
const FRAME_MS = ((FRAME_BYTES * 10) / BAUD) * 1000;
const kHz = (hz: number) => (hz >= 1e6 ? `${hz / 1e6} MHz` : `${hz / 1e3} kHz`);

export const lesson: Lesson = {
  id: "volts-to-byte",
  n: 6,
  title: "From volts to a byte",
  kicker: "The crossing",
  lede: `The Arduino's ADC turns 0–${VCC} V into a whole number from 0 to ${MAX_CODE}. The firmware then keeps only the top 8 bits: one byte, 0 to ${MAX_BYTE}.`,
  status: "ready",
  features: [
    { icon: "pulse", title: `${BITS}-bit ADC`, text: `0–${MAX_CODE} for 0–${VCC} V, steps of ${STEP_MV.toFixed(2)} mV` },
    { icon: "byte", title: "Shift right by 2", text: `0–${MAX_BYTE} fits in one byte` },
    { icon: "clock", title: `${kHz(ADC_CLOCK_HZ)} ADC clock`, text: `${kHz(CPU_HZ)} ÷ ${PRESCALER}: fast, a little less accurate` },
  ],
  figure: {
    fig: "crossing",
    reset: [{ name: "release" }],
  },
  widget: "adc-ladder",
  overview: `
<p><b>Voltages are smooth, computers count.</b> The voltage at A0 can be any value between 0 and ${VCC} V, but the Arduino
can only store whole numbers. The part that bridges the two is the <dfn>ADC</dfn> (analog-to-digital converter). Think of
it as a ruler with ${STEPS} marks between 0 V and ${VCC} V. Each gap is ${VCC} V ÷ ${STEPS} ≈ <b>${STEP_MV.toFixed(2)} mV</b>.
The ADC reports how many whole gaps fit under the voltage:</p>
<p style="text-align:center;font-family:var(--mono)">ADC = floor(V<sub>A0</sub> × ${STEPS} ÷ ${VCC} V), from 0 to ${MAX_CODE}</p>

<p><b>Why ${STEPS}?</b> The ADC finds the number with a guessing game. "Is it above half of ${VCC} V?" Yes or no. "Above
three quarters?" Each answer halves what's left and gives one <dfn>bit</dfn> (a binary digit, 0 or 1). After ${BITS}
questions it has narrowed ${STEPS} = 2<sup>${BITS}</sup> possibilities down to one. That is why the Nano's ADC is called
${BITS}-bit. (Engineers call this guessing game <i>successive approximation</i>.)</p>

<p><b>Our three test presses</b> (illustrative taxel values):</p>
<ul>
  <li>Untouched: ${volts(REST.v)} → ADC <b>${REST.code}</b> → byte <b>${REST.byte}</b>. That sits inside the
    ${REST_LO}–${REST_HI} that the PyFlexiTac software says untouched taxels typically read, which is how lesson 4's resting value was chosen.</li>
  <li>R<sub>taxel</sub> = R1: ${volts(MID.v)} → ADC <b>${MID.code}</b> → byte <b>${MID.byte}</b>.</li>
  <li>Hard press: ${volts(HARD.v)} → ADC <b>${HARD.code}</b> → byte <b>${HARD.byte}</b>.</li>
</ul>

<p><b>From ${BITS} bits to 8.</b> The firmware sends <code>raw &gt;&gt; 2</code>: shift the binary number right by two
places. The last two binary digits fall off the end. In decimal, chopping two digits off 1234 gives 12, which divides by 100;
in binary, chopping two digits divides by 4 (and throws the remainder away). So ${HARD.code} (${bits(HARD.code, BITS)})
becomes ${HARD.byte} (${bits(HARD.byte, 8)}). ${STEPS} ÷ 4 = ${STEPS / 4} values, 0 to ${MAX_BYTE}: exactly one
<dfn>byte</dfn>. Each byte step is 4 ADC steps, about ${BYTE_MV.toFixed(1)} mV.</p>

<p><b>Why squeeze it into a byte?</b> A serial link sends whole bytes. A ${BITS}-bit reading would need two bytes,
and the computer would have to glue each pair back together. With one byte per taxel a frame is 2 header bytes +
${TAXELS} readings = ${FRAME_BYTES} bytes, and ${FRAME_HZ} frames a second is ${BYTES_PER_S.toLocaleString("en-US")} bytes per second.
On the wire each byte costs 10 bits (a start bit, 8 data bits and a stop bit), so at ${BAUD.toLocaleString("en-US")} baud one frame
takes about ${FRAME_MS.toFixed(1)} ms. Two bytes per taxel would double that, to carry the two least trustworthy bits (next paragraph).</p>

<p><b>Speed versus accuracy</b> <span class="badge badge-external" title="From outside the FlexiTac materials (e.g. a datasheet)">external</span>.
To read ${TAXELS} taxels ${FRAME_HZ} times a second, the Nano has only about ${Math.round(BUDGET_US)} µs per reading.
One conversion takes ${CONVERSION_CYCLES} ticks of the ADC's own clock. Arduino's default ADC clock is ${kHz(CPU_HZ)} ÷ ${DEFAULT_PRESCALER} = ${kHz(DEFAULT_ADC_HZ)},
which means ${Math.round(conv_us(DEFAULT_ADC_HZ))} µs per conversion: too slow, at most about ${DEFAULT_FPS} frames a second. So the
firmware sets the clock divider (the <dfn>prescaler</dfn>) to ${PRESCALER}: ${kHz(ADC_CLOCK_HZ)}, ${Math.round(conv_us(ADC_CLOCK_HZ))} µs per conversion.
The catch: the ATmega328P datasheet only promises full ${BITS}-bit accuracy with an ADC clock between 50 and 200 kHz. At
${kHz(ADC_CLOCK_HZ)} the lowest bits get less trustworthy. Since the firmware drops the bottom two bits anyway, the trade costs
little, but expect the last bit of each byte to wobble a little.</p>

<p class="aside">Press the plunger and watch the ladder under the figure: the voltage lands on one rung, and four rungs make one byte.</p>`,
  wiring: {
    intro: "Inside the Nano: from the voltage on A0 to the byte on the USB cable.",
    rows: [
      { from: "A0 (divider midpoint)", to: "ADC input", note: `A voltage between 0 and ${VCC} V.` },
      { from: `AVcc = ${VCC} V`, to: "ADC reference", note: `The top of the ruler: ${VCC} V reads as ${STEPS} (it tops out at ${MAX_CODE}).` },
      { from: `${kHz(CPU_HZ)} clock ÷ ${PRESCALER}`, to: "ADC clock", note: `${kHz(ADC_CLOCK_HZ)}: ${CONVERSION_CYCLES} ticks per reading.` },
      { from: `ADC result (${BITS} bits)`, to: "raw >> 2", note: `Keep the top 8 bits: 0–${MAX_BYTE}.` },
      { from: "Byte", to: "Serial over USB", note: `${BAUD.toLocaleString("en-US")} baud, one byte per taxel, ${FRAME_BYTES} bytes per frame.` },
    ],
    foot: `The 50–200 kHz recommendation, the ${CONVERSION_CYCLES}-tick conversion and Arduino's default ÷${DEFAULT_PRESCALER} come from the ATmega328P datasheet and the Arduino core, not the FlexiTac materials.`,
  },
  code: {
    lang: "cpp",
    caption: "Arduino · read one taxel, print its byte",
    source: `// One taxel: drive line 1 x sense line 1
const float R1 = {{r1}}; // display only

void setup() {
  Serial.begin(115200);
  for (int p = 2; p <= 8; p++)
    pinMode(p, OUTPUT);   // D2-D8
  // sense line 1 (i = 0) = mux channel ${MUX_OFFSET}
  int ch = 0 + ${MUX_OFFSET};
  for (int b = 0; b < 4; b++)
    digitalWrite(4 + b, bitRead(ch, b));
  digitalWrite(8, LOW);   // E# low: mux on
  digitalWrite(2, HIGH); // 1 into the 595s
  for (int k = 0; k < 2; k++) {  // 2 ticks:
    digitalWrite(3, HIGH); // outputs lag
    digitalWrite(3, LOW);  // one tick
    digitalWrite(2, LOW);
  }
}

void loop() {
  int raw = analogRead(A0);    // 0..${MAX_CODE}
  byte b = raw >> 2;           // 0..${MAX_BYTE}
  float v = raw * ${VCC.toFixed(1)} / ${STEPS};  // volts
  float r = R1 * (${VCC.toFixed(1)} / v - 1); // taxel+mux
  Serial.print(b);
  Serial.print("  ");
  Serial.println(r / 1000);    // kOhm
  delay(100);
}`,
    params: [{ name: "r1", label: "R1 in the code (Ω)", min: 1000, max: 100000, step: 1000, value: R1 }],
    notes: [
      `<b>setup()</b> picks one crossing, like the real firmware does before each reading: the multiplexer's select pins D4–D7 choose channel ${MUX_OFFSET} (sense line 1), D8 switches the mux on, and two clock pulses on D3 push a single 1 into the shift registers so only drive line 1 gets ${VCC} V (lessons 7 and 8 explain both chips).`,
      `<b>analogRead(A0)</b> returns the ${BITS}-bit ADC value, 0–${MAX_CODE}. <code>raw &gt;&gt; 2</code> keeps the top 8 bits, exactly what the FlexiTac firmware sends.`,
      `The last two lines run the divider backwards to estimate the taxel's resistance: R = R1 × (${VCC} ÷ V − 1). The answer includes the mux's R<sub>on</sub>.`,
      `<b>R1 is display only.</b> The board has a ${R1K} kΩ resistor soldered on. Changing <code>R1</code> here does not change the circuit or the byte; it only changes the estimate, which is then wrong. Try 20000 and Run.`,
      `This sketch leaves the ADC clock at Arduino's default (${kHz(DEFAULT_ADC_HZ)}, full accuracy) and prints text at 115200 baud for the Serial Monitor. The real firmware uses a ${kHz(ADC_CLOCK_HZ)} ADC clock and sends raw bytes at ${BAUD.toLocaleString("en-US")} baud.`,
      "<b>Run</b> reads the crossing in the figure: press the plunger first, then Run.",
    ],
    run(p, ctx) {
      const st = ctx.figure?.lastState;
      const r = typeof st?.rTaxel === "number" ? st.rTaxel : R_REST;
      const v = vA0(r);
      const raw = adcCode(v);
      const b = toByte(raw);
      const vq = (raw * VCC) / STEPS;
      const est = vq > 0 ? p.r1 * (VCC / vq - 1) : Infinity;
      const lines = [
        `> ${b}  ${Number.isFinite(est) ? (est / 1000).toFixed(2) : "inf"}`,
        `  figure: R_taxel ${kOhm(r)} (illustrative) → A0 ${volts(v, 3)} → raw ${raw} → byte ${b}`,
      ];
      if (Math.round(p.r1) !== R1)
        lines.push(`  R1 in the code is ${p.r1} Ω, but the board has ${R1} Ω: same byte, estimate off by ×${(p.r1 / R1).toFixed(2)}`);
      else lines.push(`  estimate ≈ R_taxel + R_on, off a little because raw is rounded down`);
      return lines;
    },
  },
  specs: [
    {
      label: "ADC",
      value: `${BITS} bits · 0–${MAX_CODE} for 0–${VCC} V`,
      src: "shared/models/adc.mjs; ATmega328P datasheet (external)",
      badge: "external",
      note: `One step ≈ ${STEP_MV.toFixed(2)} mV`,
    },
    fact("firmware.adcToByte", "ADC → byte", { value: (v) => `<code>${v}</code> · 0–${MAX_BYTE}` }),
    fact("firmware.adcPrescaler", "ADC prescaler", { value: (v) => `÷ ${v} → ${kHz(CPU_HZ / v)}` }),
    {
      label: "Recommended ADC clock",
      value: `50–200 kHz for full ${BITS}-bit accuracy`,
      src: "ATmega328P datasheet, ADC prescaling and conversion timing (external)",
      badge: "external",
    },
    {
      label: "Conversion time",
      value: `${CONVERSION_CYCLES} ADC clocks = ${Math.round(conv_us(ADC_CLOCK_HZ))} µs at ${kHz(ADC_CLOCK_HZ)}`,
      src: "ATmega328P datasheet (external); shared/models/adc.mjs",
      badge: "external",
    },
    fact("host.restingBytes", "Typical resting byte", { value: (v) => `${v[0]}–${v[1]}` }),
    fact("firmware.frameBytes", "Frame size", { note: "AA 55 + one byte per taxel" }),
    fact("firmware.baud", "Serial speed"),
    {
      label: "Byte at rest → hard press",
      value: `${REST.byte} → ${HARD.byte}`,
      src: "computed: shared/models/taxel.mjs + divider.mjs + adc.mjs",
      badge: "illustrative",
    },
  ],
  steps: [
    {
      title: "Resting reading",
      text: `Untouched: A0 is ${volts(REST.v)}, which is rung <b>${REST.code}</b> of the ladder. Shifted right by 2, the firmware sends byte <b>${REST.byte}</b>.`,
      act: { name: "release" },
    },
    {
      title: "Halfway up the ladder",
      text: `With R<sub>taxel</sub> = R1, A0 is ${volts(MID.v)}: ADC <b>${MID.code}</b> (${bits(MID.code, BITS)}) → byte <b>${MID.byte}</b> (${bits(MID.byte, 8)}). The last two bits are gone.`,
      act: { name: "stop", arg: STOP_R1 >= 0 ? STOP_R1 : { ohms: R1 } },
    },
    {
      title: "Hard press",
      text: `Pressed hard: ${volts(HARD.v)} → ADC <b>${HARD.code}</b> → byte <b>${HARD.byte}</b>. The byte never reaches ${MAX_BYTE}, because A0 never reaches ${VCC} V.`,
      act: { name: "press", arg: 1 },
    },
  ],
  quiz: [
    {
      q: `How many different values can a ${BITS}-bit ADC report?`,
      choices: [String(BITS), String(MAX_BYTE + 1), String(STEPS), String(VCC * 1000)],
      answer: 2,
      why: `Each bit doubles the count: 2 × 2 × … ten times = 2<sup>${BITS}</sup> = ${STEPS} values, 0 to ${MAX_CODE}.`,
    },
    {
      q: `The ADC reads ${HARD.code}. Which byte does the firmware send?`,
      choices: [String(HARD.code % 256), String(HARD.byte), String(Math.round(HARD.code / 10)), String(MAX_BYTE)],
      answer: 1,
      why: `raw &gt;&gt; 2 divides by 4 and drops the remainder: ${HARD.code} ÷ 4 = ${HARD.byte}.`,
    },
    {
      q: `Why does the firmware send one byte per taxel instead of the full ${BITS}-bit value?`,
      choices: [
        `The Arduino can't store ${BITS}-bit numbers`,
        "Serial sends whole bytes: one per taxel halves the data, and the dropped bits are the noisiest",
        "Python can only read bytes below 100",
        "It makes the taxels more sensitive",
      ],
      answer: 1,
      why: `A ${BITS}-bit value needs two bytes on a serial link. One byte keeps each frame at ${FRAME_BYTES} bytes and costs only the two least trustworthy bits.`,
    },
    {
      q: `The firmware runs the ADC at ${kHz(ADC_CLOCK_HZ)} instead of Arduino's default ${kHz(DEFAULT_ADC_HZ)}. What does it trade?`,
      choices: ["Speed for accuracy: it's slower but more exact", `Accuracy for speed: fast enough for ${FRAME_HZ} frames/s, slightly less exact`, "Nothing: faster is always better", "Battery life"],
      answer: 1,
      why: `At ${kHz(DEFAULT_ADC_HZ)} conversions alone would cap the pad at about ${DEFAULT_FPS} frames/s. The datasheet promises full accuracy only at 50–200 kHz, so the faster clock costs some accuracy in the lowest bits.`,
    },
  ],
};
