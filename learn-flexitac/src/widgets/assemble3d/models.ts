// Lesson 1.5's parts in 3D, built in the root's z-up frame (mm; x right, y = -Y away from the viewer, z up):
//   FPCs        a fine grid plane with the Gerber's artwork on canvas (@shared/data/fpc_*.json: outline, windows,
//               slots, electrodes, fanout traces, gold fingers, silkscreen, stiffeners), a copper side and a back, cut
//               out by the picture's alpha; the grid lets the top tail bend up over a connector (setBend)
//   sheets      clear lamination film; the Velostat, a black square
//   connectors  an extender: a small black board with a 0.5 mm flip-lock socket on each side (the kit's ffcConnector)
//   cables      a flat white ribbon with blue stiffened ends along any path (setPath)
//   the board   the reading board from board.json: its outline, the four 74HC595s, the CD74HC4067, R1, FPC1/FPC2 and
//               the Nano's two 1 x 15 sockets, in the board's own frame (z = 0 its top face)
// Colours: the FPCs follow the photo look of the course's other FPC drawings (PI #df8401, ENIG cream); the board's
// parts and materials are the 2.2 bench's (../build3d/models/kit.ts, the course's photoreal renders).
import * as THREE from "three";
import fpcBot from "@shared/data/fpc_bot.json";
import fpcTop from "@shared/data/fpc_top.json";
import silkBot from "@shared/data/fpc_bot_silk.json";
import silkTop from "@shared/data/fpc_top_silk.json";
import { components as BOARD_PARTS, header as BOARD_HEADER } from "@shared/data/board.json";
import { Bins, chipResistor, ffcConnector, icPackage, markIC, socketRow, stdPins, T, topDecal } from "../build3d/models/kit";
import { BOARD, CABLE, CONN, SHEET, SOCK, SOCKETS, VELO, type P2 } from "../assemble/geometry";

type Pts = number[][];
interface FpcData {
  outline: { pts: Pts; bbox: number[] };
  windows: { pts: Pts }[];
  slots: { rects: { x0: number; y0: number; x1: number; y1: number }[] };
  electrodes: { rects: { x0: number; y0: number; x1: number; y1: number }[] };
  fingers: { rects: { x0: number; y0: number; x1: number; y1: number }[] };
  fanout: { traces: { pts: Pts; width: number }[] };
  stiffeners: { pts: Pts }[];
}
interface Silk {
  regions: { dark: boolean; pts: Pts }[];
}

const PI = "#df8401";
const PI_EDGE = "#6b2a03";
const CU_UNDER = "#cf6503";
const CU_BACK = "#c2650b";
const ENIG = ["#a48e62", "#ebdfbf", "#cdb98c"];
const STIFF = "#7a360c";
const STIFF_EDGE = "#4a1606";

// ------------------------------------------------------------------ an FPC
export interface FpcModel {
  group: THREE.Group;
  /** Raise the tail past the bend (local z; the caller gives the sign for a part turned face down). */
  setBend(h: number): void;
  /** Boxes (local frame) a pointer can take it by: the electrode block and the tail. */
  hits: THREE.Box3[];
}
export function buildFpc(which: "top" | "bot", maxAniso: number): FpcModel {
  const d = (which === "top" ? fpcTop : fpcBot) as unknown as FpcData;
  const silk = (which === "top" ? silkTop : silkBot) as unknown as Silk;
  const [bx0, by0, bx1, by1] = d.outline.bbox;
  const M = 1;
  const x0 = bx0 - M;
  const y0 = by0 - M;
  const x1 = bx1 + M;
  const y1 = by1 + M;
  const W = x1 - x0;
  const H = y1 - y0;
  const K = 11; // px per mm
  const mk = () => {
    const c = document.createElement("canvas");
    c.width = Math.round(W * K);
    c.height = Math.round(H * K);
    const g = c.getContext("2d")!;
    g.setTransform(K, 0, 0, -K, -x0 * K, y1 * K);
    return [c, g] as const;
  };
  const poly = (g: CanvasRenderingContext2D, pts: Pts) => {
    pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.closePath();
  };
  const shape = (g: CanvasRenderingContext2D) => {
    g.beginPath();
    poly(g, d.outline.pts);
    for (const w of d.windows) poly(g, w.pts);
  };
  const enig = (g: CanvasRenderingContext2D, r: { x0: number; y0: number; x1: number; y1: number }) => {
    const gr = g.createLinearGradient(r.x0, r.y0, r.x1, r.y1);
    gr.addColorStop(0, ENIG[0]);
    gr.addColorStop(0.5, ENIG[1]);
    gr.addColorStop(1, ENIG[2]);
    g.fillStyle = gr;
    g.fillRect(r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0);
  };
  const grain = (g: CanvasRenderingContext2D, seed0: number) => {
    let seed = seed0;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    g.save();
    g.globalCompositeOperation = "source-atop";
    for (let i = 0; i < 9000; i++) {
      g.fillStyle = rnd() < 0.5 ? "rgba(255,240,200,0.06)" : "rgba(80,30,0,0.07)";
      g.fillRect(x0 + rnd() * W, y0 + rnd() * H, 0.12, 0.12);
    }
    g.restore();
  };
  const cut = (g: CanvasRenderingContext2D) => {
    g.save();
    g.globalCompositeOperation = "destination-out";
    for (const r of d.slots.rects) g.fillRect(r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0);
    g.restore();
  };
  const traces = (g: CanvasRenderingContext2D, col: string, k = 1) => {
    g.strokeStyle = col;
    g.lineCap = "round";
    g.lineJoin = "round";
    for (const t of d.fanout.traces) {
      g.lineWidth = t.width * k;
      g.beginPath();
      t.pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      g.stroke();
    }
  };
  // the copper side: polyimide over the traces, the electrodes and fingers bare (gold), white silkscreen
  const [cf, gf] = mk();
  shape(gf);
  gf.fillStyle = PI;
  gf.fill("evenodd");
  gf.strokeStyle = PI_EDGE;
  gf.lineWidth = 0.18;
  gf.stroke();
  traces(gf, CU_UNDER, 1.1);
  for (const r of d.electrodes.rects) enig(gf, r);
  for (const r of d.fingers.rects) enig(gf, r);
  gf.beginPath();
  for (const r of silk.regions) poly(gf, r.pts);
  gf.fillStyle = "#f4efe2";
  gf.fill("evenodd");
  grain(gf, 11);
  cut(gf);
  // the back: polyimide with the copper showing through it, the stiffeners on it
  const [cb, gb] = mk();
  shape(gb);
  gb.fillStyle = "#d77a05";
  gb.fill("evenodd");
  traces(gb, CU_BACK, 1.1);
  gb.fillStyle = CU_BACK;
  for (const r of [...d.electrodes.rects, ...d.fingers.rects]) gb.fillRect(r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0);
  for (const s of d.stiffeners) {
    gb.beginPath();
    poly(gb, s.pts);
    gb.fillStyle = STIFF;
    gb.fill();
    gb.strokeStyle = STIFF_EDGE;
    gb.lineWidth = 0.2;
    gb.stroke();
  }
  grain(gb, 23);
  cut(gb);
  const tex = (c: HTMLCanvasElement) => {
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = maxAniso;
    return t;
  };
  const tf = tex(cf);
  const tb = tex(cb);
  // a grid fine enough to bend smoothly (1.2 mm cells)
  const nx = Math.ceil(W / 1.2);
  const ny = Math.ceil(H / 1.2);
  const geo = new THREE.PlaneGeometry(W, H, nx, ny);
  geo.translate(x0 + W / 2, y0 + H / 2, 0);
  const base = Float32Array.from(geo.attributes.position.array as Float32Array);
  const mat = (map: THREE.Texture, side: THREE.Side) =>
    new THREE.MeshPhysicalMaterial({ map, side, alphaTest: 0.5, roughness: 0.4, metalness: 0, clearcoat: 0.55, clearcoatRoughness: 0.32, specularIntensity: 0.7 });
  const front = new THREE.Mesh(geo, mat(tf, THREE.FrontSide));
  const back = new THREE.Mesh(geo, mat(tb, THREE.BackSide));
  front.castShadow = true;
  front.receiveShadow = back.receiveShadow = true;
  front.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: tf, alphaTest: 0.5, side: THREE.DoubleSide });
  const group = new THREE.Group();
  group.add(front, back);
  const setBend = (h: number) => {
    const p = geo.attributes.position as THREE.BufferAttribute;
    const { x0: b0, x1: b1 } = BEND_LOCAL;
    for (let i = 0; i < p.count; i++) {
      const x = base[i * 3];
      const u = Math.min(1, Math.max(0, (b0 - x) / (b0 - b1)));
      p.setZ(i, h * u * u * (3 - 2 * u));
    }
    p.needsUpdate = true;
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
  };
  // (what a pointer can take it by: the electrode block, and the tail as one box: the bottom FPC's A shape, the top
  // FPC's strip and its finger block)
  const hits =
    which === "top"
      ? [new THREE.Box3(new THREE.Vector3(-12.2, -33.2, -0.6), new THREE.Vector3(12, 32.3, 0.6)), new THREE.Box3(new THREE.Vector3(-69.8, -43.9, -0.6), new THREE.Vector3(12, -33, 0.6))]
      : [new THREE.Box3(new THREE.Vector3(-12.3, -32.1, -0.6), new THREE.Vector3(13.7, 32.1, 0.6)), new THREE.Box3(new THREE.Vector3(13, -34.1, -0.6), new THREE.Vector3(70.1, 20.4, 0.6))];
  return { group, setBend, hits };
}
/** Where the top FPC's tail bends (its own Gerber x), so it rides over the 32-pin connector in the pad. */
const BEND_LOCAL = { x0: -40, x1: -49 };

// ------------------------------------------------------------------ the sheets and the Velostat
export function buildSheet(): THREE.Group {
  const g = new THREE.Group();
  const film = new THREE.Mesh(
    new THREE.BoxGeometry(SHEET.w, SHEET.h, SHEET.t),
    new THREE.MeshPhysicalMaterial({ color: "#e9f2f7", transparent: true, opacity: 0.42, roughness: 0.18, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.12, depthWrite: false }),
  );
  film.position.z = SHEET.t / 2;
  film.renderOrder = 3;
  const edge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(SHEET.w, SHEET.h, SHEET.t)), new THREE.LineBasicMaterial({ color: "#f7fbff", transparent: true, opacity: 0.85 }));
  edge.position.z = SHEET.t / 2;
  edge.renderOrder = 4;
  g.add(film, edge);
  return g;
}
export function buildVelostat(): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(VELO.w, VELO.h, VELO.t), new THREE.MeshPhysicalMaterial({ color: "#121214", roughness: 0.58, metalness: 0.05, sheen: 0.35, sheenColor: new THREE.Color("#3a3a44") }));
  m.position.z = VELO.t / 2;
  m.castShadow = m.receiveShadow = true;
  return m;
}

// ------------------------------------------------------------------ a connector (extender)
/** The extender, centred at its origin on the table: the tail's socket faces +y (the pad), the cable's -y. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildConnector(kind: "c16" | "c32", M: any): THREE.Group {
  const n = CONN[kind].pins;
  const w = CONN[kind].w;
  const g = new THREE.Group();
  const pcb = new THREE.Mesh(new THREE.BoxGeometry(w + 0.8, CONN.d, CONN.pcbT), new THREE.MeshPhysicalMaterial({ color: "#16171a", roughness: 0.42, clearcoat: 0.4 }));
  pcb.position.z = CONN.pcbT / 2;
  pcb.castShadow = pcb.receiveShadow = true;
  g.add(pcb);
  const SD = 4.6;
  const sock = (face: 1 | -1) => {
    const bins = new Bins();
    const y0 = CONN.d / 2 - SD;
    const y1 = CONN.d / 2;
    const pins = Array.from({ length: n }, (_, i) => [(i - (n - 1) / 2) * 0.5, y0 - 0.45, 0.3, 1.0]);
    const tabs = [
      [-w / 2 - 0.3, (y0 + y1) / 2, 1, 2],
      [w / 2 + 0.3, (y0 + y1) / 2, 1, 2],
    ];
    ffcConnector(bins, M, { pins, tabs }, { x0: -w / 2, x1: w / 2, y0, y1, H: CONN.sockH });
    const s = new THREE.Group();
    bins.build(s);
    s.position.z = CONN.pcbT;
    if (face < 0) s.rotation.z = Math.PI;
    g.add(s);
  };
  sock(1);
  sock(-1);
  // its silkscreen: the pin count between the sockets
  const label = topDecal(w * 0.7, 1.6, 40, (c: CanvasRenderingContext2D, cw: number, ch: number) => {
    c.fillStyle = "#16171a";
    c.fillRect(0, 0, cw, ch);
    c.fillStyle = "#e9e9e4";
    c.font = `600 ${ch * 0.78}px ui-monospace, monospace`;
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText(`${n}P 0.5`, cw / 2, ch / 2);
  });
  label.position.z = CONN.pcbT + 0.01;
  g.add(label);
  return g;
}

// ------------------------------------------------------------------ a flat cable
export interface CableModel {
  group: THREE.Group;
  /** Lay it along a path (root frame points); the ribbon's width stays level, across the path. */
  setPath(pts: THREE.Vector3[]): void;
  mesh: THREE.Mesh;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildCable(kind: "f16" | "f32", M: any, maxAniso: number): CableModel {
  const n = CABLE[kind].pins;
  const w = CABLE[kind].w;
  // the conductors under the white film, faint, along its length
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 8;
  const g = c.getContext("2d")!;
  g.fillStyle = "#f3f4f4";
  g.fillRect(0, 0, 128, 8);
  g.fillStyle = "rgba(150,155,160,0.32)";
  for (let i = 0; i < n; i++) g.fillRect(((i + 0.5) / n) * 128 - 0.6, 0, 1.2, 8);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = maxAniso;
  const film = new THREE.MeshPhysicalMaterial({ map: t, roughness: 0.5, metalness: 0, clearcoat: 0.25, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(new THREE.BufferGeometry(), film);
  const tabA = new THREE.Mesh(new THREE.BufferGeometry(), M.cableTab);
  const tabB = new THREE.Mesh(new THREE.BufferGeometry(), M.cableTab);
  mesh.castShadow = tabA.castShadow = tabB.castShadow = true;
  mesh.receiveShadow = true;
  const group = new THREE.Group();
  group.add(mesh, tabA, tabB);
  const strip = (pts: THREE.Vector3[], lift: number) => {
    const pos: number[] = [];
    const uv: number[] = [];
    const idx: number[] = [];
    let v = 0;
    const up = new THREE.Vector3(0, 0, 1);
    for (let i = 0; i < pts.length; i++) {
      const a = pts[Math.max(0, i - 1)];
      const b = pts[Math.min(pts.length - 1, i + 1)];
      const tng = b.clone().sub(a).normalize();
      const side = new THREE.Vector3().crossVectors(up, tng);
      if (side.lengthSq() < 1e-6) side.set(1, 0, 0);
      side.normalize().multiplyScalar(w / 2);
      const nrm = new THREE.Vector3().crossVectors(tng, side).normalize().multiplyScalar(lift);
      if (i) v += pts[i].distanceTo(pts[i - 1]);
      const p = pts[i].clone().add(nrm);
      pos.push(p.x - side.x, p.y - side.y, p.z - side.z, p.x + side.x, p.y + side.y, p.z + side.z);
      uv.push(0, v / 12, 1, v / 12);
      if (i) {
        const k = (i - 1) * 2;
        idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    return geo;
  };
  // the first and last few mm of a path
  const part = (pts: THREE.Vector3[], fromEnd: boolean) => {
    const list = fromEnd ? [...pts].reverse() : pts;
    const out = [list[0]];
    let acc = 0;
    for (let i = 1; i < list.length && acc < CABLE.tab; i++) {
      const s = list[i].distanceTo(list[i - 1]);
      if (acc + s > CABLE.tab) {
        out.push(list[i - 1].clone().lerp(list[i], (CABLE.tab - acc) / s));
        break;
      }
      acc += s;
      out.push(list[i]);
    }
    return out;
  };
  const setPath = (pts: THREE.Vector3[]) => {
    for (const m of [mesh, tabA, tabB]) m.geometry.dispose();
    mesh.geometry = strip(pts, 0);
    tabA.geometry = strip(part(pts, false), 0.06);
    tabB.geometry = strip(part(pts, true), 0.06);
  };
  return { group, setPath, mesh };
}

// ------------------------------------------------------------------ the reading board
const B = (x: number, y: number): P2 => [x - BOARD.ox, y - BOARD.oy];
/** The reading board in its own frame (z = 0 its top face, the PCB below it), all but the Nano. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildBoard(M: any, maxAniso: number): THREE.Group {
  const g = new THREE.Group();
  const bins = new Bins();
  // the PCB: green solder mask, its silkscreen and pads on a canvas laid on top
  const K = 16;
  const c = document.createElement("canvas");
  c.width = Math.round(BOARD.w * K);
  c.height = Math.round(BOARD.d * K);
  const x = c.getContext("2d")!;
  x.setTransform(K, 0, 0, -K, 0, BOARD.d * K);
  x.fillStyle = "#1c6a3c";
  x.fillRect(0, 0, BOARD.w, BOARD.d);
  // (traces under the mask: a few plausible runs between the parts, a shade lighter)
  x.strokeStyle = "rgba(120, 200, 140, 0.18)";
  x.lineWidth = 0.3;
  const parts = Object.fromEntries(BOARD_PARTS.map((p) => [p.designator, { ...p, b: B(p.x, p.y) }]));
  const run = (pts: P2[]) => {
    x.beginPath();
    pts.forEach(([px, py], i) => (i ? x.lineTo(px, py) : x.moveTo(px, py)));
    x.stroke();
  };
  for (let i = 0; i < 8; i++) run([[18 + i * 0.6, 6 + i], [28, 6 + i], [30 + i * 0.4, 12 + i * 0.5]]);
  for (let i = 0; i < 10; i++) run([[22 + i * 1.6, 33], [22 + i * 1.6, 27], [30 + i * 1.2, 22]]);
  for (let i = 0; i < 6; i++) run([[45 + i * 1.3, 32], [46 + i * 1.3, 18], [48.7 + i * 0.6, 14]]);
  // silkscreen
  x.strokeStyle = "#f2f2ec";
  x.fillStyle = "#f2f2ec";
  x.lineWidth = 0.18;
  const sq = (cx: number, cy: number, w: number, h: number, rot = 0) => {
    x.save();
    x.translate(cx, cy);
    x.rotate((rot * Math.PI) / 180);
    x.strokeRect(-w / 2, -h / 2, w, h);
    x.restore();
  };
  const text = (s: string, tx: number, ty: number, size = 1.3, align: CanvasTextAlign = "center") => {
    x.save();
    x.translate(tx, ty);
    x.scale(1, -1);
    x.font = `600 ${size}px ui-monospace, monospace`;
    x.textAlign = align;
    x.textBaseline = "middle";
    x.fillText(s, 0, 0);
    x.restore();
  };
  for (const d of ["U2", "U3", "U4", "U5"]) {
    const p = parts[d];
    sq(p.b[0], p.b[1], 11.2, 6.2);
    text(d, p.b[0], p.b[1] + 4.2);
  }
  const mux = parts.U6;
  sq(mux.b[0], mux.b[1], 8.4, 16.2);
  text("U6", mux.b[0] - 5.6, mux.b[1]);
  text("R1", parts.R1.b[0] - 3.4, parts.R1.b[1]);
  for (const s of SOCKETS) text(s.id.toUpperCase(), s.cx, s.py - 1.6, 1.1);
  text("Tactile Reading Board 32x16 v1.0", 38, 2.2, 1.25);
  // the Nano's footprint and its pads
  const hdr = BOARD_HEADER.pins.map((p) => B(p.x, p.y));
  const [nx0, ny0, nx1, ny1] = BOARD_HEADER.nanoOutline;
  const [a0, b0] = B(nx0, ny0);
  const [a1, b1] = B(nx1, ny1);
  x.strokeRect(a0, b0, a1 - a0, b1 - b0);
  text("Arduino Nano", (a0 + a1) / 2, b0 + 1.6, 1.1);
  x.fillStyle = "#d8b25f";
  for (const [px, py] of hdr) {
    x.beginPath();
    x.arc(px, py, 0.8, 0, Math.PI * 2);
    x.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  const top = new THREE.Mesh(new THREE.PlaneGeometry(BOARD.w, BOARD.d), new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.45, clearcoat: 0.5, clearcoatRoughness: 0.3 }));
  top.position.set(BOARD.w / 2, BOARD.d / 2, 0.005);
  top.receiveShadow = true;
  g.add(top);
  const core = new THREE.Mesh(new THREE.BoxGeometry(BOARD.w, BOARD.d, BOARD.t), new THREE.MeshStandardMaterial({ color: "#1a5a34", roughness: 0.6 }));
  core.position.set(BOARD.w / 2, BOARD.d / 2, -BOARD.t / 2);
  core.castShadow = core.receiveShadow = true;
  g.add(core);
  // the chips
  const sop = { L: 10.3, W: 5.4, H: 1.75, exitH: 0.75, span: 7.8, leadW: 0.42 };
  const soic = { L: 15.4, W: 7.5, H: 2.45, exitH: 1.0, span: 10.3, leadW: 0.42 };
  const place = (p: { b: P2; rotation: number }, pins: number[][]) => {
    const r = (p.rotation * Math.PI) / 180;
    return { x: p.b[0], y: p.b[1], rot: p.rotation, pins: pins.map(([lx, ly]) => [p.b[0] + lx * Math.cos(r) - ly * Math.sin(r), p.b[1] + lx * Math.sin(r) + ly * Math.cos(r)]) };
  };
  const marks: [string, { b: P2; rotation: number }, typeof sop, string[]][] = [
    ...(["U2", "U3", "U4", "U5"].map((d) => [d, parts[d], sop, ["SN74HC595", "TI"]]) as [string, { b: P2; rotation: number }, typeof sop, string[]][]),
    ["U6", parts.U6, soic, ["CD74HC4067", "M96"]],
  ];
  for (const [, p, s, words] of marks) {
    const n = s === sop ? 16 : 24;
    const ic = icPackage(bins, M, place(p, stdPins(n, 1.27, s.span / 2 - 0.4)), s);
    const deco = topDecal(s.L - 0.6, s.W - 0.6, 30, markIC(words, { logo: s === sop }));
    deco.applyMatrix4(ic.frame.clone().multiply(T(0, 0, ic.top + 0.004)));
    g.add(deco);
  }
  chipResistor(bins, M, { x: parts.R1.b[0], y: parts.R1.b[1], rot: parts.R1.rotation }, g);
  // the two sockets, their open side at the board's far edge (toward the pad)
  for (const s of SOCKETS) {
    const w = SOCK.w(s.n);
    const y0 = s.py + 0.55;
    const y1 = y0 + SOCK.d;
    const pins = s.pins.map(([px, py]) => [px, py, 0.3, 1.2]);
    const tabs = [
      [s.cx - w / 2 - 0.6, (y0 + y1) / 2, 1.2, 2.2],
      [s.cx + w / 2 + 0.6, (y0 + y1) / 2, 1.2, 2.2],
    ];
    ffcConnector(bins, M, { pins, tabs }, { x0: s.cx - w / 2, x1: s.cx + w / 2, y0, y1, H: SOCK.h });
  }
  // the Nano's two 1 x 15 sockets
  socketRow(bins, M, hdr, { z0: 0, h: 8.5 });
  bins.build(g);
  return g;
}
