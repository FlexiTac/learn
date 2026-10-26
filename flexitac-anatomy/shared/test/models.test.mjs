import { test } from 'node:test';
import assert from 'node:assert/strict';
import { vA0, current, rTaxelFromV, divider, R1, R_ON, VCC, FIRST_ORDER } from '../models/divider.mjs';
import { adcCode, toByte, voltsToByte, codeToVolts, MAX_CODE, ADC_CLOCK_HZ, CONVERSION_S } from '../models/adc.mjs';
import { rTaxel, pressFromR, ILLUSTRATIVE, LABEL, R_REST, R_HARD, R_STOPS } from '../models/taxel.mjs';

test('constants: R1 fixed 10 kOhm, R_on 70 ohm, 5 V', () => {
  assert.equal(R1, 10000);
  assert.equal(R_ON, 70);
  assert.equal(VCC, 5);
  assert.equal(FIRST_ORDER, true);
});

test('worked example: R_taxel 48 kOhm -> 0.861 V -> ADC 176 -> byte 44', () => {
  const v = vA0(48e3);
  assert.equal(v, 50000 / 58070);                 // 5*10k/(10k+48k+70)
  assert.ok(Math.abs(v - 0.861) < 0.0005, `V_A0 = ${v}`);
  assert.equal(adcCode(v), 176);                   // floor(0.86103*1024/5) = floor(176.32)
  assert.equal(toByte(176), 44);
  assert.equal(voltsToByte(v), 44);
  const d = divider(48e3);
  assert.ok(Math.abs(d.current - 8.6103e-5) < 1e-9);
  assert.ok(Math.abs(d.vA0 + d.vTaxel + d.vOn - 5) < 1e-12);
});

test('divider inverse and limits', () => {
  for (const r of [0, 1e3, 48e3, 1e6]) assert.ok(Math.abs(rTaxelFromV(vA0(r)) - r) < 1e-6 * (1 + r));
  assert.ok(Math.abs(vA0(0) - 5 * 10000 / 10070) < 1e-12);
  assert.ok(vA0(1e6) < 0.05);
  assert.ok(Math.abs(current(0) - 5 / 10070) < 1e-15);
});

test('ADC: 10-bit, floor, clamp, >>2', () => {
  assert.equal(adcCode(0), 0);
  assert.equal(adcCode(5), MAX_CODE);
  assert.equal(adcCode(-1), 0);
  assert.equal(adcCode(2.5), 512);
  assert.equal(toByte(1023), 255);
  assert.equal(toByte(3), 0);
  assert.equal(adcCode(codeToVolts(300)), 300);
  assert.equal(ADC_CLOCK_HZ, 1e6);
  assert.ok(Math.abs(CONVERSION_S - 13e-6) < 1e-15);
});

test('taxel curve: ILLUSTRATIVE flag, monotone, range, inverse', () => {
  assert.equal(ILLUSTRATIVE, true);
  assert.match(LABEL, /illustrative/i);
  assert.equal(rTaxel(0), R_REST);
  assert.ok(Math.abs(rTaxel(1) - R_HARD) < 1e-9);
  let prev = Infinity;
  for (let k = 0; k <= 1000; k++) { const r = rTaxel(k / 1000); assert.ok(r < prev || k === 0); prev = r; }
  for (const p of [0, 0.1, 0.285, 0.5, 0.9, 1]) assert.ok(Math.abs(pressFromR(rTaxel(p)) - p) < 1e-9);
  // resting byte lands in PyFlexiTac's "typical resting 10-40" band; hard press stays below saturation
  const rest = voltsToByte(vA0(rTaxel(0))), hard = voltsToByte(vA0(rTaxel(1)));
  assert.ok(rest >= 10 && rest <= 40, `rest byte ${rest}`);
  assert.ok(hard > 200 && hard < 255, `hard byte ${hard}`);
  assert.ok(R_STOPS.includes(48e3));
  for (let k = 1; k < R_STOPS.length; k++) assert.ok(R_STOPS[k] < R_STOPS[k - 1]);
});
