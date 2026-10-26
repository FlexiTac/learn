// Step-by-step port of the FlexiTac scan firmware (default: PyFlexiTac 12-row
// template.ino, MUX_CHANNEL_OFFSET 4; also the 16-row repo 32_16_fast.ino).
//
//   loop():  Serial.write(0xAA); Serial.write(0x55);
//            for i in 0..ROWS-1:
//              setRow(i)            // i % 16 == 0 -> E# (D8) HIGH then LOW: one pulse per frame
//                                   // S0..S3 (D4..D7) = bits of (i + MUX_CHANNEL_OFFSET)
//              shiftColumn(true)    // D2 HIGH, D3 rising edge, D2 LOW    -> "load"
//              shiftColumn(false)   // D3 rising edge                      -> "latch": the 1 reaches SC1
//              for j in 0..31:
//                analogRead(A0) >> 2 -> Serial.write   // "read" (drive line j is HIGH)
//                shiftColumn(false)                     // "advance"
//
// Hardware model (schematic): D3 drives SRCLK *and* RCLK of all four 595s. On the
// shared rising edge the storage latch copies the shift stage as it was *before*
// the shift, so the outputs (SC1..SC32 = latchQ) run one clock behind the shift
// stage (srQ). #OE = GND: every output is always driven (unselected lines LOW).
// Chain: D2 -> U2.SER, U2.QH' -> U3.SER -> U4 -> U5 (U5.QH' n.c.).
//
// Mapping (derived): frame row i = mux channel ch = i + offset = net SR(ch+1) =
// FPC1 pin ch+1 (sense line). Frame column j = latch output j = net SC(j+1) =
// FPC2 pin j+1 = U(2 + floor(j/8)).Q(A..H)[j%8] (drive line).
// Byte index in the frame = 2 + i*COLS + j  (0 and 1 are the AA 55 header).
//
// Pure ESM, no DOM. Deterministic.
import { ROWS, COLS, MUX_OFFSET, HEADER, FRAME_HZ } from '../data/constants.mjs';
import { vA0 } from './divider.mjs';
import { adcCode, toByte } from './adc.mjs';
import { rTaxel } from './taxel.mjs';

export const VARIANTS = {
  pyflexitac12: { rows: ROWS, cols: COLS, muxOffset: MUX_OFFSET, rowsPerMux: 16, src: 'PyFlexiTac template.ino (default)' },
  repo16: { rows: 16, cols: 32, muxOffset: 0, rowsPerMux: 16, src: 'FlexiTac_Hardware_Repo 32_16_fast.ino' },
};
export const DEFAULT = VARIANTS.pyflexitac12;
export const PHASES = ['header', 'enableHigh', 'enableLow', 'select', 'load', 'latch', 'read', 'advance'];
const QNAMES = ['QA', 'QB', 'QC', 'QD', 'QE', 'QF', 'QG', 'QH'];

/** Static description of drive line j (0-based). */
export function driveLineInfo(j) {
  return { index: j, net: `SC${j + 1}`, chip: `U${2 + (j >> 3)}`, q: QNAMES[j & 7], fpc2Pin: j + 1 };
}
/** Static description of mux channel ch (0..15) for a variant. */
export function muxChannelInfo(ch, v = DEFAULT) {
  const row = ch - v.muxOffset;
  const used = row >= 0 && row < v.rows;
  return { ch, bits: [ch & 1, (ch >> 1) & 1, (ch >> 2) & 1, (ch >> 3) & 1], input: `I${ch}`, net: `SR${ch + 1}`, fpc1Pin: ch + 1, row: used ? row : null, used };
}
export function frameSize(v = DEFAULT) { return 2 + v.rows * v.cols; }
export function byteIndex(row, col, v = DEFAULT) { return 2 + row * v.cols + col; }
export function rowColOfByte(idx, v = DEFAULT) {
  if (idx < 2) return { header: true, row: null, col: null };
  const k = idx - 2;
  return { header: false, row: Math.floor(k / v.cols), col: k % v.cols };
}

/** 74HC595 x4 chain with tied SRCLK/RCLK. */
export function createChain(n = 32) {
  const c = { sr: new Uint8Array(n), latch: new Uint8Array(n), ser: 0, clocks: 0 };
  c.edge = (ser) => {          // one rising edge on D3
    c.latch.set(c.sr);         // storage latch takes the PRE-shift stage -> one-clock lag
    c.sr.copyWithin(1, 0, n - 1);
    c.sr[0] = ser ? 1 : 0;
    c.clocks++;
  };
  c.reset = () => { c.sr.fill(0); c.latch.fill(0); c.ser = 0; c.clocks = 0; };
  return c;
}

/** Default reading model: unitless press 0..1 -> 10-bit ADC code (ILLUSTRATIVE taxel curve, first-order divider). */
export function codeForPress(press) {
  return adcCode(vA0(rTaxel(press || 0)));
}

function makeReader(input) {
  // input: null | number[][] press map [row][col] | function(row, col) -> press | { code(row,col) } returning a 10-bit code
  if (input && typeof input.code === 'function') return (r, c) => input.code(r, c);
  if (typeof input === 'function') return (r, c) => codeForPress(input(r, c));
  if (Array.isArray(input)) return (r, c) => codeForPress(input[r]?.[c] ?? 0);
  return () => codeForPress(0);
}

/**
 * Stateful scanner: hardware state survives across frames exactly like the MCU.
 * opts: { variant: 'pyflexitac12'|'repo16'|{rows,cols,muxOffset,rowsPerMux}, input (see makeReader) }
 */
export function createScanner(opts = {}) {
  const v = typeof opts.variant === 'object' ? { ...DEFAULT, ...opts.variant } : (VARIANTS[opts.variant] || DEFAULT);
  let read = makeReader(opts.input);
  const chain = createChain(v.cols);
  const hw = { muxCh: 0, eN: 0, currentEnabledMux: 0 /* MUX_COUNT - 1 */ };
  let it = null, seq = 0, frame = 0, clockInFrame = 0;

  function snap(phase, extra = {}) {
    const muxInfo = muxChannelInfo(hw.muxCh, v);
    let drive = -1, highs = 0;
    for (let k = 0; k < chain.latch.length; k++) if (chain.latch[k]) { highs++; if (drive < 0) drive = k; }
    return {
      seq: seq++, frame, phase,
      clock: clockInFrame, totalClocks: chain.clocks,
      ser: chain.ser, eN: hw.eN, enabled: hw.eN === 0,
      muxCh: hw.muxCh, selectBits: muxInfo.bits,
      senseLine: hw.eN === 0 ? muxInfo.row : null, senseNet: muxInfo.net,
      driveLine: highs === 1 ? drive : -1, highCount: highs,
      latchQ: Array.from(chain.latch), srQ: Array.from(chain.sr),
      row: null, col: null, byteIndex: null, byte: null, code: null,
      ...extra,
    };
  }
  function clock(ser) { chain.ser = ser ? 1 : 0; chain.edge(ser); clockInFrame++; }

  function* frameGen() {
    clockInFrame = 0;
    yield snap('header', { byteIndex: 0, byte: HEADER[0], fw: 'Serial.write(0xAA)' });
    yield snap('header', { byteIndex: 1, byte: HEADER[1], fw: 'Serial.write(0x55)' });
    for (let i = 0; i < v.rows; i++) {
      if (i % v.rowsPerMux === 0) {                       // setRow(): one E# pulse per frame (MUX_COUNT = 1)
        hw.eN = 1; yield snap('enableHigh', { row: i, fw: 'digitalWrite(D8, HIGH)' });
        hw.eN = 0; yield snap('enableLow', { row: i, fw: 'digitalWrite(D8, LOW)' });
      }
      hw.muxCh = (i + v.muxOffset) & 15;
      yield snap('select', { row: i, fw: `S3..S0 = ${hw.muxCh.toString(2).padStart(4, '0')}` });
      clock(1); chain.ser = 0;                             // shiftColumn(true): data HIGH, clock, data LOW
      yield snap('load', { row: i, ser: 1, fw: 'shiftColumn(true)' });
      clock(0);
      yield snap('latch', { row: i, fw: 'shiftColumn(false)' });
      for (let j = 0; j < v.cols; j++) {
        const code = read(i, j);
        yield snap('read', { row: i, col: j, byteIndex: 2 + i * v.cols + j, code, byte: toByte(code), fw: 'Serial.write(analogRead(A0) >> 2)' });
        clock(0);
        yield snap('advance', { row: i, col: j, fw: 'shiftColumn(false)' });
      }
    }
  }

  const api = {
    variant: v,
    chain, hw,
    /** next micro-step (rolls into the next frame). */
    next() {
      if (!it) { it = frameGen(); }
      let r = it.next();
      if (r.done) { frame++; seq = 0; it = frameGen(); r = it.next(); }
      api.current = r.value;
      return r.value;
    },
    /** all micro-steps of the next whole frame (scanner must be at a frame boundary). */
    frameSteps() {
      if (it) throw new Error('frameSteps(): scanner is mid-frame; call reset() or finish the frame');
      const out = [];
      it = frameGen();
      for (let r = it.next(); !r.done; r = it.next()) out.push(r.value);
      it = null; frame++; seq = 0;
      return out;
    },
    setInput(input) { read = makeReader(input); },
    reset() { chain.reset(); hw.muxCh = 0; hw.eN = 0; it = null; seq = 0; frame = 0; clockInFrame = 0; api.current = null; },
    current: null,
  };
  return api;
}

/** Generator of micro-steps for `frames` frames from power-on state. */
export function* microSteps({ variant, input, frames = 1 } = {}) {
  const s = createScanner({ variant, input });
  for (let f = 0; f < frames; f++) yield* s.frameSteps();
}

/** The bytes one frame puts on the wire: AA 55 + rows*cols readings. */
export function frameBytes(input = null, { variant } = {}) {
  const s = createScanner({ variant, input });
  const steps = s.frameSteps();
  const out = new Uint8Array(frameSize(s.variant));
  for (const st of steps) if (st.byteIndex !== null) out[st.byteIndex] = st.byte;
  return out;
}

// ---------------------------------------------------------------------------- timing
// DISPLAY timing (not measured): spreads one frame over 1/FRAME_HZ (100 Hz -> 10 ms)
// with relative weights per phase, so a figure can map seconds -> micro-steps.
export const PHASE_WEIGHT = { header: 1, enableHigh: 0.25, enableLow: 0.25, select: 0.5, load: 0.25, latch: 0.25, read: 1, advance: 0.25 };
export function frameTiming({ variant } = {}) {
  const v = typeof variant === 'object' ? { ...DEFAULT, ...variant } : (VARIANTS[variant] || DEFAULT);
  const steps = createScanner({ variant: v }).frameSteps();
  const w = steps.map((s) => PHASE_WEIGHT[s.phase]);
  const total = w.reduce((a, b) => a + b, 0);
  const period = 1 / FRAME_HZ;
  const t0 = []; let acc = 0;
  for (const x of w) { t0.push((acc / total) * period); acc += x; }
  return { period, steps: steps.length, start: t0, duration: w.map((x) => (x / total) * period), note: 'display timing, not measured' };
}

/**
 * Time-driven player for figures/film: advance(dt) consumes `dt` seconds of
 * scan time scaled by `speed` (1 = real time, 1e-3 = 1/1000x) and returns the
 * micro-steps executed (deterministic; no timers).
 */
export function createPlayer({ variant, input, speed = 1e-3 } = {}) {
  const sc = createScanner({ variant, input });
  const timing = frameTiming({ variant: sc.variant });
  let acc = 0, idx = 0;
  const p = {
    scanner: sc, timing, speed,
    advance(dt, maxSteps = 1e6) {
      const done = [];
      acc += dt * p.speed;
      while (done.length < maxSteps) {
        const need = timing.duration[idx];
        if (acc < need) break;
        acc -= need;
        done.push(sc.next());
        idx = (idx + 1) % timing.steps;
      }
      return done;
    },
    stepOnce() { const s = sc.next(); idx = (idx + 1) % timing.steps; acc = 0; return s; },
    /** jump to the next step with this phase (e.g. 'latch', 'read', 'select'). */
    stepTo(phase) { let s; for (let k = 0; k < timing.steps; k++) { s = p.stepOnce(); if (s.phase === phase) break; } return s; },
    reset() { sc.reset(); acc = 0; idx = 0; },
    get current() { return sc.current; },
  };
  return p;
}
