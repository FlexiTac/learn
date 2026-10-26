// Line-for-line port of the host viewer refs/fw/fast_32_16.py (FlexiTac_Hardware_Repo).
//
// Python                                              | here
// ----------------------------------------------------+------------------------------------
// ring.find(MAGIC); keep last byte if none            | createParser().feed()
// ring = ring[-50000:]                                 |   (same 50000-byte bound)
// median = np.median(stack of INIT_FRAMES=30)          | median()
// contact = backup - median - THRESHOLD (15)           | processFrame()
// contact = np.clip(contact, 0, 100)                   |
// if max < THRESHOLD: /NOISE_SCALE (60)                |
// else: /(max + 1e-6)                                  |
// temporal_filter(new, prev, alpha=0.2)                | ema()
// np.clip(x*255, 0, 255).astype(np.uint8)              | toU8()
// cv2.applyColorMap(.., cv2.COLORMAP_VIRIDIS)          | colorize() / viridis()
//
// numpy does this in float32; every arithmetic step here is rounded with
// Math.fround so results match numpy to the last float32 bit.
// Note: in the Python script the EMA runs once per display-loop tick (~5 ms
// sleep + imshow), independent of frame arrival. createHost() exposes tick()
// for that, and applies nothing on its own.
import { ROWS, COLS, INIT_FRAMES, THRESHOLD, NOISE_SCALE, ALPHA, HEADER } from '../data/constants.mjs';
import { VIRIDIS_RGB } from './viridis.mjs';

export const MAGIC = HEADER;           // [0xAA, 0x55]
export const RING_MAX = 50000;
export const DEFAULTS = { rows: ROWS, cols: COLS, initFrames: INIT_FRAMES, threshold: THRESHOLD, noiseScale: NOISE_SCALE, alpha: ALPHA, clipMax: 100 };
// PyFlexiTac's FlexiTacSensor uses different constants (threshold 25, noise 30, result clipped to 0..1)
export const PYFLEXITAC = { threshold: 25, noiseScale: 30, clip01: true };
const f32 = Math.fround;

/** bytes.find(MAGIC) */
function findMagic(buf, len) {
  for (let i = 0; i + 1 < len; i++) if (buf[i] === MAGIC[0] && buf[i + 1] === MAGIC[1]) return i;
  return -1;
}

/**
 * Frame parser (streaming loop of readThread): feed(chunk) -> array of Uint8Array frames.
 * Faithful quirks: a 0xAA 0x55 pair inside the payload is treated as a marker; with no
 * marker in the buffer only the last byte is kept.
 */
export function createParser({ rows = ROWS, cols = COLS } = {}) {
  const frameBytes = rows * cols;
  let ring = new Uint8Array(0);
  return {
    frameBytes,
    get buffered() { return ring.length; },
    feed(chunk) {
      const c = chunk instanceof Uint8Array ? chunk : Uint8Array.from(chunk);
      const nr = new Uint8Array(ring.length + c.length); nr.set(ring); nr.set(c, ring.length); ring = nr;
      if (ring.length > RING_MAX) ring = ring.slice(ring.length - RING_MAX);
      const out = [];
      for (;;) {
        const idx = findMagic(ring, ring.length);
        if (idx < 0) { if (ring.length > 1) ring = ring.slice(ring.length - 1); break; }
        if (idx > 0) ring = ring.slice(idx);
        if (ring.length < 2 + frameBytes) break;
        out.push(ring.slice(2, 2 + frameBytes));
        ring = ring.slice(2 + frameBytes);
      }
      return out;
    },
    reset() { ring = new Uint8Array(0); },
  };
}

/** np.median(np.stack(frames), axis=0) for uint8/float frames -> Float32Array. */
export function median(frames) {
  const n = frames.length, m = frames[0].length, out = new Float32Array(m), col = new Float64Array(n);
  for (let k = 0; k < m; k++) {
    for (let f = 0; f < n; f++) col[f] = frames[f][k];
    col.sort();
    out[k] = n % 2 ? col[(n - 1) / 2] : f32((col[n / 2 - 1] + col[n / 2]) / 2);
  }
  return out;
}

/** One frame -> contact_data_norm (Float32Array). */
export function processFrame(raw, base, { threshold = THRESHOLD, noiseScale = NOISE_SCALE, clipMax = 100, clip01 = false } = {}) {
  const n = raw.length, c = new Float32Array(n);
  let mx = -Infinity;
  for (let k = 0; k < n; k++) {
    let v = f32(f32(raw[k] - base[k]) - threshold);   // backup - median - THRESHOLD
    v = v < 0 ? 0 : v > clipMax ? clipMax : v;           // np.clip(.., 0, 100)
    c[k] = v; if (v > mx) mx = v;
  }
  const out = new Float32Array(n);
  const div = mx < threshold ? f32(noiseScale) : f32(mx + 1e-6);
  for (let k = 0; k < n; k++) { let v = f32(c[k] / div); if (clip01) v = Math.min(1, Math.max(0, v)); out[k] = v; }
  return out;
}

/** temporal_filter(new, prev, alpha) = alpha*new + (1-alpha)*prev (float32). */
export function ema(next, prev, alpha = ALPHA) {
  const a = f32(alpha), b = f32(1 - alpha), out = new Float32Array(next.length);
  for (let k = 0; k < next.length; k++) out[k] = f32(f32(a * next[k]) + f32(b * prev[k]));
  return out;
}

/** np.clip(x * 255.0, 0, 255).astype(np.uint8) */
export function toU8(x) {
  const out = new Uint8Array(x.length);
  for (let k = 0; k < x.length; k++) { const v = f32(x[k] * 255); out[k] = v <= 0 ? 0 : v >= 255 ? 255 : Math.trunc(v); }
  return out;
}

/** VIRIDIS colour of a 0..255 index (OpenCV LUT) or of a 0..1 float (via toU8 rounding rule). Returns [r,g,b]. */
export function viridis(v, { unit = false } = {}) {
  let i = unit ? toU8([v])[0] : Math.max(0, Math.min(255, Math.trunc(v)));
  return VIRIDIS_RGB[i];
}
export function viridisCss(v, opts) { const [r, g, b] = viridis(v, opts); return `rgb(${r},${g},${b})`; }

/** cv2.applyColorMap(u8, COLORMAP_VIRIDIS), RGB order -> Uint8Array(3n). */
export function colorize(u8) {
  const out = new Uint8Array(u8.length * 3);
  for (let k = 0; k < u8.length; k++) { const c = VIRIDIS_RGB[u8[k]]; out[3 * k] = c[0]; out[3 * k + 1] = c[1]; out[3 * k + 2] = c[2]; }
  return out;
}

/**
 * Whole host pipeline. feed(bytes) -> [{raw, norm|null}] for every complete frame.
 * The first `initFrames` frames build the median baseline (norm = null), then
 * every frame is processed. tick() = one display-loop EMA step on the latest norm.
 */
export function createHost(opts = {}) {
  const o = { ...DEFAULTS, ...opts };
  const parser = createParser(o);
  const n = o.rows * o.cols;
  const h = {
    opts: o, parser,
    init: [], baseline: null, ready: false,
    norm: new Float32Array(n), filtered: new Float32Array(n), frames: 0,
    feed(chunk) {
      const res = [];
      for (const raw of parser.feed(chunk)) {
        h.frames++;
        if (!h.ready) {
          h.init.push(raw);
          if (h.init.length >= o.initFrames) { h.baseline = median(h.init); h.ready = true; }
          res.push({ raw, norm: null, init: true });
        } else {
          h.norm = processFrame(raw, h.baseline, o);
          res.push({ raw, norm: h.norm, init: false });
        }
      }
      return res;
    },
    tick() { if (h.ready) h.filtered = ema(h.norm, h.filtered, o.alpha); return h.filtered; },
    image() { return colorize(toU8(h.filtered)); },
    recalibrate() { h.init = []; h.baseline = null; h.ready = false; },
    reset() { parser.reset(); h.init = []; h.baseline = null; h.ready = false; h.norm = new Float32Array(n); h.filtered = new Float32Array(n); h.frames = 0; },
  };
  return h;
}
