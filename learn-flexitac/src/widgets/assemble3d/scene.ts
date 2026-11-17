// Lesson 1.4's assembly bench in 3D: the parts of one FlexiTac on a blue anti-static work mat (the 2.2 bench's mat and
// studio light), the two lamination sheets taped down in the work area, the rest waiting in the parts box, the reading
// board in front. The learner turns the view (drag on empty space), zooms (wheel) and pans (right drag); the widget
// (../assemble-bench.ts) decides what a drag does, through the rules in ../assemble/engine.ts. This file draws an
// Assembly (show), moves what changed (a short glide; the top part turns face down onto the pad with a half turn), and
// answers "what is under the pointer" and "where on the mat is it".
//
// Frames: plan millimetres, x right, Y toward the viewer, z up from the mat's top. The models are built z-up with
// y = -Y (as the Gerbers and board.json are), under `root`, which turns that into three.js's y-up world.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { Theme } from "../../types";
import { Bins, makeMaterials } from "../build3d/models/kit";
import { buildNano, NANO } from "../build3d/models/nano";
import { NANO_PCB } from "../build3d/models/nano-pcb";
import { BEND, BOARD, BOARD_PORT_Z, CONN, LAYOUT, NANO_CENTRE, nanoSeat, PLUG, portOnBoard, SHEET, Z, type P2 } from "../assemble/geometry";
import { fpcAt, type Assembly, type Cable, type Grab, type Item, type Port } from "../assemble/engine";
import { buildBoard, buildCable, buildConnector, buildFpc, buildSheet, buildVelostat } from "./models";

export type P3 = [number, number, number];
export type Hit = { kind: "item"; id: Item } | { kind: "cable"; id: Cable } | { kind: "end"; id: Cable; end: "a" | "b" } | { kind: "board" };
export type View = "all" | "velostat" | "close" | "connect" | "ffc" | "cables" | "nano" | "end";

/** The mat (plan mm) and its printed scale. */
// (the start layout and a wide margin round it, so the angled views never reach its edge)
const MAT = { x0: -340, x1: 250, y0: -190, y1: 290, t: 2.2, r: 9, px: 4 };
const D2R = Math.PI / 180;
const THEMES = {
  light: { sun: 2.6, hemi: [0.75, "#ffffff", "#cfd0d3"] as const, env: 0.85, rim: 0, envBg: "#d9dadd", floor: "#3c4238", floorOp: 0.2, mat: "#33627e", matLine: "#e3f1fa", matSide: "#264b61" },
  dark: { sun: 2.6, hemi: [0.5, "#ffffff", "#3a3b3e"] as const, env: 0.85, rim: 1.4, envBg: "#d9dadd", floor: "#000000", floorOp: 0.45, mat: "#2b536b", matLine: "#cfe4f2", matSide: "#1e3d50" },
};
/** What each view frames (plan mm): the work it asks for, at the default places. */
const VIEWS: Record<View, { x0: number; x1: number; y0: number; y1: number; z1: number }> = {
  // (everything at the start: geometry.ts START)
  all: { x0: LAYOUT.x0 - 3, x1: LAYOUT.x1 + 3, y0: LAYOUT.y0 - 4, y1: LAYOUT.y1 + 3, z1: 12 },
  // (the Velostat, bottom left, and the two parts on their sheets)
  velostat: { x0: LAYOUT.x0 - 3, x1: 45, y0: LAYOUT.y0 - 4, y1: LAYOUT.y1 + 3, z1: 4 },
  // (the two parts on their sheets)
  close: { x0: -146, x1: 45, y0: -6, y1: 80, z1: 6 },
  // (the pad in front of the board, geometry.ts PAD_SPOT, its tails, and the extenders waiting bottom left)
  connect: { x0: -142, x1: 68, y0: -30, y1: 150, z1: 8 },
  // (the extenders on their tails and the two cables)
  ffc: { x0: -112, x1: 70, y0: -30, y1: 152, z1: 10 },
  // (the cables from the pad to the board, their free ends lying over it)
  cables: { x0: -26, x1: 90, y0: -30, y1: 150, z1: 12 },
  // (the Nano and the board)
  nano: { x0: -14, x1: 86, y0: 56, y1: 150, z1: 14 },
  // (everything put together: the pad, its cables and the whole board)
  end: { x0: -26, x1: 88, y0: -30, y1: 146, z1: 14 },
};

type Obj = "sheetA" | "sheetB" | "top" | "bot" | "velo" | "c16" | "c32" | "nano";
const OBJS: Obj[] = ["sheetA", "sheetB", "top", "bot", "velo", "c16", "c32", "nano"];
interface Pose {
  x: number;
  Y: number;
  z: number;
  /** turned face down (0..1, a half turn about the plan's Y axis) */
  flip: number;
  /** the Nano in the board */
  seat: number;
}

export interface AsmScene {
  canvas: HTMLCanvasElement;
  resize(w: number, h: number): void;
  setTheme(t: Theme): void;
  /** Frame a view: at an angle or from above; az turns the camera round (degrees, 0 = from the viewer's side); ms > 0
   *  flies the camera there (a drag on the view stops it). */
  home(view?: View, top?: boolean, az?: number, ms?: number): void;
  /** The point of a level plane (z mm above the mat) under a client point, in plan mm, or null. */
  planAt(cx: number, cy: number, z?: number): P2 | null;
  pick(cx: number, cy: number): Hit | null;
  toScreen(p: P3): P2 | null;
  /** Draw an assembly; `held` lifts what is in the hand; `glide` (ms) moves what changed instead of jumping. */
  show(a: Assembly, opt?: { held?: Grab | null; glide?: number }): void;
  /** A thing's box on the canvas (px). */
  boxOf(id: Item | Cable | "board"): { x: number; y: number; w: number; h: number } | null;
  /** Light the board's Nano (it has power: the whole thing is put together). */
  power(on: boolean): void;
  /** For a picture (scripts/cover-parts.mjs, the home page's chapter cover): frame a plan box from straight above with a
   *  long lens (nearly flat, like a photo of parts laid out on a desk), the sun over the box, the mat without its ruler.
   *  The view stays so until home(). */
  shoot(box: { x0: number; x1: number; y0: number; y1: number }): void;
  onChange(fn: () => void): void;
  orbit(on: boolean): void;
  moved(): boolean;
  busy(): boolean;
  stats(): { renderMs: number; calls: number; triangles: number };
  render(): void;
  dispose(): void;
}

export function createScene(host: HTMLElement, theme0: Theme): AsmScene {
  const canvas = document.createElement("canvas");
  canvas.className = "ab-canvas";
  host.append(canvas);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  const shadowsMoved = () => (renderer.shadowMap.needsUpdate = true);
  const aniso = renderer.capabilities.getMaxAnisotropy();
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 16 / 9, 10, 4000);
  let th = THEMES[theme0];

  // ------------------------------------------------------------------------------------------------ the studio
  {
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
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(env, 0.02).texture;
    pm.dispose();
  }
  // (the middle of the start layout: the sun's shadow covers it all)
  const FOCUS = new THREE.Vector3((LAYOUT.x0 + LAYOUT.x1) / 2, 0, (LAYOUT.y0 + LAYOUT.y1) / 2);
  const sun = new THREE.DirectionalLight("#ffffff", th.sun);
  sun.castShadow = true;
  sun.target.position.copy(FOCUS);
  sun.position.copy(FOCUS).addScaledVector(new THREE.Vector3(-0.9, 3.2, 1.3).normalize(), 420);
  Object.assign(sun.shadow.camera, { left: -200, right: 200, top: 190, bottom: -190, near: 200, far: 640 });
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  sun.shadow.radius = 3;
  scene.add(sun, sun.target);
  const hemi = new THREE.HemisphereLight(th.hemi[1], th.hemi[2], th.hemi[0]);
  scene.add(hemi);
  const rim = new THREE.DirectionalLight("#dfe8ff", th.rim);
  rim.target.position.copy(FOCUS);
  rim.position.copy(FOCUS).addScaledVector(new THREE.Vector3(0.6, 1.1, -1.6).normalize(), 400);
  scene.add(rim, rim.target);
  const floorMat = new THREE.ShadowMaterial({ color: th.floor, opacity: th.floorOp });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(FOCUS.x, -MAT.t - 0.02, FOCUS.z);
  floor.receiveShadow = true;
  scene.add(floor);

  const root = new THREE.Group();
  root.rotation.x = -Math.PI / 2; // (x, y = -Y, z) -> world (x, z, Y)
  scene.add(root);
  const at = (o: THREE.Object3D, x: number, Y: number, z = 0) => o.position.set(x, -Y, z);

  // ------------------------------------------------------------------------------------------------ the mat
  const matCanvas = document.createElement("canvas");
  matCanvas.width = Math.round((MAT.x1 - MAT.x0) * MAT.px);
  matCanvas.height = Math.round((MAT.y1 - MAT.y0) * MAT.px);
  const matTex = new THREE.CanvasTexture(matCanvas);
  matTex.colorSpace = THREE.SRGBColorSpace;
  matTex.anisotropy = aniso;
  matTex.repeat.set(1 / (MAT.x1 - MAT.x0), 1 / (MAT.y1 - MAT.y0));
  matTex.offset.set(-MAT.x0 / (MAT.x1 - MAT.x0), MAT.y1 / (MAT.y1 - MAT.y0));
  let bare = false;
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
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 36000; i++) {
      c.fillStyle = rnd() < 0.5 ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.06)";
      c.fillRect(rnd() * w, rnd() * h, 1.2, 1.2);
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
    const gx0 = MAT.x0 + 12;
    const gy0 = MAT.y0 + 12;
    // (the grid squared to the mat's middle)
    for (let x = Math.ceil(gx0 / 10) * 10; x <= MAT.x1 - 6; x += 10) line(x, gy0, x, MAT.y1 - 6, 0.16, x % 50 === 0 ? 0.24 : 0.12);
    for (let y = Math.ceil(gy0 / 10) * 10; y <= MAT.y1 - 6; y += 10) line(gx0, y, MAT.x1 - 6, y, 0.16, y % 50 === 0 ? 0.24 : 0.12);
    c.font = `600 ${(2.6 * k).toFixed(1)}px ui-monospace, SFMono-Regular, Menlo, monospace`;
    c.textBaseline = "middle";
    // a ruler beyond the top row and the pad's place (not in a picture: shoot())
    if (bare) {
      c.globalAlpha = 1;
      matTex.needsUpdate = true;
      return;
    }
    const RY = LAYOUT.y0 - 44;
    line(LAYOUT.x0, RY, LAYOUT.x0 + 260, RY, 0.16, 0.45);
    for (let x = LAYOUT.x0, n = 0; x <= LAYOUT.x0 + 260; x += 1, n++) {
      const tall = n % 10 === 0 ? 3.6 : n % 5 === 0 ? 2.4 : 1.4;
      line(x, RY, x, RY + tall, 0.14, 0.55);
      if (n % 10 === 0) {
        c.globalAlpha = 0.62;
        c.textAlign = "center";
        c.fillText(String(n / 10), X(x), Y(RY - 2.8));
      }
    }
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
  mat.position.z = -(MAT.t - BEV);
  mat.receiveShadow = true;
  root.add(mat);

  // ------------------------------------------------------------------------------------------------ the parts
  const M = makeMaterials();
  const tag = (o: THREE.Object3D, h: Hit) => ((o.userData.hit = h), o);
  const PICK = 2;
  const pickMat = new THREE.MeshBasicMaterial({ visible: false });
  const proxy = (b: THREE.Box3, parent: THREE.Object3D, h?: Hit) => {
    const s = b.getSize(new THREE.Vector3());
    const m = new THREE.Mesh(new THREE.BoxGeometry(s.x, s.y, Math.max(s.z, 1.2)), pickMat);
    b.getCenter(m.position);
    m.layers.set(PICK);
    if (h) tag(m, h);
    parent.add(m);
    return m;
  };
  const box3 = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) => new THREE.Box3(new THREE.Vector3(x0, y0, z0), new THREE.Vector3(x1, y1, z1));

  const groups = {} as Record<Obj, THREE.Group>;
  const holder = (id: Obj) => {
    const g = tag(new THREE.Group(), { kind: "item", id }) as THREE.Group;
    root.add(g);
    groups[id] = g;
    return g;
  };
  for (const s of ["sheetA", "sheetB"] as const) {
    const g = holder(s);
    g.add(buildSheet());
    proxy(box3(-SHEET.w / 2, -SHEET.h / 2, 0, SHEET.w / 2, SHEET.h / 2, 0.6), g);
  }
  const fpc = { top: buildFpc("top", aniso), bot: buildFpc("bot", aniso) };
  for (const f of ["top", "bot"] as const) {
    const g = holder(f);
    g.add(fpc[f].group);
    for (const b of fpc[f].hits) proxy(b, g);
  }
  {
    const g = holder("velo");
    g.add(buildVelostat());
    proxy(box3(-13, -33, 0, 13, 33, 0.6), g);
  }
  for (const c of ["c16", "c32"] as const) {
    const g = holder(c);
    g.add(buildConnector(c, M));
    g.traverse((o) => ((o as THREE.Mesh).isMesh && ((o as THREE.Mesh).castShadow = true)));
    proxy(box3(-CONN[c].w / 2 - 0.6, -CONN.d / 2, 0, CONN[c].w / 2 + 0.6, CONN.d / 2, 3), g);
  }
  // the board, fixed; its far edge toward the pad
  const board = tag(new THREE.Group(), { kind: "board" }) as THREE.Group;
  board.add(buildBoard(M, aniso));
  board.position.set(BOARD.x, -(BOARD.Y + BOARD.d), BOARD.t);
  proxy(box3(0, 0, -BOARD.t, BOARD.w, BOARD.d, 9), board);
  root.add(board);
  // the Nano, built seated in the board's frame (its sockets 8.5 mm, its header plastic 2.5 mm)
  Object.assign(NANO, { socketH: 8.5, spacerH: 2.5 });
  const nanoG = holder("nano");
  const nanoIn = new THREE.Group();
  nanoG.add(nanoIn);
  {
    const bins = new Bins();
    buildNano(NANO_PCB, M, bins, nanoIn, {});
    bins.build(nanoIn);
    nanoIn.traverse((o) => ((o as THREE.Mesh).isMesh && ((o as THREE.Mesh).castShadow = true)));
    const [x0, y0, x1, y1] = NANO_PCB.header.nano;
    proxy(box3(x0, y0, 8.5, x1, y1, 14), nanoIn);
  }
  // the Nano's power light, lit when everything is in
  const onLed = new THREE.Mesh(new THREE.CircleGeometry(1.6, 20), new THREE.MeshBasicMaterial({ color: "#7dff8a", transparent: true, opacity: 0, depthWrite: false, toneMapped: false }));
  onLed.position.set(10.58, 27.6, 8.5 + 2.5 + 1.6 + 0.7);
  nanoIn.add(onLed);
  // the cables
  const cables = { f16: buildCable("f16", M, aniso), f32: buildCable("f32", M, aniso) };
  const endProxies = {} as Record<Cable, Record<"a" | "b", THREE.Mesh>>;
  for (const c of ["f16", "f32"] as const) {
    root.add(cables[c].group);
    tag(cables[c].mesh, { kind: "cable", id: c });
    cables[c].mesh.layers.enable(PICK);
    endProxies[c] = {
      a: proxy(box3(-6, -6, -1, 6, 6, 3), root, { kind: "end", id: c, end: "a" }),
      b: proxy(box3(-6, -6, -1, 6, 6, 3), root, { kind: "end", id: c, end: "b" }),
    };
  }

  // ------------------------------------------------------------------------------------------------ poses
  /** Where every part should be for an assembly (and what is lifted, in the hand). */
  const posesOf = (a: Assembly, held: Set<Obj>): Record<Obj, Pose> => {
    const P = {} as Record<Obj, Pose>;
    const lift = (o: Obj, p: Pose): Pose => (held.has(o) ? { ...p, z: p.z + 7 } : p);
    const pose = (o: Obj, xy: P2, z: number, flip = 0, seat = 0) => (P[o] = lift(o, { x: xy[0], Y: xy[1], z, flip, seat }));
    const pad = fpcAt(a, "bot");
    for (const f of ["top", "bot"] as const) {
      const s = a.lam[f];
      if (f === "top" && a.closed) {
        pose("top", pad, Z.topFpc, 1);
        if (s) pose(s, pad, Z.topSheet + SHEET.t, 1);
      } else {
        const xy = fpcAt(a, f);
        pose(f, xy, s ? Z.fpcOnSheet : Z.fpcBare);
        if (s) pose(s, xy, Z.sheet);
      }
    }
    for (const s of ["sheetA", "sheetB"] as const) if (!P[s]) pose(s, a.pos[s], Z.sheet);
    pose("velo", a.velo ? pad : a.pos.velo, a.velo ? Z.velo : 0);
    for (const c of ["c16", "c32"] as const) pose(c, a.plugged[c] ? [pad[0] + PLUG[c].at[0], pad[1] + PLUG[c].at[1]] : a.pos[c], a.plugged[c] ? PLUG[c].z : 0);
    // (the Nano's frame is the board's: z = 0 the board's top, its sockets 8.5 mm, so a loose Nano lies 8.5 mm lower)
    pose("nano", a.nano ? nanoSeat() : a.pos.nano, a.nano ? BOARD.t : -8.5, 0, a.nano ? 1 : 0);
    return P;
  };
  /** The parts that move with what is held. */
  const members = (a: Assembly, g: Grab | null | undefined): Set<Obj> => {
    const s = new Set<Obj>();
    if (!g || g.kind !== "item") return s;
    const id = g.id;
    const padAll = () => {
      for (const o of ["top", "bot", "velo"] as Obj[]) s.add(o);
      if (a.lam.top) s.add(a.lam.top);
      if (a.lam.bot) s.add(a.lam.bot);
      if (a.plugged.c16) s.add("c16");
      if (a.plugged.c32) s.add("c32");
    };
    const part = (f: "top" | "bot") => {
      if (a.closed) return padAll();
      s.add(f);
      if (a.lam[f]) s.add(a.lam[f]!);
      if (f === "bot" && a.velo) s.add("velo");
    };
    if (id === "top" || id === "bot") part(id);
    else if (id === "sheetA" || id === "sheetB") {
      const f = a.lam.top === id ? "top" : a.lam.bot === id ? "bot" : null;
      if (f) part(f);
      else s.add(id);
    } else if (id === "velo") (a.velo ? part("bot") : s.add("velo"));
    else if (id === "c16" || id === "c32") (a.plugged[id] ? padAll() : s.add(id));
    else if (id === "nano" && !a.nano) s.add("nano");
    return s;
  };

  // the glide: each part from where it is to where it should be
  const cur = {} as Record<Obj, Pose>;
  const from = {} as Record<Obj, Pose>;
  const to = {} as Record<Obj, Pose>;
  let t0 = 0;
  let dur = 0;
  let shown: Assembly | null = null;
  let heldNow: Grab | null = null;
  let bendNow = 0;
  let bendTo = 0;
  let bendShown = -1;
  let reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const ease = (u: number) => (u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2);
  const placeObj = (o: Obj, p: Pose) => {
    const g = groups[o];
    if (o === "nano") return at(g, p.x - NANO_CENTRE[0], p.Y + NANO_CENTRE[1], p.z);
    at(g, p.x, p.Y, p.z + (p.flip > 0 && p.flip < 1 ? 26 * Math.sin(Math.PI * p.flip) : 0));
    g.rotation.set(0, Math.PI * p.flip, 0);
  };
  const lerpPose = (a: Pose, b: Pose, u: number): Pose => ({ x: a.x + (b.x - a.x) * u, Y: a.Y + (b.Y - a.Y) * u, z: a.z + (b.z - a.z) * u, flip: a.flip + (b.flip - a.flip) * u, seat: u < 1 ? a.seat : b.seat });

  // the cables: a smooth path from end to end; an end in a port leaves it straight, level with its socket
  const portPose = (p: Port): { at: P3; dir: P2 } => {
    if (p === "c16" || p === "c32") {
      const q = cur[p];
      return { at: [q.x, q.Y + CONN.d / 2 - 0.4, q.z + CONN.pcbT + 1.0], dir: [0, 1] };
    }
    const k = p === "fpc1" ? 1 : 0;
    const s = [portBoard.fpc2, portBoard.fpc1][k];
    return { at: [s[0], s[1] - 0.4, BOARD_PORT_Z], dir: [0, -1] };
  };
  const portBoard = { fpc1: portOnBoard("fpc1"), fpc2: portOnBoard("fpc2") };
  const layCables = (a: Assembly) => {
    for (const c of ["f16", "f32"] as const) {
      const ends = (["a", "b"] as const).map((e) => {
        const x = a.cable[c][e];
        if ("to" in x) return { ...portPose(x.to), port: true };
        const lifted = heldNow && heldNow.kind !== "item" && heldNow.id === c && (heldNow.kind === "cable" || heldNow.end === e);
        return { at: [x.at[0], x.at[1], lifted ? 7 : 0.12] as P3, dir: [0, 0] as P2, port: false };
      });
      const [A, Bn] = ends;
      const len = Math.hypot(Bn.at[0] - A.at[0], Bn.at[1] - A.at[1]);
      const pts: THREE.Vector3[] = [];
      const N = 48;
      // (a loose end points at the other end)
      const dirOf = (e: typeof A, o: typeof A): P2 => (e.port ? e.dir : [(o.at[0] - e.at[0]) / Math.max(1, len), (o.at[1] - e.at[1]) / Math.max(1, len)]);
      const dA = dirOf(A, Bn);
      const dB = dirOf(Bn, A);
      const k = Math.min(60, Math.max(6, len * 0.42));
      const both = A.port && Bn.port;
      const arch = both ? (c === "f32" ? 2.2 : 3.5) : A.port || Bn.port ? 1.5 : 0;
      for (let i = 0; i <= N; i++) {
        const u = i / N;
        const v = 1 - u;
        const bx = v ** 3 * A.at[0] + 3 * v * v * u * (A.at[0] + dA[0] * k) + 3 * v * u * u * (Bn.at[0] + dB[0] * k) + u ** 3 * Bn.at[0];
        const by = v ** 3 * A.at[1] + 3 * v * v * u * (A.at[1] + dA[1] * k) + 3 * v * u * u * (Bn.at[1] + dB[1] * k) + u ** 3 * Bn.at[1];
        // height: from end to end, an end in a port staying level for its first few mm, a little arch between
        const s = (w: number) => w * w * (3 - 2 * w);
        const zA = A.at[2];
        const zB = Bn.at[2];
        const z = zA + (zB - zA) * s(u) + arch * Math.sin(Math.PI * u);
        pts.push(new THREE.Vector3(bx, -by, Math.max(0.12, z)));
      }
      cables[c].setPath(pts);
      endProxies[c].a.position.set(A.at[0], -A.at[1], A.at[2]);
      endProxies[c].b.position.set(Bn.at[0], -Bn.at[1], Bn.at[2]);
      endProxies[c].a.visible = !A.port;
      endProxies[c].b.visible = !Bn.port;
    }
  };

  const apply = (now: number) => {
    if (!shown) return false;
    const u = dur > 0 ? Math.min(1, (now - t0) / dur) : 1;
    const e = ease(u);
    for (const o of OBJS) {
      // (a turn keeps its own pace: linear in angle, eased in place)
      cur[o] = from[o] && dur > 0 ? lerpPose(from[o], to[o], from[o].flip !== to[o].flip ? u : e) : to[o];
      placeObj(o, cur[o]);
    }
    // the top tail bends up over the connector once the pad is closed (after the turn)
    const bu = dur > 0 && bendTo !== bendNow ? Math.min(1, Math.max(0, (u - 0.75) / 0.25)) : 1;
    const bend = bendNow + (bendTo - bendNow) * bu;
    if (bend !== bendShown) {
      bendShown = bend;
      fpc.top.setBend(-BEND.h * bend);
    }
    if (u >= 1) bendNow = bendTo;
    layCables(shown);
    return u < 1;
  };
  const show: AsmScene["show"] = (a, opt = {}) => {
    heldNow = opt.held ?? null;
    const target = posesOf(a, members(a, heldNow));
    const glide = opt.glide ?? 0;
    for (const o of OBJS) {
      from[o] = cur[o] ? { ...cur[o] } : target[o];
      to[o] = target[o];
    }
    dur = reduce ? 0 : glide;
    // (a turn takes longer)
    if (dur && OBJS.some((o) => from[o].flip !== to[o].flip)) dur = Math.max(dur, 950);
    t0 = performance.now();
    bendTo = a.closed ? 1 : 0;
    if (!dur) bendNow = bendTo;
    shown = a;
    if (!apply(t0)) shadowsMoved();
    dirty();
  };

  // ------------------------------------------------------------------------------------------------ the camera
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.12;
  controls.maxPolarAngle = 78 * D2R;
  controls.minDistance = 60;
  controls.maxDistance = 1200;
  controls.zoomToCursor = true;
  controls.rotateSpeed = 0.55;
  controls.zoomSpeed = 0.9;
  controls.screenSpacePanning = true;
  let size = { w: 300, h: 200 };
  let framed: View = "all";
  let framedTop = false;
  let userMoved = false;
  let homing = false;
  let fly: { p0: THREE.Vector3; t0: THREE.Vector3; p1: THREE.Vector3; t1: THREE.Vector3; start: number; ms: number } | null = null;
  const home: AsmScene["home"] = (view = framed, top = false, az = 0, flyMs = 0) => {
    const from = { p: camera.position.clone(), t: controls.target.clone(), up: camera.up.clone() };
    fly = null;
    framed = view;
    framedTop = top;
    const BX = VIEWS[view];
    const el = top ? 89.5 * D2R : 58 * D2R;
    const target = new THREE.Vector3((BX.x0 + BX.x1) / 2, 0, (BX.y0 + BX.y1) / 2);
    const dir = new THREE.Vector3(Math.sin(az * D2R) * Math.cos(el), Math.sin(el), Math.cos(az * D2R) * Math.cos(el));
    camera.aspect = size.w / Math.max(1, size.h);
    camera.updateProjectionMatrix();
    const mt = 50 / size.h;
    // (room under the view for the progress bar)
    const mb = 114 / size.h;
    const ms = 12 / size.w;
    const corners: THREE.Vector3[] = [];
    for (const x of [BX.x0, BX.x1]) for (const y of [BX.y0, BX.y1]) for (const z of [0, BX.z1]) corners.push(new THREE.Vector3(x, z, y));
    const fits = (d: number) => {
      camera.position.copy(target).addScaledVector(dir, d);
      camera.up.set(0, 1, 0);
      if (top) camera.up.set(0, 0, -1);
      camera.lookAt(target);
      camera.updateMatrixWorld();
      let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
      for (const c of corners) {
        const v = c.clone().project(camera);
        x0 = Math.min(x0, v.x);
        x1 = Math.max(x1, v.x);
        y0 = Math.min(y0, v.y);
        y1 = Math.max(y1, v.y);
      }
      return { ok: !(x0 < -1 + 2 * ms || x1 > 1 - 2 * ms || y1 > 1 - 2 * mt || y0 < -1 + 2 * mb), c: [(x0 + x1) / 2, (y0 + y1) / 2 + (mb - mt)] };
    };
    let lo = 40;
    let hi = 3000;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (fits(mid).ok) hi = mid;
      else lo = mid;
    }
    const r = fits(hi);
    const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
    const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
    const hh = Math.tan((camera.fov * D2R) / 2) * hi;
    target.addScaledVector(right, r.c[0] * hh * camera.aspect).addScaledVector(up, r.c[1] * hh);
    camera.position.copy(target).addScaledVector(dir, hi);
    if (flyMs > 0 && from.up.equals(camera.up) && from.p.distanceTo(camera.position) > 0.5) {
      // (back where it was; frame() flies it over)
      fly = { p0: from.p, t0: from.t, p1: camera.position.clone(), t1: target.clone(), start: performance.now(), ms: flyMs };
      camera.position.copy(from.p);
      target.copy(from.t);
    }
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
  ray.layers.set(PICK);
  const ndc = (cx: number, cy: number) => {
    const r = canvas.getBoundingClientRect();
    return new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
  };
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const planAt: AsmScene["planAt"] = (cx, cy, z = 0) => {
    ray.setFromCamera(ndc(cx, cy), camera);
    plane.constant = -z;
    const p = new THREE.Vector3();
    if (!ray.ray.intersectPlane(plane, p)) return null;
    return [p.x, p.z];
  };
  const pick: AsmScene["pick"] = (cx, cy) => {
    ray.setFromCamera(ndc(cx, cy), camera);
    const hits = ray.intersectObjects([...Object.values(groups), board, cables.f16.group, cables.f32.group, ...Object.values(endProxies).flatMap((e) => [e.a, e.b])], true);
    for (const h of hits) {
      let o: THREE.Object3D | null = h.object;
      while (o && !o.userData.hit) o = o.parent;
      if (o && o.visible !== false) return o.userData.hit as Hit;
    }
    return null;
  };
  const toScreen: AsmScene["toScreen"] = (p) => {
    const v = new THREE.Vector3(p[0], p[2], p[1]).project(camera);
    if (v.z > 1) return null;
    return [((v.x + 1) / 2) * size.w, ((1 - v.y) / 2) * size.h];
  };
  const boxOf: AsmScene["boxOf"] = (id) => {
    const o = id === "board" ? board : id === "f16" || id === "f32" ? cables[id].group : groups[id as Obj];
    o.updateWorldMatrix(true, true);
    const b = new THREE.Box3();
    o.traverse((m) => {
      const mesh = m as THREE.Mesh;
      if (!mesh.isMesh || mesh.layers.mask === 1 << PICK || !mesh.geometry) return;
      mesh.geometry.computeBoundingBox();
      if (mesh.geometry.boundingBox) b.union(mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld));
    });
    if (b.isEmpty()) return null;
    let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
    for (const x of [b.min.x, b.max.x])
      for (const y of [b.min.y, b.max.y])
        for (const z of [b.min.z, b.max.z]) {
          const v = new THREE.Vector3(x, y, z).project(camera);
          if (v.z > 1) continue;
          const sx = ((v.x + 1) / 2) * size.w;
          const sy = ((1 - v.y) / 2) * size.h;
          x0 = Math.min(x0, sx);
          y0 = Math.min(y0, sy);
          x1 = Math.max(x1, sx);
          y1 = Math.max(y1, sy);
        }
    return Number.isFinite(x0) ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : null;
  };

  // ------------------------------------------------------------------------------------------------ drawing
  let raf = 0;
  let alive = true;
  let gliding = false;
  let settle = 0;
  let lastMs = 0;
  let changeFn: (() => void) | null = null;
  const pixelRatio = () => Math.min(1.5, window.devicePixelRatio || 1);
  const frame = (now: number) => {
    raf = 0;
    if (!alive) return;
    const flying = Boolean(fly);
    if (fly) {
      const k = Math.min(1, (now - fly.start) / fly.ms);
      const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      camera.position.lerpVectors(fly.p0, fly.p1, e);
      controls.target.lerpVectors(fly.t0, fly.t1, e);
      if (k >= 1) fly = null;
    }
    homing = flying;
    const moving = controls.update() || flying;
    homing = false;
    const wasGliding = gliding;
    gliding = apply(now);
    if (gliding || wasGliding) shadowsMoved();
    const t = performance.now();
    renderer.render(scene, camera);
    lastMs = performance.now() - t;
    changeFn?.();
    if (moving || gliding || settle > 0) {
      settle = Math.max(0, settle - 1);
      if (!raf) raf = requestAnimationFrame(frame);
    }
  };
  function dirty() {
    if (!raf && alive) raf = requestAnimationFrame(frame);
  }
  controls.addEventListener("start", () => {
    settle = 1e9;
    fly = null;
  });
  controls.addEventListener("end", () => (settle = 40));

  const resize: AsmScene["resize"] = (w, h) => {
    if (w < 2 || h < 2) return;
    size = { w, h };
    renderer.setPixelRatio(pixelRatio());
    renderer.setSize(w, h, false);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    if (!userMoved) home(framed, framedTop);
    else {
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    dirty();
  };
  const setTheme: AsmScene["setTheme"] = (t) => {
    th = THEMES[t];
    sun.intensity = th.sun;
    hemi.color.set(th.hemi[1]);
    hemi.groundColor.set(th.hemi[2]);
    hemi.intensity = th.hemi[0];
    rim.intensity = th.rim;
    floorMat.color.set(th.floor);
    floorMat.opacity = th.floorOp;
    matSide.color.set(th.matSide);
    scene.environmentIntensity = th.env;
    paintMat();
    shadowsMoved();
    dirty();
  };
  setTheme(theme0);
  const rm = matchMedia("(prefers-reduced-motion: reduce)");
  const onRm = () => (reduce = rm.matches);
  rm.addEventListener("change", onRm);

  return {
    canvas,
    resize,
    setTheme,
    home,
    planAt,
    pick,
    toScreen,
    show,
    boxOf,
    power(on) {
      (onLed.material as THREE.MeshBasicMaterial).opacity = on ? 0.95 : 0;
      dirty();
    },
    shoot(bx) {
      bare = true;
      paintMat();
      fly = null;
      const c = new THREE.Vector3((bx.x0 + bx.x1) / 2, 0, (bx.y0 + bx.y1) / 2);
      sun.target.position.copy(c);
      sun.position.copy(c).addScaledVector(new THREE.Vector3(-0.9, 3.2, 1.3).normalize(), 420);
      sun.target.updateMatrixWorld();
      camera.fov = 12;
      camera.aspect = size.w / Math.max(1, size.h);
      camera.updateProjectionMatrix();
      const half = Math.max((bx.y1 - bx.y0) / 2, (bx.x1 - bx.x0) / 2 / camera.aspect);
      const d = half / Math.tan((camera.fov * D2R) / 2);
      controls.maxDistance = Math.max(controls.maxDistance, d * 1.2);
      // (straight down but for a hair, as the "from above" view: the orbit keeps off the pole)
      const el = 89.9 * D2R;
      camera.up.set(0, 0, -1);
      camera.position.copy(c).add(new THREE.Vector3(0, Math.sin(el) * d, Math.cos(el) * d));
      camera.lookAt(c);
      controls.target.copy(c);
      homing = true;
      controls.update();
      homing = false;
      userMoved = true;
      shadowsMoved();
      dirty();
    },
    onChange(fn) {
      changeFn = fn;
    },
    orbit(on) {
      controls.enabled = on;
    },
    moved: () => userMoved,
    busy: () => gliding,
    stats: () => ({ renderMs: lastMs, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles }),
    render: dirty,
    dispose() {
      alive = false;
      cancelAnimationFrame(raf);
      rm.removeEventListener("change", onRm);
      controls.dispose();
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) {
          m.geometry?.dispose();
          for (const mt of Array.isArray(m.material) ? m.material : [m.material]) {
            for (const v of Object.values(mt)) if (v instanceof THREE.Texture) v.dispose();
            mt.dispose();
          }
        }
      });
      scene.environment?.dispose();
      renderer.dispose();
      canvas.remove();
    },
  };
}
