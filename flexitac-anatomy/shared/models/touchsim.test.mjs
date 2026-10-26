// Unit tests for touchsim.mjs. Run:  node --test models/touchsim.test.mjs   (or: node models/touchsim.test.mjs)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import * as ts from './touchsim.mjs';
import { processFrame } from './host.mjs';
import { ROWS, COLS, ROW_X, COL_Y, THRESHOLD, NOISE_SCALE } from '../data/constants.mjs';

const near = (a, b, tol, msg = '') => assert.ok(Math.abs(a - b) <= tol, `${msg} ${a} vs ${b} (tol ${tol})`);
const vnear = (a, b, tol, msg = '') => { for (let q = 0; q < 3; q++) near(a[q], b[q], tol, `${msg}[${q}]`); };
const len = (v) => Math.hypot(v[0], v[1], v[2]);
// deterministic PRNG for test inputs
function rng(seed) { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32); }
const sameBits = (a, b) => Buffer.from(a.buffer, a.byteOffset, a.byteLength).equals(Buffer.from(b.buffer, b.byteOffset, b.byteLength));

// ------------------------------------------------------------------------------------------------ module rules

test('module: pure, deterministic sources only; illustrative labels', () => {
  const src = readFileSync(fileURLToPath(new URL('./touchsim.mjs', import.meta.url)), 'utf8');
  const code = src.split('\n').filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*')).join('\n');
  for (const bad of ['Math.random', 'Date.now', 'new Date', 'performance', 'document', 'window', 'setTimeout', 'requestAnimationFrame']) {
    assert.ok(!code.includes(bad), `uses ${bad}`);
  }
  assert.equal(ts.ILLUSTRATIVE, true);
  assert.match(ts.LABEL, /illustrative/i);
  assert.equal(ts.TAXELS, 384);
  assert.equal(ts.READOUT.threshold, THRESHOLD);
  assert.equal(ts.READOUT.noiseScale, NOISE_SCALE);
  assert.deepEqual([ts.PAPER.kn, ts.PAPER.kd], [1.0, 3e-3]);
  // the illustrative scale lines up with VT-Refine's sim normalisation: threshold 0.2 mm, noise scale 0.8 mm
  near(ts.READOUT.threshold / ts.READOUT.countsPerN / ts.DEFAULTS.kn, 0.2, 1e-12, 'threshold depth');
  near(ts.READOUT.noiseScale / ts.READOUT.countsPerN / ts.DEFAULTS.kn, 0.8, 1e-12, 'noise-scale depth');
});

// ------------------------------------------------------------------------------------------------ pads

test('pad: 12 x 32 lattice, 2 mm pitch, real frame order values[i * 32 + j]', () => {
  const pad = ts.makePad();
  assert.equal(pad.rows, ROWS); assert.equal(pad.cols, COLS); assert.equal(pad.n, 384); assert.equal(pad.pitch, 2);
  for (let i = 0; i < ROWS; i++) for (let j = 0; j < COLS; j++) {
    const k = pad.index(i, j);
    assert.equal(k, i * 32 + j);
    assert.deepEqual(pad.rowCol(k), [i, j]);
    // pad coordinates = the FPC Gerber position of the crossing (ROW_X[i], COL_Y[j]) with u = +y, v = -x
    assert.equal(pad.local[3 * k], COL_Y[j]);
    assert.equal(pad.local[3 * k + 1], -ROW_X[i]);
    assert.equal(pad.local[3 * k + 2], 0);
    vnear(pad.point(k), [COL_Y[j], -ROW_X[i], 0], 0, 'identity frame');
    vnear(pad.normal(k), [0, 0, 1], 0, 'normal');
  }
  // 62 x 22 mm between the outer taxel centres = the 64 x 24 mm sensing area less half a pitch each side
  near(pad.local[3 * 31] - pad.local[0], 62, 0);
  near(pad.local[3 * (11 * 32) + 1] - pad.local[1], 22, 0);
  near(pad.radius, Math.hypot(62, 22) / 2, 1e-9);
});

test('pad: frames (u + normal, u + v) place points and normals; right-handed', () => {
  const pad = ts.makePad({ frame: { origin: [10, 20, 30], u: [0, 0, -1], normal: [1, 0, 0] } });
  vnear(pad.frame.v, [0, 1, 0], 1e-12, 'v = normal x u');
  vnear(pad.frame.normal, [1, 0, 0], 1e-12);
  for (const k of [0, 31, 200, 383]) {
    const a = pad.local[3 * k], b = pad.local[3 * k + 1];
    vnear(pad.point(k), [10, 20 + b, 30 - a], 1e-4, `point ${k}`);
    vnear(pad.normal(k), [1, 0, 0], 1e-7, `normal ${k}`);
  }
  // non-orthogonal v is re-orthogonalised against u
  const p2 = ts.makePad({ frame: { u: [2, 0, 0], v: [1, 1, 0] } });
  vnear(p2.frame.u, [1, 0, 0], 1e-12); vnear(p2.frame.v, [0, 1, 0], 1e-12); vnear(p2.frame.normal, [0, 0, 1], 1e-12);
  // setFrame moves everything and returns the pad
  assert.equal(p2.setFrame({ origin: [0, 0, 5] }), p2);
  near(p2.points[2], 5, 0);
});

test('pad: bend follows a smooth curvature, keeps arc length, curls toward +normal', () => {
  const kappa = 1 / 40;
  const pad = ts.makePad({ bend: kappa });
  const s = (j) => (j - 15.5) * 2;
  for (let i of [0, 7]) for (let j = 0; j < 32; j++) {
    const k = pad.index(i, j), th = kappa * s(j);
    near(pad.local[3 * k], Math.sin(th) / kappa, 1e-5, 'x');
    near(pad.local[3 * k + 2], (1 - Math.cos(th)) / kappa, 1e-5, 'z');
    assert.ok(pad.local[3 * k + 2] >= 0, 'ends curl toward +normal');
    vnear([pad.localNormal[3 * k], pad.localNormal[3 * k + 1], pad.localNormal[3 * k + 2]], [-Math.sin(th), 0, Math.cos(th)], 1e-6);
    if (j) {   // chord between neighbouring drive lines = 2 sin(kappa p / 2) / kappa
      const k0 = pad.index(i, j - 1), d = Math.hypot(pad.local[3 * k] - pad.local[3 * k0], pad.local[3 * k + 2] - pad.local[3 * k0 + 2]);
      near(d, (2 * Math.sin(kappa)) / kappa, 1e-5, 'chord');
    }
  }
  // a curvature function equal to the constant gives the same lattice (integrated numerically)
  const pf = ts.makePad({ bend: () => kappa });
  for (let q = 0; q < pad.local.length; q++) near(pf.local[q], pad.local[q], 2e-5, `fn ${q}`);
  // a varying curvature keeps neighbouring taxels about one pitch apart
  const pv = ts.makePad({ bend: { kappa: (x) => 0.03 * Math.exp(-((x - 10) ** 2) / 100), anchor: -31 } });
  vnear([pv.local[0], pv.local[1], pv.local[2]], [-31, -11, 0], 1e-9, 'anchor stays put');
  for (let j = 1; j < 32; j++) {
    const a = 3 * j, b = 3 * (j - 1), d = Math.hypot(pv.local[a] - pv.local[b], pv.local[a + 2] - pv.local[b + 2]);
    assert.ok(d <= 2 + 1e-6 && d > 2 - 0.01, `chord ${j}: ${d}`);   // (positions are stored as float32)
  }
  // surface() is bend-aware and agrees with the taxel points; setBend(0) restores flat
  const sp = pad.surface(s(20), pad.rowB[3]);
  vnear(sp.point, pad.point(pad.index(3, 20)), 1e-4); vnear(sp.normal, pad.normal(pad.index(3, 20)), 1e-6);
  pad.setBend(0);
  near(Math.max(...pad.local.filter((_, q) => q % 3 === 2).map(Math.abs)), 0, 0);
});

test('padPair: faces apart by the gap, normals facing, v mirrored', () => {
  const { left, right } = ts.padPair({ center: [0, 0, 100], gap: 30 });
  vnear(left.frame.normal, [1, 0, 0], 1e-12); vnear(right.frame.normal, [-1, 0, 0], 1e-12);
  vnear(left.frame.u, [0, 0, -1], 1e-12); vnear(right.frame.u, [0, 0, -1], 1e-12);
  vnear(left.frame.v, [0, 1, 0], 1e-12); vnear(right.frame.v, [0, -1, 0], 1e-12);
  near(right.frame.origin[0] - left.frame.origin[0], 30, 1e-12);
  // a ball between them, off-centre along y and z: right (11 - i, j) mirrors left (i, j)
  const ball = ts.sphere({ radius: 16, pose: { pos: [0, 3, 95] } });
  const tl = ts.createTouch({ pad: left }).step([ball], 0.01), tr = ts.createTouch({ pad: right }).step([ball], 0.01);
  assert.ok(tl.total > 0);
  near(tl.total, tr.total, 1e-5);
  for (let i = 0; i < 12; i++) for (let j = 0; j < 32; j++) near(tl.force[i * 32 + j], tr.force[(11 - i) * 32 + j], 1e-6);
});

// ------------------------------------------------------------------------------------------------ shapes

test('shapes: exact distances at known points', () => {
  const s = ts.sphere({ radius: 8 });
  near(s.sdf([0, 0, 0]), -8, 0); near(s.sdf([11, 0, 0]), 3, 1e-12); vnear(s.gradient([0, 0, -5]), [0, 0, -1], 1e-12);
  const b = ts.box({ size: [20, 10, 6], round: 0 });
  near(b.sdf([15, 0, 0]), 5, 1e-12); near(b.sdf([0, 0, 0]), -3, 1e-12); near(b.sdf([12, 7, 0]), Math.SQRT2 * 2, 1e-12);
  vnear(b.gradient([0, 0, -2]), [0, 0, -1], 0);
  const br = ts.box({ size: [20, 10, 6], round: 1 });
  near(br.sdf([15, 0, 0]), 5, 1e-12); near(br.sdf([12, 7, 5]), Math.sqrt(27) - 1, 1e-12);
  const c = ts.cylinder({ radius: 5, length: 20, axis: 'z', round: 0 });
  near(c.sdf([8, 0, 0]), 3, 1e-12); near(c.sdf([0, 0, 13]), 3, 1e-12); near(c.sdf([0, 0, 0]), -5, 1e-12);
  near(c.sdf([8, 0, 13]), Math.hypot(3, 3), 1e-12);
  const cx = ts.cylinder({ radius: 5, length: 20, axis: 'x', round: 0 });
  near(cx.sdf([13, 0, 0]), 3, 1e-12); near(cx.sdf([0, 0, 8]), 3, 1e-12); vnear(cx.gradient([0, -9, 0]), [0, -1, 0], 1e-12);
  const ca = ts.cylinder({ radius: 5, length: 20, axis: [1, 1, 0], round: 0 });
  near(ca.sdf([13 / Math.SQRT2, 13 / Math.SQRT2, 0]), 3, 1e-9);
  const w = ts.strawberry({ length: 34, width: 28 });
  assert.ok(w.sdf([0, 0, 0]) < -8, 'centre is deep inside');
  near(w.sdf([0, 0, -17]), 0, 1e-9, 'tip on the surface');
  near(w.sdf([0, 0, 17]), 0, 1e-9, 'top on the surface');
  near(w.sdf([0, 0, -27]), 10, 1e-9, 'below the tip');
  near(w.support([1, 0, 0]), 14, 1e-9, 'widest radius = width / 2');
  near(w.support([0, 0, -1]), 17, 1e-12); near(w.support([0, 0, 1]), 17, 1e-12);
  // shoulders sit high: the widest slice is in the upper half
  let best = 0, at = 0;
  for (let m = 0; m < w.rho.length; m++) if (w.rho[m] > best) { best = w.rho[m]; at = w.z[m]; }
  assert.ok(at > 2 && at < 12, `widest at z = ${at}`);
});

test('shapes: gradients are unit length and match finite differences (outside, away from creases)', () => {
  const R = rng(7);
  const shapes = [
    ts.sphere({ radius: 8 }),
    ts.box({ size: [20, 12, 8], round: 2 }),
    ts.cylinder({ radius: 6, length: 30, axis: 'y', round: 1.5 }),
    ts.strawberry(),
  ];
  for (const s of shapes) {
    let checked = 0;
    for (let q = 0; q < 400; q++) {
      const p = [(R() - 0.5) * 50, (R() - 0.5) * 50, (R() - 0.5) * 50];
      const d = s.sdf(p), g = s.gradient(p);
      near(len(g), 1, 1e-9, `${s.kind} |grad|`);
      if (d < 0.05 && s.kind !== 'sphere') continue;
      const h = 1e-5, fd = [0, 1, 2].map((a) => {
        const pp = [...p], pm = [...p]; pp[a] += h; pm[a] -= h;
        return (s.sdf(pp) - s.sdf(pm)) / (2 * h);
      });
      vnear(g, fd, 2e-4, `${s.kind} grad at ${p.map((v) => v.toFixed(2))}`);
      checked++;
    }
    assert.ok(checked > 100, `${s.kind}: ${checked} points checked`);
  }
});

test('shapes: poses move and turn the field; support matches a brute-force scan', () => {
  const rot = ts.rotMul(ts.rotZ(0.7), ts.rotX(-0.4)), pos = [5, -3, 12];
  const R = rng(11);
  for (const make of [(p) => ts.box({ size: [18, 10, 6], round: 1, pose: p }), (p) => ts.cylinder({ radius: 5, length: 24, axis: 'x', pose: p }), (p) => ts.strawberry({ pose: p })]) {
    const at0 = make(undefined), moved = make({ pos, rot });
    for (let q = 0; q < 50; q++) {
      const pl = [(R() - 0.5) * 40, (R() - 0.5) * 40, (R() - 0.5) * 40], pw = ts.transformPoint({ pos, rot }, pl);
      near(moved.sdf(pw), at0.sdf(pl), 1e-9, `${moved.kind} pose`);
      const gl = at0.gradient(pl), gw = moved.gradient(pw);
      vnear(gw, ts.transformPoint({ rot }, gl), 1e-9, `${moved.kind} gradient turns`);
    }
    vnear(ts.inverseTransformPoint({ pos, rot }, ts.transformPoint({ pos, rot }, [1, 2, 3])), [1, 2, 3], 1e-12);
    // support(dir) = max over the solid of (x - pos) . dir: scan a 0.5 mm grid
    for (const dir of [[1, 0, 0], [0, -1, 0], [0.3, 0.5, -0.8]]) {
      const u = [dir[0] / len(dir), dir[1] / len(dir), dir[2] / len(dir)];
      let mx = -Infinity;
      for (let x = -20; x <= 20; x += 0.5) for (let y = -20; y <= 20; y += 0.5) for (let z = -20; z <= 20; z += 0.5) {
        if (moved.eval(pos[0] + x, pos[1] + y, pos[2] + z) <= 0) mx = Math.max(mx, x * u[0] + y * u[1] + z * u[2]);
      }
      const sup = moved.support(dir);
      assert.ok(sup >= mx - 1e-9 && sup - mx < 0.6, `${moved.kind} support ${sup} vs scan ${mx}`);
    }
  }
  assert.throws(() => ts.cylinder({ axis: /** @type {any} */ ('w') }));
});

// ------------------------------------------------------------------------------------------------ contact

test('contact: pressOnto sinks a shape exactly `depth` into the pad; force = k_n * d when still', () => {
  const pad = ts.makePad(), touch = ts.createTouch({ pad });
  const k = pad.index(5, 15), a = pad.local[3 * k], b = pad.local[3 * k + 1];
  const tip = ts.pressOnto(ts.fingertip(), pad, { a, b, depth: 1.3 });
  touch.step([tip], 1 / 60);
  near(touch.depth[k], 1.3, 1e-5, 'depth under the centre');
  near(touch.dist[k], -1.3, 1e-5);
  near(touch.force[k], ts.DEFAULTS.kn * 1.3, 1e-5);
  assert.equal(touch.peak, k);
  assert.equal(touch.which[k], 0);
  vnear([...touch.center, 0], [a, b, 0], 1e-4, 'centre of pressure');
  vnear(touch.push, [0, 0, touch.total], 1e-4, 'flat pad pushes along +normal');
  let sum = 0; for (const f of touch.force) sum += f;
  near(touch.total, sum, 1e-4);
  assert.equal(touch.rate.every((r) => r === 0), true, 'first step reads no rate');
  touch.step([tip], 1 / 60);
  assert.equal(touch.rate.every((r) => r === 0), true, 'still object, no rate');
  for (let q = 0; q < pad.n; q++) near(touch.force[q], ts.DEFAULTS.kn * touch.depth[q], 1e-6);
  // a box face pressed flat: every taxel under the face reads the same depth
  const blk = ts.pressOnto(ts.box({ size: [10, 6, 20], round: 0 }), pad, { a, b, depth: 0.8 });
  touch.reset().step([blk], 1 / 60);
  const under = [...touch.depth].filter((d) => d > 0);
  assert.equal(under.length, 15, '5 drive x 3 sense lines lie under a 10 x 6 mm face');
  for (const d of under) near(d, 0.8, 1e-5);
  // a strawberry lying on its side, pressed 1 mm: the deepest taxel is close to 1 mm
  const sb = ts.pressOnto(ts.strawberry(), pad, { depth: 1, rot: ts.rotY(Math.PI / 2) });
  touch.reset().step([sb], 1 / 60);
  const deepest = Math.max(...touch.depth);
  assert.ok(deepest <= 1 + 1e-6 && deepest > 0.85, `strawberry deepest ${deepest}`);
});

test('contact: nothing near, or touched from behind, reads zero', () => {
  const pad = ts.makePad(), touch = ts.createTouch({ pad, reach: 10 });
  touch.step([ts.sphere({ radius: 8, pose: { pos: [0, 0, 50] } })], 0.01);
  assert.equal(touch.total, 0); assert.equal(touch.count, 0); assert.equal(touch.peak, -1); assert.equal(touch.center, null);
  assert.ok(touch.dist.every((d) => d === 10), 'far shapes read the reach');
  assert.ok(touch.which.every((w) => w === -1));
  touch.step([ts.sphere({ radius: 8, pose: { pos: [1, 1, -7] } })], 0.01);   // 1 mm into the pad from its back
  assert.equal(touch.total, 0, 'the back of the pad does not sense');
  assert.ok(Math.min(...touch.dist) < 0, 'but the distance field sees it');
  touch.step([], 0.01); assert.equal(touch.total, 0);
  touch.step([null, undefined], 0.01); assert.equal(touch.total, 0);
});

test('contact: Kelvin-Voigt rate term, clamp (never pulls), reset, maxRate', () => {
  const pad = ts.makePad(), touch = ts.createTouch({ pad }), dt = 0.01, v = 6;
  const plate = ts.box({ size: [30, 10, 10], round: 0, pose: { pos: [0, 0, 5.2] } });   // face 0.2 mm above the pad
  for (let s = 1; s <= 30; s++) {
    plate.setPose({ pos: [0, 0, 5.2 - v * dt * s] });
    touch.step([plate], dt);
    if (s >= 5) {   // contact from step 4 (0.24 mm > 0.2 mm); from step 5 the rate is the full v
      const k = pad.index(6, 16), d = v * dt * s - 0.2;
      near(touch.depth[k], d, 1e-5, `depth step ${s}`);
      near(touch.rate[k], v, 1e-3, `rate step ${s}`);
      near(touch.force[k], ts.DEFAULTS.kn * d + ts.DEFAULTS.kd * v, 1e-4, `force step ${s}`);
    }
  }
  // pull out fast: depth still > 0 but kn*d + kd*rate < 0 -> 0, never negative
  plate.setPose({ pos: [0, 0, 5.2 - 1.75] });   // from 1.6 mm deep to 1.55 mm... then a big jump out
  touch.step([plate], dt);
  plate.setPose({ pos: [0, 0, 5.2 - 0.25] });   // 0.05 mm deep, moved 1.5 mm in 10 ms (150 mm/s)
  touch.step([plate], dt);
  const k = pad.index(6, 16);
  near(touch.depth[k], 0.05, 1e-5);
  assert.ok(touch.rate[k] < -100);
  assert.equal(touch.force[k], 0, 'separating fast reads zero');
  assert.ok(touch.force.every((f) => f >= 0));
  // reset: the next step has no rate
  touch.reset().step([plate], dt);
  assert.ok(touch.rate.every((r) => r === 0));
  near(touch.force[k], ts.DEFAULTS.kn * 0.05, 1e-6);
  // maxRate caps |rate|
  const capped = ts.createTouch({ pad, maxRate: 20 });
  capped.step([plate], dt);
  plate.setPose({ pos: [0, 0, 5.2 - 1.25] });
  capped.step([plate], dt);
  near(capped.rate[k], 20, 0, 'capped');
  // setGains
  capped.setGains({ kd: 0 }).step([plate], dt);
  near(capped.force[k], ts.DEFAULTS.kn * 1.05, 1e-5);
  // the bare-array helper gives the same numbers
  const out = { rate: new Float32Array(pad.n), force: new Float32Array(pad.n) };
  const prev = Float32Array.from(touch.depth);
  plate.setPose({ pos: [0, 0, 5.2 - 0.6] });
  touch.step([plate], dt);
  const tot = ts.kelvinVoigt(touch.depth, prev, dt, ts.DEFAULTS, out);
  for (let q = 0; q < pad.n; q++) near(out.force[q], touch.force[q], 1e-4);
  near(tot, touch.total, 1e-3);
  assert.equal(ts.kelvinVoigt([1, 0], null, dt, { kn: 2, kd: 1 }, { rate: [0, 0], force: [0, 0] }), 2);
});

test('contact: several shapes - union by nearest, per-shape force, null slots keep their index', () => {
  const pad = ts.makePad(), touch = ts.createTouch({ pad });
  const s1 = ts.pressOnto(ts.sphere({ radius: 6 }), pad, { a: -20, b: 0, depth: 1 });
  const s2 = ts.pressOnto(ts.box({ size: [8, 8, 8], round: 1 }), pad, { a: 20, b: 2, depth: 0.7 });
  touch.step([s1, null, s2], 0.01);
  assert.equal(touch.shapeForce.length, 3);
  assert.ok(touch.shapeForce[0] > 0 && touch.shapeForce[2] > 0);
  assert.equal(touch.shapeForce[1], 0);
  near(touch.shapeForce[0] + touch.shapeForce[2], touch.total, 1e-4);
  for (let k = 0; k < pad.n; k++) if (touch.depth[k] > 0) assert.equal(touch.which[k], pad.local[3 * k] < 0 ? 0 : 2);
  s2.enabled = false;
  touch.reset().step([s1, null, s2], 0.01);
  near(touch.total, touch.shapeForce[0], 1e-5); assert.equal(touch.shapeForce[2], 0);
  // overlapping shapes: a taxel inside both reads the deeper one
  const big = ts.pressOnto(ts.sphere({ radius: 10 }), pad, { a: -20, b: 0, depth: 1.5 });
  touch.reset().step([s1, big], 0.01);
  const k = pad.index(5, 6);
  const alone = ts.createTouch({ pad }).step([big], 0.01);
  near(touch.depth[k], alone.depth[k], 1e-6);
});

// ------------------------------------------------------------------------------------------------ readout

test('readout: normalizeFrame is bit-for-bit the host viewer rule (host.mjs processFrame)', () => {
  const R = rng(3);
  for (let f = 0; f < 40; f++) {
    const raw = Uint8Array.from({ length: 384 }, () => 10 + Math.floor(R() * 30));
    const base = Float32Array.from({ length: 384 }, () => 10 + Math.floor(R() * 30) + (R() < 0.5 ? 0.5 : 0));
    if (f % 3) for (let q = 0; q < 12; q++) raw[Math.floor(R() * 384)] = Math.min(255, 40 + Math.floor(R() * 200));
    const out = new Float32Array(384);
    const st = ts.normalizeFrame(raw, out, { baseline: base });
    const ref = processFrame(raw, base);
    assert.ok(sameBits(out, ref), `frame ${f}`);
    assert.equal(st.lit, [...ref].filter((v) => v > 0).length);
    const out01 = new Float32Array(384);
    ts.normalizeFrame(raw, out01, { baseline: base, threshold: 25, noiseScale: 30, clip01: true });
    assert.ok(sameBits(out01, processFrame(raw, base, { threshold: 25, noiseScale: 30, clip01: true })), `pyflexitac ${f}`);
  }
  // float input, no baseline == processFrame with a zero baseline; a quiet frame divides by the noise scale
  const counts = Float32Array.from({ length: 384 }, (_, k) => (k === 7 ? 25 : 3));
  const o = new Float32Array(384), st = ts.normalizeFrame(counts, o);
  assert.ok(sameBits(o, processFrame(counts, new Float32Array(384))));
  assert.equal(st.quiet, true); near(o[7], (25 - 15) / 60, 1e-7);
});

test('readout: a firm fingertip press lights about a dozen taxels (Fig 1 feel model); light < firm < hard', () => {
  const pad = ts.makePad(), touch = ts.createTouch({ pad }), sim = ts.createReadout(), tip = ts.fingertip();
  const press = (a, b, depth) => { ts.pressOnto(tip, pad, { a, b, depth }); touch.reset().step([tip], 1 / 60); return sim.read(touch.force); };
  const stats = {};
  for (const [name, depth] of [['light', ts.PRESETS.lightDepth], ['firm', ts.PRESETS.firmDepth], ['hard', ts.PRESETS.hardDepth]]) {
    let sum = 0, lo = Infinity, hi = 0, tot = 0, n = 0, sat = 0;
    for (let a = -10; a < -8; a += 0.25) for (let b = -1; b < 1; b += 0.25) {
      const r = press(a, b, depth);
      sum += r.lit; lo = Math.min(lo, r.lit); hi = Math.max(hi, r.lit); tot += touch.total; n++; if (r.max >= ts.READOUT.clipMax) sat++;
      // lit == force above the threshold in newtons; the brightest taxel reads 1
      assert.equal(r.lit, [...touch.force].filter((f) => f * ts.READOUT.countsPerN > ts.READOUT.threshold).length);
      near(Math.max(...r.norm), 1, 1e-6);
    }
    stats[name] = { mean: sum / n, lo, hi, total: tot / n, sat };
  }
  const { light, firm, hard } = stats;
  assert.ok(firm.mean >= 11 && firm.mean <= 13, `firm mean ${firm.mean}`);
  assert.ok(firm.lo >= 9 && firm.hi <= 14, `firm range ${firm.lo}-${firm.hi}`);
  assert.ok(firm.total > 4 && firm.total < 7, `firm total ${firm.total} N`);
  assert.ok(light.mean < firm.mean && firm.mean < hard.mean);
  assert.ok(hard.total < 10.5, `hard total ${hard.total} N stays in FlexiTac's 0.2-10 N range`);
  assert.equal(firm.sat, 0); assert.ok(hard.sat > 0, 'a hard press reaches the viewer clip');
  assert.equal(sim.raw, null); assert.equal(sim.baseline, null);
  near(sim.thresholdN, 0.12, 1e-12);
  // the threshold in depth terms: a flat press shallower than 0.2 mm stays dark (quiet frame)
  const plate = ts.pressOnto(ts.box({ size: [20, 20, 5], round: 0 }), pad, { depth: 0.19 });
  touch.reset().step([plate], 0.01);
  const q = sim.read(touch.force);
  assert.equal(q.lit, 0); assert.equal(q.quiet, true);
});

test('readout: real style = bytes + noise + rest + median baseline, same rule; deterministic', () => {
  const pad = ts.makePad(), touch = ts.createTouch({ pad }), tip = ts.fingertip();
  const real = ts.createReadout({ style: 'real' }), again = ts.createReadout({ style: 'real' }), other = ts.createReadout({ style: 'real', seed: 2 });
  const sim = ts.createReadout();
  assert.ok(real.rest.every((r) => r >= 12 && r <= 24));
  for (let k = 0; k < 384; k++) assert.ok(Math.abs(real.baseline[k] - real.rest[k]) <= 1.5, `baseline ${k}`);
  // at rest: noise (1 count) never crosses the 15-count threshold
  const zero = new Float32Array(384);
  for (let f = 0; f < 20; f++) { const r = real.read(zero); assert.equal(r.lit, 0); assert.equal(r.quiet, true); }
  real.reset(); assert.equal(real.frame, 0);
  ts.pressOnto(tip, pad, { a: 3, b: 1, depth: ts.PRESETS.firmDepth });
  touch.step([tip], 1 / 60);
  for (let f = 0; f < 10; f++) {
    real.read(touch.force); again.read(touch.force); other.read(touch.force); sim.read(touch.force);
    assert.ok(sameBits(real.raw, again.raw) && sameBits(real.norm, again.norm), 'same seed, same frames');
    assert.ok(sameBits(real.norm, processFrame(real.raw, real.baseline)), 'real style == host viewer on its bytes');
    assert.ok(Math.abs(real.lit - sim.lit) <= 2, `lit real ${real.lit} vs sim ${sim.lit}`);
    let dot = 0, na = 0, nb = 0;
    for (let k = 0; k < 384; k++) { dot += real.norm[k] * sim.norm[k]; na += real.norm[k] ** 2; nb += sim.norm[k] ** 2; }
    assert.ok(dot / Math.sqrt(na * nb) > 0.98, 'same picture');
    for (let k = 0; k < 384; k++) {
      const want = Math.min(255, Math.max(0, Math.round(real.rest[k] + touch.force[k] * 125)));
      assert.ok(Math.abs(real.raw[k] - want) <= 4, `raw ${k}`);
      near(real.counts[k], real.raw[k] - real.baseline[k], 1e-6);
    }
  }
  assert.ok(!sameBits(real.raw, other.raw), 'a different seed gives different noise');
  // louder noise shows at rest, but dimly: a quiet frame is divided by the fixed noise scale
  const noisy = ts.createReadout({ style: 'real', noise: 6 });
  let litAny = 0, brightest = 0;
  for (let f = 0; f < 10; f++) { const r = noisy.read(zero); litAny += r.lit; brightest = Math.max(brightest, ...r.norm); assert.equal(r.quiet, true); }
  assert.ok(litAny > 0 && brightest < 0.2, `noise lit ${litAny}, brightest ${brightest}`);
  // a custom response curve (e.g. a saturating one) is used for the bytes
  const sat = ts.createReadout({ style: 'real', response: (f) => 200 * Math.tanh(f / 0.8) });
  sat.read(touch.force);
  assert.ok(sat.raw.some((b) => b > 100));
  // noiseAt: deterministic, mean ~0, sd ~1, bounded
  let m = 0, v = 0; const N = 20000;
  for (let k = 0; k < N; k++) { const z = ts.noiseAt(5, 1, k); m += z; v += z * z; assert.ok(Math.abs(z) <= 3.4642); }
  near(m / N, 0, 0.03); near(Math.sqrt(v / N - (m / N) ** 2), 1, 0.03);
  assert.equal(ts.noiseAt(5, 1, 9), ts.noiseAt(5, 1, 9));
});

// ------------------------------------------------------------------------------------------------ curves and fit

test('responseCurve: a press in and out; the damper opens a loop', () => {
  const c = ts.responseCurve({ kn: 0.6, kd: 0.012, depthMax: 1.3, duration: 0.3, samples: 121 });
  assert.equal(c.t.length, 121); near(c.t[120], 0.3, 1e-12); near(c.depth[60], 1.3, 1e-12);
  assert.equal(c.depth[0], 0); near(c.depth[120], 0, 1e-12); assert.equal(c.rate[0], 0);
  const v = 1.3 / 0.15;
  for (let m = 1; m < 121; m++) near(Math.abs(c.rate[m]), v, 1e-9);
  for (let m = 1; m < 60; m++) {   // same depth, way in vs way out: 2 * kd * v apart (unless clamped)
    const inF = c.force[m], outF = c.force[120 - m];
    near(inF, 0.6 * c.depth[m] + 0.012 * v, 1e-12);
    if (outF > 0) near(inF - outF, 2 * 0.012 * v, 1e-9);
    assert.ok(inF > outF);
  }
  assert.equal(c.force[120], 0); assert.ok(c.force.every((f) => f >= 0));
  assert.equal(c.loading[10], 1); assert.equal(c.loading[110], 0);
  near(c.counts[60], c.force[60] * 125, 1e-9);
  const flat = ts.responseCurve({ kd: 0 });
  for (let m = 1; m < 60; m++) near(flat.force[m], flat.force[120 - m], 1e-12, 'no damper, no loop');
  const sine = ts.responseCurve({ profile: 'sine' });
  near(sine.depth[60], ts.PRESETS.firmDepth, 1e-12);
  const mf = ts.modelForce(c, 0.6, 0.012);
  for (let m = 0; m < 121; m++) near(mf[m], c.force[m], 1e-12);
});

test('responseCurve matches the engine: a flat probe on one taxel, stepped at the same dt', () => {
  const pad = ts.makePad(), touch = ts.createTouch({ pad }), c = ts.responseCurve();
  const probe = ts.box({ size: [3, 3, 10], round: 0 });   // covers one taxel only (neighbours are 2 mm away)
  const k = pad.index(4, 9), a = pad.local[3 * k], b = pad.local[3 * k + 1], dt = c.t[1];
  for (let m = 0; m < c.t.length; m++) {
    probe.setPose({ pos: [a, b, 5 - c.depth[m]] });
    touch.step([probe], m ? dt : 0);
    near(touch.force[k], c.force[m], 1e-5, `sample ${m}`);
    assert.equal(touch.count, c.depth[m] > 0 ? 1 : 0);
  }
});

test('fitKnKd: recovers the gains of a model curve; fits the illustrative curve to DEFAULTS', () => {
  for (const [kn, kd, profile] of [[0.6, 0.012, 'triangle'], [0.25, 0.04, 'triangle'], [1.1, 0, 'sine'], [0.8, 0.003, 'sine']]) {
    const fit = ts.fitKnKd(ts.responseCurve({ kn, kd, profile }));
    near(fit.kn, kn, 1e-9 * kn, 'kn'); near(fit.kd, kd, 1e-9, 'kd'); assert.ok(fit.rmse < 1e-9);
  }
  const target = ts.illustrativeCurve();
  assert.equal(target.illustrative, true); assert.match(target.label, /illustrative/i);
  assert.ok(Number.isNaN(target.kn), 'the hidden gains are not exposed');
  const fit = ts.fitKnKd(target);
  near(fit.kn, ts.DEFAULTS.kn, 0.01 * ts.DEFAULTS.kn, 'kn ~ DEFAULTS');
  near(fit.kd, ts.DEFAULTS.kd, 0.02 * ts.DEFAULTS.kd, 'kd ~ DEFAULTS');
  assert.ok(fit.rmse > 0.001 && fit.rmse < 0.01, `close but not perfect: rmse ${fit.rmse} N`);
  // the curves of the fitted gains sit close to the target; the paper's numbers read in mm do not
  near(ts.curveRmse(ts.responseCurve(ts.DEFAULTS).force, target.force), 0, 0.012);
  assert.ok(ts.curveRmse(ts.responseCurve({ kn: 1.0, kd: 0.003 }).force, target.force) > 0.2);
  assert.deepEqual(ts.illustrativeCurve().force, target.force, 'deterministic');
  // never negative gains
  const neg = ts.fitKnKd({ depth: [0, 1, 2, 1, 0], rate: [0, 10, 10, -10, -10], force: [0, 0.5, 1.0, 0.6, 0.1] });
  assert.ok(neg.kn >= 0 && neg.kd >= 0);
});

// ------------------------------------------------------------------------------------------------ helpers

test('helpers: toUnit and pointCloud', () => {
  near(ts.toUnit([0, 2, 4])[2], 1, 0); near(ts.toUnit([0, 2, 4])[1], 0.5, 0);
  near(ts.toUnit([0, 2, 4], 2)[2], 1, 0); assert.equal(ts.toUnit([-1, 0], 1)[0], 0);
  assert.ok(ts.toUnit([0, 0]).every((v) => v === 0));
  const pad = ts.makePad({ frame: { origin: [1, 2, 3] } }), vals = Float32Array.from({ length: 384 }, (_, k) => k / 384);
  const pc = ts.pointCloud(pad, vals);
  assert.equal(pc.length, 4 * 384);
  for (const k of [0, 100, 383]) { vnear([pc[4 * k], pc[4 * k + 1], pc[4 * k + 2]], pad.point(k), 0); near(pc[4 * k + 3], vals[k], 0); }
  // rotation helpers
  vnear(ts.transformPoint({ rot: ts.rotFromTo([0, 0, 1], [1, 0, 0]) }, [0, 0, 1]), [1, 0, 0], 1e-12);
  vnear(ts.transformPoint({ rot: ts.rotFromTo([0, 0, 1], [0, 0, -1]) }, [0, 0, 1]), [0, 0, -1], 1e-12);
  vnear(ts.transformPoint({ rot: ts.rotAxis([0, 0, 1], Math.PI / 2) }, [1, 0, 0]), [0, 1, 0], 1e-12);
  vnear(ts.transformPoint({ rot: ts.rotFromAxes([0, 1, 0], [-1, 0, 0], [0, 0, 1]) }, [1, 0, 0]), [0, 1, 0], 0);
});

// ------------------------------------------------------------------------------------------------ determinism + speed

/** A scripted gripper scene: two bending pads close on three objects; both readout styles. */
function scene(steps, { hashing = true } = {}) {
  const { left, right } = ts.padPair({ center: [0, 0, 0], gap: 40 });
  const shapes = [
    ts.strawberry({ pose: { pos: [0, 0, -10], rot: ts.rotX(0.2) } }),
    ts.box({ size: [24, 24, 24], round: 2, pose: { pos: [0, 20, -25] } }),
    ts.cylinder({ radius: 12, length: 50, axis: 'y', pose: { pos: [0, -18, -30] } }),
  ];
  const tl = ts.createTouch({ pad: left }), tr = ts.createTouch({ pad: right });
  const rl = ts.createReadout({ style: 'real' }), rs = ts.createReadout();
  const dt = 1 / 60;
  let hash = 2166136261;
  const eat = (arr) => { const b = new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength); for (let q = 0; q < b.length; q++) hash = Math.imul(hash ^ b[q], 16777619) >>> 0; };
  for (let s = 0; s < steps; s++) {
    const g = 40 - 18 * (1 - Math.cos((s / steps) * Math.PI)) / 2;   // close from 40 to 22 mm
    left.setFrame({ origin: [-g / 2, 0, 0], u: [0, 0, -1], normal: [1, 0, 0] });
    right.setFrame({ origin: [g / 2, 0, 0], u: [0, 0, -1], normal: [-1, 0, 0] });
    const bend = 0.008 * (1 - Math.cos(s / 20)) / 2;   // the fin face wraps a little, on and off
    left.setBend(bend); right.setBend(bend);
    shapes[0].setPose({ pos: [0, 4 * Math.sin(s / 30), -10], rot: ts.rotX(0.2) });
    tl.step(shapes, dt); tr.step(shapes, dt);
    rl.read(tl.force); rs.read(tr.force);
    if (hashing) { eat(tl.force); eat(tr.depth); eat(rl.raw); eat(rl.norm); eat(rs.norm); eat(left.points); }
  }
  return { hash, tl, tr };
}

test('determinism: the same scripted scene gives the same bytes', () => {
  const a = scene(120), b = scene(120);
  assert.equal(a.hash, b.hash);
  assert.ok(a.tl.total > 0 && a.tr.total > 0, 'the scene makes contact');
});

test('speed: 2 pads x 384 taxels x 3 shapes (+ bend + both readouts) is far inside a 60 fps frame', (t) => {
  scene(60, { hashing: false });   // warm up
  const steps = 600, t0 = performance.now();
  const { tl, tr } = scene(steps, { hashing: false });
  const ms = (performance.now() - t0) / steps;
  t.diagnostic(`${ms.toFixed(4)} ms per step for both pads (budget 16.7 ms at 60 fps); contacts ${tl.count} + ${tr.count}`);
  assert.ok(ms < 2, `${ms} ms per step`);
});
