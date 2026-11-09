// One force-sensing resistor (FSR) read through a 10 kΩ pull-down on an Arduino's A0 (Lesson 2.1, the arduino-bench
// widget; Lesson 2.2's multiplexer reuses R_LIGHT). ILLUSTRATIVE: the press -> resistance curve goes through the four
// points of Adafruit's table for an Interlink FSR 402 (learn.adafruit.com/force-sensitive-resistor-fsr), joined on
// log-log axes (a power law between each pair of neighbouring points, which is how Adafruit draws it); the guide says
// real sensors vary by about 10 %. Untouched, the FSR is an open circuit (Interlink: more than 10 MΩ), so A0 reads 0.
// Everything after the resistance is exact:
//   V(A0) = 5 V × R / (R + R_FSR)      (the same 10 kΩ as R1 on the reading board, shared/data/constants.mjs)
//   analogRead = floor(V × 1024 / 5), clamped to 0..1023   (@shared/models/adc.mjs, ATmega328P datasheet §24.7)
import { R1, VCC } from "@shared/data/constants.mjs";
import { adcCode, MAX_CODE, STEPS } from "@shared/models/adc.mjs";

export { MAX_CODE, R1, STEPS, VCC };

/** Adafruit's table (force in N, resistance in Ω), measured with a 5 V supply and a 10 kΩ pull-down. */
export const FSR_TABLE: readonly (readonly [number, number])[] = [
  [0.2, 30000],
  [1, 6000],
  [10, 1000],
  [100, 250],
];
export const FSR_TABLE_SRC = "https://learn.adafruit.com/force-sensitive-resistor-fsr?view=all";

/** The press range the bench offers: Interlink's "~0.2 N – 20 N" sensitivity range for the FSR 400 series. */
export const F_MIN = 0.2;
export const F_MAX = 20;

/** The FSR's resistance (Ω) at a force (N): through the table's points on log-log axes (past either end, the nearest
 *  pair's power law); Infinity when nothing presses (an open circuit). */
export function fsrOhms(force: number): number {
  if (!(force > 0)) return Infinity;
  const T = FSR_TABLE;
  let i = 0;
  while (i < T.length - 2 && force > T[i + 1][0]) i++;
  const [f0, r0] = T[i];
  const [f1, r1] = T[i + 1];
  const b = Math.log(r1 / r0) / Math.log(f1 / f0);
  return r0 * Math.pow(force / f0, b);
}

/** A light press (1 N): 6 kΩ, Adafruit's table. Lesson 2.2's multiplexer shows its pressed FSRs at this value, so the
 *  two lessons read the same sensor the same way. */
export const R_LIGHT = fsrOhms(1);

/** How hard, 0..1 (the bench's drag or slider), to newtons on a log scale: 0 -> 0.2 N, 1 -> 20 N. */
export function forceAt(level: number): number {
  const k = Math.min(1, Math.max(0, level));
  return F_MIN * Math.pow(F_MAX / F_MIN, k);
}

export interface Reading {
  /** N (0 = untouched) */
  force: number;
  /** the FSR, Ω (Infinity untouched) */
  ohms: number;
  /** at A0 */
  volts: number;
  /** analogRead(A0), 0..1023 */
  code: number;
  /** through the FSR and the 10 kΩ, A */
  amps: number;
}

/** Everything the bench shows for a force (N; 0 or less = untouched). */
export function readAt(force: number): Reading {
  const ohms = fsrOhms(force);
  const amps = Number.isFinite(ohms) ? VCC / (R1 + ohms) : 0;
  const volts = amps * R1;
  return { force: force > 0 ? force : 0, ohms, volts, code: adcCode(volts), amps };
}

/** One step of the ADC: 5 V / 1024 ≈ 4.9 mV. */
export const STEP_MV = (VCC / STEPS) * 1000;
