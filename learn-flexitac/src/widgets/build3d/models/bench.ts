// @ts-nocheck
// The breadboard, the FSR, the resistor, a wire end, the USB plug.
// Copied from flexitac-anatomy/figures/bench/topdown/topdown-real/parts.js (BB, colX, rowY from bench/bench-real/bench.js) (the renders of lessons 2.1 and 2.2), so the live 3D bench of lesson 2.2
// (../scene.ts) draws the same shapes and materials. Keep the two in step; only the imports differ.
// Lesson 2.2's workbench seen from straight above (learn-flexitac src/widgets/build): the parts one at a time, each
// in its own plan frame, so the site can drag them anywhere on the breadboard. The shapes, sizes and materials are
// Lesson 2.1's (../../bench-real/bench.js, the Nano from ../../../board/pbr/board-real/nano.js), laid out for the
// top view of the shared contract: columns 1-30 left to right, rows a-j top to bottom, the plus rails inside, the minus
// rails outside.
//
// Frame (mm, right-handed): x right, y UP the picture, z up from the breadboard's top face. Picture coordinates use
// Y = -y (down). The breadboard's top-left corner is at x = 0, Y = 0. A part is built with its first pin at the origin.
import * as THREE from 'three';
import {pinGeo, rbox, box, ribbonGeo} from './kit';
import {heightToNormal} from './height';
import {BB, colX, rowY} from './board-dims';

export {BB, colX, rowY};
export const ROWS = 'abcdefghij';
// 2.1's centre channel (Y from the top edge: the board is symmetric, so 2.1's numbers from its front edge hold)
export const CH = {y0: 26.0, y1: 28.6, depth: 1.8};

/** The breadboard's holes for a picture at `pitchPx` px per 2.54 mm. Columns and rows are 2.1's; the rails sit where
 *  2.1's do (6.89 mm out from row a / row j), snapped to whole pixels so every hole of the picture lands on one. */
export function layout(pitchPx) {
  const S = pitchPx / BB.P;
  const gap = Math.round((rowY('a') - 6.44) * S) / S;
  const TP = rowY('a') - gap;
  const TN = TP - BB.P;
  const BP = rowY('j') + gap;
  const BN = BP + BB.P;
  // 25 holes in five groups of five, a gap of one pitch between groups, half a pitch off the columns (2.1's railX)
  const railX = (i) => colX(1) + BB.P / 2 + (Math.floor(i / 5) * 6 + (i % 5)) * BB.P;
  const holes = {};
  for (let k = 1; k <= 30; k++) for (const r of ROWS) holes[`${k}${r}`] = [colX(k), rowY(r)];
  for (const [id, y] of [['TN', TN], ['TP', TP], ['BP', BP], ['BN', BN]]) for (let i = 0; i < 25; i++) holes[`${id}${i + 1}`] = [railX(i), y];
  return {S, rails: {TN, TP, BP, BN}, holes};
}

const P3 = (x, Y, z) => new THREE.Vector3(x, -Y, z);
const tex = (canvas, srgb, renderer) => {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = renderer ? renderer.capabilities.getMaxAnisotropy() : 8;
  return t;
};

// ------------------------------------------------------------------------------------------------ the breadboard
/** The top print and the holes (2.1's look: square funnels round dark wells, the rail lines, grey numbers and
 *  letters), drawn for the top view: canvas row 0 = the top edge (Y = 0). */
function boardMaps(L, PX) {
  const W = Math.round(BB.W * PX);
  const H = Math.round(BB.D * PX);
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  const X = (x) => x * PX;
  const Y = (y) => y * PX;
  g.fillStyle = '#e9e8e3';
  g.fillRect(0, 0, W, H);
  const {TN, TP, BP, BN} = L.rails;
  // the rails' printed lines: blue outside the minus rows, red inside the plus rows (2.1's offsets)
  const line = (y, col) => {
    g.fillStyle = col;
    g.fillRect(X(3.2), Y(y - 0.28), X(BB.W - 6.4), 0.56 * PX);
  };
  const BLUE = '#3a62a8';
  const RED = '#b93a31';
  line(TN - 1.95, BLUE);
  line(TP + 2.11, RED);
  line(BP - 2.11, RED);
  line(BN + 1.95, BLUE);
  const text = (t, x, y, size, col, weight = 600) => {
    g.fillStyle = col;
    g.font = `${weight} ${size * PX}px Inter, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(t, X(x), Y(y) + size * PX * 0.06);
  };
  for (const [y, s] of [[TN, '−'], [TP, '+'], [BP, '+'], [BN, '−']]) {
    for (const x of [2.3, BB.W - 2.3]) text(s, x, y, 1.9, s === '+' ? RED : BLUE, 700);
  }
  const INK = '#878681'; // (2.1's #9a9994 a little darker: the lesson reads hole names off the board)
  for (const k of [1, 5, 10, 15, 20, 25, 30]) {
    text(String(k), colX(k), rowY('a') - 2.38, 1.25, INK);
    text(String(k), colX(k), rowY('j') + 2.41, 1.25, INK);
  }
  for (const r of ROWS) {
    text(r, 2.1, rowY(r), 1.25, INK);
    text(r, BB.W - 2.1, rowY(r), 1.25, INK);
  }
  // holes: a square funnel (a little darker, sloped in the normal map) round a dark square well
  const hgt = new Float32Array(W * H);
  const R0 = 0.86;
  const R1 = 0.5;
  for (const [x, y] of Object.values(L.holes)) {
    g.fillStyle = '#d6d5cf';
    g.fillRect(X(x - R0), Y(y - R0), 2 * R0 * PX, 2 * R0 * PX);
    g.fillStyle = '#232325';
    g.fillRect(X(x - R1), Y(y - R1), 2 * R1 * PX, 2 * R1 * PX);
    g.fillStyle = '#3d3d3f';
    g.fillRect(X(x - 0.12), Y(y - 0.36), 0.24 * PX, 0.72 * PX); // the spring contact's edge, deep inside
    for (let py = Math.floor(Y(y - R0)); py <= Math.ceil(Y(y + R0)); py++) {
      for (let px = Math.floor(X(x - R0)); px <= Math.ceil(X(x + R0)); px++) {
        if (px < 0 || py < 0 || px >= W || py >= H) continue;
        const mx = (px + 0.5) / PX - x;
        const my = (py + 0.5) / PX - y;
        const d = Math.max(Math.abs(mx), Math.abs(my));
        if (d > R0) continue;
        hgt[py * W + px] = d < R1 ? -900 : (-620 * (R0 - d)) / (R0 - R1);
      }
    }
  }
  const nc = document.createElement('canvas');
  nc.width = W;
  nc.height = H;
  nc.getContext('2d').putImageData(new ImageData(heightToNormal(hgt, W, H, PX, 1), W, H), 0, 0);
  return {color: c, normal: nc};
}

/** The breadboard (2.1's: two blocks either side of the centre channel, its floor, a printed skin on each block), its
 *  top face at z = 0. */
export function buildBreadboard(group, renderer, L, PX = 48) {
  const maps = boardMaps(L, PX);
  const body = new THREE.MeshPhysicalMaterial({color: '#e9e8e3', roughness: 0.58, metalness: 0, specularIntensity: 0.5});
  const R = 0.7;
  const add = (geo, mat, x, Y, z) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.copy(P3(x, Y, z));
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
    return m;
  };
  add(rbox(BB.W, CH.y0, BB.H, R, 3), body, BB.W / 2, CH.y0 / 2, -BB.H / 2);
  add(rbox(BB.W, BB.D - CH.y1, BB.H, R, 3), body, BB.W / 2, (CH.y1 + BB.D) / 2, -BB.H / 2);
  add(box(BB.W - 0.4, CH.y1 - CH.y0 + 2 * R, BB.H - CH.depth), body, BB.W / 2, (CH.y0 + CH.y1) / 2, -BB.H + (BB.H - CH.depth) / 2);
  const colour = tex(maps.color, true, renderer);
  const normal = tex(maps.normal, false, renderer);
  // a skin over plan rows Y0..Y1 (texture v = 1 at Y = 0)
  const skin = (Y0, Y1) => {
    const x0 = R;
    const x1 = BB.W - R;
    const sub = (t) => {
      const s = t.clone();
      s.offset.set(x0 / BB.W, 1 - Y1 / BB.D);
      s.repeat.set((x1 - x0) / BB.W, (Y1 - Y0) / BB.D);
      s.needsUpdate = true;
      return s;
    };
    const mat = new THREE.MeshPhysicalMaterial({map: sub(colour), normalMap: sub(normal), roughness: 0.56, metalness: 0, specularIntensity: 0.5, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2});
    const m = add(new THREE.PlaneGeometry(x1 - x0, Y1 - Y0), mat, (x0 + x1) / 2, (Y0 + Y1) / 2, 0.002);
    m.castShadow = false;
  };
  skin(R, CH.y0 - R);
  skin(CH.y1 + R, BB.D - R);
}

// ------------------------------------------------------------------------------------------------ the FSR
/** 2.1's FSR 402 (a head about 18 mm across, a black sensing area, a 5.4 mm tail with two silver traces, two crimp
 *  contacts with pins 2.54 mm apart), turned for the top view: rot 0 has its pins on the x axis (pin "1" at x = 0,
 *  pin "2" at x = 2.54), the tail rising out of the crimps, arching over and lying down on the board toward the
 *  bottom of the picture, the head flat at its end. */
export const FSR = (() => {
  const R = 9.15;
  const rActive = 7.0;
  // (y, z): up out of the crimps, over toward the bottom of the picture, down onto the board's top (2.1's arch,
  // lower: it only clears the crimps here, then lies on the board instead of dropping off its front edge)
  const keys = [[0, 0.12], [0, 4.9], [-0.4, 6.4], [-1.7, 7.4], [-3.7, 7.65], [-6.1, 6.95], [-8.4, 5.4], [-10.4, 3.6], [-12.2, 1.9], [-13.8, 0.75], [-15.6, 0.3], [-18.0, 0.24], [-22.6, 0.24]];
  const yEdge = -22.0;
  const cy = yEdge - R + 0.9;
  return {x1: 0, x2: BB.P, cx: BB.P / 2, R, rActive, keys, cy, cz: 0.21, w: 5.4, t: 0.2};
})();

export function buildFSR(group, M) {
  const film = '#ad9f80';
  const hc = document.createElement('canvas');
  hc.width = hc.height = 1024;
  {
    const g = hc.getContext('2d');
    g.fillStyle = film;
    g.fillRect(0, 0, 1024, 1024);
    const r = (FSR.rActive / FSR.R) * 512;
    g.strokeStyle = '#a69878';
    g.lineWidth = 12;
    g.beginPath();
    g.arc(512, 512, r + 18, 0, Math.PI * 2);
    g.stroke();
    const grd = g.createRadialGradient(472, 472, r * 0.1, 512, 512, r);
    grd.addColorStop(0, '#1d1d1f');
    grd.addColorStop(1, '#141415');
    g.fillStyle = grd;
    g.beginPath();
    g.arc(512, 512, r, 0, Math.PI * 2);
    g.fill();
  }
  const headTex = new THREE.CanvasTexture(hc);
  headTex.colorSpace = THREE.SRGBColorSpace;
  headTex.anisotropy = 8;
  // (2.1's film, with less clearcoat: from straight above the key light's highlight sits on the flat head and greys
  // the black sensing area that 2.1 shows near black)
  const headTop = new THREE.MeshPhysicalMaterial({map: headTex, roughness: 0.5, metalness: 0, clearcoat: 0.18, clearcoatRoughness: 0.4, specularIntensity: 0.45});
  const headSide = new THREE.MeshPhysicalMaterial({color: '#9c8f72', roughness: 0.5});
  const disc = new THREE.CylinderGeometry(FSR.R, FSR.R, 0.42, 128);
  disc.rotateX(Math.PI / 2);
  const head = new THREE.Mesh(disc, [headSide, headTop, headSide]);
  head.position.set(FSR.cx, FSR.cy, FSR.cz);
  head.castShadow = true;
  head.receiveShadow = true;
  group.add(head);
  const path = new THREE.CatmullRomCurve3(FSR.keys.map(([y, z]) => new THREE.Vector3(0, y, z)), false, 'centripetal').getSpacedPoints(160).map((p) => [p.y, p.z]);
  const tc = document.createElement('canvas');
  tc.width = 256;
  tc.height = 8;
  {
    const g = tc.getContext('2d');
    g.fillStyle = film;
    g.fillRect(0, 0, 256, 8);
    g.fillStyle = '#a7aaab';
    const half = (BB.P / 2 / FSR.w) * 256;
    const tw = (0.75 / FSR.w) * 256;
    for (const s of [-1, 1]) g.fillRect(128 + s * half - tw / 2, 0, tw, 8);
  }
  const tailTex = new THREE.CanvasTexture(tc);
  tailTex.colorSpace = THREE.SRGBColorSpace;
  tailTex.wrapT = THREE.RepeatWrapping;
  tailTex.repeat.set(1, 1 / 8);
  const tailMat = new THREE.MeshPhysicalMaterial({map: tailTex, roughness: 0.4, metalness: 0, clearcoat: 0.5, clearcoatRoughness: 0.3, specularIntensity: 0.6, side: THREE.DoubleSide});
  const tail = new THREE.Mesh(ribbonGeo(path, FSR.w, FSR.t), tailMat);
  tail.position.x = FSR.cx;
  tail.castShadow = true;
  tail.receiveShadow = true;
  group.add(tail);
  const pin = pinGeo(-5.5, 0.6);
  for (const x of [FSR.x1, FSR.x2]) {
    const m = new THREE.Mesh(rbox(1.95, 1.5, 5.2, 0.18), M.tin);
    m.position.set(x, 0, 0.45 + 2.6);
    m.castShadow = m.receiveShadow = true;
    group.add(m);
    const p = new THREE.Mesh(pin, M.tin);
    p.position.set(x, 0, 0);
    group.add(p);
  }
  return {pins: [[FSR.x1, 0], [FSR.x2, 0]], press: [FSR.cx, FSR.cy, FSR.cz + 0.21], R: FSR.R, rActive: FSR.rActive};
}

// ------------------------------------------------------------------------------------------------ the resistor
/** 2.1's 1/4 W carbon-film resistor (6.3 mm dog-bone body, brown-black-orange-gold), its legs bent down to a 4-pitch
 *  span: rot 0 lies along x, leg "1" (the brown end) at x = 0, leg "2" at x = 4 pitches. */
export function buildResistor(group, M) {
  const L = 6.3;
  const span = 4 * BB.P;
  const zc = 0.9 + 1.18; // the body's axis above the board (2.1's)
  const N = 64;
  const prof = [];
  for (let i = 0; i <= N; i++) {
    const s = -L / 2 + (L * i) / N;
    const e = L / 2 - Math.abs(s);
    const cap = Math.abs(s) > L / 2 - 1.55 ? 1 : Math.max(0, 1 - (L / 2 - 1.55 - Math.abs(s)) / 0.45);
    let r = 1.0 + 0.18 * cap;
    if (e < 0.35) r *= Math.sqrt(Math.max(0, 1 - Math.pow((0.35 - e) / 0.35, 2)));
    prof.push(new THREE.Vector2(Math.max(0.001, r), s));
  }
  const bodyGeo = new THREE.LatheGeometry(prof, 48);
  const bc = document.createElement('canvas');
  bc.width = 4;
  bc.height = 512;
  {
    const g = bc.getContext('2d');
    g.fillStyle = '#d3bd94';
    g.fillRect(0, 0, 4, 512);
    const band = (s0, s1, col) => {
      g.fillStyle = col;
      const v0 = (s0 + L / 2) / L;
      const v1 = (s1 + L / 2) / L;
      g.fillRect(0, (1 - v1) * 512, 4, (v1 - v0) * 512);
    };
    band(-2.55, -2.02, '#6b3c1f');
    band(-1.42, -0.92, '#19191a');
    band(-0.32, 0.18, '#d4691d');
    band(1.72, 2.25, '#b58d3e');
  }
  const bt = new THREE.CanvasTexture(bc);
  bt.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshPhysicalMaterial({map: bt, roughness: 0.42, metalness: 0, clearcoat: 0.35, clearcoatRoughness: 0.35, specularIntensity: 0.55});
  const m = new THREE.Mesh(bodyGeo, mat);
  // the lathe's axis (local y, the first band at -y) along +x
  m.rotation.z = -Math.PI / 2;
  m.position.set(span / 2, 0, zc);
  m.castShadow = m.receiveShadow = true;
  group.add(m);
  for (const s of [-1, 1]) {
    const xEnd = span / 2 + (s * L) / 2;
    const xHole = s < 0 ? 0 : span;
    const rb = 0.6;
    const path = new THREE.CurvePath();
    path.add(new THREE.LineCurve3(new THREE.Vector3(xEnd - s * 0.3, 0, zc), new THREE.Vector3(xHole - s * rb, 0, zc)));
    path.add(new THREE.QuadraticBezierCurve3(new THREE.Vector3(xHole - s * rb, 0, zc), new THREE.Vector3(xHole, 0, zc), new THREE.Vector3(xHole, 0, zc - rb)));
    path.add(new THREE.LineCurve3(new THREE.Vector3(xHole, 0, zc - rb), new THREE.Vector3(xHole, 0, -3)));
    const leg = new THREE.Mesh(new THREE.TubeGeometry(path, 64, 0.3, 12, false), M.tin);
    leg.castShadow = leg.receiveShadow = true;
    group.add(leg);
  }
  return {pins: [[0, 0], [span, 0]]};
}

// ------------------------------------------------------------------------------------------------ a jumper wire's end
/** A Dupont male jumper's end standing in a hole: the black housing (2.54 mm square, 14 mm tall: a typical one) on
 *  the board, its tinned pin down the hole, the wire's mouth on top (the site draws the wire itself from here). */
export const END = {s: 2.5, h: 14.0};
export function buildEnd(group, M) {
  const housing = new THREE.MeshPhysicalMaterial({color: '#121214', roughness: 0.42, metalness: 0, clearcoat: 0.25, clearcoatRoughness: 0.4, specularIntensity: 0.7});
  const m = new THREE.Mesh(rbox(END.s, END.s, END.h, 0.28, 3), housing);
  m.position.set(0, 0, END.h / 2);
  m.castShadow = m.receiveShadow = true;
  group.add(m);
  // the mouth on top: the crimp's barrel and the wire's insulation inside a small square opening
  const mouth = new THREE.Mesh(box(1.5, 1.5, 0.05), M.dark);
  mouth.position.set(0, 0, END.h + 0.001);
  group.add(mouth);
  const barrel = new THREE.CylinderGeometry(0.62, 0.62, 0.6, 24);
  barrel.rotateX(Math.PI / 2);
  const b = new THREE.Mesh(barrel, M.tin);
  b.position.set(0, 0, END.h - 0.35);
  group.add(b);
  const pin = new THREE.Mesh(pinGeo(-6.0, 0.2), M.tin);
  group.add(pin);
  return {pins: [[0, 0]]};
}

// ------------------------------------------------------------------------------------------------ the USB cable
/** A mini-B plug plugged into the Nano's port and a run of round black cable leaving to the left. The origin is the
 *  port's mouth (its centre line on the Nano's left face); the plug's axis is at zAxis above the breadboard. Typical
 *  sizes: a 6.9 x 3.1 mm nickel shell, a 16.5 x 10.6 x 6.8 mm overmould, a ribbed strain relief, a 3.8 mm cable. */
export function buildUsbPlug(group, M, zAxis, cableLen = 140, zRest = -BB.H) {
  const black = new THREE.MeshPhysicalMaterial({color: '#141416', roughness: 0.5, metalness: 0, specularIntensity: 0.6});
  const cableMat = new THREE.MeshPhysicalMaterial({color: '#151517', roughness: 0.46, metalness: 0, clearcoat: 0.15, clearcoatRoughness: 0.45, specularIntensity: 0.6});
  // the shell's last millimetre outside the port
  const shell = new THREE.Mesh(rbox(1.2, 6.9, 3.1, 0.3), M.shell);
  shell.position.set(-0.55, 0, zAxis);
  shell.castShadow = shell.receiveShadow = true;
  group.add(shell);
  // the overmould: a top outline narrowing toward the cable, extruded with rounded edges (the bevel grows the outline
  // by bs all round, so the drawn outline sits bs inside the finished one)
  const x0 = -1.0;
  const x1 = -17.5;
  const hw0 = 5.3;
  const hw1 = 4.4;
  const T = 6.8;
  const bev = 1.4;
  const bs = 1.3;
  const r = 1.0;
  const ax = x0 - bs;
  const bx = x1 + bs;
  const ah = hw0 - bs;
  const bh = hw1 - bs;
  const sh = new THREE.Shape();
  sh.moveTo(ax - r, -ah);
  sh.lineTo(bx + r, -bh);
  sh.quadraticCurveTo(bx, -bh, bx, -bh + r);
  sh.lineTo(bx, bh - r);
  sh.quadraticCurveTo(bx, bh, bx + r, bh);
  sh.lineTo(ax - r, ah);
  sh.quadraticCurveTo(ax, ah, ax, ah - r);
  sh.lineTo(ax, -ah + r);
  sh.quadraticCurveTo(ax, -ah, ax - r, -ah);
  const ov = new THREE.ExtrudeGeometry(sh, {depth: T - 2 * bev, bevelEnabled: true, bevelThickness: bev, bevelSize: bs, bevelSegments: 6, curveSegments: 12});
  ov.translate(0, 0, zAxis - T / 2 + bev);
  const overmould = new THREE.Mesh(ov, black);
  overmould.castShadow = overmould.receiveShadow = true;
  group.add(overmould);
  // grip ribs across the overmould's top near the cable end
  for (let k = 0; k < 4; k++) {
    const rib = new THREE.Mesh(rbox(0.5, 2 * hw1 - 2.4, 0.25, 0.12), black);
    rib.position.set(x1 + 3.2 + k * 1.2, 0, zAxis + T / 2 + 0.05);
    rib.castShadow = rib.receiveShadow = true;
    group.add(rib);
  }
  // the strain relief: a tapered sleeve with rings, then the cable
  const xs0 = x1 - 0.2;
  const xs1 = x1 - 9.0;
  const prof = [];
  const N = 48;
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    let rr = 3.0 + (2.15 - 3.0) * u;
    rr -= 0.18 * Math.max(0, Math.cos(u * Math.PI * 2 * 4.5)) * (u > 0.08 ? 1 : 0);
    prof.push(new THREE.Vector2(rr, -(xs0 + (xs1 - xs0) * u)));
  }
  prof.unshift(new THREE.Vector2(0.001, -xs0));
  const relief = new THREE.LatheGeometry(prof, 40);
  relief.rotateZ(Math.PI / 2); // lathe axis y -> -x
  const rel = new THREE.Mesh(relief, black);
  rel.position.set(0, 0, zAxis);
  rel.castShadow = rel.receiveShadow = true;
  group.add(rel);
  // the cable: level out of the relief, then sagging down to rest at zRest (the table, or the board)
  const Rc = 1.9;
  const zEnd = zRest + Rc;
  const pts = [];
  for (let i = 0; i <= 60; i++) {
    const x = xs1 + 2 - (i / 60) * cableLen;
    const d = (xs1 - x) / 34; // 0 at the relief, 1 about 34 mm out
    const e = d >= 1 ? 1 : d <= 0 ? 0 : d * d * (3 - 2 * d);
    pts.push(new THREE.Vector3(x, 0, zAxis + (zEnd - zAxis) * e));
  }
  const cable = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 400, Rc, 28, false), cableMat);
  cable.castShadow = cable.receiveShadow = true;
  group.add(cable);
  return {socket: [0, 0, zAxis]};
}

// ------------------------------------------------------------------------------------------------ the wires' colours
/** The jumper wires' insulation (2.1's wire radius and material). Seen from above, a wire's top faces the key light,
 *  so 2.1's colours (red #b0322c, yellow #cfa236, black #1c1c1e) come out lighter than 2.1 shows them; these are set
 *  so the rendered wire matches 2.1's picture (red about #bf3732, yellow #e6b132), blue and green in the same key. */
export const WIRE = {
  r: 0.8,
  colors: {red: '#8a2420', black: '#141416', yellow: '#a8801f', blue: '#1f4580', green: '#21653b'},
};
export function wireMaterial(color) {
  return new THREE.MeshPhysicalMaterial({color, roughness: 0.4, metalness: 0, clearcoat: 0.3, clearcoatRoughness: 0.35, specularIntensity: 0.6});
}
