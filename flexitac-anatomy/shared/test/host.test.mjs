import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createHost, createParser, median, processFrame, ema, toU8, colorize, viridis } from '../models/host.mjs';
import { VIRIDIS_RGB } from '../models/viridis.mjs';
import { frameBytes } from '../models/scan.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const HOST_PY = join(here, '..', '..', 'refs', 'fw', 'fast_32_16.py');
const HARNESS = join(here, 'py', 'run_fast_32_16.py');

function findPython() {
  const cands = [process.env.FLEXITAC_PY, join(here, '..', '..', '.venv-py', 'bin', 'python'), 'python3'].filter(Boolean);
  for (const c of cands) {
    if (c.includes('/') && !existsSync(c)) continue;
    const r = spawnSync(c, ['-I', '-c', 'import numpy'], { encoding: 'utf8' });
    if (r.status === 0) return c;
  }
  return null;
}
const PY = findPython();

// deterministic PRNG
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32); }

/** synthetic stream: garbage, 30 noisy rest frames, then presses; values kept < 0xAA so no false markers. */
function makeStream(rows, cols, seed = 1) {
  const R = rng(seed), n = rows * cols, frames = [];
  const base = Array.from({ length: n }, () => 10 + Math.floor(R() * 30));
  for (let f = 0; f < 42; f++) {
    const fr = base.map((b) => Math.min(160, b + Math.floor(R() * 5) - 2));
    if (f >= 32) {               // a blob that grows then moves
      const cr = (f % rows), cc = (3 * f) % cols, amp = 20 + 10 * (f - 32);
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const d2 = (r - cr) ** 2 + (c - cc) ** 2;
        fr[r * cols + c] = Math.min(165, fr[r * cols + c] + Math.round(amp * Math.exp(-d2 / 3)));
      }
    }
    if (f === 35) for (let k = 0; k < n; k++) fr[k] = Math.min(165, base[k] + 1 + (k % 3)); // a "noise only" frame (max < 15)
    frames.push(fr);
  }
  // chunks: one frame completes per chunk; some frames split mid-payload and mid-marker
  const chunks = [[1, 2, 3, 0xaa]];   // leading garbage ending in a lone 0xAA
  frames.forEach((fr, i) => {
    const bytes = [0xaa, 0x55, ...fr];
    if (i % 7 === 3) { chunks.push(bytes.slice(0, 1)); chunks.push(bytes.slice(1)); }
    else if (i % 5 === 1) { const cut = 50 + i; chunks.push(bytes.slice(0, cut)); chunks.push(bytes.slice(cut)); }
    else chunks.push(bytes);
  });
  return { frames, chunks };
}

function runJs(rows, cols, chunks) {
  const h = createHost({ rows, cols });
  const norms = [], filtered = [], u8 = [], rgb = [];
  for (const c of chunks) for (const r of h.feed(c)) if (r.norm) {
    norms.push(Array.from(r.norm));
    const f = h.tick(); filtered.push(Array.from(f));
    const q = toU8(f); u8.push(Array.from(q)); rgb.push(Array.from(colorize(q)));
  }
  return { norms, filtered, u8, rgb, h };
}

for (const [rows, cols] of [[12, 32], [16, 32]]) {
  test(`host port == original fast_32_16.py on the same stream (${rows}x${cols})`, { skip: PY ? false : 'no python with numpy (set FLEXITAC_PY)' }, () => {
    const { chunks } = makeStream(rows, cols, rows);
    const dir = mkdtempSync(join(tmpdir(), 'ft-host-'));
    writeFileSync(join(dir, 'in.json'), JSON.stringify({ rows, cols, chunks }));
    const r = spawnSync(PY, ['-I', HARNESS, HOST_PY, join(dir, 'in.json'), join(dir, 'out.json')], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    const py = JSON.parse(readFileSync(join(dir, 'out.json'), 'utf8'));
    const js = runJs(rows, cols, chunks);
    assert.equal(py.normDtype, 'float32');
    assert.equal(js.norms.length, 12, 'frames after the 30-frame baseline');
    assert.equal(py.norms.length, js.norms.length);
    for (let f = 0; f < js.norms.length; f++) {
      for (let k = 0; k < rows * cols; k++) {
        assert.equal(js.norms[f][k], py.norms[f][k], `norm frame ${f} px ${k}`);
        assert.equal(js.filtered[f][k], py.filtered[f][k], `ema frame ${f} px ${k}`);
      }
      assert.deepEqual(js.u8[f], py.u8[f]);
      if (py.rgb.length) assert.deepEqual(js.rgb[f], py.rgb[f]);
    }
    // the stream really exercised both normalisation branches
    const maxes = js.norms.map((n) => Math.max(...n));
    assert.ok(maxes.some((m) => m === 0) || maxes.some((m) => m < 1), 'a below-threshold frame');
    assert.ok(maxes.some((m) => Math.abs(m - 1) < 1e-6), 'a max-normalised frame');
  });
}

test('median of an even count = mean of the two middle values (np.median)', () => {
  const m = median([[1], [4], [2], [10]]);
  assert.equal(m[0], 3);
  assert.equal(median([[5], [1], [3]])[0], 3);
});

test('normalisation rule: clip(raw-median-15,0,100); /max if max>=15 else /60', () => {
  const base = new Float32Array([20, 20, 20]);
  let n = processFrame([20, 40, 200], base);        // contact = [0, 5, 100]
  assert.deepEqual(Array.from(n), [0, Math.fround(5 / Math.fround(100 + 1e-6)), Math.fround(100 / Math.fround(100 + 1e-6))]);
  n = processFrame([20, 40, 44], base);             // contact = [0, 5, 9] -> max 9 < 15 -> /60
  assert.deepEqual(Array.from(n), [0, Math.fround(5 / 60), Math.fround(9 / 60)]);
  const e = ema(new Float32Array([1]), new Float32Array([0]));
  assert.equal(e[0], Math.fround(0.2));
  assert.deepEqual(Array.from(toU8([0.5, 1.2, -1])), [127, 255, 0]);
});

test('parser quirks: lone-byte retention, split marker, false marker in payload', () => {
  const p = createParser({ rows: 1, cols: 4 });
  assert.equal(p.feed([9, 9, 0xaa]).length, 0);
  assert.equal(p.buffered, 1);                       // keeps the last byte
  assert.deepEqual(p.feed([0x55, 1, 2, 3, 4]).map((f) => Array.from(f)), [[1, 2, 3, 4]]);
  // marker search resumes after each consumed frame: AA 55 inside a payload is data
  const q = createParser({ rows: 1, cols: 4 });
  const out = q.feed([0xaa, 0x55, 7, 0xaa, 0x55, 8, 0xaa, 0x55, 1, 2, 3, 4]);
  assert.deepEqual(out.map((f) => Array.from(f)), [[7, 0xaa, 0x55, 8], [1, 2, 3, 4]]);
  // ...but after a lost byte the parser locks onto the first AA 55 it finds, even inside a payload
  const z = createParser({ rows: 1, cols: 4 });
  const out2 = z.feed([0x55, 7, 0xaa, 0x55, 8, 0xaa, 0x55, 1, 2, 3, 4]);   // first marker's 0xAA dropped
  assert.deepEqual(out2.map((f) => Array.from(f)), [[8, 0xaa, 0x55, 1]]);
});

test('scan -> host round trip: a pressed taxel lights up at the right pixel', () => {
  const h = createHost();
  const rest = frameBytes(null);
  for (let k = 0; k < 30; k++) h.feed(rest);
  const press = Array.from({ length: 12 }, () => new Array(32).fill(0)); press[3][20] = 0.6;
  const [r] = h.feed(frameBytes(press));
  const idx = r.norm.indexOf(Math.max(...r.norm));
  assert.equal(idx, 3 * 32 + 20);
  assert.ok(Math.abs(r.norm[idx] - 1) < 1e-6);
});

test('viridis LUT: 256 entries, endpoints', () => {
  assert.equal(VIRIDIS_RGB.length, 256);
  assert.deepEqual(viridis(0), [68, 1, 84]);
  assert.deepEqual(viridis(255), [253, 231, 37]);
  assert.deepEqual(viridis(1, { unit: true }), [253, 231, 37]);
});
