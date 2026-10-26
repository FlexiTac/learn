// Frame runner (One frame). One whole frame exactly as the firmware sends it, built by the shared scan model
// (@shared/models/scan.mjs frameBytes: taxel curve -> divider -> ADC -> >> 2, in firmware scan order), kept simple:
//   - the frame bar: the 2 header bytes AA 55 first, then one block of 32 readings per sense line, filling up in the
//     order the bytes go out
//   - one status line: "byte 84 of 386 · sense line 3, drive line 18"
//   - the 12 × 32 grid (scan/frame-grid.ts, the same as the scan stepper's): the row being sent, the reading going out,
//     the readings already sent in the viewer's colours
//   - Scan (replays the frame filling up in send order, at 1/1,000 of real speed, with Fig 3 playing along) and Press
//     (an illustrative, unitless fingertip on the picked crossing)
// Click a cell (or a place on the bar) to pick a byte: the status says which crossing it is and Fig 3 walks the scan
// there. run({rows, offset}) rebuilds the frame for another firmware build (e.g. 16 rows, offset 0).
//
// CHOOSING THE FORM: the full form above, or the STRIP for a figure that draws the map itself (Fig 3's connect mode,
// lesson 4 "One frame"): no grid and no buttons, just the frame bar and the status, and both FOLLOW the figure's scan
// (ft:state): the header bytes light as they go out, each sense line's block fills as its drive lines are read, the
// status names the byte, and at speeds the eye cannot follow (1/100x and faster) the bar stays full. Clicking a block
// seeks the figure to that crossing (act seek). A guided step picks the form with its widgetView,
// instance.view({ grid: false }) (views/lesson.ts), or
//   slot.dispatchEvent(new CustomEvent("ft:widget-view", { detail: { grid: false } }))
// on the element the widget was mounted in; view() / { grid: true } brings the full form back (the default). After a
// Run with another firmware build (rows / offset) the strip shows that frame still, as the full form does.
import { BAUD, COLS, FRAME_BYTES, FRAME_HZ, HEADER, MUX_OFFSET, ROWS } from "@shared/data/constants.mjs";
import { ILLUSTRATIVE } from "@shared/models/taxel.mjs";
import { fill, strings } from "../i18n";
import { paintText } from "../i18n/paint";
import type { WidgetCtx, WidgetInstance } from "../types";
import { h } from "../ui/dom";
import { icon } from "../ui/icons";
import { FrameGrid } from "./scan/frame-grid";
import { frameBytes, hex2, VARIANTS, viridis, type Variant } from "./scan/model";
import "./scan/scan.css";

/** What a guided step asks of the frame runner (instance.view, or the "ft:widget-view" event's detail). */
export interface FrameView {
  grid?: boolean;
}
export interface FrameRunnerInstance extends WidgetInstance {
  view(v?: FrameView | null): void;
}

const SCAN_SECONDS = 10; // slowed-down replay of one frame: 10 ms -> 10 s, i.e. 1/1,000 of real speed
const SCAN_SPEED = 1 / (FRAME_HZ * SCAN_SECONDS); // the same speed for Fig 3, so both show the same byte
const PRESS = 0.85;
const REST = frameBytes(null)[2]; // what an untouched taxel reads
const MAX_ROWS = 16; // the CD74HC4067 has 16 channels

type FigState = Record<string, unknown>;
/** Where the figure's scan is, as bytes of the frame: `sent` are on the wire, `now` is going out (-1: none). */
interface Wire {
  sent: number;
  now: number;
  /** too fast to follow (1/100x and faster, playing): every frame in a blink */
  fast: boolean;
  fps: number;
  phase: string;
  sense: number | null; // 1-based
  drive: number | null; // 1-based
}
const FAST = 0.01; // Fig 3 hides the crossing dot from this speed up (live.js isFast)

// the widget's words (docs/i18n.md): painted from S() and again on a language switch
const S = strings(
  {
    gridAria: "The frame as a grid: sense lines are rows, drive lines columns. Arrow keys pick a crossing, Space presses.",
    illTip: "Press strength is unitless: there is no force data behind the curve",
    ill: "illustrative",
    scan: "Scan",
    stop: "Stop",
    press: "Press",
    barAria: "The frame in the order it is sent: the header AA 55, then one block of readings per sense line.",
    barTip: "Click a block: the figure goes to that crossing",
    title: "One frame · {n} bytes",
    band: "sense line {r}: bytes {a}–{b}",
    fps: "{fps} frames a second",
    each: "{n} bytes each: {hdr}, then {rows} blocks of {cols}",
    powerOn: "Power-on: nothing sent yet",
    starts: "every frame starts with {hdr}",
    sentBytes: '<b class="w-fr-n">{sent}</b> of {n} bytes sent',
    sent: '<b class="w-fr-n">{sent}</b> of {n} sent',
    muxOn: "the multiplexer turns on for sense line 1",
    lineDone: '<b class="w-fr-s">sense line {s}</b> done',
    next: 'next: <b class="w-fr-s">sense line {s}</b>, bytes {a}–{b}',
    head: '<b class="w-fr-n">byte {i}</b> of {n}',
    header: 'header <b class="w-fr-h">{b}</b>, not a reading',
    where: '<b class="w-fr-s">sense line {r}</b>, <b class="w-fr-d">drive line {c}</b>',
    reads: "reads {b} (0x{hex})",
    outFrame: "frame = {h} + {rows} × {cols} = {n} bytes",
    outMux: "mux channels {a}–{b}{again}",
    outAgain: " and {wrap} again (only 4 select bits: {k}+ wraps around)",
    outRate: "{n} B × {hz} frames/s = {bps} B/s ≈ {pc}% of {baud} baud (8N1 serial: 10 bits a byte)",
    outDefault: "this is the default PyFlexiTac build for the {rows} × {cols} pad ({n} B)",
    outRepo: "this is the {rows}-row build in the hardware repo (32_16_fast.ino)",
    outOffset: "on the {rows} × {cols} pad the sense lines sit on channels {a}–{b}: this offset reads the wrong ones",
    outExpect: "the computer must expect {n}-byte frames too (set rows = {rows} in the viewer)",
  },
  {
    gridAria: "以网格显示的一帧：每行是一条感应线，每列是一条驱动线。方向键选一个交叉点，空格键按压。",
    illTip: "按压力度没有单位：这条曲线背后没有力的测量数据",
    ill: "示意",
    scan: "扫描",
    stop: "停止",
    press: "按压",
    barAria: "按发送顺序排列的一帧：先是帧头 AA 55，然后每条感应线一组读数。",
    barTip: "点击一个方块：图会跳到那个交叉点",
    title: "一帧 · {n} 字节",
    band: "感应线 {r}：第 {a}–{b} 字节",
    fps: "每秒 {fps} 帧",
    each: "每帧 {n} 字节：{hdr}，然后是 {rows} 组，每组 {cols} 个",
    powerOn: "刚上电：还没有发送任何数据",
    starts: "每一帧都以 {hdr} 开头",
    sentBytes: '已发送 <b class="w-fr-n">{sent}</b> / {n} 字节',
    sent: '已发送 <b class="w-fr-n">{sent}</b> / {n}',
    muxOn: "多路选择器接通感应线 1",
    lineDone: '<b class="w-fr-s">感应线 {s}</b> 读完',
    next: '下一条：<b class="w-fr-s">感应线 {s}</b>，第 {a}–{b} 字节',
    head: '<b class="w-fr-n">第 {i} 字节</b>，共 {n}',
    header: '帧头 <b class="w-fr-h">{b}</b>，不是读数',
    where: '<b class="w-fr-s">感应线 {r}</b>，<b class="w-fr-d">驱动线 {c}</b>',
    reads: "读数 {b}（0x{hex}）",
    outFrame: "帧 = {h} + {rows} × {cols} = {n} 字节",
    outMux: "mux 通道 {a}–{b}{again}",
    outAgain: "，然后又是 {wrap}（只有 4 个选择位：{k} 及以上会绕回）",
    outRate: "{n} B × {hz} 帧/秒 = {bps} B/s ≈ {baud} baud 的 {pc}%（8N1 串口：每字节 10 位）",
    outDefault: "这是 {rows} × {cols} 传感垫的 PyFlexiTac 默认版本（{n} B）",
    outRepo: "这是硬件仓库里的 {rows} 行版本（32_16_fast.ino）",
    outOffset: "在 {rows} × {cols} 传感垫上，感应线接在通道 {a}–{b}：这个偏移读到的是错误的通道",
    outExpect: "电脑也必须按 {n} 字节一帧来接收（在查看器里设 rows = {rows}）",
  },
);
const HDR_TXT = HEADER.map(hex2).join(" ");

const PAUSE_ICON = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path class="f" d="M7 5h3.6v14H7zM13.4 5H17v14h-3.6z"/></svg>';

export function mount(el: HTMLElement, ctx: WidgetCtx): FrameRunnerInstance {
  const fig = ctx.figure;
  let v: Variant = { ...VARIANTS.pyflexitac12 };
  let size = 2 + v.rows * v.cols;
  let sel = 2 + 5 * COLS + 16; // a crossing near the middle
  let press: { r: number; c: number } | null = null;
  let bytes: Uint8Array = new Uint8Array(size);
  let cursor = -1; // scan replay position, -1 = whole frame shown
  let raf = 0;
  let t0 = 0;
  let showGrid = true;
  let wire: Wire | null = null; // the strip form's view of the figure's scan, null = not following
  const isDefault = () => v.rows === ROWS && v.muxOffset === MUX_OFFSET && v.cols === COLS;

  const root = h("div", { class: "w-fr" });
  const grid = new FrameGrid(v.rows, v.cols, { aria: S().gridAria });
  root.innerHTML = `
    <div class="w-fr-gridbox"></div>
    <div class="w-fr-side">
      <div class="w-fr-top">
        <span class="w-kicker" data-title></span>
        ${ILLUSTRATIVE ? `<span class="badge badge-illustrative" data-ill hidden title="${S().illTip}" data-t-title="illTip" data-t="ill">${S().ill}</span>` : ""}
        <span class="w-fr-ctrl">
          <button type="button" class="w-btn w-btn-strong" data-do="scan">${icon("play")}<span>${S().scan}</span></button>
          <button type="button" class="w-btn" data-do="press" aria-pressed="false">${icon("touch")}<span data-t="press">${S().press}</span></button>
        </span>
      </div>
      <div class="w-fr-bar" role="img" aria-label="${S().barAria}" data-t-aria="barAria">
        <span class="w-fr-hdr mono"><i data-h="0">${hex2(HEADER[0])}</i><i data-h="1">${hex2(HEADER[1])}</i></span>
        <span class="w-fr-bands"></span>
      </div>
      <p class="w-fr-status" data-status aria-live="polite"></p>
    </div>`;
  root.querySelector(".w-fr-gridbox")!.append(grid.el);
  root.style.setProperty("--fr-sent", viridis(REST));
  el.append(root);

  const q = <T extends Element = HTMLElement>(s: string) => root.querySelector<T>(s)!;
  const title = q("[data-title]");
  const ill = root.querySelector<HTMLElement>("[data-ill]");
  const bar = q(".w-fr-bar");
  const bandsEl = q(".w-fr-bands");
  const hdrEls = [...root.querySelectorAll<HTMLElement>(".w-fr-hdr i")];
  const statusEl = q("[data-status]");
  const scanBtn = q<HTMLButtonElement>('[data-do="scan"]');
  const pressBtn = q<HTMLButtonElement>('[data-do="press"]');
  const cellsBox = grid.cellsBox;
  cellsBox.tabIndex = 0;
  let bands: HTMLElement[] = [];
  let fills: HTMLElement[] = [];
  const marks = { cur: h("b", { class: "w-fr-mark is-cur" }), sel: h("b", { class: "w-fr-mark is-sel" }) };

  // ------------------------------------------------------------------ model
  const rowCol = (i: number) => (i < 2 ? null : { r: Math.floor((i - 2) / v.cols), c: (i - 2) % v.cols });
  function compute() {
    const p = press;
    const input = p
      ? (r: number, c: number) => {
          const d2 = ((r - p.r) ** 2 + ((c - p.c) / 1.15) ** 2) / 1.6;
          return PRESS * Math.exp(-d2);
        }
      : null;
    bytes = frameBytes(input, { variant: v });
  }

  const bandTip = (r: number) => fill(S().band, { r: r + 1, a: 3 + r * v.cols, b: 2 + (r + 1) * v.cols });

  // ------------------------------------------------------------------ build for the current variant
  function build() {
    size = 2 + v.rows * v.cols;
    title.textContent = fill(S().title, { n: size });
    bandsEl.innerHTML = Array.from({ length: v.rows }, (_, r) => `<i data-r="${r}" title="${bandTip(r)}"><b></b></i>`).join("");
    bands = [...bandsEl.children] as HTMLElement[];
    fills = bands.map((b) => b.firstElementChild as HTMLElement);
    if (grid.rows !== v.rows || grid.cols !== v.cols) grid.build(v.rows, v.cols);
    if (sel >= size) sel = 2;
    fit();
  }

  // ------------------------------------------------------------------ paint
  function place(mark: HTMLElement, i: number) {
    const rc = rowCol(i);
    const host = rc ? bands[rc.r] : hdrEls[i];
    if (!host) return mark.remove();
    if (mark.parentElement !== host) host.append(mark);
    mark.style.left = rc ? `${((rc.c + 0.5) / v.cols) * 100}%` : "50%";
  }
  const following = () => Boolean(wire) && !showGrid && isDefault() && !raf;
  function paint() {
    const w = following() ? wire! : null;
    const scanning = cursor >= 0;
    const sent = w ? w.sent : scanning ? cursor + 1 : size; // bytes on the wire
    const now = w ? w.now : scanning ? cursor : -1;
    hdrEls.forEach((e, k) => {
      e.classList.toggle("is-sent", k < sent);
      e.classList.toggle("is-now", k === now);
    });
    fills.forEach((f, r) => {
      const n = Math.max(0, Math.min(v.cols, sent - 2 - r * v.cols));
      f.style.width = `${(n / v.cols) * 100}%`;
    });
    if (now >= 0) place(marks.cur, now);
    else marks.cur.remove();
    if (!scanning && !w) place(marks.sel, sel);
    else marks.sel.remove();
    if (w) {
      statusEl.innerHTML = wireHtml(w);
      if (ill) ill.hidden = true;
      return;
    }

    const crc = scanning ? rowCol(cursor) : null;
    const values = bytes.subarray(2);
    grid.paint({
      row: crc ? crc.r : null,
      col: crc ? crc.c : null,
      done: scanning ? Math.max(0, cursor - 2) : v.rows * v.cols,
      values,
      sel: scanning || sel < 2 ? null : sel - 2,
    });
    statusEl.innerHTML = statusHtml(scanning ? cursor : sel, scanning);
    if (ill) ill.hidden = !press;
  }
  /** The strip's status: the byte going out, as the figure's readout counts it. */
  function wireHtml(w: Wire): string {
    const sep = '<span class="w-fr-sep" aria-hidden="true"> · </span>';
    const T = S();
    if (w.fast) return [`<span><b class="w-fr-n">${fill(T.fps, { fps: w.fps >= 10 ? Math.round(w.fps) : w.fps.toFixed(1) })}</b></span>`, `<span>${fill(T.each, { n: size, hdr: HDR_TXT, rows: v.rows, cols: v.cols })}</span>`].join(sep);
    if (w.phase === "power-on") return [`<span>${T.powerOn}</span>`, `<span>${fill(T.starts, { hdr: HDR_TXT })}</span>`].join(sep);
    if (w.now >= 0) return statusHtml(w.now, true);
    const s = w.sense;
    if (s === null) return [`<span>${fill(T.sentBytes, { sent: w.sent, n: size })}</span>`, `<span>${T.muxOn}</span>`].join(sep);
    if (w.phase === "advance") return [`<span>${fill(T.lineDone, { s })}</span>`, `<span>${fill(T.sentBytes, { sent: w.sent, n: size })}</span>`].join(sep);
    return [`<span>${fill(T.next, { s, a: 3 + (s - 1) * v.cols, b: 2 + s * v.cols })}</span>`, `<span>${fill(T.sent, { sent: w.sent, n: size })}</span>`].join(sep);
  }
  /** Fig 3's ft:state -> the bytes of this frame that are on the wire (live.js: header, enable, then per sense line
   *  select, load, latch / read per drive line, advance). */
  function wireOf(st: FigState): Wire | null {
    const phase = String(st.phase ?? "");
    if (!phase) return null;
    const speed = Number(st.speed) || 0;
    // while the speed eases UP toward a rate the eye cannot follow, the figure's readout already names the rate it is
    // heading for (state.speedGoal; live.js readsFast): so does the strip (never 72, 95, 98 … frames a second on the way
    // to 100)
    const up = typeof st.speedGoal === "number" && st.speedGoal > speed ? st.speedGoal : speed;
    const fast = Boolean(st.playing) && up >= FAST;
    const goal = up;
    const sense = typeof st.senseLine === "number" ? st.senseLine : null;
    const drive = typeof st.driveLine === "number" ? st.driveLine : null;
    const byte = typeof st.byte === "number" ? st.byte : null;
    const w: Wire = { sent: 0, now: -1, fast, fps: FRAME_HZ * goal, phase, sense, drive };
    if (fast) w.sent = size;
    else if (phase === "power-on") w.sent = 0;
    else if (phase === "header" && byte) (w.now = byte - 1), (w.sent = byte);
    else if (byte && sense !== null) (w.now = byte - 1), (w.sent = byte);
    else if (sense === null) w.sent = 2; // E# pulse: the header is out
    else w.sent = 2 + (sense - 1 + (phase === "advance" ? 1 : 0)) * v.cols;
    return w;
  }
  const offFollow = fig?.onState((st) => {
    const w = wireOf(st);
    if (!w) return;
    wire = w;
    if (following()) paint();
  });

  function statusHtml(i: number, scanning: boolean): string {
    const sep = '<span class="w-fr-sep" aria-hidden="true"> · </span>';
    const T = S();
    const head = `<span>${fill(T.head, { i: i + 1, n: size })}</span>`;
    const rc = rowCol(i);
    if (!rc) {
      const b = HEADER[i];
      return [head, `<span>${fill(T.header, { b: hex2(b) })}</span>`, `<span>${fill(T.starts, { hdr: HDR_TXT })}</span>`].join(sep);
    }
    const where = `<span>${fill(T.where, { r: rc.r + 1, c: rc.c + 1 })}</span>`;
    if (scanning) return [head, where].join(sep);
    const b = bytes[i];
    return [head, where, `<span>${fill(T.reads, { b, hex: hex2(b) })}</span>`].join(sep);
  }

  // ------------------------------------------------------------------ figure link
  let figTimer = 0;
  function moveFigure() {
    if (!fig || !isDefault() || sel < 2) return;
    clearTimeout(figTimer);
    // wait until the learner settles on a byte, then walk the scan there: mux, load, latch, one clock per drive line
    figTimer = window.setTimeout(() => {
      const { r, c } = rowCol(sel)!;
      fig.act("pause");
      fig.act("mux", r + MUX_OFFSET);
      for (let k = 0; k < 2 + c; k++) fig.act("clock");
    }, 350);
  }
  function select(i: number) {
    sel = Math.max(0, Math.min(size - 1, i));
    if (press && sel >= 2) {
      press = rowCol(sel)!;
      compute();
    }
    paint();
    moveFigure();
  }

  // ------------------------------------------------------------------ scan replay
  // While Scan runs on the default build, Fig 3 plays the same frame at the same speed and leads: the bar follows the
  // figure's byte number (ft:state, <= 10/s) and fills in between updates at the replay rate.
  let link: { frame: number; byte: number; t: number; start: number } | null = null;
  const offState = fig?.onState((st) => {
    if (!raf || !link) return;
    const f = typeof st.frame === "number" ? st.frame : 0;
    if (f <= 0) return;
    if (link.frame < 0) link.frame = f;
    if (f > link.frame) {
      // the figure has started the next frame: this one is complete
      stopScan();
      paint();
      return;
    }
    if (typeof st.byte === "number") {
      link.byte = st.byte - 1;
      link.t = performance.now();
    }
  });
  function paintScanBtn(on: boolean) {
    scanBtn.innerHTML = on ? `${PAUSE_ICON}<span>${S().stop}</span>` : `${icon("play")}<span>${S().scan}</span>`;
    statusEl.setAttribute("aria-live", on ? "off" : "polite");
  }
  function stopScan() {
    cancelAnimationFrame(raf);
    raf = 0;
    cursor = -1;
    if (link) fig?.act("pause");
    link = null;
    paintScanBtn(false);
  }
  function tick(now: number) {
    if (!t0) t0 = now;
    let k = Math.floor(((now - t0) / 1000 / SCAN_SECONDS) * size);
    if (link) {
      if (link.frame < 0 && now - link.start > 1500) link = null; // the figure never answered: run on our own clock
      else if (link.frame < 0) k = 0;
      else k = Math.min(size - 1, Math.floor(link.byte + (Math.min(300, Math.max(0, now - link.t)) / 1000 / SCAN_SECONDS) * size));
    }
    if (k >= size) {
      stopScan();
      paint();
      return;
    }
    if (k !== cursor) {
      cursor = k;
      paint();
    }
    raf = requestAnimationFrame(tick);
  }
  function startScan() {
    if (raf) {
      stopScan();
      paint();
      return;
    }
    if (ctx.reducedMotion()) {
      // no animation: the whole frame is already on show
      cursor = -1;
      paint();
      return;
    }
    cursor = 0;
    t0 = 0;
    if (fig && fig.status === "ready" && isDefault()) {
      clearTimeout(figTimer);
      fig.act("reset");
      fig.act("play", SCAN_SPEED);
      link = { frame: -1, byte: 0, t: performance.now(), start: performance.now() };
    }
    paintScanBtn(true);
    raf = requestAnimationFrame(tick);
  }

  // ------------------------------------------------------------------ events
  cellsBox.addEventListener("click", (e) => {
    const k = grid.cellOf(e.target);
    if (k < 0) return;
    if (raf) stopScan();
    select(k + 2);
  });
  cellsBox.addEventListener("keydown", (e) => {
    const rc = rowCol(sel) ?? { r: 0, c: 0 };
    let { r, c } = rc;
    if (e.key === "ArrowLeft") c--;
    else if (e.key === "ArrowRight") c++;
    else if (e.key === "ArrowUp") r--;
    else if (e.key === "ArrowDown") r++;
    else if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      togglePress();
      return;
    } else return;
    e.preventDefault();
    r = Math.max(0, Math.min(v.rows - 1, r));
    c = Math.max(0, Math.min(v.cols - 1, c));
    if (raf) stopScan();
    select(2 + r * v.cols + c);
  });
  bar.addEventListener("click", (e) => {
    const t = e.target as Element;
    if (raf) stopScan();
    const hdr = t.closest<HTMLElement>(".w-fr-hdr i");
    if (hdr) {
      if (!following()) select(Number(hdr.dataset.h));
      return;
    }
    const band = t.closest<HTMLElement>(".w-fr-bands > i");
    if (!band) return;
    const b = band.getBoundingClientRect();
    const c = Math.max(0, Math.min(v.cols - 1, Math.floor(((e.clientX - b.left) / b.width) * v.cols)));
    const r = Number(band.dataset.r);
    // the strip: the figure goes to that crossing (and the strip follows it there)
    if (following()) fig!.act("seek", { sense: r, drive: c });
    else select(2 + r * v.cols + c);
  });
  function togglePress() {
    if (press) press = null;
    else press = rowCol(sel < 2 ? 2 + 5 * v.cols + 16 : sel)!;
    if (sel < 2 && press) sel = 2 + press.r * v.cols + press.c;
    pressBtn.setAttribute("aria-pressed", String(Boolean(press)));
    compute();
    paint();
  }
  scanBtn.addEventListener("click", startScan);
  pressBtn.addEventListener("click", togglePress);

  // ------------------------------------------------------------------ layout
  const PAD_X = 32;
  const PAD_Y = 22;
  function fit() {
    const W = root.clientWidth - PAD_X;
    const H = root.clientHeight - PAD_Y;
    if (W <= 0) return;
    const wide = W >= 600;
    root.classList.toggle("is-wide", wide);
    if (!showGrid) return;
    if (wide) grid.fit(W - 340 - 24, Math.max(H, 110), 0, true, grid.labelWidth());
    else grid.fit(W, 1e4, 0, true, grid.labelWidth());
  }
  const ro = new ResizeObserver(() => fit());
  ro.observe(root);
  function view(o?: FrameView | null) {
    showGrid = o?.grid !== false;
    root.dataset.grid = showGrid ? "on" : "off";
    // the strip needs a short row in the stage (lesson.css), the figure gets the rest
    if (showGrid) delete el.dataset.row;
    else el.dataset.row = "strip";
    if (!showGrid && raf) stopScan();
    bar.title = showGrid ? "" : S().barTip;
    fit();
    paint();
  }
  const onViewEvent = (e: Event) => view((e as CustomEvent<FrameView | null>).detail ?? undefined);
  el.addEventListener("ft:widget-view", onViewEvent);

  // a language switch: the words (the scan, the picked byte, the press and the figure link carry on)
  const offLang = ctx.onLang(() => {
    paintText(root.querySelector(".w-fr-side")!, S());
    grid.relabel({ aria: S().gridAria });
    title.textContent = fill(S().title, { n: size });
    bands.forEach((b, r) => (b.title = bandTip(r)));
    paintScanBtn(Boolean(raf));
    bar.title = showGrid ? "" : S().barTip;
    paint();
    fit();
  });

  compute();
  build();
  view();
  paint();
  requestAnimationFrame(() => fit());

  return {
    view,
    layout: fit,
    destroy() {
      cancelAnimationFrame(raf);
      clearTimeout(figTimer);
      offState?.();
      offFollow?.();
      ro.disconnect();
      el.removeEventListener("ft:widget-view", onViewEvent);
      offLang();
      delete el.dataset.row;
      root.remove();
    },
    run(p) {
      stopScan();
      const { rows, offset } = runParams(p);
      v = { ...VARIANTS.pyflexitac12, rows, muxOffset: offset };
      press = null;
      pressBtn.setAttribute("aria-pressed", "false");
      sel = Math.min(sel, 2 + rows * COLS - 1);
      compute();
      build();
      paint();
      return say(p);
    },
    say,
  };
}

/** The code card's rows and mux offset, clamped as run() uses them. */
function runParams(p: Record<string, number>): { rows: number; offset: number } {
  const rows = Math.max(1, Math.min(MAX_ROWS, Math.round(p.rows ?? ROWS)));
  const offset = Math.max(0, Math.min(15, Math.round(p.offset ?? MUX_OFFSET)));
  return { rows, offset };
}

/** The lines run(p) returns, in the language on show; it touches nothing (a language switch repaints the code card's
 *  console with them). */
function say(p: Record<string, number>): string[] {
  const { rows, offset } = runParams(p);
  const n = 2 + rows * COLS;
  const last = rows - 1 + offset;
  const T = S();
  const out = [
    fill(T.outFrame, { h: HEADER.length, rows, cols: COLS, n }),
    fill(T.outMux, { a: offset, b: Math.min(last, 15), again: last > 15 ? fill(T.outAgain, { wrap: last - 16 === 0 ? "0" : `0–${last - 16}`, k: 16 }) : "" }),
    fill(T.outRate, { n, hz: FRAME_HZ, bps: (n * FRAME_HZ).toLocaleString("en-US"), pc: ((n * FRAME_HZ * 10) / BAUD * 100).toFixed(0), baud: BAUD.toLocaleString("en-US") }),
  ];
  const repo = VARIANTS.repo16;
  if (rows === ROWS && offset === MUX_OFFSET) out.push(fill(T.outDefault, { rows: ROWS, cols: COLS, n: FRAME_BYTES }));
  else if (rows === repo.rows && offset === repo.muxOffset) out.push(fill(T.outRepo, { rows: repo.rows }));
  else if (offset !== MUX_OFFSET) out.push(fill(T.outOffset, { rows: ROWS, cols: COLS, a: MUX_OFFSET, b: MUX_OFFSET + ROWS - 1 }));
  if (n !== FRAME_BYTES) out.push(fill(T.outExpect, { n, rows }));
  return out;
}
