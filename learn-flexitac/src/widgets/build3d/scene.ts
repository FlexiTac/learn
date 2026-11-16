// Lesson 2.2's workbench in 3D (2026-11-12): the half-size breadboard on the left, the parts waiting in a neat row to
// its right, the jumper wires between holes, and under it all a blue anti-static (ESD) work mat with a printed grid and
// rulers (2026-11-15, after "this grey board is very ugly"), all drawn live with three.js from the same models the
// lesson's pictures were rendered from (./models, copied from flexitac-anatomy/figures/bench/topdown). The learner
// turns the view round the bench (drag on empty space), zooms (wheel or pinch) and pans (right drag); src/widgets/
// build-bench.ts decides what a press does and keeps the build. This file only draws and answers "what is under the
// pointer" and "where on the board is it".
//
// Frames. Plan: millimetres, x to the right along the board, Y toward the viewer (row a far, row j near), z up from the
// board's top face; the board's far left corner is (0, 0, 0). The models are built in the renders' frame (x right,
// y = -Y, z up) under `root`, which turns that frame into three.js's y-up world: plan (x, Y, z) -> world (x, z, Y).
// The parts wait on the mat, the board's height below its top (TRAY_Z); a part in the hand moves on the board's plane
// (z = 0), and planAt() takes the mat's height to tell what is over the parts' corner.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { BB, buildBreadboard, buildEnd, buildFSR, buildResistor, buildUsbPlug, END, FSR, layout, WIRE, wireMaterial } from "./models/bench";
import { Bins, makeMaterials } from "./models/kit";
import { buildNano, NANO } from "./models/nano";
import { NANO_PCB } from "./models/nano-pcb";
import type { Theme } from "../../types";
import type { HoleId, NanoPlace, PartPlace, Rot, WireColor } from "../build/engine";

export type P2 = [number, number];
export type P3 = [number, number, number];
export type PartId = "nano" | "fsr" | "resistor";
/** What a pointer can land on. */
export type Thing =
  | { kind: "part"; part: PartId; zone?: "disc" }
  | { kind: "usb" }
  | { kind: "end"; id: string; end: "a" | "b" }
  | { kind: "wire"; id: string }
  | { kind: "board" }
  | { kind: "pad" };

/** The parts' corner of the mat (plan mm): where they wait, and where one dropped goes back to its place. */
export const PAD = { x0: 89, x1: 140, y0: 0, y1: 72 };
/** Where each part waits on the mat: its anchor (the Nano's D12 pin, the FSR's and resistor's pin "1"), rot 0. */
export const TRAY: Record<PartId | "usb", P2> = { nano: [PAD.x0 + 8.5, 7], fsr: [PAD.x0 + 7.6, 31], resistor: [PAD.x0 + 24, 36.5], usb: [PAD.x0 + 21, 56] };
const BOARD_H = BB.H;
/** The mat's top: the board stands on it, the waiting parts lie on it. */
export const TRAY_Z = -BOARD_H;
/** The mat (plan mm): big enough that it fills the usual views, its edges out of sight; 2.2 mm thick, rounded corners.
 *  RULER: the printed scale's line, just beyond the board's far edge, where the views see it. */
const MAT = { x0: -120, x1: 230, y0: -150, y1: 160, t: 2.2, r: 9, px: 6 };
const RULER = { y: -21, x0: -60, x1: 186 };
const D2R = Math.PI / 180;

/** The light: the renders' studio (board-real/stage.js), cut down for a live view (no AO pass). */
const THEMES = {
  light: { sun: 2.6, hemi: [0.75, "#ffffff", "#cfd0d3"] as const, env: 0.85, rim: 0, envBg: "#d9dadd", floor: "#3c4238", floorOp: 0.2, mat: "#33627e", matLine: "#e3f1fa", matSide: "#264b61" },
  dark: { sun: 2.6, hemi: [0.5, "#ffffff", "#3a3b3e"] as const, env: 0.85, rim: 1.4, envBg: "#d9dadd", floor: "#000000", floorOp: 0.45, mat: "#2b536b", matLine: "#cfe4f2", matSide: "#1e3d50" },
};

export interface Scene3D {
  canvas: HTMLCanvasElement;
  /** The canvas's size in CSS px. */
  resize(w: number, h: number): void;
  setTheme(t: Theme): void;
  /** Frame the bench again: the board and the pad ("all") or the board alone ("board"), at an angle or from above. */
  home(top?: boolean, what?: "all" | "board"): void;
  /** The point of a level plane (the board's top, z = 0, unless z is given: TRAY_Z for the mat) under a client point, in
   *  plan mm, or null. */
  planAt(cx: number, cy: number, z?: number): P2 | null;
  /** The thing under a client point (the nearest, parts before the board). */
  pick(cx: number, cy: number): Thing | null;
  /** A plan point to canvas px (null: behind the camera). */
  toScreen(p: P3): P2 | null;
  /** A part's box top centre on screen (for the tools and the card). */
  partTop(part: PartId | "usb"): P2 | null;
  hole(id: HoleId): P2;
  /** Place the parts: on the board (a place), in the tray (null), or held (a plan anchor, lifted). */
  setPart(part: PartId, at: { place: NanoPlace | PartPlace } | { held: P2; rot: Rot; snap: NanoPlace | PartPlace | null } | null): void;
  setUsb(state: "plugged" | "tray" | "hidden"): void;
  setWires(ws: WireLook[]): void;
  /** What is painted on the board and the pad. */
  setMarks(m: Marks): void;
  setPress(level: number, on: boolean, show: boolean): void;
  setLeds(l: { on: boolean; tx: boolean }): void;
  /** The canvas px rectangle the tray's things fill (for their labels and keyboard buttons). */
  trayBox(item: PartId | "usb"): { x: number; y: number; w: number; h: number } | null;
  onChange(fn: () => void): void;
  /** Let the camera take a press on the canvas (off while a part, a wire or the sensor is in the hand). */
  orbit(on: boolean): void;
  /** Where a part waits on the pad (its anchor, plan mm). */
  trayAnchor(part: PartId): P2;
  /** The last frame's cost (for checks). */
  stats(): { renderMs: number; pixelRatio: number; calls: number; triangles: number };
  /** Did the learner turn or zoom the view since the last home()? */
  moved(): boolean;
  render(): void;
  dispose(): void;
}
export interface WireLook {
  id: string;
  a: P2;
  /** the other end: a hole's plan point; `open` when it is still in the hand (lifted) */
  b: P2;
  color: WireColor;
  index: number;
  open?: boolean;
  ghost?: boolean;
  selected?: boolean;
}
export type LitKind = "join" | "bad" | "soft";
export interface Marks {
  lit: { holes: HoleId[]; kind: LitKind }[];
  ok: HoleId[];
  bad: P2[];
  cursor: HoleId | null;
  start: HoleId | null;
  /** a soft outline round a part on the board */
  sel: PartId | null;
  /** the Hint's marks: holes to ring, pairs of holes to join with a dashed line, the Nano's place */
  coach?: { holes: HoleId[]; pairs: [HoleId, HoleId][]; nano: NanoPlace | null } | null;
}

const css = (el: Element, name: string, fallback: string) => getComputedStyle(el).getPropertyValue(name).trim() || fallback;

export function createScene(host: HTMLElement, theme0: Theme): Scene3D {
  const canvas = document.createElement("canvas");
  canvas.className = "bb-canvas";
  host.append(canvas);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  const shadowsMoved = () => (renderer.shadowMap.needsUpdate = true);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 16 / 9, 10, 3000);
  let theme = theme0;
  let th = THEMES[theme];

  // ------------------------------------------------------------------------------------------------ the studio
  {
    // the renders' soft boxes (stage.js), as an environment the metal and the clearcoats mirror
    const env = new THREE.Scene();
    env.background = new THREE.Color(th.envBg);
    const box = (w: number, h: number, pos: THREE.Vector3, k: number) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 1, 1).multiplyScalar(k), side: THREE.DoubleSide }));
      m.position.copy(pos);
      m.lookAt(0, 0, 0);
      env.add(m);
    };
    box(12, 12, new THREE.Vector3(0, 14, 2), 2.6);
    box(3, 14, new THREE.Vector3(-12, 4, 6), 3.4);
    box(3, 14, new THREE.Vector3(12, 4, -4), 2.2);
    box(18, 2, new THREE.Vector3(0, 2, 14), 1.6);
    box(22, 13, new THREE.Vector3(-9, 8, -12), 2.1);
    const g = new THREE.Mesh(new THREE.CircleGeometry(40, 32), new THREE.MeshBasicMaterial({ color: "#c9cacd", side: THREE.DoubleSide }));
    g.rotation.x = -Math.PI / 2;
    g.position.y = -2;
    env.add(g);
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(env, 0.02).texture;
    pm.dispose();
  }
  const sun = new THREE.DirectionalLight("#ffffff", th.sun);
  sun.castShadow = true;
  const SUN_DIR = new THREE.Vector3(-0.9, 3.2, 1.3).normalize();
  const FOCUS = new THREE.Vector3(68, 0, 36);
  sun.target.position.copy(FOCUS);
  sun.position.copy(FOCUS).addScaledVector(SUN_DIR, 300);
  Object.assign(sun.shadow.camera, { left: -130, right: 130, top: 110, bottom: -110, near: 150, far: 460 });
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  sun.shadow.radius = 3;
  scene.add(sun, sun.target);
  const hemi = new THREE.HemisphereLight(th.hemi[1], th.hemi[2], th.hemi[0]);
  scene.add(hemi);
  const rim = new THREE.DirectionalLight("#dfe8ff", th.rim);
  rim.target.position.copy(FOCUS);
  rim.position.copy(FOCUS).addScaledVector(new THREE.Vector3(0.6, 1.1, -1.6).normalize(), 300);
  scene.add(rim, rim.target);
  // the table: shadow only, under the board (world y = -8.5)
  const floorMat = new THREE.ShadowMaterial({ color: th.floor, opacity: th.floorOp });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(FOCUS.x, -BOARD_H - MAT.t - 0.02, FOCUS.z);
  floor.receiveShadow = true;
  scene.add(floor);

  // ------------------------------------------------------------------------------------------------ the models
  const root = new THREE.Group();
  root.rotation.x = -Math.PI / 2; // the renders' frame (x, y = -Y, z) -> world (x, z, Y)
  scene.add(root);
  const at = (o: THREE.Object3D, x: number, Y: number, z = 0) => o.position.set(x, -Y, z);
  const tag = (o: THREE.Object3D, t: Thing) => {
    o.userData.thing = t;
    return o;
  };
  const M = makeMaterials();
  M.shell = new THREE.MeshStandardMaterial({ color: "#a9adb2", roughness: 0.38, metalness: 1 });
  const L = layout(54);
  const holes = L.holes as Record<string, P2>;

  const board = tag(new THREE.Group(), { kind: "board" });
  buildBreadboard(board, renderer, L, 22);
  root.add(board);

  // the mat: a blue anti-static work mat, as on an electronics bench, printed with a 10 mm grid, rulers along two edges
  // and a dashed box where the parts wait; its grounding snap in the far right corner. The print is a canvas texture,
  // redrawn for the theme; the cap's UVs are the shape's own millimetres, mapped onto the canvas by repeat and offset.
  const matCanvas = document.createElement("canvas");
  matCanvas.width = Math.round((MAT.x1 - MAT.x0) * MAT.px);
  matCanvas.height = Math.round((MAT.y1 - MAT.y0) * MAT.px);
  const matTex = new THREE.CanvasTexture(matCanvas);
  matTex.colorSpace = THREE.SRGBColorSpace;
  matTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  matTex.repeat.set(1 / (MAT.x1 - MAT.x0), 1 / (MAT.y1 - MAT.y0));
  matTex.offset.set(-MAT.x0 / (MAT.x1 - MAT.x0), MAT.y1 / (MAT.y1 - MAT.y0));
  const paintMat = () => {
    const c = matCanvas.getContext("2d")!;
    const k = MAT.px;
    const X = (x: number) => (x - MAT.x0) * k;
    const Y = (y: number) => (y - MAT.y0) * k;
    const w = matCanvas.width;
    const h = matCanvas.height;
    c.globalAlpha = 1;
    c.fillStyle = th.mat;
    c.fillRect(0, 0, w, h);
    // (the rubber's grain: a fixed scatter of faint light and dark specks)
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 30000; i++) {
      c.fillStyle = rnd() < 0.5 ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.06)";
      c.fillRect(rnd() * w, rnd() * h, 1.3, 1.3);
    }
    c.strokeStyle = th.matLine;
    c.fillStyle = th.matLine;
    const line = (x0: number, y0: number, x1: number, y1: number, lw: number, a: number) => {
      c.globalAlpha = a;
      c.lineWidth = lw * k;
      c.beginPath();
      c.moveTo(X(x0), Y(y0));
      c.lineTo(X(x1), Y(y1));
      c.stroke();
    };
    // the grid, square to the board (its far left corner on a line), a stronger line every 50 mm
    const gx0 = MAT.x0 + 12;
    const gy0 = MAT.y0 + 12;
    for (let x = Math.ceil(gx0 / 10) * 10; x <= MAT.x1 - 6; x += 10) line(x, gy0, x, MAT.y1 - 6, 0.16, x % 50 === 0 ? 0.24 : 0.12);
    for (let y = Math.ceil(gy0 / 10) * 10; y <= MAT.y1 - 6; y += 10) line(gx0, y, MAT.x1 - 6, y, 0.16, y % 50 === 0 ? 0.24 : 0.12);
    // the scale: millimetre ticks on a line across the mat, centimetres numbered (and the same down the left edge)
    c.font = `600 ${(2.4 * k).toFixed(1)}px ui-monospace, SFMono-Regular, Menlo, monospace`;
    c.textBaseline = "middle";
    line(RULER.x0, RULER.y, RULER.x1, RULER.y, 0.16, 0.45);
    for (let x = RULER.x0, n = 0; x <= RULER.x1; x += 1, n++) {
      const tall = n % 10 === 0 ? 3.6 : n % 5 === 0 ? 2.4 : 1.4;
      line(x, RULER.y, x, RULER.y + tall, 0.14, 0.55);
      if (n % 10 === 0) {
        c.globalAlpha = 0.62;
        c.textAlign = "center";
        c.fillText(String(n / 10), X(x), Y(RULER.y - 2.6));
      }
    }
    for (let y = gy0, n = 0; y <= MAT.y1 - 8; y += 1, n++) {
      const tall = n % 10 === 0 ? 4 : n % 5 === 0 ? 2.6 : 1.5;
      line(MAT.x0 + 1.5, y, MAT.x0 + 1.5 + tall, y, 0.14, 0.55);
    }
    // the parts' corner
    c.globalAlpha = 0.42;
    c.lineWidth = 0.32 * k;
    c.setLineDash([2.2 * k, 1.4 * k]);
    c.beginPath();
    c.roundRect(X(PAD.x0 - 3), Y(PAD.y0 - 4), (PAD.x1 - PAD.x0 + 6) * k, (PAD.y1 - PAD.y0 + 8) * k, 3 * k);
    c.stroke();
    c.setLineDash([]);
    c.globalAlpha = 1;
    matTex.needsUpdate = true;
  };
  const matShape = new THREE.Shape();
  {
    const [x0, x1, y0, y1, r] = [MAT.x0, MAT.x1, -MAT.y1, -MAT.y0, MAT.r];
    matShape.moveTo(x0 + r, y0);
    matShape.lineTo(x1 - r, y0);
    matShape.quadraticCurveTo(x1, y0, x1, y0 + r);
    matShape.lineTo(x1, y1 - r);
    matShape.quadraticCurveTo(x1, y1, x1 - r, y1);
    matShape.lineTo(x0 + r, y1);
    matShape.quadraticCurveTo(x0, y1, x0, y1 - r);
    matShape.lineTo(x0, y0 + r);
    matShape.quadraticCurveTo(x0, y0, x0 + r, y0);
  }
  const BEV = 0.5;
  const matGeo = new THREE.ExtrudeGeometry(matShape, { depth: MAT.t - 2 * BEV, bevelEnabled: true, bevelThickness: BEV, bevelSize: BEV, bevelOffset: -BEV, bevelSegments: 2, curveSegments: 10 });
  const matTop = new THREE.MeshStandardMaterial({ map: matTex, roughness: 0.86, metalness: 0, envMapIntensity: 0.6 });
  const matSide = new THREE.MeshStandardMaterial({ color: th.matSide, roughness: 0.8, metalness: 0 });
  const mat = new THREE.Mesh(matGeo, [matTop, matSide]);
  mat.position.z = TRAY_Z - (MAT.t - BEV);
  mat.receiveShadow = true;
  mat.castShadow = true;
  root.add(mat);
  {
    // the grounding snap: a press stud in the mat's far right corner
    const snapMat = new THREE.MeshStandardMaterial({ color: "#c9ccd1", roughness: 0.28, metalness: 1 });
    const stud = new THREE.Mesh(new THREE.CylinderGeometry(3.1, 3.3, 1.1, 32), snapMat);
    stud.rotation.x = Math.PI / 2;
    stud.position.set(MAT.x1 - 10, -(MAT.y0 + 10), TRAY_Z + 0.55);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(1.7, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), snapMat);
    cap.rotation.x = Math.PI / 2;
    cap.position.set(MAT.x1 - 10, -(MAT.y0 + 10), TRAY_Z + 1.1);
    stud.castShadow = cap.castShadow = true;
    root.add(stud, cap);
  }

  // the Nano (as the renders seat it: on its 2.5 mm header plastic, D12 at the group's origin, USB to the left)
  Object.assign(NANO, { socketH: 0, spacerH: 2.5 });
  const nanoG = tag(new THREE.Group(), { kind: "part", part: "nano" });
  const pins = NANO_PCB.header.pins;
  const wrap = new THREE.Group();
  wrap.rotation.z = -Math.PI / 2;
  wrap.position.set(-pins[14][1], pins[14][0], 0);
  nanoG.add(wrap);
  const nanoIn = new THREE.Group();
  wrap.add(nanoIn);
  const bins = new Bins();
  const nanoBuilt = buildNano(NANO_PCB, M, bins, nanoIn, {});
  bins.build(nanoIn);
  root.add(nanoG);
  const nanoAt = (x: number, y: number): P2 => [y + wrap.position.x, -x + wrap.position.y];
  const usbO = NANO_PCB.header.usb;
  const usbXY = nanoAt((usbO[0] + usbO[2]) / 2, usbO[1]);
  // the Nano's LEDs, lit from inside: ON (power) and TX (a line sent)
  const ledMat = (c: string) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0, depthWrite: false, toneMapped: false });
  const led = (x: number, y: number, c: string) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(1.15, 1.35, 0.3), ledMat(c));
    m.position.set(x, y, nanoBuilt.zT + 0.62);
    nanoIn.add(m);
    const glow = new THREE.Mesh(new THREE.CircleGeometry(2.4, 24), ledMat(c));
    glow.position.set(x, y, nanoBuilt.zT + 0.8);
    nanoIn.add(glow);
    return [m, glow] as const;
  };
  const ledOn = led(10.58, 27.6, "#7dff8a");
  const ledTx = led(4.29, 27.6, "#ffd36b");

  // the FSR and the resistor, each in a holder group turned for rot 90 (FSR counter-clockwise, resistor clockwise)
  const fsrG = tag(new THREE.Group(), { kind: "part", part: "fsr" });
  const fsrTurn = new THREE.Group();
  fsrG.add(fsrTurn);
  const fsrBuilt = buildFSR(fsrTurn, M);
  root.add(fsrG);

  const pressMat = new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0, depthWrite: false, toneMapped: false });
  const pressRing = new THREE.Mesh(new THREE.RingGeometry(FSR.R + 0.6, FSR.R + 1.6, 64), pressMat);
  pressRing.position.set(FSR.cx, FSR.cy, FSR.cz + 0.3);
  fsrTurn.add(pressRing);
  const pressGlowMat = new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending });
  const pressGlow = new THREE.Mesh(new THREE.CircleGeometry(FSR.rActive, 64), pressGlowMat);
  pressGlow.position.set(FSR.cx, FSR.cy, FSR.cz + 0.25);
  fsrTurn.add(pressGlow);


  const resG = tag(new THREE.Group(), { kind: "part", part: "resistor" });
  const resTurn = new THREE.Group();
  resG.add(resTurn);
  buildResistor(resTurn, M);
  root.add(resG);

  // USB: plugged into the Nano (its cable leaving left to the table), and the one waiting on the pad
  const zAxis = 2.5 + 1.6 + 3.9 / 2;
  const usbPlugged = tag(new THREE.Group(), { kind: "usb" });
  buildUsbPlug(usbPlugged, M, zAxis, 170, -BOARD_H);
  root.add(usbPlugged);
  const usbTray = tag(new THREE.Group(), { kind: "usb" });
  {
    // lying on the mat, its mouth to the left as it would meet the Nano, the cable running right along the mat, off its
    // edge and out of view
    const g = new THREE.Group();
    g.rotation.z = Math.PI;
    buildUsbPlug(g, M, 3.45, 0.5, 0);
    usbTray.add(g);
    const cableMat = new THREE.MeshPhysicalMaterial({ color: "#151517", roughness: 0.46, metalness: 0, clearcoat: 0.15, clearcoatRoughness: 0.45, specularIntensity: 0.6 });
    // (in usbTray's frame: x right, y up the picture, the mouth at the origin, the plug's cable end 26 mm right of it)
    const R = 1.9;
    const xEdge = MAT.x1 - TRAY.usb[0];
    const keys: [number, number, number][] = [
      [25, 0, 3.45],
      [30, 0, 2.7],
      [35, 0.2, R],
      [xEdge - 2, 1.6, R],
      [xEdge + 1.5, 1.8, R - 0.9],
      [xEdge + 5, 2, -MAT.t + R],
      [xEdge + 160, 3, -MAT.t + R],
    ];
    const pts = keys.map(([x, y, z]) => new THREE.Vector3(x, y, z));
    const cable = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, "centripetal"), 400, R, 20, false), cableMat);
    cable.castShadow = cable.receiveShadow = true;
    usbTray.add(cable);
  }
  at(usbTray, TRAY.usb[0], TRAY.usb[1], TRAY_Z);
  root.add(usbTray);

  // a wire end (the Dupont housing), cloned for every end
  const endTpl = new THREE.Group();
  buildEnd(endTpl, M);
  const wireMats = Object.fromEntries(Object.entries(WIRE.colors as Record<WireColor, string>).map(([k, c]) => [k, wireMaterial(c)])) as unknown as Record<WireColor, THREE.Material>;
  const ghostWire = new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.55, depthWrite: false });
  const wiresG = new THREE.Group();
  root.add(wiresG);

  for (const o of [nanoG, fsrG, resG, usbPlugged, usbTray, board]) o.traverse((m) => ((m as THREE.Mesh).isMesh ? ((m as THREE.Mesh).castShadow = (m as THREE.Mesh).castShadow || o !== board) : 0));

  // ------------------------------------------------------------------------------------------------ what the pointer can hit
  // The pointer is tested against plain boxes and discs on a layer of their own (PICK), never against the detailed
  // models (the Nano alone is tens of thousands of triangles, about 6 ms a test). The camera never draws that layer.
  const PICK = 2;
  let padProxy: THREE.Object3D | null = null;
  const pickMat = new THREE.MeshBasicMaterial({ visible: false });
  const proxy = (geo: THREE.BufferGeometry, parent: THREE.Object3D, t?: Thing) => {
    const m = new THREE.Mesh(geo, pickMat);
    m.layers.set(PICK);
    if (t) tag(m, t);
    parent.add(m);
    return m;
  };
  /** A box round an object's meshes, in `frame`'s coordinates (the object at its current place in that frame). */
  const boxIn = (o: THREE.Object3D, frame: THREE.Object3D, skip?: (m: THREE.Mesh) => boolean) => {
    frame.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(frame.matrixWorld).invert();
    const b = new THREE.Box3();
    o.traverse((x) => {
      const m = x as THREE.Mesh;
      if (!m.isMesh || m.layers.mask === 1 << PICK || (skip && skip(m))) return;
      m.geometry.computeBoundingBox();
      b.union(m.geometry.boundingBox!.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld)));
    });
    return b;
  };
  const boxProxy = (b: THREE.Box3, parent: THREE.Object3D, t?: Thing, pad = 0.3) => {
    const sz = b.getSize(new THREE.Vector3()).addScalar(2 * pad);
    const m = proxy(new THREE.BoxGeometry(sz.x, sz.y, sz.z), parent, t);
    b.getCenter(m.position);
    return m;
  };
  // (the parts are built at the origin, so each box is in its own group's frame)
  boxProxy(boxIn(nanoIn, nanoG), nanoG);
  {
    // the FSR: its disc (a press lands there), its tail and its two crimps
    const disc = new THREE.CylinderGeometry(FSR.R + 0.4, FSR.R + 0.4, 1.2, 24);
    disc.rotateX(Math.PI / 2);
    proxy(disc, fsrTurn, { kind: "part", part: "fsr", zone: "disc" }).position.set(FSR.cx, FSR.cy, FSR.cz);
    const tailBox = boxIn(fsrTurn, fsrTurn, (m) => m.geometry.type === "CylinderGeometry" || m === pressRing || m === pressGlow);
    boxProxy(tailBox, fsrTurn);
  }
  boxProxy(boxIn(resTurn, resTurn), resTurn, undefined, 0.6);
  // the plug (not its cable): the shell and the overmould, 27 mm back from the port's mouth
  const plugBox = (dir: 1 | -1, zAxis: number) => new THREE.Box3(new THREE.Vector3(dir > 0 ? -28 : 0, -5.6, zAxis - 3.6), new THREE.Vector3(dir > 0 ? 0 : 28, 5.6, zAxis + 3.6));
  boxProxy(plugBox(1, 2.5 + 1.6 + 3.9 / 2), usbPlugged, undefined, 0);
  boxProxy(plugBox(-1, 3.45), usbTray, undefined, 0);
  {
    const b = new THREE.Box3(new THREE.Vector3(0, -BB.D, -BOARD_H), new THREE.Vector3(BB.W, 0, 0));
    boxProxy(b, board, undefined, 0);
    // (the parts' corner of the mat, a thin slab at its top)
    const q = new THREE.Box3(new THREE.Vector3(PAD.x0 - 3, -PAD.y1 - 4, TRAY_Z - 0.6), new THREE.Vector3(PAD.x1 + 3, -PAD.y0 + 4, TRAY_Z + 0.2));
    padProxy = boxProxy(q, root, { kind: "pad" }, 0);
  }

  // ------------------------------------------------------------------------------------------------ the paint on the board and the pad
  // one transparent plane just above the board and the pad, its canvas redrawn when the marks change
  const OV = { x0: -1, y0: -1, x1: PAD.x1 + 1, y1: PAD.y1 + 1, px: 8 };
  const ovCanvas = document.createElement("canvas");
  ovCanvas.width = Math.round((OV.x1 - OV.x0) * OV.px);
  ovCanvas.height = Math.round((OV.y1 - OV.y0) * OV.px);
  const ovCtx = ovCanvas.getContext("2d")!;
  const ovTex = new THREE.CanvasTexture(ovCanvas);
  ovTex.colorSpace = THREE.SRGBColorSpace;
  ovTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const ovMat = new THREE.MeshBasicMaterial({ map: ovTex, transparent: true, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8 });
  const ov = new THREE.Mesh(new THREE.PlaneGeometry(OV.x1 - OV.x0, OV.y1 - OV.y0), ovMat);
  at(ov, (OV.x0 + OV.x1) / 2, (OV.y0 + OV.y1) / 2, 0.04);
  ov.renderOrder = 2;
  root.add(ov);

  // ------------------------------------------------------------------------------------------------ placing
  const hole = (id: HoleId): P2 => holes[id];
  const placeNanoAt = (p: P2, lift: number) => at(nanoG, p[0], p[1], lift);
  /** A turned part's two pins in its holder's frame (x, Y), sorted as the engine names them ("1" first). */
  const partPins = (part: "fsr" | "resistor", rot: Rot): [P2, P2] => {
    const q = rot === 90 ? (part === "fsr" ? Math.PI / 2 : -Math.PI / 2) : 0;
    const raw: P2[] = part === "fsr" ? (fsrBuilt.pins as P2[]) : [[0, 0], [4 * BB.P, 0]];
    const r = raw.map(([x, y]) => [x * Math.cos(q) - y * Math.sin(q), x * Math.sin(q) + y * Math.cos(q)] as P2);
    r.sort((a, b) => (q ? b[1] - a[1] : a[0] - b[0]));
    return [
      [r[0][0], -r[0][1]],
      [r[1][0], -r[1][1]],
    ];
  };
  const setTurn = (part: "fsr" | "resistor", rot: Rot) => {
    const g = part === "fsr" ? fsrTurn : resTurn;
    g.rotation.z = rot === 90 ? (part === "fsr" ? Math.PI / 2 : -Math.PI / 2) : 0;
  };
  /** Put a part's pin "1" at plan point p (rot as given), `lift` mm up. */
  const placeAt = (part: PartId, p: P2, rot: Rot, lift: number) => {
    if (part === "nano") return placeNanoAt(p, lift);
    setTurn(part, rot);
    const [p1] = partPins(part, rot);
    at(part === "fsr" ? fsrG : resG, p[0] - p1[0], p[1] - p1[1], lift);
  };
  const anchorOf = (part: PartId, pl: NanoPlace | PartPlace): P2 => (part === "nano" ? hole(`${(pl as NanoPlace).col}${(pl as NanoPlace).row}`) : hole((pl as PartPlace).at));
  const partState: Record<PartId, "board" | "tray" | "held"> = { nano: "tray", fsr: "tray", resistor: "tray" };
  const setPart: Scene3D["setPart"] = (part, s) => {
    if (!s) {
      partState[part] = "tray";
      placeAt(part, TRAY[part], 0, TRAY_Z);
    } else if ("place" in s) {
      partState[part] = "board";
      placeAt(part, anchorOf(part, s.place), part === "nano" ? 0 : (s.place as PartPlace).rot, 0);
    } else {
      partState[part] = "held";
      if (s.snap) placeAt(part, anchorOf(part, s.snap), s.rot, 2.2);
      else placeAt(part, s.held, s.rot, 5);
    }
    shadowsMoved();
    dirty();
  };
  let usbState: "plugged" | "tray" | "hidden" = "tray";
  const setUsb: Scene3D["setUsb"] = (s) => {
    usbState = s;
    usbPlugged.visible = s === "plugged";
    usbTray.visible = s === "tray";
    if (s === "plugged") {
      // at the Nano's port, wherever the Nano is (held or placed)
      usbPlugged.position.set(nanoG.position.x + usbXY[0], nanoG.position.y + usbXY[1], nanoG.position.z);
    }
    shadowsMoved();
    dirty();
  };

  // ------------------------------------------------------------------------------------------------ wires
  // Each wire is built once and kept while its look (ends, colour, place in the nest, held, picked) stays the same, so
  // dragging one wire rebuilds that one only.
  const wireCache = new Map<string, { key: string; g: THREE.Group }>();
  const dropWire = (g: THREE.Group) => {
    wiresG.remove(g);
    g.traverse((m) => {
      if ((m as THREE.Mesh).isMesh && (m as THREE.Mesh).userData.own) (m as THREE.Mesh).geometry.dispose();
    });
  };
  const buildWire = (w: WireLook) => {
    const g = new THREE.Group();
    const zTop = END.h;
    const endAt = (p: P2, which: "a" | "b") => {
      const e = endTpl.clone(true);
      at(e, p[0], p[1], 0);
      tag(e, { kind: "end", id: w.id, end: which });
      // (the housing is a plain box to the pointer)
      proxy(endBox, e);
      g.add(e);
    };
    endAt(w.a, "a");
    if (!w.open) endAt(w.b, "b");
    const d = Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]);
    const h = 3 + Math.min(11, d * 0.13) + (w.index % 4) * 1.4;
    const zB = w.open ? zTop + 4 : zTop;
    const curve = new THREE.CubicBezierCurve3(
      new THREE.Vector3(w.a[0], -w.a[1], zTop - 0.4),
      new THREE.Vector3(w.a[0], -w.a[1], zTop + h),
      new THREE.Vector3(w.b[0], -w.b[1], zB + h),
      new THREE.Vector3(w.b[0], -w.b[1], zB - 0.4),
    );
    const seg = Math.max(20, Math.round(d * 0.7));
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, seg, WIRE.r, 10, false), w.ghost && w.open ? ghostWire : wireMats[w.color]);
    mesh.userData.own = true;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    g.add(mesh);
    // the pointer's wire: a thicker, coarser tube along the same curve (easier to hit, cheap to test)
    const hit = proxy(new THREE.TubeGeometry(curve, Math.max(12, Math.round(d * 0.25)), WIRE.r + 0.7, 6, false), g, { kind: "wire", id: w.id });
    hit.userData.own = true;
    if (w.selected) {
      const halo = new THREE.Mesh(new THREE.TubeGeometry(curve, seg, WIRE.r + 0.55, 10, false), selMat);
      halo.userData.own = true;
      g.add(halo);
    }
    return g;
  };
  const endBox = (() => {
    const b = new THREE.BoxGeometry(END.s + 0.6, END.s + 0.6, END.h + 0.4);
    b.translate(0, 0, END.h / 2);
    return b;
  })();
  const setWires: Scene3D["setWires"] = (ws) => {
    const seen = new Set<string>();
    let changed = false;
    for (const w of ws) {
      const key = JSON.stringify([w.a, w.b, w.color, w.index, Boolean(w.open), Boolean(w.ghost), Boolean(w.selected)]);
      seen.add(w.id);
      const old = wireCache.get(w.id);
      if (old && old.key === key) continue;
      if (old) dropWire(old.g);
      const g = buildWire(w);
      wiresG.add(g);
      wireCache.set(w.id, { key, g });
      changed = true;
    }
    for (const [id, c] of [...wireCache]) {
      if (seen.has(id)) continue;
      dropWire(c.g);
      wireCache.delete(id);
      changed = true;
    }
    if (changed) {
      shadowsMoved();
      dirty();
    }
  };
  const selMat = new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.35, depthWrite: false, side: THREE.BackSide, toneMapped: false });

  // ------------------------------------------------------------------------------------------------ marks
  let marks: Marks = { lit: [], ok: [], bad: [], cursor: null, start: null, sel: null };
  const colors = () => ({
    join: css(host, "--ft-hotspot", "#0f9d8a"),
    sel: css(host, "--ft-lesson", "#d06a1f"),
    bad: css(host, "--bb-bad", "#c2392f"),
    coach: css(host, "--bb-coach", "#e39a12"),
  });
  const footprint = (part: PartId | "usb"): [number, number, number, number] | null => {
    const o = part === "nano" ? nanoG : part === "fsr" ? fsrG : part === "resistor" ? resG : usbState === "tray" ? usbTray : null;
    if (!o) return null;
    o.updateWorldMatrix(true, true);
    const b = new THREE.Box3().setFromObject(o);
    if (b.isEmpty()) return null;
    // world (x, y, z) -> plan (x, z = Y)
    return [b.min.x, b.min.z, b.max.x, b.max.z];
  };
  const paintMarks = () => {
    const c = ovCtx;
    const k = OV.px;
    const X = (x: number) => (x - OV.x0) * k;
    const Y = (y: number) => (y - OV.y0) * k;
    c.clearRect(0, 0, ovCanvas.width, ovCanvas.height);
    const col = colors();
    const rr = (x: number, y: number, w: number, h: number, r: number) => {
      c.beginPath();
      c.roundRect(X(x), Y(y), w * k, h * k, r * k);
    };
    for (const grp of marks.lit) {
      const tint = grp.kind === "bad" ? col.bad : col.join;
      // one soft band along each strip, a square round every hole
      const byStrip = new Map<string, P2[]>();
      for (const id of grp.holes) {
        const p = holes[id];
        if (!p) continue;
        const key = /^(TP|TN|BP|BN)/.exec(id)?.[1] ?? `${/^\d+/.exec(id)![0]}${"abcde".includes(id.slice(-1)) ? "u" : "l"}`;
        if (!byStrip.has(key)) byStrip.set(key, []);
        byStrip.get(key)!.push(p);
      }
      for (const pts of byStrip.values()) {
        const xs = pts.map((p) => p[0]);
        const ys = pts.map((p) => p[1]);
        const [x0, y0, x1, y1] = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
        c.globalAlpha = grp.kind === "soft" ? 0.14 : 0.22;
        c.fillStyle = tint;
        rr(x0 - 1.15, y0 - 1.15, x1 - x0 + 2.3, y1 - y0 + 2.3, 1.1);
        c.fill();
        c.globalAlpha = grp.kind === "soft" ? 0.5 : 0.95;
        c.strokeStyle = tint;
        c.lineWidth = 0.32 * k;
        for (const p of pts) {
          rr(p[0] - 0.95, p[1] - 0.95, 1.9, 1.9, 0.35);
          c.stroke();
        }
      }
    }
    c.globalAlpha = 1;
    for (const id of marks.ok) {
      const p = holes[id];
      c.strokeStyle = col.join;
      c.lineWidth = 0.45 * k;
      c.beginPath();
      c.arc(X(p[0]), Y(p[1]), 1.15 * k, 0, Math.PI * 2);
      c.stroke();
    }
    for (const p of marks.bad) {
      c.strokeStyle = col.bad;
      c.lineWidth = 0.5 * k;
      c.beginPath();
      c.arc(X(p[0]), Y(p[1]), 1.35 * k, 0, Math.PI * 2);
      c.stroke();
      c.beginPath();
      c.moveTo(X(p[0] - 0.8), Y(p[1] - 0.8));
      c.lineTo(X(p[0] + 0.8), Y(p[1] + 0.8));
      c.moveTo(X(p[0] + 0.8), Y(p[1] - 0.8));
      c.lineTo(X(p[0] - 0.8), Y(p[1] + 0.8));
      c.stroke();
    }
    if (marks.start) {
      const p = holes[marks.start];
      c.fillStyle = col.sel;
      c.globalAlpha = 0.3;
      c.beginPath();
      c.arc(X(p[0]), Y(p[1]), 1.5 * k, 0, Math.PI * 2);
      c.fill();
      c.globalAlpha = 1;
      c.strokeStyle = col.sel;
      c.lineWidth = 0.4 * k;
      c.stroke();
    }
    if (marks.cursor) {
      const p = holes[marks.cursor];
      c.strokeStyle = col.sel;
      c.lineWidth = 0.42 * k;
      rr(p[0] - 1.3, p[1] - 1.3, 2.6, 2.6, 0.5);
      c.stroke();
    }
    const cm = marks.coach;
    if (cm) {
      // the Hint: a dashed line between the holes it joins, a ring round each hole, the Nano's outline
      c.strokeStyle = col.coach;
      c.fillStyle = col.coach;
      if (cm.nano) {
        const ps = cm.holes.map((id) => holes[id]).filter(Boolean);
        if (ps.length) {
          const xs = ps.map((p) => p[0]);
          const ys = ps.map((p) => p[1]);
          const [x0, y0, x1, y1] = [Math.min(...xs) - 1.9, Math.min(...ys) - 1.9, Math.max(...xs) + 1.9, Math.max(...ys) + 1.9];
          c.globalAlpha = 0.16;
          rr(x0, y0, x1 - x0, y1 - y0, 1.6);
          c.fill();
          c.globalAlpha = 0.95;
          c.lineWidth = 0.42 * k;
          c.setLineDash([1.3 * k, 0.8 * k]);
          c.stroke();
          c.setLineDash([]);
        }
      }
      for (const [a, z] of cm.pairs) {
        const p = holes[a];
        const q = holes[z];
        if (!p || !q) continue;
        c.globalAlpha = 0.95;
        c.lineWidth = 0.5 * k;
        c.lineCap = "round";
        c.setLineDash([1.1 * k, 0.9 * k]);
        c.beginPath();
        c.moveTo(X(p[0]), Y(p[1]));
        c.lineTo(X(q[0]), Y(q[1]));
        c.stroke();
        c.setLineDash([]);
      }
      for (const id of cm.holes) {
        const p = holes[id];
        if (!p) continue;
        c.globalAlpha = 0.28;
        c.beginPath();
        c.arc(X(p[0]), Y(p[1]), (cm.nano ? 1.05 : 1.6) * k, 0, Math.PI * 2);
        c.fill();
        c.globalAlpha = 1;
        c.lineWidth = (cm.nano ? 0.3 : 0.5) * k;
        c.stroke();
      }
      c.globalAlpha = 1;
    }
    if (marks.sel) {
      const f = footprint(marks.sel);
      if (f) {
        c.strokeStyle = col.sel;
        c.lineWidth = 0.4 * k;
        c.setLineDash([1.2 * k, 0.9 * k]);
        rr(f[0] - 1.6, f[1] - 1.6, f[2] - f[0] + 3.2, f[3] - f[1] + 3.2, 2);
        c.stroke();
        c.setLineDash([]);
      }
    }
    ovTex.needsUpdate = true;
  };
  let marksKey = "";
  const setMarks: Scene3D["setMarks"] = (m) => {
    // (the same marks again, as on most pointer moves, cost nothing: the canvas is only drawn and sent when they change)
    const key = JSON.stringify(m) + (m.sel ? JSON.stringify(footprint(m.sel)) : "");
    if (key === marksKey) return;
    marksKey = key;
    marks = m;
    paintMarks();
    dirty();
  };

  // ------------------------------------------------------------------------------------------------ the press, the LEDs
  let pressKey = "";
  let ledKey = "";
  const setPress: Scene3D["setPress"] = (lv, on, show) => {
    const key = `${lv.toFixed(3)}|${on}|${show}|${css(host, "--ft-signal", "")}`;
    if (key === pressKey) return;
    pressKey = key;
    const c = new THREE.Color(css(host, "--ft-signal", "#ff7a1a"));
    pressMat.color.copy(c);
    pressGlowMat.color.copy(c);
    pressMat.opacity = show ? (on ? 0.9 : 0.45) : 0;
    pressGlowMat.opacity = on ? 0.18 + 0.5 * lv : 0;
    dirty();
  };
  const setLeds: Scene3D["setLeds"] = (l) => {
    const key = `${l.on}|${l.tx}`;
    if (key === ledKey) return;
    ledKey = key;
    for (const m of ledOn) (m.material as THREE.MeshBasicMaterial).opacity = l.on ? (m === ledOn[0] ? 1 : 0.55) : 0;
    for (const m of ledTx) (m.material as THREE.MeshBasicMaterial).opacity = l.tx ? (m === ledTx[0] ? 1 : 0.5) : 0;
    dirty();
  };

  // ------------------------------------------------------------------------------------------------ the camera
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.12;
  controls.minPolarAngle = 0;
  controls.maxPolarAngle = 78 * D2R;
  controls.minDistance = 60;
  controls.maxDistance = 900;
  controls.zoomToCursor = true;
  controls.rotateSpeed = 0.55;
  controls.zoomSpeed = 0.9;
  controls.screenSpacePanning = true;
  let size = { w: 300, h: 200 };
  /** What the camera frames by default (plan mm): the board with the plug's room on its left, the pad, an FSR hanging off the near edge. */
  const BOXES = {
    all: { x0: -7, x1: PAD.x1 + 1.5, y0: -2, y1: Math.max(PAD.y1, 80), z0: -BOARD_H, z1: 12 },
    board: { x0: -9, x1: BB.W + 2, y0: -2, y1: 78, z0: -BOARD_H, z1: 14 },
  };
  let framed: "all" | "board" = "all";
  let framedTop = false;
  let userMoved = false;
  let homing = false;
  const home = (top = false, what: "all" | "board" = framed) => {
    framed = what;
    framedTop = top;
    const BOX = BOXES[what];
    const az = 0;
    const el = top ? 89.5 * D2R : 60 * D2R;
    const target = new THREE.Vector3((BOX.x0 + BOX.x1) / 2, 0, (BOX.y0 + BOX.y1) / 2 + (top ? 0 : 3));
    const dir = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
    camera.aspect = size.w / Math.max(1, size.h);
    camera.updateProjectionMatrix();
    // the distance that fits the box, with room for the bench's bars at the top and bottom
    const mt = 44 / size.h;
    const mb = 52 / size.h;
    const ms = 10 / size.w;
    const corners: THREE.Vector3[] = [];
    for (const x of [BOX.x0, BOX.x1]) for (const y of [BOX.y0, BOX.y1]) for (const z of [BOX.z0, BOX.z1]) corners.push(new THREE.Vector3(x, z, y));
    const fits = (d: number) => {
      camera.position.copy(target).addScaledVector(dir, d);
      camera.up.set(0, 1, 0);
      if (top) camera.up.set(0, 0, -1);
      camera.lookAt(target);
      camera.updateMatrixWorld();
      let ok = true;
      let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
      for (const c of corners) {
        const v = c.clone().project(camera);
        x0 = Math.min(x0, v.x);
        x1 = Math.max(x1, v.x);
        y0 = Math.min(y0, v.y);
        y1 = Math.max(y1, v.y);
      }
      if (x0 < -1 + 2 * ms || x1 > 1 - 2 * ms || y1 > 1 - 2 * mt || y0 < -1 + 2 * mb) ok = false;
      return { ok, c: [(x0 + x1) / 2, (y0 + y1) / 2 + (mb - mt)] };
    };
    let lo = 40;
    let hi = 2000;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (fits(mid).ok) hi = mid;
      else lo = mid;
    }
    // centre the box in the room left: shift the target by the projected offset
    const r = fits(hi);
    const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
    const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
    const hh = Math.tan((camera.fov * D2R) / 2) * hi;
    target.addScaledVector(right, r.c[0] * hh * camera.aspect).addScaledVector(up, r.c[1] * hh);
    camera.position.copy(target).addScaledVector(dir, hi);
    camera.lookAt(target);
    controls.target.copy(target);
    homing = true;
    controls.update();
    homing = false;
    userMoved = false;
    dirty();
  };
  controls.addEventListener("change", () => {
    if (!homing) userMoved = true;
    dirty();
  });

  // ------------------------------------------------------------------------------------------------ picking
  const ray = new THREE.Raycaster();
  const ndc = (cx: number, cy: number) => {
    const r = canvas.getBoundingClientRect();
    return new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
  };
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const planAt: Scene3D["planAt"] = (cx, cy, z = 0) => {
    ray.setFromCamera(ndc(cx, cy), camera);
    plane.constant = -z;
    const p = new THREE.Vector3();
    if (!ray.ray.intersectPlane(plane, p)) return null;
    return [p.x, p.z];
  };
  ray.layers.set(PICK);
  const pickable = [nanoG, fsrG, resG, usbPlugged, usbTray, wiresG, board, padProxy!];
  const pick: Scene3D["pick"] = (cx, cy) => {
    ray.setFromCamera(ndc(cx, cy), camera);
    const hits = ray.intersectObjects(pickable.filter((o) => o.visible), true);
    for (const h of hits) {
      let o: THREE.Object3D | null = h.object;
      while (o && !o.userData.thing) o = o.parent;
      if (o) return o.userData.thing as Thing;
    }
    return null;
  };
  const toScreen: Scene3D["toScreen"] = (p) => {
    const v = new THREE.Vector3(p[0], p[2], p[1]).project(camera);
    if (v.z > 1) return null;
    return [((v.x + 1) / 2) * size.w, ((1 - v.y) / 2) * size.h];
  };
  const boxOnScreen = (o: THREE.Object3D) => {
    o.updateWorldMatrix(true, true);
    const b = new THREE.Box3().setFromObject(o);
    if (b.isEmpty()) return null;
    let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
    for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) {
      const s = toScreen([x, z, y]);
      if (!s) continue;
      x0 = Math.min(x0, s[0]);
      y0 = Math.min(y0, s[1]);
      x1 = Math.max(x1, s[0]);
      y1 = Math.max(y1, s[1]);
    }
    return Number.isFinite(x0) ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : null;
  };
  const partTop: Scene3D["partTop"] = (part) => {
    const o = part === "nano" ? nanoG : part === "fsr" ? fsrG : part === "resistor" ? resG : usbState === "plugged" ? usbPlugged : usbTray;
    const b = boxOnScreen(o);
    return b ? [b.x + b.w / 2, b.y] : null;
  };
  const trayBox: Scene3D["trayBox"] = (item) => {
    if (item === "usb") {
      if (usbState !== "tray") return null;
      // (the plug alone, not the cable running off the mat)
      const s0 = toScreen([TRAY.usb[0] - 6, TRAY.usb[1] - 27, TRAY_Z]);
      const s1 = toScreen([TRAY.usb[0] + 6, TRAY.usb[1] + 1, TRAY_Z + 7]);
      if (!s0 || !s1) return null;
      return { x: Math.min(s0[0], s1[0]), y: Math.min(s0[1], s1[1]), w: Math.abs(s1[0] - s0[0]), h: Math.abs(s1[1] - s0[1]) };
    }
    if (partState[item] !== "tray") return null;
    return boxOnScreen(item === "nano" ? nanoG : item === "fsr" ? fsrG : resG);
  };

  // ------------------------------------------------------------------------------------------------ drawing
  // (a slow machine: the canvas drops to fewer pixels after a run of slow frames, and stays there)
  let prCap = 1.5;
  const pixelRatio = () => Math.min(prCap, window.devicePixelRatio || 1);
  let slow = 0;
  let lastMs = 0;
  let raf = 0;
  let alive = true;
  let changeFn: (() => void) | null = null;
  let settle = 0;
  let lastT = 0;
  const frame = (now: number) => {
    raf = 0;
    if (!alive) return;
    const moving = controls.update();
    const t0 = performance.now();
    renderer.render(scene, camera);
    lastMs = performance.now() - t0;
    // (frames drawn back to back while the view turns: more than 26 ms apart, a dozen times, and the canvas drops
    // a step of pixel density; the GPU's work shows in the gap between frames, not in the draw call)
    const cont = moving || settle > 0;
    if (lastT && cont) {
      if (now - lastT > 26 && pixelRatio() > 1) {
        if (++slow > 12) {
          prCap = Math.max(1, pixelRatio() - 0.25);
          slow = 0;
          renderer.setPixelRatio(pixelRatio());
          renderer.setSize(size.w, size.h, false);
        }
      } else slow = Math.max(0, slow - 1);
    }
    lastT = cont ? now : 0;
    changeFn?.();
    if (moving || settle > 0) {
      settle = Math.max(0, settle - 1);
      // (only one frame ever waits: the controls' "change" during update() may already have asked for it, and a
      // second request each frame would double the frames every frame while the view turns)
      if (!raf) raf = requestAnimationFrame(frame);
    }
  };
  function dirty() {
    if (!raf && alive) raf = requestAnimationFrame(frame);
  }
  controls.addEventListener("start", () => (settle = 1e9));
  controls.addEventListener("end", () => (settle = 40));

  const resize: Scene3D["resize"] = (w, h) => {
    if (w < 2 || h < 2) return;
    size = { w, h };
    renderer.setPixelRatio(pixelRatio());
    renderer.setSize(w, h, false);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    if (!userMoved) home(framedTop, framed);
    else {
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    dirty();
  };
  const setTheme: Scene3D["setTheme"] = (t) => {
    theme = t;
    th = THEMES[t];
    sun.intensity = th.sun;
    hemi.color.set(th.hemi[1]);
    hemi.groundColor.set(th.hemi[2]);
    hemi.intensity = th.hemi[0];
    rim.intensity = th.rim;
    floorMat.color.set(th.floor);
    floorMat.opacity = th.floorOp;
    matSide.color.set(th.matSide);
    paintMat();
    shadowsMoved();
    scene.environmentIntensity = th.env;
    paintMarks();
    dirty();
  };
  setTheme(theme);
  shadowsMoved();
  for (const p of ["nano", "fsr", "resistor"] as PartId[]) setPart(p, null);
  setUsb("tray");
  setPress(0, false, false);
  setLeds({ on: false, tx: false });

  return {
    canvas,
    resize,
    setTheme,
    home,
    stats: () => ({ renderMs: lastMs, pixelRatio: pixelRatio(), calls: renderer.info.render.calls, triangles: renderer.info.render.triangles }),
    planAt,
    pick,
    toScreen,
    partTop,
    hole,
    setPart,
    setUsb,
    setWires,
    setMarks,
    setPress,
    setLeds,
    trayBox,
    onChange(fn) {
      changeFn = fn;
    },
    moved: () => userMoved,
    orbit(on) {
      controls.enabled = on;
    },
    trayAnchor: (part) => TRAY[part],
    render: dirty,
    dispose() {
      alive = false;
      cancelAnimationFrame(raf);
      controls.dispose();
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) {
          m.geometry?.dispose();
          for (const mat of Array.isArray(m.material) ? m.material : [m.material]) {
            for (const v of Object.values(mat)) if (v instanceof THREE.Texture) v.dispose();
            mat.dispose();
          }
        }
      });
      scene.environment?.dispose();
      renderer.dispose();
      canvas.remove();
    },
  };
}
