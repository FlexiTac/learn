// touchsim.mjs: the shared in-browser touch simulator for Learn FlexiTac Section 2 (2.2 mouse teleop) and
// Section 3 (3.2-3.6). It is plain ESM: no DOM, no timers, no clock, no Math.random, no dependencies beyond
// ../data/constants.mjs. The same inputs always give the same outputs, bit for bit.
//
// WHAT IT MODELS (a simplified, ILLUSTRATIVE version of VT-Refine's tactile model, VT-Refine §3 / App. B-C):
//   1. Pad    - a 12 x 32 lattice of taxel points at 2 mm pitch, in the real frame order: values[i * 32 + j],
//               i = sense line (12), j = drive line (32). The pad can sit anywhere (a frame) and can bend
//               smoothly along its long side so it can follow a bending fin face.
//   2. Shapes - sphere, rounded box, capped cylinder (any axis) and a strawberry (a smooth heart/cone solid of
//               revolution), each with a pose and an exact signed distance field (SDF) + gradient.
//   3. Contact- per taxel: penetration depth d >= 0 into the nearest shape, measured along the pad normal
//               (SDF depth x how squarely the surface faces the pad), its rate d' from the previous step, and a
//               Kelvin-Voigt force  f = max(0, k_n * d + k_d * d')  (a spring and a damper side by side).
//               Normal force only. Shear is left out on purpose: FlexiTac is a piezoresistive sandwich that
//               responds to squeezing through its thickness, not to sideways rubbing, so a simulated shear
//               signal would be something the real pad can never show. VT-Refine says the same
//               ("Shear forces are not used"), and its released code projects the force onto the pad normal.
//   4. Readout- the normalisation rule used by every FlexiTac code base (fast_32_16.py, PyFlexiTac, 3D-ViTac,
//               VT-Refine App. C.1): subtract the baseline and a threshold, clip to 0..clipMax; if the frame
//               max is below the threshold divide by a fixed noise scale, otherwise by the frame max.
//               "sim" style feeds the force straight in; "real" style turns it into bytes first (a resting
//               byte per taxel, a little noise, rounding, 0..255) and takes the baseline as the per-taxel median
//               of the first frames, exactly like the host viewer. Same threshold, same rule.
//   5. Lesson helpers - a force-response curve (a DMA-style press and release of one taxel), a k_n / k_d
//               least-squares fit to a target curve, an illustrative "measured" curve, map/point-cloud helpers.
//
// UNITS: millimetres, seconds, newtons. World frame: right-handed, z up (a convention only; nothing depends
// on it except padPair's defaults).
//
// ILLUSTRATIVE SCALE (no force data exists for FlexiTac; every number below is chosen, not measured):
//   - k_n = 0.6 N/mm per taxel, k_d = 0.012 N*s/mm per taxel (time constant 20 ms) - the rounded best fit of
//     k_n/k_d to illustrativeCurve(), the stand-in for a real force-response curve (D8 not supplied).
//   - 125 counts per newton: 1 count (one byte step on the wire) ~ 8 mN on one taxel.
//   - With the viewer's threshold 15 counts and noise scale 60 counts (fast_32_16.py), the threshold is
//     0.12 N = 0.2 mm of penetration and the noise scale 0.48 N = 0.8 mm - the same 0.2 mm / 0.8 mm that
//     VT-Refine's released sim code uses (easysim-envs tasks/aloha.py). So the real and sim rules line up.
//   - A firm fingertip-size press (sphere r = 8 mm, 1.3 mm deep) lights about a dozen taxels (9-14, by where
//     it lands on the grid) and pushes ~5 N in total, like Fig 1's feel model ("a firm press lights about a
//     dozen crossings"). A light press (0.6 mm) lights ~5 for ~1.3 N; a hard one (1.8 mm) ~17 for ~9.5 N
//     and reaches the viewer's clip. FlexiTac's working range is about 0.2-10 N (VT-Refine App. A).
//   - Absolute k_n mostly matters only against the threshold: the per-frame max normalisation removes the
//     overall scale, so a stiffer pad lights more taxels but the brightest one always reads 1.
//   - The paper's own numbers are k_n = 1.0, k_d = 3e-3 in SI units (N/m, N*s/m); see PAPER.
//
// PERFORMANCE: 2 pads x 384 taxels x 3 shapes (incl. a strawberry), bent and moved every step, plus
// readouts: ~0.15 ms per step in Node and in Chrome (a 60 fps frame is 16.7 ms). No allocation per step
// beyond a few small result objects. touchsim.test.mjs measures it.
//
// CAVEATS (say them in the lessons where they matter):
//   - Pads are rigid lattices apart from the bend, and shapes are rigid and kinematic: the engine reports
//     forces, it never moves anything (VT-Refine also keeps the pad rigid on the finger link; no FEM).
//     A grasp lesson decides "held" / "lifted" itself, e.g. from each object's shapeForce on both pads.
//   - SDF depth is right only while it is shallower than about half the object's thickness under a taxel.
//   - d' is a backward difference: after any jump (teleport, swapping objects) call touch.reset(), or the
//     jump reads as a very fast press. Use a fixed dt (e.g. 1/60 s); maxRate can cap |d'| for mouse drags.
//
// Sources: refs/s2s3-research/papers.md §2.3, §3.2-3.5 (VT-Refine CoRL 2025, easysim-envs, the FlexiTac
// Isaac Lab port), shared/models/host.mjs (the viewer's normalisation, bit for bit), figures/pad/live.js
// (Fig 1's feel model).
import { ROWS, COLS, PITCH, THRESHOLD, NOISE_SCALE, INIT_FRAMES } from '../data/constants.mjs';

/** Everything this module outputs is a simplified, illustrative model, not a measurement. */
export const ILLUSTRATIVE = true;
export const LABEL = 'illustrative - a simplified in-browser touch model (points + penetration + spring and damper); no measured force data';
export const UNITS = Object.freeze({ length: 'mm', time: 's', force: 'N', kn: 'N/mm per taxel', kd: 'N*s/mm per taxel', counts: 'byte steps' });

/** Lattice size of the default (12 x 32) FlexiTac pad. */
export const TAXELS = ROWS * COLS;

/**
 * Default model constants (illustrative).
 *  kn: spring per taxel (N/mm); kd: damper per taxel (N*s/mm); reach: how far (mm) the signed distance is
 *  reported before it is capped; maxRate: cap on |d'| (mm/s), Infinity = the pure model.
 */
export const DEFAULTS = Object.freeze({ kn: 0.6, kd: 0.012, reach: 10, maxRate: Infinity });

/** VT-Refine's published constants and how the code bases differ (for a Specs tab). */
export const PAPER = Object.freeze({
  kn: 1.0,
  kd: 3e-3,
  units: 'SI: k_n in N/m, k_d in N*s/m, depth in m',
  inMm: { kn: 1e-3, kd: 3e-6 },
  src: 'VT-Refine (CoRL 2025) §3 / App. B.2: f = -(k_n d + k_d d\'), normal only',
  variants: [
    'easysim-envs (released code): k_n = 1.0, no damper, friction terms projected out (normal only)',
    'FlexiTac Isaac Lab port: spring only, stiffness 5000, clamp to max_force (10 N) then divide by it',
    'sim normalisation (easysim-envs aloha.py): max < 0.0002 m -> divide by 0.0008 m, else by the pad max',
  ],
});

/**
 * Readout constants. threshold / noiseScale / clipMax / initFrames are the real viewer's (fast_32_16.py via
 * data/constants.mjs); countsPerN, rest, noise are illustrative.
 */
export const READOUT = Object.freeze({
  countsPerN: 125,
  threshold: THRESHOLD,
  noiseScale: NOISE_SCALE,
  clipMax: 100,
  initFrames: INIT_FRAMES,
  rest: Object.freeze([12, 24]),
  noise: 1.0,
  seed: 1,
});

/** Lesson presets (illustrative): a fingertip-size sphere and three press depths (mm). */
export const PRESETS = Object.freeze({
  fingertip: Object.freeze({ radius: 8 }),
  lightDepth: 0.6,
  firmDepth: 1.3,
  hardDepth: 1.8,
});

/**
 * @typedef {[number, number, number]} Vec3
 * @typedef {ArrayLike<number>} Vec3Like   any [x, y, z]-like (array, Float32Array, ...)
 * @typedef {ArrayLike<number>} Mat3Like   9 numbers, row-major; world = R * local + pos
 * @typedef {{ pos?: Vec3Like, rot?: Mat3Like }} PoseLike
 * @typedef {{ origin?: Vec3Like, u?: Vec3Like, v?: Vec3Like, normal?: Vec3Like }} PadFrameLike
 *   u = along the long side (drive index j increases along +u), v = along the short side (sense index i
 *   increases along +v), normal = u x v, out of the touch face. Give u + v, or u + normal.
 * @typedef {number | ((s: number) => number) | { kappa: number | ((s: number) => number), anchor?: number }} BendLike
 *   curvature (1/mm) along u as a number or a function of the arc position s (mm, 0 = pad centre); positive
 *   curls the ends toward +normal (a concave face that wraps around something in front of it). `anchor` is the
 *   arc position that stays put with its tangent along u (default 0).
 * @typedef {Sphere | RoundBox | Cylinder | Strawberry} Shape
 * @typedef {{ max: number, lit: number, quiet: boolean }} NormStats
 *   max: the frame's clipped contact max (counts); lit: taxels > 0 after normalising; quiet: max < threshold
 *   (the frame was divided by the noise scale).
 */

// ------------------------------------------------------------------------------------------------ vectors

const f32 = Math.fround;
const IDENTITY = Object.freeze([1, 0, 0, 0, 1, 0, 0, 0, 1]);

function norm3(x, y, z) { return Math.sqrt(x * x + y * y + z * z); }
/** @param {Vec3Like} a @returns {Vec3} */
function unit(a) {
  const l = norm3(a[0], a[1], a[2]);
  if (!(l > 0)) throw new Error('touchsim: zero-length direction');
  return [a[0] / l, a[1] / l, a[2] / l];
}
/** @param {Vec3Like} a @param {Vec3Like} b @returns {Vec3} */
function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
/** @param {Vec3Like} a @param {Vec3Like} b */
function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }

/** Rotation about x by `a` radians (row-major 3x3). @param {number} a @returns {number[]} */
export function rotX(a) { const c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, c, -s, 0, s, c]; }
/** Rotation about y by `a` radians. @param {number} a @returns {number[]} */
export function rotY(a) { const c = Math.cos(a), s = Math.sin(a); return [c, 0, s, 0, 1, 0, -s, 0, c]; }
/** Rotation about z by `a` radians. @param {number} a @returns {number[]} */
export function rotZ(a) { const c = Math.cos(a), s = Math.sin(a); return [c, -s, 0, s, c, 0, 0, 0, 1]; }
/** Rotation about any axis by `a` radians (Rodrigues). @param {Vec3Like} axis @param {number} a @returns {number[]} */
export function rotAxis(axis, a) {
  const [x, y, z] = unit(axis), c = Math.cos(a), s = Math.sin(a), t = 1 - c;
  return [t * x * x + c, t * x * y - s * z, t * x * z + s * y,
    t * x * y + s * z, t * y * y + c, t * y * z - s * x,
    t * x * z - s * y, t * y * z + s * x, t * z * z + c];
}
/** A * B (apply B first). @param {Mat3Like} A @param {Mat3Like} B @returns {number[]} */
export function rotMul(A, B) {
  const o = new Array(9);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) o[r * 3 + c] = A[r * 3] * B[c] + A[r * 3 + 1] * B[3 + c] + A[r * 3 + 2] * B[6 + c];
  return o;
}
/** The rotation whose columns are the images of the local x, y, z axes. @param {Vec3Like} x @param {Vec3Like} y @param {Vec3Like} z @returns {number[]} */
export function rotFromAxes(x, y, z) { return [x[0], y[0], z[0], x[1], y[1], z[1], x[2], y[2], z[2]]; }
/** The shortest rotation that turns direction `a` into direction `b`. @param {Vec3Like} a @param {Vec3Like} b @returns {number[]} */
export function rotFromTo(a, b) {
  const ua = unit(a), ub = unit(b), c = dot(ua, ub);
  if (c > 1 - 1e-12) return [...IDENTITY];
  if (c < -1 + 1e-12) {   // opposite: turn half a circle about any axis perpendicular to a
    const helper = Math.abs(ua[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
    return rotAxis(cross(ua, helper), Math.PI);
  }
  return rotAxis(cross(ua, ub), Math.acos(c));
}
/** Build a pose. @param {Vec3Like} [pos] @param {Mat3Like} [rot] @returns {{pos: Vec3, rot: number[]}} */
export function pose(pos = [0, 0, 0], rot = IDENTITY) { return { pos: [pos[0], pos[1], pos[2]], rot: Array.from(rot) }; }
/** world = R * p + pos. @param {PoseLike} P @param {Vec3Like} p @returns {Vec3} */
export function transformPoint(P, p) {
  const R = P.rot ?? IDENTITY, t = P.pos ?? [0, 0, 0];
  return [R[0] * p[0] + R[1] * p[1] + R[2] * p[2] + t[0], R[3] * p[0] + R[4] * p[1] + R[5] * p[2] + t[1], R[6] * p[0] + R[7] * p[1] + R[8] * p[2] + t[2]];
}
/** local = R^T (p - pos). @param {PoseLike} P @param {Vec3Like} p @returns {Vec3} */
export function inverseTransformPoint(P, p) {
  const R = P.rot ?? IDENTITY, t = P.pos ?? [0, 0, 0], x = p[0] - t[0], y = p[1] - t[1], z = p[2] - t[2];
  return [R[0] * x + R[3] * y + R[6] * z, R[1] * x + R[4] * y + R[7] * z, R[2] * x + R[5] * y + R[8] * z];
}

// ------------------------------------------------------------------------------------------------ pads

const BEND_STEP = PITCH / 8; // mm: integration step for a curvature function

/** @param {BendLike | undefined | null} bend @returns {{ kappa: number | ((s: number) => number), anchor: number }} */
function readBend(bend) {
  if (bend === undefined || bend === null) return { kappa: 0, anchor: 0 };
  if (typeof bend === 'number' || typeof bend === 'function') return { kappa: bend, anchor: 0 };
  return { kappa: bend.kappa ?? 0, anchor: bend.anchor ?? 0 };
}

/**
 * A pad's centre line at arc positions `s` (ascending): x (along u), z (along normal), angle theta.
 * Constant curvature uses the closed form; a curvature function is integrated in sub-steps of PITCH / 8,
 * each an exact arc at the sub-step's middle curvature (so a constant function gives the closed form).
 * @param {ArrayLike<number>} s @param {{kappa: number | ((s: number) => number), anchor: number}} B
 * @param {Float64Array} X @param {Float64Array} Z @param {Float64Array} T
 */
function bendLine(s, B, X, Z, T) {
  const { kappa, anchor: s0 } = B;
  if (typeof kappa === 'number') {
    for (let m = 0; m < s.length; m++) {
      const ds = s[m] - s0, th = kappa * ds;
      if (Math.abs(kappa) < 1e-12) { X[m] = s[m]; Z[m] = 0; T[m] = 0; continue; }
      X[m] = s0 + Math.sin(th) / kappa; Z[m] = (1 - Math.cos(th)) / kappa; T[m] = th;
    }
    return;
  }
  // sweep outward from the anchor in both directions, stopping at each requested s
  const walk = (m, dir) => {
    let x = s0, z = 0, th = 0, at = s0;
    for (; m >= 0 && m < s.length; m += dir) {
      const target = s[m];
      while ((target - at) * dir > 1e-12) {
        // one sub-step of constant curvature (sampled at its middle), integrated as an exact arc
        const h = Math.min(BEND_STEP, Math.abs(target - at)) * dir;
        const k = kappa(at + h / 2), th1 = th + k * h;
        if (Math.abs(k * h) < 1e-9) { const tm = th + (k * h) / 2; x += Math.cos(tm) * h; z += Math.sin(tm) * h; }
        else { x += (Math.sin(th1) - Math.sin(th)) / k; z += (Math.cos(th) - Math.cos(th1)) / k; }
        th = th1; at += h;
      }
      X[m] = x; Z[m] = z; T[m] = th;
    }
  };
  let first = 0;
  while (first < s.length && s[first] < s0) first++;
  walk(first, 1);
  walk(first - 1, -1);
}

/**
 * A FlexiTac pad as a lattice of taxel points. Index order is the real frame's: k = i * cols + j with
 * i = sense line (0..rows-1) and j = drive line (0..cols-1). Flat, taxel (i, j) sits at pad coordinates
 * a = (j - (cols-1)/2) * pitch along u and b = (i - (rows-1)/2) * pitch along v; for the 12 x 32 pad that is
 * the FPC Gerber position (x, y) = (ROW_X[i], COL_Y[j]) with u = +y, v = -x, normal = +z (shared/README).
 */
export class Pad {
  /**
   * @param {Object} [opts]
   * @param {number} [opts.rows] sense lines (12)
   * @param {number} [opts.cols] drive lines (32)
   * @param {number} [opts.pitch] mm (2)
   * @param {PadFrameLike} [opts.frame] where the pad sits (default: origin 0, u = +x, v = +y, normal = +z)
   * @param {BendLike} [opts.bend] smooth curvature along u (default flat)
   * @param {string} [opts.name]
   */
  constructor({ rows = ROWS, cols = COLS, pitch = PITCH, frame, bend, name = '' } = {}) {
    this.rows = rows; this.cols = cols; this.pitch = pitch; this.name = name;
    /** taxel count */
    this.n = rows * cols;
    /** arc position (mm) of each drive line j along u, and of each sense line i along v */
    this.colS = Float64Array.from({ length: cols }, (_, j) => (j - (cols - 1) / 2) * pitch);
    this.rowB = Float64Array.from({ length: rows }, (_, i) => (i - (rows - 1) / 2) * pitch);
    /** pad-frame coordinates (a along u, b along v, c along normal), bend applied; 3 per taxel */
    this.local = new Float32Array(3 * this.n);
    /** pad-frame unit normals, 3 per taxel */
    this.localNormal = new Float32Array(3 * this.n);
    /** world positions (mm), 3 per taxel, k = i * cols + j */
    this.points = new Float32Array(3 * this.n);
    /** world unit normals (out of the touch face), 3 per taxel */
    this.normals = new Float32Array(3 * this.n);
    /** world bounding sphere of the taxel points */
    this.center = /** @type {Vec3} */ ([0, 0, 0]);
    this.radius = 0;
    /** @type {{origin: Vec3, u: Vec3, v: Vec3, normal: Vec3}} */
    this.frame = { origin: [0, 0, 0], u: [1, 0, 0], v: [0, 1, 0], normal: [0, 0, 1] };
    this._bend = readBend(bend);
    this._cx = new Float64Array(cols); this._cz = new Float64Array(cols); this._ct = new Float64Array(cols);
    this._applyBend();
    this.setFrame(frame ?? {});
  }

  /** Taxel index of sense line i, drive line j. @param {number} i @param {number} j */
  index(i, j) { return i * this.cols + j; }
  /** [sense i, drive j] of taxel k. @param {number} k @returns {[number, number]} */
  rowCol(k) { return [Math.floor(k / this.cols), k % this.cols]; }

  /**
   * Move the pad. Unit u is kept; v (or normal) is re-orthogonalised against it; normal = u x v.
   * @param {PadFrameLike} frame @returns {this}
   */
  setFrame(frame) {
    const o = frame.origin ?? [0, 0, 0];
    const u = unit(frame.u ?? [1, 0, 0]);
    let v;
    if (frame.v) v = frame.v;
    else if (frame.normal) v = cross(frame.normal, u);
    else v = [0, 1, 0];
    const d = dot(v, u);
    v = unit([v[0] - d * u[0], v[1] - d * u[1], v[2] - d * u[2]]);
    const n = cross(u, v);
    this.frame = { origin: [o[0], o[1], o[2]], u, v, normal: n };
    this._toWorld();
    return this;
  }

  /** Bend the pad along u (see BendLike); 0 = flat. @param {BendLike} bend @returns {this} */
  setBend(bend) {
    this._bend = readBend(bend);
    this._applyBend();
    this._toWorld();
    return this;
  }

  /** The bend in use. */
  get bend() { return this._bend; }

  _applyBend() {
    bendLine(this.colS, this._bend, this._cx, this._cz, this._ct);
    const { rows, cols, local: L, localNormal: N } = this;
    for (let j = 0; j < cols; j++) {
      const x = this._cx[j], z = this._cz[j], s = Math.sin(this._ct[j]), c = Math.cos(this._ct[j]);
      for (let i = 0; i < rows; i++) {
        const k3 = 3 * (i * cols + j);
        L[k3] = x; L[k3 + 1] = this.rowB[i]; L[k3 + 2] = z;
        N[k3] = -s; N[k3 + 1] = 0; N[k3 + 2] = c;
      }
    }
  }

  _toWorld() {
    const { origin: o, u, v, normal: w } = this.frame, L = this.local, LN = this.localNormal, P = this.points, N = this.normals;
    let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
    for (let k3 = 0; k3 < L.length; k3 += 3) {
      const a = L[k3], b = L[k3 + 1], c = L[k3 + 2];
      const x = o[0] + u[0] * a + v[0] * b + w[0] * c, y = o[1] + u[1] * a + v[1] * b + w[1] * c, z = o[2] + u[2] * a + v[2] * b + w[2] * c;
      P[k3] = x; P[k3 + 1] = y; P[k3 + 2] = z;
      const na = LN[k3], nc = LN[k3 + 2];
      N[k3] = u[0] * na + w[0] * nc; N[k3 + 1] = u[1] * na + w[1] * nc; N[k3 + 2] = u[2] * na + w[2] * nc;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; if (z < z0) z0 = z; if (z > z1) z1 = z;
    }
    this.center = [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2];
    this.radius = norm3(x1 - x0, y1 - y0, z1 - z0) / 2;
  }

  /** World position of taxel k. @param {number} k @param {number[]} [out] @returns {number[]} */
  point(k, out = [0, 0, 0]) { out[0] = this.points[3 * k]; out[1] = this.points[3 * k + 1]; out[2] = this.points[3 * k + 2]; return out; }
  /** World normal of taxel k. @param {number} k @param {number[]} [out] @returns {number[]} */
  normal(k, out = [0, 0, 0]) { out[0] = this.normals[3 * k]; out[1] = this.normals[3 * k + 1]; out[2] = this.normals[3 * k + 2]; return out; }

  /**
   * World point and normal of any pad spot (a along u, b along v, mm, centre = 0), bend included.
   * @param {number} a @param {number} b @returns {{point: Vec3, normal: Vec3}}
   */
  surface(a, b) {
    const X = new Float64Array(1), Z = new Float64Array(1), T = new Float64Array(1);
    bendLine([a], this._bend, X, Z, T);
    const { origin: o, u, v, normal: w } = this.frame, s = Math.sin(T[0]), c = Math.cos(T[0]);
    const point = /** @type {Vec3} */ ([0, 1, 2].map((q) => o[q] + u[q] * X[0] + v[q] * b + w[q] * Z[0]));
    const normal = /** @type {Vec3} */ ([0, 1, 2].map((q) => -u[q] * s + w[q] * c));
    return { point, normal };
  }
}

/**
 * Make a pad (see Pad). makePad() is the 12 x 32 FlexiTac pad at 2 mm pitch, flat, at the origin.
 * @param {ConstructorParameters<typeof Pad>[0]} [opts] @returns {Pad}
 */
export function makePad(opts) { return new Pad(opts); }

/**
 * Two pads facing each other across a gap, as on a two-finger gripper. Both pads are the same part mounted
 * the same way on their finger: u runs along the finger toward its tip; each normal points at the other pad;
 * v = normal x u, so the two v axes are opposite (the right pad is the left one turned half a circle about
 * the finger axis).
 * @param {Object} [opts]
 * @param {Vec3Like} [opts.center] midpoint between the two touch faces (mm)
 * @param {number} [opts.gap] distance between the two touch faces (mm)
 * @param {Vec3Like} [opts.along] finger direction toward the tip (default [0, 0, -1]: fingers point down)
 * @param {Vec3Like} [opts.across] direction from the left pad to the right pad (default [1, 0, 0])
 * @param {BendLike} [opts.bend]
 * @param {Object} [opts.pad] extra Pad options (rows, cols, pitch)
 * @returns {{left: Pad, right: Pad}}
 */
export function padPair({ center = [0, 0, 0], gap = 40, along = [0, 0, -1], across = [1, 0, 0], bend, pad = {} } = {}) {
  const u = unit(along), x = unit(across);
  const place = (side) => ({
    origin: [center[0] - side * x[0] * gap / 2, center[1] - side * x[1] * gap / 2, center[2] - side * x[2] * gap / 2],
    u, normal: [side * x[0], side * x[1], side * x[2]],
  });
  return {
    left: new Pad({ ...pad, bend, frame: place(1), name: 'left' }),
    right: new Pad({ ...pad, bend, frame: place(-1), name: 'right' }),
  };
}

// ------------------------------------------------------------------------------------------------ shapes

const GL = new Float64Array(3); // scratch: local gradient (single-threaded)

/**
 * Base of every shape: a pose (world = R * local + pos), an exact signed distance (mm, negative inside) and
 * its gradient (the outward unit normal of the nearest surface point), a support distance, and a bounding
 * sphere about the pose origin. Set `enabled = false` to leave a shape out of contact without removing it.
 */
class ShapeBase {
  /** @param {string} kind @param {PoseLike | undefined} p @param {Mat3Like | null} pre local pre-rotation */
  constructor(kind, p, pre = null) {
    this.kind = kind;
    this.enabled = true;
    /** bounding radius about the pose origin (mm) */
    this.bound = 0;
    this._pre = pre;
    this._m = new Float64Array(12); // effective R (9, row-major) + pos (3)
    this._pose = pose();
    this.setPose(p ?? {});
  }
  /** Move the shape. @param {PoseLike} p @returns {this} */
  setPose(p) {
    this._pose = pose(p.pos ?? [0, 0, 0], p.rot ?? IDENTITY);
    const R = this._pre ? rotMul(this._pose.rot, this._pre) : this._pose.rot;
    for (let q = 0; q < 9; q++) this._m[q] = R[q];
    this._m[9] = this._pose.pos[0]; this._m[10] = this._pose.pos[1]; this._m[11] = this._pose.pos[2];
    return this;
  }
  /** Current pose (a copy). @returns {{pos: Vec3, rot: number[]}} */
  get pose() { return pose(this._pose.pos, this._pose.rot); }
  /** Centre of the bounding sphere (the pose origin). @returns {Vec3} */
  get center() { return [this._m[9], this._m[10], this._m[11]]; }

  /**
   * Signed distance at a world point; writes the world gradient into `grad` when given. The fast path the
   * contact loop uses.
   * @param {number} x @param {number} y @param {number} z @param {Float64Array | number[]} [grad] @returns {number}
   */
  eval(x, y, z, grad) {
    const m = this._m, dx = x - m[9], dy = y - m[10], dz = z - m[11];
    const d = this._local(m[0] * dx + m[3] * dy + m[6] * dz, m[1] * dx + m[4] * dy + m[7] * dz, m[2] * dx + m[5] * dy + m[8] * dz, GL);
    if (grad) {
      grad[0] = m[0] * GL[0] + m[1] * GL[1] + m[2] * GL[2];
      grad[1] = m[3] * GL[0] + m[4] * GL[1] + m[5] * GL[2];
      grad[2] = m[6] * GL[0] + m[7] * GL[1] + m[8] * GL[2];
    }
    return d;
  }
  /** Signed distance (mm) at world point p. @param {Vec3Like} p @returns {number} */
  sdf(p) { return this.eval(p[0], p[1], p[2]); }
  /** Unit gradient of the SDF at world point p. @param {Vec3Like} p @returns {Vec3} */
  gradient(p) { const g = /** @type {Vec3} */ ([0, 0, 0]); this.eval(p[0], p[1], p[2], g); return g; }
  /**
   * How far the shape reaches from its pose origin in world direction `dir`: max over the shape of
   * (point - pos) . dir_unit. pressOnto uses it.
   * @param {Vec3Like} dir @returns {number}
   */
  support(dir) {
    const [x, y, z] = unit(dir), m = this._m;
    return this._support(m[0] * x + m[3] * y + m[6] * z, m[1] * x + m[4] * y + m[7] * z, m[2] * x + m[5] * y + m[8] * z);
  }
  /** @param {number} _x @param {number} _y @param {number} _z @param {Float64Array} _g @returns {number} */
  _local(_x, _y, _z, _g) { return Infinity; }
  /** @param {number} _x @param {number} _y @param {number} _z @returns {number} */
  _support(_x, _y, _z) { return 0; }
}

/** A ball. */
export class Sphere extends ShapeBase {
  /** @param {{radius?: number, pose?: PoseLike}} [opts] */
  constructor({ radius = PRESETS.fingertip.radius, pose: p } = {}) {
    super('sphere', p);
    this.radius = radius;
    this.bound = radius;
  }
  /** @param {number} x @param {number} y @param {number} z @param {Float64Array} g */
  _local(x, y, z, g) {
    const r = norm3(x, y, z);
    if (r > 1e-12) { g[0] = x / r; g[1] = y / r; g[2] = z / r; } else { g[0] = 0; g[1] = 0; g[2] = 1; }
    return r - this.radius;
  }
  /** @param {number} _x @param {number} _y @param {number} _z */
  _support(_x, _y, _z) { return this.radius; }
}

/** A box with rounded edges; `size` is the full outer size, `round` the edge radius (0 = sharp). */
export class RoundBox extends ShapeBase {
  /** @param {{size?: Vec3Like, round?: number, pose?: PoseLike}} [opts] */
  constructor({ size = [30, 30, 30], round = 2, pose: p } = {}) {
    super('box', p);
    this.size = /** @type {Vec3} */ ([size[0], size[1], size[2]]);
    this.round = Math.max(0, Math.min(round, size[0] / 2, size[1] / 2, size[2] / 2));
    this._h = [size[0] / 2 - this.round, size[1] / 2 - this.round, size[2] / 2 - this.round];
    this.bound = norm3(size[0], size[1], size[2]) / 2;
  }
  /** @param {number} x @param {number} y @param {number} z @param {Float64Array} g */
  _local(x, y, z, g) {
    const h = this._h, ax = Math.abs(x) - h[0], ay = Math.abs(y) - h[1], az = Math.abs(z) - h[2];
    const ox = ax > 0 ? ax : 0, oy = ay > 0 ? ay : 0, oz = az > 0 ? az : 0, lo = norm3(ox, oy, oz);
    const mx = Math.max(ax, ay, az);
    const sx = x < 0 ? -1 : 1, sy = y < 0 ? -1 : 1, sz = z < 0 ? -1 : 1;
    if (lo > 0) { g[0] = sx * ox / lo; g[1] = sy * oy / lo; g[2] = sz * oz / lo; }
    else if (ax >= ay && ax >= az) { g[0] = sx; g[1] = 0; g[2] = 0; }
    else if (ay >= az) { g[0] = 0; g[1] = sy; g[2] = 0; }
    else { g[0] = 0; g[1] = 0; g[2] = sz; }
    return lo + (mx < 0 ? mx : 0) - this.round;
  }
  /** @param {number} x @param {number} y @param {number} z */
  _support(x, y, z) { const h = this._h; return Math.abs(x) * h[0] + Math.abs(y) * h[1] + Math.abs(z) * h[2] + this.round; }
}

const AXES = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] };

/** A solid capped cylinder along `axis` (local 'x' | 'y' | 'z' or any direction), edges rounded by `round`. */
export class Cylinder extends ShapeBase {
  /** @param {{radius?: number, length?: number, axis?: 'x' | 'y' | 'z' | Vec3Like, round?: number, pose?: PoseLike}} [opts] */
  constructor({ radius = 20, length = 60, axis = 'z', round = 1, pose: p } = {}) {
    const dir = typeof axis === 'string' ? AXES[axis] : axis;
    if (!dir) throw new Error(`touchsim: unknown cylinder axis ${String(axis)}`);
    super('cylinder', p, rotFromTo([0, 0, 1], dir));
    this.radius = radius; this.length = length;
    this.axis = unit(dir);
    this.round = Math.max(0, Math.min(round, radius, length / 2));
    this.bound = Math.hypot(radius, length / 2);
  }
  /** @param {number} x @param {number} y @param {number} z @param {Float64Array} g */
  _local(x, y, z, g) {
    const r = this.round, rho = Math.hypot(x, y);
    const qa = rho - (this.radius - r), qb = Math.abs(z) - (this.length / 2 - r);
    const oa = qa > 0 ? qa : 0, ob = qb > 0 ? qb : 0, lo = Math.hypot(oa, ob), mx = qa > qb ? qa : qb;
    let ga, gb;
    if (lo > 0) { ga = oa / lo; gb = ob / lo; } else if (qa >= qb) { ga = 1; gb = 0; } else { ga = 0; gb = 1; }
    const rx = rho > 1e-12 ? x / rho : 1, ry = rho > 1e-12 ? y / rho : 0;
    g[0] = ga * rx; g[1] = ga * ry; g[2] = gb * (z < 0 ? -1 : 1);
    return lo + (mx < 0 ? mx : 0) - r;
  }
  /** @param {number} x @param {number} y @param {number} z */
  _support(x, y, z) { const r = this.round; return (this.radius - r) * Math.hypot(x, y) + (this.length / 2 - r) * Math.abs(z) + r; }
}

/**
 * A strawberry: a smooth heart/cone solid of revolution about local z, blunt tip at z = -length/2, broad
 * shoulders about 3/4 of the way up, a nearly flat top (the calyx end) at z = +length/2. Its profile is
 * rho(t) = width/2 * g(t)/max g, g(t) = t^0.75 * (1 - t^5)^0.45, t = 0 (tip) .. 1 (top), sampled as a
 * polyline (denser near both ends); the SDF is the exact distance to that revolved polyline.
 */
export class Strawberry extends ShapeBase {
  /** @param {{length?: number, width?: number, segments?: number, pose?: PoseLike}} [opts] */
  constructor({ length = 34, width = 28, segments = 48, pose: p } = {}) {
    super('strawberry', p);
    this.length = length; this.width = width;
    const g = (t) => Math.pow(t, 0.75) * Math.pow(Math.max(0, 1 - Math.pow(t, 5)), 0.45);
    const M = segments, tAt = (m) => (1 - Math.cos((Math.PI * m) / M)) / 2;
    let gmax = 0;   // the widest sampled slice is exactly width / 2
    for (let m = 1; m < M; m++) gmax = Math.max(gmax, g(tAt(m)));
    /** profile polyline (rho, z), tip -> top, z strictly increasing */
    this.rho = new Float64Array(M + 1);
    this.z = new Float64Array(M + 1);
    let b = 0;
    for (let m = 0; m <= M; m++) {
      const t = tAt(m);
      this.rho[m] = m === 0 || m === M ? 0 : (width / 2) * g(t) / gmax;
      this.z[m] = -length / 2 + t * length;
      b = Math.max(b, Math.hypot(this.rho[m], this.z[m]));
    }
    this.bound = b;
  }
  /** @param {number} x @param {number} y @param {number} z @param {Float64Array} g */
  _local(x, y, z, g) {
    const R = this.rho, Z = this.z, M = R.length - 1, rho = Math.hypot(x, y);
    let best = Infinity, cr = 0, cz = 0, seg = 0, inside = false;
    for (let m = 0; m < M; m++) {
      const ar = R[m], az = Z[m], er = R[m + 1] - ar, ez = Z[m + 1] - az, wr = rho - ar, wz = z - az;
      let t = (wr * er + wz * ez) / (er * er + ez * ez);
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const pr = ar + er * t, pz = az + ez * t, d2 = (rho - pr) * (rho - pr) + (z - pz) * (z - pz);
      if (d2 < best) { best = d2; cr = pr; cz = pz; seg = m; }
      if (z >= az && z < Z[m + 1]) inside = rho < ar + er * ((z - az) / ez);
    }
    const dist = Math.sqrt(best);
    let gr, gz;
    if (dist > 1e-12) {
      const s = inside ? -1 / dist : 1 / dist;
      gr = (rho - cr) * s; gz = (z - cz) * s;
    } else {   // on the surface: the segment's outward normal (right-hand normal of the tip -> top direction)
      const er = R[seg + 1] - R[seg], ez = Z[seg + 1] - Z[seg], l = Math.hypot(er, ez);
      gr = ez / l; gz = -er / l;
    }
    const rx = rho > 1e-12 ? x / rho : 1, ry = rho > 1e-12 ? y / rho : 0;
    g[0] = gr * rx; g[1] = gr * ry; g[2] = gz;
    return inside ? -dist : dist;
  }
  /** @param {number} x @param {number} y @param {number} z */
  _support(x, y, z) {
    const dr = Math.hypot(x, y);
    let s = -Infinity;
    for (let m = 0; m < this.rho.length; m++) s = Math.max(s, this.rho[m] * dr + this.z[m] * z);
    return s;
  }
}

/** A ball (default: a fingertip-size r = 8 mm). @param {ConstructorParameters<typeof Sphere>[0]} [opts] */
export function sphere(opts) { return new Sphere(opts); }
/** A rounded box. @param {ConstructorParameters<typeof RoundBox>[0]} [opts] */
export function box(opts) { return new RoundBox(opts); }
/** A capped cylinder along any axis. @param {ConstructorParameters<typeof Cylinder>[0]} [opts] */
export function cylinder(opts) { return new Cylinder(opts); }
/** A strawberry (smooth heart/cone). @param {ConstructorParameters<typeof Strawberry>[0]} [opts] */
export function strawberry(opts) { return new Strawberry(opts); }
/** The fingertip preset: a sphere of PRESETS.fingertip.radius. @param {PoseLike} [p] */
export function fingertip(p) { return new Sphere({ radius: PRESETS.fingertip.radius, pose: p }); }

/**
 * Place a shape so its part nearest the pad sinks `depth` mm past the pad surface at pad spot (a, b),
 * straight along that spot's normal. Keeps the shape's rotation unless `rot` is given. Returns the shape.
 * After a jump like this call touch.reset() so the jump is not read as a fast press.
 * @template {Shape} S
 * @param {S} shape @param {Pad} pad
 * @param {{a?: number, b?: number, depth?: number, rot?: Mat3Like}} [opts]
 * @returns {S}
 */
export function pressOnto(shape, pad, { a = 0, b = 0, depth = PRESETS.firmDepth, rot } = {}) {
  if (rot) shape.setPose({ pos: shape.pose.pos, rot });
  const { point, normal } = pad.surface(a, b);
  const h = shape.support([-normal[0], -normal[1], -normal[2]]);
  const off = h - depth;
  shape.setPose({ pos: [point[0] + normal[0] * off, point[1] + normal[1] * off, point[2] + normal[2] * off], rot: shape.pose.rot });
  return shape;
}

// ------------------------------------------------------------------------------------------------ contact

const GW = new Float64Array(3), GB = new Float64Array(3); // scratch: world gradients
/** @type {Shape[]} */
const NEAR = [];
/** @type {number[]} */
const NEAR_IDX = [];

/**
 * Per-taxel penetration along the pad normal (pure; fills `out`). For each taxel: the nearest shape by SDF
 * (shapes overlap as a union), dist = that signed distance capped at `reach`; if it is inside (< 0), the
 * depth is -dist x max(0, -grad . normal): full depth when the surface faces the pad squarely, less on a
 * slope, none from behind.
 * Like any SDF penetration model (VT-Refine's too) the depth is right only while it is less than about half
 * the object's thickness under that taxel: deeper than that, the nearest surface becomes a side or the far
 * face and the reading drops. Lessons keep presses shallow (PRESETS: 0.6-1.8 mm).
 * @param {Pad} pad
 * @param {ArrayLike<Shape | null | undefined>} shapes  (null / disabled entries are skipped; indices are kept)
 * @param {{dist: Float32Array, depth: Float32Array, which: Int16Array}} out  which = nearest shape index within reach, else -1
 * @param {{reach?: number}} [opts]
 * @returns {number} the number of taxels in contact (depth > 0)
 */
export function measureDepth(pad, shapes, out, { reach = DEFAULTS.reach } = {}) {
  NEAR.length = 0; NEAR_IDX.length = 0;
  const c = pad.center;
  for (let s = 0; s < shapes.length; s++) {
    const sh = shapes[s];
    if (!sh || sh.enabled === false) continue;
    const sc = sh.center, gapToPad = norm3(sc[0] - c[0], sc[1] - c[1], sc[2] - c[2]) - sh.bound - pad.radius;
    if (gapToPad > reach) continue;   // the SDF is at least this everywhere on the pad
    NEAR.push(sh); NEAR_IDX.push(s);
  }
  const P = pad.points, N = pad.normals, { dist, depth, which } = out;
  let count = 0;
  for (let k = 0, k3 = 0; k < pad.n; k++, k3 += 3) {
    let best = reach, bi = -1;
    const x = P[k3], y = P[k3 + 1], z = P[k3 + 2];
    for (let q = 0; q < NEAR.length; q++) {
      const sh = NEAR[q], m = sh._m, ex = x - m[9], ey = y - m[10], ez = z - m[11];
      const lb = Math.sqrt(ex * ex + ey * ey + ez * ez) - sh.bound;   // the SDF is at least this
      if (lb >= best) continue;
      const d = sh.eval(x, y, z, GW);
      if (d < best) { best = d; bi = NEAR_IDX[q]; GB[0] = GW[0]; GB[1] = GW[1]; GB[2] = GW[2]; }
    }
    dist[k] = best; which[k] = bi;
    let dn = 0;
    if (best < 0) {
      const facing = -(GB[0] * N[k3] + GB[1] * N[k3 + 1] + GB[2] * N[k3 + 2]);
      if (facing > 0) dn = -best * facing;
    }
    depth[k] = dn;
    if (dn > 0) count++;
  }
  return count;
}

/**
 * One pad's touch: positions -> depth -> Kelvin-Voigt force, with the history needed for d'.
 *   step(shapes, dt) fills, per taxel (k = i * cols + j, Float32Array, ready for a map):
 *     dist  (mm, signed distance to the nearest shape, capped at reach)   depth (mm, >= 0, along the normal)
 *     rate  (mm/s, d' = (depth - previous depth) / dt; 0 on the first step) force (N, >= 0)
 *   and the totals: total (N), count (taxels in contact), peak (index of the largest force or -1),
 *   center ([a, b] force-weighted pad spot in mm, or null), push (world vector, N: what the pad pushes on the
 *   objects, along its normals), shapeForce[s] (N per shape index).
 */
export class Touch {
  /**
   * @param {Object} opts
   * @param {Pad} opts.pad
   * @param {number} [opts.kn] N/mm per taxel
   * @param {number} [opts.kd] N*s/mm per taxel
   * @param {number} [opts.reach] mm
   * @param {number} [opts.maxRate] mm/s cap on |d'| (Infinity = the pure model)
   */
  constructor({ pad, kn = DEFAULTS.kn, kd = DEFAULTS.kd, reach = DEFAULTS.reach, maxRate = DEFAULTS.maxRate }) {
    this.pad = pad; this.kn = kn; this.kd = kd; this.reach = reach; this.maxRate = maxRate;
    const n = pad.n;
    this.dist = new Float32Array(n).fill(reach);
    this.depth = new Float32Array(n);
    this.rate = new Float32Array(n);
    this.force = new Float32Array(n);
    this.which = new Int16Array(n).fill(-1);
    this._prev = new Float64Array(n);
    this._hasPrev = false;
    this.total = 0; this.count = 0; this.peak = -1;
    /** @type {[number, number] | null} */
    this.center = null;
    this.push = /** @type {Vec3} */ ([0, 0, 0]);
    /** @type {number[]} */
    this.shapeForce = [];
    this.time = 0; this.steps = 0;
  }

  /** Change the spring / damper. @param {{kn?: number, kd?: number}} g @returns {this} */
  setGains({ kn = this.kn, kd = this.kd }) { this.kn = kn; this.kd = kd; return this; }

  /** Forget the history: the next step reads d' = 0. Call after any jump (teleport, new object, new pad). @returns {this} */
  reset() {
    this._hasPrev = false; this._prev.fill(0);
    this.dist.fill(this.reach); this.depth.fill(0); this.rate.fill(0); this.force.fill(0); this.which.fill(-1);
    this.total = 0; this.count = 0; this.peak = -1; this.center = null; this.push = [0, 0, 0]; this.shapeForce = [];
    this.time = 0; this.steps = 0;
    return this;
  }

  /**
   * Advance one step of dt seconds against the shapes as they are now (move pads/shapes first).
   * @param {ArrayLike<Shape | null | undefined>} shapes @param {number} dt seconds (> 0; 0 reads d' = 0)
   * @returns {this}
   */
  step(shapes, dt) {
    const { pad, depth, rate, force, which, _prev: prev, kn, kd, maxRate } = this;
    this.count = measureDepth(pad, shapes, this, { reach: this.reach });
    const useRate = this._hasPrev && dt > 0;
    const L = pad.local, N = pad.normals;
    const sf = this.shapeForce;
    sf.length = shapes.length; sf.fill(0);
    let total = 0, peak = -1, best = 0, ca = 0, cb = 0, px = 0, py = 0, pz = 0;
    for (let k = 0, k3 = 0; k < pad.n; k++, k3 += 3) {
      const d = depth[k];
      let r = useRate ? (d - prev[k]) / dt : 0;
      if (r > maxRate) r = maxRate; else if (r < -maxRate) r = -maxRate;
      rate[k] = r;
      prev[k] = d;
      let f = kn * d + kd * r;
      if (!(f > 0)) f = 0;        // a pad only pushes; it never pulls (also 0 when not in contact)
      force[k] = f;
      if (f > 0) {
        total += f;
        if (f > best) { best = f; peak = k; }
        ca += f * L[k3]; cb += f * L[k3 + 1];
        px += f * N[k3]; py += f * N[k3 + 1]; pz += f * N[k3 + 2];
        if (which[k] >= 0) sf[which[k]] += f;
      }
    }
    this.total = total; this.peak = peak;
    this.center = total > 0 ? [ca / total, cb / total] : null;
    this.push = [px, py, pz];
    this._hasPrev = true;
    this.time += dt; this.steps++;
    return this;
  }
}

/** A pad's touch (see Touch). @param {ConstructorParameters<typeof Touch>[0]} opts @returns {Touch} */
export function createTouch(opts) { return new Touch(opts); }

/**
 * Kelvin-Voigt on bare arrays (for cards that draw the springs): force[k] = max(0, kn*depth[k] + kd*rate[k]),
 * rate[k] = (depth[k] - prev[k]) / dt (0 when dt <= 0 or prev is null). Writes `rate` and `force`; returns
 * the total (N).
 * @param {ArrayLike<number>} depth @param {ArrayLike<number> | null} prev @param {number} dt
 * @param {{kn?: number, kd?: number}} gains @param {{rate: Float32Array | number[], force: Float32Array | number[]}} out
 */
export function kelvinVoigt(depth, prev, dt, { kn = DEFAULTS.kn, kd = DEFAULTS.kd }, out) {
  let total = 0;
  for (let k = 0; k < depth.length; k++) {
    const r = prev && dt > 0 ? (depth[k] - prev[k]) / dt : 0;
    let f = kn * depth[k] + kd * r;
    if (!(f > 0)) f = 0;
    out.rate[k] = r; out.force[k] = f; total += f;
  }
  return total;
}

// ------------------------------------------------------------------------------------------------ readout

/**
 * The FlexiTac normalisation rule, bit for bit the host viewer's (host.mjs processFrame, float32):
 *   c = clip(input - baseline - threshold, 0, clipMax);  out = c / (max(c) < threshold ? noiseScale : max(c) + 1e-6)
 * `input` and `baseline` are in counts (byte steps). Writes `out` (0..1) and returns {max, lit, quiet}.
 * @param {ArrayLike<number>} input @param {Float32Array} out
 * @param {{threshold?: number, noiseScale?: number, clipMax?: number, baseline?: ArrayLike<number> | null, clip01?: boolean}} [opts]
 * @returns {NormStats}
 */
export function normalizeFrame(input, out, { threshold = READOUT.threshold, noiseScale = READOUT.noiseScale, clipMax = READOUT.clipMax, baseline = null, clip01 = false } = {}) {
  const n = input.length;
  let mx = -Infinity;
  for (let k = 0; k < n; k++) {
    let v = f32(f32(input[k] - (baseline ? baseline[k] : 0)) - threshold);
    v = v < 0 ? 0 : v > clipMax ? clipMax : v;
    out[k] = v;
    if (v > mx) mx = v;
  }
  const quiet = mx < threshold, div = quiet ? f32(noiseScale) : f32(mx + 1e-6);
  let lit = 0;
  for (let k = 0; k < n; k++) {
    let v = f32(out[k] / div);
    if (clip01) v = v < 0 ? 0 : v > 1 ? 1 : v;
    out[k] = v;
    if (v > 0) lit++;
  }
  return { max: mx, lit, quiet };
}

/** 32-bit integer hash (lowbias32). @param {number} h */
function mix32(h) {
  h ^= h >>> 16; h = Math.imul(h, 0x7feb352d);
  h ^= h >>> 15; h = Math.imul(h, 0x846ca68b);
  h ^= h >>> 16;
  return h >>> 0;
}
/** @param {number} a @param {number} b @param {number} c @param {number} d */
function hash4(a, b, c, d) { return mix32(mix32(mix32(mix32(a ^ 0x9e3779b9) ^ b) ^ c) ^ d); }
const U32 = 4294967296;
/**
 * Deterministic noise with mean 0 and standard deviation 1 (Irwin-Hall of 4 uniforms; bounded to
 * +-3.46, plain arithmetic only so it is identical in every JS engine).
 * @param {number} seed @param {number} frame @param {number} k @param {number} [stream] @returns {number}
 */
export function noiseAt(seed, frame, k, stream = 0) {
  let s = 0;
  for (let q = 0; q < 4; q++) s += (hash4(seed | 0, (stream * 4 + q) | 0, frame | 0, k | 0) + 0.5) / U32;
  return (s - 2) * 1.7320508075688772;
}

/**
 * Turns per-taxel force into the 0..1 map the viewers draw, in one of two styles that share the rule and
 * the threshold:
 *   'sim'  : counts = force * countsPerN (floats, no baseline, no noise) -> normalizeFrame.
 *   'real' : raw byte = clamp(round(rest[k] + response(force) + noise * N(0,1)), 0, 255), the baseline is the
 *            per-taxel median of `initFrames` resting frames (built once, like the host's first 30 frames),
 *            then normalizeFrame(raw, baseline) - identical to host.mjs processFrame on those bytes.
 * read(force) updates and returns this; the arrays are reused (k = i * cols + j).
 */
export class Readout {
  /**
   * @param {Object} [opts]
   * @param {'sim' | 'real'} [opts.style]
   * @param {number} [opts.n] taxels (384)
   * @param {number} [opts.countsPerN] counts per newton (125, illustrative)
   * @param {number} [opts.threshold] counts (15)
   * @param {number} [opts.noiseScale] counts (60)
   * @param {number} [opts.clipMax] counts (100)
   * @param {number} [opts.noise] real style: noise standard deviation in counts (1)
   * @param {number} [opts.seed] real style: noise and resting-byte seed
   * @param {readonly number[]} [opts.rest] real style: resting byte range [min, max] (12..24)
   * @param {number} [opts.initFrames] real style: frames in the baseline median (30)
   * @param {(force: number) => number} [opts.response] real style: counts above rest for a force (default linear)
   */
  constructor({ style = 'sim', n = TAXELS, countsPerN = READOUT.countsPerN, threshold = READOUT.threshold, noiseScale = READOUT.noiseScale,
    clipMax = READOUT.clipMax, noise = READOUT.noise, seed = READOUT.seed, rest = READOUT.rest, initFrames = READOUT.initFrames, response } = {}) {
    this.style = style; this.n = n;
    this.countsPerN = countsPerN; this.threshold = threshold; this.noiseScale = noiseScale; this.clipMax = clipMax;
    this.noise = noise; this.seed = seed; this.initFrames = initFrames;
    this.response = response ?? ((f) => f * this.countsPerN);
    /** the map: 0..1 per taxel */
    this.norm = new Float32Array(n);
    /** contact signal in counts before the threshold (sim: force * countsPerN; real: raw - baseline) */
    this.counts = new Float32Array(n);
    /** real style: the bytes on the wire; sim style: null */
    this.raw = style === 'real' ? new Uint8Array(n) : null;
    /** real style: resting byte per taxel */
    this.rest = style === 'real' ? Uint8Array.from({ length: n }, (_, k) => rest[0] + Math.floor(((hash4(seed, 7, 0, k) + 0.5) / U32) * (rest[1] - rest[0] + 1))) : null;
    /** real style: per-taxel median of the first initFrames resting frames (float32, like np.median) */
    this.baseline = style === 'real' ? this._buildBaseline() : null;
    this.frame = 0;
    this.max = 0; this.lit = 0; this.quiet = true;
  }

  _buildBaseline() {
    const n = this.n, F = this.initFrames, out = new Float32Array(n), col = new Float64Array(F);
    for (let k = 0; k < n; k++) {
      for (let f = 0; f < F; f++) col[f] = this._byte(k, 0, f, 1);
      col.sort();
      out[k] = F % 2 ? col[(F - 1) / 2] : f32((col[F / 2 - 1] + col[F / 2]) / 2);
    }
    return out;
  }

  /** @param {number} k @param {number} counts @param {number} frame @param {number} stream */
  _byte(k, counts, frame, stream) {
    const rest = /** @type {Uint8Array} */ (this.rest);
    const v = Math.round(rest[k] + counts + this.noise * noiseAt(this.seed, frame, k, stream));
    return v < 0 ? 0 : v > 255 ? 255 : v;
  }

  /** Read one frame of per-taxel force (N). @param {ArrayLike<number>} force @returns {this} */
  read(force) {
    const opts = { threshold: this.threshold, noiseScale: this.noiseScale, clipMax: this.clipMax, baseline: /** @type {Float32Array | null} */ (null) };
    if (this.style === 'real') {
      const raw = /** @type {Uint8Array} */ (this.raw), base = /** @type {Float32Array} */ (this.baseline);
      for (let k = 0; k < this.n; k++) {
        raw[k] = this._byte(k, this.response(force[k]), this.frame, 2);
        this.counts[k] = raw[k] - base[k];
      }
      opts.baseline = base;
      Object.assign(this, normalizeFrame(raw, this.norm, opts));
    } else {
      for (let k = 0; k < this.n; k++) this.counts[k] = force[k] * this.countsPerN;
      Object.assign(this, normalizeFrame(this.counts, this.norm, opts));
    }
    this.frame++;
    return this;
  }

  /** Back to frame 0 (the real-style noise sequence restarts). @returns {this} */
  reset() { this.frame = 0; this.norm.fill(0); this.counts.fill(0); this.raw?.fill(0); this.max = 0; this.lit = 0; this.quiet = true; return this; }

  /** The threshold in newtons per taxel (threshold / countsPerN). */
  get thresholdN() { return this.threshold / this.countsPerN; }
}

/** A readout (see Readout). @param {ConstructorParameters<typeof Readout>[0]} [opts] @returns {Readout} */
export function createReadout(opts) { return new Readout(opts); }

// ------------------------------------------------------------------------------------------------ lesson helpers

/**
 * @typedef {Object} Curve
 * @property {Float64Array} t      s
 * @property {Float64Array} depth  mm (indentation of one taxel)
 * @property {Float64Array} rate   mm/s (backward difference, as the engine steps it; 0 at the first sample)
 * @property {Float64Array} force  N
 * @property {Float64Array} counts force * countsPerN
 * @property {Uint8Array} loading  1 while the press goes in, 0 on the way out
 * @property {number} kn @property {number} kd @property {number} depthMax @property {number} duration
 * @property {boolean} illustrative
 * @property {string} label
 */

/** @param {number} m @param {number} samples @param {number} duration @param {number} depthMax @param {'triangle' | 'sine'} profile */
function pressDepth(m, samples, duration, depthMax, profile) {
  const u = m / (samples - 1);
  return profile === 'sine' ? (depthMax * (1 - Math.cos(2 * Math.PI * u))) / 2 : depthMax * (1 - Math.abs(2 * u - 1));
}

/**
 * A DMA-style force-response curve of one taxel: a flat probe presses in to depthMax and back out over
 * `duration` seconds ('triangle' = steady speed in, steady speed out; 'sine' = smooth), sampled at `samples`
 * points; force = max(0, kn*depth + kd*rate). With kd > 0 the way in reads higher than the way out (a loop).
 * @param {Object} [opts]
 * @param {number} [opts.kn] @param {number} [opts.kd] @param {number} [opts.depthMax] mm (PRESETS.firmDepth, 1.3)
 * @param {number} [opts.duration] s (0.3) @param {number} [opts.samples] (121) @param {'triangle' | 'sine'} [opts.profile]
 * @param {number} [opts.countsPerN]
 * @returns {Curve}
 */
export function responseCurve({ kn = DEFAULTS.kn, kd = DEFAULTS.kd, depthMax = PRESETS.firmDepth, duration = 0.3, samples = 121, profile = 'triangle', countsPerN = READOUT.countsPerN } = {}) {
  const t = new Float64Array(samples), depth = new Float64Array(samples), rate = new Float64Array(samples);
  const force = new Float64Array(samples), counts = new Float64Array(samples), loading = new Uint8Array(samples);
  const dt = duration / (samples - 1);
  for (let m = 0; m < samples; m++) {
    t[m] = m * dt;
    depth[m] = pressDepth(m, samples, duration, depthMax, profile);
    rate[m] = m ? (depth[m] - depth[m - 1]) / dt : 0;
    const f = kn * depth[m] + kd * rate[m];
    force[m] = f > 0 ? f : 0;
    counts[m] = force[m] * countsPerN;
    loading[m] = 2 * m <= samples - 1 ? 1 : 0;
  }
  return { t, depth, rate, force, counts, loading, kn, kd, depthMax, duration, illustrative: true, label: 'sim: f = max(0, k_n d + k_d d\')' };
}

/** The hidden settings behind illustrativeCurve (chosen so its best fit rounds to DEFAULTS). */
const ILLUSTRATIVE_TRUE = Object.freeze({ kn: 0.61, kd: 0.0123, fSat: 3, noise: 0.006, seed: 8 });

/**
 * An ILLUSTRATIVE stand-in for a measured force-response curve (no DMA data supplied, D8): the same press
 * as responseCurve, read through a softly saturating response with a little deterministic noise. A linear
 * spring + damper fits it closely but not perfectly, as with a real sensor. Same sampling options as
 * responseCurve (minus kn / kd).
 * @param {Parameters<typeof responseCurve>[0]} [opts] @returns {Curve}
 */
export function illustrativeCurve(opts = {}) {
  const T = ILLUSTRATIVE_TRUE;
  const c = responseCurve({ ...opts, kn: T.kn, kd: T.kd });
  const cpn = opts.countsPerN ?? READOUT.countsPerN;
  for (let m = 0; m < c.force.length; m++) {
    let f = T.fSat * Math.tanh(c.force[m] / T.fSat) + (c.force[m] > 0 ? T.noise * noiseAt(T.seed, 0, m, 3) : 0);
    f = f > 0 ? f : 0;
    c.force[m] = f; c.counts[m] = f * cpn;
  }
  c.kn = NaN; c.kd = NaN;
  c.label = 'illustrative "measured" curve - no real force data';
  return c;
}

/**
 * Model force for a curve's depth and rate with given gains (for redrawing a slider's curve).
 * @param {{depth: ArrayLike<number>, rate: ArrayLike<number>}} curve @param {number} kn @param {number} kd
 * @param {Float64Array} [out] @returns {Float64Array}
 */
export function modelForce(curve, kn, kd, out = new Float64Array(curve.depth.length)) {
  for (let m = 0; m < curve.depth.length; m++) { const f = kn * curve.depth[m] + kd * curve.rate[m]; out[m] = f > 0 ? f : 0; }
  return out;
}

/** Root-mean-square difference of two equal-length arrays. @param {ArrayLike<number>} a @param {ArrayLike<number>} b */
export function curveRmse(a, b) {
  let s = 0;
  for (let m = 0; m < a.length; m++) s += (a[m] - b[m]) ** 2;
  return Math.sqrt(s / a.length);
}

/**
 * Least-squares fit of kn, kd >= 0 so max(0, kn*depth + kd*rate) matches target.force - the calibration
 * step of VT-Refine (fit one taxel's curve, use the gains everywhere). The model is linear in (kn, kd)
 * except for the max(0, .), so this solves the 2x2 normal equations on the samples that matter (model or
 * target above 0) and repeats until that set stops changing.
 * @param {{depth: ArrayLike<number>, rate: ArrayLike<number>, force: ArrayLike<number>}} target
 * @param {{iterations?: number}} [opts]
 * @returns {{kn: number, kd: number, rmse: number, iterations: number}}
 */
export function fitKnKd(target, { iterations = 30 } = {}) {
  const { depth: D, rate: R, force: F } = target, n = D.length;
  let kn = NaN, kd = 0, it = 0;
  const active = new Uint8Array(n).fill(1);
  for (; it < iterations; it++) {
    let sdd = 0, sdr = 0, srr = 0, sdf = 0, srf = 0;
    for (let m = 0; m < n; m++) {
      if (!active[m]) continue;
      sdd += D[m] * D[m]; sdr += D[m] * R[m]; srr += R[m] * R[m]; sdf += D[m] * F[m]; srf += R[m] * F[m];
    }
    const det = sdd * srr - sdr * sdr;
    let a = det > 1e-12 * sdd * srr ? (sdf * srr - srf * sdr) / det : sdd > 0 ? sdf / sdd : 0;
    let b = det > 1e-12 * sdd * srr ? (srf * sdd - sdf * sdr) / det : 0;
    if (b < 0) { b = 0; a = sdd > 0 ? sdf / sdd : 0; }
    if (a < 0) { a = 0; b = srr > 0 ? Math.max(0, srf / srr) : 0; }
    let changed = !(Math.abs(a - kn) <= 1e-12 * Math.max(1, Math.abs(a)) && Math.abs(b - kd) <= 1e-12);
    kn = a; kd = b;
    for (let m = 0; m < n; m++) {
      const on = kn * D[m] + kd * R[m] > 0 || F[m] > 0 ? 1 : 0;
      if (on !== active[m]) { active[m] = on; changed = true; }
    }
    if (!changed) { it++; break; }
  }
  return { kn, kd, rmse: curveRmse(modelForce(target, kn, kd), F), iterations: it };
}

/**
 * Scale any per-taxel array into 0..1 for a map: out[k] = clamp(src[k] / max, 0, 1); max <= 0 uses the
 * array's own max. @param {ArrayLike<number>} src @param {number} [max] @param {Float32Array} [out] @returns {Float32Array}
 */
export function toUnit(src, max = 0, out = new Float32Array(src.length)) {
  let m = max;
  if (!(m > 0)) { m = 0; for (let k = 0; k < src.length; k++) if (src[k] > m) m = src[k]; }
  for (let k = 0; k < src.length; k++) { const v = m > 0 ? src[k] / m : 0; out[k] = v < 0 ? 0 : v > 1 ? 1 : v; }
  return out;
}

/**
 * A tactile point cloud like 3D-ViTac / VT-Refine's: x, y, z (world, mm) + one reading per taxel.
 * @param {Pad} pad @param {ArrayLike<number>} values per taxel (e.g. a readout's norm) @param {Float32Array} [out] 4 per taxel
 * @returns {Float32Array}
 */
export function pointCloud(pad, values, out = new Float32Array(4 * pad.n)) {
  for (let k = 0; k < pad.n; k++) {
    out[4 * k] = pad.points[3 * k]; out[4 * k + 1] = pad.points[3 * k + 1]; out[4 * k + 2] = pad.points[3 * k + 2]; out[4 * k + 3] = values[k];
  }
  return out;
}
