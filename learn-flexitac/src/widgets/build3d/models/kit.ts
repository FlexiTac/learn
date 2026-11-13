// @ts-nocheck
// Shared shapes and materials.
// Copied from flexitac-anatomy/figures/board/pbr/board-real/parts.js (the renders of lessons 2.1 and 2.2), so the live 3D bench of lesson 2.2
// (../scene.ts) draws the same shapes and materials. Keep the two in step; only the imports differ.
// Procedural packages in the Z-up board frame (mm). Everything that shares a material is merged into one mesh per
// group (Bins), so the whole board draws in a few dozen calls. Lead positions come from the real pads (pcb.json parts);
// body sizes from board.json packages; heights and connector shapes are datasheet-typical guesses (see NOTES.md).
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

const D2R = Math.PI / 180;
const M4 = THREE.Matrix4;

export function makeMaterials() {
  const P = (o) => new THREE.MeshPhysicalMaterial(o);
  const S = (o) => new THREE.MeshStandardMaterial(o);
  return {
    // satin black epoxy: a soft clearcoat lobe over a mid-rough base (round 2)
    epoxy: P({color: '#111113', roughness: 0.46, metalness: 0, specularIntensity: 0.8}),
    // metals satin, not mirror: tinned leads and pins, solder joints, gold contacts, the mini-USB's nickel shell
    tin: S({color: '#c9ccd0', roughness: 0.4, metalness: 1}),
    solder: S({color: '#c6c9cc', roughness: 0.36, metalness: 1}),
    gold: S({color: '#d9b25e', roughness: 0.4, metalness: 1}),
    shell: S({color: '#c2c5c8', roughness: 0.36, metalness: 1}),
    shellGold: S({color: '#d8b25f', roughness: 0.34, metalness: 1}),
    steel: S({color: '#c3c6ca', roughness: 0.4, metalness: 1}),
    ivory: P({color: '#ebe5d3', roughness: 0.48, metalness: 0, sheen: 0.2}),
    latch: P({color: '#111113', roughness: 0.46, metalness: 0, specularIntensity: 0.8}),
    socket: P({color: '#0b0b0c', roughness: 0.52, metalness: 0, specularIntensity: 0.6}),
    hole: S({color: '#050505', roughness: 0.9}),
    ceramic: S({color: '#ece8de', roughness: 0.6}),
    rtop: P({color: '#141416', roughness: 0.5}),
    cable: P({color: '#eef0f1', roughness: 0.6, metalness: 0, side: THREE.DoubleSide}),
    cableTab: P({color: '#2a66d6', roughness: 0.42, metalness: 0, clearcoat: 0.3, side: THREE.DoubleSide}),
    white: P({color: '#f2f2ee', roughness: 0.45}),
    ledLens: P({color: '#f4edd2', roughness: 0.15, transmission: 0, clearcoat: 0.8}),
    dark: S({color: '#0c0c0d', roughness: 0.7}),
  };
}

/** Geometry bins: add(mat, geo, matrix) now, build() merges each material's geometries into one mesh. */
export class Bins {
  constructor() {
    this.map = new Map();
  }
  add(mat, geo, m) {
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    g.clearGroups();
    if (m) g.applyMatrix4(m);
    if (!this.map.has(mat)) this.map.set(mat, []);
    this.map.get(mat).push(g);
  }
  build(group, {cast = true, receive = true} = {}) {
    for (const [mat, list] of this.map) {
      const mesh = new THREE.Mesh(mergeGeometries(list, false), mat);
      mesh.castShadow = cast;
      mesh.receiveShadow = receive;
      group.add(mesh);
    }
    this.map.clear();
    return group;
  }
}

export const T = (x, y, z, rotDeg = 0) => new M4().makeRotationZ(rotDeg * D2R).setPosition(x, y, z);
export const rbox = (w, d, h, r = 0.1, seg = 2) => new RoundedBoxGeometry(w, d, h, seg, Math.min(r, w / 2 - 1e-3, d / 2 - 1e-3, h / 2 - 1e-3));
export const box = (w, d, h) => new THREE.BoxGeometry(w, d, h);

// ------------------------------------------------------------ leads
/** A gull-wing lead in its own frame: X along the body edge, +Y outward from the body side at Y = 0, Z up from the
 *  board. exitH: lead centreline height where it leaves the body; L: body side to toe; t: thickness; w: width. */
export function gullLead({exitH, L, t, w}) {
  const c = [[-0.3, exitH], [0.16 * L, exitH]];
  const a = 0.16 * L;
  const b = 0.58 * L;
  for (let i = 1; i <= 10; i++) {
    const u = i / 10;
    const k = u * u * (3 - 2 * u);
    c.push([a + (b - a) * u, exitH + (t / 2 - exitH) * k]);
  }
  c.push([L, t / 2]);
  const up = [];
  const lo = [];
  for (let i = 0; i < c.length; i++) {
    const p = c[Math.max(0, i - 1)];
    const n = c[Math.min(c.length - 1, i + 1)];
    let tx = n[0] - p[0];
    let tz = n[1] - p[1];
    const l = Math.hypot(tx, tz);
    tx /= l;
    tz /= l;
    up.push([c[i][0] - tz * (t / 2), c[i][1] + tx * (t / 2)]);
    lo.push([c[i][0] + tz * (t / 2), c[i][1] - tx * (t / 2)]);
  }
  const sh = new THREE.Shape();
  up.forEach(([s, z], i) => (i ? sh.lineTo(s, z) : sh.moveTo(s, z)));
  for (let i = lo.length - 1; i >= 0; i--) sh.lineTo(lo[i][0], lo[i][1]);
  sh.closePath();
  const g = new THREE.ExtrudeGeometry(sh, {depth: w, bevelEnabled: false, curveSegments: 2});
  // shape (s, z, e) -> (e - w/2, s, z), a proper rotation
  g.applyMatrix4(new M4().set(0, 0, 1, -w / 2, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1));
  g.computeVertexNormals();
  return g;
}

/** A molded IC with gull-wing leads. part: {x, y, rot, pins: [[x, y, padW, padH]...]} in board mm. The leads go
 *  where the pads are (local frame: body along X, leads leave the long sides at +-W/2; 4-sided when quad). */
export function icPackage(bins, M, part, s, base = new M4()) {
  const {L, W, H, standoff = 0.1, exitH, span, leadW, leadT = 0.18, r = 0.22, quad = false} = s;
  const frame = base.clone().multiply(T(part.x, part.y, 0, part.rot));
  const hb = H - standoff;
  bins.add(M.epoxy, rbox(L, W, hb, r, 2), frame.clone().multiply(T(0, 0, standoff + hb / 2)));
  const lead = gullLead({exitH, L: span / 2 - W / 2, t: leadT, w: leadW});
  const leadQ = quad ? gullLead({exitH, L: span / 2 - L / 2, t: leadT, w: leadW}) : null;
  const c = Math.cos(-part.rot * D2R);
  const sn = Math.sin(-part.rot * D2R);
  for (const p of part.pins) {
    const dx = p[0] - part.x;
    const dy = p[1] - part.y;
    const lx = dx * c - dy * sn;
    const ly = dx * sn + dy * c;
    if (quad && Math.abs(lx) > Math.abs(ly)) {
      const side = Math.sign(lx);
      bins.add(M.tin, leadQ, frame.clone().multiply(T(side * L / 2, ly, 0, side > 0 ? -90 : 90)));
    } else {
      const side = Math.sign(ly);
      bins.add(M.tin, lead, frame.clone().multiply(T(lx, side * W / 2, 0, side > 0 ? 0 : 180)));
    }
  }
  return {frame, top: standoff + hb};
}

/** Standard pin positions for a package built from scratch (the Nano's parts, which have no pads in the data). */
export function stdPins(n, pitch, rowOff, quad = false) {
  const pins = [];
  if (!quad) {
    const k = n / 2;
    for (let i = 0; i < k; i++) pins.push([(i - (k - 1) / 2) * pitch, -rowOff]);
    for (let i = 0; i < k; i++) pins.push([((k - 1) / 2 - i) * pitch, rowOff]);
  } else {
    const k = n / 4;
    for (let i = 0; i < k; i++) pins.push([-rowOff, ((k - 1) / 2 - i) * pitch]);
    for (let i = 0; i < k; i++) pins.push([(i - (k - 1) / 2) * pitch, -rowOff]);
    for (let i = 0; i < k; i++) pins.push([rowOff, (i - (k - 1) / 2) * pitch]);
    for (let i = 0; i < k; i++) pins.push([((k - 1) / 2 - i) * pitch, rowOff]);
  }
  return pins;
}

/** A canvas-textured flat face laid on a part's top (laser marking, LED lens...). w x h mm, drawn by fn(ctx, px, py). */
export function topDecal(w, h, ppm, draw, mat = {}) {
  const c = document.createElement('canvas');
  c.width = Math.max(4, Math.round(w * ppm));
  c.height = Math.max(4, Math.round(h * ppm));
  const g = c.getContext('2d');
  draw(g, c.width, c.height);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  const m = new THREE.MeshPhysicalMaterial({map: t, roughness: 0.46, metalness: 0, specularIntensity: 0.8, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2, ...mat});
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
  mesh.receiveShadow = true;
  return mesh;
}

/** Laser marking on black epoxy: lines of text centred, a pin-1 dimple at the lower left, a TI-ish mark. */
export function markIC(lines, {dimple = true, logo = false, epoxy = '#111113', ink = '#5d5d5a', size = 0.22} = {}) {
  return (g, W, H) => {
    g.fillStyle = epoxy;
    g.fillRect(0, 0, W, H);
    const fs = H * size;
    g.fillStyle = ink;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `600 ${fs}px "JetBrains Mono", monospace`;
    const n = lines.length;
    lines.forEach((t, i) => g.fillText(t, W / 2 + (logo && i === 0 ? fs * 0.6 : 0), H / 2 + (i - (n - 1) / 2) * fs * 1.25));
    if (logo) {
      // a small blocky state outline, standing in for the TI logo
      const x = W / 2 - g.measureText(lines[0]).width / 2 - fs * 0.5;
      const y = H / 2 - ((n - 1) / 2) * fs * 1.25;
      g.beginPath();
      g.moveTo(x - fs * 0.45, y - fs * 0.4);
      g.lineTo(x + fs * 0.05, y - fs * 0.4);
      g.lineTo(x + fs * 0.05, y - fs * 0.1);
      g.lineTo(x + fs * 0.4, y);
      g.lineTo(x + fs * 0.1, y + fs * 0.45);
      g.lineTo(x - fs * 0.15, y + fs * 0.1);
      g.lineTo(x - fs * 0.45, y + fs * 0.05);
      g.closePath();
      g.fill();
    }
    if (dimple) {
      const r = H * 0.1;
      g.beginPath();
      g.arc(r * 2.0, H - r * 2.0, r, 0, Math.PI * 2);
      g.fillStyle = '#121214';
      g.fill();
      g.strokeStyle = '#2c2c30';
      g.lineWidth = Math.max(1, r * 0.25);
      g.stroke();
    }
  };
}

// ------------------------------------------------------------ chip resistor
/** 1206: alumina body, black overglaze top with its code, tinned end caps, solder fillets to the pads. */
export function chipResistor(bins, M, part, group, {L = 3.2, W = 1.6, H = 0.55, cap = 0.5, code = '1002'} = {}) {
  const f = T(part.x, part.y, 0, part.rot);
  bins.add(M.ceramic, box(L - 2 * cap + 0.02, W - 0.04, H - 0.06), f.clone().multiply(T(0, 0, 0.02 + (H - 0.06) / 2)));
  for (const s of [-1, 1]) {
    bins.add(M.tin, rbox(cap, W, H, 0.08), f.clone().multiply(T(s * (L / 2 - cap / 2), 0, H / 2)));
    // fillet: a wedge from the cap's end face down to the pad
    const sh = new THREE.Shape();
    sh.moveTo(0, 0);
    sh.lineTo(0.45, 0);
    sh.quadraticCurveTo(0.12, 0.05, 0, H * 0.6);
    sh.closePath();
    const g = new THREE.ExtrudeGeometry(sh, {depth: W * 0.9, bevelEnabled: false, curveSegments: 6});
    g.applyMatrix4(new M4().set(1, 0, 0, 0, 0, 0, -1, W * 0.45, 0, 1, 0, 0, 0, 0, 0, 1));
    g.computeVertexNormals();
    bins.add(M.solder, g, f.clone().multiply(T(s * (L / 2), 0, 0, s > 0 ? 0 : 180)));
  }
  const d = topDecal(L - 2 * cap - 0.06, W - 0.1, 160, (g, w, h) => {
    g.fillStyle = '#141416';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#d8d8d2';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `600 ${h * 0.62}px "JetBrains Mono", monospace`;
    g.fillText(code, w / 2, h / 2 + h * 0.03);
  }, {roughness: 0.45});
  d.applyMatrix4(f.clone().multiply(T(0, 0, H - 0.04 + 0.004)));
  group.add(d);
}

// ------------------------------------------------------------ FFC/FPC connector, 0.5 mm, flip lock
/** Built from the close-ups in image16.jpg / image8.jpg, front (lead side, y0) to back (cable side, y1):
 *  the tinned leads on their pads; a large flat ivory front block (~45 % of the depth) with a chamfered top edge;
 *  an open slot where every 0.5 mm contact shows as a bright finger tip; the black flip actuator over the back
 *  ~40 %, its two darker end blocks hooked into the ivory ears, a lip on its back edge; metal hold-downs on the ends.
 *  The body box comes from the silkscreen outline; heights are guesses (no datasheet in the materials). */
export function ffcConnector(bins, M, part, {x0, x1, y0, y1, H}) {
  const L = x1 - x0;
  const D = y1 - y0;
  const cx = (x0 + x1) / 2;
  const ear = 0.95;
  const wallD = D * 0.45;
  const slotD = 0.7;
  const floorH = 0.42;
  const inner = L - 2 * ear;
  // front block: an extruded profile with a chamfer on its top-front edge
  {
    const sh = new THREE.Shape();
    const c = 0.28;
    sh.moveTo(0, 0);
    sh.lineTo(wallD, 0);
    sh.lineTo(wallD, H);
    sh.lineTo(c, H);
    sh.lineTo(0, H - c);
    sh.closePath();
    const g = new THREE.ExtrudeGeometry(sh, {depth: inner + 0.02, bevelEnabled: false});
    // shape (y, z) extruded along x: (s, t, e) -> (e - inner/2, s, t): a proper rotation
    g.applyMatrix4(new M4().set(0, 0, 1, -(inner + 0.02) / 2, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1));
    g.computeVertexNormals();
    bins.add(M.ivory, g, T(cx, y0, 0));
  }
  // ears, full depth, and the floor under slot and actuator
  for (const s of [-1, 1]) bins.add(M.ivory, rbox(ear, D, H, 0.1), T(cx + s * (L / 2 - ear / 2), y0 + D / 2, H / 2));
  bins.add(M.ivory, box(inner + 0.02, D - wallD, floorH), T(cx, y0 + wallD + (D - wallD) / 2, floorH / 2));
  // the slot: a dark well, the contact fingers standing in it at the pin pitch
  bins.add(M.dark, box(inner, slotD, 0.04), T(cx, y0 + wallD + slotD / 2, H * 0.5));
  const finger = box(0.22, slotD + 0.1, 0.16);
  for (const p of part.pins) bins.add(M.tin, finger, T(p[0], y0 + wallD + slotD / 2 - 0.05, H * 0.5 + 0.1));
  // the actuator, closed: a black bar between the ears, darker end blocks, a lip at the back
  const ay0 = y0 + wallD + slotD;
  const ad = y1 - ay0 - 0.05;
  const aw = inner - 0.08;
  bins.add(M.latch, rbox(aw, ad, H - floorH - 0.05, 0.14), T(cx, ay0 + ad / 2, floorH + (H - floorH - 0.05) / 2));
  bins.add(M.latch, rbox(aw, 0.45, 0.22, 0.08), T(cx, y1 - 0.28, H - 0.03));
  for (const s of [-1, 1]) bins.add(M.socket, rbox(0.75, ad * 0.55, H - floorH + 0.04, 0.1), T(cx + s * (aw / 2 - 0.36), ay0 + ad * 0.3, floorH + (H - floorH + 0.04) / 2));
  // leads: flat on the pad, a short rise into the front block, a small solder fillet at the toe
  for (const p of part.pins) {
    const yTip = p[1] - p[3] / 2 + 0.1;
    const len = y0 + 0.3 - yTip;
    bins.add(M.tin, box(0.2, len, 0.1), T(p[0], yTip + len / 2, 0.05));
    bins.add(M.tin, box(0.2, 0.1, 0.42), T(p[0], y0 + 0.25, 0.21));
    bins.add(M.solder, rbox(0.26, 0.5, 0.08, 0.03), T(p[0], yTip + 0.35, 0.06));
  }
  // hold-downs: a bent plate on each end, its foot soldered to the tab pad
  for (const t of part.tabs) {
    const s = Math.sign(t[0] - cx);
    const dy = Math.min(t[3], D) * 0.7;
    bins.add(M.tin, box(0.12, dy, H * 0.7), T(cx + s * (L / 2 + 0.06), t[1], H * 0.35));
    bins.add(M.tin, box(0.6, dy, 0.12), T(cx + s * (L / 2 - 0.2), t[1], 0.06));
    bins.add(M.solder, rbox(0.5, dy * 0.9, 0.1, 0.04), T(cx + s * (L / 2 + 0.25), t[1], 0.05));
  }
  return {slotZ: floorH + 0.08, x0, x1, y0, y1, ay0};
}

// ------------------------------------------------------------ 2.54 mm sockets and pins
/** One row of female header positions: each a black block with a funnelled square mouth and a contact deep inside. */
export function socketRow(bins, M, pts, {z0, h = 8.5, pitch = 2.54}) {
  const sh = new THREE.Shape();
  const a = pitch / 2 - 0.06;
  sh.moveTo(-a, -a);
  sh.lineTo(a, -a);
  sh.lineTo(a, a);
  sh.lineTo(-a, a);
  sh.closePath();
  const hole = new THREE.Path();
  const m = 0.5;
  hole.moveTo(-m, -m);
  hole.lineTo(-m, m);
  hole.lineTo(m, m);
  hole.lineTo(m, -m);
  hole.closePath();
  sh.holes.push(hole);
  const bev = 0.14;
  const geo = new THREE.ExtrudeGeometry(sh, {depth: h - 2 * bev, bevelEnabled: true, bevelThickness: bev, bevelSize: bev * 0.8, bevelSegments: 2, curveSegments: 1});
  geo.translate(0, 0, bev);
  const plug = box(1.0, 1.0, 0.3);
  const spring = box(0.5, 0.18, 0.4);
  for (const [x, y] of pts) {
    bins.add(M.socket, geo, T(x, y, z0));
    bins.add(M.hole, plug, T(x, y, z0 + h - 3.2));
    bins.add(M.gold, spring, T(x, y - 0.32, z0 + h - 2.9));
    bins.add(M.gold, spring, T(x, y + 0.32, z0 + h - 2.9));
  }
}

/** A square 0.64 mm header pin with chamfered ends, from z0 to z1 (rotated 45 deg lathe of 4 sides). */
export function pinGeo(z0, z1, s = 0.64) {
  const r = (s / 2) * Math.SQRT2;
  const c = 0.22;
  const pts = [
    new THREE.Vector2(0, z0),
    new THREE.Vector2(r * 0.45, z0),
    new THREE.Vector2(r, z0 + c),
    new THREE.Vector2(r, z1 - c),
    new THREE.Vector2(r * 0.45, z1),
    new THREE.Vector2(0, z1),
  ];
  const g = new THREE.LatheGeometry(pts, 4, Math.PI / 4).toNonIndexed();
  g.rotateX(Math.PI / 2); // lathe axis Y -> Z
  g.computeVertexNormals(); // flat faces: a square pin, not a rounded one
  return g;
}

/** A solder joint around a pin on a pad: a concave cone. */
export function solderCone(rBase = 0.78, rTop = 0.36, h = 0.55) {
  const pts = [new THREE.Vector2(0.001, 0)];
  for (let i = 0; i <= 8; i++) {
    const u = i / 8;
    pts.push(new THREE.Vector2(rTop + (rBase - rTop) * Math.pow(1 - u, 2.2), u * h));
  }
  pts.push(new THREE.Vector2(0.001, h));
  const g = new THREE.LatheGeometry(pts, 20);
  g.rotateX(Math.PI / 2);
  g.computeVertexNormals();
  return g;
}

// ------------------------------------------------------------ flat flexible cable
/** A ribbon swept along a path in the (y, z) plane at x = cx: rectangular section w x t, uv u across, v along (mm). */
export function ribbonGeo(path, w, t) {
  const pos = [];
  const nor = [];
  const uv = [];
  const idx = [];
  const n = path.length;
  const frames = [];
  let acc = 0;
  for (let i = 0; i < n; i++) {
    const p = path[Math.max(0, i - 1)];
    const q = path[Math.min(n - 1, i + 1)];
    let ty = q[0] - p[0];
    let tz = q[1] - p[1];
    const l = Math.hypot(ty, tz);
    ty /= l;
    tz /= l;
    if (i) acc += Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]);
    frames.push({y: path[i][0], z: path[i][1], ny: -tz, nz: ty, v: acc});
  }
  // 4 faces: top (+n), bottom (-n), two edges (+-x)
  const faces = [
    [[-1, 1], [1, 1], 0, 1],
    [[1, -1], [-1, -1], 0, -1],
    [[1, 1], [1, -1], 1, 0],
    [[-1, -1], [-1, 1], -1, 0],
  ];
  for (const [[ax, an], [bx, bn], nx, nn] of faces) {
    const base = pos.length / 3;
    for (const f of frames) {
      for (const [sx, sn] of [[ax, an], [bx, bn]]) {
        pos.push((sx * w) / 2, f.y + (sn * t * f.ny) / 2, f.z + (sn * t * f.nz) / 2);
        nor.push(nx, nn * f.ny, nn * f.nz);
        uv.push((sx + 1) / 2, f.v);
      }
    }
    for (let i = 0; i < n - 1; i++) {
      const a = base + i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

/** A smooth path: straight runs joined by eased drops. keys: [[y, z]...]; returns ~n points per segment. */
export function easedPath(keys, n = 10) {
  const out = [keys[0]];
  for (let i = 1; i < keys.length; i++) {
    const [y0, z0] = keys[i - 1];
    const [y1, z1] = keys[i];
    const steps = z0 === z1 ? 1 : n;
    for (let k = 1; k <= steps; k++) {
      const u = k / steps;
      const e = u * u * (3 - 2 * u);
      out.push([y0 + (y1 - y0) * u, z0 + (z1 - z0) * e]);
    }
  }
  return out;
}
