// @ts-nocheck
// The Arduino Nano.
// Copied from flexitac-anatomy/figures/board/pbr/board-real/nano.js (the renders of lessons 2.1 and 2.2), so the live 3D bench of lesson 2.2
// (../scene.ts) draws the same shapes and materials. Keep the two in step; only the imports differ.
// The Arduino Nano (clone) that plugs into the board's two 1x15 sockets. Its outline, USB position and the 30 pin
// positions are real (board.json header, nanoOutline, usbOutline). Everything else is placed from the top-down photo
// refs/guide/small/image16.jpg (ATmega328P TQFP-32 at 45 deg, reset switch, 4 LEDs, resonator, ICSP 2x3, mounting
// holes), sized from typical datasheets, and its copper traces are invented to look plausible (NOTES.md).
// Built in the board frame (mm, z up from the reading board's top face) as seated; lift by moving the group.
import * as THREE from 'three';
import {heightToNormal} from './height';
import {box, icPackage, markIC, pinGeo, rbox, solderCone, stdPins, T, topDecal} from './kit';

export const NANO = {
  socketH: 8.5, // female header body height (typical 2.54 mm socket)
  spacerH: 2.5, // male header plastic
  pcbT: 1.6,
  pinBelow: 6.0, // male pin length under the plastic
  pinAbove: 3.0, // through the Nano and out the top
};

export function buildNano(pcb, M, bins, group, cfg = {}) {
  const [nx0, ny0, nx1, ny1] = pcb.header.nano;
  const NW = nx1 - nx0;
  const NH = ny1 - ny0;
  const cx = (nx0 + nx1) / 2;
  const zB = NANO.socketH + NANO.spacerH; // Nano underside
  const zT = zB + NANO.pcbT; // Nano top face
  const pins = pcb.header.pins;
  // photo-measured positions (board-local mm), image16.jpg at ~15.9 px/mm
  const P = {
    mcu: [cx, 13.5, 45],
    reset: [cx - 0.5, 22.9],
    leds: [[4.29, 27.6, 'TX'], [7.5, 27.6, 'RX'], [10.58, 27.6, 'ON'], [13.55, 27.6, 'L']],
    xtal: [5.35, 19.1, 62],
    icsp: [cx, 39.25],
    holes: [[pins[0][0], 40.2], [pins[29][0], 40.2], [pins[0][0], -0.1], [pins[29][0], -0.1]],
  };
  const usbO = pcb.header.usb;
  const usb = {cx: (usbO[0] + usbO[2]) / 2, y0: usbO[1], len: 7.55, w: 7.7, h: 3.9};

  // ---------------------------------------------------------- the Nano's top texture
  const PX = 24;
  const W = Math.round(NW * PX);
  const H = Math.round(NH * PX);
  const mk = () => {
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d', {willReadFrequently: true});
    g.setTransform(PX, 0, 0, -PX, -nx0 * PX, ny1 * PX);
    return [c, g];
  };
  // dark teal clone mask, calibrated against image16.jpg (Nano mask about 0.42x the reading board's green, bluer)
  const MASK = '#082a20';
  const TRACE = '#0f3a2d';
  const [cCol, g] = mk();
  const [cH, gh] = mk(); // height, grey
  const [cMet, gm] = mk(); // metal mask
  g.fillStyle = MASK;
  g.fillRect(nx0, ny0, NW, NH);
  gh.fillStyle = '#000';
  gh.fillRect(nx0, ny0, NW, NH);
  gm.fillStyle = '#000';
  gm.fillRect(nx0, ny0, NW, NH);
  const both = (fn) => {
    fn(g, TRACE);
    fn(gh, '#555');
  };
  // invented routing: every header pin runs in, bends 45 deg and heads for the MCU; a bus up to the ICSP and USB
  const [mx, my] = P.mcu;
  both((c, col) => {
    c.strokeStyle = col;
    c.lineWidth = 0.25;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    pins.forEach(([x, y], i) => {
      if (i === 3 || i === 28) return; // GND pins tie to the pour, no trace
      const left = x < cx;
      const x1 = x + (left ? 1.6 : -1.6);
      const ty = my + Math.max(-3.2, Math.min(3.2, (y - my) * 0.18));
      const tx = mx + (left ? -4.2 : 4.2);
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x1, y);
      const dy = ty - y;
      const run = Math.abs(tx - x1);
      const diag = Math.min(Math.abs(dy), run * 0.8);
      const x2 = x1 + (left ? 1 : -1) * (run - diag);
      c.lineTo(x2, y);
      c.lineTo(tx, y + Math.sign(dy) * diag);
      c.lineTo(tx, ty);
      c.stroke();
    });
    // ICSP and USB buses
    for (let k = -2; k <= 2; k++) {
      c.beginPath();
      c.moveTo(cx + k * 0.6, my + 4.5);
      c.lineTo(cx + k * 0.6, P.icsp[1] - 3.2 - Math.abs(k) * 0.3);
      c.lineTo(cx + k * 1.27, P.icsp[1] - 1.5);
      c.stroke();
      c.beginPath();
      c.moveTo(usb.cx + k * 0.8, usb.y0 + usb.len + 0.6);
      c.lineTo(usb.cx + k * 0.8, usb.y0 + usb.len + 1.6 + Math.abs(k) * 0.4);
      c.lineTo(cx + k * 0.5, my - 4.6);
      c.stroke();
    }
    // LED and reset feeds
    for (const [x, y] of P.leds) {
      c.beginPath();
      c.moveTo(x, y + 1.0);
      c.lineTo(x, y + 2.4);
      c.lineTo(x + (x < cx ? 1.2 : -1.2), y + 3.6);
      c.stroke();
    }
  });
  // pads and vias
  const ring = (x, y, ro, ri, square = false) => {
    for (const [c, col] of [[g, '#c9ccd0'], [gh, '#888'], [gm, '#fff']]) {
      c.fillStyle = col;
      c.beginPath();
      if (square) c.rect(x - ro, y - ro, 2 * ro, 2 * ro);
      else c.arc(x, y, ro, 0, Math.PI * 2);
      c.fill();
    }
    g.fillStyle = '#0b0d0c';
    g.beginPath();
    g.arc(x, y, ri, 0, Math.PI * 2);
    g.fill();
  };
  pins.forEach(([x, y], i) => ring(x, y, 0.85, 0.45, i === 0 || i === 29));
  for (const [x, y] of P.holes) ring(x, y, 1.05, 0.62);
  for (let i = 0; i < 6; i++) ring(P.icsp[0] + (i % 3 - 1) * 2.54, P.icsp[1] + (i < 3 ? -1.27 : 1.27), 0.75, 0.45);
  const vias = [[5.2, 33.5], [11.6, 34.2], [13.1, 31.6], [3.6, 23.6], [12.9, 24.8], [14.2, 20.9], [3.9, 9.9], [7.0, 7.7], [11.3, 7.9], [14.6, 11.3], [4.6, 15.8], [13.4, 16.6], [8.1, 30.9], [9.9, 5.6], [6.1, 26.0], [12.3, 19.2], [5.2, 12.6], [10.7, 35.9]];
  for (const [x, y] of vias) ring(x, y, 0.33, 0.16);
  // MCU, USB, LED, switch pads (under the parts' feet)
  const pad = (x, y, w, h, rot = 0) => {
    for (const [c, col] of [[g, '#c9ccd0'], [gh, '#888'], [gm, '#fff']]) {
      c.save();
      c.translate(x, y);
      c.rotate((rot * Math.PI) / 180);
      c.fillStyle = col;
      c.fillRect(-w / 2, -h / 2, w, h);
      c.restore();
    }
  };
  {
    const a = (P.mcu[2] * Math.PI) / 180;
    for (const [px, py] of stdPins(32, 0.8, 4.35, true)) {
      const vertical = Math.abs(px) > Math.abs(py);
      pad(mx + px * Math.cos(a) - py * Math.sin(a), my + px * Math.sin(a) + py * Math.cos(a), vertical ? 1.3 : 0.45, vertical ? 0.45 : 1.3, P.mcu[2]);
    }
  }
  for (let k = -2; k <= 2; k++) pad(usb.cx + k * 0.8, usb.y0 + usb.len + 0.5, 0.45, 1.5);
  for (const sx of [-1, 1]) for (const sy of [0.25, 0.9]) pad(usb.cx + sx * (usb.w / 2 + 0.3), usb.y0 + usb.len * sy + (sy < 0.5 ? 0.4 : 0), 1.6, 1.6);
  for (const [x, y] of P.leds) {
    pad(x, y - 0.95, 1.0, 0.7);
    pad(x, y + 0.95, 1.0, 0.7);
  }
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) pad(P.reset[0] + sx * 3.4, P.reset[1] + sy * 1.15, 1.0, 0.8);
  // silkscreen: pin names, rotated to read bottom-to-top as on the board, inside each row
  const silk = (fn) => {
    for (const [c, col, inv] of [[g, '#eef0ea', MASK], [gh, '#666', '#000']]) {
      c.save();
      c.fillStyle = col;
      c.strokeStyle = col;
      c.inv = inv;
      fn(c);
      c.restore();
    }
  };
  // text in pixel space: a 1 mm font under a x24 transform gets sub-pixel glyph advances and ragged spacing
  const label = (c, txt, x, y, rot, size = 1.0, boxed = false) => {
    c.save();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.translate((x - nx0) * PX, (ny1 - y) * PX);
    c.rotate((-rot * Math.PI) / 180);
    const fs = size * PX;
    c.font = `700 ${fs}px Inter, sans-serif`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    if (boxed) {
      const w = c.measureText(txt).width + 0.4 * PX;
      c.fillRect(-w / 2, -fs * 0.62, w, fs * 1.24);
      const f = c.fillStyle;
      c.fillStyle = c.inv;
      c.fillText(txt, 0, fs * 0.05);
      c.fillStyle = f;
    } else c.fillText(txt, 0, fs * 0.05);
    c.restore();
  };
  const names = {0: 'TX1', 1: 'RX0', 2: 'RST', 3: 'GND', 16: '3V3', 17: 'REF', 26: '5V', 27: 'RST', 28: 'GND', 29: 'VIN'};
  silk((c) => {
    pins.forEach(([x, y, name], i) => {
      const left = x < cx;
      let t = names[i] ?? name.replace('/TX', '').replace('/RX', '');
      if (t === 'AREF') t = 'REF';
      label(c, t, x + (left ? 1.75 : -1.75), y, 90, 0.82, t === 'GND');
    });
    for (const [x, y, t] of P.leds) label(c, t, x + 0.25, y + 2.2, 0, 0.85);
    label(c, 'RESET', P.reset[0], P.reset[1] - 2.55, 0, 0.9);
    c.lineWidth = 0.15;
    for (const [x, y] of P.leds) c.strokeRect(x - 0.75, y - 1.45, 1.5, 2.9);
  });
  // our copper fill under the mask: height map so the routing reads as relief, as on the reading board
  {
    const raw = gh.getImageData(0, 0, W, H).data;
    const hgt = new Float32Array(W * H);
    for (let i = 0; i < W * H; i++) hgt[i] = (raw[i * 4] / 255) * 60;
    cH.getContext('2d').putImageData(new ImageData(heightToNormal(hgt, W, H, PX, 1), W, H), 0, 0);
    // roughness/metal: pads metal, mask glossy
    const met = gm.getImageData(0, 0, W, H).data;
    const orm = new Uint8ClampedArray(W * H * 4);
    for (let i = 0; i < W * H; i++) {
      const m = met[i * 4] / 255;
      orm[i * 4] = 255;
      orm[i * 4 + 1] = 255 * (0.34 * (1 - m) + 0.42 * m);
      orm[i * 4 + 2] = 255 * m;
      orm[i * 4 + 3] = 255;
    }
    cMet.getContext('2d').putImageData(new ImageData(orm, W, H), 0, 0);
  }
  const tex = (c, srgb) => {
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.anisotropy = 8;
    return t;
  };
  const ormT = tex(cMet, false);
  const topMat = new THREE.MeshPhysicalMaterial({map: tex(cCol, true), normalMap: tex(cH, false), roughnessMap: ormT, metalnessMap: ormT, roughness: 1, metalness: 1, clearcoat: 0.45, clearcoatRoughness: 0.22, specularIntensity: 0.3});
  const edgeMat = new THREE.MeshStandardMaterial({color: '#6f8a6c', roughness: 0.7});
  const botMat = new THREE.MeshStandardMaterial({color: MASK, roughness: 0.4});
  const board = new THREE.Mesh(new THREE.BoxGeometry(NW, NH, NANO.pcbT), [edgeMat, edgeMat, edgeMat, edgeMat, topMat, botMat]);
  board.position.set(cx, (ny0 + ny1) / 2, zB + NANO.pcbT / 2);
  board.castShadow = true;
  board.receiveShadow = true;
  group.add(board);

  // ---------------------------------------------------------- headers: plastic under the board, pins, solder on top
  const block = rbox(2.5, 2.5, Math.max(NANO.spacerH, 0.1), 0.12); // (no plastic at all in Fig 3's geometry: fig3.mjs)
  const pin = pinGeo(NANO.socketH - NANO.pinBelow, zB + NANO.pinAbove);
  const cone = solderCone(0.8, 0.36, 0.6);
  for (const [x, y] of pins) {
    if (NANO.spacerH > 0) bins.add(M.socket, block, T(x, y, NANO.socketH + NANO.spacerH / 2));
    bins.add(M.tin, pin, T(x, y, 0));
    bins.add(M.solder, cone, T(x, y, zT));
  }
  // ICSP 2x3: plastic on top (2.5 mm, whatever the main headers are), pins up, joints underneath
  const icspBlock = rbox(2.5, 2.5, 2.5, 0.12);
  for (let i = 0; i < 6; i++) {
    const x = P.icsp[0] + (i % 3 - 1) * 2.54;
    const y = P.icsp[1] + (i < 3 ? -1.27 : 1.27);
    bins.add(M.socket, icspBlock, T(x, y, zT + 1.25));
    bins.add(M.tin, pinGeo(zB - 1.2, zT + 2.5 + 6.0), T(x, y, 0));
    bins.add(M.solder, cone, new THREE.Matrix4().makeRotationX(Math.PI).setPosition(x, y, zB));
  }

  // ---------------------------------------------------------- parts on top
  const base = new THREE.Matrix4().makeTranslation(0, 0, zT);
  {
    const part = {x: P.mcu[0], y: P.mcu[1], rot: P.mcu[2], pins: stdPins(32, 0.8, 4.4, true).map(([px, py]) => {
      const a = (P.mcu[2] * Math.PI) / 180;
      return [P.mcu[0] + px * Math.cos(a) - py * Math.sin(a), P.mcu[1] + px * Math.sin(a) + py * Math.cos(a)];
    })};
    const {frame, top} = icPackage(bins, M, part, {L: 7, W: 7, H: 1.2, standoff: 0.1, exitH: 0.55, span: 9.0, leadW: 0.37, leadT: 0.15, r: 0.15, quad: true}, base);
    const d = topDecal(6.4, 6.4, 90, markIC(['ATMEL', 'MEGA328P', 'U-TH', '2148'], {size: 0.13, ink: '#7f7f7c'}));
    d.applyMatrix4(frame.clone().multiply(T(0, 0, top + 0.004, -90)));
    group.add(d);
  }
  // mini-B USB: a nickel shell (gold with cfg.usbGold: the guide photos show a gold-toned one), a collar round the
  // mouth and a solid body behind, the dark mouth, the tongue, side legs
  {
    const {cx: ux, y0, len, w, h} = usb;
    const sh = new THREE.Shape();
    const ch = 0.9;
    sh.moveTo(-w / 2 + ch, 0);
    sh.lineTo(w / 2 - ch, 0);
    sh.lineTo(w / 2, ch);
    sh.lineTo(w / 2, h);
    sh.lineTo(-w / 2, h);
    sh.lineTo(-w / 2, ch);
    sh.closePath();
    const t = 0.32;
    const hole = new THREE.Path();
    hole.moveTo(-w / 2 + ch + t * 0.4, t);
    hole.lineTo(-w / 2 + t, ch + t * 0.4);
    hole.lineTo(-w / 2 + t, h - t);
    hole.lineTo(w / 2 - t, h - t);
    hole.lineTo(w / 2 - t, ch + t * 0.4);
    hole.lineTo(w / 2 - ch - t * 0.4, t);
    hole.closePath();
    sh.holes.push(hole);
    // shape (x, height) extruded along its z -> (-x, y = depth, z = height): a proper rotation, the shape is symmetric
    const XZY = new THREE.Matrix4().set(-1, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 1);
    const collar = new THREE.ExtrudeGeometry(sh, {depth: 2.2, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.08, bevelSegments: 1});
    collar.applyMatrix4(XZY);
    bins.add((cfg.usbGold ? M.shellGold : M.shell), collar, T(ux, y0, zT));
    // the solid body behind the mouth
    const bodyS = new THREE.ExtrudeGeometry(new THREE.Shape(sh.getPoints()), {depth: len - 2.0, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.1, bevelSegments: 2});
    bodyS.applyMatrix4(XZY);
    bins.add((cfg.usbGold ? M.shellGold : M.shell), bodyS, T(ux, y0 + 2.0, zT));
    // the mouth's back wall and the tongue
    bins.add(M.dark, box(w - 0.7, 0.2, h - 0.75), T(ux, y0 + 1.9, zT + h / 2 + 0.1));
    bins.add(M.socket, box(4.2, 1.7, 0.7), T(ux, y0 + 1.05, zT + h * 0.52));
    for (let k = -2; k <= 2; k++) bins.add(M.gold, box(0.3, 1.2, 0.05), T(ux + k * 0.8, y0 + 1.0, zT + h * 0.52 - 0.37));
    // latch slots on the lid
    for (const s of [-1, 1]) bins.add(M.dark, box(0.9, 1.6, 0.06), T(ux + s * 1.6, y0 + 3.0, zT + h + 0.0));
    // legs onto the side pads, signal pins out of the back
    for (const sx of [-1, 1]) {
      for (const sy of [0.25, 0.9]) {
        const yy = y0 + len * sy + (sy < 0.5 ? 0.4 : 0);
        bins.add((cfg.usbGold ? M.shellGold : M.shell), box(0.25, 1.2, 1.6), T(ux + sx * (w / 2 + 0.1), yy, zT + 0.8));
        bins.add(M.solder, box(0.9, 1.3, 0.25), T(ux + sx * (w / 2 + 0.35), yy, zT + 0.12));
      }
    }
    for (let k = -2; k <= 2; k++) bins.add(M.tin, box(0.3, 1.4, 0.15), T(ux + k * 0.8, y0 + len + 0.35, zT + 0.08));
  }
  // reset: black base, steel plate, white round actuator, four legs
  {
    const [x, y] = P.reset;
    bins.add(M.socket, rbox(6.0, 3.5, 0.8, 0.12), T(x, y, zT + 0.4));
    bins.add(M.steel, rbox(5.4, 3.3, 0.25, 0.1), T(x, y, zT + 0.92));
    const btn = new THREE.CylinderGeometry(0.85, 0.9, 0.55, 28);
    btn.rotateX(Math.PI / 2);
    bins.add(M.white, btn, T(x, y, zT + 1.3));
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) bins.add(M.tin, box(0.8, 0.6, 0.18), T(x + sx * 3.25, y + sy * 1.15, zT + 0.09));
  }
  // 0805 LEDs, long axis along y: white body, a lens, tinned ends
  for (const [x, y] of P.leds) {
    bins.add(M.white, rbox(1.25, 1.5, 0.45, 0.08), T(x, y, zT + 0.23));
    bins.add(M.ledLens, rbox(0.95, 1.1, 0.16, 0.06), T(x, y, zT + 0.52));
    for (const s of [-1, 1]) bins.add(M.tin, rbox(1.25, 0.3, 0.5, 0.06), T(x, y + s * 0.88, zT + 0.25));
  }
  // resonator: a small metal-capped part
  {
    const [x, y, r] = P.xtal;
    bins.add(M.steel, rbox(3.2, 1.3, 0.8, 0.15), T(x, y, zT + 0.4, r));
    bins.add(M.dark, box(1.2, 1.32, 0.82), T(x, y, zT + 0.4, r));
  }
  return {zB, zT, board};
}
