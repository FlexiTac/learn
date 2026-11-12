// Lesson 2.2's workbench, "Build it and make it work" (PLAN-section2-build.md §2.2): the learner rebuilds lesson 2.1's
// circuit from nothing on a breadboard seen from straight above, puts the sketch together from code tiles, plugs in USB,
// uploads and presses. It fills the stage: the workbench on the left (the top-down render, a parts tray under the
// board, jumper wires drawn live), a panel on the right that changes with the step (view):
//   nano    step 1: drag the Nano onto the board (it snaps across the groove); the panel shows what is inside a board
//   parts   step 2: the FSR and the 10 kΩ resistor (each can be turned); the panel lists what is joined
//   wires   step 3: drag from a hole to a hole (or click one, then the other) to lay a jumper wire in the chosen colour;
//           a click on a wire picks it, Delete removes it; the panel says in plain words what is joined and whether the
//           wiring would work
//   sketch  step 4: the panel is the sketch builder (build-ui/sketch-ui.ts)
//   run     step 5: plug in USB, upload; the Serial Monitor (its baud rate can be changed) and Plotter come alive, and
//           the FSR can be pressed (press and hold, drag down for harder, as in lesson 2.1). Whatever is wrong fails the
//           way the engine says (../build/verdict.ts), with its line and hint, never a generic error.
// Each view has its own "Show me", which does that step (the engine's REFERENCE_BUILD and REFERENCE_SKETCH). Every
// placement, wire and verdict comes from the engine (./build/: hole ids and pin names only); build-ui/data.ts turns
// them into the render's pixels (public/media/build/build.json). The holes joined inside the board light up while
// something is held over them. Keyboard: the board takes focus; the arrow keys move between holes, Enter picks up or
// starts a wire, Delete removes, R turns, Escape cancels; the tray's parts are buttons; the tiles have their own keys.
// The learner's build, sketch and monitor rate are saved in localStorage (try/catch) and come back; Start over (and
// reset(), the steps' restart) clears them, and Undo brings them back. Code card: run() says what the current build
// does with the lesson's reference sketch; say() repeats it in the language on show.
import { tx } from "../i18n";
import { paintText } from "../i18n/paint";
import type { Theme, WidgetCtx, WidgetInstance } from "../types";
import { badge } from "../ui/bits";
import { esc } from "../ui/dom";
import { icon } from "../ui/icons";
import { forceAt, MAX_CODE } from "./bench/fsr";
import {
  addWire,
  checkNano,
  checkPart,
  checkWire,
  checkWireEnd,
  checkWiring,
  compile,
  connections,
  EMPTY_BUILD,
  holeFree,
  joinedHoles,
  MONITOR_BAUDS,
  moveWireEnd,
  nanoPins,
  netlist,
  NANO_COL_MAX,
  pinsOf,
  placeNano,
  placePart,
  plugUsb,
  recolorWire,
  REFERENCE_BUILD,
  REFERENCE_SKETCH,
  removePart,
  removeWire,
  ROWS,
  run,
  runner,
  circuit,
  say,
  stripHoles,
  stripOf,
  validBuild,
  whatIsAt,
  WIRE_COLORS,
  type Build,
  type HoleId,
  type NanoPlace,
  type NanoRow,
  type Occupant,
  type PartKind,
  type PartPlace,
  type Program,
  type Rot,
  type Runner,
  type Sketch,
  type Symptom,
  type Text,
  type Verdict,
  type WireColor,
  F_PRESS,
} from "./build/engine";
import { BASE, FRAME, geometry, loadData, partAt, TRAY_BAND, TRAY_SCALE, USB_TRAY_CROP, type BuildData, type Geometry, type Placed, type Pt } from "./build-ui/data";
import { emptyState, sketchOf, sketchUi, stateOf, validState, type SketchState } from "./build-ui/sketch-ui";
import { wireLayers, wirePaths, type WireLook } from "./build-ui/wires";
import { S } from "./build-ui/words";
import "./build-bench.css";

export type View = "nano" | "parts" | "wires" | "sketch" | "run";
const VIEWS: View[] = ["nano", "parts", "wires", "sketch", "run"];
const BUILD_VIEWS = new Set<View>(["nano", "parts", "wires"]);
/** The problems steps 1 and 2 show: what placing a part can get wrong (or wires laid early). */
const PLACE = new Set<string>(["fsr-bypassed", "resistor-bypassed", "short", "reset-held"]);
const KEY = "learn-flexitac:build-bench:v1";
type Part = "nano" | PartKind;
const PARTS: Part[] = ["nano", "fsr", "resistor"];
const WINDOW_MS = 10000; // the plotter's span
const NOTE_MS = 5200;
const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
const T = (t: Text) => tx(t.en, t.zh);
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

interface Saved {
  v: 1;
  build: Build;
  sketch: SketchState;
  monitorBaud: number;
  color: WireColor;
  uploaded: Sketch | null;
}

export function mount(el: HTMLElement, ctx: WidgetCtx): WidgetInstance {
  const reduced = ctx.reducedMotion();
  const root = document.createElement("div");
  root.className = "w-bb";
  root.dataset.view = "nano";
  root.setAttribute("role", "group");
  root.dataset.tAria = "aria";
  root.classList.toggle("is-reduced", reduced);
  root.innerHTML = `
    <div class="bb-stage" tabindex="0" role="application" data-t-aria="stageAria">
      <div class="bb-cam">
        <img class="bb-img bb-board" alt="" decoding="async" draggable="false">
        <div class="bb-tray"></div>
        <img class="bb-img bb-tray-item" data-item="nano" alt="" draggable="false">
        <img class="bb-img bb-tray-item" data-item="fsr" alt="" draggable="false">
        <img class="bb-img bb-tray-item" data-item="resistor" alt="" draggable="false">
        <div class="bb-tray-usb" data-item="usb"><img class="bb-img" alt="" draggable="false"></div>
        <svg class="bb-lit" aria-hidden="true"></svg>
        <img class="bb-img bb-part" data-part="nano" alt="" draggable="false">
        <img class="bb-img bb-part" data-part="resistor" alt="" draggable="false">
        <img class="bb-img bb-part" data-part="fsr" alt="" draggable="false">
        <img class="bb-img bb-plug" alt="" draggable="false">
        <svg class="bb-ov" aria-hidden="true">
          <defs>
            <filter id="bb-soft" filterUnits="userSpaceOnUse" x="-400" y="-300" width="3600" height="2600"><feGaussianBlur stdDeviation="13"/></filter>
            <radialGradient id="bb-press-grad"><stop offset="0" stop-color="var(--ft-signal)" stop-opacity=".75"/><stop offset=".7" stop-color="var(--ft-signal)" stop-opacity=".28"/><stop offset="1" stop-color="var(--ft-signal)" stop-opacity="0"/></radialGradient>
          </defs>
          <g class="bb-press"><circle class="bb-press-glow" fill="url(#bb-press-grad)"/><circle class="bb-press-ring"/></g>
          <g class="bb-shadows" filter="url(#bb-soft)"></g>
          <g class="bb-ends"></g>
          <g class="bb-bodies"></g>
          <g class="bb-marks"></g>
        </svg>
        <img class="bb-img bb-ghost" alt="" draggable="false">
        <img class="bb-img bb-float" alt="" draggable="false">
      </div>
      <div class="bb-keys"></div>
      <div class="bb-chip mono" aria-hidden="true"></div>
      <div class="bb-tools"></div>
      <p class="bb-kicker mono" data-t="kicker"></p>
      <div class="bb-corner">
        <button type="button" class="bb-icon-btn" data-act="undo" data-t-aria="undo" data-t-title="undo"><svg class="icon bb-undo-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M5.5 2 2.5 5l3 3"/><path d="M2.5 5h7a4 4 0 0 1 0 8H7"/></svg></button>
        <button type="button" class="bb-text-btn mono" data-act="clear" data-t="reset" data-t-aria="reset.aria"></button>
      </div>
      <div class="bb-note" role="status"></div>
      <div class="bb-foot">
        <div class="bb-palette" role="radiogroup" data-t-aria="palette"></div>
        <p class="bb-hint mono"></p>
        <button type="button" class="bb-show mono"><span class="bb-show-icon">${icon("play")}</span><span data-t="showMe"></span></button>
      </div>
    </div>
    <aside class="bb-panel">
      <section class="bb-sec bb-inside">
        <p class="bb-cap mono" data-t="inside.cap"></p>
        <div class="bb-inside-fig"></div>
        <p class="bb-small" data-t="inside.note"></p>
      </section>
      <section class="bb-sec bb-conn">
        <p class="bb-cap mono" data-t="conn.cap"></p>
        <ol class="bb-conn-list mono"></ol>
      </section>
      <section class="bb-sec bb-check" aria-live="polite"></section>
      <section class="bb-sec bb-sketch">
        <div class="bb-sketch-head"><p class="bb-cap mono" data-t="sketch.cap"></p><button type="button" class="bb-pill mono" data-act="verify" data-t-aria="verify.aria"><span>${icon("check")}</span><span data-t="verify"></span></button></div>
        <div class="bb-sketch-host"></div>
        <div class="bb-vout" aria-live="polite"></div>
      </section>
      <section class="bb-sec bb-run">
        <div class="bb-run-bar">
          <button type="button" class="bb-pill mono bb-usb-btn" data-act="usb" data-t-aria="usb.aria"><span>${icon("usb")}</span><span class="bb-usb-label"></span></button>
          <button type="button" class="bb-upload mono" data-act="upload"><span>${icon("chevron")}</span><span data-t="upload"></span></button>
        </div>
        <div class="bb-status" aria-live="polite"></div>
        <div class="bb-press-row"><span class="bb-lab" data-t="press"></span><input type="range" min="0" max="100" step="1" value="0" data-t-aria="slider.aria"></div>
        <div class="bb-mon">
          <div class="bb-mon-head"><p class="bb-cap mono" data-t="monitor"></p><label class="bb-baud mono"><select data-t-aria="baud.aria">${MONITOR_BAUDS.map((b) => `<option value="${b}">${b} baud</option>`).join("")}</select></label></div>
          <ol class="bb-mon-box mono"></ol>
        </div>
        <div class="bb-plot"><p class="bb-cap mono" data-t="plotter"></p><div class="bb-plot-box"><span class="bb-ax bb-ax-hi mono">${MAX_CODE}</span><span class="bb-ax bb-ax-lo mono">0</span><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path class="bb-grid" d="M0,0.5H100M0,50H100M0,99.5H100"/><polyline class="bb-trace" points=""/></svg></div></div>
      </section>
    </aside>
    <p class="bb-live" aria-live="polite"></p>`;
  el.append(root);
  const $ = <E extends Element>(sel: string) => root.querySelector<E>(sel)!;
  const stage = $<HTMLElement>(".bb-stage");
  const cam = $<HTMLElement>(".bb-cam");
  const boardImg = $<HTMLImageElement>(".bb-board");
  const trayEl = $<HTMLElement>(".bb-tray");
  const trayImgs = { nano: $<HTMLImageElement>('.bb-tray-item[data-item="nano"]'), fsr: $<HTMLImageElement>('.bb-tray-item[data-item="fsr"]'), resistor: $<HTMLImageElement>('.bb-tray-item[data-item="resistor"]') };
  const trayUsb = $<HTMLElement>(".bb-tray-usb");
  const trayUsbImg = trayUsb.querySelector("img")!;
  const litSvg = $<SVGSVGElement>(".bb-lit");
  const partImgs = { nano: $<HTMLImageElement>('.bb-part[data-part="nano"]'), fsr: $<HTMLImageElement>('.bb-part[data-part="fsr"]'), resistor: $<HTMLImageElement>('.bb-part[data-part="resistor"]') };
  const plugImg = $<HTMLImageElement>(".bb-plug");
  const ov = $<SVGSVGElement>(".bb-ov");
  const gShadows = $<SVGGElement>(".bb-shadows");
  const gEnds = $<SVGGElement>(".bb-ends");
  const gBodies = $<SVGGElement>(".bb-bodies");
  const gMarks = $<SVGGElement>(".bb-marks");
  const pressGlow = $<SVGCircleElement>(".bb-press-glow");
  const pressRing = $<SVGCircleElement>(".bb-press-ring");
  const ghostImg = $<HTMLImageElement>(".bb-ghost");
  const floatImg = $<HTMLImageElement>(".bb-float");
  const keysEl = $<HTMLElement>(".bb-keys");
  const chip = $<HTMLElement>(".bb-chip");
  const tools = $<HTMLElement>(".bb-tools");
  const noteEl = $<HTMLElement>(".bb-note");
  const hintEl = $<HTMLElement>(".bb-hint");
  const palette = $<HTMLElement>(".bb-palette");
  const showBtn = $<HTMLButtonElement>(".bb-show");
  const liveEl = $<HTMLElement>(".bb-live");
  const connList = $<HTMLOListElement>(".bb-conn-list");
  const checkEl = $<HTMLElement>(".bb-check");
  const voutEl = $<HTMLElement>(".bb-vout");
  const statusEl = $<HTMLElement>(".bb-status");
  const usbLabel = $<HTMLElement>(".bb-usb-label");
  const uploadBtn = $<HTMLButtonElement>(".bb-upload");
  const baudSel = $<HTMLSelectElement>(".bb-baud select");
  const monBox = $<HTMLOListElement>(".bb-mon-box");
  const trace = $<SVGPolylineElement>(".bb-trace");
  const slider = $<HTMLInputElement>(".bb-press-row input");

  let data: BuildData | null = null;
  let g: Geometry | null = null;
  let theme: Theme = ctx.theme();
  let view: View = "nano";
  let alive = true;

  // ---------------------------------------------------------------------------------------- state (saved)
  let build: Build = EMPTY_BUILD;
  let sk: SketchState = emptyState();
  let monitorBaud = 9600;
  let color: WireColor = "red";
  /** the sketch on the Nano (it stays there when USB is unplugged, as in its flash memory) */
  let uploaded: Sketch | null = null;
  const save = () => {
    try {
      const s: Saved = { v: 1, build, sketch: sk, monitorBaud, color, uploaded };
      localStorage.setItem(KEY, JSON.stringify(s));
    } catch {
      /* private window or storage blocked: the build lives only on this page */
    }
  };
  const validSketch = (s: unknown): s is Sketch => {
    if (!s || typeof s !== "object") return false;
    const x = s as Sketch;
    if (!Array.isArray(x.setup) || !Array.isArray(x.loop)) return false;
    const st = stateOf(x);
    return validState(st);
  };
  const restore = () => {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return;
      const s = JSON.parse(raw) as Partial<Saved>;
      if (s.v !== 1) return;
      if (s.build && typeof s.build === "object" && Array.isArray(s.build.wires) && validBuild(s.build)) build = { ...EMPTY_BUILD, ...s.build };
      if (validState(s.sketch)) sk = s.sketch;
      if (typeof s.monitorBaud === "number" && (MONITOR_BAUDS as readonly number[]).includes(s.monitorBaud)) monitorBaud = s.monitorBaud;
      if (s.color && (WIRE_COLORS as readonly string[]).includes(s.color)) color = s.color;
      if (s.uploaded && validSketch(s.uploaded)) uploaded = s.uploaded;
    } catch {
      /* nothing saved, or storage blocked */
    }
  };
  restore();

  // undo: every edit returns a new build, so a list of snapshots is enough
  const history: { build: Build; sk: SketchState }[] = [];
  let lastField = { key: "", t: 0 };
  const remember = (fieldKey?: string) => {
    const now = performance.now();
    if (fieldKey && fieldKey === lastField.key && now - lastField.t < 2000) {
      lastField.t = now;
      return;
    }
    lastField = { key: fieldKey ?? "", t: now };
    history.push({ build, sk });
    if (history.length > 80) history.shift();
    paintCorner();
  };

  // ---------------------------------------------------------------------------------------- words
  const W = () => S();
  const announce = (text: string) => {
    liveEl.textContent = "";
    // (a fresh node each time, so the same words are read again)
    window.setTimeout(() => (liveEl.textContent = text), 30);
  };
  const partName = (p: Part | "usb") => W()[p];

  // ---------------------------------------------------------------------------------------- the camera
  let size = { w: 0, h: 0 };
  let camK = 0.3;
  let camO: Pt = [0, 0];
  const panelW = (v: View = view) => {
    const w = size.w;
    if (v === "sketch") return Math.round(clamp(w * 0.4, 330, 440));
    if (v === "run") return Math.round(clamp(w * 0.31, 262, 340));
    return Math.round(clamp(w * 0.27, 238, 300));
  };
  const narrow = () => size.w < 620;
  const TOP = 34;
  const BOTTOM = 48;
  const fitCam = (v: View = view) => {
    const aw = narrow() ? size.w : size.w - panelW(v);
    const ah = narrow() ? stage.clientHeight : size.h;
    const [x0, y0, x1, y1] = FRAME;
    const k = Math.max(0.05, Math.min((aw - 24) / (x1 - x0), (ah - TOP - BOTTOM) / (y1 - y0)));
    camK = k;
    camO = [aw / 2 - ((x0 + x1) / 2) * k, TOP + (ah - TOP - BOTTOM) / 2 - ((y0 + y1) / 2) * k];
    cam.style.transform = `translate(${camO[0].toFixed(2)}px, ${camO[1].toFixed(2)}px) scale(${k.toFixed(5)})`;
    root.style.setProperty("--bb-k", k.toFixed(4));
  };
  const toScreen = (p: Pt): Pt => [camO[0] + p[0] * camK, camO[1] + p[1] * camK];
  const toScene = (e: { clientX: number; clientY: number }): Pt => {
    const r = stage.getBoundingClientRect();
    return [(e.clientX - r.left - camO[0]) / camK, (e.clientY - r.top - camO[1]) / camK];
  };

  // ---------------------------------------------------------------------------------------- pictures
  const src = (p: string) => BASE + p;
  const place = (img: HTMLElement, b: Placed, scale = 1) => {
    img.style.left = `${b.left}px`;
    img.style.top = `${b.top}px`;
    img.style.width = `${b.w * scale}px`;
    img.style.height = `${b.h * scale}px`;
  };
  const partSrc = (p: Part, rot: Rot) => {
    const d = data!;
    if (p === "nano") return src(d.parts.nano.src[theme]);
    const pic = g!.partPic(p, rot);
    return src(pic.src[theme]);
  };
  const setSrc = (img: HTMLImageElement, s: string) => {
    if (img.getAttribute("src") !== s) img.src = s;
  };
  const loadPics = (t: Theme) => {
    if (!data) return;
    const d = data;
    // decode the new set first, so a theme switch never shows a blank frame
    const all = [d.board.src[t], d.parts.nano.src[t], d.parts.usbPlug.src[t], d.parts.fsr.rot0.src[t], d.parts.fsr.rot90.src[t], d.parts.resistor.rot0.src[t], d.parts.resistor.rot90.src[t], d.wire.endSrc[t]];
    void Promise.all(
      all.map((s) => {
        const im = new Image();
        im.src = src(s);
        return im.decode().catch(() => undefined);
      }),
    ).then(() => {
      if (!alive || theme !== t) return;
      setSrc(boardImg, src(d.board.src[t]));
      place(boardImg, { left: 0, top: 0, w: d.board.size[0], h: d.board.size[1] });
      paintAll();
      root.classList.add("is-ready");
    });
  };

  // ---------------------------------------------------------------------------------------- the tray
  /** Where each part not on the board sits in the tray (scene px, its picture at TRAY_SCALE). */
  const trayPlaces = (): Partial<Record<Part | "usb", Placed>> => {
    const d = data!;
    const [x0, y0, , y1] = TRAY_BAND;
    const items: { id: Part | "usb"; w: number; h: number }[] = [];
    if (!build.nano) items.push({ id: "nano", w: d.parts.nano.size[0], h: d.parts.nano.size[1] });
    if (!build.fsr) items.push({ id: "fsr", w: d.parts.fsr.rot0.size[0], h: d.parts.fsr.rot0.size[1] });
    if (!build.resistor) items.push({ id: "resistor", w: d.parts.resistor.rot0.size[0], h: d.parts.resistor.rot0.size[1] });
    if (!build.usb) items.push({ id: "usb", w: USB_TRAY_CROP, h: d.parts.usbPlug.size[1] });
    // (an FSR whose disc hangs into the tray keeps that stretch clear)
    let block: [number, number] | null = null;
    if (build.fsr) {
      const b = g!.partBox("fsr", build.fsr);
      if (b.top + b.h > y0 + 30) block = [b.left - 40, b.left + b.w + 40];
    }
    const out: Partial<Record<Part | "usb", Placed>> = {};
    let x = x0 + 70;
    for (const it of items) {
      const w = it.w * TRAY_SCALE;
      const h = it.h * TRAY_SCALE;
      if (block && x + w > block[0] && x < block[1]) x = block[1];
      out[it.id] = { left: x, top: y0 + (y1 - y0 - h) / 2, w: it.w, h: it.h };
      x += w + 110;
    }
    return out;
  };
  let tray: Partial<Record<Part | "usb", Placed>> = {};
  const paintTray = () => {
    if (!data) return;
    const d = data;
    tray = trayPlaces();
    const [x0, y0, x1, y1] = TRAY_BAND;
    trayEl.style.left = `${x0}px`;
    trayEl.style.top = `${y0}px`;
    trayEl.style.width = `${x1 - x0}px`;
    trayEl.style.height = `${y1 - y0}px`;
    trayEl.classList.toggle("is-empty", !Object.keys(tray).length);
    for (const p of PARTS) {
      const img = trayImgs[p];
      const at = tray[p];
      const held = drag?.kind === "part" && drag.part === p && drag.from === "tray" && drag.on;
      img.hidden = !at || held || carry?.part === p;
      if (!at) continue;
      setSrc(img, partSrc(p, 0));
      place(img, at, TRAY_SCALE);
    }
    const u = tray.usb;
    trayUsb.hidden = !u;
    if (u) {
      trayUsb.style.left = `${u.left}px`;
      trayUsb.style.top = `${u.top}px`;
      trayUsb.style.width = `${u.w * TRAY_SCALE}px`;
      trayUsb.style.height = `${u.h * TRAY_SCALE}px`;
      setSrc(trayUsbImg, src(d.parts.usbPlug.src[theme]));
      trayUsbImg.style.width = `${d.parts.usbPlug.size[0] * TRAY_SCALE}px`;
      trayUsbImg.style.height = `${d.parts.usbPlug.size[1] * TRAY_SCALE}px`;
      trayUsbImg.style.left = `${-(d.parts.usbPlug.size[0] - USB_TRAY_CROP) * TRAY_SCALE}px`;
    }
  };
  const inTray = (p: Pt): Part | "usb" | null => {
    for (const [id, b] of Object.entries(tray) as [Part | "usb", Placed][]) {
      if (p[0] >= b.left - 10 && p[0] <= b.left + b.w * TRAY_SCALE + 10 && p[1] >= b.top - 10 && p[1] <= b.top + b.h * TRAY_SCALE + 10) return id;
    }
    return null;
  };
  const overTray = (p: Pt) => p[0] >= TRAY_BAND[0] && p[0] <= TRAY_BAND[2] && p[1] >= TRAY_BAND[1] - 10 && p[1] <= TRAY_BAND[3] + 20;

  // ---------------------------------------------------------------------------------------- the parts on the board
  const paintParts = () => {
    if (!data || !g) return;
    for (const p of PARTS) {
      const img = partImgs[p];
      const pl = build[p];
      const moving = (drag?.kind === "part" && drag.part === p && drag.from === "board" && drag.on) || (carry?.part === p && carry.from === "board");
      img.hidden = !pl || moving;
      if (!pl) continue;
      if (p === "nano") {
        setSrc(img, partSrc("nano", 0));
        place(img, g.nanoBox(pl as NanoPlace));
      } else {
        const pp = pl as PartPlace;
        setSrc(img, partSrc(p, pp.rot));
        place(img, g.partBox(p, pp));
      }
      img.classList.toggle("is-selected", sel?.kind === "part" && sel.part === p);
    }
    const nanoMoving = drag?.kind === "part" && drag.part === "nano" && drag.from === "board" && drag.on;
    plugImg.hidden = !build.nano || !build.usb || nanoMoving || (carry?.part === "nano" && carry.from === "board");
    if (build.nano && build.usb) {
      setSrc(plugImg, src(data.parts.usbPlug.src[theme]));
      place(plugImg, g.usbBox(build.nano));
    }
  };

  // ---------------------------------------------------------------------------------------- wires
  type Sel = { kind: "wire"; id: string } | { kind: "part"; part: Part } | null;
  let sel: Sel = null;
  let pending: HoleId | null = null; // a wire started by a click, waiting for its other end
  let pointerScene: Pt | null = null;
  const paintWires = () => {
    if (!data || !g) return;
    const looks: WireLook[] = [];
    build.wires.forEach((w, i) => {
      const moving = drag?.kind === "end" && drag.on && drag.id === w.id;
      const kmove = carry?.kind === "end" && carry.id === w.id;
      if (moving || kmove) {
        const fixedEnd = (drag?.kind === "end" ? drag.end : carry!.end) === "a" ? w.b : w.a;
        const to = drag?.kind === "end" ? (drag.snap ? g!.hole(drag.snap) : drag.to) : g!.hole(carry!.hole!);
        const open = drag?.kind === "end" ? !drag.snap : false;
        looks.push({ id: w.id, a: g!.hole(fixedEnd), b: to, color: w.color, index: i, open, ghost: true, selected: true });
        return;
      }
      looks.push({ id: w.id, a: g!.hole(w.a), b: g!.hole(w.b), color: w.color, index: i, selected: sel?.kind === "wire" && sel.id === w.id });
    });
    // a wire being laid: from its first hole to the pointer (or the hole it would go in)
    const from = drag?.kind === "wire" && drag.on ? drag.from : pending;
    if (from) {
      const snap = drag?.kind === "wire" ? drag.snap : hoverHole && hoverHole !== pending && holeFree(build, hoverHole).ok ? hoverHole : null;
      const to = snap ? g.hole(snap) : drag?.kind === "wire" ? drag.to : (pointerScene ?? kbdTarget());
      if (to) looks.push({ id: "new", a: g.hole(from), b: to, color, index: build.wires.length, open: !snap, ghost: true });
    }
    const L = wireLayers(data, theme, src, looks);
    gShadows.innerHTML = L.shadows;
    gEnds.innerHTML = L.ends;
    gBodies.innerHTML = L.bodies;
    // (a wire's shadow is a long thin band: lighter than a part's, so it never reads as a second wire or a smear)
    gShadows.style.opacity = String(data.light.partShadow[theme] * 0.5);
  };
  const kbdTarget = (): Pt | null => (kbd && pending && cursor !== pending ? g!.hole(cursor) : null);

  // ---------------------------------------------------------------------------------------- holes lit up
  type LitKind = "join" | "bad" | "soft";
  let litGroups: { holes: HoleId[]; kind: LitKind }[] = [];
  let litKey = "";
  const paintLit = () => {
    if (!g) return;
    const key = JSON.stringify(litGroups);
    if (key === litKey) return;
    litKey = key;
    let out = "";
    for (const grp of litGroups) {
      // one soft capsule along each strip, a ring on every hole
      const byStrip = new Map<string, HoleId[]>();
      for (const h of grp.holes) {
        const s = stripOf(h);
        if (!s) continue;
        if (!byStrip.has(s)) byStrip.set(s, []);
        byStrip.get(s)!.push(h);
      }
      for (const hs of byStrip.values()) {
        const pts = hs.map((h) => g!.hole(h));
        const xs = pts.map((p) => p[0]);
        const ys = pts.map((p) => p[1]);
        const [ax, ay, bx, by] = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
        out += `<path class="bb-lit-strip is-${grp.kind}" d="M${ax},${ay}L${bx},${by}"/>`;
        for (const p of pts) out += `<rect class="bb-lit-hole is-${grp.kind}" x="${p[0] - 15}" y="${p[1] - 15}" width="30" height="30" rx="7"/>`;
      }
    }
    litSvg.innerHTML = out;
  };
  const setLit = (groups: { holes: HoleId[]; kind: LitKind }[]) => {
    litGroups = groups;
    paintLit();
  };

  // ---------------------------------------------------------------------------------------- marks (pins of a part held over the board, the keyboard's hole)
  let markHtml = "";
  /** A part's outline for the pick (scene px): the Nano's board, the FSR's legs to its disc, the resistor's legs. */
  const selBox = (p: Part, pl: NanoPlace | PartPlace, b: Placed): [number, number, number, number] => {
    const d = data!;
    if (p === "nano") {
      const [x0, y0, x1, y1] = d.parts.nano.pcb;
      return [b.left + x0 - 14, b.top + y0 - 14, b.left + x1 + 14, b.top + y1 + 14];
    }
    const pic = g!.partPic(p, (pl as PartPlace).rot);
    const [a, z] = [pic.pins["1"], pic.pins["2"]];
    if (p === "fsr") {
      const disc = g!.fsrDisc(pl as PartPlace);
      const xs = [b.left + a[0], b.left + z[0], disc.c[0] - disc.r, disc.c[0] + disc.r];
      const ys = [b.top + a[1], b.top + z[1], disc.c[1] - disc.r, disc.c[1] + disc.r];
      return [Math.min(...xs) - 16, Math.min(...ys) - 22, Math.max(...xs) + 16, Math.max(...ys) + 16];
    }
    return [b.left + Math.min(a[0], z[0]) - 26, b.top + Math.min(a[1], z[1]) - 30, b.left + Math.max(a[0], z[0]) + 26, b.top + Math.max(a[1], z[1]) + 30];
  };
  const paintMarks = () => {
    if (!g) return;
    let out = markHtml;
    // the part picked: a quiet outline round it
    if (sel?.kind === "part" && build[sel.part] && !(drag?.kind === "part" && drag.on) && !carry) {
      const pl = build[sel.part]!;
      const b = sel.part === "nano" ? g.nanoBox(pl as NanoPlace) : g.partBox(sel.part, pl as PartPlace);
      const [x0, y0, x1, y1] = selBox(sel.part, pl, b);
      out += `<rect class="bb-sel" x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}" rx="22"/>`;
    }
    if (kbd && document.activeElement === stage && !carry) {
      const p = g.hole(cursor);
      out += `<rect class="bb-cursor" x="${p[0] - 21}" y="${p[1] - 21}" width="42" height="42" rx="9"/>`;
    }
    if (pending) {
      const p = g.hole(pending);
      out += `<circle class="bb-start" cx="${p[0]}" cy="${p[1]}" r="24"/>`;
    }
    gMarks.innerHTML = out;
  };

  // ---------------------------------------------------------------------------------------- the panel: what is joined, the check
  let connHover = -1;
  const readPin = (): string => {
    const c = compile(sketchOf(sk));
    if (!c.ok) return "A0";
    for (const ops of [c.program.loop, c.program.setup]) {
      const r = ops.find((o) => o.kind === "analogRead" || o.kind === "digitalRead");
      if (r && "pin" in r && r.pin) return r.pin.name;
    }
    return "A0";
  };
  const symptomHtml = (s: Symptom, extra = "", level: Symptom["level"] | "todo" = s.level) => {
    const lvl = level;
    const mark = lvl === "ok" ? icon("check") : `<i class="bb-dot"></i>`;
    return `<div class="bb-sym is-${lvl}"><span class="bb-sym-mark">${mark}</span><div class="bb-sym-text">${extra}<p class="bb-sym-line">${esc(T(s.line))}${s.badge ? ` ${badge(s.badge)}` : ""}</p><p class="bb-sym-hint">${esc(T(s.hint))}</p></div></div>`;
  };
  /** A part whose two legs share one strip (step 2's own mistake, shown before anything is wired). */
  const partBypassed = (): Symptom | null => {
    const legs = (k: PartKind) => {
      const pl = build[k];
      const ps = pl ? pinsOf(k, pl) : null;
      return ps ? stripOf(ps["1"]) === stripOf(ps["2"]) : false;
    };
    if (legs("fsr")) return { id: "fsr-bypassed", level: "fail", badge: null, line: say("fsrBypassed"), hint: say("fsrBypassedHint") };
    const pin = readPin();
    if (legs("resistor")) return { id: "resistor-bypassed", level: "fail", badge: "illustrative", line: say("resistorBypassed", { pin }), hint: say("resistorBypassedHint", { pin }) };
    return null;
  };
  const paintPanelBuild = () => {
    const list = connections(build);
    connList.innerHTML = list.length ? list.map((c, i) => `<li data-net="${i}">${esc(T(c.text))}</li>`).join("") : `<li class="bb-empty">${esc(W()["conn.empty"])}</li>`;
    const c = checkWiring(build, readPin());
    if (c.ok) {
      const notes = c.problems.filter((p) => p.level === "note");
      checkEl.innerHTML = `<div class="bb-sym is-ok"><span class="bb-sym-mark">${icon("check")}</span><div class="bb-sym-text"><p class="bb-sym-line">${esc(W()["check.ok"])}</p>${notes.map((n) => `<p class="bb-sym-hint">${esc(T(n.line))}</p>`).join("")}</div></div>`;
      return;
    }
    const s = c.problems[0];
    if (view === "nano" || view === "parts") {
      // (steps 1 and 2: only what the placing itself got wrong; the wiring comes in step 3)
      const own = s && PLACE.has(s.id) ? s : partBypassed();
      checkEl.innerHTML = own ? symptomHtml(own) : "";
      return;
    }
    const todo = s && (s.id === "no-nano" || s.id === "no-fsr" || (s.id === "no-resistor" && !build.resistor));
    checkEl.innerHTML = s ? symptomHtml(s, "", todo ? "todo" : s.level) : "";
  };
  connList.addEventListener("pointerover", (e) => {
    const li = (e.target as HTMLElement).closest<HTMLElement>("[data-net]");
    const i = li ? Number(li.dataset.net) : -1;
    if (i === connHover) return;
    connHover = i;
    const c = connections(build)[i];
    setLit(c ? [{ holes: c.net.holes, kind: "join" }] : []);
  });
  connList.addEventListener("pointerleave", () => {
    connHover = -1;
    setLit([]);
  });

  // the board's inside, drawn small: strips of five, the groove, the rails
  const paintInside = () => {
    const w = W();
    const cols = 9;
    const X = (i: number) => 14 + i * 14;
    const yRail = [10, 19];
    const yRow = [34, 42, 50, 58, 66, 84, 92, 100, 108, 116];
    let holes = "";
    for (let i = 0; i < cols; i++) for (const y of yRow) holes += `<rect x="${X(i) - 2.2}" y="${y - 2.2}" width="4.4" height="4.4" rx=".8"/>`;
    for (let i = 0; i < cols - 1; i++) for (const y of yRail) holes += `<rect x="${X(i) + 7 - 2.2}" y="${y - 2.2}" width="4.4" height="4.4" rx=".8"/>`;
    const right = X(cols - 1) + 8;
    const fig = $<HTMLElement>(".bb-inside-fig");
    fig.innerHTML = `<svg viewBox="0 0 240 126" role="img" aria-label="${esc(w["inside.aria"])}">
      <rect class="bb-in-board" x="4" y="2" width="${right}" height="122" rx="5"/>
      <rect class="bb-in-groove" x="8" y="72" width="${right - 8}" height="6" rx="2"/>
      <path class="bb-in-minus" d="M10 5.5H${right}"/><path class="bb-in-plus" d="M10 23.5H${right}"/>
      <path class="bb-in-lit" d="M${X(0) + 7},19H${X(cols - 2) + 7}"/>
      <path class="bb-in-lit" d="M${X(3)},34V66"/><path class="bb-in-lit is-b" d="M${X(3)},84V116"/>
      <g class="bb-in-holes">${holes}</g>
      <path class="bb-in-lead" d="M${X(3) + 6},50H${right + 14}"/><text x="${right + 18}" y="53">${esc(w["inside.strip"])}</text>
      <path class="bb-in-lead" d="M${X(cols - 2) + 12},19H${right + 14}"/><text x="${right + 18}" y="22">${esc(w["inside.rail"])}</text>
      <path class="bb-in-lead" d="M${right},75H${right + 14}"/><text x="${right + 18}" y="78">${esc(w["inside.groove"])}</text>
    </svg>`;
  };

  // ---------------------------------------------------------------------------------------- the sketch
  let verifyOut: { ok: true } | { ok: false; id: string; ide: Text; line: Text; hint: Text } | null = null;
  const sketchHost = $<HTMLElement>(".bb-sketch-host");
  const sketchView = sketchUi(sketchHost, {
    get: () => sk,
    set: (st, how) => {
      if (how === "field") {
        const changed = Object.keys(st.tiles).find((id) => !same(st.tiles[id], sk.tiles[id]));
        remember(`field:${changed}`);
      } else remember();
      sk = st;
      verifyOut = null;
      sketchView.mark(null);
      save();
      paintVerify();
      if (BUILD_VIEWS.has(view)) paintPanelBuild();
      paintStatus();
    },
    announce,
  });
  const paintVerify = () => {
    if (!verifyOut) voutEl.innerHTML = "";
    else if (verifyOut.ok) voutEl.innerHTML = `<div class="bb-sym is-ok"><span class="bb-sym-mark">${icon("check")}</span><div class="bb-sym-text"><p class="bb-sym-line">${esc(W()["verify.ok"])}</p></div></div>`;
    else voutEl.innerHTML = `<div class="bb-sym is-fail"><span class="bb-sym-mark"><i class="bb-dot"></i></span><div class="bb-sym-text"><p class="bb-err mono">${esc(T(verifyOut.ide))}</p><p class="bb-sym-line">${esc(T(verifyOut.line))}</p><p class="bb-sym-hint">${esc(T(verifyOut.hint))}</p></div></div>`;
  };
  const verify = () => {
    const c = compile(sketchOf(sk));
    if (c.ok) {
      verifyOut = { ok: true };
      sketchView.mark(null);
    } else {
      verifyOut = { ok: false, id: c.error.tile, ide: c.error.ide, line: c.error.line, hint: c.error.hint };
      sketchView.mark(c.error.tile);
    }
    paintVerify();
  };

  // ---------------------------------------------------------------------------------------- upload and run
  let busy: "compiling" | "uploading" | null = null;
  let busyTimer = 0;
  let lastFail: { s: Symptom; ide: Text | null } | null = null;
  let program: Program | null = null;
  let rn: Runner | null = null;
  let verdict: Verdict | null = null;
  let monText = "";
  let points: { t: number; v: number }[] = [];
  let seed = 1;
  const resetSerial = () => {
    monText = "";
    points = [];
    paintSerial();
  };
  /** (Re)start the board on the current build: the sketch it holds, the monitor's rate. Powering up or a new monitor
   *  rate restarts it, as on a real Nano. */
  const restartBoard = () => {
    rn = null;
    verdict = null;
    if (!uploaded) return;
    const c = compile(uploaded);
    program = c.ok ? c.program : null;
    if (!program || !build.nano || !build.usb) return;
    seed = (seed * 1103515245 + 12345) >>> 0 || 1;
    verdict = run(build, uploaded, { monitorBaud, seed });
    rn = runner(circuit(build), program, { monitorBaud, seed });
    resetSerial();
    kick();
  };
  const upload = () => {
    if (busy) return;
    window.clearTimeout(busyTimer);
    lastFail = null;
    sketchView.mark(null);
    const snapshot = sketchOf(sk);
    const v = run(build, snapshot, { monitorBaud });
    busy = "compiling";
    paintStatus();
    const step = reduced ? 0 : 650;
    busyTimer = window.setTimeout(() => {
      if (!alive) return;
      if (v.stage === "build" || v.stage === "compile" || v.stage === "upload") {
        busy = null;
        lastFail = { s: v.symptom, ide: v.compileError?.ide ?? null };
        if (v.compileError) sketchView.mark(v.compileError.tile);
        // (a short or a held reset: the board stops whatever it ran)
        if (v.stage === "upload" && build.usb) {
          rn = null;
          verdict = null;
          resetSerial();
        }
        paintStatus();
        return;
      }
      busy = "uploading";
      paintStatus();
      busyTimer = window.setTimeout(() => {
        if (!alive) return;
        busy = null;
        uploaded = snapshot;
        save();
        restartBoard();
        paintStatus();
      }, reduced ? 0 : 1100);
    }, step);
  };
  const changedSince = () => uploaded !== null && !same(uploaded, sketchOf(sk));
  const paintStatus = () => {
    const w = W();
    usbLabel.textContent = build.usb ? w["usb.in"] : w["usb.out"];
    $<HTMLElement>(".bb-usb-btn").classList.toggle("is-on", build.usb);
    uploadBtn.disabled = Boolean(busy);
    let html = "";
    if (busy) html = `<div class="bb-busy"><p>${esc(w[busy === "compiling" ? "st.compiling" : "st.uploading"])}</p><i class="bb-bar is-${busy}"></i></div>`;
    else if (lastFail) html = symptomHtml(lastFail.s, lastFail.ide ? `<p class="bb-err mono">${esc(T(lastFail.ide))}</p>` : "");
    else if (uploaded && build.nano && !build.usb) html = `<p class="bb-plain">${esc(w["st.off"])}</p>`;
    else if (verdict) html = symptomHtml(verdict.symptom);
    else html = `<p class="bb-plain">${esc(build.usb ? w["st.ready"] : w["st.idle"])}</p>`;
    if (!busy && changedSince()) html += `<p class="bb-plain bb-changed">${esc(w["st.changed"])}</p>`;
    if (!busy && !lastFail && verdict?.stage === "run" && uploaded && build.usb) html = `<p class="bb-done mono">${esc(w["st.done"])}</p>` + html;
    statusEl.innerHTML = html;
    root.classList.toggle("is-works", Boolean(verdict?.ok) && !lastFail && build.usb);
    const pressable = Boolean(build.fsr);
    $<HTMLElement>(".bb-press-row").hidden = !pressable;
    paintHint();
  };

  // the Serial Monitor and Plotter
  let monShown = "";
  const paintSerial = () => {
    const lines = monText.split("\r\n");
    const tail = lines.slice(-40).map((l) => (l.length > 240 ? `…${l.slice(-240)}` : l));
    const html = tail.map((l) => `<li>${esc(l) || "&nbsp;"}</li>`).join("");
    if (html !== monShown) {
      monShown = html;
      monBox.innerHTML = monText ? html : "";
    }
    const t1 = rn ? rn.t : 0;
    const t0 = t1 - WINDOW_MS;
    trace.setAttribute("points", points.filter((p) => p.t >= t0 - 200).map((p) => `${(((p.t - t0) / WINDOW_MS) * 100).toFixed(2)},${(100 - (clamp(p.v, 0, MAX_CODE) / MAX_CODE) * 100).toFixed(2)}`).join(" "));
  };

  // ---------------------------------------------------------------------------------------- the press
  let level = 0.42;
  let pressActive = false;
  let holdLevel = 0;
  let force = 0;
  const pressedNow = () => pressActive || holdLevel > 0;
  const levelNow = () => (pressActive ? level : holdLevel > 0 ? holdLevel : level);
  const paintPress = () => {
    if (!g || !build.fsr) {
      pressGlow.setAttribute("r", "0");
      pressRing.setAttribute("r", "0");
      return;
    }
    const disc = g.fsrDisc(build.fsr);
    pressGlow.setAttribute("cx", String(disc.c[0]));
    pressGlow.setAttribute("cy", String(disc.c[1]));
    pressGlow.setAttribute("r", String(disc.active));
    pressRing.setAttribute("cx", String(disc.c[0]));
    pressRing.setAttribute("cy", String(disc.c[1]));
    pressRing.setAttribute("r", String(disc.r + 10));
    const p = force > 0 ? 0.35 + (0.65 * Math.log(force / 0.2)) / Math.log(100) : 0;
    root.style.setProperty("--bb-press", p.toFixed(3));
    root.classList.toggle("is-pressed", force > 0);
    if (document.activeElement !== slider) slider.value = String(pressedNow() ? Math.max(1, Math.round(levelNow() * 100)) : 0);
  };
  slider.addEventListener("input", () => {
    holdLevel = Number(slider.value) / 100;
    if (holdLevel > 0) {
      level = holdLevel;
      root.classList.add("was-pressed");
    }
    kick();
  });

  // ---------------------------------------------------------------------------------------- hints, palette, corner buttons
  const paintHint = () => {
    const w = W();
    let h = "";
    if (view === "nano") h = build.nano ? w["hint.look"] : w["hint.nano"];
    else if (view === "parts") h = w["hint.parts"];
    else if (view === "wires") h = w["hint.wires"];
    else if (view === "run") h = verdict?.stage === "run" && build.fsr && build.usb ? w["hint.press"] : verdict || lastFail || build.usb ? "" : w["hint.run"];
    hintEl.textContent = h;
    showBtn.setAttribute("aria-label", w[`show.${view}` as "show.nano"]);
  };
  const paintPalette = () => {
    const w = W();
    palette.innerHTML = WIRE_COLORS.map((c) => `<button type="button" role="radio" class="bb-swatch" data-color="${c}" aria-checked="${c === color}" tabindex="${c === color ? 0 : -1}" aria-label="${esc(w[c])}" title="${esc(w[c])}" style="--sw:${data ? data.wire.colors[c] : "#888"}"></button>`).join("");
  };
  const pickColor = (c: WireColor) => {
    color = c;
    if (sel?.kind === "wire") {
      remember();
      build = recolorWire(build, sel.id, color);
      commit();
    } else save();
    paintPalette();
    paintWires();
  };
  palette.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>("[data-color]");
    if (b) pickColor(b.dataset.color as WireColor);
  });
  palette.addEventListener("keydown", (e) => {
    const d = ({ ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 } as Record<string, number>)[e.key];
    if (!d) return;
    e.preventDefault();
    const n = WIRE_COLORS.length;
    const next = WIRE_COLORS[(WIRE_COLORS.indexOf(color) + d + n) % n];
    pickColor(next);
    palette.querySelector<HTMLElement>(`[data-color="${next}"]`)?.focus();
  });
  const paintCorner = () => {
    $<HTMLButtonElement>('[data-act="undo"]').disabled = !history.length;
  };

  // ---------------------------------------------------------------------------------------- notes
  let noteTimer = 0;
  const note = (texts: Text[] | string) => {
    const html = typeof texts === "string" ? `<p>${esc(texts)}</p>` : texts.map((t) => `<p>${esc(T(t))}</p>`).join("");
    noteEl.innerHTML = html;
    noteEl.classList.add("is-on");
    noteRaw = texts;
    window.clearTimeout(noteTimer);
    noteTimer = window.setTimeout(() => {
      noteEl.classList.remove("is-on");
      noteRaw = null;
    }, NOTE_MS);
  };
  let noteRaw: Text[] | string | null = null;

  // ---------------------------------------------------------------------------------------- one commit
  /** After every change to the build: save, draw, and let the running board feel it. */
  const commit = () => {
    save();
    const sw = sel?.kind === "wire" ? sel.id : null;
    if (sw && !build.wires.some((w) => w.id === sw)) sel = null;
    if (sel?.kind === "part" && !build[sel.part]) sel = null;
    if (pending && !holeFree(build, pending).ok) pending = null;
    if (lastFail?.s.id === "no-usb" && build.usb) lastFail = null;
    if (uploaded) restartBoard();
    paintAll();
  };
  const paintAll = () => {
    if (!data) return;
    paintTray();
    paintParts();
    paintWires();
    paintPress();
    paintMarks();
    paintTools();
    paintKeys();
    if (BUILD_VIEWS.has(view)) paintPanelBuild();
    paintStatus();
    paintCorner();
    root.classList.toggle("has-palette", view === "wires" || sel?.kind === "wire" || Boolean(pending));
  };

  // ---------------------------------------------------------------------------------------- pointer: hit-testing
  type Drag =
    | { kind: "part"; part: Part; from: "tray" | "board"; rot: Rot; grab: Pt; x0: number; y0: number; on: boolean; snap: NanoPlace | PartPlace | null; why: Text[] | null; pid: number }
    | { kind: "wire"; from: HoleId; to: Pt; snap: HoleId | null; x0: number; y0: number; on: boolean; pid: number }
    | { kind: "end"; id: string; end: "a" | "b"; from: HoleId; to: Pt; snap: HoleId | null; x0: number; y0: number; on: boolean; pid: number }
    | { kind: "press"; y0: number; level0: number; pid: number }
    | { kind: "click"; what: "usb-tray" | "usb-board" | "wire"; id?: string; x0: number; y0: number; pid: number };
  let drag: Drag | null = null;
  let hoverHole: HoleId | null = null;

  const anchorOf = (p: Part, pl: NanoPlace | PartPlace): Pt => (p === "nano" ? g!.hole(`${(pl as NanoPlace).col}${(pl as NanoPlace).row}`) : g!.hole((pl as PartPlace).at));
  const pinPx = (p: Part, rot: Rot): Pt => (p === "nano" ? g!.nanoPinPx.D12 : g!.partPic(p, rot).pins["1"]);
  const picSize = (p: Part, rot: Rot): [number, number] => (p === "nano" ? data!.parts.nano.size : g!.partPic(p, rot).size);

  /** Where a part held with its anchor pin at `a` (scene px) would go, or why it can't. */
  const snapPart = (p: Part, rot: Rot, a: Pt): { place: NanoPlace | PartPlace | null; why: Text[] | null; near: Pt[] } => {
    const G = g!;
    if (p === "nano") {
      const h1 = G.hole("1a");
      const col = Math.round((a[0] - h1[0]) / G.pitch) + 1;
      let row: string | null = null;
      let bd = Infinity;
      for (const r of ROWS) {
        const dy = Math.abs(G.hole(`1${r}`)[1] - a[1]);
        if (dy < bd) {
          bd = dy;
          row = r;
        }
      }
      if (bd > G.pitch * 0.8 || col < 1 || col > NANO_COL_MAX) return { place: null, why: [say("offBoard")], near: [] };
      const c = checkNano(build, col, row!);
      if (c.ok) return { place: { col, row: row as NanoRow }, why: null, near: [] };
      const why = c.why === "nano-groove" ? [c.text, say("nanoPairs")] : [c.text];
      return { place: null, why, near: c.hole ? [G.hole(c.hole)] : [] };
    }
    const h = G.nearest(a, 0.75);
    if (!h) return { place: null, why: [say("offBoard")], near: [] };
    const pl: PartPlace = { at: h, rot };
    const c = checkPart(build, p, pl);
    if (c.ok) return { place: pl, why: null, near: [] };
    return { place: null, why: [c.text], near: c.hole ? [G.hole(c.hole)] : [G.hole(h)] };
  };
  /** The holes a placement's pins join (lit while a part is held over the board). */
  const pinGroups = (p: Part, pl: NanoPlace | PartPlace): { holes: HoleId[]; kind: LitKind }[] => {
    const bare = removePart(build, p);
    const holes = p === "nano" ? nanoPins(pl as NanoPlace).map((x) => x.hole) : Object.values(pinsOf(p, pl as PartPlace) ?? {});
    const out: { holes: HoleId[]; kind: LitKind }[] = [];
    for (const h of holes) out.push({ holes: p === "nano" ? stripHoles(stripOf(h)!) : joinedHoles(bare, h), kind: p === "nano" ? "soft" : "join" });
    return out;
  };
  const showPartHeld = (p: Part, rot: Rot, a: Pt, snap: NanoPlace | PartPlace | null, near: Pt[], floating: boolean) => {
    const pin = pinPx(p, rot);
    const [w, h] = picSize(p, rot);
    const s = partSrc(p, rot);
    setSrc(floatImg, s);
    place(floatImg, { left: a[0] - pin[0], top: a[1] - pin[1], w, h });
    floatImg.hidden = !floating;
    ghostImg.hidden = !snap;
    if (snap) {
      setSrc(ghostImg, s);
      const at = anchorOf(p, snap);
      place(ghostImg, { left: at[0] - pin[0], top: at[1] - pin[1], w, h });
      setLit(pinGroups(p, snap));
      markHtml = g!
        .pinsPx(p, snap)
        .map((q) => `<circle class="bb-pin-ok" cx="${q[0]}" cy="${q[1]}" r="17"/>`)
        .join("");
    } else {
      setLit([]);
      markHtml = near.map((q) => `<circle class="bb-pin-bad" cx="${q[0]}" cy="${q[1]}" r="20"/>`).join("");
    }
    paintMarks();
  };
  const clearHeld = () => {
    floatImg.hidden = true;
    ghostImg.hidden = true;
    markHtml = "";
    setLit([]);
    paintMarks();
  };

  /** A free hole right under the pointer (a jumper arcs over the holes it crosses, so they stay usable). */
  const freeHoleUnder = (p: Pt): HoleId | null => {
    const h = g!.nearest(p, 0.25);
    return h && holeFree(build, h).ok ? h : null;
  };
  const wireEndAt = (p: Pt): { id: string; end: "a" | "b"; hole: HoleId } | null => {
    const h = g!.nearest(p, 0.5);
    if (!h) return null;
    const o = whatIsAt(build, h);
    return o?.kind === "wire" ? { id: o.id, end: o.end, hole: h } : null;
  };

  const onDown = (e: PointerEvent) => {
    if (!data || !g || drag || e.button !== 0) return;
    if ((e.target as HTMLElement).closest("button, input, select, .bb-note")) return;
    kbd = false;
    hideChip();
    pointerFocus = true;
    stage.focus({ preventScroll: true });
    pointerFocus = false;
    const p = toScene(e);
    const base = { x0: e.clientX, y0: e.clientY, pid: e.pointerId };
    // 1. a wire's end (its housing over a hole)
    const we = wireEndAt(p);
    if (we && !pending) {
      drag = { kind: "end", id: we.id, end: we.end, from: we.hole, to: p, snap: null, on: false, ...base };
    } else if ((e.target as Element).closest?.("[data-wire]") && !pending && !freeHoleUnder(p)) {
      // 2. a wire's body: a click picks it
      drag = { kind: "click", what: "wire", id: (e.target as Element).closest("[data-wire]")!.getAttribute("data-wire")!, ...base };
    } else if (view === "run" && build.fsr && g.onFsr(build.fsr, p, true) && !pending) {
      // 3. the sensor's disc, once there is something to read it
      drag = { kind: "press", y0: e.clientY, level0: level, pid: e.pointerId };
      pressActive = true;
      root.classList.add("was-pressed");
      kick();
    } else {
      const part = pending ? null : partAt(g, build, p, view === "run");
      const ti = pending ? null : inTray(p);
      if (part === "usb") drag = { kind: "click", what: "usb-board", ...base };
      else if (part) {
        const pl = build[part]!;
        const a = anchorOf(part, pl);
        drag = { kind: "part", part, from: "board", rot: part === "nano" ? 0 : (pl as PartPlace).rot, grab: [a[0] - p[0], a[1] - p[1]], on: false, snap: null, why: null, ...base };
      } else if (ti === "usb") drag = { kind: "click", what: "usb-tray", ...base };
      else if (ti) {
        const b = tray[ti]!;
        const pin = pinPx(ti, 0);
        const a: Pt = [b.left + pin[0] * TRAY_SCALE, b.top + pin[1] * TRAY_SCALE];
        drag = { kind: "part", part: ti, from: "tray", rot: 0, grab: [(a[0] - p[0]) / TRAY_SCALE, (a[1] - p[1]) / TRAY_SCALE], on: false, snap: null, why: null, ...base };
      } else {
        const h = g.nearest(p, 0.5);
        if (h && holeFree(build, h).ok) {
          if (pending) {
            finishWire(h);
            return;
          }
          drag = { kind: "wire", from: h, to: p, snap: null, on: false, ...base };
        } else {
          if (pending) {
            const c = h ? checkWire(build, pending, h) : null;
            if (c && !c.ok) note([c.text]);
            pending = null;
          }
          sel = null;
          paintAll();
          return;
        }
      }
    }
    stage.setPointerCapture(e.pointerId);
    e.preventDefault();
  };
  const finishWire = (h: HoleId) => {
    const from = pending!;
    pending = null;
    if (h === from) {
      paintWires();
      paintMarks();
      return;
    }
    const r = addWire(build, from, h, color);
    if (r.ok) {
      remember();
      build = r.build;
      announce(W()["live.wireDone"].replace("{a}", from).replace("{b}", h));
      commit();
    } else {
      note([r.text]);
      paintWires();
      paintMarks();
    }
  };
  const onMove = (e: PointerEvent) => {
    if (!data || !g) return;
    const p = toScene(e);
    pointerScene = p;
    if (!drag) {
      hover(p, e);
      return;
    }
    if (e.pointerId !== drag.pid) return;
    if (drag.kind === "press") {
      level = clamp(drag.level0 + (e.clientY - drag.y0) / 140, 0, 1);
      kick();
      return;
    }
    if (drag.kind === "click") return;
    if (!drag.on) {
      if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 5) return;
      drag.on = true;
      sel = drag.kind === "part" && drag.from === "board" ? { kind: "part", part: drag.part } : drag.kind === "end" ? { kind: "wire", id: drag.id } : null;
      root.classList.add("is-holding");
      hideChip();
      paintTools();
      if (drag.kind === "part") {
        paintParts();
        paintTray();
      }
    }
    if (drag.kind === "part") {
      const a: Pt = [p[0] + drag.grab[0], p[1] + drag.grab[1]];
      const s = snapPart(drag.part, drag.rot, a);
      drag.snap = s.place;
      drag.why = s.why;
      // (a valid place wins over the tray: the FSR held by its disc has its legs far above the pointer)
      const toTray = overTray(p) && !s.place;
      showPartHeld(drag.part, drag.rot, a, toTray ? null : s.place, toTray ? [] : s.near, true);
      paintHintHeld(toTray ? null : s.why);
    } else if (drag.kind === "wire" || drag.kind === "end") {
      drag.to = p;
      const h = g.nearest(p, 0.5);
      const ok = h && (drag.kind === "wire" ? h !== drag.from && holeFree(build, h).ok : checkWireEnd(build, drag.id, drag.end, h).ok);
      drag.snap = ok ? h : null;
      const groups: { holes: HoleId[]; kind: LitKind }[] = [];
      if (drag.kind === "wire") groups.push({ holes: joinedHoles(build, drag.from), kind: "join" });
      else {
        const w = build.wires.find((x) => x.id === (drag as { id: string }).id)!;
        const fixed = drag.end === "a" ? w.b : w.a;
        const bare = removeWire(build, w.id);
        groups.push({ holes: joinedHoles(bare, fixed), kind: "join" });
      }
      if (drag.snap) groups.push({ holes: joinedHoles(drag.kind === "end" ? removeWire(build, drag.id) : build, drag.snap), kind: "join" });
      setLit(groups);
      paintWires();
    }
  };
  let heldWhy: Text[] | null = null;
  const paintHintHeld = (why: Text[] | null) => {
    heldWhy = why;
    if (why) hintEl.textContent = T(why[0]);
    else paintHint();
    hintEl.classList.toggle("is-why", Boolean(why));
  };
  const onUp = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.pid) return;
    const d = drag;
    drag = null;
    root.classList.remove("is-holding");
    if (stage.hasPointerCapture(e.pointerId)) stage.releasePointerCapture(e.pointerId);
    const p = toScene(e);
    if (d.kind === "press") {
      pressActive = false;
      kick();
      return;
    }
    if (d.kind === "click") {
      if (Math.hypot(e.clientX - d.x0, e.clientY - d.y0) > 6) return;
      if (d.what === "wire") {
        sel = sel?.kind === "wire" && sel.id === d.id ? null : { kind: "wire", id: d.id! };
        const w = build.wires.find((x) => x.id === d.id);
        if (w && sel) {
          color = w.color;
          paintPalette();
        }
        paintAll();
      } else toggleUsb();
      return;
    }
    if (!d.on) {
      // a click
      if (d.kind === "wire") {
        pending = d.from;
        sel = null;
        announce(W()["live.wireStart"].replace("{hole}", d.from));
        paintAll();
      } else if (d.kind === "end") {
        sel = sel?.kind === "wire" && sel.id === d.id ? null : { kind: "wire", id: d.id };
        const w = build.wires.find((x) => x.id === d.id);
        if (w && sel) {
          color = w.color;
          paintPalette();
        }
        paintAll();
      } else if (d.kind === "part") {
        if (d.from === "board") sel = sel?.kind === "part" && sel.part === d.part ? null : { kind: "part", part: d.part };
        paintAll();
      }
      return;
    }
    paintHintHeld(null);
    clearHeld();
    if (d.kind === "part") {
      if (overTray(p) && !d.snap) {
        if (d.from === "board") {
          remember();
          build = removePart(build, d.part);
          sel = null;
          announce(W()["live.back"].replace("{part}", partName(d.part)));
          commit();
        } else paintAll();
        return;
      }
      if (d.snap) {
        const r = d.part === "nano" ? placeNano(build, d.snap as NanoPlace) : placePart(build, d.part, d.snap as PartPlace);
        if (r.ok) {
          remember();
          build = r.build;
          sel = null;
          announce(W()["live.placed"].replace("{part}", partName(d.part)));
          commit();
          return;
        }
      }
      if (d.why) note(d.why);
      paintAll();
      return;
    }
    if (d.kind === "wire") {
      if (d.snap) {
        pending = d.from;
        finishWire(d.snap);
      } else {
        const h = g!.nearest(p, 0.5);
        if (h && h !== d.from) {
          const c = checkWire(build, d.from, h);
          if (!c.ok) note([c.text]);
        }
        paintAll();
      }
      return;
    }
    if (d.kind === "end") {
      if (d.snap && d.snap !== d.from) {
        const r = moveWireEnd(build, d.id, d.end, d.snap);
        if (r.ok) {
          remember();
          build = r.build;
          commit();
          return;
        }
        note([r.text]);
      } else if (!d.snap) {
        const h = g!.nearest(p, 0.5);
        if (h && h !== d.from) {
          const c = checkWireEnd(build, d.id, d.end, h);
          if (!c.ok) note([c.text]);
        }
      }
      paintAll();
    }
  };
  const onCancel = () => {
    if (!drag) return;
    if (drag.kind === "press") pressActive = false;
    drag = null;
    root.classList.remove("is-holding");
    paintHintHeld(null);
    clearHeld();
    paintAll();
  };
  stage.addEventListener("pointerdown", onDown);
  stage.addEventListener("pointermove", onMove);
  stage.addEventListener("pointerup", onUp);
  stage.addEventListener("pointercancel", onCancel);
  stage.addEventListener("pointerleave", () => {
    pointerScene = null;
    if (!drag) {
      hoverHole = null;
      hideChip();
      if (connHover < 0) setLit([]);
      root.dataset.cursor = "";
      if (pending) paintWires();
    }
  });

  // hover: what a hole joins (a chip by the pointer, its strip or net lit)
  const whatJoined = (h: HoleId): string => {
    const net = netlist(build).netOfHole(h);
    if (!net) return "";
    const items: Text[] = [...net.nano.map((n) => ({ en: n, zh: n })), ...net.fsr.map((n) => say("itemFsr", { n })), ...(net.resistor.length === 2 ? [say("itemResBoth")] : net.resistor.length ? [say("itemRes")] : [])];
    return items.slice(0, 3).map(T).join(" — ") + (items.length > 3 ? " …" : "");
  };
  const hideChip = () => chip.classList.remove("is-on");
  let wireRaf = 0;
  const hover = (p: Pt, e: PointerEvent) => {
    const G = g!;
    const we = wireEndAt(p);
    const onWire = (e.target as Element).closest?.("[data-wire]") && !freeHoleUnder(p);
    const part = partAt(G, build, p, view === "run");
    const ti = inTray(p);
    let cur = "";
    if (view === "run" && build.fsr && G.onFsr(build.fsr, p, true)) cur = "press";
    else if (we || part || (ti && ti !== "usb")) cur = "grab";
    else if (onWire || ti === "usb") cur = "pointer";
    // (over a part, only its own pins name themselves: the Nano's body hides the holes under it)
    const near = part === "usb" ? null : G.nearest(p, 0.5);
    const occ = near ? whatIsAt(build, near) : undefined;
    const h = near && (!part || (occ && occ.kind !== "nano-body" && occ.kind !== "wire")) ? near : null;
    if (!cur && h) cur = "hole";
    root.dataset.cursor = cur;
    if (h !== hoverHole) {
      hoverHole = h;
      if (connHover < 0) setLit(h ? [{ holes: joinedHoles(build, h), kind: "join" }] : []);
    }
    // (a wire waiting for its other end follows the pointer, between holes and over the Nano too)
    if (pending && !wireRaf) wireRaf = requestAnimationFrame(() => {
      wireRaf = 0;
      if (alive && pending) paintWires();
    });
    if (h) {
      const what = whatJoined(h);
      chip.textContent = what ? `${h} · ${what}` : h;
      const r = stage.getBoundingClientRect();
      chip.style.transform = `translate(${(e.clientX - r.left + 14).toFixed(0)}px, ${(e.clientY - r.top + 16).toFixed(0)}px)`;
      chip.classList.add("is-on");
    } else hideChip();
  };

  // ---------------------------------------------------------------------------------------- USB
  const toggleUsb = () => {
    if (!build.nano) {
      note(W()["note.usbNoNano"]);
      return;
    }
    remember();
    build = plugUsb(build, !build.usb);
    announce(build.usb ? W()["note.plugged"] : W()["note.unplugged"]);
    commit();
  };

  // ---------------------------------------------------------------------------------------- tools by a picked thing
  const paintTools = () => {
    if (!g || !data) return;
    let html = "";
    let at: Pt | null = null;
    const w = W();
    if (sel?.kind === "part" && build[sel.part] && !drag?.kind) {
      const pl = build[sel.part]!;
      const b = sel.part === "nano" ? g.nanoBox(pl as NanoPlace) : g.partBox(sel.part, pl as PartPlace);
      at = toScreen([b.left + b.w * 0.5, b.top + 6]);
      if (sel.part !== "nano") html += `<button type="button" class="bb-tool" data-tool="turn" aria-label="${esc(w.turn)}" title="${esc(w.turn)}"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M12.5 6.5A5 5 0 1 0 13 10"/><path d="M13 2.8v3.9H9.1"/></svg></button>`;
      html += `<button type="button" class="bb-tool" data-tool="tray" aria-label="${esc(w.toTray)}" title="${esc(w.toTray)}">${icon("close")}</button>`;
    } else if (sel?.kind === "wire") {
      const sid = sel.id;
      const wire = build.wires.find((x) => x.id === sid);
      if (wire) {
        const { mid } = wirePaths(data, { a: g.hole(wire.a), b: g.hole(wire.b), index: build.wires.indexOf(wire) });
        at = toScreen(mid);
        html = `<button type="button" class="bb-tool" data-tool="delete" aria-label="${esc(w.deleteWire)}" title="${esc(w.deleteWire)}">${icon("close")}</button>`;
      }
    }
    tools.innerHTML = html;
    tools.hidden = !at;
    if (at) {
      // (above the thing, kept inside the workbench)
      const aw = (narrow() ? size.w : size.w - panelW()) - 12;
      tools.style.left = `${clamp(at[0], 40, aw - 40).toFixed(0)}px`;
      tools.style.top = `${clamp(at[1] - 10, 72, size.h - 60).toFixed(0)}px`;
    }
  };
  tools.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>("[data-tool]");
    if (!b) return;
    const t = b.dataset.tool;
    if (t === "delete" && sel?.kind === "wire") {
      remember();
      build = removeWire(build, sel.id);
      sel = null;
      announce(W()["live.wireGone"]);
      commit();
    } else if (t === "tray" && sel?.kind === "part") {
      const p = sel.part;
      remember();
      build = removePart(build, p);
      sel = null;
      announce(W()["live.back"].replace("{part}", partName(p)));
      commit();
    } else if (t === "turn" && sel?.kind === "part" && sel.part !== "nano") turn(sel.part);
  });
  const turn = (p: PartKind) => {
    const pl = build[p];
    if (!pl) return;
    const r = placePart(build, p, { at: pl.at, rot: pl.rot === 0 ? 90 : 0 });
    if (r.ok) {
      remember();
      build = r.build;
      commit();
    } else note([r.text]);
  };

  // ---------------------------------------------------------------------------------------- keyboard
  let kbd = false;
  let cursor: HoleId = "3c";
  type Carry = { kind: "part"; part: Part; from: "tray" | "board"; rot: Rot; anchor: HoleId; id?: undefined; end?: undefined; hole?: undefined } | { kind: "end"; id: string; end: "a" | "b"; hole: HoleId; part?: undefined; from?: undefined };
  let carry: Carry | null = null;
  const RAIL_ROWS = ["TN", "TP"];
  const BOT_ROWS = ["BP", "BN"];
  /** The hole next to `h` in a direction (rails above row a and below row j). */
  const step = (h: HoleId, dx: number, dy: number): HoleId => {
    const G = g!;
    const order = [...RAIL_ROWS, ...ROWS, ...BOT_ROWS];
    const m = /^(\d+)([a-j])$/.exec(h);
    const r = /^(TP|TN|BP|BN)(\d+)$/.exec(h);
    const x = G.hole(h)[0];
    let rowName = m ? m[2] : r![1];
    let i = order.indexOf(rowName);
    if (dy) {
      i = clamp(i + dy, 0, order.length - 1);
      rowName = order[i];
      // (the hole in that row nearest the same x)
      const cands = G.ids.filter((id) => (/^(TP|TN|BP|BN)/.test(rowName) ? id.startsWith(rowName) && /^\D+\d+$/.test(id) : id.endsWith(rowName) && /^\d+[a-j]$/.test(id)));
      let best = cands[0];
      let bd = Infinity;
      for (const c of cands) {
        const dd = Math.abs(G.hole(c)[0] - x);
        if (dd < bd) {
          bd = dd;
          best = c;
        }
      }
      return best;
    }
    if (m) return `${clamp(Number(m[1]) + dx, 1, 30)}${m[2]}`;
    return `${r![1]}${clamp(Number(r![2]) + dx, 1, 25)}`;
  };
  const showCarry = () => {
    if (!carry || !g) return;
    if (carry.kind === "part") {
      const a = g.hole(carry.anchor);
      const s = snapPart(carry.part, carry.rot, a);
      showPartHeld(carry.part, carry.rot, a, s.place, s.near, !s.place);
      paintHintHeld(s.why);
    } else {
      paintWires();
      setLit([{ holes: joinedHoles(removeWire(build, carry.id), carry.hole), kind: "join" }]);
    }
  };
  const startCarry = (c: Carry) => {
    carry = c;
    sel = c.kind === "part" && c.from === "board" ? { kind: "part", part: c.part } : c.kind === "end" ? { kind: "wire", id: c.id } : null;
    kbd = true;
    paintAll();
    showCarry();
    announce(c.kind === "part" ? (c.part === "nano" ? W()["live.carryNano"] : W()["live.carry"].replace("{part}", partName(c.part))) : W()["live.endCarry"].replace("{hole}", c.hole));
  };
  const endCarry = () => {
    carry = null;
    paintHintHeld(null);
    clearHeld();
    paintAll();
  };
  const describe = (h: HoleId) => {
    const o: Occupant | undefined = whatIsAt(build, h);
    const what = whatJoined(h);
    const base = what ? W()["live.joined"].replace("{hole}", h).replace("{what}", what) : W()["live.at"].replace("{hole}", h);
    return o?.kind === "nano-body" ? `${base} ${T(say("underNano", { hole: h }))}` : base;
  };
  const onKey = (e: KeyboardEvent) => {
    if (!g || e.target !== stage) return;
    const k = e.key;
    const arrows: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if ((e.ctrlKey || e.metaKey) && k.toLowerCase() === "z") {
      e.preventDefault();
      undo();
      return;
    }
    if (arrows[k] || k === "Enter" || k === " ") kbd = true;
    if (arrows[k]) {
      e.preventDefault();
      const [dx, dy] = arrows[k];
      if (carry?.kind === "part") {
        // the anchor moves hole by hole over the middle of the board
        let next = step(carry.anchor, dx, dy);
        if (!/^\d+[a-j]$/.test(next)) next = carry.anchor;
        carry.anchor = next;
        showCarry();
        const s = snapPart(carry.part, carry.rot, g.hole(next));
        announce(s.place ? next : `${next}. ${s.why ? T(s.why[0]) : ""}`);
        return;
      }
      if (carry?.kind === "end") {
        carry.hole = step(carry.hole, dx, dy);
        showCarry();
        announce(describe(carry.hole));
        return;
      }
      cursor = step(cursor, dx, dy);
      setLit([{ holes: joinedHoles(build, cursor), kind: "join" }]);
      paintMarks();
      if (pending) paintWires();
      announce(describe(cursor));
      return;
    }
    if (k === "Escape") {
      if (drag && drag.kind !== "press") {
        e.preventDefault();
        if (stage.hasPointerCapture(drag.pid)) stage.releasePointerCapture(drag.pid);
        onCancel();
        announce(W()["live.cancel"]);
      } else if (carry) {
        e.preventDefault();
        endCarry();
        announce(W()["live.cancel"]);
      } else if (pending) {
        e.preventDefault();
        pending = null;
        paintWires();
        paintMarks();
        announce(W()["live.cancel"]);
      } else if (sel) {
        sel = null;
        paintAll();
      }
      return;
    }
    if (k === "r" || k === "R") {
      if (drag?.kind === "part" && drag.part !== "nano") {
        // (a part held by the pointer turns about the pointer: each turned picture is the other one transposed, so the
        // pointer's spot on the picture is transposed too)
        const p0 = pinPx(drag.part, drag.rot);
        const q: Pt = [p0[0] - drag.grab[0], p0[1] - drag.grab[1]];
        drag.rot = drag.rot === 0 ? 90 : 0;
        const p1 = pinPx(drag.part, drag.rot);
        drag.grab = [p1[0] - q[1], p1[1] - q[0]];
        if (pointerScene) {
          const a: Pt = [pointerScene[0] + drag.grab[0], pointerScene[1] + drag.grab[1]];
          const s = snapPart(drag.part, drag.rot, a);
          drag.snap = s.place;
          drag.why = s.why;
          showPartHeld(drag.part, drag.rot, a, s.place, s.near, true);
          paintHintHeld(s.why);
        }
      } else if (carry?.kind === "part" && carry.part !== "nano") {
        carry.rot = carry.rot === 0 ? 90 : 0;
        showCarry();
      } else if (sel?.kind === "part" && sel.part !== "nano" && !kbd) turn(sel.part);
      else {
        const o = kbd ? whatIsAt(build, cursor) : undefined;
        if (o?.kind === "fsr" || o?.kind === "resistor") turn(o.kind);
      }
      return;
    }
    if (k === "Delete" || k === "Backspace") {
      e.preventDefault();
      if (sel && !carry && !kbd) {
        remember();
        if (sel.kind === "wire") {
          build = removeWire(build, sel.id);
          announce(W()["live.wireGone"]);
        } else {
          build = removePart(build, sel.part);
          announce(W()["live.back"].replace("{part}", partName(sel.part)));
        }
        sel = null;
        commit();
        return;
      }
      const o = kbd ? whatIsAt(build, cursor) : undefined;
      if (o?.kind === "wire") {
        remember();
        build = removeWire(build, o.id);
        announce(W()["live.wireGone"]);
        commit();
      } else if (o && o.kind !== "nano-body") {
        const p: Part = o.kind === "nano" ? "nano" : o.kind;
        remember();
        build = removePart(build, p);
        announce(W()["live.back"].replace("{part}", partName(p)));
        commit();
      }
      return;
    }
    if (k === "Enter" || k === " ") {
      e.preventDefault();
      if (carry?.kind === "part") {
        const s = snapPart(carry.part, carry.rot, g.hole(carry.anchor));
        if (!s.place) {
          if (s.why) {
            note(s.why);
            announce(s.why.map(T).join(" "));
          }
          return;
        }
        const r = carry.part === "nano" ? placeNano(build, s.place as NanoPlace) : placePart(build, carry.part, s.place as PartPlace);
        if (r.ok) {
          const p = carry.part;
          remember();
          build = r.build;
          cursor = carry.anchor;
          carry = null;
          sel = null;
          paintHintHeld(null);
          clearHeld();
          announce(W()["live.placed"].replace("{part}", partName(p)));
          commit();
        }
        return;
      }
      if (carry?.kind === "end") {
        const c = carry;
        if (c.hole === (build.wires.find((w) => w.id === c.id)?.[c.end] ?? "")) {
          endCarry();
          return;
        }
        const r = moveWireEnd(build, c.id, c.end, c.hole);
        if (r.ok) {
          remember();
          build = r.build;
          cursor = c.hole;
          carry = null;
          clearHeld();
          commit();
        } else {
          note([r.text]);
          announce(T(r.text));
        }
        return;
      }
      if (pending) {
        if (holeFree(build, cursor).ok || cursor === pending) finishWire(cursor);
        else {
          const c = checkWire(build, pending, cursor);
          if (!c.ok) {
            note([c.text]);
            announce(T(c.text));
          }
        }
        return;
      }
      const o = whatIsAt(build, cursor);
      if (o?.kind === "wire") startCarry({ kind: "end", id: o.id, end: o.end, hole: cursor });
      else if (o) {
        const p: Part = o.kind === "nano" || o.kind === "nano-body" ? "nano" : o.kind;
        const pl = build[p]!;
        const anchor = p === "nano" ? `${(pl as NanoPlace).col}${(pl as NanoPlace).row}` : (pl as PartPlace).at;
        startCarry({ kind: "part", part: p, from: "board", rot: p === "nano" ? 0 : (pl as PartPlace).rot, anchor });
      } else if (holeFree(build, cursor).ok) {
        pending = cursor;
        paintWires();
        paintMarks();
        announce(W()["live.wireStart"].replace("{hole}", cursor));
      }
    }
  };
  stage.addEventListener("keydown", onKey);
  let pointerFocus = false;
  stage.addEventListener("focus", () => {
    kbd = !pointerFocus;
    if (kbd) setLit([{ holes: joinedHoles(build, cursor), kind: "join" }]);
    paintMarks();
  });
  stage.addEventListener("blur", () => {
    if (kbd && !carry && connHover < 0) setLit([]);
    paintMarks();
  });

  // the tray's parts and the plug as buttons, for the keyboard (placed over their pictures)
  const paintKeys = () => {
    if (!g) return;
    const w = W();
    let html = "";
    const btn = (id: string, b: { x: number; y: number; w: number; h: number }, label: string) =>
      `<button type="button" class="bb-key" data-key="${id}" aria-label="${esc(label)}" style="left:${b.x.toFixed(0)}px;top:${b.y.toFixed(0)}px;width:${b.w.toFixed(0)}px;height:${b.h.toFixed(0)}px"></button>`;
    for (const [id, b] of Object.entries(tray) as [Part | "usb", Placed][]) {
      const [x, y] = toScreen([b.left, b.top]);
      const label = id === "usb" ? w["tray.plug"] : w["tray.pick"].replace("{part}", partName(id));
      html += btn(id, { x, y, w: b.w * TRAY_SCALE * camK, h: b.h * TRAY_SCALE * camK }, label);
    }
    if (build.nano && build.usb) {
      const u = g.usbBox(build.nano);
      const [x, y] = toScreen([Math.max(u.left + u.w - 600, FRAME[0]), u.top]);
      const [x1, y1] = toScreen([u.left + u.w, u.top + 230]);
      html += btn("unplug", { x, y, w: x1 - x, h: y1 - y }, w["board.unplug"]);
    }
    if (keysEl.innerHTML !== html) keysEl.innerHTML = html;
  };
  keysEl.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>("[data-key]");
    if (!b || !g) return;
    const id = b.dataset.key!;
    if (id === "usb" || id === "unplug") {
      toggleUsb();
      return;
    }
    const p = id as Part;
    const ref = p === "nano" ? "3c" : p === "fsr" ? "24j" : "21b";
    const anchor = /^\d+[a-j]$/.test(cursor) && snapPart(p, 0, g.hole(cursor)).place ? cursor : ref;
    stage.focus();
    startCarry({ kind: "part", part: p, from: "tray", rot: 0, anchor });
  });

  // ---------------------------------------------------------------------------------------- undo, start over, show me
  const undo = () => {
    const h = history.pop();
    if (!h) return;
    build = h.build;
    sk = h.sk;
    sel = null;
    pending = null;
    verifyOut = null;
    sketchView.paint();
    paintVerify();
    commit();
  };
  const clearAll = (keep = true) => {
    if (keep) remember();
    build = EMPTY_BUILD;
    sk = emptyState();
    uploaded = null;
    sel = null;
    pending = null;
    lastFail = null;
    verifyOut = null;
    monitorBaud = 9600;
    baudSel.value = "9600";
    rn = null;
    verdict = null;
    resetSerial();
    sketchView.paint();
    paintVerify();
    commit();
  };
  $<HTMLButtonElement>('[data-act="undo"]').addEventListener("click", undo);
  $<HTMLButtonElement>('[data-act="clear"]').addEventListener("click", () => {
    clearAll();
    note(W()["note.cleared"]);
  });
  /** The build with the reference's parts (and wires) for the steps up to `upto`; the learner's other things stay when
   *  they still fit. */
  const withReference = (upto: "nano" | "parts" | "wires"): Build => {
    let b: Build = { ...EMPTY_BUILD, nano: REFERENCE_BUILD.nano };
    const keep: Build = build;
    const tryPart = (kind: PartKind, pl: PartPlace | null) => {
      if (!pl) return;
      const r = placePart(b, kind, pl);
      if (r.ok) b = r.build;
    };
    if (upto === "nano") {
      tryPart("fsr", keep.fsr);
      tryPart("resistor", keep.resistor);
    } else {
      tryPart("fsr", REFERENCE_BUILD.fsr);
      tryPart("resistor", REFERENCE_BUILD.resistor);
    }
    const wires = upto === "wires" ? REFERENCE_BUILD.wires : keep.wires;
    for (const w of wires) {
      const r = addWire(b, w.a, w.b, w.color, w.id);
      if (r.ok) b = r.build;
    }
    return { ...b, usb: keep.usb };
  };
  const showMe = () => {
    if (!data) return;
    remember();
    sel = null;
    pending = null;
    carry = null;
    if (view === "nano" || view === "parts" || view === "wires") {
      build = withReference(view);
      commit();
      return;
    }
    if (view === "sketch") {
      sk = stateOf(REFERENCE_SKETCH, sk.tiles);
      verifyOut = null;
      sketchView.paint();
      save();
      verify();
      paintAll();
      return;
    }
    // run: a build and a sketch that work (the learner's, when they do), the monitor at the sketch's rate, USB in, upload
    if (!checkWiring(build, readPin()).ok) build = { ...REFERENCE_BUILD };
    const v = run(build, sketchOf(sk), { monitorBaud: 9600 });
    if (!v.ok) {
      sk = stateOf(REFERENCE_SKETCH, sk.tiles);
      sketchView.paint();
      if (!run(build, sketchOf(sk), { monitorBaud: 9600 }).ok) build = { ...REFERENCE_BUILD };
    }
    const c = compile(sketchOf(sk));
    const begin = c.ok ? [...c.program.setup, ...c.program.loop].find((o) => o.kind === "begin") : undefined;
    monitorBaud = begin && begin.kind === "begin" && (MONITOR_BAUDS as readonly number[]).includes(begin.baud) ? begin.baud : 9600;
    baudSel.value = String(monitorBaud);
    build = plugUsb(build, true);
    commit();
    upload();
  };
  showBtn.addEventListener("click", showMe);

  // the panel's buttons
  $<HTMLButtonElement>('[data-act="verify"]').addEventListener("click", verify);
  $<HTMLButtonElement>('[data-act="usb"]').addEventListener("click", toggleUsb);
  uploadBtn.addEventListener("click", upload);
  baudSel.value = String(monitorBaud);
  baudSel.addEventListener("change", () => {
    monitorBaud = Number(baudSel.value) || 9600;
    save();
    restartBoard();
    paintStatus();
  });

  // ---------------------------------------------------------------------------------------- the frame loop (the running board)
  let raf = 0;
  let last = 0;
  let onScreen = true;
  const busyLoop = () => view === "run" && (Boolean(rn) || force > 0 || pressedNow());
  const frame = (now: number) => {
    raf = 0;
    if (!alive) return;
    const dt = last ? Math.min(100, now - last) : 16;
    last = now;
    const want = pressedNow() && build.fsr ? forceAt(levelNow()) : 0;
    const kk = reduced ? 1 : 1 - Math.exp(-dt / 85);
    force += (want - force) * kk;
    if (!pressedNow() && force < 0.2) force = 0;
    paintPress();
    if (rn && view === "run" && build.usb) {
      const ch = rn.step(dt, force);
      if (ch.text) {
        monText += ch.text;
        if (monText.length > 8000) monText = monText.slice(-6000);
      }
      for (const p of ch.points) points.push({ t: p.t, v: p.value });
      const cut = rn.t - WINDOW_MS - 400;
      while (points.length && points[0].t < cut) points.shift();
      paintSerial();
    }
    if (busyLoop() && onScreen && !document.hidden) raf = requestAnimationFrame(frame);
    else last = 0;
  };
  function kick() {
    if (!raf && alive && onScreen && !document.hidden) {
      last = 0;
      raf = requestAnimationFrame(frame);
    }
  }
  const io = new IntersectionObserver((es) => {
    onScreen = es.some((x) => x.isIntersecting);
    if (onScreen) kick();
  });
  io.observe(root);
  const onVis = () => !document.hidden && kick();
  document.addEventListener("visibilitychange", onVis);

  // ---------------------------------------------------------------------------------------- views and layout
  let moveTimer = 0;
  const show = (v: View, animate: boolean) => {
    const prev = view;
    view = v;
    root.dataset.view = v;
    if (prev !== v) {
      window.clearTimeout(noteTimer);
      noteEl.classList.remove("is-on");
      noteRaw = null;
    }
    if (drag) onCancel();
    if (carry) endCarry();
    pending = null;
    sel = null;
    pressActive = false;
    holdLevel = 0;
    if (v === "sketch") sketchView.paint();
    root.style.setProperty("--bb-panel", `${panelW(v)}px`);
    if (animate && prev !== v && !reduced) {
      root.classList.add("is-moving");
      window.clearTimeout(moveTimer);
      moveTimer = window.setTimeout(() => {
        root.classList.remove("is-moving");
        paintTools();
        paintKeys();
      }, 620);
    }
    fitCam(v);
    paintHint();
    paintAll();
    kick();
  };
  const onResize = () => {
    const r = root.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return;
    size = { w: r.width, h: r.height };
    root.toggleAttribute("data-narrow", narrow());
    root.style.setProperty("--bb-panel", `${panelW()}px`);
    if (!data) return;
    fitCam();
    paintTools();
    paintKeys();
  };
  const ro = new ResizeObserver(onResize);
  ro.observe(root);

  // ---------------------------------------------------------------------------------------- words on show
  const paintWords = () => {
    paintText(root, W());
    paintPalette();
    paintInside();
    sketchView.relabel();
    paintVerify();
    if (noteRaw && typeof noteRaw !== "string") note(noteRaw);
    if (heldWhy) paintHintHeld(heldWhy);
    else paintHint();
    if (data) paintAll();
  };

  // ---------------------------------------------------------------------------------------- start
  paintWords();
  const offTheme = ctx.onTheme((t) => {
    theme = t;
    loadPics(t);
  });
  const offLang = ctx.onLang(() => paintWords());
  loadData()
    .then((d) => {
      if (!alive) return;
      data = d;
      g = geometry(d);
      const W0 = 3600;
      ov.setAttribute("viewBox", `-400 -300 ${W0} 2600`);
      ov.style.left = "-400px";
      ov.style.top = "-300px";
      ov.style.width = `${W0}px`;
      ov.style.height = "2600px";
      litSvg.setAttribute("viewBox", `-400 -300 ${W0} 2600`);
      litSvg.style.left = "-400px";
      litSvg.style.top = "-300px";
      litSvg.style.width = `${W0}px`;
      litSvg.style.height = "2600px";
      cam.style.width = `${d.board.size[0]}px`;
      cam.style.height = `${d.board.size[1]}px`;
      paintPalette();
      onResize();
      loadPics(theme);
      if (uploaded && build.usb) restartBoard();
      show(view, false);
    })
    .catch((err: Error) => {
      root.classList.add("is-failed");
      $<HTMLElement>(".bb-kicker").textContent = err.message;
    });

  // ---------------------------------------------------------------------------------------- the code card
  let lastRun: Verdict | null = null;
  const sayRun = (): string[] => {
    if (!lastRun) return [];
    const v = lastRun;
    const w = W();
    const out = [w["run.head"], T(v.symptom.line), `→ ${T(v.symptom.hint)}`];
    if (v.stage === "run" && v.rest.value !== null && v.press.value !== null)
      out.push(w["run.values"].replace("{pin}", v.pin).replace("{rest}", String(v.rest.value)).replace("{press}", String(v.press.value)).replace("{f}", String(F_PRESS)));
    if (v.stage === "run") {
      out.push(w["run.mon"]);
      const lines = v.monitor.lines.slice(-3);
      if (!lines.length) out.push(w["run.empty"]);
      else for (const l of lines) out.push(l.length > 60 ? `${l.slice(0, 60)}…` : l);
    }
    return out;
  };

  return {
    view(v) {
      const want = VIEWS.includes(v?.view as View) ? (v!.view as View) : "nano";
      show(want, Boolean(data));
    },
    run() {
      lastRun = run({ ...build, usb: build.nano !== null }, REFERENCE_SKETCH, { monitorBaud: 9600, force: 0 });
      return sayRun();
    },
    say() {
      return sayRun();
    },
    layout() {
      onResize();
    },
    reset() {
      // (the steps' restart: the build goes, but Undo brings it back, and a note says so after the view moves to step 1)
      const had = Boolean(build.nano || build.fsr || build.resistor || build.wires.length || build.usb || sk.setup.length || sk.loop.length || uploaded);
      clearAll(had);
      if (had) window.setTimeout(() => alive && note(W()["note.cleared"]), 0);
    },
    destroy() {
      alive = false;
      cancelAnimationFrame(raf);
      cancelAnimationFrame(wireRaf);
      window.clearTimeout(busyTimer);
      window.clearTimeout(noteTimer);
      window.clearTimeout(moveTimer);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      sketchView.destroy();
      offTheme();
      offLang();
      root.remove();
    },
  };
}

