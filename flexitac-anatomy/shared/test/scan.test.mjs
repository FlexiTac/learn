import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadSketch } from './fw_sim.mjs';
import {
  createScanner, microSteps, frameBytes, frameSize, byteIndex, rowColOfByte, driveLineInfo, muxChannelInfo,
  frameTiming, createPlayer, VARIANTS,
} from '../models/scan.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const REFS = join(here, '..', '..', 'refs', 'fw');
const INO12 = join(REFS, 'pyflexitac', 'template.ino');
const INO16 = join(REFS, '32_16_fast.ino');

// arbitrary but distinct 10-bit code for every (mux channel, drive line)
const codeOf = (ch, k) => (ch * 97 + k * 31 + 5) % 1024;
const analog = (ch, high) => (high.length === 1 ? codeOf(ch, high[0]) : 1023);

function runFirmware(path, frames = 2) {
  const sk = loadSketch(path, analog);
  for (let f = 0; f < frames; f++) sk.loop();
  return sk.board.log;
}

for (const [name, path, variant] of [['PyFlexiTac 12-row', INO12, 'pyflexitac12'], ['repo 16-row', INO16, 'repo16']]) {
  test(`${name}: micro-step reads match the transpiled firmware (2 frames)`, () => {
    const v = VARIANTS[variant];
    const log = runFirmware(path, 2);
    const input = { code: (r, c) => codeOf(r + v.muxOffset, c) };
    const steps = [...microSteps({ variant, input, frames: 2 })];
    const reads = steps.filter((s) => s.phase === 'read');
    assert.equal(reads.length, log.reads.length);
    assert.equal(reads.length, 2 * v.rows * v.cols);
    reads.forEach((s, n) => {
      const fw = log.reads[n];
      assert.ok(fw.enabled, 'mux enabled during every read');
      assert.equal(s.muxCh, fw.ch, `read ${n}: mux channel`);
      assert.deepEqual(fw.high, [s.driveLine], `read ${n}: exactly one drive line HIGH`);
      assert.equal(s.highCount, 1);
      assert.equal(s.code, fw.code);
      assert.equal(s.totalClocks, fw.clock, `read ${n}: D3 clock count`);
    });
    // bytes on the wire
    const wire = steps.filter((s) => s.byteIndex !== null).map((s) => s.byte);
    assert.deepEqual(wire, log.bytes);
    assert.equal(log.bytes.length, 2 * frameSize(v));
    // E# (D8): HIGH then LOW once per frame, right after the header
    assert.deepEqual(log.d8.map((e) => e.level), [1, 0, 1, 0]);
    assert.deepEqual(log.d8.map((e) => e.atByte), [2, 2, 2 + frameSize(v), 2 + frameSize(v)]);
    const en = steps.filter((s) => s.phase.startsWith('enable'));
    assert.deepEqual(en.map((s) => s.eN), [1, 0, 1, 0]);
    // clocks per frame = rows * (2 + cols)
    assert.equal(log.clocks, 2 * v.rows * (2 + v.cols));
  });

  test(`${name}: frameBytes equals firmware output`, () => {
    const v = VARIANTS[variant];
    const log = runFirmware(path, 1);
    const fb = frameBytes({ code: (r, c) => codeOf(r + v.muxOffset, c) }, { variant });
    assert.deepEqual(Array.from(fb), log.bytes);
  });
}

test('12-row default: channel mapping 4..15, header, sizes', () => {
  const steps = createScanner().frameSteps();
  const sel = steps.filter((s) => s.phase === 'select').map((s) => s.muxCh);
  assert.deepEqual(sel, [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
  assert.deepEqual(steps.slice(0, 2).map((s) => s.byte), [0xaa, 0x55]);
  assert.equal(frameSize(), 386);
  assert.equal(byteIndex(0, 0), 2);
  assert.equal(byteIndex(11, 31), 385);
  assert.deepEqual(rowColOfByte(213), { header: false, row: 6, col: 19 });
  for (let ch = 0; ch < 4; ch++) assert.equal(muxChannelInfo(ch).used, false);
  assert.deepEqual(muxChannelInfo(4), { ch: 4, bits: [0, 0, 1, 0], input: 'I4', net: 'SR5', fpc1Pin: 5, row: 0, used: true });
  assert.deepEqual(driveLineInfo(18), { index: 18, net: 'SC19', chip: 'U4', q: 'QC', fpc2Pin: 19 });
});

test('latch lag: the first clock loads the 1, the second shows it on SC1', () => {
  const s = createScanner();
  let st;
  do { st = s.next(); } while (st.phase !== 'load');
  assert.equal(st.srQ[0], 1, 'after load the 1 is in the shift stage');
  assert.equal(st.latchQ.reduce((a, b) => a + b, 0), 0, 'but no output is HIGH yet');
  st = s.next();
  assert.equal(st.phase, 'latch');
  assert.equal(st.latchQ[0], 1);
  assert.equal(st.driveLine, 0);
  assert.equal(st.srQ[1], 1, 'shift stage is one ahead');
  // walk
  for (let j = 0; j < 32; j++) {
    st = s.next(); assert.equal(st.phase, 'read'); assert.equal(st.driveLine, j); assert.equal(st.col, j);
    st = s.next(); assert.equal(st.phase, 'advance');
  }
  assert.equal(st.driveLine, -1, 'after the 34th clock every drive line is LOW');
  assert.equal(st.latchQ.reduce((a, b) => a + b, 0), 0);
});

test('pressMap input: pressed taxel reads higher than the rest', () => {
  const press = Array.from({ length: 12 }, () => new Array(32).fill(0));
  press[6][19] = 0.8;
  const fb = frameBytes(press);
  const idx = byteIndex(6, 19);
  const rest = fb[byteIndex(0, 0)];
  assert.ok(fb[idx] > rest + 50, `pressed ${fb[idx]} vs rest ${rest}`);
  for (let k = 2; k < fb.length; k++) if (k !== idx) assert.equal(fb[k], rest);
});

test('timing + player are deterministic and cover one frame per 1/100 s', () => {
  const t = frameTiming();
  assert.ok(Math.abs(t.start.at(-1) + t.duration.at(-1) - 0.01) < 1e-12);
  const a = createPlayer({ speed: 1 }), b = createPlayer({ speed: 1 });
  const sa = a.advance(0.01 + 1e-9), sb = [];
  for (let k = 0; k < 1000; k++) sb.push(...b.advance(0.00001));
  sb.push(...b.advance(1e-9 + 1e-12));
  assert.equal(sa.length, t.steps);
  assert.equal(sb.length, t.steps);
  assert.deepEqual(sa.map((s) => s.phase), sb.map((s) => s.phase));
  const p = createPlayer();
  assert.equal(p.stepTo('latch').driveLine, 0);
});
