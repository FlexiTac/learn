// Lesson 2.2's workbench, "Build it and make it work" (PLAN-section2-build.md §2.2): the learner rebuilds lesson 2.1's
// circuit from nothing on a breadboard, puts the sketch together from code tiles, plugs in USB, uploads and presses.
// The bench is 3D (2026-11-12, ./build3d/scene.ts): the breadboard on a blue anti-static work mat, the parts waiting
// on the mat to its right, jumper wires between holes. Drag on empty space turns the view, the wheel zooms, a right drag pans; the corner
// has "from above" and "back to the start". Every part can be dragged at any step, from the pad to the board, about the
// board and back. A click on a part (or a wire, the cable, the board) opens a small card: what it is, where its pins
// are, and its tools (turn, back to the pad, remove). A panel on the right changes with the step (view):
//   nano    step 1: drag the Nano onto the board (it snaps across the groove); the panel shows the circuit to build
//   parts   step 2: the FSR and the 10 kΩ resistor (each can be turned); the panel lists what is joined
//   wires   step 3: drag from a hole to a hole (or click one, then the other) to lay a jumper wire in the chosen colour
//   sketch  step 4: the panel is the sketch builder (build-ui/sketch-ui.ts)
//   run     step 5: plug in USB, upload; the Serial Monitor (its baud rate can be changed) and Plotter come alive, and
//           the FSR can be pressed (press and hold, drag down for harder, as in lesson 2.1). Whatever is wrong fails the
//           way the engine says (./build/verdict.ts), with its line and hint, never a generic error.
// The panel's circuit diagram (build-ui/schematic.ts) lights each of its four links as the build makes it. The Hint
// button (build-ui/coach.ts; 2026-11-15, in place of "Show me", which did a whole step at once) says the next single
// thing to do, worked out from the learner's own build or sketch, marks where it goes (holes on the board, the part on
// the mat, the tile and its line), and its "Do this step" does that one thing; it follows along until it is closed.
// Every placement, wire and
// verdict comes from the engine (./build/: hole ids and pin names only); the scene turns them into millimetres. The holes
// joined inside the board light up while something is held over them. Keyboard: the board takes focus; the arrow keys
// move between holes, Enter picks up or starts a wire, Delete removes, R turns, Escape cancels; the pad's parts are
// buttons; the tiles have their own keys. The learner's build, sketch and monitor rate are saved in localStorage
// (try/catch) and come back; Start over (and reset(), the steps' restart) clears them, and Undo brings them back.
import { tx } from "../i18n";
import { paintText } from "../i18n/paint";
import type { Theme, WidgetCtx, WidgetInstance } from "../types";
import { badge } from "../ui/bits";
import { esc } from "../ui/dom";
import { icon } from "../ui/icons";
import { forceAt, MAX_CODE } from "./bench/fsr";
import {
  addWire,
  ALL_HOLES,
  checkNano,
  checkPart,
  checkWire,
  checkWireEnd,
  checkWiring,
  circuit,
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
  REFERENCE_SKETCH,
  removePart,
  removeWire,
  ROWS,
  run,
  runner,
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
import { createScene, PAD, TRAY_Z, type LitKind, type P2, type Scene3D, type Thing, type WireLook } from "./build3d/scene";
import { buildHint, hint, RUN, sketchHint, type Hint } from "./build-ui/coach";
import { schematic } from "./build-ui/schematic";
import { emptyState, sketchOf, sketchUi, stateOf, validState, type SketchState } from "./build-ui/sketch-ui";
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
const PITCH = 2.54;
/** The palette's swatches (the wires' rendered colours, a little lighter than their material). */
const SWATCH: Record<WireColor, string> = { red: "#bf3732", black: "#1f1f22", yellow: "#e2ad33", blue: "#2f5ea8", green: "#2f8a52" };
const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
const T = (t: Text) => tx(t.en, t.zh);
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const onPad = (p: P2 | null) => Boolean(p && p[0] >= PAD.x0 - 2 && p[0] <= PAD.x1 + 2 && p[1] >= PAD.y0 - 2 && p[1] <= PAD.y1 + 2);

interface Saved {
  v: 1;
  build: Build;
  sketch: SketchState;
  monitorBaud: number;
  color: WireColor;
  uploaded: Sketch | null;
}
type CardOf = { kind: Part | "usb" | "board" } | { kind: "wire"; id: string };

export function mount(el: HTMLElement, ctx: WidgetCtx): WidgetInstance {
  const reduced = ctx.reducedMotion();
  const root = document.createElement("div");
  root.className = "w-bb";
  root.dataset.view = "nano";
  root.setAttribute("role", "group");
  root.dataset.tAria = "aria";
  root.classList.toggle("is-reduced", reduced);
  const viewIcon = (top: boolean) =>
    top
      ? `<svg class="icon" viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="3" width="10" height="10" rx="1.5"/><path d="M3 8h10M8 3v10"/></svg>`
      : `<svg class="icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 10.5 8 13.5l5.5-3"/><path d="M2.5 7 8 10l5.5-3L8 4z"/></svg>`;
  root.innerHTML = `
    <div class="bb-stage" tabindex="0" role="application" data-t-aria="stageAria">
      <div class="bb-view"></div>
      <div class="bb-labels" aria-hidden="true"></div>
      <div class="bb-keys"></div>
      <div class="bb-chip mono" aria-hidden="true"></div>
      <div class="bb-card" role="dialog" hidden></div>
      <p class="bb-kicker mono" data-t="kicker"></p>
      <div class="bb-corner">
        <button type="button" class="bb-icon-btn" data-act="top"></button>
        <button type="button" class="bb-icon-btn" data-act="home" data-t-aria="view.home" data-t-title="view.home"><svg class="icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 8a5.5 5.5 0 1 0 1.6-3.9"/><path d="M2.3 2.2v3.1h3.1"/></svg></button>
        <button type="button" class="bb-icon-btn" data-act="undo" data-t-aria="undo" data-t-title="undo"><svg class="icon bb-undo-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M5.5 2 2.5 5l3 3"/><path d="M2.5 5h7a4 4 0 0 1 0 8H7"/></svg></button>
        <button type="button" class="bb-text-btn mono" data-act="clear" data-t="reset" data-t-aria="reset.aria"></button>
      </div>
      <div class="bb-note" role="status"></div>
      <div class="bb-foot">
        <div class="bb-palette" role="radiogroup" data-t-aria="palette"></div>
        <p class="bb-hint mono"></p>
        <button type="button" class="bb-show mono" aria-expanded="false"><span class="bb-show-icon"><svg class="icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M6 12.5h4M6.6 14.5h2.8"/><path d="M5.3 10.2a4.6 4.6 0 1 1 5.4 0c-.5.4-.7.9-.7 1.5v.3H6v-.3c0-.6-.2-1.1-.7-1.5z"/></svg></span><span data-t="coach.btn"></span></button>
      </div>
      <div class="bb-coach" role="status" hidden>
        <div class="bb-coach-head"><p class="bb-coach-cap mono"></p><button type="button" class="bb-card-x bb-coach-x" data-t-aria="coach.close" data-t-title="coach.close">${icon("close")}</button></div>
        <p class="bb-coach-text"></p>
        <button type="button" class="bb-coach-do mono" data-t="coach.do"></button>
      </div>
    </div>
    <aside class="bb-panel">
      <section class="bb-sec bb-inside">
        <p class="bb-cap mono" data-t="inside.cap"></p>
        <div class="bb-inside-fig"></div>
        <p class="bb-small" data-t="inside.note"></p>
      </section>
      <section class="bb-sec bb-schem"></section>
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
  const viewEl = $<HTMLElement>(".bb-view");
  const labelsEl = $<HTMLElement>(".bb-labels");
  const keysEl = $<HTMLElement>(".bb-keys");
  const chip = $<HTMLElement>(".bb-chip");
  const cardEl = $<HTMLElement>(".bb-card");
  const topBtn = $<HTMLButtonElement>('[data-act="top"]');
  const noteEl = $<HTMLElement>(".bb-note");
  const hintEl = $<HTMLElement>(".bb-hint");
  const palette = $<HTMLElement>(".bb-palette");
  const hintBtn = $<HTMLButtonElement>(".bb-show");
  const coachEl = $<HTMLElement>(".bb-coach");
  const coachCap = $<HTMLElement>(".bb-coach-cap");
  const coachText = $<HTMLElement>(".bb-coach-text");
  const coachDo = $<HTMLButtonElement>(".bb-coach-do");
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

  let theme: Theme = ctx.theme();
  let view: View = "nano";
  let alive = true;

  // ---------------------------------------------------------------------------------------- the scene
  let sc: Scene3D | null = null;
  try {
    sc = createScene(viewEl, theme);
  } catch (err) {
    // (no WebGL: say so where the bench would be; the panel still works)
    root.classList.add("is-failed");
    $<HTMLElement>(".bb-kicker").textContent = String((err as Error)?.message ?? err);
  }
  /** The board's holes in plan millimetres (the scene's), and the hole nearest a point. */
  const G = {
    pitch: PITCH,
    hole: (id: HoleId): P2 => sc!.hole(id),
    nearest(p: P2, reach = 0.55): HoleId | null {
      let best: HoleId | null = null;
      let bd = (reach * PITCH) ** 2;
      for (const id of ALL_HOLES) {
        const q = sc!.hole(id);
        const dd = (q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2;
        if (dd < bd) {
          bd = dd;
          best = id;
        }
      }
      return best;
    },
  };

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

  // ---------------------------------------------------------------------------------------- the panel's circuit diagram
  let schemHover = false;
  const schem = schematic({
    onHover: (holes) => {
      schemHover = Boolean(holes);
      setLit(holes ? [{ holes, kind: "join" }] : []);
    },
  });
  $<HTMLElement>(".bb-schem").append(schem.el);

  // ---------------------------------------------------------------------------------------- the camera's size
  let size = { w: 0, h: 0 };
  const panelW = (v: View = view) => {
    const w = size.w;
    if (v === "sketch") return Math.round(clamp(w * 0.4, 330, 440));
    if (v === "run") return Math.round(clamp(w * 0.31, 262, 340));
    return Math.round(clamp(w * 0.27, 250, 300));
  };
  const narrow = () => size.w < 620;
  const fitScene = () => {
    if (!sc) return;
    sc.resize(stage.clientWidth, stage.clientHeight);
  };

  // ---------------------------------------------------------------------------------------- the parts, the wires, the paint on the board
  type Sel = { kind: "wire"; id: string } | { kind: "part"; part: Part } | null;
  let sel: Sel = null;
  let pending: HoleId | null = null; // a wire started by a click, waiting for its other end
  let pointerPlan: P2 | null = null;
  let litGroups: { holes: HoleId[]; kind: LitKind }[] = [];
  let markOk: HoleId[] = [];
  let markBad: P2[] = [];
  const setLit = (groups: { holes: HoleId[]; kind: LitKind }[]) => {
    litGroups = groups;
    paintMarks();
  };
  const paintMarks = () => {
    if (!sc) return;
    const cardPart = card && (card.kind === "nano" || card.kind === "fsr" || card.kind === "resistor") ? card.kind : null;
    sc.setMarks({
      lit: litGroups,
      ok: markOk,
      bad: markBad,
      cursor: kbd && document.activeElement === stage && !carry ? cursor : null,
      start: pending,
      sel: !(drag?.kind === "part" && drag.on) && !carry ? (sel?.kind === "part" ? sel.part : cardPart) : null,
      coach: coachNow && (coachNow.marks.holes.length || coachNow.marks.pairs.length) ? { holes: coachNow.marks.holes, pairs: coachNow.marks.pairs, nano: coachNow.marks.nano } : null,
    });
  };
  const paintParts = () => {
    if (!sc) return;
    for (const p of PARTS) {
      if (drag?.kind === "part" && drag.part === p && drag.on) sc.setPart(p, { held: drag.at, rot: drag.rot, snap: drag.snap });
      else if (carry?.kind === "part" && carry.part === p) {
        const s = snapPart(p, carry.rot, G.hole(carry.anchor));
        sc.setPart(p, { held: G.hole(carry.anchor), rot: carry.rot, snap: s.place });
      } else {
        const pl = build[p];
        sc.setPart(p, pl ? { place: pl } : null);
      }
    }
    const nanoMoving = (drag?.kind === "part" && drag.part === "nano" && drag.on) || (carry?.kind === "part" && carry.part === "nano");
    sc.setUsb(build.nano && build.usb ? (nanoMoving ? "hidden" : "plugged") : "tray");
  };
  const paintWires = () => {
    if (!sc) return;
    const looks: WireLook[] = [];
    build.wires.forEach((w, i) => {
      const moving = drag?.kind === "end" && drag.on && drag.id === w.id;
      const kmove = carry?.kind === "end" && carry.id === w.id;
      if (moving || kmove) {
        const fixedEnd = (drag?.kind === "end" ? drag.end : carry!.end) === "a" ? w.b : w.a;
        const to = drag?.kind === "end" ? (drag.snap ? G.hole(drag.snap) : drag.to) : G.hole(carry!.hole!);
        const open = drag?.kind === "end" ? !drag.snap : false;
        looks.push({ id: w.id, a: G.hole(fixedEnd), b: to, color: w.color, index: i, open, ghost: true, selected: true });
        return;
      }
      looks.push({ id: w.id, a: G.hole(w.a), b: G.hole(w.b), color: w.color, index: i, selected: (sel?.kind === "wire" && sel.id === w.id) || (card?.kind === "wire" && card.id === w.id) || coachNow?.marks.wire === w.id });
    });
    // a wire being laid: from its first hole to the pointer (or the hole it would go in)
    const from = drag?.kind === "wire" && drag.on ? drag.from : pending;
    if (from) {
      const snap = drag?.kind === "wire" ? drag.snap : hoverHole && hoverHole !== pending && holeFree(build, hoverHole).ok ? hoverHole : null;
      const to = snap ? G.hole(snap) : drag?.kind === "wire" ? drag.to : (pointerPlan ?? kbdTarget());
      if (to) looks.push({ id: "new", a: G.hole(from), b: to, color, index: build.wires.length, open: !snap, ghost: true });
    }
    sc.setWires(looks);
  };
  const kbdTarget = (): P2 | null => (kbd && pending && cursor !== pending ? G.hole(cursor) : null);

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
    schem.paint(build, readPin());
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
    paintPress();
    paintCoach();
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

  // ---------------------------------------------------------------------------------------- the press, the board's lights
  let level = 0.42;
  let pressActive = false;
  let holdLevel = 0;
  let force = 0;
  let txUntil = 0;
  let powered = false;
  const pressedNow = () => pressActive || holdLevel > 0;
  const levelNow = () => (pressActive ? level : holdLevel > 0 ? holdLevel : level);
  const paintPress = () => {
    const p = force > 0 ? 0.35 + (0.65 * Math.log(force / 0.2)) / Math.log(100) : 0;
    root.style.setProperty("--bb-press", p.toFixed(3));
    root.classList.toggle("is-pressed", force > 0);
    sc?.setPress(p, force > 0, view === "run" && Boolean(build.fsr) && Boolean(verdict?.ok));
    sc?.setLeds({ on: powered, tx: powered && performance.now() < txUntil });
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
  let turned = false;
  const paintHint = () => {
    const w = W();
    let h = "";
    if (view === "nano") h = build.nano ? (turned ? w["hint.look"] : w["hint.view"]) : w["hint.nano"];
    else if (view === "parts") h = w["hint.parts"];
    else if (view === "wires") h = w["hint.wires"];
    else if (view === "run") h = verdict?.stage === "run" && build.fsr && build.usb ? w["hint.press"] : verdict || lastFail || build.usb ? "" : w["hint.run"];
    hintEl.textContent = h;
    hintBtn.setAttribute("aria-label", w["coach.aria"]);
  };
  const paintPalette = () => {
    const w = W();
    palette.innerHTML = WIRE_COLORS.map((c) => `<button type="button" role="radio" class="bb-swatch" data-color="${c}" aria-checked="${c === color}" tabindex="${c === color ? 0 : -1}" aria-label="${esc(w[c])}" title="${esc(w[c])}" style="--sw:${SWATCH[c]}"></button>`).join("");
  };
  const pickColor = (c: WireColor) => {
    color = c;
    const wid = sel?.kind === "wire" ? sel.id : card?.kind === "wire" ? card.id : null;
    if (wid) {
      remember();
      build = recolorWire(build, wid, color);
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
  let fromAbove = false;
  /** What the camera frames by default in a step: the whole bench while parts come off the pad, the board for wiring. */
  const frameOf = (v: View): "all" | "board" => (v === "wires" || v === "run" ? "board" : "all");
  const paintCorner = () => {
    $<HTMLButtonElement>('[data-act="undo"]').disabled = !history.length;
    const w = W();
    const label = fromAbove ? w["view.tilt"] : w["view.top"];
    topBtn.innerHTML = viewIcon(!fromAbove);
    topBtn.setAttribute("aria-label", label);
    topBtn.title = label;
    topBtn.setAttribute("aria-pressed", String(fromAbove));
  };
  topBtn.addEventListener("click", () => {
    fromAbove = !fromAbove;
    sc?.home(fromAbove, frameOf(view));
    paintCorner();
  });
  $<HTMLButtonElement>('[data-act="home"]').addEventListener("click", () => {
    fromAbove = false;
    sc?.home(false, frameOf(view));
    paintCorner();
  });

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

  // ---------------------------------------------------------------------------------------- the card: what a thing is
  let card: CardOf | null = null;
  let cardAt: P2 | null = null; // (the board's card: where it was clicked, canvas px)
  const openCard = (c: CardOf | null, at: P2 | null = null) => {
    card = c;
    cardAt = at;
    paintCard();
    paintMarks();
    paintWires();
  };
  const pinsLine = (p: Part): string => {
    const pl = build[p];
    if (!pl) return "";
    if (p === "nano") {
      const ps = nanoPins(pl as NanoPlace);
      return ["5V", "A0", "GND"]
        .map((n) => ps.find((x) => x.pin.name === n))
        .map((x) => (x ? `${x.pin.name} ${x.hole}` : ""))
        .filter(Boolean)
        .join(" · ");
    }
    const ps = pinsOf(p, pl as PartPlace);
    return ps ? `${ps["1"]} · ${ps["2"]}` : "";
  };
  const paintCard = () => {
    if (!card || !sc) {
      cardEl.hidden = true;
      cardEl.innerHTML = "";
      return;
    }
    const w = W();
    const c = card;
    const kind = c.kind;
    const title = kind === "wire" ? w.wire : kind === "board" ? w.board : partName(kind);
    const text = w[`info.${kind}` as "info.nano"];
    let extra = "";
    let tools = "";
    if (kind === "nano" || kind === "fsr" || kind === "resistor") {
      if (build[kind]) {
        extra = `<p class="bb-card-pins mono">${esc(w["info.where"].replace("{holes}", pinsLine(kind)))}</p>`;
        if (kind !== "nano") tools += `<button type="button" class="bb-card-btn mono" data-tool="turn"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M12.5 6.5A5 5 0 1 0 13 10"/><path d="M13 2.8v3.9H9.1"/></svg><span>${esc(w.turn)}</span><kbd>R</kbd></button>`;
        tools += `<button type="button" class="bb-card-btn mono" data-tool="tray">${icon("close")}<span>${esc(w.toTray)}</span></button>`;
      } else extra = `<p class="bb-card-pins mono">${esc(w["info.inTray"])}</p>`;
    } else if (kind === "wire") {
      const wire = build.wires.find((x) => x.id === c.id);
      if (wire) extra = `<p class="bb-card-pins mono">${esc(`${wire.a} → ${wire.b}`)}</p>`;
      tools += `<button type="button" class="bb-card-btn mono" data-tool="delete">${icon("close")}<span>${esc(w.deleteWire)}</span></button>`;
    } else if (kind === "usb") {
      tools += `<button type="button" class="bb-card-btn mono" data-tool="usb">${icon("usb")}<span>${esc(build.usb ? w["usb.in"] : w["usb.out"])}</span></button>`;
    }
    cardEl.innerHTML = `<div class="bb-card-head"><p class="bb-card-title">${esc(title)}</p><button type="button" class="bb-card-x" data-tool="close" aria-label="${esc(w["info.close"])}" title="${esc(w["info.close"])}">${icon("close")}</button></div><p class="bb-card-text">${esc(text)}</p>${extra}${tools ? `<div class="bb-card-tools">${tools}</div>` : ""}`;
    cardEl.setAttribute("aria-label", title);
    cardEl.hidden = false;
    placeCard();
  };
  /** The card sits above its thing (below it when there is no room), inside the bench. */
  const placeCard = () => {
    if (!card || !sc || cardEl.hidden) return;
    let a: P2 | null = null;
    if (card.kind === "board") a = cardAt;
    else if (card.kind === "wire") {
      const cid = card.id;
      const wire = build.wires.find((x) => x.id === cid);
      if (wire) {
        const pa = G.hole(wire.a);
        const pb = G.hole(wire.b);
        a = sc.toScreen([(pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2, 22]);
      }
    } else a = sc.partTop(card.kind);
    if (!a) {
      cardEl.style.visibility = "hidden";
      return;
    }
    cardEl.style.visibility = "";
    const sw = stage.clientWidth;
    const sh = stage.clientHeight;
    const cw = cardEl.offsetWidth;
    const ch = cardEl.offsetHeight;
    let x = a[0] - cw / 2;
    let y = a[1] - ch - 14;
    if (y < 44) y = a[1] + 26;
    x = clamp(x, 10, sw - cw - 10);
    y = clamp(y, 44, sh - ch - 64);
    cardEl.style.transform = `translate(${x.toFixed(0)}px, ${y.toFixed(0)}px)`;
  };
  cardEl.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>("[data-tool]");
    if (!b) return;
    const t = b.dataset.tool;
    if (t === "close") {
      sel = null;
      openCard(null);
      return;
    }
    if (t === "delete" && card?.kind === "wire") {
      remember();
      build = removeWire(build, card.id);
      sel = null;
      card = null;
      announce(W()["live.wireGone"]);
      commit();
    } else if (t === "tray" && card && (card.kind === "nano" || card.kind === "fsr" || card.kind === "resistor")) {
      const p = card.kind;
      remember();
      build = removePart(build, p);
      sel = null;
      announce(W()["live.back"].replace("{part}", partName(p)));
      commit();
    } else if (t === "turn" && card && (card.kind === "fsr" || card.kind === "resistor")) turn(card.kind);
    else if (t === "usb") toggleUsb();
  });

  // ---------------------------------------------------------------------------------------- one commit
  /** After every change to the build: save, draw, and let the running board feel it. */
  const commit = () => {
    save();
    const sw = sel?.kind === "wire" ? sel.id : null;
    if (sw && !build.wires.some((w) => w.id === sw)) sel = null;
    if (sel?.kind === "part" && !build[sel.part]) sel = null;
    if (card?.kind === "wire" && !build.wires.some((w) => w.id === (card as { id: string }).id)) card = null;
    if (pending && !holeFree(build, pending).ok) pending = null;
    if (lastFail?.s.id === "no-usb" && build.usb) lastFail = null;
    powered = circuit(build).power.state === "on";
    if (uploaded) restartBoard();
    paintAll();
  };
  const paintAll = () => {
    paintParts();
    paintWires();
    paintMarks();
    paintCard();
    paintKeys();
    if (BUILD_VIEWS.has(view)) paintPanelBuild();
    paintStatus();
    paintCorner();
    root.classList.toggle("has-palette", view === "wires" || sel?.kind === "wire" || card?.kind === "wire" || Boolean(pending));
  };

  // ---------------------------------------------------------------------------------------- pointer: what is under it
  type Drag =
    | { kind: "part"; part: Part; from: "tray" | "board"; rot: Rot; grab: P2; at: P2; x0: number; y0: number; on: boolean; snap: NanoPlace | PartPlace | null; why: Text[] | null; pid: number }
    | { kind: "wire"; from: HoleId; to: P2; snap: HoleId | null; x0: number; y0: number; on: boolean; pid: number }
    | { kind: "end"; id: string; end: "a" | "b"; from: HoleId; to: P2; snap: HoleId | null; x0: number; y0: number; on: boolean; pid: number }
    | { kind: "press"; y0: number; level0: number; pid: number }
    | { kind: "click"; what: "usb" | "wire"; id?: string; x0: number; y0: number; pid: number };
  let drag: Drag | null = null;
  /** A press on empty space, which the camera takes (a click there, without moving, puts things down). */
  let idle: { x0: number; y0: number; pid: number; thing: Thing | null; plan: P2 | null } | null = null;
  let hoverHole: HoleId | null = null;

  const anchorOf = (p: Part, pl: NanoPlace | PartPlace): P2 => (p === "nano" ? G.hole(`${(pl as NanoPlace).col}${(pl as NanoPlace).row}`) : G.hole((pl as PartPlace).at));

  /** Where a part held with its anchor pin at `a` (plan mm) would go, or why it can't. */
  const snapPart = (p: Part, rot: Rot, a: P2): { place: NanoPlace | PartPlace | null; why: Text[] | null; near: P2[] } => {
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
  const pinHoles = (p: Part, pl: NanoPlace | PartPlace): HoleId[] => (p === "nano" ? nanoPins(pl as NanoPlace).map((x) => x.hole) : Object.values(pinsOf(p, pl as PartPlace) ?? {}));
  const showHeld = (p: Part, snap: NanoPlace | PartPlace | null, near: P2[]) => {
    if (snap) {
      litGroups = pinGroups(p, snap);
      markOk = pinHoles(p, snap);
      markBad = [];
    } else {
      litGroups = [];
      markOk = [];
      markBad = near;
    }
    paintParts();
    paintMarks();
  };
  const clearHeld = () => {
    markOk = [];
    markBad = [];
    litGroups = [];
    paintMarks();
  };

  /** A free hole right under a plan point (a jumper arcs over the holes it crosses, so they stay usable). */
  const freeHoleUnder = (p: P2 | null): HoleId | null => {
    if (!p) return null;
    const h = G.nearest(p, 0.45);
    return h && holeFree(build, h).ok ? h : null;
  };
  const onBoard = (p: P2 | null) => Boolean(p && p[0] >= -0.5 && p[0] <= 83 && p[1] >= -0.5 && p[1] <= 55.1);

  const onDown = (e: PointerEvent) => {
    if (!sc || drag || e.button !== 0) return;
    if ((e.target as HTMLElement).closest("button, input, select, .bb-note, .bb-card")) return;
    kbd = false;
    hideChip();
    pointerFocus = true;
    stage.focus({ preventScroll: true });
    pointerFocus = false;
    const t = sc.pick(e.clientX, e.clientY);
    const p = sc.planAt(e.clientX, e.clientY);
    const base = { x0: e.clientX, y0: e.clientY, pid: e.pointerId };
    const take = () => {
      sc!.orbit(false);
      stage.setPointerCapture(e.pointerId);
      e.preventDefault();
      e.stopPropagation();
    };
    // with a wire waiting for its other end, a free hole under the pointer wins
    const free = freeHoleUnder(p);
    if (pending && free && onBoard(p) && t?.kind !== "part") {
      finishWire(free);
      take();
      drag = { kind: "click", what: "wire", ...base };
      return;
    }
    if (t?.kind === "end" && !pending) {
      const w = build.wires.find((x) => x.id === t.id);
      if (w) {
        drag = { kind: "end", id: t.id, end: t.end, from: w[t.end], to: p ?? G.hole(w[t.end]), snap: null, on: false, ...base };
        take();
        return;
      }
    }
    if (t?.kind === "wire" && !pending) {
      drag = { kind: "click", what: "wire", id: t.id, ...base };
      take();
      return;
    }
    if (t?.kind === "part" && t.part === "fsr" && t.zone === "disc" && view === "run" && build.fsr && !pending) {
      // the sensor's disc, once there is something to read it
      drag = { kind: "press", y0: e.clientY, level0: level, pid: e.pointerId };
      pressActive = true;
      root.classList.add("was-pressed");
      kick();
      take();
      return;
    }
    if (t?.kind === "part" && !pending) {
      const part = t.part;
      const pl = build[part];
      const a = pl ? anchorOf(part, pl) : sc.trayAnchor(part);
      // (a part on the mat lies lower than the board's plane: where the pointer meets the mat is where it was taken)
      const q = (pl ? p : sc.planAt(e.clientX, e.clientY, TRAY_Z)) ?? a;
      drag = { kind: "part", part, from: pl ? "board" : "tray", rot: part === "nano" || !pl ? 0 : (pl as PartPlace).rot, grab: [a[0] - q[0], a[1] - q[1]], at: a, on: false, snap: null, why: null, ...base };
      take();
      return;
    }
    if (t?.kind === "usb" && !pending) {
      drag = { kind: "click", what: "usb", ...base };
      take();
      return;
    }
    if (free && onBoard(p) && (!t || t.kind === "board")) {
      drag = { kind: "wire", from: free, to: p!, snap: null, on: false, ...base };
      take();
      return;
    }
    // empty space (or the board's margin, the pad): the camera's; a click there puts things down
    idle = { ...base, thing: t, plan: p };
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
  let heldWhy: Text[] | null = null;
  const paintHintHeld = (why: Text[] | null) => {
    heldWhy = why;
    if (why) hintEl.textContent = T(why[0]);
    else paintHint();
    hintEl.classList.toggle("is-why", Boolean(why));
  };
  // (a drag's pointer move is handled at once, so the part is drawn where the pointer is in the same frame; moves that
  // come in a burst, within a few milliseconds, wait for the next frame and only the latest counts)
  let moveEv: PointerEvent | null = null;
  let moveRaf = 0;
  let movedAt = 0;
  const flushMove = () => {
    if (moveRaf) cancelAnimationFrame(moveRaf);
    moveRaf = 0;
    const ev = moveEv;
    moveEv = null;
    movedAt = performance.now();
    if (alive && ev && drag) moveNow(ev);
  };
  const onMove = (e: PointerEvent) => {
    if (!sc) return;
    if (!drag) {
      queueHover(e);
      return;
    }
    if (e.pointerId !== drag.pid) return;
    moveEv = e;
    if (performance.now() - movedAt > 6) flushMove();
    else if (!moveRaf) moveRaf = requestAnimationFrame(flushMove);
  };
  /** What the part, wire or press in the hand does at a pointer position (the board's marks change only when the
   *  spot it would go changes). */
  let heldKey = "";
  const moveNow = (e: PointerEvent) => {
    if (!sc || !drag) return;
    const p = sc.planAt(e.clientX, e.clientY);
    pointerPlan = p;
    if (drag.kind === "press") {
      level = clamp(drag.level0 + (e.clientY - drag.y0) / 140, 0, 1);
      kick();
      return;
    }
    if (drag.kind === "click") return;
    if (!drag.on) {
      if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 5) return;
      drag.on = true;
      sel = drag.kind === "end" ? { kind: "wire", id: drag.id } : null;
      card = null;
      paintCard();
      root.classList.add("is-holding");
      hideChip();
      heldKey = "";
    }
    if (!p) return;
    if (drag.kind === "part") {
      const a: P2 = [p[0] + drag.grab[0], p[1] + drag.grab[1]];
      const s = snapPart(drag.part, drag.rot, a);
      // (over the parts' corner of the mat, it goes back: no marks, no reasons)
      const toTray = onPad(sc.planAt(e.clientX, e.clientY, TRAY_Z)) && !s.place;
      drag.at = a;
      drag.snap = s.place;
      drag.why = s.why;
      const key = JSON.stringify([s.place, toTray ? [] : s.near, toTray]);
      if (key !== heldKey) {
        heldKey = key;
        showHeld(drag.part, s.place, toTray ? [] : s.near);
        paintHintHeld(toTray ? null : s.why);
      } else paintParts();
    } else if (drag.kind === "wire" || drag.kind === "end") {
      drag.to = p;
      const h = G.nearest(p, 0.5);
      const ok = h && (drag.kind === "wire" ? h !== drag.from && holeFree(build, h).ok : checkWireEnd(build, drag.id, drag.end, h).ok);
      const before = drag.snap;
      drag.snap = ok ? h : null;
      if (drag.snap === before && heldKey === "wire") {
        // (the same hole as last time, or none: only the loose end moves)
        paintWires();
        return;
      }
      heldKey = "wire";
      const groups: { holes: HoleId[]; kind: LitKind }[] = [];
      if (drag.kind === "wire") groups.push({ holes: joinedHoles(build, drag.from), kind: "join" });
      else {
        const w = build.wires.find((x) => x.id === (drag as { id: string }).id)!;
        const fixed = drag.end === "a" ? w.b : w.a;
        groups.push({ holes: joinedHoles(removeWire(build, w.id), fixed), kind: "join" });
      }
      if (drag.snap) groups.push({ holes: joinedHoles(drag.kind === "end" ? removeWire(build, drag.id) : build, drag.snap), kind: "join" });
      litGroups = groups;
      paintWires();
      paintMarks();
    }
  };
  const onUp = (e: PointerEvent) => {
    if (drag && e.pointerId === drag.pid) flushMove();
    if (idle && e.pointerId === idle.pid) {
      const i = idle;
      idle = null;
      if (Math.hypot(e.clientX - i.x0, e.clientY - i.y0) <= 5) clickEmpty(i, e);
      return;
    }
    if (!drag || e.pointerId !== drag.pid) return;
    const d = drag;
    drag = null;
    sc?.orbit(true);
    root.classList.remove("is-holding");
    if (stage.hasPointerCapture(e.pointerId)) stage.releasePointerCapture(e.pointerId);
    const p = sc?.planAt(e.clientX, e.clientY) ?? null;
    if (d.kind === "press") {
      pressActive = false;
      kick();
      return;
    }
    if (d.kind === "click") {
      if (Math.hypot(e.clientX - d.x0, e.clientY - d.y0) > 6) return;
      if (d.what === "wire" && d.id) {
        const same1 = card?.kind === "wire" && card.id === d.id;
        sel = same1 ? null : { kind: "wire", id: d.id };
        const w = build.wires.find((x) => x.id === d.id);
        if (w && sel) {
          color = w.color;
          paintPalette();
        }
        openCard(same1 ? null : { kind: "wire", id: d.id });
        paintAll();
      } else if (d.what === "usb") {
        if (card?.kind === "usb") toggleUsb();
        else {
          if (!build.usb && build.nano) toggleUsb();
          openCard({ kind: "usb" });
        }
      }
      return;
    }
    if (!d.on) {
      // a click
      if (d.kind === "wire") {
        pending = d.from;
        sel = null;
        card = null;
        announce(W()["live.wireStart"].replace("{hole}", d.from));
        paintAll();
      } else if (d.kind === "end") {
        const same1 = card?.kind === "wire" && card.id === d.id;
        sel = same1 ? null : { kind: "wire", id: d.id };
        const w = build.wires.find((x) => x.id === d.id);
        if (w && sel) {
          color = w.color;
          paintPalette();
        }
        openCard(same1 ? null : { kind: "wire", id: d.id });
        paintAll();
      } else if (d.kind === "part") {
        const same1 = card?.kind === d.part;
        sel = !same1 && d.from === "board" ? { kind: "part", part: d.part } : null;
        openCard(same1 ? null : { kind: d.part });
        paintAll();
      }
      return;
    }
    paintHintHeld(null);
    clearHeld();
    if (d.kind === "part") {
      if (onPad(sc?.planAt(e.clientX, e.clientY, TRAY_Z) ?? null) && !d.snap) {
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
        const h = p ? G.nearest(p, 0.5) : null;
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
        const h = p ? G.nearest(p, 0.5) : null;
        if (h && h !== d.from) {
          const c = checkWireEnd(build, d.id, d.end, h);
          if (!c.ok) note([c.text]);
        }
      }
      paintAll();
    }
  };
  /** A click on empty space: a waiting wire is let go (with why, over a used hole), a pick is put down; a click on the
   *  board's margin opens the board's card. */
  const clickEmpty = (i: { thing: Thing | null; plan: P2 | null }, e: PointerEvent) => {
    if (pending) {
      const h = i.plan ? G.nearest(i.plan, 0.5) : null;
      const c = h ? checkWire(build, pending, h) : null;
      if (c && !c.ok) note([c.text]);
      pending = null;
    }
    sel = null;
    const r = stage.getBoundingClientRect();
    if (i.thing?.kind === "board" && card?.kind !== "board") openCard({ kind: "board" }, [e.clientX - r.left, e.clientY - r.top]);
    else openCard(null);
    paintAll();
  };
  const onCancel = () => {
    idle = null;
    if (moveRaf) cancelAnimationFrame(moveRaf);
    moveRaf = 0;
    moveEv = null;
    if (!drag) return;
    if (drag.kind === "press") pressActive = false;
    drag = null;
    sc?.orbit(true);
    root.classList.remove("is-holding");
    paintHintHeld(null);
    clearHeld();
    paintAll();
  };
  stage.addEventListener("pointerdown", onDown, true);
  stage.addEventListener("pointermove", onMove);
  stage.addEventListener("pointerup", onUp);
  stage.addEventListener("pointercancel", onCancel);
  stage.addEventListener("pointerleave", () => {
    pointerPlan = null;
    if (!drag) {
      hoverHole = null;
      hideChip();
      if (connHover < 0 && !schemHover) setLit([]);
      root.dataset.cursor = "";
      if (pending) paintWires();
    }
  });

  // hover: what a hole joins (a chip by the pointer, its strip or net lit), what the pointer would pick up
  let nlMemo: { b: Build; nl: ReturnType<typeof netlist> } | null = null;
  const nlNow = () => {
    if (!nlMemo || nlMemo.b !== build) nlMemo = { b: build, nl: netlist(build) };
    return nlMemo.nl;
  };
  const whatJoined = (h: HoleId): string => {
    const net = nlNow().netOfHole(h);
    if (!net) return "";
    const items: Text[] = [...net.nano.map((n) => ({ en: n, zh: n })), ...net.fsr.map((n) => say("itemFsr", { n })), ...(net.resistor.length === 2 ? [say("itemResBoth")] : net.resistor.length ? [say("itemRes")] : [])];
    return items.slice(0, 3).map(T).join(" — ") + (items.length > 3 ? " …" : "");
  };
  const hideChip = () => chip.classList.remove("is-on");
  let hoverRaf = 0;
  let hoverEv: { clientX: number; clientY: number } | null = null;
  let hoveredAt = 0;
  const queueHover = (e: PointerEvent) => {
    hoverEv = { clientX: e.clientX, clientY: e.clientY };
    const go = () => {
      if (hoverRaf) cancelAnimationFrame(hoverRaf);
      hoverRaf = 0;
      hoveredAt = performance.now();
      if (alive && hoverEv && !drag) hover(hoverEv);
    };
    // (at once, unless the last one was a few milliseconds ago: then on the next frame, the latest only)
    if (performance.now() - hoveredAt > 6) go();
    else if (!hoverRaf) hoverRaf = requestAnimationFrame(go);
  };
  const hover = (e: { clientX: number; clientY: number }) => {
    if (!sc || idle) return;
    const p = sc.planAt(e.clientX, e.clientY);
    pointerPlan = p;
    const t = sc.pick(e.clientX, e.clientY);
    let cur = "";
    if (view === "run" && build.fsr && t?.kind === "part" && t.part === "fsr" && t.zone === "disc") cur = "press";
    else if (t && (t.kind === "part" || t.kind === "end")) cur = "grab";
    else if (t && (t.kind === "wire" || t.kind === "usb")) cur = "pointer";
    // (a hole names itself only when nothing stands in front of it)
    const near = p && onBoard(p) && (!t || t.kind === "board") ? G.nearest(p, 0.5) : null;
    const h = near;
    if (!cur && h) cur = "hole";
    root.dataset.cursor = cur;
    if (h !== hoverHole) {
      hoverHole = h;
      if (connHover < 0 && !schemHover) setLit(h ? [{ holes: joinedHoles(build, h), kind: "join" }] : []);
    }
    if (pending) paintWires();
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
      const cands = ALL_HOLES.filter((id) => (/^(TP|TN|BP|BN)/.test(rowName) ? id.startsWith(rowName) && /^\D+\d+$/.test(id) : id.endsWith(rowName) && /^\d+[a-j]$/.test(id)));
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
    if (!carry) return;
    if (carry.kind === "part") {
      const a = G.hole(carry.anchor);
      const s = snapPart(carry.part, carry.rot, a);
      showHeld(carry.part, s.place, s.near);
      paintHintHeld(s.why);
    } else {
      paintWires();
      setLit([{ holes: joinedHoles(removeWire(build, carry.id), carry.hole), kind: "join" }]);
    }
  };
  const startCarry = (c: Carry) => {
    carry = c;
    sel = c.kind === "part" && c.from === "board" ? { kind: "part", part: c.part } : c.kind === "end" ? { kind: "wire", id: c.id } : null;
    card = null;
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
    if (!sc || e.target !== stage) return;
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
        const s = snapPart(carry.part, carry.rot, G.hole(next));
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
      } else if (sel || card) {
        sel = null;
        openCard(null);
        paintAll();
      }
      return;
    }
    if (k === "r" || k === "R") {
      if (drag?.kind === "part" && drag.part !== "nano") {
        // (a part held by the pointer turns about its first pin, which stays where it is)
        drag.rot = drag.rot === 0 ? 90 : 0;
        const s = snapPart(drag.part, drag.rot, drag.at);
        drag.snap = s.place;
        drag.why = s.why;
        showHeld(drag.part, s.place, s.near);
        paintHintHeld(s.why);
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
        card = null;
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
        const s = snapPart(carry.part, carry.rot, G.hole(carry.anchor));
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

  // the pad's parts and the plug as buttons, for the keyboard (placed over them), and their names under them; made once
  // and then only moved, since the camera moves them every frame it turns
  const keyEls = new Map<string, HTMLButtonElement>();
  const labelEls = new Map<string, HTMLSpanElement>();
  const dotEls = new Map<string, HTMLSpanElement>();
  const paintKeys = () => {
    if (!sc) return;
    const w = W();
    const keys = new Set<string>();
    const labels = new Set<string>();
    const key = (id: string, b: { x: number; y: number; w: number; h: number }, label: string) => {
      let el = keyEls.get(id);
      if (!el) {
        el = document.createElement("button");
        el.type = "button";
        el.className = "bb-key";
        el.dataset.key = id;
        keysEl.append(el);
        keyEls.set(id, el);
      }
      if (el.getAttribute("aria-label") !== label) el.setAttribute("aria-label", label);
      el.style.cssText = `left:${b.x.toFixed(0)}px;top:${b.y.toFixed(0)}px;width:${b.w.toFixed(0)}px;height:${b.h.toFixed(0)}px`;
      keys.add(id);
    };
    const name = (id: string, at: P2, text: string) => {
      let el = labelEls.get(id);
      if (!el) {
        el = document.createElement("span");
        el.className = "bb-label mono";
        labelsEl.append(el);
        labelEls.set(id, el);
      }
      if (el.textContent !== text) el.textContent = text;
      el.style.transform = `translate(${at[0].toFixed(0)}px, ${at[1].toFixed(0)}px)`;
      labels.add(id);
    };
    for (const id of ["nano", "fsr", "resistor", "usb"] as const) {
      const held = (drag?.kind === "part" && drag.on && drag.part === id) || (carry?.kind === "part" && carry.part === id);
      const b = held ? null : sc.trayBox(id);
      if (!b) continue;
      key(id, b, id === "usb" ? w["tray.plug"] : w["tray.pick"].replace("{part}", partName(id)));
      keyEls.get(id)!.classList.toggle("is-coach", coachNow?.marks.tray === id);
      const under = id === "usb" ? sc.toScreen([PAD.x0 + 38, PAD.y1 - 0.5, TRAY_Z]) : ([b.x + b.w / 2, b.y + b.h + 3] as P2);
      if (under) name(id, under, w[`label.${id}`]);
    }
    if (build.nano && build.usb) {
      const top = sc.partTop("usb");
      if (top) key("unplug", { x: top[0] - 30, y: top[1], w: 60, h: 40 }, w["board.unplug"]);
    }
    for (const [id, el] of keyEls) if (!keys.has(id)) (el.remove(), keyEls.delete(id));
    for (const [id, el] of labelEls) if (!labels.has(id)) (el.remove(), labelEls.delete(id));
    // the Hint's holes (a few at most; the Nano's thirty get an outline instead), pulsing over the board
    const dots = new Set<string>();
    const cm = coachNow?.marks;
    if (cm && !cm.nano && cm.holes.length <= 4)
      for (const h of cm.holes) {
        const at = sc.toScreen([...G.hole(h), 0]);
        if (!at) continue;
        let el = dotEls.get(h);
        if (!el) {
          el = document.createElement("span");
          el.className = "bb-coach-dot";
          labelsEl.append(el);
          dotEls.set(h, el);
        }
        el.style.transform = `translate(${at[0].toFixed(1)}px, ${at[1].toFixed(1)}px)`;
        dots.add(h);
      }
    for (const [id, el] of dotEls) if (!dots.has(id)) (el.remove(), dotEls.delete(id));
  };
  keysEl.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>("[data-key]");
    if (!b || !sc) return;
    const id = b.dataset.key!;
    if (id === "usb" || id === "unplug") {
      toggleUsb();
      return;
    }
    const p = id as Part;
    const ref = p === "nano" ? "3c" : p === "fsr" ? "24j" : "21b";
    const anchor = /^\d+[a-j]$/.test(cursor) && snapPart(p, 0, G.hole(cursor)).place ? cursor : ref;
    stage.focus();
    startCarry({ kind: "part", part: p, from: "tray", rot: 0, anchor });
  });
  // (the camera moved: the card, the labels and the keyboard's buttons follow what they stand on)
  sc?.onChange(() => {
    if (!alive) return;
    if (sc!.moved() && !turned) {
      turned = true;
      paintHint();
    }
    placeCard();
    paintKeys();
  });

  // ---------------------------------------------------------------------------------------- undo, start over, the hint
  const undo = () => {
    const h = history.pop();
    if (!h) return;
    build = h.build;
    sk = h.sk;
    sel = null;
    card = null;
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
    card = null;
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
  /** The analog pin the sensor's other leg is wired to (what the sketch should read), A0 when none is yet. */
  const wiredPin = (): string => {
    const nl = netlist(build);
    for (const ref of ["fsr:1", "fsr:2"]) {
      const n = nl.netOf(ref);
      const a = n?.nano.find((x) => /^A\d$/.test(x));
      if (n && a && !n.nano.includes("5V")) return a;
    }
    return "A0";
  };
  /** Step 5: the wiring, then the sketch, then USB, the upload, whatever the run says, and at last the press. */
  const runHint = (): Hint => {
    const b = buildHint(build, "wires", readPin(), G.hole);
    if (!b.done) return b;
    const s = sketchHint(sk, wiredPin());
    if (!s.done) return s;
    if (!build.usb) return hint(RUN.usb, { tray: "usb" }, { kind: "usb" });
    if (busy) return hint(RUN.wait);
    if (!uploaded || changedSince()) return hint(RUN.upload, {}, { kind: "upload" });
    if (lastFail) return hint({ en: `${lastFail.s.line.en} ${lastFail.s.hint.en}`, zh: `${lastFail.s.line.zh}${lastFail.s.hint.zh}` });
    if (!verdict) return hint(RUN.upload, {}, { kind: "upload" });
    if (verdict.ok) return hint(RUN.press, {}, { kind: "press" });
    const v = verdict.symptom;
    if (v.id === "wrong-baud") {
      const c = compile(uploaded);
      const begin = c.ok ? [...c.program.setup, ...c.program.loop].find((o) => o.kind === "begin") : undefined;
      const baud = begin && begin.kind === "begin" ? begin.baud : 9600;
      if ((MONITOR_BAUDS as readonly number[]).includes(baud)) {
        const f = (x: string) => x.replaceAll("{monitor}", String(monitorBaud)).replaceAll("{sketch}", String(baud));
        return hint({ en: f(RUN.baud.en), zh: f(RUN.baud.zh) }, {}, { kind: "baud", baud });
      }
    }
    return hint({ en: `${v.line.en} ${v.hint.en}`, zh: `${v.line.zh}${v.hint.zh}` });
  };
  let coachOn = false;
  let coachNow: Hint | null = null;
  let pressTimer = 0;
  const coachHint = (): Hint | null => {
    if (view === "sketch") return sketchHint(sk, wiredPin());
    if (!sc) return null;
    if (view === "run") return runHint();
    return buildHint(build, view, readPin(), G.hole);
  };
  /** Work the hint out again (after any change) and show it, with its marks on the board, the mat and the tiles. */
  function paintCoach() {
    const was = coachNow;
    coachNow = coachOn ? coachHint() : null;
    const h = coachNow;
    hintBtn.setAttribute("aria-expanded", String(coachOn));
    hintBtn.classList.toggle("is-on", coachOn);
    coachEl.hidden = !h;
    root.classList.toggle("has-coach", Boolean(h));
    if (h) {
      const w = W();
      coachCap.textContent = h.done ? w["coach.done"] : w["coach.cap"];
      const text = T(h.text);
      if (coachText.textContent !== text) coachText.textContent = text;
      coachDo.hidden = !h.act;
      coachEl.classList.toggle("is-done", h.done);
      root.style.setProperty("--bb-coach-h", `${coachEl.offsetHeight}px`);
    }
    sketchView.hint(h?.marks.tile ?? null);
    if (!same(was?.marks ?? null, h?.marks ?? null)) {
      paintMarks();
      paintWires();
      paintKeys();
    }
  }
  /** "Do this step": the hint's one thing, as the learner would have done it (Undo takes it back). */
  const doStep = () => {
    const a = coachNow?.act;
    if (!a) return;
    if (carry) endCarry();
    sel = null;
    card = null;
    pending = null;
    if (a.kind === "nano" || a.kind === "part") {
      const bare = removePart(build, a.kind === "nano" ? "nano" : a.part);
      const r = a.kind === "nano" ? placeNano(bare, a.place) : placePart(bare, a.part, a.place);
      if (r.ok) {
        remember();
        build = { ...r.build, usb: a.kind === "nano" ? false : build.usb };
        announce(W()["live.placed"].replace("{part}", partName(a.kind === "nano" ? "nano" : a.part)));
        commit();
      }
    } else if (a.kind === "wire") {
      const r = addWire(build, a.a, a.b, a.color);
      if (r.ok) {
        remember();
        build = r.build;
        color = a.color;
        paintPalette();
        announce(W()["live.wireDone"].replace("{a}", a.a).replace("{b}", a.b));
        commit();
      }
    } else if (a.kind === "unwire") {
      remember();
      build = removeWire(build, a.id);
      announce(W()["live.wireGone"]);
      commit();
    } else if (a.kind === "sketch") {
      remember();
      sk = a.state;
      verifyOut = null;
      sketchView.mark(null);
      sketchView.paint();
      save();
      paintVerify();
      paintAll();
    } else if (a.kind === "usb") {
      if (!build.usb) toggleUsb();
    } else if (a.kind === "upload") upload();
    else if (a.kind === "baud") {
      monitorBaud = a.baud;
      baudSel.value = String(a.baud);
      save();
      restartBoard();
      paintStatus();
    } else if (a.kind === "press") {
      // (a firm press held for a moment, as a finger would)
      holdLevel = 0.75;
      level = 0.75;
      root.classList.add("was-pressed");
      kick();
      window.clearTimeout(pressTimer);
      pressTimer = window.setTimeout(() => {
        holdLevel = 0;
        kick();
      }, 1800);
    }
    paintCoach();
  };
  hintBtn.addEventListener("click", () => {
    coachOn = !coachOn;
    paintCoach();
  });
  coachDo.addEventListener("click", doStep);
  $<HTMLButtonElement>(".bb-coach-x").addEventListener("click", () => {
    coachOn = false;
    paintCoach();
    hintBtn.focus();
  });

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
  const busyLoop = () => view === "run" && (Boolean(rn) || force > 0 || pressedNow() || performance.now() < txUntil);
  const frame = (now: number) => {
    raf = 0;
    if (!alive) return;
    const dt = last ? Math.min(100, now - last) : 16;
    last = now;
    const want = pressedNow() && build.fsr ? forceAt(levelNow()) : 0;
    const kk = reduced ? 1 : 1 - Math.exp(-dt / 85);
    force += (want - force) * kk;
    if (!pressedNow() && force < 0.2) force = 0;
    if (rn && view === "run" && build.usb) {
      const ch = rn.step(dt, force);
      if (ch.text) {
        monText += ch.text;
        if (monText.length > 8000) monText = monText.slice(-6000);
        txUntil = now + 45;
      }
      for (const p of ch.points) points.push({ t: p.t, v: p.value });
      const cut = rn.t - WINDOW_MS - 400;
      while (points.length && points[0].t < cut) points.shift();
      paintSerial();
    }
    paintPress();
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
    card = null;
    pressActive = false;
    holdLevel = 0;
    if (v === "sketch") sketchView.paint();
    root.style.setProperty("--bb-panel", `${panelW(v)}px`);
    if (sc && !sc.moved()) sc.home(fromAbove, frameOf(v));
    if (animate && prev !== v && !reduced) {
      root.classList.add("is-moving");
      window.clearTimeout(moveTimer);
      moveTimer = window.setTimeout(() => {
        root.classList.remove("is-moving");
        fitScene();
      }, 620);
    }
    fitScene();
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
    fitScene();
    paintKeys();
  };
  const ro = new ResizeObserver(onResize);
  ro.observe(root);
  const ro2 = new ResizeObserver(() => fitScene());
  ro2.observe(stage);

  // ---------------------------------------------------------------------------------------- words on show
  const paintWords = () => {
    paintText(root, W());
    paintPalette();
    paintInside();
    schem.relabel();
    sketchView.relabel();
    paintVerify();
    if (noteRaw && typeof noteRaw !== "string") note(noteRaw);
    if (heldWhy) paintHintHeld(heldWhy);
    else paintHint();
    paintAll();
  };

  // (the dev server only: a handle for the browser checks, which aim the pointer at holes and parts)
  if (import.meta.env.DEV) (window as unknown as { __bb: unknown }).__bb = { sc, hole: (id: HoleId) => G.hole(id), build: () => build };

  // ---------------------------------------------------------------------------------------- start
  powered = circuit(build).power.state === "on";
  paintWords();
  const offTheme = ctx.onTheme((t) => {
    theme = t;
    sc?.setTheme(t);
  });
  const offLang = ctx.onLang(() => paintWords());
  onResize();
  if (uploaded && build.usb) restartBoard();
  show(view, false);
  root.classList.add("is-ready");

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
      show(want, true);
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
      cancelAnimationFrame(hoverRaf);
      cancelAnimationFrame(moveRaf);
      window.clearTimeout(busyTimer);
      window.clearTimeout(noteTimer);
      window.clearTimeout(moveTimer);
      window.clearTimeout(pressTimer);
      ro.disconnect();
      ro2.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      sketchView.destroy();
      schem.destroy();
      sc?.dispose();
      offTheme();
      offLang();
      root.remove();
    },
  };
}
