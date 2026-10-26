// ATmega328P 10-bit ADC (Vref = AVcc = 5 V) and the firmware's 8-bit packing.
//   code = floor(V * 1024 / Vref), clamped to 0..1023   (datasheet: ADC = Vin*1024/Vref)
//   byte = code >> 2                                    (firmware: (byte)(raw_reading >> 2))
import { VCC, ADC_BITS } from '../data/constants.mjs';

export const BITS = ADC_BITS;           // 10
export const STEPS = 1 << ADC_BITS;     // 1024
export const MAX_CODE = STEPS - 1;      // 1023
export const VREF = VCC;                // 5 V
export const PRESCALER = 16;            // firmware: ADPS2=1, ADPS1=0, ADPS0=0
export const ADC_CLOCK_HZ = 16e6 / PRESCALER;   // 1 MHz
export const CONVERSION_CYCLES = 13;            // normal conversion (datasheet)
export const CONVERSION_S = CONVERSION_CYCLES / ADC_CLOCK_HZ; // 13 us

/** 10-bit ADC code for a voltage. */
export function adcCode(v, vref = VREF) {
  const c = Math.floor((v * STEPS) / vref);
  return Math.min(MAX_CODE, Math.max(0, c));
}

/** 10-bit code -> the byte the firmware sends. */
export function toByte(code) {
  return (code >> 2) & 0xff;
}

/** Voltage -> sent byte. */
export function voltsToByte(v, vref = VREF) {
  return toByte(adcCode(v, vref));
}

/** Lower edge of the voltage bin for a code (inverse of adcCode). */
export function codeToVolts(code, vref = VREF) {
  return (code * vref) / STEPS;
}

/** Centre voltage represented by a sent byte (4 codes per byte). */
export function byteToVolts(b, vref = VREF) {
  return ((b * 4 + 2) * vref) / STEPS;
}
