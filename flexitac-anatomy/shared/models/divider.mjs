// First-order voltage divider at the reading board's A0 node.
//
//   +5 V (selected 595 output, push-pull HIGH)
//     -> R_taxel (the pressed crossing: Top-FPC copper / Velostat / Bottom-FPC copper)
//     -> R_on   (CD74HC4067 switch, ~70 ohm)
//     -> A0 node (mux COM)  -> R1 (10 kOhm) -> GND
//
//   V_A0 = VCC * R1 / (R1 + R_taxel + R_on)
//
// FIRST-ORDER: ignores the 595 output resistance, ADC input current and the
// parallel paths through other pressed taxels on the same sense line (those tie
// the sense line through R_taxel to LOW drive lines and pull V_A0 down).
import { R1, R_ON, VCC } from '../data/constants.mjs';

export { R1, R_ON, VCC };
export const FIRST_ORDER = true;
export const NOTE = 'first-order divider: ignores 595 output resistance and parallel paths through other pressed taxels';
export const SOURCES = {
  R1: 'user-confirmed 2026-10-21 (BOM 1206W4F1002T5E = 10.0 kOhm; the schematic "20k" label is wrong)',
  R_ON: 'CD74HC4067 typical on-resistance (~70 ohm at 4.5 V), LCSC C496123 / TI datasheet',
  VCC: 'Arduino Nano +5V pin = board VCC (schematic)',
};

/** Voltage at A0 for a taxel resistance in ohms. R1 is fixed at 10 kOhm. */
export function vA0(rTaxel, { rOn = R_ON, vcc = VCC } = {}) {
  if (!(rTaxel >= 0)) throw new RangeError('rTaxel must be >= 0 ohm');
  return (vcc * R1) / (R1 + rTaxel + rOn);
}

/** Loop current in amperes. */
export function current(rTaxel, { rOn = R_ON, vcc = VCC } = {}) {
  return vcc / (R1 + rTaxel + rOn);
}

/** Inverse: which R_taxel gives this V_A0 (0 < v < vcc*R1/(R1+rOn)). */
export function rTaxelFromV(v, { rOn = R_ON, vcc = VCC } = {}) {
  if (!(v > 0)) return Infinity;
  return Math.max(0, (vcc * R1) / v - R1 - rOn);
}

/** Everything a readout needs, in SI units. */
export function divider(rTaxel, opts = {}) {
  const rOn = opts.rOn ?? R_ON, vcc = opts.vcc ?? VCC;
  const i = current(rTaxel, { rOn, vcc });
  return { rTaxel, r1: R1, rOn, vcc, current: i, vA0: i * R1, vTaxel: i * rTaxel, vOn: i * rOn, firstOrder: true };
}
