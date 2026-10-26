// Scan stepper (the board lessons): one idea, the board scans ROW BY ROW. It steps the real firmware loop with the
// shared scan model (@shared/models/scan.mjs, a port of PyFlexiTac template.ino) and shows it as the frame filling up:
//   - a 12 × 32 grid, one cell per crossing (scan/frame-grid.ts): the row the multiplexer listens to is outlined
//     (teal), the HIGH drive line walks along it one cell per clock (pink), finished cells keep their reading
//     (viridis), and the next row starts when the row ends
//   - one plain status line: "Listening to sense line 3 · driving line 17 · reading 81 of 384"
//   - Play / Pause, Clock (to the next D3 clock), Next line, and back to power-on
// Extras a guided step can switch on, one at a time (see `view` below):
//   - "outputs": the 32 shift-register outputs and the shift stage under the grid, aligned with its columns, for the
//     step where the outputs run one clock behind (D3 drives both clocks of every 74HC595)
//   - "mux": a 16-position dial left of the grid, the channel in binary at its hub (D7 D6 D5 D4); channels 0-3 are not
//     wired on the 12 x 32 sensor and can be picked by hand (the firmware never selects them)
// It keeps Fig 3 (board) in step: a new sense line sends `mux`, a clock sends `clock`. When the figure moves on its own
// (guided steps, its own buttons, play), the widget follows it, so both always show the same moment.
//
// CHOOSING THE EXTRAS: the plain form by default; a guided step asks for one with its widgetView (lesson 3 "Pick one
// crossing": outputs in steps 2-3, mux in step 4), which views/lesson.ts passes to instance.view({ extra: "outputs" |
// "mux" | null }) when the step is on show (null / "none" or view() = the plain form). The same detail also works as a
// CustomEvent on the element the widget was mounted in:
//   slot.dispatchEvent(new CustomEvent("ft:widget-view", { detail: { extra: "mux" } }))
// Run (the code card) goes to one crossing: { row: i, line: j } (0-based), or { line } / { row, offset } alone.
import { COLS, FRAME_BYTES, MUX_OFFSET, ROWS } from "@shared/data/constants.mjs";
import { fill, strings, tx } from "../i18n";
import { paintText } from "../i18n/paint";
import type { WidgetCtx, WidgetInstance } from "../types";
import { h } from "../ui/dom";
import { icon } from "../ui/icons";
import { FrameGrid } from "./scan/frame-grid";
import {
  bits4,
  CLOCKED,
  CLOCKS_PER_ROW,
  createScanner,
  driveLineInfo,
  frameBytes,
  muxChannelInfo,
  STEPS_PER_FRAME,
  type Step,
} from "./scan/model";
import "./scan/scan.css";

type FigState = Record<string, unknown>;

/** The extras a step can show beside the simple form, one at a time. */
export type ScanExtra = "outputs" | "mux";
/** What a guided step asks of the stepper (GuidedStep → instance.view, or the "ft:widget-view" event's detail). */
export interface ScanView {
  extra?: ScanExtra | "none" | null;
}
export interface ClockStepperInstance extends WidgetInstance {
  /** Switch the extras for the step on show. view() / view(undefined) goes back to the plain form. */
  view(v?: ScanView | null): void;
}

const FIG_PLAY_SPEED = 1e-4; // the figure's default "1/10,000x": about four drive lines a second
const LOCAL_CLOCK_MS = 250; // play without the figure: the same four clocks a second
const QUIET_MS = 650; // after we move the figure, ignore its (throttled, ~10/s) state posts for a moment
const LAST_CH = 15;
const TAXELS = ROWS * COLS;
/** What every crossing reads with nothing on the pad (the model's resting byte). */
const VALUES = frameBytes(null).slice(2);

/** A compact, comparable "where is the scan" key for a model step. */
function keyOf(s: Step | null): string {
  if (!s) return "P";
  if (s.phase === "header") return `header|${s.byteIndex}`;
  if (s.phase === "enableHigh" || s.phase === "enableLow") return s.phase;
  const row = s.muxCh - MUX_OFFSET;
  return `${s.phase}|${row}|${s.clock - row * CLOCKS_PER_ROW}`;
}

/** The same key from Fig 3's ft:state (see figures/board/live.js `state`). */
function keyOfFig(st: FigState): string | null {
  const phase = String(st.phase ?? "");
  if (!phase) return null;
  if (phase === "power-on") return "P";
  if (String(st.readout ?? "").includes("not wired")) return `X${Number(st.muxCh)}`;
  if (phase === "header") return `header|${Number(st.byte) - 1}`;
  if (phase === "enableHigh" || phase === "enableLow") return phase;
  if (typeof st.senseLine !== "number") return null;
  return `${phase}|${st.senseLine - 1}|${Number(st.rowClocks)}`;
}

/** The sense line (0-based) a step listens to, or null between frames. */
function rowOf(s: Step | null): number | null {
  if (!s || s.phase === "header" || s.phase === "enableHigh" || s.phase === "enableLow") return null;
  return s.muxCh - MUX_OFFSET;
}
/** Readings finished in this frame once the step is done (the cell under the HIGH drive line is "being read"). */
function doneOf(s: Step | null): number {
  const r = rowOf(s);
  if (r === null || !s) return 0;
  if (s.driveLine >= 0) return r * COLS + s.driveLine;
  return s.phase === "advance" ? (r + 1) * COLS : r * COLS;
}

// the stepper's words (docs/i18n.md): painted from S() and again on a language switch
const S = strings(
  {
    gridAria: "The frame: {rows} sense lines (rows) by {cols} drive lines (columns), read row by row",
    outputs: "outputs",
    shift: "shift stage",
    chUsed: "Channel {ch}: sense line {n}",
    chNc: "Channel {ch}: not wired on the {rows} × {cols} sensor",
    dialAria: "Multiplexer dial: 16 channels. Arrow keys or click a channel to select it.",
    kicker: "The scan, row by row",
    play: "Play",
    pause: "Pause",
    clockTip: "One clock on D3: the HIGH moves to the next drive line",
    clock: "Clock",
    lineTip: "Finish this sense line and start the next",
    line: "Next line",
    reset: "Back to power-on",
    frame: "frame {n}",
    sense: "sense line {n}",
    drive: "driving line {n}",
    reading: "reading <b>{k}</b> of {t}",
    read: "<b>{k}</b> of {t} read",
    of: "<b>{k}</b> of {t}",
    parked: "<b>{ch}</b> ({bits}) is not wired on this pad",
    parkedCh: "Channel {p}",
    listensOnly: "the firmware listens to channels {a}–{b} only",
    powerOn: "Power-on: every drive line is LOW",
    pressClock: "press <b>Clock</b> to start",
    frameStarts: "Frame {n} starts",
    header: "the header byte {b} goes out first",
    muxReset: "the multiplexer is reset",
    channel: "(channel {c})",
    listen: "Listening to {sense}{ch}",
    catchUp: "the outputs catch up",
    loadOut: "a 1 enters the shift stage; the outputs show it one clock later",
    load: "a 1 enters the shift registers, no drive line HIGH yet",
    done: "Done with {sense}",
    nextFrame: "next: a new frame",
    nextLine: "next: sense line {n}",
    allLow: "every drive line LOW",
  },
  {
    gridAria: "一帧：{rows} 条感应线（行）× {cols} 条驱动线（列），逐行读取",
    outputs: "输出",
    shift: "移位级",
    chUsed: "通道 {ch}：感应线 {n}",
    chNc: "通道 {ch}：在 {rows} × {cols} 传感器上没有接线",
    dialAria: "多路选择器转盘：16 个通道。用方向键或点击一个通道来选择它。",
    kicker: "逐行扫描",
    play: "播放",
    pause: "暂停",
    clockTip: "D3 上的一个时钟脉冲：HIGH 移到下一条驱动线",
    clock: "时钟",
    lineTip: "读完这条感应线，开始下一条",
    line: "下一条线",
    reset: "回到刚上电的状态",
    frame: "第 {n} 帧",
    sense: "感应线 {n}",
    drive: "驱动线 {n}",
    reading: "读数 <b>{k}</b> / {t}",
    read: "已读 <b>{k}</b> / {t}",
    of: "<b>{k}</b> / {t}",
    parked: "<b>{ch}</b>（{bits}）在这块传感垫上没有接线",
    parkedCh: "通道 {p}",
    listensOnly: "固件只听通道 {a}–{b}",
    powerOn: "刚上电：每条驱动线都是 LOW",
    pressClock: "按 <b>时钟</b> 开始",
    frameStarts: "第 {n} 帧开始",
    header: "先发出帧头字节 {b}",
    muxReset: "多路选择器复位",
    channel: "（通道 {c}）",
    listen: "正在听 {sense}{ch}",
    catchUp: "输出跟上了",
    loadOut: "一个 1 进入移位级；输出要晚一个时钟才显示它",
    load: "一个 1 进入移位寄存器，还没有驱动线是 HIGH",
    done: "{sense} 读完了",
    nextFrame: "下一步：新的一帧",
    nextLine: "下一条：感应线 {n}",
    allLow: "每条驱动线都是 LOW",
  },
);
const V = { rows: ROWS, cols: COLS };
const chTitle = (ch: number) => {
  const info = muxChannelInfo(ch);
  return info.used ? fill(S().chUsed, { ch, n: (info.row ?? 0) + 1 }) : fill(S().chNc, { ch, ...V });
};

const PAUSE_ICON = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path class="f" d="M7 5h3.6v14H7zM13.4 5H17v14h-3.6z"/></svg>';

export function mount(el: HTMLElement, ctx: WidgetCtx): ClockStepperInstance {
  const sc = createScanner();
  const fig = ctx.figure;
  let extra: ScanExtra | null = null;
  let cur: Step | null = null;
  let parked: number | null = null; // a channel 0-3 shown by hand (the firmware never selects it)
  let frameOffset = 0;
  let figKey = "P"; // where the figure should be, as far as we know
  let quietUntil = 0;
  let blocked = false; // while the figure reloads after a theme switch
  let localTimer = 0;
  let pendingFollow: FigState | null = null;

  // ------------------------------------------------------------------ DOM
  const root = h("div", { class: "w-sc" });
  const grid = new FrameGrid(ROWS, COLS, { aria: fill(S().gridAria, V) });
  const lamps = grid.addLane("w-sc-out", S().outputs);
  const dots = grid.addLane("w-sc-sr", S().shift);
  const chipNames = [0, 1, 2, 3].map((g) => `${driveLineInfo(g * 8).chip} ${g * 8 + 1}–${g * 8 + 8}`);
  const chipLane = grid.addGroupLane("w-sc-chips", "", chipNames);

  // the multiplexer dial (extra "mux"): 16 positions, the current one in the sense line's teal, 0-3 dashed
  const R = 54;
  const C = 72;
  const pos = (ch: number, r: number) => {
    const a = ((-90 + ch * 22.5) * Math.PI) / 180;
    return [C + r * Math.cos(a), C + r * Math.sin(a)];
  };
  const dialPos = Array.from({ length: 16 }, (_, ch) => {
    const [x, y] = pos(ch, R);
    const info = muxChannelInfo(ch);
    return `<g class="w-sc-pos${info.used ? "" : " is-nc"}" data-ch="${ch}">
      <title>${chTitle(ch)}</title>
      <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="10"></circle>
      <text x="${x.toFixed(1)}" y="${(y + 3.8).toFixed(1)}">${ch}</text>
    </g>`;
  }).join("");

  root.innerHTML = `
    <figure class="w-sc-dial">
      <svg viewBox="0 0 144 144" tabindex="0" role="group" aria-label="${S().dialAria}" data-t-aria="dialAria">
        <circle class="w-sc-ring" cx="${C}" cy="${C}" r="${R}"></circle>
        <line class="w-sc-needle" x1="${C}" y1="${C}" x2="${C}" y2="${C - R + 12}"></line>
        ${dialPos}
        <circle class="w-sc-hub" cx="${C}" cy="${C}" r="23"></circle>
        <text class="w-sc-hubk" x="${C}" y="${C - 5}">D7–D4</text>
        <text class="w-sc-hubt" x="${C}" y="${C + 9}" data-bits>0000</text>
      </svg>
    </figure>
    <div class="w-sc-gridbox"></div>
    <div class="w-sc-side">
      <div class="w-sc-top"><span class="w-kicker" data-t="kicker">${S().kicker}</span><span class="w-sc-frame mono" data-frame></span></div>
      <p class="w-sc-status" data-status aria-live="polite"></p>
      <div class="w-sc-ctrl">
        <button type="button" class="w-btn" data-do="play" aria-pressed="false">${icon("play")}<span>${S().play}</span></button>
        <button type="button" class="w-btn w-btn-strong" data-do="clock" title="${S().clockTip}" data-t-title="clockTip">${icon("chevron")}<span data-t="clock">${S().clock}</span></button>
        <button type="button" class="w-btn" data-do="line" title="${S().lineTip}" data-t-title="lineTip" data-t="line">${S().line}</button>
        <button type="button" class="w-btn w-btn-icon" data-do="reset" title="${S().reset}" aria-label="${S().reset}" data-t-title="reset" data-t-aria="reset">${icon("reset")}</button>
      </div>
    </div>`;
  root.querySelector(".w-sc-gridbox")!.append(grid.el);
  el.append(root);
  // the stage's widget row only needs this much: views/lesson.ts + lesson.css give the figure the rest
  el.dataset.row = "short";

  const q = <T extends Element = HTMLElement>(sel: string) => root.querySelector<T>(sel)!;
  const statusEl = q("[data-status]");
  const frameEl = q("[data-frame]");
  const svg = root.querySelector<SVGSVGElement>(".w-sc-dial svg")!;
  const needle = q<SVGLineElement>(".w-sc-needle");
  const bitsEl = q<SVGTextElement>("[data-bits]");
  const playBtn = q<HTMLButtonElement>('[data-do="play"]');
  const posEls = [...root.querySelectorAll<SVGGElement>(".w-sc-pos")];
  const chipEls = [...chipLane.children] as HTMLElement[];

  // ------------------------------------------------------------------ figure link
  const figReady = () => Boolean(fig && fig.status === "ready");
  const figPlaying = () => Boolean(fig?.lastState?.playing);
  function send(name: string, arg?: unknown) {
    if (!fig) return;
    fig.act(name, arg);
    quietUntil = performance.now() + QUIET_MS;
  }
  /** Put the figure exactly where the widget is (after a theme reload, or if it drifted). */
  function resyncFigure() {
    if (!fig) return;
    send("reset");
    if (parked !== null) {
      send("mux", parked);
      figKey = `X${parked}`;
      return;
    }
    const m = /^(select|load|latch|read|advance)\|(\d+)\|(\d+)$/.exec(figKey);
    if (!m) {
      figKey = "P";
      return;
    }
    send("mux", Number(m[2]) + MUX_OFFSET);
    for (let k = 0; k < Number(m[3]); k++) send("clock");
  }
  /** Before we move the figure step by step, make sure it is where we think. */
  function ensureFigure() {
    if (!figReady()) return;
    if (figPlaying()) send("pause");
    const st = fig!.lastState;
    if (performance.now() > quietUntil && st && keyOfFig(st) !== figKey && keyOfFig(st) !== null) resyncFigure();
  }
  function mirror(s: Step) {
    if (s.phase === "select") {
      send("mux", s.muxCh);
      figKey = keyOf(s);
    } else if (CLOCKED.has(s.phase)) {
      send("clock");
      figKey = keyOf(s);
    }
  }

  function follow(st: FigState) {
    if (blocked) return;
    if (performance.now() < quietUntil) {
      pendingFollow = st;
      return;
    }
    pendingFollow = null;
    const k = keyOfFig(st);
    syncPlayBtn();
    if (k === null || k === figKey) return;
    figKey = k;
    if (k === "P") {
      sc.reset();
      cur = null;
      parked = null;
      frameOffset = 0;
      render();
      return;
    }
    if (k.startsWith("X")) {
      parkModel();
      parked = Number(k.slice(1));
      render();
      return;
    }
    let found: Step | null = null;
    for (let pass = 0; pass < 2 && !found; pass++) {
      for (let n = 0; n < STEPS_PER_FRAME + 4; n++) {
        const s = sc.next();
        if (keyOf(s) === k) {
          found = s;
          break;
        }
      }
      if (!found) sc.reset();
    }
    if (!found) return;
    cur = found;
    parked = null;
    if (typeof st.frame === "number") frameOffset = st.frame - (cur.frame + 1);
    render();
  }
  const offState = fig?.onState(follow);
  const quietCheck = window.setInterval(() => {
    if (pendingFollow && performance.now() >= quietUntil) follow(pendingFollow);
  }, 200);
  const offStatus = fig?.onStatus((s) => {
    if (s === "ready" && blocked) {
      blocked = false;
      quietUntil = performance.now() + QUIET_MS * 2;
    }
  });
  ctx.onTheme(() => {
    // FigureHost loads the other build and replays its (short) act history; then we put it exactly where we are.
    blocked = true;
    resyncFigure();
  });

  // ------------------------------------------------------------------ model moves
  function stepModel(): Step {
    parked = null;
    const s = sc.next();
    cur = s;
    return s;
  }
  /** Like the figure: park at the start of a frame, so the next clock selects channel MUX_OFFSET again. */
  function parkModel() {
    if (parked !== null) return;
    let guard = 0;
    while (!(cur && cur.phase === "enableLow") && guard++ < STEPS_PER_FRAME + 4) cur = sc.next();
  }
  /** Run to the next D3 clock (the steps between, a header or a new channel, are passed on to the figure too). */
  function clockModel(withFigure: boolean) {
    let guard = 0;
    let s: Step;
    do {
      s = stepModel();
      if (withFigure) mirror(s);
    } while (!CLOCKED.has(s.phase) && guard++ < 50);
  }
  function doClock() {
    ensureFigure();
    clockModel(true);
    render();
  }
  /** Run to the select step of channel `ch` (the next time the scan gets there). */
  function toChannel(ch: number) {
    ch = ((ch % 16) + 16) % 16;
    ensureFigure();
    const info = muxChannelInfo(ch);
    if (!info.used) {
      parkModel();
      parked = ch;
      send("mux", ch);
      figKey = `X${ch}`;
      render();
      return;
    }
    let guard = 0;
    do stepModel();
    while (!(cur && cur.phase === "select" && cur.muxCh === ch) && guard++ < STEPS_PER_FRAME + 4);
    parked = null;
    send("mux", ch);
    figKey = keyOf(cur);
    render();
  }
  function nextLine() {
    const r = parked === null ? rowOf(cur) : null;
    toChannel(r !== null ? (cur!.muxCh >= LAST_CH ? MUX_OFFSET : cur!.muxCh + 1) : MUX_OFFSET);
  }
  /** Run until drive line j (0-based) is HIGH and being read, on the current sense line if it is still ahead. */
  function toDriveLine(j: number) {
    ensureFigure();
    let guard = 0;
    for (;;) {
      const s = stepModel();
      mirror(s);
      if (s.phase === "read" && s.col === j) break;
      if (guard++ > STEPS_PER_FRAME + 4) break;
    }
    render();
  }
  function resetAll() {
    stopLocal();
    sc.reset();
    cur = null;
    parked = null;
    frameOffset = 0;
    if (fig) {
      send("reset");
      figKey = "P";
    }
    render();
  }

  // ------------------------------------------------------------------ play
  function stopLocal() {
    clearInterval(localTimer);
    localTimer = 0;
    syncPlayBtn();
  }
  function paintPlay(on: boolean, force = false) {
    if (!force && playBtn.getAttribute("aria-pressed") === String(on)) return;
    playBtn.setAttribute("aria-pressed", String(on));
    playBtn.innerHTML = `${on ? PAUSE_ICON : icon("play")}<span>${on ? S().pause : S().play}</span>`;
    // a status that changes four times a second is not read out while the scan plays
    statusEl.setAttribute("aria-live", on ? "off" : "polite");
  }
  function syncPlayBtn() {
    paintPlay(Boolean(localTimer) || (figReady() && figPlaying()));
  }
  function togglePlay() {
    if (figReady()) {
      // let the figure drive the scan; the widget follows its states
      const on = !figPlaying();
      if (on) {
        ensureFigure();
        send("play", FIG_PLAY_SPEED);
      } else send("pause");
      quietUntil = 0;
      paintPlay(on);
      return;
    }
    if (localTimer) return stopLocal();
    localTimer = window.setInterval(() => {
      clockModel(false);
      render();
    }, LOCAL_CLOCK_MS);
    syncPlayBtn();
  }

  // ------------------------------------------------------------------ render
  // short phrases keep together (no break inside "sense line 3"); the longer explanations wrap like any text
  const nb = (t: string) => t.replace(/ /g, "&nbsp;");
  const sense = (r: number) => `<b class="w-sc-s">${nb(fill(S().sense, { n: r + 1 }))}</b>`;
  const drive = (j: number) => `<b class="w-sc-d">${nb(fill(S().drive, { n: j + 1 }))}</b>`;
  const count = (k: number, tail: string) =>
    nb(fill(tail === "reading" ? S().reading : tail === "read" ? S().read : S().of, { k, t: TAXELS })).replace("<b>", '<b class="w-sc-n">');
  const sep = '<span class="w-sc-sep" aria-hidden="true"> · </span>';
  function statusHtml(s: Step | null): string {
    const T = S();
    if (parked !== null) return [fill(T.parked, { ch: nb(fill(T.parkedCh, { p: parked })), bits: bits4(parked) }), fill(T.listensOnly, { a: MUX_OFFSET, b: LAST_CH })].join(sep);
    if (!s) return [T.powerOn, nb(T.pressClock)].join(sep);
    const frame = s.frame + 1 + frameOffset;
    if (s.phase === "header" || s.phase === "enableHigh" || s.phase === "enableLow")
      return [nb(fill(T.frameStarts, { n: frame })), s.phase === "header" ? fill(T.header, { b: s.byteIndex === 0 ? "AA" : "55" }) : T.muxReset].join(sep);
    const r = rowOf(s)!;
    const ch = extra === "mux" ? ` <span class="w-sc-ch">${nb(fill(T.channel, { c: s.muxCh }))}</span>` : "";
    const listen = fill(T.listen, { sense: sense(r), ch });
    if (s.driveLine >= 0) {
      const lead = s.phase === "latch" && extra === "outputs" ? T.catchUp : "";
      return [listen, lead, drive(s.driveLine), count(r * COLS + s.driveLine + 1, "reading")].filter(Boolean).join(sep);
    }
    if (s.phase === "load") return [listen, extra === "outputs" ? T.loadOut : T.load].join(sep);
    if (s.phase === "advance") {
      const last = r === ROWS - 1;
      return [fill(T.done, { sense: sense(r) }), count((r + 1) * COLS, "read"), last ? T.nextFrame : nb(fill(T.nextLine, { n: r + 2 }))].join(sep);
    }
    return [listen, T.allLow, count(r * COLS, "read")].join(sep);
  }

  function render() {
    const s = parked !== null ? null : cur;
    const row = rowOf(s);
    const frame = cur ? cur.frame + 1 + frameOffset : 0;
    grid.paint({ row, col: s ? s.driveLine : -1, done: doneOf(s), values: VALUES, prev: Boolean(s) && frame > 1 });
    statusEl.innerHTML = statusHtml(s);
    frameEl.textContent = cur ? fill(S().frame, { n: frame }) : "";

    if (extra === "outputs") {
      const latch = s ? s.latchQ : [];
      const sr = s ? s.srQ : [];
      lamps.forEach((l, j) => l.classList.toggle("is-on", latch[j] === 1));
      dots.forEach((d, j) => d.classList.toggle("is-on", sr[j] === 1));
      const g = s && s.driveLine >= 0 ? Math.floor(s.driveLine / 8) : -1;
      chipEls.forEach((c, k) => c.classList.toggle("is-on", k === g));
    }
    if (extra === "mux") {
      const ch = parked ?? (cur ? cur.muxCh : MUX_OFFSET);
      const live = Boolean(cur) || parked !== null;
      const info = muxChannelInfo(ch);
      const [x2, y2] = pos(ch, R - 13);
      needle.setAttribute("x2", x2.toFixed(1));
      needle.setAttribute("y2", y2.toFixed(1));
      svg.classList.toggle("is-off", !live || (cur !== null && !cur.enabled && parked === null));
      svg.classList.toggle("is-nc", !info.used);
      posEls.forEach((p, k) => p.classList.toggle("is-cur", live && k === ch));
      bitsEl.textContent = live ? bits4(ch) : "––––";
    }
  }

  // ------------------------------------------------------------------ layout
  const PAD_X = 32; // .w-sc padding, both sides
  const PAD_Y = 22;
  const GAP = 20; // .w-sc gap between the dial, the grid and the side column
  const DIAL = 132; // .w-sc-dial width
  const LANES_H = 44; // outputs + shift stage + the chips' names, with their gaps (scan.css)
  const ctrlEl = q(".w-sc-ctrl");
  /** The buttons' row at its natural width (Pause is a little wider than Play), so it never wraps in the wide form. */
  function ctrlWidth() {
    const bs = [...ctrlEl.children] as HTMLElement[];
    return bs.reduce((w, b) => w + b.offsetWidth, 0) + 6 * (bs.length - 1) + 4;
  }
  function fit() {
    const W = root.clientWidth - PAD_X;
    const H = root.clientHeight - PAD_Y;
    if (W <= 0) return;
    const wide = W >= 600;
    root.classList.toggle("is-wide", wide);
    const lanes = extra === "outputs" ? LANES_H : 0;
    const axis = extra !== "outputs";
    const labelW = grid.labelWidth();
    if (!wide) grid.fit(W, 1e4, lanes, axis, labelW);
    else {
      const side = Math.max(280, ctrlWidth());
      grid.fit(W - side - GAP - (extra === "mux" ? DIAL + GAP : 0), Math.max(H, 110), lanes, axis, labelW);
    }
  }
  const ro = new ResizeObserver(() => fit());
  ro.observe(root);

  function setExtra(x: ScanExtra | null) {
    extra = x;
    root.dataset.extra = x ?? "none";
    fit();
    render();
  }
  function view(v?: ScanView | null) {
    if (v === undefined || v === null || !("extra" in v) || v.extra === undefined) return setExtra(null);
    setExtra(v.extra === "outputs" || v.extra === "mux" ? v.extra : null);
  }
  const onViewEvent = (e: Event) => view((e as CustomEvent<ScanView | null>).detail ?? undefined);
  el.addEventListener("ft:widget-view", onViewEvent);

  // ------------------------------------------------------------------ events
  root.querySelector(".w-sc-ctrl")!.addEventListener("click", (e) => {
    const b = (e.target as Element).closest<HTMLElement>("[data-do]");
    if (!b) return;
    const what = b.dataset.do;
    if (what !== "play") stopLocal();
    if (what === "clock") doClock();
    else if (what === "line") nextLine();
    else if (what === "play") togglePlay();
    else if (what === "reset") resetAll();
  });
  svg.addEventListener("click", (e) => {
    const g = (e.target as Element).closest<SVGGElement>(".w-sc-pos");
    if (!g) return;
    stopLocal();
    toChannel(Number(g.dataset.ch));
  });
  svg.addEventListener("keydown", (e) => {
    const cur0 = parked ?? (cur ? cur.muxCh : MUX_OFFSET - 1);
    if (e.key === "ArrowRight" || e.key === "ArrowUp") toChannel(cur0 + 1);
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown") toChannel(cur0 - 1);
    else return;
    stopLocal();
    e.preventDefault();
  });

  // a language switch: the words (the scan, the figure link, the extras and the play state carry on)
  const offLang = ctx.onLang(() => {
    paintText(root, S());
    grid.relabel({ aria: fill(S().gridAria, V), lanes: [S().outputs, S().shift] });
    posEls.forEach((p) => {
      const t = p.querySelector("title");
      if (t) t.textContent = chTitle(Number(p.dataset.ch));
    });
    paintPlay(playBtn.getAttribute("aria-pressed") === "true", true);
    render();
    fit();
  });

  setExtra(extra);
  syncPlayBtn();
  requestAnimationFrame(() => fit());

  return {
    view,
    destroy() {
      stopLocal();
      clearInterval(quietCheck);
      offState?.();
      offStatus?.();
      ro.disconnect();
      el.removeEventListener("ft:widget-view", onViewEvent);
      offLang();
      delete el.dataset.row;
      root.remove();
    },
    layout: fit,
    run(p) {
      stopLocal();
      if (p.line !== undefined && p.row !== undefined) {
        // one crossing: listen to sense line i + 1, then walk the 1 to drive line j + 1 on it
        const row = Math.max(0, Math.min(ROWS - 1, Math.round(p.row)));
        const j = Math.max(0, Math.min(COLS - 1, Math.round(p.line)));
        const ch = row + MUX_OFFSET;
        toChannel(ch);
        toDriveLine(j);
        const d = driveLineInfo(j);
        const s = cur!;
        const v = { row, off: MUX_OFFSET, ch, bits: bits4(ch).split("").join(" "), n: row + 1, j: j + 1, cols: COLS, k: 2 + j, chip: d.chip, q: d.q, pin: d.fpc2Pin, s: (s.row ?? row) + 1, r: (s.row ?? row) * COLS + j + 1, t: TAXELS, b: (s.byteIndex ?? 0) + 1, fb: FRAME_BYTES };
        return [
          tx("setRow({row}): channel {row} + {off} = {ch} → D7 D6 D5 D4 = {bits} → sense line {n} to A0", "setRow({row})：通道 {row} + {off} = {ch} → D7 D6 D5 D4 = {bits} → 感应线 {n} 接到 A0", v),
          tx("drive line {j} of {cols} HIGH after {k} clocks: {chip} output {q}, FPC2 pin {pin}", "{k} 个时钟后，第 {j} 条驱动线（共 {cols} 条）为 HIGH：{chip} 的输出 {q}，FPC2 引脚 {pin}", v),
          tx("A0 reads sense {s} × drive {j}: reading {r} of {t}, byte {b} of {fb}", "A0 读取感应 {s} × 驱动 {j}：第 {r} 个读数（共 {t} 个），第 {b} 字节（共 {fb} 字节）", v),
        ];
      }
      if (p.line !== undefined) {
        const j = Math.max(0, Math.min(COLS - 1, Math.round(p.line)));
        toDriveLine(j);
        const d = driveLineInfo(j);
        const s = cur!;
        const v = { j: j + 1, cols: COLS, chip: d.chip, q: d.q, net: d.net, pin: d.fpc2Pin, more: j, k: 2 + j, s: (s.row ?? 0) + 1, b: (s.byteIndex ?? 0) + 1, fb: FRAME_BYTES };
        return [
          tx("drive line {j} of {cols} is HIGH: {chip} output {q}, net {net}, FPC2 pin {pin}", "第 {j} 条驱动线（共 {cols} 条）为 HIGH：{chip} 的输出 {q}，网络 {net}，FPC2 引脚 {pin}", v),
          tx("clocks this sense line: 2 to load + latch, then {more} more = {k}", "这条感应线的时钟数：装载 + 锁存 2 个，再加 {more} 个 = {k}", v),
          tx("reading sense {s} × drive {j} → byte {b} of {fb}", "读取感应 {s} × 驱动 {j} → 第 {b} 字节（共 {fb} 字节）", v),
        ];
      }
      if (p.row !== undefined) {
        const row = Math.round(p.row);
        const offset = Math.round(p.offset ?? MUX_OFFSET);
        const want = row + offset;
        const ch = want & 15;
        const out = [`mux_channel = ${row} + ${offset} = ${want}`];
        if (want > LAST_CH) out.push(tx("only 4 select bits: {want} = {bin} → the chip sees {bits} = channel {ch}", "只有 4 个选择位：{want} = {bin} → 芯片看到的是 {bits} = 通道 {ch}", { want, bin: want.toString(2), bits: bits4(ch), ch }));
        out.push(`D7 D6 D5 D4 (S3..S0) = ${bits4(ch).split("").join(" ")}`);
        const info = muxChannelInfo(ch);
        if (info.used) {
          const not = info.row === row ? "" : tx(", not the i = {row} you asked for", "，不是你要的 i = {row}", { row });
          out.push(tx("channel {ch} carries sense line {n} (i = {i}){not}", "通道 {ch} 接着感应线 {n}（i = {i}）{not}", { ch, n: (info.row ?? 0) + 1, i: String(info.row), not }));
        } else out.push(tx("channel {ch} is not wired on the {rows} × {cols} sensor: A0 hears nothing", "通道 {ch} 在 {rows} × {cols} 传感器上没有接线：A0 什么也听不到", { ch, ...V }));
        toChannel(ch);
        return out;
      }
      return undefined;
    },
  };
}
